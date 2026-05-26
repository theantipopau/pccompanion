import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Cpu, Fan, Gauge, Gamepad2, Loader2, Lock, Moon, RadioTower, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../hooks/useSettings';
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
  const [selectedId, setSelectedId] = useState<PerformanceProfileId>('balanced');
  const [busyId, setBusyId] = useState<PerformanceProfileId | null>(null);
  const [result, setResult] = useState<PerformanceProfileResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPerformanceProfiles().then((items) => {
      if (!alive) return;
      const selected = settings.experience.performanceProfile ?? items.find((item) => item.selected)?.id ?? 'balanced';
      setProfiles(items.map((item) => ({ ...item, selected: item.id === selected })));
      setActiveId(selected);
      setSelectedId(selected);
    });
    return () => {
      alive = false;
    };
  }, [settings.experience.performanceProfile]);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeId), [activeId, profiles]);
  const selectedProfile = useMemo(() => profiles.find((profile) => profile.id === selectedId) ?? activeProfile, [activeId, activeProfile, profiles, selectedId]);
  const plannedChanges = useMemo(() => selectedProfile ? profileChangePlan(selectedProfile) : [], [selectedProfile]);

  async function handleApply(id: PerformanceProfileId) {
    setBusyId(id);
    setError(null);
    try {
      const response = await applyPerformanceProfile(id);
      setActiveId(id);
      setProfiles((current) => current.map((profile) => ({ ...profile, selected: profile.id === id })));
      updateSettings((current) => ({
        ...current,
        experience: {
          ...current.experience,
          performanceProfile: id,
          performanceMode: id === 'gaming' || id === 'creator' ? 'performance' : id === 'quiet' ? 'quiet' : 'balanced',
        },
      }));
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile apply failed.');
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
              const isSelected = profile.id === selectedId;
              const isBusy = busyId === profile.id;
              return (
                <button
                  className={`profile-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                  key={profile.id}
                  onClick={() => {
                    setSelectedId(profile.id);
                    setError(null);
                  }}
                  disabled={Boolean(busyId)}
                >
                  <span className="profile-icon">
                    <Icon size={18} />
                  </span>
                  <span className="profile-row-copy">
                    <strong>{profile.name}</strong>
                    <small>{profile.summary}</small>
                  </span>
                  <span className="profile-row-state">{isBusy ? <Loader2 size={17} className="spin" /> : isActive ? <Check size={17} /> : isSelected ? <Sparkles size={16} /> : null}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="profile-detail-panel">
          {selectedProfile && (
            <>
              <div className="profile-detail-hero">
                <div>
                  <span className="eyebrow">{selectedProfile.id === activeId ? 'Active profile' : 'Profile preview'}</span>
                  <h2>{selectedProfile.name}</h2>
                  <p>{selectedProfile.recommendedFor}</p>
                </div>
                <Sparkles size={24} />
              </div>

              <div className="profile-metrics">
                <ProfileMetric icon={Zap} label="Power" value={selectedProfile.powerIntent} />
                <ProfileMetric icon={Fan} label="Cooling" value={selectedProfile.fanIntent} />
                <ProfileMetric icon={Gauge} label="Noise" value={selectedProfile.estimatedNoise} />
              </div>

              <div className="profile-change-panel">
                <div className="panel-heading compact">
                  <div>
                    <span className="eyebrow">Before apply</span>
                    <h2>Changes this profile can make</h2>
                  </div>
                </div>
                <div className="profile-change-list">
                  {plannedChanges.map((change) => (
                    <div key={change.label} className={change.blocked ? 'profile-change blocked' : 'profile-change'}>
                      {change.blocked ? <Lock size={16} /> : <Check size={16} />}
                      <div>
                        <strong>{change.label}</strong>
                        <span>{change.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="profile-safety">
                <strong>Safe implementation boundary</strong>
                <p>
                  Native writes are limited to supported Windows controls. Firmware, fan table, voltage, and power-limit writes stay locked until a model-safe adapter is available.
                </p>
              </div>

              <div className="profile-action-bar">
                <div>
                  <span>Current profile</span>
                  <strong>{activeProfile?.name ?? 'Balanced'}</strong>
                </div>
                <button className="primary-button" type="button" disabled={Boolean(busyId)} onClick={() => void handleApply(selectedProfile.id)}>
                  {busyId === selectedProfile.id ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
                  <span>{selectedProfile.id === activeId ? 'Re-apply profile' : `Apply ${selectedProfile.name}`}</span>
                </button>
              </div>

              {error && (
                <div className="profile-result profile-error">
                  <AlertTriangle size={16} />
                  <strong>{error}</strong>
                </div>
              )}

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

function profileChangePlan(profile: PerformanceProfile): Array<{ label: string; detail: string; blocked?: boolean }> {
  const powerPlan = profile.powerIntent === 'efficiency'
    ? 'Windows Power saver'
    : profile.powerIntent === 'performance'
      ? 'Ultimate/High Performance when available'
      : 'Windows Balanced';
  const companionMode = profile.id === 'gaming' || profile.id === 'creator'
    ? 'Performance'
    : profile.id === 'quiet'
      ? 'Quiet'
      : 'Balanced';

  return [
    {
      label: 'Windows power plan',
      detail: powerPlan,
    },
    {
      label: 'Companion mode',
      detail: `${companionMode} tray and overlay intent`,
    },
    {
      label: 'Cooling intent',
      detail: `${profile.fanIntent} fan policy only where safe adapters exist`,
    },
    {
      label: 'Low-level hardware writes',
      detail: 'Firmware, EC, voltage, and fan-table writes remain blocked',
      blocked: true,
    },
  ];
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
