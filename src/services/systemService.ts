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
  AppMetadata,
  CompanionSettings,
  HardwareCapability,
  DiagnosticsExport,
  DiagnosticsExportContext,
  HardwareSample,
  MetricPoint,
  PerformanceProfile,
  PerformanceProfileId,
  PerformanceProfileResult,
  ProcessInfo,
  RamCleanupResult,
  RegistryBackup,
  RegistryIssue,
  RgbDiscovery,
  StartupItem,
  StorageCleanupItem,
  StorageScanStatus,
  StorageScanStatusPayload,
  SensorDiscoveryReport,
  SensorSidecarProbe,
  TelemetryDiagnosticsSnapshot,
  SystemInfo,
  TrayStatus,
} from '../types/system';
import { brand } from '../lib/branding';
import { readCompanionActions } from '../lib/actionHistory';

export async function getAppMetadata(): Promise<AppMetadata> {
  return callNative<AppMetadata>('get_app_metadata', undefined, async () => ({
    name: brand.productName,
    version: '0.2.0',
    releaseChannel: 'pre-release',
    buildProfile: 'browser',
    updateStatus: 'manual',
    releaseNotesUrl: 'https://github.com/theantipopau/pccompanion/releases',
  }));
}

export type LocalAiSetupAction = 'install_ollama' | 'pull_model' | 'start_runtime';

export async function runLocalAiSetup(action: LocalAiSetupAction, model?: string): Promise<string> {
  return callNative<string>(
    'run_local_ai_setup',
    { action, model },
    async () => `[browser] Local AI setup action '${action}' is available in desktop mode only.`,
  );
}

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
  return callNative<boolean>('set_startup_enabled', { enabled, startMinimized: true }, async () => enabled);
}

export async function setStartupMode(enabled: boolean, startMinimized: boolean): Promise<boolean> {
  return callNative<boolean>('set_startup_enabled', { enabled, startMinimized }, async () => enabled);
}

export async function setCloseToTray(enabled: boolean): Promise<void> {
  return callNative<void>('set_close_to_tray', { enabled }, async () => undefined);
}

