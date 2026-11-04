---
title: How to apply a payment to an invoice from AL code (3 simple ways)
date: 2026-11-03
type: solution
tags: AL, Payables, Vendor Ledger Entry, Application, Business Central
summary: A user can apply a payment to an invoice in two clicks. Doing the same from AL code is not so obvious. Here are three simple ways to do it, with code, and the small mistakes to avoid. I learned this by reading blogs and the Business Central base app code.
---

In Business Central, a user can apply a payment to an invoice in two clicks. Open **Apply Entries**, select the invoice, and post.

But how do you do the same thing **from AL code**?

I wanted to know this, so I read a few blogs and community posts, and then I opened the **base app code** to see how Business Central itself does it. This post is a simple summary of what I learned.

I'll use **vendors** in the examples. **Customers work the same way.** There's a small table at the end.

---

## First, what does "apply" mean?

- When you post an **invoice** of ₹1,00,000, BC creates an **open** vendor ledger entry. Remaining amount: ₹1,00,000.
- When you post a **payment** of ₹1,00,000, BC creates another **open** entry, on the opposite side.

These two entries don't know about each other. The invoice still looks **unpaid**.

**Applying** connects them:

- the remaining amount on both becomes 0,
- both entries become **closed**,
- BC saves a small "Application" record that says *this payment paid this invoice*.

That's all. Nothing changes in the G/L. Only the vendor ledger is updated.

---

## The 4 fields you need to know

These names look similar, so let me explain them simply first:

| Field | Simple meaning |
|---|---|
| **Applies-to Doc. No.** | "Apply this payment to **this one** invoice." Used on the journal line |
| **Applies-to ID** | A **tag**. All entries with the same tag get applied together. Used when there's **more than one** invoice |
| **Amount to Apply** | How much of this entry to use |
| **Applying Entry** | Marks the entry that is **doing** the applying (usually the payment) |

---

## Which way to use?

It depends on **when** you apply:

| Your situation | Way |
|---|---|
| The payment is **not posted yet**, and it pays **one** invoice | **Way 1** |
| The payment is **not posted yet**, and it pays **many** invoices | **Way 2** |
| The payment and invoice are **already posted** | **Way 3** |

All the code below goes in one codeunit:

```al
codeunit 50250 "ABC Vendor Payment Apply"
{
    // procedures from the 3 ways go here
}
```

---

## Way 1: One payment for one invoice

This is the easiest one. It's the same as a user typing the invoice number in **Applies-to Doc. No.** on the payment journal.

**Steps:**
1. Create a payment journal line.
2. Fill **Applies-to Doc. Type** = Invoice and **Applies-to Doc. No.** = the invoice number.
3. Post.

```al
procedure PostPaymentForInvoice(TemplateName: Code[10]; BatchName: Code[10]; VendorNo: Code[20]; InvoiceNo: Code[20]; PaymentAmount: Decimal; BankAccountNo: Code[20]; PostingDate: Date)
var
    GenJnlLine: Record "Gen. Journal Line";
begin
    CreatePaymentLine(GenJnlLine, TemplateName, BatchName, VendorNo, PaymentAmount, BankAccountNo, PostingDate);

    GenJnlLine.Validate("Applies-to Doc. Type", GenJnlLine."Applies-to Doc. Type"::Invoice);
    GenJnlLine.Validate("Applies-to Doc. No.", InvoiceNo);
    GenJnlLine.Modify(true);

    PostLine(GenJnlLine);
end;
```

These two helpers create the line and post it. We'll reuse them in Way 2.

