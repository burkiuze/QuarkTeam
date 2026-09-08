export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

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

/** One configured provider: credentials plus its cached model catalogue. */
export type ProviderAccount = {
  providerId: string;
  baseUrl: string;
  protocol: ProviderProtocol;
  apiKey: string;
  models: ModelInfo[];
  extraHeaders?: Record<string, string>;
};

export type LocalModel = ModelInfo & {
  size: number;
  parameterSize?: string;
  quantization?: string;
};

export type OllamaStatus = {
  reachable: boolean;
  baseUrl: string;
  version?: string;
  error?: string;
  installHint?: string;
};

export type PullProgress = {
  model: string;
  status: string;
  completed?: number;
  total?: number;
  done: boolean;
  error?: string;
};

export type QuarkSettings = {
  accounts: ProviderAccount[];
  activeProviderId: string;
  activeModel: string;
};

export type ProviderPreset = Omit<ProviderSettings, "apiKey" | "model"> & {
  name: string;
  defaultModel?: string;
  modelsHint?: string[];
  local?: boolean;
  note?: string;
};

export type AgentEvent = {
  runId: string;
  type: "phase" | "tool" | "result" | "warning" | "plan" | "done";
  label: string;
  detail?: string;
  ts: number;
};

export type PlanStep = {
  id: number;
  title: string;
  status: "pending" | "active" | "done" | "blocked";
};

export type AgenticResult = {
  runId: string;
  checkpointId: string;
  answer: string;
  changedFiles: string[];
  diff: string;
  plan: PlanStep[];
  /** null when the project exposes no automated checks. */
  verified: boolean | null;
};

export type QuarkBridge = {
  openWorkspace(): Promise<string | null>;
  getTree(): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<boolean>;
  runCommand(
    command: string,
    cwd?: string,
  ): Promise<{ stdout: string; stderr: string }>;
  getSettings(): Promise<QuarkSettings>;
  setSettings(settings: QuarkSettings): Promise<QuarkSettings>;
  listProviders(): Promise<ProviderPreset[]>;
  /** Re-reads one provider's catalogue and returns the updated settings. */
  refreshProvider(providerId: string): Promise<QuarkSettings>;
  complete(payload: {
    system: string;
    user: string;
    temperature?: number;
  }): Promise<string>;
  runAgentic(payload: {
    goal: string;
    options?: {
      maxSteps?: number;
      mode?: "safe" | "full";
      quality?: TeamMode;
    };
  }): Promise<AgenticResult>;
  revertCheckpoint(
    checkpointId: string,
  ): Promise<{ checkpointId: string; restoredFiles: string[] }>;
  ollamaStatus(baseUrl?: string): Promise<OllamaStatus>;
  listLocalModels(baseUrl?: string): Promise<LocalModel[]>;
  pullLocalModel(model: string, baseUrl?: string): Promise<LocalModel[]>;
  onPullProgress(listener: (progress: PullProgress) => void): () => void;
  onAgentEvent(listener: (event: AgentEvent) => void): () => void;
};

export type AgentStatus = "idle" | "running" | "done" | "error";

export type AgentRunState = {
  id: string;
  name: string;
  status: AgentStatus;
};

export type TeamMode = "fast" | "team" | "swarm";

export type WorkspaceContext = {
  rootName: string;
  tree: string;
  activeFile?: string;
  activeCode?: string;
  terminal?: string;
};
