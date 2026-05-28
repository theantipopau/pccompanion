param(
  [switch]$StrictBundle
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root
$workspaceRoot = (Get-Location).Path

$forbiddenPatterns = @(
  'Radium PCs Companion',
  'radiumpcs\.com\.au',
  '@radiumpcs\.com\.au'
)

$findings = New-Object System.Collections.Generic.List[string]

function Add-Finding {
  param(
    [string]$RelativePath,
    [int]$LineNumber,
    [string]$Pattern,
    [string]$Scope
  )
  $findings.Add(("{0}:{1}:{2}:{3}" -f $Scope, $RelativePath, $LineNumber, $Pattern))
}

function Get-RelativePath {
  param([string]$Path)
  $rootPrefix = $workspaceRoot.TrimEnd('\\') + '\\'
  if ($Path.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $Path.Substring($rootPrefix.Length).Replace('\\', '/')
  }
  return $Path.Replace('\\', '/')
}

# Source scan (white-label safety): block direct Radium customer strings outside brand profile.
$sourceFiles = Get-ChildItem -Path (Join-Path $root 'src') -Recurse -File -Include *.ts,*.tsx
foreach ($file in $sourceFiles) {
  $relative = Get-RelativePath -Path $file.FullName
  if ($file.FullName -match 'src\\lib\\branding\.ts$') {
    continue
  }

  foreach ($pattern in $forbiddenPatterns) {
    $matches = Select-String -Path $file.FullName -Pattern $pattern -CaseSensitive:$false
    foreach ($match in $matches) {
      Add-Finding -RelativePath $relative -LineNumber $match.LineNumber -Pattern $pattern -Scope 'SOURCE'
    }
  }
}

if ($StrictBundle) {
  # Bundle scan: expects a demo web bundle generated with VITE_BRAND_MODE=demo.
  $bundleFiles = Get-ChildItem -Path (Join-Path $root 'dist/assets') -File -Filter 'index-*.js' -ErrorAction SilentlyContinue
  if ($bundleFiles.Count -eq 0) {
    Write-Output 'BUNDLE_SCAN_SKIPPED=1 (no dist/assets/index-*.js found)'
  } else {
    foreach ($bundle in $bundleFiles) {
      $relative = Get-RelativePath -Path $bundle.FullName
      foreach ($pattern in $forbiddenPatterns) {
        $matches = Select-String -Path $bundle.FullName -Pattern $pattern -CaseSensitive:$false
        foreach ($match in $matches) {
          Add-Finding -RelativePath $relative -LineNumber $match.LineNumber -Pattern $pattern -Scope 'BUNDLE'
        }
      }
    }
  }
} else {
  Write-Output 'BUNDLE_SCAN_MODE=non-strict (source scan only)'
}

if ($findings.Count -gt 0) {
  Write-Output 'DEMO_BRAND_LEAK_CHECK_FAILED=1'
  foreach ($finding in $findings) {
    Write-Output ("LEAK={0}" -f $finding)
  }
  exit 1
}

Write-Output 'DEMO_BRAND_LEAK_CHECK_OK=1'
