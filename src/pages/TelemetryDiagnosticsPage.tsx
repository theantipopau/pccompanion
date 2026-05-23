import { motion } from 'framer-motion';
import { ArrowRight, BadgeInfo, CheckCircle2, ClipboardList, Download, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Waves, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { exportDiagnostics, getTelemetryDiagnostics } from '../services/systemService';
import type { DiagnosticsExport, TelemetryDiagnosticsSnapshot } from '../types/system';

type ValidationResult = {
  title: string;
  status: 'healthy' | 'partial' | 'degraded';
  summary: string;
  issues: string[];
};

const capabilityStates: Array<'live' | 'partial' | 'degraded' | 'staged' | 'unsupported' | 'blocked' | 'elevated_required' | 'driver_required' | 'unknown'> = [
  'live',
  'partial',
  'staged',
  'degraded',
  'blocked',
  'driver_required',
  'elevated_required',
  'unsupported',
  'unknown',
];

export function TelemetryDiagnosticsPage() {
  const [snapshot, setSnapshot] = useState<TelemetryDiagnosticsSnapshot | null>(null);
  const [exportResult, setExportResult] = useState<DiagnosticsExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  async function refreshDiagnostics() {
    setBusy(true);
    try {
      const data = await getTelemetryDiagnostics();
      setSnapshot(data);
      setValidation(validateSnapshot(data));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      const result = await exportDiagnostics();
      setExportResult(result);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshDiagnostics();
    const timer = window.setInterval(() => {
      void getTelemetryDiagnostics().then((data) => {
        setSnapshot(data);
        setValidation(validateSnapshot(data));
      }).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const providerCounts = useMemo(() => {
    if (!snapshot) {
      return { loaded: 0, staged: 0, unavailable: 0 };
    }
    return snapshot.providers.reduce((counts, provider) => {
      if (provider.state === 'loaded') counts.loaded += 1;
      else if (provider.state === 'staged') counts.staged += 1;
      else counts.unavailable += 1;
      return counts;
    }, { loaded: 0, staged: 0, unavailable: 0 });
  }, [snapshot]);

  const sensorCounts = useMemo(() => {
    if (!snapshot) {
      return { live: 0, partial: 0, staged: 0, unsupported: 0 };
    }
    return snapshot.sensors.reduce((counts, sensor) => {
      if (sensor.state === 'live') counts.live += 1;
      else if (sensor.state === 'partial') counts.partial += 1;
      else if (sensor.state === 'staged') counts.staged += 1;
      else counts.unsupported += 1;
      return counts;
    }, { live: 0, partial: 0, staged: 0, unsupported: 0 });
  }, [snapshot]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Diagnostics"
        title="Telemetry Diagnostics"
        description="Provider provenance, capability intelligence, and support-ready sensor transparency for OEM-grade troubleshooting."
        action={(
          <div className="diagnostics-header-actions">
            <button className="secondary-button" onClick={() => void refreshDiagnostics()} disabled={busy}>
              <RefreshCw size={16} />
              <span>{busy ? 'Refreshing' : 'Refresh snapshot'}</span>
            </button>
            <button className="primary-button" onClick={() => void handleExport()} disabled={busy}>
              <Download size={16} />
              <span>{busy ? 'Exporting' : 'Generate OEM report'}</span>
            </button>
          </div>
        )}
      />

      <div className="diagnostics-layout">
        <Panel className="diagnostics-hero panel-span-2">
          <div className="diagnostics-hero-top">
            <div>
              <span className="eyebrow">Support readiness</span>
              <h2>Telemetry orchestration transparency</h2>
              <p>
                The app now exposes which provider is active, which channels are degraded, and why each sensor is live, staged, or unsupported.
              </p>
            </div>
            <div className="diagnostics-state-stack">
              <span className={snapshot?.overallState === 'valid' ? 'diagnostics-badge live' : 'diagnostics-badge partial'}>{snapshot ? snapshot.overallState : 'loading'}</span>
              <span className="diagnostics-badge muted">Active: {snapshot?.activeProvider ?? 'loading'}</span>
              <span className="diagnostics-badge muted">Fallback: {snapshot?.fallbackSequence.join(' → ') ?? 'pending'}</span>
            </div>
          </div>

          <div className="diagnostics-stat-grid">
            <StatCard label="Providers loaded" value={`${providerCounts.loaded}`} detail={`${providerCounts.staged} staged · ${providerCounts.unavailable} unavailable`} icon={ShieldCheck} />
            <StatCard label="Sensors live" value={`${sensorCounts.live}`} detail={`${sensorCounts.partial} partial · ${sensorCounts.staged} staged`} icon={Waves} />
            <StatCard label="Capabilities" value={`${snapshot?.capabilities.length ?? 0}`} detail={`${snapshot?.supportSnapshot.length ?? 0} support notes`} icon={ClipboardList} />
            <StatCard label="Confidence bands" value={confidenceBandSummary(snapshot)} detail="High / medium / low trust visibility" icon={Sparkles} />
          </div>
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor discovery report</span>
              <h2>Thermal probe attempts, labels, and rejected values</h2>
            </div>
            <BadgeInfo size={18} />
          </div>
          {snapshot?.sensorDiscovery ? (
            <>
              <div className="discovery-summary-grid">
                <div>
                  <span>Machine</span>
                  <strong>{snapshot.sensorDiscovery.machineVendor} {snapshot.sensorDiscovery.machineModel}</strong>
                </div>
                <div>
                  <span>Family</span>
                  <strong>{snapshot.sensorDiscovery.machineFamily || 'Unknown'}</strong>
                </div>
                <div>
                  <span>Dell profile</span>
                  <strong>{snapshot.sensorDiscovery.isDell ? 'Detected' : 'Not detected'}</strong>
                </div>
                <div>
                  <span>CPU package temp</span>
                  <strong>{snapshot.sensorDiscovery.packageTempAvailable ? 'Available' : 'Unavailable'}</strong>
                </div>
              </div>
              {!snapshot.sensorDiscovery.packageTempAvailable && (
                <div className={snapshot.sensorDiscovery.requiresDriver ? 'validation-card degraded' : 'validation-card partial'}>
                  <strong>CPU package temperature is not available from current user-mode sources.</strong>
                  <p>{snapshot.sensorDiscovery.recommendedAction}</p>
                </div>
              )}
              {snapshot.sensorDiscovery.dellClassHints.length > 0 && (
                <div className="discovery-hints">
                  <span>Dell WMI class hints</span>
                  <strong>{snapshot.sensorDiscovery.dellClassHints.join(' · ')}</strong>
                </div>
              )}
              <div className="diagnostics-matrix discovery-matrix">
                <div className="diagnostics-matrix-head">
                  <span>Source</span>
                  <span>Label</span>
                  <span>Raw</span>
                  <span>Accepted</span>
                  <span>Value C</span>
                  <span>Reason</span>
                </div>
                {snapshot.sensorDiscovery.attempts.map((attempt, index) => (
                  <motion.div
                    key={`${attempt.source}-${attempt.label}-${index}`}
                    className="diagnostics-matrix-row"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.14, delay: index * 0.01 }}
                  >
                    <span>{attempt.source}</span>
                    <span>{attempt.label}</span>
                    <span>{attempt.rawValue}</span>
                    <span className={attempt.accepted ? 'state-chip live' : 'state-chip blocked'}>{attempt.accepted ? 'yes' : 'no'}</span>
                    <span>{attempt.valueC == null ? 'N/A' : `${attempt.valueC.toFixed(1)} C`}</span>
                    <span>{attempt.reason}</span>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <p>Sensor discovery snapshot unavailable.</p>
          )}
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Provider orchestration</span>
              <h2>Load order, binding state, and active provider</h2>
            </div>
            <BadgeInfo size={18} />
          </div>
          <div className="provider-cards">
            {(snapshot?.providers ?? []).map((provider, index) => (
              <motion.article
                key={provider.id}
                className={provider.active ? 'provider-card active' : 'provider-card'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: index * 0.04 }}
              >
                <div className="provider-card-head">
                  <div>
                    <strong>{provider.label}</strong>
                    <span>{provider.vendor.toUpperCase()} · Load #{provider.loadOrder}</span>
                  </div>
                  <span className={provider.active ? 'diagnostics-badge live' : provider.state === 'staged' ? 'diagnostics-badge partial' : 'diagnostics-badge muted'}>
                    {provider.active ? 'Active' : provider.state}
                  </span>
                </div>
                <div className="provider-card-body">
                  <span>Binary</span>
                  <strong>{provider.dll}</strong>
                  <span>Binding</span>
                  <strong>{provider.symbolsResolved ? 'Symbols resolved' : 'Pending'}</strong>
                  <span>Notes</span>
                  <strong>{provider.notes}</strong>
                </div>
                <div className="provider-tags">
                  {provider.symbols.map((symbol) => <span key={symbol} className="badge badge-dim">{symbol}</span>)}
                </div>
                <div className="provider-notes">
                  {provider.warnings.map((warning) => <small key={warning} className="warning">{warning}</small>)}
                  {provider.errors.map((error) => <small key={error} className="error">{error}</small>)}
                </div>
              </motion.article>
            ))}
          </div>
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor provenance matrix</span>
              <h2>Every telemetry channel explained</h2>
            </div>
            <ShieldAlert size={18} />
          </div>
          <div className="diagnostics-matrix">
            <div className="diagnostics-matrix-head">
              <span>Sensor</span>
              <span>Provider</span>
              <span>State</span>
              <span>Confidence</span>
              <span>Quality</span>
              <span>Fallback</span>
              <span>Support</span>
            </div>
            {(snapshot?.sensors ?? []).map((sensor, index) => (
              <motion.div
                key={sensor.id}
                className="diagnostics-matrix-row"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: index * 0.02 }}
              >
                <div>
                  <strong>{sensor.sensor}</strong>
                  <small>{sensor.notes}</small>
                </div>
                <span>{sensor.provider}</span>
                <span className={stateClass(sensor.state)}>{sensor.state}</span>
                <span className={confidenceClass(sensor.confidence)}>{sensor.confidence}</span>
                <span>{sensor.telemetryQuality}</span>
                <span>{sensor.fallbackStatus}</span>
                <span>{sensor.oemSupportStatus}</span>
              </motion.div>
            ))}
          </div>
        </Panel>

        <Panel className="diagnostics-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Capability intelligence</span>
              <h2>Support and safety states</h2>
            </div>
            <ArrowRight size={18} />
          </div>
          <div className="capability-pills">
            {capabilityStates.map((state) => (
              <span key={state} className="diagnostics-badge muted">{state.replace(/_/g, ' ')}</span>
            ))}
          </div>
          <div className="capability-list">
            {(snapshot?.capabilities ?? []).map((capability) => (
              <div key={capability.id} className="capability-row">
                <div>
                  <strong>{capability.label}</strong>
                  <small>{capability.detail}</small>
                </div>
                <span className={stateClass(capability.state)}>{capability.state}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="diagnostics-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Support tooling</span>
              <h2>Support Snapshot and OEM workflow</h2>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <div className="support-tools">
            {(snapshot?.supportActions ?? ['Support Snapshot', 'Generate OEM Report', 'Validate System Health']).map((action) => (
              <button
                key={action}
                className="support-tool-button"
                onClick={() => {
                  if (action === 'Generate OEM Report') {
                    void handleExport();
                    return;
                  }
                  if (action === 'Validate System Health') {
                    if (snapshot) setValidation(validateSnapshot(snapshot));
                    return;
                  }
                  void refreshDiagnostics();
                }}
              >
                {action}
              </button>
            ))}
          </div>
          <div className="support-snapshot-list">
            {(snapshot?.supportSnapshot ?? []).map((line) => (
              <div key={line} className="support-snapshot-row">
                <span />
                <p>{line}</p>
              </div>
            ))}
          </div>
          {validation && (
            <div className={validation.status === 'healthy' ? 'validation-card healthy' : validation.status === 'partial' ? 'validation-card partial' : 'validation-card degraded'}>
              <strong>{validation.title}</strong>
              <p>{validation.summary}</p>
              {validation.issues.length > 0 ? (
                <ul>
                  {validation.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : (
                <p className="validation-pass">No support-blocking issues detected.</p>
              )}
            </div>
          )}
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Export bundle</span>
              <h2>Last report and included sections</h2>
            </div>
            <Download size={18} />
          </div>
          <div className="export-summary-grid">
            <div>
              <span>Path</span>
              <strong>{exportResult?.path ?? snapshot?.createdAt ?? 'Ready to export'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{exportResult?.message ?? 'Use Generate OEM report to create a support bundle.'}</strong>
            </div>
            <div>
              <span>Sections</span>
              <strong>{exportResult ? exportResult.sections.join(' · ') : 'Provider orchestration · Capability matrix · Sensor provenance · Support tooling'}</strong>
            </div>
            <div>
              <span>Coverage</span>
              <strong>{exportResult ? `${exportResult.providerCount} providers · ${exportResult.capabilityCount} capabilities · ${exportResult.sensorCount} sensors · ${exportResult.discoveryAttemptCount} discovery probes` : 'Live snapshot pending'}</strong>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="diagnostics-stat-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function stateClass(state: string): string {
  if (state === 'live') return 'state-chip live';
  if (state === 'partial' || state === 'staged') return 'state-chip partial';
  if (state === 'blocked' || state === 'driver_required' || state === 'unsupported') return 'state-chip blocked';
  return 'state-chip muted';
}

function confidenceClass(confidence: string): string {
  if (confidence === 'high') return 'confidence-chip high';
  if (confidence === 'medium') return 'confidence-chip medium';
  if (confidence === 'low') return 'confidence-chip low';
  return 'confidence-chip muted';
}

function confidenceBandSummary(snapshot: TelemetryDiagnosticsSnapshot | null): string {
  if (!snapshot) return 'loading';
  const counts = snapshot.sensors.reduce((acc, sensor) => {
    acc[sensor.confidence] = (acc[sensor.confidence] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const high = counts.high ?? 0;
  const medium = counts.medium ?? 0;
  const low = counts.low ?? 0;
  return `${high}/${medium}/${low}`;
}

function validateSnapshot(snapshot: TelemetryDiagnosticsSnapshot): ValidationResult {
  const issues: string[] = [];
  const loadedProviders = snapshot.providers.filter((provider) => provider.state === 'loaded' || provider.state === 'staged').length;
  const liveSensors = snapshot.sensors.filter((sensor) => sensor.state === 'live').length;
  const driverRequired = snapshot.capabilities.filter((capability) => capability.state === 'driver_required').length;
  const blocked = snapshot.capabilities.filter((capability) => capability.state === 'blocked').length;

  if (loadedProviders === 0) issues.push('No provider is currently loaded.');
  if (liveSensors === 0) issues.push('No live sensor groups are currently visible.');
  if (driverRequired > 0) issues.push(`${driverRequired} capability area(s) require a driver-backed implementation.`);
  if (blocked > 0) issues.push(`${blocked} capability area(s) are safety-blocked until validated.`);
  if (!snapshot.sensorDiscovery.packageTempAvailable) {
    issues.push('CPU package temperature is not available from current user-mode probes.');
  }

  const status: ValidationResult['status'] = issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'partial' : 'degraded';
  return {
    title: status === 'healthy' ? 'System health validated' : 'System health needs attention',
    status,
    summary: status === 'healthy'
      ? 'The current snapshot looks usable for support and OEM diagnostics.'
      : 'The snapshot exposes degraded or staged channels, but live telemetry remains available.',
    issues,
  };
}
