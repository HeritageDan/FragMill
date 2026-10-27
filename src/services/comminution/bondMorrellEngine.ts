// Comminution & Mineral Recovery Digital Twin (Bond, Morrell, & Circuit Modeling)

import type { BondCircuitParams, CircuitSimulationResult, EconomicTradeoffPoint } from '../../types/advanced';

/**
 * Standard Bond Third Theory of Comminution:
 * W = 10 * Wi * (1 / sqrt(P80) - 1 / sqrt(F80))  [in kWh/short ton, converted to metric tonne: * 1.1023]
 * Feed (F80) and Product (P80) are in microns (µm).
 */
export function calculateBondSpecificEnergy(
  f80Mm: number,
  p80Microns: number,
  bondWorkIndexKWhPerT: number
): number {
  const f80Microns = Math.max(100, f80Mm * 1000);
  const targetP80 = Math.max(10, p80Microns);

  if (targetP80 >= f80Microns) return 0.5;

  const wKWhShortTon = 10 * bondWorkIndexKWhPerT * (1 / Math.sqrt(targetP80) - 1 / Math.sqrt(f80Microns));
  const wKWhMetricTonne = wKWhShortTon * 1.1023; // Convert to metric tonne
  return parseFloat(Math.max(0.5, wKWhMetricTonne).toFixed(2));
}

/**
 * Morrell Comminution Energy Model with Blast-Induced Micro-Crack Correction:
 * Finer blasting creates micro-fractures in the ore grains, reducing the effective
 * breakage resistance (Axb) and saving 8% to 18% in tumbling mill grinding energy.
 */
export function calculateMorrellSpecificEnergy(
  f80Mm: number,
  targetP80Microns: number,
  rockAxb: number,
  powderFactorKgPerM3 = 0.65
): number {
  // Higher powder factor induces micro-fissuring, effectively increasing Axb (softer rock)
  const microCrackMultiplier = 1.0 + Math.max(0, (powderFactorKgPerM3 - 0.4) * 0.25);
  const effectiveAxb = rockAxb * microCrackMultiplier;

  // Morrell specific energy formula (kWh/t)
  const f80Microns = f80Mm * 1000;
  const reductionRatio = Math.max(1.1, f80Microns / targetP80Microns);
  const morrellEnergy = (280 / effectiveAxb) * Math.log10(reductionRatio);

  return parseFloat(Math.max(1.0, morrellEnergy).toFixed(2));
}

/**
 * Gold / Mineral Liberation & Cyanide Leaching Kinetics Digital Twin:
 * Recovery increases non-linearly as product grind size approaches liberation diameter (typically 75 µm).
 */
export function estimateMineralRecovery(
  p80Microns: number,
  liberationSizeMicrons = 75,
  maxRecoveryPercent = 95.0
): { liberationPercent: number; recoveryPercent: number } {
  const ratio = liberationSizeMicrons / Math.max(10, p80Microns);
  const liberation = Math.min(100, Math.max(20, Math.round(100 * Math.pow(ratio, 0.45))));
  const recovery = Math.min(maxRecoveryPercent, maxRecoveryPercent * (1 - Math.exp(-1.8 * Math.pow(ratio, 0.7))));

  return {
    liberationPercent: liberation,
    recoveryPercent: parseFloat(recovery.toFixed(1)),
  };
}

/**
 * Primary Jaw / Gyratory Crusher Power & Capacity Model (Lynch & Taggart):
 * Models power draw, closed-side setting (CSS), and product size P80.
 */
export function simulatePrimaryCrusher(
  f80Mm: number,
  cssMm = 110,
  targetThroughputTph = 500,
  wiCrushing = 12.0
): { crusherProductP80Mm: number; powerDrawKW: number; capacityRatingTPH: number; reductionRatio: number } {
  // Crusher product P80 is approximately 0.85 * CSS for standard jaw/gyratory crushers
  const crusherProductP80Mm = parseFloat((cssMm * 0.85).toFixed(1));
  const reductionRatio = parseFloat((f80Mm / Math.max(10, crusherProductP80Mm)).toFixed(2));

  // Taggart specific crushing energy
  const specEnergy = 10 * wiCrushing * (1 / Math.sqrt(crusherProductP80Mm * 1000) - 1 / Math.sqrt(f80Mm * 1000));
  const powerDrawKW = Math.round(Math.max(25, specEnergy * targetThroughputTph * 1.15));
  const capacityRatingTPH = Math.round(180 * Math.pow(cssMm / 100, 1.25));

  return {
    crusherProductP80Mm,
    powerDrawKW,
    capacityRatingTPH,
    reductionRatio,
  };
}

/**
 * Full Circuit Simulation: Crushing, SAG Milling, Ball Milling, and Recovery
 */
