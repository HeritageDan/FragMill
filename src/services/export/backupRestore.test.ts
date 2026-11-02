import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../db';
import { exportProjectBackupJson, importProjectBackupJson } from './index';

describe('Backup Export & Import Compatibility (FraGeo Suite)', () => {
  let storedProjects: any[] = [];
  let storedSites: any[] = [];
  let storedBlasts: any[] = [];
  let storedImages: any[] = [];
  let storedRuns: any[] = [];
  let storedGroundTruths: any[] = [];
  let storedMillBatches: any[] = [];

  beforeEach(() => {
    storedProjects = [];
    storedSites = [];
    storedBlasts = [];
    storedImages = [];
    storedRuns = [];
    storedGroundTruths = [];
    storedMillBatches = [];

    (vi.spyOn(db, 'transaction') as any).mockImplementation(async (...args: any[]) => {
      const fn = args[args.length - 1];
      return fn();
    });

    (vi.spyOn(db.projects, 'get') as any).mockImplementation(async (id: any) =>
      storedProjects.find((p) => p.id === id)
    );
    (vi.spyOn(db.projects, 'put') as any).mockImplementation(async (item: any) => {
      storedProjects.push(item);
      return item.id;
    });

    (vi.spyOn(db.sites, 'where') as any).mockImplementation((field: string) => ({
      equals: (val: any) => ({
        toArray: async () => storedSites.filter((s) => s[field] === val),
      }),
    }));
    (vi.spyOn(db.sites, 'put') as any).mockImplementation(async (item: any) => {
      storedSites.push(item);
      return item.id;
    });

    (vi.spyOn(db.blasts, 'where') as any).mockImplementation((field: string) => ({
      equals: (val: any) => ({
        toArray: async () => storedBlasts.filter((b) => b[field] === val),
      }),
    }));
    (vi.spyOn(db.blasts, 'put') as any).mockImplementation(async (item: any) => {
      storedBlasts.push(item);
      return item.id;
    });

    (vi.spyOn(db.images, 'where') as any).mockImplementation((field: string) => ({
      anyOf: (vals: any[]) => ({
        toArray: async () => storedImages.filter((img) => vals.includes(img[field])),
      }),
    }));
    (vi.spyOn(db.images, 'put') as any).mockImplementation(async (item: any) => {
      storedImages.push(item);
      return item.id;
    });

    (vi.spyOn(db.segmentationRuns, 'where') as any).mockImplementation((field: string) => ({
      anyOf: (vals: any[]) => ({
        toArray: async () => storedRuns.filter((r) => vals.includes(r[field])),
      }),
    }));
    (vi.spyOn(db.segmentationRuns, 'put') as any).mockImplementation(async (item: any) => {
      storedRuns.push(item);
      return item.id;
    });

    (vi.spyOn(db.groundTruths, 'where') as any).mockImplementation((field: string) => ({
      anyOf: (vals: any[]) => ({
        toArray: async () => storedGroundTruths.filter((gt) => vals.includes(gt[field])),
      }),
    }));
    (vi.spyOn(db.groundTruths, 'put') as any).mockImplementation(async (item: any) => {
      storedGroundTruths.push(item);
      return item.id;
    });

    (vi.spyOn(db.millBatches, 'where') as any).mockImplementation((field: string) => ({
      anyOf: (vals: any[]) => ({
        toArray: async () => storedMillBatches.filter((mb) => vals.includes(mb[field])),
      }),
    }));
    (vi.spyOn(db.millBatches, 'put') as any).mockImplementation(async (item: any) => {
      storedMillBatches.push(item);
      return item.id;
    });
  });

  it('exports modern backup containing frageo metadata', async () => {
    storedProjects.push({
      id: 'proj-001',
      name: 'Alpha Mine',
      description: 'Open pit',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    });

    const json = await exportProjectBackupJson('proj-001');
    const parsed = JSON.parse(json);

    expect(parsed.app).toBe('frageo');
    expect(parsed.suite).toBe('FraGeo Suite');
    expect(parsed.project.id).toBe('proj-001');
    expect(parsed.project.name).toBe('Alpha Mine');
  });

  it('successfully imports legacy backup created by old FragMill', async () => {
    const legacyBackup = {
      app: 'fragmill',
      version: '1.0',
      exportDate: '2026-03-01T12:00:00.000Z',
      project: {
        id: 'proj-legacy-1',
        name: 'Legacy FragMill Gold Pit',
        description: 'Old format backup',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
      sites: [
        {
          id: 'site-legacy-1',
          projectId: 'proj-legacy-1',
          name: 'Main Quarry',
          locationText: 'Central Sector',
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      blasts: [
        {
          id: 'blast-legacy-1',
          projectId: 'proj-legacy-1',
          siteId: 'site-legacy-1',
          blastId: 'BL-LEGACY-01',
          dateTime: '2026-03-01T08:00',
          parameters: { benchHeight: 10, holeDiameter: 89, holeDepth: 11, burden: 3, spacing: 3.5, chargePerHole: 30, explosiveType: 'ANFO' },
          rockMass: { rockType: 'Granite', density: 2.7 },
        },
      ],
      images: [],
      segmentationRuns: [],
      groundTruths: [],
      millBatches: [],
    };

    const res = await importProjectBackupJson(JSON.stringify(legacyBackup));
    expect(res).toBe('proj-legacy-1');

    // Verify stored in DB
    expect(storedProjects.length).toBe(1);
    expect(storedProjects[0].name).toBe('Legacy FragMill Gold Pit');
    expect(storedSites.length).toBe(1);
    expect(storedSites[0].name).toBe('Main Quarry');
    expect(storedBlasts.length).toBe(1);
    expect(storedBlasts[0].blastId).toBe('BL-LEGACY-01');
  });

  it('successfully imports modern FraGeo Suite backup', async () => {
    const modernBackup = {
      app: 'frageo',
      suite: 'FraGeo Suite',
      version: '1.0',
      exportDate: new Date().toISOString(),
      project: {
        id: 'proj-frageo-1',
        name: 'FraGeo Project Alpha',
        description: 'Modern suite format',
        createdAt: 1770000000000,
        updatedAt: 1770000000000,
      },
      sites: [],
      blasts: [],
      images: [],
      segmentationRuns: [],
      groundTruths: [],
      millBatches: [],
    };

    const res = await importProjectBackupJson(JSON.stringify(modernBackup));
    expect(res).toBe('proj-frageo-1');
    expect(storedProjects.some((p) => p.id === 'proj-frageo-1')).toBe(true);
  });

  it('rejects backup with unsupported origin', async () => {
    const invalidBackup = {
      app: 'unrecognized-foreign-app',
      project: { id: 'p1', name: 'Unknown' },
    };

    await expect(importProjectBackupJson(JSON.stringify(invalidBackup))).rejects.toThrow(
      'Unsupported application backup origin'
    );
  });
});
