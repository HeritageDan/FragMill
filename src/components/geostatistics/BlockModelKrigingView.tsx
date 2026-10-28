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
  Eye,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { SendToReportButton } from '../report/SendToReportButton';

export type KrigingDisplayMode = 'heatmap' | 'variance' | 'domains';

export const ATTRIBUTE_METADATA: Record<
  keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>,
  { nameEn: string; nameFr: string; unit: string; defaultSoft: number; defaultHard: number; step: number }
> = {
  ucsMPa: { nameEn: 'Rock Strength (UCS)', nameFr: 'Résistance UCS', unit: 'MPa', defaultSoft: 75, defaultHard: 125, step: 5 },
  rqdPercent: { nameEn: 'Rock Quality (RQD)', nameFr: 'Qualité RQD', unit: '%', defaultSoft: 50, defaultHard: 75, step: 5 },
  jointSpacingM: { nameEn: 'Joint Spacing', nameFr: 'Espacement des Diaclases', unit: 'm', defaultSoft: 0.35, defaultHard: 0.75, step: 0.05 },
  densityTPerM3: { nameEn: 'Rock Density', nameFr: 'Densité Roche', unit: 't/m³', defaultSoft: 2.62, defaultHard: 2.70, step: 0.02 },
  goldGradeGPT: { nameEn: 'Gold Grade', nameFr: 'Teneur en Or', unit: 'g/t Au', defaultSoft: 1.0, defaultHard: 2.5, step: 0.1 },
};

function interpolateRgb(c1: number[], c2: number[], t: number): string {
  const r = Math.round(c1[0] + t * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + t * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + t * (c2[2] - c1[2]));
  return `rgb(${r}, ${g}, ${b})`;
}

// Turbo Geological Heatmap (Low: Navy Blue -> Cyan -> Emerald Green -> Amber -> High: Red)
function getTurboHeatmapColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.25) return interpolateRgb([30, 58, 138], [6, 182, 212], c / 0.25);
  if (c < 0.50) return interpolateRgb([6, 182, 212], [16, 185, 129], (c - 0.25) / 0.25);
  if (c < 0.75) return interpolateRgb([16, 185, 129], [245, 158, 11], (c - 0.50) / 0.25);
  return interpolateRgb([245, 158, 11], [239, 68, 68], (c - 0.75) / 0.25);
}

