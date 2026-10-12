import type { MillBatch } from '../../types';

export interface MineToMillKPIs {
  crushingSpecificEnergyKwhPerT: number;
  millingSpecificEnergyKwhPerT: number;
  totalSpecificEnergyKwhPerT: number;
  simpleGoldRecoveryPercent: number;
  twoProductGoldRecoveryPercent?: number;
}

export function computeMillKPIs(
  tonnage: number,
  crushingEnergyKwh: number,
  millingEnergyKwh: number,
  headGradeGpt: number,
  tailsGradeGpt: number,
  concentrateGradeGpt?: number
): MineToMillKPIs {
  const t = Math.max(1, tonnage);
  const crushSpec = crushingEnergyKwh / t;
  const millSpec = millingEnergyKwh / t;
  const totalSpec = crushSpec + millSpec;

  // Simple formula: R = (f - t) / f * 100
  const simpleR = headGradeGpt > 0 ? Math.max(0, Math.min(100, ((headGradeGpt - tailsGradeGpt) / headGradeGpt) * 100)) : 0;

  // Two product formula: R = (c * (f - t)) / (f * (c - t)) * 100
  let twoProductR: number | undefined = undefined;
  if (concentrateGradeGpt && concentrateGradeGpt > headGradeGpt && headGradeGpt > tailsGradeGpt) {
    const num = concentrateGradeGpt * (headGradeGpt - tailsGradeGpt);
    const den = headGradeGpt * (concentrateGradeGpt - tailsGradeGpt);
    twoProductR = Math.max(0, Math.min(100, (num / Math.max(0.001, den)) * 100));
  }

  return {
    crushingSpecificEnergyKwhPerT: Number(crushSpec.toFixed(2)),
    millingSpecificEnergyKwhPerT: Number(millSpec.toFixed(2)),
    totalSpecificEnergyKwhPerT: Number(totalSpec.toFixed(2)),
    simpleGoldRecoveryPercent: Number(simpleR.toFixed(2)),
    twoProductGoldRecoveryPercent: twoProductR ? Number(twoProductR.toFixed(2)) : undefined,
  };
}

// Regression line & curve fitting for scatter plots
export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  points: Array<{ x: number; yPred: number; yLower: number; yUpper: number }>;
}

export function fitLinearRegression(
  data: Array<{ x: number; y: number }>
): RegressionResult {
  if (data.length < 2) {
    return { slope: 0, intercept: 0, r2: 0, points: [] };
  }

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const d of data) {
    sumX += d.x;
    sumY += d.y;
    sumXY += d.x * d.y;
    sumXX += d.x * d.x;
  }

  const slope = (n * sumXY - sumX * sumY) / Math.max(1e-6, n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R2 and Residuals
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const d of data) {
    const pred = slope * d.x + intercept;
    ssTot += Math.pow(d.y - meanY, 2);
    ssRes += Math.pow(d.y - pred, 2);
  }
  const r2 = Math.max(0, 1 - ssRes / Math.max(1e-6, ssTot));
  const se = Math.sqrt(ssRes / Math.max(1, n - 2));

  // Generate regression points
  const minX = Math.min(...data.map((d) => d.x));
  const maxX = Math.max(...data.map((d) => d.x));
  const step = Math.max(1, (maxX - minX) / 10);
  const points: Array<{ x: number; yPred: number; yLower: number; yUpper: number }> = [];

  for (let x = minX; x <= maxX; x += step) {
    const yPred = slope * x + intercept;
    points.push({
      x: Number(x.toFixed(1)),
      yPred: Number(yPred.toFixed(2)),
      yLower: Number((yPred - 1.96 * se).toFixed(2)),
      yUpper: Number((yPred + 1.96 * se).toFixed(2)),
    });
  }

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    points,
  };
}
