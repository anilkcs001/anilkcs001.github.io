---
title: "Direct Paste: copy rows from Excel and paste them straight into Business Central (open source)"
date: 2026-11-09
type: solution
tags: Control Add-in, AL, JavaScript, Excel, Data Import, Open Source, Business Central
summary: I built a small free tool called Direct Paste. You copy rows from Excel, paste them in Business Central, check the columns once, and BC checks every row before saving anything. Here's how it looks and how I made it work.
---

In every project I've worked on, at some point a user comes to me and asks the same thing:

*"Anil, can't we just paste the lines from Excel?"*

And honestly, they're right to ask. The customer sends the order as an Excel sheet. Forty lines. The sales person has to type every item code, quantity and rate into the Sales Order again. One wrong digit and the order goes wrong.

Configuration packages are too heavy for this. Nobody wants to set up a package for a daily order. Edit in Excel works, but the sheet must be in BC's layout, and customer sheets are never in BC's layout.

So I always had this idea in my mind. A few days back I saw Erik Hougaard's **Magic Paste**, and that pushed me to finally build my own. I wrote it from scratch, named it **Direct Paste**, and I'm sharing it free.

**Here's the code:** [github.com/anilkcs001/DirectPaste](https://github.com/anilkcs001/DirectPaste). It's MIT licensed, so you can use it, change it, ship it to your customers, anything.

Let me first show you what the user sees, and then I'll explain how it works inside.

> Quick note on the screenshots: these are the actual add-in scripts from the repo, running in a browser with sample data (Sales Order SO-50012 and a fastener order sheet). Inside Business Central it looks the same. The paste zone sits in the FactBox pane, and the mapper opens as a dialog.

## What the user sees

### First, they paste

Open any Sales Order. On the right side, in the FactBox pane, there's a small paste box. Go to Excel, select the rows (header row included or not, doesn't matter), copy, click the box and press **Ctrl+V**.

![The Direct Paste box in the FactBox](images/direct-paste/factbox.png)

That's all the user does. No file to upload, no template to download first. If someone has a CSV file, they can just drop it on the box.

### Then they check the columns

Now a dialog opens. On the left are the columns from their Excel. On the right are the Sales Line fields. The lines in between show what goes where.

![The mapper after it matched the columns by itself](images/direct-paste/mapper-auto-map.png)

Look at what it did with a very normal Indian sheet. Nobody set anything up:

| Excel header | Went into |
|---|---|
| Item Code | No. |
| Particulars | Description |
| Qty | Quantity |
| Rate | Unit Price |
| UOM | Unit of Measure Code |
| Delivery Date | Shipment Date |
| HSN | HSN/SAC Code |
| Godown | Location Code |
| Sr No | *skipped* |

8 out of 9 columns matched on their own. "Sr No" is skipped on purpose, because it's just a serial number. We don't want that anywhere.

A few small things on this screen I'm happy about:

- **Document Type** and **Document No.** show as "Set automatically". They come from the order you're standing on, so the user can't mess them up.
- A **dashed** line means "I matched this myself". A **dotted orange** line means "I'm not sure, please check this one". A **solid** line means you linked it.
- If something is wrong, just drag the dot from a column to the right field. Or click the column, then click the field. To remove a link, click the line.
- Every field has a **default** box. Say your sheet has no "Type" column. Put "Item" as the default and every line gets it. If the field already has a column, the default only fills the empty cells.
- The table at the bottom shows the real rows, so you can see the data before anything happens.

### If it's the same sheet every week, save it

Some customers send the same format every single week. Checking the links every time is boring. So click **Save as template**, give it a name, and done. It's saved for everyone in the company.

Next time anybody pastes a sheet with the same headers, Direct Paste recognises it and applies the template by itself:

![Direct Paste recognised the sheet and applied the saved template](images/direct-paste/mapper-template.png)

See "Fastener vendor sheet · 8/8 match" at the top? All 8 headers from the template were found. It picks a template when at least 60% of its headers are there, so even if the customer adds one extra column or drops one, it still works.

### Press OK, and BC checks everything first

This is the part I care about the most.

