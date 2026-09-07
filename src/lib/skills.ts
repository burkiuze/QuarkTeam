export type Skill = {
  id: string;
  name: string;
  instruction: string;
};

export const SKILLS: Record<string, Skill> = {
  "repo-scout": {
    id: "repo-scout",
    name: "Repository Scout",
    instruction:
      "Map the relevant project structure, identify entry points, dependencies, conventions, constraints and likely blast radius before proposing edits.",
  },
  decomposition: {
    id: "decomposition",
    name: "Task Decomposition",
    instruction:
      "Break ambiguous engineering work into ordered, verifiable subtasks with explicit dependencies and completion criteria.",
  },
  architecture: {
    id: "architecture",
    name: "Architecture",
    instruction:
      "Design boundaries, interfaces, data flow and failure modes. Prefer the smallest architecture that remains extensible and testable.",
  },
  frontend: {
    id: "frontend",
    name: "Frontend Engineering",
    instruction:
      "Design accessible, responsive UI states and implementation details. Consider loading, empty, error and keyboard states.",
  },
  backend: {
    id: "backend",
    name: "Backend Engineering",
    instruction:
      "Design APIs, validation, persistence, concurrency, observability and error handling with clear contracts.",
  },
  implementation: {
    id: "implementation",
    name: "Implementation",
    instruction:
      "Produce concrete, compilable code-oriented solutions consistent with the existing stack. Avoid hand-wavy placeholders.",
  },
  refactor: {
    id: "refactor",
    name: "Refactoring",
    instruction:
      "Reduce complexity and duplication without silently changing behavior. Preserve public contracts unless change is intentional.",
  },
  debugging: {
    id: "debugging",
    name: "Debugging",
    instruction:
      "Form hypotheses from evidence, isolate root causes, distinguish symptoms from causes and propose the fastest verification path.",
  },
  testing: {
    id: "testing",
    name: "Testing",
    instruction:
      "Cover happy paths, boundaries, regression risks and failure states. Prefer tests that prove behavior rather than implementation details.",
  },
  review: {
    id: "review",
    name: "Code Review",
    instruction:
      "Act as a skeptical senior reviewer. Find correctness bugs, race conditions, broken assumptions, maintainability issues and missing edge cases.",
  },
  security: {
    id: "security",
    name: "Security Review",
    instruction:
      "Check trust boundaries, secrets, injection, path traversal, unsafe deserialization, authz/authn, dependency and supply-chain risks. Recommend defensive fixes.",
  },
  performance: {
    id: "performance",
    name: "Performance",
    instruction:
      "Identify unnecessary work, I/O, serialization, memory pressure, blocking operations and algorithmic hotspots. Prefer measurable optimizations.",
  },
  docs: {
    id: "docs",
    name: "Documentation",
    instruction:
      "Write concise setup, API and operational documentation that helps another engineer successfully use and maintain the change.",
  },
  integration: {
    id: "integration",
    name: "Integration",
    instruction:
      "Reconcile conflicting proposals, keep only justified changes, sequence implementation safely and produce a coherent final engineering answer.",
  },
};

export function skillText(ids: string[]) {
  return ids
    .map((id) => SKILLS[id])
    .filter(Boolean)
    .map((skill) => `• ${skill.name}: ${skill.instruction}`)
    .join("\n");
}
