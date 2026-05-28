mod cleanup;
mod hardware;
#[cfg(windows)]
mod wmi_provider;
#[cfg(windows)]
mod nvml_provider;
#[cfg(windows)]
mod amd_provider;
#[cfg(windows)]
mod igcl_provider;
#[cfg(windows)]
mod sidecar_provider;
#[cfg(windows)]
mod driver_update;
mod windows_util;

use serde::Deserialize;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use log::LevelFilter;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    webview::PageLoadEvent,
    window::Color,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

use hardware::{
    HardwareCapability, HardwareSample, MetricPoint, MonitoringEngine, SensorDiscoveryReport,
    SystemInfo, TelemetryDiagnosticsSnapshot,
};



#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayStatus {
    tooltip: String,
    mode: String,
    overlay_enabled: bool,
}

struct AppRuntimeState {
    close_to_tray: Mutex<bool>,
    minimize_to_tray_on_minimize: Mutex<bool>,
    osd_enabled: Mutex<bool>,
    osd_click_through: Mutex<bool>,
}

fn is_demo_brand_mode() -> bool {
    std::env::var("VITE_BRAND_MODE")
        .map(|value| value.eq_ignore_ascii_case("demo"))
        .unwrap_or(false)
}

fn product_name_for_mode() -> &'static str {
    if is_demo_brand_mode() {
        "PC Companion"
    } else {
        "Radium PCs Companion"
    }
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StorageScanStatus {
    running: bool,
    completed: bool,
    cancelled: bool,
    progress_pct: u8,
    current_step: usize,
    total_steps: usize,
    message: String,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StorageScanStatusPayload {
    status: StorageScanStatus,
    items: Option<Vec<cleanup::StorageCleanupItem>>,
}

#[derive(Default)]
struct StorageScanState {
    running: Arc<Mutex<bool>>,
    cancel_flag: Arc<AtomicBool>,
    status: Arc<Mutex<StorageScanStatus>>,
    items: Arc<Mutex<Option<Vec<cleanup::StorageCleanupItem>>>>,
}

impl Default for AppRuntimeState {
    fn default() -> Self {
        Self {
            close_to_tray: Mutex::new(true),
            minimize_to_tray_on_minimize: Mutex::new(true),
            osd_enabled: Mutex::new(false),
            osd_click_through: Mutex::new(false),
        }
    }
}

impl Default for StorageScanStatus {
    fn default() -> Self {
        Self {
            running: false,
            completed: false,
            cancelled: false,
            progress_pct: 0,
            current_step: 0,
            total_steps: 11,
            message: "Idle".to_string(),
        }
    }
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppMetadata {
    name: String,
    version: String,
    release_channel: String,
    build_profile: String,
    update_status: String,
    release_notes_url: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsExport {
    path: String,
    created_at: String,
    message: String,
    sections: Vec<String>,
    provider_count: usize,
    capability_count: usize,
    sensor_count: usize,
    discovery_attempt_count: usize,
}

#[tauri::command]
fn get_app_metadata() -> AppMetadata {
    AppMetadata {
        name: product_name_for_mode().to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        release_channel: if env!("CARGO_PKG_VERSION").contains("pre") {
            "pre-release".to_string()
        } else {
            "stable".to_string()
        },
        build_profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
        update_status: "manual".to_string(),
        release_notes_url: "https://github.com/theantipopau/pccompanion/releases".to_string(),
    }
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PerformanceProfile {
    id: String,
    name: String,
    summary: String,
    selected: bool,
    recommended_for: String,
    fan_intent: String,
    power_intent: String,
    estimated_noise: String,
    safe_mode: bool,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PerformanceProfileResult {
    applied_profile: String,
    applied_at: String,
    message: String,
    actions: Vec<String>,
    validation: PowerProfileValidation,
}

#[derive(Debug, serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PowerProfileValidation {
    status: String,
    expected_plan: String,
    detected_plan: String,
    plan_verified: bool,
    expected_processor: String,
    detected_processor: String,
    processor_verified: bool,
    timer_policy: String,
    notes: Vec<String>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_pct: f32,
    mem_mb: f32,
    status: String,
}



#[tauri::command]
fn get_system_info(engine: tauri::State<'_, MonitoringEngine>) -> SystemInfo {
    let sys_guard = engine.sysinfo.lock().expect("sysinfo lock");
    engine.system_info_snapshot(&sys_guard.sys)
}

#[tauri::command]
fn get_hardware_sample(
    engine: tauri::State<'_, MonitoringEngine>,
    history: Option<Vec<MetricPoint>>,
) -> HardwareSample {
    let _ = history; // internal history used; arg accepted for API compatibility
    engine.snapshot()
}

#[tauri::command]
fn get_hardware_capabilities(engine: tauri::State<'_, MonitoringEngine>) -> Vec<HardwareCapability> {
    engine.capability_snapshot()
}

#[tauri::command]
fn get_telemetry_diagnostics(engine: tauri::State<'_, MonitoringEngine>) -> TelemetryDiagnosticsSnapshot {
    engine.telemetry_diagnostics_snapshot()
}

#[tauri::command]
fn get_platform_telemetry_discovery(
    engine: tauri::State<'_, MonitoringEngine>,
) -> SensorDiscoveryReport {
    engine.telemetry_diagnostics_snapshot().sensor_discovery
}

#[cfg(windows)]
#[tauri::command]
fn probe_sensor_sidecar() -> sidecar_provider::RadiumSidecarSample {
    sidecar_provider::query_sensor_sidecar()
}

#[cfg(not(windows))]
#[tauri::command]
fn probe_sensor_sidecar() -> serde_json::Value {
    serde_json::json!({
        "provider": "radium-lhm-pawnio",
        "available": false,
        "driverAvailable": false,
        "status": "unsupported",
        "executablePath": null,
        "cpuTempC": null,
        "cpuTempLabel": null,
        "cpuFanRpm": null,
        "storageTempC": null,
        "notes": ["Sensor sidecar is only available on Windows."]
    })
}

#[tauri::command]
async fn optimize_ram(_mode: Option<String>) -> Result<cleanup::RamCleanupResult, String> {
    tauri::async_runtime::spawn_blocking(cleanup::optimize_ram)
        .await
        .map_err(|e| format!("optimize_ram join error: {e}"))
}

#[tauri::command]
async fn scan_bloatware() -> Result<Vec<windows_util::BloatwareItem>, String> {
    tauri::async_runtime::spawn_blocking(windows_util::scan_bloatware)
        .await
        .map_err(|e| format!("scan_bloatware join error: {e}"))
}

#[tauri::command]
async fn remove_bloatware(ids: Vec<String>, dry_run: bool) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || windows_util::remove_bloatware(ids, dry_run))
        .await
        .map_err(|e| format!("remove_bloatware join error: {e}"))
}

#[tauri::command]
async fn restore_bloatware(ids: Vec<String>, dry_run: bool) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || windows_util::restore_bloatware(ids, dry_run))
        .await
        .map_err(|e| format!("restore_bloatware join error: {e}"))
}

