---
title: Amount in words in RDLC reports (Lakh and Crore, any currency)
date: 2026-10-19
type: solution
tags: RDLC, Reports, Amount in Words, India
summary: Paste one block of VB code into your RDLC report and print any amount in words, in lakhs and crores, for INR and 15 other currencies.
---

## Requirement

Invoices, vouchers and cheques often need the total in words, for example **One Lakh Twenty Five Thousand Rupees Only**.

The solution should:

- Use Indian numbering (Thousand, Lakh, Crore)
- Show paisa or the matching sub-unit for the currency
- Print the right currency name
- Handle zero and negative amounts

## Approach

Everything lives in the report's **Code** section as plain Visual Basic. There is no AL change, no new object and no extension to install.

You only ever call one function. The rest are helpers.

| Function | What it does |
|----------|--------------|
| `FormatAmountInWords` | **The one you call.** Takes the amount and currency code, returns the full sentence |
| `ConvertNum` | Turns a whole number into words (Lakh, Crore and so on) |
| `GetMainUnit` | Currency name, for example Rupees, Dollars |
| `GetSubUnit` | Sub-unit name, for example Paisa, Cents |
| `GetOnes`, `GetTeens`, `GetTens` | Word tables for 0-9, 10-19 and 20-90 |

Supported currencies: INR, USD, EUR, GBP, AED, SAR, SGD, AUD, CAD, JPY, CHF, KWD, OMR, QAR, BHD and MYR. A blank currency code is treated as local currency (Rupees). Any other code is printed as it is, with "Cents" as the sub-unit.

## Full code

```vb
Public Function FormatAmountInWords(Number As Decimal, CurrencyCode As String) As String
    If Number < 0 Then
        Number = Math.Abs(Number)
        Return "Minus " & FormatAmountInWords(Number, CurrencyCode)
    End If

    Number = Math.Round(Number, 2)

    Dim WholePart As Decimal
    Dim DecimalPart As Integer
    Dim AmountTxt As String = CStr(Number)
    Dim DotPos As Integer = InStr(AmountTxt, ".")
    Dim DecTxt As String

    If DotPos = 0 Then
        WholePart = Number
        DecimalPart = 0
    Else
        WholePart = CDec(Mid(AmountTxt, 1, DotPos - 1))
        DecTxt = Mid(AmountTxt, DotPos + 1)
        If Len(DecTxt) = 1 Then DecTxt = DecTxt & "0"
        If Len(DecTxt) > 2 Then DecTxt = Left(DecTxt, 2)
        DecimalPart = CInt(DecTxt)
    End If

    Dim MainUnit As String = GetMainUnit(CurrencyCode)
    Dim SubUnit As String = GetSubUnit(CurrencyCode)

    Dim Result As String = ""
    If WholePart = 0 And DecimalPart = 0 Then
        Result = "Zero " & MainUnit & " Only"
    ElseIf WholePart > 0 And DecimalPart = 0 Then
        Result = ConvertNum(WholePart) & " " & MainUnit & " Only"
    ElseIf WholePart = 0 And DecimalPart > 0 Then
        Result = ConvertNum(DecimalPart) & " " & SubUnit & " Only"
    Else
        Result = ConvertNum(WholePart) & " " & MainUnit & " and " & ConvertNum(DecimalPart) & " " & SubUnit & " Only"
    End If

    Return Result
End Function

Public Function GetMainUnit(CurrencyCode As String) As String
    Select Case UCase(Trim(CurrencyCode))
        Case "", "INR"
            Return "Rupees"
        Case "USD"
            Return "Dollars"
        Case "EUR"
            Return "Euros"
        Case "GBP"
            Return "Pounds"
        Case "AED"
            Return "Dirhams"
        Case "SAR"
            Return "Riyals"
        Case "SGD"
            Return "Dollars"
        Case "AUD"
            Return "Dollars"
        Case "CAD"
            Return "Dollars"
        Case "JPY"
            Return "Yen"
        Case "CHF"
            Return "Francs"
        Case "KWD"
            Return "Dinars"
        Case "OMR"
            Return "Rials"
        Case "QAR"
            Return "Riyals"
        Case "BHD"
            Return "Dinars"
        Case "MYR"
            Return "Ringgit"
        Case Else
            Return CurrencyCode
    End Select
End Function

Public Function GetSubUnit(CurrencyCode As String) As String
    Select Case UCase(Trim(CurrencyCode))
        Case "", "INR"
            Return "Paisa"
        Case "USD", "SGD", "AUD", "CAD", "EUR"
            Return "Cents"
        Case "GBP"
            Return "Pence"
        Case "AED", "SAR", "QAR", "BHD", "KWD", "OMR"
            Return "Fils"
        Case "JPY"
            Return "Sen"
        Case "CHF"
            Return "Centimes"
        Case "MYR"
            Return "Sen"
        Case Else
            Return "Cents"
    End Select
End Function

Public Function ConvertNum(Num As Decimal) As String
    If Num < 0 Then Num = Math.Abs(Num)

    If Num < 10 Then
        Return GetOnes(Num)
    ElseIf Num < 20 Then
        Return GetTeens(Num - 10)
    ElseIf Num < 100 Then
        If Num Mod 10 <> 0 Then
            Return GetTens(Num \ 10) & " " & GetOnes(Num Mod 10)
        Else
            Return GetTens(Num \ 10)
        End If
    ElseIf Num < 1000 Then
        If Num Mod 100 <> 0 Then
            Return ConvertNum(Num \ 100) & " Hundred " & ConvertNum(Num Mod 100)
        Else
            Return ConvertNum(Num \ 100) & " Hundred"
        End If
    ElseIf Num < 100000 Then
        If Num Mod 1000 <> 0 Then
            Return ConvertNum(Num \ 1000) & " Thousand " & ConvertNum(Num Mod 1000)
        Else
            Return ConvertNum(Num \ 1000) & " Thousand"
        End If
    ElseIf Num < 10000000 Then
        If Num Mod 100000 <> 0 Then
            Return ConvertNum(Num \ 100000) & " Lakh " & ConvertNum(Num Mod 100000)
        Else
            Return ConvertNum(Num \ 100000) & " Lakh"
        End If
    Else
        If Num Mod 10000000 <> 0 Then
            Return ConvertNum(Num \ 10000000) & " Crore " & ConvertNum(Num Mod 10000000)
        Else
            Return ConvertNum(Num \ 10000000) & " Crore"
        End If
    End If
End Function

Public Function GetOnes(Index As Integer) As String
    Dim Ones() As String = {"Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"}
    Return Ones(Index)
End Function

Public Function GetTeens(Index As Integer) As String
    Dim Teens() As String = {"Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"}
    Return Teens(Index)
End Function

Public Function GetTens(Index As Integer) As String
    Dim TensArr() As String = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"}
    Return TensArr(Index)
End Function
```

