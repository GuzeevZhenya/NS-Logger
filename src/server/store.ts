import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  buildStats,
  collapseBursts,
  enrichEvents,
  filterEvents,
  mergeAdmins,
  attachDeletes,
  parseLogFile,
  searchEvents,
  toDiscordLines,
  type AdminRecord,
  type DeleteEvent,
  type EnrichedEvent,
  type ItemCatalog,
  type Settings,
  type LogCategory,
  type SpawnEvent,
  type SpawnKind,
} from '../parser/index.js';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'data');

export type Query = {
  from?: string;
  to?: string;
  admin?: string;
  kind?: SpawnKind | '';
  q?: string;
  forbiddenOnly?: boolean;
  collapse?: boolean;
  categories?: LogCategory[];
};

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

type GroupUser = { m_UserName: string; m_Steam64ID: string };
type UserGroup = { m_GroupMembers?: GroupUser[] };

export class Store {
  settings: Settings = {
    logDir: '',
    userGroupsPath: '',
    utcOffsetHours: 3,
  };
  catalog: ItemCatalog = {};
  extraForbidden: string[] = [];
  seededAdmins: AdminRecord[] = [];
  admins: AdminRecord[] = [];
  events: SpawnEvent[] = [];
  deletes: DeleteEvent[] = [];
  lastError = '';

  async load(): Promise<void> {
    this.settings = await readJson<Settings>(path.join(DATA, 'settings.json'), this.settings);
    this.catalog = await readJson<ItemCatalog>(path.join(DATA, 'items.json'), {});
    this.extraForbidden = await readJson<string[]>(path.join(DATA, 'forbidden-extra.json'), []);
    this.seededAdmins = await readJson<AdminRecord[]>(path.join(DATA, 'admins.json'), []);
    await this.reindex();
  }

  async updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    await writeFile(path.join(DATA, 'settings.json'), JSON.stringify(this.settings, null, 2), 'utf8');
    return this.reindex();
  }

  async reindex() {
    this.lastError = '';
    try {
      const files = (await readdir(this.settings.logDir)).filter((f) => f.startsWith('Log_') && f.endsWith('.txt'));
      const all: SpawnEvent[] = [];
      const dels: DeleteEvent[] = [];
      for (const file of files) {
        const text = await readFile(path.join(this.settings.logDir, file), 'utf8');
        const parsed = parseLogFile(file, text, this.settings.utcOffsetHours);
        all.push(...parsed.spawns);
        dels.push(...parsed.deletes);
      }
      all.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      dels.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      this.events = all;
      this.deletes = dels;
      const groups = await this.readGroups();
      this.admins = mergeAdmins(all, this.seededAdmins, groups);
      await writeFile(path.join(DATA, 'admins.json'), JSON.stringify(this.admins, null, 2), 'utf8');
      this.seededAdmins = this.admins;
      return { ok: true, files: files.length, events: all.length, admins: this.admins.length };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.events = [];
      this.deletes = [];
      return { ok: false, error: this.lastError, files: 0, events: 0, admins: this.admins.length };
    }
  }

  async refreshCatalog() {
    const script = path.join(ROOT, 'scripts', 'refresh-catalog.mjs');
    const { stdout, stderr } = await execFileAsync(process.execPath, [script], { cwd: ROOT });
    this.catalog = await readJson<ItemCatalog>(path.join(DATA, 'items.json'), {});
    return { ok: true, log: `${stderr}\n${stdout}`.trim(), items: Object.keys(this.catalog).length };
  }

  private async readGroups(): Promise<Array<{ steamId: string; displayName: string }>> {
    if (!this.settings.userGroupsPath) return [];
    try {
      const raw = await readJson<UserGroup[]>(this.settings.userGroupsPath, []);
      const out: Array<{ steamId: string; displayName: string }> = [];
      for (const g of raw) {
        for (const m of g.m_GroupMembers || []) {
          if (m.m_Steam64ID) out.push({ steamId: String(m.m_Steam64ID), displayName: m.m_UserName });
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  private filtered(query: Query): EnrichedEvent[] {
    const from = query.from || daysAgo(30);
    const to = query.to || today();
    let list = attachDeletes(
      enrichEvents(
        filterEvents(this.events, {
          from,
          to,
          admin: query.admin,
          kind: query.kind,
          categories: query.categories,
        }),
        this.catalog,
        this.extraForbidden,
      ),
      this.deletes,
    );
    list = searchEvents(list, query.q || '');
    if (query.forbiddenOnly) list = list.filter((e) => e.forbidden);
    if (query.collapse) list = collapseBursts(list);
    return list;
  }

  query(query: Query) {
    const events = this.filtered(query);
    const cap = 2500;
    return {
      events: events.slice(0, cap),
      total: events.length,
      truncated: events.length > cap,
      error: this.lastError,
      range: { from: query.from || daysAgo(30), to: query.to || today() },
    };
  }

  stats(query: Query) {
    const scoped = buildStats(this.filtered({ ...query, collapse: false }));
    const roster = buildStats(this.filtered({ ...query, admin: 'all', collapse: false }));
    return {
      ...scoped,
      byAdmin: roster.byAdmin,
      rosterTotal: roster.total,
    };
  }

  toSnapshot() {
    return {
      generatedAt: new Date().toISOString(),
      utcOffsetHours: this.settings.utcOffsetHours,
      logDir: this.settings.logDir,
      admins: this.admins,
      catalog: this.catalog,
      extraForbidden: this.extraForbidden,
      events: this.events,
      deletes: this.deletes,
    };
  }

  exportDiscord(query: Query) {
    const events = this.filtered(query);
    const header = [
      `# VPP spawn audit (+${this.settings.utcOffsetHours}ч)`,
      `# ${query.from || daysAgo(30)} .. ${query.to || today()}`,
      `# Строк: ${events.length}`,
      '',
    ].join('\n');
    return header + toDiscordLines(events) + '\n';
  }
}
