import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTelemetryPresentationInitialState,
  updateTelemetryPresentation,
  type TelemetryPresentationSnapshot,
} from './telemetryPresentation.ts';
import type { HardwareSample, MetricState, Vendor } from '../types/system.ts';

test('initial startup with no sample stays initialising', () => {
  const next = updateTelemetryPresentation(createTelemetryPresentationInitialState(), {
    sample: null,
    loading: true,
    error: null,
    monitoringEnabled: true,
  }, 1_000);

  assert.equal(next.state, 'initialising');
  assert.equal(next.isLive, false);
  assert.equal(next.displaySample, null);
});

test('initial startup with repeated failures becomes limited without a display sample', () => {
  let state = createTelemetryPresentationInitialState();
  state = fail(state, 1_000);
  state = fail(state, 2_000);

  assert.equal(state.state, 'degraded');
  assert.equal(state.label, 'Limited');
  assert.equal(state.isUsable, false);
  assert.equal(state.displaySample, null);
});

test('first valid sample stabilises but does not promote to live', () => {
  const state = valid(createTelemetryPresentationInitialState(), 1_000);

  assert.equal(state.state, 'recovering');
  assert.equal(state.label, 'Stabilising');
  assert.equal(state.isLive, false);
  assert.equal(state.validSampleCount, 1);
  assert.equal(state.displaySample?.timestamp, 1_000);
});

test('stable promotion to live requires repeated advanced valid samples', () => {
  const state = valid(valid(createTelemetryPresentationInitialState(), 1_000), 2_000);

  assert.equal(state.state, 'live');
  assert.equal(state.isLive, true);
  assert.equal(state.validSampleCount, 2);
});

test('one valid sample followed by failure keeps the retained sample in recovery', () => {
  const state = fail(valid(createTelemetryPresentationInitialState(), 1_000), 2_000);

  assert.equal(state.state, 'recovering');
  assert.equal(state.isLive, false);
  assert.equal(state.displaySampleRetained, true);
  assert.equal(state.displaySample?.timestamp, 1_000);
});

test('stable live followed by one missed sample is recovering, not live', () => {
  const state = fail(liveState(), 3_000);

  assert.equal(state.state, 'recovering');
  assert.equal(state.isLive, false);
  assert.equal(state.displaySampleRetained, true);
});

test('stable live followed by sustained failure becomes stale', () => {
  let state = liveState();
  state = fail(state, 3_000);
  state = fail(state, 11_000);

  assert.equal(state.state, 'stale');
  assert.equal(state.isLive, false);
  assert.equal(state.sampleAgeMs, 9_000);
  assert.equal(state.displaySampleRetained, true);
});

test('recovery before stale threshold requires fresh valid samples before live', () => {
  let state = liveState();
  state = fail(state, 6_000);
  state = valid(state, 6_500);
  assert.equal(state.state, 'recovering');
  assert.equal(state.validSampleCount, 1);

  state = valid(state, 7_000);
  assert.equal(state.state, 'live');
  assert.equal(state.isLive, true);
});

test('recovery after stale threshold stabilises before returning live', () => {
  let state = liveState();
  state = tickOnly(state, 11_000);
  assert.equal(state.state, 'stale');

  state = valid(state, 12_000);
  assert.equal(state.state, 'recovering');
  assert.equal(state.isLive, false);

  state = valid(state, 13_000);
  assert.equal(state.state, 'live');
});

test('alternating success and failure does not accidentally promote to live', () => {
  let state = createTelemetryPresentationInitialState();
  state = valid(state, 1_000);
  state = degradedSample(state, 2_000);
  state = valid(state, 3_000);
  state = degradedSample(state, 4_000);

  assert.notEqual(state.state, 'live');
  assert.equal(state.isLive, false);
});

test('sample age crossing stale threshold without a new sample marks retained value stale', () => {
  let state = liveState();
  state = tickOnly(state, 4_000);
  assert.equal(state.state, 'live');

  state = tickOnly(state, 11_000);
  assert.equal(state.state, 'stale');
  assert.equal(state.ageLabel, '9s ago');
});

