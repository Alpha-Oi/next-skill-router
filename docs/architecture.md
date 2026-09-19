# Architecture

## Layers

```
+-------------------------------------------------+
|  CLI                                            |
|  search / list / validate / explain / stats     |
+----------------------+--------------------------+
                       |
+----------------------v--------------------------+
|  Core                                           |
|  indexer -> search -> ranker -> composer        |
+----------------------+--------------------------+
                       |
+----------------------v--------------------------+
|  Learner  |  Telemetry  |  Storage              |
+----------------------+--------------------------+
                       |
+----------------------v--------------------------+
|  Filesystem                                     |
|  ~/.claude/skills  |  ~/.claude/skill-router    |
+-------------------------------------------------+
```

## Data flow

1. **SessionStart** -> `analyze-project.mjs` -> scan + index.
2. **Query** -> `search.mjs` -> hybrid retrieval -> ranking -> plan.
3. **Response** -> recommendations back to the host.
4. **Choice** -> `collector.ts` -> feedback -> weight update.
5. **Metrics** -> `telemetry` -> JSONL + dashboard.

## Technologies

| Component | Choice |
| :--- | :--- |
| Language | TypeScript / Node 20+ |
| Lexical search | MiniSearch (BM25-based) |
| Semantic search | @xenova/transformers (ONNX MiniLM) |
| Ranking fusion | Reciprocal Rank Fusion (RRF) |
| Storage | SQLite + JSONL |
| CLI | Commander.js |
| Build | tsup |
| Tests | Vitest |
