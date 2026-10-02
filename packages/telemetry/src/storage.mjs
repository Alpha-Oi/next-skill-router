/**
 * Append-only JSONL хранилище телеметрии.
 * Файл на месяц: ~/.claude/skill-router/telemetry/YYYY-MM.jsonl
 */

import { appendFile, readFile, readdir, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const NL = String.fromCharCode(10);

function telemetryDir() {
  return process.env.NSR_TELEMETRY_DIR || join(homedir(), '.claude', 'skill-router', 'telemetry');
}

function monthFile() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  return join(telemetryDir(), ym + '.jsonl');
}

export async function recordSpan(span) {
  const path = monthFile();
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(span) + NL, 'utf8');
  return span;
}

export async function readAllSpans() {
  const dir = telemetryDir();
  let files;
  try { files = await readdir(dir); } catch { return []; }
  const spans = [];
  for (const f of files.filter((x) => x.endsWith('.jsonl'))) {
    try {
      const raw = await readFile(join(dir, f), 'utf8');
      for (const line of raw.split(NL)) {
        if (!line.trim()) continue;
        try { spans.push(JSON.parse(line)); } catch {}
      }
    } catch {}
  }
  return spans.sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));
}

export async function readRecentSpans(sinceMs) {
  const all = await readAllSpans();
  if (!sinceMs) return all;
  const cutoff = Date.now() - sinceMs;
  return all.filter((s) => Date.parse(s.ts) >= cutoff);
}

export function getTelemetryDir() { return telemetryDir(); }
