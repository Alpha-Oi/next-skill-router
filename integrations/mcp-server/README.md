# MCP server

MCP-сервер для `next-skill-router`. Работает с любым MCP-клиентом:
Claude Desktop, Cursor, Windsurf, Continue, Zed.

## Установка

### Claude Desktop

Откройте конфиг:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Добавьте сервер:

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

Перезапустите Claude Desktop.

### Cursor

Settings → MCP → Add Server:

```json
{
  "next-skill-router": {
    "command": "node",
    "args": ["D:/next-skill-router/integrations/mcp-server/server.mjs"]
  }
}
```

### Windsurf

Аналогично, через `~/.codeium/windsurf/mcp_config.json`.

## Инструменты

### `search_skills`

Найти навык по запросу.

**Input:**
```json
{
  "query": "проверь мой код",
  "limit": 5,
  "budget_usd": 0.01,
  "local_only": false
}
```

**Output:** ранжированный список кандидатов с моделью и стоимостью.

### `list_skills`

Список всех установленных навыков.

### `validate_skills`

Проверка SKILL.md файлов.

## Проверка

Ручной запуск:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | node integrations/mcp-server/server.mjs
```

Должны увидеть JSON-ответ.

## Ограничения

- **Stdio only.** HTTP-транспорт — в планах.
- **Один клиент.** Сервер не расчитан на параллельные соединения.
- **Логи в stderr.** Stdout зарезервирован под JSON-RPC.
