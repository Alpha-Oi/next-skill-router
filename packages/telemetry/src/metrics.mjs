/**
 * Агрегация спанов в метрики.
 */

export function computeMetrics(spans) {
  if (!spans || spans.length === 0) {
    return {
      total: 0,
      date_range: null,
      avg_latency_ms: 0,
      total_cost_usd: 0,
      total_tokens: 0,
      redacted_count: 0,
      top_skills: [],
      by_day: [],
      by_model_tier: {}
    };
  }

  const latencies = spans.map((s) => s.latency_ms).filter((x) => typeof x === "number");
  const costs = spans.map((s) => s.total_cost_usd || 0);
  const tokens = spans.map((s) => s.total_tokens || 0);
  const redactions = spans.reduce((sum, s) => sum + (s.redacted || 0), 0);

  const skillCount = new Map();
  for (const s of spans) {
    if (s.top_skill) skillCount.set(s.top_skill, (skillCount.get(s.top_skill) || 0) + 1);
  }
  const top_skills = [...skillCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const byDay = new Map();
  for (const s of spans) {
    const day = (s.ts || "").slice(0, 10);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, { day, count: 0, cost: 0, tokens: 0 });
    const d = byDay.get(day);
    d.count += 1;
    d.cost += s.total_cost_usd || 0;
    d.tokens += s.total_tokens || 0;
  }
  const by_day = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

  const byTier = {};
  for (const s of spans) {
    for (const c of (s.candidates || [])) {
      if (!c.model_tier) continue;
      byTier[c.model_tier] = (byTier[c.model_tier] || 0) + 1;
    }
  }

  return {
    total: spans.length,
    date_range: spans.length > 0 ? { from: spans[0].ts, to: spans[spans.length - 1].ts } : null,
    avg_latency_ms: latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    total_cost_usd: Math.round(costs.reduce((a, b) => a + b, 0) * 1e6) / 1e6,
    total_tokens: tokens.reduce((a, b) => a + b, 0),
    redacted_count: redactions,
    top_skills,
    by_day,
    by_model_tier: byTier
  };
}
