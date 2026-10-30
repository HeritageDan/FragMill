import { describe, it, expect } from 'vitest';
import {
  computeKuzRam,
  calculateRockFactorA,
  runBayesianCalibration,
} from './kuzram';
import {
  fitRosinRammler,
  computeFragmentationMetrics,
  calculateCumulativeDistribution,
  runBootstrapResampling,
} from './statistics';
import {
  computeValidationComparison,
} from './validation';
import {
  computeHomographyMatrix,
  applyHomography,
  calibrateFourPointHomography,
  runClassicalSegmentation,
} from './imageProcessing';
import type { BlastParameters, RockMass, Fragment, Point2D, Calibration } from '../types';

describe('FragMill Review Audit Corrections Suite', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Flyrock & Evacuation Safety Envelope (Issue 1)
  // ──────────────────────────────────────────────────────────────────────────
  describe('1. Flyrock Conservative Lundborg Bound & Mandatory Site Warning', () => {
    it('outputs conservative Lundborg bound (~330 m for 89 mm hole) instead of unsafe 40 m', () => {
      const params: BlastParameters = {
        benchHeight: 10.0,
        holeDiameter: 89, // 89 mm (3.5 inches)
        holeDepth: 11.0,
        subdrill: 1.0,
        burden: 2.8,
        spacing: 3.2,
        stemmingLength: 2.5,
        numberOfHoles: 24,
        holeInclination: 90,
        explosiveType: 'ANFO',
        rws: 100,
        chargePerHole: 40,
        bottomChargeLength: 3.0,
        columnChargeLength: 5.5,
        initiationSequenceNotes: 'Electronic 25ms delay',
        waterInHoles: false,
        drillingDeviationEstimate: 0.1,
      };

      const rock: RockMass = {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.5,
        jointOrientation: 'strike_perpendicular',
      };

      const res = computeKuzRam(params, rock);
      expect(res.flyrock).toBeDefined();

      const fly = res.flyrock!;
      // Lundborg 1981: 143 * (89 / 25.4)^(2/3) = ~330 m
      expect(fly.lundborgMaxThrowM).toBeGreaterThanOrEqual(320);
      expect(fly.lundborgMaxThrowM).toBeLessThanOrEqual(340);
      expect(fly.maxFlyrockDistanceM).toBeGreaterThanOrEqual(320);

      // Personnel evacuation distance must be at least 500 m conservative exclusion
      expect(fly.personnelEvacuationDistanceM).toBeGreaterThanOrEqual(500);

      // Must include explicit clearance warning noting site clearance rules govern
      expect(fly.clearanceNoticeEn).toContain('Site clearance rules strictly govern');
      expect(fly.clearanceNoticeFr).toContain('règles du site minier prévalent');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Elimination of Silent Fake Fallbacks (Issue 2)
  // ──────────────────────────────────────────────────────────────────────────
  describe('2. Explicit Error / Insufficient Data Handling', () => {
    it('fitRosinRammler returns status insufficient_data and converged false when valid points < 3', () => {
      const emptyFit = fitRosinRammler([]);
      expect(emptyFit.converged).toBe(false);
      expect(emptyFit.status).toBe('insufficient_data');
      expect(emptyFit.r2).toBe(0);
      expect(emptyFit.xc).toBe(0);
      expect(emptyFit.n).toBe(0);

      const twoPoints = [
        { sizeMm: 50, passingPercent: 30 },
        { sizeMm: 100, passingPercent: 70 },
      ];
      const twoPtFit = fitRosinRammler(twoPoints);
      expect(twoPtFit.converged).toBe(false);
      expect(twoPtFit.status).toBe('insufficient_data');
    });

    it('computeValidationComparison returns status insufficient_data when ground truth is missing', () => {
      const mockMetrics = {
        sizeDefinition: 'min_feret' as const,
        fragmentCount: 10,
        p10: 25,
        p20: 50,
        p50: 120,
        p80: 220,
        p90: 280,
        pMax: 350,
        meanSize: 120,
        uniformityIndex: 1.1,
        oversizePercent: 5,
        finesPercent: 10,
        unresolvedFinesPercent: 2,
        bootstrapCI: {
          p10: [20, 30] as [number, number],
          p20: [40, 60] as [number, number],
          p50: [100, 140] as [number, number],
          p80: [190, 250] as [number, number],
          p90: [250, 310] as [number, number],
        },
        rawCurve: [],
        correctedCurve: [],
      };

      const resultWithoutGt = computeValidationComparison(mockMetrics, undefined);
      expect(resultWithoutGt.status).toBe('insufficient_data');
      expect(resultWithoutGt.thresholdExceeded).toBe(false);

      const resultWithEmptyGt = computeValidationComparison(mockMetrics, {
        id: 'gt-test',
        blastId: 'blast-1',
        manualFragments: [],
        sieveData: [],
        createdAt: 0,
        updatedAt: 0,
      });
      expect(resultWithEmptyGt.status).toBe('insufficient_data');
      expect(resultWithEmptyGt.thresholdExceeded).toBe(false);
    });

    it('computeKuzRam throws when blast geometry or charge weight is invalid or zero', () => {
      const badParams: BlastParameters = {
        benchHeight: 10.0,
        holeDiameter: 89,
        holeDepth: 11.0,
        subdrill: 1.0,
        burden: 0,
        spacing: 3.0,
        stemmingLength: 2.5,
        numberOfHoles: 24,
        holeInclination: 90,
        explosiveType: 'ANFO',
        rws: 100,
        chargePerHole: 0, // Invalid charge
        bottomChargeLength: 3.0,
        columnChargeLength: 5.5,
        initiationSequenceNotes: 'Test',
        waterInHoles: false,
        drillingDeviationEstimate: 0.1,
      };

      const rock: RockMass = {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.5,
        jointOrientation: 'strike_perpendicular',
      };

      expect(() => computeKuzRam(badParams, rock)).toThrow();
    });

    it('runClassicalSegmentation rejects when pxPerMm is 0 or uncalibrated', async () => {
      const dummyImg = { naturalWidth: 800, naturalHeight: 600, width: 800, height: 600 } as any;
      const uncalibrated: Calibration = {
        method: 'two_point',
        points: [],
        realWorldDistanceMm: 0,
        pxPerMm: 0, // Uncalibrated!
      };

      await expect(
        runClassicalSegmentation(dummyImg, uncalibrated)
      ).rejects.toThrow(/Valid scale calibration/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 4-Point Planar Homography (Issue 5)
  // ──────────────────────────────────────────────────────────────────────────
  describe('3. Direct Linear Transformation (DLT) 4-Point Homography', () => {
    it('computes exact 3x3 homography matrix and maps quadrilateral corners to metric rectangle', () => {
      // Perspective distorted rectangle in pixel space
      const srcCorners: Point2D[] = [
        { x: 100, y: 100 },
        { x: 500, y: 120 },
        { x: 550, y: 450 },
        { x: 80, y: 420 },
      ];

      // Physical target rectangle: 400 mm wide x 300 mm high
      const dstCorners: Point2D[] = [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 },
      ];

      const H = computeHomographyMatrix(srcCorners, dstCorners);
      expect(H.length).toBe(3);
      expect(H[0].length).toBe(3);

      // Verify mapping of all 4 corners
      for (let i = 0; i < 4; i++) {
        const mapped = applyHomography(H, srcCorners[i]);
        expect(mapped.x).toBeCloseTo(dstCorners[i].x, 0);
        expect(mapped.y).toBeCloseTo(dstCorners[i].y, 0);
      }
    });

    it('calibrateFourPointHomography returns valid Calibration object with homographyMatrix', () => {
      const corners: Point2D[] = [
        { x: 50, y: 50 },
        { x: 250, y: 50 },
        { x: 250, y: 150 },
        { x: 50, y: 150 },
      ];

      const calib = calibrateFourPointHomography(corners, 400, 200);
      expect(calib.method).toBe('four_point_homography');
      expect(calib.homographyMatrix).toBeDefined();
      expect(calib.pxPerMm).toBeGreaterThan(0);
      expect(calib.realWorldWidthMm).toBe(400);
      expect(calib.realWorldHeightMm).toBe(200);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Statistics & Bootstrap Consistency (Issue 6)
  // ──────────────────────────────────────────────────────────────────────────
  describe('4. Continuous Volume-Weighted Percentiles & Consistent Bootstrap CI', () => {
    it('ensures sample point estimate P50 falls inside its 95% bootstrap confidence interval', () => {
      // Synthesize realistic fragment distribution
      const fragments: Fragment[] = [];
      for (let i = 1; i <= 60; i++) {
        const size = 30 + i * 5; // 35mm to 330mm
        fragments.push({
          id: i,
          polygon: [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: 0, y: size }],
          centroid: { x: size / 2, y: size / 2 },
          areaPx: size * size,
          areaMm2: size * size,
          ecdMm: size,
          minFeretMm: size,
          maxFeretMm: size * 1.2,
          bboxWidthMm: size,
          bboxHeightMm: size,
          aspectRatio: 1.2,
          solidity: 0.95,
          volumeMm3: (Math.PI / 6) * Math.pow(size, 3),
          confidence: 0.95,
        });
      }

      const metrics = computeFragmentationMetrics(fragments, 'min_feret');

      // Bootstrap CI must cover point estimate
      expect(metrics.p50).toBeGreaterThanOrEqual(metrics.bootstrapCI.p50[0]);
      expect(metrics.p50).toBeLessThanOrEqual(metrics.bootstrapCI.p50[1]);

      expect(metrics.p80).toBeGreaterThanOrEqual(metrics.bootstrapCI.p80[0]);
      expect(metrics.p80).toBeLessThanOrEqual(metrics.bootstrapCI.p80[1]);

      // Stereological correction flag is honest (false)
      expect(metrics.stereologicalCorrectionApplied).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Kuz-Ram Massive Rock Factor & Bayesian MCMC Diagnostics (Issue 7)
  // ──────────────────────────────────────────────────────────────────────────
  describe('5. Kuz-Ram Massive Rock Factor & MCMC Convergence', () => {
    it('calculateRockFactorA handles massive rock mass (RMD = 50) without adding redundant joint factors', () => {
      const massiveA = calculateRockFactorA({
        rmd: 50,
        jf: 50,
        jfo: 40,
        density: 2.7,
        hf: 16,
      });

      // Massive: 0.06 * (50 + 0 + 0 + 17.5 + 16) = 0.06 * 83.5 = 5.01
      expect(massiveA).toBe(5.01);
    });

    it('runBayesianCalibration outputs Gelman-Rubin rHat diagnostic close to 1.0', () => {
      const blastParams: BlastParameters = {
        benchHeight: 10.0,
        holeDiameter: 115,
        holeDepth: 11.0,
        subdrill: 1.0,
        burden: 3.0,
        spacing: 3.5,
        stemmingLength: 3.0,
        numberOfHoles: 36,
        holeInclination: 90,
        explosiveType: 'ANFO',
        rws: 100,
        chargePerHole: 70,
        bottomChargeLength: 4.0,
        columnChargeLength: 4.0,
        initiationSequenceNotes: 'Test electronic',
        waterInHoles: false,
        drillingDeviationEstimate: 0.1,
      };

      const rock: RockMass = {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.6,
        jointOrientation: 'strike_perpendicular',
      };

      const obs = [
        { measuredX50Mm: 145, params: blastParams, rockMass: rock, errorStdMm: 12 },
        { measuredX50Mm: 152, params: blastParams, rockMass: rock, errorStdMm: 14 },
      ];

      const calib = runBayesianCalibration(7.0, 1.5, obs, 1000, 200, 42);
      expect(calib.rHat).toBeDefined();
      expect(calib.rHat!).toBeLessThanOrEqual(1.15); // Good convergence diagnostic
      expect(calib.posteriorMeanA).toBeGreaterThan(4.0);
      expect(calib.posteriorMeanA).toBeLessThan(12.0);
    });
  });
});
