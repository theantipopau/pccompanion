import type { CompanionSettings, HardwareSample } from '../types/system';

type PresentationAlertInput = {
  isUsable: boolean;
  isLive: boolean;
  label: string;
  state: string;
};

export type HardwareAlertSeverity = 'info' | 'warning' | 'critical';

export type HardwareAlert = {
  id: string;
  title: string;
  detail: string;
  severity: HardwareAlertSeverity;
  actionLabel: string;
  actionView: string;
  evidence: string[];
};

export function buildHardwareAlerts(
  sample: HardwareSample | null,
  presentation: PresentationAlertInput,
  settings: CompanionSettings['alerts'],
): HardwareAlert[] {
  if (!settings.enabled) return [];
  const alerts: HardwareAlert[] = [];
  const sustained = Math.max(1, settings.sustainedSamples);
  const recent = sample?.history.slice(-sustained) ?? [];
  const hasSustainedHistory = recent.length >= sustained;

  if (sample?.cpu.temperature != null && hasSustainedHistory) {
    const sustainedCpu = recent.every((point) => point.cpuTemp >= settings.cpuTempC);
    if (sustainedCpu) {
      alerts.push({
        id: 'cpu-temp',
        title: 'Sustained CPU temperature',
        detail: 'CPU package temperature has stayed above the configured threshold.',
        severity: sample.cpu.temperature >= settings.cpuTempC + 8 ? 'critical' : 'warning',
        actionLabel: 'Open thermals',
        actionView: 'thermals',
        evidence: [Math.round(sample.cpu.temperature) + ' C now', sustained + ' sample window', 'Threshold ' + settings.cpuTempC + ' C'],
      });
    }
  }

  if (sample?.gpu.temperature != null && hasSustainedHistory) {
    const sustainedGpu = recent.every((point) => point.gpuTemp >= settings.gpuTempC);
    if (sustainedGpu) {
      alerts.push({
        id: 'gpu-temp',
        title: 'Sustained GPU temperature',
        detail: 'GPU temperature has stayed above the configured threshold.',
        severity: sample.gpu.temperature >= settings.gpuTempC + 8 ? 'critical' : 'warning',
        actionLabel: 'Open thermals',
        actionView: 'thermals',
        evidence: [Math.round(sample.gpu.temperature) + ' C now', sustained + ' sample window', 'Threshold ' + settings.gpuTempC + ' C'],
      });
    }
  }

  if (sample && hasSustainedHistory) {
    const sustainedMemory = recent.every((point) => point.ramUsage >= settings.ramUsagePct);
    if (sustainedMemory) {
      alerts.push({
        id: 'memory-pressure',
        title: 'Sustained memory pressure',
        detail: 'RAM usage has remained high for the configured sample window.',
        severity: sample.memory.usage >= Math.min(settings.ramUsagePct + 8, 98) ? 'critical' : 'warning',
        actionLabel: 'Open memory cleaner',
        actionView: 'optimizer',
        evidence: [Math.round(sample.memory.usage) + '% RAM used', sustained + ' sample window', 'Threshold ' + settings.ramUsagePct + '%'],
      });
    }
  }

  const maxStorage = sample?.storage.reduce((max, drive) => Math.max(max, drive.usedPercent), 0) ?? 0;
  if (maxStorage >= settings.storageUsedPct) {
    alerts.push({
      id: 'storage-full',
      title: 'Storage headroom low',
      detail: 'At least one drive is above the configured usage threshold.',
      severity: maxStorage >= Math.min(settings.storageUsedPct + 5, 98) ? 'critical' : 'warning',
      actionLabel: 'Open system cleaner',
      actionView: 'storage',
      evidence: [Math.round(maxStorage) + '% highest drive usage', 'Threshold ' + settings.storageUsedPct + '%', 'Cleanup is review-first'],
    });
  }

  if (sample && !presentation.isUsable) {
    alerts.push({
      id: 'telemetry-provider',
      title: 'Telemetry provider confidence low',
      detail: 'The retained telemetry state is not currently support-ready.',
      severity: presentation.isLive ? 'info' : 'warning',
      actionLabel: 'Open diagnostics',
      actionView: 'diagnostics',
      evidence: [presentation.label, presentation.state, 'No hidden upload'],
    });
  }

  return alerts;
}
