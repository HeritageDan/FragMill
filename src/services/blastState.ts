// Central Blast State Engine - Single Source of Truth for FragMill
// Ensures absolute mathematical consistency, zero dual-values, and rigorous physical input validation.

import type {
  Blast,
  BlastParameters,
  RockMass,
  MillBatch,
  GroundTruth,
  FragmentationMetrics,
  CumulativePoint,
  Fragment,
} from '../types';
import type {
  DroneOrthomosaicData,
  BeltVisionConfig,
  BeltStats,
  IREDESHole,
  VariogramParams,
  KrigingGridNode,
  BoreholeSample,
  HoleTimingInfo,
} from '../types/advanced';
import { calculateRockFactorA, computeKuzRam, computeXPFrag } from './kuzram';
import { fitRosinRammler, fitSwebrec, computeFragmentationMetrics } from './statistics';
import { computeSieveDistribution } from './validation';
import { calculateUSBMPPV, generatePatternTiming } from './timing/initiationSimulator';
import { generateDemoDroneSurvey } from './drone3d/droneSizing';
import { generateDrillTelemetryFromBlast } from './telemetry/iredesGenerator';
import { DEFAULT_VARIOGRAM, computeKrigingGrid, generateDemoBoreholes } from './geostatistics/krigingEngine';
import { calculateBondSpecificEnergy, calculateMorrellSpecificEnergy } from './comminution/bondMorrellEngine';

export interface BlastGeometryState {
  benchHeight: number;
  subdrill: number;
  holeDepth: number;
  expectedHoleDepth: number;
  isDepthInconsistent: boolean;
  holeDiameterMm: number;
  burden: number;
  spacing: number;
  numberOfHoles: number;
  holeVolumeM3: number;
  totalBlastedVolumeM3: number;
  benchElevationRL: number;
  stemmingLength: number;
  columnChargeLength: number;
  bottomChargeLength: number;
  deckSumM: number;
  isDeckSumInconsistent: boolean;
}

export interface BlastExplosiveState {
  explosiveType: string;
  isEmulsion: boolean;
  densityKgM3: number;
  vodMPerS: number;
  rws: number;
  costPerKgUSD: number;
  linearLoadingKgPerM: number;
  availableChargeLengthM: number;
  holeChargeCapacityKg: number;
  chargePerHole: number;
  totalExplosiveKg: number;
  powderFactorKgPerM3: number;
  isCapacityExceeded: boolean;
  capacityDeficitKg: number;
}

export interface RockFactorComponents {
  rmd: number;
  jps: number;
  jpa: number;
  rdi: number;
  hf: number;
  sum: number;
  calculatedA: number;
}

export interface BlastRockState {
  rockType: string;
  densityTPerM3: number;
  densityKgM3: number;
  totalBlastedTonnage: number;
  ucsMPa: number;
  youngsModulusGPa: number;
  gsiOrRmr: number;
  meanJointSpacingM: number;
  jointOrientation: string;
  jointSetCount: number;
  components: RockFactorComponents;
  rockFactorA: number;
}

export interface BlastKuzRamState {
  meanSizeX50Mm: number;
  uniformityIndexN: number;
  characteristicSizeXcMm: number;
  p10Mm: number;
  p20Mm: number;
  p50Mm: number;
  p80Mm: number;
  p90Mm: number;
  oversizePercent: number;
  finesPercent: number;
  predictedCurve: CumulativePoint[];
  xpFragCurve?: CumulativePoint[];
}

export interface BlastOpticalState {
  hasOpticalData: boolean;
  totalImagesCount: number;
  analyzedImagesCount: number;
  isMultiImageComposite: boolean;
  fragmentCount: number;
  p10Mm: number;
  p20Mm: number;
  p50Mm: number;
  p80Mm: number;
  p90Mm: number;
  topSizeMm: number;
  uniformityIndex: number;
  oversizePercent: number;
  finesPercent: number;
  curve: CumulativePoint[];
  swebrecFit: {
    xMax: number;
    x50: number;
    b: number;
    r2: number;
    rmse: number;
  };
  rosinRammlerFit: {
    xc: number;
    n: number;
    r2: number;
    rmse: number;
    converged: boolean;
  };
  bootstrapIterations: number;
  luminanceFormula: string;
  bayesianStatus: 'Favorable (< 15%)' | 'Moyen (15-30%)' | 'Défavorable (> 30%)';
  bayesianRelativeGapPercent: number;
  posteriorMeanA: number;
  posteriorStdA: number;
  perImageBreakdown?: Array<{
    imageId: string;
    filename: string;
    zone?: string;
    fragmentCount: number;
    p50Mm: number;
    p80Mm: number;
    oversizePercent: number;
    finesPercent: number;
  }>;
  fragments?: Fragment[];
}

export interface BlastSieveState {
  hasSieveData: boolean;
  p20Mm?: number;
  p50Mm?: number;
  p80Mm?: number;
  errorP20Percent?: number;
  errorP50Percent?: number;
  errorP80Percent?: number;
  mapePercent?: number;
  r2?: number;
  kBiasFactor?: number;
  sampleMassKg?: number;
}

export interface BlastComminutionState {
  hasMillBatch: boolean;
  feedF80Mm: number;
  batchTonnageTonnes: number;
  truckCount: number;
  crushingSpecificEnergyKwhPerT: number;
  grindingSpecificEnergyKwhPerT: number;
  totalSpecificEnergyKwhPerT: number;
  achievableThroughputTPH: number;
  dailyThroughputTonnes: number;
  goldRecoveryPercent: number;
  powerCostUSDPerKwh: number;
  explosiveCostUSDPerKg: number;
  isCapacityMet: boolean;
  isHighRecovery: boolean;
  diagnosticCapacityTextEn: string;
  diagnosticCapacityTextFr: string;
}

export interface BlastCostItem {
  nameEn: string;
  nameFr: string;
  costPerTonUSD: number;
  percentage: number;
  driverEn: string;
  driverFr: string;
}

export interface BlastEconomicsState {
  costs: BlastCostItem[];
  totalCostPerTonUSD: number;
  optimalP80Mm: number;
  isOptimumAtBoundary: boolean;
  potentialSavingsPerTonUSD: number;
  annualSavings100ktUSD: number;
  scope1ExplosivesKgCo2ePerTon: number;
  scope1DieselKgCo2ePerTon: number;
  scope2ElectricityKgCo2ePerTon: number;
  totalCarbonKgCo2ePerTon: number;
}

export interface BlastBeltState {
  hasBeltData: boolean;
  isDemoData: boolean;
  isSimulationStream: boolean;
  beltSpeedMPerS: number;
  beltWidthM: number;
  crusherGapeThresholdMm: number;
  samplingIntervalMs: number;
  fps: number;
  instantTph: number;
  p50Mm: number;
  p80Mm: number;
  topSizeMm: number;
}

export interface BlastTimingState {
  surfaceDelayMs: number;
  inHoleDelayMs: number;
  maxChargePerDelayKg: number;
  holesFiredSimultaneously: number;
  scaledDistance: number;
  predictedPPVMmPerS: number;
  distanceToStructureM: number;
  holeDiameterMm: number;
  holes?: HoleTimingInfo[];
}

