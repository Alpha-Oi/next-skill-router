import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');

describe('integrations', () => {
  it('claude-code hook exists and is valid JS', async () => {
    const p = join(REPO, 'integrations', 'claude-code', 'hook.mjs');
    expect(existsSync(p)).toBe(true);
    const content = await readFile(p, 'utf8');
    expect(content).toContain('SessionStart');
    expect(content).toContain('additionalContext');
  });

  it('claude-code install script exists', async () => {
    const p = join(REPO, 'integrations', 'claude-code', 'install.mjs');
    expect(existsSync(p)).toBe(true);
    const content = await readFile(p, 'utf8');
    expect(content).toContain('settings.json');
  });

  it('mcp server exists', async () => {
    const p = join(REPO, 'integrations', 'mcp-server', 'server.mjs');
    expect(existsSync(p)).toBe(true);
    const content = await readFile(p, 'utf8');
    expect(content).toContain('search_skills');
    expect(content).toContain('list_skills');
    expect(content).toContain('protocolVersion');
  });

  it('README files exist for both integrations', () => {
    expect(existsSync(join(REPO, 'integrations', 'claude-code', 'README.md'))).toBe(true);
    expect(existsSync(join(REPO, 'integrations', 'mcp-server', 'README.md'))).toBe(true);
  });
});
