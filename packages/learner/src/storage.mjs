/**
 * Хранилище обратной связи. Append-only JSONL.
 * Данные локальные, не передаются никуда.
 *
 * Путь вычисляется при каждом вызове — env можно менять в тестах.
 */

import { appendFile, readFile, mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

function feedbackPath() {
  return process.env.NSR_FEEDBACK_PATH
    || join(homedir(), '.claude', 'skill-router', 'feedback.jsonl');
}

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

export async function recordChoice(event) {
  const path = feedbackPath();
  await ensureDir(path);

  const record = {
    ts: new Date().toISOString(),
    query: event.query,
    recommended: event.recommended || [],
    chosen: event.chosen || null,
    outcome: event.outcome || 'accept',
    note: event.note || null
  };

  await appendFile(path, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export async function readFeedback(opts = {}) {
  const path = feedbackPath();
  try {
    await stat(path);
  } catch {
    return [];
  }

  const raw = await readFile(path, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const now = Date.now();
  const cutoff = opts.sinceMs ? now - opts.sinceMs : 0;

  const records = [];
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (cutoff > 0 && Date.parse(r.ts) < cutoff) continue;
      records.push(r);
    } catch {
      // пропускаем повреждённые строки
    }
  }
  return records;
}

export async function getStats(opts = {}) {
  const records = await readFeedback(opts);

  const byChosen = new Map();
  const byRank = { 1: 0, 2: 0, '3+': 0 };
  let accepted = 0;
  let rejected = 0;
  let replaced = 0;
  let top1Correct = 0;

  for (const r of records) {
    if (r.chosen) {
      byChosen.set(r.chosen, (byChosen.get(r.chosen) || 0) + 1);
    }

    const rank = (r.recommended || []).indexOf(r.chosen) + 1;
    if (rank === 1) { byRank[1]++; top1Correct++; }
    else if (rank === 2) byRank[2]++;
    else if (rank > 2) byRank['3+']++;

    if (r.outcome === 'accept') accepted++;
    else if (r.outcome === 'reject') rejected++;
    else if (r.outcome === 'replace') replaced++;
  }

  const total = records.length;
  const precision_at_1 = total > 0 ? top1Correct / total : 0;

  const top_skills = [...byChosen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    total,
    accepted,
    rejected,
    replaced,
    precision_at_1: round(precision_at_1, 4),
    top_skills,
    rank_distribution: byRank,
    window: opts.sinceMs ? (opts.sinceMs / 86400000).toFixed(1) + 'd' : 'all-time'
  };
}

export function getFeedbackPath() {
  return feedbackPath();
}

function round(x, d) {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
