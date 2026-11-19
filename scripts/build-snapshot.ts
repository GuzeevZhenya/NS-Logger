import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPlayerDayDir,
  collectAdmins,
  collectPlayers,
  parseLogFile,
  parsePlayerLogFile,
  steamIdFromPlayerFile,
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
const adminEvents: SpawnEvent[] = [];
const deletes: DeleteEvent[] = [];
for (const file of files) {
  const text = await readFile(path.join(settings.logDir, file), 'utf8');
  const parsed = parseLogFile(file, text, settings.utcOffsetHours);
  adminEvents.push(...parsed.spawns);
  deletes.push(...parsed.deletes);
}

const playerEvents: SpawnEvent[] = [];
let playerFiles = 0;
const playerRoot = settings.playerLogDir?.trim();
if (playerRoot) {
  try {
    const dirs = (await readdir(playerRoot, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && isPlayerDayDir(d.name))
      .map((d) => d.name);
    for (const dir of dirs) {
      const dirPath = path.join(playerRoot, dir);
      for (const name of await readdir(dirPath)) {
        if (!steamIdFromPlayerFile(name)) continue;
        const text = await readFile(path.join(dirPath, name), 'utf8');
        playerEvents.push(...parsePlayerLogFile(name, text));
        playerFiles += 1;
      }
    }
  } catch (err) {
    console.error('player logs skipped:', err instanceof Error ? err.message : err);
  }
}

const events = [...adminEvents, ...playerEvents];
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

const admins = collectAdmins(adminEvents, seeded, groups);
const adminIds = new Set(admins.map((a) => a.steamId));
const players = collectPlayers(playerEvents, adminIds);
await writeFile(path.join(DATA, 'admins.json'), JSON.stringify(admins, null, 2), 'utf8');
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    utcOffsetHours: settings.utcOffsetHours,
    logDir: settings.logDir,
    playerLogDir: settings.playerLogDir || '',
    admins,
    players,
    catalog,
    extraForbidden,
    events,
    deletes,
  }),
  'utf8',
);
console.error(
  `snapshot events=${events.length} (admin=${adminEvents.length} player=${playerEvents.length} files=${playerFiles}) deletes=${deletes.length} admins=${admins.length} players=${players.length} -> ${OUT}`,
);
