// Conveyor Belt & Shovel Continuous Edge Vision Service (Continuous FRAGTRACK Competitor)

import type { BeltVisionConfig, RockDetection, BeltStats, CrusherChokeEvent } from '../../types/advanced';

export const DEFAULT_BELT_CONFIG: BeltVisionConfig = {
  streamSource: 'simulation',
  crusherGapeThresholdMm: 600, // 600 mm crusher feed gape limit
  beltWidthM: 1.2, // 1200 mm heavy duty conveyor
  beltSpeedMPerS: 2.2, // 2.2 m/s belt speed
  bulkDensityTPerM3: 1.85, // 1.85 t/m3 loose broken ore
  samplingIntervalMs: 250, // 4 frames per second
  alarmSoundEnabled: true,
};

/**
 * CEMA Standard Conveyor Capacity Calculation (3-Roll Idlers, 20°, 35°, 45°):
 * Computes theoretical maximum cross-sectional area and volumetric capacity
 */
export function calculateCEMACapacity(
  beltWidthM: number,
  beltSpeedMPerS: number,
  troughAngleDeg = 35,
  surchargeAngleDeg = 20,
  bulkDensityTPerM3 = 1.85
): { maxCrossSectionAreaM2: number; maxVolumetricCapacityM3PerH: number; maxThroughputTPH: number } {
  const b = beltWidthM;
  const l = (b / 3) * 0.9; // Center roll length
  const troughRad = (troughAngleDeg * Math.PI) / 180;
  const surchargeRad = (surchargeAngleDeg * Math.PI) / 180;

  // Trapezoidal trough area
  const h = l * Math.sin(troughRad);
  const topWidth = l + 2 * l * Math.cos(troughRad);
  const troughArea = ((l + topWidth) / 2) * h;

  // Circular segment surcharge area
  const surchargeArea = (Math.pow(topWidth, 2) / (8 * Math.sin(surchargeRad))) * (2 * surchargeRad - Math.sin(2 * surchargeRad));

  const maxCrossSectionAreaM2 = parseFloat((troughArea + surchargeArea).toFixed(4));
  const maxVolumetricCapacityM3PerH = Math.round(maxCrossSectionAreaM2 * beltSpeedMPerS * 3600);
  const maxThroughputTPH = Math.round(maxVolumetricCapacityM3PerH * bulkDensityTPerM3);

  return {
    maxCrossSectionAreaM2,
    maxVolumetricCapacityM3PerH,
    maxThroughputTPH,
  };
}

/**
 * Procedurally simulates a frame of rocks passing on a conveyor belt
 */
export function generateSimulatedBeltFrame(
  config: BeltVisionConfig,
  baseP50Mm = 110,
  includeOversizeProbability = 0.08
): { rocks: RockDetection[]; stats: BeltStats; chokeEvent?: CrusherChokeEvent } {
  const rockCount = Math.floor(18 + Math.random() * 14);
  const rocks: RockDetection[] = [];
  let oversizeCount = 0;
  let maxRockSizeMm = 0;
  const sizes: number[] = [];

  const hasOccasionalGiantBoulder = Math.random() < includeOversizeProbability;

  for (let i = 0; i < rockCount; i++) {
    // Log-normal distribution of rock diameters
    const variance = (Math.random() - 0.5) * 0.8;
    let diameterMm = Math.round(baseP50Mm * Math.exp(variance));

    // Force an oversize boulder if triggered
    if (i === 0 && hasOccasionalGiantBoulder) {
      diameterMm = Math.round(config.crusherGapeThresholdMm * (1.05 + Math.random() * 0.35)); // e.g. 650 - 850 mm
    }

    const isOversize = diameterMm >= config.crusherGapeThresholdMm;
    if (isOversize) oversizeCount++;

    if (diameterMm > maxRockSizeMm) {
      maxRockSizeMm = diameterMm;
    }

    sizes.push(diameterMm);

    rocks.push({
      id: `rock-${Date.now()}-${i}`,
      x: 0.05 + Math.random() * 0.9,
      y: 0.05 + Math.random() * 0.9,
      majorAxisMm: Math.round(diameterMm * 1.15),
      minorAxisMm: Math.round(diameterMm * 0.85),
      equivalentDiameterMm: diameterMm,
      isOversize,
      confidence: parseFloat((0.88 + Math.random() * 0.11).toFixed(2)),
    });
  }

  // Sort sizes to get percentiles
  sizes.sort((a, b) => a - b);
  const p20 = sizes[Math.floor(sizes.length * 0.2)] || baseP50Mm * 0.5;
  const p50 = sizes[Math.floor(sizes.length * 0.5)] || baseP50Mm;
  const p80 = sizes[Math.floor(sizes.length * 0.8)] || baseP50Mm * 1.8;

  // Approximate bed depth (m) from rock sizing
  const bedDepthM = Math.min(0.35, (p50 / 1000) * 1.4);
  const crossSectionAreaM2 = config.beltWidthM * bedDepthM * 0.65; // troughing factor
  const volumetricFlowM3PerS = crossSectionAreaM2 * config.beltSpeedMPerS;
  const instantTph = Math.round(volumetricFlowM3PerS * config.bulkDensityTPerM3 * 3600);
  const beltUtilization = Math.min(100, Math.round((bedDepthM / 0.35) * 100));

  const currentAlert = oversizeCount > 0;
  // Distance from edge vision camera to primary crusher dump chute: ~ 12 meters
  const cameraToChuteDistanceM = 12.0;
  const timeToChokeSeconds = currentAlert ? parseFloat((cameraToChuteDistanceM / Math.max(0.5, config.beltSpeedMPerS)).toFixed(1)) : undefined;

  let chokeEvent: CrusherChokeEvent | undefined;
  if (currentAlert) {
    chokeEvent = {
      id: `choke-${Date.now()}`,
      timestamp: Date.now(),
      boulderSizeMm: maxRockSizeMm,
      thresholdMm: config.crusherGapeThresholdMm,
      snapshotDataUrl: '',
      location: 'Crusher Jaw Hopper',
      cleared: false,
    };
  }

  return {
    rocks,
    stats: {
      instantTph,
      beltUtilizationPercent: beltUtilization,
      p20Mm: Math.round(p20),
      p50Mm: Math.round(p50),
      p80Mm: Math.round(p80),
      topSizeMm: maxRockSizeMm,
      totalRocksDetected: rockCount,
      oversizeCount,
      currentAlert,
      timeToChokeSeconds,
      cemaTroughAngleDeg: 35,
      volumetricFlowM3PerH: Math.round(volumetricFlowM3PerS * 3600),
    },
    chokeEvent,
  };
}

/**
 * Play a synthesized warning audio beep using Web Audio API when crusher choke is imminent
 */
export function playCrusherChokeAlarmSound(): void {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch alarm
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {
    // Audio context may be restricted by autoplay policy before user gesture
  }
}
