# Radium PCs Companion — Telemetry Engine

## Overview

The telemetry engine provides real-time hardware sensor data to the frontend. It is a **fully self-contained, embedded monitoring stack** — no third-party monitoring software required. It uses a cascade of vendor-specific providers, each loaded at runtime, with graceful degradation when hardware is absent.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  radium-monitor thread (spawned in lib.rs pub fn run())             │
│                                                                     │
│  ONE-TIME INIT:                                                     │
│  ├─ WmiContext::init()           ← COM init, ROOT\CIMV2            │
│  ├─ NvmlContext::init()          ← loads nvml.dll (NVIDIA only)    │
│  ├─ AmdAdlContext::init()        ← loads atiadlxx.dll (AMD only)   │
│  └─ query_static_system_info()   ← GPU name, MB, BIOS, RAM speed  │
│                                                                     │
│  POLL LOOP (every 1 s):                                             │
│  ├─ SysinfoState::tick()         ← CPU%, clock, RAM, net, disk     │
│  ├─ query_cpu_temp()  [WMI]      ← CPU thermal zone temperature    │
│  ├─ GPU provider (priority chain):                                  │
│  │    NVML → GPU temp, usage, VRAM, clocks, fan%, power            │
│  │    AMD ADL → GPU temp, usage, VRAM, clocks, fan RPM             │
│  │    WMI → GPU 3D engine usage % (fallback only)                  │
│  └─ HardwareCache::write()       ← update shared cache             │
└─────────────────────────────────────────────────────────────────────┘
                             │
             Arc<RwLock<HardwareCache>>
                             │
┌─────────────────────────────▼───────────────────────────────────────┐
│  Tauri command handler thread (on frontend invoke)                  │
│                                                                     │
│  get_hardware_sample() → engine.snapshot()                          │
│    └─ HardwareCache::read() → serialise to HardwareSample          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Provider Cascade

| Priority | Module | DLL | Vendor | Sensors |
|----------|--------|-----|--------|---------|
| 1 | `nvml_provider` | `nvml.dll` | NVIDIA | Temp, usage, VRAM used/total, core/mem clocks, fan %, power W |
| 2 | `amd_provider` | `atiadlxx.dll` | AMD | Temp, usage, VRAM used, core/mem clocks, fan RPM |
| 3 | `igcl_provider` | `igcl64.dll` / `ControlLib.dll` | Intel | Staged loader, device enumeration scaffold, sensor bindings pending |
| 4 | `wmi_provider` | — | Any | GPU 3D engine load % only |

- **DLL loading**: `LoadLibraryW` at runtime via `windows::Win32::System::LibraryLoader`. If the DLL is absent, `None` is returned and the next tier is tried.
- **No redistribution**: vendor DLLs ship with the respective GPU driver — Radium PCs Companion never bundles them.
- **Thread affinity**: all provider objects (`NvmlContext`, `AmdAdlContext`) are created and used exclusively within the `radium-monitor` thread.

### Provider Diagnostics & Provenance

The monitoring thread now caches provider orchestration data so the frontend and support bundle can explain where telemetry came from and why a channel is unavailable.

- **Provider load order** is explicitly tracked in cache and exposed to the frontend.
- **Active provider** is derived from the current GPU vendor path rather than inferred client-side.
- **Initialization state** is surfaced as `loaded`, `staged`, `degraded`, or `unavailable`.
- **Binding state** records whether symbols were resolved and whether the loader is merely staged.
- **Fallback sequence** is exposed so support can see the exact escalation path.

### Telemetry Confidence Model

Confidence is surfaced per sensor so diagnostics can distinguish native telemetry from fallback or inferred data.

- **High**: native vendor telemetry with direct bindings and stable readings.
- **Medium**: WMI-backed or partially inferred values that remain useful but less authoritative.
- **Low**: staged, inferred, or driver-dependent values that are not yet native.
- **Unknown**: no validated reading source yet.

### Sensor Provenance Matrix

The frontend diagnostics page renders a matrix with:

- sensor name,
- provider source,
- capability state,
- confidence band,
- telemetry quality,
- fallback status,
- OEM support status.

This matrix is built from the backend snapshot returned by `get_telemetry_diagnostics` and exported via `export_diagnostics`.

---

## Sensor Sources

### CPU Usage & Clock Speed
- **Source:** `sysinfo 0.33`
- **Method:** `System::refresh_cpu_usage()` → average across all logical cores
- **Clock:** `Cpu::frequency()` from first core (MHz)
- **Latency:** ~100 ms for stable reading (sysinfo requires two samples to compute delta)

### CPU Temperature
- **Source:** WMI — `Win32_PerfFormattedData_Counters_ThermalZoneInformation`
- **Namespace:** `ROOT\CIMV2`
- **Method:** Query all thermal zones, convert Kelvin → Celsius, return hottest in 0–120 °C range
- **Formula:** `celsius = temperature_value - 273.15` (formatted class returns Kelvin)
- **Fallback:** `None` if WMI unavailable or all zones out of range
- **Known risk:** Some BIOSes expose thermal zones in tenths-of-Kelvin via the formatted class. If temperatures report as ~3000 °C, apply `/10` before the `−273.15` conversion. The 0–120 °C range filter provides graceful degradation.

