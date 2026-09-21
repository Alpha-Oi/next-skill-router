/**
 * Экспоненциальное сглаживание весов навыков на основе обратной связи.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

function weightsPath() {
  return process.env.NSR_WEIGHTS_PATH
    || join(homedir(), '.claude', 'skill-router', 'weights.json');
}

const DEFAULT_WEIGHT = 1.0;
const MIN_WEIGHT = 0.5;
const MAX_WEIGHT = 1.5;
const ETA = 0.1;

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

export async function loadWeights() {
  try {
    const raw = await readFile(weightsPath(), 'utf8');
    const data = JSON.parse(raw);
    return data.weights || {};
  } catch {
    return {};
  }
}

export async function saveWeights(weights) {
  const path = weightsPath();
  await ensureDir(path);
  const payload = {
    updated: new Date().toISOString(),
    count: Object.keys(weights).length,
    weights
  };
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf8');
}

export async function getWeight(skillName) {
  const weights = await loadWeights();
  return weights[skillName] ?? DEFAULT_WEIGHT;
}

export async function applyFeedback(weights, { chosen, recommended }) {
  const w = { ...weights };
  const clamp = (x) => Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, x));

  if (chosen) {
    const cur = w[chosen] ?? DEFAULT_WEIGHT;
    w[chosen] = clamp(cur + ETA * (MAX_WEIGHT - cur));
  }

  for (const name of (recommended || [])) {
    if (name === chosen) continue;
    const cur = w[name] ?? DEFAULT_WEIGHT;
    w[name] = clamp(cur - ETA * (cur - MIN_WEIGHT) * 0.5);
  }

  return w;
}

export async function computeWeightsFromHistory(records) {
  let w = {};
  for (const r of records) {
    if (r.outcome === 'reject') continue;
    w = await applyFeedback(w, { chosen: r.chosen, recommended: r.recommended });
  }
  return w;
}

export const DEFAULTS = { DEFAULT_WEIGHT, MIN_WEIGHT, MAX_WEIGHT, ETA };

export function getWeightsPath() {
  return weightsPath();
}

export async function resetWeights() {
  await saveWeights({});
}
