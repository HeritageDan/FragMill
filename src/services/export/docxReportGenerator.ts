/**
 * Word (.docx) Modular Blast Engineering Report Generator for FraGeo FragMill.
 * Produces structured, fully editable A4 documents with Times New Roman typography,
 * 1.5 line spacing, justified narrative text, native tables, embedded high-res PNG charts,
 * organization logos, and formal approval signatories.
 */

import type { Blast, Project, Site, ImageRecord, SegmentationRun } from '../../types';
import type { Language } from '../../i18n';
import { REPORT_SECTIONS_REGISTRY, type ReportSectionKey, type ReportVaultState } from '../../types/reportVault';
import { getBlastState } from '../blastState';
import { getOrganisationProfile } from '../../db';
import type { OrganisationProfile } from '../../types/geolab';
import { generateFullDynamicBlastEvaluationText } from './blastScenarioDiagnostics';
import {
  renderLogarithmicPassingChart,
  renderComputerVisionPipelineGallery,
  renderDrone3DMuckpileGraphic,
  renderConveyorBeltGraphic,
  renderBlastTimingGraphic,
  renderComminutionCircuitGraphic,
  renderBenchMapGraphic,
  renderMineToMillGraphic,
} from './reportGraphics';
import { generateDemoDroneSurvey } from '../drone3d/droneSizing';
import { computeSieveDistribution } from '../validation';

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

