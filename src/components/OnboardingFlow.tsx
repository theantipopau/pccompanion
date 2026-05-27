import { motion } from 'framer-motion';
import { Award, CircuitBoard, Sparkles } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { assets } from '../lib/assets';
import { setStartupMode } from '../services/systemService';
import type { PerformanceProfileId, TrayMetric } from '../types/system';

type OnboardingFlowProps = {
  onComplete: () => void;
};

const stages = [
  {
    id: 'identity',
    title: 'Welcome to Radium PCs Companion',
    text: 'Thanks for purchasing a Radium PCs custom build. Companion is your local hub for telemetry, support diagnostics, cleanup, and performance profiles.',
    icon: Sparkles,
  },
  {
    id: 'discovery',
    title: 'Your hardware is being profiled',
    text: 'CPU, GPU, memory, storage, network, and provider checks initialise in layers so the dashboard can show trusted data without heavy background load.',
    icon: CircuitBoard,
  },
  {
    id: 'passport',
    title: 'Support-ready from first launch',
    text: 'System Passport and Telemetry Diagnostics keep useful build information close by if you ever need help from the Radium PCs team.',
    icon: Award,
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { settings, updateSettings } = useSettings();

  function setTrayMetric(metric: TrayMetric) {
    updateSettings((current) => ({ ...current, tray: { ...current.tray, liveIconMetric: metric } }));
  }

  function setDefaultProfile(profile: PerformanceProfileId) {
    updateSettings((current) => ({
      ...current,
      experience: {
        ...current.experience,
        performanceProfile: profile,
        performanceMode: profile === 'gaming' || profile === 'creator' ? 'performance' : profile === 'quiet' ? 'quiet' : 'balanced',
      },
    }));
  }

  function setStartup(checked: boolean) {
    updateSettings((current) => ({ ...current, tray: { ...current.tray, startWithWindows: checked } }));
    void setStartupMode(checked, settings.tray.startMinimized);
  }

  return (
    <motion.div
      className="onboarding-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0.13, 1] }}
    >
      <motion.div
        className="onboarding-panel"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.66 }}
      >
        <div className="onboarding-brand">
          <img src={assets.radiumLogo} alt="" />
          <span className="eyebrow">First launch</span>
        </div>
        <h2>Welcome to your Radium custom build</h2>
        <p>Companion has finished initialising. Review the essentials below, then enter the live dashboard.</p>
        <div className="onboarding-quick-setup">
          <label>
            <span>Tray metric</span>
            <select value={settings.tray.liveIconMetric} onChange={(event) => setTrayMetric(event.target.value as TrayMetric)}>
              <option value="cpuTemp">CPU temperature</option>
              <option value="gpuTemp">GPU temperature</option>
              <option value="cpuUsage">CPU usage</option>
              <option value="gpuUsage">GPU usage</option>
              <option value="ramUsage">RAM usage</option>
              <option value="disabled">Static icon</option>
            </select>
          </label>
          <label>
            <span>Default profile</span>
            <select value={settings.experience.performanceProfile} onChange={(event) => setDefaultProfile(event.target.value as PerformanceProfileId)}>
              <option value="balanced">Balanced</option>
              <option value="gaming">Gaming</option>
              <option value="creator">Creator</option>
              <option value="quiet">Quiet</option>
            </select>
          </label>
          <label className="onboarding-check">
            <span>Start with Windows</span>
            <input type="checkbox" checked={settings.tray.startWithWindows} onChange={(event) => setStartup(event.target.checked)} />
          </label>
        </div>
        <div className="onboarding-steps">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.id}
                className="onboarding-step"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.64, delay: index * 0.08 }}
              >
                <div className="onboarding-step-icon">
                  <Icon size={16} />
                </div>
                <div>
                  <strong>{stage.title}</strong>
                  <span>{stage.text}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="onboarding-actions">
          <button className="primary-button" onClick={onComplete}>Enter Companion</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
