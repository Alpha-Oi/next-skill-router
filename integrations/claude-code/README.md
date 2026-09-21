# Claude Code integration

SessionStart hook для Claude Code, который инжектирует индекс установленных
навыков в контекст сессии.

## Установка

```bash
node integrations/claude-code/install.mjs
```

Скрипт добавит в `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/path/to/hook.mjs\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

## Как это работает

1. Claude Code запускает сессию.
2. Срабатывает SessionStart hook → запускает `hook.mjs`.
3. Hook сканирует `~/.claude/skills` и `./.claude/skills`.
4. Возвращает JSON: `{ hookSpecificOutput: { additionalContext: "..." } }`.
5. Claude Code инжектирует `additionalContext` в системный промпт.

Результат: Claude знает о всех установленных навыках без ручного поиска.

## Ручная установка

Если не хотите запускать install.mjs — добавьте в `~/.claude/settings.json`
вручную:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/абсолютный/путь/к/hook.mjs\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

**Windows:** используйте прямые слеши `/` или двойные `\\\\`.

## Удаление

Откройте `~/.claude/settings.json`, найдите блок `hooks.SessionStart`
с `next-skill-router` в команде, удалите его.

## Отладка

Проверить, что hook работает:

```bash
node integrations/claude-code/hook.mjs
```

Должен вывести JSON с `additionalContext`. Если пусто — значит навыков в
`~/.claude/skills` нет, или возникла ошибка (hook silent, не блокирует).