export async function generateModularVaultDocxReport(
  vaultState: ReportVaultState,
  project: Project,
  site: Site,
  blast: Blast,
  lang: Language = 'fr',
  selectedKeys?: ReportSectionKey[],
  orgProfileOverride?: OrganisationProfile
): Promise<Blob> {
  const isFr = lang === 'fr';

  let orgProfile: OrganisationProfile;
  if (orgProfileOverride) {
    orgProfile = orgProfileOverride;
  } else {
    try {
      orgProfile = await getOrganisationProfile();
    } catch {
      orgProfile = {
        companyName: 'FraGeo Suite Engineering & Mining Laboratory',
        address: 'Mining & Geotechnical Division',
        phone: '',
        email: '',
        accreditationNumber: '',
        primaryColor: '#1F3864',
        signatories: [],
        reportFooterText: '',
        defaultLanguage: 'fr',
        defaultStandard: 'NF',
      };
    }
  }

  const hexPrimary = (orgProfile.primaryColor || '#1F3864').replace('#', '');
  const blastState = getBlastState(blast);

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

  const allOrderedKeys = (Object.keys(REPORT_SECTIONS_REGISTRY) as ReportSectionKey[]).sort(
    (a, b) => REPORT_SECTIONS_REGISTRY[a].order - REPORT_SECTIONS_REGISTRY[b].order
  );

  const keysToRender = allOrderedKeys.filter((key) => {
    if (selectedKeys && selectedKeys.length > 0) {
      return selectedKeys.includes(key);
    }
    return true;
  });

  const children: any[] = [];

  // =============================================================
  // COVER PAGE
  // =============================================================
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
              transformation: { width: 130, height: 65 },
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
      spacing: { before: 80, after: 60 },
      children: [
        new docx.TextRun({
          text: orgProfile.companyName || 'FraGeo Suite Engineering & Mining Laboratory',
          bold: true,
          color: hexPrimary,
          size: 28,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  const contactParts = [orgProfile.address, orgProfile.phone ? `Tél: ${orgProfile.phone}` : '', orgProfile.email].filter(Boolean);
  if (contactParts.length > 0) {
    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        spacing: { after: 120 },
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

  // Cover Page Title Banner
  const titleTextColor = getContrastColor(hexPrimary);
  children.push(
    new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: [
        new docx.TableRow({
          children: [
            new docx.TableCell({
              shading: { fill: hexPrimary },
              margins: { top: 220, bottom: 220, left: 240, right: 240 },
              children: [
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  children: [
                    new docx.TextRun({
                      text: isFr
                        ? "RAPPORT D'INGÉNIERIE DE TIR D'ABATTAGE & FRAGMENTATION"
                        : 'BLAST ENGINEERING & ROCK FRAGMENTATION REPORT',
                      bold: true,
                      color: titleTextColor,
                      size: 26,
                      font: 'Times New Roman',
                    }),
                  ],
                }),
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  spacing: { before: 80 },
                  children: [
                    new docx.TextRun({
                      text: isFr
                        ? `DOSSIER TECHNIQUE MULTI-MODULES • TIR RÉF : ${blast.blastId}`
                        : `MULTI-MODULE ENGINEERING DOSSIER • BLAST REF: ${blast.blastId}`,
                      bold: true,
                      color: titleTextColor === 'FFFFFF' ? 'E2E8F0' : '334155',
                      size: 20,
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

  // Blank line after banner
  children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

  // Cover Project Metadata Table
  const metaRows = [
    [
      { label: isFr ? 'Projet' : 'Project', val: project.name },
      { label: isFr ? 'Mine / Exploitation' : 'Site / Mine', val: site.name },
    ],
    [
      { label: isFr ? 'Identifiant Tir' : 'Blast ID', val: blast.blastId },
      { label: isFr ? 'Date & Heure' : 'Date & Time', val: blast.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16) },
    ],
    [
      { label: isFr ? 'Banc / Niveau RL' : 'Bench / RL Elevation', val: `${blast.benchElevation ?? 'N/A'} m RL` },
      { label: isFr ? 'Conditions Météo' : 'Weather', val: blast.weather || (isFr ? 'Dégagé / Sec' : 'Clear / Dry') },
    ],
    [
      { label: isFr ? 'Maille (B x E)' : 'Pattern (B x S)', val: `${blastState.geometry.burden} m x ${blastState.geometry.spacing} m` },
      { label: isFr ? 'Volume Abattu' : 'Blasted Volume', val: `${(blastState.geometry.totalBlastedVolumeM3 ?? 0).toLocaleString()} m³ (${((blastState.geometry.totalBlastedVolumeM3 ?? 0) * 2.7).toLocaleString()} t)` },
    ],
  ];

  children.push(
    new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      rows: metaRows.map((row) =>
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

  // Blank line after table
  children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

  // Cover Page Signatories Box
  const blastSignatories = [
    {
      role: isFr ? 'Ingénieur de Tir (Auteur)' : 'Blasting Engineer (Prepared)',
      name: orgProfile.signatories?.[0]?.name || 'Ingénieur Fragmentation & Tir',
      title: orgProfile.signatories?.[0]?.title || 'Ingénieur Mines & Carrières',
    },
    {
      role: isFr ? 'Contrôle Technique (Vérificateur)' : 'Senior Mining Engineer (Checked)',
      name: orgProfile.signatories?.[1]?.name || 'Responsable Études & Exploitation',
      title: orgProfile.signatories?.[1]?.title || 'Ingénieur Senior QA/QC',
    },
    {
      role: isFr ? 'Direction d’Exploitation (Approbateur)' : 'Mine / Quarry Manager (Approved)',
      name: orgProfile.signatories?.[2]?.name || 'Directeur des Opérations Minières',
      title: orgProfile.signatories?.[2]?.title || 'Directeur de la Mine',
    },
  ];

  children.push(
    new docx.Paragraph({
      heading: docx.HeadingLevel.HEADING_3,
      spacing: { before: 140, after: 60 },
      children: [
        new docx.TextRun({
          text: isFr ? 'VISAS & HOMOLOGATIONS TECHNIQUES' : 'TECHNICAL APPROVAL VISAS',
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
          children: blastSignatories.map((sig) =>
            new docx.TableCell({
              width: { size: 33, type: docx.WidthType.PERCENTAGE },
              shading: { fill: 'F8FAFC' },
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  children: [new docx.TextRun({ text: sig.role, bold: true, size: 17, color: hexPrimary, font: 'Times New Roman' })],
                }),
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  spacing: { before: 80 },
                  children: [new docx.TextRun({ text: sig.name, bold: true, size: 19, color: '0F172A', font: 'Times New Roman' })],
                }),
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  children: [new docx.TextRun({ text: sig.title, size: 16, color: '64748B', font: 'Times New Roman' })],
                }),
                new docx.Paragraph({
                  alignment: docx.AlignmentType.CENTER,
                  spacing: { before: 140 },
                  children: [new docx.TextRun({ text: `Date: ${blast.dateTime ? blast.dateTime.substring(0, 10) : new Date().toISOString().substring(0, 10)}`, size: 15, color: '94A3B8', font: 'Times New Roman' })],
                }),
              ],
            })
          ),
        }),
      ],
    })
  );

  // PAGE BREAK AFTER COVER PAGE
  children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));

  // =============================================================
  // SECTION: EXECUTIVE SUMMARY & DYNAMIC AI EVALUATION
  // =============================================================
  children.push(
    new docx.Paragraph({
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
      children: [
        new docx.TextRun({
          text: isFr ? 'SYNTHÈSE TECHNIQUE & ÉVALUATION DYNAMIQUE DU TIR' : 'EXECUTIVE SUMMARY & DYNAMIC BLAST EVALUATION',
          bold: true,
          color: hexPrimary,
          size: 24,
          font: 'Times New Roman',
        }),
      ],
    })
  );

  const evalNotes =
    blast.notes && blast.notes.trim().length > 0
      ? blast.notes
      : generateFullDynamicBlastEvaluationText(blast, blastState, isFr ? 'fr' : 'en');

  const evalParagraphs = evalNotes.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  evalParagraphs.forEach((pText) => {
    const isHeading =
      pText.startsWith('**') &&
      pText.endsWith('**') &&
      pText.length > 4 &&
      !pText.includes('\n');

    if (isHeading) {
      children.push(
        new docx.Paragraph({
          spacing: { before: 160, after: 60 },
          children: [
            new docx.TextRun({
              text: pText.slice(2, -2).trim(),
              bold: true,
              size: 20,
              color: '1E293B',
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

  // Skip a blank line after evaluation
  children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

  // =============================================================
  // SECTION 1: BLAST DESIGN, GEOMETRY, PHOTOGRAPHY & PSD
  // =============================================================
  if (keysToRender.includes('blast')) {
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 180, after: 80 },
        children: [
          new docx.TextRun({
            text: isFr
              ? '1. GÉOMÉTRIE DU TIR, PLAN DE CHARGEMENT & GRANULOMÉTRIE OPTIQUE'
              : '1. BLAST DESIGN, CHARGING PROFILE & OPTICAL FRAGMENTATION',
            bold: true,
            color: hexPrimary,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    // Geometric & Explosive Tables
    const geomRows = [
      [
        { label: isFr ? 'Banquette (B)' : 'Burden (B)', val: `${blastState.geometry.burden} m` },
        { label: isFr ? 'Espacement (S)' : 'Spacing (S)', val: `${blastState.geometry.spacing} m` },
      ],
      [
        { label: isFr ? 'Hauteur de gradin (H)' : 'Bench Height (H)', val: `${blastState.geometry.benchHeight} m` },
        { label: isFr ? 'Diamètre de trou (D)' : 'Hole Diameter (D)', val: `${blastState.geometry.holeDiameterMm} mm` },
      ],
      [
        { label: isFr ? 'Profondeur totale (L)' : 'Hole Depth (L)', val: `${blastState.geometry.holeDepth} m` },
        { label: isFr ? 'Sous-forage (J)' : 'Subdrill (J)', val: `${blastState.geometry.subdrill} m` },
      ],
      [
        { label: isFr ? 'Nombre de trous' : 'Number of Holes', val: `${blastState.geometry.numberOfHoles}` },
        { label: isFr ? 'Facteur d’énergie (q)' : 'Powder Factor (q)', val: `${blastState.explosive.powderFactorKgPerM3.toFixed(2)} kg/m³` },
      ],
      [
        { label: isFr ? 'Charge par trou' : 'Charge / Hole', val: `${blastState.explosive.chargePerHole} kg` },
        { label: isFr ? 'Bourrage (T)' : 'Stemming (T)', val: `${blastState.geometry.stemmingLength ?? 0} m (Ratio T/B: ${((blastState.geometry.stemmingLength ?? 0) / (blastState.geometry.burden || 1)).toFixed(2)})` },
      ],
    ];

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: geomRows.map((row) =>
          new docx.TableRow({
            children: [
              new docx.TableCell({
                width: { size: 25, type: docx.WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[0].label, bold: true, size: 17, color: '475569', font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 25, type: docx.WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[0].val, size: 17, font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 25, type: docx.WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[1].label, bold: true, size: 17, color: '475569', font: 'Times New Roman' })] })],
              }),
              new docx.TableCell({
                width: { size: 25, type: docx.WidthType.PERCENTAGE },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[1].val, size: 17, font: 'Times New Roman' })] })],
              }),
            ],
          })
        ),
      })
    );

    // Skip a blank line after the table
    children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

    // -------------------------------------------------------------
    // CRITICAL USER REQUIREMENT:
    // In case of combined blast composite (or multiple images),
    // JUST ONE single representative image is embedded in the report!
    // -------------------------------------------------------------
    const activeImg = blast.images?.[0];
    const activeRun = activeImg?.segmentationRuns?.[0];
    const muckpileImgDataUrl =
      activeRun?.stepPreviews?.overlay || activeImg?.dataUrl || blast.images?.[0]?.dataUrl;

    if (muckpileImgDataUrl && muckpileImgDataUrl.startsWith('data:image/')) {
      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 140, after: 80 },
          children: [
            new docx.TextRun({
              text: isFr
                ? "PHOTOGRAPHIE ÉCHELONNÉE DU TAS DE MINAGE & MASQUE DE SEGMENTATION"
                : 'CALIBRATED MUCKPILE PHOTOGRAPHY & SEGMENTATION OVERLAY',
              bold: true,
              color: hexPrimary,
              size: 22,
              font: 'Times New Roman',
            }),
          ],
        })
      );

      try {
        const muckpileBytes = base64ToUint8Array(muckpileImgDataUrl);
        children.push(
          new docx.Paragraph({
            spacing: { before: 80, after: 80 },
            alignment: docx.AlignmentType.CENTER,
            children: [
              new docx.ImageRun({
                data: muckpileBytes,
                transformation: { width: 520, height: 270 },
                type: muckpileImgDataUrl.includes('image/png') ? 'png' : 'jpg',
              }),
            ],
          })
        );
      } catch {
        // ignore image error
      }

      // Single image scale & composite reconciliation note
      const calibNote = blastState.optical.isMultiImageComposite
        ? isFr
          ? `SYNTHÈSE MULTI-PHOTOS DU TIR COMPOSITE : Cliché de référence représentant ${blastState.optical.analyzedImagesCount} zones du gradin réconciliées • ${blastState.optical.fragmentCount} roches fusionnées au total`
          : `COMPOSITE MULTI-PHOTO SIZING: Representative image from ${blastState.optical.analyzedImagesCount} pooled muckpile zones • ${blastState.optical.fragmentCount} total pooled rocks`
        : isFr
        ? `Étalonnage optique : ${activeImg?.calibration?.pxPerMm?.toFixed(3) || '0.400'} px/mm (${activeImg?.calibration?.realWorldDistanceMm || 500} mm) • ${blastState.optical.fragmentCount} roches détectées`
        : `Optical Scale: ${activeImg?.calibration?.pxPerMm?.toFixed(3) || '0.400'} px/mm (${activeImg?.calibration?.realWorldDistanceMm || 500} mm) • ${blastState.optical.fragmentCount} detected rocks`;

      children.push(
        new docx.Paragraph({
          spacing: { after: 160 },
          alignment: docx.AlignmentType.CENTER,
          children: [
            new docx.TextRun({
              text: calibNote,
              italics: true,
              color: '64748B',
              size: 16,
              font: 'Times New Roman',
            }),
          ],
        })
      );
    }

    // Key Percentiles KPI Table
    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_2,
        spacing: { before: 140, after: 80 },
        children: [
          new docx.TextRun({
            text: isFr
              ? 'PERCENTILES CLÉS DE FRAGMENTATION & DISTRIBUTION DE TAILLE'
              : 'KEY FRAGMENTATION PERCENTILES & SIZE DISTRIBUTION',
            bold: true,
            color: hexPrimary,
            size: 22,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    const kpiRows = [
      [
        { label: 'P10 (Passant 10%)', val: `${blastState.optical.p10Mm} mm` },
        { label: 'P20 (Passant 20%)', val: `${blastState.optical.p20Mm} mm` },
      ],
      [
        { label: 'P50 (Taille médiane)', val: `${blastState.optical.p50Mm} mm` },
        { label: 'P80 (Cible concassage)', val: `${blastState.optical.p80Mm} mm` },
      ],
      [
        { label: 'P90 (Blocs grossiers)', val: `${blastState.optical.p90Mm} mm` },
        { label: 'Pmax (Bloc maximal)', val: `${blastState.optical.topSizeMm} mm` },
      ],
      [
        { label: 'Indice d’uniformité (n)', val: `${blastState.optical.uniformityIndex.toFixed(2)}` },
        { label: isFr ? 'Fines (< 25 mm)' : 'Fines (< 25 mm)', val: `${blastState.optical.finesPercent.toFixed(1)} %` },
      ],
      [
        { label: isFr ? 'Gros Blocs (> 300 mm)' : 'Oversize (> 300 mm)', val: `${blastState.optical.oversizePercent.toFixed(1)} %` },
        { label: isFr ? 'Nombre total de fragments' : 'Total Fragment Count', val: `${blastState.optical.fragmentCount}` },
      ],
    ];

    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({
            children: [
              new docx.TableCell({ width: { size: 30, type: docx.WidthType.PERCENTAGE }, shading: { fill: hexPrimary }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Indicateur' : 'Metric', bold: true, color: titleTextColor, size: 17, font: 'Times New Roman' })] })] }),
              new docx.TableCell({ width: { size: 20, type: docx.WidthType.PERCENTAGE }, shading: { fill: hexPrimary }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Valeur' : 'Value', bold: true, color: titleTextColor, size: 17, font: 'Times New Roman' })] })] }),
              new docx.TableCell({ width: { size: 30, type: docx.WidthType.PERCENTAGE }, shading: { fill: hexPrimary }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Indicateur' : 'Metric', bold: true, color: titleTextColor, size: 17, font: 'Times New Roman' })] })] }),
              new docx.TableCell({ width: { size: 20, type: docx.WidthType.PERCENTAGE }, shading: { fill: hexPrimary }, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Valeur' : 'Value', bold: true, color: titleTextColor, size: 17, font: 'Times New Roman' })] })] }),
            ],
          }),
          ...kpiRows.map((row, idx) =>
            new docx.TableRow({
              children: [
                new docx.TableCell({ width: { size: 30, type: docx.WidthType.PERCENTAGE }, shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[0].label, size: 17, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ width: { size: 20, type: docx.WidthType.PERCENTAGE }, shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[0].val, bold: true, size: 17, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ width: { size: 30, type: docx.WidthType.PERCENTAGE }, shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[1].label, size: 17, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ width: { size: 20, type: docx.WidthType.PERCENTAGE }, shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: row[1].val, bold: true, size: 17, font: 'Times New Roman' })] })] }),
              ],
            })
          ),
        ],
      })
    );

    // Skip a blank line after the table
    children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));

    // Spatial Muckpile Multi-Photo Audit Table (if composite)
    if (blastState.optical.isMultiImageComposite && blastState.optical.perImageBreakdown) {
      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 60 },
          children: [
            new docx.TextRun({
              text: isFr
                ? 'RÉCONCILIATION SPATIALE MULTI-PHOTOS DU TAS DE MINAGE'
                : 'SPATIAL MUCKPILE MULTI-PHOTO SIZING AUDIT',
              bold: true,
              color: '334155',
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
                new docx.TableCell({ shading: { fill: '1E293B' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Cliché' : 'Photo', bold: true, color: 'FFFFFF', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: '1E293B' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Zone Gradin' : 'Bench Zone', bold: true, color: 'FFFFFF', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: '1E293B' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Nb Roches' : 'Count', bold: true, color: 'FFFFFF', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: '1E293B' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'P50 (mm)', bold: true, color: 'FFFFFF', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: '1E293B' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: 'P80 (mm)', bold: true, color: 'FFFFFF', size: 16, font: 'Times New Roman' })] })] }),
                new docx.TableCell({ shading: { fill: '1E293B' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: isFr ? 'Oversize' : 'Oversize', bold: true, color: 'FFFFFF', size: 16, font: 'Times New Roman' })] })] }),
              ],
            }),
            ...blastState.optical.perImageBreakdown.map((pb, idx) =>
              new docx.TableRow({
                children: [
                  new docx.TableCell({ shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: pb.filename, size: 16, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: pb.zone || (isFr ? 'Gradin' : 'Muckpile'), size: 16, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: `${pb.fragmentCount}`, size: 16, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: `${pb.p50Mm} mm`, size: 16, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: `${pb.p80Mm} mm`, size: 16, font: 'Times New Roman' })] })] }),
                  new docx.TableCell({ shading: { fill: idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' }, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: `${pb.oversizePercent}%`, size: 16, font: 'Times New Roman' })] })] }),
                ],
              })
            ),
          ],
        })
      );

      // Skip a blank line after the table
      children.push(new docx.Paragraph({ spacing: { before: 200, after: 120 } }));
    }

    // Embedded Particle Size Distribution Log Chart
    try {
      const logChartDataUrl = renderLogarithmicPassingChart({
        measuredPoints: blastState.optical.curve,
        kuzRamPoints: blastState.kuzRam.predictedCurve,
        swebrecPoints: blastState.optical.curve,
        p10: blastState.optical.p10Mm,
        p20: blastState.optical.p20Mm,
        p50: blastState.optical.p50Mm,
        p80: blastState.optical.p80Mm,
        p90: blastState.optical.p90Mm,
        lang: isFr ? 'fr' : 'en',
      });
      const logChartBytes = base64ToUint8Array(logChartDataUrl);

      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 80 },
          children: [
            new docx.TextRun({
              text: isFr
                ? 'COURBE GRANULOMÉTRIQUE CUMULATIVE MULTI-MODÈLES (ÉCHELLE LOGARITHMIQUE)'
                : 'MULTI-MODEL CUMULATIVE PARTICLE SIZE DISTRIBUTION (LOG SCALE)',
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
          spacing: { before: 80, after: 160 },
          alignment: docx.AlignmentType.CENTER,
          children: [
            new docx.ImageRun({
              data: logChartBytes,
              transformation: { width: 520, height: 260 },
              type: 'png',
            }),
          ],
        })
      );
    } catch {
      // ignore chart error
    }

    // Computer Vision Pipeline Gallery (8 Stages)
    try {
      const cvGalleryDataUrl = await renderComputerVisionPipelineGallery({
        originalDataUrl: activeImg?.dataUrl,
        stepPreviews: activeRun?.stepPreviews,
        lang: isFr ? 'fr' : 'en',
      });
      const cvGalleryBytes = base64ToUint8Array(cvGalleryDataUrl);

      children.push(
        new docx.Paragraph({
          heading: docx.HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 80 },
          children: [
            new docx.TextRun({
              text: isFr
                ? 'PIPELINE COMPLET DE TRAITEMENT PAR VISION ARTIFICIELLE (8 ÉTAPES)'
                : 'FULL COMPUTER VISION IMAGE PROCESSING PIPELINE (8 STAGES)',
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
          spacing: { before: 80, after: 160 },
          alignment: docx.AlignmentType.CENTER,
          children: [
            new docx.ImageRun({
              data: cvGalleryBytes,
              transformation: { width: 520, height: 260 },
              type: 'png',
            }),
          ],
        })
      );
    } catch {
      // ignore gallery error
    }
  }

  // =============================================================
  // ADDITIONAL STAGED SECTIONS (drone3d, beltvision, timing, etc.)
  // =============================================================
  for (const key of keysToRender) {
    if (key === 'blast') continue; // already rendered in Section 1

    const meta = REPORT_SECTIONS_REGISTRY[key];
    const sectionTitle = isFr ? meta.titleFr : meta.titleEn;
    const desc = isFr ? meta.descriptionFr : meta.descriptionEn;

    children.push(
      new docx.Paragraph({
        heading: docx.HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 80 },
        children: [
          new docx.TextRun({
            text: sectionTitle,
            bold: true,
            color: hexPrimary,
            size: 24,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    children.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.JUSTIFIED,
        spacing: { line: 360, lineRule: docx.LineRuleType.AUTO, after: 120 },
        children: [
          new docx.TextRun({
            text: desc,
            size: 19,
            font: 'Times New Roman',
          }),
        ],
      })
    );

    // Graphic for the section
    let sectionGraphicDataUrl: string | null = null;
    try {
      if (key === 'drone3d') {
        const droneSurvey = blast.droneSurvey || generateDemoDroneSurvey(blast.blastId);
        sectionGraphicDataUrl = renderDrone3DMuckpileGraphic(droneSurvey, isFr ? 'fr' : 'en');
      } else if (key === 'beltvision') {
        sectionGraphicDataUrl = renderConveyorBeltGraphic({
          lang: isFr ? 'fr' : 'en',
          p80Mm: blastState.optical.p80Mm,
          p50Mm: blastState.optical.p50Mm,
        });
      } else if (key === 'timing') {
        sectionGraphicDataUrl = renderBlastTimingGraphic(isFr ? 'fr' : 'en');
      } else if (key === 'comminution') {
        sectionGraphicDataUrl = renderComminutionCircuitGraphic({
          f80Mm: blastState.optical.p80Mm,
          p80TargetUm: blastState.kuzRam.p80Mm * 1000,
          bondWorkIndex: 14.5,
        }, isFr ? 'fr' : 'en');
      } else if (key === 'benchmap') {
        sectionGraphicDataUrl = renderBenchMapGraphic(blast, 300, isFr ? 'fr' : 'en');
      } else if (key === 'validation') {
        sectionGraphicDataUrl = renderLogarithmicPassingChart({
          swebrecPoints: blastState.optical.curve,
          sievePoints: blast.groundTruth?.sieveData ? computeSieveDistribution(blast.groundTruth.sieveData).curve : undefined,
          title: isFr ? 'Validation Physique : Courbes Tamis vs Optique' : 'Ground Truth Validation: Sieve vs Optical PSD',
          lang: isFr ? 'fr' : 'en',
        });
      } else if (key === 'minetomill') {
        sectionGraphicDataUrl = renderMineToMillGraphic(160, 8.45, isFr ? 'fr' : 'en');
      } else if (key === 'kuzram') {
        sectionGraphicDataUrl = renderLogarithmicPassingChart({
          kuzRamPoints: blastState.kuzRam.predictedCurve,
          p50: blastState.kuzRam.meanSizeX50Mm,
          p80: blastState.kuzRam.p80Mm,
          title: isFr ? 'Courbe Théorique Kuz-Ram (Modèle de Prédiction)' : 'Theoretical Kuz-Ram Curve (Prediction Model)',
          lang: isFr ? 'fr' : 'en',
        });
      }

      if (sectionGraphicDataUrl) {
        const graphicBytes = base64ToUint8Array(sectionGraphicDataUrl);
        children.push(
          new docx.Paragraph({
            spacing: { before: 80, after: 160 },
            alignment: docx.AlignmentType.CENTER,
            children: [
              new docx.ImageRun({
                data: graphicBytes,
                transformation: { width: 520, height: 260 },
                type: 'png',
              }),
            ],
          })
        );
      }
    } catch {
      // ignore section graphic errors
    }
  }

  // =============================================================
  // CONSTRUCT WORD DOCUMENT
  // =============================================================
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
                    text: `FraGeo Suite • Rapport d'Ingénierie de Tir - ${blast.blastId}`,
                    color: '94A3B8',
                    size: 16,
                    font: 'Times New Roman',
                  }),
                  new docx.TextRun({
                    text: `\t${project.name} | ${site.name}`,
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
                    text: orgProfile.reportFooterText || 'FraGeo Suite • Rapport d’ingénierie certifié • FraGeo Technologies',
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

export async function generateBlastDocxReport(
  project: Project,
  site: Site,
  blast: Blast,
  image?: ImageRecord,
  run?: SegmentationRun,
  lang: Language = 'fr',
  selectedSections?: ReportSectionKey[]
): Promise<Blob> {
  const targetBlast = { ...blast };

  // If a specific image/run is passed, set it as the primary image
  if (image) {
    const targetImage = { ...image };
    if (run) {
      targetImage.segmentationRuns = [run, ...(targetImage.segmentationRuns || []).filter((r) => r.id !== run.id)];
    }
    // When results are exported as combined blast composite, just ONE image is sent to the report!
    targetBlast.images = [targetImage];
  } else if (targetBlast.images && targetBlast.images.length > 1) {
    // If multiple images exist, keep only the first/primary representative image in the combined report
    targetBlast.images = [targetBlast.images[0]];
  }

  const sectionsToRender: ReportSectionKey[] =
    selectedSections && selectedSections.length > 0
      ? selectedSections
      : ['blast'];

  const emptyVault: ReportVaultState = {
    blast: null,
    drone3d: null,
    beltvision: null,
    timing: null,
    comminution: null,
    benchmap: null,
    validation: null,
    minetomill: null,
    kuzram: null,
  };

  return generateModularVaultDocxReport(
    emptyVault,
    project,
    site,
    targetBlast,
    lang,
    sectionsToRender
  );
}
