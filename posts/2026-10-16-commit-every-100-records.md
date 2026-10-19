---
title: Commit every 100 records in AL with mod
date: 2026-10-16
type: snippet
tags: AL, Performance, Business Central
summary: A tiny pattern for long-running batch jobs so one failure doesn't roll back hours of work.
---

## The problem

A batch that touches thousands of records in one transaction holds locks for a long time and rolls everything back on a single error.

## The snippet

```al
procedure ProcessItems()
var
    Item: Record Item;
    Counter: Integer;
begin
    if Item.FindSet(true) then
        repeat
            // ... your update logic here ...
            Counter += 1;
            if Counter mod 100 = 0 then
                Commit();
        until Item.Next() = 0;
end;
```

## How it works

`Counter mod 100 = 0` is true on every hundredth record, so the transaction is committed in batches of 100.

> Only use this where partial completion is acceptable. A committed batch can no longer be rolled back, and `Commit()` must not be called from event subscribers that run inside someone else's transaction.
