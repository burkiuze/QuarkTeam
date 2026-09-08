import { useEffect, useState } from "react";
import { Download, HardDrive, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { bridge } from "../lib/bridge";
import type {
  LocalModel,
  OllamaStatus,
  ProviderAccount,
  ProviderPreset,
  PullProgress,
  QuarkSettings,
} from "../types";

type Props = {
  settings: QuarkSettings;
  providers: ProviderPreset[];
  busyProviderId: string | null;
  onChange: (settings: QuarkSettings) => void;
  onRefresh: (providerId: string) => void;
  onClose: () => void;
};

/** Small, widely used coding models that fit on a typical laptop. */
const SUGGESTED_LOCAL = [
  "qwen2.5-coder:7b",
  "qwen2.5-coder:14b",
  "deepseek-coder-v2:16b",
  "llama3.1:8b",
];

function formatBytes(bytes: number) {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/**
 * Models already downloaded by the local Ollama daemon, plus a way to pull new
 * ones. The daemon does the download, so this works wherever Ollama runs.
 */
function LocalModels({
  account,
  activeModel,
  onPick,
}: {
  account: ProviderAccount;
  activeModel: string;
  onPick: (modelId: string) => void;
}) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const state = await bridge().ollamaStatus(account.baseUrl);
      setStatus(state);
      if (state.reachable) setModels(await bridge().listLocalModels(account.baseUrl));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    void reload();
    return bridge().onPullProgress((update) => setProgress(update));
  }, [account.baseUrl]);

  const pull = async (model: string) => {
    setError(null);
    setProgress({ model, status: "starting", done: false });
    try {
      setModels(await bridge().pullLocalModel(model, account.baseUrl));
      setName("");
    } catch (pullError) {
      setError(pullError instanceof Error ? pullError.message : String(pullError));
    } finally {
      setProgress(null);
    }
  };

  const percent =
    progress?.total && progress.completed
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : null;

  return (
    <div className="local-panel">
      <div className="local-status">
        <span className={`manage-dot ${status?.reachable ? "on" : ""}`} />
        {status?.reachable
          ? `Ollama ${status.version ?? ""} running at ${status.baseUrl}`
          : (status?.error ?? "Checking for a local Ollama daemon…")}
        <button className="secondary-button" style={{ marginLeft: "auto" }} onClick={() => void reload()}>
          <RefreshCw size={13} /> Rescan
        </button>
      </div>

      {!status?.reachable && status?.installHint ? (
        <>
          <div className="manage-models-heading">Install Ollama, then reopen this panel</div>
          <div className="local-install">{status.installHint}</div>
        </>
      ) : null}

      {status?.reachable ? (
        <>
          <div className="local-pull">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim()) void pull(name.trim());
              }}
              placeholder="Download a model, e.g. qwen2.5-coder:7b"
            />
            <button
              className="secondary-button"
              disabled={!name.trim() || Boolean(progress)}
              onClick={() => void pull(name.trim())}
            >
              <Download size={13} /> {progress ? "Downloading…" : "Download"}
            </button>
          </div>

          <div className="local-suggestions">
            {SUGGESTED_LOCAL.filter((item) => !models.some((model) => model.id === item)).map(
              (item) => (
                <button key={item} onClick={() => setName(item)} disabled={Boolean(progress)}>
                  {item}
                </button>
              ),
            )}
          </div>

          {progress ? (
            <div className="local-progress">
              <span>
                {progress.model}: {progress.status}
                {percent !== null ? ` — ${percent}%` : ""}
              </span>
              <div className="local-bar">
                <span style={{ width: `${percent ?? 8}%` }} />
              </div>
            </div>
          ) : null}

          <div className="manage-models-heading">
            {models.length ? `${models.length} model(s) on this machine` : "Nothing downloaded yet"}
          </div>
          {models.map((model) => (
            <button
              key={model.id}
              className={`local-model ${activeModel === model.id ? "active" : ""}`}
              onClick={() => onPick(model.id)}
            >
              <HardDrive size={13} />
              <span>{model.id}</span>
              {model.parameterSize ? <span className="model-badge">{model.parameterSize}</span> : null}
              <span className="size">{formatBytes(model.size)}</span>
            </button>
          ))}
        </>
      ) : null}

      {error ? <div className="provider-note">{error}</div> : null}
    </div>
  );
}

const PROTOCOLS: Array<[ProviderAccount["protocol"], string]> = [
  ["openai-responses", "OpenAI Responses"],
  ["openai-chat", "OpenAI Chat-compatible"],
  ["anthropic", "Anthropic Messages"],
  ["gemini", "Gemini generateContent"],
];

/**
 * Provider credentials and catalogues. Each provider keeps its own key and
 * model list so the picker can offer all of them side by side.
 */
