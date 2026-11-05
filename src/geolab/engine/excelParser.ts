import * as xlsx from 'xlsx';
import type { GeoLabTestType, QualityWarning } from '../../types/geolab';
import type { GeoLabTestDefinition } from '../tests/types';
import { getTestDefinition } from '../tests/index';

export interface CellValidationError {
  sheet: string;
  cell: string;
  message: { en: string; fr: string };
}

export interface ParseResult<TInput = any, TResults = any> {
  success: boolean;
  errors: CellValidationError[];
  warnings: QualityWarning[];
  rawInput?: TInput;
  computedResults?: TResults;
  detectedStandard?: string;
  sourceSheet?: string;
}

/**
 * Validates and parses an uploaded geotechnical .xlsx file with cell-level error tracking.
 */
export async function parseAndValidateUploadedExcel(
  fileBuffer: ArrayBuffer,
  testType: GeoLabTestType
): Promise<ParseResult> {
  let wb: xlsx.WorkBook;
  try {
    wb = xlsx.read(new Uint8Array(fileBuffer), { type: 'array' });
  } catch (err: any) {
    return {
      success: false,
      errors: [
        {
          sheet: 'Workbook',
          cell: 'A1',
          message: {
            en: `Failed to read Excel workbook: ${err.message || 'Corrupted file'}`,
            fr: `Impossible de lire le classeur Excel : ${err.message || 'Fichier corrompu'}`,
          },
        },
      ],
      warnings: [],
    };
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return {
      success: false,
      errors: [
        {
          sheet: 'Workbook',
          cell: 'A1',
          message: {
            en: 'Workbook contains no sheets.',
            fr: 'Le classeur ne contient aucune feuille.',
          },
        },
      ],
      warnings: [],
    };
  }

  // Check if standard GeoLab template sheet 'Data Entry' exists
  let targetSheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('data') || n.toLowerCase().includes('entry'));
  if (!targetSheetName) {
    // If not found, use first non-empty sheet
    targetSheetName = wb.SheetNames[0];
  }

  const ws = wb.Sheets[targetSheetName];
  if (!ws) {
    return {
      success: false,
      errors: [
        {
          sheet: targetSheetName,
          cell: 'A1',
          message: {
            en: `Sheet "${targetSheetName}" is empty or missing.`,
            fr: `La feuille "${targetSheetName}" est vide ou manquante.`,
          },
        },
      ],
      warnings: [],
    };
  }

  const errors: CellValidationError[] = [];
  const testDef = getTestDefinition(testType);

  let rawInput: any = null;

  if (testType === 'proctor') {
    rawInput = parseProctorSheet(ws, targetSheetName, errors);
  } else if (testType === 'grain_size') {
    rawInput = parseGrainSizeSheet(ws, targetSheetName, errors);
  } else if (testType === 'water_content') {
    rawInput = parseWaterContentSheet(ws, targetSheetName, errors);
  } else {
    rawInput = parseGenericSheet(ws, targetSheetName, testDef, errors);
  }

  if (errors.length > 0 || !rawInput) {
    return {
      success: false,
      errors,
      warnings: [],
      sourceSheet: targetSheetName,
    };
  }

  // Compute deterministic results
  const computedResults = testDef.calculate(rawInput);
  const warnings = testDef.checks(rawInput, computedResults);

  return {
    success: true,
    errors: [],
    warnings,
    rawInput,
    computedResults,
    detectedStandard: testDef.defaultStandard,
    sourceSheet: targetSheetName,
  };
}

