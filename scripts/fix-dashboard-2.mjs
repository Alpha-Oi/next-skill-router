// fix-dashboard-2.mjs — выносит HTML в отдельный файл-шаблон
import { writeFile, readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const TEMPLATE = join(REPO, 'packages', 'telemetry', 'src', 'dashboard-template.html');
const MODULE = join(REPO, 'packages', 'telemetry', 'src', 'dashboard.mjs');

// ─── 1. HTML-шаблон (просто текст, ничего экранировать не надо) ───
const templateHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>next-skill-router - telemetry</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1100px; margin: 0 auto; padding: 24px; background: #0f1115; color: #e6e6e6; }
h1 { margin: 0 0 8px; }
h2 { margin: 32px 0 12px; font-size: 16px; color: #888; }
.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
.card { background: #1a1d24; border-radius: 8px; padding: 16px; }
.card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .5px; }
.card .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
.bar-row { display: flex; align-items: center; margin: 4px 0; font-size: 13px; }
.bar-name { width: 180px; color: #aaa; }
.bar-track { flex: 1; background: #1a1d24; height: 20px; border-radius: 3px; overflow: hidden; margin: 0 12px; }
.bar-fill { background: linear-gradient(90deg, #4a90e2, #357abd); height: 100%; }
.bar-count { width: 60px; text-align: right; color: #888; }
.day-row { display: flex; align-items: flex-end; gap: 2px; height: 120px; margin-top: 12px; }
.day-bar { flex: 1; background: #4a90e2; border-radius: 2px 2px 0 0; min-height: 2px; }
.empty { color: #666; padding: 24px; text-align: center; }
.tier { display: inline-block; padding: 2px 8px; border-radius: 3px; background: #1a1d24; font-size: 12px; margin-right: 6px; }
</style>
</head>
<body>
<h1>next-skill-router - telemetry</h1>
<div class="sub" id="sub"></div>
<div class="grid" id="cards"></div>
<h2>Top skills</h2>
<div id="top-skills"></div>
<h2>Queries per day</h2>
<div id="by-day"></div>
<h2>Model tiers used</h2>
<div id="by-tier"></div>
<script>
window.DATA = __DATA__;
var m = window.DATA.metrics;
function el(id) { return document.getElementById(id); }
function fmtCost(v) { return String.fromCharCode(36) + v.toFixed(4); }

if (m.total === 0) {
  document.body.innerHTML = '<h1>next-skill-router - telemetry</h1><div class="empty">No telemetry data yet. Run some searches first.</div>';
} else {
  el("sub").textContent = m.total + " queries, " + (m.date_range ? m.date_range.from.slice(0,10) + " to " + m.date_range.to.slice(0,10) : "");

  var cards = [
    { label: "Total queries", value: m.total },
    { label: "Avg latency", value: m.avg_latency_ms + " ms" },
    { label: "Total cost", value: fmtCost(m.total_cost_usd) },
    { label: "Redactions", value: m.redacted_count }
  ];
  el("cards").innerHTML = cards.map(function(c) {
    return '<div class="card"><div class="label">' + c.label + '</div><div class="value">' + c.value + '</div></div>';
  }).join("");

  var maxSkill = Math.max.apply(null, [1].concat(m.top_skills.map(function(s) { return s.count; })));
  if (m.top_skills.length === 0) {
    el("top-skills").innerHTML = '<div class="empty">-</div>';
  } else {
    el("top-skills").innerHTML = m.top_skills.map(function(s) {
      return '<div class="bar-row"><div class="bar-name">' + s.name + '</div><div class="bar-track"><div class="bar-fill" style="width:' + (s.count / maxSkill * 100) + '%"></div></div><div class="bar-count">' + s.count + '</div></div>';
    }).join("");
  }

  var maxDay = Math.max.apply(null, [1].concat(m.by_day.map(function(d) { return d.count; })));
  if (m.by_day.length === 0) {
    el("by-day").innerHTML = '<div class="empty">-</div>';
  } else {
    el("by-day").innerHTML = '<div class="day-row">' + m.by_day.map(function(d) {
      return '<div class="day-bar" style="height:' + (d.count / maxDay * 100) + '%" title="' + d.day + ': ' + d.count + '"></div>';
    }).join("") + '</div>';
  }

  var tiers = Object.keys(m.by_model_tier).map(function(k) { return [k, m.by_model_tier[k]]; }).sort(function(a, b) { return b[1] - a[1]; });
  el("by-tier").innerHTML = tiers.length === 0 ? '<div class="empty">-</div>' : tiers.map(function(t) {
    return '<span class="tier">' + t[0] + ' &middot; ' + t[1] + '</span>';
  }).join("");
}
</script>
</body>
</html>
`;

await writeFile(TEMPLATE, templateHtml, 'utf8');
console.log('  + packages/telemetry/src/dashboard-template.html (' + templateHtml.length + ' байт)');

// ─── 2. dashboard.mjs — просто читает шаблон ─────────────────────
const moduleJs = [
  '/**',
  ' * Рендерит self-contained HTML дашборд.',
  ' * Читает dashboard-template.html и подставляет JSON-данные в __DATA__.',
  ' */',
  '',
  "import { readFile } from 'node:fs/promises';",
  "import { fileURLToPath } from 'node:url';",
  "import { dirname, join } from 'node:path';",
  '',
  'const __dirname = dirname(fileURLToPath(import.meta.url));',
  "const TEMPLATE_PATH = join(__dirname, 'dashboard-template.html');",
  '',
  'export async function renderDashboard(metrics, spans) {',
  '  const template = await readFile(TEMPLATE_PATH, "utf8");',
  '  const data = JSON.stringify({ metrics, spans_sample: spans.slice(-100) });',
  '  return template.replace("__DATA__", data);',
  '}',
  ''
].join('\n');

await writeFile(MODULE, moduleJs, 'utf8');
console.log('  + packages/telemetry/src/dashboard.mjs (переписан, ' + moduleJs.length + ' байт)');

// ─── 3. Синтаксис-проверка ───────────────────────────────────────
console.log('\n-> node --check dashboard.mjs');
try {
  execSync('node --check "' + MODULE + '"', { stdio: 'inherit' });
  console.log('  OK');
} catch (e) {
  console.error('  Ошибка синтаксиса');
  process.exit(1);
}

// ─── 4. Патч CLI: renderDashboard теперь async ───────────────────
console.log('\n-> Патч CLI (renderDashboard теперь async)');
const CLI = join(REPO, 'packages', 'cli', 'bin', 'router.mjs');
let cli = await readFile(CLI, 'utf8');

// Меняем синхронный вызов на await
if (cli.includes('const html = renderDashboard(metrics, spans);')) {
  cli = cli.replace(
    'const html = renderDashboard(metrics, spans);',
    'const html = await renderDashboard(metrics, spans);'
  );
  await writeFile(CLI, cli, 'utf8');
  console.log('  Заменено: const html = renderDashboard(...) -> await renderDashboard(...)');
} else {
  console.log('  (уже async или паттерн не найден)');
}

console.log('\n════════════════════════════════════════════');
console.log('Готово. Запускайте:');
console.log('  node scripts\\phase5-telemetry.mjs');
console.log('════════════════════════════════════════════');