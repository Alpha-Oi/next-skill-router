import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scanDirs } from './indexer/scanner.mjs';
import { buildLexicalIndex, lexicalSearch } from './search/lexical.mjs';
import { buildSemanticIndex, semanticSearch } from './search/semantic.mjs';
import { hybridRank } from './search/hybrid.mjs';

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
  const useSemantic = opts.semantic !== false;

  const skills = await loadSkills(projectDir);
  if (skills.length === 0) return { query, total_skills: 0, candidates: [], mode: 'lexical' };

  const lexicalIndex = buildLexicalIndex(skills);
  const lexResults = lexicalSearch(lexicalIndex, query, limit * 3);
  const lexRanked = lexResults.map((r) => ({
    name: skills[r.id].name,
    score: r.score,
    terms: r.terms || []
  }));

  let semRanked = [];
  let mode = 'lexical';
  if (useSemantic) {
    try {
      const semIndex = await buildSemanticIndex(skills);
      semRanked = await semanticSearch(query, semIndex);
      mode = 'hybrid';
    } catch (e) {
      console.warn('  semantic failed: ' + e.message + ' — falling back to lexical');
    }
  }

  const fused = mode === 'hybrid'
    ? hybridRank(lexRanked, semRanked)
    : lexRanked.map((r) => ({ name: r.name, score: r.score }));

  const byName = new Map(skills.map((s) => [s.name, s]));
  const lexByName = new Map(lexRanked.map((r) => [r.name, r.score]));
  const lexTermsByName = new Map(lexRanked.map((r) => [r.name, r.terms || []]));
  const semByName = new Map(semRanked.map((r) => [r.name, r.score]));

  const candidates = fused.slice(0, limit * 2).map((f) => {
    const skill = byName.get(f.name);
    const prereqs = checkPrereqs(skill, projectDir);
    const penalties = [];
    let score = f.score;

    if (!prereqs.met) { score -= 0.3; penalties.push({ reason: 'prerequisites missing', value: -0.3 }); }
    if (skill.never_auto_invoke) { score -= 0.5; penalties.push({ reason: 'never_auto_invoke', value: -0.5 }); }

    return {
      name: skill.name,
      score,
      reason: mode === 'hybrid' ? 'hybrid (lexical + semantic)' : 'lexical match',
      breakdown: {
        base: f.score,
        lexical: lexByName.get(f.name) || 0,
        semantic: semByName.get(f.name) || 0,
        matched_terms: lexTermsByName.get(f.name) || [],
        penalties
      },
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

  return {
    query,
    total_skills: skills.length,
    mode,
    candidates: candidates.slice(0, limit)
  };
}

function checkPrereqs(skill, projectDir) {
  const files = skill.prerequisites?.files ?? [];
  if (files.length === 0) return { met: true, missing: [] };
  const missing = files.filter((f) => !existsSync(join(projectDir, f)));
  return { met: missing.length === 0, missing };
}
