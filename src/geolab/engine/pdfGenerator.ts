import jsPDF from 'jspdf';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
  AnalysisRevision,
} from '../../types/geolab';
import type { GeoLabTestDefinition } from '../tests/types';
import { getTestDefinition } from '../tests';
import type { ProctorInput, ProctorResults } from '../tests/proctor';
import type { GrainSizeInput, GrainSizeResults } from '../tests/grainSize';
import type { WaterContentInput, WaterContentResults } from '../tests/waterContent';
import { setupUnicodeFont, transliterateGreekAndSpecialChars } from './pdfFonts';
import { renderTestChartDataUrlSync, isTestWithGraph } from '../studies/engine/chartRenderer';

export function cleanPdfText(text: any): string {
  if (text === null || text === undefined) return '';
  return transliterateGreekAndSpecialChars(String(text));
}

export interface PdfGenerationOptions {
  analysis: GeoLabAnalysis;
  client: GeoLabClient;
  project: GeoLabProject;
  sample: GeoLabSample;
  orgProfile: OrganisationProfile;
  testDef: GeoLabTestDefinition;
  language?: 'en' | 'fr';
}

export interface AnalysisSheetContext {
  client: GeoLabClient;
  project: GeoLabProject;
  sample?: GeoLabSample;
  orgProfile: OrganisationProfile;
  testDef?: GeoLabTestDefinition;
  language?: 'en' | 'fr';
  isAnnex?: boolean;
  annexTitle?: string;
  totalStudyPages?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1e40af').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 30;
  const g = parseInt(clean.substring(2, 4), 16) || 64;
  const b = parseInt(clean.substring(4, 6), 16) || 175;
  return [r, g, b];
}

