// Drill Hole Data Management & Excel/CSV Parser Service for FragMill
// Handles per-hole geometry, multi-deck charging, downhole conditions, coordinates, and synchronization.

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Blast, DetailedDrillHole } from '../../types';

export interface DrillHoleSummary {
  totalHoles: number;
  totalExplosiveKg: number;
  totalVolumeM3: number;
  overallPowderFactorKgM3: number;
  overallPowderFactorKgTonne: number;
  avgDepthM: number;
  minDepthM: number;
  maxDepthM: number;
  totalDrilledM: number;
  avgDiameterMm: number;
  avgBurdenM: number;
  avgSpacingM: number;
  avgSubdrillM: number;
  inferredBenchHeightM: number;
  avgStemmingM: number;
  avgChargePerHoleKg: number;
  avgDensityTPerM3: number;
  totalTonnageT: number;
  cavityHolesCount: number;
  avgUcsMPa: number;
  minUcsMPa: number;
  maxUcsMPa: number;
  avgRqdPercent: number;
  wetHolesCount: number;
  frontRowHolesCount: number;
  maxDelayMs: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * Generate a realistic default pattern of drillholes from a Blast object
 * Used when a blast does not yet have an imported Excel/CSV file.
 */
export function generateDefaultDrillHolesFromBlast(blast: Blast): DetailedDrillHole[] {
  const p = blast.parameters;
  const numHoles = Math.max(1, p.numberOfHoles || 30);
  const burden = p.burden || 3.0;
  const spacing = p.spacing || 3.5;
  const benchHeight = p.benchHeight || 10.0;
  const subdrill = p.subdrill || 1.0;
  const nominalDepth = p.holeDepth || (benchHeight + subdrill);
  const nominalDiameter = p.holeDiameter || 89;
  const nominalCharge = p.chargePerHole || 22.0;
  const baseElevation = blast.benchElevation || 840.0;
  const nominalUCS = blast.rockMass.ucsMPa || 120;
  const nominalRQD = blast.rockMass.estimatedGsiOrRmr || 75;
  const rockDensity = blast.rockMass.density || 2.68;

  // Determine row and column layout (e.g. 3 rows of 10 holes for 30 holes)
  const numRows = Math.max(1, Math.min(6, Math.ceil(numHoles / 8)));
  const holesPerRow = Math.ceil(numHoles / numRows);

  const holes: DetailedDrillHole[] = [];
  let holeCount = 0;

  for (let r = 1; r <= numRows; r++) {
    for (let c = 1; c <= holesPerRow; c++) {
      if (holeCount >= numHoles) break;
      holeCount++;

      const isFaceRow = r === 1;
      const rowLetter = String.fromCharCode(64 + r); // A, B, C...
      const holeId = `${rowLetter}${c < 10 ? '0' : ''}${c}`;

      // Spatial coordinates with slight realistic surveying jitter
      const eastingX = parseFloat(((c - 1) * spacing + (r % 2 === 0 ? spacing * 0.5 : 0)).toFixed(2));
      const northingY = parseFloat(((r - 1) * burden).toFixed(2));
      // Topographic collar variance (+/- 0.3 m)
      const elevOffset = parseFloat((Math.sin(c * 0.8 + r * 1.2) * 0.35).toFixed(2));
      const elevationZ = parseFloat((baseElevation + elevOffset).toFixed(2));

      // Real-world variations: depth variance across uneven bench
      const depthVariance = parseFloat((Math.cos(c * 0.7) * 0.4).toFixed(2));
      const depthM = parseFloat((nominalDepth + depthVariance).toFixed(2));

      // Face row holes may be slightly inclined (e.g. 80 deg) to match face angle
      const inclinationDeg = isFaceRow ? 80 : 90;
      const azimuthDeg = isFaceRow ? 180 : 0;

      // Front row burden may vary due to face slope
      const holeBurden = isFaceRow
        ? parseFloat((burden * (0.95 + Math.sin(c) * 0.1)).toFixed(2))
        : burden;
      const holeSpacing = parseFloat((spacing * (0.98 + Math.cos(r + c) * 0.04)).toFixed(2));

      // Water condition: low-lying holes have water (roughly 15% of holes)
      const isWet = r > 1 && (c === 3 || c === 4 || c === 7);
      const waterDepthM = isWet ? parseFloat((1.2 + (c % 3) * 0.6).toFixed(1)) : 0;

      // Multi-deck charges
      // Wet holes MUST use water-resistant emulsion for toe
      const toeExplosiveType = isWet ? 'Bulk Emulsion' : (p.explosiveType.includes('Emulsion') ? 'Bulk Emulsion' : 'Dynamite');
      const toeChargeKg = parseFloat((nominalCharge * (isWet ? 0.45 : 0.35)).toFixed(1));

      const columnExplosiveType = isWet ? 'Bulk Emulsion' : 'ANFO';
      const columnChargeKg = parseFloat((nominalCharge - toeChargeKg).toFixed(1));
      const totalChargeKg = parseFloat((toeChargeKg + columnChargeKg).toFixed(1));

      const stemmingM = parseFloat((p.stemmingLength || 2.2).toFixed(2));
      const airDeckM = (!isWet && r === 2 && c % 2 === 0) ? 1.0 : 0.0;

      // Local Rock Strength (UCS varies across geological bench domains: 85 - 145 MPa)
      const ucsVariation = Math.round(Math.sin((c / holesPerRow) * Math.PI) * 25 + (r - 1) * 8);
      const ucsMPa = Math.max(50, Math.min(220, nominalUCS + ucsVariation));
      const rqdPercent = Math.max(30, Math.min(98, nominalRQD + Math.round(ucsVariation * 0.2)));

      // Individual Detonator Delay: Electronic i-kon sequence
      // Inter-hole delay = 25 ms, Inter-row delay = 65 ms
      const detonatorDelayMs = (r - 1) * 65 + (c - 1) * 25;

      // Local Powder factor
      const holeVol = holeBurden * holeSpacing * benchHeight;
      const powderFactorKgPerM3 = holeVol > 0 ? parseFloat((totalChargeKg / holeVol).toFixed(3)) : 0.4;

      holes.push({
        holeId,
        rowNumber: r,
        eastingX,
        northingY,
        elevationZ,
        diameterMm: nominalDiameter,
        depthM,
        burdenM: holeBurden,
        spacingM: holeSpacing,
        subdrillM: subdrill,
        stemmingM,
        inclinationDeg,
        azimuthDeg,
        waterDepthM,
        toeExplosiveType,
        toeChargeKg,
        columnExplosiveType,
        columnChargeKg,
        airDeckM,
        totalChargeKg,
        powderFactorKgPerM3,
        rockType: blast.rockMass.rockType || 'Granodiorite',
        ucsMPa,
        rqdPercent,
        densityTPerM3: rockDensity,
        detonatorDelayMs,
        detonatorType: 'Electronic i-kon III',
        status: 'planned',
        notes: isFaceRow ? 'Face row / buffer' : (isWet ? 'Wet hole (Emulsion)' : 'Standard production'),
      });
    }
  }

  return holes;
}

/**
 * Calculates aggregated statistics from an array of detailed drillholes
 */
export function calculateDrillHoleSummary(holes: DetailedDrillHole[], benchHeight = 10.0): DrillHoleSummary {
  if (holes.length === 0) {
    return {
      totalHoles: 0,
      totalExplosiveKg: 0,
      totalVolumeM3: 0,
      overallPowderFactorKgM3: 0,
      overallPowderFactorKgTonne: 0,
      avgDepthM: 0,
      minDepthM: 0,
      maxDepthM: 0,
      totalDrilledM: 0,
      avgDiameterMm: 89,
      avgBurdenM: 3.0,
      avgSpacingM: 3.5,
      avgSubdrillM: 0.8,
      inferredBenchHeightM: 10.0,
      avgStemmingM: 2.2,
      avgChargePerHoleKg: 0,
      avgDensityTPerM3: 2.68,
      totalTonnageT: 0,
      cavityHolesCount: 0,
      avgUcsMPa: 120,
      minUcsMPa: 120,
      maxUcsMPa: 120,
      avgRqdPercent: 75,
      wetHolesCount: 0,
      frontRowHolesCount: 0,
      maxDelayMs: 0,
      bounds: { minX: 0, maxX: 50, minY: 0, maxY: 30 },
    };
  }

  let totalExplosiveKg = 0;
  let totalVolumeM3 = 0;
  let totalDepthM = 0;
  let totalDiameter = 0;
  let totalBurden = 0;
  let totalSpacing = 0;
  let totalStemming = 0;
  let totalUCS = 0;
  let totalRQD = 0;
  let totalDensity = 0;
  let wetHolesCount = 0;
  let frontRowHolesCount = 0;
  let cavityHolesCount = 0;
  let maxDelayMs = 0;

  let totalSubdrill = 0;
  let minDepthM = Infinity;
  let maxDepthM = -Infinity;
  let minUcsMPa = Infinity;
  let maxUcsMPa = -Infinity;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const h of holes) {
    const charge = h.totalChargeKg || (h.toeChargeKg + h.columnChargeKg) || 0;
    // Calculate physical blasted rock volume per hole:
    // Hole blasted bench height = Depth - Subdrill (defaults to nominal bench height if missing)
    const holeSubdrill = h.subdrillM !== undefined ? h.subdrillM : 1.0;
    const holeBenchH = h.depthM ? Math.max(1.0, h.depthM - holeSubdrill) : (benchHeight > 0 ? benchHeight : 10.0);
    const vol = (h.burdenM || 3.0) * (h.spacingM || 3.5) * holeBenchH;

    totalExplosiveKg += charge;
    totalVolumeM3 += vol;
    totalDepthM += h.depthM || 0;
    totalSubdrill += holeSubdrill;
    totalDiameter += h.diameterMm || 89;
    totalBurden += h.burdenM || 3.0;
    totalSpacing += h.spacingM || 3.5;
    totalStemming += h.stemmingM || 2.2;
    totalUCS += h.ucsMPa || 120;
    totalRQD += h.rqdPercent || 75;
    totalDensity += h.densityTPerM3 || 2.68;

    if (h.depthM < minDepthM) minDepthM = h.depthM;
    if (h.depthM > maxDepthM) maxDepthM = h.depthM;
    if (h.ucsMPa < minUcsMPa) minUcsMPa = h.ucsMPa;
    if (h.ucsMPa > maxUcsMPa) maxUcsMPa = h.ucsMPa;

    if (h.eastingX < minX) minX = h.eastingX;
    if (h.eastingX > maxX) maxX = h.eastingX;
    if (h.northingY < minY) minY = h.northingY;
    if (h.northingY > maxY) maxY = h.northingY;

    if ((h.waterDepthM || 0) > 0) wetHolesCount++;
    if (h.rowNumber === 1) frontRowHolesCount++;
    if (h.hasCavityOrFault || (h.airDeckM || 0) > 0) cavityHolesCount++;
    if ((h.detonatorDelayMs || 0) > maxDelayMs) maxDelayMs = h.detonatorDelayMs || 0;
  }

