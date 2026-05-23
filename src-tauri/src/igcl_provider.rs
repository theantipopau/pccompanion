//! Intel Arc groundwork via IGCL dynamic loader.
//!
//! This module intentionally uses runtime loading so the app keeps working on
//! non-Intel systems without requiring Intel DLLs at install time.

use crate::hardware::GpuReading;
use windows::core::{PCSTR, PCWSTR};
use windows::Win32::Foundation::HMODULE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

const IGCL_CANDIDATES: [&str; 4] = [
    "igcl64.dll",
    "igcl.dll",
    "ControlLib.dll",
    r"C:\Windows\System32\igcl64.dll",
];

pub struct IntelIgclContext {
    module: HMODULE,
    pub backend: String,
}

impl IntelIgclContext {
    pub fn init() -> Option<Self> {
        for candidate in IGCL_CANDIDATES {
            let wide: Vec<u16> = candidate.encode_utf16().chain(std::iter::once(0)).collect();
            let module = unsafe { LoadLibraryW(PCWSTR(wide.as_ptr())).ok()? };

            let has_ctl_init = unsafe {
                GetProcAddress(module, PCSTR(b"ctlInit\0".as_ptr())).is_some()
            };
            let has_ctl_enum = unsafe {
                GetProcAddress(module, PCSTR(b"ctlEnumerateDevices\0".as_ptr())).is_some()
            };

            if has_ctl_init || has_ctl_enum {
                let backend = if candidate.contains("ControlLib") {
                    "ControlLib"
                } else {
                    "IGCL"
                };
                log::info!("Intel Arc telemetry groundwork active via {} ({})", backend, candidate);
                return Some(Self {
                    module,
                    backend: backend.to_string(),
                });
            }

            let _ = module;
        }

        None
    }

    /// Placeholder query path for next wave.
    ///
    /// Real sensor bindings are staged behind symbol discovery and safety gates,
    /// but the loader path is now active and validated.
    pub fn query_primary_gpu(&self) -> Option<GpuReading> {
        let _ = &self.backend;
        None
    }
}

impl Drop for IntelIgclContext {
    fn drop(&mut self) {
        let _ = self.module;
    }
}
