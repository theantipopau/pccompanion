import { Bell, Cpu, Gauge, MemoryStick, Minimize2, MonitorUp, Search, Settings, Thermometer } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { assets } from '../lib/assets';
import { pct, temp } from '../lib/format';
import type { NavItem } from '../types/navigation';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { ErrorBoundary } from './ErrorBoundary';

type ShellProps = {
  navItems: NavItem[];
  activeView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
};

export function Shell({ navItems, activeView, onNavigate, children }: ShellProps) {
  const { sample, native } = useMonitor();
  const { settings, updateSettings } = useSettings();
  const dashboardActive = activeView === 'dashboard';

  async function handleMinimize() {
    try {
      const window = getCurrentWindow();
      if (settings.tray.minimizeToTray) {
        await window.hide();
      } else {
        await window.minimize();
      }
    } catch {
      window.dispatchEvent(new CustomEvent('radium:minimize-preview'));
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-lockup">
          <img className="brand-icon" src={assets.radiumLogo} alt="Radium PCs" />
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                className={active ? 'nav-item active' : 'nav-item'}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                title={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live sensor strip — shown on all pages so temps are always visible */}
        <div className="sidebar-metrics">
          <span className="sidebar-metrics-label">Live sensors</span>
          <div className="sidebar-metric-row">
            <Thermometer size={13} />
            <span>CPU</span>
            <strong className={tempClass(sample?.cpu.temperature)}>
              {sample ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <MonitorUp size={13} />
            <span>GPU</span>
            <strong className={tempClass(sample?.gpu.temperature)}>
              {sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <Cpu size={13} />
            <span>CPU%</span>
            <strong className={usageClass(sample?.cpu.usage)}>
              {sample ? pct(sample.cpu.usage) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <MonitorUp size={13} />
            <span>GPU%</span>
            <strong className={usageClass(sample?.gpu.usage)}>
              {sample ? pct(sample.gpu.usage) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <MemoryStick size={13} />
            <span>RAM</span>
            <strong className={usageClass(sample?.memory.usage)}>
              {sample ? pct(sample.memory.usage) : '—'}
            </strong>
          </div>
        </div>
        <div className="sidebar-status">
          <span className={native ? 'status-dot' : 'status-dot status-dot-preview'} />
          <div>
            <strong>{native ? `${settings.experience.performanceMode} mode` : 'Browser preview'}</strong>
            <span>{native ? 'Live hardware data' : 'Run: npm run desktop'}</span>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className={dashboardActive ? 'topbar dashboard-topbar' : 'topbar'}>
          {!dashboardActive && (
            <button className="topbar-brand" onClick={() => onNavigate('dashboard')} title="Open dashboard">
              <img className="brand-icon" src={assets.radiumLogo} alt="Radium" />
              <span>Companion</span>
            </button>
          )}
          <div className="search-field">
            <Search size={16} />
            <span>Search modules, hardware, utilities</span>
          </div>
          <div className="window-actions">
            <div className="tray-preview" title="Live tray tooltip preview">
              <Cpu size={15} />
              <span>CPU {sample ? `${temp(sample.cpu.temperature, settings.monitoring.temperatureUnit)} ${pct(sample.cpu.usage)}` : 'Scanning'}</span>
            </div>
            <button
              title="Toggle OSD"
              className={settings.overlay.enabled ? 'icon-button active' : 'icon-button'}
              onClick={() => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, enabled: !current.overlay.enabled } }))}
            >
              <Cpu size={17} />
            </button>
            <button title="Notifications" className="icon-button">
              <Bell size={17} />
            </button>
            <button title="Settings" className="icon-button" onClick={() => onNavigate('settings')}>
              <Settings size={17} />
            </button>
            <button title="Minimize to tray" className="icon-button" onClick={handleMinimize}>
              <Minimize2 size={17} />
            </button>
          </div>
        </header>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </section>
    </div>
  );
}

function tempClass(value: number | undefined | null): string {
  if (value == null) return '';
  if (value >= 85) return 'metric-hot';
  if (value >= 70) return 'metric-warm';
  return 'metric-cool';
}

function usageClass(value: number | undefined | null): string {
  if (value == null) return '';
  if (value >= 85) return 'metric-hot';
  if (value >= 65) return 'metric-warm';
  return 'metric-cool';
}
