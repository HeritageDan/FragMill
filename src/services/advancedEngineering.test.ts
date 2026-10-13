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
});
