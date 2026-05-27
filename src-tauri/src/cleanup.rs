/// Cleanup operations: RAM trimming and storage scanning.
///
/// All Windows-specific operations use the `windows` crate.  Safe-only paths
/// are used — no undocumented kernel APIs.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};

const HEAVY_SCAN_MAX_ENTRIES: usize = 40_000;

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
        message: if trimmed == 0 {
            format!(
                "Scanned {total} processes but could not trim any accessible working sets. \
                 Windows still reclaims standby pages on demand, so the visible reclaimed amount can be small. \
                 {:.2} GB reported freed.",
                freed_gb
            )
        } else {
            format!(
                "Trimmed working sets of {trimmed} accessible processes ({total} scanned). \
                 Windows memory manager reclaims standby pages on demand. \
                 {:.2} GB reported freed.",
                freed_gb
            )
        },
    }
}

#[cfg(windows)]
fn trim_all_working_sets() -> (u32, u32) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::ProcessStatus::K32EmptyWorkingSet;
    // K32EmptyWorkingSet requires PROCESS_QUERY_INFORMATION (or LIMITED) + PROCESS_SET_QUOTA.
    // Opening with only PROCESS_SET_QUOTA causes every call to silently fail (trimmed = 0).
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SET_QUOTA,
    };

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
            if let Ok(handle) = OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SET_QUOTA,
                false,
                raw_pid,
            ) {
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
    let cancel = AtomicBool::new(false);
    scan_storage_cleanup_with_progress(&cancel, |_done, _total, _label| {})
}

