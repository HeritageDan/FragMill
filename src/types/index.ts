// FragMill Core Data Models and Types
import type { DroneOrthomosaicData } from './advanced';

export type SizeDefinition = 'min_feret' | 'ecd' | 'bbox_minor';
export type EngineType = 'classical' | 'ai_sam' | 'hybrid' | 'manual_edit';
export type CalibrationMethod = 'two_point' | 'four_point_homography' | 'aruco_marker';
export type ZoneType = 'front' | 'middle' | 'top' | 'other';
export type LightingType = 'sun' | 'overcast' | 'shade';
export type JointOrientation = 'dip_out_of_face' | 'strike_perpendicular' | 'dip_into_face';

export interface Point2D {
  x: number;
  y: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface Site {
  id: string;
  projectId: string;
  name: string;
  locationText: string;
  gpsLat?: number;
  gpsLng?: number;
  rockTypeNotes?: string;
  operatorContact?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BlastParameters {
  benchHeight: number; // m
  holeDiameter: number; // mm
  holeDepth: number; // m
  subdrill: number; // m
  burden: number; // m
  spacing: number; // m
  stemmingLength: number; // m
  numberOfHoles: number;
  holeInclination: number; // deg (e.g. 90 = vertical)
  explosiveType: string;
  rws: number; // Relative Weight Strength, ANFO = 100
  chargePerHole: number; // kg
  bottomChargeLength: number; // m
  columnChargeLength: number; // m
  initiationSequenceNotes: string;
  waterInHoles: boolean;
  drillingDeviationEstimate: number; // m
  chargingProfile?: HoleChargingProfile;
}

export interface HoleChargingProfile {
  // 1. Charge de pied (Toe Charge: Dynamite / Booster)
  toeExplosiveType: 'dynamite' | 'emulsion_cartridge' | 'pentolite_booster';
  toeCartridgeWeightGrams: number; // e.g. 250g or 500g per cartridge
  toeCartridgeCount: number; // e.g. 2 or 3 cartridges
  toeChargeWeightKg: number; // calculated: (toeCartridgeCount * toeCartridgeWeightGrams) / 1000
  toeChargeLengthM: number;
  toeUnitCost: number; // unit cost per cartridge or kg

  // 2. Charge de colonne (Column Charge: ANFO / Nitrate-Gasoil)
  columnExplosiveType: 'anfo_bulk' | 'emulsion_matrix' | 'heavy_anfo';
  anfoNitrateBags25kg: number; // number of 25kg bags (e.g. 1, 2, 3 bags)
  anfoNitrateWeightKg: number; // bags * 25
  fuelLitersPerBag: number; // liters of diesel per 25kg bag (standard: 3.0 L/bag)
  fuelTotalLiters: number; // bags * fuelLitersPerBag
  fuelTotalKg: number; // fuelTotalLiters * 0.84 (diesel density)
  columnTotalWeightKg: number; // anfoNitrateWeightKg + fuelTotalKg
  columnChargeLengthM: number;
  nitrateBagCost: number; // cost per 25kg bag
  fuelLiterCost: number; // cost per liter of diesel

  // 3. Bourrage (Stemming)
  stemmingLengthM: number;
  stemmingMaterial: 'crushed_aggregate_0_10' | 'drill_cuttings' | 'clay_soil';
  hasFlyrockRisk: boolean;

  // 4. Failles géologiques / Fissures / Cavités (Faults & Voids Mitigation)
  hasFaultOrCavity: boolean;
  faultDepthM: number;
  faultThicknessM: number;
  faultMitigationStrategy: 'decking_plug' | 'plastic_liner' | 'reduced_charge';
  deckingMaterial: 'air_deck_plug' | 'wood_spacer' | 'inert_stemming';
  explosiveSavedKg: number;
  costSaved: number;

  // 5. Statistiques du patron
  totalHoleLengthM: number;
  averagePatternHoleLengthM: number;
  subdrillM: number;
}

export interface RockMass {
  rockType: string;
  density: number; // t/m3 (e.g. 2.65)
  jointSetCount: number;
  meanJointSpacing: number; // m
  jointOrientation: JointOrientation;
  estimatedGsiOrRmr?: number;
  ucsMPa?: number;
  youngsModulusGPa?: number;
}

export interface DerivedBlastMetrics {
  blastedVolume: number; // m3 = holes * burden * spacing * benchHeight
  blastedTonnage: number; // tonnes = volume * density
  totalExplosiveKg: number; // holes * chargePerHole
  powderFactor: number; // kg/m3 = totalExplosive / volume
  burdenDiameterRatio: number; // (burden * 1000) / diameter
  spacingBurdenRatio: number; // spacing / burden
  stemmingBurdenRatio: number; // stemming / burden
  specificDrilling: number; // (holes * depth) / volume (m/m3)
  warnings: string[];
}

export interface QualityCheck {
  blurScore: number;
  blurStatus: 'pass' | 'warn' | 'fail';
  exposureStatus: 'pass' | 'warn' | 'fail';
  contrastStatus: 'pass' | 'warn' | 'fail';
  resolutionStatus: 'pass' | 'warn' | 'fail';
  scaleMarkerStatus: 'pass' | 'warn' | 'fail';
  isArtificialGraphic?: boolean;
  advice: string[];
}

export interface Calibration {
  method: CalibrationMethod;
  points: Point2D[];
  realWorldDistanceMm: number;
  realWorldWidthMm?: number;
  realWorldHeightMm?: number;
  pxPerMm: number;
  scaleVariationPercent?: number;
  calibrationErrorMm?: number;
  homographyMatrix?: number[][]; // 3x3 matrix
}

export interface Fragment {
  id: number;
  polygon: Point2D[];
  centroid: Point2D;
  areaPx: number;
  areaMm2: number;
  ecdMm: number; // Equivalent circular diameter: 2 * sqrt(area / pi)
  minFeretMm: number; // Caliper size (closest to square sieve aperture)
  maxFeretMm: number;
  bboxWidthMm: number;
  bboxHeightMm: number;
  aspectRatio: number;
  solidity: number; // Area / ConvexHullArea
  volumeMm3: number; // Shape factor volume, e.g. pi/6 * d^3
  confidence: number;
  isFines?: boolean;
  depthMm?: number;
  thicknessMm?: number; // C-axis (triaxial ellipsoid: A = maxFeret, B = minFeret, C = thickness)
  trueVolume3DMm3?: number; // (pi / 6) * A * B * C true 3D particle volume
}

export interface CumulativePoint {
  sizeMm: number;
  passingPercent: number;
}

export interface FitParametersSwebrec {
  xMax: number;
  x50: number;
  b: number;
  r2: number;
  rmse: number;
  aic?: number;
  bic?: number;
}

export interface FitParametersRosinRammler {
  xc: number;
  n: number;
  r2: number;
  rmse: number;
  aic?: number;
  bic?: number;
}

export interface FitParametersGGS {
  k: number; // Size modulus (mm)
  m: number; // Distribution modulus (slope)
  r2: number;
  rmse: number;
  aic?: number;
  bic?: number;
}

export interface StandardSieveMesh {
  standard: 'ASTM' | 'Tyler' | 'ISO';
  meshName: string;
  apertureMm: number;
  passingPercent: number;
}

// PROPOSAL 1: 3D Depth & Stereology
export interface StereoPair {
  isStereo: boolean;
  baselineMm: number;
  leftDataUrl?: string;
  rightDataUrl?: string;
  convergenceAngleDeg?: number;
}

// PROPOSAL 3: Live Camera Orientation HUD
export interface CameraOrientation {
  pitchDeg: number;
  rollDeg: number;
  yawDeg?: number;
  deviationDeg: number;
  isLevelAndPerpendicular: boolean;
}

// PROPOSAL 4: Mine-to-Mill Economic & Carbon Parameters
export interface EconomicParameters {
  drillingCostPerMeter: number;
  explosiveCostPerKg: number;
  secondaryBreakingCostPerBoulder: number;
  crushingEnergyCostPerKwh: number;
  millingEnergyCostPerKwh: number;
  dieselCostPerLiter: number;
}

export interface EconomicEvaluation {
  drillingCostPerTon: number;
  blastingCostPerTon: number;
  secondaryBreakingCostPerTon: number;
  crushingCostPerTon: number;
  millingCostPerTon: number;
  totalCostPerTon: number;
  optimalP80Mm: number;
  potentialSavingsPerTon: number;
  isOptimumAtBoundary?: boolean;
  carbonEmissions: {
    scope1ExplosivesKgCo2ePerTon: number;
    scope1DieselKgCo2ePerTon: number;
    scope2ElectricityKgCo2ePerTon: number;
    totalKgCo2ePerTon: number;
  };
}

export interface BootstrapConfidenceInterval {
  p10: [number, number];
  p20: [number, number];
  p50: [number, number];
  p80: [number, number];
  p90: [number, number];
}

export interface FragmentationMetrics {
  sizeDefinition: SizeDefinition;
  fragmentCount: number;
  p10: number;
  p20: number;
  p50: number;
  p80: number;
  p90: number;
  pMax: number;
  meanSize: number;
  uniformityIndex: number; // P80 / P20 or fitted n
  oversizePercent: number; // > cut-off (e.g. 300 mm)
  finesPercent: number; // < cut-off (e.g. 25 mm)
  unresolvedFinesPercent: number;
  bootstrapCI: BootstrapConfidenceInterval;
  swebrecFit?: FitParametersSwebrec;
  rosinRammlerFit?: FitParametersRosinRammler;
  ggsFit?: FitParametersGGS;
  bestFitModel?: 'swebrec' | 'rosin_rammler' | 'ggs';
  standardSievePassing?: StandardSieveMesh[];
  rawCurve: CumulativePoint[];
  correctedCurve: CumulativePoint[];
  stereologicalCorrectionApplied?: boolean;
  true3D_P50?: number;
  true3D_P80?: number;
  activeDistributionModel?: 'rosin_rammler' | 'swebrec' | 'hybrid';
  swebrecExtrapolatedFines?: {
    cutoffApertureMm: number;
    finesPercentSwebrec: number;
    finesPercentRosinRammler: number;
    bParameter: number;
  };
}

export interface ClassicalEngineParams {
  colorSpace: 'grayscale' | 'lab' | 'hsv';
  claheClipLimit: number;
  claheGridSize: number;
  gaussianBlurKernel: number;
  thresholdMethod: 'adaptive' | 'otsu' | 'canny';
  adaptiveBlockSize: number;
  adaptiveC: number;
  morphKernelSize: number;
  distanceTransformThreshold: number; // 0.1 to 0.9 peak detection
  minFragmentAreaMm2: number;
  minSolidity: number;
  maxAspectRatio: number;
  filterBorders: boolean;
}

export interface AiEngineParams {
  modelType: 'sam_tiny' | 'sam_small' | 'slimsam_int8';
  pointsPerSide: number;
  predIouThresh: number;
  stabilityScoreThresh: number;
  boxNmsThresh: number;
  minMaskRegionAreaMm2: number;
  tileOverlapPercent: number;
}

export interface HybridEngineParams {
  aiParams: AiEngineParams;
  classicalParams: ClassicalEngineParams;
  finesHandledByClassical: boolean;
}

export interface SegmentationRun {
  id: string;
  imageId: string;
  engine: EngineType;
  parentRunId?: string; // If edited, keeps reference to original run
  timestamp: number;
  parameters: ClassicalEngineParams | AiEngineParams | HybridEngineParams | Record<string, any>;
  fragments: Fragment[];
  metrics: FragmentationMetrics;
  stepPreviews?: {
    grayscale?: string;
    clahe?: string;
    threshold?: string;
    distance?: string;
    markers?: string;
    depthMap?: string;
    overlay?: string;
    overlayWithSizing?: string;
  };
}

export interface ImageRecord {
  id: string;
  blastId: string;
  dataUrl: string; // Base64 data URL stored in IndexedDB
  thumbnailUrl?: string;
  filename: string;
  zone: ZoneType;
  lighting: LightingType;
  time: string;
  cameraHeightM?: number;
  estimatedDistanceM?: number;
  hasScaleMarker: boolean;
  exifData?: {
    make?: string;
    model?: string;
    focalLengthMm?: number;
    iso?: number;
    exposureTime?: string;
    dateTime?: string;
  };
  qualityCheck: QualityCheck;
  calibration?: Calibration;
  roiPolygon?: Point2D[];
  exclusionPolygons?: Point2D[][];
  segmentationRuns?: SegmentationRun[];
  approvedForDataset?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ManualFragmentGroundTruth {
  id: number;
  sizeMm: number;
  notes?: string;
}

export interface SieveDataGroundTruth {
  apertureMm: number;
  massRetainedKg: number;
  passingPercent?: number;
}

export interface GroundTruth {
  id: string;
  blastId: string;
  manualFragments: ManualFragmentGroundTruth[];
  sieveData: SieveDataGroundTruth[];
  computedP20?: number;
  computedP50?: number;
  computedP80?: number;
  calibratedKBiasFactor?: number;
  calibratedPosteriorMeanA?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MillBatch {
  id: string;
  blastId: string;
  batchTonnageTonnes: number;
  truckCount?: number;
  meanLoadTonnes?: number;
  loadingHaulingCycleTimeMinutes?: number;
  bouldersSecondaryBreakingCount?: number;
  crushingTimeHours: number;
  crushingEnergyKwh: number;
  millingThroughputTph: number;
  millingEnergyKwh: number;
  headGradeGpt: number;
  tailsGradeGpt: number;
  concentrateGradeGpt?: number;
  concentrateMassTonnes?: number;
  processingNotes?: string;
  // Computed KPIs
  crushingSpecificEnergyKwhPerT: number;
  millingSpecificEnergyKwhPerT: number;
  totalSpecificEnergyKwhPerT: number;
  simpleGoldRecoveryPercent: number; // (f - t) / f * 100
  twoProductGoldRecoveryPercent?: number; // c*(f - t) / (f*(c - t)) * 100
  oversizeRejectsPercent?: number;
  createdAt: number;
  updatedAt: number;
}

export interface KuzRamRockTables {
  rmd: number; // Rock Mass Description (Powdery/friable = 10, Blocky = 20, Massive = 50)
  jf: number; // Joint Factor: spacing term (vertical joints <0.1m = 10, 0.1-1m = 20, >1m = 50)
  jfo: number; // Joint Orientation (dip out = 20, strike perp = 30, dip into = 40)
  density: number; // t/m3, RDI = 25 * density - 50
  hf: number; // Hardness Factor: E/30 or UCS/5
}

export interface KuzRamResult {
  rockFactorA: number;
  meanSizeX50Cm: number;
  meanSizeX50Mm: number;
  uniformityIndexN: number;
  characteristicSizeXcMm: number;
  p10Mm: number;
  p20Mm: number;
  p50Mm: number;
  p80Mm: number;
  p90Mm: number;
  curve: CumulativePoint[];
  kcoResult?: {
    xMaxMm: number;
    bParameter: number;
    curve: CumulativePoint[];
  };
  xpFragCurve?: CumulativePoint[];
  flyrock?: {
    faceBurdenThrowM: number;
    crateringThrowM: number;
    riflingThrowM: number;
    maxFlyrockDistanceM: number;
    safetyFactor: number;
    personnelEvacuationDistanceM: number;
    equipmentEvacuationDistanceM: number;
  };
  energy?: {
    powderFactorKgPerM3: number;
    powderFactorKgPerTonne: number;
    energyFactorMjPerTonne: number;
    specificDrillingMPerM3: number;
    co2EmissionsKgPerTonne: number;
    totalCo2EmissionsKg: number;
  };
}

export interface BayesianCalibrationResult {
  priorMeanA: number;
  priorStdA: number;
  posteriorMeanA: number;
  posteriorStdA: number;
  credibleInterval95A: [number, number];
  acceptanceRate: number;
  mcmcSamplesA: number[];
  predictiveCurve: {
    sizeMm: number;
    medianPassing: number;
    lower95: number;
    upper95: number;
  }[];
}

export interface BlastAdvisorTarget {
  targetP80Mm: number;
  bounds: {
    minBurden: number;
    maxBurden: number;
    minSpacing: number;
    maxSpacing: number;
    minStemming: number;
    maxStemming: number;
    minPowderFactor: number;
    maxPowderFactor: number;
  };
}

export interface BlastAdvisorRecommendation {
  recommendedBurden: number;
  recommendedSpacing: number;
  recommendedStemming: number;
  recommendedPowderFactor: number;
  predictedP80Mm: number;
  predictedP80CI: [number, number];
  sensitivity: {
    parameter: string;
    impactLowMm: number;
    impactHighMm: number;
  }[];
}

export interface DetailedDrillHole {
  holeId: string;
  rowNumber: number; // 1 = front free face, 2, 3...
  eastingX: number; // m
  northingY: number; // m
  elevationZ: number; // m RL
  diameterMm: number; // mm
  depthM: number; // m
  burdenM: number; // m
  spacingM: number; // m
  subdrillM: number; // m
  stemmingM: number; // m
  inclinationDeg: number; // deg (90 = vertical, <90 = inclined)
  azimuthDeg?: number; // deg (bearing of inclination)
  waterDepthM: number; // m (0 = dry)
  isWet?: boolean; // true if waterDepthM > 0 or marked wet
  toeExplosiveType?: string; // e.g. 'Bulk Emulsion', 'Dynamite', 'ANFO'
  toeChargeKg: number; // kg
  columnExplosiveType?: string; // e.g. 'ANFO', 'Heavy ANFO', 'Emulsion'
  columnChargeKg: number; // kg
  airDeckM?: number; // m
  hasCavityOrFault?: boolean;
  cavityDepthM?: number; // m
  cavityThicknessM?: number; // m
  totalChargeKg: number; // kg (toeChargeKg + columnChargeKg)
  powderFactorKgPerM3?: number; // kg/m3 = totalChargeKg / (burdenM * spacingM * benchHeight)
  rockType?: string;
  ucsMPa: number; // MPa
  rqdPercent?: number; // %
  densityTPerM3?: number; // t/m3
  detonatorDelayMs?: number; // ms
  detonatorType?: string; // 'Electronic' | 'Nonel'
  status?: 'planned' | 'drilled' | 'loaded' | 'stemmed' | 'blasted';
  notes?: string;
}

export interface Blast {
  id: string;
  siteId: string;
  projectId: string;
  blastId: string; // e.g. "BL-2026-001"
  dateTime: string;
  weather: string;
  notes: string;
  parameters: BlastParameters;
  rockMass: RockMass;
  images: ImageRecord[];
  groundTruth?: GroundTruth;
  millBatch?: MillBatch;
  gpsCoordinates?: { lat: number; lng: number; altitudeM: number };
  benchElevation?: number; // e.g., 1240 RL
  polygonCoords?: [number, number][]; // 2D bench polygon in local meters [x, y]
  economicParams?: EconomicParameters;
  drillHoles?: DetailedDrillHole[];
  droneSurvey?: DroneOrthomosaicData;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  language: 'en' | 'fr';
  theme: 'default' | 'dark' | 'outdoor';
  unit: 'mm' | 'cm' | 'in';
  mode: 'field' | 'expert';
  defaultSizeDefinition: SizeDefinition;
  defaultCurveModel?: 'rosin_rammler' | 'swebrec';
  minFragmentCutoffPx: number;
  oversizeThresholdMm: number;
  finesThresholdMm: number;
  maxImageDimension: number; // default 4000
  enableGemini: boolean;
  geminiApiKey?: string;
  geminiModelFlash: string;
  geminiModelPro: string;
  validationErrorThresholdPercent: number; // default 15%
  economicParams?: EconomicParameters;
}

export interface GeminiQualityResponse {
  isMuckPile: boolean;
  scaleMarkerVisible: boolean;
  lightingQuality: 'good' | 'harsh_shadows' | 'overexposed' | 'underexposed';
  obstaclesDetected: string[];
  suggestedRoiBbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1
  suggestedScaleBbox?: [number, number, number, number];
  operatorAdvice: string;
}
