import type { DeleteEvent, DeleteNote, EnrichedEvent, LogCategory, SpawnEvent, SpawnKind } from './types.js';
import { eventCategory } from './types.js';

const FILE_NAME_RE =
  /^Log_(\d{4})-(\d{1,2})-(\d{1,2})_(\d{1,2})-(\d{1,2})-(\d{1,2})\.txt$/;
const LINE_HEAD =
  /^(\d{1,2}):(\d{1,2}):(\d{1,2}) \| "([^"]+)" \(steamid=(\d+)\) (.+)$/;

const ITEM_ON =
  /^Spawned Item: \(([^)]+)\) on "([^"]+)"/;
const ITEM_SELF = /^Spawned Item: \(([^)]+)\)\s*$/;
const PRESET = /^spawned preset: \((.+)\)\s*$/;
const DELETE_OBJ = /^deleted object "([^"]+)"/;
const DELETE_ESP = /^deleted objects using ESP/;
const TELEPORT_SELF = /^teleported (?:to crosshair |to )?\(pos=<([^>]+)>\)/;
const TELEPORT_TO = /^teleported to (.+?)(?:\s*\(pos=<([^>]+)>\)|$)/;
const TELEPORT_PLAYER =
  /^Teleporting player: "([^"]+)" \(steamid=(\d+)\) to \(pos=<([^>]+)>\)/;
const GODMODE = /^toggled godmode/;
const FREECAM = /^toggled freecam/;
const HEAL = /^healed player(?: "([^"]+)")?/;
const STATS = /^just updated a health stat on \(steamid=(\d+)\)/;
const AMMO = /^gave unlimited ammo to \(steamid=(\d+)\)/;
const GAVE_GOD = /^gave godmode to \(steamid=(\d+)\)/;
const BUILD_CREATE = /^created new building set \((.+)\)/;
const BUILD_UPDATE = /^updated building set \((.+)\)/;
const BUILD_DELETE = /^deleted building set \((.+)\)/;
const MESSAGE = /^sent message \(([\s\S]*)\)\s*$/;
const CONTEXT = /^\[ContextMenu\] (.+)$/;
const PRESET_CREATE = /^Created a new item preset: \((.+)\)/;
const PRESET_EDIT = /^edited preset: \((.+)\)/;
const PRESET_DELETE = /^deleted the preset: \((.+)\)/;
const KILL = /^executed kill command on: "([^"]+)"/;
const SPECTATE = /^started to spectate player: "([^"]+)"/;
const FREEZE = /^Froze player controls \(steamid=(\d+)\)/;
const KICK = /^kicked player: "([^"]+)"/;
const MODIFIER = /^deactivated modifier "([^"]+)" on player \(steamid=(\d+)\)/;
const ESP_MOVE = /^moved an object using ESP/;

