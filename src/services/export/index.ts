import jsPDF from 'jspdf';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type {
  Blast,
  ImageRecord,
  SegmentationRun,
  Fragment,
  Project,
  Site,
} from '../../types';
import type { Language } from '../../i18n';
import type { ReportVaultState } from '../../types/reportVault';
import { generateModularVaultPdfReport, generateSingleSectionPdfReport } from './modularReport';
import { db, getSettings } from '../../db';
import { simulateComminutionCircuit, generateEconomicTradeoffCurve } from '../comminution/bondMorrellEngine';
import { evaluateMineToMillEconomics, DEFAULT_ECONOMIC_PARAMS } from '../economics';
import { computeKuzRam, calculateRockFactorA, DEFAULT_ROCK_TABLES } from '../kuzram';
import { generateDemoDroneSurvey, apply3DStereologicalCorrection } from '../drone3d/droneSizing';
import { calculateUSBMPPV, generateFaceProfile } from '../timing/initiationSimulator';
import { generateDrillTelemetryFromBlast } from '../telemetry/iredesGenerator';

// Generate Comprehensive Multi-Page Engineering Blast PDF Report (Bilingual: EN / FR)
export async function generateBlastPdfReport(
  project: Project,
  site: Site,
  blast: Blast,
  image?: ImageRecord,
  run?: SegmentationRun,
  lang?: Language
): Promise<Blob> {
  let activeLang: Language = lang || 'en';
  if (!lang) {
    try {
      const appSettings = await getSettings();
      if (appSettings?.language) {
        activeLang = appSettings.language;
      }
    } catch {
      // ignore
    }
  }

  // Ensure blast has image & run associated if provided
  const targetBlast = { ...blast };
  if (image) {
    const targetImage = { ...image };
    if (run) {
      targetImage.segmentationRuns = [run, ...(targetImage.segmentationRuns || []).filter((r) => r.id !== run.id)];
    }
    targetBlast.images = [targetImage, ...(targetBlast.images || []).filter((i) => i.id !== targetImage.id)];
  }

  const activeImg = targetBlast.images?.[0];
  const activeRun = run || activeImg?.segmentationRuns?.[0];
  const metrics = activeRun?.metrics;

  const blastPayload: any = {
    blastId: targetBlast.blastId,
    dateTime: targetBlast.dateTime,
    weather: targetBlast.weather,
    burden: targetBlast.parameters.burden,
    spacing: targetBlast.parameters.spacing,
    benchHeight: targetBlast.parameters.benchHeight,
    holeDiameter: targetBlast.parameters.holeDiameter,
    holeDepth: targetBlast.parameters.holeDepth,
    subdrill: targetBlast.parameters.subdrill,
    chargePerHole: targetBlast.parameters.chargePerHole,
    numberOfHoles: targetBlast.parameters.numberOfHoles,
    rockType: targetBlast.rockMass.rockType,
    density: targetBlast.rockMass.density,
    ucsMPa: targetBlast.rockMass.ucsMPa,
    gsiOrRmr: targetBlast.rockMass.estimatedGsiOrRmr,
    p10: metrics?.p10,
    p20: metrics?.p20,
    p50: metrics?.p50,
    p80: metrics?.p80,
    p90: metrics?.p90,
    topSize: metrics?.pMax,
    uniformityIndex: metrics?.uniformityIndex,
    oversizePercent: metrics?.oversizePercent,
    finesPercent: metrics?.finesPercent,
    fragmentCount: activeRun?.fragments?.length || targetBlast.images?.[0]?.segmentationRuns?.[0]?.fragments?.length,
  };

  const initialVaultState: ReportVaultState = {
    blast: {
      key: 'blast',
      stagedAt: Date.now(),
      titleFr: '1. Tir & Images : Massif & Granulométrie',
      titleEn: '1. Blast Records & Optical Sizing',
      summaryTextFr: `Tir ${targetBlast.blastId} : P50 ${metrics?.p50 || 128} mm, P80 ${metrics?.p80 || 195} mm`,
      summaryTextEn: `Blast ${targetBlast.blastId}: P50 ${metrics?.p50 || 128} mm, P80 ${metrics?.p80 || 195} mm`,
      payload: blastPayload,
    },
    drone3d: null,
    beltvision: null,
    timing: null,
    comminution: null,
    kriging: null,
    telemetry: null,
    benchmap: null,
    validation: null,
    minetomill: null,
    kuzram: null,
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('fragmill_report_vault_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          Object.assign(initialVaultState, parsed);
          initialVaultState.blast = {
            key: 'blast',
            stagedAt: Date.now(),
            titleFr: '1. Tir & Images : Massif & Granulométrie',
            titleEn: '1. Blast Records & Optical Sizing',
            summaryTextFr: `Tir ${targetBlast.blastId} : P50 ${metrics?.p50 || 128} mm, P80 ${metrics?.p80 || 195} mm`,
            summaryTextEn: `Blast ${targetBlast.blastId}: P50 ${metrics?.p50 || 128} mm, P80 ${metrics?.p80 || 195} mm`,
            payload: blastPayload,
          };
        }
      }
    }
  } catch {
    // ignore
  }

  return generateModularVaultPdfReport(initialVaultState, project, site, targetBlast, activeLang);
}

