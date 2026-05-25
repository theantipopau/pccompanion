/// WMI sensor provider.
///
/// All queries run on the dedicated monitoring thread which owns a single
/// long-lived [`WmiContext`].  The monitoring thread initialises COM once via
/// `COMLibrary::new()`; subsequent connections reuse the same apartment via
/// `COMLibrary::assume_initialized()`.
///
/// Gracefully returns `None` / empty vecs when a class or property is absent.

use serde::Deserialize;
use wmi::{COMLibrary, WMIConnection, WMIResult};

use crate::hardware::{
    bytes_to_gb, vendor_from_str, GpuAdapterDiscovery, NamespaceClassInventory, SystemInfo,
};

// ─── WMI deserialization targets ────────────────────────────────────────────

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiThermalZone {
    Name: Option<String>,
    Temperature: Option<u32>,
}

/// `ROOT\WMI\MSAcpi_ThermalZoneTemperature` — values in tenths of Kelvin.
/// More reliably populated than the perf-counter path on Intel and AMD systems.
#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiAcpiThermalZone {
    InstanceName: Option<String>,
    CurrentTemperature: Option<u32>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiComputerSystem {
    Manufacturer: Option<String>,
    Model: Option<String>,
    SystemFamily: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiClassName {
    #[serde(rename = "__CLASS")]
    class_name: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct DellDcimThermalRow {
    Name: Option<String>,
    ElementName: Option<String>,
    SensorType: Option<String>,
    CurrentReading: Option<i64>,
    CurrentTemperature: Option<i64>,
    CurrentValue: Option<i64>,
    Reading: Option<i64>,
    Value: Option<i64>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiVideoController {
    Name: Option<String>,
    AdapterRAM: Option<u32>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case, dead_code)]
struct WmiGpuEngine {
    Name: Option<String>,
    UtilizationPercentage: Option<u64>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiBios {
    SMBIOSBIOSVersion: Option<String>,
    Manufacturer: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiBaseBoard {
    Manufacturer: Option<String>,
    Product: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiPhysicalMemory {
    Speed: Option<u32>,
    Capacity: Option<u64>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case, dead_code)]
struct WmiProcessor {
    Name: Option<String>,
    Manufacturer: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
struct WmiExternalSensor {
    Name: Option<String>,
    SensorType: Option<String>,
    Value: Option<f64>,
}

// ─── WMI context ────────────────────────────────────────────────────────────

/// Holds the long-lived WMI connections for the monitoring thread.
pub struct WmiContext {
    /// `ROOT\CIMV2` — hardware identity, BIOS, MB, GPU name, GPU usage, temps.
    pub cimv2: WMIConnection,
    /// `ROOT\WMI` — ACPI thermal zones (more reliable CPU temp on most systems).
    pub root_wmi: Option<WMIConnection>,
    /// `ROOT\dcim\sysman` - optional Dell OEM namespace.
    pub root_dcim_sysman: Option<WMIConnection>,
    /// `ROOT\dcim` - optional Dell OEM namespace root.
    pub root_dcim: Option<WMIConnection>,
    /// `ROOT\LibreHardwareMonitor` - optional external LHM sensor bridge.
    pub root_libre_hardware_monitor: Option<WMIConnection>,
    /// `ROOT\OpenHardwareMonitor` - optional external OHM sensor bridge.
    pub root_open_hardware_monitor: Option<WMIConnection>,
}

impl WmiContext {
    pub fn init() -> WMIResult<Self> {
        let com = COMLibrary::new()?;
        let cimv2 = WMIConnection::with_namespace_path("ROOT\\CIMV2", com)?;
        // Second connection to ROOT\WMI for ACPI thermal data.
        // Uses assume_initialized() since COM is already initialised above.
        let root_wmi = {
            let com2 = unsafe { COMLibrary::assume_initialized() };
            WMIConnection::with_namespace_path("ROOT\\WMI", com2).ok()
        };
        let root_dcim_sysman = {
            let com3 = unsafe { COMLibrary::assume_initialized() };
            WMIConnection::with_namespace_path("ROOT\\dcim\\sysman", com3).ok()
        };
        let root_dcim = {
            let com4 = unsafe { COMLibrary::assume_initialized() };
            WMIConnection::with_namespace_path("ROOT\\dcim", com4).ok()
        };
        let root_libre_hardware_monitor = {
            let com5 = unsafe { COMLibrary::assume_initialized() };
            WMIConnection::with_namespace_path("ROOT\\LibreHardwareMonitor", com5).ok()
        };
        let root_open_hardware_monitor = {
            let com6 = unsafe { COMLibrary::assume_initialized() };
            WMIConnection::with_namespace_path("ROOT\\OpenHardwareMonitor", com6).ok()
        };
        Ok(Self {
            cimv2,
            root_wmi,
            root_dcim_sysman,
            root_dcim,
            root_libre_hardware_monitor,
            root_open_hardware_monitor,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct ExternalHardwareMonitorSample {
    pub provider: String,
    pub cpu_temp_c: Option<f32>,
    pub gpu_temp_c: Option<f32>,
    pub cpu_fan_rpm: Option<u32>,
    pub gpu_fan_rpm: Option<u32>,
}

#[derive(Debug, Clone, Default)]
pub struct MachineProfile {
    pub manufacturer: String,
    pub model: String,
    pub system_family: String,
    pub is_dell: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ThermalProbeRecord {
    pub source: String,
    pub query: String,
    pub label: String,
    pub raw_value: String,
    pub value_c: Option<f32>,
    pub accepted: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Default)]
pub struct ThermalDiscoveryData {
    pub records: Vec<ThermalProbeRecord>,
    pub dell_class_hints: Vec<String>,
}

fn normalize_thermal_raw_celsius(raw: u32) -> Option<(f32, &'static str)> {
    let decikelvin_c = raw as f32 / 10.0 - 273.15;
    if (0.0..=120.0).contains(&decikelvin_c) {
        return Some((decikelvin_c, "decikelvin"));
    }

    let kelvin_c = raw as f32 - 273.15;
    if (0.0..=120.0).contains(&kelvin_c) {
        return Some((kelvin_c, "kelvin"));
    }

    // Some firmware/providers surface direct Celsius values.
    let celsius = raw as f32;
    if (0.0..=120.0).contains(&celsius) {
        return Some((celsius, "celsius"));
    }

    None
}

fn normalize_signed_thermal_raw_celsius(raw: i64) -> Option<(f32, &'static str)> {
    if (0..=u32::MAX as i64).contains(&raw) {
        if let Some((value, unit)) = normalize_thermal_raw_celsius(raw as u32) {
            return Some((value, unit));
        }
    }

    if (-20..=120).contains(&raw) {
        return Some((raw as f32, "celsius-signed"));
    }

    None
}

fn rejected_thermal_reason(raw: u32) -> String {
    let dk = raw as f32 / 10.0 - 273.15;
    let k = raw as f32 - 273.15;
    let c = raw as f32;
    format!(
        "rejected raw thermal value (dk={dk:.1} C, k={k:.1} C, c={c:.1} C)"
    )
}

fn extract_hresult_code(message: &str) -> Option<u32> {
    let lower = message.to_lowercase();
    let marker = "0x";
    let idx = lower.find(marker)?;
    let hex = lower
        .chars()
        .skip(idx + marker.len())
        .take_while(|ch| ch.is_ascii_hexdigit())
        .collect::<String>();
    if hex.is_empty() {
        None
    } else {
        u32::from_str_radix(&hex, 16).ok()
    }
}

fn classify_wmi_error(message: &str) -> String {
    match extract_hresult_code(message) {
        Some(0x80041010) => "invalid class (0x80041010): provider namespace exists but class is not published on this system".to_string(),
        Some(0x8004100C) => "not supported (0x8004100C): firmware/provider does not expose this telemetry path".to_string(),
        Some(0x8004100E) => "invalid namespace (0x8004100E): OEM namespace is not installed".to_string(),
        Some(0x80041003) => "access denied (0x80041003): permissions or policy blocked this query".to_string(),
        Some(code) => format!("query failed with HRESULT 0x{code:08X}"),
        None => format!("query failed: {message}"),
    }
}

fn collect_namespace_classes(
    namespace: &str,
    conn: Option<&WMIConnection>,
) -> NamespaceClassInventory {
    let keywords = ["thermal", "temperature", "sensor", "fan", "gpu"];
    let mut inventory = NamespaceClassInventory {
        namespace: namespace.to_string(),
        available: conn.is_some(),
        status: String::new(),
        matching_classes: Vec::new(),
    };

    let Some(connection) = conn else {
        inventory.status = "namespace connection unavailable".to_string();
        return inventory;
    };

    match connection.raw_query::<WmiClassName>("SELECT __CLASS FROM meta_class") {
        Ok(rows) => {
            let matches = rows
                .into_iter()
                .filter_map(|row| row.class_name)
                .filter(|name| {
                    let lower = name.to_lowercase();
                    keywords.iter().any(|keyword| lower.contains(keyword))
                })
                .collect::<Vec<_>>();
            inventory.status = format!("{} matching class(es)", matches.len());
            inventory.matching_classes = matches;
        }
        Err(err) => {
            inventory.status = classify_wmi_error(&err.to_string());
        }
    }

    inventory
}

pub fn collect_namespace_inventory(ctx: &WmiContext) -> Vec<NamespaceClassInventory> {
    vec![
        collect_namespace_classes("ROOT\\WMI", ctx.root_wmi.as_ref()),
        collect_namespace_classes("ROOT\\CIMV2", Some(&ctx.cimv2)),
        collect_namespace_classes("ROOT\\dcim", ctx.root_dcim.as_ref()),
        collect_namespace_classes("ROOT\\dcim\\sysman", ctx.root_dcim_sysman.as_ref()),
        collect_namespace_classes(
            "ROOT\\LibreHardwareMonitor",
            ctx.root_libre_hardware_monitor.as_ref(),
        ),
        collect_namespace_classes(
            "ROOT\\OpenHardwareMonitor",
            ctx.root_open_hardware_monitor.as_ref(),
        ),
    ]
}

fn looks_like_cpu_label(label: &str) -> bool {
    let l = label.to_lowercase();
    l.contains("cpu")
        || l.contains("package")
        || l.contains("tctl")
        || l.contains("tdie")
        || l.contains("ccd")
        || l.contains("core")
}

fn looks_like_gpu_label(label: &str) -> bool {
    let l = label.to_lowercase();
    l.contains("gpu") || l.contains("graphics")
}

fn update_external_sample_from_rows(
    provider: &str,
    rows: &[WmiExternalSensor],
) -> ExternalHardwareMonitorSample {
    let mut sample = ExternalHardwareMonitorSample {
        provider: provider.to_string(),
        ..Default::default()
    };

    for row in rows {
        let name = row.Name.clone().unwrap_or_default();
        let sensor_type = row.SensorType.clone().unwrap_or_default().to_lowercase();
        let value = row.Value.unwrap_or_default() as f32;

        if value <= 0.0 {
            continue;
        }

        if sensor_type == "temperature" && (0.0..=120.0).contains(&value) {
            if looks_like_cpu_label(&name) {
                sample.cpu_temp_c = Some(sample.cpu_temp_c.map_or(value, |curr| curr.max(value)));
            } else if looks_like_gpu_label(&name) {
                sample.gpu_temp_c = Some(sample.gpu_temp_c.map_or(value, |curr| curr.max(value)));
            }
        }

        if sensor_type == "fan" {
            let rpm = value.round() as u32;
            if rpm > 0 {
                if looks_like_cpu_label(&name) {
                    sample.cpu_fan_rpm = Some(sample.cpu_fan_rpm.map_or(rpm, |curr| curr.max(rpm)));
                } else if looks_like_gpu_label(&name) {
                    sample.gpu_fan_rpm = Some(sample.gpu_fan_rpm.map_or(rpm, |curr| curr.max(rpm)));
                }
            }
        }
    }

    sample
}

fn query_external_sensor_namespace(
    connection: Option<&WMIConnection>,
    provider: &str,
) -> Option<ExternalHardwareMonitorSample> {
    let conn = connection?;
    let res: Result<Vec<WmiExternalSensor>, _> =
        conn.raw_query("SELECT Name, SensorType, Value FROM Sensor");
    let rows = res.ok()?;
    if rows.is_empty() {
        return None;
    }

    let sample = update_external_sample_from_rows(provider, &rows);
    if sample.cpu_temp_c.is_some()
        || sample.gpu_temp_c.is_some()
        || sample.cpu_fan_rpm.is_some()
        || sample.gpu_fan_rpm.is_some()
    {
        Some(sample)
    } else {
        None
    }
}

pub fn query_external_hardware_monitor_sample(
    ctx: &WmiContext,
) -> Option<ExternalHardwareMonitorSample> {
    // Prefer LibreHardwareMonitor namespace when available, fallback to
    // OpenHardwareMonitor namespace.
    query_external_sensor_namespace(
        ctx.root_libre_hardware_monitor.as_ref(),
        "libre-hardware-monitor",
    )
    .or_else(|| {
        query_external_sensor_namespace(
            ctx.root_open_hardware_monitor.as_ref(),
            "open-hardware-monitor",
        )
    })
}

pub fn query_gpu_adapters(ctx: &WmiContext) -> Vec<GpuAdapterDiscovery> {
    let res: Result<Vec<WmiVideoController>, _> = ctx
        .cimv2
        .raw_query("SELECT Name, AdapterRAM FROM Win32_VideoController");
    let Ok(rows) = res else {
        return Vec::new();
    };

    rows
        .into_iter()
        .filter_map(|row| {
            let name = row.Name?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let vendor = vendor_from_str(&name).to_string();
            let ram_bytes = row.AdapterRAM.unwrap_or(0);
            let ram_gb = bytes_to_gb(ram_bytes as u64);
            let integrated = vendor == "intel" || ram_gb <= 1.5;
            Some(GpuAdapterDiscovery {
                name,
                vendor,
                adapter_ram_gb: ram_gb,
                integrated,
            })
        })
        .collect()
}

pub fn probe_gpu_engine_counter(ctx: &WmiContext) -> (bool, String) {
    let query =
        "SELECT Name, UtilizationPercentage FROM Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine";
    let res: Result<Vec<WmiGpuEngine>, _> = ctx.cimv2.raw_query(query);
    match res {
        Ok(rows) if rows.is_empty() => {
            (false, "GPU engine class available but returned no rows".to_string())
        }
        Ok(rows) => {
            let has_values = rows.iter().any(|row| row.UtilizationPercentage.is_some());
            if has_values {
                (true, format!("GPU engine counters live ({} row(s))", rows.len()))
            } else {
                (
                    false,
                    format!(
                        "GPU engine class returned {} row(s) without UtilizationPercentage values",
                        rows.len()
                    ),
                )
            }
        }
        Err(err) => (false, classify_wmi_error(&err.to_string())),
    }
}

pub fn query_machine_profile(ctx: &WmiContext) -> MachineProfile {
    let res: Result<Vec<WmiComputerSystem>, _> = ctx
        .cimv2
        .raw_query("SELECT Manufacturer, Model, SystemFamily FROM Win32_ComputerSystem");

    let mut profile = res
        .ok()
        .and_then(|rows| rows.into_iter().next())
        .map(|row| MachineProfile {
            manufacturer: row.Manufacturer.unwrap_or_default().trim().to_string(),
            model: row.Model.unwrap_or_default().trim().to_string(),
            system_family: row.SystemFamily.unwrap_or_default().trim().to_string(),
            is_dell: false,
        })
        .unwrap_or_default();

    let combined = format!(
        "{} {} {}",
        profile.manufacturer.to_lowercase(),
        profile.model.to_lowercase(),
        profile.system_family.to_lowercase()
    );
    profile.is_dell = combined.contains("dell") || combined.contains("alienware");
    profile
}

pub fn collect_thermal_discovery(ctx: &WmiContext, machine: &MachineProfile) -> ThermalDiscoveryData {
    let mut data = ThermalDiscoveryData {
        records: Vec::new(),
        dell_class_hints: Vec::new(),
    };

    if let Some(ref root_wmi) = ctx.root_wmi {
        let acpi_query = "SELECT InstanceName, CurrentTemperature FROM MSAcpi_ThermalZoneTemperature";
        match root_wmi.raw_query::<WmiAcpiThermalZone>(acpi_query) {
            Ok(rows) => {
                if rows.is_empty() {
                    data.records.push(ThermalProbeRecord {
                        source: "wmi-acpi".to_string(),
                        query: acpi_query.to_string(),
                        label: "MSAcpi_ThermalZoneTemperature".to_string(),
                        raw_value: "none".to_string(),
                        value_c: None,
                        accepted: false,
                        reason: "class available but returned no rows".to_string(),
                    });
                }

                for row in rows {
                    let label = row
                        .InstanceName
                        .unwrap_or_else(|| "ACPI thermal zone".to_string());
                    match row.CurrentTemperature {
                        Some(raw) => {
                            let parsed = normalize_thermal_raw_celsius(raw);
                            let accepted = parsed.is_some();
                            data.records.push(ThermalProbeRecord {
                                source: "wmi-acpi".to_string(),
                                query: acpi_query.to_string(),
                                label,
                                raw_value: raw.to_string(),
                                value_c: parsed.map(|(value, _)| value),
                                accepted,
                                reason: if accepted {
                                    let (_, unit) = parsed.unwrap_or_default();
                                    format!("accepted thermal value via {unit} conversion")
                                } else {
                                    rejected_thermal_reason(raw)
                                },
                            });
                        }
                        None => {
                            data.records.push(ThermalProbeRecord {
                                source: "wmi-acpi".to_string(),
                                query: acpi_query.to_string(),
                                label,
                                raw_value: "null".to_string(),
                                value_c: None,
                                accepted: false,
                                reason: "CurrentTemperature missing".to_string(),
                            });
                        }
                    }
                }
            }
            Err(err) => {
                data.records.push(ThermalProbeRecord {
                    source: "wmi-acpi".to_string(),
                    query: acpi_query.to_string(),
                    label: "MSAcpi_ThermalZoneTemperature".to_string(),
                    raw_value: "query_error".to_string(),
                    value_c: None,
                    accepted: false,
                    reason: classify_wmi_error(&err.to_string()),
                });
            }
        }

        let dell_meta_query = "SELECT __CLASS FROM meta_class WHERE __CLASS LIKE 'Dell%'";
        if let Ok(classes) = root_wmi.raw_query::<WmiClassName>(dell_meta_query) {
            data.dell_class_hints = classes
                .into_iter()
                .filter_map(|entry| entry.class_name)
                .collect();
        }
    } else {
        data.records.push(ThermalProbeRecord {
            source: "wmi-acpi".to_string(),
            query: "ROOT\\WMI unavailable".to_string(),
            label: "MSAcpi_ThermalZoneTemperature".to_string(),
            raw_value: "namespace_unavailable".to_string(),
            value_c: None,
            accepted: false,
            reason: "ROOT\\WMI connection unavailable".to_string(),
        });
    }

    let perf_query =
        "SELECT Name, Temperature FROM Win32_PerfFormattedData_Counters_ThermalZoneInformation";
    match ctx.cimv2.raw_query::<WmiThermalZone>(perf_query) {
        Ok(rows) => {
            if rows.is_empty() {
                data.records.push(ThermalProbeRecord {
                    source: "wmi-perf".to_string(),
                    query: perf_query.to_string(),
                    label: "ThermalZoneInformation".to_string(),
                    raw_value: "none".to_string(),
                    value_c: None,
                    accepted: false,
                    reason: "perf thermal class returned no rows".to_string(),
                });
            }

            for row in rows {
                let label = row.Name.unwrap_or_else(|| "Thermal zone".to_string());
                match row.Temperature {
                    Some(raw) => {
                        let parsed = normalize_thermal_raw_celsius(raw);
                        let accepted = parsed.is_some();
                        data.records.push(ThermalProbeRecord {
                            source: "wmi-perf".to_string(),
                            query: perf_query.to_string(),
                            label,
                            raw_value: raw.to_string(),
                            value_c: parsed.map(|(value, _)| value),
                            accepted,
                            reason: if accepted {
                                let (_, unit) = parsed.unwrap_or_default();
                                format!("accepted thermal value via {unit} conversion")
                            } else {
                                rejected_thermal_reason(raw)
                            },
                        });
                    }
                    None => {
                        data.records.push(ThermalProbeRecord {
                            source: "wmi-perf".to_string(),
                            query: perf_query.to_string(),
                            label,
                            raw_value: "null".to_string(),
                            value_c: None,
                            accepted: false,
                            reason: "Temperature missing".to_string(),
                        });
                    }
                }
            }
        }
        Err(err) => {
            data.records.push(ThermalProbeRecord {
                source: "wmi-perf".to_string(),
                query: perf_query.to_string(),
                label: "ThermalZoneInformation".to_string(),
                raw_value: "query_error".to_string(),
                value_c: None,
                accepted: false,
                reason: classify_wmi_error(&err.to_string()),
            });
        }
    }

    let dcim_status = if ctx.root_dcim_sysman.is_some() {
        "available"
    } else {
        "unavailable"
    };

    if let Some(ref dcim) = ctx.root_dcim_sysman {
        let class_queries = [
            ("DCIM_TemperatureProbe", "SELECT * FROM DCIM_TemperatureProbe"),
            ("DCIM_ThermalProbe", "SELECT * FROM DCIM_ThermalProbe"),
            ("DCIM_ThermalZone", "SELECT * FROM DCIM_ThermalZone"),
        ];

        let mut had_dcim_rows = false;
        for (class_name, query) in class_queries {
            match dcim.raw_query::<DellDcimThermalRow>(query) {
                Ok(rows) => {
                    if rows.is_empty() {
                        data.records.push(ThermalProbeRecord {
                            source: "dell-dcim".to_string(),
                            query: query.to_string(),
                            label: class_name.to_string(),
                            raw_value: "none".to_string(),
                            value_c: None,
                            accepted: false,
                            reason: format!("{class_name} returned no rows"),
                        });
                        continue;
                    }

                    had_dcim_rows = true;
                    for row in rows {
                        let label = row
                            .ElementName
                            .or(row.Name)
                            .or(row.SensorType)
                            .unwrap_or_else(|| format!("{class_name} sensor"));

                        let raw = row
                            .CurrentTemperature
                            .or(row.CurrentReading)
                            .or(row.CurrentValue)
                            .or(row.Reading)
                            .or(row.Value);

                        match raw {
                            Some(raw_value) => {
                                let parsed = normalize_signed_thermal_raw_celsius(raw_value);
                                let accepted = parsed.is_some();
                                data.records.push(ThermalProbeRecord {
                                    source: "dell-dcim".to_string(),
                                    query: query.to_string(),
                                    label,
                                    raw_value: raw_value.to_string(),
                                    value_c: parsed.map(|(v, _)| v),
                                    accepted,
                                    reason: if accepted {
                                        let (_, unit) = parsed.unwrap_or_default();
                                        format!("accepted Dell DCIM thermal value via {unit} conversion")
                                    } else {
                                        format!("{class_name} value not in plausible range")
                                    },
                                });
                            }
                            None => {
                                data.records.push(ThermalProbeRecord {
                                    source: "dell-dcim".to_string(),
                                    query: query.to_string(),
                                    label,
                                    raw_value: "null".to_string(),
                                    value_c: None,
                                    accepted: false,
                                    reason: format!("{class_name} row missing readable temperature fields"),
                                });
                            }
                        }
                    }
                }
                Err(err) => {
                    data.records.push(ThermalProbeRecord {
                        source: "dell-dcim".to_string(),
                        query: query.to_string(),
                        label: class_name.to_string(),
                        raw_value: "query_error".to_string(),
                        value_c: None,
                        accepted: false,
                        reason: classify_wmi_error(&err.to_string()),
                    });
                }
            }
        }

        if !had_dcim_rows {
            data.records.push(ThermalProbeRecord {
                source: "dell-dcim".to_string(),
                query: "ROOT\\dcim\\sysman".to_string(),
                label: "Dell namespace probe".to_string(),
                raw_value: dcim_status.to_string(),
                value_c: None,
                accepted: false,
                reason: "Dell DCIM namespace detected but known thermal classes were empty or unavailable"
                    .to_string(),
            });
        }
    } else {
        data.records.push(ThermalProbeRecord {
            source: "dell-dcim".to_string(),
            query: "ROOT\\dcim\\sysman".to_string(),
            label: "Dell namespace probe".to_string(),
            raw_value: dcim_status.to_string(),
            value_c: None,
            accepted: false,
            reason: if machine.is_dell {
                "Dell system detected but DCIM namespace not present".to_string()
            } else {
                "Not a Dell/Alienware machine profile".to_string()
            },
        });
    }

    data
}

// ─── Static system info (queried once at startup) ───────────────────────────

pub struct StaticSystemInfo {
    pub gpu_name: String,
    pub gpu_vram_total_gb: f32,
    pub system_info: SystemInfo,
}

pub fn query_static_system_info(ctx: &WmiContext) -> StaticSystemInfo {
    // GPU
    let (gpu_name, gpu_vram_total_gb) = query_gpu_static(ctx);
    let gpu_vendor = vendor_from_str(&gpu_name).to_string();

    // Processor (WMI name is more detailed than sysinfo on some systems)
    let cpu_name = query_cpu_name(ctx);
    let cpu_vendor = vendor_from_str(&cpu_name).to_string();

    // Motherboard
    let motherboard = query_motherboard(ctx);

    // BIOS
    let bios = query_bios(ctx);

    // RAM
    let (ram_gb, ram_speed) = query_ram_info(ctx);

    // Storage
    let storage_list = query_storage_list(ctx);

    let system_info = SystemInfo {
        cpu: cpu_name,
        cpu_vendor,
        gpu: gpu_name.clone(),
        gpu_vendor,
        motherboard,
        ram: ram_gb,
        ram_speed,
        storage: storage_list,
        psu: "Unavailable via standard Windows APIs".to_string(),
        windows: sysinfo::System::long_os_version()
            .unwrap_or_else(|| "Windows".to_string()),
        bios,
    };

    StaticSystemInfo {
        gpu_name,
        gpu_vram_total_gb,
        system_info,
    }
}

fn query_cpu_name(ctx: &WmiContext) -> String {
    // Primary: WMI Win32_Processor.Name
    let res: Result<Vec<WmiProcessor>, _> = ctx.cimv2.raw_query(
        "SELECT Name FROM Win32_Processor",
    );
    let wmi_name = res.ok()
        .and_then(|v| v.into_iter().next())
        .and_then(|p| p.Name)
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty());

    if let Some(name) = wmi_name {
        return name;
    }

    // Fallback: registry HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0
    if let Ok(Some(name)) = read_cpu_name_from_registry() {
        return name;
    }

    "Unknown CPU".to_string()
}

fn read_cpu_name_from_registry() -> Result<Option<String>, ()> {
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, KEY_READ, REG_VALUE_TYPE,
    };
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;

    let key_path: Vec<u16> = "HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0\0"
        .encode_utf16()
        .collect();
    let value_name: Vec<u16> = "ProcessorNameString\0".encode_utf16().collect();

    unsafe {
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        let status = RegOpenKeyExW(
            windows::Win32::System::Registry::HKEY_LOCAL_MACHINE,
            PCWSTR(key_path.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        );
        if status != ERROR_SUCCESS {
            return Ok(None);
        }

        let mut data_type = REG_VALUE_TYPE::default();
        let mut data_len = 0u32;
        // First call: get length
        let _ = RegQueryValueExW(
            hkey,
            PCWSTR(value_name.as_ptr()),
            None,
            Some(&mut data_type),
            None,
            Some(&mut data_len),
        );

        if data_len == 0 {
            let _ = RegCloseKey(hkey);
            return Ok(None);
        }

        let mut buf = vec![0u8; data_len as usize];
        let status2 = RegQueryValueExW(
            hkey,
            PCWSTR(value_name.as_ptr()),
            None,
            None,
            Some(buf.as_mut_ptr()),
            Some(&mut data_len),
        );
        let _ = RegCloseKey(hkey);

        if status2 != ERROR_SUCCESS {
            return Ok(None);
        }

        // Interpret as UTF-16
        let words: Vec<u16> = buf
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        let trimmed = String::from_utf16_lossy(&words)
            .trim_matches('\0')
            .trim()
            .to_string();
        Ok(if trimmed.is_empty() { None } else { Some(trimmed) })
    }
}

fn query_gpu_static(ctx: &WmiContext) -> (String, f32) {
    let res: Result<Vec<WmiVideoController>, _> =
        ctx.cimv2.raw_query("SELECT Name, AdapterRAM FROM Win32_VideoController");

    let controllers = res.unwrap_or_default();

    // Prefer the adapter with the most VRAM (discrete GPU heuristic).
    let best = controllers.into_iter().max_by_key(|vc| vc.AdapterRAM.unwrap_or(0));

    match best {
        Some(vc) => {
            let name = vc.Name.unwrap_or_default().trim().to_string();
            // AdapterRAM is u32 but can wrap for >4 GB VRAM — treat as rough estimate.
            let vram_gb = vc.AdapterRAM.map(|r| r as f32 / 1_073_741_824.0).unwrap_or(0.0);
            (name, vram_gb)
        }
        None => ("GPU unavailable".to_string(), 0.0),
    }
}

fn query_motherboard(ctx: &WmiContext) -> String {
    let res: Result<Vec<WmiBaseBoard>, _> =
        ctx.cimv2.raw_query("SELECT Manufacturer, Product FROM Win32_BaseBoard");
    res.ok()
        .and_then(|v| v.into_iter().next())
        .map(|b| {
            let mfr = b.Manufacturer.unwrap_or_default().trim().to_string();
            let prod = b.Product.unwrap_or_default().trim().to_string();
            if mfr.is_empty() && prod.is_empty() {
                "Unknown".to_string()
            } else if mfr.is_empty() {
                prod
            } else if prod.is_empty() {
                mfr
            } else {
                format!("{mfr} {prod}")
            }
        })
        .unwrap_or_else(|| "Unknown".to_string())
}

fn query_bios(ctx: &WmiContext) -> String {
    let res: Result<Vec<WmiBios>, _> = ctx
        .cimv2
        .raw_query("SELECT SMBIOSBIOSVersion, Manufacturer FROM Win32_BIOS");
    res.ok()
        .and_then(|v| v.into_iter().next())
        .map(|b| {
            let ver = b.SMBIOSBIOSVersion.unwrap_or_default().trim().to_string();
            let mfr = b.Manufacturer.unwrap_or_default().trim().to_string();
            if mfr.is_empty() {
                ver
            } else {
                format!("{mfr} {ver}")
            }
        })
        .unwrap_or_else(|| "Unknown".to_string())
}

fn query_ram_info(ctx: &WmiContext) -> (String, String) {
    let res: Result<Vec<WmiPhysicalMemory>, _> = ctx
        .cimv2
        .raw_query("SELECT Speed, Capacity FROM Win32_PhysicalMemory");

    let sticks = res.unwrap_or_default();
    if sticks.is_empty() {
        return ("Unknown".to_string(), "Unknown".to_string());
    }

    let total_bytes: u64 = sticks.iter().filter_map(|s| s.Capacity).sum();
    let total_gb = bytes_to_gb(total_bytes);

    // Use the speed of the first populated stick.
    let speed = sticks
        .iter()
        .filter_map(|s| s.Speed)
        .next()
        .unwrap_or(0);

    let ram_str = format!("{:.0} GB", total_gb);
    let speed_str = if speed > 0 {
        format!("{speed} MT/s")
    } else {
        "Unknown speed".to_string()
    };
    (ram_str, speed_str)
}

fn query_storage_list(ctx: &WmiContext) -> Vec<String> {
    // Try WMI Win32_DiskDrive first for real model names.
    #[derive(Deserialize, Debug)]
    #[allow(non_snake_case)]
    struct WmiDiskDrive {
        Model: Option<String>,
        Size: Option<u64>,
    }

    let wmi_result: Result<Vec<WmiDiskDrive>, _> = ctx
        .cimv2
        .raw_query("SELECT Model, Size FROM Win32_DiskDrive ORDER BY Size DESC");

    if let Ok(drives) = wmi_result {
        if !drives.is_empty() {
            let list: Vec<String> = drives
                .into_iter()
                .map(|d| {
                    let model = d.Model.unwrap_or_else(|| "Unknown Drive".to_string());
                    let size_gb = d.Size.map(bytes_to_gb).unwrap_or(0.0);
                    if size_gb > 0.0 {
                        format!("{} ({:.0} GB)", model, size_gb)
                    } else {
                        model
                    }
                })
                .collect();
            return list;
        }
    }

    // Fallback: sysinfo disk list.
    let disks = sysinfo::Disks::new_with_refreshed_list();
    disks
        .iter()
        .filter(|d| d.total_space() > 0)
        .map(|d| {
            format!(
                "{} {:.0} GB",
                d.name().to_string_lossy(),
                bytes_to_gb(d.total_space())
            )
        })
        .collect()
}

// ─── Dynamic CPU temperature ─────────────────────────────────────────────────

/// Query thermal zone temperatures via
/// `Win32_PerfFormattedData_Counters_ThermalZoneInformation`.
///
/// Returns the highest plausible temperature in °C, or `None` if unavailable.
#[allow(dead_code)]
pub fn query_cpu_temp(ctx: &WmiContext) -> Option<f32> {
    // --- Path 1: ROOT\WMI\MSAcpi_ThermalZoneTemperature (tenths of Kelvin) ---
    // More reliably populated on Intel and AMD systems via ACPI firmware.
    if let Some(ref root_wmi) = ctx.root_wmi {
        let res: Result<Vec<WmiAcpiThermalZone>, _> = root_wmi
            .raw_query("SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature");
        if let Ok(zones) = res {
            let temps: Vec<f32> = zones
                .into_iter()
                .filter_map(|z| z.CurrentTemperature)
                .filter_map(|raw| normalize_thermal_raw_celsius(raw).map(|(c, _)| c))
                .collect();
            if !temps.is_empty() {
                return temps.into_iter().reduce(f32::max);
            }
        }
    }

    // --- Path 2: ROOT\CIMV2 perf-counter thermal zones (Kelvin) ---
    let res: Result<Vec<WmiThermalZone>, _> = ctx.cimv2.raw_query(
        "SELECT Temperature FROM Win32_PerfFormattedData_Counters_ThermalZoneInformation",
    );

    let zones = res.ok()?;
    let temps: Vec<f32> = zones
        .into_iter()
        .filter_map(|z| z.Temperature)
        .filter_map(|raw| normalize_thermal_raw_celsius(raw).map(|(c, _)| c))
        .collect();

    if temps.is_empty() {
        None
    } else {
        temps.into_iter().reduce(f32::max)
    }
}

// ─── Dynamic GPU usage ───────────────────────────────────────────────────────

/// Query GPU 3D engine utilisation from Windows performance counters.
/// Available on Windows 10 1607+ with WDDM 2.x drivers.
pub fn query_gpu_usage(ctx: &WmiContext) -> f32 {
    let res: Result<Vec<WmiGpuEngine>, _> = ctx.cimv2.raw_query(
        "SELECT Name, UtilizationPercentage \
         FROM Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine \
         WHERE Name LIKE '%engtype_3D%'",
    );

    let engines = match res {
        Ok(e) => e,
        Err(_) => return 0.0,
    };

    if engines.is_empty() {
        return 0.0;
    }

    // Sum all 3D engine utilisation and divide by engine count.
    let total: u64 = engines
        .iter()
        .filter_map(|e| e.UtilizationPercentage)
        .sum();
    let count = engines
        .iter()
        .filter(|e| e.UtilizationPercentage.is_some())
        .count()
        .max(1);

    (total as f32 / count as f32).min(100.0)
}
