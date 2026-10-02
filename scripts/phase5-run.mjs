// phase5-run.mjs — Phase 5 telemetry: только модули, без HTML (dashboard уже готов)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const D = String.fromCharCode(36);

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
console.log('-> Ветка feat/phase-5-telemetry');
try { sh('git checkout main'); } catch {}
try { sh('git pull --ff-only'); } catch {}
try { sh('git branch -D feat/phase-5-telemetry'); } catch {}
sh('git checkout -b feat/phase-5-telemetry');

// ─── 1. storage.mjs ──────────────────────────────────────────────
console.log('\n-> packages/telemetry/src/storage.mjs');
await write('packages/telemetry/src/storage.mjs', [
  '/**',
  ' * Append-only JSONL хранилище телеметрии.',
  ' * Файл на месяц: ~/.claude/skill-router/telemetry/YYYY-MM.jsonl',
  ' */',
  '',
  "import { appendFile, readFile, readdir, mkdir } from 'node:fs/promises';",
  "import { homedir } from 'node:os';",
  "import { join, dirname } from 'node:path';",
  '',
  'const NL = String.fromCharCode(10);',
  '',
  'function telemetryDir() {',
  "  return process.env.NSR_TELEMETRY_DIR || join(homedir(), '.claude', 'skill-router', 'telemetry');",
  '}',
  '',
  'function monthFile() {',
  '  const now = new Date();',
  "  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');",
  "  return join(telemetryDir(), ym + '.jsonl');",
  '}',
  '',
  'export async function recordSpan(span) {',
  '  const path = monthFile();',
  '  await mkdir(dirname(path), { recursive: true });',
  "  await appendFile(path, JSON.stringify(span) + NL, 'utf8');",
  '  return span;',
  '}',
  '',
  'export async function readAllSpans() {',
  '  const dir = telemetryDir();',
  '  let files;',
  '  try { files = await readdir(dir); } catch { return []; }',
  '  const spans = [];',
  "  for (const f of files.filter((x) => x.endsWith('.jsonl'))) {",
  '    try {',
  "      const raw = await readFile(join(dir, f), 'utf8');",
  '      for (const line of raw.split(NL)) {',
  '        if (!line.trim()) continue;',
  '        try { spans.push(JSON.parse(line)); } catch {}',
  '      }',
  '    } catch {}',
  '  }',
  '  return spans.sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));',
  '}',
  '',
  'export async function readRecentSpans(sinceMs) {',
  '  const all = await readAllSpans();',
  '  if (!sinceMs) return all;',
  '  const cutoff = Date.now() - sinceMs;',
  '  return all.filter((s) => Date.parse(s.ts) >= cutoff);',
  '}',
  '',
  'export function getTelemetryDir() { return telemetryDir(); }',
  ''
].join('\n'));

// ─── 2. tracer.mjs ───────────────────────────────────────────────
console.log('\n-> packages/telemetry/src/tracer.mjs');
await write('packages/telemetry/src/tracer.mjs', [
  '/**',
  ' * Tracer: превращает результат route() в структурированный спан.',
  ' */',
  '',
  "import { randomBytes } from 'node:crypto';",
  '',
  'function shortId() { return randomBytes(8).toString("hex"); }',
  '',
  'export function createSpan(query, routeResult, opts = {}) {',
  '  const top = (routeResult.candidates || [])[0];',
  '  const totalCost = (routeResult.candidates || []).reduce(',
  '    (sum, c) => sum + (c.model_plan && !c.model_plan.error ? c.model_plan.estimated_cost_usd || 0 : 0),',
  '    0',
  '  );',
  '  const totalTokens = (routeResult.candidates || []).reduce(',
  '    (sum, c) => sum + (c.estimated_tokens || 0), 0',
  '  );',
  '  return {',
  '    schema_version: "0.1",',
  '    span_id: shortId(),',
  '    ts: new Date().toISOString(),',
  '    query: query,',
  '    cleaned_query: routeResult.cleaned_query || null,',
  '    redacted: routeResult.redacted || 0,',
  '    mode: routeResult.mode || "lexical",',
  '    total_skills: routeResult.total_skills || 0,',
  '    candidates_count: (routeResult.candidates || []).length,',
  '    top_skill: top ? top.name : null,',
  '    top_score: top ? top.score : null,',
  '    candidates: (routeResult.candidates || []).slice(0, 5).map((c) => ({',
  '      name: c.name,',
  '      score: c.score,',
  '      tier: c.cost_tier,',
  '      model: c.model_plan && !c.model_plan.error ? c.model_plan.model : null,',
  '      model_tier: c.model_plan && !c.model_plan.error ? c.model_plan.tier : null,',
  '      cost_usd: c.model_plan && !c.model_plan.error ? c.model_plan.estimated_cost_usd : 0',
  '    })),',
  '    total_cost_usd: Math.round(totalCost * 1e6) / 1e6,',
  '    total_tokens: totalTokens,',
  '    latency_ms: opts.latencyMs || null,',
  '    policy: routeResult.policy || null',
  '  };',
  '}',
  ''
].join('\n'));

