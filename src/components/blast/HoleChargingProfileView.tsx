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
import type { DrillHoleSummary } from '../../services/drillHoles/drillHoleService';

export interface HoleChargingProfileViewProps {
  parameters: BlastParameters;
  onUpdateParameters: (updated: BlastParameters) => void;
  benchHeight: number;
  subdrill: number;
  holeDiameter: number;
  burden: number;
  spacing: number;
  numberOfHoles: number;
  density: number;
  holesSummary?: DrillHoleSummary | null;
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
  holesSummary,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  // Detect whether real drillhole data is loaded from Excel/CSV
  const hasExcelData = Boolean(holesSummary && holesSummary.totalHoles > 0);

  // Unified geometry variables from Excel if present, else fallback scalar props
  const effectiveBurden = hasExcelData ? holesSummary!.avgBurdenM : burden;
  const effectiveSpacing = hasExcelData ? holesSummary!.avgSpacingM : spacing;
  const effectiveDepth = hasExcelData ? holesSummary!.avgDepthM : Number((benchHeight + subdrill).toFixed(2));
  const effectiveSubdrill = hasExcelData ? holesSummary!.avgSubdrillM : subdrill;
  const effectiveDiameter = hasExcelData ? holesSummary!.avgDiameterMm : holeDiameter;
  const effectiveHolesCount = hasExcelData ? holesSummary!.totalHoles : numberOfHoles;
  const effectiveDensity = hasExcelData ? holesSummary!.avgDensityTPerM3 : density;

  const totalRockVolumeM3 = hasExcelData
    ? holesSummary!.totalVolumeM3
    : effectiveBurden * effectiveSpacing * benchHeight * effectiveHolesCount;

  const totalRockTonnage = hasExcelData
    ? holesSummary!.totalTonnageT
    : Math.round(totalRockVolumeM3 * effectiveDensity);

  const totalExplosivesKg = hasExcelData
    ? holesSummary!.totalExplosiveKg
    : Number(((parameters.chargePerHole || 22.1) * effectiveHolesCount).toFixed(1));

  const avgChargePerHoleKg = hasExcelData
    ? holesSummary!.avgChargePerHoleKg
    : (parameters.chargePerHole || 22.1);

  const effectiveStemmingM = hasExcelData
    ? holesSummary!.avgStemmingM
    : (parameters.stemmingLength || 2.4);

  const [profile, setProfile] = useState<HoleChargingProfile>(
    parameters.chargingProfile || {
      ...DEFAULT_CHARGING_PROFILE,
      totalHoleLengthM: effectiveDepth,
      averagePatternHoleLengthM: effectiveDepth,
      subdrillM: effectiveSubdrill,
      stemmingLengthM: effectiveStemmingM,
    }
  );

  const [showCostDetails, setShowCostDetails] = useState(false);
  const [currency, setCurrency] = useState<'FCFA' | 'USD'>('FCFA');

  // Currency multiplier
  const currRate = currency === 'USD' ? 0.0016 : 1;
  const currLabel = currency;

  // 1. Recalculate Toe Charge (Selectable primer & cartridges count)
  const toeWeightKg = Number(((profile.toeCartridgeCount * profile.toeCartridgeWeightGrams) / 1000).toFixed(2));
  const toeChargeLengthM = Math.min(1.5, parseFloat((toeWeightKg * 1.2).toFixed(2)));

  // 2. Recalculate Column Charge
  // When Excel is loaded: column charge is derived from the Excel hole average charge minus the toe charge
  const columnWeightKg = hasExcelData
    ? Math.max(0, parseFloat((avgChargePerHoleKg - toeWeightKg).toFixed(2)))
    : profile.columnTotalWeightKg;

  // Proportions of ANFO: ~94.2% ammonium nitrate prills + 5.8% diesel (3.0 L fuel / 25kg bag = 2.52kg fuel -> total bag batch = 27.52 kg)
  const bagsNitratePerHole = hasExcelData
    ? parseFloat((columnWeightKg / 27.52).toFixed(2))
    : profile.anfoNitrateBags25kg;

  const nitrateWeightKg = hasExcelData
    ? parseFloat((bagsNitratePerHole * 25).toFixed(1))
    : profile.anfoNitrateWeightKg;

  const fuelLitersPerHole = hasExcelData
    ? parseFloat((bagsNitratePerHole * profile.fuelLitersPerBag).toFixed(1))
    : profile.fuelTotalLiters;

  const fuelWeightKg = parseFloat((fuelLitersPerHole * 0.84).toFixed(2));

