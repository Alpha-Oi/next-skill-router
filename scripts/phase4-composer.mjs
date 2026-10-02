// phase4-composer.mjs — Phase 4: DAG planner + compose command
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';

function sh(cmd) {
  console.log('$ ' + cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: REPO });
}

async function write(rel, content) {
  const full = join(REPO, rel);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, content, 'utf8');
  console.log('  + ' + rel);
}

if (!existsSync(REPO)) { console.error('Repo not found'); process.exit(1); }
console.log('\nWorking in ' + REPO + '\n');

// ─── Ветка ────────────────────────────────────────────────────────
console.log('-> Ветка feat/phase-4-composer');
try { sh('git checkout main'); } catch {}
try { sh('git pull --ff-only'); } catch {}
try { sh('git branch -D feat/phase-4-composer'); } catch {}
sh('git checkout -b feat/phase-4-composer');

// ─── 1. composer/graph.mjs — построение DAG ───────────────────────
console.log('\n-> packages/core/src/composer/graph.mjs');
await write('packages/core/src/composer/graph.mjs', `/**
 * Граф навыков. Узлы — навыки, рёбра — composable_with.
 * Используется Composer для построения DAG.
 */

/**
 * Строит ориентированный граф из списка навыков.
 * Возвращает { nodes: Map<name, skill>, edges: Map<name, Set<name>> }.
 */
export function buildGraph(skills) {
  const nodes = new Map();
  const edges = new Map();

  for (const s of skills) {
    nodes.set(s.name, s);
    edges.set(s.name, new Set());
  }

  for (const s of skills) {
    const targets = s.composable_with || [];
    for (const t of targets) {
      if (nodes.has(t)) {
        edges.get(s.name).add(t);
      }
    }
  }

  return { nodes, edges };
}

/**
 * Топологическая сортировка. Возвращает массив имён или null при цикле.
 * Обрабатывает только узлы из subset (если передан).
 */
export function topoSort(graph, subset = null) {
  const names = subset
    ? [...subset].filter((n) => graph.nodes.has(n))
    : [...graph.nodes.keys()];

  const inDegree = new Map();
  for (const n of names) inDegree.set(n, 0);

  for (const n of names) {
    for (const target of graph.edges.get(n) || []) {
      if (inDegree.has(target)) {
        inDegree.set(target, inDegree.get(target) + 1);
      }
    }
  }

  const queue = names.filter((n) => inDegree.get(n) === 0);
  const sorted = [];

  while (queue.length > 0) {
    const n = queue.shift();
    sorted.push(n);

    for (const target of graph.edges.get(n) || []) {
      if (!inDegree.has(target)) continue;
      inDegree.set(target, inDegree.get(target) - 1);
      if (inDegree.get(target) === 0) queue.push(target);
    }
  }

  if (sorted.length !== names.length) return null; // цикл
  return sorted;
}

/**
 * Проверка конфликтов между набором навыков.
 * Возвращает массив пар конфликтов [{a, b, reason}].
 */
export function findConflicts(skills) {
  const byName = new Map(skills.map((s) => [s.name, s]));
  const conflicts = [];
  const seen = new Set();

  for (const s of skills) {
    const conflictsWith = s.conflicts_with || [];
    for (const c of conflictsWith) {
      if (!byName.has(c)) continue;
      const key = [s.name, c].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        a: s.name,
        b: c,
        reason: s.name + ' conflicts_with ' + c
      });
    }
  }

  return conflicts;
}

/**
 * Рекурсивно собирает все зависимости навыка (транзитивное замыкание).
 */
export function collectDependencies(graph, name) {
  const result = new Set();
  const stack = [name];

  while (stack.length > 0) {
    const n = stack.pop();
    for (const dep of graph.edges.get(n) || []) {
      if (result.has(dep)) continue;
      result.add(dep);
      stack.push(dep);
    }
  }

  return result;
}
`);

