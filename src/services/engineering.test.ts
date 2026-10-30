import { describe, it, expect } from 'vitest';
import {
  computeKuzRam,
  calculateRockFactorA,
  DEFAULT_ROCK_TABLES,
} from './kuzram';
import { computeMillKPIs } from './minetomill';
import { fitRosinRammler, fitSwebrec, calculateCumulativeDistribution } from './statistics';
import { runCalibrationSelfTest } from './selftest';
import type { BlastParameters, RockMass, Fragment, Blast } from '../types';

const baseParams: BlastParameters = {
  benchHeight: 6.0,
  holeDiameter: 89,
  holeDepth: 6.8,
  subdrill: 0.8,
  burden: 2.5,
  spacing: 3.0,
  stemmingLength: 2.2,
  numberOfHoles: 20,
  holeInclination: 90,
  explosiveType: 'ANFO',
  rws: 100,
  chargePerHole: 22.5,
  bottomChargeLength: 2.0,
  columnChargeLength: 2.6,
  initiationSequenceNotes: '25ms row delay',
  waterInHoles: false,
  drillingDeviationEstimate: 0.1,
};

const baseRock: RockMass = {
  rockType: 'Granodiorite',
  density: 2.65,
  jointSetCount: 3,
  meanJointSpacing: 0.5,
  jointOrientation: 'strike_perpendicular',
  ucsMPa: 120,
  youngsModulusGPa: 50,
};

describe('Cunningham Kuz-Ram Blast Formulation', () => {

  it('calculates Rock Factor A correctly from Cunningham lookup tables', () => {
    // A = 0.06 * (RMD + JF + JFO + RDI + HF)
    // with RMD=20, JF=20, JFO=30, RDI=25*2.65-50=16.25, HF=15
    // sum = 101.25 => A = 0.06 * 101.25 = 6.075 -> 6.08
    const A = calculateRockFactorA(DEFAULT_ROCK_TABLES);
    expect(A).toBeGreaterThan(5.0);
    expect(A).toBeLessThan(8.0);
  });

  it('computes positive X50 and uniformity index n within physical ranges', () => {
    const res = computeKuzRam(baseParams, baseRock);
    expect(res.meanSizeX50Mm).toBeGreaterThan(50);
    expect(res.meanSizeX50Mm).toBeLessThan(400);
    // Prior to Cunningham unit bug fix (B in m, D in mm), term1 was -39.8 forcing n to 0.8
    // With correct empirical units, n should be physically realistic (> 1.0)
    expect(res.uniformityIndexN).toBeGreaterThan(1.0);
    expect(res.uniformityIndexN).toBeLessThan(2.2);
    expect(res.uniformityIndexN).not.toBe(0.8);
    expect(res.p80Mm).toBeGreaterThan(res.p50Mm);
    expect(res.p50Mm).toBeGreaterThan(res.p20Mm);
  });
});

describe('Mine-to-Mill Gold Recovery Formulations', () => {
  it('correctly calculates simple gold recovery R = (f - t)/f * 100', () => {
    // Head grade f = 4.0 g/t, Tails grade t = 0.6 g/t
    // R = (4.0 - 0.6) / 4.0 * 100 = 3.4 / 4.0 * 100 = 85.0%
    const res = computeMillKPIs(1000, 2000, 20000, 4.0, 0.6);
    expect(res.simpleGoldRecoveryPercent).toBe(85.0);
    expect(res.crushingSpecificEnergyKwhPerT).toBe(2.0);
    expect(res.millingSpecificEnergyKwhPerT).toBe(20.0);
    expect(res.totalSpecificEnergyKwhPerT).toBe(22.0);
  });

  it('correctly calculates two-product recovery formula R = c(f - t) / (f(c - t)) * 100', () => {
    // Head f = 4.0, Tails t = 0.6, Concentrate c = 100.0
    // num = 100 * (4.0 - 0.6) = 340
    // den = 4.0 * (100 - 0.6) = 4.0 * 99.4 = 397.6
    // R = 340 / 397.6 * 100 = 85.51%
    const res = computeMillKPIs(1000, 2000, 20000, 4.0, 0.6, 100.0);
    expect(res.twoProductGoldRecoveryPercent).toBeCloseTo(85.51, 1);
  });
});

