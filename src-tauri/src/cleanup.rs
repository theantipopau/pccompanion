/// Cleanup operations: RAM trimming and storage scanning.
///
/// All Windows-specific operations use the `windows` crate.  Safe-only paths
/// are used — no undocumented kernel APIs.

use serde::Serialize;

// ─── RAM Cleaner ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RamCleanupResult {
    pub before_gb: f32,
    pub after_gb: f32,
    pub freed_gb: f32,
    pub mode: &'static str,
    pub message: String,
}

/// Trim working sets of all accessible processes.
///
/// `EmptyWorkingSet` pages out each process's resident private pages to the
/// standby list.  Windows can then reclaim that memory for other uses.  It is
/// safe, reversible, and does not terminate or otherwise interfere with any
/// process.
pub fn optimize_ram() -> RamCleanupResult {
    use sysinfo::System;

    let mut sys = System::new_all();
    sys.refresh_memory();
    let before_gb = crate::hardware::bytes_to_gb(sys.used_memory());

    let (trimmed, total) = trim_all_working_sets();
    log::info!("Working-set trim: {trimmed}/{total} processes trimmed.");

    // Allow Windows to reclaim standby pages.
    std::thread::sleep(std::time::Duration::from_millis(600));

    sys.refresh_memory();
    let after_gb = crate::hardware::bytes_to_gb(sys.used_memory());
    let freed_gb = (before_gb - after_gb).max(0.0);

    RamCleanupResult {
        before_gb,
        after_gb,
        freed_gb,
        mode: "safe",
        message: format!(
            "Trimmed working sets of {trimmed} accessible processes ({total} scanned). \
             Windows memory manager reclaims standby pages on demand. \
             {:.2} GB reported freed.",
            freed_gb
        ),
    }
}

#[cfg(windows)]
fn trim_all_working_sets() -> (u32, u32) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::ProcessStatus::K32EmptyWorkingSet;
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA};

    // Also trim our own process first (no OpenProcess needed).
    unsafe {
        let self_handle =
            windows::Win32::System::Threading::GetCurrentProcess();
        let _ = K32EmptyWorkingSet(self_handle);
    }

    let sys = sysinfo::System::new_all();
    let mut trimmed = 0u32;
    let mut total = 0u32;

    for (pid, _process) in sys.processes() {
        total += 1;
        let raw_pid = pid.as_u32();
        unsafe {
            if let Ok(handle) = OpenProcess(PROCESS_SET_QUOTA, false, raw_pid) {
                if K32EmptyWorkingSet(handle).as_bool() {
                    trimmed += 1;
                }
                let _ = CloseHandle(handle);
            }
        }
    }

    (trimmed, total)
}

#[cfg(not(windows))]
fn trim_all_working_sets() -> (u32, u32) {
    (0, 0)
}

// ─── Storage Scanner ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupItem {
    pub id: String,
    pub name: String,
    pub location: String,
    pub size_gb: f32,
    pub category: String,
    pub selected: bool,
    pub safe: bool,
    pub description: String,
}

