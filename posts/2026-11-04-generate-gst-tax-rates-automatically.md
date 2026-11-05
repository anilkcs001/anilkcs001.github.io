---
title: "I stopped filling GST rates in Excel: generating thousands of GST tax rates in Business Central automatically"
date: 2026-11-04
type: solution
tags: GST, India, Tax Engine, AL, Automation, Business Central
summary: One HSN code can need over 100 GST rate lines in Business Central, and a company has hundreds of HSN codes. Instead of exporting to Excel, filling rows and importing back, I built a generator that creates every rate from data BC already has. Here's why I built it, how it works, why the duplicate check matters so much, and how you can build your own.
---

If you've set up GST in Business Central for an Indian company, you know this moment.

Everything is ready: GST groups, HSN/SAC codes, states, registrations, posting setup. Then you open **Tax Types → GST → Tax Rates**, and you realise you still have to create the actual rate lines.

**Not a few lines. Tens of thousands.**

This post is about a small tool I built to make that problem disappear. It reads the data Business Central already has and creates every GST rate line automatically, without creating duplicates, and it's safe to run again and again.

I'll explain:

1. why this setup is so painful,
2. how the generator works,
3. why the **duplicate check** was the most important part,
4. and how you can build the same thing. **The full source code is at the end.**

---

## The problem: why GST rates are so many

In Business Central India, a GST rate isn't stored per item. It's stored for a **combination**:

> **GST Group + HSN/SAC + From State + Location State + Date**