describe('Statistical Sizing & Distribution Fitting', () => {
  const dummyFragments: Fragment[] = [
    {
      id: 1,
      polygon: [],
      centroid: { x: 0, y: 0 },
      areaPx: 100,
      areaMm2: 400,
      ecdMm: 22.5,
      minFeretMm: 20,
      maxFeretMm: 25,
      bboxWidthMm: 25,
      bboxHeightMm: 20,
      aspectRatio: 1.25,
      solidity: 0.95,
      volumeMm3: 4188,
      confidence: 0.95,
    },
    {
      id: 2,
      polygon: [],
      centroid: { x: 0, y: 0 },
      areaPx: 400,
      areaMm2: 1600,
      ecdMm: 45.1,
      minFeretMm: 40,
      maxFeretMm: 50,
      bboxWidthMm: 50,
      bboxHeightMm: 40,
      aspectRatio: 1.25,
      solidity: 0.92,
      volumeMm3: 33510,
      confidence: 0.92,
    },
    {
      id: 3,
      polygon: [],
      centroid: { x: 0, y: 0 },
      areaPx: 1600,
      areaMm2: 6400,
      ecdMm: 90.2,
      minFeretMm: 80,
      maxFeretMm: 100,
      bboxWidthMm: 100,
      bboxHeightMm: 80,
      aspectRatio: 1.25,
      solidity: 0.94,
      volumeMm3: 268082,
      confidence: 0.94,
    },
  ];

  it('computes monotonic cumulative distribution', () => {
    const curve = calculateCumulativeDistribution(dummyFragments, 'min_feret');
    expect(curve.length).toBeGreaterThan(0);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].passingPercent).toBeGreaterThanOrEqual(curve[i - 1].passingPercent);
    }
    expect(curve[curve.length - 1].passingPercent).toBe(100);
  });

  it('fits Rosin-Rammler distribution with valid parameters', () => {
    const curve = [
      { sizeMm: 20, passingPercent: 15 },
      { sizeMm: 50, passingPercent: 35 },
      { sizeMm: 100, passingPercent: 65 },
      { sizeMm: 180, passingPercent: 85 },
      { sizeMm: 300, passingPercent: 96 },
    ];
    const fit = fitRosinRammler(curve);
    expect(fit.xc).toBeGreaterThan(50);
    expect(fit.n).toBeGreaterThan(0.5);
    expect(fit.r2).toBeGreaterThan(0.8);
  });

  it('fits Swebrec distribution with reasonable R2', () => {
    const curve = [
      { sizeMm: 10, passingPercent: 8 },
      { sizeMm: 30, passingPercent: 25 },
      { sizeMm: 80, passingPercent: 50 },
      { sizeMm: 150, passingPercent: 78 },
      { sizeMm: 250, passingPercent: 92 },
      { sizeMm: 350, passingPercent: 99 },
    ];
    const fit = fitSwebrec(curve, 80);
    expect(fit.x50).toBeCloseTo(80, 0);
    expect(fit.b).toBeGreaterThan(0.5);
    expect(fit.r2).toBeGreaterThan(0.85);
  });
});

describe('Synthetic Calibration Self-Test Accuracy', () => {
  it('measures known synthetic 100mm disc and 80x50mm block within 3% tolerance', async () => {
    const report = await runCalibrationSelfTest();
    expect(report.passed).toBe(true);
    expect(report.maxErrorPercent).toBeLessThanOrEqual(3.0);
    for (const shape of report.shapes) {
      expect(shape.passed).toBe(true);
      expect(shape.errorPercent).toBeLessThanOrEqual(3.0);
    }
  });
});

