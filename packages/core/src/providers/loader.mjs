/**
 * Загружает models.json и предоставляет плоский список моделей
 * с пометкой доступности (по наличию env-переменной API-ключа).
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'models.json');

let cache = null;

export async function loadModels() {
  if (cache) return cache;

  const raw = await readFile(CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);

  const cloud = (config.providers || []).flatMap((p) =>
    (p.models || []).map((m) => ({
      ...m,
      provider: p.name,
      apiKeyEnv: p.apiKeyEnv,
      available: p.apiKeyEnv ? !!process.env[p.apiKeyEnv] : true,
      endpoint: p.endpoint,
      apiType: p.apiType
    }))
  );

  const local = (config.localRuntimes || []).flatMap((r) =>
    (Object.entries(r.knownModels || {})).map(([id, meta]) => ({
      id,
      provider: r.name,
      tier: 'local',
      context: meta.context || 32000,
      price_input: 0,
      price_output: 0,
      capabilities: { tools: true, vision: false, async_tools: false, adaptive_thinking: false, offline: true },
      safety: { reward_hacking_risk: 0, monitorability: 'high', compaction_risk: 'low', requires_verification: false },
      available: true, // local runtime детектится отдельно в будущем
      endpoint: r.endpoint,
      apiType: r.apiType,
      notes: meta.notes
    }))
  );

  cache = { cloud, local, all: [...cloud, ...local] };
  return cache;
}

export function resetModelCache() {
  cache = null;
}
