# Radium Sensor Provider Plan

## Goal

Radium PCs Companion should not require LibreHardwareMonitor, OpenHardwareMonitor, HWiNFO, Ryzen Master, or another resident monitor to show CPU package temperatures on customer systems.

## Why WMI Is Not Enough

Windows WMI and sysinfo reliably expose CPU identity, load, clock, memory, storage, and many GPU counters, but they do not reliably expose AMD Ryzen package temperature on desktop boards. On the Ryzen 5 5500 + ASUS PRIME X370-PRO test build, the app correctly detects CPU/GPU/mainboard identity and NVIDIA NVML telemetry, but CPU package temperature is not published through:

- `ROOT\WMI\MSAcpi_ThermalZoneTemperature`
- `Win32_PerfFormattedData_Counters_ThermalZoneInformation`
- sysinfo component temperatures
- Libre/Open Hardware Monitor WMI bridge namespaces

This is expected for many desktop boards without a low-level hardware access provider.

## How Monitor Tools Read It

LibreHardwareMonitor reads Ryzen package temperatures through AMD Zen SMN/MSR access. That path depends on a low-level provider such as PawnIO to perform privileged hardware reads, then decodes the raw AMD temperature registers into sensors such as `Core (Tctl/Tdie)` and CCD temperatures.

For Radium Companion, the equivalent product path is a bundled, headless sensor provider, not a dependency on another GUI tool.

## Current Repo Implementation

The repo now includes a staged headless provider path:

- `tools/radium-sensor-sidecar/` builds `radium-sensor-sidecar-x86_64-pc-windows-msvc.dll`.
- The sidecar runs hidden and emits one JSON object to stdout.
- It dynamically loads `LibreHardwareMonitorLib.dll` from its own folder if the DLL is bundled.
- The installer bundles a private .NET 8 runtime under `src-tauri/binaries/dotnet-runtime/`, so target systems do not need a separate .NET install for the sidecar.
- It enables CPU, motherboard, controller, and storage sensors, then searches for AMD/CPU package labels such as `Tctl`, `Tdie`, `Tctl/Tdie`, `Package`, `CCD`, and `Core`.
- `src-tauri/src/sidecar_provider.rs` probes the sidecar from the Rust monitoring loop.
- The normal hardware cache uses sidecar CPU temperature/fan/storage readings when they are available.
- Diagnostics exposes a `Radium Sensor Sidecar` provider with staged/live/error state.

Without a working PawnIO driver/provider path, the sidecar deliberately reports `no_matching_sensors` and the UI continues to show CPU package temperature as unavailable.

## Bundle Layout

Reviewed redistribution artifacts go here before building the installer:

```text
vendor/
  LibreHardwareMonitor/
    LibreHardwareMonitorLib.dll
  PawnIO/
    PawnIO_setup.exe
    <any additional official signed PawnIO driver/runtime files>
```

`npm run build:sensor-sidecar` publishes the sidecar, verifies the reviewed `PawnIO_setup.exe` Authenticode signature, and copies the vendor artifacts into:

```text
src-tauri/binaries/
src-tauri/binaries/dotnet-runtime/
```

`npm run build:exe` now runs the sidecar build step before `tauri build`, so the NSIS installer can include the hidden sidecar files.

The NSIS installer hook in `src-tauri/windows/hooks.nsh` installs the bundled driver support after the Radium files are laid down:

- The Radium installer is per-machine so the driver setup runs from an elevated installer context.
- Post-install runs `PawnIO_setup.exe /S` from `$INSTDIR\binaries\PawnIO_setup.exe`, with a legacy `$INSTDIR\resources\binaries\PawnIO_setup.exe` fallback.
- The installer log records the PawnIO setup exit code and `sc.exe query PawnIO` result for support diagnostics.
- Release builds fail before packaging if `vendor\PawnIO\PawnIO_setup.exe` is missing or unsigned, so customer installers are not produced without PawnIO staging.
- Uninstall does not currently remove PawnIO because other hardware tools may also depend on the same driver.

## Implementation Shape

1. Prototype through the headless sidecar plus reviewed PawnIO/LHM binaries.
2. Require explicit install/elevation for any kernel driver/provider.
3. Verify third-party signatures and redistribution terms before customer distribution.
4. Gate all write/control paths separately from read-only telemetry.
5. Start with AMD Zen package temperature:
   - detect AMD family/model
   - read the Zen thermal SMN register
   - decode Tctl/Tdie with model-specific offsets
   - return source/provenance in diagnostics
6. Consider replacing the third-party provider with a minimal Radium-signed provider once validation proves the sensor set.
7. Expand after validation:
   - SuperIO fan RPM/read-only channels
   - NVMe SMART temperature and health
   - motherboard-specific sensor maps

## UX Requirement

Until the provider is installed and live, the app must not infer or fabricate CPU, DIMM, PSU, or ambient temperatures. UI should show measured values only and explain the provider requirement clearly.