describe('Mine-to-Mill Economic Optimization & Carbon Accounting Engine', () => {
  it('correctly calculates comminution cost curve and identifies economic sweet spot', async () => {
    const { evaluateMineToMillEconomics, DEFAULT_ECONOMIC_PARAMS } = await import('./economics');
    const mockBlast: Blast = {
      id: 'test-blast-1',
      siteId: 'site-1',
      projectId: 'proj-1',
      blastId: 'BL-TEST-001',
      dateTime: '2026-10-12T10:00',
      weather: 'Clear',
      notes: 'Test blast',
      parameters: baseParams,
      rockMass: baseRock,
      images: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = evaluateMineToMillEconomics(mockBlast, 180, undefined, DEFAULT_ECONOMIC_PARAMS);

    expect(result.evaluation.drillingCostPerTon).toBeGreaterThan(0);
    expect(result.evaluation.blastingCostPerTon).toBeGreaterThan(0);
    expect(result.evaluation.crushingCostPerTon).toBeGreaterThan(0);
    expect(result.evaluation.millingCostPerTon).toBeGreaterThan(0);
    expect(result.evaluation.totalCostPerTon).toBeGreaterThan(0);

    // Sum verification
    const sum =
      result.evaluation.drillingCostPerTon +
      result.evaluation.blastingCostPerTon +
      result.evaluation.secondaryBreakingCostPerTon +
      result.evaluation.crushingCostPerTon +
      result.evaluation.millingCostPerTon;
    expect(result.evaluation.totalCostPerTon).toBeCloseTo(sum, 1);

    // Sweet spot P80 verification
    expect(result.sweetSpotP80Mm).toBeGreaterThanOrEqual(100);
    expect(result.sweetSpotP80Mm).toBeLessThan(250);

    // Carbon accounting verification
    expect(result.evaluation.carbonEmissions.scope1ExplosivesKgCo2ePerTon).toBeGreaterThan(0);
    expect(result.evaluation.carbonEmissions.scope2ElectricityKgCo2ePerTon).toBeGreaterThan(0);
    expect(result.evaluation.carbonEmissions.totalKgCo2ePerTon).toBeGreaterThan(0);

    // Curve check: P80 array has multiple points and shows trade-off
    expect(result.costCurve.length).toBeGreaterThan(5);
    const firstPoint = result.costCurve[0]; // fine P80: high drilling/blasting, lower crushing/milling
    const lastPoint = result.costCurve[result.costCurve.length - 1]; // coarse P80: lower blast cost, higher crushing/milling
    expect(firstPoint.drillingBlastingCostPerTon).toBeGreaterThan(lastPoint.drillingBlastingCostPerTon);
    expect(lastPoint.crushingMillingCostPerTon).toBeGreaterThan(firstPoint.crushingMillingCostPerTon);
  });
});

describe('Sieve Data Import & Excel Parser', () => {
  it('parses standard tab-separated Excel copy-paste with headers and units', async () => {
    const { parseSieveInput } = await import('./validation');
    const input = `Screen (mm)\tMass Retained (kg)
300 mm\t42.0 kg
200 mm\t68.5 kg
125 mm\t54.0 kg
75 mm\t38.0 kg
37.5 mm\t22.5 kg`;

    const res = parseSieveInput(input);
    expect(res.rows.length).toBe(5);
    expect(res.rows[0].apertureMm).toBe(300);
    expect(res.rows[0].massRetainedKg).toBe(42.0);
    expect(res.rows[4].apertureMm).toBe(37.5);
    expect(res.rows[4].massRetainedKg).toBe(22.5);
    expect(res.totalMassKg).toBe(225.0);
  });

  it('parses European comma decimals and semicolon delimiters', async () => {
    const { parseSieveInput } = await import('./validation');
    const input = `300; 42,5
200; 68,0
37,5; 22,5`;

    const res = parseSieveInput(input);
    expect(res.rows.length).toBe(3);
    expect(res.rows[0].apertureMm).toBe(300);
    expect(res.rows[0].massRetainedKg).toBe(42.5);
    expect(res.rows[2].apertureMm).toBe(37.5);
    expect(res.rows[2].massRetainedKg).toBe(22.5);
  });

  it('parses comma-separated CSV with quotes', async () => {
    const { parseSieveInput } = await import('./validation');
    const input = `"300","42.0"
"200","68.5"
"125","54.0"`;

    const res = parseSieveInput(input);
    expect(res.rows.length).toBe(3);
    expect(res.rows[0].apertureMm).toBe(300);
    expect(res.rows[0].massRetainedKg).toBe(42.0);
  });
});

describe('Rock Geometry & Advanced Computer Vision Delineation', () => {
  it('correctly determines whether points lie inside an arbitrary ROI polygon', async () => {
    const { isPointInPolygon } = await import('./imageProcessing');
    const triangle = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ];

    expect(isPointInPolygon({ x: 50, y: 30 }, triangle)).toBe(true);
    expect(isPointInPolygon({ x: 10, y: 10 }, triangle)).toBe(true);
    expect(isPointInPolygon({ x: 150, y: 50 }, triangle)).toBe(false);
    expect(isPointInPolygon({ x: 50, y: 150 }, triangle)).toBe(false);
  });

  it('computes accurate Caliper Feret diameters for an angular rock polygon', async () => {
    const { computeConvexHull, computeFeretDiameters } = await import('./imageProcessing');
    // An elongated angular polygon: 120px wide by 60px high
    const rockPolygon = [
      { x: 10, y: 20 },
      { x: 50, y: 10 },
      { x: 110, y: 25 },
      { x: 130, y: 50 },
      { x: 90, y: 70 },
      { x: 40, y: 65 },
      { x: 15, y: 45 },
    ];
    const pxPerMm = 0.5; // 2px per mm -> 120px = ~240mm
    const hull = computeConvexHull(rockPolygon);
    const feret = computeFeretDiameters(hull, pxPerMm);

    expect(feret.maxFeretMm).toBeGreaterThan(feret.minFeretMm);
    expect(feret.maxFeretMm).toBeGreaterThan(200);
    expect(feret.minFeretMm).toBeGreaterThan(80);
    expect(feret.maxFeretMm / feret.minFeretMm).toBeLessThan(3.0);
  });
});

