/// Hardware abstraction layer.
///
/// Provides a unified sensor model with graceful degradation when a sensor is
/// unavailable.  All real I/O runs on the dedicated monitoring thread; the
/// Tauri command handlers read from the shared [`HardwareCache`] without
/// blocking.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use sysinfo::{Networks, System};

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

    // One-shot vendor GPU provider init (Windows only).
    // Priority: NVML (NVIDIA) → AMD ADL → WMI fallback.
    #[cfg(windows)]
    let nvml_opt: Option<crate::nvml_provider::NvmlContext> =
        crate::nvml_provider::NvmlContext::init();

    #[cfg(windows)]
    let amd_opt: Option<crate::amd_provider::AmdAdlContext> = if nvml_opt.is_none() {
        crate::amd_provider::AmdAdlContext::init()
    } else {
        None
    };

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

    // Main polling loop.
    loop {
        let tick_start = Instant::now();

        // --- sysinfo refresh (every tick) ---
        let tick = {
            let mut state = sysinfo.lock().expect("sysinfo lock");
            state.tick()
        };

        // --- CPU temperature from WMI (Windows only) ---
        #[cfg(windows)]
        let cpu_temp: Option<f32> = wmi_opt
            .as_ref()
            .and_then(|ctx| crate::wmi_provider::query_cpu_temp(ctx));
        #[cfg(not(windows))]
        let cpu_temp: Option<f32> = None;

        // --- GPU reading: NVML > AMD ADL > WMI fallback (Windows only) ---
        #[cfg(windows)]
        let gpu_reading: Option<GpuReading> = {
            if let Some(ref nvml) = nvml_opt {
                nvml.query_primary_gpu()
            } else if let Some(ref amd) = amd_opt {
                let mut r = amd.query_primary_gpu();
                // AMD ADL reports RPM via a separate call; wire it into fan_rpm.
                if let Some(ref mut reading) = r {
                    reading.fan_rpm = amd.query_fan_rpm();
                }
                r
            } else if let Some(ctx) = &wmi_opt {
                // WMI provides GPU usage % only — no temp, fans, or clocks.
                let wmi_usage = crate::wmi_provider::query_gpu_usage(ctx);
                Some(GpuReading {
                    usage_pct: wmi_usage,
                    ..Default::default()
                })
            } else {
                None
            }
        };
        #[cfg(not(windows))]
        let gpu_reading: Option<GpuReading> = None;

        // --- Derive state label ---
        let has_cpu = cpu_temp.is_some();
        let has_gpu = gpu_reading
            .as_ref()
            .map_or(false, |g| g.temperature_c.is_some() || g.usage_pct > 0.0);
        let state = if has_cpu || has_gpu { "valid" } else { "degraded" };

        // --- Write cache ---
        let (ts, time_str) = timestamp_now();
        {
            let mut c = cache.write().expect("cache write");
            c.timestamp = ts;
            c.state = state.to_string();
            c.cpu_usage = tick.cpu_usage;
            c.cpu_temp = cpu_temp;
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
