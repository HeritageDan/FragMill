/**
 * Word (.docx) Individual Test Report Generator for FraGeo Lab.
 * Produces structured, fully editable A4 documents with Times New Roman typography,
 * 1.5 line spacing, justified narrative text, native tables, embedded PNG charts,
 * organization logos, and formal approval signatories.
 */

import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
  AnalysisRevision,
} from '../../types/geolab';
import type { GeoLabTestDefinition } from '../tests/types';
import { isTestWithGraph, renderTestChartPng } from '../studies/engine/chartRenderer';

export interface GeoLabDocxOptions {
  analysis: GeoLabAnalysis;
  client: GeoLabClient;
  project: GeoLabProject;
  sample: GeoLabSample;
  orgProfile: OrganisationProfile;
  testDef: GeoLabTestDefinition;
  language: 'en' | 'fr';
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
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
}

export async function generateGeoLabDocxReport(options: GeoLabDocxOptions): Promise<Blob> {
  const { analysis, client, project, sample, orgProfile, testDef, language } = options;
  const lang = language;
  const hexPrimary = (orgProfile.primaryColor || '#1e40af').replace('#', '');

  // Lazy load docx
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
        runs.push(
          new docx.TextRun({
            ...baseOptions,
            text: token,
            font,
          })
        );
      }
    }
    return runs;
  };

  const children: any[] = [];

  // -------------------------------------------------------------
  // 1. Organization Header & Authority Card
  // -------------------------------------------------------------
  const logoBase64 =
    orgProfile.headerLogos?.leftBase64 ||
    orgProfile.headerLogos?.centerBase64 ||
    orgProfile.headerLogos?.rightBase64 ||
    orgProfile.logoBase64;

  if (logoBase64) {
    try {
      const logoBytes = base64ToUint8Array(logoBase64);
      children.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          spacing: { before: 80, after: 120 },
          children: [
            new docx.ImageRun({
              data: logoBytes,
              transformation: { width: 120, height: 60 },
              type: logoBase64.includes('image/jpeg') || logoBase64.includes('image/jpg') ? 'jpg' : 'png',
            }),
          ],
        })
      );
    } catch {
      // ignore logo errors
    }
  }

  children.push(
    new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [
        new docx.TextRun({
          text: orgProfile.companyName || 'Laboratoire d’Essais Géotechniques',
          bold: true,
          color: hexPrimary,
          size: 26,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  const contactItems = [
    orgProfile.address,
    orgProfile.phone ? `Tél: ${orgProfile.phone}` : '',
    orgProfile.email,
  ].filter(Boolean);

  if (contactItems.length > 0) {
    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new docx.TextRun({
            text: contactItems.join(' • '),
            color: '64748B',
            size: 18,
            font: 'Times New Roman',
          }),
        ],
      })
    );
  }

  if (orgProfile.accreditationNumber) {
    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new docx.TextRun({
            text: `Agrément / Accréditation N° : ${orgProfile.accreditationNumber}`,
            bold: true,
            color: '475569',
            size: 18,
            font: 'Times New Roman',
          }),
        ],
      })
    );
  }

  // -------------------------------------------------------------
  // 2. Report Title Banner (Primary Color Background, White Text)
  // -------------------------------------------------------------
  const titleTextColor = getContrastColor(hexPrimary);
  const testTitleText = `${lang === 'fr' ? 'PROCÈS-VERBAL D’ESSAI' : 'TEST REPORT'} : ${testDef.name[lang].toUpperCase()}`;
  const statusLabel =
    analysis.status === 'approved'
      ? lang === 'fr' ? 'APPROUVÉ / CERTIFIÉ' : 'APPROVED'
      : analysis.status === 'checked'
      ? lang === 'fr' ? 'VÉRIFIÉ' : 'CHECKED'
      : lang === 'fr' ? 'BROUILLON' : 'DRAFT';

  children.push(
    new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: [
        new docx.TableRow({
          children: [
            new docx.TableCell({
              shading: { fill: hexPrimary },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
              children: [
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  children: [
                    new docx.TextRun({
                      text: testTitleText,
                      bold: true,
                      color: titleTextColor,
                      size: 24,
                      font: 'Times New Roman',
                    }),
                  ],
                }),
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  spacing: { before: 60 },
                  children: [
                    new docx.TextRun({
                      text: `${analysis.standard} • ${lang === 'fr' ? 'Rapport N°' : 'Report No'}: ${analysis.reportNumber} (v${analysis.version}) • Statut: ${statusLabel}`,
                      color: titleTextColor === 'FFFFFF' ? 'E2E8F0' : '334155',
                      size: 19,
                      bold: true,
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

  // Skip a blank line after banner
  children.push(new docx.Paragraph({ spacing: { before: 180, after: 120 } }));

  // -------------------------------------------------------------
  // 3. Project, Client & Sample Context Table
  // -------------------------------------------------------------
  children.push(
    new docx.Paragraph({
      heading: docx.HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 80 },
      children: [
        new docx.TextRun({
          text: lang === 'fr' ? 'IDENTIFICATION DU PROJET & DE L’ÉCHANTILLON' : 'PROJECT & SAMPLE IDENTIFICATION',
          bold: true,
          color: hexPrimary,
          size: 22,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  const contextRows = [
    [
      { label: lang === 'fr' ? 'Client' : 'Client', val: client.companyName },
      { label: lang === 'fr' ? 'Projet' : 'Project', val: project.projectName },
    ],
    [
      { label: lang === 'fr' ? 'Site / Localisation' : 'Site Location', val: project.siteLocation },
      { label: lang === 'fr' ? 'Date prélèvement' : 'Sampling Date', val: sample.samplingDate },
    ],
    [
      { label: lang === 'fr' ? 'Échantillon' : 'Sample ID', val: `${sample.sampleId} ${sample.depth ? `(${sample.depth})` : ''}` },
      { label: lang === 'fr' ? 'Prélevé par' : 'Sampled by', val: sample.sampler || '-' },
    ],
    [
      { label: lang === 'fr' ? 'Nature matériau' : 'Material Type', val: sample.materialType || 'Matériau granulaire' },
      { label: lang === 'fr' ? 'Date essai' : 'Test Date', val: analysis.testedDate },
    ],
  ];

  if (project.contractNumber || project.lotSection) {
    contextRows.push([
      { label: lang === 'fr' ? 'Marché / Lot' : 'Contract / Lot', val: `${project.contractNumber || '-'} ${project.lotSection ? `(${project.lotSection})` : ''}` },
      { label: lang === 'fr' ? 'Financement' : 'Financing', val: project.financingText || '-' },
    ]);
  }

  children.push(
    new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: contextRows.map((row) =>
        new docx.TableRow({
          children: [
            new docx.TableCell({
              width: { size: 22, type: docx.WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[0].label, bold: true, size: 18, color: '475569', font: 'Times New Roman' })] })],
            }),
            new docx.TableCell({
              width: { size: 28, type: docx.WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[0].val || '-', size: 18, font: 'Times New Roman' })] })],
            }),
            new docx.TableCell({
              width: { size: 22, type: docx.WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[1].label, bold: true, size: 18, color: '475569', font: 'Times New Roman' })] })],
            }),
            new docx.TableCell({
              width: { size: 28, type: docx.WidthType.PERCENTAGE },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[1].val || '-', size: 18, font: 'Times New Roman' })] })],
            }),
          ],
        })
      ),
    })
  );

  // Skip a blank line after the table before starting next section
  children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

  // -------------------------------------------------------------
  // 4. Computed Test Results (Key Results KPI Table)
  // -------------------------------------------------------------
  const keyResults = testDef.keyResults ? testDef.keyResults(analysis.computedResults, lang) : [];
  if (keyResults.length > 0) {
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 80 },
        children: [
          new docx.TextRun({
            text: lang === 'fr' ? 'RÉSULTATS CARACTÉRISTIQUES DE L’ESSAI' : 'CHARACTERISTIC TEST RESULTS',
            bold: true,
            color: hexPrimary,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({
                width: { size: 50, type: docx.WidthType.PERCENTAGE },
                shading: { fill: hexPrimary },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Grandeur mesurée / Paramètre' : 'Measured Property / Parameter', bold: true, color: titleTextColor, size: 18, font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 30, type: docx.WidthType.PERCENTAGE },
                shading: { fill: hexPrimary },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Valeur obtenue' : 'Computed Value', bold: true, color: titleTextColor, size: 18, font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 20, type: docx.WidthType.PERCENTAGE },
                shading: { fill: hexPrimary },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Unité' : 'Unit', bold: true, color: titleTextColor, size: 18, font: 'Times New Roman' })] })],
              }),
            ],
          }),
          ...keyResults.map((kr: { label: string; value: any; unit?: string }, idx: number) =>
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                  margins: { top: 80, bottom: 80, left: 140, right: 140 },
                  children: [new docx.Paragraph({ children: [new docx.TextRun({ text: kr.label, size: 18, font: 'Times New Roman' })] })],
                }),
                new docx.TableCell({
                  shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                  margins: { top: 80, bottom: 80, left: 140, right: 140 },
                  children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(kr.value), bold: true, size: 18, color: '0F172A', font: 'Times New Roman' })] })],
                }),
                new docx.TableCell({
                  shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                  margins: { top: 80, bottom: 80, left: 140, right: 140 },
                  children: [new docx.Paragraph({ children: [new docx.TextRun({ text: kr.unit || '-', size: 18, color: '64748B', font: 'Times New Roman' })] })],
                }),
              ],
            })
          ),
        ],
      })
    );

    // Skip a blank line after the table
    children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));
  }

  // -------------------------------------------------------------
  // 5. Test Parameters Box (if parameters exist)
  // -------------------------------------------------------------
  const params = testDef.inputSchema?.parameters || [];
  if (params.length > 0 && analysis.rawInput) {
    const paramItems: Array<{ label: string; value: string }> = [];
    params.forEach((p: any) => {
      const val = analysis.rawInput[p.key];
      if (val !== undefined && val !== null && val !== '') {
        paramItems.push({
          label: p.label[lang] || p.key,
          value: `${val}${p.unit ? ' ' + p.unit : ''}`,
        });
      }
    });

    if (paramItems.length > 0) {
      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_3,
          spacing: { before: 120, after: 60 },
          children: [
            new docx.TextRun({
              text: lang === 'fr' ? 'PARAMÈTRES INITIAUX D’ESSAI' : 'INITIAL TEST PARAMETERS',
              bold: true,
              color: '334155',
              size: 20,
              font: 'Times New Roman',
            }),
          ],
        })
      );

      const pRows: any[] = [];
      for (let i = 0; i < paramItems.length; i += 2) {
        const it1 = paramItems[i];
        const it2 = paramItems[i + 1];
        pRows.push(
          new docx.TableRow({
            children: [
              new docx.TableCell({
                width: { size: 30, type: docx.WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: it1.label, bold: true, size: 17, color: '475569', font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 20, type: docx.WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: it1.value, size: 17, font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 30, type: docx.WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: it2?.label || '', bold: true, size: 17, color: '475569', font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 20, type: docx.WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: it2?.value || '', size: 17, font: 'Times New Roman' })] })],
              }),
            ],
          })
        );
      }

      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: pRows,
        })
      );

      // Skip a blank line after the table
      children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));
    }
  }

  // -------------------------------------------------------------
  // 6. Raw Data Table (e.g. Sieves, Proctor points, Specimens)
  // -------------------------------------------------------------
  const tableDef = testDef.inputSchema?.table;
  const tableData = tableDef ? analysis.rawInput?.[tableDef.key] : null;
  if (tableDef && Array.isArray(tableData) && tableData.length > 0) {
    const cols = tableDef.columns || [];

    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 60 },
        children: [
          new docx.TextRun({
            text: lang === 'fr' ? 'DONNÉES BRUTES & RELEVÉS DE MESURES' : 'RAW EXPERIMENTAL TEST DATA',
            bold: true,
            color: '334155',
            size: 20,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    const colWidthPct = Math.round(100 / Math.max(1, cols.length));

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({
            children: cols.map(
              (c: any) =>
                new docx.TableCell({
                  width: { size: colWidthPct, type: docx.WidthType.PERCENTAGE },
                  shading: { fill: '1E293B' }, // Dark slate
                  margins: { top: 80, bottom: 80, left: 100, right: 100 },
                  children: [
                    new docx.Paragraph({
                      alignment: docx.AlignmentType.CENTER,
                      children: [
                        new docx.TextRun({
                          text: c.label[lang] || c.key,
                          bold: true,
                          color: 'FFFFFF',
                          size: 16,
                          font: 'Times New Roman',
                        }),
                      ],
                    }),
                  ],
                })
            ),
          }),
          ...tableData.map(
            (row, rIdx) =>
              new docx.TableRow({
                children: cols.map((c: any) => {
                  const val = row[c.key];
                  const valStr = val !== undefined && val !== null ? String(val) : '-';
                  return new docx.TableCell({
                    width: { size: colWidthPct, type: docx.WidthType.PERCENTAGE },
                    shading: { fill: rIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                    children: [
                      new docx.Paragraph({
                        alignment: docx.AlignmentType.CENTER,
                        children: [
                          new docx.TextRun({
                            text: valStr,
                            size: 16,
                            font: 'Times New Roman',
                          }),
                        ],
                      }),
                    ],
                  });
                }),
              })
          ),
        ],
      })
    );

    // Skip a blank line after the table
    children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));
  }

  // -------------------------------------------------------------
  // 7. Embedded Test Chart (PNG Graphics)
  // -------------------------------------------------------------
  if (isTestWithGraph(analysis.testType) && analysis.computedResults) {
    try {
      const chartBytes = await renderTestChartPng(
        analysis.testType,
        analysis.rawInput,
        analysis.computedResults,
        lang,
        orgProfile.primaryColor || '#1e40af'
      );

      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 80 },
          children: [
            new docx.TextRun({
              text: lang === 'fr' ? 'GRAPHIQUE D’ESSAI & COURBE CARACTÉRISTIQUE' : 'TEST CHART & CHARACTERISTIC CURVE',
              bold: true,
              color: hexPrimary,
              size: 20,
              font: 'Times New Roman',
            }),
          ],
        })
      );

      children.push(
        new docx.Paragraph({
          spacing: { before: 100, after: 160 },
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
      // Graceful fallback if chart rendering fails
    }
  }

  // -------------------------------------------------------------
  // 8. Observations & Engineering Interpretation
  // -------------------------------------------------------------
  const observationsText = analysis.observations || analysis.aiNarrative || '';
  if (observationsText.trim().length > 0) {
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
        children: [
          new docx.TextRun({
            text: lang === 'fr' ? 'OBSERVATIONS & INTERPRÉTATION GÉOTECHNIQUE' : 'GEOTECHNICAL OBSERVATIONS & INTERPRETATION',
            bold: true,
            color: hexPrimary,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    const paragraphs = observationsText.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((pText) => {
      const isHeading =
        pText.startsWith('**') &&
        pText.endsWith('**') &&
        pText.length > 4 &&
        !pText.includes('\n');

      const isDisclaimer =
        pText.startsWith('[AI-drafted') ||
        pText.startsWith('[Rédigé par IA') ||
        pText.startsWith('[Observations');

      if (isHeading) {
        const cleanHeading = pText.slice(2, -2).trim();
        children.push(
          new docx.Paragraph({
            spacing: { before: 160, after: 60 },
            children: [
              new docx.TextRun({
                text: cleanHeading,
                bold: true,
                size: 20,
                color: '1E293B',
                font: 'Times New Roman',
              }),
            ],
          })
        );
      } else if (isDisclaimer) {
        children.push(
          new docx.Paragraph({
            spacing: { before: 60, after: 100 },
            children: [
              new docx.TextRun({
                text: pText,
                italics: true,
                color: '64748B',
                size: 16,
                font: 'Times New Roman',
              }),
            ],
          })
        );
      } else {
        const runs = parseMarkdownToRuns(pText, { size: 19, font: 'Times New Roman' });
        children.push(
          new docx.Paragraph({
            alignment: docx.AlignmentType.JUSTIFIED,
            spacing: { line: 360, lineRule: docx.LineRuleType.AUTO, after: 120 },
            children: runs,
          })
        );
      }
    });

    // Skip a blank line after observations
    children.push(new docx.Paragraph({ spacing: { before: 120, after: 120 } }));
  }

  // -------------------------------------------------------------
  // 9. Revision History Table
  // -------------------------------------------------------------
  const revs: AnalysisRevision[] =
    analysis.revisionHistory && analysis.revisionHistory.length > 0
      ? analysis.revisionHistory
      : [
          {
            index: analysis.version || 1,
            date: analysis.testedDate,
            natureOfChange: lang === 'fr' ? 'Émission initiale du rapport d’essai' : 'Initial test report issue',
            preparedBy: analysis.preparedBy?.name || 'Technicien Labo',
            checkedBy: analysis.checkedBy?.name || 'Responsable Qualité',
            approvedBy: analysis.approvedBy?.name || 'Directeur Technique',
          },
        ];

  children.push(
    new docx.Paragraph({
      heading: docx.HeadingLevel.HEADING_3,
      spacing: { before: 140, after: 60 },
      children: [
        new docx.TextRun({
          text: lang === 'fr' ? 'HISTORIQUE DES RÉVISIONS' : 'REVISION HISTORY',
          bold: true,
          color: hexPrimary,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  children.push(
    new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: [
        new docx.TableRow({
          children: [
            new docx.TableCell({ width: { size: 8, type: docx.WidthType.PERCENTAGE }, shading: { fill: 'F1F5F9' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: lang === 'fr' ? 'Rév.' : 'Rev', bold: true, size: 16, font: 'Times New Roman' })] })] }),
            new docx.TableCell({ width: { size: 15, type: docx.WidthType.PERCENTAGE }, shading: { fill: 'F1F5F9' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: 'Date', bold: true, size: 16, font: 'Times New Roman' })] })] }),
            new docx.TableCell({ width: { size: 35, type: docx.WidthType.PERCENTAGE }, shading: { fill: 'F1F5F9' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Nature de la modification' : 'Nature of Change', bold: true, size: 16, font: 'Times New Roman' })] })] }),
            new docx.TableCell({ width: { size: 14, type: docx.WidthType.PERCENTAGE }, shading: { fill: 'F1F5F9' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Établi par' : 'Prepared', bold: true, size: 16, font: 'Times New Roman' })] })] }),
            new docx.TableCell({ width: { size: 14, type: docx.WidthType.PERCENTAGE }, shading: { fill: 'F1F5F9' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Vérifié par' : 'Checked', bold: true, size: 16, font: 'Times New Roman' })] })] }),
            new docx.TableCell({ width: { size: 14, type: docx.WidthType.PERCENTAGE }, shading: { fill: 'F1F5F9' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: lang === 'fr' ? 'Approuvé par' : 'Approved', bold: true, size: 16, font: 'Times New Roman' })] })] }),
          ],
        }),
        ...revs.map(
          (rev) =>
            new docx.TableRow({
              children: [
                new docx.TableCell({ margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: String(rev.index ?? rev.revNumber ?? 0), size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [new docx.TextRun({ text: rev.date || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.natureOfChange || rev.description || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.preparedBy || rev.author || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.checkedBy || '-', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: rev.approvedBy || '-', size: 16, font: 'Times New Roman' })] })] }),
              ],
            })
        ),
      ],
    })
  );

  // Skip a blank line after the table
  children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

  // -------------------------------------------------------------
  // 10. Approval Chain & Signatures Table
  // -------------------------------------------------------------
  const signatories = [
    {
      role: lang === 'fr' ? 'Établi par (Technicien)' : 'Prepared by (Technician)',
      name: analysis.preparedBy?.name || orgProfile.signatories?.[0]?.name || 'Technicien Géotechnique',
      title: analysis.preparedBy?.title || orgProfile.signatories?.[0]?.title || 'Technicien de laboratoire',
    },
    {
      role: lang === 'fr' ? 'Vérifié par (Qualité)' : 'Checked by (QA Lead)',
      name: analysis.checkedBy?.name || orgProfile.signatories?.[1]?.name || 'Responsable Qualité',
      title: analysis.checkedBy?.title || orgProfile.signatories?.[1]?.title || 'Ingénieur Qualité',
    },
    {
      role: lang === 'fr' ? 'Approuvé par (Directeur)' : 'Approved by (Technical Director)',
      name: analysis.approvedBy?.name || orgProfile.signatories?.[2]?.name || 'Directeur Technique',
      title: analysis.approvedBy?.title || orgProfile.signatories?.[2]?.title || 'Directeur du Laboratoire',
    },
  ];

  children.push(
    new docx.Paragraph({
      heading: docx.HeadingLevel.HEADING_3,
      spacing: { before: 140, after: 60 },
      children: [
        new docx.TextRun({
          text: lang === 'fr' ? 'VISAS & APPROBATIONS TECHNIQUES' : 'APPROVAL VISAS & SIGNATORIES',
          bold: true,
          color: hexPrimary,
          size: 20,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  children.push(
    new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: [
        new docx.TableRow({
          children: signatories.map(
            (sig) =>
              new docx.TableCell({
                width: { size: 33, type: docx.WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                margins: { top: 120, bottom: 120, left: 140, right: 140 },
                children: [
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    children: [
                      new docx.TextRun({
                        text: sig.role,
                        bold: true,
                        size: 17,
                        color: hexPrimary,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 80 },
                    children: [
                      new docx.TextRun({
                        text: sig.name,
                        bold: true,
                        size: 19,
                        color: '0F172A',
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    children: [
                      new docx.TextRun({
                        text: sig.title,
                        size: 16,
                        color: '64748B',
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    spacing: { before: 140 },
                    children: [
                      new docx.TextRun({
                        text: `Date : ${analysis.testedDate}`,
                        size: 15,
                        color: '94A3B8',
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                  new docx.Paragraph({
                    alignment: docx.AlignmentType.CENTER,
                    children: [
                      new docx.TextRun({
                        text: `[Signature & Visa ${analysis.status === 'approved' ? 'Validé' : 'En attente'}]`,
                        italics: true,
                        size: 14,
                        color: analysis.status === 'approved' ? '10B981' : '94A3B8',
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                ],
              })
          ),
        }),
      ],
    })
  );

  // -------------------------------------------------------------
  // Construct Word Document
  // -------------------------------------------------------------
  const doc = new docx.Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 20,
            color: '0F172A',
          },
          paragraph: {
            alignment: docx.AlignmentType.JUSTIFIED,
            spacing: { line: 360, lineRule: docx.LineRuleType.AUTO },
          },
        },
      },
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
                    text: `${analysis.reportNumber} • ${testDef.name[lang].toUpperCase()} (${analysis.standard})`,
                    color: '94A3B8',
                    size: 16,
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: `\t${project.projectName} | ${sample.sampleId}`,
                    color: '94A3B8',
                    size: 16,
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
                    style: docx.BorderStyle.SINGLE,
                    size: 4,
                    color: 'CBD5E1',
                    space: 4,
                  },
                },
                spacing: { before: 60 },
                children: [
                  new docx.TextRun({
                    text: orgProfile.reportFooterText || 'Laboratoire d’Essais Géotechniques Agréé • Document officiel certifié',
                    color: '94A3B8',
                    size: 16,
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: '\tPage ',
                    color: '94A3B8',
                    size: 16,
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    children: [docx.PageNumber.CURRENT],
                    color: '94A3B8',
                    size: 16,
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: ' / ',
                    color: '94A3B8',
                    size: 16,
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    children: [docx.PageNumber.TOTAL_PAGES],
                    color: '94A3B8',
                    size: 16,
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

  return await docx.Packer.toBlob(doc);
}
