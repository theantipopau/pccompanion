import type { HardwareSample, SystemInfo } from '../types/system';
import type { CompanionActionRecord } from './actionHistory';
import { brand } from './branding';

export type CopilotModelSuggestion = {
  title: string;
  modelTag: string;
  runtime: 'Ollama';
  sizeClass: string;
  bestFor: 'general' | 'coding';
  notes: string;
};

export type CopilotRecommendation = {
  tier: 'entry' | 'balanced' | 'power';
  summary: string;
  general: CopilotModelSuggestion;
  coding: CopilotModelSuggestion;
  notes: string[];
};

export type CopilotInsightConfidence = 'high' | 'medium' | 'needs_more_data';

export type CopilotInsightCard = {
  id: string;
  title: string;
  summary: string;
  confidence: CopilotInsightConfidence;
  signals: string[];
  suggestedAction: string;
  tone: 'green' | 'amber' | 'red' | 'cyan';
};

export function buildCopilotRecommendation(systemInfo: SystemInfo | null, sample: HardwareSample | null): CopilotRecommendation {
  const ramGb = sample?.memory.totalGb ?? parseRamGb(systemInfo?.ram);
  const vramGb = sample?.gpu.vramTotalGb ?? 0;
  const cpuVendor = (systemInfo?.cpuVendor ?? sample?.gpu.vendor ?? 'unknown').toUpperCase();
  const gpuName = sample?.gpu.name ?? systemInfo?.gpu ?? 'Unknown GPU';

  if (ramGb >= 32 || (ramGb >= 24 && vramGb >= 8)) {
    return {
      tier: 'power',
      summary: `Power tier detected (${ramGb.toFixed(0)} GB RAM, ${vramGb.toFixed(0)} GB VRAM, ${cpuVendor}).`,
      general: {
        title: 'General assistant (quality first)',
        modelTag: 'qwen2.5:7b-instruct-q4_K_M',
        runtime: 'Ollama',
        sizeClass: '7B quantized',
        bestFor: 'general',
        notes: 'Strong local reasoning quality while still practical on high-end desktops.',
      },
      coding: {
        title: 'Coding assistant (offline dev help)',
        modelTag: 'qwen2.5-coder:7b-instruct-q4_K_M',
        runtime: 'Ollama',
        sizeClass: '7B quantized',
        bestFor: 'coding',
        notes: 'Better code completion and refactor quality than tiny models for most local projects.',
      },
      notes: [
        `Detected GPU: ${gpuName}`,
        'Use 8k context first for responsiveness, then increase if RAM headroom remains.',
        'Keep model downloads local and optional; no cloud dependency required.',
      ],
    };
  }

  if (ramGb >= 16) {
    return {
      tier: 'balanced',
      summary: `Balanced tier detected (${ramGb.toFixed(0)} GB RAM, ${vramGb.toFixed(0)} GB VRAM, ${cpuVendor}).`,
      general: {
        title: 'General assistant (fast local chat)',
        modelTag: 'llama3.2:3b-instruct-q4_K_M',
        runtime: 'Ollama',
        sizeClass: '3B quantized',
        bestFor: 'general',
        notes: 'Good speed and acceptable quality for day-to-day support and explanation tasks.',
      },
      coding: {
        title: 'Coding assistant (lightweight)',
        modelTag: 'qwen2.5-coder:3b-instruct-q4_K_M',
        runtime: 'Ollama',
        sizeClass: '3B quantized',
        bestFor: 'coding',
        notes: 'Reliable for snippets and debugging guidance without large memory pressure.',
      },
      notes: [
        `Detected GPU: ${gpuName}`,
        'Start with CPU inference if VRAM is limited, then test GPU offload as optional.',
        'Keep one model loaded at a time to avoid memory spikes.',
      ],
    };
  }

  return {
    tier: 'entry',
    summary: `Entry tier detected (${ramGb.toFixed(0)} GB RAM, ${vramGb.toFixed(0)} GB VRAM, ${cpuVendor}).`,
    general: {
      title: 'General assistant (ultra-light)',
      modelTag: 'phi3:mini-4k-instruct-q4_K_M',
      runtime: 'Ollama',
      sizeClass: '1B-4B quantized',
      bestFor: 'general',
      notes: 'Fast response and low memory usage for offline help and summaries.',
    },
    coding: {
      title: 'Coding assistant (minimal footprint)',
      modelTag: 'qwen2.5-coder:1.5b-instruct-q4_K_M',
      runtime: 'Ollama',
      sizeClass: '1B-2B quantized',
      bestFor: 'coding',
      notes: 'Use for lightweight coding help; heavy refactors may need a larger model.',
    },
    notes: [
      `Detected GPU: ${gpuName}`,
      'Prefer small quantized models for responsiveness and thermal stability.',
      'Treat this as advisory guidance; users can still select any local model.',
    ],
  };
}