### RAM
- **Source:** `sysinfo` — `System::refresh_memory()`
- **Fields:** `used_memory()`, `total_memory()` → GB conversion
- **Usage %:** `(used / total) * 100`

### Network throughput
- **Source:** `sysinfo` — `Networks::refresh()`
- **Method:** Delta of `received()` / `transmitted()` over elapsed seconds → Mbps
- **Filter:** Excludes loopback interfaces
- **Note:** Counts bytes across all non-loopback adapters

### Storage
- **Source:** `sysinfo` — `Disks::new_with_refreshed_list()`
- **Fields:** Disk name, total space, available space → used %
- **Temperature:** `None` — NVMe/SATA temps require driver access (deferred)

### GPU Name & VRAM (static)
- **Source:** WMI — `Win32_VideoController`
- **Method:** Queries `Caption`, `AdapterRAM`; picks adapter with highest VRAM
- **Frequency:** Once at startup — used as fallback name when vendor API unavailable

### GPU Usage / Temperature / Clocks / Fan / Power (dynamic)
Provider cascade — first successful init wins:

#### Tier 1: NVML (NVIDIA)
- **DLL:** `nvml.dll` — ships with NVIDIA drivers, loaded via `LoadLibraryW`
- **Init:** `nvmlInit_v2()` → enumerate GPUs → cache device handles
- **Sensors:** Core temp, GPU utilization %, memory utilization %, VRAM used/total, core clock MHz, memory clock MHz, fan speed %, power consumption W
- **Functions:** `nvmlDeviceGetTemperature`, `nvmlDeviceGetUtilizationRates`, `nvmlDeviceGetMemoryInfo`, `nvmlDeviceGetClockInfo`, `nvmlDeviceGetFanSpeed`, `nvmlDeviceGetPowerUsage`
- **Frequency:** Every poll tick

#### Tier 2: AMD ADL (AMD)
- **DLL:** `atiadlxx.dll` — ships with AMD Radeon drivers, loaded via `LoadLibraryW`
- **Init:** `ADL2_Main_Control_Create()` → enumerate adapters → find first responding to Overdrive5
- **Sensors:** Core temp (ODN edge on RX 480+, OD5 fallback), GPU activity %, core clock MHz, memory clock MHz, fan RPM, VRAM used MB
- **Functions:** `ADL2_OverdriveN_Temperature_Get`, `ADL2_Overdrive5_Temperature_Get`, `ADL2_Overdrive5_CurrentActivity_Get`, `ADL2_Overdrive5_FanSpeed_Get`, `ADL2_Adapter_DedicatedVRAMUsage_Get`
- **Frequency:** Every poll tick

#### Tier 3: WMI GPU Engine Counter (fallback)
- **Source:** `Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine`
- **Filter:** `Name LIKE '%engtype_3D%'`
- **Sensors:** GPU usage % only — no temp, fans, clocks, or VRAM
- **Used when:** Neither NVML nor ADL available (e.g. Intel iGPU only, or driver issue)

### Fan RPM
- **GPU fans:** Populated from AMD ADL `fan_rpm` field (when AMD provider active)
- **GPU fan %:** Populated from NVML `fan_pct` field (when NVIDIA provider active)
- **CPU cooler:** `None` — requires motherboard EC access via kernel driver (deferred to Tier 3)

### System Identity (CPU name, MB, BIOS, RAM speed)
- **Source:** WMI — `Win32_Processor`, `Win32_BaseBoard`, `Win32_BIOS`, `Win32_PhysicalMemory`
- **Frequency:** Once at startup
- **Fallback:** sysinfo provides CPU brand string while WMI initialises

---

## Shared State Contracts

### `HardwareCache` (internal, `hardware.rs`)
Written by `radium-monitor`, read by command handlers.

```rust
pub struct HardwareCache {
    pub timestamp: u128,
    pub state: String,             // "initializing" | "valid" | "degraded"
    pub cpu_usage: f32,
    pub cpu_temp: Option<f32>,
    pub cpu_clock_mhz: u64,
    pub gpu_name: String,
    pub gpu_vendor: String,
    pub gpu_temp: Option<f32>,     // from NVML/ADL
    pub gpu_usage: f32,
    pub gpu_vram_used_gb: f32,     // from NVML/ADL
    pub gpu_vram_total_gb: f32,    // from NVML (exact) or WMI (static)
    pub gpu_core_clock_mhz: u64,  // from NVML/ADL
    pub gpu_mem_clock_mhz: u64,   // from NVML/ADL
    pub gpu_fan_pct: Option<u32>,  // from NVML
    pub gpu_fan_rpm: Option<u32>,  // from AMD ADL
    pub gpu_power_watts: Option<f32>, // from NVML
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_usage: f32,
    pub net_down_mbps: f32,
    pub net_up_mbps: f32,
    pub provider_load_order: Vec<String>,
    pub provider_diagnostics: Vec<ProviderDiagnostics>,
    pub provider_warnings: Vec<String>,
    pub provider_errors: Vec<String>,
    pub storage: Vec<StorageSample>,
    pub history: Vec<MetricPoint>,   // rolling 60 points
    pub system_info: Option<SystemInfo>,
}
```

