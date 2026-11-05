/**
 * High-fidelity PDF Study Report Renderer for FraGeo Lab.
 * Features:
 * - Two-pass layout ensuring TOC page numbers exactly match actual content pages.
 * - Branded cover page: bilingual authority header, programme/lot/tender, financing, revision table, approval chain.
 * - Running headers (logos) and running footers (project name, study title, page number, colored rule).
 * - Vector charts (Proctor optimum, Grain size log curve, and multi-curve overlay).
 * - Photo grids (up to 6 photos per page with captions).
 * - Native test sheet annex via renderAnalysisSheet.
 * - Async yielding and progress callbacks for high responsiveness.
 */

import jsPDF from 'jspdf';
import type { DocumentModel } from './documentModel';
import { renderAnalysisSheet } from '../../engine/pdfGenerator';
import { setupUnicodeFont } from '../../engine/pdfFonts';
import { drawVectorMultiGrainSizeChart } from './chartRenderer';
import type { ProctorResults } from '../../tests/proctor';
import type { GrainSizeResults } from '../../tests/grainSize';

export interface PdfRenderProgress {
  current: number;
  total: number;
  message: string;
}

export interface PdfRenderOptions {
  onProgress?: (progress: PdfRenderProgress) => void;
  onDocCreated?: (doc: jsPDF, pass: 1 | 2) => void;
}

export function calculateTocPageCount(itemCount: number): number {
  if (itemCount <= 0) return 0;
  if (itemCount <= 28) return 1;
  return 1 + Math.ceil((itemCount - 28) / 29);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1e40af').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 30;
  const g = parseInt(clean.substring(2, 4), 16) || 64;
  const b = parseInt(clean.substring(4, 6), 16) || 175;
  return [r, g, b];
}

function cleanMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\*/g, '');
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function drawDraftWatermark(doc: jsPDF, pageWidth = 210, pageHeight = 297) {
  doc.saveGraphicsState();
  try {
    if (typeof (doc as any).setGState === 'function' && (doc as any).GState) {
      doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    }
  } catch {}
  // Soft, light pastel sky blue (#BAE6FD / rgb(186, 230, 253)) with high transparency
  doc.setTextColor(186, 230, 253);
  doc.setFontSize(55);
  doc.setFont('times', 'bold');
  doc.text('DRAFT / PROVISOIRE', pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
  });
  doc.restoreGraphicsState();
}

function renderStudyDocumentBlocks(
  doc: jsPDF,
  model: DocumentModel,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  totalStudyPages: number,
  onProgress?: (progress: PdfRenderProgress) => void,
  isPass1: boolean = false
): { sectionPageMap: Record<string, number>; annexPages: Set<number> } {
  const sectionPageMap: Record<string, number> = {};
  const annexPages = new Set<number>();
  const tocBlock = model.blocks.find((b) => b.type === 'toc');
  const tocItems = tocBlock?.tocItems || [];

  const recordBlockPage = (blockId: string, pageNum: number) => {
    if (sectionPageMap[blockId] === undefined) {
      sectionPageMap[blockId] = pageNum;
    }
    for (const item of tocItems) {
      if (sectionPageMap[item.id] === undefined) {
        if (blockId === item.id || blockId.startsWith(item.id + '-') || blockId.startsWith(item.id + '_')) {
          sectionPageMap[item.id] = pageNum;
        }
      }
    }
  };

  const pageWidth = 210;
  const pageHeight = 297;
  const maxY = pageHeight - 20;

  const addPage = () => {
    doc.addPage();
    if (model.isDraftWatermark && !isPass1) {
      drawDraftWatermark(doc, pageWidth, pageHeight);
    }
  };

  // First body page after Cover & TOC
  addPage();
  let currentY = 28;

  let blockIdx = 0;
  for (const block of model.blocks) {
    blockIdx++;
    if (block.type === 'cover' || block.type === 'toc') continue;

    if (!isPass1 && blockIdx % 3 === 0) {
      onProgress?.({
        current: 2 + Math.floor((blockIdx / model.blocks.length) * 2),
        total: 4,
        message: `${lang === 'fr' ? 'Section :' : 'Section:'} ${block.title}`,
      });
    }

    if (block.type === 'pageBreak') {
      addPage();
      currentY = 28;
      continue;
    }

    if (block.type === 'narrative' && block.narrativeData) {
      // Keep-with-next: heading (15mm) + at least 2 lines (9mm)
      if (currentY > maxY - 25) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderNarrativeSection(doc, block.narrativeData, prR, prG, prB, currentY, model.isDraftWatermark && !isPass1);
    } else if (block.type === 'analysisSummaryTable' && block.summaryRows) {
      // Keep-with-next: heading (15mm) + table header (6mm) + 1 row (6mm)
      if (currentY > maxY - 28) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderSummaryTableSection(doc, block.title, block.summaryRows, prR, prG, prB, lang, currentY, model.isDraftWatermark && !isPass1);
    } else if (block.type === 'analysisDetail' && block.detailData) {
      const hasChart = Boolean(block.detailData.chartType && block.detailData.analysis.computedResults);
      const neededH = (block.detailData.sectionTitle ? 18 : 0) + 16 + 30 + (hasChart ? 86 : 0) + (block.detailData.observations ? 18 : 0);
      if (currentY + neededH > maxY) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderAnalysisDetailSection(doc, block.detailData, prR, prG, prB, lang, currentY);
    } else if (block.type === 'gradingCurves' && block.gradingCurvesData) {
      const neededH = block.gradingCurvesData.analyses.length > 0 ? 154 : 45;
      if (currentY + neededH > maxY) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderGradingCurvesSection(doc, block.title, block.gradingCurvesData.analyses, prR, prG, prB, lang, currentY);
    } else if (block.type === 'conformityTable' && block.conformityRows) {
      if (currentY > maxY - 28) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderConformitySection(doc, block.title, block.conformityRows, prR, prG, prB, lang, currentY, model.isDraftWatermark && !isPass1);
    } else if (block.type === 'usageNote' && block.usageNoteText) {
      if (currentY + 52 > maxY) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderUsageNoteSection(doc, block.title, block.usageNoteText, prR, prG, prB, lang, currentY);
    } else if (block.type === 'signatureBlock' && block.signatureChain) {
      const sigCount = Math.min(6, block.signatureChain.length || 1);
      const rows = Math.ceil(sigCount / 3);
      if (currentY + 12 + rows * 28 > maxY) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderSignatureBlockSection(doc, block.title, block.signatureChain, prR, prG, prB, lang, currentY);
    } else if (block.type === 'photoPages' && block.photoPageData) {
      // Photo pages: Annex group forces a fresh page
      addPage();
      currentY = 28;
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      renderPhotoPageSection(doc, block.title, block.photoPageData, prR, prG, prB, lang);
      currentY = 28;
    } else if (block.type === 'annexTestSheets' && block.annexAnalyses) {
      // Annex test sheets: Annex group forces fresh pages via renderAnalysisSheet
      for (let i = 0; i < block.annexAnalyses.length; i++) {
        const a = block.annexAnalyses[i];
        const pageBefore = doc.getNumberOfPages() + 1;
        const res = renderAnalysisSheet(doc, a, {
          client: model.client,
          project: model.project,
          orgProfile: model.organisation,
          language: lang,
          isAnnex: true,
          annexTitle: i === 0 ? block.title : undefined,
          totalStudyPages,
        });
        if (res && res.startPage && res.endPage) {
          for (let p = res.startPage; p <= res.endPage; p++) {
            annexPages.add(p);
          }
        }
        if (i === 0) {
          recordBlockPage(block.id, pageBefore);
        }
      }
      currentY = 28;
      // If there are subsequent blocks (e.g. dataQualityNotes), start on a new page!
      if (blockIdx < model.blocks.length) {
        addPage();
        currentY = 28;
      }
    } else if (block.type === 'dataQualityNotes' && block.dataQualityNotesText) {
      if (currentY + 40 > maxY) {
        addPage();
        currentY = 28;
      }
      recordBlockPage(block.id, doc.getCurrentPageInfo().pageNumber);
      currentY = renderDataQualityNotesSection(doc, block.title, block.dataQualityNotesText, prR, prG, prB, lang, currentY);
    }
  }

  return { sectionPageMap, annexPages };
}

