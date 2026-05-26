import { Activity, Cpu, Fan, Gamepad2, HardDrive, Network, Palette, Rocket, TimerReset, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../hooks/useSettings';
import { assets } from '../lib/assets';
import { getPerformanceProfiles } from '../services/systemService';
import type { PerformanceProfile } from '../types/system';

type UtilityStatus = 'live' | 'staged' | 'planned' | 'blocked' | 'driver_required';

type UtilityModule = {
  title: string;
  icon: LucideIcon;
  status: UtilityStatus;
  oem: string;
  text: string;
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
    oem: assets.radiumLogo,
    text: 'Quiet, Balanced, Creator, and Gaming profiles apply supported OS controls and keep low-level writes gated.',
    action: { label: 'Open profiles', view: 'profiles' },
  },
  {
    title: 'Startup manager',
    icon: TimerReset,
    status: 'live',
    group: 'live',
    oem: assets.radiumLogo,
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
    text: 'Vendor capability abstraction is staged for safe OpenRGB or native SDK adapters later.',
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
    title: 'Radium sensor provider',
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
];

export function UtilitiesPage({ mode, onNavigate }: { mode: string; onNavigate?: (view: string) => void }) {
  const [profiles, setProfiles] = useState<PerformanceProfile[]>([]);
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
        eyebrow="Expansion framework"
        title={title}
        description="Capability-led PC ownership workflows. Live tools are reversible; staged hardware controls stay gated until native adapters are proven."
      />

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
                <UtilityCard key={module.title} module={module} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function UtilityCard({ module, onNavigate }: { module: UtilityModule; onNavigate?: (view: string) => void }) {
  const Icon = module.icon;
  return (
    <Panel className={`utility-card utility-card-${module.status}`}>
      <div className="utility-card-head">
        <Icon size={21} />
        <img className="utility-card-oem" src={module.oem} alt="" aria-hidden="true" />
      </div>
      <h2>{module.title}</h2>
      <p>{module.text}</p>
      <div className="utility-card-footer">
        <span className={`utility-status ${module.status}`}>{statusLabels[module.status]}</span>
        {module.action && (
          <button type="button" className="utility-card-link" onClick={() => onNavigate?.(module.action!.view)}>
            {module.action.label}
          </button>
        )}
      </div>
    </Panel>
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
