// finalize.mjs — repo description + topics + Discussion #1 + финальный отчёт
import { execSync } from 'node:child_process';

const REPO = 'D:\\next-skill-router';
const OWNER = 'Alpha-Oi';
const NAME = 'next-skill-router';
const FULL = OWNER + '/' + NAME;

function sh(cmd, opts = {}) {
  console.log('$ ' + cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: REPO, ...opts });
}

function cap(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO, maxBuffer: 20 * 1024 * 1024 });
}

console.log('\n═══ 1. Обновляем GitHub repo (description + topics) ═══\n');

const description = 'Cost-aware, local-first skill routing for AI agents. MCP server + CLI + Claude Code hook. Tested on 141 real skills.';

const topics = [
  'mcp', 'mcp-server', 'claude-code', 'ai-agents', 'skills',
  'llm', 'ollama', 'local-first', 'cost-aware', 'nodejs',
  'semantic-search', 'onnx'
];

// Description через gh api
try {
  execSync(`gh api repos/${FULL} -X PATCH -f description="${description.replace(/"/g, '\\"')}"`, {
    cwd: REPO, stdio: 'inherit'
  });
  console.log('  + description обновлено');
} catch (e) { console.log('  ! description: ' + e.message); }

// Topics через gh api
const topicsArgs = topics.map(t => `-f names[]=${t}`).join(' ');
try {
  execSync(`gh api repos/${FULL}/topics -X PUT ${topicsArgs}`, { cwd: REPO, stdio: 'inherit' });
  console.log('  + topics установлены: ' + topics.length);
} catch (e) { console.log('  ! topics: ' + e.message); }

console.log('\n═══ 2. Добавляем комментарий в Discussion #1 ═══\n');

// Получаем ID Discussion #1
const repoNodeId = cap(`gh api repos/${FULL} --jq .node_id`).trim();

const d1 = JSON.parse(cap(`gh api graphql -f query='query($owner:String!,$name:String!){repository(owner:$owner,name:$name){discussion(number:1){id}}}' -f owner=${OWNER} -f name=${NAME}`));
const discussionId = d1.data.repository.discussion.id;
console.log('  Discussion #1 ID: ' + discussionId);

const comment = [
  '## Update: v1.0 shipped — tested on 141 real skills',
  '',
  'Публикую апдейт: проект вышел из стадии MVP и работает на реальных данных.',
  '',
  '### Что изменилось с момента открытия RFC',
  '',
  '- **v1.0.0** — все 9 фаз закрыты, tag на GitHub',
  '- **50/50 тестов** проходят',
  '- **Протестировано на 141 навыке** (engineering, marketing, product, data, security)',
  '- **GIF-демо** в README: гибридный поиск, cost-aware, redaction',
  '- **Dockerfile + docker-compose** для быстрого запуска',
  '',
  '### Реальный результат',
  '',
  '```',
  '$ router search "review my API design" --explain',
  '',
  'Total skills: 141 | mode: hybrid',
  '',
  '  32.8  api-design-reviewer',
  '        Lexical:       157.8',
  '        Semantic:      0.753',
  '        Model:         qwen3:7b (local, ollama)',
  '        Est. cost:     $0 (offline)',
  '```',
  '',
  'Семантика 0.753 — топ-1 попадание при запросе, где нет прямого совпадения слов.',
  '',
  '### Что это доказывает для стандарта',
  '',
  'SKILL-MANIFEST v0.3.1 работает **без изменений** на 141 внешнем навыке. Формат:',
  '- Читается любым навыком с `SKILL.md` (fallback на frontmatter)',
  '- Не требует миграции — просто работает',
  '- Совместим с Claude Code, Codex, Cursor, Windsurf через MCP',
  '',
  '### Приглашение',
  '',
  'Если вы автор навыков или мейнтейнер роутера — посмотрите на `spec/SKILL-MANIFEST.md`.',
  'Особенно интересны мнения по:',
  '',
  '1. Полю `gates` — формальные pre/post проверки',
  '2. `secrets_policy` — процедурная защита от утечек',
  '3. `model_affinity` — выбор модели по tier',
  '',
  'Репозиторий: https://github.com/' + FULL,
  'Demo SVG: https://github.com/' + FULL + '#quick-demo--141-skills-real-output'
].join('\\n');

// Пишем комментарий через файл-пейлоад (избегаем проблем с экранированием)
const { writeFile, unlink } = await import('node:fs/promises');
const payloadPath = REPO + '\\\\.tmp-comment-payload.json';
const mutation = 'mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{url}}}';
await writeFile(payloadPath, JSON.stringify({ query: mutation, variables: { id: discussionId, body: comment } }), 'utf8');

try {
  const result = JSON.parse(cap(`gh api graphql --input "${payloadPath}"`));
  const url = result.data.addDiscussionComment.comment.url;
  console.log('  + Комментарий добавлен: ' + url);
} catch (e) {
  console.log('  ! comment: ' + e.message);
}
await unlink(payloadPath);

console.log('\n═══ 3. Финальный отчёт ═══\n');

const repo = JSON.parse(cap(`gh api repos/${FULL}`));
const releases = JSON.parse(cap(`gh api repos/${FULL}/tags --jq '.'`));
const discussionsCount = cap(`gh api graphql -f query='query($o:String!,$n:String!){repository(owner:$o,name:$n){discussions{totalCount}}}' -f o=${OWNER} -f n=${NAME} --jq .data.repository.discussions.totalCount`).trim();

console.log('  Репозиторий:  ' + repo.html_url);
console.log('  Description:  ' + (repo.description || '(пусто)'));
console.log('  Topics:       ' + (repo.topics || []).join(', '));
console.log('  Stars:        ' + repo.stargazers_count);
console.log('  Forks:        ' + repo.forks_count);
console.log('  Open issues:  ' + repo.open_issues_count);
console.log('  Discussions:  ' + discussionsCount);
console.log('  Tags:         ' + releases.map(t => t.name).join(', '));
console.log('  Язык:         ' + repo.language);
console.log('  Лицензия:     ' + (repo.license?.spdx_id || 'нет'));
console.log('  Размер:       ' + Math.round(repo.size / 1024) + ' MB');
console.log('');
console.log('════════════════════════════════════════════');
console.log('Готово.');
console.log('════════════════════════════════════════════');
console.log('');
console.log('Открыть:');
console.log('  Start-Process "' + repo.html_url + '"');
console.log('  Start-Process "' + repo.html_url + '/discussions/1"');
console.log('');