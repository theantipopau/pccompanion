/// Hardware abstraction layer.
///
/// Provides a unified sensor model with graceful degradation when a sensor is
/// unavailable.  All real I/O runs on the dedicated monitoring thread; the
/// Tauri command handlers read from the shared [`HardwareCache`] without
/// blocking.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use sysinfo::{Components, Networks, System};

// ─── Shared IPC types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MetricPoint {
    pub time: String,
    pub cpu_temp: f32,
    pub cpu_usage: f32,
    pub gpu_temp: f32,
    pub gpu_usage: f32,
    pub ram_usage: f32,
    pub network_down: f32,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CpuSample {
    pub temperature: Option<f32>,
    pub usage: f32,
    pub clock_mhz: u64,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GpuSample {
    pub provider: String,
    pub temperature: Option<f32>,
    pub usage: f32,
    pub vram_used_gb: f32,
    pub vram_total_gb: f32,
    pub core_clock_mhz: u64,
    pub memory_clock_mhz: u64,
    pub fan_pct: Option<u32>,
    pub power_watts: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MemorySample {
    pub used_gb: f32,
    pub total_gb: f32,
    pub usage: f32,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FanSample {
    pub label: String,
    pub rpm: Option<u32>,
    pub pct: Option<u32>,
}

// ─── Internal GPU reading (produced by vendor providers) ─────────────────────

/// Combined GPU sensor snapshot returned by a vendor provider.
/// Maps to `HardwareCache` GPU fields; not sent directly over IPC.
#[derive(Debug, Default)]
pub struct GpuReading {
    pub name: String,
    pub vendor: String,
    pub temperature_c: Option<f32>,
    pub usage_pct: f32,
    pub vram_used_gb: f32,
    pub vram_total_gb: f32,
    pub core_clock_mhz: u64,
    pub mem_clock_mhz: u64,
    /// Fan speed as percentage (0–100). NVML path.
    pub fan_pct: Option<u32>,
    /// Fan speed in RPM. AMD ADL path.
    pub fan_rpm: Option<u32>,
    pub power_watts: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StorageSample {
    pub label: String,
    pub used_percent: f32,
    pub temperature: Option<f32>,
    /// "nvme" | "ssd" | "hdd" | "unknown"
    pub drive_type: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSample {
    pub down_mbps: f32,
    pub up_mbps: f32,
    /// OS interface name of the most-active non-loopback adapter.
    pub adapter_name: String,
    /// "wifi" | "ethernet" | "unknown"
    pub adapter_type: String,
}

/// Snapshot of all hardware metrics.  Serialised directly to the frontend.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSample {
    pub timestamp: u128,
    pub state: String,
    pub cpu: CpuSample,
    pub gpu: GpuSample,
    pub memory: MemorySample,
    pub fans: Vec<FanSample>,
    pub storage: Vec<StorageSample>,
    pub network: NetworkSample,
    pub history: Vec<MetricPoint>,
}

/// Static hardware identity, populated once at startup.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub cpu: String,
    pub cpu_vendor: String,
    pub gpu: String,
    pub gpu_vendor: String,
    pub motherboard: String,
    pub ram: String,
    pub ram_speed: String,
    pub storage: Vec<String>,
    pub psu: String,
    pub windows: String,
    pub bios: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HardwareCapability {
    pub id: String,
    pub label: String,
    /// "live" | "partial" | "unsupported" | "unknown"
    pub state: String,
    pub detail: String,
    pub write_safe: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SensorDiscoveryAttempt {
    pub source: String,
    pub query: String,
    pub label: String,
    pub raw_value: String,
    pub value_c: Option<f32>,
    pub accepted: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceClassInventory {
    pub namespace: String,
    pub available: bool,
    pub status: String,
    pub matching_classes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GpuAdapterDiscovery {
    pub name: String,
    pub vendor: String,
    pub adapter_ram_gb: f32,
    pub integrated: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SensorDiscoveryReport {
    pub machine_vendor: String,
    pub machine_model: String,
    pub machine_family: String,
    pub is_dell: bool,
    pub package_temp_available: bool,
    pub requires_driver: bool,
    pub recommended_action: String,
    pub issue_classification: String,
    pub dell_class_hints: Vec<String>,
    pub namespace_inventory: Vec<NamespaceClassInventory>,
    pub gpu_adapters: Vec<GpuAdapterDiscovery>,
    pub gpu_engine_counter_available: bool,
    pub gpu_engine_counter_state: String,
    pub attempts: Vec<SensorDiscoveryAttempt>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
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
    pub sensor_discovery: SensorDiscoveryReport,
    pub hardware_identity: SystemInfo,
    pub sample: HardwareSample,
}

// ─── Internal shared cache ──────────────────────────────────────────────────

/// Cached readings written by the monitoring thread, read by Tauri commands.
#[derive(Debug, Clone, Default)]
pub struct HardwareCache {
    pub timestamp: u128,
    /// "valid" | "degraded" | "initializing"
    pub state: String,
    pub cpu_usage: f32,
    pub cpu_temp: Option<f32>,
    pub cpu_clock_mhz: u64,
    pub gpu_name: String,
    pub gpu_vendor: String,
    pub gpu_provider: String,
    pub intel_igcl_loaded: bool,
    pub provider_load_order: Vec<String>,
    pub provider_diagnostics: Vec<ProviderDiagnostics>,
    pub provider_warnings: Vec<String>,
    pub provider_errors: Vec<String>,
    pub sensor_discovery: SensorDiscoveryReport,
    pub gpu_temp: Option<f32>,
    pub gpu_usage: f32,
    pub gpu_vram_used_gb: f32,
    pub gpu_vram_total_gb: f32,
    pub gpu_core_clock_mhz: u64,
    pub gpu_mem_clock_mhz: u64,
    pub gpu_fan_pct: Option<u32>,
    pub gpu_fan_rpm: Option<u32>,
    pub gpu_power_watts: Option<f32>,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_usage: f32,
    pub net_down_mbps: f32,
    pub net_up_mbps: f32,
    pub net_adapter_name: String,
    pub net_adapter_type: String,
    pub storage: Vec<StorageSample>,
    pub history: Vec<MetricPoint>,
    pub system_info: Option<SystemInfo>,
}

// ─── sysinfo provider state (owned by background thread) ────────────────────

pub struct SysinfoState {
    pub sys: System,
    pub networks: Networks,
    pub last_net_refresh: Instant,
}

impl SysinfoState {
    pub fn new() -> Self {
        let mut sys = System::new_all();
        // First refresh seeds cpu_usage baseline; sleep lets sysinfo measure
        // actual activity rather than returning zeroes.
        sys.refresh_cpu_usage();
        let mut networks = Networks::new_with_refreshed_list();
        networks.refresh(false);
        Self {
            sys,
            networks,
            last_net_refresh: Instant::now(),
        }
    }

    /// Refresh sysinfo and return current readings.
    pub fn tick(&mut self) -> SysinfoTick {
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();

        // ----- CPU -----
        let cpus = self.sys.cpus();
        let cpu_usage = if cpus.is_empty() {
            0.0
        } else {
            cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32
        };
        let cpu_clock_mhz = cpus.first().map(|c| c.frequency()).unwrap_or_default();

        // ----- RAM -----
        let total_gb = bytes_to_gb(self.sys.total_memory());
        let used_gb = bytes_to_gb(self.sys.used_memory());
        let ram_usage = if total_gb > 0.0 {
            (used_gb / total_gb) * 100.0
        } else {
            0.0
        };

        // ----- Network delta -----
        let elapsed = self.last_net_refresh.elapsed().as_secs_f64().max(0.1);
        self.networks.refresh(false);
        self.last_net_refresh = Instant::now();

        let mut total_rx = 0u64;
        let mut total_tx = 0u64;
        let mut best_adapter: Option<(String, u64)> = None; // (name, traffic)

        for (name, net) in self.networks.iter() {
            let lower = name.to_lowercase();
            if lower.contains("loopback") { continue; }
            let traffic = net.received() + net.transmitted();
            total_rx += net.received();
            total_tx += net.transmitted();
            if best_adapter.as_ref().map_or(true, |(_, t)| traffic > *t) {
                best_adapter = Some((name.clone(), traffic));
            }
        }

        let down_mbps = ((total_rx as f64 * 8.0) / (1_000_000.0 * elapsed)) as f32;
        let up_mbps = ((total_tx as f64 * 8.0) / (1_000_000.0 * elapsed)) as f32;

        let (adapter_name, adapter_type) = match best_adapter {
            Some((name, _)) => {
                let t = adapter_type_from_name(&name);
                (name, t.to_string())
            }
            None => (String::new(), "unknown".to_string()),
        };

        // ----- Storage -----
        let disks = sysinfo::Disks::new_with_refreshed_list();
        let storage = disks
            .iter()
            .filter(|d| d.total_space() > 0)
            .map(|d| {
                let total = d.total_space() as f32;
                let avail = d.available_space() as f32;
                let used_pct = if total > 0.0 {
                    ((total - avail) / total) * 100.0
                } else {
                    0.0
                };
                let drive_type = match d.kind() {
                    sysinfo::DiskKind::SSD => {
                        // Heuristic: device path containing "NVMe" or "nvme" → nvme
                        if d.name().to_string_lossy().to_lowercase().contains("nvme") {
                            "nvme"
                        } else {
                            "ssd"
                        }
                    }
                    sysinfo::DiskKind::HDD => "hdd",
                    _ => "unknown",
                };
                // Use a human-readable label: prefer volume name, fallback to mount
                let raw_label = d.name().to_string_lossy().to_string();
                let label = if raw_label.is_empty() || raw_label.starts_with("\\\\?\\Volume") {
                    format!("{} Drive", drive_type.to_uppercase())
                } else {
                    raw_label
                };
                StorageSample {
                    label,
                    used_percent: used_pct,
                    temperature: None,
                    drive_type: drive_type.to_string(),
                }
            })
            .collect();

        SysinfoTick {
            cpu_usage,
            cpu_clock_mhz,
            ram_used_gb: used_gb,
            ram_total_gb: total_gb,
            ram_usage,
            down_mbps,
            up_mbps,
            adapter_name,
            adapter_type,
            storage,
        }
    }
}

pub struct SysinfoTick {
    pub cpu_usage: f32,
    pub cpu_clock_mhz: u64,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_usage: f32,
    pub down_mbps: f32,
    pub up_mbps: f32,
    pub adapter_name: String,
    pub adapter_type: String,
    pub storage: Vec<StorageSample>,
}

// ─── MonitoringEngine ────────────────────────────────────────────────────────

pub struct MonitoringEngine {
    pub cache: Arc<RwLock<HardwareCache>>,
    pub sysinfo: Arc<Mutex<SysinfoState>>,
}

impl MonitoringEngine {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HardwareCache {
                state: "initializing".to_string(),
                ..Default::default()
            })),
            sysinfo: Arc::new(Mutex::new(SysinfoState::new())),
        }
    }

    /// Read the current cache snapshot as a [`HardwareSample`].
    pub fn snapshot(&self) -> HardwareSample {
        let c = self.cache.read().expect("hardware cache read lock");
        HardwareSample {
            timestamp: c.timestamp,
            state: c.state.clone(),
            cpu: CpuSample {
                temperature: c.cpu_temp,
                usage: c.cpu_usage,
                clock_mhz: c.cpu_clock_mhz,
            },
            gpu: GpuSample {
                provider: c.gpu_provider.clone(),
                temperature: c.gpu_temp,
                usage: c.gpu_usage,
                vram_used_gb: c.gpu_vram_used_gb,
                vram_total_gb: c.gpu_vram_total_gb,
                core_clock_mhz: c.gpu_core_clock_mhz,
                memory_clock_mhz: c.gpu_mem_clock_mhz,
                fan_pct: c.gpu_fan_pct,
                power_watts: c.gpu_power_watts,
            },
            memory: MemorySample {
                used_gb: c.ram_used_gb,
                total_gb: c.ram_total_gb,
                usage: c.ram_usage,
            },
            fans: vec![
                FanSample {
                    label: "CPU cooler".to_string(),
                    rpm: None,
                    pct: None,
                },
                FanSample {
                    label: "GPU fans".to_string(),
                    rpm: c.gpu_fan_rpm,
                    pct: c.gpu_fan_pct,
                },
            ],
            storage: c.storage.clone(),
            network: NetworkSample {
                down_mbps: c.net_down_mbps,
                up_mbps: c.net_up_mbps,
                adapter_name: c.net_adapter_name.clone(),
                adapter_type: c.net_adapter_type.clone(),
            },
            history: c.history.clone(),
        }
    }

    /// Reset runtime cache surfaces so monitoring can recover quickly after
    /// a manual restart action from the tray menu.
    pub fn restart_runtime_state(&self) -> String {
        let mut c = self.cache.write().expect("hardware cache write lock");
        c.state = "initializing".to_string();
        c.timestamp = timestamp_now().0;
        c.history.clear();
        c.provider_errors.clear();
        c.provider_warnings.clear();
        "Monitoring engine restart scheduled; cache reset for fresh polling cycle.".to_string()
    }

    /// Read the cached system info (or a sensible placeholder while it
    /// initialises).
    pub fn system_info_snapshot(&self, sys: &System) -> SystemInfo {
        let c = self.cache.read().expect("hardware cache read lock");
        if let Some(info) = c.system_info.clone() {
            return info;
        }
        // Fast sysinfo fallback while WMI is still initialising.
        build_sysinfo_fallback(sys, &c)
    }

    /// Return a registry-style summary of available telemetry capabilities.
    pub fn capability_snapshot(&self) -> Vec<HardwareCapability> {
        let c = self.cache.read().expect("hardware cache read lock");
        let gpu_vendor = c.gpu_vendor.to_lowercase();
        let gpu_provider = c.gpu_provider.to_lowercase();

        let mut caps = Vec::new();
        let driver_required = c.sensor_discovery.requires_driver;
        caps.push(HardwareCapability {
            id: "cpu-package".to_string(),
            label: "CPU package telemetry".to_string(),
            state: if c.cpu_temp.is_some() {
                "live"
            } else if driver_required {
                "driver_required"
            } else {
                "partial"
            }
            .to_string(),
            detail: if c.cpu_temp.is_some() {
                "WMI ACPI thermal + sysinfo load active".to_string()
            } else if driver_required {
                "Package temperature not exposed via user-mode WMI/sysinfo on this machine".to_string()
            } else {
                "Load active; temperature channel unavailable".to_string()
            },
            write_safe: false,
        });

        let gpu_state = if c.gpu_usage > 0.0 || c.gpu_temp.is_some() {
            "live"
        } else if gpu_vendor == "intel" && c.intel_igcl_loaded {
            "staged"
        } else if gpu_provider == "wmi" || gpu_provider.is_empty() {
            "partial"
        } else {
            "degraded"
        };
        let gpu_detail = match gpu_provider.as_str() {
            "nvml" => "NVML provider".to_string(),
            "adl2" => "ADL2 provider".to_string(),
            "igcl" => "Intel Arc IGCL groundwork active; enhanced sensor bindings staged".to_string(),
            "wmi" => "WMI fallback".to_string(),
            _ => {
                if gpu_vendor == "intel" && c.intel_igcl_loaded {
                    "Intel Arc IGCL loader active with WMI fallback".to_string()
                } else {
                    "Provider not yet resolved".to_string()
                }
            }
        };
        caps.push(HardwareCapability {
            id: "gpu-core".to_string(),
            label: "Discrete GPU telemetry".to_string(),
            state: gpu_state.to_string(),
            detail: gpu_detail,
            write_safe: false,
        });

        caps.push(HardwareCapability {
            id: "network-throughput".to_string(),
            label: "Network throughput telemetry".to_string(),
            state: if c.net_down_mbps >= 0.0 { "live" } else { "partial" }.to_string(),
            detail: "sysinfo network delta cache".to_string(),
            write_safe: true,
        });

        let storage_has_temp = c.storage.iter().any(|drive| drive.temperature.is_some());
        caps.push(HardwareCapability {
            id: "storage-smart".to_string(),
            label: "Storage SMART depth".to_string(),
            state: if storage_has_temp { "live" } else { "driver_required" }.to_string(),
            detail: if storage_has_temp {
                "Temperature channels active".to_string()
            } else {
                "Usage/space active; SMART wear and TBW expansion pending".to_string()
            },
            write_safe: false,
        });

        let fan_available = c.gpu_fan_pct.is_some() || c.gpu_fan_rpm.is_some();
        caps.push(HardwareCapability {
            id: "cooling-control".to_string(),
            label: "Fan telemetry and control safety".to_string(),
            state: if fan_available { "partial" } else { "blocked" }.to_string(),
            detail: if fan_available {
                "Read channels detected; write controls remain safety-locked".to_string()
            } else {
                "SuperIO/EC capability registry required before enablement".to_string()
            },
            write_safe: false,
        });

        caps.push(HardwareCapability {
            id: "system-identity".to_string(),
            label: "System identity confidence".to_string(),
            state: if c.system_info.is_some() { "live" } else { "partial" }.to_string(),
            detail: "WMI and sysinfo identity fusion".to_string(),
            write_safe: true,
        });

        caps
    }

    pub fn telemetry_diagnostics_snapshot(&self) -> TelemetryDiagnosticsSnapshot {
        let sample = self.snapshot();
        let system_info = {
            let sys_guard = self.sysinfo.lock().expect("sysinfo lock");
            self.system_info_snapshot(&sys_guard.sys)
        };
        let cache = self.cache.read().expect("hardware cache read lock");
        let providers = build_provider_diagnostics(&cache);
        let capabilities = self.capability_snapshot();
        let sensors = build_sensor_provenance(&cache, &sample, &capabilities);
        let support_snapshot = build_support_snapshot(&cache, &sample, &capabilities);

        TelemetryDiagnosticsSnapshot {
            created_at: timestamp_now().1,
            overall_state: cache.state.clone(),
            active_provider: active_provider_label(&cache),
            fallback_sequence: cache.provider_load_order.clone(),
            provider_load_order: cache.provider_load_order.clone(),
            providers,
            capabilities,
            sensors,
            support_snapshot,
            support_actions: vec![
                "Support Snapshot".to_string(),
                "Generate OEM Report".to_string(),
                "Validate System Health".to_string(),
            ],
            sensor_discovery: cache.sensor_discovery.clone(),
            hardware_identity: system_info,
            sample,
        }
    }
}

fn active_provider_label(cache: &HardwareCache) -> String {
    match cache.gpu_provider.as_str() {
        "nvml" => "NVML".to_string(),
        "adl2" => "ADL2".to_string(),
        "igcl" => "Intel IGCL".to_string(),
        "wmi" => "WMI fallback".to_string(),
        "none" | "" => "Unavailable".to_string(),
        other => other.to_uppercase(),
    }
}

fn provider_state_from_enabled(enabled: bool, staged: bool) -> String {
    if enabled {
        "loaded".to_string()
    } else if staged {
        "staged".to_string()
    } else {
        "unavailable".to_string()
    }
}

fn build_provider_diagnostics(cache: &HardwareCache) -> Vec<ProviderDiagnostics> {
    let active = cache.gpu_provider.as_str();
    let mut providers = vec![
        ProviderDiagnostics {
            id: "wmi".to_string(),
            label: "WMI / sysinfo".to_string(),
            vendor: "windows".to_string(),
            load_order: 1,
            state: provider_state_from_enabled(true, false),
            active: active == "wmi" || active == "none" || active.is_empty(),
            dll: "ROOT\\CIMV2 + ROOT\\WMI".to_string(),
            dll_available: true,
            symbols_resolved: true,
            symbols: vec![
                "Win32_Processor".to_string(),
                "Win32_VideoController".to_string(),
                "MSAcpi_ThermalZoneTemperature".to_string(),
            ],
            notes: "Primary identity and fallback telemetry source".to_string(),
            warnings: if cache.state == "degraded" {
                vec!["Thermal and vendor GPU data may be reduced".to_string()]
            } else {
                Vec::new()
            },
            errors: Vec::new(),
        },
        ProviderDiagnostics {
            id: "nvml".to_string(),
            label: "NVIDIA NVML".to_string(),
            vendor: "nvidia".to_string(),
            load_order: 2,
            state: provider_state_from_enabled(cache.gpu_vendor == "nvidia" || active == "nvml", false),
            active: active == "nvml",
            dll: "nvml.dll".to_string(),
            dll_available: cache.gpu_vendor == "nvidia" || active == "nvml",
            symbols_resolved: cache.gpu_vendor == "nvidia" || active == "nvml",
            symbols: vec![
                "nvmlInit_v2".to_string(),
                "nvmlDeviceGetTemperature".to_string(),
                "nvmlDeviceGetUtilizationRates".to_string(),
                "nvmlDeviceGetPowerUsage".to_string(),
            ],
            notes: if active == "nvml" {
                "Native NVIDIA telemetry loaded and active".to_string()
            } else {
                "Available only on NVIDIA systems".to_string()
            },
            warnings: if cache.gpu_vendor != "nvidia" {
                vec!["No NVIDIA hardware detected".to_string()]
            } else {
                Vec::new()
            },
            errors: Vec::new(),
        },
        ProviderDiagnostics {
            id: "adl2".to_string(),
            label: "AMD ADL2".to_string(),
            vendor: "amd".to_string(),
            load_order: 3,
            state: provider_state_from_enabled(cache.gpu_vendor == "amd" || active == "adl2", false),
            active: active == "adl2",
            dll: "atiadlxx.dll".to_string(),
            dll_available: cache.gpu_vendor == "amd" || active == "adl2",
            symbols_resolved: cache.gpu_vendor == "amd" || active == "adl2",
            symbols: vec![
                "ADL2_Main_Control_Create".to_string(),
                "ADL2_Overdrive5_Temperature_Get".to_string(),
                "ADL2_Overdrive5_CurrentActivity_Get".to_string(),
            ],
            notes: if active == "adl2" {
                "Native AMD telemetry loaded and active".to_string()
            } else {
                "Available only on AMD systems".to_string()
            },
            warnings: if cache.gpu_vendor != "amd" {
                vec!["No AMD hardware detected".to_string()]
            } else {
                Vec::new()
            },
            errors: Vec::new(),
        },
        ProviderDiagnostics {
            id: "igcl".to_string(),
            label: "Intel IGCL".to_string(),
            vendor: "intel".to_string(),
            load_order: 4,
            state: if cache.intel_igcl_loaded {
                "staged".to_string()
            } else {
                "unavailable".to_string()
            },
            active: active == "igcl",
            dll: "igcl64.dll / ControlLib.dll".to_string(),
            dll_available: cache.intel_igcl_loaded,
            symbols_resolved: cache.intel_igcl_loaded,
            symbols: vec![
                "ctlInit".to_string(),
                "ctlEnumerateDevices".to_string(),
            ],
            notes: if cache.intel_igcl_loaded {
                "Loader scaffold active; sensor bindings staged".to_string()
            } else {
                "Intel Arc loader scaffold not initialised".to_string()
            },
            warnings: if cache.intel_igcl_loaded {
                vec!["Sensor calls remain staged until validation completes".to_string()]
            } else {
                vec!["Intel Arc telemetry remains on fallback paths".to_string()]
            },
            errors: Vec::new(),
        },
    ];

    if let Some(provider) = providers.iter_mut().find(|provider| provider.active) {
        provider.notes = format!("{} Active provider for current GPU path.", provider.notes);
    }

    providers
}

fn confidence_from_state(state: &str, provider: &str, fallback: bool) -> String {
    if state == "live" {
        if fallback {
            return "medium".to_string();
        }
        if provider == "NVML" || provider == "ADL2" {
            return "high".to_string();
        }
        return "medium".to_string();
    }

    match state {
        "partial" | "staged" => "medium".to_string(),
        "blocked" | "driver_required" => "low".to_string(),
        "degraded" | "unsupported" => "low".to_string(),
        "elevated_required" => "low".to_string(),
        _ => "unknown".to_string(),
    }
}

fn build_sensor_provenance(
    cache: &HardwareCache,
    sample: &HardwareSample,
    capabilities: &[HardwareCapability],
) -> Vec<SensorProvenance> {
    let gpu_provider = active_provider_label(cache);
    let gpu_native = gpu_provider == "NVML" || gpu_provider == "ADL2";
    let gpu_fallback = gpu_provider == "WMI fallback";
    let intel_staged = cache.intel_igcl_loaded && cache.gpu_vendor.to_lowercase() == "intel";
    let cpu_requires_driver = cache.sensor_discovery.requires_driver;

    let mut sensors = vec![
        SensorProvenance {
            id: "cpu-temp".to_string(),
            sensor: "CPU Temp".to_string(),
            provider: "WMI ACPI + sysinfo component scan".to_string(),
            provider_state: if cache.cpu_temp.is_some() { "loaded".to_string() } else { "degraded".to_string() },
            state: if cache.cpu_temp.is_some() {
                "live".to_string()
            } else if cpu_requires_driver {
                "driver_required".to_string()
            } else {
                "partial".to_string()
            },
            confidence: confidence_from_state(
                if cache.cpu_temp.is_some() {
                    "live"
                } else if cpu_requires_driver {
                    "driver_required"
                } else {
                    "partial"
                },
                "WMI",
                true,
            ),
            telemetry_quality: if cache.cpu_temp.is_some() {
                "Package thermal channel".to_string()
            } else if cpu_requires_driver {
                "No package channel in user-mode probes".to_string()
            } else {
                "Fallback thermal channel only".to_string()
            },
            fallback_status: if cache.cpu_temp.is_some() {
                "No fallback needed".to_string()
            } else if cpu_requires_driver {
                "Driver-backed provider likely required".to_string()
            } else {
                "Sysinfo CPU usage still live".to_string()
            },
            notes: if cache.cpu_temp.is_some() {
                "Thermal zone temperature is filtered to avoid false positives.".to_string()
            } else {
                cache.sensor_discovery.recommended_action.clone()
            },
            oem_support_status: if cpu_requires_driver {
                "Driver required".to_string()
            } else {
                "Supported with fallback".to_string()
            },
            icon: "thermometer".to_string(),
        },
        SensorProvenance {
            id: "cpu-usage".to_string(),
            sensor: "CPU Usage".to_string(),
            provider: "sysinfo".to_string(),
            provider_state: "loaded".to_string(),
            state: "live".to_string(),
            confidence: "high".to_string(),
            telemetry_quality: "Scheduled polling cache".to_string(),
            fallback_status: "None".to_string(),
            notes: "Derived from refresh tick across logical cores.".to_string(),
            oem_support_status: "Supported".to_string(),
            icon: "cpu".to_string(),
        },
        SensorProvenance {
            id: "memory-usage".to_string(),
            sensor: "RAM Usage".to_string(),
            provider: "sysinfo".to_string(),
            provider_state: "loaded".to_string(),
            state: "live".to_string(),
            confidence: "high".to_string(),
            telemetry_quality: "Physical memory snapshot".to_string(),
            fallback_status: "None".to_string(),
            notes: "Monitored from a cached memory refresh.".to_string(),
            oem_support_status: "Supported".to_string(),
            icon: "memory-stick".to_string(),
        },
        SensorProvenance {
            id: "gpu-core".to_string(),
            sensor: "GPU Core Telemetry".to_string(),
            provider: gpu_provider.clone(),
            provider_state: if gpu_native { "loaded".to_string() } else if intel_staged { "staged".to_string() } else { "degraded".to_string() },
            state: if sample.gpu.temperature.is_some() || sample.gpu.usage > 0.0 { "live".to_string() } else if intel_staged { "staged".to_string() } else if gpu_fallback { "partial".to_string() } else { "degraded".to_string() },
            confidence: confidence_from_state(if sample.gpu.temperature.is_some() || sample.gpu.usage > 0.0 { "live" } else if intel_staged { "staged" } else if gpu_fallback { "partial" } else { "degraded" }, &gpu_provider, gpu_fallback),
            telemetry_quality: if gpu_native { "Native vendor telemetry".to_string() } else if intel_staged { "IGCL loader scaffold only".to_string() } else { "WMI usage fallback".to_string() },
            fallback_status: if gpu_native { "None".to_string() } else if intel_staged { "Fallback sensor binding pending".to_string() } else { "Usage via WMI only".to_string() },
            notes: if gpu_native { "High-trust vendor telemetry path.".to_string() } else if intel_staged { "Intel Arc provider scaffold staged for bindings.".to_string() } else { "GPU data sourced from fallback counters.".to_string() },
            oem_support_status: if gpu_native { "Supported".to_string() } else if intel_staged { "Staged".to_string() } else { "Fallback only".to_string() },
            icon: "gpu".to_string(),
        },
        SensorProvenance {
            id: "gpu-fan".to_string(),
            sensor: "GPU Fan".to_string(),
            provider: gpu_provider.clone(),
            provider_state: if gpu_native { "loaded".to_string() } else if intel_staged { "staged".to_string() } else { "blocked".to_string() },
            state: if sample.gpu.fan_pct.is_some() || sample.fans.iter().any(|fan| fan.rpm.is_some()) { "live".to_string() } else if intel_staged { "staged".to_string() } else { "unsupported".to_string() },
            confidence: confidence_from_state(if sample.gpu.fan_pct.is_some() || sample.fans.iter().any(|fan| fan.rpm.is_some()) { "live" } else if intel_staged { "staged" } else { "unsupported" }, &gpu_provider, gpu_fallback),
            telemetry_quality: if sample.gpu.fan_pct.is_some() || sample.fans.iter().any(|fan| fan.rpm.is_some()) { "Vendor fan telemetry".to_string() } else { "Not exposed by current path".to_string() },
            fallback_status: if sample.gpu.fan_pct.is_some() || sample.fans.iter().any(|fan| fan.rpm.is_some()) { "No fallback needed".to_string() } else { "Requires vendor API or EC support".to_string() },
            notes: "Write controls stay safety-gated regardless of read access.".to_string(),
            oem_support_status: if sample.gpu.fan_pct.is_some() || sample.fans.iter().any(|fan| fan.rpm.is_some()) { "Supported read-only".to_string() } else { "Staged".to_string() },
            icon: "fan".to_string(),
        },
        SensorProvenance {
            id: "gpu-power".to_string(),
            sensor: "GPU Power".to_string(),
            provider: gpu_provider.clone(),
            provider_state: if sample.gpu.power_watts.is_some() { "loaded".to_string() } else if intel_staged { "staged".to_string() } else { "unsupported".to_string() },
            state: if sample.gpu.power_watts.is_some() { "live".to_string() } else if intel_staged { "staged".to_string() } else { "unsupported".to_string() },
            confidence: confidence_from_state(if sample.gpu.power_watts.is_some() { "live" } else if intel_staged { "staged" } else { "unsupported" }, &gpu_provider, gpu_fallback),
            telemetry_quality: if sample.gpu.power_watts.is_some() { "Native vendor wattage".to_string() } else { "Power telemetry unavailable".to_string() },
            fallback_status: if sample.gpu.power_watts.is_some() { "No fallback needed".to_string() } else { "Waiting on vendor API binding".to_string() },
            notes: "Power telemetry is vendor-sensitive and is never inferred silently.".to_string(),
            oem_support_status: if sample.gpu.power_watts.is_some() { "Supported read-only".to_string() } else { "Planned".to_string() },
            icon: "zap".to_string(),
        },
        SensorProvenance {
            id: "storage-smart".to_string(),
            sensor: "NVMe Temp / SMART".to_string(),
            provider: "SMART / DeviceIoControl".to_string(),
            provider_state: "staged".to_string(),
            state: if sample.storage.iter().any(|drive| drive.temperature.is_some()) { "live".to_string() } else { "driver_required".to_string() },
            confidence: if sample.storage.iter().any(|drive| drive.temperature.is_some()) { "medium".to_string() } else { "low".to_string() },
            telemetry_quality: if sample.storage.iter().any(|drive| drive.temperature.is_some()) { "Drive temperature channel present".to_string() } else { "SMART and lifetime channels pending".to_string() },
            fallback_status: "No safe fallback yet".to_string(),
            notes: "SMART expansion will require per-device DeviceIoControl work.".to_string(),
            oem_support_status: "Driver required".to_string(),
            icon: "hard-drive".to_string(),
        },
        SensorProvenance {
            id: "network-throughput".to_string(),
            sensor: "Network Throughput".to_string(),
            provider: "sysinfo".to_string(),
            provider_state: "loaded".to_string(),
            state: "live".to_string(),
            confidence: "high".to_string(),
            telemetry_quality: "Cached throughput delta".to_string(),
            fallback_status: "None".to_string(),
            notes: "Non-loopback adapters only; low-overhead polling.".to_string(),
            oem_support_status: "Supported".to_string(),
            icon: "network".to_string(),
        },
    ];

    if let Some(capability) = capabilities.iter().find(|capability| capability.id == "cooling-control") {
        sensors.push(SensorProvenance {
            id: "cooling-safety".to_string(),
            sensor: "Cooling Control Safety".to_string(),
            provider: "Capability registry".to_string(),
            provider_state: capability.state.clone(),
            state: capability.state.clone(),
            confidence: if capability.state == "live" { "medium".to_string() } else { "low".to_string() },
            telemetry_quality: capability.detail.clone(),
            fallback_status: "Safety lock engaged by default".to_string(),
            notes: "Write-paths stay disabled until model-safe EC profiles exist.".to_string(),
            oem_support_status: "Blocked until validated".to_string(),
            icon: "shield".to_string(),
        });
    }

    sensors
}

fn build_support_snapshot(
    cache: &HardwareCache,
    sample: &HardwareSample,
    capabilities: &[HardwareCapability],
) -> Vec<String> {
    let mut items = vec![
        format!("Active provider: {}", active_provider_label(cache)),
        format!("Provider sequence: {}", cache.provider_load_order.join(" → ")),
        format!("Telemetry state: {}", cache.state),
        format!("Capability coverage: {} entries", capabilities.len()),
        format!("Support confidence: {}", if sample.cpu.temperature.is_some() && sample.gpu.temperature.is_some() { "high" } else { "medium" }),
    ];

    if cache.sensor_discovery.requires_driver {
        items.push(
            "CPU package temperature likely requires OEM/driver-assisted access (driver path not enabled in this build)."
                .to_string(),
        );
    }

    items.push(format!(
        "CPU thermal classification: {}",
        cache.sensor_discovery.issue_classification
    ));
    items.push(format!(
        "GPU engine counters: {}",
        cache.sensor_discovery.gpu_engine_counter_state
    ));

    let intel_adapters = cache
        .sensor_discovery
        .gpu_adapters
        .iter()
        .filter(|adapter| adapter.vendor == "intel")
        .count();
    if intel_adapters > 0 {
        items.push(format!(
            "Intel adapter(s) detected: {}; IGCL path remains staged and WMI fallback is in use when vendor APIs are unavailable.",
            intel_adapters
        ));
    }

    if cache.provider_errors.is_empty() {
        items.push("No provider errors cached.".to_string());
    } else {
        items.push(format!("Provider errors cached: {}", cache.provider_errors.len()));
    }

    if cache.provider_warnings.is_empty() {
        items.push("No provider warnings cached.".to_string());
    } else {
        items.push(format!("Provider warnings cached: {}", cache.provider_warnings.len()));
    }

    items
}

fn build_sysinfo_fallback(sys: &System, cache: &HardwareCache) -> SystemInfo {
    let cpu = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let cpu_vendor = vendor_from_str(&cpu);

    let total_gb = bytes_to_gb(sys.total_memory());
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let storage: Vec<String> = disks
        .iter()
        .map(|d| {
            format!(
                "{} {:.0} GB",
                d.name().to_string_lossy(),
                bytes_to_gb(d.total_space())
            )
        })
        .collect();

    SystemInfo {
        cpu,
        cpu_vendor: cpu_vendor.to_string(),
        gpu: if cache.gpu_name.is_empty() {
            "GPU telemetry initialising…".to_string()
        } else {
            cache.gpu_name.clone()
        },
        gpu_vendor: if cache.gpu_vendor.is_empty() {
            "unknown".to_string()
        } else {
            cache.gpu_vendor.clone()
        },
        motherboard: "Querying…".to_string(),
        ram: format!("{:.0} GB", total_gb),
        ram_speed: "Querying…".to_string(),
        storage,
        psu: "Unavailable via standard Windows APIs".to_string(),
        windows: System::long_os_version().unwrap_or_else(|| "Windows".to_string()),
        bios: "Querying…".to_string(),
    }
}

// ─── Background monitoring loop ─────────────────────────────────────────────

/// Entry point for the long-running hardware monitoring thread.
/// Initialises WMI once, then polls in a tight 1-second loop.
pub fn monitor_loop(
    cache: Arc<RwLock<HardwareCache>>,
    sysinfo: Arc<Mutex<SysinfoState>>,
) {
    // One-shot WMI initialisation (Windows only).
    #[cfg(windows)]
    let wmi_opt = {
        match crate::wmi_provider::WmiContext::init() {
            Ok(ctx) => {
                log::info!("WMI context initialised.");
                Some(ctx)
            }
            Err(e) => {
                log::warn!(
                    "WMI unavailable — temperatures and GPU metrics degraded: {}",
                    e
                );
                None
            }
        }
    };

    #[cfg(windows)]
    let machine_profile_opt = wmi_opt
        .as_ref()
        .map(crate::wmi_provider::query_machine_profile);

    #[cfg(windows)]
    let namespace_inventory = wmi_opt
        .as_ref()
        .map(crate::wmi_provider::collect_namespace_inventory)
        .unwrap_or_default();

    #[cfg(windows)]
    let gpu_adapters = wmi_opt
        .as_ref()
        .map(crate::wmi_provider::query_gpu_adapters)
        .unwrap_or_default();

    #[cfg(windows)]
    let gpu_engine_probe = wmi_opt
        .as_ref()
        .map(crate::wmi_provider::probe_gpu_engine_counter)
        .unwrap_or_else(|| (false, "WMI unavailable; GPU engine counters not queried".to_string()));

    // One-shot vendor GPU provider init (Windows only).
    // Priority: NVML (NVIDIA) → AMD ADL → Intel IGCL groundwork → WMI fallback.
    #[cfg(windows)]
    let nvml_opt: Option<crate::nvml_provider::NvmlContext> =
        crate::nvml_provider::NvmlContext::init();

    #[cfg(windows)]
    let amd_opt: Option<crate::amd_provider::AmdAdlContext> = if nvml_opt.is_none() {
        crate::amd_provider::AmdAdlContext::init()
    } else {
        None
    };

    #[cfg(windows)]
    let igcl_opt: Option<crate::igcl_provider::IntelIgclContext> =
        if nvml_opt.is_none() && amd_opt.is_none() {
            crate::igcl_provider::IntelIgclContext::init()
        } else {
            None
        };

    #[cfg(windows)]
    {
        if igcl_opt.is_some() {
            let mut c = cache.write().expect("cache write");
            c.intel_igcl_loaded = true;
        }
    }

    // Query static identifiers once (GPU name, MB, BIOS, RAM speed).
    #[cfg(windows)]
    {
        if let Some(ctx) = &wmi_opt {
            let static_info = crate::wmi_provider::query_static_system_info(ctx);
            let mut c = cache.write().expect("cache write");
            // Merge WMI static info into cache.
            if !static_info.gpu_name.is_empty() {
                c.gpu_name = static_info.gpu_name.clone();
                c.gpu_vendor = vendor_from_str(&static_info.gpu_name).to_string();
                c.gpu_vram_total_gb = static_info.gpu_vram_total_gb;
            }
            // Persist full system info snapshot.
            c.system_info = Some(static_info.system_info);
        }
    }

    #[cfg(windows)]
    {
        let provider_load_order = vec![
            "WMI / sysinfo".to_string(),
            "NVIDIA NVML".to_string(),
            "AMD ADL2".to_string(),
            "Intel IGCL".to_string(),
        ];

        let provider_diagnostics = vec![
            ProviderDiagnostics {
                id: "wmi".to_string(),
                label: "WMI / sysinfo".to_string(),
                vendor: "windows".to_string(),
                load_order: 1,
                state: if wmi_opt.is_some() { "loaded".to_string() } else { "unavailable".to_string() },
                active: false,
                dll: "ROOT\\CIMV2 + ROOT\\WMI".to_string(),
                dll_available: true,
                symbols_resolved: wmi_opt.is_some(),
                symbols: vec![
                    "Win32_Processor".to_string(),
                    "Win32_VideoController".to_string(),
                    "MSAcpi_ThermalZoneTemperature".to_string(),
                ],
                notes: "Primary identity and fallback telemetry source".to_string(),
                warnings: if wmi_opt.is_some() { Vec::new() } else { vec!["WMI telemetry unavailable; fallback channels will degrade".to_string()] },
                errors: if wmi_opt.is_some() { Vec::new() } else { vec!["WMI context failed to initialise".to_string()] },
            },
            ProviderDiagnostics {
                id: "nvml".to_string(),
                label: "NVIDIA NVML".to_string(),
                vendor: "nvidia".to_string(),
                load_order: 2,
                state: if nvml_opt.is_some() { "loaded".to_string() } else { "unavailable".to_string() },
                active: false,
                dll: "nvml.dll".to_string(),
                dll_available: nvml_opt.is_some(),
                symbols_resolved: nvml_opt.is_some(),
                symbols: vec!["nvmlInit_v2".to_string(), "nvmlDeviceGetTemperature".to_string(), "nvmlDeviceGetUtilizationRates".to_string(), "nvmlDeviceGetPowerUsage".to_string()],
                notes: if nvml_opt.is_some() { "Native NVIDIA telemetry loaded".to_string() } else { "Available only on NVIDIA systems".to_string() },
                warnings: if nvml_opt.is_some() { Vec::new() } else { vec!["No NVIDIA driver API available".to_string()] },
                errors: if nvml_opt.is_some() { Vec::new() } else { vec!["NVML not initialised".to_string()] },
            },
            ProviderDiagnostics {
                id: "adl2".to_string(),
                label: "AMD ADL2".to_string(),
                vendor: "amd".to_string(),
                load_order: 3,
                state: if amd_opt.is_some() { "loaded".to_string() } else { "unavailable".to_string() },
                active: false,
                dll: "atiadlxx.dll".to_string(),
                dll_available: amd_opt.is_some(),
                symbols_resolved: amd_opt.is_some(),
                symbols: vec!["ADL2_Main_Control_Create".to_string(), "ADL2_Overdrive5_Temperature_Get".to_string(), "ADL2_Overdrive5_CurrentActivity_Get".to_string()],
                notes: if amd_opt.is_some() { "Native AMD telemetry loaded".to_string() } else { "Available only on AMD systems".to_string() },
                warnings: if amd_opt.is_some() { Vec::new() } else { vec!["No AMD driver API available".to_string()] },
                errors: if amd_opt.is_some() { Vec::new() } else { vec!["ADL2 not initialised".to_string()] },
            },
            ProviderDiagnostics {
                id: "igcl".to_string(),
                label: "Intel IGCL".to_string(),
                vendor: "intel".to_string(),
                load_order: 4,
                state: if igcl_opt.is_some() { "staged".to_string() } else { "unavailable".to_string() },
                active: false,
                dll: "igcl64.dll / ControlLib.dll".to_string(),
                dll_available: igcl_opt.is_some(),
                symbols_resolved: igcl_opt.is_some(),
                symbols: vec!["ctlInit".to_string(), "ctlEnumerateDevices".to_string()],
                notes: if igcl_opt.is_some() { "Loader scaffold active; sensor bindings staged".to_string() } else { "Intel Arc loader scaffold not initialised".to_string() },
                warnings: if igcl_opt.is_some() { vec!["Sensor calls remain staged until validation completes".to_string()] } else { vec!["Intel Arc telemetry remains on fallback paths".to_string()] },
                errors: if igcl_opt.is_some() { Vec::new() } else { vec!["IGCL not initialised".to_string()] },
            },
        ];

        let provider_warnings = provider_diagnostics.iter().flat_map(|provider| provider.warnings.clone()).collect();
        let provider_errors = provider_diagnostics.iter().flat_map(|provider| provider.errors.clone()).collect();

        let mut c = cache.write().expect("cache write");
        c.provider_load_order = provider_load_order;
        c.provider_diagnostics = provider_diagnostics;
        c.provider_warnings = provider_warnings;
        c.provider_errors = provider_errors;
    }

    // Main polling loop.
    let mut last_cpu_warning_signature = String::new();
    let mut last_cpu_warning_at: Option<Instant> = None;
    loop {
        let tick_start = Instant::now();

        // --- sysinfo refresh (every tick) ---
        let tick = {
            let mut state = sysinfo.lock().expect("sysinfo lock");
            state.tick()
        };

        // --- CPU temperature: WMI paths first, then sysinfo Components fallback ---
        #[cfg(windows)]
        let (cpu_temp, sensor_discovery): (Option<f32>, SensorDiscoveryReport) =
            discover_cpu_temperature(
                wmi_opt.as_ref(),
                machine_profile_opt.as_ref(),
                &namespace_inventory,
                &gpu_adapters,
                &gpu_engine_probe,
            );
        #[cfg(not(windows))]
        let (cpu_temp, sensor_discovery): (Option<f32>, SensorDiscoveryReport) =
            (None, SensorDiscoveryReport::default());

        // --- GPU reading: NVML > AMD ADL > IGCL > WMI fallback (Windows only) ---
        #[cfg(windows)]
        let (gpu_reading, gpu_provider): (Option<GpuReading>, &'static str) = {
            if let Some(ref nvml) = nvml_opt {
                (nvml.query_primary_gpu(), "nvml")
            } else if let Some(ref amd) = amd_opt {
                let mut r = amd.query_primary_gpu();
                // AMD ADL reports RPM via a separate call; wire it into fan_rpm.
                if let Some(ref mut reading) = r {
                    reading.fan_rpm = amd.query_fan_rpm();
                }
                (r, "adl2")
            } else if let Some(ref igcl) = igcl_opt {
                match igcl.query_primary_gpu() {
                    Some(reading) => (Some(reading), "igcl"),
                    None => {
                        if let Some(ctx) = &wmi_opt {
                            let wmi_usage = crate::wmi_provider::query_gpu_usage(ctx);
                            (
                                Some(GpuReading {
                                    usage_pct: wmi_usage,
                                    ..Default::default()
                                }),
                                "wmi",
                            )
                        } else {
                            (None, "igcl")
                        }
                    }
                }
            } else if let Some(ctx) = &wmi_opt {
                // WMI provides GPU usage % only — no temp, fans, or clocks.
                let wmi_usage = crate::wmi_provider::query_gpu_usage(ctx);
                (
                    Some(GpuReading {
                        usage_pct: wmi_usage,
                        ..Default::default()
                    }),
                    "wmi",
                )
            } else {
                (None, "none")
            }
        };
        #[cfg(not(windows))]
        let (gpu_reading, gpu_provider): (Option<GpuReading>, &'static str) = (None, "none");

        // --- Derive state label ---
        let has_cpu = cpu_temp.is_some();
        let has_gpu = gpu_reading
            .as_ref()
            .map_or(false, |g| g.temperature_c.is_some() || g.usage_pct > 0.0);
        let state = if has_cpu || has_gpu { "valid" } else { "degraded" };

        if cpu_temp.is_none() {
            let warning_signature = format!(
                "{}|{}|{}",
                sensor_discovery.machine_vendor,
                sensor_discovery.machine_model,
                sensor_discovery.issue_classification
            );
            let should_log = warning_signature != last_cpu_warning_signature
                || last_cpu_warning_at
                    .map(|last| last.elapsed() >= Duration::from_secs(60))
                    .unwrap_or(true);

            if should_log {
                let probe_summary = sensor_discovery
                    .attempts
                    .iter()
                    .take(8)
                    .map(|a| format!("{}:{} -> {}", a.source, a.label, a.reason))
                    .collect::<Vec<_>>()
                    .join(" | ");
                log::warn!(
                    "CPU temperature unavailable on {} {} [{}]: {}",
                    sensor_discovery.machine_vendor,
                    sensor_discovery.machine_model,
                    sensor_discovery.issue_classification,
                    probe_summary
                );
                last_cpu_warning_signature = warning_signature;
                last_cpu_warning_at = Some(Instant::now());
            }
        }

        // --- Write cache ---
        let (ts, time_str) = timestamp_now();
        {
            let mut c = cache.write().expect("cache write");
            c.timestamp = ts;
            c.state = state.to_string();
            c.cpu_usage = tick.cpu_usage;
            c.cpu_temp = cpu_temp;
            c.sensor_discovery = sensor_discovery;
            c.cpu_clock_mhz = tick.cpu_clock_mhz;
            c.ram_used_gb = tick.ram_used_gb;
            c.ram_total_gb = tick.ram_total_gb;
            c.ram_usage = tick.ram_usage;
            c.net_down_mbps = tick.down_mbps;
            c.net_up_mbps = tick.up_mbps;
            if !tick.adapter_name.is_empty() {
                c.net_adapter_name = tick.adapter_name;
                c.net_adapter_type = tick.adapter_type;
            }
            c.storage = tick.storage;

            // Merge GPU reading into cache.
            if let Some(ref gpu) = gpu_reading {
                if !gpu.name.is_empty() {
                    c.gpu_name = gpu.name.clone();
                    c.gpu_vendor = gpu.vendor.clone();
                }
                c.gpu_usage = gpu.usage_pct;
                c.gpu_temp = gpu.temperature_c;
                if gpu.vram_used_gb > 0.0 {
                    c.gpu_vram_used_gb = gpu.vram_used_gb;
                }
                if gpu.vram_total_gb > 0.0 {
                    c.gpu_vram_total_gb = gpu.vram_total_gb;
                }
                c.gpu_core_clock_mhz = gpu.core_clock_mhz;
                c.gpu_mem_clock_mhz = gpu.mem_clock_mhz;
                c.gpu_fan_pct = gpu.fan_pct;
                c.gpu_fan_rpm = gpu.fan_rpm;
                c.gpu_power_watts = gpu.power_watts;
            }
            c.gpu_provider = gpu_provider.to_string();

            // Rolling history (60 points ≈ 1 minute).
            let gpu_temp_hist = gpu_reading
                .as_ref()
                .and_then(|g| g.temperature_c)
                .unwrap_or(0.0);
            let gpu_usage_hist = gpu_reading
                .as_ref()
                .map(|g| g.usage_pct)
                .unwrap_or(0.0);
            c.history.push(MetricPoint {
                time: time_str,
                cpu_temp: cpu_temp.unwrap_or(0.0),
                cpu_usage: tick.cpu_usage,
                gpu_temp: gpu_temp_hist,
                gpu_usage: gpu_usage_hist,
                ram_usage: tick.ram_usage,
                network_down: tick.down_mbps,
            });
            if c.history.len() > 60 {
                c.history.remove(0);
            }
        }

        // --- Pace to 1-second interval ---
        let elapsed = tick_start.elapsed();
        if elapsed < Duration::from_millis(1000) {
            std::thread::sleep(Duration::from_millis(1000) - elapsed);
        }
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

#[cfg(windows)]
fn discover_cpu_temperature(
    wmi_ctx: Option<&crate::wmi_provider::WmiContext>,
    machine_profile: Option<&crate::wmi_provider::MachineProfile>,
    namespace_inventory: &[NamespaceClassInventory],
    gpu_adapters: &[GpuAdapterDiscovery],
    gpu_engine_probe: &(bool, String),
) -> (Option<f32>, SensorDiscoveryReport) {
    let mut attempts: Vec<SensorDiscoveryAttempt> = Vec::new();
    let mut wmi_max_temp: Option<f32> = None;
    let mut dell_class_hints = Vec::new();

    let (machine_vendor, machine_model, machine_family, is_dell) = if let Some(profile) = machine_profile {
        (
            profile.manufacturer.clone(),
            profile.model.clone(),
            profile.system_family.clone(),
            profile.is_dell,
        )
    } else {
        (
            "Unknown".to_string(),
            "Unknown".to_string(),
            "Unknown".to_string(),
            false,
        )
    };

    if let Some(ctx) = wmi_ctx {
        let wmi_discovery = crate::wmi_provider::collect_thermal_discovery(
            ctx,
            &crate::wmi_provider::MachineProfile {
                manufacturer: machine_vendor.clone(),
                model: machine_model.clone(),
                system_family: machine_family.clone(),
                is_dell,
            },
        );
        for entry in wmi_discovery.records {
            if entry.accepted {
                wmi_max_temp = Some(match wmi_max_temp {
                    Some(current) => current.max(entry.value_c.unwrap_or(current)),
                    None => entry.value_c.unwrap_or_default(),
                });
            }
            attempts.push(SensorDiscoveryAttempt {
                source: entry.source,
                query: entry.query,
                label: entry.label,
                raw_value: entry.raw_value,
                value_c: entry.value_c,
                accepted: entry.accepted,
                reason: entry.reason,
            });
        }
        dell_class_hints = wmi_discovery.dell_class_hints;
    } else {
        attempts.push(SensorDiscoveryAttempt {
            source: "wmi".to_string(),
            query: "WMI context initialization".to_string(),
            label: "ROOT\\CIMV2 / ROOT\\WMI".to_string(),
            raw_value: "unavailable".to_string(),
            value_c: None,
            accepted: false,
            reason: "WMI initialization failed on this runtime".to_string(),
        });
    }

    let components = Components::new_with_refreshed_list();
    let mut sysinfo_candidate_temp: Option<f32> = None;
    for component in components.iter() {
        let label = component.label().to_string();
        let label_lower = label.to_lowercase();
        let preferred_label = label_lower.contains("cpu")
            || label_lower.contains("core")
            || label_lower.contains("package")
            || label_lower.contains("tdie")
            || label_lower.contains("tctl")
            || label_lower.contains("acpi")
            || label_lower.contains("thermal")
            || label_lower.contains("zone")
            || label_lower.contains("platform")
            || label_lower.contains("pch");

        let disallowed_label = label_lower.contains("battery")
            || label_lower.contains("charger")
            || label_lower.contains("adapter")
            || label_lower.contains("unknown");

        let maybe_temp = component.temperature();
        let accepted = maybe_temp
            .map(|temp| (0.0..=120.0).contains(&temp) && !disallowed_label)
            .unwrap_or(false);
        if accepted && preferred_label {
            let value = maybe_temp.unwrap_or_default();
            sysinfo_candidate_temp = Some(match sysinfo_candidate_temp {
                Some(current) => current.max(value),
                None => value,
            });
        }

        attempts.push(SensorDiscoveryAttempt {
            source: "sysinfo-component".to_string(),
            query: "Components::new_with_refreshed_list".to_string(),
            label,
            raw_value: maybe_temp
                .map(|temp| format!("{temp:.2}"))
                .unwrap_or_else(|| "null".to_string()),
            value_c: if accepted { maybe_temp } else { None },
            accepted,
            reason: if maybe_temp.is_none() {
                "component has no temperature value".to_string()
            } else if disallowed_label {
                "rejected non-CPU-oriented component label".to_string()
            } else if !preferred_label {
                "label not in preferred CPU/package pattern".to_string()
            } else {
                "accepted plausible sysinfo thermal value".to_string()
            },
        });
    }

    let cpu_temp = if wmi_max_temp.is_some() {
        wmi_max_temp
    } else {
        sysinfo_candidate_temp
    };

    let requires_driver = cpu_temp.is_none() && is_dell;
    let classification = if cpu_temp.is_some() {
        "available".to_string()
    } else if attempts.iter().any(|attempt| {
        attempt.reason.contains("invalid class") || attempt.reason.contains("unsupported class")
    }) {
        "missing_or_invalid_wmi_class".to_string()
    } else if attempts.iter().any(|attempt| attempt.reason.contains("access denied")) {
        "permissions_or_policy".to_string()
    } else if is_dell && attempts.iter().any(|attempt| attempt.source == "dell-dcim") {
        "unsupported_hardware_exposure_or_missing_oem_provider".to_string()
    } else if requires_driver {
        "driver_level_telemetry_required".to_string()
    } else {
        "user_mode_probe_unavailable".to_string()
    };

    let report = SensorDiscoveryReport {
        machine_vendor,
        machine_model,
        machine_family,
        is_dell,
        package_temp_available: cpu_temp.is_some(),
        requires_driver,
        recommended_action: if cpu_temp.is_some() {
            "CPU package temperature is available through user-mode telemetry paths.".to_string()
        } else if is_dell {
            "No reliable package temperature channel found. This Dell system likely needs an OEM/driver-backed provider for package sensors.".to_string()
        } else {
            "No reliable package temperature channel found. Continue with WMI/sysinfo fallback and collect discovery report for model-specific tuning.".to_string()
        },
        issue_classification: classification,
        dell_class_hints,
        namespace_inventory: namespace_inventory.to_vec(),
        gpu_adapters: gpu_adapters.to_vec(),
        gpu_engine_counter_available: gpu_engine_probe.0,
        gpu_engine_counter_state: gpu_engine_probe.1.clone(),
        attempts,
    };

    (cpu_temp, report)
}

pub fn bytes_to_gb(bytes: u64) -> f32 {
    bytes as f32 / 1_073_741_824.0
}

pub fn adapter_type_from_name(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.contains("wi-fi")
        || lower.contains("wifi")
        || lower.contains("wireless")
        || lower.contains("wlan")
        || lower.contains("802.11")
    {
        "wifi"
    } else if lower.contains("ethernet")
        || lower.contains("local area")
        || lower.contains("lan")
        || lower.contains("realtek")
        || lower.contains("killer")
        || lower.contains("intel(r) ethernet")
    {
        "ethernet"
    } else {
        "unknown"
    }
}

pub fn vendor_from_str(s: &str) -> &'static str {
    let lower = s.to_lowercase();
    if lower.contains("amd") || lower.contains("ryzen") || lower.contains("radeon") {
        "amd"
    } else if lower.contains("intel") || lower.contains("arc") {
        "intel"
    } else if lower.contains("nvidia") || lower.contains("geforce") || lower.contains("rtx") || lower.contains("gtx") {
        "nvidia"
    } else {
        "unknown"
    }
}

pub fn timestamp_now() -> (u128, String) {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs() % 3600;
    let m = secs / 60;
    let s = secs % 60;
    (dur.as_millis(), format!("{m:02}:{s:02}"))
}
