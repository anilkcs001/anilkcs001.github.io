---
title: Show purchase totals and GST without slowing down the page: Page Background Tasks in AL
date: 2026-10-27
type: solution
tags: AL, Performance, Page Background Task, Purchase, Business Central
summary: Users wanted to see line totals and GST on the Purchase Order itself, but calculating them made the page slow. Page Background Tasks let the page open at once and fill the totals a moment later. Here is how it works, step by step.
---

Here's a request I think many of us have heard: "Can we see the totals and the GST right on the Purchase Order? I don't want to open Statistics every time."

Sounds easy. Add a few fields, calculate in `OnAfterGetCurrRecord`, done.

And it works. Until a purchase order has 200 lines. Then every time the user opens the order, or just moves to the next one, the page freezes for a second or two while the totals are calculated. Users notice that very quickly.

So the question becomes: how do we show the totals **without making the user wait**?

The answer is a feature that has been in Business Central since 2019 release wave 2, but that I don't see used very often: **Page Background Tasks**.

## The idea in simple words

Think of a restaurant again.

You order food. The waiter doesn't stand at your table until the kitchen is done. He takes the order to the kitchen, and you continue talking with your friends. When the food is ready, he brings it.

A page background task works the same way:

1. The page opens **immediately**, with all the normal fields.
2. It hands the heavy calculation to a **child session** running in the background.
3. The user keeps working. They can read the order, scroll, look at the lines.
4. When the calculation is finished, the page receives the results and shows them.

The user sees the totals a moment later, but the page never freezes.

## What we will build

On the Purchase Order, a small **Live Totals** group:

- Number of lines
- Total quantity
- Total amount (before GST)
- Total GST
- Total including GST
- A status line: "Calculating..." while it runs, "Updated" when it's done

## The four pieces

A page background task always has the same four parts:

1. **The page enqueues the task.** It calls `CurrPage.EnqueueBackgroundTask` and passes some parameters, like the document number.
2. **A codeunit does the work.** It runs in the background, reads the parameters, calculates, and sends back the results.
3. **The page receives the results** in the `OnPageBackgroundTaskCompleted` trigger.
4. **The page handles errors** in the `OnPageBackgroundTaskError` trigger.

One thing to know before we start: parameters and results are always a `Dictionary of [Text, Text]`. Only text goes in and only text comes out. So we convert numbers to text and back again.

## Step 1: the background codeunit

This codeunit runs in the child session. It only **reads**. It reads the purchase lines of one order and adds them up.

```al
codeunit 50190 "ABC PO Totals Task"
{
    trigger OnRun()
    var
        PurchaseLine: Record "Purchase Line";
        Parameters: Dictionary of [Text, Text];
        Results: Dictionary of [Text, Text];
        DocumentNo: Code[20];
        LineCount: Integer;
        TotalQty: Decimal;
        TotalAmount: Decimal;
        TotalGST: Decimal;
    begin
        // 1. Read what the page sent us
        Parameters := Page.GetBackgroundParameters();
        DocumentNo := CopyStr(Parameters.Get('DocumentNo'), 1, MaxStrLen(DocumentNo));

        // 2. Read only the fields we need
        PurchaseLine.SetRange("Document Type", PurchaseLine."Document Type"::Order);
        PurchaseLine.SetRange("Document No.", DocumentNo);
        PurchaseLine.SetFilter(Type, '<>%1', PurchaseLine.Type::" ");
        PurchaseLine.SetLoadFields(Quantity, "Line Amount");
        if PurchaseLine.FindSet() then
            repeat
                LineCount += 1;
                TotalQty += PurchaseLine.Quantity;
                TotalAmount += PurchaseLine."Line Amount";
                TotalGST += GetLineGSTAmount(PurchaseLine);
            until PurchaseLine.Next() = 0;

        // 3. Send the results back as text (format 9 = safe, culture-independent)
        Results.Add('LineCount', Format(LineCount, 0, 9));
        Results.Add('TotalQty', Format(TotalQty, 0, 9));
        Results.Add('TotalAmount', Format(TotalAmount, 0, 9));
        Results.Add('TotalGST', Format(TotalGST, 0, 9));
        Page.SetBackgroundTaskResult(Results);
    end;

    local procedure GetLineGSTAmount(PurchaseLine: Record "Purchase Line"): Decimal
    begin
        // Put your read-only GST lookup for one line here.
        // In the India localization, GST is calculated by the Tax Engine, so use the same
        // read-only logic you already use in your own statistics page or reports.
        // Remember: this codeunit can't write, so don't trigger a recalculation from here.
        exit(0);
    end;
}
```

