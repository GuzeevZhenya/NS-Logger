import { describe, expect, it } from 'vitest';
import {
  describeTeleportPos,
  orderedRing,
  parsePos,
  pointInPolygon,
  resolveZone,
  MAP_ZONES,
} from './zones.js';

describe('zones', () => {
  it('parses pos string', () => {
    expect(parsePos('8525.950195, 133.573090, 7248.582031')).toEqual({
      x: 8525.950195,
      y: 133.57309,
      z: 7248.582031,
    });
  });

  it('detects point inside База долга', () => {
    const zone = MAP_ZONES.find((z) => z.name === 'База долга')!;
    const ring = orderedRing(zone.corners);
    // центр примерно
    const cx = zone.corners.reduce((s, c) => s + c.x, 0) / 4;
    const cz = zone.corners.reduce((s, c) => s + c.z, 0) / 4;
    expect(pointInPolygon(cx, cz, ring)).toBe(true);
    const hit = resolveZone(cx, cz);
    expect(hit.inside).toBe(true);
    if (hit.inside) expect(hit.name).toBe('База долга');
  });

  it('detects point inside Деребас', () => {
    const hit = resolveZone(4625, 1815);
    expect(hit.inside).toBe(true);
    if (hit.inside) expect(hit.name).toBe('Деребас');
  });

  it('outside point suggests nearest zone', () => {
    // далеко на юг от карты
    const hit = resolveZone(100, 100);
    expect(hit.inside).toBe(false);
    if (!hit.inside) {
      expect(hit.nearest).toBeTruthy();
      expect(hit.distance).toBeGreaterThan(0);
    }
  });

  it('describeTeleportPos formats label', () => {
    const inside = describeTeleportPos('4625.0, 76.0, 1815.0');
    expect(inside?.zoneName).toBe('Деребас');
    expect(inside?.coords).toContain('4625');

    const outside = describeTeleportPos('100.0, 50.0, 100.0');
    expect(outside?.zoneName).toBeNull();
    expect(outside?.zoneLabel).toMatch(/точка не зарегистрирована/);
    expect(outside?.nearest).toBeTruthy();
  });

  it('resolves space-separated player coords to a named place', () => {
    const freedom = describeTeleportPos('7713 117 4943');
    expect(freedom?.zoneName).toBe('База свободы');

    const dumpish = describeTeleportPos('5200 150 4500');
    expect(dumpish?.zoneName).toBe('Свалка');
  });
});
