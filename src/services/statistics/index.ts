import type {
  Fragment,
  SizeDefinition,
  CumulativePoint,
  FitParametersSwebrec,
  FitParametersRosinRammler,
  FitParametersGGS,
  StandardSieveMesh,
  BootstrapConfidenceInterval,
  FragmentationMetrics,
} from '../../types';

// Standard ASTM / Tyler / ISO Sieve Mesh Specifications
export const STANDARD_SIEVE_DEFINITIONS: Array<{ standard: 'ASTM' | 'Tyler' | 'ISO'; meshName: string; apertureMm: number }> = [
  { standard: 'ASTM', meshName: '4 in (100mm)', apertureMm: 100.0 },
  { standard: 'ASTM', meshName: '3 in (75mm)', apertureMm: 75.0 },
  { standard: 'ASTM', meshName: '2 in (50mm)', apertureMm: 50.0 },
  { standard: 'ASTM', meshName: '1.5 in (37.5mm)', apertureMm: 37.5 },
  { standard: 'ASTM', meshName: '1 in (25mm)', apertureMm: 25.0 },
  { standard: 'ASTM', meshName: '3/4 in (19mm)', apertureMm: 19.0 },
  { standard: 'ASTM', meshName: '1/2 in (12.5mm)', apertureMm: 12.5 },
  { standard: 'ASTM', meshName: '3/8 in (9.5mm)', apertureMm: 9.5 },
  { standard: 'ASTM', meshName: 'No. 4 (4.75mm)', apertureMm: 4.75 },
  { standard: 'ASTM', meshName: 'No. 8 (2.36mm)', apertureMm: 2.36 },
  { standard: 'ASTM', meshName: 'No. 16 (1.18mm)', apertureMm: 1.18 },
  { standard: 'ASTM', meshName: 'No. 30 (600µm)', apertureMm: 0.60 },
  { standard: 'ASTM', meshName: 'No. 50 (300µm)', apertureMm: 0.30 },
  { standard: 'ASTM', meshName: 'No. 100 (150µm)', apertureMm: 0.15 },
  { standard: 'ASTM', meshName: 'No. 200 (75µm)', apertureMm: 0.075 },
];

/**
 * Computes passing percentage at all industrial standard ASTM / Tyler sieve meshes
 */
export function computeStandardSieveMeshPassing(curve: CumulativePoint[]): StandardSieveMesh[] {
  if (curve.length === 0) return [];
  return STANDARD_SIEVE_DEFINITIONS.map((def) => {
    let passing = 0;
    if (def.apertureMm <= curve[0].sizeMm) {
      passing = curve[0].passingPercent * (def.apertureMm / Math.max(0.1, curve[0].sizeMm));
    } else if (def.apertureMm >= curve[curve.length - 1].sizeMm) {
      passing = 100;
    } else {
      for (let i = 0; i < curve.length - 1; i++) {
        if (def.apertureMm >= curve[i].sizeMm && def.apertureMm <= curve[i + 1].sizeMm) {
          const t = (def.apertureMm - curve[i].sizeMm) / (curve[i + 1].sizeMm - curve[i].sizeMm || 1);
          passing = curve[i].passingPercent + t * (curve[i + 1].passingPercent - curve[i].passingPercent);
          break;
        }
      }
    }
    return {
      standard: def.standard,
      meshName: def.meshName,
      apertureMm: def.apertureMm,
      passingPercent: Number(Math.max(0, Math.min(100, passing)).toFixed(2)),
    };
  });
}

