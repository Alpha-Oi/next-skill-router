import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scanDirs } from './indexer/scanner.mjs';
import { buildLexicalIndex, lexicalSearch } from './search/lexical.mjs';
import { buildSemanticIndex, semanticSearch } from './search/semantic.mjs';
import { hybridRank } from './search/hybrid.mjs';
import { stripStopwords } from './search/stopwords.mjs';

const SCORE_SCALE = 1000;
const PREREQ_PENALTY = 30;
const NEVER_INVOKE_PENALTY = 50;

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

  const cleanedQuery = stripStopwords(query) || query;
  const lexicalIndex = buildLexicalIndex(skills);
  const lexResults = lexicalSearch(lexicalIndex, cleanedQuery, limit * 3);
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

    // RRF даёт крохотные числа (~0.016–0.033). Умножаем на 1000 → 16–33.
    // Для lexical-only режима score уже в нормальном диапазоне (см. выше).
    const baseScore = mode === 'hybrid' ? f.score * SCORE_SCALE : f.score;
    let score = baseScore;

    if (!prereqs.met) {
      score -= PREREQ_PENALTY;
      penalties.push({ reason: 'prerequisites missing', value: -PREREQ_PENALTY });
    }
    if (skill.never_auto_invoke) {
      score -= NEVER_INVOKE_PENALTY;
      penalties.push({ reason: 'never_auto_invoke', value: -NEVER_INVOKE_PENALTY });
    }

    return {
      name: skill.name,
      score: round(score, 1),
      reason: mode === 'hybrid' ? 'hybrid (lexical + semantic)' : 'lexical match',
      breakdown: {
        base: round(baseScore, 1),
        lexical: round(lexByName.get(f.name) || 0, 1),
        semantic: round(semByName.get(f.name) || 0, 3),
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
    cleaned_query: cleanedQuery !== query ? cleanedQuery : undefined,
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

function round(x, digits) {
  const f = Math.pow(10, digits);
  return Math.round(x * f) / f;
}
