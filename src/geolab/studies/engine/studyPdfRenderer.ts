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
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1e40af').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 30;
  const g = parseInt(clean.substring(2, 4), 16) || 64;
  const b = parseInt(clean.substring(4, 6), 16) || 175;
  return [r, g, b];
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

  // -------------------------------------------------------------
  // PASS 1: Layout & Page Calculation (determine exact page for each section)
  // -------------------------------------------------------------
  onProgress?.({ current: 1, total: 4, message: lang === 'fr' ? 'Calcul de la mise en page...' : 'Calculating document layout...' });
  await yieldToMain();

  const sectionPageMap: Record<string, number> = {};
  let simulatedPage = 1; // Page 1: Cover
  sectionPageMap['cover'] = 1;

  // Page 2: Table of Contents
  simulatedPage = 2;
  sectionPageMap['toc'] = 2;

  // Simulate subsequent pages
  for (const block of model.blocks) {
    if (block.type === 'cover' || block.type === 'toc') continue;

    if (block.type === 'pageBreak') {
      simulatedPage++;
      continue;
    }

    if (block.type === 'annexTestSheets') {
      sectionPageMap[block.id] = simulatedPage + 1;
      const count = block.annexAnalyses?.length || 0;
      simulatedPage += count; // 1 page per test sheet
      continue;
    }

    if (block.type === 'photoPages') {
      simulatedPage++;
      sectionPageMap[block.id] = simulatedPage;
      continue;
    }

    if (block.type === 'analysisDetail') {
      simulatedPage++;
      sectionPageMap[block.id] = simulatedPage;
      continue;
    }

    // Standard sections: each starts on a new page or continues
    simulatedPage++;
    sectionPageMap[block.id] = simulatedPage;
  }

  const estimatedTotalPages = simulatedPage;

  // -------------------------------------------------------------
  // PASS 2: Real Document Assembly
  // -------------------------------------------------------------
  onProgress?.({ current: 2, total: 4, message: lang === 'fr' ? 'Génération du rapport PDF...' : 'Rendering PDF report...' });
  await yieldToMain();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // 1. Cover Page (Page 1)
  renderCoverPage(doc, model, prR, prG, prB, lang);

  // 2. Table of Contents (Page 2)
  doc.addPage();
  renderTocPage(doc, model, sectionPageMap, prR, prG, prB, lang);

  // 3. Body Sections
  let blockIdx = 0;
  for (const block of model.blocks) {
    blockIdx++;
    if (block.type === 'cover' || block.type === 'toc') continue;

    if (blockIdx % 3 === 0) {
      onProgress?.({
        current: 2 + Math.floor((blockIdx / model.blocks.length) * 2),
        total: 4,
        message: `${lang === 'fr' ? 'Section :' : 'Section:'} ${block.title}`,
      });
      await yieldToMain();
    }

    if (block.type === 'pageBreak') {
      doc.addPage();
      continue;
    }

    if (block.type === 'narrative' && block.narrativeData) {
      doc.addPage();
      renderNarrativeSection(doc, block.narrativeData, prR, prG, prB);
    } else if (block.type === 'analysisSummaryTable' && block.summaryRows) {
      doc.addPage();
      renderSummaryTableSection(doc, block.title, block.summaryRows, prR, prG, prB, lang);
    } else if (block.type === 'analysisDetail' && block.detailData) {
      doc.addPage();
      renderAnalysisDetailSection(doc, block.detailData, prR, prG, prB, lang);
    } else if (block.type === 'gradingCurves' && block.gradingCurvesData) {
      doc.addPage();
      renderGradingCurvesSection(doc, block.title, block.gradingCurvesData.analyses, prR, prG, prB, lang);
    } else if (block.type === 'conformityTable' && block.conformityRows) {
      doc.addPage();
      renderConformitySection(doc, block.title, block.conformityRows, prR, prG, prB, lang);
    } else if (block.type === 'usageNote' && block.usageNoteText) {
      doc.addPage();
      renderUsageNoteSection(doc, block.title, block.usageNoteText, prR, prG, prB, lang);
    } else if (block.type === 'signatureBlock' && block.signatureChain) {
      doc.addPage();
      renderSignatureBlockSection(doc, block.title, block.signatureChain, prR, prG, prB, lang);
    } else if (block.type === 'photoPages' && block.photoPageData) {
      doc.addPage();
      renderPhotoPageSection(doc, block.title, block.photoPageData, prR, prG, prB, lang);
    } else if (block.type === 'annexTestSheets' && block.annexAnalyses) {
      for (const a of block.annexAnalyses) {
        renderAnalysisSheet(doc, a, {
          client: model.client,
          project: model.project,
          orgProfile: model.organisation,
          language: lang,
          isAnnex: true,
          totalStudyPages: estimatedTotalPages,
        });
      }
    } else if (block.type === 'dataQualityNotes' && block.dataQualityNotesText) {
      doc.addPage();
      renderDataQualityNotesSection(doc, block.title, block.dataQualityNotesText, prR, prG, prB, lang);
    }
  }

  // -------------------------------------------------------------
  // PASS 3: Running Furniture (Header Logos, Colored Rules, Footers & Watermark)
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Watermark
    if (model.isDraftWatermark) {
      doc.saveGraphicsState();
      doc.setTextColor(240, 240, 240);
      doc.setFontSize(55);
      doc.setFont('helvetica', 'bold');
      doc.text('DRAFT / PROVISOIRE', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
      doc.restoreGraphicsState();
    }

    // Skip running header/footer on Cover Page (Page 1)
    if (p === 1) continue;

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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(prR, prG, prB);
    doc.text(model.organisation.companyName || '', leftLogo ? margin + 19 : margin, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(model.study.title, pageWidth - (rightLogo ? margin + 19 : margin), 12, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 18, pageWidth - margin, 18);

    // Running Footer (Pages 2+)
    doc.setDrawColor(prR, prG, prB);
    doc.setLineWidth(0.6);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${model.project.projectName} • ${model.study.reportNumber || model.study.title}`, margin, pageHeight - 7);
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
  let cursorY = 12;

  // 1. Bilingual Authority Header Block (if present)
  if (coverData.bilingualHeader?.col1Text || coverData.bilingualHeader?.col2Text) {
    doc.setFont('helvetica', 'bold');
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
  const leftLogo = coverData.headerLogos?.leftBase64 || coverData.headerLogos?.left;
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

  cursorY += 18;

  // Laboratory / Company Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(prR, prG, prB);
  doc.text(coverData.companyName, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 5.5;

  doc.setFont('helvetica', 'normal');
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

  // 2. Study Title Banner (in primary color)
  doc.setFillColor(prR, prG, prB);
  doc.roundedRect(margin, cursorY, contentWidth, 28, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(coverData.studyTitle.toUpperCase(), pageWidth / 2, cursorY + 11, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  doc.text(
    lang === 'fr' ? 'RAPPORT GÉOTECHNIQUE D\'ÉTUDE DE SOLS ET MATÉRIAUX' : 'GEOTECHNICAL MATERIALS INVESTIGATION STUDY',
    pageWidth / 2,
    cursorY + 18,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`Rapport N° : ${coverData.reportNumber || 'N/A'}`, pageWidth / 2, cursorY + 24, { align: 'center' });
  cursorY += 34;

  // 3. Project Information Block (only stored data; never placeholders)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, contentWidth, 48, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'DONNÉES DU PROJET ET MARCHÉ' : 'PROJECT & CONTRACT METADATA', margin + 4, cursorY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);

  let pY = cursorY + 12;
  const renderRow = (label: string, val?: string) => {
    if (!val?.trim()) return;
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + 4, pY);
    doc.setFont('helvetica', 'normal');
    doc.text(val, margin + 50, pY);
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
  doc.setFont('helvetica', 'bold');
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

    doc.setFont('helvetica', 'normal');
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
  doc.setFont('helvetica', 'bold');
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sig.roleLabel?.[lang] || sig.role || `Visa ${idx + 1}`, bX + 2, cursorY + 4);

    if (sig.name) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(sig.name, bX + 2, cursorY + 8);
    }
  });

  // Footer rule and copyright
  doc.setDrawColor(prR, prG, prB);
  doc.setLineWidth(0.8);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${coverData.companyName || 'FraGeo Suite'} • Geolab`, margin, pageHeight - 7);
  doc.text(coverData.reportNumber || 'Study Report', pageWidth - margin, pageHeight - 7, { align: 'right' });
}