  // 3. Stemming & Safety
  const stemmingBurdenRatio = effectiveBurden > 0 ? effectiveStemmingM / effectiveBurden : 1.0;
  const hasFlyrockRisk = stemmingBurdenRatio < 0.75;

  // 4. Pattern Supplies Totals
  const totalDynamiteCartridgesPattern = profile.toeCartridgeCount * effectiveHolesCount;
  const totalToeExplosivesKg = Number((toeWeightKg * effectiveHolesCount).toFixed(1));
  const totalColumnExplosivesKg = Math.max(0, parseFloat((totalExplosivesKg - totalToeExplosivesKg).toFixed(1)));
  const totalBagsNitratePattern = hasExcelData
    ? Math.ceil(totalColumnExplosivesKg / 27.52)
    : Math.ceil(profile.anfoNitrateBags25kg * effectiveHolesCount);
  const totalFuelLitersPattern = Number((totalBagsNitratePattern * profile.fuelLitersPerBag).toFixed(1));

  // 5. Cost and Yield Calculations
  const costDynamitePerHole = profile.toeCartridgeCount * profile.toeUnitCost;
  const costNitratePerHole = bagsNitratePerHole * profile.nitrateBagCost;
  const costFuelPerHole = fuelLitersPerHole * profile.fuelLiterCost;
  const grossCostPerHole = costDynamitePerHole + costNitratePerHole + costFuelPerHole;
  const netCostPerHole = Math.max(0, grossCostPerHole - (profile.hasFaultOrCavity && !hasExcelData ? profile.costSaved : 0));

  const totalBlastCost = (totalDynamiteCartridgesPattern * profile.toeUnitCost) +
    (totalBagsNitratePattern * profile.nitrateBagCost) +
    (totalFuelLitersPattern * profile.fuelLiterCost);

  const costPerM3 = totalRockVolumeM3 > 0 ? totalBlastCost / totalRockVolumeM3 : 0;
  const costPerTon = totalRockTonnage > 0 ? totalBlastCost / totalRockTonnage : 0;
  const yieldM3PerKg = totalExplosivesKg > 0 ? totalRockVolumeM3 / totalExplosivesKg : 0;
  const actualPowderFactor = totalRockVolumeM3 > 0 ? totalExplosivesKg / totalRockVolumeM3 : 0;

  // Sync profile changes and recalculate derived metrics
  const updateProfile = (updates: Partial<HoleChargingProfile>) => {
    const updated = { ...profile, ...updates };

    // Recalculate Toe Charge
    const updatedToeWeightKg = Number(((updated.toeCartridgeCount * updated.toeCartridgeWeightGrams) / 1000).toFixed(2));
    updated.toeChargeWeightKg = updatedToeWeightKg;

    if (!hasExcelData) {
      // Recalculate Column Charge in fallback manual mode
      const updatedNitrateWeightKg = Number((updated.anfoNitrateBags25kg * 25).toFixed(1));
      const updatedFuelLiters = Number((updated.anfoNitrateBags25kg * updated.fuelLitersPerBag).toFixed(1));
      const updatedFuelWeightKg = Number((updatedFuelLiters * 0.84).toFixed(2));
      const updatedColumnWeightKg = Number((updatedNitrateWeightKg + updatedFuelWeightKg).toFixed(2));

      updated.anfoNitrateWeightKg = updatedNitrateWeightKg;
      updated.fuelTotalLiters = updatedFuelLiters;
      updated.fuelTotalKg = updatedFuelWeightKg;
      updated.columnTotalWeightKg = updatedColumnWeightKg;

      // Stemming safety
      const updatedStemmingBurdenRatio = effectiveBurden > 0 ? updated.stemmingLengthM / effectiveBurden : 1.0;
      updated.hasFlyrockRisk = updatedStemmingBurdenRatio < 0.75;

      // Fault savings
      if (updated.hasFaultOrCavity) {
        const faultHoleVolM3 = (Math.PI * Math.pow(effectiveDiameter / 2000, 2)) * (updated.faultThicknessM || 0.8);
        const savedKg = Math.min(updatedNitrateWeightKg, Math.round(faultHoleVolM3 * 850));
        updated.explosiveSavedKg = Math.max(12.5, savedKg);
        updated.costSaved = Math.round((updated.explosiveSavedKg / 25) * updated.nitrateBagCost);
      } else {
        updated.explosiveSavedKg = 0;
        updated.costSaved = 0;
      }
    }

    setProfile(updated);

    // Propagate up to parent BlastParameters without overwriting Excel-derived data
    onUpdateParameters({
      ...parameters,
      ...(hasExcelData ? {} : { chargePerHole: Number((updatedToeWeightKg + updated.columnTotalWeightKg).toFixed(2)), stemmingLength: updated.stemmingLengthM }),
      bottomChargeLength: updated.toeChargeLengthM,
      columnChargeLength: updated.columnChargeLengthM,
      chargingProfile: updated,
    });
  };

