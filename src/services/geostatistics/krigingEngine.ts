// Geostatistical Spatial Kriging & Geological Block Model Service

import type { BoreholeSample, KrigingGridNode, VariogramParams } from '../../types/advanced';

export const DEFAULT_VARIOGRAM: VariogramParams = {
  model: 'spherical',
  nugget: 15.0, // C0: Small-scale measurement uncertainty
  sill: 180.0, // C0 + C: Total population spatial variance
  rangeM: 35.0, // a: Spatial correlation range in meters
};

/**
 * Spherical Variogram Function:
 * gamma(h) = C0 + C * (1.5 * (h / a) - 0.5 * (h / a)^3) for h <= a
 * gamma(h) = C0 + C for h > a
 */
export function sphericalVariogram(h: number, params: VariogramParams): number {
  if (h <= 0) return 0;
  if (h >= params.rangeM) return params.nugget + params.sill;
  const ratio = h / params.rangeM;
  return params.nugget + params.sill * (1.5 * ratio - 0.5 * Math.pow(ratio, 3));
}

/**
 * Exponential Variogram Function:
 * gamma(h) = C0 + C * (1 - exp(-3h / a))
 */
export function exponentialVariogram(h: number, params: VariogramParams): number {
  if (h <= 0) return 0;
  return params.nugget + params.sill * (1 - Math.exp((-3 * h) / Math.max(0.1, params.rangeM)));
}

/**
 * Gaussian Variogram Function:
 * gamma(h) = C0 + C * (1 - exp(-3h^2 / a^2))
 */
export function gaussianVariogram(h: number, params: VariogramParams): number {
  if (h <= 0) return 0;
  const ratio = h / Math.max(0.1, params.rangeM);
  return params.nugget + params.sill * (1 - Math.exp(-3 * ratio * ratio));
}

/**
 * Evaluate theoretical variogram based on model type
 */
export function evaluateVariogram(h: number, params: VariogramParams): number {
  switch (params.model) {
    case 'exponential':
      return exponentialVariogram(h, params);
    case 'gaussian':
      return gaussianVariogram(h, params);
    case 'spherical':
    default:
      return sphericalVariogram(h, params);
  }
}

/**
 * True Ordinary Kriging Matrix Solver (BLUE System):
 * Solves [Gamma_ij | 1] [lambda] = [Gamma_i0]
 *        [   1^T   | 0] [  mu  ]   [   1    ]
 * Computes exact unbiased BLUE weights and exact estimation variance.
 */
export function solveOrdinaryKriging(
  targetX: number,
  targetY: number,
  samples: BoreholeSample[],
  attribute: keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>,
  params: VariogramParams
): { estimate: number; variance: number; weights: number[] } {
  const n = samples.length;
  if (n === 0) return { estimate: 0, variance: params.sill + params.nugget, weights: [] };

  // Check if target coincides with a sample
  for (let i = 0; i < n; i++) {
    if (Math.hypot(targetX - samples[i].easting, targetY - samples[i].northing) < 0.01) {
      const weights = new Array(n).fill(0);
      weights[i] = 1;
      return { estimate: samples[i][attribute], variance: params.nugget, weights };
    }
  }

  // Construct (n+1) x (n+1) augmented matrix A and RHS vector B
  const size = n + 1;
  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const B: number[] = new Array(size).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dist = Math.hypot(samples[i].easting - samples[j].easting, samples[i].northing - samples[j].northing);
      A[i][j] = evaluateVariogram(dist, params);
    }
    A[i][n] = 1; // Lagrange multiplier row/column
    A[n][i] = 1;

    const distToTarget = Math.hypot(targetX - samples[i].easting, targetY - samples[i].northing);
    B[i] = evaluateVariogram(distToTarget, params);
  }
  A[n][n] = 0;
  B[n] = 1; // Unbiasedness constraint sum(weights) = 1

  // Solve A * X = B using Gaussian elimination with partial pivoting
  for (let col = 0; col < size; col++) {
    // Find pivot row
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      // Fallback to IDW if matrix is singular
      const idwEst = interpolateIDW(targetX, targetY, samples, attribute, 2);
      const minDist = Math.min(...samples.map((s) => Math.hypot(targetX - s.easting, targetY - s.northing)));
      return { estimate: idwEst, variance: evaluateVariogram(minDist, params), weights: [] };
    }

    // Swap rows
    if (maxRow !== col) {
      [A[col], A[maxRow]] = [A[maxRow], A[col]];
      [B[col], B[maxRow]] = [B[maxRow], B[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < size; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < size; k++) {
        A[row][k] -= factor * A[col][k];
      }
      B[row] -= factor * B[col];
    }
  }

  // Back-substitution
  const X = new Array(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    let sum = B[row];
    for (let k = row + 1; k < size; k++) {
      sum -= A[row][k] * X[k];
    }
    X[row] = sum / A[row][row];
  }

  const weights = X.slice(0, n);
  const mu = X[n]; // Lagrange multiplier

  // Compute estimate Z* = sum(lambda_i * z_i)
  let estimate = 0;
  for (let i = 0; i < n; i++) {
    estimate += weights[i] * samples[i][attribute];
  }

  // Kriging estimation variance: sigma_k^2 = sum(lambda_i * gamma_i0) + mu
  let variance = mu;
  for (let i = 0; i < n; i++) {
    const distToTarget = Math.hypot(targetX - samples[i].easting, targetY - samples[i].northing);
    variance += weights[i] * evaluateVariogram(distToTarget, params);
  }
  variance = Math.max(0, variance);

  return { estimate, variance, weights };
}

