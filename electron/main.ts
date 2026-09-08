import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { restoreCheckpoint, runAgenticTask } from "./agent-runtime.js";
import { listLocalModels, ollamaStatus, pullModel } from "./ollama.js";
import {
  discoverModels,
  providerComplete,
  PROVIDER_PRESETS,
  type ModelInfo,
  type ProviderSettings,
} from "./providers.js";

/** One configured provider: credentials plus its cached model catalogue. */
type ProviderAccount = {
  providerId: string;
  baseUrl: string;
  protocol: ProviderSettings["protocol"];
  apiKey: string;
  models: ModelInfo[];
  extraHeaders?: Record<string, string>;
};

type QuarkSettings = {
  accounts: ProviderAccount[];
  activeProviderId: string;
  activeModel: string;
};

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

type ExecFailure = { stdout?: string; stderr?: string; message?: string };

let mainWindow: BrowserWindow | null = null;
let workspaceRoot: string | null = null;

const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio", "llamacpp"]);

function requiresApiKey(settings: ProviderSettings) {
  return !settings.apiKey && !LOCAL_PROVIDERS.has(settings.providerId);
}

/**
 * Minimal .env loader so the documented QUARK_* defaults actually apply during
 * development. Real environment variables always win over the file.
 */
async function loadEnvFile() {
  for (const candidate of [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "..", ".env"),
  ]) {
    let raw: string;
    try {
      raw = await fs.readFile(candidate, "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    return;
  }
}

function buildDefaultSettings(): QuarkSettings {
  const providerId = process.env.QUARK_PROVIDER || "opencode-zen";
  const preset = PROVIDER_PRESETS.find((item) => item.providerId === providerId);
  const ollama = PROVIDER_PRESETS.find((item) => item.providerId === "ollama");

  const accounts: ProviderAccount[] = [
    {
      providerId,
      baseUrl: process.env.QUARK_BASE_URL || preset?.baseUrl || "https://opencode.ai/zen/v1",
      protocol:
        (process.env.QUARK_PROTOCOL as ProviderSettings["protocol"]) ||
        preset?.protocol ||
        "openai-responses",
      apiKey: process.env.QUARK_API_KEY || "",
      models: [],
    },
  ];

  // Ollama ships configured so anything already downloaded on this machine
  // shows up in the picker without setup.
  if (ollama && providerId !== "ollama") {
    accounts.push({
      providerId: ollama.providerId,
      baseUrl: ollama.baseUrl,
      protocol: ollama.protocol,
      apiKey: "",
      models: [],
    });
  }

  return {
    accounts,
    activeProviderId: providerId,
    // Model ids are never guessed here; the picker fills in after discovery.
    activeModel: process.env.QUARK_MODEL || "",
  };
}

/** Collapses the multi-provider settings into the single account a run uses. */
function resolveActive(settings: QuarkSettings): ProviderSettings {
  const account =
    settings.accounts.find((item) => item.providerId === settings.activeProviderId) ??
    settings.accounts[0];
  if (!account) throw new Error("No AI provider is configured. Open Manage models.");
  return {
    providerId: account.providerId,
    baseUrl: account.baseUrl,
    apiKey: account.apiKey,
    model: settings.activeModel,
    protocol: account.protocol,
    extraHeaders: account.extraHeaders ?? {},
  };
}

function sanitizeAccount(input: any): ProviderAccount | null {
  const providerId = String(input?.providerId ?? "").trim();
  if (!providerId) return null;
  const preset = PROVIDER_PRESETS.find((item) => item.providerId === providerId);
  return {
    providerId,
    baseUrl: String(input?.baseUrl ?? preset?.baseUrl ?? "").trim().replace(/\/+$/, ""),
    protocol: input?.protocol ?? preset?.protocol ?? "openai-chat",
    apiKey: String(input?.apiKey ?? "").trim(),
    models: Array.isArray(input?.models)
      ? input.models
          .map((model: any) => ({
            id: String(model?.id ?? ""),
            label: String(model?.label ?? model?.id ?? ""),
            free: Boolean(model?.free),
          }))
          .filter((model: ModelInfo) => model.id)
      : [],
    extraHeaders: input?.extraHeaders ?? {},
  };
}

/** v0.3 stored one flat provider; keep those settings working. */
function migrate(stored: any): QuarkSettings | null {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  if (Array.isArray(stored.accounts)) {
    const accounts = stored.accounts.map(sanitizeAccount).filter(Boolean) as ProviderAccount[];
    if (!accounts.length) return null;
    return {
      accounts,
      activeProviderId: String(stored.activeProviderId ?? accounts[0].providerId),
      activeModel: String(stored.activeModel ?? ""),
    };
  }
  const legacy = sanitizeAccount(stored);
  if (!legacy) return null;
  return {
    accounts: [legacy],
    activeProviderId: legacy.providerId,
    activeModel: String(stored.model ?? ""),
  };
}

function settingsPath() {
  return path.join(app.getPath("userData"), "quarkcode-settings.json");
}

async function readSettings(): Promise<QuarkSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    return migrate(JSON.parse(raw)) ?? buildDefaultSettings();
  } catch {
    return buildDefaultSettings();
  }
}

async function saveSettings(next: QuarkSettings) {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), JSON.stringify(next, null, 2), "utf8");
}

function requireWorkspace() {
  if (!workspaceRoot) throw new Error("Open a workspace first.");
  return workspaceRoot;
}

function safeWorkspacePath(input: string) {
  const root = requireWorkspace();
  const resolved = path.resolve(root, input);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path is outside the opened workspace.");
  }
  return resolved;
}

