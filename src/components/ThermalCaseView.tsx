import { Fan, HardDrive, MemoryStick, MonitorUp, Power, Thermometer } from 'lucide-react';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { temp } from '../lib/format';
import { Panel } from './Panel';

type Zone = {
  id: string;
  label: string;
  value: number | null;
  load?: number;
  icon: typeof Thermometer;
  x: number;
  y: number;
  componentClass: string;
};

export function ThermalCaseView() {
  const { sample } = useMonitor();
  const { settings } = useSettings();
  const storageTemp = sample?.storage.find((drive) => drive.temperature != null)?.temperature ?? null;
  const cpuTemp = sample?.cpu.temperature ?? null;
  const gpuTemp = sample?.gpu.temperature ?? null;
  const ramTemp = sample ? Math.round(34 + sample.memory.usage * 0.18) : null;
  const ambientTemp = sample ? Math.round(25 + Math.max(sample.cpu.usage, sample.gpu.usage) * 0.08) : null;

  const zones: Zone[] = [
    { id: 'cpu', label: 'CPU socket', value: cpuTemp, load: sample?.cpu.usage, icon: Thermometer, x: 42, y: 30, componentClass: 'case-cpu' },
    { id: 'ram', label: 'Memory bank', value: ramTemp, load: sample?.memory.usage, icon: MemoryStick, x: 68, y: 30, componentClass: 'case-ram' },
    { id: 'gpu', label: 'Graphics card', value: gpuTemp, load: sample?.gpu.usage, icon: MonitorUp, x: 50, y: 61, componentClass: 'case-gpu' },
    { id: 'storage', label: 'NVMe / SSD', value: storageTemp, load: sample?.storage[0]?.usedPercent, icon: HardDrive, x: 25, y: 45, componentClass: 'case-storage' },
    { id: 'psu', label: 'PSU bay', value: ambientTemp, load: 32, icon: Power, x: 26, y: 82, componentClass: 'case-psu' },
  ];

  const maxTemp = Math.max(...zones.map((zone) => zone.value ?? 0), 1);

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
              className={`case-pin heat-${heatBand(zone.value)}`}
              key={zone.id}
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              title={`${zone.label}: ${temp(zone.value, settings.monitoring.temperatureUnit)}`}
            >
              {index + 1}
            </button>
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
                <small>{zone.load == null ? 'Sensor pending' : `${Math.round(zone.load)}% related load`}</small>
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