export async function setMinimizeToTrayOnMinimize(enabled: boolean): Promise<void> {
  return callNative<void>('set_minimize_to_tray_on_minimize', { enabled }, async () => undefined);
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

export async function startStorageCleanupScan(): Promise<StorageScanStatus> {
  return callNative<StorageScanStatus>(
    'start_storage_cleanup_scan',
    undefined,
    async () => ({
      running: true,
      completed: false,
      cancelled: false,
      progressPct: 0,
      currentStep: 0,
      totalSteps: 11,
      message: 'Starting storage scan',
    }),
  );
}

export async function getStorageCleanupScanStatus(): Promise<StorageScanStatusPayload> {
  return callNative<StorageScanStatusPayload>(
    'get_storage_cleanup_scan_status',
    undefined,
    async () => ({
      status: {
        running: false,
        completed: true,
        cancelled: false,
        progressPct: 100,
        currentStep: 11,
        totalSteps: 11,
        message: 'Storage scan complete',
      },
      items: mockStorageCleanupItems(),
    }),
  );
}

export async function cancelStorageCleanupScan(): Promise<StorageScanStatus> {
  return callNative<StorageScanStatus>(
    'cancel_storage_cleanup_scan',
    undefined,
    async () => ({
      running: false,
      completed: false,
      cancelled: true,
      progressPct: 0,
      currentStep: 0,
      totalSteps: 11,
      message: 'Storage scan cancelled',
    }),
  );
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

export async function listRegistryBackups(): Promise<RegistryBackup[]> {
  return callNative<RegistryBackup[]>('list_registry_backups', undefined, async () => []);
}

export function createDiagnosticsExportContext({
  settings,
  systemInfo,
  sample,
  presentationLabel,
}: {
  settings: CompanionSettings;
  systemInfo: SystemInfo | null;
  sample: HardwareSample | null;
  presentationLabel: string;
}): DiagnosticsExportContext {
  return {
    providedAt: new Date().toISOString(),
    buildIdentity: settings.buildIdentity,
    interfaceMode: settings.experience.interfaceMode,
    performanceProfile: settings.experience.performanceProfile,
    performanceMode: settings.experience.performanceMode,
    monitoring: {
      enabled: settings.monitoring.launchOnStartup,
      refreshMs: settings.monitoring.refreshMs,
      backgroundRefreshMs: settings.monitoring.backgroundRefreshMs,
      historyLimit: settings.monitoring.historyLimit,
      temperatureUnit: settings.monitoring.temperatureUnit,
    },
    alerts: settings.alerts,
    overlay: {
      enabled: settings.overlay.enabled,
      preset: settings.overlay.preset,
      metrics: settings.overlay.metrics,
    },
    tray: {
      minimizeToTray: settings.tray.minimizeToTray,
      minimizeOnMinimize: settings.tray.minimizeOnMinimize,
      showLiveTooltip: settings.tray.showLiveTooltip,
      liveIconMetric: settings.tray.liveIconMetric,
    },
    hardwareIdentity: systemInfo,
    telemetry: {
      presentationLabel,
      rawSampleState: sample?.state ?? 'pending',
      sampleTimestamp: sample?.timestamp ?? null,
    },
    recentActions: readCompanionActions().slice(0, 10).map(({ timestamp, category, label, detail }) => ({
      timestamp,
      category,
      label,
      detail,
    })),
  };
}

export async function exportDiagnostics(frontendContext?: DiagnosticsExportContext): Promise<DiagnosticsExport> {
  return callNative<DiagnosticsExport>('export_diagnostics', { frontendContext: frontendContext ?? null }, async () => ({
    path: 'Browser preview only',
    createdAt: new Date().toLocaleString(),
    message: frontendContext
      ? 'Native diagnostics export is available in the Tauri desktop app. Radium support context prepared for desktop export.'
      : 'Native diagnostics export is available in the Tauri desktop app.',
    sections: frontendContext
      ? ['Radium build identity', 'Frontend support context', 'System identity', 'Telemetry sample', 'Capability registry', 'Provider orchestration', 'Sensor discovery report', 'OpenRGB discovery']
      : ['System identity', 'Telemetry sample', 'Capability registry', 'Provider orchestration', 'Sensor discovery report', 'OpenRGB discovery'],
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
    sidecarLifecycle: [
      { id: 'bundled', label: 'Sidecar bundled', state: 'staged', detail: 'Desktop package only.' },
      { id: 'runtime', label: 'Runtime launch', state: 'staged', detail: 'Browser preview cannot launch the sidecar.' },
      { id: 'driver', label: 'Low-level driver signal', state: 'driver_required', detail: 'PawnIO validation runs in desktop mode.' },
      { id: 'sensor_rows', label: 'Sensor rows visible', state: 'blocked', detail: 'No hardware sensor rows are visible in browser preview.' },
      { id: 'cpu_package', label: 'CPU package accepted', state: 'driver_required', detail: 'Run desktop mode to validate CPU package matching.' },
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
      issueClassification: 'user_mode_probe_unavailable',
      dellClassHints: [],
      namespaceInventory: [
        {
          namespace: 'ROOT\\WMI',
          available: false,
          status: 'Browser preview has no WMI access',
          matchingClasses: [],
        },
      ],
      gpuAdapters: [
        {
          name: 'Preview adapter',
          vendor: 'unknown',
          adapterRamGb: 0,
          integrated: true,
        },
      ],
      gpuEngineCounterAvailable: false,
      gpuEngineCounterState: 'GPU engine counters unavailable in browser preview',
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

export async function getPlatformTelemetryDiscovery(): Promise<SensorDiscoveryReport> {
  return callNative<SensorDiscoveryReport>('get_platform_telemetry_discovery', undefined, async () => {
    const snapshot = await getTelemetryDiagnostics();
    return snapshot.sensorDiscovery;
  });
}

export async function probeSensorSidecar(): Promise<SensorSidecarProbe> {
  return callNative<SensorSidecarProbe>('probe_sensor_sidecar', undefined, async () => ({
    provider: 'lhm-pawnio',
    available: false,
    driverAvailable: false,
    status: 'browser_preview',
    libraryVersion: null,
    executablePath: null,
    cpuTempC: null,
    cpuTempLabel: null,
    cpuFanRpm: null,
    storageTempC: null,
    notes: ['Browser preview cannot launch the bundled sensor sidecar.'],
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

export async function restartMonitoringEngine(): Promise<string> {
  return callNative<string>('restart_monitoring_engine', undefined, async () => '[browser] monitoring engine restart requested');
}

export async function discoverRgbDevices(): Promise<RgbDiscovery> {
  return callNative<RgbDiscovery>('discover_rgb_devices', undefined, async () => ({
    provider: 'OpenRGB',
    endpoint: '127.0.0.1:6742',
    state: 'unavailable',
    protocolVersion: null,
    controllerCount: 0,
    controllers: [],
    message: 'OpenRGB SDK discovery is available in the Tauri desktop app.',
    writeSafe: false,
    warnings: ['Phase 1 is read-only and localhost-only.'],
  }));
}

export async function getHardwareCapabilities(): Promise<HardwareCapability[]> {
  return callNative<HardwareCapability[]>('get_hardware_capabilities', undefined, async () => [
    { id: 'cpu-temp', label: 'CPU package telemetry', state: 'partial', detail: 'Browser preview mode', writeSafe: false },
    { id: 'gpu-intel-arc', label: 'Intel Arc telemetry', state: 'partial', detail: 'WMI fallback only', writeSafe: false },
    { id: 'superio-ec', label: 'SuperIO / EC access', state: 'unknown', detail: 'Capability registry pending', writeSafe: false },
  ]);
}
