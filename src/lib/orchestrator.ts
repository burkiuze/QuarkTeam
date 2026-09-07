import { AGENTS, systemPrompt } from "./agents";
import type {
  AgentRunState,
  TeamMode,
  WorkspaceContext,
} from "../types";

type StatusCallback = (state: AgentRunState) => void;

const clip = (value: string | undefined, max = 14_000) => {
  if (!value) return "";
  return value.length > max
    ? `${value.slice(0, max)}\n…[truncated by QuarkTeam]`
    : value;
};

function baseContext(goal: string, context: WorkspaceContext) {
  return `USER GOAL
${goal}

WORKSPACE
Root: ${context.rootName || "unknown"}
Active file: ${context.activeFile || "none"}

Project tree:
${clip(context.tree, 8_000)}

Active file contents:
${clip(context.activeCode, 14_000)}

Recent terminal output:
${clip(context.terminal, 3_000)}
`;
}

async function runAgent(
  id: string,
  user: string,
  onStatus: StatusCallback,
) {
  const agent = AGENTS[id];
  onStatus({ id, name: `${agent.name} · ${agent.title}`, status: "running" });
  try {
    const output = await window.quark.complete({
      system: systemPrompt(agent),
      user,
      temperature: id === "lead" ? 0.15 : 0.25,
    });
    onStatus({ id, name: `${agent.name} · ${agent.title}`, status: "done" });
    return output;
  } catch (error) {
    onStatus({ id, name: `${agent.name} · ${agent.title}`, status: "error" });
    throw error;
  }
}

function notes(parts: Array<[string, string]>) {
  return parts
    .map(([name, value]) => `## ${name}\n${clip(value, 8_000)}`)
    .join("\n\n");
}

export async function runQuarkTeam(
  goal: string,
  context: WorkspaceContext,
  mode: TeamMode,
  onStatus: StatusCallback,
) {
  const base = baseContext(goal, context);

  if (mode === "fast") {
    const scout = await runAgent("scout", base, onStatus);
    const implementer = await runAgent(
      "implementer",
      `${base}\n\nTEAM NOTE\n${scout}`,
      onStatus,
    );
    return runAgent(
      "lead",
      `${base}\n\nTEAM WORK\n${notes([
        ["Scout", scout],
        ["Implementer", implementer],
      ])}\n\nDeliver the best final answer to the user.`,
      onStatus,
    );
  }

  const discoveryIds = mode === "swarm" ? ["scout", "product"] : ["scout"];
  const discovery = await Promise.all(
    discoveryIds.map(async (id) => [
      id,
      await runAgent(id, base, onStatus),
    ] as [string, string]),
  );

  const architect = await runAgent(
    "architect",
    `${base}\n\nDISCOVERY\n${notes(discovery)}`,
    onStatus,
  );

  const buildIds =
    mode === "swarm" ? ["frontend", "backend", "implementer"] : ["implementer"];

  const builders = await Promise.all(
    buildIds.map(async (id) => [
      id,
      await runAgent(
        id,
        `${base}\n\nDISCOVERY\n${notes(discovery)}\n\nARCHITECTURE\n${architect}`,
        onStatus,
      ),
    ] as [string, string]),
  );

  const draft = notes(builders);
  const auditIds =
    mode === "swarm"
      ? ["reviewer", "tester", "debugger", "security", "performance", "docs"]
      : ["reviewer", "tester", "security"];

  const audits = await Promise.all(
    auditIds.map(async (id) => [
      id,
      await runAgent(
        id,
        `${base}\n\nARCHITECTURE\n${architect}\n\nPROPOSED IMPLEMENTATION\n${draft}`,
        onStatus,
      ),
    ] as [string, string]),
  );

  return runAgent(
    "lead",
    `${base}

DISCOVERY
${notes(discovery)}

ARCHITECTURE
${architect}

IMPLEMENTATION PROPOSALS
${draft}

AUDITS
${notes(audits)}

As engineering lead, synthesize this into one final response. Keep only high-confidence decisions. Give concrete file-level changes, important code snippets when useful, tests/verification, and call out any assumption. Do not describe internal chain-of-thought or pretend changes were applied if they were not.`,
    onStatus,
  );
}

export function agentRoster(mode: TeamMode) {
  const ids =
    mode === "fast"
      ? ["scout", "implementer", "lead"]
      : mode === "team"
        ? ["scout", "architect", "implementer", "reviewer", "tester", "security", "lead"]
        : [
            "scout",
            "product",
            "architect",
            "frontend",
            "backend",
            "implementer",
            "reviewer",
            "tester",
            "debugger",
            "security",
            "performance",
            "docs",
            "lead",
          ];

  return ids.map((id) => ({
    id,
    name: `${AGENTS[id].name} · ${AGENTS[id].title}`,
    status: "idle" as const,
  }));
}
