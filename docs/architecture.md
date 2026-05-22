# Radium PCs Companion — Architecture

## Overview

Radium PCs Companion is a native Windows desktop application providing real-time hardware monitoring, system optimisation tools, and an on-screen display (OSD) for Radium PCs gaming and workstation systems.

**Stack:**
- **Frontend:** React 19 + TypeScript + Vite + Recharts + Framer Motion
- **Backend:** Rust (Tauri 2.x)
- **IPC:** Tauri invoke/command system (serialised JSON)
- **Native APIs:** `sysinfo` (CPU/RAM/network), WMI (`wmi` crate), Win32 registry, `K32EmptyWorkingSet`

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
├── cleanup.rs           — RAM cleaner + storage scanner
└── windows_util.rs      — Startup manager + bloatware scanner
```

### Module Responsibilities

#### `hardware.rs`
- Owns all IPC-facing serialisable types (`HardwareSample`, `SystemInfo`, `MetricPoint`, etc.)
- `MonitoringEngine` — public state holder; Tauri `.manage()` stores one instance
- `HardwareCache` — internal mutable state written by background thread
- `SysinfoState` + `SysinfoState::tick()` — sysinfo polling abstraction
- `monitor_loop()` — background thread function; all real sensor I/O happens here
- Helper: `bytes_to_gb()`, `vendor_from_str()`, `timestamp_now()`

#### `wmi_provider.rs` (Windows only)
- `WmiContext` — holds a live `WMIConnection` to `ROOT\CIMV2`; initialised once on the monitoring thread
- `query_cpu_temp()` — thermal zone temperature via `Win32_PerfFormattedData_Counters_ThermalZoneInformation`
- `query_gpu_usage()` — 3D engine utilisation via `Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine`
- `query_static_system_info()` — GPU name/VRAM, CPU name, MB, BIOS, RAM speed from `Win32_*` inventory classes

#### `cleanup.rs`
- `optimize_ram()` — calls `K32EmptyWorkingSet` on all accessible processes, measures before/after
- `scan_storage_cleanup()` — enumerates known safe-to-clean locations with real file system sizes
- `run_storage_cleanup()` — executes or dry-runs `delete_dir_contents()`

#### `windows_util.rs`
- `scan_startup_items()` — reads HKCU/HKLM Run keys + `StartupApproved` registry state
- `set_startup_item_enabled()` — modifies `StartupApproved` key (Task Manager mechanism)
- `scan_bloatware()` — PowerShell `Get-AppxPackage` matched against known removable packages
- `remove_bloatware()` — executes removal via PowerShell / policy key writes

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

All Tauri commands are synchronous Rust functions registered in `tauri::generate_handler![]`.

| Command | Input | Output | Module |
|---|---|---|---|
| `get_system_info` | — | `SystemInfo` | `hardware` |
| `get_hardware_sample` | `history?: MetricPoint[]` | `HardwareSample` | `hardware` |
| `optimize_ram` | `mode?: string` | `RamCleanupResult` | `cleanup` |
| `scan_bloatware` | — | `BloatwareItem[]` | `windows_util` |
| `remove_bloatware` | `ids: string[], dry_run: bool` | `string[]` | `windows_util` |
| `scan_startup_items` | — | `StartupItem[]` | `windows_util` |
| `set_startup_item_enabled` | `id: string, enabled: bool, dry_run: bool` | `string` | `windows_util` |
| `scan_storage_cleanup` | — | `StorageCleanupItem[]` | `cleanup` |
| `run_storage_cleanup` | `ids: string[], dry_run: bool` | `string[]` | `cleanup` |
| `set_tray_status` | `TrayStatus` | `Result<(), string>` | `lib` |
| `show_main_window` | — | `Result<(), string>` | `lib` |
| `set_startup_enabled` | `enabled: bool` | `Result<bool, string>` | `lib` |
| `set_overlay_window` | `enabled: bool, click_through: bool` | `Result<(), string>` | `lib` |

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
