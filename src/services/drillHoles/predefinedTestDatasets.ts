// Predefined Test Drillhole Datasets for FragMill
// Provides 4 distinct, highly realistic drill pattern datasets with >= 30 holes each,
// varying spacings (regular vs irregular), geological strengths, water levels, and charging methods.

import type { DetailedDrillHole } from '../../types';

export interface PredefinedTestDataset {
  id: string;
  nameEn: string;
  nameFr: string;
  descriptionEn: string;
  descriptionFr: string;
  holeCount: number;
  patternType: 'regular' | 'irregular' | 'variable';
  wetHolesCount: number;
  avgUcsMPa: number;
  holes: DetailedDrillHole[];
}

/**
 * Dataset 1: Regular Staggered Granodiorite (36 Holes)
 * - 3 rows x 12 holes on regular 3.5m x 3.0m spacing
 * - 4 wet holes with groundwater inflow in low-lying zone
 * - Hard Granodiorite (UCS: 120 - 152 MPa)
 */
export function getTestDataset1_RegularGranodiorite(): PredefinedTestDataset {
  const holes: DetailedDrillHole[] = [];
  const rows = 3;
  const cols = 12;
  const burden = 3.0;
  const spacing = 3.5;
  const baseElev = 840.0;

  for (let r = 1; r <= rows; r++) {
    const rowPrefix = r === 1 ? 'A' : r === 2 ? 'B' : 'C';
    for (let c = 1; c <= cols; c++) {
      const holeId = `${rowPrefix}${c < 10 ? '0' : ''}${c}`;
      const isFace = r === 1;
      const isStaggered = r % 2 === 0;

      const eastingX = parseFloat(((c - 1) * spacing + (isStaggered ? spacing * 0.5 : 0)).toFixed(2));
      const northingY = parseFloat(((r - 1) * burden).toFixed(2));
      const elevationZ = parseFloat((baseElev + Math.sin(c * 0.7) * 0.25).toFixed(2));
      const depthM = parseFloat((11.0 + (c % 3) * 0.15).toFixed(2));

      // 4 wet holes in Row 2 & 3
      const isWet = (r === 2 && (c === 4 || c === 5 || c === 8)) || (r === 3 && c === 6);
      const waterDepthM = isWet ? parseFloat((1.4 + ((c * 3) % 4) * 0.3).toFixed(1)) : 0;

      const toeExplosiveType = isWet ? 'Bulk Emulsion' : 'Dynamite';
      const toeChargeKg = isWet ? 12.0 : 8.0;
      const columnExplosiveType = isWet ? 'Bulk Emulsion' : 'ANFO';
      const columnChargeKg = isWet ? 11.0 : 14.0;
      const totalChargeKg = parseFloat((toeChargeKg + columnChargeKg).toFixed(1));

      const ucsMPa = 120 + ((c * 7 + r * 5) % 33);
      const rqdPercent = 75 + ((c * 4) % 15);
      const delayMs = (r - 1) * 65 + (c - 1) * 25;

      const vol = burden * spacing * 10.0;
      const powderFactorKgPerM3 = parseFloat((totalChargeKg / vol).toFixed(3));

      holes.push({
        holeId,
        rowNumber: r,
        eastingX,
        northingY,
        elevationZ,
        diameterMm: 89,
        depthM,
        burdenM: burden,
        spacingM: spacing,
        subdrillM: 1.0,
        stemmingM: 2.2,
        inclinationDeg: isFace ? 80 : 90,
        azimuthDeg: isFace ? 180 : 0,
        waterDepthM,
        toeExplosiveType,
        toeChargeKg,
        columnExplosiveType,
        columnChargeKg,
        airDeckM: 0,
        totalChargeKg,
        powderFactorKgPerM3,
        rockType: 'Granodiorite',
        ucsMPa,
        rqdPercent,
        densityTPerM3: 2.68,
        detonatorDelayMs: delayMs,
        detonatorType: 'Electronic i-kon III',
        status: 'planned',
        notes: isFace ? 'Face hole (80° dip)' : isWet ? `Wet hole (Water: ${waterDepthM}m, Emulsion toe)` : 'Regular production',
      });
    }
  }

  return {
    id: 'test-dataset-01-regular-36',
    nameEn: 'Test 01: Regular Granodiorite (36 Holes, 4 Wet)',
    nameFr: 'Test 01 : Granodiorite Régulière (36 Trous, 4 Humides)',
    descriptionEn: 'Uniform 3.0m x 3.5m staggered pattern with 4 wet holes, inclined face row (80°), electronic delays.',
    descriptionFr: 'Maille quinconcée régulière 3.0m x 3.5m avec 4 trous humides, ligne de front inclinée (80°), détonateurs électroniques.',
    holeCount: 36,
    patternType: 'regular',
    wetHolesCount: 4,
    avgUcsMPa: 135,
    holes,
  };
}

