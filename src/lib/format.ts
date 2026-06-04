export function pct(value: number) {
  return `${Math.round(value)}%`;
}

export function temp(value: number | null, unit: 'c' | 'f' = 'c') {
  if (value == null) return 'No temp';
  const display = unit === 'f' ? value * 1.8 + 32 : value;
  return `${Math.round(display)} ${unit.toUpperCase()}`;
}

export function gb(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} GB`;
}

export function mhz(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(2)} GHz` : `${Math.round(value)} MHz`;
}

export function mbps(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)} Mbps`;
}

export function driveTypeLabel(type: string): string {
  switch (type) {
    case 'nvme': return 'NVMe';
    case 'ssd': return 'SSD';
    case 'hdd': return 'HDD';
    default: return 'Drive';
  }
}

export function adapterTypeLabel(type: string): string {
  switch (type) {
    case 'wifi': return 'Wi-Fi';
    case 'ethernet': return 'Ethernet';
    default: return 'Network';
  }
}
