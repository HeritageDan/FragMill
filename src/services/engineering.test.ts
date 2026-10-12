import { describe, it, expect } from 'vitest';
import {
  computeKuzRam,
  calculateRockFactorA,
  DEFAULT_ROCK_TABLES,
} from './kuzram';
import { computeMillKPIs } from './minetomill';
import { fitRosinRammler, fitSwebrec, calculateCumulativeDistribution } from './statistics';
import { runCalibrationSelfTest } from './selftest';
import type { BlastParameters, RockMass, Fragment } from '../types';

describe('Cunningham Kuz-Ram Blast Formulation', () => {
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
    expect(res.uniformityIndexN).toBeGreaterThan(0.6);
    expect(res.uniformityIndexN).toBeLessThan(2.5);
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
