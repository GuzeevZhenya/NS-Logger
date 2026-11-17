import { describe, expect, it } from 'vitest';
import { collapseBursts, enrichEvents, formatItemLabel } from './enrich.js';
import { toDiscordLines } from './discord.js';
import {
  attachDeletes,
  filterEvents,
  parseFileStamp,
  parseLogFile,
  parseLogText,
} from './parseSpawnLogs.js';

const catalog = {
  GIR_Eq_Respirator_R2: { name: 'Респиратор Р-2', forbidden: false },
  CarTent: { name: 'Автомобильная палатка', forbidden: true },
  BestPDA_Module_GPS: { name: 'Модуль расширения PDA', forbidden: false },
};

describe('parseFileStamp', () => {
  it('reads single-digit minutes', () => {
    const d = parseFileStamp('Log_2026-10-19_12-0-33.txt');
    expect(d?.getHours()).toBe(12);
    expect(d?.getMinutes()).toBe(0);
    expect(d?.getSeconds()).toBe(33);
  });
});

describe('parseLogText', () => {
  const file = 'Log_2026-10-19_11-37-28.txt';

  it('parses self, on-player and preset with +3h', () => {
    const text = [
      '12:42:3 | "*Tiran" (steamid=76561198804118767) Spawned Item: (GIR_Eq_Respirator_R2)',
      '12:43:16 | "*Foma" (steamid=76561199759259348) Spawned Item: (MF_Detector_Veles) on "Zippo"',
      '13:16:23 | "*Pupok" (steamid=76561199678436690) spawned preset: (Старый друг)',
    ].join('\n');
    const events = parseLogText(file, text, 3);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      at: '2026-10-19T15:42:03',
      nick: '*Tiran',
      kind: 'on-self',
      category: 'spawn',
      item: 'GIR_Eq_Respirator_R2',
    });
    expect(events[1]).toMatchObject({
      kind: 'on-player',
      item: 'MF_Detector_Veles',
      target: 'Zippo',
    });
    expect(events[2]).toMatchObject({
      kind: 'preset',
      item: 'Старый друг',
    });
  });

  it('parses teleport, stats and godmode', () => {
    const text = [
      '15:3:49 | "Zippo" (steamid=76561198052058404) teleported to crosshair (pos=<8525.950195, 133.573090, 7248.582031>)',
      '15:36:18 | "[MX] Da Vinci" (steamid=76561198449804629) just updated a health stat on (steamid=76561198449804629)',
      '15:3:42 | "Zippo" (steamid=76561198052058404) toggled godmode',
    ].join('\n');
    const events = parseLogText(file, text, 3);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ category: 'teleport', action: 'телепорт' });
    expect(events[1]).toMatchObject({ category: 'stats', action: 'статы' });
    expect(events[2]).toMatchObject({ category: 'cheats', action: 'godmode' });
  });

  it('rolls over past midnight relative to file start', () => {
    const late = 'Log_2026-10-19_23-50-00.txt';
    const text = '0:05:1 | "*Tiran" (steamid=1) Spawned Item: (CarTent)';
    const events = parseLogText(late, text, 3);
    expect(events[0].at).toBe('2026-10-20T03:05:01');
  });
});

describe('filter and enrich', () => {
  const events = parseLogText(
    'Log_2026-10-19_11-00-00.txt',
    [
      '12:13:25 | "*Pupok" (steamid=76561199678436690) Spawned Item: (BestPDA_Module_GPS)',
      '12:14:00 | "*Pupok" (steamid=76561199678436690) Spawned Item: (CarTent)',
      '12:14:00 | "*Tiran" (steamid=76561198804118767) Spawned Item: (CarTent)',
    ].join('\n'),
    3,
  );

  it('filters one admin and day', () => {
    const found = filterEvents(events, {
      from: '2026-10-19',
      to: '2026-10-19',
      admin: '76561199678436690',
    });
    expect(found).toHaveLength(2);
    expect(found.every((e) => e.nick === '*Pupok')).toBe(true);
  });

  it('labels names and marks forbidden', () => {
    const enriched = enrichEvents(events, catalog, []);
    expect(formatItemLabel('BestPDA_Module_GPS', catalog)).toBe(
      'BestPDA_Module_GPS (Модуль расширения PDA)',
    );
    expect(enriched[0].forbidden).toBe(false);
    expect(enriched[1].forbidden).toBe(true);
    expect(enriched[0].unknown).toBe(false);
  });

  it('collapses bursts within a second', () => {
    const burst = parseLogText(
      'Log_2026-10-19_11-00-00.txt',
      [
        '12:52:27 | "*Foma" (steamid=2) Spawned Item: (RS_ExternalDosimeterRKSB)',
        '12:52:28 | "*Foma" (steamid=2) Spawned Item: (RS_ExternalDosimeterRKSB)',
      ].join('\n'),
      3,
    );
    const collapsed = collapseBursts(enrichEvents(burst, {}, []));
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].count).toBe(2);
  });

  it('formats discord export', () => {
    const [line] = toDiscordLines(enrichEvents([events[0]], catalog, [])).split('\n');
    expect(line).toContain('item: BestPDA_Module_GPS (Модуль расширения PDA)');
    expect(line).toContain('*Pupok');
  });
});

describe('attachDeletes', () => {
  const file = 'Log_2026-10-28_18-1-5.txt';

  it('marks self-delete within 3 hours', () => {
    const parsed = parseLogFile(
      file,
      [
        '18:38:12 | "Svyaznoi" (steamid=111) Spawned Item: (SFP_Maskarad_Gloves)',
        '18:41:1 | "Svyaznoi" (steamid=111) deleted object "SFP_Maskarad_Gloves" (pos=<1, 2, 3>)',
      ].join('\n'),
      3,
    );
    const [row] = attachDeletes(enrichEvents(parsed.spawns, {}, []), parsed.deletes);
    expect(row.deleted?.samePerson).toBe(true);
  });

  it('names another admin who deleted it', () => {
    const parsed = parseLogFile(
      file,
      [
        '18:38:12 | "Svyaznoi" (steamid=111) Spawned Item: (SFP_Maskarad_Head)',
        '18:50:0 | "*Pupok" (steamid=222) deleted object "SFP_Maskarad_Head" (pos=<1, 2, 3>)',
      ].join('\n'),
      3,
    );
    const [row] = attachDeletes(enrichEvents(parsed.spawns, {}, []), parsed.deletes);
    expect(row.deleted?.samePerson).toBe(false);
    expect(row.deleted?.byNick).toBe('*Pupok');
  });

  it('ignores delete after 3 hours', () => {
    const parsed = parseLogFile(
      file,
      [
        '18:38:12 | "Svyaznoi" (steamid=111) Spawned Item: (SFP_Maskarad_boots)',
        '22:00:0 | "Svyaznoi" (steamid=111) deleted object "SFP_Maskarad_boots" (pos=<1, 2, 3>)',
      ].join('\n'),
      3,
    );
    const [row] = attachDeletes(enrichEvents(parsed.spawns, {}, []), parsed.deletes);
    expect(row.deleted).toBeUndefined();
  });
});
