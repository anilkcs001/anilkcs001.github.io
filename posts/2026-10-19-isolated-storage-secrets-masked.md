---
title: Stop storing API keys in a Business Central field: use Isolated Storage and a masked field
date: 2026-10-19
type: solution
tags: AL, Security, Isolated Storage, SecretText, Business Central
summary: Keep API keys and passwords out of your setup table. Store them encrypted in Isolated Storage, show them masked on the page, and read them back as SecretText.
---

## The problem

An integration needs an API key. The quick way is to add a `Text[250]` field to the setup table and a field on the setup page:

```al
field(10; "API Key"; Text[250])
{
    Caption = 'API Key';
}
```

It works, but the key is now ordinary business data. Anyone who can open that table, or a list page or a web service that exposes it, can read it in plain text. It also travels with every database copy and shows up in the debugger.

A field on the page can only be hidden from the eyes. A secret needs to be kept somewhere else.

## Approach

- The setup table keeps only **non-secret** settings (base URL and so on).
- The secret lives in **Isolated Storage**, encrypted, under a key that only your extension can read.
- The page shows a **masked** field. It never loads the real value. It only shows dots when a key exists.
- The code reads the key back as **SecretText**, so it cannot be seen in the debugger or leak by accident into a `Message`.

| Piece | Job |
|-------|-----|
| Setup table | Base URL and other normal settings. No secret field |
| `ABC Secret Management` codeunit | The only place that touches Isolated Storage |
| Setup page | Masked input, shows dots when a key is saved |
| Permission set | Access to the table, page and codeunit |

Replace `ABC` and the object IDs with your own prefix and IDs.

## Full code

### Setup table (no secret field)

```al
table 50100 "ABC Integration Setup"
{
    Caption = 'Integration Setup';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Primary Key"; Code[10])
        {
            Caption = 'Primary Key';
            DataClassification = SystemMetadata;
        }
        field(2; "Base URL"; Text[250])
        {
            Caption = 'Base URL';
        }
    }

    keys
    {
        key(PK; "Primary Key")
        {
            Clustered = true;
        }
    }
}
```

### Secret management codeunit

```al
codeunit 50100 "ABC Secret Management"
{
    Access = Public;

    var
        ApiKeyStorageKeyTok: Label 'ABC-IntegrationApiKey', Locked = true;

    /// Saves the key encrypted. An empty value removes it.
    [NonDebuggable]
    procedure SetApiKey(ApiKey: SecretText)
    begin
        if ApiKey.IsEmpty() then begin
            DeleteApiKey();
            exit;
        end;

        IsolatedStorage.SetEncrypted(ApiKeyStorageKeyTok, ApiKey, DataScope::Company);
    end;

    /// Returns the key as SecretText. Returns an empty SecretText when none is saved.
    [NonDebuggable]
    procedure GetApiKey() ApiKey: SecretText
    begin
        if not IsolatedStorage.Contains(ApiKeyStorageKeyTok, DataScope::Company) then
            exit;

        IsolatedStorage.Get(ApiKeyStorageKeyTok, DataScope::Company, ApiKey);
    end;

    procedure HasApiKey(): Boolean
    begin
        exit(IsolatedStorage.Contains(ApiKeyStorageKeyTok, DataScope::Company));
    end;

    procedure DeleteApiKey()
    begin
        if IsolatedStorage.Contains(ApiKeyStorageKeyTok, DataScope::Company) then
            IsolatedStorage.Delete(ApiKeyStorageKeyTok, DataScope::Company);
    end;
}
```

`DataScope::Company` matches a setup table, which is also per company. Use `DataScope::Module` if one key should be shared by all companies.

### Setup page with a masked field

```al
page 50100 "ABC Integration Setup"
{
    Caption = 'Integration Setup';
    PageType = Card;
    ApplicationArea = All;
    UsageCategory = Administration;
    SourceTable = "ABC Integration Setup";
    InsertAllowed = false;
    DeleteAllowed = false;

    layout
    {
        area(Content)
        {
            group(General)
            {
                Caption = 'General';

                field("Base URL"; Rec."Base URL")
                {
                    ToolTip = 'Specifies the address of the external service.';
                }
                field(ApiKeyInput; ApiKeyInput)
                {
                    Caption = 'API Key';
                    ExtendedDatatype = Masked;
                    ToolTip = 'Specifies the API key. It is stored encrypted and is never shown again.';

                    trigger OnValidate()
                    begin
                        SaveApiKey();
                    end;
                }
            }
        }
    }

    var
        SecretMgt: Codeunit "ABC Secret Management";
        ApiKeyInput: Text[250];
        MaskPlaceholderTok: Label '**********', Locked = true;

    trigger OnOpenPage()
    begin
        Rec.Reset();
        if not Rec.Get() then begin
            Rec.Init();
            Rec.Insert();
        end;
    end;

    trigger OnAfterGetCurrRecord()
    begin
        ShowMask();
    end;

    local procedure ShowMask()
    begin
        if SecretMgt.HasApiKey() then
            ApiKeyInput := MaskPlaceholderTok
        else
            ApiKeyInput := '';
    end;

    local procedure SaveApiKey()
    begin
        // The placeholder means "unchanged", so never overwrite the saved key with it
        if ApiKeyInput = MaskPlaceholderTok then
            exit;

        SecretMgt.SetApiKey(ApiKeyInput);
        ShowMask();
    end;
}
```

