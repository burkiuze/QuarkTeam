# Prior art and integrations

QuarkTeam is a harness, and harness engineering is a young field with a lot of
good public work in it. This file records what QuarkCode borrows, what it
integrates with directly, and what it deliberately does not vendor.

**Nothing here is copied into this repository.** These are credits and
integration points; each project keeps its own licence and its own release
cycle. Where a project is a service you run, QuarkCode talks to it over its
own API instead of embedding it.

## Integrated directly

### Bifrost — AI gateway
<https://github.com/maximhq/bifrost> · Apache-2.0

One OpenAI-compatible endpoint in front of 23+ providers, with semantic
caching, load balancing, budget controls and automatic failover.

QuarkCode ships a **Bifrost gateway** provider preset pointing at
`http://localhost:8080/v1`. Start the gateway with `npx -y @maximhq/bifrost`,
select the preset, and every QuarkTeam call — executor, advisers, reviewer —
goes through it. That gives caching and failover across providers without
QuarkCode having to implement either.

### RouteLLM — model routing
<https://github.com/lm-sys/RouteLLM> · from LMSYS / Chatbot Arena

Routes easy queries to a cheap model and hard ones to a strong model, keeping
most of the strong model's quality at a fraction of the cost.

Two ways to use it here:

1. **As a server.** QuarkCode ships a **RouteLLM router** preset for
   `http://localhost:6060/v1`. Launch its OpenAI-compatible server
   (`python -m routellm.openai_server --routers mf --strong-model … --weak-model …`)
   and point QuarkCode at it.
2. **Inside QuarkCode.** Manage models has a **Helper model** field. When set,
   the council, the planner and the reviewer run on that model while the
   executor keeps the strong one. This applies the same idea at the role level,
   where the split is obvious: advisers write a few bullet points, the executor
   edits your code.

### LLMLingua — prompt compression
<https://github.com/microsoft/LLMLingua> · Microsoft Research, MIT

Compresses prompts before they reach the model.

QuarkCode does a deterministic, dependency-free version of the same idea on the
noisiest input an agent has: command output. `compressOutput` in
`electron/agent-tools.ts` strips ANSI escapes, collapses blank runs and folds
repeated identical lines into `… repeated N times` before the output enters the
transcript — so the saving compounds on every later turn. It cannot invent text,
which a model-based compressor can. For heavier compression, run LLMLingua in
front of QuarkCode through a gateway.

## Read for ideas, not integrated

### open-multi-agent (OMA)
<https://github.com/open-multi-agent/open-multi-agent>

Multi-agent orchestration patterns. QuarkTeam's council/executor/reviewer split
is the same family of idea, kept deliberately small: advisers never touch the
filesystem, only the executor does.

### GART — Generative Agent Runtime Toolkit
<https://github.com/iFrescoo/gart>

Agent runtime building blocks. QuarkTeam keeps its runtime in-process in the
Electron main process so tool permissions stay in one auditable place
(`electron/agent-tools.ts`).

### Awesome lists

- **awesome-harness-engineering** — <https://github.com/ai-boost/awesome-harness-engineering>
- **awesome-ai-agents-2026** — <https://github.com/ARUNAGIRINATHAN-K/awesome-ai-agents-2026>
- **Awesome-Self-Improving-Agents** — <https://github.com/selfimproving-agent/awesome-Self-Improving-Agents>

Reading lists that map the field. The self-improving-agents list is the closest
to QuarkTeam's open roadmap item: the harness currently repairs a patch after
review, but it does not yet learn across runs.

## What QuarkCode still owns

Integrating a gateway does not remove the harness's job. Caching and routing
lower the price of a call; they do not decide what to read before editing,
refuse an unverified finish, collapse a superseded file read, or break a stuck
loop. Those live in `electron/agent-runtime.ts` and `electron/agent-tools.ts`
and are what the README's failure-mode table is about.
