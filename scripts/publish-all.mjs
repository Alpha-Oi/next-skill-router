// publish-all.mjs — Docker в GHCR + tarball в релиз + npm publish
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = 'D:\\next-skill-router';
const OWNER = 'Alpha-Oi';
const NAME = 'next-skill-router';
const FULL = OWNER + '/' + NAME;
const D = String.fromCharCode(36);

function sh(cmd, opts = {}) {
  console.log('$ ' + cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: REPO, ...opts });
}

function cap(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO, maxBuffer: 20 * 1024 * 1024, ...opts });
}

// ═══════════════════════════════════════════════════════════════════
// 1. Обновляем package.json для npm
// ═══════════════════════════════════════════════════════════════════
console.log('\n═══ 1. Обновляем package.json ═══\n');

const pkgPath = join(REPO, 'package.json');
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));

pkg.version = '1.0.0';
pkg.description = 'Cost-aware, local-first skill routing for AI agents. MCP server + CLI.';
pkg.keywords = ['mcp', 'mcp-server', 'claude-code', 'ai-agents', 'skills', 'llm', 'ollama', 'local-first', 'cost-aware'];
pkg.repository = { type: 'git', url: 'git+https://github.com/' + FULL + '.git' };
pkg.homepage = 'https://github.com/' + FULL + '#readme';
pkg.bugs = { url: 'https://github.com/' + FULL + '/issues' };
pkg.author = 'Alpha-Oi';
pkg.files = [
  'packages/',
  'integrations/',
  'spec/',
  'docs/architecture.md',
  'docs/privacy.md',
  'docs/adr/',
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md'
];
pkg.publishConfig = { access: 'public' };

await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('  + version 1.0.0, files, publishConfig, keywords');

// ═══════════════════════════════════════════════════════════════════
// 2. Docker workflow (build + push в GHCR)
// ═══════════════════════════════════════════════════════════════════
console.log('\n═══ 2. Docker workflow (GHCR) ═══\n');

const dockerWorkflow = [
  'name: Docker',
  '',
  'on:',
  '  push:',
  '    branches: [main]',
  '    tags: ["v*"]',
  '  workflow_dispatch:',
  '',
  'env:',
  '  REGISTRY: ghcr.io',
  '  IMAGE_NAME: ' + D + '{{ github.repository }}',
  '',
  'jobs:',
  '  build-and-push:',
  '    runs-on: ubuntu-latest',
  '    permissions:',
  '      contents: read',
  '      packages: write',
  '',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '',
  '      - name: Set up Docker Buildx',
  '        uses: docker/setup-buildx-action@v3',
  '',
  '      - name: Log in to GHCR',
  '        uses: docker/login-action@v3',
  '        with:',
  '          registry: ' + D + '{{ env.REGISTRY }}',
  '          username: ' + D + '{{ github.actor }}',
  '          password: ' + D + '{{ secrets.GITHUB_TOKEN }}',
  '',
  '      - name: Extract metadata',
  '        id: meta',
  '        uses: docker/metadata-action@v5',
  '        with:',
  '          images: ' + D + '{{ env.REGISTRY }}/' + D + '{{ env.IMAGE_NAME }}',
  '          tags: |',
  '            type=ref,event=branch',
  '            type=ref,event=tag',
  '            type=semver,pattern={{version}}',
  '            type=raw,value=latest,enable={{is_default_branch}}',
  '',
  '      - name: Build and push',
  '        uses: docker/build-push-action@v6',
  '        with:',
  '          context: .',
  '          push: true',
  '          tags: ' + D + '{{ steps.meta.outputs.tags }}',
  '          labels: ' + D + '{{ steps.meta.outputs.labels }}',
  '          cache-from: type=gha',
  '          cache-to: type=gha,mode=max',
  ''
].join('\n');

await writeFile(join(REPO, '.github', 'workflows', 'docker.yml'), dockerWorkflow, 'utf8');
console.log('  + .github/workflows/docker.yml');

// ═══════════════════════════════════════════════════════════════════
// 3. Commit + push (запустит Docker workflow + CI)
// ═══════════════════════════════════════════════════════════════════
console.log('\n═══ 3. Commit + push ═══\n');

