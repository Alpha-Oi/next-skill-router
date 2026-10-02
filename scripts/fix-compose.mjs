// fix-compose.mjs — перезаписывает CLI с безопасным $ в строках
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const CLI = join(REPO, 'packages', 'cli', 'bin', 'router.mjs');
const D = String.fromCharCode(36); // '$' безопасно

function sh(cmd) {
  console.log('$ ' + cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: REPO });
}

console.log('\n-> Читаем ' + CLI);
let src = await readFile(CLI, 'utf8');

// Находим битую строку с "cost:" и заменяем весь блок compose
const brokenMarker = "console.log('     cost:";
const markerIndex = src.indexOf(brokenMarker);

if (markerIndex === -1) {
  console.log('  Битый блок не найден — возможно файл уже починен.');
  process.exit(0);
}

// Находим начало команды compose
const composeStart = src.lastIndexOf('\nprogram\n  .command(\'compose', markerIndex);
if (composeStart === -1) {
  console.error('  Не нашли начало команды compose. Правьте вручную.');
  process.exit(1);
}

// Находим конец команды compose (перед program.parse())
const parseIdx = src.indexOf('program.parse();', composeStart);
if (parseIdx === -1) {
  console.error('  Не нашли program.parse(). Правьте вручную.');
  process.exit(1);
}

// Собираем новый блок compose как массив строк (никаких template literals)
const newComposeBlock = [
  '',
  "program",
  "  .command('compose <query>')",
  "  .description('Build a multi-step plan from a natural-language query')",
  "  .option('-l, --limit <n>', 'candidate limit', '5')",
  "  .option('--budget-usd <n>', 'max cost per step in USD')",
  "  .option('--local-only', 'use only local models')",
  "  .option('--json', 'output as JSON')",
  "  .action(async (query, opts) => {",
  "    const routeResult = await route(query, {",
  "      limit: parseInt(opts.limit, 10),",
  "      semantic: true,",
  "      maxCostUsd: opts.budgetUsd ? parseFloat(opts.budgetUsd) : undefined,",
  "      localOnly: !!opts.localOnly",
  "    });",
  "",
  "    const allSkills = await loadSkills();",
  "    const policy = {",
  "      max_cost_usd: opts.budgetUsd ? parseFloat(opts.budgetUsd) : undefined,",
  "      local_only: !!opts.localOnly",
  "    };",
  "",
  "    const result = await buildPlan({",
  "      query,",
  "      candidates: routeResult.candidates,",
  "      allSkills,",
  "      policy",
  "    });",
  "",
  "    if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }",
  "",
  "    console.log('');",
  "    console.log('Query: ' + query);",
  "    console.log('');",
  "",
  "    if (result.reason === 'no_candidates') {",
  "      console.log('  No matching skills found.');",
  "      console.log('');",
  "      return;",
  "    }",
  "",
  "    if (result.reason === 'conflicts_detected') {",
  "      console.log('  Conflicts detected:');",
  "      for (const c of result.conflicts) console.log('    - ' + c.reason);",
  "      console.log('');",
  "      return;",
  "    }",
  "",
  "    if (result.reason === 'cycle_detected') {",
  "      console.log('  Cycle detected in skill dependencies. Cannot plan.');",
  "      console.log('');",
  "      return;",
  "    }",
  "",
  "    console.log('Plan (' + result.plan.length + ' steps, sequential):');",
  "    console.log('');",
  "",
  "    for (const s of result.plan) {",
  "      const model = s.model_plan && !s.model_plan.error ? s.model_plan : null;",
  "      console.log('  ' + s.step + '. ' + s.skill);",
  "      console.log('     complexity: ' + s.complexity + ' | ~' + s.estimated_tokens + ' tokens');",
  "      if (model) {",
  "        console.log('     model: ' + model.model + ' (' + model.tier + ', ' + model.provider + ')');",
  "        console.log('     cost:  ' + D + model.estimated_cost_usd + (model.offline ? ' (offline)' : ''));",
  "      } else {",
  "        console.log('     model: NONE FITS BUDGET');",
  "      }",
  "      if (s.depends_on.length > 0) {",
  "        console.log('     after: ' + s.depends_on.join(', '));",
  "      }",
  "      console.log('');",
  "    }",
  "",
  "    console.log('Total: ' + result.total_tokens + ' tokens, ' + D + result.total_cost_usd);",
  "    console.log('');",
  "  });",
  "",
].join('\n');

// Собираем файл заново
const beforeCompose = src.slice(0, composeStart);
const afterCompose = src.slice(parseIdx);

const fixed = beforeCompose + newComposeBlock + afterCompose;

await writeFile(CLI, fixed, 'utf8');
console.log('  Патч применён (' + (fixed.length - src.length) + ' байт добавлено)');

// Проверка синтаксиса через node --check
console.log('\n-> Синтаксис-проверка');
try {
  execSync('node --check "' + CLI + '"', { stdio: 'inherit' });
  console.log('  OK');
} catch (e) {
  console.error('  Синтаксис сломан. Восстановите CLI вручную.');
  process.exit(1);
}

// Тесты
console.log('\n-> npm test');
sh('npm test');

// Демо
console.log('\n-> demo: compose');
sh('node packages/cli/bin/router.mjs compose "добавь фичу X с тестами"');

console.log('\n-> demo: compose --local-only --json');
try {
  sh('node packages/cli/bin/router.mjs compose "напиши код и запусти тесты" --local-only --json');
} catch (e) { console.error('  compose failed: ' + e.message); }

// Commit
console.log('\n-> git add + commit + push');
sh('git add .');
try {
  sh('git commit -m "fix(phase-4): escape dollar signs in compose output"');
} catch { console.log('  (nothing to commit)'); }
sh('git push --set-upstream origin feat/phase-4-composer');

console.log('\n════════════════════════════════════════════');
console.log('Fixed.');
console.log('════════════════════════════════════════════');