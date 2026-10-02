import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp; let originalEnv;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'nsr-tel-'));
  originalEnv = { ...process.env };
  process.env.NSR_TELEMETRY_DIR = tmp;
});

afterEach(async () => {
  process.env = originalEnv;
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('tracer', () => {
  it('creates a span from route result', async () => {
    const { createSpan } = await import('../packages/telemetry/src/tracer.mjs');
    const r = {
      cleaned_query: 'test', mode: 'hybrid', total_skills: 10,
      candidates: [{ name: 'code-review', score: 32.5, cost_tier: 'cheap', estimated_tokens: 5000,
        model_plan: { tier: 'local', model: 'qwen3:7b', estimated_cost_usd: 0 } }]
    };
    const span = createSpan('test query', r, { latencyMs: 42 });
    expect(span.span_id).toBeDefined();
    expect(span.top_skill).toBe('code-review');
    expect(span.total_cost_usd).toBe(0);
    expect(span.latency_ms).toBe(42);
  });
});

describe('storage', () => {
  it('records and reads spans', async () => {
    const { recordSpan, readAllSpans } = await import('../packages/telemetry/src/storage.mjs');
    await recordSpan({ ts: new Date().toISOString(), query: 'a', top_skill: 'x' });
    await recordSpan({ ts: new Date().toISOString(), query: 'b', top_skill: 'y' });
    const spans = await readAllSpans();
    expect(spans.length).toBe(2);
  });
});

describe('metrics', () => {
  it('computes aggregate metrics', async () => {
    const { computeMetrics } = await import('../packages/telemetry/src/metrics.mjs');
    const spans = [
      { ts: '2026-01-01T10:00:00Z', top_skill: 'a', latency_ms: 30, total_cost_usd: 0.001, total_tokens: 5000, redacted: 0, candidates: [] },
      { ts: '2026-01-01T11:00:00Z', top_skill: 'a', latency_ms: 50, total_cost_usd: 0.002, total_tokens: 6000, redacted: 1, candidates: [] },
      { ts: '2026-01-02T10:00:00Z', top_skill: 'b', latency_ms: 40, total_cost_usd: 0.001, total_tokens: 4000, redacted: 0, candidates: [] }
    ];
    const m = computeMetrics(spans);
    expect(m.total).toBe(3);
    expect(m.avg_latency_ms).toBe(40);
    expect(m.total_tokens).toBe(15000);
    expect(m.redacted_count).toBe(1);
    expect(m.top_skills[0].name).toBe('a');
    expect(m.by_day.length).toBe(2);
  });

  it('handles empty input', async () => {
    const { computeMetrics } = await import('../packages/telemetry/src/metrics.mjs');
    const m = computeMetrics([]);
    expect(m.total).toBe(0);
  });
});

describe('dashboard', () => {
  it('renders HTML with embedded data', async () => {
    const { renderDashboard } = await import('../packages/telemetry/src/dashboard.mjs');
    const { computeMetrics } = await import('../packages/telemetry/src/metrics.mjs');
    const spans = [{ ts: new Date().toISOString(), top_skill: "x", total_cost_usd: 0, candidates: [] }];
    const html = await renderDashboard(computeMetrics(spans), spans);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('next-skill-router');
  });
});
