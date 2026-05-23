/// Windows system utilities: startup manager and bloatware scanner.
///
/// Uses the Windows registry and PowerShell (for AppX queries).  All write
/// operations are dry-run by default; live execution requires the caller to
/// pass `dry_run = false` explicitly.

use serde::Serialize;

// ─── Startup Manager ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupItem {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub command: String,
    pub location: String,
    pub impact: String,
    pub enabled: bool,
    pub recommended: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryIssue {
    pub id: String,
    pub hive: String,
    pub key_path: String,
    pub value_name: String,
    pub category: String,
    pub severity: String,
    pub selected: bool,
    pub safe: bool,
    pub description: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegistryBackup {
    pub id: String,
    pub created_at: String,
    pub path: String,
    pub issue_count: usize,
}

#[derive(Debug, Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegistryBackupManifest {
    id: String,
    created_at: String,
    issue_count: usize,
    entries: Vec<RegistryBackupEntry>,
}

#[derive(Debug, Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RegistryBackupEntry {
    issue_id: String,
    reg_file: Option<String>,
    note: String,
}

/// Scan the four standard Run registry keys and return real startup entries.
pub fn scan_startup_items() -> Vec<StartupItem> {
    let mut items = Vec::new();

    #[cfg(windows)]
    {
        use windows::Win32::System::Registry::{
            HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
        };

        const RUN_KEY: &str =
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
        const RUN_ONCE_KEY: &str =
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce";
        const APPROVED_KEY: &str =
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

        let hives: &[(&str, _)] = &[
            ("HKCU", HKEY_CURRENT_USER),
            ("HKLM", HKEY_LOCAL_MACHINE),
        ];

        // ── Run key (persistent startup) ──────────────────────────────────
        for &(hive_name, hive) in hives {
            let run_values = read_run_key(hive, RUN_KEY);
            let approved_map = read_approved_key(hive, APPROVED_KEY);

            for (name, command) in run_values {
                let enabled = approved_map.get(&name).copied().unwrap_or(true);
                let id = format!("{hive_name}:{}", sanitize_id(&name));
                let impact = estimate_impact(&command);
                let recommended = recommend(&name, &command, enabled);
                let publisher = extract_publisher(&command);
                items.push(StartupItem {
                    id,
                    name,
                    publisher,
                    command,
                    location: format!("Registry ({hive_name}\\Run)"),
                    impact,
                    enabled,
                    recommended,
                });
            }
        }

        // ── RunOnce key (single-run entries; may indicate malware persistence) ───
        for &(hive_name, hive) in hives {
            let once_values = read_run_key(hive, RUN_ONCE_KEY);
            for (name, command) in once_values {
                let id = format!("{hive_name}-ONCE:{}", sanitize_id(&name));
                let impact = estimate_impact(&command);
                let publisher = extract_publisher(&command);
                items.push(StartupItem {
                    id,
                    name: name.clone(),
                    publisher,
                    command: command.clone(),
                    location: format!("Registry ({hive_name}\\RunOnce) — runs once"),
                    impact,
                    enabled: true, // RunOnce entries are always "active" until consumed
                    recommended: "review".to_string(),
                });
            }
        }
    }

    // ── Startup folder (user + all-users) ────────────────────────────────
    scan_startup_folder_items(&mut items);

    items
}

/// Append items discovered in the Windows Startup shell folders.
fn scan_startup_folder_items(items: &mut Vec<StartupItem>) {
    let folders: Vec<(String, std::path::PathBuf)> = [
        (
            "AppData",
            std::env::var("APPDATA").ok().map(|a| {
                std::path::PathBuf::from(a)
                    .join(r"Microsoft\Windows\Start Menu\Programs\Startup")
            }),
        ),
        (
            "ProgramData",
            std::env::var("PROGRAMDATA").ok().map(|p| {
                std::path::PathBuf::from(p)
                    .join(r"Microsoft\Windows\Start Menu\Programs\StartUp")
            }),
        ),
    ]
    .into_iter()
    .filter_map(|(label, opt_path)| opt_path.map(|p| (label.to_string(), p)))
    .collect();

    for (label, folder) in folders {
        let Ok(dir) = std::fs::read_dir(&folder) else { continue };
        for entry in dir.flatten() {
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !matches!(ext.as_str(), "lnk" | "exe" | "bat" | "cmd" | "vbs") {
                continue;
            }
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();
            let command = path.to_string_lossy().to_string();
            let id = format!("STARTUP-FOLDER-{}:{}", label, sanitize_id(&name));
            items.push(StartupItem {
                id,
                name: name.clone(),
                publisher: extract_publisher(&command),
                command: command.clone(),
                location: format!("Startup Folder ({label})"),
                impact: estimate_impact(&command),
                enabled: true, // folder presence = enabled; StartupApproved\StartupFolder not wired yet
                recommended: recommend(&name, &command, true),
            });
        }
    }
}

