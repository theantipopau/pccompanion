import type { HardwareSample, MetricState } from '../types/system';

export type TelemetryPresentationState =
  | 'initialising'
  | 'live'
  | 'recovering'
  | 'stale'
  | 'degraded'
  | 'unavailable';

export type TelemetryPresentationSnapshot = {
  state: TelemetryPresentationState;
  label: string;
  headline: string;
  detail: string;
  tone: 'green' | 'cyan' | 'amber' | 'red';
  isLive: boolean;
  isUsable: boolean;
  rawState: MetricState | 'pending';
  provider: string;
  sampleAgeMs: number | null;
  ageLabel: string;
  activeChannels: number;
  validSampleCount: number;
  invalidSampleCount: number;
  providerKey: string | null;
  rawSampleTimestamp: number | null;
  lastValidSampleTimestamp: number | null;
  displaySampleRetained: boolean;
  staleAfterMs: number;
  liveAfterValidSamples: number;
  reason: string;
  lastValidSample: HardwareSample | null;
  displaySample: HardwareSample | null;
};

type TelemetryPresentationInput = {
  sample: HardwareSample | null;
  loading: boolean;
  error: string | null;
  monitoringEnabled: boolean;
};

const LIVE_AFTER_VALID_SAMPLES = 2;
const RECOVERING_INVALID_SAMPLES = 2;
const FRESH_SAMPLE_MS = 3_000;
const RECOVERING_WINDOW_MS = 5_000;
const STALE_AFTER_MS = 8_000;

export function createTelemetryPresentationInitialState(): TelemetryPresentationSnapshot {
  return {
    state: 'initialising',
    label: 'Starting',
    headline: 'Telemetry starting',
    detail: 'Waiting for the first hardware sample',
    tone: 'cyan',
    isLive: false,
    isUsable: false,
    rawState: 'pending',
    provider: 'Pending',
    sampleAgeMs: null,
    ageLabel: 'Awaiting feed',
    activeChannels: 0,
    validSampleCount: 0,
    invalidSampleCount: 0,
    providerKey: null,
    rawSampleTimestamp: null,
    lastValidSampleTimestamp: null,
    displaySampleRetained: false,
    staleAfterMs: STALE_AFTER_MS,
    liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
    reason: 'No telemetry sample has been received yet.',
    lastValidSample: null,
    displaySample: null,
  };
}

