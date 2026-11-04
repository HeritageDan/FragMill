import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface LosAngelesFractionConfig {
  fraction: string;
  numberOfBalls: number;
  numberOfRevolutions: number;
  nominalMassG: number;
}

export const LOS_ANGELES_FRACTIONS: Record<string, LosAngelesFractionConfig> = {
  '4/6.3': { fraction: '4/6.3', numberOfBalls: 7, numberOfRevolutions: 500, nominalMassG: 5000 },
  '6.3/10': { fraction: '6.3/10', numberOfBalls: 9, numberOfRevolutions: 500, nominalMassG: 5000 },
  '10/14': { fraction: '10/14', numberOfBalls: 11, numberOfRevolutions: 500, nominalMassG: 5000 },
  '10/25': { fraction: '10/25', numberOfBalls: 11, numberOfRevolutions: 500, nominalMassG: 5000 },
  '16/31.5': { fraction: '16/31.5', numberOfBalls: 12, numberOfRevolutions: 500, nominalMassG: 5000 },
  '25/50': { fraction: '25/50', numberOfBalls: 12, numberOfRevolutions: 1000, nominalMassG: 10000 },
};

export interface LosAngelesDeterminationInput {
  detIndex?: number;
  initialMassG: number; // M: initial dry mass (nominally 5000 g)
  retainedMassG: number; // m: dry mass retained on 1.6 mm sieve
}

export interface LosAngelesInput {
  fraction: '4/6.3' | '6.3/10' | '10/14' | '10/25' | '16/31.5' | '25/50';
  numberOfBalls?: number;
  numberOfRevolutions?: number;
  determinations: LosAngelesDeterminationInput[];
}

export interface LosAngelesDeterminationResult {
  detIndex: number;
  initialMassG: number;
  retainedMassG: number;
  passingMassG: number;
  laCoefficient: number; // LA = 100 * (M - m) / M
}

export interface LosAngelesResults {
  fraction: string;
  numberOfBalls: number;
  numberOfRevolutions: number;
  determinations: LosAngelesDeterminationResult[];
  meanLa: number;
  laCoefficient: number;
  laCategory?: string; // e.g. LA15, LA20, LA25, etc.
}

export const losAngelesTestDefinition: GeoLabTestDefinition<
  LosAngelesInput,
  LosAngelesResults