/// Enable or disable a startup item in the `StartupApproved` registry key.
pub fn set_startup_item_enabled(id: &str, enabled: bool, dry_run: bool) -> String {
    if dry_run {
        return format!(
            "[dry-run] {} startup entry '{}' (restore point not yet created)",
            if enabled { "Enable" } else { "Disable" },
            id
        );
    }

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Registry::{
            RegCloseKey, RegOpenKeyExW, RegSetValueExW,
            HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
            KEY_SET_VALUE, KEY_WOW64_64KEY, REG_BINARY,
        };
        use windows::core::PCWSTR;

        // Startup folder items: toggling requires moving the file; not wired yet.
        if id.starts_with("STARTUP-FOLDER-") {
            return format!("[info] {id}: startup folder entries can be removed manually from the Startup folder (shell:startup).");
        }

        // RunOnce items: they are not toggled via StartupApproved.
        // Disabling a RunOnce entry means deleting it; re-enabling is not possible.
        if id.contains("-ONCE:") {
            if enabled {
                return format!("[info] {id}: RunOnce entries cannot be re-created through this tool.");
            }
            // Deletion of RunOnce entries is treated as safe — they run at most once anyway.
            let (hive, name) = if let Some(n) = id.strip_prefix("HKCU-ONCE:") {
                (HKEY_CURRENT_USER, n)
            } else if let Some(n) = id.strip_prefix("HKLM-ONCE:") {
                (HKEY_LOCAL_MACHINE, n)
            } else {
                return format!("[error] {id}: unrecognised RunOnce hive prefix");
            };
            const RUN_ONCE_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce";
            use windows::Win32::System::Registry::{RegDeleteValueW, KEY_WRITE};
            unsafe {
                let subkey_wide: Vec<u16> =
                    RUN_ONCE_KEY.encode_utf16().chain(std::iter::once(0)).collect();
                let mut hkey = windows::Win32::System::Registry::HKEY::default();
                let res = RegOpenKeyExW(
                    hive,
                    PCWSTR(subkey_wide.as_ptr()),
                    0,
                    KEY_WRITE | KEY_WOW64_64KEY,
                    &mut hkey,
                );
                if res != ERROR_SUCCESS {
                    return format!("[error] {id}: cannot open RunOnce key");
                }
                let name_wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
                let del_res = RegDeleteValueW(hkey, PCWSTR(name_wide.as_ptr()));
                let _ = RegCloseKey(hkey);
                return if del_res == ERROR_SUCCESS {
                    format!("[ok] {name}: RunOnce entry removed")
                } else {
                    format!("[error] {id}: removal failed — admin may be required")
                };
            }
        }

        // Determine hive from id prefix "HKCU:" or "HKLM:"
        let (hive, name) = if let Some(n) = id.strip_prefix("HKCU:") {
            (HKEY_CURRENT_USER, n)
        } else if let Some(n) = id.strip_prefix("HKLM:") {
            (HKEY_LOCAL_MACHINE, n)
        } else {
            return format!("[error] {id}: unrecognised hive prefix");
        };

        // The id uses sanitized name; we must store the original value name.
        // For the approved key we write 12 bytes: first byte 0x02=enabled, 0x03=disabled.
        let data: [u8; 12] = if enabled {
            [0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
        } else {
            [0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
        };

        const APPROVED_KEY: &str =
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";

        unsafe {
            let subkey_wide: Vec<u16> =
                APPROVED_KEY.encode_utf16().chain(std::iter::once(0)).collect();
            let mut hkey = windows::Win32::System::Registry::HKEY::default();
            let res = RegOpenKeyExW(
                hive,
                PCWSTR(subkey_wide.as_ptr()),
                0,
                KEY_SET_VALUE | KEY_WOW64_64KEY,
                &mut hkey,
            );
            if res != ERROR_SUCCESS {
                return format!("[error] {id}: cannot open StartupApproved key (admin required?)");
            }
            let name_wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
            let write_res = RegSetValueExW(
                hkey,
                PCWSTR(name_wide.as_ptr()),
                0,
                REG_BINARY,
                Some(&data),
            );
            let _ = RegCloseKey(hkey);
            if write_res == ERROR_SUCCESS {
                format!(
                    "[ok] {}: startup {} (takes effect on next login)",
                    name,
                    if enabled { "enabled" } else { "disabled" }
                )
            } else {
                format!("[error] {id}: registry write failed — try running as administrator")
            }
        }
    }

    #[cfg(not(windows))]
    format!("[unavailable] {id}: startup management requires Windows")
}

/// Register or unregister the packaged Companion app for current-user Windows startup.
///
/// Uses HKCU Run so this does not require elevation and remains visible/reversible
/// through standard Windows startup tooling.
pub fn set_companion_startup_enabled(enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Registry::{
            RegCloseKey, RegCreateKeyExW, RegDeleteValueW, RegSetValueExW, HKEY_CURRENT_USER,
            KEY_SET_VALUE, REG_OPTION_NON_VOLATILE, REG_SZ,
        };

        const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
        const VALUE_NAME: &str = "Radium PCs Companion";

        let exe = std::env::current_exe()
            .map_err(|err| format!("Unable to resolve Companion executable path: {err}"))?;
        let command = format!("\"{}\" --background", exe.to_string_lossy());
        let key_wide = wide_null(RUN_KEY);
        let value_wide = wide_null(VALUE_NAME);

        unsafe {
            let mut hkey = windows::Win32::System::Registry::HKEY::default();
            let create_res = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(key_wide.as_ptr()),
                0,
                None,
                REG_OPTION_NON_VOLATILE,
                KEY_SET_VALUE,
                None,
                &mut hkey,
                None,
            );
            if create_res != ERROR_SUCCESS {
                return Err("Unable to open current-user Run key for startup registration.".to_string());
            }

            let result = if enabled {
                let command_wide = wide_null(&command);
                let bytes = std::slice::from_raw_parts(
                    command_wide.as_ptr() as *const u8,
                    command_wide.len() * std::mem::size_of::<u16>(),
                );
                RegSetValueExW(hkey, PCWSTR(value_wide.as_ptr()), 0, REG_SZ, Some(bytes))
            } else {
                RegDeleteValueW(hkey, PCWSTR(value_wide.as_ptr()))
            };

            let _ = RegCloseKey(hkey);

            if result == ERROR_SUCCESS {
                Ok(enabled)
            } else {
                Err(format!(
                    "Startup registration {} failed with Win32 code {}.",
                    if enabled { "enable" } else { "disable" },
                    result.0
                ))
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("Startup registration requires Windows.".to_string())
    }
}

/// Conservative registry cleaner scan. This intentionally focuses on orphaned
/// references that can be verified without broad heuristic registry mutation.
pub fn scan_registry_issues() -> Vec<RegistryIssue> {
    let mut issues = Vec::new();

    for item in scan_startup_items() {
        if item.command.trim().is_empty() {
            continue;
        }

        if looks_missing_file_reference(&item.command) {
            issues.push(RegistryIssue {
                id: format!("startup-missing-{}", sanitize_id(&item.name)),
                hive: if item.id.starts_with("HKLM") { "HKLM" } else { "HKCU" }.to_string(),
                key_path: r"Software\Microsoft\Windows\CurrentVersion\Run".to_string(),
                value_name: item.name,
                category: "Invalid startup reference".to_string(),
                severity: "low".to_string(),
                selected: true,
                safe: true,
                description: "Startup entry points to an executable that no longer appears to exist.".to_string(),
            });
        }
    }

    #[cfg(windows)]
    {
        issues.extend(scan_uninstall_leftovers());
        issues.extend(scan_app_path_leftovers());
    }

    if issues.is_empty() {
        issues.push(RegistryIssue {
            id: "sample-uninstall-leftover".to_string(),
            hive: "HKLM".to_string(),
            key_path: r"Software\Microsoft\Windows\CurrentVersion\Uninstall".to_string(),
            value_name: "DisplayIcon".to_string(),
            category: "Uninstall leftover".to_string(),
            severity: "low".to_string(),
            selected: false,
            safe: true,
            description: "No verified registry issues were found. Sample row shows the scanner contract.".to_string(),
        });
    }

    issues
}

pub fn backup_registry_issues(ids: Vec<String>) -> RegistryBackup {
    let stamp = registry_stamp();
    let backup_root = registry_backup_dir().join(&stamp);
    let _ = std::fs::create_dir_all(&backup_root);
    let path_buf = backup_root.join("manifest.json");
    let issues: Vec<RegistryIssue> = scan_registry_issues()
        .into_iter()
        .filter(|issue| ids.iter().any(|id| id == &issue.id))
        .collect();

    let mut entries = Vec::new();
    for (index, issue) in issues.iter().enumerate() {
        let full_key = format!("{}\\{}", issue.hive, issue.key_path);
        let file_name = format!("{:03}-{}.reg", index + 1, sanitize_id(&issue.id));
        let reg_path = backup_root.join(file_name);

        #[cfg(windows)]
        let export_result = export_registry_key(&full_key, &reg_path);
        #[cfg(not(windows))]
        let export_result: Result<(), String> = Err("Registry export requires Windows".to_string());

        match export_result {
            Ok(_) => entries.push(RegistryBackupEntry {
                issue_id: issue.id.clone(),
                reg_file: Some(reg_path.to_string_lossy().to_string()),
                note: format!("Exported key {}", full_key),
            }),
            Err(err) => entries.push(RegistryBackupEntry {
                issue_id: issue.id.clone(),
                reg_file: None,
                note: format!("Failed to export {}: {}", full_key, err),
            }),
        }
    }

    let snapshot = RegistryBackupManifest {
        id: stamp.clone(),
        created_at: stamp.clone(),
        issue_count: issues.len(),
        entries,
    };
    let _ = std::fs::write(
        &path_buf,
        serde_json::to_string_pretty(&snapshot).unwrap_or_else(|_| "{}".to_string()),
    );
    let path = path_buf.to_string_lossy().to_string();
    RegistryBackup {
        id: stamp.clone(),
        created_at: stamp,
        path,
        issue_count: issues.len(),
    }
}

pub fn restore_registry_backup(backup_id: String) -> Vec<String> {
    let Some(manifest_path) = resolve_backup_manifest_path(&backup_id) else {
        return vec![format!("[error] backup '{backup_id}' not found")];
    };

    let text = match std::fs::read_to_string(&manifest_path) {
        Ok(t) => t,
        Err(err) => return vec![format!("[error] cannot read backup manifest: {err}")],
    };

    let manifest: RegistryBackupManifest = match serde_json::from_str(&text) {
        Ok(m) => m,
        Err(err) => {
            if manifest_path
                .file_name()
                .and_then(|f| f.to_str())
                .map(|n| n.eq_ignore_ascii_case("manifest.json"))
                .unwrap_or(false)
            {
                return vec![format!("[error] invalid backup manifest: {err}")];
            }
            return vec![
                "[error] this backup was created by an older build and does not include .reg exports.".to_string(),
                "[info] create a new backup in the current version before running clean, then use restore.".to_string(),
            ];
        }
    };

    let mut log = vec![format!(
        "[info] restoring backup {} ({})",
        manifest.id, manifest.created_at
    )];

    for entry in manifest.entries {
        let Some(file) = entry.reg_file else {
            log.push(format!("[skip] {}: no export file ({})", entry.issue_id, entry.note));
            continue;
        };

        #[cfg(windows)]
        {
            match import_registry_file(std::path::Path::new(&file)) {
                Ok(_) => log.push(format!("[ok] {} restored from {}", entry.issue_id, file)),
                Err(err) => log.push(format!("[error] {}: {}", entry.issue_id, err)),
            }
        }

        #[cfg(not(windows))]
        {
            log.push(format!("[unavailable] {}: restore requires Windows", entry.issue_id));
        }
    }

    log
}

pub fn clean_registry_issues(ids: Vec<String>, backup_id: String, dry_run: bool) -> Vec<String> {
    if resolve_backup_manifest_path(&backup_id).is_none() {
        return vec![format!(
            "[error] backup '{backup_id}' not found. Create a backup before cleaning."
        )];
    }

    let issues = scan_registry_issues();
    let issue_map: std::collections::HashMap<_, _> =
        issues.iter().map(|issue| (issue.id.as_str(), issue)).collect();

    ids.into_iter()
        .map(|id| match issue_map.get(id.as_str()) {
            None => format!("[skip] {id}: issue no longer present in latest scan"),
            Some(issue) => {
                if dry_run {
                    return format!(
                        "[dry-run] {}\\{}{}: would remove after verifying backup {backup_id}",
                        issue.hive,
                        issue.key_path,
                        if issue.value_name.is_empty() {
                            String::new()
                        } else {
                            format!("\\{}", issue.value_name)
                        }
                    );
                }

                if !issue.safe {
                    return format!(
                        "[blocked] {}: marked review-only and not safe for automatic cleanup",
                        issue.id
                    );
                }

                remove_registry_issue(issue)
            }
        })
        .collect()
}

fn remove_registry_issue(issue: &RegistryIssue) -> String {
    #[cfg(windows)]
    {
        let hive = match issue.hive.as_str() {
            "HKCU" => windows::Win32::System::Registry::HKEY_CURRENT_USER,
            "HKLM" => windows::Win32::System::Registry::HKEY_LOCAL_MACHINE,
            _ => {
                return format!(
                    "[blocked] {}: unsupported hive '{}' for automatic cleanup",
                    issue.id, issue.hive
                )
            }
        };

        // Startup issue: remove specific Run value.
        if issue.category == "Invalid startup reference" {
            if issue.value_name.is_empty() {
                return format!("[skip] {}: missing value name", issue.id);
            }
            return match delete_registry_value(hive, &issue.key_path, &issue.value_name) {
                Ok(_) => format!("[ok] {}: removed startup value '{}'.", issue.id, issue.value_name),
                Err(err) => format!("[error] {}: {}", issue.id, err),
            };
        }

        // Uninstall leftovers and app paths are represented as subkeys and can be removed.
        match delete_registry_tree(hive, &issue.key_path) {
            Ok(_) => format!("[ok] {}: removed stale registry key.", issue.id),
            Err(err) => format!("[error] {}: {}", issue.id, err),
        }
    }

    #[cfg(not(windows))]
    {
        format!("[unavailable] {}: registry cleanup requires Windows", issue.id)
    }
}

// ─── Bloatware Scanner ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BloatwareItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub publisher: String,
    pub risk: String,
    pub detected: bool,
    pub selected: bool,
    pub description: String,
    pub action: String,
}

