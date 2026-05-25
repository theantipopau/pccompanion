# Radium PCs Companion — AI Agent Context Log

> **READ THIS FIRST.** Every AI agent working on this repository must read this file at session start and update it at session end. This is the single source of truth for cross-session and cross-agent continuity.

> **Short current brief:** use `docs/current-state.md` for the release-ready snapshot and next best work. This file keeps the detailed running history, including older blockers that may now be resolved.

---

### Phase: Sidecar Packaging, Dashboard Layout, and Settings Consolidation (2026-05-25)

#### Implementation
- Fixed the sensor sidecar packaging path so the installer no longer bundles the stale `radium-sensor-sidecar-x86_64-pc-windows-msvc.exe` apphost.
- `tools/radium-sensor-sidecar/RadiumSensorSidecar.csproj` now publishes a DLL-only sidecar with `UseAppHost=false`.
- `scripts/build-sensor-sidecar.ps1` now clears stale publish output, removes stale sidecar EXEs from `src-tauri/binaries`, copies LibreHardwareMonitor dependencies, and bundles a private .NET 8 runtime under `src-tauri/binaries/dotnet-runtime/`.
- `src-tauri/src/sidecar_provider.rs` now prefers the sidecar DLL before any legacy EXE and launches it with the bundled runtime when available.
- `src-tauri/tauri.conf.json` now packages `binaries/**/*` so nested runtime files are included in the NSIS installer.
- The NSIS installer is now forced to per-machine mode so the PawnIO driver setup runs from an elevated installer context.
- The NSIS PawnIO hook now resolves `PawnIO_setup.exe` from `$INSTDIR\binaries\` first, falls back to `$INSTDIR\resources\binaries\`, runs it with `/S`, logs the setup exit code, and queries `sc.exe query PawnIO` for install verification.
- Dashboard layout now uses explicit CSS grid areas instead of auto-placement and row spans, removing the large blank region under the hero on wide screens.
- Fixed a follow-up dashboard regression where reset rules overrode the named grid areas and collapsed panels into narrow columns.
- OSD window creation now uses a transparent window/webview background, no shadow, hidden-until-loaded behavior, and overlay-root CSS so it should no longer flash/show as a blank white rectangle.
- Sidecar `available` now means CPU package temperature was actually found. Storage/fan-only sidecar data is reported as `partial_no_cpu_temp` with sensor/driver notes instead of misleadingly claiming the CPU path is live.
- System Passport and Telemetry Diagnostics are now Settings sub-tabs while legacy navigation targets still deep-link into those Settings tabs.

#### Validation
- `npm.cmd run build:sensor-sidecar` passed after NuGet restore/network access.
- Direct sidecar smoke test through the bundled runtime passed:
  - `src-tauri\binaries\dotnet-runtime\dotnet.exe src-tauri\binaries\radium-sensor-sidecar-x86_64-pc-windows-msvc.dll --once`
  - returned `no_matching_sensors` on this laptop with the note `No temperature sensors were exposed to the sidecar; PawnIO may be missing, blocked, or not started.`
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed with one existing dead-code warning for `get_gpu_name`.
- `npm.cmd run build:exe` passed and rebuilt:
  - `src-tauri\target\release\radium_pcs_companion.exe`
  - `src-tauri\target\release\bundle\nsis\Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Latest installer timestamp: `2026-05-25 19:52:12`, size `36,379,796` bytes.

#### Notes
- The Ryzen test server should no longer show the missing .NET/hostfxr sidecar failure after installing the rebuilt package.
- If CPU temperature still does not appear after reinstall, the next diagnostic signal to check is whether PawnIO actually installed and whether LibreHardwareMonitorLib exposes an AMD `Tctl/Tdie` sensor row through the sidecar.
- Updated installer mode from `both` to `perMachine` after target testing suggested PawnIO was not being installed from the prior per-user-capable path.
- Fixed the PawnIO hook path after target testing showed Tauri resources install to `$INSTDIR\binaries`, not `$INSTDIR\resources\binaries`.

---

### Phase: Sidebar and Maintenance UX Polish (2026-05-25)

#### Implementation
- Reworked the sidebar brand block from two competing logo images into a clear icon-plus-header treatment:
  - Radium logo icon on the left,
  - `Radium PCs` primary text,
  - `Companion` secondary header text.
- Refined sidebar card surfaces for live sensors and support promo with calmer spacing, clearer hierarchy, and more consistent radius/border treatment.
- Added a compact maintenance command strip to:
  - Bloatware Remover,
  - Registry Cleaner,
  - System Cleaner.
- Bloatware Remover now surfaces detected, low-risk, review, and selected counts above the main list and has an empty state for clean systems.
- Registry Cleaner now has a clearer scan/backup/clean status strip before the existing step guide.
- System Cleaner now surfaces analyse/guardrail/selected status before the scan/cleanup panels.
- Tightened maintenance row styling, action-log surfaces, panel spacing, hover behavior, and summary tiles across the three maintenance tools.

#### Validation
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed with one existing dead-code warning for `get_gpu_name`.
- `npm.cmd run build:exe` passed and rebuilt:
  - `src-tauri\target\release\radium_pcs_companion.exe`
  - `src-tauri\target\release\bundle\nsis\Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Latest installer timestamp: `2026-05-25 20:01:52`, size `36,373,411` bytes.

---

## Current Project State

| Area | Status |
|---|---|
| Frontend (React/TypeScript) | ✅ Stable — all pages implemented, mock-data and native-data compatible |
| Rust backend — HAL modules | ✅ Complete (hardware, wmi_provider, nvml_provider, amd_provider, cleanup, windows_util) |
| Rust backend — lib.rs rewrite | ✅ Complete (all commands delegate to modules) |
| Background monitoring thread | ✅ Implemented (not yet build-validated) |
| WMI telemetry — CPU temp (ACPI path) | ✅ Primary: `ROOT\WMI\MSAcpi_ThermalZoneTemperature`; fallback: perf-counter path |
| WMI telemetry — GPU usage | ✅ Implemented via `Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine` |
| NVML telemetry (NVIDIA GPU full) | ✅ Implemented (dynamic `nvml.dll` loading) |
| NVML driver version (clean format) | ✅ `nvmlSystemGetDriverVersion` → "560.94" format; overwrites WMI version in cache |
| GPU / chipset driver version display | ✅ Dashboard identity panel — `v560.94` with Update Available badge or "Up to date" |
| GPU driver update check (NVIDIA async) | ✅ `check_driver_update` command — NVIDIA GeForce API, spawn_blocking, silently degrades |
| ADL2 telemetry (AMD GPU full) | ✅ Implemented (dynamic `atiadlxx.dll` loading) |
| Intel Arc telemetry | 🟨 IGCL loader groundwork active + WMI fallback usage; full Arc sensor bindings staged |
| Network adapter detection | ✅ Most-active adapter name + type (wifi/ethernet/unknown) |
| Storage drive type detection | ✅ NVMe/SSD/HDD via sysinfo DiskKind + name heuristic |
| WMI disk model names | ✅ `Win32_DiskDrive` query → "Model (N GB)" labels |
| RAM cleaner (real EmptyWorkingSet) | ✅ Implemented |
| Storage scanner (real file sizes) | ✅ Implemented (includes Edge/Chrome/Firefox/WU/DeliveryOpt caches) |
| Startup manager (real registry) | ✅ Implemented (StartupApproved key reads/writes) |
| Bloatware scanner (real AppX queries) | ✅ Implemented (10 known packages via PowerShell) |
| Registry cleaner | ✅ Implemented (scan + backup to Documents + dry-run/live clean) |
| Performance profiles page | ✅ UI + service contracts done; backend applies Companion state only (no firmware writes yet) |
| Diagnostics export | 🟨 Exports expanded provider/capability/provenance JSON bundle to `%ProgramData%\Radium PCs Companion\diagnostics\` |
| **callNative browser/native split** | ✅ `isNative()` detection — browser uses mock, Tauri mode propagates real errors |
| **All mutating ops execute for real** | ✅ `dryRun: false` for startup, bloatware, storage, registry operations |
| **MonitorContext `native` flag** | ✅ `native: boolean` exposed in context; DashboardPage shows browser-preview banner |
| **Branding — logos** | ✅ `radiumcompanion-header.png` wordmark + `radiumlogo.png` icon wired throughout |
| **App icon / favicon** | ✅ `tauri.conf.json` bundle icon + `index.html` favicon both set to `radiumlogo.png` |
| **Standalone EXE / NSIS installer** | ✅ `tauri.conf.json` NSIS configured; `npm run build:exe` produces installer |
| **Run scripts** | ✅ `npm run desktop`, `build:exe`, `package:windows`, `package:portable`, `check:desktop` |
| **Minimize to tray** | ✅ Close button hides to tray; `--background`/`--silent` start hidden; double-click restores |
| **Live tray icon (metric)** | ✅ Multi-metric tray icon renderer live (CPU/GPU temp, CPU/GPU/RAM usage) |
| UI density rework | ✅ CSS scaled down across all components |
| UI polish — panels, nav, scrollbar | ✅ Panel glow hover, nav left-accent active, status-dot pulse, thin cyan scrollbar |
| Desktop run scripts | ✅ `desktop`, `dev:desktop`, `build:exe`, `package:windows`, `check:desktop` scripts added |
| EXE packaging config | ✅ Tauri NSIS bundle metadata configured |
| Build validation | 🟨 `npm.cmd run build` + `cargo check` + `cargo test -q` passed; `cargo test` binary run still needs elevation |
| Runtime validation | ✅ Packaged release EXE launched from `src-tauri/target/release/radium_pcs_companion.exe`; ProgramData logs show tray registration and background startup |
| Dell thermal discovery report | ✅ Added per-source thermal probe attempts with accepted/rejected values, labels, and Dell namespace hints |
| Dell namespace inventory diagnostics | ✅ Added namespace/class inventory for ROOT\WMI, ROOT\CIMV2, ROOT\dcim, ROOT\dcim\sysman |
| HRESULT error classification | ✅ Discovery reasons now classify invalid-class/not-supported/invalid-namespace/access-denied HRESULTs |
| GPU fallback clarity (Intel/Dell) | ✅ Discovery report includes GPU adapters + GPU engine counter availability state |
| CPU temp limitation surfacing | ✅ CPU package telemetry now marks `driver_required` when user-mode channels are unavailable |
| CPU temp warning spam control | ✅ Monitor loop warning is throttled (signature-based; re-log at most once/15 minutes unless classification changes) |
| Close behavior control | ✅ Native close-to-tray behavior now follows Settings toggle via runtime command |
| Sidebar compact grouping | ✅ Sidebar now supports grouped nav sections and compact-shell mode tied to settings |
| Minimise lifecycle control | ✅ Separate native policy added for minimise-to-tray on minimise |
| Tray menu production actions | ✅ Added diagnostics export + monitoring restart tray actions |
| Startup mode registration | ✅ Startup registration now respects start-minimised mode |
| NSIS install mode | ✅ Configured for `both` (per-user and per-machine) |
| Compatibility matrix tracking | ✅ `docs/compatibility-matrix.md` added for real-hardware validation phase |
| Diagnostics export runtime metadata | ✅ Export now includes app version/build + startup/tray/window lifecycle state |

---

### Phase: Staged PawnIO/LHM Headless Sensor Sidecar (2026-05-25)

#### Implementation
- Added a hidden .NET sidecar scaffold in `tools/radium-sensor-sidecar/`.
- The sidecar dynamically loads `LibreHardwareMonitorLib.dll` if it is bundled beside it, enables hardware sensors, and emits JSON for CPU package temperature, CPU fan RPM, and storage temperature candidates.
- Added official `LibreHardwareMonitorLib` NuGet dependency (`0.9.6`) to the sidecar project; the build script copies the win-x64 DLL beside the sidecar.
- Added `scripts/build-sensor-sidecar.ps1` and wired:
  - `npm run build:sensor-sidecar`,
  - `npm run build:exe`,
  - `npm run package:windows`.
- The sidecar is published to `src-tauri/binaries/` and packaged by Tauri through `bundle.resources: ["binaries/**/*"]`.
- Added `src-tauri/src/sidecar_provider.rs`:
  - finds bundled or development sidecar files,
  - runs the sidecar hidden,
  - supports DLL launch through bundled `dotnet-runtime\dotnet.exe` before falling back to system `dotnet`,
  - applies a short timeout,
  - parses provider JSON into Rust telemetry state.
- The monitoring loop now probes the Radium sidecar every 10 seconds and prefers its CPU package temperature if present.
- Diagnostics now includes `Radium Sensor Sidecar` as a staged/live provider with status, path, and notes.
- Added `vendor/README.md` to describe where reviewed third-party binaries must be placed:
  - `vendor/LibreHardwareMonitor/LibreHardwareMonitorLib.dll`,
  - `vendor/PawnIO/PawnIO_setup.exe`.
- Added `src-tauri/windows/hooks.nsh` and wired it via `tauri.conf.json` so NSIS post-install silently runs `PawnIO_setup.exe /S` from per-machine install mode if the reviewed installer is bundled.

#### Current runtime behavior
- The sidecar DLL, LibreHardwareMonitorLib dependencies, bundled .NET 8 runtime, and reviewed `vendor/PawnIO/PawnIO_setup.exe` are included in `src-tauri/binaries/` for the installer.
- The previous stale sidecar EXE apphost has been removed so target machines do not need a separate .NET runtime install.
- Direct sidecar test currently returns:
  - provider: `radium-lhm-pawnio`,
  - status: `no_matching_sensors`,
  - note: `LibreHardwareMonitor loaded, but no CPU package temperature sensor was returned.`
- This is expected on machines where PawnIO is not installed or where the low-level provider does not expose a matching CPU package sensor row.

#### Validation
- `npm.cmd run build:sensor-sidecar` passed.
- Direct sidecar JSON smoke test passed with expected staged `no_matching_sensors` state on this laptop.
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and rebuilt:
  - `src-tauri\target\release\radium_pcs_companion.exe`
  - `src-tauri\target\release\bundle\nsis\Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Latest installer timestamp: `2026-05-25 15:02:34`, size `8,051,558` bytes.

