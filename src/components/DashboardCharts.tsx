import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel } from './Panel';
import { EthernetIcon, WifiIcon } from './HardwareIcon';
import type { MetricPoint } from '../types/system';

type DashboardChartsProps = {
  history: MetricPoint[];
  networkAdapterType?: string | null;
};

export function DashboardCharts({ history, networkAdapterType }: DashboardChartsProps) {
  return (
    <>
      <Panel className="chart-panel wide primary-trend">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Live graph</span>
            <h2>Thermals and usage</h2>
          </div>
          <span className="subtle">48 samples</span>
        </div>
        <ResponsiveContainer width="100%" height={198}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff7a00" stopOpacity={0.26} />
                <stop offset="95%" stopColor="#ff7a00" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gpuFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#84f08c" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#84f08c" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#788293', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tick={{ fill: '#788293', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip content={<DashboardTooltip />} />
            <Area isAnimationActive={false} type="monotone" dataKey="cpuUsage" stroke="#ff7a00" fill="url(#cpuFill)" strokeWidth={1.8} dot={false} name="CPU %" />
            <Area isAnimationActive={false} type="monotone" dataKey="gpuUsage" stroke="#84f08c" fill="url(#gpuFill)" strokeWidth={1.8} dot={false} name="GPU %" />
            <Line isAnimationActive={false} type="monotone" dataKey="ramUsage" stroke="#f5c86b" strokeWidth={1.9} dot={false} name="RAM %" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel className="chart-panel secondary-trend">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Network</span>
            <h2>Throughput</h2>
          </div>
          {networkAdapterType === 'wifi'
            ? <WifiIcon size={18} />
            : <EthernetIcon size={18} />}
        </div>
        <ResponsiveContainer width="100%" height={146}>
          <LineChart data={history}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Tooltip content={<DashboardTooltip />} />
            <Line isAnimationActive={false} type="monotone" dataKey="networkDown" stroke="#ff8f1f" strokeWidth={2.05} dot={false} name="Download Mbps" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}

function DashboardTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <strong>{label ?? ''}</strong>
      {payload.map((item, index) => (
        <div className="chart-tooltip-row" key={`${item.name ?? 'series'}-${index}`}>
          <span className="chart-tooltip-dot" style={{ backgroundColor: item.color ?? '#ff7a00' }} />
          <span>{item.name ?? 'Value'}</span>
          <span>{typeof item.value === 'number' ? item.value.toFixed(1) : item.value ?? '-'}</span>
        </div>
      ))}
    </div>
  );
}
