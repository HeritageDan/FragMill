/**
 * Word (.docx) Study Report Renderer for FraGeo Lab.
 * Lazily loads the pinned `docx` package to keep initial bundles lean.
 * Produces structured A4 documents with Word navigation headings, native TOC field,
 * running headers/footers, embedded PNG charts, tables, and photo grids.
 */

import type { DocumentModel } from './documentModel';
import { renderChartToPng } from './chartRenderer';

export interface WordRenderProgress {
  current: number;
  total: number;
  message: string;
}

export interface WordRenderOptions {
  onProgress?: (progress: WordRenderProgress) => void;
}

const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
}

export async function generateStudyDocxReport(
  model: DocumentModel,
  options?: WordRenderOptions
): Promise<Blob> {
  const { onProgress } = options || {};
  const lang = model.language;
  const hexPrimary = (model.primaryColor || '#1e40af').replace('#', '');

  onProgress?.({ current: 1, total: 4, message: lang === 'fr' ? 'Chargement du moteur Word...' : 'Loading Word renderer engine...' });
  await yieldToMain();

  // Lazy dynamic import of docx
  const docx = await import('docx');

  onProgress?.({ current: 2, total: 4, message: lang === 'fr' ? 'Construction des sections...' : 'Building document sections...' });
  await yieldToMain();

  const children: any[] = [];

  // -------------------------------------------------------------
  // 1. Cover Page
  // -------------------------------------------------------------
  const coverBlock = model.blocks.find((b) => b.type === 'cover');
  const cover = coverBlock?.coverData;

  if (cover) {
    // Bilingual Authority Header
    if (cover.bilingualHeader?.col1Text || cover.bilingualHeader?.col2Text) {
      children.push(
        new docx.Paragraph({
          spacing: { after: 120 },
          children: [
            new docx.TextRun({
              text: cover.bilingualHeader.col1Text || '',
              bold: true,
              size: 16,
              color: '475569',
            }),
            new docx.TextRun({
              text: `\t${cover.bilingualHeader.col2Text || ''}`,
              bold: true,
              size: 16,
              color: '475569',
            }),
          ],
          tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.convertMillimetersToTwip(174) }],
        })
      );
    }

    // Company / Lab Title
    children.push(
      new docx.Paragraph({
        text: cover.companyName,
        heading: docx.HeadingLevel.TITLE,
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 240, after: 80 },
        run: { color: hexPrimary, bold: true, size: 36 },
      })
    );

    const contactParts = [cover.address, cover.phone ? `Tél: ${cover.phone}` : '', cover.email].filter(Boolean);
    if (contactParts.length > 0) {
      children.push(
        new docx.Paragraph({
          text: contactParts.join(' • '),
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 80 },
          run: { color: '64748B', size: 18 },
        })
      );
    }

    if (cover.accreditationNumber) {
      children.push(
        new docx.Paragraph({
          text: `Agrément / Accréditation N° : ${cover.accreditationNumber}`,
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 200 },
          run: { color: '64748B', size: 18, bold: true },
        })
      );
    }

    // Title Box (with responsive font sizing for long titles)
    const titleLen = cover.studyTitle.length;
    const wordTitleSize = titleLen > 90 ? 24 : titleLen > 50 ? 28 : 32;

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({
                shading: { fill: hexPrimary },
                margins: { top: 240, bottom: 240, left: 240, right: 240 },
                children: [
                  new docx.Paragraph({
                    text: cover.studyTitle.toUpperCase(),
                    alignment: docx.AlignmentType.CENTER,
                    run: { color: 'FFFFFF', bold: true, size: wordTitleSize },
                  }),
                  new docx.Paragraph({
                    text:
                      lang === 'fr'
                        ? "RAPPORT GÉOTECHNIQUE D'ÉTUDE DE SOLS ET MATÉRIAUX"
                        : 'GEOTECHNICAL MATERIALS INVESTIGATION STUDY',
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 80 },
                    run: { color: 'F1F5F9', size: 20 },
                  }),
                  new docx.Paragraph({
                    text: lang === 'fr' ? `Rapport N° : ${cover.reportNumber || 'N/A'}` : `Report No: ${cover.reportNumber || 'N/A'}`,
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 80 },
                    run: { color: 'FFFFFF', bold: true, size: 22 },
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    children.push(new docx.Paragraph({ spacing: { after: 240 } }));

    // Metadata Table (only non-empty fields)
    const metaRows: any[] = [];
    const addMetaRow = (label: string, val?: string) => {
      if (!val?.trim()) return;
      metaRows.push(
        new docx.TableRow({
          children: [
            new docx.TableCell({
              width: { size: 35, type: docx.WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              children: [new docx.Paragraph({ text: label, run: { bold: true, size: 18 } })],
            }),
            new docx.TableCell({
              width: { size: 65, type: docx.WidthType.PERCENTAGE },
              children: [new docx.Paragraph({ text: val, run: { size: 18 } })],
            }),
          ],
        })
      );
    };

    addMetaRow(lang === 'fr' ? 'Projet' : 'Project', cover.projectName);
    addMetaRow(lang === 'fr' ? 'Client' : 'Client', cover.clientName);
    addMetaRow(lang === 'fr' ? 'Programme' : 'Programme', cover.programmeTitle);
    addMetaRow(lang === 'fr' ? 'Lot / Section' : 'Lot / Section', cover.lotSection);
    addMetaRow(lang === 'fr' ? 'N° Marché' : 'Contract No.', cover.contractNumber);
    addMetaRow(lang === 'fr' ? 'N° Appel d’offres' : 'Tender No.', cover.tenderNumber);
    addMetaRow(lang === 'fr' ? 'Financement' : 'Financing', cover.financingText);
    addMetaRow(lang === 'fr' ? 'Site / Localisation' : 'Site Location', cover.siteLocation);

    if (metaRows.length > 0) {
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: metaRows,
        })
      );
      children.push(new docx.Paragraph({ spacing: { after: 200 } }));
    }

    // Revision Table
    const revisions = cover.revisions.length > 0
      ? cover.revisions
      : [{ index: 0, date: new Date().toISOString().split('T')[0], nature: 'Initial issue', preparedBy: '', checkedBy: '', approvedBy: '' }];

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: 'Ind.', run: { bold: true, color: 'FFFFFF', size: 16 } })] }),
              new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: 'Date', run: { bold: true, color: 'FFFFFF', size: 16 } })] }),
              new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Nature des modifications' : 'Nature of changes', run: { bold: true, color: 'FFFFFF', size: 16 } })] }),
              new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Rédigé' : 'Prepared', run: { bold: true, color: 'FFFFFF', size: 16 } })] }),
              new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Vérifié' : 'Checked', run: { bold: true, color: 'FFFFFF', size: 16 } })] }),
              new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Approuvé' : 'Approved', run: { bold: true, color: 'FFFFFF', size: 16 } })] }),
            ],
          }),
          ...revisions.map((rev) =>
            new docx.TableRow({
              children: [
                new docx.TableCell({ children: [new docx.Paragraph({ text: String(rev.index), run: { size: 16 } })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ text: rev.date || '-', run: { size: 16 } })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ text: rev.nature || '-', run: { size: 16 } })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ text: rev.preparedBy || '-', run: { size: 16 } })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ text: rev.checkedBy || '-', run: { size: 16 } })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ text: rev.approvedBy || '-', run: { size: 16 } })] }),
              ],
            })
          ),
        ],
      })
    );

    // Page Break after Cover Page
    children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
  }

  // -------------------------------------------------------------
  // 2. Table of Contents Field
  // -------------------------------------------------------------
  children.push(
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: lang === 'fr' ? 'SOMMAIRE' : 'TABLE OF CONTENTS',
          bold: true,
          color: hexPrimary,
          size: 28, // 14pt (bold, primary color)
        }),
      ],
      spacing: { before: 120, after: 240 }, // 12pt space after
    }),
    new docx.TableOfContents(lang === 'fr' ? 'Sommaire' : 'Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }),
    new docx.Paragraph({ children: [new docx.PageBreak()] })
  );

  // -------------------------------------------------------------
  // 3. Body Sections
  // -------------------------------------------------------------
  let sIdx = 0;
  for (const block of model.blocks) {
    sIdx++;
    if (block.type === 'cover' || block.type === 'toc') continue;

    if (sIdx % 4 === 0) {
      onProgress?.({
        current: 3,
        total: 4,
        message: `${lang === 'fr' ? 'Rendu Word :' : 'Rendering Word:'} ${block.title}`,
      });
      await yieldToMain();
    }

    if (block.type === 'pageBreak') {
      children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
      continue;
    }

    // Heading for Section
    children.push(
      new docx.Paragraph({
        text: block.title,
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      })
    );

    if (block.type === 'narrative' && block.narrativeData) {
      const lines = block.narrativeData.markdown.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('# ')) continue;

        if (line.startsWith('## ')) {
          children.push(
            new docx.Paragraph({
              text: line.replace('## ', ''),
              heading: docx.HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 },
            })
          );
        } else if (line.startsWith('- ')) {
          children.push(
            new docx.Paragraph({
              text: line.replace('- ', ''),
              bullet: { level: 0 },
              spacing: { after: 60 },
            })
          );
        } else {
          children.push(
            new docx.Paragraph({
              text: line,
              spacing: { after: 100 },
            })
          );
        }
      }
    } else if (block.type === 'analysisSummaryTable' && block.summaryRows) {
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Échantillon' : 'Sample', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Type d’essai' : 'Test Type', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Norme' : 'Standard', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: 'Date', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Résultats clés' : 'Key Results', run: { bold: true, color: 'FFFFFF' } })] }),
              ],
            }),
            ...block.summaryRows.map((r) =>
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.sampleId })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.testLabel })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.standard })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.testedDate })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.keyResultsText })] }),
                ],
              })
            ),
          ],
        })
      );
    } else if (block.type === 'analysisDetail' && block.detailData) {
      const d = block.detailData;

      // KPI Results Table
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({ shading: { fill: 'F1F5F9' }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Paramètre' : 'Parameter', run: { bold: true } })] }),
                new docx.TableCell({ shading: { fill: 'F1F5F9' }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Valeur calculée' : 'Computed Value', run: { bold: true } })] }),
                new docx.TableCell({ shading: { fill: 'F1F5F9' }, children: [new docx.Paragraph({ text: 'Unité', run: { bold: true } })] }),
              ],
            }),
            ...d.results.map((res) =>
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ text: res.label })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: String(res.value), run: { bold: true } })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: res.unit || '-' })] }),
                ],
              })
            ),
          ],
        })
      );

      // Embedded Chart PNG
      if (d.chartType && d.analysis.computedResults) {
        try {
          const chartBytes = await renderChartToPng({
            type: d.chartType,
            results: d.analysis.computedResults,
            primaryColor: model.primaryColor,
            lang,
          });

          children.push(
            new docx.Paragraph({
              spacing: { before: 180, after: 120 },
              alignment: docx.AlignmentType.CENTER,
              children: [
                new docx.ImageRun({
                  data: chartBytes,
                  transformation: { width: 520, height: 280 },
                  type: 'png',
                }),
              ],
            })
          );
        } catch {
          // Graceful ignore in stubbed environments
        }
      }

      if (d.observations) {
        children.push(
          new docx.Paragraph({
            text: `Observations : ${d.observations}`,
            spacing: { before: 100, after: 100 },
            run: { italics: true, color: '475569' },
          })
        );
      }
    } else if (block.type === 'gradingCurves' && block.gradingCurvesData) {
      try {
        const series = block.gradingCurvesData.analyses
          .filter((a) => a.computedResults?.curvesPoints)
          .map((a, idx) => ({
            name: a.sampleId || `Échantillon ${idx + 1}`,
            color: '#1e40af',
            points: a.computedResults.curvesPoints,
          }));

        if (series.length > 0) {
          const chartBytes = await renderChartToPng({
            type: 'multi_grain_size',
            series,
            primaryColor: model.primaryColor,
            lang,
          });

          children.push(
            new docx.Paragraph({
              spacing: { before: 180, after: 120 },
              alignment: docx.AlignmentType.CENTER,
              children: [
                new docx.ImageRun({
                  data: chartBytes,
                  transformation: { width: 520, height: 280 },
                  type: 'png',
                }),
              ],
            })
          );
        }
      } catch {}
    } else if (block.type === 'conformityTable' && block.conformityRows) {
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Échantillon' : 'Sample', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Paramètre' : 'Parameter', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: lang === 'fr' ? 'Valeur mesurée' : 'Measured', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: 'Spécification', run: { bold: true, color: 'FFFFFF' } })] }),
                new docx.TableCell({ shading: { fill: hexPrimary }, children: [new docx.Paragraph({ text: 'Statut', run: { bold: true, color: 'FFFFFF' } })] }),
              ],
            }),
            ...block.conformityRows.map((r) =>
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.sampleId })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.parameter })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: String(r.measured) })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: r.specification })] }),
                  new docx.TableCell({
                    shading: { fill: r.status === 'conform' ? 'DCFCE7' : 'FEE2E2' },
                    children: [
                      new docx.Paragraph({
                        text: r.status === 'conform' ? 'CONFORME' : 'NON CONFORME',
                        run: { bold: true, color: r.status === 'conform' ? '15803D' : 'B91C1C' },
                      }),
                    ],
                  }),
                ],
              })
            ),
          ],
        })
      );
    } else if (block.type === 'usageNote' && block.usageNoteText) {
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  shading: { fill: 'FEFCE8' },
                  margins: { top: 180, bottom: 180, left: 180, right: 180 },
                  children: [
                    new docx.Paragraph({
                      text: block.usageNoteText[lang] || block.usageNoteText.en,
                      run: { color: '713F12', size: 18 },
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    } else if (block.type === 'signatureBlock' && block.signatureChain) {
      const chain = block.signatureChain.slice(0, 4);
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: chain.map((sig, idx) =>
                new docx.TableCell({
                  shading: { fill: 'F8FAFC' },
                  margins: { top: 140, bottom: 280, left: 140, right: 140 },
                  children: [
                    new docx.Paragraph({ text: sig.roleLabel?.[lang] || sig.title || `Visa ${idx + 1}`, run: { bold: true, color: hexPrimary, size: 16 } }),
                    new docx.Paragraph({ text: sig.name || '', spacing: { before: 80 }, run: { bold: true, size: 16 } }),
                    new docx.Paragraph({ text: lang === 'fr' ? '[Signature manuscrite]' : '[Handwritten Signature]', spacing: { before: 180 }, run: { color: '94A3B8', size: 14 } }),
                  ],
                })
              ),
            }),
          ],
        })
      );
    } else if (block.type === 'photoPages' && block.photoPageData) {
      const photos = block.photoPageData.photos;
      // 2 columns table
      const rows: any[] = [];
      for (let i = 0; i < photos.length; i += 2) {
        const p1 = photos[i];
        const p2 = photos[i + 1];

        const makeCell = (p?: any) => {
          if (!p) return new docx.TableCell({ children: [new docx.Paragraph({})] });
          const cellChildren: any[] = [];
          if (p.blobOrBase64 && typeof p.blobOrBase64 === 'string') {
            try {
              const bytes = base64ToUint8Array(p.blobOrBase64);
              cellChildren.push(
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  children: [new docx.ImageRun({ data: bytes, transformation: { width: 240, height: 160 }, type: 'jpg' })],
                })
              );
            } catch {
              cellChildren.push(new docx.Paragraph({ text: '[Photo]' }));
            }
          } else {
            cellChildren.push(new docx.Paragraph({ text: '[Photo]' }));
          }

          cellChildren.push(
            new docx.Paragraph({
              text: p.caption || '',
              alignment: docx.AlignmentType.CENTER,
              spacing: { before: 60 },
              run: { size: 16, color: '64748B' },
            })
          );

          return new docx.TableCell({
            width: { size: 50, type: docx.WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: cellChildren,
          });
        };

        rows.push(new docx.TableRow({ children: [makeCell(p1), makeCell(p2)] }));
      }

      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows,
        })
      );
    } else if (block.type === 'annexTestSheets' && block.annexAnalyses) {
      // In Word, annexes are compact native tables for each analysis
      for (const a of block.annexAnalyses) {
        children.push(
          new docx.Paragraph({
            text: `Procès-Verbal : ${a.reportNumber} (${a.testType})`,
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 },
          }),
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ text: 'Réf. Rapport', run: { bold: true } })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: a.reportNumber })] }),
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ text: 'Norme', run: { bold: true } })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: a.standard })] }),
                ],
              }),
              new docx.TableRow({
                children: [
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ text: 'Statut', run: { bold: true } })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: a.status.toUpperCase(), run: { bold: true } })] }),
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ text: 'Date essai', run: { bold: true } })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ text: a.testedDate || a.createdAt })] }),
                ],
              }),
            ],
          })
        );
      }
    } else if (block.type === 'dataQualityNotes' && block.dataQualityNotesText) {
      children.push(
        new docx.Paragraph({
          text: block.dataQualityNotesText,
          spacing: { after: 120 },
          run: { color: '334155', size: 18 },
        })
      );
    }
  }

  // -------------------------------------------------------------
  // 4. Construct Full Document
  // -------------------------------------------------------------
  const doc = new docx.Document({
    features: {
      updateFields: true,
    },
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 20, // 10pt
            color: '0F172A',
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Arial',
            size: 26, // 13pt
            bold: true,
            color: hexPrimary,
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Arial',
            size: 22, // 11pt
            bold: true,
            color: '334155',
          },
          paragraph: {
            spacing: { before: 180, after: 80 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: docx.convertMillimetersToTwip(210),
              height: docx.convertMillimetersToTwip(297),
            },
            margin: {
              top: docx.convertMillimetersToTwip(18),
              bottom: docx.convertMillimetersToTwip(18),
              left: docx.convertMillimetersToTwip(18),
              right: docx.convertMillimetersToTwip(18),
            },
          },
        },
        headers: {
          default: new docx.Header({
            children: [
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: model.organisation.companyName || 'FraGeo Suite',
                    bold: true,
                    size: 16,
                    color: hexPrimary,
                  }),
                  new docx.TextRun({
                    text: `\t${model.study.title}`,
                    size: 16,
                    color: '64748B',
                  }),
                ],
                tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.convertMillimetersToTwip(174) }],
              }),
            ],
          }),
        },
        footers: {
          default: new docx.Footer({
            children: [
              new docx.Paragraph({
                border: {
                  top: {
                    color: hexPrimary,
                    space: 4,
                    style: docx.BorderStyle.SINGLE,
                    size: 6,
                  },
                },
                children: [
                  new docx.TextRun({
                    text: `${model.project.projectName} • ${model.study.reportNumber || model.study.title}${model.isSampleDocument ? ' • SAMPLE - fictional data' : ''}`,
                    size: 16,
                    color: '94A3B8',
                  }),
                  new docx.TextRun({
                    text: '\tPage ',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new docx.TextRun({
                    children: [docx.PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                  }),
                  new docx.TextRun({
                    text: ' / ',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new docx.TextRun({
                    children: [docx.PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '94A3B8',
                  }),
                ],
                tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.convertMillimetersToTwip(174) }],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  onProgress?.({ current: 4, total: 4, message: lang === 'fr' ? 'Assemblage du fichier .docx...' : 'Packing .docx file...' });
  await yieldToMain();

  const blob = await docx.Packer.toBlob(doc);
  return blob;
}
