import React, { useState } from 'react';
import {
  Layers,
  Fuel,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { HoleChargingProfile, BlastParameters } from '../../types';

interface HoleChargingProfileViewProps {
  parameters: BlastParameters;
  onUpdateParameters: (updated: BlastParameters) => void;
  benchHeight: number;
  subdrill: number;
  holeDiameter: number;
  burden: number;
  spacing: number;
  numberOfHoles: number;
  density: number;
  lang?: 'en' | 'fr';
}

export const DEFAULT_CHARGING_PROFILE: HoleChargingProfile = {
  toeExplosiveType: 'dynamite',
  toeCartridgeWeightGrams: 250,
  toeCartridgeCount: 2,
  toeChargeWeightKg: 0.5,
  toeChargeLengthM: 0.6,
  toeUnitCost: 2500, // FCFA (or ~4 USD)

  columnExplosiveType: 'anfo_bulk',
  anfoNitrateBags25kg: 2,
  anfoNitrateWeightKg: 50,
  fuelLitersPerBag: 3.0, // standard quarry practice (3 liters per 25kg bag)
  fuelTotalLiters: 6.0,
  fuelTotalKg: 5.04, // 6.0 * 0.84
  columnTotalWeightKg: 55.04,
  columnChargeLengthM: 3.8,
  nitrateBagCost: 18000, // FCFA (or ~28 USD)
  fuelLiterCost: 850, // FCFA (or ~1.3 USD)

  stemmingLengthM: 2.4,
  stemmingMaterial: 'crushed_aggregate_0_10',
  hasFlyrockRisk: false,

  hasFaultOrCavity: false,
  faultDepthM: 3.2,
  faultThicknessM: 0.8,
  faultMitigationStrategy: 'decking_plug',
  deckingMaterial: 'air_deck_plug',
  explosiveSavedKg: 25.0,
  costSaved: 18000,

  totalHoleLengthM: 6.8,
  averagePatternHoleLengthM: 6.8,
  subdrillM: 0.8,
};

export const HoleChargingProfileView: React.FC<HoleChargingProfileViewProps> = ({
  parameters,
  onUpdateParameters,
  benchHeight,
  subdrill,
  holeDiameter,
  burden,
  spacing,
  numberOfHoles,
  density,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';
  const totalHoleDepth = Number((benchHeight + subdrill).toFixed(2));

  const [profile, setProfile] = useState<HoleChargingProfile>(
    parameters.chargingProfile || {
      ...DEFAULT_CHARGING_PROFILE,
      totalHoleLengthM: totalHoleDepth,
      averagePatternHoleLengthM: totalHoleDepth,
      subdrillM: subdrill,
      stemmingLengthM: parameters.stemmingLength || 2.4,
    }
  );

  const [showCostDetails, setShowCostDetails] = useState(false);
  const [currency, setCurrency] = useState<'FCFA' | 'USD'>('FCFA');

  // Currency multiplier
  const currRate = currency === 'USD' ? 0.0016 : 1;
  const currLabel = currency;

  // Sync profile changes and recalculate derived metrics
  const updateProfile = (updates: Partial<HoleChargingProfile>) => {
    const updated = { ...profile, ...updates };

    // 1. Recalculate Toe Charge
    const toeWeightKg = Number(((updated.toeCartridgeCount * updated.toeCartridgeWeightGrams) / 1000).toFixed(2));
    updated.toeChargeWeightKg = toeWeightKg;

    // 2. Recalculate Column Charge (Nitrate bags + Diesel liters)
    const nitrateWeightKg = Number((updated.anfoNitrateBags25kg * 25).toFixed(1));
    const fuelLiters = Number((updated.anfoNitrateBags25kg * updated.fuelLitersPerBag).toFixed(1));
    const fuelWeightKg = Number((fuelLiters * 0.84).toFixed(2));
    const columnWeightKg = Number((nitrateWeightKg + fuelWeightKg).toFixed(2));

    updated.anfoNitrateWeightKg = nitrateWeightKg;
    updated.fuelTotalLiters = fuelLiters;
    updated.fuelTotalKg = fuelWeightKg;
    updated.columnTotalWeightKg = columnWeightKg;

    // 3. Recalculate Stemming & Safety
    const stemmingBurdenRatio = burden > 0 ? updated.stemmingLengthM / burden : 1.0;
    updated.hasFlyrockRisk = stemmingBurdenRatio < 0.75;

    // 4. Fault & Cavity Decking Savings
    if (updated.hasFaultOrCavity) {
      // If fault is plugged with decking, avoid wasting 1 bag of nitrate or proportional volume
      const faultHoleVolM3 = (Math.PI * Math.pow(holeDiameter / 2000, 2)) * (updated.faultThicknessM || 0.8);
      const savedKg = Math.min(nitrateWeightKg, Math.round(faultHoleVolM3 * 850)); // ANFO density ~850 kg/m3
      updated.explosiveSavedKg = Math.max(12.5, savedKg);
      updated.costSaved = Math.round((updated.explosiveSavedKg / 25) * updated.nitrateBagCost);
    } else {
      updated.explosiveSavedKg = 0;
      updated.costSaved = 0;
    }

    // 5. Total Charge Per Hole
    const effectiveColumnKg = updated.hasFaultOrCavity && updated.faultMitigationStrategy === 'decking_plug'
      ? Math.max(0, columnWeightKg - updated.explosiveSavedKg)
      : columnWeightKg;
    const totalChargeKg = Number((toeWeightKg + effectiveColumnKg).toFixed(2));

    setProfile(updated);

    // Propagate up to parent BlastParameters
    onUpdateParameters({
      ...parameters,
      chargePerHole: totalChargeKg,
      bottomChargeLength: updated.toeChargeLengthM,
      columnChargeLength: updated.columnChargeLengthM,
      stemmingLength: updated.stemmingLengthM,
      chargingProfile: updated,
    });
  };

  // Cost and Yield Calculations
  const costDynamitePerHole = profile.toeCartridgeCount * profile.toeUnitCost;
  const costNitratePerHole = profile.anfoNitrateBags25kg * profile.nitrateBagCost;
  const costFuelPerHole = profile.fuelTotalLiters * profile.fuelLiterCost;
  const grossCostPerHole = costDynamitePerHole + costNitratePerHole + costFuelPerHole;
  const netCostPerHole = Math.max(0, grossCostPerHole - (profile.hasFaultOrCavity ? profile.costSaved : 0));

  const totalBlastCost = netCostPerHole * numberOfHoles;
  const holeRockVolumeM3 = burden * spacing * benchHeight;
  const totalRockVolumeM3 = holeRockVolumeM3 * numberOfHoles;
  const totalRockTonnage = totalRockVolumeM3 * density;

  const costPerM3 = totalRockVolumeM3 > 0 ? netCostPerHole / holeRockVolumeM3 : 0;
  const costPerTon = totalRockTonnage > 0 ? totalBlastCost / totalRockTonnage : 0;
  const yieldM3PerKg = profile.columnTotalWeightKg + profile.toeChargeWeightKg > 0
    ? holeRockVolumeM3 / (profile.columnTotalWeightKg + profile.toeChargeWeightKg)
    : 0;

  // Total Pattern Supplies Needed
  const totalBagsNitratePattern = profile.anfoNitrateBags25kg * numberOfHoles;
  const totalFuelLitersPattern = Number((profile.fuelTotalLiters * numberOfHoles).toFixed(1));
  const totalDynamiteCartridgesPattern = profile.toeCartridgeCount * numberOfHoles;
  const totalExplosivesKgPattern = Number(((profile.toeChargeWeightKg + profile.columnTotalWeightKg) * numberOfHoles).toFixed(1));

  // Visual schematic ratios for hole cross-section
  const hTotal = Math.max(1, totalHoleDepth);
  const stemPct = Math.max(15, Math.min(50, (profile.stemmingLengthM / hTotal) * 100));
  const toePct = Math.max(8, Math.min(25, (profile.toeChargeLengthM / hTotal) * 100));
  const colPct = Math.max(25, 100 - stemPct - toePct);

  return (
    <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 space-y-6 shadow-xl">
      {/* Header with Title and Currency Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-red-600 rounded-xl text-white shadow-md">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold tracking-wide flex items-center gap-2">
              <span>{isFrench ? 'Profil de Chargement Détaillé du Trou de Mine' : 'Detailed Blast Hole Charging Profile'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                3 Decks
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isFrench
                ? 'Configuration artisanale & industrielle : Charge de pied (Dynamite), Charge de colonne (Nitrate + Gasoil), Bourrage & Gestion des failles'
                : 'Pied (Dynamite), Colonne (ANFO 25kg bags + Diesel), Stemming & Discontinuity mitigation'}
            </p>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
          <span className="text-slate-400 text-[10px] font-semibold px-1.5">{isFrench ? 'Devise:' : 'Currency:'}</span>
          <button
            type="button"
            onClick={() => setCurrency('FCFA')}
            className={`px-2 py-1 rounded-lg font-bold transition text-[11px] ${
              currency === 'FCFA' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            FCFA
          </button>
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`px-2 py-1 rounded-lg font-bold transition text-[11px] ${
              currency === 'USD' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            USD ($)
          </button>
        </div>
      </div>

      {/* Main Grid: Left = Visual Borehole Schematic, Right = 3-Deck Form Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Borehole Cross-Section Visualization (4 cols) */}
        <div className="lg:col-span-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2 border-b border-slate-800/80 pb-1.5">
            <span>{isFrench ? 'Coupe Géologique du Trou' : 'Borehole Cross-Section'}</span>
            <span className="text-blue-400">H = {totalHoleDepth} m (Ø {holeDiameter} mm)</span>
          </div>

          {/* Graphic Hole Column */}
          <div className="relative w-36 h-80 rounded-t-sm rounded-b-xl border-x-4 border-b-4 border-slate-700 bg-slate-900 flex flex-col overflow-hidden shadow-inner my-2">
            {/* 1. Bourrage (Stemming) */}
            <div
              style={{ height: `${stemPct}%` }}
              className="relative w-full bg-gradient-to-b from-stone-600 via-stone-700 to-stone-800 border-b-2 border-dashed border-stone-500 flex flex-col items-center justify-center text-center p-1"
              title={isFrench ? `Bourrage (${profile.stemmingLengthM} m)` : `Stemming (${profile.stemmingLengthM} m)`}
            >
              <div className="text-[10px] font-black text-amber-200 tracking-wider uppercase">
                {isFrench ? 'Bourrage' : 'Stemming'}
              </div>
              <div className="text-[9px] font-bold text-stone-300">
                {profile.stemmingLengthM} m
              </div>
              <div className="text-[8px] text-stone-400 truncate max-w-[120px]">
                {profile.stemmingMaterial === 'crushed_aggregate_0_10'
                  ? '0/10 mm'
                  : profile.stemmingMaterial === 'drill_cuttings'
                  ? 'Cuttings'
                  : 'Argile'}
              </div>
            </div>

            {/* Faille Géologique & Decking Intercalaire (if active) */}
            {profile.hasFaultOrCavity && (
              <div
                className="relative w-full py-1.5 bg-stripes-amber bg-purple-900/90 border-y-2 border-amber-400 text-center flex flex-col items-center justify-center animate-pulse"
                title={isFrench ? `Zone de faille / Bouchon Decking (${profile.faultThicknessM} m)` : `Fault Zone / Decking (${profile.faultThicknessM} m)`}
              >
                <span className="text-[9px] font-extrabold text-amber-300 uppercase tracking-tighter">
                  ⚠ {isFrench ? 'Faille / Decking' : 'Fault / Air Deck'}
                </span>
                <span className="text-[8px] text-purple-200 font-bold">
                  -{profile.explosiveSavedKg} kg {isFrench ? 'évités' : 'saved'}
                </span>
              </div>
            )}

            {/* 2. Charge de Colonne (ANFO: Nitrate + Fuel) */}
            <div
              style={{ height: `${colPct}%` }}
              className="relative w-full bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 border-b-2 border-amber-400 flex flex-col items-center justify-center text-center p-1.5"
              title={isFrench ? `Colonne ANFO (${profile.columnTotalWeightKg} kg)` : `Column ANFO (${profile.columnTotalWeightKg} kg)`}
            >
              <div className="text-[11px] font-black text-slate-950 uppercase tracking-wider flex items-center gap-0.5">
                <Fuel className="w-3 h-3 text-slate-950" /> ANFO
              </div>
              <div className="text-[10px] font-extrabold text-amber-950">
                {profile.anfoNitrateBags25kg} {isFrench ? 'sacs (25kg)' : 'bags'}
              </div>
              <div className="text-[9px] font-bold text-amber-900">
                + {profile.fuelTotalLiters} L {isFrench ? 'gasoil' : 'diesel'}
              </div>
              <div className="text-[9px] font-black text-slate-950 mt-0.5 bg-amber-400/80 px-1 rounded">
                {profile.columnTotalWeightKg} kg
              </div>
            </div>

            {/* 3. Charge de Pied (Dynamite / Booster) */}
            <div
              style={{ height: `${toePct}%` }}
              className="relative w-full bg-gradient-to-b from-red-600 to-rose-800 flex flex-col items-center justify-center text-center p-1"
              title={isFrench ? `Pied Dynamite (${profile.toeChargeWeightKg} kg)` : `Toe Dynamite (${profile.toeChargeWeightKg} kg)`}
            >
              <div className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                {profile.toeExplosiveType === 'dynamite'
                  ? 'Dynamite'
                  : profile.toeExplosiveType === 'emulsion_cartridge'
                  ? 'Émulsion'
                  : 'Booster'}
              </div>
              <div className="text-[9px] font-extrabold text-red-100">
                {profile.toeCartridgeCount} {isFrench ? 'cartouches' : 'cartridges'}
              </div>
              <div className="text-[9px] font-black text-white bg-black/30 px-1 rounded">
                {profile.toeChargeWeightKg} kg
              </div>
            </div>

            {/* Surforage (Subdrill) Base */}
            <div className="h-4 bg-slate-950 text-slate-500 text-[8px] flex items-center justify-center font-mono">
              Surforage {subdrill}m
            </div>
          </div>

          {/* Quick Metrics Under Hole */}
          <div className="w-full grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 mt-2">
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">{isFrench ? 'Charge / Trou' : 'Charge / Hole'}</span>
              <span className="font-extrabold text-amber-400 text-xs">
                {(profile.toeChargeWeightKg + profile.columnTotalWeightKg).toFixed(1)} kg
              </span>
            </div>
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">{isFrench ? 'Coût / Trou' : 'Cost / Hole'}</span>
              <span className="font-extrabold text-emerald-400 text-xs">
                {Math.round(netCostPerHole * currRate).toLocaleString()} {currLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Right Form: 3 Decks Inputs (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* DECK 1: Charge de Pied (Dynamite / Amorçage) */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-red-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <h4 className="text-xs font-black uppercase text-red-400 tracking-wider">
                  1. {isFrench ? 'Charge de Pied (Dynamite / Cartouches d’Amorçage)' : 'Toe Charge (Dynamite / Primer Cartridges)'}
                </h4>
              </div>
              <span className="text-xs font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/50">
                {profile.toeChargeWeightKg} kg / trou
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Type d’Explosif de Fond' : 'Primer Explosive Type'}
                </label>
                <select
                  value={profile.toeExplosiveType}
                  onChange={(e) => updateProfile({ toeExplosiveType: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:border-red-500"
                >
                  <option value="dynamite">{isFrench ? 'Dynamite (Gomme A / Ammon-gélatine)' : 'Dynamite (Gelatin)'}</option>
                  <option value="emulsion_cartridge">{isFrench ? 'Émulsion encartouchée (Emulex)' : 'Emulsion Cartridge'}</option>
                  <option value="pentolite_booster">{isFrench ? 'Booster Pentolite (Cast Booster)' : 'Pentolite Booster'}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Poids Unitaire / Cartouche' : 'Cartridge Unit Weight'}
                </label>
                <select
                  value={profile.toeCartridgeWeightGrams}
                  onChange={(e) => updateProfile({ toeCartridgeWeightGrams: parseInt(e.target.value) || 250 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:border-red-500"
                >
                  <option value={200}>200 g</option>
                  <option value={250}>250 g ({isFrench ? 'standard' : 'default'})</option>
                  <option value={500}>500 g</option>
                  <option value={1000}>1000 g (1 kg)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Nombre de Cartouches / Trou' : 'Cartridge Count / Hole'}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={profile.toeCartridgeCount}
                    onChange={(e) => updateProfile({ toeCartridgeCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold focus:border-red-500 text-center"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0">
                    = {profile.toeChargeWeightKg} kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DECK 2: Charge de Colonne (ANFO: Nitrate de 25 kg + Gasoil) */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-amber-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h4 className="text-xs font-black uppercase text-amber-300 tracking-wider">
                  2. {isFrench ? 'Charge de Colonne (ANFO : Nitrate 25kg + Gasoil)' : 'Column Charge (ANFO: 25kg Bags + Diesel)'}
                </h4>
              </div>
              <span className="text-xs font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-600/50">
                {profile.columnTotalWeightKg} kg / trou
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Nombre de Sacs de Nitrate (25 kg)' : 'Nitrate Bags (25kg standard)'}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={profile.anfoNitrateBags25kg}
                    onChange={(e) => updateProfile({ anfoNitrateBags25kg: Math.max(0.5, parseFloat(e.target.value) || 0.5) })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold focus:border-amber-500 text-center"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0">
                    = {profile.anfoNitrateWeightKg} kg
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Litres de Gasoil / Sac de 25kg' : 'Diesel Liters / 25kg Bag'}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.5"
                    min="1.5"
                    max="5.0"
                    value={profile.fuelLitersPerBag}
                    onChange={(e) => updateProfile({ fuelLitersPerBag: parseFloat(e.target.value) || 3.0 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold focus:border-amber-500 text-center"
                  />
                  <span className="text-[10px] text-amber-300 shrink-0 font-medium">
                    (Standard carrière: 3.0 L)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Volume Total Gasoil / Trou' : 'Total Diesel Fuel / Hole'}
                </label>
                <div className="px-2.5 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-amber-300 font-extrabold flex items-center justify-between">
                  <span>{profile.fuelTotalLiters} Litres</span>
                  <span className="text-[10px] text-slate-400 font-normal">({profile.fuelTotalKg} kg)</span>
                </div>
              </div>
            </div>

            {/* ANFO Recipe Helper Tip */}
            <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-amber-200/90">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {isFrench
                  ? 'Dosage ANFO : 1 sac de 25 kg de nitrate d’ammonium + 3,0 L de gasoil (soit ~5,8% en masse) assure une balance d’oxygène optimale pour maximiser l’énergie de choc et minimiser les fumées rousses toxiques (NOx).'
                  : 'Optimal ANFO ratio: 1 bag (25 kg) + 3.0 L diesel (~5.8% by weight) ensures near-zero oxygen balance, preventing toxic orange NOx fumes and maximizing heave energy.'}
              </span>
            </div>
          </div>

          {/* DECK 3: Bourrage (Stemming) */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-stone-600/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                <h4 className="text-xs font-black uppercase text-stone-300 tracking-wider">
                  3. {isFrench ? 'Bourrage du Trou (Stemming)' : 'Stemming & Confinement'}
                </h4>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                profile.hasFlyrockRisk
                  ? 'bg-red-950 text-red-300 border-red-700'
                  : 'bg-stone-900 text-stone-200 border-stone-700'
              }`}>
                {profile.stemmingLengthM} m ({isFrench ? 'Hauteur' : 'Height'})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Hauteur du Bourrage (m)' : 'Stemming Height (m)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={profile.stemmingLengthM}
                  onChange={(e) => updateProfile({ stemmingLengthM: parseFloat(e.target.value) || 2.0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                  {isFrench ? 'Matériau de Bourrage' : 'Stemming Aggregate'}
                </label>
                <select
                  value={profile.stemmingMaterial}
                  onChange={(e) => updateProfile({ stemmingMaterial: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium focus:border-stone-400"
                >
                  <option value="crushed_aggregate_0_10">
                    {isFrench ? 'Gravillons concassés 0/10 mm (Recommandé - frottement max)' : 'Crushed Aggregate 0/10 mm (Optimal)'}
                  </option>
                  <option value="drill_cuttings">
                    {isFrench ? 'Déblais de foration (Cuttings de foration)' : 'Drill Cuttings'}
                  </option>
                  <option value="clay_soil">
                    {isFrench ? 'Terre argileuse / Sable' : 'Clay Soil / Sand'}
                  </option>
                </select>
              </div>
            </div>

            {profile.hasFlyrockRisk && (
              <div className="bg-red-950/50 border border-red-600/40 p-2.5 rounded-lg flex items-center gap-2 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  {isFrench
                    ? `Alerte Sécurité : Le bourrage (${profile.stemmingLengthM} m) est inférieur à 0.75 × Burden (${burden} m). Risque majeur de projection de blocs (flyrock) et de souffle ! Augmentez le bourrage à minimum ${(burden * 0.85).toFixed(1)} m.`
                    : `Safety Warning: Stemming height (${profile.stemmingLengthM} m) is under 0.75 × Burden (${burden} m). Severe flyrock risk! Increase stemming to at least ${(burden * 0.85).toFixed(1)} m.`}
                </span>
              </div>
            )}
          </div>

          {/* GÉOLOGIE & FAILLES DU FOREUR : Decking & Anti-Gaspillage */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-purple-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.hasFaultOrCavity}
                  onChange={(e) => updateProfile({ hasFaultOrCavity: e.target.checked })}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <span className="text-xs font-extrabold text-purple-300 uppercase tracking-wide">
                  {isFrench
                    ? 'Le foreur a détecté une faille, fissure ou cavité dans ce trou'
                    : 'Driller encountered a fault, cavity or fracture zone in this hole'}
                </span>
              </label>

              {profile.hasFaultOrCavity && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isFrench
                    ? `${profile.explosiveSavedKg} kg d’explosif économisés`
                    : `${profile.explosiveSavedKg} kg explosive saved`}
                </span>
              )}
            </div>

            {profile.hasFaultOrCavity && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 border-t border-purple-900/40">
                <div>
                  <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                    {isFrench ? 'Profondeur de la Faille (m)' : 'Fault Depth (m)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={profile.faultDepthM}
                    onChange={(e) => updateProfile({ faultDepthM: parseFloat(e.target.value) || 3.0 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                    {isFrench ? 'Épaisseur de la Zone Fracturée (m)' : 'Cavity Thickness (m)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={profile.faultThicknessM}
                    onChange={(e) => updateProfile({ faultThicknessM: parseFloat(e.target.value) || 0.8 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                    {isFrench ? 'Stratégie de Chargement Adapté' : 'Mitigation Strategy'}
                  </label>
                  <select
                    value={profile.faultMitigationStrategy}
                    onChange={(e) => updateProfile({ faultMitigationStrategy: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-medium"
                  >
                    <option value="decking_plug">
                      {isFrench ? 'Bouchon / Decking intercalaire (Bois / Ballon)' : 'Decking Plug (Air Deck)'}
                    </option>
                    <option value="plastic_liner">
                      {isFrench ? 'Gaine / Tubage plastique (Zone fissurée)' : 'Plastic Liner'}
                    </option>
                    <option value="reduced_charge">
                      {isFrench ? 'Réduction de charge colonne' : 'Reduced Column Charge'}
                    </option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY BANNER: Pattern Totals, Cost Minimization & Yield Optimization */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
              {isFrench ? 'Bilan Global du Tir & Optimisation des Coûts' : 'Blast Supplies & Cost Minimization'}
            </span>
            <span className="text-slate-500 text-xs">({numberOfHoles} {isFrench ? 'trous forés' : 'drilled holes'})</span>
          </div>

          <button
            type="button"
            onClick={() => setShowCostDetails(!showCostDetails)}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
          >
            <span>{isFrench ? 'Détails des Prix Unitaires' : 'Unit Cost Settings'}</span>
            {showCostDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 4 Key Performance Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              {isFrench ? 'Sacs Nitrate Requis' : 'Nitrate Bags Needed'}
            </span>
            <span className="text-lg font-black text-amber-400">
              {totalBagsNitratePattern} <span className="text-xs font-semibold text-slate-400">{isFrench ? 'sacs de 25 kg' : 'bags'}</span>
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              = {(totalBagsNitratePattern * 25).toLocaleString()} kg {isFrench ? 'nitrate' : 'nitrate'}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              {isFrench ? 'Gasoil Total Requis' : 'Total Fuel Needed'}
            </span>
            <span className="text-lg font-black text-amber-300">
              {totalFuelLitersPattern} <span className="text-xs font-semibold text-slate-400">Litres</span>
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              {isFrench ? 'Pour mélange ANFO sur site' : 'For site ANFO mix'}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              {isFrench ? 'Cartouches Dynamite' : 'Dynamite Cartridges'}
            </span>
            <span className="text-lg font-black text-red-400">
              {totalDynamiteCartridgesPattern} <span className="text-xs font-semibold text-slate-400">{isFrench ? 'cartouches' : 'cartridges'}</span>
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              = {((totalDynamiteCartridgesPattern * profile.toeCartridgeWeightGrams) / 1000).toFixed(1)} kg {isFrench ? 'au pied' : 'at toe'}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-900/40">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              {isFrench ? 'Coût Moyen / Tonne' : 'Blast Cost / Ton'}
            </span>
            <span className="text-lg font-black text-emerald-400">
              {Math.round(costPerTon * currRate).toLocaleString()} <span className="text-xs font-semibold text-slate-400">{currLabel}/t</span>
            </span>
            <span className="block text-[10px] text-emerald-300/80 mt-0.5">
              Rendement: {yieldM3PerKg.toFixed(2)} m³/kg
            </span>
          </div>
        </div>

        {/* Collapsible Unit Cost Editor */}
        {showCostDetails && (
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in duration-200">
            <div>
              <label className="block text-slate-400 text-[10px] font-semibold mb-1">
                {isFrench ? 'Prix d’un sac de nitrate (25 kg)' : 'Cost of 25kg Nitrate Bag'} ({currLabel})
              </label>
              <input
                type="number"
                value={Math.round(profile.nitrateBagCost * currRate)}
                onChange={(e) => updateProfile({ nitrateBagCost: (parseFloat(e.target.value) || 0) / currRate })}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] font-semibold mb-1">
                {isFrench ? 'Prix du litre de gasoil' : 'Cost of Diesel / Liter'} ({currLabel})
              </label>
              <input
                type="number"
                value={Math.round(profile.fuelLiterCost * currRate)}
                onChange={(e) => updateProfile({ fuelLiterCost: (parseFloat(e.target.value) || 0) / currRate })}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] font-semibold mb-1">
                {isFrench ? 'Prix d’une cartouche de dynamite' : 'Cost of Dynamite Cartridge'} ({currLabel})
              </label>
              <input
                type="number"
                value={Math.round(profile.toeUnitCost * currRate)}
                onChange={(e) => updateProfile({ toeUnitCost: (parseFloat(e.target.value) || 0) / currRate })}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
              />
            </div>
          </div>
        )}

        {/* Real-time Economic Minimization Advisor */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-emerald-300 block mb-0.5">
              {isFrench ? 'Recommandation de Rentabilité & Réduction des Coûts :' : 'Cost Optimization & Yield Recommendation:'}
            </span>
            <span>
              {isFrench
                ? `Ce plan de tir consomme ${((profile.columnTotalWeightKg + profile.toeChargeWeightKg) / holeRockVolumeM3).toFixed(2)} kg/m³ avec un rendement élevé de ${yieldM3PerKg.toFixed(2)} m³ de roche abattue par kg d'explosif. ${
                    profile.hasFaultOrCavity
                      ? `Le bouchage de la faille permet d'économiser ${Math.round(profile.costSaved * numberOfHoles * currRate).toLocaleString()} ${currLabel} sur l'ensemble du chantier tout en supprimant les risques de projection.`
                      : 'Les ratios nitrate/gasoil sont optimisés pour éviter tout surcoût de broyage secondaire.'
                  }`
                : `This blast achieves a powder factor of ${((profile.columnTotalWeightKg + profile.toeChargeWeightKg) / holeRockVolumeM3).toFixed(2)} kg/m³ with a strong yield of ${yieldM3PerKg.toFixed(2)} m³/kg. ${
                    profile.hasFaultOrCavity
                      ? `Cavity decking saves an estimated ${Math.round(profile.costSaved * numberOfHoles * currRate).toLocaleString()} ${currLabel} across the blast pattern while safeguarding against flyrock.`
                      : 'ANFO proportions are balanced to prevent costly oversize boulders and secondary breaking.'
                  }`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
