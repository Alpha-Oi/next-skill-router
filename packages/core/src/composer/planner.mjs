/**
 * Planner: строит план выполнения из набора навыков.
 *
 * Вход: запрос пользователя + список установленных навыков.
 * Выход: последовательность шагов с моделью и стоимостью.
 *
 * Алгоритм:
 *   1. Найти топ-N кандидатов через route().
 *   2. Построить граф по composable_with.
 *   3. Взять транзитивное замыкание для топ-1 (если есть).
 *   4. Проверить конфликты.
 *   5. Топологически отсортировать.
 *   6. Для каждого шага подобрать модель через selectModel.
 *   7. Посчитать общую стоимость.
 */

import { buildGraph, topoSort, findConflicts, collectDependencies } from './graph.mjs';
import { selectModel, estimateCost } from '../ranker/model-selector.mjs';

const DEFAULT_MAX_STEPS = 5;

/**
 * Планирует цепочку навыков для выполнения запроса.
 *
 * @param {Object} opts
 * @param {string} opts.query — запрос пользователя
 * @param {Object[]} opts.candidates — топ-N кандидатов от route()
 * @param {Object[]} opts.allSkills — все установленные навыки
 * @param {Object} [opts.policy] — { max_cost_usd, max_tokens, local_only }
 * @param {number} [opts.maxSteps]
 */
export async function plan({ query, candidates, allSkills, policy = {}, maxSteps = DEFAULT_MAX_STEPS }) {
  if (!candidates || candidates.length === 0) {
    return { plan: [], total_cost_usd: 0, reason: 'no_candidates' };
  }

  // Берём топ-кандидатов по score
  const topNames = candidates.slice(0, 3).map((c) => c.name);
  const byName = new Map(allSkills.map((s) => [s.name, s]));
  const graph = buildGraph(allSkills);

  // Собираем узлы плана: топ-3 + транзитивные зависимости
  const planNodes = new Set(topNames);
  for (const n of topNames) {
    for (const dep of collectDependencies(graph, n)) {
      planNodes.add(dep);
    }
  }

  // Ограничиваем размер
  if (planNodes.size > maxSteps) {
    // Оставляем только топ-N по score
    const scoreByName = new Map(candidates.map((c) => [c.name, c.score]));
    const sorted = [...planNodes].sort((a, b) => (scoreByName.get(b) || 0) - (scoreByName.get(a) || 0));
    planNodes.clear();
    for (const n of sorted.slice(0, maxSteps)) planNodes.add(n);
  }

  // Проверяем конфликты
  const planSkills = [...planNodes].map((n) => byName.get(n)).filter(Boolean);
  const conflicts = findConflicts(planSkills);
  if (conflicts.length > 0) {
    return {
      plan: [],
      total_cost_usd: 0,
      conflicts,
      reason: 'conflicts_detected'
    };
  }

  // Топологическая сортировка
  const sorted = topoSort(graph, planNodes);
  if (!sorted) {
    return { plan: [], total_cost_usd: 0, reason: 'cycle_detected' };
  }

  // Для каждого шага подбираем модель и считаем стоимость
  let totalCost = 0;
  const steps = [];

  for (let i = 0; i < sorted.length; i++) {
    const skill = byName.get(sorted[i]);
    if (!skill) continue;

    const sel = await selectModel(skill, policy);
    const cost = sel ? sel.estimated_cost_usd : 0;
    totalCost += cost;

    steps.push({
      step: i + 1,
      skill: skill.name,
      complexity: skill.complexity,
      estimated_tokens: skill.estimated_tokens,
      model_plan: sel
        ? {
            tier: sel.model.tier,
            model: sel.model.id,
            provider: sel.model.provider,
            reason: sel.reason,
            estimated_cost_usd: round(cost, 6),
            offline: sel.model.capabilities?.offline || false
          }
        : { error: 'no_model_fits_budget' },
      depends_on: [...(graph.edges.get(skill.name) || [])]
        .filter((t) => planNodes.has(t) && sorted.indexOf(t) > i)
        .map((t) => t)
    });
  }

  return {
    plan: steps,
    total_cost_usd: round(totalCost, 6),
    total_tokens: steps.reduce((sum, s) => sum + (s.estimated_tokens || 0), 0),
    query,
    reason: 'ok'
  };
}

function round(x, d) {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
