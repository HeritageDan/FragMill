import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface MicroDevalFractionConfig {
  fraction: string;
  ballChargeG: number;
  waterVolumeL: number;
  numberOfRevolutions: number;
  nominalMassG: number;
}

export const MICRO_DEVAL_FRACTIONS: Record<string, MicroDevalFractionConfig> = {
  '4/6.3': { fraction: '4/6.3', ballChargeG: 2000, waterVolumeL: 2.5, numberOfRevolutions: 12000, nominalMassG: 500 },
  '6.3/10': { fraction: '6.3/10', ballChargeG: 4000, waterVolumeL: 2.5, numberOfRevolutions: 12000, nominalMassG: 500 },
  '10/14': { fraction: '10/14', ballChargeG: 5000, waterVolumeL: 2.5, numberOfRevolutions: 12000, nominalMassG: 500 },
};

export interface MicroDevalDeterminationInput {
  detIndex?: number;
  initialMassG: number; // M: nominally 500 g
  retainedMassG: number; // m: dry mass retained on 1.6 mm sieve
}

export interface MicroDevalInput {
  fraction: '4/6.3' | '6.3/10' | '10/14';
  ballChargeG?: number;
  waterVolumeL?: number;
  numberOfRevolutions?: number;
  determinations: MicroDevalDeterminationInput[];
}

export interface MicroDevalDeterminationResult {
  detIndex: number;
  initialMassG: number;
  retainedMassG: number;
  passingMassG: number;
  mdeCoefficient: number; // MDE = 100 * (M - m) / M
}

export interface MicroDevalResults {
  fraction: string;
  ballChargeG: number;
  waterVolumeL: number;
  numberOfRevolutions: number;
  determinations: MicroDevalDeterminationResult[];
  meanMde: number;
  mdeCoefficient: number;
  mdeCategory?: string; // MDE10, MDE15, MDE20, MDE25, MDE35, etc.
}

export const microDevalTestDefinition: GeoLabTestDefinition<
  MicroDevalInput,
  MicroDevalResults
