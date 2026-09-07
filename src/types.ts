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

export type ProviderPreset = Omit<ProviderSettings, "apiKey" | "model"> & {
  name: string;
  defaultModel?: string;
  modelsHint?: string[];
  local?: boolean;
  note?: string;
};

export type AgentEvent = {
  runId: string;
  type: "phase" | "tool" | "result" | "warning" | "done";
  label: string;
  detail?: string;
  ts: number;
};

export type AgenticResult = {
  runId: string;
  checkpointId: string;
  answer: string;
  changedFiles: string[];
  diff: string;
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
  getSettings(): Promise<ProviderSettings>;
  setSettings(settings: ProviderSettings): Promise<ProviderSettings>;
  listProviders(): Promise<ProviderPreset[]>;
  discoverModels(): Promise<string[]>;
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
