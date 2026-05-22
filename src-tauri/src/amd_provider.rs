//! AMD GPU monitoring via AMD Display Library (ADL2).
//!
//! `atiadlxx.dll` (64-bit) ships with AMD Radeon drivers.  We load it
//! dynamically so the app runs cleanly on non-AMD systems.
//!
//! Sensor coverage: core temperature, performance activity (clocks, GPU load),
//! fan RPM, dedicated VRAM usage.  ODN temperature (hotspot) is used when
//! available (RX 480+).
//!
//! Architecture inspired by LibreHardwareMonitor's AmdGpu.cs, reimplemented
//! in Rust using direct Win32 FFI — no C# code copied.

#![allow(dead_code)]

use crate::hardware::GpuReading;
use windows::core::{PCSTR, PCWSTR};
use windows::Win32::Foundation::HMODULE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};
use windows::Win32::System::Memory::{GetProcessHeap, HeapAlloc, HEAP_FLAGS};

// FreeLibrary is declared directly from kernel32 — the windows 0.58 crate
// does not re-export it under the enabled feature set.
#[link(name = "kernel32")]
extern "system" {
    fn FreeLibrary(hLibModule: HMODULE) -> i32;
}

// ─── ADL constants ─────────────────────────────────────────────────────────

const ADL_OK: i32 = 0;

/// Overdrive5 fan speed type: RPM.
const ADL_DL_FANCTRL_SPEED_TYPE_RPM: i32 = 1;
/// OverdriveN temperature type: GPU edge (core).
const ADL_ODN_TEMPERATURE_CORE: i32 = 1;

// ─── C-compatible ADL structs (must match adl_defines.h exactly) ─────────────

/// `ADLTemperature` — used by `ADL2_Overdrive5_Temperature_Get`.
/// Temperature is in millidegrees Celsius.
#[repr(C)]
struct AdlTemperature {
    i_size: i32,        // sizeof(ADLTemperature) = 8
    i_temperature: i32, // millidegrees Celsius
}

/// `ADLFanSpeedValue` — used by `ADL2_Overdrive5_FanSpeed_Get`.
#[repr(C)]
struct AdlFanSpeedValue {
    i_size: i32,       // sizeof(ADLFanSpeedValue) = 16
    i_speed_type: i32, // 1 = RPM, 2 = percent  (input + output)
    i_fan_speed: i32,  // returned fan speed
    i_flags: i32,
}

/// `ADLPMActivity` — used by `ADL2_Overdrive5_CurrentActivity_Get`.
#[repr(C)]
struct AdlPmActivity {
    i_size: i32,                     // sizeof(ADLPMActivity) = 40
    i_engine_clock: i32,             // core clock in units of 10 kHz (÷100 = MHz)
    i_memory_clock: i32,             // memory clock in units of 10 kHz (÷100 = MHz)
    i_vddc: i32,                     // core voltage mV
    i_activity_percent: i32,         // GPU load 0–100
    i_current_performance_level: i32,
    i_current_bus_speed: i32,
    i_current_bus_lanes: i32,
    i_maximum_bus_lanes: i32,
    i_reserved: i32,
}

/// Opaque ADL2 context handle (`ADL_CONTEXT_HANDLE = void*`).
type AdlContext = *mut std::ffi::c_void;

/// Memory allocation callback passed to `ADL2_Main_Control_Create`.
/// On Windows 10+ (UCRT), `HeapAlloc(GetProcessHeap())` and the CRT `free()`
/// both operate on the same underlying process heap, making them compatible.
unsafe extern "system" fn adl_alloc(size: i32) -> *mut std::ffi::c_void {
    if size <= 0 {
        return std::ptr::null_mut();
    }
    match GetProcessHeap() {
        Ok(heap) => HeapAlloc(heap, HEAP_FLAGS(0), size as usize),
        Err(_) => std::ptr::null_mut(),
    }
}

