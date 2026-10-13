import React, { useState } from 'react';
import type { Blast, MillBatch } from '../../types';
import { computeMillKPIs } from '../../services/minetomill';
import { evaluateMineToMillEconomics, DEFAULT_ECONOMIC_PARAMS } from '../../services/economics';
import { MineToMillScatterPlot } from '../charts/FragmentationCharts';
import { t } from '../../i18n';
import {
  Zap,
  Activity,
  Award,
  Factory,
  CheckCircle2,
  AlertCircle,
  Save,
  DollarSign,
  Leaf,
  TrendingDown,
  Sliders,
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

  // Economic parameters state
  const [drillingCostPerM, setDrillingCostPerM] = useState(DEFAULT_ECONOMIC_PARAMS.drillingCostPerMeter);
  const [explosiveCostPerKg, setExplosiveCostPerKg] = useState(DEFAULT_ECONOMIC_PARAMS.explosiveCostPerKg);
  const [secondaryCostPerBoulder, setSecondaryCostPerBoulder] = useState(DEFAULT_ECONOMIC_PARAMS.secondaryBreakingCostPerBoulder);
  const [powerCostPerKwh, setPowerCostPerKwh] = useState(DEFAULT_ECONOMIC_PARAMS.crushingEnergyCostPerKwh);

  const activeP80ForEcon =
    selectedBlast.images[0]?.segmentationRuns?.[0]?.metrics?.p80 ||
    (selectedBlast.blastId === 'BL-2026-001' ? 285 : selectedBlast.blastId === 'BL-2026-002' ? 195 : 142);

  const econResult = evaluateMineToMillEconomics(selectedBlast, activeP80ForEcon, selectedBlast.millBatch, {
    drillingCostPerMeter: drillingCostPerM,
    explosiveCostPerKg,
    secondaryBreakingCostPerBoulder: secondaryCostPerBoulder,
    crushingEnergyCostPerKwh: powerCostPerKwh,
    millingEnergyCostPerKwh: powerCostPerKwh,
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <Factory className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {t('mineToMillTitle', lang)}
            </h2>
            <p className="text-xs text-slate-500">
              {t('mineToMillSubtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{t('selectBlast', lang)}</span>
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
            <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('totalSpecificEnergy', lang)}</span>
            <span className="text-lg font-black text-slate-900">{liveKPIs.totalSpecificEnergyKwhPerT} kWh/t</span>
            <span className="text-[10px] text-slate-500 block">
              {t('crushMillEnergy', lang)
                .replace('{crush}', `${liveKPIs.crushingSpecificEnergyKwhPerT}`)
                .replace('{mill}', `${liveKPIs.millingSpecificEnergyKwhPerT}`)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('millingThroughput', lang)}</span>
            <span className="text-lg font-black text-slate-900">{millingThroughput} t/h</span>
            <span className="text-[10px] text-emerald-600 block font-medium">{t('feedRate', lang)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-700">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('simpleGoldRecovery', lang)}</span>
            <span className="text-lg font-black text-slate-900">{liveKPIs.simpleGoldRecoveryPercent}%</span>
            <span className="text-[10px] text-slate-500 block">{t('headTailsFormula', lang)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl text-purple-700">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('twoProductRecovery', lang)}</span>
            <span className="text-lg font-black text-slate-900">
              {liveKPIs.twoProductGoldRecoveryPercent !== undefined ? `${liveKPIs.twoProductGoldRecoveryPercent}%` : '-'}
            </span>
            <span className="text-[10px] text-slate-500 block">{t('concentrateBalance', lang)}</span>
          </div>
        </div>
      </div>

      {/* Grid: Left Entry Form, Right Correlation Scatter Plots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): MillBatch Entry Form */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t('plantParamsTitle', lang)} ({selectedBlast.blastId})
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('batchTonnageT', lang)}</label>
              <input
                type="number"
                value={batchTonnage}
                onChange={(e) => setBatchTonnage(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('truckCount', lang)}</label>
              <input
                type="number"
                value={truckCount}
                onChange={(e) => setTruckCount(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('bouldersCount', lang)}</label>
              <input
                type="number"
                value={boulders}
                onChange={(e) => setBoulders(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('throughputTph', lang)}</label>
              <input
                type="number"
                value={millingThroughput}
                onChange={(e) => setMillingThroughput(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('crushingEnergyKwh', lang)}</label>
              <input
                type="number"
                value={crushingEnergy}
                onChange={(e) => setCrushingEnergy(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('millingEnergyKwh', lang)}</label>
              <input
                type="number"
                value={millingEnergy}
                onChange={(e) => setMillingEnergy(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('headGradeGpt', lang)}</label>
              <input
                type="number"
                step="0.01"
                value={headGrade}
                onChange={(e) => setHeadGrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">{t('tailsGradeGpt', lang)}</label>
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
                {t('concentrateGradeGpt', lang)}
              </label>
              <input
                type="number"
                value={concentrateGrade}
                onChange={(e) => setConcentrateGrade(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-600 font-medium mb-1">{t('processingNotes', lang)}</label>
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
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer"
          >
            <Save className="w-4 h-4" /> {t('saveMillBatch', lang)}
          </button>
        </div>

        {/* Right Column (7 cols): Comminution & Recovery Correlation Plots */}
        <div className="lg:col-span-7 space-y-4">
          <MineToMillScatterPlot
            data={scatterEnergyData}
            xLabel={lang === 'fr' ? 'Fragmentation P80' : 'P80 Fragmentation'}
            yLabel={lang === 'fr' ? 'Énergie Spécifique Totale de Comminution' : 'Total Comminution Specific Energy'}
            yUnit="kWh/t"
            lang={lang}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MineToMillScatterPlot
              data={scatterThroughputData}
              xLabel={lang === 'fr' ? 'Fragmentation P80' : 'P80 Fragmentation'}
              yLabel={lang === 'fr' ? 'Débit de Broyage de l’Usine' : 'Milling Plant Throughput'}
              yUnit="t/h"
              lang={lang}
            />
            <MineToMillScatterPlot
              data={scatterRecoveryData}
              xLabel={lang === 'fr' ? 'Fragmentation P80' : 'P80 Fragmentation'}
              yLabel={lang === 'fr' ? 'Taux de Récupération d’Or' : 'Gold Recovery Rate'}
              yUnit="%"
              lang={lang}
            />
          </div>
        </div>
      </div>

      {/* PROPOSAL 4: Mine-to-Mill Economic Optimization & Carbon Accounting Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {lang === 'fr' ? 'Optimisation Économique & Bilan Carbone Mine-au-Moulin' : 'Mine-to-Mill Economic Optimization & Carbon Footprint'}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Total Cost of Ownership
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'fr'
                  ? 'Équilibre économique entre le coût de foration/abattage et les économies de concassage/broyage'
                  : 'Financial sweet-spot balancing drill/blast expenditure against comminution electrical savings'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold">
              {lang === 'fr' ? `P80 Économique Optimal : ${econResult.sweetSpotP80Mm} mm` : `Economic Sweet-Spot P80: ${econResult.sweetSpotP80Mm} mm`}
            </span>
          </div>
        </div>

        {/* Economic Parameter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              {lang === 'fr' ? 'Coût Foration ($/m) :' : 'Drilling Cost ($/m):'}
            </label>
            <input
              type="number"
              step="0.5"
              value={drillingCostPerM}
              onChange={(e) => setDrillingCostPerM(parseFloat(e.target.value) || 16.5)}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              {lang === 'fr' ? 'Coût Explosif ($/kg) :' : 'Explosive Cost ($/kg):'}
            </label>
            <input
              type="number"
              step="0.1"
              value={explosiveCostPerKg}
              onChange={(e) => setExplosiveCostPerKg(parseFloat(e.target.value) || 1.85)}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              {lang === 'fr' ? 'BRH Hors-gabarit ($/bloc) :' : 'Boulder Breaking ($/bldr):'}
            </label>
            <input
              type="number"
              step="5"
              value={secondaryCostPerBoulder}
              onChange={(e) => setSecondaryCostPerBoulder(parseFloat(e.target.value) || 45)}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">
              {lang === 'fr' ? 'Tarif Électricité ($/kWh) :' : 'Electricity Tariff ($/kWh):'}
            </label>
            <input
              type="number"
              step="0.01"
              value={powerCostPerKwh}
              onChange={(e) => setPowerCostPerKwh(parseFloat(e.target.value) || 0.14)}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>
        </div>

        {/* Cost Breakdown & Carbon Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Cost Breakdown Table */}
          <div className="lg:col-span-6 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {lang === 'fr' ? 'Décomposition des Coûts Opérationnels par Tonne' : 'Direct Operational Cost per Tonne Breakdown'}
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">{lang === 'fr' ? 'Étape' : 'Process Stage'}</th>
                    <th className="py-2 px-3">{lang === 'fr' ? 'Coût ($/tonne)' : 'Cost ($/tonne)'}</th>
                    <th className="py-2 px-3">% Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">{lang === 'fr' ? '1. Foration' : '1. Drilling'}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900">${econResult.evaluation.drillingCostPerTon}</td>
                    <td className="py-1.5 px-3 text-slate-500">
                      {((econResult.evaluation.drillingCostPerTon / econResult.evaluation.totalCostPerTon) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">{lang === 'fr' ? '2. Abattage (Explosifs)' : '2. Blasting (Explosives)'}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900">${econResult.evaluation.blastingCostPerTon}</td>
                    <td className="py-1.5 px-3 text-slate-500">
                      {((econResult.evaluation.blastingCostPerTon / econResult.evaluation.totalCostPerTon) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">{lang === 'fr' ? '3. Débitage Secondaire (BRH)' : '3. Secondary Boulder Breaking'}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900">${econResult.evaluation.secondaryBreakingCostPerTon}</td>
                    <td className="py-1.5 px-3 text-slate-500">
                      {((econResult.evaluation.secondaryBreakingCostPerTon / econResult.evaluation.totalCostPerTon) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">{lang === 'fr' ? '4. Concassage (Énergie)' : '4. Crushing (Energy)'}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900">${econResult.evaluation.crushingCostPerTon}</td>
                    <td className="py-1.5 px-3 text-slate-500">
                      {((econResult.evaluation.crushingCostPerTon / econResult.evaluation.totalCostPerTon) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-3 text-slate-700">{lang === 'fr' ? '5. Broyage / Moulin (Énergie)' : '5. Grinding / Milling (Power)'}</td>
                    <td className="py-1.5 px-3 font-semibold text-slate-900">${econResult.evaluation.millingCostPerTon}</td>
                    <td className="py-1.5 px-3 text-slate-500">
                      {((econResult.evaluation.millingCostPerTon / econResult.evaluation.totalCostPerTon) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/70 font-black text-emerald-950">
                    <td className="py-2 px-3">{lang === 'fr' ? 'COÛT TOTAL MINE-AU-MOULIN' : 'TOTAL MINE-TO-MILL COST'}</td>
                    <td className="py-2 px-3 text-sm font-extrabold text-emerald-700">${econResult.evaluation.totalCostPerTon} / t</td>
                    <td className="py-2 px-3">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Potential Savings Banner */}
            {econResult.evaluation.potentialSavingsPerTon > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                <div>
                  <span className="font-bold block">
                    {lang === 'fr' ? 'Économies Potentielles à l’Optimum :' : 'Potential Savings at Sweet-Spot:'}
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    {lang === 'fr'
                      ? `En calibrant le tir vers ${econResult.sweetSpotP80Mm} mm au lieu de ${activeP80ForEcon} mm`
                      : `Targeting P80 = ${econResult.sweetSpotP80Mm} mm instead of current ${activeP80ForEcon} mm`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-emerald-700 block">
                    +${econResult.evaluation.potentialSavingsPerTon} / tonne
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    ≈ ${econResult.annualSavingsPotential100kt.toLocaleString()} / an (100kt)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Carbon Footprint & Total Cost Trade-off Chart */}
          <div className="lg:col-span-6 space-y-4">
            {/* Carbon Footprint Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-600" />
                {lang === 'fr' ? 'Empreinte Carbone de la Fragmentation (Scope 1 & 2)' : 'Fragmentation Carbon Footprint (Scope 1 & 2)'}
              </h4>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">{lang === 'fr' ? 'Explosifs (Scope 1)' : 'Explosives (Scope 1)'}</span>
                  <span className="font-bold text-slate-800">{econResult.evaluation.carbonEmissions.scope1ExplosivesKgCo2ePerTon} kg</span>
                  <span className="text-[9px] text-slate-400 block">CO₂e / t</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">{lang === 'fr' ? 'Engins Diesel (Scope 1)' : 'Diesel Fleet (Scope 1)'}</span>
                  <span className="font-bold text-slate-800">{econResult.evaluation.carbonEmissions.scope1DieselKgCo2ePerTon} kg</span>
                  <span className="text-[9px] text-slate-400 block">CO₂e / t</span>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">{lang === 'fr' ? 'Réseau Élec. (Scope 2)' : 'Grid Power (Scope 2)'}</span>
                  <span className="font-bold text-slate-800">{econResult.evaluation.carbonEmissions.scope2ElectricityKgCo2ePerTon} kg</span>
                  <span className="text-[9px] text-slate-400 block">CO₂e / t</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 px-1">
                <span className="text-xs font-bold text-slate-700">
                  {lang === 'fr' ? 'Émissions Totales Carbone :' : 'Total Carbon Intensity :'}
                </span>
                <span className="text-sm font-black text-emerald-600">
                  {econResult.evaluation.carbonEmissions.totalKgCo2ePerTon} kg CO₂e / tonne
                </span>
              </div>
            </div>

            {/* Total Cost U-Curve Plot */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                {lang === 'fr' ? 'Courbe en U du Coût Total vs Fragmentation P80' : 'Total Cost U-Curve vs P80 Fragmentation'}
              </span>

              <svg viewBox="0 0 320 120" className="w-full h-auto">
                <line x1="30" y1="10" x2="30" y2="100" stroke="#CBD5E1" strokeWidth="1" />
                <line x1="30" y1="100" x2="310" y2="100" stroke="#CBD5E1" strokeWidth="1" />
                <text x="5" y="20" fill="#94A3B8" fontSize="8">$8</text>
                <text x="5" y="60" fill="#94A3B8" fontSize="8">$5</text>
                <text x="5" y="100" fill="#94A3B8" fontSize="8">$2</text>

                {/* Plot Total Cost Curve */}
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.5"
                  points={econResult.costCurve
                    .map((pt, i) => {
                      const px = 30 + i * (280 / Math.max(1, econResult.costCurve.length - 1));
                      const py = 100 - ((pt.totalCostPerTon - 2) / 7) * 85;
                      return `${px},${py}`;
                    })
                    .join(' ')}
                />

                {/* Pinpoint sweet spot */}
                {(() => {
                  const idx = econResult.costCurve.findIndex((c) => c.p80Mm === econResult.sweetSpotP80Mm);
                  if (idx >= 0) {
                    const sx = 30 + idx * (280 / Math.max(1, econResult.costCurve.length - 1));
                    const sy = 100 - ((econResult.costCurve[idx].totalCostPerTon - 2) / 7) * 85;
                    return (
                      <g>
                        <circle cx={sx} cy={sy} r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
                        <text x={sx} y={sy - 8} fill="#EF4444" fontSize="8" fontWeight="bold" textAnchor="middle">
                          Sweet-Spot ({econResult.sweetSpotP80Mm}mm)
                        </text>
                      </g>
                    );
                  }
                  return null;
                })()}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
