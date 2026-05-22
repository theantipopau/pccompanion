import { useContext } from 'react';
import { MonitorContext } from '../context/MonitorContext';

export function useMonitor() {
  const context = useContext(MonitorContext);
  if (!context) throw new Error('useMonitor must be used inside MonitorProvider');
  return context;
}
