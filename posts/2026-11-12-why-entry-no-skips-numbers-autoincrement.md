---
title: "Why does my Entry No. skip numbers? AutoIncrement gaps, explained"
date: 2026-11-12
type: concept
tags: AL, Keys, Tables, AutoIncrement, Business Central
summary: Entry No. goes 1, 2, 3, 4, 5, then 7. Nobody deleted number 6. AutoIncrement is designed to leave gaps, and once you know why, you'll know when it's the right choice and when you need something else.
---

A user once sent me a screenshot of a log table and asked, a bit worried:

*"Anil, Entry No. goes 1, 2, 3, 4, 5, and then 7. Who deleted number 6?"*

Nobody deleted anything. Number 6 was never saved in the first place.

The Entry No. field had `AutoIncrement = true`, and AutoIncrement is **designed** to leave gaps. Microsoft says so in the docs too. Once I understood why, I stopped being surprised, and I also got much clearer about when to use it and when not to.

In my last post, the [unique key](#/post/2026-11-11-unique-secondary-keys-in-al) blocked a duplicate insert in a table with an AutoIncrement Entry No. That blocked insert is actually one of the reasons for a gap. You'll see why below.

## What AutoIncrement does

It's one property on an Integer or BigInteger field:

```al
field(1; "Entry No."; Integer)
{
    AutoIncrement = true;
}
```

When you insert a record and leave this field as 0, SQL Server gives it the next number for you. You don't write any FindLast + 1 code. A table can have only one AutoIncrement field.

After the `Insert()`, the field holds the number SQL Server gave it, so you can use it straight away:

```al
Log.Init();
Log.Message := 'Vendor V-1001 created';
Log.Insert();
Message('Saved as entry %1', Log."Entry No.");
```

## Why the gaps happen

SQL Server's job here is to give every insert a **different** number, very fast, even when many users insert at the same time. To be fast, it never goes back and reuses a number once it has given it out. That one rule is the cause of every gap.

These are the situations where a number gets used up without a record staying in the table.

**1. The record was deleted.** You insert 6, then delete it. The next insert gets 7, not 6. Deleted numbers are never given out again.

**2. The transaction was rolled back.** This is the one that confuses people most. Look at this:

```al
Log.Init();
Log.Message := 'Processing batch';
Log.Insert();          // SQL Server gives it number 6

Error('Something went wrong');   // everything rolls back
```

The `Error` rolls back the whole transaction, so the row with 6 disappears. But the **number** 6 is not given back. The next successful insert gets 7.

This happens all the time without you seeing it. A posting fails halfway. A validation error stops a job queue entry. A user closes a page with an error. Each one can use up a number.

**3. The insert itself failed.** This is the link to my unique key post. When I sent the same document twice, the unique key stopped the second insert with an error. But SQL Server had already given that insert a new Entry No. before it found the duplicate. So the failed insert also left a gap.

**4. Two users inserted at the same time and one of them failed.** User A gets 6, user B gets 7. User A's transaction rolls back and user B's commits. Now the table has 5 and 7, with no 6.

**5. The database restarted.** For speed, SQL Server keeps a small batch of upcoming numbers ready in memory. If the database restarts or fails over before those numbers are used, they are lost. On SQL Server, this can show up as one big jump, sometimes by around a thousand. On BC online you don't control restarts, so a sudden jump in Entry No. is not a sign that something is wrong.

## Is a gap a problem?

For most tables, no. Entry No. in a log, a staging table or an integration queue is just an **identity**. Its job is to make each row unique and keep rows in order. It doesn't need to be continuous. 1, 2, 3, 5, 7 is just as good as 1, 2, 3, 4, 5.

It becomes a problem only when the number has a **business meaning**, where someone (an auditor, a tax rule, a customer) expects no numbers to be missing. Invoice numbers are the classic example.

## When to use AutoIncrement

It's a great fit for:

- **Log and history tables.** Change logs, API call logs, error logs.
- **Staging and integration tables.** Like my inbound integration, where each incoming record just needs its own row.
- **Queue and buffer tables.** Anything that's processed and maybe deleted later.
- **Any table where many users or sessions insert at the same time.** SQL Server gives out the numbers without you writing any locking code.

That last point is the big benefit. The old way of doing this was:

```al
LastEntry.LockTable();
if LastEntry.FindLast() then
    NextEntryNo := LastEntry."Entry No." + 1
else
    NextEntryNo := 1;
```

That works, but `LockTable` makes every other user wait until your transaction finishes. With busy tables, that wait is exactly where blocking and slow posting come from (I wrote about this in my [LockTable post](#/post/2026-10-30-what-is-a-lock-and-what-locktable-really-locks)). AutoIncrement avoids the wait completely.

## When not to use it

- **When the business needs numbers without gaps.** For posted invoices, credit memos, or anything a tax or audit rule says must be continuous, use a **No. Series** that doesn't allow gaps. It's slower because it locks, but that's the price of no gaps. My [No. Series post](#/post/2026-11-02-no-series-peeknextno-vs-getnextno) explains how it works.
- **When the number must be known before the insert.** AutoIncrement gives the number only at insert time. If you need the number earlier (to print it, or link other records first), use a No. Series.
- **In temporary tables.** AutoIncrement doesn't work on temporary tables. The field stays 0 unless you number the rows yourself, so two temporary inserts can clash on the primary key. In a temporary table, keep a counter variable and set the Entry No. yourself.
- **When you want to set the number yourself.** If the field isn't 0 when you insert, SQL Server needs special database permissions to accept your value. That's not something you can count on, especially in BC online. Always leave it 0 and let SQL Server choose.

## A few things to remember

- **Don't build logic that depends on "no gaps".** For example, "process entries from LastProcessed + 1 to LastProcessed + 100" will miss records or wait for numbers that never come. Use `SetFilter("Entry No.", '>%1', LastProcessed)` instead.
- **Don't count rows by subtracting numbers.** Entry No. 1000 doesn't mean there are 1000 rows. Use `Count()`.
- **Gaps don't mean lost data.** If someone asks "who deleted number 6?", the honest answer is usually "nobody, it was never saved". If you really need to know, check the change log or the error log, not the Entry No.
- **AL also has `NumberSequence`.** It gives you numbers from SQL Server outside any table, and it can also leave gaps for the same reasons. It's useful when you need a fast unique number for something that isn't a record.

## In short

- AutoIncrement numbers are **unique and increasing, but not continuous**. That's by design.
- Gaps come from deletes, rollbacks, failed inserts (like the duplicate my unique key blocked), and database restarts.
- Use it for logs, staging, queues and busy tables. It's fast and needs no locking.
- Don't use it where the number must have no gaps, must be known before insert, or lives in a temporary table. Use a No. Series or your own counter instead.

The next time someone asks you who deleted number 6, you can tell them nobody did, and explain why.

## Sources

- [AutoIncrement property (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/properties/devenv-autoincrement-property)
- [IDENTITY property: what it doesn't guarantee (Microsoft Learn, SQL Server)](https://learn.microsoft.com/sql/t-sql/statements/create-table-transact-sql-identity-property)
- [SCOPE_IDENTITY: failed and rolled-back inserts still use up values (Microsoft Learn, SQL Server)](https://learn.microsoft.com/sql/t-sql/functions/scope-identity-transact-sql)
- [SQL Server: jump in identity column after restart (SQLAuthority)](https://blog.sqlauthority.com/2017/03/24/sql-server-jump-identity-column-restart/)
