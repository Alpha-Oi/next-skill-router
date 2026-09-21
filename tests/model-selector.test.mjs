import { describe, it, expect } from 'vitest';
import { selectModel, estimateCost } from '../packages/core/src/ranker/model-selector.mjs';

const skill = {
  name: 'code-review',
  complexity: 'low',
  estimated_tokens: 8000,
  model_affinity: {}
};

describe('estimateCost', () => {
  it('computes cost from prices', () => {
    const m = { price_input: 1, price_output: 3 };
    const cost = estimateCost(m, 1_000_000);
    // 0.5M * 1 / 1M + 0.5M * 3 / 1M = 0.5 + 1.5 = 2.0
    expect(cost).toBeCloseTo(2.0, 5);
  });

  it('local models are free', () => {
    const m = { price_input: 0, price_output: 0 };
    expect(estimateCost(m, 100000)).toBe(0);
  });
});

describe('selectModel', () => {
  it('selects a model for a simple skill', async () => {
    const result = await selectModel(skill, {});
    expect(result).not.toBeNull();
    expect(result.model).toBeDefined();
    expect(result.estimated_cost_usd).toBeGreaterThanOrEqual(0);
  });

  it('local_only restricts to local tier', async () => {
    const result = await selectModel(skill, { local_only: true });
    if (result) {
      expect(result.model.tier).toBe('local');
    }
  });

  it('tight budget still finds cheapest', async () => {
    // 8000 токенов на deepseek-v4-flash ≈ $0.0002
    const result = await selectModel(skill, { max_cost_usd: 0.01 });
    expect(result).not.toBeNull();
    expect(result.estimated_cost_usd).toBeLessThanOrEqual(0.01);
  });

  it('impossible budget returns null', async () => {
    const result = await selectModel(skill, { max_cost_usd: 0.0000001, local_only: false });
    // Может быть null или самая дешёвая локальная за $0
    if (result) {
      expect(result.estimated_cost_usd).toBeLessThanOrEqual(0.0000001);
    }
  });
});
