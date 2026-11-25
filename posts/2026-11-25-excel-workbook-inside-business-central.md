---
title: I built an Excel workbook inside Business Central (with GST vs GSTR-2B reconciliation)
date: 2026-11-25
type: solution
tags: Control Add-in, Excel, GST, Reconciliation, AL, Business Central
summary: A full spreadsheet inside a BC page. Pull data from any table you can read, keep your formulas, refresh with one click, import and export .xlsx, and reconcile GST books against GSTR-2B in a few seconds.
---

In every project I see the same thing. Users open a BC page, click **Open in Excel**, download the file, add some formulas, then do the same work again next month. For GST, it's even more work. They download the GST ledger, download the GSTR-2B Excel from the GST portal, and match the invoices one by one with VLOOKUP.

So I thought: why can't we do this inside Business Central itself?

I built a small extension called **Excel Workbook**. It puts a real spreadsheet inside a BC page. In this post I'll show what it does, with screenshots, and explain how it works in simple words.

## What it can do

- **Get data from any table.** Pick a table, tick the fields, add filters in normal BC syntax, and load the data into a sheet.
- **Work like Excel.** Formulas, formatting, sort, filter, freeze panes, find and replace, and copy and paste with desktop Excel.
- **Refresh with one click.** All linked sheets load again from BC. Your own formulas next to the data stay as they are.
- **Save in BC.** The workbook is saved in a BC table, so next month you just open it and click Refresh. AutoSave is also there.
- **Import and export .xlsx.** Bring in any Excel file as new sheets, or download the workbook as .xlsx.
- **Combine.** Join two sheets on a key column, like a VLOOKUP for the whole sheet at once.
- **Reconcile.** Match your books against GSTR-2B, a bank statement or a party ledger.

One important thing: **it respects BC permissions.** If a user can't read a table in BC, they can't load it here either.

## Step 1: Get data from BC

Click **Get data**, search for the table (here Detailed GST Ledger Entry), tick the fields you want and add filters. I used `IGST|CGST` on GST Component Code, so each invoice line comes only once, and October 2026 on Posting Date. Then click **Load data**.

![Get data panel in Business Central with Detailed GST Ledger Entry, filters on GST Component Code and Posting Date, and the loaded rows in the sheet](images/excel-workbook-in-bc/1-get-data.jpg)

The rows come into a sheet called "GST Books". This sheet is now **linked** to BC, so Refresh loads it again with the same fields and filters.

## Step 2: Import the GSTR-2B Excel

Download the GSTR-2B Excel from the GST portal. Click **Import**, choose **Add as new sheets**, and the B2B sheet comes in next to your books.

![GSTR-2B B2B sheet imported into the workbook as a new sheet](images/excel-workbook-in-bc/2-gstr2b-imported.jpg)

## Step 3: Reconcile

Click **Reconcile** and choose **GST vs GSTR-2B**. The tool picks the sheets by itself (BC data on the Books side, the imported file on the GSTR-2B side). It also guesses the columns: GSTIN plus invoice number as the key, taxable value as the amount.

![Reconcile panel with the GST vs GSTR-2B template selected and the Books and GSTR-2B sheets picked](images/excel-workbook-in-bc/3-reconcile-panel.jpg)

A few options I added because of real problems I saw:

- **Normalise document numbers.** In books the vendor invoice is `SLP/0451`, but in GSTR-2B it is `SLP-451`. With this option on, both match.
- **Sum lines per key.** One invoice can have many lines in BC, but GSTR-2B has one line per invoice. So it adds up the lines first.
- **Tolerance.** A difference of up to ₹1 (you can change it) is treated as matched, for rounding.

## Step 4: See the result

Click **Reconcile** at the bottom. You get a new sheet, and the problems come **first**, in colour:

- **Amount difference** (yellow): same invoice, but the amount is different.
- **Only in Books** (red): we booked it, but the vendor didn't file it. You can't take that ITC yet.
- **Only in GSTR-2B** (purple): the vendor filed it, but we didn't book it.
- **Matched** (green): all good.

![Reconciliation result with amount differences, only in books and only in GSTR-2B rows on top, and matched rows below](images/excel-workbook-in-bc/4-recon-result.jpg)

It also makes a **summary sheet** with the count and amount for each status. The summary uses normal COUNTIF and SUMIF formulas, so if you correct something in the result sheet, the totals change.

![Reconciliation summary sheet with counts and amounts per status and the matched percentage](images/excel-workbook-in-bc/5-summary.jpg)

Next month, you just open the same workbook, change the date filter, import the new GSTR-2B and click Refresh. The reconciliation runs again.

The same Reconcile panel also has templates for **Bank vs G/L** (match by amount and date) and **Party ledger** (our vendor ledger against the vendor's statement, with opposite signs).

## How it works (simple version)

**1. A control add-in for the sheet.** The spreadsheet is a control add-in. Inside it I used **Univer**, an open-source spreadsheet engine (Apache-2.0 licence), and **ExcelJS** (MIT) to read and write .xlsx files. Both are bundled inside the extension, so there are no CDN calls and nothing goes outside BC.

**2. One AL codeunit reads any table.** I didn't write code for each table. The data service uses **RecordRef** and **FieldRef**, so the same code works for any table number. Before reading, it checks `RecRef.ReadPermission()`. If the user has no permission, it stops.

**3. Data goes in chunks.** We can't send 50,000 rows to the browser in one call. So AL sends the rows in **chunks of 2,000**, and big texts like a saved workbook go in pieces of about 400,000 characters. The default limit is 10,000 rows, and the user can raise it up to 100,000.

**4. The page is only the add-in.** The editor page is a `UserControlHost` page, so the whole page is the spreadsheet. Save, Refresh, Import, Export and the panels are all inside the add-in.

**5. Matching runs in the browser.** Combine and Reconcile work on the rows already in the sheets, in JavaScript. They don't call BC again, so they are fast.

The matching goes in passes, and each row is used only once:

1. Same key and the amount is within tolerance → **Matched**
2. Same key but the amount is different → **Amount difference**
3. No key match, but the same amount with dates within a few days → **Matched** (useful for bank)
4. Whatever is left → **Only in Books** or **Only in GSTR-2B**

## Things to know

- The first time you open it in a browser session it takes a moment, because the spreadsheet engine is about 3 MB compressed. After that it's cached.
- Above roughly 50,000 rows × 15 columns, the browser gets slow. Use filters.
- Charts, pivot tables and macros are not supported.
- BC can't ask "close without saving?" on this kind of page, so keep AutoSave on.

## Wrap-up

This started as "can I avoid downloading Excel every month?", and now GST reconciliation that took hours with VLOOKUPs takes a few seconds inside BC. The same idea works for any report users keep rebuilding in Excel.

The screenshots use demo data. All vendor names and GSTINs are made up.

If you have questions, or you want to try something like this in your project, ask below or message me on LinkedIn.
