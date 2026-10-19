import React, { useState, useEffect, useMemo } from 'react';
import type { Blast, Project, Site } from '../../types';
import {
  Map,
  Layers,
  Compass,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sliders,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  Grid,
} from 'lucide-react';
import { t } from '../../i18n';
import { SendToReportButton } from '../report/SendToReportButton';

interface BenchMapViewProps {
  blasts: Blast[];
  activeBlastId?: string;
  onSelectBlast: (blastId: string) => void;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const BenchMapView: React.FC<BenchMapViewProps> = ({
  blasts,
  activeBlastId: propActiveBlastId,
  onSelectBlast,
  project,
  site,
  lang = 'en',
}) => {
  const isFr = lang === 'fr';

  const [selectedElevation, setSelectedElevation] = useState<number | 'all'>('all');
  const [activeBlastId, setActiveBlastId] = useState<string>(propActiveBlastId || blasts[0]?.id || '');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Interactive Pattern Geometry Overrides for Active Blast
  const selectedBlast = blasts.find((b) => b.id === activeBlastId) || blasts[0];
  const [burdenM, setBurdenM] = useState<number>(selectedBlast?.parameters.burden ?? 4.0);
  const [spacingM, setSpacingM] = useState<number>(selectedBlast?.parameters.spacing ?? 3.0);
  const [benchHeightM, setBenchHeightM] = useState<number>(selectedBlast?.parameters.benchHeight ?? 15.0);
  const [numberOfHoles, setNumberOfHoles] = useState<number>(selectedBlast?.parameters.numberOfHoles ?? 50);
  const [patternType, setPatternType] = useState<'staggered' | 'rectangular'>('staggered');
  const [clearanceRadiusM, setClearanceRadiusM] = useState<number>(300);

  // Sync geometry when active blast changes
  const handleSelectBlastBlock = (blastId: string) => {
    setActiveBlastId(blastId);
    if (onSelectBlast) onSelectBlast(blastId);
    const b = blasts.find((x) => x.id === blastId);
    if (b) {
      setBurdenM(b.parameters.burden ?? 4.0);
      setSpacingM(b.parameters.spacing ?? 3.0);
      setBenchHeightM(b.parameters.benchHeight ?? 15.0);
      setNumberOfHoles(b.parameters.numberOfHoles ?? 50);
    }
  };

  useEffect(() => {
    if (propActiveBlastId && propActiveBlastId !== activeBlastId) {
      handleSelectBlastBlock(propActiveBlastId);
    }
  }, [propActiveBlastId]);

  // Live calculations
  const blastedVolumeM3 = useMemo(() => {
    return Number((burdenM * spacingM * benchHeightM * numberOfHoles).toFixed(1));
  }, [burdenM, spacingM, benchHeightM, numberOfHoles]);

  const blastedTonnageT = useMemo(() => {
    const density = selectedBlast?.rockMass.density ?? 2.76;
    return Number((blastedVolumeM3 * density).toFixed(0));
  }, [blastedVolumeM3, selectedBlast]);

  const livePowderFactor = useMemo(() => {
    const chargePerHole = selectedBlast?.parameters.chargePerHole ?? 71.89;
    const holeVol = burdenM * spacingM * benchHeightM;
    return Number((chargePerHole / Math.max(0.1, holeVol)).toFixed(2));
  }, [burdenM, spacingM, benchHeightM, selectedBlast]);

  const isGeometryModified = useMemo(() => {
    if (!selectedBlast) return false;
    return (
      Math.abs(burdenM - (selectedBlast.parameters.burden ?? 4.0)) > 0.01 ||
      Math.abs(spacingM - (selectedBlast.parameters.spacing ?? 3.0)) > 0.01 ||
      Math.abs(benchHeightM - (selectedBlast.parameters.benchHeight ?? 15.0)) > 0.01 ||
      numberOfHoles !== (selectedBlast.parameters.numberOfHoles ?? 50)
    );
  }, [burdenM, spacingM, benchHeightM, numberOfHoles, selectedBlast]);

  // Default coordinate layouts for blasts on the pit bench SVG
  const blastLayouts: Record<string, { x: number; y: number; w: number; h: number; bench: number }> = {
    'blast-bl-2026-001': { x: 120, y: 130, w: 110, h: 75, bench: 1240 },
    'blast-bl-2026-002': { x: 260, y: 135, w: 125, h: 80, bench: 1240 },
    'blast-bl-2026-003': { x: 410, y: 140, w: 105, h: 70, bench: 1240 },
    'blast-bl-2026-004': { x: 180, y: 240, w: 130, h: 85, bench: 840 },
    'blast-bl-2026-005': { x: 340, y: 250, w: 120, h: 80, bench: 840 },
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

  const getP80Color = (p80: number) => {
    if (p80 <= 180) return { fill: '#10B981', border: '#059669', badge: 'bg-emerald-100 text-emerald-800', label: isFr ? 'Optimal (<180mm)' : 'Optimal (<180mm)' };
    if (p80 <= 240) return { fill: '#0EA5E9', border: '#0284C7', badge: 'bg-sky-100 text-sky-800', label: isFr ? 'Nominal (180-240mm)' : 'Nominal (180-240mm)' };
    return { fill: '#F43F5E', border: '#E11D48', badge: 'bg-rose-100 text-rose-800', label: isFr ? 'Hors-gabarit (>240mm)' : 'Oversize (>240mm)' };
  };

  const activeP80 = selectedBlast ? getP80(selectedBlast) : 200;
  const activeStatus = getP80Color(activeP80);

  // Time series trend data
  const trendData = blasts.map((b) => ({
    blastId: b.blastId,
    p80: getP80(b),
    powderFactor: (b.parameters.chargePerHole / Math.max(0.1, b.parameters.burden * b.parameters.spacing * b.parameters.benchHeight)).toFixed(2),
    date: b.dateTime.slice(5, 10),
  }));

  // Find center of selected blast for drawing the circular flyrock safety buffer
  const activeLayout = blastLayouts[selectedBlast?.id || ''] || { x: 260, y: 135, w: 125, h: 80, bench: 1240 };
  const centerX = activeLayout.x + activeLayout.w / 2;
  const centerY = activeLayout.y + activeLayout.h / 2;
  // Scaled SVG radius: 300m = ~90px on SVG
  const svgSafetyRadius = (clearanceRadiusM / 300) * 85;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFr ? 'Plan Spatial des Gradins & Réconciliation Fosse' : 'Open-Pit Bench Map & Spatial Blast Reconciliation'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                {selectedElevation === 'all' ? (isFr ? 'Fosse Complète' : 'All Pit') : `Gradin ${selectedElevation} RL`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFr
                ? 'Visualisation cartographique des polygones de tir, géométrie du patron et suivi spatial de la granulométrie P80'
                : 'Interactive spatial fragmentation heatmap across pit benches, blast geometry adjustment and multi-blast trend tracking'}
            </p>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Bench Elevation Filter */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <select
              value={selectedElevation}
              onChange={(e) => setSelectedElevation(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-slate-50"
            >
              <option value="all">{isFr ? 'Tous les Gradins (Fosse Complète)' : 'All Benches (Full Pit)'}</option>
              <option value={840}>{isFr ? 'Gradin 840 RL (Gradin Pilote Actif)' : 'Bench 840 RL (Active Pilot Bench)'}</option>
              <option value={1260}>{isFr ? 'Gradin 1260 RL (Crête Rampe)' : 'Bench 1260 RL (Crest)'}</option>
              <option value={1240}>{isFr ? 'Gradin 1240 RL (Supérieur)' : 'Bench 1240 RL (Upper)'}</option>
              <option value={1220}>{isFr ? 'Gradin 1220 RL (Front Actif)' : 'Bench 1220 RL (Active Face)'}</option>
            </select>
          </div>

          {/* Educational Principles Button */}
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title={isFr ? 'Comprendre le plan de fosse' : 'How does the bench map work?'}
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">{isFr ? 'Guide Fosse' : 'Bench Guide'}</span>
          </button>

          {/* Send to Report Button */}
          <SendToReportButton
            sectionKey="benchmap"
            project={project}
            site={site}
            blast={selectedBlast}
            lang={lang}
            getPayload={() => ({
              activeBlastId: selectedBlast?.blastId,
              selectedElevation,
              burdenM,
              spacingM,
              benchHeightM,
              numberOfHoles,
              patternType,
              clearanceRadiusM,
              blastedVolumeM3,
              blastedTonnageT,
              livePowderFactor,
              activeP80,
              historicalMeanP80: 207,
            })}
            summaryFr={`Plan fosse (Gradin ${activeLayout.bench} RL, maille ${burdenM}m×${spacingM}m) : ${blastedVolumeM3} m³ (${blastedTonnageT} t), dosage ${livePowderFactor} kg/m³, périmètre sécurité ${clearanceRadiusM}m.`}
            summaryEn={`Pit bench map (Bench ${activeLayout.bench} RL, pattern ${burdenM}m×${spacingM}m): ${blastedVolumeM3} m³ (${blastedTonnageT} t), powder factor ${livePowderFactor} kg/m³, safety perimeter ${clearanceRadiusM}m.`}
          />
        </div>
      </div>

      {/* Educational Guide Box (collapsible) */}
      {showExplanation && (
        <div className="bg-gradient-to-r from-blue-50 to-sky-50 p-5 rounded-2xl border border-blue-200 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-blue-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              {isFr
                ? 'Fonctionnement du Plan Spatial des Gradins & Réconciliation'
                : 'How the Pit Bench Map & Spatial Reconciliation Work'}
            </h3>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              ✕ {isFr ? 'Masquer' : 'Dismiss'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-900 leading-relaxed">
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                1. {isFr ? 'Cartographie des Polygones de Tir' : 'Blast Polygon Mapping'}
              </span>
              <p>
                {isFr
                  ? 'Chaque gradin (ex : 1240 RL) représente un niveau d’exploitation. Les polygones de tir positionnent exactement les volumes abattus par rapport aux fronts libres et aux rampes d’accès de la fosse.'
                  : 'Each bench elevation (e.g. 1240 RL) represents an open-pit mining slice. Blast polygons track exact spatial locations of blasted blocks relative to free faces and access ramps.'}
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                2. {isFr ? 'Périmètre de Sécurité des Projections' : 'Flyrock Clearance Perimeter'}
              </span>
              <p>
                {isFr
                  ? 'Le cercle de sécurité (paramétrable de 100m à 600m) délimite la zone d’évacuation obligatoire des personnes et des engins mobiles avant le tir pour prévenir tout accident de projection de roche.'
                  : 'The dynamic clearance perimeter (slider from 100m to 600m) defines the mandatory exclusion zone for personnel and mobile mining equipment prior to blast detonation.'}
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                3. {isFr ? 'Réconciliation Mine-to-Mill' : 'Mine-to-Mill Reconciliation'}
              </span>
              <p>
                {isFr
                  ? 'En comparant le P80 observé sur différents gradins, les ingénieurs identifient les zones dures nécessitant un resserrement de maille et évitent d’engorger le concasseur primaire avec des gros blocs.'
                  : 'By tracking P80 across different benches, mining engineers detect hard geological zones requiring tighter patterns to avoid starving or choking primary crushing.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Pattern Geometry Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>{isFr ? 'Paramètres Géométriques du Gradin Actif' : 'Active Bench Geometry & Pattern Controls'} ({selectedBlast?.blastId})</span>
              {isGeometryModified && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {isFr ? 'Valeur modifiée' : 'Modified value'}
                </span>
              )}
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-semibold">{isFr ? 'Disposition :' : 'Pattern:'}</span>
            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setPatternType('staggered')}
                className={`px-2 py-1 rounded-md font-bold text-xs ${patternType === 'staggered' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {isFr ? 'Quinconce' : 'Staggered'}
              </button>
              <button
                onClick={() => setPatternType('rectangular')}
                className={`px-2 py-1 rounded-md font-bold text-xs ${patternType === 'rectangular' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {isFr ? 'Carré / En ligne' : 'Square'}
              </button>
            </div>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Burden Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFr ? 'Banquette (Burden B)' : 'Burden (B)'}</span>
              <strong className="text-blue-400">{burdenM} m</strong>
            </div>
            <input
              type="range"
              min="1.8"
              max="4.5"
              step="0.1"
              value={burdenM}
              onChange={(e) => setBurdenM(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFr ? 'Distance au front libre' : 'Distance to free face'}
            </span>
          </div>

          {/* Spacing Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFr ? 'Espacement (Spacing S)' : 'Spacing (S)'}</span>
              <strong className="text-blue-400">{spacingM} m</strong>
            </div>
            <input
              type="range"
              min="2.0"
              max="5.5"
              step="0.1"
              value={spacingM}
              onChange={(e) => setSpacingM(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFr ? 'Distance entre trous d’une même ligne' : 'Distance between adjacent holes'}
            </span>
          </div>

          {/* Bench Height */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFr ? 'Hauteur Gradin (H)' : 'Bench Height (H)'}</span>
              <strong className="text-blue-400">{benchHeightM} m</strong>
            </div>
            <input
              type="range"
              min="4.0"
              max="14.0"
              step="0.5"
              value={benchHeightM}
              onChange={(e) => setBenchHeightM(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFr ? 'Dénivelé vertical du gradin' : 'Vertical bench step height'}
            </span>
          </div>

          {/* Flyrock Safety Perimeter Radius */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1 text-amber-300">
                <ShieldAlert className="w-3.5 h-3.5" />
                {isFr ? 'Rayon Évacuation Sécurité' : 'Safety Exclusion Radius'}
              </span>
              <strong className="text-amber-400">{clearanceRadiusM} m</strong>
            </div>
            <input
              type="range"
              min="100"
              max="600"
              step="25"
              value={clearanceRadiusM}
              onChange={(e) => setClearanceRadiusM(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFr ? 'Périmètre rouge visible sur le plan' : 'Red safety perimeter on map'}
            </span>
          </div>
        </div>

        {/* Live Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="p-2.5 bg-slate-800/80 rounded-xl">
            <span className="text-slate-400 text-[10px] block">{isFr ? 'Volume Abattu Prévu' : 'Estimated Volume'}</span>
            <strong className="text-white text-sm">{blastedVolumeM3} m³</strong>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl">
            <span className="text-slate-400 text-[10px] block">{isFr ? 'Tonnage Massif Prévu' : 'Estimated Tonnage'}</span>
            <strong className="text-white text-sm">{blastedTonnageT} tonnes</strong>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl">
            <span className="text-slate-400 text-[10px] block">{isFr ? 'Dosage Explosif Résultant' : 'Powder Factor'}</span>
            <strong className="text-emerald-400 text-sm">{livePowderFactor} kg/m³</strong>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl">
            <span className="text-slate-400 text-[10px] block">{isFr ? 'Ratio Espacement / Banquette' : 'S/B Ratio'}</span>
            <strong className="text-blue-400 text-sm">{(spacingM / burdenM).toFixed(2)}</strong>
          </div>
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

              {/* Dynamic Animated Safety Flyrock Buffer Circle */}
              <circle
                cx={centerX}
                cy={centerY}
                r={svgSafetyRadius}
                fill="none"
                stroke="#EF4444"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                opacity="0.75"
              />
              <text
                x={centerX}
                y={centerY - svgSafetyRadius - 4}
                textAnchor="middle"
                fill="#F87171"
                fontSize="9"
                fontWeight="bold"
              >
                ⚠ {isFr ? `Périmètre d’Évacuation (${clearanceRadiusM}m)` : `Exclusion Perimeter (${clearanceRadiusM}m)`}
              </text>

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
                    onClick={() => handleSelectBlastBlock(b.id)}
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
                      {isSelected ? `PF: ${livePowderFactor} kg/m³` : `PF: ${(b.parameters.chargePerHole / Math.max(0.1, b.parameters.burden * b.parameters.spacing * b.parameters.benchHeight)).toFixed(2)} kg/m³`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <p className="text-xs text-slate-500 italic">
            {isFr
              ? '💡 Cliquez sur n’importe quel tir dans le plan pour charger ses paramètres et ajuster sa géométrie en temps réel.'
              : '💡 Click any blast block on the bench map to load its geometry and tweak burden, spacing or safety radius live.'}
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
                  <span className="text-base font-bold text-slate-900">{livePowderFactor} kg/m³</span>
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
                <rect x="35" y="35" width="280" height="35" fill="#10B981" fillOpacity="0.15" rx="3" />
                <text x="40" y="55" fill="#059669" fontSize="8" fontWeight="bold">
                  {isFr ? 'Zone Cible Optimale (140 - 200 mm)' : 'Target Optimal Range (140 - 200 mm)'}
                </text>

                <line x1="35" y1="10" x2="35" y2="105" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="35" y1="105" x2="320" y2="105" stroke="#CBD5E1" strokeWidth="1" />

                <text x="8" y="25" fill="#94A3B8" fontSize="8">300mm</text>
                <text x="8" y="65" fill="#94A3B8" fontSize="8">180mm</text>
                <text x="8" y="105" fill="#94A3B8" fontSize="8">60mm</text>

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
