import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { brand } from '../lib/branding';

type SplashStep = {
  label: string;
  icon: LucideIcon;
};

type SplashScreenProps = {
  steps: SplashStep[];
  onComplete: () => void;
};

export function SplashScreen({ steps, onComplete }: SplashScreenProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    }, 760);
    const complete = window.setTimeout(onComplete, 2650);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(complete);
    };
  }, [onComplete, steps.length]);

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.42, ease: 'easeOut' }}
    >
      <motion.div
        className="splash-panel"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div className="splash-logo-hero">
          <img className="splash-logo" src={brand.splashLogo} alt={brand.productName} />
          <p className="splash-tagline">{brand.splashTagline}</p>
        </div>
        <div className="splash-ring" aria-hidden="true">
          <motion.span
            className="splash-ring-outer"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 6.4, ease: 'linear' }}
          />
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3.2, ease: 'linear' }}
          />
          <img src={brand.splashIcon} alt="" />
        </div>
        <div className="splash-steps">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = index <= activeStep;
            return (
              <div className={active ? 'splash-step active' : 'splash-step'} key={step.label}>
                <Icon size={16} />
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
        <div className="splash-progress" aria-hidden="true">
          <span style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} />
        </div>
      </motion.div>
    </motion.div>
  );
}