/// Scan known temp / cache directories with coarse progress updates and
/// cancellation support.
pub fn scan_storage_cleanup_with_progress<F>(
    cancel: &AtomicBool,
    mut on_progress: F,
) -> Vec<StorageCleanupItem>
where
    F: FnMut(usize, usize, &str),
{
    let mut items = Vec::new();
    let total_steps = 11usize;
    let mut done_steps = 0usize;

    let mut bump = |label: &str| {
        done_steps = done_steps.saturating_add(1);
        on_progress(done_steps, total_steps, label);
    };

    let cancelled = || cancel.load(Ordering::Relaxed);

    // ----- %TEMP% -----
    if cancelled() {
        return items;
    }
    if let Ok(temp_dir) = std::env::var("TEMP") {
        let (size, _, _) = dir_size_estimate_cancel(
            std::path::Path::new(&temp_dir),
            HEAVY_SCAN_MAX_ENTRIES,
            cancel,
        );
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
    bump("Scanned user temporary files");

    // ----- Windows\Temp -----
    if cancelled() {
        return items;
    }
    {
        let path = std::path::Path::new(r"C:\Windows\Temp");
        if path.exists() {
            let (size, _, _) = dir_size_estimate_cancel(path, HEAVY_SCAN_MAX_ENTRIES, cancel);
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
    bump("Scanned Windows temp");

    // ----- NVIDIA DXCache / GLCache -----
    if cancelled() {
        return items;
    }
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
                let (size, _, _) =
                    dir_size_estimate_cancel(&full, HEAVY_SCAN_MAX_ENTRIES, cancel);
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

            if cancelled() {
                return items;
            }
        }
    }
    bump("Scanned shader caches");

    // ----- Windows Error Reporting -----
    if cancelled() {
        return items;
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let path = std::path::Path::new(&local)
            .join("Microsoft")
            .join("Windows")
            .join("WER")
            .join("ReportArchive");
        if path.exists() {
            let (size, _, _) = dir_size_estimate_cancel(&path, HEAVY_SCAN_MAX_ENTRIES, cancel);
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
    bump("Scanned diagnostics logs");

    // ----- Browser caches: cache files only, no cookies/history/session data -----
    if cancelled() {
        return items;
    }
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
                let (size, _, _) = dir_size_estimate_cancel(&path, HEAVY_SCAN_MAX_ENTRIES, cancel);
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

            if cancelled() {
                return items;
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
                    let (cache_size, _, was_cancelled) =
                        dir_size_estimate_cancel(&cache, HEAVY_SCAN_MAX_ENTRIES / 2, cancel);
                    total += cache_size;
                    if was_cancelled {
                        return items;
                    }
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
    bump("Scanned browser caches");

    // ----- Communication / launcher caches: cache-only paths, no credentials/session stores -----
    if cancelled() {
        return items;
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        let comm_paths = [
            ("discord-cache", "Discord cache", std::path::Path::new(&appdata).join("discord").join("Cache")),
            ("discord-code-cache", "Discord code cache", std::path::Path::new(&appdata).join("discord").join("Code Cache")),
            ("teams-cache", "Microsoft Teams cache", std::path::Path::new(&appdata).join("Microsoft").join("Teams").join("Cache")),
        ];

        for (id, name, path) in comm_paths {
            if path.exists() {
                let (size, _, was_cancelled) = dir_size_estimate_cancel(&path, HEAVY_SCAN_MAX_ENTRIES / 2, cancel);
                if was_cancelled {
                    return items;
                }
                items.push(StorageCleanupItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    location: path.to_string_lossy().to_string(),
                    size_gb: bytes_to_gb_u64(size),
                    category: "App cache".to_string(),
                    selected: true,
                    safe: true,
                    description: "Application cache files only. Account data, settings, and sessions are intentionally excluded.".to_string(),
                });
            }
            if cancelled() {
                return items;
            }
        }
    }
    bump("Scanned communication app caches");

    // ----- Explorer thumbnail cache -----
    if cancelled() {
        return items;
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let explorer = std::path::Path::new(&local)
            .join("Microsoft")
            .join("Windows")
            .join("Explorer");
        if explorer.exists() {
            let (size, _, was_cancelled) = matching_files_size(&explorer, "thumbcache_", cancel);
            if was_cancelled {
                return items;
            }
            if size > 0 {
                items.push(StorageCleanupItem {
                    id: "thumbnail-cache".to_string(),
                    name: "Windows thumbnail cache".to_string(),
                    location: explorer.to_string_lossy().to_string(),
                    size_gb: bytes_to_gb_u64(size),
                    category: "Explorer".to_string(),
                    selected: true,
                    safe: true,
                    description: "Explorer thumbnail databases. Windows rebuilds them automatically as folders are browsed.".to_string(),
                });
            }
        }
    }
    bump("Scanned Explorer thumbnail cache");

    // ----- Windows Update / Delivery Optimization caches -----
    if cancelled() {
        return items;
    }
    let update_cache = std::path::Path::new(r"C:\Windows\SoftwareDistribution\Download");
    if update_cache.exists() {
        let (size, estimated, was_cancelled) =
            dir_size_estimate_cancel(update_cache, HEAVY_SCAN_MAX_ENTRIES, cancel);
        if was_cancelled {
            return items;
        }
        items.push(StorageCleanupItem {
            id: "windows-update-cache".to_string(),
            name: "Windows Update download cache".to_string(),
            location: update_cache.to_string_lossy().to_string(),
            size_gb: bytes_to_gb_u64(size),
            category: "Windows Update".to_string(),
            selected: false,
            safe: true,
            description: if estimated {
                "Downloaded update payloads. Size is estimated for performance on very large cache trees; live cleanup may require administrator rights.".to_string()
            } else {
                "Downloaded update payloads. Safe after updates finish; live cleanup may require administrator rights.".to_string()
            },
        });
    }

    let delivery_cache = std::path::Path::new(r"C:\ProgramData\Microsoft\Windows\DeliveryOptimization\Cache");
    if delivery_cache.exists() {
        let (size, estimated, was_cancelled) =
            dir_size_estimate_cancel(delivery_cache, HEAVY_SCAN_MAX_ENTRIES, cancel);
        if was_cancelled {
            return items;
        }
        items.push(StorageCleanupItem {
            id: "delivery-optimization-cache".to_string(),
            name: "Delivery Optimization cache".to_string(),
            location: delivery_cache.to_string_lossy().to_string(),
            size_gb: bytes_to_gb_u64(size),
            category: "Windows Update".to_string(),
            selected: false,
            safe: true,
            description: if estimated {
                "Windows peer/update cache. Size is estimated for performance on very large cache trees. Safe to review and clean when downloads are idle.".to_string()
            } else {
                "Windows peer/update cache. Safe to review and clean when downloads are idle.".to_string()
            },
        });
    }
    bump("Scanned Windows update caches");

    // ----- Downloads folder (review-only) -----
    if cancelled() {
        return items;
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let downloads = std::path::Path::new(&profile).join("Downloads");
        if downloads.exists() {
            let (size, estimated, was_cancelled) =
                dir_size_estimate_cancel(&downloads, HEAVY_SCAN_MAX_ENTRIES, cancel);
            if was_cancelled {
                return items;
            }
            items.push(StorageCleanupItem {
                id: "user-downloads".to_string(),
                name: "User Downloads (review)".to_string(),
                location: downloads.to_string_lossy().to_string(),
                size_gb: bytes_to_gb_u64(size),
                category: "Downloads".to_string(),
                selected: false,
                safe: false,
                description: if estimated {
                    "Personal download folder. Size is estimated for performance. Review manually before deletion to avoid losing installers/documents.".to_string()
                } else {
                    "Personal download folder. Review manually before deletion to avoid losing installers/documents.".to_string()
                },
            });
        }
    }
    bump("Scanned Downloads review target");

    // ----- Recycle Bin -----
    if cancelled() {
        return items;
    }
    let (recycle_estimate, recycle_estimated) = estimate_recycle_bin_bytes();
    if recycle_estimate > 0 {
        items.push(StorageCleanupItem {
            id: "recycle-bin".to_string(),
            name: "Recycle Bin".to_string(),
            location: "Shell:RecycleBinFolder".to_string(),
            size_gb: bytes_to_gb_u64(recycle_estimate),
            category: "Recycle Bin".to_string(),
            selected: true,
            safe: true,
            description: if recycle_estimated {
                "Files already marked for deletion. Size is estimated for performance on large recycle stores. Safe to empty when you no longer need to restore them.".to_string()
            } else {
                "Files already marked for deletion. Safe to empty when you no longer need to restore them.".to_string()
            },
        });
    }
    bump("Scanned Recycle Bin");

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
                    if !item.safe {
                        return format!("[blocked] {}: cleanup target requires manual review", item.name);
                    }
                    if dry_run {
                        format!(
                            "[dry-run] {}: would reclaim {:.2} GB from {}",
                            item.name, item.size_gb, item.location
                        )
                    } else {
                        if item.id == "recycle-bin" {
                            return clear_recycle_bin();
                        }
                        if item.id == "thumbnail-cache" {
                            return match delete_matching_files(std::path::Path::new(&item.location), "thumbcache_") {
                                Ok(freed) => format!(
                                    "[ok] {}: reclaimed {:.2} GB",
                                    item.name,
                                    bytes_to_gb_u64(freed)
                                ),
                                Err(e) => format!("[error] {}: {e}", item.name),
                            };
                        }

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

fn dir_size_estimate(path: &std::path::Path, max_entries: usize) -> (u64, bool) {
    let mut budget = max_entries;
    let size = dir_size_limited(path, &mut budget);
    (size, budget == 0)
}

fn dir_size_estimate_cancel(
    path: &std::path::Path,
    max_entries: usize,
    cancel: &AtomicBool,
) -> (u64, bool, bool) {
    let mut budget = max_entries;
    let size = dir_size_limited_cancel(path, &mut budget, cancel);
    let cancelled = cancel.load(Ordering::Relaxed);
    (size, budget == 0, cancelled)
}

fn dir_size_limited(path: &std::path::Path, budget: &mut usize) -> u64 {
    if *budget == 0 {
        return 0;
    }

    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if *budget == 0 {
                break;
            }
            *budget = budget.saturating_sub(1);

            let p = entry.path();
            if p.is_symlink() {
                continue;
            }
            if p.is_file() {
                if let Ok(meta) = p.metadata() {
                    size += meta.len();
                }
            } else if p.is_dir() {
                size += dir_size_limited(&p, budget);
            }
        }
    }
    size
}

fn dir_size_limited_cancel(path: &std::path::Path, budget: &mut usize, cancel: &AtomicBool) -> u64 {
    if *budget == 0 || cancel.load(Ordering::Relaxed) {
        return 0;
    }

    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if *budget == 0 || cancel.load(Ordering::Relaxed) {
                break;
            }
            *budget = budget.saturating_sub(1);

            let p = entry.path();
            if p.is_symlink() {
                continue;
            }
            if p.is_file() {
                if let Ok(meta) = p.metadata() {
                    size += meta.len();
                }
            } else if p.is_dir() {
                size += dir_size_limited_cancel(&p, budget, cancel);
            }
        }
    }
    size
}

fn matching_files_size(path: &std::path::Path, prefix: &str, cancel: &AtomicBool) -> (u64, bool, bool) {
    let mut size = 0u64;
    let mut visited = 0usize;
    let mut estimated = false;

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if cancel.load(Ordering::Relaxed) {
                break;
            }
            visited = visited.saturating_add(1);
            if visited > HEAVY_SCAN_MAX_ENTRIES {
                estimated = true;
                break;
            }
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let Some(name) = p.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if name.to_ascii_lowercase().starts_with(&prefix.to_ascii_lowercase()) {
                if let Ok(meta) = p.metadata() {
                    size += meta.len();
                }
            }
        }
    }

    (size, estimated, cancel.load(Ordering::Relaxed))
}

