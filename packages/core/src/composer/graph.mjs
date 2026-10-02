/**
 * Граф навыков. Узлы — навыки, рёбра — composable_with.
 * Используется Composer для построения DAG.
 */

/**
 * Строит ориентированный граф из списка навыков.
 * Возвращает { nodes: Map<name, skill>, edges: Map<name, Set<name>> }.
 */
export function buildGraph(skills) {
  const nodes = new Map();
  const edges = new Map();

  for (const s of skills) {
    nodes.set(s.name, s);
    edges.set(s.name, new Set());
  }

  for (const s of skills) {
    const targets = s.composable_with || [];
    for (const t of targets) {
      if (nodes.has(t)) {
        edges.get(s.name).add(t);
      }
    }
  }

  return { nodes, edges };
}

/**
 * Топологическая сортировка. Возвращает массив имён или null при цикле.
 * Обрабатывает только узлы из subset (если передан).
 */
export function topoSort(graph, subset = null) {
  const names = subset
    ? [...subset].filter((n) => graph.nodes.has(n))
    : [...graph.nodes.keys()];

  const inDegree = new Map();
  for (const n of names) inDegree.set(n, 0);

  for (const n of names) {
    for (const target of graph.edges.get(n) || []) {
      if (inDegree.has(target)) {
        inDegree.set(target, inDegree.get(target) + 1);
      }
    }
  }

  const queue = names.filter((n) => inDegree.get(n) === 0);
  const sorted = [];

  while (queue.length > 0) {
    const n = queue.shift();
    sorted.push(n);

    for (const target of graph.edges.get(n) || []) {
      if (!inDegree.has(target)) continue;
      inDegree.set(target, inDegree.get(target) - 1);
      if (inDegree.get(target) === 0) queue.push(target);
    }
  }

  if (sorted.length !== names.length) return null; // цикл
  return sorted;
}

/**
 * Проверка конфликтов между набором навыков.
 * Возвращает массив пар конфликтов [{a, b, reason}].
 */
export function findConflicts(skills) {
  const byName = new Map(skills.map((s) => [s.name, s]));
  const conflicts = [];
  const seen = new Set();

  for (const s of skills) {
    const conflictsWith = s.conflicts_with || [];
    for (const c of conflictsWith) {
      if (!byName.has(c)) continue;
      const key = [s.name, c].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        a: s.name,
        b: c,
        reason: s.name + ' conflicts_with ' + c
      });
    }
  }

  return conflicts;
}

/**
 * Рекурсивно собирает все зависимости навыка (транзитивное замыкание).
 */
export function collectDependencies(graph, name) {
  const result = new Set();
  const stack = [name];

  while (stack.length > 0) {
    const n = stack.pop();
    for (const dep of graph.edges.get(n) || []) {
      if (result.has(dep)) continue;
      result.add(dep);
      stack.push(dep);
    }
  }

  return result;
}