sh('git add .');
try {
  sh('git commit -m "feat: v1.0.0 — package.json for npm, Docker GHCR workflow"');
} catch { console.log('  (nothing to commit)'); }
sh('git push');

// Создаём tag v1.0.0 на новый коммит, если его нет
try {
  const tags = cap('git tag');
  if (!tags.includes('v1.0.0')) {
    sh('git tag -a v1.0.0 -m "v1.0.0 — first stable release"');
    sh('git push origin v1.0.0');
    console.log('  + tag v1.0.0 создан и запушен');
  } else {
    // Уже есть — перезаписать на текущий коммит
    sh('git push origin :refs/tags/v1.0.0', { stdio: 'pipe' });
    sh('git tag -d v1.0.0', { stdio: 'pipe' });
    sh('git tag -a v1.0.0 -m "v1.0.0 — first stable release"');
    sh('git push origin v1.0.0');
    console.log('  + tag v1.0.0 пересоздан и запушен');
  }
} catch (e) {
  console.log('  ! tag: ' + e.message);
}

// ═══════════════════════════════════════════════════════════════════
// 4. Tarball → GitHub Release
// ═══════════════════════════════════════════════════════════════════
console.log('\n═══ 4. Tarball → GitHub Release ═══\n');

const tarball = join(REPO, 'next-skill-router-1.0.0.tar.gz');
try {
  // git archive — чистый архив без .git
  sh(`git archive --format=tar.gz --prefix=next-skill-router-1.0.0/ -o "${tarball}" v1.0.0`);
  console.log('  + tarball создан: ' + tarball);

  // Прикрепляем к релизу
  try {
    sh(`gh release upload v1.0.0 "${tarball}" --clobber`);
    console.log('  + tarball прикреплён к релизу v1.0.0');
  } catch (e) {
    console.log('  ! upload: ' + e.message);
    console.log('  Возможно, релиз ещё не создан. Создайте его вручную.');
  }

  await unlink(tarball);
} catch (e) {
  console.log('  ! tarball: ' + e.message);
}

// ═══════════════════════════════════════════════════════════════════
// 5. NPM publish
// ═══════════════════════════════════════════════════════════════════
console.log('\n═══ 5. NPM publish ═══\n');

try {
  // Проверка авторизации
  const whoami = cap('npm whoami').trim();
  console.log('  npm user: ' + whoami);

  // Пробуем опубликовать
  console.log('\n-> Попытка npm publish...\n');
  sh('npm publish --access public');
  console.log('\n  ✓ Опубликовано в npm!');
  console.log('  Теперь работает: npx next-skill-router search "..."');
} catch (e) {
  console.log('\n  ! npm publish не удалось:');
  console.log('  ' + e.message);
  console.log('');
  console.log('  ─────────────────────────────────────────────');
  console.log('  Причина скорее всего: 2FA или токен без publish.');
  console.log('');
  console.log('  Что делать:');
  console.log('  1. Откройте https://www.npmjs.com/settings/crown.aliy1980/tokens');
  console.log('  2. Generate New Token → Classic → Automation');
  console.log('  3. Скопируйте токен (npm_xxxxx)');
  console.log('  4. Вставьте его в $HOME\\.npmrc строкой:');
  console.log('     //registry.npmjs.org/:_authToken=npm_xxxxx');
  console.log('  5. Запустите: npm publish --access public');
  console.log('  ─────────────────────────────────────────────');
}

// ═══════════════════════════════════════════════════════════════════
// 6. Финальный отчёт
// ═══════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════');
console.log('Готово.');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('Проверить:');
console.log('  CI:      https://github.com/' + FULL + '/actions');
console.log('  Docker:  https://github.com/' + FULL + '/pkgs/container/' + NAME);
console.log('  Release: https://github.com/' + FULL + '/releases/tag/v1.0.0');
console.log('  npm:     https://www.npmjs.com/package/next-skill-router');
console.log('');
console.log('Docker образ будет доступен через ~3-5 минут:');
console.log('  docker run --rm ghcr.io/alpha-oi/next-skill-router:latest --help');
console.log('');