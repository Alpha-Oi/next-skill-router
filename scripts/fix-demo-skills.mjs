// fix-demo-skills.mjs — заменяет литеральные \n на настоящие переносы в SKILL.md
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEMO_DIR = join(homedir(), '.claude', 'skills', 'next-skill-router-demo');
const NL = String.fromCharCode(10);      // \n настоящий
const BACKSLASH_N = '\\' + 'n';           // \n литеральный (два символа)

console.log('\n-> Папка: ' + DEMO_DIR);

if (!existsSync(DEMO_DIR)) {
  console.error('Папка не найдена. Запустите fix2-mvp.mjs или phase4-composer.mjs.');
  process.exit(1);
}

const dirs = await readdir(DEMO_DIR, { withFileTypes: true });
const skillDirs = dirs.filter((d) => d.isDirectory()).map((d) => d.name);

console.log('-> Найдено навыков: ' + skillDirs.length);

let fixed = 0;
let alreadyOk = 0;

for (const name of skillDirs) {
  const path = join(DEMO_DIR, name, 'SKILL.md');
  if (!existsSync(path)) continue;

  let content = await readFile(path, 'utf8');
  const before = content;

  // Если есть литеральный \n — заменяем
  if (content.includes(BACKSLASH_N)) {
    content = content.split(BACKSLASH_N).join(NL);
  }

  // Проверяем наличие frontmatter
  const hasFrontmatter = content.startsWith('---' + NL) && content.indexOf(NL + '---' + NL, 4) > 0;

  if (content !== before) {
    await writeFile(path, content, 'utf8');
    fixed++;
    console.log('  ✓ исправлен: ' + name + ' (frontmatter: ' + (hasFrontmatter ? 'YES' : 'NO') + ')');
  } else {
    alreadyOk++;
    console.log('  · без изменений: ' + name + ' (frontmatter: ' + (hasFrontmatter ? 'YES' : 'NO') + ')');
  }
}

console.log('\n-> Итого: исправлено ' + fixed + ', без изменений ' + alreadyOk);

// Проверка через роутер
console.log('\n-> Проверка через router.mjs list:');
const { execSync } = await import('node:child_process');
try {
  execSync('node packages/cli/bin/router.mjs list', {
    stdio: 'inherit',
    cwd: 'D:\\next-skill-router'
  });
} catch (e) {
  console.error('  router failed: ' + e.message);
}

console.log('\n════════════════════════════════════════════');
console.log('Готово. Все навыки должны быть [frontmatter] с описаниями.');
console.log('════════════════════════════════════════════');