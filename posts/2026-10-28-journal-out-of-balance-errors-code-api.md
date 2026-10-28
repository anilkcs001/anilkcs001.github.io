---
title: "Document is out of balance: why journals created by code or APIs fail, and how to find the line that's off"
date: 2026-10-28
type: issue
tags: AL, General Journal, Posting, API, Finance, Business Central
summary: Your code or API creates journal lines, and posting stops with "out of balance by 200". Here is how Business Central checks the balance, the seven usual causes, a small AL tool that points to the exact document, and how to build journal lines that always balance.
---

If you create general journal lines from code, from a custom table or through an API, sooner or later you will see this:

> Document No. JV-0001 is out of balance by 200. Please check that Posting Date, Document Type, Document No. and Amount are correct for each line.

The message tells you **something** is wrong, but not **which line**. And when the lines came from an integration, there's nobody who typed them in to ask.

I've spent more time on this error than I'd like to admit. So in this post I want to explain how Business Central actually checks the balance, what usually causes the difference, and how to find the guilty line quickly.

## First, how does Business Central check the balance?

The check happens in codeunit **"Gen. Jnl.-Post Batch"** (13), before anything is posted. It's simpler than it looks.

Business Central walks through the lines in order and keeps a **running total in local currency**. Each line adds its own "balance amount" to that total:

| The line has | It adds to the running total |
|--------------|------------------------------|
| Only an Account No. | its amount |
| Only a Bal. Account No. | minus its amount |
| **Both** Account No. and Bal. Account No. | **zero**, because the line balances itself |

Then, at certain moments, it checks whether the running total is zero. **When** it checks depends on one setting on the journal template: **Force Doc. Balance**.

- **Force Doc. Balance is on:** the lines are sorted by Document No. and Posting Date, and the total is checked every time the **Posting Date, Document Type or Document No.** changes. So every **document** must balance on its own. The error names the document: *"Document No. JV-0001 is out of balance by 200."*
- **Force Doc. Balance is off:** the total is only checked when the **Posting Date** changes. So all lines of one **day** must balance together. The error names the date: *"The lines in 28-10-26 are out of balance by 200."*

That small difference is the key to reading the error. With Force Doc. Balance on, Business Central groups lines by **three fields**. If any of those three is different on one line, that line falls into a different group, and **both** groups end up out of balance.

There is also a separate check per **currency**. If the lines are in a foreign currency, the amounts in that currency must balance too, not only the local amounts.

## The seven usual causes

Here are the causes I've seen most often, roughly from most to least common.

### 1. A one-sided line

The line has an Account No. but no Bal. Account No., and the balancing line was never created. Maybe the API only sent one line, or the code that creates the second line was skipped by an `if`.

**What you see:** the document is out by exactly the amount of one line.

### 2. The lines don't share the same Posting Date, Document Type and Document No.

Both lines exist, but one of the three grouping fields is different:

- One line has posting date 28-10-2026, the other 29-10-2026. This often happens when the source system sends a date-time and the time zone pushes one line to the next day.
- One line has Document Type **Invoice**, the other is **blank**.
- One line has Document No. `JV-0001`, the other `JV-0001 ` or `jv-0001`. Or the Document No. was left blank, and each line got its **own** number from the number series.

**What you see:** two documents (or two days) out of balance by the **same amount with opposite signs**. That's the giveaway.

### 3. A sign mistake

Both lines are positive. For example: expense account `+5,000` and bank account `+5,000`. Debits are positive and credits are negative in Business Central, so one of them must be `-5,000`.

**What you see:** the document is out by **twice** the amount.

### 4. Tax added on one side only

The debit line carries the **gross** amount (base plus tax), and the credit line carries only the **base** amount, or the other way round. This happens a lot when the source system sends "amount" and "tax amount" as separate fields, and the code uses them differently on the two sides.

**What you see:** the difference is exactly the **tax amount**. In India, check whether the difference equals the GST (or TDS or TCS) on that document. In the error at the top of this post, 200 might simply be the GST.

### 5. Amount set without `Validate`

The code does `GenJnlLine.Amount := 5000;` instead of `GenJnlLine.Validate(Amount, 5000);`.

For local currency this often still works, because Business Central recalculates the local amount from `Amount` during the check. But for a **foreign currency**, the local amount (`Amount (LCY)`) is only calculated by `Validate`, using the exchange rate. Skip it, and `Amount (LCY)` can be zero or stale, while the other line is correct.

**What you see:** the document balances in the foreign currency but not in local currency.

### 6. Currency rounding

