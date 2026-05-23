export type TrayMetric = 'cpuTemp' | 'gpuTemp' | 'ramUsage' | 'cpuUsage' | 'gpuUsage' | 'disabled';

export type ProcessInfo = {
  pid: number;
  name: string;
  cpuPct: number;
  memMb: number;
  status: string;
};

export type MetricState = 'valid' | 'inactive' | 'unavailable' | 'stale' | 'degraded';

export type Vendor = 'intel' | 'amd' | 'nvidia' | 'unknown';

export type MetricPoint = {
  time: string;
  cpuTemp: number;
  cpuUsage: number;
  gpuTemp: number;
  gpuUsage: number;
  ramUsage: number;
  networkDown: number;
};

export type SystemInfo = {
  cpu: string;
  cpuVendor: Vendor;
  gpu: string;
  gpuVendor: Vendor;
  motherboard: string;
  ram: string;
  ramSpeed: string;
  storage: string[];
  psu: string;
  windows: string;
  bios: string;
};

export type HardwareSample = {
  timestamp: number;
  state: MetricState;
  cpu: {
    temperature: number | null;
    usage: number;
    clockMhz: number;
  };
  gpu: {
    temperature: number | null;
    usage: number;
    vramUsedGb: number;
    vramTotalGb: number;
    coreClockMhz: number;
    memoryClockMhz: number;
    fanPct: number | null;
    powerWatts: number | null;
  };
  memory: {
    usedGb: number;
    totalGb: number;
    usage: number;
  };
  fans: Array<{ label: string; rpm: number | null; pct: number | null }>;
  storage: Array<{ label: string; usedPercent: number; temperature: number | null; driveType: 'ssd' | 'hdd' | 'nvme' | 'unknown' }>;
  network: {
    downMbps: number;
    upMbps: number;
    adapterName: string;
    adapterType: 'wifi' | 'ethernet' | 'unknown';
  };
  history: MetricPoint[];
};

export type RamCleanupResult = {
  beforeGb: number;
  afterGb: number;
  freedGb: number;
  mode: 'safe' | 'deep';
  message: string;
};

export type BloatwareCategory = 'Safe' | 'Advanced' | 'Gaming focused' | 'OEM cleanup' | 'Third-party';

export type BloatwareItem = {
  id: string;
  name: string;
  category: BloatwareCategory;
  publisher: string;
  risk: 'low' | 'medium' | 'high';
  detected: boolean;
  selected: boolean;
  description: string;
  action: 'appx' | 'startup' | 'service' | 'scheduled-task' | 'policy';
};

export type OverlayPreset = 'compact-bar' | 'corner-widget' | 'vertical-list' | 'minimal-card' | 'cinematic' | 'benchmark';

export type PerformanceMode = 'balanced' | 'performance' | 'quiet';

export type CompanionSettings = {
  theme: 'radium-dark' | 'midnight' | 'graphite';
  tray: {
    minimizeToTray: boolean;
    startWithWindows: boolean;
    silentBackground: boolean;
    showLiveTooltip: boolean;
    liveIconMetric: TrayMetric;
  };
  overlay: {
    enabled: boolean;
    clickThrough: boolean;
    preset: OverlayPreset;
    opacity: number;
    scale: number;
    position: { x: number; y: number };
    metrics: Array<'cpuTemp' | 'cpuUsage' | 'gpuTemp' | 'gpuUsage' | 'ramUsage' | 'vramUsage' | 'fps' | 'fans' | 'clocks'>;
  };
  monitoring: {
    refreshMs: number;
    backgroundRefreshMs: number;
    historyLimit: number;
    temperatureUnit: 'c' | 'f';
  };
  experience: {
    compactMode: boolean;
    animations: boolean;
    performanceMode: PerformanceMode;
  };
};

export type TrayStatus = {
  tooltip: string;
  mode: PerformanceMode;
  overlayEnabled: boolean;
};

export type StartupItem = {
  id: string;
  name: string;
  publisher: string;
  command: string;
  location: string; // e.g. "Registry (HKCU\\Run)", "Startup folder", "Service"
  impact: 'low' | 'medium' | 'high';
  enabled: boolean;
  recommended: 'keep' | 'optional' | 'review';
};

export type StorageCleanupItem = {
  id: string;
  name: string;
  location: string;
  sizeGb: number;
  category: 'Temporary' | 'Cache' | 'Downloads' | 'Logs' | 'Shaders' | 'Browser' | 'Recycle Bin' | 'Windows Update';
  selected: boolean;
  safe: boolean;
  description: string;
};

export type RegistryIssue = {
  id: string;
  hive: 'HKCU' | 'HKLM' | 'HKCR' | 'HKU';
  keyPath: string;
  valueName: string;
  category: 'Missing file reference' | 'Uninstall leftover' | 'Invalid startup reference' | 'Obsolete file association' | 'Application path';
  severity: 'low' | 'medium' | 'high';
  selected: boolean;
  safe: boolean;
  description: string;
};

export type RegistryBackup = {
  id: string;
  createdAt: string;
  path: string;
  issueCount: number;
};

export type TelemetryConfidence = 'high' | 'medium' | 'low' | 'unknown';

export type CapabilityState = 'live' | 'partial' | 'degraded' | 'staged' | 'unsupported' | 'blocked' | 'elevated_required' | 'driver_required' | 'unknown';

export type HardwareCapability = {
  id: string;
  label: string;
  state: CapabilityState;
  detail: string;
  writeSafe: boolean;
};

export type ProviderState = 'loaded' | 'staged' | 'degraded' | 'unavailable';

export type ProviderDiagnostics = {
  id: string;
  label: string;
  vendor: string;
  loadOrder: number;
  state: ProviderState;
  active: boolean;
  dll: string;
  dllAvailable: boolean;
  symbolsResolved: boolean;
  symbols: string[];
  notes: string;
  warnings: string[];
  errors: string[];
};

export type SensorProvenance = {
  id: string;
  sensor: string;
  provider: string;
  providerState: ProviderState | CapabilityState;
  state: CapabilityState;
  confidence: TelemetryConfidence;
  telemetryQuality: string;
  fallbackStatus: string;
  notes: string;
  oemSupportStatus: string;
  icon: string;
};

export type TelemetryDiagnosticsSnapshot = {
  createdAt: string;
  overallState: string;
  activeProvider: string;
  fallbackSequence: string[];
  providerLoadOrder: string[];
  providers: ProviderDiagnostics[];
  capabilities: HardwareCapability[];
  sensors: SensorProvenance[];
  supportSnapshot: string[];
  supportActions: string[];
  hardwareIdentity: SystemInfo;
  sample: HardwareSample;
};

export type DiagnosticsExport = {
  path: string;
  createdAt: string;
  message: string;
  sections: string[];
  providerCount: number;
  capabilityCount: number;
  sensorCount: number;
};

export type PerformanceProfileId = 'quiet' | 'balanced' | 'gaming' | 'creator';

export type PerformanceProfile = {
  id: PerformanceProfileId;
  name: string;
  summary: string;
  selected: boolean;
  recommendedFor: string;
  fanIntent: 'quiet' | 'balanced' | 'aggressive';
  powerIntent: 'efficiency' | 'balanced' | 'performance';
  estimatedNoise: 'low' | 'medium' | 'high';
  safeMode: boolean;
};

export type PerformanceProfileResult = {
  appliedProfile: PerformanceProfileId;
  appliedAt: string;
  message: string;
  actions: string[];
};