function renderTocPage(
  doc: jsPDF,
  model: DocumentModel,
  sectionPageMap: Record<string, number>,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'SOMMAIRE' : 'TABLE OF CONTENTS', margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 25, 1.2, 'F');
  cursorY += 12;

  const tocBlock = model.blocks.find((b) => b.type === 'toc');
  const items = tocBlock?.tocItems || [];

  items.forEach((item) => {
    const pageNum = sectionPageMap[item.id] || 2;
    const titleText = item.title;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(titleText, margin, cursorY);

    // Dotted leader line
    doc.setFont('helvetica', 'normal');
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
    doc.setFont('helvetica', 'bold');
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
  prB: number
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  // Section Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(narrative.title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  // Parse lines: headings, paragraphs, bullet points
  const lines = narrative.markdown.split('\n');
  doc.setFont('helvetica', 'normal');
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
      cursorY += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(prR, prG, prB);
      doc.text(line.replace('## ', ''), margin, cursorY);
      cursorY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
    } else if (line.startsWith('- ')) {
      const bulletText = line.replace('- ', '');
      doc.setFillColor(prR, prG, prB);
      doc.circle(margin + 2, cursorY - 1, 0.8, 'F');
      const split = doc.splitTextToSize(bulletText, contentWidth - 8);
      doc.text(split, margin + 6, cursorY);
      cursorY += split.length * 4.5;
    } else {
      const split = doc.splitTextToSize(line, contentWidth);
      doc.text(split, margin, cursorY);
      cursorY += split.length * 4.5;
    }
  }
}

