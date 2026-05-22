import { useEffect, useState } from 'react';
import { getHardwareSample, getSystemInfo } from '../services/systemService';
import type { HardwareSample, SystemInfo } from '../types/system';
import { useMonitor } from '../context/MonitorContext';

type MonitorState = {
  systemInfo: SystemInfo | null;
  sample: HardwareSample | null;
  loading: boolean;
  error: string | null;
};

export function useHardwareMonitor(pollMs = 1400): MonitorState {
  const [state, setState] = useState<MonitorState>({
    systemInfo: null,
    sample: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let disposed = false;

    async function hydrate() {
      try {
        const systemInfo = await getSystemInfo();
        if (!disposed) {
          setState((current) => ({ ...current, systemInfo }));
        }
      } catch (error) {
        if (!disposed) setState((current) => ({ ...current, error: String(error) }));
      }
    }

    hydrate();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let history = state.sample?.history ?? [];

    async function tick() {
      try {
        const sample = await getHardwareSample(history);
        history = sample.history;
        if (!disposed) {
          setState((current) => ({ ...current, sample, loading: false, error: null }));
        }
      } catch (error) {
        if (!disposed) {
          setState((current) => ({ ...current, loading: false, error: String(error) }));
        }
      }
    }

    tick();
    const interval = window.setInterval(tick, pollMs);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [pollMs]);

  return state;
}

export function useSharedHardwareMonitor(): MonitorState {
  return useMonitor();
}
