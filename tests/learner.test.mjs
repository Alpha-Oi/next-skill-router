import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp;
let originalEnv;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'nsr-learner-'));
  originalEnv = { ...process.env };
  process.env.NSR_FEEDBACK_PATH = join(tmp, 'feedback.jsonl');
  process.env.NSR_WEIGHTS_PATH = join(tmp, 'weights.json');
});

afterEach(async () => {
  process.env = originalEnv;
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('weights', () => {
  it('default weight is 1.0 for unknown skill', async () => {
    const { getWeight } = await import('../packages/learner/src/weights.mjs');
    const w = await getWeight('unknown-skill');
    expect(w).toBe(1.0);
  });

  it('applyFeedback boosts winner, dampens losers', async () => {
    const { applyFeedback } = await import('../packages/learner/src/weights.mjs');
    const w = await applyFeedback({}, { chosen: 'a', recommended: ['a', 'b', 'c'] });
    expect(w.a).toBeGreaterThan(1.0);
    expect(w.b).toBeLessThan(1.0);
    expect(w.c).toBeLessThan(1.0);
  });

  it('weights are clamped to [0.5, 1.5]', async () => {
    const { applyFeedback } = await import('../packages/learner/src/weights.mjs');
    let w = {};
    for (let i = 0; i < 100; i++) {
      w = await applyFeedback(w, { chosen: 'a', recommended: ['a', 'b'] });
    }
    expect(w.a).toBeLessThanOrEqual(1.5);
    expect(w.b).toBeGreaterThanOrEqual(0.5);
  });

  it('saveWeights and loadWeights round-trip', async () => {
    const { saveWeights, loadWeights } = await import('../packages/learner/src/weights.mjs');
    await saveWeights({ foo: 1.2, bar: 0.8 });
    const w = await loadWeights();
    expect(w.foo).toBe(1.2);
    expect(w.bar).toBe(0.8);
  });
});

describe('storage', () => {
  it('records and reads back a choice', async () => {
    const { recordChoice, readFeedback } = await import('../packages/learner/src/storage.mjs');
    await recordChoice({
      query: 'test query',
      recommended: ['a', 'b'],
      chosen: 'a',
      outcome: 'accept'
    });
    const records = await readFeedback();
    expect(records.length).toBe(1);
    expect(records[0].chosen).toBe('a');
    expect(records[0].recommended).toEqual(['a', 'b']);
  });

  it('getStats computes precision@1', async () => {
    const { recordChoice, getStats } = await import('../packages/learner/src/storage.mjs');
    // 3 раза выбрали top-1
    for (let i = 0; i < 3; i++) {
      await recordChoice({ query: 'q', recommended: ['a', 'b'], chosen: 'a', outcome: 'accept' });
    }
    // 1 раз выбрали top-2
    await recordChoice({ query: 'q', recommended: ['a', 'b'], chosen: 'b', outcome: 'accept' });

    const stats = await getStats();
    expect(stats.total).toBe(4);
    expect(stats.precision_at_1).toBe(0.75);
    expect(stats.rank_distribution[1]).toBe(3);
    expect(stats.rank_distribution[2]).toBe(1);
  });

  it('empty history returns zero stats', async () => {
    const { getStats } = await import('../packages/learner/src/storage.mjs');
    const stats = await getStats();
    expect(stats.total).toBe(0);
    expect(stats.precision_at_1).toBe(0);
  });
});

describe('collector', () => {
  it('record() redacts secrets before storing', async () => {
    const { record } = await import('../packages/learner/src/collector.mjs');
    const { readFeedback } = await import('../packages/learner/src/storage.mjs');

    await record({
      query: 'fix code with sk-abcdefghijklmnopqrstuvwx',
      recommended: ['code-review'],
      chosen: 'code-review',
      outcome: 'accept'
    });

    const records = await readFeedback();
    expect(records.length).toBe(1);
    expect(records[0].query).toContain('[REDACTED:OPENAI_API_KEY]');
    expect(records[0].query).not.toContain('sk-abcdef');
  });

  it('record() updates weights automatically', async () => {
    const { record, weights } = await import('../packages/learner/src/collector.mjs');

    await record({
      query: 'test',
      recommended: ['winner', 'loser'],
      chosen: 'winner',
      outcome: 'accept'
    });

    const w = await weights();
    expect(w.winner).toBeGreaterThan(1.0);
    expect(w.loser).toBeLessThan(1.0);
  });
});
