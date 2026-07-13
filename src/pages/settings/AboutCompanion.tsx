import { useEffect, useState } from 'react';
import { Archive, ClipboardList, Download, ExternalLink, Info, Mail, MapPin, PhoneCall, ShieldCheck, Trash2 } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { useMonitor } from '../../hooks/useMonitor';
import { useSettings } from '../../hooks/useSettings';
import { brand } from '../../lib/branding';
import { clearCompanionActions, readCompanionActions, recordCompanionAction, subscribeCompanionActions, summarizeCompanionActions, type CompanionActionRecord } from '../../lib/actionHistory';
import { exportLocalSupportReport } from '../../lib/supportReport';
import { openExternalUrl } from '../../services/native';
import { createDiagnosticsExportContext, exportDiagnostics, listRegistryBackups, restoreRegistryBackup } from '../../services/systemService';
import type { AppMetadata, RegistryBackup } from '../../types/system';

const brandWebsite = brand.website;
const companionEmail = brand.companionEmail;
const supportEmail = brand.supportEmail;
const brandPhone = brand.phone;
const brandAddress = brand.address;

export function AboutCompanion({ appMetadata }: { appMetadata: AppMetadata | null }) {
  const { systemInfo, sample, presentation } = useMonitor();
  const { settings } = useSettings();
  const [supportBundlePath, setSupportBundlePath] = useState('');
  const [supportReportPath, setSupportReportPath] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [actions, setActions] = useState<CompanionActionRecord[]>(() => readCompanionActions());
  const [registryBackups, setRegistryBackups] = useState<RegistryBackup[]>([]);
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
  const subject = encodeURIComponent(`${brand.productName} Assistance`);
  const supportBody = encodeURIComponent([
    `Hi ${brand.supportTeamName},`,
    '',
    `I need assistance with ${brand.productName}.`,
    '',
    `Bundle path: ${supportBundlePath || 'Not exported yet'}`,
    `App version: ${appMetadata?.version ?? '0.2.0'}`,
    `System: ${systemInfo?.cpu ?? 'CPU pending'} / ${systemInfo?.gpu ?? 'GPU pending'}`,
    `Motherboard: ${systemInfo?.motherboard ?? 'Pending'}`,
    `Telemetry: ${presentation.label} (raw ${sample?.state ?? 'pending'})`,
    '',
    'Recent Companion actions:',
    summarizeCompanionActions(6),
    '',
    'Issue summary:',
    '',
  ].join('\n'));

  useEffect(() => subscribeCompanionActions(() => setActions(readCompanionActions())), []);
  useEffect(() => {
    void refreshRegistryBackups();
  }, []);

  async function refreshRegistryBackups() {
    try {
      setRegistryBackups(await listRegistryBackups());
    } catch {
      setRegistryBackups([]);
    }
  }

  async function handleSupportBundle() {
    setSupportBusy(true);
    try {
      const result = await exportDiagnostics(createDiagnosticsExportContext({
        settings,
        systemInfo,
        sample,
        presentationLabel: presentation.label,
      }));
      setSupportBundlePath(result.path);
      recordCompanionAction('support', 'Support bundle prepared', result.path);
    } catch (err) {
      recordCompanionAction('support', 'Support bundle failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSupportBusy(false);
    }
  }

  function handleSupportReport() {
    const result = exportLocalSupportReport({
      settings,
      systemInfo,
      sample,
      presentationLabel: presentation.label,
      presentationState: presentation.state,
      recentActions: actions,
      appVersion: appMetadata?.version ?? '0.2.0',
    });
    setSupportReportPath(result.filename);
    recordCompanionAction('support', 'OEM support report exported', result.filename);
  }

  async function handleRestoreBackup(backup: RegistryBackup) {
    setRestoreBusyId(backup.id);
    try {
      const result = await restoreRegistryBackup(backup.id);
      recordCompanionAction('maintenance', 'Registry backup restore requested', result.join(' / '));
      await refreshRegistryBackups();
    } finally {
      setRestoreBusyId(null);
    }
  }

  return (
    <div className="settings-subpage about-companion">
      <Panel className="settings-panel about-hero wide">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{brand.dashboardEyebrow}</span>
            <h2>{brand.settingsHeroTitle}</h2>
          </div>
          <img className="settings-hero-wordmark" src={brand.splashLogo} alt={brand.productName} />
        </div>
        <p>
          {brand.settingsHeroBody}
        </p>
        <div className="about-stat-grid">
          <div><span>Version</span><strong>{appMetadata?.version ?? '0.2.0'}</strong></div>
          <div><span>Channel</span><strong>{appMetadata?.releaseChannel ?? 'pre-release'}</strong></div>
          <div><span>Support mode</span><strong>Diagnostics first</strong></div>
        </div>
        <div className="about-action-row">
          <button className="secondary-button" type="button" onClick={() => void handleSupportBundle()} disabled={supportBusy}>
            <Download size={16} />
            <span>{supportBusy ? 'Preparing bundle' : 'Prepare support bundle'}</span>
          </button>
          <button className="secondary-button" type="button" onClick={handleSupportReport}>
            <ClipboardList size={16} />
            <span>Generate OEM report</span>
          </button>
          <a className="primary-button" href={`mailto:${companionEmail}?subject=${subject}&body=${supportBody}`}>
            <Mail size={16} />
            <span>{brand.supportCtaLabel}</span>
          </a>
          <button className="secondary-button" type="button" onClick={() => openExternalUrl(brandWebsite)}>
            <ExternalLink size={16} />
            <span>Visit {brand.name}</span>
          </button>
        </div>
        {(supportBundlePath || supportReportPath) && (
          <div className="support-bundle-path">
            {supportBundlePath && <>
              <span>Latest support bundle</span>
              <strong title={supportBundlePath}>{supportBundlePath}</strong>
            </>}
            {supportReportPath && <>
              <span>Latest OEM report</span>
              <strong title={supportReportPath}>{supportReportPath}</strong>
            </>}
          </div>
        )}
      </Panel>

      <div className="about-grid">
        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Company</span>
              <h2>{brand.name}</h2>
            </div>
            <Info size={19} />
          </div>
          <p className="subtle">{brand.companyDescription}</p>
          <div className="about-contact-list">
            <a href={`tel:${brandPhone.replace(/\s+/g, '')}`}><PhoneCall size={15} /><span>{brandPhone}</span></a>
            <a href={`mailto:${supportEmail}`}><Mail size={15} /><span>{supportEmail}</span></a>
            <a
              href={brandWebsite}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => {
                event.preventDefault();
                openExternalUrl(brandWebsite);
              }}
            >
              <ExternalLink size={15} />
              <span>{brand.website.replace(/^https?:\/\//, '')}</span>
            </a>
            <span><MapPin size={15} /><span>{brandAddress}</span></span>
          </div>
        </Panel>

        <Panel className="settings-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Support workflow</span>
              <h2>How to get help</h2>
            </div>
            <ShieldCheck size={19} />
          </div>
          <ul className="check-list">
            <li><ShieldCheck size={16} /> Open Telemetry Diagnostics before emailing support.</li>
            <li><ShieldCheck size={16} /> Export a diagnostics bundle if sensors, startup, or cleanup actions misbehave.</li>
            <li><ShieldCheck size={16} /> Include your order/build context and what you were doing when the issue appeared.</li>
            <li><ShieldCheck size={16} /> Use {brand.productName} assistance for app issues, diagnostics review, or hardware/service handoff.</li>
          </ul>
        </Panel>

        <Panel className="settings-panel about-action-history">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Local history</span>
              <h2>What Companion changed</h2>
            </div>
            <ClipboardList size={19} />
          </div>
          <p className="subtle">Local-only support context for recent Companion actions. It is not uploaded automatically.</p>
          <div className="action-history-list">
            {actions.length === 0 ? (
              <div className="empty-state compact">
                <ClipboardList size={20} />
                <strong>No recent actions</strong>
                <span>Profile changes, diagnostics exports, and tray maintenance actions will appear here.</span>
              </div>
            ) : actions.slice(0, 8).map((action) => (
              <div className="action-history-row" key={action.id}>
                <span>{action.category}</span>
                <strong>{action.label}</strong>
                <small title={action.detail}>{action.detail}</small>
                <time>{action.timestamp}</time>
              </div>
            ))}
          </div>
          {actions.length > 0 && (
            <button className="secondary-button compact-button" type="button" onClick={clearCompanionActions}>
              <Trash2 size={15} />
              <span>Clear local history</span>
            </button>
          )}
        </Panel>

        <Panel className="settings-panel about-action-history">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Restore centre</span>
              <h2>Registry backups</h2>
            </div>
            <Archive size={19} />
          </div>
          <p className="subtle">Backups are local `.reg` exports created before registry cleanup. Restore only when you intend to roll back a previous clean.</p>
          <div className="restore-centre-list">
            {registryBackups.length === 0 ? (
              <div className="empty-state compact">
                <Archive size={20} />
                <strong>No registry backups found</strong>
                <span>Backups will appear here after Registry Cleaner creates them.</span>
              </div>
            ) : registryBackups.map((backup) => (
              <div className="restore-centre-row" key={backup.id}>
                <div>
                  <strong>{backup.createdAt}</strong>
                  <span title={backup.path}>{backup.path}</span>
                </div>
                <small>{backup.issueCount} item{backup.issueCount === 1 ? '' : 's'}</small>
                <button className="secondary-button compact-button" type="button" disabled={restoreBusyId === backup.id} onClick={() => void handleRestoreBackup(backup)}>
                  <ShieldCheck size={15} />
                  <span>{restoreBusyId === backup.id ? 'Restoring' : 'Restore'}</span>
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