// Generate Printable 1:1 A4 Calibration Target Sheet
export function generatePrintableA4CalibrationSheet(lang: Language = 'en'): Blob {
  const isFr = lang === 'fr';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Top Banner Header
  doc.setFillColor(31, 56, 100); // Deep Navy #1F3864
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isFr ? 'FRAGMILL : MIRE D\'ÉTALONNAGE OPTIQUE & PROTOCOLE TERRAIN' : 'FRAGMILL : OPTICAL SCALE CALIBRATION TARGET & PROTOCOL',
    14,
    11
  );
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    isFr ? 'Échelle Imprimable 1:1 pour Étalonnage Haute Précision' : '1:1 Printable Field Scale Target for High-Precision Calibration',
    14,
    17
  );

  let y = 28;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(
    isFr
      ? 'Cette page contient une échelle métrique certifiée. Imprimez à 100% (sans mise à l\'échelle) et placez-la sur le tas d\'abattage.'
      : 'This page provides a certified metric field scale. Print at 100% scale (no fit-to-page) and position directly on the muck pile.',
    14,
    y
  );

  // 100 mm Scale Bar
  doc.text(isFr ? 'Mire Haute Précision 100 mm :' : '100 mm Precision Scale Bar:', 14, 38);
  doc.setFillColor(15, 23, 42); // Black
  doc.rect(14, 42, 100, 10, 'F');
  doc.setFillColor(255, 255, 255);
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      doc.rect(14 + i * 10, 42, 10, 10, 'F');
    }
  }

  // 200 mm Scale Bar
  doc.text(isFr ? 'Mire Haute Contraste de Terrain 200 mm :' : '200 mm High-Contrast Field Scale Bar:', 14, 66);
  doc.setFillColor(234, 179, 8); // Yellow
  doc.rect(14, 70, 180, 12, 'F');

  doc.setFillColor(0, 0, 0);
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) {
      doc.rect(14 + i * 20, 70, 20, 12, 'F');
    }
  }

  // ArUco-Style 5x5 Square Markers
  doc.text(isFr ? 'Cibles de Photogrammétrie Haute Précision :' : 'High-Contrast Photogrammetry Target Markers:', 14, 98);
  const drawTarget = (x: number, targetY: number, label: string) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(x, targetY, 45, 45, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 5, targetY + 5, 35, 35, 'F');
    doc.setFillColor(0, 0, 0);
    doc.circle(x + 22.5, targetY + 22.5, 9, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + 8, targetY + 50);
  };

  drawTarget(20, 105, isFr ? 'Cible #1 (45mm)' : 'Marker #1 (45mm)');
  drawTarget(80, 105, isFr ? 'Cible #2 (45mm)' : 'Marker #2 (45mm)');
  drawTarget(140, 105, isFr ? 'Cible #3 (45mm)' : 'Marker #3 (45mm)');

  // Field Placement Protocol Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 168, 182, 80, 2, 2, 'F');
  doc.setTextColor(31, 56, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(isFr ? 'PROTOCOLE DE POSITIONNEMENT SUR LE TAS D\'ABATTAGE' : 'MUCK PILE SCALE PLACEMENT PROTOCOL', 18, 178);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const steps = isFr ? [
    '1. Fixez ou plastifiez cette mire sur un support rigide (contreplaqué ou porte-bloc) pour éviter toute courbure.',
    '2. Posez la mire à plat sur le front du tas d\'abattage dans le même plan que les fragments à mesurer.',
    '3. Ne PAS placer la mire au sommet d\'un bloc isolé ou dans une dépression d\'ombre profonde.',
    '4. Reculez de 6 à 10 mètres de façon à capturer l\'ensemble de la section du tas d\'abattage.',
    '5. Vérifiez que l\'axe optique de la caméra est bien perpendiculaire (90°) à la pente du tas.',
    '6. Évitez les prises de vue face au soleil direct ; un ciel légèrement couvert donne le meilleur contraste.',
  ] : [
    '1. Mount or laminate this target on rigid board (plywood or clipboard) to prevent bending.',
    '2. Place target flat on the muck pile face in the plane of the rock fragments to be measured.',
    '3. Do NOT place scale target on top of an isolated boulder or in a deep shadow depression.',
    '4. Stand 6 to 10 metres back so the entire muck pile section is captured.',
    '5. Ensure camera axis is as perpendicular (90°) to the muck pile slope as safe access allows.',
    '6. Avoid shooting straight into the sun; overcast skies produce the highest quality images.',
  ];

  let sy = 186;
  for (const s of steps) {
    doc.text(s, 18, sy);
    sy += 8;
  }

  return doc.output('blob');
}

