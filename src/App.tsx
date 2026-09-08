import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Code2,
  File,
  Folder,
  FolderOpen,
  GitBranch,
  PanelBottom,
  Play,
  Save,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";
import type {
  AgentEvent,
  AgentRunState,
  FileNode,
  ProviderPreset,
  ProviderSettings,
  TeamMode,
} from "./types";
import { bridge, hasBridge } from "./lib/bridge";
import { agentRoster, runQuarkTeam } from "./lib/orchestrator";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function languageFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    py: "python",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    java: "java",
    go: "go",
    rs: "rust",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
  };
  return map[extension || ""] || "plaintext";
}

function flattenTree(nodes: FileNode[], depth = 0, output: string[] = []) {
  for (const node of nodes) {
    if (output.length >= 180) break;
    output.push(`${"  ".repeat(depth)}${node.type === "directory" ? "▸" : "•"} ${node.path}`);
    if (node.children) flattenTree(node.children, depth + 1, output);
  }
  return output;
}

function FileTree({
  nodes,
  activePath,
  onOpen,
  depth = 0,
}: {
  nodes: FileNode[];
  activePath?: string;
  onOpen: (node: FileNode) => void;
  depth?: number;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  return (
    <>
      {nodes.map((node) => {
        const isDirectory = node.type === "directory";
        const isClosed = closed[node.path];
        return (
          <div key={node.path}>
            <button
              className={`tree-row ${activePath === node.path ? "active" : ""}`}
              style={{ paddingLeft: 10 + depth * 14 }}
              onClick={() => {
                if (isDirectory) {
                  setClosed((prev) => ({ ...prev, [node.path]: !prev[node.path] }));
                } else {
                  onOpen(node);
                }
              }}
            >
              {isDirectory ? (
                isClosed ? <ChevronRight size={13} /> : <ChevronDown size={13} />
              ) : (
                <span className="tree-spacer" />
              )}
              {isDirectory ? <Folder size={14} /> : <File size={14} />}
              <span>{node.name}</span>
            </button>
            {isDirectory && !isClosed && node.children ? (
              <FileTree
                nodes={node.children}
                activePath={activePath}
                onOpen={onOpen}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [activePath, setActivePath] = useState<string>();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "QuarkCode terminal ready.",
  ]);
  const [terminalInput, setTerminalInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "QuarkTeam v0.2 is online. Autopilot can inspect, edit, test, review and repair your project. Open a folder and connect a model.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<TeamMode>("swarm");
  const [autopilot, setAutopilot] = useState(true);
  const [agentStates, setAgentStates] = useState<AgentRunState[]>(agentRoster("swarm"));
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [lastRun, setLastRun] = useState<{ checkpointId: string; files: string[] } | null>(null);
  const bridgeReady = useMemo(() => hasBridge(), []);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [providers, setProviders] = useState<ProviderPreset[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [settings, setSettings] = useState<ProviderSettings>({
    providerId: "opencode-zen",
    baseUrl: "https://opencode.ai/zen/v1",
    apiKey: "",
    model: "muse-spark-1.3-contributor-free",
    protocol: "openai-responses",
  });

  const dirty = content !== savedContent;

  useEffect(() => {
    if (!bridgeReady) return;
    const quark = bridge();

    Promise.all([quark.getSettings(), quark.listProviders()])
      .then(([stored, presets]) => {
        setSettings(stored);
        setProviders(presets);
      })
      .catch(() => undefined);

    return quark.onAgentEvent((event) => {
      setAgentEvents((prev) => [...prev.slice(-50), event]);
    });
  }, [bridgeReady]);

  useEffect(() => {
    setAgentStates(agentRoster(mode));
  }, [mode]);

  const workspaceName = useMemo(() => {
    if (!workspace) return "No folder open";
    return workspace.split(/[\\/]/).filter(Boolean).pop() || workspace;
  }, [workspace]);

  const providerName = useMemo(
    () => providers.find((item) => item.providerId === settings.providerId)?.name ?? settings.providerId,
    [providers, settings.providerId],
  );

  async function refreshWorkspace() {
    if (!workspace) return;
    const nextTree = await bridge().getTree();
    setTree(nextTree);
    if (activePath) {
      try {
        const next = await bridge().readFile(activePath);
        setContent(next);
        setSavedContent(next);
      } catch {
        setActivePath(undefined);
        setContent("");
        setSavedContent("");
      }
    }
  }

  async function openWorkspace() {
    try {
      const root = await bridge().openWorkspace();
      if (!root) return;
      setWorkspace(root);
      setTree(await bridge().getTree());
      setActivePath(undefined);
      setContent("");
      setSavedContent("");
      setAgentEvents([]);
      setLastRun(null);
    } catch (error) {
      setTerminalLines((prev) => [...prev, `error: ${describeError(error)}`]);
    }
  }

  async function openFile(node: FileNode) {
    try {
      const next = await bridge().readFile(node.path);
      setActivePath(node.path);
      setContent(next);
      setSavedContent(next);
    } catch (error) {
      setTerminalLines((prev) => [...prev, `error: ${describeError(error)}`]);
    }
  }

  const saveFile = useCallback(async () => {
    if (!activePath || content === savedContent) return;
    try {
      await bridge().writeFile(activePath, content);
      setSavedContent(content);
      setTerminalLines((prev) => [...prev, `saved ${activePath}`]);
    } catch (error) {
      setTerminalLines((prev) => [...prev, `error: ${describeError(error)}`]);
    }
  }, [activePath, content, savedContent]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  async function runTerminal() {
    const command = terminalInput.trim();
    if (!command || busy) return;
    setTerminalInput("");
    setTerminalLines((prev) => [...prev, `$ ${command}`]);
    try {
      const result = await bridge().runCommand(command);
      const output = `${result.stdout}${result.stderr}`.trim();
      setTerminalLines((prev) => [...prev, output || "(no output)"]);
      await refreshWorkspace();
    } catch (error) {
      setTerminalLines((prev) => [...prev, `error: ${describeError(error)}`]);
    }
  }

  function updateAgentState(next: AgentRunState) {
    setAgentStates((prev) => prev.map((item) => (item.id === next.id ? next : item)));
  }

  async function askTeam() {
    const goal = prompt.trim();
    if (!goal || busy) return;

    if (!bridgeReady) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: goal },
        {
          role: "assistant",
          content:
            "The QuarkCode desktop bridge is not available in this window, so there is no workspace to work on. Launch the Electron app with `npm run dev`.",
        },
      ]);
      setPrompt("");
      return;
    }

    if (!workspace) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: goal },
        { role: "assistant", content: "Open a project folder first so QuarkTeam can operate on a real workspace." },
      ]);
      setPrompt("");
      return;
    }

    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", content: goal }]);
    setBusy(true);
    setAgentEvents([]);
    setAgentStates(agentRoster(mode));

    try {
      if (autopilot) {
        const result = await bridge().runAgentic({
          goal,
          options: {
            quality: mode,
            mode: "safe",
            maxSteps: mode === "fast" ? 20 : mode === "team" ? 34 : 46,
          },
        });
        await refreshWorkspace();
        setLastRun(
          result.changedFiles.length
            ? { checkpointId: result.checkpointId, files: result.changedFiles }
            : null,
        );
        const changed = result.changedFiles.length
          ? `\n\nChanged: ${result.changedFiles.join(", ")}`
          : "\n\nNo files changed.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `${result.answer}${changed}` },
        ]);
      } else {
        const answer = await runQuarkTeam(
          goal,
          {
            rootName: workspaceName,
            tree: flattenTree(tree).join("\n"),
            activeFile: activePath,
            activeCode: content,
            terminal: terminalLines.slice(-30).join("\n"),
          },
          mode,
          updateAgentState,
        );
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `QuarkTeam stopped: ${describeError(error)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function chooseProvider(providerId: string) {
    const preset = providers.find((item) => item.providerId === providerId);
    if (!preset) return;
    setSettings((prev) => ({
      ...prev,
      providerId: preset.providerId,
      baseUrl: preset.baseUrl,
      protocol: preset.protocol,
      model: preset.defaultModel ?? preset.modelsHint?.[0] ?? prev.model,
    }));
    setModels(preset.modelsHint ?? []);
  }

  async function discoverProviderModels() {
    try {
      const saved = await bridge().setSettings(settings);
      setSettings(saved);
      const discovered = await bridge().discoverModels();
      setModels(discovered.slice(0, 300));
    } catch (error) {
      setTerminalLines((prev) => [...prev, `provider discovery: ${describeError(error)}`]);
    }
  }

  async function saveProviderSettings() {
    try {
      const saved = await bridge().setSettings(settings);
      setSettings(saved);
      setShowSettings(false);
    } catch (error) {
      setTerminalLines((prev) => [...prev, `provider settings: ${describeError(error)}`]);
    }
  }

  async function revertLastRun() {
    if (!lastRun || busy) return;
    setBusy(true);
    try {
      const result = await bridge().revertCheckpoint(lastRun.checkpointId);
      await refreshWorkspace();
      setLastRun(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Reverted ${result.restoredFiles.length} file(s) to the state before the last Autopilot run.`,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Revert failed: ${describeError(error)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="brand">
          <div className="brand-mark">Q</div>
          <span>QuarkCode</span>
        </div>
        <button className="workspace-button" onClick={openWorkspace}>
          <FolderOpen size={14} />
          <span>{workspaceName}</span>
        </button>
        <div className="titlebar-actions">
          <span className="model-chip">
            <Sparkles size={12} />
            {providerName} · {settings.model || "No model"}
          </span>
        </div>
      </header>

      <div className="workbench">
        <aside className="activitybar">
          <button className="activity active" title="Explorer"><File size={20} /></button>
          <button className="activity" title="Search"><Search size={20} /></button>
          <button className="activity" title="Source Control"><GitBranch size={20} /></button>
          <button className="activity" title="Run"><Play size={20} /></button>
          <div className="activity-spacer" />
          <button className="activity" title="Settings" onClick={() => setShowSettings(true)}>
            <Settings size={20} />
          </button>
        </aside>

        <aside className="explorer">
          <div className="panel-heading">
            <span>EXPLORER</span>
            <button onClick={openWorkspace} title="Open folder"><FolderOpen size={14} /></button>
          </div>
          <div className="explorer-project">{workspaceName.toUpperCase()}</div>
          <div className="tree-scroll">
            {tree.length ? (
              <FileTree nodes={tree} activePath={activePath} onOpen={openFile} />
            ) : (
              <div className="empty-panel">Open a folder to start.</div>
            )}
          </div>
        </aside>

        <main className="editor-column">
          <div className="editor-tabs">
            {activePath ? (
              <div className="editor-tab active">
                <Code2 size={13} />
                <span>{activePath.split(/[\\/]/).pop()}</span>
                {dirty ? <CircleDot size={10} /> : null}
                <button onClick={() => setActivePath(undefined)}><X size={12} /></button>
              </div>
            ) : (
              <div className="editor-tab ghost">Welcome</div>
            )}
            <div className="editor-tab-actions">
              <button onClick={() => void saveFile()} disabled={!dirty} title="Save">
                <Save size={15} />
              </button>
            </div>
          </div>

          <section className="editor-area">
            {activePath ? (
              <Editor
                height="100%"
                language={languageFromPath(activePath)}
                value={content}
                onChange={(value) => setContent(value ?? "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
                  fontLigatures: true,
                  smoothScrolling: true,
                  automaticLayout: true,
                  padding: { top: 14 },
                  renderLineHighlight: "all",
                  scrollBeyondLastLine: false,
                }}
              />
            ) : (
              <div className="welcome">
                <div className="welcome-mark">Q</div>
                <h1>QuarkCode</h1>
                <p>Agentic coding workbench: inspect, plan, edit, test, review and repair through one coordinated AI team.</p>
                <button className="primary-button" onClick={openWorkspace}>
                  <FolderOpen size={16} /> Open Project
                </button>
              </div>
            )}
          </section>

          <section className="terminal-panel">
            <div className="terminal-heading">
              <span><TerminalSquare size={14} /> TERMINAL</span>
              <PanelBottom size={14} />
            </div>
            <div className="terminal-output">
              {terminalLines.slice(-80).map((line, index) => (
                <div key={`${index}-${line.slice(0, 20)}`}>{line}</div>
              ))}
              <div className="terminal-input-row">
                <span>$</span>
                <input
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runTerminal();
                  }}
                  placeholder={workspace ? "run a command" : "open a workspace first"}
                  disabled={!workspace}
                />
              </div>
            </div>
          </section>
        </main>

        <aside className="ai-panel">
          <div className="ai-heading">
            <div>
              <div className="ai-title"><Bot size={16} /> QuarkTeam</div>
              <div className="ai-subtitle">agentic engineering crew · {providerName}</div>
            </div>
            <button onClick={() => setShowSettings((value) => !value)} title="AI settings">
              <Settings size={15} />
            </button>
          </div>

          {showSettings ? (
            <div className="settings-card">
              <label>
                Provider
                <select value={settings.providerId} onChange={(e) => chooseProvider(e.target.value)}>
                  {providers.map((provider) => (
                    <option value={provider.providerId} key={provider.providerId}>
                      {provider.name}{provider.local ? " · local" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Protocol
                <select
                  value={settings.protocol}
                  onChange={(e) => setSettings({ ...settings, protocol: e.target.value as ProviderSettings["protocol"] })}
                >
                  <option value="openai-responses">OpenAI Responses</option>
                  <option value="openai-chat">OpenAI Chat-compatible</option>
                  <option value="anthropic">Anthropic Messages</option>
                  <option value="gemini">Gemini generateContent</option>
                </select>
              </label>
              <label>
                Base URL
                <input
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  placeholder="https://api.provider.com/v1"
                />
              </label>
              <label>
                Model
                {models.length ? (
                  <select value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
                    {!models.includes(settings.model) ? <option value={settings.model}>{settings.model}</option> : null}
                    {models.map((model) => <option value={model} key={model}>{model}</option>)}
                  </select>
                ) : (
                  <input
                    value={settings.model}
                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                    placeholder="model-name"
                  />
                )}
              </label>
              <label>
                API key / token
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder="••••••••"
                />
              </label>
              <div className="settings-actions">
                <button className="secondary-button" onClick={() => void discoverProviderModels()}>
                  Discover models
                </button>
                <button className="primary-button compact" onClick={saveProviderSettings}>
                  Save provider
                </button>
              </div>
              {providers.find((p) => p.providerId === settings.providerId)?.note ? (
                <div className="provider-note">
                  {providers.find((p) => p.providerId === settings.providerId)?.note}
                </div>
              ) : null}
            </div>
          ) : null}

          {!bridgeReady ? (
            <div className="bridge-warning">
              <AlertTriangle size={14} />
              <span>
                Desktop bridge not detected. Run <code>npm run dev</code> and use the QuarkCode
                window; the browser tab cannot reach your workspace.
              </span>
            </div>
          ) : null}

          {lastRun ? (
            <div className="revert-row">
              <span>{lastRun.files.length} file(s) changed by Autopilot</span>
              <button onClick={() => void revertLastRun()} disabled={busy}>
                <RotateCcw size={13} /> Revert run
              </button>
            </div>
          ) : null}

          <div className="autopilot-row">
            <button className={autopilot ? "autopilot active" : "autopilot"} onClick={() => !busy && setAutopilot((v) => !v)}>
              <Play size={13} /> {autopilot ? "Safe Autopilot ON" : "Advisory chat"}
            </button>
            <span>{autopilot ? "can edit + test" : "no automatic edits"}</span>
          </div>

          <div className="mode-switcher">
            {(["fast", "team", "swarm"] as TeamMode[]).map((item) => (
              <button
                key={item}
                className={mode === item ? "active" : ""}
                onClick={() => !busy && setMode(item)}
              >
                {item === "fast" ? "Fast" : item === "team" ? "Team" : "Swarm"}
              </button>
            ))}
          </div>

          {autopilot ? (
            <div className="agent-trace">
              {agentEvents.length ? agentEvents.slice(-8).map((event, index) => (
                <div className={`trace-row ${event.type}`} key={`${event.ts}-${index}`}>
                  <span className="agent-dot" />
                  <div>
                    <strong>{event.label}</strong>
                    {event.detail ? <span>{event.detail.slice(0, 160)}</span> : null}
                  </div>
                </div>
              )) : <div className="trace-empty">Autopilot trace will appear here.</div>}
            </div>
          ) : (
            <div className="agent-strip">
              {agentStates.map((agent) => (
                <div className={`agent-row ${agent.status}`} key={agent.id}>
                  <span className="agent-dot" />
                  <span>{agent.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="chat-scroll">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={index}>
                <div className="message-role">{message.role === "assistant" ? "QUARK" : "YOU"}</div>
                <div className="message-content">{message.content}</div>
              </div>
            ))}
            {busy ? (
              <div className="thinking">
                <Sparkles size={14} />
                {autopilot ? "QuarkTeam is operating on the workspace…" : "QuarkTeam is reasoning…"}
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <div className="composer">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void askTeam();
                }
              }}
              placeholder={autopilot ? "Build, fix, refactor or test this project…" : "Ask QuarkTeam for engineering advice…"}
            />
            <div className="composer-footer">
              <span>{autopilot ? `Autopilot · ${mode}` : activePath ? `Context: ${activePath}` : "Workspace context"}</span>
              <button onClick={() => void askTeam()} disabled={busy || !prompt.trim()}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        <span><GitBranch size={12} /> workspace</span>
        <span>QuarkTeam {mode} · {autopilot ? "autopilot" : "advisory"}</span>
        <span className="status-right">UTF-8 &nbsp; QuarkCode 0.2 Agentic</span>
      </footer>
    </div>
  );
}

export default App;
