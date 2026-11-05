import React from 'react';
import type { GeoLabTestType } from '../../types/geolab';

interface GeoLabTestChartProps {
  testType: GeoLabTestType;
  input: any;
  results: any;
  language: 'en' | 'fr';
}

export const GeoLabTestChart: React.FC<GeoLabTestChartProps> = ({
  testType,
  input,
  results,
  language,
}) => {
  const isFr = language === 'fr';

  if (!results) return null;

  // 1. GRAIN SIZE: Semi-logarithmic grading curve
  if (testType === 'grain_size') {
    const rows = results.rows || [];
    if (rows.length === 0) return null;

    // Filter valid positive sieves and sort ascending for SVG path
    const validSieves = rows
      .filter((r: any) => typeof r.sieveMm === 'number' && r.sieveMm > 0 && typeof r.passingPercent === 'number')
      .sort((a: any, b: any) => a.sieveMm - b.sieveMm);

    if (validSieves.length === 0) return null;

    const minSieve = 0.05;
    const maxSieve = Math.max(100, ...validSieves.map((s: any) => s.sieveMm));
    const logMin = Math.log10(minSieve);
    const logMax = Math.log10(maxSieve);

    const width = 760;
    const height = 340;
    const padL = 60;
    const padR = 30;
    const padT = 30;
    const padB = 45;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const toX = (sieve: number) => {
      const l = Math.log10(Math.max(minSieve, sieve));
      return padL + ((l - logMin) / (logMax - logMin)) * plotW;
    };
    const toY = (p: number) => padT + plotH - (Math.max(0, Math.min(100, p)) / 100) * plotH;

    // Sieve grid lines on log scale
    const decadeSieves = [0.063, 0.08, 0.1, 0.2, 0.4, 0.5, 1, 2, 5, 10, 20, 50, 100];
    const yGrid = [0, 20, 40, 60, 80, 100];

    const curvePath = validSieves
      .map((s: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${toX(s.sieveMm).toFixed(1)} ${toY(s.passingPercent).toFixed(1)}`)
      .join(' ');

    const hasSpecs = validSieves.some((s: any) => typeof s.minSpecPercent === 'number' || typeof s.maxSpecPercent === 'number');

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            {isFr ? 'Courbe Granulométrique Semi-Logarithmique' : 'Particle Size Distribution (Semi-Log)'}
          </h4>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-400 inline-block" />
              {isFr ? 'Passant cumulé (%)' : 'Cumulative Passing (%)'}
            </span>
            {hasSpecs && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />
                {isFr ? 'Fuseau de spécification' : 'Envelope specs'}
              </span>
            )}
            {results.cu && (
              <span className="font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Cu = {results.cu} | Cc = {results.cc || '-'}
              </span>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[380px] select-none font-sans">
            {/* Background grid */}
            {yGrid.map((yVal) => (
              <g key={`y-${yVal}`}>
                <line
                  x1={padL}
                  y1={toY(yVal)}
                  x2={width - padR}
                  y2={toY(yVal)}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray={yVal === 0 || yVal === 100 ? 'none' : '3,3'}
                />
                <text x={padL - 8} y={toY(yVal) + 4} textAnchor="end" fill="#64748b" fontSize="10">
                  {yVal}%
                </text>
              </g>
            ))}

            {decadeSieves.filter((d) => d >= minSieve && d <= maxSieve).map((d) => (
              <g key={`x-${d}`}>
                <line
                  x1={toX(d)}
                  y1={padT}
                  x2={toX(d)}
                  y2={padT + plotH}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray={d === 2 || d === 0.08 ? 'none' : '2,4'}
                />
                <text x={toX(d)} y={padT + plotH + 16} textAnchor="middle" fill="#64748b" fontSize="9">
                  {d}
                </text>
              </g>
            ))}

            {/* Spec Envelope if present */}
            {hasSpecs && (
              <>
                <path
                  d={validSieves
                    .filter((s: any) => typeof s.minSpecPercent === 'number')
                    .map((s: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${toX(s.sieveMm).toFixed(1)} ${toY(s.minSpecPercent).toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
                <path
                  d={validSieves
                    .filter((s: any) => typeof s.maxSpecPercent === 'number')
                    .map((s: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${toX(s.sieveMm).toFixed(1)} ${toY(s.maxSpecPercent).toFixed(1)}`)
                    .join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
              </>
            )}

            {/* Main Passing Curve */}
            <path d={curvePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

            {/* Sieve Data Points */}
            {validSieves.map((s: any, idx: number) => {
              const cx = toX(s.sieveMm);
              const cy = toY(s.passingPercent);
              return (
                <g key={`pt-${idx}`}>
                  <circle cx={cx} cy={cy} r="4" fill="#1e40af" stroke="#60a5fa" strokeWidth="1.5" />
                </g>
              );
            })}

            {/* Axis labels */}
            <text x={width / 2} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">
              {isFr ? 'Ouverture des mailles de tamis d (mm) — Échelle logarithmique' : 'Sieve Aperture d (mm) — Logarithmic Scale'}
            </text>
            <text
              transform={`rotate(-90 18 ${height / 2})`}
              x="18"
              y={height / 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontWeight="bold"
            >
              {isFr ? 'Passant cumulé P (%)' : 'Cumulative Passing P (%)'}
            </text>
          </svg>
        </div>
      </div>
    );
  }

  // 2. PROCTOR: Compaction Curve
  if (testType === 'proctor') {
    const pts = results.points || [];
    if (pts.length === 0) return null;

    const opmW = results.opmMoisturePercent || 0;
    const opmRho = results.maxDryDensityGcm3 || 0;
    const targetRho = results.targetDryDensityGcm3 || opmRho * 0.95;

    const minW = Math.max(0, Math.min(...pts.map((p: any) => p.waterContentPercent)) - 2.5);
    const maxW = Math.max(...pts.map((p: any) => p.waterContentPercent)) + 3;
    const minRho = Math.min(...pts.map((p: any) => p.dryDensityGcm3)) * 0.94;
    const maxRho = Math.max(...pts.map((p: any) => p.dryDensityGcm3), opmRho) * 1.05;

    const width = 760;
    const height = 340;
    const padL = 60;
    const padR = 30;
    const padT = 30;
    const padB = 45;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const toX = (w: number) => padL + ((w - minW) / (maxW - minW || 1)) * plotW;
    const toY = (r: number) => padT + plotH - ((r - minRho) / (maxRho - minRho || 1)) * plotH;

    // Fitted polynomial curve points
    const fittedCurvePoints: Array<{ w: number; rho: number }> = [];
    if (results.fittedCoefficients) {
      const { a, b, c } = results.fittedCoefficients;
      const step = (maxW - minW) / 60;
      for (let w = minW; w <= maxW; w += step) {
        const rho = a * w * w + b * w + c;
        if (rho >= minRho && rho <= maxRho) {
          fittedCurvePoints.push({ w, rho });
        }
      }
    }

    // Zero air voids (saturation) curve if Gs available
    const satPoints: Array<{ w: number; rho: number }> = [];
    const gs = results.particleDensityGs || 2.70;
    const step = (maxW - minW) / 40;
    for (let w = minW; w <= maxW; w += step) {
      // Sr = 100% => rho_d = (gs * 1.0) / (1 + (w / 100) * gs)
      const rhoSat = (gs * 1.0) / (1 + (w / 100) * gs);
      if (rhoSat >= minRho && rhoSat <= maxRho) {
        satPoints.push({ w, rho: rhoSat });
      }
    }

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            {isFr ? 'Courbe de Compactage Proctor' : 'Proctor Compaction Curve'}
          </h4>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              {isFr ? 'Ajustement polynomial' : 'Fitted curve'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t border-dashed border-sky-400 inline-block" />
              {isFr ? 'Courbe de saturation (Sr=100%)' : 'Zero air voids (Sr=100%)'}
            </span>
            <span className="font-mono text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              w_opm = {opmW}% | ρd_max = {opmRho} g/cm³
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[380px] select-none font-sans">
            {/* Horizontal Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
              const yVal = minRho + frac * (maxRho - minRho);
              return (
                <g key={`y-${idx}`}>
                  <line x1={padL} y1={toY(yVal)} x2={width - padR} y2={toY(yVal)} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <text x={padL - 8} y={toY(yVal) + 4} textAnchor="end" fill="#64748b" fontSize="10">
                    {yVal.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Grid */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((frac, idx) => {
              const xVal = minW + frac * (maxW - minW);
              return (
                <g key={`x-${idx}`}>
                  <line x1={toX(xVal)} y1={padT} x2={toX(xVal)} y2={padT + plotH} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <text x={toX(xVal)} y={padT + plotH + 16} textAnchor="middle" fill="#64748b" fontSize="10">
                    {xVal.toFixed(1)}%
                  </text>
                </g>
              );
            })}

            {/* 95% target density horizontal line */}
            <line
              x1={padL}
              y1={toY(targetRho)}
              x2={width - padR}
              y2={toY(targetRho)}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x={width - padR - 5} y={toY(targetRho) - 5} textAnchor="end" fill="#f59e0b" fontSize="9" fontWeight="bold">
              95% OPM ({targetRho.toFixed(3)} g/cm³)
            </text>

            {/* Saturation Curve (Sr = 100%) */}
            {satPoints.length > 1 && (
              <path
                d={satPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.w).toFixed(1)} ${toY(p.rho).toFixed(1)}`).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}

            {/* Fitted Curve */}
            {fittedCurvePoints.length > 1 && (
              <path
                d={fittedCurvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(p.w).toFixed(1)} ${toY(p.rho).toFixed(1)}`).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
              />
            )}

            {/* Measured Experimental Points */}
            {pts.map((p: any, idx: number) => {
              const cx = toX(p.waterContentPercent);
              const cy = toY(p.dryDensityGcm3);
              return (
                <g key={`pt-${idx}`}>
                  <circle cx={cx} cy={cy} r="5" fill="#047857" stroke="#34d399" strokeWidth="2" />
                  <text x={cx} y={cy - 8} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="bold">
                    P{p.pointIndex || idx + 1}
                  </text>
                </g>
              );
            })}

            {/* Optimum OPM Marker */}
            {opmW > 0 && opmRho > 0 && (
              <g>
                <circle cx={toX(opmW)} cy={toY(opmRho)} r="7" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                <line x1={toX(opmW)} y1={toY(opmRho)} x2={toX(opmW)} y2={padT + plotH} stroke="#dc2626" strokeWidth="1" strokeDasharray="2,2" />
                <line x1={padL} y1={toY(opmRho)} x2={toX(opmW)} y2={toY(opmRho)} stroke="#dc2626" strokeWidth="1" strokeDasharray="2,2" />
              </g>
            )}

            {/* Axis labels */}
            <text x={width / 2} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">
              {isFr ? 'Teneur en eau w (%)' : 'Water Content w (%)'}
            </text>
            <text
              transform={`rotate(-90 18 ${height / 2})`}
              x="18"
              y={height / 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontWeight="bold"
            >
              {isFr ? 'Densité sèche ρd (g/cm³)' : 'Dry Density ρd (g/cm³)'}
            </text>
          </svg>
        </div>
      </div>
    );
  }

  // 3. SPECIFIC GRAVITY (Pycnometer)
  if (testType === 'specific_gravity') {
    const dets = results.determinations || [];
    const meanGs = results.meanGs || results.specificGravity || 0;
    const deltaGs = results.differenceGs || 0;
    const isAccepted = results.repeatabilityAccepted ?? (deltaGs <= 0.03);

    // Standard reference minerals for comparison
    const refs = [
      { name: isFr ? 'Quartz' : 'Quartz', val: 2.65, color: '#38bdf8' },
      { name: isFr ? 'Échantillon (Moyenne)' : 'Sample (Mean)', val: meanGs, color: '#10b981', highlight: true },
      { name: isFr ? 'Calcite' : 'Calcite', val: 2.71, color: '#a78bfa' },
      { name: isFr ? 'Basalte' : 'Basalt', val: 2.85, color: '#f59e0b' },
    ];

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            {isFr ? 'Mesure au Pycnomètre & Répétabilité ΔGs' : 'Pycnometer Determinations & Repeatability'}
          </h4>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
              isAccepted ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-red-950 text-red-400 border-red-800'
            }`}
          >
            ΔGs = {deltaGs} ({isAccepted ? (isFr ? 'Conforme ≤ 0.03' : 'Accepted ≤ 0.03') : (isFr ? 'Hors tolérance > 0.03' : 'Rejected > 0.03')})
          </span>
        </div>

        {/* Determinations Comparison Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              {isFr ? 'Prises d\'essai individuelles :' : 'Individual Portions :'}
            </span>
            {dets.map((d: any, idx: number) => (
              <div key={`det-${idx}`} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {isFr ? 'Essai N°' : 'Portion #'} {d.detId || idx + 1}
                </span>
                <span className="font-mono font-bold text-white">Gs = {d.specificGravityGs?.toFixed(3) || '-'}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-bold">
              <span className="text-emerald-400">{isFr ? 'Moyenne Gs' : 'Mean Gs'}</span>
              <span className="font-mono text-emerald-400">{meanGs.toFixed(3)}</span>
            </div>
          </div>

          {/* Mineral spectrum comparison */}
          <div className="space-y-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              {isFr ? 'Positionnement Minéralogique de Référence :' : 'Mineral Density Spectrum Comparison :'}
            </span>
            <div className="space-y-1.5">
              {refs.map((ref, idx) => {
                const pct = Math.max(10, Math.min(100, ((ref.val - 2.4) / (3.0 - 2.4)) * 100));
                return (
                  <div key={`ref-${idx}`} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className={ref.highlight ? 'font-bold text-emerald-400' : 'text-slate-400'}>{ref.name}</span>
                      <span className="font-mono font-bold text-slate-200">{ref.val.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ref.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. WATER CONTENT: Specimens Bar Chart
  if (testType === 'water_content') {
    const specs = results.specimens || [];
    const meanW = results.meanWaterContentPercent || 0;
    const diffW = results.differenceBetweenSpecimensPercent || 0;
    const isAcc = results.repeatabilityAccepted;

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
            {isFr ? 'Mesure de la Teneur en Eau des Éprouvettes' : 'Water Content Specimen Distribution'}
          </h4>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
              isAcc ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-red-950 text-red-400 border-red-800'
            }`}
          >
            Δw = {diffW}% ({isAcc ? (isFr ? 'Conforme' : 'Conform') : (isFr ? 'Écart élevé' : 'High deviation')})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {specs.map((s: any, idx: number) => (
            <div key={`sp-${idx}`} className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 text-xs block mb-1">
                {isFr ? 'Éprouvette' : 'Specimen'} {s.specimenId || idx + 1}
              </span>
              <span className="text-xl font-bold font-mono text-sky-400">{s.waterContentPercent?.toFixed(1) || '-'} %</span>
              <span className="text-[10px] text-slate-500 block mt-1">Tare: {s.containerId || '-'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. SAND EQUIVALENT (Visual & Piston ES)
  if (testType === 'sand_equivalent') {
    const esV = results.meanEsVisual || results.esVisual || 0;
    const esP = results.meanEsPiston || results.esPiston || 0;

    const categories = [
      { max: 60, label: isFr ? 'Sol Argileux (Rejet)' : 'Clayey Soil (Reject)', color: '#ef4444' },
      { max: 70, label: isFr ? 'Légèrement Argileux' : 'Slightly Clayey', color: '#f59e0b' },
      { max: 80, label: isFr ? 'Sable Propre Béton' : 'Clean Concrete Sand', color: '#10b981' },
      { max: 100, label: isFr ? 'Sable Très Propre' : 'Very Clean Sand', color: '#3b82f6' },
    ];

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          {isFr ? 'Indice d\'Équivalent de Sable (ES)' : 'Sand Equivalent Index (SE)'}
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
            <span className="text-slate-400 text-xs block mb-1">{isFr ? 'ES Visuel (ESv)' : 'Visual SE (ESv)'}</span>
            <span className="text-2xl font-bold font-mono text-amber-400">{esV.toFixed(1)} %</span>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center">
            <span className="text-slate-400 text-xs block mb-1">{isFr ? 'ES Piston (ESp)' : 'Piston SE (ESp)'}</span>
            <span className="text-2xl font-bold font-mono text-blue-400">{esP.toFixed(1)} %</span>
          </div>
        </div>

        {/* Cleanliness Scale Gauge */}
        <div className="space-y-1 bg-slate-900 p-3 rounded-lg border border-slate-800">
          <div className="flex justify-between text-xs text-slate-300">
            <span>{isFr ? 'Échelle de Propreté (Seuils NF)' : 'Cleanliness Thresholds (NF standard)'}</span>
            <span className="font-bold text-emerald-400">
              {categories.find((c) => esP <= c.max)?.label || categories[categories.length - 1].label}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex">
            <div className="h-full bg-red-500 w-[60%]" title="<60% Rejet" />
            <div className="h-full bg-amber-500 w-[10%]" title="60-70%" />
            <div className="h-full bg-emerald-500 w-[10%]" title="70-80%" />
            <div className="h-full bg-blue-500 w-[20%]" title=">80%" />
          </div>
        </div>
      </div>
    );
  }

  // 6. LOS ANGELES & MICRO-DEVAL: Mechanical Wear & Abrasion Resistance
  if (testType === 'los_angeles' || testType === 'micro_deval') {
    const isLA = testType === 'los_angeles';
    const coeff = isLA ? (results.laCoefficient ?? results.meanLa ?? 0) : (results.mdeCoefficient ?? results.meanMde ?? 0);
    const cat = isLA ? results.laCategory : results.mdeCategory;

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isLA ? 'bg-rose-500' : 'bg-purple-500'} inline-block`} />
            {isLA
              ? (isFr ? 'Coefficient Los Angeles (Résistance à la Fragmentation)' : 'Los Angeles Coefficient (Impact Wear)')
              : (isFr ? 'Coefficient Micro-Deval (Résistance à l\'Usure en Présence d\'Eau)' : 'Micro-Deval Coefficient (Wet Abrasion)')}
          </h4>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-white border border-slate-700">
            {cat || (isLA ? `LA ${Math.ceil(coeff / 5) * 5}` : `MDE ${Math.ceil(coeff / 5) * 5}`)}
          </span>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs block">{isLA ? 'Coefficient LA :' : 'Coefficient MDE :'}</span>
            <span className={`text-3xl font-bold font-mono ${coeff <= 25 ? 'text-emerald-400' : coeff <= 35 ? 'text-amber-400' : 'text-red-400'}`}>
              {coeff.toFixed(1)} %
            </span>
          </div>
          <div className="text-right text-xs text-slate-400 max-w-xs">
            <span className="block font-semibold text-white mb-0.5">
              {coeff <= 20
                ? (isFr ? 'Très Haute Dureté (Couche de Roulement)' : 'High Wear Resistance (Surface Course)')
                : coeff <= 30
                ? (isFr ? 'Dureté Moyenne (Couche de Base / Fondation)' : 'Medium Hardness (Base Course)')
                : (isFr ? 'Matériau Évolutif ou Tendre (Remblais uniquement)' : 'Soft Material (Fill only)')}
            </span>
            <span>{isFr ? 'Norme NF EN 1097-2' : 'EN 1097-2 / ASTM C131'}</span>
          </div>
        </div>
      </div>
    );
  }

  // 7. FLAKINESS INDEX (Aplatissement)
  if (testType === 'flakiness') {
    const fi = results.flakinessIndexA ?? results.globalFlakinessIndex ?? 0;
    const cat = results.flakinessCategory;

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
            {isFr ? 'Coefficient d\'Aplatissement Global (FI)' : 'Flakiness Index (FI)'}
          </h4>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-teal-400 border border-slate-700">
            {cat || `FI ${Math.ceil(fi / 5) * 5}`}
          </span>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs block">{isFr ? 'Indice global d\'aplatissement :' : 'Global Flakiness Index :'}</span>
            <span className={`text-3xl font-bold font-mono ${fi <= 20 ? 'text-emerald-400' : fi <= 35 ? 'text-amber-400' : 'text-red-400'}`}>
              {fi.toFixed(1)} %
            </span>
          </div>
          <div className="text-right text-xs text-slate-400">
            <span className="block font-semibold text-white">
              {fi <= 15
                ? (isFr ? 'Forme cubique optimale (Enrobés / Bétons)' : 'Cubic shape (Optimal for asphalt/concrete)')
                : fi <= 25
                ? (isFr ? 'Forme courante acceptable' : 'Acceptable aggregate shape')
                : (isFr ? 'Granulats plats excessifs (Rejet couches nobles)' : 'Excessive flat particles')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 8. METHYLENE BLUE (Valeur de Bleu VBS)
  if (testType === 'methylene_blue') {
    const vbs = results.primaryValue ?? results.vbsValue ?? results.mbValue ?? 0;
    const sensClass = results.soilSensitivityClass || '';

    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
          {isFr ? 'Valeur de Bleu du Sol (VBS) — Classification GTR' : 'Methylene Blue Value (VBS) — Soil Sensitivity'}
        </h4>

        <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs block">Valeur VBS :</span>
            <span className="text-3xl font-bold font-mono text-blue-400">{vbs.toFixed(2)} g/100g</span>
          </div>
          <div className="text-right text-xs">
            <span className="block font-bold text-white mb-0.5">{sensClass || (vbs < 1.5 ? 'Sableux peu sensible' : 'Sol argileux')}</span>
            <span className="text-slate-400">
              {vbs < 0.1
                ? (isFr ? 'Sol insensible à l\'eau' : 'Water-insensitive soil')
                : vbs < 1.5
                ? (isFr ? 'Sol peu argileux à moyen' : 'Low to medium clay activity')
                : (isFr ? 'Sol argileux très plastique' : 'Highly plastic swelling clay')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

