import { Award, BadgeCheck, CircuitBoard, ClipboardCopy, Cpu, FileClock, HardDrive, MonitorUp, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AnimatedValue } from '../components/AnimatedValue';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { brand } from '../lib/branding';
import { LOADING_VALUE } from '../lib/format';
import { oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { recordCompanionAction } from '../lib/actionHistory';
import { computePerformanceScore } from '../lib/performanceScore';
import { EASE_OUT } from '../lib/motion';
import { getHardwareCapabilities } from '../services/systemService';
import type { HardwareCapability, Vendor } from '../types/system';

function entranceProps(index: number, animate: boolean) {
  return animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.06, duration: 0.22, ease: EASE_OUT },
      }
    : { initial: false as const };
}

export function SystemPassportPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { systemInfo, sample: rawSample, displaySample, presentation, native } = useMonitor();
  const { settings } = useSettings();
  const animateEntrance = settings.experience.animations;
  const [capabilities, setCapabilities] = useState<HardwareCapability[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const sample = displaySample ?? rawSample;
  const score = computePerformanceScore(sample);
  const buildIdentity = settings.buildIdentity;
  const provisionedBuildFields = Object.values(buildIdentity).filter((value) => value.trim()).length;
  const buildRecordLabel = provisionedBuildFields > 0 ? `${provisionedBuildFields}/10 fields provisioned` : 'not provisioned';
  const provisionedValue = (value?: string | null) => {
    const trimmed = value?.trim();
    return trimmed || 'not provisioned';
  };
  const preferredValue = (provisioned: string, detected: string) => provisioned.trim() || detected;
  const liveCapabilities = capabilities.filter((capability) => capability.state === 'live').length;
  const normalizeIdentity = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || /query|detect|pending|unknown|initialising|initializing|system product name|to be filled/i.test(trimmed)) return null;
    return trimmed;
  };
  const cpuName = normalizeIdentity(systemInfo?.cpu) ?? 'Pending detection';
  const gpuName = normalizeIdentity(sample?.gpu.name) ?? normalizeIdentity(systemInfo?.gpu) ?? 'Pending detection';
  const boardName = normalizeIdentity(systemInfo?.motherboard) ?? 'Pending detection';
  const passportGpuName = preferredValue(buildIdentity.gpu, gpuName);
  const passportBoardName = preferredValue(buildIdentity.motherboard, boardName);
  const passportStorage = preferredValue(buildIdentity.storageConfig, systemInfo?.storage?.join(' | ') ?? 'Pending detection');
  const passportRam = preferredValue(buildIdentity.ramConfig, systemInfo ? `${systemInfo.ram} at ${systemInfo.ramSpeed}` : 'Pending detection');
  const gpuVendor: Vendor = sample?.gpu.vendor && sample.gpu.vendor !== 'unknown'
    ? sample.gpu.vendor
    : vendorFromProvider(sample?.gpu.provider) !== 'unknown'
      ? vendorFromProvider(sample?.gpu.provider)
      : systemInfo?.gpuVendor && systemInfo.gpuVendor !== 'unknown'
        ? systemInfo.gpuVendor
        : vendorFromText(gpuName);
  const cpuVendor = systemInfo?.cpuVendor && systemInfo.cpuVendor !== 'unknown' ? systemInfo.cpuVendor : vendorFromText(cpuName);
  const cpuLogo = vendorLogo(cpuVendor);
  const gpuLogo = oemLogoForText(gpuName) || vendorLogo(gpuVendor);
  const boardLogo = oemLogoForText(passportBoardName);
  const passportIdSeed = `${cpuName}|${gpuName}|${systemInfo?.bios ?? 'bios'}`;
  const passportId = `RDM-${passportIdSeed
    .split('')
    .reduce((acc, char) => ((acc * 33) ^ char.charCodeAt(0)) >>> 0, 5381)
    .toString(16)
    .toUpperCase()
    .slice(0, 8)}`;
  const validationState = presentation.isLive ? 'Validated runtime profile' : presentation.isUsable ? 'Recent telemetry profile' : 'Telemetry baseline pending';
  const storageMaxUsed = sample?.storage.reduce((max, drive) => Math.max(max, drive.usedPercent), 0) ?? 0;
  const gpuProvider = sample?.gpu.provider?.toUpperCase() ?? LOADING_VALUE;
  const careItems: Array<{ label: string; status: 'live' | 'partial' | 'unsupported'; detail: string }> = [
    {
      label: 'Runtime telemetry',
      status: presentation.isLive ? 'live' : presentation.isUsable ? 'partial' : 'unsupported',
      detail: sample ? `${presentation.label} provider path with ${sample.history.length} recent samples` : 'Waiting for first hardware sample',
    },
    {
      label: 'CPU package sensor',
      status: sample?.cpu.temperature != null ? 'live' : 'partial',
      detail: sample?.cpu.temperature != null ? `${Math.round(sample.cpu.temperature)}C package telemetry available` : 'Low-level provider or OEM sensor row still required',
    },
    {
      label: 'GPU telemetry',
      status: sample?.gpu.temperature != null || (sample?.gpu.usage ?? 0) > 0 ? 'live' : 'partial',
      detail: `${gpuProvider} path${sample?.gpu.temperature != null ? ` with ${Math.round(sample.gpu.temperature)}C temperature` : ' with reduced sensor depth'}`,
    },
    {
      label: 'Storage headroom',
      status: storageMaxUsed >= 92 ? 'unsupported' : storageMaxUsed >= 82 ? 'partial' : 'live',
      detail: sample?.storage.length ? `Highest used drive ${Math.round(storageMaxUsed)}%` : 'Storage inventory pending',
    },
    {
      label: 'Support bundle readiness',
      status: native ? 'live' : 'partial',
      detail: native ? 'Diagnostics export is available locally' : 'Desktop app required for native diagnostics export',
    },
  ];
  const supportContext = [
    `${brand.productName} support context`,
    `Created: ${new Date().toLocaleString()}`,
    `Passport ID: ${provisionedValue(buildIdentity.serial) !== 'not provisioned' ? provisionedValue(buildIdentity.serial) : passportId}`,
    `Build date: ${provisionedValue(buildIdentity.buildDate)}`,
    `Customer profile: ${provisionedValue(buildIdentity.customerBuildProfile)}`,
    `Motherboard: ${passportBoardName}`,
    `CPU: ${cpuName}`,
    `GPU: ${passportGpuName}`,
    `RAM: ${passportRam}`,
    `Storage: ${passportStorage}`,
    `QC seal: ${provisionedValue(buildIdentity.qcSeal)}`,
    `Warranty tier: ${provisionedValue(buildIdentity.warrantyTier)}`,
    `Support tier: ${provisionedValue(buildIdentity.supportTier) !== 'not provisioned' ? provisionedValue(buildIdentity.supportTier) : (presentation.isLive ? 'Premium Care' : 'Guided Support')}`,
    `Telemetry: ${presentation.label} (${presentation.state})`,
    `Provider: ${gpuProvider}`,
    `Score: ${score.value} / ${score.grade}`,
    `Capabilities: ${liveCapabilities} live lanes`,
    `Storage headroom: ${sample?.storage.length ? `highest used drive ${Math.round(storageMaxUsed)}%` : 'inventory pending'}`,
  ].join('\n');

  async function copySupportContext() {
    try {
      await navigator.clipboard.writeText(supportContext);
      setCopyState('copied');
      recordCompanionAction('support', 'Copied Passport support context', `${buildRecordLabel} - ${presentation.label}`);
      window.setTimeout(() => setCopyState('idle'), 2200);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 2600);
    }
  }

  const scoreChip = (
    <div className="passport-score-chip" title={brand.dashboardHeroTitle}>
      <span>{brand.shortName} Score</span>
      <strong><AnimatedValue value={score.value} format={(v) => Math.round(v).toString()} /></strong>
      <small>{score.grade}</small>
    </div>
  );

  useEffect(() => {
    let disposed = false;
    getHardwareCapabilities()
      .then((result) => {
        if (!disposed) setCapabilities(result);
      })
      .catch(() => {
        if (!disposed) setCapabilities([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className={embedded ? 'settings-subpage' : 'page'}>
      {!embedded && (
        <PageHeader
          eyebrow="OEM identity"
          title="System Passport"
          description="Per-system identity, telemetry confidence, and deployment-grade readiness in a premium support format."
          action={scoreChip}
        />
      )}
      {embedded && (
        <div className="embedded-page-intro">
          <div>
            <span className="eyebrow">OEM identity</span>
            <h2>System Passport</h2>
            <p>Per-system identity, telemetry confidence, and deployment-grade readiness.</p>
          </div>
          {scoreChip}
        </div>
      )}

      {!native && (
        <div className="notice notice-preview">
          Browser preview mode. Passport values are generated from simulated telemetry.
        </div>
      )}

      <div className="passport-grid">
        <motion.div {...entranceProps(0, animateEntrance)}>
        <Panel className="passport-hero">
          <div className="passport-ambient" aria-hidden="true" />
          <div className="passport-hero-top">
            <div>
              <span className="eyebrow">Identity status</span>
              <h2>{provisionedBuildFields > 0 ? 'Ownership profile provisioned' : 'Ownership profile calibrated'}</h2>
              <p>{score.summary}</p>
            </div>
            <div className="passport-grade-badge">Grade {score.grade}</div>
          </div>
          <div className="passport-pillars">
            {score.pillars.map((pillar) => (
              <div className="passport-pillar" key={pillar.id}>
                <strong>{pillar.label}</strong>
                <span><AnimatedValue value={pillar.score} format={(v) => `${Math.round(v)}/100`} /></span>
                <small>{pillar.detail}</small>
              </div>
            ))}
          </div>
        </Panel>
        </motion.div>

        <motion.div {...entranceProps(1, animateEntrance)}>
        <Panel className="passport-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">System fingerprint</span>
              <h2>Hardware identity</h2>
            </div>
            <BadgeCheck size={18} />
          </div>
          <div className="passport-vendor-strip" aria-label="OEM identity assets">
            {cpuLogo && <img src={cpuLogo} alt="CPU vendor" loading="lazy" decoding="async" />}
            {gpuLogo && <img src={gpuLogo} alt="GPU vendor" loading="lazy" decoding="async" />}
            {boardLogo && <img src={boardLogo} alt="Mainboard OEM" loading="lazy" decoding="async" />}
          </div>
          <dl className="passport-dl">
            <dt><Cpu size={15} /> CPU</dt>
            <dd>{cpuName}</dd>
            <dt><MonitorUp size={15} /> GPU</dt>
            <dd>{passportGpuName}</dd>
            <dt><CircuitBoard size={15} /> Motherboard</dt>
            <dd>{passportBoardName}</dd>
            <dt><Cpu size={15} /> RAM</dt>
            <dd>{passportRam}</dd>
            <dt><HardDrive size={15} /> Storage</dt>
            <dd>{passportStorage}</dd>
            <dt><FileClock size={15} /> BIOS</dt>
            <dd>{systemInfo?.bios ?? 'Pending detection'}</dd>
          </dl>
        </Panel>
        </motion.div>

        <motion.div {...entranceProps(2, animateEntrance)}>
        <Panel className="passport-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OEM attestations</span>
              <h2>Deployment metadata</h2>
            </div>
            <Award size={18} />
          </div>
          <div className="passport-metadata-grid">
            <PassportField label="Passport ID" value={provisionedValue(buildIdentity.serial) !== 'not provisioned' ? provisionedValue(buildIdentity.serial) : passportId} />
            <PassportField label="Build date" value={provisionedValue(buildIdentity.buildDate)} />
            <PassportField label="Customer profile" value={provisionedValue(buildIdentity.customerBuildProfile)} />
            <PassportField label="QC seal" value={provisionedValue(buildIdentity.qcSeal)} />
            <PassportField label="Warranty tier" value={provisionedValue(buildIdentity.warrantyTier)} />
            <PassportField label="Support tier" value={provisionedValue(buildIdentity.supportTier) !== 'not provisioned' ? provisionedValue(buildIdentity.supportTier) : (presentation.isLive ? 'Premium Care' : 'Guided Support')} />
            <PassportField label="Firmware summary" value={systemInfo?.bios ?? 'Firmware metadata pending'} />
            <PassportField label="Build identity" value={`${buildRecordLabel} - ${systemInfo?.windows ?? 'Windows'} - ${score.grade} profile`} />
          </div>
        </Panel>
        </motion.div>

        <motion.div {...entranceProps(3, animateEntrance)}>
        <Panel className="passport-panel wide passport-support-context">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Support handoff</span>
              <h2>Build context</h2>
            </div>
            <button className="secondary-button" type="button" onClick={copySupportContext}>
              <ClipboardCopy size={15} />
              <span>{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy context'}</span>
            </button>
          </div>
          <pre>{supportContext}</pre>
        </Panel>
        </motion.div>

        <motion.div {...entranceProps(4, animateEntrance)}>
        <Panel className="passport-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Access confidence</span>
              <h2>Telemetry access matrix</h2>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="passport-matrix">
            {capabilities.length > 0 ? capabilities.map((capability) => (
              <MatrixRow
                key={capability.id}
                label={capability.label}
                status={capability.state === 'live' ? 'live' : capability.state === 'unsupported' ? 'unsupported' : 'partial'}
                detail={`${capability.detail}${capability.writeSafe ? ' - write-safe' : ' - read-only'}`}
              />
            )) : (
              <MatrixRow label="Capability registry" status="partial" detail="Awaiting backend capability snapshot" />
            )}
          </div>
        </Panel>
        </motion.div>

        <motion.div {...entranceProps(5, animateEntrance)}>
        <Panel className="passport-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Care</span>
              <h2>Owner readiness checklist</h2>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="passport-care-list">
            {careItems.map((item) => (
              <MatrixRow key={item.label} label={item.label} status={item.status} detail={item.detail} />
            ))}
          </div>
        </Panel>
        </motion.div>
      </div>
    </div>
  );
}

function PassportField({ label, value }: { label: string; value: string }) {
  return (
    <div className="passport-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatrixRow({ label, status, detail }: { label: string; status: 'live' | 'partial' | 'unsupported'; detail: string }) {
  return (
    <div className="passport-matrix-row">
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <span className={status === 'live' ? 'matrix-state live' : status === 'unsupported' ? 'matrix-state unsupported' : 'matrix-state partial'}>{status === 'live' ? 'Live' : status === 'unsupported' ? 'Unsupported' : 'Partial'}</span>
    </div>
  );
}
