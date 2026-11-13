---
title: "Dimensions in Business Central: how one Dimension Set ID holds all your dimensions"
date: 2026-11-13
type: concept
tags: Dimensions, Finance, AL, DimensionManagement, Business Central
summary: Every posted entry in BC carries just one number for all its dimensions, the Dimension Set ID. Same combination, same number, every time, in any order. I'll explain what dimensions are, how BC finds that number using a small "notebook" table, and how to work with dimensions in AL.
---

When I started working on BC, I thought dimensions were just some extra fields on a line. Department in one field, project in another field. That's it.

Then one day I opened the G/L Entry table in code. I could see 8 dimension fields, Global Dimension 1 and 2, and Shortcut Dimension 3 to 8. But only the first two were normal fields. Shortcut Dimension 3 to 8 were all **FlowFields**, and all of them were reading from one number called **Dimension Set ID**.

So I was thinking, if those six fields are not stored on the entry, where are they stored? And how does one number hold all the dimensions?

I'll be honest, the tree node part was not easy for me. I read the Base App code, drew it on paper, tried it in a sandbox, and still went through it many times before it really clicked. So if it feels a bit complex on your first read, don't worry, it was the same for me.

In this post I'll explain it the way I finally understood it. Simple language, step by step.

## First, what are dimensions?

Dimensions are like **tags**. You put them on a transaction so that later you can analyse it.

Take one example. A company sells from 3 departments, in 4 areas, for 10 projects. Without dimensions, you would need a separate G/L account for every combination. "Sales – Retail – South – Project A", "Sales – Retail – South – Project B", and so on. The chart of accounts would become very big and very messy.

With dimensions, you keep only one Sales account. On each entry, you just add tags:

| Dimension | Value |
|---|---|
| DEPARTMENT | RETAIL |
| AREA | SOUTH |
| PROJECT | P100 |

Now finance can ask "how much did RETAIL sell in SOUTH?" or "how much did we spend on project P100?" from the same entries. No extra accounts needed.

## Why are they important?

- **Reports without a huge chart of accounts.** One account, but you can see it in many ways.
- **They're used everywhere.** Sales, purchase, inventory, jobs, fixed assets, journals. A dimension on a sales line goes to the customer ledger entries, G/L entries and value entries also.
- **You can control them.** You can make a dimension mandatory for an account, block some combinations, or give default dimensions to customers, vendors and items so they come automatically.
- **Finance depends on them.** If dimensions are wrong, management reports are wrong. So as developers, we should know how they are stored, not only how they look on the page.

## Global and shortcut dimensions

In **General Ledger Setup** we choose:

- **2 global dimensions.** These are saved as real fields on ledger entries, so filtering on them is fast everywhere.
- **Up to 8 shortcut dimensions.** These come as fields on journal and document lines, so users can type them directly. The first two shortcut dimensions are always the two global ones.

Now look at the G/L Entry. It shows all 8, but only Global Dimension 1 and 2 are really stored there. Shortcut Dimension 3 to 8 are FlowFields like this:

```al
field(481; "Shortcut Dimension 3 Code"; Code[20])
{
    FieldClass = FlowField;
    CalcFormula = lookup("Dimension Set Entry"."Dimension Value Code"
                  where("Dimension Set ID" = field("Dimension Set ID"),
                        "Global Dimension No." = const(3)));
}
```

In simple words: "take this entry's Dimension Set ID, go to table 480, and pick the value of shortcut dimension 3 from there". Nothing is copied onto the entry. It's read live from the set every time.

And a company can have **more** dimensions than eight. The extra ones you see only when you click Dimensions, and they also live only in the set. So everything comes back to that one number. Let's see how it works.

## The idea: one number for one full combination

BC doesn't save all dimensions on every entry. It saves each combination **only once**, and gives that combination a number. That number is the **Dimension Set ID**.

The easiest way to understand this is a restaurant combo menu.

- Combo 1 = Burger + Fries
- Combo 2 = Burger + Fries + Coke

When 1,000 customers order Burger + Fries + Coke, the bill doesn't list three items 1,000 times. It just says **Combo 2**. The kitchen has one card that says what Combo 2 contains.

BC does the same thing:

| Restaurant | Business Central |
|---|---|
| Food items | Dimension values (RETAIL, SOUTH, P100) |
| Combo number | Dimension Set ID |
| The card that says what's inside each combo | Table 480 **Dimension Set Entry** |

So table 480 looks like this:

