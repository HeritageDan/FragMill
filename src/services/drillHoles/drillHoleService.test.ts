import { describe, it, expect } from 'vitest';
import {
  generateDefaultDrillHolesFromBlast,
  calculateDrillHoleSummary,
  syncBlastWithDrillHoles,
  exportDrillHolesToCsv,
  mapRawRowsToDrillHoles,
} from './drillHoleService';
import type { Blast, DetailedDrillHole } from '../../types';

describe('Drill Hole Management & CSV/Excel Service', () => {
  const mockBlast: Blast = {
    id: 'blast-test-01',
    siteId: 'site-1',
    projectId: 'proj-1',
    blastId: 'BL-TEST-001',
    dateTime: '2026-10-29T10:00',
    weather: 'Clear',
    notes: 'Unit test blast',
    parameters: {
      benchHeight: 10.0,
      holeDiameter: 89,
      holeDepth: 11.0,
      subdrill: 1.0,
      burden: 3.0,
      spacing: 3.5,
      stemmingLength: 2.2,
      numberOfHoles: 12,
      holeInclination: 90,
      explosiveType: 'ANFO',
      rws: 100,
      chargePerHole: 22.0,
      bottomChargeLength: 2.0,
      columnChargeLength: 6.8,
      initiationSequenceNotes: 'Electronic',
      waterInHoles: false,
      drillingDeviationEstimate: 0.1,
    },
    rockMass: {
      rockType: 'Granodiorite',
      density: 2.70,
      jointSetCount: 3,
      meanJointSpacing: 0.45,
      jointOrientation: 'dip_into_face',
      estimatedGsiOrRmr: 75,
      ucsMPa: 120,
      youngsModulusGPa: 60,
    },
    images: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('generates a realistic default drillhole pattern with per-hole variations', () => {
    const holes = generateDefaultDrillHolesFromBlast(mockBlast);
    expect(holes.length).toBe(12);

    // Front row holes should be inclined or marked face
    const faceHoles = holes.filter((h) => h.rowNumber === 1);
    expect(faceHoles.length).toBeGreaterThan(0);
    expect(faceHoles[0].inclinationDeg).toBe(80);

    // Coordinates should be generated with positive bounds
    expect(holes[0].eastingX).toBeDefined();
    expect(holes[0].northingY).toBeDefined();
    expect(holes[0].elevationZ).toBeCloseTo(840, 0);
  });

  it('calculates comprehensive aggregated statistics across holes', () => {
    const sampleHoles: DetailedDrillHole[] = [
      {
        holeId: 'A01',
        rowNumber: 1,
        eastingX: 0,
        northingY: 0,
        elevationZ: 840,
        diameterMm: 89,
        depthM: 11.0,
        burdenM: 3.0,
        spacingM: 3.5,
        subdrillM: 1.0,
        stemmingM: 2.2,
        inclinationDeg: 80,
        waterDepthM: 0,
        toeChargeKg: 8.0,
        columnChargeKg: 14.0,
        totalChargeKg: 22.0,
        powderFactorKgPerM3: 0.21,
        rockType: 'Granodiorite',
        ucsMPa: 125,
        rqdPercent: 78,
        densityTPerM3: 2.70,
        detonatorDelayMs: 0,
        detonatorType: 'Electronic',
      },
      {
        holeId: 'A02',
        rowNumber: 1,
        eastingX: 3.5,
        northingY: 0,
        elevationZ: 840,
        diameterMm: 89,
        depthM: 11.2,
        burdenM: 3.0,
        spacingM: 3.5,
        subdrillM: 1.0,
        stemmingM: 2.2,
        inclinationDeg: 80,
        waterDepthM: 1.5, // Wet hole
        toeChargeKg: 12.0,
        columnChargeKg: 12.0,
        totalChargeKg: 24.0,
        powderFactorKgPerM3: 0.23,
        rockType: 'Granodiorite',
        ucsMPa: 110,
        rqdPercent: 70,
        densityTPerM3: 2.70,
        detonatorDelayMs: 25,
        detonatorType: 'Electronic',
      },
      {
        holeId: 'B01',
        rowNumber: 2,
        eastingX: 1.75,
        northingY: 3.0,
        elevationZ: 840,
        diameterMm: 89,
        depthM: 11.5,
        burdenM: 3.0,
        spacingM: 3.5,
        subdrillM: 1.0,
        stemmingM: 2.4,
        inclinationDeg: 90,
        waterDepthM: 0,
        toeChargeKg: 7.5,
        columnChargeKg: 15.0,
        totalChargeKg: 22.5,
        powderFactorKgPerM3: 0.21,
        rockType: 'Granodiorite',
        ucsMPa: 135,
        rqdPercent: 82,
        densityTPerM3: 2.70,
        detonatorDelayMs: 65,
        detonatorType: 'Electronic',
      },
    ];

    const summary = calculateDrillHoleSummary(sampleHoles, 10.0);
    expect(summary.totalHoles).toBe(3);
    expect(summary.totalExplosiveKg).toBe(68.5);
    expect(summary.wetHolesCount).toBe(1);
    expect(summary.frontRowHolesCount).toBe(2);
    expect(summary.maxDelayMs).toBe(65);
    expect(summary.avgUcsMPa).toBe(123);
    expect(summary.bounds.minX).toBe(0);
    expect(summary.bounds.maxX).toBe(3.5);
  });

  it('synchronizes a Blast with imported drillholes dataset', () => {
    const customHoles: DetailedDrillHole[] = [
      {
        holeId: 'X01',
        rowNumber: 1,
        eastingX: 10,
        northingY: 20,
        elevationZ: 850,
        diameterMm: 102,
        depthM: 12.5,
        burdenM: 3.4,
        spacingM: 4.0,
        subdrillM: 1.2,
        stemmingM: 2.6,
        inclinationDeg: 90,
        waterDepthM: 0,
        toeChargeKg: 10.0,
        columnChargeKg: 20.0,
        totalChargeKg: 30.0,
        rockType: 'Basalt',
        ucsMPa: 145,
        rqdPercent: 85,
        densityTPerM3: 2.85,
        detonatorDelayMs: 0,
      },
    ];

    const updated = syncBlastWithDrillHoles(mockBlast, customHoles);
    expect(updated.drillHoles).toBeDefined();
    expect(updated.drillHoles!.length).toBe(1);
    expect(updated.parameters.numberOfHoles).toBe(1);
    expect(updated.parameters.holeDiameter).toBe(102);
    expect(updated.parameters.holeDepth).toBe(12.5);
    expect(updated.parameters.burden).toBe(3.4);
    expect(updated.parameters.spacing).toBe(4.0);
    expect(updated.rockMass.ucsMPa).toBe(145);
  });

  it('exports drillholes to CSV formatted string correctly', () => {
    const holes = generateDefaultDrillHolesFromBlast(mockBlast);
    const csv = exportDrillHolesToCsv(holes);
    expect(csv).toContain('Hole_ID');
    expect(csv).toContain('Easting_X_m');
    expect(csv).toContain('Hardness_UCS_MPa');
    expect(csv).toContain('A01');
  });

  it('correctly parses Excel sample template headers in English including wet holes and UCS', () => {
    const rawEnglishRows = [
      {
        Hole_ID: 'A01',
        Row_Number: 1,
        Easting_X_m: 0.0,
        Northing_Y_m: 0.0,
        Elevation_Z_m: 840.0,
        Diameter_mm: 89,
        Depth_m: 11.0,
        Burden_m: 3.0,
        Spacing_m: 3.5,
        Subdrill_m: 1.0,
        Stemming_m: 2.2,
        Inclination_deg: 80,
        Water_Depth_m: 0.0,
        Toe_Explosive: 'Bulk Emulsion',
        Toe_Charge_kg: 8.0,
        Column_Explosive: 'ANFO',
        Column_Charge_kg: 14.0,
        Air_Deck_m: 0.0,
        Total_Charge_kg: 22.0,
        Rock_Type: 'Granodiorite',
        Hardness_UCS_MPa: 125,
        RQD_Percent: 78,
        Density_t_m3: 2.68,
        Delay_ms: 0,
        Detonator_Type: 'Electronic i-kon',
        Notes: 'Dry face hole',
      },
      {
        Hole_ID: 'B02',
        Row_Number: 2,
        Easting_X_m: 5.25,
        Northing_Y_m: 3.0,
        Elevation_Z_m: 840.0,
        Diameter_mm: 89,
        Depth_m: 11.8,
        Burden_m: 3.0,
        Spacing_m: 3.5,
        Subdrill_m: 1.0,
        Stemming_m: 2.4,
        Inclination_deg: 90,
        Water_Depth_m: 2.4, // Wet hole with Water_Depth_m header
        Toe_Explosive: 'Bulk Emulsion',
        Toe_Charge_kg: 12.0,
        Column_Explosive: 'Bulk Emulsion',
        Column_Charge_kg: 11.0,
        Air_Deck_m: 0.0,
        Total_Charge_kg: 23.0,
        Rock_Type: 'Granodiorite',
        Hardness_UCS_MPa: 95,
        RQD_Percent: 60,
        Density_t_m3: 2.68,
        Delay_ms: 90,
        Detonator_Type: 'Electronic i-kon',
        Notes: 'Wet hole test',
      },
    ];

    const parsed = mapRawRowsToDrillHoles(rawEnglishRows, 10.0);
    expect(parsed.length).toBe(2);

    // Dry hole
    expect(parsed[0].holeId).toBe('A01');
    expect(parsed[0].waterDepthM).toBe(0.0);
    expect(parsed[0].ucsMPa).toBe(125);
    expect(parsed[0].burdenM).toBe(3.0);
    expect(parsed[0].spacingM).toBe(3.5);

    // Wet hole MUST be detected!
    expect(parsed[1].holeId).toBe('B02');
    expect(parsed[1].waterDepthM).toBe(2.4);
    expect(parsed[1].ucsMPa).toBe(95);
    expect(parsed[1].totalChargeKg).toBe(23.0);

    const summary = calculateDrillHoleSummary(parsed, 10.0);
    expect(summary.wetHolesCount).toBe(1);
    expect(summary.totalHoles).toBe(2);
  });

  it('correctly parses Excel sample template headers in French with accents and unit suffixes', () => {
    const rawFrenchRows = [
      {
        ID_Trou: 'A01',
        'Ligne_Rangée': 1,
        Est_X_m: 0.0,
        Nord_Y_m: 0.0,
        Cote_Z_m: 840.0,
        Diametre_mm: 89,
        Profondeur_m: 11.0,
        Banquette_m: 3.0,
        Espacement_m: 3.5,
        Surforage_m: 1.0,
        Bourrage_m: 2.2,
        Inclinaison_deg: 80,
        Eau_Profondeur_m: 0.0,
        Explosif_Pied: 'Emulsion Vrac',
        Charge_Pied_kg: 8.0,
        Explosif_Colonne: 'ANFO',
        Charge_Colonne_kg: 14.0,
        Air_Deck_m: 0.0,
        Charge_Totale_kg: 22.0,
        Type_Roche: 'Granodiorite',
        Durete_UCS_MPa: 128,
        RQD_Pourcent: 80,
        Densite_t_m3: 2.68,
        Retard_ms: 0,
        Type_Detonateur: 'Electronique i-kon',
        Remarques: 'Trou sec',
      },
      {
        ID_Trou: 'B02',
        'Ligne_Rangée': 2,
        Est_X_m: 5.25,
        Nord_Y_m: 3.0,
        Cote_Z_m: 840.0,
        Diametre_mm: 89,
        Profondeur_m: 11.8,
        Banquette_m: 3.0,
        Espacement_m: 3.5,
        Surforage_m: 1.0,
        Bourrage_m: 2.4,
        Inclinaison_deg: 90,
        Eau_Profondeur_m: 1.8, // Wet hole with French Eau_Profondeur_m
        Explosif_Pied: 'Emulsion Vrac',
        Charge_Pied_kg: 12.0,
        Explosif_Colonne: 'Emulsion Vrac',
        Charge_Colonne_kg: 11.0,
        Air_Deck_m: 0.0,
        Charge_Totale_kg: 23.0,
        Type_Roche: 'Granodiorite',
        Durete_UCS_MPa: 92,
        RQD_Pourcent: 62,
        Densite_t_m3: 2.68,
        Retard_ms: 90,
        Type_Detonateur: 'Electronique i-kon',
        Remarques: 'Trou humide avec 1.8m eau',
      },
    ];

    const parsed = mapRawRowsToDrillHoles(rawFrenchRows, 10.0);
    expect(parsed.length).toBe(2);

    expect(parsed[0].holeId).toBe('A01');
    expect(parsed[0].rowNumber).toBe(1);
    expect(parsed[0].waterDepthM).toBe(0.0);
    expect(parsed[0].ucsMPa).toBe(128);

    // Wet hole MUST be detected from Eau_Profondeur_m!
    expect(parsed[1].holeId).toBe('B02');
    expect(parsed[1].rowNumber).toBe(2);
    expect(parsed[1].waterDepthM).toBe(1.8);
    expect(parsed[1].ucsMPa).toBe(92);

    const summary = calculateDrillHoleSummary(parsed, 10.0);
    expect(summary.wetHolesCount).toBe(1);
  });

  it('successfully parses all 4 generated real .xlsx test files and accurately detects wet holes and hole counts', () => {
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');

    const files = [
      { name: 'FragMill_Test_01_Regular_Granodiorite_36Holes.xlsx', expectedHoles: 36, expectedWet: 4 },
      { name: 'FragMill_Test_02_Irregular_Faulted_Face_32Holes.xlsx', expectedHoles: 32, expectedWet: 7 },
      { name: 'FragMill_Test_03_Deep_Water_Depression_35Holes.xlsx', expectedHoles: 35, expectedWet: 12 },
      { name: 'FragMill_Test_04_AirDeck_Presplit_Optimized_30Holes.xlsx', expectedHoles: 30, expectedWet: 2 },
    ];

    for (const f of files) {
      const filePath = path.resolve(__dirname, '../../../public/test_datasets', f.name);
      expect(fs.existsSync(filePath)).toBe(true);

      const fileBuf = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuf, { type: 'buffer' });

      // Test English Sheet (Sheet 0)
      const sheetName0 = workbook.SheetNames[0];
      const rawRowsEn = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName0]);
      const holesEn = mapRawRowsToDrillHoles(rawRowsEn, 10.0);
      expect(holesEn.length).toBe(f.expectedHoles);
      const summaryEn = calculateDrillHoleSummary(holesEn, 10.0);
      expect(summaryEn.wetHolesCount).toBe(f.expectedWet);

      // Test French Sheet (Sheet 1)
      const sheetName1 = workbook.SheetNames[1];
      const rawRowsFr = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName1]);
      const holesFr = mapRawRowsToDrillHoles(rawRowsFr, 10.0);
      expect(holesFr.length).toBe(f.expectedHoles);
      const summaryFr = calculateDrillHoleSummary(holesFr, 10.0);
      expect(summaryFr.wetHolesCount).toBe(f.expectedWet);
    }
  });
});
