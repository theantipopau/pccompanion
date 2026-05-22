import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { Panel } from './Panel';

type MetricCardProps = {
  label: string;
  value: string;
  detail: ReactNode;
  icon: LucideIcon;
  tone?: 'cyan' | 'green' | 'amber' | 'red';
  progress?: number;
};

export function MetricCard({ label, value, detail, icon: Icon, tone = 'cyan', progress = 0 }: MetricCardProps) {
  const animatedProgress = useAnimatedNumber(progress);

  return (
    <Panel className={`metric-card tone-${tone}`}>
      <div className="metric-card-head">
        <span>{label}</span>
        <div className="metric-icon">
          <Icon size={16} />
        </div>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${Math.min(Math.max(animatedProgress, 0), 100)}%` }} />
      </div>
    </Panel>
  );
}