How the masking works:

- The field is bound to a **variable**, not to a table field, so the real key is never loaded into the page.
- `ExtendedDatatype = Masked` makes the web client show dots instead of the characters.
- When a key exists, the field shows a fixed placeholder. The user sees dots and knows a key is saved.
- If the user types a new value, it replaces the key. If they clear the field, the key is deleted.

### Use the key in a web call

```al
procedure CallService(RequestUrl: Text)
var
    SecretMgt: Codeunit "ABC Secret Management";
    Client: HttpClient;
    Response: HttpResponseMessage;
begin
    if not SecretMgt.HasApiKey() then
        Error('The API key is not set up. Open Integration Setup and enter it.');

    // Add(Text, SecretText) keeps the key as a secret all the way into the header
    Client.DefaultRequestHeaders().Add('X-Api-Key', SecretMgt.GetApiKey());

    if not Client.Get(RequestUrl, Response) then
        Error('The service could not be reached.');

    if not Response.IsSuccessStatusCode() then
        Error('The service returned status %1.', Response.HttpStatusCode());
end;
```

### Permission set

```al
permissionset 50100 "ABC INTEGRATION"
{
    Caption = 'Integration Setup';
    Assignable = true;

    Permissions =
        tabledata "ABC Integration Setup" = RIMD,
        table "ABC Integration Setup" = X,
        page "ABC Integration Setup" = X,
        codeunit "ABC Secret Management" = X;
}
```

Isolated Storage itself needs no table permission. Access is decided by your extension, not by the user.

## Result

| What | Before (table field) | After (Isolated Storage) |
|------|----------------------|--------------------------|
| Key visible in table data or a list page | Yes, plain text | No, there is no field |
| Key visible on the setup page | Yes | Dots only |
| Key readable by other extensions | Yes, through the table | No, storage is isolated per extension |
| Stored in the database | Plain text | Encrypted |
| Visible in the debugger | Yes | No, it is `SecretText` and the procedures are `NonDebuggable` |

## Notes

**Masking is only a display setting.** `Masked` hides characters on the screen. The real protection is that the value is not in a table field. If you ever see the key in a field, a variable that a page binds to, or a `Message`, it is not protected.

**Know the limits**

- `SetEncrypted` accepts at most **215 characters**, and special characters can take more space. A long token or a certificate does not fit. Use `Set` for long values only if you accept that it is not encrypted, or split the design.
- The default scope is `DataScope::Module`. Choose the scope deliberately: `Module` (whole extension), `Company`, `User`, or `CompanyAndUser`.
- Keep the key out of everything else: do not put it in error text, `Message`, telemetry, logs or a stored URL. Query strings count.
- Avoid `Unwrap()` on a `SecretText`. It is only available for on-premises installations, and it turns the value back into plain text. Pass the `SecretText` straight to APIs that accept it, such as `HttpHeaders.Add(Text, SecretText)`.
- `SecretText` cannot be used as an event parameter, a control add-in parameter or a protected variable. Pass it between your own procedures instead.
- The page variable briefly holds the text the user types, before it is saved. The saved key is protected, but treat the typing step as the one moment the value is plain text in memory.

**On-premises.** `SetEncrypted` needs an encryption key to exist on the server. The methods that create the key are on-premises only, and a per-tenant extension must not call them.

**Environments and copies.** When an environment is copied, test the integration in the copy before you rely on it, and re-enter the key there if it fails. Outbound HTTP calls from extensions are also blocked in a copy until you allow them for the extension on the **Extension Management** page. Use separate keys for sandbox and production so that a leaked test key costs nothing.

**Keys that belong to you, not the customer.** If the secret is yours as the app publisher (not entered by the customer), keep it in **Azure Key Vault** and read it from AL. Isolated Storage is best for secrets the customer enters.

**Clean up.** If your extension is uninstalled and the key should go, call `DeleteApiKey()` from your uninstall code so that nothing is left behind.

## Takeaway

Never give a secret a table field. Put it in Isolated Storage with `SetEncrypted`, read it back as `SecretText`, and show a masked placeholder on the page. The setup table keeps only what is safe to see.
