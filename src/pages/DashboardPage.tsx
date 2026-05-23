import { Cpu, Fan, Gauge, HardDrive, MemoryStick, MonitorUp, Network, ShieldCheck, Thermometer, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Gauge as RadialGauge } from '../components/Gauge';
import { CpuIcon, GpuIcon, NvmeIcon, RamIcon, HddIcon, VramIcon, NetworkIcon, EthernetIcon, WifiIcon } from '../components/HardwareIcon';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Skeleton } from '../components/Skeleton';
import { StatePill } from '../components/StatePill';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { gb, mbps, mhz, pct, temp, adapterTypeLabel, driveTypeLabel } from '../lib/format';
import { assets, vendorLogo } from '../lib/assets';
import { computePerformanceScore } from '../lib/performanceScore';
import type { Vendor } from '../types/system';

type DashboardPageProps = {
  onNavigate?: (view: string) => void;
};

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const companyWebsite = 'https://radiumpcs.com.au';
  const { systemInfo, sample, loading, error, native } = useMonitor();
  const { settings } = useSettings();
  const history = sample?.history ?? [];
  const animateCharts = settings.experience.animations;
  const performanceScore = computePerformanceScore(sample);
  const gpuProvider = sample?.gpu.provider ? sample.gpu.provider.toUpperCase() : 'WMI';
  const nominal = sample?.state === 'valid';
  const sampleAgeMs = sample ? Math.max(0, Date.now() - sample.timestamp) : null;
  const sampleAgeLabel = sampleAgeMs == null ? 'Awaiting feed' : sampleAgeMs < 2000 ? 'Live now' : `${Math.round(sampleAgeMs / 1000)}s ago`;
  const activeChannels = [sample?.cpu.temperature != null, sample?.gpu.temperature != null, !!sample, !!sample].filter(Boolean).length;
  const hardwareTheme = (systemInfo?.gpuVendor && systemInfo.gpuVendor !== 'unknown')
    ? systemInfo.gpuVendor
    : (systemInfo?.cpuVendor && systemInfo.cpuVendor !== 'unknown' ? systemInfo.cpuVendor : 'unknown');
  const systemIdentity = [
    { label: 'Platform', value: systemInfo?.windows ?? 'Detecting OS' },
    { label: 'Mainboard', value: systemInfo?.motherboard ?? 'Detecting board' },
    { label: 'GPU', value: systemInfo?.gpu ?? 'Detecting graphics' },
    { label: 'CPU', value: systemInfo?.cpu ?? 'Detecting processor' },
  ];
  const vendorBadges = (() => {
    if (!systemInfo) return [] as Array<{ key: string; label: string; vendor: Vendor }>;
    const cpuVendor = systemInfo.cpuVendor;
    const gpuVendor = systemInfo.gpuVendor;

    if (cpuVendor !== 'unknown' && cpuVendor === gpuVendor) {
      return [{ key: `shared-${cpuVendor}`, label: 'CPU/GPU', vendor: cpuVendor }];
    }

    const badges: Array<{ key: string; label: string; vendor: Vendor }> = [];
    if (cpuVendor !== 'unknown') {
      badges.push({ key: `cpu-${cpuVendor}`, label: 'CPU', vendor: cpuVendor });
    }
    if (gpuVendor !== 'unknown') {
      badges.push({ key: `gpu-${gpuVendor}`, label: 'GPU', vendor: gpuVendor });
    }
    return badges;
  })();
  const heroSignals = [
    { id: 'cpu', label: 'CPU', value: sample ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : 'Scan', detail: sample ? pct(sample.cpu.usage) : 'Pending' },
    { id: 'gpu', label: 'GPU', value: sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : 'Scan', detail: sample ? pct(sample.gpu.usage) : 'Pending' },
    { id: 'ram', label: 'RAM', value: sample ? pct(sample.memory.usage) : 'Scan', detail: sample ? `${gb(sample.memory.usedGb)} used` : 'Pending' },
    { id: 'net', label: 'NET', value: sample ? mbps(sample.network.downMbps) : 'Scan', detail: sample ? `${mbps(sample.network.upMbps)} up` : 'Pending' },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Radium PCs Companion"
        title="Dashboard"
        description="Overview of your system's performance."
        action={(
          <div className="dashboard-header-actions">
            <StatePill state={sample?.state ?? (loading ? 'inactive' : 'unavailable')} />
            <span className="badge badge-dim">GPU provider {gpuProvider}</span>
            <button className="secondary-button" onClick={() => onNavigate?.('diagnostics')}>
              <ShieldCheck size={16} />
              <span>Telemetry Diagnostics</span>
            </button>
          </div>
        )}
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

      <div className={`dashboard-grid dashboard-theme-${hardwareTheme}`}>
        <Panel className="hero-monitor">
          <div className="hero-ambient" aria-hidden="true" />
          <div className="hero-monitor-top">
            <div>
              <div className="dashboard-brandmark" aria-label="Radium branding">
                <img className="dashboard-brand-icon" src={assets.radiumLogo} alt="Radium PCs" />
                <img src={assets.radiumHeader} alt="Radium PCs Companion" />
              </div>
              <span className="eyebrow">System identity and telemetry overview</span>
              <h2>{loading ? 'Scanning hardware' : nominal ? 'Hardware runtime calibrated' : 'Telemetry channels partially degraded'}</h2>
              <p>
                Live provider-backed data with explicit channel confidence. Missing sensors stay visible as degraded states.
              </p>
              <div className="hero-identity-grid">
                {systemIdentity.map((identity) => (
                  <div key={identity.label} className="hero-identity-chip">
                    <span>{identity.label}</span>
                    <strong>{identity.value}</strong>
                  </div>
                ))}
              </div>
              <div className="hero-runtime-meta">
                <span><ShieldCheck size={13} /> State: {(sample?.state ?? 'inactive').toUpperCase()}</span>
                <span><MonitorUp size={13} /> Provider: {gpuProvider}</span>
                <span><Gauge size={13} /> Telemetry lanes: {activeChannels}/4</span>
              </div>
              <div className="hero-links">
                <a href={companyWebsite} target="_blank" rel="noreferrer noopener">Radium PCs</a>
                <button className="secondary-button" onClick={() => onNavigate?.('passport')}>System Passport</button>
                <button className="secondary-button" onClick={() => onNavigate?.('profiles')}>Performance Profiles</button>
              </div>
              <motion.div
                className="hero-telemetry-ribbon"
                initial={animateCharts ? { opacity: 0, y: 10 } : false}
                animate={animateCharts ? { opacity: 1, y: 0 } : false}
                transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.64, delay: 0.08 }}
              >
                {heroSignals.map((signal, index) => (
                  <motion.div
                    key={signal.id}
                    className="hero-telemetry-chip"
                    initial={animateCharts ? { opacity: 0, y: 8 } : false}
                    animate={animateCharts ? { opacity: 1, y: 0 } : false}
                    transition={{ type: 'spring', stiffness: 230, damping: 26, mass: 0.62, delay: 0.1 + index * 0.04 }}
                  >
                    <span>{signal.label}</span>
                    <strong>{signal.value}</strong>
                    <small>{signal.detail}</small>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <div className="hero-side-rail">
              <div className="hero-visual-card" aria-hidden="true">
                <div className="hero-visual-mesh" />
                <div className="hero-visual-core" />
                <div className="hero-silhouette" />
              </div>
              <div className="hero-grade-tile">
                <span>System health</span>
                <strong>{nominal ? 'Nominal' : 'Degraded'}</strong>
                <small>{sampleAgeLabel}</small>
              </div>
              <div className="hero-grade-tile hero-grade-tile-score">
                <span>Support readiness</span>
                <strong>{performanceScore.grade}</strong>
                <small>{nominal ? 'Live telemetry stable' : 'Degraded channels surfaced'}</small>
              </div>
              <div className="vendor-logos" aria-label="Detected silicon vendors">
                {vendorBadges.map((badge) => (
                  <div key={badge.key} className="vendor-badge">
                    <img src={vendorLogo(badge.vendor)} alt={`${badge.vendor} logo`} />
                    <span>{badge.label}: {badge.vendor.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="gauge-row">
            <RadialGauge label="CPU load" value={sample?.cpu.usage ?? 0} unit="%" />
            <RadialGauge label="GPU load" value={sample?.gpu.usage ?? 0} unit="%" />
            <RadialGauge label="RAM used" value={sample?.memory.usage ?? 0} unit="%" />
          </div>
        </Panel>

        <MetricCard
          className="metric-primary metric-cpu"
          icon={Thermometer}
          label="CPU Temperature"
          value={loading ? 'Scanning' : temp(sample?.cpu.temperature ?? null, settings.monitoring.temperatureUnit)}
          detail={sample
            ? sample.cpu.temperature == null
              ? `Provider WMI ACPI · ${mhz(sample.cpu.clockMhz)} · package sensor unavailable`
              : `Provider WMI ACPI · ${mhz(sample.cpu.clockMhz)}`
            : 'Awaiting scan'}
          progress={sample?.cpu.temperature ?? 0}
          tone="cyan"
        />
        <MetricCard
          className="metric-primary metric-gpu"
          icon={MonitorUp}
          label="GPU Temperature"
          value={loading ? 'Scanning' : temp(sample?.gpu.temperature ?? null, settings.monitoring.temperatureUnit)}
          detail={sample
            ? `Provider ${gpuProvider} · ${mhz(sample.gpu.coreClockMhz)} core · VRAM ${gb(sample.gpu.vramUsedGb)} / ${gb(sample.gpu.vramTotalGb)}`
            : 'Awaiting scan'}
          progress={sample?.gpu.temperature ?? 0}
          tone="green"
        />
        <MetricCard
          className="metric-primary metric-ram"
          icon={MemoryStick}
          label="Memory"
          value={sample ? `${gb(sample.memory.usedGb)} / ${gb(sample.memory.totalGb)}` : 'Scanning'}
          detail={sample ? `${pct(sample.memory.usage)} · low-overhead monitor cache` : 'Awaiting scan'}
          progress={sample?.memory.usage ?? 0}
          tone="amber"
        />
        <MetricCard
          className="metric-secondary metric-network"
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

        <Panel className="score-panel health-overview">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OEM readiness</span>
              <h2>Radium Performance Score</h2>
            </div>
            <div className="score-pill">{performanceScore.grade}</div>
          </div>
          <div className="score-panel-body">
            <strong>{performanceScore.value}</strong>
            <p>{performanceScore.summary}</p>
          </div>
        </Panel>

        <Panel className="chart-panel wide primary-trend">
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
                  <stop offset="5%" stopColor="#ff7a00" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#ff7a00" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#84f08c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#84f08c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#788293', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tick={{ fill: '#788293', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={<DashboardTooltip />} />
              <Area isAnimationActive={animateCharts} type="monotone" dataKey="cpuUsage" stroke="#ff7a00" fill="url(#cpuFill)" strokeWidth={2} dot={false} name="CPU %" />
              <Area isAnimationActive={animateCharts} type="monotone" dataKey="gpuUsage" stroke="#84f08c" fill="url(#gpuFill)" strokeWidth={2} dot={false} name="GPU %" />
              <Line isAnimationActive={animateCharts} type="monotone" dataKey="ramUsage" stroke="#f5c86b" strokeWidth={2} dot={false} name="RAM %" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel className="chart-panel secondary-trend">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Network</span>
              <h2>Throughput</h2>
            </div>
            {sample?.network.adapterType === 'wifi'
              ? <WifiIcon size={18} />
              : <EthernetIcon size={18} />}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip content={<DashboardTooltip />} />
              <Line isAnimationActive={animateCharts} type="monotone" dataKey="networkDown" stroke="#ff8f1f" strokeWidth={2.4} dot={false} name="Download Mbps" />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel className="hardware-list identity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Build identity</span>
              <h2>Detected hardware</h2>
            </div>
          </div>
          <dl>
            <dt><CpuIcon size={15} /> CPU</dt>
            <dd>{systemInfo?.cpu ?? <Skeleton className="text-line" />}</dd>
            <dt><GpuIcon size={15} /> GPU</dt>
            <dd>{systemInfo?.gpu ?? <Skeleton className="text-line" />}</dd>
            <dt><RamIcon size={15} /> RAM</dt>
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

        <Panel className="hardware-list cooling-panel">
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
                <strong>{fan.rpm != null ? `${fan.rpm.toLocaleString()} RPM` : fan.pct != null ? `${fan.pct}%` : 'N/A'}</strong>
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
          <span>{typeof item.value === 'number' ? item.value.toFixed(1) : item.value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
