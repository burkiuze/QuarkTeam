# QuarkTeam architecture

## Design target

QuarkTeam is a model-agnostic engineering harness. Its purpose is to make a model behave more like a disciplined software team by giving it evidence, tools, independent critics, test feedback and a bounded repair loop.

## Runtime pipeline

```text
User goal
  │
  ├─ workspace scan + verification-command detection
  ├─ project rules + portable skills
  │
  ├─ parallel background council
  │    ├─ repository scout
  │    ├─ architect
  │    ├─ adversarial reviewer
  │    └─ test engineer
  │         │
  │         ▼
  │    seeded plan
  ▼
Quark Executor (one tool call per step)
  │
  ├─ read/search workspace        (read-before-write enforced)
  ├─ update_plan                  (plan echoed back every turn)
  ├─ edit files                   (whitespace-tolerant matching)
  ├─ run_checks                   (project's own typecheck/lint/test)
  ├─ delegate specialist subagents on demand
  └─ finish                       (gated on verification + plan closure)
       │
       ▼
Independent Prism review
       │
       ├─ approved → done
       └─ findings → bounded repair loop → done
```

Fast mode skips most council calls. Team mode uses a smaller council. Swarm mode uses all background roles.

## Renderer isolation

The renderer runs sandboxed with context isolation, loads only bundled assets under a
Content-Security-Policy, and reaches the main process exclusively through the `preload.cjs`
bridge. The editor is bundled rather than fetched from a CDN, so the app works offline and
never executes remote code.

## Provider abstraction

`electron/providers.ts` normalizes four common model APIs into a text-completion primitive:

- OpenAI Responses
- OpenAI Chat-compatible
- Anthropic Messages
- Gemini generateContent

This keeps the orchestration layer independent from provider-specific request formats.

## Agent action protocol

The executor prefers each provider's **native function calling**: OpenAI Chat
`tools`/`tool_calls`, OpenAI Responses `function_call` items, Anthropic
`tool_use`/`tool_result` and Gemini `functionDeclarations`. Conversation state is
a real message history, so tool results are attributed to the calls that
produced them.

When an endpoint rejects function calling, that rejection is remembered for the
session and the executor falls back to a documented JSON protocol in the system
prompt:

```json
{"tool":"read_file","args":{"path":"src/App.tsx"}}
```

The fallback parser accepts a bare object, a fenced block or an object embedded
in prose, and the v0.2 `{"kind":"final","answer":"..."}` shape still works. A
turn with no parsable action is nudged rather than treated as fatal.

The same adaptive mechanism handles endpoints that reject `temperature`.

## Reliability mechanisms

The harness assumes the model will make ordinary mistakes and makes each one
recoverable rather than fatal:

- **Read-before-write.** Rewriting or editing a file that was never read in this
  run is rejected with an explanation.
- **Forgiving edits.** `edit_file` matches exactly, then whitespace-insensitively;
  ambiguous matches report their line numbers and misses report the closest
  existing lines.
- **Verification gate.** `finish` is refused while edits are unverified, and
  again while plan steps are open. The gate releases after a few attempts so a
  project without usable checks cannot deadlock.
- **Loop breaking.** An identical repeated tool call is answered with a nudge
  instead of being re-executed.
- **Context compaction.** The task briefing stays pinned; only the middle of the
  history is elided, and a tool result is never sent without the assistant turn
  that produced it.
- **Failure tolerance.** Provider errors are retried with backoff; council and
  review failures degrade to a warning rather than discarding completed work.

## Tool policy

The Electron main process owns all tools. The React renderer never receives Node.js access.

Safe Autopilot:

- confines file tools to the opened workspace
- blocks `.git` and `node_modules` writes
- blocks shell metacharacters in model-run commands
- allow-lists common build/test/lint/typecheck/Git inspection commands
- caps output sizes, command runtimes and provider request deadlines
- snapshots every file before its first write so a run can be reverted
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

1. Model router with role-specific models and failover
2. Durable checkpoints + rollback (currently in-session only)
3. Diff approval UX
4. MCP
5. LSP/symbol graph
6. persistent cross-session memory
7. worktree-isolated parallel implementers
8. background tasks and resumable sessions
9. evaluation harness and regression suite
