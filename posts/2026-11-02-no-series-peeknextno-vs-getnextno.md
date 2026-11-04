---
title: No. Series in AL, simply explained: GetNextNo, PeekNextNo, and how to number a new document
date: 2026-11-02
type: feature
tags: AL, No. Series, Business Central, Basics
summary: GetNextNo takes a number. PeekNextNo only looks at it. That one difference decides whether your documents get clean numbers or duplicates. Here's how No. Series works, how to give a number to a new record the way Business Central does, when PeekNextNo is the right choice, and when to use the batch version.
---

Every document in Business Central has a number: PO-1001, SI-2045, JV-0001. These numbers come from **No. Series**.

In AL code, you'll mostly use two functions:

- **GetNextNo**
- **PeekNextNo**

They look almost the same, and they return the same number. But they behave very differently, and using the wrong one is one of the most common reasons for **duplicate** or **missing** document numbers.

I learned this by making the mistake myself, and then reading how Business Central's own code uses them. Here it is in simple words.

---

## First: what is a No. Series?

A No. Series is a **counter** with some rules.

You set it up on the **No. Series** page. Each series has one or more **lines**, and a line says:

- **Starting No.:** for example `EXP-0001`
- **Ending No.:** for example `EXP-9999`
- **Last No. Used:** the counter. BC updates this every time a number is taken
- **Starting Date:** from when this line is used (useful if you want a new range every year)
- **Increment-by No.:** usually 1

And on the series itself:

- **Default Nos.:** BC fills the number automatically
- **Manual Nos.:** users are allowed to type their own number
- **Date Order:** numbers must follow the posting date order

Then a setup page (like **Purchases & Payables Setup**) says which series is used for which document. For example, **Order Nos.** = `P-ORD`.

---

## GetNextNo vs PeekNextNo, in one picture

Think of the token machine at a bank.

- **GetNextNo** = you **take** a token from the machine. The machine moves to the next number. Your token is yours. Nobody else gets the same number.
- **PeekNextNo** = you **look** at the display: "Next token: 47". You didn't take it. The machine didn't move. The next person who **takes** a token gets 47.

In Business Central:

| | GetNextNo | PeekNextNo |
|---|---|---|
| Returns the next number | Yes | Yes |
| Updates **Last No. Used** | **Yes** | **No** |
| Can two users get the same number? | No | **Yes**, if both only peek |
| Locks the No. Series line | Yes, until the transaction ends | No |

The comments in Microsoft's own code say it clearly. GetNextNo: *"Get the next number in the No. Series."* PeekNextNo: *"Get the next number in the No. Series, **without incrementing the number**."*

> **GetNextNo takes the number. PeekNextNo only looks at it.**

---

## The mistake I made with PeekNextNo

I once wanted the user to **see** the document number as soon as they opened a new card, before saving. So I used `PeekNextNo` to fill the number on the page, and called `GetNextNo` later when the record was saved.

In testing with one user, it worked perfectly.

With two users, it didn't:

1. User A opens a new document. Peek shows `EXP-0047`.
2. User B opens a new document at the same time. Peek also shows `EXP-0047`, because nobody has **taken** it yet.
3. Both save. Now there's a conflict: either one of them gets an error, or the code takes a different number than the one shown on screen.

In a variation of this, I also saw numbers being **skipped**, because the code peeked one number but then took another.

The lesson: **a peeked number is not reserved.** It's just a preview. Anyone can take it before you.

---

## How Business Central itself numbers a new record

The safest way is to do exactly what the base app does. Here's the pattern from the standard **Resource** table in BC 25 (I removed the event and obsolete code to keep it short):

```al
trigger OnInsert()
begin
    if "No." = '' then begin
        ResSetup.Get();
        ResSetup.TestField("Resource Nos.");
        "No. Series" := ResSetup."Resource Nos.";
        if NoSeries.AreRelated("No. Series", xRec."No. Series") then
            "No. Series" := xRec."No. Series";
        "No." := NoSeries.GetNextNo("No. Series");
    end;
end;
```

In simple words:

1. **Only if the number is empty.** If the user typed a number manually, don't touch it.
2. **Read the series from setup**, and make sure it's filled.
3. **Remember which series was used** in the record's own **No. Series** field.
4. **If the user picked a related series** (more on that below), keep it.
5. **Take** the number with `GetNextNo`.

It uses `GetNextNo`, and it does it in **OnInsert**, at the moment the record is saved. That way, the number is taken and the record is inserted in the same transaction. If the insert fails, the number isn't lost, because the whole transaction is rolled back.

---

## Full example for your own table