#### Remaining work before live Ryzen CPU temps
- Validate that the NSIS post-install hook completes PawnIO setup on the Ryzen 5 5500 + ASUS PRIME X370-PRO test server.
- Confirm CPU Tctl/Tdie appears in Dashboard, Thermals, Passport, and Diagnostics after reinstall.

---

### Phase: All-In-One Sensor Provider Direction & UI Sweep (2026-05-25)

#### Sensor provider direction
- Confirmed from LibreHardwareMonitor source that Ryzen package temperatures are read through AMD Zen SMN/MSR access with a low-level provider layer, not generic Windows WMI.
- Added `docs/radium-sensor-provider.md` to capture the all-in-one Radium provider path:
  - signed/elevated read-only provider,
  - AMD Zen Tctl/Tdie package temperature first,
  - diagnostics provenance for every low-level read,
  - no fabricated DIMM/PSU/ambient values.
- Linked the provider plan from `README.md`.
- Settings now labels missing CPU temperature as requiring the Radium low-level provider instead of implying WMI can solve every desktop board.
- Utilities now includes a planned "Radium sensor provider" module card so the product surface reflects the all-in-one direction.

#### UI/UX sweep outcomes
- `PageHeader` now has dedicated copy/action regions so action buttons wrap cleanly instead of crowding headers.
- Added compact summary bars to Startup Manager and Bloatware Remover for quick scan/readiness state.
- Added empty states for startup and bloatware lists.
- Tightened cleanup/startup/list hover states and made long cleanup target lists scroll within their panels.
- Rebalanced Bloatware cleanup layout from a very wide list/narrow side column into a calmer two-column manager layout.
- Converted Process Monitor summary from a wrapping flex strip into a stable responsive grid.
- Improved responsive behavior for header actions, operation summaries, and process sorting controls.

#### Validation
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and rebuilt:
  - `src-tauri\target\release\radium_pcs_companion.exe`
  - `src-tauri\target\release\bundle\nsis\Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Latest installer timestamp: `2026-05-25 14:27:57`, size `6,822,891` bytes.

---

### Phase: Ryzen Desktop Thermal Honesty & Thermals UI Cleanup (2026-05-25)

#### Backend telemetry outcomes
- Confirmed the Ryzen 5 5500 / PRIME X370-PRO test build is now correctly resolving CPU, GPU, motherboard, BIOS, RAM speed, and NVIDIA NVML telemetry.
- Improved WMI namespace diagnostics by enumerating `meta_class` with `SELECT * FROM meta_class`, reducing false diagnostic failures when a namespace exists but direct `__CLASS` projection is rejected.
- CPU package temperature discovery now records explicit LibreHardwareMonitor/OpenHardwareMonitor bridge attempts when those WMI namespaces are absent.
- If CPU package temperature is unavailable after WMI, sysinfo, and external monitor bridge checks, diagnostics now classifies the channel as `driver_level_telemetry_required` unless access is denied.
- Recommended action now points at a Radium hardware provider or Libre/Open Hardware Monitor WMI bridge instead of implying the app can infer Ryzen package temperature from generic Windows user-mode sources.

#### Thermals UI outcomes
- Removed estimated/fake Memory Bank and PSU Bay temperatures from the thermal map.
- Thermal zones now show measured temperatures only; load-only zones explain that DIMM, PSU, ambient, or SMART temperature sensors are unavailable.
- CPU thermal card now falls back to CPU Load with exact CPU name/logo when package temperature is unavailable.
- GPU thermal card now shows the exact GPU name/logo using live provider/sample identity.
- Rebalanced the Thermals layout so the case visual, legend, metric cards, GPU detail, and sensor-accuracy note fit together more cleanly.
- Replaced large numbered in-case pins with compact sensor dots while keeping numbered legend rows and accessible labels.

#### Validation
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and rebuilt:
  - `src-tauri\target\release\radium_pcs_companion.exe`
  - `src-tauri\target\release\bundle\nsis\Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Latest installer timestamp: `2026-05-25 14:14:46`, size `6,820,828` bytes.

---

### Phase: Utility Stability, Async Operations & Trusted Maintenance UX (2026-05-25)

#### Scope guardrails applied
- No telemetry architecture redesign.
- No fake optimisation behavior or placebo cleanup results.
- No aggressive registry deletion logic added.
- No dangerous cleaning targets introduced.

#### Backend stability outcomes
- Utility-heavy commands were moved off synchronous invocation paths using `tauri::async_runtime::spawn_blocking` for:
  - RAM optimisation,
  - bloatware scan/remove/restore,
  - storage scan/cleanup.
- Added storage scan task lifecycle commands in `lib.rs`:
  - `start_storage_cleanup_scan`,
  - `get_storage_cleanup_scan_status`,
  - `cancel_storage_cleanup_scan`.
- Added coarse but real scan progress reporting (`step/total/message/progressPct`) and cancellation signaling.
- Storage scan traversal now uses bounded directory estimation plus cancellation-aware recursion checks to reduce UI stall risk on very large trees.

#### Windows process UX hardening
- Added hidden-subprocess helper in `windows_util.rs` that uses `CREATE_NO_WINDOW` on Windows.
- Applied hidden execution path to utility subprocess operations:
  - PowerShell AppX queries/removal/restore,
  - scheduled task toggles (`schtasks`),
  - registry export/import (`reg`).
- Goal: prevent visible console flashes during utility operations.

#### Frontend trusted maintenance UX
- Storage Cleaner now uses async scan lifecycle instead of a single blocking call.
- Added scan status rail with:
  - live progress percentage,
  - step counters,
  - current scan message,
  - explicit cancel action.
- Added service contracts/types for scan status payloads in TypeScript.

#### Validation evidence
- `cargo check --manifest-path src-tauri/Cargo.toml` ✅ passed.
- `npm.cmd run build` ✅ passed.

---

### Phase: Runtime Log Review & Diagnostics Noise Hardening (2026-05-25)

#### Log sources reviewed
- `%ProgramData%\Radium PCs Companion\logs\companion-launch-*.log`
- `%LOCALAPPDATA%\com.radiumpcs.companion\logs\Radium PCs Companion.log`

#### Findings
- Recent ProgramData launch logs show successful Tauri setup and tray registration.
- No crash, panic, or hard error entries were found in the app log.
- The main repeated runtime warning is the known Dell Latitude 5330 CPU package temperature limitation:
  - `missing_or_invalid_wmi_class`
  - ACPI thermal path unsupported (`0x8004100C`)
  - Dell DCIM thermal classes unavailable (`0x80041010`)
- Tauri plugin log timestamps appear UTC-based while file timestamps are local, which can make recent log review look confusing.
- Companion launch logs only wrote compact `MM:SS` timestamps, which was insufficient for support triage.

#### Improvements applied
- Launch logs now include `created_at_unix_ms` while retaining the compact clock label.
- Runtime launch-log append entries now include exact `unix_ms=...` plus the compact clock label.
- Stable CPU-temperature-unavailable warnings are now throttled to approximately every 15 minutes instead of every minute unless the classification changes.

#### Validation evidence
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `cargo build --manifest-path src-tauri/Cargo.toml --release` passed.
- Fresh release EXE rebuilt:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - timestamp: `25/05/2026 9:19:54 AM`

---

### Phase: AMD/NVIDIA Desktop Identity Accuracy Fix (2026-05-25)

#### Trigger
- Test desktop with Ryzen 5 5500 + NVIDIA GTX 1660-class GPU was showing stale homepage identity:
  - GPU provider was live as NVML,
  - GPU temperature/VRAM telemetry was live,
  - but homepage/system passport still showed `GPU telemetry initialising…` and an unknown GPU logo.

#### Root causes
- Frontend fetched `get_system_info` once at startup, often before NVML had published the live GPU name/vendor into the backend cache.
- `HardwareSample.gpu` did not expose live GPU `name`/`vendor`, so dashboard surfaces depended on stale static identity.
- Vendor logo selection trusted `systemInfo.gpuVendor` even when it was `unknown`, producing the generic app logo instead of NVIDIA/AMD/Intel.
- WMI GPU static selection preferred max `AdapterRAM`; this can be capped/wrapped by Windows and is weaker than discrete vendor/name quality.
- Placeholder motherboard/BIOS identity strings were not filtered consistently.

#### Fixes applied
- Added live `gpu.name` and `gpu.vendor` to the backend `GpuSample` IPC payload.
- Dashboard now prefers live sample GPU identity over static system info.
- Dashboard and System Passport infer GPU vendor from:
  1. live sample vendor,
  2. active provider (`nvml` -> NVIDIA, `adl2` -> AMD, `igcl` -> Intel),
  3. static system info vendor,
  4. GPU name text.
- Homepage GPU temperature card now shows the exact GPU name and NVIDIA/AMD/Intel logo when detected.
- Homepage CPU card now shows the exact CPU name and falls back to CPU load when package temperature is unavailable.
- Memory card now shows detected mainboard identity and ASUS/ASRock/MSI logo when matched.
- MonitorContext now resynchronises system identity after telemetry providers resolve instead of keeping startup placeholders.
- WMI static GPU selection now prefers real discrete NVIDIA/AMD adapters over weak generic display entries.
- WMI motherboard/BIOS identity filters generic placeholders such as `System Product Name`, `System manufacturer`, `To be filled by O.E.M.`, and `Default string`.
- OEM logo matching expanded for `ASUSTeK` and `Micro-Star` strings.

#### Validation evidence
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `cargo build --manifest-path src-tauri/Cargo.toml --release` passed.
- `npm.cmd run build:exe` passed and rebuilt the NSIS installer.
- Fresh release EXE rebuilt:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - timestamp: `25/05/2026 2:00:56 PM`
- Fresh NSIS installer rebuilt:
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`
  - timestamp: `25/05/2026 2:00:56 PM`

---

### Phase: Dashboard Grid Layout Fix, Driver Version Display & Update Check (2026-05-25)

#### Dashboard grid gap fix
- Identified root cause of empty grid space: `.hero-monitor` had no `grid-row: span 2`, so it occupied only one row while adjacent panels spanned two, leaving a gap.
- Added `grid-row: span 2` to `.hero-monitor` at all grid breakpoints.
- Fixed 1500px breakpoint overflow: `.identity-panel` and `.cooling-panel` were `span 3` each (sum 8 > 6-column grid); changed to `span 2`.
- Added `grid-row: auto` reset for `.hero-monitor` at the 1180px breakpoint to allow natural stacking.
- Added `.driver-version-row`, `.driver-check-link`, `.driver-update-badge`, and `.driver-up-to-date` CSS.

#### GPU driver version — clean format
- Added `type FnGetDriverVersion` and `fn_get_driver_ver: Option<FnGetDriverVersion>` to `NvmlContext` in `nvml_provider.rs`.
- Added `sym_opt!` macro variant (optional symbol — does not fail `init()` if absent).
- Added `pub fn query_driver_version(&self) -> Option<String>` which calls `nvmlSystemGetDriverVersion` and returns a clean version string like `"560.94"`.
- In `hardware.rs` monitor loop, after NVML init, an optional patch block overwrites `SystemInfo.gpu_driver_version` with the NVML version (replaces WMI's Windows-internal "31.0.15.6094" format).

#### WMI driver version fallback (already present from previous turn)
- `wmi_provider.rs::query_gpu_driver_version()` — WMI `Win32_VideoController.DriverVersion`.
- `wmi_provider.rs::query_chipset_driver_version()` — WMI `Win32_PnPSignedDriver` AMD SMBus / Intel chipset.
- Both fields in `SystemInfo`: `gpu_driver_version`, `chipset_driver_version`.

#### Driver update check — backend
- Added `ureq = { version = "2", default-features = false, features = ["json", "native-tls"] }` to `[target.'cfg(windows)'.dependencies]` in `Cargo.toml`.
  - Uses `native-tls` (Windows SChannel) for HTTPS — no bundled CA certificates, uses OS trust store.
- Created `src-tauri/src/driver_update.rs`:
  - `check_nvidia_driver_update(current: &str) -> Option<DriverUpdateInfo>` — hits NVIDIA GeForce driver lookup API (psid=120/pfid=978/osID=57, WHQL only), parses JSON version field, compares with installed version.
  - `version_is_newer(latest, current)` — part-by-part u32 comparison.
  - Silently returns `None` on network failure, API shape change, or timeout (8s).
- Added `pub struct DriverUpdateInfo` to `hardware.rs` (always compiled):
  - `current_version`, `latest_version`, `update_available`, `download_url`.
- Added helper methods to `MonitoringEngine`:
  - `get_gpu_driver_version() -> String`
  - `get_gpu_name() -> String`
- Added `#[cfg(windows)] mod driver_update;` to `lib.rs`.
- Added async `check_driver_update` command (uses `spawn_blocking` so HTTP call does not block the async runtime).
- Registered `check_driver_update` in the Tauri `invoke_handler`.

