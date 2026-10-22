---
title: SingleInstance vs BindSubscription: run an event subscriber only when you want it
date: 2026-10-20
type: solution
tags: AL, Events, BindSubscription, SingleInstance, Business Central
summary: Need a subscriber to run only during your own process, not every time a user works? See why a SingleInstance flag is risky, and how BindSubscription solves it cleanly.
---

## The problem

Your import creates sales lines by calling standard code. You want to mark every line it creates with a tag, for example `IMPORT`. You cannot change the standard code, so you subscribe to the `OnBeforeInsertEvent` of the Sales Line table.

But there is a catch. That event fires for **every** sales line, also when a user types an order by hand. You want your subscriber to work **only while your import is running**.

How do you switch a subscriber on and off?

## Attempt 1: a global variable (does not work)

The first idea is a flag in the subscriber codeunit:

```al
codeunit 50140 "ABC Tag Subscriber Wrong"
{
    var
        IsImporting: Boolean;

    procedure SetImporting(NewValue: Boolean)
    begin
        IsImporting := NewValue;
    end;

    [EventSubscriber(ObjectType::Table, Database::"Sales Line", 'OnBeforeInsertEvent', '', false, false)]
    local procedure OnBeforeInsertSalesLine(var Rec: Record "Sales Line"; RunTrigger: Boolean)
    begin
        if IsImporting then
            Rec."ABC Source Tag" := 'IMPORT';
    end;
}
```

It never marks anything. Why? A normal subscriber codeunit gets a **new instance for every event call**, and the instance is thrown away right after. The instance where you set `IsImporting := true` is not the one that runs the subscriber. The flag is always `false` there.

## Attempt 2: a SingleInstance flag (works, but risky)

Add `SingleInstance = true`. Now there is only **one** instance of the codeunit for the whole session, so the flag is shared:

```al
codeunit 50141 "ABC Tag Subscriber Flag"
{
    SingleInstance = true;

    var
        IsImporting: Boolean;

    procedure SetImporting(NewValue: Boolean)
    begin
        IsImporting := NewValue;
    end;

    [EventSubscriber(ObjectType::Table, Database::"Sales Line", 'OnBeforeInsertEvent', '', false, false)]
    local procedure OnBeforeInsertSalesLine(var Rec: Record "Sales Line"; RunTrigger: Boolean)
    begin
        if IsImporting then
            Rec."ABC Source Tag" := 'IMPORT';
    end;
}
```

```al
procedure RunImportWithFlag()
var
    TagSubscriber: Codeunit "ABC Tag Subscriber Flag";
begin
    TagSubscriber.SetImporting(true);
    RunImport();
    TagSubscriber.SetImporting(false);
end;
```

It works on a good day. But look at what can go wrong:

| Risk | What happens |
|------|--------------|
| An error stops `RunImport()` | `SetImporting(false)` never runs. The flag **stays true** for the rest of the session. The user's next manual sales lines are tagged `IMPORT` too |
| Someone forgets to reset the flag | Same problem, and it is hard to find, because nothing fails |
| The subscriber always runs | It is called for every sales line in the session, only to check a flag and do nothing |
| Hidden state | Anyone reading the subscriber has to search the whole app to find who sets the flag |

A SingleInstance codeunit keeps its values until the session ends. That is exactly what makes it useful, and exactly what makes it dangerous for an on/off switch.

## The solution: Manual binding with BindSubscription

Set `EventSubscriberInstance = Manual` on the subscriber codeunit. Now its subscribers do **nothing** until you bind an instance of it with `BindSubscription`. When you unbind it, or when the variable is gone, they stop again.

```al
codeunit 50142 "ABC Tag Subscriber"
{
    EventSubscriberInstance = Manual;

    [EventSubscriber(ObjectType::Table, Database::"Sales Line", 'OnBeforeInsertEvent', '', false, false)]
    local procedure OnBeforeInsertSalesLine(var Rec: Record "Sales Line"; RunTrigger: Boolean)
    begin
        Rec."ABC Source Tag" := 'IMPORT';
    end;
}
```

Notice there is no flag, no `if` and no `SingleInstance`. If this code runs, it is because you switched it on. Being bound already means "the import is running", so the subscriber needs nothing else.

Switch it on only around your import:

```al
procedure RunImportWithTag()
var
    TagSubscriber: Codeunit "ABC Tag Subscriber";
begin
    BindSubscription(TagSubscriber);

    RunImport(); // any code that creates sales lines, standard or your own

    UnbindSubscription(TagSubscriber);
end;
```

The field used above, on the Sales Line:

```al
tableextension 50140 "ABC Sales Line" extends "Sales Line"
{
    fields
    {
        field(50140; "ABC Source Tag"; Code[20])
        {
            Caption = 'Source Tag';
            DataClassification = CustomerContent;
        }
    }
}
```

## Why this is better

**1. It switches off by itself.** `TagSubscriber` is a local variable. When `RunImportWithTag` ends, the variable is gone and all its bindings are removed automatically. So if `RunImport()` fails with an error, the subscriber does not stay on. The user's next manual order is safe.

**2. It costs nothing the rest of the time.** When nothing is bound, the subscriber is not called at all. There is no flag check for every sales line in the session.

**3. No SingleInstance needed.** The subscriber codeunit is a normal codeunit. The binding is the switch, so there is no shared flag to keep or reset.

**4. It is easy to read.** The switch is in one place, right next to the code it affects.

## How it works, step by step

```text
RunImportWithTag starts
  |
  |-- BindSubscription(TagSubscriber)      subscriber is now ON for this session
  |
  |-- RunImport()
  |     |-- Sales Line inserted  -->  OnBeforeInsertSalesLine runs  -->  tag = IMPORT
  |     |-- Sales Line inserted  -->  OnBeforeInsertSalesLine runs  -->  tag = IMPORT
  |
  |-- UnbindSubscription(TagSubscriber)    subscriber is OFF
  |
RunImportWithTag ends (variable gone, any binding left is removed)

A user creates a sales line by hand  -->  subscriber is not called
```

## So when should I use SingleInstance?

SingleInstance is not bad. It is the right tool when you **want** a value to live for the whole session:

- **A small cache.** Read a setup record once and keep it, instead of reading it again on every call.
- **Sharing a value between objects** that you cannot connect with parameters, for example a page and a codeunit that is called later.
- **Keeping a binding alive for the session.** If you store a manually bound subscriber in a global variable of a SingleInstance codeunit, the binding lasts the whole session, on purpose.

Use it for data that should live long. Do not use it for an on/off switch.

## Quick comparison

| | Normal codeunit | SingleInstance | Manual + BindSubscription |
|---|---|---|---|
| Instances | New one for every event call | One for the whole session | The one you bound |
| Subscriber runs | Always | Always | Only while bound |
| Global variables kept? | No | Yes, until the session ends | Yes, while the instance lives |
| Stops after an error? | Not relevant | **No, flag can stay on** | **Yes**, the binding ends with the variable |
| Best for | Normal subscribers | Session cache, shared values | Changing behaviour only during your process |

## Takeaway

When you need a subscriber to work only during your own process, do not use a flag in a SingleInstance codeunit. Set `EventSubscriberInstance = Manual`, put the subscriber codeunit in a **local** variable, and call `BindSubscription` around the code that needs it. It switches on exactly when you want and switches off by itself, even after an error.

## Sources

Microsoft Learn: *EventSubscriberInstance property*, *Session.BindSubscription method*, *Session.UnbindSubscription method*, and *SingleInstance property*.
