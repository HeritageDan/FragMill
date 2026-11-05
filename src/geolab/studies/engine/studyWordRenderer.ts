/**
 * Word (.docx) Study Report Renderer for FraGeo Lab.
 * Lazily loads the pinned `docx` package to keep initial bundles lean.
 * Produces structured A4 documents with Word navigation headings, native TOC field,
 * running headers/footers, embedded PNG charts, tables, and photo grids.
 */

import type { DocumentModel } from './documentModel';
import { renderChartToPng, renderTestChartPng } from './chartRenderer';

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

  const getHexLuminance = (hex: string): number => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  const getContrastColor = (bgHex: string): string => {
    const lum = getHexLuminance(bgHex);
    return lum < 140 ? 'FFFFFF' : '0F172A';
  };

  const parseMarkdownToRuns = (
    text: string,
    baseOptions: {
      italics?: boolean;
      color?: string;
      size?: number;
      font?: string;
      bold?: boolean;
    } = {}
  ): any[] => {
    const runs: any[] = [];
    const font = baseOptions.font || 'Times New Roman';
    const tokens = text.split(/(\*\*.*?\*\*|\*[^*\n]+?\*)/g);

    for (const token of tokens) {
      if (!token) continue;
      if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        const content = token.slice(2, -2).trim();
        runs.push(
          new docx.TextRun({
            ...baseOptions,
            text: content,
            bold: true,
            font,
          })
        );
      } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
        const content = token.slice(1, -1).trim();
        runs.push(
          new docx.TextRun({
            ...baseOptions,
            text: content,
            italics: true,
            font,
          })
        );
      } else {
        const clean = token.replace(/\*/g, '');
        if (clean) {
          runs.push(
            new docx.TextRun({
              ...baseOptions,
              text: clean,
              font,
            })
          );
        }
      }
    }

    return runs.length > 0 ? runs : [new docx.TextRun({ ...baseOptions, text: '', font })];
  };

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

    // Organisation Logos / Main Logo
    const coverLogo =
      cover.headerLogos?.leftBase64 ||
      cover.headerLogos?.centerBase64 ||
      cover.headerLogos?.rightBase64 ||
      cover.logoBase64 ||
      model.organisation.logoBase64;
    if (coverLogo) {
      try {
        const logoBytes = base64ToUint8Array(coverLogo);
        children.push(
          new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
            children: [
              new docx.ImageRun({
                data: logoBytes,
                transformation: { width: 130, height: 65 },
                type: coverLogo.includes('image/jpeg') || coverLogo.includes('image/jpg') ? 'jpg' : 'png',
              }),
            ],
          })
        );
      } catch {
        // ignore invalid logo bytes
      }
    }

    // Company / Lab Title
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.TITLE,
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: 180, after: 80 },
        children: [
          new docx.TextRun({
            text: cover.companyName,
            color: hexPrimary,
            bold: true,
            size: 36,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    const contactParts = [cover.address, cover.phone ? `Tél: ${cover.phone}` : '', cover.email].filter(Boolean);
    if (contactParts.length > 0) {
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new docx.TextRun({
              text: contactParts.join(' • '),
              color: '64748B',
              size: 18,
              font: 'Times New Roman',
            }),
          ],
        })
      );
    }

    if (cover.accreditationNumber) {
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new docx.TextRun({
              text: `Agrément / Accréditation N° : ${cover.accreditationNumber}`,
              color: '64748B',
              size: 18,
              bold: true,
              font: 'Times New Roman',
            }),
          ],
        })
      );
    }

    // Title Box (with responsive font sizing for long titles and WCAG contrast)
    const titleLen = cover.studyTitle.length;
    const wordTitleSize = titleLen > 90 ? 24 : titleLen > 50 ? 28 : 32;
    const titleTextColor = getContrastColor(hexPrimary);
    const subtitleColor = titleTextColor === 'FFFFFF' ? 'E2E8F0' : '334155';

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
                    alignment: docx.AlignmentType.CENTER,
                    children: [
                      new docx.TextRun({
                        text: cover.studyTitle.toUpperCase(),
                        bold: true,
                        color: titleTextColor,
                        size: wordTitleSize,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 80 },
                    children: [
                      new docx.TextRun({
                        text:
                          lang === 'fr'
                            ? "RAPPORT GÉOTECHNIQUE D'ÉTUDE DE SOLS ET MATÉRIAUX"
                            : 'GEOTECHNICAL MATERIALS INVESTIGATION STUDY',
                        color: subtitleColor,
                        size: 20,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 80 },
                    children: [
                      new docx.TextRun({
                        text: lang === 'fr' ? `Rapport N° : ${cover.reportNumber || 'N/A'}` : `Report No: ${cover.reportNumber || 'N/A'}`,
                        bold: true,
                        color: titleTextColor,
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
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
              children: [new docx.Paragraph({ children: [new docx.TextRun({ text: label, bold: true, size: 18, font: 'Times New Roman' })] })],
            }),
            new docx.TableCell({
              width: { size: 65, type: docx.WidthType.PERCENTAGE },
              children: [new docx.Paragraph({ children: [new docx.TextRun({ text: val, size: 18, font: 'Times New Roman' })] })],
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

    // Revision Table (with white text on dark primary header)
    const revisions = cover.revisions.length > 0
      ? cover.revisions
      : [{ index: 0, date: new Date().toISOString().split('T')[0], nature: 'Initial issue', preparedBy: '', checkedBy: '', approvedBy: '' }];

    const revHeaderTextColor = getContrastColor(hexPrimary);
    const makeHeaderCell = (label: string) =>
      new docx.TableCell({
        shading: { fill: hexPrimary },
        children: [
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: label,
                bold: true,
                color: revHeaderTextColor,
                size: 16,
                font: 'Times New Roman',
              }),
            ],
          }),
        ],
      });

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({
            children: [
              makeHeaderCell('Ind.'),
              makeHeaderCell('Date'),
              makeHeaderCell(lang === 'fr' ? 'Nature des modifications' : 'Nature of changes'),
              makeHeaderCell(lang === 'fr' ? 'Rédigé' : 'Prepared'),
              makeHeaderCell(lang === 'fr' ? 'Vérifié' : 'Checked'),
              makeHeaderCell(lang === 'fr' ? 'Approuvé' : 'Approved'),
            ],
          }),
          ...revisions.map((rev) =>
            new docx.TableRow({
              children: [
                new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(rev.index), size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.date || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.nature || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.preparedBy || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.checkedBy || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.approvedBy || '-', size: 16, font: 'Times New Roman' })] })] }),
              ],
            })
          ),
        ],
      })
    );

    // Cover Page Footer rule and FraGeo Lab branding
    children.push(
      new docx.Paragraph({
        spacing: { before: 240 },
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
            text: `${cover.companyName || 'FraGeo Suite'} • FraGeo Lab`,
            size: 14,
            color: '94A3B8',
          }),
          new docx.TextRun({
            text: `\t${cover.reportNumber || 'Study Report'}`,
            size: 14,
            color: '94A3B8',
          }),
        ],
        tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.convertMillimetersToTwip(174) }],
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

    // Heading for Section (analysisDetail handles its own Section 4 Heading 1 + Test Heading 2)
    if (block.type !== 'analysisDetail') {
      children.push(
        new docx.Paragraph({
          text: block.title,
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    }

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
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(
            new docx.Paragraph({
              bullet: { level: 0 },
              alignment: docx.AlignmentType.JUSTIFIED,
              spacing: { line: 360, lineRule: docx.LineRuleType.AUTO, after: 60 },
              children: parseMarkdownToRuns(line.replace(/^[-*]\s+/, ''), { font: 'Times New Roman' }),
            })
          );
        } else {
          children.push(
            new docx.Paragraph({
              alignment: docx.AlignmentType.JUSTIFIED,
              spacing: { line: 360, lineRule: docx.LineRuleType.AUTO, after: 120 },
              children: parseMarkdownToRuns(line, { font: 'Times New Roman' }),
            })
          );
        }
      }
    } else if (block.type === 'analysisSummaryTable' && block.summaryRows) {
      const sumHeaderTextColor = getContrastColor(hexPrimary);
      const makeSummaryHeaderCell = (label: string) =>
        new docx.TableCell({
          shading: { fill: hexPrimary },
          children: [
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: label,
                  bold: true,
                  color: sumHeaderTextColor,
                  size: 18,
                  font: 'Times New Roman',
                }),
              ],
            }),
          ],
        });

      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: [
                makeSummaryHeaderCell(lang === 'fr' ? 'Échantillon' : 'Sample'),
                makeSummaryHeaderCell(lang === 'fr' ? 'Type d’essai' : 'Test Type'),
                makeSummaryHeaderCell(lang === 'fr' ? 'Norme' : 'Standard'),
                makeSummaryHeaderCell('Date'),
                makeSummaryHeaderCell(lang === 'fr' ? 'Résultats clés' : 'Key Results'),
              ],
            }),
            ...block.summaryRows.map((r) =>
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.sampleId, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.testLabel, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.standard, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.testedDate, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.keyResultsText, font: 'Times New Roman' })] })] }),
                ],
              })
            ),
          ],
        })
      );
      // Skip a blank line after the table
      children.push(new docx.Paragraph({ spacing: { before: 240, after: 120 } }));
    } else if (block.type === 'analysisDetail' && block.detailData) {
      const d = block.detailData;

      // Section 4 Heading if this is the first analysis detail item
      if (d.sectionTitle) {
        children.push(
          new docx.Paragraph({
            text: d.sectionTitle,
            heading: docx.HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        );
      }

      // Test Subheading (Heading 2)
      children.push(
        new docx.Paragraph({
          text: block.title,
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
        })
      );

      // KPI Results Table
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({ shading: { fill: 'F1F5F9' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Paramètre' : 'Parameter', bold: true, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: 'F1F5F9' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Valeur calculée' : 'Computed Value', bold: true, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: 'F1F5F9' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'Unité', bold: true, font: 'Times New Roman' })] })] }),
              ],
            }),
            ...d.results.map((res) =>
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: res.label, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(res.value), bold: true, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: res.unit || '-', font: 'Times New Roman' })] })] }),
                ],
              })
            ),
          ],
        })
      );
      // Skip a blank line after the table
      children.push(new docx.Paragraph({ spacing: { before: 240, after: 120 } }));

      // Embedded Chart PNG
      if (d.chartType && d.analysis.computedResults) {
        try {
          const chartBytes = await renderTestChartPng(
            d.analysis.testType,
            d.analysis.rawInput,
            d.analysis.computedResults,
            lang,
            model.primaryColor
          );

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
        const obsParagraphs = d.observations.split(/\n+/).map((p) => p.trim()).filter(Boolean);
        for (let i = 0; i < obsParagraphs.length; i++) {
          const paraText = obsParagraphs[i];
          const isHeading =
            paraText.startsWith('**') &&
            paraText.endsWith('**') &&
            paraText.length > 4 &&
            !paraText.slice(2, -2).includes('**');

          if (isHeading) {
            children.push(
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: paraText.slice(2, -2).trim(),
                    bold: true,
                    size: 20,
                    color: '1E293B',
                    font: 'Times New Roman',
                  }),
                ],
                spacing: { before: 140, after: 60 },
              })
            );
          } else {
            const isFirst = i === 0;
            const prefixRuns = isFirst
              ? [
                  new docx.TextRun({
                    text: 'Observations : ',
                    bold: true,
                    color: '475569',
                    font: 'Times New Roman',
                  }),
                ]
              : [];
            const bodyRuns = parseMarkdownToRuns(paraText, {
              italics: true,
              color: '475569',
              font: 'Times New Roman',
            });
            children.push(
              new docx.Paragraph({
                alignment: docx.AlignmentType.JUSTIFIED,
                spacing: { line: 360, lineRule: docx.LineRuleType.AUTO, before: 60, after: 100 },
                children: [...prefixRuns, ...bodyRuns],
              })
            );
          }
        }
      }
    } else if (block.type === 'gradingCurves' && block.gradingCurvesData) {
      if (block.gradingCurvesData.analyses.length === 0) {
        children.push(
          new docx.Paragraph({
            alignment: docx.AlignmentType.JUSTIFIED,
            spacing: { before: 120, after: 180 },
            children: [
              new docx.TextRun({
                text: lang === 'fr'
                  ? "Aucun essai d'analyse granulométrique par tamisage (NF P94-056 / NF EN 933-1) n'a été inclus dans le programme d'investigation de la présente étude."
                  : "No particle size distribution test by sieving (NF P94-056 / NF EN 933-1) was included in the testing scope for this study.",
                font: 'Times New Roman',
                italics: true,
                color: '64748B',
                size: 20,
              }),
            ],
          })
        );
      } else {
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
      }
    } else if (block.type === 'conformityTable' && block.conformityRows) {
      if (block.conformityRows.length === 0) {
        children.push(
          new docx.Paragraph({
            alignment: docx.AlignmentType.JUSTIFIED,
            spacing: { before: 120, after: 180 },
            children: [
              new docx.TextRun({
                text: lang === 'fr'
                  ? 'Aucune spécification technique de conformité définie pour ce projet.'
                  : 'No technical conformity specifications defined for this project.',
                font: 'Times New Roman',
                italics: true,
                color: '64748B',
                size: 20,
              }),
            ],
          })
        );
      } else {
        const confHeaderTextColor = getContrastColor(hexPrimary);
        const makeConfHeaderCell = (label: string) =>
          new docx.TableCell({
            shading: { fill: hexPrimary },
            children: [
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: label,
                    bold: true,
                    color: confHeaderTextColor,
                    size: 18,
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          });

        children.push(
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              new docx.TableRow({
                children: [
                  makeConfHeaderCell(lang === 'fr' ? 'Échantillon' : 'Sample'),
                  makeConfHeaderCell(lang === 'fr' ? 'Paramètre' : 'Parameter'),
                  makeConfHeaderCell(lang === 'fr' ? 'Valeur mesurée' : 'Measured'),
                  makeConfHeaderCell(lang === 'fr' ? 'Spécification' : 'Specification'),
                  makeConfHeaderCell(lang === 'fr' ? 'Statut' : 'Status'),
                ],
              }),
              ...block.conformityRows.map((r) =>
                new docx.TableRow({
                  children: [
                    new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.sampleId, font: 'Times New Roman' })] })] }),
                    new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.parameter, font: 'Times New Roman' })] })] }),
                    new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(r.measured), font: 'Times New Roman' })] })] }),
                    new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: r.specification, font: 'Times New Roman' })] })] }),
                    new docx.TableCell({
                      shading: { fill: r.status === 'conform' ? 'DCFCE7' : 'FEE2E2' },
                      children: [
                        new docx.Paragraph({
                          children: [
                            new docx.TextRun({
                              text: r.status === 'conform' ? (lang === 'fr' ? 'CONFORME' : 'CONFORMING') : (lang === 'fr' ? 'NON CONFORME' : 'NON-CONFORMING'),
                              bold: true,
                              color: r.status === 'conform' ? '15803D' : 'B91C1C',
                              font: 'Times New Roman',
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                })
              ),
            ],
          })
        );
        // Skip a blank line after the table
        children.push(new docx.Paragraph({ spacing: { before: 240, after: 120 } }));
      }
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
                      alignment: docx.AlignmentType.JUSTIFIED,
                      spacing: { line: 360, lineRule: docx.LineRuleType.AUTO },
                      children: [
                        new docx.TextRun({
                          text: block.usageNoteText[lang] || block.usageNoteText.en,
                          color: '713F12',
                          size: 18,
                          font: 'Times New Roman',
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
      // Skip a blank line after the note
      children.push(new docx.Paragraph({ spacing: { before: 240, after: 120 } }));
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
                    new docx.Paragraph({ children: [new docx.TextRun({ text: sig.roleLabel?.[lang] || sig.title || `Visa ${idx + 1}`, bold: true, color: hexPrimary, size: 16, font: 'Times New Roman' })] }),
                    new docx.Paragraph({ children: [new docx.TextRun({ text: sig.name || '', bold: true, size: 16, font: 'Times New Roman' })], spacing: { before: 80 } }),
                    new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? '[Signature manuscrite]' : '[Handwritten Signature]', color: '94A3B8', size: 14, font: 'Times New Roman' })], spacing: { before: 180 } }),
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
              cellChildren.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '[Photo]', font: 'Times New Roman' })] }));
            }
          } else {
            cellChildren.push(new docx.Paragraph({ children: [new docx.TextRun({ text: '[Photo]', font: 'Times New Roman' })] }));
          }

          cellChildren.push(
            new docx.Paragraph({
              alignment: docx.AlignmentType.CENTER,
              spacing: { before: 60 },
              children: [
                new docx.TextRun({
                  text: p.caption || '',
                  size: 16,
                  color: '64748B',
                  font: 'Times New Roman',
                }),
              ],
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
            text: lang === 'fr' ? `Procès-Verbal : ${a.reportNumber} (${a.testType})` : `Test Certificate: ${a.reportNumber} (${a.testType})`,
            heading: docx.HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 80 },
          }),
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Réf. Rapport' : 'Report Ref.', bold: true, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: a.reportNumber, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Norme' : 'Standard', bold: true, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: a.standard, font: 'Times New Roman' })] })] }),
                ],
              }),
              new docx.TableRow({
                children: [
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Statut' : 'Status', bold: true, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: a.status.toUpperCase(), bold: true, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: 'F8FAFC' }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Date essai' : 'Test Date', bold: true, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: a.testedDate || a.createdAt, font: 'Times New Roman' })] })] }),
                ],
              }),
            ],
          })
        );
      }
    } else if (block.type === 'dataQualityNotes' && block.dataQualityNotesText) {
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.JUSTIFIED,
          spacing: { line: 360, lineRule: docx.LineRuleType.AUTO, after: 120 },
          children: [
            new docx.TextRun({
              text: block.dataQualityNotesText,
              color: '334155',
              size: 18,
              font: 'Times New Roman',
            }),
          ],
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
            font: 'Times New Roman',
            size: 20, // 10pt
            color: '0F172A',
          },
          paragraph: {
            alignment: docx.AlignmentType.JUSTIFIED,
            spacing: { line: 360, lineRule: docx.LineRuleType.AUTO },
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
            font: 'Times New Roman',
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
            font: 'Times New Roman',
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
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: `\t${model.study.title}`,
                    size: 16,
                    color: '64748B',
                    font: 'Times New Roman',
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
                    text: `${model.project.projectName} • ${model.study.reportNumber || model.study.title}${model.isSampleDocument ? ' • SAMPLE - fictional data' : ''} • FraGeo Lab`,
                    size: 16,
                    color: '94A3B8',
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: '\tPage ',
                    size: 16,
                    color: '94A3B8',
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    children: [docx.PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: ' / ',
                    size: 16,
                    color: '94A3B8',
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    children: [docx.PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '94A3B8',
                    font: 'Times New Roman',
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
