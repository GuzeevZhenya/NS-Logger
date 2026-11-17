# Каталог предметов

Таблица: `https://docs.google.com/spreadsheets/d/1gBh9Z-02lYCUFdCRUX_U9Q7Kx5WaLCa3468FfFD5-B0`

На каждом тематическом листе колонки «Название», «ID предмета», «Применение». Запрет — если «Применение» содержит `Запрет`.

Скрипт `scripts/refresh-catalog.mjs` качает CSV всех листов (кроме Сводный/Фото) и пишет `data/items.json`:

```json
{ "CarTent": { "name": "Автомобильная палатка", "forbidden": true } }
```

Локальный оверрайд: `data/forbidden-extra.json` — массив класснеймов.
