export type SeverityTier = 'cool' | 'warm' | 'hot';

export type SeverityThresholds = {
  warm: number;
  hot: number;
};

/** Temperature readings run warmer before they're actionable than usage percentages do. */
export const TEMPERATURE_THRESHOLDS: SeverityThresholds = { warm: 70, hot: 85 };
export const USAGE_THRESHOLDS: SeverityThresholds = { warm: 65, hot: 85 };

export function severityTier(value: number | undefined | null, thresholds: SeverityThresholds): SeverityTier | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= thresholds.hot) return 'hot';
  if (value >= thresholds.warm) return 'warm';
  return 'cool';
}

/** CSS class for text/icon coloring — pairs with `.metric-cool/.metric-warm/.metric-hot` in styles.css. */
export function severityClass(value: number | undefined | null, thresholds: SeverityThresholds): string {
  const tier = severityTier(value, thresholds);
  return tier ? `metric-${tier}` : '';
}

export function temperatureClass(value: number | undefined | null): string {
  return severityClass(value, TEMPERATURE_THRESHOLDS);
}

export function usageClass(value: number | undefined | null): string {
  return severityClass(value, USAGE_THRESHOLDS);
}

/** CSS custom-property names for the Gauge component's arc gradient, keyed by tier. */
export const GAUGE_TONE_VARS: Record<SeverityTier, { start: string; end: string; glow: string }> = {
  cool: { start: 'var(--gauge-cool)', end: 'var(--gauge-cool-end)', glow: 'var(--gauge-cool-glow)' },
  warm: { start: 'var(--gauge-warm)', end: 'var(--gauge-warm-end)', glow: 'var(--gauge-warm-glow)' },
  hot: { start: 'var(--gauge-hot)', end: 'var(--gauge-hot-end)', glow: 'var(--gauge-hot-glow)' },
};

export function gaugeTone(pct: number) {
  const tier: SeverityTier = pct >= USAGE_THRESHOLDS.hot / 100 ? 'hot' : pct >= USAGE_THRESHOLDS.warm / 100 ? 'warm' : 'cool';
  return GAUGE_TONE_VARS[tier];
}

export type MetricCardTone = 'cyan' | 'green' | 'amber' | 'red';

/** MetricCard `tone` prop for a usage percentage, falling back to `coolTone` (the card's default accent) below the warm threshold. */
export function usageTone(value: number | undefined | null, coolTone: MetricCardTone = 'cyan'): MetricCardTone {
  const tier = severityTier(value, USAGE_THRESHOLDS);
  if (tier === 'hot') return 'red';
  if (tier === 'warm') return 'amber';
  return coolTone;
}