// ─── 3. metrics.mjs ──────────────────────────────────────────────
console.log('\n-> packages/telemetry/src/metrics.mjs');
await write('packages/telemetry/src/metrics.mjs', [
  '/**',
  ' * Агрегация спанов в метрики.',
  ' */',
  '',
  'export function computeMetrics(spans) {',
  '  if (!spans || spans.length === 0) {',
  '    return {',
  '      total: 0,',
  '      date_range: null,',
  '      avg_latency_ms: 0,',
  '      total_cost_usd: 0,',
  '      total_tokens: 0,',
  '      redacted_count: 0,',
  '      top_skills: [],',
  '      by_day: [],',
  '      by_model_tier: {}',
  '    };',
  '  }',
  '',
  '  const latencies = spans.map((s) => s.latency_ms).filter((x) => typeof x === "number");',
  '  const costs = spans.map((s) => s.total_cost_usd || 0);',
  '  const tokens = spans.map((s) => s.total_tokens || 0);',
  '  const redactions = spans.reduce((sum, s) => sum + (s.redacted || 0), 0);',
  '',
  '  const skillCount = new Map();',
  '  for (const s of spans) {',
  '    if (s.top_skill) skillCount.set(s.top_skill, (skillCount.get(s.top_skill) || 0) + 1);',
  '  }',
  '  const top_skills = [...skillCount.entries()]',
  '    .sort((a, b) => b[1] - a[1])',
  '    .slice(0, 10)',
  '    .map(([name, count]) => ({ name, count }));',
  '',
  '  const byDay = new Map();',
  '  for (const s of spans) {',
  '    const day = (s.ts || "").slice(0, 10);',
  '    if (!day) continue;',
  '    if (!byDay.has(day)) byDay.set(day, { day, count: 0, cost: 0, tokens: 0 });',
  '    const d = byDay.get(day);',
  '    d.count += 1;',
  '    d.cost += s.total_cost_usd || 0;',
  '    d.tokens += s.total_tokens || 0;',
  '  }',
  '  const by_day = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));',
  '',
  '  const byTier = {};',
  '  for (const s of spans) {',
  '    for (const c of (s.candidates || [])) {',
  '      if (!c.model_tier) continue;',
  '      byTier[c.model_tier] = (byTier[c.model_tier] || 0) + 1;',
  '    }',
  '  }',
  '',
  '  return {',
  '    total: spans.length,',
  '    date_range: spans.length > 0 ? { from: spans[0].ts, to: spans[spans.length - 1].ts } : null,',
  '    avg_latency_ms: latencies.length > 0',
  '      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)',
  '      : 0,',
  '    total_cost_usd: Math.round(costs.reduce((a, b) => a + b, 0) * 1e6) / 1e6,',
  '    total_tokens: tokens.reduce((a, b) => a + b, 0),',
  '    redacted_count: redactions,',
  '    top_skills,',
  '    by_day,',
  '    by_model_tier: byTier',
  '  };',
  '}',
  ''
].join('\n'));

// ─── 4. index.mjs ────────────────────────────────────────────────
console.log('\n-> packages/telemetry/src/index.mjs');
await write('packages/telemetry/src/index.mjs', [
  'export { recordSpan, readAllSpans, readRecentSpans, getTelemetryDir } from "./storage.mjs";',
  'export { createSpan } from "./tracer.mjs";',
  'export { computeMetrics } from "./metrics.mjs";',
  'export { renderDashboard } from "./dashboard.mjs";',
  ''
].join('\n'));