```al
local procedure CreatePaymentLine(var GenJnlLine: Record "Gen. Journal Line"; TemplateName: Code[10]; BatchName: Code[10]; VendorNo: Code[20]; PaymentAmount: Decimal; BankAccountNo: Code[20]; PostingDate: Date)
var
    GenJnlBatch: Record "Gen. Journal Batch";
    LastLine: Record "Gen. Journal Line";
    NoSeries: Codeunit "No. Series";
begin
    GenJnlBatch.Get(TemplateName, BatchName);

    LastLine.SetRange("Journal Template Name", TemplateName);
    LastLine.SetRange("Journal Batch Name", BatchName);
    if LastLine.FindLast() then;

    GenJnlLine.Init();
    GenJnlLine."Journal Template Name" := TemplateName;
    GenJnlLine."Journal Batch Name" := BatchName;
    GenJnlLine."Line No." := LastLine."Line No." + 10000;
    GenJnlLine.Insert(true);

    GenJnlLine.Validate("Posting Date", PostingDate);
    GenJnlLine.Validate("Document Type", GenJnlLine."Document Type"::Payment);
    GenJnlLine.Validate("Document No.", NoSeries.GetNextNo(GenJnlBatch."No. Series", PostingDate));
    GenJnlLine.Validate("Account Type", GenJnlLine."Account Type"::Vendor);
    GenJnlLine.Validate("Account No.", VendorNo);
    GenJnlLine.Validate("Bal. Account Type", GenJnlLine."Bal. Account Type"::"Bank Account");
    GenJnlLine.Validate("Bal. Account No.", BankAccountNo);
    GenJnlLine.Validate(Amount, PaymentAmount);   // positive amount for a vendor payment
    GenJnlLine.Modify(true);
end;

local procedure PostLine(var GenJnlLine: Record "Gen. Journal Line")
var
    LineToPost: Record "Gen. Journal Line";
begin
    LineToPost.SetRange("Journal Template Name", GenJnlLine."Journal Template Name");
    LineToPost.SetRange("Journal Batch Name", GenJnlLine."Journal Batch Name");
    LineToPost.SetRange("Line No.", GenJnlLine."Line No.");
    Codeunit.Run(Codeunit::"Gen. Jnl.-Post Batch", LineToPost);
end;
```

**What happens:** while posting, BC sees the invoice number in **Applies-to Doc. No.**, finds that open invoice for the same vendor, and applies the payment to it.

**Remember:**
- **Set the amount first**, then the invoice number.
- A **vendor payment** is a **positive** amount on the journal line.
- If the payment is **smaller** than the invoice, the invoice stays open with the balance. That's a partial payment, and it's fine.

---

## Way 2: One payment for many invoices

**Applies-to Doc. No.** can hold only **one** invoice number. For many invoices, we use **Applies-to ID**, which works like a tag.

**Steps:**
1. Put the same **tag** on every invoice you want to pay.
2. Put the same **tag** in **Applies-to ID** on the payment line.
3. Post. BC applies the payment to every open entry with that tag.

To put the tag, I use the same codeunit the **Apply Entries** page uses: **Vend. Entry-SetAppl.ID**. For the tag itself, I use the payment's document number, so it's easy to trace later.

```al
procedure PostPaymentForInvoices(TemplateName: Code[10]; BatchName: Code[10]; VendorNo: Code[20]; var InvoiceNos: List of [Code[20]]; BankAccountNo: Code[20]; PostingDate: Date)
var
    GenJnlLine: Record "Gen. Journal Line";
    InvoiceEntry: Record "Vendor Ledger Entry";
    EmptyEntry: Record "Vendor Ledger Entry";   // the payment isn't posted yet, so we pass an empty record
    VendEntrySetApplID: Codeunit "Vend. Entry-SetAppl.ID";
    InvoiceNo: Code[20];
    TotalToPay: Decimal;
begin
    // 1. Create the payment line (amount 0 for now), so we get its Document No.
    CreatePaymentLine(GenJnlLine, TemplateName, BatchName, VendorNo, 0, BankAccountNo, PostingDate);

    // 2. Tag each invoice with the payment's Document No.
    foreach InvoiceNo in InvoiceNos do begin
        FindOpenInvoice(InvoiceEntry, VendorNo, InvoiceNo);
        ClearOldTag(InvoiceEntry);
        VendEntrySetApplID.SetApplId(InvoiceEntry, EmptyEntry, GenJnlLine."Document No.");

        InvoiceEntry.Get(InvoiceEntry."Entry No.");
        TotalToPay += -InvoiceEntry."Amount to Apply";   // invoice amounts are negative
    end;

    // 3. Same tag on the payment line, and the total amount
    GenJnlLine.Validate(Amount, TotalToPay);
    GenJnlLine.Validate("Applies-to ID", GenJnlLine."Document No.");
    GenJnlLine.Modify(true);

    PostLine(GenJnlLine);
end;

local procedure FindOpenInvoice(var InvoiceEntry: Record "Vendor Ledger Entry"; VendorNo: Code[20]; InvoiceNo: Code[20])
begin
    InvoiceEntry.Reset();
    InvoiceEntry.SetRange("Vendor No.", VendorNo);
    InvoiceEntry.SetRange("Document Type", InvoiceEntry."Document Type"::Invoice);
    InvoiceEntry.SetRange("Document No.", InvoiceNo);
    InvoiceEntry.SetRange(Open, true);
    InvoiceEntry.FindFirst();
    InvoiceEntry.SetRange("Entry No.", InvoiceEntry."Entry No.");   // SetApplId works on the filtered records
end;

local procedure ClearOldTag(var InvoiceEntry: Record "Vendor Ledger Entry")
var
    VendEntrySetApplID: Codeunit "Vend. Entry-SetAppl.ID";
begin
    if InvoiceEntry."Applies-to ID" <> '' then
        VendEntrySetApplID.RemoveApplId(InvoiceEntry, InvoiceEntry."Applies-to ID");
    InvoiceEntry.Get(InvoiceEntry."Entry No.");
end;
```

