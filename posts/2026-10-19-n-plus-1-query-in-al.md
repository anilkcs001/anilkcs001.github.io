---
title: N+1 queries in AL: why a simple loop makes Business Central slow, and how to fix it
date: 2026-10-19
type: issue
tags: AL, Performance, N+1 Query, Reports, Business Central
summary: A loop that looks harmless can send thousands of extra SQL statements. Learn to spot the N+1 pattern in AL, measure it, and fix it four ways.
---

## The problem

A report or batch job runs fine in the test company with 50 customers. In production, with 20,000 customers, it takes minutes. The code looks innocent:

```al
procedure ListCustomerSales()
var
    Customer: Record Customer;
    CountryRegion: Record "Country/Region";
    CountryName: Text;
begin
    if Customer.FindSet() then
        repeat
            Customer.CalcFields("Sales (LCY)");                        // extra SQL statement for every customer
            if CountryRegion.Get(Customer."Country/Region Code") then  // another lookup for every customer
                CountryName := CountryRegion.Name
            else
                CountryName := '';

            // ... use Customer.Name, Customer."Sales (LCY)", CountryName ...
        until Customer.Next() = 0;
end;
```

Nothing here is wrong, and it returns the right answer. The slowness comes from *how many times* it talks to the database.

## What "N+1" means

- **1** query reads the list of parent records (the customers).
- **N** more queries run inside the loop, one for each parent, to fetch something related (the sales total, the country name).

```text
N+1 pattern (slow)                         Set-based (fast)
1 statement  -> read all customers         1 pass -> customers with their values
N statements -> CalcFields, one per row    nothing extra per row
```

The cost grows with the number of rows. A small test company hides it completely.

A rough illustration, assuming each extra statement costs about 1 ms (your real number depends on the environment): 20,000 customers with one `CalcFields` each adds about 20,000 statements, which is roughly 20 seconds from that line alone. A real system with table extensions, filters and a busy server is often slower than this.

## Spot it in your code

Look inside any `repeat ... until` loop, and inside `OnAfterGetRecord` triggers of reports and pages. These calls each cost database work **per row**:

| Call inside the loop | What happens | Better |
|----------------------|--------------|--------|
| `CalcFields`, `CalcSums`, `Count` | A separate SQL statement each time, unless the same calculation was done very recently and is cached | `SetAutoCalcFields` before the loop, or a query |
| `Get`, `FindFirst`, `Find` on a lookup table | One lookup per row. Repeated reads of the same key can come from the server cache, but it is still one call per row | Read the lookup table once into a `Dictionary` |
| `SetRange` / `SetFilter` on another table, then `FindSet` | A new query per parent record | One query with a join |
| Changing a filter on the table you are looping | The server throws away the result set it was reading | Set filters before the loop |
| `Modify`, `Insert`, `Delete` | A separate SQL statement per record | `ModifyAll` / `DeleteAll` where possible (see Gotchas) |

## How to prove it is N+1 (measure, don't guess)

**1. Count the SQL statements.** `SessionInformation` gives you the number of statements run in the session. Read it before and after the code:

```al
procedure MeasureSqlStatements()
var
    StatementsBefore: BigInteger;
    StatementsUsed: BigInteger;
begin
    StatementsBefore := SessionInformation.SqlStatementsExecuted();

    ListCustomerSales();

    StatementsUsed := SessionInformation.SqlStatementsExecuted() - StatementsBefore;
    Message('SQL statements used: %1', StatementsUsed);
end;
```

If the number grows with the number of customers, you have found it. After each fix below, run it again and compare. `SessionInformation.SqlRowsRead()` works the same way for rows.

**2. Look at hit counts in the AL Profiler.** In Visual Studio Code, an *instrumentation* profile has a **Hit count** column. A line inside your loop with a hit count equal to the number of customers is the signature of N+1. Sampling profiles do not show hit counts, but they do show SQL activity. In the web client you can also record a profile from the **Performance Profiler** page.

**3. Do not rely on slow-query telemetry alone.** Long-running SQL query telemetry flags individual queries that are slow. In an N+1 problem every query is fast; there are just far too many of them, so it can stay quiet while users wait.

## Fix 1: let the server calculate FlowFields while reading

`SetAutoCalcFields` tells the server to calculate the FlowFields as the records are retrieved, so you no longer need a separate `CalcFields` per row.

```al
Customer.SetAutoCalcFields("Sales (LCY)");
if Customer.FindSet() then
    repeat
        // Customer."Sales (LCY)" is already calculated here, no CalcFields needed
    until Customer.Next() = 0;
```

Set it **before** `FindSet`, and remove the `CalcFields` call from inside the loop.

## Fix 2: read lookup tables once into a Dictionary

If every row needs a name from a small table (country, currency, payment terms, unit of measure), load that table one time and look values up in memory.

