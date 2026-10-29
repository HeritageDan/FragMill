// Advanced Tier-1 Mining Industry Types for FragMill

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

// 1. Drone 3D Photogrammetry & Orthomosaic Sizing
export interface DroneFlightMetadata {
  flightAltitudeM: number;
  gsdMmPerPx: number;
  cameraSensor: string;
  focalLengthMm: number;
  overlapForwardPercent: number;
  overlapSidePercent: number;
  surveyDate: string;
  crs: string; // Coordinate Reference System, e.g. 'WGS84 / UTM Zone 33N'
}

export interface MuckpileSector {
  id: string;
  name: string;
  zone: 'crest' | 'middle' | 'toe' | 'backbreak';
  color: string;
  polygon: { x: number; y: number }[]; // Normalized 0..1 coordinates
  p10Mm: number;
  p50Mm: number;
  p80Mm: number;
  topSizeMm: number;
  oversizePercent: number;
  volumeM3: number;
}

export interface DroneOrthomosaicData {
  id: string;
  blastId: string;
  name: string;
  imageUrl: string;
  metadata: DroneFlightMetadata;
  meshPointsCount: number;
  totalVolumeM3: number;
  sectors: MuckpileSector[];
  averageP80Mm: number;
}

// 2. Continuous Edge Vision on Conveyor Belts & Excavator Buckets
export interface BeltVisionConfig {
  streamSource: 'simulation' | 'webcam' | 'custom_url';
  streamUrl?: string;
  crusherGapeThresholdMm: number;
  beltWidthM: number;
  beltSpeedMPerS: number;
  bulkDensityTPerM3: number;
  samplingIntervalMs: number;
  alarmSoundEnabled: boolean;
}

export interface RockDetection {
  id: string;
  x: number;
  y: number;
  majorAxisMm: number;
  minorAxisMm: number;
  equivalentDiameterMm: number;
  isOversize: boolean;
  confidence: number;
}

export interface BeltStats {
  instantTph: number;
  beltUtilizationPercent: number;
  p20Mm: number;
  p50Mm: number;
  p80Mm: number;
  topSizeMm: number;
  totalRocksDetected: number;
  oversizeCount: number;
  currentAlert: boolean;
  timeToChokeSeconds?: number;
  cemaTroughAngleDeg?: number;
  volumetricFlowM3PerH?: number;
}

export interface CrusherChokeEvent {
  id: string;
  timestamp: number;
  boulderSizeMm: number;
  thresholdMm: number;
  snapshotDataUrl: string;
  location: 'Conveyor Feed' | 'Crusher Jaw Hopper' | 'Shovel Dipper';
  cleared: boolean;
}

// 3. 3D Blast Timing Simulator & Face Profiler
export interface HoleTimingInfo {
  holeIndex: number;
  holeId?: string;
  row: number;
  col: number;
  x: number; // Bench Easting (m)
  y: number; // Bench Northing (m)
  surfaceDelayMs: number;
  inHoleDelayMs: number;
  firingTimeMs: number;
  chargeKg: number;
  burdenM: number;
  spacingM: number;
  faceDistanceM: number;
  state: 'ready' | 'detonated';
  isWet?: boolean;
  waterDepthM?: number;
  hasCavityOrFault?: boolean;
}

export interface IsochroneContour {
  timeMs: number;
  color: string;
  points: { x: number; y: number }[];
}

export interface PPVEstimate {
  distanceM: number;
  chargePerDelayKg: number;
  siteConstantK: number;
  attenuationBeta: number;
  estimatedPPVMmS: number;
  safeLimitMmS: number;
  isCompliant: boolean;
  airblast?: AirblastEstimate;
}

export interface AirblastEstimate {
  distanceM: number;
  chargeKg: number;
  peakOverpressureDbl: number;
  peakOverpressurePa: number;
  safeLimitDbl: number;
  isCompliant: boolean;
}