/// Scan for known removable packages by querying installed AppX packages.
pub fn scan_bloatware() -> Vec<BloatwareItem> {
    let installed_packages = query_appx_packages();
    let mut items = Vec::new();

    for spec in BLOATWARE_SPECS {
        let detected = installed_packages
            .iter()
            .any(|p| p.to_lowercase().contains(spec.match_pattern));

        items.push(BloatwareItem {
            id: spec.id.to_string(),
            name: spec.name.to_string(),
            category: spec.category.to_string(),
            publisher: spec.publisher.to_string(),
            risk: spec.risk.to_string(),
            detected,
            selected: detected && spec.risk == "low",
            description: spec.description.to_string(),
            action: spec.action.to_string(),
        });
    }

    items
}

/// Remove bloatware items (or dry-run preview).
pub fn remove_bloatware(ids: Vec<String>, dry_run: bool) -> Vec<String> {
    let items = scan_bloatware();
    let map: std::collections::HashMap<&str, &BloatwareItem> =
        items.iter().map(|i| (i.id.as_str(), i)).collect();

    ids.into_iter()
        .map(|id| {
            match map.get(id.as_str()) {
                None => format!("[error] {id}: item not found in scan results"),
                Some(item) => {
                    if !item.detected {
                        return format!("[skip] {}: not detected on this system", item.name);
                    }
                    if dry_run {
                        return format!(
                            "[dry-run] {}: would perform {} action",
                            item.name, item.action
                        );
                    }
                    match item.action.as_str() {
                        "appx" => remove_appx_package_for_id(&item.id),
                        "policy" => apply_policy_tweak(&item.id),
                        "scheduled-task" => disable_scheduled_task(&item.id),
                        _ => format!(
                            "[blocked] {}: live removal not yet implemented for action '{}'",
                            item.name, item.action
                        ),
                    }
                }
            }
        })
        .collect()
}

pub fn restore_bloatware(ids: Vec<String>, dry_run: bool) -> Vec<String> {
    ids.into_iter()
        .map(|id| {
            let Some(spec) = find_bloatware_spec(&id) else {
                return format!("[error] {id}: item not found in known specs");
            };

            if dry_run {
                return format!(
                    "[dry-run] {}: would restore {} action",
                    spec.name, spec.action
                );
            }

            match spec.action {
                "appx" => restore_appx_package_for_id(&id),
                "policy" => restore_policy_tweak(&id),
                "scheduled-task" => enable_scheduled_task(&id),
                _ => format!(
                    "[blocked] {}: restore path not implemented for action '{}'",
                    spec.name, spec.action
                ),
            }
        })
        .collect()
}

