import { describe, it, expect } from 'vitest';
import { buildGraph, topoSort, findConflicts, collectDependencies } from '../packages/core/src/composer/graph.mjs';

const sample = [
  { name: 'a', composable_with: ['b'], conflicts_with: [] },
  { name: 'b', composable_with: ['c'], conflicts_with: [] },
  { name: 'c', composable_with: [], conflicts_with: [] },
  { name: 'd', composable_with: [], conflicts_with: ['a'] }
];

describe('buildGraph', () => {
  it('builds nodes and edges from composable_with', () => {
    const g = buildGraph(sample);
    expect(g.nodes.size).toBe(4);
    expect(g.edges.get('a').has('b')).toBe(true);
    expect(g.edges.get('b').has('c')).toBe(true);
    expect(g.edges.get('c').size).toBe(0);
  });

  it('ignores composable_with for unknown skills', () => {
    const g = buildGraph([{ name: 'x', composable_with: ['nonexistent'] }]);
    expect(g.edges.get('x').size).toBe(0);
  });
});

describe('topoSort', () => {
  it('sorts a DAG correctly', () => {
    const g = buildGraph(sample);
    const sorted = topoSort(g);
    expect(sorted).not.toBeNull();
    // 'a' должен быть до 'b', 'b' до 'c'
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  it('sorts a subset', () => {
    const g = buildGraph(sample);
    const sorted = topoSort(g, new Set(['a', 'b']));
    expect(sorted).toEqual(['a', 'b']);
  });

  it('returns null on cycle', () => {
    const cyclic = [
      { name: 'a', composable_with: ['b'] },
      { name: 'b', composable_with: ['a'] }
    ];
    const g = buildGraph(cyclic);
    expect(topoSort(g)).toBeNull();
  });
});

describe('findConflicts', () => {
  it('detects conflicts_with', () => {
    const conflicts = findConflicts(sample);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].a).toBe('d');
    expect(conflicts[0].b).toBe('a');
  });

  it('returns empty when no conflicts', () => {
    const conflicts = findConflicts([{ name: 'x', conflicts_with: [] }]);
    expect(conflicts).toEqual([]);
  });
});

describe('collectDependencies', () => {
  it('collects transitive dependencies', () => {
    const g = buildGraph(sample);
    const deps = collectDependencies(g, 'a');
    expect(deps.has('b')).toBe(true);
    expect(deps.has('c')).toBe(true);
  });

  it('returns empty for leaf node', () => {
    const g = buildGraph(sample);
    const deps = collectDependencies(g, 'c');
    expect(deps.size).toBe(0);
  });
});
