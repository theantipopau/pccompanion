//! NVIDIA GPU monitoring via NVML (NVIDIA Management Library).
//!
//! `nvml.dll` ships with NVIDIA drivers and is always present on NVIDIA
//! systems.  We load it dynamically at runtime, so the app runs without error
//! on machines without an NVIDIA GPU.
//!
//! Architecture inspired by LibreHardwareMonitor's NvidiaGpu.cs, reimplemented
//! in Rust using direct Win32 FFI — no C# code copied.

#![allow(dead_code)]

use crate::hardware::GpuReading;
use windows::core::{PCSTR, PCWSTR};
use windows::Win32::Foundation::HMODULE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

// FreeLibrary is declared directly from kernel32 — the windows 0.58 crate
// does not re-export it under the enabled feature set.
#[link(name = "kernel32")]
extern "system" {
    fn FreeLibrary(hLibModule: HMODULE) -> i32;
}

// ─── NVML constants ──────────────────────────────────────────────────────────

const NVML_SUCCESS: i32 = 0;
const NVML_TEMPERATURE_GPU: u32 = 0; // GPU core die temperature
const NVML_CLOCK_GRAPHICS: u32 = 0;  // Core (shader) clock
const NVML_CLOCK_MEM: u32 = 2;       // Memory clock
const NVML_DEVICE_NAME_BUFFER_SIZE: u32 = 96;

// ─── C-compatible structs (must match nvml.h exactly) ────────────────────────

/// Matches `nvmlUtilization_st` in nvml.h.
#[repr(C)]
struct NvmlUtilization {
    gpu: u32,    // GPU core utilization 0–100 %
    memory: u32, // Memory bus utilization 0–100 %
}

/// Matches `nvmlMemory_st` (v1) in nvml.h.
#[repr(C)]
struct NvmlMemory {
    total: u64, // Total installed FB memory (bytes)
    free: u64,  // Unallocated FB memory (bytes)
    used: u64,  // Allocated FB memory (bytes)
}

/// `nvmlDevice_t` is an opaque pointer. `usize` is pointer-sized on all
/// supported platforms.
type NvmlDevice = usize;

// ─── Function pointer types (on x64 Windows "system" == "C" == Win64 ABI) ────

type FnInit     = unsafe extern "system" fn() -> i32;
type FnShutdown = unsafe extern "system" fn() -> i32;
type FnGetCount = unsafe extern "system" fn(count: *mut u32) -> i32;
type FnGetHandle = unsafe extern "system" fn(index: u32, device: *mut NvmlDevice) -> i32;
type FnGetName  = unsafe extern "system" fn(device: NvmlDevice, name: *mut u8, len: u32) -> i32;
type FnGetTemp  = unsafe extern "system" fn(device: NvmlDevice, sensor: u32, temp: *mut u32) -> i32;
type FnGetUtil  = unsafe extern "system" fn(device: NvmlDevice, util: *mut NvmlUtilization) -> i32;
type FnGetMem   = unsafe extern "system" fn(device: NvmlDevice, mem: *mut NvmlMemory) -> i32;
type FnGetClock = unsafe extern "system" fn(device: NvmlDevice, clock_type: u32, clock: *mut u32) -> i32;
type FnGetFan   = unsafe extern "system" fn(device: NvmlDevice, speed: *mut u32) -> i32;
type FnGetPower = unsafe extern "system" fn(device: NvmlDevice, power_mw: *mut u32) -> i32;
/// System-level driver version query (not per-device).
type FnGetDriverVersion = unsafe extern "system" fn(version: *mut u8, length: u32) -> i32;

// ─── NvmlContext ──────────────────────────────────────────────────────────────

/// Active NVML session.  Created once on the monitoring thread; freed when
/// dropped.  Not `Send` (holds `HMODULE`) — only use within a single thread.
pub struct NvmlContext {
    lib: HMODULE,
    devices: Vec<NvmlDevice>,
    fn_shutdown:  FnShutdown,
    fn_get_name:  FnGetName,
    fn_get_temp:  FnGetTemp,
    fn_get_util:  FnGetUtil,
    fn_get_mem:   FnGetMem,
    fn_get_clock: FnGetClock,
    fn_get_fan:   FnGetFan,
    fn_get_power: FnGetPower,
    fn_get_driver_ver: Option<FnGetDriverVersion>,
}

