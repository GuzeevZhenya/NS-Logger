import {
  attachDeletes,
  CATEGORY_LABELS,
  collectAdmins,
  enrichEvents,
  eventCategory,
  filterEvents,
  isSpawnForbidden,
  toDiscordLines,
  type AdminRecord,
  type Audience,
  type DeleteEvent,
  type ItemCatalog,
  type LogCategory,
  type SpawnEvent,
  type SpawnKind,
  type Stats,
} from '../parser/index';
import type { Filters } from './api';

export type Snapshot = {
  generatedAt: string;
  utcOffsetHours: number;
  logDir: string;
  playerLogDir?: string;
  admins: AdminRecord[];
  /** Игроки ModernLogger без VPP-прав */
  players?: AdminRecord[];
  catalog: ItemCatalog;
  extraForbidden: string[];
  events: SpawnEvent[];
  deletes?: DeleteEvent[];
};

export const PAGE_SIZES = [100, 200, 300] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Последний день, по которому есть события в снимке. */
export function latestEventDay(events: { at: string }[]): string | null {
  let max = '';
  for (const ev of events) {
    const day = ev.at.slice(0, 10);
    if (day > max) max = day;
  }
  return max || null;
}

function today(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function localMs(iso: string): number {
  const [day, time] = iso.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm, ss] = (time || '0:0:0').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss || 0).getTime();
}

type Counted = SpawnEvent & { count: number };

/** Схлопывание до enrich — дешевле на больших выборках. */
function collapseRaw(events: SpawnEvent[], windowMs = 1000): Counted[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const out: Counted[] = [];
  for (const ev of sorted) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.steamId === ev.steamId &&
      eventCategory(prev) === eventCategory(ev) &&
      prev.kind === ev.kind &&
      (prev.action || '') === (ev.action || '') &&
      prev.item === ev.item &&
      (prev.target || '') === (ev.target || '') &&
      (prev.coords || '') === (ev.coords || '') &&
      Math.abs(localMs(ev.at) - localMs(prev.at)) <= windowMs
    ) {
      prev.count += 1;
    } else {
      out.push({ ...ev, count: 1 });
    }
  }
  return out;
}

function matchesQuery(ev: SpawnEvent, q: string): boolean {
  if (!q) return true;
  const hay =
    `${ev.item} ${ev.nick} ${ev.steamId} ${ev.target || ''} ${ev.action || ''} ${ev.category || ''} ${ev.coords || ''}`.toLowerCase();
  return hay.includes(q);
}

function isForbidden(ev: SpawnEvent, catalog: ItemCatalog, extra: Set<string> | string[]): boolean {
  if (eventCategory(ev) !== 'spawn' || ev.kind === 'preset') return false;
  return isSpawnForbidden(ev.item, catalog, [...extra]);
}

function isUnknown(ev: SpawnEvent, catalog: ItemCatalog): boolean {
  if (eventCategory(ev) !== 'spawn' || ev.kind === 'preset') return false;
  return !catalog[ev.item];
}

function adminIdSet(snap: Snapshot): Set<string> {
  const list = snap.admins?.length ? snap.admins : collectAdmins(snap.events);
  return new Set(list.map((a) => a.steamId));
}

function applyAudience(list: SpawnEvent[], snap: Snapshot, audience?: Audience): SpawnEvent[] {
  const mode: Audience = audience || 'both';
  if (mode === 'both') return list;
  const ids = adminIdSet(snap);
  if (mode === 'admins') return list.filter((ev) => ids.has(ev.steamId));
  return list.filter((ev) => !ids.has(ev.steamId));
}

/** Фильтр без enrich. */
function filterRaw(snap: Snapshot, query: Filters, admin: string): SpawnEvent[] {
  const from = query.from || today();
  const to = query.to || today();
  const q = (query.q || '').trim().toLowerCase();
  let list = filterEvents(snap.events, {
    from,
    to,
    admin,
    kind: query.kind as SpawnKind | '',
    // поиск по класснейму — по всем типам, иначе арты в loot не находятся
    categories: q ? undefined : query.categories,
  });
  list = applyAudience(list, snap, query.audience);
  if (q) list = list.filter((ev) => matchesQuery(ev, q));
  if (query.forbiddenOnly) {
    const extra = new Set(snap.extraForbidden);
    list = list.filter((ev) => isForbidden(ev, snap.catalog, extra));
  }
  return list;
}

function sortByAt(list: SpawnEvent[], dir: 'asc' | 'desc'): SpawnEvent[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => a.at.localeCompare(b.at) * sign);
}

