param(
  [switch]$Repair
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$tauriConfPath = Join-Path $root 'src-tauri\tauri.conf.json'
$tauriBackupPath = Join-Path $root 'src-tauri\tauri.conf.demo-dev-backup.json'

function Read-TauriConfig {
  param([string]$Path)
  return (Get-Content $Path -Raw | ConvertFrom-Json)
}

if (-not (Test-Path $tauriConfPath)) {
  Write-Output "CONFIG_MISSING=$tauriConfPath"
  exit 1
}

$restoredFromBackup = $false
if (Test-Path $tauriBackupPath) {
  if ($Repair) {
    Move-Item $tauriBackupPath $tauriConfPath -Force
    $restoredFromBackup = $true
    Write-Output 'RESTORED_FROM_BACKUP=1'
  } else {
    Write-Output "PENDING_BACKUP=$tauriBackupPath"
    Write-Output 'Run with -Repair to restore tauri.conf.json automatically.'
    exit 1
  }
}

$conf = Read-TauriConfig -Path $tauriConfPath
$issues = New-Object System.Collections.Generic.List[string]

if ($conf.productName -ne 'Radium PCs Companion') {
  $issues.Add("productName=$($conf.productName)")
}
if ($conf.identifier -ne 'com.radiumpcs.companion') {
  $issues.Add("identifier=$($conf.identifier)")
}
if ($conf.app.windows[0].title -ne 'Radium PCs Companion') {
  $issues.Add("windowTitle=$($conf.app.windows[0].title)")
}

$bundleIcons = @()
if ($null -ne $conf.bundle.icon) {
  $bundleIcons = @($conf.bundle.icon)
}
if ($bundleIcons -contains 'icons/demo-icon.ico') {
  $issues.Add('bundleIconContainsDemoIcon=1')
}

$installerIcon = $conf.bundle.windows.nsis.installerIcon
if ($installerIcon -eq 'icons/demo-icon.ico') {
  $issues.Add('installerIconIsDemoIcon=1')
}

if ($issues.Count -gt 0) {
  Write-Output 'DEMO_DEV_CONFIG_RESTORE_FAILED=1'
  foreach ($issue in $issues) {
    Write-Output ("ISSUE={0}" -f $issue)
  }
  exit 1
}

Write-Output 'DEMO_DEV_CONFIG_RESTORE_OK=1'
Write-Output "CONFIG_PATH=$tauriConfPath"
if (-not $restoredFromBackup) {
  Write-Output 'RESTORED_FROM_BACKUP=0'
}
