import { describe, it, expect, beforeEach } from 'vitest';
import { getAvailableSectionKeys, REPORT_SECTIONS_REGISTRY } from '../types/reportVault';
import { sanitiseVaultState, INITIAL_STATE } from '../context/ReportVaultContext';

const storageMock: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  },
};

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
}

describe('Report Vault Counter & Multi-Blast Segregation (Part A)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('drops legacy keys (kriging, telemetry) on load', () => {
    const rawLegacyState = {
      blast: {
        blastId: 'BL-2026-001',
        key: 'blast',
        stagedAt: 1000,
        titleFr: 'Tir',
        titleEn: 'Blast',
        payload: { burdenM: 2.5 },
      },
      kriging: {
        blastId: 'BL-2026-001',
        key: 'kriging',
        stagedAt: 1000,
        payload: {},
      },
      telemetry: {
        blastId: 'BL-2026-001',
        key: 'telemetry',
        stagedAt: 1000,
        payload: {},
      },
    };

    const sanitised = sanitiseVaultState(rawLegacyState);

    expect(sanitised.blast).not.toBeNull();
    expect(sanitised.blast?.blastId).toBe('BL-2026-001');
    expect((sanitised as any).kriging).toBeUndefined();
    expect((sanitised as any).telemetry).toBeUndefined();
  });

  it('drops entries that lack a valid blastId (legacy format)', () => {
    const rawStateWithoutBlastId = {
      blast: {
        key: 'blast',
        stagedAt: 1000,
        payload: { p80: 250 },
      },
      validation: {
        blastId: '', // Empty string
        key: 'validation',
        stagedAt: 1000,
        payload: {},
      },
      kuzram: {
        blastId: 'BL-2026-001',
        key: 'kuzram',
        stagedAt: 1000,
        payload: { x50: 120 },
      },
    };

    const sanitised = sanitiseVaultState(rawStateWithoutBlastId);

    // blast had no blastId -> dropped (null)
    expect(sanitised.blast).toBeNull();
    // validation had empty blastId -> dropped (null)
    expect(sanitised.validation).toBeNull();
    // kuzram had valid blastId -> preserved
    expect(sanitised.kuzram).not.toBeNull();
    expect(sanitised.kuzram?.blastId).toBe('BL-2026-001');
  });

  it('denominator excludes experimental sections by default and changes with setting', () => {
    const defaultAvailable = getAvailableSectionKeys(false);
    expect(defaultAvailable.length).toBe(7);
    expect(defaultAvailable).not.toContain('drone3d');
    expect(defaultAvailable).not.toContain('beltvision');

    const withExperimental = getAvailableSectionKeys(true);
    expect(withExperimental.length).toBe(9);
    expect(withExperimental).toContain('drone3d');
    expect(withExperimental).toContain('beltvision');
  });

  it('count never exceeds the total available sections', () => {
    // Fill all 9 sections in state
    const allState = { ...INITIAL_STATE };
    const allKeys = Object.keys(REPORT_SECTIONS_REGISTRY) as (keyof typeof REPORT_SECTIONS_REGISTRY)[];
    allKeys.forEach((key) => {
      allState[key] = {
        blastId: 'BL-001',
        key,
        stagedAt: Date.now(),
        titleFr: 'T',
        titleEn: 'T',
        payload: {},
      };
    });

    // When experimental is OFF: count must be 7 (never 9 or 11)
    const availableOff = getAvailableSectionKeys(false);
    const countOff = availableOff.filter((k) => allState[k]?.blastId === 'BL-001').length;
    expect(countOff).toBe(7);
    expect(countOff).toBeLessThanOrEqual(availableOff.length);

    // When experimental is ON: count must be 9
    const availableOn = getAvailableSectionKeys(true);
    const countOn = availableOn.filter((k) => allState[k]?.blastId === 'BL-001').length;
    expect(countOn).toBe(9);
    expect(countOn).toBeLessThanOrEqual(availableOn.length);
  });

  it('entries from another blast are not counted in stagedCount', () => {
    const multiBlastState = { ...INITIAL_STATE };
    multiBlastState.blast = {
      blastId: 'BL-001',
      key: 'blast',
      stagedAt: Date.now(),
      titleFr: 'Tir',
      titleEn: 'Blast',
      payload: {},
    };
    multiBlastState.timing = {
      blastId: 'BL-002', // Belongs to a different blast!
      key: 'timing',
      stagedAt: Date.now(),
      titleFr: 'Séquence',
      titleEn: 'Timing',
      payload: {},
    };

    const available = getAvailableSectionKeys(false);

    // For BL-001: only `blast` should be counted, timing should be ignored
    const countForBL1 = available.filter((k) => multiBlastState[k]?.blastId === 'BL-001').length;
    expect(countForBL1).toBe(1);

    // For BL-002: only `timing` should be counted, blast should be ignored
    const countForBL2 = available.filter((k) => multiBlastState[k]?.blastId === 'BL-002').length;
    expect(countForBL2).toBe(1);

    // For BL-003: no entries exist
    const countForBL3 = available.filter((k) => multiBlastState[k]?.blastId === 'BL-003').length;
    expect(countForBL3).toBe(0);
  });

  it('switching blast changes the count accurately', () => {
    const state = { ...INITIAL_STATE };
    state.blast = { blastId: 'BL-001', key: 'blast', stagedAt: 1, titleFr: 'T', titleEn: 'T', payload: {} };
    state.kuzram = { blastId: 'BL-001', key: 'kuzram', stagedAt: 1, titleFr: 'T', titleEn: 'T', payload: {} };
    state.validation = { blastId: 'BL-002', key: 'validation', stagedAt: 1, titleFr: 'T', titleEn: 'T', payload: {} };

    const getCountFor = (blastId: string, showExp: boolean = false) => {
      const available = getAvailableSectionKeys(showExp);
      return available.filter((k) => state[k]?.blastId === blastId).length;
    };

    expect(getCountFor('BL-001')).toBe(2);
    expect(getCountFor('BL-002')).toBe(1);
    expect(getCountFor('BL-003')).toBe(0);
  });
});
