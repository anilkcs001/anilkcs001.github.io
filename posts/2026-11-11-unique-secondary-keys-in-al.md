---
title: "Unique = true on a secondary key: what it does, and how I found it by accident"
date: 2026-11-11
type: concept
tags: AL, Keys, Tables, Data Validation, Business Central
summary: My table's primary key was Entry No., but BC still refused to insert the same record twice. The reason was one line I hadn't noticed, Unique = true on a secondary key. Here's what it does, how it differs from the primary key, and why it beats the usual SetRange + FindFirst + Error check.
---

Let me tell you how I found this, because I wasn't looking for it.

I was testing an integration. My staging table had **Entry No.** as the primary key, with AutoIncrement. So every new row gets a new number, and in my head, nothing could ever be a "duplicate". Every row is different, right?

Then I sent the same record a second time, just to test. And BC refused it. It gave an error and didn't create the row.

I was confused. The Entry No. would be new. Why is it saying no?

So I opened the table and read the keys properly. And there it was, on the second key:

```al
key(ExternalRef; "Source System", "External Document No.")
{
    Unique = true;
}
```

I had used this table for a while without ever noticing that one line. So I read about it, tried it out, and this post is what I learned.

## First, a quick refresher on keys

In AL, the keys section of a table has two kinds of keys.

- **Primary key.** The first key in the list. Every table has exactly one. It is the identity of the record: `Get()` uses it, `RecordId` is built from it, and SQL Server never allows two rows with the same primary key values.
- **Secondary keys.** Every key after the first one. Each one becomes an index in SQL Server, mainly to make sorting and filtering faster.

Normally, secondary keys **allow duplicates**. If you have a key on `City`, a hundred customers can be in Chennai. No problem.

## What Unique = true changes

When you set `Unique = true` on a secondary key, SQL Server creates a **unique index** for it. Now that key works like a rule:

> No two records can have the same value in this key.

If the key has more than one field, it's the **combination** that must be unique, not each field alone. That's exactly what happened in my table:

| Entry No. | Source System | External Document No. | Result |
|---|---|---|---|
| 1 | TMS | INV-1001 | Inserted |
| 2 | TMS | INV-1002 | Inserted |
| 3 | ERP2 | INV-1001 | Inserted (different source system) |
| 4 | TMS | INV-1001 | **Error, not inserted** |

Row 4 has a brand-new Entry No., so the primary key is happy. But `TMS + INV-1001` already exists, so the unique key stops it. That's my "duplicate" error.

## So is it like a second primary key?

That's what I thought at first, but no. It **protects against duplicates like a primary key**, but it is **not** the primary key. A table can only have one primary key.

| | Primary key | Unique secondary key |
|---|---|---|
| How many per table | Exactly one | As many as you need |
| Blocks duplicates | Yes | Yes |
| `Get()` uses it | Yes | No |
| `RecordId` and `Rename` | Based on this | Not used |
| Clustered (decides the physical order) | Yes, by default | No |
| Allowed in a table extension | Not applicable | **No**, `Unique` isn't supported in table extensions |

The `Get()` one surprises people. You can't do `Rec.Get('TMS', 'INV-1001')` with a unique secondary key. `Get` always takes the primary key values. To find a record by the unique key, filter on it:

```al
Staging.SetCurrentKey("Source System", "External Document No.");
Staging.SetRange("Source System", 'TMS');
Staging.SetRange("External Document No.", 'INV-1001');
if Staging.FindFirst() then
    // found it
```

## How to use it

It's one property on the key:

```al
table 50100 "AK Integration Staging"
{
    fields
    {
        field(1; "Entry No."; Integer) { AutoIncrement = true; }
        field(2; "Source System"; Code[20]) { }
        field(3; "External Document No."; Code[35]) { }
        field(4; Status; Enum "AK Staging Status") { }
    }

    keys
    {
        key(PK; "Entry No.") { Clustered = true; }

        key(ExternalRef; "Source System", "External Document No.")
        {
            Unique = true;   // the same document from the same system can come only once
        }
    }
}
```

That's all. No code in OnInsert, no extra checks. SQL Server does the work.

## When to use it

I'd use it whenever a business rule says *"this value must never repeat"*, but that value is not the primary key. Some examples:

- **Integration staging tables.** Like mine: the primary key is Entry No., but the same external document must not come twice. This also protects you when the other system retries a call that already worked.
- **Natural keys next to a technical key.** A setup table with an Entry No. primary key, where the `Code` users type must still be unique.
- **Mapping tables.** For example "external customer ID ↔ BC customer No.", where each external ID can map only once.
- **Anything where two users can insert at the same time.** More on this below. It's the best reason to use it.
- **Anywhere you'd write a SetRange + FindFirst + Error check before insert.** That's the next section.

