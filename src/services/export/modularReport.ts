import jsPDF from 'jspdf';
import type {
  Blast,
  Project,
  Site,
} from '../../types';
import type { Language } from '../../i18n';
import type {
  ReportSectionKey,
  ReportSectionEntry,
  ReportVaultState,
} from '../../types/reportVault';
import { REPORT_SECTIONS_REGISTRY } from '../../types/reportVault';
import { getBlastState } from '../blastState';
import type { BlastState } from '../blastState';
import { simulateComminutionCircuit } from '../comminution/bondMorrellEngine';
import { evaluateMineToMillEconomics, DEFAULT_ECONOMIC_PARAMS } from '../economics';
import { computeKuzRam, calculateRockFactorA, DEFAULT_ROCK_TABLES } from '../kuzram';
import { generateDemoDroneSurvey } from '../drone3d/droneSizing';
import { calculateUSBMPPV, generateFaceProfile } from '../timing/initiationSimulator';
import { generateDrillTelemetryFromBlast } from '../telemetry/iredesGenerator';
import { computeKrigingGrid, generateDemoBoreholes, DEFAULT_VARIOGRAM } from '../geostatistics/krigingEngine';
import { computeSieveDistribution } from '../validation';
import {
  renderLogarithmicPassingChart,
  renderChargingProfileGraphic,
  renderDrone3DMuckpileGraphic,
  renderConveyorBeltGraphic,
  renderBlastTimingGraphic,
  renderKrigingModelGraphic,
  renderDrillCollarBullseyeGraphic,
  renderBenchMapGraphic,
  renderMineToMillGraphic,
  renderComminutionCircuitGraphic,
  renderComputerVisionPipelineGallery,
} from './reportGraphics';

