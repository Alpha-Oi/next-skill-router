import { recordChoice, readFeedback, getStats } from './storage.mjs';
import { loadWeights, saveWeights, computeWeightsFromHistory, resetWeights } from './weights.mjs';
import { redact } from '../../core/src/secrets/redactor.mjs';

export async function record(event) {
  const { text: safeQuery } = redact(event.query || '');

  const saved = await recordChoice({
    ...event,
    query: safeQuery
  });

  const all = await readFeedback();
  const newWeights = await computeWeightsFromHistory(all);
  await saveWeights(newWeights);

  return saved;
}

export async function weights() {
  return await loadWeights();
}

export async function stats(opts = {}) {
  return await getStats(opts);
}

export { resetWeights };
