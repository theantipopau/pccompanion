import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Gauge, HardDrive, LayoutDashboard, MemoryStick, PackageMinus, Settings, Sparkles, TimerReset, Wrench, FileWarning, Cpu } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { Shell } from './components/Shell';
import { SplashScreen } from './components/SplashScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { OsdOverlay } from './components/OsdOverlay';
import { DashboardPage } from './pages/DashboardPage';
import { RamCleanerPage } from './pages/RamCleanerPage';
import { BloatwarePage } from './pages/BloatwarePage';
import { UtilitiesPage } from './pages/UtilitiesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ThermalsPage } from './pages/ThermalsPage';
import { StartupManagerPage } from './pages/StartupManagerPage';
import { StorageCleanerPage } from './pages/StorageCleanerPage';
import { RegistryCleanerPage } from './pages/RegistryCleanerPage';
import { PerformanceProfilesPage } from './pages/PerformanceProfilesPage';
import { ProcessMonitorPage } from './pages/ProcessMonitorPage';
import { MonitorProvider } from './context/MonitorContext';
import { SettingsProvider } from './context/SettingsContext';
import { useSettings } from './hooks/useSettings';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  exportDiagnostics,
  optimizeRam,
  restartMonitoringEngine,
  setCloseToTray,
  setMinimizeToTrayOnMinimize,
  setOverlayWindow,
  showMainWindow,
} from './services/systemService';
import type { NavItem } from './types/navigation';

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'thermals', label: 'Thermals', icon: Activity },
  { id: 'processes', label: 'Processes', icon: Cpu },
  { id: 'optimizer', label: 'Memory', icon: MemoryStick },
  { id: 'cleanup', label: 'Bloatware', icon: PackageMinus },
  { id: 'registry', label: 'Registry', icon: FileWarning },
  { id: 'startup', label: 'Startup', icon: TimerReset },
  { id: 'storage', label: 'System Clean', icon: HardDrive },
  { id: 'profiles', label: 'Profiles', icon: Gauge },
  { id: 'utilities', label: 'Utilities', icon: Wrench },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function App() {
  const overlayWindow = new URLSearchParams(window.location.search).get('overlay') === '1';

  return (
    <SettingsProvider>
      <MonitorProvider>
        {overlayWindow ? <OverlayOnlyApp /> : <CompanionApp />}
      </MonitorProvider>
    </SettingsProvider>
  );
}

function OverlayOnlyApp() {
  useEffect(() => {
    document.documentElement.classList.add('overlay-window-root');
    document.body.classList.add('overlay-window-body');
    return () => {
      document.documentElement.classList.remove('overlay-window-root');
      document.body.classList.remove('overlay-window-body');
    };
  }, []);

  return <OsdOverlay forceVisible />;
}