export function updateTelemetryPresentation(
  previous: TelemetryPresentationSnapshot,
  input: TelemetryPresentationInput,
  nowMs = Date.now(),
): TelemetryPresentationSnapshot {
  const rawSample = input.sample;
  const sample = normalizeSampleTimestamp(rawSample, nowMs);
  const rawState = sample?.state ?? (input.loading ? 'initializing' : 'pending');
  const nextProviderKey = sample ? sampleProviderKey(sample) : null;
  const providerChanged = Boolean(
    nextProviderKey
    && previous.providerKey
    && nextProviderKey !== previous.providerKey,
  );
  const providerKey = nextProviderKey ?? previous.providerKey;
  const provider = providerLabel(sample, previous, providerKey);
  const timestampAdvanced = sample ? previous.rawSampleTimestamp == null || sample.timestamp > previous.rawSampleTimestamp : false;
  const duplicateOrOlderSample = Boolean(sample && !providerChanged && previous.rawSampleTimestamp != null && sample.timestamp <= previous.rawSampleTimestamp);
  const rawSampleTimestamp = sample && (timestampAdvanced || providerChanged) ? sample.timestamp : previous.rawSampleTimestamp;
  const validSample = sample?.state === 'valid' && !duplicateOrOlderSample;
  const resetForProvider = providerChanged ? null : previous.lastValidSample;
  const lastValidSample = validSample ? sample : resetForProvider;
  const displaySample = lastValidSample ?? sample;
  const sampleAgeMs = displaySample ? Math.max(0, nowMs - displaySample.timestamp) : null;
  const ageLabel = formatSampleAge(sampleAgeMs);
  const activeChannels = countActiveChannels(displaySample);
  const validSampleCount = validSample ? (providerChanged ? 1 : previous.validSampleCount + 1) : 0;
  const countedInvalidSample = Boolean((sample && !validSample) || input.error);
  const invalidSampleCount = validSample ? 0 : providerChanged ? (countedInvalidSample ? 1 : 0) : previous.invalidSampleCount + (countedInvalidSample ? 1 : 0);
  const lastValidSampleTimestamp = lastValidSample?.timestamp ?? null;
  const displaySampleRetained = Boolean(displaySample && lastValidSample && displaySample === previous.lastValidSample);
  const withinRecoveryWindow = sampleAgeMs != null && sampleAgeMs <= RECOVERING_WINDOW_MS;
  const stale = sampleAgeMs != null && sampleAgeMs > STALE_AFTER_MS;
  const fresh = sampleAgeMs != null && sampleAgeMs <= FRESH_SAMPLE_MS;

  if (providerChanged && sample?.state !== 'valid') {
    return buildSnapshot({
      state: sample?.state === 'initializing' ? 'initialising' : 'degraded',
      label: sample?.state === 'initializing' ? 'Starting' : input.error ? 'Limited' : 'Partial',
      headline: sample?.state === 'initializing' ? 'Telemetry starting' : 'Telemetry limited',
      detail: sample?.state === 'initializing' ? 'Provider changed - waiting for confirmed data' : `${provider} provider has reduced sensor depth`,
      tone: sample?.state === 'initializing' ? 'cyan' : input.error ? 'red' : 'amber',
      isLive: false,
      isUsable: false,
      rawState,
      provider,
      sampleAgeMs: null,
      ageLabel: 'Awaiting feed',
      activeChannels: 0,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp: null,
      displaySampleRetained: false,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'Provider identity changed before a valid replacement sample arrived.',
      lastValidSample: null,
      displaySample: null,
    });
  }

  if (!input.monitoringEnabled) {
    return buildSnapshot({
      state: 'unavailable',
      label: 'Paused',
      headline: 'Monitoring paused',
      detail: 'Live telemetry is disabled in settings',
      tone: 'amber',
      isLive: false,
      isUsable: Boolean(displaySample),
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'Monitoring is disabled in settings.',
      lastValidSample,
      displaySample,
    });
  }

  if (!sample && input.loading && !displaySample) {
    return buildSnapshot({
      state: 'initialising',
      label: 'Starting',
      headline: 'Telemetry starting',
      detail: 'Waiting for the first hardware sample',
      tone: 'cyan',
      isLive: false,
      isUsable: false,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'No sample has arrived while the monitor is loading.',
      lastValidSample,
      displaySample,
    });
  }

  if (sample?.state === 'initializing' && !lastValidSample) {
    return buildSnapshot({
      state: 'initialising',
      label: 'Starting',
      headline: 'Telemetry starting',
      detail: 'Waiting for confirmed provider data',
      tone: 'cyan',
      isLive: false,
      isUsable: false,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels: 0,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained: false,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'Backend reported initializing before confirmed provider data.',
      lastValidSample,
      displaySample: null,
    });
  }

  if (!sample && !input.error && previous.isLive && fresh) {
    return buildSnapshot({
      state: 'live',
      label: 'Live',
      headline: 'Telemetry stable',
      detail: `${provider} provider - ${ageLabel}`,
      tone: 'green',
      isLive: true,
      isUsable: true,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount: previous.validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'Last valid sample is still inside the fresh display window.',
      lastValidSample,
      displaySample,
    });
  }

  if (validSample && validSampleCount >= LIVE_AFTER_VALID_SAMPLES && !stale) {
    return buildSnapshot({
      state: 'live',
      label: 'Live',
      headline: 'Telemetry stable',
      detail: `${provider} provider - ${ageLabel}`,
      tone: 'green',
      isLive: true,
      isUsable: true,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained: false,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'Required consecutive valid samples have arrived.',
      lastValidSample,
      displaySample,
    });
  }

  if (validSample) {
    return buildSnapshot({
      state: 'recovering',
      label: 'Stabilising',
      headline: 'Telemetry stabilising',
      detail: `${provider} provider - confirming sensor feed`,
      tone: 'cyan',
      isLive: false,
      isUsable: true,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained: false,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: providerChanged
        ? 'Provider changed and must stabilise before Live is shown.'
        : 'A valid sample arrived but the live confidence threshold is not met yet.',
      lastValidSample,
      displaySample,
    });
  }

  if (displaySample && duplicateOrOlderSample && !input.error) {
    return buildSnapshot({
      state: stale ? 'stale' : 'recovering',
      label: stale ? 'Stale' : 'Recovering',
      headline: stale ? 'Telemetry stale' : 'Telemetry recovering',
      detail: stale ? `Last confirmed sample ${ageLabel}` : `${provider} provider - waiting for a newer sample`,
      tone: 'amber',
      isLive: false,
      isUsable: true,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'Incoming sample timestamp did not advance.',
      lastValidSample,
      displaySample,
    });
  }

  if (displaySample && !stale && (withinRecoveryWindow || invalidSampleCount < RECOVERING_INVALID_SAMPLES)) {
    return buildSnapshot({
      state: 'recovering',
      label: 'Recovering',
      headline: 'Telemetry recovering',
      detail: `${provider} provider - keeping last good readings visible`,
      tone: 'amber',
      isLive: false,
      isUsable: true,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: input.error
        ? 'Provider returned an error but the retained sample is still inside the recovery window.'
        : 'A non-live update arrived while the retained sample is still recent.',
      lastValidSample,
      displaySample,
    });
  }

  if (displaySample && stale) {
    return buildSnapshot({
      state: 'stale',
      label: 'Stale',
      headline: 'Telemetry stale',
      detail: `Last confirmed sample ${ageLabel}`,
      tone: 'amber',
      isLive: false,
      isUsable: true,
      rawState,
      provider,
      sampleAgeMs,
      ageLabel,
      activeChannels,
      validSampleCount,
      invalidSampleCount,
      providerKey,
      rawSampleTimestamp,
      lastValidSampleTimestamp,
      displaySampleRetained,
      staleAfterMs: STALE_AFTER_MS,
      liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
      reason: 'The retained valid sample exceeded the stale threshold.',
      lastValidSample,
      displaySample,
    });
  }

  return buildSnapshot({
    state: 'degraded',
    label: input.error ? 'Limited' : 'Partial',
    headline: 'Telemetry limited',
    detail: input.error ? 'Sensor provider is retrying' : `${provider} provider has reduced sensor depth`,
    tone: input.error ? 'red' : 'amber',
    isLive: false,
    isUsable: Boolean(displaySample),
    rawState,
    provider,
    sampleAgeMs,
    ageLabel,
    activeChannels,
    validSampleCount,
    invalidSampleCount,
    providerKey,
    rawSampleTimestamp,
    lastValidSampleTimestamp,
    displaySampleRetained,
    staleAfterMs: STALE_AFTER_MS,
    liveAfterValidSamples: LIVE_AFTER_VALID_SAMPLES,
    reason: input.error ? 'Provider error without a usable retained sample.' : 'No usable valid sample is available.',
    lastValidSample,
    displaySample,
  });
}