Two lines of 100.005 USD each, converted to local currency separately, can round to a total that is off by 0.01. Or the source system rounds differently from Business Central.

**What you see:** a tiny difference, like 0.01 or 0.02.

### 7. Old lines already in the batch

Your code inserts a perfect, balanced document. But the batch still had lines from a previous, failed run with the **same** Document No. Now the group contains both, and it's out of balance.

**What you see:** the difference matches an old line, not anything you just sent.

## How to read the difference

The amount in the error is a clue. Before opening any code, ask:

| The difference is... | Most likely |
|----------------------|-------------|
| Exactly one line's amount | One-sided line (cause 1) |
| Twice one line's amount | Sign mistake (cause 3) |
| The same amount on two documents or dates, opposite signs | Grouping fields differ (cause 2) |
| Equal to the tax on the document | Gross vs. base (cause 4) |
| Balanced in foreign currency, not in local | Missing `Validate` (cause 5) |
| 0.01 or 0.02 | Rounding (cause 6) |
| Matches nothing you sent | Old lines in the batch (cause 7) |

## Find the line that's off: a small AL tool

When a batch has hundreds of lines from an integration, checking them by eye is painful. So I wrote a small codeunit that does the same calculation as Business Central and then tells you, in plain words:

- **which documents** are out of balance, and by how much,
- **which lines** belong to each of them, with their line numbers,
- and a **hint** about the most likely cause.

### How the tool thinks

It reads the batch **twice**:

1. **First pass:** it groups the lines by Posting Date, Document Type and Document No., exactly like Business Central does with Force Doc. Balance, and adds up the balance of each group.
2. **Second pass:** for every group that is **not** zero, it lists each line (line number, account, balancing account, amount and what the line "counts as") and checks the line for typical mistakes.

Then it adds hints, using the clues from the table above:

| What the tool sees | The hint it gives |
|--------------------|-------------------|
| The group has only one line | The balancing line is missing, or it sits in another group |
| Another group is out by exactly the opposite amount | These two groups probably belong together: compare their date, type and number |
| The difference is twice one line's amount | Check the sign of that line |
| A line has a currency but no Amount (LCY) | The amount was probably set without `Validate` |
| The difference is 0.05 or less | Probably currency rounding |

### The code

