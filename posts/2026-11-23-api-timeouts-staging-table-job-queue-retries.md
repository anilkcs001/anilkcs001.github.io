---
title: Don't post inside the API call: staging table, job queue and retries in Business Central
date: 2026-11-23
type: issue
tags: AL, Integration, API, Job Queue, Business Central
summary: An outside system sends 100 records per $batch call, and in the busy hour the calls start timing out. I'll explain how I split the work into a fast receive-and-check part and a background posting part, with idempotency, our own status codes, retries that know which errors to retry, and a callback so the other system always knows what happened.
---

Many systems send data to Business Central through APIs. A webshop, a logistics system, a billing tool. On a quiet day, everything works. Then the busy hour comes, and the API calls start timing out.

In this post I'll explain the approach I like for this. I'll use a simple example, an online store, but the same idea works for any system that sends a lot of data to BC.

## The problem

Let's say ABC Webshop sells online. Every sale and every payment has to go into Business Central.

The webshop sends the data through OData, using `$batch`. In Business Central online, one `$batch` call can carry at most 100 operations. So the webshop sends 100 records per call.

The simple way is to do everything inside the API call. The call comes in, we validate the record, and we post it, right there.

On a normal day, that's fine. But in the evening rush, the webshop sends many batches, one after another, sometimes together. And then the problems start:

- **Calls time out.** Posting 100 documents takes time. The API call can't wait that long, so it times out.
- **Batches block each other.** Two batches posting at the same time wait for each other's locks. One waits, then times out.
- **Nobody knows what really happened.** When a call times out, some records are posted and some are not. The webshop doesn't know which ones. If it sends the batch again, we can post the same order twice.

So the real problem isn't "100 records". The real problem is doing slow work inside a call that must answer fast.

## The idea: split it into two parts

I always start with one simple question. What does the webshop actually need from the API call?

It needs to know: did BC receive my data, and is it correct? It doesn't need the posting to finish in the same second.

So I split the work into two parts:

1. **Receive and check (fast).** The API call only saves the records into a staging table and checks them. It answers in a few seconds.
2. **Post (slow, in the background).** A job queue posts the records later, one by one, and tells the webshop the result.

![How the data flows: the webshop sends batches to an API page, records go into a staging table with checks, a job queue posts them in the background, and a callback tells the webshop the result](images/api-staging-job-queue/1-architecture.svg)

## Why a job queue? I checked the other options first

Business Central has a few ways to run code in the background. I didn't pick the job queue by habit. Here's how I think about each one.

**Post directly in the API call.** Simple, but it's exactly what causes the timeouts. No.