> = {
  id: 'micro_deval',
  name: {
    en: 'Micro-Deval Resistance to Wear (MDE)',
    fr: 'Essai Micro-Deval - Résistance à l\'Usure (MDE)',
  },
  shortName: {
    en: 'Micro-Deval (MDE)',
    fr: 'Micro-Deval (MDE)',
  },
  description: {
    en: 'Determination of resistance to wear of coarse aggregates in the presence of water (wet method) per NF EN 1097-1.',
    fr: 'Détermination de la résistance à l\'usure des gravillons en présence d\'eau (voie humide) selon NF EN 1097-1.',
  },
  standards: [
    {
      id: 'NF EN 1097-1',
      code: 'NF EN 1097-1',
      standardBody: 'EN',
      title: {
        en: 'NF EN 1097-1: Tests for mechanical and physical properties of aggregates - Part 1: Determination of the resistance to wear (micro-Deval)',
        fr: 'NF EN 1097-1 : Essais pour déterminer les caractéristiques mécaniques et physiques des granulats - Partie 1 : Détermination de la résistance à l\'usure (micro-Deval)',
      },
    },
  ],
  defaultStandard: 'NF EN 1097-1',
  inputSchema: {
    parameters: [
      {
        key: 'fraction',
        label: { en: 'Tested Fraction', fr: 'Fraction granulaire' },
        type: 'select',
        defaultValue: '10/14',
        required: true,
        options: [
          { value: '4/6.3', label: { en: '4/6.3 mm (charge 2000g, 12000 rev)', fr: '4/6.3 mm (charge 2000g, 12000 tours)' } },
          { value: '6.3/10', label: { en: '6.3/10 mm (charge 4000g, 12000 rev)', fr: '6.3/10 mm (charge 4000g, 12000 tours)' } },
          { value: '10/14', label: { en: '10/14 mm (charge 5000g, 12000 rev)', fr: '10/14 mm (charge 5000g, 12000 tours)' } },
        ],
      },
      {
        key: 'ballChargeG',
        label: { en: 'Steel Ball Charge (g)', fr: 'Charge de boulets (g)' },
        type: 'number',
        defaultValue: 5000,
        unit: 'g',
      },
      {
        key: 'waterVolumeL',
        label: { en: 'Water Volume (L)', fr: 'Volume d\'eau (L)' },
        type: 'number',
        defaultValue: 2.5,
        unit: 'L',
      },
      {
        key: 'numberOfRevolutions',
        label: { en: 'Number of Revolutions', fr: 'Nombre de rotations' },
        type: 'number',
        defaultValue: 12000,
      },
    ],
    table: {
      key: 'determinations',
      label: { en: 'Test Portions & Retained Masses', fr: 'Prises d\'essai et Masses Refus' },
      minRows: 1,
      maxRows: 3,
      columns: [
        { key: 'detIndex', label: { en: 'Det #', fr: 'N° Prise' }, type: 'number', required: true },
        { key: 'initialMassG', label: { en: 'Initial Mass M (g)', fr: 'Masse initiale M (g)' }, unit: 'g', type: 'number', required: true, defaultValue: 500, decimals: 1 },
        { key: 'retainedMassG', label: { en: 'Retained on 1.6mm m (g)', fr: 'Refus au tamis 1.6mm m (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
      ],
      defaultRows: [
        { detIndex: 1, initialMassG: 500, retainedMassG: 410 },
      ],
    },
  },

  calculate: (input: MicroDevalInput): MicroDevalResults => {
    const fractionKey = input.fraction || '10/14';
    const cfg = MICRO_DEVAL_FRACTIONS[fractionKey] || MICRO_DEVAL_FRACTIONS['10/14'];
    const charge = input.ballChargeG ?? cfg.ballChargeG;
    const water = input.waterVolumeL ?? cfg.waterVolumeL;
    const revs = input.numberOfRevolutions ?? cfg.numberOfRevolutions;
    const raw = input.determinations || [];

    const computedDets: MicroDevalDeterminationResult[] = raw.map((d, idx) => {
      const M = d.initialMassG || 500;
      const m = d.retainedMassG || 0;
      const passing = M - m;
      const mde = M > 0 ? (100 * passing) / M : 0;
      return {
        detIndex: d.detIndex || idx + 1,
        initialMassG: Number(M.toFixed(1)),
        retainedMassG: Number(m.toFixed(1)),
        passingMassG: Number(passing.toFixed(1)),
        mdeCoefficient: Number(mde.toFixed(2)),
      };
    });

    const mdeList = computedDets.map((d) => d.mdeCoefficient);
    const mean = mdeList.length > 0 ? mdeList.reduce((a, b) => a + b, 0) / mdeList.length : 0;
    const finalMde = Number(mean.toFixed(2));

    // Category per EN 13043 / EN 12620
    let category = 'MDE_NR';
    if (finalMde <= 10) category = 'MDE10';
    else if (finalMde <= 15) category = 'MDE15';
    else if (finalMde <= 20) category = 'MDE20';
    else if (finalMde <= 25) category = 'MDE25';
    else if (finalMde <= 35) category = 'MDE35';

    return {
      fraction: fractionKey,
      ballChargeG: charge,
      waterVolumeL: water,
      numberOfRevolutions: revs,
      determinations: computedDets,
      meanMde: finalMde,
      mdeCoefficient: finalMde,
      mdeCategory: category,
    };
  },

  checks: (input: MicroDevalInput, results: MicroDevalResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];

    for (const d of results.determinations) {
      if (Math.abs(d.initialMassG - 500) > 2) {
        warnings.push({
          code: 'MICRO_DEVAL_INITIAL_MASS_DEVIATION',
          level: 'warning',
          message: {
            en: `Test #${d.detIndex}: Initial mass M = ${d.initialMassG}g deviates by more than 2g from standard requirement (500 ± 2g).`,
            fr: `Prise #${d.detIndex} : La masse initiale M = ${d.initialMassG}g s'écarte de plus de 2g de l'exigence normative (500 ± 2g).`,
          },
        });
      }
      if (d.retainedMassG > d.initialMassG) {
        warnings.push({
          code: 'MICRO_DEVAL_RETAINED_GREATER_THAN_INITIAL',
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
    { type: 'header', title: { en: 'Micro-Deval Test Report', fr: 'Procès-Verbal d\'Essai Micro-Deval' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Micro-Deval Summary', fr: 'Synthèse Essai Micro-Deval' } },
    {
      type: 'raw_data_table',
      title: { en: 'Test Portions & Sieving', fr: 'Prises d\'Essai et Tamisage' },
      tableColumns: [
        { key: 'detIndex', label: { en: 'Det #', fr: 'N° Prise' }, align: 'center' },
        { key: 'initialMassG', label: { en: 'Initial Mass M (g)', fr: 'Masse initiale M (g)' }, align: 'right', decimals: 1 },
        { key: 'retainedMassG', label: { en: 'Retained 1.6mm m (g)', fr: 'Refus 1.6mm m (g)' }, align: 'right', decimals: 1 },
        { key: 'passingMassG', label: { en: 'Passing 1.6mm (g)', fr: 'Passant 1.6mm (g)' }, align: 'right', decimals: 1 },
        { key: 'mdeCoefficient', label: { en: 'MDE (%)', fr: 'MDE (%)' }, align: 'right', decimals: 2 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Conformity & Classification', fr: 'Conformité et Classification' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: MicroDevalInput, results: MicroDevalResults) => ({
    testType: 'micro_deval',
    standard: 'NF EN 1097-1',
    mdeCoefficient: results.mdeCoefficient,
    fraction: results.fraction,
    category: results.mdeCategory,
    ballChargeG: results.ballChargeG,
    numberOfRevolutions: results.numberOfRevolutions,
  }),

  keyResults: (results: MicroDevalResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Coefficient Micro-Deval (MDE)' : 'Micro-Deval Coefficient (MDE)',
      value: results.mdeCoefficient !== undefined ? Number(results.mdeCoefficient.toFixed(1)) : '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Catégorie normative' : 'Standard Category',
      value: results.mdeCategory || '-',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Fraction testée' : 'Tested Fraction',
      value: results.fraction || '-',
      provenance: 'measured',
    },
  ],
};
