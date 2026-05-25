import { Fan, HardDrive, MemoryStick, MonitorUp, Power, Thermometer } from 'lucide-react';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { temp } from '../lib/format';
import { Panel } from './Panel';

type Zone = {
  id: string;
  label: string;
  value: number | null;
  detail: string;
  icon: typeof Thermometer;
  x: number;
  y: number;
  componentClass: string;
};

export function ThermalCaseView() {
  const { sample } = useMonitor();
  const { settings } = useSettings();
  const storageTemp = sample?.storage.find((drive) => drive.temperature != null)?.temperature ?? null;
  const primaryStorage = sample?.storage[0];
  const cpuTemp = sample?.cpu.temperature ?? null;
  const gpuTemp = sample?.gpu.temperature ?? null;

  const zones: Zone[] = [
    {
      id: 'cpu',
      label: 'CPU socket',
      value: cpuTemp,
      detail: sample ? `${Math.round(sample.cpu.usage)}% CPU load${cpuTemp == null ? ' · package sensor unavailable' : ''}` : 'Awaiting CPU sample',
      icon: Thermometer,
      x: 42,
      y: 30,
      componentClass: 'case-cpu',
    },
    {
      id: 'ram',
      label: 'Memory bank',
      value: null,
      detail: sample ? `${Math.round(sample.memory.usage)}% memory load · no DIMM temperature sensor` : 'Awaiting memory sample',
      icon: MemoryStick,
      x: 68,
      y: 30,
      componentClass: 'case-ram',
    },
    {
      id: 'gpu',
      label: 'Graphics card',
      value: gpuTemp,
      detail: sample ? `${Math.round(sample.gpu.usage)}% GPU load${gpuTemp == null ? ' · temperature pending' : ''}` : 'Awaiting GPU sample',
      icon: MonitorUp,
      x: 50,
      y: 61,
      componentClass: 'case-gpu',
    },
    {
      id: 'storage',
      label: 'NVMe / SSD',
      value: storageTemp,
      detail: primaryStorage
        ? `${Math.round(primaryStorage.usedPercent)}% used${storageTemp == null ? ' · SMART temp unavailable' : ''}`
        : 'Drive scan pending',
      icon: HardDrive,
      x: 25,
      y: 45,
      componentClass: 'case-storage',
    },
    {
      id: 'psu',
      label: 'PSU bay',
      value: null,
      detail: sample?.gpu.powerWatts ? `${sample.gpu.powerWatts.toFixed(0)} W GPU power · no PSU sensor` : 'No PSU or ambient sensor exposed',
      icon: Power,
      x: 26,
      y: 82,
      componentClass: 'case-psu',
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
          <div className="case-glass" />
          <div className="case-motherboard" />
          {zones.map((zone) => (
            <div className={`case-component ${zone.componentClass} heat-${heatBand(zone.value)}`} key={`${zone.id}-component`} />
          ))}
          <span className="case-glow cpu-glow" style={{ opacity: intensity(cpuTemp, maxTemp) }} />
          <span className="case-glow gpu-glow" style={{ opacity: intensity(gpuTemp, maxTemp) }} />
          <div className="case-fan fan-top"><Fan size={22} /></div>
          <div className="case-fan fan-front"><Fan size={22} /></div>
          <div className="case-fan fan-rear"><Fan size={22} /></div>
          {zones.map((zone, index) => (
            <button
              type="button"
              className={`case-pin heat-${heatBand(zone.value)}`}
              key={zone.id}
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              title={`${zone.label}: ${temp(zone.value, settings.monitoring.temperatureUnit)}`}
              aria-label={`${index + 1}. ${zone.label}: ${temp(zone.value, settings.monitoring.temperatureUnit)}`}
            />
          ))}
          <div className="airflow-line intake" />
          <div className="airflow-line exhaust" />
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
          )})}
        </div>
      </div>
    </Panel>
  );
}

function heatBand(value: number | null) {
  if (value == null) return 'unknown';
  if (value >= 78) return 'hot';
  if (value >= 62) return 'warm';
  return 'cool';
}

function intensity(value: number | null, maxTemp: number) {
  if (value == null) return 0.16;
  return Math.min(Math.max(value / maxTemp, 0.2), 0.92);
}
