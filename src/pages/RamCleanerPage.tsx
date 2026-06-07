import { motion } from 'framer-motion';
import { CheckCircle2, Clock3, MemoryStick, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { gb } from '../lib/format';
import { optimizeRam } from '../services/systemService';
import type { RamCleanupResult } from '../types/system';

export function RamCleanerPage() {
  const { sample: rawSample, displaySample, systemInfo } = useMonitor();
  const sample = displaySample ?? rawSample;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RamCleanupResult | null>(null);

  const usedGb = sample?.memory.usedGb ?? 0;
  const totalGb = sample?.memory.totalGb ?? (systemInfo ? parseFloat(systemInfo.ram) || 0 : 0);
  const freeGb = Math.max(0, totalGb - usedGb);
  const usagePct = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;

  async function runCleanup() {
    setRunning(true);
    try {
      setResult(await optimizeRam());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Optimiser"
        title="Memory"
        description="Live RAM stats and safe standby-list cleanup. Never terminates processes — only releases kernel-managed caches and idle working sets."
        action={
          <button className="primary-button" onClick={runCleanup} disabled={running}>
            {running ? <RotateCcw size={17} className="spin" /> : <Sparkles size={17} />}
            <span>{running ? 'Optimising' : 'Optimise RAM'}</span>
          </button>
        }
      />

      <div className="module-grid">
        {/* Live stats row */}
        <MetricCard
          icon={MemoryStick}
          label="In use"
          value={totalGb > 0 ? gb(usedGb) : '—'}
          detail={totalGb > 0 ? `of ${gb(totalGb)} total` : 'Waiting for data'}
          tone={usagePct > 85 ? 'red' : usagePct > 65 ? 'amber' : 'cyan'}
          progress={usagePct}
        />
        <MetricCard
          icon={Sparkles}
          label="Available"
          value={totalGb > 0 ? gb(freeGb) : '—'}
          detail="Free + reclaimable"
          tone="green"
          progress={totalGb > 0 ? Math.round((freeGb / totalGb) * 100) : 0}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Utilization"
          value={totalGb > 0 ? `${usagePct}%` : '—'}
          detail={totalGb > 0 ? `${gb(totalGb)} installed` : 'Loading'}
          tone={usagePct > 85 ? 'red' : usagePct > 65 ? 'amber' : 'green'}
          progress={usagePct}
        />

        {/* Visual memory bar */}
        <Panel className="optimizer-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Live usage</span>
              <h2>Memory breakdown</h2>
            </div>
            <MemoryStick size={20} />
          </div>
          <div className="ram-bar-wrap">
            <div className="ram-bar">
              <div
                className="ram-bar-used"
                style={{ width: totalGb > 0 ? `${usagePct}%` : '0%' }}
              />
            </div>
            <div className="ram-bar-legend">
              <span><i className="ram-dot used" />In use: {totalGb > 0 ? gb(usedGb) : '—'}</span>
              <span><i className="ram-dot free" />Available: {totalGb > 0 ? gb(freeGb) : '—'}</span>
              <span><i className="ram-dot total" />Total: {totalGb > 0 ? gb(totalGb) : '—'}</span>
            </div>
          </div>
          <p style={{ marginTop: 14 }}>
            Optimisation releases the Windows standby list and asks idle process working sets to trim.
            Active games and creative apps are not affected.
          </p>
          <div className="timeline">
            {['Measure current memory', 'Release safe caches', 'Re-measure and log result'].map((step, index) => (
              <motion.div
                key={step}
                className="timeline-step"
                initial={{ opacity: 0.55 }}
                animate={{ opacity: running || result ? 1 : 0.7 }}
                transition={{ delay: index * 0.08 }}
              >
                {result || (running && index < 2) ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
                <span>{step}</span>
              </motion.div>
            ))}
          </div>
        </Panel>

        {/* Last result cards */}
        <MetricCard icon={MemoryStick} label="Before" value={result ? gb(result.beforeGb) : 'Pending'} detail="Pre-clean usage" tone="amber" progress={result && totalGb > 0 ? Math.round((result.beforeGb / totalGb) * 100) : 0} />
        <MetricCard icon={CheckCircle2} label="After" value={result ? gb(result.afterGb) : 'Pending'} detail="Post-clean usage" tone="green" progress={result && totalGb > 0 ? Math.round((result.afterGb / totalGb) * 100) : 0} />
        <MetricCard icon={Sparkles} label="Freed" value={result ? gb(result.freedGb) : '0 GB'} detail="Safe reclaim only" tone="cyan" progress={result && totalGb > 0 ? Math.round((result.freedGb / totalGb) * 100) : 0} />
        <MetricCard
          icon={CheckCircle2}
          label="Trimmed"
          value={result ? `${result.processesTrimmed}/${result.processesScanned}` : 'Pending'}
          detail={result ? `${result.processesSkipped} skipped by Windows access rules` : 'Accessible process coverage'}
          tone="green"
          progress={result && result.processesScanned > 0 ? Math.round((result.processesTrimmed / result.processesScanned) * 100) : 0}
        />

        <Panel className="wide optimizer-log">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Action log</span>
              <h2>Last optimisation</h2>
            </div>
          </div>
          <pre>{result ? result.message : 'No RAM cleanup has been run in this session.'}</pre>
        </Panel>
      </div>
    </div>
  );
}
