import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { db, FragMillDatabase } from '../../db';
import {
  createStudyReport,
  createNewStudyRevision,
  updateStudyReport,
  changeStudyStatus,
  addStudyPhoto,
  exportStudyPackageZip,
  compressStudyPhoto,
} from './index';
import type {
  StudyReport,
  StudyPhoto,
  GeoLabProject,
  GeoLabClient,
  GeoLabAnalysis,
  GeoLabSample,
} from '../../types/geolab';
import type { ProctorResults } from '../tests/proctor';

describe('FraGeo Lab Studies Engine - Stage 2', () => {
  let mockStudyReports: StudyReport[] = [];
  let mockStudyPhotos: StudyPhoto[] = [];
  let mockProjects: GeoLabProject[] = [];
  let mockClients: GeoLabClient[] = [];
  let mockSamples: GeoLabSample[] = [];
  let mockAnalyses: GeoLabAnalysis[] = [];

  beforeEach(() => {
    mockStudyReports = [];
    mockStudyPhotos = [];
    mockProjects = [
      {
        id: 'proj-stage2-01',
        clientId: 'cli-stage2-01',
        projectName: 'Projet Route Nationale RN1',
        programmeTitle: 'Programme de Modernisation des Infrastructures',
        lotSection: 'Lot 1 - Terrassements et Chaussée',
        contractNumber: 'CT-RN1-2026-001',
        financingText: 'Budget d’Investissement Public',
        siteLocation: 'Zone PK 12+000',
        referenceNumber: 'REF-RN1-2026',
        startDate: '2026-03-01',
        isArchived: false,
        createdAt: '2026-03-01T08:00:00Z',
        updatedAt: '2026-03-01T08:00:00Z',
      },
    ];
    mockClients = [
      {
        id: 'cli-stage2-01',
        companyName: 'BTP Travaux & Ouvrages',
        contactPerson: 'M. Jean Nguema',
        email: 'direction@btp-ouvrages.cm',
        phone: '+237 699 00 11 22',
        address: 'Rue de l’Aéroport, Douala',
        city: 'Douala',
        country: 'Cameroun',
        isArchived: false,
        createdAt: '2026-03-01T08:00:00Z',
        updatedAt: '2026-03-01T08:00:00Z',
      },
    ];

    const sample1: GeoLabSample = {
      id: 'samp-stage2-01',
      projectId: 'proj-stage2-01',
      sampleId: 'ECH-RN1-01',
      samplingDate: '2026-03-02',
      materialType: 'Graveleux latéritique',
      depth: '0.00 - 1.20 m',
      createdAt: '2026-03-02T08:00:00Z',
      updatedAt: '2026-03-02T08:00:00Z',
    };
    mockSamples = [sample1];

    const proctorData: ProctorResults = {
      opmMoisturePercent: 9.8,
      maxDryDensityGcm3: 2.19,
      targetDryDensityGcm3: 2.08,
      points: [
        { pointIndex: 1, waterContentPercent: 6.2, wetDensityGcm3: 2.18, dryDensityGcm3: 2.05, saturationWaterContentPercent: 18.2, compactionPercentOfOpm: 93.6 },
        { pointIndex: 2, waterContentPercent: 8.1, wetDensityGcm3: 2.32, dryDensityGcm3: 2.15, saturationWaterContentPercent: 15.5, compactionPercentOfOpm: 98.2 },
        { pointIndex: 3, waterContentPercent: 9.8, wetDensityGcm3: 2.40, dryDensityGcm3: 2.19, saturationWaterContentPercent: 13.8, compactionPercentOfOpm: 100.0 },
        { pointIndex: 4, waterContentPercent: 11.5, wetDensityGcm3: 2.37, dryDensityGcm3: 2.13, saturationWaterContentPercent: 15.2, compactionPercentOfOpm: 97.3 },
      ],
      saturationCurve: [
        { dryDensityGcm3: 1.8, saturationWaterContentPercent: 19.8 },
        { dryDensityGcm3: 1.9, saturationWaterContentPercent: 17.2 },
        { dryDensityGcm3: 2.0, saturationWaterContentPercent: 14.9 },
        { dryDensityGcm3: 2.1, saturationWaterContentPercent: 12.8 },
      ],
      fittedCoefficients: { a: -0.015, b: 0.294, c: 0.749, r2: 0.99, allCoeffs: [0.749, 0.294, -0.015] },
      fitMethod: 'quadratic',
      isConform: true,
    };

    mockAnalyses = [
      {
        id: 'an-stage2-01',
        sampleId: 'samp-stage2-01',
        testType: 'proctor',
        status: 'approved',
        reportNumber: 'PV-PR-2026-01',
        standard: 'NF P94-093',
        version: 1,
        testedDate: '2026-03-02',
        qualityWarnings: [],
        createdAt: '2026-03-02T10:00:00Z',
        updatedAt: '2026-03-02T10:00:00Z',
        rawInput: {},
        computedResults: proctorData,
      },
    ];

    // Mock db.studyReports
    (vi.spyOn(db.studyReports, 'get') as any).mockImplementation(async (id: any) =>
      mockStudyReports.find((s) => s.id === id)
    );
    (vi.spyOn(db.studyReports, 'put') as any).mockImplementation(async (study: any) => {
      const idx = mockStudyReports.findIndex((s) => s.id === study.id);
      if (idx >= 0) mockStudyReports[idx] = study;
      else mockStudyReports.push(study);
      return study.id;
    });
    (vi.spyOn(db.studyReports, 'delete') as any).mockImplementation(async (id: any) => {
      mockStudyReports = mockStudyReports.filter((s) => s.id !== id);
    });
    (vi.spyOn(db.studyReports, 'toArray') as any).mockImplementation(async () => [...mockStudyReports]);
    (vi.spyOn(db.studyReports, 'count') as any).mockImplementation(async () => mockStudyReports.length);

    // Mock db.studyPhotos
    (vi.spyOn(db.studyPhotos, 'get') as any).mockImplementation(async (id: any) =>
      mockStudyPhotos.find((p) => p.id === id)
    );
    (vi.spyOn(db.studyPhotos, 'put') as any).mockImplementation(async (photo: any) => {
      const idx = mockStudyPhotos.findIndex((p) => p.id === photo.id);
      if (idx >= 0) mockStudyPhotos[idx] = photo;
      else mockStudyPhotos.push(photo);
      return photo.id;
    });
    (vi.spyOn(db.studyPhotos, 'delete') as any).mockImplementation(async (id: any) => {
      mockStudyPhotos = mockStudyPhotos.filter((p) => p.id !== id);
    });
    (vi.spyOn(db.studyPhotos, 'toArray') as any).mockImplementation(async () => [...mockStudyPhotos]);
    (vi.spyOn(db.studyPhotos, 'where') as any).mockImplementation((field: string) => ({
      equals: (val: any) => ({
        toArray: async () => mockStudyPhotos.filter((p: any) => p[field] === val),
        sortBy: async (_sortField: string) =>
          mockStudyPhotos.filter((p: any) => p[field] === val).sort((a, b) => a.order - b.order),
        delete: async () => {
          mockStudyPhotos = mockStudyPhotos.filter((p: any) => p[field] !== val);
        },
      }),
    }));

    // Mock db.geolabProjects
    (vi.spyOn(db.geolabProjects, 'get') as any).mockImplementation(async (id: any) =>
      mockProjects.find((p) => p.id === id)
    );
    (vi.spyOn(db.geolabProjects, 'toArray') as any).mockImplementation(async () => [...mockProjects]);

    // Mock db.clients
    (vi.spyOn(db.clients, 'get') as any).mockImplementation(async (id: any) =>
      mockClients.find((c) => c.id === id)
    );
    (vi.spyOn(db.clients, 'toArray') as any).mockImplementation(async () => [...mockClients]);

    // Mock db.samples
    (vi.spyOn(db.samples, 'toArray') as any).mockImplementation(async () => [...mockSamples]);
    (vi.spyOn(db.samples, 'where') as any).mockImplementation((field: string) => ({
      equals: (val: any) => ({
        toArray: async () => mockSamples.filter((s: any) => s[field] === val),
      }),
    }));

    // Mock db.analyses
    (vi.spyOn(db.analyses, 'toArray') as any).mockImplementation(async () => [...mockAnalyses]);
    (vi.spyOn(db.analyses, 'get') as any).mockImplementation(async (id: any) =>
      mockAnalyses.find((a) => a.id === id)
    );

    // Mock getOrganisationProfile
    (vi.spyOn(db.settings, 'get') as any).mockImplementation(async () => ({
      key: 'org_profile',
      value: {
        companyName: 'Laboratoire Géotechnique Central',
        address: 'B.P. 4022 Yaoundé',
        phone: '+237 222 00 00',
        email: 'labo@central.cm',
        accreditationNumber: 'ACCR-2026-GEO-01',
        primaryColor: '#1e40af',
        approvalChain: [
          { id: '1', roleLabel: { en: 'Tested by', fr: 'Essai réalisé par' }, name: 'Paul Mba', title: 'Technicien' },
          { id: '2', roleLabel: { en: 'Approved by', fr: 'Approuvé par' }, name: 'Dr. Joseph Mengue', title: 'Directeur' },
        ],
      },
    }));
  });

  it('1. Revision snapshotting and revision table row increment', async () => {
    const study = await createStudyReport({
      projectId: 'proj-stage2-01',
      templateId: 'characterisation_soils',
      title: 'Étude Géotechnique Initiale RN1',
      language: 'fr',
      includedAnalysisIds: ['an-stage2-01'],
      authorName: 'Ingénieur Études',
    });

    expect(study.revisions).toHaveLength(1);
    expect(study.revisions[0].index).toBe(0);
    expect(study.revisions[0].nature).toBe('Édition originale');
    expect(study.status).toBe('draft');

    // Update study content
    const updated = await updateStudyReport(study.id, {
      title: 'Étude Géotechnique Complémentaire RN1',
    });
    expect(updated.title).toBe('Étude Géotechnique Complémentaire RN1');

    // Create a new revision
    const revB = await createNewStudyRevision(
      study.id,
      'Prise en compte des essais de portance et Proctor',
      'Ingénieur Géotechnicien',
      'fr'
    );

    expect(revB.revisions).toHaveLength(2);
    expect(revB.revisions[1].index).toBe(1);
    expect(revB.revisions[1].nature).toBe('Prise en compte des essais de portance et Proctor');
    expect(revB.revisions[1].preparedBy).toBe('Ingénieur Géotechnicien');

    // Verify snapshot captured previous title
    expect(revB.revisions[1].snapshot).toBeDefined();
    expect(revB.revisions[1].snapshot.title).toBe('Étude Géotechnique Complémentaire RN1');
    expect(revB.status).toBe('draft');
  });

  it('2. Locked approved study rejects edits without a new revision', async () => {
    const study = await createStudyReport({
      projectId: 'proj-stage2-01',
      templateId: 'characterisation_soils',
      title: 'Étude Géotechnique Verrouillée',
      language: 'fr',
      includedAnalysisIds: ['an-stage2-01'],
    });

    // Change status to approved
    const approvedStudy = await changeStudyStatus(study.id, 'approved', 'fr');
    expect(approvedStudy.status).toBe('approved');

    // Attempting to edit an approved study without a revision must throw
    await expect(
      updateStudyReport(study.id, { title: 'Tentative Modification Non Autorisée' }, 'fr')
    ).rejects.toThrow(/verrouillée|locked/i);

    // Creating a new revision unlocks the study back to draft
    const unlockedStudy = await createNewStudyRevision(
      study.id,
      'Révision suite aux remarques du Maître d’Ouvrage',
      'Chef de Projet',
      'fr'
    );

    expect(unlockedStudy.status).toBe('draft');

    // Now updates are permitted
    const successfullyEdited = await updateStudyReport(
      study.id,
      { title: 'Titre Modifié Autorisé' },
      'fr'
    );
    expect(successfullyEdited.title).toBe('Titre Modifié Autorisé');
  });

  it('3. Photo compression produces valid blobs <= 1600px', async () => {
    // Generate a synthetic test buffer simulating an image
    const syntheticBuffer = Buffer.from('FAKE-PHOTO-DATA-REPRESENTING-A-SITE-SOIL-SAMPLE-IMAGE');
    const result = await compressStudyPhoto(new Blob([syntheticBuffer]));

    expect(result).toBeDefined();
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.height).toBeLessThanOrEqual(1600);
    expect(result.base64).toContain('data:image/jpeg;base64,');
  });

  it('4. Package ZIP contains the expected files (.docx, .pdf, Test_Sheets/*.xlsx, Photos/*.jpg)', async () => {
    const study = await createStudyReport({
      projectId: 'proj-stage2-01',
      templateId: 'characterisation_soils',
      title: 'Étude Géotechnique Route RN1 - Package Test',
      language: 'fr',
      includedAnalysisIds: ['an-stage2-01'],
      reportNumber: 'ETD-2026-PKG',
    });

    // Add 2 photos
    const dummyJpegBase64 =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    await addStudyPhoto(study.id, dummyJpegBase64, 'Prélèvement Puits F1');
    await addStudyPhoto(study.id, dummyJpegBase64, 'Moulage Éprouvette Proctor');

    const progressMessages: string[] = [];
    const { blob, filename } = await exportStudyPackageZip({
      studyId: study.id,
      onProgress: (p) => progressMessages.push(p.message),
    });

    expect(filename).toBe('ETD-2026-PKG_Package.zip');
    expect(blob.size).toBeGreaterThan(500);
    expect(progressMessages.length).toBeGreaterThan(0);

    // Read the zip archive
    const zip = await JSZip.loadAsync(blob);
    const files = Object.keys(zip.files);

    // 1. Root files
    expect(files.some((f) => f.endsWith('.docx'))).toBe(true);
    expect(files.some((f) => f.endsWith('.pdf'))).toBe(true);

    // 2. Test Sheets directory
    expect(files.some((f) => f.startsWith('Test_Sheets/') && f.endsWith('.xlsx'))).toBe(true);

    // 3. Photos directory
    expect(files.some((f) => f.startsWith('Photos/') && (f.endsWith('.jpg') || f.endsWith('.png')))).toBe(true);
  });

  it('5. Dexie migration test: schema v3 preserves existing tables and introduces study tables', () => {
    const freshDb = new FragMillDatabase();

    // Verify v3 tables exist
    expect(freshDb.tables.some((t) => t.name === 'studyReports')).toBe(true);
    expect(freshDb.tables.some((t) => t.name === 'studyPhotos')).toBe(true);

    // Verify v1 & v2 tables are preserved
    expect(freshDb.tables.some((t) => t.name === 'projects')).toBe(true);
    expect(freshDb.tables.some((t) => t.name === 'blasts')).toBe(true);
    expect(freshDb.tables.some((t) => t.name === 'clients')).toBe(true);
    expect(freshDb.tables.some((t) => t.name === 'geolabProjects')).toBe(true);
    expect(freshDb.tables.some((t) => t.name === 'samples')).toBe(true);
    expect(freshDb.tables.some((t) => t.name === 'analyses')).toBe(true);

    // Verify primary keys and schema definitions
    const studyReportsTable = freshDb.table('studyReports');
    expect(studyReportsTable.schema.primKey.name).toBe('id');

    const studyPhotosTable = freshDb.table('studyPhotos');
    expect(studyPhotosTable.schema.primKey.name).toBe('id');
  });
});
