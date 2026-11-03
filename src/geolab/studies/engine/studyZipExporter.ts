import JSZip from 'jszip';
import { db, getOrganisationProfile } from '../../../db';
import { buildDocumentModel } from './documentModel';
import { generateStudyPdfReport } from './studyPdfRenderer';
import { generateStudyDocxReport } from './studyWordRenderer';
import { generateGeoLabExcelReport } from '../../engine/excelGenerator';
import { getTestDefinition } from '../../tests/index';
import type { GeoLabSample } from '../../../types/geolab';

export interface StudyPackageExportOptions {
  studyId: string;
  onProgress?: (progress: { message: string; percent: number }) => void;
}

function base64ToUint8Array(base64Str: string): Uint8Array {
  try {
    const clean = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return new Uint8Array(0);
  }
}

export async function exportStudyPackageZip(options: StudyPackageExportOptions): Promise<{ blob: Blob; filename: string }> {
  const { studyId, onProgress } = options;

  onProgress?.({ message: 'Loading study data...', percent: 10 });
  const study = await db.studyReports.get(studyId);
  if (!study) throw new Error('Study not found');

  const project = await db.geolabProjects.get(study.projectId);
  if (!project) throw new Error('Project not found');

  const client = await db.clients.get(project.clientId);
  if (!client) throw new Error('Client not found');

  const orgProfile = await getOrganisationProfile();

  // Load included analyses
  const allAnalyses = await db.analyses.toArray();
  const includedSet = new Set(study.includedAnalysisIds || []);
  const analyses = allAnalyses.filter((a) => includedSet.has(a.id));

  // Load samples for these analyses
  const sampleIds = Array.from(new Set(analyses.map((a) => a.sampleId)));
  const allSamples = await db.samples.toArray();
  const samples = allSamples.filter((s) => sampleIds.includes(s.id));
  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  // Load photos
  const photos = await db.studyPhotos.where('studyId').equals(study.id).sortBy('order');

  onProgress?.({ message: 'Building document model...', percent: 25 });
  const docModel = buildDocumentModel({
    study,
    project,
    client,
    organisation: orgProfile,
    analyses,
    samples,
    photos,
    validateConsistency: true,
  });

  const zip = new JSZip();
  const baseName = study.reportNumber
    ? `${study.reportNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : 'Study_Report';

  // 1. Generate DOCX
  onProgress?.({ message: 'Compiling Word (.docx) document...', percent: 45 });
  const docxBlob = await generateStudyDocxReport(docModel);
  const docxBuffer = await docxBlob.arrayBuffer();
  zip.file(`${baseName}.docx`, docxBuffer);

  // 2. Generate PDF
  onProgress?.({ message: 'Compiling PDF document...', percent: 65 });
  const pdfBlob = await generateStudyPdfReport(docModel);
  const pdfBuffer = await pdfBlob.arrayBuffer();
  zip.file(`${baseName}.pdf`, pdfBuffer);

  // 3. Test Sheets (Excel export of each included analysis)
  onProgress?.({ message: 'Generating individual test sheets (Excel)...', percent: 80 });
  const testSheetsFolder = zip.folder('Test_Sheets');
  for (const analysis of analyses) {
    const sample: GeoLabSample = sampleMap.get(analysis.sampleId) || {
      id: analysis.sampleId,
      projectId: project.id,
      sampleId: 'SAMPLE-UNKNOWN',
      samplingDate: new Date().toISOString().split('T')[0],
      materialType: 'Sol',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const testDef = getTestDefinition(analysis.testType);

    try {
      const xlsxBlob = await generateGeoLabExcelReport({
        analysis,
        client,
        project,
        sample,
        orgProfile,
        testDef,
      });
      const xlsxBuffer = await xlsxBlob.arrayBuffer();
      const sheetName = `${analysis.reportNumber || analysis.id}_${analysis.testType}_${sample.sampleId.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      testSheetsFolder?.file(sheetName, xlsxBuffer);
    } catch (err) {
      console.warn(`Failed to export Excel for analysis ${analysis.id}:`, err);
    }
  }

  // 4. Photos folder with full-res compressed photos
  onProgress?.({ message: 'Packaging photos...', percent: 90 });
  if (photos.length > 0) {
    const photosFolder = zip.folder('Photos');
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const ext = photo.mimeType.includes('png') ? 'png' : 'jpg';
      const cleanCaption = photo.caption
        ? photo.caption.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
        : `Photo_${photo.order || i + 1}`;
      const photoFilename = `${String(photo.order || i + 1).padStart(2, '0')}_${cleanCaption}.${ext}`;
      const photoBytes = base64ToUint8Array(typeof photo.blob === 'string' ? photo.blob : '');
      if (photoBytes.length > 0) {
        photosFolder?.file(photoFilename, photoBytes);
      }
    }
  }

  onProgress?.({ message: 'Creating archive package...', percent: 98 });
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const filename = `${baseName}_Package.zip`;

  onProgress?.({ message: 'Package ready!', percent: 100 });
  return { blob: zipBlob, filename };
}
