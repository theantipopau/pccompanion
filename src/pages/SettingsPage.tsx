import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Gauge, Info, RotateCcw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useSettings } from '../hooks/useSettings';
import { getAppMetadata } from '../services/systemService';
import { AboutCompanion } from './settings/AboutCompanion';
import { BuildIdentitySettings } from './settings/BuildIdentitySettings';
import { GameModeSettings } from './settings/GameModeSettings';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { SystemPassportPage } from './SystemPassportPage';
import { TelemetryDiagnosticsPage } from './TelemetryDiagnosticsPage';
import type { AppMetadata } from '../types/system';

type SettingsTab = 'general' | 'games' | 'passport' | 'diagnostics' | 'about';

const SETTINGS_TAB_ORDER: SettingsTab[] = ['general', 'passport', 'games', 'diagnostics', 'about'];

export function SettingsPage({ initialTab = 'general' }: { initialTab?: SettingsTab }) {
  const { resetSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [appMetadata, setAppMetadata] = useState<AppMetadata | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let alive = true;
    getAppMetadata()
      .then((metadata) => {
        if (alive) setAppMetadata(metadata);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  function tabButtonId(tab: SettingsTab): string {
    return `settings-tab-${tab}`;
  }

  function tabPanelId(tab: SettingsTab): string {
    return `settings-panel-${tab}`;
  }

  function focusTabAt(index: number) {
    const clamped = (index + SETTINGS_TAB_ORDER.length) % SETTINGS_TAB_ORDER.length;
    const tab = SETTINGS_TAB_ORDER[clamped];
    setActiveTab(tab);
    tabRefs.current[clamped]?.focus();
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, tab: SettingsTab) {
    const currentIndex = SETTINGS_TAB_ORDER.indexOf(tab);
    if (currentIndex < 0) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTabAt(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTabAt(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTabAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusTabAt(SETTINGS_TAB_ORDER.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Personalisation"
        title="Settings"
        description="Tune tray, overlay, monitoring, profiles, and desktop integration."
        action={
          <button className="primary-button" onClick={resetSettings}>
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>
        }
      />

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button
          ref={(element) => { tabRefs.current[0] = element; }}
          id={tabButtonId('general')}
          className={activeTab === 'general' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          aria-controls={tabPanelId('general')}
          tabIndex={activeTab === 'general' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 'general')}
          onClick={() => setActiveTab('general')}
        >
          <SlidersHorizontal size={16} />
          <span>General</span>
        </button>
        <button
          ref={(element) => { tabRefs.current[1] = element; }}
          id={tabButtonId('passport')}
          className={activeTab === 'passport' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'passport'}
          aria-controls={tabPanelId('passport')}
          tabIndex={activeTab === 'passport' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 'passport')}
          onClick={() => setActiveTab('passport')}
        >
          <Gauge size={16} />
          <span>System Passport</span>
        </button>
        <button
          ref={(element) => { tabRefs.current[2] = element; }}
          id={tabButtonId('games')}
          className={activeTab === 'games' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'games'}
          aria-controls={tabPanelId('games')}
          tabIndex={activeTab === 'games' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 'games')}
          onClick={() => setActiveTab('games')}
        >
          <Gamepad2 size={16} />
          <span>Game Mode</span>
        </button>
        <button
          ref={(element) => { tabRefs.current[3] = element; }}
          id={tabButtonId('diagnostics')}
          className={activeTab === 'diagnostics' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'diagnostics'}
          aria-controls={tabPanelId('diagnostics')}
          tabIndex={activeTab === 'diagnostics' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 'diagnostics')}
          onClick={() => setActiveTab('diagnostics')}
        >
          <ShieldCheck size={16} />
          <span>Diagnostics</span>
        </button>
        <button
          ref={(element) => { tabRefs.current[4] = element; }}
          id={tabButtonId('about')}
          className={activeTab === 'about' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === 'about'}
          aria-controls={tabPanelId('about')}
          tabIndex={activeTab === 'about' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 'about')}
          onClick={() => setActiveTab('about')}
        >
          <Info size={16} />
          <span>About</span>
        </button>
      </div>

      {activeTab === 'passport' && (
        <section id={tabPanelId('passport')} role="tabpanel" aria-labelledby={tabButtonId('passport')}>
          <BuildIdentitySettings />
          <SystemPassportPage embedded />
        </section>
      )}
      {activeTab === 'games' && (
        <section id={tabPanelId('games')} role="tabpanel" aria-labelledby={tabButtonId('games')}>
          <GameModeSettings />
        </section>
      )}
      {activeTab === 'diagnostics' && (
        <section id={tabPanelId('diagnostics')} role="tabpanel" aria-labelledby={tabButtonId('diagnostics')}>
          <TelemetryDiagnosticsPage embedded />
        </section>
      )}
      {activeTab === 'about' && (
        <section id={tabPanelId('about')} role="tabpanel" aria-labelledby={tabButtonId('about')}>
          <AboutCompanion appMetadata={appMetadata} />
        </section>
      )}
      {activeTab === 'general' && (
        <section id={tabPanelId('general')} role="tabpanel" aria-labelledby={tabButtonId('general')}>
          <GeneralSettingsTab appMetadata={appMetadata} />
        </section>
      )}
    </div>
  );
}
