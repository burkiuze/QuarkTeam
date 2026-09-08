export type ProviderProtocol =
  | "openai-chat"
  | "openai-responses"
  | "anthropic"
  | "gemini";

export type ProviderSettings = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  protocol: ProviderProtocol;
  extraHeaders?: Record<string, string>;
};

export type ModelInfo = {
  id: string;
  label: string;
  free: boolean;
};

export type ProviderPreset = Omit<ProviderSettings, "apiKey" | "model"> & {
  name: string;
  defaultModel?: string;
  modelsHint?: string[];
  local?: boolean;
  note?: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    providerId: "opencode-zen",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    protocol: "openai-responses",
    // No model ids are hard-coded: which routes exist, and which of them are
    // free, is decided by the account and changes without a QuarkCode release.
    note: "Add your Zen key and press Fetch models. Routes the listing marks as free, or prices at zero, get a Free badge.",
  },
  {
    providerId: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai-responses",
  },
  {
    providerId: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    protocol: "anthropic",
  },
  {
    providerId: "google",
    name: "Google AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    protocol: "gemini",
  },
  {
    providerId: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "fireworks",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "huggingface",
    name: "Hugging Face Inference",
    baseUrl: "https://router.huggingface.co/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "moonshot",
    name: "Moonshot / Kimi",
    baseUrl: "https://api.moonshot.ai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "zai",
    name: "Z.AI / GLM",
    baseUrl: "https://api.z.ai/api/paas/v4",
    protocol: "openai-chat",
  },
  {
    providerId: "dashscope",
    name: "Alibaba DashScope / Qwen",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "nvidia",
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "nebius",
    name: "Nebius AI Studio",
    baseUrl: "https://api.studio.nebius.ai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "siliconflow",
    name: "SiliconFlow",
    baseUrl: "https://api.siliconflow.com/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "sambanova",
    name: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    protocol: "openai-chat",
  },
  {
    providerId: "ollama",
    name: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    protocol: "openai-chat",
    local: true,
  },
  {
    providerId: "lmstudio",
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    protocol: "openai-chat",
    local: true,
  },
  {
    providerId: "llamacpp",
    name: "llama.cpp server",
    baseUrl: "http://127.0.0.1:8080/v1",
    protocol: "openai-chat",
    local: true,
  },
  {
    providerId: "custom-openai",
    name: "Custom OpenAI-compatible",
    baseUrl: "http://127.0.0.1:8000/v1",
    protocol: "openai-chat",
  },
];

export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text?: string; toolCalls?: ToolCall[] }
  | { role: "tool"; callId: string; name: string; text: string };

export type ConverseResult = {
  text: string;
  toolCalls: ToolCall[];
  /** True when the tool calls came from the provider's own function calling. */
  native: boolean;
};

const COMPLETION_TIMEOUT_MS = 300_000;
const DISCOVERY_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

/**
 * Endpoints disagree about which optional request fields they accept: some
 * reject `temperature`, some have no function calling at all. Rather than
 * hard-coding a matrix per provider, the first rejection is remembered and the
 * request is retried without that field.
 */
type Capabilities = { tools: boolean; temperature: boolean };
const CAPABILITIES = new Map<string, Capabilities>();

function capabilityKey(settings: ProviderSettings) {
  return `${settings.providerId}::${settings.baseUrl}::${settings.model}`;
}

function capabilities(settings: ProviderSettings): Capabilities {
  const key = capabilityKey(settings);
  let value = CAPABILITIES.get(key);
  if (!value) {
    value = { tools: true, temperature: true };
    CAPABILITIES.set(key, value);
  }
  return value;
}

function authHeaders(settings: ProviderSettings) {
  const extra = settings.extraHeaders ?? {};
  if (settings.protocol === "anthropic") {
    return {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      ...extra,
    };
  }

  if (settings.protocol === "gemini") {
    return { "content-type": "application/json", ...extra };
  }

  return {
    "content-type": "application/json",
    ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    ...extra,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

function retryDelay(response: Response | undefined, attempt: number) {
  const header = response?.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 30_000);
  }
  // Exponential backoff with jitter: 1s, 2s, 4s (+/- 250ms).
  return 2 ** (attempt - 1) * 1000 + Math.random() * 500 - 250;
}

