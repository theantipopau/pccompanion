import { AlertTriangle, CheckCircle2, FileText, PackageMinus, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { removeBloatware, restoreBloatware, scanBloatware } from '../services/systemService';
import type { BloatwareItem } from '../types/system';

export function BloatwarePage() {
  const [items, setItems] = useState<BloatwareItem[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);

  async function refreshScan() {
    const result = await scanBloatware();
    setItems(result);
  }

  useEffect(() => {
    refreshScan().finally(() => setBusy(false));
  }, []);

  const selected = useMemo(() => items.filter((item) => item.selected && item.detected), [items]);

  function toggle(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  }

  function selectSafeDetected() {
    setItems((current) => current.map((item) => ({
      ...item,
      selected: item.detected && item.risk === 'low',
    })));
  }

  function clearSelection() {
    setItems((current) => current.map((item) => ({ ...item, selected: false })));
  }

  async function runRemoval() {
    setBusy(true);
    try {
      const actionLog = await removeBloatware(selected);
      setLog(actionLog);
      await refreshScan();
    } finally {
      setBusy(false);
    }
  }

  async function runRestore() {
    setBusy(true);
    try {
      const actionLog = await restoreBloatware(selected);
      setLog(actionLog);
      await refreshScan();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Windows cleanup"
        title="Bloatware Remover"
        description="A modular, review-first cleanup surface with native desktop execution, restore groundwork, and clear risk categories."
        action={
          <div className="button-row">
            <button className="secondary-button" onClick={selectSafeDetected} disabled={busy || items.length === 0}>
              <ShieldCheck size={17} />
              <span>Select safe</span>
            </button>
            <button className="secondary-button" onClick={clearSelection} disabled={busy || selected.length === 0}>
              <CheckCircle2 size={17} />
              <span>Clear selection</span>
            </button>
            <button className="secondary-button" onClick={runRestore} disabled={busy || selected.length === 0}>
              <ShieldCheck size={17} />
              <span>{busy ? 'Working' : `Restore ${selected.length} selected`}</span>
            </button>
            <button className="primary-button" onClick={runRemoval} disabled={busy || selected.length === 0}>
              <PackageMinus size={17} />
              <span>{busy ? 'Working' : `Remove ${selected.length} selected`}</span>
            </button>
          </div>
        }
      />

      <div className="cleanup-layout">
        <Panel className="cleanup-list">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Detected items</span>
              <h2>Selective cleanup</h2>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="cleanup-items">
            {items.map((item) => (
              <label className={item.detected ? 'cleanup-item' : 'cleanup-item muted'} key={item.id}>
                <input type="checkbox" checked={item.selected} disabled={!item.detected} onChange={() => toggle(item.id)} />
                <div>
                  <div className="cleanup-item-title">
                    <strong>{item.name}</strong>
                    <span className={`risk risk-${item.risk}`}>{item.risk}</span>
                  </div>
                  <p>{item.description}</p>
                  <small>{item.category} · {item.publisher} · {item.action}</small>
                </div>
              </label>
            ))}
          </div>
        </Panel>

        <div className="side-stack">
          <Panel>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Safety gate</span>
                <h2>Before removal</h2>
              </div>
              <AlertTriangle size={19} />
            </div>
            <ul className="check-list">
              <li><CheckCircle2 size={16} /> Create restore point before live execution</li>
              <li><CheckCircle2 size={16} /> Log PowerShell commands and result codes</li>
              <li><CheckCircle2 size={16} /> Support reinstall links for AppX packages</li>
              <li><CheckCircle2 size={16} /> Browser preview never performs system changes</li>
            </ul>
          </Panel>
          <Panel className="cleanup-log">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Action log</span>
                <h2>Actions</h2>
              </div>
              <FileText size={19} />
            </div>
            <pre>{log.length ? log.join('\n') : 'Review selected actions before running cleanup.'}</pre>
          </Panel>
        </div>
      </div>
    </div>
  );
}
