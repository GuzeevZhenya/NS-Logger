/** Правило: точное имя или префикс (MF_Artefact → MF_Artefact_Ribka). */
export function matchesForbiddenRule(item: string, rule: string): boolean {
  const id = item.trim();
  const r = rule.trim();
  if (!id || !r) return false;
  if (id === r) return true;
  if (r.endsWith('_')) return id.startsWith(r);
  return id.startsWith(`${r}_`) || id.startsWith(r);
}

export function itemMatchesForbidden(item: string, extra: readonly string[]): boolean {
  for (const rule of extra) {
    if (matchesForbiddenRule(item, rule)) return true;
  }
  return false;
}

export function isSpawnForbidden(
  item: string,
  catalog: Record<string, { forbidden?: boolean }>,
  extra: readonly string[],
): boolean {
  if (catalog[item]?.forbidden) return true;
  return itemMatchesForbidden(item, extra);
}
