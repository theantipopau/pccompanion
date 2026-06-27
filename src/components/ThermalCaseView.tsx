import { Cpu, Fan, HardDrive, MemoryStick, MonitorUp, Power, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { pct, temp } from '../lib/format';
import type { Vendor } from '../types/system';
import { Panel } from './Panel';

const thermalChamberImage = new URL('../../images/thermal-chamber-premium.png', import.meta.url).href;

type Zone = {
  id: string;
  label: string;
  value: number | null;
  detail: string;
  icon: LucideIcon;
  confidence: 'live' | 'proxy' | 'unavailable';
};

export function ThermalCaseView() {
  const { sample: rawSample, displaySample, systemInfo } = useMonitor();
  const { settings } = useSettings();
  const sample = displaySample ?? rawSample;
  const storageTemp = sample?.storage.find((drive) => drive.temperature != null)?.temperature ?? null;
  const primaryStorage = sample?.storage[0];
  const cpuTemp = sample?.cpu.temperature ?? null;
  const gpuTemp = sample?.gpu.temperature ?? null;
  const cpuName = cleanIdentity(systemInfo?.cpu) ?? 'CPU package';
  const gpuName = cleanIdentity(sample?.gpu.name) ?? cleanIdentity(systemInfo?.gpu) ?? 'Graphics card';
  const cpuVendor = firstKnownVendor([systemInfo?.cpuVendor ?? 'unknown', vendorFromText(cpuName)]);
  const gpuVendor = firstKnownVendor([
    sample?.gpu.vendor ?? 'unknown',
    vendorFromProvider(sample?.gpu.provider),
    systemInfo?.gpuVendor ?? 'unknown',
    vendorFromText(gpuName),
  ]);
  const cpuVendorAsset = oemLogoForText(cpuName) ?? vendorLogo(cpuVendor);
  const gpuVendorAsset = oemLogoForText(gpuName) ?? vendorLogo(gpuVendor);
  const cpuFan = sample?.fans.find((fan) => fan.label.toLowerCase().includes('cpu'));
  const gpuFan = sample?.fans.find((fan) => fan.label.toLowerCase().includes('gpu'));
  const firstFan = sample?.fans.find((fan) => fan.rpm != null || fan.pct != null);
  const gpuFanLive = sample?.gpu.fanPct != null || gpuFan?.rpm != null;
  const liveSignalCount = [
    cpuTemp != null,
    gpuTemp != null,
    storageTemp != null,
    Boolean(firstFan),
  ].filter(Boolean).length;
  const confidenceSummary = `${liveSignalCount}/4 thermal signal groups live`;

  const zones: Zone[] = [
    {
      id: 'cpu',
      label: 'CPU socket',
      value: cpuTemp,
      detail: sample ? `${Math.round(sample.cpu.usage)}% CPU load${cpuTemp == null ? ' - package sensor unavailable' : ''}` : 'Awaiting CPU sample',
      icon: Thermometer,
      confidence: cpuTemp == null ? 'proxy' : 'live',
    },
    {
      id: 'ram',
      label: 'Memory bank',
      value: null,
      detail: sample ? `${Math.round(sample.memory.usage)}% memory load - no DIMM temperature sensor` : 'Awaiting memory sample',
      icon: MemoryStick,
      confidence: 'proxy',
    },
    {
      id: 'gpu',
      label: 'Graphics card',
      value: gpuTemp,
      detail: sample ? `${Math.round(sample.gpu.usage)}% GPU load${gpuTemp == null ? ' - temperature pending' : ''}` : 'Awaiting GPU sample',
      icon: MonitorUp,
      confidence: gpuTemp == null ? 'proxy' : 'live',
    },
    {
      id: 'storage',
      label: 'NVMe / SSD',
      value: storageTemp,
      detail: primaryStorage
        ? `${Math.round(primaryStorage.usedPercent)}% used${storageTemp == null ? ' - SMART temp unavailable' : ''}`
        : 'Drive scan pending',
      icon: HardDrive,
      confidence: storageTemp == null ? 'unavailable' : 'live',
    },
    {
      id: 'psu',
      label: 'PSU bay',
      value: null,
      detail: sample?.gpu.powerWatts ? `${sample.gpu.powerWatts.toFixed(0)} W GPU power - no PSU sensor` : 'No PSU or ambient sensor exposed',
      icon: Power,
      confidence: sample?.gpu.powerWatts ? 'proxy' : 'unavailable',
    },
  ];

  const maxTemp = Math.max(cpuTemp ?? 0, gpuTemp ?? 0, storageTemp ?? 0, 1);

  return (
    <Panel className="thermal-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Thermal map</span>
          <h2>Case airflow visualisation</h2>
        </div>
        <Fan size={19} />
      </div>

      <div className="case-visual">
        <div className="case-frame">
          <img className="case-backdrop" src={thermalChamberImage} alt="" aria-hidden="true" decoding="async" />
          <div className="case-backdrop-scrim" />
          <span className="case-glow cpu-glow" style={{ opacity: intensity(cpuTemp, maxTemp) }} />
          <span className="case-glow gpu-glow" style={{ opacity: intensity(gpuTemp, maxTemp) }} />
          <span className="case-glow storage-glow" style={{ opacity: intensity(storageTemp, maxTemp) }} />
          <div className="case-heat-grid" aria-hidden="true">
            <span className={`heat-cell heat-${heatBand(cpuTemp)}`} />
            <span className={`heat-cell heat-${heatBand(gpuTemp)}`} />
            <span className={`heat-cell heat-${heatBand(storageTemp)}`} />
          </div>
          <div className="airflow-line intake" />
          <div className="airflow-line exhaust" />
          <div className="airflow-particles" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="case-confidence-strip" aria-label="Thermal sensor confidence">
            <span className={cpuTemp == null ? 'thermal-confidence-chip proxy' : 'thermal-confidence-chip live'}>CPU {cpuTemp == null ? 'load proxy' : 'temp live'}</span>
            <span className={gpuTemp == null ? 'thermal-confidence-chip proxy' : 'thermal-confidence-chip live'}>GPU {gpuTemp == null ? 'load proxy' : 'temp live'}</span>
            <span className={firstFan ? 'thermal-confidence-chip live' : 'thermal-confidence-chip unavailable'}>Fans {firstFan ? 'live' : 'pending'}</span>
          </div>

          <SensorBadge
            className="sensor-badge-cpu"
            icon={Cpu}
            label="CPU"
            value={cpuTemp == null ? pct(sample?.cpu.usage ?? 0) : temp(cpuTemp, settings.monitoring.temperatureUnit)}
            detail={cpuTemp == null ? 'Load proxy' : pct(sample?.cpu.usage ?? 0)}
            confidence={cpuTemp == null ? 'proxy' : 'live'}
            logo={cpuVendorAsset}
            logoAlt={`${cpuName} vendor`}
          />
          <SensorBadge
            className="sensor-badge-gpu"
            icon={MonitorUp}
            label="GPU"
            value={temp(gpuTemp, settings.monitoring.temperatureUnit)}
            detail={sample?.gpu.fanPct != null ? `${sample.gpu.fanPct}% fan` : gpuFan?.rpm != null ? `${gpuFan.rpm} RPM` : pct(sample?.gpu.usage ?? 0)}
            confidence={gpuTemp == null ? 'proxy' : 'live'}
            logo={gpuVendorAsset}
            logoAlt={`${gpuName} vendor`}
          />
          <SensorBadge
            className="sensor-badge-top-fans"
            icon={Fan}
            label="Top fans"
            value={fanValue(cpuFan ?? firstFan)}
            detail="Exhaust"
            confidence={(cpuFan ?? firstFan) ? 'live' : 'unavailable'}
          />
          <SensorBadge
            className="sensor-badge-front-fans"
            icon={Fan}
            label="Intake"
            value={fanValue(firstFan)}
            detail={sample?.gpu.powerWatts != null ? `${sample.gpu.powerWatts.toFixed(0)} W GPU` : 'Airflow'}
            confidence={gpuFanLive || firstFan ? 'live' : 'unavailable'}
          />
        </div>

        <div className="thermal-confidence-summary">
          <span className="eyebrow">Confidence</span>
          <strong>{confidenceSummary}</strong>
          <small>Temperature values use measured sensors only. Load proxies are labelled when a hardware temperature is not exposed.</small>
        </div>

        <div className="thermal-legend">
          {zones.map((zone, index) => {
            const Icon = zone.icon;
            return (
              <div className="thermal-row" key={zone.id}>
                <span className={`thermal-index heat-${heatBand(zone.value)}`}>{index + 1}</span>
                <div>
                  <strong><Icon size={14} /> {zone.label}</strong>
                  <small>{zone.detail}</small>
                </div>
                <b>
                  {zone.value == null ? confidenceLabel(zone.confidence) : temp(zone.value, settings.monitoring.temperatureUnit)}
                </b>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function SensorBadge({
  className,
  icon: Icon,
  label,
  value,
  detail,
  confidence,
  logo,
  logoAlt,
}: {
  className: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  confidence: 'live' | 'proxy' | 'unavailable';
  logo?: string | null;
  logoAlt?: string;
}) {
  return (
    <div className={`thermal-sensor-badge ${className} confidence-${confidence}`}>
      <span className="thermal-sensor-icon"><Icon size={14} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <em>{confidenceLabel(confidence)}</em>
      {logo && <img src={logo} alt={logoAlt ?? `${label} vendor`} loading="lazy" decoding="async" />}
    </div>
  );
}

function fanValue(fan?: { rpm: number | null; pct: number | null }) {
  if (!fan) return 'Unavailable';
  if (fan.rpm != null) return `${fan.rpm} RPM`;
  if (fan.pct != null) return `${fan.pct}%`;
  return 'Unavailable';
}

function cleanIdentity(value?: string | null) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (/query|detect|pending|initialising|initializing|unknown/i.test(trimmed)) return null;
  return trimmed;
}

function firstKnownVendor(candidates: Vendor[]) {
  return candidates.find((candidate) => candidate !== 'unknown') ?? 'unknown';
}

function heatBand(value: number | null) {
  if (value == null) return 'unknown';
  if (value >= 78) return 'hot';
  if (value >= 62) return 'warm';
  return 'cool';
}

function intensity(value: number | null, maxTemp: number) {
  if (value == null) return 0.08;
  return Math.min(Math.max(value / maxTemp, 0.18), 0.7);
}

function confidenceLabel(confidence: 'live' | 'proxy' | 'unavailable') {
  if (confidence === 'live') return 'Live';
  if (confidence === 'proxy') return 'Proxy';
  return 'Unavailable';
}
