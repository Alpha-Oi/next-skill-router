import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scanDirs } from './indexer/scanner.mjs';
import { buildLexicalIndex, lexicalSearch } from './search/lexical.mjs';

export async function loadSkills(projectDir = process.cwd()) {
  const dirs = [
    join(homedir(), '.claude', 'skills'),
    join(projectDir, '.claude', 'skills')
  ];
  return await scanDirs(dirs);
}

export async function route(query, opts = {}) {
  const projectDir = opts.projectDir ?? process.cwd();
  const limit = opts.limit ?? 5;

  const skills = await loadSkills(projectDir);
  if (skills.length === 0) {
    return { query, total_skills: 0, candidates: [] };
  }

  const mini = buildLexicalIndex(skills);
  const results = lexicalSearch(mini, query, limit * 3);

  const candidates = results.map((r) => {
    const skill = skills[r.id];
    const prereqs = checkPrereqs(skill, projectDir);
    let score = r.score;
    if (!prereqs.met) score -= 0.3;
    if (skill.never_auto_invoke) score -= 0.5;

    // Оставляем только термины с реальным совпадением (длина >= 3)
    const matched = (r.terms ?? []).filter((t) => t.length >= 3);
    const reason = matched.length
      ? 'lexical match: ' + matched.join(', ')
      : 'lexical match';

    return {
      name: skill.name,
      score,
      reason,
      complexity: skill.complexity,
      cost_tier: skill.cost_tier,
      estimated_tokens: skill.estimated_tokens,
      prerequisites_met: prereqs.met,
      prerequisites_missing: prereqs.missing,
      never_auto_invoke: skill.never_auto_invoke,
      source: skill.source
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  return { query, total_skills: skills.length, candidates: candidates.slice(0, limit) };
}

function checkPrereqs(skill, projectDir) {
  const files = skill.prerequisites?.files ?? [];
  if (files.length === 0) return { met: true, missing: [] };
  const missing = files.filter((f) => !existsSync(join(projectDir, f)));
  return { met: missing.length === 0, missing };
}
