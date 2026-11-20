import { describe, expect, it } from 'vitest';
import { collectAdmins, collectPlayers } from './enrich.js';
import type { SpawnEvent } from './types.js';

function ev(partial: Partial<SpawnEvent> & Pick<SpawnEvent, 'steamId' | 'nick' | 'category'>): SpawnEvent {
  return {
    at: '2026-11-17T12:00:00',
    kind: 'other',
    action: 'x',
    item: 'Item',
    ...partial,
  };
}

describe('collectAdmins / collectPlayers', () => {
  it('puts VPP actions into admins and player logs into players', () => {
    const events: SpawnEvent[] = [
      ev({ steamId: '1', nick: 'Boss', category: 'spawn', kind: 'on-self' }),
      ev({ steamId: '1', nick: 'Boss', category: 'teleport' }),
      ev({ steamId: '1', nick: 'Boss', category: 'loot' }),
      ev({ steamId: '2', nick: 'Trader', category: 'trade' }),
      ev({ steamId: '3', nick: 'Looter', category: 'inventory' }),
    ];
    const admins = collectAdmins(events);
    const players = collectPlayers(events, new Set(admins.map((a) => a.steamId)));
    expect(admins.map((a) => a.steamId)).toEqual(['1']);
    expect(players.map((a) => a.nick).sort()).toEqual(['Looter', 'Trader']);
  });

  it('keeps seeded admins even without events', () => {
    const admins = collectAdmins([], [{ steamId: '9', nick: 'Seed' }]);
    expect(admins).toEqual([{ steamId: '9', nick: 'Seed' }]);
  });
});
