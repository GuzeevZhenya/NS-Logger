---
name: pr
description: >-
  Открывает pull request в main по GitHub Flow. Use when the user asks for a
  PR, pull request, or to publish the branch.
---

# Pull request

1. Текущая ветка не `main`. Если сейчас `main` — сначала `feature/*`.
2. `git diff main...HEAD` и `git log main..HEAD --oneline`.
3. Запушить ветку с `-u`, если её нет на remote.
4. `gh pr create` в `main`. Заголовок — Conventional Commits. Тело: что сделано, как проверить.
5. Вернуть URL.

Без force-push. Без `Co-authored-by`.
