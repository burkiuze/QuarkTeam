import type { BrowserWindow } from "electron";
import type { ModelInfo } from "./providers.js";

export type LocalModel = ModelInfo & {
  /** On-disk size in bytes, as reported by the daemon. */
  size: number;
  parameterSize?: string;
  quantization?: string;
};

export type OllamaStatus = {
  reachable: boolean;
  baseUrl: string;
  version?: string;
  error?: string;
  /** Shell command that installs the daemon on this platform, when known. */
  installHint?: string;
};

const DEFAULT_HOST = "http://127.0.0.1:11434";
const REQUEST_TIMEOUT_MS = 10_000;

/** Ollama's OpenAI-compatible base URL ends in /v1; its own API sits at the root. */
export function ollamaHost(baseUrl?: string) {
  const value = (baseUrl || DEFAULT_HOST).trim().replace(/\/+$/, "");
  return value.endsWith("/v1") ? value.slice(0, -3) : value;
}

function installHint(platform: NodeJS.Platform) {
  if (platform === "linux") return "curl -fsSL https://ollama.com/install.sh | sh";
  if (platform === "darwin") return "brew install ollama";
  return undefined;
}

export async function ollamaStatus(baseUrl?: string): Promise<OllamaStatus> {
  const host = ollamaHost(baseUrl);
  try {
    const response = await fetch(`${host}/api/version`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        reachable: false,
        baseUrl: host,
        error: `Ollama answered ${response.status}.`,
        installHint: installHint(process.platform),
      };
    }
    const data = (await response.json()) as any;
    return { reachable: true, baseUrl: host, version: String(data?.version ?? "") };
  } catch {
    return {
      reachable: false,
      baseUrl: host,
      error: "No Ollama daemon is listening. Start it with `ollama serve`.",
      installHint: installHint(process.platform),
    };
  }
}

/** Models already downloaded on this machine. */
export async function listLocalModels(baseUrl?: string): Promise<LocalModel[]> {
  const host = ollamaHost(baseUrl);
  const response = await fetch(`${host}/api/tags`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Ollama model listing failed (${response.status}).`);
  }

  const data = (await response.json()) as any;
  return (data?.models ?? [])
    .map((model: any): LocalModel => {
      const id = String(model?.name ?? model?.model ?? "");
      return {
        id,
        label: id,
        // A model already on disk costs nothing to run.
        free: true,
        size: Number(model?.size ?? 0),
        parameterSize: model?.details?.parameter_size,
        quantization: model?.details?.quantization_level,
      };
    })
    .filter((model: LocalModel) => model.id)
    .sort((a: LocalModel, b: LocalModel) => a.id.localeCompare(b.id));
}

export type PullProgress = {
  model: string;
  status: string;
  completed?: number;
  total?: number;
  done: boolean;
  error?: string;
};

/**
 * Downloads a model through the daemon and streams progress to the renderer.
 * The daemon does the work, so this behaves the same on every platform that
 * can run Ollama.
 */
export async function pullModel(
  window: BrowserWindow,
  model: string,
  baseUrl?: string,
): Promise<void> {
  const host = ollamaHost(baseUrl);
  const name = model.trim();
  if (!name) throw new Error("Enter a model name, for example qwen2.5-coder:7b.");

  const send = (progress: PullProgress) => {
    if (!window.isDestroyed()) window.webContents.send("ollama:progress", progress);
  };

  let response: Response;
  try {
    response = await fetch(`${host}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: name, stream: true }),
    });
  } catch (error) {
    const message = `Could not reach Ollama at ${host}: ${error instanceof Error ? error.message : String(error)}`;
    send({ model: name, status: message, done: true, error: message });
    throw new Error(message);
  }

  if (!response.ok || !response.body) {
    const message = `Ollama refused the pull (${response.status}). Check the model name.`;
    send({ model: name, status: message, done: true, error: message });
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastError: string | undefined;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // The daemon emits newline-delimited JSON.
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;

      try {
        const event = JSON.parse(line);
        if (event?.error) lastError = String(event.error);
        send({
          model: name,
          status: String(event?.status ?? "downloading"),
          completed: Number(event?.completed ?? 0) || undefined,
          total: Number(event?.total ?? 0) || undefined,
          done: false,
          error: event?.error ? String(event.error) : undefined,
        });
      } catch {
        // Ignore partial or malformed lines.
      }
    }
  }

  send({ model: name, status: lastError ?? "success", done: true, error: lastError });
  if (lastError) throw new Error(lastError);
}