export async function generateStudyPdfReport(
  model: DocumentModel,
  options?: PdfRenderOptions
): Promise<Blob> {
  const { onProgress } = options || {};
  const lang = model.language;
  const [prR, prG, prB] = hexToRgb(model.primaryColor);

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;

  const tocBlock = model.blocks.find((b) => b.type === 'toc');
  const tocItems = tocBlock?.tocItems || [];
  const tocPageCount = calculateTocPageCount(tocItems.length);

  // -------------------------------------------------------------
  // PASS 1: Measured Layout Pass (determine exact real page numbers)
  // -------------------------------------------------------------
  onProgress?.({ current: 1, total: 4, message: lang === 'fr' ? 'Mesure de la pagination...' : 'Measuring document layout...' });
  await yieldToMain();

  const doc1 = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc1.setLineHeightFactor(1.5);
  await setupUnicodeFont(doc1);
  options?.onDocCreated?.(doc1, 1);

  // 1. Cover Page (Page 1)
  renderCoverPage(doc1, model, prR, prG, prB, lang);

  // 2. Reserve TOC pages so pagination does not shift between passes
  for (let i = 0; i < tocPageCount; i++) {
    doc1.addPage();
  }

  // 3. Render body blocks to measure exact starting page numbers
  const { sectionPageMap: measuredPageMap } = renderStudyDocumentBlocks(
    doc1,
    model,
    prR,
    prG,
    prB,
    lang,
    0,
    undefined,
    true
  );
  measuredPageMap['cover'] = 1;
  measuredPageMap['toc'] = 2;
  const totalMeasuredPages = doc1.getNumberOfPages();

  // -------------------------------------------------------------
  // PASS 2: Real Document Assembly (with measured TOC numbers)
  // -------------------------------------------------------------
  onProgress?.({ current: 2, total: 4, message: lang === 'fr' ? 'Génération du rapport PDF...' : 'Rendering PDF report...' });
  await yieldToMain();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setLineHeightFactor(1.5);
  await setupUnicodeFont(doc);
  options?.onDocCreated?.(doc, 2);

  // 1. Cover Page (Page 1)
  renderCoverPage(doc, model, prR, prG, prB, lang);

  // 2. Table of Contents (Page 2 ...)
  if (tocPageCount > 0) {
    doc.addPage();
    if (model.isDraftWatermark) {
      drawDraftWatermark(doc, pageWidth, pageHeight);
    }
    renderTocPage(doc, model, measuredPageMap, prR, prG, prB, lang, model.isDraftWatermark);
  }

  // 3. Body Sections
  const { annexPages } = renderStudyDocumentBlocks(
    doc,
    model,
    prR,
    prG,
    prB,
    lang,
    totalMeasuredPages,
    onProgress,
    false
  );

  // -------------------------------------------------------------
  // PASS 3: Running Furniture (Header Logos, Colored Rules, Footers)
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Skip running header/footer on Cover Page (Page 1) and Annex test sheet pages
    if (p === 1 || annexPages.has(p)) continue;

    // Running Header (Pages 2+)
    const headerLogos = model.organisation.headerLogos || (model.organisation as any).logos;
    const leftLogo = headerLogos?.leftBase64 || headerLogos?.left || model.organisation.logoBase64;
    const rightLogo = headerLogos?.rightBase64 || headerLogos?.right;
    if (leftLogo) {
      try { doc.addImage(leftLogo, 'PNG', margin, 7, 16, 10); } catch {}
    }
    if (rightLogo) {
      try { doc.addImage(rightLogo, 'PNG', pageWidth - margin - 16, 7, 16, 10); } catch {}
    }

    const runningHeaderLeftX = leftLogo ? margin + 19 : margin;
    const runningHeaderRightX = pageWidth - (rightLogo ? margin + 19 : margin);
    const halfHeaderWidth = Math.max(30, (runningHeaderRightX - runningHeaderLeftX - 6) / 2);

    doc.setFont('times', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(prR, prG, prB);
    doc.text(model.organisation.companyName || '', runningHeaderLeftX, 12, { maxWidth: halfHeaderWidth });

    doc.setFont('times', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(model.study.title, runningHeaderRightX, 12, { align: 'right', maxWidth: halfHeaderWidth });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 18, pageWidth - margin, 18);

    // Running Footer (Pages 2+)
    doc.setDrawColor(prR, prG, prB);
    doc.setLineWidth(0.6);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const sampleSuffix = model.isSampleDocument ? ' • SAMPLE - fictional data' : '';
    doc.text(`${model.project.projectName} • ${model.study.reportNumber || model.study.title}${sampleSuffix}`, margin, pageHeight - 7);
    doc.text(`Page ${p} / ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  onProgress?.({ current: 4, total: 4, message: lang === 'fr' ? 'Finalisation...' : 'Complete.' });
  return doc.output('blob');
}

// -------------------------------------------------------------------------
// Section Page Implementations
// -------------------------------------------------------------------------

function renderCoverPage(
  doc: jsPDF,
  model: DocumentModel,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const { coverData } = model.blocks[0] || {};
  if (!coverData) return;

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Watermark drawn first so it remains behind all text and graphics
  if (model.isDraftWatermark) {
    drawDraftWatermark(doc, pageWidth, pageHeight);
  }

  let cursorY = 12;

  // 1. Bilingual Authority Header Block (if present)
  if (coverData.bilingualHeader?.col1Text || coverData.bilingualHeader?.col2Text) {
    doc.setFont('times', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    const col1Lines = coverData.bilingualHeader.col1Text.split('\n').filter(Boolean);
    const col2Lines = coverData.bilingualHeader.col2Text.split('\n').filter(Boolean);
    const maxL = Math.max(col1Lines.length, col2Lines.length);

    col1Lines.forEach((l, i) => doc.text(l, margin, cursorY + i * 3.2));
    col2Lines.forEach((l, i) => doc.text(l, pageWidth - margin, cursorY + i * 3.2, { align: 'right' }));
    cursorY += maxL * 3.2 + 3;
  }

  // Brand rule
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 2, 'F');
  cursorY += 6;

  // Header Logos (Left, Center, Right)
  const leftLogo = coverData.headerLogos?.leftBase64 || coverData.headerLogos?.left || coverData.logoBase64 || model.organisation.logoBase64;
  const centerLogo = coverData.headerLogos?.centerBase64 || coverData.headerLogos?.center;
  const rightLogo = coverData.headerLogos?.rightBase64 || coverData.headerLogos?.right;
  if (leftLogo) {
    try { doc.addImage(leftLogo, 'PNG', margin, cursorY, 24, 15); } catch {}
  }
  if (centerLogo) {
    try { doc.addImage(centerLogo, 'PNG', pageWidth / 2 - 12, cursorY, 24, 15); } catch {}
  }
  if (rightLogo) {
    try { doc.addImage(rightLogo, 'PNG', pageWidth - margin - 24, cursorY, 24, 15); } catch {}
  }

  const hasLogos = Boolean(leftLogo || centerLogo || rightLogo);
  cursorY += hasLogos ? 25 : 6;

  // Laboratory / Company Info
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(prR, prG, prB);
  doc.text(coverData.companyName, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 5.5;

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const labDetails = [coverData.address, coverData.phone ? `Tél: ${coverData.phone}` : '', coverData.email].filter(Boolean).join(' • ');
  if (labDetails) {
    doc.text(labDetails, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 4.5;
  }
  if (coverData.accreditationNumber) {
    doc.text(`Accréditation / Agrément N° : ${coverData.accreditationNumber}`, pageWidth / 2, cursorY, { align: 'center' });
    cursorY += 6;
  } else {
    cursorY += 3;
  }

  // 2. Study Title Banner (in primary color, wrapping & responsive height)
  const bannerInnerWidth = contentWidth - 12; // 6mm padding each side
  let titleFontSize = 15;
  let titleLines: string[] = [];

  // Shrink font size down to minimum (10pt) if needed to fit comfortably
  while (titleFontSize >= 10) {
    doc.setFont('times', 'bold');
    doc.setFontSize(titleFontSize);
    titleLines = doc.splitTextToSize(coverData.studyTitle.toUpperCase(), bannerInnerWidth);
    if (titleLines.length <= 2) break;
    if (titleFontSize === 10) break;
    titleFontSize -= 1;
  }
  // Cap at max 4 lines
  if (titleLines.length > 4) {
    titleLines = titleLines.slice(0, 4);
    if (titleLines[3].length > 3) {
      titleLines[3] = titleLines[3].slice(0, -3) + '...';
    }
  }

  const lineSpacing = titleFontSize * 0.42;
  const titleBlockHeight = titleLines.length * lineSpacing;
  const subtitleHeight = 5;
  const reportNoHeight = 5;
  const bannerTopPadding = 5;
  const bannerBottomPadding = 5;
  const bannerSpacing = 2.5;

  const bannerHeight =
    bannerTopPadding + titleBlockHeight + bannerSpacing + subtitleHeight + bannerSpacing + reportNoHeight + bannerBottomPadding;

  doc.setFillColor(prR, prG, prB);
  doc.roundedRect(margin, cursorY, contentWidth, bannerHeight, 2, 2, 'F');

  let bannerCursorY = cursorY + bannerTopPadding + titleFontSize * 0.35;
  doc.setFont('times', 'bold');
  doc.setFontSize(titleFontSize);
  doc.setTextColor(255, 255, 255);

  titleLines.forEach((line) => {
    doc.text(line, pageWidth / 2, bannerCursorY, { align: 'center' });
    bannerCursorY += lineSpacing;
  });

  bannerCursorY += bannerSpacing;
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(241, 245, 249);
  doc.text(
    lang === 'fr' ? "RAPPORT GÉOTECHNIQUE D'ÉTUDE DE SOLS ET MATÉRIAUX" : 'GEOTECHNICAL MATERIALS INVESTIGATION STUDY',
    pageWidth / 2,
    bannerCursorY,
    { align: 'center' }
  );

  bannerCursorY += reportNoHeight;
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    lang === 'fr' ? `Rapport N° : ${coverData.reportNumber || 'N/A'}` : `Report No: ${coverData.reportNumber || 'N/A'}`,
    pageWidth / 2,
    bannerCursorY,
    { align: 'center' }
  );

  cursorY += bannerHeight + 6;

  // 3. Project Information Block (only stored data; never placeholders)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, contentWidth, 48, 1.5, 1.5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'DONNÉES DU PROJET ET MARCHÉ' : 'PROJECT & CONTRACT METADATA', margin + 4, cursorY + 6);

  doc.setFont('times', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  let pY = cursorY + 12;
  const renderRow = (label: string, val?: string) => {
    if (!val?.trim()) return;
    doc.setFont('times', 'bold');
    doc.text(label, margin + 4, pY);
    doc.setFont('times', 'normal');
    doc.text(val, margin + 50, pY, { maxWidth: contentWidth - 54 });
    pY += 5;
  };

  renderRow(lang === 'fr' ? 'Projet :' : 'Project:', coverData.projectName);
  renderRow(lang === 'fr' ? 'Client / Demandeur :' : 'Client:', coverData.clientName);
  renderRow(lang === 'fr' ? 'Programme :' : 'Programme:', coverData.programmeTitle);
  renderRow(lang === 'fr' ? 'Lot / Section :' : 'Lot / Section:', coverData.lotSection);
  renderRow(lang === 'fr' ? 'N° de Marché :' : 'Contract No.:', coverData.contractNumber);
  renderRow(lang === 'fr' ? 'N° d\'Appel d\'Offres :' : 'Tender No.:', coverData.tenderNumber);
  renderRow(lang === 'fr' ? 'Financement :' : 'Financing:', coverData.financingText);
  renderRow(lang === 'fr' ? 'Localisation :' : 'Site Location:', coverData.siteLocation);

  cursorY += 52;

  // 4. Revision Table
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 5.5, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Ind.' : 'Rev', margin + 2, cursorY + 3.8);
  doc.text('Date', margin + 14, cursorY + 3.8);
  doc.text(lang === 'fr' ? 'Nature des modifications' : 'Nature of change', margin + 40, cursorY + 3.8);
  doc.text(lang === 'fr' ? 'Rédigé' : 'Prepared', margin + 115, cursorY + 3.8);
  doc.text(lang === 'fr' ? 'Vérifié' : 'Checked', margin + 138, cursorY + 3.8);
  doc.text(lang === 'fr' ? 'Approuvé' : 'Approved', margin + 160, cursorY + 3.8);

  cursorY += 5.5;
  const revisions = coverData.revisions.length > 0
    ? coverData.revisions
    : [{ index: 0, date: new Date().toISOString().split('T')[0], nature: 'Initial issue', preparedBy: '', checkedBy: '', approvedBy: '' }];

  revisions.slice(0, 3).forEach((rev, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, cursorY, contentWidth, 5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, cursorY + 5, margin + contentWidth, cursorY + 5);

    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(String(rev.index), margin + 3, cursorY + 3.5);
    doc.text(rev.date || '-', margin + 14, cursorY + 3.5);
    doc.text(rev.nature || '-', margin + 40, cursorY + 3.5);
    doc.text(rev.preparedBy || '-', margin + 115, cursorY + 3.5);
    doc.text(rev.checkedBy || '-', margin + 138, cursorY + 3.5);
    doc.text(rev.approvedBy || '-', margin + 160, cursorY + 3.5);

    cursorY += 5;
  });

  cursorY += 4;

  // 5. Approval Chain Table (empty cells for handwritten signatures)
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, cursorY, contentWidth, 5, 'FD');
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(lang === 'fr' ? 'CHAÎNE D\'APPROBATION ET VISAS' : 'APPROVAL CHAIN & SIGNATURES', margin + 3, cursorY + 3.5);

  cursorY += 5;
  const chain = coverData.approvalChain.length > 0
    ? coverData.approvalChain
    : [
        { id: '1', roleLabel: { en: 'Tested by', fr: 'Essai réalisé par' }, name: '' },
        { id: '2', roleLabel: { en: 'Checked by', fr: 'Vérifié par' }, name: '' },
        { id: '3', roleLabel: { en: 'Approved by', fr: 'Approuvé par' }, name: '' },
      ];

  const colW = contentWidth / Math.min(4, chain.length || 1);
  const boxH = 18;

  chain.slice(0, 4).forEach((sig, idx) => {
    const bX = margin + idx * colW;
    doc.setDrawColor(203, 213, 225);
    doc.rect(bX, cursorY, colW, boxH, 'D');

    doc.setFont('times', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sig.roleLabel?.[lang] || sig.role || `Visa ${idx + 1}`, bX + 2, cursorY + 4);

    if (sig.name) {
      doc.setFont('times', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(sig.name, bX + 2, cursorY + 8);
    }
  });

  // Footer rule and copyright
  doc.setDrawColor(prR, prG, prB);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

  doc.setFont('times', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${coverData.companyName || 'FraGeo Suite'} • FraGeo Lab`, margin, pageHeight - 7);
  doc.text(coverData.reportNumber || 'Study Report', pageWidth - margin, pageHeight - 7, { align: 'right' });
}

function renderTocPage(
  doc: jsPDF,
  model: DocumentModel,
  sectionPageMap: Record<string, number>,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  isDraft: boolean = false
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'SOMMAIRE' : 'TABLE OF CONTENTS', margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 25, 1.2, 'F');
  cursorY += 12;

  const tocBlock = model.blocks.find((b) => b.type === 'toc');
  const items = tocBlock?.tocItems || [];

  items.forEach((item, idx) => {
    if (idx > 0 && cursorY > 265) {
      doc.addPage();
      if (isDraft) {
        drawDraftWatermark(doc, 210, 297);
      }
      cursorY = 28;
    }

    const pageNum = sectionPageMap[item.id] || 2;
    const titleText = item.title;

    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(titleText, margin, cursorY);

    // Dotted leader line
    doc.setFont('times', 'normal');
    doc.setTextColor(148, 163, 184);
    const titleWidth = doc.getTextWidth(titleText);
    const numWidth = doc.getTextWidth(String(pageNum));
    const dotsStart = margin + titleWidth + 3;
    const dotsEnd = margin + contentWidth - numWidth - 3;

    if (dotsEnd > dotsStart) {
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        doc.text('.', dotX, cursorY);
        dotX += 2.8;
      }
    }

    // Page number
    doc.setFont('times', 'bold');
    doc.setTextColor(prR, prG, prB);
    doc.text(String(pageNum), margin + contentWidth, cursorY, { align: 'right' });

    cursorY += 8;
  });
}

