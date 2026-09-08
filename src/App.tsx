import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  AlertTriangle,
  ArrowUp,
  FolderOpen,
  Plus,
  RotateCcw,
  SquarePen,
  X,
} from "lucide-react";
import type {
  AgentEvent,
  Effort,
  FileNode,
  ProviderPreset,
  QuarkSettings,
  TeamMode,
  TokenUsage,
} from "./types";
import { bridge, hasBridge } from "./lib/bridge";
import { runQuarkTeam } from "./lib/orchestrator";
import { Activity } from "./components/Activity";
import { EffortControl, effortColour } from "./components/EffortControl";
import { ManageModels } from "./components/ManageModels";
import { ModelPicker } from "./components/ModelPicker";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  files?: string[];
};

type Session = {
  id: string;
  title: string;
  messages: ChatMessage[];
  events: AgentEvent[];
  plan: string[];
  lastRun: { checkpointId: string; files: string[] } | null;
  usage: TokenUsage | null;
  startedAt: number | null;
  finishedAt: number | null;
};

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

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
    mjs: "javascript",
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

function newSession(index: number): Session {
  return {
    id: `s${Date.now().toString(36)}${index}`,
    title: "New session",
    messages: [],
    events: [],
    plan: [],
    lastRun: null,
    usage: null,
    startedAt: null,
    finishedAt: null,
  };
}

