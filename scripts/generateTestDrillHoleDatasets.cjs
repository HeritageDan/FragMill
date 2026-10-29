// Script to generate 4 distinct, production-ready Drillhole Test Excel (.xlsx) files
// for FragMill with >= 30 holes each, varying regular/irregular spacings,
// water depths, rock hardness (UCS), air-decks, and timing delays.

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Ensure destination directories
const publicDir = path.resolve(__dirname, '../public/test_datasets');
const rootDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\1c7fc668-8aec-483b-90b6-20f6d3f29de4';

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const headersEn = [
  'Hole_ID',
  'Row_Number',
  'Easting_X_m',
  'Northing_Y_m',
  'Elevation_Z_m',
  'Diameter_mm',
  'Depth_m',
  'Burden_m',
  'Spacing_m',
  'Subdrill_m',
  'Stemming_m',
  'Inclination_deg',
  'Water_Depth_m',
  'Toe_Explosive',
  'Toe_Charge_kg',
  'Column_Explosive',
  'Column_Charge_kg',
  'Air_Deck_m',
  'Total_Charge_kg',
  'Powder_Factor_kg_m3',
  'Rock_Type',
  'Hardness_UCS_MPa',
  'RQD_Percent',
  'Density_t_m3',
  'Delay_ms',
  'Detonator_Type',
  'Status',
  'Notes',
];

const headersFr = [
  'ID_Trou',
  'Ligne_Rangée',
  'Est_X_m',
  'Nord_Y_m',
  'Cote_Z_m',
  'Diametre_mm',
  'Profondeur_m',
  'Banquette_m',
  'Espacement_m',
  'Surforage_m',
  'Bourrage_m',
  'Inclinaison_deg',
  'Eau_Profondeur_m',
  'Explosif_Pied',
  'Charge_Pied_kg',
  'Explosif_Colonne',
  'Charge_Colonne_kg',
  'Air_Deck_m',
  'Charge_Totale_kg',
  'Conso_Specifique_kg_m3',
  'Type_Roche',
  'Durete_UCS_MPa',
  'RQD_Pourcent',
  'Densite_t_m3',
  'Retard_ms',
  'Type_Detonateur',
  'Statut',
  'Remarques',
];

function createWorkbook(rowsEn, rowsFr, sheetNameEn, sheetNameFr) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: English
  const wsEnData = [headersEn, ...rowsEn];
  const wsEn = XLSX.utils.aoa_to_sheet(wsEnData);
  wsEn['!cols'] = headersEn.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsEn, sheetNameEn);

  // Sheet 2: French
  const wsFrData = [headersFr, ...rowsFr];
  const wsFr = XLSX.utils.aoa_to_sheet(wsFrData);
  wsFr['!cols'] = headersFr.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsFr, sheetNameFr);

  return wb;
}

