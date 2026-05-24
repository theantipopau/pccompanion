import { Activity, Fan, Gamepad2, HardDrive, Network, Palette, Rocket, TimerReset } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { assets } from '../lib/assets';

const modules = [
  { title: 'Fan control groundwork', icon: Fan, status: 'Staged', oem: assets.asus, text: 'Capability detection, profile schema, and safe firmware gates before any write controls ship.' },
  { title: 'Performance profiles', icon: Rocket, status: 'Live', oem: assets.radiumLogo, text: 'Quiet, balanced, creator, and gaming modes with reversible service and power-plan changes.' },
  { title: 'Startup manager', icon: TimerReset, status: 'Live', oem: assets.radiumLogo, text: 'Implemented as a dedicated module with publisher, impact, and dry-run reversible toggles.' },
  { title: 'Storage cleaner', icon: HardDrive, status: 'Live', oem: assets.asrock, text: 'Implemented as a dedicated module for temp files, shader caches, logs, and owner-reviewed downloads.' },
  { title: 'Network optimisation', icon: Network, status: 'Staged', oem: assets.intel, text: 'Adapter visibility, latency checks, DNS profile groundwork, and no dubious registry hacks.' },
  { title: 'RGB integration', icon: Palette, status: 'Staged', oem: assets.msi, text: 'Vendor capability abstraction ready for OpenRGB or native SDK adapters.' },
  { title: 'Benchmark page', icon: Activity, status: 'Staged', oem: assets.radeon, text: 'Repeatable local diagnostics with exportable results and thermal context.' },
  { title: 'Game mode', icon: Gamepad2, status: 'Staged', oem: assets.nvidia, text: 'Future per-game detection and profile switching without background bloat.' },
];

export function UtilitiesPage({ mode }: { mode: string }) {
  const title = mode === 'profiles' ? 'Performance Profiles' : mode === 'monitoring' ? 'Monitoring Suite' : 'Utilities';
  return (
    <div className="page">
      <PageHeader
        eyebrow="Expansion framework"
        title={title}
        description="Scaffolded modules for useful PC ownership workflows. Dangerous low-level controls remain capability-gated until native adapters are proven."
      />
      <div className="utility-grid">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Panel className="utility-card" key={module.title}>
              <div className="utility-card-head">
                <Icon size={21} />
                <img className="utility-card-oem" src={module.oem} alt="" aria-hidden="true" />
              </div>
              <h2>{module.title}</h2>
              <p>{module.text}</p>
              <span className={module.status === 'Live' ? 'utility-status live' : 'utility-status'}>{module.status}</span>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
