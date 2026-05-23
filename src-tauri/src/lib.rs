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
mod windows_util;

use serde::Deserialize;
use std::io::Write;
use std::sync::Arc;
use log::LevelFilter;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

use hardware::{HardwareCapability, HardwareSample, MetricPoint, MonitoringEngine, SystemInfo, TelemetryDiagnosticsSnapshot};



#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TrayStatus {
    tooltip: String,
    mode: String,
    overlay_enabled: bool,
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
fn optimize_ram(_mode: Option<String>) -> cleanup::RamCleanupResult {
    cleanup::optimize_ram()
}

#[tauri::command]
fn scan_bloatware() -> Vec<windows_util::BloatwareItem> {
    windows_util::scan_bloatware()
}

#[tauri::command]
fn remove_bloatware(ids: Vec<String>, dry_run: bool) -> Vec<String> {
    windows_util::remove_bloatware(ids, dry_run)
}

#[tauri::command]
fn restore_bloatware(ids: Vec<String>, dry_run: bool) -> Vec<String> {
    windows_util::restore_bloatware(ids, dry_run)
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
fn scan_storage_cleanup() -> Vec<cleanup::StorageCleanupItem> {
    cleanup::scan_storage_cleanup()
}

#[tauri::command]
fn run_storage_cleanup(ids: Vec<String>, dry_run: bool) -> Vec<String> {
    cleanup::run_storage_cleanup(ids, dry_run)
}

#[tauri::command]
fn scan_registry_issues() -> Vec<windows_util::RegistryIssue> {
    windows_util::scan_registry_issues()
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
fn restore_registry_backup(backup_id: String) -> Vec<String> {
    windows_util::restore_registry_backup(backup_id)
}

#[tauri::command]
fn export_diagnostics(engine: tauri::State<'_, MonitoringEngine>) -> DiagnosticsExport {
    let diagnostics = engine.telemetry_diagnostics_snapshot();
    let created_at = diagnostics.created_at.clone();
    let export_dir = diagnostics_dir();
    let _ = std::fs::create_dir_all(&export_dir);
    let path = export_dir.join(format!("diagnostics-{}.json", chrono_like_file_stamp()));
    let payload = serde_json::json!({
        "createdAt": created_at,
        "format": "radium-diagnostics-v1",
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
            "Support tooling".to_string(),
        ],
        provider_count: diagnostics.providers.len(),
        capability_count: diagnostics.capabilities.len(),
        sensor_count: diagnostics.sensors.len(),
    }
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
            summary: "Prioritises sustained clocks, faster fan ramp targets, and foreground responsiveness.".into(),
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
        "Saved selected profile intent for the current session.".to_string(),
        "Updated tray mode and overlay refresh behaviour.".to_string(),
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
        applied_profile: id,
        applied_at: hardware::timestamp_now().1,
        message: "Performance profile applied.".into(),
        actions,
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
fn set_startup_enabled(enabled: bool) -> Result<bool, String> {
    windows_util::set_companion_startup_enabled(enabled)
}

#[tauri::command]
fn set_overlay_window(app: AppHandle, enabled: bool, click_through: bool) -> Result<(), String> {
    if enabled {
        let window = if let Some(existing) = app.get_webview_window("osd") {
            existing
        } else {
            WebviewWindowBuilder::new(&app, "osd", WebviewUrl::App("index.html?overlay=1".into()))
                .title("Radium PCs OSD")
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .inner_size(620.0, 260.0)
                .position(24.0, 24.0)
                .build()
                .map_err(|err| err.to_string())?
        };
        window.show().map_err(|err| err.to_string())?;
        window.set_ignore_cursor_events(click_through).map_err(|err| err.to_string())?;
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
                    api.prevent_close();
                    let _ = window.hide();
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
            get_system_info,
            get_hardware_sample,
            get_hardware_capabilities,
            get_telemetry_diagnostics,
            optimize_ram,
            scan_bloatware,
            remove_bloatware,
            restore_bloatware,
            set_tray_status,
            set_tray_icon_data,
            show_main_window,
            set_startup_enabled,
            set_overlay_window,
            scan_startup_items,
            set_startup_item_enabled,
            scan_storage_cleanup,
            run_storage_cleanup,
            scan_registry_issues,
            backup_registry_issues,
            clean_registry_issues,
            restore_registry_backup,
            export_diagnostics,
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

    let path = dir.join(format!("companion-launch-{}.log", chrono_like_file_stamp()));
    let mut file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .ok()?;

    let _ = writeln!(file, "Radium PCs Companion launch log");
    let _ = writeln!(file, "created_at={}", hardware::timestamp_now().1);
    let _ = writeln!(file, "version={}", env!("CARGO_PKG_VERSION"));
    let _ = writeln!(file, "exe={}", std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_else(|err| format!("unavailable: {err}")));
    let _ = writeln!(file, "args={:?}", std::env::args().collect::<Vec<_>>());
    Some(path)
}

fn append_runtime_log(path: &std::path::Path, message: &str) {
    if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(path) {
        let _ = writeln!(file, "{} {}", hardware::timestamp_now().1, message);
    }
}

fn chrono_like_file_stamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

fn build_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open-dashboard", "Open Command Center", true, None::<&str>)?;
    let passport = MenuItem::with_id(app, "open-passport", "Open System Passport", true, None::<&str>)?;
    let overview = MenuItem::with_id(app, "performance-overview", "Performance Overview", true, None::<&str>)?;
    let toggle_osd = MenuItem::with_id(app, "toggle-osd", "Toggle OSD Overlay", true, None::<&str>)?;
    let ram_clean = MenuItem::with_id(app, "quick-ram-clean", "Quick Memory Optimization", true, None::<&str>)?;
    let performance = MenuItem::with_id(app, "performance-mode", "Set Performance Mode", true, None::<&str>)?;
    let quiet = MenuItem::with_id(app, "quiet-mode", "Set Quiet Mode", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open, &passport, &overview, &toggle_osd, &ram_clean, &performance, &quiet, &exit],
    )?;

    let icon = app.default_window_icon().cloned();
    let mut builder = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("Radium PCs Companion")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open-dashboard" | "performance-overview" => {
                let _ = app.emit("tray://open-dashboard", ());
            }
            "open-passport" => {
                let _ = app.emit("tray://open-passport", ());
            }
            "toggle-osd" => {
                let _ = app.emit("tray://toggle-osd", ());
            }
            "quick-ram-clean" => {
                let _ = app.emit("tray://quick-ram-clean", ());
            }
            "performance-mode" => {
                let _ = app.emit("tray://performance-mode", ());
            }
            "quiet-mode" => {
                let _ = app.emit("tray://quiet-mode", ());
            }
            "exit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                let _ = tray.app_handle().emit("tray://open-dashboard", ());
            }
        });

    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}
