import { CheckCircle2, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { gb } from '../lib/format';
import {
  cancelStorageCleanupScan,
  getStorageCleanupScanStatus,
  runStorageCleanup,
  scanStorageCleanup,
  startStorageCleanupScan,
} from '../services/systemService';
import type { StorageCleanupItem, StorageScanStatus } from '../types/system';

export function StorageCleanerPage() {
  const [items, setItems] = useState<StorageCleanupItem[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [scanning, setScanning] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [scanStatus, setScanStatus] = useState<StorageScanStatus>({
    running: true,
    completed: false,
    cancelled: false,
    progressPct: 0,
    currentStep: 0,
    totalSteps: 9,
    message: 'Starting storage scan',
  });
  const busy = scanning || cleaning;
  const selected = useMemo(() => items.filter((item) => item.selected), [items]);
  const reviewSelected = useMemo(() => selected.filter((item) => !item.safe), [selected]);
  const reclaimable = selected.reduce((sum, item) => sum + item.sizeGb, 0);

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | undefined;

    async function pollStatus() {
      try {
        const payload = await getStorageCleanupScanStatus();
        if (disposed) {
          return;
        }

        setScanStatus(payload.status);
        if (payload.items) {
          setItems(payload.items);
        }

        if (payload.status.running) {
          pollTimer = window.setTimeout(() => {
            void pollStatus();
          }, 280);
          return;
        }

        setScanning(false);
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : 'Unknown scan status error';
          setLog((current) => [`[error] Storage scan status failed: ${message}`, ...current]);
          setScanning(false);
        }
      }
    }

    async function load() {
      try {
        setScanning(true);
        setScanStatus((current) => ({ ...current, running: true, message: 'Starting storage scan' }));
        await startStorageCleanupScan();
        await pollStatus();
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : 'Unknown scan error';
          setLog([`[error] Storage scan failed: ${message}`]);
          const fallback = await scanStorageCleanup();
          if (!disposed) {
            setItems(fallback);
          }
        }
      }

      if (!disposed) {
        setScanning(false);
      }
    }

    void load();

    return () => {
      disposed = true;
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
    };
  }, []);

  async function cancelScan() {
    try {
      const status = await cancelStorageCleanupScan();
      setScanStatus(status);
      setScanning(false);
      setLog((current) => ['[info] Storage scan cancellation requested.', ...current]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cancellation error';
      setLog((current) => [`[error] Could not cancel scan: ${message}`, ...current]);
    }
  }

  function toggle(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  }

  function selectSafe() {
    setItems((current) => current.map((item) => ({ ...item, selected: item.safe })));
  }

  function clearSelection() {
    setItems((current) => current.map((item) => ({ ...item, selected: false })));
  }

  async function runCleanup() {
    if (reviewSelected.length > 0) {
      setLog([
        '[blocked] One-click cleanup only runs on safe targets.',
        ...reviewSelected.map((item) => `[review] ${item.name}: requires manual review before deletion.`),
      ]);
      return;
    }

    setCleaning(true);
    try {
      setLog(await runStorageCleanup(selected));
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="page desktop-page maintenance-page">
      <PageHeader
        eyebrow="Utilities"
        title="System Cleaner"
        description="Analyse temporary files, browser caches, shader caches, Windows Update leftovers, logs, and recycle bin space with review-first cleanup."
        action={
          <div className="button-row">
            <button className="secondary-button" onClick={selectSafe} disabled={busy || items.length === 0}>
              <ShieldCheck size={17} />
              <span>Select safe</span>
            </button>
            <button className="secondary-button" onClick={clearSelection} disabled={busy || selected.length === 0}>
              <CheckCircle2 size={17} />
              <span>Clear selection</span>
            </button>
            <button className="primary-button" onClick={runCleanup} disabled={busy || selected.length === 0}>
              <Trash2 size={17} />
              <span>{cleaning ? 'Cleaning' : scanning ? 'Scanning' : `Clean ${gb(reclaimable)}`}</span>
            </button>
          </div>
        }
      />
      <div className="maintenance-command-strip">
        <CommandSignal icon={HardDrive} label="Analyse" value={scanStatus.running ? 'Scanning now' : 'Scan complete'} />
        <CommandSignal icon={ShieldCheck} label="Guardrail" value="Safe targets only" tone="green" />
        <CommandSignal icon={Trash2} label="Selected" value={gb(reclaimable)} tone={reclaimable > 0 ? 'amber' : 'cyan'} />
      </div>
      <div className="cleaner-shell">
        <Panel className="cleaner-summary">
          <div className="scan-progress-row">
            <div>
              <span className="eyebrow">Scan status</span>
              <strong>{scanStatus.message}</strong>
              <small>{scanStatus.currentStep}/{scanStatus.totalSteps} steps</small>
            </div>
            {scanning ? (
              <button className="secondary-button" onClick={cancelScan}>
                Cancel scan
              </button>
            ) : null}
          </div>
          <div className="scan-progress-track" role="progressbar" aria-valuenow={scanStatus.progressPct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${scanStatus.progressPct}%` }} />
          </div>
          <div className="summary-item">
            <HardDrive size={18} />
            <span>Selected</span>
            <strong>{gb(reclaimable)}</strong>
          </div>
          <div className="summary-item">
            <ShieldCheck size={18} />
            <span>Safe targets</span>
            <strong>{selected.filter((item) => item.safe).length}</strong>
          </div>
          <div className="summary-item">
            <Trash2 size={18} />
            <span>Total found</span>
            <strong>{gb(items.reduce((sum, item) => sum + item.sizeGb, 0))}</strong>
          </div>
        </Panel>
        <Panel className="manager-table">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Reclaimable space</span>
              <h2>Cleanup targets</h2>
            </div>
            <HardDrive size={19} />
          </div>
          <div className="cleanup-items">
            {items.map((item) => (
              <label className="cleanup-item storage-item" key={item.id}>
                <input type="checkbox" checked={item.selected} onChange={() => toggle(item.id)} />
                <div>
                  <div className="cleanup-item-title">
                    <strong>{item.name}</strong>
                    <span className={item.safe ? 'recommendation rec-keep' : 'recommendation rec-review'}>{item.safe ? 'safe' : 'review'}</span>
                  </div>
                  <p>{item.description}</p>
                  <small>{item.category} · {item.location}</small>
                </div>
                <b>{gb(item.sizeGb)}</b>
              </label>
            ))}
          </div>
        </Panel>
        <Panel className="manager-inspector">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Action log</span>
              <h2>Cleanup results</h2>
            </div>
            <ShieldCheck size={19} />
          </div>
          <pre>{log.length ? log.join('\n') : 'Select targets to clean. Browser preview returns simulated results; desktop mode runs the native cleaner.'}</pre>
          <ul className="check-list">
            <li><CheckCircle2 size={16} /> Personal downloads require explicit review</li>
            <li><CheckCircle2 size={16} /> Shader caches are marked rebuildable</li>
            <li><CheckCircle2 size={16} /> Native cleanup will log every deleted path</li>
            <li><CheckCircle2 size={16} /> One-click cleanup is limited to targets marked safe</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function CommandSignal({ icon: Icon, label, value, tone = 'cyan' }: { icon: typeof HardDrive; label: string; value: string; tone?: 'cyan' | 'green' | 'amber' }) {
  return (
    <div className={`maintenance-signal tone-${tone}`}>
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
