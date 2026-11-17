import type { DeleteEvent, SpawnEvent } from '../parser/types';

const DB_NAME = 'vpp-spawn-audit';
const STORE = 'events';
const RANGE_KEY = 'vpp-audit:range';

export type ExtraPack = {
  events: SpawnEvent[];
  deletes: DeleteEvent[];
};

export function eventKey(ev: SpawnEvent): string {
  return `${ev.at}|${ev.steamId}|${ev.category ?? 'spawn'}|${ev.kind}|${ev.action ?? ''}|${ev.item}|${ev.target ?? ''}`;
}

export function deleteKey(ev: DeleteEvent): string {
  return `${ev.at}|${ev.steamId}|${ev.item}`;
}

export function dedupeEvents(list: SpawnEvent[]): SpawnEvent[] {
  const seen = new Set<string>();
  const out: SpawnEvent[] = [];
  for (const ev of list) {
    const key = eventKey(ev);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

export function dedupeDeletes(list: DeleteEvent[]): DeleteEvent[] {
  const seen = new Set<string>();
  const out: DeleteEvent[] = [];
  for (const ev of list) {
    const key = deleteKey(ev);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

function isDay(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function loadSavedRange(fallback: { from: string; to: string }): { from: string; to: string } {
  try {
    const raw = localStorage.getItem(RANGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { from?: string; to?: string };
    if (isDay(parsed.from) && isDay(parsed.to)) return { from: parsed.from, to: parsed.to };
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveRange(from: string, to: string): void {
  localStorage.setItem(RANGE_KEY, JSON.stringify({ from, to }));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function asPack(raw: unknown): ExtraPack {
  if (Array.isArray(raw)) return { events: raw as SpawnEvent[], deletes: [] };
  if (raw && typeof raw === 'object' && Array.isArray((raw as ExtraPack).events)) {
    const pack = raw as ExtraPack;
    return { events: pack.events, deletes: pack.deletes || [] };
  }
  return { events: [], deletes: [] };
}

export async function loadExtras(): Promise<ExtraPack> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('list');
      req.onsuccess = () => resolve(asPack(req.result));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { events: [], deletes: [] };
  }
}

export async function saveExtras(pack: ExtraPack): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(pack, 'list');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadExtraEvents(): Promise<SpawnEvent[]> {
  return (await loadExtras()).events;
}

export async function saveExtraEvents(events: SpawnEvent[]): Promise<void> {
  const prev = await loadExtras();
  await saveExtras({ ...prev, events });
}
