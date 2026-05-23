import { callNative } from './native';
import {
  mockApplyPerformanceProfile,
  mockBloatwareItems,
  mockHardwareSample,
  mockListTopProcesses,
  mockPerformanceProfiles,
  mockRamCleanup,
  mockRegistryBackup,
  mockRegistryIssues,
  mockStartupItems,
  mockStorageCleanupItems,
  mockSystemInfo,
} from './mockData';
import type {
  BloatwareItem,
  HardwareCapability,
  DiagnosticsExport,
  HardwareSample,
  MetricPoint,
  PerformanceProfile,
  PerformanceProfileId,
  PerformanceProfileResult,
  ProcessInfo,
  RamCleanupResult,
  RegistryBackup,
  RegistryIssue,
  StartupItem,
  StorageCleanupItem,
  TelemetryDiagnosticsSnapshot,
  SystemInfo,
  TrayStatus,
} from '../types/system';

export async function getSystemInfo(): Promise<SystemInfo> {
  return callNative<SystemInfo>('get_system_info', undefined, mockSystemInfo);
}

export async function getHardwareSample(history: MetricPoint[]): Promise<HardwareSample> {
  return callNative<HardwareSample>('get_hardware_sample', { history }, () => mockHardwareSample(history));
}

export async function optimizeRam(): Promise<RamCleanupResult> {
  return callNative<RamCleanupResult>('optimize_ram', { mode: 'safe' }, mockRamCleanup);
}

export async function scanBloatware(): Promise<BloatwareItem[]> {
  return callNative<BloatwareItem[]>('scan_bloatware', undefined, mockBloatwareItems);
}

export async function removeBloatware(items: BloatwareItem[]): Promise<string[]> {
  return callNative<string[]>('remove_bloatware', { ids: items.map((item) => item.id), dryRun: false }, async () =>
    items.map((item) => `[browser] ${item.name}: queued ${item.action} cleanup with restore logging.`),
  );
}

export async function restoreBloatware(items: BloatwareItem[]): Promise<string[]> {
  return callNative<string[]>('restore_bloatware', { ids: items.map((item) => item.id), dryRun: false }, async () =>
    items.map((item) => `[browser] ${item.name}: restore action queued.`),
  );
}

export async function setTrayStatus(status: TrayStatus): Promise<void> {
  return callNative<void>('set_tray_status', { status }, async () => undefined);
}

export async function setStartupEnabled(enabled: boolean): Promise<boolean> {
  return callNative<boolean>('set_startup_enabled', { enabled }, async () => enabled);
}

export async function setCloseToTray(enabled: boolean): Promise<void> {
  return callNative<void>('set_close_to_tray', { enabled }, async () => undefined);
}

export async function showMainWindow(): Promise<void> {
  return callNative<void>('show_main_window', undefined, async () => undefined);
}

export async function setOverlayWindow(enabled: boolean, clickThrough: boolean): Promise<void> {
  return callNative<void>('set_overlay_window', { enabled, clickThrough }, async () => undefined);
}

export async function scanStartupItems(): Promise<StartupItem[]> {
  return callNative<StartupItem[]>('scan_startup_items', undefined, mockStartupItems);
}

export async function setStartupItemEnabled(item: StartupItem, enabled: boolean): Promise<string> {
  return callNative<string>('set_startup_item_enabled', { id: item.id, enabled, dryRun: false }, async () =>
    `[browser] ${enabled ? 'Enable' : 'Disable'} ${item.name} from ${item.location}.`,
  );
}

export async function scanStorageCleanup(): Promise<StorageCleanupItem[]> {
  return callNative<StorageCleanupItem[]>('scan_storage_cleanup', undefined, mockStorageCleanupItems);
}

export async function runStorageCleanup(items: StorageCleanupItem[]): Promise<string[]> {
  return callNative<string[]>('run_storage_cleanup', { ids: items.map((item) => item.id), dryRun: false }, async () =>
    items.map((item) => `[browser] ${item.name}: would reclaim ${item.sizeGb.toFixed(1)} GB.`),
  );
}

