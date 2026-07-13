import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { Panel } from './Panel';

type MetricCardProps = {
  label: string;
  value: string;
  detail: ReactNode;
  icon: LucideIcon;
  componentName?: ReactNode;
  tone?: 'cyan' | 'green' | 'amber' | 'red';
  progress?: number;
  className?: string;
  vendorAssetSrc?: string | null;
  vendorAssetAlt?: string;
};

export const MetricCard = memo(function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  componentName,
  tone = 'cyan',
  progress = 0,
  className,
  vendorAssetSrc,
  vendorAssetAlt,
}: MetricCardProps) {
  const animatedProgress = useAnimatedNumber(progress);

  return (
    <Panel className={`metric-card tone-${tone}${className ? ` ${className}` : ''}`}>
      <div className="metric-card-head">
        <span>{label}</span>
        <div className="metric-head-right">
          {vendorAssetSrc && (
            <img className="metric-vendor-badge" src={vendorAssetSrc} alt={vendorAssetAlt ?? `${label} vendor`} loading="lazy" decoding="async" />
          )}
          <div className="metric-icon">
            <Icon size={16} />
          </div>
        </div>
      </div>
      {componentName && <div className="metric-component-name">{componentName}</div>}
      <strong>{value}</strong>
      <small>{detail}</small>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${Math.min(Math.max(animatedProgress, 0), 100)}%` }} />
      </div>
    </Panel>
  );
});
