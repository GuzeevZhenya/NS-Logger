# План: player trade / inventory

## Фаза 1 — сквозной путь

Цель: читать все строки ModernLogger из `Day_*` / `NN`.

Слои: parser + settings/store/snapshot + UI.

Задачи:

1. Категории trade / inventory / doors / vehicle / session / world
2. Парсер всех типов + vitest
3. `playerLogDir` → store + snapshot
4. Enrich с координатами
5. `pnpm test` + `pnpm build`

Критерий: чипы player-категорий со счётчиками, тест зелёный.

## Фаза 2 (позже)

Фильтр по игроку, урезание login-dump инвентаря.