(I explained this in [GST in Business Central: the 5 questions BC asks on every line](#/post/2026-11-06-gst-in-business-central-five-questions). Tax Rates answer question 4, *"How much?"*)

So one HSN code needs a separate line for **every pair of states** that can trade with each other. Let's count:

- India has about **36 states and union territories**. A vendor can be in any of them, so that's 36 possible **From States**.
- Say our company is registered in **3 states**. Those are our **Location States**.
- So one HSN needs **36 × 3 = 108** lines for domestic purchases.
- Plus **3** more lines with a blank From State, for imports.

That's **111 rate lines for a single HSN code.**

A normal manufacturing or trading company has **hundreds** of HSN codes. With 500 HSN codes:

> **500 × 111 = 55,500 rate lines.**

And each line has to say correctly whether it's **CGST + SGST** (same state) or **IGST** (different states), with the right percentages.

---

## How it's usually done (and why I didn't like it)

The common approach is:

1. Export the Tax Rates to Excel.
2. Fill in thousands of rows by hand or with Excel formulas: every HSN, every state pair, the right CGST, SGST and IGST.
3. Import the file back.
4. Hope nothing went wrong.

It works, but:

- **It's slow.** Building 55,000 correct rows takes days, even with formulas.
- **It's easy to get wrong.** One wrong state code, one IGST where it should be CGST + SGST, one missing row. Nobody notices until a user posts an invoice and the GST is wrong, or missing.
- **It never really ends.** A new HSN code, a new branch in another state, or a rate change means doing it all again.
- **It can create duplicates.** Import the same file twice, or overlap with rows someone added manually, and you get two lines for the same combination. Then the GST calculation becomes unpredictable. More on that below.

So I asked myself a simple question:

> **Business Central already knows the HSN codes, the GST groups and the states. Why are we typing the combinations by hand?**

---

## The idea: let the system build the rates

Everything needed to create a rate line already exists in Business Central:

| What a rate line needs | Where it already is |
|---|---|
| GST Group | On the **HSN/SAC** record |
| HSN/SAC code | The **HSN/SAC** list |
| From State | The **States** list (all states) |
| Location State | The states **we're registered in** |
| The rate (18%, 5%...) | In our setup, the **GST Group code** follows a naming rule like `G-18` or `G-0.25` |
| CGST + SGST or IGST | Simple logic: same state or not |

So the generator does what a person does in Excel, but in code:

```
For each selected HSN code:
    For each From State:
        For each of our Location States:
            Work out CGST, SGST, IGST
            If this rate doesn't exist yet → create it
    For each of our Location States:
        Create the import line (blank From State)
```

The user selects HSN codes on the HSN/SAC page, clicks **Generate GST Rates**, and the tool creates everything that's missing.

---

## Step 1: The inputs

I added two small things to existing tables, with a table extension:

1. **State → "Generate GST"** (Boolean). Tick it for the states where **we** are registered. These become the Location States.
2. **HSN/SAC → "GST Rates Generated"** (Boolean). The checker sets this, so users can see which HSN codes are complete.

For the **rate**, our GST group codes already followed a pattern: `G-5`, `G-18`, `G-0.25`, `G-1.5`. So the generator reads the rate from the code:

```al
// Reads the first number in the GST Group Code, including decimals: G-18 → 18, G-0.25 → 0.25
procedure ExtractGSTRate(InputString: Text): Decimal
```

If your GST groups don't follow a pattern, use a **rate field** on the GST group instead. The rest of the design stays the same.

---

## Step 2: Same state or different state?

For every combination, the generator decides the split:

```al
IsIntraState := (FromStateCode <> '') and (FromStateCode = ToStateCode);
HalfRate := GSTRate / 2;

SGSTRate := RateIf(IsIntraState, HalfRate);      // 9  for intra-state at 18%
CGSTRate := RateIf(IsIntraState, HalfRate);      // 9
IGSTRate := RateIf(not IsIntraState, GSTRate);   // 18 for inter-state and imports
```

- **Tamil Nadu → Tamil Nadu:** CGST 9 + SGST 9, IGST 0
- **Karnataka → Tamil Nadu:** IGST 18
- **Blank → Tamil Nadu (import):** IGST 18

This is exactly what you'd type in Excel, except the computer doesn't get tired at row 40,000.

---

## Step 3: Creating a rate the way Business Central does

This was the part I was most careful about. GST rates in BC India belong to the **Tax Engine**, and a rate isn't one simple record:

- **Tax Rate:** the header for one rate line (an ID, plus a **Tax Setup ID** and a **Tax Rate ID**)
- **Tax Rate Value:** one row per **column** (GST Group, HSN, From State, Location State, Date, SGST, CGST, IGST, POS flags...)

I didn't want to write these tables directly and risk data the Tax Rates page can't read. So the generator uses the same Microsoft codeunit the Tax Rates page uses, **Tax Setup Matrix Mgmt.**:

```al
TaxRate.Init();
TaxRate."Tax Type" := TaxType;
TaxRate.Insert(true);

TaxSetupMatrixMgmt.InitializeRateValue(TaxRate, TaxType);    // creates the column rows
// for each column:
TaxSetupMatrixMgmt.ValidateColumnValue(TaxRateSetup, Value);
TaxSetupMatrixMgmt.UpdateAndValidateRateValue(TaxRateValue, TaxRateSetup, XmlValue, IsRange);

TaxRate."Tax Setup ID" := TaxSetupMatrixMgmt.GenerateTaxSetupID(TaxRate.ID, TaxType);
TaxRate."Tax Rate ID" := TaxSetupMatrixMgmt.GenerateTaxRateID(TaxRate.ID, TaxType);
TaxRate.Modify();
TaxSetupMatrixMgmt.UpdateRateIDOnRateValue(TaxRate.ID, TaxRate."Tax Rate ID");
```

The result is a rate line that looks and behaves exactly like one entered on the Tax Rates page. Users can open it, edit it, and export it as usual.

---

## Why the duplicate check is the most important part

Creating rates is easy. Creating them **without duplicates**, every time, is the real work. Let me explain why it matters.

### What a duplicate does to an invoice

When Business Central calculates GST on a line, it looks for the rate row that matches the GST group, HSN, states and POS flags, and picks the one with the **latest date on or before the document date**.

Now imagine there are **two** rows for the same combination:

- **Different dates, different rates:** the newer one silently wins. If someone added a wrong row with a newer date, every invoice uses the wrong rate, and nobody sees an error.
- **Same date:** Business Central has no rule to choose between them. Which one it picks is effectively **random**. The same invoice could calculate differently on different days.

So a duplicate isn't just "extra data". It's **wrong or unpredictable GST** on real invoices. That's why I spent more time on duplicate prevention than on generation.

### How Business Central identifies a rate

To prevent duplicates, I first needed to understand how BC itself tells two rates apart. The answer is the **Tax Setup ID** on the Tax Rate record. Reading Microsoft's Tax Engine code, it's built from the column values in sequence:

```
GST Group | HSN | From State | To State | Date | POS Out of India | POS as Vendor State |
```

Two things surprised me:

1. **The rate percentage is NOT part of it.** Two rows with the same combination but different rates have the same identity.
2. **The date IS part of it.** The same combination with a different start date counts as a **different** rate.

That second point is where duplicates sneak in. If an old row exists from **1 April 2023** and the generator creates one from **1 April 2024**, BC sees two different rates, while the business sees the same thing twice.

### My duplicate key: the Tax Setup ID without the date

So the generator uses its own **business key**: the Tax Setup ID with the date removed.

```
G-18 | 9403 | KA | TN | (date removed) | No | No |
```

If **any** row with this key exists, on **any** date, the generator **skips** it. It never creates a second rate for the same combination.

```al
local procedure CreateSingleRate(...)
begin
    BuildAttributeValues(AttrValues, GSTGroupCode, HSNCode, FromStateCode, ToStateCode, GSTRate);
    BusinessKey := BuildBusinessKey(AttrValues);       // everything except the date
    if ExistingBusinessKeys.ContainsKey(BusinessKey) then begin
        SkippedCount += 1;                              // already there: don't touch it
        exit;
    end;

    // ... create the rate (Step 3) ...

    FinalizeRateId(TaxRate, BusinessKey);               // second safety check, see below
    ExistingBusinessKeys.Add(BusinessKey, true);        // remember it for the rest of this run
end;
```

### Fast: checking 55,000 combinations without 55,000 queries

Asking the database "does this rate exist?" 55,000 times would be very slow. So at the start of each run, the generator reads **all** existing GST rates **once** and keeps their business keys in a **Dictionary** in memory:

```al
local procedure CacheExistingBusinessKeys()
begin
    Clear(ExistingBusinessKeys);
    TaxRate.SetRange("Tax Type", TaxType);
    TaxRate.SetLoadFields("Tax Setup ID");             // read only the field we need
    if TaxRate.FindSet() then
        repeat
            BusinessKey := GetBusinessKey(TaxRate);    // Tax Setup ID without the date
            if (BusinessKey <> '') and not ExistingBusinessKeys.ContainsKey(BusinessKey) then
                ExistingBusinessKeys.Add(BusinessKey, true);
        until TaxRate.Next() = 0;
end;
```

Checking a Dictionary is instant, so the duplicate check costs almost nothing. And because it's reloaded **at the start of every run**, rates added manually since the last run are respected too.

One small detail: some old rows had an **empty** Tax Setup ID. Those would have been invisible to the check, so for them the key is rebuilt from their **Tax Rate Value** rows.

### A second safety net: let Microsoft check too

The in-memory check is fast, but I wanted a second line of defence. After a rate is created, `FinalizeRateId` does two things:

1. It calls Microsoft's **`GenerateTaxSetupID`**, which raises an error if a saved rate with the same Tax Setup ID already exists.
2. It compares the key Microsoft produced with the key the generator **expected**. If they don't match, the run **stops** with a clear error instead of silently saving something unexpected.

```al
local procedure FinalizeRateId(var TaxRate: Record "Tax Rate"; ExpectedBusinessKey: Text)
begin
    SetupID := TaxSetupMatrixMgmt.GenerateTaxSetupID(TaxRate.ID, TaxType);
    if RemoveDateFromKey(SetupID) <> ExpectedBusinessKey then
        Error(KeyMismatchErr, ExpectedBusinessKey, SetupID);
    ...
end;
```

> **Stop loudly rather than continue silently.** With tax data, a clear error is much better than a quiet wrong rate.

### A bug that taught me something

An earlier version of my duplicate check never matched rows created by a previous run. Re-runs were slow, and the generator kept creating and then deleting rows.

The cause was tiny. My key used `'NO'` for the POS flags, but the Tax Engine saves the value as `'No'`. Dictionary keys are case-sensitive, so `'NO'` and `'No'` never matched.

The fix was to build the value exactly the way BC formats it:

```al
AttrValues[11] := Format(false);   // POS Out of India → 'No', the same way BC stores it
AttrValues[12] := Format(false);   // POS as Vendor State
```

> **When you compare your data with system data, build it the same way the system does.** Don't type the value yourself.

---

## Safe to run again (and again)

Generating 55,000 rows takes time, and anything can happen halfway: a timeout, a lost connection, someone closing the browser.

So the generator **commits every 100 rates created**:

```al
CreatedCount += 1;
if CreatedCount mod 100 = 0 then
    Commit();
```

Together with the duplicate check, this makes the tool **safe to re-run**. If it stops at rate 23,400, you run it again. It skips the 23,400 that exist and creates only what's missing.

That also makes everyday changes easy:

- **New HSN code?** Select it and run the generator.
- **New branch in another state?** Tick **Generate GST** on that state and run it for all HSN codes. Only the new state's rows are added.

At the end, the user sees a simple summary:

```
GST rate generation completed.
Rates created: 3,330
Rates already present: 52,170
```

---

## The checker: is each HSN complete?

The generator creates rates. The **checker** answers a different question: *"Does this HSN code have every rate it needs?"*

For each selected HSN, it checks that every expected combination exists (all From States × our Location States, plus the blank-From rows), on any date. Then it sets **GST Rates Generated** = Yes or No on the HSN/SAC record. Finance can filter the HSN list on **GST Rates Generated = No** and see straight away which codes still need attention.

**A lesson from the checker:** in an early version, it marked almost **every** HSN as complete, which was wrong. The cause was that the code loaded all existing rates into one instance of the codeunit, but then ran the check on a **new, empty** instance. With nothing loaded, "every expected rate exists" was always true.

> **If a check always says "everything is fine", test it with something that's definitely not fine.**

---

## The duplicate review page

The generator prevents **new** duplicates. But what about duplicates that already existed, from old Excel imports or manual entries?

For that I added a read-only page, **GST Rate Duplicates**. It groups all GST rates by the business key and shows only groups with more than one row, labelled by type:

| Issue | What it means | What to do |
|---|---|---|
| **Same Date** | A true duplicate. BC can't choose between them, so the result is unpredictable | Keep one row, delete the other |
| **Different Date, Different Rate** | The newer row wins from its date. This might be a real rate change | Check it's intended |
| **Different Date, Same Rate** | Redundant, but the calculated GST is the same | Remove it if not needed |

The page **never deletes anything**. It only shows. Deleting tax rates is a finance decision, so the tool gives the information and lets people decide.

**My advice:** open this page **before** running the generator for the first time in any company. It tells you how clean your existing rates are.

---

## Before and after

| | Excel export / import | Generator |
|---|---|---|
| Time for 500 HSN codes | Days | Minutes |
| CGST/SGST vs IGST | Formulas, easy to break | Fixed logic, the same every time |
| New HSN code | Edit the sheet and re-import | Select it and click Generate |
| New state | Rebuild many rows | Tick one checkbox and run |
| Duplicates | Easy to create by accident | Prevented, with a review page for old ones |
| Halfway failure | Unclear what was imported | Just run it again |
| Is each HSN complete? | Hard to tell | **GST Rates Generated** flag |

---

## Want to build your own? Here's the recipe

You can copy the **full source code** at the end of this post. But if you want to build your own version, these are the pieces that matter:

1. **Mark your registration states.** Add a Boolean like **Generate GST** to the State table.
2. **Decide where the rate comes from.** A naming rule in the GST group code (like `G-18`), or a rate field on the GST group.
3. **Read the column order from the Tax Engine setup, don't hard-code it.** The Tax Rate Column Setup table, sorted by **Sequence**, tells you the order of the columns, and where the **date** column is.
4. **Build a business key = Tax Setup ID without the date.** This is your duplicate check.
5. **Load all existing keys into a Dictionary once per run.** Reload it every run, so manual changes are respected.
6. **Create rates through Tax Setup Matrix Mgmt.**, the same as the Tax Rates page: `InitializeRateValue`, `ValidateColumnValue`, `UpdateAndValidateRateValue`, `GenerateTaxSetupID`, `GenerateTaxRateID`.
7. **Double-check after saving.** Compare the generated Tax Setup ID with your expected key, and stop on a mismatch.
8. **Commit every 100 rates**, so a re-run picks up where it stopped.
9. **Add a checker** that flags incomplete HSN codes, and a **read-only duplicate page** for existing data.
10. **Give it a PermissionSet** with access to Tax Rate, Tax Rate Value, Tax Rate Column Setup, GST Setup, HSN/SAC and State.

---

## Limitations, and what I'd improve next

I want to be honest about what this version doesn't do:

- **The effective date is fixed.** All generated rates start from one date (1 April 2024 in my case). A setup field would be better.
- **It doesn't handle rate changes.** Because the date is excluded from the key, the generator **skips** any combination that already exists, even if the rate has changed. For example, when many GST rates changed on **22 September 2025**, the new dated rows had to be added separately. The next improvement would be: *"if the latest row has a different rate, add a new row from the new date."*
- **Run it from one session at a time.** Two users running it together could still create duplicates, because each run has its own in-memory list.
- **It depends on Microsoft's GST column setup.** If Microsoft changes the GST column configuration in a future version, the code needs checking. The **Tax Setup Matrix Mgmt.** procedures are what the standard Tax Rates page uses, but they aren't documented as a supported API, so test after every major upgrade.
- **Language matters.** Yes/No values are stored as text, so run it in the same language that was used to create the existing rates.

As always: **try it in a sandbox first**, compare a few generated rates with the Tax Rates page, and post a test invoice for an intra-state, an inter-state and an import case before you trust it in production.

---

## Why I'm sharing this

GST setup is one of those tasks every Indian Business Central project goes through, and most teams solve it with a big Excel file and a lot of patience. It isn't difficult work, but it's long, repetitive and risky, which is exactly the kind of work a system should do for us.

The biggest lesson for me wasn't the loops that create the rates. It was understanding **how Business Central identifies a rate**, and building the tool around that, so it never makes the data worse.

If you've automated GST setup in a different way, or you'd like more detail on any part, tell me in the comments. I'd be happy to discuss it.


---

## Full source code

Here is the complete code, ready to copy. It's ten small objects. Change the **ABC** prefix and the IDs (50300–50309) to match your own extension.

**Before you use it:**

- Your extension must depend on Microsoft's **India GST**, **India Tax Base** and **Tax Engine** apps (see the `app.json` below).
- Build it and test it in a **sandbox** first. Compare a few generated rates with the Tax Rates page, and post test invoices for intra-state, inter-state and import cases.
- Check the effective date in `Initialize()` in the generator.
- Make sure your GST Group codes contain the rate (like `G-18`), or change `ExtractGSTRate` to read it from a field.

### app.json

```json
{
  "id": "6f2c1d8e-4b7a-4e39-9a51-2c8d7e3f0b64",
  "name": "ABC GST Rate Generator",
  "publisher": "ABC",
  "version": "1.0.0.0",
  "brief": "Generates GST tax rates in bulk from HSN/SAC codes and states.",
  "description": "Creates the missing GST Tax Engine rates for selected HSN/SAC codes, checks that each HSN/SAC code has all its rates, and lists duplicate rates for review.",
  "privacyStatement": "",
  "EULA": "",
  "help": "",
  "url": "",
  "logo": "",
  "dependencies": [
    {
      "id": "db643212-b7fb-4dd4-b5a8-cb44ac714461",
      "name": "India GST",
      "publisher": "Microsoft",
      "version": "25.0.0.0"
    },
    {
      "id": "d3c551dd-5903-4194-b153-04ced9d29a2c",
      "name": "India Tax Base",
      "publisher": "Microsoft",
      "version": "25.0.0.0"
    },
    {
      "id": "c1eafb3f-e397-468e-bdb4-ecc5c317ca00",
      "name": "Tax Engine",
      "publisher": "Microsoft",
      "version": "25.0.0.0"
    }
  ],
  "screenshots": [],
  "platform": "25.0.0.0",
  "application": "25.0.0.0",
  "idRanges": [
    {
      "from": 50300,
      "to": 50309
    }
  ],
  "runtime": "14.0",
  "target": "Cloud",
  "features": [
    "NoImplicitWith"
  ]
}
```

### ABCState.TableExt.al

Adds **Generate GST** to the State table. Tick it for the states where your company is registered.

```al
tableextension 50300 "ABC State" extends State
{
    fields
    {
        field(50300; "ABC Generate GST"; Boolean)
        {
            Caption = 'Generate GST';
            DataClassification = CustomerContent;
            ToolTip = 'Specifies that the company is registered for GST in this state, so GST rates are generated with this state as the location state.';
        }
    }
}
```

### ABCHSNSAC.TableExt.al

Adds **GST Rates Generated** to HSN/SAC. The checker fills it.

```al
tableextension 50301 "ABC HSN/SAC" extends "HSN/SAC"
{
    fields
    {
        field(50300; "ABC GST Rates Generated"; Boolean)
        {
            Caption = 'GST Rates Generated';
            DataClassification = CustomerContent;
            Editable = false;
            ToolTip = 'Specifies whether every expected GST rate exists for this HSN/SAC code. The Check GST Rates action updates this field.';
        }
    }
}
```

### ABCStates.PageExt.al

Shows **Generate GST** on the States page.

```al
pageextension 50300 "ABC States" extends States
{
    layout
    {
        addafter(Description)
        {
            field("ABC Generate GST"; Rec."ABC Generate GST")
            {
                ApplicationArea = All;
            }
        }
    }
}
```

### ABCHSNSAC.PageExt.al

Adds the **GST Rates** actions to the HSN/SAC page: generate, generate imports only, check, and review duplicates.

```al
pageextension 50301 "ABC HSN/SAC" extends "HSN/SAC"
{
    layout
    {
        addlast(General)
        {
            field("ABC GST Rates Generated"; Rec."ABC GST Rates Generated")
            {
                ApplicationArea = All;
            }
        }
    }

    actions
    {
        addlast(Processing)
        {
            group(ABCGSTRates)
            {
                Caption = 'GST Rates';
                Image = Setup;

                action(ABCGenerateRates)
                {
                    ApplicationArea = All;
                    Caption = 'Generate GST Rates';
                    Image = Process;
                    ToolTip = 'Create the missing domestic and import GST rates for the selected HSN/SAC codes. Existing rates are never changed or duplicated.';

                    trigger OnAction()
                    var
                        HSNSAC: Record "HSN/SAC";
                        GSTRateGenerator: Codeunit "ABC GST Rate Generator";
                    begin
                        CurrPage.SetSelectionFilter(HSNSAC);
                        GSTRateGenerator.RunDomesticGeneration(HSNSAC);
                    end;
                }
                action(ABCGenerateImportRates)
                {
                    ApplicationArea = All;
                    Caption = 'Generate Import GST Rates Only';
                    Image = Import;
                    ToolTip = 'Create only the missing import GST rates (blank From State) for the selected HSN/SAC codes.';

                    trigger OnAction()
                    var
                        HSNSAC: Record "HSN/SAC";
                        GSTRateGenerator: Codeunit "ABC GST Rate Generator";
                    begin
                        CurrPage.SetSelectionFilter(HSNSAC);
                        GSTRateGenerator.RunImportGeneration(HSNSAC);
                    end;
                }
                action(ABCCheckRates)
                {
                    ApplicationArea = All;
                    Caption = 'Check GST Rates';
                    Image = CheckList;
                    ToolTip = 'Check whether every expected GST rate exists for the selected HSN/SAC codes, and update the GST Rates Generated field.';

                    trigger OnAction()
                    var
                        HSNSAC: Record "HSN/SAC";
                        GSTRateChecker: Codeunit "ABC GST Rate Checker";
                    begin
                        CurrPage.SetSelectionFilter(HSNSAC);
                        GSTRateChecker.RunGSTRateCheck(HSNSAC);
                        CurrPage.Update(false);
                    end;
                }
                action(ABCRateDuplicates)
                {
                    ApplicationArea = All;
                    Caption = 'GST Rate Duplicates';
                    Image = Copy;
                    RunObject = page "ABC GST Rate Duplicates";
                    ToolTip = 'Review GST rates that exist more than once for the same GST group, HSN/SAC, states and POS flags. Nothing is changed or deleted.';
                }
            }
        }
    }
}
```

### ABCGSTRateGenerator.Codeunit.al

The generator: builds every combination, checks the business key, and creates missing rates through Microsoft's Tax Setup Matrix Mgmt.

```al
codeunit 50300 "ABC GST Rate Generator"
{
    Permissions =
        tabledata "GST Setup" = R,
        tabledata "HSN/SAC" = R,
        tabledata State = R,
        tabledata "Tax Rate" = RIM,
        tabledata "Tax Rate Column Setup" = R,
        tabledata "Tax Rate Value" = RIM;

    var
        GSTSetup: Record "GST Setup";
        CachedColumnSetup: array[20] of Record "Tax Rate Column Setup";
        TaxSetupMatrixMgmt: Codeunit "Tax Setup Matrix Mgmt.";
        ExistingBusinessKeys: Dictionary of [Text, Boolean];
        ColumnIDToIndex: Dictionary of [Integer, Integer];
        SetupColumnOrder: List of [Integer];
        FromStateCodes: List of [Code[20]];
        ToStateCodes: List of [Code[20]];
        AttributeCaption: array[20] of Text;
        AttributeValue: array[20] of Text;
        AttributeID: array[20] of Integer;
        RangeAttribute: array[20] of Boolean;
        ColumnSetupLoaded: array[20] of Boolean;
        TaxType: Code[20];
        EffectiveDate: Date;
        ColumnCount: Integer;
        DateKeyPosition: Integer;
        CreatedCount: Integer;
        SkippedCount: Integer;
        IsInitialized: Boolean;
        SetupColumnsLoaded: Boolean;
        RateSetupNotFoundErr: Label 'Rate Setup does not exist with Column ID %1 for Tax Type %2.', Comment = '%1 = Column ID, %2 = Tax Type';
        NoGSTStatesErr: Label 'No states found with "Generate GST" enabled. Open the States page and select the states where your company is registered.';
        NoDateColumnErr: Label 'No date column was found in the Tax Rate Column Setup for Tax Type %1.', Comment = '%1 = Tax Type';
        KeyMismatchErr: Label 'The generated rate does not match its expected key.\Expected: %1\Saved: %2', Comment = '%1 = Expected key without the date, %2 = Saved Tax Setup ID';
        InvalidGSTGroupErr: Label 'A valid GST rate could not be read from GST Group Code %1.', Comment = '%1 = GST Group Code';
        GenerationProgressMsg: Label 'Processing... @1@@@@@@@@@@@@\GST Group: #2###################\HSN/SAC Code: #3###################\HSN Records Processed: #4##########\Total HSN Records: #5##########';
        GenerationCompleteMsg: Label 'GST rate generation completed.\Rates created: %1\Rates already present: %2', Comment = '%1 = Created count, %2 = Skipped count';

    procedure RunDomesticGeneration(var HSNSAC: Record "HSN/SAC")
    begin
        RunGeneration(HSNSAC, true);
    end;

    procedure RunImportGeneration(var HSNSAC: Record "HSN/SAC")
    begin
        RunGeneration(HSNSAC, false);
    end;

    /// <summary>Reads the first number in the GST Group Code, including decimals such as G-0.25 or G-1.5.</summary>
    procedure ExtractGSTRate(InputString: Text): Decimal
    var
        NumericPart: Text;
        Char: Text[1];
        NextChar: Text[1];
        I: Integer;
        Result: Decimal;
        HasDecimalPoint: Boolean;
    begin
        for I := 1 to StrLen(InputString) do begin
            Char := CopyStr(InputString, I, 1);
            NextChar := CopyStr(InputString, I + 1, 1);
            if IsDigit(Char) then
                NumericPart += Char
            else
                if (Char = '.') and (not HasDecimalPoint) and IsDigit(NextChar) then begin
                    if NumericPart = '' then
                        NumericPart := '0';
                    NumericPart += Char;
                    HasDecimalPoint := true;
                end else
                    if NumericPart <> '' then
                        break;
        end;

        if NumericPart = '' then
            exit(0);

        if not Evaluate(Result, NumericPart, 9) then
            Error(InvalidGSTGroupErr, InputString);
        if Result > 100 then
            Error(InvalidGSTGroupErr, InputString);
        exit(Result);
    end;

    /// <summary>Loads rate columns, existing rates and states. Re-reads the database on every call.</summary>
    procedure InitializeAll()
    begin
        InitializeForKeys();
        PreloadAllColumnSetups();
        CacheExistingBusinessKeys();
        PreloadStates();
        CreatedCount := 0;
        SkippedCount := 0;
    end;

    /// <summary>Loads only what GetBusinessKey needs.</summary>
    procedure InitializeForKeys()
    begin
        Initialize();
        BuildColumnIDMapping();
        LoadSetupColumnOrder();
    end;

    procedure GetTaxType(): Code[20]
    begin
        exit(TaxType);
    end;

    /// <summary>Returns the rate's identity with the date removed. Call InitializeForKeys first.</summary>
    procedure GetBusinessKey(TaxRate: Record "Tax Rate"): Text
    var
        SetupID: Text;
    begin
        SetupID := TaxRate."Tax Setup ID";
        if SetupID = '' then
            SetupID := BuildSetupIDFromDB(TaxRate.ID);
        exit(RemoveDateFromKey(SetupID));
    end;

    /// <summary>True when every From State x To State row and blank From State x To State row exists, on any date. Call InitializeAll first.</summary>
    procedure AllDomesticRatesExist(GSTGroupCode: Code[20]; HSNCode: Code[20]): Boolean
    var
        FromStateCode: Code[20];
        ToStateCode: Code[20];
    begin
        foreach ToStateCode in ToStateCodes do begin
            if not RateExists(GSTGroupCode, HSNCode, '', ToStateCode) then
                exit(false);
            foreach FromStateCode in FromStateCodes do
                if not RateExists(GSTGroupCode, HSNCode, FromStateCode, ToStateCode) then
                    exit(false);
        end;
        exit(true);
    end;

    local procedure RunGeneration(var HSNSAC: Record "HSN/SAC"; IsDomestic: Boolean)
    var
        Window: Dialog;
        TotalCount: Integer;
        I: Integer;
    begin
        InitializeAll();
        TotalCount := HSNSAC.Count();

        Window.Open(GenerationProgressMsg);
        Window.Update(5, TotalCount);
        if HSNSAC.FindSet() then
            repeat
                I += 1;
                Window.Update(1, Round(I / TotalCount * 10000, 1));
                Window.Update(2, HSNSAC."GST Group Code");
                Window.Update(3, HSNSAC.Code);
                Window.Update(4, I);
                if IsDomestic then
                    GenerateDomesticRates(HSNSAC."GST Group Code", HSNSAC.Code, ExtractGSTRate(HSNSAC."GST Group Code"))
                else
                    GenerateImportRates(HSNSAC."GST Group Code", HSNSAC.Code, ExtractGSTRate(HSNSAC."GST Group Code"));
            until HSNSAC.Next() = 0;

        Commit();
        Window.Close();
        Message(GenerationCompleteMsg, CreatedCount, SkippedCount);
    end;

    local procedure GenerateDomesticRates(GSTGroupCode: Code[20]; HSNCode: Code[20]; GSTRate: Decimal)
    var
        FromStateCode: Code[20];
        ToStateCode: Code[20];
    begin
        foreach FromStateCode in FromStateCodes do
            foreach ToStateCode in ToStateCodes do
                CreateSingleRate(GSTGroupCode, HSNCode, GSTRate, FromStateCode, ToStateCode);

        GenerateImportRates(GSTGroupCode, HSNCode, GSTRate);
    end;

    local procedure GenerateImportRates(GSTGroupCode: Code[20]; HSNCode: Code[20]; GSTRate: Decimal)
    var
        ToStateCode: Code[20];
    begin
        foreach ToStateCode in ToStateCodes do
            CreateSingleRate(GSTGroupCode, HSNCode, GSTRate, '', ToStateCode);
    end;

    local procedure CreateSingleRate(GSTGroupCode: Code[20]; HSNCode: Code[20]; GSTRate: Decimal; FromStateCode: Code[20]; ToStateCode: Code[20])
    var
        TaxRate: Record "Tax Rate";
        AttrValues: array[20] of Text[250];
        BusinessKey: Text;
    begin
        BuildAttributeValues(AttrValues, GSTGroupCode, HSNCode, FromStateCode, ToStateCode, GSTRate);
        BusinessKey := BuildBusinessKey(AttrValues);
        if ExistingBusinessKeys.ContainsKey(BusinessKey) then begin
            SkippedCount += 1;
            exit;
        end;

        TaxRate := CreateTaxRateRecord();
        TaxSetupMatrixMgmt.InitializeRateValue(TaxRate, TaxType);
        WriteAllColumnValues(TaxRate.ID, AttrValues);
        FinalizeRateId(TaxRate, BusinessKey);
        ExistingBusinessKeys.Add(BusinessKey, true);

        CreatedCount += 1;
        if CreatedCount mod 100 = 0 then
            Commit();
    end;

    local procedure RateExists(GSTGroupCode: Code[20]; HSNCode: Code[20]; FromStateCode: Code[20]; ToStateCode: Code[20]): Boolean
    var
        AttrValues: array[20] of Text[250];
    begin
        BuildAttributeValues(AttrValues, GSTGroupCode, HSNCode, FromStateCode, ToStateCode, 0);
        exit(ExistingBusinessKeys.ContainsKey(BuildBusinessKey(AttrValues)));
    end;

    local procedure Initialize()
    begin
        if IsInitialized then
            exit;

        GSTSetup.Get();
        GSTSetup.TestField("GST Tax Type");
        TaxType := GSTSetup."GST Tax Type";
        // All generated rates start from this date. Change it to suit your company.
        EffectiveDate := DMY2Date(1, 4, 2024);
        TaxSetupMatrixMgmt.FillColumnArray(TaxType, AttributeCaption, AttributeValue, RangeAttribute, AttributeID, ColumnCount);
        IsInitialized := true;
    end;

    local procedure BuildColumnIDMapping()
    var
        I: Integer;
    begin
        Clear(ColumnIDToIndex);
        for I := 1 to ColumnCount do
            if not ColumnIDToIndex.ContainsKey(AttributeID[I]) then
                ColumnIDToIndex.Add(AttributeID[I], I);
    end;

    local procedure PreloadAllColumnSetups()
    var
        TaxRateSetup: Record "Tax Rate Column Setup";
        I: Integer;
    begin
        Clear(ColumnSetupLoaded);
        TaxRateSetup.SetRange("Tax Type", TaxType);
        if TaxRateSetup.FindSet() then
            repeat
                for I := 1 to ColumnCount do
                    if (AttributeID[I] = TaxRateSetup."Column ID") and (not ColumnSetupLoaded[I]) then begin
                        CachedColumnSetup[I] := TaxRateSetup;
                        ColumnSetupLoaded[I] := true;
                    end;
            until TaxRateSetup.Next() = 0;

        for I := 1 to ColumnCount do
            if not ColumnSetupLoaded[I] then
                Error(RateSetupNotFoundErr, AttributeID[I], TaxType);
    end;

    local procedure LoadSetupColumnOrder()
    var
        TaxRateColumnSetup: Record "Tax Rate Column Setup";
        ProcessedColumnIDs: Dictionary of [Integer, Boolean];
        AttrIndex: Integer;
    begin
        if SetupColumnsLoaded then
            exit;

        Clear(SetupColumnOrder);
        DateKeyPosition := 0;
        TaxRateColumnSetup.SetCurrentKey(Sequence);
        TaxRateColumnSetup.SetRange("Tax Type", TaxType);
        TaxRateColumnSetup.SetFilter("Column Type", '%1|%2|%3|%4|%5',
            TaxRateColumnSetup."Column Type"::"Tax Attributes",
            TaxRateColumnSetup."Column Type"::Value,
            TaxRateColumnSetup."Column Type"::"Range From",
            TaxRateColumnSetup."Column Type"::"Range From and Range To",
            TaxRateColumnSetup."Column Type"::"Range To");

        if TaxRateColumnSetup.FindSet() then
            repeat
                if ColumnIDToIndex.Get(TaxRateColumnSetup."Column ID", AttrIndex) then
                    if not ProcessedColumnIDs.ContainsKey(TaxRateColumnSetup."Column ID") then begin
                        SetupColumnOrder.Add(AttrIndex);
                        ProcessedColumnIDs.Add(TaxRateColumnSetup."Column ID", true);
                        if TaxRateColumnSetup.Type = TaxRateColumnSetup.Type::Date then
                            DateKeyPosition := SetupColumnOrder.Count();
                    end;
            until TaxRateColumnSetup.Next() = 0;

        if DateKeyPosition = 0 then
            Error(NoDateColumnErr, TaxType);

        SetupColumnsLoaded := true;
    end;

    local procedure PreloadStates()
    var
        State: Record State;
    begin
        Clear(ToStateCodes);
        Clear(FromStateCodes);

        State.SetRange("ABC Generate GST", true);
        if not State.FindSet() then
            Error(NoGSTStatesErr);
        repeat
            ToStateCodes.Add(State.Code);
        until State.Next() = 0;

        State.Reset();
        if State.FindSet() then
            repeat
                FromStateCodes.Add(State.Code);
            until State.Next() = 0;
    end;

    local procedure CacheExistingBusinessKeys()
    var
        TaxRate: Record "Tax Rate";
        BusinessKey: Text;
    begin
        Clear(ExistingBusinessKeys);
        TaxRate.SetRange("Tax Type", TaxType);
        TaxRate.SetLoadFields("Tax Setup ID");
        if TaxRate.FindSet() then
            repeat
                BusinessKey := GetBusinessKey(TaxRate);
                if BusinessKey <> '' then
                    if not ExistingBusinessKeys.ContainsKey(BusinessKey) then
                        ExistingBusinessKeys.Add(BusinessKey, true);
            until TaxRate.Next() = 0;
    end;

    local procedure CreateTaxRateRecord() TaxRate: Record "Tax Rate"
    begin
        TaxRate.Init();
        TaxRate."Tax Type" := TaxType;
        TaxRate.Insert(true);
    end;

    local procedure WriteAllColumnValues(ConfigId: Guid; var AttrValues: array[20] of Text[250])
    var
        TaxRateValue: Record "Tax Rate Value";
        TaxRateSetup: Record "Tax Rate Column Setup";
        XmlValue: Text;
        ColIndex: Integer;
    begin
        TaxRateValue.SetRange("Tax Type", TaxType);
        TaxRateValue.SetRange("Config ID", ConfigId);
        if not TaxRateValue.FindSet() then
            exit;

        repeat
            if ColumnIDToIndex.Get(TaxRateValue."Column ID", ColIndex) then begin
                TaxRateSetup := CachedColumnSetup[ColIndex];
                TaxSetupMatrixMgmt.ValidateColumnValue(TaxRateSetup, AttrValues[ColIndex]);
                XmlValue := ToXmlValue(AttrValues[ColIndex], ColIndex);
                TaxSetupMatrixMgmt.UpdateAndValidateRateValue(TaxRateValue, TaxRateSetup, XmlValue, RangeAttribute[ColIndex]);
                TaxRateValue.Modify();
            end;
        until TaxRateValue.Next() = 0;
    end;

    local procedure FinalizeRateId(var TaxRate: Record "Tax Rate"; ExpectedBusinessKey: Text)
    var
        SetupID: Text[2000];
    begin
        // Microsoft's procedure raises an error if a committed rate already has this Tax Setup ID.
        SetupID := TaxSetupMatrixMgmt.GenerateTaxSetupID(TaxRate.ID, TaxType);
        if RemoveDateFromKey(SetupID) <> ExpectedBusinessKey then
            Error(KeyMismatchErr, ExpectedBusinessKey, SetupID);

        TaxRate."Tax Setup ID" := SetupID;
        TaxRate."Tax Rate ID" := TaxSetupMatrixMgmt.GenerateTaxRateID(TaxRate.ID, TaxType);
        TaxRate.Modify();
        TaxSetupMatrixMgmt.UpdateRateIDOnRateValue(TaxRate.ID, TaxRate."Tax Rate ID");
    end;

    local procedure BuildAttributeValues(var AttrValues: array[20] of Text[250]; GSTGroupCode: Code[20]; HSNCode: Code[20]; FromStateCode: Code[20]; ToStateCode: Code[20]; GSTRate: Decimal)
    var
        IsIntraState: Boolean;
        HalfRate: Decimal;
    begin
        IsIntraState := (FromStateCode <> '') and (FromStateCode = ToStateCode);
        HalfRate := GSTRate / 2;

        // Positions follow the Sequence order in Microsoft's GST tax type configuration.
        AttrValues[1] := GSTGroupCode;
        AttrValues[2] := HSNCode;
        AttrValues[3] := FromStateCode;
        AttrValues[4] := ToStateCode;
        AttrValues[5] := Format(EffectiveDate);
        AttrValues[6] := '';
        AttrValues[7] := RateText(IsIntraState, HalfRate);
        AttrValues[8] := RateText(IsIntraState, HalfRate);
        AttrValues[9] := RateText(not IsIntraState, GSTRate);
        AttrValues[10] := '0';
        AttrValues[11] := Format(false);
        AttrValues[12] := Format(false);
    end;

    local procedure RateText(ApplyRate: Boolean; Rate: Decimal): Text
    begin
        if ApplyRate then
            exit(Format(Rate));
        exit('0');
    end;

    local procedure ToXmlValue(Value: Text; ColumnIndex: Integer): Text
    var
        DateValue: Date;
    begin
        if ColumnIndex = 5 then begin
            Evaluate(DateValue, Value);
            exit(Format(DateValue, 0, 9));
        end;
        exit(Value);
    end;

    local procedure BuildBusinessKey(var AttrValues: array[20] of Text[250]) Result: Text
    var
        AttrIndex: Integer;
        Position: Integer;
    begin
        foreach AttrIndex in SetupColumnOrder do begin
            Position += 1;
            if Position <> DateKeyPosition then
                Result += AttrValues[AttrIndex] + '|';
        end;
    end;

    local procedure RemoveDateFromKey(SetupID: Text) Result: Text
    var
        Parts: List of [Text];
        I: Integer;
    begin
        if SetupID = '' then
            exit('');

        // Every value ends with '|', so the last element after Split is empty.
        Parts := SetupID.Split('|');
        for I := 1 to Parts.Count() - 1 do
            if I <> DateKeyPosition then
                Result += Parts.Get(I) + '|';
    end;

    local procedure BuildSetupIDFromDB(ConfigID: Guid) Result: Text
    var
        TaxRateValue: Record "Tax Rate Value";
        AttrIndex: Integer;
    begin
        foreach AttrIndex in SetupColumnOrder do begin
            TaxRateValue.Reset();
            TaxRateValue.SetRange("Tax Type", TaxType);
            TaxRateValue.SetRange("Config ID", ConfigID);
            TaxRateValue.SetRange("Column ID", AttributeID[AttrIndex]);
            if TaxRateValue.FindFirst() then
                Result += TaxRateValue.Value + '|';
        end;
    end;

    local procedure IsDigit(Char: Text[1]): Boolean
    begin
        exit(Char in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    end;
}
```

### ABCGSTRateChecker.Codeunit.al

The checker: marks each HSN/SAC code as complete or not.

```al
codeunit 50301 "ABC GST Rate Checker"
{
    Permissions =
        tabledata "HSN/SAC" = RM,
        tabledata State = R,
        tabledata "Tax Rate" = R,
        tabledata "Tax Rate Value" = R;

    var
        GSTRateGenerator: Codeunit "ABC GST Rate Generator";
        IsInitialized: Boolean;
        CheckProgressMsg: Label 'Checking GST Rates...\HSN Code: #1########\Progress: #2### of #3###';
        NoRecordsSelectedMsg: Label 'No records selected.';
        CheckCompleteMsg: Label 'GST Rate check completed.\HSN records checked: %1\Skipped at 0%: %2', Comment = '%1 = Checked count, %2 = Skipped count';

    procedure RunGSTRateCheck(var HSNSAC: Record "HSN/SAC")
    var
        ProgressDialog: Dialog;
        TotalRecords: Integer;
        CurrentRecord: Integer;
        CheckedCount: Integer;
    begin
        TotalRecords := HSNSAC.Count();
        if TotalRecords = 0 then begin
            Message(NoRecordsSelectedMsg);
            exit;
        end;

        // Re-read the rates on every run instead of reusing an earlier cache.
        IsInitialized := false;
        Initialize();

        ProgressDialog.Open(CheckProgressMsg);
        ProgressDialog.Update(3, TotalRecords);
        if HSNSAC.FindSet() then
            repeat
                CurrentRecord += 1;
                ProgressDialog.Update(1, HSNSAC.Code);
                ProgressDialog.Update(2, CurrentRecord);
                if GSTRateGenerator.ExtractGSTRate(HSNSAC."GST Group Code") <> 0 then begin
                    CheckGSTRatesForHSN(HSNSAC);
                    CheckedCount += 1;
                    if CheckedCount mod 100 = 0 then
                        Commit();
                end;
            until HSNSAC.Next() = 0;

        Commit();
        ProgressDialog.Close();
        Message(CheckCompleteMsg, CheckedCount, TotalRecords - CheckedCount);
    end;

    procedure CheckGSTRatesForHSN(var HSNRec: Record "HSN/SAC")
    begin
        // Use this instance's loaded data. Never call this on a new, empty instance.
        Initialize();
        HSNRec."ABC GST Rates Generated" := GSTRateGenerator.AllDomesticRatesExist(HSNRec."GST Group Code", HSNRec.Code);
        HSNRec.Modify();
    end;

    local procedure Initialize()
    begin
        if IsInitialized then
            exit;

        GSTRateGenerator.InitializeAll();
        IsInitialized := true;
    end;
}
```

### ABCGSTRateDupBuffer.Table.al

A temporary table used by the duplicate page.

```al
table 50300 "ABC GST Rate Dup. Buffer"
{
    Caption = 'GST Rate Duplicate Buffer';
    TableType = Temporary;
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
        }
        field(2; "Group No."; Integer)
        {
            Caption = 'Group No.';
        }
        field(3; Issue; Option)
        {
            Caption = 'Issue';
            OptionMembers = " ","Same Date","Different Date Different Rate","Different Date Same Rate";
            OptionCaption = ' ,Same Date,Different Date Different Rate,Different Date Same Rate';
        }
        field(4; "GST Group Code"; Code[20])
        {
            Caption = 'GST Group Code';
        }
        field(5; "HSN/SAC Code"; Code[20])
        {
            Caption = 'HSN/SAC Code';
        }
        field(6; "From State"; Code[20])
        {
            Caption = 'From State';
        }
        field(7; "To State"; Code[20])
        {
            Caption = 'To State';
        }
        field(8; "Date From"; Date)
        {
            Caption = 'Date From';
        }
        field(9; "SGST %"; Decimal)
        {
            Caption = 'SGST %';
            DecimalPlaces = 0 : 3;
        }
        field(10; "CGST %"; Decimal)
        {
            Caption = 'CGST %';
            DecimalPlaces = 0 : 3;
        }
        field(11; "IGST %"; Decimal)
        {
            Caption = 'IGST %';
            DecimalPlaces = 0 : 3;
        }
        field(12; "POS Out Of India"; Text[10])
        {
            Caption = 'POS Out Of India';
        }
        field(13; "POS as Vendor State"; Text[10])
        {
            Caption = 'POS as Vendor State';
        }
        field(14; "Config ID"; Guid)
        {
            Caption = 'Config ID';
        }
    }

    keys
    {
        key(PK; "Entry No.")
        {
            Clustered = true;
        }
        key(GroupDate; "Group No.", "Date From")
        {
        }
        key(IssueGroup; Issue, "Group No.", "Date From")
        {
        }
    }
}
```

### ABCGSTRateDupFinder.Codeunit.al

Finds groups of rates with the same business key and classifies them. It reads column IDs by name from the Tax Rate Column Setup.

```al
codeunit 50302 "ABC GST Rate Dup. Finder"
{
    Permissions =
        tabledata "GST Setup" = R,
        tabledata "Tax Rate" = R,
        tabledata "Tax Rate Column Setup" = R,
        tabledata "Tax Rate Value" = R;

    var
        ColumnIDByName: Dictionary of [Text, Integer];

    /// <summary>Lists rates sharing GST Group, HSN, From State, To State and POS flags. It does not change or delete any rate.</summary>
    procedure FindDuplicates(var TempDupBuffer: Record "ABC GST Rate Dup. Buffer" temporary)
    var
        TaxRate: Record "Tax Rate";
        GSTRateGenerator: Codeunit "ABC GST Rate Generator";
        KeyCounts: Dictionary of [Text, Integer];
        GroupNumbers: Dictionary of [Text, Integer];
        BusinessKey: Text;
        KeyCount: Integer;
        GroupNo: Integer;
        LastGroupNo: Integer;
        EntryNo: Integer;
    begin
        TempDupBuffer.Reset();
        TempDupBuffer.DeleteAll();

        GSTRateGenerator.InitializeForKeys();
        TaxRate.SetRange("Tax Type", GSTRateGenerator.GetTaxType());
        TaxRate.SetLoadFields("Tax Setup ID");
        if not TaxRate.FindSet() then
            exit;

        repeat
            BusinessKey := GSTRateGenerator.GetBusinessKey(TaxRate);
            if BusinessKey <> '' then
                if KeyCounts.Get(BusinessKey, KeyCount) then
                    KeyCounts.Set(BusinessKey, KeyCount + 1)
                else
                    KeyCounts.Add(BusinessKey, 1);
        until TaxRate.Next() = 0;

        TaxRate.FindSet();
        repeat
            BusinessKey := GSTRateGenerator.GetBusinessKey(TaxRate);
            if KeyCounts.Get(BusinessKey, KeyCount) and (KeyCount > 1) then begin
                if not GroupNumbers.Get(BusinessKey, GroupNo) then begin
                    LastGroupNo += 1;
                    GroupNo := LastGroupNo;
                    GroupNumbers.Add(BusinessKey, GroupNo);
                end;
                EntryNo += 1;
                AddBufferRow(TempDupBuffer, TaxRate, EntryNo, GroupNo);
            end;
        until TaxRate.Next() = 0;

        for GroupNo := 1 to LastGroupNo do
            ClassifyGroup(TempDupBuffer, GroupNo);

        TempDupBuffer.Reset();
    end;

    local procedure AddBufferRow(var TempDupBuffer: Record "ABC GST Rate Dup. Buffer" temporary; TaxRate: Record "Tax Rate"; EntryNo: Integer; GroupNo: Integer)
    var
        TaxRateValue: Record "Tax Rate Value";
    begin
        TempDupBuffer.Init();
        TempDupBuffer."Entry No." := EntryNo;
        TempDupBuffer."Group No." := GroupNo;
        TempDupBuffer."Config ID" := TaxRate.ID;

        TaxRateValue.SetCurrentKey("Config ID", "Column ID");
        TaxRateValue.SetRange("Tax Type", TaxRate."Tax Type");
        TaxRateValue.SetRange("Config ID", TaxRate.ID);
        if TaxRateValue.FindSet() then
            repeat
                // Columns are found by name from the Tax Rate Column Setup, not by fixed IDs.
                case TaxRateValue."Column ID" of
                    GetColumnID(TaxRate."Tax Type", 'HSN/SAC'):
                        TempDupBuffer."HSN/SAC Code" := CopyStr(TaxRateValue.Value, 1, MaxStrLen(TempDupBuffer."HSN/SAC Code"));
                    GetColumnID(TaxRate."Tax Type", 'Date'):
                        TempDupBuffer."Date From" := TaxRateValue."Date Value";
                    GetColumnID(TaxRate."Tax Type", 'From State'):
                        TempDupBuffer."From State" := CopyStr(TaxRateValue.Value, 1, MaxStrLen(TempDupBuffer."From State"));
                    GetColumnID(TaxRate."Tax Type", 'CGST'):
                        if Evaluate(TempDupBuffer."CGST %", TaxRateValue.Value) then;
                    GetColumnID(TaxRate."Tax Type", 'IGST'):
                        if Evaluate(TempDupBuffer."IGST %", TaxRateValue.Value) then;
                    GetColumnID(TaxRate."Tax Type", 'SGST'):
                        if Evaluate(TempDupBuffer."SGST %", TaxRateValue.Value) then;
                    GetColumnID(TaxRate."Tax Type", 'GST Group Code'):
                        TempDupBuffer."GST Group Code" := CopyStr(TaxRateValue.Value, 1, MaxStrLen(TempDupBuffer."GST Group Code"));
                    GetColumnID(TaxRate."Tax Type", 'Location State Code'):
                        TempDupBuffer."To State" := CopyStr(TaxRateValue.Value, 1, MaxStrLen(TempDupBuffer."To State"));
                    GetColumnID(TaxRate."Tax Type", 'POS Out Of India'):
                        TempDupBuffer."POS Out Of India" := CopyStr(TaxRateValue.Value, 1, MaxStrLen(TempDupBuffer."POS Out Of India"));
                    GetColumnID(TaxRate."Tax Type", 'POS as Vendor State'):
                        TempDupBuffer."POS as Vendor State" := CopyStr(TaxRateValue.Value, 1, MaxStrLen(TempDupBuffer."POS as Vendor State"));
                end;
            until TaxRateValue.Next() = 0;

        TempDupBuffer.Insert();
    end;

    local procedure GetColumnID(TaxType: Code[20]; ColumnName: Text[30]): Integer
    var
        TaxRateColumnSetup: Record "Tax Rate Column Setup";
        ColumnID: Integer;
    begin
        if ColumnIDByName.Get(ColumnName, ColumnID) then
            exit(ColumnID);

        TaxRateColumnSetup.SetRange("Tax Type", TaxType);
        TaxRateColumnSetup.SetRange("Column Name", ColumnName);
        if TaxRateColumnSetup.FindFirst() then
            ColumnID := TaxRateColumnSetup."Column ID"
        else
            ColumnID := -1;   // never matches a real column
        ColumnIDByName.Add(ColumnName, ColumnID);
        exit(ColumnID);
    end;

    local procedure ClassifyGroup(var TempDupBuffer: Record "ABC GST Rate Dup. Buffer" temporary; GroupNo: Integer)
    var
        PreviousDate: Date;
        FirstSGST: Decimal;
        FirstCGST: Decimal;
        FirstIGST: Decimal;
        IsFirstRow: Boolean;
        HasSameDate: Boolean;
        HasDifferentRate: Boolean;
    begin
        TempDupBuffer.Reset();
        TempDupBuffer.SetCurrentKey("Group No.", "Date From");
        TempDupBuffer.SetRange("Group No.", GroupNo);
        if not TempDupBuffer.FindSet() then
            exit;

        IsFirstRow := true;
        repeat
            if IsFirstRow then begin
                FirstSGST := TempDupBuffer."SGST %";
                FirstCGST := TempDupBuffer."CGST %";
                FirstIGST := TempDupBuffer."IGST %";
                IsFirstRow := false;
            end else begin
                if TempDupBuffer."Date From" = PreviousDate then
                    HasSameDate := true;
                if (TempDupBuffer."SGST %" <> FirstSGST) or
                   (TempDupBuffer."CGST %" <> FirstCGST) or
                   (TempDupBuffer."IGST %" <> FirstIGST)
                then
                    HasDifferentRate := true;
            end;
            PreviousDate := TempDupBuffer."Date From";
        until TempDupBuffer.Next() = 0;

        case true of
            HasSameDate:
                TempDupBuffer.ModifyAll(Issue, TempDupBuffer.Issue::"Same Date");
            HasDifferentRate:
                TempDupBuffer.ModifyAll(Issue, TempDupBuffer.Issue::"Different Date Different Rate");
            else
                TempDupBuffer.ModifyAll(Issue, TempDupBuffer.Issue::"Different Date Same Rate");
        end;
    end;
}
```

### ABCGSTRateDuplicates.Page.al

The read-only **GST Rate Duplicates** page.

```al
page 50300 "ABC GST Rate Duplicates"
{
    Caption = 'GST Rate Duplicates';
    PageType = List;
    ApplicationArea = All;
    UsageCategory = Lists;
    SourceTable = "ABC GST Rate Dup. Buffer";
    SourceTableTemporary = true;
    Editable = false;
    InsertAllowed = false;
    ModifyAllowed = false;
    DeleteAllowed = false;

    layout
    {
        area(Content)
        {
            repeater(Rates)
            {
                field(Issue; Rec.Issue)
                {
                    ToolTip = 'Specifies the problem: the same date is a true duplicate, a different rate needs review, and the same rate on another date is redundant.';
                    StyleExpr = IssueStyle;
                }
                field("Group No."; Rec."Group No.")
                {
                    ToolTip = 'Specifies the number shared by rates that duplicate each other.';
                }
                field("GST Group Code"; Rec."GST Group Code")
                {
                    ToolTip = 'Specifies the GST group code.';
                }
                field("HSN/SAC Code"; Rec."HSN/SAC Code")
                {
                    ToolTip = 'Specifies the HSN/SAC code.';
                }
                field("From State"; Rec."From State")
                {
                    ToolTip = 'Specifies the from state. Blank is used for import rates.';
                }
                field("To State"; Rec."To State")
                {
                    ToolTip = 'Specifies the location state code.';
                }
                field("Date From"; Rec."Date From")
                {
                    ToolTip = 'Specifies the date the rate starts.';
                }
                field("SGST %"; Rec."SGST %")
                {
                    ToolTip = 'Specifies the SGST percentage.';
                }
                field("CGST %"; Rec."CGST %")
                {
                    ToolTip = 'Specifies the CGST percentage.';
                }
                field("IGST %"; Rec."IGST %")
                {
                    ToolTip = 'Specifies the IGST percentage.';
                }
                field("POS Out Of India"; Rec."POS Out Of India")
                {
                    ToolTip = 'Specifies the POS Out Of India value on the rate.';
                }
                field("POS as Vendor State"; Rec."POS as Vendor State")
                {
                    ToolTip = 'Specifies the POS as Vendor State value on the rate.';
                }
                field("Config ID"; Rec."Config ID")
                {
                    ToolTip = 'Specifies the ID of the Tax Rate record.';
                    Visible = false;
                }
            }
        }
    }

    trigger OnOpenPage()
    var
        GSTRateDupFinder: Codeunit "ABC GST Rate Dup. Finder";
    begin
        GSTRateDupFinder.FindDuplicates(Rec);
        Rec.SetCurrentKey(Issue, "Group No.", "Date From");
        if Rec.IsEmpty() then
            Message(NoDuplicatesMsg);
        if Rec.FindFirst() then;
    end;

    trigger OnAfterGetRecord()
    begin
        case Rec.Issue of
            Rec.Issue::"Same Date":
                IssueStyle := 'Unfavorable';
            Rec.Issue::"Different Date Different Rate":
                IssueStyle := 'Attention';
            else
                IssueStyle := 'Standard';
        end;
    end;

    var
        IssueStyle: Text;
        NoDuplicatesMsg: Label 'No duplicate GST rates were found.';
}
```

### ABCGSTRateGen.PermissionSet.al

The permission set for users who run the tools.

```al
permissionset 50300 "ABC GST RATE GEN"
{
    Assignable = true;
    Caption = 'ABC GST Rate Generation';

    Permissions =
        codeunit "ABC GST Rate Generator" = X,
        codeunit "ABC GST Rate Checker" = X,
        codeunit "ABC GST Rate Dup. Finder" = X,
        page "ABC GST Rate Duplicates" = X,
        table "ABC GST Rate Dup. Buffer" = X,
        tabledata "GST Setup" = R,
        tabledata "HSN/SAC" = RM,
        tabledata State = R,
        tabledata "Tax Rate" = RIM,
        tabledata "Tax Rate Column Setup" = R,
        tabledata "Tax Rate Value" = RIM;
}
```

---

**Sources**

- Microsoft Learn: [Set up goods and services tax (India)](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/gst-001-basic-setup)
- Microsoft Learn: [Tax Engine overview](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/taxengine-001-overview)
- Microsoft Learn: [Tax Engine configuration of tax type and tax rate](https://learn.microsoft.com/dynamics365/business-central/localfunctionality/india/taxengine-003-tax-configuration)
- Microsoft source on GitHub: [TaxSetupMatrixMgmt.Codeunit.al](https://github.com/microsoft/ALAppExtensions/blob/main/Apps/W1/INTaxEngine/app/TaxEngine-TaxTypeHandler/src/TaxType/rate/codeunit/TaxSetupMatrixMgmt.Codeunit.al)
- Microsoft source on GitHub: [TaxRateComputation.Codeunit.al (how a rate row is chosen)](https://github.com/microsoft/ALAppExtensions/blob/main/Apps/W1/INTaxEngine/app/TaxEngine-UseCaseBuilder/src/UseCase/codeunit/TaxRateComputation.Codeunit.al)
- Microsoft source on GitHub: [GST.json (GST column setup)](https://github.com/microsoft/ALAppExtensions/blob/main/Apps/IN/INGST/app/.resources/TaxTypes/GST.json)
