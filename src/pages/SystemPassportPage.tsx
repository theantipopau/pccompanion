import { Award, BadgeCheck, CircuitBoard, Cpu, FileClock, HardDrive, MonitorUp, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { brand } from '../lib/branding';
import { oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { computePerformanceScore } from '../lib/performanceScore';
import { getHardwareCapabilities } from '../services/systemService';
import type { HardwareCapability, Vendor } from '../types/system';

export function SystemPassportPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { systemInfo, sample, native } = useMonitor();
  const [capabilities, setCapabilities] = useState<HardwareCapability[]>([]);
  const score = computePerformanceScore(sample);
  const liveCapabilities = capabilities.filter((capability) => capability.state === 'live').length;
  const normalizeIdentity = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || /query|detect|pending|unknown|initialising|initializing|system product name|to be filled/i.test(trimmed)) return null;
    return trimmed;
  };
  const cpuName = normalizeIdentity(systemInfo?.cpu) ?? 'Pending detection';
  const gpuName = normalizeIdentity(sample?.gpu.name) ?? normalizeIdentity(systemInfo?.gpu) ?? 'Pending detection';
  const boardName = normalizeIdentity(systemInfo?.motherboard) ?? 'Pending detection';
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
  const boardLogo = oemLogoForText(boardName);
  const passportIdSeed = `${cpuName}|${gpuName}|${systemInfo?.bios ?? 'bios'}`;
  const passportId = `RDM-${passportIdSeed
    .split('')
    .reduce((acc, char) => ((acc * 33) ^ char.charCodeAt(0)) >>> 0, 5381)
    .toString(16)
    .toUpperCase()
    .slice(0, 8)}`;
  const validationState = sample?.state === 'valid' ? 'Validated runtime profile' : sample?.state === 'degraded' ? 'Partial telemetry profile' : 'Telemetry baseline pending';
  const storageMaxUsed = sample?.storage.reduce((max, drive) => Math.max(max, drive.usedPercent), 0) ?? 0;
  const gpuProvider = sample?.gpu.provider?.toUpperCase() ?? 'Pending';
  const careItems: Array<{ label: string; status: 'live' | 'partial' | 'unsupported'; detail: string }> = [
    {
      label: 'Runtime telemetry',
      status: sample?.state === 'valid' ? 'live' : sample ? 'partial' : 'unsupported',
      detail: sample ? `${sample.state.toUpperCase()} provider path with ${sample.history.length} recent samples` : 'Waiting for first hardware sample',
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
  const scoreChip = (
    <div className="passport-score-chip" title={brand.dashboardHeroTitle}>
      <span>{brand.shortName} Score</span>
      <strong>{score.value}</strong>
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
        <Panel className="passport-hero">
          <div className="passport-ambient" aria-hidden="true" />
          <div className="passport-hero-top">
            <div>
              <span className="eyebrow">Identity status</span>
              <h2>Ownership profile calibrated</h2>
              <p>{score.summary}</p>
            </div>
            <div className="passport-grade-badge">Grade {score.grade}</div>
          </div>
          <div className="passport-pillars">
            {score.pillars.map((pillar) => (
              <div className="passport-pillar" key={pillar.id}>
                <strong>{pillar.label}</strong>
                <span>{pillar.score}/100</span>
                <small>{pillar.detail}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="passport-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">System fingerprint</span>
              <h2>Hardware identity</h2>
            </div>
            <BadgeCheck size={18} />
          </div>
          <div className="passport-vendor-strip" aria-label="OEM identity assets">
            {cpuLogo && <img src={cpuLogo} alt="CPU vendor" />}
            {gpuLogo && <img src={gpuLogo} alt="GPU vendor" />}
            {boardLogo && <img src={boardLogo} alt="Mainboard OEM" />}
          </div>
          <dl className="passport-dl">
            <dt><Cpu size={15} /> CPU</dt>
            <dd>{cpuName}</dd>
            <dt><MonitorUp size={15} /> GPU</dt>
            <dd>{gpuName}</dd>
            <dt><CircuitBoard size={15} /> Motherboard</dt>
            <dd>{boardName}</dd>
            <dt><HardDrive size={15} /> Storage</dt>
            <dd>{systemInfo?.storage?.join(' | ') ?? 'Pending detection'}</dd>
            <dt><FileClock size={15} /> BIOS</dt>
            <dd>{systemInfo?.bios ?? 'Pending detection'}</dd>
          </dl>
        </Panel>

        <Panel className="passport-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OEM attestations</span>
              <h2>Deployment metadata</h2>
            </div>
            <Award size={18} />
          </div>
          <div className="passport-metadata-grid">
            <PassportField label="Passport ID" value={passportId} />
            <PassportField label="Validation state" value={validationState} />
            <PassportField label="Telemetry confidence" value={`${liveCapabilities} live capability lanes`} />
            <PassportField label="Support tier" value={sample?.state === 'valid' ? 'Premium Care' : 'Guided Support'} />
            <PassportField label="Firmware summary" value={systemInfo?.bios ?? 'Firmware metadata pending'} />
            <PassportField label="Build identity" value={`${systemInfo?.windows ?? 'Windows'} · ${score.grade} profile`} />
          </div>
        </Panel>

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
                detail={`${capability.detail}${capability.writeSafe ? ' · write-safe' : ' · read-only'}`}
              />
            )) : (
              <MatrixRow label="Capability registry" status="partial" detail="Awaiting backend capability snapshot" />
            )}
          </div>
        </Panel>

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
