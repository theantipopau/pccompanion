# Radium PCs Companion — Architecture

## Overview

Radium PCs Companion is a native Windows desktop application providing real-time hardware monitoring, system optimisation tools, and an on-screen display (OSD) for Radium PCs gaming and workstation systems.

**Stack:**
- **Frontend:** React 19 + TypeScript + Vite + Recharts + Framer Motion
- **Backend:** Rust (Tauri 2.x)
- **IPC:** Tauri invoke/command system (serialised JSON)
- **Native APIs:** `sysinfo` (CPU/RAM/network), WMI (`wmi` crate), Win32 registry, `K32EmptyWorkingSet`

---

## Layered Platform Model

Radium PCs Companion is now treated as a layered OEM platform rather than a single monitoring utility.

1. **UI Layer**
- React/Tauri frontend, page composition, motion, and visual systems.

2. **Telemetry Layer**
- Provider orchestration, polling cadence, cache publication, and vendor/native sensor adapters.

3. **Capability Layer**
- Capability registry, support states, confidence scoring, and degraded-state explanation.

4. **OEM Layer**
- System Passport, performance score, branding, onboarding, and certification-facing identity.

5. **Diagnostics Layer**
- Sensor provenance, support bundles, export formats, issue triage, and OEM reports.

6. **Safety Layer**
- Read-only defaults, EC/write gating, driver-required blocks, and unsafe-operation suppression.

7. **Branding Layer**
- Splash/onboarding surfaces, tray identity, product visual language, and first-launch experience.

---