export function buildNonInvasiveInsights(sample: HardwareSample | null, actions: CompanionActionRecord[] = []): CopilotInsightCard[] {
  const actionInsight = buildRecentActionInsight(actions);

  if (!sample) {
    const warmingInsight: CopilotInsightCard = {
      id: 'telemetry-warming',
      title: 'Telemetry warming up',
      summary: 'Local telemetry is not ready yet, so recommendations stay conservative.',
      confidence: 'needs_more_data',
      signals: ['No hardware sample received yet'],
      suggestedAction: 'Keep this page open for 5-10 seconds before acting on advice.',
      tone: 'cyan',
    };
    return [warmingInsight, ...(actionInsight ? [actionInsight] : [])].slice(0, 5);
  }

  const insights: CopilotInsightCard[] = [];

  if (sample.cpu.temperature !== null && sample.cpu.temperature >= 85) {
    insights.push({
      id: 'cpu-temp-high',
      title: 'CPU thermals need attention',
      summary: 'CPU package temperature is elevated for sustained work.',
      confidence: 'high',
      signals: [`CPU package ${Math.round(sample.cpu.temperature)} C`, `CPU load ${Math.round(sample.cpu.usage)}%`],
      suggestedAction: 'Review profile mode and cooling path before heavy workloads.',
      tone: sample.cpu.temperature >= 92 ? 'red' : 'amber',
    });
  } else if (sample.cpu.temperature === null) {
    insights.push({
      id: 'cpu-temp-missing',
      title: 'CPU package sensor missing',
      summary: 'CPU load is available, but package temperature is not currently measured.',
      confidence: 'medium',
      signals: [`CPU load ${Math.round(sample.cpu.usage)}%`, 'CPU package temperature unavailable'],
      suggestedAction: 'Open Telemetry Diagnostics to inspect provider and sidecar state.',
      tone: 'amber',
    });
  }

  if (sample.gpu.temperature !== null && sample.gpu.temperature >= 82) {
    insights.push({
      id: 'gpu-temp-high',
      title: 'GPU thermals are running hot',
      summary: 'GPU temperature is high under the current load.',
      confidence: 'high',
      signals: [`GPU ${Math.round(sample.gpu.temperature)} C`, `Provider ${sample.gpu.provider}`, `GPU load ${Math.round(sample.gpu.usage)}%`],
      suggestedAction: 'Check airflow, dust filters, and sustained boost settings.',
      tone: sample.gpu.temperature >= 88 ? 'red' : 'amber',
    });
  }

  if (sample.memory.usage >= 86) {
    insights.push({
      id: 'ram-pressure',
      title: 'RAM pressure is high',
      summary: 'Memory usage is high enough to affect responsiveness.',
      confidence: 'high',
      signals: [`RAM ${Math.round(sample.memory.usage)}%`, `${sample.memory.usedGb.toFixed(1)} / ${sample.memory.totalGb.toFixed(1)} GB used`],
      suggestedAction: 'Close background apps or run RAM Cleaner if the system feels sluggish.',
      tone: sample.memory.usage >= 94 ? 'red' : 'amber',
    });
  }

  const fullestDrive = sample.storage.reduce((current, drive) => (drive.usedPercent > current.usedPercent ? drive : current), { label: '', usedPercent: 0 });
  if (fullestDrive.usedPercent >= 88) {
    insights.push({
      id: 'storage-headroom',
      title: 'Storage headroom is low',
      summary: 'At least one drive is close to the point where updates and game installs can struggle.',
      confidence: 'high',
      signals: [`${fullestDrive.label || 'Highest drive'} ${Math.round(fullestDrive.usedPercent)}% used`],
      suggestedAction: 'Open System Cleaner and review safe cleanup targets first.',
      tone: fullestDrive.usedPercent >= 94 ? 'red' : 'amber',
    });
  }

  if (sample.cpu.usage >= 90 && sample.gpu.usage < 60) {
    insights.push({
      id: 'cpu-bound-workload',
      title: 'Current workload looks CPU-bound',
      summary: 'CPU usage is much higher than GPU usage, so local model responsiveness may depend on CPU headroom.',
      confidence: 'medium',
      signals: [`CPU load ${Math.round(sample.cpu.usage)}%`, `GPU load ${Math.round(sample.gpu.usage)}%`],
      suggestedAction: 'Prefer smaller models or lower context sizes while this workload is active.',
      tone: 'cyan',
    });
  }

  if (sample.state !== 'valid') {
    insights.push({
      id: 'telemetry-degraded',
      title: 'Telemetry confidence is limited',
      summary: `Current telemetry state is ${sample.state}. Recommendations may be provisional until sensors stabilize.`,
      confidence: 'needs_more_data',
      signals: [`Telemetry state ${sample.state}`, `GPU provider ${sample.gpu.provider}`],
      suggestedAction: 'Use Diagnostics to confirm which sensors are live before tuning.',
      tone: 'amber',
    });
  }

  if (actionInsight) {
    insights.push(actionInsight);
  }

  if (insights.length === 0) {
    insights.push({
      id: 'stable-baseline',
      title: 'System telemetry looks stable',
      summary: 'No urgent thermal, memory, storage, or telemetry issues are visible in the current sample.',
      confidence: 'high',
      signals: [`Telemetry state ${sample.state}`, `RAM ${Math.round(sample.memory.usage)}%`, `GPU provider ${sample.gpu.provider}`],
      suggestedAction: 'Local AI can stay in advisory mode with no background automation enabled.',
      tone: 'green',
    });
  }

  return insights.slice(0, 5);
}

