import { describe, it, expect } from 'vitest';
import {
  calculate3DRockVolume,
  apply3DStereologicalCorrection,
  generateDemoDroneSurvey,
} from './drone3d/droneSizing';
import {
  generateSimulatedBeltFrame,
  DEFAULT_BELT_CONFIG,
} from './beltVision/beltAnalyzer';
import {
  generatePatternTiming,
  calculateUSBMPPV,
  generateFaceProfile,
} from './timing/initiationSimulator';
import {
  calculateBondSpecificEnergy,
  calculateMorrellSpecificEnergy,
  estimateMineralRecovery,
  simulateComminutionCircuit,
  generateEconomicTradeoffCurve,
} from './comminution/bondMorrellEngine';
import {
  sphericalVariogram,
  interpolateIDW,
  computeKrigingGrid,
  DEFAULT_VARIOGRAM,
  generateDemoBoreholes,
} from './geostatistics/krigingEngine';
import {
  generateIREDESXml,
  generateDrillPatternCsv,
  generateDrillTelemetryFromBlast,
} from './telemetry/iredesGenerator';
import {
  generateBlastPdfReport,
  exportBlastWorkbookXlsx,
  generatePrintableA4CalibrationSheet,
  generateModularVaultPdfReport,
  generateSingleSectionPdfReport,
} from './export';

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
  });
});