  const n = holes.length;
  const avgDensity = totalDensity / n;
  const totalTonnage = totalVolumeM3 * avgDensity;
  const overallPowderFactorKgM3 = totalVolumeM3 > 0 ? totalExplosiveKg / totalVolumeM3 : 0;
  const overallPowderFactorKgTonne = totalTonnage > 0 ? totalExplosiveKg / totalTonnage : 0;
  const avgDepthM = parseFloat((totalDepthM / n).toFixed(2));
  const avgSubdrillM = parseFloat((totalSubdrill / n).toFixed(2));
  const inferredBenchHeightM = parseFloat(Math.max(2.0, avgDepthM - avgSubdrillM).toFixed(2));

  return {
    totalHoles: n,
    totalExplosiveKg: parseFloat(totalExplosiveKg.toFixed(1)),
    totalVolumeM3: parseFloat(totalVolumeM3.toFixed(1)),
    overallPowderFactorKgM3: parseFloat(overallPowderFactorKgM3.toFixed(3)),
    overallPowderFactorKgTonne: parseFloat(overallPowderFactorKgTonne.toFixed(3)),
    avgDepthM,
    minDepthM: parseFloat((minDepthM === Infinity ? 0 : minDepthM).toFixed(2)),
    maxDepthM: parseFloat((maxDepthM === -Infinity ? 0 : maxDepthM).toFixed(2)),
    totalDrilledM: parseFloat(totalDepthM.toFixed(1)),
    avgDiameterMm: Math.round(totalDiameter / n),
    avgBurdenM: parseFloat((totalBurden / n).toFixed(2)),
    avgSpacingM: parseFloat((totalSpacing / n).toFixed(2)),
    avgSubdrillM,
    inferredBenchHeightM,
    avgStemmingM: parseFloat((totalStemming / n).toFixed(2)),
    avgChargePerHoleKg: parseFloat((totalExplosiveKg / n).toFixed(1)),
    avgDensityTPerM3: parseFloat(avgDensity.toFixed(2)),
    totalTonnageT: Math.round(totalTonnage),
    cavityHolesCount,
    avgUcsMPa: Math.round(totalUCS / n),
    minUcsMPa: minUcsMPa === Infinity ? 0 : minUcsMPa,
    maxUcsMPa: maxUcsMPa === -Infinity ? 0 : maxUcsMPa,
    avgRqdPercent: Math.round(totalRQD / n),
    wetHolesCount,
    frontRowHolesCount,
    maxDelayMs,
    bounds: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 50 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 30 : maxY,
    },
  };
}

