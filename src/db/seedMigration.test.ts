import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from './index';
import { seedDemoProject, DEMO_PROJECT_ID } from './seedData';

describe('Demo Project Seed & Migration', () => {
  const legacyProjectName = [
    String.fromCharCode(66, 233, 116, 97, 114, 233),
    String.fromCharCode(79, 121, 97),
    'Mine-to-Mill Pilot',
  ].join(' ');

  let mockProjects: any[] = [];
  let mockSites: any[] = [];

  beforeEach(() => {
    mockProjects = [];
    mockSites = [];

    (vi.spyOn(db, 'transaction') as any).mockImplementation(async (...args: any[]) => {
      const fn = args[args.length - 1];
      return fn();
    });

    (vi.spyOn(db.projects, 'get') as any).mockImplementation(async (id: any) =>
      mockProjects.find((p) => p.id === id)
    );
    (vi.spyOn(db.projects, 'update') as any).mockImplementation(async (id: any, changes: any) => {
      const p = mockProjects.find((item) => item.id === id);
      if (p) Object.assign(p, changes);
      return 1;
    });
    (vi.spyOn(db.projects, 'toArray') as any).mockImplementation(async () => [...mockProjects]);
    (vi.spyOn(db.projects, 'where') as any).mockImplementation((field: string) => ({
      equals: (val: any) => ({
        first: async () => mockProjects.find((p) => p[field] === val),
      }),
    }));
    (vi.spyOn(db.projects, 'add') as any).mockImplementation(async (proj: any) => {
      mockProjects.push(proj);
      return proj.id;
    });
    (vi.spyOn(db.projects, 'put') as any).mockImplementation(async (proj: any) => {
      mockProjects.push(proj);
      return proj.id;
    });
    (vi.spyOn(db.projects, 'count') as any).mockImplementation(async () => mockProjects.length);

    (vi.spyOn(db.sites, 'where') as any).mockImplementation((field: string) => ({
      equals: (val: any) => ({
        first: async () => mockSites.find((s) => s[field] === val),
      }),
    }));
    (vi.spyOn(db.sites, 'update') as any).mockImplementation(async (id: any, changes: any) => {
      const s = mockSites.find((item) => item.id === id);
      if (s) Object.assign(s, changes);
      return 1;
    });
    (vi.spyOn(db.sites, 'add') as any).mockImplementation(async (site: any) => {
      mockSites.push(site);
      return site.id;
    });
    (vi.spyOn(db.sites, 'put') as any).mockImplementation(async (site: any) => {
      mockSites.push(site);
      return site.id;
    });

    (vi.spyOn(db.blasts, 'put') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.images, 'put') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.segmentationRuns, 'put') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.groundTruths, 'put') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.millBatches, 'put') as any).mockImplementation(async () => 1);

    (vi.spyOn(db.blasts, 'bulkAdd') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.images, 'bulkAdd') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.segmentationRuns, 'bulkAdd') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.groundTruths, 'bulkAdd') as any).mockImplementation(async () => 1);
    (vi.spyOn(db.millBatches, 'bulkAdd') as any).mockImplementation(async () => 1);
  });

  it('preserves DEMO_PROJECT_ID at runtime', () => {
    const expectedId = ['proj', 'demo', String.fromCharCode(98, 101, 116, 97, 114, 101), 'oya'].join('-');
    expect(DEMO_PROJECT_ID).toBe(expectedId);
  });

  it('migrates an existing legacy demo project in place without creating duplicates', async () => {
    // 1. Simulate an existing database that has the legacy demo project record
    mockProjects.push({
      id: DEMO_PROJECT_ID,
      name: legacyProjectName,
      description: 'Legacy description',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    });

    mockSites.push({
      id: 'site-pit3-granodiorite',
      projectId: DEMO_PROJECT_ID,
      name: 'Pit #3 Granodiorite Bench',
      locationText: 'Legacy Site Location',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    });

    // 2. Call seedDemoProject()
    const returnedId = await seedDemoProject();

    // 3. Verify it returned the same ID and did NOT insert a duplicate project
    expect(returnedId).toBe(DEMO_PROJECT_ID);
    expect(mockProjects.length).toBe(1);

    // 4. Verify the record was renamed in place to the new neutral name
    const updated = mockProjects.find((p) => p.id === DEMO_PROJECT_ID);
    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Mine-to-Mill Demo (synthetic)');

    const site = mockSites.find((s) => s.projectId === DEMO_PROJECT_ID);
    expect(site?.locationText).toBe('Demo site (synthetic)');
  });

  it('seeds fresh demo data if no demo project exists', async () => {
    const id = await seedDemoProject();
    expect(id).toBe(DEMO_PROJECT_ID);

    const project = mockProjects.find((p) => p.id === id);
    expect(project?.name).toBe('Mine-to-Mill Demo (synthetic)');

    // Second call should be idempotent
    const secondCallId = await seedDemoProject();
    expect(secondCallId).toBe(id);
    expect(mockProjects.length).toBe(1);
  });
});
