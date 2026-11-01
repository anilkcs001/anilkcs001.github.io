---
title: ReadIsolation in AL, explained with one simple example
date: 2026-10-29
type: feature
tags: AL, ReadIsolation, Locking, Performance, Business Central
summary: Forget the definitions. Let's take one budget line, two users and one moment in time, and replay it once for each ReadIsolation level. By the end you'll know exactly what each level does and when to use it. Part 1 of a short series on locking.
---

*Part 1 of a short series on locking in Business Central.*

When I first read about `ReadIsolation`, I read the definitions three times and still didn't get it. "Dirty reads", "shared locks", "update intent"... the words were clear, but I couldn't **see** it.

So in this post I won't start with definitions. I'll take **one situation** and **replay it** for each level. You'll see what changes each time.

---

## The situation

Your company has a budget for IT expenses. In Business Central, it's one record:

> **IT budget:** Budget = 1,00,000 | Reserved = **0**

Two people are working:

- **Ravi** releases a purchase order for 40,000.
- **Priya** opens a page that shows how much IT budget is left.

Now here's the important moment. Ravi clicks **Release**. His code does this:

1. Changes the IT budget: Reserved = **40,000**
2. Then does some other work for a few seconds (checks, other tables...)
3. Then finishes

During step 2, Ravi's change is **not saved yet**. Business Central only saves (commits) when Ravi's action is completely finished. Until then, two endings are possible:

- **Ending A:** Ravi finishes. 40,000 is saved for real.
- **Ending B:** Ravi gets an error at the end. Everything is undone, and Reserved goes back to **0**.

So during step 2, the database has an "unsaved 40,000" in it that may or may not survive.

**Right at this moment, Priya's code reads the IT budget line.**

Two questions:

1. **What number does Priya get?** 0 or 40,000?
2. **Does Priya have to wait?**

That's all `ReadIsolation` decides. Let's replay the moment.

---

## Replay 1: `ReadUncommitted` ("just show me whatever is there")

```al
BudgetLine.ReadIsolation := IsolationLevel::ReadUncommitted;
BudgetLine.Get('IT');
```

- Priya gets **40,000**, Ravi's unsaved number.
- She **doesn't wait** at all.

Fast. But think about Ending B. If Ravi's action fails, the 40,000 is undone. Priya was shown a number that **never really existed**.

Is that a problem? For Priya's page, no. It just **shows** "budget left: 60,000". If it's wrong for two seconds, nobody is hurt, and the next refresh is correct.

But imagine Priya's code wasn't just showing. Imagine it was **deciding** something, like "is there enough budget for my PO?", using a number that might disappear. That's dangerous.

> **ReadUncommitted = fast, never waits, but might see unsaved numbers.**
> Use it only for numbers you **display**.

---

## Replay 2: `ReadCommitted` ("show me only saved numbers")

```al
BudgetLine.ReadIsolation := IsolationLevel::ReadCommitted;
BudgetLine.Get('IT');
```

- Priya is **never shown** Ravi's unsaved 40,000.
- In practice, she waits a moment until Ravi is finished, and then she gets the real saved value: 40,000 in Ending A, or 0 in Ending B.

So whatever Priya gets is a **real** number. That's the difference from Replay 1.

But there's one thing ReadCommitted does **not** promise. After Priya has read it, someone else (say, Kiran) can change the budget again while Priya's code is still running. Priya's number was true **when she read it**, not necessarily a second later.

> **ReadCommitted = only real, saved numbers, but they can change right after you read them.**

---

## Replay 3: `RepeatableRead` ("don't change what I've read until I'm done")

For this one, let's flip the timing. **Priya reads first**, and her code then works for a few seconds, maybe printing a budget report that reads the IT line again at the end.

```al
BudgetLine.ReadIsolation := IsolationLevel::RepeatableRead;
BudgetLine.Get('IT');
// ... a few seconds of other work ...
```

While Priya's code is still running, Ravi clicks Release and tries to change the IT line.

- **Ravi has to wait** until Priya's code is finished.
- If Priya reads the IT line again, she's guaranteed to see the **same** value as the first time.

So RepeatableRead protects Priya: what she read stays the same until she's done. The price is that Ravi, who wants to change it, is blocked.

> **RepeatableRead = what I read can't be changed by others until I finish. Others who want to change it wait.**

---

