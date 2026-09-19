/**
 * Выбор модели по tier и ограничениям.
 */

import type { ModelSpec, ModelTier } from '../providers/types.js';
import { ProviderRegistry } from '../providers/registry.js';

export interface SelectionPolicy {
  require_local_only?: boolean;
  require_offline?: boolean;
  max_cost_per_call_usd?: number;
}

export interface SelectionResult {
  spec: ModelSpec;
  reason: string;
  estimated_cost_usd: number;
}

export async function selectModel(
  registry: ProviderRegistry,
  estimatedTokens: number,
  affinity: Partial<Record<ModelTier, { preferred?: string; fallback?: string[] }>>,
  policy: SelectionPolicy = {},
): Promise<SelectionResult | null> {
  const allModels = await registry.listModels();

  let candidates = allModels;
  if (policy.require_local_only || policy.require_offline) {
    candidates = candidates.filter((m) => m.tier === 'local');
  }

  const tierOrder: ModelTier[] = (policy.require_local_only || policy.require_offline)
    ? ['local']
    : ['local', 'cloud_budget', 'cloud_frontier', 'specialized'];

  for (const tier of tierOrder) {
    const pool = candidates.filter((m) => m.tier === tier);
    if (pool.length === 0) continue;

    const entry = affinity[tier];
    if (entry?.preferred) {
      const m = pool.find((x) => x.id === entry.preferred);
      if (m) {
        const cost = estimate(m, estimatedTokens);
        if (!policy.max_cost_per_call_usd || cost <= policy.max_cost_per_call_usd) {
          return { spec: m, reason: `affinity.preferred for tier=${tier}`, estimated_cost_usd: cost };
        }
      }
    }

    if (entry?.fallback) {
      for (const fbId of entry.fallback) {
        const m = pool.find((x) => x.id === fbId);
        if (!m) continue;
        const cost = estimate(m, estimatedTokens);
        if (!policy.max_cost_per_call_usd || cost <= policy.max_cost_per_call_usd) {
          return { spec: m, reason: `affinity.fallback for tier=${tier}`, estimated_cost_usd: cost };
        }
      }
    }

    const sorted = [...pool].sort((a, b) => estimate(a, estimatedTokens) - estimate(b, estimatedTokens));
    const cheapest = sorted[0];
    const cost = estimate(cheapest, estimatedTokens);
    if (!policy.max_cost_per_call_usd || cost <= policy.max_cost_per_call_usd) {
      return { spec: cheapest, reason: `cheapest in tier=${tier}`, estimated_cost_usd: cost };
    }
  }

  return null;
}

function estimate(spec: ModelSpec, tokens: number): number {
  const half = tokens / 2;
  return (half / 1_000_000) * spec.price_input + (half / 1_000_000) * spec.price_output;
}
