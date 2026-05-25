//! Driver update checks for NVIDIA, AMD Radeon, and Intel Arc GPUs.
//!
//! * NVIDIA — uses the GeForce WHQL lookup JSON API.
//! * AMD    — parses the latest Adrenalin version from AMD's release-notes index.
//!            Requires the installed version to be in Adrenalin format ("24.12.1"),
//!            which is set by the AMD ADL2 `ADL2_Graphics_Versions_Get` path in
//!            `amd_provider.rs`.  Falls back gracefully to None when ADL2 is absent.
//! * Intel Arc — parses the latest driver version from Intel's Arc download page.
//!              Compares against the WMI-format version ("31.0.101.XXXX").
//!
//! All HTTP calls are blocking (via ureq). Always call from `spawn_blocking`.

use crate::hardware::DriverUpdateInfo;

/// NVIDIA GeForce Game Ready Driver lookup endpoint.
/// psid=120 = GeForce RTX 30 Series desktop (shares driver stream with RTX 40+).
/// osID=57  = Windows 10/11 64-bit, languageCode=1033 = English, isWHQL=1.
const NVIDIA_DRIVER_API: &str =
    "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/\
     AjaxDriverService.php?func=DriverManualLookup&psid=120&pfid=978&osID=57\
     &languageCode=1033&beta=0&isWHQL=1&dltype=-1&dch=1&upCRD=0&qnf=0\
     &sort1=0&numberOfResults=1";

const NVIDIA_DOWNLOAD_FALLBACK: &str = "https://www.nvidia.com/Download/index.aspx";

/// AMD Radeon Software release-notes index.  Release note filenames encode the
/// Adrenalin version: "RN-RAD-WIN-24-12-1" → "24.12.1".
const AMD_RELEASE_NOTES_URL: &str =
    "https://www.amd.com/en/resources/support-articles/release-notes.html";
const AMD_DOWNLOAD_URL: &str = "https://www.amd.com/en/support/download/drivers.html";

/// Intel Arc & Iris Xe graphics driver download page.
const INTEL_ARC_DRIVER_URL: &str =
    "https://www.intel.com/content/www/us/en/download/785597/\
     intel-arc-iris-xe-graphics-windows.html";

/// Check for a newer NVIDIA driver.  Returns `None` when the GPU is not NVIDIA,
/// the version string is empty, or the network/API call fails.
pub fn check_nvidia_driver_update(current_version: &str) -> Option<DriverUpdateInfo> {
    if current_version.is_empty() {
        return None;
    }

    let body: serde_json::Value = ureq::get(NVIDIA_DRIVER_API)
        .timeout(std::time::Duration::from_secs(8))
        .call()
        .ok()?
        .into_json()
        .ok()?;

    if body["Success"].as_i64() != Some(1) {
        return None;
    }

    let latest = body["IDS"][0]["downloadInfo"]["Version"]
        .as_str()?
        .trim()
        .to_string();

    if latest.is_empty() {
        return None;
    }

    let download_url = body["IDS"][0]["downloadInfo"]["DownloadURL"]
        .as_str()
        .map(|u| u.to_string())
        .unwrap_or_else(|| NVIDIA_DOWNLOAD_FALLBACK.to_string());

    let update_available = version_is_newer(&latest, current_version);

    Some(DriverUpdateInfo {
        current_version: current_version.to_string(),
        latest_version: latest,
        update_available,
        download_url,
    })
}

/// Check for a newer AMD Radeon Software (Adrenalin) update.
///
/// `current_version` must be in Adrenalin format (e.g. "24.12.1") as returned by
/// `ADL2_Graphics_Versions_Get` via `amd_provider::query_driver_version()`.  When
/// ADL2 is unavailable the WMI fallback version ("32.0.11033.1003") cannot be
/// compared against the Adrenalin version string, so the function returns `None`.
pub fn check_amd_driver_update(current_version: &str) -> Option<DriverUpdateInfo> {
    if current_version.is_empty() {
        return None;
    }
    // Heuristic: Adrenalin versions have exactly 3 dot-separated parts.
    // Windows-internal versions have 4 parts; skip the comparison for those.
    if current_version.split('.').count() != 3 {
        return None;
    }

    let body = ureq::get(AMD_RELEASE_NOTES_URL)
        .timeout(std::time::Duration::from_secs(10))
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .call()
        .ok()?
        .into_string()
        .ok()?;

    // AMD release note URLs are like "/RN-RAD-WIN-24-12-1.html".
    // The first match in the page is the most recent release.
    let marker = "RN-RAD-WIN-";
    let pos = body.find(marker)?;
    let rest = &body[pos + marker.len()..];
    let end = rest
        .find(|c: char| c != '-' && !c.is_ascii_digit())
        .unwrap_or(rest.len().min(20));
    let slug = &rest[..end]; // e.g. "24-12-1"
    let parts: Vec<&str> = slug.split('-').collect();
    if parts.len() < 3 {
        return None;
    }
    let latest = format!("{}.{}.{}", parts[0], parts[1], parts[2]);

    Some(DriverUpdateInfo {
        update_available: version_is_newer(&latest, current_version),
        current_version: current_version.to_string(),
        latest_version: latest,
        download_url: AMD_DOWNLOAD_URL.to_string(),
    })
}

/// Check for a newer Intel Arc / Iris Xe graphics driver.
///
/// `current_version` is the WMI-format string (e.g. "31.0.101.5234").  The
/// Intel download page is scraped for the latest driver version in the same
/// 4-part format.  Returns `None` on any parse or network failure.
pub fn check_intel_arc_driver_update(current_version: &str) -> Option<DriverUpdateInfo> {
    if current_version.is_empty() {
        return None;
    }

    let body = ureq::get(INTEL_ARC_DRIVER_URL)
        .timeout(std::time::Duration::from_secs(10))
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .call()
        .ok()?
        .into_string()
        .ok()?;

    // Intel Arc driver versions appear as "31.0.101.XXXX" in the page.
    // Search forward through all occurrences to find a valid 4-part version.
    let prefix = "31.0.";
    let mut search = body.as_str();
    let mut latest: Option<String> = None;
    while let Some(pos) = search.find(prefix) {
        let rest = &search[pos..];
        let end = rest
            .find(|c: char| c != '.' && !c.is_ascii_digit())
            .unwrap_or(rest.len().min(25));
        let candidate = &rest[..end];
        if candidate.split('.').count() == 4
            && candidate.split('.').all(|p| p.parse::<u32>().is_ok())
        {
            latest = Some(candidate.to_string());
            break;
        }
        search = &search[pos + prefix.len()..];
    }

    let latest = latest?;
    Some(DriverUpdateInfo {
        update_available: version_is_newer(&latest, current_version),
        current_version: current_version.to_string(),
        latest_version: latest,
        download_url: INTEL_ARC_DRIVER_URL.to_string(),
    })
}

/// Returns `true` when `latest` is a higher version than `current`.
/// Handles NVIDIA's "560.94" / "572.70" format (major.minor parts as u32).
fn version_is_newer(latest: &str, current: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.').filter_map(|p| p.parse::<u32>().ok()).collect()
    };
    let l = parse(latest);
    let c = parse(current);
    for (a, b) in l.iter().zip(c.iter()) {
        if a != b {
            return a > b;
        }
    }
    l.len() > c.len()
}