export function ManageModels({
  settings,
  providers,
  busyProviderId,
  onChange,
  onRefresh,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState(
    settings.accounts[0]?.providerId ?? settings.activeProviderId,
  );
  const [adding, setAdding] = useState("");

  const account = settings.accounts.find((item) => item.providerId === selectedId);
  const preset = providers.find((item) => item.providerId === selectedId);
  const unconfigured = providers.filter(
    (item) => !settings.accounts.some((existing) => existing.providerId === item.providerId),
  );

  const update = (providerId: string, patch: Partial<ProviderAccount>) => {
    onChange({
      ...settings,
      accounts: settings.accounts.map((item) =>
        item.providerId === providerId ? { ...item, ...patch } : item,
      ),
    });
  };

  const addProvider = (providerId: string) => {
    const found = providers.find((item) => item.providerId === providerId);
    if (!found) return;
    onChange({
      ...settings,
      accounts: [
        ...settings.accounts,
        {
          providerId: found.providerId,
          baseUrl: found.baseUrl,
          protocol: found.protocol,
          apiKey: "",
          // Catalogues always come from the provider itself, never from a
          // list hard-coded here that could be wrong or out of date.
          models: [],
        },
      ],
    });
    setSelectedId(found.providerId);
    setAdding("");
  };

  const removeProvider = (providerId: string) => {
    const accounts = settings.accounts.filter((item) => item.providerId !== providerId);
    onChange({
      ...settings,
      accounts,
      activeProviderId:
        settings.activeProviderId === providerId
          ? (accounts[0]?.providerId ?? "")
          : settings.activeProviderId,
    });
    setSelectedId(accounts[0]?.providerId ?? "");
  };

  return (
    <div className="manage-backdrop" onMouseDown={onClose}>
      <div className="manage-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="manage-header">
          <div>
            <h2>Manage models</h2>
            <p>Connect a provider, then pull its catalogue into the model picker.</p>
          </div>
          <button className="manage-close" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </header>

        <div className="manage-body">
          <aside className="manage-list">
            {settings.accounts.map((item) => {
              const info = providers.find((p) => p.providerId === item.providerId);
              const free = item.models.filter((model) => model.free).length;
              return (
                <button
                  key={item.providerId}
                  className={`manage-item ${item.providerId === selectedId ? "active" : ""}`}
                  onClick={() => setSelectedId(item.providerId)}
                >
                  <span className={`manage-dot ${item.apiKey || info?.local ? "on" : ""}`} />
                  <span className="manage-item-name">{info?.name ?? item.providerId}</span>
                  <span className="manage-item-count">
                    {item.models.length ? `${item.models.length}${free ? ` · ${free} free` : ""}` : "—"}
                  </span>
                </button>
              );
            })}

            <div className="manage-add">
              <select value={adding} onChange={(event) => addProvider(event.target.value)}>
                <option value="">Add provider…</option>
                {unconfigured.map((item) => (
                  <option key={item.providerId} value={item.providerId}>
                    {item.name}
                    {item.local ? " (local)" : ""}
                  </option>
                ))}
              </select>
              <Plus size={14} />
            </div>
          </aside>

          <section className="manage-detail">
            {account ? (
              <>
                <label>
                  Base URL
                  <input
                    value={account.baseUrl}
                    onChange={(event) =>
                      update(account.providerId, { baseUrl: event.target.value })
                    }
                    placeholder="https://api.provider.com/v1"
                  />
                </label>

                <label>
                  Protocol
                  <select
                    value={account.protocol}
                    onChange={(event) =>
                      update(account.providerId, {
                        protocol: event.target.value as ProviderAccount["protocol"],
                      })
                    }
                  >
                    {PROTOCOLS.map(([value, name]) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  API key {preset?.local ? "(not required for local servers)" : ""}
                  <input
                    type="password"
                    value={account.apiKey}
                    onChange={(event) => update(account.providerId, { apiKey: event.target.value })}
                    placeholder="••••••••"
                  />
                </label>

                {preset?.local ? (
                  <LocalModels
                    account={account}
                    activeModel={settings.activeModel}
                    onPick={(modelId) =>
                      onChange({
                        ...settings,
                        activeProviderId: account.providerId,
                        activeModel: modelId,
                      })
                    }
                  />
                ) : null}

                <div className="manage-actions">
                  <button
                    className="secondary-button"
                    onClick={() => onRefresh(account.providerId)}
                    disabled={busyProviderId === account.providerId}
                  >
                    <RefreshCw size={13} />
                    {busyProviderId === account.providerId ? "Fetching…" : "Fetch models"}
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => removeProvider(account.providerId)}
                    title="Remove provider"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>

                {preset?.note ? <div className="provider-note">{preset.note}</div> : null}

                <div className="manage-models">
                  <div className="manage-models-heading">
                    {account.models.length
                      ? `${account.models.length} model(s) cached`
                      : "No models cached yet"}
                  </div>
                  {account.models.slice(0, 60).map((model) => (
                    <button
                      key={model.id}
                      className={`manage-model ${
                        settings.activeProviderId === account.providerId &&
                        settings.activeModel === model.id
                          ? "active"
                          : ""
                      }`}
                      title={model.id}
                      onClick={() =>
                        onChange({
                          ...settings,
                          activeProviderId: account.providerId,
                          activeModel: model.id,
                        })
                      }
                    >
                      <span>{model.label}</span>
                      {model.free ? <span className="model-badge">Free</span> : null}
                    </button>
                  ))}
                </div>

                <label>
                  Model id (when the provider has no listing endpoint)
                  <input
                    value={settings.activeModel}
                    onChange={(event) =>
                      onChange({
                        ...settings,
                        activeProviderId: account.providerId,
                        activeModel: event.target.value,
                      })
                    }
                    placeholder="model-name"
                  />
                </label>
              </>
            ) : (
              <div className="manage-empty">Add a provider to get started.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