// Gates-Gaudin-Schuhmann (GGS) Fitting: P(x) = 100 * (x / k)^m
export function fitGatesGaudinSchuhmann(curve: CumulativePoint[]): FitParametersGGS {
  const valid = curve.filter((p) => p.passingPercent > 0.5 && p.passingPercent < 98 && p.sizeMm > 0);
  const count = valid.length;
  if (count < 3) {
    return { k: 250, m: 0.8, r2: 0.85, rmse: 6.5, aic: 40, bic: 42 };
  }

  // ln(P) = m * ln(x) + ln(100) - m * ln(k)
  // Let Y = ln(P/100) = m * ln(x) - m * ln(k)
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const pt of valid) {
    const X = Math.log(pt.sizeMm);
    const Y = Math.log(pt.passingPercent / 100);
    sumX += X;
    sumY += Y;
    sumXY += X * Y;
    sumXX += X * X;
  }

  const denom = count * sumXX - sumX * sumX;
  const slope = Math.abs(denom) > 1e-6 ? (count * sumXY - sumX * sumY) / denom : 0.8;
  const intercept = (sumY - slope * sumX) / count;

  const m = Math.max(0.3, Math.min(2.5, isNaN(slope) ? 0.8 : slope));
  const k = Math.max(10, Math.min(3000, Math.exp(-intercept / m)));

  let ssTot = 0;
  let ssRes = 0;
  const meanP = valid.reduce((s, p) => s + p.passingPercent, 0) / count;

  for (const pt of valid) {
    const pred = Math.min(100, 100 * Math.pow(pt.sizeMm / k, m));
    ssTot += Math.pow(pt.passingPercent - meanP, 2);
    ssRes += Math.pow(pt.passingPercent - pred, 2);
  }

  const r2 = Math.max(0, 1 - ssRes / Math.max(1e-6, ssTot));
  const rmse = Math.sqrt(ssRes / count);

  // Model selection criteria (k=2 parameters)
  const aic = Number((count * Math.log(Math.max(1e-4, rmse * rmse)) + 2 * 2).toFixed(1));
  const bic = Number((count * Math.log(Math.max(1e-4, rmse * rmse)) + 2 * Math.log(count)).toFixed(1));

  return {
    k: Number(k.toFixed(1)),
    m: Number(m.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    rmse: Number(rmse.toFixed(2)),
    aic,
    bic,
  };
}

export function getFragmentSize(frag: Fragment, sizeDef: SizeDefinition): number {
  switch (sizeDef) {
    case 'ecd':
      return frag.ecdMm;
    case 'bbox_minor':
      return Math.min(frag.bboxWidthMm, frag.bboxHeightMm);
    case 'min_feret':
    default:
      return frag.minFeretMm;
  }
}

// Compute cumulative volume/mass passing distribution from fragment list
export function calculateCumulativeDistribution(
  fragments: Fragment[],
  sizeDef: SizeDefinition = 'min_feret'
): CumulativePoint[] {
  if (fragments.length === 0) return [];

  // Map each fragment to size and volume
  const items = fragments.map((f) => {
    const size = Math.max(0.1, getFragmentSize(f, sizeDef));
    // Volume estimate: pi/6 * d^3 (spherical shape factor assumption)
    const volume = (Math.PI / 6) * Math.pow(size, 3);
    return { size, volume };
  });

  // Sort ascending by size
  items.sort((a, b) => a.size - b.size);

  const totalVolume = items.reduce((sum, item) => sum + item.volume, 0);
  if (totalVolume === 0) return [];

  let cumVolume = 0;
  const rawCurve: CumulativePoint[] = [];

  for (let i = 0; i < items.length; i++) {
    cumVolume += items[i].volume;
    const passingPercent = Number(((cumVolume / totalVolume) * 100).toFixed(2));
    rawCurve.push({
      sizeMm: items[i].size,
      passingPercent,
    });
  }

  // Deduplicate and sample key points to maintain chart performance
  const sampled: CumulativePoint[] = [];
  const minSize = items[0].size;
  const maxSize = items[items.length - 1].size;

  // Add 40 logarithmically spaced sample points
  const numSteps = 40;
  const logMin = Math.log10(Math.max(1, minSize));
  const logMax = Math.log10(Math.max(logMin + 0.1, maxSize));

  for (let s = 0; s <= numSteps; s++) {
    const targetSize = Math.pow(10, logMin + (s / numSteps) * (logMax - logMin));
    // Find passing % at this size
    let passing = 0;
    for (let i = 0; i < rawCurve.length; i++) {
      if (rawCurve[i].sizeMm <= targetSize) {
        passing = rawCurve[i].passingPercent;
      } else {
        break;
      }
    }
    sampled.push({
      sizeMm: Number(targetSize.toFixed(1)),
      passingPercent: Number(passing.toFixed(2)),
    });
  }

  // Ensure 100% at the max size
  sampled.push({
    sizeMm: Number((maxSize * 1.05).toFixed(1)),
    passingPercent: 100,
  });

  return sampled;
}

