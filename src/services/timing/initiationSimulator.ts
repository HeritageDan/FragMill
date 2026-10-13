// 3D Blast Initiation Timing Simulator & Bench Face Profiler

import type { HoleTimingInfo, IsochroneContour, PPVEstimate, FaceProfilePoint } from '../../types/advanced';

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

  return {
    distanceM,
    chargePerDelayKg: maxChargePerDelayKg,
    siteConstantK: k,
    attenuationBeta: beta,
    estimatedPPVMmS: parseFloat(estimatedPPVMmS.toFixed(2)),
    safeLimitMmS: regulatoryLimitMmS,
    isCompliant: estimatedPPVMmS <= regulatoryLimitMmS,
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
