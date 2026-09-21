# SKILL-MANIFEST v0.3.1 (Draft RFC)

**Status:** Draft · Discussion: [GitHub Discussions](https://github.com/Alpha-Oi/next-skill-router/discussions)
**Changes in v0.2:** added `model_affinity`, `safety_profile`, `execution_mode`, `constraints`.
**Changes in v0.3:** added `argument_hint`.
**Changes in v0.3.1:** added `gates` and `secrets_policy`.

An optional metadata file placed next to `SKILL.md`. A router **must** work without it
(falling back to plain `SKILL.md`). Its presence raises routing precision; it is not
a lock-in.

---

## 1. Base schema

| Field | Type | Required |
| :--- | :--- | :---: |
| name | string | yes |
| version | SemVer | yes |
| description | string | yes |
| intents | string[] | no |
| prerequisites.files | string[] | no |
| prerequisites.tools | string[] | no |
| complexity | low / medium / high | no |
| estimated_tokens | number | no |
| cost_tier | cheap / standard / premium | no |
| composable_with | string[] | no |
| conflicts_with | string[] | no |
| never_auto_invoke | boolean | no |
| language | string[] | no |
| argument_hint | string | no |
| gates | object | no |
| secrets_policy | object | no |

---

## 2. model_affinity (new in v0.2)

A preference matrix by **model class**, not by specific model. The router picks a
concrete model inside the class based on availability and cost.

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

### Model classes

| Class | Purpose | Examples |
| :--- | :--- | :--- |
| cloud_frontier | Hard reasoning, security | Fable 5, Sol, Astra, Gemini 3.6, DeepSeek V4 Pro |
| cloud_budget | Daily work, summaries, routing | Luna, Haiku 4.5, Flash-Lite, V4 Flash |
| local | Privacy, offline, compliance | Qwen 3 7B, Llama 3.3 8B, Mistral Small 3 |
| specialized | Cyber security, vision | Gemini Cyber, Qwen VL |

---

## 3. safety_profile (new in v0.2)

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

| Field | Purpose |
| :--- | :--- |
| high_risk_models | Models with documented reward hacking |
| requires_external_verification | Verify output on a second model |
| verification_model | Which model verifies |
| local_models_trusted | Trust local models without external checks |
| benchmark_awareness | Detect "gaming the test" behaviour |
| max_autonomous_steps | Step limit without human in the loop |
| human_checkpoint_every | Mandatory confirmation cadence |

Rationale: GPT-5.6 Sol exhibits **12.6% reward hacking**. GPT-6 Astra showed
self-generated prompt injection via compaction summaries. Claude Fable 5 is
"relentlessly proactive" and may act without explicit request. These are documented
incidents, not hypotheticals.

---

## 3.5. argument_hint (new in v0.3)

Короткая подсказка о том, как передавать аргументы в навык. Используется
CLI и чат-интерфейсом для показа синтаксиса при вызове.

```yaml
argument_hint: "[full|semi|interview|manual] [strict|deep] [polish] what to build"
```

| Поле | Назначение |
| :--- | :--- |
| argument_hint | Строка с описанием аргументов (необязательно) |

**Зачем:** без этого поля пользователь не знает, что навык принимает флаги.
С полем CLI может показать:

```
$ next-skill-router run autopilot --help
autopilot — build an app end-to-end from a brief
Usage: /autopilot [full|semi|interview|manual] [strict|deep] [polish] <task>
```

Заимствовано из `nick-vels/skills` (анализ: `docs/analysis/nick-vels-skills.md`).

---

## 3.6. gates (new in v0.3.1)

Формальные проверки до/после запуска навыка. Заменяют «мягкие рекомендации»
на жёсткие чек-поинты — в духе подхода autopilot (см.
[autopilot-patterns.md](../docs/analysis/autopilot-patterns.md)).

```yaml
gates:
  pre:
    - dependencies_installed
    - git_clean
  post:
    - tests_pass
    - no_secrets_in_diff
  blind_acceptance: true
```

| Поле | Назначение |
| :--- | :--- |
| `pre` | Проверки до запуска; при провале — навык не запускается |
| `post` | Проверки после запуска; при провале — событие `safety_event` |
| `blind_acceptance` | Проверять результат против изначального запроса пользователя |

Проверки **декларативны** — их исполняет хост (Claude Code, Codex, CLI).
Встроенный набор гейтов:

| Gate | Что проверяет |
| :--- | :--- |
| `dependencies_installed` | `prerequisites.files` и `prerequisites.tools` выполнены |
| `git_clean` | `git status` чист или только ожидаемые изменения |
| `tests_pass` | Тесты проекта проходят |
| `no_secrets_in_diff` | В изменениях нет секретов |

---

## 3.7. secrets_policy (new in v0.3.1)

Правила обращения с секретами. Заменяют флаг на **процедуру** — в духе
autopilot (см. `docs/analysis/autopilot-patterns.md`, паттерн 3).

```yaml
secrets_policy:
  never_request: true
  redact_at_ingest: true
  allowed_env_vars: [STRIPE_KEY, OPENAI_API_KEY, GITHUB_TOKEN]
  rotate_on_leak: true
```

| Поле | По умолчанию | Назначение |
| :--- | :---: | :--- |
| `never_request` | true | Навык никогда не запрашивает credentials |
| `redact_at_ingest` | true | Редакция до записи в файл/лог/кеш |
| `allowed_env_vars` | [] | Белый список имён переменных окружения |
| `rotate_on_leak` | true | Требовать ротации при утечке |

Роутер **обязан** выполнять `redact_at_ingest` для любого текста, попадающего
в `feedback.jsonl`, `embeddings.json` или телеметрию. Найденный секрет
заменяется на `[REDACTED:VAR_NAME]`.

---

## 4. execution_mode (new in v0.2)

```yaml
execution_mode: sequential   # sequential | async | hybrid
```

- `sequential` — for models without async tool calling (Claude, Luna).
- `async` — for Astra-class models: parallel tool calls.
- `hybrid` — Astra plans, Luna executes in parallel.

---

## 5. constraints (new in v0.2)

```yaml
constraints:
  max_cost_per_call_usd: 0.01
  require_local_only: false
  require_offline: false
  data_residency: EU
```

| Field | Purpose |
| :--- | :--- |
| max_cost_per_call_usd | Hard cost ceiling |
| require_local_only | Local models only (GDPR, HIPAA) |
| require_offline | No network calls |
| data_residency | Jurisdiction for compliance |

---

## 6. Complete example

```yaml
name: code-review
version: 1.3.0
description: "Check code quality and flag common mistakes."
intents:
  - "check code quality"
  - "code quality check"
  - "review my changes"
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
    thinking: adaptive
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

## 7. Fallback (no manifest)

When `skill.manifest.yaml` is absent, the router:

1. Reads `SKILL.md`.
2. Extracts `name` from the first `# Heading`.
3. Uses the first paragraph as `description`.
4. Sets `intents = [name, description]`.
5. Sets `argument_hint = null` (optional).
6. Defaults everything else.
6. Routes via the `cloud_budget` tier.

---

## 8. Roadmap

- v0.1 — base fields, fallback.
- **v0.2 — model_affinity, safety_profile, execution_mode, constraints.**
- v0.3 — argument_hint, multilingual intents, output_schema.
- **v0.3.1 — gates, secrets_policy.**
- v1.0 — freeze after 3+ external implementations.

---

## 9. How to participate

Open issues with the `spec` label, or comment in
[Discussion #1](https://github.com/Alpha-Oi/next-skill-router/discussions/1).
Any change to this spec requires a 7-day public comment period.