Let's say we have an **Expense Request** table. The series is set up on our own setup table, in a field called **Expense Request Nos.**

```al
table 50320 "ABC Expense Request"
{
    Caption = 'Expense Request';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "No."; Code[20])
        {
            Caption = 'No.';

            trigger OnValidate()
            var
                ABCSetup: Record "ABC Setup";
                NoSeries: Codeunit "No. Series";
            begin
                if "No." <> xRec."No." then begin
                    ABCSetup.Get();
                    NoSeries.TestManual(ABCSetup."Expense Request Nos.");
                    "No. Series" := '';
                end;
            end;
        }
        field(2; Description; Text[100])
        {
            Caption = 'Description';
        }
        field(3; "No. Series"; Code[20])
        {
            Caption = 'No. Series';
            Editable = false;
            TableRelation = "No. Series";
        }
    }

    keys
    {
        key(PK; "No.") { Clustered = true; }
    }

    trigger OnInsert()
    var
        ABCSetup: Record "ABC Setup";
        NoSeries: Codeunit "No. Series";
    begin
        if "No." = '' then begin
            ABCSetup.Get();
            ABCSetup.TestField("Expense Request Nos.");
            "No. Series" := ABCSetup."Expense Request Nos.";
            if NoSeries.AreRelated(ABCSetup."Expense Request Nos.", xRec."No. Series") then
                "No. Series" := xRec."No. Series";
            "No." := NoSeries.GetNextNo("No. Series");
        end;
    end;

    procedure AssistEdit(OldExpenseRequest: Record "ABC Expense Request"): Boolean
    var
        ABCSetup: Record "ABC Setup";
        NoSeries: Codeunit "No. Series";
    begin
        ABCSetup.Get();
        ABCSetup.TestField("Expense Request Nos.");
        if NoSeries.LookupRelatedNoSeries(ABCSetup."Expense Request Nos.", OldExpenseRequest."No. Series", "No. Series") then begin
            "No." := NoSeries.GetNextNo("No. Series");
            exit(true);
        end;
    end;
}
```

What each part does:

| Part | What it does |
|---|---|
| **OnInsert** | Takes the next number when the record is saved, if no number was typed |
| **No. → OnValidate** | If the user types a number, `TestManual` checks that **Manual Nos.** is allowed. If not, it gives an error |
| **AssistEdit** | The "..." button on the No. field. It lets the user pick a **related** series, then takes a number from it |
| **No. Series** field | Remembers which series this record's number came from |

And on the card page, connect the "..." button:

```al
field("No."; Rec."No.")
{
    ApplicationArea = All;

    trigger OnAssistEdit()
    begin
        if Rec.AssistEdit(xRec) then
            CurrPage.Update();
    end;
}
```

**What are "related" series?** On the **No. Series** page, a series can have **Relationships**. For example, the main series `EXP` could be related to `EXP-HO` (head office) and `EXP-BR` (branches). `AreRelated` checks whether two series are in the same family, and `LookupRelatedNoSeries` shows the list so the user can choose.

---

## So when is PeekNextNo the right choice?

PeekNextNo is useful when you want to **show** or **compare** a number, **without using it yet**.

The best example is in Business Central itself: **journals**.

When you add a new line in a **General Journal**, the **Document No.** is already filled in. But if you close the journal without posting, that number isn't used up. That's because the journal line uses **PeekNextNo**. I found this in the standard Gen. Journal Line table:

```al
"Document No." := NoSeries.PeekNextNo(GenJnlBatch."No. Series", "Posting Date");
```

Then, when you **post**, the posting codeunit (**Gen. Jnl.-Post Batch**) checks: *"Is this line's document number still the next number?"* If yes, it **takes** it with GetNextNo. If the user changed it, it checks that manual numbers are allowed:

```al
if GenJnlLine."Document No." = NoSeriesBatch.PeekNextNo(GenJnlBatch."No. Series", GenJnlLine."Posting Date") then
    NoSeriesBatch.GetNextNo(GenJnlBatch."No. Series", GenJnlLine."Posting Date")
else
    NoSeriesBatch.TestManual(GenJnlBatch."No. Series", GenJnlLine."Document No.");
```

That's the right way to use peek: **show the number early, take it only at the final moment, and check again at that moment.**

Good uses of PeekNextNo:

- Showing the user **"the next number will be ..."** in a dialog or preview
- **Journals and worksheets**, where lines are often deleted before posting
- **Checking** whether a typed number is the next number in the series

Don't use PeekNextNo as the **final** number of a record that's saved later, like a document card. Two users can peek the same number.