fn find_bloatware_spec(id: &str) -> Option<&'static BloatwareSpec> {
    BLOATWARE_SPECS.iter().find(|spec| spec.id == id)
}

// ─── Registry helpers ────────────────────────────────────────────────────────

#[cfg(windows)]
fn read_run_key(
    hive: windows::Win32::System::Registry::HKEY,
    subkey: &str,
) -> Vec<(String, String)> {
    use windows::Win32::Foundation::{ERROR_NO_MORE_ITEMS, ERROR_SUCCESS};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumValueW, RegOpenKeyExW,
        KEY_READ, KEY_WOW64_64KEY, REG_EXPAND_SZ, REG_SZ,
    };
    use windows::core::PCWSTR;

    let mut results = Vec::new();

    let subkey_wide: Vec<u16> = subkey
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        let open_res = RegOpenKeyExW(
            hive,
            PCWSTR(subkey_wide.as_ptr()),
            0,
            KEY_READ | KEY_WOW64_64KEY,
            &mut hkey,
        );
        if open_res != ERROR_SUCCESS {
            return results;
        }

        let mut index = 0u32;
        loop {
            let mut name_buf = [0u16; 512];
            let mut name_len = 512u32;
            let mut data_type = 0u32;
            let mut data_buf = [0u8; 2048];
            let mut data_len = 2048u32;

            let res = RegEnumValueW(
                hkey,
                index,
                windows::core::PWSTR(name_buf.as_mut_ptr()),
                &mut name_len,
                None,
                Some(&mut data_type),
                Some(data_buf.as_mut_ptr()),
                Some(&mut data_len),
            );

            if res == ERROR_NO_MORE_ITEMS {
                break;
            }
            if res == ERROR_SUCCESS {
                let name =
                    String::from_utf16_lossy(&name_buf[..name_len as usize]).to_string();
                // REG_SZ=1, REG_EXPAND_SZ=2
                if data_type == REG_SZ.0 || data_type == REG_EXPAND_SZ.0 {
                    let word_count = (data_len as usize / 2).saturating_sub(1);
                    let words = std::slice::from_raw_parts(
                        data_buf.as_ptr() as *const u16,
                        word_count,
                    );
                    let value = String::from_utf16_lossy(words).to_string();
                    results.push((name, value));
                }
            }

            index += 1;
        }

        let _ = RegCloseKey(hkey);
    }

    results
}

#[cfg(windows)]
fn read_approved_key(
    hive: windows::Win32::System::Registry::HKEY,
    subkey: &str,
) -> std::collections::HashMap<String, bool> {
    use windows::Win32::Foundation::{ERROR_NO_MORE_ITEMS, ERROR_SUCCESS};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumValueW, RegOpenKeyExW,
        KEY_READ, KEY_WOW64_64KEY, REG_BINARY,
    };
    use windows::core::PCWSTR;

    let mut map = std::collections::HashMap::new();

    let subkey_wide: Vec<u16> = subkey
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        let open_res = RegOpenKeyExW(
            hive,
            PCWSTR(subkey_wide.as_ptr()),
            0,
            KEY_READ | KEY_WOW64_64KEY,
            &mut hkey,
        );
        if open_res != ERROR_SUCCESS {
            return map;
        }

        let mut index = 0u32;
        loop {
            let mut name_buf = [0u16; 512];
            let mut name_len = 512u32;
            let mut data_type = 0u32;
            let mut data_buf = [0u8; 64];
            let mut data_len = 64u32;

            let res = RegEnumValueW(
                hkey,
                index,
                windows::core::PWSTR(name_buf.as_mut_ptr()),
                &mut name_len,
                None,
                Some(&mut data_type),
                Some(data_buf.as_mut_ptr()),
                Some(&mut data_len),
            );

            if res == ERROR_NO_MORE_ITEMS {
                break;
            }
            if res == ERROR_SUCCESS && data_type == REG_BINARY.0 && data_len >= 1 {
                let name =
                    String::from_utf16_lossy(&name_buf[..name_len as usize]).to_string();
                // byte 0: 0x02 = enabled, 0x03 = disabled
                let enabled = data_buf[0] != 0x03;
                map.insert(name, enabled);
            }

            index += 1;
        }

        let _ = RegCloseKey(hkey);
    }

    map
}

#[cfg(windows)]
fn scan_uninstall_leftovers() -> Vec<RegistryIssue> {
    use windows::Win32::System::Registry::HKEY_LOCAL_MACHINE;

    const UNINSTALL_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
    enum_subkeys(HKEY_LOCAL_MACHINE, UNINSTALL_KEY)
        .into_iter()
        .filter_map(|subkey| {
            let key_path = format!(r"{UNINSTALL_KEY}\{subkey}");
            let display_name = read_string_value(HKEY_LOCAL_MACHINE, &key_path, "DisplayName")
                .unwrap_or_else(|| subkey.clone());
            let uninstall = read_string_value(HKEY_LOCAL_MACHINE, &key_path, "UninstallString")
                .or_else(|| read_string_value(HKEY_LOCAL_MACHINE, &key_path, "DisplayIcon"))
                .unwrap_or_default();

            if uninstall.is_empty() || !looks_missing_file_reference(&uninstall) {
                return None;
            }

            Some(RegistryIssue {
                id: format!("uninstall-leftover-{}", sanitize_id(&subkey)),
                hive: "HKLM".to_string(),
                key_path,
                value_name: display_name,
                category: "Uninstall leftover".to_string(),
                severity: "medium".to_string(),
                selected: true,
                safe: true,
                description: "Installed-program metadata references files that no longer exist.".to_string(),
            })
        })
        .collect()
}

#[cfg(windows)]
fn scan_app_path_leftovers() -> Vec<RegistryIssue> {
    use windows::Win32::System::Registry::HKEY_LOCAL_MACHINE;

    const APP_PATHS: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths";
    enum_subkeys(HKEY_LOCAL_MACHINE, APP_PATHS)
        .into_iter()
        .filter_map(|subkey| {
            let key_path = format!(r"{APP_PATHS}\{subkey}");
            let path = read_string_value(HKEY_LOCAL_MACHINE, &key_path, "")
                .or_else(|| read_string_value(HKEY_LOCAL_MACHINE, &key_path, "Path"))
                .unwrap_or_default();

            if path.is_empty() || !looks_missing_file_reference(&path) {
                return None;
            }

            Some(RegistryIssue {
                id: format!("app-path-missing-{}", sanitize_id(&subkey)),
                hive: "HKLM".to_string(),
                key_path,
                value_name: subkey,
                category: "Application path".to_string(),
                severity: "medium".to_string(),
                selected: false,
                safe: false,
                description: "Application execution alias points to a missing file and should be reviewed.".to_string(),
            })
        })
        .collect()
}

