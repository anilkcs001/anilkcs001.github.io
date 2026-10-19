---
title: Show request and response JSON in colour on a Business Central page (WebPageViewer)
date: 2026-10-19
type: solution
tags: AL, JSON, WebPageViewer, Integration, Business Central
summary: Build a log page that shows the request and response JSON side by side, indented and colour-coded like a code editor, using the built-in WebPageViewer and a small recursive procedure.
---

## The problem

Your integration saves what it sent and what it got back. When something fails, you open the log and see this:

```text
{"orderId":"SO-1001","lines":[{"item":"1000","qty":5},{"item":"1100","qty":2}],"urgent":true,"remarks":null}
```

One long line. You cannot see the structure, and it is easy to miss the one wrong value. A `Message` with indented text helps, but a normal user does not want pop-ups. They want to open the log record and just **see** the request and the response.

## What we build

A card page with two panels side by side:

| Left panel | Right panel |
|------------|-------------|
| Request message | Response message |

Each panel shows the JSON indented, with colours:

| Part | Colour |
|------|--------|
| Keys | Blue, bold |
| Text values | Red |
| Numbers | Green |
| `true` / `false` | Dark blue |
| `null` | Grey |
| Brackets | Black, bold |

## The idea in simple words

1. Read the JSON text from the log record.
2. Turn it into **HTML**: the same walk through objects, arrays and values as a normal JSON formatter, but each part is wrapped in a `<span>` with a colour class.
3. Give that HTML to the **WebPageViewer**. This control add-in comes with Business Central and shows HTML inside a page. You do not need to write any JavaScript or deploy a control add-in of your own.

A JSON token is only an **object**, an **array** or a **value**. Objects and arrays contain more tokens, so one procedure that calls itself handles any depth.

## How the input goes in

The page does not call any service. It only **shows** what is already saved in the log record. So the input is the JSON text stored in two Blob fields: one for the request, one for the response.

Your integration code saves them when it makes a call. This codeunit shows how, and its `OnRun` creates one sample record and opens the page, so you can test without any real service:

```al
codeunit 50111 "ABC Integration Log Mgt"
{
    trigger OnRun()
    var
        IntegrationLog: Record "ABC Integration Log";
        EntryNo: Integer;
    begin
        EntryNo := SaveLog(
            '{"orderId":"SO-1001","customer":{"no":"C0010","name":"Adatum & Co"},"lines":[{"item":"1000","qty":5}],"urgent":true,"remarks":null}',
            '{"status":"Accepted","documentNo":"INV-2001","total":1250.75,"errors":[]}');

        IntegrationLog.Get(EntryNo);
        Page.Run(Page::"ABC Integration Log Card", IntegrationLog);
    end;

    procedure SaveLog(RequestJson: Text; ResponseJson: Text): Integer
    var
        IntegrationLog: Record "ABC Integration Log";
        OutStreamL: OutStream;
    begin
        IntegrationLog.Init();

        IntegrationLog."Request Payload".CreateOutStream(OutStreamL, TextEncoding::UTF8);
        OutStreamL.WriteText(RequestJson);

        IntegrationLog."Response Payload".CreateOutStream(OutStreamL, TextEncoding::UTF8);
        OutStreamL.WriteText(ResponseJson);

        IntegrationLog.Insert(true);
        exit(IntegrationLog."Entry No.");
    end;
}
```

In your own integration, call `SaveLog` with the text you sent and the text you received. The JSON is saved exactly as it came, as one line, with no formatting. The page does all the formatting when someone opens it.

## What you see on the page

For the sample above, the card opens like this:

```text
+-----------------------------------+-----------------------------------+
| Request Message                   | Response Message                  |
+-----------------------------------+-----------------------------------+
| {                                 | {                                 |
|   "orderId": "SO-1001",           |   "status": "Accepted",           |
|   "customer": {                   |   "documentNo": "INV-2001",       |
|     "no": "C0010",                |   "total": 1250.75,               |
|     "name": "Adatum & Co"         |   "errors": [                     |
|   },                              |   ]                               |
|   "lines": [                      | }                                 |
|     {                             |                                   |
|       "item": 1000,               |                                   |
|       "qty": 5                    |                                   |
|     }                             |                                   |
|   ],                              |                                   |
|   "urgent": true,                 |                                   |
|   "remarks": null                 |                                   |
| }                                 |                                   |
+-----------------------------------+-----------------------------------+
```

The colours on the screen:

| What you see | Colour |
|--------------|--------|
| `"orderId"`, `"customer"`, `"status"` (the keys) | Blue, bold |
| `"SO-1001"`, `"Accepted"`, `"Adatum & Co"` | Red |
| `1000`, `5`, `1250.75` | Green |
| `true` | Dark blue |
| `null` | Grey |
| `{ }` and `[ ]` | Black, bold |

Two small things to notice:

- `"item": 1000` has no quotes and is green, although the original was the text `"1000"`. The code decides by looking at the text, and `1000` looks like a number. More about this in "Things to know".
- The empty list `"errors": []` is drawn as `[` and `]` on two lines. It is correct, just taller than the original.

If a record has no response yet, that panel shows the grey message **No response data available**. If the saved text is not valid JSON, the panel shows a red **Invalid JSON format**.

## Full code

The log table needs two Blob fields that hold the request and the response text. If your table already has them, use your own names.

### Log table

```al
table 50110 "ABC Integration Log"
{
    Caption = 'Integration Log';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Entry No."; Integer)
        {
            Caption = 'Entry No.';
            AutoIncrement = true;
        }
        field(2; "Request Payload"; Blob)
        {
            Caption = 'Request Payload';
        }
        field(3; "Response Payload"; Blob)
        {
            Caption = 'Response Payload';
        }
    }

    keys
    {
        key(PK; "Entry No.")
        {
            Clustered = true;
        }
    }
}
```

### Log card page