function renderSummaryTableSection(
  doc: jsPDF,
  title: string,
  rows: Array<{ sampleId: string; testLabel: string; standard: string; testedDate: string; keyResultsText: string }>,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  // Table Header
  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Échantillon' : 'Sample ID', margin + 3, cursorY + 4);
  doc.text(lang === 'fr' ? 'Type d\'essai' : 'Test Type', margin + 32, cursorY + 4);
  doc.text(lang === 'fr' ? 'Norme' : 'Standard', margin + 75, cursorY + 4);
  doc.text(lang === 'fr' ? 'Date' : 'Date', margin + 110, cursorY + 4);
  doc.text(lang === 'fr' ? 'Résultats clés' : 'Key Results', margin + 135, cursorY + 4);

  cursorY += 6;

  rows.forEach((r, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, cursorY, contentWidth, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, cursorY + 6, margin + contentWidth, cursorY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(r.sampleId, margin + 3, cursorY + 4);
    doc.text(r.testLabel, margin + 32, cursorY + 4);
    doc.text(r.standard, margin + 75, cursorY + 4);
    doc.text(r.testedDate, margin + 110, cursorY + 4);
    doc.text(r.keyResultsText, margin + 135, cursorY + 4);

    cursorY += 6;
  });
}

function renderAnalysisDetailSection(
  doc: jsPDF,
  detail: {
    analysis: any;
    sample?: any;
    testLabel: string;
    inputs: Array<{ label: string; value: string | number; unit?: string }>;
    results: Array<{ label: string; value: string | number; unit?: string }>;
    chartType?: 'proctor' | 'grain_size';
    observations?: string;
  },
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  // Title
  doc.setFont('helvetica', 'bold');
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(prR, prG, prB);
  doc.text(lang === 'fr' ? 'RÉSULTATS DE CALCUL DE L\'ESSAI' : 'COMPUTED TEST RESULTS', margin + 3, cursorY + 4.5);

  let resY = cursorY + 10;
  detail.results.forEach((res, i) => {
    const colX = margin + 4 + (i % 2) * (contentWidth / 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`${res.label} :`, colX, resY);

    doc.setFont('helvetica', 'bold');
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
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, 14, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(prR, prG, prB);
    doc.text(lang === 'fr' ? 'OBSERVATIONS PARTICULIÈRES' : 'SPECIFIC OBSERVATIONS', margin + 3, cursorY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(detail.observations, margin + 3, cursorY + 9, { maxWidth: contentWidth - 6 });
  }
}

function renderGradingCurvesSection(
  doc: jsPDF,
  title: string,
  analyses: any[],
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('helvetica', 'bold');
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
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    lang === 'fr'
      ? 'La superposition des courbes montre la dispersion granulométrique des différents échantillons analysés.'
      : 'Grading overlay displays the particle size distribution spread across tested samples.',
    margin,
    cursorY
  );
}

function renderConformitySection(
  doc: jsPDF,
  title: string,
  rows: Array<{ sampleId: string; testType: string; parameter: string; measured: string | number; specification: string; status: string }>,
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(lang === 'fr' ? 'Échantillon' : 'Sample', margin + 3, cursorY + 4);
  doc.text(lang === 'fr' ? 'Paramètre' : 'Parameter', margin + 40, cursorY + 4);
  doc.text(lang === 'fr' ? 'Valeur mesurée' : 'Measured', margin + 80, cursorY + 4);
  doc.text(lang === 'fr' ? 'Spécification' : 'Specification', margin + 120, cursorY + 4);
  doc.text(lang === 'fr' ? 'Statut' : 'Status', margin + 160, cursorY + 4);

  cursorY += 6;

  rows.forEach((r, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(margin, cursorY, contentWidth, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, cursorY + 6, margin + contentWidth, cursorY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(r.sampleId, margin + 3, cursorY + 4);
    doc.text(r.parameter, margin + 40, cursorY + 4);
    doc.text(String(r.measured), margin + 80, cursorY + 4);
    doc.text(r.specification, margin + 120, cursorY + 4);

    const isConform = r.status === 'conform';
    doc.setFillColor(isConform ? 16 : 220, isConform ? 185 : 38, isConform ? 129 : 38);
    doc.roundedRect(margin + 158, cursorY + 1.2, 20, 3.8, 0.8, 0.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(isConform ? 'CONFORME' : 'NON CONFORME', margin + 168, cursorY + 3.8, { align: 'center' });

    cursorY += 6;
  });
}

function renderUsageNoteSection(
  doc: jsPDF,
  title: string,
  usageNote: { en: string; fr: string },
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(margin, cursorY, contentWidth, 36, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(113, 63, 18);
  const text = usageNote[lang] || usageNote.en;
  const split = doc.splitTextToSize(text, contentWidth - 8);
  doc.text(split, margin + 4, cursorY + 7);
}

function renderSignatureBlockSection(
  doc: jsPDF,
  title: string,
  chain: any[],
  prR: number,
  prG: number,
  prB: number,
  lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('helvetica', 'bold');
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

    const roleTitle = sig.roleLabel?.[lang] || sig.title || `Signataire ${idx + 1}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(prR, prG, prB);
    doc.text(roleTitle, boxX + 3, boxY + 5);

    if (sig.name) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(sig.name, boxX + 3, boxY + 10);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(lang === 'fr' ? '[Signature manuscrite / Cachet]' : '[Signature / Stamp]', boxX + 3, boxY + 24);
  });
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

  doc.setFont('helvetica', 'bold');
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
    doc.setFont('helvetica', 'normal');
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
  _lang: 'en' | 'fr'
) {
  const margin = 14;
  const contentWidth = 210 - margin * 2;
  let cursorY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(prR, prG, prB);
  doc.text(title.toUpperCase(), margin, cursorY);
  cursorY += 4;

  doc.setFillColor(prR, prG, prB);
  doc.rect(margin, cursorY, 20, 1, 'F');
  cursorY += 10;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const split = doc.splitTextToSize(notes, contentWidth - 8);
  doc.text(split, margin + 4, cursorY + 7);
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

  doc.setFont('helvetica', 'bold');
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(lang === 'fr' ? 'Courbe Granulométrique' : 'Particle Size Distribution', plotX + 2, plotY - 2.5);
}
