---
title: BC 29 changes how table extensions are stored, and why your keys just got more powerful
date: 2026-10-26
type: feature
tags: AL, Table Extension, Keys, Performance, Business Central
summary: From Business Central version 29, your table extension fields sit in the same SQL table as the base table. What changed, why it matters for keys, the story of how we got here, and 12 "Did you know?" facts on keys, Blobs and SetLoadFields, each explained simply.
---

Let me start with a simple question.

When you add a field to the Customer table using a table extension, where does that field actually live in the database?

Most of us would say: "In the Customer table, of course." In AL it looks exactly like that. You write `Customer."ABC Region Code"` and it just works.

But for many years, that was not true. Your field was stored in a **different** table. And from **Business Central version 29** (2026 release wave 2), this finally changes.

Let me explain it in a simple way.

## Think of a shop and a godown

Imagine you run a small shop.

The shop has shelves with all the normal items. That is the **base table**, for example Customer.

One day you want to keep some extra items, but you are not allowed to change the shop shelves. So you rent a small **godown next door** and keep your extra items there. That godown is the **companion table**.

Now, every time a customer asks for something, you have to check the shop **and** walk to the godown. It works, but it takes extra time.

That is exactly how table extensions worked in the database:

- The base fields were in the base table.
- Your extension fields were in a separate companion table.
- Every time Business Central read a record, it had to **join** both tables. That join is the "walk to the godown".

## How it changed over the years

**In the C/AL days (old NAV):** we changed the base table directly. Our field was just another column in the same table. Very simple, but upgrades were painful, because everyone's changes were mixed together.

**When extensions came:** Microsoft wanted installing and removing an app to be safe. So every table extension got **its own** companion table. If three apps extended Customer, there were three godowns. Microsoft's own example: a table with 7 table extensions could need a **7-way join** just to read one record.

**In 2021 (version 18):** keys in a table extension were allowed to use base table fields. But one key could not mix base fields and extension fields.

**In 2023 (version 23):** Microsoft put the fields from **all** extensions into **one shared** companion table. So only one godown per table, and at most one join. In the same release we also got `SetBaseLoadFields()`, which reads only the base fields, so you could skip that one join when you didn't need your extension fields.

**In 2026 (version 29):** no godown at all. Microsoft's roadmap item says it clearly: *"With the new data model for table extensions, all fields on an AL table are stored in the same table in the database."* Everything is on the shop shelves now.

## Does my code change?

No. This is the best part. Your AL code stays exactly the same. You still write `Customer."ABC Region Code"`. The change is only in how the data is stored under the hood.

## So why should I care? Keys!

Here is the part that really matters for us developers.

A SQL index (in AL we call it a key) can only be built on columns of **one** table. When your field was in the godown and the base field was in the shop, SQL simply could not make one index that covers both. They were in two different places.

That's why the old rule was: in a table extension, one key can use base fields **or** your extension fields, but **not both together**.

From version 29, everything is in one table, so that rule is gone. Microsoft's documentation says that from runtime 18.0, a table extension key can mix base table fields and extension fields. This works in `KeyFields`, `SumIndexFields`, `SqlIndex` and `IncludedFields`.

### Let's see an example

Say you added a **Delivery Zone** field to the Sales Header. Every morning, the warehouse team opens a list of orders for one zone and one shipment date.

- `Shipment Date` is a **base** field.
- `ABC Delivery Zone` is **your** field.

Before version 29, you could not put both in one key. Now you can:

```al
tableextension 50180 "ABC Sales Header" extends "Sales Header"
{
    fields
    {
        field(50180; "ABC Delivery Zone"; Code[10])
        {
            Caption = 'Delivery Zone';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        // From runtime 18.0 (BC 29): one key with your field AND a base field
        key(ABCZoneShipDate; "ABC Delivery Zone", "Shipment Date")
        {
        }
    }
}
```

And here is how you use it:

```al
procedure FindOrdersForZone(ZoneCode: Code[10]; ShipDate: Date)
var
    SalesHeader: Record "Sales Header";
begin
    SalesHeader.SetCurrentKey("ABC Delivery Zone", "Shipment Date");
    SalesHeader.SetRange("ABC Delivery Zone", ZoneCode);
    SalesHeader.SetRange("Shipment Date", ShipDate);
    SalesHeader.SetLoadFields("No.", "Sell-to Customer Name");
    if SalesHeader.FindSet() then
        repeat
            // ...
        until SalesHeader.Next() = 0;
end;
```