```al
page 50110 "ABC Integration Log Card"
{
    Caption = 'Integration Log';
    PageType = Card;
    ApplicationArea = All;
    UsageCategory = None;
    SourceTable = "ABC Integration Log";
    Editable = false;

    layout
    {
        area(Content)
        {
            grid(MessageGrid)
            {
                GridLayout = Columns;
                ShowCaption = false;

                group(RequestMessageGroup)
                {
                    Caption = 'Request Message';
                    ShowCaption = true;

                    usercontrol(RequestViewer; WebPageViewer)
                    {
                        ApplicationArea = All;

                        trigger ControlAddInReady(callbackUrl: Text)
                        begin
                            RequestControlReady := true;
                            UpdateRequestViewer();
                        end;
                    }
                }

                group(ResponseMessageGroup)
                {
                    Caption = 'Response Message';
                    ShowCaption = true;

                    usercontrol(ResponseViewer; WebPageViewer)
                    {
                        ApplicationArea = All;

                        trigger ControlAddInReady(callbackUrl: Text)
                        begin
                            ResponseControlReady := true;
                            UpdateResponseViewer();
                        end;
                    }
                }
            }
        }
    }

    var
        RequestText: Text;
        ResponseText: Text;
        RequestControlReady: Boolean;
        ResponseControlReady: Boolean;

    trigger OnAfterGetCurrRecord()
    begin
        LoadJsonMessages();
        UpdateRequestViewer();
        UpdateResponseViewer();
    end;

    local procedure LoadJsonMessages()
    var
        InStreamL: InStream;
    begin
        RequestText := '';
        ResponseText := '';

        Rec.CalcFields("Request Payload", "Response Payload");

        if Rec."Request Payload".HasValue() then begin
            Rec."Request Payload".CreateInStream(InStreamL, TextEncoding::UTF8);
            RequestText := ReadAllText(InStreamL);
        end;

        if Rec."Response Payload".HasValue() then begin
            Rec."Response Payload".CreateInStream(InStreamL, TextEncoding::UTF8);
            ResponseText := ReadAllText(InStreamL);
        end;
    end;

    local procedure ReadAllText(var InStreamL: InStream): Text
    var
        Result: TextBuilder;
        LineText: Text;
    begin
        // ReadText stops at the end of a line, so read line by line until the stream ends
        while not InStreamL.EOS do begin
            InStreamL.ReadText(LineText);
            Result.Append(LineText);
        end;

        exit(Result.ToText());
    end;

    local procedure UpdateRequestViewer()
    begin
        if not RequestControlReady then
            exit;

        if RequestText = '' then
            CurrPage.RequestViewer.SetContent(GetEmptyMessageHtml('No request data available'))
        else
            CurrPage.RequestViewer.SetContent(ConvertJsonToFormattedHtml(RequestText));
    end;

    local procedure UpdateResponseViewer()
    begin
        if not ResponseControlReady then
            exit;

        if ResponseText = '' then
            CurrPage.ResponseViewer.SetContent(GetEmptyMessageHtml('No response data available'))
        else
            CurrPage.ResponseViewer.SetContent(ConvertJsonToFormattedHtml(ResponseText));
    end;

    local procedure ConvertJsonToFormattedHtml(JsonInput: Text): Text
    var
        JsonToken: JsonToken;
        HtmlBuilder: TextBuilder;
    begin
        if not JsonToken.ReadFrom(JsonInput) then
            exit('<div style="padding:10px;color:red;">Invalid JSON format</div>');

        HtmlBuilder.Append('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>');
        HtmlBuilder.Append('body{margin:0;padding:15px;background:#fff;font-family:Consolas,"Courier New",monospace;font-size:13px;}');
        HtmlBuilder.Append('.key{color:#0078d4;font-weight:600;}');
        HtmlBuilder.Append('.string{color:#a31515;}');
        HtmlBuilder.Append('.number{color:#098658;}');
        HtmlBuilder.Append('.boolean{color:#0000ff;}');
        HtmlBuilder.Append('.null{color:#808080;}');
        HtmlBuilder.Append('.bracket{color:#000;font-weight:bold;}');
        HtmlBuilder.Append('</style></head><body>');

        ParseToken(JsonToken, HtmlBuilder, 0);

        HtmlBuilder.Append('</body></html>');
        exit(HtmlBuilder.ToText());
    end;

    local procedure ParseToken(Token: JsonToken; var Html: TextBuilder; IndentLevel: Integer)
    var
        JsonObj: JsonObject;
        JsonArr: JsonArray;
        ChildToken: JsonToken;
        PropertyName: Text;
        i: Integer;
        KeyCount: Integer;
        CurrentKey: Integer;
    begin
        case true of
            Token.IsObject():
                begin
                    JsonObj := Token.AsObject();
                    KeyCount := JsonObj.Keys.Count();

                    Html.Append('<span class="bracket">{</span><br/>');

                    CurrentKey := 0;
                    foreach PropertyName in JsonObj.Keys do begin
                        CurrentKey += 1;
                        JsonObj.Get(PropertyName, ChildToken);

                        Html.Append(GetIndent(IndentLevel + 1));
                        Html.Append('<span class="key">"' + EscapeHtml(PropertyName) + '"</span>: ');

                        ParseToken(ChildToken, Html, IndentLevel + 1);

                        if CurrentKey < KeyCount then
                            Html.Append(',');
                        Html.Append('<br/>');
                    end;

                    Html.Append(GetIndent(IndentLevel));
                    Html.Append('<span class="bracket">}</span>');
                end;

            Token.IsArray():
                begin
                    JsonArr := Token.AsArray();

                    Html.Append('<span class="bracket">[</span><br/>');

                    for i := 0 to JsonArr.Count() - 1 do begin
                        JsonArr.Get(i, ChildToken);
                        Html.Append(GetIndent(IndentLevel + 1));

                        ParseToken(ChildToken, Html, IndentLevel + 1);

                        if i < JsonArr.Count() - 1 then
                            Html.Append(',');
                        Html.Append('<br/>');
                    end;

                    Html.Append(GetIndent(IndentLevel));
                    Html.Append('<span class="bracket">]</span>');
                end;

            Token.IsValue():
                Html.Append(FormatValue(Token.AsValue()));
        end;
    end;

    local procedure FormatValue(JsonValue: JsonValue): Text
    var
        ValueText: Text;
    begin
        if JsonValue.IsNull() then
            exit('<span class="null">null</span>');

        if JsonValue.IsUndefined() then
            exit('<span class="null">undefined</span>');

        ValueText := JsonValue.AsText();

        case true of
            (ValueText = 'true') or (ValueText = 'false'):
                exit('<span class="boolean">' + ValueText + '</span>');
            IsNumber(ValueText):
                exit('<span class="number">' + ValueText + '</span>');
            else
                exit('<span class="string">"' + EscapeHtml(ValueText) + '"</span>');
        end;
    end;

    local procedure IsNumber(Value: Text): Boolean
    var
        DecimalValue: Decimal;
    begin
        exit(Evaluate(DecimalValue, Value));
    end;

    local procedure GetIndent(Level: Integer): Text
    var
        i: Integer;
        IndentText: TextBuilder;
    begin
        for i := 1 to Level do
            IndentText.Append('&nbsp;&nbsp;');

        exit(IndentText.ToText());
    end;

    local procedure EscapeHtml(InputText: Text): Text
    var
        Result: Text;
    begin
        Result := InputText;
        Result := Result.Replace('&', '&amp;');
        Result := Result.Replace('<', '&lt;');
        Result := Result.Replace('>', '&gt;');
        Result := Result.Replace('"', '&quot;');
        Result := Result.Replace('''', '&#39;');
        exit(Result);
    end;

    local procedure GetEmptyMessageHtml(MessageText: Text): Text
    begin
        exit('<!DOCTYPE html><html><head><style>body{font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:20px;text-align:center;color:#666;}</style></head><body><p>' +
             EscapeHtml(MessageText) +
             '</p></body></html>');
    end;
}
```