export interface FaceReliefCheck {
  holeIndex: number;
  burdenM: number;
  delayToPreviousRowMs: number;
  reliefVelocityMPerS: number;
  status: 'optimal' | 'under_relieved' | 'over_relieved';
  warning?: string;
}

export interface FaceProfilePoint {
  depthM: number;
  actualBurdenM: number;
  designBurdenM: number;
  isCriticalUnderburden: boolean; // Hazard of flyrock
}

// 4. Comminution Digital Twin (Bond, Morrell, & Circuit Modeling)
export interface BondCircuitParams {
  f80Mm: number; // Incoming Feed size from blast sizing (mm)
  targetP80Mm: number; // Target Product size to leach / flotation (mm)
  bondWorkIndexKWhPerT: number; // Wi (kWh/t)
  rockAxb: number; // Drop-weight hardness parameter (A x b)
  plantOperatingHoursPerDay: number;
  electricityCostPerKWhUSD: number;
  explosiveCostPerKgUSD: number;
  targetDailyThroughputTonnes: number;
}

export interface CircuitSimulationResult {
  specificEnergyBondKWhPerT: number;
  specificEnergyMorrellKWhPerT: number;
  crushingSpecificEnergyKWhPerT: number;
  grindingSpecificEnergyKWhPerT: number;
  totalSpecificEnergyKWhPerT: number;
  achievableThroughputTPH: number;
  dailyThroughputTonnes: number;
  grindingMediaWearKgPerT: number;
  dailyPowerCostUSD: number;
  dailyDrillBlastCostUSD: number;
  totalComminutionCostPerTonneUSD: number;
  mineralLiberationPercent: number;
  estimatedGoldRecoveryPercent: number;
  crusherPowerKW?: number;
  crusherCapacityTPH?: number;
  smcEnergyKwhPerT?: number;
  millingCo2KgPerT?: number;
}

export interface EconomicTradeoffPoint {
  powderFactorKgPerM3: number;
  blastP80Mm: number;
  drillBlastCostPerTUSD: number;
  millingEnergyCostPerTUSD: number;
  totalCircuitCostPerTUSD: number;
  throughputTPH: number;
}

// 5. Geostatistical Spatial Kriging & Block Model
export interface BoreholeSample {
  id: string;
  easting: number;
  northing: number;
  elevation: number;
  ucsMPa: number;
  rqdPercent: number;
  jointSpacingM: number;
  densityTPerM3: number;
  goldGradeGPT: number;
}

export interface KrigingGridNode {
  x: number;
  y: number;
  estimatedValue: number;
  estimationVariance: number;
  domain: 'Soft Fractured' | 'Intermediate' | 'Hard Massive';
  recommendedPowderFactorKgPerM3: number;
}

export interface VariogramParams {
  model: 'spherical' | 'exponential' | 'gaussian';
  nugget: number;
  sill: number;
  rangeM: number;
}

// 6. Drill Rig Telemetry (IREDES) & P2P Sync
export interface IREDESHole {
  holeId: string;
  plannedX: number;
  plannedY: number;
  plannedZ: number;
  plannedDepthM: number;
  plannedBurdenM: number;
  plannedSpacingM: number;
  actualX?: number;
  actualY?: number;
  actualZ?: number;
  actualDepthM?: number;
  collarDeviationMm?: number;
  depthDeviationM?: number;
  penetrationRateMPerMin?: number;
  mwdSpecificEnergyMpa?: number;
  rockHardnessClass?: 'very_soft' | 'soft' | 'medium' | 'hard' | 'extreme';
  toeDeviationMm?: number;
  angularDeviationDeg?: number;
}

export interface P2PSyncPeer {
  id: string;
  deviceName: string;
  role: 'field_tablet' | 'lab_desktop' | 'mill_server';
  ipAddress?: string;
  status: 'online' | 'syncing' | 'synced' | 'offline';
  lastSyncTimestamp: number;
}
