---
title: JsonObject, JsonArray, JsonToken, JsonValue: how I finally understood JSON in AL
date: 2026-10-25
type: solution
tags: AL, JSON, JsonObject, Integration, Business Central
summary: Four JSON types with confusing names. Once I pictured them as a cupboard, boxes and a parcel, reading JSON in AL became easy. Let's read a real order together, step by step, and write one back.
---

In my [last post](#/post/2026-10-24-http-requests-in-al-httpclient-headers) we called an API and got some text back. Nice. But that text is JSON, and now we have to actually read it: the order number, the customer name, every single line.

And this is where AL gives you four types with very similar names: `JsonObject`, `JsonArray`, `JsonToken` and `JsonValue`. I remember looking at them and thinking, why four? Which one do I use when?

Let me show you how I think about them now. After this, I promise they won't look scary.

## JSON is only three things

Before AL, let's look at JSON itself. It looks complicated when it's big, but it is built from just three things:

- An **object**: curly brackets with names and values inside. `{ "no": "C0010", "city": "Chennai" }`
- An **array**: square brackets with a list. `[ "red", "green", "blue" ]`
- A **value**: a text, a number, `true`/`false`, or `null`.

That's it. Everything else is just these three, put inside each other.

## The picture that helped me

Imagine an office cupboard.

A **JsonObject** is the cupboard itself. It has drawers, and every drawer has a name written on it: "orderNo", "customer", "lines".

A **JsonArray** is a row of boxes on a shelf. The boxes have no names, only numbers: box 0, box 1, box 2.

A **JsonValue** is the actual thing you find inside: a paper with "SO-1001" on it, or the number 4500.

And the **JsonToken**? That's the one that confused me the most. Think of it as a **closed parcel**. Whenever you take something out of a drawer or a box, AL hands it to you as a closed parcel, because it doesn't know yet what's inside. It could be another cupboard, a row of boxes, or just a value.

So every time, you do three small things:

1. **Take it out** with `Get`. You get a token, the closed parcel.
2. **Look inside** with `IsObject()`, `IsArray()` or `IsValue()`.
3. **Open it the right way** with `AsObject()`, `AsArray()` or `AsValue()`.

Honestly, once I understood this, 80% of my JSON problems were gone.

## Let's read a real order

Here is the JSON we'll work with. It looks like what many APIs send back:

```json
{
  "orderNo": "SO-1001",
  "orderDate": "2026-10-25",
  "urgent": true,
  "remarks": null,
  "customer": {
    "no": "C0010",
    "name": "Adatum & Co",
    "city": "Chennai"
  },
  "lines": [
    { "itemNo": "1000", "description": "Bicycle", "quantity": 2, "unitPrice": 4500.50 },
    { "itemNo": "1100", "description": "Front Wheel", "quantity": 5, "unitPrice": 750 }
  ]
}
```

Before reading any code, try to see it as the cupboard. Here's how I see it:

```text
JsonObject (the order)
  orderNo    -> value "SO-1001"
  orderDate  -> value "2026-10-25"
  urgent     -> value true
  remarks    -> value null
  customer   -> JsonObject
                  no    -> value "C0010"
                  name  -> value "Adatum & Co"
                  city  -> value "Chennai"
  lines      -> JsonArray
                  [0] -> JsonObject { itemNo, description, quantity, unitPrice }
                  [1] -> JsonObject { itemNo, description, quantity, unitPrice }
```

So the order is a cupboard. Inside it, `customer` is a smaller cupboard, and `lines` is a row of boxes where every box holds another small cupboard. Once you see it like this, you already know which type you need for each part.

### First, turn the text into an object

```al
if not OrderJson.ReadFrom(JsonText) then
    Error('The text is not valid JSON.');
```

If someone sends you broken JSON, `ReadFrom` returns `false`. So you can show a proper message instead of a crash.

### Read a simple value

Let's get the order number:

```al
OrderJson.Get('orderNo', Token);            // take the parcel out of the "orderNo" drawer
OrderNo := Token.AsValue().AsText();        // open it as a value, read it as text
```

See the pattern? Take it out, open it as a value. For numbers and true/false it's the same idea, just `AsDecimal()`, `AsInteger()` or `AsBoolean()` at the end.

But be careful here. If the drawer doesn't exist, `Get` returns `false`. And if the value is `null` (like our `remarks`), `AsText()` throws an error. I'll show you a small helper for this in a minute.

### Read the customer, a cupboard inside the cupboard

```al
OrderJson.Get('customer', Token);           // parcel from the "customer" drawer
CustomerJson := Token.AsObject();           // it is an object, open it as an object

CustomerJson.Get('name', Token);
CustomerName := Token.AsValue().AsText();   // "Adatum & Co"
```

Same three steps, just one level deeper.

### Read the lines, one box at a time

`lines` is an array, a row of boxes. And one thing to remember: in AL, the first box is number **0**, not 1.

```al
OrderJson.Get('lines', Token);
LinesArray := Token.AsArray();              // open the parcel as a row of boxes

for i := 0 to LinesArray.Count() - 1 do begin
    LinesArray.Get(i, Token);               // parcel from box number i
    LineJson := Token.AsObject();           // each line is an object
    // read itemNo, quantity and unitPrice from LineJson
end;
```

### A shortcut when you only need one value

Sometimes you don't want to open every drawer just to get one thing deep inside. Then I use `SelectToken` with a path:

```al
OrderJson.SelectToken('$.customer.name', Token);       // "Adatum & Co"
OrderJson.SelectToken('$.lines[1].description', Token); // "Front Wheel"
```

Read the path like directions: `$` is the top, `.customer` means "go into the customer drawer", `[1]` means "take box number 1".

**Quick question for you:** what does `$.lines[0].quantity` give? Think about it before you scroll.

...

It's `2`. Box 0 is the bicycle line, and its quantity is 2. If you got it, you've understood arrays in JSON.

One small thing: `SelectToken` must find exactly **one** value. If the path finds nothing, or more than one, it fails.

## Putting it all together

Now the full codeunit. It reads the whole order and shows a summary. The three small helpers at the bottom are the ones I use in almost every project. They return an empty text, a zero or `false` when a key is missing or the value is `null`, so one missing field from the API doesn't stop the whole process.

```al
codeunit 50170 "ABC Json Read Demo"
{
    var
        InvalidJsonErr: Label 'The text is not valid JSON.';

    procedure ReadOrder(JsonText: Text)
    var
        OrderJson: JsonObject;
        CustomerJson: JsonObject;
        LineJson: JsonObject;
        LinesArray: JsonArray;
        Token: JsonToken;
        Summary: TextBuilder;
        LineFeed: Text[1];
        OrderDate: Date;
        LineAmount: Decimal;
        TotalAmount: Decimal;
        i: Integer;
    begin
        LineFeed[1] := 10;

        if not OrderJson.ReadFrom(JsonText) then
            Error(InvalidJsonErr);

        // Simple values
        Summary.Append('Order: ' + GetTextValue(OrderJson, 'orderNo') + LineFeed);
        if Evaluate(OrderDate, GetTextValue(OrderJson, 'orderDate'), 9) then
            Summary.Append('Date: ' + Format(OrderDate) + LineFeed);
        if GetBooleanValue(OrderJson, 'urgent') then
            Summary.Append('URGENT' + LineFeed);
        Summary.Append('Remarks: ' + GetTextValue(OrderJson, 'remarks') + LineFeed);

        // Object inside the object
        if OrderJson.Get('customer', Token) and Token.IsObject() then begin
            CustomerJson := Token.AsObject();
            Summary.Append('Customer: ' + GetTextValue(CustomerJson, 'name') +
                ', ' + GetTextValue(CustomerJson, 'city') + LineFeed);
        end;

        // Array of objects
        if OrderJson.Get('lines', Token) and Token.IsArray() then begin
            LinesArray := Token.AsArray();
            for i := 0 to LinesArray.Count() - 1 do begin
                LinesArray.Get(i, Token);
                if Token.IsObject() then begin
                    LineJson := Token.AsObject();
                    LineAmount := GetDecimalValue(LineJson, 'quantity') * GetDecimalValue(LineJson, 'unitPrice');
                    TotalAmount += LineAmount;
                    Summary.Append(StrSubstNo('Line %1: %2 x %3 = %4',
                        i + 1,
                        GetDecimalValue(LineJson, 'quantity'),
                        GetTextValue(LineJson, 'description'),
                        LineAmount) + LineFeed);
                end;
            end;
        end;

        Summary.Append(StrSubstNo('Total: %1', TotalAmount));
        Message('%1', Summary.ToText());
    end;

    // Returns the text, or '' if the key is missing or the value is null
    local procedure GetTextValue(JsonObj: JsonObject; KeyName: Text): Text
    var
        Token: JsonToken;
    begin
        if not JsonObj.Get(KeyName, Token) then
            exit('');
        if not Token.IsValue() then
            exit('');
        if Token.AsValue().IsNull() then
            exit('');
        exit(Token.AsValue().AsText());
    end;

    // Returns the number, or 0 if the key is missing or the value is null
    local procedure GetDecimalValue(JsonObj: JsonObject; KeyName: Text): Decimal
    var
        Token: JsonToken;
    begin
        if not JsonObj.Get(KeyName, Token) then
            exit(0);
        if not Token.IsValue() then
            exit(0);
        if Token.AsValue().IsNull() then
            exit(0);
        exit(Token.AsValue().AsDecimal());
    end;

    // Returns true or false, or false if the key is missing or the value is null
    local procedure GetBooleanValue(JsonObj: JsonObject; KeyName: Text): Boolean
    var
        Token: JsonToken;
    begin
        if not JsonObj.Get(KeyName, Token) then
            exit(false);
        if not Token.IsValue() then
            exit(false);
        if Token.AsValue().IsNull() then
            exit(false);
        exit(Token.AsValue().AsBoolean());
    end;
}
```

(Change `ABC` and `50170` to your own prefix and object ID.)

When you run it with our order, you get something like this:

```text
Order: SO-1001
Date: 25-10-26        (in your own date format)
URGENT
Remarks:
Customer: Adatum & Co, Chennai
Line 1: 2 x Bicycle = 9,001
Line 2: 5 x Front Wheel = 3,750
Total: 12,751
```

Look at `Remarks:`. It's empty, and there's no error, because the helper saw the `null` and gave back an empty text. That's exactly why I like these helpers.

And the date? APIs usually send dates as text like `2026-10-25`. I read it as text and convert it with `Evaluate(..., 9)`, which understands that format.

### If you are on a newer version

From runtime 15 (Business Central 2025 release wave 1), Microsoft added direct helpers like `GetText`, `GetDecimal`, `GetObject` and `GetArray` on `JsonObject` and `JsonArray`. If you pass `true` as the second parameter, they return a default when the key is missing:

```al
OrderNo := OrderJson.GetText('orderNo', true);
CustomerJson := OrderJson.GetObject('customer');
```

Shorter, for sure. But if you're on an older version, the token way above works everywhere, and it's good to understand it anyway.

## Writing JSON is the same picture, backwards

To send JSON to an API, you fill the cupboard first and then turn it into text:

```al
procedure BuildOrderJson(): Text
var
    OrderJson: JsonObject;
    CustomerJson: JsonObject;
    LineJson: JsonObject;
    LinesArray: JsonArray;
    JsonText: Text;
begin
    OrderJson.Add('orderNo', 'SO-1001');
    OrderJson.Add('urgent', true);

    CustomerJson.Add('no', 'C0010');
    CustomerJson.Add('name', 'Adatum & Co');
    OrderJson.Add('customer', CustomerJson);

    Clear(LineJson);
    LineJson.Add('itemNo', '1000');
    LineJson.Add('quantity', 2);
    LinesArray.Add(LineJson);

    Clear(LineJson);
    LineJson.Add('itemNo', '1100');
    LineJson.Add('quantity', 5);
    LinesArray.Add(LineJson);

    OrderJson.Add('lines', LinesArray);

    OrderJson.WriteTo(JsonText);
    exit(JsonText);
end;
```

Notice the `Clear(LineJson)` before each line. That gives you a fresh, empty object, so the second line doesn't get mixed up with the first.

## Mistakes I made, so you don't have to

**"Why did my variable change by itself?"**
This one surprised me. JSON types in AL are **reference types**. When you write `Copy := Original`, you don't get a copy. Both names point to the **same** cupboard:

```al
Copy := Original;          // NOT a copy, both point to the same object
Copy.Add('extra', 1);      // Original now has "extra" too

Copy := Original.Clone().AsObject();   // a real, separate copy
```

If you need a real copy, use `Clone()`.

**Opening the parcel the wrong way.** If the API sends an array where you expected an object, `AsObject()` gives an error. That's why the full code checks `IsObject()` or `IsArray()` first.

**Reading `null` with `AsText()`.** Runtime error. Check `IsNull()` first, or just use the helper.

**Starting the loop at 1.** The first box is 0. Loop from `0` to `Count() - 1`.

**Typing the key a little differently.** Don't expect `Get('OrderNo', ...)` to find `"orderNo"`. Treat keys as case-sensitive, and copy them exactly as the API shows them.

## So, in short

- JSON is just objects `{ }`, arrays `[ ]` and values.
- `JsonObject` is a cupboard with named drawers, `JsonArray` is a row of numbered boxes, `JsonValue` is the thing inside, and `JsonToken` is the closed parcel you get every time you take something out.
- Take it out with `Get`, check with `IsObject` / `IsArray` / `IsValue`, open with `AsObject` / `AsArray` / `AsValue`.
- Use `SelectToken('$.path')` when you need one value deep inside.
- Use small helpers so missing keys and `null` values don't break your code.
- Assigning JSON variables shares the data. Use `Clone()` for a real copy.

Next, I'd like to join this with the API post: call a real API, read the JSON answer, and create a sales order from it in Business Central. If that sounds useful, tell me in the comments. And if you have a JSON trick of your own, I'd love to hear it.