#[tauri::command]
fn scan_startup_items() -> Vec<windows_util::StartupItem> {
    windows_util::scan_startup_items()
}

#[tauri::command]
fn set_startup_item_enabled(id: String, enabled: bool, dry_run: bool) -> String {
    windows_util::set_startup_item_enabled(&id, enabled, dry_run)
}

#[tauri::command]
async fn scan_storage_cleanup() -> Result<Vec<cleanup::StorageCleanupItem>, String> {
    tauri::async_runtime::spawn_blocking(cleanup::scan_storage_cleanup)
        .await
        .map_err(|e| format!("scan_storage_cleanup join error: {e}"))
}

#[tauri::command]
async fn run_storage_cleanup(ids: Vec<String>, dry_run: bool) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || cleanup::run_storage_cleanup(ids, dry_run))
        .await
        .map_err(|e| format!("run_storage_cleanup join error: {e}"))
}

#[tauri::command]
fn start_storage_cleanup_scan(state: tauri::State<'_, StorageScanState>) -> StorageScanStatus {
    let mut running = state.running.lock().expect("storage scan running lock");
    if *running {
        return state.status.lock().expect("storage scan status lock").clone();
    }

    *running = true;
    state.cancel_flag.store(false, Ordering::Relaxed);

    {
        let mut items = state.items.lock().expect("storage scan items lock");
        *items = None;
    }

    {
        let mut status = state.status.lock().expect("storage scan status lock");
        *status = StorageScanStatus {
            running: true,
            completed: false,
            cancelled: false,
            progress_pct: 0,
            current_step: 0,
            total_steps: 9,
            message: "Starting storage scan".to_string(),
        };
    }

    let cancel_flag = Arc::clone(&state.cancel_flag);
    let status_arc = Arc::clone(&state.status);
    let items_arc = Arc::clone(&state.items);
    let running_arc = Arc::clone(&state.running);

    tauri::async_runtime::spawn(async move {
        let cancel_for_scan = Arc::clone(&cancel_flag);
        let status_for_scan = Arc::clone(&status_arc);
        let result = tauri::async_runtime::spawn_blocking(move || {
            cleanup::scan_storage_cleanup_with_progress(&cancel_for_scan, |done, total, label| {
                let pct = if total == 0 {
                    0
                } else {
                    ((done as f32 / total as f32) * 100.0).round().clamp(0.0, 100.0) as u8
                };
                if let Ok(mut status) = status_for_scan.lock() {
                    status.running = true;
                    status.completed = false;
                    status.cancelled = false;
                    status.current_step = done;
                    status.total_steps = total;
                    status.progress_pct = pct;
                    status.message = label.to_string();
                }
            })
        })
        .await;

        let cancelled = cancel_flag.load(Ordering::Relaxed);

        if let Ok(items) = result {
            if let Ok(mut stored) = items_arc.lock() {
                *stored = if cancelled { None } else { Some(items) };
            }
        }

        if let Ok(mut status) = status_arc.lock() {
            status.running = false;
            status.completed = !cancelled;
            status.cancelled = cancelled;
            status.progress_pct = if cancelled { status.progress_pct } else { 100 };
            status.message = if cancelled {
                "Storage scan cancelled".to_string()
            } else {
                "Storage scan complete".to_string()
            };
        }

        if let Ok(mut running) = running_arc.lock() {
            *running = false;
        }
    });

    state.status.lock().expect("storage scan status lock").clone()
}

#[tauri::command]
fn get_storage_cleanup_scan_status(
    state: tauri::State<'_, StorageScanState>,
) -> StorageScanStatusPayload {
    let status = state.status.lock().expect("storage scan status lock").clone();
    let items = if status.completed {
        state.items.lock().expect("storage scan items lock").clone()
    } else {
        None
    };

    StorageScanStatusPayload { status, items }
}

#[tauri::command]
fn cancel_storage_cleanup_scan(state: tauri::State<'_, StorageScanState>) -> StorageScanStatus {
    state.cancel_flag.store(true, Ordering::Relaxed);

    let mut status = state.status.lock().expect("storage scan status lock");
    if status.running {
        status.message = "Cancelling storage scan".to_string();
    }
    status.clone()
}

