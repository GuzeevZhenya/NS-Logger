import { describe, expect, it } from 'vitest';
import {
  classifyPlayerAction,
  classFromPlayerItem,
  parsePlayerLogFile,
  parsePlayerLogText,
} from './parsePlayerLogs.js';

describe('classFromPlayerItem', () => {
  it('strips display name', () => {
    expect(classFromPlayerItem("bastard_tigr_nogun_skin3(Multi-colored Armored car Tiger)")).toBe(
      'bastard_tigr_nogun_skin3',
    );
  });
});

describe('classifyPlayerAction', () => {
  it('maps doors and vehicle', () => {
    expect(classifyPlayerAction('Действие - Закрытие ворот').category).toBe('doors');
    expect(classifyPlayerAction('Действие - Открытие двери машины (снаружи)').category).toBe(
      'vehicle',
    );
    expect(classifyPlayerAction('Действие - Включение двигателя машины').action).toBe(
      'двигатель · вкл',
    );
  });

  it('maps world leftovers', () => {
    expect(classifyPlayerAction('Действие - Рубка дерева').category).toBe('world');
    expect(classifyPlayerAction('Действие - Размещение ловушки').action).toBe('ловушка');
  });
});

describe('parsePlayerLogText', () => {
  const steam = '76561198436054883';

  it('parses trade buy/sell and bank', () => {
    const text = [
      "16.11.2026 12:17:16: Player: 'Kakosik';  Действие: '[TRADER PLUS] BUY item: 'kr_Ammo_556x45_m855',Category: 'Патроны',Quantity: '60',Price: '1200'; Позиция: '7728.110 122.349 4912.730';",
      "16.11.2026 12:20:00: Player: 'Kakosik';  Действие: '[TRADER PLUS] SELL item: 'Apple',Category: 'Еда',Quantity: '1',Price: '50'; Позиция: '7728.110 122.349 4912.730';",
      "16.11.2026 12:21:00: Player: 'Kakosik';  Действие: '[TRADER PLUS BANK] Withdraw: '30000' (OWN BANK)'; Позиция: '4867.210 122.047 6673.850';",
    ].join('\n');
    const events = parsePlayerLogText(steam, text);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      category: 'trade',
      action: 'покупка · 1200',
      item: 'kr_Ammo_556x45_m855',
      coords: '7728 122 4913',
    });
    expect(events[1].action).toBe('продажа · 50');
    expect(events[2]).toMatchObject({ category: 'trade', action: 'банк · снятие', item: '30000' });
  });

  it('parses inventory move, chest, session, vehicle door', () => {
    const text = [
      "16.11.2026 08:24:46: Player: 'Kakosik';  Действие: '*** LOGING TO SERVER ***'; Позиция: '7728.430 122.349 4937.070';",
      "16.11.2026 08:24:46: Player: 'Kakosik';  Действие: 'Перемещение предмета (Игрок взял вещь (с земли))'; Предмет: 'BandageDressing(Bandage)' ; GUID: 'abc' ; Quantity: '4'",
      "16.11.2026 08:25:20: Player: 'Kakosik';  Действие: 'Действие - Открытие двери машины (снаружи)'; Предмет: 'Lada_Samara_2108_black(VAZ-2108)' ; Quantity: '0' Позиция: '7715.530 116.322 4859.860';",
      "16.11.2026 11:31:35: Player: 'Kakosik';  Действие: 'Действие - Закрытие ворот'; Предмет: 'Fence(Fence)' ; Quantity: '0' Позиция: '7713.090 117.409 4939.570';",
      "15.11.2026 17:31:15: Player: 'Pivik';  Действие: 'Игрок взял вещь (из своего сундука): DB_ChestType='MPS_Bar_Chest',CargoType='MPS_Type_50',Item='AP_tops_tf141_grey'; Позиция: '4867.270 122.047 6673.900';",
      "16.11.2026 08:54:04: Player: 'Kakosik';  Действие: '*** Disconnect FROM SERVER ***'; Позиция: '7726.800 122.349 4920.970';",
    ].join('\n');
    const events = parsePlayerLogText(steam, text);
    expect(events.map((e) => e.category)).toEqual([
      'session',
      'inventory',
      'vehicle',
      'doors',
      'inventory',
      'session',
    ]);
    expect(events[1].coords).toBe('7728 122 4937');
    expect(events[2]).toMatchObject({
      item: 'Lada_Samara_2108_black',
      action: 'дверь · снаружи · открыл',
      coords: '7716 116 4860',
    });
    expect(events[4]).toMatchObject({
      action: 'сундук · взял',
      item: 'AP_tops_tf141_grey',
      target: 'MPS_Bar_Chest',
    });
  });

  it('tags artefacts and stash as loot', () => {
    const text = [
      "16.11.2026 08:28:21: Player: 'Kakosik';  Действие: 'Перемещение предмета (Игрок взял вещь (с земли) В AP_bag_riflebag_green(Weapon bag))'; Предмет: 'MF_Artefact_Vspiska(#mf_flash)' ; GUID: 'x' ; Quantity: '0' Позиция: '4450.810 147.147 3209.000';",
      "16.11.2026 07:52:14: Player: 'Pivik';  Действие: 'Перемещение предмета (Перемещение Из GM_STASH_KotBox_2(The cache) В NSg_Psz9d_Att_Pocket_Back(Pouch))'; Предмет: 'BandageDressing(Bandage)' ; GUID: 'y' ; Quantity: '4'",
    ].join('\n');
    const events = parsePlayerLogText(steam, text);
    expect(events[0]).toMatchObject({
      category: 'loot',
      action: 'артефакт · взял',
      item: 'MF_Artefact_Vspiska',
      coords: '4451 147 3209',
    });
    expect(events[1]).toMatchObject({
      category: 'loot',
      action: 'тайник · взял',
      item: 'BandageDressing',
      target: 'GM_STASH_KotBox_2',
    });
  });

  it('reads steam id from file name', () => {
    const events = parsePlayerLogFile(
      '76561198436054883.log',
      "16.11.2026 08:24:46: Player: 'Kakosik';  Действие: '*** LOGING TO SERVER ***'; Позиция: '1 2 3';",
    );
    expect(events[0].steamId).toBe('76561198436054883');
  });
});
