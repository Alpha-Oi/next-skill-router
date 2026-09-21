import { readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import YAML from 'yaml';

const MANIFEST_NAMES = ['skill.manifest.yaml', 'skill.manifest.yml', 'skill.manifest.json'];

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

function extractFrontmatter(md) {
  // Нормализуем CRLF → LF
  const norm = md.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: norm };
  try {
    return { data: YAML.parse(m[1]) || {}, body: norm.slice(m[0].length) };
  } catch {
    return { data: {}, body: norm };
  }
}

function extractHeading(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function extractFirstParagraph(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    if (t.startsWith('---')) continue;
    if (t.startsWith('>')) return t.replace(/^>\s*/, '');
    // Пропускаем «key: value» — это остатки YAML
    if (/^[a-z_][a-z0-9_]*\s*:/i.test(t)) continue;
    if (t.startsWith('-')) continue;
    return t.slice(0, 200);
  }
  return '';
}


function normalizeKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    // kebab-case → snake_case
    const normalized = k.replace(/-/g, '_');
    out[normalized] = v;
  }
  return out;
}

export async function parseManifest(skillDir, skillMd) {
  const dirName = basename(skillDir);
  let manifest = null;

  for (const mn of MANIFEST_NAMES) {
    const p = join(skillDir, mn);
    if (await fileExists(p)) {
      const raw = await readFile(p, 'utf8');
      try {
        manifest = mn.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
        break;
      } catch (e) {
        console.warn('WARN: failed to parse ' + p + ': ' + e.message);
      }
    }
  }

  const { data: rawFm, body } = extractFrontmatter(skillMd);
  const fm = normalizeKeys(rawFm);
  const merged = { ...fm, ...(manifest || {}) };
  const hasFm = Object.keys(fm).length > 0;
  const source = manifest ? 'manifest' : hasFm ? 'frontmatter' : 'fallback';

  const fallbackName = extractHeading(body) ?? dirName;
  const fallbackDesc = extractFirstParagraph(body);

  return {
    name: merged.name ?? fallbackName,
    version: merged.version ?? '0.0.0',
    description: merged.description ?? fallbackDesc,
    intents: merged.intents ?? [],
    prerequisites: merged.prerequisites ?? { files: [], tools: [] },
    complexity: merged.complexity ?? 'medium',
    estimated_tokens: merged.estimated_tokens ?? 5000,
    cost_tier: merged.cost_tier ?? 'standard',
    composable_with: merged.composable_with ?? [],
    conflicts_with: merged.conflicts_with ?? [],
    never_auto_invoke: merged.never_auto_invoke ?? false,
    language: merged.language ?? [],
    model_affinity: merged.model_affinity ?? {},
    safety_profile: merged.safety_profile ?? {},
    execution_mode: merged.execution_mode ?? 'sequential',
    constraints: merged.constraints ?? {},
    argument_hint: merged.argument_hint ?? null,
    dir: skillDir,
    source
  };
}
