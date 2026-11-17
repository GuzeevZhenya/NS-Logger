// What: качает Google-таблицу предметов DayZ → data/items.json (имя + запрет)
// Вход: публичная таблица ID / Название / Применение
// Выход: { ClassName: { name, forbidden } }
// Пример: node scripts/refresh-catalog.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHEET_ID = '1gBh9Z-02lYCUFdCRUX_U9Q7Kx5WaLCa3468FfFD5-B0';
const SKIP = new Set(['Сводный', 'Фото']);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'items.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (c === '\r') continue;
    cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function norm(cell) {
  return String(cell || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cols = rows[i].map(norm);
    const nameIdx = cols.findIndex((c) => c === 'Название' || c.startsWith('Название '));
    const idIdx = cols.findIndex((c) => c.includes('ID предмета'));
    const usageIdx = cols.findIndex((c) => c === 'Применение' || c.startsWith('Применение '));
    if (nameIdx >= 0 && idIdx >= 0) return { row: i, nameIdx, idIdx, usageIdx };
  }
  return null;
}

async function listSheets() {
  const html = await (await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`)).text();
  const re = /items\.push\(\{name: "([^"]+)"[^}]*gid: "(-?\d+)"/g;
  const sheets = [];
  let m;
  while ((m = re.exec(html))) sheets.push({ name: m[1], gid: m[2] });
  if (!sheets.length) throw new Error('Не удалось прочитать листы таблицы');
  return sheets;
}

async function downloadCsv(gid) {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
  );
  if (!res.ok) throw new Error(`CSV gid=${gid} HTTP ${res.status}`);
  return res.text();
}

const items = Object.create(null);
const sheets = (await listSheets()).filter((s) => !SKIP.has(s.name));
let mapped = 0;
let forbidden = 0;

for (const sheet of sheets) {
  const rows = parseCsv(await downloadCsv(sheet.gid));
  const header = findHeader(rows);
  if (!header) {
    console.error(`skip ${sheet.name}`);
    continue;
  }
  let n = 0;
  for (let i = header.row + 1; i < rows.length; i++) {
    const cls = norm(rows[i][header.idIdx]);
    const title = norm(rows[i][header.nameIdx]);
    const usage = header.usageIdx >= 0 ? norm(rows[i][header.usageIdx]) : '';
    if (!cls || !/^[A-Za-z0-9_.-]+$/.test(cls)) continue;
    const isForbidden = usage.includes('Запрет');
    const prev = items[cls];
    if (!prev) {
      items[cls] = { name: title, forbidden: isForbidden };
      mapped++;
      n++;
      if (isForbidden) forbidden++;
    } else {
      if (!prev.name && title) prev.name = title;
      if (isForbidden && !prev.forbidden) {
        prev.forbidden = true;
        forbidden++;
      }
    }
  }
  console.error(`${sheet.name}: +${n}`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(items, null, 2), 'utf8');
console.error(`items=${mapped} forbidden=${forbidden} -> ${OUT}`);
