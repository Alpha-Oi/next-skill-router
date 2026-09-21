#!/usr/bin/env node
/**
 * MCP-сервер для next-skill-router.
 *
 * Реализует MCP 2024-11-05 (stdio JSON-RPC 2.0).
 * Работает с любым MCP-клиентом: Claude Desktop, Cursor, Windsurf, Continue.
 *
 * Инструменты:
 *   - search: найти навык по запросу
 *   - list_skills: список всех навыков
 *   - validate: проверить SKILL.md
 *
 * Запуск:
 *   node integrations/mcp-server/server.mjs
 * или через конфиг клиента (см. README.md).
 */

import { stdin, stdout } from 'node:process';
import { loadSkills, route } from '../../packages/core/src/router.mjs';

const SERVER_INFO = {
  name: 'next-skill-router',
  version: '0.1.0'
};

const PROTOCOL_VERSION = '2024-11-05';

const TOOLS = [
  {
    name: 'search_skills',
    description: 'Find the best skills for a natural language query. Returns ranked candidates with reasons and cost estimates.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of what you want to do'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of candidates to return (default: 5)',
          default: 5
        },
        budget_usd: {
          type: 'number',
          description: 'Maximum cost per call in USD (optional)'
        },
        local_only: {
          type: 'boolean',
          description: 'Use only local models (Ollama/vLLM/LM Studio), no cloud',
          default: false
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_skills',
    description: 'List all installed skills with their descriptions.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'validate_skills',
    description: 'Validate all SKILL.md files (frontmatter, required fields).',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

function log(obj) {
  // В MCP логи идут в stderr, чтобы не портить stdout
  process.stderr.write('[mcp] ' + JSON.stringify(obj) + '\n');
}

function send(obj) {
  stdout.write(JSON.stringify(obj) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

// ─── Handlers ─────────────────────────────────────────────────────

async function handleInitialize(id) {
  reply(id, {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO
  });
}

async function handleToolsList(id) {
  reply(id, { tools: TOOLS });
}

async function handleToolsCall(id, params) {
  const { name, arguments: args } = params || {};

  try {
    if (name === 'search_skills') {
      const result = await route(args.query, {
        limit: args.limit || 5,
        maxCostUsd: args.budget_usd,
        localOnly: !!args.local_only,
        semantic: true
      });

      const text = result.candidates.map((c, i) =>
        (i + 1) + '. ' + c.name + ' (score ' + c.score.toFixed(1) + ')' +
        (c.model_plan && !c.model_plan.error ? ' — model: ' + c.model_plan.model + ' ($' + c.model_plan.estimated_cost_usd + ')' : '') +
        '\n   ' + (c.reason || '')
      ).join('\n');

      reply(id, {
        content: [{
          type: 'text',
          text: result.candidates.length > 0
            ? 'Found ' + result.candidates.length + ' skills for "' + args.query + '":\n\n' + text
            : 'No skills found for "' + args.query + '"'
        }],
        structuredContent: result
      });
      return;
    }

    if (name === 'list_skills') {
      const skills = await loadSkills();
      const text = skills.map((s) => '- **' + s.name + '** — ' + (s.description || '(no description)').slice(0, 120)).join('\n');
      reply(id, {
        content: [{
          type: 'text',
          text: 'Found ' + skills.length + ' skills:\n\n' + text
        }],
        structuredContent: { total: skills.length, skills }
      });
      return;
    }

    if (name === 'validate_skills') {
      const { validateAll } = await import('../../packages/core/src/indexer/validator.mjs');
      const { homedir } = await import('node:os');
      const { join } = await import('node:path');
      const roots = [
        join(homedir(), '.claude', 'skills'),
        join(process.cwd(), '.claude', 'skills')
      ];
      const results = await validateAll(roots);
      const errs = results.flatMap((r) => r.errors);
      const warns = results.flatMap((r) => r.warnings);

      reply(id, {
        content: [{
          type: 'text',
          text: 'Validated ' + results.length + ' skills: ' + errs.length + ' errors, ' + warns.length + ' warnings'
        }],
        structuredContent: { total: results.length, errors: errs, warnings: warns }
      });
      return;
    }

    error(id, -32601, 'Unknown tool: ' + name);
  } catch (e) {
    log({ err: e.message, stack: e.stack });
    error(id, -32603, 'Tool execution failed: ' + e.message);
  }
}

// ─── Main loop ────────────────────────────────────────────────────

async function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    log({ err: 'invalid JSON', line: line.slice(0, 200) });
    return;
  }

  const { id, method, params } = msg;

  if (method === 'initialize') return handleInitialize(id);
  if (method === 'notifications/initialized') return; // notification, no reply
  if (method === 'tools/list') return handleToolsList(id);
  if (method === 'tools/call') return handleToolsCall(id, params);
  if (method === 'ping') return reply(id, {});

  if (id !== undefined) {
    error(id, -32601, 'Method not found: ' + method);
  }
}

let buffer = '';

stdin.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  let idx;
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) handleMessage(line);
  }
});

stdin.on('end', () => process.exit(0));

log({ started: true, server: SERVER_INFO.name + ' v' + SERVER_INFO.version });
