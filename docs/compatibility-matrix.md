# Real Hardware Validation Matrix

Last updated: 2026-06-27
Phase: Pre-Release Candidate Sweep and GitHub Release Preparation

Release target: 0.1.0-pre

## Status Legend

- `validated`: tested on real hardware in this phase
- `partial`: tested but one or more channels are degraded/limited
- `pending`: target platform not yet run in this phase
- `blocked`: test could not be completed because of environment/tooling constraints

## Desktop Configurations

| Configuration | CPU temp | CPU usage | GPU temp | GPU usage | VRAM | RAM | Network | Storage | Tray lifecycle | OSD | Startup/minimize | Installer/uninstaller | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Intel + NVIDIA | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Not yet validated in this phase. |
| AMD + NVIDIA | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Not yet validated in this phase. |
| AMD + AMD | partial | validated | partial | partial | validated (fixed) | validated | validated | validated | not yet tested | not yet tested | not yet tested | not yet tested | Ryzen 7 9800X3D + Radeon RX 9070 XT desktop. Provider-level evidence only in this pass (direct backend probe, not full app UI); tray/OSD/startup/installer passes still pending. See findings below. |
| Intel + Intel Arc | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | IGCL path remains staged; WMI/perf fallback expected. |

## Laptop Configurations

| Configuration | CPU temp | CPU usage | GPU temp | GPU usage | VRAM | RAM | Network | Storage | Tray lifecycle | OSD | Startup/minimize | Installer/uninstaller | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dell Latitude business laptop (Latitude 5330) | partial | validated | partial | validated | validated | validated | validated | validated | validated | partial | validated | validated | CPU package temp classified as `missing_or_invalid_wmi_class`; warning throttle verified at ~60s cadence. |
| HP OMEN | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Planned next priority target in this phase. |
| HP Victus | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Planned next priority target in this phase. |
| Hybrid GPU laptops | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Validate muxless fallback and provider handoff. |
| Intel iGPU-only systems | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Validate WMI/perf-only GPU path and clear degraded messaging. |
| AMD iGPU systems | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Validate ADL availability and fallback semantics. |

## Provider Validation

| Provider | Availability | Accuracy confidence | Fallback handling | Degraded messaging | Evidence |
|---|---|---|---|---|---|
| WMI | validated | medium | validated | validated | Dell run shows explicit HRESULT-classified failures and namespace inventory. |
| NVML | pending | pending | pending | pending | Requires NVIDIA target hardware in this phase. |
| AMD ADL | validated (fails) | n/a | validated (falls back to WMI) | validated | `AmdAdlContext::init()` returns `None` on a Radeon RX 9070 XT (RDNA4) — see Known Issues below. |
| Intel IGCL groundwork | partial | low | validated | validated | Staged state surfaced explicitly; fallback path documented in diagnostics/support snapshot. |
| sysinfo | validated | medium | validated | validated | CPU usage, RAM, network, storage active in current test host. |
| Windows perf counters | partial | medium | validated | validated | GPU engine counter probe now reports explicit availability state. |

## Dell Latitude Findings (Current)

- Package temperature is not exposed through the current user-mode paths on Latitude 5330.
- Discovery classification: `missing_or_invalid_wmi_class`.
- ACPI path: `0x8004100C` classified as unsupported firmware/provider path.
- Dell DCIM thermal classes: `0x80041010` invalid-class classification from available namespace.
- Warning cadence hardening: repeated CPU-temp warnings now emit once per minute unless signature changes.

## AMD Desktop Findings (Radeon RX 9070 XT, current)

Captured 2026-06-27 via a direct backend provider probe (`cargo test ... -- --ignored --nocapture` against `hardware.rs`/`wmi_provider.rs`/`amd_provider.rs`/`sidecar_provider.rs`/`rgb_provider.rs`), not the full app UI — the Tauri dev binary requires UAC elevation that could not be completed interactively in this session. A full UI/tray/OSD/installer pass is still pending on this machine.

