import { describe, it, expect } from 'vitest';
import { hybridRank, rrf } from '../packages/core/src/search/hybrid.mjs';

describe('hybridRank', () => {
  it('items appearing in both lists get higher score than items in one', () => {
    // 'a' есть и в lexical, и в semantic → должен выиграть
    // 'b' только в lexical, 'c' только в semantic
    const lex = [{ name: 'a' }, { name: 'b' }];
    const sem = [{ name: 'a' }, { name: 'c' }];
    const fused = hybridRank(lex, sem);
    const a = fused.find((f) => f.name === 'a');
    const b = fused.find((f) => f.name === 'b');
    const c = fused.find((f) => f.name === 'c');
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.score).toBeGreaterThan(c.score);
    expect(fused[0].name).toBe('a');
  });

  it('respects lexical weight', () => {
    const lex = [{ name: 'a' }, { name: 'b' }];
    const sem = [{ name: 'b' }, { name: 'a' }];
    const fused = hybridRank(lex, sem, { weightLexical: 10, weightSemantic: 0.1 });
    // 'a' выше в lexical, с большим весом должен победить
    expect(fused[0].name).toBe('a');
  });

  it('returns empty for empty input', () => {
    const fused = hybridRank([], []);
    expect(fused).toEqual([]);
  });
});

describe('rrf', () => {
  it('is stable for identical rankings', () => {
    const r = [{ name: 'x' }, { name: 'y' }];
    const fused = rrf([r, r]);
    expect(fused[0].name).toBe('x');
  });
});
