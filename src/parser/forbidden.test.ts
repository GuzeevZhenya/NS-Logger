import { describe, expect, it } from 'vitest';
import { isSpawnForbidden, matchesForbiddenRule } from './forbidden.js';

describe('forbidden rules', () => {
  it('matches artefact prefix', () => {
    expect(matchesForbiddenRule('MF_Artefact_Ribka', 'MF_Artefact')).toBe(true);
    expect(matchesForbiddenRule('MF_Detector_Veles', 'MF_Artefact')).toBe(false);
  });

  it('marks spawn forbidden from extra prefixes', () => {
    expect(isSpawnForbidden('MF_Artefact_Ribka', {}, ['MF_Artefact'])).toBe(true);
    expect(isSpawnForbidden('Boat_01_skin', {}, ['Boat_01'])).toBe(true);
    expect(isSpawnForbidden('Apple', {}, ['MF_Artefact'])).toBe(false);
    expect(isSpawnForbidden('CarTent', { CarTent: { forbidden: true } }, [])).toBe(true);
  });
});
