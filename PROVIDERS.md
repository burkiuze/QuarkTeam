# Provider matrix

QuarkCode separates **provider preset** from **wire protocol**. A provider that exposes an OpenAI-compatible endpoint usually requires no dedicated adapter.

| Provider | Default protocol | Notes |
| --- | --- | --- |
| OpenCode Zen | OpenAI Responses | Includes Muse Spark 1.3 Contributor Free preset when eligible |
| OpenAI | OpenAI Responses | Native Responses route |
| Anthropic | Anthropic Messages | `x-api-key` auth |
| Google AI Studio | Gemini | `generateContent` |
| OpenRouter | OpenAI Chat | Model router |
| Groq | OpenAI Chat | Compatible endpoint |
| Cerebras | OpenAI Chat | Compatible endpoint |
| DeepSeek | OpenAI Chat | Compatible endpoint |
| Mistral | OpenAI Chat | Compatible endpoint |
| xAI | OpenAI Chat | Compatible endpoint |
| Together AI | OpenAI Chat | Compatible endpoint |
| Fireworks AI | OpenAI Chat | Compatible endpoint |
| Hugging Face Inference | OpenAI Chat | Router endpoint |
| Moonshot / Kimi | OpenAI Chat | Compatible endpoint |
| MiniMax | OpenAI Chat | Compatible endpoint |
| Z.AI / GLM | OpenAI Chat | Compatible endpoint |
| DashScope / Qwen | OpenAI Chat | Compatible-mode endpoint |
| NVIDIA NIM | OpenAI Chat | Compatible endpoint |
| Nebius | OpenAI Chat | Compatible endpoint |
| SiliconFlow | OpenAI Chat | Compatible endpoint |
| SambaNova | OpenAI Chat | Compatible endpoint |
| Ollama | OpenAI Chat | Local |
| LM Studio | OpenAI Chat | Local |
| llama.cpp server | OpenAI Chat | Local |
| Custom | OpenAI Chat | User-supplied URL |

## Providers that need richer auth

AWS Bedrock, Google Vertex AI, Azure variants, GitHub Copilot OAuth and some enterprise gateways have provider-specific auth/signing behavior. The current v0.2 transport can use them through a compatible gateway, but true first-class auth adapters are a roadmap item rather than pretending one generic API-key field covers every enterprise provider.
