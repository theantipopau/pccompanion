//! AMD GPU monitoring via the AMD ADLX SDK (`amdadlx64.dll`).
//!
//! ADLX exposes C++ virtual interfaces (COM-style vtables) instead of the
//! flat C exports used by the legacy ADL2 API in `amd_provider.rs`. The
//! vtable struct layouts and method order below are transcribed verbatim
//! from AMD's official, MIT-licensed public SDK headers
//! (<https://github.com/GPUOpen-LibrariesAndSDKs/ADLX>, `SDK/Include/*.h`,
//! the `#else //__cplusplus` C-ABI-compatible struct blocks that AMD ships
//! specifically for non-C++ consumers) — not reverse engineered or guessed.
//! Calling a C++ vtable through an incorrect slot order does not fail
//! gracefully; it invokes whatever function happens to sit at that memory
//! offset, which can crash or corrupt memory in a process that may be
//! running elevated. Every struct field below corresponds 1:1 to a named
//! method in AMD's published headers, in the same order.
//!
//! Supersedes the legacy ADL2 Overdrive5/OverdriveN path in
//! `amd_provider.rs` for current-generation cards: confirmed by raw
//! return-code diagnostics on a Radeon RX 9070 XT (RDNA4) that ADL2's
//! Overdrive5 and OverdriveN temperature calls both fail (`ADL_ERR` / -1 and
//! `ADL_ERR_NOT_SUPPORTED` / -8) on every enumerated adapter slot — see
//! `docs/compatibility-matrix.md`. `amd_provider.rs` is kept as a fallback
//! for older cards where legacy ADL2 still works.

#![allow(dead_code)]
#![allow(non_snake_case)]

use crate::hardware::GpuReading;
use std::ffi::c_void;
use windows::core::PCWSTR;
use windows::Win32::Foundation::HMODULE;
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

#[link(name = "kernel32")]
extern "system" {
    fn FreeLibrary(hLibModule: HMODULE) -> i32;
}

// ─── ADLX primitive types (ADLXDefines.h) ───────────────────────────────────
// adlx_long = C `long` = 32-bit on Windows (LLP64). adlx_bool is C++ `bool`
// (1 byte on MSVC), matching the `adlx_uint8` C-ABI fallback typedef.
type AdlxLong = i32;
type AdlxResult = i32;
type AdlxBool = u8;
type AdlxUint = u32;
type AdlxInt = i32;
type AdlxInt64 = i64;
type AdlxDouble = f64;

const ADLX_OK: AdlxResult = 0;
const ADLX_ALREADY_ENABLED: AdlxResult = 1;
const ADLX_ALREADY_INITIALIZED: AdlxResult = 2;
const GPUTYPE_DISCRETE: i32 = 2;

fn adlx_succeeded(r: AdlxResult) -> bool {
    r == ADLX_OK || r == ADLX_ALREADY_ENABLED || r == ADLX_ALREADY_INITIALIZED
}

/// `ADLX_MAKE_FULL_VER(1, 5, 0, 124)` from `ADLXVersion.h` at the time these
/// headers were fetched (2026-06-28). ADLX interfaces are documented as
/// locked/backward-compatible across driver versions, so a version mismatch
/// fails closed with `ADLX_BAD_VER` rather than misbehaving.
const ADLX_FULL_VERSION: u64 = (1u64 << 48) | (5u64 << 32) | (0u64 << 16) | 124u64;

// ─── Raw C-ABI interface shapes (ISystem.h / IPerformanceMonitoring.h) ──────
// Every ADLX interface is `struct X { const XVtbl* pVtbl; }` per AMD's own
// C-ABI headers. We mirror that exact shape.

#[repr(C)]
struct IadlxSystem {
    vtbl: *const IadlxSystemVtbl,
}

