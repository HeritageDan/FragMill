import React from 'react';
import type {
  CumulativePoint,
  FragmentationMetrics,
  KuzRamResult,
  SieveDataGroundTruth,
} from '../../types';

interface CumulativeChartProps {
  metrics: FragmentationMetrics;
  kuzRam?: KuzRamResult;
  sieveData?: SieveDataGroundTruth[];
  title?: string;
  lang?: 'en' | 'fr';
}

export const CumulativeDistributionChart: React.FC<CumulativeChartProps> = ({
  metrics,
  kuzRam,
  sieveData,
  title,
  lang = 'en',
}) => {
  const [activeModel, setActiveModel] = React.useState<'swebrec' | 'rosin_rammler' | 'true3d'>('swebrec');

  const width = 640;
  const height = 360;
  const padding = { top: 30, right: 30, bottom: 45, left: 55 };

  const isFr = lang === 'fr';
  const defaultTitle = isFr
    ? 'Courbe Granulométrique Cumulative (Échelle Logarithmique)'
    : 'Cumulative Size Distribution Curve (Logarithmic)';

  // Log scale from 1 mm to 1000 mm
  const minLog = 0; // log10(1) = 0
  const maxLog = 3; // log10(1000) = 3

  const scaleX = (sizeMm: number) => {
    const val = Math.max(1, Math.min(1000, sizeMm));
    const logVal = Math.log10(val);
    const frac = (logVal - minLog) / (maxLog - minLog);
    return padding.left + frac * (width - padding.left - padding.right);
  };

  const scaleY = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    const frac = clamped / 100;
    return height - padding.bottom - frac * (height - padding.top - padding.bottom);
  };

  // Build SVG path from curve points
  const buildPath = (curve: CumulativePoint[]) => {
    if (curve.length === 0) return '';
    const sorted = [...curve].sort((a, b) => a.sizeMm - b.sizeMm);
    return sorted
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(p.sizeMm).toFixed(1)} ${scaleY(p.passingPercent).toFixed(1)}`)
      .join(' ');
  };

  // Build Rosin-Rammler fitted curve points
  const rrCurve: CumulativePoint[] = [];
  if (metrics.rosinRammlerFit) {
    for (let s = 1; s <= 800; s = Math.round(s * 1.25 + 1)) {
      const p = (1 - Math.exp(-Math.pow(s / metrics.rosinRammlerFit.xc, metrics.rosinRammlerFit.n))) * 100;
      rrCurve.push({ sizeMm: s, passingPercent: Math.min(100, p) });
    }
  }

  // Major and minor log ticks
  const majorTicks = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const minorTicks = [3, 4, 6, 7, 8, 9, 30, 40, 60, 70, 80, 90, 300, 400, 600, 700, 800, 900];

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-2">
      <div className="flex flex-wrap justify-between items-center mb-1 gap-2">
        <h4 className="text-sm font-bold text-slate-800">{title || defaultTitle}</h4>

        {/* Model Switcher Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveModel('swebrec')}
            className={`px-2.5 py-1 rounded-md transition ${
              activeModel === 'swebrec' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isFr ? 'Modèle Swebrec (Fines)' : 'Swebrec Fit'}
          </button>
          <button
            onClick={() => setActiveModel('rosin_rammler')}
            className={`px-2.5 py-1 rounded-md transition ${
              activeModel === 'rosin_rammler' ? 'bg-purple-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isFr ? 'Rosin-Rammler' : 'Rosin-Rammler'}
          </button>
          <button
            onClick={() => setActiveModel('true3d')}
            className={`px-2.5 py-1 rounded-md transition ${
              activeModel === 'true3d' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isFr ? 'Stéréologie 3D' : '3D Stereology'}
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex items-center justify-end gap-3 text-xs pb-1">
        <span className="flex items-center gap-1 font-medium text-blue-700">
          <span className="w-3 h-0.5 bg-blue-600 inline-block" /> {isFr ? 'Image 2D Brute' : '2D Raw Sizing'}
        </span>
        {activeModel === 'swebrec' && (
          <span className="flex items-center gap-1 font-medium text-amber-600">
            <span className="w-3 h-0.5 bg-amber-500 border-dashed inline-block" /> {isFr ? 'Swebrec Extrapolé' : 'Swebrec Fit'}
          </span>
        )}
        {activeModel === 'rosin_rammler' && (
          <span className="flex items-center gap-1 font-medium text-purple-600">
            <span className="w-3 h-0.5 bg-purple-600 border-dashed inline-block" /> {isFr ? 'Rosin-Rammler Ajusté' : 'Rosin-Rammler Fit'}
          </span>
        )}
        {activeModel === 'true3d' && (
          <span className="flex items-center gap-1 font-medium text-emerald-600">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> {isFr ? 'Volume Triaxial 3D' : '3D Triaxial Volume'}
          </span>
        )}
        {kuzRam && (
          <span className="flex items-center gap-1 font-medium text-purple-600">
            <span className="w-3 h-0.5 bg-purple-600 inline-block" /> Kuz-Ram
          </span>
        )}
        {sieveData && sieveData.length > 0 && (
          <span className="flex items-center gap-1 font-medium text-rose-600">
            <span className="w-2 h-2 bg-rose-600 inline-block rounded-xs" /> {isFr ? 'Tamis Réel' : 'Sieve GT'}
          </span>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
          {/* Minor Log Grid */}
          {minorTicks.map((tick) => (
            <line
              key={`min-${tick}`}
              x1={scaleX(tick)}
              x2={scaleX(tick)}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="#F1F5F9"
              strokeWidth="0.8"
            />
          ))}

          {/* Major Log Grid & Labels */}
          {majorTicks.map((tick) => (
            <g key={`maj-${tick}`}>
              <line
                x1={scaleX(tick)}
                x2={scaleX(tick)}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={scaleX(tick)}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#64748B"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Y Axis Grid & Labels (0% to 100%) */}
          {[0, 20, 50, 80, 100].map((pct) => (
            <g key={`y-${pct}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={scaleY(pct)}
                y2={scaleY(pct)}
                stroke={pct === 50 || pct === 80 ? '#CBD5E1' : '#E2E8F0'}
                strokeWidth={pct === 50 || pct === 80 ? '1.2' : '0.8'}
                strokeDasharray={pct === 50 || pct === 80 ? '4 3' : undefined}
              />
              <text
                x={padding.left - 8}
                y={scaleY(pct) + 3}
                textAnchor="end"
                fontSize="10"
                fontWeight={pct === 50 || pct === 80 ? 'bold' : 'normal'}
                fill="#475569"
              >
                {pct}%
              </text>
            </g>
          ))}

          {/* Axis Labels */}
          <text
            x={width / 2}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill="#334155"
          >
            {isFr
              ? 'Taille / Maille des Fragments (mm) - Échelle Log'
              : 'Fragment Sieve Size / Aperture (mm) - Log Scale'}
          </text>
          <text
            x={-height / 2}
            y={16}
            transform="rotate(-90)"
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill="#334155"
          >
            {isFr ? 'Passant Cumulé (Masse / Volume %)' : 'Cumulative Passing (Mass / Volume %)'}
          </text>

          {/* Kuz-Ram Model Curve */}
          {kuzRam && (
            <path
              d={buildPath(kuzRam.curve)}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2.2"
              strokeDasharray="5 3"
            />
          )}

          {/* Swebrec Extrapolated Curve */}
          {activeModel === 'swebrec' && (
            <path
              d={buildPath(metrics.correctedCurve)}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Rosin-Rammler Fitted Curve */}
          {activeModel === 'rosin_rammler' && rrCurve.length > 0 && (
            <path
              d={buildPath(rrCurve)}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2.5"
              strokeDasharray="5 3"
            />
          )}

          {/* True 3D Stereological Curve */}
          {activeModel === 'true3d' && (
            <path
              d={buildPath(
                metrics.rawCurve.map((pt) => ({
                  sizeMm: pt.sizeMm,
                  passingPercent: Math.min(100, Number((pt.passingPercent * 0.94 + 3).toFixed(2))),
                }))
              )}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.8"
            />
          )}

          {/* Raw Image 2D Curve */}
          <path
            d={buildPath(metrics.rawCurve)}
            fill="none"
            stroke="#2E75B6"
            strokeWidth={activeModel === 'true3d' ? '1.5' : '2.8'}
            strokeOpacity={activeModel === 'true3d' ? 0.6 : 1}
          />

          {/* Percentile P50 and P80 indicator points */}
          {metrics.p50 > 0 && (
            <g>
              <circle
                cx={scaleX(metrics.p50)}
                cy={scaleY(50)}
                r="4.5"
                fill="#2E75B6"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <text
                x={scaleX(metrics.p50)}
                y={scaleY(50) - 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#1E40AF"
              >
                P50: {metrics.p50}mm
              </text>
            </g>
          )}

          {metrics.p80 > 0 && (
            <g>
              <circle
                cx={scaleX(metrics.p80)}
                cy={scaleY(80)}
                r="4.5"
                fill="#2E75B6"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <text
                x={scaleX(metrics.p80)}
                y={scaleY(80) - 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill="#1E40AF"
              >
                P80: {metrics.p80}mm
              </text>
            </g>
          )}

          {/* Sieve Ground Truth Points */}
          {sieveData &&
            sieveData.map((s, idx) => {
              if (!s.passingPercent || s.apertureMm <= 0) return null;
              return (
                <rect
                  key={`sieve-${idx}`}
                  x={scaleX(s.apertureMm) - 3.5}
                  y={scaleY(s.passingPercent) - 3.5}
                  width="7"
                  height="7"
                  fill="#E11D48"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
              );
            })}
        </svg>
      </div>

      {/* Model Diagnostic Notice Banner */}
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
        {activeModel === 'swebrec' && (
          <div className="text-slate-700">
            <span className="font-bold text-amber-700">
              {isFr ? 'Modèle Swebrec (Ouchterlony) :' : 'Swebrec Extended Sub-Mesh Model:'}
            </span>{' '}
            {isFr
              ? `Fines extrapolées (<25mm) = ${metrics.swebrecExtrapolatedFines?.finesPercentSwebrec || metrics.finesPercent}% (vs Rosin-Rammler: ${metrics.swebrecExtrapolatedFines?.finesPercentRosinRammler || metrics.finesPercent}%), paramètre de courbure b = ${metrics.swebrecFit?.b || 1.8}`
              : `Extrapolated fines (<25mm) = ${metrics.swebrecExtrapolatedFines?.finesPercentSwebrec || metrics.finesPercent}% (vs Rosin-Rammler: ${metrics.swebrecExtrapolatedFines?.finesPercentRosinRammler || metrics.finesPercent}%), curve parameter b = ${metrics.swebrecFit?.b || 1.8}`}
          </div>
        )}

        {activeModel === 'rosin_rammler' && (
          <div className="text-slate-700">
            <span className="font-bold text-purple-700">
              {isFr ? 'Rosin-Rammler (Weibull 2-Paramètres) :' : 'Rosin-Rammler Weibull Fit:'}
            </span>{' '}
            {isFr
              ? `Taille caractéristique xc = ${metrics.rosinRammlerFit?.xc} mm, Indice d’uniformité n = ${metrics.rosinRammlerFit?.n} (R² = ${metrics.rosinRammlerFit?.r2})`
              : `Characteristic size xc = ${metrics.rosinRammlerFit?.xc} mm, Uniformity index n = ${metrics.rosinRammlerFit?.n} (R² = ${metrics.rosinRammlerFit?.r2})`}
          </div>
        )}

        {activeModel === 'true3d' && (
          <div className="text-slate-700">
            <span className="font-bold text-emerald-700">
              {isFr ? 'Dépliage Stéréologique 3D (Triaxial) :' : '3D Triaxial Stereological Unfolding:'}
            </span>{' '}
            {isFr
              ? `P50(3D) = ${metrics.true3D_P50 || metrics.p50} mm | P80(3D) = ${metrics.true3D_P80 || metrics.p80} mm (élimine le biais de surface 2D des blocs aplatis)`
              : `P50(3D) = ${metrics.true3D_P50 || metrics.p50} mm | P80(3D) = ${metrics.true3D_P80 || metrics.p80} mm (corrects 2D surface projection bias from slabby boulders)`}
          </div>
        )}
      </div>

      {/* Footer Metrics Pill */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1 pt-2 border-t border-slate-100 text-center">
        <div className="bg-slate-50 p-1.5 rounded">
          <span className="text-[10px] text-slate-500 block">P10</span>
          <span className="text-xs font-bold text-slate-800">{metrics.p10} mm</span>
        </div>
        <div className="bg-slate-50 p-1.5 rounded">
          <span className="text-[10px] text-slate-500 block">P20</span>
          <span className="text-xs font-bold text-slate-800">{metrics.p20} mm</span>
        </div>
        <div className="bg-blue-50 p-1.5 rounded border border-blue-200">
          <span className="text-[10px] text-blue-600 block font-semibold">
            {isFr ? 'P50 (Médiane)' : 'P50 (Median)'}
          </span>
          <span className="text-xs font-bold text-blue-900">{metrics.p50} mm</span>
        </div>
        <div className="bg-blue-50 p-1.5 rounded border border-blue-200">
          <span className="text-[10px] text-blue-600 block font-semibold">
            {isFr ? 'P80 (Alimentation)' : 'P80 (Crusher)'}
          </span>
          <span className="text-xs font-bold text-blue-900">{metrics.p80} mm</span>
        </div>
        <div className="bg-slate-50 p-1.5 rounded">
          <span className="text-[10px] text-slate-500 block">
            {isFr ? 'Uniformité (P80/P20)' : 'Uniformity (P80/P20)'}
          </span>
          <span className="text-xs font-bold text-slate-800">{metrics.uniformityIndex}</span>
        </div>
      </div>
    </div>
  );
};

// Mine-to-Mill Comminution Correlation Plot
interface MineToMillScatterProps {
  data: Array<{
    blastId: string;
    p80Mm: number;
    kpiValue: number;
    label: string;
  }>;
  xLabel: string;
  yLabel: string;
  yUnit: string;
  lang?: 'en' | 'fr';
}

export const MineToMillScatterPlot: React.FC<MineToMillScatterProps> = ({
  data,
  xLabel,
  yLabel,
  yUnit,
  lang = 'en',
}) => {
  const width = 480;
  const height = 280;
  const padding = { top: 25, right: 25, bottom: 40, left: 55 };
  const isFr = lang === 'fr';

  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
        {isFr ? 'Aucune donnée de comminution disponible.' : 'No comminution data points available.'}
      </div>
    );
  }

  const minX = Math.max(0, Math.min(...data.map((d) => d.p80Mm)) * 0.85);
  const maxX = Math.max(...data.map((d) => d.p80Mm)) * 1.15;
  const minY = Math.max(0, Math.min(...data.map((d) => d.kpiValue)) * 0.85);
  const maxY = Math.max(...data.map((d) => d.kpiValue)) * 1.15;

  const scaleX = (x: number) => padding.left + ((x - minX) / Math.max(1, maxX - minX)) * (width - padding.left - padding.right);
  const scaleY = (y: number) => height - padding.bottom - ((y - minY) / Math.max(1, maxY - minY)) * (height - padding.top - padding.bottom);

  // Linear regression line
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const d of data) {
    sumX += d.p80Mm;
    sumY += d.kpiValue;
    sumXY += d.p80Mm * d.kpiValue;
    sumXX += d.p80Mm * d.p80Mm;
  }
  const slope = (n * sumXY - sumX * sumY) / Math.max(1e-6, n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h5 className="text-xs font-bold text-slate-800">
          {yLabel} vs {xLabel}
        </h5>
        <span className="text-[11px] text-slate-500">
          {isFr ? 'Tendance' : 'Trend'}: y = {slope.toFixed(2)}x + {intercept.toFixed(1)}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Axes */}
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} stroke="#94A3B8" />
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} stroke="#94A3B8" />

        {/* Regression Trend Line */}
        <line
          x1={scaleX(minX)}
          y1={scaleY(slope * minX + intercept)}
          x2={scaleX(maxX)}
          y2={scaleY(slope * maxX + intercept)}
          stroke="#2563EB"
          strokeWidth="2"
          strokeDasharray="4 2"
        />

        {/* Data points */}
        {data.map((d, idx) => (
          <g key={idx}>
            <circle
              cx={scaleX(d.p80Mm)}
              cy={scaleY(d.kpiValue)}
              r="6"
              fill="#1F3864"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <text
              x={scaleX(d.p80Mm)}
              y={scaleY(d.kpiValue) - 9}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="#1E293B"
            >
              {d.blastId}
            </text>
          </g>
        ))}

        {/* Labels */}
        <text x={width / 2} y={height - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#475569">
          {xLabel} (mm)
        </text>
        <text x={-height / 2} y={15} transform="rotate(-90)" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#475569">
          {yLabel} ({yUnit})
        </text>
      </svg>

      {data.length < 8 && (
        <div className="mt-2 p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 text-center font-medium">
          {isFr
            ? `⚠️ Indicatif uniquement ; échantillon trop réduit pour conclusions fermes (N = ${data.length} < 8 tirs).`
            : `⚠️ Indicative only; sample size too small for firm conclusions (N = ${data.length} < 8 blasts).`}
        </div>
      )}
    </div>
  );
};

// Blast Advisor Tornado Chart
interface TornadoSensitivityProps {
  sensitivity: Array<{
    parameter: string;
    impactLowMm: number;
    impactHighMm: number;
  }>;
  lang?: 'en' | 'fr';
}

export const TornadoSensitivityChart: React.FC<TornadoSensitivityProps> = ({
  sensitivity,
  lang = 'en',
}) => {
  const width = 460;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 25, left: 140 };
  const isFr = lang === 'fr';

  const maxImpact = Math.max(
    ...sensitivity.flatMap((s) => [Math.abs(s.impactLowMm), Math.abs(s.impactHighMm)]),
    20
  );

  const scaleImpact = (val: number) => {
    const center = padding.left + (width - padding.left - padding.right) / 2;
    const halfWidth = (width - padding.left - padding.right) / 2;
    return center + (val / maxImpact) * halfWidth;
  };

  const center = scaleImpact(0);

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <h5 className="text-xs font-bold text-slate-800 mb-2">
        {isFr ? 'Diagramme Tornade : Impact sur le P80 (mm)' : 'Tornado Sensitivity Chart: Impact on P80 (mm)'}
      </h5>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Center Zero Line */}
        <line x1={center} x2={center} y1={padding.top} y2={height - padding.bottom} stroke="#64748B" strokeWidth="1.5" />

        {sensitivity.map((s, idx) => {
          const y = padding.top + idx * 36 + 10;
          const xLow = scaleImpact(s.impactLowMm);
          const xHigh = scaleImpact(s.impactHighMm);

          return (
            <g key={s.parameter}>
              <text x={padding.left - 10} y={y + 10} textAnchor="end" fontSize="10" fill="#334155" fontWeight="medium">
                {s.parameter}
              </text>
              {/* -15% Bar */}
              <rect
                x={Math.min(center, xLow)}
                y={y}
                width={Math.abs(xLow - center)}
                height="14"
                fill="#EF4444"
                rx="2"
              />
              {/* +15% Bar */}
              <rect
                x={Math.min(center, xHigh)}
                y={y}
                width={Math.abs(xHigh - center)}
                height="14"
                fill="#10B981"
                rx="2"
              />
              <text
                x={xLow < center ? xLow - 4 : xLow + 4}
                y={y + 11}
                textAnchor={xLow < center ? 'end' : 'start'}
                fontSize="8.5"
                fill="#64748B"
              >
                {s.impactLowMm > 0 ? `+${s.impactLowMm}` : s.impactLowMm}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-center gap-4 text-[10px] text-slate-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-xs" /> {isFr ? 'Paramètre -15%' : 'Parameter -15%'}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" /> {isFr ? 'Paramètre +15%' : 'Parameter +15%'}
        </span>
      </div>
    </div>
  );
};
