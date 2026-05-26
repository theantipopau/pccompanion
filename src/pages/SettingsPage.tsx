import { useEffect, useState } from 'react';
import { Bell, Gamepad2, Gauge, MonitorDot, Palette, Plus, Power, RefreshCw, RotateCcw, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { useSettings } from '../hooks/useSettings';
import { assets, oemLogoForText, vendorLogo } from '../lib/assets';
import { openExternalUrl } from '../services/native';
import { getAppMetadata, listTopProcesses, setStartupMode } from '../services/systemService';
import { SystemPassportPage } from './SystemPassportPage';
import { TelemetryDiagnosticsPage } from './TelemetryDiagnosticsPage';
import type { AppMetadata, GameProfileMapping, OverlayPreset, PerformanceMode, PerformanceProfileId, ProcessInfo, TrayMetric } from '../types/system';

const overlayPresets: Array<{ id: OverlayPreset; label: string }> = [
  { id: 'compact-bar',    label: 'Compact bar' },
  { id: 'corner-widget',  label: 'Corner widget' },
  { id: 'vertical-list',  label: 'Vertical list' },
  { id: 'minimal-card',   label: 'Minimal card' },
  { id: 'cinematic',      label: 'Cinematic - big numbers' },
  { id: 'benchmark',      label: 'Benchmark - dense grid' },
];

type SettingsTab = 'general' | 'games' | 'passport' | 'diagnostics';

export function SettingsPage({ initialTab = 'general' }: { initialTab?: SettingsTab }) {
  const { sample, systemInfo, native } = useMonitor();
  const { settings, updateSettings, resetSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [appMetadata, setAppMetadata] = useState<AppMetadata | null>(null);
  const normalizedTrayIconMode: TrayMetric = settings.tray.liveIconMetric;
  const cpuVendorAsset = systemInfo?.cpuVendor ? vendorLogo(systemInfo.cpuVendor) : assets.radiumLogo;
  const gpuVendorAsset = systemInfo?.gpuVendor ? vendorLogo(systemInfo.gpuVendor) : assets.radiumLogo;
  const boardAsset = oemLogoForText(systemInfo?.motherboard ?? '') ?? assets.radiumLogo;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let alive = true;
    getAppMetadata()
      .then((metadata) => {
        if (alive) setAppMetadata(metadata);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Personalisation"
        title="Settings"
        description="Tune tray, overlay, monitoring, profiles, and desktop integration."
        action={
          <button className="primary-button" onClick={resetSettings}>
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>
        }
      />

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button className={activeTab === 'general' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'general'} onClick={() => setActiveTab('general')}>
          <SlidersHorizontal size={16} />
          <span>General</span>
        </button>
        <button className={activeTab === 'passport' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'passport'} onClick={() => setActiveTab('passport')}>
          <Gauge size={16} />
          <span>System Passport</span>
        </button>
        <button className={activeTab === 'games' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'games'} onClick={() => setActiveTab('games')}>
          <Gamepad2 size={16} />
          <span>Game Mode</span>
        </button>
        <button className={activeTab === 'diagnostics' ? 'active' : ''} type="button" role="tab" aria-selected={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')}>
          <ShieldCheck size={16} />
          <span>Diagnostics</span>
        </button>
      </div>

      {activeTab === 'passport' && <SystemPassportPage embedded />}
      {activeTab === 'games' && <GameModeSettings />}
      {activeTab === 'diagnostics' && <TelemetryDiagnosticsPage embedded />}
      {activeTab === 'general' && (
      <div className="settings-grid">
        <Panel className="settings-panel settings-hero wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Companion profile</span>
              <h2>Current platform identity</h2>
            </div>
            <img className="settings-hero-wordmark" src={assets.radiumHeaderNew} alt="Radium Companion" />
          </div>
          <div className="settings-identity-row">
            <span className="settings-identity-pill">
              <img src={cpuVendorAsset} alt="CPU vendor" />
              <strong>{systemInfo?.cpuVendor?.toUpperCase() ?? 'CPU'}</strong>
            </span>
            <span className="settings-identity-pill">
              <img src={gpuVendorAsset} alt="GPU vendor" />
              <strong>{systemInfo?.gpuVendor?.toUpperCase() ?? 'GPU'}</strong>
            </span>
            <span className="settings-identity-pill">
              <img src={boardAsset} alt="Mainboard vendor" />
              <strong>{systemInfo?.motherboard ?? 'Mainboard pending'}</strong>
            </span>
            <span className="settings-identity-pill no-image">
              <strong>{sample ? `Runtime ${sample.state.toUpperCase()}` : 'Runtime initialising'}</strong>
            </span>
          </div>
        </Panel>

        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Desktop</span>
              <h2>Tray behaviour</h2>
            </div>
            <Bell size={19} />
          </div>
          <Toggle
            label="Minimise to tray (X button)"
            checked={settings.tray.minimizeToTray}
            onChange={(checked) => updateSettings((current) => ({ ...current, tray: { ...current.tray, minimizeToTray: checked } }))}
          />
          <Toggle
            label="Minimise to tray on minimise"
            checked={settings.tray.minimizeOnMinimize}
            onChange={(checked) => updateSettings((current) => ({ ...current, tray: { ...current.tray, minimizeOnMinimize: checked } }))}
          />
          <Toggle
            label="Start with Windows"
            checked={settings.tray.startWithWindows}
            onChange={(checked) => {
              updateSettings((current) => ({ ...current, tray: { ...current.tray, startWithWindows: checked } }));
              void setStartupMode(checked, settings.tray.startMinimized);
            }}
          />
          <Toggle
            label="Start minimised"
            checked={settings.tray.startMinimized}
            onChange={(checked) => {
              updateSettings((current) => ({ ...current, tray: { ...current.tray, startMinimized: checked } }));
              if (settings.tray.startWithWindows) {
                void setStartupMode(true, checked);
              }
            }}
          />
          <Toggle
            label="Live tray tooltip"
            checked={settings.tray.showLiveTooltip}
            onChange={(checked) => updateSettings((current) => ({ ...current, tray: { ...current.tray, showLiveTooltip: checked } }))}
          />
          <Toggle
            label="Silent background mode"
            checked={settings.tray.silentBackground}
            onChange={(checked) => updateSettings((current) => ({ ...current, tray: { ...current.tray, silentBackground: checked } }))}
          />
          <label className="control-row">
            <span>Live tray icon</span>
            <select
              value={normalizedTrayIconMode}
              onChange={(e) => updateSettings((current) => ({ ...current, tray: { ...current.tray, liveIconMetric: e.target.value as TrayMetric } }))}
            >
              <option value="disabled">App icon (static)</option>
              <option value="cpuTemp">CPU temperature gauge</option>
              <option value="gpuTemp">GPU temperature gauge</option>
              <option value="cpuUsage">CPU usage gauge</option>
              <option value="gpuUsage">GPU usage gauge</option>
              <option value="ramUsage">RAM usage gauge</option>
            </select>
          </label>
        </Panel>

        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OSD</span>
              <h2>Overlay</h2>
            </div>
            <MonitorDot size={19} />
          </div>
          <Toggle
            label="Enable overlay"
            checked={settings.overlay.enabled}
            onChange={(checked) => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, enabled: checked } }))}
          />
          <Toggle
            label="Launch overlay on startup"
            checked={settings.overlay.launchOnStartup}
            onChange={(checked) => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, launchOnStartup: checked } }))}
          />
          <Toggle
            label="Click-through native window"
            checked={settings.overlay.clickThrough}
            onChange={(checked) => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, clickThrough: checked } }))}
          />
          <label className="control-row">
            <span>Preset</span>
            <select
              value={settings.overlay.preset}
              onChange={(event) => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, preset: event.target.value as OverlayPreset } }))}
            >
              {overlayPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <Slider
            label="Opacity"
            min={0.35}
            max={1}
            step={0.01}
            value={settings.overlay.opacity}
            onChange={(value) => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, opacity: value } }))}
          />
          <Slider
            label="Scale"
            min={0.75}
            max={1.5}
            step={0.05}
            value={settings.overlay.scale}
            onChange={(value) => updateSettings((current) => ({ ...current, overlay: { ...current.overlay, scale: value } }))}
          />
        </Panel>

        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Telemetry</span>
              <h2>Monitoring</h2>
            </div>
            <Gauge size={19} />
          </div>
          <Toggle
            label="Launch monitoring on startup"
            checked={settings.monitoring.launchOnStartup}
            onChange={(checked) => updateSettings((current) => ({ ...current, monitoring: { ...current.monitoring, launchOnStartup: checked } }))}
          />
          <Slider
            label="Foreground refresh"
            min={750}
            max={3000}
            step={50}
            value={settings.monitoring.refreshMs}
            suffix="ms"
            onChange={(value) => updateSettings((current) => ({ ...current, monitoring: { ...current.monitoring, refreshMs: value } }))}
          />
          <Slider
            label="Background refresh"
            min={1500}
            max={8000}
            step={100}
            value={settings.monitoring.backgroundRefreshMs}
            suffix="ms"
            onChange={(value) => updateSettings((current) => ({ ...current, monitoring: { ...current.monitoring, backgroundRefreshMs: value } }))}
          />
          <label className="control-row">
            <span>Temperature</span>
            <select
              value={settings.monitoring.temperatureUnit}
              onChange={(event) => updateSettings((current) => ({ ...current, monitoring: { ...current.monitoring, temperatureUnit: event.target.value as 'c' | 'f' } }))}
            >
              <option value="c">Celsius</option>
              <option value="f">Fahrenheit</option>
            </select>
          </label>
        </Panel>

        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Experience</span>
              <h2>Interface</h2>
            </div>
            <Palette size={19} />
          </div>
          <Toggle
            label="Smooth animations"
            checked={settings.experience.animations}
            onChange={(checked) => updateSettings((current) => ({ ...current, experience: { ...current.experience, animations: checked } }))}
          />
          <Toggle
            label="Compact density"
            checked={settings.experience.compactMode}
            onChange={(checked) => updateSettings((current) => ({ ...current, experience: { ...current.experience, compactMode: checked } }))}
          />
          <label className="control-row">
            <span>Mode</span>
            <select
              value={settings.experience.performanceMode}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  experience: {
                    ...current.experience,
                    performanceMode: event.target.value as PerformanceMode,
                    performanceProfile: profileForMode(event.target.value as PerformanceMode),
                  },
                }))
              }
            >
              <option value="balanced">Balanced</option>
              <option value="performance">Performance</option>
              <option value="quiet">Quiet</option>
            </select>
          </label>
        </Panel>

        <Panel className="settings-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Telemetry</span>
              <h2>Live data availability</h2>
            </div>
            <Gauge size={19} />
          </div>
          {!native && (
            <p className="subtle">Browser preview mode is active. Run desktop mode to verify live hardware channels.</p>
          )}
          <div className="sensor-source-grid">
            <SensorSource label="CPU load / RAM / disks" value="sysinfo" live={!!sample} />
            <SensorSource
              label="CPU temperature"
              value={sample?.cpu.temperature != null ? 'CPU package sensor' : 'Radium low-level provider required'}
              live={sample?.cpu.temperature != null}
              hint={sample?.cpu.temperature == null ? 'Ryzen desktop package temperature needs bundled SMN/MSR access; generic Windows WMI cannot expose it reliably.' : undefined}
            />
            <SensorSource
              label="GPU sensors"
              value={systemInfo?.gpuVendor === 'nvidia' ? 'NVML internal' : systemInfo?.gpuVendor === 'amd' ? 'AMD ADL internal' : systemInfo?.gpuVendor === 'intel' ? 'WMI (usage only)' : 'WMI fallback'}
              live={(sample?.gpu.temperature != null) || (sample?.gpu.usage ?? 0) > 0}
              hint={systemInfo?.gpuVendor === 'intel' ? 'Intel Arc: usage via WMI only. Temp, fans, and power require IGCL support.' : undefined}
            />
            <SensorSource label="GPU power / fans" value="Vendor driver API" live={sample?.gpu.powerWatts != null || sample?.gpu.fanPct != null || sample?.fans.some((fan) => fan.rpm != null) === true} />
          </div>
        </Panel>

        <Panel className="settings-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Native integration</span>
              <h2>Production groundwork</h2>
            </div>
            <Power size={19} />
          </div>
          <div className="app-version-grid">
            <div>
              <span>Version</span>
              <strong>{appMetadata?.version ?? '0.1.0-pre'}</strong>
            </div>
            <div>
              <span>Channel</span>
              <strong>{appMetadata?.releaseChannel ?? 'pre-release'}</strong>
            </div>
            <div>
              <span>Build</span>
              <strong>{appMetadata?.buildProfile ?? (native ? 'desktop' : 'browser')}</strong>
            </div>
            <div>
              <span>Updates</span>
              <strong>{formatUpdateStatus(appMetadata?.updateStatus ?? 'manual')}</strong>
            </div>
          </div>
          <button className="secondary-button settings-release-link" type="button" onClick={() => openExternalUrl(appMetadata?.releaseNotesUrl ?? 'https://github.com/theantipopau/pccompanion/releases')}>
            <RefreshCw size={16} />
            <span>Release notes</span>
          </button>
          <div className="integration-row">
            <SlidersHorizontal size={18} />
            <span>Tray, OSD, cleanup, startup, notifications, and low-level sensor work are routed through native command boundaries.</span>
          </div>
        </Panel>
      </div>
      )}
    </div>
  );
}

