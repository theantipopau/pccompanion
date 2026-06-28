import { AlertTriangle, Cpu, ExternalLink, Fan, Gauge, HardDrive, MemoryStick, MonitorUp, Network, ShieldCheck, Sparkles, Thermometer, Zap, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gauge as RadialGauge } from '../components/Gauge';
import { CpuIcon, GpuIcon, NvmeIcon, RamIcon, HddIcon, VramIcon, NetworkIcon } from '../components/HardwareIcon';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Skeleton } from '../components/Skeleton';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { brand } from '../lib/branding';
import { gb, mbps, mhz, pct, temp, adapterTypeLabel, driveTypeLabel } from '../lib/format';
import { assets, oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { recordCompanionAction } from '../lib/actionHistory';
import { buildHardwareAlerts } from '../lib/hardwareAlerts';
import { computePerformanceScore } from '../lib/performanceScore';
import { openExternalUrl, callNative } from '../services/native';
import type { DriverUpdateInfo, Vendor } from '../types/system';

type DashboardPageProps = {
  onNavigate?: (view: string) => void;
};

const DashboardCharts = lazy(() => import('../components/DashboardCharts').then((module) => ({ default: module.DashboardCharts })));


export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { systemInfo, sample: rawSample, displaySample, presentation, loading, error, native } = useMonitor();
  const { settings } = useSettings();
  const sample = displaySample ?? rawSample;
  // undefined = check pending/not started, null = check failed or N/A, object = result
  const [driverUpdateInfo, setDriverUpdateInfo] = useState<DriverUpdateInfo | null | undefined>(undefined);
  const alertHistoryRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!systemInfo?.gpuDriverVersion) return;
    callNative<DriverUpdateInfo | null>('check_driver_update', undefined, () => null)
      .then((info) => setDriverUpdateInfo(info))
      .catch(() => setDriverUpdateInfo(null));
  }, [systemInfo?.gpuDriverVersion]);

  const history = sample?.history ?? [];
  const animateEntrance = settings.experience.animations;
  const performanceScore = useMemo(() => computePerformanceScore(sample), [sample]);
  const gpuProvider = presentation.provider !== 'Pending' ? presentation.provider : sample?.gpu.provider ? sample.gpu.provider.toUpperCase() : 'WMI';
  const nominal = presentation.isLive;
  const activeChannels = presentation.activeChannels;
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

  /** Abbreviate Intel's WMI-format driver version "31.0.101.5234" to "v101.5234". */
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
  const cpuVendorAsset = vendorLogo(cpuVendor);
  const gpuVendorAsset = oemLogoForText(gpuName) ?? vendorLogo(gpuVendor);
  const boardVendorAsset = oemLogoForText(boardName ?? '');
  const compactIdentityPills = [
    { key: 'cpu', label: cpuName, icon: cpuVendorAsset },
    { key: 'gpu', label: gpuName, icon: gpuVendorAsset },
    { key: 'os', label: systemInfo?.windows ?? 'OS detecting' },
    { key: 'provider', label: `${gpuProvider} Provider`, icon: gpuVendorAsset },
    { key: 'lanes', label: `Telemetry ${activeChannels}/4` },
    { key: 'support', label: `${brand.readinessLabel} ${presentation.isUsable ? 'Ready' : 'Pending'} - ${performanceScore.grade}` },
  ];
  const heroSignals = [
    { id: 'cpu', label: 'CPU', value: sample ? pct(sample.cpu.usage) : 'Scan', detail: sample?.cpu.temperature != null ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : 'Temp unavailable' },
    { id: 'gpu', label: 'GPU', value: sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : 'Scan', detail: sample ? pct(sample.gpu.usage) : 'Pending' },
    { id: 'ram', label: 'RAM', value: sample ? pct(sample.memory.usage) : 'Scan', detail: sample ? `${gb(sample.memory.usedGb)} used` : 'Pending' },
    { id: 'net', label: 'NET', value: sample ? mbps(sample.network.downMbps) : 'Scan', detail: sample ? `${mbps(sample.network.upMbps)} up` : 'Pending' },
  ];
  const storageMaxUsed = sample?.storage.reduce((max, drive) => Math.max(max, drive.usedPercent), 0) ?? 0;
  const careActions = useMemo(() => buildCareActions({
    cpuTempMissing: sample ? sample.cpu.temperature == null : false,
    storageMaxUsed,
    scoreValue: performanceScore.value,
    updateAvailable: driverUpdateInfo?.updateAvailable === true,
    latestDriver: driverUpdateInfo?.latestVersion,
    driverUrl: driverUpdateInfo?.downloadUrl,
    telemetryReady: presentation.isUsable,
  }), [sample, driverUpdateInfo, performanceScore.value, storageMaxUsed, presentation.isUsable]);
  const dashboardVerdict = useMemo(() => buildDashboardVerdict({
    scoreValue: performanceScore.value,
    scoreGrade: performanceScore.grade,
    storageMaxUsed,
    updateAvailable: driverUpdateInfo?.updateAvailable === true,
    latestDriver: driverUpdateInfo?.latestVersion,
    driverUrl: driverUpdateInfo?.downloadUrl,
    telemetryReady: presentation.isUsable,
    telemetryLive: presentation.isLive,
    telemetryLabel: presentation.label,
    activeProfile: settings.experience.performanceProfile,
  }), [
    driverUpdateInfo,
    performanceScore.grade,
    performanceScore.value,
    presentation.isLive,
    presentation.isUsable,
    presentation.label,
    settings.experience.performanceProfile,
    storageMaxUsed,
  ]);
  const VerdictIcon = dashboardVerdict.icon;
  const hardwareAlerts = useMemo(() => buildHardwareAlerts(sample, presentation, settings.alerts), [sample, presentation, settings.alerts]);

  useEffect(() => {
    if (!settings.alerts.enabled || hardwareAlerts.length === 0) return;
    const now = Date.now();
    hardwareAlerts.forEach((alert) => {
      if (alert.severity === 'info') return;
      const last = alertHistoryRef.current[alert.id] ?? 0;
      if (now - last < settings.alerts.cooldownMs) return;
      alertHistoryRef.current[alert.id] = now;
      recordCompanionAction('diagnostics', 'Hardware alert: ' + alert.title, alert.evidence.join(' / '));
    });
  }, [hardwareAlerts, settings.alerts.cooldownMs, settings.alerts.enabled]);


  return (
    <div className="page">
      <PageHeader
        eyebrow={brand.dashboardEyebrow}
        title="Dashboard"
        description="Overview of your system's performance."
        action={(
          <div className="dashboard-header-actions">
            <button className="secondary-button" onClick={() => onNavigate?.('diagnostics')}>
              <ShieldCheck size={16} />
              <span>Telemetry Diagnostics</span>
            </button>
          </div>
        )}
      />

      {!native && (
        <div className="notice notice-preview">
          Browser preview - telemetry is simulated. Run <code>npm run tauri dev</code> to connect to real hardware.
        </div>
      )}
      {native && error && (
        <div className="notice notice-error">
          Hardware monitoring error: {error}
        </div>
      )}

      <section className={`dashboard-verdict tone-${dashboardVerdict.tone}`} aria-label="Recommended next action">
        <div className="dashboard-verdict-copy">
          <span className="eyebrow">Current status</span>
          <h2>{dashboardVerdict.headline}</h2>
          <p>{dashboardVerdict.detail}</p>
        </div>
        <div className="dashboard-verdict-action">
          <div className="dashboard-verdict-evidence" aria-label="Status evidence">
            {dashboardVerdict.evidence.map((item) => <span key={item}>{item}</span>)}
          </div>
          <button
            className={dashboardVerdict.tone === 'green' ? 'secondary-button' : 'primary-button'}
            type="button"
            onClick={() => {
              if (dashboardVerdict.actionUrl) {
                openExternalUrl(dashboardVerdict.actionUrl);
                return;
              }
              onNavigate?.(dashboardVerdict.actionView);
            }}
          >
            <VerdictIcon size={16} />
            <span>{dashboardVerdict.actionLabel}</span>
          </button>
        </div>
      </section>

      {hardwareAlerts.length > 0 && (
        <section className="hardware-alert-strip" aria-label="Hardware alerts">
          {hardwareAlerts.map((alert) => (
            <article key={alert.id} className={'hardware-alert-card severity-' + alert.severity}>
              <AlertTriangle size={17} />
              <span>
                <small>{alert.severity === 'critical' ? 'Critical alert' : alert.severity === 'warning' ? 'Attention needed' : 'Heads up'}</small>
                <strong>{alert.title}</strong>
                <em>{alert.detail}</em>
              </span>
              <div className="hardware-alert-evidence">
                {alert.evidence.map((item) => <b key={item}>{item}</b>)}
              </div>
              <button className="secondary-button compact-button" type="button" onClick={() => onNavigate?.(alert.actionView)}>
                {alert.actionLabel}
              </button>
            </article>
          ))}
        </section>
      )}

      <div className={`dashboard-grid dashboard-theme-${hardwareTheme}`}>
        <Panel className="hero-monitor">
          <div className="hero-ambient" aria-hidden="true" />
          <div className="hero-monitor-top">
            <div className="hero-identity-main">
              <div className="hero-identity-brand" aria-label={`${brand.productName} identity`}>
                <img className="dashboard-brand-icon" src={brand.splashIcon} alt={brand.name} />
                <div className="hero-brand-copy">
                  <strong>{brand.productName}</strong>
                  <span>{brand.shortName}</span>
                </div>
              </div>
              <h2>{deviceName}</h2>
              <motion.div
                className="hero-telemetry-ribbon"
                initial={animateEntrance ? { opacity: 0, y: 10 } : false}
                animate={animateEntrance ? { opacity: 1, y: 0 } : false}
                transition={{ type: 'spring', stiffness: 220, damping: 26, mass: 0.64, delay: 0.08 }}
              >
                {heroSignals.map((signal, index) => (
                  <motion.div
                    key={signal.id}
                    className="hero-telemetry-chip"
                    initial={animateEntrance ? { opacity: 0, y: 8 } : false}
                    animate={animateEntrance ? { opacity: 1, y: 0 } : false}
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
                <img src={brand.splashLogo} alt="" />
                <span>{brand.dashboardProofLine}</span>
                <div className="hero-premium-proof">
                  {brand.dashboardProofTags.map((tag) => <small key={tag}>{tag}</small>)}
                </div>
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
              ? `Provider WMI ACPI - ${mhz(sample.cpu.clockMhz)} - package sensor unavailable`
              : `Provider WMI ACPI - ${mhz(sample.cpu.clockMhz)}`
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
            ? `Provider ${gpuProvider} - ${mhz(sample.gpu.coreClockMhz)} core - VRAM ${gb(sample.gpu.vramUsedGb)} / ${gb(sample.gpu.vramTotalGb)}`
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
          detail={sample ? `${pct(sample.memory.usage)} - low-overhead monitor cache` : 'Awaiting scan'}
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
                <> - <span className="badge badge-dim">{adapterTypeLabel(sample.network.adapterType)}</span> {sample.network.adapterName}</>
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
              <h2>{brand.dashboardHeroTitle}</h2>
            </div>
            <div className="score-pill">{performanceScore.grade}</div>
          </div>
          <div className="score-panel-body">
            <strong>{performanceScore.value}</strong>
            <p>{performanceScore.summary}</p>
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

        <Suspense fallback={<DashboardChartsFallback />}>
          <DashboardCharts history={history} networkAdapterType={sample?.network.adapterType} />
        </Suspense>

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
                <strong>{fan.rpm != null ? `${fan.rpm.toLocaleString()} RPM` : fan.pct != null ? `${fan.pct}%` : 'Unavailable'}</strong>
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

type DashboardVerdict = {
  headline: string;
  detail: string;
  tone: 'green' | 'amber' | 'cyan';
  icon: LucideIcon;
  actionLabel: string;
  actionView: string;
  actionUrl?: string;
  evidence: string[];
};

type CareAction = {
  label: string;
  detail: string;
  icon: LucideIcon;
  view: string;
  url?: string;
  tone: 'green' | 'amber' | 'cyan';
};

function DashboardChartsFallback() {
  return (
    <>
      <Panel className="chart-panel wide primary-trend">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Live graph</span>
            <h2>Thermals and usage</h2>
          </div>
          <span className="subtle">Loading</span>
        </div>
        <Skeleton className="dashboard-chart-skeleton" />
      </Panel>
      <Panel className="chart-panel secondary-trend">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Network</span>
            <h2>Throughput</h2>
          </div>
        </div>
        <Skeleton className="dashboard-chart-skeleton compact" />
      </Panel>
    </>
  );
}

function buildDashboardVerdict({
  scoreValue,
  scoreGrade,
  storageMaxUsed,
  updateAvailable,
  latestDriver,
  driverUrl,
  telemetryReady,
  telemetryLive,
  telemetryLabel,
  activeProfile,
}: {
  scoreValue: number;
  scoreGrade: string;
  storageMaxUsed: number;
  updateAvailable: boolean;
  latestDriver?: string;
  driverUrl?: string;
  telemetryReady: boolean;
  telemetryLive: boolean;
  telemetryLabel: string;
  activeProfile: string;
}): DashboardVerdict {
  const evidence = [
    `Score ${scoreValue} / ${scoreGrade}`,
    `Telemetry ${telemetryLive ? 'live' : telemetryLabel.toLowerCase()}`,
    storageMaxUsed > 0 ? `Storage peak ${Math.round(storageMaxUsed)}%` : 'Storage pending',
    `Profile ${activeProfile}`,
  ];

  if (!telemetryReady || !telemetryLive) {
    return {
      headline: 'Support evidence recommended',
      detail: 'Telemetry is not fully live yet. Open diagnostics to capture provider state before troubleshooting performance.',
      tone: 'amber',
      icon: ShieldCheck,
      actionLabel: 'Open diagnostics',
      actionView: 'diagnostics',
      evidence,
    };
  }

  if (updateAvailable && driverUrl) {
    return {
      headline: 'Needs attention',
      detail: latestDriver ? `A newer GPU driver is available: ${latestDriver}.` : 'A newer GPU driver is available.',
      tone: 'amber',
      icon: MonitorUp,
      actionLabel: 'Open driver download',
      actionView: 'dashboard',
      actionUrl: driverUrl,
      evidence,
    };
  }

  if (storageMaxUsed >= 85) {
    return {
      headline: 'Needs attention',
      detail: 'One drive is getting tight. Freeing space now helps game updates, shader caches, and Windows maintenance stay smooth.',
      tone: storageMaxUsed >= 92 ? 'amber' : 'cyan',
      icon: HardDrive,
      actionLabel: 'Open storage cleaner',
      actionView: 'storage',
      evidence,
    };
  }

  if (scoreValue < 75) {
    return {
      headline: 'Needs attention',
      detail: 'The current performance state has clear headroom. Review profiles before heavy gaming or workstation loads.',
      tone: 'cyan',
      icon: Zap,
      actionLabel: 'Review profiles',
      actionView: 'profiles',
      evidence,
    };
  }

  return {
    headline: 'Healthy',
    detail: 'Telemetry is live and the current operating state looks ready for normal use.',
    tone: 'green',
    icon: Sparkles,
    actionLabel: 'Open passport',
    actionView: 'passport',
    evidence,
  };
}

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
          <span>{typeof item.value === 'number' ? item.value.toFixed(1) : item.value ?? '-'}</span>
        </div>
      ))}
    </div>
  );
}
