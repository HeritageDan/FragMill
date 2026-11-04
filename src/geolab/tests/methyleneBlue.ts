import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface MethyleneBlueInput {
  mode: 'soils' | 'aggregate_fines';
  fractionTested?: string; // e.g. '0/50 mm' (0/5 mm fraction), '0/2 mm'
  sampleDryMassG: number; // m0 for soils (e.g. 30g), M1 for aggregates (e.g. 200g)
  dyeSolutionVolumeV1Ml: number; // V1: total volume of methylene blue solution injected in mL
  solutionConcentrationC?: number; // C in g/100 mL, default 1.0 (or 10 g/L)
  finesFractionPassing005mmRatio?: number; // optional proportion of 0/5 mm or 0/2 mm fraction
}

export interface MethyleneBlueResults {
  mode: 'soils' | 'aggregate_fines';
  fractionTested: string;
  sampleDryMassG: number;
  dyeSolutionVolumeV1Ml: number;
  solutionConcentrationC: number;
  vbsValue?: number; // VBS in g/100g for soils
  mbValue?: number; // MB in g/kg for aggregates
  primaryValue: number;
  unit: string;
  soilSensitivityClass?: string; // Labelled "confirm in the project specification"
}

export const methyleneBlueTestDefinition: GeoLabTestDefinition<
  MethyleneBlueInput,
  MethyleneBlueResults
