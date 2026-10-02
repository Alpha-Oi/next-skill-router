// fix-compose-2.mjs — заменяет ' + D + ' на String.fromCharCode(36) в CLI
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const CLI = join(REPO, 'packages', 'cli', 'bin', 'router.mjs');

function sh(cmd) {
  console.log('$ ' + cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: REPO });
}

console.log('\n-> Читаем ' + CLI);
let src = await readFile(CLI, 'utf8');

// Ищем вхождения ' + D + '
const before = src;
src = src.split("' + D + '").join("' + String.fromCharCode(36) + '");

if (src === before) {
  console.log('  Нечего менять — возможно, уже исправлено.');
} else {
  const count = (before.match(/' \+ D \+ '/g) || []).length;
  console.log('  Заменено вхождений: ' + count);
  await writeFile(CLI, src, 'utf8');
  console.log('  Файл сохранён');
}

// Проверка синтаксиса
console.log('\n-> Синтаксис-проверка');
try {
  execSync('node --check "' + CLI + '"', { stdio: 'inherit' });
  console.log('  OK');
} catch (e) {
  console.error('  Ошибка синтаксиса');
  process.exit(1);
}

// Тесты
console.log('\n-> npm test');
sh('npm test');

// Демо
console.log('\n-> demo: compose');
sh('node packages/cli/bin/router.mjs compose "добавь фичу X с тестами"');

console.log('\n-> demo: compose --local-only');
try {
  sh('node packages/cli/bin/router.mjs compose "напиши код и запусти тесты" --local-only');
} catch (e) { console.error('  compose failed: ' + e.message); }

// Commit
console.log('\n-> git add + commit + push');
sh('git add .');
try {
  sh('git commit -m "fix(phase-4): replace undefined D reference with String.fromCharCode(36)"');
} catch { console.log('  (nothing to commit)'); }
sh('git push --set-upstream origin feat/phase-4-composer');

console.log('\n════════════════════════════════════════════');
console.log('Fixed.');
console.log('════════════════════════════════════════════');