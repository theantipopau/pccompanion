import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

type GaugeProps = {
  label: string;
  value: number;
  unit: string;
  max?: number;
};

const CX = 50, CY = 50, R = 36;
const START = 225, SWEEP = 270;

function pt(deg: number): [number, number] {
  const r = ((deg - 90) * Math.PI) / 180;
  return [CX + R * Math.cos(r), CY + R * Math.sin(r)];
}

function arc(d1: number, d2: number, large: boolean) {
  const [x1, y1] = pt(d1);
  const [x2, y2] = pt(d2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function Gauge({ label, value, unit, max = 100 }: GaugeProps) {
  const animated = useAnimatedNumber(value);
  const pct = Math.min(Math.max(animated / max, 0), 1);
  const fillEnd = START + SWEEP * pct;
  const large = pct * SWEEP > 180;

  const color = pct >= 0.85 ? '#ff6d6d' : pct >= 0.65 ? '#f5c86b' : '#55d6ff';
  const glow  = pct >= 0.85 ? 'rgba(255,109,109,0.65)' : pct >= 0.65 ? 'rgba(245,200,107,0.65)' : 'rgba(85,214,255,0.65)';

  return (
    <div className="gauge">
      <div className="gauge-face">
        <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
          {/* Track arc */}
          <path
            d={arc(START, START + SWEEP, true)}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={5.5}
            strokeLinecap="round"
          />
          {/* Fill arc */}
          {pct > 0.01 && (
            <path
              d={arc(START, fillEnd, large)}
              fill="none"
              stroke={color}
              strokeWidth={5.5}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${glow})` }}
            />
          )}
        </svg>
        <div className="gauge-center">
          <strong>{Math.round(animated)}</strong>
          <span>{unit}</span>
        </div>
      </div>
      <span className="gauge-label">{label}</span>
    </div>
  );
}
