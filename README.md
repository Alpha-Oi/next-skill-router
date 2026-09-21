# next-skill-router

> An open standard for routing skills across Claude Code and Codex — with cost-aware model selection, secret redaction, and local-first execution.

[![Status](https://img.shields.io/badge/status-alpha-yellow)](https://github.com/Alpha-Oi/next-skill-router)
[![Tests](https://img.shields.io/badge/tests-32_passing-success)](https://github.com/Alpha-Oi/next-skill-router)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Spec](https://img.shields.io/badge/spec-SKILL--MANIFEST_v0.3.1-purple)](./spec/SKILL-MANIFEST.md)
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
$ node packages/cli/bin/router.mjs search "проверь код" --explain

Query: проверь код
Total skills: 47 | mode: hybrid

    32.5  ####################  code-review
           Lexical:       8.7
           Semantic:      0.517
           Fused (base):  32.5
           Prerequisites: OK
           Auto-invoke:   allowed
           --------------------------------
           Final:         32.5
           Matched terms: код, кода
           Source:        frontmatter
           Model:         qwen3:7b (local, ollama)
           Model reason:  cheapest in tier=local
           Est. cost:     $0 (offline)
```

Cost-aware:

```
$ node packages/cli/bin/router.mjs search "run tests" --budget-usd 0.01 --explain

Query: run tests
Total skills: 47 | mode: hybrid
Policy: budget=$0.01

    32.8  ####################  test-runner
           Model:         deepseek-v4-flash (cloud_budget, deepseek)
           Est. cost:     $0.0002
```

Secrets are redacted at ingest:

```
$ node packages/cli/bin/router.mjs search "fix code with sk-abcdefghijklmnopqrstuvwx" --no-semantic

Query: fix code with sk-abcdefghijklmnopqrstuvwx
After stopword filter: "fix code [REDACTED:OPENAI_API_KEY]"
```

---

## Install

```bash
git clone https://github.com/Alpha-Oi/next-skill-router
cd next-skill-router
npm install
```

**Requirements:** Node.js 20+, git.

Optional: [Ollama](https://ollama.com/) with `qwen3:7b` for local-first routing ($0, offline).

---

## Usage

### Search with cost-aware routing

```bash
# Basic
node packages/cli/bin/router.mjs search "run tests"

# Explain the scoring
node packages/cli/bin/router.mjs search "refactor this module" --explain

# Budget-constrained
node packages/cli/bin/router.mjs search "review my code" --budget-usd 0.01

# Local models only (offline, free)
node packages/cli/bin/router.mjs search "refactor" --local-only

# Pure lexical (fast, no model download)
node packages/cli/bin/router.mjs search "run tests" --no-semantic
```

### Other commands

```bash
# List all installed skills
node packages/cli/bin/router.mjs list

# Show full metadata for one skill
node packages/cli/bin/router.mjs show autopilot

# Validate SKILL.md files
node packages/cli/bin/router.mjs validate

# Run tests
npm test
```

---

## SKILL-MANIFEST (v0.3.1)

Optional. Routers **must** work without it, using plain `SKILL.md` as fallback.

```yaml
---
name: code-review
version: 1.3.0
description: "Check code quality and flag common mistakes."
argument_hint: "<files-or-diff>"
intents:
  - "проверить качество кода"
  - "code quality check"

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

gates:
  pre: [dependencies_installed, git_clean]
  post: [tests_pass, no_secrets_in_diff]
  blind_acceptance: true

secrets_policy:
  never_request: true
  redact_at_ingest: true
  allowed_env_vars: [OPENAI_API_KEY]

execution_mode: sequential
---
```

Full schema: [`spec/SKILL-MANIFEST.md`](./spec/SKILL-MANIFEST.md).

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
│  scanner → manifest → validator → redactor → embedder   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Search                                                 │
│  lexical (BM25/MiniSearch) + semantic (MiniLM) → RRF    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Ranker                                                 │
│  relevance + prerequisites − penalties                  │
│  + model_plan (provider, tier, cost, availability)      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Gates                                                  │
│  pre: dependencies_installed, git_clean                 │
│  post: tests_pass, no_secrets_in_diff                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Composer (planned)                                     │
│  DAG of skills (sequential | async | hybrid)            │
└─────────────────────────────────────────────────────────┘
```

---

## Status

**Phase 2.5 — Cost-aware + lazy loading — done.**
**Phase 2.6 — Gates + secrets policy — done.**

| Phase | What | Status |
| :--- | :--- | :--- |
| 0. Spec | SKILL-MANIFEST, ROUTER-PROTOCOL, PROVIDERS | ✅ v0.3.1 |
| 1. Core MVP | Indexer, lexical search, CLI, tests | ✅ |
| 2. Semantic | ONNX MiniLM + RRF hybrid | ✅ |
| 2.5. Cost-aware | Model selector, budget flags, local-first | ✅ |
| 2.6. Safety | Secret redaction, gates framework | ✅ |
| 3. Feedback loop | Learn from user's actual choices | ⏳ next |
| 4. Composer | DAG planner + synthesizer | ⏳ |
| 5. Telemetry + UI | Spans, metrics, dashboard | ⏳ |
| 6. Ecosystem | MCP server, adapters to competitors | ⏳ |

---

## Design principles

1. **Standard over implementation.** The manifest is published under CC-BY-4.0.
2. **Every decision is explainable.** `--explain` shows why.
3. **Secrets never leave your machine.** Redaction at ingest.
4. **Local-first.** Nothing leaves the machine unless you opt in.
5. **No lock-in.** SKILL.md works without any manifest.

---

## Privacy

- **Local embeddings** via ONNX MiniLM. No network calls by default.
- **Secret redaction** at ingest — before any file write.
- **No telemetry.** Metrics exist only for you.
- Details: [`docs/privacy.md`](./docs/privacy.md).

---

## Analysis and design docs

- [`docs/analysis/autopilot-patterns.md`](./docs/analysis/autopilot-patterns.md) — 5 architectural patterns extracted from a reference skill
- [`docs/analysis/autopilot-deep-dive.md`](./docs/analysis/autopilot-deep-dive.md) — detailed analysis
- [`docs/analysis/nick-vels-skills.md`](./docs/analysis/nick-vels-skills.md) — initial scan

---

## Contributing

All discussions happen in [GitHub Discussions](https://github.com/Alpha-Oi/next-skill-router/discussions):

- **#1 — [RFC] SKILL-MANIFEST** — shape the standard.
- **#2 — Roadmap & priorities** — what should Phase 3 focus on?
- **#3 — Call for contributors** — mentors, local-model folks, TS devs.
- **#4 — [RFC] Multi-provider & local-first architecture** — provider selection logic.

Before sending a PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

Code — MIT. Specification — CC-BY-4.0.
