import { AlertTriangle, CheckCircle2, Power, TimerReset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { scanStartupItems, setStartupItemEnabled } from '../services/systemService';
import type { StartupItem } from '../types/system';

export function StartupManagerPage() {
  const [items, setItems] = useState<StartupItem[]>([]);
  const [log, setLog] = useState<string>('Scan pending.');
  const [busy, setBusy] = useState(true);
  const totalImpact = useMemo(() => items.filter((item) => item.enabled && item.impact !== 'low').length, [items]);

  useEffect(() => {
    scanStartupItems().then((result) => {
      setItems(result);
      setBusy(false);
      setLog(`Found ${result.length} startup entries. In desktop mode, changes are applied through the native registry adapter and logged here.`);
    });
  }, []);

  async function toggle(item: StartupItem) {
    const enabled = !item.enabled;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, enabled } : entry)));
    setLog(await setStartupItemEnabled(item, enabled));
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Utilities"
        title="Startup Manager"
        description="Review startup entries by publisher, launch location, and impact. Desktop mode applies reversible StartupApproved changes through the native adapter."
        action={
          <button className="primary-button" disabled={busy}>
            <TimerReset size={17} />
            <span>{busy ? 'Scanning' : `${totalImpact} entries to review`}</span>
          </button>
        }
      />
      <div className="manager-layout">
        <Panel className="manager-table">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Boot impact</span>
              <h2>Startup entries</h2>
            </div>
            <Power size={19} />
          </div>
          <div className="startup-list">
            {items.map((item) => (
              <div className="startup-row" key={item.id}>
                <button className={item.enabled ? 'switch on' : 'switch'} onClick={() => void toggle(item)} aria-label={`Toggle ${item.name}`}>
                  <span />
                </button>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.publisher} · {item.location}</small>
                  <code>{item.command}</code>
                </div>
                <span className={`risk risk-${impactTone(item.impact)}`}>{item.impact}</span>
                <span className={`recommendation rec-${item.recommended}`}>{item.recommended}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="manager-inspector">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Safety</span>
              <h2>Change log</h2>
            </div>
            <AlertTriangle size={19} />
          </div>
          <pre>{log}</pre>
          <ul className="check-list">
            <li><CheckCircle2 size={16} /> Never disables driver-critical services automatically</li>
            <li><CheckCircle2 size={16} /> Stores restore metadata before live changes</li>
            <li><CheckCircle2 size={16} /> Separates startup apps from required Windows services</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function impactTone(impact: StartupItem['impact']) {
  if (impact === 'high') return 'high';
  if (impact === 'medium') return 'medium';
  return 'low';
}
