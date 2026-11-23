---
title: CI/CD for Business Central in Azure DevOps, with only free Microsoft tools
date: 2026-11-24
type: solution
tags: CI/CD, Azure DevOps, DevOps, AL, Business Central
summary: A simple Azure DevOps pipeline that compiles a Business Central extension and publishes it to a sandbox on every push to main. No ALOps, no Docker, just Microsoft's free BcContainerHelper and one YAML file, explained step by step.
---

Every time I changed my extension, I did the same things by hand. Compile in VS Code, change the version, open the sandbox, upload the .app, wait. It's slow, and it's easy to forget one step.

So I built a CI/CD pipeline in Azure DevOps. Now, when I push to the main branch, the pipeline compiles the app and publishes it to the BC sandbox by itself.

Many people use **ALOps** for this. It's a third-party extension from the Azure DevOps marketplace, and it works well. But I wanted to use only free Microsoft tools. So I used **BcContainerHelper**, the free PowerShell module from Microsoft. And I didn't need Docker either.

In this post I'll explain everything step by step, in simple words.

## What is CI/CD, in simple words?

- **CI (Continuous Integration):** every time you push code, a machine compiles it automatically. If something is broken, you know straight away.
- **CD (Continuous Delivery/Deployment):** after it compiles, the machine also deploys it, here to a BC sandbox.

So you push your code, and a few minutes later the new version is in BC. Nobody uploads anything by hand.

## The whole pipeline in one picture

![The pipeline step by step: push to main, install BcContainerHelper, find app.json, stamp the version, compile without Docker, keep the .app, check the secrets, publish to the BC sandbox](images/bc-cicd-azure-devops/pipeline.jpg)

## Before you start: one-time setup

The pipeline has to log in to BC by itself, without a person. For that we use **service-to-service (S2S)** login with an app registration. You do this only once.

**1. Register an app in Microsoft Entra ID (Azure portal)**

- Go to **App registrations** → **New registration**. Give it a name, for example "BC DevOps Pipeline".
- Copy the **Application (client) ID** and the **Directory (tenant) ID**.
- Go to **Certificates & secrets** → **New client secret**. Copy the secret value now, because you can't see it again later.
- Go to **API permissions** → **Add a permission** → **Dynamics 365 Business Central** → **Application permissions**. Select **Automation.ReadWrite.All**.
- Click **Grant admin consent**.

**2. Allow that app inside Business Central**

- In BC, search for **Microsoft Entra Applications** and click **New**.
- Paste the **Client ID**, add a description, and set **State** to **Enabled**.
- Give it these permission sets: **D365 AUTOMATION** and **EXTEN. MGT. - ADMIN**. (BC doesn't allow SUPER for apps, and you don't need it.)

**3. Save the secrets in Azure DevOps**

In your pipeline, add these variables (or put them in a variable group):

| Variable | Value | Secret? |
|---|---|---|
| `azure_tenant_id` | Directory (tenant) ID | No |
| `azure_app_client_id` | Application (client) ID | No |
| `azure_app_client_secret` | The client secret | **Yes, lock it** |
| `bc_companyname` | Company name (optional) | No |

Never write the secret inside the YAML file. The YAML is in your repository, and anyone who can read the repository can read it.

## The pipeline, step by step

Here is each part of the YAML file, and what it does.

### When does it run?

```yaml
trigger:
  branches:
    include:
      - main

pr: none

pool:
  vmImage: windows-latest
```

- It runs on every push to **main**.
- `pr: none` means it doesn't run for pull requests.
- It uses a **Windows** machine from Microsoft, because BcContainerHelper is made for Windows.

### The settings

```yaml
variables:
  artifactType: Sandbox
  artifactCountry: in
  artifactVersion: '26.0'
  versionSelect: Latest
  alSourcePath: $(Build.SourcesDirectory)
  appVersionPrefix: '1.0.0'
  bcEnvironment: DEV-SANDBOX
  appOutputFolder: $(Build.ArtifactStagingDirectory)\output
```

- `artifactType`, `artifactCountry`, `artifactVersion`: which BC version to compile against. I use the **Sandbox**, **India** (`in`), version **26.0**. Use the same country and version as your BC environment.
- `appVersionPrefix`: the first part of the app version.
- `bcEnvironment`: the name of the BC environment to publish to. Change it to your environment's name.

### Step 1: Install BcContainerHelper

```yaml
- powershell: |
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
    Install-Module BcContainerHelper -Force -AllowClobber -Scope CurrentUser
    Import-Module BcContainerHelper
  displayName: Install BcContainerHelper
```

The Microsoft machine is empty every time. So the first step installs BcContainerHelper. Everything else uses it.

### Step 2: Find app.json

