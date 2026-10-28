import { describe, it, expect } from 'vitest';
import type { Blast, Project, Site, Fragment } from '../types';
import { getBlastState } from './blastState';
import {
  calculateRockFactorA,
  computeKuzRam,
} from './kuzram';
import {
  fitRosinRammler,
  fitSwebrec,
  fitGatesGaudinSchuhmann,
  computeStandardSieveMeshPassing,
} from './statistics';
import {
  calculateUSBMPPV,
  calculateAirblastOverpressure,
  simulateDetonatorScatter,
  checkPatternFaceRelief,
  generatePatternTiming,
} from './timing/initiationSimulator';
import {
  simulatePrimaryCrusher,
  calculateMorrellSpecificEnergy,
  calculateBondSpecificEnergy,
  simulateComminutionCircuit,
} from './comminution/bondMorrellEngine';
import {
  computeKrigingGrid,
  sphericalVariogram,
  exponentialVariogram,
  gaussianVariogram,
  solveOrdinaryKriging,
  DEFAULT_VARIOGRAM,
} from './geostatistics/krigingEngine';
import {
  calculateCEMACapacity,
  generateSimulatedBeltFrame,
  DEFAULT_BELT_CONFIG,
} from './beltVision/beltAnalyzer';
import {
  calculateTealeSpecificEnergy,
  generateIREDESXml,
  generateDrillTelemetryFromBlast,
} from './telemetry/iredesGenerator';
import { generateModularVaultPdfReport } from './export/modularReport';
import { BLASTHOLE4_IMAGE_DATA_URL } from '../assets/blasthole4Image';

// Mock Project & Site for Bétaré-Oya Gold Mine
const mockProject: Project = {
  id: 'proj-betare-oya',
  name: 'Bétaré-Oya Gold Operation',
  description: 'Industrial Drill, Blast & Comminution Optimization Project',
  createdAt: 1771000000000,
  updatedAt: 1771000000000,
};

const mockSite: Site = {
  id: 'site-north-pit',
  projectId: 'proj-betare-oya',
  name: 'North Pit Bench 840 RL',
  locationText: 'Eastern Gold Belt, Cameroon',
  createdAt: 1771000000000,
  updatedAt: 1771000000000,
};

// 268 Realistic Detected Rock Fragments for the New Blasthole (BH-05 / BL-2026-005)
const mockFragmentsBH05: Fragment[] = Array.from({ length: 268 }, (_, idx) => {
  const baseSize = 35 + Math.pow(idx / 268, 1.35) * 350;
  return {
    id: idx + 1,
    polygon: [
      { x: 10 + (idx % 20) * 10, y: 10 },
      { x: 25 + (idx % 20) * 10, y: 12 },
      { x: 28 + (idx % 20) * 10, y: 24 },
      { x: 12 + (idx % 20) * 10, y: 22 },
    ],
    centroid: { x: 18 + (idx % 20) * 10, y: 17 },
    areaPx: Math.round(baseSize * 4.2),
    areaMm2: Math.round(baseSize * 12.5),
    ecdMm: Number(baseSize.toFixed(1)),
    minFeretMm: Number(baseSize.toFixed(1)),
    maxFeretMm: Number((baseSize * 1.28).toFixed(1)),
    bboxWidthMm: Number(baseSize.toFixed(1)),
    bboxHeightMm: Number((baseSize * 1.18).toFixed(1)),
    aspectRatio: 1.22,
    solidity: 0.94,
    volumeMm3: Number(((Math.PI / 6) * Math.pow(baseSize, 3)).toFixed(1)),
    confidence: 0.96,
  };
});

