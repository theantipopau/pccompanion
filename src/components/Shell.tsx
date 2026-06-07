import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Clock3, Cpu, Download, ExternalLink, Gauge, Globe2, Layers, Mail, MemoryStick, Minimize2, PhoneCall, RefreshCw, Search, Settings, ShieldCheck, Thermometer, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { brand } from '../lib/branding';
import { recordCompanionAction } from '../lib/actionHistory';
import { pct, temp } from '../lib/format';
import { extractTrayValue } from '../lib/trayIcon';
import type { NavItem } from '../types/navigation';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { applyPerformanceProfile, exportDiagnostics, getAppMetadata, optimizeRam, restartMonitoringEngine } from '../services/systemService';
import { openExternalUrl } from '../services/native';
import type { AppMetadata, PerformanceProfileId } from '../types/system';
import { ErrorBoundary } from './ErrorBoundary';
import { CpuIcon, GpuIcon, RamIcon, ThermalIcon } from './HardwareIcon';

type ShellProps = {
  navItems: NavItem[];
  activeView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
};

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  category: 'Page' | 'Action' | 'Support';
  icon: LucideIcon;
  run: () => void;
};

export function Shell({ navItems, activeView, onNavigate, children }: ShellProps) {
  const companyWebsite = brand.website;
  const phone = brand.phone;
  const salesEmail = brand.salesEmail;
  const companionEmail = brand.companionEmail;
  const supportEmail = brand.supportEmail;
  const operationsEmail = brand.operationsEmail;
  const businessHours = brand.businessHours;
  const storeAddress = brand.address;
  const supportSubject = brand.supportSubject;
  const { sample: rawSample, displaySample, presentation, loading, error, native } = useMonitor();
  const { settings, updateSettings } = useSettings();
  const sample = displaySample ?? rawSample;
  const dashboardActive = activeView === 'dashboard';
  const compactShell = settings.experience.compactMode;
  const motionEnabled = settings.experience.animations;
  const searchListboxId = 'shell-command-palette-results';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [appMetadata, setAppMetadata] = useState<AppMetadata | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getAppMetadata()
      .then((metadata) => { if (alive) setAppMetadata(metadata); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  function applyProfileFromCommand(id: PerformanceProfileId) {
    void applyPerformanceProfile(id)
      .then((result) => {
        recordCompanionAction('profile', `${id} profile applied from command palette`, result.validation?.status ?? result.message);
      })
      .catch((err) => {
        recordCompanionAction('profile', `${id} profile apply failed`, err instanceof Error ? err.message : String(err));
      });
    updateSettings((current) => ({
      ...current,
      experience: {
        ...current.experience,
        performanceProfile: id,
        performanceMode: id === 'gaming' || id === 'creator' ? 'performance' : id === 'quiet' ? 'quiet' : 'balanced',
      },
    }));
  }

  const quickActions = useMemo(() => [
    {
      id: 'action-open-system-passport',
      label: 'Open System Passport',
      detail: 'Build identity, care checklist, and support metadata',
      category: 'Support' as const,
      icon: Gauge,
      keywords: 'passport serial build oem identity score',
      run: () => onNavigate('passport'),
    },
    {
      id: 'action-open-telemetry-diagnostics',
      label: 'Open Telemetry Diagnostics',
      detail: 'Provider health, confidence, sidecar state, and export',
      category: 'Support' as const,
      icon: ShieldCheck,
      keywords: 'diagnostics provenance provider confidence support bundle',
      run: () => onNavigate('diagnostics'),
    },
    {
      id: 'action-export-diagnostics',
      label: 'Export diagnostics bundle',
      detail: 'Prepare a local support snapshot',
      category: 'Support' as const,
      icon: Download,
      keywords: 'export diagnostics support bundle report snapshot',
      run: () => {
        void exportDiagnostics()
          .then((result) => recordCompanionAction('support', 'Diagnostics exported from command palette', result.path))
          .catch((err) => recordCompanionAction('support', 'Diagnostics export failed from command palette', String(err)));
      },
    },
    {
      id: 'action-restart-monitoring',
      label: 'Restart monitoring engine',
      detail: 'Refresh provider state and tray telemetry',
      category: 'Action' as const,
      icon: RefreshCw,
      keywords: 'restart monitoring engine telemetry provider refresh sensors',
      run: () => {
        void restartMonitoringEngine()
          .then((message) => recordCompanionAction('diagnostics', 'Monitoring engine restart requested', message))
          .catch((err) => recordCompanionAction('diagnostics', 'Monitoring restart failed', String(err)));
        updateSettings((current) => ({
          ...current,
          monitoring: { ...current.monitoring, launchOnStartup: true },
        }));
      },
    },
    {
      id: 'action-quick-ram-clean',
      label: 'Quick RAM clean',
      detail: 'Release standby cache without terminating apps',
      category: 'Action' as const,
      icon: MemoryStick,
      keywords: 'ram memory clean optimize standby cache trim',
      run: () => {
        void optimizeRam()
          .then((result) => recordCompanionAction('maintenance', 'Quick RAM clean from command palette', result.message))
          .catch((err) => recordCompanionAction('maintenance', 'Quick RAM clean failed from command palette', String(err)));
      },
    },
    {
      id: 'action-profile-quiet',
      label: 'Apply Quiet profile',
      detail: 'Lower-noise OS-level tuning intent',
      category: 'Action' as const,
      icon: Thermometer,
      keywords: 'quiet profile silent cool power mode',
      run: () => applyProfileFromCommand('quiet'),
    },
    {
      id: 'action-profile-balanced',
      label: 'Apply Balanced profile',
      detail: 'Daily-use profile with safe defaults',
      category: 'Action' as const,
      icon: Gauge,
      keywords: 'balanced profile normal daily power mode',
      run: () => applyProfileFromCommand('balanced'),
    },
    {
      id: 'action-profile-gaming',
      label: 'Apply Gaming profile',
      detail: 'Performance-focused OS-level tuning intent',
      category: 'Action' as const,
      icon: Zap,
      keywords: 'gaming performance profile boost power mode',
      run: () => applyProfileFromCommand('gaming'),
    },
    {
      id: 'action-open-brand-site',
      label: `Open ${brand.name} website`,
      detail: 'Open the configured brand website',
      category: 'Support' as const,
      icon: Globe2,
      keywords: 'website sales build consultation',
      run: () => openExternalUrl(companyWebsite),
    },
    {
      id: 'action-email-support',
      label: 'Email Companion support',
      detail: `Create a mail draft for ${brand.supportTeamName}`,
      category: 'Support' as const,
      icon: Mail,
      keywords: 'support help issue',
      run: () => window.open(`mailto:${companionEmail}?subject=${encodeURIComponent(supportSubject)}`, '_self'),
    },
    {
      id: 'action-open-settings',
      label: 'Go to settings',
      detail: 'Tray, overlay, startup, and interface preferences',
      category: 'Page' as const,
      icon: Settings,
      keywords: 'settings preferences',
      run: () => onNavigate('settings'),
    },
  ], [onNavigate, companyWebsite, companionEmail, supportSubject, updateSettings]);

  const query = searchQuery.trim().toLowerCase();
  const searchResults = useMemo<SearchResult[]>(() => {
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = (haystack: string) => terms.every((term) => haystack.includes(term));
    const pages = navItems
      .filter(item => !query || matches(`${item.label} ${item.id} ${item.keywords ?? ''}`.toLowerCase()))
      .map(item => ({
        id: `page-${item.id}`,
        label: item.label,
        detail: `Open ${item.label}`,
        category: 'Page' as const,
        icon: item.icon,
        run: () => onNavigate(item.id),
      }));
    const actions = quickActions
      .filter(action => !query || matches(`${action.label} ${action.keywords}`.toLowerCase()))
      .map(action => ({
        id: action.id,
        label: action.label,
        detail: action.detail,
        category: action.category,
        icon: action.icon,
        run: action.run,
      }));
    return [...actions, ...pages].slice(0, 10);
  }, [query, navItems, quickActions, onNavigate]);

  const navGroups: Array<{ label: string; ids: string[] }> = [
    { label: 'Monitor', ids: ['dashboard', 'thermals', 'processes'] },
    { label: 'Tuning', ids: ['profiles', 'benchmark', 'copilot', 'optimizer', 'utilities'] },
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
    setActiveSearchIndex((current) => Math.min(current, Math.max(searchResults.length - 1, 0)));
  }, [searchResults.length]);

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
      runSearchResult(selected.run);
    }
  }

  function runSearchResult(run: () => void) {
    run();
    setSearchQuery('');
    setSearchFocused(false);
    searchRef.current?.blur();
  }

  const trayPreview = (() => {
    if (!settings.monitoring.launchOnStartup) return { Icon: Gauge, label: 'Monitoring paused' };
    if (error && !presentation.isUsable) return { Icon: ShieldCheck, label: 'Sensor retry' };
    if (loading && !sample) return { Icon: Gauge, label: 'Starting sensors' };
    const metric = settings.tray.liveIconMetric;
    if (!sample || metric === 'disabled') return { Icon: Gauge, label: 'Tray off' };
    const { value, isTemp } = extractTrayValue(sample, metric);
    if (isTemp) {
      const source = metric === 'gpuTemp' ? 'GPU' : 'CPU';
      return { Icon: Thermometer, label: `${temp(value, settings.monitoring.temperatureUnit)} ${source}` };
    }
    return { Icon: Cpu, label: `${pct(value ?? 0)} ${metric.replace('Usage', '').toUpperCase()}` };
  })();
  const telemetrySummary = !settings.monitoring.launchOnStartup
    ? 'PAUSED - MONITORING OFF'
    : presentation.isUsable
    ? `${presentation.label.toUpperCase()} - ${presentation.provider}`
    : error
    ? `RETRYING - ${native ? 'NATIVE' : 'PREVIEW'}`
    : 'INITIALISING - PROVIDER PENDING';

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
            <img className="brand-icon" src={brand.splashIcon} alt={brand.name} />
          </span>
          <span className="brand-copy">
            <strong>{brand.name}</strong>
            <span>{brand.shortName}</span>
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

        {/* Live sensor strip - shown on all pages so temps are always visible */}
        <div className="sidebar-metrics">
          <span className="sidebar-metrics-label">Live sensors</span>
          <div className="sidebar-metric-row">
            <ThermalIcon size={13} />
            <span>CPU</span>
            <strong className={tempClass(sample?.cpu.temperature)}>
              {sample ? temp(sample.cpu.temperature, settings.monitoring.temperatureUnit) : '-'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <GpuIcon size={13} />
            <span>GPU</span>
            <strong className={tempClass(sample?.gpu.temperature)}>
              {sample ? temp(sample.gpu.temperature, settings.monitoring.temperatureUnit) : '-'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <CpuIcon size={13} />
            <span>CPU%</span>
            <strong className={usageClass(sample?.cpu.usage)}>
              {sample ? pct(sample.cpu.usage) : '-'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <GpuIcon size={13} />
            <span>GPU%</span>
            <strong className={usageClass(sample?.gpu.usage)}>
              {sample ? pct(sample.gpu.usage) : '-'}
            </strong>
          </div>
          <div className="sidebar-metric-row">
            <RamIcon size={13} />
            <span>RAM</span>
            <strong className={usageClass(sample?.memory.usage)}>
              {sample ? pct(sample.memory.usage) : '-'}
            </strong>
          </div>
        </div>
        <div className="sidebar-version-strip">
          <span>v{appMetadata?.version ?? '-'}</span>
          {appMetadata?.updateStatus === 'available' && (
            <button className="sidebar-update-pill" type="button" onClick={() => onNavigate('settings')} title="App update available - open Settings">
              <Zap size={11} />
              Update available
            </button>
          )}
        </div>
        <div className="sidebar-brand-promo" aria-label={brand.shellPromoAlt}>
          <img src={brand.splashLogo} alt={brand.productName} />
          <p>{brand.sidebarPromoBody}</p>
          <div className="sidebar-premium-badge">
            <span className="premium-badge-mark">
              <ShieldCheck size={14} />
            </span>
            <span>
              <strong>{brand.trustBadgeTitle}</strong>
              <small>{brand.trustBadgeDetail}</small>
            </span>
          </div>
        </div>
        <div className="sidebar-contact">
          <span className="sidebar-metrics-label">{brand.contactPanelLabel}</span>
          <a
            className="sidebar-contact-link"
            href={companyWebsite}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => {
              event.preventDefault();
              openExternalUrl(companyWebsite);
            }}
          >
            <Globe2 size={14} />
            <span>{brand.websiteLabel}</span>
            <ExternalLink size={12} />
          </a>
          <a className="sidebar-contact-link" href={`tel:${phone.replace(/\s+/g, '')}`}>
            <PhoneCall size={14} />
            <span>{phone}</span>
          </a>
          {brand.features.advancedSupport && (
            <>
              <a className="sidebar-contact-link" href={`mailto:${salesEmail}`}>
                <Mail size={14} />
                <span>{salesEmail}</span>
              </a>
              <a className="sidebar-contact-link" href={`mailto:${supportEmail}`}>
                <Mail size={14} />
                <span>{supportEmail}</span>
              </a>
            </>
          )}
          <a className="sidebar-contact-link" href={`mailto:${companionEmail}?subject=${encodeURIComponent(supportSubject)}`}>
            <Mail size={14} />
            <span>{companionEmail}</span>
          </a>
          {brand.features.advancedSupport && (
            <a className="sidebar-contact-link" href={`mailto:${operationsEmail}`}>
              <Mail size={14} />
              <span>{operationsEmail}</span>
            </a>
          )}
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
              <img className="brand-icon" src={brand.splashIcon} alt={brand.shortName} />
              <span>{brand.shortName}</span>
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
                placeholder="Search... Ctrl+K"
                aria-label="Search modules"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={searchFocused}
                aria-controls={searchListboxId}
                aria-activedescendant={searchFocused && searchResults.length > 0 ? `${searchListboxId}-${activeSearchIndex}` : undefined}
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {searchFocused && (
              <div className="search-results" id={searchListboxId} role="listbox">
                {searchResults.length > 0 ? searchResults.map((item, index) => {
                  const Icon = item.icon;
                  const activeResult = index === activeSearchIndex;
                  return (
                    <button
                      key={item.id}
                      id={`${searchListboxId}-${index}`}
                      className={activeResult ? 'search-result-item active' : 'search-result-item'}
                      role="option"
                      aria-selected={activeResult}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => runSearchResult(item.run)}
                    >
                      <Icon size={15} />
                      <span className="search-result-copy">
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <em>{item.category}</em>
                    </button>
                  );
                }) : (
                  <div className="search-empty" role="status" aria-live="polite">
                    <div className="search-empty-heading">
                      <img src={brand.splashIcon} alt="" aria-hidden="true" />
                      <span>
                        <strong>No matches found</strong>
                        <span>Try a module, maintenance task, or support workflow.</span>
                      </span>
                    </div>
                    <div className="search-empty-hints" aria-hidden="true">
                      <span>diagnostics</span>
                      <span>passport</span>
                      <span>memory</span>
                      <span>settings</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="window-actions">
            <a
              className="topbar-support-link"
              href={`mailto:${companionEmail}?subject=${encodeURIComponent(supportSubject)}`}
              title="Contact Companion support"
            >
              <Mail size={14} />
              <span>{brand.supportCtaLabel}</span>
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
