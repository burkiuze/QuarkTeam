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
  discoverModels: () => ipcRenderer.invoke("providers:models"),
  complete: (payload: unknown) => ipcRenderer.invoke("ai:complete", payload),
  runAgentic: (payload: unknown) => ipcRenderer.invoke("agent:run", payload),
  revertCheckpoint: (checkpointId: string) =>
    ipcRenderer.invoke("agent:revert", checkpointId),
  onAgentEvent: (listener: (event: unknown) => void) => {
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on("agent:event", wrapped);
    return () => ipcRenderer.removeListener("agent:event", wrapped);
  },
});
