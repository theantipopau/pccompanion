import { AlertTriangle, Cpu, ExternalLink, Fan, Gauge, HardDrive, MemoryStick, MonitorUp, Network, ShieldCheck, Sparkles, Thermometer, Zap, type LucideIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { assets, oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { computePerformanceScore } from '../lib/performanceScore';
import { openExternalUrl, callNative } from '../services/native';
import type { DriverUpdateInfo, Vendor } from '../types/system';

type DashboardPageProps = {
  onNavigate?: (view: string) => void;
};

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { systemInfo, sample, loading, error, native } = useMonitor();
  const { settings } = useSettings();
  // undefined = check pending/not started, null = check failed or N/A, object = result
  const [driverUpdateInfo, setDriverUpdateInfo] = useState<DriverUpdateInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!systemInfo?.gpuDriverVersion) return;
    callNative<DriverUpdateInfo | null>('check_driver_update', undefined, () => null)
      .then((info) => setDriverUpdateInfo(info))
      .catch(() => setDriverUpdateInfo(null));
  }, [systemInfo?.gpuDriverVersion]);

  const history = sample?.history ?? [];
  const animateCharts = settings.experience.animations;
  const performanceScore = computePerformanceScore(sample);
  const gpuProvider = sample?.gpu.provider ? sample.gpu.provider.toUpperCase() : 'WMI';
  const nominal = sample?.state === 'valid';
  const sampleAgeMs = sample ? Math.max(0, Date.now() - sample.timestamp) : null;
  const sampleAgeLabel = sampleAgeMs == null ? 'Awaiting feed' : sampleAgeMs < 2000 ? 'Live now' : `${Math.round(sampleAgeMs / 1000)}s ago`;
  const activeChannels = [sample?.cpu.temperature != null, sample?.gpu.temperature != null, !!sample, !!sample].filter(Boolean).length;
  const normalizeIdentity = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/query|detect|pending|unknown|initialising|initializing|system manufacturer|system product name|to be filled/i.test(trimmed)) return null;
    return trimmed;
  };
  const cpuName = normalizeIdentity(systemInfo?.cpu) ?? 'CPU detecting';
  const gpuName = normalizeIdentity(sample?.gpu.name) ?? normalizeIdentity(systemInfo?.gpu) ?? 'GPU detecting';
  const boardName = normalizeIdentity(systemInfo?.motherboard);

  /** Abbreviate Intel's WMI-format driver version "31.0.101.5234" → "v101.5234". */
  const formatDriverVersion = (ver: string, vendor: string): string => {
    if (vendor === 'intel') {
      const parts = ver.split('.');
      if (parts.length === 4 && parts[0] === '31' && parts[1] === '0') {
        return `v${parts[2]}.${parts[3]}`;
      }
    }
    return `v${ver}`;
  };

  const inferGpuVendor = (): Vendor => {
    if (sample?.gpu.vendor && sample.gpu.vendor !== 'unknown') return sample.gpu.vendor;
    const providerVendor = vendorFromProvider(sample?.gpu.provider);
    if (providerVendor !== 'unknown') return providerVendor;
    if (systemInfo?.gpuVendor && systemInfo.gpuVendor !== 'unknown') return systemInfo.gpuVendor;
    return vendorFromText(gpuName);
  };
  const gpuVendor = inferGpuVendor();
  const cpuVendor = systemInfo?.cpuVendor && systemInfo.cpuVendor !== 'unknown' ? systemInfo.cpuVendor : vendorFromText(cpuName);
  const hardwareTheme = gpuVendor !== 'unknown' ? gpuVendor : (cpuVendor !== 'unknown' ? cpuVendor : 'unknown');
  const deviceName = boardName
    || normalizeIdentity(systemInfo?.windows)
    || 'System identity pending';
  const telemetryHeadline = loading || !sample
    ? 'Telemetry querying'
    : nominal
      ? 'Telemetry stable'
      : 'Telemetry partially degraded';
  const telemetrySubline = sample
    ? `Provider ${gpuProvider} · ${sampleAgeLabel}`
    : 'Waiting for first telemetry sample';
  const cpuVendorAsset = vendorLogo(cpuVendor);
  const gpuVendorAsset = oemLogoForText(gpuName) ?? vendorLogo(gpuVendor);
  const boardVendorAsset = oemLogoForText(boardName ?? '');
  const compactIdentityPills = [
    { key: 'cpu', label: cpuName, icon: cpuVendorAsset },
    { key: 'gpu', label: gpuName, icon: gpuVendorAsset },
    { key: 'os', label: systemInfo?.windows ?? 'OS detecting' },
    { key: 'provider', label: `${gpuProvider} Provider`, icon: gpuVendorAsset },
    { key: 'lanes', label: `Telemetry ${activeChannels}/4` },
    { key: 'support', label: `Support ${nominal ? 'Ready' : 'Degraded'} · ${performanceScore.grade}` },
  ];
  const heroSignals = [
    { id: 'cpu', label: 'CPU', value: sample ? pct(sample.cpu.usage) : 'Scan', detail: sample?.cpu.temperature != null ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : 'Temp unavailable' },
    { id: 'gpu', label: 'GPU', value: sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : 'Scan', detail: sample ? pct(sample.gpu.usage) : 'Pending' },
    { id: 'ram', label: 'RAM', value: sample ? pct(sample.memory.usage) : 'Scan', detail: sample ? `${gb(sample.memory.usedGb)} used` : 'Pending' },
    { id: 'net', label: 'NET', value: sample ? mbps(sample.network.downMbps) : 'Scan', detail: sample ? `${mbps(sample.network.upMbps)} up` : 'Pending' },
  ];
  const storageMaxUsed = sample?.storage.reduce((max, drive) => Math.max(max, drive.usedPercent), 0) ?? 0;
  const careActions = buildCareActions({
    cpuTempMissing: sample ? sample.cpu.temperature == null : false,
    storageMaxUsed,
    scoreValue: performanceScore.value,
    updateAvailable: driverUpdateInfo?.updateAvailable === true,
    latestDriver: driverUpdateInfo?.latestVersion,
    driverUrl: driverUpdateInfo?.downloadUrl,
    telemetryReady: nominal,
  });

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
            <div className="hero-identity-main">
              <div className="hero-identity-brand" aria-label="Radium PCs Companion identity">
                <img className="dashboard-brand-icon" src={assets.radiumLogo} alt="Radium PCs" />
                <div className="hero-brand-copy">
                  <strong>Radium PCs Companion</strong>
                  <span>Companion</span>
                </div>
              </div>
              <h2>{deviceName}</h2>
              <p className="hero-status-line">{telemetryHeadline}</p>
              <p>{telemetrySubline}</p>
              <div className="hero-runtime-meta">
                <span><ShieldCheck size={13} /> State: {(sample?.state ?? 'inactive').toUpperCase()}</span>
                <span><MonitorUp size={13} /> Provider: {gpuProvider}</span>
                <span><Gauge size={13} /> Lanes: {activeChannels}/4</span>
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
              <div className="hero-status-pills" aria-label="Detected identity and telemetry status">
                {compactIdentityPills.map((pill) => (
                  <span key={pill.key} className="hero-status-pill" title={pill.label}>
                    {pill.icon && <img src={pill.icon} alt="" aria-hidden="true" />}
                    <span>{pill.label}</span>
                  </span>
                ))}
              </div>
              <div className="hero-premium-asset" aria-hidden="true">
                <img src={assets.radiumHeaderNew} alt="" />
                <span>Premium support workflow</span>
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
          label={sample?.cpu.temperature == null ? 'CPU Load' : 'CPU Temperature'}
          componentName={cpuName}
          value={loading ? 'Scanning' : sample?.cpu.temperature == null ? pct(sample?.cpu.usage ?? 0) : temp(sample?.cpu.temperature ?? null, settings.monitoring.temperatureUnit)}
          detail={sample
            ? sample.cpu.temperature == null
              ? `Provider WMI ACPI · ${mhz(sample.cpu.clockMhz)} · package sensor unavailable`
              : `Provider WMI ACPI · ${mhz(sample.cpu.clockMhz)}`
            : 'Awaiting scan'}
          progress={sample?.cpu.temperature ?? 0}
          tone="cyan"
          vendorAssetSrc={cpuVendorAsset}
          vendorAssetAlt={`${systemInfo?.cpuVendor ?? 'CPU'} logo`}
        />
        <MetricCard
          className="metric-primary metric-gpu"
          icon={MonitorUp}
          label="GPU Temperature"
          componentName={gpuName}
          value={loading ? 'Scanning' : temp(sample?.gpu.temperature ?? null, settings.monitoring.temperatureUnit)}
          detail={sample
            ? `Provider ${gpuProvider} · ${mhz(sample.gpu.coreClockMhz)} core · VRAM ${gb(sample.gpu.vramUsedGb)} / ${gb(sample.gpu.vramTotalGb)}`
            : 'Awaiting scan'}
          progress={sample?.gpu.temperature ?? 0}
          tone="green"
          vendorAssetSrc={gpuVendorAsset}
          vendorAssetAlt={`${gpuVendor} logo`}
        />
        <MetricCard
          className="metric-primary metric-ram"
          icon={MemoryStick}
          label="Memory"
          componentName={boardName ?? 'Mainboard detecting'}
          value={sample ? `${gb(sample.memory.usedGb)} / ${gb(sample.memory.totalGb)}` : 'Scanning'}
          detail={sample ? `${pct(sample.memory.usage)} · low-overhead monitor cache` : 'Awaiting scan'}
          progress={sample?.memory.usage ?? 0}
          tone="amber"
          vendorAssetSrc={boardVendorAsset}
          vendorAssetAlt="Mainboard vendor logo"
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
            <div className="score-mini-metrics">
              <span>Provider {gpuProvider}</span>
              <span>Telemetry {activeChannels}/4</span>
              <span>{nominal ? 'Runtime nominal' : 'Degraded runtime'}</span>
            </div>
            <div className="dashboard-care-actions">
              {careActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    className={`dashboard-care-action tone-${action.tone}`}
                    type="button"
                    onClick={() => {
                      if (action.url) {
                        openExternalUrl(action.url);
                        return;
                      }
                      onNavigate?.(action.view);
                    }}
                  >
                    <Icon size={15} />
                    <span>
                      <strong>{action.label}</strong>
                      <small>{action.detail}</small>
                    </span>
                  </button>
                );
              })}
            </div>
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
              <Area isAnimationActive={animateCharts} animationDuration={340} animationEasing="ease-out" type="monotone" dataKey="cpuUsage" stroke="#ff7a00" fill="url(#cpuFill)" strokeWidth={1.8} dot={false} name="CPU %" />
              <Area isAnimationActive={animateCharts} animationDuration={340} animationEasing="ease-out" type="monotone" dataKey="gpuUsage" stroke="#84f08c" fill="url(#gpuFill)" strokeWidth={1.8} dot={false} name="GPU %" />
              <Line isAnimationActive={animateCharts} animationDuration={320} animationEasing="ease-out" type="monotone" dataKey="ramUsage" stroke="#f5c86b" strokeWidth={1.9} dot={false} name="RAM %" />
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
          <ResponsiveContainer width="100%" height={146}>
            <LineChart data={history}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Tooltip content={<DashboardTooltip />} />
              <Line isAnimationActive={animateCharts} animationDuration={320} animationEasing="ease-out" type="monotone" dataKey="networkDown" stroke="#ff8f1f" strokeWidth={2.05} dot={false} name="Download Mbps" />
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
            <dd>{cpuName !== 'CPU detecting' ? cpuName : <Skeleton className="text-line" />}</dd>
            <dt><GpuIcon size={15} /> GPU</dt>
            <dd>{gpuName !== 'GPU detecting' ? gpuName : <Skeleton className="text-line" />}</dd>
            {systemInfo?.gpuDriverVersion && (
              <>
                <dt><MonitorUp size={15} /> GPU Driver</dt>
                <dd>
                  <span className="driver-version-row">
                    <span>{formatDriverVersion(systemInfo.gpuDriverVersion, gpuVendor)}</span>
                    {driverUpdateInfo?.updateAvailable === true ? (
                      <a
                        className="driver-update-badge"
                        href="#"
                        title={`Latest: ${driverUpdateInfo.latestVersion}`}
                        onClick={(e) => { e.preventDefault(); openExternalUrl(driverUpdateInfo.downloadUrl); }}
                      >
                        New Driver available
                      </a>
                    ) : driverUpdateInfo != null && !driverUpdateInfo.updateAvailable ? (
                      <span className="driver-up-to-date" title={`Latest checked: ${driverUpdateInfo.latestVersion}`}>Up to date</span>
                    ) : (
                      <a
                        className="driver-check-link"
                        href="#"
                        onClick={(e) => { e.preventDefault(); openExternalUrl(
                          gpuVendor === 'nvidia' ? 'https://www.nvidia.com/Download/index.aspx' :
                          gpuVendor === 'intel'  ? 'https://www.intel.com/content/www/us/en/download/785597/intel-arc-iris-xe-graphics-windows.html' :
                          'https://www.amd.com/en/support/download/drivers.html'
                        ); }}
                      >
                        Check <ExternalLink size={11} />
                      </a>
                    )}
                  </span>
                </dd>
              </>
            )}
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
            {systemInfo?.chipsetDriverVersion && (
              <>
                <dt><Cpu size={15} /> Chipset Driver</dt>
                <dd>
                  <span className="driver-version-row">
                    <span>{systemInfo.chipsetDriverVersion}</span>
                    <a
                      className="driver-check-link"
                      href="#"
                      onClick={(e) => { e.preventDefault(); openExternalUrl(systemInfo.cpuVendor === 'intel' ? 'https://www.intel.com/content/www/us/en/support/detect.html' : 'https://www.amd.com/en/support/download/drivers.html'); }}
                    >
                      Check <ExternalLink size={11} />
                    </a>
                  </span>
                </dd>
              </>
            )}
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

