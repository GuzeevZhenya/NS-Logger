import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Filters } from './api';
import type {
  AdminRecord,
  Audience,
  DeleteEvent,
  EnrichedEvent,
  LogCategory,
  SpawnEvent,
  SpawnKind,
} from '../parser/types';
import { CATEGORY_LABELS, LOG_CATEGORIES } from '../parser/types';
import type { Stats } from '../parser/enrich';
import {
  dedupeDeletes,
  dedupeEvents,
  loadExtras,
  saveExtras,
  saveRange,
  type ExtraPack,
} from './extras';
import {
  collectAdmins,
  collectPlayers,
  parseLogFile,
  parsePlayerLogFile,
  steamIdFromPlayerFile,
} from '../parser/index';
import {
  exportSnapshot,
  latestEventDay,
  PAGE_SIZES,
  querySnapshot,
  type PageSize,
  type Snapshot,
} from './snapshot';
import { fetchSnapshotCached } from './snapshotCache';

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** По умолчанию — только текущий день. */
function defaultRange(): { from: string; to: string } {
  const day = isoDay(new Date());
  return { from: day, to: day };
}

const PAGE_KEY = 'vpp-audit:pageSize';

function loadPageSize(): PageSize {
  try {
    const n = Number(localStorage.getItem(PAGE_KEY));
    if (PAGE_SIZES.includes(n as PageSize)) return n as PageSize;
  } catch {
    /* ignore */
  }
  return 100;
}

function clock(iso: string): string {
  return iso.replace('T', ' ');
}

function LocationHint({ ev }: { ev: EnrichedEvent }) {
  if (ev.zoneName) {
    return (
      <small className="zone-ok">
        {ev.zoneName}
        {ev.coords ? ` · ${ev.coords}` : ''}
      </small>
    );
  }
  if (ev.nearestZone) {
    return (
      <small className="zone-miss">
        рядом {ev.nearestZone}
        {ev.nearestMeters != null ? ` (~${ev.nearestMeters} м)` : ''}
        {ev.coords ? ` · ${ev.coords}` : ''}
      </small>
    );
  }
  if (ev.coords) return <small className="zone-miss">{ev.coords}</small>;
  if (ev.category === 'loot') return <small className="zone-miss">координат в логе нет</small>;
  return null;
}

type SortKey = 'at' | 'nick' | 'kind' | 'item' | 'mark';
type SortDir = 'asc' | 'desc';

function sortEvents(events: EnrichedEvent[], key: SortKey, dir: SortDir): EnrichedEvent[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...events].sort((a, b) => {
    let cmp = 0;
    if (key === 'at') cmp = a.at.localeCompare(b.at);
    else if (key === 'nick') cmp = a.nick.localeCompare(b.nick, 'ru');
    else if (key === 'kind') cmp = a.action.localeCompare(b.action, 'ru');
    else if (key === 'item') cmp = a.label.localeCompare(b.label, 'ru');
    else cmp = Number(a.forbidden) - Number(b.forbidden) || Number(a.unknown) - Number(b.unknown);
    if (cmp === 0) cmp = a.at.localeCompare(b.at);
    return cmp * sign;
  });
}

const CATS_KEY = 'vpp-audit:categories-v3';
const AUDIENCE_KEY = 'vpp-audit:audience';

function loadAudience(): Audience {
  try {
    const raw = localStorage.getItem(AUDIENCE_KEY);
    if (raw === 'admins' || raw === 'players' || raw === 'both') return raw;
  } catch {
    /* ignore */
  }
  return 'admins';
}

function loadCategories(): LogCategory[] {
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return ['spawn', 'loot'];
    const parsed = JSON.parse(raw) as string[];
    const allowed = new Set(LOG_CATEGORIES);
    const list = parsed.filter((c): c is LogCategory => allowed.has(c as LogCategory));
    return list.length ? list : ['spawn', 'loot'];
  } catch {
    return ['spawn', 'loot'];
  }
}

function saveCategories(cats: LogCategory[]) {
  localStorage.setItem(CATS_KEY, JSON.stringify(cats));
}

