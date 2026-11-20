import type { LogCategory, SpawnEvent } from './types.js';

const STEAM_FILE_RE = /^(\d{17})\.log$/i;
const DAY_DIR_RE = /^Day_\d{2}-\d{2}-\d{4}$/i;
const NUM_DIR_RE = /^\d{1,2}$/;

const HEAD_RE =
  /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{1,2}):(\d{1,2}): Player: '([^']*)';\s+Действие: /;

const TRADE_RE =
  /\[TRADER PLUS\] (BUY|SELL) item: '([^']+)',Category: '([^']*)',Quantity: '([^']*)',Price: '([^']*)'/;

const BANK_RE = /\[TRADER PLUS BANK\] (Withdraw|Deposit): '([^']+)'(?:\s*\(([^)]*)\))?/;

const MOVE_RE =
  /Действие: '(Перемещение предмета[^']*)';\s*Предмет: '([^']+)'(?:\s*;\s*GUID:[^;]*)?(?:\s*;\s*Quantity: '([^']*)')?/;

const CHEST_RE =
  /Действие: 'Игрок (взял|сложил) вещь \((из своего сундука|в свой сундук)\):\s*DB_ChestType='([^']*)',CargoType='([^']*)',Item='([^']*)'/;

const SESSION_RE = /Действие: '\*\*\*\s*(LOGING TO SERVER|Disconnect FROM SERVER)\s*\*\*\*'/;

const ACTION_RE =
  /Действие: '(Действие - [^']+)'(?:;\s*Предмет: '([^']*)'\s*;\s*Quantity: '([^']*)')?/;

const ANY_ACTION_RE = /Действие: '([^']+)'/;

const POS_RE = /Позиция: '([^']+)'/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, mo: number, d: number, h: number, mi: number, s: number): string {
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

/** ClassName(Display) → ClassName */
export function classFromPlayerItem(raw: string): string {
  const m = /^(.+)\((.+)\)\s*$/.exec(raw.trim());
  if (!m) return raw.trim();
  return m[1].trim();
}

function shortMoveAction(action: string): string {
  if (/взял вещь \(с земли\)/i.test(action)) return 'взял с земли';
  if (/выложил вещь \(на землю\)/i.test(action)) return 'положил на землю';
  if (/положил/i.test(action)) return 'положил';
  if (/выбросил/i.test(action)) return 'выбросил';
  if (/Перемещение предмета/i.test(action)) return 'перемещение';
  return 'инвентарь';
}

const STASH_RE = /(?:Из|В)\s+(GM_STASH_[A-Za-z0-9_]+)(?:\(([^)]*)\))?/i;

function isArtefact(item: string): boolean {
  return item.startsWith('MF_Artefact') || /Artefact|_Art_|артефакт/i.test(item);
}

/** Артефакт с земли или содержимое тайника → отдельная категория. */
export function classifyLootMove(
  action: string,
  item: string,
): { category: 'loot'; action: string; target?: string } | null {
  const stash = STASH_RE.exec(action);
  if (stash) {
    const fromStash = /Из\s+GM_STASH/i.test(action);
    const stashName = stash[2] && stash[2] !== 'The cache' ? stash[2] : stash[1];
    return {
      category: 'loot',
      action: fromStash ? 'тайник · взял' : 'тайник · положил',
      target: stashName,
    };
  }
  if (isArtefact(item) || /GM_STASH_/i.test(item)) {
    const took = /взял вещь/i.test(action);
    const drop = /выложил|на землю/i.test(action);
    return {
      category: 'loot',
      action: took ? 'артефакт · взял' : drop ? 'артефакт · положил' : 'артефакт',
    };
  }
  return null;
}

function roundPos(raw: string): string {
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return raw.trim();
  return parts
    .slice(0, 3)
    .map((n) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)))
    .join(' ');
}

function shortenActionLabel(text: string): string {
  const t = text.replace(/^Действие -\s*/i, '').trim();
  return t.length > 72 ? `${t.slice(0, 69)}…` : t;
}

