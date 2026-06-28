param(
  [string]$ExePath = "src-tauri/target/release/radium_pcs_companion.exe",
  [string]$SetupPath = "src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.2.0_x64-setup.exe",
  [string]$ExpectedProductName = "Radium PCs Companion",
  [switch]$RequireSignature,
  [string]$ManifestPath = ""
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

function Assert-ArtifactIdentity([string]$Path, [string]$Kind) {
  $resolved = Resolve-ArtifactPath $Path
  if (-not (Test-Path $resolved)) {
    throw "$Kind artifact missing: $resolved"
  }

  $item = Get-Item $resolved
  $info = $item.VersionInfo
  $errors = New-Object System.Collections.Generic.List[string]

  if ($info.ProductName -ne $ExpectedProductName) {
    $errors.Add("$Kind ProductName expected '$ExpectedProductName' but was '$($info.ProductName)'")
  }
  if ($info.FileDescription -ne $ExpectedProductName) {
    $errors.Add("$Kind FileDescription expected '$ExpectedProductName' but was '$($info.FileDescription)'")
  }
  if ($info.ProductName -eq "PC Companion" -or $info.FileDescription -eq "PC Companion") {
    $errors.Add("$Kind appears to be the neutral demo variant, not the Radium-branded package")
  }

  $signature = Get-AuthenticodeSignature $resolved
  if ($RequireSignature -and $signature.Status -ne "Valid") {
    $errors.Add("$Kind signature required Valid but was '$($signature.Status)'")
  }

  if ($errors.Count -gt 0) {
    throw ($errors -join [Environment]::NewLine)
  }

  $hash = Get-FileHash $resolved -Algorithm SHA256
  [PSCustomObject]@{
    kind = $Kind
    path = $item.FullName
    fileName = $item.Name
    length = $item.Length
    lastWriteTime = $item.LastWriteTime.ToString("o")
    productName = $info.ProductName
    fileDescription = $info.FileDescription
    fileVersion = $info.FileVersion
    productVersion = $info.ProductVersion
    sha256 = $hash.Hash
    signatureStatus = [string]$signature.Status
    signerCertificate = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { "" }
  }
}

$results = @(
  Assert-ArtifactIdentity -Path $ExePath -Kind "exe"
  Assert-ArtifactIdentity -Path $SetupPath -Kind "installer"
)

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $manifestDir = Join-Path $root "artifacts/radium"
  New-Item -ItemType Directory -Path $manifestDir -Force | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ManifestPath = Join-Path $manifestDir "radium-artifact-manifest-$stamp.json"
} else {
  $ManifestPath = Resolve-ArtifactPath $ManifestPath
  $manifestParent = Split-Path $ManifestPath -Parent
  if (-not [string]::IsNullOrWhiteSpace($manifestParent)) {
    New-Item -ItemType Directory -Path $manifestParent -Force | Out-Null
  }
}

$manifest = [PSCustomObject]@{
  generatedAt = (Get-Date).ToString("o")
  expectedProductName = $ExpectedProductName
  requireSignature = [bool]$RequireSignature
  artifacts = $results
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $ManifestPath -Encoding UTF8

$results |
  Select-Object kind, fileName, length, productName, fileDescription, signatureStatus, sha256 |
  Format-Table -AutoSize

Write-Output "RADIUM_ARTIFACT_AUDIT_OK=1"
Write-Output "MANIFEST_PATH=$ManifestPath"