// ─── 5. router.mjs — tracing ─────────────────────────────────────
console.log('\n-> packages/core/src/router.mjs (tracing)');
let router = await readFile(join(REPO, 'packages/core/src/router.mjs'), 'utf8');

if (!router.includes('telemetry/src/tracer.mjs')) {
  router = router.replace(
    "import { loadWeights } from '../../learner/src/weights.mjs';",
    "import { loadWeights } from '../../learner/src/weights.mjs';\nimport { createSpan } from '../../telemetry/src/tracer.mjs';\nimport { recordSpan } from '../../telemetry/src/storage.mjs';"
  );
}

if (!router.includes('const startedAt = Date.now()')) {
  router = router.replace(
    '  const withModelPlan = opts.modelPlan !== false;',
    "  const withModelPlan = opts.modelPlan !== false;\n  const shouldTrace = opts.trace === true || process.env.NSR_TELEMETRY === '1';\n  const startedAt = Date.now();"
  );
}

if (!router.includes('await recordSpan(span)')) {
  router = router.replace(
    '  return {\n    query: safeQuery,\n    cleaned_query: cleanedQuery !== safeQuery ? cleanedQuery : undefined,',
    '  const latencyMs = Date.now() - startedAt;\n  const finalResult = {\n    query: safeQuery,\n    cleaned_query: cleanedQuery !== safeQuery ? cleanedQuery : undefined,'
  );
  router = router.replace(
    '    gates: gateResult,\n    candidates: candidates.slice(0, limit)\n  };',
    '    gates: gateResult,\n    candidates: candidates.slice(0, limit)\n  };\n\n  if (shouldTrace) {\n    try {\n      const span = createSpan(safeQuery, finalResult, { latencyMs });\n      await recordSpan(span);\n    } catch {}\n  }\n\n  return finalResult;'
  );
}

await write('packages/core/src/router.mjs', router);

// ─── 6. CLI — команда telemetry ──────────────────────────────────
console.log('\n-> packages/cli/bin/router.mjs (telemetry command)');
let cli = await readFile(join(REPO, 'packages/cli/bin/router.mjs'), 'utf8');

if (!cli.includes('telemetry/src/metrics.mjs')) {
  cli = cli.replace(
    "import { plan as buildPlan } from '../../core/src/composer/planner.mjs';",
    "import { plan as buildPlan } from '../../core/src/composer/planner.mjs';\nimport { readRecentSpans, getTelemetryDir } from '../../../telemetry/src/storage.mjs';\nimport { computeMetrics } from '../../../telemetry/src/metrics.mjs';\nimport { renderDashboard } from '../../../telemetry/src/dashboard.mjs';"
  );
}

if (!cli.includes('const D = String.fromCharCode(36)')) {
  if (cli.startsWith('#!/usr/bin/env node\n')) {
    cli = '#!/usr/bin/env node\n\nconst D = String.fromCharCode(36);\n' + cli.slice('#!/usr/bin/env node\n'.length);
  }
}

