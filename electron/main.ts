import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runAgenticTask } from "./agent-runtime.js";
import {
  discoverModels,
  providerComplete,
  PROVIDER_PRESETS,
  type ProviderSettings,
} from "./providers.js";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

let mainWindow: BrowserWindow | null = null;
let workspaceRoot: string | null = null;

const defaultSettings: ProviderSettings = {
  providerId: process.env.QUARK_PROVIDER || "opencode-zen",
  baseUrl: process.env.QUARK_BASE_URL || "https://opencode.ai/zen/v1",
  apiKey: process.env.QUARK_API_KEY || "",
  model: process.env.QUARK_MODEL || "muse-spark-1.3-contributor-free",
  protocol: (process.env.QUARK_PROTOCOL as ProviderSettings["protocol"]) || "openai-responses",
};

function settingsPath() {
  return path.join(app.getPath("userData"), "quarkcode-settings.json");
}

async function readSettings(): Promise<ProviderSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

async function saveSettings(next: ProviderSettings) {
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

async function walkDirectory(dir: string, depth = 0): Promise<FileNode[]> {
  if (depth > 8) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: FileNode[] = [];

  for (const entry of entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  })) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relative = path.relative(requireWorkspace(), full);

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relative,
        type: "directory",
        children: await walkDirectory(full, depth + 1),
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
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("workspace:open", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
      title: "Open project in QuarkCode",
    });
    if (result.canceled || !result.filePaths[0]) return null;
    workspaceRoot = result.filePaths[0];
    return workspaceRoot;
  });

  ipcMain.handle("workspace:tree", async () => {
    requireWorkspace();
    return walkDirectory(workspaceRoot!);
  });

  ipcMain.handle("workspace:read", async (_event, relativePath: string) => {
    return fs.readFile(safeWorkspacePath(relativePath), "utf8");
  });

  ipcMain.handle(
    "workspace:write",
    async (_event, relativePath: string, content: string) => {
      const target = safeWorkspacePath(relativePath);
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
      const { stdout, stderr } = await execAsync(command, {
        cwd: resolvedCwd,
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 4,
        env: process.env,
      });
      return { stdout, stderr };
    },
  );

  ipcMain.handle("settings:get", readSettings);
  ipcMain.handle("providers:list", async () => PROVIDER_PRESETS);

  ipcMain.handle(
    "settings:set",
    async (_event, next: ProviderSettings) => {
      const clean: ProviderSettings = {
        providerId: next.providerId?.trim() || "custom-openai",
        baseUrl: next.baseUrl.trim().replace(/\/+$/, ""),
        apiKey: next.apiKey.trim(),
        model: next.model.trim(),
        protocol: next.protocol,
        extraHeaders: next.extraHeaders ?? {},
      };
      await saveSettings(clean);
      return clean;
    },
  );

  ipcMain.handle("providers:models", async () => {
    return discoverModels(await readSettings());
  });

  ipcMain.handle(
    "ai:complete",
    async (
      _event,
      payload: { system: string; user: string; temperature?: number },
    ) => {
      const settings = await readSettings();
      if (!settings.apiKey && !["ollama", "lmstudio", "llamacpp"].includes(settings.providerId)) {
        throw new Error(
          "No provider credential configured. Open QuarkCode AI settings and connect your provider.",
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
      const settings = await readSettings();
      if (!settings.apiKey && !["ollama", "lmstudio", "llamacpp"].includes(settings.providerId)) {
        throw new Error("Connect an AI provider before starting Autopilot.");
      }
      if (!mainWindow) throw new Error("QuarkCode window is unavailable.");
      const result = await runAgenticTask({
        root,
        settings,
        goal: payload.goal,
        options: payload.options,
        window: mainWindow,
      });
      return result;
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
