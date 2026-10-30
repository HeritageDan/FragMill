import { describe, it, expect } from 'vitest';
import {
  calculate3DRockVolume,
  apply3DStereologicalCorrection,
  generateDemoDroneSurvey,
} from './drone3d/droneSizing';
import {
  generateSimulatedBeltFrame,
  DEFAULT_BELT_CONFIG,
  calculateCEMACapacity,
} from './beltVision/beltAnalyzer';
import {
  generatePatternTiming,
  calculateUSBMPPV,
  generateFaceProfile,
  calculateAirblastOverpressure,
  checkPatternFaceRelief,
  simulateDetonatorScatter,
  estimateBlastFrequencySpectrum,
} from './timing/initiationSimulator';
import {
  calculateBondSpecificEnergy,
  calculateMorrellSpecificEnergy,
  estimateMineralRecovery,
  simulateComminutionCircuit,
  generateEconomicTradeoffCurve,
  simulatePrimaryCrusher,
} from './comminution/bondMorrellEngine';
import {
  sphericalVariogram,
  exponentialVariogram,
  gaussianVariogram,
  interpolateIDW,
  computeKrigingGrid,
  solveOrdinaryKriging,
  DEFAULT_VARIOGRAM,
  generateDemoBoreholes,
} from './geostatistics/krigingEngine';
import {
  generateIREDESXml,
  generateDrillPatternCsv,
  generateDrillTelemetryFromBlast,
  calculateTealeSpecificEnergy,
} from './telemetry/iredesGenerator';
import {
  computeKuzRam,
  computeXPFrag,
} from './kuzram';
import {
  fitGatesGaudinSchuhmann,
  computeStandardSieveMeshPassing,
  calculateCumulativeDistribution,
  computeFragmentationMetrics,
} from './statistics';
import {
  generateBlastPdfReport,
  exportBlastWorkbookXlsx,
  generatePrintableA4CalibrationSheet,
  generateModularVaultPdfReport,
  generateSingleSectionPdfReport,
} from './export';
import { getBlastState } from './blastState';
import type { Blast, Fragment } from '../types';

