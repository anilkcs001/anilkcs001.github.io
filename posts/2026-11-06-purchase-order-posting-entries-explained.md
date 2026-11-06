---
title: What happens when you post a purchase in Business Central? Every entry, step by step
date: 2026-11-06
type: feature
tags: Business Central, Purchase, Finance Basics, Functional, GST, TDS, India
summary: Purchase posting explained for developers with zero finance background. We start with the simplest purchase (one G/L line, no tax), then add GST, then an item, then mix both, then TDS and reverse charge. One small step at a time, with every entry BC creates and why.
---

You click **Post → Receive**. Nothing comes in the G/L.

Then you click **Post → Invoice**. Suddenly many G/L entries come.

And someone from finance asks: "Why did it go to this account?"

For a long time I used to say "it's from the posting setup" and escape. But one day the finance person asked "which setup, which field?" and I had no proper answer. I'm a developer, I never studied accounts. So I sat and learned it from zero.

This post is for people like me. **If you don't know finance at all, that's fine.** We'll start with the smallest possible purchase and add one thing at a time:

1. Debit and credit, the developer way
2. **G/L line only**, no tax (the easiest)
3. G/L line **with GST**
4. **Item only**, no tax
5. Item **with GST**
6. **Both lines together** (a real purchase order)
7. How BC knows which account
8. Add **TDS**
9. **Reverse charge**

Don't jump. Each step uses the previous one.

---

## 1. Debit and credit, the developer way

Forget the textbooks for a minute. Here is all you need.

### Rule 1: every entry has two sides

Value always moves **from somewhere, to somewhere**. Like a bank transfer: money leaves one account and reaches another. It can't just appear.

- **Debit (Dr)** = where the value **went**
- **Credit (Cr)** = where the value **came from**

### Rule 2: both sides are always equal

Total debit = total credit. Always.

In Business Central, the G/L Entries page has one **Amount** column:

- **Plus (+)** = debit
- **Minus (−)** = credit

So for any one transaction, **SUM(Amount) = 0**. If you're a developer, that's the easiest way to remember it. If the sum isn't zero, BC won't even let you post.

### Rule 3: what goes up with debit, what goes up with credit

| Type of account | Example | Goes up with |
|---|---|---|
| **Asset** (what we have) | Stock, bank, GST receivable | **Debit** |
| **Expense** (what we spent) | Rent, repairs, salary | **Debit** |
| **Liability** (what we owe) | Vendor, TDS payable, GST payable | **Credit** |
| **Income** (what we earned) | Sales | **Credit** |

That's enough to understand everything in this post.

> If you studied commerce, you know the golden rules: *debit the receiver, credit the giver; debit what comes in, credit what goes out; debit expenses, credit income.* Same thing, other words.

### One word you'll hear: Sundry Creditors

**Sundry creditors** = all the vendors we owe money to, added together. In BC it's the **Payables account** in the Vendor Posting Group. Same thing, different name.

---

## 2. Easiest case: one G/L line, no tax

Our company gets the office printers serviced. The service vendor sends a bill:

| | Amount |
|---|---|
| Printer maintenance (AMC) | ₹40,000 |
| **Total** | **₹40,000** |

Assume no GST for now. We'll add it in the next step.

In BC we create a **Purchase Invoice** with one line:

- Type: **G/L Account**
- No.: **Printer Maintenance Expense**
- Amount: ₹40,000

### Ask the two questions

**Where did the value go?** We got a service. We spent on maintenance. That's an **expense**.
**Where did it come from?** The vendor gave it to us, and we haven't paid yet. So now we **owe** the vendor.

### G/L entries

| G/L Account | Debit | Credit |
|---|---|---|
| Printer Maintenance Expense | 40,000 | |
| Vendor Payables (Sundry Creditors) | | 40,000 |

Expense goes up → debit. What we owe goes up → credit. Sum = 0. ✓

### Other entries

**Vendor Ledger Entry:** Amount **−40,000**. Minus means credit: we owe him ₹40,000. It's **Open** because we haven't paid.

**Item Ledger Entry:** none. A service is not stock. There's nothing to keep in the store.

### When we pay

Accounts team pays ₹40,000 from the bank.

**Where did the value go?** To the vendor. Now we owe him nothing.
**Where did it come from?** Our bank.

| G/L Account | Debit | Credit |
|---|---|---|
| Vendor Payables | 40,000 | |
| Bank | | 40,000 |

