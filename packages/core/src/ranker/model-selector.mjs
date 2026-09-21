/**
 * Выбирает модель для выполнения навыка по:
 *   1. tier (по skill.complexity)
 *   2. model_affinity (из манифеста)
 *   3. policy (budget, local-only)
 */

import { loadModels } from '../providers/loader.mjs';

/**
 * Оценка стоимости одного вызова.
 * Грубая формула: 50% input, 50% output.
 */
export function estimateCost(model, estimatedTokens) {
  const half = estimatedTokens / 2;
  return (half / 1_000_000) * model.price_input + (half / 1_000_000) * model.price_output;
}

/**
 * Выбор модели.
 *
 * @param {Object} skill — навык из manifest
 * @param {Object} policy — { max_cost_usd, max_tokens, local_only }
 * @returns {Object|null} — { model, reason, estimated_cost_usd }
 */
export async function selectModel(skill, policy = {}) {
  const { cloud, local } = await loadModels();

  // 1. Жёсткие ограничения
  let candidates = policy.local_only ? [...local] : [...cloud, ...local];

  if (policy.max_tokens && skill.estimated_tokens > policy.max_tokens) {
    return null; // весь навык не влезает в бюджет по токенам
  }

  // 2. Определяем tier по complexity
  const tierOrder = policy.local_only
    ? ['local']
    : skill.complexity === 'high'
      ? ['cloud_frontier', 'cloud_budget', 'local']
      : ['cloud_budget', 'local', 'cloud_frontier'];

  for (const tier of tierOrder) {
    const pool = candidates.filter((m) => m.tier === tier && m.available);
    if (pool.length === 0) continue;

    // 3. Проверяем affinity
    const affinity = (skill.model_affinity || {})[tier];
    if (affinity) {
      const preferred = pool.find((m) => m.id === affinity.preferred);
      if (preferred) {
        const cost = estimateCost(preferred, skill.estimated_tokens);
        if (!policy.max_cost_usd || cost <= policy.max_cost_usd) {
          return {
            model: preferred,
            reason: 'affinity.preferred for tier=' + tier,
            estimated_cost_usd: cost
          };
        }
      }
      for (const fbId of (affinity.fallback || [])) {
        const fb = pool.find((m) => m.id === fbId);
        if (!fb) continue;
        const cost = estimateCost(fb, skill.estimated_tokens);
        if (!policy.max_cost_usd || cost <= policy.max_cost_usd) {
          return {
            model: fb,
            reason: 'affinity.fallback for tier=' + tier,
            estimated_cost_usd: cost
          };
        }
      }
    }

    // 4. Самая дешёвая в tier
    const sorted = pool.sort((a, b) => estimateCost(a, skill.estimated_tokens) - estimateCost(b, skill.estimated_tokens));
    for (const m of sorted) {
      const cost = estimateCost(m, skill.estimated_tokens);
      if (!policy.max_cost_usd || cost <= policy.max_cost_usd) {
        return {
          model: m,
          reason: 'cheapest in tier=' + tier,
          estimated_cost_usd: cost
        };
      }
    }
  }

  return null; // ничего не подошло
}