// -------------------------------------------------------------
// Parsers per test type
// -------------------------------------------------------------
function parseProctorSheet(ws: xlsx.WorkSheet, sheetName: string, errors: CellValidationError[]) {
  // Check if it's the Classeur1 summary format (rows 6-10 with cols N, O)
  const isClasseur1Format = ws['N6'] !== undefined && ws['O6'] !== undefined;

  if (isClasseur1Format) {
    const particleDensityGs = ws['B46']?.v ?? 2.82;
    const manualOpmMoisture = ws['B49']?.v !== undefined ? ws['B49'].v * 100 : undefined;
    const manualOpmDensity = ws['B50']?.v ?? undefined;

    const points: any[] = [];
    for (let r = 6; r <= 10; r++) {
      const cellW = ws[`N${r}`];
      const cellRho = ws[`O${r}`];
      if (cellW && cellRho && typeof cellW.v === 'number' && typeof cellRho.v === 'number') {
        points.push({
          pointIndex: r - 5,
          waterContentPercent: cellW.v > 1 ? cellW.v : cellW.v * 100,
          dryDensityGcm3: cellRho.v,
        });
      }
    }

    if (points.length < 3) {
      errors.push({
        sheet: sheetName,
        cell: 'N6:O10',
        message: {
          en: `Found fewer than 3 valid compaction points (${points.length} found).`,
          fr: `Moins de 3 points de compactage valides trouvés (${points.length} trouvés).`,
        },
      });
      return null;
    }

    return {
      mouldType: 'cbr',
      mouldVolumeCm3: 2124,
      particleDensityGs: Number(particleDensityGs),
      targetCompactionPercent: 95,
      manualOpmMoisturePercent: manualOpmMoisture,
      manualOpmDryDensityGcm3: manualOpmDensity,
      points,
    };
  }

  // Default GeoLab template parser
  // Look for parameters in A5..B10
  let particleDensityGs = 2.70;
  let mouldVol = 2124;
  let mouldType: any = 'cbr';

  const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  let tableHeaderRowIdx = -1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('poids spécifique') || firstCell.includes('particle density') || firstCell.includes('ρs')) {
      const val = parseFloat(row[1]);
      if (!isNaN(val) && val > 0) particleDensityGs = val;
    }
    if (firstCell.includes('volume') || firstCell.includes('mould volume')) {
      const val = parseFloat(row[1]);
      if (!isNaN(val) && val > 0) mouldVol = val;
    }
    // Table header row must contain multiple columns
    if (row.filter((c: any) => c !== '' && c !== null && c !== undefined).length >= 3) {
      if (
        firstCell.includes('point') ||
        firstCell.includes('n°') ||
        String(row[1] || '').toLowerCase().includes('teneur') ||
        String(row[1] || '').toLowerCase().includes('moisture') ||
        String(row[1] || '').toLowerCase().includes('w')
      ) {
        tableHeaderRowIdx = i;
        break;
      }
    }
  }

  if (tableHeaderRowIdx === -1) {
    errors.push({
      sheet: sheetName,
      cell: 'A8',
      message: {
        en: 'Could not locate compaction points table header (Point #, Moisture w, Dry Density).',
        fr: 'En-tête du tableau des points de compactage introuvable (N° Point, Teneur en eau, Densité sèche).',
      },
    });
    return null;
  }

  const points: any[] = [];
  for (let r = tableHeaderRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0 || row[0] === '') continue;

    const ptIdx = parseInt(row[0]);
    const wVal = parseFloat(row[1]);
    const rhoDryVal = parseFloat(row[2]);

    if (isNaN(wVal) || isNaN(rhoDryVal)) {
      errors.push({
        sheet: sheetName,
        cell: `B${r + 1}:C${r + 1}`,
        message: {
          en: `Row ${r + 1}: Invalid numeric values for water content or dry density.`,
          fr: `Ligne ${r + 1} : Valeurs numériques invalides pour la teneur en eau ou la densité sèche.`,
        },
      });
      continue;
    }

    points.push({
      pointIndex: isNaN(ptIdx) ? points.length + 1 : ptIdx,
      waterContentPercent: wVal > 1 ? wVal : wVal * 100,
      dryDensityGcm3: rhoDryVal,
      wetDensityGcm3: row[3] ? parseFloat(row[3]) : undefined,
    });
  }

  if (points.length < 3) {
    errors.push({
      sheet: sheetName,
      cell: `A${tableHeaderRowIdx + 2}`,
      message: {
        en: `At least 3 compaction points are required (found ${points.length}).`,
        fr: `Au moins 3 points de compactage sont requis (${points.length} trouvés).`,
      },
    });
    return null;
  }

  return {
    mouldType,
    mouldVolumeCm3: mouldVol,
    particleDensityGs,
    targetCompactionPercent: 95,
    points,
  };
}

