/**
 * Reciprocal Rank Fusion — объединяет несколько ранжированных списков
 * в один. Используется для гибридного поиска (BM25 + семантика).
 */
export function rrf(rankings, k = 60) {
  const scores = new Map();
  for (const ranking of rankings) {
    ranking.forEach((item, rank) => {
      const id = item.id;
      const prev = scores.get(id) ?? 0;
      scores.set(id, prev + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