```al
procedure ListCustomerSales()
var
    Customer: Record Customer;
    CountryRegion: Record "Country/Region";
    CountryNames: Dictionary of [Code[10], Text];
    CountryName: Text;
begin
    // 1) Read the small lookup table once
    CountryRegion.SetLoadFields(Name);
    if CountryRegion.FindSet() then
        repeat
            CountryNames.Add(CountryRegion.Code, CountryRegion.Name);
        until CountryRegion.Next() = 0;

    // 2) Let the server calculate the FlowField while it reads the customers
    Customer.SetAutoCalcFields("Sales (LCY)");
    if Customer.FindSet() then
        repeat
            if not CountryNames.Get(Customer."Country/Region Code", CountryName) then
                CountryName := '';

            // ... use Customer.Name, Customer."Sales (LCY)", CountryName ...
        until Customer.Next() = 0;
end;
```

This is the full corrected version of the procedure from the top. It uses Fixes 1 and 2 together. The per-row database calls are gone, and the in-memory lookup is fast. `Dictionary.Get` returns `false` when the key is missing, so a blank or unknown country code simply gives an empty name.

## Fix 3: one Query object with a join

When you need related data from another table, a query can read it in a single statement.

```al
query 50100 "ABC Customer Sales"
{
    QueryType = Normal;
    Caption = 'Customer Sales';

    elements
    {
        dataitem(Customer; Customer)
        {
            column(CustomerNo; "No.") { }
            column(CustomerName; Name) { }

            dataitem(CustLedgerEntry; "Cust. Ledger Entry")
            {
                DataItemLink = "Customer No." = Customer."No.";
                SqlJoinType = LeftOuterJoin;

                column(TotalSales; "Sales (LCY)")
                {
                    Method = Sum;
                }
            }
        }
    }
}
```

Replace `ABC` and `50100` with your own prefix and object ID. The columns without a method (`CustomerNo`, `CustomerName`) become the grouping, and `TotalSales` is summed per customer. Read it like this:

```al
procedure ListCustomerSalesWithQuery()
var
    CustomerSales: Query "ABC Customer Sales";
begin
    CustomerSales.Open();
    while CustomerSales.Read() do begin
        // CustomerSales.CustomerNo, CustomerSales.CustomerName, CustomerSales.TotalSales
    end;
    CustomerSales.Close();
end;
```

## Fix 4: in reports, move the calculation out of OnAfterGetRecord

Reports are where N+1 hides most often. A typical case is skipping rows with no sales:

```al
// Slow: a separate calculation for every customer
trigger OnAfterGetRecord()
begin
    CalcFields("Sales (LCY)");
    if "Sales (LCY)" = 0 then
        CurrReport.Skip();
end;
```

Calculate the FlowField as the data item is read, and keep the skip logic:

```al
// Better: calculated while the records are read
trigger OnPreDataItem()
begin
    SetAutoCalcFields("Sales (LCY)");
end;

trigger OnAfterGetRecord()
begin
    if "Sales (LCY)" = 0 then
        CurrReport.Skip();
end;
```

Use `CurrReport.Skip()`, not `exit`, to drop a record in a report trigger. If you can, go one step further and filter on the FlowField before reading (`SetFilter("Sales (LCY)", '<>0')`), so the customers you do not need are never read at all. That only pays off when the FlowField has a suitable SIFT index.

## Which fix should I use?

| Situation | Use |
|-----------|-----|
| Need a FlowField for most rows of the table you loop | Fix 1: `SetAutoCalcFields` |
| Need a name or value from a small lookup table | Fix 2: `Dictionary` |
| Need totals or fields from a related large table | Fix 3: `Query` with a join |
| Report with `CalcFields` in `OnAfterGetRecord` | Fix 4: `SetAutoCalcFields` in `OnPreDataItem` |

## Gotchas

- **Do not fix what is not slow.** A loop over 20 records with one `Get` inside is fine. Fix N+1 where the row count is large or keeps growing, and confirm with the statement counter first.
- **FlowFields still need good indexes.** `SetAutoCalcFields` removes the per-row round trip, but each sum or count FlowField still needs a suitable SIFT index to be fast on large tables.
- **Do not change filters inside the loop.** It forces the server to discard the result set it is reading.
- **`SetLoadFields` helps with a different problem.** It loads fewer columns per row, which is great for loops and reports, but it does not reduce the number of statements. It accepts normal fields only; passing a FlowField causes an error. Avoid it on records you are about to insert, delete or rename.
- **Queries are read-only and not cached.** Query results do not go through the server's primary key cache, and you cannot write through a query.
- **Keep Dictionaries for lookups, not whole tables.** Thousands of rows are fine. Do not load a million rows into memory.
- **The same pattern exists for writes.** A `Modify` per record is one statement per record. `ModifyAll` and `DeleteAll` can do it in far fewer statements, but they fall back to one record at a time when the table has trigger code, event subscribers on modify or delete events, active security filters, or certain field types. Check before relying on them.

## Takeaway

If the number of SQL statements grows with the number of rows, you have an N+1 problem. Count the statements, find the call inside the loop, and move that work out of the loop: let the server calculate the FlowField while reading, read lookups once into a `Dictionary`, or join the tables in a query.