We owe less → debit the vendor. Bank balance goes down → credit the bank.

Apply the payment to the invoice, and the vendor ledger entry becomes **closed**. Vendor balance: zero.

### Where did BC get these accounts?

- **Printer Maintenance Expense**: from the line itself. You selected it in the **No.** field. Easy.
- **Vendor Payables**: from the vendor card → **Vendor Posting Group** (for example DOMESTIC) → **Payables Account**.

That's it. That's the simplest purchase in BC.

---

## 3. Same G/L line, now with GST

Same bill, but now the vendor is GST registered and in the same state, so he adds **18% GST** (9% CGST + 9% SGST):

| | Amount |
|---|---|
| Printer maintenance (AMC) | ₹40,000 |
| CGST 9% | ₹3,600 |
| SGST 9% | ₹3,600 |
| **Total** | **₹47,200** |

Now we owe the vendor **₹47,200**. But that extra ₹7,200 GST is **not our expense**. The government gives it back to us as **input credit** (we use it to reduce the GST we pay on our sales).

So for us, the ₹7,200 is like money the government owes us. That's an **asset**: **GST Receivable**.

### G/L entries

| G/L Account | Debit | Credit |
|---|---|---|
| Printer Maintenance Expense | 40,000 | |
| CGST Receivable | 3,600 | |
| SGST Receivable | 3,600 | |
| Vendor Payables | | 47,200 |
| **Total** | **47,200** | **47,200** |

Compare with step 2:

- Expense is **still ₹40,000**. GST didn't make the service costlier for us.
- Two new lines: **CGST and SGST Receivable**, debit (asset goes up).
- Vendor is credited the **full bill**, ₹47,200, because we have to pay him everything.

### New entries

BC India also creates **GST Ledger Entries** and **Detailed GST Ledger Entries** (one for CGST, one for SGST). Your GST returns and reconciliation reports are built from these.

### Where did the GST accounts come from?

**GST Posting Setup** → the row for our **location's state** + component (CGST, SGST) → **Receivable Account**.

> **What if we can't take the credit?** For some purchases, the law doesn't allow input credit. Then the line's **GST Credit** is set to **Non-Availment**, and there's no receivable. The GST just adds to the expense: Printer Maintenance Expense **47,200** Dr, Vendor **47,200** Cr.

---

## 4. Item only, no tax

Now something different. We buy **printer toner cartridges** and keep them in the store. The office uses them over the next few months.

| | Amount |
|---|---|
| Toner cartridge, 10 × ₹2,000 | ₹20,000 |
| **Total** | **₹20,000** |

No GST for now.

This time we use a **Purchase Order** with one line:

- Type: **Item**
- No.: **TONER**
- Quantity: 10, Direct Unit Cost: ₹2,000

### Why is an item different from a G/L line?

A service is used immediately. It's an expense the same day.

An item **sits in the store**. Today it's not an expense, it's **stock** (also called **inventory**). Stock is something we **have**, so it's an **asset**. It becomes an expense only later, when we use it or sell it.

Also, with items, BC has **two steps**: the goods come first, the bill comes later. So BC posts in two steps too.

### Step A: Post → Receive

The boxes reach the store. The storekeeper counts 10. We post **Receive**.

**Item Ledger Entry:**

| Field | Value |
|---|---|
| Entry Type | Purchase |
| Quantity | 10 |
| Invoiced Quantity | 0 |
| Cost Amount (Expected) | 20,000 |
| Cost Amount (Actual) | 0 |

**Value Entry** (one): Cost Amount (Expected) 20,000.

See the word **Expected**. BC is saying: "10 boxes came. I think the cost is ₹20,000, but the bill hasn't come yet. So I'm not sure. Let me call it expected."

**G/L entries: none.** No vendor ledger entry either. The vendor hasn't billed us yet, so officially we don't owe him anything.

This surprises many people. Goods came, but finance sees nothing? Yes, by default. BC touches the G/L only when the invoice comes.

> There is a setting, **Inventory Setup → Expected Cost Posting to G/L**. If it's on, the receipt also posts to two "waiting" accounts: **Inventory Account (Interim)** Dr 20,000, **Invt. Accrual Acc. (Interim)** Cr 20,000. These get reversed when the invoice is posted. Most companies leave it off.

### Step B: Post → Invoice

The vendor's bill comes. ₹20,000. We post **Invoice**.