/** POSTs JSON and retries rate limits, gateway errors and transport failures. */
async function postJson(
  settings: ProviderSettings,
  url: string,
  body: unknown,
): Promise<any> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response | undefined;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: authHeaders(settings),
        body: JSON.stringify(body),
        // Without a deadline a stalled connection freezes the whole agent loop.
        signal: AbortSignal.timeout(COMPLETION_TIMEOUT_MS),
      });
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "TimeoutError"
          ? new Error(
              `${settings.providerId} did not respond within ${COMPLETION_TIMEOUT_MS / 1000}s.`,
            )
          : new Error(
              `${settings.providerId} request failed: ${error instanceof Error ? error.message : String(error)}`,
            );
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(retryDelay(undefined, attempt));
      continue;
    }

    if (response.ok) return response.json();

    const text = await response.text();
    lastError = new ProviderHttpError(
      response.status,
      text,
      `${settings.providerId} request failed (${response.status}): ${text.slice(0, 1200)}`,
    );

    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) throw lastError;
    await sleep(retryDelay(response, attempt));
  }

  throw lastError instanceof Error ? lastError : new Error("Provider request failed.");
}

function rejects(error: unknown, field: "tools" | "temperature") {
  if (!(error instanceof ProviderHttpError)) return false;
  if (error.status !== 400 && error.status !== 404 && error.status !== 422) return false;
  const body = error.body.toLowerCase();
  return field === "temperature"
    ? body.includes("temperature")
    : body.includes("tool") || body.includes("function");
}

function toolCallId(name: string, index: number) {
  return `${name}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseToolArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

function buildChatBody(
  settings: ProviderSettings,
  system: string,
  messages: AgentMessage[],
  tools: ToolSpec[] | undefined,
  temperature: number | undefined,
) {
  const mapped: unknown[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "user") {
      mapped.push({ role: "user", content: message.text });
    } else if (message.role === "assistant") {
      mapped.push({
        role: "assistant",
        content: message.text ?? "",
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.args) },
              })),
            }
          : {}),
      });
    } else {
      mapped.push({ role: "tool", tool_call_id: message.callId, content: message.text });
    }
  }

  return {
    model: settings.model,
    messages: mapped,
    ...(temperature === undefined ? {} : { temperature }),
    ...(tools?.length
      ? {
          tools: tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
          tool_choice: "auto",
        }
      : {}),
  };
}

function buildResponsesBody(
  settings: ProviderSettings,
  system: string,
  messages: AgentMessage[],
  tools: ToolSpec[] | undefined,
  temperature: number | undefined,
) {
  const input: unknown[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      input.push({ role: "user", content: [{ type: "input_text", text: message.text }] });
    } else if (message.role === "assistant") {
      if (message.text) {
        input.push({ role: "assistant", content: [{ type: "output_text", text: message.text }] });
      }
      for (const call of message.toolCalls ?? []) {
        input.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.args),
        });
      }
    } else {
      input.push({ type: "function_call_output", call_id: message.callId, output: message.text });
    }
  }

  return {
    model: settings.model,
    instructions: system,
    input,
    ...(temperature === undefined ? {} : { temperature }),
    ...(tools?.length
      ? {
          tools: tools.map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
          tool_choice: "auto",
        }
      : {}),
  };
}

function buildAnthropicBody(
  settings: ProviderSettings,
  system: string,
  messages: AgentMessage[],
  tools: ToolSpec[] | undefined,
  temperature: number | undefined,
) {
  const mapped: Array<{ role: "user" | "assistant"; content: unknown[] }> = [];

  for (const message of messages) {
    if (message.role === "assistant") {
      const content: unknown[] = [];
      if (message.text) content.push({ type: "text", text: message.text });
      for (const call of message.toolCalls ?? []) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.args });
      }
      mapped.push({ role: "assistant", content });
      continue;
    }

    const block =
      message.role === "user"
        ? { type: "text", text: message.text }
        : { type: "tool_result", tool_use_id: message.callId, content: message.text };

    // Consecutive tool results have to share one user turn.
    const last = mapped[mapped.length - 1];
    if (last?.role === "user") last.content.push(block);
    else mapped.push({ role: "user", content: [block] });
  }

  return {
    model: settings.model,
    max_tokens: 16_384,
    system,
    messages: mapped,
    ...(temperature === undefined ? {} : { temperature }),
    ...(tools?.length
      ? {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters,
          })),
        }
      : {}),
  };
}

function buildGeminiBody(
  system: string,
  messages: AgentMessage[],
  tools: ToolSpec[] | undefined,
  temperature: number | undefined,
) {
  const contents: unknown[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.text }] });
    } else if (message.role === "assistant") {
      const parts: unknown[] = [];
      if (message.text) parts.push({ text: message.text });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      contents.push({ role: "model", parts });
    } else {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: message.name, response: { result: message.text } } }],
      });
    }
  }

  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    ...(temperature === undefined ? {} : { generationConfig: { temperature } }),
    ...(tools?.length
      ? {
          tools: [
            {
              functionDeclarations: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              })),
            },
          ],
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Response parsers
// ---------------------------------------------------------------------------

function parseChat(data: any): ConverseResult {
  const message = data?.choices?.[0]?.message;
  const content = message?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("");
  }

  const toolCalls: ToolCall[] = (message?.tool_calls ?? [])
    .filter((call: any) => call?.function?.name)
    .map((call: any, index: number) => ({
      id: String(call.id ?? toolCallId(call.function.name, index)),
      name: String(call.function.name),
      args: parseToolArgs(call.function.arguments),
    }));

  return { text, toolCalls, native: toolCalls.length > 0 };
}

function parseResponses(data: any): ConverseResult {
  const answer: string[] = [];
  const fallback: string[] = [];
  const toolCalls: ToolCall[] = [];

  if (Array.isArray(data?.output)) {
    data.output.forEach((item: any, index: number) => {
      if (item?.type === "function_call" && item?.name) {
        toolCalls.push({
          id: String(item.call_id ?? item.id ?? toolCallId(item.name, index)),
          name: String(item.name),
          args: parseToolArgs(item.arguments),
        });
        return;
      }
      // Reasoning items also carry "text" parts. Mixing them into the answer
      // corrupts the strict JSON action protocol used as a fallback.
      const isReasoning = item?.type === "reasoning";
      if (!Array.isArray(item?.content)) return;
      for (const part of item.content) {
        if (typeof part?.text !== "string") continue;
        if (!isReasoning && (part.type === "output_text" || part.type === undefined)) {
          answer.push(part.text);
        } else {
          fallback.push(part.text);
        }
      }
    });
  }

  let text = (answer.length ? answer : fallback).join("\n");
  if (!text.trim() && typeof data?.output_text === "string") text = data.output_text;
  return { text, toolCalls, native: toolCalls.length > 0 };
}

function parseAnthropicResult(data: any): ConverseResult {
  const text: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const part of Array.isArray(data?.content) ? data.content : []) {
    if (part?.type === "text" && typeof part.text === "string") text.push(part.text);
    else if (part?.type === "tool_use" && part?.name) {
      toolCalls.push({
        id: String(part.id ?? toolCallId(part.name, toolCalls.length)),
        name: String(part.name),
        args: parseToolArgs(part.input),
      });
    }
  }

  return { text: text.join("\n"), toolCalls, native: toolCalls.length > 0 };
}

function parseGeminiResult(data: any): ConverseResult {
  const parts = data?.candidates?.[0]?.content?.parts;
  const text: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const part of Array.isArray(parts) ? parts : []) {
    if (typeof part?.text === "string") text.push(part.text);
    else if (part?.functionCall?.name) {
      toolCalls.push({
        id: toolCallId(String(part.functionCall.name), toolCalls.length),
        name: String(part.functionCall.name),
        args: parseToolArgs(part.functionCall.args),
      });
    }
  }

  return { text: text.join("\n"), toolCalls, native: toolCalls.length > 0 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function endpoint(settings: ProviderSettings) {
  const base = settings.baseUrl.replace(/\/+$/, "");
  switch (settings.protocol) {
    case "openai-responses":
      return `${base}/responses`;
    case "anthropic":
      return `${base}/messages`;
    case "gemini":
      if (!settings.apiKey) throw new Error("Google AI Studio requires an API key.");
      return `${base}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
    default:
      return `${base}/chat/completions`;
  }
}