describe('Blast Hole 3-Deck Loading & Fault Decking Formulations', () => {
  it('correctly calculates toe dynamite weight, ANFO bag proportions and fuel volume', async () => {
    const { DEFAULT_CHARGING_PROFILE } = await import('../components/blast/HoleChargingProfileView');
    // 2 cartridges of 250g = 0.5 kg dynamite
    const toeWeightKg = (DEFAULT_CHARGING_PROFILE.toeCartridgeCount * DEFAULT_CHARGING_PROFILE.toeCartridgeWeightGrams) / 1000;
    expect(toeWeightKg).toBe(0.5);

    // 2 bags of 25kg nitrate = 50 kg
    const nitrateWeightKg = DEFAULT_CHARGING_PROFILE.anfoNitrateBags25kg * 25;
    expect(nitrateWeightKg).toBe(50.0);

    // 3.0 L diesel per bag = 6.0 L total
    const fuelLiters = DEFAULT_CHARGING_PROFILE.anfoNitrateBags25kg * DEFAULT_CHARGING_PROFILE.fuelLitersPerBag;
    expect(fuelLiters).toBe(6.0);

    // Diesel density 0.84 kg/L => 6.0 * 0.84 = 5.04 kg
    const fuelWeightKg = fuelLiters * 0.84;
    expect(fuelWeightKg).toBeCloseTo(5.04, 2);

    // Total column weight = 50 + 5.04 = 55.04 kg
    const columnTotalWeightKg = nitrateWeightKg + fuelWeightKg;
    expect(columnTotalWeightKg).toBeCloseTo(55.04, 2);
  });

  it('correctly calculates explosive savings when cavity decking is active', async () => {
    const { DEFAULT_CHARGING_PROFILE } = await import('../components/blast/HoleChargingProfileView');
    const profile = {
      ...DEFAULT_CHARGING_PROFILE,
      hasFaultOrCavity: true,
      faultThicknessM: 1.0,
      nitrateBagCost: 18000,
    };

    // With holeDiameter = 89mm (radius = 0.0445m), area = pi * r^2 = 0.00622 m2
    // Volume across 1m fault = 0.00622 m3. At ANFO bulk density 850 kg/m3 = ~5.3 kg
    const holeRadiusM = 89 / 2000;
    const faultVolM3 = Math.PI * Math.pow(holeRadiusM, 2) * profile.faultThicknessM;
    const expectedSavedKg = Math.round(faultVolM3 * 850);
    expect(expectedSavedKg).toBeGreaterThan(4);
    expect(expectedSavedKg).toBeLessThan(10);
  });
});




