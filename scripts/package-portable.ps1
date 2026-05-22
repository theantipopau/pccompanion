$ErrorActionPreference = "Stop"

function Test-Command {
  param([Parameter(Mandatory = $true)][string]$Name)
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if ((Test-Path -LiteralPath $cargoBin) -and ($env:PATH -notlike "*$cargoBin*")) {
  $env:PATH = "$cargoBin;$env:PATH"
}

if (-not (Test-Command "cargo")) {
  throw "Cannot package portable EXE because Rust cargo is not installed or not on PATH. Install Rust from https://rustup.rs, restart VS Code, then rerun npm.cmd run package:portable."
}

if (-not (Test-Command "npm.cmd")) {
  throw "npm.cmd was not found on PATH."
}

$linkPath = Get-ChildItem "C:\Program Files\Microsoft Visual Studio\2022\*\VC\Tools\MSVC\*\bin\Hostx64\x64\link.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $linkPath) {
  throw "Cannot package portable EXE because MSVC link.exe is missing. Install Visual Studio 2022 C++ Build Tools / Desktop development with C++ workload, then rerun npm.cmd run package:portable."
}

$linkDir = Split-Path -Parent $linkPath.FullName
if ($env:PATH -notlike "*$linkDir*") {
  $env:PATH = "$linkDir;$env:PATH"
}

npm.cmd run build:exe

$releaseExe = Join-Path $PSScriptRoot "..\src-tauri\target\release\radium_pcs_companion.exe"
$releaseExe = [System.IO.Path]::GetFullPath($releaseExe)

if (-not (Test-Path -LiteralPath $releaseExe)) {
  throw "Expected release executable was not found: $releaseExe"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$portableRoot = Join-Path $PSScriptRoot "..\dist\portable\RadiumPCsCompanion-portable-$stamp"
$portableRoot = [System.IO.Path]::GetFullPath($portableRoot)
New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null

Copy-Item -LiteralPath $releaseExe -Destination (Join-Path $portableRoot "Radium PCs Companion.exe") -Force

@"
Radium PCs Companion Portable
=============================

Run "Radium PCs Companion.exe" to start the app.

Runtime logs are written per launch to:
%ProgramData%\Radium PCs Companion\logs\

Diagnostics exports are written to:
%ProgramData%\Radium PCs Companion\diagnostics\
"@ | Set-Content -Path (Join-Path $portableRoot "README.txt") -Encoding UTF8

$zipPath = "$portableRoot.zip"
Compress-Archive -LiteralPath $portableRoot -DestinationPath $zipPath -Force

Write-Host "Portable package created:"
Write-Host $portableRoot
Write-Host $zipPath