// ─── Function pointer types (on x64 Windows "system" == "C" == Win64 ABI) ────

type FnAdlAlloc = unsafe extern "system" fn(i32) -> *mut std::ffi::c_void;
type FnAdl2Create   = unsafe extern "system" fn(cb: FnAdlAlloc, connected: i32, ctx: *mut AdlContext) -> i32;
type FnAdl2Destroy  = unsafe extern "system" fn(ctx: AdlContext) -> i32;
type FnAdl2NumAdapters = unsafe extern "system" fn(ctx: AdlContext, count: *mut i32) -> i32;
type FnAdl2OD5Temp  = unsafe extern "system" fn(ctx: AdlContext, adapter: i32, tc: i32, temp: *mut AdlTemperature) -> i32;
type FnAdl2OD5Fan   = unsafe extern "system" fn(ctx: AdlContext, adapter: i32, tc: i32, fan: *mut AdlFanSpeedValue) -> i32;
type FnAdl2OD5Activity = unsafe extern "system" fn(ctx: AdlContext, adapter: i32, act: *mut AdlPmActivity) -> i32;
/// `ADL2_OverdriveN_Temperature_Get(ctx, adapter, tempType, *temp)` — temp in millidegrees.
type FnAdl2OdnTemp  = unsafe extern "system" fn(ctx: AdlContext, adapter: i32, temp_type: i32, temp: *mut i32) -> i32;
/// `ADL2_Adapter_DedicatedVRAMUsage_Get(ctx, adapter, *usageMB)`.
type FnAdl2VramUsage = unsafe extern "system" fn(ctx: AdlContext, adapter: i32, usage_mb: *mut i32) -> i32;

// ─── AmdAdlContext ────────────────────────────────────────────────────────────

/// Active AMD ADL2 session.  Created once on the monitoring thread.
/// Not `Send` (holds `HMODULE`) — only use within a single thread.
pub struct AmdAdlContext {
    lib: HMODULE,
    adl_ctx: AdlContext,
    adapter_index: i32,
    gpu_name: String,
    fn_destroy: FnAdl2Destroy,
    fn_od5_temp: FnAdl2OD5Temp,
    fn_od5_fan: FnAdl2OD5Fan,
    fn_od5_activity: FnAdl2OD5Activity,
    /// Optional — only available on RX 480+ drivers.
    fn_odn_temp: Option<FnAdl2OdnTemp>,
    /// Optional — may not be present on older ADL versions.
    fn_vram_usage: Option<FnAdl2VramUsage>,
}