When **not** to use it:

- **When the field is already the primary key.** It's unique already, so you'd only add an extra index.
- **When the field is optional.** See the blank-value trap below.
- **When the rule is "unique only in some cases".** For example, unique only for open documents. A unique index can't have conditions, so check it in code.

## Instead of SetRange + FindFirst + Error

This is the part that changed how I write code.

We all do this. The primary key is Entry No., but some other field must not repeat. So in OnInsert, or before calling Insert, we write the check ourselves:

```al
trigger OnInsert()
var
    Staging: Record "AK Integration Staging";
begin
    Staging.SetRange("Source System", Rec."Source System");
    Staging.SetRange("External Document No.", Rec."External Document No.");
    if Staging.FindFirst() then
        Error('Document %1 from %2 was already received.', Rec."External Document No.", Rec."Source System");
end;
```

SetRange, FindFirst, and if it exists, error. I've written this many times.

With a unique key, you don't need any of that. The same rule is one line on the key:

```al
key(ExternalRef; "Source System", "External Document No.") { Unique = true; }
```

And it's not just shorter. It's **safer**, for three reasons.

**1. It works even when two users insert at the same moment.** Think about two sessions inserting the same document at the same time. Both run the FindFirst, both find nothing, and both insert. Now you have a duplicate, and your check didn't stop it. A unique index can't be beaten like this. SQL Server checks it at the moment of the insert itself, so only one of the two can ever win. My No. Series post was about the same kind of problem: two users at the same time getting the same number.

**2. It can't be skipped.** Your check only runs if the code goes through it. `Insert(false)` skips OnInsert. A data upgrade, an import, or another developer's codeunit might not call your check at all. The unique key works on every insert, from anywhere.

**3. It covers Modify too.** If someone changes an existing record so that it becomes a duplicate, the unique key stops that as well. With the code approach you'd have to remember to write the same check in OnModify, and in OnRename.

**One small tip:** if users type this data on a page, you can still keep the FindFirst check, but only for a friendly message (use `IsEmpty()` instead of `FindFirst()`, since you don't need the record, only whether it exists). The unique key stays underneath as the real guarantee. For integrations and job queues, I don't add the check at all. The unique key alone is enough, and the error goes to the log.

## Things to watch out for

**1. Blank values count as values.** In BC, an empty Text or Code field is stored as an empty string, not as "no value". So if you put a unique key on `"E-Mail"` and two customers have no email, those two blanks are duplicates and the second insert fails. Only use a unique key on fields that are always filled. Or include another field that makes even the blank rows different.

**2. Existing duplicate data blocks the deployment.** If the table already has duplicates and you add `Unique = true` in a new version, SQL Server can't build the unique index. The schema sync fails and the new version won't install until the data is cleaned. So check for duplicates first, and clean them up in an upgrade codeunit or by hand.

**3. It doesn't work in table extensions.** You can add normal secondary keys to base tables through a table extension, but not unique ones. So you can't make the standard Customer table's `"E-Mail"` unique this way. You can use it only on tables you own.

**4. The error isn't very friendly.** When the unique key blocks an insert, the user sees a technical error, not your own message. That's why I keep a small check for pages where users type data, as I said above.

## A few bonus points

- **Every table already has one.** BC always keeps a unique key on the `SystemId` field. You get it without writing anything.
- **It can make reads faster too.** A unique index tells SQL's query optimiser that only one row can match, which can help it build a better query plan.
- **Admins can't switch it off.** From Business Central 2026 release wave 1, admins can disable indexes they don't need for performance. Unique indexes, primary keys and SystemId indexes are protected from that, so your rule stays in force.
- **It's been around for a long time.** It came with runtime version 3.0, so it works on any BC version you're likely to be on.

## In short

- `Unique = true` on a secondary key means **no duplicates in that key**, enforced by SQL Server.
- It's **not** a second primary key. `Get()`, `RecordId` and `Rename` still use the real primary key.
- Use it for rules like "the same external document only once", or "this code must not repeat".
- It can replace the usual SetRange + FindFirst + Error check, and it's safer, because it also works when two users insert at the same moment.
- Watch out for blank values, existing duplicate data, and table extensions.

I found it by accident, but now it's one of the first things I think about when I design a staging table. If you've used it in an interesting way, or if it ever caught you by surprise like it caught me, tell me in the comments.

## Sources

- [Table keys (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-table-keys)
- [Unique property (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/properties/devenv-unique-property)
- [Manage database index usage (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/manage-indexes)