type CareAction = {
  label: string;
  detail: string;
  icon: LucideIcon;
  view: string;
  url?: string;
  tone: 'green' | 'amber' | 'cyan';
};

function buildCareActions({
  cpuTempMissing,
  storageMaxUsed,
  scoreValue,
  updateAvailable,
  latestDriver,
  driverUrl,
  telemetryReady,
}: {
  cpuTempMissing: boolean;
  storageMaxUsed: number;
  scoreValue: number;
  updateAvailable: boolean;
  latestDriver?: string;
  driverUrl?: string;
  telemetryReady: boolean;
}): CareAction[] {
  const actions: CareAction[] = [];
  if (cpuTempMissing) {
    actions.push({
      label: 'Check sensor provider',
      detail: 'CPU package temp unavailable',
      icon: Thermometer,
      view: 'diagnostics',
      tone: 'amber',
    });
  }
  if (updateAvailable && driverUrl) {
    actions.push({
      label: 'Update GPU driver',
      detail: latestDriver ? `Latest ${latestDriver}` : 'New driver available',
      icon: MonitorUp,
      view: 'dashboard',
      url: driverUrl,
      tone: 'amber',
    });
  }
  if (storageMaxUsed >= 85) {
    actions.push({
      label: 'Free storage',
      detail: `Highest drive ${Math.round(storageMaxUsed)}% used`,
      icon: HardDrive,
      view: 'storage',
      tone: storageMaxUsed >= 92 ? 'amber' : 'cyan',
    });
  }
  if (scoreValue < 75) {
    actions.push({
      label: 'Review profiles',
      detail: 'Tune power intent safely',
      icon: Zap,
      view: 'profiles',
      tone: 'cyan',
    });
  }
  if (!telemetryReady && actions.length < 4) {
    actions.push({
      label: 'Run health check',
      detail: 'Open diagnostics workflow',
      icon: AlertTriangle,
      view: 'diagnostics',
      tone: 'amber',
    });
  }
  actions.push({
    label: 'Open passport',
    detail: 'Build identity and care status',
    icon: Sparkles,
    view: 'passport',
    tone: 'green',
  });
  return actions.slice(0, 4);
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
