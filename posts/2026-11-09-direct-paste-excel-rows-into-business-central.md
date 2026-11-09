---
title: "Direct Paste: copy rows from Excel and paste them straight into Business Central (open source)"
date: 2026-11-09
type: solution
tags: Control Add-in, AL, JavaScript, Excel, Data Import, Open Source, Business Central
summary: I built Direct Paste, a free MIT-licensed extension. Copy rows from Excel, paste them in a FactBox, check the column links, and Business Central validates every row before inserting anything. Here is how it looks and how it works inside.
---

Every implementation I have worked on has this one request: *"Can we just paste the lines from Excel?"*

The customer sends a purchase order as an Excel sheet. The sales person has 40 lines to enter. Configuration packages are too heavy for a daily job, Edit in Excel needs a proper layout, and typing 40 lines by hand is how mistakes happen.

Recently Erik Hougaard showed his **Magic Paste** idea, and it got me thinking. So I built my own version from scratch and made it open source. I call it **Direct Paste**.

**Code on GitHub:** [github.com/anilkcs001/DirectPaste](https://github.com/anilkcs001/DirectPaste), MIT licence, free to use, change and ship.

In this post I'll first show how it looks for a user, then explain how it works inside, and at the end how to put it on your own page.

> The screenshots below are the real add-in scripts from the repo, running in a browser with sample data (Sales Order **SO-50012**, a fastener sheet). Inside Business Central they look the same, sitting in the FactBox pane and in a dialog.

## How it looks for the user

### Step 1: Paste in the FactBox

Open a Sales Order. In the FactBox pane on the right there is a paste zone. Copy the rows in Excel (with or without the header row), click the zone and press **Ctrl+V**. You can also drop a CSV file on it.

![Direct Paste FactBox with the paste zone](images/direct-paste/factbox.png)

That's it for the user's side of the "import". No file upload, no Excel template to download first.

### Step 2: Check the links in the mapper

The paste opens a dialog. On the left are **your columns** from Excel. On the right are the **Business Central fields** of Sales Line. The lines in between show which column goes into which field.

![Mapper after auto-mapping a typical Indian Excel sheet](images/direct-paste/mapper-auto-map.png)

Look at what happened with a very normal Indian sheet:

| Excel header | Mapped to |
|---|---|
| Item Code | No. |
| Particulars | Description |
| Qty | Quantity |
| Rate | Unit Price |
| UOM | Unit of Measure Code |
| Delivery Date | Shipment Date |
| HSN | HSN/SAC Code |
| Godown | Location Code |
| Sr No | *not imported* |

8 of 9 columns linked without any setup. "Sr No" is skipped on purpose, because it's just a row counter.

A few things you can see on the screen:

- **Document Type** and **Document No.** are shown as "Set automatically". They come from the Sales Order you are on, so the user can't map them wrongly.
- A **dashed** line means auto-matched. A **dotted amber** line means "I'm not sure, please check". A **solid** line is one you linked yourself.
- To change a link, drag the dot from a column onto a field, or click a column and then a field. Click a line to remove it.
- Every field has a **default** box. For a field with no column (for example Type = Item), the default fills every row. For a linked field, it fills only the blank cells.
- The preview at the bottom shows the actual rows and which column goes where.

### Step 3: Save it as a template

If the same customer sends the same sheet every week, you don't want to check links every time. Click **Save as template**, give it a name, and it's saved for the whole company.

Next time someone pastes a sheet with the same headers, Direct Paste recognises it and applies the template automatically:

![Template recognised from the pasted headers](images/direct-paste/mapper-template.png)

"Fastener vendor sheet · 8/8 match" means all 8 headers of that template were found in the paste. A template is picked when at least 60% of its headers are there, so a sheet with one extra or one missing column still works.

### Step 4: Press OK, and everything is checked first

This is the part I care about most. When the user presses **OK**, nothing is inserted yet. Every row is first checked against Business Central's own rules, the same `OnValidate` code, the same `Insert(true)`, the same GST Tax Engine subscribers.

If even one row fails, you get **all** the problems with their Excel row numbers, and **nothing is inserted**:

![Dry run errors listed with row numbers](images/direct-paste/dry-run-errors.png)

The user fixes the sheet (or a default, or a link), pastes again, and presses OK. When every row passes, the lines are inserted.

So you never end up with "22 lines went in, line 23 failed, now what?"

## How it works inside

The extension has two parts, the same pattern as any control add-in:

- **JavaScript (the control add-in)** does the browser work: reading the clipboard, parsing, auto-mapping, the drag-to-link screen and converting values.
- **AL** does the Business Central work: field list, dry run, insert, templates and permissions.

### 1. Reading the paste

The paste zone is a transparent `textarea`. That's why Ctrl+V, right-click → Paste and long-press on touch all work, with no clipboard permission popup.

When you copy cells, Excel puts **tab-separated text** on the clipboard. Cells that contain a tab, a quote or a line break come with quotes around them. `helper.js` handles those quotes, falls back to comma or semicolon for CSV, removes empty rows and pads short rows. It also guesses whether the first row is a header.

### 2. Auto-mapping

Every Excel header is scored against every field that can be imported. Highest score wins, one column per field, minimum score 58:

| Rule | Score |
|---|---|
| Same header you used last time for this field | 110 |
| Exact caption match (ignoring case, spaces, dots) | 100 |
| Exact field name match | 95 |
| Synonym: Qty, Rate/MRP, UOM, HSN, Godown and more | 85 |
| Header contains the field's words ("Item Qty") | 60–75 |
| Word overlap or similar spelling | up to 70 |

Then the column's data is looked at: numbers going to a Decimal field get +10, text going to a Date field gets −25. Links below 75 are drawn amber so the user checks them.

### 3. Converting values the Indian way

Before anything goes to AL, each cell is converted to AL's XML format, so it works the same whatever the user's regional settings are:

- **Numbers:** `1,23,456.50` (lakh grouping), `1,234.50`, `1.234,50`, `(1,000)`, `₹ 450`, `12%`
- **Dates:** `15-11-2026`, `15/11/2026`, `15.11.26`, `15 Nov 2026`, ISO and Excel serial numbers. Ambiguous dates like `04-05-2026` are read **day first** (4 May), the Indian way.
- **Yes/No:** yes, y, true, 1, x

If a value can't be converted, the user sees it in the preview before AL is even called.

### 4. The dry run: insert, then roll back on purpose

This is the trick I like most. How do you check a row with **all** of Business Central's validation, without saving it?

You insert it for real, then throw an error on purpose so the platform rolls it back.

The row check codeunit builds the record exactly like the real import and then raises a fixed "sentinel" error:

```al
codeunit 87301 "AML Direct Paste Row Check"
{
    Access = Internal;

    trigger OnRun()
    var
        RecRef: RecordRef;
    begin
        RecRef.Open(TargetTableNo);
        DirectPasteMgt.ProcessRow(RecRef, Context, FieldOrder, Values, AutoNoFieldNo, AutoNoValue);
        Error(DryRunOkErr); // always fails, so everything above is rolled back
    end;
    // ...
}
```

The management codeunit runs it for each row with `if not RowCheck.Run()`:

```al
foreach RowToken in Rows do begin
    ReadRow(RowToken.AsObject(), Links, Defaults, RowNo, Values);
    Clear(RowCheck);
    RowCheck.SetRow(TableNo, Context, FieldOrder, Values, AutoNoFieldNo, NextAutoNo);
    ClearLastError();
    if not RowCheck.Run() then
        if not RowCheck.IsDryRunSuccess(GetLastErrorText()) then
            // a real problem: remember it with the row number
            ...
end;
```

- If the error text is the sentinel, the row is fine.
- Any other error text is that row's real problem: "You must select an existing item", a missing GST setup, a blocked customer, anything.

Because every run ends in a rollback, the insert and any tax records written by subscribers are gone. And because no write transaction stays open, `Codeunit.Run` with a return value is allowed for the next row. (I explained why that matters in my post on [Commit in AL](#/post/2026-10-31-commit-in-al-what-it-really-means).)

Why not a `[TryFunction]`? Because a TryFunction does **not** roll back database writes. A half-inserted line would stay.

### 5. Building the record in the right order

For each row, `ProcessRow`:

1. Calls `Init()`.
2. Sets the context fields from the host page (Document Type, Document No.) without validation.
3. Numbers **Line No.** automatically: last line + 10000, then +10000 per row.
4. Validates the mapped and default fields **key fields first, then by field number**. On Sales Line that gives Type → No. → Location Code → Quantity → Unit Price, the same order a user types them.
5. Calls `Insert(true)`.

The real import runs the same `ProcessRow`, with `Commit()` every 100 records using the `mod` pattern.

### 6. Security

The add-in only offers normal, enabled, non-obsolete fields. AL checks every field number again when the data comes back, so even a tampered payload can't write to FlowFields, system fields, the context fields or Line No.

## Put it on your own page

The engine is generic. It works on any table through `RecordRef`. The host page only decides two things: the target table, and which fields the header fixes.

This is the Sales Order example from the repo:

```al
pageextension 87300 "AML Sales Order Direct Paste" extends "Sales Order"
{
    layout
    {
        addfirst(factboxes)
        {
            part(AMLDirectPaste; "AML Direct Paste FactBox") { ApplicationArea = All; }
        }
    }

    trigger OnAfterGetCurrRecord()
    var
        Context: Dictionary of [Integer, Text];
    begin
        GetDirectPasteContext(Context);
        CurrPage.AMLDirectPaste.Page.SetContext(Database::"Sales Line", Context);
    end;

    local procedure GetDirectPasteContext(var Context: Dictionary of [Integer, Text])
    var
        SalesLine: Record "Sales Line";
        DirectPasteMgt: Codeunit "AML Direct Paste Mgt.";
        RecRef: RecordRef;
    begin
        SalesLine."Document Type" := Rec."Document Type";
        SalesLine."Document No." := Rec."No.";
        RecRef.GetTable(SalesLine);
        DirectPasteMgt.AddContextField(Context, RecRef, SalesLine.FieldNo("Document Type"));
        DirectPasteMgt.AddContextField(Context, RecRef, SalesLine.FieldNo("Document No."));
    end;
}
```

For a Purchase Order, change the table to Purchase Line. For an Item Journal, the context is Journal Template Name and Journal Batch Name. Line No. is numbered for you.

## How to install it

1. Clone [the repo](https://github.com/anilkcs001/DirectPaste) and open the folder in VS Code with the AL Language extension.
2. Change the object IDs (87300–87304) to your own range if they clash.
3. Download symbols for your sandbox and publish (F5).
4. Assign the permission set **AML Direct Paste** to users. They still need their normal insert rights on Sales Line. Direct Paste doesn't give extra rights.
5. Open a Sales Order with status Open, paste, check, press OK.

It needs only Base Application and System Application (v25). No Azure, no external API, nothing leaves Business Central.

## Things to know before you use it

- **FactBox refresh.** A FactBox can't refresh its host page, so after a paste from the FactBox, the new lines show when the page refreshes. The **Direct Paste Lines** action on the Sales Order opens the same mapper and refreshes the page after.
- **Speed.** Every row is inserted and rolled back once in the dry run, including tax calculation. A few hundred lines take seconds; several thousand can take minutes.
- **Confirm dialogs.** If a field validation asks a question, it will interrupt the dry run. Map or default fields so the question doesn't come up.
- **Limits.** 5,000 rows and 200 columns per paste. Only plain text is read, so Excel formulas come as their displayed values. `.xlsx` files can't be dropped; copy the cells instead.
- **Test it in a sandbox first.** It's a PTE, and it's built for BC 2024 release wave 2 (v25) with the India localisation in mind. Please try it on your version before production.

## Wrapping up

Direct Paste solves a small problem, but it's one users meet every single day. The parts I'd reuse in other projects are the **dry run with a sentinel error** (full validation without saving) and the **auto-mapping score** (users hate mapping screens, so do most of it for them).

The code is on GitHub under the MIT licence: **[anilkcs001/DirectPaste](https://github.com/anilkcs001/DirectPaste)**. If you try it, please open an issue or a pull request, especially if your sheets have headers my synonym list doesn't know yet.

## Sources

- [Control add-in object (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-control-addin-object)
- [Codeunit.Run method and transactions (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/methods-auto/codeunit/codeunit-run-method)
- [Handling errors using Try methods (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-handling-errors-using-try-methods)
- [Direct Paste source code and README](https://github.com/anilkcs001/DirectPaste)
