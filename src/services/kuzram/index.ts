import type {
  BlastParameters,
  RockMass,
  KuzRamRockTables,
  KuzRamResult,
  BayesianCalibrationResult,
  BlastAdvisorTarget,
  BlastAdvisorRecommendation,
  CumulativePoint,
} from '../../types';

// Cunningham (1983, 1987, 2005) standard tables
export const DEFAULT_ROCK_TABLES: KuzRamRockTables = {
  rmd: 20, // 10 = powdery/friable, 20 = blocky, 50 = massive
  jf: 20, // 10 = vertical joints <0.1m, 20 = 0.1-1.0m, 50 = >1.0m
  jfo: 30, // 20 = dip out of face, 30 = strike perpendicular, 40 = dip into face
  density: 2.65, // t/m3, RDI = 25 * density - 50
  hf: 15, // E/30 (GPa) or UCS/5 (MPa)
};

export function calculateRockFactorA(tables: KuzRamRockTables): number {
  const rdi = 25 * tables.density - 50;
  // Cunningham (1987): A = 0.06 * (RMD + JPS + JPA + RDI + HF)
  const jps = tables.jf;
  const jpa = tables.jfo;
  const sum = tables.rmd + jps + jpa + rdi + tables.hf;
  const a = 0.06 * sum;
  return Number(Math.max(1, a).toFixed(2));
}

