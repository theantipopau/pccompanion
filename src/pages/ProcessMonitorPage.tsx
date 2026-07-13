import { Activity, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { EASE_OUT } from '../lib/motion';
import { listTopProcesses } from '../services/systemService';
import type { ProcessInfo } from '../types/system';

type SortKey = 'cpuPct' | 'memMb' | 'name';

export function ProcessMonitorPage() {
  const { sample: rawSample, displaySample } = useMonitor();
  const { settings } = useSettings();
  const sample = displaySample ?? rawSample;
  const animateEntrance = settings.experience.animations;
  const [procs, setProcs] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('cpuPct');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const result = await listTopProcesses(40);
    setProcs(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => void refresh(), 3000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refresh]);

  const sorted = useMemo(() => {
    return [...procs].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b[sortBy] - a[sortBy];
    });
  }, [procs, sortBy]);

  const totalCpu = sample ? Math.round(sample.cpu.usage) : null;
  const totalRamGb = sample ? sample.memory.usedGb.toFixed(1) : null;

  function cpuColor(pct: number) {
    if (pct >= 20) return 'var(--red)';
    if (pct >= 8) return 'var(--amber)';
    if (pct >= 2) return 'var(--accent)';
    return 'var(--muted)';
  }

  function memColor(mb: number) {
    if (mb >= 500) return 'var(--amber)';
    if (mb >= 200) return 'var(--accent)';
    return 'var(--muted)';
  }

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    return (
      <button
        className={`proc-sort-btn${sortBy === k ? ' active' : ''}`}
        onClick={() => setSortBy(k)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Resources"
        title="Process Monitor"
        description="Live top processes by CPU and memory usage. Sorted every 3 seconds in desktop mode."
        action={
          <button
            className={autoRefresh ? 'primary-button' : 'secondary-button'}
            onClick={() => { setAutoRefresh((v) => !v); }}
          >
            <RefreshCw size={16} className={autoRefresh ? 'spin' : ''} />
            <span>{autoRefresh ? 'Live' : 'Paused'}</span>
          </button>
        }
      />

      <div className="proc-layout">
        {/* Summary row */}
        <div className="proc-summary-row">
          <div className="proc-stat">
            <span>Total CPU</span>
            <strong style={{ color: totalCpu !== null && totalCpu > 80 ? 'var(--red)' : totalCpu !== null && totalCpu > 50 ? 'var(--amber)' : 'var(--accent)' }}>
              {totalCpu !== null ? `${totalCpu}%` : '—'}
            </strong>
          </div>
          <div className="proc-stat">
            <span>RAM In Use</span>
            <strong style={{ color: 'var(--accent)' }}>{totalRamGb !== null ? `${totalRamGb} GB` : '—'}</strong>
          </div>
          <div className="proc-stat">
            <span>Processes listed</span>
            <strong>{procs.length}</strong>
          </div>
          <div className="proc-sort-group">
            <span>Sort by</span>
            <SortButton k="cpuPct" label="CPU" />
            <SortButton k="memMb" label="Memory" />
            <SortButton k="name" label="Name" />
          </div>
        </div>

        <Panel className="proc-panel">
          <div className="proc-table-head">
            <span className="proc-col-name">Process</span>
            <span className="proc-col-pid">PID</span>
            <span className="proc-col-cpu">CPU</span>
            <span className="proc-col-mem">Memory</span>
          </div>
          {loading ? (
            <div className="proc-empty">Scanning processes…</div>
          ) : (
            <div className="proc-list">
              <AnimatePresence initial={false}>
                {sorted.map((p) => (
                  <motion.div
                    className="proc-row"
                    key={p.pid}
                    layout={animateEntrance}
                    initial={animateEntrance ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={animateEntrance ? { opacity: 0 } : undefined}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    <div className="proc-col-name">
                      <span className="proc-name">{p.name}</span>
                      <div
                        className="proc-cpu-bar"
                        style={{ width: `${Math.min(p.cpuPct * 3, 100)}%`, background: cpuColor(p.cpuPct) }}
                      />
                    </div>
                    <span className="proc-col-pid proc-muted">{p.pid}</span>
                    <span className="proc-col-cpu" style={{ color: cpuColor(p.cpuPct) }}>
                      {p.cpuPct < 0.1 ? '<0.1' : p.cpuPct.toFixed(1)}%
                    </span>
                    <span className="proc-col-mem" style={{ color: memColor(p.memMb) }}>
                      {p.memMb >= 1024
                        ? `${(p.memMb / 1024).toFixed(1)} GB`
                        : `${Math.round(p.memMb)} MB`}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
