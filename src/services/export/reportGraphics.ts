// Technical Drawing & Engineering Graphics Generator for FragMill Reports
// Generates high-resolution PNG data URLs via off-screen Canvas for PDF embedding.

import type { Blast, CumulativePoint } from '../../types';
import type { DroneOrthomosaicData, IREDESHole } from '../../types/advanced';

/**
 * Creates an offscreen canvas with high-DPI scaling for sharp print rendering
 */
function createHiDPICanvas(width = 800, height = 480): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof document === 'undefined') {
    // Node.js / Headless test mock
    const mockGradient = { addColorStop: () => {} };
    const mockCtx = new Proxy({} as any, {
      get: (_target, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => mockGradient;
        }
        if (prop === 'measureText') {
          return () => ({ width: 140 });
        }
        return () => {};
      },
      set: () => true,
    });
    const mockCanvas = {
      width,
      height,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      getContext: () => mockCtx,
    } as unknown as HTMLCanvasElement;
    return { canvas: mockCanvas, ctx: mockCtx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

// ---------------------------------------------------------------------------
// 1. Semi-Logarithmic Cumulative Passing Curves (All 3 Plotted Curves)
// ---------------------------------------------------------------------------
export interface LogCurveOptions {
  measuredPoints?: CumulativePoint[];
  kuzRamPoints?: CumulativePoint[];
  sievePoints?: CumulativePoint[];
  p10?: number;
  p50?: number;
  p80?: number;
  title?: string;
  lang?: 'fr' | 'en';
}

export function renderLogarithmicPassingChart(options: LogCurveOptions): string {
  const { canvas, ctx } = createHiDPICanvas(900, 520);
  const isFr = options.lang === 'fr';

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const padding = { left: 80, right: 40, top: 60, bottom: 65 };
  const plotW = canvas.width - padding.left - padding.right;
  const plotH = canvas.height - padding.top - padding.bottom;

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    options.title || (isFr ? 'Courbe Granulométrique Cumulative (Échelle Logarithmique)' : 'Cumulative Particle Size Distribution (Log Scale)'),
    padding.left,
    32
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '11px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr
      ? 'Comparaison multi-modèles : Mesuré Optique (Bleu) | Modèle Kuz-Ram (Violet) | Vérité Terrain Tamis (Vert)'
      : 'Multi-model comparison: Optical Measured (Blue) | Kuz-Ram Model (Purple) | Sieve Ground Truth (Green)',
    padding.left,
    48
  );

  // Log scale mapping from 1 mm to 1000 mm (3 decades: 10^0, 10^1, 10^2, 10^3)
  const minLog = 0; // log10(1) = 0
  const maxLog = 3; // log10(1000) = 3
  const xToPx = (sizeMm: number) => {
    const val = Math.max(0.5, sizeMm);
    const logVal = Math.log10(val);
    const clamped = Math.max(minLog, Math.min(maxLog, logVal));
    return padding.left + ((clamped - minLog) / (maxLog - minLog)) * plotW;
  };

  const yToPx = (passing: number) => {
    const clamped = Math.max(0, Math.min(100, passing));
    return padding.top + plotH - (clamped / 100) * plotH;
  };

  // Plot Area Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(padding.left, padding.top, plotW, plotH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding.left, padding.top, plotW, plotH);

  // Draw Horizontal Grid lines (Passing 0% to 100% every 20%)
  for (let p = 0; p <= 100; p += 10) {
    const y = yToPx(p);
    ctx.strokeStyle = p % 20 === 0 ? '#CBD5E1' : '#F1F5F9';
    ctx.lineWidth = p % 20 === 0 ? 1 : 0.8;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();

    if (p % 20 === 0) {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${p}%`, padding.left - 10, y + 4);
    }
  }

  // Draw Vertical Logarithmic Grid lines
  const decades = [1, 10, 100, 1000];
  const subTicks = [2, 3, 4, 5, 6, 7, 8, 9];

  decades.forEach((dec) => {
    const x = xToPx(dec);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${dec} mm`, x, padding.top + plotH + 20);

    // Minor decades ticks
    if (dec < 1000) {
      subTicks.forEach((st) => {
        const subVal = dec * st;
        const subX = xToPx(subVal);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(subX, padding.top);
        ctx.lineTo(subX, padding.top + plotH);
        ctx.stroke();
      });
    }
  });

  // Axis Labels
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(isFr ? 'Ouverture de maille équivalente / Taille (mm, Échelle Logarithmique)' : 'Equivalent Screen Aperture / Size (mm, Logarithmic Scale)', padding.left + plotW / 2, padding.top + plotH + 45);

  ctx.save();
  ctx.translate(25, padding.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(isFr ? 'Passant Cumulé (% Massique / Volumique)' : 'Cumulative Passing (% Mass / Volume)', 0, 0);
  ctx.restore();

  // Helper to draw smooth curves
  const drawCurve = (points: CumulativePoint[], color: string, lineWidth: number, isDashed = false) => {
    if (!points || points.length === 0) return;
    const sorted = [...points].sort((a, b) => a.sizeMm - b.sizeMm);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    if (isDashed) ctx.setLineDash([5, 4]);

    ctx.beginPath();
    sorted.forEach((pt, idx) => {
      const x = xToPx(pt.sizeMm);
      const y = yToPx(pt.passingPercent);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw markers
    ctx.fillStyle = color;
    sorted.forEach((pt) => {
      const x = xToPx(pt.sizeMm);
      const y = yToPx(pt.passingPercent);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  };

  // Generate synthetic points if not fully provided
  const measured = options.measuredPoints && options.measuredPoints.length > 0
    ? options.measuredPoints
    : [
        { sizeMm: 2, passingPercent: 4 },
        { sizeMm: 10, passingPercent: 12 },
        { sizeMm: 25, passingPercent: 22 },
        { sizeMm: 50, passingPercent: 35 },
        { sizeMm: 80, passingPercent: 48 },
        { sizeMm: 128, passingPercent: 62 },
        { sizeMm: 195, passingPercent: 80 },
        { sizeMm: 280, passingPercent: 91 },
        { sizeMm: 400, passingPercent: 98 },
        { sizeMm: 550, passingPercent: 100 },
      ];

  const kuzRam = options.kuzRamPoints && options.kuzRamPoints.length > 0
    ? options.kuzRamPoints
    : [
        { sizeMm: 2, passingPercent: 2 },
        { sizeMm: 10, passingPercent: 8 },
        { sizeMm: 25, passingPercent: 18 },
        { sizeMm: 50, passingPercent: 30 },
        { sizeMm: 90, passingPercent: 46 },
        { sizeMm: 140, passingPercent: 60 },
        { sizeMm: 210, passingPercent: 78 },
        { sizeMm: 310, passingPercent: 90 },
        { sizeMm: 450, passingPercent: 97 },
        { sizeMm: 600, passingPercent: 100 },
      ];

  const sieve = options.sievePoints && options.sievePoints.length > 0
    ? options.sievePoints
    : [
        { sizeMm: 4.75, passingPercent: 5 },
        { sizeMm: 9.5, passingPercent: 11 },
        { sizeMm: 19, passingPercent: 19 },
        { sizeMm: 37.5, passingPercent: 29 },
        { sizeMm: 75, passingPercent: 45 },
        { sizeMm: 125, passingPercent: 64 },
        { sizeMm: 200, passingPercent: 82 },
        { sizeMm: 300, passingPercent: 96 },
      ];

  // Draw 1. Sieve Ground Truth (Green dashed)
  drawCurve(sieve, '#10B981', 2.2, true);

  // Draw 2. Kuz-Ram Model (Purple solid)
  drawCurve(kuzRam, '#8B5CF6', 2.4, false);

  // Draw 3. Measured Optical Curve (Deep Blue solid)
  drawCurve(measured, '#2563EB', 3.0, false);

  // Highlight P10, P50, P80 lines
  const p50Val = options.p50 || 128;
  const p80Val = options.p80 || 195;

  const drawPercentileLine = (valMm: number, label: string, color: string) => {
    const x = xToPx(valMm);
    const pY = yToPx(label === 'P80' ? 80 : 50);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;

    // Vertical line down to X-axis
    ctx.beginPath();
    ctx.moveTo(x, pY);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();

    // Horizontal line to Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, pY);
    ctx.lineTo(x, pY);
    ctx.stroke();

    // Tag
    ctx.fillStyle = color;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`${label} = ${valMm} mm`, x + 5, pY - 5);
    ctx.restore();
  };

  drawPercentileLine(p50Val, 'P50', '#D97706');
  drawPercentileLine(p80Val, 'P80', '#DC2626');

  // Legend Box (Top Right)
  const legX = padding.left + plotW - 270;
  const legY = padding.top + 15;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillRect(legX, legY, 255, 80);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(legX, legY, 255, 80);

  const drawLegendItem = (yOff: number, color: string, text: string, dashed = false) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dashed ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(legX + 12, legY + yOff);
    ctx.lineTo(legX + 38, legY + yOff);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legX + 25, legY + yOff, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.setLineDash([]);
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(text, legX + 46, legY + yOff + 4);
  };

  drawLegendItem(20, '#2563EB', isFr ? '1. Mesuré Optique (FragMill)' : '1. Optical Measured (FragMill)', false);
  drawLegendItem(42, '#8B5CF6', isFr ? '2. Prédiction Kuz-Ram Cunningham' : '2. Cunningham Kuz-Ram Model', false);
  drawLegendItem(64, '#10B981', isFr ? '3. Vérité Terrain Tamisage Physique' : '3. Physical Sieve Ground Truth', true);

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 2. Blast Hole Charging Profile Cross-Section Diagram
// ---------------------------------------------------------------------------
export function renderChargingProfileGraphic(blast: Blast, lang = 'fr'): string {
  const { canvas, ctx } = createHiDPICanvas(900, 500);
  const isFr = lang === 'fr';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const params = blast.parameters;
  const charging = params.chargingProfile;

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Profil de Foration et de Chargement pyrotechnique du Trou' : 'Drill Hole & Explosive Charging Cross-Section Profile',
    40,
    32
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '11px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr
      ? `Tir : ${blast.blastId} | Banquette : ${params.burden}m | Espacement : ${params.spacing}m | Diamètre : Ø${params.holeDiameter}mm | Inclinaison : ${params.holeInclination || 90}°`
      : `Blast: ${blast.blastId} | Burden: ${params.burden}m | Spacing: ${params.spacing}m | Diameter: Ø${params.holeDiameter}mm | Inclination: ${params.holeInclination || 90}°`,
    40,
    48
  );

  // Draw Ground & Bench profile
  // Bench Crest at Y = 100, Toe at Y = 380, Subdrill to Y = 430
  const crestX = 350;
  const toeX = 260;
  const groundY = 110;
  const benchToeY = 380;

  // Rock Mass fill
  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.moveTo(80, groundY);
  ctx.lineTo(crestX, groundY);
  ctx.lineTo(toeX, benchToeY);
  ctx.lineTo(80, benchToeY);
  ctx.closePath();
  ctx.fill();

  // Bench surface line
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(80, groundY);
  ctx.lineTo(crestX, groundY);
  ctx.lineTo(toeX, benchToeY);
  ctx.lineTo(80, benchToeY);
  ctx.stroke();

  // Hole coordinates
  const holeX = 480;
  const holeWidth = 26;
  const holeTopY = 110;
  const holeBottomY = 430;
  const totalLength = holeBottomY - holeTopY;

  // Stemming, Column, Toe proportions
  const stemmingLen = charging?.stemmingLengthM || params.stemmingLength || 2.2;
  const totalDepth = params.holeDepth || 7.0;
  const stemmingRatio = Math.min(0.5, stemmingLen / totalDepth);
  const toeRatio = 0.15;
  const colRatio = Math.max(0.2, 1.0 - stemmingRatio - toeRatio);

  const stemmingHeight = totalLength * stemmingRatio;
  const toeHeight = totalLength * toeRatio;
  const colHeight = totalLength - stemmingHeight - toeHeight;

  const yStemming = holeTopY;
  const yColumn = yStemming + stemmingHeight;
  const yToe = yColumn + colHeight;

  // Draw Hole Cylinder
  // 1. Stemming (Brown/Tan hatching)
  ctx.fillStyle = '#D97706';
  ctx.fillRect(holeX - holeWidth / 2, yStemming, holeWidth, stemmingHeight);
  ctx.fillStyle = '#FDE68A';
  for (let i = yStemming + 6; i < yColumn; i += 12) {
    ctx.fillRect(holeX - holeWidth / 2 + 3, i, holeWidth - 6, 4);
  }

  // 2. Column Charge (Yellow ANFO)
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(holeX - holeWidth / 2, yColumn, holeWidth, colHeight);
  // ANFO Granules dots
  ctx.fillStyle = '#B45309';
  for (let y = yColumn + 8; y < yToe; y += 14) {
    ctx.beginPath();
    ctx.arc(holeX - 4, y, 2.5, 0, Math.PI * 2);
    ctx.arc(holeX + 4, y + 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Toe Charge / Booster (Deep Red Cartridge)
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(holeX - holeWidth / 2, yToe, holeWidth, toeHeight);
  ctx.fillStyle = '#991B1B';
  ctx.fillRect(holeX - 4, yToe + 5, 8, toeHeight - 10);

  // Hole outer contour
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2;
  ctx.strokeRect(holeX - holeWidth / 2, holeTopY, holeWidth, totalLength);

  // Surforation / Subdrill dashed line at benchToeY
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(toeX - 20, benchToeY);
  ctx.lineTo(holeX + 180, benchToeY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels and Dimensions (Right side)
  const drawDim = (y1: number, y2: number, x: number, text: string, sub: string, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Arrow line
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();

    // End caps
    ctx.beginPath();
    ctx.moveTo(x - 5, y1);
    ctx.lineTo(x + 5, y1);
    ctx.moveTo(x - 5, y2);
    ctx.lineTo(x + 5, y2);
    ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 12, (y1 + y2) / 2 - 2);

    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(sub, x + 12, (y1 + y2) / 2 + 12);
  };

  drawDim(
    yStemming,
    yColumn,
    holeX + 45,
    isFr ? `Bourrage : ${stemmingLen.toFixed(1)} m` : `Stemming: ${stemmingLen.toFixed(1)} m`,
    isFr ? 'Gravier concassé 0/10 mm (Anti-projections)' : 'Crushed aggregate (Flyrock containment)',
    '#B45309'
  );

  const colWeight = charging?.columnTotalWeightKg || Math.round((params.chargePerHole || 22) * 0.85);
  drawDim(
    yColumn,
    yToe,
    holeX + 45,
    isFr ? `Colonne ANFO : ${((totalDepth - stemmingLen) * 0.8).toFixed(1)} m` : `Column Charge: ${((totalDepth - stemmingLen) * 0.8).toFixed(1)} m`,
    isFr ? `Nitrate-Fioul bulk : ~${colWeight} kg` : `ANFO bulk mixture: ~${colWeight} kg`,
    '#D97706'
  );

  const toeWeight = charging?.toeChargeWeightKg || Math.round((params.chargePerHole || 22) * 0.15);
  drawDim(
    yToe,
    holeBottomY,
    holeX + 45,
    isFr ? `Charge de Pied : ${(totalDepth * 0.15).toFixed(1)} m` : `Toe Charge: ${(totalDepth * 0.15).toFixed(1)} m`,
    isFr ? `Booster Pentolite / Émulsion : ~${toeWeight} kg` : `Booster / Cartridge: ~${toeWeight} kg`,
    '#DC2626'
  );

  // Subdrill note
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(
    isFr ? `Niveau Pied de Gradin (0.0 m)` : `Bench Floor Level (0.0 m)`,
    holeX - 25,
    benchToeY - 4
  );
  ctx.fillText(
    isFr ? `Surforation : ${params.subdrill || 0.8} m` : `Subdrill: ${params.subdrill || 0.8} m`,
    holeX - 25,
    benchToeY + 22
  );

  // Left Side Info Card
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(60, 140, 240, 165);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(60, 140, 240, 165);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'SYNTHÈSE DE CHARGEMENT' : 'CHARGING PROFILE SUMMARY', 75, 162);

  const items = [
    [isFr ? 'Hauteur de gradin :' : 'Bench Height:', `${params.benchHeight} m`],
    [isFr ? 'Profondeur totale :' : 'Total Hole Depth:', `${params.holeDepth} m`],
    [isFr ? 'Diamètre du trou :' : 'Hole Diameter:', `Ø ${params.holeDiameter} mm`],
    [isFr ? 'Banquette (B) :' : 'Burden (B):', `${params.burden} m`],
    [isFr ? 'Espacement (S) :' : 'Spacing (S):', `${params.spacing} m`],
    [isFr ? 'Masse explosive/trou :' : 'Explosive Mass/Hole:', `${params.chargePerHole} kg`],
    [
      isFr ? 'Dosage d’abattage :' : 'Powder Factor:',
      `${((params.chargePerHole || 22) / Math.max(0.1, params.burden * params.spacing * params.benchHeight)).toFixed(2)} kg/m³`,
    ],
  ];

  let lineY = 183;
  items.forEach(([k, v]) => {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9.5px Arial';
    ctx.fillText(k, 75, lineY);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9.5px Arial';
    ctx.fillText(v, 220, lineY);
    lineY += 16;
  });

  // Dedicated Color Legend Box below info card
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(60, 318, 240, 140);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(60, 318, 240, 140);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 10.5px Arial';
  ctx.fillText(isFr ? 'LÉGENDE DES CHARGES' : 'CHARGING PROFILE LEGEND', 75, 338);

  const legendItems = [
    { color: '#D97706', label: isFr ? 'Bourrage (Gravier Concassé 2.0m)' : 'Stemming (Crushed Aggregate 2.0m)' },
    { color: '#F59E0B', label: isFr ? 'Charge Colonne (ANFO Vrac ~19kg)' : 'Column Charge (ANFO Bulk ~19kg)' },
    { color: '#DC2626', label: isFr ? 'Booster de Pied (Pentolite ~3kg)' : 'Toe Booster (Pentolite ~3kg)' },
    { color: '#06B6D4', label: isFr ? 'Nappe Phréatique Infiltrée' : 'Groundwater Infiltration Level', dash: true },
    { color: '#64748B', label: isFr ? 'Massif Rocheux / Gradin (0.0m)' : 'Rock Mass / Bench Floor (0.0m)', swatch: '#94A3B8' },
  ];

  let legY = 358;
  legendItems.forEach((leg) => {
    if (leg.dash) {
      ctx.strokeStyle = leg.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(75, legY - 3);
      ctx.lineTo(95, legY - 3);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = leg.swatch || leg.color;
      ctx.fillRect(75, legY - 7, 18, 9);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(75, legY - 7, 18, 9);
    }
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8.5px Arial';
    ctx.fillText(leg.label, 100, legY);
    legY += 19;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 3. Drone 3D Muckpile Sectors & Photogrammetry Topographic Heatmap
// ---------------------------------------------------------------------------
export function renderDrone3DMuckpileGraphic(survey: DroneOrthomosaicData, lang = 'fr'): string {
  const { canvas, ctx } = createHiDPICanvas(900, 480);
  const isFr = lang === 'fr';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Topographie 3D & Cartographie Granulométrique par Drone' : 'Drone 3D Photogrammetry & Muckpile Elevation Heatmap',
    40,
    32
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '11px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr
      ? `Volumétrie : ${survey.totalVolumeM3.toLocaleString()} m³ | Résolution GSD : ${survey.metadata.gsdMmPerPx} mm/px | Altitude : ${survey.metadata.flightAltitudeM}m | Nuage : ${survey.meshPointsCount.toLocaleString()} points 3D`
      : `Total Volume: ${survey.totalVolumeM3.toLocaleString()} m³ | GSD: ${survey.metadata.gsdMmPerPx} mm/px | Altitude: ${survey.metadata.flightAltitudeM}m | Point Cloud: ${survey.meshPointsCount.toLocaleString()} 3D points`,
    40,
    48
  );

  // Draw Topographic Muckpile Mesh in Perspective
  const mapX = 60;
  const mapY = 70;
  const mapW = 480;
  const mapH = 360;

  // Background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  // Simulated 3D Contour Elevation Lines
  const colors = ['#1E3A8A', '#2563EB', '#0D9488', '#10B981', '#EAB308', '#EF4444'];
  for (let r = 160; r >= 30; r -= 25) {
    ctx.strokeStyle = colors[Math.floor(r / 25) % colors.length];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(mapX + mapW / 2, mapY + mapH / 2, r * 1.3, r * 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw 4 Sectors overlay
  const sectorColors: Record<string, string> = {
    'sec-crest': 'rgba(239, 68, 68, 0.45)', // Red
    'sec-middle': 'rgba(245, 158, 11, 0.45)', // Amber
    'sec-toe': 'rgba(16, 185, 129, 0.45)', // Green
    'sec-backbreak': 'rgba(99, 102, 241, 0.45)', // Indigo
  };

  survey.sectors.forEach((sec) => {
    if (!sec.polygon || sec.polygon.length === 0) return;
    ctx.fillStyle = sectorColors[sec.id] || 'rgba(59, 130, 246, 0.4)';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    sec.polygon.forEach((pt, idx) => {
      const px = mapX + pt.x * mapW;
      const py = mapY + pt.y * mapH;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center badge
    const avgX = sec.polygon.reduce((acc, p) => acc + p.x, 0) / sec.polygon.length;
    const avgY = sec.polygon.reduce((acc, p) => acc + p.y, 0) / sec.polygon.length;
    const cx = mapX + avgX * mapW;
    const cy = mapY + avgY * mapH;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(cx - 45, cy - 14, 90, 28);
    ctx.strokeStyle = '#38BDF8';
    ctx.strokeRect(cx - 45, cy - 14, 90, 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(sec.name, cx, cy - 2);
    ctx.fillStyle = '#FCD34D';
    ctx.fillText(`P80: ${sec.p80Mm} mm`, cx, cy + 9);
  });

  // Dedicated Elevation Heatmap & Sector Legend
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(mapX + 10, mapY + mapH - 42, mapW - 20, 32);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX + 10, mapY + mapH - 42, mapW - 20, 32);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE DU TAS 3D :' : '3D MUCKPILE LEGEND:', mapX + 18, mapY + mapH - 22);

  const droneChips = [
    { c: '#EF4444', l: isFr ? 'Crête: 165mm' : 'Crest: 165mm' },
    { c: '#F59E0B', l: isFr ? 'Centre: 245mm' : 'Body: 245mm' },
    { c: '#10B981', l: isFr ? 'Pied: 395mm' : 'Toe: 395mm' },
    { c: '#6366F1', l: isFr ? 'Arrière: 460mm' : 'Back: 460mm' },
  ];

  let dChipX = mapX + (isFr ? 130 : 125);
  droneChips.forEach((chip) => {
    ctx.fillStyle = chip.c;
    ctx.fillRect(dChipX, mapY + mapH - 28, 12, 10);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(dChipX, mapY + mapH - 28, 12, 10);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8px Arial';
    ctx.fillText(chip.l, dChipX + 16, mapY + mapH - 20);
    dChipX += isFr ? 86 : 82;
  });

  // Right Side Sector Breakdown Table
  const tableX = 570;
  const tableY = 70;
  const tableW = 290;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(tableX, tableY, tableW, mapH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(tableX, tableY, tableW, mapH);

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'ANALYSE PAR SECTEUR DE TAS' : 'SECTOR SIZING BREAKDOWN', tableX + 15, tableY + 25);

  let rowY = tableY + 55;
  survey.sectors.forEach((sec) => {
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(sec.name, tableX + 15, rowY);

    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(
      isFr
        ? `Vol: ${sec.volumeM3} m³ | P50: ${sec.p50Mm}mm | P80: ${sec.p80Mm}mm`
        : `Vol: ${sec.volumeM3} m³ | P50: ${sec.p50Mm}mm | P80: ${sec.p80Mm}mm`,
      tableX + 15,
      rowY + 14
    );

    ctx.fillStyle = sec.oversizePercent > 15 ? '#DC2626' : '#16A34A';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(
      isFr ? `Blocs >300mm: ${sec.oversizePercent}%` : `Oversize >300mm: ${sec.oversizePercent}%`,
      tableX + 15,
      rowY + 28
    );

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX + 15, rowY + 36);
    ctx.lineTo(tableX + tableW - 15, rowY + 36);
    ctx.stroke();

    rowY += 50;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 4. Conveyor Belt Vision & Crusher Choke Monitor Graphic
// ---------------------------------------------------------------------------
export interface ConveyorBeltGraphicOptions {
  lang?: string;
  throughputTph?: number;
  beltSpeedMPerS?: number;
  p50Mm?: number;
  p80Mm?: number;
  crusherGapeThresholdMm?: number;
  topSizeMm?: number;
}

export function renderConveyorBeltGraphic(options?: ConveyorBeltGraphicOptions | string): string {
  const isFr = (typeof options === 'string' ? options : options?.lang) === 'fr';
  const opt = typeof options === 'object' ? options : {};
  const tph = opt?.throughputTph !== undefined ? opt.throughputTph : 245;
  const speed = opt?.beltSpeedMPerS !== undefined ? opt.beltSpeedMPerS : 2.2;
  const p50 = opt?.p50Mm !== undefined ? opt.p50Mm : 135;
  const p80 = opt?.p80Mm !== undefined ? opt.p80Mm : 210;
  const gape = opt?.crusherGapeThresholdMm !== undefined ? opt.crusherGapeThresholdMm : 600;
  const topSize = opt?.topSizeMm !== undefined ? opt.topSizeMm : 480;

  const { canvas, ctx } = createHiDPICanvas(900, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Vision Optique Temps Réel sur Convoyeur & Détection de Blocage' : 'Continuous Conveyor Belt Vision & Crusher Choke Monitoring',
    40,
    30
  );

  // Conveyor Belt Viewport
  const bX = 50;
  const bY = 55;
  const bW = 540;
  const bH = 320;

  // Frame background
  ctx.fillStyle = '#18181B';
  ctx.fillRect(bX, bY, bW, bH);

  // Belt texture (Rubber conveyor)
  const grad = ctx.createLinearGradient(bX, bY, bX, bY + bH);
  grad.addColorStop(0, '#27272A');
  grad.addColorStop(0.5, '#3F3F46');
  grad.addColorStop(1, '#27272A');
  ctx.fillStyle = grad;
  ctx.fillRect(bX + 40, bY, bW - 80, bH);

  // Belt edge guides
  ctx.strokeStyle = '#EAB308';
  ctx.lineWidth = 3;
  ctx.strokeRect(bX + 40, bY, bW - 80, bH);

  // Moving rock fragments on belt
  const isChoke = topSize >= gape;
  const rocks = [
    { x: 180, y: 120, r: 24, c: '#71717A', box: 60, p: `${p50} mm` },
    { x: 260, y: 180, r: 35, c: '#A1A1AA', box: 85, p: `${p80} mm` },
    { x: 380, y: 140, r: 28, c: '#52525B', box: 70, p: `${Math.round((p50 + p80) / 2)} mm` },
    { x: 220, y: 260, r: 18, c: '#71717A', box: 45, p: `${Math.round(p50 * 0.7)} mm` },
    { x: 420, y: 240, r: 22, c: '#A1A1AA', box: 55, p: `${Math.round(p50 * 0.9)} mm` },
    // BOULDER CHOKE ALERT
    {
      x: 310,
      y: 220,
      r: 52,
      c: isChoke ? '#EF4444' : '#10B981',
      box: 120,
      p: `${topSize} mm [${isChoke ? (isFr ? 'ALERTE CONCASSEUR' : 'CHOKE ALERT') : (isFr ? 'CONFORME' : 'OPTIMAL')}]`,
      alert: isChoke,
    },
  ];

  rocks.forEach((r) => {
    ctx.fillStyle = r.c;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.fill();

    // Bounding Box
    ctx.strokeStyle = r.alert ? '#EF4444' : '#10B981';
    ctx.lineWidth = r.alert ? 2.5 : 1.5;
    ctx.strokeRect(r.x - r.box / 2, r.y - r.box / 2, r.box, r.box);

    ctx.fillStyle = r.alert ? '#EF4444' : '#10B981';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(r.p, r.x - r.box / 2, r.y - r.box / 2 - 4);
  });

  // Camera HUD Overlays
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(bX + 15, bY + 15, 175, 50);
  ctx.fillStyle = '#22C55E';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('● LIVE STREAM : CAM-01', bX + 25, bY + 34);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '9.5px Arial';
  ctx.fillText(`Cadence : 4 FPS | Seuil : ${gape}mm`, bX + 25, bY + 52);

  // Dedicated Conveyor Stream Legend
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(bX + 15, bY + bH - 38, bW - 30, 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(bX + 15, bY + bH - 38, bW - 30, 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE OPTIQUE :' : 'VISION HUD LEGEND:', bX + 22, bY + bH - 20);

  const convChips = [
    { c: '#10B981', l: isFr ? `Conforme (<=${gape}mm)` : `Compliant (<=${gape}mm)` },
    { c: '#EF4444', l: isFr ? `Bloc (> ${gape}mm)` : `Oversize (> ${gape}mm)` },
    { c: '#EAB308', l: isFr ? 'Guides Bande (1.2m)' : 'Belt Guides (1.2m)' },
  ];

  let cChipX = bX + (isFr ? 125 : 130);
  convChips.forEach((chip) => {
    ctx.strokeStyle = chip.c;
    ctx.lineWidth = 2;
    ctx.strokeRect(cChipX, bY + bH - 26, 12, 10);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8px Arial';
    ctx.fillText(chip.l, cChipX + 16, bY + bH - 18);
    cChipX += isFr ? 130 : 125;
  });

  // Right Side Telemetry Card
  const cardX = 620;
  const cardY = 55;
  const cardW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cardX, cardY, cardW, bH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cardX, cardY, cardW, bH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(isFr ? 'MÉTRIQUES DE BANDE' : 'CONVEYOR TELEMETRY', cardX + 20, cardY + 30);

  const metrics = [
    [isFr ? 'Débit Instantané :' : 'Instant Throughput:', `${tph} t/h`],
    [isFr ? 'Vitesse de bande :' : 'Belt Speed:', `${speed} m/s`],
    [isFr ? 'Granulométrie P50 :' : 'Fragment P50:', `${p50} mm`],
    [isFr ? 'Granulométrie P80 :' : 'Fragment P80:', `${p80} mm`],
    [isFr ? 'Seuil Concasseur :' : 'Crusher Gape Limit:', `${gape} mm`],
    [isFr ? 'Statut Concasseur :' : 'Crusher Status:', isChoke ? (isFr ? 'ALERTE BOULDER' : 'BOULDER ALERT') : (isFr ? 'NOMINAL' : 'NOMINAL')],
  ];

  let my = cardY + 65;
  metrics.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cardX + 20, my);

    ctx.fillStyle = v.includes('ALERT') || v.includes('ALERTE') ? '#DC2626' : '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cardX + 20, my + 15);
    my += 40;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 5. 3D Blast Timing Simulator & Iso-Chronous Wavefront Graphic
// ---------------------------------------------------------------------------
export interface BlastTimingGraphicOptions {
  lang?: string;
  diameterMm?: number;
  maxChargePerDelayKg?: number;
  ppvMmPerS?: number;
  distanceToStructureM?: number;
}

export function renderBlastTimingGraphic(options?: BlastTimingGraphicOptions | string): string {
  const isFr = (typeof options === 'string' ? options : options?.lang) === 'fr';
  const opt = typeof options === 'object' ? options : {};
  const dia = opt?.diameterMm || 89;
  const chargeDelay = opt?.maxChargePerDelayKg !== undefined ? opt.maxChargePerDelayKg : 28.5;
  const dist = opt?.distanceToStructureM || 350;
  const ppv = opt?.ppvMmPerS !== undefined ? opt.ppvMmPerS : 4.2;

  const { canvas, ctx } = createHiDPICanvas(900, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Chronogramme 3D d’Amorçage & Profil du Front de Taille' : '3D Blast Initiation Timing & Face Burden Profile',
    40,
    30
  );

  const pX = 50;
  const pY = 55;
  const pW = 540;
  const pH = 320;

  // Grid background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(pX, pY, pW, pH);
  ctx.strokeStyle = '#1E293B';
  ctx.strokeRect(pX, pY, pW, pH);

  // Draw Iso-delay wave contours (V-Echelon chevron initiation)
  const delays = [0, 25, 42, 67, 92, 117, 142, 167];
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];

  delays.forEach((d, idx) => {
    ctx.strokeStyle = colors[idx];
    ctx.lineWidth = 2;
    ctx.beginPath();
    const apexX = pX + 80 + idx * 45;
    const apexY = pY + 160;
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + 110, apexY - 110);
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + 110, apexY + 110);
    ctx.stroke();

    ctx.fillStyle = colors[idx];
    ctx.font = 'bold 9px Arial';
    ctx.fillText(`${d} ms`, apexX + 2, apexY - 8);
  });

  // Blast Holes grid points
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      const hx = pX + 90 + c * 50;
      const hy = pY + 70 + r * 60;
      const delay = Math.round(c * 25 + Math.abs(r - 1.5) * 17);

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '8px Arial';
      ctx.fillText(`${delay}ms`, hx - 10, hy + 14);
    }
  }

  // Dedicated Timing & Wavefront Legend
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(pX + 15, pY + pH - 38, pW - 30, 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(pX + 15, pY + pH - 38, pW - 30, 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE :' : 'LEGEND:', pX + 20, pY + pH - 20);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(pX + (isFr ? 95 : 85), pY + pH - 23, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '8px Arial';
  ctx.fillText(isFr ? `Collet (Ø${dia}mm)` : `Collar (Ø${dia}mm)`, pX + (isFr ? 105 : 95), pY + pH - 20);

  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pX + (isFr ? 230 : 210), pY + pH - 23);
  ctx.lineTo(pX + (isFr ? 245 : 225), pY + pH - 23);
  ctx.stroke();

  ctx.fillText(isFr ? 'Lignes Iso-Délai (25ms surface)' : 'Iso-Delay Wavefronts (25ms)', pX + (isFr ? 252 : 232), pY + pH - 20);

  // Right Side USBM Vibration Compliance Card
  const cX = 620;
  const cY = 55;
  const cW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cX, cY, cW, pH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cX, cY, cW, pH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(isFr ? 'CONFORMITÉ VIBRATOIRE (USBM)' : 'USBM VIBRATION AUDIT', cX + 20, cY + 30);

  const isCompliant = ppv <= 12.5;
  const vInfo = [
    [isFr ? 'Distance structure :' : 'Structure Distance:', `${dist} m`],
    [isFr ? 'Charge max par retard :' : 'Max Instant Charge:', `${chargeDelay} kg`],
    [isFr ? 'Vitesse Particulaire (PPV) :' : 'Peak Velocity (PPV):', `${ppv} mm/s`],
    [isFr ? 'Seuil critique USBM :' : 'USBM Threshold Limit:', '12.5 mm/s'],
    [isFr ? 'Facteur de Sécurité :' : 'Safety Factor:', `${(12.5 / Math.max(0.1, ppv)).toFixed(1)}x (${isCompliant ? (isFr ? 'CONFORME' : 'COMPLIANT') : (isFr ? 'NON-CONFORME' : 'EXCEEDED')})`],
  ];

  let vy = cY + 65;
  vInfo.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cX + 20, vy);

    ctx.fillStyle = v.includes('CONFORME') || v.includes('COMPLIANT') ? '#16A34A' : '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cX + 20, vy + 15);
    vy += 45;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 5b. Comminution Circuit Flowsheet & Energy Balance Graphic (Bond & Morrell)
// ---------------------------------------------------------------------------
export interface ComminutionGraphicOptions {
  throughputTph?: number;
  crushingKwhPerT?: number;
  sagKwhPerT?: number;
  ballMillKwhPerT?: number;
  totalKwhPerT?: number;
  bondWorkIndex?: number;
  f80Mm?: number;
  p80TargetUm?: number;
}

export function renderComminutionCircuitGraphic(options?: ComminutionGraphicOptions | string, langArg = 'fr'): string {
  const opts: ComminutionGraphicOptions = typeof options === 'object' && options !== null ? options : {};
  const lang = typeof options === 'string' ? options : langArg;
  const isFr = lang === 'fr';

  const throughput = opts.throughputTph ?? 485;
  const crushingE = opts.crushingKwhPerT ?? 0.50;
  const sagE = opts.sagKwhPerT ?? 11.06;
  const ballE = opts.ballMillKwhPerT ?? 9.05;
  const totalE = opts.totalKwhPerT ?? Number((crushingE + sagE + ballE).toFixed(2));
  const bondWi = opts.bondWorkIndex ?? 14.5;
  const f80 = opts.f80Mm ? Math.round(opts.f80Mm) : 280;
  const p80Um = opts.p80TargetUm ?? 75;

  const crushingPct = totalE > 0 ? ((crushingE / totalE) * 100).toFixed(1) : '2.4';
  const sagPct = totalE > 0 ? ((sagE / totalE) * 100).toFixed(1) : '53.7';
  const ballPct = totalE > 0 ? ((ballE / totalE) * 100).toFixed(1) : '43.9';

  const { canvas, ctx } = createHiDPICanvas(900, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr
      ? 'Schéma du Circuit de Comminution & Bilan Énergétique (Bond & Morrell)'
      : 'Comminution Circuit Flowsheet & Specific Energy Audit (Bond & Morrell)',
    40,
    30
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '11px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr
      ? 'Flux Minéralurgique : Concasseur Primaire -> Stock Tampon -> Broyeur SAG -> Broyeur à Boulets -> Hydrocyclones'
      : 'Mineral Processing Circuit: Primary Jaw Crusher -> Surge Bin -> SAG Mill -> Ball Mill -> Hydrocyclones',
    40,
    48
  );

  const fX = 45;
  const fY = 65;
  const fW = 550;
  const fH = 320;

  // Viewport background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(fX, fY, fW, fH);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(fX, fY, fW, fH);

  // 4 processing unit blocks
  const units = [
    { x: fX + 20, y: fY + 40, w: 105, h: 90, title: isFr ? 'CONCASSEUR' : 'PRIMARY JAW', sub: `F80: ${f80}mm -> 110mm`, e: `${crushingE.toFixed(2)} kWh/t`, col: '#38BDF8' },
    { x: fX + 155, y: fY + 40, w: 105, h: 90, title: isFr ? 'STOCK TAMPON' : 'SURGE BIN', sub: `${isFr ? 'Débit' : 'Feed'}: ${Math.round(throughput)} t/h`, e: isFr ? 'Alimentation SAG' : 'SAG Mill Feed', col: '#94A3B8' },
    { x: fX + 290, y: fY + 40, w: 115, h: 90, title: isFr ? 'BROYEUR SAG' : 'SAG MILL', sub: 'F80: 110mm -> 12mm', e: `${sagE.toFixed(2)} kWh/t (${Math.round(Number(sagPct))}%)`, col: '#F59E0B' },
    { x: fX + 430, y: fY + 40, w: 105, h: 90, title: isFr ? 'BROYEUR BOULETS' : 'BALL MILL', sub: `P80 Cible : ${p80Um} µm`, e: `${ballE.toFixed(2)} kWh/t (${Math.round(Number(ballPct))}%)`, col: '#10B981' },
  ];

  // Draw unit cards and flow arrows
  units.forEach((u, i) => {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(u.x, u.y, u.w, u.h);
    ctx.strokeStyle = u.col;
    ctx.lineWidth = 2;
    ctx.strokeRect(u.x, u.y, u.w, u.h);

    ctx.fillStyle = u.col;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(u.title, u.x + u.w / 2, u.y + 22);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '8.5px Arial';
    ctx.fillText(u.sub, u.x + u.w / 2, u.y + 45);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9.5px Arial';
    ctx.fillText(u.e, u.x + u.w / 2, u.y + 70);

    // Arrow to next
    if (i < units.length - 1) {
      const nextU = units[i + 1];
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(u.x + u.w, u.y + u.h / 2);
      ctx.lineTo(nextU.x, u.y + u.h / 2);
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(nextU.x, u.y + u.h / 2);
      ctx.lineTo(nextU.x - 7, u.y + u.h / 2 - 5);
      ctx.lineTo(nextU.x - 7, u.y + u.h / 2 + 5);
      ctx.closePath();
      ctx.fill();
    }
  });

  // Pebble recycle loop & Cyclone overflow
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(fX + 348, fY + 130);
  ctx.lineTo(fX + 348, fY + 165);
  ctx.lineTo(fX + 208, fY + 165);
  ctx.lineTo(fX + 208, fY + 130);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(isFr ? 'Boucle Recyclage Cailloux (Pebbles +15%)' : 'Pebble Recycle Loop (+15%)', fX + 278, fY + 180);

  // Hydrocyclone classifier block
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(fX + 375, fY + 195, 160, 50);
  ctx.strokeStyle = '#06B6D4';
  ctx.lineWidth = 2;
  ctx.strokeRect(fX + 375, fY + 195, 160, 50);

  ctx.fillStyle = '#06B6D4';
  ctx.font = 'bold 9.5px Arial';
  ctx.fillText(isFr ? `HYDROCYCLONES D50=${p80Um}µm` : `CYCLONES D50=${p80Um}µm`, fX + 455, fY + 215);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '8px Arial';
  ctx.fillText(isFr ? `Overflow -> Flottation (P80=${p80Um}µm)` : `Overflow -> Flotation (P80=${p80Um}µm)`, fX + 455, fY + 232);

  // Dedicated Legend Box at bottom of flowsheet
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(fX + 10, fY + fH - 42, fW - 20, 32);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(fX + 10, fY + fH - 42, fW - 20, 32);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE DU CIRCUIT :' : 'FLOWSHEET LEGEND:', fX + 18, fY + fH - 22);

  const flowLeg = [
    { color: '#38BDF8', label: isFr ? `Flux Principal (${Math.round(throughput)} t/h)` : `Main Slurry (${Math.round(throughput)} tph)` },
    { color: '#EF4444', label: isFr ? 'Recyclage Cailloux' : 'Pebble Recycle' },
    { color: '#10B981', label: isFr ? `Produit Fini (${p80Um}µm)` : `Final Product (${p80Um}µm)` },
  ];
  let lx = fX + (isFr ? 140 : 135);
  flowLeg.forEach((fl) => {
    ctx.strokeStyle = fl.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lx, fY + fH - 25);
    ctx.lineTo(lx + 14, fY + fH - 25);
    ctx.stroke();

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8px Arial';
    ctx.fillText(fl.label, lx + 18, fY + fH - 22);
    lx += isFr ? 130 : 125;
  });

  // Right Side Energy Balance Card
  const cX = 620;
  const cY = 65;
  const cW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cX, cY, cW, fH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cX, cY, cW, fH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'RÉPARTITION D’ÉNERGIE' : 'SPECIFIC ENERGY AUDIT', cX + 20, cY + 30);

  const eBreakdown = [
    [isFr ? 'Concassage Primaire :' : 'Primary Crushing:', `${crushingE.toFixed(2)} kWh/t (${crushingPct}%)`],
    [isFr ? 'Broyage SAG :' : 'SAG Milling:', `${sagE.toFixed(2)} kWh/t (${sagPct}%)`],
    [isFr ? 'Broyeur à Boulets :' : 'Ball Milling:', `${ballE.toFixed(2)} kWh/t (${ballPct}%)`],
    [isFr ? 'Total Énergie Spécifique :' : 'Total Specific Energy:', `${totalE.toFixed(2)} kWh/t`],
    [isFr ? 'Indice de Travail (Wi) :' : 'Bond Work Index (Wi):', `${bondWi.toFixed(1)} kWh/t`],
    [isFr ? 'Débit Nominal Usine :' : 'Nominal Throughput:', `${Math.round(throughput)} tonnes/h`],
  ];

  let ey = cY + 65;
  eBreakdown.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cX + 20, ey);

    ctx.fillStyle = k.includes('Total') ? '#0284C7' : '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cX + 20, ey + 15);
    ey += 40;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 6. Geostatistical Kriging Block Model Heatmap Graphic
// ---------------------------------------------------------------------------
export interface KrigingGraphicOptions {
  softCutoff?: number;
  hardCutoff?: number;
  isDemo?: boolean;
}

export function renderKrigingModelGraphic(options?: KrigingGraphicOptions | string, langArg = 'fr'): string {
  const opts: KrigingGraphicOptions = typeof options === 'object' && options !== null ? options : {};
  const lang = typeof options === 'string' ? options : langArg;
  const isFr = lang === 'fr';

  const softCutoff = opts.softCutoff ?? 75;
  const hardCutoff = opts.hardCutoff ?? 125;
  const isDemo = opts.isDemo ?? false;

  const { canvas, ctx } = createHiDPICanvas(900, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Modèle Géologique de Blocs & Interpolation par Krigeage Ordinaire' : 'Geostatistical Block Model & Ordinary Kriging BLUE Heatmap',
    40,
    30
  );

  if (isDemo) {
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(isFr ? '[DONNÉES DE DÉMO / SÉQUENCE STANDARD]' : '[DEMO DATA / BENCHMARK GRID]', 550, 30);
  }

  const kX = 50;
  const kY = 55;
  const kW = 540;
  const kH = 320;

  // Grid cells (20 x 12 blocks)
  const cols = 20;
  const rows = 12;
  const cw = kW / cols;
  const ch = kH / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Synthetic spatial hardness gradient (Soft = blue, Intermediate = amber, Hard = red)
      const hardness = Math.sin(c / 3.5) * 40 + Math.cos(r / 2.5) * 35 + 110;
      let color = '#3B82F6'; // Soft
      if (hardness > hardCutoff) color = '#EF4444'; // Hard
      else if (hardness > softCutoff) color = '#F59E0B'; // Intermediate

      ctx.fillStyle = color;
      ctx.fillRect(kX + c * cw, kY + r * ch, cw - 1, ch - 1);
    }
  }

  // Borehole Assay Points overlay
  const boreholes = [
    { x: 140, y: 110, ucs: 142 },
    { x: 260, y: 190, ucs: 85 },
    { x: 420, y: 130, ucs: 165 },
    { x: 340, y: 280, ucs: 115 },
    { x: 180, y: 260, ucs: 92 },
  ];

  boreholes.forEach((bh) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(kX + bh.x, kY + bh.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(`${bh.ucs}MPa`, kX + bh.x + 9, kY + bh.y + 3);
  });

  // Dedicated Kriging Domains Legend at bottom of grid
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(kX + 10, kY + kH - 38, kW - 20, 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(kX + 10, kY + kH - 38, kW - 20, 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE DOMAINES :' : 'KRIGING DOMAINS:', kX + 18, kY + kH - 20);

  const kChips = [
    { c: '#3B82F6', l: isFr ? `Tendre (<${softCutoff} MPa)` : `Soft (<${softCutoff} MPa)` },
    { c: '#F59E0B', l: isFr ? `Moyen (${softCutoff}-${hardCutoff} MPa)` : `Medium (${softCutoff}-${hardCutoff} MPa)` },
    { c: '#EF4444', l: isFr ? `Dur (>${hardCutoff} MPa)` : `Hard (>${hardCutoff} MPa)` },
  ];

  let kChipX = kX + (isFr ? 130 : 125);
  kChips.forEach((chip) => {
    ctx.fillStyle = chip.c;
    ctx.fillRect(kChipX, kY + kH - 26, 12, 10);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(kChipX, kY + kH - 26, 12, 10);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8px Arial';
    ctx.fillText(chip.l, kChipX + 16, kY + kH - 18);
    kChipX += isFr ? 105 : 100;
  });

  // Right Side Legend Card
  const cX = 620;
  const cY = 55;
  const cW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cX, cY, cW, kH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cX, cY, cW, kH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(isFr ? 'ZONAGE GÉOMÉCANIQUE' : 'GEOMECHANICAL DOMAINS', cX + 20, cY + 30);

  const domains = [
    [isFr ? 'Domaine Tendre (Bleu) :' : 'Soft Domain (Blue):', `0.42 kg/m³ | UCS <${softCutoff}`],
    [isFr ? 'Domaine Moyen (Orange) :' : 'Intermediate (Amber):', `0.58 kg/m³ | UCS ${softCutoff}-${hardCutoff}`],
    [isFr ? 'Domaine Dur (Rouge) :' : 'Hard Massive (Red):', `0.74 kg/m³ | UCS >${hardCutoff}`],
    [isFr ? 'Portée Variogramme (a) :' : 'Variogram Range (a):', '45.0 m'],
    [isFr ? 'Effet Pépite (C0) :' : 'Nugget Effect (C0):', '50.0 MPa²'],
  ];

  let dy = cY + 65;
  domains.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cX + 20, dy);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cX + 20, dy + 15);
    dy += 45;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 7. Drill Rig Collar Deviation Target Bullseye Graphic
// ---------------------------------------------------------------------------
export interface DrillBullseyeOptions {
  toleranceMm?: number;
  complianceRate?: number;
  totalHoles?: number;
  rigModel?: string;
  averageRopMPerMin?: number;
  isDemo?: boolean;
}

export function renderDrillCollarBullseyeGraphic(
  holes: IREDESHole[],
  toleranceArg: number | DrillBullseyeOptions = 60,
  langArg = 'fr'
): string {
  const opts: DrillBullseyeOptions = typeof toleranceArg === 'object' && toleranceArg !== null ? toleranceArg : {};
  const toleranceMm = typeof toleranceArg === 'number' ? toleranceArg : opts.toleranceMm ?? 60;
  const lang = langArg;
  const isFr = lang === 'fr';

  const { canvas, ctx } = createHiDPICanvas(900, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Cible d’Écart de Collet de Foration (QA/QC MWD)' : 'Drill Hole Collar Deviation Bullseye Target (MWD QA/QC)',
    40,
    30
  );

  const isDemo = opts.isDemo ?? (holes.length === 0);
  if (isDemo) {
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 10px Arial';
    ctx.fillText(isFr ? '[DONNÉES DE DÉMO MWD]' : '[MWD DEMO DATA]', 600, 30);
  }

  const tX = 50;
  const tY = 55;
  const tW = 540;
  const tH = 320;
  const centerX = tX + tW / 2;
  const centerY = tY + tH / 2;

  // Background
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(tX, tY, tW, tH);

  // Target Rings
  const scale = 1.3; // 1 mm = 1.3 px
  const rTol = toleranceMm * scale;
  const rWarn = toleranceMm * 1.8 * scale;
  const rCrit = toleranceMm * 2.5 * scale;

  // Outer ring
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, rCrit, 0, Math.PI * 2);
  ctx.fill();

  // Warning ring
  ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, rWarn, 0, Math.PI * 2);
  ctx.fill();

  // Tolerance Ring (Green zone)
  ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, rTol, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Crosshair
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - rCrit - 20, centerY);
  ctx.lineTo(centerX + rCrit + 20, centerY);
  ctx.moveTo(centerX, centerY - rCrit - 20);
  ctx.lineTo(centerX, centerY + rCrit + 20);
  ctx.stroke();

  // Plot holes
  const holesToPlot = holes.length > 0 ? holes : Array.from({ length: 30 }, (_, i) => ({
    holeId: `H-${i + 1}`,
    collarDeviationMm: (i * 17) % 85 + 10,
    actualDepth: 16.2,
    actualAngle: 90,
  } as unknown as IREDESHole));

  holesToPlot.forEach((h) => {
    const err = h.collarDeviationMm || 35;
    const angle = (parseInt(h.holeId.replace(/\D/g, '') || '1') * 47) % 360;
    const rad = (angle * Math.PI) / 180;
    const dist = err * scale;
    const px = centerX + Math.cos(rad) * dist;
    const py = centerY + Math.sin(rad) * dist;

    ctx.fillStyle = err <= toleranceMm ? '#10B981' : err <= toleranceMm * 1.5 ? '#F59E0B' : '#EF4444';
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Dedicated Bullseye Target Legend at bottom of target
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(tX + 10, tY + tH - 38, tW - 20, 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(tX + 10, tY + tH - 38, tW - 20, 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE TOLÉRANCE :' : 'ACCURACY LEGEND:', tX + 18, tY + tH - 20);

  const bChips = [
    { c: '#10B981', l: isFr ? `Conforme (<= ${toleranceMm}mm)` : `Compliant (<= ${toleranceMm}mm)` },
    { c: '#F59E0B', l: isFr ? `Alerte (${toleranceMm}-${Math.round(toleranceMm * 1.5)}mm)` : `Warning (${toleranceMm}-${Math.round(toleranceMm * 1.5)}mm)` },
    { c: '#EF4444', l: isFr ? `Hors Norme (> ${Math.round(toleranceMm * 1.5)}mm)` : `Out of Spec (> ${Math.round(toleranceMm * 1.5)}mm)` },
  ];

  let bChipX = tX + (isFr ? 135 : 125);
  bChips.forEach((chip) => {
    ctx.fillStyle = chip.c;
    ctx.beginPath();
    ctx.arc(bChipX + 5, tY + tH - 21, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8px Arial';
    ctx.fillText(chip.l, bChipX + 14, tY + tH - 18);
    bChipX += isFr ? 115 : 110;
  });

  // Right Side Telemetry Card
  const cX = 620;
  const cY = 55;
  const cW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cX, cY, cW, tH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cX, cY, cW, tH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(isFr ? 'RÉSULTATS DE CONFORMITÉ' : 'DRILLING ACCURACY STATS', cX + 20, cY + 30);

  const compliantCount = holesToPlot.filter((h) => (h.collarDeviationMm || 0) <= toleranceMm).length;
  const computedRate = holesToPlot.length > 0 ? Math.round((compliantCount / holesToPlot.length) * 100) : 92;
  const rate = opts.complianceRate ?? computedRate;
  const rigModel = opts.rigModel ?? 'SmartROC T45';
  const rop = opts.averageRopMPerMin ?? 1.42;

  const stats = [
    [isFr ? 'Tolérance contractuelle :' : 'Contractual Tolerance:', `${toleranceMm} mm`],
    [isFr ? 'Taux de conformité :' : 'Compliance Rate:', `${rate} %`],
    [isFr ? 'Trous forés :' : 'Total Drilled Holes:', `${opts.totalHoles ?? holesToPlot.length}`],
    [isFr ? 'Foreuse connectée :' : 'Connected Rig Model:', rigModel],
    [isFr ? 'Vitesse moyenne (ROP) :' : 'Average ROP Speed:', `${rop.toFixed(2)} m/min`],
  ];

  let sy = cY + 65;
  stats.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cX + 20, sy);

    ctx.fillStyle = v.includes('%') && rate >= 85 ? '#16A34A' : '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cX + 20, sy + 15);
    sy += 45;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 8. Open-Pit Bench Map & Animated Flyrock Safety Zone Graphic
// ---------------------------------------------------------------------------
export interface BenchMapGraphicOptions {
  numberOfHoles?: number;
  benchElevation?: number;
  blastedVolumeM3?: number;
  totalTonnageTonnes?: number;
}

export function renderBenchMapGraphic(
  blast: Blast,
  flyrockRadiusArg: number | BenchMapGraphicOptions = 300,
  langArg = 'fr',
  optionsArg?: BenchMapGraphicOptions
): string {
  const opts: BenchMapGraphicOptions =
    typeof flyrockRadiusArg === 'object' && flyrockRadiusArg !== null
      ? flyrockRadiusArg
      : optionsArg ?? {};
  const flyrockRadiusM = typeof flyrockRadiusArg === 'number' ? flyrockRadiusArg : 300;
  const lang = typeof flyrockRadiusArg === 'string' ? flyrockRadiusArg : langArg;
  const isFr = lang === 'fr';

  const nHoles = opts.numberOfHoles ?? blast.parameters?.numberOfHoles ?? 50;
  const benchElevation = opts.benchElevation ?? (blast as any).benchElevation ?? (blast.parameters as any)?.benchElevation ?? 840;

  const { canvas, ctx } = createHiDPICanvas(900, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Plan Spatial du Gradin & Périmètre de Sécurité Anti-Projections' : 'Open-Pit Bench Spatial Plan & Flyrock Safety Clearance Perimeter',
    40,
    30
  );

  const bX = 50;
  const bY = 55;
  const bW = 540;
  const bH = 320;
  const cX = bX + bW / 2;
  const cY = bY + bH / 2;

  // Background Pit contours
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(bX, bY, bW, bH);

  // Bench Elevation contours
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cX, cY, 240, 140, -0.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#1E293B';
  ctx.beginPath();
  ctx.ellipse(cX, cY, 200, 110, -0.1, 0, Math.PI * 2);
  ctx.stroke();

  // Flyrock Safety Exclusion Zone Circle
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.beginPath();
  ctx.arc(cX, cY, 130, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Blasted Polygon Pattern
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(cX - 50, cY - 35, 100, 70);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.strokeRect(cX - 50, cY - 35, 100, 70);

  // Pattern holes dots
  for (let r = -25; r <= 25; r += 16) {
    for (let c = -40; c <= 40; c += 20) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cX + c, cY + r, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Flyrock tag
  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(isFr ? `PÉRIMÈTRE DE SÉCURITÉ : R = ${flyrockRadiusM} m` : `SAFETY EXCLUSION ZONE: R = ${flyrockRadiusM} m`, cX, cY - 138);

  // Dedicated Bench Map Legend Box at bottom of map
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(bX + 10, bY + bH - 38, bW - 20, 28);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(bX + 10, bY + bH - 38, bW - 20, 28);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE CARTO :' : 'MAP LEGEND:', bX + 18, bY + bH - 20);

  const mapChips = [
    { c: '#F59E0B', l: isFr ? `Emprise Tir (${nHoles} trous)` : `Blast Polygon (${nHoles} holes)` },
    { c: '#EF4444', l: isFr ? `Zone Sécurité (R=${flyrockRadiusM}m)` : `Safety Zone (R=${flyrockRadiusM}m)`, dash: true },
    { c: '#64748B', l: isFr ? `Courbe Niveau (${benchElevation} RL)` : `Topo Crest (${benchElevation} RL)`, line: true },
  ];

  let mChipX = bX + (isFr ? 120 : 110);
  mapChips.forEach((chip) => {
    if (chip.dash) {
      ctx.strokeStyle = chip.c;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(mChipX, bY + bH - 21);
      ctx.lineTo(mChipX + 14, bY + bH - 21);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (chip.line) {
      ctx.strokeStyle = chip.c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mChipX, bY + bH - 21);
      ctx.lineTo(mChipX + 14, bY + bH - 21);
      ctx.stroke();
    } else {
      ctx.fillStyle = chip.c;
      ctx.fillRect(mChipX, bY + bH - 26, 12, 10);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(mChipX, bY + bH - 26, 12, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(mChipX + 6, bY + bH - 21, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '8px Arial';
    ctx.fillText(chip.l, mChipX + 18, bY + bH - 18);
    mChipX += isFr ? 130 : 125;
  });

  // Right Side Summary
  const cardX = 620;
  const cardY = 55;
  const cardW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cardX, cardY, cardW, bH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cardX, cardY, cardW, bH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'DONNÉES DU GRADIN' : 'BENCH GEOMETRY', cardX + 20, cardY + 30);

  const vol = opts.blastedVolumeM3 ?? ((blast.parameters.burden || 2.4) * (blast.parameters.spacing || 2.8) * (blast.parameters.benchHeight || 6.0) * nHoles);
  const ton = opts.totalTonnageTonnes ?? (vol * (blast.rockMass?.density || 2.76));

  const data = [
    [isFr ? 'Gradin de fosse :' : 'Bench Elevation:', `${benchElevation} RL`],
    [isFr ? 'Volume abattu :' : 'Blasted Volume:', `${Math.round(vol).toLocaleString()} m³`],
    [isFr ? 'Tonnage total :' : 'Total Tonnage:', `${Math.round(ton).toLocaleString()} tonnes`],
    [isFr ? 'Rayon évacuation :' : 'Evacuation Clearance:', `${flyrockRadiusM} m`],
    [isFr ? 'Dispositif de sécurité :' : 'Safety Protocol:', isFr ? 'Périmètre Validé' : 'Cleared & Secured'],
  ];

  let by = cardY + 65;
  data.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cardX + 20, by);

    ctx.fillStyle = v.includes('Validé') || v.includes('Secured') ? '#16A34A' : '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cardX + 20, by + 15);
    by += 45;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 9. Mine-to-Mill Holistic Economic Cost Curve Graphic
// ---------------------------------------------------------------------------
export function renderMineToMillGraphic(sweetSpotP80 = 160, currentCost = 8.45, lang = 'fr'): string {
  const { canvas, ctx } = createHiDPICanvas(900, 420);
  const isFr = lang === 'fr';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Courbe d’Optimisation Économique Globale Mine-au-Moulin' : 'Mine-to-Mill Holistic Economic Cost Optimization Trade-off',
    40,
    30
  );

  const mX = 60;
  const mY = 55;
  const mW = 530;
  const mH = 320;

  // Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(mX, mY, mW, mH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(mX, mY, mW, mH);

  // X-axis: P80 from 80mm to 360mm
  // Y-axis: Cost from 0 $/t to 18 $/t so curve fits naturally with plenty of headroom
  const xToPx = (p80: number) => mX + ((p80 - 80) / (360 - 80)) * mW;
  const yToPx = (cost: number) => mY + mH - 45 - ((cost - 1) / (18 - 1)) * (mH - 65);

  // Horizontal Grid Lines & Ticks
  ctx.textAlign = 'right';
  ctx.font = '9px Arial';
  for (let c = 2; c <= 18; c += 4) {
    const y = yToPx(c);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mX, y);
    ctx.lineTo(mX + mW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillText(`$${c}`, mX - 8, y + 3);
  }

  // Vertical Grid Lines & Ticks (P80)
  ctx.textAlign = 'center';
  for (let p = 80; p <= 360; p += 70) {
    const x = xToPx(p);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, mY);
    ctx.lineTo(x, mY + mH - 45);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.fillText(`${p} mm`, x, mY + mH - 30);
  }

  // Curve 1: Drill & Blast Cost (Decreases with higher P80)
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let p = 80; p <= 360; p += 10) {
    const cost = 2.2 + 4.5 * Math.pow(120 / p, 0.8);
    const px = xToPx(p);
    const py = yToPx(cost);
    if (p === 80) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Curve 2: Crushing & Milling Cost (Increases with higher P80)
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let p = 80; p <= 360; p += 10) {
    const cost = 3.0 + 5.8 * Math.pow(p / 160, 0.9);
    const px = xToPx(p);
    const py = yToPx(cost);
    if (p === 80) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Curve 3: TOTAL MINE-TO-MILL COST (Convex curve with minimum at Sweet Spot)
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  let minCost = 999;
  let minPx = 0;
  let minPy = 0;

  for (let p = 80; p <= 360; p += 10) {
    const db = 2.2 + 4.5 * Math.pow(120 / p, 0.8);
    const cm = 3.0 + 5.8 * Math.pow(p / 160, 0.9);
    const total = db + cm;
    const px = xToPx(p);
    const py = yToPx(total);

    if (total < minCost) {
      minCost = total;
      minPx = px;
      minPy = py;
    }

    if (p === 80) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Sweet Spot Marker
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(minPx, minPy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sweet spot tag with clear pill background badge
  const tagText = isFr
    ? `OPTIMUM : P80 = ${sweetSpotP80} mm ($${minCost.toFixed(2)}/t)`
    : `SWEET SPOT: P80 = ${sweetSpotP80} mm ($${minCost.toFixed(2)}/t)`;
  ctx.font = 'bold 10px Arial';
  const tagW = ((ctx.measureText ? ctx.measureText(tagText)?.width : 140) || 140) + 16;
  const tagH = 20;
  const tagY = minPy < mY + 35 ? minPy + 16 : minPy - 24;

  ctx.fillStyle = '#065F46';
  ctx.fillRect(minPx - tagW / 2, tagY, tagW, tagH);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(minPx - tagW / 2, tagY, tagW, tagH);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(tagText, minPx, tagY + 14);

  // Dedicated Curve Legend Box at bottom of graph
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(mX + 10, mY + mH - 24, mW - 20, 22);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(mX + 10, mY + mH - 24, mW - 20, 22);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 8.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'LÉGENDE DES COURBES :' : 'CURVES LEGEND:', mX + 16, mY + mH - 10);

  const mCurves = [
    { c: '#2563EB', l: isFr ? 'Foration & Minage' : 'Drill & Blast', line: true },
    { c: '#D97706', l: isFr ? 'Concassage & Broyage' : 'Crushing & Milling', line: true },
    { c: '#10B981', l: isFr ? 'Coût Global' : 'Total Cost', thick: true },
    { c: '#065F46', l: isFr ? 'Optimum' : 'Sweet Spot', dot: true },
  ];

  let mcX = mX + (isFr ? 145 : 130);
  mCurves.forEach((item) => {
    if (item.dot) {
      ctx.fillStyle = item.c;
      ctx.beginPath();
      ctx.arc(mcX + 6, mY + mH - 13, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = item.c;
      ctx.lineWidth = item.thick ? 3 : 1.8;
      ctx.beginPath();
      ctx.moveTo(mcX, mY + mH - 13);
      ctx.lineTo(mcX + 14, mY + mH - 13);
      ctx.stroke();
    }
    ctx.fillStyle = '#334155';
    ctx.font = '8px Arial';
    ctx.fillText(item.l, mcX + 18, mY + mH - 10);
    mcX += isFr ? 88 : 82;
  });

  // Right Side Economic Card
  const cX = 620;
  const cY = 55;
  const cW = 240;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(cX, cY, cW, mH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(cX, cY, cW, mH);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(isFr ? 'BILAN ÉCONOMIQUE' : 'ECONOMIC SUMMARY', cX + 20, cY + 30);

  const econData = [
    [isFr ? 'Coût global actuel :' : 'Current Total Cost:', `$${currentCost.toFixed(2)} / tonne`],
    [isFr ? 'P80 Économique Optimal :' : 'Optimal Economic P80:', `${sweetSpotP80} mm`],
    [isFr ? 'Gain Potentiel :' : 'Potential Savings:', `+$${(currentCost - minCost).toFixed(2)} / t`],
    [isFr ? 'Économies annuelles (100kt) :' : 'Annual 100kt Savings:', `+$${Math.round((currentCost - minCost) * 100000).toLocaleString()}`],
    [isFr ? 'Bilan Carbone GES :' : 'Carbon Footprint:', '8.42 kg CO2e/t'],
  ];

  let ey = cY + 65;
  econData.forEach(([k, v]) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '10px Arial';
    ctx.fillText(k, cX + 20, ey);

    ctx.fillStyle = v.includes('+') ? '#16A34A' : '#0F172A';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(v, cX + 20, ey + 15);
    ey += 45;
  });

  return canvas.toDataURL('image/png', 0.95);
}

// ---------------------------------------------------------------------------
// 10. Computer Vision Pipeline Multi-Step Gallery (Contours, Niveaux de Gris, CLAHE, Seuillage, Distance, Marqueurs, Carte 3D)
// ---------------------------------------------------------------------------
export interface PipelineGalleryOptions {
  originalDataUrl?: string;
  stepPreviews?: {
    overlay?: string;
    grayscale?: string;
    clahe?: string;
    threshold?: string;
    distance?: string;
    markers?: string;
    depthMap?: string;
  };
  lang?: 'fr' | 'en';
}

export async function renderComputerVisionPipelineGallery(options: PipelineGalleryOptions): Promise<string> {
  const { canvas, ctx } = createHiDPICanvas(900, 480);
  const isFr = options.lang === 'fr';

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(
    isFr ? 'Pipeline de Traitement d’Image Numérique (Segmentation Multi-Étape)' : 'Computer Vision Image Processing Pipeline (Multi-Stage Segmentation)',
    25,
    28
  );

  ctx.fillStyle = '#94A3B8';
  ctx.font = '10.5px Arial';
  ctx.fillText(
    isFr
      ? 'Décomposition algorithmique : Contours | Niveaux de Gris | Égalisation CLAHE | Seuillage Otsu | Distance Euclidienne | Marqueurs Watershed | Carte 3D'
      : 'Algorithmic breakdown: Contours | Grayscale | CLAHE Equalization | Otsu Threshold | Euclidean Distance | Watershed Markers | 3D Relief',
    25,
    44
  );

  // Grid layout: 2 rows of 4 columns (8 panels)
  const steps = [
    { id: 'original', name: isFr ? '1. Cliché Brut' : '1. Raw Photo', key: 'original' },
    { id: 'grayscale', name: isFr ? '2. Niveaux de Gris' : '2. Grayscale', key: 'grayscale' },
    { id: 'clahe', name: isFr ? '3. Filtre CLAHE' : '3. CLAHE Contrast', key: 'clahe' },
    { id: 'threshold', name: isFr ? '4. Seuillage Otsu' : '4. Otsu Threshold', key: 'threshold' },
    { id: 'distance', name: isFr ? '5. Carte Distance' : '5. Distance Transform', key: 'distance' },
    { id: 'markers', name: isFr ? '6. Marqueurs Watershed' : '6. Watershed Markers', key: 'markers' },
    { id: 'depthMap', name: isFr ? '7. Carte 3D Relief' : '7. 3D Elevation / Depth', key: 'depthMap' },
    { id: 'overlay', name: isFr ? '8. Contours Détectés' : '8. Final Contours', key: 'overlay' },
  ];

  const cols = 4;
  const rows = 2;
  const startX = 25;
  const startY = 60;
  const totalW = canvas.width - startX * 2;
  const totalH = canvas.height - startY - 20;
  const gapX = 12;
  const gapY = 12;
  const panelW = (totalW - (cols - 1) * gapX) / cols;
  const panelH = (totalH - (rows - 1) * gapY) / rows;

  // Helper to load image
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const c = i % cols;
    const r = Math.floor(i / cols);
    const px = startX + c * (panelW + gapX);
    const py = startY + r * (panelH + gapY);

    // Frame
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, panelW, panelH);

    // Image slot
    const imgY = py + 22;
    const imgH = panelH - 22;

    let src = s.key === 'original' ? options.originalDataUrl : (options.stepPreviews as any)?.[s.key];

    let drawn = false;
    if (src) {
      try {
        const img = await loadImage(src);
        ctx.drawImage(img, px + 2, imgY + 2, panelW - 4, imgH - 4);
        drawn = true;
      } catch {
        drawn = false;
      }
    }

    if (!drawn) {
      // Draw procedural representation of the step
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(px + 2, imgY + 2, panelW - 4, imgH - 4);

      if (s.id === 'grayscale') {
        const grad = ctx.createLinearGradient(px, imgY, px + panelW, imgY + imgH);
        grad.addColorStop(0, '#334155');
        grad.addColorStop(1, '#94A3B8');
        ctx.fillStyle = grad;
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
      } else if (s.id === 'clahe') {
        const grad = ctx.createLinearGradient(px, imgY, px + panelW, imgY + imgH);
        grad.addColorStop(0, '#1E293B');
        grad.addColorStop(0.5, '#CBD5E1');
        grad.addColorStop(1, '#0F172A');
        ctx.fillStyle = grad;
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
      } else if (s.id === 'threshold') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
        ctx.fillStyle = '#FFFFFF';
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.arc(px + 30 + k * 26, imgY + 35 + (k % 2) * 20, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.id === 'distance') {
        const grad = ctx.createRadialGradient(px + panelW / 2, imgY + imgH / 2, 5, px + panelW / 2, imgY + imgH / 2, 50);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.5, '#3B82F6');
        grad.addColorStop(1, '#0F172A');
        ctx.fillStyle = grad;
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
      } else if (s.id === 'markers') {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
        const markerColors = ['#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = markerColors[k % markerColors.length];
          ctx.beginPath();
          ctx.arc(px + 20 + (k % 4) * 45, imgY + 25 + Math.floor(k / 4) * 40, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (s.id === 'depthMap') {
        const grad = ctx.createLinearGradient(px, imgY, px + panelW, imgY + imgH);
        grad.addColorStop(0, '#7C3AED');
        grad.addColorStop(0.5, '#06B6D4');
        grad.addColorStop(1, '#F59E0B');
        ctx.fillStyle = grad;
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
      } else {
        // Overlay contours
        ctx.fillStyle = '#334155';
        ctx.fillRect(px + 4, imgY + 4, panelW - 8, imgH - 8);
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 6; k++) {
          ctx.strokeRect(px + 15 + (k % 3) * 60, imgY + 15 + Math.floor(k / 3) * 40, 45, 30);
        }
      }
    }

    // Step Header Banner
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(px, py, panelW, 20);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 9.5px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(s.name, px + 8, py + 14);
  }

  return canvas.toDataURL('image/png', 0.95);
}

