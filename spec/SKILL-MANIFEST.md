# SKILL-MANIFEST v0.2 (Draft RFC)

**Статус:** Draft · Обсуждение: Discussions → General
**Изменения в v0.2:** model_affinity, safety_profile, execution_mode, constraints.

Опциональный файл метаданных рядом с SKILL.md. Роутер обязан работать
без манифеста (fallback на SKILL.md). Наличие манифеста повышает точность
маршрутизации.

---

## 1. Базовая схема

| Поле | Тип | Обязательно |
| :--- | :--- | :---: |
| name | string | да |
| version | SemVer | да |
| description | string | да |
| intents | string[] | нет |
| prerequisites.files | string[] | нет |
| prerequisites.tools | string[] | нет |
| complexity | low / medium / high | нет |
| estimated_tokens | number | нет |
| cost_tier | cheap / standard / premium | нет |
| composable_with | string[] | нет |
| conflicts_with | string[] | нет |
| never_auto_invoke | boolean | нет |
| language | string[] | нет |

---

## 2. model_affinity (v0.2)

Матрица предпочтений по классам моделей. Роутер сам выбирает конкретную
модель внутри класса, исходя из доступности и стоимости.

```yaml
model_affinity:
  cloud_frontier:
    preferred: claude-fable-5
    fallback: [gpt-5.6-sol, gemini-3.6-flash, deepseek-v4-pro]
    reasoning_effort: high
    thinking: adaptive
  cloud_budget:
    preferred: gpt-5.6-luna
    fallback: [claude-haiku-4.5, gemini-3.5-flash-lite, deepseek-v4-flash]
    reasoning_effort: low
  local:
    preferred: qwen-3-7b
    fallback: [llama-3.3-8b, mistral-small-3-7b]
    quant: Q4_K_M
    min_ram_gb: 6
    runtime: ollama
    offline_capable: true
  specialized:
    security: gemini-3.5-flash-cyber
    vision: qwen-3.6-flash
```

### Классы

| Класс | Назначение | Примеры |
| :--- | :--- | :--- |
| cloud_frontier | Hard reasoning, security | Fable 5, Sol, Gemini 3.6, DeepSeek V4 Pro |
| cloud_budget | Ежедневные задачи, routing | Luna, Haiku 4.5, Flash-Lite, V4 Flash |
| local | Приватность, offline, compliance | Qwen 3 7B, Llama 3.3 8B, Mistral Small 3 |
| specialized | Кибербезопасность, vision | Gemini Cyber, Qwen VL |

---

## 3. safety_profile (v0.2)

```yaml
safety_profile:
  high_risk_models: [gpt-5.6-sol, claude-fable-5, gpt-6-astra]
  requires_external_verification: true
  verification_model: gpt-5.6-luna
  local_models_trusted: true
  benchmark_awareness: true
  external_reward_hacking_check: true
  max_autonomous_steps: 30
  human_checkpoint_every: 15
  allowed_tools: [read, write, shell]
```

Обоснование: GPT-5.6 Sol показывает 12.6% reward hacking. GPT-6 Astra
продемонстрировала self-generated prompt injection через compaction
summaries. Fable 5 «relentlessly proactive».

---

## 4. execution_mode (v0.2)

```yaml
execution_mode: sequential   # sequential | async | hybrid
```

- sequential — Claude, Luna, большинство моделей.
- async — Astra: параллельные tool calls.
- hybrid — Astra планирует, Luna выполняет.

---

## 5. constraints (v0.2)

```yaml
constraints:
  max_cost_per_call_usd: 0.01
  require_local_only: false
  require_offline: false
  data_residency: EU
```

---

## 6. Полный пример

```yaml
name: code-review
version: 1.3.0
description: Проверка качества кода.
intents:
  - "проверить качество кода"
  - "code quality check"
prerequisites:
  files: [package.json, .git]
  tools: [git]
complexity: low
estimated_tokens: 8000
cost_tier: cheap
composable_with: [test-runner, linter]
language: [js, ts, py]
model_affinity:
  cloud_frontier:
    preferred: claude-fable-5
    reasoning_effort: high
  cloud_budget:
    preferred: deepseek-v4-flash
  local:
    preferred: qwen-3-7b
    runtime: ollama
safety_profile:
  requires_external_verification: false
  local_models_trusted: true
  max_autonomous_steps: 10
execution_mode: sequential
constraints:
  max_cost_per_call_usd: 0.02
```

---

## 7. Fallback (без манифеста)

1. Читает SKILL.md.
2. name из первого # Heading.
3. description — первый абзац.
4. intents = [name, description].
5. Остальное — значения по умолчанию.
6. Маршрутизация идёт через cloud_budget tier.

---

## 8. Roadmap

- v0.1 — базовые поля, fallback.
- v0.2 — model_affinity, safety_profile, execution_mode, constraints.
- v0.3 — мультиязычные intents, output_schema.
- v1.0 — заморозка после 3+ внешних реализаций.