Now SQL can use one index for both filters. On a big table, that is the difference between reading every row and jumping straight to the right ones.

To use this, set `"runtime": "18.0"` (or later) in your `app.json`. That needs Business Central version 29 or later.

### One rule is still there

You still **can't** use fields from **another app's** table extension in your key. Your key can mix the base table and **your own** fields, not someone else's.

## What should I do now?

- **Relax.** Nothing breaks. Your code keeps working.
- **Look at your slow pages and reports.** If one filters on a base field plus your own field, a mixed key may help a lot now.
- **Don't add keys just because you can.** Every key makes inserts and changes a little slower. Add only the one your filter really needs.
- **On-premises?** Microsoft's roadmap item lists this for Business Central online. Test it on your own version before you count on it.

---

## Did you know?

Here are some small facts about tables, keys and fields. Each one has helped me at least once. I explain each with a simple example.

### 1. Did you know a primary key can use at most 16 fields?

**The answer:** In AL, the editor lets you write up to 20 fields in a key. But because of SQL Server limits, only the **first 16 are used**.

**Why it matters:** if you write 18 fields, it looks fine in your code, but the last two do nothing.

**My tip:** you almost never need that many. Most good primary keys have one to three fields, like `"Document Type", "Document No.", "Line No."`.

### 2. Did you know the key limit is 900 bytes, not 900 characters?

**The answer:** A key can be at most **900 bytes** in total. Text and Code fields store every character in **2 bytes**.

**Let's count:**

| Field | Bytes |
|-------|-------|
| `Code[20]` | 20 x 2 = 40 |
| `Code[50]` | 50 x 2 = 100 |
| `Integer` | 4 |
| `Text[500]` | 500 x 2 = 1,000, **too big** |

So a key with `Code[20]` + `Code[20]` + `Integer` uses 84 bytes. Fine. But one `Text[500]` field alone is already over the limit.

**My tip:** never put a long description in a key. Keep key fields short.

### 3. Did you know you can't change the length of a primary key field later?

**The answer:** If a field is part of the primary key, you can't change its length in a new version of your app. **Not even to make it longer.**

**Example:**

```al
// Version 1.0
field(1; "Document No."; Code[20]) { }

// Version 2.0 - NOT allowed if "Document No." is in the primary key
field(1; "Document No."; Code[30]) { }
```

AppSourceCop rule **AS0118** reports this, and the upgrade can't synchronize.

**My tip:** choose the length carefully on day one. A little extra length costs only a few bytes, and it saves you a painful data migration later.

### 4. Did you know a Blob field can hold up to 2 GB?

**The answer:** A Blob can store up to **2 GB**: a PDF, an image, a long JSON message. But there is a catch: it is **not loaded** with the record.

**Example:**

```al
Rec.CalcFields(Note);              // load the Blob first
if Rec.Note.HasValue() then begin  // check if there is anything inside
    Rec.Note.CreateInStream(InStr, TextEncoding::UTF8);
    InStr.ReadText(NoteText);
end;
```

If you forget `CalcFields`, the Blob looks empty even when it has data.

**My tip:** this is also good news. Because Blobs aren't loaded by default, list pages stay fast even when the table has big Blobs.

### 5. Did you know a Text or Code field can be at most 2,048 characters?

**The answer:** `Text[2048]` and `Code[2048]` are the maximum for a field in a table.

**My tip:** if you need more, for example to store a full API response, use a **Blob** instead.

### 6. Did you know a table can have at most 500 fields?

**The answer:** One table can have up to **500 fields**, and one record can be at most **8,060 bytes**.

**Why it matters:** if many apps keep adding fields to the same big table (Customer, Item, Sales Line), you can slowly get close to this limit.

**My tip:** if your app needs many fields for one record, think about a separate table of your own, linked by the primary key, instead of adding everything to the base table.

### 7. Did you know `SetLoadFields` only accepts normal fields?

