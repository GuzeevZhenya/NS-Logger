import type { EnrichedEvent } from './types.js';

function kindDetails(ev: EnrichedEvent): string {
  if (ev.category === 'spawn') {
    if (ev.kind === 'preset') return `[ItemManager] Spawn preset: ${ev.item}`;
    if (ev.kind === 'on-player') {
      return `[ItemManager] spawn object on ${ev.target}. item: ${ev.label}`;
    }
    return `[ItemManager] spawn object on self. item: ${ev.label}`;
  }
  const who = ev.target ? ` → ${ev.target}` : '';
  if (ev.category === 'teleport' && ev.coords) {
    const place = ev.zoneLabel || ev.zoneName || '';
    return `[teleport] ${ev.action}: ${ev.coords}${place ? ` (${place})` : ''}${who}`;
  }
  return `[${ev.category}] ${ev.action}: ${ev.label}${who}`;
}

function stamp(iso: string): string {
  return iso.replace('T', ' ');
}

export function toDiscordLines(events: EnrichedEvent[]): string {
  return events
    .map((ev) => {
      const times = ev.count > 1 ? ` ×${ev.count}` : '';
      const gone = ev.deleted
        ? ev.deleted.samePerson
          ? ' — предмет был удалён'
          : ` — удалён кем-то: ${ev.deleted.byNick}`
        : '';
      return `${stamp(ev.at)} | Admin Activity: ${ev.nick} Details: ${kindDetails(ev)}${times}${gone}`;
    })
    .join('\n');
}
