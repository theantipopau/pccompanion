param(
  [string]$ExePath = "src-tauri/target/release/radium_pcs_companion.exe",
  [string]$SetupPath = "src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.2.0_x64-setup.exe",
  [string]$PfxPath = $env:RADIUM_SIGN_PFX,
  [string]$PfxPassword = $env:RADIUM_SIGN_PFX_PASSWORD,
  [string]$CertThumbprint = $env:RADIUM_SIGN_CERT_THUMBPRINT,
  [string]$TimestampUrl = "http://timestamp.digicert.com",
  [switch]$SkipAudit
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Resolve-ArtifactPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }
  return Join-Path $root $Path
}

function Find-SignTool {
  $command = Get-Command "signtool.exe" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
  if (Test-Path $kitsRoot) {
    $candidate = Get-ChildItem $kitsRoot -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) {
      return $candidate.FullName
    }
  }

  throw "signtool.exe was not found. Install Windows SDK / Visual Studio Build Tools, then re-run this script."
}

function Invoke-SignTool([string]$SignTool, [string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "Artifact missing: $Path"
  }

  $args = @("sign", "/fd", "SHA256", "/tr", $TimestampUrl, "/td", "SHA256")

  if (-not [string]::IsNullOrWhiteSpace($PfxPath)) {
    $resolvedPfx = Resolve-ArtifactPath $PfxPath
    if (-not (Test-Path $resolvedPfx)) {
      throw "PFX file not found: $resolvedPfx"
    }
    $args += @("/f", $resolvedPfx)
    if (-not [string]::IsNullOrWhiteSpace($PfxPassword)) {
      $args += @("/p", $PfxPassword)
    }
  } elseif (-not [string]::IsNullOrWhiteSpace($CertThumbprint)) {
    $args += @("/sha1", $CertThumbprint)
  } else {
    throw "No signing identity provided. Set RADIUM_SIGN_PFX + RADIUM_SIGN_PFX_PASSWORD, or RADIUM_SIGN_CERT_THUMBPRINT."
  }

  $args += $Path
  & $SignTool @args
  if ($LASTEXITCODE -ne 0) {
    throw "signtool failed for $Path"
  }
}

$exe = Resolve-ArtifactPath $ExePath
$setup = Resolve-ArtifactPath $SetupPath
$signTool = Find-SignTool

Write-Output "SIGNTOOL=$signTool"
Invoke-SignTool -SignTool $signTool -Path $exe
Invoke-SignTool -SignTool $signTool -Path $setup

if (-not $SkipAudit) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/pre_release_artifact_audit.ps1" `
    -ExePath $exe `
    -SetupPath $setup `
    -RequireSignature
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Write-Output "RADIUM_SIGNING_OK=1"
