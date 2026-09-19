import { readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import YAML from 'yaml';

const MANIFEST_NAMES = ['skill.manifest.yaml', 'skill.manifest.yml', 'skill.manifest.json'];

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

function extractFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { data: {}, body: md };
  try {
    return { data: YAML.parse(m[1]) || {}, body: md.slice(m[0].length) };
  } catch {
    return { data: {}, body: md };
  }
}

function extractHeading(body) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function extractFirstParagraph(body) {
  const lines = body.split('\n').slice(1).filter((l) => l.trim() && !l.startsWith('#'));
  return lines[0]?.trim() ?? '';
}

/**
 * Парсит метаданные навыка: frontmatter SKILL.md + опциональный skill.manifest.yaml.
 * Спецификация: spec/SKILL-MANIFEST.md
 */
export async function parseManifest(skillDir, skillMd) {
  const dirName = basename(skillDir);
  let manifest = null;
  let manifestSource = null;

  for (const mn of MANIFEST_NAMES) {
    const p = join(skillDir, mn);
    if (await fileExists(p)) {
      const raw = await readFile(p, 'utf8');
      try {
        manifest = mn.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
        manifestSource = mn;
        break;
      } catch (e) {
        console.warn('WARN: failed to parse ' + p + ': ' + e.message);
      }
    }
  }

  const { data: fm, body } = extractFrontmatter(skillMd);
  const merged = { ...fm, ...(manifest || {}) };

  const hasFm = Object.keys(fm).length > 0;
  const source = manifest ? 'manifest' : hasFm ? 'frontmatter' : 'fallback';

  return {
    name: merged.name ?? dirName,
    version: merged.version ?? '0.0.0',
    description: merged.description ?? extractFirstParagraph(body) ?? '',
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
    dir: skillDir,
    source
  };
}
