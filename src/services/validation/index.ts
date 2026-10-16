import type {
  GroundTruth,
  FragmentationMetrics,
  SieveDataGroundTruth,
} from '../../types';

export interface ValidationMetricsResult {
  engine: string;
  errorP20Percent: number;
  errorP50Percent: number;
  errorP80Percent: number;
  biasP20Mm: number;
  biasP50Mm: number;
  biasP80Mm: number;
  meanAbsErrorPercent: number;
  thresholdExceeded: boolean; // True if MAPE > threshold (default 15%)
}

export const DEFAULT_SAMPLE_TEMPLATE = `Aperture (mm)\tMass Retained (kg)
300\t42.0
200\t68.5
125\t54.0
75\t38.0
37.5\t22.5
19.0\t14.0
9.5\t8.2
4.75\t4.5`;

// Compute cumulative passing curve and percentiles from sieve/screen data
export function computeSieveDistribution(sieveData: SieveDataGroundTruth[]): {
  curve: Array<{ sizeMm: number; passingPercent: number }>;
  p20: number;
  p50: number;
  p80: number;
} {
  if (sieveData.length === 0) {
    return { curve: [], p20: 0, p50: 0, p80: 0 };
  }

  // Sort descending by screen aperture mm
  const sorted = [...sieveData].sort((a, b) => b.apertureMm - a.apertureMm);

  const totalMass = sorted.reduce((sum, item) => sum + item.massRetainedKg, 0);
  if (totalMass === 0) return { curve: [], p20: 0, p50: 0, p80: 0 };

  let cumRetained = 0;
  // Calculate cumulative passing for each screen
  const points: Array<{ sizeMm: number; passingPercent: number }> = [];

  for (const item of sorted) {
    cumRetained += item.massRetainedKg;
    const passingPercent = Math.max(0, 100 - (cumRetained / totalMass) * 100);
    points.push({
      sizeMm: item.apertureMm,
      passingPercent: Number(passingPercent.toFixed(2)),
    });
  }

  // Sort ascending for curve representation
  points.sort((a, b) => a.sizeMm - b.sizeMm);

  const findP = (target: number) => {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i].passingPercent;
      const p2 = points[i + 1].passingPercent;
      if (target >= p1 && target <= p2) {
        const t = (target - p1) / Math.max(0.001, p2 - p1);
        return Math.round(points[i].sizeMm + t * (points[i + 1].sizeMm - points[i].sizeMm));
      }
    }
    return points[Math.floor(points.length / 2)]?.sizeMm || 100;
  };

  return {
    curve: points,
    p20: findP(20),
    p50: findP(50),
    p80: findP(80),
  };
}

export function computeValidationComparison(
  imageMetrics: FragmentationMetrics,
  groundTruth: GroundTruth,
  engineName = 'Engine A',
  thresholdPercent = 15
): ValidationMetricsResult {
  const gtP20 = groundTruth.computedP20 || 60;
  const gtP50 = groundTruth.computedP50 || 120;
  const gtP80 = groundTruth.computedP80 || 220;

  const biasP20 = imageMetrics.p20 - gtP20;
  const biasP50 = imageMetrics.p50 - gtP50;
  const biasP80 = imageMetrics.p80 - gtP80;

  const errP20 = (biasP20 / gtP20) * 100;
  const errP50 = (biasP50 / gtP50) * 100;
  const errP80 = (biasP80 / gtP80) * 100;

  const mape = (Math.abs(errP20) + Math.abs(errP50) + Math.abs(errP80)) / 3;

  return {
    engine: engineName,
    errorP20Percent: Number(errP20.toFixed(1)),
    errorP50Percent: Number(errP50.toFixed(1)),
    errorP80Percent: Number(errP80.toFixed(1)),
    biasP20Mm: Number(biasP20.toFixed(1)),
    biasP50Mm: Number(biasP50.toFixed(1)),
    biasP80Mm: Number(biasP80.toFixed(1)),
    meanAbsErrorPercent: Number(mape.toFixed(1)),
    thresholdExceeded: mape > thresholdPercent,
  };
}

// Robust parser for user-pasted text (TSV from Excel, CSV, semicolon, with headers or units)
export function parseSieveInput(text: string): {
  rows: SieveDataGroundTruth[];
  totalMassKg: number;
  error?: string;
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], totalMassKg: 0, error: 'No text provided' };
  }

  const rows: SieveDataGroundTruth[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Determine row separator
    let tokens: string[] = [];
    if (rawLine.includes('\t')) {
      tokens = rawLine.split('\t');
    } else if (rawLine.includes(';')) {
      tokens = rawLine.split(';');
    } else if (rawLine.includes(',')) {
      const commaCount = (rawLine.match(/,/g) || []).length;
      if (commaCount === 1) {
        tokens = rawLine.split(',');
      } else {
        tokens = rawLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      }
    } else {
      tokens = rawLine.split(/\s+/);
    }

    const cleanTokens = tokens
      .map((t) => t.replace(/["']/g, '').trim())
      .filter(Boolean);

    const numericCandidates: number[] = [];
    for (const t of cleanTokens) {
      if (/\d/.test(t)) {
        // Strip units like mm, cm, m, kg, g, %, lbs
        const stripped = t.replace(/(mm|cm|m|kg|g|%|lbs|t)/gi, '').trim();
        // Convert European comma to dot if applicable
        const normalized = stripped.replace(',', '.');
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          numericCandidates.push(num);
        }
      }
    }

    if (numericCandidates.length >= 2) {
      const aperture = numericCandidates[0];
      const mass = numericCandidates[1];
      if (aperture > 0 && mass >= 0) {
        rows.push({
          apertureMm: Number(aperture.toFixed(2)),
          massRetainedKg: Number(mass.toFixed(2)),
        });
      }
    }
  }

  if (rows.length === 0) {
    return {
      rows: [],
      totalMassKg: 0,
      error: 'Could not detect 2 numeric columns (Screen Aperture & Mass Retained).',
    };
  }

  // Deduplicate and aggregate any duplicate sieve sizes
  const sizeMap = new Map<number, number>();
  for (const r of rows) {
    sizeMap.set(r.apertureMm, (sizeMap.get(r.apertureMm) || 0) + r.massRetainedKg);
  }

  const aggregatedRows: SieveDataGroundTruth[] = [];
  for (const [apertureMm, massRetainedKg] of sizeMap.entries()) {
    aggregatedRows.push({ apertureMm, massRetainedKg: Number(massRetainedKg.toFixed(2)) });
  }

  // Sort descending by aperture (e.g. 300mm down to 4.75mm)
  aggregatedRows.sort((a, b) => b.apertureMm - a.apertureMm);
  const totalMass = Number(aggregatedRows.reduce((sum, r) => sum + r.massRetainedKg, 0).toFixed(2));

  return {
    rows: aggregatedRows,
    totalMassKg: totalMass,
  };
}

