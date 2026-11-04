import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface BulkDensityTrialInput {
  trialIndex?: number;
  mouldPlusMaterialG: number;
}

export interface BulkDensityInput {
  mouldMassG: number; // Mould empty mass in g
  mouldVolumeCm3: number; // Mould volume in cm3 (mL)
  compactionState?: 'loose' | 'compacted';
  trials: BulkDensityTrialInput[];
}

export interface BulkDensityTrialResult {
  trialIndex: number;
  mouldPlusMaterialG: number;
  netMaterialMassG: number;
  bulkDensityGcm3: number; // t/m3
}

export interface BulkDensityResults {
  trials: BulkDensityTrialResult[];
  mouldMassG: number;
  mouldVolumeCm3: number;
  meanBulkDensityGcm3: number; // g/cm3 = t/m3
  meanBulkDensityTm3: number;
  meanBulkDensityKgM3: number;
  differenceGcm3: number;
  compactionState: 'loose' | 'compacted';
}

export const bulkDensityTestDefinition: GeoLabTestDefinition<
  BulkDensityInput,
  BulkDensityResults
> = {
  id: 'bulk_density',
  name: {
    en: 'Loose Bulk Density of Aggregates',
    fr: 'Masse Volumique en Vrac des Granulats',
  },
  shortName: {
    en: 'Bulk Density',
    fr: 'Masse Volumique en Vrac',
  },
  description: {
    en: 'Determination of loose or compacted bulk density of aggregates according to NF EN 1097-3.',
    fr: 'Détermination de la masse volumique en vrac (ou tassée) des granulats selon NF EN 1097-3.',
  },
  standards: [
    {
      id: 'NF EN 1097-3',
      code: 'NF EN 1097-3',
      standardBody: 'EN',
      title: {
        en: 'NF EN 1097-3: Tests for mechanical and physical properties of aggregates - Part 3: Determination of loose bulk density and voids',
        fr: 'NF EN 1097-3 : Essais pour déterminer les caractéristiques mécaniques et physiques des granulats - Partie 3 : Détermination de la masse volumique en vrac et de la porosité',
      },
    },
    {
      id: 'ASTM C29',
      code: 'ASTM C29',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM C29/C29M: Standard Test Method for Bulk Density ("Unit Weight") and Voids in Aggregate',
        fr: 'ASTM C29 : Méthode d\'essai normalisée pour la masse volumique apparente et les vides dans les granulats',
      },
    },
  ],
  defaultStandard: 'NF EN 1097-3',
  inputSchema: {
    parameters: [
      {
        key: 'mouldMassG',
        label: { en: 'Mould Empty Mass (g)', fr: 'Masse du moule vide (g)' },
        unit: 'g',
        type: 'number',
        required: true,
        defaultValue: 2251,
        min: 100,
        max: 50000,
        decimals: 1,
      },
      {
        key: 'mouldVolumeCm3',
        label: { en: 'Mould Volume (cm³)', fr: 'Volume du moule (cm³)' },
        unit: 'cm³',
        type: 'number',
        required: true,
        defaultValue: 4889.7,
        min: 500,
        max: 50000,
        decimals: 1,
      },
      {
        key: 'compactionState',
        label: { en: 'State', fr: 'État de mise en place' },
        type: 'select',
        defaultValue: 'loose',
        options: [
          { value: 'loose', label: { en: 'Loose (non tassé)', fr: 'En vrac (non tassé)' } },
          { value: 'compacted', label: { en: 'Compacted (tassé)', fr: 'Tassé / pilonné' } },
        ],
      },
    ],
    table: {
      key: 'trials',
      label: { en: 'Trials (Mould + Material)', fr: 'Pesées d\'essais (Moule + Matériau)' },
      minRows: 1,
      maxRows: 5,
      columns: [
        { key: 'trialIndex', label: { en: 'Trial #', fr: 'N° Essai' }, type: 'number', required: true },
        { key: 'mouldPlusMaterialG', label: { en: 'Mould + Material (g)', fr: 'Moule + Matériau (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
      ],
      defaultRows: [
        { trialIndex: 1, mouldPlusMaterialG: 9183 },
        { trialIndex: 2, mouldPlusMaterialG: 9380 },
        { trialIndex: 3, mouldPlusMaterialG: 9286 },
      ],
    },
  },

  calculate: (input: BulkDensityInput): BulkDensityResults => {
    const mouldMass = input.mouldMassG || 0;
    const mouldVol = input.mouldVolumeCm3 || 1;
    const rawTrials = input.trials || [];

    const computedTrials: BulkDensityTrialResult[] = rawTrials.map((t, idx) => {
      const gross = t.mouldPlusMaterialG || 0;
      const net = gross - mouldMass;
      const rho = mouldVol > 0 ? net / mouldVol : 0;
      return {
        trialIndex: t.trialIndex || idx + 1,
        mouldPlusMaterialG: Number(gross.toFixed(1)),
        netMaterialMassG: Number(net.toFixed(1)),
        bulkDensityGcm3: Number(rho.toFixed(4)),
      };
    });

    const densities = computedTrials.map((t) => t.bulkDensityGcm3);
    const mean = densities.length > 0 ? densities.reduce((a, b) => a + b, 0) / densities.length : 0;
    const diff = densities.length > 1 ? Math.max(...densities) - Math.min(...densities) : 0;

    const meanGcm3 = Number(mean.toFixed(4));

    return {
      trials: computedTrials,
      mouldMassG: mouldMass,
      mouldVolumeCm3: mouldVol,
      meanBulkDensityGcm3: meanGcm3,
      meanBulkDensityTm3: meanGcm3,
      meanBulkDensityKgM3: Number((meanGcm3 * 1000).toFixed(1)),
      differenceGcm3: Number(diff.toFixed(4)),
      compactionState: input.compactionState || 'loose',
    };
  },

  checks: (input: BulkDensityInput, results: BulkDensityResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    if (results.trials.length < 3) {
      warnings.push({
        code: 'BULK_DENSITY_FEWER_THAN_THREE_TRIALS',
        level: 'warning',
        message: {
          en: 'NF EN 1097-3 specifies 3 trials for bulk density determination.',
          fr: 'La norme NF EN 1097-3 prescrit 3 déterminations pour la masse volumique en vrac.',
        },
      });
    }

    if (results.meanBulkDensityGcm3 < 0.8 || results.meanBulkDensityGcm3 > 2.2) {
      warnings.push({
        code: 'BULK_DENSITY_SUSPICIOUS_VALUE',
        level: 'warning',
        message: {
          en: `Bulk density ρb = ${results.meanBulkDensityGcm3.toFixed(3)} t/m³ is outside typical range for common aggregates (0.8 - 2.2 t/m³).`,
          fr: `La masse volumique en vrac ρb = ${results.meanBulkDensityGcm3.toFixed(3)} t/m³ est hors plage typique des granulats courants (0.8 - 2.2 t/m³).`,
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Bulk Density Test Report', fr: 'Procès-Verbal de Masse Volumique en Vrac' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Bulk Density Summary', fr: 'Synthèse de Masse Volumique en Vrac' } },
    {
      type: 'raw_data_table',
      title: { en: 'Mould Measurements and Weighings', fr: 'Mesures du Moule et Pesées' },
      tableColumns: [
        { key: 'trialIndex', label: { en: 'Trial #', fr: 'N° Essai' }, align: 'center' },
        { key: 'mouldPlusMaterialG', label: { en: 'Mould + Material (g)', fr: 'Moule + Matériau (g)' }, align: 'right', decimals: 1 },
        { key: 'netMaterialMassG', label: { en: 'Net Material (g)', fr: 'Matériau net (g)' }, align: 'right', decimals: 1 },
        { key: 'bulkDensityGcm3', label: { en: 'ρb (t/m³)', fr: 'ρb (t/m³)' }, align: 'right', decimals: 4 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Quality & Specification Conformity', fr: 'Qualité et Conformité' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: BulkDensityInput, results: BulkDensityResults) => ({
    testType: 'bulk_density',
    standard: 'NF EN 1097-3',
    meanBulkDensityGcm3: results.meanBulkDensityGcm3,
    compactionState: results.compactionState,
    numberOfTrials: results.trials.length,
    mouldVolumeCm3: results.mouldVolumeCm3,
  }),

  keyResults: (results: BulkDensityResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Masse volumique en vrac (ρb)' : 'Loose Bulk Density (ρb)',
      value: results.meanBulkDensityGcm3 ? Number(results.meanBulkDensityGcm3.toFixed(3)) : '-',
      unit: 't/m³',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Masse volumique en vrac' : 'Bulk Density',
      value: results.meanBulkDensityKgM3 ? Number(results.meanBulkDensityKgM3.toFixed(0)) : '-',
      unit: 'kg/m³',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Écart entre pesées' : 'Difference between trials',
      value: results.differenceGcm3 ? Number(results.differenceGcm3.toFixed(3)) : '-',
      unit: 't/m³',
      provenance: 'measured',
    },
  ],
};
