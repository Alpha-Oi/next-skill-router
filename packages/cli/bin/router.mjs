#!/usr/bin/env node
import { Command } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { route, loadSkills } from '../../core/src/router.mjs';
import { validateAll } from '../../core/src/indexer/validator.mjs';

const program = new Command();
program
  .name('next-skill-router')
  .description('Universal skill router for Claude Code and Codex')
  .version('0.1.0');

program
  .command('search <query>')
  .description('Find best skills for a query')
  .option('-l, --limit <n>', 'number of results', '5')
  .option('--json', 'output as JSON')
  .option('--explain', 'show score breakdown')
  .option('--no-semantic', 'disable semantic search (lexical only)')
  .action(async (query, opts) => {
    const result = await route(query, { limit: parseInt(opts.limit, 10), semantic: opts.semantic });

    if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }

    console.log('');
    console.log('Query: ' + query);
    console.log('Total skills: ' + result.total_skills + ' | mode: ' + (result.mode || 'lexical'));
    console.log('');

    if (result.candidates.length === 0) { console.log('  No matches.'); console.log(''); return; }

    for (const c of result.candidates) {
      console.log('  ' + c.score.toFixed(3) + '  ' + c.name);
      if (opts.explain) {
        console.log('         Lexical:       ' + (c.breakdown.lexical || 0).toFixed(3));
        console.log('         Semantic:      ' + (c.breakdown.semantic || 0).toFixed(3));
        console.log('         Fused:         ' + c.breakdown.base.toFixed(3));
        console.log('         Prerequisites: ' + (c.prerequisites_met ? 'OK' : 'MISSING: ' + c.prerequisites_missing.join(', ')));
        console.log('         Auto-invoke:   ' + (c.never_auto_invoke ? 'BLOCKED' : 'allowed'));
        if (c.breakdown.penalties.length > 0) {
          for (const p of c.breakdown.penalties) {
            console.log('         Penalty:       ' + p.reason + ' (' + p.value + ')');
          }
        }
        console.log('         -----------------------------');
        console.log('         Final:         ' + c.score.toFixed(3));
        console.log('         Matched terms: ' + (c.breakdown.matched_terms.join(', ') || '(none)'));
        console.log('         Source:        ' + c.source);
      } else {
        console.log('         reason: ' + c.reason);
        console.log('         tier: ' + c.cost_tier + ' | complexity: ' + c.complexity + ' | tokens: ~' + c.estimated_tokens);
        if (!c.prerequisites_met) console.log('         prerequisites missing: ' + c.prerequisites_missing.join(', '));
        if (c.never_auto_invoke) console.log('         never_auto_invoke: true');
        console.log('         source: ' + c.source);
      }
      console.log('');
    }
  });

program
  .command('list')
  .description('List all installed skills')
  .option('--json', 'output as JSON')
  .action(async (opts) => {
    const skills = await loadSkills();
    if (opts.json) { console.log(JSON.stringify(skills, null, 2)); return; }
    console.log('');
    console.log('Found ' + skills.length + ' skills:');
    console.log('');
    for (const s of skills) {
      console.log('  ' + s.name.padEnd(28) + ' [' + s.source + ']');
      console.log('     ' + (s.description || '(no description)').slice(0, 90));
    }
    console.log('');
  });

program
  .command('validate')
  .description('Validate SKILL.md files (frontmatter, required fields)')
  .option('--json', 'output as JSON')
  .action(async (opts) => {
    const roots = [
      join(homedir(), '.claude', 'skills'),
      join(process.cwd(), '.claude', 'skills')
    ];
    const results = await validateAll(roots);

    if (opts.json) { console.log(JSON.stringify(results, null, 2)); return; }

    let errs = 0, warns = 0;
    console.log('');
    for (const r of results) {
      const name = r.dir.split(/[\\/]/).pop();
      if (!r.ok) {
        console.log('  FAIL  ' + name);
        for (const e of r.errors) console.log('         error:   ' + e);
        for (const w of r.warnings) console.log('         warning: ' + w);
        errs += r.errors.length; warns += r.warnings.length;
      } else if (r.warnings.length > 0) {
        console.log('  WARN  ' + name);
        for (const w of r.warnings) console.log('         warning: ' + w);
        warns += r.warnings.length;
      } else {
        console.log('  OK    ' + name);
      }
    }
    console.log('');
    console.log('Total: ' + results.length + ' skills, ' + errs + ' errors, ' + warns + ' warnings');
    console.log('');
    if (errs > 0) process.exit(1);
  });

program.parse();
