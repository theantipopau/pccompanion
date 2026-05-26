use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Default)]
pub struct RadiumSidecarSample {
    pub provider: String,
    pub available: bool,
    pub driver_available: bool,
    pub status: String,
    pub executable_path: Option<String>,
    pub cpu_temp_c: Option<f32>,
    pub cpu_temp_label: Option<String>,
    pub cpu_fan_rpm: Option<u32>,
    pub storage_temp_c: Option<f32>,
    pub notes: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarJson {
    provider: Option<String>,
    available: Option<bool>,
    driver_available: Option<bool>,
    status: Option<String>,
    cpu_temp_c: Option<f32>,
    cpu_temp_label: Option<String>,
    cpu_fan_rpm: Option<u32>,
    storage_temp_c: Option<f32>,
    notes: Option<Vec<String>>,
}

pub fn query_sensor_sidecar() -> RadiumSidecarSample {
    let Some(command_spec) = find_sidecar_command() else {
        return RadiumSidecarSample {
            provider: "radium-lhm-pawnio".to_string(),
            available: false,
            driver_available: false,
            status: "sidecar_not_found".to_string(),
            notes: vec!["radium-sensor-sidecar assembly/executable was not found in bundled or development paths".to_string()],
            ..Default::default()
        };
    };

    let path_string = command_spec.display_path.to_string_lossy().to_string();
    let mut command = Command::new(&command_spec.program);
    command
        .args(&command_spec.args)
        .arg("--once")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) => {
            return RadiumSidecarSample {
                provider: "radium-lhm-pawnio".to_string(),
                executable_path: Some(path_string),
                available: false,
                driver_available: false,
                status: "launch_failed".to_string(),
                notes: vec![err.to_string()],
                ..Default::default()
            };
        }
    };

    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() < Duration::from_millis(1800) => {
                std::thread::sleep(Duration::from_millis(25));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return RadiumSidecarSample {
                    provider: "radium-lhm-pawnio".to_string(),
                    executable_path: Some(path_string),
                    available: false,
                    driver_available: false,
                    status: "timeout".to_string(),
                    notes: vec!["sidecar did not return within 1800ms".to_string()],
                    ..Default::default()
                };
            }
            Err(err) => {
                return RadiumSidecarSample {
                    provider: "radium-lhm-pawnio".to_string(),
                    executable_path: Some(path_string),
                    available: false,
                    driver_available: false,
                    status: "wait_failed".to_string(),
                    notes: vec![err.to_string()],
                    ..Default::default()
                };
            }
        }
    }

    let output = match child.wait_with_output() {
        Ok(output) => output,
        Err(err) => {
            return RadiumSidecarSample {
                provider: "radium-lhm-pawnio".to_string(),
                executable_path: Some(path_string),
                available: false,
                driver_available: false,
                status: "output_failed".to_string(),
                notes: vec![err.to_string()],
                ..Default::default()
            };
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return RadiumSidecarSample {
            provider: "radium-lhm-pawnio".to_string(),
            executable_path: Some(path_string),
            available: false,
            driver_available: false,
            status: "empty_output".to_string(),
            notes: vec![stderr],
            ..Default::default()
        };
    }

    match serde_json::from_str::<SidecarJson>(&stdout) {
        Ok(parsed) => RadiumSidecarSample {
            provider: parsed.provider.unwrap_or_else(|| "radium-lhm-pawnio".to_string()),
            executable_path: Some(path_string),
            available: parsed.available.unwrap_or(false),
            driver_available: parsed.driver_available.unwrap_or(false),
            status: parsed.status.unwrap_or_else(|| "unknown".to_string()),
            cpu_temp_c: parsed.cpu_temp_c,
            cpu_temp_label: parsed.cpu_temp_label,
            cpu_fan_rpm: parsed.cpu_fan_rpm,
            storage_temp_c: parsed.storage_temp_c,
            notes: parsed.notes.unwrap_or_default(),
        },
        Err(err) => RadiumSidecarSample {
            provider: "radium-lhm-pawnio".to_string(),
            executable_path: Some(path_string),
            available: false,
            driver_available: false,
            status: "invalid_json".to_string(),
            notes: vec![err.to_string(), stdout],
            ..Default::default()
        },
    }
}

struct SidecarCommand {
    program: PathBuf,
    args: Vec<String>,
    display_path: PathBuf,
}

fn find_sidecar_command() -> Option<SidecarCommand> {
    if cfg!(debug_assertions) {
        if let Ok(explicit) = std::env::var("RADIUM_SENSOR_SIDECAR") {
            let path = PathBuf::from(explicit);
            if path.is_file() {
                return command_for_path(path);
            }
        }
    }

    let dll_name = "radium-sensor-sidecar-x86_64-pc-windows-msvc.dll";
    let exe_name = "radium-sensor-sidecar.exe";
    let tauri_name = "radium-sensor-sidecar-x86_64-pc-windows-msvc.exe";
    let mut candidates = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            push_candidate_roots(&mut candidates, parent, exe_name, tauri_name, dll_name);
            push_candidate_roots(&mut candidates, &parent.join("resources"), exe_name, tauri_name, dll_name);
            push_candidate_roots(&mut candidates, &parent.join("resources").join("binaries"), exe_name, tauri_name, dll_name);
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        if cfg!(debug_assertions) {
            push_candidate_roots(&mut candidates, &current_dir.join("target").join("sensor-sidecar"), exe_name, tauri_name, dll_name);
            push_candidate_roots(&mut candidates, &current_dir.join("src-tauri").join("binaries"), exe_name, tauri_name, dll_name);
            push_candidate_roots(&mut candidates, &current_dir.join("binaries"), exe_name, tauri_name, dll_name);
        }
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .and_then(command_for_path)
}

fn command_for_path(path: PathBuf) -> Option<SidecarCommand> {
    let is_dll = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("dll"))
        .unwrap_or(false);

    if is_dll {
        let bundled_dotnet = bundled_dotnet_for(&path).or_else(|| {
            if cfg!(debug_assertions) {
                Some(PathBuf::from("dotnet"))
            } else {
                None
            }
        })?;
        Some(SidecarCommand {
            program: bundled_dotnet,
            args: vec![path.to_string_lossy().to_string()],
            display_path: path,
        })
    } else {
        Some(SidecarCommand {
            program: path.clone(),
            args: Vec::new(),
            display_path: path,
        })
    }
}

fn push_candidate_roots(candidates: &mut Vec<PathBuf>, root: &Path, exe_name: &str, tauri_name: &str, dll_name: &str) {
    candidates.push(root.join(dll_name));
    candidates.push(root.join(exe_name));
    candidates.push(root.join(tauri_name));
}

fn bundled_dotnet_for(sidecar_path: &Path) -> Option<PathBuf> {
    let parent = sidecar_path.parent()?;
    let mut candidates = vec![parent.join("dotnet-runtime").join("dotnet.exe")];
    if let Some(grandparent) = parent.parent() {
        candidates.push(grandparent.join("dotnet-runtime").join("dotnet.exe"));
    }

    candidates.into_iter().find(|candidate| candidate.is_file())
}