function parseGrainSizeSheet(ws: xlsx.WorkSheet, sheetName: string, errors: CellValidationError[]) {
  // Check if it's the Classeur1 format (Col I = sieve, Col J = passing)
  if (ws['I9'] !== undefined && ws['J9'] !== undefined) {
    const sieves: any[] = [];
    for (let r = 9; r <= 34; r++) {
      const cellSieve = ws[`I${r}`];
      const cellPass = ws[`J${r}`];
      if (cellSieve && cellSieve.v !== undefined && cellSieve.v !== '' && cellPass && cellPass.v !== undefined && cellPass.v !== '') {
        const d = parseFloat(cellSieve.v);
        const p = parseFloat(cellPass.v);
        if (!isNaN(d) && !isNaN(p)) {
          sieves.push({
            sieveMm: d,
            passingPercent: p > 1 ? p : p * 100,
          });
        }
      }
    }

    if (sieves.length >= 4) {
      return { sieves };
    }
  }

  // Template format
  const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  let headerIdx = -1;
  let initMass = 2000;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('masse sèche') || firstCell.includes('dry sample mass')) {
      const val = parseFloat(String(row[1]).replace(',', '.'));
      if (!isNaN(val) && val > 0) initMass = val;
    }
  }

  // Find sieve table header row. Must have at least 2 non-empty cells to avoid matching single-cell section headers.
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    const nonEmpties = row.filter((c: any) => c !== '' && c !== null && c !== undefined);
    if (nonEmpties.length < 2) continue;

    const firstCell = String(row[0] || '').toLowerCase().trim();
    const secondCell = String(row[1] || '').toLowerCase().trim();

    if (
      firstCell.includes('maille') ||
      firstCell.includes('aperture') ||
      firstCell.includes('tamis') ||
      (firstCell.includes('sieve') && !firstCell.includes('stack') && !firstCell.includes('colonne')) ||
      (secondCell.includes('pass') || secondCell.includes('refus') || secondCell.includes('retained'))
    ) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    errors.push({
      sheet: sheetName,
      cell: 'A8',
      message: {
        en: 'Could not find sieve table headers (Sieve mm, Passing %, Retained g).',
        fr: 'En-tête du tableau de tamisage introuvable (Maille mm, Passant %, Refus g).',
      },
    });
    return null;
  }

  const sieves: any[] = [];
  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0 || row[0] === '' || row[0] === null || row[0] === undefined) continue;

    const firstStr = String(row[0]).trim();
    const lowerFirst = firstStr.toLowerCase();
    if (
      lowerFirst.includes('maille') ||
      lowerFirst.includes('aperture') ||
      lowerFirst.includes('sieve') ||
      lowerFirst.includes('tamis') ||
      lowerFirst.includes('passant') ||
      lowerFirst.includes('passing')
    ) {
      continue;
    }

    const sieveMm = parseFloat(firstStr.replace(',', '.'));
    if (isNaN(sieveMm) || sieveMm <= 0) {
      errors.push({
        sheet: sheetName,
        cell: `A${r + 1}`,
        message: {
          en: `Row ${r + 1}: Invalid sieve aperture: "${row[0]}". Must be a positive number.`,
          fr: `Ligne ${r + 1} : Ouverture de tamis invalide : "${row[0]}". Doit être un nombre positif.`,
        },
      });
      continue;
    }

    const passPct = row[1] !== '' && row[1] !== null && row[1] !== undefined ? parseFloat(String(row[1]).replace(',', '.')) : undefined;
    const retMass = row[2] !== '' && row[2] !== null && row[2] !== undefined ? parseFloat(String(row[2]).replace(',', '.')) : undefined;

    sieves.push({
      sieveMm,
      passingPercent: passPct !== undefined && !isNaN(passPct) ? passPct : undefined,
      retainedMassG: retMass !== undefined && !isNaN(retMass) ? retMass : undefined,
      minSpecPercent: row[3] !== '' && row[3] !== null && !isNaN(parseFloat(String(row[3]).replace(',', '.'))) ? parseFloat(String(row[3]).replace(',', '.')) : undefined,
      maxSpecPercent: row[4] !== '' && row[4] !== null && !isNaN(parseFloat(String(row[4]).replace(',', '.'))) ? parseFloat(String(row[4]).replace(',', '.')) : undefined,
    });
  }

  if (sieves.length < 4) {
    errors.push({
      sheet: sheetName,
      cell: `A${headerIdx + 2}`,
      message: {
        en: `At least 4 sieves required (found ${sieves.length}).`,
        fr: `Au moins 4 tamis sont requis (${sieves.length} trouvés).`,
      },
    });
    return null;
  }

  return {
    initialDryMassG: initMass,
    sieves,
  };
}