const telemetryCmd = [
  '',
  "program",
  "  .command('telemetry')",
  "  .description('Show telemetry metrics or open dashboard')",
  "  .option('--period <days>', 'window in days (default: all-time)', '0')",
  "  .option('--json', 'output as JSON')",
  "  .option('--open', 'generate dashboard HTML and open in browser')",
  "  .action(async (opts) => {",
  "    const days = parseInt(opts.period, 10) || 0;",
  "    const spans = await readRecentSpans(days > 0 ? days * 86400000 : 0);",
  "    const metrics = computeMetrics(spans);",
  "",
  "    if (opts.open) {",
  "      const { writeFile, mkdir } = await import('node:fs/promises');",
  "      const { spawn } = await import('node:child_process');",
  "      const dir = getTelemetryDir();",
  "      await mkdir(dir, { recursive: true });",
  "      const htmlPath = dir + '/dashboard.html';",
  "      const html = await renderDashboard(metrics, spans);",
  "      await writeFile(htmlPath, html, 'utf8');",
  "      console.log('Dashboard: ' + htmlPath);",
  "      const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';",
  "      try {",
  "        spawn(cmd, ['\"' + htmlPath + '\"'], { shell: true, detached: true });",
  "        console.log('Opening in browser...');",
  "      } catch {",
  "        console.log('Open manually: ' + htmlPath);",
  "      }",
  "      return;",
  "    }",
  "",
  "    if (opts.json) { console.log(JSON.stringify(metrics, null, 2)); return; }",
  "",
  "    console.log('');",
  "    console.log('Telemetry (period: ' + (days > 0 ? days + 'd' : 'all-time') + ')');",
  "    console.log('-'.repeat(40));",
  "    console.log('Total queries:  ' + metrics.total);",
  "    console.log('Avg latency:    ' + metrics.avg_latency_ms + ' ms');",
  "    console.log('Total cost:     ' + D + metrics.total_cost_usd.toFixed(4));",
  "    console.log('Total tokens:   ' + metrics.total_tokens);",
  "    console.log('Redactions:     ' + metrics.redacted_count);",
  "    if (metrics.date_range) {",
  "      console.log('Range:          ' + metrics.date_range.from.slice(0, 10) + ' -> ' + metrics.date_range.to.slice(0, 10));",
  "    }",
  "    if (metrics.top_skills.length > 0) {",
  "      console.log('');",
  "      console.log('Top skills:');",
  "      for (const s of metrics.top_skills) {",
  "        console.log('  ' + String(s.count).padStart(4) + '  ' + s.name);",
  "      }",
  "    }",
  "    if (Object.keys(metrics.by_model_tier).length > 0) {",
  "      console.log('');",
  "      console.log('Model tiers:');",
  "      for (const [tier, count] of Object.entries(metrics.by_model_tier).sort((a, b) => b[1] - a[1])) {",
  "        console.log('  ' + String(count).padStart(4) + '  ' + tier);",
  "      }",
  "    }",
  "    console.log('');",
  "    console.log('Data:  ' + getTelemetryDir());",
  "    console.log('Open dashboard:  node packages/cli/bin/router.mjs telemetry --open');",
  "    console.log('');",
  "  });",
  "",
  "program.parse();"
].join('\n');

cli = cli.replace('program.parse();', telemetryCmd);
await write('packages/cli/bin/router.mjs', cli);