### `HardwareSample` (IPC type, serialised to frontend)
Snapshot of `HardwareCache` plus structured sub-objects.

### `MetricPoint` (history entry)
One data point per poll tick. Pushed onto `HardwareCache::history`, capped at 60 entries.

```rust
pub struct MetricPoint {
    pub time: String,        // "MM:SS" formatted
    pub cpu_temp: f32,       // 0.0 if unavailable
    pub cpu_usage: f32,
    pub gpu_temp: f32,       // 0.0 currently
    pub gpu_usage: f32,
    pub ram_usage: f32,
    pub network_down: f32,   // Mbps
}

### `TelemetryDiagnosticsSnapshot`
Support-ready, cached snapshot exposed to the frontend and diagnostics export.

```rust
pub struct TelemetryDiagnosticsSnapshot {
  pub created_at: String,
  pub overall_state: String,
  pub active_provider: String,
  pub fallback_sequence: Vec<String>,
  pub provider_load_order: Vec<String>,
  pub providers: Vec<ProviderDiagnostics>,
  pub capabilities: Vec<HardwareCapability>,
  pub sensors: Vec<SensorProvenance>,
  pub support_snapshot: Vec<String>,
  pub support_actions: Vec<String>,
  pub hardware_identity: SystemInfo,
  pub sample: HardwareSample,
}
```

### `ProviderDiagnostics`
Per-provider orchestration visibility used by diagnostics and support bundles.

```rust
pub struct ProviderDiagnostics {
  pub id: String,
  pub label: String,
  pub vendor: String,
  pub load_order: u32,
  pub state: String,
  pub active: bool,
  pub dll: String,
  pub dll_available: bool,
  pub symbols_resolved: bool,
  pub symbols: Vec<String>,
  pub notes: String,
  pub warnings: Vec<String>,
  pub errors: Vec<String>,
}
```

### `SensorProvenance`
Per-sensor transparency metadata for the provenance matrix.

```rust
pub struct SensorProvenance {
  pub id: String,
  pub sensor: String,
  pub provider: String,
  pub provider_state: String,
  pub state: String,
  pub confidence: String,
  pub telemetry_quality: String,
  pub fallback_status: String,
  pub notes: String,
  pub oem_support_status: String,
  pub icon: String,
}
```
```

---

## WMI Integration Details

### COM Initialisation
`COMLibrary::new()` is called once when `radium-monitor` thread starts. The `COMLibrary` value is kept alive for the thread's lifetime by being held inside `WmiContext`. WMI connections are stable within a COM apartment.

### Connection
Single `WMIConnection` to `ROOT\CIMV2`. All queries share this connection. No second namespace needed — thermal zone data is accessible from `CIMV2` via the performance counter class.

### Error Handling
- WMI init failure → `wmi_opt = None` → sensor fields remain `None`/`0.0` → state = "degraded"
- Individual query failure → returns `None`/`0.0` → does not crash the monitoring loop
- All WMI errors are logged via `log::warn!()`

### Thread Safety
WMI queries are serialised within the monitoring loop — there is no concurrent access to `WmiContext`. The `cimv2` connection is not shared across threads.

---

## Polling Schedule

```
t=0       : Thread starts
t=0       : WmiContext::init() — may take 100–500 ms
t=init    : query_static_system_info() — once
t=init+   : loop begins
  t+0 ms  : SysinfoState::tick()
  t+~5 ms : query_cpu_temp()
  t+~10ms : query_gpu_usage()
  t+~15ms : cache write
  t+985ms : sleep (pad to 1000 ms total)
```

---

## State Machine

The `state` field in `HardwareSample` follows this logic:

```
"initializing"  — initial value before first loop iteration
"valid"         — cpu_temp is Some (WMI working)
"valid"         — gpu_usage > 0 (WMI GPU counter active)
"degraded"      — neither cpu_temp nor gpu_usage available
                  (sysinfo data still present; WMI sensors missing)
```

The frontend should display a degraded indicator when `state == "degraded"` but still show CPU %, RAM, and network data.

---

## Future: Enhanced Sensors (LibreHardwareMonitor)

**When to add:** After core functionality is validated and shipped.

**Integration path:**
1. Embed LHM as a sidecar process (separate `.exe`)
2. LHM exposes HTTP or named-pipe sensor API
3. `hardware.rs` monitor loop queries LHM alongside WMI
4. Gates behind user opt-in (requires UAC elevation for driver load)

**What LHM adds:**
- Per-core temperatures and voltages
- GPU temperature (NVML/ADL via LHM's own vendor integration)
- Fan RPM for MB headers, GPU fans, AIO pumps
- NVMe SSD temperatures
- VRM temperatures

**Licence compliance:** MPL 2.0 — must include LHM licence notice in the application.