function assertConfigured(settings: ProviderSettings) {
  if (!settings.baseUrl?.trim()) {
    throw new Error("No base URL configured. Pick a provider in QuarkCode AI settings.");
  }
  if (!settings.model?.trim()) {
    throw new Error("No model configured. Pick or type a model in QuarkCode AI settings.");
  }
}

/**
 * One model turn. When `tools` are supplied the provider's native function
 * calling is used; endpoints that reject it are remembered and fall back to the
 * caller's text protocol for the rest of the session.
 */
export async function providerConverse(
  settings: ProviderSettings,
  payload: {
    system: string;
    messages: AgentMessage[];
    tools?: ToolSpec[];
    temperature?: number;
  },
): Promise<ConverseResult> {
  assertConfigured(settings);
  const caps = capabilities(settings);
  const url = endpoint(settings);

  const send = async (useTools: boolean, useTemperature: boolean) => {
    const tools = useTools ? payload.tools : undefined;
    const temperature = useTemperature ? (payload.temperature ?? 0.2) : undefined;
    switch (settings.protocol) {
      case "openai-responses":
        return parseResponses(
          await postJson(
            settings,
            url,
            buildResponsesBody(settings, payload.system, payload.messages, tools, temperature),
          ),
        );
      case "anthropic":
        return parseAnthropicResult(
          await postJson(
            settings,
            url,
            buildAnthropicBody(settings, payload.system, payload.messages, tools, temperature),
          ),
        );
      case "gemini":
        return parseGeminiResult(
          await postJson(
            settings,
            url,
            buildGeminiBody(payload.system, payload.messages, tools, temperature),
          ),
        );
      default:
        return parseChat(
          await postJson(
            settings,
            url,
            buildChatBody(settings, payload.system, payload.messages, tools, temperature),
          ),
        );
    }
  };

  const wantsTools = Boolean(payload.tools?.length) && caps.tools;

  try {
    return await send(wantsTools, caps.temperature);
  } catch (error) {
    if (caps.temperature && rejects(error, "temperature")) {
      caps.temperature = false;
      return providerConverse(settings, payload);
    }
    if (wantsTools && rejects(error, "tools")) {
      caps.tools = false;
      return providerConverse(settings, payload);
    }
    throw error;
  }
}

