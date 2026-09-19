# ROUTER-PROTOCOL v0.2 (Draft RFC)

**Status:** Draft
**Changes in v0.2:** added `model_plan`, `execution_mode`, `steering`, `compaction_guard`.

---

## 1. Purpose

Defines the data exchange format between a router and a host (Claude Code, Codex,
MCP server, CLI). Any router supporting this protocol can exchange indexes and
recommendation results.

---

## 2. Interaction points

### 2.1 search — request recommendations

**Input:**

```json
{
  "protocol_version": "0.2",
  "query": "add feature X with tests",
  "project_context": {
    "files": ["package.json", ".git/config"],
    "git_dirty": true,
    "language": "typescript",
    "policy": {
      "require_local_only": false,
      "require_offline": false,
      "data_residency": "EU"
    }
  },
  "budget": { "tokens": 50000, "usd": 0.10 },
  "constraints": {
    "exclude": ["auto-commit"],
    "require_prerequisites": true
  }
}
```

**Output:**

```json
{
  "protocol_version": "0.2",
  "plan": [
    {
      "skill": "code-writer",
      "score": 0.94,
      "reason": "semantic_match: add feature",
      "cost": { "tokens": 8000, "usd": 0.003 },
      "prerequisites_met": true,
      "model_plan": {
        "tier": "cloud_budget",
        "model": "gpt-5.6-luna",
        "reasoning": "low"
      },
      "execution_mode": "sequential"
    },
    {
      "skill": "test-runner",
      "score": 0.89,
      "reason": "composable_with: code-writer",
      "model_plan": {
        "tier": "local",
        "model": "qwen-3-7b",
        "runtime": "ollama"
      },
      "execution_mode": "async"
    }
  ],
  "alternatives": [
    {
      "skill": "full-feature-pipeline",
      "score": 0.81,
      "reason": "ready-made chain, but +30% cost"
    }
  ],
  "total_cost": { "tokens": 12000, "usd": 0.008 },
  "decision_time_ms": 34,
  "steering": { "supported": true },
  "compaction_guard": { "enabled": true }
}
```

### 2.2 feedback — user choice

```json
{
  "protocol_version": "0.2",
  "trace_id": "abc123",
  "chosen": "code-writer",
  "recommended": ["code-writer", "test-runner", "code-review"],
  "outcome": "accepted",
  "steering_events": 0
}
```

### 2.3 steering — mid-turn adjustment

```json
{
  "protocol_version": "0.2",
  "trace_id": "abc123",
  "steering": {
    "action": "modify",
    "step": 2,
    "note": "skip review, run tests only"
  }
}
```

### 2.4 safety_event

```json
{
  "protocol_version": "0.2",
  "trace_id": "abc123",
  "type": "compaction.blocked",
  "reason": "detected self-injection pattern",
  "model": "gpt-6-astra",
  "action_taken": "rollback"
}
```

---

## 3. Error codes

| Code | Meaning |
| :--- | :--- |
| E_NO_MATCH | No skill matched |
| E_BUDGET_EXCEEDED | All candidates exceed budget |
| E_PREREQ_FAILED | Prerequisites not met |
| E_INDEX_STALE | Reindex required |
| E_NO_LOCAL_RUNTIME | Local model required, runtime missing |
| E_OFFLINE_BLOCKED | Offline required, local model unavailable |
| E_SAFETY_BLOCK | Safety guard triggered |

---

## 4. Versioning

SemVer. The host **must** send `protocol_version`. Routers **must** ignore
unknown fields (forward compatibility).

---

## 5. Transport

- stdin/stdout JSON-RPC — for CLI.
- HTTP POST — for MCP servers.
- JSONL files — for telemetry.

UTF-8. Content-Type: application/json.
