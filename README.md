# Radium PCs Companion

<p align="center">
  <img src="images/radiumcompanion-marketing.png" alt="Radium PCs Companion marketing banner" width="960" />
</p>

<p align="center">
  <strong>Premium Windows telemetry, diagnostics, and maintenance companion for Radium PCs systems.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> |
  <a href="#what-it-does">What It Does</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#safety-model">Safety Model</a> |
  <a href="#installer-and-distribution">Installer</a>
</p>

<p align="center">
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-f97316?style=for-the-badge" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-38bdf8?style=for-the-badge" />
  <img alt="Rust backend" src="https://img.shields.io/badge/Rust-native_backend-a855f7?style=for-the-badge" />
  <img alt="Windows pre-release" src="https://img.shields.io/badge/Windows-0.1.0--pre-22c55e?style=for-the-badge" />
</p>

Radium PCs Companion is a desktop-native Windows utility for monitoring, support, and safe maintenance workflows. It combines a premium React interface with a Rust/Tauri backend, vendor telemetry providers, tray controls, diagnostics export, and a bundled low-level sensor sidecar path for hardware that needs deeper package-temperature access.

The product goal is simple: give Radium PCs customers and technicians a polished, local-first control surface that explains what the machine is doing, what telemetry is trusted, and which actions are safe to perform.

## Current Release

| Item | Status |
|---|---|
| Version | `0.1.0-pre` |
| Channel | Controlled public pre-release |
| Platform | Windows 10/11, x64 |
| Shell | Tauri v2 desktop app |
| Frontend | React 19 + TypeScript |
| Backend | Rust command layer + Windows APIs |
| Installer | NSIS, per-machine |
| Primary artifact | `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe` |

Useful project documents:

| Document | Purpose |
|---|---|
| [Current state](docs/current-state.md) | Short release handoff and operational baseline |
| [Next stages](docs/next-stages.md) | Feature rollout plan and staged implementation notes |
| [Sensor provider plan](docs/radium-sensor-provider.md) | PawnIO, LibreHardwareMonitor, and sidecar strategy |
| [Compatibility matrix](docs/compatibility-matrix.md) | Hardware validation tracking |
| [Telemetry engine](docs/telemetry-engine.md) | Provider model and diagnostics detail |

## What It Does

| Experience | Details |
|---|---|
| Live dashboard | CPU, GPU, RAM, network, storage, provider state, system identity, and support readiness. |
| Thermal view | Premium case visualisation with component overlays, vendor branding, airflow cues, and truthful unavailable states. |
| Telemetry diagnostics | Provider orchestration, sensor provenance, namespace inventory, capability coverage, and support export. |
| System Passport | Machine identity, motherboard, BIOS, GPU, storage, RAM, and support-focused metadata. |
| Tray control | Live tray metric icon, tooltip, OSD toggle, quick RAM clean, performance/quiet modes, diagnostics export, and exit. |
| Maintenance tools | Bloatware review, registry checks, startup manager, storage cleaner, memory cleaner, and staged utilities. |
| Performance profiles | Quiet, Balanced, Creator, and Gaming flows with planned-change preview and safety-gated native writes. |
| Benchmark capture | Live sensor trust, benchmark result cards, and latest-vs-previous comparison deltas. |

## Product Principles

| Principle | How the app applies it |
|---|---|
| Local first | Telemetry and maintenance actions run locally. No automatic cloud upload. |
| Truthful telemetry | Missing sensors are shown as degraded or driver-required, never fabricated as zero. |
| Support ready | Diagnostics explain provider state, confidence, fallback paths, and exported evidence. |
| Safe by default | Write paths are gated, reversible where possible, and blocked when model safety is unknown. |
| Premium but dense | The UI is polished, compact, and built for repeated technical use rather than marketing pages. |

## Visual System

The interface uses a dark industrial Radium visual language with orange accents, hardware-aware vendor identity, compact cards, and high information density.

<p align="center">
  <img src="images/thermal-chamber-premium.png" alt="Premium thermal chamber visual asset" width="760" />
</p>

Current visual assets include:

| Asset family | Files |
|---|---|
| Radium brand | `radiumlogo.png`, `radiumheader-new.png`, `radiumcompanion-header.png`, `radiumcompanion-marketing.png` |
| GPU vendors | `nvidia.png`, `amd.png`, `radeon.png`, `intel.png`, `intelarc.png` |
| Motherboard vendors | `asus.png`, `asrock.png`, `msi.png` |
| Thermal presentation | `thermal-chamber-premium.png` |

## Architecture

