import { useEffect, useState } from "react";
import { Download, HardDrive, RefreshCw, X } from "lucide-react";
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
const SUGGESTED_LOCAL = ["qwen2.5-coder:7b", "deepseek-coder-v2:16b", "llama3.1:8b"];

function formatBytes(bytes: number) {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/**
 * Models the local Ollama daemon already has, plus a way to pull new ones. The
 * daemon does the download, so this behaves the same wherever Ollama runs.
 */
function LocalModels({
  account,
  onPick,
}: {
  account: ProviderAccount;
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
        <span>
          {status?.reachable
            ? `${models.length} model(s) installed`
            : (status?.error ?? "Looking for Ollama…")}
        </span>
        <button className="link-button" onClick={() => void reload()}>
          <RefreshCw size={12} /> Rescan
        </button>
      </div>

      {!status?.reachable && status?.installHint ? (
        <div className="local-install">{status.installHint}</div>
      ) : null}

      {status?.reachable ? (
        <>
          {models.map((model) => (
            <button key={model.id} className="local-model" onClick={() => onPick(model.id)}>
              <HardDrive size={12} />
              <span>{model.id}</span>
              <span className="size">{formatBytes(model.size)}</span>
            </button>
          ))}

          <div className="local-pull">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim()) void pull(name.trim());
              }}
              placeholder="Download a model, e.g. qwen2.5-coder:7b"
              list="local-suggestions"
            />
            <datalist id="local-suggestions">
              {SUGGESTED_LOCAL.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <button
              className="secondary-button"
              disabled={!name.trim() || Boolean(progress)}
              onClick={() => void pull(name.trim())}
            >
              <Download size={12} /> {progress ? "…" : "Get"}
            </button>
          </div>

          {progress ? (
            <div className="local-progress">
              <span>
                {progress.status}
                {percent !== null ? ` ${percent}%` : ""}
              </span>
              <div className="local-bar">
                <span style={{ width: `${percent ?? 8}%` }} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <div className="hint error">{error}</div> : null}
    </div>
  );
}

/**
 * Deliberately small: pick a provider, paste a key, name a model. Everything
 * else (base URL, protocol, catalogue) comes from the provider preset or from
 * the provider itself.
 */
export function ManageModels({
  settings,
  providers,
  busyProviderId,
  onChange,
  onRefresh,
  onClose,
}: Props) {
  const selectedId = settings.activeProviderId || providers[0]?.providerId || "";
  const account = settings.accounts.find((item) => item.providerId === selectedId);
  const preset = providers.find((item) => item.providerId === selectedId);

  const selectProvider = (providerId: string) => {
    const found = providers.find((item) => item.providerId === providerId);
    if (!found) return;

    const existing = settings.accounts.find((item) => item.providerId === providerId);
    const accounts = existing
      ? settings.accounts
      : [
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
        ];

    onChange({
      ...settings,
      accounts,
      activeProviderId: providerId,
      activeModel: existing?.models[0]?.id ?? "",
    });
  };

  const setKey = (apiKey: string) => {
    onChange({
      ...settings,
      accounts: settings.accounts.map((item) =>
        item.providerId === selectedId ? { ...item, apiKey } : item,
      ),
    });
  };

  const free = account?.models.filter((model) => model.free).length ?? 0;

  return (
    <div className="manage-backdrop" onMouseDown={onClose}>
      <div className="manage-card" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>Manage models</h2>
          <button onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </header>

        <label>
          Provider
          <select value={selectedId} onChange={(event) => selectProvider(event.target.value)}>
            {providers.map((item) => (
              <option key={item.providerId} value={item.providerId}>
                {item.name}
                {item.local ? " · local" : ""}
              </option>
            ))}
          </select>
        </label>

        {preset?.local ? null : (
          <label>
            API key
            <input
              type="password"
              value={account?.apiKey ?? ""}
              onChange={(event) => setKey(event.target.value)}
              onBlur={() => account?.apiKey && onRefresh(selectedId)}
              placeholder="Paste your key"
            />
          </label>
        )}

        <label>
          Model
          <input
            value={settings.activeModel}
            onChange={(event) => onChange({ ...settings, activeModel: event.target.value })}
            placeholder="Model id, e.g. gpt-5.6"
            list="known-models"
          />
          <datalist id="known-models">
            {account?.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.free ? " (free)" : ""}
              </option>
            ))}
          </datalist>
        </label>

        <label>
          Helper model <span className="hint">— advisers, planner and reviewer</span>
          <input
            value={settings.helperModel ?? ""}
            onChange={(event) =>
              onChange({ ...settings, helperModel: event.target.value || undefined })
            }
            placeholder="Optional: a cheaper model for the easy calls"
            list="known-models"
          />
        </label>

        {preset?.local && account ? (
          <LocalModels
            account={account}
            onPick={(modelId) => onChange({ ...settings, activeModel: modelId })}
          />
        ) : (
          <div className="manage-foot">
            <span className="hint">
              {account?.models.length
                ? `${account.models.length} model(s)${free ? `, ${free} free` : ""}`
                : "No catalogue yet"}
            </span>
            <button
              className="secondary-button"
              onClick={() => onRefresh(selectedId)}
              disabled={busyProviderId === selectedId}
            >
              <RefreshCw size={12} />
              {busyProviderId === selectedId ? "Fetching…" : "Fetch models"}
            </button>
          </div>
        )}

        {preset?.note ? <div className="hint">{preset.note}</div> : null}
      </div>
    </div>
  );
}