/// Delete all direct children of `path` (not the directory itself).
/// Returns total bytes freed.
fn delete_dir_contents(path: &std::path::Path) -> std::io::Result<u64> {
    let mut freed = 0u64;
    for entry in std::fs::read_dir(path)?.flatten() {
        let p = entry.path();
        let metadata = match std::fs::symlink_metadata(&p) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let size = if metadata.file_type().is_symlink() {
            0
        } else if metadata.is_dir() {
            dir_size(&p)
        } else {
            metadata.len()
        };
        let result = delete_child_path(&p, &metadata);
        if result.is_ok() {
            freed += size;
        }
    }
    Ok(freed)
}

fn delete_child_path(path: &std::path::Path, metadata: &std::fs::Metadata) -> std::io::Result<()> {
    if metadata.file_type().is_symlink() {
        return std::fs::remove_file(path).or_else(|_| std::fs::remove_dir(path));
    }
    if metadata.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    }
}

fn delete_matching_files(path: &std::path::Path, prefix: &str) -> std::io::Result<u64> {
    let mut freed = 0u64;
    for entry in std::fs::read_dir(path)?.flatten() {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let Some(name) = p.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !name.to_ascii_lowercase().starts_with(&prefix.to_ascii_lowercase()) {
            continue;
        }
        let size = p.metadata().map(|meta| meta.len()).unwrap_or(0);
        if std::fs::remove_file(&p).is_ok() {
            freed += size;
        }
    }
    Ok(freed)
}