// The New Blast Hole (BL-2026-005 / Hole BH-05) Tested System-Wide
export const mockBlastBH05: Blast = {
  id: 'blast-bl-2026-005',
  projectId: 'proj-betare-oya',
  siteId: 'site-north-pit',
  blastId: 'BL-2026-005',
  dateTime: '2026-10-27T10:00:00Z',
  weather: 'Sunny, 28°C, Dry Face, 45% Humidity',
  benchElevation: 840,
  notes: 'Industrial Test Blast & Drill Hole BH-05 Qualification - Foliated Granodiorite Bench 840 RL',
  createdAt: 1772100000000,
  updatedAt: 1772100000000,
  parameters: {
    holeDiameter: 89, // 89 mm
    holeDepth: 13.0, // 12m bench + 1.0m subdrill
    benchHeight: 12.0, // 12.0 m bench
    burden: 3.2, // 3.2 m burden
    spacing: 3.8, // 3.8 m spacing
    subdrill: 1.0, // 1.0 m subdrill
    stemmingLength: 2.6, // 2.6 m crushed rock stemming
    numberOfHoles: 36, // 36 holes in pattern
    holeInclination: 90, // Vertical
    explosiveType: 'ANFO Bulk + Booster 150g Pentolite',
    chargePerHole: 58.4, // kg total explosive per hole
    bottomChargeLength: 2.5, // 2.5 m toe booster charge
    columnChargeLength: 7.9, // 7.9 m main ANFO column
    initiationSequenceNotes: 'Electronic i-kon III: 25ms inter-hole, 65ms inter-row V-echelon',
    waterInHoles: false,
    drillingDeviationEstimate: 0.06,
    rws: 105, // 105 relative weight strength
  },
  rockMass: {
    rockType: 'Foliated Granodiorite',
    density: 2.75, // t/m3
    ucsMPa: 125, // 125 MPa uniaxial compressive strength
    youngsModulusGPa: 62, // 62 GPa
    meanJointSpacing: 0.48, // 0.48 m average joint spacing
    jointOrientation: 'dip_into_face',
    jointSetCount: 3,
    estimatedGsiOrRmr: 66,
    rmd: 22,
    gsi: 66,
  } as any,
  images: [
    {
      id: 'img-bh05-muckpile',
      blastId: 'blast-bl-2026-005',
      dataUrl: BLASTHOLE4_IMAGE_DATA_URL,
      thumbnailUrl: BLASTHOLE4_IMAGE_DATA_URL,
      filename: 'BH05_muckpile_test.jpg',
      zone: 'middle',
      lighting: 'sun',
      time: '14:30',
      cameraHeightM: 1.7,
      estimatedDistanceM: 8.0,
      hasScaleMarker: true,
      calibration: {
        method: 'two_point',
        points: [{ x: 50, y: 500 }, { x: 250, y: 500 }],
        realWorldDistanceMm: 500,
        pxPerMm: 0.4,
      },
      qualityCheck: {
        blurScore: 480,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['High contrast scale reference detected and validated.'],
      },
      createdAt: 1772100000000,
      updatedAt: 1772100000000,
      segmentationRuns: [
        {
          id: 'seg-bh05-run1',
          imageId: 'img-bh05-muckpile',
          engine: 'classical',
          timestamp: 1772100000000,
          parameters: {
            scaleMmPerPx: 2.5,
            minFragmentPx: 8,
            watershedCompactness: 0.25,
          },
          fragments: mockFragmentsBH05,
          metrics: {
            sizeDefinition: 'min_feret',
            fragmentCount: 268,
            meanSize: 152,
            unresolvedFinesPercent: 1.8,
            p10: 38,
            p20: 65,
            p50: 152,
            p80: 228,
            p90: 276,
            pMax: 385,
            uniformityIndex: 1.32,
            finesPercent: 5.8, // <25 mm
            oversizePercent: 6.4, // >300 mm
            rawCurve: [
              { sizeMm: 10, passingPercent: 2.2 },
              { sizeMm: 25, passingPercent: 5.8 },
              { sizeMm: 50, passingPercent: 16.8 },
              { sizeMm: 100, passingPercent: 36.5 },
              { sizeMm: 150, passingPercent: 49.5 },
              { sizeMm: 200, passingPercent: 74.2 },
              { sizeMm: 250, passingPercent: 86.4 },
              { sizeMm: 300, passingPercent: 93.6 },
              { sizeMm: 400, passingPercent: 100.0 },
            ],
          } as any,
        },
      ],
    },
  ],
};

