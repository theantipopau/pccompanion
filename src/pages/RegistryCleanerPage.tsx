import { Archive, CheckCircle2, Circle, FileWarning, FolderSearch, Info, ScanLine, ShieldCheck, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { backupRegistryIssues, cleanRegistryIssues, restoreRegistryBackup, scanRegistryIssues } from '../services/systemService';
import type { RegistryBackup, RegistryIssue } from '../types/system';
export function RegistryCleanerPage() {
  const [issues, setIssues] = useState<RegistryIssue[]>([]);
  const [backup, setBackup] = useState<RegistryBackup | null>(null);
  const [log, setLog] = useState<string[]>(['Scan pending.']);
  const [busy, setBusy] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const selected = useMemo(() => issues.filter((issue) => issue.selected), [issues]);
  const safeSelected = selected.filter((issue) => issue.safe);
  const categories = useMemo(() => ['All', ...Array.from(new Set(issues.map((issue) => issue.category)))], [issues]);
  const visibleIssues = activeCategory === 'All' ? issues : issues.filter((issue) => issue.category === activeCategory);

  async function refreshIssues() {
    const result = await scanRegistryIssues();
    setIssues(result);
    return result;
  }

  useEffect(() => {
    refreshIssues().then((result) => {
      setIssues(result);
      setBusy(false);
      setLog([`Found ${result.length} registry issues. No changes will be applied without a backup.`]);
    });
  }, []);

  function toggle(id: string) {
    setIssues((current) => current.map((issue) => (issue.id === id ? { ...issue, selected: !issue.selected } : issue)));
  }

  function selectSafeIssues() {
    setIssues((current) => current.map((issue) => ({ ...issue, selected: issue.safe })));
  }

  function clearSelection() {
    setIssues((current) => current.map((issue) => ({ ...issue, selected: false })));
  }

  async function createBackup() {
    setBusy(true);
    try {
      const result = await backupRegistryIssues(selected);
      setBackup(result);
      setLog([`Backup created: ${result.path}`, `${result.issueCount} selected issue snapshots recorded.`]);
    } finally {
      setBusy(false);
    }
  }

  async function previewClean() {
    setBusy(true);
    try {
      const freshBackup = await backupRegistryIssues(safeSelected);
      setBackup(freshBackup);
      const cleanLog = await cleanRegistryIssues(safeSelected, freshBackup.id);
      setLog([`Backup created: ${freshBackup.path}`, ...cleanLog]);
      await refreshIssues();
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup() {
    if (!backup) {
      return;
    }
    setBusy(true);
    try {
      const restoreLog = await restoreRegistryBackup(backup.id);
      setLog(restoreLog);
      await refreshIssues();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page desktop-page">
      <PageHeader
        eyebrow="Maintenance"
        title="Registry Cleaner"
        description="Scans for orphaned startup entries, dead uninstall references, broken file associations, and stale application paths. Every clean is preceded by an automatic backup."
        action={
          <div className="button-row">
            <button className="secondary-button" onClick={selectSafeIssues} disabled={busy || issues.length === 0}>
              <ShieldCheck size={17} />
              <span>Select safe</span>
            </button>
            <button className="secondary-button" onClick={clearSelection} disabled={busy || selected.length === 0}>
              <Circle size={17} />
              <span>Clear selection</span>
            </button>
            <button className="secondary-button" onClick={restoreBackup} disabled={busy || !backup}>
              <ShieldCheck size={17} />
              <span>Restore backup</span>
            </button>
            <button className="secondary-button" onClick={createBackup} disabled={busy || selected.length === 0}>
              <Archive size={17} />
              <span>Backup selected</span>
            </button>
            <button className="primary-button" onClick={previewClean} disabled={busy || safeSelected.length === 0}>
              <Trash2 size={17} />
              <span>Backup &amp; clean safe items</span>
            </button>
          </div>
        }
      />

      {/* How it works — step guide */}
      <div className="reg-how-it-works">
        <Step num={1} label="Scan" detail="Issues are loaded automatically on page open." done={issues.length > 0} />
        <Step num={2} label="Review" detail="Select items you want cleaned. Uncheck anything uncertain." done={selected.length > 0} />
        <Step num={3} label="Backup" detail="A .reg export is written to Documents before any change." done={backup !== null} />
        <Step num={4} label="Clean" detail="Only items marked safe are removed. Unsafe items need manual review." done={log.some((l) => l.startsWith('[ok]'))} />
      </div>

      <div className="cleaner-shell">
        <Panel className="cleaner-summary">
          <SummaryItem icon={ScanLine} label="Issues found" value={issues.length.toString()} />
          <SummaryItem icon={ShieldCheck} label="Safe to clean" value={`${safeSelected.length} / ${selected.length} selected`} />
          <SummaryItem icon={Archive} label="Backup" value={backup ? 'Created ✓' : 'Required before clean'} accent={backup ? 'green' : 'amber'} />
        </Panel>

        <Panel className="registry-categories">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Filter by area</span>
              <h2>Categories</h2>
            </div>
            <FolderSearch size={19} />
          </div>
          <div className="registry-category-list">
            {categories.map((category) => {
              const count = category === 'All' ? issues.length : issues.filter((issue) => issue.category === category).length;
              return (
                <button
                  key={category}
                  className={activeCategory === category ? 'registry-category active' : 'registry-category'}
                  onClick={() => setActiveCategory(category)}
                >
                  <span>{category}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>
          <div className="reg-safety-legend">
            <span className="rec-keep">safe</span> auto-selected · <span className="rec-review">review</span> unselected by default
          </div>
        </Panel>

        <Panel className="manager-table registry-results">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Review before cleaning</span>
              <h2>{activeCategory === 'All' ? 'All findings' : activeCategory}</h2>
            </div>
            <FileWarning size={19} />
          </div>
          {visibleIssues.length === 0 ? (
            <div className="reg-empty">No actionable issues found in this category.</div>
          ) : (
            <div className="registry-list">
              {visibleIssues.map((issue) => (
                <label className="registry-row" key={issue.id}>
                  <input type="checkbox" checked={issue.selected} onChange={() => toggle(issue.id)} />
                  <div className="registry-row-body">
                    <div className="cleanup-item-title">
                      <strong>{issue.valueName || issue.keyPath.split('\\').pop() || issue.category}</strong>
                      <span className={`risk risk-${issue.severity}`}>{issue.severity}</span>
                      <span className={issue.safe ? 'recommendation rec-keep' : 'recommendation rec-review'}>
                        {issue.safe ? 'safe' : 'review'}
                      </span>
                    </div>
                    <p>{issue.description}</p>
                    <code title={`${issue.hive}\\${issue.keyPath}${issue.valueName ? `\\${issue.valueName}` : ''}`}>
                      {issue.hive}\{issue.keyPath}{issue.valueName ? `\${issue.valueName}` : ''}
                    </code>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="manager-inspector">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Output</span>
              <h2>Action log</h2>
            </div>
            <Archive size={19} />
          </div>
          <pre>{log.join('\n')}</pre>
          <div className="reg-guarantees">
            <div className="reg-guarantee-item">
              <CheckCircle2 size={15} />
              <span>Keys are exported to a .reg file before any deletion</span>
            </div>
            <div className="reg-guarantee-item">
              <CheckCircle2 size={15} />
              <span>Items flagged "review" are never auto-selected</span>
            </div>
            <div className="reg-guarantee-item">
              <Info size={15} />
              <span>Restore any backup by double-clicking the .reg file in Documents</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Step({ num, label, detail, done }: { num: number; label: string; detail: string; done: boolean }) {
  return (
    <div className={`reg-step ${done ? 'done' : ''}`}>
      <div className="reg-step-num">{done ? <CheckCircle2 size={14} /> : <Circle size={14} />}</div>
      <div>
        <strong>Step {num}: {label}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value, accent = 'cyan' }: { icon: LucideIcon; label: string; value: string; accent?: 'cyan' | 'green' | 'amber' }) {
  return (
    <div className={`summary-item tone-${accent}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