| Dimension Set ID | Dimension Code | Dimension Value Code |
|---|---|---|
| 3 | AREA | SOUTH |
| 3 | DEPARTMENT | RETAIL |
| 3 | PROJECT | P100 |

Every line or entry with RETAIL + SOUTH + P100 just stores **3**. Even 1,000 invoices, all of them store 3. These three rows are saved only one time.

And the main rule is:

> **One combination of dimension values = only one Dimension Set ID.**

If a new line comes with the same three values, BC will not create a new set. It finds set 3 and uses it again. Even if the user enters the values in a different order, it's still set 3.

Small note: set **0** means "no dimensions".

Now the real question. When a user puts RETAIL + SOUTH + P100 on a line, **how does BC know the answer is 3?** It can't search the whole of table 480 every time. That would be very slow. So BC uses one more small table. I call it **the notebook**.

## Every dimension value has a token number

Before the notebook, one small thing. Every dimension value has a hidden number called **Dimension Value ID**, in table 349 Dimension Value.

| Dimension | Value | Dimension Value ID |
|---|---|---|
| DEPARTMENT | RETAIL | 3 |
| AREA | SOUTH | 7 |
| PROJECT | P100 | 12 |

**Who gives this number?** Nobody types it. The field is AutoIncrement and not editable, so SQL Server gives the next free number when the dimension value is created. It depends only on *when* the value was created. And it never changes. Even if you rename RETAIL to RTL, it's still 3.

I'll call this number the **token number**.

## The notebook: table 481 Dimension Set Tree Node

This table has only 4 fields:

| Field | What it means | In simple words |
|---|---|---|
| Parent Dimension Set ID | The set you are standing at now (0 = nothing yet) | At set |
| Dimension Value ID | The token number of the value you are adding | Add token |
| Dimension Set ID | The set you reach after adding it (AutoIncrement) | Reach set |
| In Use | Is this a real, used set, or only a step on the way? | In use |

Each line in the notebook says only one thing:

> "If you are standing at **set X** and you add **token Y**, you reach **set Z**."

That's all. No codes, no names, no descriptions. Only numbers.

## The one rule BC always follows

> **Always add the values in token number order, smallest first. Never in the order the user typed them.**

So for RETAIL (3), SOUTH (7) and P100 (12), BC always goes RETAIL first, then SOUTH, then P100. Whatever the user typed.

## Let's watch the notebook grow, day by day

Imagine a new company. Nobody has used dimensions yet. The notebook is empty.

**Day 1: a user puts only RETAIL on a line.**

BC starts at set 0 and looks for "at set 0, add 3". It's not there. So BC writes a new line, and SQL Server fills the Reach set column with the next free number, **1**.

| At set | Add token | Reach set | In use |
|---|---|---|---|
| 0 | RETAIL (3) | **1** | Yes |

Answer: set 1. BC also saves "set 1 = RETAIL" in table 480.

**Day 2: a user puts RETAIL + SOUTH.**

1. "At set 0, add 3" is found. The notebook says **1**. That's how "the notebook says set 1": BC just reads the number already written in that line.
2. "At set 1, add 7" is not there. BC writes a new line, and SQL gives **2**.

| At set | Add token | Reach set | In use |
|---|---|---|---|
| 0 | RETAIL (3) | 1 | Yes |
| 1 | SOUTH (7) | **2** | Yes |

**Day 3: a user puts RETAIL + SOUTH + P100.**

1. "At 0, add 3" → found, **1**.
2. "At 1, add 7" → found, **2**.
3. "At 2, add 12" → not there, so a new line, and SQL gives **3**.

| At set | Add token | Reach set | In use |
|---|---|---|---|
| 0 | RETAIL (3) | 1 | Yes |
| 1 | SOUTH (7) | 2 | Yes |
| 2 | P100 (12) | **3** | Yes |

**Day 4: a user puts RETAIL + P100 (no SOUTH this time).**

1. "At 0, add 3" → found, **1**.
2. "At 1, add 12" → **not there**.

Wait, the line "at 2, add 12" exists, right? Yes, but that line starts from **set 2**, which is RETAIL + SOUTH. We are standing at **set 1**, which is RETAIL alone. A different starting point means a different line. So BC writes a new one, and SQL gives **4**.

| At set | Add token | Reach set | In use |
|---|---|---|---|
| 0 | RETAIL (3) | 1 | Yes |
| 1 | SOUTH (7) | 2 | Yes |
| 2 | P100 (12) | 3 | Yes |
| 1 | P100 (12) | **4** | Yes |

