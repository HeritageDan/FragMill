import type { Blast, MillBatch, EconomicParameters, EconomicEvaluation } from '../../types';

export const DEFAULT_ECONOMIC_PARAMS: EconomicParameters = {
  drillingCostPerMeter: 16.5, // USD per meter drilled
  explosiveCostPerKg: 1.85, // USD per kg ANFO/emulsion
  secondaryBreakingCostPerBoulder: 45.0, // USD per oversize boulder hammer breaking
  crushingEnergyCostPerKwh: 0.14, // USD per kWh electricity tariff
  millingEnergyCostPerKwh: 0.14, // USD per kWh
  dieselCostPerLiter: 1.25, // USD per liter fuel
};

export interface CostCurvePoint {
  p80Mm: number;
  drillingBlastingCostPerTon: number;
  secondaryBreakingCostPerTon: number;
  crushingMillingCostPerTon: number;
  totalCostPerTon: number;
}

export function evaluateMineToMillEconomics(
  blast: Blast,
  p80Mm: number,
  millBatch?: MillBatch,
  customParams?: Partial<EconomicParameters>
): {
  evaluation: EconomicEvaluation;
  costCurve: CostCurvePoint[];
  sweetSpotP80Mm: number;
  sweetSpotTotalCostPerTon: number;
  annualSavingsPotential100kt: number;
} {
  const params: EconomicParameters = { ...DEFAULT_ECONOMIC_PARAMS, ...(customParams || {}) };

  const benchHeight = Math.max(1, blast.parameters.benchHeight);
  const burden = Math.max(0.5, blast.parameters.burden);
  const spacing = Math.max(0.5, blast.parameters.spacing);
  const holeDepth = Math.max(1, blast.parameters.holeDepth);
  const chargePerHole = Math.max(1, blast.parameters.chargePerHole);
  const density = Math.max(1.5, blast.rockMass.density);

  const holeVolumeM3 = burden * spacing * benchHeight;
  const holeTonnes = holeVolumeM3 * density;

  // 1. Drilling Cost per Ton
  const drillingCostPerTon = Number(((holeDepth * params.drillingCostPerMeter) / holeTonnes).toFixed(2));

  // 2. Blasting (Explosives) Cost per Ton
  const blastingCostPerTon = Number(((chargePerHole * params.explosiveCostPerKg) / holeTonnes).toFixed(2));

  // 3. Secondary Breaking (Boulder Oversize) Cost per Ton
  // Number of boulders > 300 mm correlates non-linearly with P80
  const estimatedBouldersPer1000T = Math.max(0.5, Math.pow(p80Mm / 130, 2.2) * 3.5);
  const actualBouldersPer1000T = millBatch?.bouldersSecondaryBreakingCount
    ? (millBatch.bouldersSecondaryBreakingCount / Math.max(1, millBatch.batchTonnageTonnes)) * 1000
    : estimatedBouldersPer1000T;
  const secondaryBreakingCostPerTon = Number(
    ((actualBouldersPer1000T * params.secondaryBreakingCostPerBoulder) / 1000).toFixed(2)
  );

  // 4. Crushing Energy Cost per Ton
  const crushingSpecificEnergyKwhPerT = millBatch?.crushingSpecificEnergyKwhPerT
    ? millBatch.crushingSpecificEnergyKwhPerT
    : Number((1.2 + 0.9 * Math.pow(p80Mm / 200, 1.4)).toFixed(2));
  const crushingCostPerTon = Number((crushingSpecificEnergyKwhPerT * params.crushingEnergyCostPerKwh).toFixed(2));

  // 5. Milling Energy Cost per Ton
  // Bond work index & feed size relationship: finer feed drastically reduces SAG/ball mill power
  const millingSpecificEnergyKwhPerT = millBatch?.millingSpecificEnergyKwhPerT
    ? millBatch.millingSpecificEnergyKwhPerT
    : Number((13.5 + 4.8 * ((p80Mm - 140) / 140)).toFixed(2));
  const millingCostPerTon = Number((millingSpecificEnergyKwhPerT * params.millingEnergyCostPerKwh).toFixed(2));

  // Total Operational Cost per Ton
  const totalCostPerTon = Number(
    (
      drillingCostPerTon +
      blastingCostPerTon +
      secondaryBreakingCostPerTon +
      crushingCostPerTon +
      millingCostPerTon
    ).toFixed(2)
  );

  // 6. Carbon Emissions (Scope 1 & 2 in kg CO2e / ton ore)
  // Scope 1: Explosives detonation (~0.18 kg CO2e / kg ANFO)
  const explosivePerTonKg = chargePerHole / holeTonnes;
  const scope1Explosives = Number((explosivePerTonKg * 0.18).toFixed(2));

  // Scope 1: Diesel for pit loading, hauling & drilling (~1.25 L diesel / ton * 2.68 kg CO2e/L)
  const dieselLitersPerTon = 1.15 + (p80Mm > 250 ? 0.35 : 0); // Boulder handling burns extra fuel
  const scope1Diesel = Number((dieselLitersPerTon * 2.68).toFixed(2));

  // Scope 2: Electricity for Comminution (~0.52 kg CO2e / kWh grid average)
  const totalPowerKwh = crushingSpecificEnergyKwhPerT + millingSpecificEnergyKwhPerT;
  const scope2Electricity = Number((totalPowerKwh * 0.52).toFixed(2));

  const totalCarbon = Number((scope1Explosives + scope1Diesel + scope2Electricity).toFixed(2));

  // 7. Compute Trade-off Cost Curve across varying P80 (from 80 mm to 360 mm)
  const costCurve: CostCurvePoint[] = [];
  let sweetSpotP80Mm = 160;
  let minCurveCost = Infinity;

  for (let testP80 = 80; testP80 <= 360; testP80 += 20) {
    // Finer P80 requires tighter pattern / higher powder factor
    const ratioToCurrent = testP80 / Math.max(1, p80Mm);
    // Inverse relationship: tighter pattern increases drilling/blasting
    const testDrillBlast = (drillingCostPerTon + blastingCostPerTon) * Math.pow(1 / ratioToCurrent, 0.45);
    const testSecondary = Number(
      ((Math.pow(testP80 / 130, 2.2) * 3.5 * params.secondaryBreakingCostPerBoulder) / 1000).toFixed(2)
    );
    const testCrush = (1.2 + 0.9 * Math.pow(testP80 / 200, 1.4)) * params.crushingEnergyCostPerKwh;
    const testMill = (13.5 + 4.8 * ((testP80 - 140) / 140)) * params.millingEnergyCostPerKwh;
    const testTotal = Number((testDrillBlast + testSecondary + testCrush + testMill).toFixed(2));

    costCurve.push({
      p80Mm: testP80,
      drillingBlastingCostPerTon: Number(testDrillBlast.toFixed(2)),
      secondaryBreakingCostPerTon: testSecondary,
      crushingMillingCostPerTon: Number((testCrush + testMill).toFixed(2)),
      totalCostPerTon: testTotal,
    });

    if (testTotal < minCurveCost) {
      minCurveCost = testTotal;
      sweetSpotP80Mm = testP80;
    }
  }

  const potentialSavingsPerTon = Math.max(0, Number((totalCostPerTon - minCurveCost).toFixed(2)));
  const annualSavingsPotential100kt = Math.round(potentialSavingsPerTon * 100000);

  const evaluation: EconomicEvaluation = {
    drillingCostPerTon,
    blastingCostPerTon,
    secondaryBreakingCostPerTon,
    crushingCostPerTon,
    millingCostPerTon,
    totalCostPerTon,
    optimalP80Mm: sweetSpotP80Mm,
    potentialSavingsPerTon,
    carbonEmissions: {
      scope1ExplosivesKgCo2ePerTon: scope1Explosives,
      scope1DieselKgCo2ePerTon: scope1Diesel,
      scope2ElectricityKgCo2ePerTon: scope2Electricity,
      totalKgCo2ePerTon: totalCarbon,
    },
  };

  return {
    evaluation,
    costCurve,
    sweetSpotP80Mm,
    sweetSpotTotalCostPerTon: minCurveCost,
    annualSavingsPotential100kt,
  };
}
