import type {
  BloatwareItem,
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
  Vendor,
} from '../types/system';
import { brand } from '../lib/branding';

const start = Date.now();

function wave(base: number, amp: number, speed: number, offset = 0) {
  const t = (Date.now() - start) / 1000;
  return base + Math.sin(t / speed + offset) * amp;
}

function guessCpuVendor(cpu: string): Vendor {
  const lower = cpu.toLowerCase();
  if (lower.includes('intel')) return 'intel';
  if (lower.includes('amd') || lower.includes('ryzen')) return 'amd';
  return 'unknown';
}

export function mockSystemInfo(): SystemInfo {
  const cpu = navigator.hardwareConcurrency >= 16 ? 'AMD Ryzen 9 / Intel Core i9 class CPU' : 'Modern multi-core desktop CPU';
  return {
    cpu,
    cpuVendor: guessCpuVendor(cpu),
    gpu: 'NVIDIA GeForce RTX class GPU',
    gpuVendor: 'nvidia',
    motherboard: brand.mode === 'demo' ? 'Custom builder performance motherboard' : 'Radium validated performance motherboard',
    ram: '32 GB DDR5',
    ramSpeed: '6000 MT/s',
    storage: ['2 TB NVMe Gen4 SSD', '4 TB game library drive'],
    psu: 'Detected by build profile where available',
    windows: 'Windows 11',
    bios: 'UEFI firmware detected',
    gpuDriverVersion: '560.94',
    chipsetDriverVersion: '',
  };
}

export function mockHardwareSample(existingHistory: MetricPoint[] = []): HardwareSample {
  const now = new Date();
  const cpuUsage = Math.round(wave(36, 18, 2.8, 0.2));
  const gpuUsage = Math.round(wave(29, 24, 3.6, 1.8));
  const ramUsage = Math.round(wave(51, 7, 7.5, 2.3));
  const cpuTemp = Math.round(wave(58, 8, 4.2));
  const gpuTemp = Math.round(wave(54, 10, 5.1, 1.1));
  const networkDown = Math.max(0.2, wave(18, 14, 2.3, 0.9));
  const point: MetricPoint = {
    time: now.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
    cpuTemp,
    cpuUsage,
    gpuTemp,
    gpuUsage,
    ramUsage,
    networkDown,
  };
  const history = [...existingHistory, point].slice(-48);

  return {
    timestamp: Date.now(),
    state: 'valid',
    cpu: {
      temperature: cpuTemp,
      usage: cpuUsage,
      clockMhz: Math.round(wave(4850, 340, 2.9, 0.4)),
    },
    gpu: {
      name: 'NVIDIA GeForce RTX 4080 SUPER',
      vendor: 'nvidia',
      provider: 'mock',
      temperature: gpuTemp,
      usage: gpuUsage,
      vramUsedGb: Number((wave(6.8, 1.3, 4.4, 0.8)).toFixed(1)),
      vramTotalGb: 16,
      coreClockMhz: Math.round(wave(2460, 120, 3.1)),
      memoryClockMhz: Math.round(wave(10400, 220, 5.6)),
      fanPct: Math.round(wave(42, 12, 4.8, 1.4)),
      powerWatts: Number(wave(210, 48, 3.8, 0.6).toFixed(0)),
    },
    memory: {
      usedGb: Number((32 * (ramUsage / 100)).toFixed(1)),
      totalGb: 32,
      usage: ramUsage,
    },
    fans: [
      { label: 'CPU cooler', rpm: Math.round(wave(1040, 210, 4.7)), pct: null },
      { label: 'GPU fans', rpm: Math.round(wave(920, 260, 5.2, 1.2)), pct: Math.round(wave(42, 12, 4.8, 1.4)) },
      { label: 'Chassis intake', rpm: Math.round(wave(760, 120, 6.5, 2.8)), pct: null },
    ],
    storage: [
      { label: 'Samsung SSD 990 PRO (2048 GB)', usedPercent: 64, temperature: 42, driveType: 'nvme' as const },
      { label: 'WD_BLACK SN850X (1024 GB)', usedPercent: 48, temperature: 37, driveType: 'nvme' as const },
    ],
    network: {
      downMbps: networkDown,
      upMbps: Math.max(0.1, wave(3.2, 2.2, 3.8, 2.1)),
      adapterName: 'Intel Wi-Fi 7 BE200',
      adapterType: 'wifi' as const,
    },
    history,
  };
}

