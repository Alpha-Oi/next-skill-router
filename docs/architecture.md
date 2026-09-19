# Архитектура

## Слои

- CLI → Core (indexer → search → ranker → composer)
- Learner | Telemetry | Storage
- Файловая система (~/.claude/skills, ~/.claude/skill-router)

## Поток данных

1. SessionStart → analyze-project.mjs → сканирование + индексация
2. Запрос → search.mjs → гибридный поиск → ранжирование → план
3. Ответ → рекомендации в Claude Code
4. Выбор → collector → обратная связь → корректировка весов
5. Метрики → telemetry → JSONL + дашборд
