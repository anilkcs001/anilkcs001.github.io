---
title: "GST explained simply: 'from what is GST' to 'why is GST' not coming in BC"
date: 2026-11-04
type: feature
tags: GST, India, Business Central, Functional, Finance Basics, Tax Engine
summary: GST in simple words, the way I finally understood it. Who actually pays GST, where CGST, SGST and IGST money goes, registered and unregistered vendors, input credit and GSTR-2B, reverse charge, and at the end a Business Central checklist for when GST is not coming.
---

Let me start with one small question.

You buy a fan for ₹3,000 + 18% GST. So you pay ₹540 GST.

**Who paid that ₹540 to the government?**

Not you. You never opened the GST portal in your life. And not only the shop also. The shop paid only **₹180** out of it.

That ₹540 was paid by **three different businesses**, ₹180 each, at different times. And none of them lost even one rupee.

Once you understand how this happens, the rest of GST becomes very easy. CGST, IGST, input credit, GSTR-2B, reverse charge, everything is the same idea only.

See, I am a technical person. For a long time, whenever someone said "GST is not coming in BC", I directly went and checked the setup. Only later, when I actually sat and learned GST properly, I understood that many of those "issues" were not issues at all. GST was not supposed to come only.

So in this post we will go in that order. **First GST, in simple words. Then Business Central.**

---

## 1. What is GST, basically?

GST is a tax on **using** something. Whoever finally uses the product, that person pays the tax.

But government can't go and collect tax from crores of people one by one, no? So what they do is, they collect it **step by step**, from every business in the chain, while the product moves from raw material to the customer.

Let's take one fan and follow it. GST rate is 18%.

**Step 1.** Steel supplier sells steel to a fan factory for ₹1,000.
He takes ₹180 GST from the factory. He pays that ₹180 to government.

**Step 2.** Factory makes the fan and sells it to a dealer for ₹2,000.
It takes ₹360 GST from the dealer. But the factory already paid ₹180 GST when it bought the steel.
So it pays only the balance: **₹360 − ₹180 = ₹180**.

**Step 3.** Dealer sells the fan to you for ₹3,000.
He takes ₹540 GST from you. He already paid ₹360 to the factory.
So he pays **₹540 − ₹360 = ₹180**.

| Who | Sold for | GST taken from buyer | GST already paid while buying | Paid to government |
|---|---|---|---|---|
| Steel supplier | ₹1,000 | ₹180 | ₹0 | ₹180 |
| Fan factory | ₹2,000 | ₹360 | ₹180 | ₹180 |
| Dealer | ₹3,000 | ₹540 | ₹360 | ₹180 |
| **Total** | | | | **₹540** |

Government got ₹540 total. That is exactly 18% of ₹3,000, the final price.

Now see the businesses. Each one took GST from the buyer and gave GST to the seller. Their own pocket, nothing. They are just passing the money. The full ₹540 actually came from **you**, the person who finally uses the fan.

That column "GST already paid while buying" has a name. It is called **Input Tax Credit**, or **ITC**. This is the heart of GST. Keep this in mind, we will come back to it again and again.

> **In one line:** every business pays GST only on the value it added. The final customer carries the full tax.

---

## 2. CGST, SGST, IGST: whose money is it?

In India we have Central government and State governments. Both want their share. So GST has three "boxes".

### Same state: CGST + SGST

Fan factory is in Hyderabad (Telangana). Dealer is also in Hyderabad.

The ₹360 GST is cut into two equal halves:

- **CGST ₹180** (Central GST), goes to the **Centre**
- **SGST ₹180** (State GST), goes to **Telangana**

Rate is still 18% only. It is just shown as 9% + 9%.

### Different states: IGST

Now suppose the dealer is in Bengaluru (Karnataka).

Factory charges **IGST ₹360** (Integrated GST). One tax, full rate, and the **Centre** collects it.

Then the doubt comes: if the Centre keeps everything, what about the state?

Here is the main point. **GST goes to the state where the product is finally used.** This fan will be used in Karnataka. So Karnataka should get the state share, not Telangana.

That is why the Centre collects IGST first and holds it. It keeps it until it knows where the product finally goes.

See what happens next. Bengaluru dealer sells the fan to you, in Bengaluru, for ₹3,000:

- He charges **CGST ₹270 + SGST ₹270**.
- He has **₹360 IGST credit** from his purchase.
- He uses that IGST credit to pay his CGST ₹270, and ₹90 of his SGST.
- Balance SGST **₹180** he pays in cash.

Because IGST credit was used to pay Karnataka's SGST, government moves that money **from the IGST side to Karnataka**. This is called **IGST settlement**. You and me never see this. It happens between the Centre and the states.