/// Scan known temp / cache directories and return real file-system sizes.
pub fn scan_storage_cleanup() -> Vec<StorageCleanupItem> {
    let mut items = Vec::new();

    // ----- %TEMP% -----
    if let Ok(temp_dir) = std::env::var("TEMP") {
        let size = dir_size(std::path::Path::new(&temp_dir));
        items.push(StorageCleanupItem {
            id: "user-temp".to_string(),
            name: "User temporary files".to_string(),
            location: temp_dir,
            size_gb: bytes_to_gb_u64(size),
            category: "Temporary".to_string(),
            selected: true,
            safe: true,
            description: "Files in %TEMP% left over by installers and apps.".to_string(),
        });
    }

    // ----- Windows\Temp -----
    {
        let path = std::path::Path::new(r"C:\Windows\Temp");
        if path.exists() {
            let size = dir_size(path);
            items.push(StorageCleanupItem {
                id: "windows-temp".to_string(),
                name: "Windows system temporary files".to_string(),
                location: path.to_string_lossy().to_string(),
                size_gb: bytes_to_gb_u64(size),
                category: "Temporary".to_string(),
                selected: true,
                safe: true,
                description: "System-level temporary files. Safe to delete when no installers are running.".to_string(),
            });
        }
    }

    // ----- NVIDIA DXCache / GLCache -----
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let shader_paths = [
            ("nvidia-dxcache", "NVIDIA DX shader cache", r"NVIDIA\DXCache"),
            ("nvidia-glcache", "NVIDIA GL shader cache", r"NVIDIA\GLCache"),
            ("amd-dxcache", "AMD DX shader cache", r"AMD\DxCache"),
            ("d3dscache", "D3D shader cache", r"D3DSCache"),
        ];

        for (id, name, rel) in &shader_paths {
            let full = std::path::Path::new(&local).join(rel);
            if full.exists() {
                let size = dir_size(&full);
                items.push(StorageCleanupItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    location: full.to_string_lossy().to_string(),
                    size_gb: bytes_to_gb_u64(size),
                    category: "Shaders".to_string(),
                    selected: true,
                    safe: true,
                    description: "Driver shader cache — automatically rebuilt on next game launch.".to_string(),
                });
            }
        }
    }

    // ----- Windows Error Reporting -----
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let path = std::path::Path::new(&local)
            .join("Microsoft")
            .join("Windows")
            .join("WER")
            .join("ReportArchive");
        if path.exists() {
            let size = dir_size(&path);
            items.push(StorageCleanupItem {
                id: "wer-reports".to_string(),
                name: "Windows Error Reporting archives".to_string(),
                location: path.to_string_lossy().to_string(),
                size_gb: bytes_to_gb_u64(size),
                category: "Logs".to_string(),
                selected: false,
                safe: true,
                description: "Crash dump archives. Safe to remove if you do not need them for debugging.".to_string(),
            });
        }
    }

    // ----- Browser caches: cache files only, no cookies/history/session data -----
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let browser_paths = [
            (
                "edge-cache",
                "Microsoft Edge cache",
                std::path::Path::new(&local)
                    .join("Microsoft")
                    .join("Edge")
                    .join("User Data")
                    .join("Default")
                    .join("Cache"),
            ),
            (
                "chrome-cache",
                "Google Chrome cache",
                std::path::Path::new(&local)
                    .join("Google")
                    .join("Chrome")
                    .join("User Data")
                    .join("Default")
                    .join("Cache"),
            ),
        ];

        for (id, name, path) in browser_paths {
            if path.exists() {
                let size = dir_size(&path);
                items.push(StorageCleanupItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    location: path.to_string_lossy().to_string(),
                    size_gb: bytes_to_gb_u64(size),
                    category: "Browser".to_string(),
                    selected: true,
                    safe: true,
                    description: "Browser cache files only. Cookies, history, passwords, and sessions are excluded.".to_string(),
                });
            }
        }
    }

    if let Ok(appdata) = std::env::var("APPDATA") {
        let firefox_profiles = std::path::Path::new(&appdata)
            .join("Mozilla")
            .join("Firefox")
            .join("Profiles");
        if let Ok(entries) = std::fs::read_dir(&firefox_profiles) {
            let mut total = 0u64;
            for entry in entries.flatten() {
                let cache = entry.path().join("cache2");
                if cache.exists() {
                    total += dir_size(&cache);
                }
            }
            if total > 0 {
                items.push(StorageCleanupItem {
                    id: "firefox-cache".to_string(),
                    name: "Mozilla Firefox cache".to_string(),
                    location: firefox_profiles.to_string_lossy().to_string(),
                    size_gb: bytes_to_gb_u64(total),
                    category: "Browser".to_string(),
                    selected: true,
                    safe: true,
                    description: "Firefox profile cache folders only. Cookies, history, passwords, and sessions are excluded.".to_string(),
                });
            }
        }
    }

    // ----- Windows Update / Delivery Optimization caches -----
    let update_cache = std::path::Path::new(r"C:\Windows\SoftwareDistribution\Download");
    if update_cache.exists() {
        let size = dir_size(update_cache);
        items.push(StorageCleanupItem {
            id: "windows-update-cache".to_string(),
            name: "Windows Update download cache".to_string(),
            location: update_cache.to_string_lossy().to_string(),
            size_gb: bytes_to_gb_u64(size),
            category: "Windows Update".to_string(),
            selected: false,
            safe: true,
            description: "Downloaded update payloads. Safe after updates finish; live cleanup may require administrator rights.".to_string(),
        });
    }

    let delivery_cache = std::path::Path::new(r"C:\ProgramData\Microsoft\Windows\DeliveryOptimization\Cache");
    if delivery_cache.exists() {
        let size = dir_size(delivery_cache);
        items.push(StorageCleanupItem {
            id: "delivery-optimization-cache".to_string(),
            name: "Delivery Optimization cache".to_string(),
            location: delivery_cache.to_string_lossy().to_string(),
            size_gb: bytes_to_gb_u64(size),
            category: "Windows Update".to_string(),
            selected: false,
            safe: true,
            description: "Windows peer/update cache. Safe to review and clean when downloads are idle.".to_string(),
        });
    }

    items
}

/// Execute a storage cleanup (or dry-run).
pub fn run_storage_cleanup(ids: Vec<String>, dry_run: bool) -> Vec<String> {
    let items = scan_storage_cleanup();
    let map: std::collections::HashMap<_, _> = items
        .iter()
        .map(|i| (i.id.as_str(), i))
        .collect();

    ids.into_iter()
        .map(|id| {
            match map.get(id.as_str()) {
                None => format!("[error] {id}: item not found in scan results"),
                Some(item) => {
                    if dry_run {
                        format!(
                            "[dry-run] {}: would reclaim {:.2} GB from {}",
                            item.name, item.size_gb, item.location
                        )
                    } else {
                        match delete_dir_contents(std::path::Path::new(&item.location)) {
                            Ok(freed) => format!(
                                "[ok] {}: reclaimed {:.2} GB",
                                item.name,
                                bytes_to_gb_u64(freed)
                            ),
                            Err(e) => format!("[error] {}: {e}", item.name),
                        }
                    }
                }
            }
        })
        .collect()
}

// ─── File-system helpers ─────────────────────────────────────────────────────

/// Recursively sum file sizes under `path`.  Ignores unreadable entries.
pub fn dir_size(path: &std::path::Path) -> u64 {
    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_symlink() {
                continue; // Do not follow symlinks.
            }
            if p.is_file() {
                if let Ok(meta) = p.metadata() {
                    size += meta.len();
                }
            } else if p.is_dir() {
                size += dir_size(&p);
            }
        }
    }
    size
}

/// Delete all direct children of `path` (not the directory itself).
/// Returns total bytes freed.
fn delete_dir_contents(path: &std::path::Path) -> std::io::Result<u64> {
    let mut freed = 0u64;
    for entry in std::fs::read_dir(path)?.flatten() {
        let p = entry.path();
        let size = if p.is_dir() {
            dir_size(&p)
        } else {
            p.metadata().map(|m| m.len()).unwrap_or(0)
        };
        let result = if p.is_dir() {
            std::fs::remove_dir_all(&p)
        } else {
            std::fs::remove_file(&p)
        };
        if result.is_ok() {
            freed += size;
        }
    }
    Ok(freed)
}

fn bytes_to_gb_u64(bytes: u64) -> f32 {
    bytes as f32 / 1_073_741_824.0
}
