# VPP Spawn Audit

Локальный просмотр спавна из логов Vanilla++ Admin Tools: даты, админ, названия предметов, запрет.

## Стек

Vite, React 19, TypeScript, Hono, vitest, pnpm.

## Куда класть логи

Нужна папка **сырых** файлов VPP:

`d:\!!!АВТО-ИВЕНТЫ\Логи\VPPAdminTools\Logging`

Внутри должны лежать `Log_2026-10-19_11-37-28.txt` и такие же. Не `spawn-30d-discord.txt`.

Путь можно сменить внизу экрана («папка Logging» → «прочитать») или в `data/settings.json`.

## Быстрый старт

1. `cd F:\cursor-projects\vpp-spawn-audit`
2. `pnpm install`
3. `pnpm catalog` — один раз, каталог имён и запрета (нужен интернет)
4. `pnpm seed` — один раз, список админов из текущих логов
5. `pnpm dev` — UI: http://127.0.0.1:5273/

## Проверка

`pnpm test`

## Сайт на Vercel

Vercel не видит папку на диске. Перед выкладкой на этой машине собирается снимок логов в `public/snapshot.json`, затем заливается статика.

```bash
cd F:\cursor-projects\vpp-spawn-audit
pnpm build
npx vercel deploy dist --prebuilt --prod --yes
```

Ссылка будет публичной: ники и SteamID из журнала увидит любой, у кого есть URL. В Vercel можно включить Deployment Protection (пароль).
Чтобы обновить сайт после новых логов — снова `pnpm build` и деплой.