// Variance Heatmap (Low error / high confidence: Dark Navy -> Purple -> High error: Coral/Rose)
function getVarianceHeatmapColor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.35) return interpolateRgb([15, 23, 42], [59, 130, 246], c / 0.35);
  if (c < 0.70) return interpolateRgb([59, 130, 246], [168, 85, 247], (c - 0.35) / 0.35);
  return interpolateRgb([168, 85, 247], [244, 63, 94], (c - 0.70) / 0.30);
}

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

  // Visualization Mode: 'heatmap' (continuous values), 'variance' (Kriging uncertainty), 'domains' (blast zonation)
  const [displayMode, setDisplayMode] = useState<KrigingDisplayMode>('heatmap');

  // Interactive Variogram Parameters
  const [variogramParams, setVariogramParams] = useState<VariogramParams>(DEFAULT_VARIOGRAM);
  const [gridResolution, setGridResolution] = useState<{ cols: number; rows: number }>({ cols: 20, rows: 14 });

  // Domain Thresholds
  const [softCutoff, setSoftCutoff] = useState<number>(75);
  const [hardCutoff, setHardCutoff] = useState<number>(125);
  const [softPF, setSoftPF] = useState<number>(0.45);
  const [interPF, setInterPF] = useState<number>(0.65);
  const [hardPF, setHardPF] = useState<number>(0.85);

  const [showExplanation, setShowExplanation] = useState<boolean>(true);
  const [krigingGrid, setKrigingGrid] = useState<KrigingGridNode[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{
    xM: number;
    yM: number;
    value: number;
    variance: number;
    stdError: number;
    domain: string;
    col: number;
    row: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // When switching attribute, automatically adapt domain thresholds
  const handleAttributeChange = (
    newAttr: keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>
  ) => {
    setSelectedAttribute(newAttr);
    const meta = ATTRIBUTE_METADATA[newAttr];
    if (meta) {
      setSoftCutoff(meta.defaultSoft);
      setHardCutoff(meta.defaultHard);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || krigingGrid.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;

    const cols = gridResolution.cols;
    const rows = gridResolution.rows;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    const col = Math.min(cols - 1, Math.max(0, Math.floor(clientX / cellW)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(clientY / cellH)));
    const index = row * cols + col;
    const node = krigingGrid[index];

    if (node) {
      const val = node.estimatedValue;
      const domain =
        val > hardCutoff
          ? (isFrench ? 'Domaine Dur / Massif' : 'Hard / Massive Domain')
          : val >= softCutoff
          ? (isFrench ? 'Domaine Intermédiaire' : 'Intermediate Domain')
          : (isFrench ? 'Domaine Tendre / Fracturé' : 'Soft / Fractured Domain');

      setHoveredCell({
        xM: Number(node.x.toFixed(1)),
        yM: Number(node.y.toFixed(1)),
        value: Number(node.estimatedValue.toFixed(2)),
        variance: Number(node.estimationVariance.toFixed(2)),
        stdError: Number(Math.sqrt(Math.max(0, node.estimationVariance)).toFixed(2)),
        domain,
        col,
        row,
      });
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCell(null);
  };

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

  // Render Kriging Heatmap on Canvas (Heatmap, Variance, or Domain Zonation)
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

    const vars = krigingGrid.map((n) => n.estimationVariance);
    const minVar = Math.min(...vars);
    const maxVar = Math.max(...vars);

    const cols = gridResolution.cols;
    const rows = gridResolution.rows;
    const cellW = width / cols;
    const cellH = height / rows;

    // 1. Draw Cells according to active Display Mode
    krigingGrid.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);

      let color = '#3b82f6';

      if (displayMode === 'heatmap') {
        const ratio = maxVal > minVal ? (node.estimatedValue - minVal) / (maxVal - minVal) : 0.5;
        color = getTurboHeatmapColor(ratio);
      } else if (displayMode === 'variance') {
        const ratio = maxVar > minVar ? (node.estimationVariance - minVar) / (maxVar - minVar) : 0.5;
        color = getVarianceHeatmapColor(ratio);
      } else {
        // Domains mode (discrete 3-tier zonation)
        if (node.estimatedValue > hardCutoff) color = '#ef4444';
        else if (node.estimatedValue >= softCutoff) color = '#10b981';
        else color = '#3b82f6';
      }

      ctx.fillStyle = color;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);

      // Subtle cell boundary
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
    });

    // 2. Draw 10-meter Coordinate Grid Overlay
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    // Vertical grid lines (every 10m out of 60m)
    for (let xM = 10; xM < 60; xM += 10) {
      const px = (xM / 60) * width;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    // Horizontal grid lines (every 10m out of 40m)
    for (let yM = 10; yM < 40; yM += 10) {
      const py = (yM / 40) * height;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Highlight Hovered Cell
    if (hoveredCell) {
      const c = hoveredCell.col;
      const r = hoveredCell.row;
      ctx.save();
      ctx.strokeStyle = '#fde047'; // Bright yellow
      ctx.lineWidth = 2.5;
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
      ctx.restore();
    }

    // 4. Draw Borehole Collars with Assayed Values
    const unit = ATTRIBUTE_METADATA[selectedAttribute]?.unit || '';
    boreholes.forEach((bh) => {
      const px = (bh.easting / 60) * width;
      const py = (bh.northing / 40) * height;

      // Collar circle
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner bullseye
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Borehole label tag (ID + Assayed Value)
      const assayVal = bh[selectedAttribute];
      const labelText = `${bh.id}: ${assayVal}${unit}`;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      const textW = ctx.measureText(labelText).width;
      ctx.beginPath();
      ctx.roundRect(px + 10, py - 8, textW + 8, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, px + 14, py);
    });
  }, [krigingGrid, boreholes, gridResolution, softCutoff, hardCutoff, displayMode, hoveredCell, selectedAttribute]);

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
            onChange={(e) => handleAttributeChange(e.target.value as any)}
            className="bg-slate-100 text-slate-800 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold"
          >
            <option value="ucsMPa">{isFrench ? 'Résistance UCS (MPa)' : 'Rock Strength (UCS MPa)'}</option>
            <option value="rqdPercent">{isFrench ? 'Qualité RQD (%)' : 'Rock Quality RQD (%)'}</option>
            <option value="jointSpacingM">{isFrench ? 'Espacement Diaclases (m)' : 'Joint Spacing (m)'}</option>
            <option value="densityTPerM3">{isFrench ? 'Densité Roche (t/m³)' : 'Rock Density (t/m³)'}</option>
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
            summaryFr={`Krigeage ordinaire (${variogramParams.model}, portée ${variogramParams.rangeM}m) : ${stats.mean} ${ATTRIBUTE_METADATA[selectedAttribute]?.unit} moyen, ${stats.hardPct}% dur / ${stats.softPct}% tendre.`}
            summaryEn={`Ordinary Kriging (${variogramParams.model}, range ${variogramParams.rangeM}m): mean ${stats.mean} ${ATTRIBUTE_METADATA[selectedAttribute]?.unit}, ${stats.hardPct}% hard / ${stats.softPct}% soft.`}
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
                ? 'Fonctionnement du Module Géostatistique & Interprétation'
                : 'How Geostatistics & Kriging Function in FragMill'}
            </h3>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              ✕ {isFrench ? 'Masquer' : 'Dismiss'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-blue-900 leading-relaxed">
            <div className="p-3 bg-white/90 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                📍 {isFrench ? 'Sur quelle surface ?' : 'Which Surface?'}
              </span>
              <p>
                {isFrench
                  ? 'Le krigeage est appliqué au plan horizontal du gradin d’abattage (cote 840 RL) sur un polygone de 60m (Est-Ouest) × 40m (Nord-Sud). La grille découpe le banc en mailles discrètes pour cartographier le massif avant foration.'
                  : 'Kriging interpolates the 2D horizontal mining excavation bench plane (elevation 840 RL) across a 60m (Easting) × 40m (Northing) pattern to characterize the bench prior to drill & blast.'}
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                🔬 {isFrench ? 'Quelles variables ?' : 'What Variables?'}
              </span>
              <p>
                {isFrench
                  ? 'Vous pouvez interpoler la résistance UCS (MPa), la qualité RQD (%), l’espacement des joints (m), la densité rocheuse (t/m³) ou la teneur minérale (g/t Au) mesurées sur les sondages d’exploration.'
                  : 'Interpolates compressive strength UCS (MPa), Rock Quality Designation RQD (%), Joint Spacing (m), in-situ Density (t/m³), or Ore Grade (g/t Au) from exploratory borehole assays.'}
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                📈 {isFrench ? 'Impact du Variogramme' : 'Variogram Parameters'}
              </span>
              <p>
                {isFrench
                  ? 'La portée (a) définit la distance d’influence : plus elle est grande, plus l’interpolation est lissée. La pépite (C0) règle le bruit local : une pépite élevée tire vers la moyenne du gradin. Le palier (C) fixe la dispersion totale.'
                  : 'Range (a) sets spatial reach: larger range creates smoother global interpolation; smaller range localizes borehole impact. Nugget (C0) models measurement noise: higher nugget pulls toward bench mean. Sill (C) scales kriging variance.'}
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-blue-100">
              <span className="font-extrabold block text-blue-950 mb-1">
                🎯 {isFrench ? 'Zonage Intelligent du Tir' : 'Blast Domain Zonation'}
              </span>
              <p>
                {isFrench
                  ? 'Associe chaque maille à un domaine (Tendre, Intermédiaire, Dur) pour adapter le dosage d’explosif (ex: 0.45 kg/m³ en zone fracturée vs 0.85 kg/m³ en roche massive), optimisant fragmentation et coût d’ANFO.'
                  : 'Assigns each block to a blast domain (Soft, Intermediate, Hard) to vary explosive powder factor (e.g. 0.45 kg/m³ in fractured rock vs 0.85 kg/m³ in massive ground), minimizing oversize & fines.'}
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
          <div className="flex flex-wrap justify-between items-center text-xs text-slate-400 gap-2">
            <span className="font-semibold flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-400" />
              {isFrench ? 'Carte d’Interpolation Krigée (Gradin 840 RL)' : 'Kriged Spatial Heatmap (Bench 840 RL)'}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {isFrench ? 'Étendue : 60m × 40m' : 'Extent: 60m × 40m'} • {boreholes.length} {isFrench ? 'sondages' : 'boreholes'}
            </span>
          </div>

          {/* Visualization Mode Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDisplayMode('heatmap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  displayMode === 'heatmap'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Carte Continue (Turbo)' : 'Continuous Heatmap'}</span>
              </button>
              <button
                onClick={() => setDisplayMode('variance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  displayMode === 'variance'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Incertitude Krigeage (σ²)' : 'Kriging Variance (σ²)'}</span>
              </button>
              <button
                onClick={() => setDisplayMode('domains')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  displayMode === 'domains'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Zonage Domaines' : 'Blast Domains'}</span>
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-mono pr-1 hidden sm:inline">
              {displayMode === 'heatmap' && (isFrench ? '● Gradient continu de la variable' : '● Continuous attribute heatmap')}
              {displayMode === 'variance' && (isFrench ? '● Erreur d’estimation BLUE σ²' : '● BLUE Kriging uncertainty σ²')}
              {displayMode === 'domains' && (isFrench ? '● 3 domaines de charge' : '● 3 explosive loading domains')}
            </span>
          </div>

          <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={720}
              height={450}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              className="w-full h-full object-cover"
            />

            {/* Dynamic Legend Overlay */}
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto bg-black/85 backdrop-blur-xs px-3 py-2 rounded-xl text-[10px] text-white border border-white/10 shadow-lg">
              {displayMode === 'heatmap' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-300 gap-4">
                    <span>Min: <strong className="text-cyan-400">{stats.min} {ATTRIBUTE_METADATA[selectedAttribute]?.unit}</strong></span>
                    <span>Moy: <strong className="text-emerald-400">{stats.mean} {ATTRIBUTE_METADATA[selectedAttribute]?.unit}</strong></span>
                    <span>Max: <strong className="text-red-400">{stats.max} {ATTRIBUTE_METADATA[selectedAttribute]?.unit}</strong></span>
                  </div>
                  <div className="w-48 sm:w-64 h-2.5 rounded-full bg-gradient-to-r from-blue-700 via-emerald-400 to-red-500 border border-white/20" />
                </div>
              )}

              {displayMode === 'variance' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-300 gap-4">
                    <span className="text-blue-400">Faible Incertitude (Proche sondage)</span>
                    <span className="text-rose-400">Forte Incertitude (Zone isolée)</span>
                  </div>
                  <div className="w-48 sm:w-64 h-2.5 rounded-full bg-gradient-to-r from-slate-900 via-blue-500 via-purple-500 to-rose-500 border border-white/20" />
                </div>
              )}

              {displayMode === 'domains' && (
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 font-bold">
                    ■ {isFrench ? `Tendre (< ${softCutoff} ${ATTRIBUTE_METADATA[selectedAttribute]?.unit})` : `Soft (< ${softCutoff} ${ATTRIBUTE_METADATA[selectedAttribute]?.unit})`} ({stats.softPct}%)
                  </span>
                  <span className="text-emerald-400 font-bold">
                    ■ {isFrench ? 'Intermédiaire' : 'Intermediate'} ({stats.interPct}%)
                  </span>
                  <span className="text-red-400 font-bold">
                    ■ {isFrench ? `Massif (> ${hardCutoff} ${ATTRIBUTE_METADATA[selectedAttribute]?.unit})` : `Hard (> ${hardCutoff} ${ATTRIBUTE_METADATA[selectedAttribute]?.unit})`} ({stats.hardPct}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Cell Hover Inspector HUD */}
          {hoveredCell ? (
            <div className="bg-slate-900/90 border border-amber-500/40 p-2.5 rounded-xl flex flex-wrap items-center justify-between text-xs text-white gap-2 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-slate-300 font-mono text-[11px]">
                  X = <strong>{hoveredCell.xM} m</strong>, Y = <strong>{hoveredCell.yM} m</strong>
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-200">
                  {isFrench ? ATTRIBUTE_METADATA[selectedAttribute]?.nameFr : ATTRIBUTE_METADATA[selectedAttribute]?.nameEn}:{' '}
                  <strong className="text-amber-400 font-mono text-sm">
                    {hoveredCell.value} {ATTRIBUTE_METADATA[selectedAttribute]?.unit}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-purple-300">
                  Var σ²: <strong>{hoveredCell.variance}</strong> (±{hoveredCell.stdError})
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[10px]">
                  {hoveredCell.domain}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 text-center italic py-1">
              {isFrench
                ? 'Survolez la carte au curseur pour inspecter la valeur krigée et l’incertitude locale (σ²).'
                : 'Hover over the grid map to inspect local kriged estimate and kriging variance (σ²).'}
            </div>
          )}

          {/* Quick Summary Pill Bar */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">{isFrench ? 'Moyenne Krigée' : 'Kriged Mean'}</span>
              <strong className="text-white text-sm">
                {stats.mean} {ATTRIBUTE_METADATA[selectedAttribute]?.unit}
              </strong>
            </div>
            <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">{isFrench ? 'Étendue (Min - Max)' : 'Range (Min - Max)'}</span>
              <strong className="text-blue-400 text-sm">
                {stats.min} - {stats.max} {ATTRIBUTE_METADATA[selectedAttribute]?.unit}
              </strong>
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
                      step={ATTRIBUTE_METADATA[selectedAttribute]?.step || 1}
                      value={softCutoff}
                      onChange={(e) => setSoftCutoff(parseFloat(e.target.value) || 0)}
                      className="w-16 px-1.5 py-0.5 text-right font-bold text-blue-900 bg-white border border-blue-300 rounded-md text-xs"
                    />
                    <span>{ATTRIBUTE_METADATA[selectedAttribute]?.unit} ({stats.softPct}% {isFrench ? 'du gradin' : 'of bench'})</span>
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
                  <span>{softCutoff} - {hardCutoff} {ATTRIBUTE_METADATA[selectedAttribute]?.unit} ({stats.interPct}% {isFrench ? 'du gradin' : 'of bench'})</span>
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
                      step={ATTRIBUTE_METADATA[selectedAttribute]?.step || 1}
                      value={hardCutoff}
                      onChange={(e) => setHardCutoff(parseFloat(e.target.value) || 0)}
                      className="w-16 px-1.5 py-0.5 text-right font-bold text-red-900 bg-white border border-red-300 rounded-md text-xs"
                    />
                    <span>{ATTRIBUTE_METADATA[selectedAttribute]?.unit} ({stats.hardPct}% {isFrench ? 'du gradin' : 'of bench'})</span>
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
