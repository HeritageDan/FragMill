import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { BoreholeSample, KrigingGridNode, VariogramParams } from '../../types/advanced';
import type { Blast, Project, Site } from '../../types';
import {
  generateDemoBoreholes,
  computeKrigingGrid,
  DEFAULT_VARIOGRAM,
} from '../../services/geostatistics/krigingEngine';
import {
  Layers,
  MapPin,
  TrendingUp,
  Sliders,
  Sparkles,
  Info,
  Compass,
  RotateCcw,
  PlusCircle,
  HelpCircle,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { SendToReportButton } from '../report/SendToReportButton';

interface BlockModelKrigingViewProps {
  blast?: Blast;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const BlockModelKrigingView: React.FC<BlockModelKrigingViewProps> = ({
  blast,
  project,
  site,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  // State: Boreholes samples
  const [boreholes, setBoreholes] = useState<BoreholeSample[]>(generateDemoBoreholes());
  const [selectedAttribute, setSelectedAttribute] = useState<
    keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>
  >('ucsMPa');

  // Interactive Variogram Parameters
  const [variogramParams, setVariogramParams] = useState<VariogramParams>(DEFAULT_VARIOGRAM);
  const [gridResolution, setGridResolution] = useState<{ cols: number; rows: number }>({ cols: 20, rows: 14 });

  // Domain Thresholds
  const [softCutoff, setSoftCutoff] = useState<number>(75);
  const [hardCutoff, setHardCutoff] = useState<number>(125);
  const [softPF, setSoftPF] = useState<number>(0.45);
  const [interPF, setInterPF] = useState<number>(0.65);
  const [hardPF, setHardPF] = useState<number>(0.85);

  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [krigingGrid, setKrigingGrid] = useState<KrigingGridNode[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Recalculate Kriging grid whenever parameters or boreholes change
  useEffect(() => {
    if (boreholes.length > 0) {
      const grid = computeKrigingGrid(
        boreholes,
        selectedAttribute,
        gridResolution.cols,
        gridResolution.rows,
        0,
        60,
        0,
        40,
        variogramParams
      );
      setKrigingGrid(grid);
    }
  }, [boreholes, selectedAttribute, variogramParams, gridResolution]);

  // Render Kriging Heatmap on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || krigingGrid.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const vals = krigingGrid.map((n) => n.estimatedValue);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    const cols = gridResolution.cols;
    const rows = gridResolution.rows;
    const cellW = width / cols;
    const cellH = height / rows;

    krigingGrid.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);

      const ratio = Math.max(0, Math.min(1, (node.estimatedValue - minVal) / (maxVal - minVal || 1)));

      let color = '#3b82f6';
      if (node.estimatedValue > hardCutoff) color = '#ef4444';
      else if (node.estimatedValue >= softCutoff) color = '#10b981';
      else color = '#3b82f6';

      // Slight intensity gradient
      ctx.fillStyle = color;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);

      // Light grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
    });

    // Draw borehole collar positions
    boreholes.forEach((bh) => {
      const px = (bh.easting / 60) * width;
      const py = (bh.northing / 40) * height;

      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(bh.id, px + 9, py + 4);
      ctx.shadowBlur = 0;
    });
  }, [krigingGrid, boreholes, gridResolution, softCutoff, hardCutoff]);

  // Statistics summaries
  const stats = useMemo(() => {
    if (krigingGrid.length === 0) return { mean: 0, min: 0, max: 0, softPct: 0, interPct: 0, hardPct: 0 };
    const vals = krigingGrid.map((n) => n.estimatedValue);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);

    const softCount = vals.filter((v) => v < softCutoff).length;
    const hardCount = vals.filter((v) => v > hardCutoff).length;
    const interCount = vals.length - softCount - hardCount;

    return {
      mean: Number(mean.toFixed(1)),
      min: Number(min.toFixed(1)),
      max: Number(max.toFixed(1)),
      softPct: Number(((softCount / vals.length) * 100).toFixed(0)),
      interPct: Number(((interCount / vals.length) * 100).toFixed(0)),
      hardPct: Number(((hardCount / vals.length) * 100).toFixed(0)),
    };
  }, [krigingGrid, softCutoff, hardCutoff]);

  // Presets for rapid geological simulation
  const applyPreset = (preset: 'granite' | 'saprolite' | 'fault') => {
    if (preset === 'granite') {
      setBoreholes((prev) =>
        prev.map((b) => ({
          ...b,
          ucsMPa: Math.round(130 + Math.random() * 45),
          rqdPercent: Math.min(100, Math.round(75 + Math.random() * 25)),
        }))
      );
      setVariogramParams({ model: 'spherical', rangeM: 45, nugget: 10, sill: 220 });
    } else if (preset === 'saprolite') {
      setBoreholes((prev) =>
        prev.map((b) => ({
          ...b,
          ucsMPa: Math.round(45 + Math.random() * 35),
          rqdPercent: Math.round(25 + Math.random() * 30),
        }))
      );
      setVariogramParams({ model: 'exponential', rangeM: 25, nugget: 25, sill: 140 });
    } else {
      // Fault zone: east side hard, west side fractured
      setBoreholes((prev) =>
        prev.map((b) => ({
          ...b,
          ucsMPa: b.easting > 30 ? Math.round(155 + Math.random() * 25) : Math.round(55 + Math.random() * 20),
          rqdPercent: b.easting > 30 ? 88 : 38,
        }))
      );
      setVariogramParams({ model: 'spherical', rangeM: 35, nugget: 15, sill: 180 });
    }
  };

  const handleUpdateBorehole = (id: string, field: keyof BoreholeSample, val: number) => {
    setBoreholes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: val } : b))
    );
  };

  const handleAddBorehole = () => {
    const num = boreholes.length + 1;
    const newBh: BoreholeSample = {
      id: `BH-0${num}`,
      easting: Math.round(10 + Math.random() * 40),
      northing: Math.round(5 + Math.random() * 30),
      elevation: 840,
      ucsMPa: 105,
      rqdPercent: 65,
      jointSpacingM: 0.5,
      densityTPerM3: 2.68,
      goldGradeGPT: Number((1.2 + Math.random() * 3).toFixed(2)),
    };
    setBoreholes((prev) => [...prev, newBh]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFrench ? 'Krigeage Géostatistique & Modèle de Blocs' : 'Geostatistical Kriging & Geological Block Model'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                {variogramParams.model.toUpperCase()} • {variogramParams.rangeM}m
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {isFrench ? 'DONNÉES DE DÉMO' : 'DEMO DATA'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFrench
                ? 'Interpolation spatiale BLUE de la résistance rocheuse (UCS, RQD) et zonage intelligent du plan de tir'
                : 'Spatial BLUE kriging of rock strength (UCS, RQD) and automatic blast domain zonation'}
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Attribute Selector */}
          <select
            value={selectedAttribute}
            onChange={(e) => setSelectedAttribute(e.target.value as any)}
            className="bg-slate-100 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold"
          >
            <option value="ucsMPa">{isFrench ? 'Résistance UCS (MPa)' : 'Rock Strength (UCS MPa)'}</option>
            <option value="rqdPercent">{isFrench ? 'Qualité RQD (%)' : 'Rock Quality RQD (%)'}</option>
            <option value="jointSpacingM">{isFrench ? 'Espacement des Diaclases (m)' : 'Joint Spacing (m)'}</option>
            <option value="goldGradeGPT">{isFrench ? 'Teneur en Or (g/t Au)' : 'Gold Grade (g/t Au)'}</option>
          </select>

          {/* Explanation Button */}
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title={isFrench ? 'Comprendre le fonctionnement' : 'How does this work?'}
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">{isFrench ? 'Guide & Principes' : 'Principles'}</span>
          </button>

          {/* Send to Report Button */}
          <SendToReportButton
            sectionKey="kriging"
            project={project}
            site={site}
            blast={blast}
            lang={lang}
            getPayload={() => ({
              model: variogramParams.model,
              rangeM: variogramParams.rangeM,
              nugget: variogramParams.nugget,
              sill: variogramParams.sill,
              selectedAttribute,
              meanEstimated: stats.mean,
              minEstimated: stats.min,
              maxEstimated: stats.max,
              softPct: stats.softPct,
              interPct: stats.interPct,
              hardPct: stats.hardPct,
              softCutoff,
              hardCutoff,
              softPF,
              interPF,
              hardPF,
              boreholesCount: boreholes.length,
            })}
            summaryFr={`Krigeage ordinaire (${variogramParams.model}, portée ${variogramParams.rangeM}m) : ${stats.mean} ${selectedAttribute === 'ucsMPa' ? 'MPa' : '%'} moyen, ${stats.hardPct}% dur / ${stats.softPct}% tendre.`}
            summaryEn={`Ordinary Kriging (${variogramParams.model}, range ${variogramParams.rangeM}m): mean ${stats.mean}, ${stats.hardPct}% hard / ${stats.softPct}% soft.`}
          />
        </div>
      </div>

      {/* Educational Guide Box (collapsible) */}
      {showExplanation && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-200 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-blue-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              {isFrench
                ? 'Comment fonctionne le Krigeage Géostatistique dans FragMill ?'
                : 'How Does Geostatistical Kriging Function in FragMill?'}
            </h3>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              ✕ {isFrench ? 'Masquer' : 'Dismiss'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-900 leading-relaxed">
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                1. {isFrench ? 'Le Semi-Variogramme' : 'The Semi-Variogram'}
              </span>
              <p>
                {isFrench
                  ? 'Mesure la continuité spatiale de la roche. La portée (a) est la distance au-delà de laquelle deux points sont indépendants. Le palier (C) est la variance géologique totale, et la pépite (C0) représente le bruit de mesure à petite échelle.'
                  : 'Measures spatial correlation. Range (a) is the distance beyond which samples are independent. Sill (C) represents total spatial variance, and Nugget (C0) captures small-scale measurement uncertainty.'}
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                2. {isFrench ? 'L’Estimateur BLUE' : 'The BLUE Estimator'}
              </span>
              <p>
                {isFrench
                  ? 'Le Krigeage calcule les poids optimaux garantissant une estimation sans biais et à variance minimale. Contrairement à une simple moyenne, il prend en compte le regroupement des sondages et la structure géologique.'
                  : 'Ordinary Kriging computes optimal weights for Best Linear Unbiased Estimation (BLUE). Unlike simple distance averages, it accounts for sample clustering and structural directionality.'}
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                3. {isFrench ? 'Zonage Intelligent du Tir' : 'Blast Domain Zonation'}
              </span>
              <p>
                {isFrench
                  ? 'Plutôt que d’appliquer un dosage explosif uniforme (ex: 0.65 kg/m³) sur tout le gradin, FragMill affecte un dosage sur-mesure : 0.45 kg/m³ dans les zones tendres (économie d’ANFO, moins de fines) et 0.85 kg/m³ dans les granites massifs (zéro bloc).'
                  : 'Instead of blind uniform charging across the bench, FragMill adapts explosive powder factors: lower charge in fractured zones saves explosive, while higher charge in massive rock eliminates oversize boulders.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Parameter Control Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {isFrench ? 'Contrôles Interactifs du Variogramme & Grille' : 'Interactive Variogram & Grid Controls'}
            </h3>
          </div>

          {/* Quick Geological Presets */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">{isFrench ? 'Scénarios géologiques :' : 'Presets:'}</span>
            <button
              onClick={() => applyPreset('granite')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
            >
              {isFrench ? 'Granite Massif' : 'Massive Granite'}
            </button>
            <button
              onClick={() => applyPreset('saprolite')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
            >
              {isFrench ? 'Saprolite Tendre' : 'Soft Saprolite'}
            </button>
            <button
              onClick={() => applyPreset('fault')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
            >
              {isFrench ? 'Zone Faille' : 'Fault Zone'}
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Range Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFrench ? 'Portée Spatiale (a)' : 'Spatial Range (a)'}</span>
              <strong className="text-blue-400">{variogramParams.rangeM} m</strong>
            </div>
            <input
              type="range"
              min="10"
              max="80"
              step="1"
              value={variogramParams.rangeM}
              onChange={(e) =>
                setVariogramParams((prev) => ({ ...prev, rangeM: parseFloat(e.target.value) }))
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFrench ? 'Distance d’influence géostatistique' : 'Zone of spatial correlation'}
            </span>
          </div>

          {/* Nugget Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFrench ? 'Effet Pépite (C0)' : 'Nugget Effect (C0)'}</span>
              <strong className="text-blue-400">{variogramParams.nugget}</strong>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={variogramParams.nugget}
              onChange={(e) =>
                setVariogramParams((prev) => ({ ...prev, nugget: parseFloat(e.target.value) }))
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFrench ? 'Incertitude & micro-hétérogénéités' : 'Micro-scale noise & assay error'}
            </span>
          </div>

          {/* Sill Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFrench ? 'Palier Total (C)' : 'Spatial Sill (C)'}</span>
              <strong className="text-blue-400">{variogramParams.sill}</strong>
            </div>
            <input
              type="range"
              min="50"
              max="350"
              step="5"
              value={variogramParams.sill}
              onChange={(e) =>
                setVariogramParams((prev) => ({ ...prev, sill: parseFloat(e.target.value) }))
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[10px] text-slate-500">
              {isFrench ? 'Variance géologique du gradin' : 'Total population variance plateau'}
            </span>
          </div>

          {/* Model Type & Resolution */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>{isFrench ? 'Modèle & Densité' : 'Model & Grid'}</span>
              <strong className="text-blue-400">{gridResolution.cols}×{gridResolution.rows}</strong>
            </div>
            <div className="flex gap-2">
              <select
                value={variogramParams.model}
                onChange={(e) =>
                  setVariogramParams((prev) => ({ ...prev, model: e.target.value as any }))
                }
                className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded-lg text-xs font-semibold flex-1"
              >
                <option value="spherical">Sphérique</option>
                <option value="exponential">Exponentiel</option>
                <option value="gaussian">Gaussien</option>
              </select>
              <select
                value={`${gridResolution.cols}x${gridResolution.rows}`}
                onChange={(e) => {
                  const [c, r] = e.target.value.split('x').map(Number);
                  setGridResolution({ cols: c, rows: r });
                }}
                className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-1 rounded-lg text-xs font-semibold"
              >
                <option value="14x10">Rapide (14×10)</option>
                <option value="20x14">Standard (20×14)</option>
                <option value="30x20">Dense (30×20)</option>
              </select>
            </div>
            <span className="text-[10px] text-slate-500">
              {isFrench ? 'Résolution spatiale du maillage' : 'Grid mesh interpolation detail'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Heatmap Canvas, Right Domain Zonation & Boreholes Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Kriging Heatmap Canvas */}
        <div className="lg:col-span-7 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-400" />
              {isFrench ? 'Carte d’Interpolation Krigée (Gradin 840 RL)' : 'Kriged Spatial Heatmap (Bench 840 RL)'}
            </span>
            <span className="text-slate-400">
              {isFrench ? 'Échelle : 60m × 40m' : 'Scale: 60m × 40m'} • {boreholes.length} {isFrench ? 'sondages' : 'boreholes'}
            </span>
          </div>

          <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            <canvas
              ref={canvasRef}
              width={720}
              height={450}
              className="w-full h-full object-cover"
            />
            {/* Legend Overlay */}
            <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[10px] text-white flex items-center gap-3 border border-white/10">
              <span className="text-blue-400 font-bold">
                ■ {isFrench ? `Tendre (< ${softCutoff} MPa)` : `Soft (< ${softCutoff} MPa)`} ({stats.softPct}%)
              </span>
              <span className="text-emerald-400 font-bold">
                ■ {isFrench ? 'Intermédiaire' : 'Intermediate'} ({stats.interPct}%)
              </span>
              <span className="text-red-400 font-bold">
                ■ {isFrench ? `Massif (> ${hardCutoff} MPa)` : `Hard (> ${hardCutoff} MPa)`} ({stats.hardPct}%)
              </span>
            </div>
          </div>

          {/* Quick Summary Pill Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">{isFrench ? 'Moyenne Krigée' : 'Kriged Mean'}</span>
              <strong className="text-white text-sm">{stats.mean} {selectedAttribute === 'ucsMPa' ? 'MPa' : '%'}</strong>
            </div>
            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">{isFrench ? 'Étendue (Min - Max)' : 'Range (Min - Max)'}</span>
              <strong className="text-blue-400 text-sm">{stats.min} - {stats.max}</strong>
            </div>
            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">{isFrench ? 'Zonage Dominant' : 'Dominant Domain'}</span>
              <strong className={stats.hardPct > 40 ? 'text-red-400 text-sm' : stats.softPct > 40 ? 'text-blue-400 text-sm' : 'text-emerald-400 text-sm'}>
                {stats.hardPct > 40 ? (isFrench ? 'Massif Dur' : 'Hard Rock') : stats.softPct > 40 ? (isFrench ? 'Saprolite' : 'Soft Rock') : (isFrench ? 'Intermédiaire' : 'Intermediate')}
              </strong>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Automated Blast Domain Zonation & Boreholes Table */}
        <div className="lg:col-span-5 space-y-4">
          {/* Domain Zonation Settings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                {isFrench ? 'Zonage Géologique & Dosage Recommandé' : 'Geological Blast Domain Zonation'}
              </h3>
              <span className="text-[10px] text-slate-500 font-bold uppercase">{isFrench ? 'Seuils Ajustables' : 'Adjustable Limits'}</span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Soft Domain */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-900">{isFrench ? 'Domaine Tendre & Fracturé' : 'Soft Fractured Domain'}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0.2"
                      max="1.5"
                      value={softPF}
                      onChange={(e) => setSoftPF(parseFloat(e.target.value) || 0.45)}
                      className="w-16 px-1.5 py-0.5 text-right font-black text-blue-900 bg-white border border-blue-300 rounded-md text-xs"
                    />
                    <span className="font-bold text-blue-800 text-[10px]">kg/m³</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-blue-700">
                  <span>{isFrench ? 'Seuil maximal :' : 'Max Cutoff:'}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={softCutoff}
                      onChange={(e) => setSoftCutoff(parseInt(e.target.value) || 75)}
                      className="w-14 px-1.5 py-0.5 text-right font-bold text-blue-900 bg-white border border-blue-300 rounded-md text-xs"
                    />
                    <span>MPa ({stats.softPct}% de la surface)</span>
                  </div>
                </div>
              </div>

              {/* Intermediate Domain */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-900">{isFrench ? 'Domaine Standard Intermédiaire' : 'Intermediate Domain'}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0.2"
                      max="1.5"
                      value={interPF}
                      onChange={(e) => setInterPF(parseFloat(e.target.value) || 0.65)}
                      className="w-16 px-1.5 py-0.5 text-right font-black text-emerald-900 bg-white border border-emerald-300 rounded-md text-xs"
                    />
                    <span className="font-bold text-emerald-800 text-[10px]">kg/m³</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-700">
                  <span>{isFrench ? 'Plage standard :' : 'Standard band:'}</span>
                  <span>{softCutoff} - {hardCutoff} MPa ({stats.interPct}% de la surface)</span>
                </div>
              </div>

              {/* Hard Domain */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-red-900">{isFrench ? 'Domaine Dur & Massif' : 'Hard Massive Domain'}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.05"
                      min="0.2"
                      max="1.5"
                      value={hardPF}
                      onChange={(e) => setHardPF(parseFloat(e.target.value) || 0.85)}
                      className="w-16 px-1.5 py-0.5 text-right font-black text-red-900 bg-white border border-red-300 rounded-md text-xs"
                    />
                    <span className="font-bold text-red-800 text-[10px]">kg/m³</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-red-700">
                  <span>{isFrench ? 'Seuil minimal :' : 'Min Cutoff:'}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={hardCutoff}
                      onChange={(e) => setHardCutoff(parseInt(e.target.value) || 125)}
                      className="w-14 px-1.5 py-0.5 text-right font-bold text-red-900 bg-white border border-red-300 rounded-md text-xs"
                    />
                    <span>MPa ({stats.hardPct}% de la surface)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Editable Boreholes Table */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 block">
                {isFrench ? 'Sondages Exploratoires d’Étalonnage' : 'Exploration Borehole Assays'} ({boreholes.length})
              </span>
              <button
                onClick={handleAddBorehole}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
              >
                <PlusCircle className="w-3 h-3 text-blue-600" />
                <span>{isFrench ? '+ Nouveau Sondage' : '+ Add Borehole'}</span>
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto text-xs pr-1 border border-slate-100 rounded-xl">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-1 px-2">ID</th>
                    <th className="py-1 px-2">UCS (MPa)</th>
                    <th className="py-1 px-2">RQD (%)</th>
                    <th className="py-1 px-2">{isFrench ? 'Or (g/t)' : 'Gold (g/t)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {boreholes.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50">
                      <td className="py-1 px-2 font-bold text-slate-900">{b.id}</td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          value={b.ucsMPa}
                          onChange={(e) => handleUpdateBorehole(b.id, 'ucsMPa', parseInt(e.target.value) || 0)}
                          className="w-14 px-1 py-0.5 border border-slate-200 rounded text-slate-800 font-semibold text-xs"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          value={b.rqdPercent}
                          onChange={(e) => handleUpdateBorehole(b.id, 'rqdPercent', parseInt(e.target.value) || 0)}
                          className="w-12 px-1 py-0.5 border border-slate-200 rounded text-slate-800 text-xs"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input
                          type="number"
                          step="0.1"
                          value={b.goldGradeGPT}
                          onChange={(e) => handleUpdateBorehole(b.id, 'goldGradeGPT', parseFloat(e.target.value) || 0)}
                          className="w-12 px-1 py-0.5 border border-slate-200 rounded text-amber-700 font-bold text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {isFrench
                ? '💡 Modifiez directement les valeurs des sondages ci-dessus pour observer l’adaptation immédiate de la carte krigée.'
                : '💡 Directly edit borehole values above to watch the Kriged spatial heatmap update in real-time.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
