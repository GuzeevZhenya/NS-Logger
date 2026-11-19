import type {
  AdminRecord,
  EnrichedEvent,
  ItemCatalog,
  LogCategory,
  SpawnEvent,
} from './types.js';
import { CATEGORY_LABELS, eventCategory, isAdminCategory, isPlayerCategory } from './types.js';
import { isSpawnForbidden } from './forbidden.js';
import { localMs } from './parseSpawnLogs.js';
import { describeTeleportPos } from './zones.js';

export function formatItemLabel(classname: string, catalog: ItemCatalog): string {
  const name = catalog[classname]?.name;
  if (name) return `${classname} (${name})`;
  return classname;
}

function defaultAction(ev: SpawnEvent): string {
  if (ev.action) return ev.action;
  if (ev.kind === 'on-player') return 'игроку';
  if (ev.kind === 'preset') return 'пресет';
  if (ev.kind === 'on-self') return 'себе';
  return CATEGORY_LABELS[eventCategory(ev)];
}

export function enrichEvents(
  events: SpawnEvent[],
  catalog: ItemCatalog,
  extraForbidden: string[],
): EnrichedEvent[] {
  return events.map((ev) => {
    const category = eventCategory(ev);
    const itemCats: LogCategory[] = ['spawn', 'trade', 'inventory', 'doors', 'vehicle', 'world', 'loot'];
    const isItemRow =
      (category === 'spawn' && ev.kind !== 'preset') ||
      (itemCats.includes(category) && category !== 'spawn' && Boolean(ev.item) && !/^(login|disconnect)$/i.test(ev.item));
    const info = isItemRow ? catalog[ev.item] : undefined;
    const name = info?.name || '';
    const forbidden = Boolean(
      category === 'spawn' && ev.kind !== 'preset' && isSpawnForbidden(ev.item, catalog, extraForbidden),
    );
    const unknown = Boolean(category === 'spawn' && ev.kind !== 'preset' && !info);
    let label = isItemRow ? formatItemLabel(ev.item, catalog) : ev.item;
    if (ev.target && (category === 'trade' || category === 'inventory' || category === 'world' || category === 'loot')) {
      label = `${label} · ${ev.target}`;
    }
    let coords: string | undefined = ev.coords;
    let zoneName: string | null | undefined;
    let nearestZone: string | null | undefined;
    let nearestMeters: number | null | undefined;
    let zoneLabel: string | undefined;
    const place = describeTeleportPos(
      category === 'teleport' ? `${ev.item} ${coords || ''}` : coords || ev.item || '',
    );
    if (place) {
      coords = place.coords;
      zoneName = place.zoneName;
      nearestZone = place.nearest;
      nearestMeters = place.nearestMeters;
      zoneLabel = place.zoneLabel;
      if (category === 'teleport') label = `${place.coords} · ${place.zoneLabel}`;
    }
    return {
      ...ev,
      category,
      action: defaultAction(ev),
      name,
      label,
      forbidden,
      unknown,
      count: 1,
      coords,
      zoneName,
      nearestZone,
      nearestMeters,
      zoneLabel,
    };
  });
}

function deletedKey(ev: EnrichedEvent): string {
  if (!ev.deleted) return '';
  return ev.deleted.samePerson ? 'self' : ev.deleted.bySteamId;
}

export function collapseBursts(events: EnrichedEvent[], windowMs = 1000): EnrichedEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const out: EnrichedEvent[] = [];
  for (const ev of sorted) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.steamId === ev.steamId &&
      prev.category === ev.category &&
      prev.kind === ev.kind &&
      prev.action === ev.action &&
      prev.item === ev.item &&
      prev.target === ev.target &&
      (prev.coords || '') === (ev.coords || '') &&
      deletedKey(prev) === deletedKey(ev) &&
      Math.abs(localMs(ev.at) - localMs(prev.at)) <= windowMs
    ) {
      prev.count += 1;
      continue;
    }
    out.push({ ...ev });
  }
  return out;
}