/**
 * Dataset 2: Irregular Faulted Face & Andesite (32 Holes)
 * - Variable spacings (2.6m to 4.4m) and variable burdens (2.2m to 3.8m)
 * - Active shear fault zone with soft rock (UCS 55 - 85 MPa) vs competent andesite (UCS 115 - 138 MPa)
 * - 7 wet holes in the permeable fault zone
 */
export function getTestDataset2_IrregularFaultedFace(): PredefinedTestDataset {
  const holes: DetailedDrillHole[] = [];

  // 32 surveyed coordinates with variable burden and spacing
  // Row 1: 11 holes (crest contouring)
  const row1Spacings = [0, 2.7, 5.5, 8.6, 11.4, 15.2, 19.0, 22.8, 26.5, 30.1, 33.6];
  const row1Burdens = [2.6, 2.4, 2.8, 3.1, 2.9, 3.4, 3.2, 3.0, 2.8, 3.1, 3.3];
  const row1Northings = [0.2, 0.4, 0.1, 0.8, 1.2, 1.0, 0.6, 0.3, 0.5, 0.9, 0.7];

  for (let i = 0; i < 11; i++) {
    const holeId = `A${i + 1 < 10 ? '0' : ''}${i + 1}`;
    const eastingX = row1Spacings[i];
    const northingY = row1Northings[i];
    const burdenM = row1Burdens[i];
    const spacingM = i === 0 ? 2.8 : parseFloat((row1Spacings[i] - row1Spacings[i - 1]).toFixed(1));

    // Fault zone is west side: X < 16m
    const inFault = eastingX < 16;
    const ucsMPa = inFault ? Math.round(60 + (i * 4)) : Math.round(118 + ((i * 3) % 20));
    const rqdPercent = inFault ? 45 + (i * 3) : 80 + (i % 10);
    const isWet = inFault && (i === 1 || i === 2 || i === 3);
    const waterDepthM = isWet ? parseFloat((1.6 + i * 0.5).toFixed(1)) : 0;

    const toeChargeKg = isWet ? 10.5 : 7.0;
    const columnChargeKg = isWet ? 9.5 : inFault ? 11.0 : 15.0;
    const totalChargeKg = parseFloat((toeChargeKg + columnChargeKg).toFixed(1));
    const delayMs = i * 25;

    holes.push({
      holeId,
      rowNumber: 1,
      eastingX,
      northingY,
      elevationZ: parseFloat((840.5 - (inFault ? 0.8 : 0.0) + Math.cos(i) * 0.3).toFixed(2)),
      diameterMm: 89,
      depthM: parseFloat((10.8 + (inFault ? 0.6 : 0.0) + (i % 3) * 0.2).toFixed(2)),
      burdenM,
      spacingM,
      subdrillM: 1.0,
      stemmingM: 2.3,
      inclinationDeg: 82,
      azimuthDeg: 175,
      waterDepthM,
      toeExplosiveType: isWet ? 'Bulk Emulsion' : 'Dynamite',
      toeChargeKg,
      columnExplosiveType: isWet ? 'Bulk Emulsion' : (inFault ? 'Heavy ANFO 70/30' : 'ANFO'),
      columnChargeKg,
      airDeckM: 0,
      totalChargeKg,
      powderFactorKgPerM3: parseFloat((totalChargeKg / (burdenM * spacingM * 10)).toFixed(3)),
      rockType: inFault ? 'Sheared Andesite' : 'Massive Andesite',
      ucsMPa,
      rqdPercent,
      densityTPerM3: inFault ? 2.62 : 2.72,
      detonatorDelayMs: delayMs,
      detonatorType: 'Electronic i-kon III',
      status: 'planned',
      notes: inFault ? (isWet ? `Fault seep wet hole (Water: ${waterDepthM}m)` : 'Fault shear zone') : 'Competent andesite',
    });
  }

  // Row 2: 11 production holes
  const row2Spacings = [1.4, 4.2, 7.0, 10.1, 13.5, 17.1, 20.9, 24.7, 28.3, 31.9, 35.2];
  const row2Northings = [3.4, 3.8, 3.6, 4.2, 4.5, 4.1, 3.8, 3.5, 3.7, 4.0, 3.9];
  for (let i = 0; i < 11; i++) {
    const holeId = `B${i + 1 < 10 ? '0' : ''}${i + 1}`;
    const eastingX = row2Spacings[i];
    const northingY = row2Northings[i];
    const inFault = eastingX < 17;
    const isWet = inFault && (i === 1 || i === 2 || i === 3);
    const waterDepthM = isWet ? parseFloat((2.0 + i * 0.5).toFixed(1)) : 0;

    const burdenM = parseFloat((row2Northings[i] - row1Northings[i]).toFixed(2));
    const spacingM = i === 0 ? 3.2 : parseFloat((row2Spacings[i] - row2Spacings[i - 1]).toFixed(1));
    const ucsMPa = inFault ? Math.round(55 + (i * 5)) : Math.round(122 + ((i * 4) % 18));
    const rqdPercent = inFault ? 40 + (i * 3) : 82 + (i % 8);

    const toeChargeKg = isWet ? 12.0 : 8.0;
    const columnChargeKg = isWet ? 11.0 : inFault ? 12.0 : 16.0;
    const totalChargeKg = parseFloat((toeChargeKg + columnChargeKg).toFixed(1));
    const delayMs = 65 + i * 25;

    holes.push({
      holeId,
      rowNumber: 2,
      eastingX,
      northingY,
      elevationZ: parseFloat((840.4 - (inFault ? 0.6 : 0.0) + Math.sin(i) * 0.25).toFixed(2)),
      diameterMm: 89,
      depthM: 11.4,
      burdenM,
      spacingM,
      subdrillM: 1.0,
      stemmingM: 2.4,
      inclinationDeg: 90,
      azimuthDeg: 0,
      waterDepthM,
      toeExplosiveType: isWet ? 'Bulk Emulsion' : 'Dynamite',
      toeChargeKg,
      columnExplosiveType: isWet ? 'Bulk Emulsion' : 'ANFO',
      columnChargeKg,
      airDeckM: 0,
      totalChargeKg,
      powderFactorKgPerM3: parseFloat((totalChargeKg / (burdenM * spacingM * 10)).toFixed(3)),
      rockType: inFault ? 'Sheared Andesite' : 'Massive Andesite',
      ucsMPa,
      rqdPercent,
      densityTPerM3: inFault ? 2.63 : 2.72,
      detonatorDelayMs: delayMs,
      detonatorType: 'Electronic i-kon III',
      status: 'planned',
      notes: inFault ? (isWet ? `Fault wet hole (${waterDepthM}m)` : 'Fault production') : 'Standard production',
    });
  }

  // Row 3: 10 trim holes
  const row3Spacings = [2.0, 5.2, 8.8, 12.2, 15.8, 19.5, 23.4, 27.2, 30.8, 34.4];
  const row3Northings = [6.8, 7.2, 7.0, 7.6, 7.8, 7.4, 7.1, 6.9, 7.2, 7.4];
  for (let i = 0; i < 10; i++) {
    const holeId = `C${i + 1 < 10 ? '0' : ''}${i + 1}`;
    const eastingX = row3Spacings[i];
    const northingY = row3Northings[i];
    const inFault = eastingX < 16;
    const isWet = inFault && i === 2; // C03
    const waterDepthM = isWet ? 1.9 : 0;

    const burdenM = parseFloat((row3Northings[i] - row2Northings[i]).toFixed(2));
    const spacingM = i === 0 ? 3.4 : parseFloat((row3Spacings[i] - row3Spacings[i - 1]).toFixed(1));
    const ucsMPa = inFault ? Math.round(65 + i * 4) : Math.round(128 + ((i * 3) % 15));
    const rqdPercent = inFault ? 50 + i * 2 : 85 + (i % 6);

    const toeChargeKg = isWet ? 11.0 : 7.5;
    const columnChargeKg = isWet ? 10.0 : 14.5;
    const totalChargeKg = parseFloat((toeChargeKg + columnChargeKg).toFixed(1));
    const delayMs = 130 + i * 25;

    holes.push({
      holeId,
      rowNumber: 3,
      eastingX,
      northingY,
      elevationZ: 840.2,
      diameterMm: 89,
      depthM: 11.0,
      burdenM,
      spacingM,
      subdrillM: 1.0,
      stemmingM: 2.5,
      inclinationDeg: 90,
      azimuthDeg: 0,
      waterDepthM,
      toeExplosiveType: isWet ? 'Bulk Emulsion' : 'Dynamite',
      toeChargeKg,
      columnExplosiveType: isWet ? 'Bulk Emulsion' : 'ANFO',
      columnChargeKg,
      airDeckM: 0,
      totalChargeKg,
      powderFactorKgPerM3: parseFloat((totalChargeKg / (burdenM * spacingM * 10)).toFixed(3)),
      rockType: inFault ? 'Sheared Andesite' : 'Massive Andesite',
      ucsMPa,
      rqdPercent,
      densityTPerM3: inFault ? 2.64 : 2.73,
      detonatorDelayMs: delayMs,
      detonatorType: 'Electronic i-kon III',
      status: 'planned',
      notes: isWet ? 'Trim hole with water' : 'Back row trim',
    });
  }

  return {
    id: 'test-dataset-02-irregular-32',
    nameEn: 'Test 02: Irregular Faulted Face (32 Holes, 7 Wet)',
    nameFr: 'Test 02 : Front Irrégulier & Zone de Faille (32 Trous, 7 Humides)',
    descriptionEn: 'Surveyed irregular spacings (2.6-4.4m), active fault zone with soft rock (55-85 MPa) and 7 wet holes.',
    descriptionFr: 'Espacements irréguliers réels (2.6-4.4m), faille géologique avec roche tendre (55-85 MPa) et 7 trous humides.',
    holeCount: 32,
    patternType: 'irregular',
    wetHolesCount: 7,
    avgUcsMPa: 98,
    holes,
  };
}

