import MiniSearch from 'minisearch';

export function buildLexicalIndex(skills) {
  const mini = new MiniSearch({
    fields: ['name', 'description', 'intents', 'language'],
    storeFields: ['name', 'description', 'complexity', 'cost_tier'],
    searchOptions: {
      boost: { name: 2.5, intents: 2, description: 1 },
      fuzzy: 0.2,
      prefix: true
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
  return mini.search(query).slice(0, limit);
}