// -------------------------------------------------------------
// DATASET 1: Regular Granodiorite (36 Holes, 4 Wet Holes)
// -------------------------------------------------------------
function buildDataset1() {
  const rowsEn = [];
  const rowsFr = [];
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

      // 4 wet holes
      const isWet = (r === 2 && (c === 4 || c === 5 || c === 8)) || (r === 3 && c === 6);
      const waterDepthM = isWet ? parseFloat((1.4 + ((c * 3) % 4) * 0.3).toFixed(1)) : 0.0;

      const toeExpEn = isWet ? 'Bulk Emulsion' : 'Dynamite';
      const toeExpFr = isWet ? 'Emulsion Vrac' : 'Dynamite';
      const toeCharge = isWet ? 12.0 : 8.0;

      const colExpEn = isWet ? 'Bulk Emulsion' : 'ANFO';
      const colExpFr = isWet ? 'Emulsion Vrac' : 'ANFO';
      const colCharge = isWet ? 11.0 : 14.0;
      const totalCharge = parseFloat((toeCharge + colCharge).toFixed(1));

      const ucsMPa = 120 + ((c * 7 + r * 5) % 33);
      const rqdPercent = 75 + ((c * 4) % 15);
      const delayMs = (r - 1) * 65 + (c - 1) * 25;
      const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));

      const notesEn = isFace ? 'Face hole (80° dip)' : isWet ? `Wet hole (Water: ${waterDepthM}m)` : 'Regular production';
      const notesFr = isFace ? 'Trou de front (80° incliné)' : isWet ? `Trou humide (Eau: ${waterDepthM}m)` : 'Production standard';

      rowsEn.push([
        holeId, r, eastingX, northingY, elevationZ, 89, depthM, burden, spacing, 1.0, 2.2, isFace ? 80 : 90,
        waterDepthM, toeExpEn, toeCharge, colExpEn, colCharge, 0.0, totalCharge, pf, 'Granodiorite',
        ucsMPa, rqdPercent, 2.68, delayMs, 'Electronic i-kon III', 'planned', notesEn,
      ]);

      rowsFr.push([
        holeId, r, eastingX, northingY, elevationZ, 89, depthM, burden, spacing, 1.0, 2.2, isFace ? 80 : 90,
        waterDepthM, toeExpFr, toeCharge, colExpFr, colCharge, 0.0, totalCharge, pf, 'Granodiorite',
        ucsMPa, rqdPercent, 2.68, delayMs, 'Electronique i-kon III', 'planifie', notesFr,
      ]);
    }
  }

  return { rowsEn, rowsFr };
}