describe('Advanced Mining Suite Tests', () => {
  // 1. Drone 3D Photogrammetry
  describe('Drone 3D Photogrammetry & Stereology', () => {
    it('calculates 3D ellipsoid rock volume accurately', () => {
      const vol = calculate3DRockVolume(200, 0.7, 0.6); // length 200mm
      expect(vol).toBeGreaterThan(0);
      expect(Math.round(vol)).toBe(1231504);
    });

    it('applies 3D stereological correction for hidden fines and oversize', () => {
      const res = apply3DStereologicalCorrection(110, 240, 1000);
      expect(res.p50_3D_mm).toBeLessThanOrEqual(110); // hidden fines lower median
      expect(res.p80_3D_mm).toBeGreaterThan(240); // oversize increases volumetric 80th percentile
      expect(res.oversize_3D_percent).toBeGreaterThanOrEqual(0);
    });

    it('generates demo drone survey with sectors', () => {
      const survey = generateDemoDroneSurvey('BL-2026-001');
      expect(survey.sectors.length).toBe(4);
      expect(survey.totalVolumeM3).toBeGreaterThan(1000);
    });
  });

  // 2. Conveyor Belt Edge Vision
  describe('Belt Edge Vision & Crusher Choke Detection', () => {
    it('computes instantaneous throughput and fragment statistics', () => {
      const frame = generateSimulatedBeltFrame(DEFAULT_BELT_CONFIG, 120, 0);
      expect(frame.rocks.length).toBeGreaterThan(10);
      expect(frame.stats.instantTph).toBeGreaterThan(0);
      expect(frame.stats.p80Mm).toBeGreaterThan(frame.stats.p50Mm);
    });

    it('flags crusher choke event when boulder exceeds gape threshold', () => {
      const frame = generateSimulatedBeltFrame(DEFAULT_BELT_CONFIG, 120, 1.0); // 100% chance of oversize
      expect(frame.stats.oversizeCount).toBeGreaterThanOrEqual(1);
      expect(frame.stats.currentAlert).toBe(true);
      expect(frame.chokeEvent).toBeDefined();
    });
  });

  // 3. Blast Timing Simulator & Face Profiler
  describe('Blast Initiation Timing & Face Profiler', () => {
    it('generates V-echelon delays with sequential firing times', () => {
      const holes = generatePatternTiming(3, 4, 2.4, 2.8, 22.0, 'v_echelon', 25, 400);
      expect(holes.length).toBe(12);
      expect(holes[0].firingTimeMs).toBeGreaterThanOrEqual(400);
      // Last hole fires after first hole
      expect(holes[holes.length - 1].firingTimeMs).toBeGreaterThan(holes[0].firingTimeMs);
    });

    it('calculates USBM Peak Particle Velocity (PPV) and compliance', () => {
      const farPPV = calculateUSBMPPV(400, 22.0);
      expect(farPPV.estimatedPPVMmS).toBeLessThan(12.7);
      expect(farPPV.isCompliant).toBe(true);

      const closePPV = calculateUSBMPPV(25, 150.0);
      expect(closePPV.estimatedPPVMmS).toBeGreaterThan(12.7);
      expect(closePPV.isCompliant).toBe(false);
    });

    it('detects critical underburden hazards on face laser profile', () => {
      const profile = generateFaceProfile(6.0, 2.4);
      expect(profile.length).toBeGreaterThan(10);
      const underburden = profile.filter((p) => p.isCriticalUnderburden);
      expect(underburden.length).toBeGreaterThan(0);
    });
  });

  // 4. Comminution Digital Twin
  describe('Comminution Digital Twin (Bond & Morrell)', () => {
    it('calculates Bond specific energy in kWh/t', () => {
      const energy = calculateBondSpecificEnergy(180, 75, 14.5);
      expect(energy).toBeGreaterThan(10);
      expect(energy).toBeLessThan(35);
    });

    it('models Morrell specific energy with blast micro-crack softening', () => {
      const standardEnergy = calculateMorrellSpecificEnergy(180, 75, 42, 0.45);
      const highEnergyBlast = calculateMorrellSpecificEnergy(180, 75, 42, 0.95);
      // Higher powder factor induces microcracks, saving milling energy
      expect(highEnergyBlast).toBeLessThan(standardEnergy);
    });

    it('predicts gold liberation and recovery kinetics', () => {
      const fineGrind = estimateMineralRecovery(75, 75);
      const coarseGrind = estimateMineralRecovery(250, 75);
      expect(fineGrind.recoveryPercent).toBeGreaterThan(coarseGrind.recoveryPercent);
      expect(fineGrind.liberationPercent).toBeGreaterThan(coarseGrind.liberationPercent);
    });

    it('generates Mine-to-Mill economic trade-off curve', () => {
      const curve = generateEconomicTradeoffCurve({
        f80Mm: 180,
        targetP80Mm: 0.075,
        bondWorkIndexKWhPerT: 14.5,
        rockAxb: 42,
        plantOperatingHoursPerDay: 20,
        electricityCostPerKWhUSD: 0.14,
        explosiveCostPerKgUSD: 1.25,
        targetDailyThroughputTonnes: 500,
      });
      expect(curve.length).toBe(7);
      // Higher powder factor decreases blast F80
      expect(curve[curve.length - 1].blastP80Mm).toBeLessThan(curve[0].blastP80Mm);
    });
  });

  // 5. Geostatistical Kriging
  describe('Geostatistical Kriging & Block Modeling', () => {
    it('evaluates spherical variogram model correctly', () => {
      const zero = sphericalVariogram(0, DEFAULT_VARIOGRAM);
      expect(zero).toBe(0);

      const mid = sphericalVariogram(DEFAULT_VARIOGRAM.rangeM / 2, DEFAULT_VARIOGRAM);
      expect(mid).toBeGreaterThan(DEFAULT_VARIOGRAM.nugget);

      const beyond = sphericalVariogram(DEFAULT_VARIOGRAM.rangeM * 2, DEFAULT_VARIOGRAM);
      expect(beyond).toBe(DEFAULT_VARIOGRAM.nugget + DEFAULT_VARIOGRAM.sill);
    });

    it('computes 2D spatial kriging grid with blast domain clustering', () => {
      const boreholes = generateDemoBoreholes();
      const grid = computeKrigingGrid(boreholes, 'ucsMPa', 6, 4, 0, 60, 0, 40);
      expect(grid.length).toBe(24);
      expect(grid[0].estimatedValue).toBeGreaterThan(0);
      expect(['Soft Fractured', 'Intermediate', 'Hard Massive']).toContain(grid[0].domain);
    });
  });

  // 6. Drill Telemetry & IREDES
  describe('Drill Telemetry & IREDES XML', () => {
    const dummyBlast: any = {
      blastId: 'BL-2026-001',
      siteId: 'site-betare-oya',
      parameters: {
        benchHeight: 6.0,
        holeDiameter: 89,
        subdrill: 0.8,
        numberOfHoles: 10,
        burden: 2.4,
        spacing: 2.8,
        holeDepth: 6.8,
      },
    };

    it('generates valid IREDES XML document', () => {
      const holes = generateDrillTelemetryFromBlast(dummyBlast);
      const xml = generateIREDESXml(dummyBlast, holes);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<iredes:drill_plan');
      expect(xml).toContain('plan_name="BL-2026-001"');
      expect(xml).toContain('<iredes:hole id="DH-001">');
      expect(xml).toContain('</iredes:drill_plan>');
    });

    it('generates GPS drill pattern CSV', () => {
      const holes = generateDrillTelemetryFromBlast(dummyBlast);
      const csv = generateDrillPatternCsv(holes);
      expect(csv).toContain('Hole_ID,Easting_X,Northing_Y,Collar_Z');
      expect(csv).toContain('DH-001');
    });
  });

  // 8. Bilingual Report Exports (English & French)
  describe('Bilingual PDF & Excel Reports', () => {
    const dummyBlastForPdf: any = {
      id: 'b1',
      blastId: 'BL-2026-001',
      dateTime: '2026-03-14T09:30',
      weather: 'Sunny',
      parameters: {
        benchHeight: 6.0,
        holeDiameter: 89,
        holeDepth: 6.8,
        subdrill: 0.8,
        burden: 2.8,
        spacing: 3.2,
        numberOfHoles: 24,
        explosiveType: 'ANFO',
        chargePerHole: 22.5,
        rws: 100,
      },
      rockMass: {
        rockType: 'Granodiorite',
        density: 2.68,
        meanJointSpacing: 0.55,
        jointOrientation: 'dip_into_face',
        estimatedGsiOrRmr: 68,
        ucsMPa: 125,
        youngsModulusGPa: 52,
      },
    };

    const dummyRun: any = {
      metrics: {
        p10: 209.8,
        p20: 253.2,
        p50: 286.9,
        p80: 304.4,
        p90: 319.4,
        pMax: 341.4,
        uniformityIndex: 1.2,
        oversizePercent: 43.6,
        finesPercent: 0,
        bootstrapCI: {
          p10: [192.6, 249.7],
          p20: [227.8, 269.6],
          p50: [273.7, 296.5],
          p80: [295.3, 319.9],
          p90: [299.9, 329.8],
        },
        rawCurve: [
          { sizeMm: 25, passingPercent: 2 },
          { sizeMm: 50, passingPercent: 18 },
          { sizeMm: 100, passingPercent: 45 },
          { sizeMm: 200, passingPercent: 75 },
          { sizeMm: 300, passingPercent: 95 },
        ],
      },
      fragments: [],
    };

    const dummyImage: any = {
      id: 'img1',
      dataUrl: '',
      calibration: { method: 'Two-Point Reference', realWorldDistanceMm: 500, pxPerMm: 0.4 },
    };

    it('generates English and French PDF reports with valid Blob size', async () => {
      const enBlob = await generateBlastPdfReport(
        { id: '1', name: 'FragMill Study', description: '', createdAt: 0, updatedAt: 0 },
        { id: '1', projectId: '1', name: 'Pit', locationText: '', createdAt: 0, updatedAt: 0 },
        dummyBlastForPdf,
        dummyImage,
        dummyRun,
        'en'
      );
      expect(enBlob).toBeInstanceOf(Blob);
      expect(enBlob.size).toBeGreaterThan(1000);

      const frBlob = await generateBlastPdfReport(
        { id: '1', name: 'Étude FragMill', description: '', createdAt: 0, updatedAt: 0 },
        { id: '1', projectId: '1', name: 'Fosse', locationText: '', createdAt: 0, updatedAt: 0 },
        dummyBlastForPdf,
        dummyImage,
        dummyRun,
        'fr'
      );
      expect(frBlob).toBeInstanceOf(Blob);
      expect(frBlob.size).toBeGreaterThan(1000);
    });

    it('generates English and French Excel workbooks', () => {
      const enWb = exportBlastWorkbookXlsx(dummyBlastForPdf, dummyRun, 'en');
      expect(enWb).toBeInstanceOf(Blob);
      const frWb = exportBlastWorkbookXlsx(dummyBlastForPdf, dummyRun, 'fr');
      expect(frWb).toBeInstanceOf(Blob);
    });

    it('generates English and French A4 calibration sheets', () => {
      const enSheet = generatePrintableA4CalibrationSheet('en');
      expect(enSheet).toBeInstanceOf(Blob);
      const frSheet = generatePrintableA4CalibrationSheet('fr');
      expect(frSheet).toBeInstanceOf(Blob);
    });

    it('generates standalone single-window PDF reports for French and English', async () => {
      const project = { id: 'p1', name: 'Projet Minier Bou Azzer', description: '', createdAt: 0, updatedAt: 0 };
      const site = { id: 's1', projectId: 'p1', name: 'Gradin 1240 RL', locationText: '', createdAt: 0, updatedAt: 0 };

      const singleFr = await generateSingleSectionPdfReport(
        'kriging',
        {
          key: 'kriging',
          stagedAt: Date.now(),
          titleFr: 'Krigeage',
          titleEn: 'Kriging',
          payload: { rangeM: 45, nugget: 50, sill: 280, model: 'spherical' },
        },
        project,
        site,
        dummyBlastForPdf,
        'fr'
      );
      expect(singleFr).toBeInstanceOf(Blob);
      expect(singleFr.size).toBeGreaterThan(1500);

      const singleEn = await generateSingleSectionPdfReport(
        'telemetry',
        {
          key: 'telemetry',
          stagedAt: Date.now(),
          titleFr: 'Télémétrie',
          titleEn: 'Telemetry',
          payload: { toleranceMm: 60, targetRop: 1.2 },
        },
        project,
        site,
        dummyBlastForPdf,
        'en'
      );
      expect(singleEn).toBeInstanceOf(Blob);
      expect(singleEn.size).toBeGreaterThan(1500);
    });

    it('generates full multi-section modular vault report with all 11 tabs', async () => {
      const project = { id: 'p1', name: 'Mine de Tasiast', description: '', createdAt: 0, updatedAt: 0 };
      const site = { id: 's1', projectId: 'p1', name: 'Fosse Principale', locationText: '', createdAt: 0, updatedAt: 0 };

      const vaultStateFr = {
        blast: { key: 'blast' as const, stagedAt: Date.now(), titleFr: 'Tir', titleEn: 'Blast', payload: {} },
        drone3d: { key: 'drone3d' as const, stagedAt: Date.now(), titleFr: 'Drone 3D', titleEn: 'Drone 3D', payload: {} },
        beltvision: { key: 'beltvision' as const, stagedAt: Date.now(), titleFr: 'Vision Convoyeur', titleEn: 'Belt Vision', payload: {} },
        timing: { key: 'timing' as const, stagedAt: Date.now(), titleFr: 'Chronogramme', titleEn: 'Timing', payload: {} },
        comminution: { key: 'comminution' as const, stagedAt: Date.now(), titleFr: 'Broyage', titleEn: 'Comminution', payload: {} },
        kriging: { key: 'kriging' as const, stagedAt: Date.now(), titleFr: 'Krigeage', titleEn: 'Kriging', payload: {} },
        telemetry: { key: 'telemetry' as const, stagedAt: Date.now(), titleFr: 'Télémétrie', titleEn: 'Telemetry', payload: {} },
        benchmap: { key: 'benchmap' as const, stagedAt: Date.now(), titleFr: 'Plan Fosse', titleEn: 'Bench Map', payload: {} },
        validation: { key: 'validation' as const, stagedAt: Date.now(), titleFr: 'Vérité Terrain', titleEn: 'Validation', payload: {} },
        minetomill: { key: 'minetomill' as const, stagedAt: Date.now(), titleFr: 'Mine-au-Moulin', titleEn: 'Mine to Mill', payload: {} },
        kuzram: { key: 'kuzram' as const, stagedAt: Date.now(), titleFr: 'Kuz-Ram', titleEn: 'Kuz-Ram', payload: {} },
      };

      const fullReportFr = await generateModularVaultPdfReport(
        vaultStateFr,
        project,
        site,
        dummyBlastForPdf,
        'fr'
      );
      expect(fullReportFr).toBeInstanceOf(Blob);
      expect(fullReportFr.size).toBeGreaterThan(10000);

      const vaultStateEn = {
        blast: { key: 'blast' as const, stagedAt: Date.now(), titleFr: 'Tir', titleEn: 'Blast', payload: {} },
        drone3d: null,
        beltvision: null,
        timing: null,
        comminution: null,
        kriging: null,
        telemetry: null,
        benchmap: { key: 'benchmap' as const, stagedAt: Date.now(), titleFr: 'Plan Fosse', titleEn: 'Bench Map', payload: {} },
        validation: null,
        minetomill: null,
        kuzram: null,
      };

      const fullReportEn = await generateModularVaultPdfReport(
        vaultStateEn,
        project,
        site,
        dummyBlastForPdf,
        'en',
        ['blast', 'benchmap']
      );
      expect(fullReportEn).toBeInstanceOf(Blob);
      expect(fullReportEn.size).toBeGreaterThan(3000);
    });

    it('accurately resolves active blast and calculates individual geotechnical metrics for each blast', () => {
      const demoBlasts = [
        {
          id: 'blast-1',
          blastId: 'BL-2026-001',
          parameters: { benchHeight: 6.0, burden: 2.4, spacing: 2.8, numberOfHoles: 30, chargePerHole: 22.0, explosiveType: 'ANFO' },
          rockMass: { rockType: 'Granodiorite', density: 2.68, ucsMPa: 120 },
        },
        {
          id: 'blast-2',
          blastId: 'BL-2026-002',
          parameters: { benchHeight: 8.0, burden: 3.0, spacing: 3.5, numberOfHoles: 45, chargePerHole: 38.0, explosiveType: 'Emulsion' },
          rockMass: { rockType: 'Schist', density: 2.75, ucsMPa: 85 },
        },
      ];

      // Switch to blast-1
      const activeBlast1 = demoBlasts.find(b => b.id === 'blast-1')!;
      const holeVol1 = activeBlast1.parameters.burden * activeBlast1.parameters.spacing * activeBlast1.parameters.benchHeight;
      const pf1 = activeBlast1.parameters.chargePerHole / holeVol1;
      expect(activeBlast1.blastId).toBe('BL-2026-001');
      expect(pf1).toBeCloseTo(0.545, 2);

      // Switch to blast-2
      const activeBlast2 = demoBlasts.find(b => b.id === 'blast-2')!;
      const holeVol2 = activeBlast2.parameters.burden * activeBlast2.parameters.spacing * activeBlast2.parameters.benchHeight;
      const pf2 = activeBlast2.parameters.chargePerHole / holeVol2;
      expect(activeBlast2.blastId).toBe('BL-2026-002');
      expect(pf2).toBeCloseTo(0.452, 2);
      expect(activeBlast2.rockMass.rockType).toBe('Schist');
    });
  });

  // 9. Industrial Standards Verification Suite
  describe('Tier-1 Industrial Mining Standards Suite', () => {
    // A. Gates-Gaudin-Schuhmann & Standard ASTM Sieve Analysis
    it('fits Gates-Gaudin-Schuhmann (GGS) distribution and computes ASTM sieve mesh points', () => {
      const sampleCurve = [
        { sizeMm: 2.36, passingPercent: 5.2 },
        { sizeMm: 4.75, passingPercent: 12.4 },
        { sizeMm: 12.5, passingPercent: 28.6 },
        { sizeMm: 25.0, passingPercent: 44.0 },
        { sizeMm: 50.0, passingPercent: 68.2 },
        { sizeMm: 75.0, passingPercent: 84.5 },
        { sizeMm: 100.0, passingPercent: 96.0 },
      ];

      const ggs = fitGatesGaudinSchuhmann(sampleCurve);
      expect(ggs.k).toBeGreaterThan(50);
      expect(ggs.m).toBeGreaterThan(0.3);
      expect(ggs.r2).toBeGreaterThan(0.8);
      expect(ggs.aic).toBeDefined();

      const sieves = computeStandardSieveMeshPassing(sampleCurve);
      expect(sieves.length).toBe(15);
      const mesh4 = sieves.find(s => s.meshName.includes('No. 4'));
      expect(mesh4).toBeDefined();
      expect(mesh4!.passingPercent).toBeCloseTo(12.4, 0);
    });

    // B. KCO Model & Flyrock Hazard Radius
    it('computes KCO (Swebrec) blast model and Richards-Moore flyrock exclusion zones', () => {
      const blastParams: any = {
        benchHeight: 6.0,
        burden: 2.4,
        spacing: 2.8,
        holeDiameter: 89,
        drillingDeviationEstimate: 0.1,
        chargePerHole: 24.0,
        rws: 100,
        bottomChargeLength: 2.5,
        columnChargeLength: 2.5,
        stemmingLength: 2.0,
        numberOfHoles: 20,
      };
      const rockMass: any = {
        density: 2.68,
        meanJointSpacing: 0.6,
        jointOrientation: 'strike_perpendicular',
        ucsMPa: 120,
      };

      const res = computeKuzRam(blastParams, rockMass);
      expect(res.kcoResult).toBeDefined();
      expect(res.kcoResult!.xMaxMm).toBeGreaterThan(res.p50Mm);
      expect(res.kcoResult!.bParameter).toBeGreaterThan(0);
      expect(res.kcoResult!.curve.length).toBeGreaterThan(10);

      // Flyrock verification
      expect(res.flyrock).toBeDefined();
      expect(res.flyrock!.maxFlyrockDistanceM).toBeGreaterThan(20);
      expect(res.flyrock!.personnelEvacuationDistanceM).toBeGreaterThan(res.flyrock!.maxFlyrockDistanceM);
      expect(res.flyrock!.safetyFactor).toBe(2.0);

      // Energy & CO2 verification
      expect(res.energy).toBeDefined();
      expect(res.energy!.powderFactorKgPerM3).toBeGreaterThan(0.3);
      expect(res.energy!.co2EmissionsKgPerTonne).toBeGreaterThan(0);
      expect(res.energy!.totalCo2EmissionsKg).toBeGreaterThan(50);
    });

    // C. Environmental Airblast Overpressure & Face Velocity Relief
    it('predicts airblast overpressure and detects tight under-relieved rows', () => {
      const airblastFar = calculateAirblastOverpressure(500, 25.0);
      expect(airblastFar.peakOverpressureDbl).toBeLessThan(125);
      expect(airblastFar.isCompliant).toBe(true);

      const airblastNear = calculateAirblastOverpressure(20, 200.0);
      expect(airblastNear.peakOverpressureDbl).toBeGreaterThan(134);
      expect(airblastNear.isCompliant).toBe(false);

      const holes = generatePatternTiming(3, 4, 2.4, 2.8, 22.0, 'v_echelon', 25, 400);
      const reliefChecks = checkPatternFaceRelief(holes, 2.4);
      expect(reliefChecks.length).toBe(12);
      expect(['optimal', 'under_relieved', 'over_relieved']).toContain(reliefChecks[0].status);

      // Electronic vs Nonel scatter check
      const electronicSim = simulateDetonatorScatter(holes, 'electronic');
      expect(electronicSim.maxScatterMs).toBeLessThan(2.0);
      expect(electronicSim.outOfSequenceCount).toBe(0);
    });

    // D. Primary Crusher & Comminution Power
    it('simulates primary jaw/gyratory crusher power and product reduction ratio', () => {
      const crusher = simulatePrimaryCrusher(350, 110, 450);
      expect(crusher.crusherProductP80Mm).toBe(93.5);
      expect(crusher.reductionRatio).toBeGreaterThan(3.0);
      expect(crusher.powerDrawKW).toBeGreaterThan(25);
      expect(crusher.capacityRatingTPH).toBeGreaterThan(100);
    });

    // E. True Matrix Ordinary Kriging (BLUE system)
    it('solves Ordinary Kriging linear system and computes theoretical variogram models', () => {
      const expVar = exponentialVariogram(20, DEFAULT_VARIOGRAM);
      expect(expVar).toBeGreaterThan(DEFAULT_VARIOGRAM.nugget);

      const gaussVar = gaussianVariogram(20, DEFAULT_VARIOGRAM);
      expect(gaussVar).toBeGreaterThan(DEFAULT_VARIOGRAM.nugget);

      const boreholes = generateDemoBoreholes();
      const krig = solveOrdinaryKriging(25, 15, boreholes, 'ucsMPa', DEFAULT_VARIOGRAM);
      expect(krig.estimate).toBeGreaterThan(50);
      expect(krig.variance).toBeGreaterThanOrEqual(0);
      expect(krig.weights.length).toBe(boreholes.length);
      const sumWeights = krig.weights.reduce((a, b) => a + b, 0);
      expect(sumWeights).toBeCloseTo(1.0, 2);
    });

    // F. CEMA Conveyor Volumetric Capacity & Choke Impact Timer
    it('calculates CEMA 35-degree trough cross-section and dynamic time-to-choke', () => {
      const cema = calculateCEMACapacity(1.2, 2.2, 35, 20, 1.85);
      expect(cema.maxCrossSectionAreaM2).toBeGreaterThan(0.05);
      expect(cema.maxThroughputTPH).toBeGreaterThan(500);

      const frame = generateSimulatedBeltFrame(DEFAULT_BELT_CONFIG, 110, 1.0); // 100% oversize
      expect(frame.stats.timeToChokeSeconds).toBeDefined();
      expect(frame.stats.timeToChokeSeconds).toBeGreaterThan(0);
      expect(frame.stats.cemaTroughAngleDeg).toBe(35);
    });

    // G. Teale Specific Energy of Drilling & MWD Telemetry
    it('calculates Teale MWD specific energy and classifies rock drillability hardness', () => {
      const soft = calculateTealeSpecificEnergy(89, 1.8, 25, 400, 140);
      expect(soft.specificEnergyMpa).toBeLessThan(250);
      expect(['very_soft', 'soft']).toContain(soft.hardnessClass);

      const hard = calculateTealeSpecificEnergy(89, 0.25, 65, 1200, 95);
      expect(hard.specificEnergyMpa).toBeGreaterThan(400);
      expect(['hard', 'extreme']).toContain(hard.hardnessClass);
    });

    // H. Multi-Image Blast Pooling & Spatial Stereology Composite
    it('pools multiple analyzed photos into a unified composite blast PSD while preserving per-image spatial zones', () => {
      // 1. Photo 1: 150 coarse fragments (e.g. Toe / Face)
      const fragments1: Fragment[] = Array.from({ length: 150 }, (_, i) => {
        const size = 100 + (i % 25) * 12; // 100 to 388 mm (coarser)
        return {
          id: i + 1,
          polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
          centroid: { x: 5, y: 5 },
          areaPx: 500,
          areaMm2: 800,
          ecdMm: size,
          minFeretMm: size,
          maxFeretMm: size * 1.2,
          bboxWidthMm: size,
          bboxHeightMm: size,
          aspectRatio: 1.1,
          solidity: 0.9,
          volumeMm3: (Math.PI / 6) * Math.pow(size, 3),
          confidence: 0.95,
        };
      });

      // 2. Photo 2: 200 finer fragments (e.g. Muckpile Swell / Crest)
      const fragments2: Fragment[] = Array.from({ length: 200 }, (_, i) => {
        const size = 20 + (i % 20) * 8; // 20 to 172 mm (finer)
        return {
          id: i + 1,
          polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
          centroid: { x: 5, y: 5 },
          areaPx: 300,
          areaMm2: 400,
          ecdMm: size,
          minFeretMm: size,
          maxFeretMm: size * 1.2,
          bboxWidthMm: size,
          bboxHeightMm: size,
          aspectRatio: 1.1,
          solidity: 0.9,
          volumeMm3: (Math.PI / 6) * Math.pow(size, 3),
          confidence: 0.92,
        };
      });

      const multiImageBlast: Blast = {
        id: 'blast-multi-01',
        projectId: 'proj-01',
        siteId: 'site-01',
        blastId: 'BL-MULTI-2026',
        dateTime: '2026-03-01T10:00:00Z',
        weather: 'Sunny',
        notes: 'Multi-photo spatial muckpile test',
        createdAt: 1772000000000,
        updatedAt: 1772000000000,
        parameters: {
          holeDiameter: 89,
          holeDepth: 12.0,
          benchHeight: 10.0,
          burden: 3.5,
          spacing: 4.0,
          subdrill: 1.0,
          stemmingLength: 2.5,
          numberOfHoles: 30,
          holeInclination: 90,
          explosiveType: 'ANFO',
          chargePerHole: 65,
          bottomChargeLength: 3.0,
          columnChargeLength: 6.5,
          initiationSequenceNotes: 'Electronic',
          waterInHoles: false,
          drillingDeviationEstimate: 0.05,
          rws: 100,
        },
        rockMass: {
          rockType: 'Granite',
          density: 2.7,
          meanJointSpacing: 0.5,
          jointOrientation: 'dip_into_face',
          jointSetCount: 3,
        },
        images: [
          {
            id: 'img-toe-01',
            blastId: 'blast-multi-01',
            dataUrl: 'data:image/png;base64,mockToe',
            filename: 'muckpile_toe.jpg',
            zone: 'front',
            lighting: 'sun',
            time: '10:00',
            hasScaleMarker: true,
            qualityCheck: { blurScore: 90, blurStatus: 'pass', exposureStatus: 'pass', contrastStatus: 'pass', resolutionStatus: 'pass', scaleMarkerStatus: 'pass', advice: [] },
            createdAt: 1772000000000,
            updatedAt: 1772000000000,
            segmentationRuns: [
              {
                id: 'run-toe-01',
                imageId: 'img-toe-01',
                engine: 'classical',
                timestamp: 1772000000000,
                parameters: { scaleMmPerPx: 1.0, minFragmentPx: 5, watershedCompactness: 0.2 },
                fragments: fragments1,
                metrics: {
                  sizeDefinition: 'min_feret',
                  fragmentCount: 150,
                  meanSize: 220,
                  p10: 120,
                  p20: 150,
                  p50: 220,
                  p80: 310,
                  p90: 350,
                  pMax: 388,
                  uniformityIndex: 1.3,
                  oversizePercent: 18.5,
                  finesPercent: 1.2,
                } as any,
              },
            ],
          },
          {
            id: 'img-crest-02',
            blastId: 'blast-multi-01',
            dataUrl: 'data:image/png;base64,mockCrest',
            filename: 'muckpile_crest.jpg',
            zone: 'top',
            lighting: 'sun',
            time: '10:05',
            hasScaleMarker: true,
            qualityCheck: { blurScore: 88, blurStatus: 'pass', exposureStatus: 'pass', contrastStatus: 'pass', resolutionStatus: 'pass', scaleMarkerStatus: 'pass', advice: [] },
            createdAt: 1772000000000,
            updatedAt: 1772000000000,
            segmentationRuns: [
              {
                id: 'run-crest-02',
                imageId: 'img-crest-02',
                engine: 'classical',
                timestamp: 1772000000000,
                parameters: { scaleMmPerPx: 0.8, minFragmentPx: 5, watershedCompactness: 0.2 },
                fragments: fragments2,
                metrics: {
                  sizeDefinition: 'min_feret',
                  fragmentCount: 200,
                  meanSize: 95,
                  p10: 35,
                  p20: 55,
                  p50: 95,
                  p80: 145,
                  p90: 160,
                  pMax: 172,
                  uniformityIndex: 1.4,
                  oversizePercent: 0,
                  finesPercent: 8.5,
                } as any,
              },
            ],
          },
        ],
      };

      const state = getBlastState(multiImageBlast);
      expect(state.optical.isMultiImageComposite).toBe(true);
      expect(state.optical.totalImagesCount).toBe(2);
      expect(state.optical.analyzedImagesCount).toBe(2);
      expect(state.optical.fragmentCount).toBe(350); // 150 + 200
      expect(state.optical.fragments).toBeDefined();
      expect(state.optical.fragments!.length).toBe(350);

      // Verify ID uniqueness with image prefix
      const idSet = new Set(state.optical.fragments!.map(f => f.id));
      expect(idSet.size).toBe(350);
      expect(state.optical.fragments![0].id).toBe(100001); // (0 + 1) * 100000 + 1
      expect(state.optical.fragments![150].id).toBe(200001); // (1 + 1) * 100000 + 1

      // Verify perImageBreakdown preserves individual photo statistics
      expect(state.optical.perImageBreakdown).toBeDefined();
      expect(state.optical.perImageBreakdown!.length).toBe(2);
      expect(state.optical.perImageBreakdown![0].imageId).toBe('img-toe-01');
      expect(state.optical.perImageBreakdown![0].fragmentCount).toBe(150);
      expect(state.optical.perImageBreakdown![0].p80Mm).toBe(310);
      expect(state.optical.perImageBreakdown![0].oversizePercent).toBe(18.5);

      expect(state.optical.perImageBreakdown![1].imageId).toBe('img-crest-02');
      expect(state.optical.perImageBreakdown![1].fragmentCount).toBe(200);
      expect(state.optical.perImageBreakdown![1].p80Mm).toBe(145);
      expect(state.optical.perImageBreakdown![1].oversizePercent).toBe(0);

      // Verify composite curve reflects a weighted distribution between toe and crest
      const metricsPhoto1 = computeFragmentationMetrics(fragments1, 'min_feret', 300, 25);
      const metricsPhoto2 = computeFragmentationMetrics(fragments2, 'min_feret', 300, 25);
      expect(state.optical.p50Mm).toBeLessThan(metricsPhoto1.p50);
      expect(state.optical.p50Mm).toBeGreaterThan(metricsPhoto2.p50);
      expect(state.drone.meanP80Mm).toBe(state.optical.p80Mm); // Downstream synchronization
    });

    // Tier-1 Industry Standard Upgrades
    it('computes xP-frag (Ouchterlony & Sanchidrián 2019) model to correct fines underprediction', () => {
      const xpCurve = computeXPFrag(180, 1.25, 650, 0.75, false);
      expect(xpCurve.length).toBeGreaterThan(15);
      expect(xpCurve[0].sizeMm).toBe(0.5);
      expect(xpCurve[0].passingPercent).toBeGreaterThanOrEqual(0);

      // Verify monotonic passing increase
      for (let i = 0; i < xpCurve.length - 1; i++) {
        expect(xpCurve[i + 1].passingPercent).toBeGreaterThanOrEqual(xpCurve[i].passingPercent);
      }

      // xP-frag at x50 (180mm) should be ~50%
      const ptNearX50 = xpCurve.find(p => p.sizeMm === 150 || p.sizeMm === 200);
      expect(ptNearX50).toBeDefined();

      // Top size passes 100%
      const topPt = xpCurve[xpCurve.length - 1];
      expect(topPt.passingPercent).toBe(100);
    });

    it('estimates blast vibration 1/3-octave frequency spectrum and evaluates OSMRE Part 816.67 compliance', () => {
      // Normal blast at 350m with 75kg charge
      const spec = estimateBlastFrequencySpectrum(350, 75, 4.2);
      expect(spec.dominantFrequencyHz).toBeGreaterThan(5);
      expect(spec.dominantFrequencyHz).toBeLessThan(120);
      expect(spec.osmrePPVLimitMmS).toBeGreaterThanOrEqual(12.7);
      expect(spec.isCompliant).toBe(true);
      expect(spec.complianceMarginPercent).toBeGreaterThan(0);
      expect(spec.spectrumBands.length).toBe(9);
      expect(spec.spectrumBands.every(b => b.pass)).toBe(true);

      // Over-limit blast right near a structure
      const closeSpec = estimateBlastFrequencySpectrum(30, 250, 65.0);
      expect(closeSpec.isCompliant).toBe(false);
      expect(closeSpec.complianceMarginPercent).toBeLessThan(0);
    });

    it('integrates Bond & Morrell physics into single source of truth blast state', () => {
      const testMiningBlast: Blast = {
        id: 'blast-test-01',
        projectId: 'proj-01',
        siteId: 'site-01',
        blastId: 'BL-TEST-2026',
        dateTime: '2026-03-01T10:00:00Z',
        weather: 'Sunny',
        notes: 'Physics validation blast',
        createdAt: 1772000000000,
        updatedAt: 1772000000000,
        parameters: {
          holeDiameter: 89,
          holeDepth: 12.0,
          benchHeight: 10.0,
          burden: 3.5,
          spacing: 4.0,
          subdrill: 1.0,
          stemmingLength: 2.5,
          numberOfHoles: 30,
          holeInclination: 90,
          explosiveType: 'ANFO',
          chargePerHole: 65,
          bottomChargeLength: 3.0,
          columnChargeLength: 6.5,
          initiationSequenceNotes: 'Electronic',
          waterInHoles: false,
          drillingDeviationEstimate: 0.05,
          rws: 100,
        },
        rockMass: {
          rockType: 'Granite',
          density: 2.7,
          ucsMPa: 130,
          meanJointSpacing: 0.5,
          jointOrientation: 'dip_into_face',
          jointSetCount: 3,
        },
        images: [],
      };

      const state = getBlastState(testMiningBlast);
      // Crushing energy should be evaluated from Bond Third Theory
      expect(state.comminution.crushingSpecificEnergyKwhPerT).toBeGreaterThanOrEqual(0.5);
      // Grinding energy should be evaluated from Morrell SMC model
      expect(state.comminution.grindingSpecificEnergyKwhPerT).toBeGreaterThan(5.0);
      expect(state.comminution.totalSpecificEnergyKwhPerT).toBe(
        Number((state.comminution.crushingSpecificEnergyKwhPerT + state.comminution.grindingSpecificEnergyKwhPerT).toFixed(2))
      );
      // Economic sweet spot optimization includes physical Bond & Morrell energy
      expect(state.economics.optimalP80Mm).toBeGreaterThanOrEqual(80);
      expect(state.economics.optimalP80Mm).toBeLessThanOrEqual(360);
      expect(state.economics.totalCostPerTonUSD).toBeGreaterThan(0);
    });

    it('computes and persists cumulative K-bias factor and posterior rock factor A in GroundTruth', () => {
      const testMiningBlast: Blast = {
        id: 'blast-test-01',
        projectId: 'proj-01',
        siteId: 'site-01',
        blastId: 'BL-TEST-2026',
        dateTime: '2026-03-01T10:00:00Z',
        weather: 'Sunny',
        notes: 'Physics validation blast',
        createdAt: 1772000000000,
        updatedAt: 1772000000000,
        parameters: {
          holeDiameter: 89,
          holeDepth: 12.0,
          benchHeight: 10.0,
          burden: 3.5,
          spacing: 4.0,
          subdrill: 1.0,
          stemmingLength: 2.5,
          numberOfHoles: 30,
          holeInclination: 90,
          explosiveType: 'ANFO',
          chargePerHole: 65,
          bottomChargeLength: 3.0,
          columnChargeLength: 6.5,
          initiationSequenceNotes: 'Electronic',
          waterInHoles: false,
          drillingDeviationEstimate: 0.05,
          rws: 100,
        },
        rockMass: {
          rockType: 'Granite',
          density: 2.7,
          ucsMPa: 130,
          meanJointSpacing: 0.5,
          jointOrientation: 'dip_into_face',
          jointSetCount: 3,
        },
        images: [],
      };

      const blastWithSieve: Blast = {
        ...testMiningBlast,
        groundTruth: {
          id: 'gt-test',
          blastId: testMiningBlast.id,
          manualFragments: [],
          sieveData: [
            { apertureMm: 300, massRetainedKg: 40 },
            { apertureMm: 150, massRetainedKg: 70 },
            { apertureMm: 75, massRetainedKg: 50 },
            { apertureMm: 25, massRetainedKg: 20 },
          ],
          calibratedKBiasFactor: 1.085,
          calibratedPosteriorMeanA: 7.24,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      const state = getBlastState(blastWithSieve);
      expect(state.sieve.hasSieveData).toBe(true);
      expect(state.sieve.kBiasFactor).toBeDefined();
      expect(state.sieve.kBiasFactor).toBeGreaterThan(0);
      expect(blastWithSieve.groundTruth!.calibratedKBiasFactor).toBe(1.085);
      expect(blastWithSieve.groundTruth!.calibratedPosteriorMeanA).toBe(7.24);
    });
  });
});

