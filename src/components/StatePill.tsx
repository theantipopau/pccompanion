import type { MetricState } from '../types/system';

type StatePillProps = {
  state: MetricState;
};

const labels: Record<MetricState, string> = {
  valid: 'Live',
  inactive: 'Inactive',
  unavailable: 'Limited',
  stale: 'Stale',
  degraded: 'Degraded',
};

export function StatePill({ state }: StatePillProps) {
  return <span className={`state-pill state-${state}`}>{labels[state]}</span>;
}