impl AmdAdlContext {
    /// Try to load `atiadlxx.dll` and initialise ADL2. Returns `None` when no
    /// AMD drivers are installed or the GPU is not found.
    pub fn init() -> Option<Self> {
        let lib = [
            "atiadlxx.dll",
            r"C:\Windows\System32\atiadlxx.dll",
        ]
        .iter()
        .find_map(|path| unsafe {
            let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
            LoadLibraryW(PCWSTR(wide.as_ptr())).ok()
        })?;

        // Resolve a required symbol; cleans up on failure.
        macro_rules! sym_required {
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

        // Resolve an optional symbol (absent on older driver versions).
        macro_rules! sym_optional {
            ($name:literal, $ty:ty) => {{
                let raw = unsafe {
                    GetProcAddress(lib, PCSTR(concat!($name, "\0").as_bytes().as_ptr()))
                };
                raw.map(|f| unsafe {
                    std::mem::transmute::<unsafe extern "system" fn() -> isize, $ty>(f)
                })
            }};
        }

        let fn_create:   FnAdl2Create      = sym_required!("ADL2_Main_Control_Create",     FnAdl2Create);
        let fn_destroy:  FnAdl2Destroy     = sym_required!("ADL2_Main_Control_Destroy",    FnAdl2Destroy);
        let fn_num_adap: FnAdl2NumAdapters = sym_required!("ADL2_Adapter_NumberOfAdapters_Get", FnAdl2NumAdapters);
        let fn_od5_temp: FnAdl2OD5Temp     = sym_required!("ADL2_Overdrive5_Temperature_Get",   FnAdl2OD5Temp);
        let fn_od5_fan:  FnAdl2OD5Fan      = sym_required!("ADL2_Overdrive5_FanSpeed_Get",      FnAdl2OD5Fan);
        let fn_od5_act:  FnAdl2OD5Activity = sym_required!("ADL2_Overdrive5_CurrentActivity_Get", FnAdl2OD5Activity);
        let fn_odn_temp: Option<FnAdl2OdnTemp>   = sym_optional!("ADL2_OverdriveN_Temperature_Get",   FnAdl2OdnTemp);
        let fn_vram_usage: Option<FnAdl2VramUsage> = sym_optional!("ADL2_Adapter_DedicatedVRAMUsage_Get", FnAdl2VramUsage);

        // Create ADL2 context.
        let mut adl_ctx: AdlContext = std::ptr::null_mut();
        if unsafe { fn_create(adl_alloc, 1, &mut adl_ctx) } != ADL_OK || adl_ctx.is_null() {
            unsafe { let _ = FreeLibrary(lib); }
            return None;
        }

        // Find adapter count.
        let mut num_adapters: i32 = 0;
        if unsafe { fn_num_adap(adl_ctx, &mut num_adapters) } != ADL_OK || num_adapters == 0 {
            unsafe {
                fn_destroy(adl_ctx);
                let _ = FreeLibrary(lib);
            }
            return None;
        }

        // Find the first adapter that responds to Overdrive5 temperature.
        // This is the active AMD discrete GPU.
        let adapter_index = (0..num_adapters.min(8)).find(|&idx| {
            let mut temp = AdlTemperature {
                i_size: std::mem::size_of::<AdlTemperature>() as i32,
                i_temperature: 0,
            };
            (unsafe { fn_od5_temp(adl_ctx, idx, 0, &mut temp) }) == ADL_OK
        });

        let adapter_index = match adapter_index {
            Some(i) => i,
            None => {
                unsafe {
                    fn_destroy(adl_ctx);
                    let _ = FreeLibrary(lib);
                }
                return None;
            }
        };

        log::info!("AMD ADL2 initialised — using adapter index {}.", adapter_index);

        Some(AmdAdlContext {
            lib,
            adl_ctx,
            adapter_index,
            gpu_name: "AMD Radeon GPU".to_string(),
            fn_destroy,
            fn_od5_temp,
            fn_od5_fan,
            fn_od5_activity: fn_od5_act,
            fn_odn_temp,
            fn_vram_usage,
        })
    }

    /// Poll the detected AMD GPU and return a [`GpuReading`].
    pub fn query_primary_gpu(&self) -> Option<GpuReading> {
        let idx = self.adapter_index;

        // ── Temperature (prefer OverdriveN edge temp on RX 480+) ─────────────
        let temperature_c = if let Some(fn_odn) = self.fn_odn_temp {
            let mut temp_milli: i32 = 0;
            if unsafe { fn_odn(self.adl_ctx, idx, ADL_ODN_TEMPERATURE_CORE, &mut temp_milli) } == ADL_OK
                && temp_milli > 0
            {
                Some(temp_milli as f32 * 0.001)
            } else {
                // Fallback to OD5
                self.od5_temp(idx)
            }
        } else {
            self.od5_temp(idx)
        };

        // ── Performance activity (clock, load) ────────────────────────────────
        let mut activity = AdlPmActivity {
            i_size: std::mem::size_of::<AdlPmActivity>() as i32,
            i_engine_clock: 0,
            i_memory_clock: 0,
            i_vddc: 0,
            i_activity_percent: 0,
            i_current_performance_level: 0,
            i_current_bus_speed: 0,
            i_current_bus_lanes: 0,
            i_maximum_bus_lanes: 0,
            i_reserved: 0,
        };
        let activity_ok =
            unsafe { (self.fn_od5_activity)(self.adl_ctx, idx, &mut activity) } == ADL_OK;

        let usage_pct = if activity_ok { activity.i_activity_percent as f32 } else { 0.0 };
        // iEngineClock is in units of 10 kHz; ÷100 gives MHz.
        let core_clock_mhz = if activity_ok && activity.i_engine_clock > 0 {
            (activity.i_engine_clock as u64) / 100
        } else {
            0
        };
        let mem_clock_mhz = if activity_ok && activity.i_memory_clock > 0 {
            (activity.i_memory_clock as u64) / 100
        } else {
            0
        };

        // ── Fan RPM ───────────────────────────────────────────────────────────
        let mut fan_val = AdlFanSpeedValue {
            i_size: std::mem::size_of::<AdlFanSpeedValue>() as i32,
            i_speed_type: ADL_DL_FANCTRL_SPEED_TYPE_RPM,
            i_fan_speed: 0,
            i_flags: 0,
        };
        let fan_rpm = if unsafe { (self.fn_od5_fan)(self.adl_ctx, idx, 0, &mut fan_val) } == ADL_OK
            && fan_val.i_fan_speed > 0
        {
            Some(fan_val.i_fan_speed as u32)
        } else {
            None
        };

        // ── Dedicated VRAM usage ──────────────────────────────────────────────
        let vram_used_gb = if let Some(fn_vram) = self.fn_vram_usage {
            let mut usage_mb: i32 = 0;
            if unsafe { fn_vram(self.adl_ctx, idx, &mut usage_mb) } == ADL_OK && usage_mb > 0 {
                usage_mb as f32 / 1024.0
            } else {
                0.0
            }
        } else {
            0.0
        };

        Some(GpuReading {
            name: self.gpu_name.clone(),
            vendor: "amd".to_string(),
            temperature_c,
            usage_pct,
            vram_used_gb,
            vram_total_gb: 0.0, // populated from WMI static query
            core_clock_mhz,
            mem_clock_mhz,
            // AMD ADL Overdrive5 reports RPM; map to fan_pct slot as None
            // (RPM is exposed separately via FanSample in hardware.rs)
            fan_pct: None,
            fan_rpm,
            power_watts: None,
        })
    }

    /// Fan RPM from AMD ADL (available even when fan_pct is not).
    pub fn query_fan_rpm(&self) -> Option<u32> {
        let mut fan_val = AdlFanSpeedValue {
            i_size: std::mem::size_of::<AdlFanSpeedValue>() as i32,
            i_speed_type: ADL_DL_FANCTRL_SPEED_TYPE_RPM,
            i_fan_speed: 0,
            i_flags: 0,
        };
        if unsafe {
            (self.fn_od5_fan)(self.adl_ctx, self.adapter_index, 0, &mut fan_val)
        } == ADL_OK && fan_val.i_fan_speed > 0
        {
            Some(fan_val.i_fan_speed as u32)
        } else {
            None
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn od5_temp(&self, adapter: i32) -> Option<f32> {
        let mut temp = AdlTemperature {
            i_size: std::mem::size_of::<AdlTemperature>() as i32,
            i_temperature: 0,
        };
        if unsafe { (self.fn_od5_temp)(self.adl_ctx, adapter, 0, &mut temp) } == ADL_OK
            && temp.i_temperature > 0
        {
            // ADL OD5 temperature is in millidegrees Celsius.
            Some(temp.i_temperature as f32 * 0.001)
        } else {
            None
        }
    }
}

impl Drop for AmdAdlContext {
    fn drop(&mut self) {
        unsafe {
            (self.fn_destroy)(self.adl_ctx);
            let _ = FreeLibrary(self.lib);
        }
    }
}