**Page Background Task.** This runs work in the background for a page that a user has open, like calculating totals while the user looks at the page (I wrote about this in my [page background task post](#/post/2026-10-27-page-background-task-purchase-gst-totals)). But it's read-only, it can't write to the database, and it belongs to an open page. An API call has no page open, and posting needs to write. So it doesn't fit.

**StartSession.** It starts a background session and runs a codeunit, and it can write. But if it fails, nothing retries it, and there's no page where a user can see what went wrong.

**TaskScheduler.CreateTask.** Better. It runs a codeunit in the background, it can start after a given time, and I can give it a failure codeunit. But I would have to build the logging, the retry and the screens myself.

**Job queue.** The job queue is actually built on top of the task scheduler, and it already gives me what I need:

- It runs on a schedule, for example every 5 minutes.
- It keeps a log, so I can see every run and every error.
- It can rerun after a failure (Maximum No. of Attempts to Run, Rerun Delay).
- Users can see it, stop it and restart it from a normal page.
- With a **Job Queue Category**, jobs in the same category run one after another, not at the same time. That stops my posting jobs from locking each other.

So I use the standard tool instead of building my own. I always prefer that.

## Part 1: receive and check

When the batch comes in, I don't post anything. I do three things.

**1. Save the records into a staging table.** Each record gets a status code.

**2. Stop duplicates with a unique key.** The staging table has a unique key on Source System + Webshop Order No. If the webshop sends the same order again, for example after a timeout, the database itself refuses the second one. I wrote about this in my post on [Unique keys](#/post/2026-11-11-unique-secondary-keys-in-al).

```al
table 50100 "Webshop Staging Header"
{
    // Captions and DataClassification left out to keep it short
    fields
    {
        field(1; "Entry No."; Integer) { AutoIncrement = true; }
        field(2; "Source System"; Code[20]) { }
        field(3; "Webshop Order No."; Code[35]) { }
        field(4; "Status Code"; Integer) { }
        field(5; "Last Error"; Text[2048]) { }
        field(6; "Error Details"; Blob) { }
        field(7; "BC Document No."; Code[20]) { }
        field(8; "Retry Count"; Integer) { }
        field(9; "Next Retry At"; DateTime) { }
        field(10; "Needs Attention"; Boolean) { }
    }
    keys
    {
        key(PK; "Entry No.") { Clustered = true; }
        key(Idempotency; "Source System", "Webshop Order No.") { Unique = true; }
    }
}
```

**3. Check everything I can, up front.** Customer exists, item exists, amounts are not zero, dimensions are valid, posting date is allowed, and so on. Every error is collected, not just the first one.

Then the API answers straight away. Records with errors go back with their status code and the reason, so the webshop can fix them and send them again. Clean records are marked **Ready to Post**.

This is the most important part for me. Most problems are caught here, in a few seconds, before any posting even starts.

## Our own status codes, and all errors sent back together

The webshop shouldn't have to read long BC error texts to know what happened. So I keep our own status code on every record, and send it back with the message.

| Code | Status | Meaning |
|---|---|---|
| 101 | Received | Line received and OK, waiting for the rest of the document |
| 0 | Ready to Post | Document is clean and ready for posting |
| 100 | Posted | Posted, or already posted earlier |
| -1xx | Rejected | One specific field error, for example customer not found or a wrong date format |
| -200 | Rejected | The document doesn't balance |
| -999 | Rejected | More than one error |
| -300 | Posting failed | Validation passed, but posting failed in BC |

This is how I handle the errors:

- **All errors are collected, not just the first one.** I check everything once, collect every error, and send them all back together. So the webshop can fix everything in one go, not one error per try.
- **One error keeps its own code.** Two or more errors get -999, and the full list goes into a details field (a Blob), with every message.
- **Each level shows its own errors.** A line shows only its own errors. The document header shows its own errors plus a short summary of the line errors, like "Line 2: customer not found". So when a user opens a record, they see exactly what's wrong with it.
- **Each check runs only once.** Lines can arrive one by one, and the last line carries a flag that says "that's all". Each line is checked when it arrives. When the last line comes, only the document checks run, like the balance. The saved results of the earlier lines are reused, not checked again. That keeps the API fast.
- **I check what posting will need, up front.** Blocked customer, missing posting setup, dimension rules, allowed posting date, closed period, missing exchange rate, number series. If a document passes all this, posting almost never fails later.

One more rule: the API part never touches the journal, never takes a number from the number series, and never commits in the middle. It only writes to staging. So it can't lock the tables that the posting job is using.

## Idempotency: the same request twice gives the same result

Idempotency is a big word, but the idea is simple. If the webshop sends the same thing two times, BC should do it only once, and give the same answer both times.

Why does this matter so much? Because retries are normal. The webshop's call times out, it doesn't know if we received the data, so it sends it again. Without idempotency, we post the same order twice. In finance, that's a serious problem.

This is how I handle it:

- **Every record comes with a key.** The webshop sends each record to our API endpoint (an API page) with an idempotency key. In my example, the key is Source System + Webshop Order No. It could also be a unique request ID that the webshop creates for each record.
- **The staging table stores that key, with Unique = true.** So the database itself refuses a second record with the same key. I don't need to write find-then-insert checks for this.
- **A duplicate gets a friendly answer, not a scary error.** When the same key comes again, the endpoint doesn't create anything. It answers "already received", with the current status of the first one: Ready to Post, Posted with the BC document number, or Rejected with the reason.
- **So the webshop can safely send again.** As many times as it wants. One order, one staging record, one posted document.

And the same idea goes all the way through:

- **Posting.** Before posting a document, the job checks that it's not already Posted, and saves the BC document number on the record. So even if the job queue runs again, it never posts the same document twice.
- **Callback.** The callback carries the webshop order number and the BC document number. If the webshop receives the same callback twice, it sees the same result, and nothing changes.

For me, this is the most important rule in any integration: sending the same thing again must never create it again.

## Part 2: post in the background

A job queue runs every few minutes. It picks up the documents that are Ready to Post and posts them one by one.

![Inside the posting job: take a snapshot of ready documents, then for each one commit, post it inside Codeunit.Run, mark it Posted or save the error after the rollback, and continue with the next document](images/api-staging-job-queue/2-posting-job.svg)

Here is how the posting job works, step by step:

- **It takes a snapshot first.** It collects the IDs of all documents that are ready, before posting anything. Why? Because posting changes the status, and records would move out of my filter while I'm looping.
- **One document, one transaction.** For each document, it does a `Commit()` first, then posts it inside `if Codeunit.Run(...) then`. So if one document fails, only that document rolls back. The others still post. (My post on [Commit](#/post/2026-10-31-commit-in-al-what-it-really-means) explains why this matters.)
- **A failure is written down, and the loop goes on.** If posting fails, the error goes on the document (status -300, with the full BC error), and the job moves to the next one.

```al
procedure PostReadyDocuments()
var
    Staging: Record "Webshop Staging Header";
    Doc: Record "Webshop Staging Header";
    EntryNos: List of [Integer];
    EntryNo: Integer;
begin
    // 1. Snapshot first: posting changes the status, so the filter would shift
    Staging.SetRange("Status Code", 0);
    Staging.SetLoadFields("Entry No.");
    if Staging.FindSet() then
        repeat
            EntryNos.Add(Staging."Entry No.");
        until Staging.Next() = 0;

    // 2. One document, one transaction
    foreach EntryNo in EntryNos do begin
        Commit();
        Doc.Get(EntryNo);
        ClearLastError();
        if not Codeunit.Run(Codeunit::"Webshop Post Document", Doc) then
            MarkPostingFailed(EntryNo, GetLastErrorText());
    end;
end;

local procedure MarkPostingFailed(EntryNo: Integer; ErrorText: Text)
var
    Doc: Record "Webshop Staging Header";
begin
    // Read it again: the failed posting was rolled back
    Doc.Get(EntryNo);
    Doc."Status Code" := -300;
    Doc."Last Error" := CopyStr(ErrorText, 1, MaxStrLen(Doc."Last Error"));
    Doc.Modify();
end;
```

The posting codeunit itself is careful too. It locks only that one document, checks again that it's not already posted, posts it with `SetSuppressCommit(true)` on the standard posting codeunit, and marks it Posted. All in one transaction, so a document is either fully posted or not posted at all.

```al
codeunit 50101 "Webshop Post Document"
{
    TableNo = "Webshop Staging Header";

    trigger OnRun()
    var
        Doc: Record "Webshop Staging Header";
    begin
        Doc.ReadIsolation := IsolationLevel::UpdLock;   // lock only this one record
        Doc.Get(Rec."Entry No.");
        if Doc."Status Code" = 100 then                 // already posted: do nothing
            exit;

        Doc."BC Document No." := CreateAndPostDocument(Doc);  // uses SetSuppressCommit(true)
        Doc."Status Code" := 100;
        Doc.Modify();
    end;
}
```

`CreateAndPostDocument` is where you build the sales document from the staging lines and post it. I left it out because it's different for every business. (`ReadIsolation` is explained in my [ReadIsolation post](#/post/2026-10-29-readisolation-in-al-explained-simply).)

So the job queue itself never fails because of one bad document.

## Not all errors are the same

This is the part I think about the most. When posting fails, I ask: will it work if I just try again?

**Temporary errors. Retrying will help.**

- A lock timeout or deadlock: another posting was holding the table.
- Another user changed the same record at the same time. Through an API, this comes back as 409 Conflict.
- 429 Too Many Requests, 500 or 503 errors, or a timeout when calling another service.

These are not the user's fault. Nothing is wrong with the data. Trying again a bit later will usually work.

**Business errors. Retrying will never help.**

- The posting date is not within the allowed posting period.
- A posting setup or a GST setup is missing.
- The customer or an item is blocked.
- A dimension value is blocked.

If I retry these a hundred times, they fail a hundred times. A person has to fix something first. So I treat them differently.

To decide which kind it is, I look at the error with `GetLastErrorCode()` and `GetLastErrorText()`, and keep a small list of what counts as temporary. Keep that list small, and build it from what you really see in your logs.

![When posting fails: temporary errors go to a retry job queue with growing waits and become Needs Attention after the maximum tries; business errors go straight to Needs Attention, where a user fixes them and reposts](images/api-staging-job-queue/3-error-routing.svg)

## A second job queue just for retries

For temporary errors, I run a second job queue. Its only job is to retry.

- It picks up records that failed with a temporary error.
- Each record has a Retry Count and a Next Retry At time.
- The wait gets longer each time, for example 5 minutes, then 10, then 20. This is called exponential back-off. It gives the system time to calm down instead of hitting it again and again.
- After a maximum number of tries, I stop and mark it **Needs Attention**, so it doesn't loop forever.

```al
local procedure ScheduleRetry(var Doc: Record "Webshop Staging Header")
var
    WaitMs: BigInteger;
    i: Integer;
begin
    Doc."Retry Count" += 1;
    if Doc."Retry Count" > 5 then begin        // stop after 5 tries
        Doc."Needs Attention" := true;
        Doc.Modify();
        exit;
    end;

    WaitMs := 5 * 60000;                       // 5 minutes
    for i := 2 to Doc."Retry Count" do
        WaitMs := WaitMs * 2;                  // 5, 10, 20, 40, 80 minutes
    Doc."Next Retry At" := CurrentDateTime() + WaitMs;
    Doc.Modify();
end;
```

Why a separate job queue? Because the main job should stay fast and only post new records. Retries happen on their own schedule, without slowing down the normal flow.

I put the posting job and the retry job in the **same Job Queue Category**. So they never run at the same time, and never post into the same tables together. And the retry job only re-posts documents whose posting failed (-300). Validation errors are never retried. Those go back to the webshop, and the webshop sends the corrected record again.

**For business errors, there is no automatic retry.** The record goes straight to Needs Attention, with a clear message, for example: "Posting date 31-03 is not allowed. Check General Ledger Setup."

The user opens a page, sees all records that need attention, fixes the setup or the data, and clicks **Repost**. The record goes back to Ready to Post, and the job queue picks it up in its next run.

## Telling the webshop what happened: the callback

The webshop still needs to know the final result. So after posting, BC calls the webshop's API (a webhook) with:

- the webshop order number,
- the status: Posted or Failed,
- the BC document number when posted, or the reason when failed.

**How the callback goes out fast.** When a document posts, an event fires inside the posting. If the posting fails, a failure event fires after the rollback, so the failure is not lost with it. These events schedule a background task with the task scheduler, which runs a few seconds later and sends the callbacks:

```al
TaskScheduler.CreateTask(
    Codeunit::"Webshop Send Callbacks", 0, true, CompanyName(), CurrentDateTime() + 3000);
```

But a task doesn't retry by itself. So I also keep a recurring job queue every 5 minutes as a safety net. It picks up anything the task missed, and anything waiting to retry.

**The callback can fail too.** The webshop can be down, slow, or busy. So the callback has its own status on the staging record, and I read the webshop's answer before deciding what to do. Not every error means "try again":

- **400, 405 or 422:** our data was wrong, so retrying won't help. Mark it Failed.
- **403:** the API key is wrong or missing. Someone has to fix the setup.
- **429, 500 or a timeout:** temporary. Retry later, with a Next Attempt time and a maximum number of tries, the same back-off as above.

And I always send failures first. If something failed, the webshop should hear about it quickly, so they can fix it and send it again.

Because of idempotency, sending the callback twice is safe. The webshop sees the same order number and the same result.

## What we get from this

- **No more timeouts.** The API only receives and checks, so it answers in seconds.
- **No more locking fights.** The job queue category makes posting run one at a time.
- **Nothing posted twice.** The unique key and the "already posted" check block duplicates.
- **Nothing lost.** Every record has a status, and the webshop always gets the final result.
- **Users fix only what they can fix.** Temporary errors retry by themselves. Business errors come to a person, with a clear reason.

## A few things to be careful about

- **Don't retry business errors.** It only fills the log and hides the real problem.
- **Always put a limit on retries.** Without a maximum, a broken record retries forever.
- **Keep the error message on the staging record.** When a user asks "why didn't my order post?", the answer should be right there.
- **Give the job queue a category.** Otherwise two posting jobs can run together and lock each other again. (My post on [locks](#/post/2026-10-30-what-is-a-lock-and-what-locktable-really-locks) explains why.)
- **Don't commit in the middle of one document's posting.** Let each document post fully or fail fully.

## In short

The API call should answer fast. Posting is slow. So don't do slow work inside a fast call.

Receive and check in the API. Post in a job queue. Retry what can be retried, send the rest to a person, and always tell the other system what happened.

If you've solved this in a different way, maybe with Azure Service Bus in the middle, I'd love to hear it in the comments.

## Sources

- [Operational limits for Business Central online: max 100 operations per $batch (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/administration/operational-limits-online)
- [Asynchronous processing overview: page background task, StartSession, task scheduler, job queue (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-async-overview)
- [Page Background Tasks: read-only, tied to the page (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-page-background-tasks)
- [Job queue: how it works, built on the task scheduler (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-job-queue)
- [Post multiple documents: jobs in the same Job Queue Category run one at a time (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/ui-batch-posting)
- [TaskScheduler.CreateTask method (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/taskscheduler/taskscheduler-createtask-integer-integer-boolean-string-datetime-recordid-method)