So finally Karnataka, where the fan is used, gets the state share. Telangana, where it was made, doesn't. That's it. That is the full meaning of "destination based tax".

### Who can use which credit

- **IGST credit** has to be used first. It can pay IGST, CGST or SGST.
- **CGST credit** can pay CGST and IGST. **Never SGST.**
- **SGST credit** can pay SGST and IGST. **Never CGST.**

Why like this? Simple. CGST is Centre's money, SGST is state's money. One can't pay the other one's bill.

### How do we decide which one?

Two things decide it: **where the seller is**, and **where the goods are going** (this is called "place of supply").

- Same state: CGST + SGST
- Different states: IGST
- Import: IGST
- Export, or supply to SEZ: zero-rated (I'll explain below)

> **One thing I wish someone told me early:** IGST is not extra tax. ₹1,000 at 18% is ₹180 GST, whether it's CGST + SGST or IGST. Only the box changes, the amount is same.

---

## 3. GSTIN: it's not a random number

Every registered business gets a 15-character **GSTIN**. If you know how to read it, the number itself tells you a lot.

Take **36ABCDE1234F1Z5**:

| Part | Example | What it means |
|---|---|---|
| First 2 digits | 36 | State code. 36 = Telangana, 29 = Karnataka, 27 = Maharashtra |
| Next 10 | ABCDE1234F | The PAN of the business |
| 13th | 1 | Which registration for this PAN in this state (1st, 2nd...) |
| 14th | Z | Default letter, same for everyone |
| 15th | 5 | Check character |

Two useful things from this:

- **One PAN can have many GSTINs.** One for each state where the business is working. If a company has plants in Telangana and Karnataka, it has two GSTINs.
- **First two digits must match the state.** If the vendor's state is Karnataka but GSTIN starts with 36, somebody made a mistake. Check it.

---

## 4. Rates, HSN and SAC

Every product or service has a code:

- **HSN** for goods
- **SAC** for services

The code decides the rate. Vendor can't choose the rate as he likes. Law decides it.

From **22 September 2025** (people are calling it GST 2.0), the main rates are:

| Rate | For what |
|---|---|
| 0% | Very basic things, like milk, paneer, notebooks |
| 5% | Daily use items, like ghee, soap, shampoo, toothpaste |
| 18% | Most goods and services, like TV, AC, cement, most professional services |
| 40% | Luxury and "sin" items, like big cars and cool drinks (aerated drinks) |

The old **12% and 28%** slabs are removed. Most items moved to 5% or 18%. A few special rates are still there, like 3% on gold.

> **Why this matters for BC people:** rates keep changing. When they change, the old rate should stop on one date and the new rate should start from that date. Wrong "from date" on a rate line is one of the most common reasons for wrong GST.

---

## 5. Registered and unregistered vendors

Honestly, this part confused me the most. So let's go slowly.

### Who has to register?

A business has to take GST registration when its yearly sales cross a limit:

- **₹40 lakh** for goods (₹20 lakh in some small states)
- **₹20 lakh** for services (₹10 lakh in some small states)

Some businesses have to register **even if their sales are small**. For example, anyone selling goods to another state, or anyone selling on e-commerce sites (there are some relaxations here).

Below the limit, a small business can stay **unregistered**. Think about your local tea shop, the electrician who comes to your office, the small printing shop near your office.

### Why do we pay GST to a registered vendor?

Because the registered vendor is **collecting it for the government**. Remember the fan factory? It took ₹360 from the dealer. That was not the factory's money. It passed it to the government (after taking its own credit).

And we also don't lose that money. When we pay GST to a registered vendor, it becomes **our input credit**. We use it to pay our own GST when we sell.

So GST paid to a registered vendor is **not a cost**. It's just money passing through.

### Why doesn't an unregistered vendor charge GST?

Very simple. **He is not allowed to.**

Only a registered person can collect GST. Unregistered vendor has no GSTIN, no GST return, no way to pay GST to government. If he still writes GST on his bill, that is wrong, and we can't take credit for it anyway.

So bill from an unregistered vendor is just: **amount, no GST**. That's all.

### "Unregistered vendor means reverse charge." Is it true?

I also believed this for a long time. **It is not true.**

Buying from an unregistered vendor does **not** automatically mean reverse charge. Mostly, there is just **no GST** at all.

Reverse charge on unregistered vendors comes only in **some specific cases that government has listed**. One example you will see in real life: a registered business taking a **commercial property on rent** from an unregistered owner (from October 2024).

We'll see reverse charge properly in section 7.

### Composition vendors: registered, but still no GST on bill

There is one more type. A small business with yearly sales up to **₹1.5 crore** can choose the **composition scheme**. They pay a small fixed percentage of their sales as tax (for example 1% for traders) and file simple returns.

But the catch is:

- A composition vendor **can't charge GST** on his bill.
- So the buyer gets **no input credit**.

So if your purchase team buys a lot from composition vendors, the company is losing credit that a normal registered vendor would have given. It is a business decision, not only a tax thing.

### Quick summary

| Vendor type | GST on his bill? | Can we take credit? |
|---|---|---|
| Registered (normal) | Yes | Yes (if conditions are met) |
| Composition | No | No |
| Unregistered | No | No. RCM only in listed cases |

---

## 6. Input credit, and why GSTR-2B decides everything

Let's go back to the dealer. He paid ₹360 GST to the factory and took it as credit. But how will the government **know** that the factory really billed him ₹360? Anybody can say "I paid GST" and take credit, no?

That's where returns come in.

### Three returns you must know

| Return | Who files it | What is inside |
|---|---|---|
| **GSTR-1** | Seller | All his sales bills, one by one |
| **GSTR-2B** | Nobody. Portal makes it automatically | Your purchases, built **from your vendors' GSTR-1** |
| **GSTR-3B** | You | Your monthly summary: tax on sales, credit taken, tax paid |

This link is the most important thing:

> Your vendor's **GSTR-1** becomes your **GSTR-2B**. And your GSTR-2B decides how much credit you can take in your **GSTR-3B**.

### Monthly calendar

For a normal monthly filer, for October bills:

- **By 11 November:** your vendor files GSTR-1 with his October sales
- **14 November:** portal makes your October GSTR-2B from all vendors' GSTR-1
- **By 20 November:** you file GSTR-3B and take credit **as per your GSTR-2B**

Small businesses in the quarterly scheme (QRMP) have a slightly different calendar, but the idea is same.

Before the 14th, you can check your vendors' bills in the **Invoice Management System (IMS)** on the portal. For each bill you can **accept**, **reject** or keep it **pending**. If you do nothing, it is taken as accepted.

### Real-life example

Factory buys raw material for ₹5,00,000 + ₹90,000 GST in October. The vendor is busy and **forgets to file his GSTR-1**.

- Factory paid ₹90,000 GST. Bill is there. Material is in the warehouse.
- But the bill is **not in factory's GSTR-2B**.
- So factory **can't take** that ₹90,000 credit in October. It has to pay its own GST in cash.

The money is not lost forever. Once the vendor files, it can be taken later. But till then, ₹90,000 is stuck. That's why the accounts team keeps calling vendors every month, "Sir, please file your return", and that's why "2B reconciliation" is a monthly job in every company.

### When can you take credit?

You can take ITC only when **all** of these are true:

1. You have a proper **tax invoice** (or debit note).
2. You have actually **received** the goods or service.
3. The bill is showing in your **GSTR-2B**.
4. The vendor has actually **paid** that tax to government.
5. You have **filed** your own GSTR-3B.

And two more rules people forget:

- **Pay the vendor within 180 days.** If you don't pay the vendor within 180 days from the bill date, you have to reverse that credit (with interest). Once you pay, you can take it again.
- **There is a last date.** Credit for one financial year has to be taken by **30 November** of the next year (or the annual return date, whichever is earlier).

### Blocked credit

For some purchases you **never** get credit, even if the bill is perfect. Common ones:

- Cars for employees (some exceptions, like if your business is selling cars)
- Food and drinks, club membership, gym
- Things for personal use, and gifts
- Building your own office building

For these, GST simply becomes part of the cost.

---

## 7. Reverse Charge (RCM): when the buyer pays

Normally the **seller** takes GST from you and pays it to government. This is called **forward charge**.

In **reverse charge**, it is opposite. The **buyer** pays GST directly to government. Seller's bill will not have GST.

### Why will government do like this?

Think about who gives these services:

- Thousands of small truck owners (goods transport)
- Individual advocates
- Directors of a company
- Small security agencies

Collecting GST from lakhs of small people is very difficult. Many are not even registered. But the **buyers** are mostly registered companies, easy to track.

So for these cases government says: **"Buyer, you pay."** Simple.

### Two types of reverse charge

**Type 1: specific goods and services (Section 9(3)).** Government has given a list. For these, RCM comes **whether the supplier is registered or not**. Examples:

- Goods transport by a GTA (in some cases)
- Legal services by an advocate
- Services by a company director
- Security services (when the supplier is not a company)
- Sponsorship services

**Type 2: buying from unregistered suppliers (Section 9(4)).** Only in **listed** cases. For example, a registered business taking commercial property on rent from an unregistered owner.

### How it works, with numbers

Your company takes an advocate for a case. His fee is ₹50,000. Legal services come under RCM, at 18%.

1. Advocate's bill shows **₹50,000**. No GST.
2. Your company pays him **₹50,000**.
3. Your company pays **₹9,000 GST** directly to government, **in cash**. (RCM tax can't be paid using credit.)
4. In the same GSTR-3B, your company can take **₹9,000 as input credit** (if it is for business use).

Final cost is ₹50,000 only. GST went out and came back. But you have to pay it in cash first, and on time.

### One more step for unregistered suppliers

When you buy under RCM from an **unregistered** supplier, there is no proper tax invoice. So **you make one yourself**. It is called a **self-invoice**. As per the current rule, you have to make it within **30 days** of receiving the goods or service.

> RCM bills don't come in your GSTR-2B the normal way, because the vendor didn't charge you GST. You show the RCM tax yourself in GSTR-3B.

---

## 8. Other words you will hear daily

**Exempt / Nil-rated.** No GST on the item (for example fresh vegetables). No GST charged, and the seller also can't take credit on purchases related to it.

**Zero-rated.** Exports and supplies to SEZ. No GST to the buyer, **but the seller can still get the credit back** as refund. This is the big difference from exempt.

**Non-GST.** Things that are fully outside GST, like petrol, diesel and liquor. They have their own separate taxes.

**E-invoice.** If a business's yearly sales crossed **₹5 crore** in any year (from 2017-18), every B2B bill has to be registered on the government's **Invoice Registration Portal (IRP)**. The portal gives back an **IRN** (a unique number) and a **QR code**, which you print on the bill. The bill details also go to GSTR-1 automatically. If sales are ₹10 crore or more, you have to register it within **30 days** of the bill date.

**E-way bill.** When goods worth more than **₹50,000** move by road, you need an e-way bill (some states have their own limit for movement inside the state). Think of it like a travel pass for goods.

**Credit note.** If you return goods or get a discount, the seller gives a credit note and reduces his GST. You also have to reduce your credit.

---

## 9. Mistakes I see again and again

1. **"Vendor is unregistered, so apply RCM."** No. Only for listed cases.
2. **Taking credit without checking GSTR-2B.** If it's not in 2B, you can't take it.
3. **Paying GST to a composition vendor.** He can't charge it. If his bill shows GST, ask him.
4. **Wrong state on the vendor card.** CGST + SGST comes instead of IGST, or the reverse. That means a wrong return, not just a wrong number.
5. **GSTIN starting with the wrong state code.** Always match the first two digits with the state.
6. **Forgetting the 180-day rule.** If the vendor is not paid in time, the credit has to be reversed.
7. **Taking credit on blocked items.** Staff lunch and cars are the classic examples.
8. **Old rate still running after a rate change.** Old rate line has no end date, or new one starts on the wrong date.

---

## 10. Business Central: "GST is not coming". What do I check?

Now we are ready. Whenever someone tells me "GST is not calculating in this document", I check in this order.

### Step 1: Should GST even come here?

Before touching any setup, first I ask the GST questions from above:

- Is the vendor **Unregistered**, **Composite** or **Exempted**? Then **no GST is correct**.
- Is the item **exempt**, **nil-rated** or **non-GST**? Then no GST is correct.
- Is it an **RCM** case? Then GST is calculated, but it is not added to the vendor's amount. People see the vendor amount without GST and think GST is missing.
- Is the customer **Export** or **SEZ**? Then zero-rated rules apply.

From my experience, many "GST not coming" tickets close right here only.

> **Also check where you are looking.** In BC India, GST doesn't show in the normal line amount. Open the document's **Statistics**, or the GST FactBox, to see it.

### Step 2: Who are we?

- **Company Information:** State Code and GST Registration No.
- **Location** on the document: State Code and GST Registration No. In most companies, this is the one that actually matters.
- **GST Registration Nos.:** the GSTIN is there for that state.
- First two digits of the GSTIN match the state code.

If the location doesn't have a GST Registration No., BC doesn't know who "we" are, so no GST.

### Step 3: Who are they?

- **Vendor:** GST Vendor Type, State Code, GST Registration No.
- **Customer:** GST Customer Type, State Code, GST Registration No.
- If the document has an **Order Address** (vendor) or **Ship-to Address** (customer), check the state and GSTIN **there also**. That one wins over the card.

### Step 4: What is it?

On the **item**, **G/L account**, **resource** or **charge** used in the line:

- **GST Group Code**: if blank, no GST
- **HSN/SAC Code**: if blank, no GST
- **GST Credit**: Availment or Non-Availment. This won't stop GST, but it decides whether GST goes to credit or to cost.

For RCM, check that **Reverse Charge** is ticked on the **GST Group**.

For unregistered vendors, also check **Purchases & Payables Setup**. There are two fields: **RCM Exempt Start Date (Unreg)** and **RCM Exempt End Date (Unreg)**. If the posting date falls between them, BC won't calculate RCM for unregistered vendors.

### Step 5: How much? (Tax Rates)

Go to **Tax Types → GST → Tax Rates**. There must be one line that matches **all** these:

- GST Group Code
- HSN/SAC
- From State (vendor's state, or location's state for sales)
- Location State Code
- **Date From on or before the posting date** (and Date To after it, if filled)

This is the most common gap in setup. New HSN code came, or new state, or new location, and nobody added the rate lines.

### Step 6: Where does it post? (GST Posting Setup)

If GST is showing in Statistics but **posting fails**, check **GST Posting Setup**. You need one line for **each state and each component** (CGST, SGST, IGST), with receivable and payable accounts filled. For RCM, the interim accounts are also needed.

### Step 7: Is the engine itself ready?

In a new company, or after an upgrade, check that the GST **Tax Type** and its **use cases** are there and enabled. Without them, the Tax Engine has nothing to calculate.

### Full checklist in one table

| What you see | Check first |
|---|---|
| No GST, vendor is unregistered or composition | Mostly correct only. Is it a listed RCM case? |
| No GST on any line | Location State Code and GST Registration No. |
| No GST for one vendor or customer | GST Vendor/Customer Type, State, GSTIN, Order/Ship-to Address |
| No GST for one item | GST Group Code and HSN/SAC on the item |
| No GST for one item, setup looks fine | Tax Rates line for group + HSN + both states + date |
| CGST + SGST instead of IGST (or the reverse) | State on vendor/customer, address, or location |
| No RCM where expected | Reverse Charge on GST Group. RCM exempt dates in Purchases & Payables Setup |
| GST going to cost instead of credit | GST Credit = Non-Availment |
| GST calculated but posting error | GST Posting Setup for that state and component |

---

## What I want you to remember

- GST is paid by the **final customer**. Businesses only collect it and pass it on.
- **CGST + SGST** inside the same state. **IGST** between states. Centre collects IGST, and the state share goes to the state where the product is finally used.
- **Registered vendors** charge GST, and we get it back as **credit**. **Unregistered** and **composition** vendors don't charge GST, and there is no credit.
- **GSTR-2B** decides your credit, and it comes from your vendor's **GSTR-1**.
- **Reverse charge** means government is telling the buyer "you pay", for some services and some listed purchases. It is not automatic for every unregistered vendor.
- In BC, **first ask whether GST should come at all**. Then check the setup in order: us → them → what → rate → posting.

I learned GST the opposite way: setup first, concepts later. If I had learned the concepts first, I would have saved so many hours searching for bugs that were not even there.

*If something is different in your case, or I missed a scenario you see often, please write it in the comments. GST rules keep changing, so always check the latest notifications or talk to your CA before changing anything in production.*

---

### Sources

- [Set up goods and services tax (Business Central India), Microsoft Learn](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/gst-001-basic-setup)
- [New GST rates from 22 September 2025, TallySolutions](https://tallysolutions.com/gst/new-gst-rates-september-2025-business-impact/)
- [GST Council FAQ on the rate changes (PDF), gstcouncil.gov.in](https://gstcouncil.gov.in/sites/default/files/2025-09/faq.pdf)
- [What is changing in GSTR-2B and GSTR-3B with IMS, TallySolutions](https://tallysolutions.com/gst/ims-impact-on-gstr-2b-gstr-3b/)
- [RCM self-invoice within 30 days (Rule 47A), StudyCafe](https://studycafe.in/rcm-self-invoice-required-to-be-generated-within-30-days-cbic-notifies-new-rule-350087.html)
- [GST reverse charge on goods and services, Taxmann](https://www.taxmann.com/post/blog/gst-reverse-charge-in-case-of-supply-of-goods-and-services)
- [RCM on renting of commercial property from unregistered persons, TaxGuru](https://taxguru.in/goods-and-service-tax/gst-commercial-rental-income-key-amendments-rcm-applicability-10-10-2024.html)
- [Overview of the IGST Act, GSTZen](https://gstzen.in/a/overview-of-the-igst-act.html)
