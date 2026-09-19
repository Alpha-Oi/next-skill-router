import { describe, it, expect } from 'vitest';
import { buildLexicalIndex, lexicalSearch } from '../packages/core/src/search/lexical.mjs';

const skills = [
  { name: 'code-review', description: 'Проверка качества кода.', intents: ['проверить код', 'review'], language: [] },
  { name: 'test-runner', description: 'Запуск тестов.', intents: ['run tests', 'запустить тесты'], language: [] },
  { name: 'commit-writer', description: 'Сообщения коммитов.', intents: ['написать коммит'], language: [] }
];

describe('lexical search', () => {
  it('finds skill by exact Russian term', () => {
    const mini = buildLexicalIndex(skills);
    const r = lexicalSearch(mini, 'код');
    expect(r.length).toBeGreaterThan(0);
    expect(skills[r[0].id].name).toBe('code-review');
  });

  it('finds skill by English term', () => {
    const mini = buildLexicalIndex(skills);
    const r = lexicalSearch(mini, 'tests');
    expect(r.length).toBeGreaterThan(0);
    expect(skills[r[0].id].name).toBe('test-runner');
  });

  it('returns empty for garbage query', () => {
    const mini = buildLexicalIndex(skills);
    const r = lexicalSearch(mini, 'xqzptlk');
    expect(r).toEqual([]);
  });
});
