# QuarkCode + QuarkTeam

**QuarkCode** is an AI-native desktop IDE shell built around **QuarkTeam**, an agentic software-engineering runtime. The goal is not to wrap a model in chat UI; the model can inspect the real workspace, delegate to specialists, edit files, run verification, review its own patch and repair problems before it finishes.

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

QuarkCode hiçbir API anahtarı içermez. İlk açılışta sağ paneldeki ⚙ **AI settings**
bölümünden sağlayıcı, model ve anahtarını gir; ayarlar işletim sisteminin uygulama veri
klasörüne (`quarkcode-settings.json`) kaydedilir. Alternatif olarak proje kökünde bir
`.env` dosyası kullanabilirsin:

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

### Masaüstü kurulum paketi üret

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
| "Connect an AI provider before starting Autopilot" | AI settings'ten anahtar gir veya yerel bir sağlayıcı seç. |
| "No handler registered" / boş pencere | `npm run build` çalıştırıp `dist-electron/preload.cjs` dosyasının oluştuğunu doğrula. |
| Port 5173 kullanımda | Çalışan diğer Vite sürecini kapat; port `strictPort` ile sabittir. |
| `npm run dist` hatası (Linux) | Yukarıdaki Electron sistem kütüphanelerini kur. |

---

## v0.2 Agentic runtime

QuarkCode v0.2 includes:

- Electron + React + TypeScript desktop workbench
- Monaco editor
- Project explorer
- Integrated terminal
- Right-side QuarkTeam panel
- **Safe Autopilot** that can operate on the opened workspace
- Staged `inspect → council → execute → review → repair` loop
- Parallel background council in Team/Swarm mode
- On-demand specialist delegation during execution
- Workspace skill discovery
- Project guidance loading (`AGENTS.md`, `CLAUDE.md`, `QUARK.md`, `.quark/rules.md`, Copilot instructions)
- File/search tools:
  - `list_files`
  - `read_file`
  - `read_many`
  - `search_text`
  - `write_file`
  - `replace_in_file`
- Verification tools:
  - `run_command`
  - `git_diff`
  - `git_status`
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

Minimal orchestration for cheap/quick work.

```text
workspace → executor → verify
```

### Team

Adds parallel scout/reviewer context and independent patch review.

### Swarm

Runs a broader council (repository scout, architect, adversarial reviewer, test engineer), then gives the executor on-demand subagent delegation and finishes with an independent diff-review/repair pass.

## What still needs to land before calling this production-grade

v0.2 is a substantially more agentic foundation, but the roadmap is intentionally explicit:

- native structured function calling per provider instead of the current cross-provider JSON action protocol
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
