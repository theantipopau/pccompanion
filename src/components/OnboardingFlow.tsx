import { motion } from 'framer-motion';
import { Award, CircuitBoard, Sparkles } from 'lucide-react';

type OnboardingFlowProps = {
  onComplete: () => void;
};

const stages = [
  {
    id: 'identity',
    title: 'Welcome To Radium Command Center',
    text: 'This system is now paired to the premium Radium PCs software identity for monitoring, optimization, and support workflows.',
    icon: Sparkles,
  },
  {
    id: 'discovery',
    title: 'Hardware Discovery Sequence',
    text: 'Telemetry providers initialize in layers for CPU, GPU, memory, storage, and network surfaces while preserving low system overhead.',
    icon: CircuitBoard,
  },
  {
    id: 'passport',
    title: 'System Passport Ready',
    text: 'Your device profile, readiness score, and support-centric identity now form the base of an OEM-grade ownership experience.',
    icon: Award,
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
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
        <span className="eyebrow">First launch</span>
        <h2>Premium OEM Onboarding</h2>
        <p>Command Center initialization has completed. Review the platform pillars below before entering the live dashboard.</p>
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
          <button className="primary-button" onClick={onComplete}>Enter Command Center</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