#[tauri::command]
fn scan_registry_issues() -> Vec<windows_util::RegistryIssue> {
    windows_util::scan_registry_issues()
}

/// Spawn a blocking thread to check for a GPU driver update, dispatching
/// to the appropriate vendor check based on the cached GPU vendor string.
/// Returns `None` when the vendor is unknown, the version is empty, or the
/// network/API call fails (silently degrades — UI shows "Check" fallback link).
#[tauri::command]
async fn check_driver_update(
    engine: tauri::State<'_, MonitoringEngine>,
) -> Result<Option<hardware::DriverUpdateInfo>, ()> {
    let current = engine.get_gpu_driver_version();
    let vendor = engine.get_gpu_vendor();
    if current.is_empty() {
        return Ok(None);
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            match vendor.to_lowercase().as_str() {
                "nvidia" => crate::driver_update::check_nvidia_driver_update(&current),
                "amd"    => crate::driver_update::check_amd_driver_update(&current),
                "intel"  => crate::driver_update::check_intel_arc_driver_update(&current),
                _        => None,
            }
        }
        #[cfg(not(windows))]
        {
            let _ = (current, vendor);
            None
        }
    })
    .await
    .unwrap_or(None);
    Ok(result)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    validate_external_url(&url)?;
    #[cfg(windows)]
    open_external_url_windows(&url)?;
    #[cfg(not(windows))]
    {
        let _ = url;
        return Err("External URL opening is only implemented for Windows builds".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn run_local_ai_setup(action: String, model: Option<String>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_local_ai_setup_blocking(&action, model.as_deref()))
        .await
        .map_err(|e| format!("run_local_ai_setup join error: {e}"))?
}

fn run_local_ai_setup_blocking(action: &str, model: Option<&str>) -> Result<String, String> {
    #[cfg(windows)]
    {
        match action {
            "install_ollama" => {
                let out = run_hidden_command_output(
                    "winget",
                    &[
                        "install",
                        "--id",
                        "Ollama.Ollama",
                        "-e",
                        "--accept-source-agreements",
                        "--accept-package-agreements",
                    ],
                )?;
                if out.status.success() {
                    return Ok("Ollama install command finished successfully.".to_string());
                }
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                return Err(format!(
                    "Ollama install failed (code {:?}). {} {}",
                    out.status.code(),
                    stdout,
                    stderr
                )
                .trim()
                .to_string());
            }
            "pull_model" => {
                let model = model.ok_or_else(|| "Model tag is required for pull_model".to_string())?;
                validate_model_tag(model)?;
                let out = run_hidden_command_output("ollama", &["pull", model])?;
                if out.status.success() {
                    return Ok(format!("Model pull completed: {model}"));
                }
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                return Err(format!(
                    "Model pull failed for {model} (code {:?}). {} {}",
                    out.status.code(),
                    stdout,
                    stderr
                )
                .trim()
                .to_string());
            }
            "start_runtime" => {
                let mut cmd = std::process::Command::new("ollama");
                cmd.arg("serve");
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
                }
                cmd.stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .stdin(std::process::Stdio::null())
                    .spawn()
                    .map_err(|e| format!("Failed to start ollama runtime: {e}"))?;
                return Ok("Local runtime start requested: ollama serve".to_string());
            }
            _ => return Err("Unsupported local AI setup action".to_string()),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = (action, model);
        Err("Local AI setup actions are currently implemented for Windows only".to_string())
    }
}

fn validate_model_tag(model: &str) -> Result<(), String> {
    if model.is_empty() || model.len() > 96 {
        return Err("Invalid model tag length".to_string());
    }
    if !model
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, ':' | '.' | '_' | '-'))
    {
        return Err("Model tag contains blocked characters".to_string());
    }
    Ok(())
}

fn run_hidden_command_output(program: &str, args: &[&str]) -> Result<std::process::Output, String> {
    let mut cmd = std::process::Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd.output()
        .map_err(|e| format!("Failed to run {program}: {e}"))
}

fn validate_external_url(url: &str) -> Result<(), String> {
    const MAX_URL_LEN: usize = 2048;
    const ALLOWED_HOSTS: &[&str] = &[
        "radiumpcs.com.au",
        "github.com",
        "nvidia.com",
        "intel.com",
        "amd.com",
    ];

    if url.len() > MAX_URL_LEN {
        return Err("URL is too long".to_string());
    }
    if url.chars().any(|ch| ch.is_control() || ch.is_whitespace()) {
        return Err("URL contains unsafe characters".to_string());
    }
    if url.chars().any(|ch| matches!(ch, '"' | '\'' | '<' | '>' | '|' | '^' | '`' | '\\' | '@')) {
        return Err("URL contains blocked shell metacharacters".to_string());
    }
    let Some(rest) = url.strip_prefix("https://") else {
        return Err("Only HTTPS URLs are permitted".to_string());
    };
    let host = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or_default()
        .split('@')
        .last()
        .unwrap_or_default()
        .split(':')
        .next()
        .unwrap_or_default()
        .trim_end_matches('.')
        .to_ascii_lowercase();
    if host.is_empty() {
        return Err("URL host is missing".to_string());
    }
    let allowed = ALLOWED_HOSTS
        .iter()
        .any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}")));
    if !allowed {
        return Err("URL host is not on the allow-list".to_string());
    }
    Ok(())
}

