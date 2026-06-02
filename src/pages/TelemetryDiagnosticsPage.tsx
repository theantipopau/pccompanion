import { motion } from 'framer-motion';
import { ArrowRight, BadgeInfo, CheckCircle2, ClipboardList, Download, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Waves, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { brand } from '../lib/branding';
import { Skeleton } from '../components/Skeleton';
import { recordCompanionAction } from '../lib/actionHistory';
import { exportDiagnostics, getTelemetryDiagnostics, probeSensorSidecar } from '../services/systemService';
import type { DiagnosticsExport, SensorSidecarProbe, TelemetryDiagnosticsSnapshot } from '../types/system';

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

export function TelemetryDiagnosticsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState<TelemetryDiagnosticsSnapshot | null>(null);
  const [exportResult, setExportResult] = useState<DiagnosticsExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [sidecarProbe, setSidecarProbe] = useState<SensorSidecarProbe | null>(null);
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
      recordCompanionAction('support', 'Diagnostics bundle exported', result.path);
    } finally {
      setBusy(false);
    }
  }

  async function handleSidecarProbe() {
    setProbeBusy(true);
    try {
      const result = await probeSensorSidecar();
      setSidecarProbe(result);
      recordCompanionAction('diagnostics', 'Sensor sidecar probe', result.status);
      await refreshDiagnostics();
    } finally {
      setProbeBusy(false);
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

  const diagnosticsPending = !snapshot && busy;
  const actions = (
    <div className="diagnostics-header-actions">
      <button className="secondary-button" onClick={() => void refreshDiagnostics()} disabled={busy}>
        <RefreshCw size={16} />
        <span>{busy ? 'Refreshing' : 'Refresh'}</span>
      </button>
      <button className="primary-button" onClick={() => void handleExport()} disabled={busy}>
        <Download size={16} />
        <span>{busy ? 'Exporting' : 'Export report'}</span>
      </button>
    </div>
  );

  return (
    <div className={embedded ? 'settings-subpage' : 'page'}>
      {!embedded && (
        <PageHeader
          eyebrow="Diagnostics"
          title="Telemetry Diagnostics"
          description="Provider, capability, and sensor state for support."
          action={actions}
        />
      )}
      {embedded && (
        <div className="embedded-page-intro">
          <div>
            <span className="eyebrow">Diagnostics</span>
            <h2>Telemetry Diagnostics</h2>
            <p>Provider state, capability coverage, and sensor trust.</p>
          </div>
          {actions}
        </div>
      )}

      <div className="diagnostics-layout">
        <Panel className="diagnostics-hero panel-span-2">
          <div className="diagnostics-hero-top">
            <div>
              <span className="eyebrow">Support readiness</span>
              <h2>Telemetry readiness</h2>
              <p>Active providers, degraded channels, and support-ready sensor state.</p>
            </div>
            <div className="diagnostics-state-stack">
              <span className={snapshot?.overallState === 'valid' ? 'diagnostics-badge live' : 'diagnostics-badge partial'}>{snapshot ? snapshot.overallState : 'loading'}</span>
              <span className="diagnostics-badge muted">Active: {snapshot?.activeProvider ?? 'loading'}</span>
              <span className="diagnostics-badge muted">Fallbacks: {snapshot ? snapshot.fallbackSequence.length : 'pending'}</span>
            </div>
          </div>

          <div className="diagnostics-stat-grid">
            <StatCard label="Providers" value={`${providerCounts.loaded}`} detail={`${providerCounts.staged} staged / ${providerCounts.unavailable} off`} icon={ShieldCheck} />
            <StatCard label="Sensors" value={`${sensorCounts.live}`} detail={`${sensorCounts.partial} partial / ${sensorCounts.staged} staged`} icon={Waves} />
            <StatCard label="Capabilities" value={`${snapshot?.capabilities.length ?? 0}`} detail={`${snapshot?.supportSnapshot.length ?? 0} support notes`} icon={ClipboardList} />
            <StatCard label="Confidence" value={confidenceBandSummary(snapshot)} detail="High / medium / low" icon={Sparkles} />
          </div>
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor provider</span>
              <h2>Sidecar validation path</h2>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => void handleSidecarProbe()} disabled={probeBusy || busy}>
              <RefreshCw size={15} className={probeBusy ? 'spin' : undefined} />
              <span>{probeBusy ? 'Probing' : 'Probe now'}</span>
            </button>
          </div>
          <div className="sidecar-lifecycle">
            {(snapshot?.sidecarLifecycle ?? []).map((step, index) => (
              <div className="sidecar-step" key={step.id}>
                <span className={stateClass(step.state)}>{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small title={step.detail}>{shortText(step.detail, 92)}</small>
                </div>
              </div>
            ))}
          </div>
          {sidecarProbe && (
            <div className={sidecarProbe.available ? 'sidecar-probe-result live' : sidecarProbe.driverAvailable ? 'sidecar-probe-result partial' : 'sidecar-probe-result degraded'}>
              <div>
                <strong>{formatDiagnosticToken(sidecarProbe.status)}</strong>
                <span>{sidecarProbe.executablePath || 'No sidecar path reported'}</span>
              </div>
              <div className="sidecar-probe-grid">
                <span>CPU temp <strong>{sidecarProbe.cpuTempC != null ? `${Math.round(sidecarProbe.cpuTempC)}C` : 'N/A'}</strong></span>
                <span>CPU fan <strong>{sidecarProbe.cpuFanRpm != null ? `${sidecarProbe.cpuFanRpm} RPM` : 'N/A'}</strong></span>
                <span>Driver rows <strong>{sidecarProbe.driverAvailable ? 'Visible' : 'Missing'}</strong></span>
                <span>LHM <strong>{sidecarProbe.libraryVersion ? shortText(sidecarProbe.libraryVersion, 22) : 'N/A'}</strong></span>
              </div>
              {sidecarProbe.notes.length > 0 && (
                <p title={sidecarProbe.notes.join(' / ')}>{shortText(sidecarProbe.notes.join(' / '), 150)}</p>
              )}
            </div>
          )}
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor discovery report</span>
              <h2>Sensor discovery</h2>
            </div>
            <BadgeInfo size={18} />
          </div>
          {diagnosticsPending ? (
            <div className="diagnostics-loading-grid" aria-hidden="true">
              <Skeleton className="text-line diagnostics-skeleton-line" />
              <Skeleton className="text-line diagnostics-skeleton-line" />
              <Skeleton className="text-line diagnostics-skeleton-line" />
              <Skeleton className="text-line diagnostics-skeleton-line" />
              <Skeleton className="text-line diagnostics-skeleton-line" />
              <Skeleton className="text-line diagnostics-skeleton-line" />
            </div>
          ) : snapshot?.sensorDiscovery ? (
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
                <div>
                  <span>Issue class</span>
                  <strong>{formatDiagnosticToken(snapshot.sensorDiscovery.issueClassification)}</strong>
                </div>
                <div>
                  <span>GPU engine counters</span>
                  <strong>{snapshot.sensorDiscovery.gpuEngineCounterAvailable ? 'Available' : 'Unavailable'}</strong>
                </div>
              </div>
              {!snapshot.sensorDiscovery.packageTempAvailable && (
                <div className={snapshot.sensorDiscovery.requiresDriver ? 'validation-card degraded' : 'validation-card partial'}>
                  <strong>CPU package temp missing.</strong>
                  <p title={snapshot.sensorDiscovery.recommendedAction}>{shortText(snapshot.sensorDiscovery.recommendedAction, 120)}</p>
                </div>
              )}
              <div className="discovery-hints">
                <span>GPU counter probe state</span>
                <strong>{formatDiagnosticToken(snapshot.sensorDiscovery.gpuEngineCounterState)}</strong>
              </div>
              {snapshot.sensorDiscovery.dellClassHints.length > 0 && (
                <div className="discovery-hints">
                  <span>Dell WMI class hints</span>
                  <strong title={snapshot.sensorDiscovery.dellClassHints.join(' / ')}>{summarizeList(snapshot.sensorDiscovery.dellClassHints, 4)}</strong>
                </div>
              )}

              <div className="diagnostics-matrix discovery-matrix namespace-matrix">
                <div className="diagnostics-matrix-head">
                  <span>Namespace</span>
                  <span>Available</span>
                  <span>Status</span>
                  <span>Matching classes</span>
                </div>
                {snapshot.sensorDiscovery.namespaceInventory.map((entry) => (
                  <div key={entry.namespace} className="diagnostics-matrix-row">
                    <span>{entry.namespace}</span>
                    <span className={entry.available ? 'state-chip live' : 'state-chip blocked'}>
                      {entry.available ? 'Yes' : 'No'}
                    </span>
                    <span title={entry.status}>{shortText(entry.status, 72)}</span>
                    <span title={entry.matchingClasses.join(' / ')}>{entry.matchingClasses.length > 0 ? summarizeList(entry.matchingClasses, 4) : 'None'}</span>
                  </div>
                ))}
              </div>

              <div className="diagnostics-matrix discovery-matrix gpu-matrix">
                <div className="diagnostics-matrix-head">
                  <span>GPU adapter</span>
                  <span>Vendor</span>
                  <span>Type</span>
                  <span>VRAM</span>
                </div>
                {snapshot.sensorDiscovery.gpuAdapters.length === 0 && (
                  <div className="diagnostics-matrix-row">
                    <span>None detected</span>
                    <span>unknown</span>
                    <span>unknown</span>
                    <span>N/A</span>
                  </div>
                )}
                {snapshot.sensorDiscovery.gpuAdapters.map((adapter, index) => (
                  <div key={`${adapter.name}-${index}`} className="diagnostics-matrix-row">
                    <span title={adapter.name}>{shortText(adapter.name, 56)}</span>
                    <span>{adapter.vendor}</span>
                    <span>{adapter.integrated ? 'integrated' : 'discrete'}</span>
                    <span>{adapter.adapterRamGb > 0 ? `${adapter.adapterRamGb.toFixed(1)} GB` : 'Unknown'}</span>
                  </div>
                ))}
              </div>

              <div className="diagnostics-matrix discovery-matrix probe-matrix">
                <div className="diagnostics-matrix-head">
                  <span>Source</span>
                  <span>Label</span>
                  <span>Raw</span>
                  <span>Accepted</span>
                  <span>Value</span>
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
                    <span title={attempt.label}>{shortText(attempt.label, 48)}</span>
                    <span title={attempt.rawValue}>{shortText(attempt.rawValue, 32)}</span>
                    <span className={attempt.accepted ? 'state-chip live' : 'state-chip blocked'}>{attempt.accepted ? 'Yes' : 'No'}</span>
                    <span>{attempt.valueC == null ? 'N/A' : `${attempt.valueC.toFixed(1)} C`}</span>
                    <span title={attempt.reason}>{shortText(attempt.reason, 80)}</span>
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
              <h2>Provider orchestration</h2>
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
                    <span>{provider.vendor.toUpperCase()} / Load #{provider.loadOrder}</span>
                  </div>
                  <span className={provider.active ? 'diagnostics-badge live' : provider.state === 'staged' ? 'diagnostics-badge partial' : 'diagnostics-badge muted'}>
                    {provider.active ? 'Active' : provider.state}
                  </span>
                </div>
                <div className="provider-card-body">
                  <span>Binary</span>
                  <strong title={provider.dll}>{shortProviderBinary(provider.dll)}</strong>
                  <span>Binding</span>
                  <strong>{provider.symbolsResolved ? 'Symbols resolved' : 'Pending'}</strong>
                  <span>Notes</span>
                  <strong title={provider.notes}>{shortText(provider.notes, 96)}</strong>
                </div>
                <div className="provider-tags">
                  {provider.symbols.slice(0, 4).map((symbol) => <span key={symbol} className="badge badge-dim">{symbol}</span>)}
                  {provider.symbols.length > 4 && <span className="badge badge-dim">+{provider.symbols.length - 4}</span>}
                </div>
                <div className="provider-notes">
                  {provider.warnings.map((warning) => <small key={warning} className="warning" title={warning}>{shortText(warning, 96)}</small>)}
                  {provider.errors.map((error) => <small key={error} className="error" title={error}>{shortText(error, 96)}</small>)}
                </div>
              </motion.article>
            ))}
          </div>
        </Panel>

        <Panel className="diagnostics-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Sensor provenance matrix</span>
              <h2>Telemetry channel state</h2>
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
                  <small title={sensor.notes}>{shortText(sensor.notes, 96)}</small>
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
              <h2>Capability states</h2>
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
                  <small title={capability.detail}>{shortText(capability.detail, 96)}</small>
                </div>
                <span className={stateClass(capability.state)}>{formatDiagnosticToken(capability.state)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="diagnostics-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Support tooling</span>
              <h2>Support workflow</h2>
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
                <p title={line}>{shortText(line, 110)}</p>
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
              <h2>Latest bundle</h2>
            </div>
            <Download size={18} />
          </div>
          <div className="export-summary-grid">
            <div>
              <span>Path</span>
              <strong title={exportResult?.path ?? snapshot?.createdAt ?? 'Ready to export'}>{exportResult?.path ? shortPath(exportResult.path) : snapshot?.createdAt ?? 'Ready to export'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong className={exportResult ? 'export-status-ok' : ''} title={exportResult?.message}>{exportResult?.message ? shortText(exportResult.message, 88) : 'Export a support bundle when needed.'}</strong>
            </div>
            <div>
              <span>Sections</span>
              <strong title={exportResult?.sections.join(' / ')}>{exportResult ? summarizeList(exportResult.sections, 4) : 'Providers / Capabilities / Sensors / Support'}</strong>
            </div>
            <div>
              <span>Coverage</span>
              <strong>{exportResult ? `${exportResult.providerCount} providers / ${exportResult.capabilityCount} capabilities / ${exportResult.sensorCount} sensors / ${exportResult.discoveryAttemptCount} probes` : 'Live snapshot pending'}</strong>
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

function shortText(value: string, max = 80): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function summarizeList(values: string[], maxItems = 4): string {
  const shown = values.slice(0, maxItems).map((value) => shortText(value, 34));
  if (values.length > maxItems) shown.push(`+${values.length - maxItems}`);
  return shown.join(' / ');
}

function formatDiagnosticToken(value: string): string {
  return value.replace(/_/g, ' ');
}

function shortProviderBinary(value: string): string {
  return shortText(value.replace(' + bundled .NET runtime + LibreHardwareMonitorLib + PawnIO', ' + runtime + LHM + PawnIO'), 72);
}

function shortPath(value: string): string {
  const normalized = value.replace(/\//g, '\\');
  const parts = normalized.split('\\').filter(Boolean);
  if (parts.length <= 3) return shortText(value, 92);
  return shortText(`...\\${parts.slice(-3).join('\\')}`, 92);
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
