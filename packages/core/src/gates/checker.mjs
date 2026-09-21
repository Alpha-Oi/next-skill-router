/**
 * Gates checker: выполняет pre/post проверки, объявленные в SKILL-MANIFEST.
 * Декларативная модель — навык говорит что проверить, хост исполняет.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { containsSecrets } from '../secrets/redactor.mjs';

/**
 * Известные gate-проверки.
 * Каждая — { name, fn(context) → { passed, reason } }
 */
const CHECKERS = {
  dependencies_installed: (ctx) => {
    const skill = ctx.skill || {};
    const prereqs = skill.prerequisites || {};
    const files = prereqs.files || [];
    const tools = prereqs.tools || [];
    const projectDir = ctx.projectDir || process.cwd();

    const missingFiles = files.filter((f) => !existsSync(join(projectDir, f)));
    if (missingFiles.length > 0) {
      return { passed: false, reason: 'missing files: ' + missingFiles.join(', ') };
    }

    const missingTools = [];
    for (const tool of tools) {
      try {
        execSync('command -v ' + tool + ' || where ' + tool, { stdio: 'ignore' });
      } catch {
        missingTools.push(tool);
      }
    }
    if (missingTools.length > 0) {
      return { passed: false, reason: 'missing tools: ' + missingTools.join(', ') };
    }

    return { passed: true };
  },

  git_clean: (ctx) => {
    const projectDir = ctx.projectDir || process.cwd();
    try {
      const out = execSync('git status --porcelain', { encoding: 'utf8', cwd: projectDir });
      const lines = out.split('\n').filter(Boolean);
      const allowed = ctx.allowedChanges || [];
      const unexpected = lines.filter((l) => !allowed.some((a) => l.includes(a)));
      if (unexpected.length > 0) {
        return { passed: false, reason: unexpected.length + ' unexpected changes' };
      }
      return { passed: true };
    } catch {
      return { passed: false, reason: 'not a git repository' };
    }
  },

  tests_pass: (ctx) => {
    const projectDir = ctx.projectDir || process.cwd();
    try {
      execSync('npm test', { stdio: 'ignore', cwd: projectDir, timeout: 120_000 });
      return { passed: true };
    } catch (e) {
      return { passed: false, reason: 'tests failed' };
    }
  },

  no_secrets_in_diff: (ctx) => {
    const projectDir = ctx.projectDir || process.cwd();
    try {
      const diff = execSync('git diff HEAD', { encoding: 'utf8', cwd: projectDir });
      if (containsSecrets(diff)) {
        return { passed: false, reason: 'potential secret in diff' };
      }
      return { passed: true };
    } catch {
      return { passed: true }; // если нет git — пропускаем
    }
  }
};

/**
 * Выполняет список gate-проверок.
 *
 * @param {string[]} gateNames — список имён gates
 * @param {Object} context — { skill, projectDir, allowedChanges }
 * @returns {Object} — { passed, results }
 */
export function runGates(gateNames, context = {}) {
  if (!gateNames || gateNames.length === 0) {
    return { passed: true, results: [] };
  }

  const results = [];
  for (const name of gateNames) {
    const check = CHECKERS[name];
    if (!check) {
      results.push({ gate: name, passed: true, skipped: true, reason: 'unknown gate' });
      continue;
    }
    try {
      const r = check(context);
      results.push({ gate: name, ...r });
    } catch (e) {
      results.push({ gate: name, passed: false, reason: 'error: ' + e.message });
    }
  }

  const passed = results.every((r) => r.passed);
  return { passed, results };
}

export const KNOWN_GATES = Object.keys(CHECKERS);