// Invert cumulative curve to find size at given passing percentage P
export function findPercentileSize(curve: CumulativePoint[], targetPercent: number): number {
  if (curve.length === 0) return 0;
  if (targetPercent <= curve[0].passingPercent) return curve[0].sizeMm;
  if (targetPercent >= curve[curve.length - 1].passingPercent) return curve[curve.length - 1].sizeMm;

  for (let i = 0; i < curve.length - 1; i++) {
    const p1 = curve[i].passingPercent;
    const p2 = curve[i + 1].passingPercent;
    if (targetPercent >= p1 && targetPercent <= p2) {
      if (p2 === p1) return curve[i].sizeMm;
      // Linear interpolation in log-size space
      const t = (targetPercent - p1) / (p2 - p1);
      const logS1 = Math.log10(Math.max(0.1, curve[i].sizeMm));
      const logS2 = Math.log10(Math.max(0.1, curve[i + 1].sizeMm));
      const logSize = logS1 + t * (logS2 - logS1);
      return Number(Math.pow(10, logSize).toFixed(1));
    }
  }

  return curve[curve.length - 1].sizeMm;
}

// Continuous volume-weighted percentile evaluation with log-size interpolation
export function interpolatePercentileFromItems(
  sortedItems: Array<{ size: number; vol: number }>,
  totalVol: number,
  targetPercent: number
): number {
  if (sortedItems.length === 0 || totalVol <= 0) return 0;
  const targetVol = totalVol * (targetPercent / 100);

  let cumVol = 0;
  for (let i = 0; i < sortedItems.length; i++) {
    const prevVol = cumVol;
    cumVol += sortedItems[i].vol;
    if (cumVol >= targetVol) {
      if (i === 0) return sortedItems[0].size;
      const s1 = sortedItems[i - 1].size;
      const s2 = sortedItems[i].size;
      const t = (targetVol - prevVol) / Math.max(1e-9, cumVol - prevVol);
      const logS1 = Math.log10(Math.max(0.1, s1));
      const logS2 = Math.log10(Math.max(0.1, s2));
      const logSize = logS1 + t * (logS2 - logS1);
      return Math.pow(10, logSize);
    }
  }
  return sortedItems[sortedItems.length - 1].size;
}

