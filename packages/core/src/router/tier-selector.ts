/**
 * Выбор tier для выполнения навыка.
 */

import type { ModelTier } from '../providers/types.js';

export interface ProjectPolicy {
  require_local_only?: boolean;
  require_offline?: boolean;
  data_residency?: string;
}

export interface SkillMeta {
  complexity: 'low' | 'medium' | 'high';
  data_sensitivity?: 'low' | 'medium' | 'high';
  is_security?: boolean;
  is_vision?: boolean;
}

export function selectTier(skill: SkillMeta, policy: ProjectPolicy): ModelTier {
  if (policy.require_local_only || policy.require_offline) return 'local';
  if (skill.data_sensitivity === 'high') return 'local';
  if (skill.is_security || skill.is_vision) return 'specialized';
  if (skill.complexity === 'high') return 'cloud_frontier';
  return 'cloud_budget';
}