> = {
  id: 'methylene_blue',
  name: {
    en: 'Methylene Blue Test (VBS / MB)',
    fr: 'Valeur de Bleu de Méthylène (VBS / MB)',
  },
  shortName: {
    en: 'Methylene Blue',
    fr: 'Bleu de Méthylène',
  },
  description: {
    en: 'Determination of the clay activity and methylene blue absorption of soils (VBS per NF P94-068) or aggregate fines (MB per NF EN 933-9).',
    fr: 'Détermination de l\'activité argileuse et adsorption de bleu de méthylène des sols (VBS selon NF P94-068) ou des sables et gravillons (MB selon NF EN 933-9).',
  },
  standards: [
    {
      id: 'NF P94-068',
      code: 'NF P94-068',
      standardBody: 'NF',
      title: {
        en: 'NF P94-068: Soils: Investigation and testing - Measuring of the methylene blue adsorption capacity of a rocky soil - Stain test',
        fr: 'NF P94-068 : Sols : Reconnaissance et essais - Mesure de la capacité d\'adsorption de bleu de méthylène d\'un sol - Essai à la tache',
      },
    },
    {
      id: 'NF EN 933-9',
      code: 'NF EN 933-9',
      standardBody: 'EN',
      title: {
        en: 'NF EN 933-9: Tests for geometrical properties of aggregates - Part 9: Assessment of fines - Methylene blue test',
        fr: 'NF EN 933-9 : Essais pour déterminer les caractéristiques géométriques des granulats - Partie 9 : Évaluation des fines - Essai au bleu de méthylène',
      },
    },
  ],
  defaultStandard: 'NF P94-068',
  inputSchema: {
    parameters: [
      {
        key: 'mode',
        label: { en: 'Test Mode / Material Domain', fr: 'Mode d\'essai / Domaine d\'application' },
        type: 'select',
        defaultValue: 'soils',
        required: true,
        options: [
          { value: 'soils', label: { en: 'Soils (VBS, g / 100g) - NF P94-068', fr: 'Sols (VBS, g / 100g) - NF P94-068' } },
          { value: 'aggregate_fines', label: { en: 'Aggregate Fines (MB, g / kg) - NF EN 933-9', fr: 'Granulats / Fines (MB, g / kg) - NF EN 933-9' } },
        ],
      },
      {
        key: 'fractionTested',
        label: { en: 'Tested Fraction', fr: 'Fraction granulométrique analysée' },
        type: 'text',
        defaultValue: '0/5 mm',
        helperText: {
          en: 'e.g. 0/50 mm material sieved at 5 mm for soils, or 0/2 mm for aggregates',
          fr: 'ex. sol 0/50 mm écrêté à 5 mm pour sols, ou fraction 0/2 mm pour granulats',
        },
      },
      {
        key: 'sampleDryMassG',
        label: { en: 'Dry Test Portion Mass (m0 / M1) (g)', fr: 'Masse sèche de la prise (m0 / M1) (g)' },
        unit: 'g',
        type: 'number',
        required: true,
        defaultValue: 30,
        min: 1,
        max: 500,
        decimals: 1,
      },
      {
        key: 'dyeSolutionVolumeV1Ml',
        label: { en: 'Dye Volume Injected V1 (mL)', fr: 'Volume total de solution injecté V1 (mL)' },
        unit: 'mL',
        type: 'number',
        required: true,
        defaultValue: 45,
        min: 0,
        max: 200,
        decimals: 1,
      },
      {
        key: 'solutionConcentrationC',
        label: { en: 'Dye Solution Concentration C (g/100 mL)', fr: 'Concentration de la solution C (g/100 mL)' },
        unit: 'g/100mL',
        type: 'number',
        defaultValue: 1.0,
        min: 0.1,
        max: 5.0,
        decimals: 2,
      },
    ],
  },

  calculate: (input: MethyleneBlueInput): MethyleneBlueResults => {
    const mode = input.mode || 'soils';
    const m0 = input.sampleDryMassG || 30;
    const v1 = input.dyeSolutionVolumeV1Ml || 0;
    const c = input.solutionConcentrationC ?? 1.0;
    const frac = input.fractionTested || (mode === 'soils' ? '0/5 mm' : '0/2 mm');

    if (mode === 'soils') {
      // VBS = (V1 / m0) * C in g/100g
      const vbs = m0 > 0 ? (v1 / m0) * c : 0;
      const vbsRound = Number(vbs.toFixed(2));

      // Soil sensitivity classification thresholds per GTR / NF P94-068
      // Note: "confirm in the project specification"
      let sensitivity = 'VBS < 0.1 : Sol insensible à l\'eau (confirm in project specification)';
      if (vbsRound >= 8.0) {
        sensitivity = 'VBS ≥ 8.0 : Sol extrêmement argileux (confirm in project specification)';
      } else if (vbsRound >= 6.0) {
        sensitivity = '6.0 ≤ VBS < 8.0 : Sol très argileux (confirm in project specification)';
      } else if (vbsRound >= 2.5) {
        sensitivity = '2.5 ≤ VBS < 6.0 : Sol argileux (confirm in project specification)';
      } else if (vbsRound >= 1.5) {
        sensitivity = '1.5 ≤ VBS < 2.5 : Sol limoneux de plasticité moyenne (confirm in project specification)';
      } else if (vbsRound >= 0.2) {
        sensitivity = '0.2 ≤ VBS < 1.5 : Sol limoneux peu plastique (confirm in project specification)';
      } else if (vbsRound >= 0.1) {
        sensitivity = '0.1 ≤ VBS < 0.2 : Sol très peu sensible à l\'eau (confirm in project specification)';
      }

      return {
        mode: 'soils',
        fractionTested: frac,
        sampleDryMassG: m0,
        dyeSolutionVolumeV1Ml: v1,
        solutionConcentrationC: c,
        vbsValue: vbsRound,
        primaryValue: vbsRound,
        unit: 'g/100g',
        soilSensitivityClass: sensitivity,
      };
    } else {
      // Aggregates fines MB = 10 * V1 / M1 in g/kg
      const mb = m0 > 0 ? (10 * v1) / m0 : 0;
      const mbRound = Number(mb.toFixed(2));

      return {
        mode: 'aggregate_fines',
        fractionTested: frac,
        sampleDryMassG: m0,
        dyeSolutionVolumeV1Ml: v1,
        solutionConcentrationC: c,
        mbValue: mbRound,
        primaryValue: mbRound,
        unit: 'g/kg',
      };
    }
  },

  checks: (input: MethyleneBlueInput, results: MethyleneBlueResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];

    if (results.sampleDryMassG <= 0) {
      warnings.push({
        code: 'METHYLENE_BLUE_ZERO_MASS',
        level: 'error',
        message: {
          en: 'Sample dry mass must be greater than zero.',
          fr: 'La masse sèche de la prise d\'essai doit être strictement supérieure à zéro.',
        },
      });
    }

    if (results.dyeSolutionVolumeV1Ml <= 0) {
      warnings.push({
        code: 'METHYLENE_BLUE_ZERO_VOLUME',
        level: 'warning',
        message: {
          en: 'Dye volume V1 is 0 mL. Confirm whether the halo stain test was reached at 0 mL.',
          fr: 'Le volume V1 est nul (0 mL). Confirmer l\'apparition de l\'auréole dès la première goutte.',
        },
      });
    }

    if (results.mode === 'soils' && results.vbsValue !== undefined && results.vbsValue > 15) {
      warnings.push({
        code: 'METHYLENE_BLUE_EXTREME_VBS',
        level: 'warning',
        message: {
          en: `VBS = ${results.vbsValue} g/100g is exceptionally high. Check mass m0 and concentration.`,
          fr: `VBS = ${results.vbsValue} g/100g est exceptionnellement élevé. Vérifier la masse m0 et la concentration.`,
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Methylene Blue Test Report', fr: 'Procès-Verbal de Valeur de Bleu de Méthylène' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Methylene Blue Value Summary', fr: 'Synthèse Valeur de Bleu' } },
    { type: 'conformity_table', title: { en: 'Soil Sensitivity & Specification Conformity', fr: 'Sensibilité du Sol et Conformité' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: MethyleneBlueInput, results: MethyleneBlueResults) => ({
    testType: 'methylene_blue',
    standard: results.mode === 'soils' ? 'NF P94-068' : 'NF EN 933-9',
    mode: results.mode,
    primaryValue: results.primaryValue,
    unit: results.unit,
    fraction: results.fractionTested,
    sensitivityClass: results.soilSensitivityClass,
  }),

  keyResults: (results: MethyleneBlueResults, lang: 'en' | 'fr') => [
    {
      label:
        results.mode === 'soils'
          ? lang === 'fr'
            ? 'Valeur de bleu du sol (VBS)'
            : 'Soil Methylene Blue Value (VBS)'
          : lang === 'fr'
          ? 'Valeur de bleu des fines (MB)'
          : 'Fines Methylene Blue Value (MB)',
      value: results.primaryValue !== undefined ? Number(results.primaryValue.toFixed(2)) : '-',
      unit: results.unit,
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Fraction testée' : 'Tested Fraction',
      value: results.fractionTested || '-',
      provenance: 'measured',
    },
    ...(results.soilSensitivityClass
      ? [
          {
            label: lang === 'fr' ? 'Sensibilité du sol' : 'Soil Sensitivity',
            value: results.soilSensitivityClass,
            provenance: 'measured' as const,
          },
        ]
      : []),
  ],
};
