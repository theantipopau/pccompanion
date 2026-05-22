import { Activity, Download, FileJson, ShieldCheck, Siren } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../context/MonitorContext';
import { exportDiagnostics } from '../services/systemService';
import type { DiagnosticsExport } from '../types/system';

export function DiagnosticsPage() {
  const { sample, systemInfo } = useMonitor();
  const [result, setResult] = useState<DiagnosticsExport | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      setResult(await exportDiagnostics());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Support"
        title="Diagnostics Export"
        description="Local logs, hardware snapshots, cleanup history, and crash reports packaged for Radium PCs support with owner consent."
        action={
          <button className="primary-button" onClick={handleExport} disabled={busy}>
            <Download size={17} />
            <span>{busy ? 'Exporting' : 'Export bundle'}</span>
          </button>
        }
      />
      <div className="module-grid">
        <Panel className="utility-card">
          <Activity size={22} />
          <h2>Current providers</h2>
          <p>
            {sample
              ? `State: ${sample.state}. CPU temp ${sample.cpu.temperature == null ? 'pending' : 'live'}, GPU ${sample.gpu.temperature == null && sample.gpu.usage <= 0 ? 'fallback/pending' : 'live'}.`
              : 'Waiting for the monitoring engine to publish the first sample.'}
          </p>
        </Panel>
        <Panel className="utility-card">
          <ShieldCheck size={22} />
          <h2>Privacy first</h2>
          <p>Diagnostics are generated locally and can be reviewed before sharing. No automatic telemetry is sent.</p>
        </Panel>
        <Panel className="utility-card">
          <FileJson size={22} />
          <h2>Structured logs</h2>
          <p>Monitoring state, cleanup actions, native command failures, and app errors are kept in machine-readable files.</p>
        </Panel>
        <Panel className="utility-card">
          <Siren size={22} />
          <h2>Crash reporting groundwork</h2>
          <p>Frontend error boundaries and native panic hooks can write local reports without interrupting startup.</p>
        </Panel>
        <Panel className="utility-card wide">
          <FileJson size={22} />
          <h2>Last export</h2>
          <p>{result ? `${result.message} ${result.path}` : `Ready to export ${systemInfo?.cpu ?? 'hardware'} and the latest telemetry snapshot.`}</p>
        </Panel>
      </div>
    </div>
  );
}