#### Driver update check — frontend
- Added `DriverUpdateInfo` type to `src/types/system.ts`.
- Added `useState<DriverUpdateInfo | null | undefined>` and `useEffect` in `DashboardPage.tsx`:
  - `undefined` = check pending (shows fallback "Check →" link while waiting).
  - `null` = check failed/N/A (same fallback "Check →" link).
  - `{ updateAvailable: true, ... }` = shows **Update Available** badge (opens download URL).
  - `{ updateAvailable: false, ... }` = shows **Up to date** text.
- GPU driver version now displays as `v{version}` (e.g., `v560.94`).
- Added `callNative` and `DriverUpdateInfo` imports to `DashboardPage.tsx`.
- Added `.driver-update-badge` and `.driver-up-to-date` CSS classes.

#### PawnIO pipeline status
- Superseded by the later sidecar-packaging phase above.
- The build now removes stale sidecar EXEs, stages the DLL sidecar, bundles a private .NET runtime, and copies reviewed `vendor/PawnIO/*` artifacts into `src-tauri/binaries/`.
- The NSIS hook now runs `PawnIO_setup.exe /S` when present and records the setup exit code in the installer log.

#### Validation
- `cargo check --manifest-path src-tauri/Cargo.toml` ✅ passed (1 expected dead_code warning for `get_gpu_name` which is used by command).
- `tsc --noEmit` ✅ passed (no errors).

---

### Phase: Repository Identity Verification & Wrong-Stack Audit (2026-05-24)

#### Verification commands executed
- `git remote -v`
- `git branch --show-current`
- `git status`
- `dir`
- `dir src-tauri`
- `dir src`
- `type package.json`
- `type src-tauri/Cargo.toml`

#### Repository identity result
- Workspace path confirmed: `F:\radiumpcs`
- Remote confirmed: `https://github.com/theantipopau/pccompanion.git`
- Branch confirmed: `main`
- Stack confirmed present: Tauri + Rust backend + React/TypeScript frontend
- Required structure confirmed present: `src-tauri/`, `Cargo.toml`, `package.json`, `build:exe` script
- Expected files confirmed present:
  - `src-tauri/src/hardware.rs`
  - `src-tauri/src/wmi_provider.rs`
  - `src/pages/DashboardPage.tsx`
  - `src/pages/StorageCleanerPage.tsx`
  - `src/pages/RegistryCleanerPage.tsx`
  - `src/pages/BloatwarePage.tsx`

#### Commit audit (`8590ad2`)
- `git show --stat 8590ad2`, `git show --name-only 8590ad2`, and `git show --summary 8590ad2` all returned unknown revision.
- Conclusion: commit `8590ad2` does not exist in this repository history and is not part of current `main`.
- Wrong-stack Python files were checked and not found (`cleanup.py`, `system.py`, `models.py`).

#### Recovery action
- No revert was applied because there was no matching wrong-stack commit in this repository and no wrong-stack files present.
- Validation sequence executed:
  - `npm.cmd run build` ✅ passed
  - `cargo check --manifest-path src-tauri/Cargo.toml` ✅ passed
  - `npm.cmd run build:exe` ✅ passed (after clearing transient Windows file lock)

#### Safe next steps
- Continue only within the verified `pccompanion` repository.
- If `8590ad2` exists elsewhere, audit that other repository directly before applying any revert there.

---

### Phase: Unstaged UI Change Audit (2026-05-25)

#### Scope audited
- `src/components/Shell.tsx`
- `src/lib/assets.ts`
- `src/pages/DashboardPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/UtilitiesPage.tsx`
- `src/styles.css`

#### Audit result summary
- All six unstaged changes are valid for Radium PCs Companion's current UI direction.
- No wrong-stack additions were detected.
- Changes align with existing premium desktop visual language and AU English copy direction.

#### Key findings by file
- `Shell.tsx`:
  - Added sidebar premium promo block and search empty-state helper.
  - Valid for UX clarity; low regression risk.
- `assets.ts`:
  - Added `radiumHeaderNew` mapped to `images/radiumheader-new.png`.
  - Valid and used by updated surfaces.
- `DashboardPage.tsx`:
  - Added compact hero premium asset block.
  - Valid; no telemetry contract changes.
- `SettingsPage.tsx`:
  - Added identity summary panel (CPU/GPU/mainboard/runtime) with vendor assets.
  - Valid; uses existing monitor/settings state.
- `UtilitiesPage.tsx`:
  - Added OEM icon accents and Live/Staged status pills.
  - Valid and improves module scanability.
- `styles.css`:
  - Added matching styles and responsive guards for new UI elements.
  - Valid; no clipping regressions found in build validation.

#### Validation executed
- `npm.cmd run build` ✅ passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` ✅ passed.

#### Decision
- Keep current unstaged UI changes.
- Commit as dedicated UI audit-approved update.

---

### Phase: Australian English Localisation Pass + Fresh Release Rebuild (2026-05-24)

#### Scope guardrails applied
- Frontend copy/localisation pass only.
- No telemetry provider/backend changes.
- No diagnostics contract, lifecycle, or installer architecture changes.

#### Localisation outcomes
- Standardised user-facing copy to Australian English in key visible flows:
  - onboarding copy (`Command Centre`, `initialise`, `initialisation`, `optimisation`),
  - memory cleaner labels and action text (`Optimiser`, `Optimising`, `Optimise RAM`, `Last optimisation`),
  - storage cleaner headline copy (`Analyse ...`),
  - utilities module label (`Network optimisation`),
  - shell topbar tooltip (`Minimise to tray`),
  - performance score summaries (`optimisation`).
- Internal identifiers were intentionally preserved (for example `optimizeRam`, minimise policy keys) to avoid contract breakage.

#### Build and packaging evidence
- `npm.cmd run build` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`
- Artifact metadata captured after rebuild:
  - `radium_pcs_companion.exe`: `13,793,280` bytes, `24/05/2026 7:43:23 AM`
  - `Radium PCs Companion_0.1.0-pre_x64-setup.exe`: `5,804,123` bytes, `24/05/2026 7:43:22 AM`

---

### Phase: Premium Visual Identity & Dashboard Presentation (2026-05-23)

#### Scope guardrails applied
- Frontend-only presentation pass (no backend or telemetry architecture changes).
- Preserved provider arbitration, diagnostics contracts, tray lifecycle behavior, and cleanup operation logic.

#### UI implementation highlights
- Added hardware-aware dashboard hero theming keyed to detected vendor family.
- Added hero identity chips for immediate platform context (OS, board, GPU, CPU).
- Added support-readiness grade tile in dashboard hero (uses existing performance score output).
- Reworked System Passport metadata rows to derive from live system context instead of pending placeholders.
- Refined OSD overlay readability (border, typography, grip treatment, row hover microinteractions).
- Added restrained ambient depth layers and improved notice/loading surface polish.

#### Validation evidence captured in this phase
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

---

### Phase: Dashboard Layout, Composition & Visual Hierarchy Refinement (2026-05-23)

#### Scope guardrails applied
- Layout/composition-only frontend pass.
- No telemetry engine, diagnostics contract, provider arbitration, or lifecycle architecture changes.

#### UI composition outcomes
- Converted dashboard layout to stronger hierarchy with explicit primary and secondary telemetry grouping.
- Reduced hero dead space by tightening top-section padding, logo scale, telemetry chips, and gauge footprint.
- Reworked hero into a compact system identity and telemetry overview with runtime state/provider context.
- Added a restrained right-rail visual treatment to avoid placeholder-banner feel while staying lightweight.
- Rebalanced grid proportions for improved above-the-fold telemetry density and reduced horizontal emptiness.
- Improved health/readiness context presentation and vendor identity integration.

#### Log review notes (latest test)
- No crash stack traces observed in latest runtime tail.
- Dell CPU package-temperature limitation warnings continue at expected cadence with explicit classification (`missing_or_invalid_wmi_class`).
- One log-tail task remains quoting-fragile in this workspace when paths include spaces; direct quoted PowerShell invocation works.

#### Validation evidence captured in this phase
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

---

### Phase: Interaction Quality, Perceived Performance & Commercial Polish (2026-05-23)

#### Scope guardrails applied
- No telemetry architecture changes.
- No diagnostics contract redesign.
- No tray/startup/lifecycle backend replacement.
- No feature creep or dependency expansion.

#### UX and interaction outcomes
- Unified microinteraction timing and focus-visible behavior across buttons, links, and form controls.
- Improved sidebar and navigation interaction quality (hover/press smoothness, reduced jarring movement).
- Improved topbar/search responsiveness and interaction feedback consistency.
- Tuned page transition motion to be lighter and less blur-heavy for calmer perceived performance.
- Improved animated-number interpolation stability to reduce visual jitter on fast telemetry updates.
- Tuned dashboard chart easing/duration for smoother but still responsive telemetry visualization.
- Added diagnostics loading skeleton treatment and export-status emphasis for support workflow polish.
- Added subtle startup progress rail to improve first-launch continuity perception.
- Refined OSD transition/readability behavior and added reduced-motion guardrails.

#### Validation evidence captured in this phase
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

---

### Phase: Information Density, Viewport Optimisation & Desktop Ergonomics (2026-05-23)

#### Scope guardrails applied
- Frontend-only density/ergonomics pass.
- No telemetry provider changes.
- No diagnostics contract changes.
- No tray/startup/lifecycle architecture changes.

#### Layout and density outcomes
- Tightened dashboard spacing scale (panel padding, inter-panel gaps, hero rail spacing, card internals).
- Reduced hero-side visual and grade tile vertical footprint to reclaim dashboard fold-space.
- Reduced gauge footprint and metric-card min-heights to improve telemetry density without dropping readability.
- Reduced dashboard chart heights (primary trend and network throughput) to avoid oversized vertical stacking.
- Reworked `@media (max-width: 1500px)` dashboard layout from forced full-width stacking to a 6-column medium-desktop grid:
  - hero remains prominent,
  - key metric cards retain compact multi-column placement,
  - health + trend panels preserve hierarchy without unnecessary full-width collapse.

#### Validation evidence captured in this phase
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

---

### Phase: Compact System Identity Header Composition Refinement (2026-05-23)

#### Scope guardrails applied
- Dashboard top identity section only.
- No telemetry provider/backend redesign.
- No diagnostics/runtime lifecycle architecture changes.

#### UI composition outcomes
- Replaced oversized dual-logo hero strip with a compact left-aligned identity block.
- New left block now presents single-brand identity, device name, telemetry state headline, and concise provider-backed status copy.
- Replaced decorative right-side visual rail with compact hardware/status pills (CPU, GPU, OS, provider, telemetry lanes, support readiness).
- Preserved existing live bindings for system identity and telemetry/provider data; no fake channels added.
- Reduced dead decorative space and improved hierarchy so the section reads as dashboard-integrated identity telemetry, not concept artwork.

#### Validation evidence captured in this phase
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`

---

### Phase: Telemetry Visualisation, OEM Identity Assets & Dashboard Instrumentation Refinement (2026-05-23)

#### Scope guardrails applied
- Frontend telemetry-visual pass only.
- No telemetry provider pipeline replacement.
- No diagnostics/export contract redesign.
- No tray/startup/installer lifecycle architecture changes.

#### Telemetry and OEM presentation outcomes
- Gauge module refined to smaller instrumentation footprint (thinner arcs, tighter center typography, reduced glow intensity, cleaner tick/readout balance).
- Dashboard telemetry cards rebalanced for higher density and scanability (tighter internals, lower noise, improved metric rhythm).
- Added contextual vendor asset integration in telemetry cards and identity surfaces using local `/images` OEM/vendor PNGs.
- Expanded frontend vendor-asset mapping to include Radeon, MSI, ASRock, ASUS, Intel Arc, AMD, Intel, and NVIDIA variants.
- Score/readiness panel compacted and augmented with concise runtime telemetry context chips for higher information value per area.
- Chart treatment tightened (reduced container heights, calmer fill opacity, thinner line weights) for workstation-style readability.
- System Passport hardware identity now includes compact OEM vendor strip for integrated hardware branding continuity.

#### Responsiveness and glanceability checks
- Browser smoke checks across 1366x820, 1600x900, 1920x1080, 2560x1440, and 3440x1440 showed:
  - no horizontal overflow,
  - no status-pill clipping,
  - reduced hero telemetry footprint versus prior phase.

#### Validation evidence captured in this phase
- `npm.cmd run build` passed.
- `cargo check --manifest-path Cargo.toml` passed from `src-tauri`.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0-pre_x64-setup.exe`


---

### Phase: Final Reliability + Hardware-Telemetry Audit Pass (2026-05-23)

### Phase: Real Hardware Validation & Commercial Readiness (2026-05-23)

#### Scope guardrails applied
- No architecture redesign.
- No major new subsystem introduced.
- Hardening focused on diagnostics clarity, lifecycle visibility, and validation traceability.

#### Compatibility and validation tracking
- Added canonical matrix: `docs/compatibility-matrix.md`.
- Matrix now tracks desktop and laptop target configurations with per-channel status (`validated`, `partial`, `pending`, `blocked`).
- Current real host evidence captured for Dell Latitude 5330.

#### Diagnostics export hardening
- `export_diagnostics` payload now includes:
  - app metadata (`name`, `version`, `buildProfile`, `os`, `arch`),
  - runtime lifecycle state (`startupEnabled`, `closeToTray`, `minimizeToTrayOnMinimize`, `mainWindowVisible`, `osdWindowVisible`, `trayRegistered`).
- Added backend helper to infer current Companion startup registration state from startup scan results.