function GameModeSettings() {
  const { settings, updateSettings } = useSettings();
  const [draftLabel, setDraftLabel] = useState('');
  const [draftProcess, setDraftProcess] = useState('');
  const [draftPath, setDraftPath] = useState('');
  const [draftLaunchProfile, setDraftLaunchProfile] = useState<PerformanceProfileId>('gaming');
  const [draftRestoreProfile, setDraftRestoreProfile] = useState<PerformanceProfileId>('balanced');
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processBusy, setProcessBusy] = useState(false);

  async function refreshProcesses() {
    setProcessBusy(true);
    try {
      setProcesses((await listTopProcesses(16)).filter((process) => !systemProcessNames.has(process.name.toLowerCase())));
    } finally {
      setProcessBusy(false);
    }
  }

  function addMapping(processName = draftProcess, label = draftLabel, executablePath = draftPath) {
    const cleanProcess = processName.trim();
    if (!cleanProcess) return;
    const cleanLabel = label.trim() || cleanProcess.replace(/\.exe$/i, '');
    const mapping: GameProfileMapping = {
      id: `game-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      label: cleanLabel,
      processName: cleanProcess,
      executablePath: executablePath.trim(),
      launchProfile: draftLaunchProfile,
      restoreProfile: draftRestoreProfile,
      enabled: true,
      automationEnabled: false,
    };
    updateSettings((current) => ({
      ...current,
      gameMode: { ...current.gameMode, mappings: [...current.gameMode.mappings, mapping] },
    }));
    setDraftLabel('');
    setDraftProcess('');
    setDraftPath('');
  }

  function updateMapping(id: string, updater: (mapping: GameProfileMapping) => GameProfileMapping) {
    updateSettings((current) => ({
      ...current,
      gameMode: {
        ...current.gameMode,
        mappings: current.gameMode.mappings.map((mapping) => (mapping.id === id ? updater(mapping) : mapping)),
      },
    }));
  }

  function removeMapping(id: string) {
    updateSettings((current) => ({
      ...current,
      gameMode: {
        ...current.gameMode,
        mappings: current.gameMode.mappings.filter((mapping) => mapping.id !== id),
      },
    }));
  }

  return (
    <div className="settings-subpage">
      <div className="embedded-page-intro">
        <div>
          <span className="eyebrow">Game mode</span>
          <h2>Manual profile mappings</h2>
          <p>Map games or launchers to profiles. Automation stays off until reviewed.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void refreshProcesses()} disabled={processBusy}>
          <RefreshCw size={16} />
          <span>{processBusy ? 'Scanning' : 'Detect apps'}</span>
        </button>
      </div>

      <Panel className="settings-panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Add mapping</span>
            <h2>Process trigger</h2>
          </div>
          <Gamepad2 size={19} />
        </div>
        <div className="game-map-form">
          <label>
            <span>Name</span>
            <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} placeholder="Cyberpunk 2077" />
          </label>
          <label>
            <span>Process</span>
            <input value={draftProcess} onChange={(event) => setDraftProcess(event.target.value)} placeholder="game.exe" />
          </label>
          <label>
            <span>Path optional</span>
            <input value={draftPath} onChange={(event) => setDraftPath(event.target.value)} placeholder="C:\\Games\\game.exe" />
          </label>
          <label>
            <span>Launch profile</span>
            <select value={draftLaunchProfile} onChange={(event) => setDraftLaunchProfile(event.target.value as PerformanceProfileId)}>
              {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <label>
            <span>Restore profile</span>
            <select value={draftRestoreProfile} onChange={(event) => setDraftRestoreProfile(event.target.value as PerformanceProfileId)}>
              {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <button className="primary-button" type="button" onClick={() => addMapping()}>
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>

        {processes.length > 0 && (
          <div className="process-picker">
            {processes.map((process) => (
              <button key={`${process.pid}-${process.name}`} type="button" onClick={() => addMapping(process.name, process.name.replace(/\.exe$/i, ''), '')}>
                <strong>{process.name}</strong>
                <span>{process.cpuPct.toFixed(1)}% CPU / {process.memMb.toFixed(0)} MB</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="settings-panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Local rules</span>
            <h2>Mapped games and launchers</h2>
          </div>
          <span className="diagnostics-badge muted">Automation off</span>
        </div>
        <div className="game-mode-note">
          Local only. Stored mappings stay inactive until automation ships.
        </div>
        <div className="game-map-list">
          {settings.gameMode.mappings.length === 0 ? (
            <div className="empty-state">
              <Gamepad2 size={22} />
              <strong>No game mappings yet</strong>
              <span>Add a process name manually or detect running apps.</span>
            </div>
          ) : settings.gameMode.mappings.map((mapping) => (
            <div className="game-map-row" key={mapping.id}>
              <label>
                <span>Name</span>
                <input value={mapping.label} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, label: event.target.value }))} />
              </label>
              <label>
                <span>Process</span>
                <input value={mapping.processName} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, processName: event.target.value }))} />
              </label>
              <label>
                <span>Launch</span>
                <select value={mapping.launchProfile} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, launchProfile: event.target.value as PerformanceProfileId }))}>
                  {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <label>
                <span>Restore</span>
                <select value={mapping.restoreProfile} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, restoreProfile: event.target.value as PerformanceProfileId }))}>
                  {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <button className="icon-danger-button" type="button" onClick={() => removeMapping(mapping.id)} title="Remove mapping">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function profileForMode(mode: PerformanceMode): PerformanceProfileId {
  if (mode === 'performance') return 'gaming';
  if (mode === 'quiet') return 'quiet';
  return 'balanced';
}

function formatUpdateStatus(status: AppMetadata['updateStatus']): string {
  if (status === 'up_to_date') return 'Up to date';
  if (status === 'available') return 'Available';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'checking') return 'Checking';
  return 'Manual check';
}

const profileOptions: Array<{ id: PerformanceProfileId; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'creator', label: 'Creator' },
  { id: 'quiet', label: 'Quiet' },
];

const systemProcessNames = new Set([
  'system',
  'svchost.exe',
  'csrss.exe',
  'lsass.exe',
  'dwm.exe',
  'ctfmon.exe',
  'runtimebroker.exe',
  'searchhost.exe',
]);

function SensorSource({ label, value, live, hint }: { label: string; value: string; live: boolean; hint?: string }) {
  return (
    <div className={live ? 'sensor-source live' : 'sensor-source pending'}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{live ? 'Live' : 'Pending'}</small>
      {hint && <p className="sensor-hint">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{value}{suffix}</strong>
    </label>
  );
}