// -------------------------------------------------------------
// DATASET 2: Irregular Faulted Face & Andesite (32 Holes, 7 Wet)
// -------------------------------------------------------------
function buildDataset2() {
  const rowsEn = [];
  const rowsFr = [];

  // Row 1: 11 holes (irregular crest contouring)
  const row1X = [0, 2.7, 5.5, 8.6, 11.4, 15.2, 19.0, 22.8, 26.5, 30.1, 33.6];
  const row1B = [2.6, 2.4, 2.8, 3.1, 2.9, 3.4, 3.2, 3.0, 2.8, 3.1, 3.3];
  const row1Y = [0.2, 0.4, 0.1, 0.8, 1.2, 1.0, 0.6, 0.3, 0.5, 0.9, 0.7];

  for (let i = 0; i < 11; i++) {
    const holeId = `A${i + 1 < 10 ? '0' : ''}${i + 1}`;
    const eastingX = row1X[i];
    const northingY = row1Y[i];
    const burden = row1B[i];
    const spacing = i === 0 ? 2.8 : parseFloat((row1X[i] - row1X[i - 1]).toFixed(1));

    const inFault = eastingX < 16;
    const ucsMPa = inFault ? Math.round(60 + i * 4) : Math.round(118 + ((i * 3) % 20));
    const rqd = inFault ? 45 + i * 3 : 80 + (i % 10);
    const isWet = inFault && (i === 1 || i === 2 || i === 3);
    const waterDepthM = isWet ? parseFloat((1.6 + i * 0.5).toFixed(1)) : 0.0;

    const toeCharge = isWet ? 10.5 : 7.0;
    const colCharge = isWet ? 9.5 : inFault ? 11.0 : 15.0;
    const totalCharge = parseFloat((toeCharge + colCharge).toFixed(1));
    const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));
    const delayMs = i * 25;

    const toeExpEn = isWet ? 'Bulk Emulsion' : 'Dynamite';
    const colExpEn = isWet ? 'Bulk Emulsion' : inFault ? 'Heavy ANFO 70/30' : 'ANFO';
    const toeExpFr = isWet ? 'Emulsion Vrac' : 'Dynamite';
    const colExpFr = isWet ? 'Emulsion Vrac' : inFault ? 'Heavy ANFO 70/30' : 'ANFO';

    const rockEn = inFault ? 'Sheared Andesite' : 'Massive Andesite';
    const rockFr = inFault ? 'Andésite Cisaillée' : 'Andésite Massive';
    const notesEn = inFault ? (isWet ? `Fault seep wet hole (${waterDepthM}m)` : 'Fault shear zone') : 'Competent andesite';
    const notesFr = inFault ? (isWet ? `Trou humide faille (${waterDepthM}m)` : 'Zone de faille broyée') : 'Andésite saine';

    rowsEn.push([
      holeId, 1, eastingX, northingY, parseFloat((840.5 - (inFault ? 0.8 : 0.0) + Math.cos(i) * 0.3).toFixed(2)),
      89, parseFloat((10.8 + (inFault ? 0.6 : 0.0) + (i % 3) * 0.2).toFixed(2)), burden, spacing, 1.0, 2.3, 82,
      waterDepthM, toeExpEn, toeCharge, colExpEn, colCharge, 0.0, totalCharge, pf, rockEn,
      ucsMPa, rqd, inFault ? 2.62 : 2.72, delayMs, 'Electronic i-kon III', 'planned', notesEn,
    ]);

    rowsFr.push([
      holeId, 1, eastingX, northingY, parseFloat((840.5 - (inFault ? 0.8 : 0.0) + Math.cos(i) * 0.3).toFixed(2)),
      89, parseFloat((10.8 + (inFault ? 0.6 : 0.0) + (i % 3) * 0.2).toFixed(2)), burden, spacing, 1.0, 2.3, 82,
      waterDepthM, toeExpFr, toeCharge, colExpFr, colCharge, 0.0, totalCharge, pf, rockFr,
      ucsMPa, rqd, inFault ? 2.62 : 2.72, delayMs, 'Electronique i-kon III', 'planifie', notesFr,
    ]);
  }

  // Row 2: 11 holes
  const row2X = [1.4, 4.2, 7.0, 10.1, 13.5, 17.1, 20.9, 24.7, 28.3, 31.9, 35.2];
  const row2Y = [3.4, 3.8, 3.6, 4.2, 4.5, 4.1, 3.8, 3.5, 3.7, 4.0, 3.9];
  for (let i = 0; i < 11; i++) {
    const holeId = `B${i + 1 < 10 ? '0' : ''}${i + 1}`;
    const eastingX = row2X[i];
    const northingY = row2Y[i];
    const inFault = eastingX < 17;
    const isWet = inFault && (i === 1 || i === 2 || i === 3);
    const waterDepthM = isWet ? parseFloat((2.0 + i * 0.5).toFixed(1)) : 0.0;

    const burden = parseFloat((row2Y[i] - row1Y[i]).toFixed(2));
    const spacing = i === 0 ? 3.2 : parseFloat((row2X[i] - row2X[i - 1]).toFixed(1));
    const ucsMPa = inFault ? Math.round(55 + i * 5) : Math.round(122 + ((i * 4) % 18));
    const rqd = inFault ? 40 + i * 3 : 82 + (i % 8);

    const toeCharge = isWet ? 12.0 : 8.0;
    const colCharge = isWet ? 11.0 : inFault ? 12.0 : 16.0;
    const totalCharge = parseFloat((toeCharge + colCharge).toFixed(1));
    const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));
    const delayMs = 65 + i * 25;

    const toeExpEn = isWet ? 'Bulk Emulsion' : 'Dynamite';
    const colExpEn = isWet ? 'Bulk Emulsion' : 'ANFO';
    const toeExpFr = isWet ? 'Emulsion Vrac' : 'Dynamite';
    const colExpFr = isWet ? 'Emulsion Vrac' : 'ANFO';

    const rockEn = inFault ? 'Sheared Andesite' : 'Massive Andesite';
    const rockFr = inFault ? 'Andésite Cisaillée' : 'Andésite Massive';
    const notesEn = inFault ? (isWet ? `Fault wet hole (${waterDepthM}m)` : 'Fault production') : 'Standard production';
    const notesFr = inFault ? (isWet ? `Trou humide faille (${waterDepthM}m)` : 'Production faille') : 'Production standard';

    rowsEn.push([
      holeId, 2, eastingX, northingY, parseFloat((840.4 - (inFault ? 0.6 : 0.0) + Math.sin(i) * 0.25).toFixed(2)),
      89, 11.4, burden, spacing, 1.0, 2.4, 90,
      waterDepthM, toeExpEn, toeCharge, colExpEn, colCharge, 0.0, totalCharge, pf, rockEn,
      ucsMPa, rqd, inFault ? 2.63 : 2.72, delayMs, 'Electronic i-kon III', 'planned', notesEn,
    ]);

    rowsFr.push([
      holeId, 2, eastingX, northingY, parseFloat((840.4 - (inFault ? 0.6 : 0.0) + Math.sin(i) * 0.25).toFixed(2)),
      89, 11.4, burden, spacing, 1.0, 2.4, 90,
      waterDepthM, toeExpFr, toeCharge, colExpFr, colCharge, 0.0, totalCharge, pf, rockFr,
      ucsMPa, rqd, inFault ? 2.63 : 2.72, delayMs, 'Electronique i-kon III', 'planifie', notesFr,
    ]);
  }

  // Row 3: 10 holes
  const row3X = [2.0, 5.2, 8.8, 12.2, 15.8, 19.5, 23.4, 27.2, 30.8, 34.4];
  const row3Y = [6.8, 7.2, 7.0, 7.6, 7.8, 7.4, 7.1, 6.9, 7.2, 7.4];
  for (let i = 0; i < 10; i++) {
    const holeId = `C${i + 1 < 10 ? '0' : ''}${i + 1}`;
    const eastingX = row3X[i];
    const northingY = row3Y[i];
    const inFault = eastingX < 16;
    const isWet = inFault && i === 2; // C03
    const waterDepthM = isWet ? 1.9 : 0.0;

    const burden = parseFloat((row3Y[i] - row2Y[i]).toFixed(2));
    const spacing = i === 0 ? 3.4 : parseFloat((row3X[i] - row3X[i - 1]).toFixed(1));
    const ucsMPa = inFault ? Math.round(65 + i * 4) : Math.round(128 + ((i * 3) % 15));
    const rqd = inFault ? 50 + i * 2 : 85 + (i % 6);

    const toeCharge = isWet ? 11.0 : 7.5;
    const colCharge = isWet ? 10.0 : 14.5;
    const totalCharge = parseFloat((toeCharge + colCharge).toFixed(1));
    const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));
    const delayMs = 130 + i * 25;

    const toeExpEn = isWet ? 'Bulk Emulsion' : 'Dynamite';
    const colExpEn = isWet ? 'Bulk Emulsion' : 'ANFO';
    const toeExpFr = isWet ? 'Emulsion Vrac' : 'Dynamite';
    const colExpFr = isWet ? 'Emulsion Vrac' : 'ANFO';

    const rockEn = inFault ? 'Sheared Andesite' : 'Massive Andesite';
    const rockFr = inFault ? 'Andésite Cisaillée' : 'Andésite Massive';
    const notesEn = isWet ? 'Trim hole with water' : 'Back row trim';
    const notesFr = isWet ? 'Trou de talus avec eau' : 'Trou de talus arrière';

    rowsEn.push([
      holeId, 3, eastingX, northingY, 840.2, 89, 11.0, burden, spacing, 1.0, 2.5, 90,
      waterDepthM, toeExpEn, toeCharge, colExpEn, colCharge, 0.0, totalCharge, pf, rockEn,
      ucsMPa, rqd, inFault ? 2.64 : 2.73, delayMs, 'Electronic i-kon III', 'planned', notesEn,
    ]);

    rowsFr.push([
      holeId, 3, eastingX, northingY, 840.2, 89, 11.0, burden, spacing, 1.0, 2.5, 90,
      waterDepthM, toeExpFr, toeCharge, colExpFr, colCharge, 0.0, totalCharge, pf, rockFr,
      ucsMPa, rqd, inFault ? 2.64 : 2.73, delayMs, 'Electronique i-kon III', 'planifie', notesFr,
    ]);
  }

  return { rowsEn, rowsFr };
}