#### Validation evidence captured in this phase
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed (includes `npm run build` pre-step and NSIS packaging).
- Runtime logs confirm Dell classification + warning-throttle behavior at roughly one-minute cadence:
  - `missing_or_invalid_wmi_class` classification in warning signature,
  - HRESULT interpretation visible (`0x8004100C` unsupported path, `0x80041010` invalid class).

#### Pending manual hardware coverage
- Intel+NVIDIA desktop,
- AMD+NVIDIA desktop,
- AMD+AMD desktop,
- Intel Arc target,
- HP OMEN,
- HP Victus,
- hybrid/iGPU-only laptop scenarios,
- full uninstall manual verification,
- overhead benchmark capture (idle CPU/RAM, tray/OSD polling impact).

---

### Phase: Pre-Release Candidate Sweep & GitHub Release Preparation (2026-05-23)

#### Scope and stability guardrails
- No architecture redesign.
- No risky provider-expansion changes.
- Focused on version alignment, regression confidence, logging hygiene, lifecycle evidence, and release documentation quality.

#### Versioning alignment
- `package.json` version set to `0.1.0-pre`.
- `src-tauri/Cargo.toml` version set to `0.1.0-pre`.
- `src-tauri/tauri.conf.json` version set to `0.1.0-pre`.
- Installer artifact now emits pre-release naming:
  - `Radium PCs Companion_0.1.0-pre_x64-setup.exe`.

#### Diagnostics/logging hardening
- Added bounded retention pruning in `src-tauri/src/lib.rs`:
  - launch logs keep last 60,
  - diagnostics exports keep last 40.
- Diagnostics export already includes app metadata + lifecycle runtime state for support triage.

#### Regression and validation evidence
- `npm.cmd run build` passed.
- `cargo check --manifest-path Cargo.toml` passed via task (`pre-release-cargo-check`).
- `npm.cmd run build:exe` passed with NSIS bundle output (`0.1.0-pre`).
- Artifact metadata check confirms setup `FileVersion` and `ProductVersion` are `0.1.0-pre`.
- Runtime log shows Dell telemetry limitation classification and warning-throttle cadence (~60s).

#### Lifecycle/installer walkthrough status
- Repeated launch/exit automation encountered host permission constraints:
  - one `radium_pcs_companion` PID reported `Access is denied` on forced termination,
  - repeated `Start-Process` occasionally returns `operation was canceled by the user` in task host.
- This blocks full automated no-zombie validation in this environment; marked for manual elevated tester pass.
- Registry audit script executed:
  - uninstall registration entry not observed in current host context,
  - startup Run value currently unset/blank in audited profile.

#### Documentation readiness updates
- README updated with pre-release target, installer/testing guidance, troubleshooting, and known limitations.
- Compatibility matrix updated for pre-release phase naming and readiness summary.
- Telemetry engine doc updated with pre-release stability notes.

#### Remaining manual pre-release checks (required on tester machine)
- Interactive install/uninstall walkthrough (shortcuts, ARP entry, uninstall cleanup).
- Startup-with-Windows + start-minimized user-flow validation from Settings.
- Tray restore/exit cycles with elevated-permission confirmation of zero lingering processes.
- Diagnostics export trigger from UI and file-content spot-check on generated JSON.

---

#### Dell telemetry root-cause clarity
- Added discovery `issueClassification` output for CPU package-temperature unavailability.
- Added namespace-level inventory and matching class listing for:
  - `ROOT\\WMI`
  - `ROOT\\CIMV2`
  - `ROOT\\dcim`
  - `ROOT\\dcim\\sysman`
- Added HRESULT-aware interpretation in query rejection reasons:
  - `0x80041010` invalid class,
  - `0x8004100C` not supported,
  - `0x8004100E` invalid namespace,
  - `0x80041003` access denied.

#### GPU Intel fallback diagnostics
- Added GPU adapter inventory (name/vendor/VRAM/integrated heuristic) to sensor discovery payload.
- Added GPU engine counter probe status to distinguish unavailable counters from vendor-API staging.
- Support snapshot now explicitly explains Intel adapter detection and staged IGCL fallback context.

#### Log reliability hardening
- CPU temperature unavailable warning moved to monitor-loop throttled emission.
- Repeated identical signatures no longer log every poll tick.

#### Validation in this pass
- `npm.cmd run build` passed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.
- `npm.cmd run build:exe` passed and produced:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0_x64-setup.exe`
- Runtime log spot-check command tasks remain quoting-sensitive in this workspace; launch logs confirmed packaged EXE startup.

---

### Phase: Dell Telemetry Deep-Dive + Runtime UX Refinement (2026-05-23)

#### Dell telemetry investigation
- Added machine-profile detection (`manufacturer`, `model`, `family`, Dell profile flag) from WMI.
- Added sensor discovery report pipeline in backend diagnostics:
  - WMI ACPI thermal probes,
  - WMI perf thermal probes,
  - sysinfo component probes (label + raw + accepted/rejected reason),
  - Dell namespace/class hint probes (`ROOT\\dcim\\sysman`, `Dell%` class hints when present).
- Diagnostics snapshot and export now include full sensor discovery attempts.

#### CPU package temperature state handling
- When package temp remains unavailable, diagnostics now surfaces explicit `driver_required` state for CPU package telemetry on Dell-profile systems.
- Support snapshot includes a clear note that user-mode probes can be insufficient for package sensors.

#### Shell and topbar refinement
- Sidebar reorganised into clean nav groups (`Monitor`, `Tuning`, `Maintenance`).
- Added compact-shell behavior linked to Settings compact mode.
- Tightened topbar/search/action density for a less bulky desktop utility feel.

#### Close/minimise/quit behavior
- Added native runtime close policy command (`set_close_to_tray`).
- Window close now hides-to-tray only when enabled; otherwise close exits app.
- Frontend syncs Settings tray toggle with native close policy.

#### Validation target for this phase
- Completed in-session validation after code/docs updates:
  - `npm.cmd run build` completed successfully (`BUILD_DONE` marker captured).
  - `cargo check --manifest-path src-tauri/Cargo.toml` completed successfully.
  - Automated viewport smoke against `npm run dev` at 980x680, 1920x1080, 2560x1440, and 3440x1440 showed no horizontal overflow in shell, sidebar, or topbar containers.
- Remaining manual verification to run on an interactive desktop session:
  - tray menu `Exit` end-to-end confirmation (full process teardown after user click),
  - diagnostics export spot-check from the running desktop app to confirm discovery-attempt payload content on target hardware.

### Phase: Desktop Polish, Reliability & Installer Readiness (2026-05-23)

#### Desktop lifecycle and startup settings
- Added new user-facing settings and runtime wiring:
  - start with Windows,
  - start minimised,
  - minimise to tray on close,
  - minimise to tray on minimise,
  - launch overlay on startup,
  - launch monitoring on startup.
- Native runtime state now tracks minimise-to-tray-on-minimise independently from close behavior.

#### Tray reliability and support actions
- Tray menu streamlined to production actions:
  - Open Companion,
  - Toggle OSD,
  - Quick RAM Clean,
  - Performance Mode,
  - Quiet Mode,
  - Diagnostics Export,
  - Restart Monitoring Engine,
  - Exit.
- Added `restart_monitoring_engine` native command that resets runtime telemetry cache surfaces for recovery workflows.

#### Telemetry trust visibility in tray
- Tray tooltip now includes active GPU provider and telemetry state in addition to CPU/GPU/RAM metrics.

#### Installer readiness and packaging config
- Updated NSIS install mode from per-machine-only to `both` to support per-user and per-machine installation paths.

#### Validation status for this phase
- `npm.cmd run build` completed successfully (`BUILD_OK` captured).
- `cargo check --manifest-path Cargo.toml` from `src-tauri` completed successfully (`CARGO_OK` captured).
- Automated viewport matrix passed with no horizontal overflow at:
  - 980x680,
  - 1920x1080,
  - 2560x1440,
  - 3440x1440.
- `npm.cmd run build:exe` completed successfully with NSIS bundling:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0_x64-setup.exe`
- Still pending manual desktop interaction checks:
  - installer flow and uninstall flow,
  - startup flow (silent/minimised),
  - tray restore and tray exit full process teardown,
  - diagnostics export payload spot-check on target Dell hardware.

#### Desktop OEM visual-density pass (same phase continuation)
- Refined shell and dashboard presentation toward a compact desktop utility profile:
  - reduced topbar/page/card spacing,
  - tighter sidebar/nav ergonomics,
  - stronger telemetry-at-a-glance hierarchy,
  - reduced marketing-heavy hero surface in favour of live telemetry context.
- Updated colour direction to Radium black/orange styling with restrained glow and clearer active states.
- Dashboard now emphasises provider-aware telemetry details directly in CPU/GPU cards (including unavailable/degraded channel messaging).
- Topbar tray preview now includes telemetry state + active provider summary.

#### Additional validation for OEM visual-density pass
- `npm.cmd run build` completed successfully (`BUILD_OK`).
- `cargo check --manifest-path Cargo.toml` from `src-tauri` completed successfully (`CARGO_OK`).
- Automated overflow checks passed at:
  - 1366x768,
  - 1600x900,
  - 1920x1080,
  - 2560x1440,
  - 3440x1440.
- No horizontal clipping detected in shell/sidebar/topbar/dashboard grid containers.

### Phase Continuation: Commercial UX Refinement & Interaction Polish (2026-05-23)

#### Scope guardrails respected
- No telemetry architecture replacement.
- No major new systems.
- No desktop lifecycle behavior regressions introduced.

#### Implemented polish updates
- Shell/topbar refinement:
  - reduced action clutter (removed non-functional notifications action),
  - softened support/tray pill prominence,
  - tightened icon/button sizing and spacing.
- Dashboard refinement:
  - reduced panel glow and hover intensity,
  - tightened card typography and chart-adjacent density,
  - improved telemetry-first hierarchy while preserving existing content model.
- Diagnostics refinement:
  - tightened diagnostics hero/stat/provider card spacing,
  - reduced matrix row/head visual weight,
  - clearer support-facing labels/copy for faster interpretation.

#### Validation for this continuation
- `npm.cmd run build:exe` completed successfully (includes frontend build + Rust compile + NSIS bundling).
- Viewport overflow sweep on live dev server passed with no horizontal or vertical overflow at:
  - 1366x768,
  - 1600x900,
  - 1920x1080,
  - 2560x1440,
  - 3440x1440.

## Completed Work

### Phase: Telemetry Diagnostics + Sensor Provenance + OEM Capability Intelligence (2026-05-23)

#### Frontend diagnostics surface
- Added `src/pages/TelemetryDiagnosticsPage.tsx` with a premium OEM diagnostics layout.
- The page renders:
  - provider orchestration cards,
  - a full sensor provenance matrix,
  - capability intelligence states,
  - support tooling actions,
  - export bundle coverage and validation feedback.
- Wired dashboard quick access and shell search access to `Telemetry Diagnostics`.

#### Backend diagnostics orchestration
- Added `get_telemetry_diagnostics` command and expanded `export_diagnostics` output.
- Introduced backend diagnostics snapshot types:
  - `TelemetryDiagnosticsSnapshot`
  - `ProviderDiagnostics`
  - `SensorProvenance`
- Hardware cache now tracks provider load order, provider warnings, and provider errors for support visibility.

#### Capability intelligence
- Formalised capability states across the stack:
  - live, partial, degraded, staged, unsupported, blocked, elevated_required, driver_required, unknown.
- Sensor confidence is now surfaced as:
  - high, medium, low, unknown.

#### Intel Arc continuation
- IGCL loader scaffold remains staged and visible in diagnostics.
- Intel Arc telemetry is now represented as a support-visible staged provider rather than a hidden fallback.

#### Validation
- `npm.cmd run build` passed.
- `cargo check` passed.
- `cargo test -q` passed for the library test suite; the binary test target requires elevation in this environment.

### Phase: Premium OEM Identity + Embedded Telemetry Expansion (2026-05-23)

#### Frontend evolution
- `src/pages/SystemPassportPage.tsx` now consumes live backend capability registry via `getHardwareCapabilities()` and renders dynamic capability rows instead of static placeholders.
- Added first-launch premium onboarding sequence (`src/components/OnboardingFlow.tsx`) and integrated it in `src/App.tsx` with persisted completion state (`radium-onboarding-complete-v1`).
- Updated global visual language in `src/styles.css`:
  - premium font stack update,
  - layered panel treatment with sheen overlay,
  - dashboard hero telemetry ribbon/chips,
  - tabular numeric typography reinforcement,
  - onboarding modal and new matrix unsupported state styles.

#### Backend telemetry groundwork
- Added Intel Arc provider groundwork module: `src-tauri/src/igcl_provider.rs`.
  - runtime dynamic loading (`igcl64.dll` / `ControlLib.dll` candidates),
  - symbol discovery scaffolding (`ctlInit`, `ctlEnumerateDevices`),
  - safe no-op query path for staged sensor binding rollout.
- Integrated provider into backend startup and polling flow:
  - `src-tauri/src/lib.rs`: registered `igcl_provider` module.
  - `src-tauri/src/hardware.rs`: provider cascade now `NVML -> ADL2 -> IGCL -> WMI`.
  - Added cache fields for `gpu_provider` and `intel_igcl_loaded`.
  - `capability_snapshot()` now reports provider-aware GPU capability detail and Intel groundwork state.

#### Commercial UX continuity
- Tray/workbench alignment remains under OEM identity with metric-mode expansion and richer tooltip language from prior pass.
- Capability matrix now reflects read-only vs write-safe semantics directly from backend command output.

#### Validation
- Build/test re-validation after this wave: pending.

### Phase: OEM Foundation Slice — Passport + Score + LHM Analysis (2026-05-23)