function renderNarrativeSection(
  doc: jsPDF,
  narrative: { id: string; title: string; markdown: string },
  prR: number,
  prG: number,
  prB: number,
  startY: number,
  isDraft: boolean = false
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  const pageHeight = 297;
  const maxY = pageHeight - 20;
  let cursorY = startY;

  // Section Heading
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(narrative.title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  // Parse lines: headings, paragraphs, bullet points
  const lines = narrative.markdown.split('\n');
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      cursorY += 4;
      continue;
    }

    if (line.startsWith('# ')) {
      // Subheading (already covered by section title, but handle if present)
      continue;
    } else if (line.startsWith('## ')) {
      if (cursorY > maxY - 15) {
        doc.addPage();
        if (isDraft) {
          drawDraftWatermark(doc);
        }
        cursorY = 28;
      }
      cursorY += 3;
      doc.setFont('times', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(prR, prG, prB);
      doc.text(line.replace('## ', ''), margin, cursorY);
      cursorY += 6;
      doc.setFont('times', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
    } else if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ') || /^[\uE000-\uF8FF]\s*/.test(line)) {
      const bulletText = cleanMarkdown(line.replace(/^(-|\u2022|\*|[\uE000-\uF8FF])\s*/, ''));
      const split = doc.splitTextToSize(bulletText, contentWidth - 8);
      const neededH = split.length * 4.8;
      if (cursorY + neededH > maxY) {
        doc.addPage();
        if (isDraft) {
          drawDraftWatermark(doc);
        }
        cursorY = 28;
      }
      doc.setFillColor(prR, prG, prB);
      doc.circle(margin + 2, cursorY - 1, 0.8, 'F');
      doc.text(split, margin + 6, cursorY, { align: 'justify', maxWidth: contentWidth - 8 });
      cursorY += neededH;
    } else {
      const split = doc.splitTextToSize(cleanMarkdown(line), contentWidth);
      const neededH = split.length * 4.8;
      if (cursorY + neededH > maxY) {
        doc.addPage();
        if (isDraft) {
          drawDraftWatermark(doc);
        }
        cursorY = 28;
      }
      doc.text(split, margin, cursorY, { align: 'justify', maxWidth: contentWidth });
      cursorY += neededH;
    }
  }

  return cursorY + 8.5;
}

