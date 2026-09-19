/**
 * Локальный embedder на базе ONNX MiniLM (Xenova/all-MiniLM-L6-v2).
 * Модель скачивается при первом использовании (~80 МБ) в ~/.claude/skill-router/models/.
 * После первой загрузки — полностью офлайн.
 */

import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

let pipelineFn = null;
let loading = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

function getCacheDir() {
  return process.env.NSR_CACHE_DIR || join(homedir(), '.claude', 'skill-router', 'models');
}

async function getPipeline() {
  if (pipelineFn) return pipelineFn;
  if (loading) return loading;

  loading = (async () => {
    const { pipeline, env } = await import('@xenova/transformers');

    // Всегда задаём конкретный путь — не undefined.
    const cacheDir = getCacheDir();
    await mkdir(cacheDir, { recursive: true });

    env.cacheDir = cacheDir;
    env.useBrowserCache = false;
    env.allowLocalModels = true;
    env.allowRemoteModels = true; // скачает один раз, дальше из кеша

    pipelineFn = await pipeline('feature-extraction', MODEL_NAME, { quantized: true });
    return pipelineFn;
  })();

  return loading;
}

export async function embed(text) {
  const pipe = await getPipeline();
  const out = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

export async function embedBatch(texts) {
  const pipe = await getPipeline();
  const out = await pipe(texts, { pooling: 'mean', normalize: true });
  const dims = out.dims;
  const n = dims[0];
  const dim = dims[dims.length - 1];
  const arr = Array.from(out.data);
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(arr.slice(i * dim, (i + 1) * dim));
  }
  return results;
}

export function cosine(a, b) {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

export async function isAvailable() {
  try {
    await getPipeline();
    return true;
  } catch (e) {
    console.warn('Semantic unavailable: ' + e.message);
    return false;
  }
}
