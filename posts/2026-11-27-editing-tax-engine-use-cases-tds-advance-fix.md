---
title: "Editing Tax Engine use cases in Business Central India: a real TDS gap with GST advances, and how I fixed it"
date: 2026-11-27
type: solution
tags: Tax Engine, TDS, GST, India, Use Case, Business Central
summary: The Tax Engine lets you change GST and TDS logic without AL code, by editing use cases. I'll show both ways to edit them, the designer and the JSON, using a real gap I found in the standard TDS use case. When a GST-inclusive advance is applied to an invoice, the standard logic reduces the TDS base by the GST too, so TDS is deducted short. I'll explain the gap with simple numbers, the fix, and how not to lose your change after a BC upgrade.
---

Most people think GST and TDS calculation in Business Central India is "standard, don't touch". But a lot of it is not AL code at all. It is **configuration** inside the **Tax Engine**, written as **use cases**. And use cases can be changed.

That is powerful, and also a little dangerous. So in this post I'll explain:

1. what a use case is, in simple words,
2. the two ways to edit one (the designer and the JSON),
3. a real gap I found in the standard TDS use case,
4. how I fixed it, with numbers,
5. and how to keep your fix safe when Business Central is upgraded.

---

## What is a use case?

In BC India, GST, TDS and TCS are all calculated by one engine: the **Tax Engine**. For each situation, there is a **use case**, a small recipe that says:

- **When does it apply?** These are the conditions: tax type, document type, vendor type, whether a PAN is there, whether Applies-to ID is used, and so on.
- **Where do values come from?** This is attribute mapping. For example, the HSN code comes from the Item, or from the G/L Account when Type is G/L Account.
- **How is it calculated?** These are the steps and formulas. For example, `TDS = TDS Base × TDS % / 100`.
- **How is it posted?** This is the posting setup: which account, debit or credit.

There are hundreds of use cases, one per scenario. For example: *"Calculation of TDS on Vendor Invoice where PAN No. is specified, without Concessional Codes, with Applies-to ID."* That long name is actually one use case, and it is the one this post is about.

---

## Two ways to edit a use case

### Way 1: the designer (on screen, no code)

The designer lets you change:

- **conditions**, meaning when the use case runs,
- **attribute mapping**, meaning where a value is read from,
- **rate lookup columns**, for example adding one more condition so the same HSN code can get a different rate,
- **component formulas**, for example `CGST = Line Amount × CGST% / 100`.

The important part is the **order of steps**. If you skip one, you lose your rates.

1. Create a **derived configuration** from the standard one. The standard stays untouched.
2. Open it in the **Designer** and make your change.
3. Change the status from **Draft** to **Complete** and give it a version name.
4. Go to **Tax Configurations**, create a new one and select your version.
5. Set **"Copy tax setup from" = Yes** and pick the last working configuration.

> If you forget step 5, the new configuration comes **without** your tax rates, HSN/SAC rates and RCM setup. Many people hit this and think the change "broke GST".

### Way 2: export, edit the JSON, import

Every use case can be exported as a **JSON file**. Inside you see everything: conditions, variables, every calculation step and the posting script. For bigger changes, like fixing the logic itself, this is the way I use.

1. **Export Use Case** and keep the file as a backup.
2. **Disable** the use case. An enabled use case cannot be changed.
3. Edit the JSON.
4. **Import Use Case**. If the CaseID is the same, it replaces the existing case and does not add a second one.
5. Run **Validate Use Case**, then **Enable** it.

This is exactly what I did for the TDS fix below.

---

## The real gap: TDS on an invoice when a GST advance is applied

### The business situation

This is very common in Indian companies:

1. You pay a vendor an **advance** of **₹1,18,000**, which is ₹1,00,000 for the service plus ₹18,000 GST.
2. TDS is deducted on the advance. As per the CBDT guidance, when GST is shown separately, TDS is on the amount **without GST**, so the advance's **TDS base is ₹1,00,000**.
3. Later the vendor's **invoice** comes, and you apply part of the advance to it using **Applies-to ID**.

Because TDS was already deducted on the advance part, the invoice's TDS base must be reduced by **the TDS base of the advance part you applied**. That is the GST-free amount, not the full payment.

### What the standard use case does

Inside the use case, there is a block called *"Get applied amount"*. It loops through the applied vendor ledger entries and does two things:

- it reads the advance's **TDS Base Amount** from the TDS Entry, which is the correct, GST-free figure, and adds it to `AppliedAmount`,
- it also adds the raw **Amount to Apply** (the full payment, GST included) to `AppliedAmountSum`.

Then, right after the loop, comes this line:

```
AppliedAmount = AppliedAmount - (AppliedAmount - AppliedAmountSum)
```

Do the maths: `A - (A - B)` is just `B`. So the line really means:

```
AppliedAmount = AppliedAmountSum
```

The correct TDS base it just read is **thrown away**, and the gross amount with GST is used instead. Every step after that reduces the invoice's TDS base by the **GST-inclusive** amount.

### With simple numbers

Advance: ₹1,18,000 (base ₹1,00,000 + GST ₹18,000). Invoice: ₹80,000. You apply **₹59,000**, which is half of the advance.