// -------------------------------------------------------------
// DATASET 3: Deep Water Depression & Basalt (35 Holes, 12 Wet)
// -------------------------------------------------------------
function buildDataset3() {
  const rowsEn = [];
  const rowsFr = [];
  const rows = 3;
  const burden = 2.8;
  const spacing = 3.2;

  for (let r = 1; r <= rows; r++) {
    const numInRow = r === 3 ? 11 : 12;
    const rowPrefix = r === 1 ? 'A' : r === 2 ? 'B' : 'C';

    for (let c = 1; c <= numInRow; c++) {
      const holeId = `${rowPrefix}${c < 10 ? '0' : ''}${c}`;
      const eastingX = parseFloat(((c - 1) * spacing + (r % 2 === 0 ? spacing * 0.5 : 0)).toFixed(2));
      const northingY = parseFloat(((r - 1) * burden).toFixed(2));

      // Central depression
      const distFromCenter = Math.hypot((c - 6.5) * 1.5, (r - 2) * 1.8);
      const elevationDrop = Math.max(0, 5.2 - distFromCenter * 1.1);
      const elevationZ = parseFloat((842.8 - elevationDrop).toFixed(2));
      const depthM = parseFloat((10.2 + elevationDrop * 0.5).toFixed(2));

      // 12 wet holes in depression
      const isWet = (r === 1 && (c >= 5 && c <= 8)) ||
                    (r === 2 && (c >= 4 && c <= 8)) ||
                    (r === 3 && (c >= 5 && c <= 7));

      let waterDepthM = 0.0;
      if (isWet) {
        if (c === 6 || c === 7) waterDepthM = parseFloat((3.2 + (r % 2) * 0.9).toFixed(1));
        else waterDepthM = parseFloat((1.8 + (c % 3) * 0.6).toFixed(1));
      }

      const toeExpEn = 'Bulk Emulsion';
      const toeExpFr = 'Emulsion Vrac';
      const toeCharge = isWet ? 14.0 : 8.5;

      const colExpEn = isWet ? 'Bulk Emulsion' : 'ANFO';
      const colExpFr = isWet ? 'Emulsion Vrac' : 'ANFO';
      const colCharge = isWet ? 14.0 : 16.0;
      const totalCharge = parseFloat((toeCharge + colCharge).toFixed(1));

      const ucsMPa = Math.round(110 + Math.cos(c * 0.8) * 20 + (r * 5));
      const rqdPercent = Math.round(78 + Math.sin(c) * 12);
      const delayMs = (r - 1) * 60 + (c - 1) * 20;
      const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));

      const notesEn = isWet ? `Deep water ingress (${waterDepthM}m) - 100% Emulsion` : 'Dry basalt bench';
      const notesFr = isWet ? `Forte venue d'eau (${waterDepthM}m) - 100% Emulsion` : 'Banc de basalte sec';

      rowsEn.push([
        holeId, r, eastingX, northingY, elevationZ, 89, depthM, burden, spacing, 1.2, 2.2, r === 1 ? 84 : 90,
        waterDepthM, toeExpEn, toeCharge, colExpEn, colCharge, 0.0, totalCharge, pf, 'Olivine Basalt',
        ucsMPa, rqdPercent, 2.85, delayMs, 'Electronic i-kon III', 'planned', notesEn,
      ]);

      rowsFr.push([
        holeId, r, eastingX, northingY, elevationZ, 89, depthM, burden, spacing, 1.2, 2.2, r === 1 ? 84 : 90,
        waterDepthM, toeExpFr, toeCharge, colExpFr, colCharge, 0.0, totalCharge, pf, 'Basalte à Olivine',
        ucsMPa, rqdPercent, 2.85, delayMs, 'Electronique i-kon III', 'planifie', notesFr,
      ]);
    }
  }

  return { rowsEn, rowsFr };
}