Answer: set 4 = RETAIL + P100.

If you draw these lines, they look like a tree. That's why the table is called Tree Node:

```
Set 0 (nothing)
 └── + RETAIL → Set 1
       ├── + SOUTH → Set 2
       │     └── + P100 → Set 3   (RETAIL + SOUTH + P100)
       └── + P100  → Set 4        (RETAIL + P100)
```

So each line really means **"this combination, plus one more value"**. The same value, like P100, can come on many lines, once for every combination it's added to.

## Different order, same set. Let's prove it.

**Day 5: one user types P100, SOUTH, RETAIL. Another user types SOUTH, RETAIL, P100.**

For both users, BC first lines up the values by token number: 3, 7, 12. The typed order is thrown away at this step.

| Step | Lookup | Notebook says |
|---|---|---|
| 1 | At 0, add 3 | 1 |
| 2 | At 1, add 7 | 2 |
| 3 | At 2, add 12 | 3 |

Both users do the same three lookups and land on **set 3**. Nothing new is written.

In the code, this "lining up" is just one line before the loop:

```al
DimSetEntry.SetCurrentKey("Dimension Value ID");
```

It tells BC "when you loop through these rows, give them sorted by Dimension Value ID". So the loop never even sees the typed order.

And just think what would happen without sorting. One user would go P100 → SOUTH → RETAIL and create a new set. Another would go SOUTH → RETAIL → P100 and create another new set. Now the same combination would have three different numbers, and reports would show it as three different rows. That's why the sorting is so important.

## Try it yourself: a small walk game

To make this simple to understand, I made a small HTML page. In it, a little explorer carries your dimension values in a backpack and walks from house to house. Every house is a set, and every road means "add one more value".

- Pick values in any order, put them in the backpack, and press **Go!**
- Watch the explorer line up the cards by token number first, then ask at every house, "is there a road for this value from here?"
- If the road is there, it just walks. If not, it builds a new road and a new house, and SQL Server gives it the next set number.
- You can add your own values, start from an empty town (only Set 0), and pause the walk anytime.

**[Open the Dimension Set walk game](demos/dimension-set-tree-lab.html)**

Try the same values in a different order. You'll see the explorer take the exact same road every time.

## How does BC know "it's not there" so fast?

The notebook's primary key is **Parent Dimension Set ID + Dimension Value ID** (At set + Add token), and it's the clustered key. That means SQL Server always keeps the lines **sorted** by these two columns, like words in a dictionary.

When BC checks "at set 1, add 12", the code just does:

```al
if not DimSetTreeNode.Get(1, 12) then
    // not there, write a new line
```

`Get` means "give me the row with exactly this key". SQL doesn't read the lines one by one. It jumps straight to the place where (1, 12) should be.

Before Day 4, the sorted notebook was:

| Position | At set | Add token |
|---|---|---|
| 1 | 0 | 3 |
| 2 | 1 | 7 |
| 3 | 2 | 12 |

(1, 12) should come after (1, 7) and before (2, 12). SQL looks at that exact spot, finds nothing, and `Get` returns false. That's how BC knows it's not there.

Same as a dictionary. To find "mango", you don't read from "apple" to "zebra". You open near M, then "ma", then "man", and either the word is there, or the gap tells you it doesn't exist. A few page flips are enough, whether the dictionary is thin or huge.

So for 3 dimensions, BC does only **3 lookups**. Whether the notebook has 10 lines or 10 lakh lines, it's still 3 lookups. That's the speed secret.

The notebook has no other key, not even on the Dimension Set ID column. That's fine, because BC never searches the notebook by set number. To see what's inside a set, it uses table 480, whose primary key starts with Dimension Set ID. So each table has one clear job:

| Table | Job |
|---|---|
| 481 Dimension Set Tree Node (the notebook) | **Find** the set number fast |
| 480 Dimension Set Entry (the combo card) | **Store** what's inside each set |

## A few things that surprised me in the code