| | Standard use case | Correct |
|---|---|---|
| Amount taken off the invoice's TDS base | ₹59,000 (gross, with GST) | ₹50,000 (half of the advance's ₹1,00,000 base) |
| Invoice TDS base | 80,000 − 59,000 = **₹21,000** | 80,000 − 50,000 = **₹30,000** |
| TDS at, say, 2% | ₹420 | ₹600 |

So TDS is **deducted short by ₹180** on this one invoice. That is the GST part (₹9,000) × 2%. On real volumes with many vendors and many advances, this adds up. A short deduction means interest and notices later, and the books don't match Form 26AS.

---

## The fix

### The idea

When you apply part of an advance, you have used up the same part of its TDS base. So inside the loop, for each applied advance:

```
Applied base portion = TDS Base Amount of the advance
                       × Amount to Apply
                       ÷ Amount of the advance
```

In the example: `1,00,000 × 59,000 ÷ 1,18,000 = 50,000`. That is exactly the base that already had TDS.

And the buggy line `AppliedAmount - (AppliedAmount - AppliedAmountSum)` is removed.

**Why this is safe for all setups**

- If the advance has **no GST**, the ratio is 1:1, so nothing changes from before.
- If the company uses **"Include GST in TDS Base" = Yes**, the advance's stored base already includes GST (₹1,18,000), and the same formula gives ₹59,000. That is correct for that setup too.
- If the user sets Applies-to ID but leaves **Amount to Apply** empty, BC applies the remaining amount. So the fix uses the full ledger entry amount in that case, instead of dividing by zero.

### What I changed in the JSON

- added two variables, `VLEAmount` and `AppliedBasePortion`,
- added the **Amount** field to the vendor ledger entry loop, so the ratio can be calculated,
- added the guard for an empty Amount to Apply,
- calculated the pro-rated base inside the loop,
- removed the line that replaced the base with the gross amount.

### Two more small bugs I found while I was inside

When you read a use case JSON line by line, you find other things too:

1. **The date filter in the posting script was the wrong way round.** The start and end dates of the fiscal year were swapped, building a range like `31-03-2026..01-04-2025`. That matches nothing, so the **Invoice Amount** written on the TDS Entry came out as zero. The same expression in the calculation part was already right, so I made the posting part match it.
2. **Foreign currency invoices skipped one value.** A variable used for the threshold total (`PositiveAmountLCYExclThisLine`) was only set for rupee documents. On an invoice in USD or EUR it stayed zero, so the threshold total for multi-line invoices was wrong. I set it in the foreign currency branch too, divided by the Currency Factor, the same way the other LCY amounts are converted.

### What you should get after the fix

Same advance: ₹1,18,000, with a base of ₹1,00,000.

| Invoice | Applied | TDS base on invoice |
|---|---|---|
| ₹50,000 + ₹9,000 GST | ₹59,000 | **0** (₹50,000 base was already covered by the advance) |
| ₹80,000 | ₹59,000 | **₹30,000** |
| ₹1,20,000 | full ₹1,18,000 | **₹20,000** |
| ₹80,000, with a ₹1,00,000 advance with no GST, applying ₹40,000 | ₹40,000 | **₹40,000** (same as standard: no regression) |

Test with a TDS section where the threshold is already crossed, so you see the numbers directly. Also post one multi-line foreign currency invoice and check the **Invoice Amount** column on the TDS Entries for the other two fixes.

---

## Don't lose your fix after an upgrade

This part is as important as the fix itself.

- **Per company.** Use cases are stored per company. Import the corrected one in **every company**, in Dev, UAT and Prod.
- **Upgrades can bring the standard version back.** This use case is delivered by Microsoft. When the TDS tax type is imported again during a BC update, your in-place change can be overwritten **without any warning**.
- **The safer way:** give your corrected copy a **new CaseID (a new GUID)** and a **lower Presentation Order**, so it is checked before the standard one. Import it as a new use case and **disable** the Microsoft one. Now an update can bring the standard case back, but yours still runs first. After every BC update, check that the standard one is still disabled.
- **Check the sibling use cases.** The same `AppliedAmountSum` line very likely exists in the *Applies-to Doc. No.* version and in the concessional code versions under the same parent. Export each one and search for `AppliedAmountSum`. Wherever you find it, apply the same fix.
- **Keep the JSON in Git**, with a short README of what you changed and why. The next consultant will thank you.

---

## When NOT to edit a use case

Editing use cases is right when the **logic itself** is wrong or missing, like here.

If you need a **new field**, for example a manual "GST Base Amount" on purchase lines where only part of the line is taxable, use AL instead: a table extension plus event subscribers. Configuration changes get overwritten too easily, and a new field needs code anyway.

---

## Summary

- GST, TDS and TCS in BC India are calculated by **use cases**, which are configuration, not code.
- You can change them **in the designer** (derived configuration, Complete, then "Copy tax setup from" = Yes) or **by editing the JSON** (export, disable, import, validate, enable).
- The standard TDS use case with **Applies-to ID** reduces the invoice's TDS base by the **GST-inclusive** advance amount, because of one line that cancels itself out. The result is **short TDS deduction**.
- The fix is to **pro-rate the advance's TDS base** by the amount applied. It is safe with or without GST, and with "Include GST in TDS Base".
- **Protect your fix**: use a new CaseID with a lower Presentation Order, import it per company, check after each upgrade, and fix the sibling use cases too.

If you've seen other gaps in the standard GST or TDS use cases, tell me. Reading the JSON line by line teaches you more about the Tax Engine than any document.