/**
 * Inverse Distance Weighting (IDW) 2D spatial interpolation:
 * Fast, robust fallback and grid initializer
 */
export function interpolateIDW(
  targetX: number,
  targetY: number,
  samples: BoreholeSample[],
  attribute: keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>,
  power = 2
): number {
  let weightedSum = 0;
  let weightsSum = 0;

  for (const s of samples) {
    const dist = Math.hypot(targetX - s.easting, targetY - s.northing);
    if (dist < 0.001) return s[attribute]; // Exact match

    const weight = 1 / Math.pow(dist, power);
    weightedSum += weight * s[attribute];
    weightsSum += weight;
  }

  return weightsSum > 0 ? weightedSum / weightsSum : 0;
}

/**
 * Ordinary Kriging 2D Grid Interpolation:
 * Solves the unbiased BLUE (Best Linear Unbiased Estimator) system
 */
export function computeKrigingGrid(
  samples: BoreholeSample[],
  attribute: keyof Pick<BoreholeSample, 'ucsMPa' | 'rqdPercent' | 'jointSpacingM' | 'densityTPerM3' | 'goldGradeGPT'>,
  gridCols = 16,
  gridRows = 12,
  minX = 0,
  maxX = 60,
  minY = 0,
  maxY = 40,
  variogram: VariogramParams = DEFAULT_VARIOGRAM
): KrigingGridNode[] {
  const nodes: KrigingGridNode[] = [];
  const dx = (maxX - minX) / (gridCols - 1);
  const dy = (maxY - minY) / (gridRows - 1);

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const x = minX + c * dx;
      const y = minY + r * dy;

      // Estimate using rigorous Ordinary Kriging BLUE linear system
      const krigResult = solveOrdinaryKriging(x, y, samples, attribute, variogram);
      const estimatedValue = krigResult.estimate;
      const estimationVariance = krigResult.variance;

      // Automatic Blast Domain assignment based on UCS & rock strength
      let domain: 'Soft Fractured' | 'Intermediate' | 'Hard Massive' = 'Intermediate';
      let recommendedPowderFactor = 0.65;

      const ucsVal = attribute === 'ucsMPa'
        ? estimatedValue
        : solveOrdinaryKriging(x, y, samples, 'ucsMPa', variogram).estimate;

      if (ucsVal < 75) {
        domain = 'Soft Fractured';
        recommendedPowderFactor = 0.45;
      } else if (ucsVal > 125) {
        domain = 'Hard Massive';
        recommendedPowderFactor = 0.85;
      }

      nodes.push({
        x: parseFloat(x.toFixed(1)),
        y: parseFloat(y.toFixed(1)),
        estimatedValue: parseFloat(estimatedValue.toFixed(1)),
        estimationVariance: parseFloat(estimationVariance.toFixed(1)),
        domain,
        recommendedPowderFactorKgPerM3: recommendedPowderFactor,
      });
    }
  }

  return nodes;
}

/**
 * Demo exploration borehole logs for Bétaré Oya Gold Bench 840 RL
 */
export function generateDemoBoreholes(): BoreholeSample[] {
  return [
    { id: 'BH-01', easting: 5, northing: 5, elevation: 840, ucsMPa: 65, rqdPercent: 42, jointSpacingM: 0.25, densityTPerM3: 2.58, goldGradeGPT: 1.45 },
    { id: 'BH-02', easting: 25, northing: 8, elevation: 840, ucsMPa: 85, rqdPercent: 58, jointSpacingM: 0.42, densityTPerM3: 2.64, goldGradeGPT: 3.12 },
    { id: 'BH-03', easting: 48, northing: 6, elevation: 840, ucsMPa: 145, rqdPercent: 88, jointSpacingM: 0.85, densityTPerM3: 2.74, goldGradeGPT: 0.62 },
    { id: 'BH-04', easting: 12, northing: 22, elevation: 840, ucsMPa: 72, rqdPercent: 48, jointSpacingM: 0.32, densityTPerM3: 2.61, goldGradeGPT: 2.85 },
    { id: 'BH-05', easting: 32, northing: 24, elevation: 840, ucsMPa: 110, rqdPercent: 72, jointSpacingM: 0.60, densityTPerM3: 2.68, goldGradeGPT: 4.80 },
    { id: 'BH-06', easting: 52, northing: 26, elevation: 840, ucsMPa: 160, rqdPercent: 92, jointSpacingM: 0.95, densityTPerM3: 2.76, goldGradeGPT: 0.45 },
    { id: 'BH-07', easting: 18, northing: 35, elevation: 840, ucsMPa: 80, rqdPercent: 52, jointSpacingM: 0.38, densityTPerM3: 2.63, goldGradeGPT: 1.95 },
    { id: 'BH-08', easting: 38, northing: 36, elevation: 840, ucsMPa: 135, rqdPercent: 82, jointSpacingM: 0.72, densityTPerM3: 2.72, goldGradeGPT: 2.40 },
  ];
}