#[repr(C)]
struct IadlxSystemVtbl {
    get_hybrid_graphics_type: unsafe extern "system" fn(*mut IadlxSystem, *mut i32) -> AdlxResult,
    get_gpus: unsafe extern "system" fn(*mut IadlxSystem, *mut *mut IadlxGpuList) -> AdlxResult,
    query_interface: unsafe extern "system" fn(*mut IadlxSystem, PCWSTR, *mut *mut c_void) -> AdlxResult,
    get_displays_services: unsafe extern "system" fn(*mut IadlxSystem, *mut *mut c_void) -> AdlxResult,
    get_desktops_services: unsafe extern "system" fn(*mut IadlxSystem, *mut *mut c_void) -> AdlxResult,
    get_gpus_changed_handling: unsafe extern "system" fn(*mut IadlxSystem, *mut *mut c_void) -> AdlxResult,
    enable_log: unsafe extern "system" fn(*mut IadlxSystem, i32, i32, *mut c_void, PCWSTR) -> AdlxResult,
    get_3d_settings_services: unsafe extern "system" fn(*mut IadlxSystem, *mut *mut c_void) -> AdlxResult,
    get_gpu_tuning_services: unsafe extern "system" fn(*mut IadlxSystem, *mut *mut c_void) -> AdlxResult,
    get_performance_monitoring_services:
        unsafe extern "system" fn(*mut IadlxSystem, *mut *mut IadlxPerformanceMonitoringServices) -> AdlxResult,
    total_system_ram: unsafe extern "system" fn(*mut IadlxSystem, *mut AdlxUint) -> AdlxResult,
    get_i2c: unsafe extern "system" fn(*mut IadlxSystem, *mut c_void, *mut *mut c_void) -> AdlxResult,
}

#[repr(C)]
struct IadlxGpuList {
    vtbl: *const IadlxGpuListVtbl,
}

#[repr(C)]
struct IadlxGpuListVtbl {
    acquire: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxLong,
    release: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxLong,
    query_interface: unsafe extern "system" fn(*mut IadlxGpuList, PCWSTR, *mut *mut c_void) -> AdlxResult,
    size: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxUint,
    empty: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxBool,
    begin: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxUint,
    end: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxUint,
    at: unsafe extern "system" fn(*mut IadlxGpuList, AdlxUint, *mut *mut c_void) -> AdlxResult,
    clear: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxResult,
    remove_back: unsafe extern "system" fn(*mut IadlxGpuList) -> AdlxResult,
    add_back: unsafe extern "system" fn(*mut IadlxGpuList, *mut c_void) -> AdlxResult,
    at_gpu_list: unsafe extern "system" fn(*mut IadlxGpuList, AdlxUint, *mut *mut IadlxGpu) -> AdlxResult,
    add_back_gpu_list: unsafe extern "system" fn(*mut IadlxGpuList, *mut IadlxGpu) -> AdlxResult,
}

#[repr(C)]
struct IadlxGpu {
    vtbl: *const IadlxGpuVtbl,
}

#[repr(C)]
struct IadlxGpuVtbl {
    acquire: unsafe extern "system" fn(*mut IadlxGpu) -> AdlxLong,
    release: unsafe extern "system" fn(*mut IadlxGpu) -> AdlxLong,
    query_interface: unsafe extern "system" fn(*mut IadlxGpu, PCWSTR, *mut *mut c_void) -> AdlxResult,
    vendor_id: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    asic_family_type: unsafe extern "system" fn(*mut IadlxGpu, *mut i32) -> AdlxResult,
    gpu_type: unsafe extern "system" fn(*mut IadlxGpu, *mut i32) -> AdlxResult,
    is_external: unsafe extern "system" fn(*mut IadlxGpu, *mut AdlxBool) -> AdlxResult,
    name: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    driver_path: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    pnp_string: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    has_desktops: unsafe extern "system" fn(*mut IadlxGpu, *mut AdlxBool) -> AdlxResult,
    total_vram: unsafe extern "system" fn(*mut IadlxGpu, *mut AdlxUint) -> AdlxResult,
    vram_type: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    bios_info: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8, *mut *const i8, *mut *const i8) -> AdlxResult,
    device_id: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    revision_id: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    sub_system_id: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    sub_system_vendor_id: unsafe extern "system" fn(*mut IadlxGpu, *mut *const i8) -> AdlxResult,
    unique_id: unsafe extern "system" fn(*mut IadlxGpu, *mut AdlxInt) -> AdlxResult,
}

