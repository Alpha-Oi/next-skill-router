import { describe, it, expect } from 'vitest';
import { redact, containsSecrets } from '../packages/core/src/secrets/redactor.mjs';

describe('redact', () => {
  it('redacts OpenAI key', () => {
    const r = redact('my key is sk-abcdefghijklmnopqrstuvwx');
    expect(r.redacted).toBe(1);
    expect(r.text).toContain('[REDACTED:OPENAI_API_KEY]');
    expect(r.text).not.toContain('sk-abc');
  });

  it('redacts GitHub token', () => {
    const r = redact('token: ghp_' + 'a'.repeat(40));
    expect(r.redacted).toBe(1);
    expect(r.text).toContain('[REDACTED:GITHUB_TOKEN]');
  });

  it('redacts AWS access key', () => {
    const r = redact('AKIAIOSFODNN7EXAMPLE');
    expect(r.redacted).toBe(1);
    expect(r.text).toContain('[REDACTED:AWS_ACCESS_KEY_ID]');
  });

  it('redacts Slack token', () => {
    const r = redact('xoxb-1234567890-abcdefghij');
    expect(r.redacted).toBe(1);
    expect(r.text).toContain('[REDACTED:SLACK_TOKEN]');
  });

  it('leaves normal text alone', () => {
    const r = redact('проверь код и запусти тесты');
    expect(r.redacted).toBe(0);
    expect(r.text).toBe('проверь код и запусти тесты');
  });

  it('handles empty string', () => {
    const r = redact('');
    expect(r.redacted).toBe(0);
    expect(r.text).toBe('');
  });
});

describe('containsSecrets', () => {
  it('detects OpenAI key', () => {
    expect(containsSecrets('sk-' + 'a'.repeat(30))).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(containsSecrets('hello world')).toBe(false);
  });
});