function drawSummaryTableHeader(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  cursorY: number,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 6, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Échantillon' : 'Sample ID', margin + 3, cursorY + 4);
  doc.text(lang === 'fr' ? 'Type d\'essai' : 'Test Type', margin + 30, cursorY + 4);
  doc.text(lang === 'fr' ? 'Norme' : 'Standard', margin + 76, cursorY + 4);
  doc.text(lang === 'fr' ? 'Date' : 'Date', margin + 110, cursorY + 4);
  doc.text(lang === 'fr' ? 'Résultats clés' : 'Key Results', margin + 134, cursorY + 4);
}

function renderSummaryTableSection(
  doc: jsPDF,
  title: string,
  rows: Array<{ sampleId: string; testLabel: string; standard: string; testedDate: string; keyResultsText: string }>,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  startY: number,
  isDraft: boolean = false
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  const pageHeight = 297;
  const maxY = pageHeight - 20;
  let cursorY = startY;

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  // Table Header
  drawSummaryTableHeader(doc, margin, contentWidth, cursorY, prR, prG, prB, lang);
  cursorY += 6;

  rows.forEach((r, idx) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    const colSample = doc.splitTextToSize(r.sampleId || '-', 25);
    const colTest = doc.splitTextToSize(r.testLabel || '-', 44);
    const colStd = doc.splitTextToSize(r.standard || '-', 32);
    const colDate = doc.splitTextToSize(r.testedDate || '-', 22);
    const colRes = doc.splitTextToSize(r.keyResultsText || '-', 45);

    const maxLines = Math.max(
      colSample.length,
      colTest.length,
      colStd.length,
      colDate.length,
      colRes.length,
      1
    );
    const rowH = Math.max(6, maxLines * 3.3 + 2.5);

    if (cursorY + rowH > maxY) {
      doc.addPage();
      if (isDraft) {
        drawDraftWatermark(doc);
      }
      cursorY = 28;
      drawSummaryTableHeader(doc, margin, contentWidth, cursorY, prR, prG, prB, lang);
      cursorY += 6;
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, cursorY, contentWidth, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, cursorY + rowH, margin + contentWidth, cursorY + rowH);

    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(colSample, margin + 3, cursorY + 3.8);
    doc.text(colTest, margin + 30, cursorY + 3.8);
    doc.text(colStd, margin + 76, cursorY + 3.8);
    doc.text(colDate, margin + 110, cursorY + 3.8);
    doc.text(colRes, margin + 134, cursorY + 3.8);

    cursorY += rowH;
  });

  return cursorY + 8.5; // Skip a blank line after the table before starting a new paragraph
}

