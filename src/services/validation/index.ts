import type {
  GroundTruth,
  FragmentationMetrics,
  SieveDataGroundTruth,
} from '../../types';

export interface ValidationMetricsResult {
  engine: string;
  errorP20Percent: number;
  errorP50Percent: number;
  errorP80Percent: number;
  biasP20Mm: number;
  biasP50Mm: number;
  biasP80Mm: number;
  meanAbsErrorPercent: number;
  thresholdExceeded: boolean; // True if MAPE > threshold (default 15%)
}

// Compute cumulative passing curve and percentiles from sieve/screen data
export function computeSieveDistribution(sieveData: SieveDataGroundTruth[]): {
  curve: Array<{ sizeMm: number; passingPercent: number }>;
  p20: number;
  p50: number;
  p80: number;
} {
  if (sieveData.length === 0) {
    return { curve: [], p20: 0, p50: 0, p80: 0 };
  }

  // Sort descending by screen aperture mm
  const sorted = [...sieveData].sort((a, b) => b.apertureMm - a.apertureMm);

  const totalMass = sorted.reduce((sum, item) => sum + item.massRetainedKg, 0);
  if (totalMass === 0) return { curve: [], p20: 0, p50: 0, p80: 0 };

  let cumRetained = 0;
  // Calculate cumulative passing for each screen
  const points: Array<{ sizeMm: number; passingPercent: number }> = [];

  for (const item of sorted) {
    cumRetained += item.massRetainedKg;
    const passingPercent = Math.max(0, 100 - (cumRetained / totalMass) * 100);
    points.push({
      sizeMm: item.apertureMm,
      passingPercent: Number(passingPercent.toFixed(2)),
    });
  }

  // Sort ascending for curve representation
  points.sort((a, b) => a.sizeMm - b.sizeMm);

  const findP = (target: number) => {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i].passingPercent;
      const p2 = points[i + 1].passingPercent;
      if (target >= p1 && target <= p2) {
        const t = (target - p1) / Math.max(0.001, p2 - p1);
        return Math.round(points[i].sizeMm + t * (points[i + 1].sizeMm - points[i].sizeMm));
      }
    }
    return points[Math.floor(points.length / 2)]?.sizeMm || 100;
  };

  return {
    curve: points,
    p20: findP(20),
    p50: findP(50),
    p80: findP(80),
  };
}

export function computeValidationComparison(
  imageMetrics: FragmentationMetrics,
  groundTruth: GroundTruth,
  engineName = 'Engine A',
  thresholdPercent = 15
): ValidationMetricsResult {
  const gtP20 = groundTruth.computedP20 || 60;
  const gtP50 = groundTruth.computedP50 || 120;
  const gtP80 = groundTruth.computedP80 || 220;

  const biasP20 = imageMetrics.p20 - gtP20;
  const biasP50 = imageMetrics.p50 - gtP50;
  const biasP80 = imageMetrics.p80 - gtP80;

  const errP20 = (biasP20 / gtP20) * 100;
  const errP50 = (biasP50 / gtP50) * 100;
  const errP80 = (biasP80 / gtP80) * 100;

  const mape = (Math.abs(errP20) + Math.abs(errP50) + Math.abs(errP80)) / 3;

  return {
    engine: engineName,
    errorP20Percent: Number(errP20.toFixed(1)),
    errorP50Percent: Number(errP50.toFixed(1)),
    errorP80Percent: Number(errP80.toFixed(1)),
    biasP20Mm: Number(biasP20.toFixed(1)),
    biasP50Mm: Number(biasP50.toFixed(1)),
    biasP80Mm: Number(biasP80.toFixed(1)),
    meanAbsErrorPercent: Number(mape.toFixed(1)),
    thresholdExceeded: mape > thresholdPercent,
  };
}
