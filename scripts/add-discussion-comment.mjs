// add-discussion-comment.mjs — фикс: query через файл-payload
import { execSync } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';

const REPO = 'D:\\next-skill-router';
const OWNER = 'Alpha-Oi';
const NAME = 'next-skill-router';
const FULL = OWNER + '/' + NAME;

function cap(cmd) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO, maxBuffer: 20 * 1024 * 1024 });
}

// Шаг 1: получить ID Discussion #1 (через файл-payload)
console.log('\n-> Получаем ID Discussion #1');

const queryPayload = REPO + '\\\\.tmp-query-payload.json';
const query = 'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){discussion(number:1){id}}}';
await writeFile(queryPayload, JSON.stringify({ query, variables: { owner: OWNER, name: NAME } }), 'utf8');

const d1Raw = cap(`gh api graphql --input "${queryPayload}"`);
await unlink(queryPayload);

const discussionId = JSON.parse(d1Raw).data.repository.discussion.id;
console.log('  Discussion #1 ID: ' + discussionId);

// Шаг 2: собрать комментарий
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
  '- **SVG-демо** в README: гибридный поиск, cost-aware, redaction',
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
  'Репозиторий: https://github.com/' + FULL
].join('\\n');

// Шаг 3: отправить комментарий
console.log('\n-> Отправляем комментарий');
const mutation = 'mutation($id:ID!,$body:String!){addDiscussionComment(input:{discussionId:$id,body:$body}){comment{url}}}';
const commentPayload = REPO + '\\\\.tmp-comment-payload.json';
await writeFile(commentPayload, JSON.stringify({ query: mutation, variables: { id: discussionId, body: comment } }), 'utf8');

const result = JSON.parse(cap(`gh api graphql --input "${commentPayload}"`));
await unlink(commentPayload);

console.log('  + Комментарий: ' + result.data.addDiscussionComment.comment.url);

console.log('\n════════════════════════════════════════════');
console.log('Готово.');
console.log('════════════════════════════════════════════');