#[cfg(windows)]
fn open_external_url_windows(url: &str) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let operation = wide_null("open");
    let target = wide_null(url);
    let result = unsafe {
        ShellExecuteW(
            HWND::default(),
            PCWSTR(operation.as_ptr()),
            PCWSTR(target.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize <= 32 {
        Err(format!("ShellExecute failed with code {}", result.0 as isize))
    } else {
        Ok(())
    }
}

fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[tauri::command]
fn backup_registry_issues(ids: Vec<String>) -> windows_util::RegistryBackup {
    windows_util::backup_registry_issues(ids)
}

#[tauri::command]
fn clean_registry_issues(ids: Vec<String>, backup_id: String, dry_run: bool) -> Vec<String> {
    windows_util::clean_registry_issues(ids, backup_id, dry_run)
}

#[tauri::command]
fn list_registry_backups() -> Vec<windows_util::RegistryBackup> {
    windows_util::list_registry_backups()
}

#[tauri::command]
fn restore_registry_backup(backup_id: String) -> Vec<String> {
    windows_util::restore_registry_backup(backup_id)
}

#[tauri::command]
fn export_diagnostics(
    app: AppHandle,
    engine: tauri::State<'_, MonitoringEngine>,
    runtime: tauri::State<'_, AppRuntimeState>,
) -> DiagnosticsExport {
    let diagnostics = engine.telemetry_diagnostics_snapshot();
    let created_at = diagnostics.created_at.clone();
    let export_dir = diagnostics_dir();
    let _ = std::fs::create_dir_all(&export_dir);
    prune_old_files(&export_dir, "diagnostics-", ".json", 40);
    let path = export_dir.join(format!("diagnostics-{}.json", chrono_like_file_stamp()));
    let startup_enabled = crate::windows_util::is_companion_startup_enabled();
    let close_to_tray = runtime
        .close_to_tray
        .lock()
        .map(|value| *value)
        .unwrap_or(true);
    let minimize_to_tray_on_minimize = runtime
        .minimize_to_tray_on_minimize
        .lock()
        .map(|value| *value)
        .unwrap_or(true);
    let main_window_visible = app
        .get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);
    let osd_window_visible = app
        .get_webview_window("osd")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);

    let payload = serde_json::json!({
        "createdAt": created_at,
        "format": "radium-diagnostics-v1",
        "app": {
            "name": "Radium PCs Companion",
            "version": env!("CARGO_PKG_VERSION"),
            "buildProfile": if cfg!(debug_assertions) { "debug" } else { "release" },
            "os": std::env::consts::OS,
            "arch": std::env::consts::ARCH
        },
        "runtimeState": {
            "startupEnabled": startup_enabled,
            "closeToTray": close_to_tray,
            "minimizeToTrayOnMinimize": minimize_to_tray_on_minimize,
            "mainWindowVisible": main_window_visible,
            "osdWindowVisible": osd_window_visible,
            "trayRegistered": app.tray_by_id("main-tray").is_some()
        },
        "diagnostics": diagnostics,
        "notes": [
            "Generated locally.",
            "No automatic upload or telemetry.",
            "Sensor fields with null values indicate unavailable provider data."
        ]
    });
    let message = match std::fs::write(&path, serde_json::to_string_pretty(&payload).unwrap_or_default()) {
        Ok(_) => "Diagnostics bundle exported locally.".to_string(),
        Err(err) => format!("Diagnostics export failed: {err}"),
    };
    DiagnosticsExport {
        path: path.to_string_lossy().to_string(),
        created_at,
        message,
        sections: vec![
            "Provider orchestration".to_string(),
            "Capability matrix".to_string(),
            "Sensor provenance".to_string(),
            "Sensor discovery report".to_string(),
            "Support tooling".to_string(),
        ],
        provider_count: diagnostics.providers.len(),
        capability_count: diagnostics.capabilities.len(),
        sensor_count: diagnostics.sensors.len(),
        discovery_attempt_count: diagnostics.sensor_discovery.attempts.len(),
    }
}

#[tauri::command]
fn set_close_to_tray(
    enabled: bool,
    runtime: tauri::State<'_, AppRuntimeState>,
) -> Result<(), String> {
    let mut close_to_tray = runtime
        .close_to_tray
        .lock()
        .map_err(|_| "Close behavior state lock poisoned".to_string())?;
    *close_to_tray = enabled;
    Ok(())
}

#[tauri::command]
fn set_minimize_to_tray_on_minimize(
    enabled: bool,
    runtime: tauri::State<'_, AppRuntimeState>,
) -> Result<(), String> {
    let mut minimize_to_tray = runtime
        .minimize_to_tray_on_minimize
        .lock()
        .map_err(|_| "Minimize behavior state lock poisoned".to_string())?;
    *minimize_to_tray = enabled;
    Ok(())
}

#[tauri::command]
fn restart_monitoring_engine(engine: tauri::State<'_, MonitoringEngine>) -> Result<String, String> {
    Ok(engine.restart_runtime_state())
}

