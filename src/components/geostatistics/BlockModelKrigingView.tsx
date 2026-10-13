import React, { useState, useEffect, useRef } from 'react';
import type { BoreholeSample, KrigingGridNode } from '../../types/advanced';
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
} from 'lucide-react';

interface BlockModelKrigingViewProps {
  lang?: 'en' | 'fr';
}

export const BlockModelKrigingView: React.FC<BlockModelKrigingViewProps> = ({ lang = 'en' }) => {
  const isFrench = lang === 'fr';

  const [boreholes, setBoreholes] = useState<BoreholeSample[]>([]);
  const [selectedAttribute, setSelectedAttribute] = useState<keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>>('ucsMPa');
  const [krigingGrid, setKrigingGrid] = useState<KrigingGridNode[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const demo = generateDemoBoreholes();
    setBoreholes(demo);
  }, []);

  useEffect(() => {
    if (boreholes.length > 0) {
      const grid = computeKrigingGrid(boreholes, selectedAttribute, 20, 14, 0, 60, 0, 40, DEFAULT_VARIOGRAM);
      setKrigingGrid(grid);
    }
  }, [boreholes, selectedAttribute]);

  // Render Kriging Heatmap on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || krigingGrid.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Compute min and max values for color scaling
    const vals = krigingGrid.map((n) => n.estimatedValue);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    const cols = 20;
    const rows = 14;
    const cellW = width / cols;
    const cellH = height / rows;

    krigingGrid.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);

      const ratio = Math.max(0, Math.min(1, (node.estimatedValue - minVal) / (maxVal - minVal || 1)));

      // Smooth color palette: Blue (soft/low) -> Green -> Yellow -> Red (hard/high)
      let color = '#3b82f6';
      if (ratio > 0.7) color = '#ef4444';
      else if (ratio > 0.45) color = '#f59e0b';
      else if (ratio > 0.25) color = '#10b981';

      ctx.fillStyle = color;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
    });

    // Draw borehole collar positions
    boreholes.forEach((bh) => {
      const px = (bh.easting / 60) * width;
      const py = (bh.northing / 40) * height;

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(bh.id, px + 8, py + 3);
    });
  }, [krigingGrid, boreholes]);

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
                {isFrench ? 'Variogramme Sphérique' : 'Spherical Variogram'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFrench
                ? 'Interpolation spatiale de la résistance de la roche (UCS, RQD) et zonage intelligent du plan de tir'
                : 'Spatial kriging of rock strength (UCS, RQD) and automatic blast domain zonation'}
            </p>
          </div>
        </div>

        {/* Attribute Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedAttribute}
            onChange={(e) => setSelectedAttribute(e.target.value as any)}
            className="bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold"
          >
            <option value="ucsMPa">{isFrench ? 'Résistance UCS (MPa)' : 'Rock Strength (UCS MPa)'}</option>
            <option value="rqdPercent">{isFrench ? 'Qualité RQD (%)' : 'Rock Quality RQD (%)'}</option>
            <option value="jointSpacingM">{isFrench ? 'Espacement des Diaclases (m)' : 'Joint Spacing (m)'}</option>
            <option value="goldGradeGPT">{isFrench ? 'Teneur en Or (g/t Au)' : 'Gold Grade (g/t Au)'}</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Left Heatmap Canvas, Right Borehole Table & Domain Zonation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Kriging Heatmap Canvas */}
        <div className="lg:col-span-7 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-400" />
              {isFrench ? 'Carte d’Interpolation Krigée (Gradin 840 RL)' : 'Kriged Spatial Heatmap (Bench 840 RL)'}
            </span>
            <span>{isFrench ? 'Échelle : 60m x 40m' : 'Scale: 60m x 40m'}</span>
          </div>

          <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            <canvas
              ref={canvasRef}
              width={720}
              height={450}
              className="w-full h-full object-cover"
            />
            {/* Legend Overlay */}
            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[10px] text-white flex items-center gap-3">
              <span className="text-blue-400 font-bold">{isFrench ? '■ Zone Fracturée / Tendre' : '■ Soft / Fractured Zone'}</span>
              <span className="text-amber-400 font-bold">{isFrench ? '■ Intermédiaire' : '■ Intermediate'}</span>
              <span className="text-red-400 font-bold">{isFrench ? '■ Zone Dure / Massive' : '■ Hard / Massive Zone'}</span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Automated Blast Domain Zonation */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
              {isFrench ? 'Zonage Géologique & Dosage Recommandé' : 'Geological Blast Domain Zonation'}
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-bold text-blue-900 block text-[11px]">{isFrench ? 'Domaine Tendre & Fracturé' : 'Soft Fractured Domain'}</span>
                  <span className="text-[10px] text-blue-700">UCS &lt; 75 MPa • RQD &lt; 50%</span>
                </div>
                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                  0.45 kg/m³
                </span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-bold text-emerald-900 block text-[11px]">{isFrench ? 'Domaine Standard Intermédiaire' : 'Intermediate Domain'}</span>
                  <span className="text-[10px] text-emerald-700">UCS 75 - 125 MPa</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black">
                  0.65 kg/m³
                </span>
              </div>

              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-bold text-red-900 block text-[11px]">{isFrench ? 'Domaine Dur & Massif' : 'Hard Massive Domain'}</span>
                  <span className="text-[10px] text-red-700">UCS &gt; 125 MPa • RQD &gt; 80%</span>
                </div>
                <span className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-black">
                  0.85 kg/m³
                </span>
              </div>
            </div>
          </div>

          {/* Borehole Samples Table */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-800 block">
              {isFrench ? 'Sondages Exploratoires d’Étalonnage' : 'Exploration Borehole Assays'} ({boreholes.length})
            </span>
            <div className="max-h-36 overflow-y-auto text-xs pr-1">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-1 px-2">ID</th>
                    <th className="py-1 px-2">UCS (MPa)</th>
                    <th className="py-1 px-2">RQD</th>
                    <th className="py-1 px-2">{isFrench ? 'Or (g/t)' : 'Gold (g/t)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {boreholes.map((b) => (
                    <tr key={b.id}>
                      <td className="py-1 px-2 font-bold text-slate-900">{b.id}</td>
                      <td className="py-1 px-2 text-slate-700">{b.ucsMPa}</td>
                      <td className="py-1 px-2 text-slate-700">{b.rqdPercent}%</td>
                      <td className="py-1 px-2 font-bold text-amber-600">{b.goldGradeGPT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