export function simulateComminutionCircuit(params: BondCircuitParams): CircuitSimulationResult {
  const primaryCrusherProductMm = Math.min(params.f80Mm, 120); // Crusher product ~120 mm
  const targetP80Microns = params.targetP80Mm * 1000; // e.g. 0.075 mm = 75 µm

  // 1. Primary Crushing Specific Energy (Bond)
  const crushingEnergy = calculateBondSpecificEnergy(params.f80Mm, primaryCrusherProductMm * 1000, params.bondWorkIndexKWhPerT * 0.6);
  const crusherModel = simulatePrimaryCrusher(params.f80Mm, 110, params.targetDailyThroughputTonnes / params.plantOperatingHoursPerDay, params.bondWorkIndexKWhPerT * 0.6);

  // 2. Grinding Specific Energy (Ball Mill / SAG)
  const grindingEnergyBond = calculateBondSpecificEnergy(primaryCrusherProductMm, targetP80Microns, params.bondWorkIndexKWhPerT);
  const grindingEnergyMorrell = calculateMorrellSpecificEnergy(primaryCrusherProductMm, targetP80Microns, params.rockAxb);

  const totalSpecificEnergy = parseFloat((crushingEnergy + grindingEnergyMorrell).toFixed(2));

  // Available plant installed power for small/medium artisanal mill (e.g. 450 kW)
  const installedPowerKW = 450;
  const achievableThroughputTPH = Math.round((installedPowerKW * 0.9) / totalSpecificEnergy);
  const dailyThroughputTonnes = achievableThroughputTPH * params.plantOperatingHoursPerDay;

  // Steel ball wear: ~ 0.04 kg/kWh in quartz granodiorite; Mill liner wear ~ 0.012 kg/t
  const grindingMediaWearKgPerT = parseFloat((totalSpecificEnergy * 0.042).toFixed(3));
  const linerWearKgPerT = parseFloat((totalSpecificEnergy * 0.012).toFixed(3));

  // Costs
  const dailyPowerCostUSD = Math.round(dailyThroughputTonnes * totalSpecificEnergy * params.electricityCostPerKWhUSD);
  const powderFactorKgPerT = 0.65 / 2.65; // ~0.245 kg/t
  const dailyDrillBlastCostUSD = Math.round(dailyThroughputTonnes * powderFactorKgPerT * params.explosiveCostPerKgUSD * 2.1); // explosives + accessories
  const totalComminutionCostPerTonneUSD = parseFloat((totalSpecificEnergy * params.electricityCostPerKWhUSD + powderFactorKgPerT * params.explosiveCostPerKgUSD * 2.1).toFixed(2));

  // Carbon emissions: scope 2 electricity generation factor (~0.45 kg CO2/kWh grid average)
  const millingCo2KgPerT = parseFloat((totalSpecificEnergy * 0.45).toFixed(2));

  // Liberation & Recovery
  const { liberationPercent, recoveryPercent } = estimateMineralRecovery(targetP80Microns);

  return {
    specificEnergyBondKWhPerT: grindingEnergyBond,
    specificEnergyMorrellKWhPerT: grindingEnergyMorrell,
    crushingSpecificEnergyKWhPerT: crushingEnergy,
    grindingSpecificEnergyKWhPerT: grindingEnergyMorrell,
    totalSpecificEnergyKWhPerT: totalSpecificEnergy,
    achievableThroughputTPH,
    dailyThroughputTonnes,
    grindingMediaWearKgPerT,
    dailyPowerCostUSD,
    dailyDrillBlastCostUSD,
    totalComminutionCostPerTonneUSD,
    mineralLiberationPercent: liberationPercent,
    estimatedGoldRecoveryPercent: recoveryPercent,
    crusherPowerKW: crusherModel.powerDrawKW,
    crusherCapacityTPH: crusherModel.capacityRatingTPH,
    smcEnergyKwhPerT: grindingEnergyMorrell,
    millingCo2KgPerT,
  };
}

/**
 * Mine-to-Mill Economic Trade-off Curve Optimization:
 * Demonstrates the fundamental mining law: spending +$0.15/t in blasting saves $0.85/t in milling energy!
 */
export function generateEconomicTradeoffCurve(
  baseParams: BondCircuitParams
): EconomicTradeoffPoint[] {
  const powderFactors = [0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 1.0];

  return powderFactors.map((pf) => {
    // F80 decreases with higher powder factor: Kuz-Ram x50 ~ A * (Q)^(-0.8)
    const blastF80Mm = Math.round(380 * Math.pow(0.5 / pf, 0.75));
    const drillBlastCost = pf * 0.42 * baseParams.explosiveCostPerKgUSD * 2.0;

    const morrellEnergy = calculateMorrellSpecificEnergy(blastF80Mm, baseParams.targetP80Mm * 1000, baseParams.rockAxb, pf);
    const millingEnergyCost = morrellEnergy * baseParams.electricityCostPerKWhUSD;
    const totalCircuitCost = parseFloat((drillBlastCost + millingEnergyCost).toFixed(2));

    const installedPowerKW = 450;
    const throughput = Math.round((installedPowerKW * 0.9) / morrellEnergy);

    return {
      powderFactorKgPerM3: pf,
      blastP80Mm: blastF80Mm,
      drillBlastCostPerTUSD: parseFloat(drillBlastCost.toFixed(2)),
      millingEnergyCostPerTUSD: parseFloat(millingEnergyCost.toFixed(2)),
      totalCircuitCostPerTUSD: totalCircuitCost,
      throughputTPH: throughput,
    };
  });
}
