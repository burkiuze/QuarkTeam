import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("quark", {
  openWorkspace: () => ipcRenderer.invoke("workspace:open"),
  getTree: () => ipcRenderer.invoke("workspace:tree"),
  readFile: (path: string) => ipcRenderer.invoke("workspace:read", path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke("workspace:write", path, content),
  runCommand: (command: string, cwd?: string) =>
    ipcRenderer.invoke("terminal:run", command, cwd),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: unknown) => ipcRenderer.invoke("settings:set", settings),
  listProviders: () => ipcRenderer.invoke("providers:list"),
  refreshProvider: (providerId: string) =>
    ipcRenderer.invoke("providers:refresh", providerId),
  complete: (payload: unknown) => ipcRenderer.invoke("ai:complete", payload),
  runAgentic: (payload: unknown) => ipcRenderer.invoke("agent:run", payload),
  revertCheckpoint: (checkpointId: string) =>
    ipcRenderer.invoke("agent:revert", checkpointId),
  ollamaStatus: (baseUrl?: string) => ipcRenderer.invoke("ollama:status", baseUrl),
  listLocalModels: (baseUrl?: string) => ipcRenderer.invoke("ollama:list", baseUrl),
  pullLocalModel: (model: string, baseUrl?: string) =>
    ipcRenderer.invoke("ollama:pull", model, baseUrl),
  onPullProgress: (listener: (progress: unknown) => void) => {
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on("ollama:progress", wrapped);
    return () => ipcRenderer.removeListener("ollama:progress", wrapped);
  },
  onAgentEvent: (listener: (event: unknown) => void) => {
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on("agent:event", wrapped);
    return () => ipcRenderer.removeListener("agent:event", wrapped);
  },
});