// ─── 2. composer/planner.mjs — построение плана ──────────────────
console.log('\n-> packages/core/src/composer/planner.mjs');
await write('packages/core/src/composer/planner.mjs', `/**
 * Planner: строит план выполнения из набора навыков.
 *
 * Вход: запрос пользователя + список установленных навыков.
 * Выход: последовательность шагов с моделью и стоимостью.
 *
 * Алгоритм:
 *   1. Найти топ-N кандидатов через route().
 *   2. Построить граф по composable_with.
 *   3. Взять транзитивное замыкание для топ-1 (если есть).
 *   4. Проверить конфликты.
 *   5. Топологически отсортировать.
 *   6. Для каждого шага подобрать модель через selectModel.
 *   7. Посчитать общую стоимость.
 */

import { buildGraph, topoSort, findConflicts, collectDependencies } from './graph.mjs';
import { selectModel, estimateCost } from '../ranker/model-selector.mjs';

const DEFAULT_MAX_STEPS = 5;

/**
 * Планирует цепочку навыков для выполнения запроса.
 *
 * @param {Object} opts
 * @param {string} opts.query — запрос пользователя
 * @param {Object[]} opts.candidates — топ-N кандидатов от route()
 * @param {Object[]} opts.allSkills — все установленные навыки
 * @param {Object} [opts.policy] — { max_cost_usd, max_tokens, local_only }
 * @param {number} [opts.maxSteps]
 */
export async function plan({ query, candidates, allSkills, policy = {}, maxSteps = DEFAULT_MAX_STEPS }) {
  if (!candidates || candidates.length === 0) {
    return { plan: [], total_cost_usd: 0, reason: 'no_candidates' };
  }

  // Берём топ-кандидатов по score
  const topNames = candidates.slice(0, 3).map((c) => c.name);
  const byName = new Map(allSkills.map((s) => [s.name, s]));
  const graph = buildGraph(allSkills);

  // Собираем узлы плана: топ-3 + транзитивные зависимости
  const planNodes = new Set(topNames);
  for (const n of topNames) {
    for (const dep of collectDependencies(graph, n)) {
      planNodes.add(dep);
    }
  }

  // Ограничиваем размер
  if (planNodes.size > maxSteps) {
    // Оставляем только топ-N по score
    const scoreByName = new Map(candidates.map((c) => [c.name, c.score]));
    const sorted = [...planNodes].sort((a, b) => (scoreByName.get(b) || 0) - (scoreByName.get(a) || 0));
    planNodes.clear();
    for (const n of sorted.slice(0, maxSteps)) planNodes.add(n);
  }

  // Проверяем конфликты
  const planSkills = [...planNodes].map((n) => byName.get(n)).filter(Boolean);
  const conflicts = findConflicts(planSkills);
  if (conflicts.length > 0) {
    return {
      plan: [],
      total_cost_usd: 0,
      conflicts,
      reason: 'conflicts_detected'
    };
  }

  // Топологическая сортировка
  const sorted = topoSort(graph, planNodes);
  if (!sorted) {
    return { plan: [], total_cost_usd: 0, reason: 'cycle_detected' };
  }

  // Для каждого шага подбираем модель и считаем стоимость
  let totalCost = 0;
  const steps = [];

  for (let i = 0; i < sorted.length; i++) {
    const skill = byName.get(sorted[i]);
    if (!skill) continue;

    const sel = await selectModel(skill, policy);
    const cost = sel ? sel.estimated_cost_usd : 0;
    totalCost += cost;

    steps.push({
      step: i + 1,
      skill: skill.name,
      complexity: skill.complexity,
      estimated_tokens: skill.estimated_tokens,
      model_plan: sel
        ? {
            tier: sel.model.tier,
            model: sel.model.id,
            provider: sel.model.provider,
            reason: sel.reason,
            estimated_cost_usd: round(cost, 6),
            offline: sel.model.capabilities?.offline || false
          }
        : { error: 'no_model_fits_budget' },
      depends_on: [...(graph.edges.get(skill.name) || [])]
        .filter((t) => planNodes.has(t) && sorted.indexOf(t) > i)
        .map((t) => t)
    });
  }

  return {
    plan: steps,
    total_cost_usd: round(totalCost, 6),
    total_tokens: steps.reduce((sum, s) => sum + (s.estimated_tokens || 0), 0),
    query,
    reason: 'ok'
  };
}

function round(x, d) {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
`);

// ─── 3. CLI — команда compose ────────────────────────────────────
console.log('\n-> packages/cli/bin/router.mjs (compose)');
let cli = await readFile(join(REPO, 'packages/cli/bin/router.mjs'), 'utf8');

// Импорт planner
if (!cli.includes('composer/planner.mjs')) {
  cli = cli.replace(
    "import { validateAll } from '../../core/src/indexer/validator.mjs';",
    "import { validateAll } from '../../core/src/indexer/validator.mjs';\nimport { plan as buildPlan } from '../../core/src/composer/planner.mjs';"
  );
}

