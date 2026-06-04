import { Activity, BarChart3, CheckCircle2, ClipboardList, Gauge, Play, RotateCcw, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { mhz, pct, temp } from '../lib/format';
import type { HardwareSample } from '../types/system';

type CapturePoint = {
  timestamp: number;
  cpuTemp: number | null;
  cpuUsage: number;
  cpuClockMhz: number;
  gpuTemp: number | null;
  gpuUsage: number;
  gpuClockMhz: number;
  gpuFanPct: number | null;
  gpuPowerWatts: number | null;
  ramUsage: number;
};

type CaptureResult = {
  id: string;
  profile: string;
  startedAt: string;
  durationSec: number;
  pointCount: number;
  trustedSensors: string[];
  missingSensors: string[];
  cpuTempAvg: number | null;
  cpuTempMax: number | null;
  cpuUsageAvg: number;
  gpuTempAvg: number | null;
  gpuTempMax: number | null;
  gpuUsageAvg: number;
  gpuFanAvg: number | null;
  gpuPowerAvg: number | null;
  ramAvg: number;
};

const CAPTURE_SECONDS = 30;

export function BenchmarkPage() {
  const { sample, native } = useMonitor();
  const { settings } = useSettings();
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState<CapturePoint[]>([]);
  const [results, setResults] = useState<CaptureResult[]>([]);

  useEffect(() => {
    if (!running || startedAt == null) return undefined;
    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(Math.round((Date.now() - startedAt) / 1000), CAPTURE_SECONDS);
      setElapsed(nextElapsed);
      if (nextElapsed >= CAPTURE_SECONDS) {
        setRunning(false);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  useEffect(() => {
    if (!running || !sample) return;
    setPoints((current) => {
      const nextPoint = pointFromSample(sample);
      if (current[current.length - 1]?.timestamp === nextPoint.timestamp) return current;
      return [...current, nextPoint];
    });
  }, [running, sample]);

  useEffect(() => {
    if (running || startedAt == null || elapsed < CAPTURE_SECONDS || points.length === 0) return;
    const result = summarizeCapture(points, settings.experience.performanceProfile, startedAt, CAPTURE_SECONDS);
    setResults((current) => [result, ...current].slice(0, 4));
    setStartedAt(null);
  }, [elapsed, points, running, settings.experience.performanceProfile, startedAt]);

  const progress = Math.min((elapsed / CAPTURE_SECONDS) * 100, 100);
  const liveTrust = useMemo(() => trustSummary(sample), [sample]);
  const latestResult = results[0];
  const previousResult = results[1];

  function startCapture() {
    setPoints([]);
    setElapsed(0);
    setStartedAt(Date.now());
    setRunning(true);
  }

  function resetCapture() {
    setRunning(false);
    setStartedAt(null);
    setElapsed(0);
    setPoints([]);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Local benchmark"
        title="Benchmark Capture"
        description="Record a repeatable telemetry window before or after profile changes. Results stay local and only use trusted sensor channels."
        action={
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={resetCapture} disabled={!running && points.length === 0}>
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
            <button className="primary-button" type="button" onClick={startCapture} disabled={running || !sample}>
              <Play size={16} />
              <span>{running ? 'Capturing' : 'Start capture'}</span>
            </button>
          </div>
        }
      />

      <div className="benchmark-grid">
        <Panel className="benchmark-hero">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Capture window</span>
              <h2>{running ? `${elapsed}s / ${CAPTURE_SECONDS}s` : latestResult ? 'Latest result ready' : 'Ready when you are'}</h2>
            </div>
            <BarChart3 size={20} />
          </div>
          <div className="benchmark-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="benchmark-live-grid">
            <LiveStat label="Profile" value={settings.experience.performanceProfile} detail={native ? 'Desktop telemetry' : 'Preview telemetry'} icon={Gauge} />
            <LiveStat label="CPU" value={sample ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : 'Scanning'} detail={sample ? `${pct(sample.cpu.usage)} - ${mhz(sample.cpu.clockMhz)}` : 'No sample'} icon={Thermometer} />
            <LiveStat label="GPU" value={sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : 'Scanning'} detail={sample ? `${pct(sample.gpu.usage)} - ${mhz(sample.gpu.coreClockMhz)}` : 'No sample'} icon={Activity} />
            <LiveStat label="Samples" value={`${points.length}`} detail={running ? 'Recording' : 'Idle'} icon={ClipboardList} />
          </div>
        </Panel>

        <Panel className="benchmark-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor trust</span>
              <h2>Capture quality</h2>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <div className="benchmark-trust-list">
            {liveTrust.trusted.map((sensor) => <span className="state-chip live" key={sensor}>{sensor}</span>)}
            {liveTrust.missing.map((sensor) => <span className="state-chip blocked" key={sensor}>{sensor}</span>)}
          </div>
          <p className="benchmark-note">Missing sensors are reported as unavailable, not estimated. Use Diagnostics if a channel should be present.</p>
        </Panel>

        <Panel className="benchmark-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Profile proof</span>
              <h2>Latest comparison</h2>
            </div>
            <Gauge size={18} />
          </div>
          {latestResult && previousResult ? (
            <div className="benchmark-compare">
              <CompareRow label="CPU temp avg" current={latestResult.cpuTempAvg} previous={previousResult.cpuTempAvg} formatter={(value) => temp(value, settings.monitoring.temperatureUnit)} lowerIsBetter />
              <CompareRow label="GPU temp avg" current={latestResult.gpuTempAvg} previous={previousResult.gpuTempAvg} formatter={(value) => temp(value, settings.monitoring.temperatureUnit)} lowerIsBetter />
              <CompareRow label="GPU load avg" current={latestResult.gpuUsageAvg} previous={previousResult.gpuUsageAvg} formatter={(value) => pct(value ?? 0)} />
              <CompareRow label="GPU power avg" current={latestResult.gpuPowerAvg} previous={previousResult.gpuPowerAvg} formatter={(value) => value == null ? 'Unavailable' : `${value.toFixed(0)} W`} lowerIsBetter />
            </div>
          ) : (
            <p className="benchmark-note">Run two captures to compare profile effect. The app will only compare sensors that were present in both runs.</p>
          )}
        </Panel>

        <Panel className="benchmark-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Results</span>
              <h2>Local captures</h2>
            </div>
          </div>
          {results.length === 0 ? (
            <div className="empty-state">
              <BarChart3 size={22} />
              <strong>No capture yet</strong>
              <span>Start a 30 second capture while the workload is running.</span>
            </div>
          ) : (
            <div className="benchmark-results">
              {results.map((result) => <BenchmarkResultCard key={result.id} result={result} unit={settings.monitoring.temperatureUnit} />)}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  current,
  previous,
  formatter,
  lowerIsBetter = false,
}: {
  label: string;
  current: number | null;
  previous: number | null;
  formatter: (value: number | null) => string;
  lowerIsBetter?: boolean;
}) {
  const delta = current == null || previous == null ? null : current - previous;
  const improved = delta == null ? false : lowerIsBetter ? delta < 0 : delta > 0;
  const unchanged = delta != null && Math.abs(delta) < 0.1;
  return (
    <div className="benchmark-compare-row">
      <span>{label}</span>
      <strong>{formatter(current)}</strong>
      <small className={delta == null || unchanged ? 'neutral' : improved ? 'good' : 'warn'}>
        {delta == null ? 'No comparison' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${lowerIsBetter ? ' lower is better' : ''}`}
      </small>
    </div>
  );
}

function LiveStat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="benchmark-live-stat">
      <Icon size={17} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function BenchmarkResultCard({ result, unit }: { result: CaptureResult; unit: 'c' | 'f' }) {
  return (
    <article className="benchmark-result-card">
      <div>
        <span>{result.startedAt}</span>
        <strong>{result.profile}</strong>
      </div>
      <dl>
        <Metric label="CPU avg/max" value={`${temp(result.cpuTempAvg, unit)} / ${temp(result.cpuTempMax, unit)}`} />
        <Metric label="CPU load" value={pct(result.cpuUsageAvg)} />
        <Metric label="GPU avg/max" value={`${temp(result.gpuTempAvg, unit)} / ${temp(result.gpuTempMax, unit)}`} />
        <Metric label="GPU load" value={pct(result.gpuUsageAvg)} />
        <Metric label="GPU fan" value={result.gpuFanAvg == null ? 'Unavailable' : `${Math.round(result.gpuFanAvg)}%`} />
        <Metric label="GPU power" value={result.gpuPowerAvg == null ? 'Unavailable' : `${result.gpuPowerAvg.toFixed(0)} W`} />
        <Metric label="RAM" value={pct(result.ramAvg)} />
        <Metric label="Samples" value={`${result.pointCount}`} />
      </dl>
      <small>Trusted: {result.trustedSensors.join(', ') || 'none'} | Missing: {result.missingSensors.join(', ') || 'none'}</small>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function pointFromSample(sample: HardwareSample): CapturePoint {
  return {
    timestamp: sample.timestamp,
    cpuTemp: sample.cpu.temperature,
    cpuUsage: sample.cpu.usage,
    cpuClockMhz: sample.cpu.clockMhz,
    gpuTemp: sample.gpu.temperature,
    gpuUsage: sample.gpu.usage,
    gpuClockMhz: sample.gpu.coreClockMhz,
    gpuFanPct: sample.gpu.fanPct,
    gpuPowerWatts: sample.gpu.powerWatts,
    ramUsage: sample.memory.usage,
  };
}

function summarizeCapture(points: CapturePoint[], profile: string, startedAt: number, durationSec: number): CaptureResult {
  const trust = trustSummaryFromPoints(points);
  return {
    id: `${startedAt}-${points.length}`,
    profile,
    startedAt: new Date(startedAt).toLocaleString(),
    durationSec,
    pointCount: points.length,
    trustedSensors: trust.trusted,
    missingSensors: trust.missing,
    cpuTempAvg: averageNullable(points.map((point) => point.cpuTemp)),
    cpuTempMax: maxNullable(points.map((point) => point.cpuTemp)),
    cpuUsageAvg: average(points.map((point) => point.cpuUsage)),
    gpuTempAvg: averageNullable(points.map((point) => point.gpuTemp)),
    gpuTempMax: maxNullable(points.map((point) => point.gpuTemp)),
    gpuUsageAvg: average(points.map((point) => point.gpuUsage)),
    gpuFanAvg: averageNullable(points.map((point) => point.gpuFanPct)),
    gpuPowerAvg: averageNullable(points.map((point) => point.gpuPowerWatts)),
    ramAvg: average(points.map((point) => point.ramUsage)),
  };
}

function trustSummary(sample: HardwareSample | null) {
  if (!sample) return { trusted: [] as string[], missing: ['Telemetry sample'] };
  return trustSummaryFromPoints([pointFromSample(sample)]);
}

function trustSummaryFromPoints(points: CapturePoint[]) {
  const trusted: string[] = ['CPU load', 'GPU load', 'RAM'];
  const missing: string[] = [];
  if (points.some((point) => point.cpuTemp != null)) trusted.push('CPU temp');
  else missing.push('CPU temp');
  if (points.some((point) => point.gpuTemp != null)) trusted.push('GPU temp');
  else missing.push('GPU temp');
  if (points.some((point) => point.gpuFanPct != null)) trusted.push('GPU fan');
  else missing.push('GPU fan');
  if (points.some((point) => point.gpuPowerWatts != null)) trusted.push('GPU power');
  else missing.push('GPU power');
  return { trusted, missing };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value != null);
  return filtered.length === 0 ? null : average(filtered);
}

function maxNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value != null);
  return filtered.length === 0 ? null : Math.max(...filtered);
}
