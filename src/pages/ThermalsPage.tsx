import { Activity, Fan, Gauge, MonitorUp, Thermometer, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { ThermalCaseView } from '../components/ThermalCaseView';
import { useMonitor } from '../context/MonitorContext';
import { useSettings } from '../context/SettingsContext';
import { mbps, mhz, pct, temp } from '../lib/format';

export function ThermalsPage() {
  const { systemInfo, sample } = useMonitor();
  const { settings } = useSettings();
  const gpuVendor = systemInfo?.gpuVendor ?? 'unknown';
  const isIntelArc = gpuVendor === 'intel';

  const gpuVendorLabel = gpuVendor === 'nvidia'
    ? 'NVIDIA via NVML'
    : gpuVendor === 'amd'
    ? 'AMD via ADL2'
    : gpuVendor === 'intel'
    ? 'Intel Arc via WMI'
    : 'Vendor telemetry';

  return (
    <div className="page">
      <PageHeader
        eyebrow="Monitoring"
        title="Thermals"
        description="A physical view of heat, airflow, and component load across a typical Radium PCs gaming or workstation build."
      />
      <div className="thermals-grid">
        <ThermalCaseView />
        <div className="thermal-side">
          <MetricCard
            icon={Thermometer}
            label="CPU thermal headroom"
            value={temp(sample?.cpu.temperature ?? null, settings.monitoring.temperatureUnit)}
            detail={sample ? `${pct(sample.cpu.usage)} load - ${mhz(sample.cpu.clockMhz)}` : 'Awaiting sensor'}
            progress={sample?.cpu.temperature ?? 0}
          />
          <MetricCard
            icon={Activity}
            label="GPU thermal headroom"
            value={temp(sample?.gpu.temperature ?? null, settings.monitoring.temperatureUnit)}
            detail={sample ? `${pct(sample.gpu.usage)} load - ${mhz(sample.gpu.coreClockMhz)}` : 'Awaiting sensor'}
            progress={sample?.gpu.temperature ?? 0}
            tone="green"
          />
          <MetricCard
            icon={Fan}
            label="Cooling response"
            value={sample?.fans[0]?.rpm ? `${sample.fans[0].rpm} RPM` : sample?.gpu.fanPct != null ? `${sample.gpu.fanPct}% GPU` : 'N/A'}
            detail={sample ? `${sample.fans.length} fan channels detected` : 'Awaiting scan'}
            progress={sample?.fans[0]?.rpm ? Math.min(sample.fans[0].rpm / 18, 100) : sample?.gpu.fanPct ?? 0}
            tone="amber"
          />
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
                <DetailRow icon={Gauge} label="GPU load" value={sample ? pct(sample.gpu.usage) : 'Scanning'} />
                <div className="intel-arc-notice">
                  Intel Arc telemetry is limited to GPU usage % via WMI. Temperature, fan speed, clocks, and power draw require Intel IGCL support, which is not yet implemented.
                </div>
              </div>
            ) : (
              <div className="detail-rows">
                <DetailRow icon={Gauge} label="Core clock" value={sample ? mhz(sample.gpu.coreClockMhz) : 'Scanning'} />
                <DetailRow icon={Gauge} label="Memory clock" value={sample ? mhz(sample.gpu.memoryClockMhz) : 'Scanning'} />
                <DetailRow icon={Zap} label="Power" value={sample?.gpu.powerWatts ? `${sample.gpu.powerWatts.toFixed(0)} W` : 'Pending'} />
                <DetailRow icon={Fan} label="GPU fan" value={sample?.gpu.fanPct != null ? `${sample.gpu.fanPct}%` : sample?.fans.find(f => f.label.toLowerCase().includes('gpu'))?.rpm != null ? `${sample.fans.find(f => f.label.toLowerCase().includes('gpu'))!.rpm} RPM` : 'Pending'} />
              </div>
            )}
          </Panel>
          <Panel className="airflow-notes">
            <span className="eyebrow">Airflow model</span>
            <h2>Front intake, rear/top exhaust</h2>
            <p>Current visualisation maps sensor zones to a common tower layout. Future build profiles can store exact radiator, fan, and motherboard positions per Radium PCs configuration.</p>
            <small>Network telemetry for overlay sync: {sample ? mbps(sample.network.downMbps) : 'Scanning'}</small>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="detail-row">
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
