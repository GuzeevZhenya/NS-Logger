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
  | 'moderation'
  | 'trade'
  | 'inventory'
  | 'doors'
  | 'vehicle'
  | 'session'
  | 'world'
  | 'loot';

export const LOG_CATEGORIES: LogCategory[] = [
  'spawn',
  'teleport',
  'stats',
  'cheats',
  'delete',
  'build',
  'presets',
  'moderation',
  'trade',
  'inventory',
  'doors',
  'vehicle',
  'session',
  'world',
  'loot',
];

export const CATEGORY_LABELS: Record<LogCategory, string> = {
  spawn: 'Спавн',
  teleport: 'Телепорты',
  stats: 'Статы',
  cheats: 'God / Freecam',
  delete: 'Удаления',
  build: 'Постройки',
  presets: 'Пресеты',
  moderation: 'Модерация',
  trade: 'Покупки / банк',
  inventory: 'Инвентарь',
  doors: 'Двери / ворота',
  vehicle: 'Машины',
  session: 'Вход / выход',
  world: 'Мир / прочее',
  loot: 'Артефакты / тайники',
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
  /** Координаты (трейдер / телепорт), если уже известны из строки */
  coords?: string;
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

/** Кто пользовался VPP: спавн, телепорт, статы, god/freecam, удаление и т.д. */
export const ADMIN_CATEGORIES: LogCategory[] = [
  'spawn',
  'teleport',
  'stats',
  'cheats',
  'delete',
  'build',
  'presets',
  'moderation',
];

/** Игровые логи ModernLogger */
export const PLAYER_CATEGORIES: LogCategory[] = [
  'trade',
  'inventory',
  'doors',
  'vehicle',
  'session',
  'world',
  'loot',
];

export type Audience = 'admins' | 'players' | 'both';

export function isAdminCategory(cat: LogCategory): boolean {
  return (ADMIN_CATEGORIES as string[]).includes(cat);
}

export function isPlayerCategory(cat: LogCategory): boolean {
  return (PLAYER_CATEGORIES as string[]).includes(cat);
}

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
  /** Корень ModernLogger: папки Day_DD-MM-YYYY и/или NN с *.log */
  playerLogDir?: string;
  userGroupsPath: string;
  utcOffsetHours: number;
};

export function eventCategory(ev: Pick<SpawnEvent, 'category' | 'kind'>): LogCategory {
  if (ev.category) return ev.category;
  return 'spawn';
}