export async function scanRegistryIssues(): Promise<RegistryIssue[]> {
  return callNative<RegistryIssue[]>('scan_registry_issues', undefined, mockRegistryIssues);
}

export async function backupRegistryIssues(items: RegistryIssue[]): Promise<RegistryBackup> {
  return callNative<RegistryBackup>('backup_registry_issues', { ids: items.map((item) => item.id) }, async () => mockRegistryBackup(items.length));
}

export async function cleanRegistryIssues(items: RegistryIssue[], backupId: string): Promise<string[]> {
  return callNative<string[]>('clean_registry_issues', { ids: items.map((item) => item.id), backupId, dryRun: false }, async () =>
    items.map((item) => `[browser] ${item.hive}\\${item.keyPath}\\${item.valueName}: backup ${backupId} required before removal.`),
  );
}

export async function restoreRegistryBackup(backupId: string): Promise<string[]> {
  return callNative<string[]>('restore_registry_backup', { backupId }, async () => [
    `[browser] restore requested for backup ${backupId}.`,
  ]);
}

export async function exportDiagnostics(): Promise<DiagnosticsExport> {
  return callNative<DiagnosticsExport>('export_diagnostics', undefined, async () => ({
    path: 'Browser preview only',
    createdAt: new Date().toLocaleString(),
    message: 'Native diagnostics export is available in the Tauri desktop app.',
    sections: ['System identity', 'Telemetry sample', 'Capability registry', 'Provider orchestration', 'Sensor discovery report'],
    providerCount: 3,
    capabilityCount: 3,
    sensorCount: 4,
    discoveryAttemptCount: 5,
  }));
}

