export type SpawnKind = 'on-self' | 'on-player' | 'preset' | 'other';

/** Группы событий для кнопок-фильтров в UI */
export type LogCategory =
  | 'spawn'
  | 'teleport'
  | 'stats'
  | 'cheats'
  | 'delete'
  | 'build'
  | 'presets'
  | 'moderation';

export const LOG_CATEGORIES: LogCategory[] = [
  'spawn',
  'teleport',
  'stats',
  'cheats',
  'delete',
  'build',
  'presets',
  'moderation',
];

export const CATEGORY_LABELS: Record<LogCategory, string> = {
  spawn: 'Спавн',
  teleport: 'Перемещения',
  stats: 'Статы',
  cheats: 'God / Freecam',
  delete: 'Удаления',
  build: 'Постройки',
  presets: 'Пресеты',
  moderation: 'Модерация',
};

export type SpawnEvent = {
  at: string;
  nick: string;
  steamId: string;
  kind: SpawnKind;
  /** Старые снимки без поля → считаем spawn */
  category?: LogCategory;
  /** Короткое действие для колонки «действие» */
  action?: string;
  item: string;
  target?: string;
};

export type DeleteEvent = {
  at: string;
  nick: string;
  steamId: string;
  item: string;
};

export type DeleteNote = {
  at: string;
  byNick: string;
  bySteamId: string;
  samePerson: boolean;
};

export type ItemInfo = {
  name: string;
  forbidden: boolean;
};

export type ItemCatalog = Record<string, ItemInfo>;

export type AdminRecord = {
  steamId: string;
  nick: string;
  displayName?: string;
};

export type EnrichedEvent = SpawnEvent & {
  category: LogCategory;
  action: string;
  name: string;
  label: string;
  forbidden: boolean;
  unknown: boolean;
  count: number;
  deleted?: DeleteNote;
  /** Координаты телепорта (округлённые) */
  coords?: string;
  /** Название зоны или null если вне всех */
  zoneName?: string | null;
  /** Ближайшая зона, если точка вне всех квадратов */
  nearestZone?: string | null;
  /** Дистанция до ближайшей зоны, м */
  nearestMeters?: number | null;
  /** Текст зоны для UI / экспорта */
  zoneLabel?: string;
};

export type Settings = {
  logDir: string;
  userGroupsPath: string;
  utcOffsetHours: number;
};

export function eventCategory(ev: Pick<SpawnEvent, 'category' | 'kind'>): LogCategory {
  if (ev.category) return ev.category;
  return 'spawn';
}