// -------------------------------------------------------------
// DATASET 4: Air Deck & Pre-Split Wall Control (30 Holes, 2 Wet)
// -------------------------------------------------------------
function buildDataset4() {
  const rowsEn = [];
  const rowsFr = [];

  // Row 1: 10 face holes
  for (let c = 1; c <= 10; c++) {
    const holeId = `A${c < 10 ? '0' : ''}${c}`;
    const eastingX = parseFloat(((c - 1) * 3.2).toFixed(2));
    const northingY = 0.0;
    const isWet = c === 9;
    const waterDepthM = isWet ? 1.4 : 0.0;

    const toeCharge = 8.0;
    const colCharge = 13.0;
    const totalCharge = 21.0;
    const burden = 2.8;
    const spacing = 3.2;
    const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));
    const delayMs = 100 + (c - 1) * 20;

    const notesEn = isWet ? 'Face hole with water (1.4m)' : 'Face production (85°)';
    const notesFr = isWet ? 'Trou de front avec eau (1.4m)' : 'Production front (85°)';

    rowsEn.push([
      holeId, 1, eastingX, northingY, 840.0, 89, 10.8, burden, spacing, 0.8, 2.2, 85,
      waterDepthM, isWet ? 'Bulk Emulsion' : 'Dynamite', toeCharge, isWet ? 'Bulk Emulsion' : 'ANFO',
      colCharge, 0.0, totalCharge, pf, 'Quartzite', 145 + ((c * 3) % 20), 88, 2.65, delayMs,
      'Electronic i-kon III', 'planned', notesEn,
    ]);

    rowsFr.push([
      holeId, 1, eastingX, northingY, 840.0, 89, 10.8, burden, spacing, 0.8, 2.2, 85,
      waterDepthM, isWet ? 'Emulsion Vrac' : 'Dynamite', toeCharge, isWet ? 'Emulsion Vrac' : 'ANFO',
      colCharge, 0.0, totalCharge, pf, 'Quartzite', 145 + ((c * 3) % 20), 88, 2.65, delayMs,
      'Electronique i-kon III', 'planifie', notesFr,
    ]);
  }

  // Row 2: 12 production holes with 1.0m Middle Air Deck
  for (let c = 1; c <= 12; c++) {
    const holeId = `B${c < 10 ? '0' : ''}${c}`;
    const eastingX = parseFloat(((c - 1) * 2.6 + 0.5).toFixed(2));
    const northingY = 3.0;
    const isWet = c === 11;
    const waterDepthM = isWet ? 1.6 : 0.0;

    const airDeckM = isWet ? 0.0 : 1.0;
    const toeCharge = 7.0;
    const colCharge = 11.0;
    const totalCharge = 18.0;
    const burden = 3.0;
    const spacing = 2.6;
    const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));
    const delayMs = 140 + (c - 1) * 20;

    const notesEn = airDeckM > 0 ? '1.0m Middle Air Deck (Energy optimization)' : `Wet hole (${waterDepthM}m)`;
    const notesFr = airDeckM > 0 ? 'Chambre d\'air médiane 1.0m (Optimisation énergie)' : `Trou humide (${waterDepthM}m)`;

    rowsEn.push([
      holeId, 2, eastingX, northingY, 840.1, 89, 11.2, burden, spacing, 1.0, 2.4, 90,
      waterDepthM, isWet ? 'Bulk Emulsion' : 'Dynamite', toeCharge, isWet ? 'Bulk Emulsion' : 'ANFO',
      colCharge, airDeckM, totalCharge, pf, 'Quartzite', 150 + ((c * 4) % 25), 90, 2.65, delayMs,
      'Electronic i-kon III', 'planned', notesEn,
    ]);

    rowsFr.push([
      holeId, 2, eastingX, northingY, 840.1, 89, 11.2, burden, spacing, 1.0, 2.4, 90,
      waterDepthM, isWet ? 'Emulsion Vrac' : 'Dynamite', toeCharge, isWet ? 'Emulsion Vrac' : 'ANFO',
      colCharge, airDeckM, totalCharge, pf, 'Quartzite', 150 + ((c * 4) % 25), 90, 2.65, delayMs,
      'Electronique i-kon III', 'planifie', notesFr,
    ]);
  }

  // Row 3: 8 pre-split perimeter holes (1.5m spacing, 8kg light charge)
  for (let c = 1; c <= 8; c++) {
    const holeId = `PS${c < 10 ? '0' : ''}${c}`;
    const eastingX = parseFloat(((c - 1) * 4.1 + 0.2).toFixed(2));
    const northingY = 5.6;
    const burden = 2.0;
    const spacing = 1.5;
    const totalCharge = 8.0;
    const pf = parseFloat((totalCharge / (burden * spacing * 10)).toFixed(3));
    const delayMs = (c - 1) * 12;

    const notesEn = 'Pre-split smooth wall (Initiates ahead of face)';
    const notesFr = 'Pré-découpage paroi lisse (Tir anticipé avant front)';

    rowsEn.push([
      holeId, 3, eastingX, northingY, 840.2, 89, 11.0, burden, spacing, 0.5, 2.6, 90,
      0.0, 'Dynamite', 3.0, 'ANFO', 5.0, 0.0, totalCharge, pf, 'Quartzite', 165, 94, 2.65, delayMs,
      'Electronic i-kon III (Pre-split)', 'planned', notesEn,
    ]);

    rowsFr.push([
      holeId, 3, eastingX, northingY, 840.2, 89, 11.0, burden, spacing, 0.5, 2.6, 90,
      0.0, 'Dynamite', 3.0, 'ANFO', 5.0, 0.0, totalCharge, pf, 'Quartzite', 165, 94, 2.65, delayMs,
      'Electronique i-kon III (Pré-découpage)', 'planifie', notesFr,
    ]);
  }

  return { rowsEn, rowsFr };
}