#[repr(C)]
struct IadlxPerformanceMonitoringServices {
    vtbl: *const IadlxPerformanceMonitoringServicesVtbl,
}

#[repr(C)]
struct AdlxIntRange {
    min_value: AdlxInt,
    max_value: AdlxInt,
    step_value: AdlxInt,
}

#[repr(C)]
struct IadlxPerformanceMonitoringServicesVtbl {
    acquire: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices) -> AdlxLong,
    release: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices) -> AdlxLong,
    query_interface: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, PCWSTR, *mut *mut c_void) -> AdlxResult,
    get_sampling_interval_range: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut AdlxIntRange) -> AdlxResult,
    set_sampling_interval: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, AdlxInt) -> AdlxResult,
    get_sampling_interval: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut AdlxInt) -> AdlxResult,
    get_max_history_size_range: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut AdlxIntRange) -> AdlxResult,
    set_max_history_size: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, AdlxInt) -> AdlxResult,
    get_max_history_size: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut AdlxInt) -> AdlxResult,
    clear_history: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices) -> AdlxResult,
    get_current_history_size: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut AdlxInt) -> AdlxResult,
    start_tracking: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices) -> AdlxResult,
    stop_tracking: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices) -> AdlxResult,
    get_all_metrics_history: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, AdlxInt, AdlxInt, *mut *mut c_void) -> AdlxResult,
    get_gpu_metrics_history: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut IadlxGpu, AdlxInt, AdlxInt, *mut *mut c_void) -> AdlxResult,
    get_system_metrics_history: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, AdlxInt, AdlxInt, *mut *mut c_void) -> AdlxResult,
    get_fps_history: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, AdlxInt, AdlxInt, *mut *mut c_void) -> AdlxResult,
    get_current_all_metrics: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut *mut c_void) -> AdlxResult,
    get_current_gpu_metrics: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut IadlxGpu, *mut *mut IadlxGpuMetrics) -> AdlxResult,
    get_current_system_metrics: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut *mut c_void) -> AdlxResult,
    get_current_fps: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut *mut c_void) -> AdlxResult,
    get_supported_gpu_metrics: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut IadlxGpu, *mut *mut IadlxGpuMetricsSupport) -> AdlxResult,
    get_supported_system_metrics: unsafe extern "system" fn(*mut IadlxPerformanceMonitoringServices, *mut *mut c_void) -> AdlxResult,
}

#[repr(C)]
struct IadlxGpuMetrics {
    vtbl: *const IadlxGpuMetricsVtbl,
}

#[repr(C)]
struct IadlxGpuMetricsVtbl {
    acquire: unsafe extern "system" fn(*mut IadlxGpuMetrics) -> AdlxLong,
    release: unsafe extern "system" fn(*mut IadlxGpuMetrics) -> AdlxLong,
    query_interface: unsafe extern "system" fn(*mut IadlxGpuMetrics, PCWSTR, *mut *mut c_void) -> AdlxResult,
    time_stamp: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxInt64) -> AdlxResult,
    gpu_usage: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxDouble) -> AdlxResult,
    gpu_clock_speed: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxInt) -> AdlxResult,
    gpu_vram_clock_speed: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxInt) -> AdlxResult,
    gpu_temperature: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxDouble) -> AdlxResult,
    gpu_hotspot_temperature: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxDouble) -> AdlxResult,
    gpu_power: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxDouble) -> AdlxResult,
    gpu_total_board_power: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxDouble) -> AdlxResult,
    gpu_fan_speed: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxInt) -> AdlxResult,
    gpu_vram: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxInt) -> AdlxResult,
    gpu_voltage: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxInt) -> AdlxResult,
    gpu_intake_temperature: unsafe extern "system" fn(*mut IadlxGpuMetrics, *mut AdlxDouble) -> AdlxResult,
}

#[repr(C)]
struct IadlxGpuMetricsSupport {
    vtbl: *const IadlxGpuMetricsSupportVtbl,
}

