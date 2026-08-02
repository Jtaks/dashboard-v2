import { describe, expect, it } from 'vitest';
import { parseDismissedIds, pruneDismissedIds } from './prune.js';

describe('pruneDismissedIds', () => {
  it('removes an id that is no longer returned', () => {
    expect(pruneDismissedIds(['a', 'b', 'c'], ['a', 'c'])).toEqual(['a', 'c']);
  });

  it('keeps an id that is still returned', () => {
    expect(pruneDismissedIds(['live-1'], ['live-1', 'live-2'])).toEqual(['live-1']);
  });

  it('removes an unknown id in storage', () => {
    expect(pruneDismissedIds(['ghost'], ['live-1'])).toEqual([]);
  });

  it('returns empty when nothing was stored', () => {
    expect(pruneDismissedIds([], ['live-1'])).toEqual([]);
  });

  it('returns empty when the live list is empty', () => {
    expect(pruneDismissedIds(['a', 'b'], [])).toEqual([]);
  });
});

describe('parseDismissedIds', () => {
  it('resolves malformed JSON to an empty list rather than throwing', () => {
    expect(parseDismissedIds('{not-json')).toEqual([]);
    expect(parseDismissedIds('<<<')).toEqual([]);
    expect(parseDismissedIds('true')).toEqual([]);
    expect(parseDismissedIds('{}')).toEqual([]);
    expect(parseDismissedIds('null')).toEqual([]);
  });

  it('returns an empty list for missing or empty storage', () => {
    expect(parseDismissedIds(null)).toEqual([]);
    expect(parseDismissedIds(undefined)).toEqual([]);
    expect(parseDismissedIds('')).toEqual([]);
  });

  it('keeps only string ids from a valid array', () => {
    expect(parseDismissedIds(JSON.stringify(['a', 1, null, 'b', true]))).toEqual(['a', 'b']);
  });
});