**Item Ledger Entry** (the same entry, now updated):

| Field | After receive | After invoice |
|---|---|---|
| Quantity | 10 | 10 |
| Invoiced Quantity | 0 | **10** |
| Cost Amount (Expected) | 20,000 | **0** |
| Cost Amount (Actual) | 0 | **20,000** |

The cost moved from **expected** to **actual**. A second **Value Entry** does this move.

> **Tip for developers:** the Item Ledger Entry doesn't store cost itself. Its cost fields are the sum of its **Value Entries**. That's why one item ledger entry can have many value entries: receipt, invoice, and later freight charges, revaluation and so on.

**Vendor Ledger Entry:** −20,000. We owe him.

**G/L entries:**

| # | G/L Account | Debit | Credit |
|---|---|---|---|
| 1 | Purchase Account | 20,000 | |
| 2 | Vendor Payables | | 20,000 |
| 3 | Inventory | 20,000 | |
| 4 | Direct Cost Applied | | 20,000 |
| | **Total** | **40,000** | **40,000** |

Four lines for a ₹20,000 purchase? Don't worry. Let's read them in two pairs.

**Pair 1 (lines 1 and 2): the vendor side.**
We purchased something, and we owe the vendor. Same pattern as step 2, just with **Purchase Account** instead of an expense account.

**Pair 2 (lines 3 and 4): the stock side.**
Our store now has ₹20,000 more stock. **Inventory** goes up → debit.

**Now see lines 1 and 4 together.** Purchase Account **Dr 20,000** and Direct Cost Applied **Cr 20,000**. Both are profit-and-loss accounts, same amount, opposite sides. **They cancel each other.**

So what's really left after cancelling?

| G/L Account | Debit | Credit |
|---|---|---|
| Inventory | 20,000 | |
| Vendor Payables | | 20,000 |

That's the real meaning: **stock went up, and we owe the vendor**. Not an expense yet.

Why does BC do it in this long way? Because it keeps two jobs separate. The **purchase posting** handles the vendor side. The **inventory posting** handles the stock value. Some companies point Purchase Account and Direct Cost Applied to the **same G/L account**, so they cancel inside one account.

> **Lines 3 and 4 come immediately only if Inventory Setup → Automatic Cost Posting is on.** If it's off, they come later, when someone runs **Post Inventory Cost to G/L**. Until then you'll see only lines 1 and 2. If stock value in the G/L doesn't match the inventory report, check this first.

### Where did BC get these accounts?

Now it's not one line, so BC uses three setups:

| G/L Account | Setup | Which row |
|---|---|---|
| Vendor Payables | **Vendor Posting Group** → Payables Account | Vendor's *Vendor Posting Group* |
| Purchase Account | **General Posting Setup** → Purch. Account | Vendor's *Gen. Bus. Posting Group* + Item's *Gen. Prod. Posting Group* |
| Direct Cost Applied | **General Posting Setup** → Direct Cost Applied Account | Same row as above |
| Inventory | **Inventory Posting Setup** → Inventory Account | Document's *Location* + Item's *Inventory Posting Group* |

Read it like this:

- Vendor card says Gen. Bus. Posting Group = **DOMESTIC**. Item card says Gen. Prod. Posting Group = **RETAIL**. So BC opens General Posting Setup row **DOMESTIC + RETAIL** and picks Purch. Account and Direct Cost Applied Account from there.
- Item card says Inventory Posting Group = **CONSUMABLES**. Purchase order's location is **HYD**. So BC opens Inventory Posting Setup row **HYD + CONSUMABLES** and picks Inventory Account.

If that row doesn't exist, you get the famous error *"General Posting Setup does not exist"* or *"Inventory Posting Setup does not exist"*. Now you know why.

---

## 5. Item with GST

Same toner, now with 18% GST:

| | Amount |
|---|---|
| Toner cartridge, 10 × ₹2,000 | ₹20,000 |
| CGST 9% | ₹1,800 |
| SGST 9% | ₹1,800 |
| **Total** | **₹23,600** |

**Receive:** exactly the same as step 4. No GST at receipt. GST comes only with the invoice.

**Invoice, G/L entries:**