---

## Creating many records in a loop: "No. Series - Batch"

If you create **hundreds** of records in one go (for example, importing 500 expense requests from Excel), calling `GetNextNo` 500 times means 500 updates to the same No. Series line.

For this, Business Central has a second codeunit: **No. Series - Batch**. It keeps the counter **in memory**, and writes to the database only when you call **SaveState**:

```al
procedure ImportRequests(var TempBuffer: Record "ABC Expense Request" temporary)
var
    ABCSetup: Record "ABC Setup";
    ExpenseRequest: Record "ABC Expense Request";
    NoSeriesBatch: Codeunit "No. Series - Batch";
begin
    ABCSetup.Get();
    ABCSetup.TestField("Expense Request Nos.");

    if TempBuffer.FindSet() then
        repeat
            ExpenseRequest.Init();
            ExpenseRequest.TransferFields(TempBuffer);
            ExpenseRequest."No. Series" := ABCSetup."Expense Request Nos.";
            ExpenseRequest."No." := NoSeriesBatch.GetNextNo(ExpenseRequest."No. Series", WorkDate());
            ExpenseRequest.Insert(true);   // OnInsert sees a number and doesn't take another one
        until TempBuffer.Next() = 0;

    NoSeriesBatch.SaveState();   // write the new "Last No. Used" to the database once
end;
```

**Don't forget `SaveState()`.** If you skip it, the records are inserted, but **Last No. Used** isn't updated. The next user then gets numbers that already exist.

This is also how the standard journal posting works. You saw `NoSeriesBatch` in the code above, and **Gen. Jnl.-Post Batch** calls `NoSeriesBatch.SaveState()` once at the end.

The batch codeunit also has **SimulateGetNextNo**, which works out a number **as if** a certain number was the last one used, without touching the database. The journal uses it to suggest the next document number on a new line.

---

## Two more things worth knowing

**1. GetNextNo locks the No. Series line.**
Microsoft's docs explain that when a number is taken from a normal series, the **No. Series Line** row is locked until the transaction ends. So if your code takes a number and then does something slow, other users who need a number from the same series **wait**. Take the number as late as possible, and keep that transaction short.

If a series doesn't need continuous numbers (customers, quotes, warehouse documents...), you can tick **Allow Gaps in Nos.** on the series line. Then BC uses a database number sequence instead, which doesn't block other users. The price is that numbers can be skipped, for example when a transaction is rolled back. **Don't** do this for invoices or other documents that legally need continuous numbers. Check with finance first.

**2. NoSeriesManagement is old.**
In older code you'll see **NoSeriesManagement** with `InitSeries`, and `GetNextNo(Code, Date, true/false)` where the last parameter decides whether to take or only peek. That codeunit is marked **obsolete from version 24**. Microsoft says to use **No. Series** and **No. Series - Batch** instead. Simple mapping:

| Old (NoSeriesManagement) | New |
|---|---|
| `InitSeries(...)` | `AreRelated` + `GetNextNo`, as in the OnInsert pattern above |
| `GetNextNo(Code, Date, true)` | `NoSeries.GetNextNo(Code, Date)` |
| `GetNextNo(Code, Date, false)` | `NoSeries.PeekNextNo(Code, Date)` |
| `SelectSeries(...)` | `NoSeries.LookupRelatedNoSeries(...)` |
| `TestManual(...)` | `NoSeries.TestManual(...)` |

---

## Summary

- **GetNextNo** takes the number and moves the counter. Use it when the record is **actually saved**, usually in **OnInsert**.
- **PeekNextNo** only looks at the next number. Use it to **show** or **compare**, never as the final number of a record saved later.
- **Follow the base app pattern:** only when "No." is empty, store the **No. Series** used, support **related** series, and use **TestManual** when users type a number.
- **Many records in a loop?** Use **No. Series - Batch**, and always call **SaveState()** at the end.
- **Taking a number locks the series line.** Take it late, and keep the transaction short.

If you've seen duplicate document numbers in a project, there's a good chance a `PeekNextNo` was used where a `GetNextNo` should have been. Tell me in the comments if that's happened to you.

---

**Sources**

- Business Central source (BC 25): codeunit 310 **No. Series** and **No. Series - Batch** (Business Foundation), the **Resource** table, the **Gen. Journal Line** table and **Gen. Jnl.-Post Batch**
- Microsoft Learn: [Create number series](https://learn.microsoft.com/dynamics365/business-central/ui-create-number-series)
- Microsoft Learn: [Number sequences in Business Central (locking and Allow Gaps in Nos.)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-number-sequences)