/**
 * Synchronize a Blast object's parameters with the imported drillholes dataset
 * Keeps the entire app and all tabs 100% in sync with the real drillholes.
 */
export function syncBlastWithDrillHoles(blast: Blast, holes: DetailedDrillHole[]): Blast {
  if (holes.length === 0) return blast;

  const benchHeight = blast.parameters.benchHeight || 10.0;
  const summary = calculateDrillHoleSummary(holes, benchHeight);

  // Inferred real bench height and explosive description based on water presence
  const realBenchHeight = summary.inferredBenchHeightM || Math.max(2.0, parseFloat((summary.avgDepthM - summary.avgSubdrillM).toFixed(2)));
  const explosiveDescription = summary.wetHolesCount > 0
    ? `Hybrid (${summary.wetHolesCount} wet holes with Bulk Emulsion + ${summary.totalHoles - summary.wetHolesCount} ANFO)`
    : (blast.parameters.explosiveType || 'ANFO');

  const updatedParams = {
    ...blast.parameters,
    benchHeight: realBenchHeight,
    subdrill: summary.avgSubdrillM,
    numberOfHoles: summary.totalHoles,
    holeDepth: summary.avgDepthM,
    holeDiameter: summary.avgDiameterMm,
    burden: summary.avgBurdenM,
    spacing: summary.avgSpacingM,
    chargePerHole: summary.avgChargePerHoleKg,
    stemmingLength: summary.avgStemmingM,
    explosiveType: explosiveDescription,
    waterInHoles: summary.wetHolesCount > 0,
    initiationSequenceNotes: `Electronic / Nonel (${summary.totalHoles} holes, 0 - ${summary.maxDelayMs} ms)`,
  };

  const updatedRockMass = {
    ...blast.rockMass,
    ucsMPa: summary.avgUcsMPa,
    estimatedGsiOrRmr: summary.avgRqdPercent,
  };

  return {
    ...blast,
    parameters: updatedParams,
    rockMass: updatedRockMass,
    drillHoles: holes,
    updatedAt: Date.now(),
  };
}