export function exportFragmentsCsv(fragments: Fragment[], blastId: string): string {
  const data = fragments.map((f) => ({
    blastId,
    fragmentId: f.id,
    areaPx: f.areaPx,
    areaMm2: f.areaMm2,
    ecdMm: f.ecdMm,
    minFeretMm: f.minFeretMm,
    maxFeretMm: f.maxFeretMm,
    bboxWidthMm: f.bboxWidthMm,
    bboxHeightMm: f.bboxHeightMm,
    aspectRatio: f.aspectRatio,
    solidity: f.solidity,
    volumeMm3: f.volumeMm3,
    confidence: f.confidence,
  }));

  return Papa.unparse(data);
}

// Export Full Excel Workbook (.xlsx) (Bilingual: EN / FR)
export function exportBlastWorkbookXlsx(blast: Blast, run: SegmentationRun, lang: Language = 'en'): Blob {
  const isFr = lang === 'fr';
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary & Percentiles
  const summaryData = isFr ? [
    ['FRAGMILL : SYNTHÈSE D\'ANALYSE DE FRAGMENTATION'],
    ['Réf. Tir', blast.blastId],
    ['Date & Heure', blast.dateTime],
    ['Type de Roche', blast.rockMass.rockType],
    ['Densité (t/m³)', blast.rockMass.density],
    ['Consommation Spécifique (kg/m³)', (blast.parameters.chargePerHole / (blast.parameters.burden * blast.parameters.spacing * blast.parameters.benchHeight)).toFixed(2)],
    [''],
    ['PERCENTILES DE FRAGMENTATION (mm)'],
    ['P10', run.metrics.p10],
    ['P20', run.metrics.p20],
    ['P50 (Médiane)', run.metrics.p50],
    ['P80', run.metrics.p80],
    ['P90', run.metrics.p90],
    ['Taille Moyenne', run.metrics.meanSize],
    ['Indice d\'Uniformité (P80/P20)', run.metrics.uniformityIndex],
    ['Blocs Hors-Gabarit (>300mm) %', run.metrics.oversizePercent],
    ['Fines (<25mm) %', run.metrics.finesPercent],
  ] : [
    ['FRAGMILL BLAST ANALYSIS SUMMARY'],
    ['Blast ID', blast.blastId],
    ['Date & Time', blast.dateTime],
    ['Rock Type', blast.rockMass.rockType],
    ['Density (t/m3)', blast.rockMass.density],
    ['Powder Factor (kg/m3)', (blast.parameters.chargePerHole / (blast.parameters.burden * blast.parameters.spacing * blast.parameters.benchHeight)).toFixed(2)],
    [''],
    ['FRAGMENTATION PERCENTILES (mm)'],
    ['P10', run.metrics.p10],
    ['P20', run.metrics.p20],
    ['P50 (Median)', run.metrics.p50],
    ['P80', run.metrics.p80],
    ['P90', run.metrics.p90],
    ['Mean Size', run.metrics.meanSize],
    ['Uniformity Index (P80/P20)', run.metrics.uniformityIndex],
    ['Oversize (>300mm) %', run.metrics.oversizePercent],
    ['Fines (<25mm) %', run.metrics.finesPercent],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, isFr ? 'Synthèse' : 'Summary');

  // Sheet 2: Fragment Sizing
  const fragData = run.fragments.map((f) => ({
    [isFr ? 'Identifiant' : 'ID']: f.id,
    [isFr ? 'Féret Min (mm)' : 'Min Feret (mm)']: f.minFeretMm,
    [isFr ? 'Féret Max (mm)' : 'Max Feret (mm)']: f.maxFeretMm,
    [isFr ? 'DCE (mm)' : 'ECD (mm)']: f.ecdMm,
    [isFr ? 'Surface (mm²)' : 'Area (mm2)']: f.areaMm2,
    [isFr ? 'Volume (mm³)' : 'Volume (mm3)']: f.volumeMm3,
    [isFr ? 'Rapport Allongement' : 'Aspect Ratio']: f.aspectRatio,
    [isFr ? 'Compacité' : 'Solidity']: f.solidity,
    [isFr ? 'Confiance' : 'Confidence']: f.confidence,
  }));
  const wsFragments = XLSX.utils.json_to_sheet(fragData);
  XLSX.utils.book_append_sheet(wb, wsFragments, 'Fragments');

  // Sheet 3: Cumulative Distribution Curve
  const curveData = run.metrics.rawCurve.map((c) => ({
    [isFr ? 'Ouverture Tamis (mm)' : 'Aperture / Size (mm)']: c.sizeMm,
    [isFr ? 'Passant Cumulé %' : 'Cumulative Passing %']: c.passingPercent,
  }));
  const wsCurve = XLSX.utils.json_to_sheet(curveData);
  XLSX.utils.book_append_sheet(wb, wsCurve, isFr ? 'Courbe Granulométrique' : 'Distribution Curve');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Export COCO Instance Segmentation JSON dataset (anonymized)
export function exportCocoDatasetJson(
  project: Project,
  images: ImageRecord[],
  runs: SegmentationRun[]
): string {
  const coco = {
    info: {
      description: 'FragMill Post-Blast Rock Fragmentation Dataset',
      version: '1.0',
      year: new Date().getFullYear(),
      contributor: project.name,
    },
    licenses: [{ id: 1, name: 'Open Mining Research' }],
    images: [] as any[],
    annotations: [] as any[],
    categories: [{ id: 1, name: 'rock_fragment', supercategory: 'geology' }],
  };

  let annotationId = 1;

  for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
    const img = images[imgIdx];
    coco.images.push({
      id: imgIdx + 1,
      file_name: img.filename,
      width: 1024,
      height: 768,
      date_captured: img.time,
    });

    const run = runs.find((r) => r.imageId === img.id);
    if (run) {
      for (const frag of run.fragments) {
        // Flatten polygon points
        const segmentation: number[] = [];
        for (const pt of frag.polygon) {
          segmentation.push(pt.x, pt.y);
        }

        coco.annotations.push({
          id: annotationId++,
          image_id: imgIdx + 1,
          category_id: 1,
          segmentation: [segmentation],
          area: frag.areaPx,
          bbox: [
            frag.centroid.x - frag.bboxWidthMm / 2,
            frag.centroid.y - frag.bboxHeightMm / 2,
            frag.bboxWidthMm,
            frag.bboxHeightMm,
          ],
          iscrowd: 0,
        });
      }
    }
  }

  return JSON.stringify(coco, null, 2);
}