fn bytes_to_gb_u64(bytes: u64) -> f32 {
    bytes as f32 / 1_073_741_824.0
}

fn estimate_recycle_bin_bytes() -> (u64, bool) {
    #[cfg(windows)]
    {
        // Each volume has a hidden $Recycle.Bin root.
        let mut total = 0u64;
        let mut estimated = false;
        for drive in b'A'..=b'Z' {
            let root = format!("{}:\\$Recycle.Bin", drive as char);
            let p = std::path::Path::new(&root);
            if p.exists() {
                let (size, was_estimated) = dir_size_estimate(p, HEAVY_SCAN_MAX_ENTRIES);
                total += size;
                estimated |= was_estimated;
            }
        }
        (total, estimated)
    }

    #[cfg(not(windows))]
    {
        (0, false)
    }
}

fn clear_recycle_bin() -> String {
    #[cfg(windows)]
    {
        let mut emptied_any = false;
        let mut failures: Vec<String> = Vec::new();

        for drive in b'A'..=b'Z' {
            let root = format!("{}:\\$Recycle.Bin", drive as char);
            let path = std::path::Path::new(&root);
            if !path.exists() {
                continue;
            }

            emptied_any = true;
            match std::fs::read_dir(path) {
                Ok(entries) => {
                    for entry in entries.flatten() {
                        let child = entry.path();
                        let result = match std::fs::symlink_metadata(&child) {
                            Ok(metadata) => delete_child_path(&child, &metadata),
                            Err(err) => Err(err),
                        };
                        if let Err(err) = result {
                            failures.push(format!("{}: {}", child.display(), err));
                        }
                    }
                }
                Err(err) => failures.push(format!("{}: {}", path.display(), err)),
            }
        }

        return if failures.is_empty() {
            if emptied_any {
                "[ok] Recycle Bin: emptied".to_string()
            } else {
                "[ok] Recycle Bin: nothing to empty".to_string()
            }
        } else if emptied_any {
            format!("[ok] Recycle Bin: emptied with some skipped items ({})", failures.len())
        } else {
            format!("[error] Recycle Bin: {}", failures.join("; "))
        };
    }

    #[cfg(not(windows))]
    {
        "[unavailable] Recycle Bin cleanup requires Windows".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{bytes_to_gb_u64, delete_dir_contents, dir_size, run_storage_cleanup};

    fn temp_test_dir(name: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("radium-cleanup-test-{name}-{stamp}"))
    }

    #[test]
    fn bytes_to_gb_conversion_is_reasonable() {
        let one_gib = 1_073_741_824u64;
        let gb = bytes_to_gb_u64(one_gib);
        assert!((gb - 1.0).abs() < 0.001);
    }

    #[test]
    fn dir_size_and_delete_dir_contents_work() {
        let root = temp_test_dir("delete");
        let nested = root.join("nested");
        std::fs::create_dir_all(&nested).expect("create nested test dir");

        let a = root.join("a.bin");
        let b = nested.join("b.bin");
        std::fs::write(&a, vec![0u8; 1024]).expect("write a.bin");
        std::fs::write(&b, vec![0u8; 2048]).expect("write b.bin");

        let before = dir_size(&root);
        assert!(before >= 3072);

        let freed = delete_dir_contents(&root).expect("delete contents");
        assert!(freed >= 3072);
        assert_eq!(dir_size(&root), 0);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn storage_cleanup_reports_unknown_id() {
        let log = run_storage_cleanup(vec!["no-such-id".to_string()], true);
        assert_eq!(log.len(), 1);
        assert!(log[0].starts_with("[error] no-such-id: item not found in scan results"));
    }
}