export function buildCopilotContextPack(
  systemInfo: SystemInfo | null,
  sample: HardwareSample | null,
  insights: CopilotInsightCard[],
  actions: CompanionActionRecord[] = [],
): string {
  const lines: string[] = [];

  lines.push(`${brand.shortName} local context (offline):`);
  lines.push('- Policy: advisory only, never perform hidden automation, suggest reversible actions first.');

  if (systemInfo) {
    lines.push(`- System: CPU ${systemInfo.cpu}; GPU ${systemInfo.gpu}; RAM ${systemInfo.ram}; Windows ${systemInfo.windows}.`);
  } else {
    lines.push('- System: identity not available yet.');
  }

  if (sample) {
    lines.push(`- Telemetry state: ${sample.state}.`);
    lines.push(`- CPU: usage ${Math.round(sample.cpu.usage)}%, temp ${sample.cpu.temperature ?? 'n/a'} C.`);
    lines.push(`- GPU: usage ${Math.round(sample.gpu.usage)}%, temp ${sample.gpu.temperature ?? 'n/a'} C, provider ${sample.gpu.provider}.`);
    lines.push(`- Memory: ${sample.memory.usedGb.toFixed(1)} / ${sample.memory.totalGb.toFixed(1)} GB (${Math.round(sample.memory.usage)}%).`);
    lines.push(`- Network: down ${sample.network.downMbps.toFixed(0)} Mbps, up ${sample.network.upMbps.toFixed(0)} Mbps.`);
  } else {
    lines.push('- Telemetry: sample not available yet.');
  }

  if (insights.length > 0) {
    lines.push('- Current local insights:');
    insights.forEach((entry) => {
      lines.push(`  - ${entry.title} (${confidenceLabel(entry.confidence)}): ${entry.summary}`);
      lines.push(`    Suggested action: ${entry.suggestedAction}`);
    });
  }

  const recentActions = actions.slice(0, 6);
  if (recentActions.length > 0) {
    lines.push('- Recent local Companion actions:');
    recentActions.forEach((action) => {
      lines.push(`  - ${action.timestamp}: ${action.category} - ${action.label} (${action.detail})`);
    });
  } else {
    lines.push('- Recent local Companion actions: none recorded.');
  }

  lines.push('- Output style: concise, practical, and non-invasive.');
  return lines.join('\n');
}