// ─── 7. Тесты ────────────────────────────────────────────────────
console.log('\n-> tests/telemetry.test.mjs');
await write('tests/telemetry.test.mjs', [
  "import { describe, it, expect, beforeEach, afterEach } from 'vitest';",
  "import { mkdtemp, rm } from 'node:fs/promises';",
  "import { tmpdir } from 'node:os';",
  "import { join } from 'node:path';",
  '',
  'let tmp; let originalEnv;',
  '',
  'beforeEach(async () => {',
  "  tmp = await mkdtemp(join(tmpdir(), 'nsr-tel-'));",
  '  originalEnv = { ...process.env };',
  '  process.env.NSR_TELEMETRY_DIR = tmp;',
  '});',
  '',
  'afterEach(async () => {',
  '  process.env = originalEnv;',
  '  if (tmp) await rm(tmp, { recursive: true, force: true });',
  '});',
  '',
  "describe('tracer', () => {",
  "  it('creates a span from route result', async () => {",
  "    const { createSpan } = await import('../packages/telemetry/src/tracer.mjs');",
  '    const r = {',
  "      cleaned_query: 'test', mode: 'hybrid', total_skills: 10,",
  "      candidates: [{ name: 'code-review', score: 32.5, cost_tier: 'cheap', estimated_tokens: 5000,",
  "        model_plan: { tier: 'local', model: 'qwen3:7b', estimated_cost_usd: 0 } }]",
  '    };',
  "    const span = createSpan('test query', r, { latencyMs: 42 });",
  '    expect(span.span_id).toBeDefined();',
  "    expect(span.top_skill).toBe('code-review');",
  '    expect(span.total_cost_usd).toBe(0);',
  '    expect(span.latency_ms).toBe(42);',
  '  });',
  '});',
  '',
  "describe('storage', () => {",
  "  it('records and reads spans', async () => {",
  "    const { recordSpan, readAllSpans } = await import('../packages/telemetry/src/storage.mjs');",
  "    await recordSpan({ ts: new Date().toISOString(), query: 'a', top_skill: 'x' });",
  "    await recordSpan({ ts: new Date().toISOString(), query: 'b', top_skill: 'y' });",
  '    const spans = await readAllSpans();',
  '    expect(spans.length).toBe(2);',
  '  });',
  '});',
  '',
  "describe('metrics', () => {",
  "  it('computes aggregate metrics', async () => {",
  "    const { computeMetrics } = await import('../packages/telemetry/src/metrics.mjs');",
  '    const spans = [',
  "      { ts: '2026-01-01T10:00:00Z', top_skill: 'a', latency_ms: 30, total_cost_usd: 0.001, total_tokens: 5000, redacted: 0, candidates: [] },",
  "      { ts: '2026-01-01T11:00:00Z', top_skill: 'a', latency_ms: 50, total_cost_usd: 0.002, total_tokens: 6000, redacted: 1, candidates: [] },",
  "      { ts: '2026-01-02T10:00:00Z', top_skill: 'b', latency_ms: 40, total_cost_usd: 0.001, total_tokens: 4000, redacted: 0, candidates: [] }",
  '    ];',
  '    const m = computeMetrics(spans);',
  '    expect(m.total).toBe(3);',
  '    expect(m.avg_latency_ms).toBe(40);',
  '    expect(m.total_tokens).toBe(15000);',
  '    expect(m.redacted_count).toBe(1);',
  "    expect(m.top_skills[0].name).toBe('a');",
  '    expect(m.by_day.length).toBe(2);',
  '  });',
  '',
  "  it('handles empty input', async () => {",
  "    const { computeMetrics } = await import('../packages/telemetry/src/metrics.mjs');",
  '    const m = computeMetrics([]);',
  '    expect(m.total).toBe(0);',
  '  });',
  '});',
  '',
  "describe('dashboard', () => {",
  "  it('renders HTML with embedded data', async () => {",
  "    const { renderDashboard } = await import('../packages/telemetry/src/dashboard.mjs');",
  "    const { computeMetrics } = await import('../packages/telemetry/src/metrics.mjs');",
  '    const spans = [{ ts: new Date().toISOString(), top_skill: "x", total_cost_usd: 0, candidates: [] }];',
  '    const html = await renderDashboard(computeMetrics(spans), spans);',
  "    expect(html).toContain('<!DOCTYPE html>');",
  "    expect(html).toContain('next-skill-router');",
  '  });',
  '});',
  ''
].join('\n'));

// ─── 8. Удаляем старые сломанные скрипты ─────────────────────────
console.log('\n-> Cleanup старых сломанных скриптов');
const { rm } = await import('node:fs/promises');
for (const f of ['phase5-telemetry.mjs', 'fix-phase5.mjs', 'fix-phase5-2.mjs', 'fix-dashboard.mjs']) {
  const p = join(REPO, 'scripts', f);
  if (existsSync(p)) {
    await rm(p, { force: true });
    console.log('  - scripts/' + f);
  }
}

// ─── 9. Прогон ───────────────────────────────────────────────────
console.log('\n-> npm test');
sh('npm test');

console.log('\n-> demo: telemetry (до запросов)');
sh('node packages/cli/bin/router.mjs telemetry');

console.log('\n-> demo: search с NSR_TELEMETRY=1');
try {
  execSync('node packages/cli/bin/router.mjs search "проверь код" --no-semantic', {
    stdio: 'inherit',
    cwd: REPO,
    env: { ...process.env, NSR_TELEMETRY: '1' }
  });
} catch (e) { console.error('  search failed: ' + e.message); }

console.log('\n-> demo: telemetry (после запроса)');
sh('node packages/cli/bin/router.mjs telemetry');

// ─── 10. Commit + push ───────────────────────────────────────────
console.log('\n-> git add + commit + push');
sh('git add .');
try {
  sh('git commit -m "feat(phase-5): telemetry — spans, metrics, dashboard (clean impl)"');
} catch { console.log('  (nothing to commit)'); }
sh('git push --set-upstream origin feat/phase-5-telemetry');

console.log('\n════════════════════════════════════════════');
console.log('Phase 5 — готово.');
console.log('════════════════════════════════════════════');
console.log('');
console.log('Попробовать:');
console.log('  NSR_TELEMETRY=1 node packages/cli/bin/router.mjs search "test" --no-semantic');
console.log('  node packages/cli/bin/router.mjs telemetry');
console.log('  node packages/cli/bin/router.mjs telemetry --open');
console.log('');