**What `SetApplId` does** (I checked this in the base app code): it checks the entry is open, puts the tag in **Applies-to ID**, and if **Amount to Apply** is empty, fills it with the full remaining amount. So by default, each invoice is paid fully.

### To pay only part of an invoice

After tagging, change **Amount to Apply**. Don't modify the ledger entry directly. Use **Vend. Entry-Edit**, which is how BC itself edits these fields:

```al
local procedure SetAmountToApply(var InvoiceEntry: Record "Vendor Ledger Entry"; AmountToPay: Decimal)
begin
    InvoiceEntry.Get(InvoiceEntry."Entry No.");
    InvoiceEntry.CalcFields("Remaining Amount");
    InvoiceEntry.Validate("Amount to Apply", -AmountToPay);   // negative, like the invoice
    Codeunit.Run(Codeunit::"Vend. Entry-Edit", InvoiceEntry);
end;
```

---

## Way 3: Payment and invoice are already posted

This is very common. The payment was posted earlier, maybe from a bank import without any invoice number. Later, we find out which invoice it belongs to.

Now we don't post a new payment. We only post the **application**. It's the same as a user doing **Vendor Ledger Entries → Apply Entries → Post Application**. In code, that's codeunit **VendEntry-Apply Posted Entries** and its `Apply` procedure.

**Steps:**
1. Mark the **payment** as the applying entry: **Applying Entry** = Yes, a tag in **Applies-to ID**, and **Amount to Apply**.
2. Put the **same tag** on the invoice.
3. Call `Apply`.

```al
procedure ApplyPostedPaymentToInvoice(VendorNo: Code[20]; PaymentNo: Code[20]; InvoiceNo: Code[20]; AmountToApply: Decimal)
var
    PaymentEntry: Record "Vendor Ledger Entry";
    InvoiceEntry: Record "Vendor Ledger Entry";
    ApplyUnapplyParameters: Record "Apply Unapply Parameters";
    GLSetup: Record "General Ledger Setup";
    VendEntrySetApplID: Codeunit "Vend. Entry-SetAppl.ID";
    VendEntryApplyPostedEntries: Codeunit "VendEntry-Apply Posted Entries";
    ApplID: Code[50];
begin
    ApplID := 'AUTO-' + PaymentNo;

    // 1. The payment is the applying entry
    PaymentEntry.SetRange("Vendor No.", VendorNo);
    PaymentEntry.SetRange("Document Type", PaymentEntry."Document Type"::Payment);
    PaymentEntry.SetRange("Document No.", PaymentNo);
    PaymentEntry.SetRange(Open, true);
    PaymentEntry.FindFirst();
    PaymentEntry.CalcFields("Remaining Amount");
    PaymentEntry."Applying Entry" := true;
    PaymentEntry."Applies-to ID" := ApplID;
    PaymentEntry.Validate("Amount to Apply", AmountToApply);   // positive, like the payment
    Codeunit.Run(Codeunit::"Vend. Entry-Edit", PaymentEntry);

    // 2. Same tag on the invoice
    FindOpenInvoice(InvoiceEntry, VendorNo, InvoiceNo);
    ClearOldTag(InvoiceEntry);
    VendEntrySetApplID.SetApplId(InvoiceEntry, PaymentEntry, ApplID);
    SetAmountToApply(InvoiceEntry, AmountToApply);

    // 3. Post the application
    PaymentEntry.Get(PaymentEntry."Entry No.");
    ApplyUnapplyParameters.CopyFromVendLedgEntry(PaymentEntry);
    ApplyUnapplyParameters."Posting Date" := VendEntryApplyPostedEntries.GetApplicationDate(PaymentEntry);

    GLSetup.Get();
    if GLSetup."Journal Templ. Name Mandatory" then begin
        ApplyUnapplyParameters."Journal Template Name" := GLSetup."Apply Jnl. Template Name";
        ApplyUnapplyParameters."Journal Batch Name" := GLSetup."Apply Jnl. Batch Name";
    end;

    VendEntryApplyPostedEntries.Apply(PaymentEntry, ApplyUnapplyParameters);
end;
```

