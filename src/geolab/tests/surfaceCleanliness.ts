import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface SurfaceCleanlinessDeterminationInput {
  detId?: string;
  initialDryMassMsG: number; // Ms: initial dry mass before washing (g)
  retainedMassAfterWashingMPrimeG: number; // m': dry mass retained on 0.5 mm sieve after washing (g)
}

export interface SurfaceCleanlinessInput {
  fraction?: string; // e.g. '6.3/10', '10/14'
  determinations: SurfaceCleanlinessDeterminationInput[];
}

export interface SurfaceCleanlinessDeterminationResult {
  detId: string;
  initialDryMassMsG: number;
  retainedMassAfterWashingMPrimeG: number;
  finesMassLostMG: number; // m = Ms - m'
  cleanlinessPercentageP: number; // P = 100 * m / Ms
}

export interface SurfaceCleanlinessResults {
  determinations: SurfaceCleanlinessDeterminationResult[];
  meanCleanlinessPercentageP: number;
  fraction?: string;
  cleanlinessCategory?: string; // P0.5, P1, P1.5, etc.
}

export const surfaceCleanlinessTestDefinition: GeoLabTestDefinition<
  SurfaceCleanlinessInput,
  SurfaceCleanlinessResults
> = {
  id: 'surface_cleanliness',
  name: {
    en: 'Surface Cleanliness of Coarse Aggregates (P)',
    fr: 'Propreté Superficielle des Gravillons (P)',
  },
  shortName: {
    en: 'Surface Cleanliness',
    fr: 'Propreté Superficielle',
  },
  description: {
    en: 'Determination of superficial dust and adhering fines on coarse aggregates by washing on 0.5 mm sieve per NF P18-591 / NF P18-592.',
    fr: 'Détermination du pourcentage de particules très fines et poussières superficielles adhérant aux gravillons par lavage sur tamis 0,5 mm selon NF P18-591 / NF P18-592.',
  },
  standards: [
    {
      id: 'NF P18-591',
      code: 'NF P18-591',
      standardBody: 'NF',
      title: {
        en: 'NF P18-591: Aggregates - Measurement of surface cleanliness of gravels',
        fr: 'NF P18-591 : Granulats - Mesure de la propreté superficielle des gravillons',
      },
    },
    {
      id: 'NF P18-592',
      code: 'NF P18-592',
      standardBody: 'NF',
      title: {
        en: 'NF P18-592: Aggregates - Measurement of surface cleanliness of gravels (rapid method)',
        fr: 'NF P18-592 : Granulats - Mesure de la propreté superficielle des gravillons (méthode rapide)',
      },
    },
  ],
  defaultStandard: 'NF P18-591',
  inputSchema: {
    parameters: [
      {
        key: 'fraction',
        label: { en: 'Tested Fraction', fr: 'Fraction granulaire' },
        type: 'text',
        defaultValue: '10/14',
        helperText: {
          en: 'e.g. 6.3/10, 10/14 mm',
          fr: 'ex. 6.3/10, 10/14 mm',
        },
      },
    ],
    table: {
      key: 'determinations',
      label: { en: 'Weighings on 0.5 mm Sieve', fr: 'Pesées et Lavage sur Tamis 0,5 mm' },
      minRows: 1,
      maxRows: 4,
      columns: [
        { key: 'detId', label: { en: 'Det #', fr: 'N° Essai' }, type: 'text', required: true },
        { key: 'initialDryMassMsG', label: { en: 'Initial Dry Mass Ms (g)', fr: 'Masse sèche initiale Ms (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
        { key: 'retainedMassAfterWashingMPrimeG', label: { en: 'Retained on 0.5mm m\' (g)', fr: 'Refus 0,5mm m\' (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
      ],
      defaultRows: [
        { detId: '1', initialDryMassMsG: 766.4, retainedMassAfterWashingMPrimeG: 763.4 },
        { detId: '2', initialDryMassMsG: 635.8, retainedMassAfterWashingMPrimeG: 632.6 },
      ],
    },
  },

  calculate: (input: SurfaceCleanlinessInput): SurfaceCleanlinessResults => {
    const raw = input.determinations || [];

    const computedDets: SurfaceCleanlinessDeterminationResult[] = raw.map((d, idx) => {
      const ms = d.initialDryMassMsG || 0;
      const mPrime = d.retainedMassAfterWashingMPrimeG || 0;
      const m = ms - mPrime;
      const p = ms > 0 ? (100 * m) / ms : 0;

      return {
        detId: d.detId || String(idx + 1),
        initialDryMassMsG: Number(ms.toFixed(1)),
        retainedMassAfterWashingMPrimeG: Number(mPrime.toFixed(1)),
        finesMassLostMG: Number(m.toFixed(1)),
        cleanlinessPercentageP: Number(p.toFixed(2)),
      };
    });

    const pList = computedDets.map((d) => d.cleanlinessPercentageP);
    const mean = pList.length > 0 ? pList.reduce((a, b) => a + b, 0) / pList.length : 0;
    const finalP = Number(mean.toFixed(2));

    // Category per French aggregate standards (P < 0.5%, P < 1%, etc.)
    let cat = 'P_NR';
    if (finalP <= 0.5) cat = 'P0.5';
    else if (finalP <= 1.0) cat = 'P1.0';
    else if (finalP <= 1.5) cat = 'P1.5';
    else if (finalP <= 2.0) cat = 'P2.0';

    return {
      determinations: computedDets,
      meanCleanlinessPercentageP: finalP,
      fraction: input.fraction,
      cleanlinessCategory: cat,
    };
  },

  checks: (input: SurfaceCleanlinessInput, results: SurfaceCleanlinessResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];

    for (const d of results.determinations) {
      if (d.retainedMassAfterWashingMPrimeG > d.initialDryMassMsG) {
        warnings.push({
          code: 'SURFACE_CLEANLINESS_RETAINED_EXCEEDS_INITIAL',
          level: 'error',
          message: {
            en: `Determination #${d.detId}: Retained mass after washing m' (${d.retainedMassAfterWashingMPrimeG}g) cannot exceed initial mass Ms (${d.initialDryMassMsG}g).`,
            fr: `Détermination #${d.detId} : La masse lavée m' (${d.retainedMassAfterWashingMPrimeG}g) ne peut pas dépasser la masse initiale Ms (${d.initialDryMassMsG}g).`,
          },
        });
      }
    }

    if (results.meanCleanlinessPercentageP > 2.0) {
      warnings.push({
        code: 'SURFACE_CLEANLINESS_HIGH_POLLUTION',
        level: 'warning',
        message: {
          en: `Surface cleanliness P = ${results.meanCleanlinessPercentageP.toFixed(2)}% is high (> 2.0%). Granular washing may be required before use in concrete or asphalt.`,
          fr: `La propreté superficielle P = ${results.meanCleanlinessPercentageP.toFixed(2)}% est élevée (> 2,0%). Un débourbage / lavage peut être requis.`,
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Surface Cleanliness Test Report', fr: 'Procès-Verbal de Propreté Superficielle' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Surface Cleanliness Summary', fr: 'Synthèse de Propreté Superficielle' } },
    {
      type: 'raw_data_table',
      title: { en: 'Washing on 0.5 mm Sieve Measurements', fr: 'Mesures de Lavage sur Tamis 0,5 mm' },
      tableColumns: [
        { key: 'detId', label: { en: 'Det #', fr: 'N° Essai' }, align: 'center' },
        { key: 'initialDryMassMsG', label: { en: 'Initial Mass Ms (g)', fr: 'Masse initiale Ms (g)' }, align: 'right', decimals: 1 },
        { key: 'retainedMassAfterWashingMPrimeG', label: { en: 'Retained on 0.5mm m\' (g)', fr: 'Refus 0,5mm m\' (g)' }, align: 'right', decimals: 1 },
        { key: 'finesMassLostMG', label: { en: 'Fines Mass m (g)', fr: 'Masse des fines m (g)' }, align: 'right', decimals: 1 },
        { key: 'cleanlinessPercentageP', label: { en: 'Cleanliness P (%)', fr: 'Propreté P (%)' }, align: 'right', decimals: 2 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Specification & Category', fr: 'Spécification et Catégorie' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: SurfaceCleanlinessInput, results: SurfaceCleanlinessResults) => ({
    testType: 'surface_cleanliness',
    standard: 'NF P18-591',
    cleanlinessP: results.meanCleanlinessPercentageP,
    category: results.cleanlinessCategory,
    fraction: results.fraction,
    numberOfDeterminations: results.determinations.length,
  }),

  keyResults: (results: SurfaceCleanlinessResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Propreté superficielle (P)' : 'Surface Cleanliness (P)',
      value: results.meanCleanlinessPercentageP !== undefined ? Number(results.meanCleanlinessPercentageP.toFixed(2)) : '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Catégorie normative' : 'Standard Category',
      value: results.cleanlinessCategory || '-',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Fraction testée' : 'Tested Fraction',
      value: results.fraction || '-',
      provenance: 'measured',
    },
  ],
};
