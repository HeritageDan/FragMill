import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import JSZip from 'jszip';
import { generateSoilSummaryExcelReport } from './soilSummaryExcelGenerator';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
} from '../../types/geolab';

describe('Soil Summary Excel Generator (Fiche Récapitulative des Sols)', () => {
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
    reportFooterText: 'Certified Geotechnical Laboratory Quality Assurance Report',
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
    sampleId: 'Puit 1 (Sable sablo-graveleux)',
    depth: '1.50 - 2.50 m',
    samplingDate: '2026-10-20',
    sampler: 'E. Martin',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
  };

  const mockGrainSizeAnalysis: GeoLabAnalysis = {
    id: 'an-gs-1',
    sampleId: 'sample-1',
    testType: 'grain_size',
    standard: 'NF P94-056',
    reportNumber: 'LAB-2026-001',
    version: 1,
    status: 'approved',
    testedDate: '2026-10-21',
    qualityWarnings: [],
    createdAt: '2026-10-21',
    updatedAt: '2026-10-21',
    rawInput: {
      initialMassG: 5000,
      washedMassG: 4850,
      dryMassAfterWashingG: 4850,
      sieves: [
        { apertureMm: 80, retainedMassG: 0, passingPercent: 100 },
        { apertureMm: 50, retainedMassG: 0, passingPercent: 100 },
        { apertureMm: 20, retainedMassG: 140, passingPercent: 97.2 },
        { apertureMm: 10, retainedMassG: 360, passingPercent: 90.0 },
        { apertureMm: 5, retainedMassG: 600, passingPercent: 78.0 },
        { apertureMm: 2, retainedMassG: 750, passingPercent: 63.0 },
        { apertureMm: 1, retainedMassG: 850, passingPercent: 46.0 },
        { apertureMm: 0.4, retainedMassG: 900, passingPercent: 28.0 },
        { apertureMm: 0.2, retainedMassG: 600, passingPercent: 16.0 },
        { apertureMm: 0.08, retainedMassG: 650, passingPercent: 3.0 },
      ],
    },
    computedResults: {
      finesPercent: 3.0,
      sandPercent: 60.0,
      gravelPercent: 37.0,
      d10Mm: 0.12,
      d30Mm: 0.45,
      d60Mm: 1.8,
      cu: 15.0,
      cc: 0.94,
      lcpcClassification: 'Sb (Sable bien gradué)',
      sieves: [
        { apertureMm: 80, retainedMassG: 0, passingPercent: 100 },
        { apertureMm: 50, retainedMassG: 0, passingPercent: 100 },
        { apertureMm: 20, retainedMassG: 140, passingPercent: 97.2 },
        { apertureMm: 10, retainedMassG: 360, passingPercent: 90.0 },
        { apertureMm: 5, retainedMassG: 600, passingPercent: 78.0 },
        { apertureMm: 2, retainedMassG: 750, passingPercent: 63.0 },
        { apertureMm: 1, retainedMassG: 850, passingPercent: 46.0 },
        { apertureMm: 0.4, retainedMassG: 900, passingPercent: 28.0 },
        { apertureMm: 0.2, retainedMassG: 600, passingPercent: 16.0 },
        { apertureMm: 0.08, retainedMassG: 650, passingPercent: 3.0 },
      ],
    },
  };

  const mockProctorAnalysis: GeoLabAnalysis = {
    id: 'an-pr-1',
    sampleId: 'sample-1',
    testType: 'proctor',
    standard: 'NF P94-093',
    reportNumber: 'LAB-2026-002',
    version: 1,
    status: 'approved',
    testedDate: '2026-10-22',
    qualityWarnings: [],
    createdAt: '2026-10-22',
    updatedAt: '2026-10-22',
    rawInput: {
      proctorType: 'modified',
      moldType: 'cbr',
      particleDensityGs: 2.75,
      points: [
        { pointNumber: 1, waterContentPercent: 4.5, dryDensityGcm3: 2.12 },
        { pointNumber: 2, waterContentPercent: 6.5, dryDensityGcm3: 2.21 },
        { pointNumber: 3, waterContentPercent: 8.0, dryDensityGcm3: 2.24 },
        { pointNumber: 4, waterContentPercent: 9.8, dryDensityGcm3: 2.18 },
        { pointNumber: 5, waterContentPercent: 11.5, dryDensityGcm3: 2.08 },
      ],
    },
    computedResults: {
      optimumWaterContentPercent: 7.8,
      maxDryDensityGcm3: 2.245,
      cbrAt95Percent: 42,
    },
  };

  const mockWaterContentAnalysis: GeoLabAnalysis = {
    id: 'an-wc-1',
    sampleId: 'sample-1',
    testType: 'water_content',
    standard: 'NF P94-050',
    reportNumber: 'LAB-2026-003',
    version: 1,
    status: 'approved',
    testedDate: '2026-10-20',
    qualityWarnings: [],
    createdAt: '2026-10-20',
    updatedAt: '2026-10-20',
    rawInput: {},
    computedResults: {
      averageWaterContentPercent: 8.4,
    },
  };

  it('generates a valid OpenXML workbook blob matching the reference layout', async () => {
    const blob = await generateSoilSummaryExcelReport({
      sample: mockSample,
      project: mockProject,
      client: mockClient,
      orgProfile: mockOrg,
      analyses: [mockGrainSizeAnalysis, mockProctorAnalysis, mockWaterContentAnalysis],
      language: 'fr',
      destination: 'Couche de Forme / Remblai',
      conforme: 'Oui',
      observations: 'Matériau bien gradué conforme aux spécifications CCTG Fascicule 70.',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    // Check OpenXML packaging
    expect(zip.file('[Content_Types].xml')).toBeDefined();
    expect(zip.file('xl/workbook.xml')).toBeDefined();
    expect(zip.file('xl/worksheets/sheet1.xml')).toBeDefined();
    expect(zip.file('xl/drawings/drawing1.xml')).toBeDefined();
    expect(zip.file('xl/charts/chart1.xml')).toBeDefined();
    expect(zip.file('xl/charts/chart2.xml')).toBeDefined();

    // Verify ZERO screenshot PNG files
    const mediaFiles = Object.keys(zip.files).filter((k) => k.startsWith('xl/media/'));
    expect(mediaFiles).toHaveLength(0);

    // Read sheet XML
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('ASSURANCE QUALITE');
    expect(sheetXml).toContain('FICHE RECAPITULATIVE DES SOLS');
    expect(sheetXml).toContain('Puit 1 (Sable sablo-graveleux)');
    expect(sheetXml).toContain('Autoroute A10');
    expect(sheetXml).toContain('Bouygues Travaux Publics');
    expect(sheetXml).toContain('Tamis');
    expect(sheetXml).toContain('Passant (%)');
    expect(sheetXml).toContain('OPM');
    expect(sheetXml).toContain('Classification');
    expect(sheetXml).toContain('Vérifié par');

    // Parse with SheetJS to verify structure
    const ab = await blob.arrayBuffer();
    const workbook = xlsx.read(ab, { type: 'array' });
    expect(workbook.SheetNames).toContain('Fiche_Recap');
    const sheet = workbook.Sheets['Fiche_Recap'];
    expect(sheet).toBeDefined();
  });

  it('embeds two real native DrawingML charts with correct series and formula references', async () => {
    const blob = await generateSoilSummaryExcelReport({
      sample: mockSample,
      project: mockProject,
      client: mockClient,
      orgProfile: mockOrg,
      analyses: [mockGrainSizeAnalysis, mockProctorAnalysis],
      language: 'fr',
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    // Verify drawing anchors
    const drawingXml = await zip.file('xl/drawings/drawing1.xml')!.async('string');
    expect(drawingXml).toContain('Chart_Granulo');
    expect(drawingXml).toContain('Chart_Proctor');
    expect(drawingXml).toContain('r:id="rIdChart1"');
    expect(drawingXml).toContain('r:id="rIdChart2"');
    expect(drawingXml).not.toContain('<xdr:pic>');

    // Chart 1: Logarithmic PSD Chart
    const chart1Xml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(chart1Xml).toContain('<c:scatterChart>');
    expect(chart1Xml).toContain('<c:logBase val="10"/>');
    expect(chart1Xml).toContain("'Fiche_Recap'!$I$4:$I$34"); // Sieve apertures
    expect(chart1Xml).toContain("'Fiche_Recap'!$J$4:$J$34"); // Passing fractions
    expect(chart1Xml).toContain('COURBE GRANULOMETRIQUE');

    // Chart 2: Proctor Compaction & Saturation Chart
    const chart2Xml = await zip.file('xl/charts/chart2.xml')!.async('string');
    expect(chart2Xml).toContain('<c:scatterChart>');
    expect(chart2Xml).toContain('<c:trendline>');
    expect(chart2Xml).toContain('<c:trendlineType val="poly"/>');
    expect(chart2Xml).toContain('<c:order val="2"/>');
    expect(chart2Xml).toContain("'Fiche_Recap'!$M$6:$M$10"); // Proctor moisture
    expect(chart2Xml).toContain("'Fiche_Recap'!$N$6:$N$10"); // Proctor dry density
    expect(chart2Xml).toContain("'Fiche_Recap'!$O$15:$O$19"); // Saturation moisture
    expect(chart2Xml).toContain("'Fiche_Recap'!$M$15:$M$19"); // Saturation dry density
    expect(chart2Xml).toContain('COURBE PROCTOR ET SATURATION');
  });

  it('supports English language generation', async () => {
    const blob = await generateSoilSummaryExcelReport({
      sample: mockSample,
      project: mockProject,
      client: mockClient,
      orgProfile: mockOrg,
      analyses: [mockGrainSizeAnalysis, mockProctorAnalysis],
      language: 'en',
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('QUALITY ASSURANCE');
    expect(sheetXml).toContain('SOIL SUMMARY REPORT');
    expect(sheetXml).toContain('Material description:');
    expect(sheetXml).toContain('Test');
    expect(sheetXml).toContain('Results');
    expect(sheetXml).toContain('Classification');
    expect(sheetXml).toContain('Conforming');

    const chart1Xml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(chart1Xml).toContain('PARTICLE SIZE DISTRIBUTION');

    const chart2Xml = await zip.file('xl/charts/chart2.xml')!.async('string');
    expect(chart2Xml).toContain('PROCTOR COMPACTION AND SATURATION');
  });

  it('works gracefully when no analyses are provided (uses reference standards)', async () => {
    const blob = await generateSoilSummaryExcelReport({
      sample: mockSample,
      project: mockProject,
      client: mockClient,
      orgProfile: mockOrg,
      analyses: [],
    });

    expect(blob).toBeInstanceOf(Blob);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('xl/charts/chart1.xml')).toBeDefined();
    expect(zip.file('xl/charts/chart2.xml')).toBeDefined();
  });
});