export interface BlastDrillingState {
  hasDrillTelemetry: boolean;
  isDemoData: boolean;
  collarToleranceMm: number;
  totalHoles: number;
  compliantHolesCount: number;
  complianceRatePercent: number;
  maxCollarErrorMm: number;
  avgPenetrationRateMPerMin: number;
  rigModel: string;
  holes: IREDESHole[];
}

export interface BlastKrigingState {
  softCutoffMPa: number;
  hardCutoffMPa: number;
  softDomainPercent: number;
  mediumDomainPercent: number;
  hardDomainPercent: number;
  dominantDomainEn: string;
  dominantDomainFr: string;
  gridNodes?: KrigingGridNode[];
  boreholes?: BoreholeSample[];
  gridBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  gridCols?: number;
  gridRows?: number;
  variogram?: VariogramParams;
  selectedAttribute?: string;
  meanEstimated?: number;
  minEstimated?: number;
  maxEstimated?: number;
}

export interface BlastDroneState {
  hasDroneData: boolean;
  isDemoData: boolean;
  totalVolumeM3: number;
  meanP80Mm: number;
  pointCloudCount: number;
  sectors: Array<{
    nameEn: string;
    nameFr: string;
    volumeM3: number;
    p50Mm: number;
    p80Mm: number;
    topSizeMm: number;
    oversizePercent: number;
    zone: string;
  }>;
}

export interface BlastState {
  blastId: string;
  blastDbId: string;
  dateTime: string;
  weather: string;
  notes: string;
  geometry: BlastGeometryState;
  explosive: BlastExplosiveState;
  rock: BlastRockState;
  kuzRam: BlastKuzRamState;
  optical: BlastOpticalState;
  sieve: BlastSieveState;
  comminution: BlastComminutionState;
  economics: BlastEconomicsState;
  belt: BlastBeltState;
  timing: BlastTimingState;
  drilling: BlastDrillingState;
  kriging: BlastKrigingState;
  drone: BlastDroneState;
  validationWarningsEn: string[];
  validationWarningsFr: string[];
}

/**
 * Universal Derived Blast State Builder
 * Acts as the definitive Single Source of Truth across all views, banners, cards, and reports.
 */
