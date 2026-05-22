import type { HardwareSample, TrayMetric } from '../types/system';

// ─── Value extraction ────────────────────────────────────────────────────────

export function extractTrayValue(
  sample: HardwareSample,
  metric: TrayMetric,
): { value: number | null; isTemp: boolean } {
  switch (metric) {
    case 'cpuTemp':  return { value: sample.cpu.temperature,  isTemp: true  };
    case 'gpuTemp':  return { value: sample.gpu.temperature,  isTemp: true  };
    case 'cpuUsage': return { value: sample.cpu.usage,        isTemp: false };
    case 'gpuUsage': return { value: sample.gpu.usage,        isTemp: false };
    case 'ramUsage': return { value: sample.memory.usage,     isTemp: false };
    default:         return { value: null,                    isTemp: false };
  }
}

// ─── Color thresholds ───────────────────────────────────────────────────────

function arcColor(value: number | null, isTemp: boolean): string {
  if (value === null) return '#788293';
  if (isTemp) {
    if (value >= 85) return '#ff6d6d';
    if (value >= 70) return '#f5c86b';
    return '#84f08c';
  } else {
    if (value >= 85) return '#ff6d6d';
    if (value >= 65) return '#f5c86b';
    return '#55d6ff';
  }
}

// ─── Canvas renderer ────────────────────────────────────────────────────────

/**
 * Draws a 32×32 tray icon onto an OffscreenCanvas showing the given metric.
 * Returns the raw RGBA bytes, or null if OffscreenCanvas is unavailable.
 *
 * Design: dark circular background, colored arc ring (270° sweep),
 * bold white number, small colored unit label, glow shadow on the arc.
 */
export function renderTrayIconRgba(value: number | null, isTemp: boolean): Uint8ClampedArray | null {
  try {
    const SIZE = 32;
    // OffscreenCanvas is available in Tauri's Chromium-based WebView (WebView2).
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return null;

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const arcR = 12.5;
    const color = arcColor(value, isTemp);
    // Arc spans from 225° (7:30 position) sweeping 270° clockwise to 135° (4:30).
    const startAngle = (225 * Math.PI) / 180;
    const totalSweep = (270 * Math.PI) / 180;

    // ── Background circle ──────────────────────────────────────────
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#0e1420';
    ctx.beginPath();
    ctx.arc(cx, cy, 15.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Track arc (dim) ────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, startAngle, startAngle + totalSweep);
    ctx.stroke();

    // ── Value arc (colored + glow) ─────────────────────────────────
    const pct = value !== null ? Math.min(Math.max(value, 0), 100) / 100 : 0;
    if (pct > 0.01) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, startAngle, startAngle + pct * totalSweep);
      ctx.stroke();
      ctx.restore();
    }

    // ── Number text ────────────────────────────────────────────────
    const display = value !== null ? Math.round(value).toString() : '--';
    const fontSize = display.length >= 3 ? 9 : 11;
    ctx.fillStyle = '#f4f7fa';
    ctx.font = `700 ${fontSize}px Inter, ui-sans-serif, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(display, cx, cy + 3.5);

    // ── Unit label ─────────────────────────────────────────────────
    ctx.fillStyle = color;
    ctx.font = `600 6px Inter, ui-sans-serif, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(isTemp ? '\u00b0C' : '%', cx, cy + 11);

    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null;
  }
}
