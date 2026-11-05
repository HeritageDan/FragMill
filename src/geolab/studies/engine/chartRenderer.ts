/**
 * Chart rendering engine for FraGeo Lab Studies, Single Reports, and Excel Exports.
 * - renderChartToPng: High-resolution Canvas renderer matching GeoLabTestChart.tsx pixel-for-pixel
 * - renderTestChartPng / renderTestChartDataUrl: Universal chart generator for all 9 geotechnical test types with graphs
 * - drawVectorMultiGrainSizeChart: Vector chart renderer for PDF export
 */

import type jsPDF from 'jspdf';
import type { ProctorResults } from '../../tests/proctor';
import type { GrainSizeResults } from '../../tests/grainSize';

export type ChartConfig =
  | {
      type: 'proctor';
      results: ProctorResults;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'grain_size';
      results: GrainSizeResults;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'multi_grain_size';
      series: Array<{
        name: string;
        color: string;
        points: Array<{ sieveMm: number; passingPercent: number }>;
      }>;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'specific_gravity';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'water_content';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'sand_equivalent';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'los_angeles';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'micro_deval';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'flakiness';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'methylene_blue';
      results: any;
      input?: any;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    };

// Minimal valid 1x1 PNG byte array fallback for headless / test environments
export const FALLBACK_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x60,
  0x00, 0x00, 0x00, 0x05, 0x00, 0x01, 0xa7, 0x35, 0x19, 0xd6, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

export function isTestWithGraph(testType: string): boolean {
  return [
    'proctor',
    'grain_size',
    'specific_gravity',
    'water_content',
    'sand_equivalent',
    'los_angeles',
    'micro_deval',
    'flakiness',
    'methylene_blue',
  ].includes(testType);
}

function createChartCanvas(width = 800, height = 450): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined' || !document.createElement) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * Universal high-resolution Canvas renderer that guarantees identical aesthetics
 * to GeoLabTestChart.tsx across Word (.docx), PDF (.pdf), and Excel (.xlsx) files.
 */
export async function renderChartToPng(config: ChartConfig): Promise<Uint8Array> {
  const canvasObj = createChartCanvas(800, 450);
  if (!canvasObj) return FALLBACK_1X1_PNG;
  const { canvas, ctx } = canvasObj;

  try {
    drawChartOnContext(ctx, config, 800, 450);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) return FALLBACK_1X1_PNG;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch {
    return FALLBACK_1X1_PNG;
  }
}

