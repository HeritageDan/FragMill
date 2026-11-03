import JSZip from 'jszip';
import { db, getOrganisationProfile } from '../../db';
import { getTestDefinition } from '../tests/index';
import { generateGeoLabExcelReport } from './excelGenerator';
import { generateGeoLabPdfReport } from './pdfGenerator';
import type { GeoLabSample } from '../../types/geolab';

export interface ProjectZipExportOptions {
  projectId: string;
  approvedOnly?: boolean;
}

export async function exportProjectReportsZip(options: ProjectZipExportOptions): Promise<{ blob: Blob; filename: string; count: number }> {
  const project = await db.geolabProjects.get(options.projectId);
  if (!project) throw new Error('Project not found');

  const client = await db.clients.get(project.clientId);
  if (!client) throw new Error('Client not found');

  const samples = await db.samples.where('projectId').equals(project.id).toArray();
  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  const allAnalyses = await db.analyses.toArray();
  let projectAnalyses = allAnalyses.filter((a) => sampleMap.has(a.sampleId));

  if (options.approvedOnly) {
    projectAnalyses = projectAnalyses.filter((a) => a.status === 'approved');
  }

  const orgProfile = await getOrganisationProfile();
  const zip = new JSZip();

  for (const analysis of projectAnalyses) {
    const sample = sampleMap.get(analysis.sampleId)!;
    const testDef = getTestDefinition(analysis.testType);

    const baseName = `${analysis.reportNumber}_${analysis.testType}_${sample.sampleId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // Generate Excel
    const xlsxBlob = await generateGeoLabExcelReport({
      analysis,
      client,
      project,
      sample,
      orgProfile,
      testDef,
    });
    const xlsxBuffer = await xlsxBlob.arrayBuffer();
    zip.file(`${baseName}.xlsx`, xlsxBuffer);

    // Generate PDF
    const pdfBlob = await generateGeoLabPdfReport({
      analysis,
      client,
      project,
      sample,
      orgProfile,
      testDef,
    });
    const pdfBuffer = await pdfBlob.arrayBuffer();
    zip.file(`${baseName}.pdf`, pdfBuffer);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const sanitizedProjectName = project.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedProjectName}_FraGeo_Lab_Reports.zip`;

  return { blob: zipBlob, filename, count: projectAnalyses.length };
}