- sysinfo: CPU usage, clock (4700 MHz boost on Ryzen 7 9800X3D), RAM, network adapter, and storage drive count all reported correctly.
- WMI CPU package temperature: `None`. No ACPI thermal zone exposes package temp on this AMD desktop, the same limitation already recorded for the Dell Latitude business laptop.
- WMI GPU usage: reported `0.0` while idle. Inconclusive from this pass alone — needs a re-check under GPU load to confirm whether the perf-counter path actually tracks AMD discrete usage or is structurally broken for this GPU.
- **AMD ADL2 (Overdrive5) does not initialize at all on this GPU.** `AmdAdlContext::init()` returns `None` because no adapter responds to the legacy `ADL2_Overdrive5_Temperature_Get` call used to pick the active adapter (`src-tauri/src/amd_provider.rs`). Overdrive5 is a legacy API; modern RDNA3/RDNA4 cards are expected to need Overdrive6/Overdrive8/ADLX instead. Net effect: AMD discrete GPU temperature, usage, clocks, fan RPM, and power draw on this class of card currently fall back to the (weaker) WMI path instead of ADL, unlike the NVML path which is unaffected. **This is a real functional gap, not just missing validation** — tracked as a Now-priority backlog item in `docs/radium-improvement-audit.md`.
- **Fixed in this pass:** `Win32_VideoController.AdapterRAM` reported VRAM as `4.00 GB` for a 16 GB card (classic 32-bit `AdapterRAM` wraparound, already flagged as a known limitation in code comments but not previously fixed). `wmi_provider.rs` now reads `HardwareInformation.qwMemorySize` from the display adapter's registry class key (matched by `DriverDesc`) and prefers it when present; confirmed corrected to `15.92 GB` on this hardware.
- GPU/CPU/motherboard/BIOS identity strings (`AMD Radeon RX 9070 XT`, `AMD Ryzen 7 9800X3D 8-Core Processor`, `ASUSTeK COMPUTER INC. PRIME B650EM-A WIFI`) all resolved correctly via WMI.
- Sensor sidecar (LibreHardwareMonitor/PawnIO): loads and reports its library version, but returns no CPU package temperature sensor on this host — explicit `no_matching_sensors` state, not a fabricated reading. PawnIO driver is not installed in this dev environment.
- OpenRGB discovery: correctly reports `unavailable` with no error noise — OpenRGB is not installed/running on this machine.

## Known Telemetry Limitations

- Package CPU temperature may be unavailable on some business laptops *and* AMD desktops without OEM/driver-backed channels (confirmed on both the Dell Latitude 5330 and a Ryzen 7 9800X3D desktop).
- AMD ADL2/Overdrive5 fails to initialize on at least one current-generation RDNA4 desktop GPU (Radeon RX 9070 XT); AMD discrete GPU users on similar hardware get WMI-only telemetry quality, not ADL quality, until the provider is migrated to a newer ADL/ADLX API tier.
- Intel Arc native telemetry remains staged in this build; fallback paths are active and explicitly marked.
- Storage temperatures remain limited where SMART/driver-backed channels are not available.

## Unsupported Scenarios (Current Build)

- Unsafe kernel-level telemetry writes or firmware overclock/undervolt controls.
- Any silent destructive cleanup paths without explicit call-site opt-in.
- Automatic cloud upload of diagnostics.

## Validation Commands Run In This Phase

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed (includes `npm run build` as `beforeBuildCommand`).
- Installer output confirmed at `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`.
- 2026-06-27 AMD desktop pass: `cargo check`, `cargo test --lib` (11/11), and a temporary `--ignored` probe test against `hardware.rs`/`wmi_provider.rs`/`amd_provider.rs`/`sidecar_provider.rs`/`rgb_provider.rs` all ran on the Ryzen 7 9800X3D + Radeon RX 9070 XT host. The full Tauri dev binary itself was not launched — it requires UAC elevation that could not be completed interactively in this session (`npm run tauri dev` fails with Windows error 740 without it).

## Lifecycle and Installer Smoke Notes

- Tray registration verified from launch log entries under `%ProgramData%\Radium PCs Companion\logs`.
- Background launch and process checks are task-shell quoting sensitive in this workspace; validation was recorded from successful build output and runtime logs.
- Uninstall flow remains pending manual machine pass in this phase.

## Pre-Release Readiness Summary

- Build and packaging pipeline: ready.
- Telemetry transparency and degraded-state messaging: ready.
- Full external hardware matrix: pending additional tester machines.
- Interactive installer/uninstaller walkthrough: partially complete (artifact and registration validated; full uninstall UX pass pending dedicated manual run).