#[tauri::command]
fn get_performance_profiles() -> Vec<PerformanceProfile> {
    vec![
        PerformanceProfile {
            id: "balanced".into(),
            name: "Balanced".into(),
            summary: "Daily performance with restrained fan targets and normal Windows power behaviour.".into(),
            selected: true,
            recommended_for: "Everyday gaming, browsing, streaming, and light content work.".into(),
            fan_intent: "balanced".into(),
            power_intent: "balanced".into(),
            estimated_noise: "medium".into(),
            safe_mode: true,
        },
        PerformanceProfile {
            id: "gaming".into(),
            name: "Gaming".into(),
            summary: "Prioritises foreground responsiveness, performance plans, and low-latency scheduling.".into(),
            selected: false,
            recommended_for: "Competitive gaming, high refresh displays, and GPU-heavy sessions.".into(),
            fan_intent: "aggressive".into(),
            power_intent: "performance".into(),
            estimated_noise: "high".into(),
            safe_mode: true,
        },
        PerformanceProfile {
            id: "creator".into(),
            name: "Creator".into(),
            summary: "Favours long-run stability for renders, compiles, encodes, and workstation loads.".into(),
            selected: false,
            recommended_for: "Rendering, compiling, simulation, streaming, and production workloads.".into(),
            fan_intent: "balanced".into(),
            power_intent: "performance".into(),
            estimated_noise: "medium".into(),
            safe_mode: true,
        },
        PerformanceProfile {
            id: "quiet".into(),
            name: "Quiet".into(),
            summary: "Reduces background aggression and keeps the machine calm for low-intensity work.".into(),
            selected: false,
            recommended_for: "Office work, downloads, media playback, and overnight operation.".into(),
            fan_intent: "quiet".into(),
            power_intent: "efficiency".into(),
            estimated_noise: "low".into(),
            safe_mode: true,
        },
    ]
}

#[tauri::command]
fn apply_performance_profile(id: String, dry_run: bool) -> PerformanceProfileResult {
    let mut actions = vec![
        "Accepted selected profile intent from Companion settings.".to_string(),
        "Updated tray mode and overlay refresh intent.".to_string(),
    ];
    if dry_run {
        actions.push("Skipped power plan write (dry-run mode).".to_string());
        actions.push("Skipped processor power tuning (dry-run mode).".to_string());
        actions.push("Skipped timer resolution change (dry-run mode).".to_string());
    } else {
        actions.push(match set_windows_power_plan(&id) {
            Ok(msg) => msg,
            Err(err) => format!("Power plan update failed: {err}"),
        });
        actions.push(crate::windows_util::apply_power_mode_tweaks(&id));
        actions.push(crate::windows_util::set_timer_resolution(&id));
    }
    PerformanceProfileResult {
        validation: validate_performance_profile(&id),
        applied_profile: id,
        applied_at: hardware::timestamp_now().1,
        message: "Performance profile applied.".into(),
        actions,
    }
}

fn validate_performance_profile(profile_id: &str) -> PowerProfileValidation {
    let expected = expected_power_profile_policy(profile_id);
    #[cfg(windows)]
    {
        let mut notes = Vec::new();
        let detected_plan = match query_active_power_plan() {
            Ok(plan) => plan,
            Err(err) => {
                notes.push(format!("Active power plan query failed: {err}"));
                "Unavailable".to_string()
            }
        };
        let plan_verified = expected.plan_guids.iter().any(|guid| detected_plan.to_lowercase().contains(guid));

        let min_pct = query_processor_setting_pct("PROCTHROTTLEMIN");
        let max_pct = query_processor_setting_pct("PROCTHROTTLEMAX");
        let boost = query_processor_setting_pct("PERFBOOSTMODE");
        if let Err(err) = &min_pct {
            notes.push(format!("Processor minimum query failed: {err}"));
        }
        if let Err(err) = &max_pct {
            notes.push(format!("Processor maximum query failed: {err}"));
        }
        if let Err(err) = &boost {
            notes.push(format!("Boost mode query failed: {err}"));
        }

        let detected_processor = match (&min_pct, &max_pct, &boost) {
            (Ok(min), Ok(max), Ok(boost)) => format!("Processor {min}-{max}%, boost mode {boost}"),
            _ => "Unavailable".to_string(),
        };
        let processor_verified = min_pct.ok() == Some(expected.min_pct)
            && max_pct.ok() == Some(expected.max_pct)
            && boost.ok() == Some(expected.boost);
        let status = if plan_verified && processor_verified {
            "verified"
        } else if plan_verified || processor_verified {
            "partial"
        } else {
            "needs_attention"
        };

        PowerProfileValidation {
            status: status.to_string(),
            expected_plan: expected.plan_label.to_string(),
            detected_plan,
            plan_verified,
            expected_processor: format!(
                "Processor {}-{}%, boost mode {}",
                expected.min_pct, expected.max_pct, expected.boost
            ),
            detected_processor,
            processor_verified,
            timer_policy: expected.timer_label.to_string(),
            notes,
        }
    }

    #[cfg(not(windows))]
    {
        let _ = profile_id;
        PowerProfileValidation {
            status: "unsupported".to_string(),
            expected_plan: expected.plan_label.to_string(),
            detected_plan: "Non-Windows build".to_string(),
            plan_verified: false,
            expected_processor: format!(
                "Processor {}-{}%, boost mode {}",
                expected.min_pct, expected.max_pct, expected.boost
            ),
            detected_processor: "Non-Windows build".to_string(),
            processor_verified: false,
            timer_policy: expected.timer_label.to_string(),
            notes: vec!["Power profile validation is only available on Windows.".to_string()],
        }
    }
}

struct ExpectedPowerPolicy {
    plan_label: &'static str,
    plan_guids: &'static [&'static str],
    min_pct: u32,
    max_pct: u32,
    boost: u32,
    timer_label: &'static str,
}