When the user presses **OK**, nothing gets saved yet. First, every row is checked using Business Central's own rules. Same `OnValidate` code, same `Insert(true)`, same GST Tax Engine. Exactly what would happen if you typed the line by hand.

If even one row has a problem, you see **all** the problems together, with the Excel row number, and **nothing is saved**:

![All problems shown together with their row numbers](images/direct-paste/dry-run-errors.png)

The user fixes the sheet, pastes again, presses OK. When every row is clean, then only the lines go in.

You know that situation where 22 lines went in, line 23 failed, and now you have to find out what's in and what's not? That doesn't happen here. It's all or nothing.

## How it works inside

Okay, now the developer part. It's two pieces working together, like any control add-in:

- **JavaScript** does the browser work. Reading the paste, guessing the columns, the drag-and-link screen, and cleaning up the values.
- **AL** does the Business Central work. Which fields can be filled, checking the rows, saving them, templates and permissions.

### 1. Reading what you pasted

The paste box is actually a see-through `textarea`. Because of that, Ctrl+V works, right-click → Paste works, long-press on a tablet works, and the browser doesn't ask "allow clipboard access?".

When you copy cells, Excel puts **tab-separated text** on the clipboard. If a cell has a tab or a line break inside it, Excel wraps it in quotes. `helper.js` takes care of those quotes. If there are no tabs, it tries comma or semicolon (for CSV). It also removes empty rows and guesses whether your first row is a header.

### 2. Guessing which column goes where

Every Excel header is compared with every field and given a score. The best score wins. One column per field, and anything below 58 is left alone:

| What matched | Score |
|---|---|
| Same header you used last time for this field | 110 |
| Exactly the field caption (case, spaces and dots ignored) | 100 |
| Exactly the field name | 95 |
| A known short form: Qty, Rate/MRP, UOM, HSN, Godown and more | 85 |
| Header has the field's words in it ("Item Qty") | 60–75 |
| Words overlap or spelling is close | up to 70 |

Then it also looks at the data in the column. Numbers going to a Decimal field get +10. Text going to a Date field gets −25. Anything below 75 is drawn in orange so the user takes a look.

That synonym list is where the Indian part comes in. "Godown" for location, "Particulars" for description, "Rate" for price. Our sheets talk like this.

### 3. Handling Indian numbers and dates

Before anything goes to AL, every cell is converted to AL's standard format. So it doesn't matter what regional settings the user has. It understands:

- **Numbers:** `1,23,456.50` (lakh style), `1,234.50`, `1.234,50`, `(1,000)`, `₹ 450`, `12%`
- **Dates:** `15-11-2026`, `15/11/2026`, `15.11.26`, `15 Nov 2026`, ISO dates, and those Excel serial numbers. And when a date could go both ways, like `04-05-2026`, it reads it **day first**, so 4 May. The Indian way.
- **Yes/No:** yes, y, true, 1, x

If a value just can't be converted, the user sees it in the preview, before AL is even called.

### 4. The trick: insert it, then cancel it on purpose

This is my favourite part, so let me explain slowly.

The question was: how do I check a row with **all** of BC's rules, without actually saving it?

The answer: actually insert it, and then throw an error on purpose. When an error happens, BC rolls back everything. So the row goes in, all the validation and tax code runs, and then it's gone.

Here's the codeunit that checks one row. It builds the record exactly like the real import, and at the end it always raises the same fixed error (I call it the "sentinel"):

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

And the main codeunit runs it for each row with `if not RowCheck.Run()`:

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

So now there are only two cases:

- The error is my sentinel error → the row reached the end → the row is fine.
- The error is anything else → that's the row's real problem. "You must select an existing item", GST setup missing, customer blocked, whatever it is.