// Добавляем команду перед program.parse()
const composeCmd = `
program
  .command('compose <query>')
  .description('Build a multi-step plan from a natural-language query')
  .option('-l, --limit <n>', 'candidate limit', '5')
  .option('--budget-usd <n>', 'max cost per step in USD')
  .option('--local-only', 'use only local models')
  .option('--json', 'output as JSON')
  .action(async (query, opts) => {
    const routeResult = await route(query, {
      limit: parseInt(opts.limit, 10),
      semantic: true,
      maxCostUsd: opts.budgetUsd ? parseFloat(opts.budgetUsd) : undefined,
      localOnly: !!opts.localOnly
    });

    const allSkills = await loadSkills();
    const policy = {
      max_cost_usd: opts.budgetUsd ? parseFloat(opts.budgetUsd) : undefined,
      local_only: !!opts.localOnly
    };

    const result = await buildPlan({
      query,
      candidates: routeResult.candidates,
      allSkills,
      policy
    });

    if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }

    console.log('');
    console.log('Query: ' + query);
    console.log('');

    if (result.reason === 'no_candidates') {
      console.log('  No matching skills found.');
      console.log('');
      return;
    }

    if (result.reason === 'conflicts_detected') {
      console.log('  Conflicts detected:');
      for (const c of result.conflicts) console.log('    - ' + c.reason);
      console.log('');
      return;
    }

    if (result.reason === 'cycle_detected') {
      console.log('  Cycle detected in skill dependencies. Cannot plan.');
      console.log('');
      return;
    }

    console.log('Plan (' + result.plan.length + ' steps, sequential):');
    console.log('');

    for (const s of result.plan) {
      const model = s.model_plan && !s.model_plan.error ? s.model_plan : null;
      console.log('  ' + s.step + '. ' + s.skill);
      console.log('     complexity: ' + s.complexity + ' | ~' + s.estimated_tokens + ' tokens');
      if (model) {
        console.log('     model: ' + model.model + ' (' + model.tier + ', ' + model.provider + ')');
        console.log('     cost:  $' + model.estimated_cost_usd + (model.offline ? ' (offline)' : ''));
      } else {
        console.log('     model: NONE FITS BUDGET');
      }
      if (s.depends_on.length > 0) {
        console.log('     after: ' + s.depends_on.join(', '));
      }
      console.log('');
    }

    console.log('Total: ' + result.total_tokens + ' tokens, $' + result.total_cost_usd);
    console.log('');
  });

program.parse();`;

cli = cli.replace('program.parse();', composeCmd);
await write('packages/cli/bin/router.mjs', cli);

// ─── 4. Демо-навыки с composable_with ────────────────────────────
console.log('\n-> Обновляем демо-навыки (добавляем composable_with)');
const demoDir = 'C:\\\\Users\\\\Crown-Aliy\\\\.claude\\\\skills\\\\next-skill-router-demo';
// Используем env путь или homedir
const os = await import('node:os');
const homedir = os.homedir();
const demoPath = join(homedir, '.claude', 'skills', 'next-skill-router-demo');

const demoSkills = [
  {
    name: 'code-writer',
    description: 'Пишет новый код по требованиям.',
    intents: ['написать код', 'добавить фичу', 'write code', 'add feature'],
    complexity: 'high', cost_tier: 'standard',
    composable_with: ['test-writer', 'code-review'],
    language: ['js', 'ts', 'py']
  },
  {
    name: 'test-writer',
    description: 'Пишет тесты для существующего или нового кода.',
    intents: ['написать тесты', 'write tests', 'add tests'],
    complexity: 'medium', cost_tier: 'standard',
    composable_with: ['test-runner'],
    language: ['js', 'ts']
  },
  {
    name: 'test-runner',
    description: 'Запуск и анализ тестов проекта.',
    intents: ['запустить тесты', 'run tests', 'прогнать тесты'],
    complexity: 'low', cost_tier: 'cheap',
    composable_with: [],
    language: ['js', 'ts']
  },
  {
    name: 'code-review',
    description: 'Проверка качества кода и выявление типичных ошибок.',
    intents: ['проверить качество кода', 'проверить код', 'code quality check', 'review my changes'],
    complexity: 'low', cost_tier: 'cheap',
    composable_with: [],
    language: ['js', 'ts', 'py']
  },
  {
    name: 'commit-writer',
    description: 'Генерация сообщений коммитов по conventional commits.',
    intents: ['написать коммит', 'напиши коммит', 'commit message', 'conventional commits'],
    complexity: 'low', cost_tier: 'cheap',
    never_auto_invoke: true
  },
  {
    name: 'refactor-assistant',
    description: 'Рефакторинг: выделение функций, удаление дублирования.',
    intents: ['рефакторинг', 'refactor', 'отрефактори код', 'улучшить структуру кода'],
    complexity: 'high', cost_tier: 'standard',
    composable_with: ['test-runner'],
    language: ['ts', 'py']
  },
  {
    name: 'api-designer',
    description: 'Проектирование REST/GraphQL API по требованиям.',
    intents: ['спроектировать api', 'design api', 'rest endpoints', 'сделай api'],
    complexity: 'medium', cost_tier: 'standard',
    composable_with: ['code-writer', 'test-writer']
  }
];

