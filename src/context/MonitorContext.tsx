import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { getHardwareSample, getSystemInfo, setTrayStatus, setTrayIconData } from '../services/systemService';
import { isNative } from '../services/native';
import type { HardwareSample, MetricPoint, SystemInfo } from '../types/system';
import { temp, pct } from '../lib/format';
import { useSettings } from '../hooks/useSettings';
import { renderTrayIconRgba, extractTrayValue } from '../lib/trayIcon';

type MonitorContextValue = {
  systemInfo: SystemInfo | null;
  sample: HardwareSample | null;
  loading: boolean;
  error: string | null;
  /** True when running inside the Tauri desktop app. False in browser preview mode. */
  native: boolean;
};

export const MonitorContext = createContext<MonitorContextValue | null>(null);

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [sample, setSample] = useState<HardwareSample | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<MetricPoint[]>([]);
  const visibleRef = useRef(document.visibilityState === 'visible');
  const trayIconRef = useRef<{ lastUpdate: number }>({ lastUpdate: 0 });
  const consecutiveErrorsRef = useRef(0);

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

    if (!settings.monitoring.launchOnStartup) {
      setLoading(false);
      setError(null);
      return () => undefined;
    }

    async function tick() {
      try {
        const next = await getHardwareSample(historyRef.current);
        next.history = next.history.slice(-settings.monitoring.historyLimit);
        historyRef.current = next.history;
        if (!disposed) {
          setSample(next);
          setLoading(false);
          setError(null);
          consecutiveErrorsRef.current = 0;
          if (settings.tray.showLiveTooltip) {
            const trayMetric = settings.tray.liveIconMetric;
            const provider = next.gpu.provider ? next.gpu.provider.toUpperCase() : 'UNKNOWN';
            const trayLabel = trayMetric === 'disabled'
              ? 'Static'
              : trayMetric === 'cpuTemp'
              ? `CPU ${temp(next.cpu.temperature, settings.monitoring.temperatureUnit)}`
              : trayMetric === 'gpuTemp'
              ? `GPU ${temp(next.gpu.temperature, settings.monitoring.temperatureUnit)}`
              : trayMetric === 'cpuUsage'
              ? `CPU ${pct(next.cpu.usage)}`
              : trayMetric === 'gpuUsage'
              ? `GPU ${pct(next.gpu.usage)}`
              : `RAM ${pct(next.memory.usage)}`;

            void setTrayStatus({
              tooltip: `Radium PCs Companion\nCPU ${temp(next.cpu.temperature, settings.monitoring.temperatureUnit)} · ${pct(next.cpu.usage)}\nGPU ${temp(next.gpu.temperature, settings.monitoring.temperatureUnit)} · ${pct(next.gpu.usage)}\nRAM ${pct(next.memory.usage)} · NET ${next.network.downMbps.toFixed(0)} Mbps\nProvider ${provider} · Telemetry ${next.state}\nTray ${trayLabel}\nDouble-click: Open · Menu: OSD, RAM clean, modes`,
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
          consecutiveErrorsRef.current += 1;
          setLoading(false);
          setError(String(err));
        }
      } finally {
        const base = visibleRef.current || settings.overlay.enabled
          ? settings.monitoring.refreshMs
          : settings.monitoring.backgroundRefreshMs;
        // Exponential backoff on consecutive errors, capped at 30 s.
        const backoff = consecutiveErrorsRef.current > 0
          ? Math.min(base * Math.pow(2, consecutiveErrorsRef.current - 1), 30_000)
          : base;
        if (!disposed) timeoutId = window.setTimeout(tick, backoff);
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
    settings.monitoring.launchOnStartup,
    settings.monitoring.temperatureUnit,
    settings.tray.showLiveTooltip,
    settings.tray.liveIconMetric,
    settings.overlay.enabled,
    settings.experience.performanceMode,
  ]);

  const value = useMemo(() => ({ systemInfo, sample, loading, error, native: isNative() }), [systemInfo, sample, loading, error]);

  return <MonitorContext.Provider value={value}>{children}</MonitorContext.Provider>;
}


