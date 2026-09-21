/**
 * Lazy loading: сканирует только первые N КБ каждого SKILL.md
 * (frontmatter + первый абзац), избегая чтения полного тела файла.
 *
 * Для 47 навыков разница невелика, но при 500+ файлов это даёт
 * заметный выигрыш по памяти и времени сканирования.
 */

import { open } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const HEAD_BYTES = 4096;
const SKIP_DIRS = new Set(['.cache', '.composed', 'node_modules', '.git']);

async function exists(p) {
  try { await open(p); await (await open(p)).close(); return true; } catch { return false; }
}

/**
 * Читает только первые 4KB файла.
 */
async function readHead(path) {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0);
    return buf.slice(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
  }
}

async function findSkillDirs(root, depth = 0, maxDepth = 2) {
  const results = [];
  if (depth > maxDepth) return results;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch { return results; }

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const dir = join(root, e.name);
    // Проверка SKILL.md без чтения всего содержимого
    try {
      await open(join(dir, 'SKILL.md')).then((f) => f.close());
      results.push(dir);
    } catch {
      if (depth < maxDepth) {
        results.push(...(await findSkillDirs(dir, depth + 1, maxDepth)));
      }
    }
  }
  return results;
}

/**
 * Быстрое сканирование: возвращает навыки с данными только из frontmatter.
 * Тело SKILL.md не читается.
 */
export async function scanDirsLight(dirs, parseManifest) {
  const skills = [];
  for (const dir of dirs) {
    let dirExists = false;
    try {
      await open(dir).then((f) => f.close());
      dirExists = true;
    } catch {}
    if (!dirExists) continue;

    const skillDirs = await findSkillDirs(dir);
    for (const sd of skillDirs) {
      try {
        const head = await readHead(join(sd, 'SKILL.md'));
        const skill = await parseManifest(sd, head);
        skills.push(skill);
      } catch (e) {
        // пропускаем сломанные
      }
    }
  }
  return skills;
}