  // Visual schematic ratios for hole cross-section
  const hTotal = Math.max(1, effectiveDepth);
  const stemPct = Math.max(15, Math.min(50, (effectiveStemmingM / hTotal) * 100));
  const toePct = Math.max(8, Math.min(25, (toeChargeLengthM / hTotal) * 100));
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
            <h3 className="text-base font-extrabold tracking-wide flex flex-wrap items-center gap-2">
              <span>{isFrench ? 'Profil de Chargement Détaillé du Trou de Mine' : 'Detailed Blast Hole Charging Profile'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                3 Decks
              </span>
              {hasExcelData && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {isFrench ? `Alimenté par la Matrice (${effectiveHolesCount} trous)` : `Driven by Matrix (${effectiveHolesCount} holes)`}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {isFrench
                ? 'Structure du trou : Charge de fond (Dynamite/Amorçage), Colonne (ANFO/Émulsion), Bourrage et Bilan Fournitures'
                : 'Hole architecture: Toe primer charge (Dynamite/Booster), Column (ANFO/Emulsion), Stemming & Supplies'}
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
            <span className="text-blue-400 font-mono">H = {effectiveDepth} m (Ø {effectiveDiameter} mm)</span>
          </div>

          {/* Graphic Hole Column */}
          <div className="relative w-36 h-80 rounded-t-sm rounded-b-xl border-x-4 border-b-4 border-slate-700 bg-slate-900 flex flex-col overflow-hidden shadow-inner my-2">
            {/* 1. Bourrage (Stemming) */}
            <div
              style={{ height: `${stemPct}%` }}
              className="relative w-full bg-gradient-to-b from-stone-600 via-stone-700 to-stone-800 border-b-2 border-dashed border-stone-500 flex flex-col items-center justify-center text-center p-1"
              title={isFrench ? `Bourrage (${effectiveStemmingM} m)` : `Stemming (${effectiveStemmingM} m)`}
            >
              <div className="text-[10px] font-black text-amber-200 tracking-wider uppercase">
                {isFrench ? 'Bourrage' : 'Stemming'}
              </div>
              <div className="text-[9px] font-bold text-stone-300">
                {effectiveStemmingM} m
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
            {((hasExcelData && (holesSummary?.cavityHolesCount || 0) > 0) || (!hasExcelData && profile.hasFaultOrCavity)) && (
              <div
                className="relative w-full py-1.5 bg-stripes-amber bg-purple-900/90 border-y-2 border-amber-400 text-center flex flex-col items-center justify-center animate-pulse"
                title={isFrench ? 'Zone de faille / Bouchon Air Deck' : 'Fault Zone / Decking'}
              >
                <span className="text-[9px] font-extrabold text-amber-300 uppercase tracking-tighter">
                  ⚠ {isFrench ? 'Faille / Air Deck' : 'Fault / Air Deck'}
                </span>
                <span className="text-[8px] text-purple-200 font-bold">
                  {hasExcelData ? `${holesSummary?.cavityHolesCount} trous` : `-${profile.explosiveSavedKg} kg`}
                </span>
              </div>
            )}

            {/* 2. Charge de Colonne (ANFO: Nitrate + Fuel) */}
            <div
              style={{ height: `${colPct}%` }}
              className="relative w-full bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 border-b-2 border-amber-400 flex flex-col items-center justify-center text-center p-1.5"
              title={isFrench ? `Colonne ANFO (${columnWeightKg} kg)` : `Column ANFO (${columnWeightKg} kg)`}
            >
              <div className="text-[11px] font-black text-slate-950 uppercase tracking-wider flex items-center gap-0.5">
                <Fuel className="w-3 h-3 text-slate-950" /> ANFO
              </div>
              <div className="text-[10px] font-extrabold text-amber-950">
                ~{bagsNitratePerHole} {isFrench ? 'sac(s)' : 'bag(s)'}
              </div>
              <div className="text-[9px] font-bold text-amber-900">
                + {fuelLitersPerHole} L {isFrench ? 'gasoil' : 'diesel'}
              </div>
              <div className="text-[9px] font-black text-slate-950 mt-0.5 bg-amber-400/80 px-1 rounded">
                {columnWeightKg} kg
              </div>
            </div>

            {/* 3. Charge de Pied (Dynamite / Booster) */}
            <div
              style={{ height: `${toePct}%` }}
              className="relative w-full bg-gradient-to-b from-red-600 to-rose-800 flex flex-col items-center justify-center text-center p-1"
              title={isFrench ? `Pied Dynamite (${toeWeightKg} kg)` : `Toe Dynamite (${toeWeightKg} kg)`}
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
                {toeWeightKg} kg
              </div>
            </div>

            {/* Surforage (Subdrill) Base */}
            <div className="h-4 bg-slate-950 text-slate-500 text-[8px] flex items-center justify-center font-mono">
              Surforage {effectiveSubdrill}m
            </div>
          </div>

          {/* Quick Metrics Under Hole */}
          <div className="w-full grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 mt-2">
            <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">{isFrench ? 'Charge / Trou (Moy.)' : 'Charge / Hole (Avg)'}</span>
              <span className="font-extrabold text-amber-400 text-xs">
                {avgChargePerHoleKg} kg
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

        {/* Right Form: 3 Decks Controls (8 cols) */}
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
                {toeWeightKg} kg / {isFrench ? 'trou' : 'hole'}
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
                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                    = {toeWeightKg} kg
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
                {columnWeightKg} kg / {isFrench ? 'trou' : 'hole'}
              </span>
            </div>

            {hasExcelData ? (
              /* Non-conflicting calculated displays from Excel hole average */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase mb-0.5">
                      {isFrench ? 'Charge Colonne (Moyenne)' : 'Column Charge (Avg)'}
                    </span>
                    <span className="text-sm font-black text-amber-300">
                      {columnWeightKg} kg
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {isFrench
                        ? `Charge trou: ${avgChargePerHoleKg} kg - Pied: ${toeWeightKg} kg`
                        : `Total hole: ${avgChargePerHoleKg} kg - Toe: ${toeWeightKg} kg`}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase mb-0.5">
                      {isFrench ? 'Sacs Nitrate Requis / Trou' : 'Nitrate Bags / Hole'}
                    </span>
                    <span className="text-sm font-black text-amber-300">
                      ~{bagsNitratePerHole} {isFrench ? 'sac(s) 25kg' : 'bag(s)'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      = {nitrateWeightKg} kg {isFrench ? 'nitrate pur' : 'pure nitrate'}
                    </span>
                  </div>

                  <div className="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase mb-0.5">
                      {isFrench ? 'Gasoil Requis / Trou' : 'Diesel Fuel / Hole'}
                    </span>
                    <span className="text-sm font-black text-amber-300">
                      ~{fuelLitersPerHole} Litres
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      = {fuelWeightKg} kg (ratio 3.0 L/sac)
                    </span>
                  </div>
                </div>

                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2 flex items-center justify-between text-[11px] text-amber-200">
                  <span>
                    {isFrench
                      ? '✓ Ces quantités sont automatiquement calculées à partir de la matrice Excel (pour modifier la charge d’un trou, utilisez le tableau ci-dessus).'
                      : '✓ These quantities are derived directly from the Excel drillholes matrix (edit per-hole charge in the table above).'}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded uppercase shrink-0">
                    {isFrench ? 'Lecture Seule' : 'Read-Only'}
                  </span>
                </div>
              </div>
            ) : (
              /* Fallback manual editable fields when no Excel drillhole matrix exists */
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
                      (3.0 L)
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
            )}
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
                hasFlyrockRisk
                  ? 'bg-red-950 text-red-300 border-red-700'
                  : 'bg-stone-900 text-stone-200 border-stone-700'
              }`}>
                {effectiveStemmingM} m ({isFrench ? 'Hauteur' : 'Height'})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {hasExcelData ? (
                /* Read-only field showing Excel average stemming */
                <div className="bg-slate-900 border border-slate-700/80 p-2.5 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">
                      {isFrench ? 'Hauteur du Bourrage (Moyenne Excel)' : 'Stemming Length (Excel Average)'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-bold border border-stone-700">
                      {isFrench ? 'Calculé' : 'Calculated'}
                    </span>
                  </div>
                  <span className="text-base font-black text-stone-200 mt-1">
                    {effectiveStemmingM} m
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {isFrench
                      ? `Rapport T/B = ${(effectiveStemmingM / Math.max(0.1, effectiveBurden)).toFixed(2)} (Banquette: ${effectiveBurden} m)`
                      : `T/B Ratio = ${(effectiveStemmingM / Math.max(0.1, effectiveBurden)).toFixed(2)} (Burden: ${effectiveBurden} m)`}
                  </span>
                </div>
              ) : (
                /* Fallback editable number input */
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
              )}

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

            {hasFlyrockRisk && (
              <div className="bg-red-950/50 border border-red-600/40 p-2.5 rounded-lg flex items-center gap-2 text-xs text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  {isFrench
                    ? `Alerte Sécurité : Le bourrage (${effectiveStemmingM} m) est inférieur à 0.75 × Burden (${effectiveBurden} m). Risque de projection de blocs (flyrock) ! Augmentez le bourrage à minimum ${(effectiveBurden * 0.85).toFixed(1)} m.`
                    : `Safety Warning: Stemming height (${effectiveStemmingM} m) is under 0.75 × Burden (${effectiveBurden} m). Severe flyrock risk! Increase stemming to at least ${(effectiveBurden * 0.85).toFixed(1)} m.`}
                </span>
              </div>
            )}
          </div>

          {/* GÉOLOGIE & FAILLES DU FOREUR : Decking & Anti-Gaspillage */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-purple-800/40 space-y-3">
            {hasExcelData ? (
              /* Non-conflicting read-only display derived from Excel cavity logs */
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${(holesSummary?.cavityHolesCount || 0) > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                  <div>
                    <span className="font-bold text-purple-200">
                      {isFrench ? 'Failles & Cavités Géologiques (Carnet Foreur) :' : 'Geological Faults & Cavities (Driller Logs):'}
                    </span>
                    <span className="text-slate-300 block text-[11px] mt-0.5">
                      {(holesSummary?.cavityHolesCount || 0) > 0
                        ? (isFrench
                            ? `${holesSummary?.cavityHolesCount} trou(s) avec zone de faille identifiée. Bouchon intercalaire (Air Deck) automatiquement pris en compte.`
                            : `${holesSummary?.cavityHolesCount} hole(s) with recorded fault zones. Decking / Air Deck automatically accounted for.`)
                        : (isFrench
                            ? 'Aucune cavité ni zone fracturée anormale détectée dans les colonnes du carnet de foration Excel.'
                            : 'No cavities or abnormal fracture zones recorded in the Excel drillhole logs.')}
                    </span>
                  </div>
                </div>
                {(holesSummary?.cavityHolesCount || 0) > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[10px] uppercase">
                    {holesSummary?.cavityHolesCount} {isFrench ? 'Failles' : 'Faults'}
                  </span>
                )}
              </div>
            ) : (
              /* Fallback manual editable fields */
              <>
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
              </>
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
            <span className="text-slate-500 text-xs font-mono">({effectiveHolesCount} {isFrench ? 'trous forés' : 'drilled holes'})</span>
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
              = {totalToeExplosivesKg} kg {isFrench ? 'au pied' : 'at toe'}
            </span>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-xl border border-emerald-900/40">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              {isFrench ? 'Coût Moyen / Tonne' : 'Blast Cost / Ton'}
            </span>
            <span className="text-lg font-black text-emerald-400">
              {Math.round(costPerTon * currRate).toLocaleString()} <span className="text-xs font-semibold text-slate-400">{currLabel}/t</span>
            </span>
            <span className="block text-[10px] text-emerald-300/80 mt-0.5 font-medium">
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
              {isFrench ? 'Bilan d’Exploitation & Rentabilité :' : 'Operational Yield & Performance:'}
            </span>
            <span>
              {isFrench
                ? `Ce tir abattra ${totalRockVolumeM3.toLocaleString()} m³ (${totalRockTonnage.toLocaleString()} tonnes) avec une consommation globale de ${totalExplosivesKg.toLocaleString()} kg d'explosifs (soit ${actualPowderFactor.toFixed(2)} kg/m³ et un rendement élevé de ${yieldM3PerKg.toFixed(2)} m³/kg).`
                : `This blast will break ${totalRockVolumeM3.toLocaleString()} m³ (${totalRockTonnage.toLocaleString()} tonnes) consuming ${totalExplosivesKg.toLocaleString()} kg of explosives (yielding a powder factor of ${actualPowderFactor.toFixed(2)} kg/m³ and ${yieldM3PerKg.toFixed(2)} m³/kg).`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