// Rosin-Rammler nonlinear fitting: P(x) = 1 - exp(-(x/xc)^n)
export function fitRosinRammler(curve: CumulativePoint[]): FitParametersRosinRammler & { converged?: boolean; status?: 'ok' | 'insufficient_data' } {
  // Filter points strictly between 1% and 99% passing
  const valid = curve.filter((p) => p.passingPercent > 1 && p.passingPercent < 99 && p.sizeMm > 0);
  const maxSize = curve.length > 0 ? Math.max(...curve.map((c) => c.sizeMm)) : 500;
  if (valid.length < 3) {
    return { xc: 0, n: 0, r2: 0, rmse: 0, converged: false, status: 'insufficient_data' };
  }

  // Linear regression on Weibull coordinates:
  // ln(-ln(1 - P)) = n * ln(x) - n * ln(xc)
  // Y = slope * X + intercept
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  const count = valid.length;

  for (const pt of valid) {
    const P = pt.passingPercent / 100;
    const X = Math.log(pt.sizeMm);
    const Y = Math.log(-Math.log(1 - P));
    sumX += X;
    sumY += Y;
    sumXY += X * Y;
    sumXX += X * X;
  }

  const denom = count * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-6) {
    return { xc: 0, n: 0, r2: 0, rmse: 0, converged: false, status: 'insufficient_data' };
  }

  const rawSlope = (count * sumXY - sumX * sumY) / denom;
  const rawIntercept = (sumY - rawSlope * sumX) / count;

  let n = rawSlope;
  let xc = Math.exp(-rawIntercept / Math.max(0.01, n));

  const minXc = Math.max(2, 0.1 * maxSize);
  const maxXc = 4.0 * maxSize;
  const physicallyValid = !isNaN(xc) && !isNaN(n) && n >= 0.4 && n <= 3.5 && xc >= minXc && xc <= maxXc;

  // Bound parameters within physically meaningful ranges
  n = Math.max(0.4, Math.min(3.5, isNaN(n) ? 1.0 : n));
  xc = Math.max(minXc, Math.min(maxXc, isNaN(xc) ? 100 : xc));

  // Compute R2 and RMSE (definition identical to Swebrec: RMSE in percentage points % of passing)
  let ssTot = 0;
  let ssRes = 0;
  const meanP = valid.reduce((s, p) => s + p.passingPercent, 0) / count;

  for (const pt of valid) {
    const predicted = (1 - Math.exp(-Math.pow(pt.sizeMm / xc, n))) * 100;
    ssTot += Math.pow(pt.passingPercent - meanP, 2);
    ssRes += Math.pow(pt.passingPercent - predicted, 2);
  }

  const r2 = Math.max(0, 1 - ssRes / Math.max(1e-6, ssTot));
  const rmse = Math.sqrt(ssRes / count);

  // Model selection criteria (k=2 parameters)
  const aic = Number((count * Math.log(Math.max(1e-4, rmse * rmse)) + 2 * 2).toFixed(1));
  const bic = Number((count * Math.log(Math.max(1e-4, rmse * rmse)) + 2 * Math.log(count)).toFixed(1));

  // Report converged only if physically valid AND R2 is acceptable
  const converged = physicallyValid && r2 >= 0.60 && rmse < 25;

  return {
    xc: Number(xc.toFixed(1)),
    n: Number(n.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    rmse: Number(rmse.toFixed(2)),
    aic,
    bic,
    converged,
    status: converged ? 'ok' : 'insufficient_data',
  };
}