## Replay 4: `UpdLock` ("I'm reading this because I'm going to change it")

Now the most useful one. This time **both** Ravi and Priya are releasing POs against the IT budget: Ravi for 40,000, Priya for 30,000. Both run the same code:

1. Read the IT line
2. Check that enough budget is left
3. Add their amount to Reserved and save

**First, without UpdLock**, look what can happen:

| | Ravi | Priya |
|---|---|---|
| 1 | Reads: Reserved = 0 | |
| 2 | | Reads: Reserved = 0 |
| 3 | Check OK, sets Reserved = 40,000, saves | |
| 4 | | Check OK (she still thinks it's 0), tries to save 30,000 |

At step 4, Business Central notices Priya is trying to save on top of a version that's no longer current, and she gets an error that **another user has modified the record**. She has to click again. Worse, her budget check in step 4 was done on an **old** number.

**Now with UpdLock:**

```al
BudgetLine.ReadIsolation := IsolationLevel::UpdLock;
BudgetLine.Get('IT');
if BudgetLine."Budget Amount" - BudgetLine."Reserved Amount" < LineAmount then
    Error(NotEnoughBudgetErr);
BudgetLine."Reserved Amount" += LineAmount;
BudgetLine.Modify();
```

| | Ravi | Priya |
|---|---|---|
| 1 | Reads **with UpdLock**: Reserved = 0 | |
| 2 | | Wants to read with UpdLock: **waits** |
| 3 | Check OK, sets 40,000, saves, finishes | |
| 4 | | Now reads: Reserved = **40,000** |
| 5 | | Check: 60,000 left, OK. Sets 70,000, saves |

Priya waited for a moment, but she got the **correct** number, her check was right, and there's no error.

And Priya's page from Replay 1, which only displays the number with `ReadUncommitted`? It isn't blocked by any of this. Only readers who **also** want to change the record wait for each other.

> **UpdLock = "I'm going to change this." Anyone else who also wants to change it waits for me.**
> Use it whenever you **read a record so that you can modify it**.

---

## And `Default`? (when you don't write anything)

This is what most of our code does. We just write `BudgetLine.Get('IT')` with no `ReadIsolation`.

Then Business Central decides for you, based on **what your transaction has already done**:

- If your code **hasn't changed** anything in that table yet, the read behaves like **Replay 1** (`ReadUncommitted`).
- Once your code **has changed** something in that table, later reads behave like **Replay 2** (`ReadCommitted`). This is in version 23 and later. Older versions behaved like Replay 4.
- If someone called `LockTable()` on that table, later reads behave like **Replay 4** (`UpdLock`).

So the same `Get` can act differently depending on what happened **earlier** in the transaction, maybe in someone else's event subscriber. Setting `ReadIsolation` yourself means you don't have to guess.

---

## The whole post in one table

Same moment every time: Ravi has an **unsaved** change, and Priya reads.

| Level | Priya sees Ravi's unsaved number? | Priya waits? | Blocks people who want to change it? | Use for |
|---|---|---|---|---|
| `ReadUncommitted` | Yes | No | No | Numbers you only **show** |
| `ReadCommitted` | No | Usually a moment | No | Normal reads that must be real |
| `RepeatableRead` | No | Usually a moment | **Yes**, until she's done | When what you read must not change while you work |
| `UpdLock` | No | Waits for others who also want to change it | **Yes**, until she's done | Read, then **modify** |

## Three things to remember

1. `ReadIsolation` is set on **one record variable**. Other variables of the same table aren't affected.
2. It affects **reads only**. When you `Modify` or `Insert`, the normal write lock is still taken.
3. Stricter isn't "better". The stricter the level, the more others wait. Pick the **lowest** level that's still correct.

**Next in this series:** what a lock really is, and what `LockTable` actually locks.

If any replay above still doesn't click, tell me in the comments which one, and I'll explain it another way.

---

**Sources**

- Microsoft Learn: [Record instance isolation level](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-read-isolation)
- Microsoft Learn: [Record.ReadIsolation method](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/record/record-readisolation-method)
- Microsoft Learn: [IsolationLevel option type](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/isolationlevel/isolationlevel-option)
- Microsoft Learn: [Tri-state locking in database](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-tri-state-locking)
- Microsoft Learn: [Record.LockTable method](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/methods-auto/record/record-locktable-method)
