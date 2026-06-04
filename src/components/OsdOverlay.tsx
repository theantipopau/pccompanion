import { motion } from 'framer-motion';
import { Cpu, Fan, Gauge, MemoryStick, MonitorUp, Move } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { brand } from '../lib/branding';
import { gb, mhz, pct, temp } from '../lib/format';

type OsdOverlayProps = {
  forceVisible?: boolean;
};

export function OsdOverlay({ forceVisible = false }: OsdOverlayProps) {
  const { sample } = useMonitor();
  const { settings, updateSettings } = useSettings();
  const dragRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(
    () => [
      { id: 'cpuTemp', label: 'CPU', value: temp(sample?.cpu.temperature ?? null, settings.monitoring.temperatureUnit), detail: sample ? pct(sample.cpu.usage) : 'scan', icon: Cpu },
      { id: 'gpuTemp', label: 'GPU', value: temp(sample?.gpu.temperature ?? null, settings.monitoring.temperatureUnit), detail: sample ? pct(sample.gpu.usage) : 'scan', icon: MonitorUp },
      { id: 'ramUsage', label: 'RAM', value: sample ? pct(sample.memory.usage) : 'scan', detail: sample ? `${gb(sample.memory.usedGb)} / ${gb(sample.memory.totalGb)}` : 'scan', icon: MemoryStick },
      {
        id: 'vramUsage',
        label: 'VRAM',
        value: sample?.gpu.vramTotalGb ? `${sample.gpu.vramUsedGb.toFixed(1)} GB` : 'No VRAM',
        detail: sample?.gpu.vramTotalGb ? `of ${sample.gpu.vramTotalGb.toFixed(0)} GB` : 'pending',
        icon: MonitorUp,
      },
      { id: 'fps', label: 'FPS', value: '--', detail: 'not wired', icon: Gauge },
      {
        id: 'clocks',
        label: 'CLK',
        value: sample ? mhz(sample.cpu.clockMhz) : 'scan',
        detail: sample ? `GPU ${mhz(sample.gpu.coreClockMhz)}` : 'scan',
        icon: Cpu,
      },
      {
        id: 'fans',
        label: 'FAN',
        value: sample?.gpu.fanPct != null
          ? `${sample.gpu.fanPct}%`
          : sample?.fans[0]?.rpm != null
          ? `${sample.fans[0].rpm} RPM`
          : 'No fan',
        detail: sample?.gpu.powerWatts != null ? `${sample.gpu.powerWatts.toFixed(0)} W GPU` : 'cooling',
        icon: Fan,
      },
    ],
    [sample, settings.monitoring.temperatureUnit],
  ).filter((metric) => settings.overlay.metrics.includes(metric.id as never));

  if (!forceVisible && !settings.overlay.enabled) return null;

  return (
    <motion.div
      ref={dragRef}
      className={`osd-overlay osd-${settings.overlay.preset}`}
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: settings.overlay.opacity,
        scale: settings.overlay.scale,
        x: settings.overlay.position.x,
        y: settings.overlay.position.y,
      }}
      exit={{ opacity: 0, scale: 0.96 }}
      onDragEnd={(_, info) => {
        updateSettings((current) => ({
          ...current,
          overlay: {
            ...current.overlay,
            position: {
              x: current.overlay.position.x + info.offset.x,
              y: current.overlay.position.y + info.offset.y,
            },
          },
        }));
      }}
    >
      <div className="osd-grip" title="Drag overlay">
        <Move size={13} />
        <span>{brand.shortName} OSD</span>
      </div>
      <div className="osd-metrics">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="osd-metric" key={metric.id}>
              <Icon size={14} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
