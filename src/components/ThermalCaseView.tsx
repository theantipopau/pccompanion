import { Cpu, Fan, HardDrive, MemoryStick, MonitorUp, Power, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { assets, oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { pct, temp } from '../lib/format';
import type { Vendor } from '../types/system';
import { Panel } from './Panel';

type Zone = {
  id: string;
  label: string;
  value: number | null;
  detail: string;
  icon: LucideIcon;
};

export function ThermalCaseView() {
  const { sample, systemInfo } = useMonitor();
  const { settings } = useSettings();
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

  const zones: Zone[] = [
    {
      id: 'cpu',
      label: 'CPU socket',
      value: cpuTemp,
      detail: sample ? `${Math.round(sample.cpu.usage)}% CPU load${cpuTemp == null ? ' - package sensor unavailable' : ''}` : 'Awaiting CPU sample',
      icon: Thermometer,
    },
    {
      id: 'ram',
      label: 'Memory bank',
      value: null,
      detail: sample ? `${Math.round(sample.memory.usage)}% memory load - no DIMM temperature sensor` : 'Awaiting memory sample',
      icon: MemoryStick,
    },
    {
      id: 'gpu',
      label: 'Graphics card',
      value: gpuTemp,
      detail: sample ? `${Math.round(sample.gpu.usage)}% GPU load${gpuTemp == null ? ' - temperature pending' : ''}` : 'Awaiting GPU sample',
      icon: MonitorUp,
    },
    {
      id: 'storage',
      label: 'NVMe / SSD',
      value: storageTemp,
      detail: primaryStorage
        ? `${Math.round(primaryStorage.usedPercent)}% used${storageTemp == null ? ' - SMART temp unavailable' : ''}`
        : 'Drive scan pending',
      icon: HardDrive,
    },
    {
      id: 'psu',
      label: 'PSU bay',
      value: null,
      detail: sample?.gpu.powerWatts ? `${sample.gpu.powerWatts.toFixed(0)} W GPU power - no PSU sensor` : 'No PSU or ambient sensor exposed',
      icon: Power,
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
          <img className="case-backdrop" src={assets.thermalChamber} alt="" aria-hidden="true" />
          <div className="case-backdrop-scrim" />
          <span className="case-glow cpu-glow" style={{ opacity: intensity(cpuTemp, maxTemp) }} />
          <span className="case-glow gpu-glow" style={{ opacity: intensity(gpuTemp, maxTemp) }} />
          <div className="airflow-line intake" />
          <div className="airflow-line exhaust" />

          <SensorBadge
            className="sensor-badge-cpu"
            icon={Cpu}
            label="CPU"
            value={cpuTemp == null ? pct(sample?.cpu.usage ?? 0) : temp(cpuTemp, settings.monitoring.temperatureUnit)}
            detail={cpuTemp == null ? 'Load proxy' : pct(sample?.cpu.usage ?? 0)}
            logo={cpuVendorAsset}
            logoAlt={`${cpuName} vendor`}
          />
          <SensorBadge
            className="sensor-badge-gpu"
            icon={MonitorUp}
            label="GPU"
            value={temp(gpuTemp, settings.monitoring.temperatureUnit)}
            detail={sample?.gpu.fanPct != null ? `${sample.gpu.fanPct}% fan` : gpuFan?.rpm != null ? `${gpuFan.rpm} RPM` : pct(sample?.gpu.usage ?? 0)}
            logo={gpuVendorAsset}
            logoAlt={`${gpuName} vendor`}
          />
          <SensorBadge
            className="sensor-badge-top-fans"
            icon={Fan}
            label="Top fans"
            value={fanValue(cpuFan ?? firstFan)}
            detail="Exhaust"
          />
          <SensorBadge
            className="sensor-badge-front-fans"
            icon={Fan}
            label="Intake"
            value={fanValue(firstFan)}
            detail={sample?.gpu.powerWatts != null ? `${sample.gpu.powerWatts.toFixed(0)} W GPU` : 'Airflow'}
          />
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
                <b>{temp(zone.value, settings.monitoring.temperatureUnit)}</b>
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
  logo,
  logoAlt,
}: {
  className: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  logo?: string | null;
  logoAlt?: string;
}) {
  return (
    <div className={`thermal-sensor-badge ${className}`}>
      <span className="thermal-sensor-icon"><Icon size={14} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      {logo && <img src={logo} alt={logoAlt ?? `${label} vendor`} />}
    </div>
  );
}

function fanValue(fan?: { rpm: number | null; pct: number | null }) {
  if (!fan) return 'N/A';
  if (fan.rpm != null) return `${fan.rpm} RPM`;
  if (fan.pct != null) return `${fan.pct}%`;
  return 'N/A';
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
