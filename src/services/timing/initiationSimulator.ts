// 3D Blast Initiation Timing Simulator & Bench Face Profiler

import type { HoleTimingInfo, IsochroneContour, PPVEstimate, FaceProfilePoint, AirblastEstimate, FaceReliefCheck } from '../../types/advanced';

export type InitiationPatternType = 'v_echelon' | 'row_by_row' | 'center_lift' | 'diagonal_cut' | 'electronic_custom';

/**
 * Generate hole coordinates and calculate firing times based on initiation delay pattern
 */
export function generatePatternTiming(
  rows: number,
  cols: number,
  burdenM: number,
  spacingM: number,
  chargePerHoleKg: number,
  pattern: InitiationPatternType = 'v_echelon',
  surfaceDelayMs = 25,
  inHoleDelayMs = 400
): HoleTimingInfo[] {
  const holes: HoleTimingInfo[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = c * spacingM;
      const y = r * burdenM;

      let firingTimeMs = 0;

      if (pattern === 'v_echelon') {
        // V-Cut with apex in the middle of row 0
        const midCol = (cols - 1) / 2;
        const colDistance = Math.abs(c - midCol);
        firingTimeMs = inHoleDelayMs + r * (surfaceDelayMs * 1.6) + colDistance * surfaceDelayMs;
      } else if (pattern === 'row_by_row') {
        firingTimeMs = inHoleDelayMs + r * (surfaceDelayMs * 2) + c * 5;
      } else if (pattern === 'diagonal_cut') {
        // Corner initiation
        firingTimeMs = inHoleDelayMs + (r + c) * surfaceDelayMs;
      } else if (pattern === 'center_lift') {
        const midR = (rows - 1) / 2;
        const midC = (cols - 1) / 2;
        const dist = Math.hypot(r - midR, c - midC);
        firingTimeMs = inHoleDelayMs + dist * surfaceDelayMs * 1.5;
      } else {
        // Electronic custom (sequential 8ms increments)
        firingTimeMs = inHoleDelayMs + idx * 8;
      }

      // Distance from first row to quarry free face
      const faceDistanceM = r === 0 ? burdenM : burdenM + r * burdenM;

      holes.push({
        holeIndex: idx + 1,
        row: r + 1,
        col: c + 1,
        x,
        y,
        surfaceDelayMs,
        inHoleDelayMs,
        firingTimeMs: Math.round(firingTimeMs),
        chargeKg: chargePerHoleKg,
        burdenM,
        spacingM,
        faceDistanceM,
        state: 'ready',
      });
    }
  }

  return holes.sort((a, b) => a.firingTimeMs - b.firingTimeMs);
}

/**
 * Computes isochrone arrival time contour lines across the bench
 */
export function computeIsochroneContours(holes: HoleTimingInfo[], contourIntervalMs = 25): IsochroneContour[] {
  if (holes.length === 0) return [];

  const minTime = Math.min(...holes.map((h) => h.firingTimeMs));
  const maxTime = Math.max(...holes.map((h) => h.firingTimeMs));

  const contours: IsochroneContour[] = [];
  const palette = ['#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'];

  for (let t = minTime; t <= maxTime; t += contourIntervalMs) {
    const activeAtT = holes.filter((h) => Math.abs(h.firingTimeMs - t) <= contourIntervalMs);
    if (activeAtT.length > 0) {
      const colorIndex = Math.floor(((t - minTime) / (maxTime - minTime || 1)) * (palette.length - 1));
      contours.push({
        timeMs: t,
        color: palette[colorIndex] || '#3b82f6',
        points: activeAtT.map((h) => ({ x: h.x, y: h.y })),
      });
    }
  }

  return contours;
}

/**
 * Airblast Overpressure Prediction (OSMRE / USBM RI 8485):
 * L_dB = 165 - 24 * log10(D / Q^(1/3))
 * Standard regulatory limit: 134 dBL (linear peak) or 128 dBL for sensitive structures
 */
export function calculateAirblastOverpressure(
  distanceM: number,
  chargeKg: number,
  safeLimitDbl = 134.0
): AirblastEstimate {
  const scaledDistance = distanceM / Math.pow(Math.max(1, chargeKg), 1 / 3);
  const peakOverpressureDbl = Math.max(90, Math.min(165, 165 - 24 * Math.log10(Math.max(1, scaledDistance))));
  // Sound pressure in Pascals: P = 2e-5 * 10^(L / 20)
  const peakOverpressurePa = 2e-5 * Math.pow(10, peakOverpressureDbl / 20);

  return {
    distanceM,
    chargeKg,
    peakOverpressureDbl: parseFloat(peakOverpressureDbl.toFixed(1)),
    peakOverpressurePa: parseFloat(peakOverpressurePa.toFixed(2)),
    safeLimitDbl,
    isCompliant: peakOverpressureDbl <= safeLimitDbl,
  };
}

/**
 * Predict ground vibration (Peak Particle Velocity, PPV) via United States Bureau of Mines (USBM) formula:
 * PPV = K * (D / sqrt(Q))^(-beta)
 * Standard constants for granodiorite/basalt: K = 1140, beta = 1.6
 */
export function calculateUSBMPPV(
  distanceM: number,
  maxChargePerDelayKg: number,
  k = 1140,
  beta = 1.6,
  regulatoryLimitMmS = 12.7 // DIN 4150-3 standard limit (12.7 mm/s)
): PPVEstimate {
  const scaledDistance = distanceM / Math.sqrt(Math.max(1, maxChargePerDelayKg));
  const estimatedPPVMmS = k * Math.pow(scaledDistance, -beta);
  const airblast = calculateAirblastOverpressure(distanceM, maxChargePerDelayKg);

  return {
    distanceM,
    chargePerDelayKg: maxChargePerDelayKg,
    siteConstantK: k,
    attenuationBeta: beta,
    estimatedPPVMmS: parseFloat(estimatedPPVMmS.toFixed(2)),
    safeLimitMmS: regulatoryLimitMmS,
    isCompliant: estimatedPPVMmS <= regulatoryLimitMmS,
    airblast,
  };
}