## Setup

**1. Add the code to the report**

Open the `.rdlc` layout in Report Builder or Visual Studio. Right-click the empty area outside the report body, choose **Report Properties**, open the **Code** tab, and paste the whole block above.

**2. Make sure the dataset has the amount and currency**

Your AL dataset needs two columns. The column names are what you use in the layout.

```al
dataitem("Sales Invoice Header"; "Sales Invoice Header")
{
    column(TotalAmount; "Amount Including VAT") { }
    column(CurrencyCode; "Currency Code") { }

    trigger OnAfterGetRecord()
    begin
        CalcFields("Amount Including VAT");
    end;
}
```

**3. Add a textbox with this expression**

```
=Code.FormatAmountInWords(CDec(Fields!TotalAmount.Value), Fields!CurrencyCode.Value)
```

To show a total of a column in a table footer, wrap the amount in `Sum` and the currency in `First`:

```
=Code.FormatAmountInWords(CDec(Sum(Fields!LineAmount.Value)), First(Fields!CurrencyCode.Value))
```

Republish the extension and run the report.

## Result

| Amount | Currency | Printed text |
|--------|----------|--------------|
| 1234.50 | blank | One Thousand Two Hundred Thirty Four Rupees and Fifty Paisa Only |
| 0.75 | INR | Seventy Five Paisa Only |
| 1250000 | INR | Twelve Lakh Fifty Thousand Rupees Only |
| 45678912.34 | USD | Four Crore Fifty Six Lakh Seventy Eight Thousand Nine Hundred Twelve Dollars and Thirty Four Cents Only |
| 0 | blank | Zero Rupees Only |
| -500 | blank | Minus Five Hundred Rupees Only |

## Notes

**Add a new currency.** Add one `Case "XXX"` line in `GetMainUnit` and one in `GetSubUnit`. Without it, the currency code itself is printed as the name.

**Keep these limits in mind**

- The amount is rounded to 2 decimals first. KWD, OMR and BHD normally use 3 decimals, so the last digit is lost for those.
- Unit names are always plural, so 1 prints as "One Rupees Only".
- Very large amounts work, because anything above a crore is counted in crores (for example "One Hundred Crore").

**Optional: make it safe for commas as the decimal separator.** The code finds the decimal point by looking for a `.` in the number's text. On a system whose language writes decimals with a comma, the paisa part would be missed. If you need that, replace everything from `Dim WholePart As Decimal` down to the `End If` just before `Dim MainUnit As String` with these two lines:

```vb
Dim WholePart As Decimal = Math.Floor(Number)
Dim DecimalPart As Integer = CInt((Number - WholePart) * 100)
```
