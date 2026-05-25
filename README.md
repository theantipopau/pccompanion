# Radium PCs Companion

<p align="center">
  <img src="images/radiumcompanion-marketing.png" alt="Radium PCs Companion marketing banner" width="960" />
</p>

Premium Windows companion utility for Radium PCs systems.

Built with Tauri v2, React 19, TypeScript, and a Rust hardware backend.

Main project marketing image: `images/radiumcompanion-marketing.png`.

## Current Status

Short release handoff: [docs/current-state.md](docs/current-state.md)

Sensor provider plan: [docs/radium-sensor-provider.md](docs/radium-sensor-provider.md)

| Area | Status |
|---|---|
| Live hardware monitoring | Live |
| Tray icon + tray menu | Live |
| Minimize to tray / start hidden | Live |
| Telemetry diagnostics page | Live |
| Sensor discovery report export | Live |
| GPU / chipset driver version display | Live |
| GPU driver update check (NVIDIA) | Live |
| Dell laptop CPU package temp (user-mode only) | Limited |
| Optional embedded driver/provider path | Bundled sidecar + PawnIO installer hook |

## Pre-Release Candidate

Current release candidate target:

- Version: 0.1.0-pre
- Channel: controlled public pre-release
- Distribution: NSIS installer and release executable

This phase focuses on regression prevention, lifecycle correctness, installer quality, and support transparency.

## Utility Stability, Async Operations And Trusted Maintenance UX (Latest)

This pass focused on utility responsiveness and operational trust without changing telemetry architecture.

- Moved heavy utility commands to async blocking workers in Tauri command handlers to reduce UI stall risk.
- Added storage scan lifecycle commands with real progress/cancellation state:
  - start scan,
  - poll status,
  - cancel scan.
- Hardened storage scanning with bounded traversal and cancellation checks for large directory trees.
- Updated Storage Cleaner UI to show scan status, progress, step counts, and cancellation controls.
- Hardened Windows utility subprocess execution by enforcing hidden process creation (`CREATE_NO_WINDOW`) for PowerShell/schtasks/reg flows to reduce console flash behavior.

Validation after this pass:

- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build` passed.

## Real Hardware Validation Matrix

Compatibility tracking for this phase lives in:
- [docs/compatibility-matrix.md](docs/compatibility-matrix.md)

Current validated host in this phase:
- Dell Latitude 5330 (business laptop):
  - CPU package temperature: degraded/limited with explicit `missing_or_invalid_wmi_class` classification.
  - CPU usage, RAM, network, storage: validated live.
  - GPU fallback diagnostics: validated with explicit engine-counter availability state.
  - Warning spam hardening: validated (throttled to approximately once every 15 minutes when signature is unchanged).

Pending in this phase:
- Intel + NVIDIA desktop,
- AMD + NVIDIA desktop,
- AMD + AMD desktop,
- Intel + Intel Arc,
- HP OMEN,
- HP Victus,
- hybrid GPU laptops,
- Intel iGPU-only systems,
- AMD iGPU systems.

## Key Features

- Live CPU, GPU, RAM, storage, and network telemetry.
- Native tray integration with live metric icon rendering.
- Telemetry diagnostics with provider provenance and confidence states.
- Sensor discovery report listing source attempts, accepted values, and rejected values.
- Safety-gated cleanup tools and performance profile controls.
- Bundled hidden sensor sidecar for PawnIO/LibreHardwareMonitorLib CPU package temperature reads.
- Compact desktop-native shell tuned for 1366x768 up to ultrawide displays.
- Premium dark Radium visual language with restrained orange accents and high telemetry density.

## Dell CPU Temperature Limitation

Some Dell laptops do not expose a reliable CPU package temperature through user-mode WMI or standard sysinfo component paths.

Current behavior:
- The app probes ACPI thermal zones, perf thermal classes, sysinfo component labels, and Dell namespace hints.
- If package temperature is unavailable, the UI now shows an explicit issue classification plus a driver-required/degraded state instead of a silent blank/zero interpretation.
- Diagnostics export includes the full sensor discovery report for support analysis.

The diagnostics report now also includes:
- WMI namespace inventory for `ROOT\\WMI`, `ROOT\\CIMV2`, `ROOT\\dcim`, and `ROOT\\dcim\\sysman`.
- Matching thermal/sensor/fan/GPU class names discovered in each namespace.
- HRESULT-aware query failure decoding (for example invalid class vs unsupported provider path).
- GPU adapter inventory (vendor, integrated/discrete heuristic, VRAM) and GPU engine counter probe state.

What this means:
- CPU usage and other telemetry can still be live.
- CPU package temperature may remain unavailable until a model-safe OEM/driver-assisted provider is enabled.

## Telemetry Sources

| Metric | Source |
|---|---|
| CPU usage / clock | sysinfo |
| CPU temperature | WMI ACPI + perf thermal classes + sysinfo component fallback |
| GPU telemetry (temp/usage/clocks/VRAM/fan/power) | NVML (NVIDIA), ADL2 (AMD), WMI fallback |
| GPU driver version | NVML `nvmlSystemGetDriverVersion` (clean "560.94" format); WMI fallback |
| Chipset driver version | WMI `Win32_PnPSignedDriver` (AMD SMBus / Intel chipset) |
| GPU driver update status | NVIDIA GeForce driver API (async, silently degrades on no network) |
| RAM usage | sysinfo |
| Storage usage | sysinfo |
| Network throughput | sysinfo |

## Driver Version and Update Check

The dashboard identity panel surfaces GPU and chipset driver versions:

- **GPU Driver**: shown as `v560.94` using NVML's clean version string.  On systems without NVML (non-NVIDIA), falls back to the WMI Windows-format string.
- **Chipset Driver**: WMI `Win32_PnPSignedDriver` query targeting AMD SMBus or Intel chipset components.
- **Update check (NVIDIA only)**: on component mount the app calls `check_driver_update` which queries the NVIDIA GeForce driver lookup API in a background thread. If a newer WHQL driver is available, an **Update Available** badge appears and opens the direct download URL. If no network is reachable or the API changes, the command returns `None` and the UI falls back to a **Check** link. AMD chipset update checking is not implemented (no stable public API).

## Sensor Discovery Report

The telemetry diagnostics snapshot now includes:
- Machine vendor/model/family detection.
- Dell profile detection.
- Per-source thermal probe attempts.
- Raw values, converted values, accepted/rejected status, and rejection reasons.
- Dell WMI class hints where discoverable.
- Namespace/class inventory with availability and status per namespace.
- GPU adapter inventory and GPU engine counter probe state.
- Issue classification for package-temperature unavailability.
- Recommended next action when package temperature is unavailable.

Diagnostics export bundles this report under ProgramData diagnostics output.

Runtime warning behavior:
- CPU temperature-unavailable warnings are now throttled in the monitor loop.
- The backend logs a concise diagnostic signature at most once per minute unless the failure classification changes.

Known telemetry limitations:
- Some Dell/enterprise laptop BIOS profiles do not expose package CPU temperature through user-mode WMI.
- Intel Arc telemetry remains staged in this build and uses explicit fallback messaging.
- Storage temperature channels may remain unavailable where SMART/driver telemetry is blocked.

## Tray and Close Behavior

- The X button follows the Settings toggle:
  - Enabled: close request hides to tray.
  - Disabled: close request exits the app.
- The minimise button follows a separate setting:
  - Enabled: minimise request hides to tray.
  - Disabled: minimise request uses standard window minimise.
- Tray Exit performs full app exit.
- Settings sync the close-to-tray policy to the native runtime.

## Startup and Lifecycle Settings

The desktop settings surface now includes:

- Start with Windows.
- Start minimised.
- Minimise to tray on close.
- Minimise to tray on minimise.
- Launch overlay on startup.
- Launch monitoring on startup.

Startup registration writes current-user Run entries and now respects the start-minimised mode toggle.

## Tray Menu (Desktop Polish)

Current tray actions:

- Open Companion
- Toggle OSD Overlay
- Quick RAM Clean
- Performance Mode
- Quiet Mode
- Diagnostics Export
- Restart Monitoring Engine
- Exit

Tray tooltip includes:

- CPU temperature and usage
- GPU temperature and usage
- RAM usage
- Active GPU provider
- Telemetry state

## UI and Density Direction

The current shell and dashboard pass focuses on:

- compact navigation rows and tighter topbar spacing,
- high-density telemetry cards with clear provider context,
- reduced hero/marketing surface in favour of monitorable system state,
- restrained animation and hover behaviour suited to desktop utility workflows,
- dark industrial surfaces with orange Radium accenting.

Telemetry remains real and provider-backed; unavailable channels are shown as degraded/limited states rather than hidden.

## Commercial Interaction Polish (Latest)

Latest pass focused on refinement, not redesign:

- Reduced shell and dashboard visual noise (lower glow intensity, calmer hover states, tighter typography rhythm).
- Simplified topbar interaction density for desktop workflows.
- Improved diagnostics readability with quieter headers, tighter matrix rows, and clearer copy for support interpretation.
- Kept existing telemetry, tray, startup, and diagnostics architecture unchanged.

## Premium Visual Identity And Dashboard Presentation (Latest)

Latest visual pass elevates presentation quality while keeping all backend behavior unchanged:

- Hardware-aware dashboard hero accents now adapt by detected vendor family (Intel, AMD, NVIDIA).
- Dashboard system identity chips now surface core platform details directly in the hero for faster operator context.
- Support-readiness grade tile adds immediate status framing without changing telemetry scoring logic.
- System Passport identity metadata now uses live system-derived values (no placeholder pending labels).
- OSD overlay typography, spacing, border treatment, and hover behavior were refined for cleaner streamer-grade readability.
- Loading and notice surfaces gained restrained depth treatment and improved contrast rhythm.

Validation after this visual phase:

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

## Dashboard Layout, Composition And Visual Hierarchy Refinement (Latest)

This pass focuses on layout quality and telemetry readability without changing backend architecture:

- Reduced oversized hero empty space by tightening hero spacing, logo scale, and telemetry grouping.
- Reframed top section into a compact System Identity and Telemetry Overview composition.
- Added stronger hierarchy between primary telemetry (CPU/GPU/RAM) and secondary telemetry (network and contextual panels).
- Rebalanced dashboard grid proportions for better above-the-fold density and less dead horizontal space.
- Improved system-health framing with compact state, provider context, telemetry lane summary, and freshness indicator.
- Refined vendor/logo integration and right-side hero visual treatment for a more intentional OEM presentation.

Validation after this pass:

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

## Interaction Quality, Perceived Performance And Commercial Polish (Latest)

This phase focused on perceived quality and interaction behavior while preserving existing telemetry and desktop lifecycle systems:

- Unified control interactions (hover, press, focus-visible, and transition timing) across shell buttons and actions.
- Refined sidebar/topbar/search interaction feel with lighter motion, cleaner feedback, and reduced jitter perception.
- Tuned page navigation transitions to feel smoother and less noisy, with reduced blur and animation gating support.
- Improved telemetry smoothing via safer numeric interpolation for animated metrics.
- Tuned dashboard chart animation durations/easing for smoother but responsive updates.
- Added premium diagnostics loading skeletons and export success emphasis for support workflow clarity.
- Added first-launch progress rail and subtle startup state polish.
- Improved OSD readability/interactivity with restrained transition and typography polish.
- Added reduced-motion handling to keep interaction behavior resource-friendly on constrained environments.

Validation after this pass:

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

## Information Density, Viewport Optimisation And Desktop Ergonomics (Latest)

This pass focused on practical desktop telemetry density while preserving all backend/provider architecture:

- Rebalanced dashboard spacing rhythm (smaller panel paddings, tighter hero spacing, reduced card and gauge footprint).
- Reduced visual-card, grade-tile, and runtime-chip heights to reclaim above-the-fold space.
- Reduced chart heights in the Dashboard live graph and throughput panels to lower vertical demand.
- Fixed medium-desktop dashboard breakpoint behavior (`<=1500px`) so key surfaces no longer collapse to a full-width vertical stack.
- Kept clear hierarchy: hero + primary telemetry + health + core trend remain visible sooner in common desktop windowed layouts.

Validation after this pass:

- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

## Telemetry Visualisation, OEM Identity Assets And Dashboard Instrumentation Refinement (Latest)

This phase focused on telemetry-layer polish only (no backend/provider architecture changes):

- Refined circular gauges with thinner arcs, reduced glow, tighter typography, and a more instrumentation-grade visual profile.
- Rebalanced right-side thermal and telemetry cards with denser spacing and cleaner hierarchy for faster scanning.
- Added compact vendor identity surfaces in telemetry cards and System Passport using integrated OEM assets from `/images`.
- Expanded frontend OEM asset registry (Radeon, MSI, ASRock, ASUS, Intel Arc, AMD, Intel, NVIDIA) and contextual vendor-logo selection.
- Reduced visual noise in telemetry modules (calmer gradients/glows, tighter chart lines, denser chart containers, cleaner metric rhythm).
- Compressed OEM readiness panel footprint while adding concise contextual telemetry chips.
- Preserved all telemetry bindings, provider diagnostics, tray/startup lifecycle behavior, and diagnostics contracts.

Validation after this pass:

- `npm.cmd run build` passed.
- `cargo check --manifest-path Cargo.toml` passed (from `src-tauri`).
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Responsive smoke checks (dashboard telemetry surfaces) reported:
  - no horizontal overflow at 1366x820, 1600x900, 1920x1080, 2560x1440, 3440x1440,
  - no status-pill clipping at the same sizes.

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

## Installer and Distribution

- Primary artifact: `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Install mode: per-user or per-machine (`both`)
- Startup registration: current-user Run entry, reversible from Settings