#[repr(C)]
struct IadlxGpuMetricsSupportVtbl {
    acquire: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport) -> AdlxLong,
    release: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport) -> AdlxLong,
    query_interface: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, PCWSTR, *mut *mut c_void) -> AdlxResult,
    is_supported_gpu_usage: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_clock_speed: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_vram_clock_speed: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_temperature: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_hotspot_temperature: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_power: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_total_board_power: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_fan_speed: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_vram: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    is_supported_gpu_voltage: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
    get_gpu_usage_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_clock_speed_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_vram_clock_speed_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_temperature_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_hotspot_temperature_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_power_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_fan_speed_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_vram_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_voltage_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_total_board_power_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    get_gpu_intake_temperature_range: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxInt, *mut AdlxInt) -> AdlxResult,
    is_supported_gpu_intake_temperature: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult,
}

// ─── DLL entry points (ADLX.h) ──────────────────────────────────────────────

type AdlxInitializeFn = unsafe extern "system" fn(u64, *mut *mut IadlxSystem) -> AdlxResult;
type AdlxTerminateFn = unsafe extern "system" fn() -> AdlxResult;

// ─── AdlxContext ─────────────────────────────────────────────────────────────

/// Active AMD ADLX session. Created once on the monitoring thread.
/// Not `Send` (holds raw interface pointers) — only use within a single thread.
pub struct AdlxContext {
    lib: HMODULE,
    terminate: AdlxTerminateFn,
    system: *mut IadlxSystem,
    perf_services: *mut IadlxPerformanceMonitoringServices,
    gpu: *mut IadlxGpu,
    gpu_name: String,
    /// Per-metric support flags for `gpu`. ADLX's metrics getters can return
    /// `ADLX_OK` with a meaningless/garbage value for a metric the specific
    /// card or driver doesn't actually back (observed: GPUClockSpeed and
    /// GPUVRAMClockSpeed returning implausible single-digit values on a
    /// Radeon RX 9070 XT). Every metric read is gated on the matching
    /// `IsSupportedX` flag here before being trusted.
    metrics_support: *mut IadlxGpuMetricsSupport,
}

impl AdlxContext {
    /// Try to load `amdadlx64.dll`, initialise ADLX, and select the primary
    /// discrete AMD GPU. Returns `None` when ADLX is unavailable, no AMD
    /// driver is installed, or no discrete GPU is enumerated.
    pub fn init() -> Option<Self> {
        let lib = ["amdadlx64.dll", r"C:\Windows\System32\amdadlx64.dll"]
            .iter()
            .find_map(|path| unsafe {
                let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
                LoadLibraryW(PCWSTR(wide.as_ptr())).ok()
            })?;

        let init_fn = unsafe {
            GetProcAddress(lib, windows::core::PCSTR(b"ADLXInitialize\0".as_ptr()))
        };
        let terminate_fn = unsafe {
            GetProcAddress(lib, windows::core::PCSTR(b"ADLXTerminate\0".as_ptr()))
        };
        let (Some(init_fn), Some(terminate_fn)) = (init_fn, terminate_fn) else {
            unsafe { let _ = FreeLibrary(lib); }
            return None;
        };
        let init_fn: AdlxInitializeFn = unsafe { std::mem::transmute(init_fn) };
        let terminate: AdlxTerminateFn = unsafe { std::mem::transmute(terminate_fn) };

        let mut system: *mut IadlxSystem = std::ptr::null_mut();
        let init_result = unsafe { init_fn(ADLX_FULL_VERSION, &mut system) };
        if !adlx_succeeded(init_result) || system.is_null() {
            unsafe { let _ = FreeLibrary(lib); }
            return None;
        }

        let gpu_list = match Self::get_gpus(system) {
            Some(list) => list,
            None => {
                unsafe {
                    let _ = terminate();
                    let _ = FreeLibrary(lib);
                }
                return None;
            }
        };

        let selection = Self::select_discrete_gpu(gpu_list);
        unsafe { ((*(*gpu_list).vtbl).release)(gpu_list) };

        let Some((gpu, gpu_name)) = selection else {
            unsafe {
                let _ = terminate();
                let _ = FreeLibrary(lib);
            }
            return None;
        };

        let perf_services = match Self::get_performance_services(system) {
            Some(svc) => svc,
            None => {
                unsafe {
                    ((*(*gpu).vtbl).release)(gpu);
                    let _ = terminate();
                    let _ = FreeLibrary(lib);
                }
                return None;
            }
        };

        let mut metrics_support: *mut IadlxGpuMetricsSupport = std::ptr::null_mut();
        let support_result = unsafe {
            ((*(*perf_services).vtbl).get_supported_gpu_metrics)(perf_services, gpu, &mut metrics_support)
        };
        if !adlx_succeeded(support_result) || metrics_support.is_null() {
            // Fail closed: without the support flags we cannot tell a real
            // reading from an unbacked one, so don't allow ungated reads.
            unsafe {
                ((*(*perf_services).vtbl).release)(perf_services);
                ((*(*gpu).vtbl).release)(gpu);
                let _ = terminate();
                let _ = FreeLibrary(lib);
            }
            return None;
        }

        log::info!("AMD ADLX initialised — using GPU '{gpu_name}'.");

        Some(AdlxContext {
            lib,
            terminate,
            system,
            perf_services,
            gpu,
            gpu_name,
            metrics_support,
        })
    }