A few things to notice:

- **`Page.GetBackgroundParameters()`** gives us the dictionary the page sent.
- **`SetLoadFields`** keeps the read light. We only need the quantity and the amount.
- **`Format(..., 0, 9)`** writes the number in a fixed, standard format. That way, `1234.5` never turns into `1.234,5` because of a user's regional settings, and the page can safely read it back.
- **`Page.SetBackgroundTaskResult(Results)`** hands the results back to the page.

About the GST part: in the India localization, GST is calculated by the Tax Engine, and every project reads it a little differently. So I left one small procedure, `GetLineGSTAmount`, where you put your own read-only GST lookup. The rest of the pattern stays the same.

## Step 2: the page extension

Now the page. It shows the fields, starts the task, and receives the results.

```al
pageextension 50190 "ABC Purchase Order Totals" extends "Purchase Order"
{
    layout
    {
        addafter(General)
        {
            group(ABCLiveTotals)
            {
                Caption = 'Live Totals';

                field(ABCStatus; StatusText)
                {
                    ApplicationArea = All;
                    Caption = 'Status';
                    Editable = false;
                    ToolTip = 'Specifies whether the totals are still being calculated.';
                }
                field(ABCLineCount; LineCount)
                {
                    ApplicationArea = All;
                    Caption = 'No. of Lines';
                    Editable = false;
                    ToolTip = 'Specifies the number of purchase lines.';
                }
                field(ABCTotalQty; TotalQty)
                {
                    ApplicationArea = All;
                    Caption = 'Total Quantity';
                    Editable = false;
                    DecimalPlaces = 0 : 5;
                    ToolTip = 'Specifies the total quantity of all lines.';
                }
                field(ABCTotalAmount; TotalAmount)
                {
                    ApplicationArea = All;
                    Caption = 'Total Amount (before GST)';
                    Editable = false;
                    AutoFormatType = 1;
                    ToolTip = 'Specifies the total line amount before GST.';
                }
                field(ABCTotalGST; TotalGST)
                {
                    ApplicationArea = All;
                    Caption = 'Total GST';
                    Editable = false;
                    AutoFormatType = 1;
                    ToolTip = 'Specifies the total GST of all lines.';
                }
                field(ABCTotalInclGST; TotalInclGST)
                {
                    ApplicationArea = All;
                    Caption = 'Total incl. GST';
                    Editable = false;
                    AutoFormatType = 1;
                    ToolTip = 'Specifies the total amount including GST.';
                }
            }
        }
    }

    actions
    {
        addlast(Processing)
        {
            action(ABCRefreshTotals)
            {
                ApplicationArea = All;
                Caption = 'Refresh Totals';
                Image = Refresh;
                ToolTip = 'Calculate the live totals again, for example after changing lines.';

                trigger OnAction()
                begin
                    StartTotalsTask();
                end;
            }
        }
    }

    var
        TotalsTaskId: Integer;
        StatusText: Text;
        LineCount: Integer;
        TotalQty: Decimal;
        TotalAmount: Decimal;
        TotalGST: Decimal;
        TotalInclGST: Decimal;
        CalculatingTxt: Label 'Calculating...';
        UpdatedTxt: Label 'Updated';
        NotAvailableTxt: Label 'Totals not available. Use Refresh Totals to try again.';

    trigger OnAfterGetCurrRecord()
    begin
        StartTotalsTask();
    end;

    trigger OnPageBackgroundTaskCompleted(TaskId: Integer; Results: Dictionary of [Text, Text])
    begin
        if TaskId <> TotalsTaskId then
            exit;

        Evaluate(LineCount, Results.Get('LineCount'), 9);
        Evaluate(TotalQty, Results.Get('TotalQty'), 9);
        Evaluate(TotalAmount, Results.Get('TotalAmount'), 9);
        Evaluate(TotalGST, Results.Get('TotalGST'), 9);
        TotalInclGST := TotalAmount + TotalGST;
        StatusText := UpdatedTxt;
    end;

    trigger OnPageBackgroundTaskError(TaskId: Integer; ErrorCode: Text; ErrorText: Text; ErrorCallStack: Text; var IsHandled: Boolean)
    begin
        if TaskId <> TotalsTaskId then
            exit;

        // Don't bother the user with a technical error, just show a friendly status
        StatusText := NotAvailableTxt;
        IsHandled := true;
    end;

    local procedure StartTotalsTask()
    var
        Parameters: Dictionary of [Text, Text];
    begin
        ClearTotals();
        if Rec."No." = '' then
            exit;

        Parameters.Add('DocumentNo', Rec."No.");
        CurrPage.EnqueueBackgroundTask(TotalsTaskId, Codeunit::"ABC PO Totals Task", Parameters, 60000, PageBackgroundTaskErrorLevel::Warning);
        StatusText := CalculatingTxt;
    end;

    local procedure ClearTotals()
    begin
        LineCount := 0;
        TotalQty := 0;
        TotalAmount := 0;
        TotalGST := 0;
        TotalInclGST := 0;
        StatusText := '';
    end;
}
```