/** True once an endpoint has rejected native function calling. */
export function usesNativeTools(settings: ProviderSettings) {
  return capabilities(settings).tools;
}

export async function providerComplete(
  settings: ProviderSettings,
  payload: { system: string; user: string; temperature?: number },
): Promise<string> {
  const result = await providerConverse(settings, {
    system: payload.system,
    messages: [{ role: "user", text: payload.user }],
    temperature: payload.temperature,
  });
  if (!result.text.trim()) {
    throw new Error(`${settings.providerId} returned an empty response.`);
  }
  return result.text;
}

const FREE_HINTS = ["free", "contributor", "no-cost", "trial"];

/**
 * Providers advertise a free tier in two ways: a marker in the model id, or a
 * zero price in the listing. Both are checked so the picker can label them.
 */
export function isFreeModel(model: any): boolean {
  const id = String(model?.id ?? model ?? "").toLowerCase();
  if (FREE_HINTS.some((hint) => id.includes(hint))) return true;

  const pricing = model?.pricing ?? model?.cost ?? model?.price;
  if (pricing && typeof pricing === "object") {
    const values = [
      pricing.prompt,
      pricing.completion,
      pricing.input,
      pricing.output,
      pricing.input_per_million,
      pricing.output_per_million,
    ]
      .filter((value) => value !== undefined && value !== null)
      .map(Number)
      .filter((value) => Number.isFinite(value));
    if (values.length && values.every((value) => value === 0)) return true;
  }

  if (model?.free === true || model?.is_free === true) return true;
  return false;
}

const KEEP_UPPER = new Set(["ai", "gpt", "llm", "vl", "moe", "hd", "xl", "nim", "glm", "r1", "v2", "v3"]);

/** "muse-spark-1.3-contributor-free" -> "Muse Spark 1.3 Contributor Free" */
export function modelLabel(id: string) {
  const tail = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return (
    tail
      .split(/[-_.\s]+/)
      .filter(Boolean)
      .map((part) => {
        if (/^\d+(\.\d+)?$/.test(part)) return part;
        if (KEEP_UPPER.has(part.toLowerCase())) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ") || id
  );
}

export async function discoverModels(settings: ProviderSettings): Promise<ModelInfo[]> {
  if (!settings.baseUrl?.trim()) {
    throw new Error("Set a base URL before discovering models.");
  }
  const base = settings.baseUrl.replace(/\/+$/, "");

  if (settings.protocol === "gemini" && !settings.apiKey) {
    throw new Error("Google AI Studio requires an API key to list models.");
  }

  const url =
    settings.protocol === "gemini"
      ? `${base}/models?key=${encodeURIComponent(settings.apiKey)}`
      : `${base}/models`;

  let response: Response;
  try {
    // Anthropic exposes GET /v1/models with the same x-api-key auth, so every
    // protocol except Gemini uses the standard listing endpoint.
    response = await fetch(url, {
      headers: settings.protocol === "gemini" ? undefined : authHeaders(settings),
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError" ? "timed out" : String(error);
    throw new Error(`Could not reach ${base}/models (${reason}).`);
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 240);
    throw new Error(
      `${settings.providerId} model listing failed (${response.status}). ${body || "This endpoint may not expose /models; type the model name instead."}`,
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${settings.providerId} returned a non-JSON model list.`);
  }

  const raw: any[] =
    settings.protocol === "gemini"
      ? (data?.models ?? []).map((model: any) => ({
          ...model,
          id: String(model?.name ?? "").replace(/^models\//, ""),
        }))
      : (data?.data ?? data?.models ?? []);

  const seen = new Set<string>();
  return raw
    .map((model) => {
      const id = String(model?.id ?? model ?? "");
      return { id, label: modelLabel(id), free: isFreeModel(model) };
    })
    .filter((model) => model.id && !seen.has(model.id) && seen.add(model.id))
    .sort((a, b) => (a.free === b.free ? a.label.localeCompare(b.label) : a.free ? -1 : 1));
}