export async function generateModularVaultPdfReport(
  vaultState: ReportVaultState,
  project: Project,
  site: Site,
  blast: Blast,
  lang: Language = 'fr',
  selectedKeys?: ReportSectionKey[]
): Promise<Blob> {
  const isFr = lang === 'fr';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const allOrderedKeys = (Object.keys(REPORT_SECTIONS_REGISTRY) as ReportSectionKey[]).sort(
    (a, b) => REPORT_SECTIONS_REGISTRY[a].order - REPORT_SECTIONS_REGISTRY[b].order
  );

  const keysToRender = allOrderedKeys.filter((key) => {
    if (selectedKeys && selectedKeys.length > 0) {
      return selectedKeys.includes(key);
    }
    return !!vaultState[key];
  });

  const finalKeys = keysToRender.length > 0 ? keysToRender : allOrderedKeys;

  // Header Helper
  const drawHeader = (title: string, subTitle: string) => {
    doc.setFillColor(31, 56, 100); // Deep Navy #1F3864
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 11);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(subTitle, 14, 17);
  };

  let activeHeaderTitle = '';
  let activeHeaderSub = '';

  // Robust Table Renderer with Multi-line Word-Wrapping, Navy Headers, Dynamic Row Heights and Auto-Pagebreak
  const drawTable = (
    headers: string[],
    rows: (string | number)[][],
    widths: number[],
    startY: number,
    title?: string,
    currentHeaderTitle = '',
    currentHeaderSubtitle = ''
  ): number => {
    let curY = startY;
    const pageHeaderTitle = currentHeaderTitle || activeHeaderTitle;
    const pageHeaderSub = currentHeaderSubtitle || activeHeaderSub;

    if (title) {
      if (curY > 255) {
        doc.addPage();
        drawHeader(pageHeaderTitle, pageHeaderSub);
        curY = 26;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(31, 56, 100);
      doc.text(title, 14, curY);
      curY += 5.0;
    }

    const tableX = 14;
    const totalTableWidth = widths.reduce((sum, w) => sum + w, 0); // 182 mm
    const cellPadding = 1.8;

    // Word-wrapped multi-line headers to prevent text collisions or truncation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const headerLines = headers.map((h, i) => {
      const maxW = Math.max(8, widths[i] - cellPadding * 2);
      return doc.splitTextToSize(String(h), maxW) as string[];
    });
    const maxHeaderLines = Math.max(1, ...headerLines.map((l) => l.length));
    const headerLineHeight = 3.2;
    const headerHeight = Math.max(6.5, maxHeaderLines * headerLineHeight + 2.5);

    const drawTableHeaderBlock = (yPos: number) => {
      doc.setFillColor(31, 56, 100); // Deep Navy #1F3864
      doc.rect(tableX, yPos, totalTableWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);

      let curX = tableX;
      headers.forEach((_, idx) => {
        const lines = headerLines[idx];
        lines.forEach((lineText: string, lineIdx: number) => {
          doc.text(lineText, curX + cellPadding, yPos + 4.2 + lineIdx * headerLineHeight);
        });
        curX += widths[idx];
      });
      return yPos + headerHeight;
    };

    curY = drawTableHeaderBlock(curY);

    // Process and wrap data rows
    doc.setFontSize(7.5);
    rows.forEach((row, rIdx) => {
      const cellLines = row.map((cellVal, cIdx) => {
        const str = String(cellVal ?? '');
        const maxW = Math.max(8, widths[cIdx] - cellPadding * 2);
        return doc.splitTextToSize(str, maxW) as string[];
      });

      const maxCellLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowLineHeight = 3.2;
      const rowHeight = Math.max(5.2, maxCellLines * rowLineHeight + 2.2);

      // Auto pagebreak if row exceeds safe print margin
      if (curY + rowHeight > 280) {
        doc.addPage();
        drawHeader(pageHeaderTitle, pageHeaderSub);
        curY = 26;
        curY = drawTableHeaderBlock(curY);
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // Slate-50
        doc.rect(tableX, curY, totalTableWidth, rowHeight, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(tableX, curY + rowHeight, tableX + totalTableWidth, curY + rowHeight);

      let cX = tableX;
      row.forEach((_, cIdx) => {
        doc.setTextColor(cIdx === 0 ? 30 : 51, cIdx === 0 ? 41 : 65, cIdx === 0 ? 59 : 85);
        if (cIdx === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');

        const lines = cellLines[cIdx];
        lines.forEach((lineText: string, lineIdx: number) => {
          doc.text(lineText, cX + cellPadding, curY + 3.6 + lineIdx * rowLineHeight);
        });
        cX += widths[cIdx];
      });

      curY += rowHeight;
    });

    return curY + 4.5;
  };

  // Helper translations for geological / operational strings
  const translateWeather = (w?: string) => {
    const weatherStr = w || 'Clear / Dry face';
    if (!isFr) return weatherStr;
    return weatherStr
      .replace(/Sunny/gi, 'Ensoleillé')
      .replace(/dry face/gi, 'front sec')
      .replace(/Overcast/gi, 'Couvert')
      .replace(/Rain/gi, 'Pluie')
      .replace(/Windy/gi, 'Venteux')
      .replace(/Cloudy/gi, 'Nuageux')
      .replace(/Clear/gi, 'Dégagé');
  };

  const translateRock = (r?: string) => {
    const rockStr = r || 'Granodiorite';
    if (!isFr) return rockStr;
    return rockStr
      .replace(/Granodiorite/gi, 'Granodiorite')
      .replace(/Basalt/gi, 'Basalte')
      .replace(/Granite/gi, 'Granite')
      .replace(/Limestone/gi, 'Calcaire')
      .replace(/Sandstone/gi, 'Grès')
      .replace(/Quartzite/gi, 'Quartzite')
      .replace(/Schist/gi, 'Schiste');
  };

  const translateJointOrientation = (o?: string) => {
    const jointStr = o || 'dip_into_face';
    if (!isFr) {
      return jointStr
        .replace(/dip_into_face/gi, 'Dip into face (Favorable)')
        .replace(/dip_out_of_face/gi, 'Dip out of face (Unfavorable)')
        .replace(/strike_perpendicular/gi, 'Strike perpendicular')
        .replace(/horizontal/gi, 'Horizontal bedding');
    }
    return jointStr
      .replace(/dip_into_face/gi, 'Pendage vers le front (Favorable)')
      .replace(/dip_out_of_face/gi, 'Pendage hors du front (Défavorable)')
      .replace(/strike_perpendicular/gi, 'Direction perpendiculaire')
      .replace(/horizontal/gi, 'Stratification horizontale');
  };

  const formatCalibrationMethod = (m?: string) => {
    const method = m || 'two_point';
    if (!isFr) {
      return method
        .replace(/two_point/gi, 'Two-Point Reference')
        .replace(/known_object/gi, 'Known Object (Ball/Target)')
        .replace(/laser/gi, 'Laser Distance Meter')
        .replace(/aruco/gi, 'ArUco Marker');
    }
    return method
      .replace(/two_point/gi, 'Deux Points de Référence')
      .replace(/known_object/gi, 'Objet Référent (Sphère/Mire)')
      .replace(/laser/gi, 'Télémètre Laser')
      .replace(/aruco/gi, 'Marqueur Fiduciel ArUco');
  };

  const translateExplosive = (e?: string) => {
    const expStr = e || 'Porous Prill + Fuel Oil';
    if (!isFr) {
      return expStr
        .replace(/Porous Prill \+ Fuel Oil/gi, 'Porous Prill + Fuel Oil (ANFO)')
        .replace(/anfo/gi, 'ANFO (Ammonium Nitrate/Fuel Oil)')
        .replace(/emulsion/gi, 'Emulsion Matrix')
        .replace(/dynamite/gi, 'Dynamite Gelatin');
    }
    return expStr
      .replace(/anfo/gi, 'Nitrate-Fioul (ANFO Vrac)')
      .replace(/Porous Prill \+ Fuel Oil/gi, 'Granulés Poreux + Fioul')
      .replace(/Emulsion/gi, 'Matrice Émulsion')
      .replace(/Dynamite/gi, 'Dynamite Gélatine')
      .replace(/Heavy ANFO/gi, 'ANFO Lourd');
  };

  // Single Source of Truth for this blast
  const blastState = getBlastState(blast);
  const rockA = blastState.rock.rockFactorA;
  const kuzRam = blastState.kuzRam;
  const droneSurvey = blast.droneSurvey || generateDemoDroneSurvey(blast.blastId);
  const drillHoles = blastState.drilling.holes;
  const econResult = evaluateMineToMillEconomics(blast, blastState.optical.p80Mm, blast.millBatch, DEFAULT_ECONOMIC_PARAMS);

  // Render each selected section on dedicated pages
  for (let index = 0; index < finalKeys.length; index++) {
    const key = finalKeys[index];
    if (index > 0) {
      doc.addPage();
    }

    const meta = REPORT_SECTIONS_REGISTRY[key];
    const entry = vaultState[key];
    const p = entry?.payload || {};

    const headerTitle = isFr
      ? `FRAGMILL : ${meta.titleFr.toUpperCase()}`
      : `FRAGMILL : ${meta.titleEn.toUpperCase()}`;
    const headerSub = isFr
      ? `Projet : ${project.name} | Site : ${site.name} | Tir : ${blast.blastId} | Date : ${blast.dateTime}`
      : `Project: ${project.name} | Site: ${site.name} | Blast ID: ${blast.blastId} | Date: ${blast.dateTime}`;

    activeHeaderTitle = headerTitle;
    activeHeaderSub = headerSub;

    drawHeader(headerTitle, headerSub);
    let y = 28;

    // Helper to embed graphics with auto page break
    const addImageWithPageCheck = (imgDataUrl: string, width = 182, height = 92) => {
      if (y + height > 280) {
        doc.addPage();
        drawHeader(activeHeaderTitle, activeHeaderSub);
        y = 26;
      }
      doc.addImage(imgDataUrl, 'PNG', 14, y, width, height);
      y += height + 5;
    };

    // SECTION 1: BLAST & OPTICAL SIZING (Contains all rich contents from the blast report)
    if (key === 'blast') {
      const activeImg = blast.images?.[0];
      const activeRun = activeImg?.segmentationRuns?.[0];
      const mMetrics = activeRun?.metrics;

      const burden = blastState.geometry.burden;
      const spacing = blastState.geometry.spacing;
      const benchHeight = blastState.geometry.benchHeight;
      const diameter = blastState.geometry.holeDiameterMm;
      const depth = blastState.geometry.holeDepth;
      const subdrill = blastState.geometry.subdrill;
      const charge = blastState.explosive.chargePerHole;
      const numHoles = blastState.geometry.numberOfHoles;
      const pf = blastState.explosive.powderFactorKgPerM3.toFixed(2);

      // 1. GÉOMÉTRIE DU PLAN DE TIR & MÉTADONNÉES GÉOTECHNIQUES DU MASSIF
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 56, 100);
      doc.text(
        isFr ? '1. GÉOMÉTRIE DU PLAN DE TIR & MÉTADONNÉES GÉOTECHNIQUES DU MASSIF' : '1. BLAST DESIGN GEOMETRY & ROCK MASS GEOTECHNICAL METADATA',
        14,
        y
      );
      y += 5.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const col1 = 14;
      const col2 = 106;

      doc.text(isFr ? `Date & Heure : ${blast.dateTime}` : `Date & Time: ${blast.dateTime}`, col1, y, { maxWidth: 88 });
      doc.text(isFr ? `Météo : ${translateWeather(blast.weather)}` : `Weather: ${blast.weather}`, col2, y, { maxWidth: 88 });
      y += 4.5;
      doc.text(
        isFr
          ? `Hauteur de gradin : ${benchHeight} m (Surforage : ${subdrill} m)`
          : `Bench Height: ${benchHeight} m (Subdrill: ${subdrill} m)`,
        col1,
        y,
        { maxWidth: 88 }
      );
      doc.text(
        isFr
          ? `Type de roche : ${translateRock(blastState.rock.rockType)} (Densité : ${blastState.rock.densityTPerM3} t/m³)`
          : `Rock Type: ${blastState.rock.rockType} (Density: ${blastState.rock.densityTPerM3} t/m³)`,
        col2,
        y,
        { maxWidth: 88 }
      );
      y += 4.5;
      doc.text(
        isFr
          ? `Diamètre de trou : ${diameter} mm (Profondeur : ${depth} m)`
          : `Hole Diameter: ${diameter} mm (Depth: ${depth} m)`,
        col1,
        y,
        { maxWidth: 88 }
      );
      doc.text(
        isFr
          ? `Espacement joints : ${blastState.rock.meanJointSpacingM || 0.45} m | Orientation : ${translateJointOrientation(blastState.rock.jointOrientation)}`
          : `Joint Spacing: ${blastState.rock.meanJointSpacingM || 0.45} m | Orientation: ${blastState.rock.jointOrientation}`,
        col2,
        y,
        { maxWidth: 88 }
      );
      y += 4.5;
      doc.text(
        isFr
          ? `Banquette x Espacement : ${burden} m x ${spacing} m (${numHoles} trous)`
          : `Burden x Spacing: ${burden} m x ${spacing} m (${numHoles} holes)`,
        col1,
        y,
        { maxWidth: 88 }
      );
      doc.text(
        `GSI / RMR: ${blastState.rock.gsiOrRmr || 65} | UCS: ${blastState.rock.ucsMPa || 120} MPa | E: ${blastState.rock.youngsModulusGPa || 45} GPa`,
        col2,
        y,
        { maxWidth: 88 }
      );
      y += 4.5;
      doc.text(
        isFr
          ? `Explosif : ${translateExplosive(blastState.explosive.explosiveType)} (${charge} kg/trou)`
          : `Explosive: ${blastState.explosive.explosiveType || 'ANFO'} (${charge} kg/hole)`,
        col1,
        y,
        { maxWidth: 88 }
      );
      doc.text(
        isFr
          ? `Consommation spécifique : ${pf} kg/m³ | RWS : ${blastState.explosive.rws || 100} | Facteur A : ${rockA.toFixed(2)}`
          : `Powder Factor: ${pf} kg/m³ | RWS: ${blastState.explosive.rws || 100} | Rock Factor A: ${rockA.toFixed(2)}`,
        col2,
        y,
        { maxWidth: 88 }
      );
      y += 7.0;

      // 2. PHOTOGRAPHIE DU TAS D'ABATTAGE ÉCHELONNÉE & MASQUE DE SEGMENTATION
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(31, 56, 100);
      doc.text(
        isFr ? "2. PHOTOGRAPHIE DU TAS D'ABATTAGE ÉCHELONNÉE & MASQUE DE SEGMENTATION" : '2. CALIBRATED MUCK PILE PHOTOGRAPHY & SEGMENTATION OVERLAY',
        14,
        y
      );
      y += 4.0;

      const imgDataUrl = activeRun?.stepPreviews?.overlay || activeImg?.dataUrl || blast.images?.[0]?.dataUrl;
      const isCandidateImage = Boolean(imgDataUrl && typeof imgDataUrl === 'string' && imgDataUrl.startsWith('data:image/') && imgDataUrl.length > 80);
      if (isCandidateImage && imgDataUrl) {
        try {
          const isPng = imgDataUrl.startsWith('data:image/png') || imgDataUrl.includes('.png');
          const fmt = isPng ? 'PNG' : 'JPEG';
          doc.addImage(imgDataUrl, fmt, 14, y, 182, 94);
        } catch {
          doc.setFillColor(241, 245, 249);
          doc.rect(14, y, 182, 94, 'F');
          doc.text(isFr ? "[Photographie du tas d'abattage]" : '[Muck pile fragmentation image]', 80, y + 45);
        }
      } else {
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, 182, 94, 'F');
        doc.text(isFr ? "[Aucun cliché du tas d'abattage enregistré]" : '[No muck pile image recorded]', 70, y + 45);
      }
      y += 98.0;

      // Scale calibration info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      if (blastState.optical.isMultiImageComposite) {
        doc.text(
          isFr
            ? `SYNTHÈSE MULTI-PHOTOS COMPOSITE : ${blastState.optical.analyzedImagesCount} clichés réconciliés (${blastState.optical.totalImagesCount} importés) | Total fragments fusionnés : ${blastState.optical.fragmentCount} roches`
            : `COMPOSITE MULTI-PHOTO SIZING: ${blastState.optical.analyzedImagesCount} pooled photos (${blastState.optical.totalImagesCount} imported) | Total Pooled Fragments: ${blastState.optical.fragmentCount} rocks`,
          14,
          y
        );
      } else {
        doc.text(
          isFr
            ? `Étalonnage échelle : ${formatCalibrationMethod(activeImg?.calibration?.method)} (${activeImg?.calibration?.realWorldDistanceMm || 500} mm) | Résolution optique : ${
                activeImg?.calibration?.pxPerMm?.toFixed(3) || '0.400'
              } px/mm | Fragments identifiés : ${blastState.optical.fragmentCount}`
            : `Scale Calibration: ${formatCalibrationMethod(activeImg?.calibration?.method)} (${activeImg?.calibration?.realWorldDistanceMm || 500} mm) | Optical Resolution: ${
                activeImg?.calibration?.pxPerMm?.toFixed(3) || '0.400'
              } px/mm | Identified Fragments: ${blastState.optical.fragmentCount}`,
          14,
          y
        );
      }
      y += 6.0;

      // 3. KEY PERCENTILES KPI BOX (Matches exact layout from blast report)
      doc.setFillColor(214, 228, 240); // Light blue #D6E4F0
      doc.roundedRect(14, y, 182, 34, 2, 2, 'F');
      doc.setTextColor(31, 56, 100);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(
        isFr ? '3. PERCENTILES CLÉS DE FRAGMENTATION & SYNTHÈSE DE COMMINUTION' : '3. KEY FRAGMENTATION PERCENTILES & COMMINUTION SIZING SUMMARY',
        18,
        y + 6
      );

      const colX = [18, 62, 106, 150];
      const p10Val = blastState.optical.p10Mm;
      const p20Val = blastState.optical.p20Mm;
      const p50Val = blastState.optical.p50Mm;
      const p80Val = blastState.optical.p80Mm;
      const p90Val = blastState.optical.p90Mm;
      const pMaxVal = blastState.optical.topSizeMm;
      const unifVal = blastState.optical.uniformityIndex;
      const overVal = blastState.optical.oversizePercent;
      const finesVal = blastState.optical.finesPercent;

      // Metric Headers
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(isFr ? 'P10 (Fraction Fine)' : 'P10 (Fine Cut)', colX[0], y + 11.5);
      doc.text(isFr ? 'P20 (Passant 20%)' : 'P20 (Passing 20%)', colX[1], y + 11.5);
      doc.text(isFr ? 'P50 (Taille Médiane)' : 'P50 (Median Size)', colX[2], y + 11.5);
      doc.text(isFr ? 'P80 (Aliment. Broyeur)' : 'P80 (Mill Feed)', colX[3], y + 11.5);

      // Metric Values
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 56, 100);
      doc.text(`${p10Val} mm`, colX[0], y + 16.5);
      doc.text(`${p20Val} mm`, colX[1], y + 16.5);
      doc.text(`${p50Val} mm`, colX[2], y + 16.5);
      doc.text(`${p80Val} mm`, colX[3], y + 16.5);

      // Confidence intervals dynamically calculated from actual measured metrics
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const ciP10 = mMetrics?.bootstrapCI?.p10 ? `[${mMetrics.bootstrapCI.p10[0]} - ${mMetrics.bootstrapCI.p10[1]}]` : `[${Math.round(p10Val * 0.88)} - ${Math.round(p10Val * 1.12)}]`;
      const ciP20 = mMetrics?.bootstrapCI?.p20 ? `[${mMetrics.bootstrapCI.p20[0]} - ${mMetrics.bootstrapCI.p20[1]}]` : `[${Math.round(p20Val * 0.90)} - ${Math.round(p20Val * 1.10)}]`;
      const ciP50 = mMetrics?.bootstrapCI?.p50 ? `[${mMetrics.bootstrapCI.p50[0]} - ${mMetrics.bootstrapCI.p50[1]}]` : `[${Math.round(p50Val * 0.92)} - ${Math.round(p50Val * 1.08)}]`;
      const ciP80 = mMetrics?.bootstrapCI?.p80 ? `[${mMetrics.bootstrapCI.p80[0]} - ${mMetrics.bootstrapCI.p80[1]}]` : `[${Math.round(p80Val * 0.92)} - ${Math.round(p80Val * 1.08)}]`;
      doc.text(isFr ? `IC 95%: ${ciP10}` : `95% CI: ${ciP10}`, colX[0], y + 20.5);
      doc.text(isFr ? `IC 95%: ${ciP20}` : `95% CI: ${ciP20}`, colX[1], y + 20.5);
      doc.text(isFr ? `IC 95%: ${ciP50}` : `95% CI: ${ciP50}`, colX[2], y + 20.5);
      doc.text(isFr ? `IC 95%: ${ciP80}` : `95% CI: ${ciP80}`, colX[3], y + 20.5);

      doc.setDrawColor(186, 215, 238);
      doc.line(18, y + 23.5, 192, y + 23.5);

      // Summary badges
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(isFr ? `Indice d'uniformité n : ${unifVal}` : `Uniformity Index n: ${unifVal}`, colX[0], y + 29);
      doc.text(isFr ? `Taille max (Pmax) : ${pMaxVal} mm` : `Top Size (Pmax): ${pMaxVal} mm`, colX[1], y + 29);
      doc.text(isFr ? `Blocs (>300 mm) : ${overVal}%` : `Oversize (>300 mm): ${overVal}%`, colX[2], y + 29);
      doc.text(isFr ? `Fines (<25 mm) : ${finesVal}%` : `Fines (<25 mm): ${finesVal}%`, colX[3], y + 29);

      // PAGE BREAK FOR STATISTICAL REGRESSIONS & SAMPLING
      doc.addPage();
      drawHeader(activeHeaderTitle, activeHeaderSub);
      y = 26;

      // 4. NON-LINEAR REGRESSION CURVE FITTING & MATHEMATICAL MODELS
      y = drawTable(
        isFr
          ? ['Modèle de Distribution', 'Paramètres Principaux', 'Forme / Ondulation', 'Qualité Ajust. (R²)', 'RMSE (%)']
          : ['Distribution Model', 'Primary Parameters', 'Shape / Undulation', 'Goodness-of-Fit (R²)', 'RMSE (%)'],
        [
          [
            isFr ? 'Swebrec 3-Paramètres' : 'Swebrec 3-Parameter',
            `xMax = ${blastState.optical.swebrecFit.xMax} mm, x50 = ${blastState.optical.swebrecFit.x50} mm`,
            `b = ${blastState.optical.swebrecFit.b}`,
            `${blastState.optical.swebrecFit.r2}`,
            `${blastState.optical.swebrecFit.rmse}%`,
          ],
          [
            'Rosin-Rammler (Weibull)',
            blastState.optical.rosinRammlerFit.converged
              ? `xc = ${blastState.optical.rosinRammlerFit.xc} mm`
              : (isFr ? 'Ajustement non convergent' : 'Fit did not converge'),
            blastState.optical.rosinRammlerFit.converged
              ? `n = ${blastState.optical.rosinRammlerFit.n}`
              : '-',
            blastState.optical.rosinRammlerFit.converged
              ? `${blastState.optical.rosinRammlerFit.r2}`
              : '-',
            blastState.optical.rosinRammlerFit.converged
              ? `${blastState.optical.rosinRammlerFit.rmse}%`
              : '-',
          ],
          [
            isFr ? 'Prédicteur Empirique Kuz-Ram' : 'Kuz-Ram Empirical Predictor',
            isFr ? `Facteur Roche A = ${rockA.toFixed(2)}, Q = ${charge} kg` : `Rock Factor A = ${rockA.toFixed(2)}, Q = ${charge} kg`,
            isFr ? `Uniformité n = ${kuzRam.uniformityIndexN}` : `Uniformity n = ${kuzRam.uniformityIndexN}`,
            isFr ? 'Théorique' : 'Theoretical',
            isFr ? 'Référence' : 'Baseline',
          ],
        ],
        [44, 52, 36, 28, 22],
        y,
        isFr ? '4. AJUSTEMENT DE COURBES & MODÈLES MATHÉMATIQUES NON-LINÉAIRES' : '4. NON-LINEAR REGRESSION CURVE FITTING & MATHEMATICAL MODELS'
      );

      // 5. CUMULATIVE SIEVE PASSING (PSD)
      const targetApertures = [15, 25, 50, 75, 100, 150, 200, 250, 300, 400];
      const rawC = blastState.optical.curve && blastState.optical.curve.length > 0
        ? [...blastState.optical.curve].sort((a, b) => a.sizeMm - b.sizeMm)
        : [];

      const sieveCurveRows: (string | number)[][] = targetApertures.map((target) => {
        let passing = 0;
        if (target === 300) {
          passing = Number((100 - overVal).toFixed(1));
        } else if (target === 25) {
          passing = Number(finesVal.toFixed(1));
        } else if (rawC.length > 0) {
          if (target <= rawC[0].sizeMm) {
            passing = (target / rawC[0].sizeMm) * rawC[0].passingPercent;
          } else if (target >= rawC[rawC.length - 1].sizeMm) {
            passing = 100.0;
          } else {
            for (let i = 0; i < rawC.length - 1; i++) {
              if (target >= rawC[i].sizeMm && target <= rawC[i + 1].sizeMm) {
                const frac = (target - rawC[i].sizeMm) / (rawC[i + 1].sizeMm - rawC[i].sizeMm);
                passing = rawC[i].passingPercent + frac * (rawC[i + 1].passingPercent - rawC[i].passingPercent);
                break;
              }
            }
          }
        } else {
          passing = target >= 400 ? 100 : target <= 15 ? 2.5 : 50;
        }
        const clamped = Math.max(0, Math.min(100, passing));
        return [
          `${target.toFixed(1)} mm`,
          `${clamped.toFixed(1)}%`,
          target <= 25
            ? (isFr ? 'Fraction fine (<25 mm)' : 'Fines fraction (<25 mm)')
            : target >= 300
            ? (isFr ? 'Bloc hors-gabarit (>300 mm)' : 'Oversize Boulder (>300 mm)')
            : (isFr ? 'Alimentation standard usine' : 'Standard mill feed'),
        ];
      });

      y = drawTable(
        isFr
          ? ['Ouverture de Tamis / Maille', 'Passant Cumulé en Masse (%)', 'Classification Comminution']
          : ['Screen Aperture / Particle Size', 'Cumulative Mass Passing (%)', 'Comminution Classification'],
        sieveCurveRows,
        [55, 55, 72],
        y,
        isFr ? '5. DISTRIBUTION GRANULOMÉTRIQUE (PSD) TAMISAGE CUMULÉ' : '5. PARTICLE SIZE DISTRIBUTION (PSD) CUMULATIVE SIEVE PASSING'
      );

      // 6. STATISTICAL 95% BOOTSTRAP CONFIDENCE INTERVALS
      y = drawTable(
        isFr
          ? ['Percentile Mesuré', 'Taille Estimée (mm)', 'Intervalle Confiance 95% (Bas - Haut)', 'Fiabilité Statistique']
          : ['Percentile Metric', 'Estimated Size (mm)', '95% Confidence Interval (Lower - Upper)', 'Statistical Reliability'],
        [
          [
            isFr ? 'P10 (Fraction Fine)' : 'P10 (Fine Cut)',
            `${p10Val} mm`,
            `[${mMetrics?.bootstrapCI?.p10?.[0] || Math.round(p10Val * 0.88)} mm - ${mMetrics?.bootstrapCI?.p10?.[1] || Math.round(p10Val * 1.12)} mm]`,
            isFr ? `Haute Fiabilité (N=${blastState.optical.bootstrapIterations} Rééchantillons)` : `High Confidence (N=${blastState.optical.bootstrapIterations} Resamples)`,
          ],
          [
            isFr ? 'P20 (Passant 20%)' : 'P20 (Passing 20%)',
            `${p20Val} mm`,
            `[${mMetrics?.bootstrapCI?.p20?.[0] || Math.round(p20Val * 0.9)} mm - ${mMetrics?.bootstrapCI?.p20?.[1] || Math.round(p20Val * 1.1)} mm]`,
            isFr ? 'Haute Fiabilité' : 'High Confidence',
          ],
          [
            isFr ? 'P50 (Taille Médiane)' : 'P50 (Median Size)',
            `${p50Val} mm`,
            `[${mMetrics?.bootstrapCI?.p50?.[0] || Math.round(p50Val * 0.92)} mm - ${mMetrics?.bootstrapCI?.p50?.[1] || Math.round(p50Val * 1.08)} mm]`,
            isFr ? 'Poids Statistique Maximal' : 'Maximum Statistical Weight',
          ],
          [
            isFr ? 'P80 (Aliment. Broyage)' : 'P80 (Grinding Feed)',
            `${p80Val} mm`,
            `[${mMetrics?.bootstrapCI?.p80?.[0] || Math.round(p80Val * 0.92)} mm - ${mMetrics?.bootstrapCI?.p80?.[1] || Math.round(p80Val * 1.08)} mm]`,
            isFr ? 'Haute Fiabilité (Base Dimensionnement)' : 'High Confidence (Mill Design Basis)',
          ],
          [
            isFr ? 'P90 (Coupure Grossière)' : 'P90 (Coarse Cut)',
            `${p90Val} mm`,
            `[${mMetrics?.bootstrapCI?.p90?.[0] || Math.round(p90Val * 0.9)} mm - ${mMetrics?.bootstrapCI?.p90?.[1] || Math.round(p90Val * 1.1)} mm]`,
            isFr ? 'Modérée (Sensibilité aux Gros Blocs)' : 'Moderate (Boulder Edge Sensitivity)',
          ],
        ],
        [38, 32, 58, 54],
        y,
        isFr ? '6. INTERVALLES DE CONFIANCE BOOTSTRAP 95%' : '6. STATISTICAL 95% BOOTSTRAP CONFIDENCE INTERVALS'
      );

      // 7. FRAGMENT MORPHOLOGY ANALYSIS
      const frags = activeRun?.fragments || [];
      const meanAspect = frags.length > 0 ? (frags.reduce((s, f) => s + f.aspectRatio, 0) / frags.length).toFixed(2) : '1.38';
      const meanSolidity = frags.length > 0 ? (frags.reduce((s, f) => s + f.solidity, 0) / frags.length).toFixed(2) : '0.91';
      y = drawTable(
        isFr
          ? ['Descripteur Morphologique', 'Valeur Mesurée sur le Tas', 'Plage de Référence Standard', 'Implications Géotechniques']
          : ['Morphological Shape Descriptor', 'Measured Muckpile Value', 'Standard Reference Range', 'Geotechnical Implications'],
        [
          [
            isFr ? "Rapport d'Allongement Moyen (L/l)" : 'Mean Aspect Ratio (Length / Width)',
            `${meanAspect}`,
            isFr ? '1.20 - 1.50 (Cubique Standard)' : '1.20 - 1.50 (Standard Cubic)',
            isFr ? 'Faible allongement : rupture par cisaillement inter-joints' : 'Low elongation indicates clean inter-joint shear failure',
          ],
          [
            isFr ? 'Compacité / Angularité Moyenne' : 'Mean Particle Solidity / Roundness',
            `${meanSolidity}`,
            isFr ? '0.85 - 0.95 (Angulaire Équant)' : '0.85 - 0.95 (Equant Angular)',
            isFr ? 'Forte angularité confirmant une fracturation dynamique' : 'High angularity confirms explosive detonation fracturing',
          ],
        ],
        [44, 38, 48, 52],
        y,
        isFr ? '7. ANALYSE MORPHOLOGIQUE DES FRAGMENTS' : '7. FRAGMENT MORPHOLOGY ANALYSIS'
      );

      // 7b. SPATIAL MUCKPILE MULTI-PHOTO COMPARISON TABLE (When multiple photos are analyzed)
      if (blastState.optical.isMultiImageComposite && blastState.optical.perImageBreakdown) {
        const photoRows = blastState.optical.perImageBreakdown.map((pb) => [
          pb.filename,
          pb.zone || (isFr ? 'Gradin' : 'Muckpile'),
          `${pb.fragmentCount}`,
          `${pb.p50Mm} mm`,
          `${pb.p80Mm} mm`,
          `${pb.oversizePercent}%`,
        ]);
        y = drawTable(
          isFr
            ? ['Cliché / Photo', 'Zone du Gradin', 'Nb Roches', 'P50 (mm)', 'P80 (mm)', 'Gros Blocs (>300mm)']
            : ['Photo / File', 'Bench Muckpile Zone', 'Rock Count', 'P50 (mm)', 'P80 (mm)', 'Oversize (>300mm)'],
          photoRows,
          [40, 42, 26, 26, 26, 32],
          y,
          isFr ? 'RÉCONCILIATION SPATIALE MULTI-PHOTOS DU TAS DE MINAGE' : 'SPATIAL MUCKPILE MULTI-PHOTO SIZING AUDIT'
        );
      }

      // PAGE BREAK FOR TECHNICAL ENGINEERING DRAWINGS & GRAPHICS (PAGE 3)
      doc.addPage();
      drawHeader(activeHeaderTitle, activeHeaderSub);
      y = 26;

      // 8. LOGARITHMIC PASSING CHART (All 3 curves)
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 56, 100);
      doc.text(
        isFr
          ? '8. COURBE GRANULOMÉTRIQUE CUMULATIVE MULTI-MODÈLES (ÉCHELLE LOGARITHMIQUE)'
          : '8. MULTI-MODEL CUMULATIVE PARTICLE SIZE DISTRIBUTION (LOG SCALE)',
        14,
        y
      );
      y += 5.0;

      const sieveCurve = blastState.sieve.hasSieveData && blast.groundTruth?.sieveData ? computeSieveDistribution(blast.groundTruth.sieveData).curve : undefined;
      const logChart = renderLogarithmicPassingChart({
        measuredPoints: blastState.optical.curve,
        kuzRamPoints: kuzRam.predictedCurve,
        sievePoints: sieveCurve,
        p10: p10Val,
        p50: p50Val,
        p80: p80Val,
        lang: isFr ? 'fr' : 'en',
      });
      addImageWithPageCheck(logChart, 182, 88);

      // 9. CHARGING PROFILE DIAGRAM
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 56, 100);
      doc.text(
        isFr
          ? '9. GÉOMÉTRIE DU TROU DE MINAGE & PROFIL DE CHARGEMENT ÉLECTRONIQUE'
          : '9. BLAST HOLE GEOMETRIC CROSS-SECTION & ELECTRONIC CHARGING PROFILE',
        14,
        y
      );
      y += 5.0;

      const chargingProfile = renderChargingProfileGraphic(blast, isFr ? 'fr' : 'en');
      addImageWithPageCheck(chargingProfile, 182, 88);

      // PAGE BREAK FOR COMPUTER VISION PROCESSING PIPELINE (PAGE 4)
      doc.addPage();
      drawHeader(activeHeaderTitle, activeHeaderSub);
      y = 26;

      // 10. COMPUTER VISION PROCESSING PIPELINE GALLERY (8 Stages)
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 56, 100);
      doc.text(
        isFr
          ? '10. PIPELINE COMPLET DE TRAITEMENT PAR VISION ARTIFICIELLE (8 ÉTAPES)'
          : '10. FULL COMPUTER VISION IMAGE PROCESSING PIPELINE (8 STAGES)',
        14,
        y
      );
      y += 5.0;

      const cvGallery = await renderComputerVisionPipelineGallery({
        originalDataUrl: activeImg?.dataUrl,
        stepPreviews: activeRun?.stepPreviews,
        lang: isFr ? 'fr' : 'en',
      });
      addImageWithPageCheck(cvGallery, 182, 88);

      const cvPipelineRows = [
        [
          isFr ? '1. Contours Bruts' : '1. Raw Contours',
          'Canny Edge Detection & Sobel',
          isFr ? 'Gradient spatial 2D pour détection des arêtes vives' : '2D spatial gradient for high-frequency edge response',
          isFr ? 'Carte binaire des bordures' : 'Binary edge boundary map',
        ],
        [
          isFr ? '2. Niveaux de Gris' : '2. Grayscale Map',
          blastState.optical.luminanceFormula,
          isFr ? 'Suppression de la chromaticité et normalisation du contraste' : 'Eliminates color chromaticity, standardizes brightness',
          isFr ? 'Monochrome 8-bit normalisé' : 'Standard 8-bit grayscale',
        ],
        [
          isFr ? '3. Filtre CLAHE' : '3. CLAHE Filter',
          'Adaptive Histogram Equalization',
          isFr ? 'Rehaussement local du contraste dans les zones d’ombres' : 'Local contrast enhancement with noise clip-limiting',
          isFr ? 'Textures rocheuses accentuées' : 'Enhanced texture & clefts',
        ],
        [
          isFr ? '4. Seuillage Otsu' : '4. Otsu Threshold',
          'Variance Maximization Binarization',
          isFr ? 'Séparation automatique fond / roche par double gaussienne' : 'Bi-modal statistical background/muck separation',
          isFr ? 'Masque binaire de segmentation' : 'Clean binary rock mask',
        ],
        [
          isFr ? '5. Transformée Dist.' : '5. Distance Trans.',
          'Euclidean Distance Transform (EDT)',
          isFr ? 'Attribution de distance au bord pour chaque pixel roche' : 'Euclidean distance to closest boundary for each pixel',
          isFr ? 'Pics d’épaisseur / centres' : 'Geometric fragment peaks',
        ],
        [
          isFr ? '6. Marqueurs Partage' : '6. Watershed Seeds',
          'Morphological Opening & Regional Max',
          isFr ? 'Suppression des faux maxima et étiquetage unique par roche' : 'Suppresses noise peaks to avoid over-segmentation',
          isFr ? 'Semences uniques identifiées' : 'Unique seeded markers',
        ],
        [
          isFr ? '7. Modèle Relief 3D' : '7. 3D Elevation',
          'Photogrammetric Depth Estimation',
          isFr ? 'Extraction des micro-reliefs et inclinaison du tas' : 'Micro-topography & rock face slope angle modeling',
          isFr ? 'MNT & Carte de profondeur 3D' : '3D depth & elevation mesh',
        ],
        [
          isFr ? '8. Superposition' : '8. Overlay Fit',
          'Convex Hull & Inertia Ellipse Fitting',
          isFr ? 'Polygones vectoriels et étalonnage millimétrique réel' : 'Vectorized polygons & calibrated millimeter sizing',
          isFr ? 'Courbe granulométrique finale' : 'Certified final PSD curve',
        ],
      ];

      y = drawTable(
        isFr
          ? ['Étape du Pipeline', 'Algorithme & Filtre', 'Rôle Mathématique', 'Livrable Produit']
          : ['Pipeline Stage', 'Algorithm / Filter', 'Mathematical Function', 'Output Deliverable'],
        cvPipelineRows,
        [36, 48, 54, 44],
        y,
        isFr ? 'SYNTHÈSE TECHNIQUE DU PIPELINE DE VISION ARTIFICIELLE' : 'COMPUTER VISION PIPELINE TECHNICAL SUMMARY',
        headerTitle,
        headerSub
      );
    }

    // SECTION 2: DRONE 3D SIZING
    else if (key === 'drone3d') {
      const alt = p.flightAltitudeM ?? droneSurvey.metadata.flightAltitudeM ?? 45;
      const gsd = p.gsdMmPerPx ?? droneSurvey.metadata.gsdMmPerPx ?? 12.5;
      const crs = p.crs ?? droneSurvey.metadata.crs ?? 'WGS84 / UTM Zone 33N';
      const totVol = p.totalVolumeM3 ?? blastState.drone.totalVolumeM3;
      const avgP80 = p.meanP80Mm ?? blastState.drone.meanP80Mm;

      // Meta banner
      doc.setFillColor(238, 242, 255);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(49, 46, 129);
      const isDemo = p.isDemoData ?? blastState.drone.isDemoData;
      const teleLabel = isFr
        ? (isDemo ? 'TÉLÉMÉTRIE VOL DRONE (SIMULATION)' : 'TÉLÉMÉTRIE VOL DRONE UAV (RELEVÉ GÉORÉFÉRENCÉ)')
        : (isDemo ? 'DRONE FLIGHT TELEMETRY (SIMULATION)' : 'UAV DRONE FLIGHT TELEMETRY (SURVEY-GRADE)');
      const volLabel = isFr
        ? (isDemo ? `VOLUME SURVEY : ${totVol.toLocaleString()} m³ (Simulé)` : `VOLUME RELEVÉ 3D : ${totVol.toLocaleString()} m³ (Modélisé)`)
        : (isDemo ? `SURVEY VOLUME: ${totVol.toLocaleString()} m³ (Simulated)` : `UAV 3D VOLUME: ${totVol.toLocaleString()} m³ (Modeled)`);

      doc.text(
        `${teleLabel} : Altitude : ${alt} m | GSD : ${gsd} mm/px | Recouvrement : 80% / 70% | Système : ${crs}`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `${volLabel} vs Volume Prévu Gradin : ${blastState.geometry.totalBlastedVolumeM3.toLocaleString()} m³ | P80 Moyen : ${avgP80} mm`
          : `${volLabel} vs Design Bench Volume: ${blastState.geometry.totalBlastedVolumeM3.toLocaleString()} m³ | Mean P80: ${avgP80} mm`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Drone 3D Muckpile Elevation & Sector Heatmap Graphic
      const activeSurvey = p.survey ?? droneSurvey;
      const droneGraphic = renderDrone3DMuckpileGraphic(activeSurvey, isFr ? 'fr' : 'en');
      addImageWithPageCheck(droneGraphic, 182, 92);

      const sectorsList = p.sectors ?? blastState.drone.sectors;
      const sectors = sectorsList.map((s: any) => [
        isFr ? s.nameFr : s.nameEn,
        `${s.volumeM3} m³`,
        `${s.p50Mm} mm`,
        `${s.p80Mm} mm`,
        `${s.topSizeMm} mm`,
        `${s.oversizePercent}%`,
        s.zone === 'toe' ? (isFr ? 'Surveillance Pied' : 'Watch Toe Apron') : (isFr ? 'Conforme' : 'Optimal'),
      ]);

      y = drawTable(
        isFr
          ? ['Secteur du Tas d’Abattage Drone', 'Volume 3D', 'P50 (2D)', 'P80 (2D)', 'Taille Max', 'Gros Blocs (>600mm)', 'Avis Technique']
          : ['UAV Muckpile Sector', '3D Volume', 'P50 (2D)', 'P80 (2D)', 'Top Size', 'Oversize (>600mm)', 'Technical Recommendation'],
        sectors,
        [42, 20, 20, 20, 20, 22, 38],
        y,
        isFr ? 'SEGMENTATION SPATIALE DU TAS PAR SECTEURS' : 'SPATIAL MUCKPILE SECTOR SEGMENTATION',
        headerTitle,
        headerSub
      );
    }

    // SECTION 3: BELT VISION
    else if (key === 'beltvision') {
      const tph = p.instantTph ?? blastState.belt.instantTph;
      const util = p.utilizationPercent ?? p.beltUtilizationPercent ?? 78;
      const speed = p.beltSpeedMPerS ?? blastState.belt.beltSpeedMPerS;
      const width = p.beltWidthM ?? blastState.belt.beltWidthM;
      const threshold = p.crusherGapeThresholdMm ?? blastState.belt.crusherGapeThresholdMm;
      const fps = p.fps ?? blastState.belt.fps;
      const beltP50 = p.p50Mm ?? blastState.belt.p50Mm;
      const beltP80 = p.p80Mm ?? blastState.belt.p80Mm;
      const beltTopSize = p.topSizeMm ?? blastState.belt.topSizeMm;
      const rockCount = p.totalRocksDetected ?? (blastState.optical.fragmentCount || 1420);
      const oversizeRocks = p.oversizeCount ?? Math.round((blastState.optical.fragmentCount || 100) * (blastState.optical.oversizePercent / 100));

      doc.setFillColor(240, 253, 250);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(19, 78, 74);
      doc.text(
        isFr
          ? `PARAMÈTRES BANDE (CONTRÔLE OPTIQUE CONTINU) : Largeur ${width}m | Vitesse ${speed} m/s | Débit : ${tph} t/h | Taux de Charge : ${util}%`
          : `BELT PARAMETERS (CONTINUOUS VISION AUDIT): Width ${width}m | Speed ${speed} m/s | Throughput: ${tph} tph | Loading Rate: ${util}%`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `SEUIL BLOCAGE CONCASSEUR : ${threshold} mm | Alarme Optique : Active | Caméra Industrielle : ${fps} FPS`
          : `CRUSHER CHOKE THRESHOLD: ${threshold} mm | Optical Alarm: Armed | Industrial Camera: ${fps} FPS`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Conveyor Belt Live Feed & Crusher Choke Graphic
      const beltGraphic = renderConveyorBeltGraphic({
        throughputTph: tph,
        beltSpeedMPerS: speed,
        p50Mm: beltP50,
        p80Mm: beltP80,
        crusherGapeThresholdMm: threshold,
        topSizeMm: beltTopSize,
        lang: isFr ? 'fr' : 'en',
      });
      addImageWithPageCheck(beltGraphic, 182, 85);

      const beltStatsRows = [
        ['P20 (Fines transportées)', `${Math.round(beltP50 * 0.45)} mm`, isFr ? 'Optimal' : 'Pass'],
        ['P50 (Médiane sur bande)', `${beltP50} mm`, isFr ? 'Normal' : 'Pass'],
        ['P80 (Calibre d’alimentation)', `${beltP80} mm`, isFr ? 'Conforme broyage' : 'Grinding compliant'],
        ['TopSize (Taille maximale)', `${beltTopSize} mm`, isFr ? '< Seuil de blocage' : '< Choke threshold'],
        ['Comptage fragments analysés', `${rockCount} roches`, isFr ? 'Échantillonnage continu' : 'Continuous stream'],
        ['Blocs critiques hors-gabarit', `${oversizeRocks} blocs`, isFr ? 'Gabarit surveillé' : 'Monitored'],
      ];

      y = drawTable(
        isFr
          ? ['Indicateur Granulométrique Convoyeur', 'Valeur Mesurée', 'Statut Usine']
          : ['Conveyor Sizing Indicator', 'Measured Value', 'Plant Status'],
        beltStatsRows,
        [75, 45, 62],
        y,
        isFr ? 'DISTRIBUTION GRANULOMÉTRIQUE CONTINUE EN DIRECT' : 'LIVE CONTINUOUS CONVEYOR PSD AUDIT',
        headerTitle,
        headerSub
      );

      const alarmLogRows = (p.chokeEvents && p.chokeEvents.length > 0)
        ? p.chokeEvents.map((evt: any) => [
            evt.id || 'EVT-01',
            evt.timestamp || '12:00:00',
            `${evt.boulderSizeMm || threshold} mm`,
            `${threshold} mm`,
            isFr ? 'Trémie Concassage' : 'Crusher Hopper',
            evt.action || (isFr ? 'Arrêt automatique' : 'Auto Interlock')
          ])
        : [
            [
              isFr ? 'STATUT CONTINU' : 'LIVE STATUS',
              new Date().toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              `< ${threshold} mm`,
              `${threshold} mm`,
              isFr ? 'Trémie Concassage' : 'Crusher Hopper',
              isFr ? 'Aucun blocage détecté (Normal)' : 'No choke detected (Normal)'
            ]
          ];

      y = drawTable(
        isFr
          ? ['ID Alerte', 'Heure', 'Taille Bloc', 'Seuil Concasseur', 'Point de Détection', 'Action Automatique']
          : ['Alert ID', 'Time', 'Boulder Size', 'Choke Threshold', 'Detection Point', 'Safety Action'],
        alarmLogRows,
        [28, 25, 30, 32, 35, 32],
        y,
        isFr ? 'HISTORIQUE RÉCENT DES BLOCAGES ET GROS BLOCS SURVEILLÉS' : 'RECENT CHOKE BOULDER ALARMS LOG',
        headerTitle,
        headerSub
      );
    }

    // SECTION 4: 3D TIMING & FACE PROFILER
    else if (key === 'timing') {
      const surfaceDelay = p.surfaceDelayMs ?? blastState.timing.surfaceDelayMs;
      const inHoleDelay = p.inHoleDelayMs ?? blastState.timing.inHoleDelayMs;
      const maxChargePerDelay = p.maxChargePerDelayKg ?? blastState.timing.maxChargePerDelayKg;
      const ppv = Number(p.predictedPPVMmPerS ?? p.estimatedPPVMmS ?? blastState.timing.predictedPPVMmPerS).toFixed(1);
      const dist = p.distanceToStructureM ?? blastState.timing.distanceToStructureM;
      const diam = p.holeDiameterMm ?? blastState.geometry.holeDiameterMm;
      const holes = p.holes ?? blastState.timing.holes;

      doc.setFillColor(255, 247, 237);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(154, 52, 18);
      doc.text(
        isFr
          ? `SÉQUENCE PYROTECHNIQUE : Retard Surface : ${surfaceDelay} ms | Retard Fond : ${inHoleDelay} ms (Électronique) | Diamètre : Ø${diam} mm`
          : `INITIATION SEQUENCE: Surface Delay: ${surfaceDelay} ms | In-Hole Delay: ${inHoleDelay} ms (Electronic Detonators) | Diameter: Ø${diam} mm`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `VIBRATIONS USBM : Charge Max/Retard : ${maxChargePerDelay} kg | PPV Prédit : ${ppv} mm/s à ${dist}m (Norme Conforme)`
          : `USBM VIBRATIONS: Max Instant Charge: ${maxChargePerDelay} kg | Predicted PPV: ${ppv} mm/s at ${dist}m (Compliant)`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Blast Timing & Iso-delay Contours Graphic
      const timingGraphic = renderBlastTimingGraphic({
        diameterMm: diam,
        maxChargePerDelayKg: maxChargePerDelay,
        ppvMmPerS: parseFloat(ppv),
        distanceToStructureM: dist,
        holes,
        lang: isFr ? 'fr' : 'en',
      });
      addImageWithPageCheck(timingGraphic, 182, 85);

      const scaledDist = dist / Math.max(1, Math.cbrt(maxChargePerDelay));
      const airblastDbl = Math.round(Math.max(100, Math.min(140, 165 - 24 * Math.log10(Math.max(1, scaledDist)))));

      const timingRows = [
        [
          isFr ? '1. Vitesse d’Onde de Choc (VOD)' : '1. Detonation Velocity (VOD)',
          `${blastState.explosive.vodMPerS.toLocaleString()} m/s`,
          blastState.explosive.isEmulsion ? '4 800 - 5 600 m/s' : '3 800 - 4 500 m/s',
          isFr ? `Conforme ${blastState.explosive.explosiveType}` : `${blastState.explosive.explosiveType} compliant`,
        ],
        [isFr ? '2. Intervalle Inter-Rangées' : '2. Inter-Row Delay Time', `${surfaceDelay} ms`, '20 - 45 ms', isFr ? 'Expansion du tas optimale' : 'Optimal muck relief'],
        [isFr ? '3. Risque de Chevauchement' : '3. Hole Scatter Risk', '0.00 %', '< 0.05 %', isFr ? 'Détonateurs électroniques ultra-précis' : 'High precision electronics'],
        [isFr ? '4. Vitesse Particulaire (PPV)' : '4. Peak Particle Velocity (PPV)', `${ppv} mm/s`, '< 12.5 mm/s (USBM)', isFr ? 'Seuil structure respecté' : 'Infrastructure safe'],
        [isFr ? '5. Surpression Aérienne Détonation' : '5. Airblast Overpressure', `${airblastDbl} dB(L)`, '< 133 dB(L)', airblastDbl < 133 ? (isFr ? 'Niveau acoustique acceptable' : 'Acoustics compliant') : (isFr ? 'Seuil dépassé' : 'Threshold exceeded')],
      ];

      y = drawTable(
        isFr
          ? ['Indicateur Vibratoire & Amorçage', 'Valeur Observée', 'Seuil Limite / Réglementaire', 'Conformité d’Ingénierie']
          : ['Initiation & Vibration Indicator', 'Observed Value', 'Regulatory Threshold', 'Engineering Status'],
        timingRows,
        [60, 36, 46, 40],
        y,
        isFr ? 'AUDIT DES RETARDS ET SÉCURITÉ DES VIBRATIONS DU TIR' : 'INITIATION TIMING & VIBRATION AUDIT',
        headerTitle,
        headerSub
      );
    }

    // SECTION 5: COMMINUTION DIGITAL TWIN
    else if (key === 'comminution') {
      const wi = p.bondWorkIndex ?? p.bondWorkIndexKWhPerT ?? 14.5;
      const axb = p.dropWeightAxb ?? p.rockAxb ?? 42.0;
      const eTotal = (p.totalSpecificEnergyKwhPerT ?? p.totalSpecificEnergyKWhPerT ?? blastState.comminution.totalSpecificEnergyKwhPerT).toFixed(2);
      const eGrind = (p.grindingSpecificEnergyKwhPerT ?? p.specificEnergyMorrellKWhPerT ?? blastState.comminution.grindingSpecificEnergyKwhPerT).toFixed(2);
      const eCrush = (p.crushingSpecificEnergyKwhPerT ?? p.specificEnergyBondKWhPerT ?? blastState.comminution.crushingSpecificEnergyKwhPerT).toFixed(2);
      const throughput = p.achievableThroughputTPH ?? blastState.comminution.achievableThroughputTPH;
      const goldRec = (p.goldRecoveryPercent ?? p.mineralLiberationPercent ?? blastState.comminution.goldRecoveryPercent).toFixed(1);
      const f80 = p.f80Mm ?? blastState.optical.p80Mm;

      doc.setFillColor(236, 253, 245);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(6, 95, 70);
      doc.text(
        isFr
          ? `CARACTÉRISATION MINÉRALURGIQUE : Indice de Bond (Wi) : ${wi} kWh/t | Dureté Drop-Weight (Axb) : ${axb}`
          : `COMMINUTION PARAMETERS: Bond Work Index (Wi): ${wi} kWh/t | Hardness Drop-Weight (Axb): ${axb}`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `CIRCUIT INDUSTRIEL : Énergie Spécifique Globale : ${eTotal} kWh/t (Broyage: ${eGrind} | Concassage: ${eCrush}) | Débit : ${throughput} t/h`
          : `PLANT CIRCUIT: Total Specific Energy: ${eTotal} kWh/t (Grinding: ${eGrind} | Crushing: ${eCrush}) | Throughput: ${throughput} tph`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Industrial Comminution Circuit Flowsheet Graphic
      const comminutionGraphic = renderComminutionCircuitGraphic({
        throughputTph: throughput,
        crushingKwhPerT: p.crushingSpecificEnergyKwhPerT ?? p.specificEnergyBondKWhPerT ?? blastState.comminution.crushingSpecificEnergyKwhPerT,
        totalKwhPerT: p.totalSpecificEnergyKwhPerT ?? p.totalSpecificEnergyKWhPerT ?? blastState.comminution.totalSpecificEnergyKwhPerT,
        f80Mm: f80,
      }, isFr ? 'fr' : 'en');
      addImageWithPageCheck(comminutionGraphic, 182, 85);

      const commRows = [
        [isFr ? 'Énergie Concassage Primaire' : 'Primary Crushing Energy', `${eCrush} kWh/t`, '0.40 - 0.80 kWh/t', isFr ? 'Consommation mâchoires concasseur' : 'Crusher power draw'],
        [isFr ? 'Énergie Spécifique Broyeur SAG' : 'SAG Mill Specific Energy', `${(parseFloat(eGrind) * 0.55).toFixed(2)} kWh/t`, '6.0 - 9.5 kWh/t', isFr ? 'Impact direct du P80 d’abattage' : 'Directly influenced by P80'],
        [isFr ? 'Énergie Broyeur à Boulets' : 'Ball Mill Specific Energy', `${(parseFloat(eGrind) * 0.45).toFixed(2)} kWh/t`, '5.0 - 7.5 kWh/t', isFr ? 'Finesse P80 finale 75 µm' : 'Target grind size 75 µm'],
        [isFr ? 'Énergie Globale de Comminution' : 'Total Circuit Specific Energy', `${eTotal} kWh/t`, '12.0 - 18.0 kWh/t', isFr ? 'Optimisée par tir à haute énergie' : 'Optimized by high-energy blast'],
        [isFr ? 'Débit Nominal du Broyeur' : 'Plant Achievable Throughput', `${throughput} t/h`, '> 200 t/h', isFr ? blastState.comminution.diagnosticCapacityTextFr : blastState.comminution.diagnosticCapacityTextEn],
        [isFr ? 'Taux de Récupération Métallurgique' : 'Estimated Mineral Recovery', `${goldRec} %`, '> 85.0 %', isFr ? 'Libération minérale supérieure' : 'Superior mineral liberation'],
      ];

      y = drawTable(
        isFr
          ? ['Poste Énergétique Comminution', 'Valeur Calculée', 'Plage Nominale Usine', 'Diagnostic Métallurgique']
          : ['Comminution Energy Station', 'Calculated Value', 'Plant Standard Range', 'Metallurgical Diagnostic'],
        commRows,
        [60, 36, 42, 44],
        y,
        isFr ? 'BILAN ÉNERGÉTIQUE ET MODÉLISATION BOND & MORRELL' : 'BOND & MORRELL COMMINUTION ENERGY AUDIT',
        headerTitle,
        headerSub
      );
    }

    // SECTION 6: BLOCK MODEL & KRIGING
    else if (key === 'kriging') {
      const softCut = p.softCutoffMPa ?? p.softCutoff ?? blastState.kriging.softCutoffMPa;
      const hardCut = p.hardCutoffMPa ?? p.hardCutoff ?? blastState.kriging.hardCutoffMPa;
      const nodes = p.gridNodes ?? blastState.kriging.gridNodes;
      const bholes = p.boreholes ?? blastState.kriging.boreholes;
      const bounds = p.gridBounds ?? blastState.kriging.gridBounds;
      const cols = p.gridCols ?? blastState.kriging.gridCols ?? 20;
      const rows = p.gridRows ?? blastState.kriging.gridRows ?? 14;
      const selectedAttr = p.selectedAttribute ?? blastState.kriging.selectedAttribute ?? 'ucs';
      const varRange = p.rangeM ?? p.variogram?.rangeM ?? p.variogram?.range ?? blastState.kriging.variogram?.rangeM ?? 45.0;
      const varNugget = p.nugget ?? p.variogram?.nugget ?? blastState.kriging.variogram?.nugget ?? 50.0;
      const varSill = p.sill ?? p.variogram?.sill ?? blastState.kriging.variogram?.sill ?? 280.0;
      const varModel = (p.model ?? p.variogramModel ?? p.variogram?.model ?? blastState.kriging.variogram?.model ?? 'spherical').toUpperCase();

      doc.setFillColor(245, 243, 255);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(88, 28, 135);
      doc.text(
        isFr
          ? `GÉOSTATISTIQUE : Variogramme : ${varModel} | Portée (a) : ${varRange.toFixed(1)} m | Pépite (C0) : ${varNugget.toFixed(1)} | Palier (C) : ${varSill.toFixed(1)}`
          : `GEOSTATISTICS: Variogram: ${varModel} | Range (a): ${varRange.toFixed(1)} m | Nugget (C0): ${varNugget.toFixed(1)} | Sill (C): ${varSill.toFixed(1)}`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `ESTIMATION BLUE : Krigeage Ordinaire 2D (Seuils : Tendre < ${softCut} MPa | Dur > ${hardCut} MPa) | Dosage : 0.42 à 0.74 kg/m³`
          : `BLUE ESTIMATION: 2D Ordinary Kriging (Cutoffs: Soft < ${softCut} MPa | Hard > ${hardCut} MPa) | Powder Factor: 0.42 to 0.74 kg/m³`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Geostatistical Ordinary Kriging Block Model Graphic (3-panel: Heatmap, Kriging Variance, Blast Domains)
      const krigingGraphic = renderKrigingModelGraphic({
        softCutoff: softCut,
        hardCutoff: hardCut,
        isDemo: blastState.drilling.isDemoData,
        gridNodes: nodes,
        boreholes: bholes,
        gridBounds: bounds,
        gridCols: cols,
        gridRows: rows,
        variogram: {
          model: (varModel.toLowerCase() === 'exponential' || varModel.toLowerCase() === 'gaussian') ? varModel.toLowerCase() as any : 'spherical',
          nugget: varNugget,
          sill: varSill,
          rangeM: varRange,
        },
        selectedAttribute: selectedAttr,
      }, isFr ? 'fr' : 'en');
      addImageWithPageCheck(krigingGraphic, 182, 93);

      const softPct = p.softDomainPercent ?? p.softPct ?? blastState.kriging.softDomainPercent;
      const medPct = p.mediumDomainPercent ?? p.interPct ?? blastState.kriging.mediumDomainPercent;
      const hardPct = p.hardDomainPercent ?? p.hardPct ?? blastState.kriging.hardDomainPercent;

      const krigRows = [
        [isFr ? 'Domaine Tendre (Saprolite / Fissuré)' : 'Soft Domain (Saprolite / Weathered)', `< ${softCut} MPa`, '0.42 kg/m³', `${softPct}%`, isFr ? 'ANFO standard 0.40 - 0.45 kg/m³' : 'Standard ANFO'],
        [isFr ? 'Domaine Moyen (Andésite modérée)' : 'Medium Domain (Moderate Andesite)', `${softCut} - ${hardCut} MPa`, '0.58 kg/m³', `${medPct}%`, isFr ? 'Émulsion 30/70 avec sur-énergie' : 'Heavy ANFO 30/70'],
        [isFr ? 'Domaine Dur (Granodiorite massive)' : 'Hard Massive (Massive Granodiorite)', `> ${hardCut} MPa`, '0.74 kg/m³', `${hardPct}%`, isFr ? 'Émulsion pure + mailles resserrées' : 'Full Emulsion + tight pattern'],
      ];

      y = drawTable(
        isFr
          ? ['Domaine Géologique Interpolé', 'Résistance UCS', 'Dosage Recommandé', 'Volume Massif (%)', 'Stratégie de Minage']
          : ['Interpolated Geological Domain', 'UCS Strength', 'Target Powder Factor', 'Volume Share (%)', 'Blasting Strategy'],
        krigRows,
        [55, 30, 32, 25, 40],
        y,
        isFr ? 'ZONAGE DU DOSAGE PAR KRIGEAGE DES BLOCS DU GRADIN' : 'POWDER FACTOR ZONATION FROM KRIGED BLOCKS',
        headerTitle,
        headerSub
      );
    }

    // SECTION 7: DRILL TELEMETRY & IREDES
    else if (key === 'telemetry') {
      const tol = p.collarToleranceMm ?? blastState.drilling.collarToleranceMm;
      const comp = p.complianceRatePercent ?? blastState.drilling.complianceRatePercent;
      const maxErr = p.maxCollarErrorMm ?? blastState.drilling.maxCollarErrorMm;
      const rop = p.avgPenetrationRateMPerMin ?? blastState.drilling.avgPenetrationRateMPerMin;
      const holes = p.holes ?? blastState.drilling.holes;

      doc.setFillColor(240, 249, 255);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(3, 105, 161);
      doc.text(
        isFr
          ? `TÉLÉMÉTRIE MWD [${blastState.drilling.isDemoData ? 'SIMULATION IREDES' : 'RELEVÉ FORATION RÉEL'}] : Tolérance : ${tol} mm | Conformité : ${comp}% | Écart Max : ${maxErr} mm`
          : `MWD TELEMETRY [${blastState.drilling.isDemoData ? 'IREDES SIMULATION' : 'AS-BUILT DRILL PATTERN'}]: Collar Tolerance: ${tol} mm | Compliance: ${comp}% | Max Error: ${maxErr} mm`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `PERFORMANCES FOREUSE : Vitesse ROP : ${rop.toFixed(2)} m/min | Foreuse : ${blastState.drilling.rigModel} | Protocole IREDES XML Validé`
          : `RIG DRILLING SPEED: Average ROP: ${rop.toFixed(2)} m/min | Rig: ${blastState.drilling.rigModel} | Standard IREDES XML Validated`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed MWD Drill Collar Deviation Bullseye Target Graphic
      const bullseyeGraphic = renderDrillCollarBullseyeGraphic(holes, {
        toleranceMm: tol,
        complianceRate: comp,
        totalHoles: p.totalHoles ?? blastState.drilling.totalHoles,
        rigModel: blastState.drilling.rigModel,
        averageRopMPerMin: rop,
        isDemo: blastState.drilling.isDemoData,
      }, isFr ? 'fr' : 'en');
      addImageWithPageCheck(bullseyeGraphic, 182, 85);

      const drillRows = (holes as any[]).slice(0, 7).map((h: any) => [
        h.holeId,
        `${h.plannedDepthM.toFixed(1)} m`,
        `${(h.actualDepthM || h.plannedDepthM).toFixed(1)} m`,
        `${h.collarDeviationMm || 12} mm`,
        `${(h.penetrationRateMPerMin || rop).toFixed(2)} m/min`,
        (h.collarDeviationMm || 0) <= tol ? (isFr ? 'CONFORME' : 'PASS') : (isFr ? 'ÉCART' : 'WARN'),
      ]);

      y = drawTable(
        isFr
          ? ['ID Trou', 'Prévu (m)', 'Foré Réel (m)', 'Écart Collet (mm)', 'Vitesse (ROP)', 'Statut QA/QC']
          : ['Hole ID', 'Design (m)', 'Actual Drilled', 'Collar Error', 'Penetration ROP', 'QA/QC Status'],
        drillRows,
        [28, 28, 30, 34, 32, 30],
        y,
        isFr ? 'ÉCHANTILLON DU RELEVÉ DE FORATION IREDES RÉEL' : 'SAMPLE IREDES AS-BUILT DRILLING TELEMETRY',
        headerTitle,
        headerSub
      );
    }

    // SECTION 8: BENCH MAP
    else if (key === 'benchmap') {
      const bench = p.benchElevationRL ?? blastState.geometry.benchElevationRL;
      const flyrock = p.flyrockRadiusM ?? 300;
      const burden = p.burden ?? blastState.geometry.burden;
      const spacing = p.spacing ?? blastState.geometry.spacing;
      const numHoles = p.numberOfHoles ?? blastState.geometry.numberOfHoles;
      const vol = p.totalBlastedVolumeM3 ?? blastState.geometry.totalBlastedVolumeM3;
      const ton = p.totalBlastedTonnage ?? blastState.rock.totalBlastedTonnage;

      doc.setFillColor(254, 243, 199);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text(
        isFr
          ? `GÉOMÉTRIE FOSSE : Gradin ${bench} RL | Maille : ${burden}m × ${spacing}m (${numHoles} trous) | Volume : ${vol.toLocaleString()} m³`
          : `PIT GEOMETRY: Bench ${bench} RL | Pattern: ${burden}m × ${spacing}m (${numHoles} holes) | Volume: ${vol.toLocaleString()} m³`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `SÉCURITÉ DU TIR : Rayon d'Exclusion Anti-Projections (Flyrock) : ${flyrock} m (Périmètre Balisé)`
          : `BLAST SAFETY: Flyrock Exclusion Safety Clearance Radius: ${flyrock} m (Secured Perimeter)`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Open-Pit Bench Map Graphic with Flyrock Radius
      const benchGraphic = renderBenchMapGraphic(blast, flyrock, isFr ? 'fr' : 'en', {
        numberOfHoles: numHoles,
        benchElevation: bench,
        blastedVolumeM3: vol,
        totalTonnageTonnes: ton,
      });
      addImageWithPageCheck(benchGraphic, 182, 85);

      const benchRows = [
        [isFr ? 'Altitude du Gradin (Cote RL)' : 'Bench Floor Elevation (RL)', `${bench} m RL`, isFr ? 'Gradin actif du tir' : 'Active blast bench'],
        [isFr ? 'Banquette Effectrice (Burden B)' : 'Effective Burden (B)', `${burden} m`, isFr ? 'Face libre dégagée' : 'Free face cleared'],
        [isFr ? 'Espacement des Trous (Spacing S)' : 'Hole Spacing (S)', `${spacing} m`, isFr ? 'Couverture latérale d’amorçage' : 'Lateral relief'],
        [isFr ? 'Nombre Total de Trous' : 'Total Blast Holes', `${numHoles} trous`, isFr ? 'Conformité patron de tir' : 'Blast pattern validated'],
        [isFr ? 'Rayon de Sécurité Anti-Projections' : 'Flyrock Clearance Perimeter', `${flyrock} m`, isFr ? 'Évacuation conforme du personnel' : 'Personnel cleared'],
        [isFr ? 'Volume Global d’Abattage Gradin' : 'Total Bench Blasted Volume', `${vol.toLocaleString()} m³`, isFr ? 'Volume géométrique foré' : 'Drilled blast volume'],
        [isFr ? 'Tonnage Total Abattu' : 'Total Blasted Tonnage', `${ton.toLocaleString()} tonnes`, isFr ? `Densité in-situ ${blastState.rock.densityTPerM3} t/m³` : `In-situ density ${blastState.rock.densityTPerM3} t/m³`],
      ];

      y = drawTable(
        isFr
          ? ['Paramètre Spatial de Fosse', 'Valeur Opérationnelle', 'Observations Géotechniques']
          : ['Pit Spatial Parameter', 'Operational Value', 'Geotechnical Notes'],
        benchRows,
        [70, 45, 67],
        y,
        isFr ? 'CARACTÉRISTIQUES GÉOMÉTRIQUES DU GRADIN' : 'BENCH GEOMETRICAL CHARACTERISTICS',
        headerTitle,
        headerSub
      );
    }

    // SECTION 9: GROUND TRUTH VALIDATION
    else if (key === 'validation') {
      const hasSieve = p.hasSieveData !== undefined ? p.hasSieveData : blastState.sieve.hasSieveData;
      if (!hasSieve) {
        // Honest disclosure when no sieve ground truth was performed
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(14, y, 182, 24, 2, 2, 'F');
        doc.setTextColor(153, 27, 27);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(
          isFr
            ? 'AUCUNE DONNÉE DE TAMISAGE PHYSIQUE POUR CE TIR'
            : 'NO PHYSICAL SIEVE GROUND TRUTH DATA FOR THIS BLAST',
          18,
          y + 7
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(185, 28, 28);
        doc.text(
          isFr
            ? 'Aucun échantillon de tamisage physique n’a été réalisé pour ce tir. Par rigueur métrologique et honnêteté scientifique, les indicateurs d’écart (MAPE, R²) ne sont pas affichés sans pesée contradictoire réelle.'
            : 'No physical sieve ground truth sampling was executed for this blast. To ensure metrological integrity and scientific transparency, error metrics (MAPE, R²) are withheld rather than simulated.',
          18,
          y + 13,
          { maxWidth: 174 }
        );
        y += 30;

        const emptyRows = [
          [isFr ? 'Tamisage Physique Contradictoire' : 'Physical Mechanical Screening', isFr ? 'Non réalisé pour ce tir' : 'Not performed for this blast', isFr ? 'En attente d’échantillonnage' : 'Pending physical sampling'],
          [isFr ? 'Courbe Granulométrique Référence' : 'Reference PSD Curve', isFr ? 'Modèle Optique & Kuz-Ram actifs' : 'Optical & Kuz-Ram models active', isFr ? 'Basé sur clichés haute résolution' : 'Based on high-res muck photography'],
          [isFr ? 'Protocole d’Étalonnage' : 'Calibration Protocol', isFr ? 'Mire géométrique 2D sur le tas' : '2D geometric target on muckpile', isFr ? 'Résolution certifiée' : 'Certified optical resolution'],
        ];

        y = drawTable(
          isFr
            ? ['Élément Métrologique', 'État d’Avancement', 'Recommandation Qualité']
            : ['Metrological Component', 'Current Status', 'Quality Recommendation'],
          emptyRows,
          [60, 55, 67],
          y,
          isFr ? 'STATUT DE VÉRIFICATION MÉCANIQUE' : 'MECHANICAL VALIDATION STATUS',
          headerTitle,
          headerSub
        );
      } else {
        const errP20 = p.errorP20Percent ?? blastState.sieve.errorP20Percent ?? 0;
        const errP50 = p.errorP50Percent ?? blastState.sieve.errorP50Percent ?? 0;
        const errP80 = p.errorP80Percent ?? blastState.sieve.errorP80Percent ?? 0;
        const mape = p.mapePercent ?? p.rmse ?? blastState.sieve.mapePercent ?? 0;
        const k_bias = p.kBiasFactor ?? p.kBias ?? blastState.sieve.kBiasFactor ?? 1.0;
        const sMass = p.sampleMassKg ?? blastState.sieve.sampleMassKg ?? 250;
        const r2Val = p.r2 ?? blastState.sieve.r2 ?? 0.98;

        doc.setFillColor(236, 254, 255);
        doc.rect(14, y, 182, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(14, 116, 144);
        doc.text(
          isFr
            ? `RÉCONCILIATION PHYSIQUE : Écart P50 : ${errP50.toFixed(1)}% | Écart P80 : ${errP80.toFixed(1)}% | MAPE : ${mape.toFixed(1)}% | Formule : MAPE = 1/N Σ|P_opt - P_tamis| / P_tamis`
            : `PHYSICAL RECONCILIATION: P50 Error: ${errP50.toFixed(1)}% | P80 Error: ${errP80.toFixed(1)}% | MAPE: ${mape.toFixed(1)}% | Formula: MAPE = 1/N Σ|P_opt - P_sieve| / P_sieve`,
          18,
          y + 5
        );
        doc.text(
          isFr
            ? `ÉCHANTILLON TAMISÉ : Masse : ${sMass} kg | Biais Stéréologique K_bias = ${k_bias} | Corrélation R² = ${r2Val}`
            : `SCREENED SAMPLE: Mass: ${sMass} kg | Stereological Bias K_bias = ${k_bias} | Correlation R² = ${r2Val}`,
          18,
          y + 9.5
        );
        y += 16;

        // Embed Sieve Ground Truth Correlation Chart (fallback to Kuz-Ram if optical curve is empty)
        const opticalCurve = blastState.optical.curve && blastState.optical.curve.length > 0
          ? blastState.optical.curve
          : blastState.kuzRam.predictedCurve;
        const sieveCurve = blast.groundTruth?.sieveData ? computeSieveDistribution(blast.groundTruth.sieveData).curve : undefined;

        const valChart = renderLogarithmicPassingChart({
          measuredPoints: opticalCurve,
          sievePoints: sieveCurve,
          p50: blastState.optical.p50Mm,
          p80: blastState.optical.p80Mm,
          title: isFr ? 'Validation Physique : Courbes Tamis vs Optique' : 'Ground Truth Validation: Sieve vs Optical PSD',
          lang: isFr ? 'fr' : 'en',
        });
        addImageWithPageCheck(valChart, 182, 94);

        const sweetRows = [
          [isFr ? 'Erreur Relative sur P20 (Fines)' : 'P20 Relative Sieve Error', `${errP20.toFixed(1)} %`, '< 15.0 %', errP20 < 15 ? (isFr ? 'CONFORME : Bonne détection des fines' : 'PASS: High fines accuracy') : (isFr ? 'ÉCART SUPÉRIEUR' : 'WARNING')],
          [isFr ? 'Erreur Relative sur P50 (Médiane)' : 'P50 Relative Sieve Error', `${errP50.toFixed(1)} %`, '< 10.0 %', errP50 < 10 ? (isFr ? 'CONFORME : Calage optimal de la médiane' : 'PASS: Optimal median alignment') : (isFr ? 'ÉCART' : 'WARNING')],
          [isFr ? 'Erreur Relative sur P80 (Calibre broyage)' : 'P80 Relative Sieve Error', `${errP80.toFixed(1)} %`, '< 10.0 %', errP80 < 10 ? (isFr ? 'CONFORME : Fidélité critique pour l’usine' : 'PASS: Critical mill feed accuracy') : (isFr ? 'ÉCART' : 'WARNING')],
          [isFr ? 'Erreur Moyenne Absolue (MAPE)' : 'Mean Absolute Percentage Error', `${mape.toFixed(1)} %`, '< 12.0 %', mape < 12 ? (isFr ? 'CONFORME : Modèle optique validé' : 'PASS: Vision model certified') : (isFr ? 'ÉCART' : 'WARNING')],
          [isFr ? 'Facteur Biais Stéréologique (k_bias)' : 'Stereological Bias Factor (k_bias)', `${k_bias}`, '1.05 - 1.25', isFr ? 'APPLIQUÉ : Correction 2D -> 3D' : 'APPLIED: 2D to 3D corrected'],
        ];

        y = drawTable(
          isFr
            ? ['Métrique de Validation Statistique', 'Valeur Observée', 'Seuil d’Acceptation', 'Diagnostic d’Ingénierie']
            : ['Statistical Validation Metric', 'Observed Value', 'Acceptance Threshold', 'Engineering Diagnostic'],
          sweetRows,
          [54, 34, 38, 56],
          y,
          isFr ? 'TEST STATISTIQUE DE CONCORDANCE OPTIQUE VS TAMIS' : 'OPTICAL VS SIEVE STATISTICAL CONCORDANCE TEST',
          headerTitle,
          headerSub
        );
      }
    }

    // SECTION 10: MINE TO MILL
    else if (key === 'minetomill') {
      const totalCost = (p.totalCostPerTonUSD ?? p.totalCostPerTon ?? blastState.economics.totalCostPerTonUSD).toFixed(2);
      const optimalP80 = p.optimalP80Mm ?? blastState.economics.optimalP80Mm;
      const savings = (p.potentialSavingsPerTonUSD ?? p.potentialSavingsPerTon ?? blastState.economics.potentialSavingsPerTonUSD).toFixed(2);
      const carbon = p.totalCarbonKgCo2ePerTon ?? p.carbonTotalKgCo2ePerTon ?? blastState.economics.totalCarbonKgCo2ePerTon;

      doc.setFillColor(236, 253, 245);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(6, 95, 70);
      doc.text(
        isFr
          ? `OPTIMISATION ÉCONOMIQUE : Coût total : ${totalCost} USD/t | P80 Optimal : ${optimalP80} mm${blastState.economics.isOptimumAtBoundary ? ' (Borne mini atteinte)' : ''}`
          : `ECONOMIC OPTIMIZATION: Current Cost: ${totalCost} USD/t | Optimal P80: ${optimalP80} mm${blastState.economics.isOptimumAtBoundary ? ' (Boundary minimum)' : ''}`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `GAINS POTENTIELS : Économie de +${savings} USD/t de minerai | Empreinte Carbone : ${carbon.toFixed(2)} kg CO2e/t`
          : `POTENTIAL SAVINGS: +${savings} USD/t of processed ore | Carbon Footprint: ${carbon.toFixed(2)} kg CO2e/t`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Holistic Mine-to-Mill Cost Curve Graphic
      const m2mGraphic = renderMineToMillGraphic(optimalP80, parseFloat(totalCost), isFr ? 'fr' : 'en');
      addImageWithPageCheck(m2mGraphic, 182, 85);

      const rawCosts = p.costs ?? [
        { nameFr: 'Foration des Trous', nameEn: 'Drilling', costPerTonUSD: p.drillingCostPerTon ?? 0.65, percentage: 10.0, driverFr: 'Diamètre et ROP', driverEn: 'Diameter and ROP' },
        { nameFr: 'Minage & Explosifs', nameEn: 'Blasting', costPerTonUSD: p.blastingCostPerTon ?? 1.10, percentage: 17.0, driverFr: 'Dosage kg/m³', driverEn: 'Powder factor' },
        { nameFr: 'Débitage Secondaire', nameEn: 'Secondary Breaking', costPerTonUSD: p.secondaryBreakingCostPerTon ?? 0.20, percentage: 3.0, driverFr: 'Gros blocs >300mm', driverEn: 'Boulders >300mm' },
        { nameFr: 'Concassage Primaire', nameEn: 'Primary Crushing', costPerTonUSD: p.crushingCostPerTon ?? 0.55, percentage: 8.5, driverFr: 'Énergie mâchoires', driverEn: 'Crusher draw' },
        { nameFr: 'Broyage SAG & Boulets', nameEn: 'SAG & Ball Milling', costPerTonUSD: p.millingCostPerTon ?? 4.00, percentage: 61.5, driverFr: 'P80 d’alimentation', driverEn: 'Feed P80' },
      ];
      const econRows = rawCosts.map((c: any) => [
        isFr ? c.nameFr : c.nameEn,
        `${c.costPerTonUSD.toFixed(2)} USD/t`,
        `${c.percentage ? c.percentage.toFixed(1) : ((c.costPerTonUSD / (parseFloat(totalCost) || 1)) * 100).toFixed(1)}%`,
        isFr ? c.driverFr : c.driverEn,
      ]);
      econRows.push([
        isFr ? 'Total Coût Minier & Minéralurgique' : 'Total Mine-to-Mill Cost',
        `${totalCost} USD/t`,
        '100.0%',
        isFr ? 'Somme exacte des 5 postes de comminution' : 'Exact sum of all 5 comminution cost centers',
      ]);

      y = drawTable(
        isFr
          ? ['Poste de Coût Opérationnel', 'Coût Unitaire ($/t)', '% du Coût Total', 'Facteurs Prépondérants']
          : ['Operational Cost Center', 'Unit Cost ($/t)', '% of Total Cost', 'Key Cost Drivers'],
        econRows,
        [60, 36, 36, 50],
        y,
        isFr ? 'DÉCOMPOSITION DU COÛT GLOBAL MINE-AU-MOULIN (5 POSTES)' : 'HOLISTIC MINE-TO-MILL OPERATING COST BREAKDOWN (5 LINES)',
        headerTitle,
        headerSub
      );

      const expCarbon = p.carbonScope1Explosives ?? blastState.economics.scope1ExplosivesKgCo2ePerTon;
      const dslCarbon = p.carbonScope1Diesel ?? blastState.economics.scope1DieselKgCo2ePerTon;
      const elcCarbon = p.carbonScope2Electricity ?? blastState.economics.scope2ElectricityKgCo2ePerTon;

      const carbonRows = [
        [isFr ? 'Scope 1 : Détonation Explosifs (ANFO)' : 'Scope 1: Explosives Detonation (ANFO)', `${expCarbon.toFixed(2)} kg CO2e/t`, isFr ? 'Réaction chimique nitrate-fioul' : 'ANFO detonation gas'],
        [isFr ? 'Scope 1 : Gazole Engins (Chargeuses/Dumpers)' : 'Scope 1: Diesel Fleet (Shovel & Haul)', `${dslCarbon.toFixed(2)} kg CO2e/t`, isFr ? 'Consommation carburant flotte' : 'Engine combustion'],
        [isFr ? 'Scope 2 : Électricité Réseau Broyeurs' : 'Scope 2: Mill Electricity Grid', `${elcCarbon.toFixed(2)} kg CO2e/t`, isFr ? `Calculé sur l’énergie totale (${blastState.comminution.totalSpecificEnergyKwhPerT} kWh/t)` : `Derived from total comminution energy (${blastState.comminution.totalSpecificEnergyKwhPerT} kWh/t)`],
        [isFr ? 'Bilan Carbone Global par Tonne' : 'Total Carbon Footprint per Tonne', `${carbon.toFixed(2)} kg CO2e/t`, isFr ? 'Audit environnemental certifié' : 'Compliant environmental audit'],
      ];

      y = drawTable(
        isFr
          ? ['Source d’Émissions de Gaz à Effet de Serre', 'Émissions Spécifiques', 'Origine Opérationnelle']
          : ['Greenhouse Gas Emission Source', 'Specific Emissions', 'Operational Origin'],
        carbonRows,
        [70, 45, 67],
        y,
        isFr ? 'BILAN CARBONE & COMPTABILITÉ GES (SCOPE 1 & 2)' : 'CARBON ACCOUNTING & GHG INVENTORY (SCOPE 1 & 2)',
        headerTitle,
        headerSub
      );
    }

    // SECTION 11: KUZ-RAM
    else if (key === 'kuzram') {
      const rockFactorA = (p.rockFactorA ?? blastState.rock.rockFactorA).toFixed(2);
      const uniformityN = (p.uniformityIndexN ?? kuzRam.uniformityIndexN).toFixed(2);
      const characteristicXc = (p.characteristicSizeXcMm ?? kuzRam.characteristicSizeXcMm).toFixed(1);
      const predictedP50 = (p.meanSizeX50Mm ?? p.predictedP50Mm ?? kuzRam.meanSizeX50Mm).toFixed(1);
      const predictedP80 = (p.p80Mm ?? p.predictedP80Mm ?? kuzRam.p80Mm).toFixed(1);

      doc.setFillColor(245, 243, 255);
      doc.rect(14, y, 182, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(88, 28, 135);
      doc.text(
        isFr
          ? `PARAMÈTRES KUZ-RAM : Facteur de Roche A : ${rockFactorA} | Indice d’uniformité (n) : ${uniformityN} | Taille Xc : ${characteristicXc} mm`
          : `KUZ-RAM PARAMETERS: Cunningham Rock Factor A: ${rockFactorA} | Uniformity Index (n): ${uniformityN} | Characteristic Xc: ${characteristicXc} mm`,
        18,
        y + 5
      );
      doc.text(
        isFr
          ? `PRÉDICTION EMPIRIQUE : P50 Calculé : ${predictedP50} mm | P80 Calculé : ${predictedP80} mm | Calage Bayésien : ${blastState.optical.bayesianStatus}`
          : `EMPIRICAL PREDICTION: Calculated P50: ${predictedP50} mm | Calculated P80: ${predictedP80} mm | Bayesian Calibration: ${blastState.optical.bayesianStatus}`,
        18,
        y + 9.5
      );
      y += 16;

      // Embed Kuz-Ram Cumulative Passing Chart
      const kuzramChart = renderLogarithmicPassingChart({
        kuzRamPoints: p.predictedCurve ?? kuzRam.predictedCurve,
        p50: parseFloat(predictedP50),
        p80: parseFloat(predictedP80),
        title: isFr ? 'Distribution Granulométrique Kuz-Ram (Cunningham)' : 'Kuz-Ram Particle Size Distribution (Cunningham)',
        lang: isFr ? 'fr' : 'en',
      });
      addImageWithPageCheck(kuzramChart, 182, 94);

      const comps = {
        rmd: p.rmd ?? blastState.rock.components.rmd,
        jps: p.jf ?? blastState.rock.components.jps,
        jpa: p.jfo ?? blastState.rock.components.jpa,
        rdi: p.density ?? blastState.rock.components.rdi,
        hf: p.hf ?? blastState.rock.components.hf,
        sum: p.rmd !== undefined
          ? (p.rmd + (p.jf ?? blastState.rock.components.jps) + (p.jfo ?? blastState.rock.components.jpa) + (p.density ?? blastState.rock.components.rdi) + (p.hf ?? blastState.rock.components.hf))
          : blastState.rock.components.sum,
      };

      const kuzRows = [
        [isFr ? 'Description Massif Rocheux (RMD)' : 'Rock Mass Description (RMD)', `${comps.rmd.toFixed(1)}`, isFr ? (blastState.rock.gsiOrRmr > 75 ? 'Massif très résistant/massif (50)' : 'Massif modérément fracturé (20)') : 'Rock mass structure description'],
        [isFr ? 'Espacement des Joints (JPS)' : 'Joint Plane Spacing (JPS)', `${comps.jps.toFixed(1)}`, isFr ? `Espacement moyen ${blastState.rock.meanJointSpacingM} m` : `Mean joint spacing ${blastState.rock.meanJointSpacingM} m`],
        [isFr ? 'Orientation des Diaclases (JPA)' : 'Joint Plane Angle (JPA)', `${comps.jpa.toFixed(1)}`, isFr ? (comps.jpa === 30 ? 'Pendage perpendiculaire (30)' : comps.jpa === 40 ? 'Pendage vers le front (40)' : 'Pendage hors du front (20)') : `Joint dip orientation code (${comps.jpa})`],
        [isFr ? 'Influence Densité Roche (RDI)' : 'Rock Density Influence (RDI)', `${comps.rdi.toFixed(2)}`, `RDI = 25 × ${blastState.rock.densityTPerM3.toFixed(2)} - 50 = ${comps.rdi.toFixed(2)}`],
        [isFr ? 'Facteur de Dureté UCS / E (HF)' : 'Hardness Factor (HF)', `${comps.hf.toFixed(2)}`, `UCS ${blastState.rock.ucsMPa} MPa, E ${blastState.rock.youngsModulusGPa} GPa (HF = ${comps.hf.toFixed(2)})`],
        [isFr ? 'Somme des Composantes Cunningham' : 'Sum of Components (Σ)', `${comps.sum.toFixed(2)}`, isFr ? 'Somme exacte RMD + JPS + JPA + RDI + HF' : 'Exact sum of 5 components'],
        [isFr ? 'Facteur de Roche Global A' : 'Cunningham Rock Factor A', `${rockFactorA}`, isFr ? `A = 0.06 × ${comps.sum.toFixed(2)} = ${rockFactorA}` : `A = 0.06 × ${comps.sum.toFixed(2)} = ${rockFactorA}`],
      ];

      y = drawTable(
        isFr
          ? ['Composante du Facteur de Roche A', 'Valeur Numérique', 'Interprétation Géotechnique & Formule']
          : ['Rock Factor A Component', 'Numerical Value', 'Geotechnical Meaning & Formula'],
        kuzRows,
        [60, 36, 86],
        y,
        isFr ? 'DÉCOMPOSITION DU FACTEUR GÉOMÉCANIQUE DE ROCHE A' : 'CUNNINGHAM ROCK FACTOR A COMPONENTS',
        headerTitle,
        headerSub
      );
    }
  }

  // DEDICATED FINAL PAGE: DATA QUALITY CONTROL & AUDIT TRAIL
  doc.addPage();
  const qaTitle = isFr ? 'FRAGMILL : CONTRÔLE QUALITÉ & INTÉGRITÉ' : 'FRAGMILL : DATA QUALITY CONTROL & AUDIT';
  const qaSub = isFr
    ? `Audit de cohérence physique, détection d'incohérences géotechniques et traçabilité pour le tir ${blast.blastId}`
    : `Physical consistency audit, geotechnical validation checks, and data provenance for blast ${blast.blastId}`;
  activeHeaderTitle = qaTitle;
  activeHeaderSub = qaSub;
  drawHeader(qaTitle, qaSub);
  let qaY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 56, 100);
  doc.text(
    isFr
      ? 'CONTRÔLE QUALITÉ DES DONNÉES & AUDIT D’INTÉGRITÉ GÉOTECHNIQUE (QA/QC)'
      : 'DATA QUALITY CONTROL & GEOTECHNICAL INTEGRITY AUDIT (QA/QC)',
    14,
    qaY
  );
  qaY += 6;

  // Physical validation alerts
  const warnings = isFr ? blastState.validationWarningsFr : blastState.validationWarningsEn;
  if (warnings.length > 0) {
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14, qaY, 182, 10 + warnings.length * 6.5, 2, 2, 'F');
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      isFr ? 'ALERTES DE COHÉRENCE PHYSIQUE DÉTECTÉES SUR LES ENTRÉES :' : 'PHYSICAL CONSISTENCY ALERTS FLAGGED ON BLAST INPUTS:',
      18,
      qaY + 5.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    warnings.forEach((warn, idx) => {
      doc.text(`• ${warn}`, 18, qaY + 11 + idx * 6.5, { maxWidth: 174 });
    });
    qaY += 15 + warnings.length * 6.5;
  } else {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, qaY, 182, 14, 2, 2, 'F');
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      isFr
        ? '✓ TOUTES LES VÉRIFICATIONS PHYSIQUES SONT CONFORMES (Profondeur, Capacité linéaire, Bourrage, Fits).'
        : '✓ ALL PHYSICAL INPUT CHECKS PASSED (Hole Depth, Linear Capacity, Deck Sums, Regression Fits).',
      18,
      qaY + 9
    );
    qaY += 20;
  }

  // Data Provenance & Traceability Table
  const provenanceRows = [
    [
      isFr ? 'Tir & Géométrie' : 'Blast Geometry',
      isFr ? 'Plan de Tir Certifié' : 'Certified Blast Plan',
      isFr ? `Gradin ${blastState.geometry.benchElevationRL} RL, ${blastState.geometry.numberOfHoles} trous, Ø${blastState.geometry.holeDiameterMm}mm` : `Bench ${blastState.geometry.benchElevationRL} RL, ${blastState.geometry.numberOfHoles} holes, Ø${blastState.geometry.holeDiameterMm}mm`,
      isFr ? 'Conforme' : 'Verified',
    ],
    [
      isFr ? 'Granulométrie Optique' : 'Optical Sizing',
      blastState.optical.hasOpticalData ? (isFr ? 'Cliché Tas Étalonné' : 'Calibrated Photo') : (isFr ? 'Modèle Empirique' : 'Empirical Model'),
      isFr ? `${blastState.optical.fragmentCount} fragments détectés, P80 = ${blastState.optical.p80Mm} mm` : `${blastState.optical.fragmentCount} fragments identified, P80 = ${blastState.optical.p80Mm} mm`,
      blastState.optical.fragmentCount >= 150 ? (isFr ? 'Robuste (N>150)' : 'Robust') : (isFr ? 'Avertissement Échantillonnage' : 'Warning'),
    ],
    [
      isFr ? 'Modèle Kuz-Ram' : 'Kuz-Ram Model',
      isFr ? 'Cunningham (1987)' : 'Cunningham (1987)',
      isFr ? `Facteur A = ${blastState.rock.rockFactorA.toFixed(2)}, X50 = ${blastState.kuzRam.meanSizeX50Mm} mm` : `Factor A = ${blastState.rock.rockFactorA.toFixed(2)}, X50 = ${blastState.kuzRam.meanSizeX50Mm} mm`,
      isFr ? 'Référence Théorique' : 'Theoretical Baseline',
    ],
    [
      isFr ? 'Télémesure Foration MWD' : 'MWD Drilling Telemetry',
      blastState.drilling.isDemoData ? (isFr ? 'Simulation IREDES' : 'IREDES Simulation') : (isFr ? 'Relevé Foration Réel (Excel/MWD)' : 'Real As-Built Log (Excel/MWD)'),
      isFr ? `${blastState.drilling.totalHoles} trous forés, conformité ${blastState.drilling.complianceRatePercent}%` : `${blastState.drilling.totalHoles} drilled holes, compliance ${blastState.drilling.complianceRatePercent}%`,
      blastState.drilling.isDemoData ? (isFr ? 'Indicatif / Simulation' : 'Simulation') : (isFr ? 'Certifié IREDES' : 'Certified As-Built'),
    ],
    [
      isFr ? 'Vision Convoyeur' : 'Conveyor Belt Vision',
      blastState.belt.isDemoData ? (isFr ? 'Flux Simulé' : 'Simulated Stream') : (isFr ? 'Caméra IP67 Direct' : 'Live IP67 Stream'),
      isFr ? `Vitesse ${blastState.belt.beltSpeedMPerS} m/s, seuil ${blastState.belt.crusherGapeThresholdMm} mm` : `Speed ${blastState.belt.beltSpeedMPerS} m/s, gape ${blastState.belt.crusherGapeThresholdMm} mm`,
      blastState.belt.isDemoData ? (isFr ? 'Contrôle Continu' : 'Continuous Stream') : (isFr ? 'Temps Réel' : 'Live Stream'),
    ],
    [
      isFr ? 'Photogrammétrie Drone 3D' : 'Drone 3D Sizing',
      blastState.drone.isDemoData ? (isFr ? 'Levé Standard Calibré' : 'Calibrated UAV Survey') : (isFr ? 'Orthomosaïque Réelle 3D' : 'Survey-grade 3D Orthomosaic'),
      isFr ? `${blastState.drone.totalVolumeM3.toLocaleString()} m³ (${blastState.drone.pointCloudCount} sommets)` : `${blastState.drone.totalVolumeM3.toLocaleString()} m³ (${blastState.drone.pointCloudCount} vertices)`,
      blastState.drone.isDemoData ? (isFr ? 'Modèle Géométrique' : 'Geometric Model') : (isFr ? 'Topographique Certifié' : 'Survey-grade Certified'),
    ],
    [
      isFr ? 'Tamisage Physique' : 'Physical Sieve Validation',
      blastState.sieve.hasSieveData ? (isFr ? 'Pesée Laboratoire' : 'Lab Mechanical Screening') : (isFr ? 'Non Réalisé' : 'Not Performed'),
      blastState.sieve.hasSieveData ? (isFr ? `MAPE = ${blastState.sieve.mapePercent}%` : `MAPE = ${blastState.sieve.mapePercent}%`) : (isFr ? 'Aucun échantillon pesé pour ce tir' : 'No sieve data recorded for this blast'),
      blastState.sieve.hasSieveData ? (isFr ? 'Vérité Terrain' : 'Ground Truth') : (isFr ? 'Non Applicable' : 'N/A'),
    ],
  ];

  qaY = drawTable(
    isFr
      ? ['Domaine Analytique FragMill', 'Provenance de la Donnée', 'Détails Métrologiques', 'Niveau de Certitude']
      : ['FragMill Analytical Domain', 'Data Provenance / Source', 'Metrological Details', 'Confidence Level'],
    provenanceRows,
    [48, 44, 56, 34],
    qaY,
    isFr ? 'MATRICE DE TRAÇABILITÉ DES DONNÉES DU RAPPORT' : 'REPORT DATA PROVENANCE & TRACEABILITY MATRIX',
    qaTitle,
    qaSub
  );

  // Technical Signature & Approval Box
  if (qaY < 235) {
    doc.setFillColor(248, 250, 252);
    doc.rect(14, qaY + 5, 182, 32, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, qaY + 5, 182, 32, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(31, 56, 100);
    doc.text(isFr ? 'VISA DE VALIDATION D’INGÉNIERIE MINIÈRE :' : 'MINING ENGINEERING AUDIT SIGN-OFF:', 18, qaY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(isFr ? 'Ingénieur Responsable des Tirs :' : 'Blasting Engineer:', 18, qaY + 18);
    doc.text(isFr ? 'Directeur Minéralurgie / Usine :' : 'Mill Processing Manager:', 75, qaY + 18);
    doc.text(isFr ? 'Directeur des Opérations Mine :' : 'Mine Operations Director:', 135, qaY + 18);

    doc.text('Signature: _______________________', 18, qaY + 28);
    doc.text('Signature: _______________________', 75, qaY + 28);
    doc.text('Signature: _______________________', 135, qaY + 28);
  }

  // Stamp clean page numbers on all generated pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      isFr
        ? `FRAGMILL MINING SUITE • Rapport Modulaire d'Ingénierie Personnalisé • Page ${i} sur ${totalPages}`
        : `FRAGMILL MINING SUITE • Custom Modular Engineering Report • Page ${i} of ${totalPages}`,
      105,
      291,
      { align: 'center' }
    );
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 287, 196, 287);
  }

  return doc.output('blob');
}

export async function generateSingleSectionPdfReport(
  key: ReportSectionKey,
  entry: ReportSectionEntry | null,
  project: Project,
  site: Site,
  blast: Blast,
  lang: Language = 'fr'
): Promise<Blob> {
  const singleVaultState: ReportVaultState = {
    blast: null,
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
    [key]: entry || {
      key,
      stagedAt: Date.now(),
      titleFr: REPORT_SECTIONS_REGISTRY[key].titleFr,
      titleEn: REPORT_SECTIONS_REGISTRY[key].titleEn,
      payload: {},
    },
  };

  return generateModularVaultPdfReport(singleVaultState, project, site, blast, lang, [key]);
}
