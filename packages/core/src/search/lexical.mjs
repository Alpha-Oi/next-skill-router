import MiniSearch from 'minisearch';

export function buildLexicalIndex(skills) {
  const mini = new MiniSearch({
    fields: ['name', 'description', 'intents', 'language'],
    storeFields: ['name', 'description', 'complexity', 'cost_tier'],
    searchOptions: {
      boost: { name: 3, intents: 2, description: 1 },
      fuzzy: 0.1,           // было 0.2 — уменьшили, чтобы не было ложных срабатываний
      prefix: true,
      combineWith: 'AND'    // все термины запроса должны присутствовать
    }
  });

  mini.addAll(skills.map((s, i) => ({
    id: i,
    name: s.name,
    description: s.description || '',
    intents: (s.intents || []).join(' '),
    language: (s.language || []).join(' ')
  })));

  return mini;
}

export function lexicalSearch(mini, query, limit = 10) {
  // Сначала пробуем строгий AND-поиск.
  let results = mini.search(query);
  // Если пусто — ослабляем до OR (без combineWith), но всё ещё без fuzzy на коротких терминах.
  if (results.length === 0) {
    results = mini.search(query, { combineWith: 'OR', fuzzy: false });
  }
  return results.slice(0, limit);
}
