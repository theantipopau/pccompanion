import type { HardwareSample } from '../types/system';

export type ScorePillarId = 'thermal' | 'cpuHeadroom' | 'memoryHeadroom' | 'storageHealth' | 'telemetryConfidence';

export type ScorePillar = {
  id: ScorePillarId;
  label: string;
  score: number;
  weight: number;
  detail: string;
};

export type PerformanceScore = {
  value: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  summary: string;
  pillars: ScorePillar[];
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function gradeFromScore(score: number): PerformanceScore['grade'] {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function summaryFromScore(score: number): string {
  if (score >= 90) return 'Excellent thermal and workload headroom for sustained premium profiles.';
  if (score >= 80) return 'Strong performance profile with minor optimisation opportunities.';
  if (score >= 70) return 'Balanced operating state with moderate optimisation headroom.';
  if (score >= 60) return 'Usable state with clear opportunities to improve stability and responsiveness.';
  return 'Constrained state. Recommend thermal, memory, and storage optimisation first.';
}

function scoreThermals(sample: HardwareSample): ScorePillar {
  const cpu = sample.cpu.temperature;
  const gpu = sample.gpu.temperature;
  const cpuScore = cpu == null ? 62 : clamp(100 - Math.max(0, cpu - 60) * 2.2);
  const gpuScore = gpu == null ? 62 : clamp(100 - Math.max(0, gpu - 65) * 2.0);
  const score = Math.round((cpuScore + gpuScore) / 2);

  return {
    id: 'thermal',
    label: 'Thermal envelope',
    score,
    weight: 0.34,
    detail: `CPU ${cpu == null ? 'n/a' : `${Math.round(cpu)}C`} · GPU ${gpu == null ? 'n/a' : `${Math.round(gpu)}C`}`,
  };
}

function scoreCpuHeadroom(sample: HardwareSample): ScorePillar {
  const score = clamp(Math.round(100 - sample.cpu.usage * 0.9));
  return {
    id: 'cpuHeadroom',
    label: 'CPU headroom',
    score,
    weight: 0.2,
    detail: `${Math.round(sample.cpu.usage)}% active load`,
  };
}

function scoreMemoryHeadroom(sample: HardwareSample): ScorePillar {
  const score = clamp(Math.round(100 - sample.memory.usage));
  return {
    id: 'memoryHeadroom',
    label: 'Memory headroom',
    score,
    weight: 0.18,
    detail: `${sample.memory.usedGb.toFixed(1)} / ${sample.memory.totalGb.toFixed(1)} GB`,
  };
}

function scoreStorageHealth(sample: HardwareSample): ScorePillar {
  if (sample.storage.length === 0) {
    return {
      id: 'storageHealth',
      label: 'Storage health',
      score: 70,
      weight: 0.14,
      detail: 'No storage telemetry available',
    };
  }

  const usageScore = sample.storage
    .map((drive) => clamp(100 - drive.usedPercent * 0.8))
    .reduce((sum, value) => sum + value, 0) / sample.storage.length;

  const tempSignals = sample.storage.filter((drive) => drive.temperature != null);
  const tempScore = tempSignals.length === 0
    ? 74
    : tempSignals
      .map((drive) => clamp(100 - Math.max(0, (drive.temperature as number) - 45) * 2.2))
      .reduce((sum, value) => sum + value, 0) / tempSignals.length;

  const score = clamp(Math.round((usageScore * 0.7) + (tempScore * 0.3)));
  return {
    id: 'storageHealth',
    label: 'Storage health',
    score,
    weight: 0.14,
    detail: `${sample.storage.length} drive${sample.storage.length === 1 ? '' : 's'} monitored`,
  };
}

function scoreTelemetryConfidence(sample: HardwareSample): ScorePillar {
  let available = 0;
  let total = 0;

  const checks = [
    sample.cpu.temperature != null,
    sample.gpu.temperature != null,
    sample.gpu.powerWatts != null,
    sample.gpu.fanPct != null || sample.fans.some((fan) => fan.rpm != null),
    sample.storage.some((drive) => drive.temperature != null),
    sample.network.downMbps >= 0,
  ];

  checks.forEach((ok) => {
    total += 1;
    if (ok) available += 1;
  });

  const score = clamp(Math.round((available / total) * 100));
  return {
    id: 'telemetryConfidence',
    label: 'Telemetry confidence',
    score,
    weight: 0.14,
    detail: `${available}/${total} signal groups live`,
  };
}

export function computePerformanceScore(sample: HardwareSample | null): PerformanceScore {
  if (!sample) {
    return {
      value: 68,
      grade: 'C',
      summary: 'Awaiting first telemetry frame. Score will stabilize after live sampling starts.',
      pillars: [
        { id: 'thermal', label: 'Thermal envelope', score: 65, weight: 0.34, detail: 'Pending sample' },
        { id: 'cpuHeadroom', label: 'CPU headroom', score: 68, weight: 0.2, detail: 'Pending sample' },
        { id: 'memoryHeadroom', label: 'Memory headroom', score: 70, weight: 0.18, detail: 'Pending sample' },
        { id: 'storageHealth', label: 'Storage health', score: 68, weight: 0.14, detail: 'Pending sample' },
        { id: 'telemetryConfidence', label: 'Telemetry confidence', score: 62, weight: 0.14, detail: 'Pending sample' },
      ],
    };
  }

  const pillars = [
    scoreThermals(sample),
    scoreCpuHeadroom(sample),
    scoreMemoryHeadroom(sample),
    scoreStorageHealth(sample),
    scoreTelemetryConfidence(sample),
  ];

  const weighted = pillars.reduce((sum, pillar) => sum + (pillar.score * pillar.weight), 0);
  const value = clamp(Math.round(weighted));

  return {
    value,
    grade: gradeFromScore(value),
    summary: summaryFromScore(value),
    pillars,
  };
}
