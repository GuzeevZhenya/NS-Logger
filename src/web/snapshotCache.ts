import type { Snapshot } from './snapshot';

const CACHE_NAME = 'vpp-audit-snapshot';
const META_KEY = 'vpp-audit:snap-cached-at';
const TTL_MS = 60 * 60 * 1000; // 1 час

async function bust(url: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(url);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    /* ignore */
  }
}

/** Снимок из Cache Storage, если младше часа; иначе сеть → кэш. */
export async function fetchSnapshotCached(url: string): Promise<{ data: Snapshot; fromCache: boolean }> {
  const savedAt = Number(localStorage.getItem(META_KEY) || 0);
  const fresh = savedAt > 0 && Date.now() - savedAt <= TTL_MS;

  if (fresh && typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) {
        const data = (await hit.json()) as Snapshot;
        if (data?.events) return { data, fromCache: true };
      }
    } catch {
      /* падаем в сеть */
    }
  } else if (savedAt > 0) {
    await bust(url);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error('не удалось загрузить журнал');

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, res.clone());
      localStorage.setItem(META_KEY, String(Date.now()));
    } catch {
      /* кэш необязателен */
    }
  }

  const data = (await res.json()) as Snapshot;
  return { data, fromCache: false };
}

export async function clearCachedSnapshot(url = '/snapshot.json'): Promise<void> {
  await bust(url);
}