export function mockRamCleanup(): Promise<RamCleanupResult> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const beforeGb = Number((wave(16.8, 1.4, 3.5)).toFixed(1));
      const freedGb = Number((1.2 + Math.random() * 1.8).toFixed(1));
      resolve({
        beforeGb,
        afterGb: Number(Math.max(beforeGb - freedGb, 8).toFixed(1)),
        freedGb,
        mode: 'safe',
        message: 'Released standby lists and prompted idle working sets. No services or user processes were terminated.',
      });
    }, 1150);
  });
}

export function mockBloatwareItems(): BloatwareItem[] {
  return [
    {
      id: 'xbox-game-bar-extras',
      name: 'Xbox social and capture extras',
      category: 'Gaming focused',
      publisher: 'Microsoft',
      risk: 'low',
      detected: true,
      selected: true,
      action: 'appx',
      description: 'Optional companion packages that are safe to remove when the owner does not use Xbox capture or social overlays.',
    },
    {
      id: 'consumer-experience',
      name: 'Consumer suggestions',
      category: 'Safe',
      publisher: 'Windows policy',
      risk: 'low',
      detected: true,
      selected: true,
      action: 'policy',
      description: 'Disables app suggestions and promoted content surfaces supported by Windows policy.',
    },
    {
      id: 'cortana-remnants',
      name: 'Cortana remnants',
      category: 'Advanced',
      publisher: 'Microsoft',
      risk: 'medium',
      detected: false,
      selected: false,
      action: 'appx',
      description: 'Legacy assistant packages can be removed on systems where they are still present.',
    },
    {
      id: 'oem-trialware',
      name: 'OEM trialware scan',
      category: 'OEM cleanup',
      publisher: 'Multiple',
      risk: 'medium',
      detected: true,
      selected: false,
      action: 'startup',
      description: 'Flags vendor updaters, launchers, and trial startup entries for owner review before any change is applied.',
    },
    {
      id: 'unused-scheduled-tasks',
      name: 'Unused promotional tasks',
      category: 'Safe',
      publisher: 'Multiple',
      risk: 'low',
      detected: true,
      selected: true,
      action: 'scheduled-task',
      description: 'Detects non-critical scheduled tasks commonly used by consumer app promotions.',
    },
  ];
}

export function mockStartupItems(): StartupItem[] {
  return [
    {
      id: 'steam',
      name: 'Steam Client Bootstrapper',
      publisher: 'Valve',
      command: 'steam.exe -silent',
      location: 'Registry',
      impact: 'medium',
      enabled: true,
      recommended: 'optional',
    },
    {
      id: 'discord',
      name: 'Discord',
      publisher: 'Discord Inc.',
      command: 'Update.exe --processStart Discord.exe',
      location: 'Registry',
      impact: 'high',
      enabled: true,
      recommended: 'optional',
    },
    {
      id: 'gpu-driver',
      name: 'NVIDIA Display Container',
      publisher: 'NVIDIA',
      command: 'NVDisplay.Container.exe',
      location: 'Service',
      impact: 'low',
      enabled: true,
      recommended: 'keep',
    },
    {
      id: 'trial-updater',
      name: 'Legacy Trial Updater',
      publisher: 'Unknown',
      command: 'trial-notifier.exe',
      location: 'Scheduled task',
      impact: 'medium',
      enabled: true,
      recommended: 'review',
    },
  ];
}