function buildSnapshot(snapshot: TelemetryPresentationSnapshot) {
  return snapshot;
}

function providerLabel(
  sample: HardwareSample | null,
  previous: TelemetryPresentationSnapshot,
  providerKey: string | null,
): string {
  if (sample?.gpu.provider) return sample.gpu.provider.toUpperCase();
  if (providerKey && previous.provider !== 'Pending') return previous.provider;
  return 'Pending';
}

function sampleProviderKey(sample: HardwareSample): string {
  return [
    sample.gpu.provider || 'unknown-provider',
    sample.gpu.vendor || 'unknown-vendor',
    sample.gpu.name || 'unknown-gpu',
  ].join('|');
}

function normalizeSampleTimestamp(sample: HardwareSample | null, nowMs: number): HardwareSample | null {
  if (!sample) return null;
  if (Number.isFinite(sample.timestamp) && sample.timestamp > 0) return sample;
  return { ...sample, timestamp: nowMs };
}

function countActiveChannels(sample: HardwareSample | null): number {
  if (!sample) return 0;
  return [
    sample.cpu.temperature != null || sample.cpu.usage > 0,
    sample.gpu.temperature != null || sample.gpu.usage > 0,
    sample.memory.totalGb > 0,
    sample.network.adapterName.trim().length > 0 || sample.network.downMbps > 0 || sample.network.upMbps > 0,
  ].filter(Boolean).length;
}

function formatSampleAge(sampleAgeMs: number | null): string {
  if (sampleAgeMs == null) return 'Awaiting feed';
  if (sampleAgeMs < 2_000) return 'Live now';
  return `${Math.round(sampleAgeMs / 1000)}s ago`;
}