function quoteYaml(s) {
  if (/[:#"\\[\\]{}|>&*!%@`]/.test(s) || s.includes('\\n')) {
    return '"' + s.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"';
  }
  return s;
}

for (const s of demoSkills) {
  const lines = ['---'];
  lines.push('name: ' + s.name);
  lines.push('version: 0.1.0');
  lines.push('description: ' + quoteYaml(s.description));
  lines.push('intents:');
  for (const i of s.intents) lines.push('  - ' + quoteYaml(i));
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

  const dst = join(demoPath, s.name, 'SKILL.md');
  await mkdir(join(dst, '..'), { recursive: true });
  await writeFile(dst, lines.join('\\n'), 'utf8');
  console.log('  + ' + dst.replace(homedir, '~'));
}

// ─── 5. Тесты ─────────────────────────────────────────────────────
console.log('\n-> tests/composer.test.mjs');
await write('tests/composer.test.mjs', `import { describe, it, expect } from 'vitest';
import { buildGraph, topoSort, findConflicts, collectDependencies } from '../packages/core/src/composer/graph.mjs';

const sample = [
  { name: 'a', composable_with: ['b'], conflicts_with: [] },
  { name: 'b', composable_with: ['c'], conflicts_with: [] },
  { name: 'c', composable_with: [], conflicts_with: [] },
  { name: 'd', composable_with: [], conflicts_with: ['a'] }
];

describe('buildGraph', () => {
  it('builds nodes and edges from composable_with', () => {
    const g = buildGraph(sample);
    expect(g.nodes.size).toBe(4);
    expect(g.edges.get('a').has('b')).toBe(true);
    expect(g.edges.get('b').has('c')).toBe(true);
    expect(g.edges.get('c').size).toBe(0);
  });

  it('ignores composable_with for unknown skills', () => {
    const g = buildGraph([{ name: 'x', composable_with: ['nonexistent'] }]);
    expect(g.edges.get('x').size).toBe(0);
  });
});

describe('topoSort', () => {
  it('sorts a DAG correctly', () => {
    const g = buildGraph(sample);
    const sorted = topoSort(g);
    expect(sorted).not.toBeNull();
    // 'a' должен быть до 'b', 'b' до 'c'
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  it('sorts a subset', () => {
    const g = buildGraph(sample);
    const sorted = topoSort(g, new Set(['a', 'b']));
    expect(sorted).toEqual(['a', 'b']);
  });

  it('returns null on cycle', () => {
    const cyclic = [
      { name: 'a', composable_with: ['b'] },
      { name: 'b', composable_with: ['a'] }
    ];
    const g = buildGraph(cyclic);
    expect(topoSort(g)).toBeNull();
  });
});

describe('findConflicts', () => {
  it('detects conflicts_with', () => {
    const conflicts = findConflicts(sample);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].a).toBe('d');
    expect(conflicts[0].b).toBe('a');
  });

  it('returns empty when no conflicts', () => {
    const conflicts = findConflicts([{ name: 'x', conflicts_with: [] }]);
    expect(conflicts).toEqual([]);
  });
});

describe('collectDependencies', () => {
  it('collects transitive dependencies', () => {
    const g = buildGraph(sample);
    const deps = collectDependencies(g, 'a');
    expect(deps.has('b')).toBe(true);
    expect(deps.has('c')).toBe(true);
  });

  it('returns empty for leaf node', () => {
    const g = buildGraph(sample);
    const deps = collectDependencies(g, 'c');
    expect(deps.size).toBe(0);
  });
});
`);

// ─── 6. Прогон ────────────────────────────────────────────────────
console.log('\n-> npm test');
sh('npm test');

console.log('\n-> demo: compose');
try {
  sh('node packages/cli/bin/router.mjs compose "добавь фичу X с тестами и ревью"');
} catch (e) { console.error('  compose failed: ' + e.message); }

console.log('\n-> demo: compose --local-only');
try {
  sh('node packages/cli/bin/router.mjs compose "напиши код и запусти тесты" --local-only');
} catch (e) { console.error('  compose failed: ' + e.message); }

// ─── 7. Commit + push ─────────────────────────────────────────────
console.log('\n-> git add + commit + push');
sh('git add .');
try {
  sh('git commit -m "feat(phase-4): composer — DAG planner + compose command"');
} catch { console.log('  (nothing to commit)'); }
sh('git push --set-upstream origin feat/phase-4-composer');

console.log('\n════════════════════════════════════════════');
console.log('Phase 4 — готово.');
console.log('════════════════════════════════════════════');
console.log('');
console.log('Новое:');
console.log('  • packages/core/src/composer/graph.mjs — граф + топосорт + конфликты');
console.log('  • packages/core/src/composer/planner.mjs — планировщик цепочки');
console.log('  • CLI: next-skill-router compose "<запрос>"');
console.log('  • 7 новых тестов');
console.log('');
console.log('Попробовать:');
console.log('  node packages/cli/bin/router.mjs compose "добавь фичу X с тестами"');
console.log('  node packages/cli/bin/router.mjs compose "напиши код и запусти тесты" --local-only --json');
console.log('');