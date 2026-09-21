#!/usr/bin/env node
/**
 * Claude Code SessionStart hook.
 *
 * Запускается при старте сессии Claude Code. Инжектирует в контекст
 * компактный индекс установленных навыков — название + описание —
 * чтобы Claude знал, какие навыки доступны.
 *
 * Не блокирует сессию: любые ошибки → silent exit 0.
 *
 * Установка: см. `integrations/claude-code/install.mjs`.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

async function loadSkills() {
  try {
    const { loadSkills: fn } = await import('../../packages/core/src/router.mjs');
    return await fn(process.cwd());
  } catch {
    return [];
  }
}

function formatSkillLine(skill) {
  const desc = (skill.description || '').replace(/\s+/g, ' ').slice(0, 140);
  const hint = skill.argument_hint ? ' (args: ' + skill.argument_hint + ')' : '';
  return '- **' + skill.name + '** — ' + desc + hint;
}

function formatOutput(skills) {
  if (skills.length === 0) return '';

  const lines = [];
  lines.push('# next-skill-router: available skills');
  lines.push('');
  lines.push('Total: ' + skills.length + ' skills installed.');
  lines.push('');
  lines.push('You can search for the right skill using the CLI:');
  lines.push('  node packages/cli/bin/router.mjs search "<query>" --explain');
  lines.push('');
  lines.push('Top-level list:');

  // Сортируем по имени, показываем все
  for (const s of skills.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(formatSkillLine(s));
  }

  return lines.join('\n');
}

async function main() {
  try {
    const skills = await loadSkills();
    const output = formatOutput(skills);

    if (!output) {
      process.exit(0);
    }

    // Claude Code ожидает JSON на stdout для SessionStart hook
    // Формат: { "additionalContext": "..." } (может варьироваться по версиям)
    const payload = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: output
      }
    };
    process.stdout.write(JSON.stringify(payload));
  } catch (e) {
    // Silent fail — не блокируем сессию
    process.exit(0);
  }
}

main();
