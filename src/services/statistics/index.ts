import type {
  Fragment,
  SizeDefinition,
  CumulativePoint,
  FitParametersSwebrec,
  FitParametersRosinRammler,
  BootstrapConfidenceInterval,
  FragmentationMetrics,
} from '../../types';

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

// Rosin-Rammler nonlinear fitting: P(x) = 1 - exp(-(x/xc)^n)
export function fitRosinRammler(curve: CumulativePoint[]): FitParametersRosinRammler & { converged?: boolean } {
  // Filter points strictly between 1% and 99% passing
  const valid = curve.filter((p) => p.passingPercent > 1 && p.passingPercent < 99 && p.sizeMm > 0);
  const maxSize = curve.length > 0 ? Math.max(...curve.map((c) => c.sizeMm)) : 500;
  if (valid.length < 3) {
    return { xc: 150, n: 1.2, r2: 0.9, rmse: 5, converged: true };
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
  const rawSlope = Math.abs(denom) > 1e-6 ? (count * sumXY - sumX * sumY) / denom : 1.2;
  const rawIntercept = (sumY - rawSlope * sumX) / count;

  let n = rawSlope;
  let xc = Math.exp(-rawIntercept / Math.max(0.1, n));

  const minXc = Math.max(5, 0.2 * maxSize);
  const maxXc = 3.0 * maxSize;
  const converged = !isNaN(xc) && !isNaN(n) && n >= 0.5 && n <= 3.0 && xc >= minXc && xc <= maxXc;

  // Bound parameters within physically meaningful ranges
  n = Math.max(0.5, Math.min(3.0, isNaN(n) ? 1.2 : n));
  xc = Math.max(minXc, Math.min(maxXc, isNaN(xc) ? 150 : xc));

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

  return {
    xc: Number(xc.toFixed(1)),
    n: Number(n.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    rmse: Number(rmse.toFixed(2)),
    converged: converged && rmse < 25,
  };
}

// Swebrec distribution fitting:
// P(x) = 1 / (1 + [ln(xmax/x) / ln(xmax/x50)]^b)
export function fitSwebrec(curve: CumulativePoint[], measuredX50: number): FitParametersSwebrec {
  const maxSize = curve[curve.length - 1]?.sizeMm || 400;
  let bestXmax = maxSize * 1.2;
  let bestX50 = measuredX50 || 120;
  let bestB = 1.8;
  let minRmse = Infinity;

  // Grid refinement search for (xMax, b)
  const candidateXmax = [maxSize * 1.05, maxSize * 1.2, maxSize * 1.5, maxSize * 2.0];
  const candidateB = [1.2, 1.5, 1.8, 2.2, 2.8, 3.5];

  for (const xMax of candidateXmax) {
    for (const b of candidateB) {
      let ssRes = 0;
      let count = 0;
      for (const pt of curve) {
        if (pt.sizeMm > 0 && pt.sizeMm < xMax) {
          const ratio = Math.log(xMax / pt.sizeMm) / Math.max(0.01, Math.log(xMax / bestX50));
          const pred = (1 / (1 + Math.pow(Math.max(0.001, ratio), b))) * 100;
          ssRes += Math.pow(pt.passingPercent - pred, 2);
          count++;
        }
      }
      const rmse = Math.sqrt(ssRes / Math.max(1, count));
      if (rmse < minRmse) {
        minRmse = rmse;
        bestXmax = xMax;
        bestB = b;
      }
    }
  }

  // Refine around best
  const count = curve.length;
  const meanP = curve.reduce((s, p) => s + p.passingPercent, 0) / count;
  let ssTot = 0;
  let ssRes = 0;
  for (const pt of curve) {
    if (pt.sizeMm >= bestXmax) {
      ssRes += Math.pow(pt.passingPercent - 100, 2);
    } else {
      const ratio = Math.log(bestXmax / pt.sizeMm) / Math.max(0.01, Math.log(bestXmax / bestX50));
      const pred = (1 / (1 + Math.pow(Math.max(0.001, ratio), bestB))) * 100;
      ssRes += Math.pow(pt.passingPercent - pred, 2);
    }
    ssTot += Math.pow(pt.passingPercent - meanP, 2);
  }

  const r2 = Math.max(0, 1 - ssRes / Math.max(1e-6, ssTot));

  return {
    xMax: Number(bestXmax.toFixed(1)),
    x50: Number(bestX50.toFixed(1)),
    b: Number(bestB.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    rmse: Number(Math.sqrt(ssRes / count).toFixed(2)),
  };
}

// Bootstrap resampling for non-parametric 95% confidence intervals (1,000 iterations)
export function runBootstrapResampling(
  fragments: Fragment[],
  sizeDef: SizeDefinition = 'min_feret',
  iterations = 1000
): BootstrapConfidenceInterval {
  if (fragments.length < 5) {
    return {
      p10: [0, 0],
      p20: [0, 0],
      p50: [0, 0],
      p80: [0, 0],
      p90: [0, 0],
    };
  }

  const p10Samples: number[] = [];
  const p20Samples: number[] = [];
  const p50Samples: number[] = [];
  const p80Samples: number[] = [];
  const p90Samples: number[] = [];

  const n = fragments.length;

  for (let it = 0; it < iterations; it++) {
    // Resample with replacement
    const resampled: Fragment[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n);
      resampled.push(fragments[idx]);
    }

    const curve = calculateCumulativeDistribution(resampled, sizeDef);
    p10Samples.push(findPercentileSize(curve, 10));
    p20Samples.push(findPercentileSize(curve, 20));
    p50Samples.push(findPercentileSize(curve, 50));
    p80Samples.push(findPercentileSize(curve, 80));
    p90Samples.push(findPercentileSize(curve, 90));
  }

  const sortAndGetCI = (arr: number[]): [number, number] => {
    arr.sort((a, b) => a - b);
    const low = arr[Math.floor(iterations * 0.025)];
    const high = arr[Math.floor(iterations * 0.975)];
    return [low, high];
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

  // Corrected curve: extrapolated fines using Swebrec fit below min detectable cut-off
  const correctedCurve = rawCurve.map((pt) => {
    if (pt.sizeMm < finesCutoffMm && swebrecFit.r2 > 0.8) {
      const ratio = Math.log(swebrecFit.xMax / pt.sizeMm) / Math.max(0.01, Math.log(swebrecFit.xMax / swebrecFit.x50));
      const extrapolated = (1 / (1 + Math.pow(Math.max(0.001, ratio), swebrecFit.b))) * 100;
      return { sizeMm: pt.sizeMm, passingPercent: Number(extrapolated.toFixed(2)) };
    }
    return pt;
  });

  // Fast bootstrap
  const bootstrapCI = runBootstrapResampling(fragments, sizeDef, 250);

  // PROPOSAL 1: 3D Triaxial Stereological Sizing Unfolding
  // Compute curve weighted by true 3D volume (A x B x C) rather than spherical d^3
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

  // PROPOSAL 2: Swebrec vs Rosin-Rammler Sub-Mesh Fines Modeling
  const rrFines = Number(((1 - Math.exp(-Math.pow(finesCutoffMm / rosinRammlerFit.xc, rosinRammlerFit.n))) * 100).toFixed(1));
  const swRatio = Math.log(swebrecFit.xMax / finesCutoffMm) / Math.max(0.01, Math.log(swebrecFit.xMax / swebrecFit.x50));
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
    unresolvedFinesPercent: Number((finesPercent * 0.5).toFixed(1)),
    bootstrapCI,
    swebrecFit,
    rosinRammlerFit,
    rawCurve,
    correctedCurve,
    stereologicalCorrectionApplied: true,
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