/**
 * Parse an Excel (.xlsx / .xls) or CSV file containing drillhole data
 * Flexible column matching handles French, English, and field abbreviations.
 */
export async function parseDrillHolesFromFile(file: File, defaultBenchHeight = 10.0): Promise<DetailedDrillHole[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'csv' || extension === 'txt') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const holes = mapRawRowsToDrillHoles(results.data as Record<string, any>[], defaultBenchHeight);
            resolve(holes);
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err),
      });
    });
  }

  // Binary Excel (.xlsx / .xls)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        const holes = mapRawRowsToDrillHoles(rawRows, defaultBenchHeight);
        resolve(holes);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Normalizes an arbitrary header or key string by:
 * 1. Stripping accents (e.g. é -> e, à -> a, ç -> c)
 * 2. Converting to lowercase
 * 3. Removing all non-alphanumeric characters
 */
export function normalizeKey(key: string): string {
  if (!key) return '';
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Strips common engineering unit suffixes from a normalized key:
 * e.g. 'waterdepthm' -> 'waterdepth', 'eauprofondeurm' -> 'eauprofondeur',
 *      'hardnessucsmpa' -> 'hardnessucs', 'densitytm3' -> 'density', etc.
 */
export function stripUnitSuffix(cleanKey: string): string {
  const suffixes = [
    'mpa',
    'tm3',
    'kgm3',
    'gcm3',
    'kgt',
    'kgtonne',
    'kg',
    'mm',
    'deg',
    'degrees',
    'degree',
    'percent',
    'pourcent',
    'pct',
    'ms',
    'sec',
    'gpt',
    'gt',
    'm3',
    'xm',
    'ym',
    'zm',
    'm',
  ];
  for (const s of suffixes) {
    if (cleanKey.endsWith(s) && cleanKey.length > s.length + 2) {
      return cleanKey.slice(0, -s.length);
    }
  }
  return cleanKey;
}

/**
 * Internal mapper from raw dictionary row to typed DetailedDrillHole
 * Resilient against uppercase/lowercase, accents, spaces, underscores, and unit suffixes.
 */
export function mapRawRowsToDrillHoles(rows: Record<string, any>[], benchHeight: number): DetailedDrillHole[] {
  const holes: DetailedDrillHole[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!r || Object.keys(r).length === 0) continue;

    // Normalizing key lookups
    const normalized: Record<string, any> = {};
    for (const [key, val] of Object.entries(r)) {
      if (val === undefined || val === null) continue;
      const cleanKey = normalizeKey(key);
      normalized[cleanKey] = val;

      const stripped = stripUnitSuffix(cleanKey);
      if (!normalized[stripped]) {
        normalized[stripped] = val;
      }
    }

    const getVal = (...keys: string[]): any => {
      for (const k of keys) {
        const clean = normalizeKey(k);
        if (normalized[clean] !== undefined && normalized[clean] !== '') {
          return normalized[clean];
        }
        const stripped = stripUnitSuffix(clean);
        if (normalized[stripped] !== undefined && normalized[stripped] !== '') {
          return normalized[stripped];
        }
      }
      return undefined;
    };

    const getNum = (fallback: number, ...keys: string[]): number => {
      const raw = getVal(...keys);
      if (raw === undefined || raw === null || raw === '') return fallback;
      const parsed = parseFloat(String(raw).replace(',', '.'));
      return isNaN(parsed) ? fallback : parsed;
    };

    // Hole Identifier
    const holeId = String(
      getVal(
        'holeid',
        'idtrou',
        'hole',
        'trou',
        'id',
        'name',
        'nom',
        'number',
        'numero',
        'holename',
        'identifiant',
        'label'
      ) || `H-${idx + 1}`
    ).trim();

    if (!holeId || holeId.startsWith('#')) continue; // Skip header comments

    // Geometry & Coordinates
    const rowNumber = Math.max(
      1,
      Math.round(
        getNum(
          1,
          'rownumber',
          'lignerangee',
          'rangee',
          'ligne',
          'row',
          'rowid',
          'rowno',
          'numrangee',
          'rang'
        )
      )
    );

    const eastingX = getNum(
      parseFloat((idx * 3.5).toFixed(2)),
      'eastingxm',
      'estxm',
      'eastingx',
      'estx',
      'easting',
      'east',
      'est',
      'x',
      'xm',
      'coordx',
      'posx',
      'longitude',
      'lon'
    );

    const northingY = getNum(
      parseFloat(((rowNumber - 1) * 3.0).toFixed(2)),
      'northingym',
      'nordym',
      'northingy',
      'nordy',
      'northing',
      'north',
      'nord',
      'y',
      'ym',
      'coordy',
      'posy',
      'latitude',
      'lat'
    );

    const elevationZ = getNum(
      840.0,
      'elevationzm',
      'cotezm',
      'elevationz',
      'cotez',
      'elevation',
      'elev',
      'cote',
      'alt',
      'altitude',
      'z',
      'zm',
      'collarz',
      'rl',
      'niveau'
    );

    const diameterMm = Math.round(
      getNum(
        89,
        'diametermm',
        'diametremm',
        'diameter',
        'diametre',
        'diam',
        'bitdiameter',
        'tailledutrou',
        'diammm',
        'calibre'
      )
    );

    const depthM = getNum(
      11.0,
      'depthm',
      'profondeurm',
      'depth',
      'profondeur',
      'longueur',
      'length',
      'h',
      'holedepth',
      'proftrou'
    );

    const burdenM = getNum(
      3.0,
      'burdenm',
      'banquettem',
      'burden',
      'banquette',
      'b',
      'ligneavance'
    );

    const spacingM = getNum(
      3.5,
      'spacingm',
      'espacementm',
      'spacing',
      'espacement',
      's',
      'intertrou'
    );

    const subdrillM = getNum(
      1.0,
      'subdrillm',
      'surforagem',
      'subdrill',
      'surforage',
      'j',
      'subdrilling'
    );

    const stemmingM = getNum(
      2.2,
      'stemmingm',
      'bourragem',
      'stemming',
      'bourrage',
      't',
      'bourragecolonne'
    );

    const inclinationDeg = getNum(
      90,
      'inclinationdeg',
      'inclinaisondeg',
      'inclination',
      'inclinaison',
      'dip',
      'angle',
      'plunge',
      'pente'
    );

    const azimuthDeg = getNum(
      0,
      'azimuthdeg',
      'azimuth',
      'bearing',
      'direction',
      'orientation',
      'gisement'
    );

    // Water Ingress / Downhole Water
    const waterDepthM = getNum(
      0,
      'waterdepthm',
      'eauprofondeurm',
      'waterdepth',
      'eauprofondeur',
      'waterm',
      'eaum',
      'water',
      'eau',
      'hauteureau',
      'hauteurdeau',
      'waterlevel',
      'waterlevelm',
      'waterinholes',
      'wethole',
      'wetholes',
      'eaudansletrou',
      'watercolumn',
      'inflow'
    );

    // Explosive parameters
    const toeExplosiveType = String(
      getVal(
        'toeexplosive',
        'explosifpied',
        'toeexplosivetype',
        'explopied',
        'typeexplosifpied',
        'explosiffond',
        'toetype'
      ) || (waterDepthM > 0 ? 'Bulk Emulsion' : 'Dynamite')
    ).trim();

    const toeChargeKg = getNum(
      6.0,
      'toechargekg',
      'chargepiedkg',
      'toecharge',
      'chargepied',
      'masspied',
      'massepied',
      'piedkg'
    );

    const columnExplosiveType = String(
      getVal(
        'columnexplosive',
        'explosifcolonne',
        'columnexplosivetype',
        'explocolonne',
        'typeexplosifcolonne',
        'columntype'
      ) || (waterDepthM > 0 ? 'Bulk Emulsion' : 'ANFO')
    ).trim();

    const columnChargeKg = getNum(
      16.0,
      'columnchargekg',
      'chargecolonnekg',
      'columncharge',
      'chargecolonne',
      'masscolonne',
      'massecolonne',
      'colonnekg'
    );

    const totalChargeRaw = getNum(
      toeChargeKg + columnChargeKg,
      'totalchargekg',
      'chargetotalekg',
      'totalcharge',
      'chargetotale',
      'charge',
      'masstotale',
      'massetotale',
      'q'
    );

    const airDeckM = getNum(
      0,
      'airdeckm',
      'airdeck',
      'deck',
      'airgap',
      'tampondair',
      'dechargetroncon'
    );

    // Rock Geomechanics
    const rockType = String(
      getVal(
        'rocktype',
        'typeroche',
        'rock',
        'lithology',
        'lithologie',
        'roche'
      ) || 'Granodiorite'
    ).trim();

    const ucsMPa = Math.round(
      getNum(
        120,
        'hardnessucsmpa',
        'dureteucsmpa',
        'hardnessucs',
        'dureteucs',
        'ucsmpa',
        'ucs',
        'hardness',
        'durete',
        'strength',
        'resistanceucs',
        'compressive'
      )
    );

    const rqdPercent = Math.round(
      getNum(
        75,
        'rqdpercent',
        'rqdpourcent',
        'rqd',
        'qualite',
        'rmr',
        'gsi'
      )
    );

    const densityTPerM3 = getNum(
      2.68,
      'densitytm3',
      'densitetm3',
      'densitytperm3',
      'densitetperm3',
      'density',
      'densite',
      'rockdensity',
      'specificgravity',
      'sg',
      'densitedelaroche'
    );

    // Initiation Timing
    const detonatorDelayMs = Math.round(
      getNum(
        (rowNumber - 1) * 65 + (idx % 8) * 25,
        'delayms',
        'retardms',
        'delay',
        'retard',
        'detonatordelay',
        'tempsecoulement',
        'time'
      )
    );

    const detonatorType = String(
      getVal(
        'detonatortype',
        'typedetonateur',
        'detonator',
        'detonateur',
        'typeamorcage',
        'amorcage'
      ) || 'Electronic i-kon III'
    ).trim();

    const holeVol = burdenM * spacingM * benchHeight;
    const powderFactorKgPerM3 =
      holeVol > 0 ? parseFloat((totalChargeRaw / holeVol).toFixed(3)) : 0.4;

    const userNotes = String(
      getVal(
        'notes',
        'remarques',
        'remarque',
        'comment',
        'commentaires',
        'commentaire',
        'obs',
        'observations'
      ) || ''
    ).trim();

    const statusVal = String(getVal('status', 'statut', 'etat') || 'planned').trim();

    // If water was detected and notes empty, annotate wet hole
    const finalNotes =
      userNotes ||
      (waterDepthM > 0
        ? `Wet hole (Water: ${waterDepthM}m, Emulsion charged)`
        : '');

    holes.push({
      holeId,
      rowNumber,
      eastingX,
      northingY,
      elevationZ,
      diameterMm,
      depthM,
      burdenM,
      spacingM,
      subdrillM,
      stemmingM,
      inclinationDeg,
      azimuthDeg,
      waterDepthM,
      toeExplosiveType,
      toeChargeKg,
      columnExplosiveType,
      columnChargeKg,
      airDeckM,
      totalChargeKg: totalChargeRaw,
      powderFactorKgPerM3,
      rockType,
      ucsMPa,
      rqdPercent,
      densityTPerM3,
      detonatorDelayMs,
      detonatorType,
      status: (statusVal as any) || 'planned',
      notes: finalNotes,
    });
  }

  return holes;
}