    fn get_gpus(system: *mut IadlxSystem) -> Option<*mut IadlxGpuList> {
        let mut list: *mut IadlxGpuList = std::ptr::null_mut();
        let result = unsafe { ((*(*system).vtbl).get_gpus)(system, &mut list) };
        if adlx_succeeded(result) && !list.is_null() { Some(list) } else { None }
    }

    fn get_performance_services(system: *mut IadlxSystem) -> Option<*mut IadlxPerformanceMonitoringServices> {
        let mut svc: *mut IadlxPerformanceMonitoringServices = std::ptr::null_mut();
        let result = unsafe { ((*(*system).vtbl).get_performance_monitoring_services)(system, &mut svc) };
        if adlx_succeeded(result) && !svc.is_null() { Some(svc) } else { None }
    }

    /// Walks the GPU list and returns the first discrete AMD GPU, Acquired
    /// (ref count already incremented by `At_GPUList`) so the caller owns
    /// the returned pointer and must `Release` it eventually. Every other
    /// enumerated GPU is Released immediately since it is not kept.
    fn select_discrete_gpu(list: *mut IadlxGpuList) -> Option<(*mut IadlxGpu, String)> {
        let size = unsafe { ((*(*list).vtbl).size)(list) };
        let mut fallback: Option<(*mut IadlxGpu, String)> = None;

        for index in 0..size {
            let mut gpu: *mut IadlxGpu = std::ptr::null_mut();
            let result = unsafe { ((*(*list).vtbl).at_gpu_list)(list, index, &mut gpu) };
            if !adlx_succeeded(result) || gpu.is_null() {
                continue;
            }

            let mut gpu_type: i32 = -1;
            unsafe { ((*(*gpu).vtbl).gpu_type)(gpu, &mut gpu_type) };
            let name = Self::read_gpu_name(gpu);

            if gpu_type == GPUTYPE_DISCRETE {
                // A discrete GPU always wins, regardless of enumeration order;
                // release any previously cached non-discrete fallback.
                if let Some((old_gpu, _)) = fallback.take() {
                    unsafe { ((*(*old_gpu).vtbl).release)(old_gpu) };
                }
                return Some((gpu, name));
            }

            if fallback.is_none() {
                fallback = Some((gpu, name));
            } else {
                unsafe { ((*(*gpu).vtbl).release)(gpu) };
            }
        }

        fallback
    }

    fn read_gpu_name(gpu: *mut IadlxGpu) -> String {
        let mut name_ptr: *const i8 = std::ptr::null();
        let result = unsafe { ((*(*gpu).vtbl).name)(gpu, &mut name_ptr) };
        if !adlx_succeeded(result) || name_ptr.is_null() {
            return "AMD Radeon GPU".to_string();
        }
        unsafe { std::ffi::CStr::from_ptr(name_ptr) }
            .to_string_lossy()
            .trim()
            .to_string()
    }

