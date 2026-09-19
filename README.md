# next-skill-router

> An open standard for routing skills across Claude Code and Codex — with cost-aware model selection, a feedback loop, and local-first execution.

[![Status](https://img.shields.io/badge/status-alpha-yellow)](https://github.com/Alpha-Oi/next-skill-router)
[![Tests](https://img.shields.io/badge/tests-8_passing-success)](https://github.com/Alpha-Oi/next-skill-router/actions)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Spec](https://img.shields.io/badge/spec-SKILL--MANIFEST_v0.2-purple)](./spec/SKILL-MANIFEST.md)
[![Discussions](https://img.shields.io/badge/discussions-4_open-orange)](https://github.com/Alpha-Oi/next-skill-router/discussions)

---

## Why this exists

Two problems, one solution.

**Problem 1 — the format fragmentation.** Existing skill routers for Claude Code and Codex
([`cc-skill-router`](https://github.com/Alpha-Oi/cc-skill-router), `hussi9/skill-router`,
`Fabi-SPL/skill-router`, `skill-router-mcp`, `skillogy`) each invented their own metadata
format. Authors write a manifest once, and it only works for one router.

**Problem 2 — the five missing features.** No router currently does all of these:

1. **Cost-aware routing** — pick the cheapest model that can do the job, per step.
2. **Feedback loop** — learn from which skill you actually chose, not what was recommended.
3. **Dynamic composition** — build a DAG of skills for multi-step tasks, not just a single pick.
4. **Observability** — explain *why* a skill was chosen (`--explain`).
5. **Local-first** — run on Ollama/vLLM/LM Studio; offline mode; GDPR/HIPAA-compliant.

`next-skill-router` is (1) an open, optional standard — **SKILL-MANIFEST** — that any router
can adopt, and (2) a reference implementation that fixes all five.

---

## Quick demo

```
$ node packages/cli/bin/router.mjs search "run tests" --explain

Query: run tests
Total skills: 11

  35.388  test-runner
         Base lexical:  35.388
         Prerequisites: OK
         Auto-invoke:   allowed
         -----------------------------
         Final:         35.388
         Matched terms: run, runner, tests, test
         Source:        frontmatter
```

---

## Install

```bash
git clone https://github.com/Alpha-Oi/next-skill-router
cd next-skill-router
npm install
```

**Requirements:** Node.js 20+, git.

Optional (for future semantic search): none — it will use a bundled ONNX model.

---

## Usage

### List installed skills

```bash
node packages/cli/bin/router.mjs list
```

Output:
```
Found 11 skills:

  code-review                  [frontmatter]
     Проверка качества кода и выявление типичных ошибок.
  test-runner                  [frontmatter]
     Запуск и анализ тестов проекта.
  ...
```

### Search for a skill

```bash
node packages/cli/bin/router.mjs search "run tests"
node packages/cli/bin/router.mjs search "проверь код" --json
node packages/cli/bin/router.mjs search "refactor" --limit 3 --explain
```

### Validate SKILL.md files

```bash
node packages/cli/bin/router.mjs validate
```

Checks frontmatter, required fields, name format, SemVer.

### Run tests

```bash
npm test
```

---

## SKILL-MANIFEST (v0.2)

Optional. Routers **must** work without it, using plain `SKILL.md` as fallback.
Adding a manifest raises routing precision; it is not a lock-in.

```yaml
---
name: code-review
version: 1.3.0
description: "Check code quality and flag common mistakes."
intents:
  - "проверить качество кода"
  - "code quality check"
  - "review my changes"

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
---
```

Full schema: [`spec/SKILL-MANIFEST.md`](./spec/SKILL-MANIFEST.md).
Providers matrix: [`spec/PROVIDERS.md`](./spec/PROVIDERS.md).

---

## Supported providers

| Tier | Providers |
| :--- | :--- |
| **cloud_frontier** | Claude Fable 5, Opus 5; GPT-6 Astra, GPT-5.6 Sol; Gemini 3.6 Flash; DeepSeek V4 Pro; Qwen 3.6-Plus |
| **cloud_budget** | Claude Sonnet 5, Haiku 4.5; GPT-5.6 Terra/Luna; Gemini Flash-Lite; DeepSeek V4 Flash; Mistral Large 3; Qwen 3.6-Flash |
| **local** | Qwen 3 7B, Llama 3.3 8B, Mistral Small 3, Phi-4-mini via Ollama / vLLM / LM Studio |
| **specialized** | Gemini 3.5 Flash Cyber; Qwen 3.6-Flash (vision) |

Local runtimes use the OpenAI-compatible API, so they plug into the same code path.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  SessionStart hook  (Claude Code)                       │
│  UserPromptSubmit   (Codex)                             │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Indexer                                                │
│  scanner → manifest → validator → embedding (ONNX)      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Search                                                 │
│  lexical (BM25/MiniSearch) + semantic (MiniLM) → RRF    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Ranker                                                 │
│  relevance + prerequisites + cost − penalties           │
│  → model_plan (which provider, which tier, why)         │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Composer                                               │
│  DAG of skills (sequential | async | hybrid)            │
│  + compaction-guard + safety-checker                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Feedback loop                                          │
│  collector → weights update (local only)                │
└─────────────────────────────────────────────────────────┘
```

---

## Status

**Phase 1 — Core MVP — done.**

| Phase | What | Status |
| :--- | :--- | :--- |
| 0. Spec | SKILL-MANIFEST, ROUTER-PROTOCOL, PROVIDERS | ✅ v0.2 |
| 1. Core MVP | Indexer, lexical search, CLI, tests | ✅ |
| 2. Cost-aware | Model selector wired into routing | ⏳ next |
| 3. Feedback loop | Learn from user's actual choices | ⏳ |
| 4. Composer | DAG planner + synthesizer | ⏳ |
| 5. Telemetry + UI | Spans, metrics, dashboard | ⏳ |
| 6. Ecosystem | MCP server, adapters to competitors | ⏳ |

---

## Design principles

1. **Standard over implementation.** The manifest is published under CC-BY-4.0 and any router may adopt it.
2. **Every decision is explainable.** Users always see *why* — what matched, what penalized, what the cost is.
3. **The system learns.** Ignoring a recommendation is a signal, not a loss.
4. **Local-first.** Nothing leaves the machine unless you opt in.
5. **Forward-compatible.** Unknown manifest fields are ignored, not rejected.

---

## Privacy

- **Local embeddings** via ONNX MiniLM. No network calls by default.
- **Feedback data** stored in `~/.claude/skill-router/` — never transmitted.
- **No telemetry.** Metrics exist only for you.
- Opt-in remote embeddings: `--allow-remote-embeddings`.

Details: [`docs/privacy.md`](./docs/privacy.md).

---

## Contributing

All discussions happen in [GitHub Discussions](https://github.com/Alpha-Oi/next-skill-router/discussions):

- **#1 — [RFC] SKILL-MANIFEST v0.2** — shape the standard.
- **#2 — Roadmap & priorities** — what should Phase 2 focus on?
- **#3 — Call for contributors** — mentors, local-model folks, TS devs.
- **#4 — [RFC] Multi-provider & local-first architecture** — provider selection logic.

Before sending a PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md).

For spec changes: open an RFC issue with the `spec` label. 7-day public comment period.

---

## License

Code — MIT. Specification — CC-BY-4.0.