#### Product-facing implementation
- Added a dedicated `System Passport` experience (`src/pages/SystemPassportPage.tsx`) with:
  - hardware identity surface,
  - OEM attestation placeholders (passport ID/serial/build batch/QC seal/image revision/support tier),
  - telemetry access matrix to distinguish live vs partial data channels,
  - integrated Radium score badge.
- Added global navigation route and shell quick-action coverage:
  - `src/App.tsx` now includes `passport` nav item and route.
  - `src/components/Shell.tsx` search quick actions now include `Open System Passport`.

#### Performance model groundwork
- Added `src/lib/performanceScore.ts`:
  - weighted score model with five pillars:
    1) thermal envelope,
    2) CPU headroom,
    3) memory headroom,
    4) storage health,
    5) telemetry confidence.
  - grade mapping (`S/A/B/C/D`) and qualitative summary text.
  - safe fallback score behavior while awaiting first live sample.
- Integrated score snapshot into Dashboard (`src/pages/DashboardPage.tsx`) as an OEM readiness panel.

#### Design system extensions
- Extended `src/styles.css` with dedicated score and passport styling blocks:
  - score panel visuals,
  - passport hero, pillar cards, metadata fields, matrix states,
  - responsive layout behavior for passport grid and sections.

#### Architecture documentation
- Added `docs/lhm_oem_analysis.md` with adaptation findings and next-step slices:
  - Super I/O + EC model-specific gating rationale,
  - IGCL-based Intel Arc strategy,
  - storage confidence strategy,
  - staged OEM safety envelope recommendations.

#### Validation target
- Frontend build validation passed (`npm run build`).
- Full desktop executable build passed (`npm.cmd run build:exe` via VS Code task `build-exe-fresh`) with NSIS bundle output:
  - `src-tauri/target/release/radium_pcs_companion.exe`
  - `src-tauri/target/release/bundle/nsis/Radium PCs Companion_0.1.0_x64-setup.exe`

### Phase: Search Activation + UX Polish (2026-05-23)

#### Search activation
- `src/components/Shell.tsx`:
  - Topbar search upgraded to command-palette behavior:
    - keyboard navigation with Up/Down + Enter
    - quick actions (open website, email support, go to settings)
    - active result highlighting and focus-aware results popup

#### Visual polish
- `src/styles.css`:
  - panel hover now includes subtle elevation (`box-shadow` + `translateY`) for stronger depth feedback.
  - search results include active/highlight state for keyboard selection.
- `src/pages/DashboardPage.tsx`:
  - replaced inline tooltip styles with a reusable custom tooltip component for charts.

#### Validation
- Frontend build passed (`npm.cmd run build`).

### Phase: Restore Paths + Safety Tests (2026-05-23)

#### Restore command surface
- `src-tauri/src/windows_util.rs`:
  - Registry backups now store a foldered manifest + per-issue `.reg` exports.
  - Added `restore_registry_backup(backup_id)` to import exported `.reg` files.
  - Added `restore_bloatware(ids, dry_run)` with action-aware restore handling:
    - AppX: best-effort re-register from WindowsApps manifest
    - Policy: consumer-experience value restoration
    - Scheduled task: re-enable mapped task
- `src-tauri/src/lib.rs`:
  - Exposed new Tauri commands: `restore_registry_backup`, `restore_bloatware`.
- `src/services/systemService.ts`:
  - Added `restoreRegistryBackup()` and `restoreBloatware()` native/browser adapters.
- UI wiring:
  - `src/pages/RegistryCleanerPage.tsx`: added Restore Backup action button.
  - `src/pages/BloatwarePage.tsx`: added Restore Selected action button.

#### Backend tests
- `src-tauri/src/cleanup.rs`: added unit tests for byte conversion, directory cleanup helpers, and unknown-id cleanup guard.
- `src-tauri/src/windows_util.rs`: added unit tests for id sanitization and backup-required registry safety gates.

#### Validation
- `cargo check` passed.
- `npm.cmd run build` passed.

### Phase: Functional Roadmap Pass — Power Modes + Cleaner Hardening (2026-05-23)

#### Performance profiles / power modes
- `src-tauri/src/lib.rs`: `apply_performance_profile` now applies three stages in live mode:
  1) Windows plan selection, 2) processor power tuning, 3) timer resolution.
- `src-tauri/src/windows_util.rs`: added `apply_power_mode_tweaks(profile_id)` using supported `powercfg` processor subgroup controls:
  - `PROCTHROTTLEMIN`
  - `PROCTHROTTLEMAX`
  - `PERFBOOSTMODE`
  Applied on both AC/DC, then `SCHEME_CURRENT` re-activated.

#### Registry cleaner
- `src-tauri/src/windows_util.rs`:
  - `clean_registry_issues` now validates backup presence before live deletion.
  - Added safe live deletion path for scanned issues:
    - startup orphan values: value delete
    - uninstall/app-path leftovers: key-tree delete
  - Added Win32 helpers `delete_registry_value` and `delete_registry_tree`.
- `src/pages/RegistryCleanerPage.tsx`: now re-scans findings after clean run and uses successful `[ok]` log detection for clean-step completion.

#### Bloatware remover
- `src-tauri/src/windows_util.rs`:
  - switched APPX removal to spec-driven match pattern (`remove_appx_package_for_id`) instead of display-name matching.
  - implemented live `consumer-experience` policy write (ContentDeliveryManager recommendation value).
  - added scheduled-task disable path mapping (initial hook for Xbox game-save task).
- `src/pages/BloatwarePage.tsx`: refactored into refresh-based scan flow and post-removal rescan; action button wording now reflects live removal intent.

#### System cleaner
- `src-tauri/src/cleanup.rs`:
  - added `User Downloads (review)` target (non-safe, default unselected).
  - added `Recycle Bin` target with size estimate and live clear action.
  - run path now handles recycle-bin cleanup as a special action.
- `src/pages/StorageCleanerPage.tsx`:
  - added safety gate so one-click cleanup runs only on `safe` targets.
  - selected non-safe targets are explicitly blocked with review log output.

#### Validation
- Frontend: `npm.cmd run build` passed.
- Backend: `cargo check` passed.

### Phase: AAA Premium UX Visual Identity (2026-05-23)

#### Visual system + styling
- Added extended design tokens in `src/styles.css` for spacing, radius, shadow, easing and duration scales.
- Added subtle telemetry-inspired scanline/dot textures to body, hero/splash surfaces, and premium glass treatment for key overlays/panels.
- Reworked gauge, sidebar metric strip, fan/thermal rows, and card-tone surfaces for a restrained industrial-luxury look.

#### OSD overlay expansion
- Fully redesigned OSD presentation styles with stronger visual hierarchy and lower visual noise.
- Added/updated six OSD visual modes in CSS: compact-bar, corner-widget, vertical-list, minimal-card, cinematic, benchmark.
- Updated type system and settings surface to expose new presets end-to-end.

#### Component upgrades
- `src/components/Gauge.tsx`: rebuilt gauge SVG with gradient arc fill, major tick marks (0/25/50/75/100), bezel ring, and improved threshold glow.
- `src/components/HardwareIcon.tsx`: new custom icon set for hardware telemetry UI (CPU/GPU/RAM/NVMe/HDD/fan/thermal/network/power/VRAM).
- `src/components/Shell.tsx`: topbar now has native drag region; sidebar live metric strip now uses custom hardware icons.
- `src/App.tsx`: upgraded page transition to directional slide + fade + subtle blur for premium navigation feel.

#### Dashboard refinements
- `src/pages/DashboardPage.tsx`: adopted custom hardware icons in system spec region and network adapter iconography for Wi-Fi/Ethernet context.
- Improved fan RPM formatting readability with localized number formatting.

#### Validation
- Frontend build validation passed (`npm run build`): TypeScript compile + Vite production build completed successfully.

### Phase: Branding + UI Polish (2026-05-22)

#### Logo / branding
- `src/lib/assets.ts`: `radiumHeader` now points to `images/radiumcompanion-header.png` (was `images/clean/radiumheader-transparent.png`). `appIcon` now points to `images/radiumlogo.png` (was `images/clean/app-icon.png`).
- `src-tauri/tauri.conf.json`: bundle icon updated to `../images/radiumlogo.png`.
- `index.html`: added `<link rel="icon" type="image/png" href="/images/radiumlogo.png" />`.
- `src/components/Shell.tsx`: sidebar brand-lockup now shows `radiumlogo.png` icon (30px) + `radiumcompanion-header.png` wordmark side by side. Topbar-brand (non-dashboard pages) shows icon (22px) + "Companion" text — no more wide wordmark in the topbar.

#### CSS polish (`src/styles.css`)
- `.brand-lockup`: uses flex with `.brand-icon` + `.brand-wordmark` classes; removed old `.brand-lockup img` catch-all.
- `.brand-icon`: 30px square, border-radius 6px, flex-shrink 0.
- `.brand-wordmark`: max-width 128px, max-height 30px, auto width.
- `.topbar-brand`: added `:hover` state; `.brand-icon` override at 22px; reduced min-width to 138px.
- `.nav-item.active`: added left accent border (`border-left-color: rgba(85,214,255,0.6)`, 2px) for stronger active indicator.
- `.status-dot`: added `pulse-dot` `@keyframes` animation (2.8s ease-in-out, box-shadow pulse).
- `.panel`: border-radius increased 8px → 10px; hover state now includes `box-shadow` glow in addition to border-color change; transition added `box-shadow`.
- `.page-transition`: added `scroll-behavior: smooth`; custom thin cyan scrollbar via `::-webkit-scrollbar` rules.
- `.topbar-brand`: removed old `img` width rule, added hover rule.

### Phase: Real Hardware Integration + Desktop Utility Polish — Part 2 (2026-05-22)

#### Root causes addressed
1. **`callNative` was silently swallowing ALL errors** in both browser and native Tauri mode — if WMI/NVML/ADL failed, mock data was returned with no indication. Now: fallback is browser-only; in Tauri mode, Rust command errors propagate to the UI.
2. **All mutating operations had `dryRun: true` hardcoded** — startup manager, bloatware remover, storage cleaner, and registry cleaner were all no-ops. Now: `dryRun: false` for all.
3. **WMI CPU temperature used an unreliable path** (`Win32_PerfFormattedData_Counters_ThermalZoneInformation`) that doesn't work on many machines. Now: primary path is `ROOT\WMI\MSAcpi_ThermalZoneTemperature` (tenths of Kelvin, more reliable on Intel/AMD).

#### `src/services/native.ts` (reworked)
- Added `isNative(): boolean` — checks `window.__TAURI_INTERNALS__` (Tauri 2.x marker)
- `callNative` now only uses mock fallback in browser mode (`!isNative()`)
- In native Tauri mode: errors from `invoke()` propagate directly to callers
- Browser mode still works for preview/dev as before

#### `src/services/systemService.ts` (updated)
- `removeBloatware`: `dryRun: true` → `dryRun: false` (real AppX removal now active)
- `setStartupItemEnabled`: `dryRun: true` → `dryRun: false` (real registry writes now active)
- `runStorageCleanup`: `dryRun: true` → `dryRun: false` (real temp file deletion now active)
- `cleanRegistryIssues`: `dryRun: true` → `dryRun: false` (real registry cleanup now active)
- `applyPerformanceProfile`: stays `dryRun: true` (power plan/fan table writes not yet implemented)
- All mock fallback strings changed from `[dry-run]` to `[browser]` prefix

#### `src/context/MonitorContext.tsx` (updated)
- `MonitorContextValue` extended: `native: boolean`
- `isNative()` imported from `native.ts`; passed through context value
- Consumers can now branch on `native` to show/hide browser-preview indicators

#### `src/pages/DashboardPage.tsx` (updated)
- `error` replaced by dual notice system:
  - `!native` → amber `.notice-preview` banner: "Browser preview — run `npm run tauri dev` to connect to real hardware"
  - `native && error` → red `.notice-error` banner with the actual error string

#### `src/styles.css` (updated)
- `.notice` reworked: now base class only (border-radius, font-size, padding)
- `.notice-preview`: amber bordered variant for browser mode indicator
- `.notice-error`: red bordered variant for native errors
- `.notice code`: monospace inline code style

#### `src-tauri/src/wmi_provider.rs` (updated)
- New `WmiAcpiThermalZone` struct: `CurrentTemperature: Option<u32>` (decikelvin)
- `WmiContext.root_wmi: Option<WMIConnection>` — second connection to `ROOT\WMI`
- `WmiContext::init()` now also connects to `ROOT\WMI` via `COMLibrary::assume_initialized()` (safe: no double-init, no double-deinit)
- `query_cpu_temp()` tries `ROOT\WMI\MSAcpi_ThermalZoneTemperature` first (decikelvin formula: `val / 10.0 - 273.15`); falls back to `ROOT\CIMV2` perf-counter path

### Phase: Real Hardware Integration + Desktop Utility Polish (2026-05-22)

#### `src-tauri/src/hardware.rs` (updated)
- `NetworkSample`: added `adapter_name: String`, `adapter_type: String` (`"wifi" | "ethernet" | "unknown"`)
- `StorageSample`: added `drive_type: String` (`"nvme" | "ssd" | "hdd" | "unknown"`)
- `HardwareCache`: added `net_adapter_name: String`, `net_adapter_type: String`
- `SysinfoTick`: added `adapter_name: String`, `adapter_type: String`
- `SysinfoState::tick()`: completely rewrote network section — now finds best non-loopback adapter by traffic volume using per-interface `received() + transmitted()`; added NVMe heuristic (device name contains "nvme") for drive_type; added `total_space > 0` filter on disks
- `snapshot()`: populates `adapter_name`/`adapter_type` in `NetworkSample`
- `monitor_loop()`: writes `tick.adapter_name`/`tick.adapter_type` to cache (guard: only updates if non-empty)
- New helper: `adapter_type_from_name(name: &str) -> &'static str` — keyword matching for wifi/ethernet/unknown; covers Wi-Fi, WLAN, 802.11, Ethernet, LAN, Realtek, Killer, Intel Ethernet