export function confidenceLabel(confidence: CopilotInsightConfidence): string {
  if (confidence === 'high') return 'High confidence';
  if (confidence === 'medium') return 'Medium confidence';
  return 'Needs more data';
}

function parseRamGb(value: string | undefined): number {
  if (!value) return 16;
  const match = value.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (!match) return 16;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 16;
}

function buildRecentActionInsight(actions: CompanionActionRecord[]): CopilotInsightCard | null {
  const recent = actions.slice(0, 8);
  if (recent.length === 0) return null;

  const latest = recent[0];
  const maintenanceCount = countCategory(recent, 'maintenance');
  const profileCount = countCategory(recent, 'profile');
  const diagnosticCount = countCategory(recent, 'diagnostics') + countCategory(recent, 'support');
  const hasFailure = recent.some((action) => /fail|error|denied|blocked/i.test(`${action.label} ${action.detail}`));

  if (hasFailure) {
    return {
      id: 'recent-action-needs-review',
      title: 'Recent action needs review',
      summary: 'The local action history includes a failed or blocked operation that may matter for troubleshooting.',
      confidence: 'medium',
      signals: [`Latest: ${latest.label}`, `${recent.length} recent action${recent.length === 1 ? '' : 's'}`],
      suggestedAction: 'Review About > Local history and export diagnostics before retrying the same workflow.',
      tone: 'amber',
    };
  }

  if (maintenanceCount > 0) {
    return {
      id: 'recent-maintenance-context',
      title: 'Maintenance history is available',
      summary: 'Recent cleanup or restore activity can be used as local support context if behavior changed afterwards.',
      confidence: 'medium',
      signals: [`${maintenanceCount} maintenance action${maintenanceCount === 1 ? '' : 's'}`, `Latest: ${latest.label}`],
      suggestedAction: 'Keep the context pack attached when asking about cleanup side effects or support next steps.',
      tone: 'cyan',
    };
  }

  if (profileCount > 0) {
    return {
      id: 'recent-profile-context',
      title: 'Profile changes are in context',
      summary: 'Recent performance profile activity is available for comparing thermals, noise, and responsiveness.',
      confidence: 'medium',
      signals: [`${profileCount} profile action${profileCount === 1 ? '' : 's'}`, `Latest: ${latest.label}`],
      suggestedAction: 'Run two Benchmark captures if you want proof that a profile change helped.',
      tone: 'green',
    };
  }

  if (diagnosticCount > 0) {
    return {
      id: 'recent-support-context',
      title: 'Support context is ready',
      summary: 'Recent diagnostics or support-bundle actions can help explain sensor and startup behavior.',
      confidence: 'medium',
      signals: [`${diagnosticCount} support action${diagnosticCount === 1 ? '' : 's'}`, `Latest: ${latest.label}`],
      suggestedAction: 'Use the attached context pack for local chat or include the diagnostics bundle when contacting support.',
      tone: 'cyan',
    };
  }

  return {
    id: 'recent-actions-context',
    title: 'Recent actions are in context',
    summary: 'The local CoPilot can include recent Companion activity when answering workflow questions.',
    confidence: 'medium',
    signals: [`${recent.length} recent action${recent.length === 1 ? '' : 's'}`, `Latest: ${latest.label}`],
    suggestedAction: 'Ask follow-up questions with the safe local context pack enabled.',
    tone: 'cyan',
  };
}

function countCategory(actions: CompanionActionRecord[], category: CompanionActionRecord['category']): number {
  return actions.filter((action) => action.category === category).length;
}