## Process Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Tauri process (single process)                         │
│                                                         │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │  WebView (frontend) │   │  Rust backend            │ │
│  │                     │◄──┤                          │ │
│  │  React SPA          │   │  Tauri commands          │ │
│  │  MonitorContext.tsx │──►│  (read from cache)       │ │
│  │  (polls ~1 s)       │   │                          │ │
│  └─────────────────────┘   │  Arc<RwLock<Cache>>      │ │
│                             │       ▲                  │ │
│                             │       │ write 1/s        │ │
│                             │  ┌────┴─────────────┐   │ │
│                             │  │ radium-monitor   │   │ │
│                             │  │ thread           │   │ │
│                             │  │                  │   │ │
│                             │  │ sysinfo tick     │   │ │
│                             │  │ WMI queries      │   │ │
│                             │  └──────────────────┘   │ │
│                             └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐
│  Separate OSD window (optional)  │
│  WebviewWindow "osd"             │
│  Transparent, always-on-top      │
│  Same Tauri process              │
└──────────────────────────────────┘
```

---

## Rust Module Structure

```
src-tauri/src/
├── main.rs              — Program entry: calls lib::run()
├── build.rs             — Tauri code generation
├── lib.rs               — Command handlers, tray, OSD, pub fn run()
├── hardware.rs          — HAL: types, MonitoringEngine, monitor_loop
├── wmi_provider.rs      — WMI queries (Windows-only module)
├── nvml_provider.rs     — NVIDIA NVML GPU telemetry (Windows-only module)
├── adlx_provider.rs     — AMD ADLX GPU telemetry, preferred over amd_provider.rs (Windows-only module)
├── amd_provider.rs      — Legacy AMD ADL2 GPU telemetry, fallback for older cards (Windows-only module)
├── igcl_provider.rs     — Intel Arc / IGCL staging loader
├── sidecar_provider.rs  — LibreHardwareMonitor sensor sidecar bridge (Windows-only module)
├── rgb_provider.rs      — Read-only OpenRGB SDK discovery client
├── driver_update.rs     — NVIDIA/AMD/Intel driver version check (release-note links only)
├── cleanup.rs           — RAM cleaner + storage scanner
└── windows_util.rs      — Startup manager, bloatware scanner, registry, performance profiles
```

### Module Responsibilities

#### `hardware.rs`
- Owns all IPC-facing serialisable types (`HardwareSample`, `SystemInfo`, `MetricPoint`, etc.)
- `MonitoringEngine` — public state holder; Tauri `.manage()` stores one instance
- `HardwareCache` — internal mutable state written by background thread
- `SysinfoState` + `SysinfoState::tick()` — sysinfo polling abstraction
- `monitor_loop()` — background thread function; all real sensor I/O happens here
- Helper: `bytes_to_gb()`, `vendor_from_str()`, `timestamp_now()`
- Diagnostics helpers: provider orchestration snapshots, sensor provenance, capability intelligence, OEM support export seeds

#### `wmi_provider.rs` (Windows only)
- `WmiContext` — holds WMI connections for `ROOT\CIMV2` and `ROOT\WMI`; initialised once on the monitoring thread
- `query_cpu_temp()` — ACPI thermal zones first, with perf thermal classes and sysinfo component fallbacks
- `query_gpu_usage()` — 3D engine utilisation via `Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine`
- `query_static_system_info()` — GPU name/VRAM, CPU name, MB, BIOS, RAM speed from `Win32_*` inventory classes

#### `nvml_provider.rs` / `adlx_provider.rs` / `amd_provider.rs` (Windows only)
- `NvmlContext::init()` / `AdlxContext::init()` / `AmdAdlContext::init()` — load the vendor GPU library if present, fail closed to `None` otherwise
- `query_primary_gpu()` — GPU usage/temperature/clocks via vendor API instead of WMI fallback
- `query_driver_version()` — vendor-reported driver version for diagnostics and `driver_update.rs` (NVML/ADL2 only; ADLX does not currently expose this)
- `AmdAdlContext::query_fan_rpm()` — AMD fan telemetry where legacy ADL2 exposes it
- `adlx_provider.rs` calls into AMD's ADLX SDK (`amdadlx64.dll`) through hand-transcribed C-ABI vtable structs (verbatim from AMD's official public headers, not reverse engineered) since ADLX exposes C++ interfaces rather than flat exports. Every metric read is gated on the matching `IADLXGPUMetricsSupport::IsSupportedX` flag before being trusted — confirmed necessary on real hardware (a Radeon RX 9070 XT reports `ADLX_OK` with a meaningless value for unsupported metrics rather than failing the call). Preferred over `amd_provider.rs`'s legacy ADL2 path, which was confirmed non-functional (every Overdrive5/OverdriveN call fails) on current-generation RDNA3/4 cards.

#### `sidecar_provider.rs` (Windows only)
- `query_sensor_sidecar()` — launches the bundled .NET `radium-sensor-sidecar` process (LibreHardwareMonitor/PawnIO bridge) and parses its JSON stdout into `RadiumSidecarSample`
- Runs out-of-process, not on the `radium-monitor` thread; failures (missing binary, no matching sensors) are reported as explicit states rather than fabricated readings

#### `rgb_provider.rs`
- `discover_openrgb()` — read-only OpenRGB SDK client over a local TCP socket (`127.0.0.1:6742`)
- Bounded, fail-closed packet parsing (`ByteCursor`); no lighting-write commands exist in this module

#### `driver_update.rs`
- `check_nvidia_driver_update()` / `check_amd_driver_update()` / `check_intel_arc_driver_update()` — compare the locally reported driver version against vendor release-note metadata
- Used for manual "what's new" surfacing only; no auto-download or auto-install

#### `cleanup.rs`
- `optimize_ram()` — calls `K32EmptyWorkingSet` on all accessible processes, measures before/after
- `scan_storage_cleanup()` — enumerates known safe-to-clean locations with real file system sizes
- `run_storage_cleanup()` — executes or dry-runs `delete_dir_contents()`
- Storage scan lifecycle commands in `lib.rs` wrap scanning with progress and cancellation state

#### `windows_util.rs`
- `scan_startup_items()` — reads HKCU/HKLM Run keys + `StartupApproved` registry state
- `set_startup_item_enabled()` — modifies `StartupApproved` key (Task Manager mechanism)
- `scan_bloatware()` — PowerShell `Get-AppxPackage` matched against known removable packages
- `remove_bloatware()` — executes removal via PowerShell / policy key writes
- Registry scan, backup, clean, and restore helpers
- Performance profile helpers for Windows power plan, processor power tuning, and timer resolution

#### `lib.rs`
- Thin command handlers — each is a 1–2 line delegation to a module function
- `build_tray()` — system tray menu construction + event handlers
- `set_overlay_window()` — creates/shows/hides the transparent OSD `WebviewWindow`
- `pub fn run()` — spawns monitoring thread, calls `tauri::Builder`

---

## Frontend Architecture

```
src/
├── App.tsx               — Route/page switcher
├── main.tsx              — React root mount
├── styles.css            — Global styles
├── context/
│   ├── MonitorContext.tsx — Hardware polling context (1-s interval default)
│   └── SettingsContext.tsx — Persisted user preferences
├── services/
│   ├── native.ts         — Raw Tauri invoke() wrappers
│   ├── systemService.ts  — Typed IPC layer
│   └── mockData.ts       — Dev/fallback mock data
├── hooks/
│   ├── useHardwareMonitor.ts — Consumes MonitorContext
│   └── useAnimatedNumber.ts  — Smooth number transitions
├── components/           — Reusable UI components
├── pages/                — Full-page views
└── types/
    ├── system.ts         — Hardware and system TypeScript types
    └── navigation.ts     — Page navigation types
```

### Data Flow

```
MonitorContext.tsx
  └─ setInterval(refreshMs)
       └─ systemService.getHardwareSample(history)
            └─ invoke('get_hardware_sample', { history })
                 └─ Rust: engine.snapshot()  ← reads Arc<RwLock<HardwareCache>>
                      └─ returns HardwareSample (JSON)
                           └─ React state update → component re-renders