export function searchEvents(events: EnrichedEvent[], query: string): EnrichedEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return events;
  return events.filter((ev) => {
    const hay =
      `${ev.item} ${ev.name} ${ev.label} ${ev.nick} ${ev.target || ''} ${ev.action} ${ev.category} ${ev.coords || ''} ${ev.zoneLabel || ''} ${ev.zoneName || ''} ${ev.nearestZone || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function upsertNick(map: Map<string, AdminRecord>, steamId: string, nick: string) {
  const prev = map.get(steamId);
  if (!prev) map.set(steamId, { steamId, nick });
  else if (nick && nick !== prev.nick) prev.nick = nick;
}

function sortRoster(list: AdminRecord[]): AdminRecord[] {
  return [...list].sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
}

/** Админы — только те, у кого были спавн / телепорт / статы / god / freecam / удаление. */
export function collectAdmins(
  events: SpawnEvent[],
  seeded: AdminRecord[] = [],
  groups: Array<{ steamId: string; displayName: string }> = [],
): AdminRecord[] {
  const byId = new Map<string, AdminRecord>();
  for (const a of seeded) byId.set(a.steamId, { ...a });
  for (const ev of events) {
    if (!isAdminCategory(eventCategory(ev))) continue;
    upsertNick(byId, ev.steamId, ev.nick);
  }
  const groupMap = new Map(groups.map((g) => [g.steamId, g.displayName]));
  return sortRoster(
    [...byId.values()].map((a) => ({
      ...a,
      displayName: groupMap.get(a.steamId) || a.displayName,
    })),
  );
}

export function collectPlayers(
  events: SpawnEvent[],
  adminIds?: Set<string>,
): AdminRecord[] {
  const byId = new Map<string, AdminRecord>();
  for (const ev of events) {
    if (!isPlayerCategory(eventCategory(ev))) continue;
    upsertNick(byId, ev.steamId, ev.nick);
  }
  if (adminIds) {
    for (const id of adminIds) byId.delete(id);
  }
  return sortRoster([...byId.values()]);
}

export function mergeAdmins(
  fromEvents: SpawnEvent[],
  seeded: AdminRecord[],
  groups: Array<{ steamId: string; displayName: string }>,
): AdminRecord[] {
  return collectAdmins(fromEvents, seeded, groups);
}

export type Stats = {
  total: number;
  forbidden: number;
  unknown: number;
  rosterTotal: number;
  byAdmin: Array<{ steamId: string; nick: string; total: number; forbidden: number }>;
  byCategory: Array<{ category: LogCategory; label: string; total: number }>;
  topItems: Array<{ item: string; name: string; count: number; forbidden: boolean }>;
};

export function buildStats(events: EnrichedEvent[]): Stats {
  const byAdmin = new Map<string, { steamId: string; nick: string; total: number; forbidden: number }>();
  const byItem = new Map<string, { item: string; name: string; count: number; forbidden: boolean }>();
  const byCategory = new Map<LogCategory, number>();
  let forbidden = 0;
  let unknown = 0;
  let total = 0;
  for (const ev of events) {
    const n = ev.count || 1;
    total += n;
    if (ev.forbidden) forbidden += n;
    if (ev.unknown) unknown += n;
    byCategory.set(ev.category, (byCategory.get(ev.category) || 0) + n);
    const admin = byAdmin.get(ev.steamId) || {
      steamId: ev.steamId,
      nick: ev.nick,
      total: 0,
      forbidden: 0,
    };
    admin.nick = ev.nick;
    admin.total += n;
    if (ev.forbidden) admin.forbidden += n;
    byAdmin.set(ev.steamId, admin);
    if (ev.category === 'spawn' && ev.kind !== 'preset') {
      const item = byItem.get(ev.item) || {
        item: ev.item,
        name: ev.name,
        count: 0,
        forbidden: ev.forbidden,
      };
      item.count += n;
      item.forbidden = item.forbidden || ev.forbidden;
      byItem.set(ev.item, item);
    }
  }
  return {
    total,
    forbidden,
    unknown,
    rosterTotal: total,
    byAdmin: [...byAdmin.values()].sort((a, b) => b.total - a.total),
    byCategory: [...byCategory.entries()]
      .map(([category, totalCount]) => ({
        category,
        label: CATEGORY_LABELS[category],
        total: totalCount,
      }))
      .sort((a, b) => b.total - a.total),
    topItems: [...byItem.values()].sort((a, b) => b.count - a.count).slice(0, 12),
  };
}
