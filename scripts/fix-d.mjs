// fix-d.mjs — добавляет const D = '$' в начало CLI + проверяет строку 370
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

// 1. Показываем окружение строки 370
const lines = src.split('\n');
console.log('\n-> Строка 370 (0-indexed 369):');
for (let i = 368; i <= 371 && i < lines.length; i++) {
  console.log('  [' + (i + 1) + '] ' + JSON.stringify(lines[i]));
}

// 2. Добавляем const D в начало после shebang
if (!src.includes('const D = String.fromCharCode(36)')) {
  // После #!/usr/bin/env node
  if (src.startsWith('#!/usr/bin/env node\n')) {
    src = '#!/usr/bin/env node\n\nconst D = String.fromCharCode(36); // dollar sign, used in console.log\n' + src.slice('#!/usr/bin/env node\n'.length);
  } else {
    src = 'const D = String.fromCharCode(36); // dollar sign\n' + src;
  }
  await writeFile(CLI, src, 'utf8');
  console.log('\n  Добавлен const D в начало файла');
} else {
  console.log('\n  const D уже есть в файле');
}

// Проверка
console.log('\n-> Синтаксис-проверка');
try {
  execSync('node --check "' + CLI + '"', { stdio: 'inherit' });
  console.log('  OK');
} catch (e) {
  console.error('  Ошибка синтаксиса');
  process.exit(1);
}

console.log('\n-> npm test');
sh('npm test');

console.log('\n-> demo: compose');
sh('node packages/cli/bin/router.mjs compose "добавь фичу X с тестами"');

console.log('\n-> demo: compose --local-only');
try {
  sh('node packages/cli/bin/router.mjs compose "напиши код и запусти тесты" --local-only');
} catch (e) { console.error('  compose failed: ' + e.message); }

console.log('\n-> git add + commit + push');
sh('git add .');
try {
  sh('git commit -m "fix(phase-4): add const D for dollar sign in compose output"');
} catch { console.log('  (nothing to commit)'); }
sh('git push --set-upstream origin feat/phase-4-composer');

console.log('\n════════════════════════════════════════════');
console.log('Fixed.');
console.log('════════════════════════════════════════════');