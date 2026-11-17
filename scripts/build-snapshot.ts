import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergeAdmins,
  parseLogFile,
  type AdminRecord,
  type DeleteEvent,
  type ItemCatalog,
  type Settings,
  type SpawnEvent,
} from '../src/parser/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'public', 'snapshot.json');

const settings = JSON.parse(await readFile(path.join(DATA, 'settings.json'), 'utf8')) as Settings;
const catalog = JSON.parse(await readFile(path.join(DATA, 'items.json'), 'utf8')) as ItemCatalog;
const extraForbidden = JSON.parse(
  await readFile(path.join(DATA, 'forbidden-extra.json'), 'utf8').catch(() => '[]'),
) as string[];
const seeded = JSON.parse(await readFile(path.join(DATA, 'admins.json'), 'utf8').catch(() => '[]')) as AdminRecord[];

const files = (await readdir(settings.logDir)).filter((f) => f.startsWith('Log_') && f.endsWith('.txt'));
const events: SpawnEvent[] = [];
const deletes: DeleteEvent[] = [];
for (const file of files) {
  const text = await readFile(path.join(settings.logDir, file), 'utf8');
  const parsed = parseLogFile(file, text, settings.utcOffsetHours);
  events.push(...parsed.spawns);
  deletes.push(...parsed.deletes);
}
events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
deletes.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

let groups: Array<{ steamId: string; displayName: string }> = [];
try {
  const raw = JSON.parse(await readFile(settings.userGroupsPath, 'utf8')) as Array<{
    m_GroupMembers?: Array<{ m_UserName: string; m_Steam64ID: string }>;
  }>;
  for (const g of raw) {
    for (const m of g.m_GroupMembers || []) {
      groups.push({ steamId: String(m.m_Steam64ID), displayName: m.m_UserName });
    }
  }
} catch {
  groups = [];
}

const admins = mergeAdmins(events, seeded, groups);
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    utcOffsetHours: settings.utcOffsetHours,
    logDir: settings.logDir,
    admins,
    catalog,
    extraForbidden,
    events,
    deletes,
  }),
  'utf8',
);
console.error(`snapshot events=${events.length} deletes=${deletes.length} admins=${admins.length} -> ${OUT}`);