export function computeKuzRam(
  params: BlastParameters,
  rockMass: RockMass,
  customRockFactorA?: number
): KuzRamResult {
  const B = params.burden; // m
  const S = params.spacing; // m
  const D = params.holeDiameter; // mm
  const H = params.benchHeight; // m
  const W = params.drillingDeviationEstimate || 0.1; // m
  const Q = params.chargePerHole; // kg
  const E = params.rws || 100; // Relative Weight Strength, ANFO=100
  const BCL = params.bottomChargeLength; // m
  const CCL = params.columnChargeLength; // m
  const L = Math.max(0.1, BCL + CCL); // Total charge length (m)

  // Powder factor K (kg/m3) = Q / (B * S * H)
  const volumePerHole = B * S * H;
  const K = Math.max(0.1, Q / Math.max(0.1, volumePerHole));

  // Rock Factor A
  let A = customRockFactorA;
  if (!A) {
    // JPA: dip out of face = 20, strike perpendicular = 30, dip into face = 40
    let jpaVal = 30;
    if (rockMass.jointOrientation === 'dip_out_of_face') jpaVal = 20;
    else if (rockMass.jointOrientation === 'dip_into_face') jpaVal = 40;

    // JPS: Joint spacing (<0.1m = 10, 0.1-1.0m = 20, >1.0m = 50)
    let jpsVal = 20;
    if (rockMass.meanJointSpacing < 0.1) jpsVal = 10;
    else if (rockMass.meanJointSpacing > 1.0) jpsVal = 50;

    // HF: Hardness Factor = E/3 if E < 50 GPa, otherwise UCS/5
    let hfVal = 15;
    if (rockMass.youngsModulusGPa && rockMass.youngsModulusGPa < 50) {
      hfVal = rockMass.youngsModulusGPa / 3;
    } else if (rockMass.ucsMPa) {
      hfVal = rockMass.ucsMPa / 5;
    }

    const tables: KuzRamRockTables = {
      rmd: rockMass.estimatedGsiOrRmr && rockMass.estimatedGsiOrRmr < 40 ? 10 : 20,
      jf: jpsVal,
      jfo: jpaVal,
      density: rockMass.density || 2.68,
      hf: hfVal,
    };
    A = calculateRockFactorA(tables);
  }

  // Mean size X50 in cm: Cunningham (1987)
  // X50 = A * K^(-0.8) * Q^(1/6) * (115 / E)^(19/30)
  const x50Cm = A * Math.pow(K, -0.8) * Math.pow(Q, 1 / 6) * Math.pow(115 / E, 19 / 30);
  const x50Mm = x50Cm * 10;

  // Uniformity Index n: Cunningham (1987, 2005)
  // n = (2.2 - 14 * B/D) * sqrt((1 + S/B)/2) * (1 - W/B) * ((|BCL - CCL|/L + 0.1)^0.1) * (L/H)
  const term1 = 2.2 - 14 * (B / Math.max(1, D / 1000));
  const term2 = Math.sqrt((1 + S / Math.max(0.1, B)) / 2);
  const term3 = Math.max(0.1, 1 - W / Math.max(0.1, B));
  const diffCharge = Math.abs(BCL - CCL);
  const term4 = Math.pow(diffCharge / Math.max(0.1, L) + 0.1, 0.1);
  const term5 = Math.min(1.5, Math.max(0.3, L / Math.max(0.1, H)));

  let n = term1 * term2 * term3 * term4 * term5;
  if (isNaN(n) || n < 0.6) n = 0.8;
  if (n > 2.5) n = 2.2;
  n = Number(n.toFixed(2));

  // Characteristic size xc (Rosin-Rammler)
  // xc = X50 / (ln 2)^(1/n) = X50 / (0.693147)^(1/n)
  const xcMm = x50Mm / Math.pow(0.693147, 1 / n);

  // Cumulative passing: P(x) = 1 - exp(-(x/xc)^n)
  const evalPassing = (sizeMm: number) => {
    if (sizeMm <= 0) return 0;
    const frac = 1 - Math.exp(-Math.pow(sizeMm / xcMm, n));
    return Number((frac * 100).toFixed(2));
  };

  // Find percentiles by inverting: x = xc * (-ln(1 - P))^(1/n)
  const evalSizeForP = (pPercent: number) => {
    const P = pPercent / 100;
    return Number((xcMm * Math.pow(-Math.log(1 - P), 1 / n)).toFixed(1));
  };

  const curve: CumulativePoint[] = [
    { sizeMm: 2, passingPercent: evalPassing(2) },
    { sizeMm: 5, passingPercent: evalPassing(5) },
    { sizeMm: 10, passingPercent: evalPassing(10) },
    { sizeMm: 25, passingPercent: evalPassing(25) },
    { sizeMm: 50, passingPercent: evalPassing(50) },
    { sizeMm: 75, passingPercent: evalPassing(75) },
    { sizeMm: 100, passingPercent: evalPassing(100) },
    { sizeMm: 150, passingPercent: evalPassing(150) },
    { sizeMm: 200, passingPercent: evalPassing(200) },
    { sizeMm: 250, passingPercent: evalPassing(250) },
    { sizeMm: 300, passingPercent: evalPassing(300) },
    { sizeMm: 400, passingPercent: evalPassing(400) },
    { sizeMm: 500, passingPercent: evalPassing(500) },
    { sizeMm: 600, passingPercent: evalPassing(600) },
    { sizeMm: 800, passingPercent: evalPassing(800) },
  ];

  // KCO Model (Kuz-Ram-Cunningham-Ouchterlony 2005) Extension
  // xMax bounded by in-situ block size or bench geometry
  const inSituBlockSizeMm = Math.max(300, (rockMass.meanJointSpacing || 0.5) * 1000 * 1.5);
  const xMaxMm = Math.min(inSituBlockSizeMm, Math.max(x50Mm * 2.5, H * 1000 * 0.35));
  const bParam = Number((0.17 * Math.log(Math.max(1.1, xMaxMm / Math.max(1, x50Mm))) * Math.pow(n, 0.8)).toFixed(2));

  const evalKcoPassing = (sizeMm: number) => {
    if (sizeMm <= 0) return 0;
    if (sizeMm >= xMaxMm) return 100;
    const ratio = Math.log(xMaxMm / sizeMm) / Math.max(0.001, Math.log(xMaxMm / x50Mm));
    const frac = 1 / (1 + Math.pow(Math.max(0.001, ratio), bParam));
    return Number((frac * 100).toFixed(2));
  };

  const kcoCurve: CumulativePoint[] = [
    { sizeMm: 2, passingPercent: evalKcoPassing(2) },
    { sizeMm: 5, passingPercent: evalKcoPassing(5) },
    { sizeMm: 10, passingPercent: evalKcoPassing(10) },
    { sizeMm: 25, passingPercent: evalKcoPassing(25) },
    { sizeMm: 50, passingPercent: evalKcoPassing(50) },
    { sizeMm: 75, passingPercent: evalKcoPassing(75) },
    { sizeMm: 100, passingPercent: evalKcoPassing(100) },
    { sizeMm: 150, passingPercent: evalKcoPassing(150) },
    { sizeMm: 200, passingPercent: evalKcoPassing(200) },
    { sizeMm: 250, passingPercent: evalKcoPassing(250) },
    { sizeMm: 300, passingPercent: evalKcoPassing(300) },
    { sizeMm: 400, passingPercent: evalKcoPassing(400) },
    { sizeMm: 500, passingPercent: evalKcoPassing(500) },
    { sizeMm: 600, passingPercent: evalKcoPassing(600) },
    { sizeMm: 800, passingPercent: evalKcoPassing(800) },
  ];

  // Flyrock Safety Analysis (Richards & Moore 2004 / Lundborg 1981)
  // Face burst throw (m), Cratering throw (m), Rifling throw (m)
  const dInches = D / 25.4;
  const kfFace = 13.5;
  const kfCrater = 9.8;
  const kfRifling = 17.5;
  const chargePerMeter = Q / Math.max(0.5, L);
  const faceThrow = Number(((kfFace * Math.pow(chargePerMeter, 2/3)) / Math.max(1, B)).toFixed(1));
  const craterThrow = Number(((kfCrater * Math.pow(chargePerMeter, 2/3)) / Math.max(1, params.stemmingLength || B)).toFixed(1));
  const riflingThrow = Number((kfRifling * Math.pow(dInches, 2/3)).toFixed(1));
  const maxFlyrock = Math.max(faceThrow, craterThrow, riflingThrow);
  const safetyFactor = 2.0; // ISEE Safety Guideline
  const personnelEvacM = Math.round(maxFlyrock * safetyFactor);
  const equipmentEvacM = Math.round(maxFlyrock * 1.35);

  // Energy & Greenhouse Gas Metrics
  const rockDensityTPerM3 = rockMass.density || 2.65;
  const totalVolumeM3 = volumePerHole * (params.numberOfHoles || 1);
  const totalTonnes = totalVolumeM3 * rockDensityTPerM3;
  const powderFactorKgPerTonne = Number((K / rockDensityTPerM3).toFixed(3));
  // ANFO heat of explosion ~ 3.7 MJ/kg
  const energyFactorMjPerTonne = Number((powderFactorKgPerTonne * 3.7 * (E / 100)).toFixed(2));
  const specificDrillingM = Number(((H + (params.subdrill || 0.8)) / Math.max(1, volumePerHole)).toFixed(3));
  // CO2 emissions: ANFO detonation ~ 0.176 kg CO2 / kg explosive
  const co2PerTonne = Number((powderFactorKgPerTonne * 0.176).toFixed(4));
  const totalExplosiveKg = Q * (params.numberOfHoles || 1);
  const totalCo2Kg = Math.round(totalExplosiveKg * 0.176);

  return {
    rockFactorA: A,
    meanSizeX50Cm: Number(x50Cm.toFixed(2)),
    meanSizeX50Mm: Number(x50Mm.toFixed(1)),
    uniformityIndexN: n,
    characteristicSizeXcMm: Number(xcMm.toFixed(1)),
    p10Mm: evalSizeForP(10),
    p20Mm: evalSizeForP(20),
    p50Mm: evalSizeForP(50),
    p80Mm: evalSizeForP(80),
    p90Mm: evalSizeForP(90),
    curve,
    kcoResult: {
      xMaxMm: Number(xMaxMm.toFixed(1)),
      bParameter: bParam,
      curve: kcoCurve,
    },
    flyrock: {
      faceBurdenThrowM: faceThrow,
      crateringThrowM: craterThrow,
      riflingThrowM: riflingThrow,
      maxFlyrockDistanceM: maxFlyrock,
      safetyFactor,
      personnelEvacuationDistanceM: personnelEvacM,
      equipmentEvacuationDistanceM: equipmentEvacM,
    },
    energy: {
      powderFactorKgPerM3: Number(K.toFixed(2)),
      powderFactorKgPerTonne,
      energyFactorMjPerTonne,
      specificDrillingMPerM3: specificDrillingM,
      co2EmissionsKgPerTonne: co2PerTonne,
      totalCo2EmissionsKg: totalCo2Kg,
    },
  };
}

