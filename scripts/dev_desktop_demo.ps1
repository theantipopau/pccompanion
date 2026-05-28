$ErrorActionPreference = 'Stop'

# Run desktop dev mode with demo branding.
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$env:VITE_BRAND_MODE = 'demo'
$tauriConfPath = Join-Path $root 'src-tauri\tauri.conf.json'
$tauriBackupPath = Join-Path $root 'src-tauri\tauri.conf.demo-dev-backup.json'
Write-Host "VITE_BRAND_MODE=$($env:VITE_BRAND_MODE)"

Copy-Item $tauriConfPath $tauriBackupPath -Force

$exitCode = 1
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

	npx.cmd tauri dev
	$exitCode = $LASTEXITCODE
}
finally {
	if (Test-Path $tauriBackupPath) {
		Move-Item $tauriBackupPath $tauriConfPath -Force
	}
}

exit $exitCode