fn expected_power_profile_policy(profile_id: &str) -> ExpectedPowerPolicy {
    const POWER_SAVER: &str = "a1841308-3541-4fab-bc81-f71556f20b4a";
    const BALANCED: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
    const HIGH_PERF: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
    const ULTIMATE_PERF: &str = "e9a42b02-d5df-448d-aa00-03f14749eb61";

    match profile_id {
        "gaming" => ExpectedPowerPolicy {
            plan_label: "Ultimate/High Performance",
            plan_guids: &[ULTIMATE_PERF, HIGH_PERF],
            min_pct: 10,
            max_pct: 100,
            boost: 2,
            timer_label: "0.5 ms target",
        },
        "creator" => ExpectedPowerPolicy {
            plan_label: "Ultimate/High Performance",
            plan_guids: &[ULTIMATE_PERF, HIGH_PERF],
            min_pct: 10,
            max_pct: 100,
            boost: 1,
            timer_label: "0.5 ms target",
        },
        "quiet" => ExpectedPowerPolicy {
            plan_label: "Power Saver",
            plan_guids: &[POWER_SAVER],
            min_pct: 5,
            max_pct: 70,
            boost: 0,
            timer_label: "Windows default",
        },
        _ => ExpectedPowerPolicy {
            plan_label: "Balanced",
            plan_guids: &[BALANCED],
            min_pct: 5,
            max_pct: 100,
            boost: 1,
            timer_label: "1.0 ms target",
        },
    }
}

/// Switch the active Windows power plan to match the chosen profile.
///
/// Uses the four built-in plan GUIDs that exist on every Windows 10/11 install.
/// For gaming/creator, tries Ultimate Performance first (Win 10/11 Pro/Workstation);
/// if unavailable, falls back to High Performance.
fn set_windows_power_plan(profile_id: &str) -> Result<String, String> {
    const POWER_SAVER: &str       = "a1841308-3541-4fab-bc81-f71556f20b4a";
    const BALANCED: &str          = "381b4222-f694-41f0-9685-ff5bb260df2e";
    const HIGH_PERF: &str         = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
    const ULTIMATE_PERF: &str     = "e9a42b02-d5df-448d-aa00-03f14749eb61";

    match profile_id {
        "gaming" | "creator" => {
            // Try Ultimate Performance (exists on Pro/Enterprise; run_powercfg fails silently on Home)
            if run_powercfg(&["/setactive", ULTIMATE_PERF]).is_ok() {
                return Ok(format!("Windows power plan → Ultimate Performance ({ULTIMATE_PERF})"));
            }
            run_powercfg(&["/setactive", HIGH_PERF])?;
            Ok(format!("Windows power plan → High Performance ({HIGH_PERF})"))
        }
        "balanced" => {
            run_powercfg(&["/setactive", BALANCED])?;
            Ok(format!("Windows power plan → Balanced ({BALANCED})"))
        }
        "quiet" => {
            run_powercfg(&["/setactive", POWER_SAVER])?;
            Ok(format!("Windows power plan → Power Saver ({POWER_SAVER})"))
        }
        _ => Err(format!("Unknown profile id: {profile_id}")),
    }
}

fn run_powercfg(args: &[&str]) -> Result<(), String> {
    let mut cmd = std::process::Command::new("powercfg");
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(windows)]
fn query_active_power_plan() -> Result<String, String> {
    let out = run_powercfg_output(&["/getactivescheme"])?;
    let line = out.lines().find(|line| !line.trim().is_empty()).unwrap_or(out.trim());
    if line.trim().is_empty() {
        Err("powercfg returned no active scheme output".to_string())
    } else {
        Ok(line.trim().to_string())
    }
}

#[cfg(windows)]
fn query_processor_setting_pct(setting: &str) -> Result<u32, String> {
    let out = run_powercfg_output(&["/query", "SCHEME_CURRENT", "SUB_PROCESSOR", setting])?;
    parse_current_ac_power_index(&out)
        .ok_or_else(|| format!("AC power setting index not found for {setting}"))
}

#[cfg(windows)]
fn parse_current_ac_power_index(output: &str) -> Option<u32> {
    output.lines().find_map(|line| {
        let lower = line.to_lowercase();
        if !lower.contains("current ac power setting index") {
            return None;
        }
        let value = line.split(':').nth(1)?.trim();
        if let Some(hex) = value.strip_prefix("0x").or_else(|| value.strip_prefix("0X")) {
            u32::from_str_radix(hex, 16).ok()
        } else {
            value.parse::<u32>().ok()
        }
    })
}

#[cfg(windows)]
fn run_powercfg_output(args: &[&str]) -> Result<String, String> {
    let mut cmd = std::process::Command::new("powercfg");
    cmd.args(args);
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let out = cmd.output().map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        if stderr.is_empty() {
            Err("powercfg returned non-zero status".to_string())
        } else {
            Err(stderr)
        }
    }
}

#[tauri::command]
fn list_top_processes(limit: Option<usize>) -> Vec<ProcessInfo> {
    use sysinfo::{ProcessesToUpdate, System};
    let n = limit.unwrap_or(30).min(100);
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let cpu_count = sys.cpus().len().max(1) as f32;
    let mut procs: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_pct: p.cpu_usage() / cpu_count,
            mem_mb: p.memory() as f32 / 1_048_576.0,
            status: format!("{:?}", p.status()),
        })
        .collect();
    procs.sort_by(|a, b| b.cpu_pct.partial_cmp(&a.cpu_pct).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(n);
    procs
}

#[tauri::command]
fn set_tray_status(app: AppHandle, status: TrayStatus) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let overlay_label = if status.overlay_enabled { "OSD on" } else { "OSD off" };
        let tooltip = format!(
            "{}\nMode: {} \u{00B7} {}",
            status.tooltip, status.mode, overlay_label
        );
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_tray_icon_data(app: AppHandle, rgba: Vec<u8>, width: u32, height: u32) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let icon = tauri::image::Image::new_owned(rgba, width, height);
        tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|err| err.to_string())?;
        window.unminimize().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_startup_enabled(enabled: bool, start_minimized: bool) -> Result<bool, String> {
    windows_util::set_companion_startup_enabled(enabled, start_minimized)
}

