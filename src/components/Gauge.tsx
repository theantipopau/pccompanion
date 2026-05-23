import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

type GaugeProps = {
  label: string;
  value: number;
  unit: string;
  max?: number;
};

const CX = 50, CY = 50, R = 37;
const START = 225, SWEEP = 270;

function ptRaw(deg: number, radius = R): [number, number] {
  const r = ((deg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(r), CY + radius * Math.sin(r)];
}

function arc(d1: number, d2: number, large: boolean, radius = R) {
  const [x1, y1] = ptRaw(d1, radius);
  const [x2, y2] = ptRaw(d2, radius);
  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${radius} ${radius} 0 ${large ? 1 : 0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

/** Tick dot positions at 0 %, 25 %, 50 %, 75 %, 100 % of arc */
const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

export function Gauge({ label, value, unit, max = 100 }: GaugeProps) {
  const animated = useAnimatedNumber(value);
  const pct = Math.min(Math.max(animated / max, 0), 1);
  const fillEnd = START + SWEEP * pct;
  const large = pct * SWEEP > 180;

  // Color thresholds
  const color    = pct >= 0.85 ? '#ff6d6d' : pct >= 0.65 ? '#f5c86b' : '#55d6ff';
  const colorEnd = pct >= 0.85 ? '#ff9999' : pct >= 0.65 ? '#fad482' : '#84f0c4';
  const glow     = pct >= 0.85 ? 'rgba(255,109,109,0.36)' : pct >= 0.65 ? 'rgba(245,200,107,0.34)' : 'rgba(85,214,255,0.34)';

  // Gradient endpoint coordinates
  const [gx1, gy1] = ptRaw(START);
  const [gx2, gy2] = ptRaw(fillEnd > START ? fillEnd : START + 10);
  const gradId = `gauge-grad-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="gauge">
      <div className="gauge-face">
        <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
              x1={gx1.toFixed(2)} y1={gy1.toFixed(2)}
              x2={gx2.toFixed(2)} y2={gy2.toFixed(2)}>
              <stop offset="0%"   stopColor={color}    />
              <stop offset="100%" stopColor={colorEnd} />
            </linearGradient>
          </defs>

          {/* Outer bezel ring */}
          <circle cx={CX} cy={CY} r={44} fill="none"
            stroke="rgba(255,255,255,0.035)" strokeWidth={0.65} />

          {/* Track arc */}
          <path
            d={arc(START, START + SWEEP, true)}
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth={4.6}
            strokeLinecap="round"
          />

          {/* Tick marks at 0 / 25 / 50 / 75 / 100 % */}
          {TICK_FRACTIONS.map((t) => {
            const deg = START + SWEEP * t;
            const [tx, ty] = ptRaw(deg);
            const active = pct > 0.02 && t <= pct + 0.01;
            return (
              <circle key={t} cx={tx} cy={ty} r={1.25}
                fill={active ? color : 'rgba(255,255,255,0.18)'} />
            );
          })}

          {/* Fill arc with gradient */}
          {pct > 0.015 && (
            <path
              d={arc(START, fillEnd, large)}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={4.6}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3.5px ${glow})` }}
            />
          )}

          {/* Needle marker */}
          {pct > 0.01 && (() => {
            const [mx, my] = ptRaw(fillEnd, R + 0.1);
            return <circle cx={mx} cy={my} r={1.25} fill={colorEnd} opacity={0.95} />;
          })()}
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