export const DELETE_WINDOW_MS = 3 * 3600 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoLocal(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

export function localMs(iso: string): number {
  const [day, time] = iso.split('T');
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
}

export function parseFileStamp(fileName: string): Date | null {
  const m = FILE_NAME_RE.exec(fileName);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
}

function eventAt(fileStart: Date, h: number, mi: number, s: number): Date {
  const at = new Date(
    fileStart.getFullYear(),
    fileStart.getMonth(),
    fileStart.getDate(),
    h,
    mi,
    s,
  );
  const startTod = fileStart.getHours() * 3600 + fileStart.getMinutes() * 60 + fileStart.getSeconds();
  const eventTod = h * 3600 + mi * 60 + s;
  if (eventTod < startTod) at.setDate(at.getDate() + 1);
  return at;
}

type Hit = {
  category: LogCategory;
  kind: SpawnKind;
  action: string;
  h: number;
  mi: number;
  s: number;
  nick: string;
  steamId: string;
  item: string;
  target?: string;
  asDelete?: boolean;
};

function matchRest(
  rest: string,
  h: number,
  mi: number,
  s: number,
  nick: string,
  steamId: string,
): Hit | null {
  const base = { h, mi, s, nick, steamId };
  let m = ITEM_ON.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'spawn',
      kind: 'on-player',
      action: 'игроку',
      item: m[1],
      target: m[2],
    };
  }
  m = ITEM_SELF.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'spawn',
      kind: 'on-self',
      action: 'себе',
      item: m[1],
    };
  }
  m = PRESET.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'spawn',
      kind: 'preset',
      action: 'пресет',
      item: m[1],
    };
  }
  m = DELETE_OBJ.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'delete',
      kind: 'other',
      action: 'удалил объект',
      item: m[1],
      asDelete: true,
    };
  }
  if (DELETE_ESP.test(rest)) {
    return {
      ...base,
      category: 'delete',
      kind: 'other',
      action: 'удалил через ESP',
      item: 'ESP delete',
    };
  }
  if (ESP_MOVE.test(rest)) {
    return {
      ...base,
      category: 'delete',
      kind: 'other',
      action: 'сдвинул ESP',
      item: 'ESP move',
    };
  }
  m = TELEPORT_PLAYER.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'teleport',
      kind: 'other',
      action: 'телепорт игрока',
      item: m[3],
      target: m[1],
    };
  }
  m = TELEPORT_SELF.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'teleport',
      kind: 'other',
      action: 'телепорт',
      item: m[1],
    };
  }
  m = TELEPORT_TO.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'teleport',
      kind: 'other',
      action: 'телепорт',
      item: m[2] || m[1],
      target: m[2] ? m[1] : undefined,
    };
  }
  if (GODMODE.test(rest)) {
    return { ...base, category: 'cheats', kind: 'other', action: 'godmode', item: 'toggled godmode' };
  }
  if (FREECAM.test(rest)) {
    return { ...base, category: 'cheats', kind: 'other', action: 'freecam', item: 'toggled freecam' };
  }
  m = AMMO.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'cheats',
      kind: 'other',
      action: 'безлимит патронов',
      item: m[1],
      target: m[1],
    };
  }
  m = GAVE_GOD.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'cheats',
      kind: 'other',
      action: 'дал godmode',
      item: m[1],
      target: m[1],
    };
  }
  m = HEAL.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'stats',
      kind: 'other',
      action: 'хил',
      item: m[1] || steamId,
      target: m[1] || undefined,
    };
  }
  m = STATS.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'stats',
      kind: 'other',
      action: 'статы',
      item: m[1],
      target: m[1],
    };
  }
  m = MODIFIER.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'stats',
      kind: 'other',
      action: `модификатор −${m[1]}`,
      item: m[2],
      target: m[2],
    };
  }
  m = BUILD_CREATE.exec(rest);
  if (m) {
    return { ...base, category: 'build', kind: 'other', action: 'создал постройку', item: m[1] };
  }
  m = BUILD_UPDATE.exec(rest);
  if (m) {
    return { ...base, category: 'build', kind: 'other', action: 'обновил постройку', item: m[1] };
  }
  m = BUILD_DELETE.exec(rest);
  if (m) {
    return { ...base, category: 'build', kind: 'other', action: 'удалил постройку', item: m[1] };
  }
  m = PRESET_CREATE.exec(rest);
  if (m) {
    return { ...base, category: 'presets', kind: 'other', action: 'создал пресет', item: m[1] };
  }
  m = PRESET_EDIT.exec(rest);
  if (m) {
    return { ...base, category: 'presets', kind: 'other', action: 'правил пресет', item: m[1] };
  }
  m = PRESET_DELETE.exec(rest);
  if (m) {
    return { ...base, category: 'presets', kind: 'other', action: 'удалил пресет', item: m[1] };
  }
  m = MESSAGE.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'moderation',
      kind: 'other',
      action: 'сообщение',
      item: m[1].replace(/\s+/g, ' ').trim().slice(0, 200),
    };
  }
  m = CONTEXT.exec(rest);
  if (m) {
    return { ...base, category: 'delete', kind: 'other', action: 'контекст-меню', item: m[1] };
  }
  m = KILL.exec(rest);
  if (m) {
    return { ...base, category: 'moderation', kind: 'other', action: 'kill', item: m[1], target: m[1] };
  }
  m = SPECTATE.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'moderation',
      kind: 'other',
      action: 'спектэйт',
      item: m[1],
      target: m[1],
    };
  }
  m = FREEZE.exec(rest);
  if (m) {
    return {
      ...base,
      category: 'moderation',
      kind: 'other',
      action: 'freeze',
      item: m[1],
      target: m[1],
    };
  }
  m = KICK.exec(rest);
  if (m) {
    return { ...base, category: 'moderation', kind: 'other', action: 'kick', item: m[1], target: m[1] };
  }
  return null;
}

