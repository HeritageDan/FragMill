import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface SieveRowInput {
  sieveMm: number;
  retainedMassG?: number;
  passingPercent?: number; // direct % passing (0 to 100)
  minSpecPercent?: number;
  maxSpecPercent?: number;
  afnorModule?: number;
}

export interface GrainSizeInput {
  initialDryMassG?: number; // Total dry mass before sieving (Ms)
  washedDryMassG?: number; // Dry mass retained after washing on 0.08 mm
  sieves: SieveRowInput[];
}

export interface SieveRowResult {
  sieveMm: number;
  retainedMassG: number;
  retainedPercent: number;
  cumulativeRetainedPercent: number;
  passingPercent: number;
  minSpecPercent?: number;
  maxSpecPercent?: number;
  afnorModule?: number;
  isConform?: boolean;
}

export interface GrainSizeResults {
  rows: SieveRowResult[];
  totalDryMassG: number;
  finesMassG: number;
  finesPercent: number; // passing 0.080 mm
  passing2mmPercent: number;
  passing04mmPercent: number;
  passing008mmPercent: number;
  gravelPercent: number; // > 2 mm
  sandPercent: number; // 0.08 - 2 mm
  d10Mm: number | null;
  d30Mm: number | null;
  d60Mm: number | null;
  cu: number | null; // Coefficient of uniformity: D60 / D10
  cc: number | null; // Coefficient of curvature: (D30^2) / (D10 * D60)
  lcpcClassification: string;
  uscsClassification: string;
  isConformEnvelope: boolean;
}

