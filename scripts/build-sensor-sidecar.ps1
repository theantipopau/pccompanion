param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$project = Join-Path $repoRoot "tools\radium-sensor-sidecar\RadiumSensorSidecar.csproj"
$assetsFile = Join-Path $repoRoot "tools\radium-sensor-sidecar\obj\project.assets.json"
$fallbackBuildDir = Join-Path $repoRoot "tools\radium-sensor-sidecar\bin\$Configuration\net8.0"
$publishDir = Join-Path $repoRoot "target\sensor-sidecar"
$tauriBinDir = Join-Path $repoRoot "src-tauri\binaries"
$sidecarName = "radium-sensor-sidecar-x86_64-pc-windows-msvc.dll"
$tauriSidecar = Join-Path $tauriBinDir $sidecarName
$runtimeTarget = Join-Path $tauriBinDir "dotnet-runtime"

if (Test-Path -LiteralPath $publishDir) {
  Remove-Item -LiteralPath $publishDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
New-Item -ItemType Directory -Force -Path $tauriBinDir | Out-Null
Get-ChildItem -LiteralPath $tauriBinDir -Filter "radium-sensor-sidecar*" -File -ErrorAction SilentlyContinue |
  Remove-Item -Force

$assetsText = Get-Content -LiteralPath $assetsFile -Raw -ErrorAction SilentlyContinue
$assetsValid = (Test-Path -LiteralPath $assetsFile) -and
  ($assetsText -match '"net8.0"') -and
  ($assetsText -match 'LibreHardwareMonitorLib')
$fallbackSidecar = Join-Path $fallbackBuildDir $sidecarName
if (!$assetsValid -and !(Test-Path -LiteralPath $fallbackSidecar)) {
  dotnet restore $project --ignore-failed-sources
  if ($LASTEXITCODE -ne 0) {
    throw "dotnet restore failed for sensor sidecar. Re-run with network access once so reference packs can be restored."
  }
  $assetsValid = $true
}

if ($assetsValid) {
  dotnet publish $project `
    -c $Configuration `
    --no-restore `
    --ignore-failed-sources `
    --self-contained false `
    -p:RestoreIgnoreFailedSources=true `
    -p:DebugType=None `
    -p:DebugSymbols=false `
    -o $publishDir
}

if (!$assetsValid -or $LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $fallbackSidecar) {
    Write-Warning "dotnet publish could not use restored package metadata; staging existing $Configuration sidecar build output."
    Copy-Item -Path (Join-Path $fallbackBuildDir "*") -Destination $publishDir -Recurse -Force
  } else {
    throw "dotnet publish failed for sensor sidecar."
  }
}

$publishedExe = Join-Path $publishDir $sidecarName
if (!(Test-Path -LiteralPath $publishedExe)) {
  throw "Expected sidecar assembly was not produced: $publishedExe"
}

Copy-Item -Path (Join-Path $publishDir "*") -Destination $tauriBinDir -Recurse -Force
Get-ChildItem -LiteralPath $tauriBinDir -Filter "radium-sensor-sidecar*.exe" -File -ErrorAction SilentlyContinue |
  Remove-Item -Force

$runtimeFolders = @("android*", "browser*", "linux*", "maccatalyst*", "osx*", "unix*")
foreach ($folder in $runtimeFolders) {
  Get-ChildItem -LiteralPath (Join-Path $tauriBinDir "runtimes") -Directory -Filter $folder -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
}

$publishedLhm = Join-Path $publishDir "runtimes\win-x64\lib\net8.0\LibreHardwareMonitorLib.dll"
if (Test-Path -LiteralPath $publishedLhm) {
  Copy-Item -LiteralPath $publishedLhm -Destination (Join-Path $tauriBinDir "LibreHardwareMonitorLib.dll") -Force
}

$dotnetRoot = Join-Path $env:ProgramFiles "dotnet"
if (Test-Path -LiteralPath $dotnetRoot) {
  $fxrRoot = Join-Path $dotnetRoot "host\fxr"
  $sharedRoot = Join-Path $dotnetRoot "shared\Microsoft.NETCore.App"
  $runtimeVersion = Get-ChildItem -LiteralPath $sharedRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "8.*" } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
  $fxrVersion = Get-ChildItem -LiteralPath $fxrRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "8.*" } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1

  if ($runtimeVersion -and $fxrVersion) {
    if (Test-Path -LiteralPath $runtimeTarget) {
      Remove-Item -LiteralPath $runtimeTarget -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $runtimeTarget | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeTarget "host\fxr") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeTarget "shared\Microsoft.NETCore.App") | Out-Null
    Copy-Item -LiteralPath (Join-Path $dotnetRoot "dotnet.exe") -Destination (Join-Path $runtimeTarget "dotnet.exe") -Force
    Copy-Item -LiteralPath $fxrVersion.FullName -Destination (Join-Path $runtimeTarget "host\fxr") -Recurse -Force
    Copy-Item -LiteralPath $runtimeVersion.FullName -Destination (Join-Path $runtimeTarget "shared\Microsoft.NETCore.App") -Recurse -Force
    foreach ($notice in @("LICENSE.txt", "ThirdPartyNotices.txt")) {
      $noticePath = Join-Path $dotnetRoot $notice
      if (Test-Path -LiteralPath $noticePath) {
        Copy-Item -LiteralPath $noticePath -Destination (Join-Path $runtimeTarget $notice) -Force
      }
    }
    Write-Host "Bundled private .NET runtime $($runtimeVersion.Name) for sensor sidecar."
  } else {
    Write-Warning "No local .NET 8 runtime found to bundle. Target machines will need .NET 8 installed."
  }
} else {
  Write-Warning "No local dotnet installation found. Target machines will need .NET 8 installed."
}

$lhmSource = Join-Path $repoRoot "vendor\LibreHardwareMonitor\LibreHardwareMonitorLib.dll"
$pawnioSource = Join-Path $repoRoot "vendor\PawnIO"
$pawnioSetup = Join-Path $pawnioSource "PawnIO_setup.exe"
if (Test-Path -LiteralPath $lhmSource) {
  Copy-Item -LiteralPath $lhmSource -Destination (Join-Path $tauriBinDir "LibreHardwareMonitorLib.dll") -Force
}
if (!(Test-Path -LiteralPath $pawnioSetup)) {
  throw "PawnIO_setup.exe is required at vendor\PawnIO\PawnIO_setup.exe so the NSIS installer can silently install the low-level sensor driver."
}

$pawnioSignature = Get-AuthenticodeSignature -LiteralPath $pawnioSetup
if ($pawnioSignature.Status -ne "Valid") {
  throw "PawnIO_setup.exe signature is not valid: $($pawnioSignature.StatusMessage)"
}

Copy-Item -Path (Join-Path $pawnioSource "*") -Destination $tauriBinDir -Recurse -Force

Write-Host "Sensor sidecar staged at $tauriSidecar"
