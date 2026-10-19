---
title: Why `exit` doesn't skip a record in a report
date: 2026-10-19
type: issue
tags: AL, Reports
summary: Calling exit in OnAfterGetRecord leaves the trigger but the row is still printed. Use CurrReport.Skip().
---

## The problem

A report should hide customers with a zero balance. The filter logic uses `exit`, yet the zero-balance rows still appear.

```al
trigger OnAfterGetRecord()
begin
    CalcFields("Balance (LCY)");
    if "Balance (LCY)" = 0 then
        exit; // looks right, but the record is still output
end;
```

## Why it happens

`exit` only leaves the current trigger. The data item has already fetched the record, so the dataset still contains it.

## The fix

```al
trigger OnAfterGetRecord()
begin
    CalcFields("Balance (LCY)");
    if "Balance (LCY)" = 0 then
        CurrReport.Skip();
end;
```

## Takeaway

In report triggers, use `CurrReport.Skip()` to drop a record. Reserve `exit` for ending a procedure early.