export async function getTelemetryDiagnostics(): Promise<TelemetryDiagnosticsSnapshot> {
  return callNative<TelemetryDiagnosticsSnapshot>('get_telemetry_diagnostics', undefined, async () => ({
    createdAt: new Date().toLocaleString(),
    overallState: 'Browser preview',
    activeProvider: 'mock',
    fallbackSequence: ['browser-preview', 'mock-data'],
    providerLoadOrder: ['wmi', 'nvml', 'adl2', 'igcl'],
    providers: [
      {
        id: 'wmi', label: 'WMI', vendor: 'windows', loadOrder: 1, state: 'loaded', active: true, dll: 'COM / ROOT\\CIMV2', dllAvailable: true, symbolsResolved: true, symbols: ['Win32_Processor', 'Win32_VideoController', 'MSAcpi_ThermalZoneTemperature'], notes: 'Core identity and fallback telemetry', warnings: [], errors: [],
      },
      {
        id: 'nvml', label: 'NVML', vendor: 'nvidia', loadOrder: 2, state: 'unavailable', active: false, dll: 'nvml.dll', dllAvailable: false, symbolsResolved: false, symbols: ['nvmlInit_v2', 'nvmlDeviceGetUtilizationRates'], notes: 'NVIDIA driver API unavailable in browser preview', warnings: [], errors: [],
      },
      {
        id: 'igcl', label: 'IGCL', vendor: 'intel', loadOrder: 4, state: 'staged', active: false, dll: 'igcl64.dll / ControlLib.dll', dllAvailable: false, symbolsResolved: false, symbols: ['ctlInit', 'ctlEnumerateDevices'], notes: 'Intel Arc loader scaffold is staged for native hardware', warnings: ['Sensor bindings pending'], errors: [],
      },
    ],
    capabilities: [
      { id: 'cpu-temp', label: 'CPU package telemetry', state: 'partial', detail: 'Browser preview mode', writeSafe: false },
      { id: 'gpu-intel-arc', label: 'Intel Arc telemetry', state: 'staged', detail: 'IGCL loader scaffold active', writeSafe: false },
      { id: 'superio-ec', label: 'SuperIO / EC access', state: 'driver_required', detail: 'Capability registry pending', writeSafe: false },
    ],
    sensors: [
      { id: 'cpu-temp', sensor: 'CPU Temp', provider: 'WMI ACPI', providerState: 'loaded', state: 'partial', confidence: 'medium', telemetryQuality: 'Fallback thermal read', fallbackStatus: 'sysinfo CPU usage still available', notes: 'Package-only thermal channel in browser preview', oemSupportStatus: 'Supported with fallback', icon: 'thermometer' },
      { id: 'gpu-temp', sensor: 'GPU Temp', provider: 'Mock GPU', providerState: 'unavailable', state: 'staged', confidence: 'low', telemetryQuality: 'Preview-only', fallbackStatus: 'WMI usage placeholder', notes: 'Native vendor provider required for trustworthy data', oemSupportStatus: 'Staged', icon: 'gpu' },
      { id: 'storage-smart', sensor: 'NVMe Temp', provider: 'SMART', providerState: 'unavailable', state: 'driver_required', confidence: 'low', telemetryQuality: 'Pending DeviceIoControl', fallbackStatus: 'No safe fallback', notes: 'SMART sensor path is not yet bound', oemSupportStatus: 'Planned', icon: 'hard-drive' },
      { id: 'network', sensor: 'Network throughput', provider: 'sysinfo', providerState: 'loaded', state: 'live', confidence: 'medium', telemetryQuality: 'Cached throughput delta', fallbackStatus: 'None', notes: 'Live in preview and native modes', oemSupportStatus: 'Supported', icon: 'network' },
    ],
    supportSnapshot: ['Local export only', 'No automatic upload', 'Owner consent required for sharing'],
    supportActions: ['Support Snapshot', 'Generate OEM Report', 'Validate System Health'],
    sensorDiscovery: {
      machineVendor: 'Preview',
      machineModel: 'Browser sandbox',
      machineFamily: 'Web',
      isDell: false,
      packageTempAvailable: false,
      requiresDriver: false,
      recommendedAction: 'Run desktop mode to gather hardware sensor discovery probes.',
      dellClassHints: [],
      attempts: [
        {
          source: 'wmi-acpi',
          query: 'Desktop-only',
          label: 'MSAcpi_ThermalZoneTemperature',
          rawValue: 'preview',
          valueC: null,
          accepted: false,
          reason: 'Browser mode has no hardware access',
        },
      ],
    },
    hardwareIdentity: mockSystemInfo(),
    sample: mockHardwareSample([]),
  }));
}

export async function getPerformanceProfiles(): Promise<PerformanceProfile[]> {
  return callNative<PerformanceProfile[]>('get_performance_profiles', undefined, mockPerformanceProfiles);
}

export async function applyPerformanceProfile(id: PerformanceProfileId): Promise<PerformanceProfileResult> {
  return callNative<PerformanceProfileResult>('apply_performance_profile', { id, dryRun: false }, async () => mockApplyPerformanceProfile(id));
}

/**
 * Sends raw RGBA bytes for a 32×32 image to the Rust tray to update the
 * system-tray icon dynamically. No-op in browser mode.
 */
export async function setTrayIconData(rgba: number[], width: number, height: number): Promise<void> {
  return callNative<void>('set_tray_icon_data', { rgba, width, height }, async () => undefined);
}

export async function listTopProcesses(limit = 30): Promise<ProcessInfo[]> {
  return callNative<ProcessInfo[]>('list_top_processes', { limit }, async () => mockListTopProcesses(limit));
}

export async function getHardwareCapabilities(): Promise<HardwareCapability[]> {
  return callNative<HardwareCapability[]>('get_hardware_capabilities', undefined, async () => [
    { id: 'cpu-temp', label: 'CPU package telemetry', state: 'partial', detail: 'Browser preview mode', writeSafe: false },
    { id: 'gpu-intel-arc', label: 'Intel Arc telemetry', state: 'partial', detail: 'WMI fallback only', writeSafe: false },
    { id: 'superio-ec', label: 'SuperIO / EC access', state: 'unknown', detail: 'Capability registry pending', writeSafe: false },
  ]);
}