impl NvmlContext {
    /// Try to load `nvml.dll` and initialise NVML. Returns `None` when no
    /// NVIDIA drivers are present or NVML init fails.
    pub fn init() -> Option<Self> {
        // Search standard NVML installation locations.
        let lib = [
            "nvml.dll",
            r"C:\Windows\System32\nvml.dll",
            r"C:\Program Files\NVIDIA Corporation\NVSMI\nvml.dll",
        ]
        .iter()
        .find_map(|path| unsafe {
            let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
            LoadLibraryW(PCWSTR(wide.as_ptr())).ok()
        })?;

        // Resolve a symbol by name; frees the library and returns None on failure.
        // GetProcAddress returns `Option<unsafe extern "system" fn()>`.
        // We transmute to the specific extern "C" type — safe on x64 Windows
        // because the two calling conventions are identical (unified x64 ABI).
        macro_rules! sym {
            ($name:literal, $ty:ty) => {{
                let raw = unsafe {
                    GetProcAddress(lib, PCSTR(concat!($name, "\0").as_bytes().as_ptr()))
                };
                match raw {
                    None => {
                        unsafe { let _ = FreeLibrary(lib); }
                        return None;
                    }
                    Some(f) => unsafe {
                        std::mem::transmute::<unsafe extern "system" fn() -> isize, $ty>(f)
                    },
                }
            }};
        }
        // Optional symbol: does not fail init if not found.
        macro_rules! sym_opt {
            ($name:literal, $ty:ty) => {{
                let raw = unsafe {
                    GetProcAddress(lib, PCSTR(concat!($name, "\0").as_bytes().as_ptr()))
                };
                raw.map(|f| unsafe {
                    std::mem::transmute::<unsafe extern "system" fn() -> isize, $ty>(f)
                })
            }};
        }

        let fn_init:    FnInit    = sym!("nvmlInit_v2",                    FnInit);
        let fn_shutdown: FnShutdown = sym!("nvmlShutdown",                 FnShutdown);
        let fn_get_count: FnGetCount = sym!("nvmlDeviceGetCount_v2",       FnGetCount);
        let fn_get_handle: FnGetHandle = sym!("nvmlDeviceGetHandleByIndex_v2", FnGetHandle);
        let fn_get_name:  FnGetName  = sym!("nvmlDeviceGetName",           FnGetName);
        let fn_get_temp:  FnGetTemp  = sym!("nvmlDeviceGetTemperature",    FnGetTemp);
        let fn_get_util:  FnGetUtil  = sym!("nvmlDeviceGetUtilizationRates", FnGetUtil);
        let fn_get_mem:   FnGetMem   = sym!("nvmlDeviceGetMemoryInfo",     FnGetMem);
        let fn_get_clock: FnGetClock = sym!("nvmlDeviceGetClockInfo",      FnGetClock);
        let fn_get_fan:   FnGetFan   = sym!("nvmlDeviceGetFanSpeed",       FnGetFan);
        let fn_get_power: FnGetPower = sym!("nvmlDeviceGetPowerUsage",     FnGetPower);
        let fn_get_driver_ver: Option<FnGetDriverVersion> =
            sym_opt!("nvmlSystemGetDriverVersion", FnGetDriverVersion);

        // Initialise NVML library.
        if unsafe { fn_init() } != NVML_SUCCESS {
            unsafe { let _ = FreeLibrary(lib); }
            return None;
        }

        // Enumerate GPUs.
        let mut device_count: u32 = 0;
        if unsafe { fn_get_count(&mut device_count) } != NVML_SUCCESS || device_count == 0 {
            unsafe {
                fn_shutdown();
                let _ = FreeLibrary(lib);
            }
            return None;
        }

        let mut devices: Vec<NvmlDevice> = Vec::with_capacity(device_count as usize);
        for i in 0..device_count {
            let mut dev: NvmlDevice = 0;
            if unsafe { fn_get_handle(i, &mut dev) } == NVML_SUCCESS {
                devices.push(dev);
            }
        }

        if devices.is_empty() {
            unsafe {
                fn_shutdown();
                let _ = FreeLibrary(lib);
            }
            return None;
        }

        log::info!("NVML initialised — {} NVIDIA GPU(s).", devices.len());

        Some(NvmlContext {
            lib,
            devices,
            fn_shutdown,
            fn_get_name,
            fn_get_temp,
            fn_get_util,
            fn_get_mem,
            fn_get_clock,
            fn_get_fan,
            fn_get_power,
            fn_get_driver_ver,
        })
    }