function CompanionApp() {
  const [onboardingVisible, setOnboardingVisible] = useState(() => {
    try {
      return window.localStorage.getItem('radium-onboarding-complete-v1') !== '1';
    } catch {
      return true;
    }
  });
  const [activeView, setActiveView] = useState('dashboard');
  const [splashVisible, setSplashVisible] = useState(true);
  const { settings, updateSettings } = useSettings();

  const page = useMemo(() => {
    switch (activeView) {
      case 'optimizer':
        return <RamCleanerPage />;
      case 'processes':
        return <ProcessMonitorPage />;
      case 'cleanup':
        return <BloatwarePage />;
      case 'thermals':
      case 'monitoring':
        return <ThermalsPage />;
      case 'startup':
        return <StartupManagerPage />;
      case 'registry':
        return <RegistryCleanerPage />;
      case 'storage':
        return <StorageCleanerPage />;
      case 'profiles':
        return <PerformanceProfilesPage />;
      case 'utilities':
        return <UtilitiesPage mode={activeView} />;
      case 'diagnostics':
        return <SettingsPage initialTab="diagnostics" />;
      case 'passport':
        return <SettingsPage initialTab="passport" />;
      case 'settings':
        return <SettingsPage initialTab="general" />;
      default:
        return <DashboardPage onNavigate={setActiveView} />;
    }
  }, [activeView]);

  useEffect(() => {
    const disposers: Array<() => void> = [];
    const listenSafely = (event: string, handler: () => void) => {
      listen(event, handler)
        .then((dispose) => disposers.push(dispose))
        .catch(() => undefined);
    };

    listenSafely('tray://open-dashboard', () => {
      setActiveView('dashboard');
      void showMainWindow();
    });
    listenSafely('tray://open-passport', () => {
      setActiveView('passport');
      void showMainWindow();
    });
    listenSafely('tray://toggle-osd', () => {
      updateSettings((current) => {
        const enabled = !current.overlay.enabled;
        void setOverlayWindow(enabled, current.overlay.clickThrough);
        return { ...current, overlay: { ...current.overlay, enabled } };
      });
    });
    listenSafely('tray://quick-ram-clean', () => {
      void optimizeRam();
    });
    listenSafely('tray://performance-mode', () => {
      updateSettings((current) => ({ ...current, experience: { ...current.experience, performanceMode: 'performance' } }));
    });
    listenSafely('tray://quiet-mode', () => {
      updateSettings((current) => ({ ...current, experience: { ...current.experience, performanceMode: 'quiet' } }));
    });
    listenSafely('tray://export-diagnostics', () => {
      void exportDiagnostics();
    });
    listenSafely('tray://restart-monitoring', () => {
      void restartMonitoringEngine();
      updateSettings((current) => ({
        ...current,
        monitoring: { ...current.monitoring, launchOnStartup: true },
      }));
    });

    return () => disposers.forEach((dispose) => dispose());
  }, [updateSettings]);

  useEffect(() => {
    void setOverlayWindow(settings.overlay.enabled, settings.overlay.clickThrough);
  }, [settings.overlay.enabled, settings.overlay.clickThrough]);

  useEffect(() => {
    if (settings.overlay.launchOnStartup && !settings.overlay.enabled) {
      updateSettings((current) => ({
        ...current,
        overlay: { ...current.overlay, enabled: true },
      }));
    }
  }, [settings.overlay.enabled, settings.overlay.launchOnStartup, updateSettings]);

  useEffect(() => {
    void setCloseToTray(settings.tray.minimizeToTray);
  }, [settings.tray.minimizeToTray]);

  useEffect(() => {
    void setMinimizeToTrayOnMinimize(settings.tray.minimizeOnMinimize);
  }, [settings.tray.minimizeOnMinimize]);

  return (
    <>
      <Shell navItems={navItems} activeView={activeView} onNavigate={setActiveView}>
        <AnimatePresence mode="wait">
          <motion.main
            key={activeView}
            className="page-transition"
            initial={settings.experience.animations ? { opacity: 0, x: 18, y: 2, scale: 0.992, filter: 'blur(1.5px)' } : false}
            animate={settings.experience.animations ? { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' } : { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={settings.experience.animations ? { opacity: 0, x: -12, y: -1, scale: 0.996, filter: 'blur(1px)' } : { opacity: 0 }}
            transition={{
              x: { type: 'spring', stiffness: 250, damping: 30, mass: 0.6 },
              y: { type: 'spring', stiffness: 230, damping: 28, mass: 0.62 },
              opacity: { duration: settings.experience.animations ? 0.2 : 0.01, ease: [0.2, 0, 0.13, 1] },
              scale: { duration: settings.experience.animations ? 0.18 : 0.01, ease: [0.2, 0, 0.13, 1] },
              filter: { duration: settings.experience.animations ? 0.16 : 0.01, ease: [0.2, 0, 0.13, 1] },
            }}
          >
            <ErrorBoundary>
              {page}
            </ErrorBoundary>
          </motion.main>
        </AnimatePresence>
      </Shell>
      <OsdOverlay />
      <AnimatePresence>
        {splashVisible && (
          <SplashScreen
            onComplete={() => setSplashVisible(false)}
            steps={[
              { label: 'Scanning hardware', icon: HardDrive },
              { label: 'Loading performance modules', icon: Sparkles },
              { label: 'Preparing monitoring engine', icon: Activity },
            ]}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!splashVisible && onboardingVisible && (
          <OnboardingFlow
            onComplete={() => {
              setOnboardingVisible(false);
              try {
                window.localStorage.setItem('radium-onboarding-complete-v1', '1');
              } catch {
                // ignore storage failures and continue onboarding flow.
              }
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