export const grainSizeTestDefinition: GeoLabTestDefinition<GrainSizeInput, GrainSizeResults> = {
  id: 'grain_size',
  name: {
    en: 'Particle Size Distribution by Sieving',
    fr: 'Analyse Granulométrique par Tamisage',
  },
  shortName: {
    en: 'Grain Size',
    fr: 'Granulométrie',
  },
  description: {
    en: 'Determination of particle size distribution of soils and aggregates by mechanical sieving (dry or after washing).',
    fr: 'Détermination de la granularité des sols et granulats par tamisage à sec ou après lavage.',
  },
  standards: [
    {
      id: 'NF P94-056',
      code: 'NF P94-056',
      standardBody: 'NF',
      title: {
        en: 'NF P94-056: Particle size analysis - Dry sieving method after washing',
        fr: 'NF P94-056 : Analyse granulométrique - Méthode par tamisage à sec après lavage',
      },
    },
    {
      id: 'ASTM D6913',
      code: 'ASTM D6913 / D422',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM D6913 / C136: Standard Test Method for Particle-Size Distribution of Soils Using Sieve Analysis',
        fr: 'ASTM D6913 / C136 : Méthode normalisée d\'analyse granulométrique par tamisage',
      },
    },
    {
      id: 'AASHTO T27',
      code: 'AASHTO T27',
      standardBody: 'AASHTO',
      title: {
        en: 'AASHTO T27: Sieve Analysis of Fine and Coarse Aggregates',
        fr: 'AASHTO T27 : Analyse par tamisage des granulats fins et grossiers',
      },
    },
  ],
  defaultStandard: 'NF P94-056',
  inputSchema: {
    parameters: [
      {
        key: 'initialDryMassG',
        label: { en: 'Total Dry Sample Mass (Ms)', fr: 'Masse sèche totale de l\'échantillon (Ms)' },
        type: 'number',
        unit: 'g',
        defaultValue: 2000,
        min: 100,
        max: 50000,
        helperText: {
          en: 'Required if entering retained masses per sieve',
          fr: 'Requis si saisie des masses refusées par tamis',
        },
      },
      {
        key: 'washedDryMassG',
        label: { en: 'Washed Dry Mass (>0.08mm)', fr: 'Masse sèche après lavage (>0.08mm)' },
        type: 'number',
        unit: 'g',
        min: 0,
        helperText: {
          en: 'Optional: mass retained after washing through 0.08mm sieve',
          fr: 'Optionnel : masse restante après lavage sur le tamis de 0,08mm',
        },
      },
    ],
    table: {
      key: 'sieves',
      label: { en: 'Sieve Stack & Measurements', fr: 'Colonne de tamis et Mesures' },
      minRows: 4,
      columns: [
        { key: 'sieveMm', label: { en: 'Aperture (mm)', fr: 'Maille (mm)' }, unit: 'mm', type: 'number', required: true, decimals: 3 },
        { key: 'passingPercent', label: { en: 'Passing (%)', fr: 'Passant (%)' }, unit: '%', type: 'number', decimals: 1 },
        { key: 'retainedMassG', label: { en: 'Retained Mass (g)', fr: 'Refus partiel (g)' }, unit: 'g', type: 'number', decimals: 1 },
        { key: 'minSpecPercent', label: { en: 'Min Spec (%)', fr: 'Fuseau Min (%)' }, unit: '%', type: 'number', decimals: 1 },
        { key: 'maxSpecPercent', label: { en: 'Max Spec (%)', fr: 'Fuseau Max (%)' }, unit: '%', type: 'number', decimals: 1 },
      ],
      defaultRows: [
        { sieveMm: 25, passingPercent: 100 },
        { sieveMm: 20, passingPercent: 100 },
        { sieveMm: 16, passingPercent: 100 },
        { sieveMm: 12.5, passingPercent: 100 },
        { sieveMm: 10, passingPercent: 100 },
        { sieveMm: 5, passingPercent: 100 },
        { sieveMm: 2, passingPercent: 97.2 },
        { sieveMm: 1, passingPercent: 82.2 },
        { sieveMm: 0.5, passingPercent: 48.4 },
        { sieveMm: 0.4, passingPercent: 44.0 },
        { sieveMm: 0.315, passingPercent: 40.0 },
        { sieveMm: 0.2, passingPercent: 27.0 },
        { sieveMm: 0.08, passingPercent: 0.3 },
      ],
    },
  },

  calculate: (input: GrainSizeInput): GrainSizeResults => {
    const rawSieves = (input.sieves || []).slice();

    // Sort sieves descending by aperture
    rawSieves.sort((a, b) => b.sieveMm - a.sieveMm);

    // Determine total dry mass
    const sumRetained = rawSieves.reduce((acc, s) => acc + (s.retainedMassG || 0), 0);
    const totalDryMassG = input.initialDryMassG && input.initialDryMassG > 0
      ? input.initialDryMassG
      : (sumRetained > 0 ? sumRetained : 100);

    // Detect if passing values are passed as decimal fractions (e.g. 0.972 for 97.2%, max <= 1.0)
    const hasPassing = rawSieves.some((s) => s.passingPercent !== undefined && s.passingPercent !== null);
    const maxPassing = hasPassing
      ? Math.max(...rawSieves.map((s) => s.passingPercent ?? 0))
      : 0;
    const isFractional = maxPassing > 0 && maxPassing <= 1.0;

    let cumRetainedMass = 0;
    const computedRows: SieveRowResult[] = [];
    let isConformEnvelope = true;

    for (const s of rawSieves) {
      let passPct: number;
      let retMass = s.retainedMassG || 0;
      let retPct = 0;

      if (s.passingPercent !== undefined && s.passingPercent !== null) {
        passPct = isFractional ? s.passingPercent * 100 : s.passingPercent;
        const cumRetPct = Math.max(0, 100 - passPct);
        retPct = Math.max(0, cumRetPct - (computedRows.length > 0 ? computedRows[computedRows.length - 1].cumulativeRetainedPercent : 0));
        retMass = (retPct / 100) * totalDryMassG;
        cumRetainedMass += retMass;
      } else {
        retPct = totalDryMassG > 0 ? (retMass / totalDryMassG) * 100 : 0;
        cumRetainedMass += retMass;
        const cumRetPct = totalDryMassG > 0 ? (cumRetainedMass / totalDryMassG) * 100 : 0;
        passPct = Math.max(0, 100 - cumRetPct);
      }

      let isConform: boolean | undefined = undefined;
      if (s.minSpecPercent !== undefined || s.maxSpecPercent !== undefined) {
        const minOk = s.minSpecPercent === undefined || passPct >= s.minSpecPercent - 0.1;
        const maxOk = s.maxSpecPercent === undefined || passPct <= s.maxSpecPercent + 0.1;
        isConform = minOk && maxOk;
        if (!isConform) isConformEnvelope = false;
      }

      computedRows.push({
        sieveMm: s.sieveMm,
        retainedMassG: Number(retMass.toFixed(1)),
        retainedPercent: Number(retPct.toFixed(2)),
        cumulativeRetainedPercent: Number((100 - passPct).toFixed(2)),
        passingPercent: Number(passPct.toFixed(2)),
        minSpecPercent: s.minSpecPercent,
        maxSpecPercent: s.maxSpecPercent,
        afnorModule: s.afnorModule || (s.sieveMm > 0 ? Math.round(10 * Math.log10(s.sieveMm / 0.001) + 1) : undefined),
        isConform,
      });
    }

    // Interpolate specific passing values
    const interpolatePassing = (targetMm: number): number => {
      if (computedRows.length === 0) return 0;
      const exact = computedRows.find((r) => Math.abs(r.sieveMm - targetMm) < 0.001);
      if (exact) return exact.passingPercent;

      // Find surrounding sieves
      let d1 = computedRows[0];
      let d2 = computedRows[computedRows.length - 1];

      if (targetMm >= d1.sieveMm) return d1.passingPercent;
      if (targetMm <= d2.sieveMm) return d2.passingPercent;

      for (let i = 0; i < computedRows.length - 1; i++) {
        const upper = computedRows[i];
        const lower = computedRows[i + 1];
        if (targetMm <= upper.sieveMm && targetMm >= lower.sieveMm) {
          const logTarget = Math.log10(targetMm);
          const logUpper = Math.log10(upper.sieveMm);
          const logLower = Math.log10(lower.sieveMm);
          const fraction = (logTarget - logLower) / (logUpper - logLower);
          return lower.passingPercent + fraction * (upper.passingPercent - lower.passingPercent);
        }
      }
      return 0;
    };

    const passing2mmPercent = Number(interpolatePassing(2.0).toFixed(1));
    const passing04mmPercent = Number(interpolatePassing(0.4).toFixed(1));
    const passing008mmPercent = Number(interpolatePassing(0.08).toFixed(1));

    const gravelPercent = Number(Math.max(0, 100 - passing2mmPercent).toFixed(1));
    const sandPercent = Number(Math.max(0, passing2mmPercent - passing008mmPercent).toFixed(1));
    const finesPercent = Number(passing008mmPercent.toFixed(1));
    const finesMassG = Number(((finesPercent / 100) * totalDryMassG).toFixed(1));

    // Interpolate Dx by log-linear interpolation
    const interpolateDx = (targetPercent: number): number | null => {
      if (computedRows.length < 2) return null;
      // Filter distinct passing points sorted ascending by passing percent
      const validPoints = computedRows
        .filter((r) => r.sieveMm > 0)
        .slice()
        .sort((a, b) => a.passingPercent - b.passingPercent);

      const minPass = validPoints[0].passingPercent;
      const maxPass = validPoints[validPoints.length - 1].passingPercent;

      if (targetPercent < minPass || targetPercent > maxPass) {
        return null;
      }

      for (let i = 0; i < validPoints.length - 1; i++) {
        const p1 = validPoints[i];
        const p2 = validPoints[i + 1];
        if (targetPercent >= p1.passingPercent && targetPercent <= p2.passingPercent) {
          if (Math.abs(p2.passingPercent - p1.passingPercent) < 1e-6) {
            return p1.sieveMm;
          }
          const frac = (targetPercent - p1.passingPercent) / (p2.passingPercent - p1.passingPercent);
          const logD = Math.log10(p1.sieveMm) + frac * (Math.log10(p2.sieveMm) - Math.log10(p1.sieveMm));
          return Number((10 ** logD).toFixed(3));
        }
      }
      return null;
    };

    const d10Mm = interpolateDx(10);
    const d30Mm = interpolateDx(30);
    const d60Mm = interpolateDx(60);

    const cu = d10Mm && d60Mm && d10Mm > 0 ? Number((d60Mm / d10Mm).toFixed(2)) : null;
    const cc = d10Mm && d30Mm && d60Mm && d10Mm * d60Mm > 0
      ? Number(((d30Mm * d30Mm) / (d10Mm * d60Mm)).toFixed(2))
      : null;

    // Soil classification heuristics (LCPC & USCS)
    let lcpcClassification = 'Sol non déterminé';
    let uscsClassification = 'Undetermined';

    if (finesPercent < 5) {
      if (gravelPercent > sandPercent) {
        if (cu && cc && cu > 4 && cc >= 1 && cc <= 3) {
          lcpcClassification = 'Gb (Grave propre bien graduée)';
          uscsClassification = 'GW (Well-graded gravel)';
        } else {
          lcpcClassification = 'Gm (Grave propre mal graduée)';
          uscsClassification = 'GP (Poorly-graded gravel)';
        }
      } else {
        if (cu && cc && cu > 6 && cc >= 1 && cc <= 3) {
          lcpcClassification = 'Sb (Sable propre bien gradué)';
          uscsClassification = 'SW (Well-graded sand)';
        } else {
          lcpcClassification = 'Sm (Sable propre mal gradué)';
          uscsClassification = 'SP (Poorly-graded sand)';
        }
      }
    } else if (finesPercent < 12) {
      lcpcClassification = gravelPercent > sandPercent ? 'Grave avec fines' : 'Sable avec fines';
      uscsClassification = gravelPercent > sandPercent ? 'GP-GM / GW-GM' : 'SP-SM / SW-SM';
    } else if (finesPercent < 50) {
      lcpcClassification = gravelPercent > sandPercent ? 'GL/GA (Grave limoneuse ou argileuse)' : 'SL/SA (Sable limoneux ou argileux)';
      uscsClassification = gravelPercent > sandPercent ? 'GM / GC' : 'SM / SC';
    } else {
      lcpcClassification = 'Sol fin (Limon ou Argile)';
      uscsClassification = 'Fine-grained soil (ML/CL/MH/CH)';
    }

    return {
      rows: computedRows,
      totalDryMassG: Number(totalDryMassG.toFixed(1)),
      finesMassG,
      finesPercent,
      passing2mmPercent,
      passing04mmPercent,
      passing008mmPercent,
      gravelPercent,
      sandPercent,
      d10Mm,
      d30Mm,
      d60Mm,
      cu,
      cc,
      lcpcClassification,
      uscsClassification,
      isConformEnvelope,
    };
  },

  checks: (input: GrainSizeInput, results: GrainSizeResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    const rows = results.rows || [];

    if (rows.length < 4) {
      warnings.push({
        code: 'GRAIN_SIZE_TOO_FEW_SIEVES',
        level: 'warning',
        message: {
          en: `Only ${rows.length} sieves specified. Standard grading curves typically require at least 6 to 10 sieves.`,
          fr: `Seulement ${rows.length} tamis renseignés. Une courbe granulométrique nécessite au moins 6 à 10 tamis.`,
        },
      });
    }

    // Check non-monotonic cumulative passing
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i + 1].passingPercent > rows[i].passingPercent + 0.1) {
        warnings.push({
          code: 'GRAIN_SIZE_NON_MONOTONIC',
          level: 'error',
          message: {
            en: `Non-monotonic passing percentage: sieve ${rows[i + 1].sieveMm}mm (${rows[i + 1].passingPercent}%) is greater than sieve ${rows[i].sieveMm}mm (${rows[i].passingPercent}%).`,
            fr: `Passants non monotones : le tamis ${rows[i + 1].sieveMm}mm (${rows[i + 1].passingPercent}%) a un passant supérieur au tamis ${rows[i].sieveMm}mm (${rows[i].passingPercent}%).`,
          },
        });
        break;
      }
    }

    // Mass recovery check if initialDryMass is given
    if (input.initialDryMassG && input.initialDryMassG > 0) {
      const sumRetained = rows.reduce((acc, r) => acc + r.retainedMassG, 0);
      const diffPct = Math.abs(sumRetained - input.initialDryMassG) / input.initialDryMassG * 100;
      if (diffPct > 1.0) {
        warnings.push({
          code: 'GRAIN_SIZE_MASS_LOSS',
          level: 'warning',
          message: {
            en: `Mass loss during sieving exceeds standard tolerance: ${diffPct.toFixed(2)}% (limit: 1.0% per NF P94-056).`,
            fr: `La perte de masse au tamisage dépasse la tolérance normative : ${diffPct.toFixed(2)}% (limite : 1,0% selon NF P94-056).`,
          },
        });
      }
    }

    if (!results.isConformEnvelope) {
      warnings.push({
        code: 'GRAIN_SIZE_OUT_OF_ENVELOPE',
        level: 'warning',
        message: {
          en: 'Particle size curve deviates from specified project grading envelope at one or more sieves.',
          fr: 'La courbe granulométrique sort du fuseau de spécification sur un ou plusieurs tamis.',
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Particle Size Distribution Report', fr: 'Procès-Verbal d\'Analyse Granulométrique' } },
    { type: 'client_project' },
    {
      type: 'results_table',
      title: { en: 'Characteristic Diameters & Coefficients', fr: 'Diamètres Caractéristiques et Coefficients' },
    },
    {
      type: 'chart',
      title: { en: 'Grading Curve (Semi-log)', fr: 'Courbe Granulométrique (Échelle semi-logarithmique)' },
      chartConfig: {
        chartType: 'scatter',
        title: { en: 'Particle Size Distribution', fr: 'Courbe Granulométrique' },
        xLabel: { en: 'Sieve Aperture d (mm)', fr: 'Dimension des mailles d (mm)' },
        yLabel: { en: 'Cumulative Passing P (%)', fr: 'Passant cumulé P (%)' },
        xLog: true,
        xMin: 0.05,
        xMax: 100,
        yMin: 0,
        yMax: 100,
        series: [
          {
            name: { en: 'Grading Curve', fr: 'Courbe d\'essai' },
            xKey: 'sieveMm',
            yKey: 'passingPercent',
            color: '#1e40af',
            marker: 'circle',
            lineStyle: 'solid',
          },
          {
            name: { en: 'Min Envelope', fr: 'Fuseau Min' },
            xKey: 'sieveMm',
            yKey: 'minSpecPercent',
            color: '#9ca3af',
            lineStyle: 'dashed',
            marker: 'none',
          },
          {
            name: { en: 'Max Envelope', fr: 'Fuseau Max' },
            xKey: 'sieveMm',
            yKey: 'maxSpecPercent',
            color: '#9ca3af',
            lineStyle: 'dashed',
            marker: 'none',
          },
        ],
      },
    },
    {
      type: 'raw_data_table',
      title: { en: 'Sieve Analysis Table', fr: 'Tableau de Tamisage' },
      tableColumns: [
        { key: 'sieveMm', label: { en: 'Sieve (mm)', fr: 'Tamis (mm)' }, align: 'right', decimals: 3 },
        { key: 'retainedMassG', label: { en: 'Retained Mass (g)', fr: 'Refus partiel (g)' }, align: 'right', decimals: 1 },
        { key: 'retainedPercent', label: { en: 'Retained (%)', fr: 'Refus partiel (%)' }, align: 'right', decimals: 2 },
        { key: 'cumulativeRetainedPercent', label: { en: 'Cum. Retained (%)', fr: 'Refus cumulé (%)' }, align: 'right', decimals: 2 },
        { key: 'passingPercent', label: { en: 'Cumulative Passing (%)', fr: 'Passant cumulé (%)' }, align: 'right', decimals: 2 },
        { key: 'minSpecPercent', label: { en: 'Min Spec (%)', fr: 'Fuseau Min (%)' }, align: 'right', decimals: 1 },
        { key: 'maxSpecPercent', label: { en: 'Max Spec (%)', fr: 'Fuseau Max (%)' }, align: 'right', decimals: 1 },
      ],
    },
    {
      type: 'conformity_table',
      title: { en: 'Soil Classification & Conformity', fr: 'Classification et Conformité du Sol' },
    },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: GrainSizeInput, results: GrainSizeResults) => ({
    testType: 'grain_size',
    standard: 'NF P94-056 / ASTM D6913',
    passing2mm: results.passing2mmPercent,
    passing04mm: results.passing04mmPercent,
    passing008mm: results.passing008mmPercent,
    gravelPercent: results.gravelPercent,
    sandPercent: results.sandPercent,
    finesPercent: results.finesPercent,
    d10: results.d10Mm,
    d30: results.d30Mm,
    d60: results.d60Mm,
    cu: results.cu,
    cc: results.cc,
    lcpcClassification: results.lcpcClassification,
    uscsClassification: results.uscsClassification,
    isConformEnvelope: results.isConformEnvelope,
  }),

  keyResults: (results: GrainSizeResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Diamètre effectif (D60)' : 'Effective Diameter (D60)',
      value: results.d60Mm ?? '-',
      unit: 'mm',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Passant à 2 mm (Sable)' : 'Passing 2 mm (Sand)',
      value: results.passing2mmPercent ?? '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Passant à 0,08 mm (Fines)' : 'Passing 0.08 mm (Fines)',
      value: results.passing008mmPercent ?? '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Classification LCPC' : 'LCPC Classification',
      value: results.lcpcClassification ?? '-',
      provenance: 'measured',
    },
  ],
};