function parseWaterContentSheet(ws: xlsx.WorkSheet, sheetName: string, errors: CellValidationError[]) {
  // Check if direct value in B45 (as in Classeur1)
  if (ws['B45'] && typeof ws['B45'].v === 'number') {
    return {
      directNaturalWaterContentPercent: ws['B45'].v,
      specimens: [],
    };
  }

  // Template format
  const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  let headerIdx = -1;
  let maxTol = 0.5;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('tolérance') || firstCell.includes('tolerance')) {
      const val = parseFloat(row[1]);
      if (!isNaN(val) && val > 0) maxTol = val;
    }
    // Table header row must contain multiple columns
    if (row.filter((c: any) => c !== '' && c !== null && c !== undefined).length >= 3) {
      if (
        firstCell.includes('éprouvette') ||
        firstCell.includes('specimen') ||
        String(row[1] || '').toLowerCase().includes('tare') ||
        String(row[2] || '').toLowerCase().includes('tare') ||
        String(row[2] || '').toLowerCase().includes('m0')
      ) {
        headerIdx = i;
        break;
      }
    }
  }

  if (headerIdx === -1) {
    errors.push({
      sheet: sheetName,
      cell: 'A8',
      message: {
        en: 'Could not find specimens table headers (Specimen, Tare m0, Wet m1, Dry m2).',
        fr: 'En-tête du tableau des éprouvettes introuvable (Éprouvette, Tare m0, Humide m1, Sec m2).',
      },
    });
    return null;
  }

  const specimens: any[] = [];
  for (let r = headerIdx + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0 || row[0] === '') continue;

    const specId = String(row[0]);
    const tare = parseFloat(row[2]);
    const wet = parseFloat(row[3]);
    const dry = parseFloat(row[4]);

    if (isNaN(tare) || isNaN(wet) || isNaN(dry)) {
      errors.push({
        sheet: sheetName,
        cell: `C${r + 1}:E${r + 1}`,
        message: {
          en: `Row ${r + 1}: Masses must be valid numbers (tare, wet, dry).`,
          fr: `Ligne ${r + 1} : Les masses doivent être des nombres valides (tare, humide, sec).`,
        },
      });
      continue;
    }

    specimens.push({
      specimenId: specId,
      containerId: row[1] ? String(row[1]) : `T-${specimens.length + 1}`,
      tareMassG: tare,
      wetSoilPlusTareG: wet,
      drySoilPlusTareG: dry,
    });
  }

  if (specimens.length === 0) {
    errors.push({
      sheet: sheetName,
      cell: `A${headerIdx + 2}`,
      message: {
        en: 'No valid specimens found in upload.',
        fr: 'Aucune éprouvette valide trouvée dans le fichier.',
      },
    });
    return null;
  }

  return {
    maxTolerancePercent: maxTol,
    specimens,
  };
}

