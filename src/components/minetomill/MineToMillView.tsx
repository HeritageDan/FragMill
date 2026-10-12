import React, { useState } from 'react';
import type { Blast, MillBatch } from '../../types';
import { computeMillKPIs } from '../../services/minetomill';
import { MineToMillScatterPlot } from '../charts/FragmentationCharts';
import {
  Zap,
  Activity,
  Award,
  Factory,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

interface MineToMillViewProps {
  blasts: Blast[];
  onUpdateMillBatch: (blastId: string, millBatch: MillBatch) => void;
  lang?: 'en' | 'fr';
}

export const MineToMillView: React.FC<MineToMillViewProps> = ({
  blasts,
  onUpdateMillBatch,
  lang = 'en',
}) => {
  const [selectedBlastId, setSelectedBlastId] = useState<string>(blasts[0]?.id || '');

  const selectedBlast = blasts.find((b) => b.id === selectedBlastId) || blasts[0];
  const millBatch = selectedBlast?.millBatch;

  // Form states for MillBatch entry
  const [batchTonnage, setBatchTonnage] = useState(millBatch?.batchTonnageTonnes || 1500);
  const [truckCount, setTruckCount] = useState(millBatch?.truckCount || 75);
  const [boulders, setBoulders] = useState(millBatch?.bouldersSecondaryBreakingCount || 6);
  const [crushingTime, setCrushingTime] = useState(millBatch?.crushingTimeHours || 18);
  const [crushingEnergy, setCrushingEnergy] = useState(millBatch?.crushingEnergyKwh || 2800);
  const [millingThroughput, setMillingThroughput] = useState(millBatch?.millingThroughputTph || 65);
  const [millingEnergy, setMillingEnergy] = useState(millBatch?.millingEnergyKwh || 25000);
  const [headGrade, setHeadGrade] = useState(millBatch?.headGradeGpt || 3.5);
  const [tailsGrade, setTailsGrade] = useState(millBatch?.tailsGradeGpt || 0.45);
  const [concentrateGrade, setConcentrateGrade] = useState(millBatch?.concentrateGradeGpt || 140);
  const [notes, setNotes] = useState(millBatch?.processingNotes || '');

  // Live computed KPIs
  const liveKPIs = computeMillKPIs(
    batchTonnage,
    crushingEnergy,
    millingEnergy,
    headGrade,
    tailsGrade,
    concentrateGrade
  );

  const handleSaveMillBatch = () => {
    const updated: MillBatch = {
      id: millBatch?.id || `mb-${Date.now()}`,
      blastId: selectedBlast.id,
      batchTonnageTonnes: batchTonnage,
      truckCount,
      meanLoadTonnes: Number((batchTonnage / Math.max(1, truckCount)).toFixed(1)),
      bouldersSecondaryBreakingCount: boulders,
      crushingTimeHours: crushingTime,
      crushingEnergyKwh: crushingEnergy,
      millingThroughputTph: millingThroughput,
      millingEnergyKwh: millingEnergy,
      headGradeGpt: headGrade,
      tailsGradeGpt: tailsGrade,
      concentrateGradeGpt: concentrateGrade,
      processingNotes: notes,
      crushingSpecificEnergyKwhPerT: liveKPIs.crushingSpecificEnergyKwhPerT,
      millingSpecificEnergyKwhPerT: liveKPIs.millingSpecificEnergyKwhPerT,
      totalSpecificEnergyKwhPerT: liveKPIs.totalSpecificEnergyKwhPerT,
      simpleGoldRecoveryPercent: liveKPIs.simpleGoldRecoveryPercent,
      twoProductGoldRecoveryPercent: liveKPIs.twoProductGoldRecoveryPercent,
      oversizeRejectsPercent: Number(((boulders * 1.5 * 100) / batchTonnage).toFixed(1)),
      createdAt: millBatch?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onUpdateMillBatch(selectedBlast.id, updated);
  };

  // Compile cross-blast dataset for correlation scatter plots
  const scatterEnergyData: Array<{ blastId: string; p80Mm: number; kpiValue: number; label: string }> = [];
  const scatterThroughputData: Array<{ blastId: string; p80Mm: number; kpiValue: number; label: string }> = [];
  const scatterRecoveryData: Array<{ blastId: string; p80Mm: number; kpiValue: number; label: string }> = [];

  for (const b of blasts) {
    const mb = b.millBatch;
    const p80 = b.images[0]?.segmentationRuns?.[0]?.metrics?.p80 || (b.blastId === 'BL-2026-001' ? 285 : b.blastId === 'BL-2026-002' ? 195 : 142);
    if (mb) {
      scatterEnergyData.push({
        blastId: b.blastId,
        p80Mm: p80,
        kpiValue: mb.totalSpecificEnergyKwhPerT,
        label: `${mb.totalSpecificEnergyKwhPerT} kWh/t`,
      });
      scatterThroughputData.push({
        blastId: b.blastId,
        p80Mm: p80,
        kpiValue: mb.millingThroughputTph,
        label: `${mb.millingThroughputTph} t/h`,
      });
      scatterRecoveryData.push({
        blastId: b.blastId,
        p80Mm: p80,
        kpiValue: mb.simpleGoldRecoveryPercent,
        label: `${mb.simpleGoldRecoveryPercent}%`,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <Factory className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {lang === 'fr' ? 'Module Mine-au-Moulin & Récupération' : 'Mine-to-Mill Comminution & Recovery Lab'}
            </h2>
            <p className="text-xs text-slate-500">
              Correlating post-blast fragmentation directly with crushing energy, milling throughput, and gold recovery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Active Blast:</span>
          <select
            value={selectedBlastId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedBlastId(newId);
              const b = blasts.find((x) => x.id === newId);
              if (b?.millBatch) {
                setBatchTonnage(b.millBatch.batchTonnageTonnes);
                setTruckCount(b.millBatch.truckCount || 75);
                setBoulders(b.millBatch.bouldersSecondaryBreakingCount || 0);
                setCrushingTime(b.millBatch.crushingTimeHours);
                setCrushingEnergy(b.millBatch.crushingEnergyKwh);
                setMillingThroughput(b.millBatch.millingThroughputTph);
                setMillingEnergy(b.millBatch.millingEnergyKwh);
                setHeadGrade(b.millBatch.headGradeGpt);
                setTailsGrade(b.millBatch.tailsGradeGpt);
                setConcentrateGrade(b.millBatch.concentrateGradeGpt || 140);
                setNotes(b.millBatch.processingNotes || '');
              }
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
          >
            {blasts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.blastId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-700">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Specific Energy</span>
            <span className="text-lg font-black text-slate-900">{liveKPIs.totalSpecificEnergyKwhPerT} kWh/t</span>
            <span className="text-[10px] text-slate-500 block">
              Crush: {liveKPIs.crushingSpecificEnergyKwhPerT} | Mill: {liveKPIs.millingSpecificEnergyKwhPerT}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Milling Throughput</span>
            <span className="text-lg font-black text-slate-900">{millingThroughput} t/h</span>
            <span className="text-[10px] text-emerald-600 block font-medium">Feed Rate</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Simple Gold Recovery R</span>
            <span className="text-lg font-black text-slate-900">{liveKPIs.simpleGoldRecoveryPercent}%</span>
            <span className="text-[10px] text-slate-500 block">(Head - Tails) / Head</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl text-purple-700">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Two-Product Recovery</span>
            <span className="text-lg font-black text-slate-900">
              {liveKPIs.twoProductGoldRecoveryPercent !== undefined ? `${liveKPIs.twoProductGoldRecoveryPercent}%` : '-'}
            </span>
            <span className="text-[10px] text-slate-500 block">Concentrate metallurgical balance</span>
          </div>
        </div>
      </div>

      {/* Grid: Left Entry Form, Right Correlation Scatter Plots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): MillBatch Entry Form */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Plant Processing Batch Parameters ({selectedBlast.blastId})
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Batch Tonnage (t)</label>
              <input
                type="number"
                value={batchTonnage}
                onChange={(e) => setBatchTonnage(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Truck Count</label>
              <input
                type="number"
                value={truckCount}
                onChange={(e) => setTruckCount(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Oversize Boulders Count</label>
              <input
                type="number"
                value={boulders}
                onChange={(e) => setBoulders(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Throughput (t/h)</label>
              <input
                type="number"
                value={millingThroughput}
                onChange={(e) => setMillingThroughput(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Crushing Energy (kWh)</label>
              <input
                type="number"
                value={crushingEnergy}
                onChange={(e) => setCrushingEnergy(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Milling Energy (kWh)</label>
              <input
                type="number"
                value={millingEnergy}
                onChange={(e) => setMillingEnergy(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Head Grade f (g/t Au)</label>
              <input
                type="number"
                step="0.01"
                value={headGrade}
                onChange={(e) => setHeadGrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tails Grade t (g/t Au)</label>
              <input
                type="number"
                step="0.01"
                value={tailsGrade}
                onChange={(e) => setTailsGrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-bold"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-600 font-medium mb-1">
                Concentrate Grade c (g/t Au) - Optional
              </label>
              <input
                type="number"
                value={concentrateGrade}
                onChange={(e) => setConcentrateGrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Processing Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleSaveMillBatch}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
          >
            <Save className="w-4 h-4" /> Save Mill Batch Record
          </button>
        </div>

        {/* Right Column (7 cols): Comminution & Recovery Correlation Plots */}
        <div className="lg:col-span-7 space-y-4">
          <MineToMillScatterPlot
            data={scatterEnergyData}
            xLabel="P80 Fragmentation"
            yLabel="Total Comminution Specific Energy"
            yUnit="kWh/t"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MineToMillScatterPlot
              data={scatterThroughputData}
              xLabel="P80 Fragmentation"
              yLabel="Milling Plant Throughput"
              yUnit="t/h"
            />
            <MineToMillScatterPlot
              data={scatterRecoveryData}
              xLabel="P80 Fragmentation"
              yLabel="Gold Recovery Rate"
              yUnit="%"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
