---
title: Ship a PermissionSet object with every extension
date: 2026-10-18
type: solution
tags: AL, Permissions, PTE
summary: A complete starter permission set so users can be assigned access the moment your extension is installed.
---

This example uses `ABC` as a placeholder prefix and `50100` as a placeholder ID. Replace both with your own.

## Requirement

Every per-tenant extension should carry its own permission set, so admins assign one object instead of granting rights table by table.

## Approach

Define an assignable `permissionset` in the extension. Add a `tabledata` line for each table the extension owns, plus the codeunits and pages users run.

## Full code

```al
permissionset 50100 "ABC All"
{
    Assignable = true;
    Caption = 'ABC - All Permissions';

    Permissions =
        tabledata "ABC Setup" = RIMD,
        codeunit "ABC Management" = X,
        page "ABC Setup" = X;
}
```

## Setup

1. Publish the extension to the tenant.
2. In Business Central search for **Permission Sets** and confirm `ABC All` is listed.
3. Open **Users**, select a user, and add `ABC All` under User Permission Sets.

## Notes

Keep a separate read-only set (for example `ABC Read`) for users who only need to view data.
