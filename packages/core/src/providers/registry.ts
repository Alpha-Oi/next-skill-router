import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { Provider, ModelSpec, ModelTier } from './types.js';
import { GenericProvider } from './generic-provider.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ProviderConfigFile {
  providers: Array<{
    name: string;
    endpoint: string;
    apiType: 'openai' | 'anthropic' | 'google' | 'ollama';
    apiKeyEnv: string | null;
    models?: any[];
  }>;
  localRuntimes: Array<{
    name: string;
    endpoint: string;
    apiType: 'openai' | 'anthropic' | 'google' | 'ollama';
    apiKeyEnv: string | null;
    knownModels?: Record<string, { context: number; notes?: string }>;
  }>;
}

export class ProviderRegistry {
  private providers = new Map<string, Provider>();
  private modelCache: ModelSpec[] | null = null;

  static async load(): Promise<ProviderRegistry> {
    const registry = new ProviderRegistry();
    const configPath = join(__dirname, 'models.json');
    const config: ProviderConfigFile = JSON.parse(await readFile(configPath, 'utf8'));

    for (const p of config.providers) {
      registry.providers.set(p.name, new GenericProvider(p));
    }
    for (const r of config.localRuntimes) {
      registry.providers.set(r.name, new GenericProvider({
        name: r.name,
        endpoint: r.endpoint,
        apiType: r.apiType,
        apiKeyEnv: r.apiKeyEnv,
        knownModels: r.knownModels,
      }));
    }
    return registry;
  }

  get(name: string) { return this.providers.get(name); }
  all(): Provider[] { return [...this.providers.values()]; }

  async listModels(force = false): Promise<ModelSpec[]> {
    if (this.modelCache && !force) return this.modelCache;
    const out: ModelSpec[] = [];
    for (const p of this.providers.values()) {
      try {
        if (await p.health()) out.push(...(await p.listModels()));
      } catch { /* unavailable */ }
    }
    this.modelCache = out;
    return out;
  }

  async listByTier(tier: ModelTier): Promise<ModelSpec[]> {
    return (await this.listModels()).filter((m) => m.tier === tier);
  }

  async hasLocal(): Promise<boolean> {
    return (await this.listByTier('local')).length > 0;
  }

  async cloudAvailable(): Promise<boolean> {
    return (await this.listModels()).some((m) => m.tier !== 'local');
  }
}
