---
title: What is a lock, and what does LockTable really lock?
date: 2026-10-30
type: feature
tags: AL, Locking, LockTable, Performance, Business Central
summary: Using the same IT budget example as part 1, let's see what a lock is, how long it lives, and why LockTable doesn't lock the whole table the moment you call it. Part 2 of a short series on locking.
---

*Part 2 of a short series on locking. In [part 1](#/post/2026-10-29-readisolation-in-al-explained-simply) we looked at ReadIsolation with Ravi, Priya and the IT budget. We'll use the same example here.*

---

## What is a lock?

Remember our IT budget line:

> **IT budget:** Budget = 1,00,000 | Reserved = 0

Ravi clicks **Release**, and his code changes Reserved to 40,000.

The moment his code does `Modify`, the database puts a **lock** on that record. Think of it as a "busy, someone is editing" sign on that one record.

While the sign is there:

- If Priya's code also wants to **change** the IT budget line, it **waits**.
- If Priya's code wants to change the **Admin** budget line, it doesn't wait. The sign is only on the IT record.

That second point is important. When you change one record, only **that row** is locked, not the whole table.

---

## How long does the lock stay?

This is the part that causes most problems, so let me be very clear:

**The lock doesn't go away when Ravi's code is done with the record. It goes away when Ravi's whole action is finished.**

Let's say Ravi's release code looks like this:

```al
BudgetLine.Get('IT');
BudgetLine."Reserved Amount" += 40000;
BudgetLine.Modify();          // lock on IT budget line starts here

CheckOtherThings();           // 1 second
SendEmailToApprover();        // 5 seconds
// action ends                // lock is released only here
```

The `Modify` took a millisecond. But the IT budget line stays locked for about **6 seconds**, because the lock lives until the end of the transaction. That means until the action finishes and Business Central saves (commits) everything, or until an error undoes everything.

So if Priya releases another IT purchase order during those 6 seconds, she waits for 6 seconds. And if a lock is held too long, the waiting user gets the famous error: *"...was locked by another user. Please retry the activity."*

> **A lock lives until the end of the transaction, not until the end of the line of code.**
> Short transactions mean short locks.

---

## Now, LockTable

When I first saw `LockTable()`, I thought it means "lock the entire table right now, nobody can touch it." That's **not** what it does.

```al
BudgetLine.LockTable();
```

According to Microsoft's docs, this line does two things:

1. It starts a transaction (if one hasn't started yet).
2. It makes **every read of this table after this line** (with any record variable of this table) read with an **update lock**.

That's it. On its own, calling `LockTable()` doesn't lock a single budget line yet. It changes how the **next reads** behave. The rows you read after it are the ones that get locked.

It's like telling the system: *"From now on, every budget line I look at, I'm planning to change. Put my 'busy' sign on each one as I read it."*

### Example: LockTable with a good filter

```al
BudgetLine.LockTable();
BudgetLine.Get('IT');     // only the IT line gets locked
```

Only the IT line is locked. Priya can still work on Admin.

### Example: LockTable without a filter

```al
BudgetLine.LockTable();
if BudgetLine.FindSet() then     // reads EVERY budget line
    repeat
        // ...
    until BudgetLine.Next() = 0;
```

Now every budget line that's read gets the "busy" sign: IT, Admin, Travel, all of them, until the transaction ends. **This** is how a "table lock" usually happens in real life. Not because of `LockTable()` alone, but because of `LockTable()` followed by reading everything.

> **LockTable doesn't lock rows by itself. It makes the rows you read next get locked.**
> Filter well, and you lock only what you need.

---

## Can the whole table really get locked?

Yes, there's one more way. If a single statement locks a very large number of rows in one table (Microsoft's SQL Server docs mention around 5,000), SQL Server can replace all those small row locks with **one lock on the whole table**, to save memory. This is called **lock escalation**.

So a big batch that changes thousands of budget lines in one transaction, without committing, can end up blocking the whole table for everyone. That's one reason long batches commit in small steps.

---

## LockTable or ReadIsolation?

In part 1 we saw `ReadIsolation := IsolationLevel::UpdLock`. It does almost the same job as `LockTable()`, but in a more careful way:

| | `LockTable()` | `ReadIsolation := UpdLock` |
|---|---|---|
| Affects | **Every** variable of that table, for the **rest of the transaction** | Only **this one** record variable |
| Also affects other code? | Yes, even someone else's event subscriber reading that table later | No |
| Good for | Older code, or when you really want everything after it to lock | Locking exactly the read you need |

```al
// Old style: everything after this in the transaction locks budget lines
BudgetLine.LockTable();
BudgetLine.Get('IT');

// Newer style: only this read locks
BudgetLine.ReadIsolation := IsolationLevel::UpdLock;
BudgetLine.Get('IT');
```

For new code, I prefer the second one. It says exactly what I mean, and it doesn't surprise anyone else's code.

---

## Quick recap

1. A **lock** is a "busy" sign on a record you're changing (or reading to change).
2. It's on the **row**, not the whole table.
3. It stays until the **end of the transaction**, so keep transactions short.
4. `LockTable()` doesn't lock anything immediately. It makes the **next reads** of that table lock what they read.
5. "Whole table locked" usually comes from reading **without a filter** after `LockTable()`, or from **very large** batches.

**Next in this series:** `Commit()`, what it really means and when it's dangerous.

---

**Sources**

- Microsoft Learn: [Record.LockTable method](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/record/record-locktable-method)
- Microsoft Learn: [Record instance isolation level](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-read-isolation)
- Microsoft Learn: [Tri-state locking in database](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-tri-state-locking)
- Microsoft Learn (SQL Server): [Transaction locking and row versioning guide (lock escalation)](https://learn.microsoft.com/sql/relational-databases/sql-server-transaction-locking-and-row-versioning-guide)