export function mockStorageCleanupItems(): StorageCleanupItem[] {
  return [
    {
      id: 'windows-temp',
      name: 'Windows temporary files',
      location: '%TEMP%',
      sizeGb: 2.4,
      category: 'Temporary',
      selected: true,
      safe: true,
      description: 'Short-lived installer and application temp files safe to remove when apps are closed.',
    },
    {
      id: 'shader-cache',
      name: 'GPU shader caches',
      location: 'NVIDIA/AMD shader cache folders',
      sizeGb: 3.1,
      category: 'Shaders',
      selected: true,
      safe: true,
      description: 'Games may rebuild these caches on first launch after cleanup.',
    },
    {
      id: 'windows-update-cache',
      name: 'Windows update delivery cache',
      location: 'SoftwareDistribution\\Download',
      sizeGb: 4.8,
      category: 'Windows Update',
      selected: false,
      safe: true,
      description: 'Can reclaim space after updates settle; requires elevated native cleanup later.',
    },
    {
      id: 'edge-cache',
      name: 'Microsoft Edge cache',
      location: 'LocalAppData\\Microsoft\\Edge\\User Data\\Default\\Cache',
      sizeGb: 1.8,
      category: 'Browser',
      selected: true,
      safe: true,
      description: 'Browser cache files. Cookies, history, and saved sessions are intentionally excluded.',
    },
    {
      id: 'discord-cache',
      name: 'Discord cache',
      location: 'AppData\\discord\\Cache',
      sizeGb: 0.9,
      category: 'App cache',
      selected: true,
      safe: true,
      description: 'Application cache only. Account data and settings are intentionally excluded.',
    },
    {
      id: 'thumbnail-cache',
      name: 'Windows thumbnail cache',
      location: 'LocalAppData\\Microsoft\\Windows\\Explorer',
      sizeGb: 0.4,
      category: 'Explorer',
      selected: true,
      safe: true,
      description: 'Explorer thumbnail databases. Windows rebuilds these automatically.',
    },
    {
      id: 'recycle-bin',
      name: 'Recycle Bin',
      location: '$Recycle.Bin',
      sizeGb: 5.4,
      category: 'Recycle Bin',
      selected: false,
      safe: false,
      description: 'Owner review recommended because files cannot be restored after emptying without backups.',
    },
    {
      id: 'downloads-review',
      name: 'Large downloads review',
      location: 'Downloads',
      sizeGb: 12.6,
      category: 'Downloads',
      selected: false,
      safe: false,
      description: 'Owner review only. Companion should never delete personal files without explicit selection.',
    },
    {
      id: 'diagnostic-logs',
      name: 'Old diagnostic logs',
      location: `ProgramData\\${brand.productName}\\logs`,
      sizeGb: 0.7,
      category: 'Logs',
      selected: true,
      safe: true,
      description: 'Rotated app logs older than the retention window.',
    },
  ];
}

export function mockRegistryIssues(): RegistryIssue[] {
  return [
    {
      id: 'startup-missing-helper',
      hive: 'HKCU',
      keyPath: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run',
      valueName: 'OldHelper',
      category: 'Invalid startup reference',
      severity: 'low',
      selected: true,
      safe: true,
      description: 'Startup entry points to a file that no longer exists.',
    },
    {
      id: 'uninstall-leftover-suite',
      hive: 'HKLM',
      keyPath: 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\LegacySuite',
      valueName: 'DisplayIcon',
      category: 'Uninstall leftover',
      severity: 'medium',
      selected: true,
      safe: true,
      description: 'Uninstall metadata remains for software that appears to have been removed.',
    },
    {
      id: 'file-association-orphan',
      hive: 'HKCR',
      keyPath: '.oldproj\\OpenWithProgids',
      valueName: 'Legacy.ProjectFile',
      category: 'Obsolete file association',
      severity: 'low',
      selected: false,
      safe: true,
      description: 'File association references an application class that is no longer registered.',
    },
    {
      id: 'app-path-missing',
      hive: 'HKLM',
      keyPath: 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\legacytool.exe',
      valueName: '(Default)',
      category: 'Application path',
      severity: 'medium',
      selected: false,
      safe: false,
      description: 'Application path points to a missing executable. Requires review before removal.',
    },
  ];
}

export function mockRegistryBackup(issueCount: number): RegistryBackup {
  return {
    id: `backup-${Date.now()}`,
    createdAt: new Date().toLocaleString(),
    path: `%USERPROFILE%\\Documents\\${brand.productName}\\registry-backups\\backup.reg`,
    issueCount,
  };
}

