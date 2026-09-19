import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseManifest } from './manifest.mjs';

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Проходит по списку директорий, находит подпапки с SKILL.md,
 * парсит манифест и возвращает массив навыков.
 */
export async function scanDirs(dirs) {
  const skills = [];
  for (const dir of dirs) {
    if (!(await exists(dir))) continue;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      const skillDir = join(dir, e.name);
      const skillMdPath = join(skillDir, 'SKILL.md');
      if (!(await exists(skillMdPath))) continue;
      const skillMd = await readFile(skillMdPath, 'utf8');
      const skill = await parseManifest(skillDir, skillMd);
      skills.push(skill);
    }
  }
  return skills;
}
