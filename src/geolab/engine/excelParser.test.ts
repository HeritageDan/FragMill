import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { parseAndValidateUploadedExcel } from './excelParser';
import { generateInputTemplateXlsx } from './templateGenerator';

describe('GeoLab Excel Template & Upload Parser', () => {
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/Classeur1.xlsx');

  it('generates a clean input template and successfully parses it back for Proctor', async () => {
    const templateBlob = generateInputTemplateXlsx('proctor', 'fr');
    expect(templateBlob.size).toBeGreaterThan(1000);

    const buffer = await templateBlob.arrayBuffer();
    const result = await parseAndValidateUploadedExcel(buffer, 'proctor');

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.rawInput?.points.length).toBeGreaterThanOrEqual(3);
    expect(result.computedResults?.maxDryDensityGcm3).toBeGreaterThan(1.8);
  });

  it('generates a clean input template and successfully parses it back for Grain Size', async () => {
    const templateBlob = generateInputTemplateXlsx('grain_size', 'fr');
    const buffer = await templateBlob.arrayBuffer();
    const result = await parseAndValidateUploadedExcel(buffer, 'grain_size');

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.computedResults?.passing2mmPercent).toBeDefined();
  });

  it('generates a clean input template and successfully parses it back for Water Content', async () => {
    const templateBlob = generateInputTemplateXlsx('water_content', 'fr');
    const buffer = await templateBlob.arrayBuffer();
    const result = await parseAndValidateUploadedExcel(buffer, 'water_content');

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.computedResults?.meanWaterContentPercent).toBeDefined();
  });

  it('directly parses and validates real lab file Classeur1.xlsx for Proctor', async () => {
    const buffer = fs.readFileSync(fixturePath).buffer;
    const result = await parseAndValidateUploadedExcel(buffer, 'proctor');

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.rawInput?.points.length).toBe(5);
    expect(result.computedResults?.opmMoisturePercent).toBeCloseTo(7.3, 1);
    expect(result.computedResults?.maxDryDensityGcm3).toBeCloseTo(2.225, 3);
  });

  it('directly parses and validates real lab file Classeur1.xlsx for Grain Size', async () => {
    const buffer = fs.readFileSync(fixturePath).buffer;
    const result = await parseAndValidateUploadedExcel(buffer, 'grain_size');

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.computedResults?.passing2mmPercent).toBeCloseTo(97.2, 1);
    expect(result.computedResults?.passing008mmPercent).toBeCloseTo(0.3, 1);
  });

  it('directly parses and validates real lab file Classeur1.xlsx for Water Content', async () => {
    const buffer = fs.readFileSync(fixturePath).buffer;
    const result = await parseAndValidateUploadedExcel(buffer, 'water_content');

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.computedResults?.meanWaterContentPercent).toBeCloseTo(10.7, 1);
  });
});