/**
 * Dataset 3: Deep Water Depression & Basalt (35 Holes)
 * - Bench floor depression with collar elevations dropping from 842.8m to 837.2m
 * - 12 wet holes with water depths up to 4.2m!
 * - High-density basalt (2.85 t/m³), 100% Emulsion charging for flooded holes
 */
export function getTestDataset3_DeepWaterDepression(): PredefinedTestDataset {
  const holes: DetailedDrillHole[] = [];
  const rows = 3;
  const cols = 12; // 12 + 12 + 11 = 35 holes
  const burden = 2.8;
  const spacing = 3.2;

  let count = 0;
  for (let r = 1; r <= rows; r++) {
    const numInRow = r === 3 ? 11 : 12;
    const rowPrefix = r === 1 ? 'A' : r === 2 ? 'B' : 'C';

    for (let c = 1; c <= numInRow; c++) {
      count++;
      const holeId = `${rowPrefix}${c < 10 ? '0' : ''}${c}`;
      const eastingX = parseFloat(((c - 1) * spacing + (r % 2 === 0 ? spacing * 0.5 : 0)).toFixed(2));
      const northingY = parseFloat(((r - 1) * burden).toFixed(2));

      // Central depression around columns 5-8: elevation drops up to 5.6m!
      const distFromCenter = Math.hypot((c - 6.5) * 1.5, (r - 2) * 1.8);
      const elevationDrop = Math.max(0, 5.2 - distFromCenter * 1.1);
      const elevationZ = parseFloat((842.8 - elevationDrop).toFixed(2));

      // Depths vary from 10.0m on high crest up to 13.2m in depression
      const depthM = parseFloat((10.2 + elevationDrop * 0.5).toFixed(2));

      // High water ingress in center of depression
      const isWet = (r === 1 && (c >= 5 && c <= 8)) ||
                    (r === 2 && (c >= 4 && c <= 8)) ||
                    (r === 3 && (c >= 5 && c <= 7));

      let waterDepthM = 0;
      if (isWet) {
        if (c === 6 || c === 7) waterDepthM = parseFloat((3.2 + (r % 2) * 0.9).toFixed(1)); // Up to 4.1m
        else waterDepthM = parseFloat((1.8 + (c % 3) * 0.6).toFixed(1));
      }

      // Wet holes MUST use 100% water-resistant bulk emulsion
      const toeExplosiveType = 'Bulk Emulsion';
      const toeChargeKg = isWet ? 14.0 : 8.5;
      const columnExplosiveType = isWet ? 'Bulk Emulsion' : 'ANFO';
      const columnChargeKg = isWet ? 14.0 : 16.0;
      const totalChargeKg = parseFloat((toeChargeKg + columnChargeKg).toFixed(1));

      const ucsMPa = Math.round(110 + Math.cos(c * 0.8) * 20 + (r * 5));
      const rqdPercent = Math.round(78 + Math.sin(c) * 12);
      const delayMs = (r - 1) * 60 + (c - 1) * 20;

      const vol = burden * spacing * 10.0;
      const powderFactorKgPerM3 = parseFloat((totalChargeKg / vol).toFixed(3));

      holes.push({
        holeId,
        rowNumber: r,
        eastingX,
        northingY,
        elevationZ,
        diameterMm: 89,
        depthM,
        burdenM: burden,
        spacingM: spacing,
        subdrillM: 1.2,
        stemmingM: 2.2,
        inclinationDeg: r === 1 ? 84 : 90,
        azimuthDeg: r === 1 ? 180 : 0,
        waterDepthM,
        toeExplosiveType,
        toeChargeKg,
        columnExplosiveType,
        columnChargeKg,
        airDeckM: 0,
        totalChargeKg,
        powderFactorKgPerM3,
        rockType: 'Olivine Basalt',
        ucsMPa,
        rqdPercent,
        densityTPerM3: 2.85,
        detonatorDelayMs: delayMs,
        detonatorType: 'Electronic i-kon III',
        status: 'planned',
        notes: isWet ? `Deep water ingress (${waterDepthM}m) - 100% Emulsion` : 'Dry basalt bench',
      });
    }
  }

  return {
    id: 'test-dataset-03-water-depression-35',
    nameEn: 'Test 03: Deep Water Depression (35 Holes, 12 Wet)',
    nameFr: 'Test 03 : Dépression Noyée & Basalte (35 Trous, 12 Humides)',
    descriptionEn: 'Undulating bench floor (837.2-842.8m RL) with 12 flooded holes (up to 4.1m water), 100% Bulk Emulsion.',
    descriptionFr: 'Gradin ondulé avec cuvette d’eau (837.2-842.8m) et 12 trous noyés (jusqu’à 4.1m d’eau), 100% émulsion vrac.',
    holeCount: 35,
    patternType: 'variable',
    wetHolesCount: 12,
    avgUcsMPa: 125,
    holes,
  };
}

