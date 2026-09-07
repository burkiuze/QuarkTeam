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
    defaultModel: "muse-spark-1.3-contributor-free",
    modelsHint: ["muse-spark-1.3-contributor-free"],
    note: "Includes the current Muse Spark 1.3 Contributor Free route when your Zen account is eligible.",
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

function parseOpenAIChat(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

function parseOpenAIResponses(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  const chunks: string[] = [];
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

function parseAnthropic(data: any): string {
  if (!Array.isArray(data?.content)) return "";
  return data.content
    .map((part: any) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join("\n");
}

function parseGemini(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n");
}

export async function providerComplete(
  settings: ProviderSettings,
  payload: { system: string; user: string; temperature?: number },
): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, "");
  let url = "";
  let body: unknown;

  switch (settings.protocol) {
    case "openai-responses":
      url = `${base}/responses`;
      body = {
        model: settings.model,
        instructions: payload.system,
        input: payload.user,
        temperature: payload.temperature ?? 0.2,
      };
      break;
    case "anthropic":
      url = `${base}/messages`;
      body = {
        model: settings.model,
        max_tokens: 16_384,
        temperature: payload.temperature ?? 0.2,
        system: payload.system,
        messages: [{ role: "user", content: payload.user }],
      };
      break;
    case "gemini":
      if (!settings.apiKey) throw new Error("Google AI Studio requires an API key.");
      url = `${base}/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
      body = {
        systemInstruction: { parts: [{ text: payload.system }] },
        contents: [{ role: "user", parts: [{ text: payload.user }] }],
        generationConfig: { temperature: payload.temperature ?? 0.2 },
      };
      break;
    case "openai-chat":
    default:
      url = `${base}/chat/completions`;
      body = {
        model: settings.model,
        messages: [
          { role: "system", content: payload.system },
          { role: "user", content: payload.user },
        ],
        temperature: payload.temperature ?? 0.2,
      };
      break;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(settings),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `${settings.providerId} request failed (${response.status}): ${text.slice(0, 1200)}`,
    );
  }

  const data = await response.json();
  let text = "";
  if (settings.protocol === "openai-responses") text = parseOpenAIResponses(data);
  else if (settings.protocol === "anthropic") text = parseAnthropic(data);
  else if (settings.protocol === "gemini") text = parseGemini(data);
  else text = parseOpenAIChat(data);

  if (!text.trim()) throw new Error(`${settings.providerId} returned an empty response.`);
  return text;
}

export async function discoverModels(settings: ProviderSettings): Promise<string[]> {
  const base = settings.baseUrl.replace(/\/+$/, "");
  if (settings.protocol === "gemini") {
    if (!settings.apiKey) return [];
    const response = await fetch(`${base}/models?key=${encodeURIComponent(settings.apiKey)}`);
    if (!response.ok) return [];
    const data = await response.json() as any;
    return (data?.models ?? [])
      .map((model: any) => String(model?.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  }

  if (settings.protocol === "anthropic") return [];
  const response = await fetch(`${base}/models`, { headers: authHeaders(settings) });
  if (!response.ok) return [];
  const data = await response.json() as any;
  return (data?.data ?? []).map((model: any) => String(model?.id ?? "")).filter(Boolean);
}
