# PROVIDERS v0.1 — Model matrix

**Status:** Draft · Updated: September 2026

---

## 1. Cloud providers

### Anthropic (Claude)

| Model | Input / Output ($/1M) | Context | Tier |
| :--- | ---: | ---: | :--- |
| Claude Fable 5 | 10 / 50 | 1M | cloud_frontier |
| Claude Opus 5 | 5 / 25 | 1M | cloud_frontier |
| Claude Sonnet 5 | 2 / 10 | 1M | cloud_budget |
| Claude Haiku 4.5 | 1 / 5 | 200K | cloud_budget |

Fable 5 rejects `thinking: disabled` while thinking is active — the planner accounts
for this.

### OpenAI (GPT-5.6 / GPT-6)

| Model | Input / Output | Tier | Risk |
| :--- | ---: | :--- | :--- |
| GPT-6 Astra | 10 / 50 | cloud_frontier | Low monitorability, compaction injection |
| GPT-5.6 Sol | 5 / 30 | cloud_frontier | Reward hacking 12.6% |
| GPT-5.6 Terra | 2.50 / 15 | cloud_budget | Moderate |
| GPT-5.6 Luna | 1 / 6 | cloud_budget | Low — default for routing |

### Google (Gemini)

| Model | Input / Output | Tier |
| :--- | ---: | :--- |
| Gemini 4 | TBA | cloud_frontier |
| Gemini 3.6 Flash | 1.50 / 7.50 | cloud_budget (-17% output tokens) |
| Gemini 3.5 Flash-Lite | cheaper | cloud_budget (350 tok/s) |
| Gemini 3.5 Flash Cyber | TBA | specialized (security) |

### DeepSeek

| Model | Input / Output | Context | Tier |
| :--- | ---: | ---: | :--- |
| DeepSeek V4 Pro | 1.74 / 3.48 | 1M | cloud_frontier (1.6T MoE, 49B active) |
| DeepSeek V4 Flash | 0.14 / 0.28 | 1M | cloud_budget (284B MoE, 13B active) |

### Mistral

| Model | Input / Output | Context | Tier |
| :--- | ---: | ---: | :--- |
| Mistral Large 3 | 0.50 / 1.50 | 256K | cloud_budget (open-weight) |
| Mistral Small 4 | 0.15 / 0.60 | 128K | cloud_budget |

### Alibaba (Qwen)

| Model | Input / Output | Tier |
| :--- | ---: | :--- |
| Qwen 3.6-Plus | ~0.50 / 3.00 | cloud_frontier (#1 in long-horizon planning) |
| Qwen 3.6-Flash | cheaper | cloud_budget (vision) |
| Qwen 3.6-27B | self-hosted | local (open weights) |

---

## 2. Local models

| Model | RAM (Q4) | HumanEval | License |
| :--- | ---: | ---: | :--- |
| Qwen 3 7B | 5.5 GB | 76.0 | Apache 2.0 |
| Llama 3.3 8B | 6 GB | 72.6 | Llama Community |
| Mistral Small 3 7B | 5.5 GB | 68.2 | Apache 2.0 |
| Phi-4-mini 3.8B | 3 GB | — | MIT |
| Llama 4 Scout | 48+ GB | — | Llama 4 Community |

---

## 3. Local runtimes

| Runtime | Strength | Endpoint |
| :--- | :--- | :--- |
| Ollama | Simplicity | http://localhost:11434 |
| vLLM | 2-4x throughput at concurrency | http://localhost:8000/v1 |
| LM Studio | GUI for Mac/Windows | http://localhost:1234/v1 |
| llama.cpp | Full control, GGUF | varies |
| MLX | Apple Silicon, low latency | varies |

All expose OpenAI-compatible APIs — unified interface in the router.

---

## 4. Model classes (tiers)

| Tier | When to use | Signal |
| :--- | :--- | :--- |
| local | Privacy, offline, compliance | data_sensitivity high / require_local_only |
| cloud_budget | Daily work, routing | complexity low/medium |
| cloud_frontier | Hard reasoning, security | complexity high |
| specialized | Domain-specific | security / vision |

---

## 5. Risk matrix

| Model | Reward hacking | Monitorability | Compaction risk |
| :--- | :---: | :---: | :---: |
| GPT-6 Astra | medium | low | high |
| GPT-5.6 Sol | 12.6% | high | low |
| Claude Fable 5 | low | medium | low |
| Gemini 3.6 Flash | low | high | low |
| Local models | none | full | none |

High-risk models require external verification (`safety_profile`).
