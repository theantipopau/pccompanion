import type { CompanionActionRecord } from './actionHistory';
import { brand } from './branding';
import { gb, mbps, mhz, pct, temp } from './format';
import { computePerformanceScore } from './performanceScore';
import type { CompanionSettings, HardwareSample, SystemInfo, TelemetryDiagnosticsSnapshot } from '../types/system';

type SupportReportInput = {
  settings: CompanionSettings;
  systemInfo: SystemInfo | null;
  sample: HardwareSample | null;
  presentationLabel: string;
  presentationState: string;
  recentActions: CompanionActionRecord[];
  diagnostics?: TelemetryDiagnosticsSnapshot | null;
  appVersion?: string;
};

type SupportReportResult = {
  filename: string;
  createdAt: string;
  sectionCount: number;
};

export function exportLocalSupportReport(input: SupportReportInput): SupportReportResult {
  const createdAt = new Date();
  const createdAtText = createdAt.toLocaleString();
  const filename = buildReportFilename(input.settings.buildIdentity.serial, createdAt);
  const html = buildSupportReportHtml(input, createdAtText);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { filename, createdAt: createdAtText, sectionCount: 8 };
}

function buildSupportReportHtml(input: SupportReportInput, createdAt: string): string {
  const score = computePerformanceScore(input.sample);
  const build = input.settings.buildIdentity;
  const unit = input.settings.monitoring.temperatureUnit;
  const storageRows = input.sample?.storage.length
    ? input.sample.storage.map((drive) => tableRow([drive.label, drive.driveType.toUpperCase(), pct(drive.usedPercent), temp(drive.temperature, unit)])).join('')
    : tableRow(['Storage pending', 'unknown', 'unknown', 'No temp']);
  const actionRows = input.recentActions.length
    ? input.recentActions.slice(0, 12).map((action) => tableRow([action.timestamp, action.category, action.label, action.detail])).join('')
    : tableRow(['No actions recorded', 'support', 'None', 'Local action history is empty']);
  const capabilityRows = input.diagnostics?.capabilities.length
    ? input.diagnostics.capabilities.map((capability) => tableRow([capability.label, capability.state, capability.writeSafe ? 'write-capable' : 'read-only', capability.detail])).join('')
    : tableRow(['Capability snapshot unavailable', 'unknown', 'read-only', 'Export diagnostics for provider-level evidence']);
  const sensorRows = input.diagnostics?.sensors.length
    ? input.diagnostics.sensors.map((sensor) => tableRow([sensor.sensor, sensor.provider, sensor.state, sensor.notes])).join('')
    : tableRow(['Sensor snapshot unavailable', 'unknown', 'unknown', 'Export diagnostics for sensor provenance']);
  const css = [
    ':root { color-scheme: dark; --bg: #0b0f14; --panel: #111821; --line: #263241; --text: #f4f7fb; --muted: #9fb0c1; --accent: #ff7a00; --warn: #f5c86b; }',
    'body { margin: 0; padding: 28px; background: var(--bg); color: var(--text); font-family: Segoe UI, Arial, sans-serif; }',
    'header { border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 18px; }',
    'h1, h2 { margin: 0; letter-spacing: 0; } h1 { font-size: 28px; } h2 { font-size: 17px; margin-bottom: 10px; }',
    'p { color: var(--muted); line-height: 1.45; } .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }',
    '.chip { border: 1px solid var(--line); border-radius: 999px; padding: 6px 10px; color: var(--muted); font-size: 12px; font-weight: 700; }',
    '.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }',
    'section { break-inside: avoid; margin: 0 0 12px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }',
    'dl { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 8px 12px; margin: 0; }',
    'dt { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; } dd { margin: 0; overflow-wrap: anywhere; }',
    'table { width: 100%; border-collapse: collapse; font-size: 12px; } th, td { padding: 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; overflow-wrap: anywhere; }',
    'th { color: var(--muted); text-transform: uppercase; font-size: 11px; } .score { font-size: 40px; color: var(--accent); font-weight: 900; }',
    '.notice { border-color: rgba(245, 200, 107, 0.35); color: var(--warn); } @media print { body { background: #fff; color: #111; } section { background: #fff; } .chip, p, dt, th { color: #444; } }',
  ].join('\n');

  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>' + escapeHtml(brand.productName) + ' Support Report</title><style>' + css + '</style></head><body>',
    '<header><h1>' + escapeHtml(brand.productName) + ' Support Report</h1>',
    '<p>Generated locally for Radium PCs support handoff. No automatic upload or cloud sync is performed by this report.</p>',
    '<div class="meta"><span class="chip">Created ' + escapeHtml(createdAt) + '</span><span class="chip">' + escapeHtml(input.presentationLabel) + ' (' + escapeHtml(input.presentationState) + ')</span><span class="chip">Interface ' + escapeHtml(input.settings.experience.interfaceMode) + '</span><span class="chip">Profile ' + escapeHtml(input.settings.experience.performanceProfile) + '</span></div></header>',
    '<div class="grid">',
    '<section><h2>Radium Build Identity</h2><dl>' + definitionRows([
      ['Serial', build.serial || 'not provisioned'],
      ['Build date', build.buildDate || 'not provisioned'],
      ['Customer profile', build.customerBuildProfile || 'not provisioned'],
      ['QC seal', build.qcSeal || 'not provisioned'],
      ['Warranty tier', build.warrantyTier || 'not provisioned'],
      ['Support tier', build.supportTier || 'not provisioned'],
    ]) + '</dl></section>',
    '<section><h2>Detected Hardware</h2><dl>' + definitionRows([
      ['CPU', input.systemInfo?.cpu ?? 'pending'],
      ['GPU', input.sample?.gpu.name || input.systemInfo?.gpu || 'pending'],
      ['Motherboard', build.motherboard || input.systemInfo?.motherboard || 'pending'],
      ['RAM', build.ramConfig || (input.systemInfo ? input.systemInfo.ram + ' at ' + input.systemInfo.ramSpeed : 'pending')],
      ['Storage', build.storageConfig || input.systemInfo?.storage.join(' / ') || 'pending'],
      ['Windows', input.systemInfo?.windows ?? 'pending'],
    ]) + '</dl></section>',
    '<section><h2>Performance Score</h2><div class="score">' + score.value + ' ' + escapeHtml(score.grade) + '</div><p>' + escapeHtml(score.summary) + '</p><dl>' + definitionRows(score.pillars.map((pillar) => [pillar.label, pillar.score + '/100 - ' + pillar.detail])) + '</dl></section>',
    '<section><h2>Live Telemetry</h2><dl>' + definitionRows([
      ['CPU', input.sample ? pct(input.sample.cpu.usage) + ' / ' + temp(input.sample.cpu.temperature, unit) + ' / ' + mhz(input.sample.cpu.clockMhz) : 'pending'],
      ['GPU', input.sample ? pct(input.sample.gpu.usage) + ' / ' + temp(input.sample.gpu.temperature, unit) + ' / ' + mhz(input.sample.gpu.coreClockMhz) + ' / ' + input.sample.gpu.provider : 'pending'],
      ['Memory', input.sample ? gb(input.sample.memory.usedGb) + ' / ' + gb(input.sample.memory.totalGb) + ' (' + pct(input.sample.memory.usage) + ')' : 'pending'],
      ['Network', input.sample ? mbps(input.sample.network.downMbps) + ' down / ' + mbps(input.sample.network.upMbps) + ' up on ' + input.sample.network.adapterName : 'pending'],
      ['Sample state', input.sample?.state ?? 'pending'],
    ]) + '</dl></section></div>',
    '<section><h2>Storage</h2><table><thead><tr><th>Drive</th><th>Type</th><th>Used</th><th>Temperature</th></tr></thead><tbody>' + storageRows + '</tbody></table></section>',
    '<section><h2>Capabilities</h2><table><thead><tr><th>Capability</th><th>State</th><th>Write status</th><th>Detail</th></tr></thead><tbody>' + capabilityRows + '</tbody></table></section>',
    '<section><h2>Sensor Evidence</h2><table><thead><tr><th>Sensor</th><th>Provider</th><th>State</th><th>Notes</th></tr></thead><tbody>' + sensorRows + '</tbody></table></section>',
    '<section><h2>Recent Local Actions</h2><table><thead><tr><th>Time</th><th>Category</th><th>Action</th><th>Detail</th></tr></thead><tbody>' + actionRows + '</tbody></table></section>',
    '<section class="notice"><h2>Privacy And Handling</h2><p>This report is generated locally in the browser/WebView session. The owner or technician chooses whether to share it with Radium PCs support.</p></section>',
    '</body></html>',
  ].join('\n');
}

function buildReportFilename(serial: string, createdAt: Date): string {
  const stamp = createdAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const id = (serial.trim() || 'unprovisioned').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return 'radium-support-report-' + id + '-' + stamp + '.html';
}

function definitionRows(rows: Array<[string, string]>): string {
  return rows.map(([label, value]) => '<dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd>').join('');
}

function tableRow(cells: string[]): string {
  return '<tr>' + cells.map((cell) => '<td>' + escapeHtml(cell) + '</td>').join('') + '</tr>';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
