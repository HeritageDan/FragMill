import jsPDF from 'jspdf';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
} from '../../types/geolab';
import type { GeoLabTestDefinition } from '../tests/types';
import type { ProctorInput, ProctorResults } from '../tests/proctor';
import type { GrainSizeInput, GrainSizeResults } from '../tests/grainSize';
import type { WaterContentInput, WaterContentResults } from '../tests/waterContent';

export interface PdfGenerationOptions {
  analysis: GeoLabAnalysis;
  client: GeoLabClient;
  project: GeoLabProject;
  sample: GeoLabSample;
  orgProfile: OrganisationProfile;
  testDef: GeoLabTestDefinition;
  language?: 'en' | 'fr';
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1e40af').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 30;
  const g = parseInt(clean.substring(2, 4), 16) || 64;
  const b = parseInt(clean.substring(4, 6), 16) || 175;
  return [r, g, b];
}

export async function generateGeoLabPdfReport(options: PdfGenerationOptions): Promise<Blob> {
  const { analysis, client, project, sample, orgProfile, testDef } = options;
  const lang = options.language || orgProfile.defaultLanguage || 'en';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const [prR, prG, prB] = hexToRgb(orgProfile.primaryColor);

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Watermark if draft
  if (analysis.status !== 'approved') {
    doc.saveGraphicsState();
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(55);
    doc.setFont('helvetica', 'bold');
    // Draw rotated text across middle of page
    doc.text('DRAFT / PROVISOIRE', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  // -------------------------------------------------------------
  // 1. Header Block
  // -------------------------------------------------------------
  // Top brand band
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 2, 'F');
  cursorY += 6;

  // Lab Logo (if available)
  if (orgProfile.logoBase64) {
    try {
      doc.addImage(orgProfile.logoBase64, 'PNG', margin, cursorY, 24, 16);
    } catch {
      // ignore image render failure
    }
  }

  // Lab Name & Accreditation
  const textLeft = orgProfile.logoBase64 ? margin + 28 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(prR, prG, prB);
  doc.text(orgProfile.companyName, textLeft, cursorY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 100, 115);
  doc.text(`${orgProfile.address} | Tel: ${orgProfile.phone} | ${orgProfile.email}`, textLeft, cursorY + 9);
  doc.text(orgProfile.accreditationNumber, textLeft, cursorY + 13);

  // Right-aligned report number and status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`${lang === 'fr' ? 'N° Rapport' : 'Report No'}: ${analysis.reportNumber}`, pageWidth - margin, cursorY + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Version: v${analysis.version} | Date: ${analysis.testedDate}`, pageWidth - margin, cursorY + 9, { align: 'right' });

  const statusLabel = analysis.status === 'approved'
    ? (lang === 'fr' ? 'APPROUVÉ / DÉFINITIF' : 'APPROVED / FINAL')
    : (lang === 'fr' ? 'BROUILLON (NON AUDITÉ)' : 'DRAFT (UNAUDITED)');
  doc.setTextColor(analysis.status === 'approved' ? 16 : 220, analysis.status === 'approved' ? 185 : 38, analysis.status === 'approved' ? 129 : 38);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, pageWidth - margin, cursorY + 14, { align: 'right' });

  cursorY += 20;

  // Title Banner
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, cursorY, contentWidth, 10, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(
    `${testDef.name[lang].toUpperCase()} - ${analysis.standard}`,
    pageWidth / 2,
    cursorY + 6.5,
    { align: 'center' }
  );

  cursorY += 14;

  // -------------------------------------------------------------
  // 2. Client & Project Block
  // -------------------------------------------------------------
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 1.5, 1.5, 'D');

  const col1X = margin + 4;
  const col2X = margin + 36;
  const col3X = margin + 98;
  const col4X = margin + 134;

  doc.setFontSize(8);

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Client :' : 'Client:', col1X, cursorY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${client.companyName}${client.contactPerson ? ` (${client.contactPerson})` : ''}`, col2X, cursorY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Échantillon :' : 'Sample ID:', col3X, cursorY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sample.sampleId, col4X, cursorY + 5);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Projet :' : 'Project:', col1X, cursorY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.projectName, col2X, cursorY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Profondeur :' : 'Depth:', col3X, cursorY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sample.depth || '-', col4X, cursorY + 11);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Site / Lieu :' : 'Site Location:', col1X, cursorY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.siteLocation, col2X, cursorY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Date prélèvement :' : 'Sample Date:', col3X, cursorY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sample.samplingDate, col4X, cursorY + 17);

  cursorY += 28;

  // -------------------------------------------------------------
  // 3. Test Specific Results & Chart
  // -------------------------------------------------------------
  if (testDef.id === 'proctor') {
    renderProctorPdfSection(doc, analysis as GeoLabAnalysis<ProctorInput, ProctorResults>, margin, cursorY, contentWidth, lang, prR, prG, prB);
    cursorY += 120;
  } else if (testDef.id === 'grain_size') {
    renderGrainSizePdfSection(doc, analysis as GeoLabAnalysis<GrainSizeInput, GrainSizeResults>, margin, cursorY, contentWidth, lang, prR, prG, prB);
    cursorY += 120;
  } else {
    renderWaterContentPdfSection(doc, analysis as GeoLabAnalysis<WaterContentInput, WaterContentResults>, margin, cursorY, contentWidth, lang, prR, prG, prB);
    cursorY += 80;
  }

  // -------------------------------------------------------------
  // 4. Observations & Engineering Interpretation
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'OBSERVATIONS & INTERPRÉTATION GÉOTECHNIQUE' : 'OBSERVATIONS & GEOTECHNICAL INTERPRETATION', margin, cursorY);
  cursorY += 3;

  const narrativeText = analysis.observations || analysis.aiNarrative || (lang === 'fr' ? 'Essai réalisé conformément à la norme de référence. Résultats conformes aux spécifications du projet.' : 'Test performed in accordance with reference standard. Results satisfy project specifications.');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const splitNarrative = doc.splitTextToSize(narrativeText, contentWidth);
  doc.text(splitNarrative, margin, cursorY + 3);
  cursorY += splitNarrative.length * 3.8 + 6;

  // -------------------------------------------------------------
  // 5. Signatures Block
  // -------------------------------------------------------------
  const sigBoxWidth = (contentWidth - 8) / 3;
  const sigHeight = 22;

  // Draw 3 signature boxes
  const sigs = [
    { title: lang === 'fr' ? 'Réalisé par (Technicien)' : 'Tested by (Technician)', name: analysis.preparedBy?.name || orgProfile.signatories[0]?.name || 'J. Dupont' },
    { title: lang === 'fr' ? 'Vérifié par (Qualité)' : 'Checked by (Quality)', name: analysis.checkedBy?.name || orgProfile.signatories[1]?.name || 'M. Lambert' },
    { title: lang === 'fr' ? 'Approuvé par (Directeur)' : 'Approved by (Director)', name: analysis.approvedBy?.name || orgProfile.signatories[2]?.name || 'Dr. H. Kemekong' },
  ];

  sigs.forEach((sig, idx) => {
    const boxX = margin + idx * (sigBoxWidth + 4);
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, cursorY, sigBoxWidth, sigHeight, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sig.title, boxX + 3, cursorY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.name, boxX + 3, cursorY + 11);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(lang === 'fr' ? '[Signature numérique]' : '[Digital Signature]', boxX + 3, cursorY + 18);
  });

  cursorY += sigHeight + 8;

  // -------------------------------------------------------------
  // 6. Footer Block
  // -------------------------------------------------------------
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(orgProfile.reportFooterText, margin, pageHeight - 8);
  doc.text('Page 1 / 1', pageWidth - margin, pageHeight - 8, { align: 'right' });

  return doc.output('blob');
}

