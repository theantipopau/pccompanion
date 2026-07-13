import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Cpu, Fan, Gauge, Gamepad2, Loader2, Lock, Moon, RadioTower, Sparkles, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../hooks/useSettings';
import { recordCompanionAction } from '../lib/actionHistory';
import { EASE_OUT } from '../lib/motion';
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
  const animateEntrance = settings.experience.animations;
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
  const expectations = useMemo(() => selectedProfile ? profileExpectations(selectedProfile.id) : [], [selectedProfile]);

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
      recordCompanionAction(
        'profile',
        `${id} profile applied`,
        response.validation?.status ? `Validation ${response.validation.status}` : response.message,
      );
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
        description="Applies supported Windows power controls, processor policy, tray intent, and low-latency timer behaviour. Your selected mode is saved in Companion settings."
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
            {profiles.map((profile, index) => {
              const Icon = iconMap[profile.id];
              const isActive = profile.id === activeId;
              const isSelected = profile.id === selectedId;
              const isBusy = busyId === profile.id;
              return (
                <motion.button
                  className={`profile-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                  key={profile.id}
                  initial={animateEntrance ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2, ease: EASE_OUT }}
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
                </motion.button>
              );
            })}
          </div>
        </Panel>

        <Panel className="profile-detail-panel">
          {selectedProfile && (
            <AnimatePresence mode="wait">
            <motion.div
              key={selectedProfile.id}
              initial={animateEntrance ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={animateEntrance ? { opacity: 0 } : undefined}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
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

              <div className="profile-expectation-panel">
                <div className="panel-heading compact">
                  <div>
                    <span className="eyebrow">What users can expect</span>
                    <h2>Native controls used by this mode</h2>
                  </div>
                </div>
                <div className="profile-expectation-grid">
                  {expectations.map((item) => (
                    <div className="profile-expectation" key={item.label}>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
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
                  Native writes are limited to supported Windows controls. Firmware, fan table, voltage, GPU power-limit, and EC writes stay locked until a model-safe adapter is available.
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

              {result?.validation && (
                <div className="profile-validation-panel">
                  <div className="panel-heading compact">
                    <div>
                      <span className="eyebrow">After apply</span>
                      <h2>Validation result</h2>
                    </div>
                    <span className={`profile-validation-status ${result.validation.status}`}>
                      {formatProfileStatus(result.validation.status)}
                    </span>
                  </div>
                  <div className="profile-validation-grid">
                    <ValidationItem
                      label="Windows plan"
                      expected={result.validation.expectedPlan}
                      detected={result.validation.detectedPlan}
                      verified={result.validation.planVerified}
                    />
                    <ValidationItem
                      label="Processor policy"
                      expected={result.validation.expectedProcessor}
                      detected={result.validation.detectedProcessor}
                      verified={result.validation.processorVerified}
                    />
                    <div className="profile-validation-item timer">
                      <Check size={16} />
                      <div>
                        <strong>Timer policy</strong>
                        <span>{result.validation.timerPolicy}</span>
                      </div>
                    </div>
                  </div>
                  {result.validation.notes.length > 0 && (
                    <div className="profile-validation-notes">
                      {result.validation.notes.map((note) => <span key={note}>{note}</span>)}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
            </AnimatePresence>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ValidationItem({
  label,
  expected,
  detected,
  verified,
}: {
  label: string;
  expected: string;
  detected: string;
  verified: boolean;
}) {
  return (
    <div className={verified ? 'profile-validation-item verified' : 'profile-validation-item attention'}>
      {verified ? <Check size={16} /> : <AlertTriangle size={16} />}
      <div>
        <strong>{label}</strong>
        <span>Expected: {expected}</span>
        <span>Detected: {detected}</span>
      </div>
    </div>
  );
}

function formatProfileStatus(status: string) {
  return status.replace(/_/g, ' ');
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
  const processorPolicy = profile.id === 'quiet'
    ? 'Processor 5-70%, boost disabled'
    : profile.id === 'creator'
      ? 'Processor 10-100%, boost enabled'
      : profile.id === 'gaming'
        ? 'Processor 10-100%, aggressive boost'
        : 'Processor 5-100%, boost enabled';
  const timerPolicy = profile.id === 'quiet'
    ? 'Timer override released to Windows default'
    : profile.id === 'balanced'
      ? 'Timer resolution target 1.0 ms'
      : 'Timer resolution target 0.5 ms';

  return [
    {
      label: 'Windows power plan',
      detail: powerPlan,
    },
    {
      label: 'Processor policy',
      detail: processorPolicy,
    },
    {
      label: 'Timer resolution',
      detail: timerPolicy,
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

function profileExpectations(id: PerformanceProfileId): Array<{ label: string; detail: string }> {
  const byMode: Record<PerformanceProfileId, Array<{ label: string; detail: string }>> = {
    quiet: [
      { label: 'Best for', detail: 'Light work, downloads, media playback, and overnight use.' },
      { label: 'Trade-off', detail: 'CPU boost is disabled and processor ceiling is reduced, so heavy jobs may finish slower.' },
      { label: 'Persists', detail: 'Companion stores Quiet locally and reuses that intent after restart.' },
    ],
    balanced: [
      { label: 'Best for', detail: 'Daily use, normal gaming, browsing, and mixed desktop workloads.' },
      { label: 'Trade-off', detail: 'Uses standard Windows Balanced behaviour with moderate responsiveness.' },
      { label: 'Persists', detail: 'Companion stores Balanced locally and reuses that intent after restart.' },
    ],
    gaming: [
      { label: 'Best for', detail: 'Foreground games, high refresh displays, and latency-sensitive sessions.' },
      { label: 'Trade-off', detail: 'Higher power draw and fan noise are expected while the mode is active.' },
      { label: 'Persists', detail: 'Companion stores Gaming locally and reuses that intent after restart.' },
    ],
    creator: [
      { label: 'Best for', detail: 'Rendering, encoding, compiling, streaming, and sustained production loads.' },
      { label: 'Trade-off', detail: 'Keeps performance plan behaviour without the full Gaming fan/noise intent.' },
      { label: 'Persists', detail: 'Companion stores Creator locally and reuses that intent after restart.' },
    ],
  };

  return byMode[id];
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
