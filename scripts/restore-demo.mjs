// restore-demo.mjs — перезаписывает 7 демо-навыков начисто в UTF-8
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEMO = join(homedir(), '.claude', 'skills', 'next-skill-router-demo');

const skills = [
  {
    name: 'code-review',
    description: 'Проверка качества кода и выявление типичных ошибок.',
    intents: ['проверить качество кода', 'проверить код', 'code quality check', 'review my changes'],
    complexity: 'low',
    cost_tier: 'cheap',
    language: ['js', 'ts', 'py']
  },
  {
    name: 'test-runner',
    description: 'Запуск и анализ тестов проекта.',
    intents: ['запустить тесты', 'run tests', 'прогнать тесты'],
    complexity: 'low',
    cost_tier: 'cheap',
    composable_with: [],
    language: ['js', 'ts']
  },
  {
    name: 'code-writer',
    description: 'Пишет новый код по требованиям.',
    intents: ['написать код', 'добавить фичу', 'write code', 'add feature'],
    complexity: 'high',
    cost_tier: 'standard',
    composable_with: ['test-writer', 'code-review'],
    language: ['js', 'ts', 'py']
  },
  {
    name: 'test-writer',
    description: 'Пишет тесты для существующего или нового кода.',
    intents: ['написать тесты', 'write tests', 'add tests'],
    complexity: 'medium',
    cost_tier: 'standard',
    composable_with: ['test-runner'],
    language: ['js', 'ts']
  },
  {
    name: 'refactor-assistant',
    description: 'Рефакторинг: выделение функций, удаление дублирования.',
    intents: ['рефакторинг', 'refactor', 'отрефактори код', 'улучшить структуру кода'],
    complexity: 'high',
    cost_tier: 'standard',
    composable_with: ['test-runner'],
    language: ['ts', 'py']
  },
  {
    name: 'api-designer',
    description: 'Проектирование REST/GraphQL API по требованиям.',
    intents: ['спроектировать api', 'design api', 'rest endpoints', 'сделай api'],
    complexity: 'medium',
    cost_tier: 'standard',
    composable_with: ['code-writer', 'test-writer']
  },
  {
    name: 'commit-writer',
    description: 'Генерация сообщений коммитов по conventional commits.',
    intents: ['написать коммит', 'напиши коммит', 'commit message', 'conventional commits'],
    complexity: 'low',
    cost_tier: 'cheap',
    never_auto_invoke: true
  }
];

function yamlQuote(s) {
  // Всегда в кавычках — безопаснее всего
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

let ok = 0;
for (const s of skills) {
  const lines = [];
  lines.push('---');
  lines.push('name: ' + s.name);
  lines.push('version: 0.1.0');
  lines.push('description: ' + yamlQuote(s.description));
  lines.push('intents:');
  for (const i of s.intents) lines.push('  - ' + yamlQuote(i));
  lines.push('complexity: ' + s.complexity);
  lines.push('cost_tier: ' + s.cost_tier);
  if (s.composable_with && s.composable_with.length > 0) {
    lines.push('composable_with: [' + s.composable_with.join(', ') + ']');
  }
  if (s.never_auto_invoke) lines.push('never_auto_invoke: true');
  if (s.language) lines.push('language: [' + s.language.join(', ') + ']');
  lines.push('---');
  lines.push('');
  lines.push('# ' + s.name);
  lines.push('');
  lines.push(s.description);
  lines.push('');

  const content = lines.join('\n');
  const dir = join(DEMO, s.name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), content, 'utf8');
  console.log('  ✓ ' + s.name);
  ok++;
}

console.log('\nВосстановлено: ' + ok);
console.log('Папка: ' + DEMO);

// Проверка
const { execSync } = await import('node:child_process');
console.log('\n-> Проверка:');
try {
  execSync('node packages/cli/bin/router.mjs list', {
    stdio: 'inherit',
    cwd: 'D:\\next-skill-router'
  });
} catch (e) {
  console.error('  router failed: ' + e.message);
}