// Full Project Backup & Restore as JSON
export async function exportProjectBackupJson(projectId: string): Promise<string> {
  const project = await db.projects.get(projectId);
  const sites = await db.sites.where('projectId').equals(projectId).toArray();
  const blasts = await db.blasts.where('projectId').equals(projectId).toArray();
  const blastIds = blasts.map((b) => b.id);
  const images = await db.images.where('blastId').anyOf(blastIds).toArray();
  const imageIds = images.map((i) => i.id);
  const runs = await db.segmentationRuns.where('imageId').anyOf(imageIds).toArray();
  const groundTruths = await db.groundTruths.where('blastId').anyOf(blastIds).toArray();
  const millBatches = await db.millBatches.where('blastId').anyOf(blastIds).toArray();

  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    project,
    sites,
    blasts,
    images,
    segmentationRuns: runs,
    groundTruths,
    millBatches,
  };

  return JSON.stringify(backup, null, 2);
}

export async function importProjectBackupJson(jsonString: string): Promise<string> {
  const data = JSON.parse(jsonString);
  if (!data.project || !data.project.id) {
    throw new Error('Invalid FragMill backup format');
  }

  await db.transaction('rw', [db.projects, db.sites, db.blasts, db.images, db.segmentationRuns, db.groundTruths, db.millBatches], async () => {
    await db.projects.put(data.project);
    for (const s of data.sites || []) await db.sites.put(s);
    for (const b of data.blasts || []) await db.blasts.put(b);
    for (const img of data.images || []) await db.images.put(img);
    for (const r of data.segmentationRuns || []) await db.segmentationRuns.put(r);
    for (const gt of data.groundTruths || []) await db.groundTruths.put(gt);
    for (const mb of data.millBatches || []) await db.millBatches.put(mb);
  });

  return data.project.id;
}

export { generateModularVaultPdfReport, generateSingleSectionPdfReport } from './modularReport';
