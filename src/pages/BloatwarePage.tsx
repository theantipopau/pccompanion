import { AlertTriangle, CheckCircle2, FileText, PackageMinus, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../hooks/useSettings';
import { recordCompanionAction } from '../lib/actionHistory';
import { EASE_OUT } from '../lib/motion';
import { removeBloatware, restoreBloatware, scanBloatware } from '../services/systemService';
import type { BloatwareItem } from '../types/system';

export function BloatwarePage() {
  const { settings } = useSettings();
  const animateEntrance = settings.experience.animations;
  const [items, setItems] = useState<BloatwareItem[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [detectedOnly, setDetectedOnly] = useState(true);

  async function refreshScan() {
    const result = await scanBloatware();
    setItems(result);
  }

  useEffect(() => {
    refreshScan().finally(() => setBusy(false));
  }, []);

  const selected = useMemo(() => items.filter((item) => item.selected && item.detected), [items]);
  const detectedCount = useMemo(() => items.filter((item) => item.detected).length, [items]);
  const lowRiskCount = useMemo(() => items.filter((item) => item.detected && item.risk === 'low').length, [items]);
  const reviewCount = useMemo(() => items.filter((item) => item.detected && item.risk !== 'low').length, [items]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((item) => item.category)))], [items]);
  const visibleItems = useMemo(
    () => items.filter((item) => {
      if (detectedOnly && !item.detected) return false;
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;
      return true;
    }),
    [activeCategory, detectedOnly, items],
  );

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
      recordCompanionAction('maintenance', 'Bloatware removal requested', `${selected.length} selected item(s)`);
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
      recordCompanionAction('maintenance', 'Bloatware restore requested', `${selected.length} selected item(s)`);
      await refreshScan();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page desktop-page maintenance-page">
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
      <div className="maintenance-command-strip">
        <CommandSignal icon={ShieldCheck} label="Scan" value="Known AppX targets" />
        <CommandSignal icon={CheckCircle2} label="Review" value="Low-risk defaults" tone="green" />
        <CommandSignal icon={PackageMinus} label="Action" value="Remove or restore" tone="amber" />
      </div>
      <div className="ops-summary-bar">
        <SummaryTile label="Detected" value={busy ? '...' : detectedCount.toString()} />
        <SummaryTile label="Low risk" value={busy ? '...' : lowRiskCount.toString()} tone="green" />
        <SummaryTile label="Review" value={busy ? '...' : reviewCount.toString()} tone={reviewCount > 0 ? 'amber' : 'green'} />
        <SummaryTile label="Selected" value={selected.length.toString()} />
      </div>
      <div className="maintenance-filter-row">
        <div className="filter-chip-row" role="list" aria-label="Bloatware categories">
          {categories.map((category) => (
            <button key={category} className={activeCategory === category ? 'filter-chip active' : 'filter-chip'} type="button" onClick={() => setActiveCategory(category)}>
              <span>{category}</span>
              <strong>{category === 'All' ? items.length : items.filter((item) => item.category === category).length}</strong>
            </button>
          ))}
        </div>
        <label className="inline-toggle">
          <input type="checkbox" checked={detectedOnly} onChange={(event) => setDetectedOnly(event.target.checked)} />
          <span>Detected only</span>
        </label>
      </div>

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
            <AnimatePresence initial={false}>
              {visibleItems.map((item) => (
                <motion.label
                  className={item.detected ? 'cleanup-item' : 'cleanup-item muted'}
                  key={item.id}
                  layout={animateEntrance}
                  initial={animateEntrance ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  exit={animateEntrance ? { opacity: 0 } : undefined}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                >
                  <input type="checkbox" checked={item.selected} disabled={!item.detected} onChange={() => toggle(item.id)} />
                  <div>
                    <div className="cleanup-item-title">
                      <strong>{item.name}</strong>
                      <span className={`risk risk-${item.risk}`}>{item.risk}</span>
                    </div>
                    <p>{item.description}</p>
                    <small>{item.category} · {item.publisher} · {item.action}</small>
                  </div>
                </motion.label>
              ))}
            </AnimatePresence>
            {!busy && visibleItems.length === 0 && (
              <div className="empty-state">
                <ShieldCheck size={18} />
                <strong>No matching packages found</strong>
                <span>Adjust the category filter or show undetected entries to review the full catalogue.</span>
              </div>
            )}
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

function CommandSignal({ icon: Icon, label, value, tone = 'cyan' }: { icon: typeof ShieldCheck; label: string; value: string; tone?: 'cyan' | 'green' | 'amber' }) {
  return (
    <div className={`maintenance-signal tone-${tone}`}>
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryTile({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: 'cyan' | 'green' | 'amber' }) {
  return (
    <div className={`ops-summary-tile tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