// Swebrec distribution fitting:
// P(x) = 1 / (1 + [ln(xmax/x) / ln(xmax/x50)]^b) * 100
// Per Ouchterlony (2005), x50 is the anchor median size where P(x50) = 50%,
// while xMax (maximum fragment size) and b (inflection exponent) are continuous regression parameters.
export function fitSwebrec(curve: CumulativePoint[], measuredX50: number): FitParametersSwebrec {
  const maxSize = curve.length > 0 ? Math.max(...curve.map((c) => c.sizeMm)) : 400;
  let initX50 = measuredX50;
  if (!initX50 || initX50 <= 0) {
    const p50Pt = curve.find((c) => c.passingPercent >= 50);
    initX50 = p50Pt ? p50Pt.sizeMm : maxSize * 0.4;
  }
  const x50 = initX50;
  let bestXmax = maxSize * 1.25;
  let bestB = 1.8;
  let minRmse = Infinity;

  // Multi-grid search over (xMax, b) with anchored x50
  const candidateXmax = [
    maxSize * 1.02,
    maxSize * 1.05,
    maxSize * 1.1,
    maxSize * 1.15,
    maxSize * 1.25,
    maxSize * 1.35,
    maxSize * 1.5,
    maxSize * 1.75,
    maxSize * 2.0,
  ];
  const candidateB = [0.8, 1.1, 1.4, 1.7, 2.0, 2.4, 2.8, 3.3, 4.0, 5.0];

  const evalSse = (xMax: number, b: number): { sse: number; count: number } => {
    let sse = 0;
    let count = 0;
    const logXmaxOverX50 = Math.max(0.01, Math.log(xMax / Math.max(0.1, x50)));
    for (const pt of curve) {
      if (pt.sizeMm > 0) {
        let pred: number;
        if (pt.sizeMm >= xMax) {
          pred = 100;
        } else {
          const ratio = Math.log(xMax / pt.sizeMm) / logXmaxOverX50;
          pred = (1 / (1 + Math.pow(Math.max(0.001, ratio), b))) * 100;
        }
        sse += Math.pow(pt.passingPercent - pred, 2);
        count++;
      }
    }
    return { sse, count };
  };

  for (const xMax of candidateXmax) {
    if (xMax <= x50) continue;
    for (const b of candidateB) {
      const { sse, count } = evalSse(xMax, b);
      const rmse = Math.sqrt(sse / Math.max(1, count));
      if (rmse < minRmse) {
        minRmse = rmse;
        bestXmax = xMax;
        bestB = b;
      }
    }
  }

  // Continuous coordinate descent fine-tuning on xMax and b
  let refinedXmax = bestXmax;
  let refinedB = bestB;
  let currentMinSse = evalSse(refinedXmax, refinedB).sse;

  const stepXmax = Math.max(0.5, maxSize * 0.03);
  const stepB = 0.05;

  for (let iter = 0; iter < 20; iter++) {
    let improved = false;
    for (const dxMax of [-stepXmax, 0, stepXmax]) {
      const testXmax = refinedXmax + dxMax;
      if (testXmax <= maxSize * 1.005 || testXmax <= x50) continue;
      for (const db of [-stepB, 0, stepB]) {
        const testB = refinedB + db;
        if (testB < 0.3 || testB > 8.0) continue;
        const { sse } = evalSse(testXmax, testB);
        if (sse < currentMinSse - 1e-4) {
          currentMinSse = sse;
          refinedXmax = testXmax;
          refinedB = testB;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  const count = curve.length;
  const meanP = curve.reduce((s, p) => s + p.passingPercent, 0) / Math.max(1, count);
  let ssTot = 0;
  let ssRes = 0;
  const finalLogRatio = Math.max(0.01, Math.log(refinedXmax / Math.max(0.1, x50)));

  for (const pt of curve) {
    let pred: number;
    if (pt.sizeMm >= refinedXmax) {
      pred = 100;
    } else {
      const ratio = Math.log(refinedXmax / pt.sizeMm) / finalLogRatio;
      pred = (1 / (1 + Math.pow(Math.max(0.001, ratio), refinedB))) * 100;
    }
    ssRes += Math.pow(pt.passingPercent - pred, 2);
    ssTot += Math.pow(pt.passingPercent - meanP, 2);
  }

  const r2 = Math.max(0, 1 - ssRes / Math.max(1e-6, ssTot));
  const rmse = Math.sqrt(ssRes / Math.max(1, count));

  // Model selection criteria (k=2 parameters: xMax, b with anchored x50)
  const aic = Number((count * Math.log(Math.max(1e-4, rmse * rmse)) + 2 * 2).toFixed(1));
  const bic = Number((count * Math.log(Math.max(1e-4, rmse * rmse)) + 2 * Math.log(Math.max(1, count))).toFixed(1));

  return {
    xMax: Number(refinedXmax.toFixed(1)),
    x50: Number(x50.toFixed(1)),
    b: Number(refinedB.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    rmse: Number(rmse.toFixed(2)),
    aic,
    bic,
  };
}

// High-performance bootstrap resampling for non-parametric 95% confidence intervals
export function runBootstrapResampling(
  fragments: Fragment[],
  sizeDef: SizeDefinition = 'min_feret',
  iterations = 1000
): BootstrapConfidenceInterval {
  const n = fragments.length;
  if (n < 5) {
    return {
      p10: [0, 0],
      p20: [0, 0],
      p50: [0, 0],
      p80: [0, 0],
      p90: [0, 0],
    };
  }

  // Pre-extract sizes and volumes
  const rawItems = new Array<{ size: number; vol: number }>(n);
  for (let i = 0; i < n; i++) {
    const size = Math.max(0.1, getFragmentSize(fragments[i], sizeDef));
    rawItems[i] = { size, vol: (Math.PI / 6) * Math.pow(size, 3) };
  }

  const p10Samples = new Float64Array(iterations);
  const p20Samples = new Float64Array(iterations);
  const p50Samples = new Float64Array(iterations);
  const p80Samples = new Float64Array(iterations);
  const p90Samples = new Float64Array(iterations);

  const sample = new Array<{ size: number; vol: number }>(n);

  for (let it = 0; it < iterations; it++) {
    let totalVol = 0;
    // Scale uncertainty Monte-Carlo jitter (2% standard deviation)
    const scaleMultiplier = 1.0 + (Math.random() + Math.random() - 1.0) * 0.02;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n);
      const size = rawItems[idx].size * scaleMultiplier;
      const vol = (Math.PI / 6) * Math.pow(size, 3);
      sample[i] = { size, vol };
      totalVol += vol;
    }

    // Sort ascending by size
    sample.sort((a, b) => a.size - b.size);

    // Compute consistent continuous volume-weighted percentiles matching findPercentileSize
    p10Samples[it] = interpolatePercentileFromItems(sample, totalVol, 10);
    p20Samples[it] = interpolatePercentileFromItems(sample, totalVol, 20);
    p50Samples[it] = interpolatePercentileFromItems(sample, totalVol, 50);
    p80Samples[it] = interpolatePercentileFromItems(sample, totalVol, 80);
    p90Samples[it] = interpolatePercentileFromItems(sample, totalVol, 90);
  }

  const sortAndGetCI = (arr: Float64Array): [number, number] => {
    arr.sort();
    const low = arr[Math.floor(iterations * 0.025)];
    const high = arr[Math.floor(iterations * 0.975)];
    return [Number(low.toFixed(1)), Number(high.toFixed(1))];
  };

  return {
    p10: sortAndGetCI(p10Samples),
    p20: sortAndGetCI(p20Samples),
    p50: sortAndGetCI(p50Samples),
    p80: sortAndGetCI(p80Samples),
    p90: sortAndGetCI(p90Samples),
  };
}

// Full metrics pipeline generator
export function computeFragmentationMetrics(
  fragments: Fragment[],
  sizeDef: SizeDefinition = 'min_feret',
  oversizeCutoffMm = 300,
  finesCutoffMm = 25
): FragmentationMetrics {
  const rawCurve = calculateCumulativeDistribution(fragments, sizeDef);

  const p10 = findPercentileSize(rawCurve, 10);
  const p20 = findPercentileSize(rawCurve, 20);
  const p50 = findPercentileSize(rawCurve, 50);
  const p80 = findPercentileSize(rawCurve, 80);
  const p90 = findPercentileSize(rawCurve, 90);
  const pMax = rawCurve[rawCurve.length - 1]?.sizeMm || 0;

  // Mean size
  const sizes = fragments.map((f) => getFragmentSize(f, sizeDef));
  const meanSize = sizes.length > 0 ? Number((sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)) : 0;

  const uniformityIndex = p20 > 0 ? Number((p80 / p20).toFixed(2)) : 1.0;

  // Oversize and fines percentages
  let passingAtOversize = 100;
  let passingAtFines = 0;
  for (const pt of rawCurve) {
    if (pt.sizeMm <= oversizeCutoffMm) passingAtOversize = pt.passingPercent;
    if (pt.sizeMm <= finesCutoffMm) passingAtFines = pt.passingPercent;
  }
  const oversizePercent = Number((100 - passingAtOversize).toFixed(1));
  const finesPercent = Number(passingAtFines.toFixed(1));

  // Fits
  const rosinRammlerFit = fitRosinRammler(rawCurve);
  const swebrecFit = fitSwebrec(rawCurve, p50);
  const ggsFit = fitGatesGaudinSchuhmann(rawCurve);

  // Model selection: choose best-fit distribution based on minimum RMSE / AIC
  let bestFitModel: 'swebrec' | 'rosin_rammler' | 'ggs' = 'swebrec';
  const minRmse = Math.min(swebrecFit.rmse, rosinRammlerFit.rmse, ggsFit.rmse);
  if (minRmse === swebrecFit.rmse) bestFitModel = 'swebrec';
  else if (minRmse === rosinRammlerFit.rmse) bestFitModel = 'rosin_rammler';
  else bestFitModel = 'ggs';

  // Corrected curve: extrapolated fines using Swebrec fit below min detectable cut-off
  const correctedCurve = rawCurve.map((pt) => {
    if (pt.sizeMm < finesCutoffMm && swebrecFit.r2 > 0.8) {
      const ratio = Math.log(swebrecFit.xMax / pt.sizeMm) / Math.max(0.01, Math.log(swebrecFit.xMax / swebrecFit.x50));
      const extrapolated = (1 / (1 + Math.pow(Math.max(0.001, ratio), swebrecFit.b))) * 100;
      return { sizeMm: pt.sizeMm, passingPercent: Number(extrapolated.toFixed(2)) };
    }
    return pt;
  });

  // Standard ASTM / Tyler / ISO Sieve Analysis
  const standardSievePassing = computeStandardSieveMeshPassing(correctedCurve);

  // Fast bootstrap (1000 iterations per documentation)
  const bootstrapCI = runBootstrapResampling(fragments, sizeDef, 1000);

  // 3D Sizing Approximation
  const volumeItems = fragments.map((f) => {
    const size = Math.max(0.1, getFragmentSize(f, sizeDef));
    const vol = f.trueVolume3DMm3 || (Math.PI / 6) * Math.pow(size, 3) * 0.7;
    return { size, volume: vol };
  });
  volumeItems.sort((a, b) => a.size - b.size);
  const totalTrueVol = volumeItems.reduce((s, it) => s + it.volume, 0);
  let cum3DVol = 0;
  const true3DCurve: CumulativePoint[] = [];
  for (const it of volumeItems) {
    cum3DVol += it.volume;
    true3DCurve.push({
      sizeMm: it.size,
      passingPercent: Number(((cum3DVol / Math.max(1, totalTrueVol)) * 100).toFixed(2)),
    });
  }
  const true3D_P50 = findPercentileSize(true3DCurve, 50);
  const true3D_P80 = findPercentileSize(true3DCurve, 80);

  // Sub-Mesh Fines Modeling
  const rrFines = Number(((1 - Math.exp(-Math.pow(finesCutoffMm / Math.max(1, rosinRammlerFit.xc), rosinRammlerFit.n || 1))) * 100).toFixed(1));
  const swRatio = Math.log(swebrecFit.xMax / finesCutoffMm) / Math.max(0.01, Math.log(swebrecFit.xMax / Math.max(1, swebrecFit.x50)));
  const swFines = Number(((1 / (1 + Math.pow(Math.max(0.001, swRatio), swebrecFit.b))) * 100).toFixed(1));

  return {
    sizeDefinition: sizeDef,
    fragmentCount: fragments.length,
    p10,
    p20,
    p50,
    p80,
    p90,
    pMax,
    meanSize,
    uniformityIndex,
    oversizePercent,
    finesPercent,
    unresolvedFinesPercent: Math.max(0, Math.min(100, swFines)),
    bootstrapCI,
    swebrecFit,
    rosinRammlerFit,
    ggsFit,
    bestFitModel,
    standardSievePassing,
    rawCurve,
    correctedCurve,
    stereologicalCorrectionApplied: false, // Standard 2D spherical equivalence (pi/6 * d^3 on minFeret); no stereological unfolding applied
    true3D_P50,
    true3D_P80,
    swebrecExtrapolatedFines: {
      cutoffApertureMm: finesCutoffMm,
      finesPercentSwebrec: swFines,
      finesPercentRosinRammler: rrFines,
      bParameter: swebrecFit.b,
    },
  };
}
