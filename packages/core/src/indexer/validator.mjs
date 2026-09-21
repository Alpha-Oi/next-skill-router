import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import YAML from 'yaml';

const SKIP_DIRS = new Set(['.cache', '.composed', 'node_modules', '.git']);
const REQUIRED_FIELDS = ['name', 'version', 'description'];

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function findSkillDirs(root, depth = 0, maxDepth = 2) {
  const out = [];
  if (depth > maxDepth) return out;
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
    const dir = join(root, e.name);
    if (await exists(join(dir, 'SKILL.md'))) out.push(dir);
    else if (depth < maxDepth) out.push(...await findSkillDirs(dir, depth + 1, maxDepth));
  }
  return out;
}

/**
 * Проверяет один SKILL.md. Возвращает {ok, errors, warnings, frontmatter}.
 */
export async function validateSkill(skillDir) {
  const errors = [];
  const warnings = [];
  const skillMdPath = join(skillDir, 'SKILL.md');
  const raw = await readFile(skillMdPath, 'utf8');
  const norm = raw.replace(/\r\n/g, '\n');

  const m = norm.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) {
    warnings.push('No YAML frontmatter found (fallback parsing will be used)');
    return { ok: true, errors, warnings, frontmatter: null };
  }

  let fm;
  try {
    fm = YAML.parse(m[1]);
  } catch (e) {
    // Пытаемся определить строку ошибки
    const line = e.linePos?.[0]?.line ?? '?';
    errors.push('Invalid YAML on line ' + line + ': ' + e.message.split('\n')[0]);
    return { ok: false, errors, warnings, frontmatter: null };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fm[field]) warnings.push('Missing field: ' + field);
  }

  if (fm.name && !/^[a-z][a-z0-9-]*$/.test(fm.name)) {
    errors.push('Invalid name "' + fm.name + '": must match ^[a-z][a-z0-9-]*$');
  }

  if (fm.version && !/^\d+\.\d+\.\d+/.test(String(fm.version))) {
    warnings.push('Version "' + fm.version + '" is not SemVer');
  }

  if (fm.description && typeof fm.description === 'string' && fm.description.length > 500) {
    warnings.push('Description longer than 500 chars');
  }

  if (fm.argument_hint !== undefined && typeof fm.argument_hint !== 'string') {
    errors.push('argument_hint must be a string, got ' + typeof fm.argument_hint);
  }

  return { ok: errors.length === 0, errors, warnings, frontmatter: fm };
}

/**
 * Валидирует все навыки в директории.
 */
export async function validateAll(rootDirs) {
  const results = [];
  for (const root of rootDirs) {
    if (!(await exists(root))) continue;
    const dirs = await findSkillDirs(root);
    for (const dir of dirs) {
      const r = await validateSkill(dir);
      results.push({ dir, ...r });
    }
  }
  return results;
}