Every run ends in a rollback, so the line and any tax records are gone. And because nothing is left open, the next `Codeunit.Run` is allowed. (If you're wondering why that matters, I wrote about it in my post on [Commit in AL](#/post/2026-10-31-commit-in-al-what-it-really-means).)

People ask me, why not a `[TryFunction]`? Because a TryFunction **doesn't** roll back database changes. If it fails halfway, the half-inserted line stays there. Not what we want.

### 5. Filling the fields in the right order

For every row, `ProcessRow` does this:

1. `Init()`.
2. Sets the fields that come from the order (Document Type, Document No.), without validation.
3. Gives the **Line No.** itself: last line + 10000, then +10000 for each row.
4. Validates the fields **key fields first, then by field number**. On Sales Line that means Type → No. → Location Code → Quantity → Unit Price. That's the same order you'd type them on the page, which matters, because Quantity needs No. to be there first.
5. `Insert(true)`.

The real import uses this same `ProcessRow`, and does a `Commit()` every 100 records with the usual `mod` pattern.

### 6. Keeping it safe

The add-in only shows normal, enabled fields that aren't obsolete. And when the data comes back, AL checks every field number again. So even if someone messes with the data in the browser, they can't write into FlowFields, system fields, the order fields or Line No.

## Want it on your own page?

The engine doesn't care which table it is. It works with `RecordRef`, so any table works. Your page only tells it two things: which table to fill, and which fields are already decided by the header.

Here's the Sales Order example from the repo:

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

Want it on a Purchase Order? Change it to Purchase Line. On an Item Journal? The context becomes Journal Template Name and Journal Batch Name. Line No. is handled for you either way.

## How to install it

1. Clone [the repo](https://github.com/anilkcs001/DirectPaste) and open the folder in VS Code with the AL Language extension.
2. If the object IDs (87300–87304) clash with yours, change them.
3. Download symbols for your sandbox and press F5.
4. Give users the permission set **AML Direct Paste**. They still need their normal rights to insert Sales Lines. Direct Paste doesn't give anyone extra rights.
5. Open a Sales Order with status Open, paste something, check it, press OK.

It only needs the Base Application and System Application (v25). No Azure, no outside API. Your data never leaves Business Central.

## Things you should know

I don't want to oversell it, so here are the limits:

- **The page doesn't refresh by itself.** A FactBox can't refresh the page it sits on. So after pasting from the FactBox, the new lines show up when the page refreshes. If you use the **Direct Paste Lines** action on the Sales Order instead, it opens the same screen and refreshes the page after.
- **Big pastes take time.** Every row is inserted and rolled back once during the check, tax calculation included. A few hundred lines take seconds. A few thousand can take minutes.
- **Confirm popups get in the way.** If a field's validation asks the user a question, it will interrupt the check. Map or default your fields so the question doesn't come up.
- **Limits.** 5,000 rows and 200 columns per paste. Only plain text is read, so Excel formulas come in as their values. You can't drop an `.xlsx` file. Just copy the cells instead.
- **Try it in a sandbox first.** It's a PTE built for BC 2024 release wave 2 (v25), with India localisation in mind. Please test it on your version before putting it in production.

## How I built it

I'll be honest about this: I used AI (Claude) as my coding partner on this project. What to build, and how it should behave for Indian users, was my call. I reviewed the code, tested it in my own BC sandbox, and fixed the issues that came up there, like the FactBox staying blank, a List error in sorting, and making the error messages clearer. AI made it faster, but every design decision and every test was mine. I really think this is how a lot of BC development is going to look from now on.

## That's it

Direct Paste solves a small problem. But it's a problem users hit every single day, and small daily pain is the kind people remember.

If you only take two ideas from this post for your own work, take these. The **insert-and-cancel trick**, to check a record with full validation without saving it. And **guess the mapping for the user**, because nobody likes filling mapping screens.

The code is here: **[anilkcs001/DirectPaste](https://github.com/anilkcs001/DirectPaste)**. If you try it, tell me how it went. Open an issue or send a pull request, especially if your sheets have headers my synonym list doesn't know yet. I'd love to add them.

## Sources

- [Control add-in object (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-control-addin-object)
- [Codeunit.Run method and transactions (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/methods-auto/codeunit/codeunit-run-method)
- [Handling errors using Try methods (Microsoft Learn)](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-handling-errors-using-try-methods)
- [Direct Paste source code and README](https://github.com/anilkcs001/DirectPaste)