| # | G/L Account | Debit | Credit |
|---|---|---|---|
| 1 | Purchase Account | 20,000 | |
| 2 | CGST Receivable | 1,800 | |
| 3 | SGST Receivable | 1,800 | |
| 4 | Vendor Payables | | 23,600 |
| 5 | Inventory | 20,000 | |
| 6 | Direct Cost Applied | | 20,000 |
| | **Total** | **43,600** | **43,600** |

Nothing new here. It's step 4 plus the two GST lines from step 3.

Notice: **stock value is ₹20,000, not ₹23,600**. Because we get the GST back as credit, it's not part of the toner's cost. (If GST Credit is Non-Availment, then the GST is added to the cost, and stock value becomes ₹23,600.)

---

## 6. Now the real thing: both lines in one order

Now you're ready for a normal purchase order. One vendor, **two lines**: the toner (item) and the maintenance (G/L account), with GST.

### The vendor's bill

| | Amount |
|---|---|
| Toner cartridge, 10 × ₹2,000 | ₹20,000 |
| Printer maintenance (AMC) | ₹40,000 |
| **Taxable value** | **₹60,000** |
| CGST 9% | ₹5,400 |
| SGST 9% | ₹5,400 |
| **Bill total** | **₹70,800** |

### Post → Receive

| Line | What gets created |
|---|---|
| Toner (item) | Item Ledger Entry + Value Entry, cost **expected** ₹20,000 |
| AMC (G/L) | Nothing. Just "1 received, not invoiced" on the receipt line |
| G/L, vendor, GST | **Nothing** (by default) |

### Post → Invoice

**Vendor Ledger Entry:** one entry, **−70,800**. One bill, one vendor entry, even though there are two lines.

**Item Ledger Entry:** the toner's entry becomes **actual** ₹20,000.

**Detailed GST Ledger Entries:** one per line per component:

| Line | Component | GST Base | GST Amount |
|---|---|---|---|
| Toner | CGST | 20,000 | 1,800 |
| Toner | SGST | 20,000 | 1,800 |
| AMC | CGST | 40,000 | 3,600 |
| AMC | SGST | 40,000 | 3,600 |

**G/L entries:**

| # | G/L Account | Debit | Credit | Came from |
|---|---|---|---|---|
| 1 | Purchase Account | 20,000 | | Toner (step 4) |
| 2 | Printer Maintenance Expense | 40,000 | | AMC (step 2) |
| 3 | CGST Receivable | 5,400 | | 1,800 + 3,600 |
| 4 | SGST Receivable | 5,400 | | 1,800 + 3,600 |
| 5 | Vendor Payables | | 70,800 | Full bill |
| 6 | Inventory | 20,000 | | Toner, stock side |
| 7 | Direct Cost Applied | | 20,000 | Toner, stock side |
| | **Total** | **90,800** | **90,800** | |

See? There is **nothing new** in this table. Every line is something you already saw:

- Toner lines → step 4 and 5
- AMC line → step 2 and 3
- GST lines → both lines' GST added together (in your G/L you may see them as one line per account or one per purchase line, it depends on the setup, but the total is the same)
- Vendor → one total for the full bill

That's why we went step by step. The "big" posting is just small postings added together.

### Summary: receive vs invoice

| | Receive | Invoice |
|---|---|---|
| Posted document | Purchase Receipt | Purchase Invoice |
| Item Ledger Entry | Created, cost **expected** | Same entry, cost becomes **actual** |
| Value Entry | 1 (expected) | 1 more (actual) |
| Vendor Ledger Entry | — | Created |
| GST entries | — | Created |
| G/L Entries | None (by default) | Created |
| G/L account line | Only received quantity | Expense + GST + vendor |

---

## 7. The full map: which account comes from where

Everything in one table. Keep this handy for troubleshooting.

| G/L Account | Comes from | Picked by |
|---|---|---|
| Vendor Payables | **Vendor Posting Group** → Payables Account | Vendor: *Vendor Posting Group* |
| Expense (G/L line) | **The line itself** | Purchase line: *No.* |
| Purchase Account | **General Posting Setup** → Purch. Account | Vendor *Gen. Bus.* + Item *Gen. Prod. Posting Group* |
| Direct Cost Applied | **General Posting Setup** → Direct Cost Applied Account | Same |
| Inventory | **Inventory Posting Setup** → Inventory Account | *Location* + Item *Inventory Posting Group* |
| CGST/SGST/IGST Receivable | **GST Posting Setup** → Receivable Account | Location's *State* + GST component |
| TDS Payable | **TDS Posting Setup** → TDS Account | Line's *TDS Section* |

