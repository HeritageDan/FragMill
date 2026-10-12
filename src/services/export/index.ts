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
import { db } from '../../db';

// Generate Multi-Page Engineering Blast PDF Report
export async function generateBlastPdfReport(
  project: Project,
  site: Site,
  blast: Blast,
  image: ImageRecord,
  run: SegmentationRun
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page 1: Header, Blast Parameters, Rock Mass, and Image
  // Header banner
  doc.setFillColor(31, 56, 100); // Deep navy (#1F3864)
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FRAGMILL : BLAST FRAGMENTATION & COMMINUTION REPORT', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name} | Site: ${site.name} | Blast ID: ${blast.blastId}`, 14, 20);

  // Metadata Table
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. BLAST DESIGN & ROCK MASS METADATA', 14, 36);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  const col1 = 14;
  const col2 = 110;
  let y = 43;

  doc.text(`Date & Time: ${blast.dateTime}`, col1, y);
  doc.text(`Weather: ${blast.weather}`, col2, y);
  y += 5.5;

  doc.text(`Bench Height: ${blast.parameters.benchHeight} m`, col1, y);
  doc.text(`Rock Type: ${blast.rockMass.rockType} (ρ = ${blast.rockMass.density} t/m³)`, col2, y);
  y += 5.5;

  doc.text(`Hole Diameter: ${blast.parameters.holeDiameter} mm (Depth: ${blast.parameters.holeDepth} m)`, col1, y);
  doc.text(`Joint Spacing: ${blast.rockMass.meanJointSpacing} m | Orientation: ${blast.rockMass.jointOrientation}`, col2, y);
  y += 5.5;

  doc.text(`Burden x Spacing: ${blast.parameters.burden} m x ${blast.parameters.spacing} m`, col1, y);
  doc.text(`Stemming Length: ${blast.parameters.stemmingLength} m`, col2, y);
  y += 5.5;

  doc.text(`Explosive: ${blast.parameters.explosiveType} (${blast.parameters.chargePerHole} kg/hole)`, col1, y);
  const holeVol = blast.parameters.burden * blast.parameters.spacing * blast.parameters.benchHeight;
  const pf = blast.parameters.chargePerHole / Math.max(0.1, holeVol);
  doc.text(`Powder Factor: ${pf.toFixed(2)} kg/m³ | RWS: ${blast.parameters.rws}`, col2, y);
  y += 8;

  // Annotated Image
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. ANNOTATED MUCK PILE PHOTOGRAPHY & SEGMENTATION OVERLAY', 14, y);
  y += 4;

  if (run.stepPreviews?.overlay || image.dataUrl) {
    const imgDataUrl = run.stepPreviews?.overlay || image.dataUrl;
    try {
      doc.addImage(imgDataUrl, 'JPEG', 14, y, 182, 105);
    } catch {
      doc.rect(14, y, 182, 105);
      doc.text('[Muck pile image]', 85, y + 50);
    }
  }
  y += 112;

  // Scale calibration
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Scale Calibration: ${image.calibration?.method || 'Manual Scale'} | Resolution: ${
      image.calibration?.pxPerMm?.toFixed(3) || '0.400'
    } px/mm | Fragments Identified: ${run.fragments.length}`,
    14,
    y
  );
  y += 8;

  // Key Percentiles Box
  doc.setFillColor(214, 228, 240); // Light blue (#D6E4F0)
  doc.roundedRect(14, y, 182, 28, 2, 2, 'F');
  doc.setTextColor(31, 56, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('KEY FRAGMENTATION PERCENTILES & COMMINUTION SIZING', 18, y + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const m = run.metrics;
  doc.text(`P10: ${m.p10} mm [${m.bootstrapCI.p10[0]}-${m.bootstrapCI.p10[1]}]`, 18, y + 14);
  doc.text(`P20: ${m.p20} mm [${m.bootstrapCI.p20[0]}-${m.bootstrapCI.p20[1]}]`, 56, y + 14);
  doc.text(`P50: ${m.p50} mm [${m.bootstrapCI.p50[0]}-${m.bootstrapCI.p50[1]}]`, 94, y + 14);
  doc.text(`P80: ${m.p80} mm [${m.bootstrapCI.p80[0]}-${m.bootstrapCI.p80[1]}]`, 132, y + 14);
  doc.text(`P90: ${m.p90} mm`, 170, y + 14);

  doc.text(`Uniformity (P80/P20): ${m.uniformityIndex}`, 18, y + 21);
  doc.text(`Oversize (>300mm): ${m.oversizePercent}%`, 74, y + 21);
  doc.text(`Fines (<25mm): ${m.finesPercent}%`, 132, y + 21);

  // PAGE 2: Models, Mine to Mill & Disclaimers
  doc.addPage();

  doc.setFillColor(31, 56, 100);
  doc.rect(0, 0, 210, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FRAGMILL : STATISTICAL FITS & MINE-TO-MILL RECOVERY', 14, 11);

  y = 26;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text('3. DISTRIBUTION MODEL FITTING & CORRECTIONS', 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (m.swebrecFit) {
    doc.text(
      `Swebrec Fit: xMax = ${m.swebrecFit.xMax} mm, x50 = ${m.swebrecFit.x50} mm, b = ${m.swebrecFit.b} (R² = ${m.swebrecFit.r2}, RMSE = ${m.swebrecFit.rmse})`,
      14,
      y
    );
    y += 5.5;
  }
  if (m.rosinRammlerFit) {
    doc.text(
      `Rosin-Rammler Fit: xc = ${m.rosinRammlerFit.xc} mm, n = ${m.rosinRammlerFit.n} (R² = ${m.rosinRammlerFit.r2}, RMSE = ${m.rosinRammlerFit.rmse})`,
      14,
      y
    );
    y += 8;
  }

  // Mine to mill processing link
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. MINE-TO-MILL COMMINUTION & RECOVERY PERFORMANCE', 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (blast.millBatch) {
    const mb = blast.millBatch;
    doc.text(`Batch Milled: ${mb.batchTonnageTonnes} tonnes | Plant Throughput: ${mb.millingThroughputTph} t/h`, 14, y);
    y += 5.5;
    doc.text(
      `Specific Crushing Energy: ${mb.crushingSpecificEnergyKwhPerT} kWh/t | Milling Energy: ${mb.millingSpecificEnergyKwhPerT} kWh/t`,
      14,
      y
    );
    y += 5.5;
    doc.text(
      `Total Comminution Energy: ${mb.totalSpecificEnergyKwhPerT} kWh/t | Secondary Breaking: ${mb.bouldersSecondaryBreakingCount || 0} boulders`,
      14,
      y
    );
    y += 5.5;
    doc.text(
      `Gold Recovery: ${mb.simpleGoldRecoveryPercent}% (Head Grade: ${mb.headGradeGpt} g/t, Tails: ${mb.tailsGradeGpt} g/t)`,
      14,
      y
    );
    y += 10;
  } else {
    doc.text('No mill processing batch linked to this blast yet.', 14, y);
    y += 10;
  }

  // Ground truth validation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('5. GROUND TRUTH & SIEVE VALIDATION CHECK', 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (blast.groundTruth) {
    const gt = blast.groundTruth;
    doc.text(
      `Screen Ground Truth: P20 = ${gt.computedP20 || '-'} mm, P50 = ${gt.computedP50 || '-'} mm, P80 = ${gt.computedP80 || '-'} mm`,
      14,
      y
    );
    y += 5.5;
    const errP80 = gt.computedP80 ? (((m.p80 - gt.computedP80) / gt.computedP80) * 100).toFixed(1) : '-';
    doc.text(`P80 Validation Discrepancy: ${errP80}% | Validation Notes: ${gt.notes || 'Field screen calibration sample'}`, 14, y);
    y += 10;
  } else {
    doc.text('No ground truth sieve sample recorded for this blast.', 14, y);
    y += 10;
  }

  // Assumptions & Engineering Disclaimers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('6. ASSUMPTIONS, STEREOLOGICAL LIMITS & DISCLAIMERS', 14, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const disclaimers = [
    '• Surface Stereological Bias: Photographic 2D analysis samples the surface of the muck pile; interior fines are estimated via Swebrec extrapolation.',
    '• Size Measurement Definition: Minimum Feret diameter is used as the default closest analogue to square-mesh sieve apertures.',
    '• Volume Weighting: Fragment volume is estimated assuming an ellipsoidal/spherical shape factor (V = pi/6 * d^3).',
    '• Engineering Decision Support: FragMill results are advisory. Any blast redesign must be verified by a certified blasting engineer.',
  ];
  for (const line of disclaimers) {
    doc.text(line, 14, y);
    y += 5;
  }

  return doc.output('blob');
}

// Generate Printable A4 Scale Marker PDF Sheet
export function generatePrintableA4CalibrationSheet(): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Title
  doc.setFillColor(31, 56, 100);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FRAGMILL : A4 PHOTOGRAPHIC SCALE CALIBRATION TARGET', 14, 14);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('INSTRUCTIONS: Print this sheet at 100% scale (no fit-to-page). Check the bar below with a ruler before use.', 14, 30);

  // Verification 100 mm Ruler Bar
  doc.setFont('helvetica', 'bold');
  doc.text('100 mm Verification Ruler Bar (Must measure exactly 10 cm with physical ruler):', 14, 40);

  doc.setFillColor(0, 0, 0);
  doc.rect(14, 44, 100, 6, 'F');
  // Millimeter ticks
  for (let mm = 0; mm <= 100; mm += 10) {
    doc.rect(14 + mm, 42, 0.8, 10, 'F');
  }

  // 200 mm Scale Bar
  doc.text('200 mm High-Contrast Field Scale Bar:', 14, 66);
  doc.setFillColor(234, 179, 8); // Yellow
  doc.rect(14, 70, 180, 12, 'F');

  doc.setFillColor(0, 0, 0);
  for (let i = 0; i < 9; i++) {
    if (i % 2 === 0) {
      doc.rect(14 + i * 20, 70, 20, 12, 'F');
    }
  }

  // ArUco-Style 5x5 Square Markers
  doc.text('High-Contrast Photogrammetry Target Markers:', 14, 98);
  const drawTarget = (x: number, y: number, label: string) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(x, y, 45, 45, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 5, y + 5, 35, 35, 'F');
    doc.setFillColor(0, 0, 0);
    doc.circle(x + 22.5, y + 22.5, 9, 'F');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + 8, y + 50);
  };

  drawTarget(20, 105, 'Marker #1 (45mm)');
  drawTarget(80, 105, 'Marker #2 (45mm)');
  drawTarget(140, 105, 'Marker #3 (45mm)');

  // Field Placement Protocol Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 168, 182, 80, 2, 2, 'F');
  doc.setTextColor(31, 56, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MUCK PILE SCALE PLACEMENT PROTOCOL', 18, 178);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const steps = [
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

// Export Fragments CSV
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

// Export Full Excel Workbook (.xlsx)
export function exportBlastWorkbookXlsx(blast: Blast, run: SegmentationRun): Blob {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary & Percentiles
  const summaryData = [
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
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Fragment Sizing
  const fragData = run.fragments.map((f) => ({
    ID: f.id,
    'Min Feret (mm)': f.minFeretMm,
    'Max Feret (mm)': f.maxFeretMm,
    'ECD (mm)': f.ecdMm,
    'Area (mm2)': f.areaMm2,
    'Volume (mm3)': f.volumeMm3,
    'Aspect Ratio': f.aspectRatio,
    Solidity: f.solidity,
    Confidence: f.confidence,
  }));
  const wsFragments = XLSX.utils.json_to_sheet(fragData);
  XLSX.utils.book_append_sheet(wb, wsFragments, 'Fragments');

  // Sheet 3: Cumulative Distribution Curve
  const curveData = run.metrics.rawCurve.map((c) => ({
    'Aperture / Size (mm)': c.sizeMm,
    'Cumulative Passing %': c.passingPercent,
  }));
  const wsCurve = XLSX.utils.json_to_sheet(curveData);
  XLSX.utils.book_append_sheet(wb, wsCurve, 'Distribution Curve');

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
