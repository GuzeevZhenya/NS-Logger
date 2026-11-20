import type { AdminRecord, Audience, EnrichedEvent, LogCategory, Settings, SpawnKind } from '../parser/types';
import type { Stats } from '../parser/enrich';

export type Filters = {
  from: string;
  to: string;
  admin: string;
  kind: SpawnKind | '';
  q: string;
  forbiddenOnly: boolean;
  collapse: boolean;
  /** Пустой массив = ничего не показывать; undefined в API = все (legacy) */
  categories: LogCategory[];
  audience?: Audience;
  page?: number;
  pageSize?: 100 | 200 | 300;
};

export type EventsResponse = {
  events: EnrichedEvent[];
  total: number;
  truncated: boolean;
  error: string;
  range: { from: string; to: string };
};

function qs(filters: Filters): string {
  const p = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    admin: filters.admin,
    kind: filters.kind === 'other' ? '' : filters.kind,
    q: filters.q,
    categories: filters.categories.join(','),
  });
  if (filters.forbiddenOnly) p.set('forbiddenOnly', '1');
  p.set('collapse', filters.collapse ? '1' : '0');
  if (filters.audience && filters.audience !== 'both') p.set('audience', filters.audience);
  return p.toString();
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

export const api = {
  settings: () => json<Settings>('/api/settings'),
  admins: () => json<AdminRecord[]>('/api/admins'),
  events: (filters: Filters) => json<EventsResponse>(`/api/events?${qs(filters)}`),
  stats: (filters: Filters) => json<Stats>(`/api/stats?${qs(filters)}`),
  saveSettings: (patch: Partial<Settings>) =>
    json<{ ok: boolean; error?: string; events: number; admins: number }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  reindex: () => json<{ ok: boolean; error?: string; events: number; files: number }>('/api/reindex', { method: 'POST' }),
  refreshCatalog: () =>
    json<{ ok: boolean; items: number; log: string }>('/api/catalog/refresh', { method: 'POST' }),
  exportUrl: (filters: Filters) => `/api/export?${qs(filters)}`,
};
