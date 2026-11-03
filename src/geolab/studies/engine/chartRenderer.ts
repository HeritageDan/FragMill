/**
 * Chart rendering engine for FraGeo Lab Studies.
 * - renderChartToPng: Shared canvas renderer for Word (.docx) export
 * - Vector chart renderers for PDF export
 */

import type jsPDF from 'jspdf';
import type { ProctorResults } from '../../tests/proctor';
import type { GrainSizeResults } from '../../tests/grainSize';

export type ChartConfig =
  | {
      type: 'proctor';
      results: ProctorResults;
      primaryColor?: string;
      lang?: 'en' | 'fr';
    }
  | {
      type: 'grain_size';
      results: GrainSizeResults;
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
    };

// Minimal valid 1x1 PNG byte array fallback for headless / test environments
const FALLBACK_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x60,
  0x00, 0x00, 0x00, 0x05, 0x00, 0x01, 0xa7, 0x35, 0x19, 0xd6, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

export async function renderChartToPng(config: ChartConfig): Promise<Uint8Array> {
  if (typeof document === 'undefined' || !document.createElement) {
    return FALLBACK_1X1_PNG;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return FALLBACK_1X1_PNG;

    const width = 800;
    const height = 450;
    const paddingLeft = 70;
    const paddingRight = 30;
    const paddingTop = 40;
    const paddingBottom = 60;
    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(paddingLeft, paddingTop, plotW, plotH);

    const lang = config.lang || 'en';
    const primaryColor = config.primaryColor || '#1e40af';

    if (config.type === 'proctor') {
      const res = config.results;
      const pts = res.points || [];
      const minW = Math.max(0, Math.min(...pts.map((p) => p.waterContentPercent)) - 2);
      const maxW = Math.max(
        ...pts.map((p) => p.waterContentPercent),
        ...res.saturationCurve.map((s) => s.saturationWaterContentPercent)
      ) + 2;
      const minRho = Math.min(...pts.map((p) => p.dryDensityGcm3)) * 0.95;
      const maxRho = Math.max(...pts.map((p) => p.dryDensityGcm3)) * 1.05;

      const toX = (wVal: number) => paddingLeft + ((wVal - minW) / (maxW - minW || 1)) * plotW;
      const toY = (rVal: number) => paddingTop + plotH - ((rVal - minRho) / (maxRho - minRho || 1)) * plotH;

      // Grid
      ctx.strokeStyle = '#f1f5f9';
      for (let i = 0; i <= 5; i++) {
        const y = paddingTop + (plotH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(paddingLeft + plotW, y);
        ctx.stroke();

        const x = paddingLeft + (plotW / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, paddingTop + plotH);
        ctx.stroke();
      }

      // Title & Labels
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(lang === 'fr' ? 'Courbe de Compactage Proctor' : 'Proctor Compaction Curve', paddingLeft, 25);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(lang === 'fr' ? 'Teneur en eau w (%)' : 'Moisture Content w (%)', width / 2 - 50, height - 15);

      ctx.save();
      ctx.translate(20, height / 2 + 50);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(lang === 'fr' ? 'Masse volumique sèche ρd (g/cm³)' : 'Dry Density ρd (g/cm³)', 0, 0);
      ctx.restore();

      // Saturation Curve (red dashed)
      if (res.saturationCurve && res.saturationCurve.length > 1) {
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.beginPath();
        res.saturationCurve.forEach((p, idx) => {
          const x = toX(p.saturationWaterContentPercent);
          const y = toY(p.dryDensityGcm3);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Polynomial Fit Curve
      const coeffs = res.fittedCoefficients?.allCoeffs;
      if (coeffs && coeffs.length >= 3 && pts.length > 0) {
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const minPtW = Math.min(...pts.map((p) => p.waterContentPercent));
        const maxPtW = Math.max(...pts.map((p) => p.waterContentPercent));
        const steps = 30;
        for (let s = 0; s <= steps; s++) {
          const curW = minPtW + (s / steps) * (maxPtW - minPtW);
          let curRho = 0;
          for (let d = 0; d < coeffs.length; d++) {
            curRho += coeffs[d] * Math.pow(curW, d);
          }
          const x = toX(curW);
          const y = toY(curRho);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Experimental Points
      pts.forEach((p) => {
        const x = toX(p.waterContentPercent);
        const y = toY(p.dryDensityGcm3);
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else if (config.type === 'grain_size') {
      const res = config.results;
      const pts = res.rows || [];

      // Logarithmic x-axis from 0.01 to 100 mm (4 decades)
      const minLog = Math.log10(0.01);
      const maxLog = Math.log10(100);

      const toX = (sieve: number) => {
        const clamped = Math.max(0.01, Math.min(100, sieve));
        return paddingLeft + ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * plotW;
      };
      const toY = (pct: number) => paddingTop + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH;

      // Title & Labels
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(lang === 'fr' ? 'Courbe Granulométrique' : 'Particle Size Distribution', paddingLeft, 25);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(lang === 'fr' ? 'Ouverture des tamis (mm) [échelle log]' : 'Sieve opening (mm) [log scale]', width / 2 - 80, height - 15);

      ctx.save();
      ctx.translate(20, height / 2 + 40);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(lang === 'fr' ? 'Passant cumulé (%)' : 'Cumulative Passing (%)', 0, 0);
      ctx.restore();

      // Log Grid
      ctx.strokeStyle = '#f1f5f9';
      [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].forEach((d) => {
        const x = toX(d);
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, paddingTop + plotH);
        ctx.stroke();
      });
      for (let yPct = 0; yPct <= 100; yPct += 20) {
        const y = toY(yPct);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(paddingLeft + plotW, y);
        ctx.stroke();
      }

      // Draw Curve
      if (pts.length > 1) {
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const x = toX(p.sieveMm);
          const y = toY(p.passingPercent);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Points
        pts.forEach((p) => {
          const x = toX(p.sieveMm);
          const y = toY(p.passingPercent);
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    } else if (config.type === 'multi_grain_size') {
      const minLog = Math.log10(0.01);
      const maxLog = Math.log10(100);
      const toX = (sieve: number) => {
        const clamped = Math.max(0.01, Math.min(100, sieve));
        return paddingLeft + ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * plotW;
      };
      const toY = (pct: number) => paddingTop + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH;

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(lang === 'fr' ? 'Superposition des Courbes Granulométriques' : 'Grading Curves Overlay', paddingLeft, 25);

      // Grid
      ctx.strokeStyle = '#f1f5f9';
      [0.01, 0.1, 1, 10, 100].forEach((d) => {
        const x = toX(d);
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, paddingTop + plotH);
        ctx.stroke();
      });

      // Draw each series
      config.series.forEach((s) => {
        if (s.points && s.points.length > 1) {
          ctx.strokeStyle = s.color || primaryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          s.points.forEach((p, idx) => {
            const x = toX(p.sieveMm);
            const y = toY(p.passingPercent);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
      });
    }

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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    lang === 'fr' ? 'COURBES GRANULOMÉTRIQUES SUPERPOSÉES' : 'GRADING CURVES OVERLAY',
    plotX + 2,
    plotY - 2.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('0.01', toX(0.01), plotY + plotH + 3, { align: 'center' });
  doc.text('0.1', toX(0.1), plotY + plotH + 3, { align: 'center' });
  doc.text('1', toX(1), plotY + plotH + 3, { align: 'center' });
  doc.text('10', toX(10), plotY + plotH + 3, { align: 'center' });
  doc.text('100', toX(100), plotY + plotH + 3, { align: 'center' });
}
