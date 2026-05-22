import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Activity, Gauge, HardDrive, LayoutDashboard, MemoryStick, PackageMinus, Settings, ShieldCheck, Sparkles, TimerReset, Wrench, FileWarning, Cpu } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { Shell } from './components/Shell';
import { SplashScreen } from './components/SplashScreen';
import { OsdOverlay } from './components/OsdOverlay';
import { DashboardPage } from './pages/DashboardPage';
import { RamCleanerPage } from './pages/RamCleanerPage';
import { BloatwarePage } from './pages/BloatwarePage';
import { UtilitiesPage } from './pages/UtilitiesPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
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
import { optimizeRam, setOverlayWindow, showMainWindow } from './services/systemService';
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
  { id: 'diagnostics', label: 'Diagnostics', icon: ShieldCheck },
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
    document.body.classList.add('overlay-window-body');
    return () => document.body.classList.remove('overlay-window-body');
  }, []);

  return <OsdOverlay />;
}

function CompanionApp() {
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
        return <DiagnosticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
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

    return () => disposers.forEach((dispose) => dispose());
  }, [updateSettings]);

  useEffect(() => {
    void setOverlayWindow(settings.overlay.enabled, settings.overlay.clickThrough);
  }, [settings.overlay.enabled, settings.overlay.clickThrough]);

  return (
    <>
      <Shell navItems={navItems} activeView={activeView} onNavigate={setActiveView}>
        <AnimatePresence mode="wait">
          <motion.main
            key={activeView}
            className="page-transition"
            initial={{ opacity: 0, x: 12, filter: 'blur(2px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -10, filter: 'blur(1.5px)' }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0.13, 1] }}
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
    </>
  );
}
