import { CheckCircle2, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { gb } from '../lib/format';
import { runStorageCleanup, scanStorageCleanup } from '../services/systemService';
import type { StorageCleanupItem } from '../types/system';

export function StorageCleanerPage() {
  const [items, setItems] = useState<StorageCleanupItem[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const selected = useMemo(() => items.filter((item) => item.selected), [items]);
  const reclaimable = selected.reduce((sum, item) => sum + item.sizeGb, 0);

  useEffect(() => {
    scanStorageCleanup().then((result) => {
      setItems(result);
      setBusy(false);
    });
  }, []);

  function toggle(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  }

  async function runCleanup() {
    setBusy(true);
    try {
      setLog(await runStorageCleanup(selected));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page desktop-page">
      <PageHeader
        eyebrow="Utilities"
        title="System Cleaner"
        description="Analyze temporary files, browser caches, shader caches, Windows Update leftovers, logs, and recycle bin space with review-first cleanup."
        action={
          <button className="primary-button" onClick={runCleanup} disabled={busy || selected.length === 0}>
            <Trash2 size={17} />
            <span>{busy ? 'Scanning' : `Clean ${gb(reclaimable)}`}</span>
          </button>
        }
      />
      <div className="cleaner-shell">
        <Panel className="cleaner-summary">
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
          </ul>
        </Panel>
      </div>
    </div>
  );
}
