import type { MetricState } from '../types/system';
import type { TelemetryPresentationState } from '../lib/telemetryPresentation';

type PillState = MetricState | TelemetryPresentationState;

type StatePillProps = {
  state: PillState;
  label?: string;
};

const labels: Record<PillState, string> = {
  valid: 'Live',
  initializing: 'Starting',
  initialising: 'Starting',
  live: 'Live',
  recovering: 'Recovering',
  inactive: 'Inactive',
  unavailable: 'Limited',
  stale: 'Stale',
  degraded: 'Degraded',
};

export function StatePill({ state, label }: StatePillProps) {
  return <span className={`state-pill state-${state}`}>{label ?? labels[state]}</span>;
}