(Change `ABC` and the object IDs to your own prefix and range.)

## What happens when the user opens an order

Let's follow it, step by step:

```text
User opens PO-1001
  |
  |-- OnAfterGetCurrRecord
  |     ClearTotals, Status = "Calculating..."
  |     EnqueueBackgroundTask -> child session starts
  |
  |-- The page is shown IMMEDIATELY. User can scroll, read, click.
  |
  |   (in the background)
  |   ABC PO Totals Task reads the lines, adds them up, returns the results
  |
  |-- OnPageBackgroundTaskCompleted
        Totals are filled in, Status = "Updated"
```

And if the user moves to the next order before the task is done? Business Central **cancels** the old task by itself, because the page's current record changed. `OnAfterGetCurrRecord` then starts a new one for the new order. You don't need to clean anything up.

## Why `OnAfterGetCurrRecord`, and not `OnOpenPage`?

This one is important. A background task remembers **which record** the page was showing when it started. If that record changes while the task runs, the task is cancelled.

That's why Microsoft recommends **not** starting the task from `OnOpenPage` or `OnValidate`, and using `OnAfterGetCurrRecord` instead. At that moment, the page knows exactly which record it's on.

On **list** pages, be careful with `OnAfterGetRecord`. It runs for every row, so the record changes on every row, and your task gets cancelled again and again.

## What a background task can't do

It's not a magic "run anything in the background" button. These are the rules:

- **Read only.** The codeunit can't insert, modify or delete. If it tries, you get a permission error. So it can read GST values, but it can't trigger something that writes them.
- **No UI in the codeunit.** No `Message`, no `Confirm`, no pages.
- **Text in, text out.** Parameters and results are `Dictionary of [Text, Text]`.
- **Timeout.** You set it in milliseconds. The maximum is 600,000 ms (10 minutes). I use 60 seconds here, which is plenty for totals.
- **Five at a time.** By default, one session runs at most five background tasks at once. More are queued.
- **In the completed trigger, `CurrPage.Update` does nothing.** You just set the variables, and the page shows them.

## A small tip for FactBoxes

You could also put these totals in a **FactBox** part instead of a group on the page. That works well, but know one thing: a part page doesn't show **any** of its data until all its background tasks are finished. The fields just show dashes until then. If you mix normal fields and background fields, put them in separate parts.

## Testing it

You don't have to open the page and wait to test the codeunit. `TestPage` has a method for this:

```al
PurchaseOrder.OpenView();
PurchaseOrder.GoToRecord(PurchaseHeader);
Parameters.Add('DocumentNo', PurchaseHeader."No.");
Results := PurchaseOrder.RunPageBackgroundTask(Codeunit::"ABC PO Totals Task", Parameters);
```

It runs the codeunit directly and gives you the results dictionary, so you can check the numbers in an automated test.

## To sum it up

- When a calculation makes a page slow, don't make the user wait for it. **Move it to a page background task.**
- The page **enqueues** the task, a **codeunit** calculates and returns text, and the page **shows** the results in `OnPageBackgroundTaskCompleted`.
- Start it from **`OnAfterGetCurrRecord`**. If the user moves to another record, the old task is cancelled by itself.
- Remember the rules: **read only**, text in and out, and a timeout.

Purchase totals and GST are a perfect fit: users want to see them, but they don't need them in the very first millisecond.

Have you used page background tasks in a project? For what? Tell me in the comments. I'm always curious where others use them.

## Sources

- Microsoft Learn: [Page Background Tasks](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-page-background-tasks)
