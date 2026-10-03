// make-demo.mjs — автоматически генерирует SVG-демо из реального вывода CLI
import { execSync } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const DOCS = join(REPO, 'docs');
const SVG_PATH = join(DOCS, 'demo.svg');
const README = join(REPO, 'README.md');

function sh(cmd) {
  console.log('$ ' + cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: REPO });
}

function cap(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: REPO, maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

console.log('\n-> Собираем реальный вывод CLI\n');

const commands = [
  { cmd: 'node packages\\cli\\bin\\router.mjs list', maxLines: 12 },
  { cmd: 'node packages\\cli\\bin\\router.mjs search "review my API design" --explain', maxLines: 22 },
  { cmd: 'node packages\\cli\\bin\\router.mjs search "design a REST API" --budget-usd 0.01 --explain', maxLines: 20 },
  { cmd: 'node packages\\cli\\bin\\router.mjs search "fix code with sk-abcdefghijklmnopqrstuvwx" --no-semantic', maxLines: 14 }
];

const blocks = [];
for (const { cmd, maxLines } of commands) {
  console.log('Running: ' + cmd);
  let out = cap(cmd);
  // Убираем первые строки npm/vitest-шума если есть
  out = out.replace(/^[\s\S]*?(?=Found|Query:|Telemetry|Plan)/m, '');
  // Ограничиваем число строк
  const lines = out.split('\n').slice(0, maxLines);
  out = lines.join('\n').trimEnd();
  blocks.push({ cmd: cmd.replace('node packages\\cli\\bin\\router.mjs ', 'router '), out });
}

// ─── SVG генерация ──────────────────────────────────────────────
console.log('\n-> Генерируем SVG');

const FONT_SIZE = 13;
const LINE_HEIGHT = 18;
const PADDING = 16;
const CHAR_WIDTH = 7.8; // monospace approx
const MAX_CHARS = 90;

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

// Собираем все строки
const allLines = [];
for (const b of blocks) {
  allLines.push({ type: 'prompt', text: '$ ' + b.cmd });
  for (const line of b.out.split('\n')) {
    allLines.push({ type: 'output', text: truncate(line, MAX_CHARS) });
  }
  allLines.push({ type: 'blank', text: '' });
}

const width = Math.min(1100, PADDING * 2 + MAX_CHARS * CHAR_WIDTH);
const height = PADDING * 2 + allLines.length * LINE_HEIGHT + 40;

let y = PADDING + 25;
const svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Cascadia Mono','Consolas','Monaco','Menlo',monospace" font-size="${FONT_SIZE}">`);
svg.push(`  <defs>`);
svg.push(`    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`);
svg.push(`      <stop offset="0%" stop-color="#1e1e2e"/>`);
svg.push(`      <stop offset="100%" stop-color="#181825"/>`);
svg.push(`    </linearGradient>`);
svg.push(`  </defs>`);
svg.push(`  <rect width="${width}" height="${height}" rx="10" fill="url(#bg)"/>`);

// Заголовок окна с тремя кнопками
svg.push(`  <circle cx="18" cy="18" r="6" fill="#ff5f56"/>`);
svg.push(`  <circle cx="38" cy="18" r="6" fill="#ffbd2e"/>`);
svg.push(`  <circle cx="58" cy="18" r="6" fill="#27c93f"/>`);
svg.push(`  <text x="${width/2}" y="22" fill="#888" font-size="11" text-anchor="middle">next-skill-router</text>`);
svg.push(`  <line x1="0" y1="34" x2="${width}" y2="34" stroke="#313244" stroke-width="1"/>`);

for (const line of allLines) {
  if (line.type === 'blank') {
    y += LINE_HEIGHT;
    continue;
  }
  const color = line.type === 'prompt' ? '#a6e3a1' : '#cdd6f4';
  const weight = line.type === 'prompt' ? 'bold' : 'normal';
  svg.push(`  <text x="${PADDING}" y="${y}" fill="${color}" font-weight="${weight}" xml:space="preserve">${escapeXml(line.text)}</text>`);
  y += LINE_HEIGHT;
}

svg.push(`</svg>`);

await mkdir(DOCS, { recursive: true });
await writeFile(SVG_PATH, svg.join('\n'), 'utf8');
console.log('  + docs/demo.svg (' + svg.join('\n').length + ' байт)');

// ─── Обновляем README ─────────────────────────────────────────────
console.log('\n-> Обновляем README');
let readme = await readFile(README, 'utf8');

// Удаляем старую вставку если есть
readme = readme.replace(/!\[Demo\]\(\.\/docs\/demo\.(svg|gif|png)\)\n*/g, '');

// Вставляем после badge-блока (перед первым "---")
const badgeEnd = readme.indexOf('\n---\n');
if (badgeEnd === -1) {
  console.error('Не нашли блок badges');
  process.exit(1);
}
const insertAt = badgeEnd + 1;

const demoBlock = [
  '',
  '![Demo](./docs/demo.svg)',
  '',
  '_Real output: 141 skills indexed, hybrid search, cost-aware routing, secret redaction._',
  '',
  '---',
  ''
].join('\n');

readme = readme.slice(0, badgeEnd) + demoBlock + readme.slice(badgeEnd + 5);
await writeFile(README, readme, 'utf8');
console.log('  + README.md обновлён');

// ─── Git commit + push ───────────────────────────────────────────
console.log('\n-> git add + commit + push');
sh('git add docs/demo.svg README.md');
try {
  sh('git commit -m "docs: auto-generate demo SVG from real CLI output"');
} catch { console.log('  (nothing to commit)'); }
sh('git push');

console.log('\n════════════════════════════════════════════');
console.log('Готово.');
console.log('════════════════════════════════════════════');
console.log('');
console.log('Открыть README:');
console.log('  Start-Process "https://github.com/Alpha-Oi/next-skill-router"');
console.log('');
console.log('Открыть SVG локально:');
console.log('  Start-Process "' + SVG_PATH + '"');
console.log('');