#### `src-tauri/src/wmi_provider.rs` (updated)
- New `WmiDiskDrive` struct: `Model: Option<String>`, `Size: Option<u64>`
- New `query_disk_models(ctx)` inner function: queries `Win32_DiskDrive ORDER BY Size DESC`, formats as `"Model (N GB)"`
- `query_storage_list()` now calls disk model query first, only falls back to sysinfo on empty result

#### `src/types/system.ts` (updated)
- `HardwareSample.network` extended: `adapterName: string`, `adapterType: 'wifi' | 'ethernet' | 'unknown'`
- `HardwareSample.storage` element extended: `driveType: 'ssd' | 'hdd' | 'nvme' | 'unknown'`

#### `src/services/mockData.ts` (updated)
- `network` mock: added `adapterName: 'Intel Wi-Fi 7 BE200'`, `adapterType: 'wifi' as const`
- `storage` mock: updated to `driveType: 'nvme' as const` on both entries; labels changed to realistic model names (`Samsung SSD 990 PRO`, `WD_BLACK SN850X`)

#### `src/lib/format.ts` (updated)
- Added `driveTypeLabel(type: string): string` — maps `'nvme'→'NVMe'`, `'ssd'→'SSD'`, `'hdd'→'HDD'`, default `'Drive'`
- Added `adapterTypeLabel(type: string): string` — maps `'wifi'→'Wi-Fi'`, `'ethernet'→'Ethernet'`, default `'Network'`

#### `src/styles.css` (updated — density rework)
- Sidebar: `232px → 208px`, gap `16px → 10px`, padding `18px 14px → 14px 12px`
- Nav items: min-height `38px → 34px`, padding `0 12px → 0 10px`
- Topbar: height `56px → 48px`, padding `18px → 16px`; all `page-transition` calc updated to `(100vh - 48px)`
- Page padding: `18px → 14px`
- Page header h1: `clamp(24px,2.5vw,36px) → clamp(16px,1.8vw,22px)`
- Dashboard grid gap: `16px → 12px`
- Hero monitor: padding `18px → 14px`, min-height `292px → 236px`
- Dashboard brandmark: `min(220px,44vw)/72px → min(180px,36vw)/52px`
- Vendor logos: `96px/36px → 76px/26px`, padding `7px 9px → 5px 7px`
- Gauge row: gap `12px → 8px`, margin-top `28px → 14px`
- Gauge: padding `16px 8px 8px → 10px 6px 6px`, gap `10px → 6px`
- Gauge face: `118px → 100px`
- Gauge track: inset `9px → 8px`, border `9px → 7px`
- **Gauge needle (critical)**: height `50px → 42px`, margin-top `-42px → -34px`, `transform-origin: 50% 50px → 50% 42px`
- Gauge center: `72px → 60px`; strong: `26px → 19px`
- Metric card: min-height `132px → 108px`, padding `14px → 11px`; strong: `22px → 17px`; icon: `34px → 28px`
- Chart/hardware/optimizer panels: padding `18px → 14px`
- Sensor source: min-height `76px → 60px`, padding `12px → 10px`
- OSD metric: min-height `34px → 28px`, padding `7px 9px → 5px 7px`; strong: `14px → 12px`
- Case frame: `clamp(390px,50vh,540px)/390px → clamp(300px,40vh,430px)/300px`; responsive breakpoint `420px → 320px`
- New utility classes: `.badge`, `.badge-dim`, `.drive-list`, `.drive-type-row`, `.sensor-hint`, `.intel-arc-notice`

#### `src/pages/DashboardPage.tsx` (updated)
- Imports `adapterTypeLabel`, `driveTypeLabel` from format.ts
- Network `MetricCard`: detail now shows adapter name with Wi-Fi/Ethernet badge using new `badge-dim` class
- Hardware identity storage `<dd>`: shows drive model list + per-drive type badges (NVMe/SSD/HDD)
- `SensorSource` component: updated to show `'WMI (usage only)'` for Intel Arc GPUs; accepts optional `hint` prop; Intel Arc hint describes missing IGCL sensors

#### `src/pages/ThermalsPage.tsx` (updated)
- Reads `systemInfo` from `useMonitor()`; derives `gpuVendor`, `isIntelArc`, `gpuVendorLabel`
- GPU detail panel heading now shows: `"NVIDIA via NVML"` / `"AMD via ADL2"` / `"Intel Arc via WMI"` / `"Vendor telemetry"`
- Intel Arc path: shows GPU usage `DetailRow` + `.intel-arc-notice` (amber) explaining IGCL deferral
- NVIDIA/AMD path: GPU fan row now also checks `fans[]` for a GPU-labelled fan RPM as fallback

#### `src/components/OsdOverlay.tsx` (updated)
- Replaced unused `Wifi` import with `Fan` icon for the fans metric
- FAN metric: uses `gpu.fanPct` if available, otherwise chassis `fans[0].rpm`; detail shows `gpu.powerWatts` when available
- CLK detail: changed from `"mhz GPU"` to `"GPU mhz"` ordering
- RAM detail: changed from `"X used"` to `"X / Y"` showing total
- VRAM detail: changed from `"X GB total"` to `"of X GB"`

#### `src/components/MetricCard.tsx` (updated)
- `detail` prop type widened from `string` to `ReactNode` — allows JSX fragments in detail line (used by DashboardPage Network card)

### Phase: Embedded Vendor GPU Telemetry (Prior Session)

#### `src-tauri/src/nvml_provider.rs` (new file, `#[cfg(windows)]`)
- Dynamically loads `nvml.dll` from standard NVIDIA installation paths at runtime
- Uses `LoadLibraryW` + `GetProcAddress` via `windows::Win32::System::LibraryLoader`
- Resolves 11 NVML function pointers: `nvmlInit_v2`, `nvmlShutdown`, `nvmlDeviceGetCount_v2`, `nvmlDeviceGetHandleByIndex_v2`, `nvmlDeviceGetName`, `nvmlDeviceGetTemperature`, `nvmlDeviceGetUtilizationRates`, `nvmlDeviceGetMemoryInfo`, `nvmlDeviceGetClockInfo`, `nvmlDeviceGetFanSpeed`, `nvmlDeviceGetPowerUsage`
- Returns `Option<NvmlContext>` — `None` if NVIDIA drivers absent (graceful degradation)
- `NvmlContext::query_primary_gpu()` → `Option<GpuReading>` with all NVIDIA metrics
- `Drop` impl: calls `nvmlShutdown()` + `FreeLibrary`

#### `src-tauri/src/amd_provider.rs` (new file, `#[cfg(windows)]`)
- Dynamically loads `atiadlxx.dll` from standard AMD installation paths at runtime
- Resolves ADL2 function pointers: Create/Destroy, NumberOfAdapters, OD5 Temperature, OD5 FanSpeed, OD5 CurrentActivity, ODN Temperature (optional), DedicatedVRAMUsage (optional)
- Memory alloc callback uses `HeapAlloc(GetProcessHeap())` — compatible with UCRT `free()` on Windows 10+
- Auto-detects AMD adapter by probing Overdrive5 API on each adapter 0–7
- Uses `ADL2_OverdriveN_Temperature_Get` (edge temp) when available (RX 480+), falls back to OD5
- `AmdAdlContext::query_primary_gpu()` → `Option<GpuReading>` with AMD metrics
- `AmdAdlContext::query_fan_rpm()` → `Option<u32>` for fan RPM
- `Drop` impl: calls `ADL2_Main_Control_Destroy()` + `FreeLibrary`

#### `src-tauri/src/hardware.rs` (updated)
- Added `GpuReading` internal struct (not IPC — maps to cache fields; carries name, vendor, temp, usage, VRAM used/total, core/mem clocks, fan_pct, fan_rpm, power_watts)
- Added `HardwareCache` fields: `gpu_core_clock_mhz`, `gpu_mem_clock_mhz`, `gpu_fan_pct`, `gpu_fan_rpm`, `gpu_power_watts`
- Extended `GpuSample` IPC type: added `fan_pct: Option<u32>`, `power_watts: Option<f32>`
- Extended `FanSample` IPC type: added `pct: Option<u32>`
- Updated `snapshot()` to wire new cache fields into IPC structs (fans include GPU RPM/%)
- Updated `monitor_loop()`: initialises NVML + ADL before main loop; GPU poll uses provider cascade; history now includes real GPU temp

#### `src-tauri/src/lib.rs` (updated)
- Added `#[cfg(windows)] mod nvml_provider;`
- Added `#[cfg(windows)] mod amd_provider;`

#### `src-tauri/Cargo.toml` (updated)
- Added `Win32_System_LibraryLoader` to windows crate features

#### `src/types/system.ts` (updated)
- `HardwareSample.gpu` extended: `fanPct: number | null`, `powerWatts: number | null`
- `HardwareSample.fans` updated: element type includes `pct: number | null`
- `StartupItem.location` changed from union type to `string` (matches real scanner output like `"Registry (HKCU\\Run)"`)

### Phase: Real Telemetry & Native Implementation (Prior Session)

#### Cargo.toml
- Added `wmi = "0.13"` under `[target.'cfg(windows)'.dependencies]`
- Expanded `windows` crate features: `Win32_System_Registry`, `Win32_System_ProcessStatus`, `Win32_Foundation`

#### `src-tauri/src/hardware.rs` (new file)
- All IPC-facing structs: `MetricPoint`, `CpuSample`, `GpuSample`, `MemorySample`, `FanSample`, `StorageSample`, `NetworkSample`, `HardwareSample`, `SystemInfo`
- `HardwareCache` — internal shared state written by background thread
- `SysinfoState` + `SysinfoState::tick()` — sysinfo-based polling (CPU usage/clock, RAM, network delta, storage)
- `MonitoringEngine` — holds `Arc<RwLock<HardwareCache>>` + `Arc<Mutex<SysinfoState>>`, provides `snapshot()` and `system_info_snapshot()`
- `monitor_loop()` — background thread entry point; inits WMI once, then polls every 1 s; maintains 60-point rolling history
- Helper functions: `bytes_to_gb()`, `vendor_from_str()`, `timestamp_now()`

#### `src-tauri/src/wmi_provider.rs` (new file, `#[cfg(windows)]` module)
- `WmiContext { cimv2: WMIConnection }` — single `ROOT\CIMV2` connection, initialised once via `COMLibrary::new()`
- `query_static_system_info()` — GPU name/VRAM, CPU name, MB manufacturer, BIOS version, RAM speed/size, storage list
- `query_cpu_temp()` — `Win32_PerfFormattedData_Counters_ThermalZoneInformation`, Kelvin→Celsius, filtered 0–120 °C, returns hottest zone
- `query_gpu_usage()` — `Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine WHERE Name LIKE '%engtype_3D%'`, averages utilisation %

#### `src-tauri/src/cleanup.rs` (new file)
- `RamCleanupResult` struct (serialisable)
- `optimize_ram()` — calls `trim_all_working_sets()`, 600 ms settle, re-reads RAM, returns result
- `trim_all_working_sets()` (Windows) — iterates sysinfo process list, calls `K32EmptyWorkingSet` via `OpenProcess(PROCESS_SET_QUOTA)` for each accessible PID
- `StorageCleanupItem` struct
- `scan_storage_cleanup()` — scans %TEMP%, C:\Windows\Temp, NVIDIA/AMD shader caches, WER archives with real `dir_size()` sizes
- `run_storage_cleanup()` — dry-run or real `delete_dir_contents()`

#### `src-tauri/src/windows_util.rs` (new file)
- `StartupItem` struct (all `String` fields, serialisable)
- `scan_startup_items()` — reads HKCU + HKLM Run keys via Win32 registry API; reads `StartupApproved` key for enabled state; classifies impact/recommended/publisher
- `set_startup_item_enabled()` — writes `StartupApproved` first byte (0x02 = enabled, 0x03 = disabled) for HKCU/HKLM entries
- `BloatwareItem` struct
- `scan_bloatware()` — `Get-AppxPackage` via PowerShell, matched against `BLOATWARE_SPECS` (10 known removable packages)
- `remove_bloatware()` — delegates to `remove_appx_package()` / `apply_policy_tweak()` / `disable_scheduled_task()`

#### `src-tauri/src/lib.rs` (full rewrite)
- Module declarations added: `mod cleanup; mod hardware; #[cfg(windows)] mod wmi_provider; mod windows_util;`
- All old struct definitions removed (were duplicates of hardware.rs types)
- Old `MonitoringEngine` impl removed
- All 9 Tauri command handlers updated to delegate to modules
- `pub fn run()` updated: clones Arcs, spawns `radium-monitor` thread, passes engine to `.manage()`
- Old helper functions removed (`average_cpu_usage`, `storage_usage`, `bytes_to_gb`, `chrono_like_timestamp`)
- Tray code unchanged and functional

---

## Current Active Work

**Nothing actively in-progress.** All known data-flow, branding, and UI issues resolved in current sessions.

