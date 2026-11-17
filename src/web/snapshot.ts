import {
  buildStats,
  collapseBursts,
  enrichEvents,
  filterEvents,
  searchEvents,
  toDiscordLines,
  attachDeletes,
  type AdminRecord,
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
  admins: AdminRecord[];
  catalog: ItemCatalog;
  extraForbidden: string[];
  events: SpawnEvent[];
  deletes?: DeleteEvent[];
};

const CAP = 2500;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function today(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function slice(snap: Snapshot, query: Filters, admin: string) {
  const from = query.from || daysAgo(7);
  const to = query.to || today();
  let list = attachDeletes(
    enrichEvents(
      filterEvents(snap.events, {
        from,
        to,
        admin,
        kind: query.kind as SpawnKind | '',
        categories: query.categories,
      }),
      snap.catalog,
      snap.extraForbidden,
    ),
    snap.deletes || [],
  );
  list = searchEvents(list, query.q || '');
  if (query.forbiddenOnly) list = list.filter((e) => e.forbidden);
  return list;
}

/** Счётчики категорий в диапазоне/админе, без фильтра категорий */
export function categoryCounts(snap: Snapshot, query: Filters): Record<LogCategory, number> {
  const from = query.from || daysAgo(7);
  const to = query.to || today();
  const list = enrichEvents(
    filterEvents(snap.events, {
      from,
      to,
      admin: query.admin,
      kind: '',
      categories: undefined,
    }),
    snap.catalog,
    snap.extraForbidden,
  );
  const out = {} as Record<LogCategory, number>;
  for (const ev of list) {
    out[ev.category] = (out[ev.category] || 0) + (ev.count || 1);
  }
  return out;
}

export function querySnapshot(snap: Snapshot, query: Filters) {
  let list = slice(snap, query, query.admin);
  const scoped = buildStats(list);
  const rosterAll = buildStats(
    attachDeletes(
      enrichEvents(
        filterEvents(snap.events, {
          from: query.from || daysAgo(7),
          to: query.to || today(),
          admin: 'all',
        }),
        snap.catalog,
        snap.extraForbidden,
      ),
      snap.deletes || [],
    ),
  );
  const stats: Stats = {
    ...scoped,
    byAdmin: rosterAll.byAdmin,
    rosterTotal: rosterAll.total,
  };
  if (query.collapse) list = collapseBursts(list);
  return {
    events: list.slice(0, CAP),
    total: list.length,
    truncated: list.length > CAP,
    stats,
    categoryCounts: categoryCounts(snap, query),
    exportText: [
      `# VPP admin audit (+${snap.utcOffsetHours}ч)`,
      `# ${query.from} .. ${query.to}`,
      `# Категории: ${(query.categories || []).join(',') || '—'}`,
      `# Строк: ${list.length}`,
      '',
      toDiscordLines(list),
      '',
    ].join('\n'),
  };
}