```al
codeunit 50210 "ABC Journal Balance Check"
{
    var
        LineFeed: Text[1];
        NothingWrongMsg: Label 'All documents in this batch are in balance.';
        HeaderTxt: Label '%1 document(s) in this batch are out of balance:', Comment = '%1 = number of documents';
        GroupTxt: Label '%1 is out of balance by %2', Comment = '%1 = document, %2 = difference';
        LineTxt: Label '   Line %1: Account %2 | Bal. Account %3 | Amount %4%5 | counts as %6', Comment = '%1 = line no., %2 = account, %3 = bal. account, %4 = amount, %5 = currency, %6 = balance';
        GroupKeyTxt: Label 'Document No. %3 (Posting Date %1, Document Type %2)', Comment = '%1 = posting date, %2 = document type, %3 = document no.';
        HintOneLineTxt: Label '   Hint: this document has only one line. The balancing line is missing, or it has a different Posting Date, Document Type or Document No.';
        HintPartnerTxt: Label '   Hint: %1 is out by exactly the opposite amount. These lines probably belong together. Compare their Posting Date, Document Type and Document No.', Comment = '%1 = other document';
        HintSignTxt: Label '   Hint: the difference is twice the amount of line %1. Check the sign (+/-) of that line.', Comment = '%1 = line no.';
        HintLCYTxt: Label '   Hint: line %1 has a currency but no Amount (LCY). The amount was probably set without Validate.', Comment = '%1 = line no.';
        HintRoundingTxt: Label '   Hint: the difference is very small. This is probably currency rounding.';
        BlankTxt: Label '(blank)';
        NoneTxt: Label '(none)';

    procedure ShowUnbalancedDocuments(TemplateName: Code[10]; BatchName: Code[10])
    var
        GenJnlLine: Record "Gen. Journal Line";
        Balances: Dictionary of [Text, Decimal];
        LineCounts: Dictionary of [Text, Integer];
        LineDetails: Dictionary of [Text, Text];
        LineHints: Dictionary of [Text, Text];
        ResultText: TextBuilder;
        GroupKey: Text;
        OtherKey: Text;
        Difference: Decimal;
        UnbalancedCount: Integer;
    begin
        LineFeed[1] := 10;

        GenJnlLine.SetRange("Journal Template Name", TemplateName);
        GenJnlLine.SetRange("Journal Batch Name", BatchName);
        GenJnlLine.SetLoadFields("Posting Date", "Document Type", "Document No.", "Account No.", "Bal. Account No.", Amount, "Amount (LCY)", "Currency Code");

        // Pass 1: the running total per document, the same way Business Central does it
        if GenJnlLine.FindSet() then
            repeat
                GroupKey := GetGroupKey(GenJnlLine);
                AddDecimal(Balances, GroupKey, GetLineBalanceLCY(GenJnlLine));
                AddInteger(LineCounts, GroupKey, 1);
            until GenJnlLine.Next() = 0;

        // Pass 2: line details and line hints, only for documents that don't balance
        if GenJnlLine.FindSet() then
            repeat
                GroupKey := GetGroupKey(GenJnlLine);
                Difference := Balances.Get(GroupKey);
                if Difference <> 0 then begin
                    AddText(LineDetails, GroupKey, FormatLine(GenJnlLine));
                    AddText(LineHints, GroupKey, GetLineHint(GenJnlLine, Difference));
                end;
            until GenJnlLine.Next() = 0;

        // Build the message
        foreach GroupKey in Balances.Keys() do begin
            Difference := Balances.Get(GroupKey);
            if Difference <> 0 then begin
                UnbalancedCount += 1;
                ResultText.Append(StrSubstNo(GroupTxt, GroupKey, Difference) + LineFeed);
                ResultText.Append(LineDetails.Get(GroupKey));

                if LineCounts.Get(GroupKey) = 1 then
                    ResultText.Append(HintOneLineTxt + LineFeed);

                foreach OtherKey in Balances.Keys() do
                    if (OtherKey <> GroupKey) and (Balances.Get(OtherKey) = -Difference) then
                        ResultText.Append(StrSubstNo(HintPartnerTxt, OtherKey) + LineFeed);

                if Abs(Difference) <= 0.05 then
                    ResultText.Append(HintRoundingTxt + LineFeed);

                if LineHints.ContainsKey(GroupKey) then
                    ResultText.Append(LineHints.Get(GroupKey));

                ResultText.Append(LineFeed);
            end;
        end;

        if UnbalancedCount = 0 then
            Message(NothingWrongMsg)
        else
            Message('%1', StrSubstNo(HeaderTxt, UnbalancedCount) + LineFeed + LineFeed + ResultText.ToText());
    end;

    // Same rule as Business Central: a line with both accounts balances itself
    procedure GetLineBalanceLCY(GenJnlLine: Record "Gen. Journal Line"): Decimal
    var
        AmountLCY: Decimal;
    begin
        AmountLCY := GenJnlLine."Amount (LCY)";
        if GenJnlLine."Currency Code" = '' then
            AmountLCY := GenJnlLine.Amount;

        if (GenJnlLine."Account No." <> '') and (GenJnlLine."Bal. Account No." <> '') then
            exit(0);
        if GenJnlLine."Bal. Account No." <> '' then
            exit(-AmountLCY);
        exit(AmountLCY);
    end;

    local procedure GetGroupKey(GenJnlLine: Record "Gen. Journal Line"): Text
    var
        DocumentTypeText: Text;
        DocumentNoText: Text;
    begin
        DocumentTypeText := Format(GenJnlLine."Document Type");
        if GenJnlLine."Document Type" = GenJnlLine."Document Type"::" " then
            DocumentTypeText := BlankTxt;

        DocumentNoText := GenJnlLine."Document No.";
        if DocumentNoText = '' then
            DocumentNoText := BlankTxt;

        exit(StrSubstNo(GroupKeyTxt, GenJnlLine."Posting Date", DocumentTypeText, DocumentNoText));
    end;

    local procedure FormatLine(GenJnlLine: Record "Gen. Journal Line"): Text
    var
        AccountText: Text;
        BalAccountText: Text;
        CurrencyText: Text;
    begin
        AccountText := GenJnlLine."Account No.";
        if AccountText = '' then
            AccountText := NoneTxt;

        BalAccountText := GenJnlLine."Bal. Account No.";
        if BalAccountText = '' then
            BalAccountText := NoneTxt;

        if GenJnlLine."Currency Code" <> '' then
            CurrencyText := ' ' + GenJnlLine."Currency Code";

        exit(StrSubstNo(LineTxt, GenJnlLine."Line No.", AccountText, BalAccountText, GenJnlLine.Amount, CurrencyText, GetLineBalanceLCY(GenJnlLine)) + LineFeed);
    end;

    local procedure GetLineHint(GenJnlLine: Record "Gen. Journal Line"; Difference: Decimal): Text
    var
        LineBalance: Decimal;
    begin
        if (GenJnlLine."Currency Code" <> '') and (GenJnlLine.Amount <> 0) and (GenJnlLine."Amount (LCY)" = 0) then
            exit(StrSubstNo(HintLCYTxt, GenJnlLine."Line No.") + LineFeed);

        LineBalance := GetLineBalanceLCY(GenJnlLine);
        if (LineBalance <> 0) and (Difference = 2 * LineBalance) then
            exit(StrSubstNo(HintSignTxt, GenJnlLine."Line No.") + LineFeed);

        exit('');
    end;

    local procedure AddDecimal(var Values: Dictionary of [Text, Decimal]; KeyText: Text; Value: Decimal)
    begin
        if Values.ContainsKey(KeyText) then
            Values.Set(KeyText, Values.Get(KeyText) + Value)
        else
            Values.Add(KeyText, Value);
    end;

    local procedure AddInteger(var Values: Dictionary of [Text, Integer]; KeyText: Text; Value: Integer)
    begin
        if Values.ContainsKey(KeyText) then
            Values.Set(KeyText, Values.Get(KeyText) + Value)
        else
            Values.Add(KeyText, Value);
    end;

    local procedure AddText(var Values: Dictionary of [Text, Text]; KeyText: Text; Value: Text)
    begin
        if Value = '' then
            exit;
        if Values.ContainsKey(KeyText) then
            Values.Set(KeyText, Values.Get(KeyText) + Value)
        else
            Values.Add(KeyText, Value);
    end;
}
```

