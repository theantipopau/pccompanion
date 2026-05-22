import { createContext, useEffect, useMemo, useState } from 'react';
import type { CompanionSettings } from '../types/system';

const SETTINGS_KEY = 'radium-companion-settings';

export const SettingsContext = createContext<SettingsContextValue | null>(null);

const defaultSettings: CompanionSettings = {
  theme: 'radium-dark',
  tray: {
    minimizeToTray: true,
    startWithWindows: false,
    silentBackground: true,
    showLiveTooltip: true,
    liveIconMetric: 'cpuTemp' as const,
  },
  overlay: {
    enabled: false,
    clickThrough: true,
    preset: 'corner-widget',
    opacity: 0.86,
    scale: 1,
    position: { x: 24, y: 24 },
    metrics: ['cpuTemp', 'cpuUsage', 'gpuTemp', 'gpuUsage', 'ramUsage', 'vramUsage', 'fps'],
  },
  monitoring: {
    refreshMs: 1400,
    backgroundRefreshMs: 2600,
    historyLimit: 60,
    temperatureUnit: 'c',
  },
  experience: {
    compactMode: false,
    animations: true,
    performanceMode: 'balanced',
  },
};

type SettingsContextValue = {
  settings: CompanionSettings;
  updateSettings: (updater: (settings: CompanionSettings) => CompanionSettings) => void;
  resetSettings: () => void;
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanionSettings>(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY);
      return stored ? mergeSettings(defaultSettings, JSON.parse(stored) as Partial<CompanionSettings>) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.compact = String(settings.experience.compactMode);
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings: (updater) => setSettings((current) => updater(current)),
      resetSettings: () => setSettings(defaultSettings),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function mergeSettings(base: CompanionSettings, partial: Partial<CompanionSettings>): CompanionSettings {
  return {
    ...base,
    ...partial,
    tray: { ...base.tray, ...partial.tray },
    overlay: { ...base.overlay, ...partial.overlay, position: { ...base.overlay.position, ...partial.overlay?.position } },
    monitoring: { ...base.monitoring, ...partial.monitoring },
    experience: { ...base.experience, ...partial.experience },
  };
}
