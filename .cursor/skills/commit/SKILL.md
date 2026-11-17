---
name: commit
description: >-
  Создаёт git-коммит по Conventional Commits с описанием на русском. Use when
  the user asks to commit, make a commit, or зафиксировать изменения.
---

# Коммит

Только если пользователь явно просит коммит.

1. `git status` и `git diff` (staged и unstaged).
2. Тип: feat, fix, docs, refactor, test, ci. Scope — область изменений.
3. Описание на русском, коротко, почему изменение нужно.
4. В индекс только нужные файлы. Не `git add .`. Не секреты, не `.env`.
5. Коммит через сообщение в heredoc. Без `Co-authored-by`, без `--no-verify`, без `--amend`.
6. `git status` после коммита.

Не пушить, пока отдельно не попросили.