- **Some lines are only "steps on the way".** Say the very first user picked RETAIL + SOUTH + P100 directly. BC would write all three lines in one go, but only the last one gets **In Use = Yes**. The first two (RETAIL, and RETAIL + SOUTH) are only steps, so they stay **In Use = No**. Later, when someone actually uses RETAIL alone, BC just changes In Use to Yes and saves its entries. No new line needed.
- **Set numbers have gaps, and that's normal.** The Reach set column is AutoIncrement, so everything from my [AutoIncrement post](#/post/2026-11-12-why-entry-no-skips-numbers-autoincrement) applies here too. Rollbacks and step-only lines use up numbers.
- **A set never changes.** Once written, a set is never edited and never deleted. When you change a dimension on a line, BC doesn't touch the old set. It finds or creates another set and puts that number on the line. The old set stays, because 1,000 other records may still be using it. This is also why you can't delete a dimension once it has been used, even on a line you never posted.

## Check it yourself in a sandbox, no code needed

You can open any table in the browser by adding `?table=<number>` to your BC address. Use a sandbox, because production may block this.

1. **Give a line some dimensions.** Open a sales order line, then Line → Dimensions, and add three values. Press **Ctrl+Alt+F1** (Page Inspection) and note the **Dimension Set ID**.
2. **Same values, different order.** On a second line, enter the same three values in a different order. Page Inspection shows the **same number**.
3. **See the token numbers.** Open `?table=349` and note the **Dimension Value ID** of your three values. Put them in order, smallest first.
4. **Walk the notebook by hand.** Open `?table=481`. Filter Parent Dimension Set ID = 0 and Dimension Value ID = your smallest token. Note the Dimension Set ID it shows. Use that as the next Parent, with your second token. Then do the same again with your third token. The last number is the same one you saw on the sales lines.
5. **See what's inside.** Open `?table=480` and filter Dimension Set ID = that number. You'll see your three dimensions.
6. **Watch a new line get written.** Use a combination you've never used before. You get a new set number, and a new line appears in `?table=481`.

When I did step 4 myself, it finally clicked for me. Three filters, three rows, and you have the answer. That's exactly what BC does.

## What is this approach called, and who made it?

In computer science, this kind of tree is called a **trie**, or **prefix tree**. Each step adds one more piece, and combinations that start the same way share the same path. René de la Briandais first described tries for computers in 1959, and Edward Fredkin gave it the name "trie" in 1960, from re*trie*val. Your phone's contact search and keyboard autocomplete use the same idea.

In our world, Microsoft's NAV team brought this design in with **NAV 2013**, as the "Dimension Entry Storing and Posting Redesign". Their reason was simple: store each set only once, save database space, and improve performance. Business Central got it from NAV.

## Working with dimensions in AL: DimensionManagement

Now the developer part. One important rule first: **we never insert into table 480 or 481 directly.**

Instead, we take a **temporary** copy of the set, make our changes there, and ask BC "give me the number for this combination". BC then does the whole notebook walk for us. The helper for this is **codeunit 408 DimensionManagement**.

| Procedure | What it does |
|---|---|
| `GetDimensionSet(TempDimSetEntry, DimSetID)` | Copies all dimensions of a set into your temporary table |
| `GetDimensionSetID(TempDimSetEntry)` | Finds or creates the set for your temporary table (the notebook walk), and gives back its number |
| `UpdateGlobalDimFromDimSetID(DimSetID, GlobalDim1, GlobalDim2)` | Gives you the two global dimension codes for a set |
| `GetCombinedDimensionSetID(DimSetIDArr, GlobalDim1, GlobalDim2)` | Joins up to 10 sets into one |

### Add or change one dimension on a line

This is the one you'll write most of the time:

```al
procedure SetDimension(var SalesLine: Record "Sales Line"; DimCode: Code[20]; DimValueCode: Code[20])
var
    TempDimSetEntry: Record "Dimension Set Entry" temporary;
    DimMgt: Codeunit DimensionManagement;
begin
    // 1. Copy the current set into the temporary table
    DimMgt.GetDimensionSet(TempDimSetEntry, SalesLine."Dimension Set ID");

    // 2. Remove the old value for this dimension, if it is there
    if TempDimSetEntry.Get(SalesLine."Dimension Set ID", DimCode) then
        TempDimSetEntry.Delete();

    // 3. Add the new value. Validate fills the token number (Dimension Value ID) for us.
    TempDimSetEntry.Init();
    TempDimSetEntry."Dimension Set ID" := SalesLine."Dimension Set ID";
    TempDimSetEntry.Validate("Dimension Code", DimCode);
    TempDimSetEntry.Validate("Dimension Value Code", DimValueCode);
    TempDimSetEntry.Insert();

    // 4. Find or create the set for this combination
    SalesLine."Dimension Set ID" := DimMgt.GetDimensionSetID(TempDimSetEntry);

    // 5. Keep the two global dimension fields in sync
    DimMgt.UpdateGlobalDimFromDimSetID(SalesLine."Dimension Set ID",
        SalesLine."Shortcut Dimension 1 Code", SalesLine."Shortcut Dimension 2 Code");

    SalesLine.Modify(true);
end;
```