    /// Poll the primary GPU (index 0) and return a [`GpuReading`].
    pub fn query_primary_gpu(&self) -> Option<GpuReading> {
        let &dev = self.devices.first()?;

        // ── Name ─────────────────────────────────────────────────────────────
        let mut name_buf = vec![0u8; NVML_DEVICE_NAME_BUFFER_SIZE as usize];
        let name = if unsafe {
            (self.fn_get_name)(dev, name_buf.as_mut_ptr(), NVML_DEVICE_NAME_BUFFER_SIZE)
        } == NVML_SUCCESS
        {
            let nul = name_buf.iter().position(|&b| b == 0).unwrap_or(name_buf.len());
            String::from_utf8_lossy(&name_buf[..nul]).trim().to_string()
        } else {
            "NVIDIA GPU".to_string()
        };

        // ── Temperature ───────────────────────────────────────────────────────
        let mut temp: u32 = 0;
        let temperature_c =
            if unsafe { (self.fn_get_temp)(dev, NVML_TEMPERATURE_GPU, &mut temp) } == NVML_SUCCESS {
                Some(temp as f32)
            } else {
                None
            };

        // ── Utilization ───────────────────────────────────────────────────────
        let mut util = NvmlUtilization { gpu: 0, memory: 0 };
        let usage_pct = if unsafe { (self.fn_get_util)(dev, &mut util) } == NVML_SUCCESS {
            util.gpu as f32
        } else {
            0.0
        };

        // ── Memory ────────────────────────────────────────────────────────────
        let mut mem = NvmlMemory { total: 0, free: 0, used: 0 };
        let (vram_used_gb, vram_total_gb) =
            if unsafe { (self.fn_get_mem)(dev, &mut mem) } == NVML_SUCCESS {
                (
                    mem.used  as f32 / 1_073_741_824.0,
                    mem.total as f32 / 1_073_741_824.0,
                )
            } else {
                (0.0, 0.0)
            };

        // ── Clocks ────────────────────────────────────────────────────────────
        let mut core_clk: u32 = 0;
        let mut mem_clk: u32 = 0;
        let core_clock_mhz =
            if unsafe { (self.fn_get_clock)(dev, NVML_CLOCK_GRAPHICS, &mut core_clk) } == NVML_SUCCESS {
                core_clk as u64
            } else {
                0
            };
        let mem_clock_mhz =
            if unsafe { (self.fn_get_clock)(dev, NVML_CLOCK_MEM, &mut mem_clk) } == NVML_SUCCESS {
                mem_clk as u64
            } else {
                0
            };

        // ── Fan ───────────────────────────────────────────────────────────────
        let mut fan_pct_raw: u32 = 0;
        let fan_pct =
            if unsafe { (self.fn_get_fan)(dev, &mut fan_pct_raw) } == NVML_SUCCESS {
                Some(fan_pct_raw)
            } else {
                None
            };

        // ── Power ─────────────────────────────────────────────────────────────
        let mut power_mw: u32 = 0;
        let power_watts =
            if unsafe { (self.fn_get_power)(dev, &mut power_mw) } == NVML_SUCCESS {
                Some(power_mw as f32 / 1000.0)
            } else {
                None
            };

        Some(GpuReading {
            name,
            vendor: "nvidia".to_string(),
            temperature_c,
            usage_pct,
            vram_used_gb,
            vram_total_gb,
            core_clock_mhz,
            mem_clock_mhz,
            fan_pct,
            fan_rpm: None,
            power_watts,
        })
    }

    /// Query the NVIDIA driver version in clean format (e.g. "560.94").
    /// Uses `nvmlSystemGetDriverVersion` which returns the user-visible version
    /// string — not the long Windows driver version like "31.0.15.6094".
    pub fn query_driver_version(&self) -> Option<String> {
        let f = self.fn_get_driver_ver?;
        const LEN: u32 = 80;
        let mut buf = vec![0u8; LEN as usize];
        if unsafe { f(buf.as_mut_ptr(), LEN) } != NVML_SUCCESS {
            return None;
        }
        let nul = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        let ver = String::from_utf8_lossy(&buf[..nul]).trim().to_string();
        if ver.is_empty() { None } else { Some(ver) }
    }
}

impl Drop for NvmlContext {
    fn drop(&mut self) {
        unsafe {
            (self.fn_shutdown)();
            let _ = FreeLibrary(self.lib);
        }
    }
}
