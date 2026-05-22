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

export async function setTrayStatus(status: TrayStatus): Promise<void> {
  return callNative<void>('set_tray_status', { status }, async () => undefined);
}

export async function setStartupEnabled(enabled: boolean): Promise<boolean> {
  return callNative<boolean>('set_startup_enabled', { enabled }, async () => enabled);
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

export async function exportDiagnostics(): Promise<DiagnosticsExport> {
  return callNative<DiagnosticsExport>('export_diagnostics', undefined, async () => ({
    path: 'Browser preview only',
    createdAt: new Date().toLocaleString(),
    message: 'Native diagnostics export is available in the Tauri desktop app.',
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
