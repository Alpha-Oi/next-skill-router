/**
 * Tracer: превращает результат route() в структурированный спан.
 */

import { randomBytes } from 'node:crypto';

function shortId() { return randomBytes(8).toString("hex"); }

export function createSpan(query, routeResult, opts = {}) {
  const top = (routeResult.candidates || [])[0];
  const totalCost = (routeResult.candidates || []).reduce(
    (sum, c) => sum + (c.model_plan && !c.model_plan.error ? c.model_plan.estimated_cost_usd || 0 : 0),
    0
  );
  const totalTokens = (routeResult.candidates || []).reduce(
    (sum, c) => sum + (c.estimated_tokens || 0), 0
  );
  return {
    schema_version: "0.1",
    span_id: shortId(),
    ts: new Date().toISOString(),
    query: query,
    cleaned_query: routeResult.cleaned_query || null,
    redacted: routeResult.redacted || 0,
    mode: routeResult.mode || "lexical",
    total_skills: routeResult.total_skills || 0,
    candidates_count: (routeResult.candidates || []).length,
    top_skill: top ? top.name : null,
    top_score: top ? top.score : null,
    candidates: (routeResult.candidates || []).slice(0, 5).map((c) => ({
      name: c.name,
      score: c.score,
      tier: c.cost_tier,
      model: c.model_plan && !c.model_plan.error ? c.model_plan.model : null,
      model_tier: c.model_plan && !c.model_plan.error ? c.model_plan.tier : null,
      cost_usd: c.model_plan && !c.model_plan.error ? c.model_plan.estimated_cost_usd : 0
    })),
    total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    total_tokens: totalTokens,
    latency_ms: opts.latencyMs || null,
    policy: routeResult.policy || null
  };
}
