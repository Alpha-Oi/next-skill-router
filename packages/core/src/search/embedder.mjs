/**
 * Локальный embedder на базе ONNX MiniLM (Xenova/all-MiniLM-L6-v2).
 * Модель скачивается при первом использовании (~80 МБ) и кешируется.
 * Никаких сетевых вызовов во время работы — после первой загрузки всё офлайн.
 */

let pipelineFn = null;
let loading = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

async function getPipeline() {
  if (pipelineFn) return pipelineFn;
  if (loading) return loading;

  loading = (async () => {
    const { pipeline, env } = await import('@xenova/transformers');
    // Кешируем модель в ~/.claude/skill-router/cache/
    env.cacheDir = process.env.NSR_CACHE_DIR || undefined;
    env.allowLocalModels = true;
    pipelineFn = await pipeline('feature-extraction', MODEL_NAME, { quantized: true });
    return pipelineFn;
  })();

  return loading;
}

/**
 * Эмбеддинг текста. Возвращает Float32Array нормализованный.
 */
export async function embed(text) {
  const pipe = await getPipeline();
  const out = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

/**
 * Эмбеддинг батчем.
 */
export async function embedBatch(texts) {
  const pipe = await getPipeline();
  const out = await pipe(texts, { pooling: 'mean', normalize: true });
  // out.dims = [n, dim]
  const [n, dim] = out.dims;
  const arr = Array.from(out.data);
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(arr.slice(i * dim, (i + 1) * dim));
  }
  return results;
}

/**
 * Косинусная близость. Для нормализованных векторов = скалярное произведение.
 */
export function cosine(a, b) {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Проверка, доступен ли embedder. Если модель ещё не загружена — грузим.
 */
export async function isAvailable() {
  try {
    await getPipeline();
    return true;
  } catch (e) {
    console.warn('Semantic unavailable: ' + e.message);
    return false;
  }
}