**Which date is used?** `GetApplicationDate` takes the **latest posting date** of the tagged entries. If the payment is dated 10 October and the invoice 15 October, the application is posted on 15 October.

---

## Mistakes I learned to avoid

**1. `SetApplId` works like an on/off switch.**
This surprised me when I read the base code. If the entry **already has** a tag, `SetApplId` **removes** it instead of setting it. It's the same as clicking **Set Applies-to ID** twice on the page. So if an old tag is left on the invoice, your code removes it, and nothing gets applied. That's why I always clear the old tag first.

**2. Don't fill both fields on one line.**
A journal line should use **either** Applies-to Doc. No. **or** Applies-to ID, never both. Otherwise posting gives an error.

**3. `Apply` saves (commits) the data.**
In Way 3, the `Apply` procedure calls `Commit()` at the end. So don't call it in the middle of a bigger process that you want to undo completely if something fails.

**4. "No entries applied" error.**
If BC finds nothing to apply, `Apply` gives an error that mentions **Applies-to ID**. Usually the tag is wrong, or the amounts have the wrong sign.

**5. Clean up if something fails.**
If your code fails after tagging, the tags stay on the entries. The next user who opens **Apply Entries** will see them already selected. Clear them with `RemoveApplId`.

**6. Check the vendor's Application Method.**
If it's **Apply to Oldest**, a payment posted without any invoice number is applied automatically to the oldest open invoices.

---

## For customers, use the same steps

Just use the customer objects. And remember the signs are opposite: a customer **invoice** is positive and a **payment** is negative.

| For vendors | For customers |
|---|---|
| Vendor Ledger Entry | Cust. Ledger Entry |
| Vend. Entry-SetAppl.ID | Cust. Entry-SetAppl.ID |
| Vend. Entry-Edit | Cust. Entry-Edit |
| VendEntry-Apply Posted Entries | CustEntry-Apply Posted Entries |

---

## How to test

1. Apply a **full** payment and check that both entries are closed.
2. Apply a **part** payment and check that the invoice stays open with the balance.
3. Open **Detailed Vendor Ledg. Entries** and look for the **Application** row.
4. **Unapply** it from the ledger entries, to make sure it works like a normal application.
5. **India:** if your payments have **TDS**, test carefully in a sandbox. The India localization adds its own logic during application.

## In short

- **Not posted yet, one invoice:** use **Applies-to Doc. No.** on the payment line.
- **Not posted yet, many invoices:** tag the invoices and the line with the same **Applies-to ID**.
- **Already posted:** tag both entries and call **VendEntry-Apply Posted Entries**.

If you can, apply while posting (Way 1 or 2). Then the payment and the application succeed or fail together.

Do you apply payments in a different way? Tell me in the comments.

---

**Sources**

- Business Central base app code (BC 25): Vend. Entry-SetAppl.ID, Vend. Entry-Edit, VendEntry-Apply Posted Entries, Gen. Jnl.-Post Line, and the Apply Vendor Entries page
- Microsoft Learn: [Reconcile vendor payments with the payment journal or from vendor ledger entries](https://learn.microsoft.com/dynamics365/business-central/payables-how-apply-purchase-transactions-manually)
- Microsoft Learn: [Apply payments automatically and reconcile bank accounts](https://learn.microsoft.com/dynamics365/business-central/receivables-apply-payments-auto-reconcile-bank-accounts)
