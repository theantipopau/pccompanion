$ErrorActionPreference = "Stop"

$exe = "F:/radiumpcs/src-tauri/target/release/radium_pcs_companion.exe"
if (-not (Test-Path $exe)) {
  Write-Output "RELEASE_EXE_MISSING"
  exit 1
}

for ($i = 1; $i -le 3; $i++) {
  Get-Process radium_pcs_companion -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Process -FilePath $exe -ArgumentList "--background" -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 3

  $running = (Get-Process radium_pcs_companion -ErrorAction SilentlyContinue | Measure-Object).Count
  Write-Output ("CYCLE_{0}_RUNNING={1}" -f $i, $running)

  Get-Process radium_pcs_companion -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1

  $afterExit = (Get-Process radium_pcs_companion -ErrorAction SilentlyContinue | Measure-Object).Count
  Write-Output ("CYCLE_{0}_AFTER_EXIT={1}" -f $i, $afterExit)
}

$launchRoot = "C:/ProgramData/Radium PCs Companion/logs"
if (Test-Path $launchRoot) {
  $latest = Get-ChildItem $launchRoot -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latest) {
    Write-Output ("LATEST_LAUNCH_LOG={0}" -f $latest.FullName)
    Get-Content $latest.FullName -Tail 20
  }
}

$runtimeLog = "C:/Users/Charlotte Hurley/AppData/Local/com.radiumpcs.companion/logs/Radium PCs Companion.log"
if (Test-Path $runtimeLog) {
  Write-Output ("RUNTIME_LOG={0}" -f $runtimeLog)
  Get-Content $runtimeLog -Tail 20
}