test('provider identity changing clears old retained sample until new provider stabilises', () => {
  let state = liveState();
  state = updateTelemetryPresentation(state, {
    sample: makeSample({ timestamp: 3_000, state: 'degraded', provider: 'adl2', vendor: 'amd', name: 'Different GPU' }),
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, 3_000);

  assert.equal(state.state, 'degraded');
  assert.equal(state.displaySample, null);
  assert.equal(state.lastValidSample, null);
  assert.match(state.providerKey ?? '', /adl2/);
});

test('valid provider identity change with same timestamp restabilises instead of using old provider data', () => {
  const state = updateTelemetryPresentation(liveState(), {
    sample: makeSample({ timestamp: 2_000, state: 'valid', provider: 'adl2', vendor: 'amd', name: 'Different GPU' }),
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, 2_000);

  assert.equal(state.state, 'recovering');
  assert.equal(state.validSampleCount, 1);
  assert.equal(state.displaySample?.gpu.provider, 'adl2');
  assert.equal(state.displaySampleRetained, false);
});

test('monitoring restart with initializing sample moves out of live and retains marked readings', () => {
  const state = updateTelemetryPresentation(liveState(), {
    sample: makeSample({ timestamp: 3_000, state: 'initializing' }),
    loading: true,
    error: null,
    monitoringEnabled: true,
  }, 3_000);

  assert.equal(state.state, 'recovering');
  assert.equal(state.isLive, false);
  assert.equal(state.displaySampleRetained, true);
  assert.equal(state.rawState, 'initializing');
});

test('unsupported CPU temperature stays unavailable while CPU load remains active', () => {
  const state = valid(createTelemetryPresentationInitialState(), 1_000, { cpuTemp: null, cpuUsage: 41 });

  assert.equal(state.displaySample?.cpu.temperature, null);
  assert.equal(state.displaySample?.cpu.usage, 41);
  assert.equal(state.activeChannels >= 1, true);
});

test('unsupported GPU temperature stays unavailable while GPU usage remains active', () => {
  const state = valid(createTelemetryPresentationInitialState(), 1_000, { gpuTemp: null, gpuUsage: 52 });

  assert.equal(state.displaySample?.gpu.temperature, null);
  assert.equal(state.displaySample?.gpu.usage, 52);
  assert.equal(state.activeChannels >= 1, true);
});

test('timestamp moving backwards does not replace the last valid sample or advance confidence', () => {
  let state = liveState();
  state = updateTelemetryPresentation(state, {
    sample: makeSample({ timestamp: 1_500, state: 'valid' }),
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, 3_000);

  assert.equal(state.state, 'recovering');
  assert.equal(state.displaySample?.timestamp, 2_000);
  assert.equal(state.rawSampleTimestamp, 2_000);
  assert.equal(state.reason, 'Incoming sample timestamp did not advance.');
});

test('invalid or missing timestamp is normalised to the current transition time', () => {
  const state = updateTelemetryPresentation(createTelemetryPresentationInitialState(), {
    sample: makeSample({ timestamp: Number.NaN, state: 'valid' }),
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, 5_000);

  assert.equal(state.displaySample?.timestamp, 5_000);
  assert.equal(Number.isFinite(state.sampleAgeMs), true);
  assert.equal(state.sampleAgeMs, 0);
});

test('long sleep or resume time gap marks pre-sleep readings stale before recovery', () => {
  let state = liveState();
  state = tickOnly(state, 300_000);
  assert.equal(state.state, 'stale');

  state = valid(state, 301_000);
  assert.equal(state.state, 'recovering');
  state = valid(state, 302_000);
  assert.equal(state.state, 'live');
});

test('last-good sample remains displayable after expiry only as stale evidence', () => {
  const state = tickOnly(liveState(), 65_000);

  assert.equal(state.state, 'stale');
  assert.equal(state.isLive, false);
  assert.equal(state.displaySampleRetained, true);
  assert.equal(state.sampleAgeMs, 63_000);
});

test('individual metric validity changes replace the displayed sample while provider remains live', () => {
  let state = liveState();
  state = valid(state, 3_000, { cpuTemp: null, gpuTemp: 66 });
  state = valid(state, 4_000, { cpuTemp: null, gpuTemp: null });

  assert.equal(state.state, 'live');
  assert.equal(state.displaySample?.cpu.temperature, null);
  assert.equal(state.displaySample?.gpu.temperature, null);
  assert.equal(state.displaySample?.gpu.usage, 48);
});

function liveState() {
  return valid(valid(createTelemetryPresentationInitialState(), 1_000), 2_000);
}

function valid(
  previous: TelemetryPresentationSnapshot,
  timestamp: number,
  overrides: SampleOverrides = {},
) {
  return updateTelemetryPresentation(previous, {
    sample: makeSample({ ...overrides, timestamp, state: 'valid' }),
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, timestamp);
}

function degradedSample(previous: TelemetryPresentationSnapshot, timestamp: number) {
  return updateTelemetryPresentation(previous, {
    sample: makeSample({ timestamp, state: 'degraded' }),
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, timestamp);
}

function fail(previous: TelemetryPresentationSnapshot, nowMs: number) {
  return updateTelemetryPresentation(previous, {
    sample: null,
    loading: false,
    error: 'provider unavailable',
    monitoringEnabled: true,
  }, nowMs);
}

function tickOnly(previous: TelemetryPresentationSnapshot, nowMs: number) {
  return updateTelemetryPresentation(previous, {
    sample: null,
    loading: false,
    error: null,
    monitoringEnabled: true,
  }, nowMs);
}

type SampleOverrides = {
  timestamp?: number;
  state?: MetricState;
  provider?: string;
  vendor?: Vendor;
  name?: string;
  cpuTemp?: number | null;
  cpuUsage?: number;
  gpuTemp?: number | null;
  gpuUsage?: number;
};

function makeSample(overrides: SampleOverrides = {}): HardwareSample {
  const gpuUsage = overrides.gpuUsage ?? 48;
  return {
    timestamp: overrides.timestamp ?? 1_000,
    state: overrides.state ?? 'valid',
    cpu: {
      temperature: overrides.cpuTemp === undefined ? 62 : overrides.cpuTemp,
      usage: overrides.cpuUsage ?? 35,
      clockMhz: 4200,
    },
    gpu: {
      name: overrides.name ?? 'Test GPU',
      vendor: overrides.vendor ?? 'nvidia',
      provider: overrides.provider ?? 'nvml',
      temperature: overrides.gpuTemp === undefined ? 64 : overrides.gpuTemp,
      usage: gpuUsage,
      vramUsedGb: 5.2,
      vramTotalGb: 12,
      coreClockMhz: 2260,
      memoryClockMhz: 9000,
      fanPct: 42,
      powerWatts: 180,
    },
    memory: { usedGb: 12, totalGb: 32, usage: 37.5 },
    fans: [{ label: 'GPU fan', rpm: 1280, pct: 42 }],
    storage: [{ label: 'C:', usedPercent: 58, temperature: 39, driveType: 'nvme' }],
    network: { downMbps: 12, upMbps: 3, adapterName: 'Ethernet', adapterType: 'ethernet' },
    history: [],
  };
}
