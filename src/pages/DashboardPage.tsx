import { Cpu, Fan, Gauge, HardDrive, MemoryStick, MonitorUp, Network, PlugZap, Thermometer, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Gauge as RadialGauge } from '../components/Gauge';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Skeleton } from '../components/Skeleton';
import { StatePill } from '../components/StatePill';
import { useMonitor } from '../context/MonitorContext';
import { useSettings } from '../context/SettingsContext';
import { gb, mbps, mhz, pct, temp, adapterTypeLabel, driveTypeLabel } from '../lib/format';
import { assets, vendorLogo } from '../lib/assets';

export function DashboardPage() {
  const { systemInfo, sample, loading, error, native } = useMonitor();
  const { settings } = useSettings();
  const history = sample?.history ?? [];
  const animateCharts = settings.experience.animations;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Radium PCs Companion"
        title="Command Center"
        description="Live system telemetry, build identity, and practical tuning tools in one local-first control surface."
        action={<StatePill state={sample?.state ?? (loading ? 'inactive' : 'unavailable')} />}
      />

      {!native && (
        <div className="notice notice-preview">
          Browser preview — telemetry is simulated. Run <code>npm run tauri dev</code> to connect to real hardware.
        </div>
      )}
      {native && error && (
        <div className="notice notice-error">
          Hardware monitoring error: {error}
        </div>
      )}

      <div className="dashboard-grid">
        <Panel className="hero-monitor">
          <div className="hero-monitor-top">
            <div>
              <div className="dashboard-brandmark">
                <img src={assets.radiumHeader} alt="Radium PCs Companion" />
              </div>
              <span className="eyebrow">System health</span>
              <h2>{loading ? 'Scanning hardware' : 'Performance steady'}</h2>
              <p>Polling is throttled for low overhead and chart updates are sampled for smooth rendering.</p>
            </div>
            <div className="vendor-logos">
              {systemInfo && <img src={vendorLogo(systemInfo.cpuVendor)} alt={systemInfo.cpuVendor} />}
              {systemInfo && <img src={vendorLogo(systemInfo.gpuVendor)} alt={systemInfo.gpuVendor} />}
            </div>
          </div>
          <div className="gauge-row">
            <RadialGauge label="CPU load" value={sample?.cpu.usage ?? 0} unit="%" />
            <RadialGauge label="GPU load" value={sample?.gpu.usage ?? 0} unit="%" />
            <RadialGauge label="RAM used" value={sample?.memory.usage ?? 0} unit="%" />
          </div>
        </Panel>

        <MetricCard
          icon={Thermometer}
          label="CPU Temperature"
          value={loading ? 'Scanning' : temp(sample?.cpu.temperature ?? null, settings.monitoring.temperatureUnit)}
          detail={sample ? mhz(sample.cpu.clockMhz) : 'Awaiting scan'}
          progress={sample?.cpu.temperature ?? 0}
          tone="cyan"
        />
        <MetricCard
          icon={MonitorUp}
          label="GPU Temperature"
          value={loading ? 'Scanning' : temp(sample?.gpu.temperature ?? null, settings.monitoring.temperatureUnit)}
          detail={sample ? `${mhz(sample.gpu.coreClockMhz)} core · ${sample.gpu.powerWatts ? `${sample.gpu.powerWatts.toFixed(0)} W` : 'power pending'}` : 'Awaiting scan'}
          progress={sample?.gpu.temperature ?? 0}
          tone="green"
        />
        <MetricCard
          icon={MemoryStick}
          label="Memory"
          value={sample ? `${gb(sample.memory.usedGb)} / ${gb(sample.memory.totalGb)}` : 'Scanning'}
          detail={sample ? pct(sample.memory.usage) : 'Awaiting scan'}
          progress={sample?.memory.usage ?? 0}
          tone="amber"
        />
        <MetricCard
          icon={Network}
          label="Network"
          value={sample ? mbps(sample.network.downMbps) : 'Scanning'}
          detail={sample ? (
            <>
              {mbps(sample.network.upMbps)} up
              {sample.network.adapterName && (
                <> · <span className="badge badge-dim">{adapterTypeLabel(sample.network.adapterType)}</span> {sample.network.adapterName}</>
              )}
            </>
          ) : 'Awaiting scan'}
          progress={Math.min((sample?.network.downMbps ?? 0) * 2, 100)}
          tone="cyan"
        />

        <Panel className="chart-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Live graph</span>
              <h2>Thermals and usage</h2>
            </div>
            <span className="subtle">48 samples</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#55d6ff" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#55d6ff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#84f08c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#84f08c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#788293', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tick={{ fill: '#788293', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: 'rgba(9,13,21,0.97)', border: '1px solid rgba(85,214,255,0.18)', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', fontSize: 12 }} labelStyle={{ color: '#8a9db5', fontWeight: 700 }} itemStyle={{ color: '#e2ecf4' }} />
              <Area isAnimationActive={animateCharts} type="monotone" dataKey="cpuUsage" stroke="#55d6ff" fill="url(#cpuFill)" strokeWidth={2} dot={false} name="CPU %" />
              <Area isAnimationActive={animateCharts} type="monotone" dataKey="gpuUsage" stroke="#84f08c" fill="url(#gpuFill)" strokeWidth={2} dot={false} name="GPU %" />
              <Line isAnimationActive={animateCharts} type="monotone" dataKey="ramUsage" stroke="#f5c86b" strokeWidth={2} dot={false} name="RAM %" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel className="chart-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Network</span>
              <h2>Throughput</h2>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: 'rgba(9,13,21,0.97)', border: '1px solid rgba(85,214,255,0.18)', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', fontSize: 12 }} labelStyle={{ color: '#8a9db5', fontWeight: 700 }} itemStyle={{ color: '#e2ecf4' }} />
              <Line isAnimationActive={animateCharts} type="monotone" dataKey="networkDown" stroke="#55d6ff" strokeWidth={2.4} dot={false} name="Download Mbps" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel className="hardware-list sensor-status-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor sources</span>
              <h2>Live data availability</h2>
            </div>
            <PlugZap size={18} />
          </div>
          <div className="sensor-source-grid">
            <SensorSource label="CPU load / RAM / disks" value="sysinfo" live={!!sample} />
            <SensorSource label="CPU temperature" value="WMI thermal zone" live={sample?.cpu.temperature != null} />
            <SensorSource label="GPU sensors" value={systemInfo?.gpuVendor === 'nvidia' ? 'NVML internal' : systemInfo?.gpuVendor === 'amd' ? 'AMD ADL internal' : systemInfo?.gpuVendor === 'intel' ? 'WMI (usage only)' : 'WMI fallback'} live={(sample?.gpu.temperature != null) || (sample?.gpu.usage ?? 0) > 0} hint={systemInfo?.gpuVendor === 'intel' ? 'Intel Arc: usage via WMI only. Temp, fans, and power require IGCL support.' : undefined} />
            <SensorSource label="GPU power / fans" value="Vendor driver API" live={sample?.gpu.powerWatts != null || sample?.gpu.fanPct != null || sample?.fans.some((fan) => fan.rpm != null) === true} />
          </div>
        </Panel>

        <Panel className="hardware-list">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Build identity</span>
              <h2>Detected hardware</h2>
            </div>
          </div>
          <dl>
            <dt><Cpu size={15} /> CPU</dt>
            <dd>{systemInfo?.cpu ?? <Skeleton className="text-line" />}</dd>
            <dt><MonitorUp size={15} /> GPU</dt>
            <dd>{systemInfo?.gpu ?? <Skeleton className="text-line" />}</dd>
            <dt><MemoryStick size={15} /> RAM</dt>
            <dd>{systemInfo ? `${systemInfo.ram} at ${systemInfo.ramSpeed}` : <Skeleton className="text-line" />}</dd>
            <dt><HardDrive size={15} /> Storage</dt>
            <dd>
              {systemInfo
                ? <ul className="drive-list">{systemInfo.storage.map((s) => <li key={s}>{s}</li>)}</ul>
                : <Skeleton className="text-line" />}
              {sample && sample.storage.length > 0 && (
                <div className="drive-type-row">
                  {sample.storage.map((d, i) => (
                    <span key={i} className="badge badge-dim">{driveTypeLabel(d.driveType)}</span>
                  ))}
                </div>
              )}
            </dd>
            <dt><Gauge size={15} /> BIOS</dt>
            <dd>{systemInfo?.bios ?? <Skeleton className="text-line" />}</dd>
          </dl>
        </Panel>

        <Panel className="hardware-list">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Cooling</span>
              <h2>Fan telemetry</h2>
            </div>
            <Fan size={18} />
          </div>
          <div className="fan-stack">
            {(sample?.fans ?? []).map((fan) => (
              <div className="fan-row" key={fan.label}>
                <span>{fan.label}</span>
                <strong>{fan.rpm != null ? `${fan.rpm} RPM` : fan.pct != null ? `${fan.pct}%` : 'N/A'}</strong>
              </div>
            ))}
            {sample?.gpu.powerWatts != null && (
              <div className="fan-row">
                <span><Zap size={14} /> GPU power</span>
                <strong>{sample.gpu.powerWatts.toFixed(0)} W</strong>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SensorSource({ label, value, live, hint }: { label: string; value: string; live: boolean; hint?: string }) {
  return (
    <div className={live ? 'sensor-source live' : 'sensor-source pending'}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{live ? 'Live' : 'Pending'}</small>
      {hint && <p className="sensor-hint">{hint}</p>}
    </div>
  );
}