function lightStats(list: Counted[], catalog: ItemCatalog, extra: Set<string>): Stats {
  const byAdmin = new Map<string, { steamId: string; nick: string; total: number; forbidden: number }>();
  const byItem = new Map<string, { item: string; name: string; count: number; forbidden: boolean }>();
  const byCategory = new Map<LogCategory, number>();
  let forbidden = 0;
  let unknown = 0;
  let total = 0;
  for (const ev of list) {
    const n = ev.count || 1;
    total += n;
    const cat = eventCategory(ev);
    byCategory.set(cat, (byCategory.get(cat) || 0) + n);
    const adm = byAdmin.get(ev.steamId) || {
      steamId: ev.steamId,
      nick: ev.nick,
      total: 0,
      forbidden: 0,
    };
    adm.nick = ev.nick || adm.nick;
    adm.total += n;
    if (isForbidden(ev, catalog, extra)) {
      forbidden += n;
      adm.forbidden += n;
    }
    if (isUnknown(ev, catalog)) unknown += n;
    byAdmin.set(ev.steamId, adm);
    if (cat === 'spawn' && ev.kind !== 'preset') {
      const prev = byItem.get(ev.item) || {
        item: ev.item,
        name: catalog[ev.item]?.name || '',
        count: 0,
        forbidden: isForbidden(ev, catalog, extra),
      };
      prev.count += n;
      byItem.set(ev.item, prev);
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
    topItems: [...byItem.values()].sort((a, b) => b.count - a.count).slice(0, 20),
  };
}

function categoryCountsRaw(snap: Snapshot, query: Filters): Record<LogCategory, number> {
  const from = query.from || today();
  const to = query.to || today();
  let list = filterEvents(snap.events, {
    from,
    to,
    admin: query.admin,
    kind: '',
    categories: undefined,
  });
  list = applyAudience(list, snap, query.audience);
  const out = {} as Record<LogCategory, number>;
  for (const ev of list) {
    const cat = eventCategory(ev);
    out[cat] = (out[cat] || 0) + 1;
  }
  return out;
}

export function querySnapshot(snap: Snapshot, query: Filters) {
  const pageSize = PAGE_SIZES.includes(query.pageSize as PageSize)
    ? (query.pageSize as PageSize)
    : 100;
  const page = Math.max(1, query.page || 1);

  let raw = filterRaw(snap, query, query.admin);
  // одна лента по всем выбранным категориям, новые сверху
  raw = sortByAt(raw, 'desc');

  const counted: Counted[] = query.collapse
    ? collapseRaw(raw)
    : raw.map((ev) => ({ ...ev, count: 1 }));
  counted.sort((a, b) => b.at.localeCompare(a.at));

  const extra = new Set(snap.extraForbidden);
  const scoped = lightStats(counted, snap.catalog, extra);

  const rosterRaw = filterEvents(snap.events, {
    from: query.from || today(),
    to: query.to || today(),
    admin: 'all',
  });
  const rosterCounted: Counted[] = rosterRaw.map((ev) => ({ ...ev, count: 1 }));
  const roster = lightStats(rosterCounted, snap.catalog, extra);

  const stats: Stats = {
    ...scoped,
    byAdmin: scoped.byAdmin,
    rosterTotal: roster.total,
  };

  const total = counted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  const pageRaw = counted.slice(start, start + pageSize);

  const enriched = attachDeletes(
    enrichEvents(pageRaw, snap.catalog, snap.extraForbidden),
    snap.deletes || [],
  ).map((ev, i) => ({
    ...ev,
    count: pageRaw[i]?.count || ev.count || 1,
  }));

  return {
    events: enriched,
    total,
    page: safePage,
    pageSize,
    pages,
    truncated: false,
    stats,
    categoryCounts: categoryCountsRaw(snap, query),
  };
}

/** Полный текст экспорта — только по кнопке, не на каждый фильтр. */
export function exportSnapshot(snap: Snapshot, query: Filters): string {
  let raw = filterRaw(snap, query, query.admin);
  raw = sortByAt(raw, 'desc');
  const counted = query.collapse ? collapseRaw(raw) : raw.map((ev) => ({ ...ev, count: 1 }));
  counted.sort((a, b) => b.at.localeCompare(a.at));
  const enriched = attachDeletes(
    enrichEvents(counted, snap.catalog, snap.extraForbidden),
    snap.deletes || [],
  ).map((ev, i) => ({ ...ev, count: counted[i]?.count || 1 }));
  return [
    `# VPP admin audit (+${snap.utcOffsetHours}ч)`,
    `# ${query.from} .. ${query.to}`,
    `# Категории: ${(query.categories || []).join(',') || '—'}`,
    `# Строк: ${enriched.length}`,
    '',
    toDiscordLines(enriched),
    '',
  ].join('\n');
}

/** @deprecated для старых вызовов */
export function categoryCounts(snap: Snapshot, query: Filters): Record<LogCategory, number> {
  return categoryCountsRaw(snap, query);
}