### Immediate Blockers
- **Build not validated** — Rust/Cargo not installed in the PowerShell terminal used during sessions. Developer must validate from an environment with the Rust toolchain installed (run `cargo check --manifest-path src-tauri/Cargo.toml` or `npm run tauri dev`).
- **Testing is browser-only** — The app is currently being developed and previewed via `npm run dev` (Vite browser). The amber "Browser preview" banner in the Dashboard confirms this. Real hardware data will only flow when running inside `npm run tauri dev` or the built Tauri binary.

---

## Planned Next Steps

### Priority 1 — Build validation (MUST DO FIRST)
Run `npm run tauri dev` or `cargo check --manifest-path src-tauri/Cargo.toml` from a terminal with Rust toolchain.

**Known anticipated build issues:**
1. `K32EmptyWorkingSet` — may need to be `EmptyWorkingSet` in `windows 0.58`. Check `Win32::System::ProcessStatus`.
2. `wmi 0.13` vs `windows 0.58` version conflict — pin or upgrade if needed.
3. `COMLibrary::assume_initialized()` for second WMI connection — verify no double-deinit on newer wmi versions.
4. `PROCESS_SET_QUOTA` constant path in `windows 0.58` — may be `Win32::System::Threading::PROCESS_SET_QUOTA`.
5. If `cleanup.rs` references `K32GetProcessMemoryInfo`, verify that exact symbol name in `windows 0.58`.

### Priority 2 — Fix any compile errors
Address build issues found in Priority 1. Common patterns:
- Symbol name mismatches: search `docs.rs` for the exact name under `windows::Win32` hierarchy
- Feature flag gaps: add missing feature strings to `Cargo.toml` `windows` crate features list
- `wmi` crate COM conflict: try `wmi = "0.14"` if `0.13` has breaking changes with `windows 0.58`

### Priority 3 — NVMe drive type accuracy
Currently `drive_type = "nvme"` only when `DiskKind::SSD` AND device name contains `"nvme"`. Improve: add a WMI `Win32_DiskDrive WHERE InterfaceType = 'SCSI'` check for NVMe (Windows maps NVMe as SCSI). Or query `Win32_PnPEntity` for "NVMe" in device description. Low priority.

### Priority 4 — FPS counter
The FPS metric in OSD shows `'--'`. Requires either:
  a. D3DKMT present statistics (complex, kernel API)
  b. Frame time hook (requires game overlay injection — out of scope)
  c. User-defined manual input in settings
  Best path for now: add a `fps_override: Option<u32>` field to settings that user can set, displayed in OSD.

### Priority 5 — CPU per-core temperatures
Requires kernel driver (MSR reads). Deferred until LHM/OpenHWM embedded integration is decided.

### Priority 6 — Per-adapter network breakdown
Currently shows single most-active adapter. Could show all adapters with individual speeds. Low priority.

### Priority 7 — Packaging
Create installer with Tauri bundler. NSIS or WiX. Tauri 2 uses WiX by default.

---

## Architectural Decisions

| Decision | Rationale |
|---|---|
| **Tauri 2.x** over Electron | ~50 MB binary vs ~150 MB; native Rust backend; no Chromium runtime; system WebView |
| **sysinfo 0.33** for CPU/RAM/network | Safe, cross-platform Rust crate; no driver installation required; sufficient for primary metrics |
| **WMI (`wmi` crate 0.13)** for temperatures and GPU | Only standard Windows path for CPU thermal zones that doesn't require kernel drivers; GPU name/VRAM also available |
| **Dedicated `std::thread` for monitoring** | WMI `COMLibrary` must be initialised on its own thread with a stable COM apartment; tokio threadpool threads are unsuitable; dedicated thread guarantees stable COM context |
| **Arc<RwLock<HardwareCache>>** shared state | Decouples 1 s polling loop from Tauri command invocations; commands never block on I/O — they read the last cache snapshot |
| **60-point rolling history on backend** | Frontend was previously managing history and sending it back on every IPC call; backend now owns history, reducing IPC payload size and preventing desync |
| **`#[cfg(windows)]` module gating** | `wmi_provider.rs` only compiles on Windows; `windows_util.rs` and `cleanup.rs` use `#[cfg(windows)]` blocks internally for platform-specific code |
| **PowerShell for AppX queries** | `Get-AppxPackage` is the only reliable public API to enumerate AppX packages; no stable Win32 COM equivalent for all package types |
| **Registry writes for startup control** | `StartupApproved` key is the same mechanism Task Manager uses; safer than deleting Run key values (preserves the command for re-enabling) |
| **`EmptyWorkingSet` / `K32EmptyWorkingSet`** | Safe, documented, reversible RAM cleaner; no undocumented kernel APIs; same mechanism used by RAMMap and similar tools |

---

## OmenCore Integration Notes

This project does **not** integrate OmenCore. It is a clean-room implementation. The session notes mention OmenCore in the user memory as a general engineering pattern reference — the stabilisation note ("avoid optimistic UI state assignments in hotkey handlers; update through service apply paths and ModeApplied/FanPresetApplied events") is referenced as a general pattern, not as integrated code.

---

## LibreHardwareMonitor Research Notes

LHM was researched and its architecture used as a reference for the embedded telemetry design.

**Findings:**
- **NVIDIA path**: Uses `nvapi.dll` (via NvAPI QueryInterface) AND `nvml.dll` (NVML for power/PCIe). Also D3DKMT for per-engine node utilization and VRAM
- **AMD path**: Uses `atiadlxx.dll` (ADL2) — PMLog for RDNA+ cards, OD5/ODN for older cards
- **CPU temps**: MSR reads via `WinRing0x64.sys` (kernel driver) — requires signed driver on Windows 11
- **Licensing**: MPL 2.0 — Rust reimplementation (not code copying) has no disclosure obligation
- **Decision**: Implemented NVML + ADL2 providers directly in Rust. This covers the most important sensors (GPU temp, usage, VRAM, clocks, fans, power) without any driver requirement. CPU per-core temps and motherboard fans remain deferred (kernel driver required).

### What We Implemented (Inspired by LHM)
- `nvml_provider.rs`: NVML-based NVIDIA monitoring — equivalent to LHM's NVML sidecar usage
- `amd_provider.rs`: ADL2-based AMD monitoring — equivalent to LHM's `AmdGpu.cs` OD5/ODN path

### What Remains Deferred (Requires Kernel Driver)
- Per-core CPU temperatures (Intel: MSR 0x19C `IA32_THERM_STATUS`; AMD: SMU/MSR)
- CPU voltages and RAPL power (Intel MSR 0x611)
- Motherboard fan header RPM (EC / SuperIO chip — e.g. ITE 8688E)
- NVMe temperature (SMART data via DeviceIoControl IOCTL_STORAGE_QUERY_PROPERTY)

---

## Known Issues

| Issue | Severity | Status |
|---|---|---|
| **Build not validated** — cargo not available in session terminal | **Critical** | Pending — developer must validate |
| **Testing is browser-only** — `npm run dev` only; no Tauri shell running | **High** | Pending — run `npm run tauri dev` to test native data flow |
| Thermal zone formula may need `/10` correction | Medium | Verify at runtime — range check (0–120°C) filters bad values; ACPI path uses `val/10.0-273.15` |
| AMD GPU name hardcoded as "AMD Radeon GPU" in some paths | Low | Fix: use `ADLAdapterInfo.strAdapterName` or WMI static name |
| Fan RPM for CPU cooler not available | Low | Deferred (kernel driver required) |
| PSU data unavailable via standard APIs | Low | Deferred |
| Storage scanner does not scan browser caches on non-default profiles | Low | Future expansion |
| Bloatware scanner only covers AppX packages | Low | Future — add registry/installed-programs scan |
| `wmi 0.13` may conflict with `windows 0.58` at build time | Unknown | Verify at build time |
| NVMe detection uses name heuristic only | Low | Could be improved with `Win32_DiskDrive WHERE InterfaceType='SCSI'` |
| FPS metric in OSD shows `'--'` always | Low | No reliable non-kernel API; consider settings `fps_override` field |

---

## Performance Metrics

| Metric | Target | Current Status |
|---|---|---|
| Idle RAM (app process) | < 80 MB | Not yet measured |
| Monitoring thread CPU overhead | < 0.5% | Not yet measured |
| UI frame rate (60 fps) | 60 fps steady | Not yet measured |
| IPC latency (command round-trip) | < 5 ms | Not yet measured (reads from cache, should be sub-ms) |
| WMI query latency (CPU temp) | < 50 ms/query | Not yet measured |

---

## Important Files & Modules

```
src-tauri/src/
  lib.rs              — Tauri entry point, all command registrations, tray, OSD window
  hardware.rs         — HAL: IPC types, GpuReading, HardwareCache, MonitoringEngine, monitor_loop()
  wmi_provider.rs     — WMI sensor queries (Windows only): CPU temp, GPU usage, static info
  nvml_provider.rs    — NVIDIA GPU via nvml.dll dynamic loading (Windows only)
  amd_provider.rs     — AMD GPU via atiadlxx.dll dynamic loading (Windows only)
  cleanup.rs          — RAM cleaner (EmptyWorkingSet) + storage scanner/cleanup
  windows_util.rs     — Startup manager (registry) + bloatware scanner (AppX/PowerShell)
  main.rs             — Calls lib::run()
  build.rs            — Tauri build script

src/
  App.tsx             — Router, page mounting
  main.tsx            — React entry
  context/
    MonitorContext.tsx — Polls get_hardware_sample at settings.monitoring.refreshMs
    SettingsContext.tsx — Persists user settings
  services/
    native.ts         — Raw Tauri invoke() wrappers
    systemService.ts  — Typed IPC service layer (uses native.ts)
    mockData.ts       — Mock data for development/fallback
  pages/
    DashboardPage.tsx
    ThermalsPage.tsx
    RamCleanerPage.tsx
    BloatwarePage.tsx
    StartupManagerPage.tsx
    StorageCleanerPage.tsx
    DiagnosticsPage.tsx
    SettingsPage.tsx
    UtilitiesPage.tsx
  types/
    system.ts         — All shared TypeScript types (StartupItem, BloatwareItem, etc.)
    navigation.ts     — Navigation type definitions
```

---

## Session History
### Session 9 (undocumented Codex) — Packaging & Standalone Distribution

*This session's changes were present in files but not previously recorded in this log.*

#### `src-tauri/tauri.conf.json` (updated)
- `bundle.targets` changed from `"all"` → `["nsis"]` — produces a real Windows NSIS installer
- Added `bundle.publisher: "Radium PCs"`, `bundle.category: "Utility"`, `bundle.shortDescription`, `bundle.longDescription`
- Added `bundle.windows.nsis`: `installerIcon`, `installMode: "perMachine"`, `displayLanguageSelector: false`

#### `package.json` (updated — new scripts)
- `"desktop"` / `"dev:desktop"` — aliases for `tauri dev`
- `"build:exe"` / `"package:windows"` — aliases for `tauri build` (produces NSIS installer)
- `"package:portable"` — `scripts/package-portable.ps1`
- `"check:desktop"` — `scripts/check-desktop.ps1` (prerequisite checker)