Sometimes the app is not in the root of the repository, it's in a subfolder. This step searches for `app.json` and uses that folder. If it finds more than one, it stops and tells you to set `alSourcePath` yourself. (The full script is in the complete YAML at the end.)

### Step 3: Stamp the version

```yaml
- powershell: |
    $appJsonPath = Join-Path $env:AL_SOURCE_PATH 'app.json'
    $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
    $newVersion = "$($env:APP_VERSION_PREFIX).$($env:BUILD_BUILDID)"
    $appJson.version = $newVersion
    $appJson | ConvertTo-Json -Depth 20 | Set-Content -Path $appJsonPath -Encoding UTF8
  displayName: Set app version
  env:
    AL_SOURCE_PATH: $(alSourcePath)
    APP_VERSION_PREFIX: $(appVersionPrefix)
```

**Why is this important?** BC doesn't accept the same app with the same version twice. If the version doesn't go up, the upload fails.

So every build gets the version `1.0.0.<BuildId>`. The Build ID is a number from Azure DevOps that goes up with every run. So the version is always higher than the last one, and I never have to change it by hand.

### Step 4: Compile, without Docker

```yaml
- powershell: |
    Import-Module BcContainerHelper
    $artifactUrl = Get-BCArtifactUrl -type $env:ARTIFACT_TYPE -country $env:ARTIFACT_COUNTRY `
        -version $env:ARTIFACT_VERSION -select $env:VERSION_SELECT
    $compilerFolder = New-BcCompilerFolder -artifactUrl $artifactUrl -includeAL
    Compile-AppWithBcCompilerFolder `
        -compilerFolder   $compilerFolder `
        -appProjectFolder $env:AL_SOURCE_PATH `
        -appOutputFolder  $env:APP_OUTPUT_FOLDER `
        -appSymbolsFolder (Join-Path $env:AL_SOURCE_PATH '.alpackages') `
        -FailOn 'error'
  displayName: Compile AL extension
```

This is the main step. In simple words:

1. `Get-BCArtifactUrl` finds the BC version we asked for (Sandbox, India, 26.0).
2. `New-BcCompilerFolder` downloads it and prepares a **compiler folder**: the AL compiler plus Microsoft's apps, which our app needs as symbols.
3. `Compile-AppWithBcCompilerFolder` compiles our app and creates the `.app` file.

Older pipelines started a full BC in a Docker container just to compile. The compiler folder doesn't need Docker, so it's simpler and faster.

`-FailOn 'error'` means the build fails on errors, but not on warnings.

### Step 5: Keep the .app file

```yaml
- task: PublishPipelineArtifact@1
  displayName: Publish .app as pipeline artifact
  inputs:
    targetPath: $(appOutputFolder)
    artifact: app
```

The `.app` file is saved with the pipeline run. If you ever need that exact version again, you can download it from the run.

### Step 6: Check the secrets

Before publishing, a small script checks that the tenant ID, client ID and secret are not empty. If one is missing, it stops with a clear message, instead of failing later with a confusing login error.

One thing I learned here: in Azure DevOps, **secret variables are not given to scripts automatically**. You have to pass them in the `env:` part of the step, like this:

```yaml
env:
  AZURE_TENANT_ID: $(azure_tenant_id)
  AZURE_APP_CLIENT_ID: $(azure_app_client_id)
  AZURE_APP_CLIENT_SECRET: $(azure_app_client_secret)
```

### Step 7: Publish to the BC sandbox

```yaml
- powershell: |
    Import-Module BcContainerHelper
    $auth = New-BcAuthContext `
        -tenantID     $env:AZURE_TENANT_ID `
        -clientID     $env:AZURE_APP_CLIENT_ID `
        -clientSecret (ConvertTo-SecureString $env:AZURE_APP_CLIENT_SECRET -AsPlainText -Force)
    $appFiles = @(Get-ChildItem $env:APP_OUTPUT_FOLDER -Filter '*.app' | ForEach-Object FullName)
    Publish-PerTenantExtensionApps -bcAuthContext $auth -environment $env:BC_ENVIRONMENT -appFiles $appFiles
  displayName: Publish extension to BC SaaS
