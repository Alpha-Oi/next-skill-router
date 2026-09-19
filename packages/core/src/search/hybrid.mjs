/**
 * Reciprocal Rank Fusion: объединяет несколько ранжированных списков.
 * Стандарт: k = 60 (Cormack et al., 2009).
 */
export function rrf(rankings, k = 60) {
  const scores = new Map();
  for (const ranking of rankings) {
    ranking.forEach((item, rank) => {
      const key = item.name || item.id;
      const prev = scores.get(key) || 0;
      scores.set(key, prev + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Гибридный поиск: BM25 (MiniSearch) + семантика → RRF.
 */
export function hybridRank(lexical, semantic, opts = {}) {
  const k = opts.k || 60;
  const wLex = opts.weightLexical ?? 1.0;
  const wSem = opts.weightSemantic ?? 1.0;

  const scores = new Map();

  lexical.forEach((item, rank) => {
    const name = item.name;
    const prev = scores.get(name) || 0;
    scores.set(name, prev + wLex / (k + rank + 1));
  });

  semantic.forEach((item, rank) => {
    const name = item.name;
    const prev = scores.get(name) || 0;
    scores.set(name, prev + wSem / (k + rank + 1));
  });

  return [...scores.entries()]
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}
