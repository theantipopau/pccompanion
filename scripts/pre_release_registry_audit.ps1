$ErrorActionPreference = "Stop"

$paths = @(
  "HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*",
  "HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall/*"
)

foreach ($path in $paths) {
  Get-ItemProperty $path -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*Radium PCs Companion*" } |
    Select-Object PSPath, DisplayName, DisplayVersion, Publisher, UninstallString, InstallLocation |
    Format-Table -AutoSize
}

Get-ItemProperty "HKCU:/Software/Microsoft/Windows/CurrentVersion/Run" -ErrorAction SilentlyContinue |
  Select-Object "Radium PCs Companion" |
  Format-Table -AutoSize
