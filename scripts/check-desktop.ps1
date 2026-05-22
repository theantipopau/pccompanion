$ErrorActionPreference = "Stop"

function Test-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if ((Test-Path -LiteralPath $cargoBin) -and ($env:PATH -notlike "*$cargoBin*")) {
  $env:PATH = "$cargoBin;$env:PATH"
}

function Write-Check {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][bool]$Ok,
    [string]$Detail = ""
  )

  $status = if ($Ok) { "OK" } else { "MISSING" }
  $line = "{0,-24} {1}" -f $Label, $status
  if ($Detail) { $line = "$line - $Detail" }
  Write-Host $line
}

$missing = @()

$nodeOk = Test-Command "node"
$npmOk = Test-Command "npm.cmd"
$cargoOk = Test-Command "cargo"
$rustcOk = Test-Command "rustc"
$linkPath = Get-ChildItem "C:\Program Files\Microsoft Visual Studio\2022\*\VC\Tools\MSVC\*\bin\Hostx64\x64\link.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$linkOk = $null -ne $linkPath

Write-Host ""
Write-Host "Radium PCs Companion desktop preflight"
Write-Host "--------------------------------------"
Write-Check "Node.js" $nodeOk $(if ($nodeOk) { (node --version) } else { "install Node.js LTS" })
Write-Check "npm" $npmOk $(if ($npmOk) { (npm.cmd --version) } else { "install Node.js LTS" })
Write-Check "Rust cargo" $cargoOk $(if ($cargoOk) { (cargo --version) } else { "install Rust from https://rustup.rs then restart VS Code" })
Write-Check "Rust compiler" $rustcOk $(if ($rustcOk) { (rustc --version) } else { "install Rust from https://rustup.rs then restart VS Code" })
Write-Check "MSVC linker" $linkOk $(if ($linkOk) { $linkPath.FullName } else { "install Visual Studio C++ Build Tools workload" })

if (-not $nodeOk) { $missing += "Node.js" }
if (-not $npmOk) { $missing += "npm" }
if (-not $cargoOk) { $missing += "Rust cargo" }
if (-not $rustcOk) { $missing += "Rust compiler" }
if (-not $linkOk) { $missing += "MSVC linker / Visual C++ workload" }

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Desktop runtime is not ready. Missing: $($missing -join ', ')." -ForegroundColor Yellow
  Write-Host "Browser preview can still run with: npm.cmd run dev"
  Write-Host "Native desktop testing requires: npm.cmd run desktop"
  Write-Host "Standalone EXE build requires: npm.cmd run build:exe"
  exit 1
}

Write-Host ""
Write-Host "Desktop runtime is ready."
Write-Host "Run native app: npm.cmd run desktop"
Write-Host "Build EXE/installer: npm.cmd run build:exe"
