# Radium PCs Companion

Premium Windows companion utility for Radium PCs systems.

Built with Tauri v2, React 19, TypeScript, and a Rust hardware backend.

## Current Status

| Area | Status |
|---|---|
| Live hardware monitoring | Live |
| Tray icon + tray menu | Live |
| Minimize to tray / start hidden | Live |
| Telemetry diagnostics page | Live |
| Sensor discovery report export | Live |
| Dell laptop CPU package temp (user-mode only) | Limited |
| Optional embedded driver/provider path | Planned (staged) |

## Key Features

- Live CPU, GPU, RAM, storage, and network telemetry.
- Native tray integration with live metric icon rendering.
- Telemetry diagnostics with provider provenance and confidence states.
- Sensor discovery report listing source attempts, accepted values, and rejected values.
- Safety-gated cleanup tools and performance profile controls.

## Dell CPU Temperature Limitation

Some Dell laptops do not expose a reliable CPU package temperature through user-mode WMI or standard sysinfo component paths.

Current behavior:
- The app probes ACPI thermal zones, perf thermal classes, sysinfo component labels, and Dell namespace hints.
- If package temperature is unavailable, the UI now shows an explicit driver-required/degraded state instead of a silent blank/zero interpretation.
- Diagnostics export includes the full sensor discovery report for support analysis.

What this means:
- CPU usage and other telemetry can still be live.
- CPU package temperature may remain unavailable until a model-safe OEM/driver-assisted provider is enabled.

## Telemetry Sources

| Metric | Source |
|---|---|
| CPU usage / clock | sysinfo |
| CPU temperature | WMI ACPI + perf thermal classes + sysinfo component fallback |
| GPU telemetry (temp/usage/clocks/VRAM/fan/power) | NVML (NVIDIA), ADL2 (AMD), WMI fallback |
| RAM usage | sysinfo |
| Storage usage | sysinfo |
| Network throughput | sysinfo |

## Sensor Discovery Report

The telemetry diagnostics snapshot now includes:
- Machine vendor/model/family detection.
- Dell profile detection.
- Per-source thermal probe attempts.
- Raw values, converted values, accepted/rejected status, and rejection reasons.
- Dell WMI class hints where discoverable.
- Recommended next action when package temperature is unavailable.

Diagnostics export bundles this report under ProgramData diagnostics output.

## Tray and Close Behavior

- The X button follows the Settings toggle:
  - Enabled: close request hides to tray.
  - Disabled: close request exits the app.
- Tray Exit performs full app exit.
- Settings sync the close-to-tray policy to the native runtime.

## Quick Start

```powershell
npm install
npm run check:desktop
npm run desktop
```

## Build

```powershell
npm run build
npm run build:exe
```

Output:
- Development binary: src-tauri/target/debug/
- Release binary: src-tauri/target/release/
- NSIS installer: src-tauri/target/release/bundle/nsis/

## Safety Model

- Local-first operation.
- No automatic cloud upload.
- Browser mode uses mock data only.
- Mutating operations are native-only and safety-gated.

## Embedded Provider Roadmap (Staged)

Based on LibreHardwareMonitor architecture patterns, deeper package thermals may require:
- Ring0/MSR reads for CPU package sensors.
- Embedded Controller (EC) access on specific laptop models.
- Super I/O access on desktop boards.

Current policy:
- No unsafe or unsigned driver is bundled yet.
- Driver-backed provider remains optional and staged.
- Standalone packaging remains the baseline requirement.

## Scripts

| Script | Purpose |
|---|---|
| npm run dev | Browser preview (mock only) |
| npm run desktop | Tauri desktop app |
| npm run build | Frontend production build |
| npm run build:exe | Full Tauri build + NSIS |
| npm run package:portable | Portable package script |
| npm run check:desktop | Environment prerequisite check |
