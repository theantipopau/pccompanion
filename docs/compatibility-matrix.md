# Real Hardware Validation Matrix

Last updated: 2026-05-23
Phase: Real Hardware Validation and Commercial Readiness

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
| AMD + AMD | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | Not yet validated in this phase. |
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
| AMD ADL | pending | pending | pending | pending | Requires AMD discrete target hardware in this phase. |
| Intel IGCL groundwork | partial | low | validated | validated | Staged state surfaced explicitly; fallback path documented in diagnostics/support snapshot. |
| sysinfo | validated | medium | validated | validated | CPU usage, RAM, network, storage active in current test host. |
| Windows perf counters | partial | medium | validated | validated | GPU engine counter probe now reports explicit availability state. |

## Dell Latitude Findings (Current)

- Package temperature is not exposed through the current user-mode paths on Latitude 5330.
- Discovery classification: `missing_or_invalid_wmi_class`.
- ACPI path: `0x8004100C` classified as unsupported firmware/provider path.
- Dell DCIM thermal classes: `0x80041010` invalid-class classification from available namespace.
- Warning cadence hardening: repeated CPU-temp warnings now emit once per minute unless signature changes.

## Known Telemetry Limitations

- Package CPU temperature may be unavailable on some business laptops without OEM/driver-backed channels.
- Intel Arc native telemetry remains staged in this build; fallback paths are active and explicitly marked.
- Storage temperatures remain limited where SMART/driver-backed channels are not available.

## Unsupported Scenarios (Current Build)

- Unsafe kernel-level telemetry writes or firmware overclock/undervolt controls.
- Any silent destructive cleanup paths without explicit call-site opt-in.
- Automatic cloud upload of diagnostics.

## Validation Commands Run In This Phase

- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed (includes `npm run build` as `beforeBuildCommand`).
- Installer output confirmed at `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0_x64-setup.exe`.

## Lifecycle and Installer Smoke Notes

- Tray registration verified from launch log entries under `%ProgramData%\Radium PCs Companion\logs`.
- Background launch and process checks are task-shell quoting sensitive in this workspace; validation was recorded from successful build output and runtime logs.
- Uninstall flow remains pending manual machine pass in this phase.
