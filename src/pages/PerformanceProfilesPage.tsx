import { useEffect, useMemo, useState } from 'react';
import { Check, Cpu, Fan, Gauge, Gamepad2, Loader2, Moon, RadioTower, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../context/SettingsContext';
import { applyPerformanceProfile, getPerformanceProfiles } from '../services/systemService';
import type { PerformanceProfile, PerformanceProfileId, PerformanceProfileResult } from '../types/system';

const iconMap = {
  quiet: Moon,
  balanced: Gauge,
  gaming: Gamepad2,
  creator: Cpu,
};

export function PerformanceProfilesPage() {
  const { settings, updateSettings } = useSettings();
  const [profiles, setProfiles] = useState<PerformanceProfile[]>([]);
  const [activeId, setActiveId] = useState<PerformanceProfileId>('balanced');
  const [busyId, setBusyId] = useState<PerformanceProfileId | null>(null);
  const [result, setResult] = useState<PerformanceProfileResult | null>(null);

  useEffect(() => {
    let alive = true;
    getPerformanceProfiles().then((items) => {
      if (!alive) return;
      setProfiles(items);
      setActiveId(items.find((item) => item.selected)?.id ?? 'balanced');
    });
    return () => {
      alive = false;
    };
  }, []);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeId), [activeId, profiles]);

  async function handleApply(id: PerformanceProfileId) {
    setBusyId(id);
    try {
      const response = await applyPerformanceProfile(id);
      setActiveId(id);
      setProfiles((current) => current.map((profile) => ({ ...profile, selected: profile.id === id })));
      updateSettings((current) => ({
        ...current,
        experience: {
          ...current.experience,
          performanceMode: id === 'gaming' || id === 'creator' ? 'performance' : id === 'quiet' ? 'quiet' : 'balanced',
        },
      }));
      setResult(response);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Performance control"
        title="Profiles"
        description="Built-in profile orchestration for power intent, cooling behaviour, tray state, and future firmware-safe adapters."
        action={
          <div className="profile-status">
            <RadioTower size={16} />
            <span>{settings.experience.performanceMode}</span>
          </div>
        }
      />

      <div className="profiles-layout">
        <Panel className="profiles-list-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Available modes</span>
              <h2>System intent</h2>
            </div>
          </div>

          <div className="profiles-list">
            {profiles.map((profile) => {
              const Icon = iconMap[profile.id];
              const isActive = profile.id === activeId;
              const isBusy = busyId === profile.id;
              return (
                <button className={`profile-row ${isActive ? 'active' : ''}`} key={profile.id} onClick={() => void handleApply(profile.id)} disabled={Boolean(busyId)}>
                  <span className="profile-icon">
                    <Icon size={18} />
                  </span>
                  <span className="profile-row-copy">
                    <strong>{profile.name}</strong>
                    <small>{profile.summary}</small>
                  </span>
                  <span className="profile-row-state">{isBusy ? <Loader2 size={17} className="spin" /> : isActive ? <Check size={17} /> : null}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="profile-detail-panel">
          {activeProfile && (
            <>
              <div className="profile-detail-hero">
                <div>
                  <span className="eyebrow">Active profile</span>
                  <h2>{activeProfile.name}</h2>
                  <p>{activeProfile.recommendedFor}</p>
                </div>
                <Sparkles size={24} />
              </div>

              <div className="profile-metrics">
                <ProfileMetric icon={Zap} label="Power" value={activeProfile.powerIntent} />
                <ProfileMetric icon={Fan} label="Cooling" value={activeProfile.fanIntent} />
                <ProfileMetric icon={Gauge} label="Noise" value={activeProfile.estimatedNoise} />
              </div>

              <div className="profile-safety">
                <strong>Safe implementation boundary</strong>
                <p>
                  This profile currently applies Companion state, tray intent, and overlay behaviour. Firmware, fan table, and power limit writes stay locked behind native
                  capability checks.
                </p>
              </div>

              {result && (
                <div className="profile-result">
                  <strong>{result.message}</strong>
                  {result.actions.map((action) => (
                    <span key={action}>{action}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

type ProfileMetricProps = {
  icon: typeof Zap;
  label: string;
  value: string;
};

function ProfileMetric({ icon: Icon, label, value }: ProfileMetricProps) {
  return (
    <div className="profile-metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
