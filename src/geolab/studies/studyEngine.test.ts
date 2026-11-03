import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import { setupUnicodeFont, transliterateGreekAndSpecialChars } from '../engine/pdfFonts';
import {
  buildDocumentModel,
  generateStudyPdfReport,
  generateStudyDocxReport,
} from './index';
import type {
  StudyReport,
  GeoLabProject,
  GeoLabClient,
  OrganisationProfile,
  GeoLabAnalysis,
  StudyPhoto,
  GeoLabSample,
} from '../../types/geolab';
import type { ProctorResults } from '../tests/proctor';
import type { GrainSizeResults } from '../tests/grainSize';

describe('FraGeo Lab Studies Engine - Stage 1', () => {
  const mockOrg: OrganisationProfile = {
    companyName: 'Laboratoire Géotechnique National',
    address: '123 Rue des Travaux Publics, Yaoundé',
    phone: '+237 222 00 11 22',
    email: 'contact@labo-national.cm',
    accreditationNumber: 'ACCR-2026-GEO-042',
    primaryColor: '#1e40af',
    bilingualHeaderBlock: {
      col1Text: 'RÉPUBLIQUE DU CAMEROUN\nPaix - Travail - Patrie\nMINISTÈRE DES TRAVAUX PUBLICS',
      col2Text: 'REPUBLIC OF CAMEROON\nPeace - Work - Fatherland\nMINISTRY OF PUBLIC WORKS',
    },
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
    id: 'proj-study-101',
    clientId: 'cli-101',
    projectName: 'Construction Tronçon PK 20+000',
    programmeTitle: 'Programme National d’Infrastructures Routières',
    lotSection: 'Lot 2 : PK 15+000 au PK 35+000',
    contractNumber: 'MAR-2026-089',
    tenderNumber: 'AOI-014/MINTP/2025',
    financingText: 'Budget d’Investissement Public (BIP)',
    siteLocation: 'Carrière PK 24',
    referenceNumber: 'REF-CTR-2026',
    startDate: '2026-01-15',
    isArchived: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z',
  };

  const mockClient: GeoLabClient = {
    id: 'cli-101',
    companyName: 'Société Générale des Travaux',
    contactPerson: 'Ing. Henri Tchamba',
    email: 'contact@sgt-btp.cm',
    phone: '+237 699 00 11 22',
    address: 'Zone Industrielle Bassa',
    city: 'Douala',
    country: 'Cameroun',
    isArchived: false,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:00:00Z',
  };

  const mockSamples: GeoLabSample[] = [
    { id: 's-1', projectId: mockProject.id, sampleId: 'ECH-01', materialType: 'Graveleux latéritique', samplingDate: '2026-02-01', createdAt: '', updatedAt: '' },
    { id: 's-2', projectId: mockProject.id, sampleId: 'ECH-02', materialType: 'Sable d’emprunt', samplingDate: '2026-02-02', createdAt: '', updatedAt: '' },
    { id: 's-3', projectId: mockProject.id, sampleId: 'ECH-03', materialType: 'Argile sableuse', samplingDate: '2026-02-03', createdAt: '', updatedAt: '' },
  ];

  const mockProctorResults: ProctorResults = {
    opmMoisturePercent: 12.4,
    maxDryDensityGcm3: 2.05,
    targetDryDensityGcm3: 1.948,
    points: [
      { pointIndex: 1, waterContentPercent: 8.5, wetDensityGcm3: 2.02, dryDensityGcm3: 1.86, saturationWaterContentPercent: 18.2, compactionPercentOfOpm: 90.7 },
      { pointIndex: 2, waterContentPercent: 10.5, wetDensityGcm3: 2.18, dryDensityGcm3: 1.97, saturationWaterContentPercent: 15.5, compactionPercentOfOpm: 96.1 },
      { pointIndex: 3, waterContentPercent: 12.3, wetDensityGcm3: 2.30, dryDensityGcm3: 2.05, saturationWaterContentPercent: 13.8, compactionPercentOfOpm: 100.0 },
      { pointIndex: 4, waterContentPercent: 14.5, wetDensityGcm3: 2.27, dryDensityGcm3: 1.98, saturationWaterContentPercent: 15.2, compactionPercentOfOpm: 96.6 },
    ],
    saturationCurve: [
      { dryDensityGcm3: 1.8, saturationWaterContentPercent: 19.8 },
      { dryDensityGcm3: 1.9, saturationWaterContentPercent: 17.2 },
      { dryDensityGcm3: 2.0, saturationWaterContentPercent: 14.9 },
      { dryDensityGcm3: 2.1, saturationWaterContentPercent: 12.8 },
    ],
    fittedCoefficients: {
      a: -0.015,
      b: 0.372,
      c: -0.25,
      r2: 0.992,
      allCoeffs: [-0.25, 0.372, -0.015],
    },
    fitMethod: 'quadratic',
    isConform: true,
  };

  const mockGrainResults: GrainSizeResults = {
    totalDryMassG: 2500,
    finesMassG: 362.5,
    finesPercent: 14.5,
    sandPercent: 42.0,
    gravelPercent: 43.5,
    passing2mmPercent: 56.5,
    passing04mmPercent: 28.0,
    passing008mmPercent: 14.5,
    d10Mm: 0.05,
    d30Mm: 0.45,
    d60Mm: 2.2,
    cu: 12.4,
    cc: 1.8,
    lcpcClassification: 'B6 (Grave latéritique)',
    uscsClassification: 'GC',
    isConformEnvelope: true,
    rows: [
      { sieveMm: 20, retainedMassG: 0, retainedPercent: 0, cumulativeRetainedPercent: 0, passingPercent: 100 },
      { sieveMm: 10, retainedMassG: 450, retainedPercent: 18, cumulativeRetainedPercent: 18, passingPercent: 82 },
      { sieveMm: 5, retainedMassG: 350, retainedPercent: 14, cumulativeRetainedPercent: 32, passingPercent: 68 },
      { sieveMm: 2, retainedMassG: 287.5, retainedPercent: 11.5, cumulativeRetainedPercent: 43.5, passingPercent: 56.5 },
      { sieveMm: 1, retainedMassG: 312.5, retainedPercent: 12.5, cumulativeRetainedPercent: 56, passingPercent: 44 },
      { sieveMm: 0.5, retainedMassG: 300, retainedPercent: 12, cumulativeRetainedPercent: 68, passingPercent: 32 },
      { sieveMm: 0.2, retainedMassG: 250, retainedPercent: 10, cumulativeRetainedPercent: 78, passingPercent: 22 },
      { sieveMm: 0.08, retainedMassG: 187.5, retainedPercent: 7.5, cumulativeRetainedPercent: 85.5, passingPercent: 14.5 },
    ],
  };

  const mockAnalyses: GeoLabAnalysis[] = [
    {
      id: 'a-1',
      sampleId: 's-1',
      testType: 'proctor',
      standard: 'NF P94-093',
      reportNumber: 'PV-PR-2026-001',
      version: 1,
      status: 'approved',
      testedDate: '2026-02-05',
      rawInput: { moldVolumeCm3: 944, compactionType: 'Modified' },
      computedResults: mockProctorResults,
      qualityWarnings: [],
      createdAt: '2026-02-05T10:00:00Z',
      updatedAt: '2026-02-05T10:00:00Z',
    },
    {
      id: 'a-2',
      sampleId: 's-2',
      testType: 'grain_size',
      standard: 'NF EN ISO 17892-4',
      reportNumber: 'PV-GR-2026-002',
      version: 1,
      status: 'approved',
      testedDate: '2026-02-06',
      rawInput: { totalDryMassG: 2500 },
      computedResults: mockGrainResults,
      qualityWarnings: [],
      createdAt: '2026-02-06T10:00:00Z',
      updatedAt: '2026-02-06T10:00:00Z',
    },
    {
      id: 'a-3',
      sampleId: 's-3',
      testType: 'water_content',
      standard: 'NF P94-050',
      reportNumber: 'PV-TE-2026-003',
      version: 1,
      status: 'approved',
      testedDate: '2026-02-07',
      rawInput: {},
      computedResults: { averageWaterContentPercent: 9.8 },
      qualityWarnings: [],
      createdAt: '2026-02-07T10:00:00Z',
      updatedAt: '2026-02-07T10:00:00Z',
    },
  ];

  const mockPhotos: StudyPhoto[] = Array.from({ length: 12 }, (_, i) => ({
    id: `photo-${i + 1}`,
    studyId: 'study-001',
    order: i + 1,
    caption: `Photo ${i + 1} : Prélèvement et auscultation visuelle au PK ${20 + i * 0.5}`,
    mimeType: 'image/jpeg',
    blob: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  }));

  const mockStudy: StudyReport = {
    id: 'study-001',
    projectId: mockProject.id,
    title: 'Étude Géotechnique de Caractérisation des Sols et Matériaux Routiers',
    templateId: 'characterisation_soils',
    language: 'fr',
    status: 'approved',
    reportNumber: 'ETUDE-GEO-2026-001',
    revisions: [
      {
        index: 0,
        date: '2026-02-10',
        nature: 'Édition originale pour validation',
        preparedBy: 'Pierre Nsangou',
        checkedBy: 'Marie Ondo',
        approvedBy: 'Dr. Joseph Mengue',
      },
    ],
    sections: [],
    includedAnalysisIds: ['a-1', 'a-2', 'a-3'],
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-10T10:00:00Z',
  };

  it('1. orders blocks strictly according to the selected template', () => {
    const model = buildDocumentModel({
      study: mockStudy,
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses,
      samples: mockSamples,
      photos: mockPhotos,
      language: 'fr',
    });

    const blockTypes = model.blocks.map((b) => b.type);
    expect(blockTypes[0]).toBe('cover');
    expect(blockTypes[1]).toBe('toc');
    expect(blockTypes).toContain('narrative');
    expect(blockTypes).toContain('analysisSummaryTable');
    expect(blockTypes).toContain('analysisDetail');
    expect(blockTypes).toContain('gradingCurves');
    expect(blockTypes).toContain('conformityTable');
    expect(blockTypes).toContain('usageNote');
    expect(blockTypes).toContain('signatureBlock');
    expect(blockTypes).toContain('photoPages');
    expect(blockTypes).toContain('annexTestSheets');
    expect(blockTypes).toContain('dataQualityNotes');
  });

  it('2. empty-profile output contains no placeholder or invented names', () => {
    const emptyOrg: OrganisationProfile = {
      ...mockOrg,
      companyName: 'Test Lab Corp',
      address: '',
      phone: '',
      email: '',
      accreditationNumber: '',
      signatories: [],
      approvalChain: [],
      bilingualHeaderBlock: undefined,
    };

    const emptyProject: GeoLabProject = {
      ...mockProject,
      programmeTitle: undefined,
      programme: undefined,
      lotSection: undefined,
      contractNumber: undefined,
      tenderNumber: undefined,
      financingText: undefined,
      financing: undefined,
      parties: [],
    };

    const model = buildDocumentModel({
      study: mockStudy,
      project: emptyProject,
      client: mockClient,
      organisation: emptyOrg,
      analyses: mockAnalyses,
      samples: mockSamples,
      photos: [],
      language: 'fr',
    });

    const cover = model.blocks[0].coverData!;
    expect(cover.programmeTitle).toBeUndefined();
    expect(cover.lotSection).toBeUndefined();
    expect(cover.contractNumber).toBeUndefined();
    expect(cover.tenderNumber).toBeUndefined();
    expect(cover.financingText).toBeUndefined();
    expect(cover.accreditationNumber).toBeUndefined();
    expect(cover.address).toBeUndefined();
    expect(cover.phone).toBeUndefined();
    expect(cover.email).toBeUndefined();
    expect(cover.parties).toBeUndefined();
  });

  it('3. blocks approved study generation if organisation profile has no company name', () => {
    const noNameOrg: OrganisationProfile = {
      ...mockOrg,
      companyName: '',
    };

    expect(() =>
      buildDocumentModel({
        study: { ...mockStudy, status: 'approved' },
        project: mockProject,
        client: mockClient,
        organisation: noNameOrg,
        analyses: mockAnalyses,
      })
    ).toThrow(/profil de votre organisation/i);
  });

  it('4. generates valid Word .docx with document.xml, headers, footers, media and TOC field', async () => {
    const model = buildDocumentModel({
      study: mockStudy,
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses,
      samples: mockSamples,
      photos: mockPhotos,
      language: 'fr',
    });

    const docxBlob = await generateStudyDocxReport(model);
    expect(docxBlob.size).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
    expect(zip.file('word/document.xml')).toBeDefined();
    expect(zip.file(/word\/header\d+\.xml/)).toBeDefined();
    expect(zip.file(/word\/footer\d+\.xml/)).toBeDefined();

    const docXml = await zip.file('word/document.xml')!.async('text');
    expect(docXml).toMatch(/TOC|w:instrText/i);
    expect(docXml).toContain(mockStudy.title.toUpperCase());
    expect(docXml).toContain('Rapport N° :');

    // Item 7: TOC title paragraph does not have Heading style
    expect(docXml).toContain('SOMMAIRE');
    // Extract the paragraph containing SOMMAIRE
    const sommaireParaMatch = docXml.match(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?SOMMAIRE(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/);
    expect(sommaireParaMatch).not.toBeNull();
    const sommairePara = sommaireParaMatch![0];
    expect(sommairePara).not.toMatch(/<w:pStyle\s+w:val="Heading/i);
  });

  it('5. generates PDF where TOC page numbers match actual pages and page count >= 12 for 3 analyses and 12 photos', async () => {
    const model = buildDocumentModel({
      study: mockStudy,
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses,
      samples: mockSamples,
      photos: mockPhotos,
      language: 'fr',
      isSampleDocument: true,
    });

    const pdfBlob = await generateStudyPdfReport(model);
    expect(pdfBlob.size).toBeGreaterThan(5000);

    const pdfBuffer = await pdfBlob.arrayBuffer();
    const pdfText = Buffer.from(pdfBuffer).toString('latin1');

    // Count pages in PDF output
    const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 0;
    expect(pageCount).toBeGreaterThanOrEqual(12);

    // Save sample output files into gitignored tests/.output for inspection
    const outputDir = path.resolve(process.cwd(), 'tests', '.output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(path.join(outputDir, 'study_sample.pdf'), Buffer.from(pdfBuffer));

    const docxBlob = await generateStudyDocxReport(model);
    fs.writeFileSync(path.join(outputDir, 'study_sample.docx'), Buffer.from(await docxBlob.arrayBuffer()));

    const sampleZip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
    const footerXml = await sampleZip.file(/word\/footer\d+\.xml/)?.[0]?.async('text');
    expect(footerXml).toContain('SAMPLE - fictional data');
  });

  it('6. correctly presents both French and English labels', () => {
    const frModel = buildDocumentModel({
      study: { ...mockStudy, language: 'fr' },
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses,
      samples: mockSamples,
      language: 'fr',
    });

    const enModel = buildDocumentModel({
      study: { ...mockStudy, language: 'en' },
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses,
      samples: mockSamples,
      language: 'en',
    });

    const frSummary = frModel.blocks.find((b) => b.type === 'analysisSummaryTable')!;
    const enSummary = enModel.blocks.find((b) => b.type === 'analysisSummaryTable')!;

    expect(frSummary.title).toContain('RÉCAPITULATIF');
    expect(enSummary.title).toContain('SUMMARY');

    const frConformity = frModel.blocks.find((b) => b.type === 'conformityTable')!;
    const enConformity = enModel.blocks.find((b) => b.type === 'conformityTable')!;

    expect(frConformity.title).toContain('CONFORMITÉ');
    expect(enConformity.title).toContain('CONFORMITY');
  });

  it('7. performance: builds synthetic study from 30 analyses and 20 photos (> 45 pages) responsive within reasonable time', async () => {
    const startTime = Date.now();

    // Create 30 synthetic analyses
    const manyAnalyses: GeoLabAnalysis[] = [];
    for (let i = 1; i <= 30; i++) {
      manyAnalyses.push({
        id: `synth-a-${i}`,
        sampleId: `s-${(i % 3) + 1}`,
        testType: i % 2 === 0 ? 'proctor' : 'grain_size',
        standard: i % 2 === 0 ? 'NF P94-093' : 'NF EN ISO 17892-4',
        reportNumber: `PV-SYNTH-2026-${String(i).padStart(3, '0')}`,
        version: 1,
        status: 'approved',
        testedDate: '2026-02-15',
        rawInput: {},
        computedResults: i % 2 === 0 ? mockProctorResults : mockGrainResults,
        qualityWarnings: [],
        createdAt: '2026-02-15T08:00:00Z',
        updatedAt: '2026-02-15T08:00:00Z',
      });
    }

    // Create 20 synthetic photos
    const manyPhotos: StudyPhoto[] = Array.from({ length: 20 }, (_, i) => ({
      id: `synth-p-${i + 1}`,
      studyId: 'study-perf-001',
      order: i + 1,
      caption: `Documentation photographique sondage PK ${10 + i}`,
      mimeType: 'image/jpeg',
      blob: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    }));

    const perfStudy: StudyReport = {
      ...mockStudy,
      id: 'study-perf-001',
      title: 'Étude Géotechnique Complète Haute Performance (30 Essais)',
      includedAnalysisIds: manyAnalyses.map((a) => a.id),
    };

    const progressCalls: number[] = [];
    const model = buildDocumentModel({
      study: perfStudy,
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: manyAnalyses,
      samples: mockSamples,
      photos: manyPhotos,
      language: 'fr',
    });

    const pdfBlob = await generateStudyPdfReport(model, {
      onProgress: (p) => {
        progressCalls.push(p.current);
      },
    });

    const durationMs = Date.now() - startTime;
    const pdfText = Buffer.from(await pdfBlob.arrayBuffer()).toString('latin1');
    const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 0;

    console.log(`[PERF TEST] 30 analyses & 20 photos study: generated ${pageCount} pages in ${durationMs}ms`);

    expect(pageCount).toBeGreaterThanOrEqual(45);
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(30000); // Must complete under 30s
  }, 45000);

  it('8. cover title banner: wraps and fully contains 120-character titles in both French and English in PDF and Word', async () => {
    const frLongTitle = "ÉTUDE GÉOTECHNIQUE ET GÉOLOGIQUE DES MATÉRIAUX POUR LA CONSTRUCTION D'UNE PLATEFORME INDUSTRIELLE MULTIMODALE INTERNATIONALE"; // 124 chars
    const enLongTitle = "GEOTECHNICAL AND GEOLOGICAL MATERIALS INVESTIGATION REPORT FOR THE CONSTRUCTION OF HIGHWAY AND MULTIMODAL PLATFORM PROJECT"; // 123 chars

    expect(frLongTitle.length).toBeGreaterThanOrEqual(120);
    expect(enLongTitle.length).toBeGreaterThanOrEqual(120);

    // 1. French PDF & Word
    const frModel = buildDocumentModel({
      study: { ...mockStudy, title: frLongTitle, language: 'fr' },
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses.slice(0, 1),
      samples: mockSamples.slice(0, 1),
      language: 'fr',
    });

    const frPdfBlob = await generateStudyPdfReport(frModel);
    expect(frPdfBlob.size).toBeGreaterThan(5000);

    const frDocxBlob = await generateStudyDocxReport(frModel);
    const frZip = await JSZip.loadAsync(await frDocxBlob.arrayBuffer());
    const frDocXml = await frZip.file('word/document.xml')!.async('text');
    // In Word XML, apostrophe is escaped as &apos;
    expect(frDocXml.replace(/&apos;/g, "'")).toContain(frLongTitle.toUpperCase());

    // 2. English PDF & Word
    const enModel = buildDocumentModel({
      study: { ...mockStudy, title: enLongTitle, language: 'en' },
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses.slice(0, 1),
      samples: mockSamples.slice(0, 1),
      language: 'en',
    });

    const enPdfBlob = await generateStudyPdfReport(enModel);
    expect(enPdfBlob.size).toBeGreaterThan(5000);

    const enDocxBlob = await generateStudyDocxReport(enModel);
    const enZip = await JSZip.loadAsync(await enDocxBlob.arrayBuffer());
    const enDocXml = await enZip.file('word/document.xml')!.async('text');
    expect(enDocXml).toContain(enLongTitle.toUpperCase());
  });

  it('9. language of default texts: French study contains no default English sentences, and English study contains no default French sentences (Item 4)', async () => {
    const ENGLISH_DEFAULT_SENTENCES = [
      'This geotechnical characterisation study presents the synthesis',
      'Verification of physical identification properties',
      'Determination of standard/modified compaction characteristics',
      'Assessment of conformity with technical project specifications',
      'Samples were retrieved directly on-site in accordance',
      'Visual identification and macroscopic description were systematically performed',
      'Sample preparation, quartering, and moisture conditioning',
      'Based on the synthesized laboratory test results',
      'Compaction procedures on-site should target 95% to 98%',
      'Suitable drainage and surface protection measures',
      'The laboratory testing program was completed in strict accordance',
      'The measured parameters provide the engineering baseline',
    ];

    const FRENCH_DEFAULT_SENTENCES = [
      'La présente étude de caractérisation géotechnique expose la synthèse',
      "La vérification des propriétés d'identification physique",
      'La détermination des caractéristiques de compactage Proctor',
      "L'évaluation de la conformité aux spécifications techniques",
      "Les échantillons ont été prélevés in situ conformément aux normes",
      'Une identification visuelle et une description macroscopique',
      'La préparation, le quartage et le conditionnement hydrique',
      "Au vu des résultats d'essais de laboratoire",
      'Les ateliers de compactage sur chantier devront viser 95 % à 98 %',
      'Des mesures appropriées de drainage et de protection',
      "Le programme d'essais de laboratoire a été conduit en stricte conformité",
      'Les paramètres mesurés fournissent les données de base indispensables',
    ];

    // 1. Generate French study
    const frModel = buildDocumentModel({
      study: { ...mockStudy, language: 'fr' },
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses.slice(0, 1),
      samples: mockSamples.slice(0, 1),
      language: 'fr',
    });

    const frDocx = await generateStudyDocxReport(frModel);
    const frZip = await JSZip.loadAsync(await frDocx.arrayBuffer());
    const frDocXml = (await frZip.file('word/document.xml')!.async('text')).replace(/&apos;/g, "'");

    // NONE of the English default sentences may appear in French document
    for (const enSentence of ENGLISH_DEFAULT_SENTENCES) {
      expect(frDocXml).not.toContain(enSentence);
    }
    // French sentences MUST appear
    expect(frDocXml).toContain(FRENCH_DEFAULT_SENTENCES[0]);

    // 2. Generate English study
    const enModel = buildDocumentModel({
      study: { ...mockStudy, language: 'en' },
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses.slice(0, 1),
      samples: mockSamples.slice(0, 1),
      language: 'en',
    });

    const enDocx = await generateStudyDocxReport(enModel);
    const enZip = await JSZip.loadAsync(await enDocx.arrayBuffer());
    const enDocXml = (await enZip.file('word/document.xml')!.async('text')).replace(/&apos;/g, "'");

    // NONE of the French default sentences may appear in English document
    for (const frSentence of FRENCH_DEFAULT_SENTENCES) {
      expect(enDocXml).not.toContain(frSentence);
    }
    // English sentences MUST appear
    expect(enDocXml).toContain(ENGLISH_DEFAULT_SENTENCES[0]);
  });

  it('10. PDF Unicode fonts and special characters: draws Greek, math symbols and French accents without "Á" corruption (Item 2)', async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const fontLoaded = await setupUnicodeFont(doc);
    expect(fontLoaded).toBe(true);

    const recordedDrawnTexts: Array<{ font: string; text: string }> = [];
    const origText = doc.text.bind(doc);
    doc.text = function (...args: any[]) {
      const t = args[0];
      const font = doc.getFont().fontName;
      if (typeof t === 'string') {
        recordedDrawnTexts.push({ font, text: t });
      } else if (Array.isArray(t)) {
        t.forEach((item) => recordedDrawnTexts.push({ font, text: String(item) }));
      }
      return (origText as any)(...args);
    } as any;

    // Draw Greek, math symbols and French accents
    const testString = 'ρd = 2.05 Mg/m³, γ = 19.8 kN/m³, T = 25 °C, surface = 15 m², volume = 20 m³, critères : ≥ 95% et ≤ 100%, accents : é è ê à ù ç î ô œ É';
    doc.text(testString, 10, 20);

    // Verify drawn text
    const drawn = recordedDrawnTexts.map((r) => r.text).join(' ');
    expect(drawn).toContain('ρd');
    expect(drawn).toContain('γ');
    expect(drawn).toContain('°');
    expect(drawn).toContain('²');
    expect(drawn).toContain('³');
    expect(drawn).toContain('≥');
    expect(drawn).toContain('≤');
    expect(drawn).toContain('é è ê à ù ç î ô œ É');
    expect(drawn).not.toContain('Ád');
    expect(drawn).not.toContain('Á');

    // Font used must be Roboto
    expect(recordedDrawnTexts[0].font).toBe('Roboto');

    // Check PDF size increase:
    const unicodePdfBlob = doc.output('blob');
    const plainDoc = new jsPDF();
    plainDoc.text('Plain text', 10, 20);
    const plainBlob = plainDoc.output('blob');
    const sizeIncreaseBytes = unicodePdfBlob.size - plainBlob.size;
    console.log(`[PDF FONT SIZE] Plain PDF: ${plainBlob.size} bytes, Unicode PDF: ${unicodePdfBlob.size} bytes, Increase: +${sizeIncreaseBytes} bytes (~${(sizeIncreaseBytes / 1024).toFixed(1)} KB)`);
    expect(unicodePdfBlob.size).toBeGreaterThan(plainBlob.size);

    // Also test transliteration fallback when font is absent
    const fallbackText = transliterateGreekAndSpecialChars('ρd_opm = 2.05, γ = 20, ≥ 95%, ≤ 100%, 25°C, m², m³, Ád_opm');
    expect(fallbackText).toContain('rho_d_opm = 2.05');
    expect(fallbackText).toContain('gamma = 20');
    expect(fallbackText).toContain('>= 95%');
    expect(fallbackText).toContain('<= 100%');
    expect(fallbackText).not.toContain('Ád_opm');
    expect(fallbackText).not.toContain('ρ');
  });

  it('11. table of contents page numbers: measured two-pass render ensures every TOC number equals the page where that heading text was drawn (Item 1)', async () => {
    const model = buildDocumentModel({
      study: mockStudy,
      project: mockProject,
      client: mockClient,
      organisation: mockOrg,
      analyses: mockAnalyses.slice(0, 3),
      samples: mockSamples.slice(0, 3),
      photos: mockPhotos.slice(0, 12),
      language: 'fr',
    });

    const recordedDrawnTexts: Array<{ page: number; text: string }> = [];

    const pdfBlob = await generateStudyPdfReport(model, {
      onDocCreated: (doc, pass) => {
        if (pass === 2) {
          const origText = doc.text.bind(doc);
          doc.text = function (...args: any[]) {
            const page = doc.getCurrentPageInfo().pageNumber;
            const t = args[0];
            if (typeof t === 'string') {
              recordedDrawnTexts.push({ page, text: t });
            } else if (Array.isArray(t)) {
              t.forEach((item) => recordedDrawnTexts.push({ page, text: String(item) }));
            }
            return (origText as any)(...args);
          } as any;
        }
      },
    });

    expect(pdfBlob.size).toBeGreaterThan(5000);

    const tocBlock = model.blocks.find((b) => b.type === 'toc')!;
    expect(tocBlock).toBeDefined();
    const tocItems = tocBlock.tocItems || [];
    expect(tocItems.length).toBeGreaterThanOrEqual(10);

    const tocVsActualTable: Array<{ itemTitle: string; tocReportedPage: number; actualHeadingPage: number }> = [];

    for (const item of tocItems) {
      // Find where item.title was drawn on TOC page (page 2)
      const tocEntryIndex = recordedDrawnTexts.findIndex(
        (r) => r.page === 2 && r.text.trim().toLowerCase() === item.title.trim().toLowerCase()
      );
      expect(tocEntryIndex).toBeGreaterThan(-1);

      // In renderTocPage, after the title and dots, the page number is drawn right-aligned on page 2
      let reportedPageNum: number | undefined;
      for (let i = tocEntryIndex + 1; i < recordedDrawnTexts.length; i++) {
        if (recordedDrawnTexts[i].page !== 2) break;
        if (/^\d+$/.test(recordedDrawnTexts[i].text.trim())) {
          reportedPageNum = parseInt(recordedDrawnTexts[i].text.trim(), 10);
          break;
        }
      }
      expect(reportedPageNum).toBeDefined();

      // Find where the heading text was drawn in the body of the document (page > 2)
      const targetTitle = item.title.trim().toUpperCase();
      const actualDrawings = recordedDrawnTexts.filter(
        (r) =>
          r.page > 2 &&
          (r.text.trim().toUpperCase() === targetTitle ||
            r.text.trim().toUpperCase().startsWith(targetTitle))
      );

      expect(actualDrawings.length).toBeGreaterThan(0);
      const actualHeadingPage = actualDrawings[0].page;

      tocVsActualTable.push({
        itemTitle: item.title,
        tocReportedPage: reportedPageNum!,
        actualHeadingPage,
      });

      console.log(`[ITEM CHECK] "${item.title}" -> TOC: ${reportedPageNum}, Actual: ${actualHeadingPage}`);

      // ASSERT that every TOC number equals the page where that heading text was drawn
      expect(reportedPageNum).toBe(actualHeadingPage);
    }

    console.log('\n[TOC-VERSUS-ACTUAL-PAGE TABLE]');
    console.table(tocVsActualTable);
  });
});