#[tauri::command]
fn set_overlay_window(app: AppHandle, enabled: bool, click_through: bool) -> Result<(), String> {
    if let Some(runtime) = app.try_state::<AppRuntimeState>() {
        if let Ok(mut osd_enabled) = runtime.osd_enabled.lock() {
            *osd_enabled = enabled;
        }
        if let Ok(mut osd_click_through) = runtime.osd_click_through.lock() {
            *osd_click_through = click_through;
        }
    }

    apply_overlay_window(app.clone(), enabled, click_through)
}

fn apply_overlay_window(app: AppHandle, enabled: bool, click_through: bool) -> Result<(), String> {
    if enabled {
        if let Some(existing) = app.get_webview_window("osd") {
            existing.set_background_color(Some(Color(0, 0, 0, 0))).map_err(|err| err.to_string())?;
            existing.show().map_err(|err| err.to_string())?;
            existing.set_ignore_cursor_events(click_through).map_err(|err| err.to_string())?;
        } else {
            let window = WebviewWindowBuilder::new(&app, "osd", WebviewUrl::App("index.html?overlay=1".into()))
                .title("Radium PCs OSD")
                .decorations(false)
                .transparent(true)
                .background_color(Color(0, 0, 0, 0))
                .always_on_top(true)
                .skip_taskbar(true)
                .shadow(false)
                .resizable(false)
                .visible(false)
                .inner_size(620.0, 260.0)
                .position(24.0, 24.0)
                .on_page_load(|window, payload| {
                    if matches!(payload.event(), PageLoadEvent::Finished) {
                        let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
                        let _ = window.show();
                    }
                })
                .build()
                .map_err(|err| err.to_string())?;
            window.set_ignore_cursor_events(click_through).map_err(|err| err.to_string())?;
        };
    } else if let Some(window) = app.get_webview_window("osd") {
        window.hide().map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn run() {
    let launch_log = create_launch_log();
    let engine = MonitoringEngine::new();

    // Clone Arcs before Tauri takes ownership of `engine`.
    let cache_arc = Arc::clone(&engine.cache);
    let sysinfo_arc = Arc::clone(&engine.sysinfo);

    // Dedicated hardware monitoring thread — initialises WMI once and polls
    // every 1 second.  Commands read from the shared cache without blocking.
    std::thread::Builder::new()
        .name("radium-monitor".into())
        .spawn(move || hardware::monitor_loop(cache_arc, sysinfo_arc))
        .expect("failed to spawn monitoring thread");

    tauri::Builder::default()
        .manage(engine)
        .manage(AppRuntimeState::default())
        .manage(StorageScanState::default())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .level_for("wmi", LevelFilter::Warn)
                .level_for("wmi::result_enumerator", LevelFilter::Error)
                .build()
        )
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let close_to_tray = window
                        .app_handle()
                        .state::<AppRuntimeState>()
                        .close_to_tray
                        .lock()
                        .map(|flag| *flag)
                        .unwrap_or(true);

                    if close_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        api.prevent_close();
                        window.app_handle().exit(0);
                    }
                }

                if matches!(event, WindowEvent::Resized(_)) {
                    let minimize_to_tray = window
                        .app_handle()
                        .state::<AppRuntimeState>()
                        .minimize_to_tray_on_minimize
                        .lock()
                        .map(|flag| *flag)
                        .unwrap_or(true);

                    if minimize_to_tray && window.is_minimized().ok().unwrap_or(false) {
                        let _ = window.hide();
                    }
                }
            }
        })
        .setup(move |app| {
            build_tray(app)?;
            if let Some(path) = launch_log.as_ref() {
                append_runtime_log(path, "Tauri setup complete. Tray registered.");
                if std::env::args().any(|arg| arg == "--background" || arg == "--silent") {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                    append_runtime_log(path, "Started in background mode; main window hidden.");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_metadata,
            get_system_info,
            get_hardware_sample,
            get_hardware_capabilities,
            get_telemetry_diagnostics,
            get_platform_telemetry_discovery,
            probe_sensor_sidecar,
            optimize_ram,
            scan_bloatware,
            remove_bloatware,
            restore_bloatware,
            set_tray_status,
            set_tray_icon_data,
            show_main_window,
            set_startup_enabled,
            set_overlay_window,
            set_close_to_tray,
            set_minimize_to_tray_on_minimize,
            restart_monitoring_engine,
            scan_startup_items,
            set_startup_item_enabled,
            scan_storage_cleanup,
            start_storage_cleanup_scan,
            get_storage_cleanup_scan_status,
            cancel_storage_cleanup_scan,
            run_storage_cleanup,
            scan_registry_issues,
            backup_registry_issues,
            clean_registry_issues,
            list_registry_backups,
            restore_registry_backup,
            export_diagnostics,
            open_url,
            run_local_ai_setup,
            check_driver_update,
            get_performance_profiles,
            apply_performance_profile,
            list_top_processes
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Radium PCs Companion");
}

fn diagnostics_dir() -> std::path::PathBuf {
    std::env::var("PROGRAMDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("Radium PCs Companion")
        .join("diagnostics")
}

fn runtime_log_dir() -> std::path::PathBuf {
    std::env::var("PROGRAMDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("Radium PCs Companion")
        .join("logs")
}

fn create_launch_log() -> Option<std::path::PathBuf> {
    let dir = runtime_log_dir();
    if std::fs::create_dir_all(&dir).is_err() {
        return None;
    }

    prune_old_files(&dir, "companion-launch-", ".log", 60);

    let path = dir.join(format!("companion-launch-{}.log", chrono_like_file_stamp()));
    let mut file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .ok()?;

    let _ = writeln!(file, "Radium PCs Companion launch log");
    let _ = writeln!(file, "created_at_unix_ms={}", unix_timestamp_ms());
    let _ = writeln!(file, "created_at_clock={}", hardware::timestamp_now().1);
    let _ = writeln!(file, "version={}", env!("CARGO_PKG_VERSION"));
    let _ = writeln!(file, "exe={}", std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_else(|err| format!("unavailable: {err}")));
    let _ = writeln!(file, "args={:?}", std::env::args().collect::<Vec<_>>());
    Some(path)
}

fn append_runtime_log(path: &std::path::Path, message: &str) {
    if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(path) {
        let _ = writeln!(
            file,
            "unix_ms={} clock={} {}",
            unix_timestamp_ms(),
            hardware::timestamp_now().1,
            message
        );
    }
}

fn chrono_like_file_stamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

fn unix_timestamp_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn prune_old_files(dir: &std::path::Path, prefix: &str, suffix: &str, keep: usize) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    let mut files = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?;
            if !name.starts_with(prefix) || !name.ends_with(suffix) {
                return None;
            }
            let modified = entry
                .metadata()
                .ok()
                .and_then(|meta| meta.modified().ok())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            Some((path, modified))
        })
        .collect::<Vec<_>>();

    if files.len() <= keep {
        return;
    }

    files.sort_by_key(|(_, modified)| *modified);
    let to_delete = files.len().saturating_sub(keep);
    for (path, _) in files.into_iter().take(to_delete) {
        let _ = std::fs::remove_file(path);
    }
}

fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open-dashboard", "Open Companion", true, None::<&str>)?;
    let toggle_osd = MenuItem::with_id(app, "toggle-osd", "Toggle OSD Overlay", true, None::<&str>)?;
    let ram_clean = MenuItem::with_id(app, "quick-ram-clean", "Quick RAM Clean", true, None::<&str>)?;
    let quiet = MenuItem::with_id(app, "profile-quiet", "Power Mode: Quiet", true, None::<&str>)?;
    let balanced = MenuItem::with_id(app, "profile-balanced", "Power Mode: Balanced", true, None::<&str>)?;
    let gaming = MenuItem::with_id(app, "profile-gaming", "Power Mode: Gaming", true, None::<&str>)?;
    let creator = MenuItem::with_id(app, "profile-creator", "Power Mode: Creator", true, None::<&str>)?;
    let export_diagnostics = MenuItem::with_id(app, "export-diagnostics", "Diagnostics Export", true, None::<&str>)?;
    let restart_monitoring = MenuItem::with_id(app, "restart-monitoring", "Restart Monitoring Engine", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open, &toggle_osd, &ram_clean, &quiet, &balanced, &gaming, &creator, &export_diagnostics, &restart_monitoring, &exit],
    )?;

    let icon = app.default_window_icon().cloned();
    let tray_tooltip = product_name_for_mode();
    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip(tray_tooltip)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open-dashboard" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let _ = app.emit("tray://open-dashboard", ());
            }
            "toggle-osd" => {
                let mut next_enabled = true;
                let mut click_through = false;
                if let Some(runtime) = app.try_state::<AppRuntimeState>() {
                    if let Ok(osd_enabled) = runtime.osd_enabled.lock() {
                        next_enabled = !*osd_enabled;
                    }
                    if let Ok(osd_click) = runtime.osd_click_through.lock() {
                        click_through = *osd_click;
                    }
                    if let Ok(mut osd_enabled) = runtime.osd_enabled.lock() {
                        *osd_enabled = next_enabled;
                    }
                }
                let _ = apply_overlay_window(app.clone(), next_enabled, click_through);
                let _ = app.emit("tray://toggle-osd", ());
            }
            "quick-ram-clean" => {
                let _ = app.emit("tray://quick-ram-clean", ());
            }
            "profile-quiet" | "profile-balanced" | "profile-gaming" | "profile-creator" => {
                let profile = event.id().as_ref().trim_start_matches("profile-");
                let _ = app.emit(format!("tray://profile-{profile}").as_str(), ());
            }
            "export-diagnostics" => {
                let _ = app.emit("tray://export-diagnostics", ());
            }
            "restart-monitoring" => {
                let _ = app.emit("tray://restart-monitoring", ());
            }
            "exit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let _ = tray.app_handle().emit("tray://open-dashboard", ());
            }
        });

    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn external_url_validator_allows_known_https_hosts() {
        assert!(validate_external_url("https://radiumpcs.com.au").is_ok());
        assert!(validate_external_url("https://github.com/theantipopau/pccompanion/releases").is_ok());
        assert!(validate_external_url("https://www.nvidia.com/Download/index.aspx").is_ok());
    }

    #[test]
    fn external_url_validator_rejects_shell_metacharacters_and_unknown_hosts() {
        assert!(validate_external_url("http://radiumpcs.com.au").is_err());
        assert!(validate_external_url("https://evil.example").is_err());
        assert!(validate_external_url("https://github.com/theantipopau/pccompanion/releases^calc.exe").is_err());
        assert!(validate_external_url("https://evil.example@github.com/theantipopau/pccompanion").is_err());
        assert!(validate_external_url("https://github.com/theantipopau/pccompanion/releases calc.exe").is_err());
    }
}
