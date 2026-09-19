import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseManifest } from './manifest.mjs';

const SKIP_NAMES = new Set(['.cache', '.composed', 'node_modules', '.git']);

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function findSkillDirs(root, depth = 0, maxDepth = 2) {
  const results = [];
  if (depth > maxDepth) return results;

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_NAMES.has(e.name)) continue;

    const dir = join(root, e.name);
    const skillMd = join(dir, 'SKILL.md');

    if (await exists(skillMd)) {
      results.push(dir);
    } else if (depth < maxDepth) {
      const nested = await findSkillDirs(dir, depth + 1, maxDepth);
      results.push(...nested);
    }
  }

  return results;
}

export async function scanDirs(dirs) {
  const skills = [];
  for (const dir of dirs) {
    if (!(await exists(dir))) continue;
    const skillDirs = await findSkillDirs(dir, 0, 2);
    for (const sd of skillDirs) {
      const skillMdPath = join(sd, 'SKILL.md');
      const skillMd = await readFile(skillMdPath, 'utf8');
      const skill = await parseManifest(sd, skillMd);
      skills.push(skill);
    }
  }
  return skills;
}
