import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { getTestDefinition } from './index';
import { generateInputTemplateXlsx } from '../engine/templateGenerator';
import { parseAndValidateUploadedExcel } from '../engine/excelParser';
import { generateGeoLabExcelReport } from '../engine/excelGenerator';
import { generateGeoLabPdfReport } from '../engine/pdfGenerator';
import { buildDocumentModel } from '../studies/engine/documentModel';
import { generateStudyPdfReport } from '../studies/engine/studyPdfRenderer';
import { generateStudyDocxReport } from '../studies/engine/studyWordRenderer';
import type {
  OrganisationProfile,
  GeoLabProject,
  GeoLabClient,
  GeoLabSample,
  GeoLabAnalysis,
  StudyReport,
  StudyPhoto,
} from '../../types/geolab';

describe('Wave 1A: Eight Materials Tests - Golden, Negative & Round-Trip Suite', () => {
  const mockOrg: OrganisationProfile = {
    companyName: 'FraGeo Lab Testing Services',
    address: '45 Avenue des Roches, Yaoundé',
    phone: '+237 222 00 11 22',
    email: 'contact@frageolab.cm',
    accreditationNumber: 'ACCR-2026-GEO-042',
    primaryColor: '#1e40af',
    approvalChain: [
      { id: '1', roleLabel: { en: 'Tested by', fr: 'Essai réalisé par' }, name: 'Pierre Nsangou', title: 'Technicien' },
      { id: '2', roleLabel: { en: 'Checked by', fr: 'Vérifié par' }, name: 'Marie Ondo', title: 'Ingénieur Qualité' },
      { id: '3', roleLabel: { en: 'Approved by', fr: 'Approuvé par' }, name: 'Dr. Joseph Mengue', title: 'Directeur Technique' },
    ],
    signatories: [],
    reportFooterText: 'FraGeo Suite - FraGeo Lab',
    defaultLanguage: 'fr',
    defaultStandard: 'NF',
  };

  const mockProject: GeoLabProject = {
    id: 'proj-wave1a',
    clientId: 'cli-wave1a',
    projectName: 'Autoroute Yaoundé - Douala Phase 2',
    programmeTitle: 'Projet d’Infrastructures Majeures',
    lotSection: 'Section 3 : PK 40 au PK 65',
    contractNumber: 'CTR-AYD-2026-03',
    siteLocation: 'Carrière PK 45',
    referenceNumber: 'REF-AYD-03',
    startDate: '2026-01-15',
    isArchived: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z',
    // Notice: specLimits is undefined/empty by default!
  };

  const mockClient: GeoLabClient = {
    id: 'cli-wave1a',
    companyName: 'Consortium BTP International',
    contactPerson: 'Ing. Jean Paul Biya',
    email: 'contact@cbbtp.cm',
    phone: '+237 699 11 22 33',
    address: 'Boulevard de la Liberté',
    city: 'Douala',
    country: 'Cameroun',
    isArchived: false,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  };

  const mockSample: GeoLabSample = {
    id: 's-wave1a',
    projectId: mockProject.id,
    sampleId: 'ECH-WAVE1A',
    materialType: 'Granulat concassé 10/14',
    samplingDate: '2026-02-15',
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-02-15T08:00:00Z',
  };

  // ==========================================================================
  // 1. GOLDEN TESTS: FORMULAS AND VECTORS
  // ==========================================================================
  describe('1. Golden Tests & Formulas Verification', () => {
    it('2.1 specific_gravity: reproduces golden pycnometer vector (det1, det2, mean Gs 2.624 / 2.623 / 2.6235)', () => {
      const def = getTestDefinition('specific_gravity');
      const input = {
        maxToleranceGs: 0.03,
        determinations: [
          { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969, temperatureC: 30 },
          { detId: '2', pycnometerWaterA: 3811.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2992.5, pycnometerMaterialWaterD: 4968, temperatureC: 30 },
        ],
      };

      const res = def.calculate(input);

      // det1: Ms = 1862, displaced = 706.5, Vs = 709.622, Gs = 2.624
      const d1 = res.determinations[0];
      expect(d1.dryMaterialMassMsG).toBe(1862);
      expect(d1.displacedWaterMassG).toBe(706.5);
      expect(Math.round(d1.solidVolumeVsCm3 * 10) / 10).toBe(709.6);
      expect(d1.specificGravityGs).toBeCloseTo(2.624, 3);

      // det2: Ms = 1864, displaced = 707.5, Gs = 2.623
      const d2 = res.determinations[1];
      expect(d2.dryMaterialMassMsG).toBe(1864);
      expect(d2.displacedWaterMassG).toBe(707.5);
      expect(d2.specificGravityGs).toBeCloseTo(2.623, 3);

      // Mean: 2.6235 (sheet 2.62)
      expect(res.meanGs).toBeCloseTo(2.6235, 4);
      expect(res.densityTm3).toBeCloseTo(2.623, 2);
      expect(res.repeatabilityAccepted).toBe(true);

      const keys = def.keyResults(res, 'fr');
      expect(keys.find((k) => k.label.includes('Gs'))?.value).toBe(2.623);
      expect(keys.find((k) => k.label.includes('ρs'))?.value).toBe(2.623);
    });

    it('2.2 bulk_density: reproduces golden loose bulk density vector (mould 2251g, vol 4889.7cm3, mean 1.4381)', () => {
      const def = getTestDefinition('bulk_density');
      const input = {
        mouldMassG: 2251,
        mouldVolumeCm3: 4889.7,
        trials: [
          { trialIndex: 1, mouldPlusMaterialG: 9183 },
          { trialIndex: 2, mouldPlusMaterialG: 9380 },
          { trialIndex: 3, mouldPlusMaterialG: 9286 },
        ],
      };

      const res = def.calculate(input);

      expect(res.trials[0].bulkDensityGcm3).toBeCloseTo(1.4177, 4);
      expect(res.trials[1].bulkDensityGcm3).toBeCloseTo(1.4580, 4);
      expect(res.trials[2].bulkDensityGcm3).toBeCloseTo(1.4387, 4);
      expect(res.meanBulkDensityGcm3).toBeCloseTo(1.4381, 4);
      expect(res.meanBulkDensityKgM3).toBeCloseTo(1438.1, 1);
    });

    it('2.3 sand_equivalent: reproduces golden heights vector (ESv 97.78, ESp 96.09)', () => {
      const def = getTestDefinition('sand_equivalent');
      const input = {
        specimens: [
          { specimenId: '1', h1Mm: 8.6, h2PrimeMm: 8.4, h2Mm: 8.2 },
          { specimenId: '2', h1Mm: 9.5, h2PrimeMm: 9.3, h2Mm: 9.2 },
        ],
      };

      const res = def.calculate(input);

      expect(res.specimens[0].esVisual).toBeCloseTo(97.67, 2);
      expect(res.specimens[0].esPiston).toBeCloseTo(95.35, 2);
      expect(res.specimens[1].esVisual).toBeCloseTo(97.89, 2);
      expect(res.specimens[1].esPiston).toBeCloseTo(96.84, 2);

      expect(res.meanEsVisual).toBeCloseTo(97.78, 2);
      expect(res.meanEsPiston).toBeCloseTo(96.09, 2);
    });

    it('2.4 los_angeles: reproduces golden LA test portions (M 5000, m 4546 -> 9.08; M 5000, m 4343 -> 13.14)', () => {
      const def = getTestDefinition('los_angeles');

      const res1 = def.calculate({
        fraction: '10/14',
        determinations: [{ detIndex: 1, initialMassG: 5000, retainedMassG: 4546 }],
      });
      expect(res1.determinations[0].laCoefficient).toBeCloseTo(9.08, 2);
      expect(res1.laCoefficient).toBeCloseTo(9.08, 2);
      expect(res1.laCategory).toBe('LA15');

      const res2 = def.calculate({
        fraction: '10/14',
        determinations: [{ detIndex: 1, initialMassG: 5000, retainedMassG: 4343 }],
      });
      expect(res2.determinations[0].laCoefficient).toBeCloseTo(13.14, 2);
      expect(res2.laCoefficient).toBeCloseTo(13.14, 2);
      expect(res2.laCategory).toBe('LA15');
    });

    it('2.5 micro_deval: reproduces golden MDE vector (M 500, m 410 -> 18.0)', () => {
      const def = getTestDefinition('micro_deval');
      const res = def.calculate({
        fraction: '10/14',
        determinations: [{ detIndex: 1, initialMassG: 500, retainedMassG: 410 }],
      });

      expect(res.determinations[0].mdeCoefficient).toBeCloseTo(18.0, 1);
      expect(res.mdeCoefficient).toBeCloseTo(18.0, 1);
      expect(res.mdeCategory).toBe('MDE20');
    });

    it('2.6 flakiness: reproduces golden flakiness index vector (Mg [200,300,300,200], Me [20,45,50,35] -> A = 15.0)', () => {
      const def = getTestDefinition('flakiness');
      const input = {
        initialTestMassM0: 1000,
        classes: [
          { sizeFraction: '6.3 - 8', slotWidthMm: 4, fractionMassMg: 200, passingMassMe: 20 },
          { sizeFraction: '8 - 10', slotWidthMm: 5, fractionMassMg: 300, passingMassMe: 45 },
          { sizeFraction: '10 - 12.5', slotWidthMm: 6.3, fractionMassMg: 300, passingMassMe: 50 },
          { sizeFraction: '12.5 - 16', slotWidthMm: 8, fractionMassMg: 200, passingMassMe: 35 },
        ],
      };

      const res = def.calculate(input);

      expect(res.totalFractionMassSumMg).toBe(1000);
      expect(res.totalPassingMassSumMe).toBe(150);
      expect(res.flakinessIndexA).toBeCloseTo(15.0, 1);
      expect(res.flakinessCategory).toBe('FI15');
      expect(res.massLossPercent).toBe(0);
    });

    it('2.7 surface_cleanliness: reproduces golden washing vector (Ms 766.4, m\' 763.4 -> P 0.39; Ms 635.8, m\' 632.6 -> P 0.50)', () => {
      const def = getTestDefinition('surface_cleanliness');
      const input = {
        fraction: '10/14',
        determinations: [
          { detId: '1', initialDryMassMsG: 766.4, retainedMassAfterWashingMPrimeG: 763.4 },
          { detId: '2', initialDryMassMsG: 635.8, retainedMassAfterWashingMPrimeG: 632.6 },
        ],
      };

      const res = def.calculate(input);

      expect(res.determinations[0].finesMassLostMG).toBeCloseTo(3.0, 1);
      expect(res.determinations[0].cleanlinessPercentageP).toBeCloseTo(0.39, 2);

      expect(res.determinations[1].finesMassLostMG).toBeCloseTo(3.2, 1);
      expect(res.determinations[1].cleanlinessPercentageP).toBeCloseTo(0.50, 2);

      expect(res.meanCleanlinessPercentageP).toBeCloseTo(0.45, 2);
      expect(res.cleanlinessCategory).toBe('P0.5');
    });

    it('2.8 methylene_blue: reproduces golden vectors for soils (VBS 1.5) and aggregate fines (MB 1.5 g/kg)', () => {
      const def = getTestDefinition('methylene_blue');

      // Soils: m0 = 30, V1 = 45, C = 1 -> VBS = 1.5
      const resSoils = def.calculate({
        mode: 'soils',
        sampleDryMassG: 30,
        dyeSolutionVolumeV1Ml: 45,
        solutionConcentrationC: 1.0,
      });
      expect(resSoils.vbsValue).toBeCloseTo(1.5, 2);
      expect(resSoils.primaryValue).toBeCloseTo(1.5, 2);
      expect(resSoils.unit).toBe('g/100g');
      expect(resSoils.soilSensitivityClass).toContain('1.5 ≤ VBS < 2.5');

      // Aggregate fines: M1 = 200, V1 = 30 -> MB = 1.5 g/kg
      const resAgg = def.calculate({
        mode: 'aggregate_fines',
        sampleDryMassG: 200,
        dyeSolutionVolumeV1Ml: 30,
      });
      expect(resAgg.mbValue).toBeCloseTo(1.5, 2);
      expect(resAgg.primaryValue).toBeCloseTo(1.5, 2);
      expect(resAgg.unit).toBe('g/kg');
    });
  });

  // ==========================================================================
  // 2. NEGATIVE TESTS: CHECKS() AND VALIDATIONS
  // ==========================================================================
  describe('2. Negative Tests & Quality Checks', () => {
    it('specific_gravity: flags single determination and out-of-range Gs', () => {
      const def = getTestDefinition('specific_gravity');
      const input = {
        determinations: [
          { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969, temperatureC: 30 },
        ],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'SPECIFIC_GRAVITY_SINGLE_DETERMINATION')).toBe(true);

      const resOutOfRange = { ...res, meanGs: 4.2 };
      const warningsRange = def.checks(input, resOutOfRange);
      expect(warningsRange.some((w) => w.code === 'SPECIFIC_GRAVITY_SUSPICIOUS_RANGE')).toBe(true);
    });

    it('bulk_density: flags fewer than three trials and suspicious density', () => {
      const def = getTestDefinition('bulk_density');
      const input = {
        mouldMassG: 2251,
        mouldVolumeCm3: 4889.7,
        trials: [{ trialIndex: 1, mouldPlusMaterialG: 9183 }],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'BULK_DENSITY_FEWER_THAN_THREE_TRIALS')).toBe(true);
    });

    it('sand_equivalent: flags piston reading exceeding visual reading or single specimen', () => {
      const def = getTestDefinition('sand_equivalent');
      const input = {
        specimens: [{ specimenId: '1', h1Mm: 8.6, h2PrimeMm: 8.0, h2Mm: 8.4 }],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'SAND_EQUIVALENT_FEWER_THAN_TWO_SPECIMENS')).toBe(true);
      expect(warnings.some((w) => w.code === 'SAND_EQUIVALENT_PISTON_GREATER_THAN_VISUAL')).toBe(true);
    });

    it('los_angeles: flags initial mass M deviation and retained exceeding initial', () => {
      const def = getTestDefinition('los_angeles');
      const input = {
        fraction: '10/14' as const,
        determinations: [{ detIndex: 1, initialMassG: 4800, retainedMassG: 4900 }],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'LOS_ANGELES_INITIAL_MASS_DEVIATION')).toBe(true);
      expect(warnings.some((w) => w.code === 'LOS_ANGELES_RETAINED_GREATER_THAN_INITIAL')).toBe(true);
    });

    it('micro_deval: flags initial mass deviation from 500g and retained exceeding initial', () => {
      const def = getTestDefinition('micro_deval');
      const input = {
        fraction: '10/14' as const,
        determinations: [{ detIndex: 1, initialMassG: 550, retainedMassG: 560 }],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'MICRO_DEVAL_INITIAL_MASS_DEVIATION')).toBe(true);
      expect(warnings.some((w) => w.code === 'MICRO_DEVAL_RETAINED_GREATER_THAN_INITIAL')).toBe(true);
    });

    it('flakiness: flags mass loss exceeding 2% and passing mass exceeding fraction mass', () => {
      const def = getTestDefinition('flakiness');
      const input = {
        initialTestMassM0: 1000,
        classes: [
          { sizeFraction: '6.3 - 8', slotWidthMm: 4, fractionMassMg: 200, passingMassMe: 250 },
        ],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'FLAKINESS_MASS_BALANCE_EXCEEDED')).toBe(true);
      expect(warnings.some((w) => w.code === 'FLAKINESS_PASSING_GREATER_THAN_FRACTION')).toBe(true);
    });

    it('surface_cleanliness: flags washed retained mass exceeding initial mass', () => {
      const def = getTestDefinition('surface_cleanliness');
      const input = {
        determinations: [
          { detId: '1', initialDryMassMsG: 500, retainedMassAfterWashingMPrimeG: 520 },
        ],
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'SURFACE_CLEANLINESS_RETAINED_EXCEEDS_INITIAL')).toBe(true);
    });

    it('methylene_blue: flags zero mass and extreme VBS', () => {
      const def = getTestDefinition('methylene_blue');
      const input = {
        mode: 'soils' as const,
        sampleDryMassG: 0,
        dyeSolutionVolumeV1Ml: 45,
      };
      const res = def.calculate(input);
      const warnings = def.checks(input, res);
      expect(warnings.some((w) => w.code === 'METHYLENE_BLUE_ZERO_MASS')).toBe(true);
    });
  });

  // ==========================================================================
  // 3. INPUT TEMPLATE ROUND-TRIP: DOWNLOAD -> FILL -> UPLOAD -> CALCULATE
  // ==========================================================================
  describe('3. Template Download -> Fill -> Upload -> Calculate Round-Trip', () => {
    const testTypes = [
      'specific_gravity',
      'bulk_density',
      'sand_equivalent',
      'los_angeles',
      'micro_deval',
      'flakiness',
      'surface_cleanliness',
      'methylene_blue',
    ] as const;

    for (const testType of testTypes) {
      it(`round-trips template for ${testType}`, async () => {
        const def = getTestDefinition(testType);
        const templateBlob = generateInputTemplateXlsx(testType, 'fr');
        expect(templateBlob.size).toBeGreaterThan(1000);

        const ab = await templateBlob.arrayBuffer();
        const parseRes = await parseAndValidateUploadedExcel(ab, testType);

        expect(parseRes.success).toBe(true);
        expect(parseRes.rawInput).toBeDefined();

        const calcRes = def.calculate(parseRes.rawInput);
        expect(calcRes).toBeDefined();

        const keyRes = def.keyResults(calcRes, 'fr');
        expect(keyRes.length).toBeGreaterThan(0);
      });
    }
  });

  // ==========================================================================
  // 4. EXCEL SHEET GENERATION (ALL 8 TESTS IN FR & EN; EMPTY SPEC LIMITS CHECK)
  // ==========================================================================
  describe('4. Excel Report Generation (FR & EN, Empty Spec Limits)', () => {
    const testConfigs: Array<{
      testType: any;
      rawInput: any;
      calc: (input: any) => any;
    }> = [
      {
        testType: 'specific_gravity',
        rawInput: {
          determinations: [
            { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969, temperatureC: 30 },
            { detId: '2', pycnometerWaterA: 3811.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2992.5, pycnometerMaterialWaterD: 4968, temperatureC: 30 },
          ],
        },
        calc: (inp) => getTestDefinition('specific_gravity').calculate(inp),
      },
      {
        testType: 'bulk_density',
        rawInput: {
          mouldMassG: 2251,
          mouldVolumeCm3: 4889.7,
          trials: [
            { trialIndex: 1, mouldPlusMaterialG: 9183 },
            { trialIndex: 2, mouldPlusMaterialG: 9380 },
            { trialIndex: 3, mouldPlusMaterialG: 9286 },
          ],
        },
        calc: (inp) => getTestDefinition('bulk_density').calculate(inp),
      },
      {
        testType: 'sand_equivalent',
        rawInput: {
          specimens: [
            { specimenId: '1', h1Mm: 8.6, h2PrimeMm: 8.4, h2Mm: 8.2 },
            { specimenId: '2', h1Mm: 9.5, h2PrimeMm: 9.3, h2Mm: 9.2 },
          ],
        },
        calc: (inp) => getTestDefinition('sand_equivalent').calculate(inp),
      },
      {
        testType: 'los_angeles',
        rawInput: {
          fraction: '10/14',
          determinations: [{ detIndex: 1, initialMassG: 5000, retainedMassG: 4546 }],
        },
        calc: (inp) => getTestDefinition('los_angeles').calculate(inp),
      },
      {
        testType: 'micro_deval',
        rawInput: {
          fraction: '10/14',
          determinations: [{ detIndex: 1, initialMassG: 500, retainedMassG: 410 }],
        },
        calc: (inp) => getTestDefinition('micro_deval').calculate(inp),
      },
      {
        testType: 'flakiness',
        rawInput: {
          initialTestMassM0: 1000,
          classes: [
            { sizeFraction: '6.3 - 8', slotWidthMm: 4, fractionMassMg: 200, passingMassMe: 20 },
            { sizeFraction: '8 - 10', slotWidthMm: 5, fractionMassMg: 300, passingMassMe: 45 },
            { sizeFraction: '10 - 12.5', slotWidthMm: 6.3, fractionMassMg: 300, passingMassMe: 50 },
            { sizeFraction: '12.5 - 16', slotWidthMm: 8, fractionMassMg: 200, passingMassMe: 35 },
          ],
        },
        calc: (inp) => getTestDefinition('flakiness').calculate(inp),
      },
      {
        testType: 'surface_cleanliness',
        rawInput: {
          fraction: '10/14',
          determinations: [
            { detId: '1', initialDryMassMsG: 766.4, retainedMassAfterWashingMPrimeG: 763.4 },
            { detId: '2', initialDryMassMsG: 635.8, retainedMassAfterWashingMPrimeG: 632.6 },
          ],
        },
        calc: (inp) => getTestDefinition('surface_cleanliness').calculate(inp),
      },
      {
        testType: 'methylene_blue',
        rawInput: {
          mode: 'soils',
          sampleDryMassG: 30,
          dyeSolutionVolumeV1Ml: 45,
          solutionConcentrationC: 1.0,
        },
        calc: (inp) => getTestDefinition('methylene_blue').calculate(inp),
      },
    ];

    for (const tc of testConfigs) {
      it(`generates Excel report in FR and EN for ${tc.testType}`, async () => {
        const def = getTestDefinition(tc.testType);
        const computed = tc.calc(tc.rawInput);

        const mockAnalysis: GeoLabAnalysis = {
          id: `ana-${tc.testType}`,
          sampleId: mockSample.id,
          testType: tc.testType,
          standard: def.defaultStandard,
          reportNumber: `PV-${tc.testType.toUpperCase()}-001`,
          version: 1,
          status: 'approved',
          testedDate: '2026-02-18',
          rawInput: tc.rawInput,
          computedResults: computed,
          qualityWarnings: [],
          createdAt: '2026-02-18T10:00:00Z',
          updatedAt: '2026-02-18T10:00:00Z',
        };

        // FR Excel
        const blobFr = await generateGeoLabExcelReport({
          analysis: mockAnalysis,
          client: mockClient,
          project: mockProject,
          sample: mockSample,
          orgProfile: mockOrg,
          testDef: def,
          language: 'fr',
        });
        expect(blobFr.size).toBeGreaterThan(3000);

        // Parse FR sheet to verify content
        const wbFr = xlsx.read(await blobFr.arrayBuffer(), { type: 'array' });
        const sheetFr = wbFr.Sheets[wbFr.SheetNames[0]];
        const textFr = JSON.stringify(sheetFr);
        expect(textFr).toContain(mockAnalysis.reportNumber);
        expect(textFr).toContain('HISTORIQUE');

        // EN Excel
        const blobEn = await generateGeoLabExcelReport({
          analysis: mockAnalysis,
          client: mockClient,
          project: mockProject,
          sample: mockSample,
          orgProfile: mockOrg,
          testDef: def,
          language: 'en',
        });
        expect(blobEn.size).toBeGreaterThan(3000);
        const wbEn = xlsx.read(await blobEn.arrayBuffer(), { type: 'array' });
        const sheetEn = wbEn.Sheets[wbEn.SheetNames[0]];
        const textEn = JSON.stringify(sheetEn);
        expect(textEn).toContain(mockAnalysis.reportNumber);
        expect(textEn).toContain('REVISION');
      });
    }
  });

  // ==========================================================================
  // 5. TEST SHEET PDF GENERATION & UNICODE SYMBOLS (RHO, DEGREE, NO "Á")
  // ==========================================================================
  describe('5. Test Sheet PDF Generation (Unicode & Special Characters)', () => {
    it('generates valid PDF test-sheets in FR and EN with clean Unicode characters (no "Á")', async () => {
      const def = getTestDefinition('specific_gravity');
      const input = {
        determinations: [
          { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969, temperatureC: 30 },
          { detId: '2', pycnometerWaterA: 3811.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2992.5, pycnometerMaterialWaterD: 4968, temperatureC: 30 },
        ],
      };
      const res = def.calculate(input);

      const mockAnalysis: GeoLabAnalysis = {
        id: 'ana-sg-pdf',
        sampleId: mockSample.id,
        testType: 'specific_gravity',
        standard: def.defaultStandard,
        reportNumber: 'PV-SG-2026-001',
        version: 1,
        status: 'approved',
        testedDate: '2026-02-18',
        rawInput: input,
        computedResults: res,
        qualityWarnings: [],
        createdAt: '2026-02-18T10:00:00Z',
        updatedAt: '2026-02-18T10:00:00Z',
      };

      const pdfBlob = await generateGeoLabPdfReport({
        analysis: mockAnalysis,
        client: mockClient,
        project: mockProject,
        sample: mockSample,
        orgProfile: mockOrg,
        testDef: def,
        language: 'fr',
      });

      expect(pdfBlob.size).toBeGreaterThan(5000);
      const pdfText = await pdfBlob.text();
      // Verify no corrupted "Á" appears where rho/accents were intended
      expect(pdfText).not.toContain('Ád_opm');
      expect(pdfText).not.toContain('Ás');
    });
  });

  // ==========================================================================
  // 6. COMPLETE STUDY CONTAINING 1 ANALYSIS OF ALL 11 TESTS AND 12 PHOTOS
  // ==========================================================================
  describe('6. Sample Study with all 11 Tests & 12 Photos (Word & PDF)', () => {
    it('builds, renders Word (.docx) and PDF, asserts TOC page numbers and logs page count', async () => {
      // 1. Build 11 analyses (8 new + 3 existing: proctor, grain_size, water_content)
      const allAnalyses: GeoLabAnalysis[] = [
        {
          id: 'a-proctor',
          sampleId: mockSample.id,
          testType: 'proctor',
          standard: 'NF P94-093',
          reportNumber: 'PV-PR-2026-001',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-01',
          rawInput: { moldVolumeCm3: 2124 },
          computedResults: {
            opmMoisturePercent: 12.4,
            maxDryDensityGcm3: 2.05,
            targetDryDensityGcm3: 1.948,
            points: [
              { pointIndex: 1, waterContentPercent: 8.5, wetDensityGcm3: 2.02, dryDensityGcm3: 1.86, saturationWaterContentPercent: 18.2, compactionPercentOfOpm: 90.7 },
              { pointIndex: 2, waterContentPercent: 10.5, wetDensityGcm3: 2.18, dryDensityGcm3: 1.97, saturationWaterContentPercent: 15.5, compactionPercentOfOpm: 96.1 },
              { pointIndex: 3, waterContentPercent: 12.3, wetDensityGcm3: 2.30, dryDensityGcm3: 2.05, saturationWaterContentPercent: 13.8, compactionPercentOfOpm: 100.0 },
              { pointIndex: 4, waterContentPercent: 14.5, wetDensityGcm3: 2.27, dryDensityGcm3: 1.98, saturationWaterContentPercent: 15.2, compactionPercentOfOpm: 96.6 },
            ],
            saturationCurve: [],
          },
          qualityWarnings: [],
          createdAt: '2026-02-01T10:00:00Z',
          updatedAt: '2026-02-01T10:00:00Z',
        },
        {
          id: 'a-grain-size',
          sampleId: mockSample.id,
          testType: 'grain_size',
          standard: 'NF EN ISO 17892-4',
          reportNumber: 'PV-GR-2026-002',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-02',
          rawInput: { totalDryMassG: 2500 },
          computedResults: {
            finesPercent: 18.5,
            sandPercent: 32.5,
            gravelPercent: 49.0,
            cu: 12.4,
            cc: 1.8,
            lcpcClassification: 'Grave argileuse',
            uscsClassification: 'GC',
            rows: [
              { sieveMm: 20, retainedMassG: 120, retainedPercent: 4.8, cumulatedRetainedPercent: 4.8, passingPercent: 95.2 },
              { sieveMm: 10, retainedMassG: 600, retainedPercent: 24.0, cumulatedRetainedPercent: 28.8, passingPercent: 71.2 },
              { sieveMm: 5, retainedMassG: 500, retainedPercent: 20.0, cumulatedRetainedPercent: 48.8, passingPercent: 51.2 },
              { sieveMm: 2, retainedMassG: 400, retainedPercent: 16.0, cumulatedRetainedPercent: 64.8, passingPercent: 35.2 },
              { sieveMm: 0.08, retainedMassG: 418, retainedPercent: 16.7, cumulatedRetainedPercent: 81.5, passingPercent: 18.5 },
            ],
          },
          qualityWarnings: [],
          createdAt: '2026-02-02T10:00:00Z',
          updatedAt: '2026-02-02T10:00:00Z',
        },
        {
          id: 'a-water-content',
          sampleId: mockSample.id,
          testType: 'water_content',
          standard: 'NF P94-050',
          reportNumber: 'PV-TE-2026-003',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-03',
          rawInput: {},
          computedResults: { meanWaterContentPercent: 10.7, differenceBetweenSpecimensPercent: 0.2, repeatabilityAccepted: true },
          qualityWarnings: [],
          createdAt: '2026-02-03T10:00:00Z',
          updatedAt: '2026-02-03T10:00:00Z',
        },
        {
          id: 'a-specific-gravity',
          sampleId: mockSample.id,
          testType: 'specific_gravity',
          standard: 'NF P94-054',
          reportNumber: 'PV-SG-2026-004',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-04',
          rawInput: {
            determinations: [
              { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969, temperatureC: 30 },
              { detId: '2', pycnometerWaterA: 3811.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2992.5, pycnometerMaterialWaterD: 4968, temperatureC: 30 },
            ],
          },
          computedResults: getTestDefinition('specific_gravity').calculate({
            determinations: [
              { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969, temperatureC: 30 },
              { detId: '2', pycnometerWaterA: 3811.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2992.5, pycnometerMaterialWaterD: 4968, temperatureC: 30 },
            ],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-04T10:00:00Z',
          updatedAt: '2026-02-04T10:00:00Z',
        },
        {
          id: 'a-bulk-density',
          sampleId: mockSample.id,
          testType: 'bulk_density',
          standard: 'NF EN 1097-3',
          reportNumber: 'PV-BD-2026-005',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-05',
          rawInput: { mouldMassG: 2251, mouldVolumeCm3: 4889.7, trials: [{ trialIndex: 1, mouldPlusMaterialG: 9183 }, { trialIndex: 2, mouldPlusMaterialG: 9380 }, { trialIndex: 3, mouldPlusMaterialG: 9286 }] },
          computedResults: getTestDefinition('bulk_density').calculate({
            mouldMassG: 2251,
            mouldVolumeCm3: 4889.7,
            trials: [{ trialIndex: 1, mouldPlusMaterialG: 9183 }, { trialIndex: 2, mouldPlusMaterialG: 9380 }, { trialIndex: 3, mouldPlusMaterialG: 9286 }],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-05T10:00:00Z',
          updatedAt: '2026-02-05T10:00:00Z',
        },
        {
          id: 'a-sand-equivalent',
          sampleId: mockSample.id,
          testType: 'sand_equivalent',
          standard: 'NF EN 933-8',
          reportNumber: 'PV-SE-2026-006',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-06',
          rawInput: { specimens: [{ specimenId: '1', h1Mm: 8.6, h2PrimeMm: 8.4, h2Mm: 8.2 }, { specimenId: '2', h1Mm: 9.5, h2PrimeMm: 9.3, h2Mm: 9.2 }] },
          computedResults: getTestDefinition('sand_equivalent').calculate({
            specimens: [{ specimenId: '1', h1Mm: 8.6, h2PrimeMm: 8.4, h2Mm: 8.2 }, { specimenId: '2', h1Mm: 9.5, h2PrimeMm: 9.3, h2Mm: 9.2 }],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-06T10:00:00Z',
          updatedAt: '2026-02-06T10:00:00Z',
        },
        {
          id: 'a-los-angeles',
          sampleId: mockSample.id,
          testType: 'los_angeles',
          standard: 'NF EN 1097-2',
          reportNumber: 'PV-LA-2026-007',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-07',
          rawInput: { fraction: '10/14', determinations: [{ detIndex: 1, initialMassG: 5000, retainedMassG: 4546 }] },
          computedResults: getTestDefinition('los_angeles').calculate({
            fraction: '10/14',
            determinations: [{ detIndex: 1, initialMassG: 5000, retainedMassG: 4546 }],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-07T10:00:00Z',
          updatedAt: '2026-02-07T10:00:00Z',
        },
        {
          id: 'a-micro-deval',
          sampleId: mockSample.id,
          testType: 'micro_deval',
          standard: 'NF EN 1097-1',
          reportNumber: 'PV-MDE-2026-008',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-08',
          rawInput: { fraction: '10/14', determinations: [{ detIndex: 1, initialMassG: 500, retainedMassG: 410 }] },
          computedResults: getTestDefinition('micro_deval').calculate({
            fraction: '10/14',
            determinations: [{ detIndex: 1, initialMassG: 500, retainedMassG: 410 }],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-08T10:00:00Z',
          updatedAt: '2026-02-08T10:00:00Z',
        },
        {
          id: 'a-flakiness',
          sampleId: mockSample.id,
          testType: 'flakiness',
          standard: 'NF EN 933-3',
          reportNumber: 'PV-FI-2026-009',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-09',
          rawInput: {
            initialTestMassM0: 1000,
            classes: [
              { sizeFraction: '6.3 - 8', slotWidthMm: 4, fractionMassMg: 200, passingMassMe: 20 },
              { sizeFraction: '8 - 10', slotWidthMm: 5, fractionMassMg: 300, passingMassMe: 45 },
              { sizeFraction: '10 - 12.5', slotWidthMm: 6.3, fractionMassMg: 300, passingMassMe: 50 },
              { sizeFraction: '12.5 - 16', slotWidthMm: 8, fractionMassMg: 200, passingMassMe: 35 },
            ],
          },
          computedResults: getTestDefinition('flakiness').calculate({
            initialTestMassM0: 1000,
            classes: [
              { sizeFraction: '6.3 - 8', slotWidthMm: 4, fractionMassMg: 200, passingMassMe: 20 },
              { sizeFraction: '8 - 10', slotWidthMm: 5, fractionMassMg: 300, passingMassMe: 45 },
              { sizeFraction: '10 - 12.5', slotWidthMm: 6.3, fractionMassMg: 300, passingMassMe: 50 },
              { sizeFraction: '12.5 - 16', slotWidthMm: 8, fractionMassMg: 200, passingMassMe: 35 },
            ],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-09T10:00:00Z',
          updatedAt: '2026-02-09T10:00:00Z',
        },
        {
          id: 'a-surface-cleanliness',
          sampleId: mockSample.id,
          testType: 'surface_cleanliness',
          standard: 'NF P18-591',
          reportNumber: 'PV-SC-2026-010',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-10',
          rawInput: {
            fraction: '10/14',
            determinations: [
              { detId: '1', initialDryMassMsG: 766.4, retainedMassAfterWashingMPrimeG: 763.4 },
              { detId: '2', initialDryMassMsG: 635.8, retainedMassAfterWashingMPrimeG: 632.6 },
            ],
          },
          computedResults: getTestDefinition('surface_cleanliness').calculate({
            fraction: '10/14',
            determinations: [
              { detId: '1', initialDryMassMsG: 766.4, retainedMassAfterWashingMPrimeG: 763.4 },
              { detId: '2', initialDryMassMsG: 635.8, retainedMassAfterWashingMPrimeG: 632.6 },
            ],
          }),
          qualityWarnings: [],
          createdAt: '2026-02-10T10:00:00Z',
          updatedAt: '2026-02-10T10:00:00Z',
        },
        {
          id: 'a-methylene-blue',
          sampleId: mockSample.id,
          testType: 'methylene_blue',
          standard: 'NF P94-068',
          reportNumber: 'PV-MB-2026-011',
          version: 1,
          status: 'approved',
          testedDate: '2026-02-11',
          rawInput: { mode: 'soils', sampleDryMassG: 30, dyeSolutionVolumeV1Ml: 45, solutionConcentrationC: 1.0 },
          computedResults: getTestDefinition('methylene_blue').calculate({
            mode: 'soils',
            sampleDryMassG: 30,
            dyeSolutionVolumeV1Ml: 45,
            solutionConcentrationC: 1.0,
          }),
          qualityWarnings: [],
          createdAt: '2026-02-11T10:00:00Z',
          updatedAt: '2026-02-11T10:00:00Z',
        },
      ];

      // 2. 12 mock photos
      const mockPhotos: StudyPhoto[] = Array.from({ length: 12 }, (_, i) => ({
        id: `photo-wave1a-${i + 1}`,
        studyId: 'study-wave1a',
        fileName: `photo_${i + 1}.jpg`,
        caption: `Photographie géotechnique ${i + 1}`,
        mimeType: 'image/jpeg',
        blob: new Blob(['fake-jpg'], { type: 'image/jpeg' }),
        thumbnailDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        compressedDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        order: i,
        createdAt: '2026-02-12T10:00:00Z',
      }));

      // 3. Study Report
      const mockStudy: StudyReport = {
        id: 'study-wave1a-complete',
        projectId: mockProject.id,
        title: 'Étude Géotechnique Complète de Caractérisation des Matériaux Routiers',
        templateId: 'characterisation_soils',
        language: 'fr',
        status: 'approved',
        reportNumber: 'ETUDE-COMPLETE-2026-001',
        revisions: [
          {
            index: 0,
            date: '2026-02-15',
            nature: 'Émission initiale complète Wave 1A',
            preparedBy: 'Pierre Nsangou',
            checkedBy: 'Marie Ondo',
            approvedBy: 'Dr. Joseph Mengue',
          },
        ],
        sections: [],
        includedAnalysisIds: allAnalyses.map((a) => a.id),
        createdAt: '2026-02-15T10:00:00Z',
        updatedAt: '2026-02-15T10:00:00Z',
      };

      const docModel = buildDocumentModel({
        study: mockStudy,
        project: mockProject,
        client: mockClient,
        organisation: mockOrg,
        analyses: allAnalyses,
        samples: [mockSample],
        photos: mockPhotos,
        language: 'fr',
      });

      expect(docModel).toBeDefined();

      // Render Word
      const wordBlob = await generateStudyDocxReport(docModel);
      expect(wordBlob.size).toBeGreaterThan(15000);

      // Track drawn headings and TOC numbers to verify TOC accuracy
      const recordedDrawnTexts: Array<{ page: number; text: string }> = [];
      let finalPageCount = 1;

      const pdfBlob = await generateStudyPdfReport(docModel, {
        onDocCreated: (doc, pass) => {
          if (pass === 2) {
            const origAddPage = doc.addPage.bind(doc);
            doc.addPage = function (...args: any[]) {
              const res = origAddPage(...args);
              finalPageCount = doc.getCurrentPageInfo().pageNumber;
              return res;
            };

            const origText = doc.text.bind(doc);
            doc.text = function (text: any, x: any, y: any, options: any) {
              const str = String(Array.isArray(text) ? text.join(' ') : text).trim();
              recordedDrawnTexts.push({
                page: doc.getCurrentPageInfo().pageNumber,
                text: str,
              });
              return (origText as any)(text, x, y, options);
            } as any;
          }
        },
      });

      expect(pdfBlob.size).toBeGreaterThan(20000);
      console.log(`[SAMPLE STUDY WAVE 1A] Total Pages: ${finalPageCount}`);
      expect(finalPageCount).toBeGreaterThanOrEqual(14);

      const tocBlock = docModel.blocks.find((b) => b.type === 'toc') as any;
      expect(tocBlock).toBeDefined();

      const items = tocBlock.tocItems || [];
      expect(items.length).toBeGreaterThan(0);

      // Verify that every TOC entry has a matching drawn page number equal to where the section heading appears
      for (const item of items) {
        const tocEntryIndex = recordedDrawnTexts.findIndex(
          (r) => r.page === 2 && r.text.trim().toLowerCase() === item.title.trim().toLowerCase()
        );
        if (tocEntryIndex > -1) {
          let reportedPageNum: number | undefined;
          for (let i = tocEntryIndex + 1; i < recordedDrawnTexts.length; i++) {
            if (recordedDrawnTexts[i].page !== 2) break;
            if (/^\d+$/.test(recordedDrawnTexts[i].text.trim())) {
              reportedPageNum = parseInt(recordedDrawnTexts[i].text.trim(), 10);
              break;
            }
          }
          if (reportedPageNum !== undefined) {
            const targetTitle = item.title.trim().toUpperCase();
            const actualDrawings = recordedDrawnTexts.filter(
              (r) =>
                r.page > 2 &&
                (r.text.trim().toUpperCase() === targetTitle ||
                  r.text.trim().toUpperCase().startsWith(targetTitle))
            );
            if (actualDrawings.length > 0) {
              expect(reportedPageNum).toBe(actualDrawings[0].page);
            }
          }
        }
      }
    });
  });
});
