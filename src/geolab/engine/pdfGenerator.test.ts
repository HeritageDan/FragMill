import { describe, it, expect } from 'vitest';
import { generateGeoLabPdfReport } from './pdfGenerator';
import { proctorTestDefinition } from '../tests/proctor';
import { grainSizeTestDefinition } from '../tests/grainSize';
import { waterContentTestDefinition } from '../tests/waterContent';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
} from '../../types/geolab';

describe('GeoLab PDF Generator with Vector Charts and Branding', () => {
  const mockOrg: OrganisationProfile = {
    companyName: 'GeoLab Materials & Soil Testing Laboratory',
    address: '142 Boulevard de la Recherche, 75013 Paris',
    phone: '+33 1 45 87 90 20',
    email: 'contact@geolab-testing.com',
    accreditationNumber: 'COFRAC / ISO 17025 N° 1-4820',
    primaryColor: '#1e40af',
    signatories: [
      { role: 'prepared', name: 'J. Dupont', title: 'Lab Tech' },
      { role: 'checked', name: 'M. Lambert', title: 'QA Lead' },
      { role: 'approved', name: 'Dr. H. Kemekong', title: 'Technical Director' },
    ],
    reportFooterText: 'Certified Geotechnical Laboratory Report',
    defaultLanguage: 'fr',
    defaultStandard: 'NF',
  };

  const mockClient: GeoLabClient = {
    id: 'client-1',
    companyName: 'Bouygues Travaux Publics',
    contactPerson: 'Pierre Moreau',
    email: 'pmoreau@bouygues-tp.com',
    phone: '+33 1 30 60 20 00',
    address: '1 Avenue Eugène Freyssinet',
    city: 'Guyancourt',
    country: 'France',
    isArchived: false,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  const mockProject: GeoLabProject = {
    id: 'proj-1',
    clientId: 'client-1',
    projectName: 'Autoroute A10 - Élargissement PK 40+800',
    siteLocation: 'PK 40+800 Côté Gauche',
    referenceNumber: 'CTR-2026-A10-09',
    startDate: '2026-10-15',
    isArchived: false,
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  const mockSample: GeoLabSample = {
    id: 'sample-1',
    projectId: 'proj-1',
    sampleId: 'Puit 1 (Sable sableuse)',
    depth: '1.50 - 2.50 m',
    samplingDate: '2026-10-20',
    sampler: 'E. Martin',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  it('generates valid PDF Blob for Proctor analysis', async () => {
    const rawInput = {
      mouldType: 'cbr' as const,
      mouldVolumeCm3: 2124,
      particleDensityGs: 2.82,
      points: [
        { pointIndex: 1, waterContentPercent: 4.3, dryDensityGcm3: 2.115 },
        { pointIndex: 2, waterContentPercent: 6.7, dryDensityGcm3: 2.213 },
        { pointIndex: 3, waterContentPercent: 8.2, dryDensityGcm3: 2.21 },
        { pointIndex: 4, waterContentPercent: 10.5, dryDensityGcm3: 2.129 },
        { pointIndex: 5, waterContentPercent: 12.0, dryDensityGcm3: 2.04 },
      ],
    };
    const computedResults = proctorTestDefinition.calculate(rawInput);

    const analysis: GeoLabAnalysis = {
      id: 'analysis-1',
      sampleId: 'sample-1',
      testType: 'proctor',
      standard: 'NF P94-093',
      reportNumber: 'GL-2026-0042',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-22',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const blob = await generateGeoLabPdfReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: proctorTestDefinition,
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/pdf');
  });

  it('generates valid PDF Blob for Grain size analysis', async () => {
    const rawInput = {
      sieves: [
        { sieveMm: 25, passingPercent: 100 },
        { sieveMm: 2, passingPercent: 97.2 },
        { sieveMm: 0.4, passingPercent: 44.0 },
        { sieveMm: 0.08, passingPercent: 0.3 },
      ],
    };
    const computedResults = grainSizeTestDefinition.calculate(rawInput);

    const analysis: GeoLabAnalysis = {
      id: 'analysis-2',
      sampleId: 'sample-1',
      testType: 'grain_size',
      standard: 'NF P94-056',
      reportNumber: 'GL-2026-0043',
      version: 1,
      status: 'draft',
      testedDate: '2026-10-23',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const blob = await generateGeoLabPdfReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: grainSizeTestDefinition,
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('generates valid PDF Blob for Water content analysis', async () => {
    const rawInput = {
      specimens: [
        { specimenId: 'A', containerId: 'T1', tareMassG: 45.2, wetSoilPlusTareG: 198.6, drySoilPlusTareG: 183.8 },
      ],
    };
    const computedResults = waterContentTestDefinition.calculate(rawInput);

    const analysis: GeoLabAnalysis = {
      id: 'analysis-3',
      sampleId: 'sample-1',
      testType: 'water_content',
      standard: 'NF P94-050',
      reportNumber: 'GL-2026-0044',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-24',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const blob = await generateGeoLabPdfReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: waterContentTestDefinition,
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });
});