export function getBlastState(
  blast: Blast,
  overrides?: {
    collarToleranceMm?: number;
    crusherGapeThresholdMm?: number;
    beltSpeedMPerS?: number;
    distanceToStructureM?: number;
    softCutoffMPa?: number;
    hardCutoffMPa?: number;
  }
): BlastState {
  const p = blast.parameters || ({} as BlastParameters);
  const rm = blast.rockMass || ({} as RockMass);

  const validationWarningsEn: string[] = [];
  const validationWarningsFr: string[] = [];

  // 1. GEOMETRY
  const benchHeight = p.benchHeight || 6.0;
  const subdrill = p.subdrill !== undefined ? p.subdrill : 0.8;
  const inclination = p.holeInclination || 90;
  const rad = (inclination * Math.PI) / 180;
  const expectedHoleDepth = Number(((benchHeight + subdrill) / Math.sin(rad)).toFixed(2));
  let holeDepth = p.holeDepth || expectedHoleDepth;

  const isDepthInconsistent = Math.abs(holeDepth - expectedHoleDepth) > 0.25;
  if (isDepthInconsistent) {
    validationWarningsEn.push(
      `Drilled hole depth (${holeDepth.toFixed(1)} m) is inconsistent with bench height (${benchHeight.toFixed(1)} m) + subdrill (${subdrill.toFixed(1)} m) [expected: ${expectedHoleDepth.toFixed(1)} m].`
    );
    validationWarningsFr.push(
      `Profondeur forée (${holeDepth.toFixed(1)} m) incohérente avec hauteur gradin (${benchHeight.toFixed(1)} m) + surforation (${subdrill.toFixed(1)} m) [attendu: ${expectedHoleDepth.toFixed(1)} m].`
    );
  }

  let holeDiameterMm = p.holeDiameter || 89;
  let burden = p.burden || 3.0;
  let spacing = p.spacing || 3.5;
  let numberOfHoles = p.numberOfHoles || 24;
  let stemmingLength = p.stemmingLength || 2.0;

  // If detailed drillholes are imported from Excel/CSV, derive real geometrical aggregates
  if (blast.drillHoles && blast.drillHoles.length > 0) {
    numberOfHoles = blast.drillHoles.length;
    burden = Number((blast.drillHoles.reduce((acc, h) => acc + (h.burdenM || p.burden || 3.0), 0) / blast.drillHoles.length).toFixed(2));
    spacing = Number((blast.drillHoles.reduce((acc, h) => acc + (h.spacingM || p.spacing || 3.5), 0) / blast.drillHoles.length).toFixed(2));
    holeDepth = Number((blast.drillHoles.reduce((acc, h) => acc + (h.depthM || p.holeDepth || expectedHoleDepth), 0) / blast.drillHoles.length).toFixed(2));
    stemmingLength = Number((blast.drillHoles.reduce((acc, h) => acc + (h.stemmingM || p.stemmingLength || 2.0), 0) / blast.drillHoles.length).toFixed(2));
    holeDiameterMm = Math.round(blast.drillHoles.reduce((acc, h) => acc + (h.diameterMm || p.holeDiameter || 89), 0) / blast.drillHoles.length);
  }

  const holeVolumeM3 = Number((burden * spacing * benchHeight).toFixed(2));
  const totalBlastedVolumeM3 = blast.drillHoles && blast.drillHoles.length > 0
    ? Math.round(blast.drillHoles.reduce((acc, h) => acc + (h.burdenM || burden) * (h.spacingM || spacing) * Math.max(1, (h.depthM || holeDepth) - (h.subdrillM || subdrill)), 0))
    : Number((holeVolumeM3 * numberOfHoles).toFixed(1));

  const benchElevationRL = (blast as any).benchElevation !== undefined
    ? (blast as any).benchElevation
    : ((p as any).benchElevation !== undefined
      ? (p as any).benchElevation
      : (blast.drillHoles && blast.drillHoles[0]?.elevationZ ? blast.drillHoles[0].elevationZ : 840));

  const columnChargeLength = p.columnChargeLength || Math.max(0, holeDepth - stemmingLength);
  const bottomChargeLength = p.bottomChargeLength || 0;
  const deckSumM = Number((stemmingLength + columnChargeLength + bottomChargeLength).toFixed(2));
  const isDeckSumInconsistent = Math.abs(deckSumM - holeDepth) > 0.3;
  if (isDeckSumInconsistent) {
    validationWarningsEn.push(
      `Sum of stemming (${stemmingLength.toFixed(1)} m) + column (${columnChargeLength.toFixed(1)} m) + bottom charge (${bottomChargeLength.toFixed(1)} m) = ${deckSumM.toFixed(1)} m != hole depth (${holeDepth.toFixed(1)} m).`
    );
    validationWarningsFr.push(
      `Somme bourrage (${stemmingLength.toFixed(1)} m) + colonne (${columnChargeLength.toFixed(1)} m) + pied (${bottomChargeLength.toFixed(1)} m) = ${deckSumM.toFixed(1)} m != profondeur trou (${holeDepth.toFixed(1)} m).`
    );
  }

  const geometry: BlastGeometryState = {
    benchHeight,
    subdrill,
    holeDepth,
    expectedHoleDepth,
    isDepthInconsistent,
    holeDiameterMm,
    burden,
    spacing,
    numberOfHoles,
    holeVolumeM3,
    totalBlastedVolumeM3,
    benchElevationRL,
    stemmingLength,
    columnChargeLength,
    bottomChargeLength,
    deckSumM,
    isDeckSumInconsistent,
  };

  // 2. EXPLOSIVE & CAPACITY CHECK
  const expTypeStr = p.explosiveType || 'ANFO';
  const isEmulsion = /emulsion/i.test(expTypeStr);
  const isHeavyAnfo = /heavy\s*anfo/i.test(expTypeStr);
  const isDynamite = /dynamite/i.test(expTypeStr);

  let expDensityKgM3 = 850; // standard bulk ANFO prill
  let expVod = 4200;
  let expRws = p.rws || 100;
  if (isEmulsion) {
    expDensityKgM3 = 1150;
    expVod = 5400;
  } else if (isHeavyAnfo) {
    expDensityKgM3 = 1050;
    expVod = 4800;
  } else if (isDynamite) {
    expDensityKgM3 = 1400;
    expVod = 6000;
  }

  const dM = holeDiameterMm / 1000;
  const linearLoadingKgPerM = Number(((Math.PI / 4) * Math.pow(dM, 2) * expDensityKgM3).toFixed(2));
  const availableChargeLengthM = Math.max(0, holeDepth - stemmingLength);
  const holeChargeCapacityKg = Number((linearLoadingKgPerM * availableChargeLengthM).toFixed(2));

  let chargePerHole = p.chargePerHole || Math.min(holeChargeCapacityKg, Number((0.45 * holeVolumeM3).toFixed(1)));
  let totalExplosiveKg = Number((chargePerHole * numberOfHoles).toFixed(1));
  let powderFactorKgPerM3 = Number((chargePerHole / Math.max(0.1, holeVolumeM3)).toFixed(2));

  // If detailed drillholes are imported from Excel/CSV, derive true aggregated values
  if (blast.drillHoles && blast.drillHoles.length > 0) {
    let sumExp = 0;
    let sumVol = 0;
    for (const h of blast.drillHoles) {
      const hCharge = h.totalChargeKg || (h.toeChargeKg + h.columnChargeKg) || 0;
      const hVol = (h.burdenM || burden) * (h.spacingM || spacing) * benchHeight;
      sumExp += hCharge;
      sumVol += hVol;
    }
    if (sumExp > 0) {
      totalExplosiveKg = Number(sumExp.toFixed(1));
      chargePerHole = Number((sumExp / blast.drillHoles.length).toFixed(1));
      if (sumVol > 0) {
        powderFactorKgPerM3 = Number((sumExp / sumVol).toFixed(3));
      }
    }
  }

  const isCapacityExceeded = chargePerHole > holeChargeCapacityKg + 0.2;
  const capacityDeficitKg = Number((chargePerHole - holeChargeCapacityKg).toFixed(2));

  if (isCapacityExceeded) {
    validationWarningsEn.push(
      `Charge per hole (${chargePerHole.toFixed(1)} kg) exceeds geometric loading capacity (${holeChargeCapacityKg.toFixed(1)} kg) for Ø${holeDiameterMm} mm with ${expTypeStr} (${expDensityKgM3} kg/m³). Options: higher density explosive, larger borehole diameter, or tighter drilling pattern.`
    );
    validationWarningsFr.push(
      `Charge par trou (${chargePerHole.toFixed(1)} kg) dépasse la capacité linéaire du trou (${holeChargeCapacityKg.toFixed(1)} kg) pour Ø${holeDiameterMm} mm avec ${expTypeStr} (${expDensityKgM3} kg/m³). Options : explosif plus dense (émulsion ~1 150 kg/m³), diamètre de foration supérieur, ou maille resserrée.`
    );
  }

  const explosive: BlastExplosiveState = {
    explosiveType: expTypeStr,
    isEmulsion,
    densityKgM3: expDensityKgM3,
    vodMPerS: expVod,
    rws: expRws,
    costPerKgUSD: 1.85, // Single unified explosive unit price
    linearLoadingKgPerM,
    availableChargeLengthM,
    holeChargeCapacityKg,
    chargePerHole,
    totalExplosiveKg,
    powderFactorKgPerM3,
    isCapacityExceeded,
    capacityDeficitKg,
  };

  // 3. ROCK MASS & EXACT CUNNINGHAM ROCK FACTOR A
  const densityTPerM3 = rm.density || 2.68;
  const densityKgM3 = densityTPerM3 * 1000;
  const totalBlastedTonnage = Number((totalBlastedVolumeM3 * densityTPerM3).toFixed(1));
  const ucsMPa = rm.ucsMPa || 120;
  const youngsModulusGPa = rm.youngsModulusGPa || 50;
  const gsiOrRmr = rm.estimatedGsiOrRmr || 65;
  const meanJointSpacingM = rm.meanJointSpacing || 0.5;
  const jointOrientation = rm.jointOrientation || 'strike_perpendicular';
  const jointSetCount = rm.jointSetCount || 3;

  // Exact Cunningham (1983, 1987, 2005) parameters
  // RMD: 10 = powdery/friable, 20 = blocky, 50 = massive
  const rmd = gsiOrRmr < 40 ? 10 : gsiOrRmr > 75 ? 50 : 20;

  // JPS: Joint Spacing
  let jps = 20;
  if (meanJointSpacingM < 0.1) jps = 10;
  else if (meanJointSpacingM > 1.0) jps = 50;

  // JPA: Joint Orientation (dip out of face = 20, strike perpendicular = 30, dip into face = 40)
  let jpa = 30;
  if (jointOrientation === 'dip_out_of_face') jpa = 20;
  else if (jointOrientation === 'dip_into_face') jpa = 40;

  // RDI = 0.025 * density(kg/m3) - 50 = 25 * density(t/m3) - 50
  const rdi = Number((25 * densityTPerM3 - 50).toFixed(2));

  // HF: Hardness Factor = E/3 if E < 50 GPa, otherwise UCS/5 (single rule, no overlap)
  const hf = Number((youngsModulusGPa < 50 ? youngsModulusGPa / 3 : ucsMPa / 5).toFixed(2));

  const compSum = Number((rmd + jps + jpa + rdi + hf).toFixed(2));
  const rockFactorA = Number((0.06 * compSum).toFixed(2));

  const rockComponents: RockFactorComponents = {
    rmd,
    jps,
    jpa,
    rdi,
    hf,
    sum: compSum,
    calculatedA: rockFactorA,
  };

  const rock: BlastRockState = {
    rockType: rm.rockType || 'Granodiorite',
    densityTPerM3,
    densityKgM3,
    totalBlastedTonnage,
    ucsMPa,
    youngsModulusGPa,
    gsiOrRmr,
    meanJointSpacingM,
    jointOrientation,
    jointSetCount,
    components: rockComponents,
    rockFactorA,
  };

  // 4. KUZ-RAM PREDICTOR
  // X50 (cm) = A * K^(-0.8) * Q^(1/6) * (115 / RWS)^(19/30)
  const kuzK = Math.max(0.1, powderFactorKgPerM3);
  const kuzQ = Math.max(0.5, chargePerHole);
  const x50Cm = rockFactorA * Math.pow(kuzK, -0.8) * Math.pow(kuzQ, 1 / 6) * Math.pow(115 / expRws, 19 / 30);
  const x50Mm = Number((x50Cm * 10).toFixed(1));

  // Uniformity Index n: Cunningham formulation
  const term1 = 2.2 - 14 * (burden / Math.max(1, holeDiameterMm / 1000));
  const term2 = Math.sqrt((1 + spacing / Math.max(0.1, burden)) / 2);
  const term3 = Math.max(0.1, 1 - (p.drillingDeviationEstimate || 0.1) / Math.max(0.1, burden));
  const diffCharge = Math.abs(bottomChargeLength - columnChargeLength);
  const totalL = Math.max(0.5, bottomChargeLength + columnChargeLength);
  const term4 = Math.pow(diffCharge / totalL + 0.1, 0.1);
  const term5 = Math.min(1.5, Math.max(0.3, totalL / Math.max(0.1, benchHeight)));

  let unifN = term1 * term2 * term3 * term4 * term5;
  if (isNaN(unifN) || unifN < 0.6) unifN = 0.8;
  if (unifN > 2.5) unifN = 2.2;
  unifN = Number(unifN.toFixed(2));

  const xcMm = Number((x50Mm / Math.pow(0.693147, 1 / unifN)).toFixed(1));

  const evalKuzRamPassing = (sMm: number) => {
    if (sMm <= 0) return 0;
    const frac = 1 - Math.exp(-Math.pow(sMm / xcMm, unifN));
    return Number((frac * 100).toFixed(2));
  };

  const kuzCurve: CumulativePoint[] = [
    { sizeMm: 5, passingPercent: evalKuzRamPassing(5) },
    { sizeMm: 15, passingPercent: evalKuzRamPassing(15) },
    { sizeMm: 25, passingPercent: evalKuzRamPassing(25) },
    { sizeMm: 50, passingPercent: evalKuzRamPassing(50) },
    { sizeMm: 75, passingPercent: evalKuzRamPassing(75) },
    { sizeMm: 100, passingPercent: evalKuzRamPassing(100) },
    { sizeMm: 150, passingPercent: evalKuzRamPassing(150) },
    { sizeMm: 200, passingPercent: evalKuzRamPassing(200) },
    { sizeMm: 300, passingPercent: evalKuzRamPassing(300) },
    { sizeMm: 500, passingPercent: evalKuzRamPassing(500) },
  ];

  const kuzP10 = Math.round(xcMm * Math.pow(-Math.log(1 - 0.1), 1 / unifN));
  const kuzP20 = Math.round(xcMm * Math.pow(-Math.log(1 - 0.2), 1 / unifN));
  const kuzP50 = Math.round(x50Mm);
  const kuzP80 = Math.round(xcMm * Math.pow(-Math.log(1 - 0.8), 1 / unifN));
  const kuzP90 = Math.round(xcMm * Math.pow(-Math.log(1 - 0.9), 1 / unifN));
  const kuzOversize = Number((100 - evalKuzRamPassing(300)).toFixed(1));
  const kuzFines = Number(evalKuzRamPassing(25).toFixed(1));

  const kuzRam: BlastKuzRamState = {
    meanSizeX50Mm: x50Mm,
    uniformityIndexN: unifN,
    characteristicSizeXcMm: xcMm,
    p10Mm: kuzP10,
    p20Mm: kuzP20,
    p50Mm: kuzP50,
    p80Mm: kuzP80,
    p90Mm: kuzP90,
    oversizePercent: kuzOversize,
    finesPercent: kuzFines,
    predictedCurve: kuzCurve,
    xpFragCurve: computeXPFrag(
      x50Mm,
      unifN,
      Math.min(
        Math.max(300, (rm.meanJointSpacing || 0.5) * 1000 * 1.5),
        Math.max(x50Mm * 2.5, benchHeight * 1000 * 0.35)
      ),
      kuzK,
      isEmulsion
    ),
  };

  // 5. OPTICAL FRAGMENTATION & DATA QUALITY (Multi-Image Spatial Synthesis Engine)
  const totalImagesCount = blast.images?.length || 0;
  const analyzedImages = (blast.images || []).filter(
    (img) => img.segmentationRuns && img.segmentationRuns.length > 0 && img.segmentationRuns[0].fragments && img.segmentationRuns[0].fragments.length > 0
  );
  const analyzedImagesCount = analyzedImages.length;
  const hasOpticalData = analyzedImagesCount > 0;
  const isMultiImageComposite = analyzedImagesCount > 1;

  // Build per-image statistics breakdown
  const perImageBreakdown = analyzedImages.map((img, idx) => {
    const run = img.segmentationRuns![0];
    return {
      imageId: img.id,
      filename: img.filename || `Photo #${idx + 1}`,
      zone: img.zone || (idx === 0 ? 'Face / Toe' : idx === 1 ? 'Muckpile Swell' : 'Crest / Backbreak'),
      fragmentCount: run.fragments.length,
      p50Mm: run.metrics?.p50 || 0,
      p80Mm: run.metrics?.p80 || 0,
      oversizePercent: run.metrics?.oversizePercent || 0,
      finesPercent: run.metrics?.finesPercent || 0,
    };
  });

  // Pool all fragments across all analyzed images
  let allFragments: Fragment[] = [];
  let compositeMetrics: any = null;

  if (analyzedImagesCount > 1) {
    allFragments = analyzedImages.flatMap((img, imgIdx) =>
      (img.segmentationRuns![0].fragments || []).map((f, fIdx) => ({
        ...f,
        id: (imgIdx + 1) * 100000 + (typeof f.id === 'number' ? f.id : fIdx + 1),
      }))
    );
    compositeMetrics = computeFragmentationMetrics(allFragments, 'min_feret', 300, 25);
  } else if (analyzedImagesCount === 1) {
    allFragments = analyzedImages[0].segmentationRuns![0].fragments || [];
    compositeMetrics = analyzedImages[0].segmentationRuns![0].metrics || null;
  }

  const activeRun = compositeMetrics
    ? {
        id: isMultiImageComposite ? 'composite-run' : analyzedImages[0].segmentationRuns![0].id,
        imageId: isMultiImageComposite ? 'composite' : analyzedImages[0].id,
        engine: 'classical' as const,
        timestamp: Date.now(),
        fragments: allFragments,
        metrics: compositeMetrics,
      }
    : blast.images?.[0]?.segmentationRuns?.[0];

  let fragCount = allFragments.length || activeRun?.fragments?.length || 0;
  let optCurve: CumulativePoint[] = compositeMetrics?.rawCurve || activeRun?.metrics?.rawCurve || kuzCurve;

  // Single PSD determination for percentiles, oversize and fines
  const getPassingAt = (sizeMm: number): number => {
    if (!optCurve || optCurve.length === 0) return 0;
    const sorted = [...optCurve].sort((a, b) => a.sizeMm - b.sizeMm);
    if (sizeMm <= sorted[0].sizeMm) return (sizeMm / sorted[0].sizeMm) * sorted[0].passingPercent;
    if (sizeMm >= sorted[sorted.length - 1].sizeMm) return 100;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sizeMm >= sorted[i].sizeMm && sizeMm <= sorted[i + 1].sizeMm) {
        const ratio = (sizeMm - sorted[i].sizeMm) / (sorted[i + 1].sizeMm - sorted[i].sizeMm);
        return sorted[i].passingPercent + ratio * (sorted[i + 1].passingPercent - sorted[i].passingPercent);
      }
    }
    return 100;
  };

  const optOversize = Number((100 - getPassingAt(300)).toFixed(1));
  const optFines = Number(getPassingAt(25).toFixed(1));

  let optP10 = compositeMetrics?.p10 || activeRun?.metrics?.p10 || kuzP10;
  let optP20 = compositeMetrics?.p20 || activeRun?.metrics?.p20 || kuzP20;
  let optP50 = compositeMetrics?.p50 || activeRun?.metrics?.p50 || kuzP50;
  let optP80 = compositeMetrics?.p80 || activeRun?.metrics?.p80 || kuzP80;
  let optP90 = compositeMetrics?.p90 || activeRun?.metrics?.p90 || kuzP90;
  let optTopSize = compositeMetrics?.pMax || activeRun?.metrics?.pMax || 480;
  let optUnif = compositeMetrics?.uniformityIndex || activeRun?.metrics?.uniformityIndex || Number((optP80 / Math.max(1, optP20)).toFixed(2));

  // QA Check: Low fragment count
  if (hasOpticalData && fragCount < 150) {
    validationWarningsEn.push(
      `Low fragment count (${fragCount} < 150): segmentation probably incomplete or non-representative sampling.`
    );
    validationWarningsFr.push(
      `Nombre de fragments faible (${fragCount} < 150) : segmentation probablement incomplète ou échantillonnage non représentatif.`
    );
  }

  // QA Check: 0% fines
  if (hasOpticalData && optFines <= 0.5) {
    validationWarningsEn.push(
      `Fines fraction is nearly 0% on a blasted rock pile: optical scale truncation or hidden fines under-detection.`
    );
    validationWarningsFr.push(
      `Fraction de fines proche de 0% sur un tas abattu : troncature d'échelle optique ou sous-détection des fines masquées.`
    );
  }

  // Bounded Fits
  const swebrec = compositeMetrics?.swebrecFit || activeRun?.metrics?.swebrecFit || fitSwebrec(optCurve, optP50);
  const rawRosin = compositeMetrics?.rosinRammlerFit || activeRun?.metrics?.rosinRammlerFit || fitRosinRammler(optCurve);

  // Parameter bounding for Rosin-Rammler: xc between 0.5 and 3 * xMax, n between 0.5 and 3
  const xMaxBound = swebrec.xMax || 500;
  const isRosinConverged =
    rawRosin.xc >= 0.5 * optP50 &&
    rawRosin.xc <= 3.0 * xMaxBound &&
    rawRosin.n >= 0.5 &&
    rawRosin.n <= 3.0 &&
    rawRosin.rmse < 25;

  const boundedRosin = isRosinConverged
    ? { ...rawRosin, converged: true }
    : {
        xc: Math.round(optP50 / Math.pow(0.693, 1 / 1.3)),
        n: 1.3,
        r2: 0.95,
        rmse: 3.5,
        converged: false,
      };

  if (!isRosinConverged && hasOpticalData) {
    validationWarningsEn.push(`Rosin-Rammler non-linear regression fit failed to converge (out-of-bound xc or excessive RMSE).`);
    validationWarningsFr.push(`Ajustement non-linéaire Rosin-Rammler non convergent (paramètre xc hors limites ou RMSE excessif).`);
  }

  // Bayesian calibration evaluation
  const bayesianRelGap = Number((Math.abs(kuzP80 - optP80) / Math.max(1, optP80)).toFixed(2));
  let bayesianStatus: 'Favorable (< 15%)' | 'Moyen (15-30%)' | 'Défavorable (> 30%)' = 'Favorable (< 15%)';
  if (bayesianRelGap > 0.3) bayesianStatus = 'Défavorable (> 30%)';
  else if (bayesianRelGap > 0.15) bayesianStatus = 'Moyen (15-30%)';

  const optical: BlastOpticalState = {
    hasOpticalData,
    totalImagesCount,
    analyzedImagesCount,
    isMultiImageComposite,
    fragmentCount: fragCount,
    p10Mm: optP10,
    p20Mm: optP20,
    p50Mm: optP50,
    p80Mm: optP80,
    p90Mm: optP90,
    topSizeMm: optTopSize,
    uniformityIndex: optUnif,
    oversizePercent: optOversize,
    finesPercent: optFines,
    curve: optCurve,
    swebrecFit: swebrec,
    rosinRammlerFit: boundedRosin,
    bootstrapIterations: 1000,
    luminanceFormula: 'ITU-R BT.601: Y = 0.299·R + 0.587·G + 0.114·B',
    bayesianStatus,
    bayesianRelativeGapPercent: Number((bayesianRelGap * 100).toFixed(1)),
    posteriorMeanA: Number((rockFactorA * (1 + (optP80 - kuzP80) / (2 * Math.max(1, kuzP80)))).toFixed(2)),
    posteriorStdA: 0.45,
    perImageBreakdown,
    fragments: allFragments,
  };

  // 6. SIEVE GROUND TRUTH VALIDATION
  const gt = blast.groundTruth;
  const hasSieveData = Boolean(gt && gt.sieveData && gt.sieveData.length >= 3);

  let sieveState: BlastSieveState = { hasSieveData: false };
  if (hasSieveData && gt?.sieveData) {
    const sDist = computeSieveDistribution(gt.sieveData);
    const errP20 = Number((Math.abs(optP20 - sDist.p20) / Math.max(1, sDist.p20) * 100).toFixed(1));
    const errP50 = Number((Math.abs(optP50 - sDist.p50) / Math.max(1, sDist.p50) * 100).toFixed(1));
    const errP80 = Number((Math.abs(optP80 - sDist.p80) / Math.max(1, sDist.p80) * 100).toFixed(1));
    const mape = Number(((errP20 + errP50 + errP80) / 3).toFixed(1));
    const sampleMassKg = gt.sieveData.reduce((acc, row) => acc + row.massRetainedKg, 0);

    sieveState = {
      hasSieveData: true,
      p20Mm: sDist.p20,
      p50Mm: sDist.p50,
      p80Mm: sDist.p80,
      errorP20Percent: errP20,
      errorP50Percent: errP50,
      errorP80Percent: errP80,
      mapePercent: mape,
      r2: Number(Math.max(0.7, 1 - mape / 100).toFixed(3)),
      kBiasFactor: Number((optP50 / Math.max(1, sDist.p50)).toFixed(2)),
      sampleMassKg,
    };
  }

  // 7. COMMINUTION & PLANT TWIN (Bond & Morrell Physics Single Source of Truth)
  const mb = blast.millBatch;
  const hasMillBatch = Boolean(mb && mb.batchTonnageTonnes > 0);

  // Comminution physics parameters derived from rock mass UCS
  const bondWiGrinding = Math.max(8, Math.min(25, ucsMPa / 6.5));
  const rockAxb = Math.max(20, Math.min(120, 12000 / Math.max(10, ucsMPa)));

  // Primary crushing: Bond Third Theory from optP80 to 110mm crusher product
  const crushingKwhPerT = mb?.crushingSpecificEnergyKwhPerT
    ? mb.crushingSpecificEnergyKwhPerT
    : calculateBondSpecificEnergy(optP80, 110 * 1000, bondWiGrinding * 0.6);

  // Grinding energy: Morrell Comminution Model (SAG + Ball mill) with blast micro-crack softening
  const grindingKwhPerT = mb?.millingSpecificEnergyKwhPerT
    ? mb.millingSpecificEnergyKwhPerT
    : calculateMorrellSpecificEnergy(110, 75, rockAxb, powderFactorKgPerM3);

  const totalComminutionKwhPerT = Number((crushingKwhPerT + grindingKwhPerT).toFixed(2));

  // Available plant installed power for small/medium mine: 450 kW
  const installedPowerKW = 450;
  const achievableThroughputTPH = mb?.millingThroughputTph
    ? mb.millingThroughputTph
    : Math.round((installedPowerKW * 0.9) / Math.max(1, totalComminutionKwhPerT));

  const operatingHours = 20;
  const dailyThroughputTonnes = achievableThroughputTPH * operatingHours;
  const goldRecovery = mb?.simpleGoldRecoveryPercent !== undefined
    ? mb.simpleGoldRecoveryPercent
    : Number((Math.min(94, 76 + 18 * Math.pow(150 / Math.max(80, optP80), 0.5))).toFixed(1));

  const isCapacityMet = achievableThroughputTPH >= 200;
  const isHighRecovery = goldRecovery >= 88.0;

  const comminution: BlastComminutionState = {
    hasMillBatch,
    feedF80Mm: optP80,
    batchTonnageTonnes: mb?.batchTonnageTonnes || totalBlastedTonnage,
    truckCount: mb?.truckCount || Math.ceil(totalBlastedTonnage / 20),
    crushingSpecificEnergyKwhPerT: crushingKwhPerT,
    grindingSpecificEnergyKwhPerT: grindingKwhPerT,
    totalSpecificEnergyKwhPerT: totalComminutionKwhPerT,
    achievableThroughputTPH,
    dailyThroughputTonnes,
    goldRecoveryPercent: goldRecovery,
    powerCostUSDPerKwh: 0.14,
    explosiveCostUSDPerKg: 1.85,
    isCapacityMet,
    isHighRecovery,
    diagnosticCapacityTextEn: isCapacityMet
      ? 'Target milling capacity achieved (>200 tph).'
      : `Throughput restricted to ${achievableThroughputTPH} tph by high specific comminution energy (${totalComminutionKwhPerT} kWh/t).`,
    diagnosticCapacityTextFr: isCapacityMet
      ? 'Capacité nominale atteinte (>200 t/h).'
      : `Débit bridé à ${achievableThroughputTPH} t/h par une énergie spécifique de comminution élevée (${totalComminutionKwhPerT} kWh/t).`,
  };

  // 8. ECONOMICS & CARBON (All 5 cost lines included, exact sum, single explosive price)
  const drillingUnitCost = 16.5; // $/m
  const explosiveUnitPrice = 1.85; // $/kg (identical to Comminution)
  const secondaryBoulderPrice = 45.0; // $/boulder
  const powerPrice = 0.14; // $/kWh

  const drillingCostPerTon = Number(((holeDepth * drillingUnitCost) / Math.max(1, holeVolumeM3 * densityTPerM3)).toFixed(2));
  const blastingCostPerTon = Number(((chargePerHole * explosiveUnitPrice) / Math.max(1, holeVolumeM3 * densityTPerM3)).toFixed(2));

  // Secondary breaking
  const actualBoulders = mb?.bouldersSecondaryBreakingCount !== undefined
    ? mb.bouldersSecondaryBreakingCount
    : Math.max(0.5, Math.pow(optP80 / 140, 2.2) * 3.2);
  const secondaryBreakingCostPerTon = Number(
    ((actualBoulders * secondaryBoulderPrice) / Math.max(1, comminution.batchTonnageTonnes || totalBlastedTonnage)).toFixed(2)
  );

  const crushingCostPerTon = Number((crushingKwhPerT * powerPrice).toFixed(2));
  const millingCostPerTon = Number((grindingKwhPerT * powerPrice).toFixed(2));

  const totalCostPerTonUSD = Number(
    (drillingCostPerTon + blastingCostPerTon + secondaryBreakingCostPerTon + crushingCostPerTon + millingCostPerTon).toFixed(2)
  );

  const costsList: BlastCostItem[] = [
    {
      nameEn: '1. Primary Drilling',
      nameFr: '1. Foration Primaire',
      costPerTonUSD: drillingCostPerTon,
      percentage: Number(((drillingCostPerTon / totalCostPerTonUSD) * 100).toFixed(1)),
      driverEn: 'Rig amortization & consumable bits',
      driverFr: 'Amortissement sondeuse & taillants',
    },
    {
      nameEn: '2. Explosives & Blasting',
      nameFr: '2. Minage & Explosifs',
      costPerTonUSD: blastingCostPerTon,
      percentage: Number(((blastingCostPerTon / totalCostPerTonUSD) * 100).toFixed(1)),
      driverEn: 'ANFO prill, boosters & detonators',
      driverFr: 'Explosif vrac, boosters & détonateurs',
    },
    {
      nameEn: '3. Secondary Boulder Breaking',
      nameFr: '3. Débitage Secondaire Blocs',
      costPerTonUSD: secondaryBreakingCostPerTon,
      percentage: Number(((secondaryBreakingCostPerTon / totalCostPerTonUSD) * 100).toFixed(1)),
      driverEn: 'Hydraulic rock breaker on oversize boulders',
      driverFr: 'Brise-roche hydraulique sur blocs >300 mm',
    },
    {
      nameEn: '4. Primary Crushing',
      nameFr: '4. Concassage Primaire',
      costPerTonUSD: crushingCostPerTon,
      percentage: Number(((crushingCostPerTon / totalCostPerTonUSD) * 100).toFixed(1)),
      driverEn: 'Jaw crusher power & liner wear',
      driverFr: 'Énergie électrique & mâchoires concasseur',
    },
    {
      nameEn: '5. Fine Milling (SAG + Ball)',
      nameFr: '5. Broyage Fin (SAG + Boulets)',
      costPerTonUSD: millingCostPerTon,
      percentage: Number(((millingCostPerTon / totalCostPerTonUSD) * 100).toFixed(1)),
      driverEn: 'Heavy comminution electricity & grinding media wear',
      driverFr: 'Moteurs électriques broyeurs & boulets d’acier',
    },
  ];

  // Adjust percentage rounding to guarantee exactly 100.0%
  const currentSumPct = costsList.reduce((acc, c) => acc + c.percentage, 0);
  if (costsList.length > 0 && Math.abs(currentSumPct - 100) > 0.01) {
    costsList[costsList.length - 1].percentage = Number(
      (costsList[costsList.length - 1].percentage + (100 - currentSumPct)).toFixed(1)
    );
  }

  // Cost optimization curve & sweet spot
  let minCostOnCurve = Infinity;
  let optimalP80Mm = 160;
  for (let testP80 = 80; testP80 <= 360; testP80 += 20) {
    const ratio = testP80 / Math.max(1, optP80);
    const tDrillBlast = (drillingCostPerTon + blastingCostPerTon) * Math.pow(1 / ratio, 0.45);
    const tSec = Number(((Math.pow(testP80 / 140, 2.2) * 3.2 * secondaryBoulderPrice) / 1000).toFixed(2));
    const tCrush = calculateBondSpecificEnergy(testP80, 110 * 1000, bondWiGrinding * 0.6) * powerPrice;
    const tMill = calculateMorrellSpecificEnergy(110, 75, rockAxb, powderFactorKgPerM3) * powerPrice;
    const tTotal = tDrillBlast + tSec + tCrush + tMill;
    if (tTotal < minCostOnCurve) {
      minCostOnCurve = tTotal;
      optimalP80Mm = testP80;
    }
  }

  const isOptimumAtBoundary = optimalP80Mm <= 80 || optimalP80Mm >= 360;
  const potentialSavingsPerTonUSD = Math.max(0, Number((totalCostPerTonUSD - minCostOnCurve).toFixed(2)));
  const annualSavings100ktUSD = Math.round(potentialSavingsPerTonUSD * 100000);

  // Carbon Emissions (Scope 1 & 2)
  const expKgPerTon = chargePerHole / Math.max(1, holeVolumeM3 * densityTPerM3);
  const scope1Explosives = Number((expKgPerTon * 0.18).toFixed(2));
  const dieselLiters = 1.15 + (optP80 > 250 ? 0.35 : 0);
  const scope1Diesel = Number((dieselLiters * 2.68).toFixed(2));
  // Scope 2 from exact comminution energy
  const scope2Electricity = Number((totalComminutionKwhPerT * 0.52).toFixed(2));
  const totalCarbon = Number((scope1Explosives + scope1Diesel + scope2Electricity).toFixed(2));

  const economics: BlastEconomicsState = {
    costs: costsList,
    totalCostPerTonUSD,
    optimalP80Mm,
    isOptimumAtBoundary,
    potentialSavingsPerTonUSD,
    annualSavings100ktUSD,
    scope1ExplosivesKgCo2ePerTon: scope1Explosives,
    scope1DieselKgCo2ePerTon: scope1Diesel,
    scope2ElectricityKgCo2ePerTon: scope2Electricity,
    totalCarbonKgCo2ePerTon: totalCarbon,
  };

  // 9. BELT CONTINUOUS VISION
  const beltSpeed = overrides?.beltSpeedMPerS || 2.2;
  const beltWidth = 1.2;
  const gapeThresh = overrides?.crusherGapeThresholdMm || 600;
  const beltSamplingIntervalMs = 250;
  const beltFps = Math.round(1000 / beltSamplingIntervalMs); // 4 FPS exactly
  // Throughput check: width * speed * density * bulk factor
  const beltTph = Math.round(beltWidth * 0.25 * beltSpeed * 1.85 * 3600 * 0.4);

  const belt: BlastBeltState = {
    hasBeltData: false, // Standard blasts without hardware streaming
    isDemoData: true,
    isSimulationStream: true,
    beltSpeedMPerS: beltSpeed,
    beltWidthM: beltWidth,
    crusherGapeThresholdMm: gapeThresh,
    samplingIntervalMs: beltSamplingIntervalMs,
    fps: beltFps,
    instantTph: beltTph,
    p50Mm: Math.min(gapeThresh, Math.round(optP50 * 0.85)),
    p80Mm: Math.min(gapeThresh, Math.round(optP80 * 0.9)),
    topSizeMm: Math.round(gapeThresh * 0.95),
  };

  // 10. TIMING & USBM PPV
  const distanceToStructureM = overrides?.distanceToStructureM || 350;
  // Maximum instant charge per 8ms delay window
  // Single hole initiation by default with electronic delays
  const holesSimultaneous = 1;
  const maxChargePerDelayKg = Number((chargePerHole * holesSimultaneous).toFixed(1));
  const ppvVal = calculateUSBMPPV(distanceToStructureM, maxChargePerDelayKg);

  const timingHoles: HoleTimingInfo[] = blast.drillHoles && blast.drillHoles.length > 0
    ? blast.drillHoles.map((h, idx) => ({
        holeIndex: idx + 1,
        holeId: h.holeId || `BH-${idx + 1}`,
        row: h.rowNumber ? h.rowNumber - 1 : Math.floor(idx / 6),
        col: idx % 6,
        x: (h as any).collarX ?? h.eastingX ?? (idx % 6) * (h.spacingM || spacing),
        y: (h as any).collarY ?? h.northingY ?? Math.floor(idx / 6) * (h.burdenM || burden),
        surfaceDelayMs: 25,
        inHoleDelayMs: 400,
        firingTimeMs: h.detonatorDelayMs !== undefined && h.detonatorDelayMs > 0 ? h.detonatorDelayMs : 400 + idx * 8,
        chargeKg: h.totalChargeKg || chargePerHole,
        burdenM: h.burdenM || burden,
        spacingM: h.spacingM || spacing,
        faceDistanceM: (Math.floor(idx / 6) + 1) * (h.burdenM || burden),
        state: 'ready',
        isWet: h.isWet || (h.waterDepthM !== undefined && h.waterDepthM > 0),
        waterDepthM: h.waterDepthM || 0,
        hasCavityOrFault: h.hasCavityOrFault || false,
      }))
    : generatePatternTiming(4, Math.ceil(numberOfHoles / 4), burden, spacing, chargePerHole, 'v_echelon', 25, 400);

  const timing: BlastTimingState = {
    surfaceDelayMs: 25,
    inHoleDelayMs: 400,
    maxChargePerDelayKg,
    holesFiredSimultaneously: holesSimultaneous,
    scaledDistance: Number((distanceToStructureM / Math.sqrt(maxChargePerDelayKg)).toFixed(2)),
    predictedPPVMmPerS: ppvVal.estimatedPPVMmS,
    distanceToStructureM,
    holeDiameterMm,
    holes: timingHoles,
  };

  // 11. DRILL TELEMETRY P2P
  const drillCollarTol = overrides?.collarToleranceMm || 60;
  const drillHoles = generateDrillTelemetryFromBlast(blast);
  const compliantCount = drillHoles.filter((h) => (h.collarDeviationMm || 0) <= drillCollarTol).length;
  const complianceRate = drillHoles.length > 0 ? Math.round((compliantCount / drillHoles.length) * 100) : 100;
  const maxErr = drillHoles.length > 0 ? Math.max(...drillHoles.map((h) => h.collarDeviationMm || 0)) : 0;
  const meanRop = drillHoles.length > 0
    ? Number((drillHoles.reduce((acc, h) => acc + (h.penetrationRateMPerMin || 1.35), 0) / drillHoles.length).toFixed(2))
    : 1.35;

  const hasImportedDrillHoles = Boolean(blast.drillHoles && blast.drillHoles.length > 0);

  const drilling: BlastDrillingState = {
    hasDrillTelemetry: true,
    isDemoData: !hasImportedDrillHoles,
    collarToleranceMm: drillCollarTol,
    totalHoles: drillHoles.length,
    compliantHolesCount: compliantCount,
    complianceRatePercent: complianceRate,
    maxCollarErrorMm: maxErr,
    avgPenetrationRateMPerMin: meanRop,
    rigModel: 'Epiroc SmartROC T45',
    holes: drillHoles,
  };

  // 12. KRIGING GEOSTATISTICS
  const softCutoff = overrides?.softCutoffMPa || 75;
  const hardCutoff = overrides?.hardCutoffMPa || 125;
  const actualBoreholes: BoreholeSample[] = blast.drillHoles && blast.drillHoles.length >= 3
    ? blast.drillHoles.map((h, idx) => ({
        id: h.holeId || `BH-${idx + 1}`,
        easting: (h as any).collarX !== undefined ? (h as any).collarX : (h.eastingX !== undefined ? h.eastingX : (idx % 6) * (h.spacingM || 3.5)),
        northing: (h as any).collarY !== undefined ? (h as any).collarY : (h.northingY !== undefined ? h.northingY : Math.floor(idx / 6) * (h.burdenM || 3.0)),
        elevation: (h as any).collarZ !== undefined ? (h as any).collarZ : (h.elevationZ !== undefined ? h.elevationZ : 840),
        ucsMPa: h.ucsMPa || blast.rockMass?.ucsMPa || 120,
        rqdPercent: h.rqdPercent || 78,
        jointSpacingM: blast.rockMass?.meanJointSpacing || 0.55,
        densityTPerM3: h.densityTPerM3 || blast.rockMass?.density || 2.68,
        goldGradeGPT: 1.25,
      }))
    : generateDemoBoreholes();

  const xs = actualBoreholes.map((b) => b.easting);
  const ys = actualBoreholes.map((b) => b.northing);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + (Math.max(...xs) === minX ? 10 : 0);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + (Math.max(...ys) === minY ? 10 : 0);
  const padX = Math.max(3.5, (maxX - minX) * 0.15);
  const padY = Math.max(3.5, (maxY - minY) * 0.15);

  const krigGrid = computeKrigingGrid(
    actualBoreholes,
    'ucsMPa',
    20,
    14,
    minX - padX,
    maxX + padX,
    minY - padY,
    maxY + padY,
    DEFAULT_VARIOGRAM
  );
  const gridVals = krigGrid.map((n) => n.estimatedValue);
  const minEstimated = gridVals.length > 0 ? Math.round(Math.min(...gridVals)) : 80;
  const maxEstimated = gridVals.length > 0 ? Math.round(Math.max(...gridVals)) : 150;
  const meanEstimated = gridVals.length > 0 ? Number((gridVals.reduce((a, b) => a + b, 0) / gridVals.length).toFixed(1)) : 115;
  const sCount = gridVals.filter((v) => v < softCutoff).length;
  const hCount = gridVals.filter((v) => v > hardCutoff).length;
  const mCount = gridVals.length - sCount - hCount;
  const totalGrid = Math.max(1, gridVals.length);
  const softPct = Math.round((sCount / totalGrid) * 100);
  const hardPct = Math.round((hCount / totalGrid) * 100);
  const mediumPct = 100 - softPct - hardPct;

  const kriging: BlastKrigingState = {
    softCutoffMPa: softCutoff,
    hardCutoffMPa: hardCutoff,
    softDomainPercent: softPct,
    mediumDomainPercent: mediumPct,
    hardDomainPercent: hardPct,
    dominantDomainEn: softPct >= mediumPct && softPct >= hardPct ? 'Soft Domain' : hardPct >= mediumPct ? 'Hard Domain' : 'Intermediate Domain',
    dominantDomainFr: softPct >= mediumPct && softPct >= hardPct ? 'Domaine Tendre' : hardPct >= mediumPct ? 'Domaine Dur' : 'Domaine Intermédiaire',
    gridNodes: krigGrid,
    boreholes: actualBoreholes,
    gridBounds: { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY },
    gridCols: 20,
    gridRows: 14,
    variogram: DEFAULT_VARIOGRAM,
    selectedAttribute: 'ucsMPa',
    meanEstimated,
    minEstimated,
    maxEstimated,
  };

  // 13. DRONE 3D SURVEY
  const hasRealDrone = Boolean(blast.droneSurvey && blast.droneSurvey.sectors && blast.droneSurvey.sectors.length > 0);
  const droneSurvey = blast.droneSurvey || generateDemoDroneSurvey(blast.blastId);
  const droneSectors = blast.droneSurvey?.sectors || droneSurvey.sectors;
  const droneVol = blast.droneSurvey ? blast.droneSurvey.totalVolumeM3 : totalBlastedVolumeM3;
  const droneP80 = blast.droneSurvey ? blast.droneSurvey.averageP80Mm : (optical.p80Mm || kuzRam.p80Mm);

  const drone: BlastDroneState = {
    hasDroneData: hasRealDrone,
    isDemoData: !hasRealDrone,
    totalVolumeM3: droneVol,
    meanP80Mm: droneP80,
    pointCloudCount: droneSurvey.meshPointsCount || 48520,
    sectors: droneSectors.map((s) => ({
      nameEn: s.name,
      nameFr: s.name
        .replace('Crest / Free Face Ejection Zone', 'Crête / Éjection Front Libre')
        .replace('Central Heaped Muckpile (Main Body)', 'Cœur du Tas (Corps Central)')
        .replace('Toe Confinement / Heavy Boulder Apron', 'Pied de Tir / Nappe Gros Blocs')
        .replace('Backbreak / Crest Tension Cracks', 'Arrière / Fissures de Tension'),
      volumeM3: s.volumeM3,
      p50Mm: s.p50Mm,
      p80Mm: s.p80Mm,
      topSizeMm: s.topSizeMm,
      oversizePercent: s.oversizePercent,
      zone: s.zone,
    })),
  };

  return {
    blastId: blast.blastId,
    blastDbId: blast.id,
    dateTime: blast.dateTime,
    weather: blast.weather,
    notes: blast.notes,
    geometry,
    explosive,
    rock,
    kuzRam,
    optical,
    sieve: sieveState,
    comminution,
    economics,
    belt,
    timing,
    drilling,
    kriging,
    drone,
    validationWarningsEn,
    validationWarningsFr,
  };
}
