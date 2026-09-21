#!/usr/bin/env node
/**
 * Устанавливает SessionStart hook в ~/.claude/settings.json.
 * Идемпотентна: повторный запуск не создаёт дубликатов.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = join(__dirname, 'hook.mjs');
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

const HOOK_COMMAND = 'node "' + HOOK_PATH.replace(/\\/g, '/') + '"';

async function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse ' + SETTINGS_PATH + ': ' + e.message);
    console.error('Создайте файл заново или исправьте вручную.');
    process.exit(1);
  }
}

async function saveSettings(settings) {
  await mkdir(dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

function ensureHook(settings) {
  settings.hooks = settings.hooks || {};
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];

  const hookEntry = {
    matcher: 'startup|resume|clear|compact',
    hooks: [
      {
        type: 'command',
        command: HOOK_COMMAND,
        timeout: 15
      }
    ]
  };

  // Проверяем, есть ли уже наш hook
  const existing = settings.hooks.SessionStart.find((entry) =>
    entry.hooks && entry.hooks.some((h) => h.command && h.command.includes('next-skill-router'))
  );

  if (existing) {
    // Обновляем команду, если путь изменился
    for (const entry of settings.hooks.SessionStart) {
      if (!entry.hooks) continue;
      for (const h of entry.hooks) {
        if (h.command && h.command.includes('next-skill-router')) {
          h.command = HOOK_COMMAND;
          h.timeout = 15;
        }
      }
    }
    return 'updated';
  }

  settings.hooks.SessionStart.push(hookEntry);
  return 'added';
}

async function main() {
  console.log('');
  console.log('next-skill-router — Claude Code hook installer');
  console.log('-'.repeat(50));
  console.log('Hook script:  ' + HOOK_PATH);
  console.log('Settings:     ' + SETTINGS_PATH);
  console.log('');

  const settings = await loadSettings();
  const action = ensureHook(settings);
  await saveSettings(settings);

  console.log('Status: ' + action);
  console.log('');
  console.log('Готово. Перезапустите Claude Code, чтобы хук вступил в силу.');
  console.log('');
}

main().catch((e) => {
  console.error('Ошибка: ' + e.message);
  process.exit(1);
});
