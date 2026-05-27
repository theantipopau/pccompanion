const ACTION_HISTORY_KEY = 'radium-companion-action-history-v1';
const ACTION_HISTORY_EVENT = 'radium-action-history-updated';
const MAX_ACTION_HISTORY = 40;

export type CompanionActionRecord = {
  id: string;
  timestamp: string;
  category: 'support' | 'profile' | 'diagnostics' | 'maintenance' | 'tray' | 'settings';
  label: string;
  detail: string;
};

export function recordCompanionAction(
  category: CompanionActionRecord['category'],
  label: string,
  detail: string,
) {
  try {
    const next: CompanionActionRecord = {
      id: `${Date.now()}-${Math.round(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleString(),
      category,
      label,
      detail,
    };
    const records = [next, ...readCompanionActions()].slice(0, MAX_ACTION_HISTORY);
    window.localStorage.setItem(ACTION_HISTORY_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent(ACTION_HISTORY_EVENT));
  } catch {
    // Action history is helpful support context, not required app state.
  }
}

export function readCompanionActions(): CompanionActionRecord[] {
  try {
    const raw = window.localStorage.getItem(ACTION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompanionActionRecord[];
    return Array.isArray(parsed) ? parsed.filter(isCompanionActionRecord) : [];
  } catch {
    return [];
  }
}

export function clearCompanionActions() {
  try {
    window.localStorage.removeItem(ACTION_HISTORY_KEY);
    window.dispatchEvent(new CustomEvent(ACTION_HISTORY_EVENT));
  } catch {
    // Ignore storage failures.
  }
}

export function subscribeCompanionActions(listener: () => void) {
  window.addEventListener(ACTION_HISTORY_EVENT, listener);
  return () => window.removeEventListener(ACTION_HISTORY_EVENT, listener);
}

export function summarizeCompanionActions(limit = 6): string {
  const records = readCompanionActions().slice(0, limit);
  if (records.length === 0) return 'No recent Companion actions recorded.';
  return records
    .map((record) => `${record.timestamp} - ${record.category}: ${record.label} (${record.detail})`)
    .join('\n');
}

function isCompanionActionRecord(value: unknown): value is CompanionActionRecord {
  const candidate = value as Partial<CompanionActionRecord>;
  return Boolean(
    candidate
      && typeof candidate.id === 'string'
      && typeof candidate.timestamp === 'string'
      && typeof candidate.category === 'string'
      && typeof candidate.label === 'string'
      && typeof candidate.detail === 'string',
  );
}