Real-life problems this map solves:

- **Vendor balance going to the wrong control account** → Vendor Posting Group on the vendor card
- **Purchase going to the wrong account** → General Posting Setup for that bus. + prod. combination
- **One warehouse's stock in the wrong account** → Inventory Posting Setup for that location
- **"Posting Setup does not exist" error** → someone created a new posting group and forgot the setup row
- **GST in the wrong state's account** → the location's State Code

---

## 8. Add TDS

Back to the maintenance bill from step 3 (₹40,000 + GST ₹7,200 = ₹47,200).

### What is TDS?

**TDS = Tax Deducted at Source.** For some payments (contractors, professionals, rent and so on), the income tax law says: **cut a small part of the payment and pay it to the government for the vendor.** The vendor later gets credit for it in his own income tax return.

So the vendor doesn't get the full bill from us. He gets the bill **minus TDS**. The TDS part goes to the government.

Maintenance is contract work. For contract work, TDS is **2%** if the vendor is a company (1% for an individual). In the old Income-tax Act this was **section 194C**. From **1 April 2026**, the new **Income-tax Act, 2025** applies and TDS comes under **section 393**, but most people still say "194C". TDS applies when a single bill crosses ₹30,000 (or the year's total crosses ₹1,00,000). Our bill is ₹40,000, so TDS applies.

TDS is calculated on the amount **without GST** (when GST is shown separately on the bill):

> TDS = 2% × ₹40,000 = **₹800**

### G/L entries

| G/L Account | Debit | Credit |
|---|---|---|
| Printer Maintenance Expense | 40,000 | |
| CGST Receivable | 3,600 | |
| SGST Receivable | 3,600 | |
| Vendor Payables | | **46,400** |
| **TDS Payable** | | **800** |
| **Total** | **47,200** | **47,200** |

Compare with step 3. Only one thing changed: **who we owe**.

- Before: we owed the vendor ₹47,200.
- Now: we owe the vendor **₹46,400**, and we owe the government **₹800**.

Expense and GST are exactly the same. The ₹800 just moved from the vendor's line to the TDS line. TDS Payable is something we owe, a liability → credit.

BC also creates a **TDS Entry**. It's used for the TDS return and the TDS certificate (Form 16A) we give the vendor.

Later we pay the TDS to the government (by the 7th of next month in most cases):

| G/L Account | Debit | Credit |
|---|---|---|
| TDS Payable | 800 | |
| Bank | | 800 |

### If TDS doesn't calculate, check

- Vendor card: **PAN** and **Assessee Code** (no PAN means a much higher rate)
- Vendor → **Allowed Sections**: the TDS section is added for this vendor
- Purchase line: **TDS Section Code** is filled
- **Tax Types → TDS → Tax Rates**: a rate exists for that section + assessee code + date
- **TDS Posting Setup**: a TDS account for that section

---

## 9. Reverse charge

Last one. This is different, so let's take a fresh, simple bill.

We hire an **advocate** for a legal case. Fee: **₹60,000**.

- Legal services by an advocate come under GST **reverse charge (RCM)** at 18%. This means **we** pay the GST to the government, not the advocate.
- It's a professional fee, so **TDS at 10%** also applies.

### The advocate's bill

| | Amount |
|---|---|
| Professional fee | ₹60,000 |
| GST | — |
| **Total** | **₹60,000** |

No GST on his bill. That's normal for RCM.

### The numbers

- GST we must pay: 18% × ₹60,000 = **₹10,800** (CGST ₹5,400 + SGST ₹5,400)
- TDS: 10% × ₹60,000 = **₹6,000**
- Advocate gets: ₹60,000 − ₹6,000 = **₹54,000**

### G/L entries

| # | G/L Account | Debit | Credit |
|---|---|---|---|
| 1 | Legal Fees (expense) | 60,000 | |
| 2 | CGST Receivable (Interim) | 5,400 | |
| 3 | SGST Receivable (Interim) | 5,400 | |
| 4 | CGST Payable (Interim) | | 5,400 |
| 5 | SGST Payable (Interim) | | 5,400 |
| 6 | TDS Payable | | 6,000 |
| 7 | Vendor Payables | | 54,000 |
| | **Total** | **70,800** | **70,800** |

Read it slowly:

- **Line 1:** the expense. ₹60,000, same as always.
- **Lines 4 and 5, GST Payable:** we owe ₹10,800 GST to the government. Something we owe → credit.
- **Lines 2 and 3, GST Receivable:** but we also get the same ₹10,800 back as input credit. Something we'll get → debit.
- **Line 6:** TDS we owe the government.
- **Line 7:** the advocate gets only ₹54,000. **No GST in the vendor's amount**, because he's not the one paying GST.

**Why "Interim"?** For RCM services, BC ties the final GST liability and credit to the **payment** to the vendor (under GST law, the tax point for RCM services depends on the payment date). So BC first keeps them in "waiting" (interim) accounts.

### When we pay the advocate

We pay ₹54,000 and apply it to the invoice. BC then moves the GST from the interim accounts to the real ones:

- CGST/SGST **Payable (Interim) → Payable**. Now we really owe it.
- CGST/SGST **Receivable (Interim) → Receivable**. Now we can really use the credit.

In the monthly **GST settlement**, we pay the ₹10,800 RCM GST **in cash** (RCM GST can't be paid using credit). The ₹10,800 receivable is used as normal input credit.

Final cost to the company: **₹60,000**. The GST went out and came back. But the cash had to go out first.

### What if the vendor is just unregistered (and it's not an RCM case)?

Then there's no GST at all. No receivable, no payable. It's exactly like **step 2**: expense and vendor (minus TDS, if TDS applies).

---

## 10. All cases side by side

For a ₹40,000 service, 18% GST, TDS 2%:

| Case | Expense | GST Receivable | GST Payable | TDS Payable | Vendor gets |
|---|---|---|---|---|---|
| No GST (step 2) | 40,000 | — | — | — | 40,000 |
| With GST (step 3) | 40,000 | 7,200 | — | — | 47,200 |
| GST, Non-Availment | 47,200 | — | — | — | 47,200 |
| GST + TDS (step 8) | 40,000 | 7,200 | — | 800 | 46,400 |
| Reverse charge + TDS | 40,000 | 7,200 (interim) | 7,200 (interim) | 800 | 39,200 |
| Unregistered, no RCM, + TDS | 40,000 | — | — | 800 | 39,200 |

---

## What I want you to remember

- **Debit = where the value went. Credit = where it came from.** In BC, plus is debit, minus is credit, and the sum is always zero.
- A **G/L line** is an expense the same day. An **item** becomes **stock** first.
- **Receive** creates only item ledger and value entries, with **expected** cost. No G/L, no vendor, no GST (by default).
- **Invoice** creates everything: vendor ledger, GST entries, G/L entries, and makes the cost **actual**.
- **Purchase Account and Direct Cost Applied cancel each other.** What's left is Inventory.
- **GST with credit** is not a cost. It's a **receivable**.
- **TDS** doesn't change the expense. It only splits what we owe between the vendor and the government.
- **Reverse charge:** the vendor gets no GST. We book the GST as both payable and receivable.
- Every account comes from a setup. Use the map in section 7.

Next time finance asks "why did it go to this account?", open **Find Entries** on the posted invoice, look at the G/L entries, and walk the map. You'll have the answer in two minutes.

*Account names and setups differ in every company, and tax rules keep changing. Always check with your finance team or CA before changing posting setup in production. If I missed a scenario you see often, tell me in the comments.*

---

### Sources

- [Purchase from registered vendors (GST G/L entries), Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/gst-purchase-from-registered-vendor)
- [Calculation of TDS and GST on purchase transactions, Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/gst-tds-and-gst-on-purchase)
- [GST on advance or normal payment application with purchase invoice, Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/gst-advance-normal-payment-and-purchase-invoice-goods-application)
- [Set up goods and services tax, Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/gst-001-basic-setup)
- [Set up TDS, Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/tds-overview)
- [TDS calculation on purchase and payment transactions, Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/tds-transactions)
- Business Central base application source (v25): codeunit **Inventory Posting To G/L** (5802), procedure `BufferPurchPosting`, and codeunit **Purch. Post Invoice**, procedure `GetPurchAccount`
- [Section 393 of the Income-tax Act, 2025, India Briefing](https://www.india-briefing.com/news/section-393-income-tax-act-2025-tds-rules-rates-compliance-guide-44450.html)
- [TDS rewritten: Income Tax Act 1961 vs 2025, CA Surekha Ahuja](https://www.casahuja.com/2026/04/tds-rewritten-income-tax-act-1961-vs.html)
