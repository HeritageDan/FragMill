import React, { useState } from 'react';
import type { Blast } from '../../types';
import type { BondCircuitParams } from '../../types/advanced';
import {
  simulateComminutionCircuit,
  generateEconomicTradeoffCurve,
} from '../../services/comminution/bondMorrellEngine';
import {
  Factory,
  Zap,
  TrendingDown,
  DollarSign,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { Project, Site } from '../../types';
import { SendToReportButton } from '../report/SendToReportButton';

interface ComminutionDigitalTwinViewProps {
  blast: Blast;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const ComminutionDigitalTwinView: React.FC<ComminutionDigitalTwinViewProps> = ({
  blast,
  project,
  site,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  // State for circuit simulation
  const [f80Mm, setF80Mm] = useState<number>(185); // incoming feed from blast
  const [targetP80Microns, setTargetP80Microns] = useState<number>(75); // 75 µm = 0.075 mm
  const [bondWi, setBondWi] = useState<number>(14.5); // 14.5 kWh/t quartz-granodiorite
  const [rockAxb, setRockAxb] = useState<number>(42); // 42 drop weight hardness
  const [operatingHours, setOperatingHours] = useState<number>(20);
  const [powerCostUSD, setPowerCostUSD] = useState<number>(0.14);
  const [explosiveCostUSD, setExplosiveCostUSD] = useState<number>(1.25);

  const circuitParams: BondCircuitParams = {
    f80Mm,
    targetP80Mm: targetP80Microns / 1000,
    bondWorkIndexKWhPerT: bondWi,
    rockAxb,
    plantOperatingHoursPerDay: operatingHours,
    electricityCostPerKWhUSD: powerCostUSD,
    explosiveCostPerKgUSD: explosiveCostUSD,
    targetDailyThroughputTonnes: 500,
  };

  const simResult = simulateComminutionCircuit(circuitParams);
  const tradeoffCurve = generateEconomicTradeoffCurve(circuitParams);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFrench ? 'Jumeau Numérique Comminution & Récupération' : 'Comminution & Recovery Digital Twin'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Bond / Morrell / JKSimMet
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFrench
                ? 'Simulation directe de l’impact de la fragmentation sur le débit du broyeur et la récupération de l’or'
                : 'Directly simulates how blast fragmentation dictates mill throughput and mineral gold recovery'}
            </p>
          </div>
        </div>

        <SendToReportButton
          sectionKey="comminution"
          project={project}
          site={site}
          blast={blast}
          lang={lang}
          getPayload={() => ({
            f80Mm,
            targetP80Mm: targetP80Microns / 1000,
            bondWorkIndexKWhPerT: bondWi,
            rockAxb,
            plantOperatingHoursPerDay: operatingHours,
            electricityCostPerKWhUSD: powerCostUSD,
            specificEnergyBondKWhPerT: simResult.specificEnergyBondKWhPerT,
            specificEnergyMorrellKWhPerT: simResult.specificEnergyMorrellKWhPerT,
            totalSpecificEnergyKWhPerT: simResult.totalSpecificEnergyKWhPerT,
            achievableThroughputTPH: simResult.achievableThroughputTPH,
            dailyThroughputTonnes: simResult.dailyThroughputTonnes,
            mineralLiberationPercent: simResult.mineralLiberationPercent,
            totalComminutionCostPerTonneUSD: simResult.totalComminutionCostPerTonneUSD,
          })}
          summaryFr={`Jumeau broyage (Wi ${bondWi} kWh/t) : débit ${simResult.achievableThroughputTPH} t/h, énergie spécifique ${simResult.totalSpecificEnergyKWhPerT} kWh/t, libération or ${simResult.mineralLiberationPercent}%.`}
          summaryEn={`Comminution twin (Wi ${bondWi} kWh/t): throughput ${simResult.achievableThroughputTPH} tph, specific energy ${simResult.totalSpecificEnergyKWhPerT} kWh/t, gold liberation ${simResult.mineralLiberationPercent}%.`}
        />
      </div>

      {/* Main KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 block text-[10px] font-bold uppercase">
            {isFrench ? 'Énergie Spécifique (Bond)' : 'Bond Specific Energy'}
          </span>
          <span className="text-2xl font-black text-slate-900">{simResult.specificEnergyBondKWhPerT}</span>
          <span className="text-slate-500 text-[10px] ml-1">kWh/tonne</span>
        </div>

        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-emerald-700 block text-[10px] font-bold uppercase">
            {isFrench ? 'Débit Usine Réalisable' : 'Achievable Throughput'}
          </span>
          <span className="text-2xl font-black text-emerald-950">{simResult.achievableThroughputTPH}</span>
          <span className="text-emerald-700 text-[10px] ml-1">t/h ({simResult.dailyThroughputTonnes} t/jour)</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 block text-[10px] font-bold uppercase">
            {isFrench ? 'Récupération Or Estimée' : 'Gold Recovery'}
          </span>
          <span className="text-2xl font-black text-blue-600">{simResult.estimatedGoldRecoveryPercent}%</span>
          <span className="text-slate-500 text-[10px] ml-1">Libération : {simResult.mineralLiberationPercent}%</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 block text-[10px] font-bold uppercase">
            {isFrench ? 'Coût Total Énergie Broyage' : 'Circuit Energy Cost'}
          </span>
          <span className="text-2xl font-black text-purple-600">${simResult.totalComminutionCostPerTonneUSD}</span>
          <span className="text-slate-500 text-[10px] ml-1">/ tonne minéralisée</span>
        </div>
      </div>

      {/* Main Grid: Left Controls & Flowsheet, Right Economic Trade-Off Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Parameter Controls */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
            {isFrench ? 'Paramètres du Circuit de Broyage' : 'Milling Circuit Inputs'}
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>{isFrench ? 'Alimentation du Tir (F80) :' : 'Blast Feed Size (F80):'}</span>
                <span className="font-bold text-blue-600">{f80Mm} mm</span>
              </div>
              <input
                type="range"
                min={50}
                max={400}
                value={f80Mm}
                onChange={(e) => setF80Mm(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>{isFrench ? 'Finesse Produit Broyeur (P80) :' : 'Final Grind P80 (Microns):'}</span>
                <span className="font-bold text-emerald-600">{targetP80Microns} µm</span>
              </div>
              <input
                type="range"
                min={45}
                max={250}
                value={targetP80Microns}
                onChange={(e) => setTargetP80Microns(parseInt(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>{isFrench ? 'Indice de Travail Bond (Wi) :' : 'Bond Work Index (Wi):'}</span>
                <span className="font-bold text-purple-600">{bondWi} kWh/t</span>
              </div>
              <input
                type="range"
                min={9}
                max={22}
                step={0.5}
                value={bondWi}
                onChange={(e) => setBondWi(parseFloat(e.target.value))}
                className="w-full accent-purple-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{isFrench ? 'Électricité ($/kWh)' : 'Electricity ($/kWh)'}</label>
                <input
                  type="number"
                  step="0.01"
                  value={powerCostUSD}
                  onChange={(e) => setPowerCostUSD(parseFloat(e.target.value) || 0.1)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{isFrench ? 'Explosif ($/kg)' : 'Explosives ($/kg)'}</label>
                <input
                  type="number"
                  step="0.05"
                  value={explosiveCostUSD}
                  onChange={(e) => setExplosiveCostUSD(parseFloat(e.target.value) || 1.0)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Mine-to-Mill Economic Trade-off Optimization Curve */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                {isFrench ? 'Courbe d’Arbitrage Économique Mine-au-Moulin' : 'Mine-to-Mill Cost Optimization Curve'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isFrench
                  ? 'Preuve mathématique : dépenser +0,15 $/t en tir économise 0,85 $/t en électricité de broyage !'
                  : 'Classic trade-off: spending +$0.15/t in blasting saves $0.85/t in mill electric power!'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">{isFrench ? 'Explosif (kg/m³)' : 'Powder Factor'}</th>
                  <th className="py-2 px-3">{isFrench ? 'F80 Tir' : 'Blast F80'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Coût Tir ($/t)' : 'Drill & Blast ($/t)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Coût Broyage ($/t)' : 'Milling ($/t)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Coût Total ($/t)' : 'Total Circuit ($/t)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Débit (t/h)' : 'Throughput (t/h)'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tradeoffCurve.map((row, idx) => {
                  const isOptimal = row.powderFactorKgPerM3 === 0.65 || row.powderFactorKgPerM3 === 0.75;
                  return (
                    <tr key={idx} className={isOptimal ? 'bg-emerald-50/70 font-bold' : ''}>
                      <td className="py-2 px-3 text-slate-900">{row.powderFactorKgPerM3} kg/m³</td>
                      <td className="py-2 px-3 text-slate-600">{row.blastP80Mm} mm</td>
                      <td className="py-2 px-3 text-slate-600">${row.drillBlastCostPerTUSD}</td>
                      <td className="py-2 px-3 text-slate-600">${row.millingEnergyCostPerTUSD}</td>
                      <td className={`py-2 px-3 ${isOptimal ? 'text-emerald-700 font-black' : 'text-slate-900'}`}>
                        ${row.totalCircuitCostPerTUSD} {isOptimal && '⭐'}
                      </td>
                      <td className="py-2 px-3 font-bold text-blue-600">{row.throughputTPH} t/h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
