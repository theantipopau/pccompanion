import { useState } from 'react';
import { Gamepad2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { useSettings } from '../../hooks/useSettings';
import { listTopProcesses } from '../../services/systemService';
import type { GameProfileMapping, PerformanceProfileId, ProcessInfo } from '../../types/system';

const profileOptions: Array<{ id: PerformanceProfileId; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'creator', label: 'Creator' },
  { id: 'quiet', label: 'Quiet' },
];

const systemProcessNames = new Set([
  'system',
  'svchost.exe',
  'csrss.exe',
  'lsass.exe',
  'dwm.exe',
  'ctfmon.exe',
  'runtimebroker.exe',
  'searchhost.exe',
]);

export function GameModeSettings() {
  const { settings, updateSettings } = useSettings();
  const [draftLabel, setDraftLabel] = useState('');
  const [draftProcess, setDraftProcess] = useState('');
  const [draftPath, setDraftPath] = useState('');
  const [draftLaunchProfile, setDraftLaunchProfile] = useState<PerformanceProfileId>('gaming');
  const [draftRestoreProfile, setDraftRestoreProfile] = useState<PerformanceProfileId>('balanced');
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processBusy, setProcessBusy] = useState(false);

  async function refreshProcesses() {
    setProcessBusy(true);
    try {
      setProcesses((await listTopProcesses(16)).filter((process) => !systemProcessNames.has(process.name.toLowerCase())));
    } finally {
      setProcessBusy(false);
    }
  }

  function addMapping(processName = draftProcess, label = draftLabel, executablePath = draftPath) {
    const cleanProcess = processName.trim();
    if (!cleanProcess) return;
    const cleanLabel = label.trim() || cleanProcess.replace(/\.exe$/i, '');
    const mapping: GameProfileMapping = {
      id: `game-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      label: cleanLabel,
      processName: cleanProcess,
      executablePath: executablePath.trim(),
      launchProfile: draftLaunchProfile,
      restoreProfile: draftRestoreProfile,
      enabled: true,
      automationEnabled: false,
    };
    updateSettings((current) => ({
      ...current,
      gameMode: { ...current.gameMode, mappings: [...current.gameMode.mappings, mapping] },
    }));
    setDraftLabel('');
    setDraftProcess('');
    setDraftPath('');
  }

  function updateMapping(id: string, updater: (mapping: GameProfileMapping) => GameProfileMapping) {
    updateSettings((current) => ({
      ...current,
      gameMode: {
        ...current.gameMode,
        mappings: current.gameMode.mappings.map((mapping) => (mapping.id === id ? updater(mapping) : mapping)),
      },
    }));
  }

  function removeMapping(id: string) {
    updateSettings((current) => ({
      ...current,
      gameMode: {
        ...current.gameMode,
        mappings: current.gameMode.mappings.filter((mapping) => mapping.id !== id),
      },
    }));
  }

  return (
    <div className="settings-subpage">
      <div className="embedded-page-intro">
        <div>
          <span className="eyebrow">Game mode</span>
          <h2>Manual profile mappings</h2>
          <p>Map games or launchers to profiles. Automation stays off until reviewed.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => void refreshProcesses()} disabled={processBusy}>
          <RefreshCw size={16} />
          <span>{processBusy ? 'Scanning' : 'Detect apps'}</span>
        </button>
      </div>

      <Panel className="settings-panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Add mapping</span>
            <h2>Process trigger</h2>
          </div>
          <Gamepad2 size={19} />
        </div>
        <div className="game-map-form">
          <label>
            <span>Name</span>
            <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} placeholder="Cyberpunk 2077" />
          </label>
          <label>
            <span>Process</span>
            <input value={draftProcess} onChange={(event) => setDraftProcess(event.target.value)} placeholder="game.exe" />
          </label>
          <label>
            <span>Path optional</span>
            <input value={draftPath} onChange={(event) => setDraftPath(event.target.value)} placeholder="C:\\Games\\game.exe" />
          </label>
          <label>
            <span>Launch profile</span>
            <select value={draftLaunchProfile} onChange={(event) => setDraftLaunchProfile(event.target.value as PerformanceProfileId)}>
              {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <label>
            <span>Restore profile</span>
            <select value={draftRestoreProfile} onChange={(event) => setDraftRestoreProfile(event.target.value as PerformanceProfileId)}>
              {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
            </select>
          </label>
          <button className="primary-button" type="button" onClick={() => addMapping()}>
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>

        {processes.length > 0 && (
          <div className="process-picker">
            {processes.map((process) => (
              <button key={`${process.pid}-${process.name}`} type="button" onClick={() => addMapping(process.name, process.name.replace(/\.exe$/i, ''), '')}>
                <strong>{process.name}</strong>
                <span>{process.cpuPct.toFixed(1)}% CPU / {process.memMb.toFixed(0)} MB</span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="settings-panel wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Local rules</span>
            <h2>Mapped games and launchers</h2>
          </div>
          <span className="diagnostics-badge muted">Automation off</span>
        </div>
        <div className="game-mode-note">
          Local only. Stored mappings stay inactive until automation ships.
        </div>
        <div className="game-map-list">
          {settings.gameMode.mappings.length === 0 ? (
            <div className="empty-state">
              <Gamepad2 size={22} />
              <strong>No game mappings yet</strong>
              <span>Add a process name manually or detect running apps.</span>
            </div>
          ) : settings.gameMode.mappings.map((mapping) => (
            <div className="game-map-row" key={mapping.id}>
              <label>
                <span>Name</span>
                <input value={mapping.label} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, label: event.target.value }))} />
              </label>
              <label>
                <span>Process</span>
                <input value={mapping.processName} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, processName: event.target.value }))} />
              </label>
              <label>
                <span>Launch</span>
                <select value={mapping.launchProfile} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, launchProfile: event.target.value as PerformanceProfileId }))}>
                  {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <label>
                <span>Restore</span>
                <select value={mapping.restoreProfile} onChange={(event) => updateMapping(mapping.id, (current) => ({ ...current, restoreProfile: event.target.value as PerformanceProfileId }))}>
                  {profileOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <button className="icon-danger-button" type="button" onClick={() => removeMapping(mapping.id)} title="Remove mapping">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