export function mockPerformanceProfiles(): PerformanceProfile[] {
  return [
    {
      id: 'balanced',
      name: 'Balanced',
      summary: 'Daily performance with restrained fan targets and normal Windows power behaviour.',
      selected: true,
      recommendedFor: 'Everyday gaming, browsing, streaming, and light content work.',
      fanIntent: 'balanced',
      powerIntent: 'balanced',
      estimatedNoise: 'medium',
      safeMode: true,
    },
    {
      id: 'gaming',
      name: 'Gaming',
      summary: 'Prioritises foreground responsiveness, performance plans, and low-latency scheduling.',
      selected: false,
      recommendedFor: 'Competitive gaming, high refresh displays, and GPU-heavy sessions.',
      fanIntent: 'aggressive',
      powerIntent: 'performance',
      estimatedNoise: 'high',
      safeMode: true,
    },
    {
      id: 'creator',
      name: 'Creator',
      summary: 'Favours long-run stability for renders, compiles, encodes, and workstation loads.',
      selected: false,
      recommendedFor: 'Rendering, compiling, simulation, streaming, and production workloads.',
      fanIntent: 'balanced',
      powerIntent: 'performance',
      estimatedNoise: 'medium',
      safeMode: true,
    },
    {
      id: 'quiet',
      name: 'Quiet',
      summary: 'Reduces background aggression and keeps the machine calm for low-intensity work.',
      selected: false,
      recommendedFor: 'Office work, downloads, media playback, and overnight operation.',
      fanIntent: 'quiet',
      powerIntent: 'efficiency',
      estimatedNoise: 'low',
      safeMode: true,
    },
  ];
}

export function mockApplyPerformanceProfile(id: PerformanceProfileId): PerformanceProfileResult {
  return {
    appliedProfile: id,
    appliedAt: new Date().toLocaleString(),
    message: 'Profile intent saved locally. Native power writes run in the desktop app and firmware writes remain capability-gated.',
    actions: [
      'Saved selected profile in Companion settings.',
      'Prepared tray mode and overlay refresh intent.',
      'Desktop build applies Windows power plan, processor policy, and timer resolution.',
      'Firmware, voltage, fan-table, and EC writes remain locked.',
    ],
    validation: {
      status: 'verified',
      expectedPlan: id === 'quiet' ? 'Power Saver' : id === 'balanced' ? 'Balanced' : 'Ultimate/High Performance',
      detectedPlan: id === 'quiet' ? 'Power Saver (preview)' : id === 'balanced' ? 'Balanced (preview)' : 'High Performance (preview)',
      planVerified: true,
      expectedProcessor: id === 'quiet'
        ? 'Processor 5-70%, boost mode 0'
        : id === 'gaming'
          ? 'Processor 10-100%, boost mode 2'
          : id === 'creator'
            ? 'Processor 10-100%, boost mode 1'
            : 'Processor 5-100%, boost mode 1',
      detectedProcessor: 'Preview policy matches selected profile',
      processorVerified: true,
      timerPolicy: id === 'quiet' ? 'Windows default' : id === 'balanced' ? '1.0 ms target' : '0.5 ms target',
      notes: [],
    },
  };
}

export function mockListTopProcesses(limit = 30): ProcessInfo[] {
  const procs: Array<[string, number, number]> = [
    ['System', 0.2, 12],
    ['svchost.exe', 1.4, 78],
    ['explorer.exe', 0.8, 52],
    ['chrome.exe', 8.2, 620],
    ['Code.exe', 5.1, 480],
    ['nvcontainer.exe', 0.6, 38],
    [`${brand.mode === 'demo' ? 'PCCompanionDemo.exe' : 'RadiumCompanion.exe'}`, 0.9, 95],
    ['dwm.exe', 1.2, 42],
    ['csrss.exe', 0.1, 8],
    ['lsass.exe', 0.3, 22],
    ['SearchHost.exe', 0.4, 65],
    ['RuntimeBroker.exe', 0.2, 18],
    ['ctfmon.exe', 0.1, 6],
    ['MsMpEng.exe', 1.1, 180],
    ['audiodg.exe', 0.2, 14],
    ['Discord.exe', 2.3, 290],
    ['steam.exe', 0.7, 110],
    ['OneDrive.exe', 0.3, 48],
    ['Teams.exe', 1.8, 340],
    ['taskhostw.exe', 0.1, 9],
  ];
  return procs.slice(0, limit).map(([name, cpuPct, memMb], i) => ({
    pid: 1000 + i * 4,
    name,
    cpuPct,
    memMb,
    status: 'Run',
  }));
}
