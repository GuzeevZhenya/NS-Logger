import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeAdmins, parseLogText, type AdminRecord, type Settings } from '../src/parser/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

const settings = JSON.parse(await readFile(path.join(DATA, 'settings.json'), 'utf8')) as Settings;
const files = (await readdir(settings.logDir)).filter((f) => f.startsWith('Log_') && f.endsWith('.txt'));
const events = [];
for (const file of files) {
  const text = await readFile(path.join(settings.logDir, file), 'utf8');
  events.push(...parseLogText(file, text, settings.utcOffsetHours));
}

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

const seeded = JSON.parse(await readFile(path.join(DATA, 'admins.json'), 'utf8').catch(() => '[]')) as AdminRecord[];
const admins = mergeAdmins(events, seeded, groups);
await writeFile(path.join(DATA, 'admins.json'), JSON.stringify(admins, null, 2), 'utf8');
console.error(`admins=${admins.length} events=${events.length}`);
