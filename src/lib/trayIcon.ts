import type { HardwareSample, TrayMetric } from '../types/system';

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

function arcColor(value: number | null, isTemp: boolean): string {
  if (value === null) return '#9aa3af';
  if (isTemp) {
    if (value >= 88) return '#ff5f5f';
    if (value >= 70) return '#ffd166';
    return '#72f59a';
  }
  if (value >= 85) return '#ff5f5f';
  if (value >= 65) return '#ffd166';
  return '#62d8ff';
}

function accentGlow(value: number | null, isTemp: boolean): string {
  if (value === null) return 'rgba(154, 163, 175, 0.45)';
  if (isTemp) {
    if (value >= 88) return 'rgba(255, 95, 95, 0.58)';
    if (value >= 70) return 'rgba(255, 209, 102, 0.48)';
    return 'rgba(114, 245, 154, 0.44)';
  }
  if (value >= 85) return 'rgba(255, 95, 95, 0.58)';
  if (value >= 65) return 'rgba(255, 209, 102, 0.48)';
  return 'rgba(98, 216, 255, 0.5)';
}

function roundRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draws a 32x32 tray icon onto an OffscreenCanvas showing the selected live
 * metric. The renderer favours legibility at Windows tray sizes over detail.
 */
export function renderTrayIconRgba(value: number | null, isTemp: boolean): Uint8ClampedArray | null {
  try {
    const SIZE = 32;
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const arcR = 12.7;
    const color = arcColor(value, isTemp);
    const glow = accentGlow(value, isTemp);
    const startAngle = (225 * Math.PI) / 180;
    const totalSweep = (270 * Math.PI) / 180;

    ctx.clearRect(0, 0, SIZE, SIZE);

    const bg = ctx.createRadialGradient(cx - 3, cy - 5, 2, cx, cy, 17);
    bg.addColorStop(0, '#223147');
    bg.addColorStop(0.58, '#0d1420');
    bg.addColorStop(1, '#05070b');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, 15.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 122, 0, 0.5)';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 13.9, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3.7;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, startAngle, startAngle + totalSweep);
    ctx.stroke();

    const pct = value !== null ? Math.min(Math.max(value, 0), 100) / 100 : 0;
    if (pct > 0.01) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4.2;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, startAngle, startAngle + pct * totalSweep);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR - 0.45, startAngle, startAngle + pct * totalSweep);
      ctx.stroke();
      ctx.restore();
    }

    const display = value !== null ? Math.round(value).toString() : '--';
    const fontSize = display.length >= 3 ? 9.5 : 12.2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "Segoe UI Variable Display", "Segoe UI", sans-serif`;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.strokeText(display, cx, cy - 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
    ctx.shadowBlur = 2.5;
    ctx.fillText(display, cx, cy - 0.6);
    ctx.shadowBlur = 0;

    const unit = isTemp ? 'C' : '%';
    roundRect(ctx, 11.6, 22.3, 8.8, 5.9, 2.2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 5.2px "Segoe UI Variable Display", "Segoe UI", sans-serif';
    ctx.fillText(unit, cx, 25.4);

    ctx.strokeStyle = '#ff7a00';
    ctx.lineWidth = 1.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8.9, 8.3);
    ctx.lineTo(11.4, 8.3);
    ctx.lineTo(13.4, 10.2);
    ctx.lineTo(10.9, 10.2);
    ctx.lineTo(9.1, 12);
    ctx.stroke();

    if (value !== null && ((isTemp && value >= 88) || (!isTemp && value >= 90))) {
      ctx.fillStyle = '#ff5f5f';
      ctx.shadowColor = 'rgba(255, 95, 95, 0.75)';
      ctx.shadowBlur = 4.5;
      ctx.beginPath();
      ctx.arc(24.6, 24.2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    return ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch {
    return null;
  }
}
