import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { LogCategory, SpawnKind } from '../parser/index.js';
import { Store } from './store.js';

function parseCategories(raw: string | undefined): LogCategory[] | undefined {
  if (raw == null || raw === '') return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as LogCategory[];
}

const store = new Store();
await store.load();

const app = new Hono();
app.use('/api/*', cors());

app.get('/api/health', (c) => c.json({ ok: true, events: store.events.length }));

app.get('/api/settings', (c) => c.json(store.settings));

app.put('/api/settings', async (c) => {
  const body = await c.req.json<{ logDir?: string; utcOffsetHours?: number }>();
  const result = await store.updateSettings(body);
  return c.json(result);
});

app.post('/api/reindex', async (c) => {
  const result = await store.reindex();
  return c.json(result);
});

app.post('/api/catalog/refresh', async (c) => {
  const result = await store.refreshCatalog();
  return c.json(result);
});

app.get('/api/admins', (c) => c.json(store.admins));

app.get('/api/snapshot', (c) => c.json(store.toSnapshot()));

app.get('/api/events', (c) => {
  const query = c.req.query();
  const payload = store.query({
    from: query.from,
    to: query.to,
    admin: query.admin,
    kind: (query.kind || '') as SpawnKind | '',
    q: query.q || '',
    forbiddenOnly: query.forbiddenOnly === '1',
    collapse: query.collapse !== '0',
    categories: parseCategories(query.categories),
  });
  return c.json(payload);
});

app.get('/api/stats', (c) => {
  const query = c.req.query();
  return c.json(
    store.stats({
      from: query.from,
      to: query.to,
      admin: query.admin,
      kind: (query.kind || '') as SpawnKind | '',
      q: query.q || '',
      forbiddenOnly: query.forbiddenOnly === '1',
      collapse: false,
      categories: parseCategories(query.categories),
    }),
  );
});

app.get('/api/export', (c) => {
  const query = c.req.query();
  const text = store.exportDiscord({
    from: query.from,
    to: query.to,
    admin: query.admin,
    kind: (query.kind || '') as SpawnKind | '',
    q: query.q || '',
    forbiddenOnly: query.forbiddenOnly === '1',
    collapse: query.collapse !== '0',
    categories: parseCategories(query.categories),
  });
  return c.body(text, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename="spawn-audit.txt"',
  });
});

serve({ fetch: app.fetch, port: 8787, hostname: '127.0.0.1' }, () => {
  console.log(`API http://127.0.0.1:8787  events=${store.events.length}`);
});
