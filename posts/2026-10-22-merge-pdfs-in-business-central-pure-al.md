---
title: Merge PDFs in Business Central with pure AL (no ControlAddIn, no Azure), and one problem I need your help with
date: 2026-10-22
type: solution
tags: AL, PDF, Reports, OnPreRendering, Business Central
summary: Upload any number of PDFs on a page and download them as one merged file, using only AL and the report OnPreRendering trigger. It works, but the result starts with one blank page. What I tried, and a request for your ideas.
---

## The requirement

A user wants to:

1. Upload two or more PDF files in Business Central.
2. Click one button.
3. Download **one** PDF with all the files merged, in the order they were uploaded.

Most answers on the internet say you need one of these:

- a **ControlAddIn** with a JavaScript PDF library, or
- an **Azure Function** that merges the files outside Business Central.

Both work, but both add something extra to build, host and maintain. This post shows a third way that uses **only AL**. I got the idea from an article by Ali Naqvi on LinkedIn, *[Merge External PDFs in Business Central Reports: No ControlAddIn, No Azure – Just Pure AL](https://www.linkedin.com/pulse/merge-external-pdfs-business-central-reports-azure-just-ali-naqvi-e1dnc)*, and built a small upload-and-merge tool on top of it.

It works. But there is **one problem I could not solve: the merged PDF always starts with a blank page.** I explain what I tried at the end, and I would love your suggestions.

## Best use: add attachments to a real report

Before the merge tool, the simplest and cleanest use of this technique: **adding PDFs to a report that already has content.**

For example, print a sales invoice and add your terms and conditions PDF, a product datasheet or a signed delivery note at the end, all as one PDF file. The report's own pages come first, and your PDFs follow. There is no blank page problem here, because the first page is the real invoice.

The pattern is the same as the carrier report below: build the list of files in `OnPreReport`, and hand it to the payload in `OnPreRendering`. If you only need this, you can stop reading after the "How it works" section.

## The idea in simple words

Business Central cannot merge two PDFs directly from code. But it **can** do something else: when a **report** is printed to PDF, the platform can **add other PDF files after the report's own pages**.

Microsoft documents this in [Attach files, append, and protect report PDFs in AL](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-post-process-report-pdf). A report has a trigger called `OnPreRendering`. In it, you fill a JSON object (the *rendering payload*) with instructions, for example "add these PDF files at the end". After the report is rendered, the platform reads those instructions and does the work.

So the trick is:

1. Make a tiny report whose only job is to **carry** our files. I call it the **carrier report**.
2. Tell it, through the payload, to append all uploaded PDFs.
3. Save the report as PDF. The result is: the report's own page, then all our files.

**Important:** the JSON does not become a PDF, and your AL code does not merge anything. The JSON is only a list of instructions. The **platform** does the merging.

## How it works, step by step

```text
User uploads PDF 1, PDF 2, PDF 3 ...    -> kept in memory on the page (Temp Blob)
User clicks "Merge & Download"
  -> page gives the files to the carrier report
  -> report runs:
       OnPreReport      : PDF Document codeunit -> Initialize, then AddStreamToAppend for each file
       OnPreRendering   : RenderingPayload := PDFDocument.ToJson(RenderingPayload)
  -> platform renders the report page, then appends every file listed in the payload
  -> one PDF comes back as a stream
  -> page downloads it as Merged.pdf
```

The helper here is the System Application codeunit **PDF Document**. I used three of its procedures:

| Procedure | What it does |
|-----------|--------------|
| `Initialize()` | Starts a new, empty list of files |
| `AddStreamToAppend(InStream)` | Adds one PDF (as a stream) to the list |
| `ToJson(RenderingPayload)` | Writes the list into the rendering payload as `additionalDocuments` |

You do not write any temp files yourself. `ToJson` takes care of it.

## What the payload looks like

I printed the payload while testing. With two uploaded files, it looked like this (paths shortened):

```json
{
  "version": "1.0",
  "attachments": [],
  "additionalDocuments": [
    "C:\\ProgramData\\...\\TEMP\\__TEMP__c4628dba....tmp",
    "C:\\ProgramData\\...\\TEMP\\__TEMP__f153efad....tmp"
  ],
  "protection": { "user": "", "admin": "" }
}
```

Each uploaded PDF became a temp file on the server, and both are listed in `additionalDocuments`. That is exactly what the platform needs to append them.

## The full code

Four AL objects and a minimal RDLC layout. No table is needed: the page keeps the files in memory. Replace `AK` and the IDs with your own prefix and range.

### The page: upload, count, merge

```al
page 50100 "AK Merge PDF"
{
    Caption = 'AK Merge PDF';
    PageType = Card;
    ApplicationArea = All;
    UsageCategory = Tasks;

    layout
    {
        area(Content)
        {
            group(Summary)
            {
                Caption = 'Summary';

                field(FilesUploadedField; FileCount)
                {
                    Caption = 'Files uploaded';
                    Editable = false;
                    ToolTip = 'Specifies how many PDF files are waiting to be merged.';
                }
                field(FileListField; FileList)
                {
                    Caption = 'Files (in merge order)';
                    Editable = false;
                    MultiLine = true;
                    ToolTip = 'Specifies the uploaded files in the order they will be merged.';
                }
            }
        }
    }

    actions
    {
        area(Processing)
        {
            action(UploadPdf)
            {
                Caption = 'Upload PDF';
                Image = Import;
                ToolTip = 'Upload another PDF to add to the merge.';

                trigger OnAction()
                var
                    FileName: Text;
                begin
                    if FileCount >= 50 then
                        Error(MaxFilesErr, 50);

                    if MergeMgt.UploadPdf(TempBlobs[FileCount + 1], FileName) then begin
                        FileCount += 1;
                        FileNames[FileCount] := FileName;
                        RebuildList();
                    end;
                end;
            }
            action(RemoveLast)
            {
                Caption = 'Remove Last';
                Image = Delete;
                ToolTip = 'Remove the most recently uploaded file.';

                trigger OnAction()
                begin
                    if FileCount = 0 then
                        exit;
                    Clear(TempBlobs[FileCount]);
                    FileNames[FileCount] := '';
                    FileCount -= 1;
                    RebuildList();
                end;
            }
            action(ClearAll)
            {
                Caption = 'Clear All';
                Image = ClearLog;
                ToolTip = 'Remove all uploaded files.';

                trigger OnAction()
                begin
                    Clear(TempBlobs);
                    Clear(FileNames);
                    FileCount := 0;
                    RebuildList();
                end;
            }
            action(MergeAndDownload)
            {
                Caption = 'Merge && Download';
                Image = Export;
                ToolTip = 'Merge all uploaded PDFs and download one file.';

                trigger OnAction()
                begin
                    MergeMgt.MergeAndDownload(TempBlobs, FileCount);
                end;
            }
        }
        area(Promoted)
        {
            actionref(UploadPdf_Promoted; UploadPdf) { }
            actionref(RemoveLast_Promoted; RemoveLast) { }
            actionref(ClearAll_Promoted; ClearAll) { }
            actionref(MergeAndDownload_Promoted; MergeAndDownload) { }
        }
    }

    var
        MergeMgt: Codeunit "AK Merge PDF Mgt";
        TempBlobs: array[50] of Codeunit "Temp Blob";
        FileNames: array[50] of Text;
        FileCount: Integer;
        FileList: Text;
        MaxFilesErr: Label 'You can merge at most %1 files at once.', Comment = '%1 = maximum number of files';

    local procedure RebuildList()
    var
        NewLine: Text[2];
        i: Integer;
    begin
        NewLine[1] := 13;
        NewLine[2] := 10;
        FileList := '';
        for i := 1 to FileCount do begin
            if i > 1 then
                FileList += NewLine;
            FileList += Format(i) + '. ' + FileNames[i];
        end;
        CurrPage.Update(false);
    end;
}
```

### The codeunit: upload one file, merge and download

```al
codeunit 50101 "AK Merge PDF Mgt"
{
    Caption = 'AK Merge PDF Mgt';

    var
        NothingToMergeErr: Label 'Upload at least two PDF files before merging.';
        UploadCaptionTxt: Label 'Select a PDF file';
        PdfFilterTxt: Label 'PDF files (*.pdf)|*.pdf', Locked = true;

    procedure UploadPdf(var TempBlob: Codeunit "Temp Blob"; var FileName: Text): Boolean
    var
        InStr: InStream;
        OutStr: OutStream;
    begin
        if not UploadIntoStream(UploadCaptionTxt, '', PdfFilterTxt, FileName, InStr) then
            exit(false);

        Clear(TempBlob);
        TempBlob.CreateOutStream(OutStr);
        CopyStream(OutStr, InStr);
        exit(true);
    end;

    procedure MergeAndDownload(var TempBlobs: array[50] of Codeunit "Temp Blob"; FileCount: Integer)
    var
        TempBlobResult: Codeunit "Temp Blob";
        Carrier: Report "AK Merge PDF Carrier";
        InStr: InStream;
        OutStr: OutStream;
        FileName: Text;
    begin
        if FileCount < 2 then
            Error(NothingToMergeErr);

        Carrier.SetFiles(TempBlobs, FileCount);
        TempBlobResult.CreateOutStream(OutStr);
        Carrier.SaveAs('', ReportFormat::Pdf, OutStr);

        // DownloadFromStream needs a Text variable for the file name (it is a var parameter)
        FileName := 'Merged.pdf';
        TempBlobResult.CreateInStream(InStr);
        DownloadFromStream(InStr, '', '', '', FileName);
    end;
}
```

### The carrier report

The report copies the files into its own `Temp Blob` variables, so every stream stays alive for the whole report run. The dataset has one dummy row.

```al
report 50100 "AK Merge PDF Carrier"
{
    Caption = 'AK Merge PDF Carrier';
    UsageCategory = None;
    DefaultLayout = RDLC;
    RDLCLayout = 'src/AKMergePdfCarrier.rdlc';

    dataset
    {
        dataitem(Integer; Integer)
        {
            DataItemTableView = where(Number = const(1));

            column(Dummy; Number)
            {
            }
        }
    }

    var
        PDFDocument: Codeunit "PDF Document";
        TempBlobs: array[50] of Codeunit "Temp Blob";
        InStreams: array[50] of InStream;
        FileCount: Integer;

    procedure SetFiles(var SourceBlobs: array[50] of Codeunit "Temp Blob"; SourceCount: Integer)
    var
        InStr: InStream;
        OutStr: OutStream;
        i: Integer;
    begin
        FileCount := SourceCount;
        for i := 1 to FileCount do begin
            SourceBlobs[i].CreateInStream(InStr);
            TempBlobs[i].CreateOutStream(OutStr);
            CopyStream(OutStr, InStr);
        end;
    end;

    trigger OnPreReport()
    var
        i: Integer;
    begin
        PDFDocument.Initialize();

        for i := 1 to FileCount do begin
            TempBlobs[i].CreateInStream(InStreams[i]);
            PDFDocument.AddStreamToAppend(InStreams[i]);
        end;
    end;

    // The platform appends every file listed in the payload after the report's own page
    trigger OnPreRendering(var RenderingPayload: JsonObject)
    begin
        RenderingPayload := PDFDocument.ToJson(RenderingPayload);
    end;
}
```

### The permission set

```al
permissionset 50102 "AK MERGE PDF"
{
    Caption = 'AK Merge PDF';
    Assignable = true;

    Permissions =
        page "AK Merge PDF" = X,
        codeunit "AK Merge PDF Mgt" = X,
        report "AK Merge PDF Carrier" = X,
        tabledata Integer = R;
}
```

### The RDLC layout (`src/AKMergePdfCarrier.rdlc`)

A minimal layout with one empty text box:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition" xmlns:rd="http://schemas.microsoft.com/SQLServer/reporting/reportdesigner">
  <AutoRefresh>0</AutoRefresh>
  <DataSources>
    <DataSource Name="DataSource">
      <ConnectionProperties>
        <DataProvider>SQL</DataProvider>
        <ConnectString />
      </ConnectionProperties>
      <rd:SecurityType>None</rd:SecurityType>
    </DataSource>
  </DataSources>
  <ReportSections>
    <ReportSection>
      <Body>
        <ReportItems>
          <Textbox Name="Blank">
            <CanGrow>true</CanGrow>
            <KeepTogether>true</KeepTogether>
            <Paragraphs>
              <Paragraph>
                <TextRuns>
                  <TextRun>
                    <Value> </Value>
                    <Style />
                  </TextRun>
                </TextRuns>
                <Style />
              </Paragraph>
            </Paragraphs>
            <Top>0cm</Top>
            <Left>0cm</Left>
            <Height>0.6cm</Height>
            <Width>2cm</Width>
            <Style />
          </Textbox>
        </ReportItems>
        <Height>1cm</Height>
        <Style />
      </Body>
      <Width>19cm</Width>
      <Page>
        <PageHeight>29.7cm</PageHeight>
        <PageWidth>21cm</PageWidth>
        <LeftMargin>1cm</LeftMargin>
        <RightMargin>1cm</RightMargin>
        <TopMargin>1cm</TopMargin>
        <BottomMargin>1cm</BottomMargin>
        <Style />
      </Page>
    </ReportSection>
  </ReportSections>
  <Language>=User!Language</Language>
  <rd:ReportUnitType>Cm</rd:ReportUnitType>
  <rd:ReportID>4b0f6c1e-8a52-4d7e-9c33-1e6a9d2f5b10</rd:ReportID>
  <DataSets>
    <DataSet Name="Result">
      <Query>
        <DataSourceName>DataSource</DataSourceName>
        <CommandText />
      </Query>
      <Fields>
        <Field Name="Dummy">
          <DataField>Dummy</DataField>
        </Field>
      </Fields>
    </DataSet>
  </DataSets>
</Report>
```

## How to use it

1. Open **AK Merge PDF** from Tell Me.
2. Click **Upload PDF** once for each file. The page shows the count and the list in merge order.
3. Use **Remove Last** or **Clear All** if you made a mistake.
4. Click **Merge & Download**. You get `Merged.pdf`.

## Things to know

- **Version:** Microsoft lists this PDF post-processing as available from 2025 release wave 1. I tested on an on-premises server running a newer version. Check your own version before you use it.
- **Not for scheduled runs:** Microsoft's documentation lists appending documents as not supported when the report is scheduled, so use it from the web client.
- **Memory only:** the uploaded files live while the page is open. Close the page and they are gone.
- **50 files per merge:** AL arrays need a fixed size. Change the number if you need more.
- **SaaS:** I tested only on-premises. The code itself does not use any server file commands, so it may work online too, but I have not confirmed it.

## The open problem: an extra blank page at the start

Adding attachments to a real report works well, as described above. But I wanted to go one step further: merge PDFs **without** any real report, using an empty carrier report. Even though the report is blank, **I always get one extra blank page at the start** of the merged PDF.

The reason is clear: the carrier report renders its own page first, and the platform appends our files **after** it.

```text
Page 1        : blank (the carrier report itself)
Page 2 ...    : PDF 1
...           : PDF 2, PDF 3 ...
```

The payload has only `version`, `attachments`, `additionalDocuments` and `protection`. Nothing in it can remove or replace the report's own page.

**What I tried to remove it:**

| Attempt | Result |
|---------|--------|
| Dataset with no rows (`Number = const(0)`) and an RDLC with no report items at all | The blank page is still there. The renderer always produces at least one page |
| A processing-only report (`ProcessingOnly = true`, no layout) | Does not work. Without a rendering step, the files are not appended |
| Looking for a procedure in the PDF Document codeunit to remove a page or add a document at the start | No such procedure available. It only appends at the end |

**One idea left:** turn the first page into something useful, for example a **cover page** that lists the merged file names, the count and the date. Then the extra page becomes a feature. But a real way to remove it would be better.

**Any suggestions are always welcome.** If you know a way to remove that first page, or a better way to merge PDFs in pure AL, please leave a comment below. I will update this post with your solution and give you the credit.

## Summary

- Business Central cannot merge PDFs directly, but a report can **append** PDFs to its own output. This is perfect for adding attachments to a real report, like an invoice.
- A small **carrier report** with `OnPreRendering` and the **PDF Document** codeunit turns that into a merge tool, using only AL.
- The platform does the merging. Your code only builds the list of files in the rendering payload.
- One open issue: with an empty carrier report, there is still one blank page at the start. Suggestions are always welcome.