function renderObservationsSection(
  doc: jsPDF,
  narrativeText: string,
  margin: number,
  contentWidth: number,
  cursorY: number,
  lang: 'en' | 'fr',
  prR: number,
  prG: number,
  prB: number,
  ensureSpace: (needed: number, curY: number) => number
): number {
  cursorY = ensureSpace(25, cursorY);

  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(prR, prG, prB);
  doc.text(
    lang === 'fr' ? 'OBSERVATIONS & INTERPRÉTATION GÉOTECHNIQUE' : 'OBSERVATIONS & GEOTECHNICAL INTERPRETATION',
    margin,
    cursorY
  );
  cursorY += 4;

  if (!narrativeText || !narrativeText.trim()) {
    narrativeText = lang === 'fr'
      ? 'Essai réalisé conformément à la norme de référence. Résultats conformes aux spécifications du projet.'
      : 'Test performed in accordance with reference standard. Results satisfy project specifications.';
  }

  const rawParagraphs = narrativeText.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  for (const rawPara of rawParagraphs) {
    // 1. Disclaimer tag [AI-drafted...] or [Rédigé par IA...]
    if (rawPara.startsWith('[') && rawPara.endsWith(']')) {
      cursorY = ensureSpace(7, cursorY);
      doc.setFont('times', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(cleanPdfText(rawPara), margin, cursorY + 2.5);
      cursorY += 4.5;
      continue;
    }

    // 2. Heading lines
    const isHeading =
      rawPara.startsWith('##') ||
      rawPara.startsWith('#') ||
      (rawPara.startsWith('**') && rawPara.endsWith('**') && rawPara.length < 90) ||
      rawPara.startsWith('**Recommandation') ||
      rawPara.startsWith('**Recommendation') ||
      rawPara.startsWith('Recommandation') ||
      rawPara.startsWith('Recommendation');

    const cleanPara = cleanPdfText(
      rawPara
        .replace(/^#+\s*/, '')
        .replace(/^\*\*(.*?)\*\*$/, '$1')
        .replace(/\*\*/g, '')
    );

    if (isHeading) {
      cursorY = ensureSpace(8, cursorY);
      doc.setFont('times', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanPara, margin, cursorY + 2.5);
      cursorY += 4.5;
      continue;
    }

    // 3. Regular prose paragraph
    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    const lines = doc.splitTextToSize(cleanPara, contentWidth) as string[];
    const lineH = 3.6;

    for (let i = 0; i < lines.length; i++) {
      cursorY = ensureSpace(lineH + 2, cursorY);
      const isLastLine = i === lines.length - 1;
      const lineText = lines[i];

      // CRITICAL: Never justify a single-line paragraph or the final line of a paragraph!
      if (lines.length > 1 && !isLastLine && lineText.length > 55) {
        doc.text(lineText, margin, cursorY + 2.5, { align: 'justify', maxWidth: contentWidth });
      } else {
        doc.text(lineText, margin, cursorY + 2.5, { align: 'left' });
      }
      cursorY += lineH;
    }

    cursorY += 2; // Paragraph gap
  }

  return cursorY + 3;
}

export function renderAnalysisSheet(
  doc: jsPDF,
  analysis: GeoLabAnalysis,
  ctx: AnalysisSheetContext
): { startPage: number; endPage: number } {
  const { client, project, orgProfile } = ctx;
  const sample = ctx.sample || {
    id: analysis.sampleId,
    projectId: project.id,
    sampleId: analysis.sampleId,
    samplingDate: analysis.testedDate || '-',
    createdAt: '',
    updatedAt: '',
  };
  const testDef = ctx.testDef || getTestDefinition(analysis.testType);
  const lang = ctx.language || orgProfile.defaultLanguage || 'en';

  if (doc.getNumberOfPages() > 0 && ctx.isAnnex) {
    doc.addPage();
  }
  const startPage = doc.getNumberOfPages() === 0 ? 1 : doc.getNumberOfPages();
  const [prR, prG, prB] = hexToRgb(orgProfile.primaryColor);

  doc.setLineHeightFactor(1.5);

  const isDemo = Boolean(
    analysis.isDemo ||
    project.isDemo ||
    client.isDemo ||
    client.companyName === 'Demo Client' ||
    analysis.reportNumber?.startsWith('DEMO-')
  );
  const watermarkText = isDemo ? 'DEMO' : (analysis.status === 'approved' ? '' : 'DRAFT / PROVISOIRE');

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 12;

  // Watermark (DEMO or DRAFT) - drawn first with high transparency so it stays cleanly behind all text
  if (watermarkText) {
    doc.saveGraphicsState();
    try {
      if (typeof (doc as any).setGState === 'function' && (doc as any).GState) {
        doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
      }
    } catch {}
    // Light pastel sky blue
    doc.setTextColor(186, 230, 253);
    doc.setFontSize(watermarkText === 'DEMO' ? 70 : 50);
    doc.setFont('times', 'bold');
    doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  // -------------------------------------------------------------
  // 1. Header Block & Authority / Bilingual Header
  // -------------------------------------------------------------
  const bilingual = orgProfile.bilingualHeaderBlock || (orgProfile as any).bilingualHeader;
  const col1Text = bilingual?.col1Text || bilingual?.column1 || '';
  const col2Text = bilingual?.col2Text || bilingual?.column2 || '';
  if (col1Text || col2Text) {
    doc.setFont('times', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const col1Lines = col1Text.split('\n').filter(Boolean);
    const col2Lines = col2Text.split('\n').filter(Boolean);
    const maxL = Math.max(col1Lines.length, col2Lines.length);

    col1Lines.forEach((l: string, i: number) => doc.text(l, margin, cursorY + i * 3.2));
    col2Lines.forEach((l: string, i: number) => doc.text(l, pageWidth - margin, cursorY + i * 3.2, { align: 'right' }));
    cursorY += maxL * 3.2 + 2;
  }

  // Top brand band
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 2, 'F');
  cursorY += 5;

  // Header Logos: Left, Center, Right
  const headerLogos = orgProfile.headerLogos || (orgProfile as any).logos;
  const leftLogo = headerLogos?.leftBase64 || headerLogos?.left || orgProfile.logoBase64;
  const centerLogo = headerLogos?.centerBase64 || headerLogos?.center;
  const rightLogo = headerLogos?.rightBase64 || headerLogos?.right;
  if (leftLogo) {
    try { doc.addImage(leftLogo, 'PNG', margin, cursorY, 22, 14); } catch {}
  }
  if (centerLogo) {
    try { doc.addImage(centerLogo, 'PNG', pageWidth / 2 - 11, cursorY, 22, 14); } catch {}
  }
  if (rightLogo) {
    try { doc.addImage(rightLogo, 'PNG', pageWidth - margin - 22, cursorY, 22, 14); } catch {}
  }

  // Lab Name & Accreditation (constrained so it never collides with centerLogo or right-side text)
  const textLeft = leftLogo ? margin + 26 : margin;
  const textRightLimit = centerLogo ? pageWidth / 2 - 14 : (rightLogo ? pageWidth - margin - 85 : pageWidth - margin - 70);
  const leftTextMaxW = Math.max(40, textRightLimit - textLeft);

  let leftY = cursorY + 4;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  const companyLines = doc.splitTextToSize(orgProfile.companyName || '', leftTextMaxW);
  doc.text(companyLines, textLeft, leftY);
  leftY += companyLines.length * 4.2;

  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 100, 115);
  const contactParts = [
    orgProfile.address,
    orgProfile.phone ? `Tel: ${orgProfile.phone}` : '',
    orgProfile.email,
  ].filter(Boolean);
  if (contactParts.length > 0) {
    const contactLines = doc.splitTextToSize(contactParts.join(' | '), leftTextMaxW);
    doc.text(contactLines, textLeft, leftY);
    leftY += contactLines.length * 3.4;
  }
  if (orgProfile.accreditationNumber?.trim()) {
    const accLabel = lang === 'fr' ? "N° d'agrément / d'accréditation : " : 'Agrément / Accreditation no.: ';
    const accLines = doc.splitTextToSize(`${accLabel}${orgProfile.accreditationNumber}`, leftTextMaxW);
    doc.text(accLines, textLeft, leftY);
    leftY += accLines.length * 3.4;
  }

  // Right-aligned report number and status (offset to the left of rightLogo to prevent text-to-logo overlap)
  const textRight = rightLogo ? pageWidth - margin - 25 : pageWidth - margin;
  const rightTextMaxW = centerLogo ? (textRight - (pageWidth / 2 + 14)) : 70;

  let rightY = cursorY + 4;
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const repNoLines = doc.splitTextToSize(`${lang === 'fr' ? 'N° Rapport' : 'Report No'}: ${analysis.reportNumber}`, rightTextMaxW);
  doc.text(repNoLines, textRight, rightY, { align: 'right' });
  rightY += repNoLines.length * 4;

  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  const verDateLines = doc.splitTextToSize(`Version: v${analysis.version} | Date: ${analysis.testedDate}`, rightTextMaxW);
  doc.text(verDateLines, textRight, rightY, { align: 'right' });
  rightY += verDateLines.length * 3.4;

  const statusLabel = analysis.status === 'approved'
    ? (lang === 'fr' ? 'APPROUVÉ / DÉFINITIF' : 'APPROVED / FINAL')
    : (lang === 'fr' ? 'BROUILLON (NON AUDITÉ)' : 'DRAFT (UNAUDITED)');
  doc.setTextColor(analysis.status === 'approved' ? 16 : 220, analysis.status === 'approved' ? 185 : 38, analysis.status === 'approved' ? 129 : 38);
  doc.setFont('times', 'bold');
  const statusLines = doc.splitTextToSize(statusLabel, rightTextMaxW);
  doc.text(statusLines, textRight, rightY, { align: 'right' });
  rightY += statusLines.length * 3.4;

  const logoH = (leftLogo || centerLogo || rightLogo) ? 17 : 0;
  cursorY = Math.max(cursorY + logoH, leftY, rightY) + 3;

  // Annex Title (when embedded as study report annex)
  if (ctx.annexTitle) {
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(prR, prG, prB);
    doc.text(ctx.annexTitle.toUpperCase(), margin, cursorY + 1.5);
    cursorY += 6;
  }

  // Title Banner with Form Code
  const formCode = orgProfile.formCodes?.[testDef.id];
  const formCodeText = formCode ? ` [${lang === 'fr' ? 'Formulaire : ' : 'Form: '}${formCode}]` : '';

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, cursorY, contentWidth, 9, 1.5, 1.5, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(prR, prG, prB);
  doc.text(
    `${testDef.name[lang].toUpperCase()} - ${analysis.standard}${formCodeText}`,
    pageWidth / 2,
    cursorY + 6,
    { align: 'center' }
  );

  cursorY += 12;

  // -------------------------------------------------------------
  // 2. Client & Project Block (with Extended Metadata)
  // -------------------------------------------------------------
  const hasExtendedProject = Boolean(
    project.programmeTitle ||
    project.lotSection ||
    project.contractNumber ||
    project.tenderNumber ||
    project.financingText ||
    (project.parties && project.parties.length > 0)
  );
  const projectBoxHeight = hasExtendedProject ? 28 : 22;

  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, cursorY, contentWidth, projectBoxHeight, 1.5, 1.5, 'D');

  const col1X = margin + 3;
  const col2X = margin + 32;
  const col3X = margin + 98;
  const col4X = margin + 132;

  doc.setFontSize(7.5);

  const maxWCol2 = col3X - col2X - 3; // 63mm max width to prevent spilling into col 3
  const maxWCol4 = pageWidth - margin - col4X - 2; // 46mm max width to prevent spilling over right border

  // Row 1
  doc.setFont('times', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Client :' : 'Client:', col1X, cursorY + 4.5);
  doc.setFont('times', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${client.companyName}${client.contactPerson ? ` (${client.contactPerson})` : ''}`, col2X, cursorY + 4.5, { maxWidth: maxWCol2 });

  doc.setFont('times', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Échantillon :' : 'Sample ID:', col3X, cursorY + 4.5);
  doc.setFont('times', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sample.sampleId, col4X, cursorY + 4.5, { maxWidth: maxWCol4 });

  // Row 2
  doc.setFont('times', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Projet :' : 'Project:', col1X, cursorY + 10);
  doc.setFont('times', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.projectName, col2X, cursorY + 10, { maxWidth: maxWCol2 });

  doc.setFont('times', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Profondeur :' : 'Depth:', col3X, cursorY + 10);
  doc.setFont('times', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sample.depth || '-', col4X, cursorY + 10, { maxWidth: maxWCol4 });

  // Row 3
  doc.setFont('times', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Site / Lieu :' : 'Site Location:', col1X, cursorY + 15.5);
  doc.setFont('times', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(project.siteLocation, col2X, cursorY + 15.5, { maxWidth: maxWCol2 });

  doc.setFont('times', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Date prélèvement :' : 'Sample Date:', col3X, cursorY + 15.5);
  doc.setFont('times', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sample.samplingDate, col4X, cursorY + 15.5, { maxWidth: maxWCol4 });

  if (hasExtendedProject) {
    // Row 4: Extended details
    doc.setFont('times', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(lang === 'fr' ? 'Marché / Lot :' : 'Contract / Lot:', col1X, cursorY + 21);
    doc.setFont('times', 'normal');
    doc.setTextColor(15, 23, 42);
    const contractLot = `${project.contractNumber || project.referenceNumber || '-'} ${project.lotSection ? `(${project.lotSection})` : ''}`;
    doc.text(contractLot, col2X, cursorY + 21, { maxWidth: maxWCol2 });

    doc.setFont('times', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(lang === 'fr' ? 'Financement :' : 'Financing:', col3X, cursorY + 21);
    doc.setFont('times', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(project.financingText || (project.parties?.[0]?.name ? `${project.parties[0].role}: ${project.parties[0].name}` : '-'), col4X, cursorY + 21, { maxWidth: maxWCol4 });
  }

  cursorY += projectBoxHeight + 4;

  const FOOTER_Y = pageHeight - 10;
  const MAX_CONTENT_Y = 272;

  const drawRunningHeader = (): number => {
    doc.setFillColor(prR, prG, prB);
    doc.rect(margin, 12, contentWidth, 1.2, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(prR, prG, prB);
    const leftHead = `${cleanPdfText(analysis.reportNumber)} - ${cleanPdfText(testDef.name[lang].toUpperCase())} (${cleanPdfText(analysis.standard)})`;
    doc.text(leftHead, margin, 18);

    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const rightHead = `${cleanPdfText(sample.sampleId)} | ${cleanPdfText(project.projectName || client.companyName)} | ${analysis.testedDate}`;
    doc.text(rightHead, pageWidth - margin, 18, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, 21, pageWidth - margin, 21);

    return 26;
  };

  const ensureSpace = (needed: number, curY: number): number => {
    if (curY + needed > MAX_CONTENT_Y) {
      doc.addPage();
      return drawRunningHeader();
    }
    return curY;
  };

  // -------------------------------------------------------------
  // 3. Test Specific Results & Chart
  // -------------------------------------------------------------
  if (testDef.id === 'proctor') {
    cursorY = renderProctorPdfSection(doc, analysis as GeoLabAnalysis<ProctorInput, ProctorResults>, margin, cursorY, contentWidth, lang, prR, prG, prB, ensureSpace);
  } else if (testDef.id === 'grain_size') {
    cursorY = renderGrainSizePdfSection(doc, analysis as GeoLabAnalysis<GrainSizeInput, GrainSizeResults>, margin, cursorY, contentWidth, lang, prR, prG, prB, ensureSpace);
  } else if (testDef.id === 'water_content') {
    cursorY = renderWaterContentPdfSection(doc, analysis as GeoLabAnalysis<WaterContentInput, WaterContentResults>, margin, cursorY, contentWidth, lang, prR, prG, prB, ensureSpace);
  } else {
    cursorY = renderGenericTestPdfSection(doc, analysis, testDef, margin, cursorY, contentWidth, lang, prR, prG, prB, ensureSpace);
  }

  // -------------------------------------------------------------
  // 4. Revision History Table
  // -------------------------------------------------------------
  const revs: AnalysisRevision[] = (analysis.revisionHistory && analysis.revisionHistory.length > 0)
    ? analysis.revisionHistory
    : [
        {
          index: analysis.version || 1,
          date: analysis.testedDate,
          natureOfChange: lang === 'fr' ? 'Émission initiale' : 'Initial issue',
          preparedBy: analysis.preparedBy?.name || 'Technicien Labo',
          checkedBy: analysis.checkedBy?.name || 'Responsable Qualité',
          approvedBy: analysis.approvedBy?.name || 'Directeur Technique',
        },
      ];

  const revTableH = 6 + Math.min(2, revs.length) * 4.5 + 4;
  cursorY = ensureSpace(revTableH + 6, cursorY);

  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'HISTORIQUE DES RÉVISIONS' : 'REVISION HISTORY', margin, cursorY);
  cursorY += 2;

  const revTableY = cursorY;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, revTableY, contentWidth, 4.2, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'Ind.' : 'Rev', margin + 2, revTableY + 3);
  doc.text('Date', margin + 14, revTableY + 3);
  doc.text(lang === 'fr' ? 'Nature de la modification' : 'Nature of change', margin + 36, revTableY + 3);
  doc.text(lang === 'fr' ? 'Établi par' : 'Prepared by', margin + 98, revTableY + 3);
  doc.text(lang === 'fr' ? 'Vérifié par' : 'Checked by', margin + 126, revTableY + 3);
  doc.text(lang === 'fr' ? 'Approuvé par' : 'Approved by', margin + 154, revTableY + 3);

  cursorY += 4.2;
  revs.slice(0, 2).forEach((rev) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(rev.index ?? rev.revNumber ?? 0), margin + 2, cursorY + 3);
    doc.text(cleanPdfText(rev.date || ''), margin + 14, cursorY + 3);
    doc.text(cleanPdfText(rev.natureOfChange || rev.description || '-'), margin + 36, cursorY + 3);
    doc.text(cleanPdfText(rev.preparedBy || rev.author || '-'), margin + 98, cursorY + 3);
    doc.text(cleanPdfText(rev.checkedBy || '-'), margin + 126, cursorY + 3);
    doc.text(cleanPdfText(rev.approvedBy || '-'), margin + 154, cursorY + 3);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, cursorY + 4, margin + contentWidth, cursorY + 4);
    cursorY += 4.2;
  });
  cursorY += 3;

  // -------------------------------------------------------------
  // 5. Observations & Engineering Interpretation
  // -------------------------------------------------------------
  cursorY = renderObservationsSection(
    doc,
    analysis.observations || analysis.aiNarrative || '',
    margin,
    contentWidth,
    cursorY,
    lang,
    prR,
    prG,
    prB,
    ensureSpace
  );

  // -------------------------------------------------------------
  // 6. Configurable Approval Chain (Up to 6 entries)
  // -------------------------------------------------------------
  const chain = (orgProfile.approvalChain && orgProfile.approvalChain.length > 0)
    ? orgProfile.approvalChain.slice(0, 6)
    : [
        {
          id: 'sig-1',
          roleLabel: { en: 'Tested by (Technician)', fr: 'Réalisé par (Technicien)' },
          name: analysis.preparedBy?.name || orgProfile.signatories?.[0]?.name || '',
          title: analysis.preparedBy?.title || orgProfile.signatories?.[0]?.title || '',
        },
        {
          id: 'sig-2',
          roleLabel: { en: 'Checked by (QA)', fr: 'Vérifié par (Qualité)' },
          name: analysis.checkedBy?.name || orgProfile.signatories?.[1]?.name || '',
          title: analysis.checkedBy?.title || orgProfile.signatories?.[1]?.title || '',
        },
        {
          id: 'sig-3',
          roleLabel: { en: 'Approved by (Director)', fr: 'Approuvé par (Directeur)' },
          name: analysis.approvedBy?.name || orgProfile.signatories?.[2]?.name || '',
          title: analysis.approvedBy?.title || orgProfile.signatories?.[2]?.title || '',
        },
      ];

  const sigCount = Math.min(chain.length, 6);
  const itemsPerRow = sigCount <= 3 ? sigCount : 3;
  const numRows = Math.ceil(sigCount / 3);
  const sigBoxWidth = (contentWidth - (itemsPerRow - 1) * 4) / itemsPerRow;
  const sigHeight = 18;
  const neededSigH = numRows * (sigHeight + 2.5) + 6;

  cursorY = ensureSpace(neededSigH, cursorY);

  chain.forEach((sig, idx) => {
    const rowIdx = Math.floor(idx / 3);
    const colIdx = idx % 3;
    const boxX = margin + colIdx * (sigBoxWidth + 4);
    const boxY = cursorY + rowIdx * (sigHeight + 2.5);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, boxY, sigBoxWidth, sigHeight, 1, 1, 'FD');

    const textMaxW = sig.stampOrSignatureBase64 ? sigBoxWidth - 23 : sigBoxWidth - 5;
    const roleTitle = sig.roleLabel?.[lang] || sig.title || `Signataire ${idx + 1}`;
    doc.setFont('times', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(cleanPdfText(roleTitle), boxX + 2.5, boxY + 4, { maxWidth: textMaxW });

    if (sig.name) {
      doc.setFont('times', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(cleanPdfText(sig.name), boxX + 2.5, boxY + 8.5, { maxWidth: textMaxW });
    }

    if (sig.stampOrSignatureBase64) {
      try {
        doc.addImage(sig.stampOrSignatureBase64, 'PNG', boxX + sigBoxWidth - 20, boxY + 3.5, 17, 12);
      } catch {
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(lang === 'fr' ? '[Cachet numérique]' : '[Digital Stamp]', boxX + 2.5, boxY + 14);
      }
    } else {
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(lang === 'fr' ? '[Signature manuscrite]' : '[Handwritten Signature]', boxX + 2.5, boxY + 14);
    }
  });

  cursorY += numRows * (sigHeight + 2.5) + 4;

  // -------------------------------------------------------------
  // 7. Stamp Running Footers on all pages for this sheet
  // -------------------------------------------------------------
  const totalSheetPages = doc.getNumberOfPages() - startPage + 1;
  for (let p = startPage; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, FOOTER_Y, pageWidth - margin, FOOTER_Y);

    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const footerOrg = orgProfile.reportFooterText || 'FraGeo Suite - FraGeo Lab';
    doc.text(cleanPdfText(footerOrg), margin, pageHeight - 6.5);

    const pageLabel = ctx.isAnnex
      ? `Page ${p} / ${ctx.totalStudyPages || doc.getNumberOfPages()}`
      : `Page ${p - startPage + 1} / ${totalSheetPages}`;
    doc.text(pageLabel, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  }

  return { startPage, endPage: doc.getNumberOfPages() };
}

export async function generateGeoLabPdfReport(options: PdfGenerationOptions): Promise<Blob> {
  const { analysis, client, project, sample, orgProfile, testDef } = options;
  const lang = options.language || orgProfile.defaultLanguage || 'en';

  // Enforce company name requirement on approved reports
  if (analysis.status === 'approved' && !orgProfile.companyName?.trim()) {
    throw new Error(
      lang === 'fr'
        ? 'Veuillez configurer le profil de votre organisation avant de générer des rapports approuvés.'
        : 'Please configure your organisation profile before generating approved reports.'
    );
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setLineHeightFactor(1.5);
  await setupUnicodeFont(doc);
  renderAnalysisSheet(doc, analysis, {
    client,
    project,
    sample,
    orgProfile,
    testDef,
    language: lang,
    isAnnex: false,
  });

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
  prB: number,
  ensureSpace: (needed: number, curY: number) => number
): number {
  startY = ensureSpace(88, startY);
  const res = analysis.computedResults;
  const pts = res.points || [];

  // Left column: Summary KPIs & Data Table (Width: 90mm)
  const leftWidth = 85;
  const rightWidth = totalWidth - leftWidth - 6;
  const rightX = startX + leftWidth + 6;

  // KPI Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(prR, prG, prB);
  doc.roundedRect(startX, startY, leftWidth, 26, 1.5, 1.5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'RÉSULTATS ESSAI PROCTOR' : 'PROCTOR OPTIMUM RESULTS', startX + 4, startY + 5);

  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`w_opm = ${res.opmMoisturePercent} %`, startX + 4, startY + 11.5);
  doc.text(cleanPdfText(`rho_d_opm = ${res.maxDryDensityGcm3} g/cm3`), startX + 4, startY + 17);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(cleanPdfText(`95% rho_d = ${res.targetDryDensityGcm3} g/cm3`), startX + 46, startY + 17);

  const fitMethodLabels: Record<string, { en: string; fr: string }> = {
    quadratic: { en: 'Polynomial deg. 2 (quadratic)', fr: 'Polynôme deg. 2 (quadratique)' },
    cubic: { en: 'Polynomial deg. 3 (cubic)', fr: 'Polynôme deg. 3 (cubique)' },
    quartic: { en: 'Polynomial deg. 4 (quartic)', fr: 'Polynôme deg. 4 (quartique)' },
    manual: { en: 'Manually entered value', fr: 'Valeur saisie manuellement' },
  };
  const fitLabel = fitMethodLabels[res.fitMethod]
    ? fitMethodLabels[res.fitMethod][lang]
    : (res.fitMethod === 'manual' ? (lang === 'fr' ? 'Valeur saisie manuellement' : 'Manually entered value') : res.fitMethod);

  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${lang === 'fr' ? 'Méthode :' : 'Method:'} ${fitLabel}`, startX + 4, startY + 22.5);

  // Proctor Points Table
  let tableY = startY + 29;
  doc.setFillColor(prR, prG, prB);
  doc.rect(startX, tableY, leftWidth, 6, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Pt' : 'Pt', startX + 2, tableY + 4);
  doc.text(lang === 'fr' ? 'w (%)' : 'w (%)', startX + 14, tableY + 4);
  doc.text(cleanPdfText(lang === 'fr' ? 'rho_d (g/cm3)' : 'rho_d (g/cm3)'), startX + 32, tableY + 4);
  doc.text(lang === 'fr' ? 'Comp (%)' : 'Comp (%)', startX + 54, tableY + 4);
  doc.text(cleanPdfText(lang === 'fr' ? 'w_sat (%)' : 'w_sat (%)'), startX + 72, tableY + 4);

  tableY += 6;
  pts.forEach((p, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(startX, tableY, leftWidth, 5.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(startX, tableY + 5.5, startX + leftWidth, tableY + 5.5);

    doc.setFont('times', 'normal');
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
  const hexColor = `#${prR.toString(16).padStart(2, '0')}${prG.toString(16).padStart(2, '0')}${prB.toString(16).padStart(2, '0')}`;
  const chartImg = renderTestChartDataUrlSync('proctor', analysis.rawInput, res, lang, hexColor);
  if (chartImg && chartImg.startsWith('data:image/png')) {
    try {
      doc.addImage(chartImg, 'PNG', rightX, startY, rightWidth, chartHeight);
    } catch {
      drawVectorProctorChart(doc, rightX, startY, rightWidth, chartHeight, res, prR, prG, prB, lang);
    }
  } else {
    drawVectorProctorChart(doc, rightX, startY, rightWidth, chartHeight, res, prR, prG, prB, lang);
  }

  return Math.max(tableY, startY + chartHeight) + 4;
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
  const coeffs = res.fittedCoefficients?.allCoeffs;
  if (coeffs && coeffs.length >= 3) {
    const minPtW = Math.min(...pts.map((p) => p.waterContentPercent));
    const maxPtW = Math.max(...pts.map((p) => p.waterContentPercent));
    const steps = 30;
    let prevX = 0;
    let prevY = 0;
    for (let s = 0; s <= steps; s++) {
      const curW = minPtW + (s / steps) * (maxPtW - minPtW);
      let curRho = 0;
      for (let d = 0; d < coeffs.length; d++) {
        curRho += coeffs[d] * Math.pow(curW, d);
      }
      const curX = toX(curW);
      const curY = toY(curRho);
      if (s > 0) {
        doc.line(prevX, prevY, curX, curY);
      }
      prevX = curX;
      prevY = curY;
    }
  } else {
    const sortedPts = pts.slice().sort((a, b) => a.waterContentPercent - b.waterContentPercent);
    for (let i = 0; i < sortedPts.length - 1; i++) {
      doc.line(
        toX(sortedPts[i].waterContentPercent),
        toY(sortedPts[i].dryDensityGcm3),
        toX(sortedPts[i + 1].waterContentPercent),
        toY(sortedPts[i + 1].dryDensityGcm3)
      );
    }
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
  doc.setFont('times', 'bold');
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
  prB: number,
  ensureSpace: (needed: number, curY: number) => number
): number {
  startY = ensureSpace(88, startY);
  const res = analysis.computedResults;
  const rows = res.rows || [];

  const leftWidth = 85;
  const rightWidth = totalWidth - leftWidth - 6;
  const rightX = startX + leftWidth + 6;

  // KPI Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(prR, prG, prB);
  doc.roundedRect(startX, startY, leftWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'CARACTÉRISTIQUES GRANULAIRES' : 'GRAIN SIZE CHARACTERISTICS', startX + 4, startY + 5);

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(cleanPdfText(`Passant 2 mm: ${res.passing2mmPercent} % (Sable: ${res.sandPercent}%)`), startX + 4, startY + 11);
  doc.text(cleanPdfText(`Passant 0,08 mm: ${res.passing008mmPercent} % (Fines: ${res.finesPercent}%)`), startX + 4, startY + 16);
  doc.text(cleanPdfText(`LCPC: ${res.lcpcClassification}`), startX + 4, startY + 21);

  // Sieve Table
  let tableY = startY + 28;
  doc.setFillColor(prR, prG, prB);
  doc.rect(startX, tableY, leftWidth, 6, 'F');
  doc.setFont('times', 'bold');
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

    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text((r.sieveMm ?? 0).toFixed(2), startX + 3, tableY + 3.8);
    doc.text((r.retainedMassG ?? 0).toFixed(1), startX + 26, tableY + 3.8);
    doc.text(((r.retainedPercent ?? (r as any).cumulatedRetainedPercent ?? (r as any).cumulativeRetainedPercent) ?? 0).toFixed(1), startX + 46, tableY + 3.8);
    doc.text((r.passingPercent ?? 0).toFixed(1), startX + 66, tableY + 3.8);

    tableY += 5;
  });

  // Logarithmic Chart
  const hexColor = `#${prR.toString(16).padStart(2, '0')}${prG.toString(16).padStart(2, '0')}${prB.toString(16).padStart(2, '0')}`;
  const chartImg = renderTestChartDataUrlSync('grain_size', analysis.rawInput, res, lang, hexColor);
  if (chartImg && chartImg.startsWith('data:image/png')) {
    try {
      doc.addImage(chartImg, 'PNG', rightX, startY, rightWidth, 65);
    } catch {
      drawVectorGrainSizeChart(doc, rightX, startY, rightWidth, 65, res, prR, prG, prB, lang);
    }
  } else {
    drawVectorGrainSizeChart(doc, rightX, startY, rightWidth, 65, res, prR, prG, prB, lang);
  }

  return Math.max(tableY, startY + 65) + 4;
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

  doc.setFont('times', 'bold');
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
  prB: number,
  ensureSpace: (needed: number, curY: number) => number
): number {
  startY = ensureSpace(30, startY);
  const res = analysis.computedResults;
  const specs = res.specimens || [];

  // Summary KPI Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(prR, prG, prB);
  doc.setLineWidth(0.4);
  doc.roundedRect(startX, startY, totalWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'SYNTHÈSE DE TENEUR EN EAU NATURELLE' : 'WATER CONTENT SUMMARY', startX + 4, startY + 6);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`w = ${res.meanWaterContentPercent} %`, startX + 4, startY + 14);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const deltaLabel = lang === 'fr' ? 'Écart entre prises' : 'Difference Delta w';
  doc.text(cleanPdfText(`${deltaLabel}: ${res.differenceBetweenSpecimensPercent}% (Max: ${res.maxTolerancePercent}%)`), startX + 50, startY + 14, { maxWidth: 82 });

  const repLabel = res.repeatabilityAccepted
    ? (lang === 'fr' ? 'RÉPÉTABILITÉ CONFORME' : 'REPEATABILITY PASSED')
    : (lang === 'fr' ? 'RÉPÉTABILITÉ NON CONFORME' : 'REPEATABILITY FAILED');
  doc.setFont('times', 'bold');
  doc.setTextColor(res.repeatabilityAccepted ? 16 : 220, res.repeatabilityAccepted ? 185 : 38, res.repeatabilityAccepted ? 129 : 38);
  doc.text(repLabel, startX + totalWidth - 4, startY + 14, { align: 'right' });

  // Table
  let tableY = startY + 24;
  tableY = ensureSpace(specs.length * 6 + 15, tableY);

  doc.setFillColor(prR, prG, prB);
  doc.rect(startX, tableY, totalWidth, 6, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Éprouvette' : 'Specimen', startX + 4, tableY + 4.2);
  doc.text(lang === 'fr' ? 'Tare ID' : 'Tare ID', startX + 32, tableY + 4.2);
  doc.text(lang === 'fr' ? 'Tare m0 (g)' : 'Tare m0 (g)', startX + 60, tableY + 4.2);
  doc.text(lang === 'fr' ? 'Sol hum.+tare m1 (g)' : 'Wet+tare m1 (g)', startX + 90, tableY + 4.2);
  doc.text(lang === 'fr' ? 'Sol sec+tare m2 (g)' : 'Dry+tare m2 (g)', startX + 124, tableY + 4.2);
  doc.text(lang === 'fr' ? 'Teneur en eau w (%)' : 'Water Content w (%)', startX + 154, tableY + 4.2);

  tableY += 6;
  specs.forEach((s, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(startX, tableY, totalWidth, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(startX, tableY + 6, startX + totalWidth, tableY + 6);

    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(s.specimenId), startX + 5, tableY + 4.2);
    doc.text(cleanPdfText(s.containerId), startX + 34, tableY + 4.2);
    doc.text(s.tareMassG.toFixed(2), startX + 62, tableY + 4.2);
    doc.text(s.wetSoilPlusTareG.toFixed(2), startX + 92, tableY + 4.2);
    doc.text(s.drySoilPlusTareG.toFixed(2), startX + 126, tableY + 4.2);
    doc.text(s.waterContentPercent.toFixed(2), startX + 156, tableY + 4.2);

    tableY += 6;
  });

  tableY += 8; // skip a blank line after table

  // Water Content visual graph
  let curY = tableY;
  const hexColor = `#${prR.toString(16).padStart(2, '0')}${prG.toString(16).padStart(2, '0')}${prB.toString(16).padStart(2, '0')}`;
  const chartImg = renderTestChartDataUrlSync('water_content', analysis.rawInput, res, lang, hexColor);
  if (chartImg && chartImg.startsWith('data:image/png')) {
    const chartH = 65;
    curY = ensureSpace(chartH + 6, curY);
    try {
      doc.addImage(chartImg, 'PNG', startX, curY, totalWidth, chartH);
      curY += chartH + 5;
    } catch {}
  }

  return curY;
}

function renderGenericTestPdfSection(
  doc: jsPDF,
  analysis: GeoLabAnalysis,
  testDef: GeoLabTestDefinition,
  startX: number,
  startY: number,
  totalWidth: number,
  lang: 'en' | 'fr',
  prR: number,
  prG: number,
  prB: number,
  ensureSpace: (needed: number, curY: number) => number
): number {
  let cursorY = startY;

  // 1. Key Results KPI Box
  const rawKeyResults = testDef.keyResults ? testDef.keyResults(analysis.computedResults, lang) : [];
  if (rawKeyResults.length > 0) {
    const keyResults = rawKeyResults.map((kr) => ({
      label: cleanPdfText(kr.label),
      value: cleanPdfText(`${kr.value}${kr.unit ? ' ' + kr.unit : ''}`),
    }));

    interface KpiRow {
      isSingle: boolean;
      items: Array<{ label: string; value: string }>;
      rowHeight: number;
    }

    const rows: KpiRow[] = [];
    let i = 0;
    while (i < keyResults.length) {
      const item1 = keyResults[i];
      const isLong1 = item1.label.length + item1.value.length > 40;
      if (isLong1 || i === keyResults.length - 1) {
        const labelW = 45;
        const valW = totalWidth - labelW - 10;
        doc.setFont('times', 'normal');
        doc.setFontSize(7.5);
        const lLines = doc.splitTextToSize(`${item1.label} :`, labelW).length;
        doc.setFont('times', 'bold');
        doc.setFontSize(8);
        const vLines = doc.splitTextToSize(item1.value, valW).length;
        const maxLines = Math.max(lLines, vLines);
        const rowH = Math.max(5.5, maxLines * 3.8 + 1.5);
        rows.push({ isSingle: true, items: [item1], rowHeight: rowH });
        i += 1;
      } else {
        const item2 = keyResults[i + 1];
        const isLong2 = item2.label.length + item2.value.length > 40;
        if (isLong2) {
          const labelW = 45;
          const valW = totalWidth - labelW - 10;
          doc.setFont('times', 'normal');
          doc.setFontSize(7.5);
          const lLines = doc.splitTextToSize(`${item1.label} :`, labelW).length;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          const vLines = doc.splitTextToSize(item1.value, valW).length;
          const maxLines = Math.max(lLines, vLines);
          const rowH = Math.max(5.5, maxLines * 3.8 + 1.5);
          rows.push({ isSingle: true, items: [item1], rowHeight: rowH });
          i += 1;
        } else {
          const colW = (totalWidth - 6) / 2;
          const labelW = 38;
          const valW = colW - labelW - 2;

          doc.setFont('times', 'normal');
          doc.setFontSize(7.5);
          const l1Lines = doc.splitTextToSize(`${item1.label} :`, labelW).length;
          const l2Lines = doc.splitTextToSize(`${item2.label} :`, labelW).length;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          const v1Lines = doc.splitTextToSize(item1.value, valW).length;
          const v2Lines = doc.splitTextToSize(item2.value, valW).length;

          const maxLines = Math.max(l1Lines, l2Lines, v1Lines, v2Lines);
          const rowH = Math.max(5.5, maxLines * 3.8 + 1.5);
          rows.push({ isSingle: false, items: [item1, item2], rowHeight: rowH });
          i += 2;
        }
      }
    }

    const titleH = 7.5;
    const bottomPad = 3;
    const totalKpiH = titleH + rows.reduce((sum, r) => sum + r.rowHeight, 0) + bottomPad;

    cursorY = ensureSpace(totalKpiH + 5, cursorY);

    // Draw box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(prR, prG, prB);
    doc.setLineWidth(0.4);
    doc.roundedRect(startX, cursorY, totalWidth, totalKpiH, 1.5, 1.5, 'FD');

    // Box Title
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(prR, prG, prB);
    doc.text(
      lang === 'fr' ? 'RÉSULTATS DE L’ESSAI' : 'COMPUTED TEST RESULTS',
      startX + 4,
      cursorY + 5.5
    );

    let curRowY = cursorY + titleH;
    rows.forEach((row) => {
      if (row.isSingle) {
        const it = row.items[0];
        const labelW = 45;
        const valW = totalWidth - labelW - 10;

        doc.setFont('times', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`${it.label} :`, startX + 4, curRowY + 3.2, { maxWidth: labelW });

        doc.setFont('times', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(it.value, startX + 4 + labelW + 2, curRowY + 3.2, { maxWidth: valW });
      } else {
        const colW = (totalWidth - 6) / 2;
        const labelW = 38;
        const valW = colW - labelW - 2;

        row.items.forEach((it, colIdx) => {
          const colX = startX + 4 + colIdx * (colW + 3);

          doc.setFont('times', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`${it.label} :`, colX, curRowY + 3.2, { maxWidth: labelW });

          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          doc.text(it.value, colX + labelW + 2, curRowY + 3.2, { maxWidth: valW });
        });
      }
      curRowY += row.rowHeight;
    });

    cursorY += totalKpiH + 5;
  }

  // 2. Input Parameters Box (if parameters exist)
  const params = testDef.inputSchema?.parameters || [];
  if (params.length > 0 && analysis.rawInput) {
    const rawParamItems: Array<{ label: string; value: string }> = [];
    params.forEach((p) => {
      const val = analysis.rawInput[p.key];
      if (val !== undefined && val !== null && val !== '') {
        rawParamItems.push({
          label: cleanPdfText(p.label[lang] || p.key),
          value: cleanPdfText(`${val}${p.unit ? ' ' + p.unit : ''}`),
        });
      }
    });

    if (rawParamItems.length > 0) {
      interface ParamRow {
        isSingle: boolean;
        items: Array<{ label: string; value: string }>;
        rowHeight: number;
      }

      const pRows: ParamRow[] = [];
      let pi = 0;
      while (pi < rawParamItems.length) {
        const item1 = rawParamItems[pi];
        const isLong1 = item1.label.length + item1.value.length > 40;
        if (isLong1 || pi === rawParamItems.length - 1) {
          const labelW = 44;
          const valW = totalWidth - labelW - 10;
          doc.setFont('times', 'normal');
          doc.setFontSize(7);
          const lLines = doc.splitTextToSize(`${item1.label} :`, labelW).length;
          doc.setFont('times', 'bold');
          const vLines = doc.splitTextToSize(item1.value, valW).length;
          const maxLines = Math.max(lLines, vLines);
          const rowH = Math.max(5, maxLines * 3.5 + 1.5);
          pRows.push({ isSingle: true, items: [item1], rowHeight: rowH });
          pi += 1;
        } else {
          const item2 = rawParamItems[pi + 1];
          const isLong2 = item2.label.length + item2.value.length > 40;
          if (isLong2) {
            const labelW = 44;
            const valW = totalWidth - labelW - 10;
            doc.setFont('times', 'normal');
            doc.setFontSize(7);
            const lLines = doc.splitTextToSize(`${item1.label} :`, labelW).length;
            doc.setFont('times', 'bold');
            const vLines = doc.splitTextToSize(item1.value, valW).length;
            const maxLines = Math.max(lLines, vLines);
            const rowH = Math.max(5, maxLines * 3.5 + 1.5);
            pRows.push({ isSingle: true, items: [item1], rowHeight: rowH });
            pi += 1;
          } else {
            const colW = (totalWidth - 6) / 2;
            const labelW = 38;
            const valW = colW - labelW - 2;

            doc.setFont('times', 'normal');
            doc.setFontSize(7);
            const l1Lines = doc.splitTextToSize(`${item1.label} :`, labelW).length;
            const l2Lines = doc.splitTextToSize(`${item2.label} :`, labelW).length;
            doc.setFont('times', 'bold');
            const v1Lines = doc.splitTextToSize(item1.value, valW).length;
            const v2Lines = doc.splitTextToSize(item2.value, valW).length;

            const maxLines = Math.max(l1Lines, l2Lines, v1Lines, v2Lines);
            const rowH = Math.max(5, maxLines * 3.5 + 1.5);
            pRows.push({ isSingle: false, items: [item1, item2], rowHeight: rowH });
            pi += 2;
          }
        }
      }

      const pTitleH = 6.5;
      const pBottomPad = 2.5;
      const totalPH = pTitleH + pRows.reduce((sum, r) => sum + r.rowHeight, 0) + pBottomPad;

      cursorY = ensureSpace(totalPH + 5, cursorY);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.roundedRect(startX, cursorY, totalWidth, totalPH, 1, 1, 'FD');

      doc.setFont('times', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(prR, prG, prB);
      doc.text(lang === 'fr' ? 'PARAMÈTRES D’ESSAI' : 'TEST PARAMETERS', startX + 4, cursorY + 4.5);

      let curRowY = cursorY + pTitleH;
      pRows.forEach((row) => {
        if (row.isSingle) {
          const it = row.items[0];
          const labelW = 44;
          const valW = totalWidth - labelW - 10;

          doc.setFont('times', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(71, 85, 105);
          doc.text(`${it.label} :`, startX + 4, curRowY + 3, { maxWidth: labelW });

          doc.setFont('times', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(15, 23, 42);
          doc.text(it.value, startX + 4 + labelW + 2, curRowY + 3, { maxWidth: valW });
        } else {
          const colW = (totalWidth - 6) / 2;
          const labelW = 38;
          const valW = colW - labelW - 2;

          row.items.forEach((it, colIdx) => {
            const colX = startX + 4 + colIdx * (colW + 3);

            doc.setFont('times', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text(`${it.label} :`, colX, curRowY + 3, { maxWidth: labelW });

            doc.setFont('times', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(15, 23, 42);
            doc.text(it.value, colX + labelW + 2, curRowY + 3, { maxWidth: valW });
          });
        }
        curRowY += row.rowHeight;
      });

      cursorY += totalPH + 5;
    }
  }

  // 3. Raw Data Table (if schema table defined)
  const tableDef = testDef.inputSchema?.table;
  const tableData = tableDef ? analysis.rawInput?.[tableDef.key] : null;
  if (tableDef && Array.isArray(tableData) && tableData.length > 0) {
    const cols = tableDef.columns || [];
    const colW = totalWidth / Math.max(1, cols.length);
    const cellPad = 1.5;
    const innerColW = colW - cellPad * 2;

    // Header with word wrapping and dynamic height
    doc.setFont('times', 'bold');
    doc.setFontSize(6.5);
    const headerLinesList = cols.map((c) => {
      const lbl = cleanPdfText(c.label[lang] || c.key);
      return doc.splitTextToSize(lbl, innerColW);
    });
    const maxHdrLines = Math.max(1, ...headerLinesList.map((hl) => hl.length));
    const headerH = Math.max(6, maxHdrLines * 2.8 + 2.5);

    // Make sure we have space for header + at least 2 rows
    cursorY = ensureSpace(headerH + 15, cursorY);

    const drawTableHeader = (y: number) => {
      doc.setFillColor(prR, prG, prB);
      doc.rect(startX, y, totalWidth, headerH, 'F');
      doc.setFont('times', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      cols.forEach((_, idx) => {
        const colX = startX + idx * colW + cellPad;
        const hl = headerLinesList[idx];
        doc.text(hl, colX, y + 3.2);
      });
    };

    drawTableHeader(cursorY);
    cursorY += headerH;

    // Rows with word wrapping and dynamic row height
    tableData.forEach((row, rIdx) => {
      doc.setFont('times', 'normal');
      doc.setFontSize(6.5);
      const rowLinesList = cols.map((c) => {
        const val = row[c.key];
        const valStr = val !== undefined && val !== null ? cleanPdfText(String(val)) : '-';
        return doc.splitTextToSize(valStr, innerColW);
      });
      const maxRowLines = Math.max(1, ...rowLinesList.map((rl) => rl.length));
      const rowH = Math.max(5.5, maxRowLines * 2.8 + 2);

      // Check space before drawing row: if cursorY + rowH > 270, break page and redraw header!
      if (cursorY + rowH > 270) {
        cursorY = ensureSpace(headerH + rowH + 10, 271);
        drawTableHeader(cursorY);
        cursorY += headerH;
      }

      doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
      doc.rect(startX, cursorY, totalWidth, rowH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(startX, cursorY + rowH, startX + totalWidth, cursorY + rowH);

      doc.setTextColor(15, 23, 42);
      cols.forEach((_, cIdx) => {
        const colX = startX + cIdx * colW + cellPad;
        const rl = rowLinesList[cIdx];
        doc.text(rl, colX, cursorY + 3.2);
      });

      cursorY += rowH;
    });

    cursorY += 8; // Always skip a blank line after a table before starting a new paragraph
  }

  // 4. Exact Test Graph (for tests with graphs)
  if (isTestWithGraph(analysis.testType) && analysis.computedResults) {
    const hexColor = `#${prR.toString(16).padStart(2, '0')}${prG.toString(16).padStart(2, '0')}${prB.toString(16).padStart(2, '0')}`;
    const chartImg = renderTestChartDataUrlSync(analysis.testType, analysis.rawInput, analysis.computedResults, lang, hexColor);
    if (chartImg && chartImg.startsWith('data:image/png')) {
      const chartH = 65;
      cursorY = ensureSpace(chartH + 6, cursorY);
      try {
        doc.addImage(chartImg, 'PNG', startX, cursorY, totalWidth, chartH);
        cursorY += chartH + 5;
      } catch {}
    }
  }

  return cursorY;
}

