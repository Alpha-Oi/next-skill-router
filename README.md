# next-skill-router

> **Cost-aware, local-first skill routing** for AI agents. MCP server, CLI, and experimental Claude Code hook.

[![Status](https://img.shields.io/badge/status-alpha-yellow)](https://github.com/Alpha-Oi/next-skill-router)
[![Tests](https://img.shields.io/badge/tests-45_passing-success)](https://github.com/Alpha-Oi/next-skill-router)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Spec](https://img.shields.io/badge/spec-SKILL--MANIFEST_v0.3.1-purple)](./spec/SKILL-MANIFEST.md)
[![Discussions](https://img.shields.io/badge/discussions-4_open-orange)](https://github.com/Alpha-Oi/next-skill-router/discussions)

---

## What this is

Most AI agents (Claude Code, Codex, Cursor, Windsurf) already route to skills — they read SKILL.md files and pick the best match. **That part is solved.**

What's **not** solved:

| Problem | Who solves it |
| :--- | :--- |
| **Cost-aware routing** — pick the cheapest model that can do the job, with a $ budget | ❌ nobody |
| **Local-first** — route to Ollama/vLLM/LM Studio for privacy/offline | ❌ nobody |
| **Feedback loop** — remember which skill you actually chose | ❌ nobody |
| **Secret redaction** — never cache API keys from queries | ❌ nobody |
| **Open manifest standard** — one format for all routers | ❌ fragmentation |

`next-skill-router` fixes these five. It is (1) an open standard — **SKILL-MANIFEST v0.3.1** — that any router can adopt, and (2) a reference implementation with CLI, MCP server, and a Claude Code hook.

---

## Quick demo

Cost-aware routing:

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

Budget-constrained:

```
$ node packages/cli/bin/router.mjs search "run tests" --budget-usd 0.01 --explain

Query: run tests
Total skills: 47 | mode: hybrid
Policy: budget=$0.01

    32.8  ####################  test-runner
           Model:         deepseek-v4-flash (cloud_budget, deepseek)
           Est. cost:     $0.0002
```

Secrets are redacted before they touch disk:

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

**Optional:** [Ollama](https://ollama.com/) with `qwen3:7b` for local-first routing ($0, offline).

---

## Three ways to use it

### 1. CLI (universal)

```bash
# Search
node packages/cli/bin/router.mjs search "run tests"
node packages/cli/bin/router.mjs search "refactor" --explain
node packages/cli/bin/router.mjs search "review code" --budget-usd 0.01
node packages/cli/bin/router.mjs search "refactor" --local-only

# Inspect
node packages/cli/bin/router.mjs list
node packages/cli/bin/router.mjs show autopilot
node packages/cli/bin/router.mjs validate

# Feedback loop
node packages/cli/bin/router.mjs feedback \
  --query "проверь код" \
  --recommended "code-review,refactor-assistant" \
  --chosen code-review \
  --outcome accept

node packages/cli/bin/router.mjs stats --period 7
node packages/cli/bin/router.mjs weights
```

### 2. MCP server (Claude Desktop, Cursor, Windsurf)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "next-skill-router": {
      "command": "node",
      "args": ["D:/next-skill-router/integrations/mcp-server/server.mjs"]
    }
  }
}
```

**Three tools exposed:**
- `search_skills` — find skills by query with cost-aware model selection
- `list_skills` — all installed skills
- `validate_skills` — lint SKILL.md files

See [`integrations/mcp-server/README.md`](./integrations/mcp-server/README.md).

### 3. Claude Code hook (experimental)

```bash
node packages/cli/bin/router.mjs init
```

Adds a SessionStart hook that injects a skill list into the session context.

**Note:** Claude Code has its own built-in `available_skills` mechanism. This hook adds a *second* list — useful for cross-checking but not a replacement. See [`integrations/claude-code/README.md`](./integrations/claude-code/README.md).

---

## What makes this different

| Feature | Claude Code native | cc-skill-router | hussi9 | Fabi-SPL | skillogy | **next-skill-router** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Skill routing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Open manifest standard | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cost-aware model selection | ❌ | ❌ | partial | ❌ | ❌ | ✅ |
| Local-first (Ollama/vLLM) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Feedback loop | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Semantic + lexical hybrid | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Secret redaction at ingest | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Formal gates (pre/post) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| MCP server | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

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

Local runtimes use the OpenAI-compatible API.

---

## Status

| Phase | What | Status |
| :--- | :--- | :--- |
| 0. Spec | SKILL-MANIFEST v0.3.1 | ✅ |
| 1. Core MVP | Indexer, lexical search, CLI | ✅ |
| 2. Semantic | ONNX MiniLM + RRF hybrid | ✅ |
| 2.5. Cost-aware | Model selector, budget flags, local-first | ✅ |
| 2.6. Safety | Secret redaction, gates framework | ✅ |
| 3. Feedback loop | Learn from actual choices | ✅ |
| 6. Ecosystem | MCP server, Claude Code hook | ✅ |
| 4. Composer | DAG planner + synthesizer | ⏳ next |
| 5. Telemetry + UI | Spans, metrics, dashboard | ⏳ |

**45/45 tests passing.**

---

## Design principles

1. **Standard over implementation.** Manifest is CC-BY-4.0; any router can adopt it.
2. **Every decision is explainable.** `--explain` shows why.
3. **Secrets never leave your machine.** Redaction at ingest.
4. **Local-first.** Nothing leaves the machine unless you opt in.
5. **No lock-in.** SKILL.md works without any manifest.
6. **Open gates.** Declarative pre/post checks; host executes them.

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

Discussions: [GitHub Discussions](https://github.com/Alpha-Oi/next-skill-router/discussions)

- **#1 — [RFC] SKILL-MANIFEST** — shape the standard
- **#2 — Roadmap** — priorities
- **#3 — Call for contributors** — TS devs, local-model folks
- **#4 — [RFC] Multi-provider + local-first** — provider selection logic

Before sending a PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

Code — MIT. Specification — CC-BY-4.0.
