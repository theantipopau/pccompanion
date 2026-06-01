import { Bot, CheckCircle2, Copy, Cpu, Download, MessageSquare, PlugZap, RefreshCw, Send, ShieldCheck, Sparkles, Terminal } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { brand } from '../lib/branding';
import { buildCopilotContextPack, buildCopilotRecommendation, buildNonInvasiveInsights, confidenceLabel } from '../lib/copilot';
import { runLocalAiSetup } from '../services/systemService';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type RuntimeState = 'disconnected' | 'checking' | 'connected' | 'error';

type RuntimeTagsResponse = {
  models?: Array<{ name?: string; model?: string }>;
};

type CopilotPersistedSettings = {
  runtimeUrl: string;
  modelName: string;
  lockToLocalhost: boolean;
  attachContextPack: boolean;
};

const COPILOT_SETTINGS_KEY = `${brand.mode}:copilot-local-settings:v1`;
const RUNTIME_TIMEOUT_MS = 4500;

export function AiCopilotPage() {
  const { sample, systemInfo } = useMonitor();
  const deferredSample = useDeferredValue(sample);
  const deferredSystemInfo = useDeferredValue(systemInfo);
  const recommendation = useMemo(() => buildCopilotRecommendation(deferredSystemInfo, deferredSample), [deferredSample, deferredSystemInfo]);
  const insights = useMemo(() => buildNonInvasiveInsights(deferredSample), [deferredSample]);
  const contextPack = useMemo(() => buildCopilotContextPack(deferredSystemInfo, deferredSample, insights), [deferredSample, deferredSystemInfo, insights]);
  const savedSettings = useMemo(() => loadCopilotSettings(), []);

  const [runtimeUrl, setRuntimeUrl] = useState(savedSettings?.runtimeUrl ?? 'http://127.0.0.1:11434');
  const [modelName, setModelName] = useState(savedSettings?.modelName ?? recommendation.general.modelTag);
  const [lockToLocalhost, setLockToLocalhost] = useState(savedSettings?.lockToLocalhost ?? true);
  const [attachContextPack, setAttachContextPack] = useState(savedSettings?.attachContextPack ?? true);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>('disconnected');
  const [runtimeMessage, setRuntimeMessage] = useState('Not connected yet.');
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [discoveryLabel, setDiscoveryLabel] = useState('No local model scan yet.');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `${brand.shortName} is local-first. Connect a local runtime (for example Ollama) to chat offline.`,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [nativeActionBusy, setNativeActionBusy] = useState(false);

  useEffect(() => {
    saveCopilotSettings({ runtimeUrl, modelName, lockToLocalhost, attachContextPack });
  }, [attachContextPack, lockToLocalhost, modelName, runtimeUrl]);

  const hasInstalledModel = (target: string, models = installedModels) => {
    const normalized = normalizeModelTag(target);
    return models.some((entry) => {
      const current = normalizeModelTag(entry);
      return current === normalized || modelBase(current) === modelBase(normalized);
    });
  };

  const setupCommands = useMemo(() => ([
    { id: 'install-ollama', label: 'Install Ollama (Windows)', command: 'winget install Ollama.Ollama' },
    { id: 'pull-general', label: 'Download general model', command: `ollama pull ${recommendation.general.modelTag}` },
    { id: 'pull-coding', label: 'Download coding model', command: `ollama pull ${recommendation.coding.modelTag}` },
    { id: 'run-model', label: 'Run selected model', command: `ollama run ${modelName}` },
  ]), [modelName, recommendation.coding.modelTag, recommendation.general.modelTag]);

  const runtimeAllowed = useMemo(() => {
    try {
      const parsed = new URL(runtimeUrl);
      if (!lockToLocalhost) return true;
      return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    } catch {
      return false;
    }
  }, [lockToLocalhost, runtimeUrl]);

  async function copyCommand(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCommand(value);
      window.setTimeout(() => setCopiedCommand((current) => (current === value ? null : current)), 1400);
    } catch {
      setCopiedCommand(null);
    }
  }

  async function fetchRuntimeModels(baseUrl: string): Promise<string[]> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), RUNTIME_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { method: 'GET', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json() as RuntimeTagsResponse;
      return Array.from(new Set((payload.models ?? [])
        .map((entry) => (entry.name ?? entry.model ?? '').trim())
        .filter((entry) => entry.length > 0)));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function handleConnectRuntime() {
    if (!runtimeAllowed) {
      setRuntimeState('error');
      setRuntimeMessage('Blocked by local-only lock. Use localhost/127.0.0.1 or disable lock mode.');
      return;
    }
    setRuntimeState('checking');
    setRuntimeMessage('Checking local runtime...');
    try {
      const models = await fetchRuntimeModels(runtimeUrl);
      setInstalledModels(models);
      setDiscoveryLabel(models.length > 0 ? `Detected ${models.length} local model${models.length > 1 ? 's' : ''}.` : 'Runtime reachable, no local models found yet.');
      if (models.length > 0 && !hasInstalledModel(modelName, models)) {
        setModelName(models[0]);
      }
      setRuntimeState('connected');
      setRuntimeMessage('Local runtime reachable. Chat is ready.');
    } catch (error) {
      setRuntimeState('error');
      setRuntimeMessage(describeRuntimeError(error, 'connect'));
    }
  }

  async function handleRefreshModels() {
    if (!runtimeAllowed) {
      setRuntimeState('error');
      setRuntimeMessage('Blocked by local-only lock. Use localhost/127.0.0.1 or disable lock mode.');
      return;
    }
    setRuntimeState('checking');
    try {
      const models = await fetchRuntimeModels(runtimeUrl);
      setInstalledModels(models);
      setDiscoveryLabel(models.length > 0 ? `Detected ${models.length} local model${models.length > 1 ? 's' : ''}.` : 'Runtime reachable, no local models found yet.');
      setRuntimeState('connected');
      setRuntimeMessage('Model list refreshed from local runtime.');
    } catch (error) {
      setRuntimeState('error');
      setRuntimeMessage(describeRuntimeError(error, 'refresh'));
    }
  }

  async function handleNativeSetupAction(action: 'install_ollama' | 'pull_model' | 'start_runtime') {
    if (nativeActionBusy) return;
    setNativeActionBusy(true);
    try {
      const message = await runLocalAiSetup(action, action === 'pull_model' ? modelName : undefined);
      setRuntimeState('connected');
      setRuntimeMessage(message);
      if (action === 'pull_model' || action === 'start_runtime') {
        await handleRefreshModels();
      }
    } catch (error) {
      setRuntimeState('error');
      setRuntimeMessage(error instanceof Error ? error.message : 'Native setup action failed.');
    } finally {
      setNativeActionBusy(false);
    }
  }

  async function handleSendMessage() {
    const text = draft.trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setDraft('');

    if (runtimeState !== 'connected') {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Runtime is not connected yet. Use Connect runtime, then I can answer with your local model only.',
        },
      ]);
      return;
    }

    if (!runtimeAllowed) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Request blocked by local-only lock mode. Switch runtime to localhost or disable the lock explicitly.',
        },
      ]);
      return;
    }

    if (installedModels.length > 0 && !hasInstalledModel(modelName)) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Model ${modelName} is not installed locally. Run: ollama pull ${modelName}`,
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const payloadMessages = attachContextPack
        ? [
          {
            role: 'system',
            content: `${contextPack}\n\nAnswer using this context only when relevant. Do not suggest destructive or irreversible actions.`,
          },
          ...nextMessages,
        ]
        : nextMessages;

      const response = await fetch(`${runtimeUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          stream: false,
          messages: payloadMessages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Runtime error: HTTP ${response.status}`);
      }

      const payload = await response.json() as { message?: { content?: string } };
      const content = payload.message?.content?.trim() || 'No response from local model.';
      setMessages((current) => [...current, { role: 'assistant', content }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Local model request failed: ${describeRuntimeError(error, 'chat')}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Local-first"
        title={brand.mode === 'demo' ? 'PC Companion' : `${brand.name} CoPilot`}
        description="Offline model recommendations and optional local LLM chat. No cloud dependency is required for this workflow."
      />

      <Panel className="copilot-search-hero">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">Prompt</span>
            <h2>{brand.mode === 'demo' ? 'Ask PC Companion' : `Ask ${brand.name} CoPilot`}</h2>
          </div>
          <MessageSquare size={18} />
        </div>
        <p className="copilot-search-caption">Search, ask, and troubleshoot from local telemetry context. Settings and runtime controls are directly underneath.</p>
        <div className="copilot-search-center">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask your local model about thermals, profile trade-offs, startup impact, or diagnostics..."
            rows={3}
          />
          <button className="primary-button" type="button" onClick={handleSendMessage} disabled={sending || !draft.trim()}>
            <Send size={14} />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </Panel>

      <Panel className="copilot-chat-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Runtime settings</span>
            <h2>Local model runtime and controls</h2>
          </div>
          <PlugZap size={19} />
        </div>

        <div className="copilot-runtime-config">
          <label>
            Runtime URL
            <input value={runtimeUrl} onChange={(event) => setRuntimeUrl(event.target.value)} placeholder="http://127.0.0.1:11434" />
          </label>
          <label>
            Model tag
            <input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="qwen2.5:7b-instruct-q4_K_M" />
          </label>
          <div className="copilot-runtime-actions">
            <button className="secondary-button" type="button" onClick={handleConnectRuntime} disabled={runtimeState === 'checking'}>
              <PlugZap size={14} />
              <span>{runtimeState === 'checking' ? 'Checking...' : 'Connect runtime'}</span>
            </button>
            <button className="secondary-button" type="button" onClick={handleRefreshModels} disabled={runtimeState === 'checking'}>
              <RefreshCw size={14} />
              <span>Refresh models</span>
            </button>
          </div>
        </div>

        <div className="copilot-native-actions">
          <button className="secondary-button" type="button" disabled={nativeActionBusy} onClick={() => handleNativeSetupAction('install_ollama')}>
            <Download size={14} />
            <span>{nativeActionBusy ? 'Working...' : 'Install Ollama'}</span>
          </button>
          <button className="secondary-button" type="button" disabled={nativeActionBusy} onClick={() => handleNativeSetupAction('pull_model')}>
            <Terminal size={14} />
            <span>{nativeActionBusy ? 'Working...' : 'Pull selected model'}</span>
          </button>
          <button className="secondary-button" type="button" disabled={nativeActionBusy} onClick={() => handleNativeSetupAction('start_runtime')}>
            <Bot size={14} />
            <span>{nativeActionBusy ? 'Working...' : 'Start runtime'}</span>
          </button>
        </div>

        <div className="copilot-toggle-row">
          <label>
            <input type="checkbox" checked={lockToLocalhost} onChange={(event) => setLockToLocalhost(event.target.checked)} />
            <span>Lock runtime to localhost only</span>
          </label>
          <label>
            <input type="checkbox" checked={attachContextPack} onChange={(event) => setAttachContextPack(event.target.checked)} />
            <span>Attach safe local context pack</span>
          </label>
        </div>

        <p className={`copilot-runtime-state ${runtimeState}`}>{runtimeMessage}</p>

        <div className="copilot-installed-row">
          <strong>Installed models</strong>
          {installedModels.length > 0 ? (
            <label>
              Select installed model
              <select value={modelName} onChange={(event) => setModelName(event.target.value)}>
                {installedModels.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
          ) : (
            <p>No local models discovered yet. Connect runtime, then pull one of the recommended models.</p>
          )}
          <span>{discoveryLabel}</span>
        </div>
      </Panel>

      <div className="copilot-layout">
        <Panel className="copilot-recommendation-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Model fit</span>
              <h2>Recommended for your hardware</h2>
            </div>
            <Sparkles size={19} />
          </div>
          <p className="copilot-summary">{recommendation.summary}</p>
          <div className="copilot-model-grid">
            <article className="copilot-model-card">
              <h3>{recommendation.general.title}</h3>
              <div className="copilot-model-meta">
                <span className={hasInstalledModel(recommendation.general.modelTag) ? 'copilot-install-chip installed' : 'copilot-install-chip missing'}>
                  {hasInstalledModel(recommendation.general.modelTag) ? 'Installed' : 'Not installed'}
                </span>
                {!hasInstalledModel(recommendation.general.modelTag) && (
                  <button className="secondary-button compact-button" type="button" onClick={() => copyCommand(`ollama pull ${recommendation.general.modelTag}`)}>
                    {copiedCommand === `ollama pull ${recommendation.general.modelTag}` ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedCommand === `ollama pull ${recommendation.general.modelTag}` ? 'Copied' : 'Copy pull'}</span>
                  </button>
                )}
              </div>
              <span className="copilot-model-tag">{recommendation.general.modelTag}</span>
              <p>{recommendation.general.notes}</p>
            </article>
            <article className="copilot-model-card">
              <h3>{recommendation.coding.title}</h3>
              <div className="copilot-model-meta">
                <span className={hasInstalledModel(recommendation.coding.modelTag) ? 'copilot-install-chip installed' : 'copilot-install-chip missing'}>
                  {hasInstalledModel(recommendation.coding.modelTag) ? 'Installed' : 'Not installed'}
                </span>
                {!hasInstalledModel(recommendation.coding.modelTag) && (
                  <button className="secondary-button compact-button" type="button" onClick={() => copyCommand(`ollama pull ${recommendation.coding.modelTag}`)}>
                    {copiedCommand === `ollama pull ${recommendation.coding.modelTag}` ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    <span>{copiedCommand === `ollama pull ${recommendation.coding.modelTag}` ? 'Copied' : 'Copy pull'}</span>
                  </button>
                )}
              </div>
              <span className="copilot-model-tag">{recommendation.coding.modelTag}</span>
              <p>{recommendation.coding.notes}</p>
            </article>
          </div>
          <div className="copilot-bullet-list">
            {recommendation.notes.map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
          <div className="copilot-button-row">
            <a className="secondary-button" href="https://ollama.com/library" target="_blank" rel="noreferrer noopener">
              <Download size={14} />
              <span>Browse local models</span>
            </a>
            <button className="secondary-button" type="button" onClick={() => setModelName(recommendation.general.modelTag)}>
              <Bot size={14} />
              <span>Use general model</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => setModelName(recommendation.coding.modelTag)}>
              <Terminal size={14} />
              <span>Use coding model</span>
            </button>
          </div>
        </Panel>

        <Panel className="copilot-insights-panel">
          <div className="panel-heading compact">
            <div>
              <span className="eyebrow">Non-invasive insights</span>
              <h2>Local AI guidance</h2>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="copilot-insight-list">
            {insights.map((insight) => (
              <article key={insight.id} className={`copilot-insight-card tone-${insight.tone}`}>
                <div className="copilot-insight-topline">
                  <strong>{insight.title}</strong>
                  <span>{confidenceLabel(insight.confidence)}</span>
                </div>
                <p>{insight.summary}</p>
                <div className="copilot-insight-signals">
                  {insight.signals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
                <small>{insight.suggestedAction}</small>
              </article>
            ))}
          </div>
          <div className="copilot-runtime-chip-row">
            <span><Cpu size={12} /> Telemetry-only context</span>
            <span><Bot size={12} /> No hidden automation</span>
            <span><ShieldCheck size={12} /> User-confirmed actions only</span>
          </div>
        </Panel>
      </div>

      <Panel className="copilot-setup-panel">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">Offline setup</span>
            <h2>Quick local runtime commands</h2>
          </div>
          <Terminal size={18} />
        </div>
        <div className="copilot-command-list">
          {setupCommands.map((entry) => (
            <div key={entry.id} className="copilot-command-row">
              <div>
                <strong>{entry.label}</strong>
                <code>{entry.command}</code>
              </div>
              <button className="secondary-button compact-button" type="button" onClick={() => copyCommand(entry.command)}>
                {copiedCommand === entry.command ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                <span>{copiedCommand === entry.command ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="copilot-chat-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Conversation</span>
            <h2>Chat transcript</h2>
          </div>
          <MessageSquare size={19} />
        </div>

        <div className="copilot-chat-log">
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`copilot-chat-message ${message.role}`}>
              <strong>{message.role === 'assistant' ? 'CoPilot' : 'You'}</strong>
              <p>{message.content}</p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function normalizeModelTag(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed.endsWith(':latest') ? trimmed.slice(0, -7) : trimmed;
}

function modelBase(value: string): string {
  return normalizeModelTag(value).split(':')[0];
}

function loadCopilotSettings(): CopilotPersistedSettings | null {
  try {
    const raw = window.localStorage.getItem(COPILOT_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CopilotPersistedSettings>;
    if (typeof parsed.runtimeUrl !== 'string' || typeof parsed.modelName !== 'string') return null;
    return {
      runtimeUrl: parsed.runtimeUrl,
      modelName: parsed.modelName,
      lockToLocalhost: parsed.lockToLocalhost !== false,
      attachContextPack: parsed.attachContextPack !== false,
    };
  } catch {
    return null;
  }
}

function saveCopilotSettings(settings: CopilotPersistedSettings) {
  try {
    window.localStorage.setItem(COPILOT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Local storage can be unavailable in restricted preview hosts; defaults remain usable.
  }
}

function describeRuntimeError(error: unknown, operation: 'connect' | 'refresh' | 'chat'): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Local runtime timed out. Check that Ollama is running on the configured localhost URL.';
  }

  const message = error instanceof Error ? error.message : '';
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return operation === 'chat'
      ? 'Could not reach the local runtime for chat. Confirm Ollama is running and the model is loaded.'
      : 'Could not reach the local runtime. Confirm Ollama is running and listening on the configured URL.';
  }

  if (/HTTP 404/.test(message)) {
    return 'Runtime responded, but the Ollama-compatible API endpoint was not found.';
  }

  if (/HTTP 500|HTTP 503/.test(message)) {
    return 'Runtime responded with an internal error. The selected model may not be loaded yet.';
  }

  if (/HTTP 403|HTTP 401/.test(message)) {
    return 'Runtime rejected the request. Check local API permissions or proxy settings.';
  }

  return message || 'Could not complete the local runtime request.';
}