```

---

## IPC Contract

Tauri commands are registered in `tauri::generate_handler![]`. Fast telemetry commands read from the cache synchronously. Heavy utility commands use `tauri::async_runtime::spawn_blocking` or task lifecycle state so the WebView is not held hostage by filesystem scans, PowerShell, registry, or cleanup work.

| Command | Input | Output | Module |
|---|---|---|---|
| `get_system_info` | — | `SystemInfo` | `hardware` |
| `get_hardware_sample` | `history?: MetricPoint[]` | `HardwareSample` | `hardware` |
| `get_hardware_capabilities` | — | `HardwareCapability[]` | `hardware` |
| `get_telemetry_diagnostics` | — | `TelemetryDiagnosticsSnapshot` | `hardware` |
| `get_platform_telemetry_discovery` | — | `SensorDiscoveryReport` | `hardware` |
| `optimize_ram` | `mode?: string` | `RamCleanupResult` | `cleanup` |
| `scan_bloatware` | — | `BloatwareItem[]` | `windows_util` |
| `remove_bloatware` | `ids: string[], dry_run: bool` | `string[]` | `windows_util` |
| `restore_bloatware` | `ids: string[], dry_run: bool` | `string[]` | `windows_util` |
| `scan_startup_items` | — | `StartupItem[]` | `windows_util` |
| `set_startup_item_enabled` | `id: string, enabled: bool, dry_run: bool` | `string` | `windows_util` |
| `scan_storage_cleanup` | — | `StorageCleanupItem[]` | `cleanup` |
| `start_storage_cleanup_scan` | — | `StorageScanStatus` | `lib` |
| `get_storage_cleanup_scan_status` | — | `StorageScanStatusPayload` | `lib` |
| `cancel_storage_cleanup_scan` | — | `StorageScanStatus` | `lib` |
| `run_storage_cleanup` | `ids: string[], dry_run: bool` | `string[]` | `cleanup` |
| `scan_registry_issues` | — | `RegistryIssue[]` | `windows_util` |
| `backup_registry_issues` | `ids: string[]` | `RegistryBackup` | `windows_util` |
| `clean_registry_issues` | `ids: string[], backup_id: string, dry_run: bool` | `string[]` | `windows_util` |
| `restore_registry_backup` | `backup_id: string` | `string[]` | `windows_util` |
| `set_tray_status` | `TrayStatus` | `Result<(), string>` | `lib` |
| `set_tray_icon_data` | `rgba, width, height` | `Result<(), string>` | `lib` |
| `show_main_window` | — | `Result<(), string>` | `lib` |
| `set_startup_enabled` | `enabled: bool, start_minimized: bool` | `Result<bool, string>` | `lib` |
| `set_close_to_tray` | `enabled: bool` | `Result<(), string>` | `lib` |
| `set_minimize_to_tray_on_minimize` | `enabled: bool` | `Result<(), string>` | `lib` |
| `set_overlay_window` | `enabled: bool, click_through: bool` | `Result<(), string>` | `lib` |
| `restart_monitoring_engine` | — | `Result<string, string>` | `hardware` |
| `get_performance_profiles` | — | `PerformanceProfile[]` | `lib` |
| `apply_performance_profile` | `id: string, dry_run: bool` | `PerformanceProfileResult` | `lib/windows_util` |
| `list_top_processes` | `limit?: number` | `ProcessInfo[]` | `hardware` |
| `export_diagnostics` | `frontend_context?: serde_json::Value` | `DiagnosticsExport` | `lib` |
| `get_app_metadata` | — | `AppMetadata` | `lib` |
| `discover_rgb_devices` | — | `RgbDiscovery` | `rgb_provider` |
| `probe_sensor_sidecar` | — | `RadiumSidecarSample` | `sidecar_provider` |
| `check_driver_update` | `vendor: string, current_version: string` | `Option<DriverUpdateInfo>` | `driver_update` |
| `run_local_ai_setup` | — | `string` | `lib` |
| `open_url` | `url: string` | `Result<(), string>` | `lib` (HTTPS allow-list enforced) |

Not all registered commands are listed above; see the `tauri::generate_handler![]` block in `lib.rs` for the authoritative, current set.

---

## Threading Model

| Thread | Role | Synchronisation |
|---|---|---|
| Main thread | Tauri event loop + WebView messages | — |
| `radium-monitor` | Hardware sensor polling @ 1 Hz | Writes `Arc<RwLock<HardwareCache>>` |
| Tauri command thread | Handles `invoke()` calls from frontend | Reads `Arc<RwLock<HardwareCache>>` |

WMI `COMLibrary` is initialised once on `radium-monitor` and never moved between threads. All WMI queries run on that same thread, serialised by the polling loop.

---

## Dependency Graph

```
Cargo.toml
├── tauri 2          — App framework, IPC, windowing
├── tauri-plugin-log — Structured logging
├── serde 1          — Serialisation
├── serde_json 1     — JSON serialisation
├── log 0.4          — Logging facade
├── sysinfo 0.33     — CPU, RAM, network, process list (all platforms)
└── [Windows only]
    ├── windows 0.58  — Win32 API bindings (registry, process, memory)
    │   features: Win32_System_Memory, Win32_System_Threading,
    │             Win32_System_Registry, Win32_System_ProcessStatus,
    │             Win32_Foundation
    └── wmi 0.13      — WMI query layer (COM/IDispatch wrapper)
```