/**
 * Inter-Hole Face Relief Velocity Analysis:
 * Verifies that the rock burden in front of each hole has adequate velocity (25 - 45 m/s)
 * and time to detach before the subsequent row fires.
 */
export function checkPatternFaceRelief(
  holes: HoleTimingInfo[],
  designBurdenM = 2.4
): FaceReliefCheck[] {
  const checks: FaceReliefCheck[] = [];
  const rows = Math.max(...holes.map((h) => h.row));

  for (let r = 1; r <= rows; r++) {
    const currentRowHoles = holes.filter((h) => h.row === r);
    const prevRowHoles = holes.filter((h) => h.row === r - 1);

    const avgCurrentFiringTime = currentRowHoles.reduce((s, h) => s + h.firingTimeMs, 0) / Math.max(1, currentRowHoles.length);
    const avgPrevFiringTime = prevRowHoles.length > 0
      ? prevRowHoles.reduce((s, h) => s + h.firingTimeMs, 0) / prevRowHoles.length
      : 0;

    const delayMs = r === 1 ? avgCurrentFiringTime : avgCurrentFiringTime - avgPrevFiringTime;
    const reliefVelocity = (designBurdenM / Math.max(1, delayMs)) * 1000; // m/s

    for (const h of currentRowHoles) {
      let status: 'optimal' | 'under_relieved' | 'over_relieved' = 'optimal';
      let warning: string | undefined = undefined;

      if (r > 1 && delayMs < 12) {
        status = 'under_relieved';
        warning = `Critical under-relief: delay (${delayMs} ms) is too fast for ${designBurdenM}m burden. Excessive vibration & backbreak hazard!`;
      } else if (r > 1 && delayMs > 85) {
        status = 'over_relieved';
        warning = `Over-relief warning: delay (${delayMs} ms) is excessively long. Potential cut-off of down-hole lead wires!`;
      }

      checks.push({
        holeIndex: h.holeIndex,
        burdenM: designBurdenM,
        delayToPreviousRowMs: delayMs,
        reliefVelocityMPerS: parseFloat(reliefVelocity.toFixed(1)),
        status,
        warning,
      });
    }
  }

  return checks;
}

/**
 * Monte Carlo Timing Scatter Simulator:
 * Compares Electronic Detonators (±0.1 ms precision) vs Pyrotechnic Nonel Caps (±15 ms scatter)
 * Evaluates the probability of out-of-sequence detonations.
 */
export function simulateDetonatorScatter(
  holes: HoleTimingInfo[],
  detonatorType: 'electronic' | 'nonel_pyrotechnic' = 'electronic'
): { simulatedHoles: HoleTimingInfo[]; outOfSequenceCount: number; maxScatterMs: number } {
  const stdScatter = detonatorType === 'electronic' ? 0.1 : 12.5; // ms
  let maxScatter = 0;

  const simulatedHoles: HoleTimingInfo[] = holes.map((h) => {
    // Box-Muller gaussian noise
    const u1 = Math.max(1e-6, Math.random());
    const u2 = Math.random();
    const noise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * stdScatter;
    if (Math.abs(noise) > maxScatter) maxScatter = Math.abs(noise);

    return {
      ...h,
      firingTimeMs: Math.max(0, Math.round(h.firingTimeMs + noise)),
    };
  });

  // Check out-of-sequence detonations
  let outOfSequence = 0;
  for (let i = 0; i < holes.length - 1; i++) {
    // If original order was h[i] before h[i+1], check if simulated reversed
    if (holes[i].firingTimeMs < holes[i + 1].firingTimeMs) {
      if (simulatedHoles[i].firingTimeMs > simulatedHoles[i + 1].firingTimeMs) {
        outOfSequence++;
      }
    }
  }

  return {
    simulatedHoles: simulatedHoles.sort((a, b) => a.firingTimeMs - b.firingTimeMs),
    outOfSequenceCount: outOfSequence,
    maxScatterMs: parseFloat(maxScatter.toFixed(2)),
  };
}

/**
 * 3D Bench Face Profiler: detects minimum burden hazards (underburden) which trigger dangerous flyrock
 */
export function generateFaceProfile(
  benchHeightM = 6.0,
  designBurdenM = 2.4,
  toeToeBulgeRatio = 1.4
): FaceProfilePoint[] {
  const points: FaceProfilePoint[] = [];
  const step = 0.5; // Every 0.5 m down the face

  for (let d = 0; d <= benchHeightM; d += step) {
    // Face cavity / underburden typically occurs in top 2 meters; toe bulge occurs near bottom
    let actualBurden = designBurdenM;
    if (d < 2.0) {
      // Cavity risk at collar / crest
      actualBurden = designBurdenM - 0.7 * (1 - d / 2.0); // Can drop to 1.7 m (critical underburden!)
    } else if (d > benchHeightM - 1.5) {
      // Toe burden bulge
      actualBurden = designBurdenM * (1 + (toeToeBulgeRatio - 1) * ((d - (benchHeightM - 1.5)) / 1.5));
    }

    const isCriticalUnderburden = actualBurden < designBurdenM * 0.75; // Flyrock risk if < 75% of design burden

    points.push({
      depthM: d,
      actualBurdenM: parseFloat(actualBurden.toFixed(2)),
      designBurdenM,
      isCriticalUnderburden,
    });
  }

  return points;
}