Why a **temporary** table? Because here we are only preparing a list of values. Nothing is saved until `GetDimensionSetID` checks the notebook. If we wrote into the real table, we would create half-sets and break the "one combination = one number" rule.

**A shortcut.** If the dimension is one of the 8 shortcut dimensions, document and journal lines already have `ValidateShortcutDimCode`, which does all of the above inside:

```al
ProjectCode := 'P100';
SalesLine.ValidateShortcutDimCode(3, ProjectCode);   // shortcut dimension 3
SalesLine.Modify(true);
```

(The second parameter is a `var`, so pass a variable, not a text constant.)

### Combine sets

Sometimes you need dimensions from more than one place, like the header's dimensions plus the line's own:

```al
DimSetIDArr[1] := SalesHeader."Dimension Set ID";
DimSetIDArr[2] := SalesLine."Dimension Set ID";
NewDimSetID := DimMgt.GetCombinedDimensionSetID(DimSetIDArr, GlobalDim1, GlobalDim2);
```

One small but important point: **the later one in the array wins.** If both have DEPARTMENT, the value from `DimSetIDArr[2]` is kept. So keep the most important source last.

## Things to be careful about

1. **Always use Validate for the codes.** `GetDimensionSetID` needs the token number (Dimension Value ID) on every row. If you set the codes with `:=`, the token stays 0 and you'll get an error.
2. **Never write into tables 480 or 481 yourself.** Only `GetDimensionSetID` should do that. It keeps the notebook and the combo cards in sync.
3. **Update the global dimension fields also.** If you change only the Dimension Set ID, the Shortcut Dimension 1 and 2 fields will still show old values, and filters and reports use those fields.
4. **The first use of a new combination takes a lock.** When a line is not in the notebook, BC locks the notebook table before writing it. If the set already exists, there's no lock. So a big import creating many new combinations in parallel can see small waits. Now you know where that wait comes from (I explained locks in my [LockTable post](#/post/2026-10-30-what-is-a-lock-and-what-locktable-really-locks)).
5. **Blocked values fail during Validate.** If your data is coming from outside, like an integration, handle that case.
6. **To compare dimensions, compare the numbers.** Want to check if two lines have the same dimensions? Just compare their Dimension Set IDs. Same combination always means same number.

## In short

- **Dimensions** are tags that help finance analyse entries without a huge chart of accounts.
- BC saves each combination **once** in table 480 and puts only the **Dimension Set ID** on each record.
- Every dimension value has a fixed **token number** (Dimension Value ID), given by SQL Server when the value is created.
- To find the set number, BC lines up the values by token number and walks **the notebook** (table 481), one direct lookup per value. If a line is missing, it writes one, and SQL gives the next set number.
- That's why it's **fast** (only as many lookups as dimensions) and why **any order gives the same number**.
- In AL, always go through **DimensionManagement** with a **temporary** Dimension Set Entry.

When I first saw those six FlowFields on the G/L Entry, I thought something was missing. Now I feel it's one of the smartest designs in BC. If you've faced any tricky dimension issue in your project, or if any part of this is still not clear, do share it in the comments.

## Sources

- [Work with dimensions (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/finance-dimensions)
- [Design details: Table structure for dimensions (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/design-details-table-structure)
- [Design details: Searching for dimension combinations (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/design-details-searching-for-dimension-combinations)
- [What's new: Application changes for Microsoft Dynamics NAV 2013 (Microsoft Learn)](https://learn.microsoft.com/fr-fr/previous-versions/dynamicsnav-2013/hh173994(v=nav.70))
- [Trie (Wikipedia)](https://en.wikipedia.org/wiki/Trie)
- Base Application source, BC 28: table 480 *Dimension Set Entry* (`GetDimensionSetID`), table 481 *Dimension Set Tree Node*, table 349 *Dimension Value*, table 17 *G/L Entry* (Shortcut Dimension 3–8 FlowFields), table 37 *Sales Line* (`ValidateShortcutDimCode`), codeunit 408 *DimensionManagement* ([MSDyn365BC.Code.History](https://github.com/StefanMaron/MSDyn365BC.Code.History))