> = {
  id: 'los_angeles',
  name: {
    en: 'Los Angeles Resistance to Fragmentation (LA)',
    fr: 'Essai Los Angeles - Résistance à la Fragmentation (LA)',
  },
  shortName: {
    en: 'Los Angeles (LA)',
    fr: 'Los Angeles (LA)',
  },
  description: {
    en: 'Determination of resistance to fragmentation of coarse aggregates using the Los Angeles machine per NF EN 1097-2.',
    fr: 'Détermination de la résistance à la fragmentation des gravillons à la machine Los Angeles selon NF EN 1097-2.',
  },
  standards: [
    {
      id: 'NF EN 1097-2',
      code: 'NF EN 1097-2',
      standardBody: 'EN',
      title: {
        en: 'NF EN 1097-2: Tests for mechanical and physical properties of aggregates - Part 2: Methods for the determination of resistance to fragmentation',
        fr: 'NF EN 1097-2 : Essais pour déterminer les caractéristiques mécaniques et physiques des granulats - Partie 2 : Méthodes pour la détermination de la résistance à la fragmentation',
      },
    },
    {
      id: 'ASTM C131',
      code: 'ASTM C131',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM C131: Standard Test Method for Resistance to Degradation of Small-Size Coarse Aggregate by Abrasion and Impact in the Los Angeles Machine',
        fr: 'ASTM C131 : Méthode d\'essai normalisée de résistance à la dégradation des granulats à la machine Los Angeles',
      },
    },
  ],
  defaultStandard: 'NF EN 1097-2',
  inputSchema: {
    parameters: [
      {
        key: 'fraction',
        label: { en: 'Tested Fraction', fr: 'Fraction granulaire testée' },
        type: 'select',
        defaultValue: '10/14',
        required: true,
        options: [
          { value: '4/6.3', label: { en: '4/6.3 mm (7 balls, 500 rev)', fr: '4/6.3 mm (7 boulets, 500 tours)' } },
          { value: '6.3/10', label: { en: '6.3/10 mm (9 balls, 500 rev)', fr: '6.3/10 mm (9 boulets, 500 tours)' } },
          { value: '10/14', label: { en: '10/14 mm (11 balls, 500 rev)', fr: '10/14 mm (11 boulets, 500 tours)' } },
          { value: '10/25', label: { en: '10/25 mm (11 balls, 500 rev)', fr: '10/25 mm (11 boulets, 500 tours)' } },
          { value: '16/31.5', label: { en: '16/31.5 mm (12 balls, 500 rev)', fr: '16/31.5 mm (12 boulets, 500 tours)' } },
          { value: '25/50', label: { en: '25/50 mm (12 balls, 1000 rev)', fr: '25/50 mm (12 boulets, 1000 tours)' } },
        ],
      },
      {
        key: 'numberOfBalls',
        label: { en: 'Number of Steel Balls', fr: 'Nombre de boulets d\'acier' },
        type: 'number',
        helperText: {
          en: 'Default determined by standard for selected fraction',
          fr: 'Défini automatiquement selon la fraction choisie',
        },
      },
      {
        key: 'numberOfRevolutions',
        label: { en: 'Number of Revolutions', fr: 'Nombre de rotations' },
        type: 'number',
        defaultValue: 500,
      },
    ],
    table: {
      key: 'determinations',
      label: { en: 'Test Portions & Sieving', fr: 'Prises d\'essai et Tamisage' },
      minRows: 1,
      maxRows: 3,
      columns: [
        { key: 'detIndex', label: { en: 'Test #', fr: 'N° Prise' }, type: 'number', required: true },
        { key: 'initialMassG', label: { en: 'Initial Mass M (g)', fr: 'Masse initiale M (g)' }, unit: 'g', type: 'number', required: true, defaultValue: 5000, decimals: 1 },
        { key: 'retainedMassG', label: { en: 'Retained on 1.6mm m (g)', fr: 'Refus au tamis 1.6mm m (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
      ],
      defaultRows: [
        { detIndex: 1, initialMassG: 5000, retainedMassG: 4546 },
      ],
    },
  },

  calculate: (input: LosAngelesInput): LosAngelesResults => {
    const fractionKey = input.fraction || '10/14';
    const cfg = LOS_ANGELES_FRACTIONS[fractionKey] || LOS_ANGELES_FRACTIONS['10/14'];
    const nBalls = input.numberOfBalls ?? cfg.numberOfBalls;
    const nRevs = input.numberOfRevolutions ?? cfg.numberOfRevolutions;
    const raw = input.determinations || [];

    const computedDets: LosAngelesDeterminationResult[] = raw.map((d, idx) => {
      const M = d.initialMassG || 5000;
      const m = d.retainedMassG || 0;
      const passing = M - m;
      const la = M > 0 ? (100 * passing) / M : 0;
      return {
        detIndex: d.detIndex || idx + 1,
        initialMassG: Number(M.toFixed(1)),
        retainedMassG: Number(m.toFixed(1)),
        passingMassG: Number(passing.toFixed(1)),
        laCoefficient: Number(la.toFixed(2)),
      };
    });

    const laList = computedDets.map((d) => d.laCoefficient);
    const mean = laList.length > 0 ? laList.reduce((a, b) => a + b, 0) / laList.length : 0;
    const finalLa = Number(mean.toFixed(2));

    // Standard EN 13043 / EN 12620 category
    let category = 'LA_NR';
    if (finalLa <= 15) category = 'LA15';
    else if (finalLa <= 20) category = 'LA20';
    else if (finalLa <= 25) category = 'LA25';
    else if (finalLa <= 30) category = 'LA30';
    else if (finalLa <= 35) category = 'LA35';
    else if (finalLa <= 40) category = 'LA40';
    else if (finalLa <= 50) category = 'LA50';

    return {
      fraction: fractionKey,
      numberOfBalls: nBalls,
      numberOfRevolutions: nRevs,
      determinations: computedDets,
      meanLa: finalLa,
      laCoefficient: finalLa,
      laCategory: category,
    };
  },

  checks: (input: LosAngelesInput, results: LosAngelesResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    const cfg = LOS_ANGELES_FRACTIONS[input.fraction || '10/14'];

    for (const d of results.determinations) {
      const nominal = cfg ? cfg.nominalMassG : 5000;
      if (Math.abs(d.initialMassG - nominal) > 5) {
        warnings.push({
          code: 'LOS_ANGELES_INITIAL_MASS_DEVIATION',
          level: 'warning',
          message: {
            en: `Test #${d.detIndex}: Initial mass M = ${d.initialMassG}g deviates by more than 5g from standard requirement (${nominal} ± 5g).`,
            fr: `Prise #${d.detIndex} : La masse initiale M = ${d.initialMassG}g s'écarte de plus de 5g de l'exigence normative (${nominal} ± 5g).`,
          },
        });
      }
      if (d.retainedMassG > d.initialMassG) {
        warnings.push({
          code: 'LOS_ANGELES_RETAINED_GREATER_THAN_INITIAL',
          level: 'error',
          message: {
            en: `Test #${d.detIndex}: Retained mass m (${d.retainedMassG}g) cannot exceed initial mass M (${d.initialMassG}g).`,
            fr: `Prise #${d.detIndex} : Le refus au tamis m (${d.retainedMassG}g) ne peut pas dépasser la masse initiale M (${d.initialMassG}g).`,
          },
        });
      }
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Los Angeles Test Report', fr: 'Procès-Verbal d\'Essai Los Angeles' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Los Angeles Summary', fr: 'Synthèse Essai Los Angeles' } },
    {
      type: 'raw_data_table',
      title: { en: 'Test Charges & Retained Masses', fr: 'Charges d\'Essai et Masses des Refus' },
      tableColumns: [
        { key: 'detIndex', label: { en: 'Test #', fr: 'N° Prise' }, align: 'center' },
        { key: 'initialMassG', label: { en: 'Initial Mass M (g)', fr: 'Masse initiale M (g)' }, align: 'right', decimals: 1 },
        { key: 'retainedMassG', label: { en: 'Retained on 1.6mm m (g)', fr: 'Refus 1.6mm m (g)' }, align: 'right', decimals: 1 },
        { key: 'passingMassG', label: { en: 'Passing 1.6mm (g)', fr: 'Passant 1.6mm (g)' }, align: 'right', decimals: 1 },
        { key: 'laCoefficient', label: { en: 'LA (%)', fr: 'LA (%)' }, align: 'right', decimals: 2 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Conformity & Category', fr: 'Conformité et Catégorie' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: LosAngelesInput, results: LosAngelesResults) => ({
    testType: 'los_angeles',
    standard: 'NF EN 1097-2',
    laCoefficient: results.laCoefficient,
    fraction: results.fraction,
    category: results.laCategory,
    numberOfBalls: results.numberOfBalls,
    numberOfRevolutions: results.numberOfRevolutions,
  }),

  keyResults: (results: LosAngelesResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Coefficient Los Angeles (LA)' : 'Los Angeles Coefficient (LA)',
      value: results.laCoefficient !== undefined ? Number(results.laCoefficient.toFixed(1)) : '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Catégorie normative' : 'Standard Category',
      value: results.laCategory || '-',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Fraction testée' : 'Tested Fraction',
      value: results.fraction || '-',
      provenance: 'measured',
    },
  ],
};