```text
React UI
  -> typed service layer
  -> Tauri invoke bridge
  -> Rust command handlers
  -> provider orchestration
  -> Windows APIs / vendor SDKs / sidecar probes
```

| Layer | Responsibility |
|---|---|
| React + TypeScript | Shell, pages, charts, settings, diagnostics, OSD, and premium UI composition. |
| Tauri v2 | Desktop windowing, tray integration, IPC, packaging, and Windows app lifecycle. |
| Rust backend | Hardware sampling, diagnostics snapshots, maintenance commands, startup/tray actions, and safety gates. |
| Vendor providers | NVIDIA NVML, AMD ADL2 scaffold, Intel IGCL scaffold, WMI/sysinfo fallback. |
| Sensor sidecar | Headless .NET/LibreHardwareMonitor path for CPU package sensors via bundled PawnIO support. |
| NSIS installer | Per-machine install, resource staging, PawnIO silent install hook, and app packaging. |

## Telemetry Providers

| Channel | Primary source | Fallback / status |
|---|---|---|
| CPU usage and clock | `sysinfo` | Live on validated hosts |
| CPU package temperature | Radium sidecar + LibreHardwareMonitor + PawnIO | WMI ACPI/perf/sysinfo fallback, driver-required when unavailable |
| GPU telemetry | NVIDIA NVML | AMD ADL2 staged, Intel IGCL staged, WMI fallback |
| GPU driver version | NVML `nvmlSystemGetDriverVersion` | WMI driver string fallback |
| GPU update check | NVIDIA GeForce driver API | Degrades quietly when offline or unsupported |
| RAM usage | `sysinfo` | Live |
| Storage usage | `sysinfo` | SMART depth staged |
| Network throughput | `sysinfo` adapter delta | Live |

## Sensor Sidecar And PawnIO

The low-level sensor path is staged as a bundled sidecar:

```text
Radium app
  -> radium-sensor-sidecar-x86_64-pc-windows-msvc.dll
  -> private .NET runtime
  -> LibreHardwareMonitorLib
  -> PawnIO driver support
  -> AMD Zen Tctl/Tdie / package sensor rows where exposed
```

Important current behaviour:

- The NSIS post-install hook runs `PawnIO_setup.exe -install -silent`.
- Runtime sidecar discovery checks `$INSTDIR\binaries`, matching Tauri/NSIS resource staging.
- Diagnostics clearly distinguish `sidecar_not_found`, `no_matching_sensors`, `partial_no_cpu_temp`, and `live`.
- CPU package temperature is only accepted when a real hardware monitor row matches policy.

## Diagnostics And Support

Telemetry Diagnostics is designed for support handoff, not just developer debugging.

It captures:

- active provider and fallback counts,
- sensor provenance and confidence,
- capability registry state,
- WMI namespace availability,
- thermal class inventory,
- GPU adapter inventory,
- GPU engine counter probe state,
- sidecar lifecycle status,
- support readiness notes,
- exportable diagnostics bundle.

Known degraded states are intentionally explicit. For example, systems that do not expose package temperature through user-mode WMI show a driver-required classification instead of a blank or misleading value.

## Safety Model

| Area | Policy |
|---|---|
| Telemetry reads | Allowed when local, low-risk, and provider-backed. |
| Cleanup actions | User initiated, scoped, and presented with visible result state. |
| Performance profiles | Preview first, then apply only supported reversible OS-level changes. |
| Fan/EC/firmware writes | Blocked until model-specific safety validation exists. |
| Driver/provider path | Bundled only from reviewed signed artifacts; release build fails if required PawnIO staging is missing or unsigned. |
| Browser preview | Mock data only. Native actions require Tauri desktop mode. |
| Cloud/network | No automatic telemetry upload. External checks degrade quietly when unavailable. |

Security hardening already in place:

- strict Tauri CSP,
- external URL validation tests,
- hidden subprocess creation for Windows utility flows,
- native/browser split so desktop errors are not silently replaced by mock data,
- startup/tray lifecycle state controlled through explicit settings,
- error boundaries around provider startup and shell rendering.

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

Build output:

| Output | Path |
|---|---|
| Frontend bundle | `dist/` |
| Release executable | `src-tauri/target/release/radium_pcs_companion.exe` |
| NSIS installer | `src-tauri/target/release/bundle/nsis/` |

## Installer And Distribution

Primary artifact:

```text
src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe
```

Installer notes:

- NSIS install mode is `perMachine`.
- Bundled resources are staged under the installed `binaries` directory.
- PawnIO is installed silently with `-install -silent`.
- Startup registration uses a current-user Run entry and is reversible from Settings.