Recommended external tester flow:

1. Install from NSIS package.
2. Launch app and verify tray registration.
3. Open Diagnostics page and verify provider/degraded-state readability.
4. Export diagnostics and attach JSON with issue reports.
5. Uninstall and verify application removal and startup entry cleanup.

Installer notes:

- NSIS install mode is configured as `both` (per-user or per-machine).
- Icon metadata is sourced from packaged app icons (`icons/icon.ico` and project favicon assets).

Latest validation snapshot:

- `npm.cmd run build` passed.
- `cargo check --manifest-path Cargo.toml` passed from `src-tauri`.
- `npm.cmd run build:exe` produced release EXE and NSIS installer output.
- Viewport overflow checks passed at:
  - 1366x768,
  - 1600x900,
  - 1920x1080,
  - 2560x1440,
  - 3440x1440.

Pre-release candidate sweep checks:

- Telemetry diagnostics include provider states, confidence, namespace inventory, GPU inventory, and lifecycle metadata.
- Dell degraded-state messaging uses explicit limitation classification (no silent blanks).
- CPU unavailable warning logs are throttled to avoid spam.

Latest packaging validation (interaction polish pass):

- `npm.cmd run build:exe` completed end-to-end.
- Output installer: `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`.

Latest localisation and rebuild update (2026-05-24):

