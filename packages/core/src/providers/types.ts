/**
 * Единый интерфейс провайдера моделей.
 * Все провайдеры (облачные и локальные) реализуют этот контракт.
 */

export type ModelTier = 'local' | 'cloud_budget' | 'cloud_frontier' | 'specialized';
export type ApiType = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface ModelCapabilities {
  tools: boolean;
  vision: boolean;
  async_tools: boolean;
  adaptive_thinking: boolean;
  offline: boolean;
}

export interface ModelSafety {
  reward_hacking_risk: number;
  monitorability: 'low' | 'medium' | 'high';
  compaction_risk: 'low' | 'medium' | 'high';
  requires_verification: boolean;
  known_incidents?: string[];
}

export interface ModelSpec {
  id: string;
  provider: string;
  tier: ModelTier;
  context: number;
  price_input: number;
  price_output: number;
  capabilities: ModelCapabilities;
  safety: ModelSafety;
  notes?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';
  thinking?: 'adaptive' | 'disabled';
  tools?: unknown[];
  stream?: boolean;
}

export interface ChatResponse {
  model: string;
  content: string;
  tool_calls?: unknown[];
  usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  finish_reason: string;
}

export interface Provider {
  readonly name: string;
  readonly endpoint?: string;
  health(): Promise<boolean>;
  listModels(): Promise<ModelSpec[]>;
  chat(modelId: string, messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResponse>;
}

export function computeCost(spec: ModelSpec, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * spec.price_input
       + (outputTokens / 1_000_000) * spec.price_output;
}
