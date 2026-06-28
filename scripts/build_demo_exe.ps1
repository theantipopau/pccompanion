$ErrorActionPreference = 'Stop'

# Build a demo-branded Windows binary without touching normal release artifacts.
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$env:VITE_BRAND_MODE = 'demo'
if ([string]::IsNullOrWhiteSpace($env:CARGO_TARGET_DIR)) {
  $env:CARGO_TARGET_DIR = (Join-Path $root 'src-tauri\target-demo')
}
$tauriConfPath = Join-Path $root 'src-tauri\tauri.conf.json'
$tauriBackupPath = Join-Path $root 'src-tauri\tauri.conf.demo-backup.json'

Write-Host "VITE_BRAND_MODE=$($env:VITE_BRAND_MODE)"
Write-Host "CARGO_TARGET_DIR=$($env:CARGO_TARGET_DIR)"

Copy-Item $tauriConfPath $tauriBackupPath -Force

try {
  $tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
  $tauriConf.productName = 'PC Companion'
  $tauriConf.identifier = 'com.pccompanion.demo'
  $tauriConf.app.windows[0].title = 'PC Companion'
  $tauriConf.bundle.publisher = 'PC Companion'
  $tauriConf.bundle.shortDescription = 'Premium Windows companion utility for gaming and workstation systems.'
  $tauriConf.bundle.longDescription = 'PC Companion provides local hardware monitoring, safe system utilities, tray controls, and OSD features for gaming and workstation builds.'
  $tauriConf.bundle.icon = @('icons/demo-icon.ico')
  $tauriConf.bundle.windows.nsis.installerIcon = 'icons/demo-icon.ico'
  $tauriConfJson = $tauriConf | ConvertTo-Json -Depth 100
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tauriConfPath, $tauriConfJson, $utf8NoBom)

  npm.cmd run build:sensor-sidecar
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  npx.cmd tauri build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $outDir = Join-Path $root 'artifacts\demo'
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $demoExe = Join-Path $env:CARGO_TARGET_DIR 'release\radium_pcs_companion.exe'
  $demoSetup = Join-Path $env:CARGO_TARGET_DIR 'release\bundle\nsis\PC Companion_0.2.0_x64-setup.exe'

  if (Test-Path $demoExe) {
    $stampedExe = Join-Path $outDir ("pc-companion-demo-" + $stamp + ".exe")
    Copy-Item $demoExe $stampedExe -Force
    Write-Host "DEMO_EXE=$demoExe"
    Write-Host "DEMO_COPY=$stampedExe"
  } else {
    Write-Host "Expected demo exe not found at: $demoExe"
    exit 1
  }

  if (Test-Path $demoSetup) {
    $stampedSetup = Join-Path $outDir ("pc-companion-demo-setup-" + $stamp + ".exe")
    Copy-Item $demoSetup $stampedSetup -Force
    Write-Host "DEMO_SETUP=$demoSetup"
    Write-Host "DEMO_SETUP_COPY=$stampedSetup"
  }
}
finally {
  if (Test-Path $tauriBackupPath) {
    Move-Item $tauriBackupPath $tauriConfPath -Force
  }
}