- User-facing copy was standardised to Australian English in key UI flows (for example: optimise, initialise, minimise, analyse, Command Centre).
- Scope was limited to visible interface text; internal API/function identifiers were intentionally unchanged.
- Fresh release artifacts were rebuilt and validated:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Artifact metadata snapshot:
  - `radium_pcs_companion.exe` - `13,793,280` bytes - `24/05/2026 7:43:23 AM`
  - `Radium PCs Companion_0.1.0-pre_x64-setup.exe` - `5,804,123` bytes - `24/05/2026 7:43:22 AM`

Manual validation still required before broad external rollout:

- full interactive installer and uninstall walkthrough,
- startup-with-Windows and start-minimized end-to-end UX checks,
- tray restore/exit loops on a host where process termination is not permission-constrained.

## Safety Model

- Local-first operation.
- No automatic cloud upload.
- Browser mode uses mock data only.
- Mutating operations are native-only and safety-gated.

## Current Known Limitations

- Dell Latitude 5330 and similar enterprise profiles may not expose package CPU temperature via user-mode WMI paths.
- Intel Arc native telemetry provider remains staged; fallback channels are surfaced clearly.
- Full hardware matrix validation is still pending for several desktop/laptop combinations listed in [docs/compatibility-matrix.md](docs/compatibility-matrix.md).
- Some installer/uninstaller checks require interactive manual validation on tester machines (UAC, shortcuts, uninstall prompts).

## Troubleshooting

- No telemetry on startup:
  - open Diagnostics, check provider states and degraded reasons,
  - confirm vendor drivers are installed,
  - export diagnostics bundle for support.
- CPU temperature unavailable on Dell:
  - this can be a platform exposure limit,
  - verify issue classification and namespace inventory in Diagnostics,
  - continue using CPU usage and other live channels.
- Tray or startup behavior mismatch:
  - confirm settings for close/minimize/startup toggles,
  - restart monitoring engine from tray,
  - relaunch app and re-check lifecycle state in export data.

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
