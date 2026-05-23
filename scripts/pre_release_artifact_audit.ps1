$ErrorActionPreference = "Stop"

$exe = "F:/radiumpcs/src-tauri/target/release/radium_pcs_companion.exe"
$setup = "F:/radiumpcs/src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe"

Get-Item $exe, $setup |
  Select-Object FullName, Length, LastWriteTime |
  Format-Table -AutoSize

(Get-Item $setup).VersionInfo |
  Select-Object FileVersion, ProductVersion, FileDescription, ProductName |
  Format-Table -AutoSize