function parseGenericSheet(
  ws: xlsx.WorkSheet,
  sheetName: string,
  testDef: GeoLabTestDefinition,
  errors: CellValidationError[]
): any {
  const data = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const rawInput: Record<string, any> = {};

  // 1. Parse parameters
  for (const param of testDef.inputSchema.parameters) {
    let found = false;
    const labelEn = (param.label.en || '').toLowerCase().trim();
    const labelFr = (param.label.fr || '').toLowerCase().trim();
    const key = param.key.toLowerCase().trim();

    for (let r = 0; r < Math.min(data.length, 30); r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;
      const cellText = String(row[0] || '').toLowerCase().trim();
      if (!cellText) continue;

      if (
        cellText === labelEn ||
        cellText === labelFr ||
        cellText === key ||
        (labelEn.length > 4 && cellText.includes(labelEn)) ||
        (labelFr.length > 4 && cellText.includes(labelFr))
      ) {
        const val = row[1];
        if (param.type === 'number') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
          if (!isNaN(num)) {
            rawInput[param.key] = num;
            found = true;
          }
        } else {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            rawInput[param.key] = String(val).trim();
            found = true;
          }
        }
        if (found) break;
      }
    }

    if (!found) {
      if (param.defaultValue !== undefined) {
        rawInput[param.key] = param.defaultValue;
      } else if (param.required) {
        errors.push({
          sheet: sheetName,
          cell: 'A5',
          message: {
            en: `Missing required parameter: ${param.label.en}`,
            fr: `Paramètre obligatoire manquant : ${param.label.fr}`,
          },
        });
      }
    }
  }

  // 2. Parse table if defined
  if (testDef.inputSchema.table) {
    const tableDef = testDef.inputSchema.table;
    const tableKey = tableDef.key;
    const columns = tableDef.columns;
    let tableHeaderIdx = -1;

    // Search for table header row
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length < columns.length) continue;
      let matchCount = 0;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const colText = String(row[c] || '').toLowerCase().trim();
        const en = (col.label.en || '').toLowerCase().trim();
        const fr = (col.label.fr || '').toLowerCase().trim();
        const k = col.key.toLowerCase().trim();
        if (colText.includes(en) || colText.includes(fr) || colText.includes(k)) {
          matchCount++;
        }
      }
      if (matchCount >= Math.min(2, columns.length)) {
        tableHeaderIdx = r;
        break;
      }
    }

    // Fallback: search for table label row
    if (tableHeaderIdx === -1) {
      const labelEn = (tableDef.label.en || '').toLowerCase().trim();
      const labelFr = (tableDef.label.fr || '').toLowerCase().trim();
      for (let r = 0; r < data.length; r++) {
        const firstCell = String(data[r]?.[0] || '').toLowerCase().trim();
        if (firstCell && (firstCell.includes(labelEn) || firstCell.includes(labelFr))) {
          if (r + 1 < data.length) {
            tableHeaderIdx = r + 1;
            break;
          }
        }
      }
    }

    if (tableHeaderIdx === -1) {
      errors.push({
        sheet: sheetName,
        cell: 'A10',
        message: {
          en: `Could not locate data table header: ${tableDef.label.en}`,
          fr: `En-tête du tableau de données introuvable : ${tableDef.label.fr}`,
        },
      });
      return null;
    }

    const rows: any[] = [];
    for (let r = tableHeaderIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;
      const nonEmpty = row.some((c: any) => c !== '' && c !== null && c !== undefined);
      if (!nonEmpty) continue;

      const firstCell = String(row[0] || '').trim();
      if (
        firstCell.startsWith('---') ||
        firstCell.toLowerCase().includes('historique') ||
        firstCell.toLowerCase().includes('revision')
      ) {
        break;
      }

      const rowObj: Record<string, any> = {};
      let hasData = false;

      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const val = row[c];
        if (col.type === 'number') {
          const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
          if (!isNaN(num)) {
            rowObj[col.key] = num;
            hasData = true;
          } else if (col.defaultValue !== undefined) {
            rowObj[col.key] = col.defaultValue;
          }
        } else {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            rowObj[col.key] = String(val).trim();
            hasData = true;
          } else if (col.defaultValue !== undefined) {
            rowObj[col.key] = col.defaultValue;
          }
        }
      }

      if (hasData) {
        rows.push(rowObj);
      }
    }

    if (rows.length < tableDef.minRows) {
      errors.push({
        sheet: sheetName,
        cell: `A${tableHeaderIdx + 2}`,
        message: {
          en: `Found fewer than required minimum rows (${rows.length} < ${tableDef.minRows}) in ${tableDef.label.en}.`,
          fr: `Moins de lignes que le minimum requis (${rows.length} < ${tableDef.minRows}) dans ${tableDef.label.fr}.`,
        },
      });
      return null;
    }

    rawInput[tableKey] = rows;
  }

  return rawInput;
}

