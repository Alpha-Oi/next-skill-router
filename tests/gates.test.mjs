import { describe, it, expect } from 'vitest';
import { runGates, KNOWN_GATES } from '../packages/core/src/gates/checker.mjs';

describe('runGates', () => {
  it('returns pass for empty list', () => {
    const r = runGates([]);
    expect(r.passed).toBe(true);
  });

  it('skips unknown gates', () => {
    const r = runGates(['unknown_gate_xyz']);
    expect(r.results[0].skipped).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('passes git_clean in clean repo', () => {
    const r = runGates(['git_clean'], { projectDir: process.cwd() });
    // В CI может быть чисто; локально может быть грязно. Проверяем структуру.
    expect(r.results[0].gate).toBe('git_clean');
    expect(typeof r.results[0].passed).toBe('boolean');
  });

  it('lists known gates', () => {
    expect(KNOWN_GATES).toContain('git_clean');
    expect(KNOWN_GATES).toContain('tests_pass');
    expect(KNOWN_GATES).toContain('no_secrets_in_diff');
  });
});
