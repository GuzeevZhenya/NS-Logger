---
name: prd
description: >-
  Пишет PRD в docs/prd перед крупной фичей. Use when the feature spans several
  layers, several sessions, or the user asks for requirements before code.
---

# PRD

Файл: `docs/prd/<english-kebab>.md`.

Если вводных мало — сначала вопросы, потом файл.

Разделы:

- Название, дата, статус draft
- Цель: 1–2 предложения, зачем пользователю
- Сценарии: кто → действие → результат
- В скоупе / не в скоупе
- Ограничения, которые уже известны
- Критерии готовности, которые можно проверить

Не писать библиотеки, схему БД и шаги реализации.