```

- `New-BcAuthContext` logs in to BC as our app (S2S), using the tenant ID, client ID and secret.
- `Publish-PerTenantExtensionApps` uploads the `.app` to the environment, installs it, and **waits** until BC says it's done. If the install fails, the pipeline fails, so you see it straight away.

That's it. Push to main, and a few minutes later the new version is in your sandbox.

## Things to remember

- **The version must always go up.** That's why the Build ID is in the version.
- **Use the same country and version as your BC environment** in `artifactCountry` and `artifactVersion`. For India, it's `in`.
- **Keep secrets as secret variables**, and pass them through `env:`.
- **Give the app only what it needs** in BC: D365 AUTOMATION and EXTEN. MGT. - ADMIN.
- **Start with a sandbox.** For production, add a second stage with an approval, so a person says yes before it deploys.

## One thing to watch

`Publish-PerTenantExtensionApps` uploads the app through BC's **Automation API**. Microsoft has announced that the Automation API upload is deprecated and planned for removal in **2027 release wave 1**. The recommended way is now the **Admin Center API**. So keep BcContainerHelper up to date, and keep an eye on this before then.

## What's next

My next steps are to add automated tests to the pipeline, and a production stage with an approval. I'll write about those when they're done.

## The complete YAML

```yaml
trigger:
  branches:
    include:
      - main

pr: none

pool:
  vmImage: windows-latest

variables:
  artifactType: Sandbox
  artifactCountry: in
  artifactVersion: '26.0'
  versionSelect: Latest
  alSourcePath: $(Build.SourcesDirectory)
  appVersionPrefix: '1.0.0'
  bcEnvironment: DEV-SANDBOX
  appOutputFolder: $(Build.ArtifactStagingDirectory)\output
  # Set as pipeline variables (mark the secret as secret):
  # azure_tenant_id, azure_app_client_id, azure_app_client_secret
  # Optional: bc_companyname