export function App() {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [admin, setAdmin] = useState('all');
  const [kind, setKind] = useState<SpawnKind | ''>('');
  const [q, setQ] = useState('');
  const [forbiddenOnly, setForbiddenOnly] = useState(false);
  const [collapse, setCollapse] = useState(true);
  const [categories, setCategories] = useState<LogCategory[]>(loadCategories);
  const [audience, setAudience] = useState<Audience>(loadAudience);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [players, setPlayers] = useState<AdminRecord[]>([]);
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [catCounts, setCatCounts] = useState<Partial<Record<LogCategory, number>>>({});
  const [logDir, setLogDir] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [adminQ, setAdminQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(loadPageSize);
  const [pages, setPages] = useState(1);
  const [staticMode, setStaticMode] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState('');
  const [extraCount, setExtraCount] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const snapRef = useRef<Snapshot | null>(null);
  const extrasRef = useRef<ExtraPack>({ events: [], deletes: [] });
  const rangeInit = useRef(false);

  const filters: Filters = useMemo(
    () => ({
      from,
      to,
      admin,
      kind,
      q,
      forbiddenOnly,
      collapse,
      categories,
      audience,
      page,
      pageSize,
    }),
    [from, to, admin, kind, q, forbiddenOnly, collapse, categories, audience, page, pageSize],
  );

  function mergedSnap(base: Snapshot): Snapshot {
    const eventsMerged = dedupeEvents([...base.events, ...extrasRef.current.events]);
    const deletes = dedupeDeletes([...(base.deletes || []), ...extrasRef.current.deletes]);
    const nextAdmins = collectAdmins(eventsMerged, base.admins, []);
    const adminIds = new Set(nextAdmins.map((a) => a.steamId));
    return {
      ...base,
      events: eventsMerged,
      deletes,
      admins: nextAdmins,
      players: collectPlayers(eventsMerged, adminIds),
    };
  }

  function applySnapshot(next: Filters, snap: Snapshot) {
    const live = mergedSnap(snap);
    const result = querySnapshot(live, next);
    setEvents(result.events);
    setTotal(result.total);
    setPage(result.page);
    setPages(result.pages);
    setStats(result.stats);
    setCatCounts(result.categoryCounts);
    setAdmins(live.admins);
    setPlayers(live.players || []);
    setLogDir(live.logDir);
    setExtraCount(extrasRef.current.events.length);
    setError('');
    setReady(true);
  }

  async function loadAll(next = filters) {
    if (snapRef.current) {
      applySnapshot(next, snapRef.current);
      return;
    }
    setBusy('читаем журнал…');
    try {
      extrasRef.current = await loadExtras();
      const url = import.meta.env.PROD ? '/snapshot.json' : '/api/snapshot';
      const { data, fromCache: cached } = await fetchSnapshotCached(url);
      snapRef.current = data;
      setFromCache(cached);
      setStaticMode(import.meta.env.PROD);
      setSnapshotAt(data.generatedAt);
      const live = mergedSnap(data);
      if (!rangeInit.current) {
        const last = latestEventDay(live.events);
        rangeInit.current = true;
        if (last && (next.from !== last || next.to !== last)) {
          setFrom(last);
          setTo(last);
          applySnapshot({ ...next, from: last, to: last }, data);
          return;
        }
      }
      applySnapshot(next, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    saveRange(from, to);
  }, [from, to]);

  useEffect(() => {
    saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(PAGE_KEY, String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    localStorage.setItem(AUDIENCE_KEY, audience);
  }, [audience]);

  // смена фильтров — на первую страницу
  useEffect(() => {
    setPage(1);
  }, [from, to, admin, kind, q, forbiddenOnly, collapse, categories, audience, pageSize]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(filters), 80);
    return () => window.clearTimeout(t);
  }, [from, to, admin, kind, q, forbiddenOnly, collapse, categories, audience, page, pageSize]);

  function toggleCategory(cat: LogCategory) {
    setCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      return [...prev, cat];
    });
  }

  async function importLogs(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy('читаем выбранные логи…');
    const offset = snapRef.current?.utcOffsetHours ?? 3;
    const incoming: SpawnEvent[] = [];
    const incomingDeletes: DeleteEvent[] = [];
    const skipped: string[] = [];
    let read = 0;
    for (const file of Array.from(fileList)) {
      const name = file.name;
      const isAdmin = /^Log_.*\.txt$/i.test(name);
      const isPlayer = Boolean(steamIdFromPlayerFile(name));
      if (!isAdmin && !isPlayer) {
        skipped.push(name);
        continue;
      }
      const text = await file.text();
      read += 1;
      if (isAdmin) {
        const parsed = parseLogFile(name, text, offset);
        if (parsed.spawns.length === 0 && parsed.deletes.length === 0) skipped.push(name);
        else {
          incoming.push(...parsed.spawns);
          incomingDeletes.push(...parsed.deletes);
        }
      } else {
        const parsed = parsePlayerLogFile(name, text);
        if (parsed.length === 0) skipped.push(name);
        else incoming.push(...parsed);
      }
    }
    const before = extrasRef.current.events.length + extrasRef.current.deletes.length;
    extrasRef.current = {
      events: dedupeEvents([...extrasRef.current.events, ...incoming]),
      deletes: dedupeDeletes([...extrasRef.current.deletes, ...incomingDeletes]),
    };
    await saveExtras(extrasRef.current);
    const added =
      extrasRef.current.events.length + extrasRef.current.deletes.length - before;
    let next = filters;
    const dated = [...incoming, ...incomingDeletes];
    if (dated.length) {
      const maxDay = dated.reduce((m, ev) => {
        const day = ev.at.slice(0, 10);
        return day > m ? day : m;
      }, filters.to);
      if (maxDay > filters.to) {
        setTo(maxDay);
        next = { ...filters, to: maxDay };
      }
      // авто-включить категории, которые есть во входящих файлах
      const found = new Set(incoming.map((e) => e.category).filter(Boolean) as LogCategory[]);
      if (found.size) {
        setCategories((prev) => {
          const nextCats = [...prev];
          for (const c of found) if (!nextCats.includes(c)) nextCats.push(c);
          return nextCats;
        });
      }
    }
    if (snapRef.current) applySnapshot(next, snapRef.current);
    setBusy('');
    if (added === 0) {
      setError(
        read === 0
          ? 'В папке нет Log_*.txt и игровых *.log (SteamID). Можно выбрать папку с вложенными Day_*'
          : skipped.length
            ? 'Нет новых событий. Нужны Log_*.txt или 7656….log'
            : 'Эти события уже есть в журнале',
      );
    } else {
      setError('');
    }
  }

  async function clearExtras() {
    extrasRef.current = { events: [], deletes: [] };
    await saveExtras(extrasRef.current);
    if (snapRef.current) applySnapshot(filters, snapRef.current);
  }

  function downloadExport() {
    const snap = snapRef.current ? mergedSnap(snapRef.current) : null;
    if (!snap) {
      window.location.href = api.exportUrl(filters);
      return;
    }
    const text = exportSnapshot(snap, filters);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin-audit.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function applyFolder() {
    setBusy('перечитываем папку…');
    try {
      const res = await api.saveSettings({ logDir });
      if (!res.ok) setError(res.error || 'не удалось прочитать папку');
      snapRef.current = null;
      await loadAll();
    } finally {
      setBusy('');
    }
  }

  async function refreshCatalog() {
    setBusy('качаем таблицу предметов…');
    try {
      const res = await api.refreshCatalog();
      if (!res.ok) setError('каталог не обновился');
      snapRef.current = null;
      await loadAll();
    } finally {
      setBusy('');
    }
  }

  const roster = audience === 'players' ? players : audience === 'admins' ? admins : [...admins, ...players];
  const adminIds = useMemo(() => new Set(admins.map((a) => a.steamId)), [admins]);
  const selected = roster.find((a) => a.steamId === admin);
  const rows = useMemo(() => sortEvents(events, sortKey, sortDir), [events, sortKey, sortDir]);

  const visibleRoster = useMemo(() => {
    const q = adminQ.trim().toLowerCase();
    const counts = new Map((stats?.byAdmin || []).map((r) => [r.steamId, r.total]));
    const list = roster.filter((a) => {
      const n = counts.get(a.steamId) || 0;
      if (n === 0 && a.steamId !== admin) return false;
      if (!q) return true;
      return (
        a.nick.toLowerCase().includes(q) ||
        a.steamId.includes(q) ||
        (a.displayName || '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
  }, [roster, adminQ, stats, admin]);

  function pickAudience(next: Audience) {
    setAudience(next);
    setAdmin('all');
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'at' ? 'desc' : 'asc');
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div className="shell">
      <aside className="rail">
        <p className="eyebrow">VPP · Logging</p>
        <h1>
          {audience === 'players' ? 'Журнал игроков' : audience === 'both' ? 'Журнал' : 'Журнал админов'}
        </h1>
        <p className="lede">
          {audience === 'players'
            ? 'Торговля, инвентарь, двери, машины и лут из логов игроков.'
            : audience === 'both'
              ? 'Админы VPP и игроки ModernLogger в одной ленте.'
              : 'Спавн, телепорты, статы, godmode, удаление и фрикам из логов VPP.'}
        </p>
        {snapshotAt ? (
          <p className="lede">
            Снимок {snapshotAt.slice(0, 16).replace('T', ' ')}
            {fromCache ? ' · кэш ≤1ч' : ''}. Новые дни — через «выбрать логи».
          </p>
        ) : null}
        <div className="audience" role="tablist" aria-label="Кого показывать">
          {(
            [
              ['admins', 'Админы'],
              ['players', 'Игроки'],
              ['both', 'Все'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={audience === id}
              className={audience === id ? 'is-on' : ''}
              onClick={() => pickAudience(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="admin-search">
          {audience === 'players' ? 'поиск игрока' : audience === 'both' ? 'поиск' : 'поиск админа'}
          <input
            value={adminQ}
            onChange={(e) => setAdminQ(e.target.value)}
            placeholder="ник или SteamID"
          />
        </label>
        <nav className="admins">
          <button
            type="button"
            className={admin === 'all' ? 'callsign is-on' : 'callsign'}
            onClick={() => setAdmin('all')}
          >
            <span>
              {audience === 'players' ? 'Все игроки' : audience === 'both' ? 'Все' : 'Все админы'}
            </span>
            <b>{stats?.total ?? '—'}</b>
          </button>
          {visibleRoster.map((a) => {
            const row = stats?.byAdmin.find((x) => x.steamId === a.steamId);
            const isAdminNick = adminIds.has(a.steamId);
            return (
              <button
                type="button"
                key={a.steamId}
                className={admin === a.steamId ? 'callsign is-on' : 'callsign'}
                onClick={() => setAdmin(a.steamId)}
                title={a.steamId}
              >
                <span>
                  {a.nick}
                  {audience === 'both' ? (
                    <small className={isAdminNick ? 'role-admin' : 'role-player'}>
                      {isAdminNick ? 'админ' : 'игрок'}
                    </small>
                  ) : null}
                  {a.displayName && a.displayName !== a.nick ? (
                    <small>{a.displayName}</small>
                  ) : null}
                  <small className="steam">{a.steamId}</small>
                </span>
                <b>{row ? row.total : 0}</b>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="desk">
        <section className="intake">
          <p>
            Можно выбрать файлы или целую папку (с вложенными `Day_*` и `Log_*.txt`). Они допишутся к журналу
            в этом браузере.
          </p>
          <div className="intake-row">
            <label className="file-btn">
              выбрать логи
              <input
                type="file"
                multiple
                accept=".txt,.log,text/plain"
                onChange={(e) => {
                  void importLogs(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <label className="file-btn is-folder">
              выбрать папку
              <input
                type="file"
                multiple
                {...{ webkitdirectory: '', directory: '' }}
                onChange={(e) => {
                  void importLogs(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <span>
              из файлов: <b>{extraCount}</b>
            </span>
            {extraCount > 0 ? (
              <button type="button" className="ghost-btn" onClick={() => void clearExtras()}>
                убрать добавленные
              </button>
            ) : null}
          </div>
        </section>

        <section className="cat-bar" aria-label="Типы логов">
          <p className="cat-hint">
            Можно включить несколько типов сразу — одна общая лента по времени. «Артефакты /
            тайники» — кто взял и где (зона или ближайшая).
          </p>
          <div className="cat-toggles">
            {LOG_CATEGORIES.map((cat) => {
              const on = categories.includes(cat);
              const n = catCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  className={on ? 'cat-chip is-on' : 'cat-chip'}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={on}
                >
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <b>{n}</b>
                </button>
              );
            })}
          </div>
        </section>

        <header className="toolbar">
          <label>
            с
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            по
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="grow">
            поиск
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ник, SteamID, класснейм, координаты…"
            />
          </label>
          {categories.includes('spawn') ? (
            <label>
              спавн
              <select value={kind} onChange={(e) => setKind(e.target.value as SpawnKind | '')}>
                <option value="">любой</option>
                <option value="on-self">себе</option>
                <option value="on-player">игроку</option>
                <option value="preset">пресет</option>
              </select>
            </label>
          ) : null}
          <label className="check">
            <input
              type="checkbox"
              checked={forbiddenOnly}
              onChange={(e) => setForbiddenOnly(e.target.checked)}
            />
            только запрет
          </label>
          <label className="check">
            <input type="checkbox" checked={collapse} onChange={(e) => setCollapse(e.target.checked)} />
            пачки ×N
          </label>
          {staticMode ? (
            <button type="button" className="export" onClick={downloadExport}>
              экспорт
            </button>
          ) : (
            <a className="export" href={api.exportUrl(filters)}>
              экспорт
            </a>
          )}
        </header>

        <section className="meters" aria-label="Сводка">
          <article>
            <span>строк</span>
            <strong>{stats?.total ?? 0}</strong>
          </article>
          <article className="is-hot">
            <span>запрет</span>
            <strong>{stats?.forbidden ?? 0}</strong>
          </article>
          <article>
            <span>не в таблице</span>
            <strong>{stats?.unknown ?? 0}</strong>
          </article>
          <article className="who">
            <span>сейчас</span>
            <strong>
              {selected
                ? selected.nick
                : audience === 'players'
                  ? 'все игроки'
                  : audience === 'both'
                    ? 'все'
                    : 'все админы'}
            </strong>
          </article>
        </section>

        {stats && stats.topItems.length > 0 && categories.includes('spawn') ? (
          <ul className="tops">
            {stats.topItems.slice(0, 8).map((it) => (
              <li key={it.item} className={it.forbidden ? 'is-hot' : undefined}>
                <code>{it.item}</code>
                <em>×{it.count}</em>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="fail">{error}</p> : null}
        {busy ? <p className="pulse">{busy}</p> : null}

        <div className="ledger-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-sort" onClick={() => toggleSort('at')}>
                    время{sortMark('at')}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort" onClick={() => toggleSort('nick')}>
                    админ{sortMark('nick')}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort" onClick={() => toggleSort('kind')}>
                    действие{sortMark('kind')}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort" onClick={() => toggleSort('item')}>
                    детали{sortMark('item')}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort" onClick={() => toggleSort('mark')}>
                    метка{sortMark('mark')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {!ready ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Читаем журнал…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Включи хотя бы один тип логов кнопками выше.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    В этом диапазоне событий нет. Сдвинь даты или включи другие типы.
                  </td>
                </tr>
              ) : (
                rows.map((ev, i) => (
                  <tr
                    key={`${ev.at}-${ev.steamId}-${ev.category}-${ev.item}-${i}`}
                    className={ev.forbidden ? 'row-hot' : undefined}
                  >
                    <td className="mono">{clock(ev.at)}</td>
                    <td>{ev.nick}</td>
                    <td>
                      <span className="cat-tag">{CATEGORY_LABELS[ev.category]}</span>
                      {ev.action}
                      {ev.target ? <small> → {ev.target}</small> : null}
                    </td>
                    <td>
                      {ev.category === 'teleport' ? (
                        <>
                          <LocationHint ev={ev} />
                          {ev.count > 1 ? <em className="pack">×{ev.count}</em> : null}
                        </>
                      ) : (
                        <>
                          <code>{ev.label}</code>
                          <LocationHint ev={ev} />
                          {ev.count > 1 ? <em className="pack">×{ev.count}</em> : null}
                        </>
                      )}
                    </td>
                    <td className="marks">
                      {ev.forbidden ? <span className="stamp">запрет</span> : null}
                      {ev.unknown ? <span className="ghost">нет в таблице</span> : null}
                      {ev.deleted ? (
                        <span className="gone">
                          {ev.deleted.samePerson
                            ? 'предмет был удалён'
                            : `удалён кем-то: ${ev.deleted.byNick}`}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pager" aria-label="Страницы">
          <label>
            на странице
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span>
            стр. <b>{page}</b> / {pages} · всего {total}
          </span>
          <button type="button" className="ghost-btn" disabled={page <= 1} onClick={() => setPage(1)}>
            «
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            ›
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={page >= pages}
            onClick={() => setPage(pages)}
          >
            »
          </button>
        </div>

        {staticMode ? null : (
          <footer className="path">
            <label className="grow">
              папка Logging
              <input value={logDir} onChange={(e) => setLogDir(e.target.value)} />
            </label>
            <button type="button" onClick={() => void applyFolder()}>
              прочитать
            </button>
            <button type="button" className="ghost-btn" onClick={() => void refreshCatalog()}>
              обновить каталог
            </button>
          </footer>
        )}
      </main>
    </div>
  );
}
