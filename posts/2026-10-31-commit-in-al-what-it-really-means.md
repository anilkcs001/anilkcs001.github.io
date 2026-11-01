---
title: Commit() in AL: what I wish someone had told me earlier
date: 2026-10-31
type: feature
tags: AL, Commit, CommitBehavior, Transactions, Business Central
summary: For a long time I thought Commit() meant "save". It doesn't, and that misunderstanding can quietly break your data. Here's what I learned about Commit, the hidden commit in Codeunit.Run, and how CommitBehavior protects your code from other people's commits. Part 3 of a short series on locking.
---

*Part 3 of my small series on locking. [Part 1](#/post/2026-10-29-readisolation-in-al-explained-simply) was ReadIsolation and [part 2](#/post/2026-10-30-what-is-a-lock-and-what-locktable-really-locks) was locks and LockTable. I'm using the same example again: Ravi, Priya and the IT budget.*

---

When I started with AL, I treated `Commit()` like the **Save** button in Excel. If I wanted something to be "really saved", I wrote `Commit()`. It felt safe.

It took me a while to understand that I had it almost backwards. Let me explain what I learned, in the order I learned it.

---

## Lesson 1: You almost never need to write Commit

The first surprise for me was this line in Microsoft Learn:

> During AL code execution, if a transaction is needed, the AL runtime automatically initializes it. At the completion of AL code execution, any transactions that are created are also automatically ended, committing any updates made by the AL code.

When I read that slowly, it clicked. Business Central is already pressing **Save** for me.

When Ravi clicks **Release**:

- Business Central starts a transaction on its own.
- If his action **finishes without any error**, everything is saved.
- If **any error** happens, everything is undone, as if he never clicked.

That second point is actually a gift. Business Central gives me **all or nothing** for free. I only lose it when I write `Commit()` myself.

---

## Lesson 2: Commit doesn't mean "save", it means "this part is final"

Microsoft's docs describe `Commit()` as ending the current write transaction, and show this small picture:

```
BeginWriteTransactions
(AL Statements) // Transaction 1
Commit();
(AL Statements) // Transaction 2
EndWriteTransactions
```

So `Commit()` doesn't just "save". It **cuts** my code into two separate transactions. Everything before it becomes final. If something fails after it, Business Central can only undo the part **after** it.

The way I explain it to myself now:

> **Commit() = "Whatever happens next, don't undo what came before."**

Once I started reading every `Commit()` in code with that sentence, I started seeing problems everywhere.

---

## Lesson 3: How a Commit in the wrong place broke Ravi's release

Ravi's release does three things, and they **belong together**:

1. Reserve 40,000 in the IT budget
2. Change the PO status to Released
3. Check the approval rules

I once saw code like this, with a `Commit()` added after step 1. The idea was to "release the budget lock early" (remember from part 2: locks stay until the transaction ends):

```al
ReserveBudget('IT', 40000);   // step 1
Commit();                     // "release the lock early"
SetStatusReleased(PO);        // step 2
CheckApprovalRules(PO);       // step 3 fails with an error
```

Now step 3 fails. Business Central undoes what it can, which is only steps 2 and 3.

- The PO goes back to **Open**.
- But the IT budget still shows **40,000 reserved**, because step 1 was already final.

So the budget is reserved for a PO that was never released. The next day Priya tries to release her PO and gets "not enough budget". Nobody can explain it, because the error that caused it happened yesterday and was "undone".

Remove that one `Commit()` and the problem disappears: the error undoes all three steps together.

**What I learned:** if steps belong together, there must be **no Commit between them**.

---

## Lesson 4: Where Commit is actually right

That doesn't mean Commit is always bad. It's right when each piece is **complete on its own**.

Example: a job queue that sends 500 posted invoices to a vendor portal, one by one. Invoice 30 and invoice 31 have nothing to do with each other.

```al
if PortalQueue.FindSet(true) then
    repeat
        SendOneInvoice(PortalQueue);
        PortalQueue.Status := PortalQueue.Status::Sent;
        PortalQueue.Modify();
        Commit();   // this invoice is finished, keep it
    until PortalQueue.Next() = 0;
```

If invoice 301 fails, invoices 1 to 300 really **were** sent, so they should stay marked as Sent. Here the Commit is exactly right. It also keeps the locks short, so users aren't blocked for the whole run. (Same idea as my older post, [Commit every 100 records in AL with mod](#/post/2026-10-16-commit-every-100-records).)

The question I now ask before writing any `Commit()`:

> **"If the next line fails, am I happy that everything before this stays?"**

If the answer is no, the Commit doesn't belong there.

---

## Lesson 5: The commit I didn't write (`if Codeunit.Run() then`)

This one caught me by surprise. Microsoft Learn says:

> When the return value of the Codeunit.Run method is used, for example using the `if Codeunit.Run() then` pattern, any changes done to the database will be committed at the end of the codeunit, unless an error occurs. If you're already in a transaction you must commit first before calling `Codeunit.Run`.

So this line, which looks so innocent, **also commits**:

```al
if Codeunit.Run(Codeunit::"ABC Send Invoice", PortalQueue) then
```

It's a great pattern for "try this, and if it fails, don't stop everything", like in the job queue above. But it's still a commit, so I never use it in the middle of something like Ravi's release.

---

## Lesson 6: CommitBehavior, protecting my code from **other people's** Commit

This is the part that took me the longest, so let me go slowly.

### The problem

Let's say I wrote Ravi's release properly, with no Commit anywhere. All or nothing. I'm happy.

Then, to make my code extensible, I raise an event after the budget is reserved, so other developers can add their own logic:

```al
procedure ReleaseWithBudget(var PurchaseHeader: Record "Purchase Header")
begin
    ReserveBudget(PurchaseHeader);        // step 1
    OnAfterReserveBudget(PurchaseHeader); // other people's code runs here
    SetStatusReleased(PurchaseHeader);    // step 2
    CheckApprovalRules(PurchaseHeader);   // step 3
end;

[IntegrationEvent(false, false)]
procedure OnAfterReserveBudget(var PurchaseHeader: Record "Purchase Header")
begin
end;
```

A colleague subscribes to my event. They want to write a "budget reserved" line into a log table, and they want the log to be kept "no matter what", so they add a `Commit()`:

```al
[EventSubscriber(ObjectType::Codeunit, Codeunit::"ABC PO Release Mgt.", 'OnAfterReserveBudget', '', false, false)]
local procedure LogBudgetReserved(var PurchaseHeader: Record "Purchase Header")
begin
    InsertBudgetLog(PurchaseHeader);
    Commit();   // "so the log is always kept"
end;
```

See what happened? My code has no `Commit()`, but **their** Commit runs right in the middle of **my** release, between step 1 and step 2. It's exactly the broken situation from Lesson 3. The budget is reserved and final, and if step 3 fails, the PO goes back to Open. And I would never find it by reading my own code, because the Commit isn't in my code.

### The fix: one line on my event

This is what `CommitBehavior` is for. I add one attribute on my event:

```al
[CommitBehavior(CommitBehavior::Ignore)]
[IntegrationEvent(false, false)]
procedure OnAfterReserveBudget(var PurchaseHeader: Record "Purchase Header")
begin
end;
```

In plain words, this line says:

> **"While the subscribers of this event are running, if anyone calls Commit(), just ignore it."**

Now when my colleague's subscriber calls `Commit()`, nothing happens. Their log line is still inserted, but it's part of **my** transaction. If the release succeeds, the log is saved along with everything else. If the release fails, the log is undone too, which is correct, because nothing was really reserved.

My all-or-nothing is safe again, whatever subscribers do.

Microsoft Learn's own example does exactly this. The attribute is on the event publisher, with the comment *"Ignore explicit commits attempted by event subscribers"*, and a subscriber whose `Commit()` is ignored.

### Ignore or Error?

There are two options, and here's how I think about them:

| Option | What happens when someone calls Commit() inside | When I'd use it |
|---|---|---|
| `CommitBehavior::Ignore` | The Commit is quietly skipped, and the code continues | In production, to keep my transaction safe without breaking anyone |
| `CommitBehavior::Error` | The Commit stops everything with an error | When I want to **find** whoever is calling Commit, for example during development and testing |

`Ignore` is the polite one: it protects me silently. `Error` is the strict one: it makes the bad Commit visible, so it can be fixed.

### Three small rules (from the docs, in my words)

1. **It only lasts while that method runs.** When the method (or event) finishes, even with an error, normal Commit behaviour comes back.
2. **It can only get stricter, never looser.** If my caller already said `Error`, my `Ignore` can't relax it. The stricter rule wins.
3. **It only stops explicit `Commit()` calls.** It doesn't stop the hidden commit of `if Codeunit.Run() then` from Lesson 5.

---

## What I do now

- I don't write `Commit()` unless I can answer "yes" to: *"If the next line fails, am I happy that everything before this stays?"*
- I commit between **independent** pieces (one invoice, one record), never in the middle of one piece of work.
- I remember that `if Codeunit.Run() then` is a commit too.
- When I raise an event in the middle of an all-or-nothing process, I put `[CommitBehavior(CommitBehavior::Ignore)]` on it.

If CommitBehavior still feels confusing, ask me in the comments. It confused me for a long time too.

**Next in this series:** deadlocks, when Ravi and Priya wait for each other forever.

---

**Sources**

- Microsoft Learn: [Database.Commit() method](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/database/database-commit-method)
- Microsoft Learn: [CommitBehavior attribute](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/attributes/devenv-commitbehavior-attribute)
- Microsoft Learn: [CommitBehavior option type](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/commitbehavior/commitbehavior-option)
- Microsoft Learn: [Codeunit.Run method (transaction semantics)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/codeunit/codeunit-run-method)
