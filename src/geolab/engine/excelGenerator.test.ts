import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import JSZip from 'jszip';
import { generateGeoLabExcelReport } from './excelGenerator';
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

describe('GeoLab Excel Generator with Native DrawingML Charts', () => {
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

  it('generates valid Proctor Excel workbook with live formulas and native DrawingML scatter chart', async () => {
    const rawInput = {
      mouldType: 'cbr' as const,
      mouldVolumeCm3: 2124,
      particleDensityGs: 2.82,
      targetCompactionPercent: 95,
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

    const blob = await generateGeoLabExcelReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: proctorTestDefinition,
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(2000);

    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Verify OpenXML parts exist
    expect(zip.file('xl/worksheets/sheet1.xml')).not.toBeNull();
    expect(zip.file('xl/drawings/drawing1.xml')).not.toBeNull();
    expect(zip.file('xl/charts/chart1.xml')).not.toBeNull();

    // Verify chart XML content
    const chartXml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(chartXml).toContain('c:scatterChart');
    expect(chartXml).toContain('c:trendline');

    // Verify live formulas in worksheet
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('<f>C10/(1+B10/100)</f>');

    // Verify SheetJS can read the workbook
    const wb = xlsx.read(new Uint8Array(arrayBuffer), { type: 'array' });
    expect(wb.SheetNames).toContain('Rapport');
  });

  it('generates valid Grain Size Excel workbook with log scale DrawingML chart', async () => {
    const rawInput = {
      sieves: [
        { sieveMm: 25, passingPercent: 100 },
        { sieveMm: 20, passingPercent: 100 },
        { sieveMm: 5, passingPercent: 100 },
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

    const blob = await generateGeoLabExcelReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: grainSizeTestDefinition,
    });

    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    expect(zip.file('xl/charts/chart1.xml')).not.toBeNull();
    const chartXml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(chartXml).toContain('<c:logBase val="10"/>');

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('DRAFT / PROVISOIRE'); // Draft watermark
  });

  it('generates valid Water Content Excel workbook with live formulas', async () => {
    const rawInput = {
      specimens: [
        { specimenId: 'A', containerId: 'T1', tareMassG: 45.2, wetSoilPlusTareG: 198.6, drySoilPlusTareG: 183.8 },
        { specimenId: 'B', containerId: 'T2', tareMassG: 44.8, wetSoilPlusTareG: 202.1, drySoilPlusTareG: 187.1 },
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

    const blob = await generateGeoLabExcelReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: waterContentTestDefinition,
    });

    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('AVERAGE(H9:H10)');
  });

  it('blocks final approved report when company name is empty', async () => {
    const rawInput = {
      specimens: [
        { specimenId: 'A', containerId: 'T1', tareMassG: 45.2, wetSoilPlusTareG: 198.6, drySoilPlusTareG: 183.8 },
      ],
    };
    const computedResults = waterContentTestDefinition.calculate(rawInput);
    const approvedAnalysis: GeoLabAnalysis = {
      id: 'analysis-block-test',
      sampleId: 'sample-1',
      testType: 'water_content',
      standard: 'NF P94-050',
      reportNumber: 'GL-2026-BLOCK',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-24',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const emptyOrg: OrganisationProfile = {
      ...mockOrg,
      companyName: '   ',
    };

    await expect(
      generateGeoLabExcelReport({
        analysis: approvedAnalysis,
        client: mockClient,
        project: mockProject,
        sample: mockSample,
        orgProfile: emptyOrg,
        testDef: waterContentTestDefinition,
      })
    ).rejects.toThrow(/Veuillez configurer le profil de votre organisation|Please configure your organisation profile/);

    // Draft reports must remain allowed even if companyName is empty
    const draftAnalysis: GeoLabAnalysis = {
      ...approvedAnalysis,
      status: 'draft',
    };
    const draftBlob = await generateGeoLabExcelReport({
      analysis: draftAnalysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: emptyOrg,
      testDef: waterContentTestDefinition,
    });
    expect(draftBlob).toBeDefined();
  });

  it('embeds logos, sets landscape page setup fit to 1 page wide, and verifies visible trendline & saturation curve', async () => {
    const tinyPngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const brandedOrg: OrganisationProfile = {
      ...mockOrg,
      logos: {
        left: tinyPngBase64,
        center: tinyPngBase64,
        right: tinyPngBase64,
      },
      bilingualHeader: {
        column1: 'RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\nMINISTÈRE DES TRAVAUX PUBLICS',
        column2: 'REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\nMINISTRY OF PUBLIC WORKS',
      },
      accreditationNumber: 'N° 123/MINTP/LABO',
      formCodes: {
        proctor: 'PR2-FOR-02 Ind A',
      },
      approvalChain: [
        { id: '1', role: "L'Opérateur", name: 'E. Martin', date: '2026-10-22' },
        { id: '2', role: 'Le Chef de Section', name: 'M. Lambert', date: '2026-10-22' },
        { id: '3', role: 'Le Responsable Laboratoire', name: 'Dr. H. Kemekong', date: '2026-10-23' },
      ],
    };

    const projectWithMeta: GeoLabProject = {
      ...mockProject,
      programmeTitle: 'Projet de Développement des Secteurs Urbains',
      lotSection: 'Lot 2 : Tronçon Nord',
      contractNumber: 'CT-2026/MINTP/045',
      tenderNumber: 'DAO N° 12/MINTP/2026',
      financing: 'Banque Mondiale (IDA) / BIP',
    };

    const rawInput = {
      mouldType: 'cbr' as const,
      mouldVolumeCm3: 2124,
      particleDensityGs: 2.82,
      targetCompactionPercent: 95,
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
      id: 'analysis-proctor-quality',
      sampleId: 'sample-1',
      testType: 'proctor',
      standard: 'NF P94-093',
      reportNumber: 'DEMO-GL-2026-0099',
      version: 1,
      status: 'approved',
      isDemo: true,
      testedDate: '2026-10-22',
      rawInput,
      computedResults,
      qualityWarnings: [],
      revisions: [
        { revNumber: 0, date: '2026-10-22', author: 'E. Martin', description: 'Émission initiale / Initial issue' },
      ],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const blob = await generateGeoLabExcelReport({
      analysis,
      client: mockClient,
      project: projectWithMeta,
      sample: mockSample,
      orgProfile: brandedOrg,
      testDef: proctorTestDefinition,
    });

    const arrayBuffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Verify embedded images in xl/media/
    expect(zip.file('xl/media/imageLeft.png')).not.toBeNull();
    expect(zip.file('xl/media/imageCenter.png')).not.toBeNull();
    expect(zip.file('xl/media/imageRight.png')).not.toBeNull();

    // Verify drawing anchors
    const drawingXml = await zip.file('xl/drawings/drawing1.xml')!.async('string');
    expect(drawingXml).toContain('twoCellAnchor');
    expect(drawingXml).toContain('xdr:graphicFrame'); // embedded chart anchor
    expect(drawingXml).toContain('rIdChart');

    // Verify landscape page setup and fitToWidth="1"
    const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheetXml).toContain('orientation="landscape"');
    expect(sheetXml).toContain('fitToWidth="1"');
    expect(sheetXml).toContain('fitToPage="1"');

    // Verify DEMO watermark or badge
    expect(sheetXml).toContain('DEMO');

    // Verify accreditation label and form code
    expect(sheetXml).toContain("N° d'agrément / d'accréditation");
    expect(sheetXml).toContain('PR2-FOR-02 Ind A');

    // Verify project metadata
    expect(sheetXml).toContain('Projet de Développement des Secteurs Urbains');
    expect(sheetXml).toContain('Lot 2 : Tronçon Nord');

    // Verify chart XML contains trendline and dashed saturation line series
    const chartXml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(chartXml).toContain('<c:trendline>');
    expect(chartXml).toContain('<c:trendlineType val="poly"/>');
    expect(chartXml).toContain('<a:prstDash val="dash"/>'); // Saturation curve is dashed
  });

  it('sheet name matches chart references for both French (Rapport) and English (Report)', async () => {
    const rawInput = {
      mouldType: 'cbr' as const,
      mouldVolumeCm3: 2124,
      particleDensityGs: 2.82,
      targetCompactionPercent: 95,
      points: [
        { pointIndex: 1, waterContentPercent: 4.3, dryDensityGcm3: 2.115 },
        { pointIndex: 2, waterContentPercent: 6.7, dryDensityGcm3: 2.213 },
        { pointIndex: 3, waterContentPercent: 8.2, dryDensityGcm3: 2.21 },
        { pointIndex: 4, waterContentPercent: 10.5, dryDensityGcm3: 2.129 },
        { pointIndex: 5, waterContentPercent: 12.0, dryDensityGcm3: 2.04 },
      ],
    };
    const computedResults = proctorTestDefinition.calculate(rawInput);

    const testAnalysis: GeoLabAnalysis = {
      id: 'analysis-sheet-name-match',
      sampleId: 'sample-1',
      testType: 'proctor',
      standard: 'NF P94-093',
      reportNumber: 'GL-2026-0099',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-22',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    // 1. French: Expected sheet tab 'Rapport' and chart formulas referencing 'Rapport'!
    const blobFr = await generateGeoLabExcelReport({
      analysis: testAnalysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: proctorTestDefinition,
      language: 'fr',
    });

    const zipFr = await JSZip.loadAsync(await blobFr.arrayBuffer());
    const wbFrXml = await zipFr.file('xl/workbook.xml')!.async('string');
    expect(wbFrXml).toContain('<sheet name="Rapport"');
    expect(wbFrXml).not.toContain('GeoLab Report');

    const chartFrXml = await zipFr.file('xl/charts/chart1.xml')!.async('string');
    expect(chartFrXml).toContain("'Rapport'!$B$");
    expect(chartFrXml).toContain("'Rapport'!$D$");
    expect(chartFrXml).toContain("'Rapport'!$F$");
    expect(chartFrXml).not.toContain('GeoLab Report');

    // 2. English: Expected sheet tab 'Report' and chart formulas referencing 'Report'!
    const blobEn = await generateGeoLabExcelReport({
      analysis: testAnalysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: proctorTestDefinition,
      language: 'en',
    });

    const zipEn = await JSZip.loadAsync(await blobEn.arrayBuffer());
    const wbEnXml = await zipEn.file('xl/workbook.xml')!.async('string');
    expect(wbEnXml).toContain('<sheet name="Report"');
    expect(wbEnXml).not.toContain('GeoLab Report');

    const chartEnXml = await zipEn.file('xl/charts/chart1.xml')!.async('string');
    expect(chartEnXml).toContain("'Report'!$B$");
    expect(chartEnXml).toContain("'Report'!$D$");
    expect(chartEnXml).toContain("'Report'!$F$");
    expect(chartEnXml).not.toContain('GeoLab Report');
  });

  it('embeds high-resolution chart image in Excel and validates <c:numCache> for Proctor', async () => {
    const rawInput = {
      mouldType: 'cbr' as const,
      mouldVolumeCm3: 2124,
      particleDensityGs: 2.82,
      targetCompactionPercent: 95,
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
      id: 'analysis-proctor-chart-test',
      sampleId: 'sample-1',
      testType: 'proctor',
      standard: 'NF P94-093',
      reportNumber: 'GL-2026-CHART-01',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-22',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const blob = await generateGeoLabExcelReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: proctorTestDefinition,
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    // 1. Drawing XML references chart image
    expect(zip.file('xl/drawings/drawing1.xml')).not.toBeNull();
    const drawingXml = await zip.file('xl/drawings/drawing1.xml')!.async('string');
    expect(drawingXml).toContain('TestChartImage');
    expect(drawingXml).toContain('r:embed="rIdChartImg"');

    // 2. Media contains chart image binary
    expect(zip.file('xl/media/chartImage.png')).not.toBeNull();

    // 3. DrawingML chart has <c:numCache> with correct points
    const chartXml = await zip.file('xl/charts/chart1.xml')!.async('string');
    expect(chartXml).toContain('<c:numCache>');
    expect(chartXml).toContain('<c:ptCount val="5"/>');
    expect(chartXml).toContain('<c:v>4.3</c:v>');
    expect(chartXml).toContain('<c:v>2.115</c:v>');
  });

  it('embeds chart image in Excel results for tests with graphs (e.g. water content)', async () => {
    const rawInput = {
      specimens: [
        { specimenId: 'A', containerId: 'T1', tareMassG: 45.2, wetSoilPlusTareG: 198.6, drySoilPlusTareG: 183.8 },
        { specimenId: 'B', containerId: 'T2', tareMassG: 44.8, wetSoilPlusTareG: 202.1, drySoilPlusTareG: 187.1 },
      ],
    };
    const computedResults = waterContentTestDefinition.calculate(rawInput);
    const analysis: GeoLabAnalysis = {
      id: 'analysis-water-chart-test',
      sampleId: 'sample-1',
      testType: 'water_content',
      standard: 'NF P94-050',
      reportNumber: 'GL-2026-WATER-CHART',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-24',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const blob = await generateGeoLabExcelReport({
      analysis,
      client: mockClient,
      project: mockProject,
      sample: mockSample,
      orgProfile: mockOrg,
      testDef: waterContentTestDefinition,
    });

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('xl/drawings/drawing1.xml')).not.toBeNull();
    const drawingXml = await zip.file('xl/drawings/drawing1.xml')!.async('string');
    expect(drawingXml).toContain('TestChartImage');
    expect(zip.file('xl/media/chartImage.png')).not.toBeNull();
  });
});

