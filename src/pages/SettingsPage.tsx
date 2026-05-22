import { Bell, Gauge, MonitorDot, Palette, Power, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useSettings } from '../hooks/useSettings';
import { setStartupEnabled } from '../services/systemService';
import type { OverlayPreset, TrayMetric } from '../types/system';

const overlayPresets: Array<{ id: OverlayPreset; label: string }> = [
  { id: 'compact-bar', label: 'Compact bar' },
  { id: 'corner-widget', label: 'Corner widget' },
  { id: 'vertical-list', label: 'Vertical list' },
  { id: 'minimal-card', label: 'Minimal card' },
];

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Personalisation"
        title="Settings"
        description="Control tray behaviour, overlay presentation, monitoring cadence, and desktop integration from one quiet control surface."
        action={
          <button className="primary-button" onClick={resetSettings}>
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>
        }
      />

      <div className="settings-grid">
        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Desktop</span>
              <h2>Tray behaviour</h2>
            </div>
            <Bell size={19} />
          </div>
          <Toggle
            label="Minimise to tray"
            checked={settings.tray.minimizeToTray}
            onChange={(checked) => updateSettings((current) => ({ ...current, tray: { ...current.tray, minimizeToTray: checked } }))}
          />
          <Toggle
            label="Start with Windows"
            checked={settings.tray.startWithWindows}
            onChange={(checked) => {
              updateSettings((current) => ({ ...current, tray: { ...current.tray, startWithWindows: checked } }));
              void setStartupEnabled(checked);
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
              value={settings.tray.liveIconMetric}
              onChange={(e) => updateSettings((current) => ({ ...current, tray: { ...current.tray, liveIconMetric: e.target.value as TrayMetric } }))}
            >
              <option value="disabled">App icon (static)</option>
              <option value="cpuTemp">CPU Temperature</option>
              <option value="gpuTemp">GPU Temperature</option>
              <option value="cpuUsage">CPU Usage %</option>
              <option value="gpuUsage">GPU Usage %</option>
              <option value="ramUsage">RAM Usage %</option>
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
                  experience: { ...current.experience, performanceMode: event.target.value as typeof settings.experience.performanceMode },
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
              <span className="eyebrow">Native integration</span>
              <h2>Production groundwork</h2>
            </div>
            <Power size={19} />
          </div>
          <div className="integration-row">
            <SlidersHorizontal size={18} />
            <span>Tray menu, OSD window creation, restore-safe cleanup, startup registration, and notifications are exposed as native command boundaries.</span>
          </div>
        </Panel>
      </div>
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
