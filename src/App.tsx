import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Gauge, HardDrive, LayoutDashboard, MemoryStick, PackageMinus, Settings, Sparkles, TimerReset, Wrench, FileWarning, Cpu, Bot } from 'lucide-react';
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
import { BenchmarkPage } from './pages/BenchmarkPage';
import { AiCopilotPage } from './pages/AiCopilotPage';
import { MonitorProvider } from './context/MonitorContext';
import { SettingsProvider } from './context/SettingsContext';
import { useSettings } from './hooks/useSettings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { brand } from './lib/branding';
import { recordCompanionAction } from './lib/actionHistory';
import {
  exportDiagnostics,
  applyPerformanceProfile,
  optimizeRam,
  restartMonitoringEngine,
  setCloseToTray,
  setMinimizeToTrayOnMinimize,
  setOverlayWindow,
  showMainWindow,
} from './services/systemService';
import type { NavItem } from './types/navigation';
import type { PerformanceProfileId } from './types/system';

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview health sensors support readiness' },
  { id: 'thermals', label: 'Thermals', icon: Activity, keywords: 'temperature cooling cpu gpu airflow case sensors' },
  { id: 'processes', label: 'Processes', icon: Cpu, keywords: 'task manager cpu memory top usage apps' },
  { id: 'optimizer', label: 'Memory', icon: MemoryStick, keywords: 'ram cleaner trim standby cache optimize' },
  { id: 'cleanup', label: 'Bloatware', icon: PackageMinus, keywords: 'apps uninstall remove trial software cleanup' },
  { id: 'registry', label: 'Registry', icon: FileWarning, keywords: 'registry cleaner backup restore startup paths issues' },
  { id: 'startup', label: 'Startup', icon: TimerReset, keywords: 'boot login autorun startup apps enable disable' },
  { id: 'storage', label: 'System Clean', icon: HardDrive, keywords: 'disk storage temp files logs reclaim cleanup' },
  { id: 'profiles', label: 'Profiles', icon: Gauge, keywords: 'performance quiet balanced gaming creator power mode' },
  { id: 'benchmark', label: 'Benchmark', icon: BarChart3, keywords: 'scores compare results performance capture' },
  { id: 'copilot', label: 'CoPilot', icon: Bot, keywords: 'ai assistant local model ollama recommendations chat' },
  { id: 'utilities', label: 'Utilities', icon: Wrench, keywords: 'tools fan rgb updates staged capabilities' },
  { id: 'settings', label: 'Settings', icon: Settings, keywords: 'preferences about diagnostics passport support updates' },
];

export function App() {
  const overlayWindow = new URLSearchParams(window.location.search).get('overlay') === '1';

  return (
    <SettingsProvider>
      <ErrorBoundary>
        <MonitorProvider>
          {overlayWindow ? <OverlayOnlyApp /> : <CompanionApp />}
        </MonitorProvider>
      </ErrorBoundary>
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
      return window.localStorage.getItem(`${brand.mode}-onboarding-complete-v1`) !== '1';
    } catch {
      return true;
    }
  });
  const [activeView, setActiveView] = useState('dashboard');
  const [splashVisible, setSplashVisible] = useState(true);
  const { settings, updateSettings } = useSettings();

  const applyTrayProfile = (id: PerformanceProfileId) => {
    void applyPerformanceProfile(id).then((result) => {
      recordCompanionAction('tray', `${id} profile applied from tray`, result.validation?.status ?? result.message);
    }).catch((err) => {
      recordCompanionAction('tray', `${id} profile apply failed`, err instanceof Error ? err.message : String(err));
    });
    updateSettings((current) => ({
      ...current,
      experience: {
        ...current.experience,
        performanceProfile: id,
        performanceMode: id === 'gaming' || id === 'creator' ? 'performance' : id === 'quiet' ? 'quiet' : 'balanced',
      },
    }));
  };

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
      case 'benchmark':
        return <BenchmarkPage />;
      case 'utilities':
        return <UtilitiesPage mode={activeView} onNavigate={setActiveView} />;
      case 'copilot':
        return <AiCopilotPage />;
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
      void optimizeRam().then((result) => {
        recordCompanionAction('maintenance', 'Quick RAM clean', result.message);
      }).catch((err) => recordCompanionAction('maintenance', 'Quick RAM clean failed', String(err)));
    });
    listenSafely('tray://profile-quiet', () => applyTrayProfile('quiet'));
    listenSafely('tray://profile-balanced', () => applyTrayProfile('balanced'));
    listenSafely('tray://profile-gaming', () => applyTrayProfile('gaming'));
    listenSafely('tray://profile-creator', () => applyTrayProfile('creator'));
    listenSafely('tray://performance-mode', () => applyTrayProfile('gaming'));
    listenSafely('tray://quiet-mode', () => applyTrayProfile('quiet'));
    listenSafely('tray://export-diagnostics', () => {
      void exportDiagnostics().then((result) => {
        recordCompanionAction('support', 'Diagnostics exported from tray', result.path);
      }).catch((err) => recordCompanionAction('support', 'Diagnostics export failed from tray', String(err)));
    });
    listenSafely('tray://restart-monitoring', () => {
      void restartMonitoringEngine();
      recordCompanionAction('diagnostics', 'Monitoring engine restart requested', 'Tray menu action');
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
      <ErrorBoundary>
        <Shell navItems={navItems} activeView={activeView} onNavigate={setActiveView}>
        <AnimatePresence mode="sync">
          <motion.main
            key={activeView}
            className="page-transition"
            initial={settings.experience.animations ? { opacity: 0, x: 14, y: 1, scale: 0.995 } : false}
            animate={settings.experience.animations ? { opacity: 1, x: 0, y: 0, scale: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={settings.experience.animations ? { opacity: 0, x: -8, y: 0, scale: 0.998 } : { opacity: 0 }}
            transition={{
              x: { type: 'spring', stiffness: 310, damping: 34, mass: 0.55 },
              y: { duration: settings.experience.animations ? 0.16 : 0.01, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: settings.experience.animations ? 0.16 : 0.01, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: settings.experience.animations ? 0.16 : 0.01, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            <ErrorBoundary>
              {page}
            </ErrorBoundary>
          </motion.main>
        </AnimatePresence>
      </Shell>
      </ErrorBoundary>
      <OsdOverlay />
      <AnimatePresence>
        {splashVisible && (
          <SplashScreen
            onComplete={() => setSplashVisible(false)}
            steps={[
              { label: `Starting ${brand.productName}`, icon: HardDrive },
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
                window.localStorage.setItem(`${brand.mode}-onboarding-complete-v1`, '1');
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
