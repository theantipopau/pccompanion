# Third-Party Sensor Provider Binaries

This directory holds reviewed redistribution artifacts required for release packaging.

For the Radium low-level sensor sidecar prototype, place reviewed redistribution artifacts here before building the installer:

```text
vendor/
  LibreHardwareMonitor/
    LibreHardwareMonitorLib.dll
  PawnIO/
    PawnIO_setup.exe
    <any additional official signed PawnIO driver/runtime files>
```

`scripts/build-sensor-sidecar.ps1` copies these files into `src-tauri/binaries/` beside the hidden sidecar before Tauri packages the NSIS installer.

If `PawnIO_setup.exe` is present, the NSIS post-install hook runs it silently with:

```text
PawnIO_setup.exe -install -silent
```

The build script fails if `PawnIO_setup.exe` is missing or its Authenticode signature is invalid. Do not add unreviewed driver binaries to the repo. Verify source, license, signature, and Defender/EDR behavior on disposable test systems first.