### Add a button to the General Journal

So finance users can run it themselves, add an action to the General Journal page that checks the batch they are looking at:

```al
pageextension 50210 "ABC General Journal" extends "General Journal"
{
    actions
    {
        addlast(Processing)
        {
            action(ABCCheckBalance)
            {
                ApplicationArea = All;
                Caption = 'Find Unbalanced Lines';
                Image = CheckJournal;
                ToolTip = 'Shows which documents in this batch are out of balance, the lines that belong to them, and the most likely cause.';

                trigger OnAction()
                var
                    JournalBalanceCheck: Codeunit "ABC Journal Balance Check";
                begin
                    JournalBalanceCheck.ShowUnbalancedDocuments(Rec."Journal Template Name", Rec."Journal Batch Name");
                end;
            }
        }
    }
}
```

### What the message looks like

Say an integration created this batch:

| Line | Posting Date | Doc. Type | Document No. | Account | Bal. Account | Amount |
|------|--------------|-----------|--------------|---------|--------------|--------|
| 10000 | 28-10-26 | Invoice | JV-0001 | 5100 | | 1,180 |
| 20000 | 28-10-26 | Invoice | JV-0001 | 2100 | | -1,000 |
| 30000 | 28-10-26 | | JV-0002 | 6200 | | 1,500 |
| 40000 | 28-10-26 | | JV-0002 | 2910 | | 1,500 |
| 50000 | 28-10-26 | Payment | JV-0003 | 7400 | | 750 |
| 60000 | 29-10-26 | Payment | JV-0003 | 2910 | | -750 |

Click **Find Unbalanced Lines**, and you get:

```text
4 document(s) in this batch are out of balance:

Document No. JV-0001 (Posting Date 28-10-26, Document Type Invoice) is out of balance by 180
   Line 10000: Account 5100 | Bal. Account (none) | Amount 1,180 | counts as 1,180
   Line 20000: Account 2100 | Bal. Account (none) | Amount -1,000 | counts as -1,000

Document No. JV-0002 (Posting Date 28-10-26, Document Type (blank)) is out of balance by 3,000
   Line 30000: Account 6200 | Bal. Account (none) | Amount 1,500 | counts as 1,500
   Line 40000: Account 2910 | Bal. Account (none) | Amount 1,500 | counts as 1,500
   Hint: the difference is twice the amount of line 30000. Check the sign (+/-) of that line.
   Hint: the difference is twice the amount of line 40000. Check the sign (+/-) of that line.

Document No. JV-0003 (Posting Date 28-10-26, Document Type Payment) is out of balance by 750
   Line 50000: Account 7400 | Bal. Account (none) | Amount 750 | counts as 750
   Hint: this document has only one line. The balancing line is missing, or it has a different Posting Date, Document Type or Document No.
   Hint: Document No. JV-0003 (Posting Date 29-10-26, Document Type Payment) is out by exactly the opposite amount. These lines probably belong together. Compare their Posting Date, Document Type and Document No.

Document No. JV-0003 (Posting Date 29-10-26, Document Type Payment) is out of balance by -750
   Line 60000: Account 2910 | Bal. Account (none) | Amount -750 | counts as -750
   Hint: this document has only one line. The balancing line is missing, or it has a different Posting Date, Document Type or Document No.
   Hint: Document No. JV-0003 (Posting Date 28-10-26, Document Type Payment) is out by exactly the opposite amount. These lines probably belong together. Compare their Posting Date, Document Type and Document No.
```