    /// Poll the detected AMD GPU and return a [`GpuReading`].
    pub fn query_primary_gpu(&self) -> Option<GpuReading> {
        let mut metrics: *mut IadlxGpuMetrics = std::ptr::null_mut();
        let result = unsafe {
            ((*(*self.perf_services).vtbl).get_current_gpu_metrics)(self.perf_services, self.gpu, &mut metrics)
        };
        if !adlx_succeeded(result) || metrics.is_null() {
            return None;
        }

        let support = unsafe { &*(*self.metrics_support).vtbl };
        let is_supported = |f: unsafe extern "system" fn(*mut IadlxGpuMetricsSupport, *mut AdlxBool) -> AdlxResult| -> bool {
            let mut flag: AdlxBool = 0;
            adlx_succeeded(unsafe { f(self.metrics_support, &mut flag) }) && flag != 0
        };

        let reading = unsafe {
            let vtbl = &*(*metrics).vtbl;

            let mut temp = 0.0f64;
            let temp_ok = is_supported(support.is_supported_gpu_temperature)
                && adlx_succeeded((vtbl.gpu_temperature)(metrics, &mut temp));

            let mut hotspot = 0.0f64;
            let hotspot_ok = is_supported(support.is_supported_gpu_hotspot_temperature)
                && adlx_succeeded((vtbl.gpu_hotspot_temperature)(metrics, &mut hotspot));

            let mut usage = 0.0f64;
            let usage_ok = is_supported(support.is_supported_gpu_usage)
                && adlx_succeeded((vtbl.gpu_usage)(metrics, &mut usage));

            let mut core_clock = 0i32;
            let core_clock_ok = is_supported(support.is_supported_gpu_clock_speed)
                && adlx_succeeded((vtbl.gpu_clock_speed)(metrics, &mut core_clock));

            let mut mem_clock = 0i32;
            let mem_clock_ok = is_supported(support.is_supported_gpu_vram_clock_speed)
                && adlx_succeeded((vtbl.gpu_vram_clock_speed)(metrics, &mut mem_clock));

            let mut fan_rpm = 0i32;
            let fan_ok = is_supported(support.is_supported_gpu_fan_speed)
                && adlx_succeeded((vtbl.gpu_fan_speed)(metrics, &mut fan_rpm));

            let mut vram_used_mb = 0i32;
            let vram_ok = is_supported(support.is_supported_gpu_vram)
                && adlx_succeeded((vtbl.gpu_vram)(metrics, &mut vram_used_mb));

            let mut power_w = 0.0f64;
            let power_ok = is_supported(support.is_supported_gpu_power)
                && adlx_succeeded((vtbl.gpu_power)(metrics, &mut power_w));

            GpuReading {
                name: self.gpu_name.clone(),
                vendor: "amd".to_string(),
                temperature_c: if temp_ok && temp > 0.0 {
                    Some(temp as f32)
                } else if hotspot_ok && hotspot > 0.0 {
                    Some(hotspot as f32)
                } else {
                    None
                },
                usage_pct: if usage_ok { usage as f32 } else { 0.0 },
                vram_used_gb: if vram_ok && vram_used_mb > 0 { vram_used_mb as f32 / 1024.0 } else { 0.0 },
                vram_total_gb: 0.0, // populated from WMI/registry static query
                core_clock_mhz: if core_clock_ok && core_clock > 0 { core_clock as u64 } else { 0 },
                mem_clock_mhz: if mem_clock_ok && mem_clock > 0 { mem_clock as u64 } else { 0 },
                fan_pct: None,
                fan_rpm: if fan_ok && fan_rpm > 0 { Some(fan_rpm as u32) } else { None },
                power_watts: if power_ok && power_w > 0.0 { Some(power_w as f32) } else { None },
            }
        };

        unsafe { ((*(*metrics).vtbl).release)(metrics) };
        Some(reading)
    }
}

impl Drop for AdlxContext {
    fn drop(&mut self) {
        unsafe {
            ((*(*self.metrics_support).vtbl).release)(self.metrics_support);
            ((*(*self.perf_services).vtbl).release)(self.perf_services);
            ((*(*self.gpu).vtbl).release)(self.gpu);
            (self.terminate)();
            let _ = FreeLibrary(self.lib);
        }
    }
}