/**
 * Export drillholes array to an Excel (.xlsx) Blob
 */
export function exportDrillHolesToXlsx(holes: DetailedDrillHole[], blastId: string, lang: 'en' | 'fr' = 'en'): Blob {
  const isFr = lang === 'fr';
  const wb = XLSX.utils.book_new();

  const headers = isFr
    ? [
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
      ]
    : [
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

  const rows = holes.map((h) => [
    h.holeId,
    h.rowNumber,
    h.eastingX,
    h.northingY,
    h.elevationZ,
    h.diameterMm,
    h.depthM,
    h.burdenM,
    h.spacingM,
    h.subdrillM,
    h.stemmingM,
    h.inclinationDeg,
    h.waterDepthM,
    h.toeExplosiveType || '',
    h.toeChargeKg,
    h.columnExplosiveType || '',
    h.columnChargeKg,
    h.airDeckM || 0,
    h.totalChargeKg,
    h.powderFactorKgPerM3 || 0,
    h.rockType || '',
    h.ucsMPa,
    h.rqdPercent || 75,
    h.densityTPerM3 || 2.68,
    h.detonatorDelayMs || 0,
    h.detonatorType || '',
    h.status || 'planned',
    h.notes || '',
  ]);

  const sheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Column width hints
  ws['!cols'] = headers.map(() => ({ wch: 15 }));

  XLSX.utils.book_append_sheet(wb, ws, isFr ? 'Plan_Trous_Foration' : 'DrillHoles_Pattern');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Export drillholes array to CSV string
 */
export function exportDrillHolesToCsv(holes: DetailedDrillHole[]): string {
  const data = holes.map((h) => ({
    Hole_ID: h.holeId,
    Row_Number: h.rowNumber,
    Easting_X_m: h.eastingX,
    Northing_Y_m: h.northingY,
    Elevation_Z_m: h.elevationZ,
    Diameter_mm: h.diameterMm,
    Depth_m: h.depthM,
    Burden_m: h.burdenM,
    Spacing_m: h.spacingM,
    Subdrill_m: h.subdrillM,
    Stemming_m: h.stemmingM,
    Inclination_deg: h.inclinationDeg,
    Water_Depth_m: h.waterDepthM,
    Toe_Explosive: h.toeExplosiveType || 'Bulk Emulsion',
    Toe_Charge_kg: h.toeChargeKg,
    Column_Explosive: h.columnExplosiveType || 'ANFO',
    Column_Charge_kg: h.columnChargeKg,
    Air_Deck_m: h.airDeckM || 0,
    Total_Charge_kg: h.totalChargeKg,
    Powder_Factor_kg_m3: h.powderFactorKgPerM3,
    Rock_Type: h.rockType,
    Hardness_UCS_MPa: h.ucsMPa,
    RQD_Percent: h.rqdPercent,
    Density_t_m3: h.densityTPerM3,
    Delay_ms: h.detonatorDelayMs,
    Detonator_Type: h.detonatorType,
    Notes: h.notes,
  }));

  return Papa.unparse(data);
}

/**
 * Downloads a ready-to-fill sample template (.xlsx) with pre-filled sample holes and instructions
 */
export function downloadSampleDrillHoleTemplate(lang: 'en' | 'fr' = 'en') {
  const isFr = lang === 'fr';
  const wb = XLSX.utils.book_new();

  const sampleRows = isFr
    ? [
        ['ID_Trou', 'Ligne_Rangée', 'Est_X_m', 'Nord_Y_m', 'Cote_Z_m', 'Diametre_mm', 'Profondeur_m', 'Banquette_m', 'Espacement_m', 'Surforage_m', 'Bourrage_m', 'Inclinaison_deg', 'Eau_Profondeur_m', 'Explosif_Pied', 'Charge_Pied_kg', 'Explosif_Colonne', 'Charge_Colonne_kg', 'Air_Deck_m', 'Charge_Totale_kg', 'Type_Roche', 'Durete_UCS_MPa', 'RQD_Pourcent', 'Densite_t_m3', 'Retard_ms', 'Type_Detonateur', 'Remarques'],
        ['A01', 1, 0.0, 0.0, 840.0, 89, 11.0, 3.0, 3.5, 1.0, 2.2, 80, 0.0, 'Emulsion Vrac', 8.0, 'ANFO', 14.0, 0.0, 22.0, 'Granodiorite', 125, 78, 2.68, 0, 'Electronique i-kon', 'Trou de front'],
        ['A02', 1, 3.5, 0.0, 840.1, 89, 11.2, 3.1, 3.5, 1.0, 2.2, 80, 0.0, 'Emulsion Vrac', 8.0, 'ANFO', 14.5, 0.0, 22.5, 'Granodiorite', 128, 80, 2.68, 25, 'Electronique i-kon', 'Trou de front'],
        ['A03', 1, 7.0, 0.0, 839.8, 89, 11.0, 2.9, 3.5, 1.0, 2.2, 80, 0.0, 'Emulsion Vrac', 8.0, 'ANFO', 14.0, 0.0, 22.0, 'Granodiorite', 120, 75, 2.68, 50, 'Electronique i-kon', 'Trou de front'],
        ['B01', 2, 1.75, 3.0, 840.2, 89, 11.5, 3.0, 3.5, 1.0, 2.4, 90, 0.0, 'Emulsion Vrac', 7.5, 'ANFO', 15.0, 0.0, 22.5, 'Granodiorite', 130, 82, 2.68, 65, 'Electronique i-kon', 'Production'],
        ['B02', 2, 5.25, 3.0, 840.0, 89, 11.8, 3.0, 3.5, 1.0, 2.4, 90, 1.5, 'Emulsion Vrac', 12.0, 'Emulsion Vrac', 11.0, 0.0, 23.0, 'Granodiorite', 95, 60, 2.68, 90, 'Electronique i-kon', 'Trou humide (Eau 1.5m)'],
        ['B03', 2, 8.75, 3.0, 839.9, 89, 11.5, 3.0, 3.5, 1.0, 2.4, 90, 0.0, 'Emulsion Vrac', 7.5, 'ANFO', 15.0, 1.0, 22.5, 'Granodiorite', 115, 72, 2.68, 115, 'Electronique i-kon', 'Air deck 1m'],
        ['C01', 3, 0.0, 6.0, 840.4, 89, 11.0, 3.0, 3.5, 1.0, 2.5, 90, 0.0, 'Emulsion Vrac', 7.0, 'ANFO', 14.0, 0.0, 21.0, 'Granodiorite', 135, 85, 2.68, 130, 'Electronique i-kon', 'Derniere rangee'],
        ['C02', 3, 3.5, 6.0, 840.2, 89, 11.0, 3.0, 3.5, 1.0, 2.5, 90, 0.0, 'Emulsion Vrac', 7.0, 'ANFO', 14.0, 0.0, 21.0, 'Granodiorite', 140, 88, 2.68, 155, 'Electronique i-kon', 'Derniere rangee'],
      ]
    : [
        ['Hole_ID', 'Row_Number', 'Easting_X_m', 'Northing_Y_m', 'Elevation_Z_m', 'Diameter_mm', 'Depth_m', 'Burden_m', 'Spacing_m', 'Subdrill_m', 'Stemming_m', 'Inclination_deg', 'Water_Depth_m', 'Toe_Explosive', 'Toe_Charge_kg', 'Column_Explosive', 'Column_Charge_kg', 'Air_Deck_m', 'Total_Charge_kg', 'Rock_Type', 'Hardness_UCS_MPa', 'RQD_Percent', 'Density_t_m3', 'Delay_ms', 'Detonator_Type', 'Notes'],
        ['A01', 1, 0.0, 0.0, 840.0, 89, 11.0, 3.0, 3.5, 1.0, 2.2, 80, 0.0, 'Bulk Emulsion', 8.0, 'ANFO', 14.0, 0.0, 22.0, 'Granodiorite', 125, 78, 2.68, 0, 'Electronic i-kon', 'Face row hole'],
        ['A02', 1, 3.5, 0.0, 840.1, 89, 11.2, 3.1, 3.5, 1.0, 2.2, 80, 0.0, 'Bulk Emulsion', 8.0, 'ANFO', 14.5, 0.0, 22.5, 'Granodiorite', 128, 80, 2.68, 25, 'Electronic i-kon', 'Face row hole'],
        ['A03', 1, 7.0, 0.0, 839.8, 89, 11.0, 2.9, 3.5, 1.0, 2.2, 80, 0.0, 'Bulk Emulsion', 8.0, 'ANFO', 14.0, 0.0, 22.0, 'Granodiorite', 120, 75, 2.68, 50, 'Electronic i-kon', 'Face row hole'],
        ['B01', 2, 1.75, 3.0, 840.2, 89, 11.5, 3.0, 3.5, 1.0, 2.4, 90, 0.0, 'Bulk Emulsion', 7.5, 'ANFO', 15.0, 0.0, 22.5, 'Granodiorite', 130, 82, 2.68, 65, 'Electronic i-kon', 'Production'],
        ['B02', 2, 5.25, 3.0, 840.0, 89, 11.8, 3.0, 3.5, 1.0, 2.4, 90, 1.5, 'Bulk Emulsion', 12.0, 'Bulk Emulsion', 11.0, 0.0, 23.0, 'Granodiorite', 95, 60, 2.68, 90, 'Electronic i-kon', 'Wet hole (Water 1.5m)'],
        ['B03', 2, 8.75, 3.0, 839.9, 89, 11.5, 3.0, 3.5, 1.0, 2.4, 90, 0.0, 'Bulk Emulsion', 7.5, 'ANFO', 15.0, 1.0, 22.5, 'Granodiorite', 115, 72, 2.68, 115, 'Electronic i-kon', 'Air deck 1m'],
        ['C01', 3, 0.0, 6.0, 840.4, 89, 11.0, 3.0, 3.5, 1.0, 2.5, 90, 0.0, 'Bulk Emulsion', 7.0, 'ANFO', 14.0, 0.0, 21.0, 'Granodiorite', 135, 85, 2.68, 130, 'Electronic i-kon', 'Back row / trim'],
        ['C02', 3, 3.5, 6.0, 840.2, 89, 11.0, 3.0, 3.5, 1.0, 2.5, 90, 0.0, 'Bulk Emulsion', 7.0, 'ANFO', 14.0, 0.0, 21.0, 'Granodiorite', 140, 88, 2.68, 155, 'Electronic i-kon', 'Back row / trim'],
      ];

  const ws = XLSX.utils.aoa_to_sheet(sampleRows);
  ws['!cols'] = sampleRows[0].map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, isFr ? 'Modele_Trous' : 'DrillHoles_Template');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = isFr ? 'FragMill_Modele_Trous_Foration.xlsx' : 'FragMill_DrillHoles_Template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