// Bayesian Calibration of Rock Factor A using Metropolis-Hastings MCMC
export function runBayesianCalibration(
  priorMeanA: number,
  priorStdA: number,
  observations: Array<{ measuredX50Mm: number; params: BlastParameters; rockMass: RockMass; errorStdMm: number }>,
  numSamples = 4000,
  burnIn = 1000
): BayesianCalibrationResult {
  if (observations.length === 0) {
    return {
      priorMeanA,
      priorStdA,
      posteriorMeanA: priorMeanA,
      posteriorStdA: priorStdA,
      credibleInterval95A: [Math.max(1, priorMeanA - 1.96 * priorStdA), priorMeanA + 1.96 * priorStdA],
      acceptanceRate: 1.0,
      mcmcSamplesA: [priorMeanA],
      predictiveCurve: [],
    };
  }

  // Log-prior: log-normal prior on A > 0
  const logPrior = (a: number) => {
    if (a <= 0.5 || a > 30) return -Infinity;
    // Log-normal parameterization
    const logMean = Math.log(priorMeanA);
    const logStd = Math.max(0.1, priorStdA / priorMeanA);
    const z = (Math.log(a) - logMean) / logStd;
    return -0.5 * z * z - Math.log(a * logStd);
  };

  // Log-likelihood
  const logLikelihood = (a: number) => {
    let sum = 0;
    for (const obs of observations) {
      const pred = computeKuzRam(obs.params, obs.rockMass, a);
      const diff = obs.measuredX50Mm - pred.meanSizeX50Mm;
      const sigma = Math.max(5, obs.errorStdMm || 15);
      sum += -0.5 * Math.pow(diff / sigma, 2) - Math.log(sigma);
    }
    return sum;
  };

  const logPosterior = (a: number) => logPrior(a) + logLikelihood(a);

  // Metropolis-Hastings
  let currentA = priorMeanA;
  let currentLogPost = logPosterior(currentA);
  const samples: number[] = [];
  let accepted = 0;
  const proposalStd = 0.35;

  for (let step = 0; step < numSamples + burnIn; step++) {
    // Random walk proposal in log space
    const candidateA = currentA * Math.exp((Math.random() - 0.5) * proposalStd);
    const candidateLogPost = logPosterior(candidateA);
    const logAlpha = candidateLogPost - currentLogPost;

    if (Math.log(Math.random()) < logAlpha) {
      currentA = candidateA;
      currentLogPost = candidateLogPost;
      if (step >= burnIn) accepted++;
    }

    if (step >= burnIn) {
      samples.push(currentA);
    }
  }

  // Summary statistics
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
  const variance = samples.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / samples.length;
  const std = Math.sqrt(variance);
  const q025 = samples[Math.floor(samples.length * 0.025)];
  const q975 = samples[Math.floor(samples.length * 0.975)];

  // Compute predictive curve on latest blast observation
  const refObs = observations[observations.length - 1];
  const predMedian = computeKuzRam(refObs.params, refObs.rockMass, mean);
  const predLow = computeKuzRam(refObs.params, refObs.rockMass, q025);
  const predHigh = computeKuzRam(refObs.params, refObs.rockMass, q975);

  const predictiveCurve = predMedian.curve.map((pt, idx) => ({
    sizeMm: pt.sizeMm,
    medianPassing: pt.passingPercent,
    lower95: Math.max(0, predHigh.curve[idx]?.passingPercent ?? pt.passingPercent), // Larger A -> finer fragments
    upper95: Math.min(100, predLow.curve[idx]?.passingPercent ?? pt.passingPercent),
  }));

  return {
    priorMeanA,
    priorStdA,
    posteriorMeanA: Number(mean.toFixed(2)),
    posteriorStdA: Number(std.toFixed(2)),
    credibleInterval95A: [Number(q025.toFixed(2)), Number(q975.toFixed(2))],
    acceptanceRate: Number((accepted / numSamples).toFixed(2)),
    mcmcSamplesA: samples.filter((_, i) => i % 10 === 0), // Thinned for chart performance
    predictiveCurve,
  };
}

