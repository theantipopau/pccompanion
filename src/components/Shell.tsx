import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Clock3, Cpu, ExternalLink, Gauge, Globe2, Layers, Mail, MemoryStick, Minimize2, MonitorUp, PhoneCall, Search, Settings, ShieldCheck, Thermometer } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { assets } from '../lib/assets';
import { pct, temp } from '../lib/format';
import { extractTrayValue } from '../lib/trayIcon';
import type { NavItem } from '../types/navigation';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { ErrorBoundary } from './ErrorBoundary';
import { CpuIcon, GpuIcon, RamIcon, ThermalIcon } from './HardwareIcon';

type ShellProps = {
  navItems: NavItem[];
  activeView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
};

export function Shell({ navItems, activeView, onNavigate, children }: ShellProps) {
  const companyWebsite = 'https://radiumpcs.com.au';
  const phone = '1300 935 884';
  const salesEmail = 'sales@radiumpcs.com.au';
  const supportEmail = 'support@radiumpcs.com.au';
  const operationsEmail = 'operations@radiumpcs.com.au';
  const businessHours = 'Mon-Fri, 9:30am-5:30pm';
  const storeAddress = '207 Hyde St, Yarraville VIC 3013, Australia';
  const supportSubject = 'Radium PCs Companion Support';
  const { sample } = useMonitor();
  const { settings, updateSettings } = useSettings();
  const dashboardActive = activeView === 'dashboard';
  const compactShell = settings.experience.compactMode;
  const motionEnabled = settings.experience.animations;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const quickActions = [
    {
      id: 'action-open-system-passport',
      label: 'Open System Passport',
      icon: Gauge,
      keywords: 'passport serial build oem identity score',
      run: () => onNavigate('passport'),
    },
    {
      id: 'action-open-telemetry-diagnostics',
      label: 'Open Telemetry Diagnostics',
      icon: ShieldCheck,
      keywords: 'diagnostics provenance provider confidence support bundle',
      run: () => onNavigate('diagnostics'),
    },
    {
      id: 'action-open-radium-site',
      label: 'Open Radium PCs website',
      icon: Globe2,
      keywords: 'website sales build consultation',
      run: () => window.open(companyWebsite, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'action-email-support',
      label: 'Email support',
      icon: Mail,
      keywords: 'support help issue',
      run: () => window.open(`mailto:${supportEmail}`, '_self'),
    },
    {
      id: 'action-open-settings',
      label: 'Go to settings',
      icon: Settings,
      keywords: 'settings preferences',
      run: () => onNavigate('settings'),
    },
  ];

  const query = searchQuery.trim().toLowerCase();
  const pageResults = navItems
    .filter(item =>
      query
        ? item.label.toLowerCase().includes(query)
        : true,
    )
    .map(item => ({
      id: `page-${item.id}`,
      label: item.label,
      icon: item.icon,
      run: () => onNavigate(item.id),
    }));

  const actionResults = quickActions
    .filter(action =>
      query
        ? `${action.label} ${action.keywords}`.toLowerCase().includes(query)
        : true,
    )
    .map(action => ({
      id: action.id,
      label: action.label,
      icon: action.icon,
      run: action.run,
    }));

  const searchResults = [...pageResults, ...actionResults].slice(0, 9);

  const navGroups: Array<{ label: string; ids: string[] }> = [
    { label: 'Monitor', ids: ['dashboard', 'thermals', 'processes'] },
    { label: 'Tuning', ids: ['profiles', 'optimizer', 'utilities'] },
    { label: 'Maintenance', ids: ['cleanup', 'registry', 'startup', 'storage', 'settings'] },
  ];

  const groupedNavItems = navGroups
    .map((group) => ({
      ...group,
      items: group.ids
        .map((id) => navItems.find((item) => item.id === id))
        .filter((item): item is NavItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setSearchQuery('');
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'ArrowDown' && searchResults.length > 0) {
      e.preventDefault();
      setActiveSearchIndex((current) => (current + 1) % searchResults.length);
      return;
    }
    if (e.key === 'ArrowUp' && searchResults.length > 0) {
      e.preventDefault();
      setActiveSearchIndex((current) => (current - 1 + searchResults.length) % searchResults.length);
      return;
    }
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const selected = searchResults[Math.min(activeSearchIndex, searchResults.length - 1)];
      selected.run();
      setSearchQuery('');
      e.currentTarget.blur();
    }
  }

  const trayPreview = (() => {
    const metric = settings.tray.liveIconMetric;
    if (!sample || metric === 'disabled') return { Icon: Gauge, label: 'Tray off' };
    const { value, isTemp } = extractTrayValue(sample, metric);
    if (isTemp) {
      const source = metric === 'gpuTemp' ? 'GPU' : 'CPU';
      return { Icon: Thermometer, label: `${temp(value, settings.monitoring.temperatureUnit)} ${source}` };
    }
    return { Icon: Cpu, label: `${pct(value ?? 0)} ${metric.replace('Usage', '').toUpperCase()}` };
  })();
  const telemetrySummary = sample
    ? `${sample.state.toUpperCase()} · ${sample.gpu.provider ? sample.gpu.provider.toUpperCase() : 'WMI'}`
    : 'INITIALISING · PROVIDER PENDING';

  async function handleMinimize() {
    try {
      const window = getCurrentWindow();
      if (settings.tray.minimizeOnMinimize) {
        await window.hide();
      } else {
        await window.minimize();
      }
    } catch {
      window.dispatchEvent(new CustomEvent('radium:minimize-preview'));
    }
  }

  return (
    <div className={compactShell ? 'app-shell compact-shell' : 'app-shell'}>
      <aside className={compactShell ? 'sidebar compact' : 'sidebar'} aria-label="Primary">
        <div className="brand-lockup">
          <span className="brand-icon-frame">
            <img className="brand-icon" src={assets.radiumLogo} alt="Radium PCs" />
          </span>
          <span className="brand-copy">
            <strong>Radium PCs</strong>
            <span>Companion</span>
          </span>
        </div>
        <nav className="nav-list">
          {groupedNavItems.map((group) => (
            <div key={group.label} className="nav-group">
              <span className="nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeView;
                return (
                  <motion.button
                    key={item.id}
                    className={active ? 'nav-item active' : 'nav-item'}
                    onClick={() => onNavigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    title={item.label}
                    whileHover={motionEnabled ? { x: active ? 0 : 2 } : undefined}
                    whileTap={motionEnabled ? { scale: 0.975 } : undefined}
                    transition={{ duration: 0.12, ease: [0.2, 0, 0.13, 1] }}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                    {active && (
                      <motion.span
                        className="nav-active-pip"
                        layoutId="nav-active-pip"
                        transition={{ duration: motionEnabled ? 0.2 : 0, ease: [0.2, 0, 0.13, 1] }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Live sensor strip — shown on all pages so temps are always visible */}
        <div className="sidebar-metrics">
          <span className="sidebar-metrics-label">Live sensors</span>
          <div className="sidebar-metric-row">
            <ThermalIcon size={13} />
            <span>CPU</span>
            <strong className={tempClass(sample?.cpu.temperature)}>
              {sample ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <GpuIcon size={13} />
            <span>GPU</span>
            <strong className={tempClass(sample?.gpu.temperature)}>
              {sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <CpuIcon size={13} />
            <span>CPU%</span>
            <strong className={usageClass(sample?.cpu.usage)}>
              {sample ? pct(sample.cpu.usage) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <GpuIcon size={13} />
            <span>GPU%</span>
            <strong className={usageClass(sample?.gpu.usage)}>
              {sample ? pct(sample.gpu.usage) : '—'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <RamIcon size={13} />
            <span>RAM</span>
            <strong className={usageClass(sample?.memory.usage)}>
              {sample ? pct(sample.memory.usage) : '—'}
            </strong>
          </div>
        </div>
        <div className="sidebar-brand-promo" aria-label="Radium Companion premium support panel">
          <img src={assets.radiumHeaderNew} alt="Radium Companion" />
          <p>Premium local support, diagnostics-first workflows, and lifecycle-safe tuning in one desktop suite.</p>
        </div>
        <div className="sidebar-contact">
          <span className="sidebar-metrics-label">Radium PCs Contact</span>
          <a className="sidebar-contact-link" href={companyWebsite} target="_blank" rel="noreferrer noopener">
            <Globe2 size={14} />
            <span>radiumpcs.com.au</span>
            <ExternalLink size={12} />
          </a>
          <a className="sidebar-contact-link" href={`tel:${phone.replace(/\s+/g, '')}`}>
            <PhoneCall size={14} />
            <span>{phone}</span>
          </a>
          <a className="sidebar-contact-link" href={`mailto:${salesEmail}`}>
            <Mail size={14} />
            <span>{salesEmail}</span>
          </a>
          <a className="sidebar-contact-link" href={`mailto:${supportEmail}`}>
            <Mail size={14} />
            <span>{supportEmail}</span>
          </a>
          <a className="sidebar-contact-link" href={`mailto:${operationsEmail}`}>
            <Mail size={14} />
            <span>{operationsEmail}</span>
          </a>
          <div className="sidebar-contact-static">
            <div className="sidebar-contact-line">
              <Clock3 size={13} />
              <span>{businessHours}</span>
            </div>
            <div className="sidebar-contact-line">
              <Building2 size={13} />
              <span>{storeAddress}</span>
            </div>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className={dashboardActive ? 'topbar dashboard-topbar' : 'topbar'} data-tauri-drag-region>
          {!dashboardActive && (
            <button className="topbar-brand" onClick={() => onNavigate('dashboard')} title="Open dashboard">
              <img className="brand-icon" src={assets.radiumLogo} alt="Radium" />
              <span>Companion</span>
            </button>
          )}
          <div className="search-wrapper">
            <div className="search-field" onClick={() => searchRef.current?.focus()}>
              <Search size={16} />
              <input
                ref={searchRef}
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                placeholder="Search… ⌃K"
                aria-label="Search modules"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >×</button>
              )}
            </div>
            {searchFocused && (
              <div className="search-results" role="listbox">
                {searchResults.length > 0 ? searchResults.map((item, index) => {
                  const Icon = item.icon;
                  const activeResult = index === activeSearchIndex;
                  return (
                    <button
                      key={item.id}
                      className={activeResult ? 'search-result-item active' : 'search-result-item'}
                      role="option"
                      aria-selected={activeResult}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { item.run(); setSearchQuery(''); }}
                    >
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </button>
                  );
                }) : (
                  <div className="search-empty" role="status" aria-live="polite">
                    <strong>No matches found</strong>
                    <span>Try terms like diagnostics, passport, memory, or settings.</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="window-actions">
            <a
              className="topbar-support-link"
              href={`mailto:${supportEmail}?subject=${encodeURIComponent(supportSubject)}`}
              title="Contact support"
            >
              <Mail size={14} />
              <span>Get Support</span>
            </a>
            <div className="tray-preview" title="Live tray icon preview">
              <trayPreview.Icon size={15} />
              <span>{trayPreview.label}</span>
              <small>{telemetrySummary}</small>
            </div>
            <button
              title="Toggle OSD"
              className={settings.overlay.enabled ? 'icon-button active' : 'icon-button'}
              onClick={() => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, enabled: !current.overlay.enabled } }))}
            >
              <Layers size={17} />
            </button>
            <button title="Settings" className="icon-button" onClick={() => onNavigate('settings')}>
              <Settings size={17} />
            </button>
            <button title="Minimise to tray" className="icon-button" onClick={handleMinimize}>
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
