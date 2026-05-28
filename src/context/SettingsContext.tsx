import { createContext, useEffect, useMemo, useState } from 'react';
import type { CompanionSettings } from '../types/system';

import { brand } from '../lib/branding';

const SETTINGS_KEY = `${brand.mode}-companion-settings`;
const SETTINGS_STORAGE_VERSION = 2;

export const SettingsContext = createContext<SettingsContextValue | null>(null);

const defaultSettings: CompanionSettings = {
  theme: brand.mode === 'demo' ? 'graphite' : 'radium-dark',
  tray: {
    minimizeToTray: true,
    minimizeOnMinimize: true,
    startWithWindows: false,
    startMinimized: true,
    silentBackground: true,
    showLiveTooltip: true,
    liveIconMetric: 'cpuTemp' as const,
  },
  overlay: {
    enabled: false,
    launchOnStartup: false,
    clickThrough: true,
    preset: 'corner-widget',
    opacity: 0.86,
    scale: 1,
    position: { x: 24, y: 24 },
    metrics: ['cpuTemp', 'cpuUsage', 'gpuTemp', 'gpuUsage', 'ramUsage', 'vramUsage', 'fps'],
  },
  monitoring: {
    launchOnStartup: true,
    refreshMs: 1400,
    backgroundRefreshMs: 2600,
    historyLimit: 60,
    temperatureUnit: 'c',
  },
  experience: {
    compactMode: false,
    animations: true,
    performanceProfile: 'balanced',
    performanceMode: 'balanced',
  },
  gameMode: {
    automationEnabled: false,
    mappings: [],
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
      if (!stored) return defaultSettings;
      const parsed = JSON.parse(stored) as unknown;
      const migrated = migrateSettingsEnvelope(parsed);
      return mergeSettings(defaultSettings, migrated);
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      const payload: StoredSettingsEnvelope = {
        version: SETTINGS_STORAGE_VERSION,
        data: settings,
      };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    } catch {
      // Keep running with in-memory settings if local storage is blocked or full.
    }
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
    gameMode: { ...base.gameMode, ...partial.gameMode, mappings: partial.gameMode?.mappings ?? base.gameMode.mappings },
  };
}

type StoredSettingsEnvelope = {
  version: number;
  data: Partial<CompanionSettings>;
};

function isSettingsEnvelope(value: unknown): value is StoredSettingsEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { version?: unknown; data?: unknown };
  return typeof candidate.version === 'number' && !!candidate.data && typeof candidate.data === 'object';
}

function migrateSettingsEnvelope(raw: unknown): Partial<CompanionSettings> {
  if (isSettingsEnvelope(raw)) {
    if (raw.version >= SETTINGS_STORAGE_VERSION) {
      return raw.data;
    }

    // Future migrations can branch here by version and normalize shape safely.
    return raw.data;
  }

  // v1 legacy payload was the settings object directly.
  return (raw ?? {}) as Partial<CompanionSettings>;
}
