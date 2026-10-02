// fix-cli-imports.mjs — добавляет недостающие импорты telemetry в CLI
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const CLI = join(REPO, 'packages', 'cli', 'bin', 'router.mjs');

console.log('\n-> Читаем ' + CLI);
let cli = await readFile(CLI, 'utf8');

// Показываем первые 15 строк
console.log('\n-> Первые 15 строк CLI:');
const lines = cli.split('\n');
for (let i = 0; i < Math.min(15, lines.length); i++) {
  console.log('  [' + (i + 1) + '] ' + lines[i]);
}

// Проверяем чего не хватает
const needs = [
  { pattern: 'telemetry/src/storage.mjs', importLine: "import { readRecentSpans, getTelemetryDir } from '../../../telemetry/src/storage.mjs';" },
  { pattern: 'telemetry/src/metrics.mjs', importLine: "import { computeMetrics } from '../../../telemetry/src/metrics.mjs';" },
  { pattern: 'telemetry/src/dashboard.mjs', importLine: "import { renderDashboard } from '../../../telemetry/src/dashboard.mjs';" }
];

const missing = needs.filter((n) => !cli.includes(n.pattern));

if (missing.length === 0) {
  console.log('\n  Все импорты на месте.');
  process.exit(0);
}

console.log('\n  Не хватает ' + missing.length + ' импортов:');
for (const m of missing) console.log('    - ' + m.importLine);

// Ищем последний импорт
const lastImportIdx = cli.lastIndexOf("\nimport ");
const endOfImportLine = cli.indexOf('\n', lastImportIdx + 1);

if (lastImportIdx === -1 || endOfImportLine === -1) {
  console.error('  Не нашли ни одного импорта — файл сломан.');
  process.exit(1);
}

const insertion = '\n' + missing.map((m) => m.importLine).join('\n');
const fixed = cli.slice(0, endOfImportLine) + insertion + cli.slice(endOfImportLine);

await writeFile(CLI, fixed, 'utf8');
console.log('\n  Добавлено ' + missing.length + ' импортов');

// Проверка синтаксиса
console.log('\n-> node --check');
try {
  execSync('node --check "' + CLI + '"', { stdio: 'inherit' });
  console.log('  OK');
} catch (e) {
  console.error('  Синтаксис сломан');
  process.exit(1);
}

console.log('\n-> npm test');
try {
  execSync('npm test', { stdio: 'inherit', cwd: REPO });
} catch (e) {
  console.error('  Тесты упали');
  process.exit(1);
}

console.log('\n-> demo: telemetry (пусто)');
try {
  execSync('node packages/cli/bin/router.mjs telemetry', { stdio: 'inherit', cwd: REPO });
} catch (e) { console.error('  ' + e.message); }

console.log('\n-> demo: search с NSR_TELEMETRY=1');
try {
  execSync('node packages/cli/bin/router.mjs search "проверь код" --no-semantic', {
    stdio: 'inherit',
    cwd: REPO,
    env: { ...process.env, NSR_TELEMETRY: '1' }
  });
} catch (e) { console.error('  search failed: ' + e.message); }

console.log('\n-> demo: telemetry (после запроса)');
try {
  execSync('node packages/cli/bin/router.mjs telemetry', { stdio: 'inherit', cwd: REPO });
} catch (e) { console.error('  ' + e.message); }

console.log('\n-> git add + commit + push');
try {
  execSync('git add .', { stdio: 'inherit', cwd: REPO });
  execSync('git commit -m "fix(phase-5): add missing telemetry imports to CLI"', { stdio: 'inherit', cwd: REPO });
  execSync('git push', { stdio: 'inherit', cwd: REPO });
} catch (e) { console.error('  git failed: ' + e.message); }

console.log('\n════════════════════════════════════════════');
console.log('Готово.');
console.log('════════════════════════════════════════════');