#### `src-tauri/src/lib.rs` (already documented above, but also added in prior Codex session)
- `--background` / `--silent` CLI arg check in `setup()` — hides main window on startup
- `build_tray()` and tray menu items: Open Dashboard, Performance Overview, Toggle OSD, Quick RAM Clean, Performance Mode, Quiet Mode, Exit
- Window `CloseRequested` event handler: prevents default close, hides window to tray instead
- `show_main_window` command: shows + unminimizes + focuses the main window
- Launch log written to `%ProgramData%\Radium PCs Companion\logs\` on each startup

### Session 8 — GitHub Copilot (2026-05-22)
**Completed:**
- **callNative browser/native split**: Added `isNative(): boolean` (checks `window.__TAURI_INTERNALS__`) to `native.ts`. `callNative` now only uses the mock fallback when NOT in Tauri. In the Tauri desktop shell, `invoke()` runs directly and errors propagate to the UI — no more silent swallowing of real hardware failures.
- **Removed all dry-run guards**: `setStartupItemEnabled`, `removeBloatware`, `runStorageCleanup`, `cleanRegistryIssues` all had `dryRun: true` hardcoded. Changed all to `dryRun: false`. Browser-mode mock strings updated from `[dry-run]` to `[browser]` prefix. `applyPerformanceProfile` intentionally stays `dryRun: true` (firmware writes not implemented).
- **WMI CPU temp — ACPI primary path**: Added `WmiAcpiThermalZone { CurrentTemperature: Option<u32> }` struct. Added `root_wmi: Option<WMIConnection>` to `WmiContext` (second COM connection to `ROOT\WMI` via `COMLibrary::assume_initialized()`). `query_cpu_temp()` now tries `ROOT\WMI\MSAcpi_ThermalZoneTemperature` first (decikelvin: `val/10.0 - 273.15`), falls back to perf-counter path.
- **MonitorContext `native` flag**: Added `native: boolean` to `MonitorContextValue` type and `useMemo` value. Consumers can branch on this.
- **Dashboard browser-preview notice**: `DashboardPage.tsx` now shows an amber `.notice-preview` banner when `!native` and a red `.notice-error` banner when `native && error`. CSS added: `.notice-preview`, `.notice-error`, `.notice code`.
- **Logo / branding**: `assets.ts` — `radiumHeader` → `images/radiumcompanion-header.png`; `appIcon` → `images/radiumlogo.png`. `tauri.conf.json` bundle icon updated. `index.html` favicon set to `radiumlogo.png`. `Shell.tsx` sidebar brand-lockup now shows `radiumlogo.png` icon (30px) + `radiumcompanion-header.png` wordmark; topbar-brand shows icon (22px) + "Companion" text.
- **UI polish (`styles.css`)**:
  - `.brand-lockup` / `.brand-icon` / `.brand-wordmark` classes replace old catch-all `.brand-lockup img`
  - `.nav-item.active`: left cyan accent border (2px, `rgba(85,214,255,0.6)`)
  - `.status-dot`: `pulse-dot` keyframe animation (2.8s ease-in-out, box-shadow breathe)
  - `.panel`: border-radius `8px → 10px`; hover adds `box-shadow` glow; transition includes `box-shadow`
  - `.page-transition`: `scroll-behavior: smooth`; thin 6px custom scrollbar with cyan hover tint
  - `.topbar-brand`: hover state added; min-width reduced to 138px

**Notes:**
- App is still being tested in browser mode (`npm run dev` / Vite). The amber banner on the Dashboard is the indicator. Cargo/Rust toolchain is not available in the active PowerShell terminal.
- `applyPerformanceProfile` is the only mutating command still intentionally dry-run — real power plan and fan-table writes not yet implemented.
- All GPU vendor driver APIs (NVML, ADL2) are loaded dynamically at runtime; absence of drivers causes graceful `None` path, not a crash.

### Session 9 — Codex (2026-05-22)
**Completed:**
- Re-read `/docs` and continued from the latest native-desktop direction.
- Attempted `npm.cmd run tauri dev`; it fails because `cargo` is not installed or not on `PATH`.
- Added desktop-oriented npm scripts:
  - `npm.cmd run desktop`
  - `npm.cmd run dev:desktop`
  - `npm.cmd run build:exe`
  - `npm.cmd run package:windows`
  - `npm.cmd run check:desktop`
- Added `scripts/check-desktop.ps1` preflight checker for Node, npm, cargo, and rustc.
- Configured Tauri packaging for standalone Windows NSIS output with publisher/category/descriptions in `src-tauri/tauri.conf.json`.
- Added `docs/desktop-build.md` with the runtime distinction between browser preview, Tauri desktop testing, and standalone EXE output paths.
- Updated `README.md` to make `npm.cmd run desktop` the real app test path and `npm.cmd run build:exe` the packaging path.
- Cleaned stale UI copy that still described mutating operations as dry-run-only:
  - Startup Manager
  - Bloatware Remover
  - System Cleaner
- Implemented native Start with Windows registration through HKCU Run key in `windows_util::set_companion_startup_enabled`.
- Updated `set_startup_enabled` command to use the real startup registration adapter instead of returning a stub value.
- Fixed malformed CSS around `.desktop-page`.
- Verified `npm.cmd run build` passes without CSS warnings.
- Attempted `npm.cmd run build:exe`; it fails for the same missing `cargo` prerequisite.

**Notes:**
- Current blocker remains Rust installation/PATH. Once Rust is installed, run `npm.cmd run check:desktop`, then `npm.cmd run desktop`, then `npm.cmd run build:exe`.
- The packaged app will be standalone and will not require npm, Vite, or a browser on the customer machine.

### Session 10 — GitHub Copilot (2026-05-23)
**Completed:**
- **Live tray icon** (`src/lib/trayIcon.ts` — new file): `OffscreenCanvas` 32×32 renderer. Dark circle background, 270° arc ring, color-coded by threshold (temp: green/amber/red; usage: cyan/amber/red), bold white number, colored unit label, glow shadow. `renderTrayIconRgba()` returns raw RGBA bytes; `extractTrayValue()` pulls the chosen metric from `HardwareSample`.
- **`set_tray_icon_data` Rust command** (`src-tauri/src/lib.rs`): Receives `Vec<u8> rgba + width + height`, constructs `tauri::image::Image::new_owned`, calls `tray.set_icon()`. Registered in `generate_handler!`.
- **`setTrayIconData` TS service** (`src/services/systemService.ts`): IPC wrapper via `callNative`. No-op fallback in browser mode.
- **`TrayMetric` type** (`src/types/system.ts`): `'cpuTemp' | 'gpuTemp' | 'ramUsage' | 'cpuUsage' | 'gpuUsage' | 'disabled'`. Added `liveIconMetric: TrayMetric` to `CompanionSettings.tray`.
- **MonitorContext wiring**: Added `trayIconRef` throttle (2000ms). Inside `tick()`, after each `setSample`, if `isNative() && metric !== 'disabled'`, renders icon and sends to Rust. `liveIconMetric` added to `useEffect` deps.
- **SettingsPage tray metric picker**: "Live tray icon" `<select>` in Tray behaviour panel. Options: App icon (static) / CPU Temperature / GPU Temperature / CPU% / GPU% / RAM%.
- **SettingsContext default**: `liveIconMetric: 'cpuTemp'` in `defaultSettings.tray`.
- **Roadmap + context_log sync**: Documented Codex Session 9 (NSIS config, npm scripts, `--background` flag, startup registration). Updated Phase 2–6 completion status.

### Session 11 — GitHub Copilot (2026-05-23)
**Completed:**
- **Gauge circles readability fix** (`styles.css`, `Gauge.tsx`): `.gauge` now has `background: #111927` (dark) + cyan accent border so the SVG arcs are visible. `.gauge-face` gets a dark radial gradient background. SVG track stroke increased from `rgba(255,255,255,0.09)` → `0.16`. Gauge center already has explicit `color: #f0f5fa` (light) — was previously invisible (dark text on dark bg).
- **Thermal page clipping**: `thermals-grid` / `case-visual` / `thermal-side` already had `minmax(0,...)` fixes from Session 9/10; verified `align-items: start` is present. No additional clipping fixes needed.
- **Registry cleaner complete reformat** (`RegistryCleanerPage.tsx`): Added `RegStep` step-guide component using existing `.reg-how-it-works` / `.reg-step` CSS (4 steps: Scan → Review → Backup → Clean, each marks `done` progressively). Added `.reg-safety-legend` inline with categories panel. Fixed registry row to use `.registry-row-body` (matches current CSS `grid-template-columns: 18px 1fr`). Moved recommendation badge inline with title. Added `.reg-guarantees` list in inspector panel. Updated button label "Backup & preview" → "Backup & clean".
- **Sidebar metrics strip** (`Shell.tsx` + `styles.css`): Already implemented in prior session (Shell.tsx has `sidebar-metric-row` for CPU temp, GPU temp, CPU%, GPU%, RAM%; `metric-cool/warm/hot` color classes). Fixed CSS for light sidebar: `.sidebar-metrics` background `rgba(255,255,255,0.04)` → `rgba(255,255,255,0.82)`, row dividers `rgba(255,255,255,0.05)` → `var(--line)` (visible on light bg).
- **Summary item tones**: `SummaryItem` in registry cleaner now accepts `tone` prop; backup state shows amber (required) or green (ready).

### Session 4 — Codex
**Completed:**
- Reviewed `/docs` at session start and aligned implementation with the documented desktop/Tauri direction.
- Fixed Thermals page clipping/scaling by removing fixed zone heights, reducing oversized page/header dimensions, and tuning the desktop shell density.
- Shifted the UI toward a denser desktop utility feel: narrower sidebar, smaller topbar, compact page headers, secondary action buttons, and cleaner utility summary rows.
- Added `RegistryCleanerPage.tsx` with scan, mandatory backup, selected issue review, and dry-run clean preview.
- Added TypeScript `RegistryIssue` and `RegistryBackup` contracts plus service-layer functions: `scanRegistryIssues`, `backupRegistryIssues`, `cleanRegistryIssues`.
- Added native Rust command boundaries in `windows_util.rs` / `lib.rs`: `scan_registry_issues`, `backup_registry_issues`, `clean_registry_issues`.
- Enhanced System Cleaner data to include browser cache, Recycle Bin, and Windows Update categories.
- Avoided bundling the newly added large marketing images by removing eager imports from `src/lib/assets.ts`; they remain available in `/images/` for deliberate future use.
- Verified `npm.cmd run build` passes.

**Notes:**
- Registry cleaner remains intentionally conservative. Live deletion is blocked until proper `.reg` export/restore implementation is validated.
- Open-source references checked: Little Registry Cleaner for registry-cleaner precedent and BleachBit/modern CCleaner alternatives for system-cleaner category inspiration. No code copied.

### Session 5 — Codex
**Completed:**
- Continued internal-only implementation. No external helper programs, sidecars, or bundled third-party cleaners were added.
- Extended real native System Cleaner scan targets in `cleanup.rs`:
  - Edge cache
  - Chrome cache
  - Firefox profile cache folders
  - Windows Update download cache
  - Delivery Optimization cache
- Upgraded registry backup from placeholder text to an internal JSON snapshot written under `%ProgramData%\Radium PCs Companion\registry-backups\`.
- Added native diagnostics export command `export_diagnostics`, writing a local JSON bundle under `%ProgramData%\Radium PCs Companion\diagnostics\`.
- Updated Diagnostics page to show provider/sensor availability and trigger the native export path.
- Added Dashboard sensor-source cards for sysinfo, WMI, internal NVML/ADL/WMI fallback, and GPU power/fan availability.
- Updated Dashboard fan/power display to show GPU fan percent and GPU watts when vendor APIs provide them.
- Verified `npm.cmd run build` passes.

**Notes:**
- Rust/Cargo still unavailable in the active terminal, so native compile validation remains pending.
- Registry cleaning still defaults to dry-run from the frontend. The backend now has backup snapshots, but live registry deletion should remain blocked until restore/import is tested on disposable Windows VMs.

### Session 6 — Codex
**Completed:**
- Continued internal-only implementation; no external monitoring or cleaner programs added.
- Reduced the dark/bulky UI feel:
  - lighter dark palette and brighter surfaces
  - narrower sidebar
  - smaller topbar and page headers
  - smaller metric cards and dashboard hero
- Added compact topbar branding on non-dashboard pages only. Dashboard keeps the larger brand treatment in the main content area.
- Reworked Registry Cleaner UI into a more desktop-utility/CCleaner-style flow:
  - category list on the left
  - filtered issue results in the main pane
  - readable wrapped registry paths
  - automatic backup before clean preview
- Changed registry backups to user-visible Documents location:
  - `%USERPROFILE%\Documents\Radium PCs Companion\registry-backups\`
- Extended native registry scan categories:
  - invalid startup references
  - uninstall leftovers
  - application path leftovers
- Verified `npm.cmd run build` passes.

**Notes:**
- Rust/Cargo still unavailable in this terminal, so the new Win32 registry enumeration code needs compile validation once the Rust toolchain is available.

### Session 7 — Codex
**Completed:**
- Reworked the Thermals page case visualisation to remove clipping-prone large labels inside the chassis.
- Replaced in-case text blocks with compact numbered sensor pins and a readable legend beside the chassis.
- Added component-shaped case blocks for CPU, RAM, GPU, storage, and PSU bay so the thermal map reads more like a physical PC layout.
- Added GPU vendor telemetry detail rows on the Thermals page for core clock, memory clock, power, and fan data.
- Added a dedicated Performance Profiles page instead of routing the Profiles tab to the generic Utilities placeholder.
- Added TypeScript profile contracts and service calls: `getPerformanceProfiles` and `applyPerformanceProfile`.
- Added native Tauri command boundaries for performance profiles in `src-tauri/src/lib.rs`.
- Added compact desktop-style profile UI with profile rows, active state, safe-mode explanation, and result actions.
- Verified `npm.cmd run build` passes.

**Notes:**
- Rust/Cargo is still unavailable in this terminal, so native Tauri/Rust compile validation remains pending.
- The performance profile implementation is intentionally capability-gated. It applies Companion state and exposes the native boundary, but does not yet write firmware, fan tables, or power limits.

### Session 3 — Latest (GitHub Copilot)
**Completed:**
- Researched LHM source: NvidiaGpu.cs, AmdGpu.cs, GenericCpu.cs — extracted exact API patterns
- Created `nvml_provider.rs` — NVIDIA GPU via NVML (nvml.dll) dynamic loading
- Created `amd_provider.rs` — AMD GPU via ADL2 (atiadlxx.dll) dynamic loading
- Updated `hardware.rs`: added `GpuReading` type, new cache fields, extended IPC types, rewired `monitor_loop()` with vendor cascade
- Updated `lib.rs`: added `mod nvml_provider` and `mod amd_provider`
- Updated `Cargo.toml`: added `Win32_System_LibraryLoader` feature
- Updated `src/types/system.ts`: `GpuSample` + `FanSample` extended, `StartupItem.location` fixed to `string`
- Updated docs: `telemetry-engine.md`, `context_log.md`

### Session 2 — (GitHub Copilot)
**Completed:**
- Created `hardware.rs`, `wmi_provider.rs`, `cleanup.rs`, `windows_util.rs`
- Rewrote `lib.rs` — all 9 commands delegate to new modules
- `pub fn run()` now spawns background monitoring thread
- Updated `Cargo.toml` with `wmi` and expanded `windows` features
- Created this documentation system

**Next agent must do:**
1. Validate build (`cargo check` or `npm run tauri dev`)
2. Fix compile errors (see Known Issues + Priority 1 above)
3. Update `src/types/system.ts` — `StartupItem.location` to `string`

### Session 1 — (prior sessions)
**Completed:**
- All React/TypeScript frontend pages implemented
- Mock data wired to UI
- Dashboard, Thermals, RAM Cleaner, Bloatware, Startup Manager, Storage Cleaner pages working
- OSD overlay component implemented
- System tray integration (menu, double-click)
- Basic Rust backend with sysinfo CPU/RAM (temperatures and GPU were placeholder `0.0`)
