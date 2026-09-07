# QuarkTeam architecture

## Design target

QuarkTeam is a model-agnostic engineering harness. Its purpose is to make a model behave more like a disciplined software team by giving it evidence, tools, independent critics, test feedback and a bounded repair loop.

## Runtime pipeline

```text
User goal
  │
  ├─ workspace scan
  ├─ project rules + portable skills
  │
  ├─ parallel background council
  │    ├─ repository scout
  │    ├─ architect
  │    ├─ adversarial reviewer
  │    └─ test engineer
  │
  ▼
Quark Executor
  │
  ├─ read/search workspace
  ├─ delegate specialist subagents on demand
  ├─ edit files
  ├─ run build/test/lint/typecheck
  └─ inspect git diff
       │
       ▼
Independent Prism review
       │
       ├─ approved → finish
       └─ findings → bounded repair loop → finish
```

Fast mode skips most council calls. Team mode uses a smaller council. Swarm mode uses all background roles.

## Provider abstraction

`electron/providers.ts` normalizes four common model APIs into a text-completion primitive:

- OpenAI Responses
- OpenAI Chat-compatible
- Anthropic Messages
- Gemini generateContent

This keeps the orchestration layer independent from provider-specific request formats.

## Agent action protocol

For v0.2 the executor uses a strict provider-neutral JSON action protocol:

```json
{"kind":"tool","tool":"read_file","args":{"path":"src/App.tsx"},"reason":"inspect before editing"}
```

or:

```json
{"kind":"final","answer":"Implemented and verified ..."}
```

This works even on providers that do not expose identical native function-calling schemas. Native tool calling is still preferable and is a planned optimization.

## Tool policy

The Electron main process owns all tools. The React renderer never receives Node.js access.

Safe Autopilot:

- confines file tools to the opened workspace
- blocks `.git` and `node_modules` writes
- blocks shell metacharacters in model-run commands
- allow-lists common build/test/lint/typecheck/Git inspection commands
- caps output sizes and command runtimes
- treats repository instructions as untrusted input

## Skills

The runtime discovers `SKILL.md` files lazily instead of injecting every skill into every call. Current locations:

- `.quark/skills/*/SKILL.md`
- `.agents/skills/*/SKILL.md`
- `skills/*/SKILL.md`

This keeps prompt size lower while letting a project ship domain-specific procedures.

## Why this can improve smaller models

A smaller model often fails because it must simultaneously discover the repository, design a change, code, remember constraints, review itself and test. QuarkTeam separates those failure modes:

- parallel agents produce independent views
- the executor gets concrete workspace tools
- repository evidence replaces guessing
- an independent reviewer attacks the patch after creation
- test output becomes new evidence for repair
- specialist delegation is available mid-task

This can materially improve reliability, but it is not a mathematical capability upgrade and should be measured on real repository tasks.

## Next architecture milestones

1. Native provider tool-calling adapters
2. Model router with role-specific models and failover
3. Durable checkpoints + rollback
4. Diff approval UX
5. MCP
6. LSP/symbol graph
7. persistent memory + context compaction
8. worktree-isolated parallel implementers
9. background tasks and resumable sessions
10. evaluation harness and regression suite