// -------------------------------------------------------------
// MAIN GENERATOR EXECUTION
// -------------------------------------------------------------
console.log('Generating 4 distinct Test Excel datasets for FragMill...\n');

const datasets = [
  {
    filename: 'FragMill_Test_01_Regular_Granodiorite_36Holes.xlsx',
    builder: buildDataset1,
    sheetEn: 'Regular_36Holes',
    sheetFr: 'Regulier_36Trous',
  },
  {
    filename: 'FragMill_Test_02_Irregular_Faulted_Face_32Holes.xlsx',
    builder: buildDataset2,
    sheetEn: 'Fault_Shear_32Holes',
    sheetFr: 'Zone_Faille_32Trous',
  },
  {
    filename: 'FragMill_Test_03_Deep_Water_Depression_35Holes.xlsx',
    builder: buildDataset3,
    sheetEn: 'Flooded_Depression_35H',
    sheetFr: 'Depression_Noyee_35T',
  },
  {
    filename: 'FragMill_Test_04_AirDeck_Presplit_Optimized_30Holes.xlsx',
    builder: buildDataset4,
    sheetEn: 'AirDeck_Presplit_30H',
    sheetFr: 'AirDeck_Predecoupage_30T',
  },
];

for (const ds of datasets) {
  const { rowsEn, rowsFr } = ds.builder();
  const wb = createWorkbook(rowsEn, rowsFr, ds.sheetEn, ds.sheetFr);

  // Write to public/test_datasets/
  const pPath = path.join(publicDir, ds.filename);
  XLSX.writeFile(wb, pPath);

  // Write to project root
  const rPath = path.join(rootDir, ds.filename);
  XLSX.writeFile(wb, rPath);

  // Write to artifact dir if exists
  if (fs.existsSync(artifactDir)) {
    const aPath = path.join(artifactDir, ds.filename);
    XLSX.writeFile(wb, aPath);
  }

  console.log(`✓ Created: ${ds.filename} (${rowsEn.length} drillholes)`);
  console.log(`  -> ${pPath}`);
  console.log(`  -> ${rPath}`);
}

console.log('\nAll 4 test datasets successfully generated!');
