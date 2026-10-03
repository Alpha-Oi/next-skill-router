# next-skill-router

> **Cost-aware, local-first skill routing** for AI agents. Tested on **141 real skills**. MCP server, CLI, and Claude Code hook.

[![Status](https://img.shields.io/badge/status-v1.0-green)](https://github.com/Alpha-Oi/next-skill-router)
[![Tests](https://img.shields.io/badge/tests-50_passing-success)](https://github.com/Alpha-Oi/next-skill-router)
[![Skills tested](https://img.shields.io/badge/skills-141_tested-blue)](https://github.com/Alpha-Oi/next-skill-router)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![Spec](https://img.shields.io/badge/spec-SKILL--MANIFEST_v0.3.1-purple)](./spec/SKILL-MANIFEST.md)

---

## Why this exists

Most AI agents (Claude Code, Codex, Cursor, Windsurf) already route to skills. **That part is solved.**

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

## Quick demo — 141 skills, real output

```
$ node packages/cli/bin/router.mjs search "review my API design" --explain

Query: review my API design
Total skills: 141 | mode: hybrid

    32.8  ####################  api-design-reviewer
           Lexical:       157.8
           Semantic:      0.753
           Fused (base):  32.8
           Matched terms: review, reviewing, reviewer, api, apis, design
           Model:         qwen3:7b (local, ollama)
           Model reason:  cheapest in tier=local
           Est. cost:     $0 (offline)

    31.5  ###################  senior-backend
           Lexical:       41.5
           Semantic:      0.355
           Model:         qwen3:7b (local, ollama)
           Est. cost:     $0 (offline)
```

Cost-aware with budget:

```
$ node packages/cli/bin/router.mjs search "design a REST API" --budget-usd 0.01 --explain

Query: design a REST API
Total skills: 141 | mode: hybrid
Policy: budget=$0.01

    32.5  ####################  api-designer
           Model:         qwen3:7b (local, ollama)
           Est. cost:     $0 (offline)
```

Secrets are redacted before they touch disk:

```
$ node packages/cli/bin/router.mjs search "fix code with sk-abcdefghijklmnopqrstuvwx"

After stopword filter: "fix code [REDACTED:OPENAI_API_KEY]"
```

---

## Quick start

### Option 1 — Local install (Node.js)

```bash
git clone https://github.com/Alpha-Oi/next-skill-router
cd next-skill-router
npm install

# Run a search
node packages/cli/bin/router.mjs search "review my API design" --explain
```

**Requirements:** Node.js 20+, git.

**Optional:** [Ollama](https://ollama.com/) with `qwen3:7b` for local-first routing ($0, offline).

### Option 2 — Docker

```bash
docker run --rm -it -v "$HOME/.claude:/root/.claude" \
  ghcr.io/alpha-oi/next-skill-router:latest \
  search "review my API design" --explain
```

Or with Ollama running on the host:

```bash
docker run --rm -it \
  -v "$HOME/.claude:/root/.claude" \
  --add-host=host.docker.internal:host-gateway \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  ghcr.io/alpha-oi/next-skill-router:latest \
  search "refactor my code" --local-only
```

### Option 3 — Docker Compose (with Ollama)

```bash
docker compose up -d

# Now the router can use local models
docker compose exec router node packages/cli/bin/router.mjs search "review code" --local-only
```

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

# Composer (multi-step plans)
node packages/cli/bin/router.mjs compose "add a feature X with tests and review"

# Feedback loop
node packages/cli/bin/router.mjs feedback \
  --query "review code" \
  --recommended "code-review,code-reviewer" \
  --chosen code-reviewer \
  --outcome accept

node packages/cli/bin/router.mjs stats --period 7
node packages/cli/bin/router.mjs weights

# Telemetry
node packages/cli/bin/router.mjs telemetry --open
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

### 3. Claude Code hook (experimental)

```bash
node packages/cli/bin/router.mjs init
```

Adds a SessionStart hook that injects a skill list into the session context.

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
| Multi-step composition (DAG) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Telemetry + dashboard | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| MCP server | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Status

**v1.0.0 — complete.** All 9 phases done, 50 tests passing, tested on 141 real skills.

| Phase | What | Status |
| :--- | :--- | :--- |
| 0. Spec | SKILL-MANIFEST v0.3.1 | ✅ |
| 1. Core MVP | Indexer, lexical search, CLI | ✅ |
| 2. Semantic | ONNX MiniLM + RRF hybrid | ✅ |
| 2.5. Cost-aware | Model selector, budget flags, local-first | ✅ |
| 2.6. Safety | Secret redaction, gates framework | ✅ |
| 3. Feedback loop | Learn from actual choices | ✅ |
| 4. Composer | DAG planner + synthesizer | ✅ |
| 5. Telemetry | Spans, metrics, dashboard | ✅ |
| 6. Ecosystem | MCP server, Claude Code hook | ✅ |

---

## Design principles

1. **Standard over implementation.** Manifest is CC-BY-4.0; any router can adopt it.
2. **Every decision is explainable.** `--explain` shows why.
3. **Secrets never leave your machine.** Redaction at ingest.
4. **Local-first.** Nothing leaves the machine unless you opt in.
5. **No lock-in.** SKILL.md works without any manifest.

---

## Privacy

- **Local embeddings** via ONNX MiniLM. No network calls by default.
- **Secret redaction** at ingest — before any file write.
- **No telemetry sent anywhere.** Metrics exist only for you.

---

## Contributing

Discussions: [GitHub Discussions](https://github.com/Alpha-Oi/next-skill-router/discussions)

Before sending a PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

Code — MIT. Specification — CC-BY-4.0.