function renderAnalysisDetailSection(
  doc: jsPDF,
  detail: {
    analysis: any;
    sample?: any;
    testLabel: string;
    sectionTitle?: string;
    inputs: Array<{ label: string; value: string | number; unit?: string }>;
    results: Array<{ label: string; value: string | number; unit?: string }>;
    chartType?: 'proctor' | 'grain_size';
    observations?: string;
  },
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  startY: number
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = startY;

  if (detail.sectionTitle) {
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(prR, prG, prB);
    doc.text(detail.sectionTitle.toUpperCase(), margin, cursorY);
    cursorY += 4;

    doc.setFillColor(prR, prG, prB);
    doc.rect(margin, cursorY, 20, 1, 'F');
    cursorY += 8;
  }

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(
    `${detail.testLabel.toUpperCase()} — ${detail.sample?.sampleId || detail.analysis.sampleId}`,
    margin,
    cursorY
  );
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 15, 1, 'F');
  cursorY += 8;

  // Results KPI Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'RÉSULTATS DE CALCUL DE L\'ESSAI' : 'COMPUTED TEST RESULTS', margin + 3, cursorY + 4.5);

  let resY = cursorY + 10;
  detail.results.forEach((res, i) => {
    const colX = margin + 4 + (i % 2) * (contentWidth / 2);
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`${res.label} :`, colX, resY);

    doc.setFont('times', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${res.value} ${res.unit || ''}`, colX + 55, resY);

    if (i % 2 === 1) resY += 5;
  });

  cursorY += 30;

  // Vector Chart for Proctor or Grain Size
  if (detail.chartType === 'proctor' && detail.analysis.computedResults) {
    const res: ProctorResults = detail.analysis.computedResults;
    drawVectorProctorChartDirect(doc, margin, cursorY, contentWidth, 80, res, prR, prG, prB, lang);
    cursorY += 86;
  } else if (detail.chartType === 'grain_size' && detail.analysis.computedResults) {
    const res: GrainSizeResults = detail.analysis.computedResults;
    drawVectorGrainSizeChartDirect(doc, margin, cursorY, contentWidth, 80, res, prR, prG, prB, lang);
    cursorY += 86;
  }

  // Observations
  if (detail.observations) {
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    const splitObs = doc.splitTextToSize(cleanMarkdown(detail.observations), contentWidth - 8);
    const boxHeight = Math.max(16, 8 + splitObs.length * 4.2 + 2);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, boxHeight, 1, 1, 'FD');

    doc.setFont('times', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(prR, prG, prB);
    doc.text(lang === 'fr' ? 'OBSERVATIONS PARTICULIÈRES' : 'SPECIFIC OBSERVATIONS', margin + 3, cursorY + 4.5);

    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(splitObs, margin + 3, cursorY + 9, { align: 'justify', maxWidth: contentWidth - 8 });
    cursorY += boxHeight + 4;
  }

  return cursorY + 8.5;
}

function renderGradingCurvesSection(
  doc: jsPDF,
  title: string,
  analyses: any[],
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  startY: number
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = startY;

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  const series = analyses
    .filter((a) => a.computedResults?.curvesPoints)
    .map((a, idx) => ({
      name: a.sampleId || `Échantillon ${idx + 1}`,
      points: a.computedResults.curvesPoints,
    }));

  if (series.length > 0) {
    drawVectorMultiGrainSizeChart(doc, margin, cursorY, contentWidth, 120, series, lang);
    cursorY += 126;

    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      lang === 'fr'
        ? 'La superposition des courbes montre la dispersion granulométrique des différents échantillons analysés.'
        : 'Grading overlay displays the particle size distribution spread across tested samples.',
      margin,
      cursorY
    );
    cursorY += 8;
  } else {
    const noteText = lang === 'fr'
      ? "Aucun essai d'analyse granulométrique par tamisage (NF P94-056 / NF EN 933-1) n'a été inclus dans le programme d'investigation de la présente étude."
      : "No particle size distribution test by sieving (NF P94-056 / NF EN 933-1) was included in the testing scope for this study.";

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, cursorY, contentWidth, 18, 1.5, 1.5, 'FD');

    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(noteText, margin + 4, cursorY + 11);
    cursorY += 26;
  }

  return cursorY + 8;
}

function drawConformityTableHeader(
  doc: jsPDF,
  margin: number,
  contentWidth: number,
  cursorY: number,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 6, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Échantillon' : 'Sample', margin + 3, cursorY + 4);
  doc.text(lang === 'fr' ? 'Paramètre' : 'Parameter', margin + 40, cursorY + 4);
  doc.text(lang === 'fr' ? 'Valeur mesurée' : 'Measured', margin + 80, cursorY + 4);
  doc.text(lang === 'fr' ? 'Spécification' : 'Specification', margin + 120, cursorY + 4);
  doc.text(lang === 'fr' ? 'Statut' : 'Status', margin + 160, cursorY + 4);
}

function renderConformitySection(
  doc: jsPDF,
  title: string,
  rows: Array<{ sampleId: string; testType: string; parameter: string; measured: string | number; specification: string; status: string }>,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  startY: number,
  isDraft: boolean = false
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  const pageHeight = 297;
  const maxY = pageHeight - 20;
  let cursorY = startY;

  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  if (rows.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      lang === 'fr'
        ? 'Aucune spécification technique de conformité définie pour ce projet.'
        : 'No technical conformity specifications defined for this project.',
      margin,
      cursorY
    );
    return cursorY + 8;
  }

  drawConformityTableHeader(doc, margin, contentWidth, cursorY, prR, prG, prB, lang);
  cursorY += 6;

  rows.forEach((r, idx) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    const colSample = doc.splitTextToSize(r.sampleId || '-', 35);
    const colParam = doc.splitTextToSize(r.parameter || '-', 38);
    const colMeas = doc.splitTextToSize(String(r.measured ?? '-'), 38);
    const colSpec = doc.splitTextToSize(r.specification || '-', 36);

    const maxLines = Math.max(colSample.length, colParam.length, colMeas.length, colSpec.length, 1);
    const rowH = Math.max(6, maxLines * 3.3 + 2.5);

    if (cursorY + rowH > maxY) {
      doc.addPage();
      if (isDraft) {
        drawDraftWatermark(doc);
      }
      cursorY = 28;
      drawConformityTableHeader(doc, margin, contentWidth, cursorY, prR, prG, prB, lang);
      cursorY += 6;
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, cursorY, contentWidth, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, cursorY + rowH, margin + contentWidth, cursorY + rowH);

    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(colSample, margin + 3, cursorY + 3.8);
    doc.text(colParam, margin + 40, cursorY + 3.8);
    doc.text(colMeas, margin + 80, cursorY + 3.8);
    doc.text(colSpec, margin + 120, cursorY + 3.8);

    const isConform = r.status === 'conform';
    doc.setFillColor(isConform ? 16 : 220, isConform ? 185 : 38, isConform ? 129 : 38);
    doc.roundedRect(margin + 158, cursorY + 1.2, 20, 3.8, 0.8, 0.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(6);
    doc.text(
      isConform ? (lang === 'fr' ? 'CONFORME' : 'CONFORMING') : (lang === 'fr' ? 'NON CONFORME' : 'NON-CONFORMING'),
      margin + 168,
      cursorY + 3.8,
      { align: 'center' }
    );

    cursorY += rowH;
  });

  return cursorY + 8.5; // Skip a blank line after the table before starting a new paragraph
}

function renderUsageNoteSection(
  doc: jsPDF,
  title: string,
  usageNote: { en: string; fr: string },
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  startY: number
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = startY;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  const text = usageNote[lang] || usageNote.en;
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  const split = doc.splitTextToSize(text, contentWidth - 8);
  const boxH = Math.max(22, 6 + split.length * 4.2);

  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(margin, cursorY, contentWidth, boxH, 1.5, 1.5, 'FD');

  doc.setTextColor(113, 63, 18);
  doc.text(split, margin + 4, cursorY + 6.5, { align: 'justify', maxWidth: contentWidth - 8 });

  return cursorY + boxH + 8.5;
}

function renderSignatureBlockSection(
  doc: jsPDF,
  title: string,
  chain: any[],
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr',
  startY: number
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = startY;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 12;

  const sigCount = Math.min(6, chain.length || 1);
  const sigBoxWidth = (contentWidth - 8) / (sigCount > 3 ? 3 : sigCount);
  const sigHeight = 28;

  chain.slice(0, 6).forEach((sig, idx) => {
    const rowIdx = Math.floor(idx / 3);
    const colIdx = idx % 3;
    const boxX = margin + colIdx * (sigBoxWidth + 4);
    const boxY = cursorY + rowIdx * (sigHeight + 4);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, boxY, sigBoxWidth, sigHeight, 1.5, 1.5, 'FD');

    const roleTitle = sig.roleLabel?.[lang] || sig.title || (lang === 'fr' ? `Signataire ${idx + 1}` : `Signatory ${idx + 1}`);
    doc.setFont('times', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(prR, prG, prB);
    doc.text(roleTitle, boxX + 3, boxY + 5);

    if (sig.name) {
      doc.setFont('times', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(sig.name, boxX + 3, boxY + 10);
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(lang === 'fr' ? '[Signature manuscrite / Cachet]' : '[Signature / Stamp]', boxX + 3, boxY + 24);
  });

  const numRows = Math.ceil(sigCount / 3);
  return cursorY + numRows * (sigHeight + 4) + 8;
}

function renderPhotoPageSection(
  doc: jsPDF,
  title: string,
  photoPage: { photos: any[]; pageIndex: number; totalPhotoPages: number },
  prR: number,
  prG: number,
  prB: number,
  _lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 8;

  // Grid: 2 columns x 3 rows = 6 photos
  const colW = (contentWidth - 6) / 2;
  const rowH = 68;

  photoPage.photos.slice(0, 6).forEach((photo, idx) => {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const pX = margin + colIdx * (colW + 6);
    const pY = cursorY + rowIdx * (rowH + 4);

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pX, pY, colW, rowH, 1, 1, 'FD');

    // Draw photo image if Base64
    if (photo.blobOrBase64 && typeof photo.blobOrBase64 === 'string') {
      try {
        doc.addImage(photo.blobOrBase64, 'JPEG', pX + 2, pY + 2, colW - 4, 52);
      } catch {
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('[Image]', pX + colW / 2, pY + 28, { align: 'center' });
      }
    } else {
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('[Photo]', pX + colW / 2, pY + 28, { align: 'center' });
    }

    // Caption
    doc.setFont('times', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(photo.caption || `Photo ${idx + 1}`, pX + 3, pY + 60, { maxWidth: colW - 6 });
  });
}

function renderDataQualityNotesSection(
  doc: jsPDF,
  title: string,
  notes: string,
  prR: number,
  prG: number,
  prB: number,
  _lang: 'en' | 'fr',
  startY: number
): number {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = startY;

  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const split = doc.splitTextToSize(notes, contentWidth - 8);
  const boxH = Math.max(24, 10 + split.length * 4.8);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, contentWidth, boxH, 1.5, 1.5, 'FD');

  doc.text(split, margin + 4, cursorY + 6.5, { align: 'justify', maxWidth: contentWidth - 8 });

  return cursorY + boxH + 8.5;
}

// -------------------------------------------------------------------------
// Helper Vector Chart Renderers for Detailed Sections
// -------------------------------------------------------------------------

function drawVectorProctorChartDirect(
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
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(cx, cy, w, h, 1.5, 1.5, 'FD');

  const plotX = cx + 16;
  const plotY = cy + 10;
  const plotW = w - 24;
  const plotH = h - 22;

  const pts = res.points || [];
  const minW = Math.max(0, Math.min(...pts.map((p) => p.waterContentPercent)) - 2);
  const maxW = Math.max(
    ...pts.map((p) => p.waterContentPercent),
    ...res.saturationCurve.map((s) => s.saturationWaterContentPercent)
  ) + 2;
  const minRho = Math.min(...pts.map((p) => p.dryDensityGcm3)) * 0.95;
  const maxRho = Math.max(...pts.map((p) => p.dryDensityGcm3)) * 1.05;

  const toX = (v: number) => plotX + ((v - minW) / (maxW - minW || 1)) * plotW;
  const toY = (v: number) => plotY + plotH - ((v - minRho) / (maxRho - minRho || 1)) * plotH;

  // Grid
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  for (let i = 0; i <= 4; i++) {
    const gy = plotY + (plotH / 4) * i;
    doc.line(plotX, gy, plotX + plotW, gy);
  }

  // Saturation Line
  if (res.saturationCurve && res.saturationCurve.length > 1) {
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.6);
    for (let i = 0; i < res.saturationCurve.length - 1; i++) {
      const p1 = res.saturationCurve[i];
      const p2 = res.saturationCurve[i + 1];
      doc.line(toX(p1.saturationWaterContentPercent), toY(p1.dryDensityGcm3), toX(p2.saturationWaterContentPercent), toY(p2.dryDensityGcm3));
    }
  }

  // Polynomial Fit
  const coeffs = res.fittedCoefficients?.allCoeffs;
  if (coeffs && coeffs.length >= 3 && pts.length > 0) {
    doc.setDrawColor(prR, prG, prB);
    doc.setLineWidth(0.9);
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
  }

  // Points
  pts.forEach((p) => {
    doc.setFillColor(prR, prG, prB);
    doc.circle(toX(p.waterContentPercent), toY(p.dryDensityGcm3), 1.2, 'F');
  });

  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(lang === 'fr' ? 'Courbe Proctor' : 'Proctor Curve', plotX + 2, plotY - 2.5);
}

function drawVectorGrainSizeChartDirect(
  doc: jsPDF,
  cx: number,
  cy: number,
  w: number,
  h: number,
  res: GrainSizeResults,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(cx, cy, w, h, 1.5, 1.5, 'FD');

  const plotX = cx + 16;
  const plotY = cy + 10;
  const plotW = w - 24;
  const plotH = h - 22;

  const minLog = Math.log10(0.01);
  const maxLog = Math.log10(100);
  const toX = (d: number) => {
    const clamped = Math.max(0.01, Math.min(100, d));
    return plotX + ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * plotW;
  };
  const toY = (pct: number) => plotY + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH;

  // Grid
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  [0.01, 0.1, 1, 10, 100].forEach((d) => {
    const gx = toX(d);
    doc.line(gx, plotY, gx, plotY + plotH);
  });
  for (let pct = 0; pct <= 100; pct += 25) {
    const gy = toY(pct);
    doc.line(plotX, gy, plotX + plotW, gy);
  }

  // Curve
  const pts = res.rows || [];
  if (pts.length > 1) {
    doc.setDrawColor(prR, prG, prB);
    doc.setLineWidth(0.8);
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      doc.line(toX(p1.sieveMm), toY(p1.passingPercent), toX(p2.sieveMm), toY(p2.passingPercent));
    }
    pts.forEach((p: { sieveMm: number; passingPercent: number }) => {
      doc.setFillColor(prR, prG, prB);
      doc.circle(toX(p.sieveMm), toY(p.passingPercent), 1, 'F');
    });
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(lang === 'fr' ? 'Courbe Granulométrique' : 'Particle Size Distribution', plotX + 2, plotY - 2.5);
}