Recommended tester flow:

1. Quit any existing tray instance.
2. Install from the NSIS package.
3. Launch Companion and verify tray registration.
4. Open Telemetry Diagnostics and verify provider/degraded-state readability.
5. Export diagnostics and attach the report to issues.
6. Uninstall and verify app removal plus startup entry cleanup.

## Validation Snapshot

Latest local validation in this workspace:

| Check | Result |
|---|---|
| `npm.cmd run build` | Passed |
| `cargo check --manifest-path src-tauri\Cargo.toml` | Passed |
| `cargo test --manifest-path src-tauri\Cargo.toml --lib external_url_validator` | Passed |
| `git diff --check` | Passed |
| `npm.cmd run build:exe` | Passed |

Note: in the sandboxed environment, NuGet access may be blocked while publishing the sensor sidecar. The build script falls back to the existing staged Release sidecar output and still produces the final NSIS installer.

## Hardware Validation

Tracked in [docs/compatibility-matrix.md](docs/compatibility-matrix.md).

Validated during the current phase:

| Host | Result |
|---|---|
| Dell Latitude 5330 | CPU/RAM/network/storage live, Dell CPU package temperature classified as driver-level telemetry required, diagnostics export validated. |
| AMD Ryzen 5 5500 + NVIDIA GTX 1660 SUPER | NVML GPU telemetry live; CPU package temperature depends on sidecar/PawnIO sensor row exposure. |

Pending broader matrix:

- Intel + NVIDIA desktop,
- AMD + NVIDIA desktop,
- AMD + AMD desktop,
- Intel + Intel Arc,
- HP OMEN,
- HP Victus,
- hybrid GPU laptops,
- Intel iGPU-only systems,
- AMD iGPU systems.

## Current Known Limitations

- Some enterprise laptop BIOS profiles do not expose CPU package temperature through user-mode telemetry.
- Intel Arc native telemetry remains staged; fallback channels are surfaced clearly.
- SMART temperature, wear, and TBW channels need deeper per-device `DeviceIoControl` work.
- Fan telemetry writes and EC control remain blocked until model-safe adapters are validated.
- Some installer/uninstaller checks still require interactive validation on tester machines due UAC and Windows shell behaviour.

## Troubleshooting

No telemetry on startup:

- Open Telemetry Diagnostics.
- Check provider state, degraded reasons, and sidecar lifecycle.
- Confirm vendor GPU/chipset drivers are installed.
- Export the diagnostics bundle for support.

CPU temperature unavailable:

- Check whether Diagnostics says `sidecar_not_found`, `no_matching_sensors`, `partial_no_cpu_temp`, or `live`.
- Confirm PawnIO appears in Installed Apps after installation.
- Verify the installed app contains `binaries\radium-sensor-sidecar-x86_64-pc-windows-msvc.dll`.
- If no CPU sensor row is exposed, continue using CPU load and other live channels while the provider policy is tuned for that hardware.

Tray or startup behaviour mismatch:

- Confirm close/minimise/startup toggles in Settings.
- Use the tray menu to restart the monitoring engine.
- Fully exit the tray app before installing a new build.

## Roadmap

Near-term focus:

| Stage | Direction |
|---|---|
| Utilities foundation | Clearer live/staged/planned grouping and safer maintenance copy. |
| Performance profiles | First-class profile workflow with preview/apply confidence. |
| Update surfacing | Quiet version and update indicators in Settings/sidebar. |
| Game mode mappings | Manual app-to-profile mapping before automatic detection. |
| Sensor validation | Improve sidecar diagnostics and hardware matrix coverage. |
| RGB/vendor extras | Keep staged until vendor SDK safety boundaries are clear. |

See [docs/next-stages.md](docs/next-stages.md) for the working implementation plan.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Browser preview with mock data |
| `npm run desktop` | Tauri desktop app |
| `npm run build` | Frontend production build |
| `npm run build:exe` | Full Tauri build and NSIS installer |
| `npm run package:portable` | Portable package script |
| `npm run check:desktop` | Environment prerequisite check |

## Repository Shape

```text
src/                    React UI, pages, components, contexts, services
src-tauri/              Tauri app, Rust backend, packaging, NSIS hooks
tools/radium-sensor-sidecar/
                        Headless .NET sensor sidecar
vendor/                 Reviewed third-party runtime/driver artifacts
images/                 Brand, OEM, and visual presentation assets
docs/                   Architecture, telemetry, roadmap, validation notes
scripts/                Build, audit, and packaging helpers
```