export function parseLogFile(
  fileName: string,
  text: string,
  utcOffsetHours: number,
): { spawns: SpawnEvent[]; deletes: DeleteEvent[] } {
  const fileStart = parseFileStamp(fileName);
  if (!fileStart) return { spawns: [], deletes: [] };
  const spawns: SpawnEvent[] = [];
  const deletes: DeleteEvent[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const head = LINE_HEAD.exec(line);
    if (!head) continue;
    const hit = matchRest(head[6], Number(head[1]), Number(head[2]), Number(head[3]), head[4], head[5]);
    if (!hit) continue;
    const local = addHours(eventAt(fileStart, hit.h, hit.mi, hit.s), utcOffsetHours);
    const at = toIsoLocal(local);
    if (hit.asDelete) {
      deletes.push({ at, nick: hit.nick, steamId: hit.steamId, item: hit.item });
    }
    spawns.push({
      at,
      nick: hit.nick,
      steamId: hit.steamId,
      kind: hit.kind,
      category: hit.category,
      action: hit.action,
      item: hit.item,
      target: hit.target,
    });
  }
  return { spawns, deletes };
}

export function parseLogText(
  fileName: string,
  text: string,
  utcOffsetHours: number,
): SpawnEvent[] {
  return parseLogFile(fileName, text, utcOffsetHours).spawns;
}

export function attachDeletes(
  events: EnrichedEvent[],
  deletes: DeleteEvent[],
  windowMs = DELETE_WINDOW_MS,
): EnrichedEvent[] {
  const out = events.map((ev) => ({ ...ev, deleted: undefined as DeleteNote | undefined }));
  const leftover = [...deletes].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const del of leftover) {
    const delMs = localMs(del.at);
    let best = -1;
    let bestMs = -1;
    for (let i = 0; i < out.length; i++) {
      const ev = out[i];
      if (ev.deleted || eventCategory(ev) !== 'spawn' || ev.kind === 'preset' || ev.item !== del.item) {
        continue;
      }
      const spawnMs = localMs(ev.at);
      const dt = delMs - spawnMs;
      if (dt <= 0 || dt > windowMs) continue;
      if (spawnMs >= bestMs) {
        best = i;
        bestMs = spawnMs;
      }
    }
    if (best < 0) continue;
    const ev = out[best];
    ev.deleted = {
      at: del.at,
      byNick: del.nick,
      bySteamId: del.steamId,
      samePerson: del.steamId === ev.steamId,
    };
  }
  return out;
}

export function filterEvents(
  events: SpawnEvent[],
  opts: {
    from?: string;
    to?: string;
    admin?: string;
    kind?: SpawnKind | '';
    categories?: LogCategory[] | Set<LogCategory> | '';
  },
): SpawnEvent[] {
  const from = opts.from ? opts.from.slice(0, 10) : '';
  const to = opts.to ? opts.to.slice(0, 10) : '';
  const admin = (opts.admin || '').trim();
  const kind = opts.kind || '';
  // undefined → все категории; [] → ничего; Set/array → только выбранные
  let cats: Set<LogCategory> | null | 'all' = 'all';
  if (opts.categories instanceof Set) cats = opts.categories;
  else if (Array.isArray(opts.categories)) cats = new Set(opts.categories);
  return events.filter((ev) => {
    const day = ev.at.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (kind && kind !== 'other' && eventCategory(ev) === 'spawn' && ev.kind !== kind) return false;
    if (cats !== 'all') {
      if (cats.size === 0) return false;
      if (!cats.has(eventCategory(ev))) return false;
    }
    if (admin && admin !== 'all') {
      if (ev.steamId !== admin && ev.nick !== admin) return false;
    }
    return true;
  });
}