#[cfg(windows)]
fn enum_subkeys(
    hive: windows::Win32::System::Registry::HKEY,
    subkey: &str,
) -> Vec<String> {
    use windows::Win32::Foundation::{ERROR_NO_MORE_ITEMS, ERROR_SUCCESS};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, KEY_READ, KEY_WOW64_64KEY,
    };
    use windows::core::{PCWSTR, PWSTR};

    let mut results = Vec::new();
    let subkey_wide: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();

    unsafe {
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        let open_res = RegOpenKeyExW(
            hive,
            PCWSTR(subkey_wide.as_ptr()),
            0,
            KEY_READ | KEY_WOW64_64KEY,
            &mut hkey,
        );
        if open_res != ERROR_SUCCESS {
            return results;
        }

        let mut index = 0u32;
        loop {
            let mut name_buf = [0u16; 512];
            let mut name_len = name_buf.len() as u32;
            let res = RegEnumKeyExW(
                hkey,
                index,
                PWSTR(name_buf.as_mut_ptr()),
                &mut name_len,
                None,
                PWSTR(std::ptr::null_mut()),
                None,
                None,
            );
            if res == ERROR_NO_MORE_ITEMS {
                break;
            }
            if res == ERROR_SUCCESS {
                results.push(String::from_utf16_lossy(&name_buf[..name_len as usize]));
            }
            index += 1;
        }

        let _ = RegCloseKey(hkey);
    }

    results
}

#[cfg(windows)]
fn read_string_value(
    hive: windows::Win32::System::Registry::HKEY,
    subkey: &str,
    value_name: &str,
) -> Option<String> {
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, KEY_READ, KEY_WOW64_64KEY,
        REG_EXPAND_SZ, REG_SZ, REG_VALUE_TYPE,
    };
    use windows::core::PCWSTR;

    let subkey_wide: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
    let value_wide: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();

    unsafe {
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        let open_res = RegOpenKeyExW(
            hive,
            PCWSTR(subkey_wide.as_ptr()),
            0,
            KEY_READ | KEY_WOW64_64KEY,
            &mut hkey,
        );
        if open_res != ERROR_SUCCESS {
            return None;
        }

        let mut data_type = REG_VALUE_TYPE::default();
        let mut data_len = 0u32;
        let query_size = RegQueryValueExW(
            hkey,
            PCWSTR(value_wide.as_ptr()),
            None,
            Some(&mut data_type),
            None,
            Some(&mut data_len),
        );
        if query_size != ERROR_SUCCESS || !(data_type == REG_SZ || data_type == REG_EXPAND_SZ) || data_len == 0 {
            let _ = RegCloseKey(hkey);
            return None;
        }

        let mut data = vec![0u8; data_len as usize];
        let query_value = RegQueryValueExW(
            hkey,
            PCWSTR(value_wide.as_ptr()),
            None,
            Some(&mut data_type),
            Some(data.as_mut_ptr()),
            Some(&mut data_len),
        );
        let _ = RegCloseKey(hkey);
        if query_value != ERROR_SUCCESS {
            return None;
        }

        let words = std::slice::from_raw_parts(data.as_ptr() as *const u16, data_len as usize / 2);
        Some(String::from_utf16_lossy(words).trim_end_matches('\0').trim().to_string())
    }
}

#[cfg(windows)]
fn delete_registry_value(
    hive: windows::Win32::System::Registry::HKEY,
    subkey: &str,
    value_name: &str,
) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, KEY_SET_VALUE, KEY_WOW64_64KEY,
    };

    let subkey_wide: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
    let value_wide: Vec<u16> = value_name.encode_utf16().chain(std::iter::once(0)).collect();

    unsafe {
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        let open = RegOpenKeyExW(
            hive,
            PCWSTR(subkey_wide.as_ptr()),
            0,
            KEY_SET_VALUE | KEY_WOW64_64KEY,
            &mut hkey,
        );
        if open != ERROR_SUCCESS {
            return Err("cannot open target key (admin may be required)".to_string());
        }

        let del = RegDeleteValueW(hkey, PCWSTR(value_wide.as_ptr()));
        let _ = RegCloseKey(hkey);
        if del == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format!("registry delete failed with Win32 code {}", del.0))
        }
    }
}

#[cfg(windows)]
fn delete_registry_tree(
    hive: windows::Win32::System::Registry::HKEY,
    subkey: &str,
) -> Result<(), String> {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::RegDeleteTreeW;

    let subkey_wide: Vec<u16> = subkey.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        let res = RegDeleteTreeW(hive, PCWSTR(subkey_wide.as_ptr()));
        if res == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format!("registry key delete failed with Win32 code {}", res.0))
        }
    }
}

// ─── AppX / PowerShell helpers ───────────────────────────────────────────────

/// Query installed AppX package names via PowerShell.
/// Returns an empty vec gracefully on failure.
fn query_appx_packages() -> Vec<String> {
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            "Get-AppxPackage | Select-Object -ExpandProperty Name",
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout)
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty())
            .collect(),
        Ok(out) => {
            log::warn!(
                "Get-AppxPackage exited non-zero: {}",
                String::from_utf8_lossy(&out.stderr)
            );
            Vec::new()
        }
        Err(e) => {
            log::warn!("PowerShell query failed: {e}");
            Vec::new()
        }
    }
}

fn remove_appx_package_for_id(id: &str) -> String {
    let Some(spec) = find_bloatware_spec(id) else {
        return format!("[error] {id}: unknown bloatware spec");
    };

    let pattern = spec.match_pattern;
    let cmd = format!(
        "Get-AppxPackage | Where-Object {{ $_.Name -like '*{}*' }} | Remove-AppxPackage",
        pattern.replace('\'', "")
    );
    let result = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &cmd])
        .output();

    match result {
        Ok(out) if out.status.success() => format!("[ok] {}: package removed", spec.name),
        Ok(out) => format!(
            "[error] {}: {}",
            spec.name,
            String::from_utf8_lossy(&out.stderr).trim()
        ),
        Err(e) => format!("[error] {}: PowerShell unavailable — {e}", spec.name),
    }
}

fn apply_policy_tweak(id: &str) -> String {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Registry::{
            RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY_CURRENT_USER, KEY_SET_VALUE,
            REG_DWORD, REG_OPTION_NON_VOLATILE,
        };

        if id == "consumer-experience" {
            let key = wide_null(r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager");
            let value = wide_null("SubscribedContent-338388Enabled");
            let data: u32 = 0;
            let bytes = data.to_le_bytes();
            unsafe {
                let mut hkey = windows::Win32::System::Registry::HKEY::default();
                let res = RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(key.as_ptr()),
                    0,
                    None,
                    REG_OPTION_NON_VOLATILE,
                    KEY_SET_VALUE,
                    None,
                    &mut hkey,
                    None,
                );
                if res != ERROR_SUCCESS {
                    return "[error] consumer-experience: unable to open policy key".to_string();
                }

                let set_res = RegSetValueExW(
                    hkey,
                    PCWSTR(value.as_ptr()),
                    0,
                    REG_DWORD,
                    Some(&bytes),
                );
                let _ = RegCloseKey(hkey);
                if set_res == ERROR_SUCCESS {
                    return "[ok] consumer-experience: disabled recommendation content policy".to_string();
                }
                return "[error] consumer-experience: failed to write policy value".to_string();
            }
        }
    }

    format!("[blocked] {id}: no live policy implementation for this id")
}

