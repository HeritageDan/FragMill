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

  it('accurately reproduces Proctor test points, polynomial fits, and saturation curve', () => {
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

    /**
     * NOTE ON CLASSEUR1.XLSX VALUES:
     * In Classeur1.xlsx sheet 'PK 40+800(1)', cells B49 (w_opm = 7.3%) and B50 (ρd_max = 2.225)
     * are hand-entered constant numbers, NOT computed by Excel formulas.
     * No polynomial least-squares fit reproduces (7.3%, 2.225) exactly:
     * - Order-2 polynomial (standard quadratic) vertex gives:
     *   w_opm = 7.57% and ρd_max = 2.214 g/cm3 (R² = 0.963).
     * - Order-4 polynomial (exact interpolation through 5 points) gives:
     *   w_opm = 7.34% and ρd_max = 2.217 g/cm3 (R² = 1.000).
     * We assert against the documented genuine fit values without manual overrides.
     */

    // Test 1: Default Quadratic Fit (Degree 2)
    const resultsQuad = proctorTestDefinition.calculate({
      mouldType: 'cbr',
      mouldVolumeCm3: 2124,
      particleDensityGs,
      targetCompactionPercent: 95,
      fitMethod: 'quadratic',
      points,
    });

    expect(resultsQuad.fitMethod).toBe('quadratic');
    expect(resultsQuad.opmMoisturePercent).toBeCloseTo(7.57, 2);
    expect(resultsQuad.maxDryDensityGcm3).toBeCloseTo(2.214, 3);
    expect(resultsQuad.targetDryDensityGcm3).toBeCloseTo(2.214 * 0.95, 3);
    expect(resultsQuad.fittedCoefficients.r2).toBeGreaterThan(0.95);

    // Test 2: Quartic Fit (Degree 4 - exact interpolation through 5 points)
    const resultsQuartic = proctorTestDefinition.calculate({
      mouldType: 'cbr',
      mouldVolumeCm3: 2124,
      particleDensityGs,
      targetCompactionPercent: 95,
      fitMethod: 'quartic',
      points,
    });

    expect(resultsQuartic.fitMethod).toBe('quartic');
    expect(resultsQuartic.opmMoisturePercent).toBeCloseTo(7.34, 2);
    expect(resultsQuartic.maxDryDensityGcm3).toBeCloseTo(2.217, 3);
    expect(resultsQuartic.fittedCoefficients.r2).toBeCloseTo(1.0, 2);

    // Test 3: Manual Override
    const resultsManual = proctorTestDefinition.calculate({
      mouldType: 'cbr',
      mouldVolumeCm3: 2124,
      particleDensityGs,
      targetCompactionPercent: 95,
      fitMethod: 'manual',
      manualOpmMoisturePercent: 7.3,
      manualOpmDryDensityGcm3: 2.225,
      points,
    });

    expect(resultsManual.fitMethod).toBe('manual');
    expect(resultsManual.opmMoisturePercent).toBe(7.3);
    expect(resultsManual.maxDryDensityGcm3).toBe(2.225);

    // Saturation Curve reproduction matching P15:P18
    // In Classeur1, P15 = ((1/N15)-(1/O15)) = (1/2.115 - 1/2.82) = 0.118203 (11.82%)
    const p15Val = ws['P15']?.v;
    expect(p15Val).toBeDefined();
    expect(resultsQuad.points[0].saturationWaterContentPercent).toBeCloseTo(p15Val * 100, 1); // 11.82%

    const p16Val = ws['P16']?.v;
    expect(p16Val).toBeDefined();
    expect(resultsQuad.points[1].saturationWaterContentPercent).toBeCloseTo(p16Val * 100, 1); // 9.73%

    const p17Val = ws['P17']?.v;
    expect(p17Val).toBeDefined();
    expect(resultsQuad.points[2].saturationWaterContentPercent).toBeCloseTo(p17Val * 100, 1); // 9.79%

    const p18Val = ws['P18']?.v;
    expect(p18Val).toBeDefined();
    expect(resultsQuad.points[3].saturationWaterContentPercent).toBeCloseTo(p18Val * 100, 1); // 11.51%
  });

  it('accurately reproduces Grain Size analysis by sieving with log-linear interpolation', () => {
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

    /**
     * HAND-CALCULATED LOG-LINEAR INTERPOLATIONS:
     *
     * 1. D10 (Aperture for 10% passing):
     *    Between 0.08 mm (0.3% pass) and 0.20 mm (27.0% pass).
     *    Fraction f = (10 - 0.3) / (27.0 - 0.3) = 9.7 / 26.7 = 0.363296
     *    log10(D10) = log10(0.08) + f * (log10(0.20) - log10(0.08))
     *               = -1.09691 + 0.363296 * 0.397940 = -0.952336
     *    D10 = 10^(-0.952336) = 0.1116 mm -> 0.112 mm
     *
     * 2. D30 (Aperture for 30% passing):
     *    Between 0.20 mm (27.0% pass) and 0.315 mm (40.0% pass).
     *    Fraction f = (30 - 27.0) / (40.0 - 27.0) = 3.0 / 13.0 = 0.230769
     *    log10(D30) = log10(0.20) + f * (log10(0.315) - log10(0.20))
     *               = -0.69897 + 0.230769 * 0.197281 = -0.653457
     *    D30 = 10^(-0.653457) = 0.2221 mm -> 0.222 mm
     *
     * 3. D60 (Aperture for 60% passing):
     *    Between 0.50 mm (48.4% pass) and 1.00 mm (82.2% pass).
     *    Fraction f = (60 - 48.4) / (82.2 - 48.4) = 11.6 / 33.8 = 0.343195
     *    log10(D60) = log10(0.50) + f * (log10(1.00) - log10(0.50))
     *               = -0.30103 + 0.343195 * 0.301030 = -0.197718
     *    D60 = 10^(-0.197718) = 0.63428 mm -> 0.634 mm
     *
     * 4. Uniformity & Curvature coefficients:
     *    Cu = D60 / D10 = 0.634 / 0.112 = 5.66
     *    Cc = (D30^2) / (D10 * D60) = (0.222^2) / (0.112 * 0.634) = 0.049284 / 0.071008 = 0.69
     *
     * 5. Soil Classification (LCPC / USCS):
     *    Fines (< 0.08 mm) = 0.3% (< 5%) -> Clean coarse soil
     *    Sand (0.08 - 2 mm) = 97.2% - 0.3% = 96.9%
     *    Gravel (> 2 mm) = 2.8%
     *    Since Sand > Gravel, soil is Sand (S).
     *    Well-graded sand requires Cu > 6 and 1 <= Cc <= 3.
     *    Here Cu = 5.66 (< 6) and Cc = 0.69 (< 1), so it is poorly graded:
     *    LCPC classification: "Sm (Sable propre mal gradué)"
     */

    expect(results.d10Mm).toBe(0.112);
    expect(results.d30Mm).toBe(0.222);
    expect(results.d60Mm).toBe(0.634);
    expect(results.cu).toBe(5.66);
    expect(results.cc).toBe(0.69);
    expect(results.lcpcClassification).toBe('Sm (Sable propre mal gradué)');
  });

  it('accurately computes water content from specimen masses with repeatability check', () => {
    /**
     * Hand-calculated specimen expectations:
     * Specimen 1 (Tare m0 = 25.40 g):
     *   m1 (wet + tare) = 145.80 g
     *   m2 (dry + tare) = 134.20 g
     *   Water mass = 145.80 - 134.20 = 11.60 g
     *   Dry soil mass = 134.20 - 25.40 = 108.80 g
     *   w1 = (11.60 / 108.80) * 100 = 10.66176...% -> 10.66%
     *
     * Specimen 2 (Tare m0 = 24.80 g):
     *   m1 (wet + tare) = 152.10 g
     *   m2 (dry + tare) = 139.90 g
     *   Water mass = 152.10 - 139.90 = 12.20 g
     *   Dry soil mass = 139.90 - 24.80 = 115.10 g
     *   w2 = (12.20 / 115.10) * 100 = 10.59948...% -> 10.60%
     *
     * Mean w = (10.66176 + 10.59948) / 2 = 10.63%
     * Difference = |10.66176 - 10.59948| = 0.062% <= 0.5% tolerance
     */
    const results = waterContentTestDefinition.calculate({
      maxTolerancePercent: 0.5,
      specimens: [
        { specimenId: 'A', tareMassG: 25.40, wetSoilPlusTareG: 145.80, drySoilPlusTareG: 134.20 },
        { specimenId: 'B', tareMassG: 24.80, wetSoilPlusTareG: 152.10, drySoilPlusTareG: 139.90 },
      ],
    });

    expect(results.specimens[0].waterContentPercent).toBeCloseTo(10.66, 2);
    expect(results.specimens[1].waterContentPercent).toBeCloseTo(10.60, 2);
    expect(results.meanWaterContentPercent).toBeCloseTo(10.63, 2);
    expect(results.differenceBetweenSpecimensPercent).toBeCloseTo(0.06, 2);
    expect(results.repeatabilityAccepted).toBe(true);
  });

  it('informative: direct-value passthrough from Classeur1.xlsx (not a golden test of mass calculation)', () => {
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
