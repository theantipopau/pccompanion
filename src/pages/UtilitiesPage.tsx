import { Activity, Bot, Cpu, Fan, FileWarning, Gamepad2, HardDrive, Network, PackageMinus, Palette, RefreshCw, Rocket, ShieldCheck, TimerReset, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../hooks/useSettings';
import { brand } from '../lib/branding';
import { assets } from '../lib/assets';
import { discoverRgbDevices, getPerformanceProfiles } from '../services/systemService';
import type { PerformanceProfile, RgbDiscovery } from '../types/system';

type UtilityStatus = 'live' | 'staged' | 'planned' | 'blocked' | 'driver_required';

type UtilityModule = {
  title: string;
  icon: LucideIcon;
  status: UtilityStatus;
  oem: string;
  text: string;
  highlights?: string[];
  group: 'live' | 'staged' | 'planned';
  action?: { label: string; view: string };
};

const statusLabels: Record<UtilityStatus, string> = {
  live: 'Live now',
  staged: 'Capability staged',
  planned: 'Planned next',
  blocked: 'Blocked',
  driver_required: 'Driver required',
};

const groups: Array<{ id: UtilityModule['group']; title: string; detail: string }> = [
  { id: 'live', title: 'Live now', detail: 'Supported workflows with reversible local actions.' },
  { id: 'staged', title: 'Capability staged', detail: 'Visible groundwork with writes gated until adapters are proven.' },
  { id: 'planned', title: 'Planned next', detail: 'Product direction that stays non-actionable until the backend is ready.' },
];

const modules: UtilityModule[] = [
  {
    title: 'Performance profiles',
    icon: Rocket,
    status: 'live',
    group: 'live',
    oem: brand.splashIcon,
    text: 'Quiet, Balanced, Creator, and Gaming profiles apply supported OS controls and keep low-level writes gated.',
    action: { label: 'Open profiles', view: 'profiles' },
  },
  {
    title: 'Startup manager',
    icon: TimerReset,
    status: 'live',
    group: 'live',
    oem: brand.splashIcon,
    text: 'Review startup entries with publisher, impact, and reversible enable/disable actions.',
    action: { label: 'Open startup', view: 'startup' },
  },
  {
    title: 'Storage cleaner',
    icon: HardDrive,
    status: 'live',
    group: 'live',
    oem: assets.asrock,
    text: 'Clean temp files, shader caches, logs, and reviewed download areas with owner-selected actions.',
    action: { label: 'Open cleaner', view: 'storage' },
  },
  {
    title: 'Fan control groundwork',
    icon: Fan,
    status: 'staged',
    group: 'staged',
    oem: assets.asus,
    text: 'Capability detection and profile schema are staged; firmware and fan-table writes remain blocked.',
  },
  {
    title: 'Network optimisation',
    icon: Network,
    status: 'staged',
    group: 'staged',
    oem: assets.intel,
    text: 'Adapter visibility and latency checks can ship before DNS profiles or registry-level tuning.',
  },
  {
    title: 'RGB integration',
    icon: Palette,
    status: 'staged',
    group: 'staged',
    oem: assets.msi,
    text: 'OpenRGB is the first planned adapter path. Phase 1 remains read-only discovery with localhost-only detection and no lighting writes.',
    highlights: [
      'OpenRGB SDK localhost 127.0.0.1:6742',
      'Controllers, zones, LEDs, modes, and colors only',
      'Writes blocked until restore state is proven',
    ],
  },
  {
    title: 'Benchmark page',
    icon: Activity,
    status: 'live',
    group: 'live',
    oem: assets.radeon,
    text: 'Repeatable local capture uses trusted telemetry state to compare profiles without synthetic scores.',
    action: { label: 'Open benchmark', view: 'benchmark' },
  },
  {
    title: 'Sensor provider',
    icon: Cpu,
    status: 'driver_required',
    group: 'planned',
    oem: assets.amd,
    text: 'Bundled driver-backed reads stay fail-closed until installer, service, and sensor-row checks are proven.',
  },
  {
    title: 'Game mode',
    icon: Gamepad2,
    status: 'planned',
    group: 'planned',
    oem: assets.nvidia,
    text: 'Manual per-game profile mappings come before automatic background switching.',
  },
  {
    title: 'CoPilot',
    icon: Bot,
    status: 'planned',
    group: 'planned',
    oem: brand.splashIcon,
    text: 'Offline-first assistant with hardware-based local model recommendations and optional local chat runtime.',
    action: { label: 'Open CoPilot', view: 'copilot' },
  },
];

const maintenanceTools: UtilityModule[] = [
  {
    title: 'System Cleaner',
    icon: HardDrive,
    status: 'live',
    group: 'live',
    oem: brand.splashIcon,
    text: 'Analyse temp files, browser caches, shader caches, update payloads, logs, downloads review areas, and the Recycle Bin with safe-target cleanup.',
    action: { label: 'Open system cleaner', view: 'storage' },
  },
  {
    title: 'Registry Cleaner',
    icon: FileWarning,
    status: 'live',
    group: 'live',
    oem: brand.splashIcon,
    text: 'CCleaner-style scope with guardrails: .reg backups, idempotent deletes, safe defaults, and review-only risky registry areas.',
    action: { label: 'Open registry', view: 'registry' },
  },
  {
    title: 'Bloatware Remover',
    icon: PackageMinus,
    status: 'live',
    group: 'live',
    oem: brand.splashIcon,
    text: 'Review Microsoft inbox apps and third-party preload packages by risk, category, publisher, detected state, and restore path.',
    action: { label: 'Open remover', view: 'cleanup' },
  },
];

export function UtilitiesPage({ mode, onNavigate }: { mode: string; onNavigate?: (view: string) => void }) {
  const [profiles, setProfiles] = useState<PerformanceProfile[]>([]);
  const [rgbDiscovery, setRgbDiscovery] = useState<RgbDiscovery | null>(null);
  const [rgbBusy, setRgbBusy] = useState(false);
  const { settings } = useSettings();
  const title = mode === 'profiles' ? 'Performance Profiles' : mode === 'monitoring' ? 'Monitoring Suite' : 'Utilities';

  useEffect(() => {
    let alive = true;
    getPerformanceProfiles()
      .then((items) => {
        if (alive) setProfiles(items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function refreshRgbDiscovery() {
    setRgbBusy(true);
    try {
      setRgbDiscovery(await discoverRgbDevices());
    } catch (err) {
      setRgbDiscovery({
        provider: 'OpenRGB',
        endpoint: '127.0.0.1:6742',
        state: 'degraded',
        protocolVersion: null,
        controllerCount: 0,
        controllers: [],
        message: err instanceof Error ? err.message : String(err),
        writeSafe: false,
        warnings: ['RGB discovery failed closed. No lighting writes were attempted.'],
      });
    } finally {
      setRgbBusy(false);
    }
  }

  useEffect(() => {
    void refreshRgbDiscovery();
  }, []);

  const displayProfiles = useMemo(
    () => (profiles.length > 0 ? profiles : fallbackProfiles).map((profile) => ({ ...profile, selected: profile.id === settings.experience.performanceProfile })),
    [profiles, settings.experience.performanceProfile],
  );
  const activeProfile = useMemo(
    () => displayProfiles.find((profile) => profile.id === settings.experience.performanceProfile) ?? displayProfiles.find((profile) => profile.selected) ?? displayProfiles[0],
    [displayProfiles, settings.experience.performanceProfile],
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow={brand.mode === 'demo' ? 'Demo framework' : 'Expansion framework'}
        title={title}
        description="Capability-led PC ownership workflows. Live tools are reversible; staged hardware controls stay gated until native adapters are proven."
      />

      <section className="maintenance-focus">
        <div className="utility-section-heading">
          <div>
            <span className="eyebrow">Maintenance command centre</span>
            <h2>Cleanup, repair, and ownership tools built around review-first actions.</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="maintenance-focus-grid">
          {maintenanceTools.map((module) => (
            <UtilityCard
                  key={module.title}
                  module={module}
                  onNavigate={onNavigate}
                  rgbDiscovery={module.title === 'RGB integration' ? rgbDiscovery : undefined}
                  rgbBusy={module.title === 'RGB integration' ? rgbBusy : false}
                  onRefreshRgb={module.title === 'RGB integration' ? refreshRgbDiscovery : undefined}
                />
          ))}
        </div>
      </section>

      <div className="utility-overview-grid">
        <Panel className="utility-profile-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Primary workflow</span>
              <h2>Performance profiles</h2>
            </div>
            <Rocket size={20} />
          </div>
          <div className="utility-profile-summary">
            <strong>{activeProfile?.name ?? 'Balanced'}</strong>
            <span>{activeProfile?.summary ?? 'Daily performance with restrained fan targets and normal Windows power behaviour.'}</span>
          </div>
          <div className="utility-profile-strip">
            {displayProfiles.map((profile) => (
              <span key={profile.id} className={profile.selected ? 'utility-profile-chip active' : 'utility-profile-chip'}>
                {profile.name}
              </span>
            ))}
          </div>
          <div className="utility-safety-note">
            Firmware, fan-table, voltage, and power-limit writes remain locked behind capability checks.
          </div>
          <button className="primary-button utility-panel-action" type="button" onClick={() => onNavigate?.('profiles')}>
            <Rocket size={16} />
            <span>Open profiles</span>
          </button>
        </Panel>

        <Panel className="utility-roadmap-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Capability map</span>
              <h2>Utility maturity</h2>
            </div>
          </div>
          <div className="utility-roadmap-stats">
            {groups.map((group) => (
              <div key={group.id}>
                <span>{group.title}</span>
                <strong>{modules.filter((module) => module.group === group.id).length}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="utility-section-stack">
        {groups.map((group) => (
          <section className="utility-section" key={group.id}>
            <div className="utility-section-heading">
              <div>
                <span className="eyebrow">{group.title}</span>
                <h2>{group.detail}</h2>
              </div>
            </div>
            <div className="utility-grid">
              {modules.filter((module) => module.group === group.id).map((module) => (
                <UtilityCard
                  key={module.title}
                  module={module}
                  onNavigate={onNavigate}
                  rgbDiscovery={module.title === 'RGB integration' ? rgbDiscovery : undefined}
                  rgbBusy={module.title === 'RGB integration' ? rgbBusy : false}
                  onRefreshRgb={module.title === 'RGB integration' ? refreshRgbDiscovery : undefined}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function UtilityCard({
  module,
  onNavigate,
  rgbDiscovery,
  rgbBusy = false,
  onRefreshRgb,
}: {
  module: UtilityModule;
  onNavigate?: (view: string) => void;
  rgbDiscovery?: RgbDiscovery | null;
  rgbBusy?: boolean;
  onRefreshRgb?: () => void;
}) {
  const Icon = module.icon;
  const isRgbModule = module.title === 'RGB integration';
  return (
    <Panel className={`utility-card utility-card-${module.status}`}>
      <div className="utility-card-head">
        <Icon size={21} />
        <img className="utility-card-oem" src={module.oem} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      </div>
      <h2>{module.title}</h2>
      <p>{module.text}</p>
      {module.highlights && (
        <ul className="utility-card-highlights">
          {module.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
        </ul>
      )}
      {isRgbModule && <RgbDiscoveryPanel discovery={rgbDiscovery} busy={rgbBusy} />}
      <div className="utility-card-footer">
        <span className={'utility-status ' + module.status}>{statusLabels[module.status]}</span>
        {isRgbModule && (
          <button type="button" className="utility-card-link" onClick={onRefreshRgb} disabled={rgbBusy}>
            <RefreshCw size={12} />
            <span>{rgbBusy ? 'Scanning' : 'Rescan'}</span>
          </button>
        )}
        {module.action && (
          <button type="button" className="utility-card-link" onClick={() => onNavigate?.(module.action!.view)}>
            {module.action.label}
          </button>
        )}
      </div>
    </Panel>
  );
}

function RgbDiscoveryPanel({ discovery, busy }: { discovery?: RgbDiscovery | null; busy: boolean }) {
  if (!discovery && busy) {
    return <div className="rgb-discovery-panel rgb-discovery-loading">Scanning localhost OpenRGB SDK...</div>;
  }
  if (!discovery) return null;
  const protocol = discovery.protocolVersion == null ? 'unknown' : 'v' + discovery.protocolVersion;
  return (
    <div className={'rgb-discovery-panel rgb-discovery-' + discovery.state}>
      <div className="rgb-discovery-summary">
        <span>{discovery.provider} {protocol}</span>
        <strong>{discovery.controllerCount} controller{discovery.controllerCount === 1 ? '' : 's'}</strong>
      </div>
      <small>{discovery.message}</small>
      {discovery.controllers.length > 0 && (
        <div className="rgb-controller-list">
          {discovery.controllers.slice(0, 3).map((controller) => (
            <div className="rgb-controller-row" key={controller.index}>
              <span>{controller.vendor || 'RGB'} - {controller.name || 'Controller ' + controller.index}</span>
              <b>{controller.ledCount} LEDs / {controller.zones.length} zones</b>
              {controller.zones.length > 0 && <em>{controller.zones.slice(0, 3).map((zone) => zone.name || 'Zone').join(' / ')}</em>}
            </div>
          ))}
        </div>
      )}
      {discovery.warnings.slice(0, 2).map((warning) => <small className="rgb-discovery-warning" key={warning}>{warning}</small>)}
    </div>
  );
}
const fallbackProfiles: PerformanceProfile[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    summary: 'Daily performance with restrained fan targets and normal Windows power behaviour.',
    selected: true,
    recommendedFor: 'Everyday gaming, browsing, streaming, and light content work.',
    fanIntent: 'balanced',
    powerIntent: 'balanced',
    estimatedNoise: 'medium',
    safeMode: true,
  },
  {
    id: 'quiet',
    name: 'Quiet',
    summary: 'Reduces background aggression and keeps the machine calm for low-intensity work.',
    selected: false,
    recommendedFor: 'Office work, downloads, media playback, and overnight operation.',
    fanIntent: 'quiet',
    powerIntent: 'efficiency',
    estimatedNoise: 'low',
    safeMode: true,
  },
  {
    id: 'creator',
    name: 'Creator',
    summary: 'Favours long-run stability for renders, compiles, encodes, and workstation loads.',
    selected: false,
    recommendedFor: 'Rendering, compiling, simulation, streaming, and production workloads.',
    fanIntent: 'balanced',
    powerIntent: 'performance',
    estimatedNoise: 'medium',
    safeMode: true,
  },
  {
    id: 'gaming',
    name: 'Gaming',
    summary: 'Prioritises sustained clocks, faster fan ramp targets, and foreground responsiveness.',
    selected: false,
    recommendedFor: 'Competitive gaming, high refresh displays, and GPU-heavy sessions.',
    fanIntent: 'aggressive',
    powerIntent: 'performance',
    estimatedNoise: 'high',
    safeMode: true,
  },
];