**The answer:** `SetLoadFields` tells Business Central to read only some fields, which makes loops faster. But it only works with **normal** fields. If you pass a FlowField, you get an error.

**And there is a bonus:** you never need to list these, because they are **always** loaded:

- the primary key fields
- `SystemId`
- the audit fields: `SystemCreatedAt`, `SystemCreatedBy`, `SystemModifiedAt`, `SystemModifiedBy`

**Example:**

```al
Item.SetLoadFields(Description, "Unit Price");   // "No." comes automatically
if Item.FindSet() then
    repeat
        // use Item."No.", Item.Description, Item."Unit Price"
    until Item.Next() = 0;
```

**My tip:** for FlowFields, use `SetAutoCalcFields` instead.

### 8. Did you know reading a field you didn't load still works, but costs extra?

**The answer:** If you use `SetLoadFields` and then read a field you did not list, Business Central doesn't fail. It quietly goes back to the database to fetch it. This is called a **JIT load** (just-in-time).

**Why it matters:** inside a loop of 10,000 records, that's up to 10,000 extra trips. And if someone changed the record in between, you can even get an "Inconsistent read" error.

**My tip:** list **every** field you will use in the first `SetLoadFields` call. The CodeCop rule **AA0242** will warn you when you forget one.

### 9. Did you know a key name can be at most 28 characters?

**The answer:** If a key name is longer than 28 characters, you get warning **AL0534**. Longer names can cause SQL errors.

**My tip:** use short, clear names, like `ABCZoneShipDate`, not `ABC_Delivery_Zone_And_Shipment_Date_Key`.

### 10. Did you know you can read only the base fields with `SetBaseLoadFields`?

**The answer:** Since version 23, `SetBaseLoadFields()` loads only the fields of the base table, not the fields added by table extensions.

**Why it existed:** before version 29, extension fields were in the companion table (the godown), so skipping them meant skipping the join.

**My tip:** from version 29 there is no godown any more, so the join is gone. In my opinion the bigger win now is still `SetLoadFields`, because reading fewer columns is always less work.

### 11. Did you know that from version 29 you can change a field from Integer to BigInteger?

**The answer:** Starting with runtime 18.0, you can change an existing field from `Integer` to `BigInteger` in an upgrade.

**Why it matters:** an `Integer` can go up to about 2.1 billion. For a busy log table or an entry number, that can run out one day. Now you can widen it without rebuilding the table.

**My tip:** check the extensions that use your field. The compiler warns where a `BigInteger` value is put back into an `Integer`, because that could overflow.

### 12. Did you know every table in version 29 can show who created a record, by name?

**The answer:** Every table already had `SystemCreatedBy` and `SystemModifiedBy`, but those are GUIDs, not names. From runtime 18.0, there are four new system FlowFields:

- `SystemCreatedByUserName` and `SystemCreatedByFullName`
- `SystemModifiedByUserName` and `SystemModifiedByFullName`

**My tip:** no more custom code to look up the user from a GUID. Just add the field to your page.

---

## To sum it up

For years, our extension fields lived next door, in a godown, and every read had to walk there and back. In 2023 all the godowns became one. In version 29, the godown is gone, and everything is on the same shelves.

Your code doesn't change. But you can now build **one key with a base field and your own field together**. If you have a slow page that filters on both, try it.

Have you already moved to version 29? Did you notice any difference? Tell me in the comments. And if you know another "Did you know?" fact, share it. I'll add the best ones to this post.

## Sources

- Microsoft Learn: [Update 29.0 for Business Central 2026 release wave 2](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/whatsnew/whatsnew-update-29-0)
- Microsoft Learn: [Table keys, limitations and restrictions](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-table-keys)
- Microsoft release plan 2023 wave 2: [Data loads faster in the server](https://learn.microsoft.com/dynamics365/release-plan/2023wave2/smb/dynamics365-business-central/data-loads-faster-server)
- Microsoft Learn: [Object specifications and limitations](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-object-specifications-limitations)
- Microsoft Learn: [Using partial records](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-partial-records)
- Microsoft Learn: [Table object, Integer to BigInteger](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-table-object)
- Microsoft Learn: [Table system fields](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-table-system-fields)
