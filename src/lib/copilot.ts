import type { HardwareSample, SystemInfo } from '../types/system';

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

export function buildNonInvasiveInsights(sample: HardwareSample | null): string[] {
  if (!sample) {
    return ['Telemetry not ready yet. Keep this page open for 5-10 seconds to build local insights.'];
  }

  const insights: string[] = [];

  if (sample.cpu.temperature !== null && sample.cpu.temperature >= 85) {
    insights.push('CPU package temperature is elevated; review profile mode and cooling path before heavy workloads.');
  }
  if (sample.gpu.temperature !== null && sample.gpu.temperature >= 82) {
    insights.push('GPU temperature is high under current load; consider cleaning airflow paths or reducing sustained boost behavior.');
  }
  if (sample.memory.usage >= 86) {
    insights.push('RAM pressure is high; closing background apps or running RAM Cleaner may improve responsiveness.');
  }
  if (sample.cpu.usage >= 90 && sample.gpu.usage < 60) {
    insights.push('Workload appears CPU-bound; a coding/general LLM should prioritize CPU efficiency and lower context sizes.');
  }
  if (sample.state !== 'valid') {
    insights.push(`Telemetry confidence is currently ${sample.state}; recommendations should be treated as provisional until sensors stabilize.`);
  }

  if (insights.length === 0) {
    insights.push('System telemetry looks stable. Local AI can run in non-invasive mode with no background automation enabled.');
  }

  return insights.slice(0, 4);
}

export function buildCopilotContextPack(systemInfo: SystemInfo | null, sample: HardwareSample | null, insights: string[]): string {
  const lines: string[] = [];

  lines.push('Radium CoPilot local context (offline):');
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
    insights.forEach((entry) => lines.push(`  - ${entry}`));
  }

  lines.push('- Output style: concise, practical, and non-invasive.');
  return lines.join('\n');
}

function parseRamGb(value: string | undefined): number {
  if (!value) return 16;
  const match = value.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (!match) return 16;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : 16;
}
