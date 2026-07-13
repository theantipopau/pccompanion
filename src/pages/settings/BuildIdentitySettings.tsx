import { useRef, useState } from 'react';
import { ClipboardList, Download, FileInput, Trash2 } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { useSettings } from '../../hooks/useSettings';
import { recordCompanionAction } from '../../lib/actionHistory';
import type { RadiumBuildIdentity } from '../../types/system';

export const buildIdentityFields: Array<{ key: keyof RadiumBuildIdentity; label: string; placeholder: string; type?: string }> = [
  { key: 'serial', label: 'Serial', placeholder: 'RDM-2026-0001' },
  { key: 'buildDate', label: 'Build date', placeholder: '2026-06-25', type: 'date' },
  { key: 'customerBuildProfile', label: 'Build profile', placeholder: 'Radium Aurora X3 - creator/gaming' },
  { key: 'motherboard', label: 'Motherboard', placeholder: 'ASUS ROG Strix B650E-F' },
  { key: 'gpu', label: 'GPU', placeholder: 'NVIDIA GeForce RTX 4080 SUPER' },
  { key: 'ramConfig', label: 'RAM config', placeholder: '64 GB DDR5-6000 CL30' },
  { key: 'storageConfig', label: 'Storage config', placeholder: '2 TB NVMe Gen4 + 4 TB SSD' },
  { key: 'qcSeal', label: 'QC seal', placeholder: 'QC-MH-2026-0625' },
  { key: 'warrantyTier', label: 'Warranty tier', placeholder: '3 year Radium warranty' },
  { key: 'supportTier', label: 'Support tier', placeholder: 'Premium Care' },
];

const buildIdentityKeys = buildIdentityFields.map((field) => field.key);

export function parseBuildIdentitySeed(value: unknown): Partial<RadiumBuildIdentity> {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const candidate = root.buildIdentity && typeof root.buildIdentity === 'object'
    ? root.buildIdentity as Record<string, unknown>
    : root.radiumBuildIdentity && typeof root.radiumBuildIdentity === 'object'
      ? root.radiumBuildIdentity as Record<string, unknown>
      : root;
  const result: Partial<RadiumBuildIdentity> = {};
  for (const key of buildIdentityKeys) {
    const raw = candidate[key];
    if (typeof raw === 'string' || typeof raw === 'number') {
      result[key] = String(raw).trim();
    }
  }
  return result;
}

export function BuildIdentitySettings() {
  const { settings, updateSettings } = useSettings();
  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const [seedStatus, setSeedStatus] = useState('');
  const populatedCount = Object.values(settings.buildIdentity).filter((value) => value.trim()).length;

  function updateBuildIdentityField(key: keyof RadiumBuildIdentity, value: string) {
    updateSettings((current) => ({
      ...current,
      buildIdentity: { ...current.buildIdentity, [key]: value },
    }));
  }

  function exportBuildSeed() {
    const payload = {
      schema: 'radium-build-identity-v1',
      exportedAt: new Date().toISOString(),
      buildIdentity: settings.buildIdentity,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const serial = settings.buildIdentity.serial.trim() || 'template';
    link.href = url;
    link.download = 'radium-build-identity-' + serial.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSeedStatus('Build identity seed exported locally.');
    recordCompanionAction('settings', 'Exported build identity seed', populatedCount + '/10 fields provisioned');
  }

  async function importBuildSeed(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const imported = parseBuildIdentitySeed(parsed);
      const importedCount = Object.values(imported).filter((value) => value.trim()).length;
      if (importedCount === 0) {
        setSeedStatus('No recognised build identity fields found in seed file.');
        recordCompanionAction('settings', 'Build identity seed rejected', file.name);
        return;
      }
      updateSettings((current) => ({
        ...current,
        buildIdentity: { ...current.buildIdentity, ...imported },
      }));
      setSeedStatus(importedCount + '/10 build identity fields imported from ' + file.name + '.');
      recordCompanionAction('settings', 'Imported build identity seed', importedCount + '/10 fields from ' + file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSeedStatus('Seed import failed: ' + message);
      recordCompanionAction('settings', 'Build identity seed import failed', message);
    } finally {
      if (seedInputRef.current) seedInputRef.current.value = '';
    }
  }

  return (
    <Panel className="settings-panel build-identity-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Radium provisioning</span>
          <h2>Build identity record</h2>
        </div>
        <ClipboardList size={19} />
      </div>
      <p className="build-identity-note">Local-only metadata for support and System Passport. Empty fields are shown as not provisioned.</p>
      <div className="build-identity-actions">
        <input
          ref={seedInputRef}
          className="build-identity-file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importBuildSeed(event.target.files?.[0] ?? null)}
        />
        <button className="secondary-button" type="button" onClick={() => seedInputRef.current?.click()}>
          <FileInput size={15} />
          <span>Import seed</span>
        </button>
        <button className="secondary-button" type="button" onClick={exportBuildSeed}>
          <Download size={15} />
          <span>Export seed</span>
        </button>
        {seedStatus && <span className="build-identity-seed-status" role="status">{seedStatus}</span>}
      </div>
      <div className="build-identity-grid">
        {buildIdentityFields.map((field) => (
          <label className="control-row build-identity-field" key={field.key}>
            <span>{field.label}</span>
            <input
              type={field.type ?? 'text'}
              value={settings.buildIdentity[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => updateBuildIdentityField(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="build-identity-footer">
        <span>{populatedCount}/10 fields provisioned</span>
        <button
          className="secondary-button"
          type="button"
          onClick={() => updateSettings((current) => ({
            ...current,
            buildIdentity: {
              serial: '',
              buildDate: '',
              customerBuildProfile: '',
              motherboard: '',
              gpu: '',
              ramConfig: '',
              storageConfig: '',
              qcSeal: '',
              warrantyTier: '',
              supportTier: '',
            },
          }))}
        >
          <Trash2 size={15} />
          <span>Clear record</span>
        </button>
      </div>
    </Panel>
  );
}