// -------------------------------------------------------------
// Section Renderers: Proctor
// -------------------------------------------------------------
function renderProctorPdfSection(
  doc: jsPDF,
  analysis: GeoLabAnalysis<ProctorInput, ProctorResults>,
  startX: number,
  startY: number,
  totalWidth: number,
  lang: 'en' | 'fr',
  prR: number,
  prG: number,
  prB: number
) {
  const res = analysis.computedResults;
  const pts = res.points || [];

  // Left column: Summary KPIs & Data Table (Width: 90mm)
  const leftWidth = 85;
  const rightWidth = totalWidth - leftWidth - 6;
  const rightX = startX + leftWidth + 6;

  // KPI Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(prR, prG, prB);
  doc.roundedRect(startX, startY, leftWidth, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'RÉSULTATS ESSAI PROCTOR' : 'PROCTOR OPTIMUM RESULTS', startX + 4, startY + 5);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`w_opm = ${res.opmMoisturePercent} %`, startX + 4, startY + 12);
  doc.text(`ρd_opm = ${res.maxDryDensityGcm3} g/cm³`, startX + 4, startY + 18);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`95% ρd = ${res.targetDryDensityGcm3} g/cm³`, startX + 48, startY + 18);

  // Proctor Points Table
  let tableY = startY + 26;
  doc.setFillColor(prR, prG, prB);
  doc.rect(startX, tableY, leftWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Pt' : 'Pt', startX + 2, tableY + 4);
  doc.text(lang === 'fr' ? 'w (%)' : 'w (%)', startX + 14, tableY + 4);
  doc.text(lang === 'fr' ? 'ρd (g/cm³)' : 'ρd (g/cm³)', startX + 32, tableY + 4);
  doc.text(lang === 'fr' ? 'Comp (%)' : 'Comp (%)', startX + 54, tableY + 4);
  doc.text(lang === 'fr' ? 'w_sat (%)' : 'w_sat (%)', startX + 72, tableY + 4);

  tableY += 6;
  pts.forEach((p, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(startX, tableY, leftWidth, 5.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(startX, tableY + 5.5, startX + leftWidth, tableY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(p.pointIndex), startX + 3, tableY + 4);
    doc.text(p.waterContentPercent.toFixed(1), startX + 16, tableY + 4);
    doc.text(p.dryDensityGcm3.toFixed(3), startX + 34, tableY + 4);
    doc.text(`${p.compactionPercentOfOpm || '-'}`, startX + 56, tableY + 4);
    doc.text(p.saturationWaterContentPercent.toFixed(1), startX + 74, tableY + 4);

    tableY += 5.5;
  });

  // Right column: Vector Chart (Width: rightWidth, Height: 70mm)
  const chartHeight = 65;
  drawVectorProctorChart(doc, rightX, startY, rightWidth, chartHeight, res, prR, prG, prB, lang);
}

function drawVectorProctorChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  w: number,
  h: number,
  res: ProctorResults,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  // Chart background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(cx, cy, w, h, 1.5, 1.5, 'FD');

  const plotX = cx + 12;
  const plotY = cy + 8;
  const plotW = w - 16;
  const plotH = h - 18;

  // Grid lines
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + (plotH / 4) * i;
    doc.line(plotX, gy, plotX + plotW, gy);
  }
  for (let i = 0; i <= 5; i++) {
    const gx = plotX + (plotW / 5) * i;
    doc.line(gx, plotY, gx, plotY + plotH);
  }

  // Scales
  const pts = res.points || [];
  const minW = Math.max(0, Math.min(...pts.map((p) => p.waterContentPercent)) - 2);
  const maxW = Math.max(...pts.map((p) => p.waterContentPercent), ...res.saturationCurve.map((s) => s.saturationWaterContentPercent)) + 2;
  const minRho = Math.min(...pts.map((p) => p.dryDensityGcm3)) * 0.96;
  const maxRho = Math.max(...pts.map((p) => p.dryDensityGcm3)) * 1.04;

  const toX = (val: number) => plotX + ((val - minW) / (maxW - minW || 1)) * plotW;
  const toY = (val: number) => plotY + plotH - ((val - minRho) / (maxRho - minRho || 1)) * plotH;

  // Draw Saturation Line (dashed red)
  if (res.saturationCurve && res.saturationCurve.length > 1) {
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.6);
    for (let i = 0; i < res.saturationCurve.length - 1; i++) {
      const p1 = res.saturationCurve[i];
      const p2 = res.saturationCurve[i + 1];
      doc.line(toX(p1.saturationWaterContentPercent), toY(p1.dryDensityGcm3), toX(p2.saturationWaterContentPercent), toY(p2.dryDensityGcm3));
    }
  }

  // Draw Compaction Curve (Polynomial smooth line)
  doc.setDrawColor(prR, prG, prB);
  doc.setLineWidth(0.8);
  const sortedPts = pts.slice().sort((a, b) => a.waterContentPercent - b.waterContentPercent);
  for (let i = 0; i < sortedPts.length - 1; i++) {
    doc.line(
      toX(sortedPts[i].waterContentPercent),
      toY(sortedPts[i].dryDensityGcm3),
      toX(sortedPts[i + 1].waterContentPercent),
      toY(sortedPts[i + 1].dryDensityGcm3)
    );
  }

  // Draw Points
  pts.forEach((p) => {
    const px = toX(p.waterContentPercent);
    const py = toY(p.dryDensityGcm3);
    doc.setFillColor(prR, prG, prB);
    doc.circle(px, py, 1.2, 'FD');
  });

  // Highlight OPM Peak
  const opmX = toX(res.opmMoisturePercent);
  const opmY = toY(res.maxDryDensityGcm3);
  doc.setFillColor(16, 185, 129);
  doc.circle(opmX, opmY, 1.6, 'FD');

  // Axes labels
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${minRho.toFixed(2)}`, cx + 2, plotY + plotH);
  doc.text(`${maxRho.toFixed(2)}`, cx + 2, plotY + 2);
  doc.text(`w: ${minW.toFixed(0)}%`, plotX, cy + h - 3);
  doc.text(`${maxW.toFixed(0)}%`, plotX + plotW - 6, cy + h - 3);

  // Legend
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? '— Courbe Proctor' : '— Compaction', plotX + 10, cy + 5);
  doc.setTextColor(220, 38, 38);
  doc.text(lang === 'fr' ? '--- Saturation (Sr=100%)' : '--- Saturation (Sr=100%)', plotX + 45, cy + 5);
}

// -------------------------------------------------------------
// Section Renderers: Grain Size
// -------------------------------------------------------------
function renderGrainSizePdfSection(
  doc: jsPDF,
  analysis: GeoLabAnalysis<GrainSizeInput, GrainSizeResults>,
  startX: number,
  startY: number,
  totalWidth: number,
  lang: 'en' | 'fr',
  prR: number,
  prG: number,
  prB: number
) {
  const res = analysis.computedResults;
  const rows = res.rows || [];

  const leftWidth = 85;
  const rightWidth = totalWidth - leftWidth - 6;
  const rightX = startX + leftWidth + 6;

  // KPI Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(prR, prG, prB);
  doc.roundedRect(startX, startY, leftWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'CARACTÉRISTIQUES GRANULAIRES' : 'GRAIN SIZE CHARACTERISTICS', startX + 4, startY + 5);

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Passant 2 mm: ${res.passing2mmPercent} % (Sable: ${res.sandPercent}%)`, startX + 4, startY + 11);
  doc.text(`Passant 0,08 mm: ${res.passing008mmPercent} % (Fines: ${res.finesPercent}%)`, startX + 4, startY + 16);
  doc.text(`LCPC: ${res.lcpcClassification}`, startX + 4, startY + 21);

  // Sieve Table
  let tableY = startY + 28;
  doc.setFillColor(prR, prG, prB);
  doc.rect(startX, tableY, leftWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Tamis (mm)' : 'Sieve (mm)', startX + 2, tableY + 4);
  doc.text(lang === 'fr' ? 'Refus (g)' : 'Retained', startX + 24, tableY + 4);
  doc.text(lang === 'fr' ? 'Refus (%)' : 'Ret. (%)', startX + 44, tableY + 4);
  doc.text(lang === 'fr' ? 'Passant (%)' : 'Passing (%)', startX + 64, tableY + 4);

  tableY += 6;
  rows.slice(0, 10).forEach((r, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(startX, tableY, leftWidth, 5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(startX, tableY + 5, startX + leftWidth, tableY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(r.sieveMm.toFixed(2), startX + 3, tableY + 3.8);
    doc.text(r.retainedMassG.toFixed(1), startX + 26, tableY + 3.8);
    doc.text(r.retainedPercent.toFixed(1), startX + 46, tableY + 3.8);
    doc.text(r.passingPercent.toFixed(1), startX + 66, tableY + 3.8);

    tableY += 5;
  });

  // Vector Logarithmic Chart
  drawVectorGrainSizeChart(doc, rightX, startY, rightWidth, 65, res, prR, prG, prB, lang);
}

function drawVectorGrainSizeChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  w: number,
  h: number,
  res: GrainSizeResults,
  prR: number,
  prG: number,
  _prB: number,
  lang: 'en' | 'fr'
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(cx, cy, w, h, 1.5, 1.5, 'FD');

  const plotX = cx + 12;
  const plotY = cy + 8;
  const plotW = w - 16;
  const plotH = h - 18;

  // Log scale from 0.05 mm to 100 mm (range of log10 is -1.3 to 2.0 = ~3.3 decades)
  const minLog = Math.log10(0.05);
  const maxLog = Math.log10(100);

  const toX = (sieveMm: number) => {
    const l = Math.log10(Math.max(0.05, sieveMm));
    return plotX + ((l - minLog) / (maxLog - minLog)) * plotW;
  };

  const toY = (pct: number) => plotY + plotH - (pct / 100) * plotH;

  // Draw Gridlines for 0.1, 1.0, 10.0, 100 mm
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  [0.1, 1.0, 10.0, 100.0].forEach((d) => {
    const gx = toX(d);
    doc.line(gx, plotY, gx, plotY + plotH);
  });
  for (let p = 0; p <= 100; p += 25) {
    const gy = toY(p);
    doc.line(plotX, gy, plotX + plotW, gy);
  }

  // Draw Curve
  const rows = (res.rows || []).slice().sort((a, b) => a.sieveMm - b.sieveMm);
  if (rows.length > 1) {
    doc.setDrawColor(prR, prG, _prB);
    doc.setLineWidth(0.8);
    for (let i = 0; i < rows.length - 1; i++) {
      doc.line(toX(rows[i].sieveMm), toY(rows[i].passingPercent), toX(rows[i + 1].sieveMm), toY(rows[i + 1].passingPercent));
    }
  }

  // Draw points
  rows.forEach((r) => {
    doc.setFillColor(prR, prG, _prB);
    doc.circle(toX(r.sieveMm), toY(r.passingPercent), 1.0, 'FD');
  });

  // Axis text
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('0.1', toX(0.1) - 2, cy + h - 3);
  doc.text('1.0', toX(1.0) - 2, cy + h - 3);
  doc.text('10', toX(10) - 2, cy + h - 3);
  doc.text('100', toX(100) - 3, cy + h - 3);
  doc.text('0%', cx + 2, plotY + plotH);
  doc.text('100%', cx + 2, plotY + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(prR, prG, _prB);
  doc.text(lang === 'fr' ? 'Courbe Granulométrique (log)' : 'Grading Curve (log)', plotX + 10, cy + 5);
}

// -------------------------------------------------------------
// Section Renderers: Water Content
// -------------------------------------------------------------
function renderWaterContentPdfSection(
  doc: jsPDF,
  analysis: GeoLabAnalysis<WaterContentInput, WaterContentResults>,
  startX: number,
  startY: number,
  totalWidth: number,
  lang: 'en' | 'fr',
  prR: number,
  prG: number,
  prB: number
) {
  const res = analysis.computedResults;
  const specs = res.specimens || [];

  // Summary KPI Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(prR, prG, prB);
  doc.roundedRect(startX, startY, totalWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'SYNTHÈSE DE TENEUR EN EAU NATURELLE' : 'WATER CONTENT SUMMARY', startX + 4, startY + 6);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`w = ${res.meanWaterContentPercent} %`, startX + 4, startY + 14);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`${lang === 'fr' ? 'Écart entre prises' : 'Difference Δw'}: ${res.differenceBetweenSpecimensPercent}% (Max: ${res.maxTolerancePercent}%)`, startX + 60, startY + 14);

  const repLabel = res.repeatabilityAccepted
    ? (lang === 'fr' ? 'RÉPÉTABILITÉ CONFORME' : 'REPEATABILITY PASSED')
    : (lang === 'fr' ? 'RÉPÉTABILITÉ NON CONFORME' : 'REPEATABILITY FAILED');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(res.repeatabilityAccepted ? 16 : 220, res.repeatabilityAccepted ? 185 : 38, res.repeatabilityAccepted ? 129 : 38);
  doc.text(repLabel, totalWidth - 45, startY + 14);

  // Table
  let tableY = startY + 24;
  doc.setFillColor(prR, prG, prB);
  doc.rect(startX, tableY, totalWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Éprouvette' : 'Specimen', startX + 4, tableY + 4);
  doc.text(lang === 'fr' ? 'Tare ID' : 'Tare ID', startX + 32, tableY + 4);
  doc.text(lang === 'fr' ? 'Tare m0 (g)' : 'Tare m0 (g)', startX + 60, tableY + 4);
  doc.text(lang === 'fr' ? 'Sol hum.+tare m1 (g)' : 'Wet+tare m1 (g)', startX + 90, tableY + 4);
  doc.text(lang === 'fr' ? 'Sol sec+tare m2 (g)' : 'Dry+tare m2 (g)', startX + 124, tableY + 4);
  doc.text(lang === 'fr' ? 'Teneur en eau w (%)' : 'Water Content w (%)', startX + 154, tableY + 4);

  tableY += 6;
  specs.forEach((s, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(startX, tableY, totalWidth, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(startX, tableY + 6, startX + totalWidth, tableY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(s.specimenId, startX + 5, tableY + 4.2);
    doc.text(s.containerId, startX + 34, tableY + 4.2);
    doc.text(s.tareMassG.toFixed(2), startX + 62, tableY + 4.2);
    doc.text(s.wetSoilPlusTareG.toFixed(2), startX + 92, tableY + 4.2);
    doc.text(s.drySoilPlusTareG.toFixed(2), startX + 126, tableY + 4.2);
    doc.text(s.waterContentPercent.toFixed(2), startX + 156, tableY + 4.2);

    tableY += 6;
  });
}