export async function renderChartToDataUrl(config: ChartConfig): Promise<string> {
  const canvasObj = createChartCanvas(800, 450);
  if (!canvasObj) return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const { canvas, ctx } = canvasObj;

  try {
    drawChartOnContext(ctx, config, 800, 450);
    return canvas.toDataURL('image/png');
  } catch {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}

export async function renderTestChartPng(
  testType: string,
  input: any,
  results: any,
  lang: 'en' | 'fr' = 'fr',
  primaryColor?: string
): Promise<Uint8Array> {
  if (!results || !isTestWithGraph(testType)) {
    return FALLBACK_1X1_PNG;
  }
  return renderChartToPng({
    type: testType as any,
    results,
    input,
    lang,
    primaryColor,
  });
}

export async function renderTestChartDataUrl(
  testType: string,
  input: any,
  results: any,
  lang: 'en' | 'fr' = 'fr',
  primaryColor?: string
): Promise<string> {
  if (!results || !isTestWithGraph(testType)) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
  return renderChartToDataUrl({
    type: testType as any,
    results,
    input,
    lang,
    primaryColor,
  });
}

export function renderTestChartDataUrlSync(
  testType: string,
  input: any,
  results: any,
  lang: 'en' | 'fr' = 'fr',
  primaryColor?: string
): string | null {
  if (!results || !isTestWithGraph(testType)) return null;
  const canvasObj = createChartCanvas(800, 450);
  if (!canvasObj) return null;
  try {
    drawChartOnContext(
      canvasObj.ctx,
      {
        type: testType as any,
        results,
        input,
        lang,
        primaryColor,
      },
      800,
      450
    );
    return canvasObj.canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function drawChartOnContext(ctx: CanvasRenderingContext2D, config: ChartConfig, width: number, height: number) {
  const isFr = config.lang === 'fr';

  // Card Background: Slate-950 dark theme matching GeoLabTestChart.tsx
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // -------------------------------------------------------------
  // 1. PROCTOR COMPACTION CURVE
  // -------------------------------------------------------------
  if (config.type === 'proctor') {
    const res = config.results as ProctorResults;
    const pts = res.points || [];
    const opmW = res.opmMoisturePercent || 0;
    const opmRho = res.maxDryDensityGcm3 || 0;
    const targetRho = res.targetDryDensityGcm3 || opmRho * 0.95;

    const minW = Math.max(0, Math.min(...pts.map((p) => p.waterContentPercent)) - 2.5);
    const maxW = Math.max(...pts.map((p) => p.waterContentPercent)) + 3;
    const minRho = Math.min(...pts.map((p) => p.dryDensityGcm3)) * 0.94;
    const maxRho = Math.max(...pts.map((p) => p.dryDensityGcm3), opmRho) * 1.05;

    const padL = 75;
    const padR = 40;
    const padT = 55;
    const padB = 60;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const toX = (w: number) => padL + ((w - minW) / (maxW - minW || 1)) * plotW;
    const toY = (r: number) => padT + plotH - ((r - minRho) / (maxRho - minRho || 1)) * plotH;

    // Header Title
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'COURBE DE COMPACTAGE PROCTOR' : 'PROCTOR COMPACTION CURVE', 36, 30);

    // Badges / Metrics in header
    ctx.font = 'bold 12px "Times New Roman", Times, serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText(isFr ? 'Ajustement polynomial' : 'Polynomial Fit', width - 420, 30);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(isFr ? 'Saturation (Sr=100%)' : 'Saturation (Sr=100%)', width - 280, 30);

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`w_opm = ${opmW}% | ρd_max = ${opmRho} g/cm³`, width - 40, 30);
    ctx.textAlign = 'right';

    ctx.textAlign = 'left';

    // Horizontal Grid & Labels
    [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
      const yVal = minRho + frac * (maxRho - minRho);
      const y = toY(yVal);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Times New Roman", Times, serif';
      ctx.textAlign = 'right';
      ctx.fillText(yVal.toFixed(3), padL - 10, y + 4);
    });

    // Vertical Grid & Labels
    [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((frac) => {
      const xVal = minW + frac * (maxW - minW);
      const x = toX(xVal);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Times New Roman", Times, serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${xVal.toFixed(1)}%`, x, padT + plotH + 18);
    });

    // 95% target density horizontal line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, toY(targetRho));
    ctx.lineTo(width - padR, toY(targetRho));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px "Times New Roman", Times, serif';
    ctx.textAlign = 'right';
    ctx.fillText(`95% OPM (${targetRho.toFixed(3)} g/cm³)`, width - padR - 8, toY(targetRho) - 6);

    // Saturation Curve (Sr = 100%)
    const gs = (config.input && config.input.particleDensityGs) || 2.70;
    const satPoints: Array<{ w: number; rho: number }> = [];
    const stepSat = (maxW - minW) / 50;
    for (let w = minW; w <= maxW; w += stepSat) {
      const rhoSat = (gs * 1.0) / (1 + (w / 100) * gs);
      if (rhoSat >= minRho && rhoSat <= maxRho) {
        satPoints.push({ w, rho: rhoSat });
      }
    }
    if (satPoints.length > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      satPoints.forEach((p, idx) => {
        const x = toX(p.w);
        const y = toY(p.rho);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Fitted polynomial curve
    if (res.fittedCoefficients) {
      const { a, b, c } = res.fittedCoefficients;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      let started = false;
      const stepPoly = (maxW - minW) / 70;
      for (let w = minW; w <= maxW; w += stepPoly) {
        const rho = a * w * w + b * w + c;
        if (rho >= minRho && rho <= maxRho) {
          const x = toX(w);
          const y = toY(rho);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // Measured Experimental Points
    pts.forEach((p, idx) => {
      const cx = toX(p.waterContentPercent);
      const cy = toY(p.dryDensityGcm3);

      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Times New Roman", Times, serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.pointIndex || idx + 1}`, cx, cy - 10);
    });

    // Optimum OPM Target Marker
    if (opmW > 0 && opmRho > 0) {
      const ox = toX(opmW);
      const oy = toY(opmRho);

      // Dashed projection lines
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, padT + plotH);
      ctx.moveTo(padL, oy);
      ctx.lineTo(ox, oy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Red Bullseye
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(ox, oy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Axis Titles
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.fillText(isFr ? 'Teneur en eau w (%)' : 'Moisture Content w (%)', padL + plotW / 2, height - 15);

    ctx.save();
    ctx.translate(22, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(isFr ? 'Masse volumique sèche ρd (g/cm³)' : 'Dry Density ρd (g/cm³)', 0, 0);
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 2. GRAIN SIZE SEMI-LOGARITHMIC CURVE
  // -------------------------------------------------------------
  else if (config.type === 'grain_size') {
    const res = config.results as GrainSizeResults;
    const rows = res.rows || [];
    const validSieves = rows
      .filter((r) => typeof r.sieveMm === 'number' && r.sieveMm > 0 && typeof r.passingPercent === 'number')
      .sort((a, b) => a.sieveMm - b.sieveMm);

    const minSieve = 0.05;
    const maxSieve = Math.max(100, ...validSieves.map((s) => s.sieveMm));
    const logMin = Math.log10(minSieve);
    const logMax = Math.log10(maxSieve);

    const padL = 70;
    const padR = 40;
    const padT = 55;
    const padB = 60;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const toX = (sieve: number) => {
      const l = Math.log10(Math.max(minSieve, sieve));
      return padL + ((l - logMin) / (logMax - logMin)) * plotW;
    };
    const toY = (p: number) => padT + plotH - (Math.max(0, Math.min(100, p)) / 100) * plotH;

    // Header Title & Badges
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'COURBE GRANULOMÉTRIQUE SEMI-LOGARITHMIQUE' : 'PARTICLE SIZE DISTRIBUTION (SEMI-LOG)', 36, 30);

    const hasSpecs = validSieves.some((s) => typeof s.minSpecPercent === 'number' || typeof s.maxSpecPercent === 'number');

    ctx.font = 'bold 12px "Times New Roman", Times, serif';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText(isFr ? 'Passant cumulé (%)' : 'Cumulative Passing (%)', width - 360, 30);

    if (hasSpecs) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(isFr ? 'Fuseau de spécification' : 'Envelope specs', width - 210, 30);
    }

    if (res.cu) {
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'right';
      ctx.fillText(`Cu = ${res.cu} | Cc = ${res.cc || '-'}`, width - 40, 30);
      ctx.textAlign = 'left';
    }

    // Grid: Y-axis (0 to 100%)
    [0, 20, 40, 60, 80, 100].forEach((yVal) => {
      const y = toY(yVal);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash(yVal === 0 || yVal === 100 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Times New Roman", Times, serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${yVal}%`, padL - 10, y + 4);
    });

    // Grid: X-axis (Decade sieves)
    const decadeSieves = [0.063, 0.08, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    decadeSieves.filter((d) => d >= minSieve && d <= maxSieve).forEach((d) => {
      const x = toX(d);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash(d === 2 || d === 0.08 ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Times New Roman", Times, serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(d), x, padT + plotH + 18);
    });

    // Specification Envelope (if present)
    if (hasSpecs) {
      const minPoints = validSieves.filter((s) => typeof s.minSpecPercent === 'number');
      const maxPoints = validSieves.filter((s) => typeof s.maxSpecPercent === 'number');

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);

      if (minPoints.length > 1) {
        ctx.beginPath();
        minPoints.forEach((s, idx) => {
          const x = toX(s.sieveMm);
          const y = toY(s.minSpecPercent!);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      if (maxPoints.length > 1) {
        ctx.beginPath();
        maxPoints.forEach((s, idx) => {
          const x = toX(s.sieveMm);
          const y = toY(s.maxSpecPercent!);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Main Cumulative Passing Curve
    if (validSieves.length > 1) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      validSieves.forEach((s, idx) => {
        const x = toX(s.sieveMm);
        const y = toY(s.passingPercent);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Data Points
      validSieves.forEach((s) => {
        const x = toX(s.sieveMm);
        const y = toY(s.passingPercent);

        ctx.fillStyle = '#1e40af';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      });
    }

    // Axis Labels
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.fillText(isFr ? 'Ouverture des mailles de tamis d (mm) — Échelle logarithmique' : 'Sieve Aperture d (mm) — Logarithmic Scale', padL + plotW / 2, height - 15);

    ctx.save();
    ctx.translate(22, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(isFr ? 'Passant cumulé P (%)' : 'Cumulative Passing P (%)', 0, 0);
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 3. SPECIFIC GRAVITY (Pycnometer Determinations & Mineral Spectrum)
  // -------------------------------------------------------------
  else if (config.type === 'specific_gravity') {
    const res = config.results;
    const dets = res.determinations || [];
    const meanGs = res.meanGs || res.specificGravity || 0;
    const deltaGs = res.differenceGs || 0;
    const isAccepted = res.repeatabilityAccepted ?? (deltaGs <= 0.03);

    // Title
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'MESURE AU PYCNOMÈTRE & POSITIONNEMENT MINÉRAL' : 'PYCNOMETER MEASUREMENTS & MINERAL SPECTRUM', 36, 30);

    // Repeatability Badge
    ctx.font = 'bold 12px "Times New Roman", Times, serif';
    ctx.fillStyle = isAccepted ? '#34d399' : '#f87171';
    ctx.textAlign = 'right';
    ctx.fillText(`ΔGs = ${deltaGs.toFixed(3)} (${isAccepted ? (isFr ? 'Conforme ≤ 0.03' : 'Accepted ≤ 0.03') : (isFr ? 'Hors tolérance' : 'Rejected')})`, width - 40, 30);
    ctx.textAlign = 'left';

    // Left Column: Determinations
    const colW = (width - 80) / 2;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 55, colW, height - 90);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(30, 55, colW, height - 90);

    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'Prises d\'essai individuelles :' : 'Individual Portions :', 45, 85);

    dets.forEach((d: any, idx: number) => {
      const y = 120 + idx * 45;
      ctx.font = '13px "Times New Roman", Times, serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${isFr ? 'Essai N°' : 'Portion #'} ${d.detId || idx + 1}`, 45, y);

      ctx.font = 'bold 14px "Times New Roman", Times, serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`Gs = ${(d.specificGravityGs || 0).toFixed(3)}`, 30 + colW - 20, y);
      ctx.textAlign = 'left';
    });

    // Mean Row
    const meanY = 55 + height - 130;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(45, meanY - 20);
    ctx.lineTo(30 + colW - 20, meanY - 20);
    ctx.stroke();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText(isFr ? 'Moyenne Gs (Échantillon)' : 'Sample Mean Gs', 45, meanY + 5);

    ctx.textAlign = 'right';
    ctx.fillText(meanGs.toFixed(3), 30 + colW - 20, meanY + 5);
    ctx.textAlign = 'left';

    // Right Column: Mineral Spectrum Bars
    const rightX = 50 + colW;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rightX, 55, colW, height - 90);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(rightX, 55, colW, height - 90);

    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'Positionnement Minéralogique de Référence :' : 'Mineral Density Spectrum Comparison :', rightX + 15, 85);

    const refs = [
      { name: 'Quartz', val: 2.65, color: '#38bdf8' },
      { name: isFr ? 'Échantillon (Moyenne)' : 'Sample (Mean)', val: meanGs, color: '#10b981', highlight: true },
      { name: 'Calcite', val: 2.71, color: '#a78bfa' },
      { name: 'Basalte', val: 2.85, color: '#f59e0b' },
    ];

    refs.forEach((ref, idx) => {
      const y = 120 + idx * 55;
      ctx.font = ref.highlight ? 'bold 13px "Times New Roman", Times, serif' : '13px "Times New Roman", Times, serif';
      ctx.fillStyle = ref.highlight ? '#34d399' : '#cbd5e1';
      ctx.fillText(ref.name, rightX + 15, y);

      ctx.textAlign = 'right';
      ctx.fillText(ref.val.toFixed(2), rightX + colW - 20, y);
      ctx.textAlign = 'left';

      // Bar
      const pct = Math.max(10, Math.min(100, ((ref.val - 2.4) / (3.0 - 2.4)) * 100));
      const barW = colW - 35;
      ctx.fillStyle = '#020617';
      ctx.fillRect(rightX + 15, y + 8, barW, 10);

      ctx.fillStyle = ref.color;
      ctx.fillRect(rightX + 15, y + 8, (barW * pct) / 100, 10);
    });
  }

  // -------------------------------------------------------------
  // 4. WATER CONTENT SPECIMEN DISTRIBUTION
  // -------------------------------------------------------------
  else if (config.type === 'water_content') {
    const res = config.results;
    const specs = res.specimens || [];
    const meanW = res.meanWaterContentPercent || 0;
    const diffW = res.differenceBetweenSpecimensPercent || 0;
    const isAcc = res.repeatabilityAccepted;

    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'DISTRIBUTION DE LA TENEUR EN EAU DES ÉPROUVETTES' : 'WATER CONTENT SPECIMEN DISTRIBUTION', 36, 30);

    ctx.font = 'bold 12px "Times New Roman", Times, serif';
    ctx.fillStyle = isAcc ? '#34d399' : '#f87171';
    ctx.textAlign = 'right';
    ctx.fillText(`Δw = ${diffW}% (${isAcc ? (isFr ? 'Conforme' : 'Conform') : (isFr ? 'Écart élevé' : 'High deviation')})`, width - 40, 30);
    ctx.textAlign = 'left';

    const cardCount = Math.max(1, specs.length);
    const cardW = (width - 60 - (cardCount - 1) * 20) / cardCount;

    specs.forEach((s: any, idx: number) => {
      const cardX = 30 + idx * (cardW + 20);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cardX, 65, cardW, height - 120);
      ctx.strokeStyle = '#1e293b';
      ctx.strokeRect(cardX, 65, cardW, height - 120);

      ctx.font = '13px "Times New Roman", Times, serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`${isFr ? 'Éprouvette' : 'Specimen'} ${s.specimenId || idx + 1}`, cardX + cardW / 2, 110);

      ctx.font = 'bold 36px "Times New Roman", Times, serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${(s.waterContentPercent || 0).toFixed(1)} %`, cardX + cardW / 2, 190);

      ctx.font = '12px "Times New Roman", Times, serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Tare: ${s.containerId || '-'}`, cardX + cardW / 2, 240);
      ctx.fillText(`m0=${s.tareMassG || '-'}g | md=${s.drySoilMassG || '-'}g`, cardX + cardW / 2, 265);
    });

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText(`${isFr ? 'Teneur en eau moyenne retenue (w)' : 'Mean Moisture Content (w)'} = ${meanW}%`, width / 2, height - 20);
    ctx.textAlign = 'left';
  }

  // -------------------------------------------------------------
  // 5. SAND EQUIVALENT (Visual & Piston SE)
  // -------------------------------------------------------------
  else if (config.type === 'sand_equivalent') {
    const res = config.results;
    const esV = res.meanEsVisual || res.esVisual || 0;
    const esP = res.meanEsPiston || res.esPiston || 0;

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'INDICE D\'ÉQUIVALENT DE SABLE (ES) & SEUILS DE PROPRETÉ' : 'SAND EQUIVALENT INDEX (SE) & CLEANLINESS GAUGE', 36, 30);

    const colW = (width - 80) / 2;

    // Card 1: ES Visual
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 60, colW, 140);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(30, 60, colW, 140);

    ctx.font = '13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(isFr ? 'ES Visuel (ESv)' : 'Visual SE (ESv)', 30 + colW / 2, 95);

    ctx.font = 'bold 36px "Times New Roman", Times, serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${esV.toFixed(1)} %`, 30 + colW / 2, 155);

    // Card 2: ES Piston
    const c2X = 50 + colW;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(c2X, 60, colW, 140);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(c2X, 60, colW, 140);

    ctx.font = '13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'ES Piston (ESp)' : 'Piston SE (ESp)', c2X + colW / 2, 95);

    ctx.font = 'bold 36px "Times New Roman", Times, serif';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText(`${esP.toFixed(1)} %`, c2X + colW / 2, 155);

    // Cleanliness Gauge
    const gaugeY = 230;
    const gaugeW = width - 60;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, gaugeY, gaugeW, 160);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(30, gaugeY, gaugeW, 160);

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(isFr ? 'Échelle de Propreté (Seuils Normatifs NF P94-071-1 / EN 933-8) :' : 'Cleanliness Scale (Normative Thresholds) :', 45, gaugeY + 30);

    const currentCat = esP < 60
      ? (isFr ? 'Sol Argileux (Rejet)' : 'Clayey Soil (Reject)')
      : esP <= 70
      ? (isFr ? 'Légèrement Argileux (Remblai)' : 'Slightly Clayey')
      : esP <= 80
      ? (isFr ? 'Sable Propre Béton' : 'Clean Concrete Sand')
      : (isFr ? 'Sable Très Propre' : 'Very Clean Sand');

    ctx.textAlign = 'right';
    ctx.font = 'bold 14px "Times New Roman", Times, serif';
    ctx.fillStyle = esP >= 70 ? '#34d399' : esP >= 60 ? '#fbbf24' : '#ef4444';
    ctx.fillText(currentCat, 30 + gaugeW - 15, gaugeY + 30);
    ctx.textAlign = 'left';

    // Segmented Bar
    const barX = 45;
    const barY = gaugeY + 55;
    const totalBarW = gaugeW - 30;

    // Segment 1: < 60%
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(barX, barY, totalBarW * 0.6, 20);

    // Segment 2: 60 - 70%
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(barX + totalBarW * 0.6, barY, totalBarW * 0.1, 20);

    // Segment 3: 70 - 80%
    ctx.fillStyle = '#10b981';
    ctx.fillRect(barX + totalBarW * 0.7, barY, totalBarW * 0.1, 20);

    // Segment 4: > 80%
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(barX + totalBarW * 0.8, barY, totalBarW * 0.2, 20);

    // Marker for current ESp
    const markerFrac = Math.max(0, Math.min(100, esP)) / 100;
    const markerX = barX + totalBarW * markerFrac;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(markerX, barY - 4);
    ctx.lineTo(markerX - 6, barY - 14);
    ctx.lineTo(markerX + 6, barY - 14);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 12px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${esP.toFixed(1)}%`, markerX, barY - 18);

    // Threshold labels
    ctx.font = '11px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('0%', barX, barY + 38);
    ctx.fillText('60%', barX + totalBarW * 0.6, barY + 38);
    ctx.fillText('70%', barX + totalBarW * 0.7, barY + 38);
    ctx.fillText('80%', barX + totalBarW * 0.8, barY + 38);
    ctx.fillText('100%', barX + totalBarW, barY + 38);
    ctx.textAlign = 'left';
  }

  // -------------------------------------------------------------
  // 6. LOS ANGELES & MICRO-DEVAL (Mechanical Resistance)
  // -------------------------------------------------------------
  else if (config.type === 'los_angeles' || config.type === 'micro_deval') {
    const isLA = config.type === 'los_angeles';
    const res = config.results;
    const coeff = isLA ? (res.laCoefficient ?? res.meanLa ?? 0) : (res.mdeCoefficient ?? res.meanMde ?? 0);
    const cat = isLA ? res.laCategory : res.mdeCategory;

    ctx.fillStyle = isLA ? '#f43f5e' : '#a855f7';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      isLA
        ? (isFr ? 'COEFFICIENT LOS ANGELES (RÉSISTANCE À LA FRAGMENTATION)' : 'LOS ANGELES COEFFICIENT (IMPACT RESISTANCE)')
        : (isFr ? 'COEFFICIENT MICRO-DEVAL (USURE EN PRÉSENCE D\'EAU)' : 'MICRO-DEVAL COEFFICIENT (WET WEAR RESISTANCE)'),
      36,
      30
    );

    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText(cat || (isLA ? `LA ${Math.ceil(coeff / 5) * 5}` : `MDE ${Math.ceil(coeff / 5) * 5}`), width - 40, 30);
    ctx.textAlign = 'left';

    // Main Box
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 65, width - 60, height - 100);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(30, 65, width - 60, height - 100);

    // Left Metric
    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isLA ? (isFr ? 'Coefficient LA :' : 'LA Coefficient :') : (isFr ? 'Coefficient MDE :' : 'MDE Coefficient :'), 60, 120);

    ctx.font = 'bold 54px "Times New Roman", Times, serif';
    ctx.fillStyle = coeff <= 25 ? '#34d399' : coeff <= 35 ? '#fbbf24' : '#ef4444';
    ctx.fillText(`${coeff.toFixed(1)} %`, 60, 190);

    // Right Diagnostics
    const rightX = width / 2;
    ctx.font = 'bold 16px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    const diagTitle = coeff <= 20
      ? (isFr ? 'Très Haute Dureté (Couche de Roulement)' : 'High Wear Resistance (Surface Course)')
      : coeff <= 30
      ? (isFr ? 'Dureté Moyenne (Couche de Base / Fondation)' : 'Medium Hardness (Base Course)')
      : (isFr ? 'Matériau Évolutif ou Tendre (Remblais)' : 'Soft Material (Fill only)');
    ctx.fillText(diagTitle, rightX, 130);

    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'Norme d\'essai : NF EN 1097-2 / ASTM C131' : 'Standard: NF EN 1097-2 / ASTM C131', rightX, 165);
    ctx.fillText(isFr ? 'Contrôle de conformité granulats pour assises et enrobés' : 'Aggregate compliance for subbase and asphalt', rightX, 195);
  }

  // -------------------------------------------------------------
  // 7. FLAKINESS INDEX (Forme des granulats)
  // -------------------------------------------------------------
  else if (config.type === 'flakiness') {
    const res = config.results;
    const fi = res.flakinessIndexA ?? res.globalFlakinessIndex ?? 0;
    const cat = res.flakinessCategory;

    ctx.fillStyle = '#14b8a6';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'INDICE D\'APLATISSEMENT GLOBAL (FI) & FORME' : 'GLOBAL FLAKINESS INDEX (FI) & AGGREGATE SHAPE', 36, 30);

    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.fillStyle = '#2dd4bf';
    ctx.textAlign = 'right';
    ctx.fillText(cat || `FI ${Math.ceil(fi / 5) * 5}`, width - 40, 30);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 65, width - 60, height - 100);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(30, 65, width - 60, height - 100);

    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'Indice Global d\'Aplatissement (FI) :' : 'Global Flakiness Index :', 60, 120);

    ctx.font = 'bold 54px "Times New Roman", Times, serif';
    ctx.fillStyle = fi <= 20 ? '#34d399' : fi <= 35 ? '#fbbf24' : '#ef4444';
    ctx.fillText(`${fi.toFixed(1)} %`, 60, 190);

    const rightX = width / 2;
    ctx.font = 'bold 16px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    const shapeTitle = fi <= 15
      ? (isFr ? 'Forme cubique optimale (Enrobés / Bétons)' : 'Optimal cubic shape (Asphalt / Concrete)')
      : fi <= 25
      ? (isFr ? 'Forme courante acceptable' : 'Acceptable aggregate shape')
      : (isFr ? 'Granulats plats excessifs (Rejet couches nobles)' : 'Excessive flat particles (Reject)');
    ctx.fillText(shapeTitle, rightX, 130);

    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'Norme d\'essai : NF EN 933-3' : 'Standard: NF EN 933-3', rightX, 165);
    ctx.fillText(isFr ? 'Tamisage sur grilles à fentes parallèles' : 'Sieving on bar sieves with parallel slots', rightX, 195);
  }

  // -------------------------------------------------------------
  // 8. METHYLENE BLUE (VBS & Soil Sensitivity)
  // -------------------------------------------------------------
  else if (config.type === 'methylene_blue') {
    const res = config.results;
    const vbs = res.primaryValue ?? res.vbsValue ?? res.mbValue ?? 0;
    const sensClass = res.soilSensitivityClass || '';

    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'VALEUR DE BLEU DU SOL (VBS) — CLASSIFICATION GTR' : 'METHYLENE BLUE VALUE (VBS) — SOIL SENSITIVITY', 36, 30);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 65, width - 60, height - 100);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(30, 65, width - 60, height - 100);

    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(isFr ? 'Valeur VBS :' : 'VBS Value :', 60, 120);

    ctx.font = 'bold 54px "Times New Roman", Times, serif';
    ctx.fillStyle = '#60a5fa';
    ctx.fillText(`${vbs.toFixed(2)} g/100g`, 60, 190);

    const rightX = width / 2;
    ctx.font = 'bold 16px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sensClass || (vbs < 1.5 ? (isFr ? 'Sableux peu sensible' : 'Low sensitivity sand') : (isFr ? 'Sol argileux plastique' : 'Plastic clayey soil')), rightX, 130);

    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      vbs < 0.1
        ? (isFr ? 'Sol insensible à l\'eau (Sols sableux purs)' : 'Water-insensitive soil')
        : vbs < 1.5
        ? (isFr ? 'Sol peu argileux à moyen (Sensibilité modérée)' : 'Low to medium clay activity')
        : (isFr ? 'Sol très argileux plastique (Sensibilité élevée au gonflement)' : 'Highly plastic swelling clay'),
      rightX,
      165
    );
    ctx.fillText(isFr ? 'Norme d\'essai : NF P94-068' : 'Standard: NF P94-068', rightX, 195);
  }

  // -------------------------------------------------------------
  // 9. MULTI GRAIN SIZE OVERLAY (Studies Section 5)
  // -------------------------------------------------------------
  else if (config.type === 'multi_grain_size') {
    const minLog = Math.log10(0.01);
    const maxLog = Math.log10(100);
    const padL = 70;
    const padR = 40;
    const padT = 55;
    const padB = 60;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const toX = (sieve: number) => {
      const clamped = Math.max(0.01, Math.min(100, sieve));
      return padL + ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * plotW;
    };
    const toY = (pct: number) => padT + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH;

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(24, 25, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 15px "Times New Roman", Times, serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(isFr ? 'SUPERPOSITION DES COURBES GRANULOMÉTRIQUES' : 'GRADING CURVES OVERLAY', 36, 30);

    // Grid
    [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].forEach((d) => {
      const x = toX(d);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash(d === 0.08 || d === 2 ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Times New Roman", Times, serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(d), x, padT + plotH + 18);
    });

    for (let yPct = 0; yPct <= 100; yPct += 20) {
      const y = toY(yPct);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash(yPct === 0 || yPct === 100 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px "Times New Roman", Times, serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${yPct}%`, padL - 10, y + 4);
    }

    const defaultColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    config.series.forEach((s, idx) => {
      if (s.points && s.points.length > 1) {
        const color = s.color || defaultColors[idx % defaultColors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        s.points.forEach((p, pIdx) => {
          const x = toX(p.sieveMm);
          const y = toY(p.passingPercent);
          if (pIdx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        s.points.forEach((p) => {
          const x = toX(p.sieveMm);
          const y = toY(p.passingPercent);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.fillText(isFr ? 'Dimension des mailles d (mm) — Échelle logarithmique' : 'Sieve opening d (mm) — Logarithmic scale', padL + plotW / 2, height - 15);

    ctx.save();
    ctx.translate(22, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(isFr ? 'Passant cumulé (%)' : 'Cumulative Passing (%)', 0, 0);
    ctx.restore();
  }
}

// -------------------------------------------------------------------------
// Vector Chart Rendering for PDF
// -------------------------------------------------------------------------

export function drawVectorMultiGrainSizeChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  w: number,
  h: number,
  series: Array<{ name: string; colorHex?: string; points: Array<{ sieveMm: number; passingPercent: number }> }>,
  lang: 'en' | 'fr'
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(cx, cy, w, h, 1.5, 1.5, 'FD');

  const plotX = cx + 12;
  const plotY = cy + 8;
  const plotW = w - 16;
  const plotH = h - 18;

  // Scales: log 0.01 to 100 mm
  const minLog = Math.log10(0.01);
  const maxLog = Math.log10(100);
  const toX = (d: number) => {
    const clamped = Math.max(0.01, Math.min(100, d));
    return plotX + ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * plotW;
  };
  const toY = (pct: number) => plotY + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH;

  // Background Grid Lines
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.3);
  [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].forEach((d) => {
    const gx = toX(d);
    doc.line(gx, plotY, gx, plotY + plotH);
  });
  for (let pct = 0; pct <= 100; pct += 20) {
    const gy = toY(pct);
    doc.line(plotX, gy, plotX + plotW, gy);
  }

  // Draw curves with distinct colors
  const defaultColors = [
    [30, 64, 175],   // Blue
    [220, 38, 38],   // Red
    [16, 185, 129],  // Emerald
    [217, 119, 6],   // Amber
    [147, 51, 234],  // Purple
  ];

  series.forEach((s, sIdx) => {
    const [cr, cg, cb] = defaultColors[sIdx % defaultColors.length];
    doc.setDrawColor(cr, cg, cb);
    doc.setLineWidth(0.6);

    const pts = s.points || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      doc.line(toX(p1.sieveMm), toY(p1.passingPercent), toX(p2.sieveMm), toY(p2.passingPercent));
    }
  });

  // Chart Title & Axes
  doc.setFont('times', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    lang === 'fr' ? 'COURBES GRANULOMÉTRIQUES SUPERPOSÉES' : 'GRADING CURVES OVERLAY',
    plotX + 2,
    plotY - 2.5
  );

  doc.setFont('times', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('0.01', toX(0.01), plotY + plotH + 3, { align: 'center' });
  doc.text('0.1', toX(0.1), plotY + plotH + 3, { align: 'center' });
  doc.text('1', toX(1), plotY + plotH + 3, { align: 'center' });
  doc.text('10', toX(10), plotY + plotH + 3, { align: 'center' });
  doc.text('100', toX(100), plotY + plotH + 3, { align: 'center' });
}