Let's read it together:

- **JV-0001 (lines 10000 and 20000):** out by 180. That's exactly 18% GST on 1,000. Line 10000 carries the amount **with** tax, line 20000 only the base. Tax on one side only (cause 4). There's no automatic hint here, but the difference itself tells the story.
- **JV-0002 (lines 30000 and 40000):** both lines are +1,500, so the document is out by 3,000, which is twice one line. The tool flags both lines, because either one could be the wrong one. In this case, the credit to account 2910 should be -1,500. A sign mistake (cause 3).
- **JV-0003 (lines 50000 and 60000):** each line is alone in its own group, on two different dates, out by +750 and -750. The partner hint connects them. Line 60000 has the wrong posting date (cause 2), probably a date-time that crossed midnight.

Without the tool, you'd only get "JV-0001 is out of balance by 180" when posting, and you'd have to find the next problem after fixing the first one. With it, you see every problem in the batch at once, down to the line number.

## Prevent it: build lines that always balance

Finding the problem is good. Never creating it is better. These are the rules I follow now when I create journal lines from code.

**1. Prefer one line with both accounts.** If the entry is a simple debit and credit, use **one** line with Account No. **and** Bal. Account No. It can never be out of balance, because it balances itself.

**2. Always set the three grouping fields explicitly.** Never leave Document No. blank and hope for the best. Use the same Posting Date (a `Date`, not a date-time), Document Type and Document No. for every line of one document.

**3. Validate in the right order.** Account first, then the balancing account, then the currency, then the amount last. Each `Validate` can change fields that the next one depends on, like posting groups, tax setup and the currency factor.

```al
GenJnlLine.Validate("Posting Date", PostingDate);
GenJnlLine."Document Type" := GenJnlLine."Document Type"::" ";
GenJnlLine."Document No." := DocumentNo;
GenJnlLine.Validate("Account Type", GenJnlLine."Account Type"::"G/L Account");
GenJnlLine.Validate("Account No.", ExpenseAccountNo);
GenJnlLine.Validate("Bal. Account Type", GenJnlLine."Bal. Account Type"::"Bank Account");
GenJnlLine.Validate("Bal. Account No.", BankAccountNo);
GenJnlLine.Validate("Currency Code", CurrencyCode);
GenJnlLine.Validate(Amount, LineAmount);   // always Validate, never :=
```

**4. Decide once whether amounts include tax.** If the source sends a base amount and a tax amount, decide in **one** place which one goes on each side, and use the same rule for every line.

**5. Check the total before you insert.** If you create several lines for one document, add up the amounts first. If the total isn't zero, stop and return a clear error to the API caller, with the document number and the difference. That's much better than letting the posting fail later.

**6. Clean up before a rerun.** Before inserting lines for a document, delete any old, unposted lines in the batch with the same Document No. Or better, use a separate batch per integration run.

**7. Don't "fix" it by turning off Force Doc. Balance.** It's tempting, because the error moves from per document to per day, and sometimes disappears. But the lines are still wrong. You've just hidden the problem, and now one bad document can mix with a good one.

## To sum it up

- Business Central keeps a **running local-currency total** and checks it whenever the **Posting Date, Document Type or Document No.** changes (with Force Doc. Balance on).
- A line with **both** an account and a balancing account always balances itself.
- The **difference amount** is your best clue: one line, double, the tax, or 0.01.
- A small procedure that groups lines the same way as Business Central points you to the exact document in seconds.
- Prevent it: set the grouping fields explicitly, `Validate` in the right order, and check the total before you insert.

Have you hit a strange out-of-balance error that didn't match any of these? Tell me in the comments. I'd like to add it to this list.

## Notes

The balance logic described here comes from the base application source of codeunit "Gen. Jnl.-Post Batch" and the `UpdateLineBalance` procedure of the Gen. Journal Line table (version 25). Your localization or other extensions can add their own checks through events, so if the numbers don't add up, look for subscribers as well.