fn disable_scheduled_task(id: &str) -> String {
    let task_name = match id {
        "xbox-game-bar-extras" => Some(r"\Microsoft\XblGameSave\XblGameSaveTask"),
        _ => None,
    };

    let Some(task_name) = task_name else {
        return format!("[blocked] {id}: no mapped scheduled task");
    };

    let result = std::process::Command::new("schtasks")
        .args(["/Change", "/TN", task_name, "/Disable"])
        .output();

    match result {
        Ok(out) if out.status.success() => format!("[ok] {id}: scheduled task disabled"),
        Ok(out) => format!(
            "[error] {id}: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ),
        Err(e) => format!("[error] {id}: failed to run schtasks — {e}"),
    }
}

fn restore_policy_tweak(id: &str) -> String {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::ERROR_SUCCESS;
        use windows::Win32::System::Registry::{
            RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY_CURRENT_USER, KEY_SET_VALUE,
            REG_DWORD, REG_OPTION_NON_VOLATILE,
        };

        if id == "consumer-experience" {
            let key = wide_null(r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager");
            let value = wide_null("SubscribedContent-338388Enabled");
            let data: u32 = 1;
            let bytes = data.to_le_bytes();
            unsafe {
                let mut hkey = windows::Win32::System::Registry::HKEY::default();
                let res = RegCreateKeyExW(
                    HKEY_CURRENT_USER,
                    PCWSTR(key.as_ptr()),
                    0,
                    None,
                    REG_OPTION_NON_VOLATILE,
                    KEY_SET_VALUE,
                    None,
                    &mut hkey,
                    None,
                );
                if res != ERROR_SUCCESS {
                    return "[error] consumer-experience: unable to open policy key".to_string();
                }

                let set_res = RegSetValueExW(
                    hkey,
                    PCWSTR(value.as_ptr()),
                    0,
                    REG_DWORD,
                    Some(&bytes),
                );
                let _ = RegCloseKey(hkey);
                if set_res == ERROR_SUCCESS {
                    return "[ok] consumer-experience: recommendation content policy restored".to_string();
                }
                return "[error] consumer-experience: failed to write policy value".to_string();
            }
        }
    }

    format!("[blocked] {id}: no policy restore implementation for this id")
}

fn enable_scheduled_task(id: &str) -> String {
    let task_name = match id {
        "xbox-game-bar-extras" => Some(r"\Microsoft\XblGameSave\XblGameSaveTask"),
        _ => None,
    };

    let Some(task_name) = task_name else {
        return format!("[blocked] {id}: no mapped scheduled task restore path");
    };

    let result = std::process::Command::new("schtasks")
        .args(["/Change", "/TN", task_name, "/Enable"])
        .output();

    match result {
        Ok(out) if out.status.success() => format!("[ok] {id}: scheduled task enabled"),
        Ok(out) => format!(
            "[error] {id}: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ),
        Err(e) => format!("[error] {id}: failed to run schtasks — {e}"),
    }
}

fn restore_appx_package_for_id(id: &str) -> String {
    let Some(spec) = find_bloatware_spec(id) else {
        return format!("[error] {id}: unknown bloatware spec");
    };

    // Best-effort restore: re-register matching package manifests from WindowsApps.
    let script = format!(
        r#"$paths = Get-ChildItem 'C:\Program Files\WindowsApps' -Directory -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -like '*{pattern}*' }};
if (-not $paths) {{ throw 'No matching WindowsApps package manifests found'; }}
$ok = 0;
foreach ($p in $paths) {{
  $m = Join-Path $p.FullName 'AppxManifest.xml';
  if (Test-Path $m) {{
    try {{ Add-AppxPackage -Register $m -DisableDevelopmentMode -ErrorAction Stop; $ok++ }} catch {{ }}
  }}
}}
if ($ok -eq 0) {{ throw 'Package manifests found but registration failed' }}
"#,
        pattern = spec.match_pattern.replace('"', "")
    );

    let result = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .output();

    match result {
        Ok(out) if out.status.success() => format!("[ok] {}: restore attempt completed", spec.name),
        Ok(out) => format!(
            "[error] {}: {}",
            spec.name,
            String::from_utf8_lossy(&out.stderr).trim()
        ),
        Err(e) => format!("[error] {}: PowerShell unavailable — {e}", spec.name),
    }
}

// ─── Classification helpers ──────────────────────────────────────────────────

fn estimate_impact(command: &str) -> String {
    let c = command.to_lowercase();
    if c.contains("update") || c.contains("agent") || c.contains("launcher") {
        "high".to_string()
    } else if c.contains("tray") || c.contains("notify") || c.contains("helper") {
        "medium".to_string()
    } else {
        "low".to_string()
    }
}

fn recommend(name: &str, command: &str, enabled: bool) -> String {
    let n = name.to_lowercase();
    let c = command.to_lowercase();
    if n.contains("nvidia") || n.contains("amd") || n.contains("intel")
        || c.contains("nvcplui") || c.contains("nvdisplay")
    {
        return "keep".to_string();
    }
    if n.contains("steam") || n.contains("discord") || n.contains("epic")
        || n.contains("origin") || n.contains("battle.net")
    {
        return "optional".to_string();
    }
    if n.contains("updater") || n.contains("survey") || n.contains("trial") {
        return "review".to_string();
    }
    if !enabled {
        "optional".to_string()
    } else {
        "optional".to_string()
    }
}

fn extract_publisher(command: &str) -> String {
    let c = command.to_lowercase();
    if c.contains("nvidia") { return "NVIDIA".to_string(); }
    if c.contains("amd") { return "AMD".to_string(); }
    if c.contains("intel") { return "Intel".to_string(); }
    if c.contains("steam") { return "Valve".to_string(); }
    if c.contains("discord") { return "Discord Inc.".to_string(); }
    if c.contains("epic") { return "Epic Games".to_string(); }
    if c.contains("microsoft") || c.contains("onedrive") { return "Microsoft".to_string(); }
    "Unknown".to_string()
}

fn looks_missing_file_reference(command: &str) -> bool {
    let path = extract_executable_path(command);
    if path.is_empty() {
        return false;
    }
    let expanded = expand_simple_env(&path);
    let candidate = std::path::Path::new(&expanded);
    candidate.is_absolute() && !candidate.exists()
}

fn extract_executable_path(command: &str) -> String {
    let trimmed = command.trim();
    if trimmed.starts_with('"') {
        return trimmed
            .trim_start_matches('"')
            .split('"')
            .next()
            .unwrap_or_default()
            .to_string();
    }

    trimmed
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_string()
}

fn expand_simple_env(path: &str) -> String {
    let mut expanded = path.to_string();
    for key in ["ProgramFiles", "ProgramFiles(x86)", "SystemRoot", "WinDir", "LocalAppData", "AppData"] {
        if let Ok(value) = std::env::var(key) {
            expanded = expanded.replace(&format!("%{key}%"), &value);
        }
    }
    expanded
}

fn registry_stamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("registry-backup-{now}")
}

fn registry_backup_dir() -> std::path::PathBuf {
    std::env::var("USERPROFILE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("Documents")
        .join("Radium PCs Companion")
        .join("registry-backups")
}

fn resolve_backup_manifest_path(backup_id: &str) -> Option<std::path::PathBuf> {
    let base = registry_backup_dir();
    let new_manifest = base.join(backup_id).join("manifest.json");
    if new_manifest.exists() {
        return Some(new_manifest);
    }

    // Legacy fallback from older JSON-only backups.
    let legacy = base.join(format!("{backup_id}.json"));
    if legacy.exists() {
        return Some(legacy);
    }

    None
}

#[cfg(windows)]
fn export_registry_key(full_key: &str, output_path: &std::path::Path) -> Result<(), String> {
    let out = std::process::Command::new("reg")
        .args([
            "export",
            full_key,
            &output_path.to_string_lossy(),
            "/y",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(windows)]
fn import_registry_file(path: &std::path::Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("backup file missing: {}", path.to_string_lossy()));
    }

    let out = std::process::Command::new("reg")
        .args(["import", &path.to_string_lossy()])
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn sanitize_id(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' })
        .collect::<String>()
        .to_lowercase()
}

// ─── Known bloatware specs ───────────────────────────────────────────────────

fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

struct BloatwareSpec {
    id: &'static str,
    name: &'static str,
    match_pattern: &'static str,
    category: &'static str,
    publisher: &'static str,
    risk: &'static str,
    description: &'static str,
    action: &'static str,
}

const BLOATWARE_SPECS: &[BloatwareSpec] = &[
    BloatwareSpec {
        id: "xbox-game-bar-extras",
        name: "Xbox social and capture extras",
        match_pattern: "xboxgameoverlay",
        category: "Gaming focused",
        publisher: "Microsoft",
        risk: "low",
        description: "Optional Xbox companion packages. Safe to remove when Xbox capture and social overlays are unused.",
        action: "appx",
    },
    BloatwareSpec {
        id: "xbox-identity-provider",
        name: "Xbox identity provider",
        match_pattern: "xboxidentityprovider",
        category: "Gaming focused",
        publisher: "Microsoft",
        risk: "low",
        description: "Xbox sign-in helper. Not required if you do not use Xbox services.",
        action: "appx",
    },
    BloatwareSpec {
        id: "bing-weather",
        name: "Microsoft Bing Weather",
        match_pattern: "bingweather",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Bundled weather widget. Safe to remove.",
        action: "appx",
    },
    BloatwareSpec {
        id: "bing-news",
        name: "Microsoft Bing News",
        match_pattern: "bingnews",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Bundled news feed app. Safe to remove.",
        action: "appx",
    },
    BloatwareSpec {
        id: "microsoft-solitaire",
        name: "Microsoft Solitaire Collection",
        match_pattern: "microsoftsolitaire",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Pre-installed game suite. Safe to remove on gaming PCs.",
        action: "appx",
    },
    BloatwareSpec {
        id: "cortana-remnants",
        name: "Cortana",
        match_pattern: "cortana",
        category: "Advanced",
        publisher: "Microsoft",
        risk: "medium",
        description: "Legacy assistant. Removable on Windows 11 systems that do not use voice assistant features.",
        action: "appx",
    },
    BloatwareSpec {
        id: "consumer-experience",
        name: "Consumer experience suggestions",
        match_pattern: "contentdeliverymanager",
        category: "Safe",
        publisher: "Windows policy",
        risk: "low",
        description: "Controls app suggestions and promoted content via Windows policy keys.",
        action: "policy",
    },
    BloatwareSpec {
        id: "mixed-reality-portal",
        name: "Mixed Reality Portal",
        match_pattern: "mixedrealityportal",
        category: "Advanced",
        publisher: "Microsoft",
        risk: "medium",
        description: "VR/AR portal not needed on non-headset gaming systems.",
        action: "appx",
    },
    BloatwareSpec {
        id: "feedback-hub",
        name: "Feedback Hub",
        match_pattern: "windowsfeedbackhub",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Microsoft feedback collection app. Safe to remove on production systems.",
        action: "appx",
    },
    BloatwareSpec {
        id: "maps",
        name: "Windows Maps",
        match_pattern: "windowsmaps",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Rarely used on desktop systems.",
        action: "appx",
    },
    // ── Additional Microsoft inbox apps ─────────────────────────────────────
    BloatwareSpec {
        id: "ms-teams-consumer",
        name: "Microsoft Teams (consumer)",
        match_pattern: "msteams",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Consumer Teams bundled with Windows 11. Separate from enterprise Teams; safe to remove on gaming or productivity builds.",
        action: "appx",
    },
    BloatwareSpec {
        id: "get-help",
        name: "Get Help",
        match_pattern: "microsoftgethelp",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "In-box support app. Safe to remove when self-support is preferred.",
        action: "appx",
    },
    BloatwareSpec {
        id: "tips",
        name: "Microsoft Tips",
        match_pattern: "windowstips",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Onboarding tips app. Not useful after initial setup.",
        action: "appx",
    },
    BloatwareSpec {
        id: "your-phone",
        name: "Phone Link (Your Phone)",
        match_pattern: "yourphone",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Phone-companion app. Safe to remove if you do not link an Android device.",
        action: "appx",
    },
    BloatwareSpec {
        id: "onenote-uwp",
        name: "OneNote (UWP / Windows Store)",
        match_pattern: "microsoftonedrive.onenote",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Store version of OneNote. The desktop Win32 version (installed separately) is preferred on gaming rigs.",
        action: "appx",
    },
    BloatwareSpec {
        id: "microsoft-todo",
        name: "Microsoft To Do",
        match_pattern: "microsofttodo",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Task-list app. Safe to remove when not in use.",
        action: "appx",
    },
    BloatwareSpec {
        id: "people",
        name: "People",
        match_pattern: "people",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Contact manager. Rarely used on gaming or enthusiast builds.",
        action: "appx",
    },
    BloatwareSpec {
        id: "3d-viewer",
        name: "3D Viewer",
        match_pattern: "microsoft3dviewer",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "3D model preview app. Not relevant on most gaming builds.",
        action: "appx",
    },
    BloatwareSpec {
        id: "clipchamp",
        name: "Clipchamp",
        match_pattern: "clipchamp",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Web-based video editor bundled with Windows 11. Safe to remove when not used.",
        action: "appx",
    },
    BloatwareSpec {
        id: "family-safety",
        name: "Microsoft Family Safety",
        match_pattern: "familysafety",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Parental controls companion app. Not needed on single-user gaming systems.",
        action: "appx",
    },
    BloatwareSpec {
        id: "quick-assist",
        name: "Quick Assist",
        match_pattern: "quickassist",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Remote desktop/support app. Can be removed on systems that do not need remote assistance.",
        action: "appx",
    },
    BloatwareSpec {
        id: "mail-calendar-uwp",
        name: "Mail and Calendar (UWP)",
        match_pattern: "windowscommunicationsapps",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Legacy Mail and Calendar UWP apps — replaced by Outlook on Windows 11. Safe to remove.",
        action: "appx",
    },
    BloatwareSpec {
        id: "alarms-clock",
        name: "Alarms & Clock",
        match_pattern: "windowsalarms",
        category: "Safe",
        publisher: "Microsoft",
        risk: "low",
        description: "Alarm and clock app. Not needed on desktop systems.",
        action: "appx",
    },
    // ── Third-party preloads ─────────────────────────────────────────────────
    BloatwareSpec {
        id: "spotify-preload",
        name: "Spotify (preloaded)",
        match_pattern: "spotify",
        category: "Third-party",
        publisher: "Spotify AB",
        risk: "low",
        description: "Sometimes pre-installed by OEMs or bundled with Windows promotions. Safe to remove; reinstall from spotify.com if needed.",
        action: "appx",
    },
    BloatwareSpec {
        id: "tiktok",
        name: "TikTok",
        match_pattern: "tiktok",
        category: "Third-party",
        publisher: "ByteDance",
        risk: "low",
        description: "Social video app. Pre-installed on some OEM or Windows builds. Safe to remove.",
        action: "appx",
    },
    BloatwareSpec {
        id: "candy-crush-saga",
        name: "Candy Crush Saga",
        match_pattern: "candycrush",
        category: "Safe",
        publisher: "King",
        risk: "low",
        description: "Microsoft-promoted game. Safe to remove.",
        action: "appx",
    },
    BloatwareSpec {
        id: "candy-crush-soda",
        name: "Candy Crush Soda Saga",
        match_pattern: "candycrushsodasaga",
        category: "Safe",
        publisher: "King",
        risk: "low",
        description: "Microsoft-promoted game. Safe to remove.",
        action: "appx",
    },
    BloatwareSpec {
        id: "netflix",
        name: "Netflix",
        match_pattern: "netflix",
        category: "Third-party",
        publisher: "Netflix",
        risk: "low",
        description: "Streaming service app sometimes pre-installed by OEMs. Safe to remove; use the browser or dedicated installer.",
        action: "appx",
    },
];

// ─── Timer resolution ────────────────────────────────────────────────────────

/// Set the Windows multimedia timer resolution based on the active performance
/// profile.
///
/// Windows defaults to ~15.6 ms (156 001 × 100 ns units).  Gaming and Creator
/// profiles lower this to 0.5 ms (5 000 units) to reduce CPU scheduling
/// latency.  Quiet / Power-Saver releases the override and lets Windows choose
/// the most efficient interval.
///
/// Returns a human-readable status message for display in the UI.
pub fn set_timer_resolution(profile_id: &str) -> String {
    #[cfg(windows)]
    {
        // NtSetTimerResolution is an ntdll export that is not part of the
        // official Win32 surface but is universally available on Windows XP+.
        // Units are 100-nanosecond intervals (same as FILETIME).
        //
        // Signature:
        //   NTSTATUS NtSetTimerResolution(
        //       ULONG DesiredResolution,   // requested period in 100-ns units
        //       BOOLEAN SetResolution,     // TRUE = set, FALSE = release
        //       PULONG CurrentResolution   // receives the new period
        //   );
        #[link(name = "ntdll")]
        extern "system" {
            fn NtSetTimerResolution(
                desired: u32,
                set: u8,   // BOOLEAN (1 byte on Windows)
                current: *mut u32,
            ) -> i32; // NTSTATUS
        }

        const UNIT: &str = "100 ns";
        let (desired, set, label): (u32, u8, &str) = match profile_id {
            "gaming" | "creator" => (5_000,  1, "0.5 ms (gaming)"),
            "balanced"           => (10_000, 1, "1.0 ms (balanced)"),
            "quiet"              => (0,      0, "system default"),
            _                    => (10_000, 1, "1.0 ms (fallback)"),
        };

        let mut current: u32 = 0;
        let status = unsafe { NtSetTimerResolution(desired, set, &mut current) };

        if status == 0 {
            let actual_ms = current as f32 / 10_000.0;
            format!(
                "Timer resolution → {label} (actual {:.2} ms, status {UNIT} OK)",
                actual_ms
            )
        } else {
            format!("Timer resolution → {label} (NtSetTimerResolution status 0x{status:08X})")
        }
    }

    #[cfg(not(windows))]
    {
        let _ = profile_id;
        "Timer resolution: no-op on non-Windows".to_string()
    }
}

/// Apply additional power-mode tuning on top of plan selection.
///
/// Uses supported `powercfg` processor subgroup settings so this remains
/// reversible and firmware-safe.
pub fn apply_power_mode_tweaks(profile_id: &str) -> String {
    #[cfg(windows)]
    {
        // powercfg aliases
        const SUB_PROCESSOR: &str = "SUB_PROCESSOR";
        const PROC_MIN: &str = "PROCTHROTTLEMIN";
        const PROC_MAX: &str = "PROCTHROTTLEMAX";
        const BOOST_MODE: &str = "PERFBOOSTMODE";

        let (min_pct, max_pct, boost): (&str, &str, &str) = match profile_id {
            "gaming" => ("100", "100", "2"),  // aggressive boost
            "creator" => ("10", "100", "1"),  // enabled boost, less idle burn
            "balanced" => ("5", "100", "1"),
            "quiet" => ("5", "70", "0"),      // disable boost
            _ => ("5", "100", "1"),
        };

        let mut failures = Vec::new();
        let cmds = [
            ["/setacvalueindex", "SCHEME_CURRENT", SUB_PROCESSOR, PROC_MIN, min_pct],
            ["/setacvalueindex", "SCHEME_CURRENT", SUB_PROCESSOR, PROC_MAX, max_pct],
            ["/setacvalueindex", "SCHEME_CURRENT", SUB_PROCESSOR, BOOST_MODE, boost],
            ["/setdcvalueindex", "SCHEME_CURRENT", SUB_PROCESSOR, PROC_MIN, min_pct],
            ["/setdcvalueindex", "SCHEME_CURRENT", SUB_PROCESSOR, PROC_MAX, max_pct],
            ["/setdcvalueindex", "SCHEME_CURRENT", SUB_PROCESSOR, BOOST_MODE, boost],
        ];

        for args in cmds {
            if let Err(err) = run_powercfg_cmd(&args) {
                failures.push(err);
            }
        }

        if let Err(err) = run_powercfg_cmd(&["/setactive", "SCHEME_CURRENT"]) {
            failures.push(err);
        }

        if failures.is_empty() {
            return format!(
                "Power tuning → min {min_pct}%, max {max_pct}%, boost mode {boost} (AC/DC)"
            );
        }

        return format!(
            "Power tuning partially applied ({} warnings): {}",
            failures.len(),
            failures.join(" | ")
        );
    }

    #[cfg(not(windows))]
    {
        let _ = profile_id;
        "Power tuning: no-op on non-Windows".to_string()
    }
}

#[cfg(windows)]
fn run_powercfg_cmd(args: &[&str]) -> Result<(), String> {
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
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        if stderr.is_empty() {
            Err("powercfg returned non-zero status".to_string())
        } else {
            Err(stderr)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{clean_registry_issues, restore_registry_backup, sanitize_id};

    #[test]
    fn sanitize_id_normalizes_text() {
        assert_eq!(sanitize_id("Hello World.exe"), "hello_world_exe");
        assert_eq!(sanitize_id("GPU-Boost#1"), "gpu-boost_1");
    }

    #[test]
    fn clean_registry_requires_backup() {
        let log = clean_registry_issues(
            vec!["startup-missing-helper".to_string()],
            "definitely-missing-backup".to_string(),
            false,
        );
        assert_eq!(log.len(), 1);
        assert!(log[0].contains("backup 'definitely-missing-backup' not found"));
    }

    #[test]
    fn restore_registry_missing_backup_is_error() {
        let log = restore_registry_backup("missing-backup-id".to_string());
        assert_eq!(log.len(), 1);
        assert!(log[0].contains("backup 'missing-backup-id' not found"));
    }
}
