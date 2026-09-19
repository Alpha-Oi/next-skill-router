#!/usr/bin/env node
import { Command } from 'commander';
import { route, loadSkills } from '../../core/src/router.mjs';

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
  .action(async (query, opts) => {
    const result = await route(query, { limit: parseInt(opts.limit, 10) });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log('');
    console.log('Query: ' + query);
    console.log('Total skills: ' + result.total_skills);
    console.log('');

    if (result.candidates.length === 0) {
      console.log('  No matches.');
      console.log('');
      return;
    }

    for (const c of result.candidates) {
      console.log('  ' + c.score.toFixed(3) + '  ' + c.name);
      console.log('         reason: ' + c.reason);
      console.log('         tier: ' + c.cost_tier + ' | complexity: ' + c.complexity
        + ' | tokens: ~' + c.estimated_tokens);
      if (!c.prerequisites_met) {
        console.log('         prerequisites missing: ' + c.prerequisites_missing.join(', '));
      }
      if (c.never_auto_invoke) {
        console.log('         never_auto_invoke: true');
      }
      console.log('         source: ' + c.source);
      console.log('');
    }
  });

program
  .command('list')
  .description('List all installed skills')
  .option('--json', 'output as JSON')
  .action(async (opts) => {
    const skills = await loadSkills();

    if (opts.json) {
      console.log(JSON.stringify(skills, null, 2));
      return;
    }

    console.log('');
    console.log('Found ' + skills.length + ' skills:');
    console.log('');

    for (const s of skills) {
      console.log('  ' + s.name.padEnd(28) + ' [' + s.source + ']');
      console.log('     ' + (s.description || '(no description)').slice(0, 90));
    }
    console.log('');
  });

program.parse();
