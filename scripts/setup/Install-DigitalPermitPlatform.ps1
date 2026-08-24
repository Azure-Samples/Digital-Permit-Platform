[CmdletBinding()]
param(
    [string]$PackagePath = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

function Write-Step([int]$Number, [string]$Message) {
    Write-Host ""
    Write-Host "[$Number/5] $Message" -ForegroundColor Cyan
}

function Test-Command([string]$Name) {
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Add-CommonToolPaths {
    $paths = @(
        (Join-Path $env:ProgramFiles "nodejs"),
        (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links"),
        (Join-Path $env:LOCALAPPDATA "Programs\Azure Dev CLI")
    ) | Where-Object { $_ -and (Test-Path $_) }
    foreach ($path in $paths) {
        if (($env:Path -split ";") -notcontains $path) {
            $env:Path = "$path;$env:Path"
        }
    }
}

function Install-Prerequisite(
    [string]$DisplayName,
    [string]$Command,
    [string]$WingetId,
    [string]$LearnUrl
) {
    if (Test-Command $Command) { return }

    Write-Host "$DisplayName is required but is not installed." -ForegroundColor Yellow
    if (-not (Test-Command "winget")) {
        throw "Install $DisplayName from $LearnUrl, then run this Start file again."
    }

    Write-Host "Windows Package Manager may request local administrator approval, depending on the package and council device policy." -ForegroundColor Gray
    $answer = (Read-Host "Install $DisplayName with Windows Package Manager now? [Y/n]").Trim().ToLowerInvariant()
    if ($answer -and $answer -notin @("y", "yes")) {
        throw "Installation stopped. Install $DisplayName from $LearnUrl and run this Start file again."
    }

    & winget install --exact --id $WingetId --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Windows Package Manager could not install $DisplayName. Use $LearnUrl and try again."
    }
    Add-CommonToolPaths
    if (-not (Test-Command $Command)) {
        throw "$DisplayName was installed, but Windows has not refreshed the command path. Close this window and double-click the Start file again."
    }
}

function Resolve-SetupPackage([string]$RequestedPath) {
    if ($RequestedPath) {
        $resolved = Resolve-Path $RequestedPath -ErrorAction Stop
        return $resolved.Path
    }

    $bundled = Get-ChildItem -Path $ProjectRoot -Filter "*-setup.zip" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $bundled) {
        $bundled = Get-Item (Join-Path $ProjectRoot "customer-setup.zip") -ErrorAction SilentlyContinue
    }
    if (-not $bundled) {
        throw "The council setup ZIP is missing. Download a fresh installer bundle and try again."
    }
    return $bundled.FullName
}

try {
    Write-Host "Digital Permit Platform" -ForegroundColor White
    Write-Host "Customer-owned Azure installer" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Microsoft sign-in will open in your browser. This installer never asks for or stores your Azure password." -ForegroundColor Gray
    Write-Host "No Azure resources are changed until a resource preview is shown and you approve it." -ForegroundColor Gray
    Write-Host "Local computer administrator rights are only needed if prerequisites are missing and device policy requires elevation. Azure permissions are checked separately." -ForegroundColor Gray

    Write-Step 1 "Checking this computer"
    Install-Prerequisite "Node.js 22 LTS" "node" "OpenJS.NodeJS.LTS" "https://nodejs.org/en/download"
    Install-Prerequisite "Azure Developer CLI" "azd" "Microsoft.Azd" "https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd"
    Install-Prerequisite "Azure CLI" "az" "Microsoft.AzureCLI" "https://learn.microsoft.com/cli/azure/install-azure-cli-windows"

    $nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
    if ($nodeMajor -lt 22) {
        throw "Node.js 22 or later is required. Update Node.js and run this Start file again."
    }

    $SetupPackage = Resolve-SetupPackage $PackagePath
    Write-Host "Using setup package: $SetupPackage" -ForegroundColor Green

    Write-Step 2 "Preparing the deployment assistant"
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw "The deployment assistant dependencies could not be prepared. Check the internet or proxy connection and try again."
    }

    Write-Step 3 "Starting Microsoft sign-in and Azure checks"
    Write-Host "Your browser may open for Microsoft sign-in and multi-factor authentication." -ForegroundColor Gray

    Write-Step 4 "Previewing Azure resources and asking for approval"
    & npm run setup:deploy -- --package $SetupPackage
    if ($LASTEXITCODE -ne 0) {
        throw "Azure installation did not complete. It is safe to run this Start file again; the deployment is repeatable."
    }

    Write-Step 5 "Installation complete"
    Write-Host "The application and Setup URLs are shown above." -ForegroundColor Green
    Write-Host "Keep this folder and deployment-result.json for support and future updates." -ForegroundColor Gray
    exit 0
}
catch {
    Write-Host ""
    Write-Host "Installation stopped" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "No credentials were sent to the hosted installer. If Azure provisioning started, rerun this Start file to resume safely." -ForegroundColor Gray
    exit 1
}
