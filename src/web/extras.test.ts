import { describe, expect, it } from 'vitest';
import { dedupeEvents } from './extras';
import type { SpawnEvent } from '../parser/types';

const ev = (item: string, at = '2026-11-08T12:00:00'): SpawnEvent => ({
  at,
  nick: '*Pupok',
  steamId: '1',
  kind: 'on-self',
  item,
});

describe('dedupeEvents', () => {
  it('keeps one copy of the same spawn', () => {
    const out = dedupeEvents([ev('CarTent'), ev('CarTent'), ev('Boat_01_Orange')]);
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.item)).toEqual(['CarTent', 'Boat_01_Orange']);
  });
});