stages:
  - stage: BuildAndDeploy
    displayName: Build and Deploy Business Central Extension
    jobs:
      - job: CompileAndPublish
        displayName: Compile and publish to BC SaaS
        steps:
          - checkout: self
            clean: true

          # 1. Install BcContainerHelper
          - powershell: |
              Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
              Install-Module BcContainerHelper -Force -AllowClobber -Scope CurrentUser
              Import-Module BcContainerHelper
              Write-Host "BcContainerHelper $((Get-Module BcContainerHelper).Version) loaded."
            displayName: Install BcContainerHelper

          # 2. Find app.json (also when the app is in a subfolder)
          - powershell: |
              $root = $env:AL_SOURCE_PATH
              if (Test-Path (Join-Path $root 'app.json')) {
                Write-Host "app.json found at $root"
                exit 0
              }
              $found = @(Get-ChildItem -Path $env:BUILD_SOURCESDIRECTORY -Recurse -File -Filter 'app.json' -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -notmatch '\\(\.alpackages|\.vscode|\.git|node_modules)\\' })
              if ($found.Count -eq 0) { throw "No app.json found under $env:BUILD_SOURCESDIRECTORY" }
              if ($found.Count -gt 1) {
                $found | ForEach-Object { Write-Host "  $($_.FullName)" }
                throw "Multiple app.json files found. Set the 'alSourcePath' variable to the app folder."
              }
              $appFolder = $found[0].DirectoryName
              Write-Host "Using AL project folder: $appFolder"
              Write-Host "##vso[task.setvariable variable=alSourcePath]$appFolder"
            displayName: Locate app.json
            env:
              AL_SOURCE_PATH: $(alSourcePath)

          # 3. Set the version to 1.0.0.<BuildId>
          - powershell: |
              $appJsonPath = Join-Path $env:AL_SOURCE_PATH 'app.json'
              if (-not (Test-Path $appJsonPath)) { throw "app.json not found at $appJsonPath" }
              $appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
              $newVersion = "$($env:APP_VERSION_PREFIX).$($env:BUILD_BUILDID)"
              Write-Host "Setting app version: $($appJson.version) -> $newVersion"
              $appJson.version = $newVersion
              $appJson | ConvertTo-Json -Depth 20 | Set-Content -Path $appJsonPath -Encoding UTF8
              Write-Host "##vso[build.updatebuildnumber]$newVersion"
            displayName: Set app version
            env:
              AL_SOURCE_PATH: $(alSourcePath)
              APP_VERSION_PREFIX: $(appVersionPrefix)

          # 4. Compile without Docker
          - powershell: |
              Import-Module BcContainerHelper
              $artifactUrl = Get-BCArtifactUrl `
                  -type    $env:ARTIFACT_TYPE `
                  -country $env:ARTIFACT_COUNTRY `
                  -version $env:ARTIFACT_VERSION `
                  -select  $env:VERSION_SELECT
              if (-not $artifactUrl) { throw "No BC artifact found for $env:ARTIFACT_TYPE/$env:ARTIFACT_COUNTRY/$env:ARTIFACT_VERSION" }
              Write-Host "Using artifact: $artifactUrl"

              $compilerFolder = New-BcCompilerFolder -artifactUrl $artifactUrl -includeAL

              New-Item -ItemType Directory -Path $env:APP_OUTPUT_FOLDER -Force | Out-Null
              $symbolsFolder = Join-Path $env:AL_SOURCE_PATH '.alpackages'
              New-Item -ItemType Directory -Path $symbolsFolder -Force | Out-Null

              Compile-AppWithBcCompilerFolder `
                  -compilerFolder    $compilerFolder `
                  -appProjectFolder  $env:AL_SOURCE_PATH `
                  -appOutputFolder   $env:APP_OUTPUT_FOLDER `
                  -appSymbolsFolder  $symbolsFolder `
                  -FailOn 'error'

              $app = Get-ChildItem $env:APP_OUTPUT_FOLDER -Filter '*.app' | Select-Object -First 1
              if (-not $app) { throw "Compile finished but no .app produced in $env:APP_OUTPUT_FOLDER" }
              Write-Host "Compiled: $($app.FullName)"
            displayName: Compile AL extension
            env:
              ARTIFACT_TYPE: $(artifactType)
              ARTIFACT_COUNTRY: $(artifactCountry)
              ARTIFACT_VERSION: $(artifactVersion)
              VERSION_SELECT: $(versionSelect)
              AL_SOURCE_PATH: $(alSourcePath)
              APP_OUTPUT_FOLDER: $(appOutputFolder)

          # 5. Keep the .app with the run
          - task: PublishPipelineArtifact@1
            displayName: Publish .app as pipeline artifact
            inputs:
              targetPath: $(appOutputFolder)
              artifact: app

          # 6. Check the secrets
          - powershell: |
              if ([string]::IsNullOrWhiteSpace($env:AZURE_TENANT_ID)) { throw "Missing required variable: azure_tenant_id" }
              if ([string]::IsNullOrWhiteSpace($env:AZURE_APP_CLIENT_ID)) { throw "Missing required variable: azure_app_client_id" }
              if ([string]::IsNullOrWhiteSpace($env:AZURE_APP_CLIENT_SECRET)) { throw "Missing required variable: azure_app_client_secret" }
              if ($env:BC_COMPANYNAME -match '^\$\(.+\)$') {
                Write-Warning "bc_companyname is a literal placeholder - it will be ignored."
              }
              Write-Host "Required publish variables are present."
            displayName: Validate publish variables
            env:
              AZURE_TENANT_ID: $(azure_tenant_id)
              AZURE_APP_CLIENT_ID: $(azure_app_client_id)
              AZURE_APP_CLIENT_SECRET: $(azure_app_client_secret)
              BC_COMPANYNAME: $(bc_companyname)

          # 7. Publish to the BC sandbox (S2S login)
          - powershell: |
              Import-Module BcContainerHelper
              $auth = New-BcAuthContext `
                  -tenantID     $env:AZURE_TENANT_ID `
                  -clientID     $env:AZURE_APP_CLIENT_ID `
                  -clientSecret (ConvertTo-SecureString $env:AZURE_APP_CLIENT_SECRET -AsPlainText -Force)

              $appFiles = @(Get-ChildItem $env:APP_OUTPUT_FOLDER -Filter '*.app' | ForEach-Object FullName)
              Write-Host "Publishing to environment '$env:BC_ENVIRONMENT':"
              $appFiles | ForEach-Object { Write-Host "  $_" }

              $params = @{
                  bcAuthContext = $auth
                  environment   = $env:BC_ENVIRONMENT
                  appFiles      = $appFiles
              }
              if ($env:BC_COMPANYNAME -and $env:BC_COMPANYNAME -notmatch '^\$\(.+\)$') {
                  $params.companyName = $env:BC_COMPANYNAME
              }
              Publish-PerTenantExtensionApps @params
            displayName: Publish extension to BC SaaS
            env:
              AZURE_TENANT_ID: $(azure_tenant_id)
              AZURE_APP_CLIENT_ID: $(azure_app_client_id)
              AZURE_APP_CLIENT_SECRET: $(azure_app_client_secret)
              BC_COMPANYNAME: $(bc_companyname)
              BC_ENVIRONMENT: $(bcEnvironment)
              APP_OUTPUT_FOLDER: $(appOutputFolder)
```

## Sources

- [BcContainerHelper (Microsoft, GitHub)](https://github.com/microsoft/navcontainerhelper)
- [Using service-to-service (S2S) authentication: app registration and permission sets (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/administration/automation-apis-using-s2s-authentication)
- [Deploy a per-tenant extension: version must go up (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/developer/devenv-deploy-tenant-customization)
- [Automation API extensionUpload: deprecated, planned for removal in 2027 release wave 1 (Microsoft Learn)](https://learn.microsoft.com/dynamics365/business-central/dev-itpro/administration/api/dynamics_extensionupload_create)
