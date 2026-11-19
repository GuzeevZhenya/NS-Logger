import { describe, expect, it } from 'vitest';
import { latestEventDay, querySnapshot, type Snapshot } from './snapshot';

function snap(n: number): Snapshot {
  const events = Array.from({ length: n }, (_, i) => {
    const h = String(10 + (i % 10)).padStart(2, '0');
    const s = String(i % 60).padStart(2, '0');
    return {
      at: `2026-11-17T${h}:00:${s}`,
      nick: `P${i % 3}`,
      steamId: `7656119${String(i).padStart(10, '0')}`,
      kind: 'on-self' as const,
      category: 'spawn' as const,
      action: 'себе',
      item: `Item_${i}`,
    };
  });
  return {
    generatedAt: '2026-11-17T12:00:00.000Z',
    utcOffsetHours: 3,
    logDir: '',
    admins: [],
    catalog: {},
    extraForbidden: [],
    events,
    deletes: [],
  };
}

describe('querySnapshot pagination', () => {
  it('returns only one page and newest first', () => {
    const result = querySnapshot(snap(250), {
      from: '2026-11-17',
      to: '2026-11-17',
      admin: 'all',
      kind: '',
      q: '',
      forbiddenOnly: false,
      collapse: false,
      categories: ['spawn'],
      page: 1,
      pageSize: 100,
    });
    expect(result.events).toHaveLength(100);
    expect(result.total).toBe(250);
    expect(result.pages).toBe(3);
    expect(result.page).toBe(1);
    expect(result.events[0].at >= result.events[1].at).toBe(true);
  });

  it('keeps newest first when collapse is on', () => {
    const result = querySnapshot(snap(250), {
      from: '2026-11-17',
      to: '2026-11-17',
      admin: 'all',
      kind: '',
      q: '',
      forbiddenOnly: false,
      collapse: true,
      categories: ['spawn'],
      page: 1,
      pageSize: 100,
    });
    expect(result.events[0].at >= result.events[result.events.length - 1].at).toBe(true);
  });

  it('page 3 has the remainder', () => {
    const result = querySnapshot(snap(250), {
      from: '2026-11-17',
      to: '2026-11-17',
      admin: 'all',
      kind: '',
      q: '',
      forbiddenOnly: false,
      collapse: false,
      categories: ['spawn'],
      page: 3,
      pageSize: 100,
    });
    expect(result.events).toHaveLength(50);
    expect(result.page).toBe(3);
  });

  it('merges categories into one time line', () => {
    const data = snap(0);
    data.events = [
      {
        at: '2026-11-17T12:00:02',
        nick: 'A',
        steamId: '1',
        kind: 'other',
        category: 'teleport',
        action: 'tp',
        item: '1 2 3',
      },
      {
        at: '2026-11-17T12:00:01',
        nick: 'A',
        steamId: '1',
        kind: 'other',
        category: 'inventory',
        action: 'взял',
        item: 'Bandage',
      },
      {
        at: '2026-11-17T12:00:03',
        nick: 'A',
        steamId: '1',
        kind: 'other',
        category: 'teleport',
        action: 'tp',
        item: '4 5 6',
      },
    ];
    const result = querySnapshot(data, {
      from: '2026-11-17',
      to: '2026-11-17',
      admin: 'all',
      kind: '',
      q: '',
      forbiddenOnly: false,
      collapse: false,
      categories: ['teleport', 'inventory'],
      page: 1,
      pageSize: 100,
    });
    expect(result.events.map((e) => e.category)).toEqual([
      'teleport',
      'teleport',
      'inventory',
    ]);
    expect(result.events.map((e) => e.at)).toEqual([
      '2026-11-17T12:00:03',
      '2026-11-17T12:00:02',
      '2026-11-17T12:00:01',
    ]);
  });

  it('keeps admin and player logs in separate audiences', () => {
    const data = snap(0);
    data.admins = [{ steamId: 'A', nick: 'Admin' }];
    data.players = [{ steamId: 'P', nick: 'Player' }];
    data.events = [
      {
        at: '2026-11-17T12:00:03',
        nick: 'Admin',
        steamId: 'A',
        kind: 'on-self',
        category: 'spawn',
        action: 'себе',
        item: 'AKM',
      },
      {
        at: '2026-11-17T12:00:02',
        nick: 'Admin',
        steamId: 'A',
        kind: 'other',
        category: 'loot',
        action: 'взял',
        item: 'Bandage',
      },
      {
        at: '2026-11-17T12:00:01',
        nick: 'Player',
        steamId: 'P',
        kind: 'other',
        category: 'loot',
        action: 'взял',
        item: 'Apple',
      },
    ];
    const base = {
      from: '2026-11-17',
      to: '2026-11-17',
      admin: 'all' as const,
      kind: '' as const,
      q: '',
      forbiddenOnly: false,
      collapse: false,
      categories: ['spawn', 'loot'] as const,
      page: 1,
      pageSize: 100 as const,
    };
    const admins = querySnapshot(data, { ...base, categories: [...base.categories], audience: 'admins' });
    const players = querySnapshot(data, { ...base, categories: [...base.categories], audience: 'players' });
    const both = querySnapshot(data, { ...base, categories: [...base.categories], audience: 'both' });
    expect(admins.events.map((e) => e.steamId)).toEqual(['A', 'A']);
    expect(players.events.map((e) => e.steamId)).toEqual(['P']);
    expect(both.total).toBe(3);
  });

  it('picks the last day with events', () => {
    expect(
      latestEventDay([
        { at: '2026-11-15T10:00:00' },
        { at: '2026-11-16T23:59:00' },
        { at: '2026-11-14T12:00:00' },
      ]),
    ).toBe('2026-11-16');
  });
});