function App() {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [sessions, setSessions] = useState<Session[]>([newSession(0)]);
  const [activeId, setActiveId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [effort, setEffort] = useState<Effort>("high");
  const [autopilot, setAutopilot] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderPreset[]>([]);
  const [settings, setSettings] = useState<QuarkSettings>({
    accounts: [],
    activeProviderId: "",
    activeModel: "",
  });
  const [viewer, setViewer] = useState<{ path: string; content: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bridgeReady = useMemo(() => hasBridge(), []);
  const endRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef(activeId);

  const session = sessions.find((item) => item.id === activeId) ?? sessions[0];
  const usage = session?.usage ?? null;

  const patchSession = useCallback((id: string, patch: (current: Session) => Session) => {
    setSessions((prev) => prev.map((item) => (item.id === id ? patch(item) : item)));
  }, []);

  useEffect(() => {
    if (!activeId && sessions[0]) setActiveId(sessions[0].id);
  }, [activeId, sessions]);

  // The agent-event listener is installed once, so it reads the live session id.
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!bridgeReady) return;
    const quark = bridge();

    Promise.all([quark.getSettings(), quark.listProviders()])
      .then(async ([stored, presets]) => {
        setSettings(stored);
        setProviders(presets);

        // Pull each reachable provider's catalogue once, so the picker offers
        // what the account can actually use rather than a build-time guess.
        for (const account of stored.accounts) {
          const preset = presets.find((item) => item.providerId === account.providerId);
          if (account.models.length) continue;
          try {
            if (preset?.local) {
              await quark.listLocalModels(account.baseUrl);
              setSettings(await quark.getSettings());
            } else if (account.apiKey) {
              setSettings(await quark.refreshProvider(account.providerId));
            }
          } catch {
            // A provider that cannot list models is still usable by typing an id.
          }
        }
      })
      .catch(() => undefined);

    return quark.onAgentEvent((event) => {
      setSessions((prev) =>
        prev.map((item) =>
          item.id === activeIdRef.current
            ? {
                ...item,
                events: [...item.events.slice(-60), event],
                plan:
                  event.type === "plan" && event.detail
                    ? event.detail.split("\n").filter(Boolean)
                    : item.plan,
              }
            : item,
        ),
      );
    });
  }, [bridgeReady]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [session?.messages, busy]);

  const providerName = useMemo(
    () =>
      providers.find((item) => item.providerId === settings.activeProviderId)?.name ??
      settings.activeProviderId,
    [providers, settings.activeProviderId],
  );

  const workspaceName = useMemo(() => {
    if (!workspace) return "No project";
    return workspace.split(/[\\/]/).filter(Boolean).pop() || workspace;
  }, [workspace]);

  async function openWorkspace() {
    try {
      const root = await bridge().openWorkspace();
      if (!root) return;
      setWorkspace(root);
      setTree(await bridge().getTree());
    } catch (error) {
      setNotice(describeError(error));
    }
  }

  async function openFile(path: string) {
    try {
      setViewer({ path, content: await bridge().readFile(path) });
    } catch (error) {
      setNotice(describeError(error));
    }
  }

  async function persistSettings(next: QuarkSettings) {
    setSettings(next);
    try {
      setSettings(await bridge().setSettings(next));
    } catch (error) {
      setNotice(describeError(error));
    }
  }

  function selectModel(providerId: string, modelId: string) {
    void persistSettings({ ...settings, activeProviderId: providerId, activeModel: modelId });
  }

  /** Pulls a provider's catalogue so the picker lists what it really offers. */
  async function refreshProvider(providerId: string) {
    setRefreshing(providerId);
    try {
      await bridge().setSettings(settings);
      const preset = providers.find((item) => item.providerId === providerId);
      if (preset?.local) {
        const account = settings.accounts.find((item) => item.providerId === providerId);
        await bridge().listLocalModels(account?.baseUrl);
        setSettings(await bridge().getSettings());
      } else {
        setSettings(await bridge().refreshProvider(providerId));
      }
    } catch (error) {
      setNotice(`${providerId}: ${describeError(error)}`);
    } finally {
      setRefreshing(null);
    }
  }

  async function send() {
    const goal = prompt.trim();
    if (!goal || busy || !session) return;

    if (!bridgeReady) {
      setNotice("Desktop bridge unavailable. Launch QuarkCode with `npm run dev`.");
      return;
    }
    if (!workspace) {
      setNotice("Open a project first so the crew has a workspace to work in.");
      return;
    }

    setPrompt("");
    const id = session.id;
    patchSession(id, (current) => ({
      ...current,
      title: current.messages.length ? current.title : goal.slice(0, 42),
      messages: [...current.messages, { role: "user", content: goal }],
      events: [],
      plan: [],
      startedAt: Date.now(),
      finishedAt: null,
    }));
    setBusy(true);

    try {
      if (autopilot) {
        const result = await bridge().runAgentic({ goal, options: { mode: "safe", effort } });
        setTree(await bridge().getTree());
        const verified =
          result.verified === true
            ? "Checks passed."
            : result.verified === false
              ? "Checks FAILED - review the diff before trusting this run."
              : "";
        patchSession(id, (current) => ({
          ...current,
          usage: current.usage
            ? {
                input: current.usage.input + result.usage.input,
                output: current.usage.output + result.usage.output,
                cached: current.usage.cached + result.usage.cached,
              }
            : result.usage,
          lastRun: result.changedFiles.length
            ? { checkpointId: result.checkpointId, files: result.changedFiles }
            : null,
          messages: [
            ...current.messages,
            {
              role: "assistant",
              content: verified ? `${result.answer}\n\n${verified}` : result.answer,
              files: result.changedFiles,
            },
          ],
        }));
      } else {
        const advisoryMode: TeamMode =
          effort === "economic" || effort === "medium"
            ? "fast"
            : effort === "high" || effort === "extra"
              ? "team"
              : "swarm";
        const answer = await runQuarkTeam(
          goal,
          { rootName: workspaceName, tree: flattenTree(tree).join("\n") },
          advisoryMode,
          () => undefined,
        );
        patchSession(id, (current) => ({
          ...current,
          messages: [...current.messages, { role: "assistant", content: answer }],
        }));
      }
    } catch (error) {
      patchSession(id, (current) => ({
        ...current,
        messages: [
          ...current.messages,
          { role: "assistant", content: `QuarkTeam stopped: ${describeError(error)}` },
        ],
      }));
    } finally {
      patchSession(id, (current) => ({ ...current, finishedAt: Date.now() }));
      setBusy(false);
    }
  }

  async function revertRun() {
    if (!session?.lastRun || busy) return;
    setBusy(true);
    try {
      const result = await bridge().revertCheckpoint(session.lastRun.checkpointId);
      setTree(await bridge().getTree());
      patchSession(session.id, (current) => ({
        ...current,
        lastRun: null,
        messages: [
          ...current.messages,
          {
            role: "assistant",
            content: `Reverted ${result.restoredFiles.length} file(s) to the state before that run.`,
          },
        ],
      }));
    } catch (error) {
      setNotice(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  const composer = (
    <div className="composer">
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder={
          workspace
            ? "Ask anything, the crew plans, edits and verifies…"
            : "Open a project, then ask…"
        }
      />
      <div className="composer-footer">
        <button className="icon-button" onClick={openWorkspace} title="Open project">
          <Plus size={15} />
        </button>
        <EffortControl value={effort} onChange={setEffort} disabled={busy} />
        <ModelPicker
          settings={settings}
          providers={providers}
          onSelect={selectModel}
          onManage={() => setShowManage(true)}
          disabled={busy}
        />
        <button
          className={`autopilot-toggle ${autopilot ? "on" : ""}`}
          style={autopilot ? { borderColor: effortColour(effort), color: effortColour(effort) } : undefined}
          onClick={() => !busy && setAutopilot((value) => !value)}
          title={autopilot ? "Autopilot can edit and verify files" : "Advice only, no edits"}
        >
          {autopilot ? "Autopilot" : "Advisory"}
        </button>
        <button className="send" onClick={() => void send()} disabled={busy || !prompt.trim()}>
          <ArrowUp size={15} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand-mark">Q</div>
        <div className="tabs">
          {sessions.map((item) => (
            <button
              key={item.id}
              className={`tab ${item.id === session?.id ? "active" : ""}`}
              onClick={() => setActiveId(item.id)}
            >
              <SquarePen size={13} />
              <span>{item.title}</span>
              {sessions.length > 1 ? (
                <span
                  className="tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    const rest = sessions.filter((entry) => entry.id !== item.id);
                    setSessions(rest);
                    if (item.id === activeId) setActiveId(rest[0]?.id ?? "");
                  }}
                >
                  <X size={12} />
                </span>
              ) : null}
            </button>
          ))}
          <button
            className="tab-add"
            title="New session"
            onClick={() => {
              const next = newSession(sessions.length);
              setSessions((prev) => [...prev, next]);
              setActiveId(next.id);
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </header>

      {!bridgeReady ? (
        <div className="banner">
          <AlertTriangle size={14} />
          <span>
            Desktop bridge not detected. Run <code>npm run dev</code> and use the QuarkCode window.
          </span>
        </div>
      ) : null}

      {notice ? (
        <div className="banner notice" onClick={() => setNotice(null)}>
          <AlertTriangle size={14} />
          <span>{notice}</span>
          <X size={13} />
        </div>
      ) : null}

      <main
        className={`stage ${session?.messages.length ? "threaded" : ""}`}
        style={{ ["--effort" as string]: effortColour(effort) }}
      >
        {session && session.messages.length ? (
          <div className="thread">
            {session.messages.map((message, index) => (
              <div className={`bubble ${message.role}`} key={index}>
                <div className="bubble-role">
                  {message.role === "assistant" ? "QUARKTEAM" : "YOU"}
                </div>
                <div className="bubble-body">{message.content}</div>
                {message.files?.length ? (
                  <div className="file-chips">
                    {message.files.map((file) => (
                      <button key={file} onClick={() => void openFile(file)}>
                        {file}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {session.events.length || busy ? (
              <div className="running">
                <Activity
                  events={session.events}
                  running={busy}
                  startedAt={session.startedAt}
                  finishedAt={session.finishedAt}
                />
                {session.plan.length ? (
                  <div className="plan">
                    {session.plan.map((step, index) => (
                      <div
                        className={`plan-step ${
                          step.startsWith("[x]")
                            ? "done"
                            : step.startsWith("[~]")
                              ? "active"
                              : step.startsWith("[!]")
                                ? "blocked"
                                : ""
                        }`}
                        key={`${index}-${step}`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {session.lastRun && !busy ? (
              <button className="revert" onClick={() => void revertRun()}>
                <RotateCcw size={13} /> Revert the last run ({session.lastRun.files.length} file(s))
              </button>
            ) : null}

            <div ref={endRef} />
          </div>
        ) : (
          <div className="hero">
            <div className="hero-wordmark">quarkcode</div>
            {composer}
          </div>
        )}
      </main>

      {session?.messages.length ? <div className="dock">{composer}</div> : null}

      <footer className="stagefoot">
        <button onClick={openWorkspace} title="Open project">
          <FolderOpen size={13} /> {workspaceName}
        </button>
        <span className="divider">·</span>
        <span className="foot-muted">{providerName || "No provider"}</span>
        {usage ? (
          <>
            <span className="divider">·</span>
            <span className="foot-muted" title="Tokens used in this session">
              {formatTokens(usage.input)} in / {formatTokens(usage.output)} out
              {usage.cached ? ` · ${formatTokens(usage.cached)} cached` : ""}
            </span>
          </>
        ) : null}
      </footer>

      {viewer ? (
        <div className="viewer-backdrop" onMouseDown={() => setViewer(null)}>
          <div className="viewer" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span>{viewer.path}</span>
              <button onClick={() => setViewer(null)}>
                <X size={15} />
              </button>
            </header>
            <Editor
              height="100%"
              language={languageFromPath(viewer.path)}
              value={viewer.content}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12.5,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          </div>
        </div>
      ) : null}

      {showManage ? (
        <ManageModels
          settings={settings}
          providers={providers}
          busyProviderId={refreshing}
          onChange={(next) => void persistSettings(next)}
          onRefresh={(providerId) => void refreshProvider(providerId)}
          onClose={() => setShowManage(false)}
        />
      ) : null}
    </div>
  );
}

export default App;