function safeWorkspaceWritePath(input: string) {
  const resolved = safeWorkspacePath(input);
  const relative = path.relative(requireWorkspace(), resolved);
  if (
    relative
      .split(path.sep)
      .some((part) => part === ".git" || part === "node_modules")
  ) {
    throw new Error("Writes inside .git or node_modules are not allowed.");
  }
  return resolved;
}

const IGNORED = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-electron",
  "release",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
]);

async function walkDirectory(
  root: string,
  dir: string,
  depth = 0,
): Promise<FileNode[]> {
  if (depth > 8) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: FileNode[] = [];

  for (const entry of entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  })) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relative = path.relative(root, full);

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relative,
        type: "directory",
        children: await walkDirectory(root, full, depth + 1),
      });
    } else {
      result.push({ name: entry.name, path: relative, type: "file" });
    }
  }

  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: "#0a0a0b",
    // "hiddenInset" is macOS-only; on Windows/Linux it hides the window
    // controls and leaves the app impossible to close from its own frame.
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function requireWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("QuarkCode window is unavailable.");
  }
  return mainWindow;
}

app.whenReady().then(async () => {
  await loadEnvFile();

  ipcMain.handle("workspace:open", async () => {
    const result = await dialog.showOpenDialog(requireWindow(), {
      properties: ["openDirectory"],
      title: "Open project in QuarkCode",
    });
    if (result.canceled || !result.filePaths[0]) return null;
    workspaceRoot = result.filePaths[0];
    return workspaceRoot;
  });

  ipcMain.handle("workspace:tree", async () => {
    const root = requireWorkspace();
    return walkDirectory(root, root);
  });

  ipcMain.handle("workspace:read", async (_event, relativePath: string) => {
    return fs.readFile(safeWorkspacePath(relativePath), "utf8");
  });

  ipcMain.handle(
    "workspace:write",
    async (_event, relativePath: string, content: string) => {
      const target = safeWorkspaceWritePath(relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf8");
      return true;
    },
  );

  ipcMain.handle(
    "terminal:run",
    async (_event, command: string, cwd?: string) => {
      const root = requireWorkspace();
      const resolvedCwd = cwd ? safeWorkspacePath(cwd) : root;
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: resolvedCwd,
          timeout: 120_000,
          maxBuffer: 1024 * 1024 * 4,
          env: process.env,
        });
        return { stdout, stderr };
      } catch (error) {
        // A non-zero exit code is normal terminal output, not a crash: keep the
        // captured stdout/stderr instead of surfacing only "Command failed".
        const failure = error as ExecFailure;
        if (failure && (failure.stdout !== undefined || failure.stderr !== undefined)) {
          return {
            stdout: failure.stdout ?? "",
            stderr: failure.stderr || failure.message || "Command failed.",
          };
        }
        throw error;
      }
    },
  );

  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("providers:list", async () => PROVIDER_PRESETS);

  ipcMain.handle("settings:set", async (_event, next: QuarkSettings) => {
    const migrated = migrate(next);
    if (!migrated) throw new Error("Invalid provider settings payload.");
    await saveSettings(migrated);
    return migrated;
  });

  /**
   * Refreshes one provider's catalogue and stores it, so the model picker can
   * list every configured provider without a request per keystroke.
   */
  ipcMain.handle("providers:refresh", async (_event, providerId: string) => {
    const settings = await readSettings();
    const account = settings.accounts.find((item) => item.providerId === providerId);
    if (!account) throw new Error(`Provider ${providerId} is not configured.`);

    const models = await discoverModels({
      providerId: account.providerId,
      baseUrl: account.baseUrl,
      apiKey: account.apiKey,
      model: "",
      protocol: account.protocol,
      extraHeaders: account.extraHeaders,
    });

    account.models = models;
    await saveSettings(settings);
    return settings;
  });

  ipcMain.handle(
    "ai:complete",
    async (
      _event,
      payload: { system: string; user: string; temperature?: number },
    ) => {
      const settings = resolveActive(await readSettings());
      if (requiresApiKey(settings)) {
        throw new Error(
          "No provider credential configured. Open Manage models and connect your provider.",
        );
      }
      return providerComplete(settings, payload);
    },
  );

  ipcMain.handle(
    "agent:run",
    async (
      _event,
      payload: {
        goal: string;
        options?: {
          maxSteps?: number;
          mode?: "safe" | "full";
          quality?: "fast" | "team" | "swarm";
        };
      },
    ) => {
      const root = requireWorkspace();
      const settings = resolveActive(await readSettings());
      if (requiresApiKey(settings)) {
        throw new Error("Connect an AI provider before starting Autopilot.");
      }
      if (!settings.model) throw new Error("Pick a model before starting Autopilot.");
      const goal = payload?.goal?.trim();
      if (!goal) throw new Error("Describe what QuarkTeam should do.");
      return runAgenticTask({
        root,
        settings,
        goal,
        options: payload.options,
        window: requireWindow(),
      });
    },
  );

  ipcMain.handle("ollama:status", async (_event, baseUrl?: string) => ollamaStatus(baseUrl));

  /** Local models are whatever the daemon has already downloaded. */
  ipcMain.handle("ollama:list", async (_event, baseUrl?: string) => {
    const models = await listLocalModels(baseUrl);
    const settings = await readSettings();
    const account = settings.accounts.find((item) => item.providerId === "ollama");
    if (account) {
      account.models = models.map(({ id, label, free }) => ({ id, label, free }));
      await saveSettings(settings);
    }
    return models;
  });

  ipcMain.handle("ollama:pull", async (_event, model: string, baseUrl?: string) => {
    await pullModel(requireWindow(), model, baseUrl);
    return listLocalModels(baseUrl);
  });

  ipcMain.handle("agent:revert", async (_event, checkpointId: string) => {
    const root = requireWorkspace();
    return restoreCheckpoint(root, checkpointId);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
