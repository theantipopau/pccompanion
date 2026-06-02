param(
  [string]$ExePath = "src-tauri/target/release/radium_pcs_companion.exe",
  [int]$Cycles = 3,
  [int]$StartupSeconds = 3,
  [int]$ShutdownTimeoutSeconds = 8
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ([System.IO.Path]::IsPathRooted($ExePath)) {
  $exe = $ExePath
} else {
  $exe = Join-Path $root $ExePath
}

if (-not (Test-Path $exe)) {
  Write-Output "RELEASE_EXE_MISSING"
  exit 1
}

function Stop-RadiumProcesses {
  $processes = @(Get-Process radium_pcs_companion -ErrorAction SilentlyContinue)
  if ($processes.Count -eq 0) {
    return 0
  }

  $processes | Stop-Process -Force -ErrorAction SilentlyContinue
  $deadline = (Get-Date).AddSeconds($ShutdownTimeoutSeconds)
  do {
    Start-Sleep -Milliseconds 250
    $remaining = @(Get-Process radium_pcs_companion -ErrorAction SilentlyContinue)
  } while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)

  return @(Get-Process radium_pcs_companion -ErrorAction SilentlyContinue).Count
}

for ($i = 1; $i -le $Cycles; $i++) {
  $preExisting = Stop-RadiumProcesses
  if ($preExisting -ne 0) {
    throw "CYCLE_${i}_PREEXISTING_PROCESS_STILL_RUNNING=$preExisting"
  }

  Start-Process -FilePath $exe -ArgumentList "--background" -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds $StartupSeconds

  $running = (Get-Process radium_pcs_companion -ErrorAction SilentlyContinue | Measure-Object).Count
  Write-Output ("CYCLE_{0}_RUNNING={1}" -f $i, $running)
  if ($running -lt 1) {
    throw "CYCLE_${i}_FAILED_TO_START"
  }

  $afterExit = Stop-RadiumProcesses
  Write-Output ("CYCLE_{0}_AFTER_EXIT={1}" -f $i, $afterExit)
  if ($afterExit -ne 0) {
    throw "CYCLE_${i}_PROCESS_STILL_RUNNING_AFTER_STOP=$afterExit"
  }
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
