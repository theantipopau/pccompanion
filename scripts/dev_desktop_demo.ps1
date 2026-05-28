$ErrorActionPreference = 'Stop'

# Run desktop dev mode with demo branding.
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$env:VITE_BRAND_MODE = 'demo'
Write-Host "VITE_BRAND_MODE=$($env:VITE_BRAND_MODE)"

npx.cmd tauri dev
exit $LASTEXITCODE