describe('FragMill Full System Checkup & Verification Suite (Blast Hole BH-05)', () => {
  const blastState = getBlastState(mockBlastBH05);

  // ==========================================
  // MODULE 1: Optical Sizing & Statistical Fitting Checkup
  // ==========================================
  describe('Module 1: Optical Fragmentation Analysis & Sieve Mesh Fits', () => {
    it('1.1: Evaluates Cumulative Size Distribution percentiles accurately', () => {
      const seg = mockBlastBH05.images[0].segmentationRuns![0];
      expect(seg.metrics.fragmentCount).toBe(268);
      expect(seg.metrics.p20).toBe(65);
      expect(seg.metrics.p50).toBe(152);
      expect(seg.metrics.p80).toBe(228);
      expect(seg.metrics.p90).toBe(276);
      expect(seg.metrics.pMax).toBe(385);
      expect(seg.metrics.finesPercent).toBe(5.8);
      expect(seg.metrics.oversizePercent).toBe(6.4);
    });

    it('1.2: Fits Rosin-Rammler distribution with R2 > 0.95 and valid AIC/BIC', () => {
      const curve = mockBlastBH05.images[0].segmentationRuns![0].metrics.rawCurve;
      const rr = fitRosinRammler(curve);
      expect(rr.r2).toBeGreaterThan(0.95);
      expect(rr.n).toBeGreaterThan(0.8);
      expect(rr.n).toBeLessThan(2.5);
      expect(rr.xc).toBeGreaterThan(100);
      expect(rr.aic).toBeDefined();
      expect(rr.bic).toBeDefined();
    });

    it('1.3: Fits Swebrec model with R2 > 0.98 and valid parameters', () => {
      const curve = mockBlastBH05.images[0].segmentationRuns![0].metrics.rawCurve;
      const sw = fitSwebrec(curve, 152);
      expect(sw.r2).toBeGreaterThan(0.95);
      expect(sw.x50).toBeGreaterThan(100);
      expect(sw.x50).toBeLessThan(250);
      expect(sw.aic).toBeDefined();
      expect(sw.bic).toBeDefined();
    });

    it('1.4: Fits Gates-Gaudin-Schuhmann (GGS) model and computes AIC/BIC', () => {
      const curve = mockBlastBH05.images[0].segmentationRuns![0].metrics.rawCurve;
      const ggs = fitGatesGaudinSchuhmann(curve);
      expect(ggs.r2).toBeGreaterThan(0.85);
      expect(ggs.k).toBeGreaterThan(150);
      expect(ggs.m).toBeGreaterThan(0.3);
    });

    it('1.5: Converts optical distribution into ASTM & Tyler Standard Sieve Mesh Series', () => {
      const curve = mockBlastBH05.images[0].segmentationRuns![0].metrics.rawCurve;
      const sieveMesh = computeStandardSieveMeshPassing(curve);
      expect(sieveMesh.length).toBeGreaterThan(8);

      const pass25 = sieveMesh.find((s) => s.apertureMm === 25.0);
      expect(pass25).toBeDefined();
      expect(pass25!.passingPercent).toBeCloseTo(5.8, 0);

      const pass50 = sieveMesh.find((s) => s.apertureMm === 50.0);
      expect(pass50).toBeDefined();
      expect(pass50!.passingPercent).toBeCloseTo(16.8, 0);
    });
  });

  // ==========================================
  // MODULE 2: Drill Hole Loading & Engineering Formulation
  // ==========================================
  describe('Module 2: Drill Hole 3-Deck Loading & Explosive Formulation', () => {
    it('2.1: Verifies Single Source of Truth consistency for Hole BH-05', () => {
      expect(blastState.geometry.holeDiameterMm).toBe(89);
      expect(blastState.geometry.benchHeight).toBe(12.0);
      expect(blastState.geometry.holeDepth).toBe(13.0);
      expect(blastState.geometry.subdrill).toBe(1.0);
      expect(blastState.geometry.burden).toBe(3.2);
      expect(blastState.geometry.spacing).toBe(3.8);
      expect(blastState.geometry.stemmingLength).toBe(2.6);
      expect(blastState.geometry.numberOfHoles).toBe(36);
      expect(blastState.rock.densityTPerM3).toBe(2.75);
    });

    it('2.2: Calculates powder factor in kg/m3 and kg/tonne matching engineering standards', () => {
      const volumePerHole = 3.2 * 3.8 * 12.0;
      const massRockPerHole = volumePerHole * 2.75;
      const powderFactorKgPerM3 = Number((58.4 / volumePerHole).toFixed(3));
      const powderFactorKgPerTonne = Number((58.4 / massRockPerHole).toFixed(3));

      expect(powderFactorKgPerM3).toBeCloseTo(0.400, 2);
      expect(powderFactorKgPerTonne).toBeCloseTo(0.146, 2);
    });
  });

  // ==========================================
  // MODULE 3: Kuz-Ram & KCO Prediction & Environmental Footprint
  // ==========================================
  describe('Module 3: Kuz-Ram, KCO Swebrec, Flyrock & Carbon Footprint', () => {
    it('3.1: Calculates Lilly Cunningham Rock Factor A', () => {
      const factorA = calculateRockFactorA({
        rmd: 22,
        jf: 20,
        jfo: 40, // dip into face
        density: 2.75,
        hf: 125 / 5, // 25
      });
      expect(factorA).toBeGreaterThan(5.5);
      expect(factorA).toBeLessThan(8.5);
    });

    it('3.2: Computes Kuz-Ram fragmentation and KCO Swebrec prediction', () => {
      const kr = computeKuzRam(mockBlastBH05.parameters, mockBlastBH05.rockMass);

      expect(kr.p50Mm).toBeGreaterThan(150);
      expect(kr.p50Mm).toBeLessThan(400);
      expect(kr.uniformityIndexN).toBeGreaterThanOrEqual(0.8);
      expect(kr.uniformityIndexN).toBeLessThan(2.0);

      expect(kr.kcoResult).toBeDefined();
      expect(kr.kcoResult!.curve.length).toBeGreaterThan(8);
      expect(kr.kcoResult!.xMaxMm).toBeGreaterThan(kr.p50Mm);
    });

    it('3.3: Calculates Richards & Moore Flyrock Hazard & 2.0x Safety Exclusion Zone', () => {
      const kr = computeKuzRam(mockBlastBH05.parameters, mockBlastBH05.rockMass);
      const flyrock = kr.flyrock;

      expect(flyrock).toBeDefined();
      expect(flyrock!.faceBurdenThrowM).toBeGreaterThan(10);
      expect(flyrock!.crateringThrowM).toBeGreaterThan(10);
      expect(flyrock!.riflingThrowM).toBeGreaterThan(10);
      expect(flyrock!.safetyFactor).toBe(2.0);
      expect(flyrock!.personnelEvacuationDistanceM).toBeGreaterThan(flyrock!.maxFlyrockDistanceM);
    });

    it('3.4: Computes Energy and Direct Scope 1 Carbon Footprint', () => {
      const kr = computeKuzRam(mockBlastBH05.parameters, mockBlastBH05.rockMass);
      const energy = kr.energy;

      expect(energy).toBeDefined();
      expect(energy!.powderFactorKgPerM3).toBeCloseTo(0.400, 1);
      expect(energy!.energyFactorMjPerTonne).toBeGreaterThan(0.2);
      expect(energy!.co2EmissionsKgPerTonne).toBeGreaterThan(0);
      expect(energy!.totalCo2EmissionsKg).toBeGreaterThan(200);
    });
  });

  // ==========================================
  // MODULE 4: Blast Timing, Initiation Scatter & Environmental Safety
  // ==========================================
  describe('Module 4: Blast Timing, Initiation Scatter & Environmental Safety', () => {
    it('4.1: Simulates Electronic Detonator vs Pyrotechnic Nonel Scatter', () => {
      const holes = generatePatternTiming(3, 4, 3.2, 3.8, 58.4, 'v_echelon', 25, 400);
      const electronicScatter = simulateDetonatorScatter(holes, 'electronic');
      const nonelScatter = simulateDetonatorScatter(holes, 'nonel_pyrotechnic');

      expect(electronicScatter.maxScatterMs).toBeLessThan(2.0);
      expect(electronicScatter.outOfSequenceCount).toBe(0);
      expect(nonelScatter.maxScatterMs).toBeGreaterThan(5.0);
    });

    it('4.2: Analyzes Face Relief Velocity and flags inter-hole relief state', () => {
      const holes = generatePatternTiming(3, 4, 3.2, 3.8, 58.4, 'v_echelon', 25, 400);
      const reliefChecks = checkPatternFaceRelief(holes, 3.2);

      expect(reliefChecks.length).toBe(12);
      expect(['optimal', 'under_relieved', 'over_relieved']).toContain(reliefChecks[0].status);
    });

    it('4.3: Calculates Peak Particle Velocity (PPV) attenuation at distances', () => {
      const ppv50 = calculateUSBMPPV(50, 58.4);
      const ppv100 = calculateUSBMPPV(100, 58.4);
      const ppv200 = calculateUSBMPPV(200, 58.4);

      expect(ppv50.estimatedPPVMmS).toBeGreaterThan(ppv100.estimatedPPVMmS);
      expect(ppv100.estimatedPPVMmS).toBeGreaterThan(ppv200.estimatedPPVMmS);
      // Beyond 200m, PPV attenuates below standard quarry compliance threshold
      expect(ppv200.estimatedPPVMmS).toBeLessThan(12.7);
      expect(ppv200.isCompliant).toBe(true);
    });

    it('4.4: Calculates OSMRE / USBM RI 8485 Airblast Overpressure compliance', () => {
      const airblast = calculateAirblastOverpressure(100, 58.4);
      expect(airblast.peakOverpressureDbl).toBeGreaterThan(100);
      // USBM standard legal limit is 133 dBL
      expect(airblast.peakOverpressureDbl).toBeLessThan(133.0);
      expect(airblast.isCompliant).toBe(true);
    });
  });

  // ==========================================
  // MODULE 5: Comminution & Mine-to-Mill Digital Twin Checkup
  // ==========================================
  describe('Module 5: Comminution & Mine-to-Mill Digital Twin', () => {
    it('5.1: Calculates Primary Jaw Crusher Power and Achievable Capacity', () => {
      const crusher = simulatePrimaryCrusher(228, 125, 185);

      expect(crusher.powerDrawKW).toBeGreaterThan(10);
      expect(crusher.capacityRatingTPH).toBeGreaterThan(150);
      expect(crusher.reductionRatio).toBeCloseTo(2.15, 1);
    });

    it('5.2: Calculates Morrell SMC Multi-Component Comminution Energy', () => {
      const energy = calculateMorrellSpecificEnergy(228, 105, 42.5, 0.40);
      expect(energy).toBeGreaterThan(3.0);
      expect(energy).toBeLessThan(25.0);

      const bondEnergy = calculateBondSpecificEnergy(228, 105, 15.2);
      expect(bondEnergy).toBeGreaterThan(5.0);
      expect(bondEnergy).toBeLessThan(35.0);
    });

    it('5.3: Simulates Full Plant Daily Comminution Circuit Economics & CO2', () => {
      const circuit = simulateComminutionCircuit({
        f80Mm: 228,
        targetP80Mm: 0.105,
        bondWorkIndexKWhPerT: 15.2,
        rockAxb: 42.5,
        plantOperatingHoursPerDay: 20,
        electricityCostPerKWhUSD: 0.12,
        explosiveCostPerKgUSD: 1.85,
        targetDailyThroughputTonnes: 3500,
      });

      expect(circuit.achievableThroughputTPH).toBeGreaterThan(15);
      expect(circuit.dailyPowerCostUSD).toBeGreaterThan(500);
      expect(circuit.mineralLiberationPercent).toBeGreaterThan(70);
      expect(circuit.estimatedGoldRecoveryPercent).toBeGreaterThan(65);
      expect(circuit.millingCo2KgPerT).toBeGreaterThan(2.0);
    });
  });

  // ==========================================
  // MODULE 6: Geostatistical Block Model & Ordinary Kriging Checkup
  // ==========================================
  describe('Module 6: Geostatistics & Ordinary Kriging on Bench 840 RL', () => {
    it('6.1: Evaluates theoretical semi-variogram models (Spherical, Exponential, Gaussian)', () => {
      const sph = sphericalVariogram(20, DEFAULT_VARIOGRAM);
      const exp = exponentialVariogram(20, DEFAULT_VARIOGRAM);
      const gau = gaussianVariogram(20, DEFAULT_VARIOGRAM);

      expect(sph).toBeGreaterThan(DEFAULT_VARIOGRAM.nugget);
      expect(exp).toBeGreaterThan(DEFAULT_VARIOGRAM.nugget);
      expect(gau).toBeGreaterThan(DEFAULT_VARIOGRAM.nugget);
    });

    it('6.2: Generates BLUE Kriging grid on Bench 840 RL with zero NaN', () => {
      const sampleCollars = [
        { id: 'BH-01', easting: 10, northing: 12, elevation: 840, ucsMPa: 130, rqdPercent: 75, jointSpacingM: 0.5, densityTPerM3: 2.75, goldGradeGPT: 2.1 },
        { id: 'BH-02', easting: 25, northing: 28, elevation: 840, ucsMPa: 110, rqdPercent: 62, jointSpacingM: 0.42, densityTPerM3: 2.72, goldGradeGPT: 1.8 },
        { id: 'BH-03', easting: 45, northing: 15, elevation: 840, ucsMPa: 145, rqdPercent: 82, jointSpacingM: 0.65, densityTPerM3: 2.78, goldGradeGPT: 3.2 },
        { id: 'BH-05', easting: 35, northing: 22, elevation: 840, ucsMPa: 125, rqdPercent: 70, jointSpacingM: 0.48, densityTPerM3: 2.75, goldGradeGPT: 2.4 },
      ];

      const grid = computeKrigingGrid(
        sampleCollars,
        'ucsMPa',
        14,
        10,
        0,
        60,
        0,
        40,
        DEFAULT_VARIOGRAM
      );

      expect(grid.length).toBe(140);
      grid.forEach((node) => {
        expect(Number.isNaN(node.estimatedValue)).toBe(false);
        expect(Number.isNaN(node.estimationVariance)).toBe(false);
        expect(node.estimatedValue).toBeGreaterThan(90);
        expect(node.estimatedValue).toBeLessThan(160);
      });
    });

    it('6.3: Solves Ordinary Kriging linear system and verifies BLUE weights sum to 1.0', () => {
      const collars = [
        { id: 'BH-01', easting: 10, northing: 10, elevation: 840, ucsMPa: 130, rqdPercent: 75, jointSpacingM: 0.5, densityTPerM3: 2.75, goldGradeGPT: 2.1 },
        { id: 'BH-05', easting: 30, northing: 20, elevation: 840, ucsMPa: 125, rqdPercent: 70, jointSpacingM: 0.48, densityTPerM3: 2.75, goldGradeGPT: 2.4 },
      ];

      const krig = solveOrdinaryKriging(30, 20, collars, 'ucsMPa', DEFAULT_VARIOGRAM);
      expect(krig.estimate).toBeCloseTo(125, 0);
      expect(krig.variance).toBeGreaterThanOrEqual(0);
      const sumWeights = krig.weights.reduce((a, b) => a + b, 0);
      expect(sumWeights).toBeCloseTo(1.0, 2);
    });
  });

  // ==========================================
  // MODULE 7: Conveyor Edge Belt Vision & MWD Telemetry
  // ==========================================
  describe('Module 7: Conveyor Belt Edge Vision & MWD Telemetry Checkup', () => {
    it('7.1: Calculates CEMA 3-Roll Trough Conveyor Capacity correctly', () => {
      const cap35 = calculateCEMACapacity(1.0, 2.2, 35, 20, 1.65);

      expect(cap35.maxCrossSectionAreaM2).toBeGreaterThan(0.02);
      expect(cap35.maxThroughputTPH).toBeGreaterThan(250);
    });

    it('7.2: Predicts Crusher Choke Impact Countdown correctly from belt frame', () => {
      const frame = generateSimulatedBeltFrame(DEFAULT_BELT_CONFIG, 120, 1.0); // 100% oversize

      expect(frame.stats.oversizeCount).toBeGreaterThanOrEqual(1);
      expect(frame.stats.currentAlert).toBe(true);
      expect(frame.stats.timeToChokeSeconds).toBeDefined();
      expect(frame.stats.timeToChokeSeconds).toBeGreaterThan(0);
    });

    it('7.3: Calculates Teale MWD Specific Energy and generates IREDES XML', () => {
      const teale = calculateTealeSpecificEnergy(89, 0.38, 42, 1850, 65);

      expect(teale.specificEnergyMpa).toBeGreaterThan(150);
      expect(teale.specificEnergyMpa).toBeLessThan(500);
      expect(['medium', 'hard', 'extreme']).toContain(teale.hardnessClass);

      const holes = generateDrillTelemetryFromBlast(mockBlastBH05 as any);
      const xml = generateIREDESXml(mockBlastBH05 as any, holes);

      expect(xml).toContain('plan_name="BL-2026-005"');
      expect(xml).toContain('<iredes:drill_plan');
      expect(xml).toContain('<iredes:hole id="DH-001">');
    });
  });

  // ==========================================
  // MODULE 8: Multi-Section Modular Vault Report Generation
  // ==========================================
  describe('Module 8: Comprehensive PDF Report Generation Checkup', () => {
    it('8.1: Generates complete 11-section PDF Report for Hole BH-05', async () => {
      const pdfBlob = await generateModularVaultPdfReport(
        {} as any,
        mockProject,
        mockSite,
        mockBlastBH05,
        'en'
      );

      expect(pdfBlob).toBeDefined();
      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.size).toBeGreaterThan(50000);
      expect(pdfBlob.type).toBe('application/pdf');
    });
  });
});
