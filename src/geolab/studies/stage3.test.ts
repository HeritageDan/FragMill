import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkStudyConsistency,
  generateStudyAiNarrative,
  buildDocumentModel,
  changeStudyStatus,
} from './index';
import { db } from '../../db';
import type {
  StudyReport,
  GeoLabProject,
  GeoLabClient,
  OrganisationProfile,
  GeoLabAnalysis,
  GeoLabSample,
} from '../../types/geolab';
import type { ProctorResults } from '../tests/proctor';
import type { GrainSizeResults } from '../tests/grainSize';

describe('FraGeo Lab Studies Engine - Stage 3', () => {
  let mockStudy: StudyReport;
  let mockProject: GeoLabProject;
  let mockClient: GeoLabClient;
  let mockOrg: OrganisationProfile;
  let mockSamples: GeoLabSample[];
  let mockAnalyses: GeoLabAnalysis[];

  beforeEach(() => {
    mockOrg = {
      companyName: 'Laboratoire Géotechnique Central',
      address: 'BP 1234, Yaoundé',
      phone: '+237 222 11 22',
      email: 'labo@central.cm',
      accreditationNumber: 'ACCR-2026-01',
      primaryColor: '#1e40af',
      signatories: [],
      approvalChain: [
        { id: '1', roleLabel: { en: 'Tested by', fr: 'Essai par' }, name: 'Paul Mba', title: 'Technicien' },
        { id: '2', roleLabel: { en: 'Approved by', fr: 'Approuvé par' }, name: 'Dr. Joseph Mengue', title: 'Directeur' },
      ],
      reportFooterText: 'FraGeo Suite - FraGeo Lab',
      defaultLanguage: 'fr',
      defaultStandard: 'NF',
    };

    mockProject = {
      id: 'proj-s3-01',
      clientId: 'cli-s3-01',
      projectName: 'Aménagement Carrefour Bassa',
      programmeTitle: 'Programme National d’Infrastructures Routières',
      lotSection: 'Lot 2 - Voiries Urbaines',
      contractNumber: 'CT-2026-BTP-088',
      financingText: 'Financement Budget d’Investissement Public',
      siteLocation: 'Zone PK 4+500',
      referenceNumber: 'REF-2026-088',
      startDate: '2026-02-01',
      isArchived: false,
      createdAt: '2026-02-01T08:00:00Z',
      updatedAt: '2026-02-01T08:00:00Z',
    };

    mockClient = {
      id: 'cli-s3-01',
      companyName: 'Société Générale des Travaux',
      contactPerson: 'M. Jean Nguema',
      email: 'contact@sgt.cm',
      phone: '+237 677 00 11 22',
      address: 'Zone Industrielle',
      city: 'Douala',
      country: 'Cameroun',
      isArchived: false,
      createdAt: '2026-02-01T08:00:00Z',
      updatedAt: '2026-02-01T08:00:00Z',
    };

    const s1: GeoLabSample = {
      id: 'samp-1',
      projectId: mockProject.id,
      sampleId: 'ECH-01',
      materialType: 'Graveleux latéritique',
      samplingDate: '2026-02-05',
      createdAt: '',
      updatedAt: '',
    };
    const s2: GeoLabSample = {
      id: 'samp-2',
      projectId: mockProject.id,
      sampleId: 'ECH-02',
      materialType: 'Sable argileux',
      samplingDate: '2026-02-06',
      createdAt: '',
      updatedAt: '',
    };
    mockSamples = [s1, s2];

    const proctor1: any = {
      opmMoisturePercent: 11.2,
      maxDryDensityGcm3: 2.14,
      targetDryDensityGcm3: 2.03,
      solidDensityMgM3: 2.68,
      points: [
        { pointIndex: 1, waterContentPercent: 7.5, wetDensityGcm3: 2.10, dryDensityGcm3: 1.95, saturationWaterContentPercent: 18.0, compactionPercentOfOpm: 91.1 },
        { pointIndex: 2, waterContentPercent: 9.5, wetDensityGcm3: 2.25, dryDensityGcm3: 2.05, saturationWaterContentPercent: 16.0, compactionPercentOfOpm: 95.8 },
        { pointIndex: 3, waterContentPercent: 11.2, wetDensityGcm3: 2.38, dryDensityGcm3: 2.14, saturationWaterContentPercent: 14.0, compactionPercentOfOpm: 100.0 },
        { pointIndex: 4, waterContentPercent: 13.0, wetDensityGcm3: 2.34, dryDensityGcm3: 2.07, saturationWaterContentPercent: 15.0, compactionPercentOfOpm: 96.7 },
      ],
      saturationCurve: [],
      fittedCoefficients: { a: -0.015, b: 0.336, c: 0.25, r2: 0.99, allCoeffs: [0.25, 0.336, -0.015] },
      fitMethod: 'quadratic',
      isConform: true,
    };

    const grain1: any = {
      totalDryMassG: 3000,
      finesMassG: 450,
      finesPercent: 15.0,
      sandPercent: 38.0,
      gravelPercent: 47.0,
      passing2mmPercent: 53.0,
      passing04mmPercent: 25.0,
      passing008mmPercent: 15.0,
      d10Mm: 0.06,
      d30Mm: 0.40,
      d50Mm: 1.5,
      d60Mm: 2.4,
      cu: 40.0,
      cc: 1.1,
      lcpcClassification: 'B6 (Grave latéritique)',
      rows: [],
    };

    mockAnalyses = [
      {
        id: 'an-1',
        sampleId: 'samp-1',
        testType: 'proctor',
        status: 'approved',
        standard: 'NF P94-093',
        version: 1,
        testedDate: '2026-02-05',
        qualityWarnings: [],
        reportNumber: 'PV-PR-01',
        createdAt: '',
        updatedAt: '',
        rawInput: {},
        computedResults: proctor1,
      },
      {
        id: 'an-2',
        sampleId: 'samp-1',
        testType: 'grain_size',
        status: 'approved',
        standard: 'NF P94-056',
        version: 1,
        testedDate: '2026-02-05',
        qualityWarnings: [],
        reportNumber: 'PV-GR-01',
        createdAt: '',
        updatedAt: '',
        rawInput: {},
        computedResults: grain1,
      },
    ];

    mockStudy = {
      id: 'study-s3-01',
      projectId: mockProject.id,
      title: 'Étude Géotechnique Carrefour Bassa',
      templateId: 'characterisation_soils',
      language: 'fr',
      status: 'draft',
      reportNumber: 'ETD-2026-S3',
      revisions: [{ index: 0, date: '2026-02-10', nature: 'Initiale' }],
      sections: [],
      includedAnalysisIds: ['an-1', 'an-2'],
      createdAt: '2026-02-10T10:00:00Z',
      updatedAt: '2026-02-10T10:00:00Z',
    };
  });

  describe('1. AI Narrative Generator', () => {
    it('generates non-empty deterministic fallback text citing exact numbers in French and English', async () => {
      // 1. French Fallback
      const draftFr = await generateStudyAiNarrative({
        study: mockStudy,
        project: mockProject,
        client: mockClient,
        analyses: mockAnalyses,
        samples: mockSamples,
        language: 'fr',
      });

      expect(draftFr.isAiGenerated).toBe(false);
      expect(draftFr.introduction.length).toBeGreaterThan(50);
      expect(draftFr.materials.length).toBeGreaterThan(50);
      expect(draftFr.discussion.length).toBeGreaterThan(50);
      expect(draftFr.recommendations.length).toBeGreaterThan(50);

      // Verify exact numbers cited
      expect(draftFr.discussion).toContain('11.2'); // w_opt
      expect(draftFr.discussion).toContain('2.14'); // rho_d_max
      expect(draftFr.discussion).toContain('15'); // fines %
      expect(draftFr.discussion).toContain('B6'); // classification

      // 2. English Fallback
      const draftEn = await generateStudyAiNarrative({
        study: mockStudy,
        project: mockProject,
        client: mockClient,
        analyses: mockAnalyses,
        samples: mockSamples,
        language: 'en',
      });

      expect(draftEn.isAiGenerated).toBe(false);
      expect(draftEn.introduction.length).toBeGreaterThan(50);
      expect(draftEn.materials.length).toBeGreaterThan(50);
      expect(draftEn.discussion.length).toBeGreaterThan(50);
      expect(draftEn.recommendations.length).toBeGreaterThan(50);

      expect(draftEn.discussion).toContain('11.2');
      expect(draftEn.discussion).toContain('2.14');
    });

    it('uses Gemini API when apiKey is provided and parses sections properly', async () => {
      const mockApiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    introduction: 'AI drafted geotechnical introduction for project Bassa.',
                    materials: 'AI description of lateritic soil formations.',
                    discussion: 'AI technical analysis: OPM is 11.2% with dry density 2.14 Mg/m3.',
                    recommendations: 'AI recommendation: compact at 95% OPM in 25cm lifts.',
                  }),
                },
              ],
            },
          },
        ],
      };

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      try {
        const draft = await generateStudyAiNarrative({
          study: mockStudy,
          project: mockProject,
          client: mockClient,
          analyses: mockAnalyses,
          samples: mockSamples,
          apiKey: 'fake-gemini-key',
          language: 'fr',
        });

        expect(draft.isAiGenerated).toBe(true);
        expect(draft.introduction).toBe('AI drafted geotechnical introduction for project Bassa.');
        expect(draft.materials).toBe('AI description of lateritic soil formations.');
        expect(draft.discussion).toContain('11.2%');
        expect(draft.recommendations).toContain('25cm lifts');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('2. Consistency & Plausibility Rules (1 to 7)', () => {
    it('Rule 1: Specific Gravity divergence across fractions / samples', () => {
      // Pass: small divergence (std dev <= 0.05)
      const passAnalyses: GeoLabAnalysis[] = [
        { ...mockAnalyses[0], id: 'a1', computedResults: { solidDensityMgM3: 2.68 } },
        { ...mockAnalyses[0], id: 'a2', sampleId: 'samp-2', computedResults: { solidDensityMgM3: 2.70 } },
      ];
      const resPass = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['a1', 'a2'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: passAnalyses,
        samples: mockSamples,
        valueProvenances: { a1: 'measured', a2: 'measured' },
      });
      expect(resPass.findings.some((f) => f.ruleCode === 'DIVERGENT_SPECIFIC_GRAVITY')).toBe(false);

      // Warning: large divergence (std dev > 0.05)
      const failAnalyses: GeoLabAnalysis[] = [
        { ...mockAnalyses[0], id: 'a1', computedResults: { solidDensityMgM3: 2.50 } },
        { ...mockAnalyses[0], id: 'a2', sampleId: 'samp-2', computedResults: { solidDensityMgM3: 2.85 } },
      ];
      const resFail = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['a1', 'a2'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: failAnalyses,
        samples: mockSamples,
        valueProvenances: { a1: 'measured', a2: 'measured' },
      });
      expect(resFail.findings.some((f) => f.ruleCode === 'DIVERGENT_SPECIFIC_GRAVITY')).toBe(true);
      expect(resFail.findings.find((f) => f.ruleCode === 'DIVERGENT_SPECIFIC_GRAVITY')?.severity).toBe('warning');
    });

    it('Rule 2: Water content / Proctor consistency', () => {
      // Pass: |w_n - w_opt| = |11.2 - 12.0| = 0.8% <= 15%
      const passAnalyses: GeoLabAnalysis[] = [
        { ...mockAnalyses[0], id: 'a1', computedResults: { opmMoisturePercent: 11.2 } },
        { ...mockAnalyses[0], id: 'a2', testType: 'water_content', computedResults: { waterContentPercent: 12.0 } },
      ];
      const resPass = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['a1', 'a2'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: passAnalyses,
        samples: mockSamples,
        valueProvenances: { a1: 'measured', a2: 'measured' },
      });
      expect(resPass.findings.some((f) => f.ruleCode === 'PROCTOR_MOISTURE_DIVERGENCE')).toBe(false);

      // Warning: |w_n - w_opt| = |30.0 - 11.2| = 18.8% > 15%
      const failAnalyses: GeoLabAnalysis[] = [
        { ...mockAnalyses[0], id: 'a1', computedResults: { opmMoisturePercent: 11.2 } },
        { ...mockAnalyses[0], id: 'a2', testType: 'water_content', computedResults: { waterContentPercent: 30.0 } },
      ];
      const resFail = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['a1', 'a2'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: failAnalyses,
        samples: mockSamples,
        valueProvenances: { a1: 'measured', a2: 'measured' },
      });
      expect(resFail.findings.some((f) => f.ruleCode === 'PROCTOR_MOISTURE_DIVERGENCE')).toBe(true);
      expect(resFail.findings.find((f) => f.ruleCode === 'PROCTOR_MOISTURE_DIVERGENCE')?.severity).toBe('warning');
    });

    it('Rule 3: Missing provenance tag', () => {
      // Pass: all analyses tagged 'measured'
      const resPass = checkStudyConsistency({
        study: mockStudy,
        project: mockProject,
        organisation: mockOrg,
        analyses: mockAnalyses,
        samples: mockSamples,
        valueProvenances: { 'an-1': 'measured', 'an-2': 'projected' },
      });
      expect(resPass.findings.some((f) => f.ruleCode === 'MISSING_PROVENANCE_TAG')).toBe(false);

      // Warning: tagged 'manual' or missing
      const resFail = checkStudyConsistency({
        study: mockStudy,
        project: mockProject,
        organisation: mockOrg,
        analyses: mockAnalyses,
        samples: mockSamples,
        valueProvenances: { 'an-1': 'manual' }, // an-2 missing
      });
      const provFindings = resFail.findings.filter((f) => f.ruleCode === 'MISSING_PROVENANCE_TAG');
      expect(provFindings).toHaveLength(2);
      expect(provFindings[0].severity).toBe('warning');
    });

    it('Rule 4: Repeated rows / identical values (copy-paste error in lab data)', () => {
      // Error: two distinct samples with identical results
      const duplicateAnalyses: GeoLabAnalysis[] = [
        {
          id: 'an-1',
          sampleId: 'samp-1',
          testType: 'proctor',
          status: 'approved',
          standard: 'NF P94-093',
          version: 1,
          testedDate: '2026-02-05',
          qualityWarnings: [],
          rawInput: {},
          reportNumber: 'PV-01',
          createdAt: '',
          updatedAt: '',
          computedResults: { opm: 10.5, rho: 2.15, uniqueData: [1, 2, 3, 4, 5, 6, 7] },
        },
        {
          id: 'an-2',
          sampleId: 'samp-2', // different sample!
          testType: 'proctor',
          status: 'approved',
          standard: 'NF P94-093',
          version: 1,
          testedDate: '2026-02-05',
          qualityWarnings: [],
          rawInput: {},
          reportNumber: 'PV-02',
          createdAt: '',
          updatedAt: '',
          computedResults: { opm: 10.5, rho: 2.15, uniqueData: [1, 2, 3, 4, 5, 6, 7] }, // exact duplicate!
        },
      ];

      const res = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['an-1', 'an-2'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: duplicateAnalyses,
        samples: mockSamples,
        valueProvenances: { 'an-1': 'measured', 'an-2': 'measured' },
      });

      expect(res.hasErrors).toBe(true);
      const dupFinding = res.findings.find((f) => f.ruleCode === 'DUPLICATE_RESULT_ROWS');
      expect(dupFinding).toBeDefined();
      expect(dupFinding?.severity).toBe('error');
    });

    it('Rule 5: Repeatability limits (AFNOR / ASTM) for replicates', () => {
      // Replicate water content on same sample exceeding 0.5% (e.g. 10.1% vs 10.8% -> diff 0.7%)
      const replicateAnalyses: GeoLabAnalysis[] = [
        {
          id: 'an-wc1',
          sampleId: 'samp-1',
          testType: 'water_content',
          status: 'approved',
          standard: 'NF P94-050',
          version: 1,
          testedDate: '2026-02-05',
          qualityWarnings: [],
          rawInput: {},
          reportNumber: 'PV-WC1',
          createdAt: '',
          updatedAt: '',
          computedResults: { waterContentPercent: 10.1 },
        },
        {
          id: 'an-wc2',
          sampleId: 'samp-1', // same sample!
          testType: 'water_content',
          status: 'approved',
          standard: 'NF P94-050',
          version: 1,
          testedDate: '2026-02-05',
          qualityWarnings: [],
          rawInput: {},
          reportNumber: 'PV-WC2',
          createdAt: '',
          updatedAt: '',
          computedResults: { waterContentPercent: 10.8 }, // diff = 0.7% > 0.5%
        },
      ];

      const res = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['an-wc1', 'an-wc2'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: replicateAnalyses,
        samples: mockSamples,
        valueProvenances: { 'an-wc1': 'measured', 'an-wc2': 'measured' },
      });

      expect(res.hasErrors).toBe(true);
      const repFinding = res.findings.find((f) => f.ruleCode === 'REPEATABILITY_LIMIT_EXCEEDED');
      expect(repFinding).toBeDefined();
      expect(repFinding?.severity).toBe('error');
    });

    it('Rule 6: Out-of-range units (density, moisture, CBR)', () => {
      // Positive: physical density 4.5 (> 3.5), moisture 105 (> 100), CBR 240 (> 200)
      const outOfRangeAnalyses: GeoLabAnalysis[] = [
        {
          id: 'an-bad',
          sampleId: 'samp-1',
          testType: 'proctor',
          status: 'approved',
          standard: 'NF P94-093',
          version: 1,
          testedDate: '2026-02-05',
          qualityWarnings: [],
          rawInput: {},
          reportNumber: 'PV-BAD',
          createdAt: '',
          updatedAt: '',
          computedResults: {
            maxDryDensityGcm3: 4.8, // out of range!
            opmMoisturePercent: 115, // out of range!
            cbrIndex: 250, // out of range!
          },
        },
      ];

      const res = checkStudyConsistency({
        study: { ...mockStudy, includedAnalysisIds: ['an-bad'] },
        project: mockProject,
        organisation: mockOrg,
        analyses: outOfRangeAnalyses,
        samples: mockSamples,
        valueProvenances: { 'an-bad': 'measured' },
      });

      expect(res.hasErrors).toBe(true);
      const rangeFindings = res.findings.filter((f) => f.ruleCode === 'OUT_OF_RANGE_VALUES');
      expect(rangeFindings.length).toBeGreaterThanOrEqual(2);
      expect(rangeFindings[0].severity).toBe('error');
    });

    it('Rule 7: Missing required header fields for approved studies', () => {
      // Approved study with missing programme, lot, contract, financing
      const approvedStudy: StudyReport = { ...mockStudy, status: 'approved' };
      const incompleteProject: GeoLabProject = {
        ...mockProject,
        programmeTitle: '',
        programme: '',
        lotSection: '',
        contractNumber: '',
        financingText: '',
      };

      const res = checkStudyConsistency({
        study: approvedStudy,
        project: incompleteProject,
        organisation: mockOrg,
        analyses: mockAnalyses,
        samples: mockSamples,
        valueProvenances: { 'an-1': 'measured', 'an-2': 'measured' },
      });

      expect(res.hasErrors).toBe(true);
      const missingFindings = res.findings.filter((f) => f.ruleCode === 'MISSING_REQUIRED_APPROVAL_FIELDS');
      expect(missingFindings.length).toBeGreaterThan(0);
      expect(missingFindings[0].severity).toBe('error');
    });
  });

  describe('3. Approved Export Blocker', () => {
    it('blocks approving study when critical consistency errors exist', async () => {
      // Mock db returns
      vi.spyOn(db.studyReports, 'get').mockResolvedValue(mockStudy);
      vi.spyOn(db.geolabProjects, 'get').mockResolvedValue(mockProject);
      vi.spyOn(db.clients, 'get').mockResolvedValue(mockClient);
      vi.spyOn(db.samples, 'where').mockImplementation(() => ({
        equals: () => ({ toArray: async () => mockSamples }),
      } as any));
      vi.spyOn(db.settings, 'get').mockResolvedValue({ key: 'org_profile', value: mockOrg });

      // Inject an out-of-range density error into analyses
      const badAnalyses = [
        {
          ...mockAnalyses[0],
          computedResults: { maxDryDensityGcm3: 5.5 }, // physical error!
        },
      ];
      vi.spyOn(db.analyses, 'toArray').mockResolvedValue(badAnalyses);

      // Attempting to approve study must throw an error due to consistency failure
      await expect(
        changeStudyStatus(mockStudy.id, 'approved', 'fr')
      ).rejects.toThrow(/critiques|critical/i);
    });

    it('blocks buildDocumentModel and export when an approved study has consistency errors', () => {
      const approvedStudy: StudyReport = { ...mockStudy, status: 'approved' };
      const badAnalyses = [
        {
          ...mockAnalyses[0],
          computedResults: { maxDryDensityGcm3: 6.2 }, // physical error!
        },
      ];

      expect(() =>
        buildDocumentModel({
          study: approvedStudy,
          project: mockProject,
          client: mockClient,
          organisation: mockOrg,
          analyses: badAnalyses,
          samples: mockSamples,
          language: 'fr',
          validateConsistency: true,
        })
      ).toThrow(/bloquée|blocked/i);
    });
  });
});
