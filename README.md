# QuarkCode + QuarkTeam

**QuarkCode** is a session-based desktop app built around **QuarkTeam**, an agentic software-engineering runtime. The goal is not to wrap a model in chat UI; the model can inspect the real workspace, delegate to specialists, edit files, run verification, review its own patch and repair problems before it finishes.

> A harness can make a weaker model much more useful through decomposition, tools, independent review and verification, but it cannot guarantee that an average model becomes equivalent to a specific frontier model on every task. QuarkTeam is designed to maximize the base model rather than fake a benchmark claim.

## Kurulum / Installation

### Gereksinimler / Requirements

| | |
| --- | --- |
| Node.js | 20.19+ veya 22+ (`node -v`) |
| npm | 10+ (Node ile birlikte gelir) |
| git | `git_diff` / `git_status` araçları ve geri alma için önerilir |
| İşletim sistemi | Windows 10+, macOS 12+, Linux (X11/Wayland) |

Linux'ta Electron için ek paketler gerekebilir:

```bash
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2
```

### Tek satırda kurulum (Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/burkiuze/QuarkTeam/main/scripts/install.sh | bash
```

Depoyu `~/.local/share/quarkcode/src` içine klonlar, AppImage'ı derler ve
`~/.local/bin/quarkcode` komutuyla bir masaüstü kısayolu bırakır. `sudo`
kullanmaz, `$HOME` dışına hiçbir şey yazmaz. İnternetten gelen bir betiği
doğrudan çalıştırmak istemezsen önce indir, oku, sonra çalıştır:

```bash
curl -fsSL -o quarkcode-install.sh https://raw.githubusercontent.com/burkiuze/QuarkTeam/main/scripts/install.sh
less quarkcode-install.sh && bash quarkcode-install.sh
```

Derleme Electron ve Monaco indirdiği için birkaç dakika sürer ve yaklaşık
1 GB geçici alan ister. Sonrasında `quarkcode` yazman yeterli.

### 1. Depoyu al ve bağımlılıkları kur

```bash
git clone https://github.com/burkiuze/QuarkTeam.git
cd QuarkTeam
npm install
```

### 2. Uygulamayı başlat

```bash
npm run dev
```

Bu komut hem Vite dev sunucusunu hem de **QuarkCode masaüstü penceresini** açar. Uygulamayı
tarayıcıda `localhost:5173` üzerinden açmayın: dosya sistemi köprüsü yalnızca Electron
penceresinde vardır, tarayıcı sekmesi çalışma alanına erişemez ve uyarı gösterir.

### 3. Bir model sağlayıcısı bağla

QuarkCode hiçbir API anahtarı ve hiçbir model listesi içermez. Composer'daki model
seçiciden **Manage models**'i aç, sağlayıcını seç, anahtarını gir ve **Fetch models**'e
bas: katalog sağlayıcının kendi `/models` ucundan gelir, ücretsiz olduğunu *sağlayıcının
kendisi* bildiren (id'sinde free geçen ya da fiyatı sıfır olan) modeller **Free** rozeti
alır. Ayarlar uygulama veri klasörüne (`quarkcode-settings.json`) kaydedilir.

**Yerel modeller:** Ollama sağlayıcısı hazır gelir. Manage models > Ollama panelinde
cihazında kurulu modeller boyutlarıyla listelenir; bir isim yazıp **Download** ile yenisini
indirebilirsin (Linux'ta Ollama kurulu değilse panel kurulum komutunu gösterir).

Alternatif olarak proje kökünde bir `.env` dosyası kullanabilirsin:

```bash
cp .env.example .env
# .env içindeki QUARK_API_KEY satırını kendi anahtarınla doldur
```

Yerel modellerde (Ollama, LM Studio, llama.cpp) anahtar gerekmez; yalnızca sunucunun
çalışıyor olması yeterlidir.

### 4. Projeni aç ve çalıştır

1. **Open Project** ile bir klasör seç.
2. Sağ paneldeki mod seçiciden `Fast` / `Team` / `Swarm` birini seç.
3. **Safe Autopilot** açıkken görevini yaz — QuarkTeam dosyaları inceler, düzenler,
   testleri çalıştırır ve yamayı gözden geçirir.
4. Sonuçtan memnun değilsen **Revert run** ile o çalıştırmanın tüm değişikliklerini geri al.

### Elle kurulum paketi üret

```bash
npm run dist
```

Çıktılar `release/` klasörüne yazılır (Windows `nsis`, macOS `dmg`, Linux `AppImage`).
Paketleme yalnızca çalıştırıldığı platform için üretim yapar.

### Faydalı komutlar

```bash
npm run dev        # Electron + Vite geliştirme modu
npm run typecheck  # TypeScript denetimi
npm run build      # typecheck + üretim derlemesi (dist/, dist-electron/)
npm run dist       # kurulabilir masaüstü paketi
```

### Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| "Desktop bridge not detected" uyarısı | Tarayıcı sekmesini kapat, `npm run dev` ile açılan Electron penceresini kullan. |
| Model seçicide hiç model yok | Manage models'ten sağlayıcıya anahtar gir ve Fetch models'e bas. |
| Ollama panelinde "No Ollama daemon" | `ollama serve` çalıştır; Linux'ta kurulum komutu panelde yazıyor. |
| "Connect an AI provider before starting Autopilot" | AI settings'ten anahtar gir veya yerel bir sağlayıcı seç. |
| "No handler registered" / boş pencere | `npm run build` çalıştırıp `dist-electron/preload.cjs` dosyasının oluştuğunu doğrula. |
| Port 5173 kullanımda | Çalışan diğer Vite sürecini kapat; port `strictPort` ile sabittir. |
| `npm run dist` hatası (Linux) | Yukarıdaki Electron sistem kütüphanelerini kur. |

---

## v0.3 Agentic runtime

QuarkCode v0.3 includes:

- Electron + React + TypeScript desktop app
- Session tabs, one conversation per task
- Model picker grouped by provider, with Free badges and a free-only filter
- Manage models: pick a provider, paste a key, name a model — nothing else
- Per-session token accounting, including cache hits
- Local models through Ollama: what is installed, and one-click downloads
- Monaco viewer for the files a run changed
- **Safe Autopilot** that can operate on the opened workspace
- Staged `inspect → council → plan → execute → verify → review → repair` loop
- **Native provider tool calling** (OpenAI, Anthropic, Gemini and compatible
  gateways) with automatic fallback to a JSON action protocol
- Parallel background council in Team/Swarm mode, feeding a seeded plan
- Live plan state the model must keep current
- **Verification gate**: a run cannot declare success on unverified edits
- Read-before-write enforcement and whitespace-tolerant editing
- Repeated-call detection that breaks stuck loops
- Context compaction that never drops the task or the plan
- On-demand specialist delegation during execution
- Workspace skill discovery
- Project guidance loading (`AGENTS.md`, `CLAUDE.md`, `QUARK.md`, `.quark/rules.md`, Copilot instructions)
- File/search tools:
  - `list_files`
  - `read_file` (line-numbered, range-aware)
  - `read_many`
  - `search_text` (literal or regex, glob filter, context lines)
  - `write_file`
  - `edit_file` (replace / insert_before / insert_after / append)
- Verification tools:
  - `run_command`
  - `run_checks` (auto-detected project typecheck/lint/test)
  - `git_diff`
  - `git_status`
- Coordination tools:
  - `update_plan`
  - `finish`
- Skill/subagent tools:
  - `list_skills`
  - `read_skill`
  - `delegate`
- Bounded repair pass after an independent diff review
- Session-scoped checkpoint + one-click revert of an Autopilot run
- Workspace path validation and prompt-injection-aware runtime rules

### Autopilot safety model

Safe Autopilot is the default. Model-written files are constrained to the opened workspace. Direct writes to `.git` and `node_modules` are blocked. Shell commands are limited to common build/test/lint/typecheck and Git-inspection commands. The model is also instructed to treat repository text as untrusted data instead of letting a README or source comment replace runtime rules.

Every file the executor touches is snapshotted before the first write, so **Revert run** restores
the workspace to its pre-run state (created files are deleted again). Those snapshots live in the
running app only; they do not survive a restart.

A future Full Autopilot mode can expose broader command execution behind explicit user approval.

## Keeping API cost down

Agent loops re-send their history on every turn, so the cost of a run is
dominated by repeated input tokens. v0.3.1 attacks that directly:

| Measure | Effect |
| --- | --- |
| Anthropic prompt caching | The system prompt, tool schemas and task briefing are marked as a cache prefix, so the repeated part of every turn bills at the cache-read rate |
| Superseded reads collapsed | Reading a file twice keeps only the newest copy in the sent history; older copies shrink to a one-line stub |
| Middle-out compaction | The briefing and plan stay pinned, only the middle of a long run is elided |
| Cheaper advisory passes | Council answers are capped at 8 bullets over an 8k-char tree; the dedicated planning call runs in Swarm only |
| Smaller fixed prefix | Workspace tree and council notes in the briefing were cut roughly in half |
| Repeat guard | An identical tool call is answered from the guard instead of being re-run and re-billed |
| Helper model | An optional cheaper model runs the advisers, planner and reviewer while the executor keeps the strong one — the RouteLLM idea applied per role |
| Output compression | Command output is stripped of ANSI codes and repeated lines before entering the transcript, so the saving compounds on every later turn |
| Gateway support | Presets for [Bifrost](https://github.com/maximhq/bifrost) (semantic caching, failover) and [RouteLLM](https://github.com/lm-sys/RouteLLM) (query routing) — see `PRIOR-ART.md` |
| Visible usage | The footer shows input/output/cached tokens per session, so a change in cost is observable rather than guessed |

**Economic** effort remains the cheapest path: 16 turns, no advisers, no review.

## Effort

Effort is a real dial, not a label. Each level changes how much work runs:

| Level | Executor turns | Advisers | Planner | Reviewers |
| --- | --- | --- | --- | --- |
| Economic | 16 | — | — | — |
| Medium | 28 | — | — | 1 |
| High | 40 | 2 | — | 1 |
| Extra | 56 | 2 | yes | 1 |
| Max | 80 | 4 | yes | 1 |
| Ultracode | 120 | 4 | yes | 2 (different angles) |

The gauge next to the composer sets it, and its colour tracks the level.

## Why the harness matters

A harness cannot turn a small model into a frontier model. What it can do is
remove the failure modes that cost a weaker model most of its accuracy, and that
is exactly what v0.3 targets:

| Failure mode | What QuarkTeam does about it |
| --- | --- |
| Malformed tool calls | Native function calling when the provider supports it; a documented JSON protocol, with lenient parsing, when it does not |
| Editing a file it never read | `write_file`/`edit_file` reject the edit and say so |
| Exact-string edits that miss by whitespace | `edit_file` retries whitespace-insensitively and reports the closest lines on a miss |
| "It should work now" | `finish` is rejected while edits are unverified; `run_checks` runs the project's real commands |
| Losing the task on long runs | The briefing and plan are re-sent every turn; only the middle of the history is elided |
| Getting stuck in a loop | Identical repeated calls are blocked with a nudge to change approach |
| Forgetting half the request | A seeded plan is kept in the system prompt and must be resolved before finishing |
| Transient provider errors | Retries with backoff; a run is never discarded because one call failed |

Measure it on your own repository tasks rather than trusting the list.

## Providers

QuarkCode has four transport protocols:

1. OpenAI Responses
2. OpenAI Chat-compatible
3. Anthropic Messages
4. Gemini `generateContent`

Built-in presets currently include:

- OpenCode Zen
- OpenAI
- Anthropic
- Google AI Studio
- OpenRouter
- Groq
- Cerebras
- DeepSeek
- Mistral
- xAI
- Together AI
- Fireworks AI
- Hugging Face Inference
- Moonshot / Kimi
- MiniMax
- Z.AI / GLM
- Alibaba DashScope / Qwen
- NVIDIA NIM
- Nebius AI Studio
- SiliconFlow
- SambaNova
- Ollama
- LM Studio
- llama.cpp server
- Any custom OpenAI-compatible endpoint

The OpenAI-compatible preset means many additional inference gateways can work without a dedicated QuarkCode build.

### Muse Spark 1.3 Contributor Free

The default OpenCode Zen preset is configured for:

```text
base URL: https://opencode.ai/zen/v1
protocol: OpenAI Responses
model: muse-spark-1.3-contributor-free
```

QuarkCode does **not** bundle or redistribute an API key. Connect your own eligible OpenCode Zen account/token. Availability, quotas and data-use terms are controlled by that provider and may change.

## Environment defaults

`.env` (or real environment variables, which always win) can preset the provider:

```bash
QUARK_PROVIDER=opencode-zen
QUARK_BASE_URL=https://opencode.ai/zen/v1
QUARK_PROTOCOL=openai-responses
QUARK_MODEL=muse-spark-1.3-contributor-free
QUARK_API_KEY=
```

Anything saved from the QuarkTeam settings panel takes precedence over these defaults.

## Workspace skills

QuarkCode looks for portable Markdown skills at:

```text
.quark/skills/<skill>/SKILL.md
.agents/skills/<skill>/SKILL.md
skills/<skill>/SKILL.md
```

The executor can list and load them during a task instead of bloating every prompt with every skill.

## Modes

### Fast

Minimal orchestration for cheap/quick work. No council, no patch review.

```text
workspace → executor (plan/edit/verify) → done
```

### Team

Adds a two-role council, a seeded plan and an independent patch review with a
bounded repair pass.

### Swarm

Runs a broader council (repository scout, architect, adversarial reviewer, test
engineer), seeds the plan from it, gives the executor on-demand subagent
delegation, and finishes with an independent diff review plus repair pass.

## What still needs to land before calling this production-grade

v0.2 is a substantially more agentic foundation, but the roadmap is intentionally explicit:

- per-role model routing and fallback chains
- durable (on-disk, restart-surviving) checkpoint history
- side-by-side AI diff Accept/Reject
- LSP diagnostics and symbol index
- semantic code search / embeddings
- MCP client + server support
- persistent task/session memory with context compaction
- background task queue and worktree-per-task isolation
- browser/computer-use tools
- GitHub issue/PR agent mode
- benchmark harness against SWE-style repository tasks
- extension/skill registry with signed manifests
- sandbox backend for high-risk commands

## License

See `LICENSE`.
