import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { scanDirs } from './indexer/scanner.mjs';
import { buildLexicalIndex, lexicalSearch } from './search/lexical.mjs';
import { buildSemanticIndex, semanticSearch } from './search/semantic.mjs';
import { hybridRank } from './search/hybrid.mjs';
import { stripStopwords } from './search/stopwords.mjs';
import { selectModel } from './ranker/model-selector.mjs';
import { redact } from './secrets/redactor.mjs';
import { runGates } from './gates/checker.mjs';
import { loadWeights } from '../../learner/src/weights.mjs';

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
  const withModelPlan = opts.modelPlan !== false;

  const policy = {
    max_cost_usd: opts.maxCostUsd,
    max_tokens: opts.maxTokens,
    local_only: opts.localOnly
  };

  // Редакция запроса ДО любой обработки — секреты не попадут в кеш
  const { text: safeQuery, redacted: redactedCount } = redact(query);

  const skills = await loadSkills(projectDir);
  if (skills.length === 0) return { query: safeQuery, total_skills: 0, candidates: [], mode: 'lexical', redacted: redactedCount };

  // Веса из feedback loop (по умолчанию все = 1.0)
  const learnedWeights = await loadWeights();

  const cleanedQuery = stripStopwords(safeQuery) || safeQuery;
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
      semRanked = await semanticSearch(safeQuery, semIndex);
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

  // ─── Обработка кандидатов ───────────────────────────────────────
  const candidates = [];
  for (const f of fused.slice(0, limit * 2)) {
    const skill = byName.get(f.name);
    const prereqs = checkPrereqs(skill, projectDir);
    const penalties = [];

    const baseScore = mode === 'hybrid' ? f.score * SCORE_SCALE : f.score;
    const learnedWeight = learnedWeights[f.name] ?? 1.0;
    let score = baseScore * learnedWeight;

    if (!prereqs.met) {
      score -= PREREQ_PENALTY;
      penalties.push({ reason: 'prerequisites missing', value: -PREREQ_PENALTY });
    }
    if (skill.never_auto_invoke) {
      score -= NEVER_INVOKE_PENALTY;
      penalties.push({ reason: 'never_auto_invoke', value: -NEVER_INVOKE_PENALTY });
    }

    // ─── Model plan ──────────────────────────────────────────────
    let modelPlan = null;
    if (withModelPlan) {
      try {
        const sel = await selectModel(skill, policy);
        if (sel) {
          modelPlan = {
            tier: sel.model.tier,
            model: sel.model.id,
            provider: sel.model.provider,
            reason: sel.reason,
            estimated_cost_usd: round(sel.estimated_cost_usd, 6),
            offline: sel.model.capabilities?.offline || false
          };
        } else if (policy.max_cost_usd || policy.local_only || policy.max_tokens) {
          // Все модели вне бюджета → штрафуем и помечаем
          score -= PREREQ_PENALTY;
          penalties.push({ reason: 'no model fits budget', value: -PREREQ_PENALTY });
          modelPlan = { error: 'no_model_fits_budget' };
        }
      } catch (e) {
        // model selector не критичен, работаем без него
      }
    }

    candidates.push({
      name: skill.name,
      score: round(score, 1),
      reason: mode === 'hybrid' ? 'hybrid (lexical + semantic)' : 'lexical match',
      breakdown: {
        base: round(baseScore, 1),
        learned_weight: round(learnedWeight, 3),
        lexical: round(lexByName.get(f.name) || 0, 1),
        semantic: round(semByName.get(f.name) || 0, 3),
        matched_terms: lexTermsByName.get(f.name) || [],
        penalties
      },
      complexity: skill.complexity,
      cost_tier: skill.cost_tier,
      estimated_tokens: skill.estimated_tokens,
      model_plan: modelPlan,
      prerequisites_met: prereqs.met,
      prerequisites_missing: prereqs.missing,
      never_auto_invoke: skill.never_auto_invoke,
      source: skill.source
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Gates
  const gatesToCheck = opts.gates || [];
  const gateResult = gatesToCheck.length > 0 ? runGates(gatesToCheck, { projectDir }) : null;

  return {
    query: safeQuery,
    cleaned_query: cleanedQuery !== safeQuery ? cleanedQuery : undefined,
    redacted: redactedCount > 0 ? redactedCount : undefined,
    total_skills: skills.length,
    mode,
    policy: (policy.max_cost_usd || policy.max_tokens || policy.local_only) ? policy : undefined,
    gates: gateResult,
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
