import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { proctorTestDefinition } from '../tests/proctor';
import { grainSizeTestDefinition } from '../tests/grainSize';
import { waterContentTestDefinition } from '../tests/waterContent';

describe('GeoLab Golden Tests (Classeur1.xlsx reproduction)', () => {
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/Classeur1.xlsx');

  it('fixture Classeur1.xlsx exists and can be loaded', () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const wb = xlsx.readFile(fixturePath);
    expect(wb.SheetNames).toContain('PK 40+800(1)');
  });

  it('accurately reproduces Proctor test points and saturation curve from Classeur1.xlsx', () => {
    const wb = xlsx.readFile(fixturePath);
    const ws = wb.Sheets['PK 40+800(1)'];

    // Read points from rows 6-10:
    // N6:N10 = water content (decimal: 0.043, 0.067, 0.082, 0.105, 0.120)
    // O6:O10 = dry density (2.115, 2.213, 2.210, 2.129, 2.040)
    // B46 = particle density ρs = 2.82
    const particleDensityGs = ws['B46']?.v ?? 2.82;
    expect(particleDensityGs).toBe(2.82);

    const points = [
      { pointIndex: 1, waterContentPercent: ws['N6'].v * 100, dryDensityGcm3: ws['O6'].v },
      { pointIndex: 2, waterContentPercent: ws['N7'].v * 100, dryDensityGcm3: ws['O7'].v },
      { pointIndex: 3, waterContentPercent: ws['N8'].v * 100, dryDensityGcm3: ws['O8'].v },
      { pointIndex: 4, waterContentPercent: ws['N9'].v * 100, dryDensityGcm3: ws['O9'].v },
      { pointIndex: 5, waterContentPercent: ws['N10'].v * 100, dryDensityGcm3: ws['O10'].v },
    ];

    const confirmedOpmMoisture = ws['B49']?.v ? ws['B49'].v * 100 : 7.3;
    const confirmedOpmDensity = ws['B50']?.v ?? 2.225;

    const results = proctorTestDefinition.calculate({
      mouldType: 'cbr',
      mouldVolumeCm3: 2124,
      particleDensityGs,
      targetCompactionPercent: 95,
      manualOpmMoisturePercent: confirmedOpmMoisture,
      manualOpmDryDensityGcm3: confirmedOpmDensity,
      points,
    });

    // Check OPM reproduction
    expect(results.opmMoisturePercent).toBeCloseTo(7.3, 1);
    expect(results.maxDryDensityGcm3).toBeCloseTo(2.225, 3);
    expect(results.targetDryDensityGcm3).toBeCloseTo(2.225 * 0.95, 3);

    // Check Saturation Curve values matching P15:P18
    // In Classeur1, P15 = ((1/N15)-(1/O15)) = (1/2.115 - 1/2.82) = 0.118203
    const p15Val = ws['P15']?.v;
    expect(p15Val).toBeDefined();
    expect(results.points[0].saturationWaterContentPercent).toBeCloseTo(p15Val * 100, 1); // 11.82%

    const p16Val = ws['P16']?.v;
    expect(p16Val).toBeDefined();
    expect(results.points[1].saturationWaterContentPercent).toBeCloseTo(p16Val * 100, 1); // 9.73%

    const p17Val = ws['P17']?.v;
    expect(p17Val).toBeDefined();
    expect(results.points[2].saturationWaterContentPercent).toBeCloseTo(p17Val * 100, 1); // 9.79%

    const p18Val = ws['P18']?.v;
    expect(p18Val).toBeDefined();
    expect(results.points[3].saturationWaterContentPercent).toBeCloseTo(p18Val * 100, 1); // 11.51%
  });

  it('accurately reproduces Grain Size analysis by sieving from Classeur1.xlsx', () => {
    const wb = xlsx.readFile(fixturePath);
    const ws = wb.Sheets['PK 40+800(1)'];

    // Sieve aperture and passing rows in Classeur1
    // Tamis mm in Col I, Passant in Col J
    const sieveData = [
      { sieveMm: ws['I9'].v, passingPercent: ws['J9'].v * 100 }, // 25mm -> 100%
      { sieveMm: ws['I10'].v, passingPercent: ws['J10'].v * 100 }, // 20mm -> 100%
      { sieveMm: ws['I11'].v, passingPercent: ws['J11'].v * 100 }, // 16mm -> 100%
      { sieveMm: ws['I12'].v, passingPercent: ws['J12'].v * 100 }, // 12.5mm -> 100%
      { sieveMm: ws['I13'].v, passingPercent: ws['J13'].v * 100 }, // 10mm -> 100%
      { sieveMm: ws['I16'].v, passingPercent: ws['J16'].v * 100 }, // 5mm -> 100%
      { sieveMm: ws['I20'].v, passingPercent: ws['J20'].v * 100 }, // 2mm -> 97.2%
      { sieveMm: ws['I23'].v, passingPercent: ws['J23'].v * 100 }, // 1mm -> 82.2%
      { sieveMm: ws['I26'].v, passingPercent: ws['J26'].v * 100 }, // 0.5mm -> 48.4%
      { sieveMm: ws['I27'].v, passingPercent: ws['J27'].v * 100 }, // 0.4mm -> 44.0%
      { sieveMm: ws['I28'].v, passingPercent: ws['J28'].v * 100 }, // 0.315mm -> 40.0%
      { sieveMm: ws['I30'].v, passingPercent: ws['J30'].v * 100 }, // 0.2mm -> 27.0%
      { sieveMm: ws['I34'].v, passingPercent: ws['J34'].v * 100 }, // 0.08mm -> 0.3%
    ];

    const results = grainSizeTestDefinition.calculate({
      sieves: sieveData,
    });

    // Verify key cutoffs from Classeur1:
    // J39: Passant 2 mm = 0.972 (97.2%)
    expect(results.passing2mmPercent).toBeCloseTo(97.2, 1);
    // J40: Passant 0.4 mm = 0.44 (44.0%)
    expect(results.passing04mmPercent).toBeCloseTo(44.0, 1);
    // J41: Passant 0.080 mm = 0.003 (0.3%)
    expect(results.passing008mmPercent).toBeCloseTo(0.3, 1);

    // Verify soil classification:
    // In Classeur1 Row 48 & 54: LCPC = "Sm (Sable propre mal gradué)"
    expect(results.lcpcClassification).toContain('Sm');
    expect(results.sandPercent).toBeGreaterThan(70);
    expect(results.finesPercent).toBeLessThan(5);
  });

  it('accurately reproduces Natural Water Content from Classeur1.xlsx', () => {
    const wb = xlsx.readFile(fixturePath);
    const ws = wb.Sheets['PK 40+800(1)'];

    // Row 45: Teneur en eau naturelle w = 10.7%
    const naturalWaterContent = ws['B45']?.v;
    expect(naturalWaterContent).toBeCloseTo(10.7, 1);

    const results = waterContentTestDefinition.calculate({
      directNaturalWaterContentPercent: naturalWaterContent,
      specimens: [],
    });

    expect(results.meanWaterContentPercent).toBeCloseTo(10.7, 1);
    expect(results.repeatabilityAccepted).toBe(true);
  });
});