Replace `ABC` and the object IDs with your own prefix and IDs.

## How it works, step by step

**1. Two viewers, two ready flags.** Each `usercontrol(...; WebPageViewer)` is a small browser inside the page. It is not ready the moment the page opens. When it is ready, it raises `ControlAddInReady`, and only then can we call `SetContent`. That is why each viewer has a `...ControlReady` flag: the update procedures do nothing until the flag is `true`. Whichever comes last (the record loading or the viewer becoming ready) triggers the drawing, so the order never matters.

**2. Reading the Blob.** `OnAfterGetCurrRecord` runs each time the user moves to a record. It loads the two blob fields and reads them as text. `ReadText` stops at the end of a line, so a JSON that was saved with line breaks would be cut after its first line. The loop `while not InStreamL.EOS` keeps reading until the stream is finished, and a `TextBuilder` joins the lines. Line breaks do not matter to JSON, so nothing is lost.

**3. Check the JSON first.** `ReadFrom` returns `false` for broken JSON. Then the panel shows a red "Invalid JSON format" instead of an error.

**4. Walk the tree (`ParseToken`).**

- **Object:** write `{`, then for each key write the indent, the blue key and `: `, then call `ParseToken` again for the value. Add a comma after the value unless it is the last key. Write `}` at the end.
- **Array:** the same, without keys. Array positions in AL start at `0`.
- **Value:** hand it to `FormatValue`.

