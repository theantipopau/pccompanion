import type { HardwareSample, TrayMetric } from '../types/system';

// ─── Value extraction ────────────────────────────────────────────────────────

export function extractTrayValue(
  sample: HardwareSample,
  metric: TrayMetric,
): { value: number | null; isTemp: boolean } {
  switch (metric) {
    case 'cpuTemp':
      return { value: sample.cpu.temperature ?? sample.gpu.temperature ?? null, isTemp: true };
    case 'gpuTemp':
      return { value: sample.gpu.temperature ?? sample.cpu.temperature ?? null, isTemp: true };
    case 'ramUsage':
      return { value: sample.memory.usage, isTemp: false };
    case 'cpuUsage':
      return { value: sample.cpu.usage, isTemp: false };
    case 'gpuUsage':
      return { value: sample.gpu.usage, isTemp: false };
    default:
      return { value: null, isTemp: false };
  }
}

// ─── Color thresholds ───────────────────────────────────────────────────────

function arcColor(value: number | null, isTemp: boolean): string {
  if (value === null) return '#788293';
  if (isTemp) {
    if (value >= 88) return '#ff6d6d';
    if (value >= 70) return '#f5c86b';
    return '#84f08c';
  } else {
    if (value >= 85) return '#ff6d6d';
    if (value >= 65) return '#f5c86b';
    return '#55d6ff';
  }
}

function accentGlow(value: number | null, isTemp: boolean): string {
  if (value === null) return 'rgba(120, 130, 147, 0.35)';
  if (isTemp) {
    if (value >= 88) return 'rgba(255, 109, 109, 0.42)';
    if (value >= 70) return 'rgba(245, 200, 107, 0.38)';
    return 'rgba(132, 240, 140, 0.36)';
  }
  if (value >= 85) return 'rgba(255, 109, 109, 0.42)';
  if (value >= 65) return 'rgba(245, 200, 107, 0.38)';
  return 'rgba(85, 214, 255, 0.42)';
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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const arcR = 12.5;
    const color = arcColor(value, isTemp);
    const glow = accentGlow(value, isTemp);
    // Arc spans from 225° (7:30 position) sweeping 270° clockwise to 135° (4:30).
    const startAngle = (225 * Math.PI) / 180;
    const totalSweep = (270 * Math.PI) / 180;

    // ── Background circle (layered radial depth) ───────────────────
    ctx.clearRect(0, 0, SIZE, SIZE);
    const bg = ctx.createRadialGradient(cx - 2.5, cy - 3.5, 2, cx, cy, 16);
    bg.addColorStop(0, '#19263a');
    bg.addColorStop(1, '#090e16');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, 15.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Inner sheen for premium depth.
    const sheen = ctx.createLinearGradient(0, 2, 0, 15);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(cx, cy, 13.8, Math.PI, 0, false);
    ctx.lineTo(cx + 13.8, cy);
    ctx.lineTo(cx - 13.8, cy);
    ctx.closePath();
    ctx.fill();

    // ── Track arc (dim) ────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, startAngle, startAngle + totalSweep);
    ctx.stroke();

    // ── Value arc (colored + glow) ─────────────────────────────────
    const pct = value !== null ? Math.min(Math.max(value, 0), 100) / 100 : 0;
    if (pct > 0.01) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, startAngle, startAngle + pct * totalSweep);
      ctx.stroke();

      // Thin inner highlight gives the ring a sharper premium edge.
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR - 0.35, startAngle, startAngle + pct * totalSweep);
      ctx.stroke();
      ctx.restore();
    }

    // ── Number text ────────────────────────────────────────────────
    const display = value !== null ? Math.round(value).toString() : '--';
    const fontSize = display.length >= 3 ? 9 : 11;
    ctx.fillStyle = '#f4f7fa';
    ctx.font = `700 ${fontSize}px "Segoe UI Variable Display", "Cascadia Mono", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 1.5;
    ctx.fillText(display, cx, cy + 3.5);
    ctx.shadowBlur = 0;

    // ── Unit label ─────────────────────────────────────────────────
    ctx.fillStyle = color;
    ctx.font = `600 6px "Segoe UI Variable Display", "Cascadia Mono", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(isTemp ? '\u00b0C' : '%', cx, cy + 11);

    // ── Brand notch (Radium identity) ─────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 1.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(9.6, 8.8);
    ctx.lineTo(12.4, 8.8);
    ctx.lineTo(14.1, 10.5);
    ctx.lineTo(11.4, 10.5);
    ctx.lineTo(9.8, 12.1);
    ctx.stroke();

    // Hot-state pulse dot in the lower-right for instant glance alerts.
    if (value !== null && ((isTemp && value >= 88) || (!isTemp && value >= 90))) {
      ctx.fillStyle = '#ff6d6d';
      ctx.shadowColor = 'rgba(255,109,109,0.65)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(24.7, 24.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null;
  }
}
