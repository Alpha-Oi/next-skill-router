# PROVIDERS v0.1 — Матрица моделей

**Статус:** Draft · Обновлено: сентябрь 2026

---

## 1. Облачные провайдеры

### Anthropic (Claude)

| Модель | Вход / Выход | Контекст | Класс |
| :--- | ---: | ---: | :--- |
| Claude Fable 5 | 10 / 50 | 1M | cloud_frontier |
| Claude Opus 5 | 5 / 25 | 1M | cloud_frontier |
| Claude Sonnet 5 | 2 / 10 | 1M | cloud_budget |
| Claude Haiku 4.5 | 1 / 5 | 200K | cloud_budget |

Fable 5 отклоняет thinking:disabled — учитывается в планировщике.

### OpenAI (GPT-5.6 / GPT-6)

| Модель | Вход / Выход | Класс | Риск |
| :--- | ---: | :--- | :--- |
| GPT-6 Astra | 10 / 50 | cloud_frontier | Monitorability low, compaction injection |
| GPT-5.6 Sol | 5 / 30 | cloud_frontier | Reward hacking 12.6% |
| GPT-5.6 Terra | 2.50 / 15 | cloud_budget | Умеренный |
| GPT-5.6 Luna | 1 / 6 | cloud_budget | Низкий, дефолт для routing |

### Google (Gemini)

| Модель | Вход / Выход | Класс |
| :--- | ---: | :--- |
| Gemini 4 | TBA | cloud_frontier |
| Gemini 3.6 Flash | 1.50 / 7.50 | cloud_budget (-17% output tokens) |
| Gemini 3.5 Flash-Lite | дешевле | cloud_budget (350 tok/s) |
| Gemini 3.5 Flash Cyber | TBA | specialized (security) |

### DeepSeek

| Модель | Вход / Выход | Контекст | Класс |
| :--- | ---: | ---: | :--- |
| DeepSeek V4 Pro | 1.74 / 3.48 | 1M | cloud_frontier (1.6T MoE, 49B active) |
| DeepSeek V4 Flash | 0.14 / 0.28 | 1M | cloud_budget (284B MoE, 13B active) |

### Mistral

| Модель | Вход / Выход | Контекст | Класс |
| :--- | ---: | ---: | :--- |
| Mistral Large 3 | 0.50 / 1.50 | 256K | cloud_budget (open-weight) |
| Mistral Small 4 | 0.15 / 0.60 | 128K | cloud_budget |

### Alibaba (Qwen)

| Модель | Вход / Выход | Класс |
| :--- | ---: | :--- |
| Qwen 3.6-Plus | ~0.50 / 3.00 | cloud_frontier (#1 в long-horizon) |
| Qwen 3.6-Flash | дешевле | cloud_budget (vision) |
| Qwen 3.6-27B | self-hosted | local (open weights) |

---

## 2. Локальные модели

| Модель | RAM (Q4) | HumanEval | Лицензия |
| :--- | ---: | ---: | :--- |
| Qwen 3 7B | 5.5 GB | 76.0 | Apache 2.0 |
| Llama 3.3 8B | 6 GB | 72.6 | Llama Community |
| Mistral Small 3 7B | 5.5 GB | 68.2 | Apache 2.0 |
| Phi-4-mini 3.8B | 3 GB | — | MIT |
| Llama 4 Scout | 48+ GB | — | Llama 4 Community |

---

## 3. Local Runtimes

| Runtime | Сильная сторона | Endpoint |
| :--- | :--- | :--- |
| Ollama | Простота | http://localhost:11434 |
| vLLM | 2-4x throughput | http://localhost:8000/v1 |
| LM Studio | GUI | http://localhost:1234/v1 |
| llama.cpp | Контроль, GGUF | varies |
| MLX | Apple Silicon | varies |

Все имеют OpenAI-совместимые API — единый интерфейс в роутере.

---

## 4. Матрица рисков

| Модель | Reward hacking | Monitorability | Compaction risk |
| :--- | :---: | :---: | :---: |
| GPT-6 Astra | средний | низкая | высокий |
| GPT-5.6 Sol | 12.6% | высокая | низкий |
| Claude Fable 5 | низкий | средняя | низкий |
| Gemini 3.6 Flash | низкий | высокая | низкий |
| Локальные | нет | полная | нет |

Модели с высоким риском требуют внешней верификации (safety_profile).