// Blast Advisor Search & Tornado Sensitivity
export function runBlastAdvisor(
  currentParams: BlastParameters,
  rockMass: RockMass,
  calibratedRockFactorA: number,
  target: BlastAdvisorTarget
): BlastAdvisorRecommendation {
  const currentResult = computeKuzRam(currentParams, rockMass, calibratedRockFactorA);
  const targetP80 = target.targetP80Mm;

  // Grid search to optimize Burden, Spacing, Stemming, and Powder Factor
  let bestP80 = currentResult.p80Mm;
  let bestDiff = Math.abs(currentResult.p80Mm - targetP80);
  let bestB = currentParams.burden;
  let bestS = currentParams.spacing;
  let bestT = currentParams.stemmingLength;
  let bestK = currentParams.chargePerHole / (currentParams.burden * currentParams.spacing * currentParams.benchHeight);

  // Search within bounds
  for (let b = target.bounds.minBurden; b <= target.bounds.maxBurden; b += 0.2) {
    for (let s = target.bounds.minSpacing; s <= target.bounds.maxSpacing; s += 0.2) {
      for (let t = target.bounds.minStemming; t <= target.bounds.maxStemming; t += 0.2) {
        // Derive charge per hole from powder factor and geometry
        const holeVol = b * s * currentParams.benchHeight;
        const q = Math.max(5, bestK * holeVol);
        const testParams: BlastParameters = {
          ...currentParams,
          burden: Number(b.toFixed(2)),
          spacing: Number(s.toFixed(2)),
          stemmingLength: Number(t.toFixed(2)),
          chargePerHole: Number(q.toFixed(1)),
        };
        const res = computeKuzRam(testParams, rockMass, calibratedRockFactorA);
        const diff = Math.abs(res.p80Mm - targetP80);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestP80 = res.p80Mm;
          bestB = b;
          bestS = s;
          bestT = t;
        }
      }
    }
  }

  // Tornado sensitivity analysis (impact of +15% and -15% parameter changes)
  const evalP80With = (paramOverride: Partial<BlastParameters>) => {
    return computeKuzRam({ ...currentParams, ...paramOverride }, rockMass, calibratedRockFactorA).p80Mm;
  };

  const baseP80 = currentResult.p80Mm;
  const sensitivity = [
    {
      parameter: 'Burden B (±15%)',
      impactLowMm: Number((evalP80With({ burden: currentParams.burden * 0.85 }) - baseP80).toFixed(1)),
      impactHighMm: Number((evalP80With({ burden: currentParams.burden * 1.15 }) - baseP80).toFixed(1)),
    },
    {
      parameter: 'Spacing S (±15%)',
      impactLowMm: Number((evalP80With({ spacing: currentParams.spacing * 0.85 }) - baseP80).toFixed(1)),
      impactHighMm: Number((evalP80With({ spacing: currentParams.spacing * 1.15 }) - baseP80).toFixed(1)),
    },
    {
      parameter: 'Charge Q / Hole (±15%)',
      impactLowMm: Number((evalP80With({ chargePerHole: currentParams.chargePerHole * 1.15 }) - baseP80).toFixed(1)), // Higher charge -> lower P80
      impactHighMm: Number((evalP80With({ chargePerHole: currentParams.chargePerHole * 0.85 }) - baseP80).toFixed(1)),
    },
    {
      parameter: 'Stemming T (±15%)',
      impactLowMm: Number((evalP80With({ stemmingLength: currentParams.stemmingLength * 0.85 }) - baseP80).toFixed(1)),
      impactHighMm: Number((evalP80With({ stemmingLength: currentParams.stemmingLength * 1.15 }) - baseP80).toFixed(1)),
    },
  ];

  return {
    recommendedBurden: Number(bestB.toFixed(2)),
    recommendedSpacing: Number(bestS.toFixed(2)),
    recommendedStemming: Number(bestT.toFixed(2)),
    recommendedPowderFactor: Number(bestK.toFixed(2)),
    predictedP80Mm: Number(bestP80.toFixed(1)),
    predictedP80CI: [Number((bestP80 * 0.91).toFixed(1)), Number((bestP80 * 1.09).toFixed(1))],
    sensitivity,
  };
}
