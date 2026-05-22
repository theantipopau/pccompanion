import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getHardwareSample, getSystemInfo, setTrayStatus, setTrayIconData } from '../services/systemService';
import { isNative } from '../services/native';
import type { HardwareSample, MetricPoint, SystemInfo } from '../types/system';
import { temp, pct } from '../lib/format';
import { useSettings } from './SettingsContext';
import { renderTrayIconRgba, extractTrayValue } from '../lib/trayIcon';

type MonitorContextValue = {
  systemInfo: SystemInfo | null;
  sample: HardwareSample | null;
  loading: boolean;
  error: string | null;
  /** True when running inside the Tauri desktop app. False in browser preview mode. */
  native: boolean;
};

const MonitorContext = createContext<MonitorContextValue | null>(null);

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [sample, setSample] = useState<HardwareSample | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<MetricPoint[]>([]);
  const visibleRef = useRef(document.visibilityState === 'visible');
  const trayIconRef = useRef<{ lastUpdate: number }>({ lastUpdate: 0 });

  useEffect(() => {
    getSystemInfo().then(setSystemInfo).catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    let disposed = false;
    let timeoutId = 0;

    async function tick() {
      try {
        const next = await getHardwareSample(historyRef.current);
        next.history = next.history.slice(-settings.monitoring.historyLimit);
        historyRef.current = next.history;
        if (!disposed) {
          setSample(next);
          setLoading(false);
          setError(null);
          if (settings.tray.showLiveTooltip) {
            void setTrayStatus({
              tooltip: `Radium PCs Companion\nCPU ${temp(next.cpu.temperature, settings.monitoring.temperatureUnit)} / ${pct(next.cpu.usage)}\nGPU ${temp(next.gpu.temperature, settings.monitoring.temperatureUnit)} / ${pct(next.gpu.usage)}\nRAM ${pct(next.memory.usage)}`,
              mode: settings.experience.performanceMode,
              overlayEnabled: settings.overlay.enabled,
            });
          }
          if (isNative() && settings.tray.liveIconMetric !== 'disabled') {
            const now = Date.now();
            if (now - trayIconRef.current.lastUpdate > 2000) {
              trayIconRef.current.lastUpdate = now;
              const { value, isTemp } = extractTrayValue(next, settings.tray.liveIconMetric);
              const rgba = renderTrayIconRgba(value, isTemp);
              if (rgba) void setTrayIconData(Array.from(rgba), 32, 32);
            }
          }
        }
      } catch (err) {
        if (!disposed) {
          setLoading(false);
          setError(String(err));
        }
      } finally {
        const delay = visibleRef.current || settings.overlay.enabled ? settings.monitoring.refreshMs : settings.monitoring.backgroundRefreshMs;
        if (!disposed) timeoutId = window.setTimeout(tick, delay);
      }
    }

    tick();
    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    settings.monitoring.refreshMs,
    settings.monitoring.backgroundRefreshMs,
    settings.monitoring.historyLimit,
    settings.monitoring.temperatureUnit,
    settings.tray.showLiveTooltip,
    settings.tray.liveIconMetric,
    settings.overlay.enabled,
    settings.experience.performanceMode,
  ]);

  const value = useMemo(() => ({ systemInfo, sample, loading, error, native: isNative() }), [systemInfo, sample, loading, error]);

  return <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>;
}

export function useMonitor() {
  const context = useContext(MonitorContext);
  if (!context) throw new Error('useMonitor must be used inside MonitorProvider');
  return context;
}