/**
 * Dataset 4: Air Deck & Pre-Split Wall Control (30 Holes)
 * - Row 1: 10 face production holes (85° inclination)
 * - Row 2: 12 production holes with 1.0m Middle Air Decks
 * - Row 3: 8 pre-split smooth-wall holes closely spaced (1.5m) with light decoupled charges
 * - Competent Quartzite (UCS 142 - 178 MPa, RQD 85 - 96%)
 */
export function getTestDataset4_AirDeckPresplit(): PredefinedTestDataset {
  const holes: DetailedDrillHole[] = [];

  // Row 1: 10 Face Production Holes
  for (let c = 1; c <= 10; c++) {
    const holeId = `A${c < 10 ? '0' : ''}${c}`;
    const eastingX = parseFloat(((c - 1) * 3.2).toFixed(2));
    const northingY = 0.0;
    const isWet = c === 9; // 1 wet hole at east end
    const waterDepthM = isWet ? 1.4 : 0;

    const toeChargeKg = 8.0;
    const columnChargeKg = 13.0;
    const totalChargeKg = 21.0;
    const burdenM = 2.8;
    const spacingM = 3.2;

    holes.push({
      holeId,
      rowNumber: 1,
      eastingX,
      northingY,
      elevationZ: 840.0,
      diameterMm: 89,
      depthM: 10.8,
      burdenM,
      spacingM,
      subdrillM: 0.8,
      stemmingM: 2.2,
      inclinationDeg: 85,
      azimuthDeg: 180,
      waterDepthM,
      toeExplosiveType: isWet ? 'Bulk Emulsion' : 'Dynamite',
      toeChargeKg,
      columnExplosiveType: isWet ? 'Bulk Emulsion' : 'ANFO',
      columnChargeKg,
      airDeckM: 0,
      totalChargeKg,
      powderFactorKgPerM3: parseFloat((totalChargeKg / (burdenM * spacingM * 10)).toFixed(3)),
      rockType: 'Quartzite',
      ucsMPa: 145 + ((c * 3) % 20),
      rqdPercent: 88,
      densityTPerM3: 2.65,
      detonatorDelayMs: 100 + (c - 1) * 20, // Initiates after presplit
      detonatorType: 'Electronic i-kon III',
      status: 'planned',
      notes: isWet ? 'Face hole with water (1.4m)' : 'Face production (85°)',
    });
  }

  // Row 2: 12 Production Holes with 1.0m Middle Air Deck
  for (let c = 1; c <= 12; c++) {
    const holeId = `B${c < 10 ? '0' : ''}${c}`;
    const eastingX = parseFloat(((c - 1) * 2.6 + 0.5).toFixed(2));
    const northingY = 3.0;
    const isWet = c === 11; // 1 wet hole
    const waterDepthM = isWet ? 1.6 : 0;

    // Air Decking: 7.0 kg toe + 1.0m air deck + 11.0 kg upper column = 18.0 kg total
    const toeChargeKg = 7.0;
    const columnChargeKg = 11.0;
    const totalChargeKg = 18.0;
    const airDeckM = isWet ? 0.0 : 1.0;
    const burdenM = 3.0;
    const spacingM = 2.6;

    holes.push({
      holeId,
      rowNumber: 2,
      eastingX,
      northingY,
      elevationZ: 840.1,
      diameterMm: 89,
      depthM: 11.2,
      burdenM,
      spacingM,
      subdrillM: 1.0,
      stemmingM: 2.4,
      inclinationDeg: 90,
      azimuthDeg: 0,
      waterDepthM,
      toeExplosiveType: isWet ? 'Bulk Emulsion' : 'Dynamite',
      toeChargeKg,
      columnExplosiveType: isWet ? 'Bulk Emulsion' : 'ANFO',
      columnChargeKg,
      airDeckM,
      totalChargeKg,
      powderFactorKgPerM3: parseFloat((totalChargeKg / (burdenM * spacingM * 10)).toFixed(3)),
      rockType: 'Quartzite',
      ucsMPa: 150 + ((c * 4) % 25),
      rqdPercent: 90,
      densityTPerM3: 2.65,
      detonatorDelayMs: 140 + (c - 1) * 20,
      detonatorType: 'Electronic i-kon III',
      status: 'planned',
      notes: airDeckM > 0 ? '1.0m Middle Air Deck (Energy optimization)' : `Wet hole (${waterDepthM}m)`,
    });
  }

  // Row 3: 8 Pre-Split / Highwall Control Holes (Close spacing 1.5m, light charges)
  for (let c = 1; c <= 8; c++) {
    const holeId = `PS${c < 10 ? '0' : ''}${c}`;
    const eastingX = parseFloat(((c - 1) * 4.1 + 0.2).toFixed(2));
    const northingY = 5.6;
    const burdenM = 2.0;
    const spacingM = 1.5;

    // Light decoupled charge: 8.0 kg total, 2.6m stemming
    const totalChargeKg = 8.0;
    const delayMs = (c - 1) * 12; // Instantaneous pre-split envelope ahead of production (0-84 ms)

    holes.push({
      holeId,
      rowNumber: 3,
      eastingX,
      northingY,
      elevationZ: 840.2,
      diameterMm: 89,
      depthM: 11.0,
      burdenM,
      spacingM,
      subdrillM: 0.5,
      stemmingM: 2.6,
      inclinationDeg: 90,
      azimuthDeg: 0,
      waterDepthM: 0,
      toeExplosiveType: 'Dynamite',
      toeChargeKg: 3.0,
      columnExplosiveType: 'ANFO',
      columnChargeKg: 5.0,
      airDeckM: 0,
      totalChargeKg,
      powderFactorKgPerM3: parseFloat((totalChargeKg / (burdenM * spacingM * 10)).toFixed(3)),
      rockType: 'Quartzite',
      ucsMPa: 165,
      rqdPercent: 94,
      densityTPerM3: 2.65,
      detonatorDelayMs: delayMs,
      detonatorType: 'Electronic i-kon III (Pre-split)',
      status: 'planned',
      notes: 'Pre-split smooth-wall perimeter (Zero delay ahead of face)',
    });
  }

  return {
    id: 'test-dataset-04-airdeck-presplit-30',
    nameEn: 'Test 04: Air Deck & Pre-Split (30 Holes, 2 Wet)',
    nameFr: 'Test 04 : Air Deck & Pré-découpage (30 Trous, 2 Humides)',
    descriptionEn: 'Wall control blast: 10 face holes (85°), 12 production holes with 1.0m air decks, 8 pre-split holes (1.5m spacing).',
    descriptionFr: 'Contrôle des parois : 10 trous de front (85°), 12 trous avec air decks 1.0m, 8 trous de pré-découpage (espacement 1.5m).',
    holeCount: 30,
    patternType: 'variable',
    wetHolesCount: 2,
    avgUcsMPa: 156,
    holes,
  };
}

/**
 * Returns all 4 predefined test datasets
 */
export function getAllPredefinedTestDatasets(): PredefinedTestDataset[] {
  return [
    getTestDataset1_RegularGranodiorite(),
    getTestDataset2_IrregularFaultedFace(),
    getTestDataset3_DeepWaterDepression(),
    getTestDataset4_AirDeckPresplit(),
  ];
}
