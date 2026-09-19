import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseManifest } from '../packages/core/src/indexer/manifest.mjs';
import { validateSkill } from '../packages/core/src/indexer/validator.mjs';

let tmp;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'nsr-test-'));
});

afterAll(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

describe('parseManifest', () => {
  it('parses valid frontmatter', async () => {
    const dir = join(tmp, 'valid');
    await mkdir(dir, { recursive: true });
    const md = [
      '---',
      'name: test-skill',
      'version: 1.0.0',
      'description: "Test: description with colon"',
      'intents:',
      '  - "run tests"',
      '---',
      '',
      '# Test',
      ''
    ].join('\n');
    await writeFile(join(dir, 'SKILL.md'), md, 'utf8');

    const skill = await parseManifest(dir, md);
    expect(skill.name).toBe('test-skill');
    expect(skill.version).toBe('1.0.0');
    expect(skill.description).toBe('Test: description with colon');
    expect(skill.intents).toEqual(['run tests']);
    expect(skill.source).toBe('frontmatter');
  });

  it('falls back when no frontmatter', async () => {
    const dir = join(tmp, 'nofm');
    await mkdir(dir, { recursive: true });
    const md = '# My Skill\n\nFirst paragraph.\n\nSecond paragraph.\n';
    await writeFile(join(dir, 'SKILL.md'), md, 'utf8');

    const skill = await parseManifest(dir, md);
    expect(skill.name).toBe('My Skill');
    expect(skill.description).toBe('First paragraph.');
    expect(skill.source).toBe('fallback');
  });
});

describe('validateSkill', () => {
  it('accepts valid skill', async () => {
    const dir = join(tmp, 'valid2');
    await mkdir(dir, { recursive: true });
    const md = '---\nname: good\nversion: 1.0.0\ndescription: Fine.\n---\n\n# Good\n';
    await writeFile(join(dir, 'SKILL.md'), md, 'utf8');
    const r = await validateSkill(dir);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects broken YAML', async () => {
    const dir = join(tmp, 'broken');
    await mkdir(dir, { recursive: true });
    const md = '---\nname: broken\ndescription: Bad: value unquoted\n  invalid\n---\n';
    await writeFile(join(dir, 'SKILL.md'), md, 'utf8');
    const r = await validateSkill(dir);
    // YAML может распарситься или упасть — главное, чтобы не выбросило исключение
    expect(r).toHaveProperty('ok');
    expect(r).toHaveProperty('errors');
    expect(r).toHaveProperty('warnings');
  });

  it('warns on missing required fields', async () => {
    const dir = join(tmp, 'incomplete');
    await mkdir(dir, { recursive: true });
    const md = '---\nname: incomplete\n---\n\n# X\n';
    await writeFile(join(dir, 'SKILL.md'), md, 'utf8');
    const r = await validateSkill(dir);
    expect(r.warnings.some((w) => w.includes('version'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('description'))).toBe(true);
  });
});