/** Разбор «Действие - …» → категория + короткий action + item/target. */
export function classifyPlayerAction(raw: string): {
  category: LogCategory;
  action: string;
  itemHint?: string;
  target?: string;
} {
  const text = raw.replace(/^Действие -\s*/i, '').trim();

  if (/^Открытие ворот/i.test(text)) return { category: 'doors', action: 'открыл ворота' };
  if (/^Закрытие ворот/i.test(text)) return { category: 'doors', action: 'закрыл ворота' };
  if (/^Открытие двери(?! машины)/i.test(text)) return { category: 'doors', action: 'открыл дверь' };
  if (/^Закрытие двери(?! машины)/i.test(text)) return { category: 'doors', action: 'закрыл дверь' };

  if (/^Открытие двери машины \(снаружи\)/i.test(text)) {
    return { category: 'vehicle', action: 'дверь · снаружи · открыл' };
  }
  if (/^Закрытие двери машины \(снаружи\)/i.test(text)) {
    return { category: 'vehicle', action: 'дверь · снаружи · закрыл' };
  }
  if (/^Открытие двери машины \(изнутри\)/i.test(text)) {
    return { category: 'vehicle', action: 'дверь · изнутри · открыл' };
  }
  if (/^Закрытие двери машины \(изнутри\)/i.test(text)) {
    return { category: 'vehicle', action: 'дверь · изнутри · закрыл' };
  }
  if (/^Включение двигателя/i.test(text)) return { category: 'vehicle', action: 'двигатель · вкл' };
  if (/^Выключение двигателя/i.test(text)) return { category: 'vehicle', action: 'двигатель · выкл' };
  if (/^Повреждение транспорта/i.test(text)) {
    return { category: 'vehicle', action: 'урон технике', itemHint: shortenActionLabel(text) };
  }

  if (/^Размещение ловушки/i.test(text)) return { category: 'world', action: 'ловушка' };
  if (/^Рубка дерева/i.test(text)) return { category: 'world', action: 'рубка дерева' };
  if (/^Разделка трупа/i.test(text)) {
    const who = text.replace(/^Разделка трупа\s*/i, '').trim() || 'труп';
    return { category: 'world', action: 'разделка', itemHint: who, target: who };
  }

  return { category: 'world', action: shortenActionLabel(text) };
}

export function isPlayerDayDir(name: string): boolean {
  return DAY_DIR_RE.test(name) || NUM_DIR_RE.test(name);
}

export function steamIdFromPlayerFile(name: string): string | null {
  const m = STEAM_FILE_RE.exec(name);
  return m ? m[1] : null;
}

/** Время в player-логе уже локальное — без utcOffset. */
export function parsePlayerLogText(steamId: string, text: string): SpawnEvent[] {
  const out: SpawnEvent[] = [];
  let lastCoords: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const head = HEAD_RE.exec(line);
    if (!head) continue;
    const [, dd, mm, yyyy, hh, mi, ss, nick] = head;
    const at = toIso(Number(yyyy), Number(mm), Number(dd), Number(hh), Number(mi), Number(ss));
    const posM = POS_RE.exec(line);
    if (posM) lastCoords = roundPos(posM[1]);
    const coords = posM ? roundPos(posM[1]) : lastCoords;

    const trade = TRADE_RE.exec(line);
    if (trade) {
      const side = trade[1].toLowerCase() as 'buy' | 'sell';
      const qty = trade[4];
      const price = trade[5];
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: 'trade',
        action: side === 'buy' ? `покупка · ${price}` : `продажа · ${price}`,
        item: trade[2],
        target: qty && qty !== '0' ? `${trade[3]} ×${qty}` : trade[3],
        coords,
      });
      continue;
    }

    const bank = BANK_RE.exec(line);
    if (bank) {
      const side = bank[1].toLowerCase() === 'withdraw' ? 'снятие' : 'внесение';
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: 'trade',
        action: `банк · ${side}`,
        item: bank[2],
        target: bank[3] || undefined,
        coords,
      });
      continue;
    }

    const chest = CHEST_RE.exec(line);
    if (chest) {
      const took = chest[1] === 'взял';
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: 'inventory',
        action: took ? 'сундук · взял' : 'сундук · положил',
        item: chest[5],
        target: chest[3],
        coords,
      });
      continue;
    }

    const session = SESSION_RE.exec(line);
    if (session) {
      const login = /LOGING/i.test(session[1]);
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: 'session',
        action: login ? 'вход' : 'выход',
        item: login ? 'login' : 'disconnect',
        coords,
      });
      continue;
    }

    const move = MOVE_RE.exec(line);
    if (move) {
      const qty = move[3];
      const item = classFromPlayerItem(move[2]);
      const loot = classifyLootMove(move[1], item);
      const qtyLabel = qty && qty !== '0' ? `×${qty}` : undefined;
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: loot?.category ?? 'inventory',
        action: loot?.action ?? shortMoveAction(move[1]),
        item,
        target: loot?.target || qtyLabel,
        coords,
      });
      continue;
    }

    const act = ACTION_RE.exec(line);
    if (act) {
      const mapped = classifyPlayerAction(act[1]);
      const rawItem = act[2] || '';
      const item = rawItem
        ? classFromPlayerItem(rawItem)
        : mapped.itemHint || mapped.action;
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: mapped.category,
        action: mapped.action,
        item,
        target: mapped.target,
        coords,
      });
      continue;
    }

    // всё остальное с «Действие:» — не теряем
    const any = ANY_ACTION_RE.exec(line);
    if (any) {
      const raw = any[1];
      if (/^Перемещение предмета/i.test(raw)) continue; // без Предмет — шум
      out.push({
        at,
        nick,
        steamId,
        kind: 'other',
        category: 'world',
        action: shortenActionLabel(raw),
        item: shortenActionLabel(raw),
        coords,
      });
    }
  }
  return out;
}

export function parsePlayerLogFile(fileName: string, text: string): SpawnEvent[] {
  const steamId = steamIdFromPlayerFile(fileName);
  if (!steamId) return [];
  return parsePlayerLogText(steamId, text);
}
