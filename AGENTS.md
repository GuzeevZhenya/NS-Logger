# VPP Spawn Audit

Локальный аудит спавна из логов Vanilla++ Admin Tools: кто из админов что заспавнил, за какие дни, какие предметы запрещены.

## Стек

- Frontend: Vite + React 19 + TypeScript
- API: Hono на Node (`src/server`)
- Парсер: чистые функции в `src/parser`, vitest
- Каталог: `data/items.json` (имя + запрет из Google-таблицы)
- Пакетный менеджер: pnpm

## Команды

- Установка: `pnpm install`
- Dev: `pnpm dev` (UI :5273, API :8787)
- Тесты: `pnpm test`
- Каталог: `pnpm catalog`
- Сид админов: `pnpm seed`
- Сборка UI: `pnpm build`

## Архитектура

- `src/parser` — строки `Log_*.txt` → события спавна (+3ч, переход через полночь)
- `src/server` — индекс в памяти, фильтры, экспорт
- `src/web` — диапазон дат, Все/админ, таблица, запрет
- `data/settings.json` — путь к `Logging`, смещение времени
- `data/admins.json` — ник + SteamID из текущих логов
- `data/forbidden-extra.json` — ручной доп. запрет
- Секреты VPP (`Permissions/credentials.txt`) не читать

Источник логов по умолчанию: `d:\!!!АВТО-ИВЕНТЫ\Логи\VPPAdminTools\Logging`.

Исследование каталога: `docs/research/item-catalog.md`.

## Git

- GitHub Flow: ветка `feature/*` от `main`, PR в `main`
- Коммит и PR только по просьбе
- В `main` не коммитить без явной просьбы
- Conventional Commits, описание на русском, без Co-authored-by

## Документы по задаче

- PRD: `docs/prd/vpp-spawn-audit.md`
- Фазы: `docs/plans/vpp-spawn-audit.md`
- Ревью: `docs/REVIEW.md`

## STOP

- Не читать и не писать секреты (`.env`, кроме `.env.example`)
- Не править lock-файлы вручную
- Не делать force-push и `git reset --hard`
- Два провала подряд по одной ошибке — остановиться и переформулировать
