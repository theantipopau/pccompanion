import { Activity, Fan, Gauge, MonitorUp, Thermometer, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AnimatedValue } from '../components/AnimatedValue';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ThermalCaseView } from '../components/ThermalCaseView';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { brand } from '../lib/branding';
import { oemLogoForText, vendorFromProvider, vendorFromText, vendorLogo } from '../lib/assets';
import { LOADING_VALUE, NOT_EXPOSED, mbps, mhz, pct, temp } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import type { Vendor } from '../types/system';

function cleanIdentity(value?: string | null) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (/query|detect|pending|initialising|initializing|unknown/i.test(trimmed)) return null;
  return trimmed;
}

function firstKnownVendor(candidates: Vendor[]) {
  return candidates.find((candidate) => candidate !== 'unknown') ?? 'unknown';
}

const ENTRANCE_STEP_DELAY = 0.06;

function entranceProps(index: number, animate: boolean) {
  return animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * ENTRANCE_STEP_DELAY, duration: 0.24, ease: EASE_OUT },
      }
    : { initial: false as const };
}

export function ThermalsPage() {
  const { systemInfo, sample: rawSample, displaySample } = useMonitor();
  const { settings } = useSettings();
  const sample = displaySample ?? rawSample;
  const animateEntrance = settings.experience.animations;
  const cpuName = cleanIdentity(systemInfo?.cpu) ?? 'CPU package';
  const gpuName = cleanIdentity(sample?.gpu.name) ?? cleanIdentity(systemInfo?.gpu) ?? 'Graphics card';
  const cpuVendor = firstKnownVendor([
    systemInfo?.cpuVendor ?? 'unknown',
    vendorFromText(cpuName),
  ]);
  const gpuVendor = firstKnownVendor([
    sample?.gpu.vendor ?? 'unknown',
    vendorFromProvider(sample?.gpu.provider),
    systemInfo?.gpuVendor ?? 'unknown',
    vendorFromText(gpuName),
  ]);
  const isIntelArc = gpuVendor === 'intel';
  const cpuTemp = sample?.cpu.temperature ?? null;
  const gpuTemp = sample?.gpu.temperature ?? null;
  const cpuTempAvailable = cpuTemp != null;
  const fanChannelCount = sample?.fans.filter((fan) => fan.rpm != null || fan.pct != null).length ?? 0;

  const gpuVendorLabel = sample?.gpu.provider === 'nvml' || gpuVendor === 'nvidia'
    ? 'NVIDIA via NVML'
    : sample?.gpu.provider === 'adl2' || gpuVendor === 'amd'
    ? 'AMD via ADL2'
    : sample?.gpu.provider === 'igcl' || gpuVendor === 'intel'
    ? 'Intel Arc via WMI'
    : 'Vendor telemetry';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Monitoring"
        title="Thermals"
        description={brand.mode === 'demo'
          ? 'A physical view of heat, airflow, and component load across a typical gaming or workstation build.'
          : `A physical view of heat, airflow, and component load across a typical ${brand.name} gaming or workstation build.`}
      />
      <div className="thermals-grid">
        <ThermalCaseView />
        <div className="thermal-side">
          <motion.div {...entranceProps(0, animateEntrance)}>
            <MetricCard
              icon={Thermometer}
              label={cpuTempAvailable ? 'CPU package temperature' : 'CPU load'}
              componentName={cpuName}
              vendorAssetSrc={oemLogoForText(cpuName) ?? vendorLogo(cpuVendor)}
              vendorAssetAlt={`${cpuName} logo`}
              value={cpuTempAvailable ? temp(cpuTemp, settings.monitoring.temperatureUnit) : sample ? pct(sample.cpu.usage) : LOADING_VALUE}
              detail={sample ? `${cpuTempAvailable ? pct(sample.cpu.usage) : 'Package temperature requires provider'} - ${mhz(sample.cpu.clockMhz)}` : LOADING_VALUE}
              progress={cpuTempAvailable ? cpuTemp ?? 0 : sample?.cpu.usage ?? 0}
            />
          </motion.div>
          <motion.div {...entranceProps(1, animateEntrance)}>
            <MetricCard
              icon={Activity}
              label="GPU thermal headroom"
              componentName={gpuName}
              vendorAssetSrc={oemLogoForText(gpuName) ?? vendorLogo(gpuVendor)}
              vendorAssetAlt={`${gpuName} logo`}
              value={temp(gpuTemp, settings.monitoring.temperatureUnit)}
              detail={sample ? `${pct(sample.gpu.usage)} load - ${mhz(sample.gpu.coreClockMhz)}` : LOADING_VALUE}
              progress={gpuTemp ?? 0}
              tone="green"
            />
          </motion.div>
          <motion.div {...entranceProps(2, animateEntrance)}>
            <MetricCard
              icon={Fan}
              label="Cooling response"
              value={sample?.fans[0]?.rpm ? `${sample.fans[0].rpm} RPM` : sample?.gpu.fanPct != null ? `${sample.gpu.fanPct}% GPU` : sample ? NOT_EXPOSED : LOADING_VALUE}
              detail={sample ? (fanChannelCount > 0 ? `${fanChannelCount} fan channel${fanChannelCount === 1 ? '' : 's'} detected` : 'No board fan controller exposed yet') : LOADING_VALUE}
              progress={sample?.fans[0]?.rpm ? Math.min(sample.fans[0].rpm / 18, 100) : sample?.gpu.fanPct ?? 0}
              tone="amber"
            />
          </motion.div>
          <motion.div {...entranceProps(3, animateEntrance)}>
            <Panel className="thermal-mini-table">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">GPU detail</span>
                  <h2>{gpuVendorLabel}</h2>
                </div>
                <MonitorUp size={18} />
              </div>
              {isIntelArc ? (
                <div className="detail-rows">
                  <DetailRow icon={Gauge} label="GPU load" value={sample ? <AnimatedValue value={sample.gpu.usage} format={pct} /> : LOADING_VALUE} />
                  <div className="intel-arc-notice">
                    Intel Arc telemetry is limited to GPU usage % via WMI. Temperature, fan speed, clocks, and power draw require Intel IGCL support, which is not yet implemented.
                  </div>
                </div>
              ) : (
                <div className="detail-rows">
                  <DetailRow icon={Gauge} label="Core clock" value={sample ? <AnimatedValue value={sample.gpu.coreClockMhz} format={mhz} /> : LOADING_VALUE} />
                  <DetailRow icon={Gauge} label="Memory clock" value={sample ? <AnimatedValue value={sample.gpu.memoryClockMhz} format={mhz} /> : LOADING_VALUE} />
                  <DetailRow icon={Zap} label="Power" value={sample?.gpu.powerWatts ? <AnimatedValue value={sample.gpu.powerWatts} format={(v) => `${v.toFixed(0)} W`} /> : sample ? NOT_EXPOSED : LOADING_VALUE} />
                  <DetailRow icon={Fan} label="GPU fan" value={sample?.gpu.fanPct != null ? <AnimatedValue value={sample.gpu.fanPct} format={(v) => `${Math.round(v)}%`} /> : sample?.fans.find(f => f.label.toLowerCase().includes('gpu'))?.rpm != null ? <AnimatedValue value={sample.fans.find(f => f.label.toLowerCase().includes('gpu'))!.rpm!} format={(v) => `${Math.round(v)} RPM`} /> : sample ? NOT_EXPOSED : LOADING_VALUE} />
                </div>
              )}
            </Panel>
          </motion.div>
          <motion.div {...entranceProps(4, animateEntrance)}>
            <Panel className="airflow-notes">
              <span className="eyebrow">Sensor accuracy</span>
              <h2>Measured values only</h2>
              <p>The thermal map only shows temperatures that are actually reported by hardware providers. CPU package temperature on this build needs a hardware monitor bridge or provider integration before it can be displayed.</p>
              <small>Network telemetry for overlay sync: {sample ? mbps(sample.network.downMbps) : LOADING_VALUE}</small>
            </Panel>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="detail-row">
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
