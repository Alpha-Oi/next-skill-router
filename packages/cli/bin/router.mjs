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
  .option('--budget-usd <n>', 'max cost per call in USD (filters models)')
  .option('--budget-tokens <n>', 'max tokens per call')
  .option('--local-only', 'use only local models (offline, no cost)')
  .action(async (query, opts) => {
    const result = await route(query, {
      limit: parseInt(opts.limit, 10),
      semantic: opts.semantic,
      maxCostUsd: opts.budgetUsd ? parseFloat(opts.budgetUsd) : undefined,
      maxTokens: opts.budgetTokens ? parseInt(opts.budgetTokens, 10) : undefined,
      localOnly: !!opts.localOnly
    });

    if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }

    console.log('');
    console.log('Query: ' + query);
    if (result.cleaned_query) console.log('After stopword filter: "' + result.cleaned_query + '"');
    console.log('Total skills: ' + result.total_skills + ' | mode: ' + (result.mode || 'lexical'));
    if (result.policy) {
      const parts = [];
      if (result.policy.max_cost_usd !== undefined) parts.push('budget=$' + result.policy.max_cost_usd);
      if (result.policy.max_tokens) parts.push('tokens<' + result.policy.max_tokens);
      if (result.policy.local_only) parts.push('local-only');
      console.log('Policy: ' + parts.join(', '));
    }
    console.log('');

    if (result.candidates.length === 0) {
      console.log('  No matches.');
      console.log('');
      return;
    }

    const top = result.candidates[0].score || 1;
    for (const c of result.candidates) {
      const barLen = Math.max(1, Math.round((c.score / top) * 20));
      const bar = '#'.repeat(barLen);
      console.log('  ' + c.score.toFixed(1).padStart(6) + '  ' + bar + '  ' + c.name);

      if (opts.explain) {
        console.log('           Lexical:       ' + c.breakdown.lexical.toFixed(1));
        console.log('           Semantic:      ' + c.breakdown.semantic.toFixed(3));
        console.log('           Fused (base):  ' + c.breakdown.base.toFixed(1));
        console.log('           Prerequisites: ' + (c.prerequisites_met ? 'OK' : 'MISSING: ' + c.prerequisites_missing.join(', ')));
        console.log('           Auto-invoke:   ' + (c.never_auto_invoke ? 'BLOCKED' : 'allowed'));
        if (c.breakdown.penalties.length > 0) {
          for (const p of c.breakdown.penalties) {
            console.log('           Penalty:       ' + p.reason + ' (' + p.value + ')');
          }
        }
        console.log('           --------------------------------');
        console.log('           Final:         ' + c.score.toFixed(1));
        console.log('           Matched terms: ' + ((c.breakdown.matched_terms || []).join(', ') || '(none)'));
        console.log('           Source:        ' + c.source);
        if (c.model_plan) {
          if (c.model_plan.error) {
            console.log('           Model:         [ERR] ' + c.model_plan.error);
          } else {
            console.log('           Model:         ' + c.model_plan.model + ' (' + c.model_plan.tier + ', ' + c.model_plan.provider + ')');
            console.log('           Model reason:  ' + c.model_plan.reason);
            console.log('           Est. cost:     $' + c.model_plan.estimated_cost_usd + (c.model_plan.offline ? ' (offline)' : ''));
          }
        }
      } else {
        console.log('           ' + c.reason);
        console.log('           tier: ' + c.cost_tier + ' | complexity: ' + c.complexity + ' | ~' + c.estimated_tokens + ' tokens');
        if (c.model_plan && !c.model_plan.error) {
          console.log('           model: ' + c.model_plan.model + ' ($' + c.model_plan.estimated_cost_usd + ')');
        }
        if (!c.prerequisites_met) console.log('           prerequisites missing: ' + c.prerequisites_missing.join(', '));
        if (c.never_auto_invoke) console.log('           never_auto_invoke: true');
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
  .command('show <name>')
  .description('Show full metadata for a skill')
  .option('--json', 'output as JSON')
  .action(async (name, opts) => {
    const skills = await loadSkills();
    const skill = skills.find((s) => s.name === name);
    if (!skill) {
      console.error('Skill not found: ' + name);
      process.exit(1);
    }
    if (opts.json) { console.log(JSON.stringify(skill, null, 2)); return; }
    console.log('');
    console.log(skill.name + (skill.version && skill.version !== '0.0.0' ? ' v' + skill.version : ''));
    console.log('-'.repeat(40));
    console.log('Description:    ' + (skill.description || '(none)'));
    if (skill.argument_hint) console.log('Argument hint:  ' + skill.argument_hint);
    console.log('Complexity:     ' + skill.complexity);
    console.log('Cost tier:      ' + skill.cost_tier);
    console.log('Est. tokens:    ~' + skill.estimated_tokens);
    console.log('Source:         ' + skill.source);
    if (skill.intents && skill.intents.length > 0) {
      console.log('Intents:');
      for (const i of skill.intents) console.log('  - ' + i);
    }
    if (skill.language && skill.language.length > 0) console.log('Language:       ' + skill.language.join(', '));
    if (skill.composable_with && skill.composable_with.length > 0) console.log('Composable with: ' + skill.composable_with.join(', '));
    if (skill.never_auto_invoke) console.log('Never auto-invoke: true');
    console.log('');
  });

program
  .command('validate')
  .description('Validate SKILL.md files')
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
      const nm = r.dir.split(/[\\/]/).pop();
      if (!r.ok) {
        console.log('  FAIL  ' + nm);
        for (const e of r.errors) console.log('         error:   ' + e);
        for (const w of r.warnings) console.log('         warning: ' + w);
        errs += r.errors.length; warns += r.warnings.length;
      } else if (r.warnings.length > 0) {
        console.log('  WARN  ' + nm);
        for (const w of r.warnings) console.log('         warning: ' + w);
        warns += r.warnings.length;
      } else {
        console.log('  OK    ' + nm);
      }
    }
    console.log('');
    console.log('Total: ' + results.length + ' skills, ' + errs + ' errors, ' + warns + ' warnings');
    console.log('');
    if (errs > 0) process.exit(1);
  });

program.parse();
