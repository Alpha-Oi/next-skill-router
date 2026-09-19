/**
 * Универсальный провайдер, работающий с любым API по конфигу.
 */

import type {
  Provider, ModelSpec, ChatMessage, ChatOptions, ChatResponse, ApiType, ModelTier,
} from './types.js';
import { computeCost } from './types.js';

interface RawModel {
  id: string;
  tier: ModelTier;
  context: number;
  price_input: number;
  price_output: number;
  capabilities: ModelSpec['capabilities'];
  safety: ModelSpec['safety'];
  notes?: string;
}

interface ProviderConfig {
  name: string;
  endpoint: string;
  apiType: ApiType;
  apiKeyEnv: string | null;
  models?: RawModel[];
  knownModels?: Record<string, { context: number; notes?: string }>;
}

export class GenericProvider implements Provider {
  readonly name: string;
  readonly endpoint: string;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.endpoint = config.endpoint;
    this.config = config;
  }

  private get apiKey(): string {
    if (!this.config.apiKeyEnv) return '';
    return process.env[this.config.apiKeyEnv] ?? '';
  }

  async health(): Promise<boolean> {
    try {
      if (this.config.apiType === 'ollama') {
        const res = await fetch(`${this.endpoint}/api/tags`, { signal: AbortSignal.timeout(1500) });
        return res.ok;
      }
      if (!this.config.apiKeyEnv) {
        const res = await fetch(`${this.endpoint}/models`, { signal: AbortSignal.timeout(1500) });
        return res.ok;
      }
      return !!this.apiKey;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelSpec[]> {
    if (this.config.models) {
      return this.config.models.map((m) => ({ ...m, provider: this.name }));
    }

    if (this.config.apiType === 'ollama') {
      const res = await fetch(`${this.endpoint}/api/tags`);
      if (!res.ok) return [];
      const data: any = await res.json();
      return (data.models ?? []).map((m: any) => {
        const known = this.config.knownModels?.[m.name] ?? { context: 32000 };
        return {
          id: m.name,
          provider: this.name,
          tier: 'local' as const,
          context: known.context,
          price_input: 0,
          price_output: 0,
          capabilities: { tools: true, vision: false, async_tools: false, adaptive_thinking: false, offline: true },
          safety: { reward_hacking_risk: 0, monitorability: 'high', compaction_risk: 'low', requires_verification: false },
          notes: known.notes,
        };
      });
    }

    const res = await fetch(`${this.endpoint}/models`, {
      headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return (data.data ?? []).map((m: any) => ({
      id: m.id,
      provider: this.name,
      tier: 'local' as const,
      context: 32000,
      price_input: 0,
      price_output: 0,
      capabilities: { tools: true, vision: false, async_tools: false, adaptive_thinking: false, offline: true },
      safety: { reward_hacking_risk: 0, monitorability: 'high', compaction_risk: 'low', requires_verification: false },
    }));
  }

  async chat(modelId: string, messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResponse> {
    const allModels = await this.listModels();
    const spec = allModels.find((m) => m.id === modelId);
    if (!spec) throw new Error(`Unknown model ${modelId} for provider ${this.name}`);

    if (this.config.apiType === 'anthropic') {
      const res = await fetch(`${this.endpoint}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2024-10-22',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: opts?.max_tokens ?? 4096,
          messages: messages.filter((m) => m.role !== 'system'),
          system: messages.find((m) => m.role === 'system')?.content,
          tools: opts?.tools,
        }),
      });
      if (!res.ok) throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const input = data.usage?.input_tokens ?? 0;
      const output = data.usage?.output_tokens ?? 0;
      return {
        model: modelId,
        content: data.content?.[0]?.text ?? '',
        usage: { input_tokens: input, output_tokens: output, cost_usd: computeCost(spec, input, output) },
        finish_reason: data.stop_reason ?? 'end_turn',
      };
    }

    if (this.config.apiType === 'google') {
      const res = await fetch(
        `${this.endpoint}/models/${modelId}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: { maxOutputTokens: opts?.max_tokens, temperature: opts?.temperature },
          }),
        },
      );
      if (!res.ok) throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const input = data.usageMetadata?.promptTokenCount ?? 0;
      const output = data.usageMetadata?.candidatesTokenCount ?? 0;
      return {
        model: modelId,
        content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
        usage: { input_tokens: input, output_tokens: output, cost_usd: computeCost(spec, input, output) },
        finish_reason: data.candidates?.[0]?.finishReason ?? 'stop',
      };
    }

    if (this.config.apiType === 'ollama') {
      const res = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: false,
          options: { temperature: opts?.temperature, num_predict: opts?.max_tokens },
        }),
      });
      if (!res.ok) throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
      const data: any = await res.json();
      const input = data.prompt_eval_count ?? 0;
      const output = data.eval_count ?? 0;
      return {
        model: modelId,
        content: data.message?.content ?? '',
        usage: { input_tokens: input, output_tokens: output, cost_usd: 0 },
        finish_reason: data.done ? 'stop' : 'length',
      };
    }

    // Default: OpenAI-compatible
    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: opts?.temperature,
        max_tokens: opts?.max_tokens,
        reasoning_effort: opts?.reasoning_effort,
        tools: opts?.tools,
      }),
    });
    if (!res.ok) throw new Error(`${this.name} ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    const input = data.usage?.prompt_tokens ?? 0;
    const output = data.usage?.completion_tokens ?? 0;
    return {
      model: modelId,
      content: data.choices?.[0]?.message?.content ?? '',
      tool_calls: data.choices?.[0]?.message?.tool_calls,
      usage: { input_tokens: input, output_tokens: output, cost_usd: computeCost(spec, input, output) },
      finish_reason: data.choices?.[0]?.finish_reason ?? 'stop',
    };
  }
}
