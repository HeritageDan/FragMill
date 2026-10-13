import React, { useState } from 'react';
import type { Blast } from '../../types';
import { Map, Layers, Compass, TrendingUp, Calendar, Zap, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { t } from '../../i18n';

interface BenchMapViewProps {
  blasts: Blast[];
  onSelectBlast: (blastId: string) => void;
  lang?: 'en' | 'fr';
}

export const BenchMapView: React.FC<BenchMapViewProps> = ({
  blasts,
  onSelectBlast,
  lang = 'en',
}) => {
  const isFr = lang === 'fr';
  const [selectedElevation, setSelectedElevation] = useState<number | 'all'>('all');
  const [activeBlastId, setActiveBlastId] = useState<string>(blasts[0]?.id || '');

  // Default coordinate layouts for blasts if not explicitly defined
  const blastLayouts: Record<string, { x: number; y: number; w: number; h: number; bench: number }> = {
    'blast-bl-2026-001': { x: 120, y: 130, w: 110, h: 75, bench: 1240 },
    'blast-bl-2026-002': { x: 260, y: 135, w: 125, h: 80, bench: 1240 },
    'blast-bl-2026-003': { x: 410, y: 140, w: 105, h: 70, bench: 1240 },
    'blast-bl-2026-004': { x: 180, y: 240, w: 130, h: 85, bench: 1220 },
    'blast-bl-2026-005': { x: 340, y: 250, w: 120, h: 80, bench: 1220 },
  };

  const getP80 = (b: Blast): number => {
    return b.images[0]?.segmentationRuns?.[0]?.metrics?.p80 || (b.blastId === 'BL-2026-001' ? 285 : b.blastId === 'BL-2026-002' ? 195 : 142);
  };

  const getP50 = (b: Blast): number => {
    return b.images[0]?.segmentationRuns?.[0]?.metrics?.p50 || (b.blastId === 'BL-2026-001' ? 168 : b.blastId === 'BL-2026-002' ? 115 : 78);
  };

  const getOversize = (b: Blast): number => {
    return b.images[0]?.segmentationRuns?.[0]?.metrics?.oversizePercent || (b.blastId === 'BL-2026-001' ? 18.5 : b.blastId === 'BL-2026-002' ? 9.2 : 3.8);
  };

  const getPowderFactor = (b: Blast): number => {
    const vol = b.parameters.burden * b.parameters.spacing * b.parameters.benchHeight;
    return Number((b.parameters.chargePerHole / Math.max(0.1, vol)).toFixed(2));
  };

  // Color coding by fragmentation P80
  const getP80Color = (p80: number) => {
    if (p80 <= 180) return { fill: '#10B981', border: '#059669', badge: 'bg-emerald-100 text-emerald-800', label: isFr ? 'Optimal (<180mm)' : 'Optimal (<180mm)' };
    if (p80 <= 240) return { fill: '#0EA5E9', border: '#0284C7', badge: 'bg-sky-100 text-sky-800', label: isFr ? 'Nominal (180-240mm)' : 'Nominal (180-240mm)' };
    return { fill: '#F43F5E', border: '#E11D48', badge: 'bg-rose-100 text-rose-800', label: isFr ? 'Hors-gabarit (>240mm)' : 'Oversize (>240mm)' };
  };

  const selectedBlast = blasts.find((b) => b.id === activeBlastId) || blasts[0];
  const activeP80 = selectedBlast ? getP80(selectedBlast) : 200;
  const activeStatus = getP80Color(activeP80);

  // Time series trend data
  const trendData = blasts.map((b, idx) => ({
    blastId: b.blastId,
    p80: getP80(b),
    powderFactor: getPowderFactor(b),
    date: b.dateTime.slice(5, 10),
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {isFr ? 'Plan Spatial des Gradins & Réconciliation Temporelle' : 'Open-Pit Bench Map & Spatial Reconciliation'}
            </h2>
            <p className="text-xs text-slate-500">
              {isFr
                ? 'Visualisation spatiale de la granulométrie P80 sur la fosse et suivi chronologique de la maille'
                : 'Interactive spatial fragmentation heatmap across pit benches and multi-blast trend analytics'}
            </p>
          </div>
        </div>

        {/* Bench Elevation Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            {isFr ? 'Gradin / Niveau :' : 'Bench Level:'}
          </span>
          <select
            value={selectedElevation}
            onChange={(e) => setSelectedElevation(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
          >
            <option value="all">{isFr ? 'Tous les Gradins (Fosse Complète)' : 'All Benches (Full Pit)'}</option>
            <option value={1240}>{isFr ? 'Gradin 1240 RL (Supérieur)' : 'Bench 1240 RL (Upper)'}</option>
            <option value={1220}>{isFr ? 'Gradin 1220 RL (Intermédiaire)' : 'Bench 1220 RL (Mid)'}</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Left Interactive SVG Pit Plan, Right Blast Inspector & Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Interactive Pit Bench Map */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              {isFr ? 'Cartographie des Tirs par Gradin' : 'Bench Face Blast Polygons (Pit Floor)'}
            </h3>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> &lt;180mm
              </span>
              <span className="flex items-center gap-1 text-sky-700">
                <span className="w-3 h-3 rounded-full bg-sky-500" /> 180-240mm
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-3 h-3 rounded-full bg-rose-500" /> &gt;240mm
              </span>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 p-2 relative shadow-inner">
            <svg viewBox="0 0 600 380" className="w-full h-auto select-none">
              {/* Pit background contours */}
              <defs>
                <linearGradient id="benchGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#27272A" />
                  <stop offset="100%" stopColor="#18181B" />
                </linearGradient>
                <pattern id="hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#3F3F46" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Pit contours */}
              <path d="M 40,40 L 560,40 L 530,340 L 70,340 Z" fill="url(#benchGrad1)" stroke="#3F3F46" strokeWidth="1.5" />
              <path d="M 80,100 L 520,100 L 490,220 L 110,220 Z" fill="#202024" stroke="#52525B" strokeDasharray="4 3" strokeWidth="1" />
              <path d="M 130,225 L 470,225 L 440,330 L 160,330 Z" fill="#1C1C1F" stroke="#52525B" strokeDasharray="4 3" strokeWidth="1" />

              {/* Bench Level Labels */}
              <text x="50" y="70" fill="#71717A" fontSize="10" fontWeight="bold">{isFr ? 'GRADIN 1260 RL (Crête Rampe)' : 'BENCH 1260 RL (Ramp Crest)'}</text>
              <text x="90" y="120" fill="#A1A1AA" fontSize="10" fontWeight="bold">{isFr ? 'GRADIN 1240 RL (Gradin Supérieur)' : 'BENCH 1240 RL (Upper Bench)'}</text>
              <text x="140" y="240" fill="#A1A1AA" fontSize="10" fontWeight="bold">{isFr ? 'GRADIN 1220 RL (Front de Taille Actif)' : 'BENCH 1220 RL (Active Working Face)'}</text>

              {/* North Arrow */}
              <g transform="translate(540, 75)">
                <polygon points="0,-15 -6,0 6,0" fill="#EF4444" />
                <polygon points="0,15 -6,0 6,0" fill="#FFFFFF" />
                <text x="-4" y="-18" fill="#FFFFFF" fontSize="9" fontWeight="bold">N</text>
              </g>

              {/* Render blast polygons */}
              {blasts.map((b, idx) => {
                const layout = blastLayouts[b.id] || {
                  x: 100 + (idx % 3) * 140,
                  y: 130 + Math.floor(idx / 3) * 110,
                  w: 115,
                  h: 75,
                  bench: 1240,
                };

                if (selectedElevation !== 'all' && layout.bench !== selectedElevation) {
                  return null;
                }

                const p80 = getP80(b);
                const col = getP80Color(p80);
                const isSelected = b.id === activeBlastId;

                return (
                  <g
                    key={b.id}
                    onClick={() => setActiveBlastId(b.id)}
                    className="cursor-pointer transition-transform hover:opacity-90"
                  >
                    {/* Blast Block Rectangle */}
                    <rect
                      x={layout.x}
                      y={layout.y}
                      width={layout.w}
                      height={layout.h}
                      rx="6"
                      fill={col.fill}
                      fillOpacity={isSelected ? 0.95 : 0.65}
                      stroke={isSelected ? '#FFFFFF' : col.border}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />

                    {/* Blast ID Label */}
                    <text
                      x={layout.x + layout.w / 2}
                      y={layout.y + 24}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="12"
                      fontWeight="bold"
                    >
                      {b.blastId}
                    </text>

                    {/* P80 Badge on map */}
                    <rect
                      x={layout.x + layout.w / 2 - 38}
                      y={layout.y + 32}
                      width="76"
                      height="18"
                      rx="4"
                      fill="#000000"
                      fillOpacity="0.6"
                    />
                    <text
                      x={layout.x + layout.w / 2}
                      y={layout.y + 45}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      P80: {p80} mm
                    </text>

                    {/* Powder Factor */}
                    <text
                      x={layout.x + layout.w / 2}
                      y={layout.y + 64}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="9"
                    >
                      PF: {getPowderFactor(b)} kg/m³
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="text-xs text-slate-500 italic">
            {isFr
              ? '💡 Cliquez sur un tir dans le plan pour inspecter ses paramètres géotechniques et sa distribution.'
              : '💡 Click any blast block on the bench map to inspect its fragmentation metrics and powder factor.'}
          </p>
        </div>

        {/* Right Column (5 cols): Active Blast Inspector & Trend Card */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Blast Inspector Card */}
          {selectedBlast && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    {isFr ? 'Tir Sélectionné' : 'Selected Blast'}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">{selectedBlast.blastId}</h3>
                  <span className="text-xs text-slate-500">{selectedBlast.rockMass.rockType} | {selectedBlast.dateTime}</span>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold ${activeStatus.badge}`}>
                  {activeStatus.label}
                </span>
              </div>

              {/* Key Sizing Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">{t('p50', lang)}</span>
                  <span className="text-base font-black text-slate-900">{getP50(selectedBlast)} mm</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-blue-700 block text-[10px] font-bold">{t('p80', lang)}</span>
                  <span className="text-base font-black text-blue-950">{activeP80} mm</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[10px]">{t('powderFactor', lang)}</span>
                  <span className="text-base font-bold text-slate-900">{getPowderFactor(selectedBlast)} kg/m³</span>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-amber-700 block text-[10px] font-bold">{t('oversizePercent', lang)}</span>
                  <span className="text-base font-bold text-amber-950">{getOversize(selectedBlast)}%</span>
                </div>
              </div>

              {/* Quick Jump Action */}
              <button
                onClick={() => onSelectBlast(selectedBlast.id)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
              >
                <span>{isFr ? 'Ouvrir l’Analyse Complète de ce Tir' : 'Open Detailed Blast Analysis'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Longitudinal Trend Chart Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              {isFr ? 'Tendance Chronologique P80 & Dosage' : 'Longitudinal P80 & Powder Factor Trend'}
            </h4>

            {/* Micro SVG Trend Chart */}
            <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
              <svg viewBox="0 0 340 130" className="w-full h-auto">
                {/* Optimal Band (140 to 200 mm) */}
                <rect x="35" y="35" width="280" height="35" fill="#10B981" fillOpacity="0.15" rx="3" />
                <text x="40" y="55" fill="#059669" fontSize="8" fontWeight="bold">
                  {isFr ? 'Zone Cible Optimale (140 - 200 mm)' : 'Target Optimal Range (140 - 200 mm)'}
                </text>

                {/* Y Axis line */}
                <line x1="35" y1="10" x2="35" y2="105" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="35" y1="105" x2="320" y2="105" stroke="#CBD5E1" strokeWidth="1" />

                {/* Y Axis ticks */}
                <text x="8" y="25" fill="#94A3B8" fontSize="8">300mm</text>
                <text x="8" y="65" fill="#94A3B8" fontSize="8">180mm</text>
                <text x="8" y="105" fill="#94A3B8" fontSize="8">60mm</text>

                {/* Plot points and polyline */}
                {trendData.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    points={trendData
                      .map((d, i) => {
                        const px = 55 + i * (240 / Math.max(1, trendData.length - 1));
                        const py = 105 - ((d.p80 - 60) / 240) * 85;
                        return `${px},${py}`;
                      })
                      .join(' ')}
                  />
                )}

                {trendData.map((d, i) => {
                  const px = 55 + i * (240 / Math.max(1, trendData.length - 1));
                  const py = 105 - ((d.p80 - 60) / 240) * 85;
                  return (
                    <g key={i}>
                      <circle cx={px} cy={py} r="4" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="1.5" />
                      <text x={px} y="118" fill="#64748B" fontSize="8" textAnchor="middle">
                        {d.blastId.replace('BL-2026-', '#')}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{isFr ? 'Cohérence du concassage :' : 'Crusher Consistency :'} <strong className="text-emerald-600">82%</strong></span>
              <span>{isFr ? 'Déviation moyenne :' : 'Mean Deviation :'} <strong className="text-slate-800">±18 mm</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