**5. Colour the value (`FormatValue`).** `null` and `undefined` are checked first, because `AsText()` would fail on them. Then the text decides the colour: `true` or `false` is a boolean, anything that `Evaluate` can read as a decimal is a number, and everything else is a string.

**6. Indent.** HTML ignores normal spaces, so the indent is `&nbsp;&nbsp;` (two non-breaking spaces) per level, and each line ends with `<br/>`.

**7. Escape everything (`EscapeHtml`).** This is the most important safety step. The request and response come from outside. If one contains something like `<script>`, it must be shown as text, not run. Keys and text values are both escaped before they go into the HTML.

## One small example, step by step

Take this input:

```text
{"name":"Anil","qty":5,"urgent":true,"manager":null}
```

`ParseToken` walks it from left to right and adds one piece of HTML for each part:

| Step | The code sees | It adds to the HTML |
|------|---------------|---------------------|
| 1 | Start of an object | `<span class="bracket">{</span><br/>` |
| 2 | Key `name` (level 1) | two spaces, then `<span class="key">"name"</span>: ` |
| 3 | Value `Anil`, text | `<span class="string">"Anil"</span>` then `,<br/>` |
| 4 | Key `qty`, value `5` | `<span class="key">"qty"</span>: <span class="number">5</span>,<br/>` |
| 5 | Key `urgent`, value `true` | `<span class="key">"urgent"</span>: <span class="boolean">true</span>,<br/>` |
| 6 | Key `manager`, value `null` | `<span class="key">"manager"</span>: <span class="null">null</span><br/>` (no comma, it is the last key) |
| 7 | End of the object | `<span class="bracket">}</span>` |

Joined together, the HTML body is:

```html
<span class="bracket">{</span><br/>&nbsp;&nbsp;<span class="key">"name"</span>: <span class="string">"Anil"</span>,<br/>&nbsp;&nbsp;<span class="key">"qty"</span>: <span class="number">5</span>,<br/>&nbsp;&nbsp;<span class="key">"urgent"</span>: <span class="boolean">true</span>,<br/>&nbsp;&nbsp;<span class="key">"manager"</span>: <span class="null">null</span><br/><span class="bracket">}</span>
```

`ConvertJsonToFormattedHtml` puts the style block in front of it and `</body></html>` after it, and `SetContent` hands the whole page to the viewer. The viewer is a browser, so it draws `<br/>` as a new line, `&nbsp;` as a space, and each `class` with its colour.

When the value is itself an object or an array (like `customer` or `lines` in the big example), step 3 is replaced by the same steps again, one level deeper. That is the "procedure calls itself" part.

## Things to know

- **Colour is guessed from the text.** `FormatValue` reads every value as text. A **text** value like `"1000"` or a phone number such as `"9876543210"` looks like a number, so it is shown green **and without its quotes**. This is only for reading. If the exact type matters, look at the original JSON.
- **Use `HasValue()` after `CalcFields`.** Blob fields are not loaded by default. Calculate them first, then check them, as the code does.
- **Fixed white background.** The page inside the viewer has its own CSS, so it stays white even if the user works in a dark theme. Change the `body` colour if that bothers you.
- **Big payloads.** The viewer handles long text well, but thousands of lines still take time to build. Keep the log for what you need and clean old entries.
- **Do not log secrets.** Tokens, passwords and API keys can be in a request or a response. Remove or mask them before saving the log.
- **Old tables with text fields.** If your table stores the payload in several `Text` fields (for example `Payload 1`, `Payload 2`), join them as a fallback when the blob is empty. The viewer code stays the same.
- **No JavaScript to deploy.** The `WebPageViewer` is a standard control add-in. You send it ready-made HTML and it draws it.

## Takeaway

Store the raw JSON in a Blob, and turn it into coloured HTML only when someone opens the record. One recursive procedure walks objects, arrays and values, and `WebPageViewer` shows the result. Escape every piece of text, and wait for `ControlAddInReady` before you call `SetContent`.
