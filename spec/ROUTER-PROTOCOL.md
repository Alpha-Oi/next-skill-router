# ROUTER-PROTOCOL v0.2 (Draft RFC)

**Статус:** Draft
**Изменения в v0.2:** model_plan, execution_mode, steering, compaction_guard.

---

## 1. Назначение

Формат обмена между роутером и хостом (Claude Code, Codex, MCP, CLI).

---

## 2. Точки взаимодействия

### 2.1 search

**Вход:**

```json
{
  "protocol_version": "0.2",
  "query": "добавь фичу X с тестами",
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

**Выход:**

```json
{
  "protocol_version": "0.2",
  "plan": [
    {
      "skill": "code-writer",
      "score": 0.94,
      "reason": "semantic_match: 'добавь фичу'",
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
  "total_cost": { "tokens": 12000, "usd": 0.008 },
  "decision_time_ms": 34,
  "steering": { "supported": true },
  "compaction_guard": { "enabled": true }
}
```

### 2.2 feedback

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

### 2.3 steering

```json
{
  "protocol_version": "0.2",
  "trace_id": "abc123",
  "steering": {
    "action": "modify",
    "step": 2,
    "note": "не делай ревью, только тесты"
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

## 3. Коды ошибок

| Код | Значение |
| :--- | :--- |
| E_NO_MATCH | Ни один навык не подошёл |
| E_BUDGET_EXCEEDED | Все кандидаты вне бюджета |
| E_PREREQ_FAILED | Не выполнены предпосылки |
| E_INDEX_STALE | Требуется переиндексация |
| E_NO_LOCAL_RUNTIME | Нужна локальная модель, runtime не установлен |
| E_OFFLINE_BLOCKED | Требуется offline, локальная модель недоступна |
| E_SAFETY_BLOCK | Сработала защита |

---

## 4. Версионирование

SemVer. Хост обязан указывать protocol_version. Роутеры обязаны игнорировать
неизвестные поля (forward compatibility).

---

## 5. Транспорт

- stdin/stdout JSON-RPC — CLI.
- HTTP POST — MCP-сервер.
- JSONL — телеметрия.

Кодировка UTF-8. Content-Type application/json.
