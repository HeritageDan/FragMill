import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export const WATER_DENSITY_TABLE: Record<number, number> = {
  15: 0.9991,
  16: 0.9989,
  17: 0.9988,
  18: 0.9986,
  19: 0.9984,
  20: 0.9982,
  21: 0.998,
  22: 0.9978,
  23: 0.9975,
  24: 0.9973,
  25: 0.997,
  26: 0.9968,
  27: 0.9965,
  28: 0.9962,
  29: 0.9959,
  30: 0.9956,
  31: 0.9953,
  32: 0.995,
  33: 0.9947,
  34: 0.9944,
  35: 0.994,
};

export function getWaterDensityAtTemp(t: number): number {
  const roundT = Math.round(t);
  if (WATER_DENSITY_TABLE[roundT] !== undefined) {
    return WATER_DENSITY_TABLE[roundT];
  }
  if (t < 15) return 0.9991;
  if (t > 35) return 0.994;
  const t0 = Math.floor(t);
  const t1 = Math.ceil(t);
  const d0 = WATER_DENSITY_TABLE[t0] || 0.997;
  const d1 = WATER_DENSITY_TABLE[t1] || 0.997;
  return d0 + (t - t0) * (d1 - d0);
}

export interface SpecificGravityDeterminationInput {
  detId?: string;
  pycnometerWaterA: number; // A: Pycnometer + water (g)
  emptyPycnometerB: number; // B: Empty pycnometer (g)
  pycnometerMaterialC: number; // C: Pycnometer + dry soil/material (g)
  pycnometerMaterialWaterD: number; // D: Pycnometer + material + water (g)
  temperatureC: number; // T (°C)
}

export interface SpecificGravityInput {
  materialType?: string;
  fraction?: string;
  maxToleranceGs?: number; // default 0.03
  determinations: SpecificGravityDeterminationInput[];
}

export interface SpecificGravityDeterminationResult {
  detId: string;
  pycnometerWaterA: number;
  emptyPycnometerB: number;
  pycnometerMaterialC: number;
  pycnometerMaterialWaterD: number;
  temperatureC: number;
  waterDensityGcm3: number;
  dryMaterialMassMsG: number;
  displacedWaterMassG: number;
  solidVolumeVsCm3: number;
  specificGravityGs: number;
}

export interface SpecificGravityResults {
  determinations: SpecificGravityDeterminationResult[];
  meanGs: number;
  specificGravity: number;
  solidDensityGcm3: number;
  solidDensityMgM3: number;
  densityTm3: number;
  differenceGs: number;
  maxToleranceGs: number;
  repeatabilityAccepted: boolean;
  materialType?: string;
  fraction?: string;
}

export const specificGravityTestDefinition: GeoLabTestDefinition<
  SpecificGravityInput,
  SpecificGravityResults
> = {
  id: 'specific_gravity',
  name: {
    en: 'Specific Gravity of Solid Particles (Pycnometer)',
    fr: 'Masse Volumique Absolue des Grains Solides (Pycnomètre)',
  },
  shortName: {
    en: 'Specific Gravity',
    fr: 'Masse Volumique Absolue',
  },
  description: {
    en: 'Determination of particle density / specific gravity of soils and aggregates using water pycnometer.',
    fr: 'Détermination de la masse volumique des particules solides des sols et granulats au pycnomètre à eau.',
  },
  standards: [
    {
      id: 'NF P94-054',
      code: 'NF P94-054',
      standardBody: 'NF',
      title: {
        en: 'NF P94-054: Determination of solid particle density - Water pycnometer method',
        fr: 'NF P94-054 : Détermination de la masse volumique des particules solides des sols - Méthode du pycnomètre à eau',
      },
    },
    {
      id: 'NF P18-554',
      code: 'NF P18-554',
      standardBody: 'NF',
      title: {
        en: 'NF P18-554: Aggregates - Measurement of absolute density of gravels',
        fr: 'NF P18-554 : Granulats - Mesure des masses volumiques des gravillons',
      },
    },
    {
      id: 'NF P18-555',
      code: 'NF P18-555',
      standardBody: 'NF',
      title: {
        en: 'NF P18-555: Aggregates - Measurement of absolute density of sands',
        fr: 'NF P18-555 : Granulats - Mesure des masses volumiques des sables',
      },
    },
  ],
  defaultStandard: 'NF P94-054',
  inputSchema: {
    parameters: [
      {
        key: 'maxToleranceGs',
        label: {
          en: 'Repeatability Tolerance ΔGs (confirm in the standard)',
          fr: 'Tolérance répétabilité ΔGs (à confirmer dans la norme)',
        },
        type: 'number',
        defaultValue: 0.03,
        min: 0.01,
        max: 0.1,
        step: 0.005,
      },
      {
        key: 'fraction',
        label: { en: 'Tested Fraction', fr: 'Fraction testée' },
        type: 'text',
        helperText: {
          en: 'e.g. 0/2 mm, 4/10 mm, < 2 mm',
          fr: 'ex. 0/2 mm, 4/10 mm, < 2 mm',
        },
      },
    ],
    table: {
      key: 'determinations',
      label: { en: 'Pycnometer Determinations', fr: 'Déterminations au pycnomètre' },
      minRows: 1,
      maxRows: 4,
      columns: [
        { key: 'detId', label: { en: 'Det #', fr: 'N° Essai' }, type: 'text', required: true },
        { key: 'pycnometerWaterA', label: { en: 'Pycnometer + Water A (g)', fr: 'Pycnomètre + Eau A (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
        { key: 'emptyPycnometerB', label: { en: 'Empty Pycnometer B (g)', fr: 'Pycnomètre Vide B (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
        { key: 'pycnometerMaterialC', label: { en: 'Pycnometer + Dry Mat. C (g)', fr: 'Pycnomètre + Mat. Sec C (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
        { key: 'pycnometerMaterialWaterD', label: { en: 'Pycnometer + Mat. + Water D (g)', fr: 'Pycnomètre + Mat. + Eau D (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
        { key: 'temperatureC', label: { en: 'Temperature T (°C)', fr: 'Température T (°C)' }, unit: '°C', type: 'number', required: true, defaultValue: 20, decimals: 1 },
      ],
      defaultRows: [
        { detId: '1', pycnometerWaterA: 3813.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2990.5, pycnometerMaterialWaterD: 4969.0, temperatureC: 30 },
        { detId: '2', pycnometerWaterA: 3811.5, emptyPycnometerB: 1128.5, pycnometerMaterialC: 2992.5, pycnometerMaterialWaterD: 4968.0, temperatureC: 30 },
      ],
    },
  },

  calculate: (input: SpecificGravityInput): SpecificGravityResults => {
    const raw = input.determinations || [];
    const maxTol = input.maxToleranceGs !== undefined && input.maxToleranceGs > 0 ? input.maxToleranceGs : 0.03;

    const computedDets: SpecificGravityDeterminationResult[] = raw.map((d, idx) => {
      const a = d.pycnometerWaterA || 0;
      const b = d.emptyPycnometerB || 0;
      const c = d.pycnometerMaterialC || 0;
      const dVal = d.pycnometerMaterialWaterD || 0;
      const temp = d.temperatureC || 20;

      const rhoW = getWaterDensityAtTemp(temp);
      const ms = c - b;
      const displaced = (a + ms) - dVal;
      const vs = rhoW > 0 ? displaced / rhoW : 0;
      const gs = vs > 0 ? ms / vs : 0;

      return {
        detId: d.detId || String(idx + 1),
        pycnometerWaterA: Number(a.toFixed(2)),
        emptyPycnometerB: Number(b.toFixed(2)),
        pycnometerMaterialC: Number(c.toFixed(2)),
        pycnometerMaterialWaterD: Number(dVal.toFixed(2)),
        temperatureC: Number(temp.toFixed(1)),
        waterDensityGcm3: Number(rhoW.toFixed(4)),
        dryMaterialMassMsG: Number(ms.toFixed(2)),
        displacedWaterMassG: Number(displaced.toFixed(2)),
        solidVolumeVsCm3: Number(vs.toFixed(3)),
        specificGravityGs: Number(gs.toFixed(3)),
      };
    });

    const gsList = computedDets.map((d) => d.specificGravityGs).filter((v) => v > 0);
    const mean = gsList.length > 0 ? gsList.reduce((acc, v) => acc + v, 0) / gsList.length : 0;
    const diff = gsList.length > 1 ? Math.max(...gsList) - Math.min(...gsList) : 0;
    const accepted = diff <= maxTol;

    const finalMeanGs = Number(mean.toFixed(4));
    const densityVal = Number(mean.toFixed(3));

    return {
      determinations: computedDets,
      meanGs: finalMeanGs,
      specificGravity: densityVal,
      solidDensityGcm3: densityVal,
      solidDensityMgM3: densityVal,
      densityTm3: densityVal,
      differenceGs: Number(diff.toFixed(4)),
      maxToleranceGs: maxTol,
      repeatabilityAccepted: accepted,
      materialType: input.materialType,
      fraction: input.fraction,
    };
  },

  checks: (input: SpecificGravityInput, results: SpecificGravityResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    const dets = results.determinations || [];

    if (dets.length < 2) {
      warnings.push({
        code: 'SPECIFIC_GRAVITY_SINGLE_DETERMINATION',
        level: 'warning',
        message: {
          en: 'Only 1 determination performed. Two determinations are required to verify repeatability.',
          fr: 'Une seule détermination réalisée. Deux déterminations sont requises pour vérifier la répétabilité.',
        },
      });
    }

    if (!results.repeatabilityAccepted && dets.length > 1) {
      warnings.push({
        code: 'SPECIFIC_GRAVITY_REPEATABILITY_FAILED',
        level: 'warning',
        message: {
          en: `Repeatability limit exceeded: ΔGs = ${results.differenceGs.toFixed(3)} > ${results.maxToleranceGs.toFixed(3)} (confirm in the standard).`,
          fr: `Écart de répétabilité dépassé : ΔGs = ${results.differenceGs.toFixed(3)} > ${results.maxToleranceGs.toFixed(3)} (à confirmer dans la norme).`,
        },
      });
    }

    if (results.meanGs > 0 && (results.meanGs < 2.0 || results.meanGs > 3.4)) {
      warnings.push({
        code: 'SPECIFIC_GRAVITY_SUSPICIOUS_RANGE',
        level: 'warning',
        message: {
          en: `Specific gravity Gs = ${results.meanGs.toFixed(3)} is outside usual range for natural minerals (2.0 - 3.4). Check readings.`,
          fr: `La masse volumique absolue Gs = ${results.meanGs.toFixed(3)} est hors plage usuelle des minéraux naturels (2.0 - 3.4). Vérifier les pesées.`,
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Specific Gravity Test Report', fr: 'Procès-Verbal de Masse Volumique Absolue' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Specific Gravity Results', fr: 'Synthèse Masse Volumique Absolue' } },
    {
      type: 'raw_data_table',
      title: { en: 'Pycnometer Measurements', fr: 'Mesures au Pycnomètre' },
      tableColumns: [
        { key: 'detId', label: { en: 'Det #', fr: 'N° Essai' }, align: 'center' },
        { key: 'pycnometerWaterA', label: { en: 'A (g)', fr: 'A (g)' }, align: 'right', decimals: 1 },
        { key: 'emptyPycnometerB', label: { en: 'B (g)', fr: 'B (g)' }, align: 'right', decimals: 1 },
        { key: 'pycnometerMaterialC', label: { en: 'C (g)', fr: 'C (g)' }, align: 'right', decimals: 1 },
        { key: 'pycnometerMaterialWaterD', label: { en: 'D (g)', fr: 'D (g)' }, align: 'right', decimals: 1 },
        { key: 'temperatureC', label: { en: 'T (°C)', fr: 'T (°C)' }, align: 'right', decimals: 1 },
        { key: 'dryMaterialMassMsG', label: { en: 'Ms (g)', fr: 'Ms (g)' }, align: 'right', decimals: 1 },
        { key: 'displacedWaterMassG', label: { en: 'Displaced (g)', fr: 'Eau déplacée (g)' }, align: 'right', decimals: 1 },
        { key: 'solidVolumeVsCm3', label: { en: 'Vs (cm³)', fr: 'Vs (cm³)' }, align: 'right', decimals: 2 },
        { key: 'specificGravityGs', label: { en: 'Gs', fr: 'Gs' }, align: 'right', decimals: 3 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Conformity & Quality', fr: 'Conformité et Qualité' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: SpecificGravityInput, results: SpecificGravityResults) => ({
    testType: 'specific_gravity',
    standard: 'NF P94-054 / NF P18-554',
    meanGs: results.meanGs,
    densityTm3: results.densityTm3,
    differenceGs: results.differenceGs,
    repeatabilityAccepted: results.repeatabilityAccepted,
    numberOfDeterminations: results.determinations.length,
    fraction: input.fraction || 'all',
  }),

  keyResults: (results: SpecificGravityResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Masse volumique absolue (Gs)' : 'Specific Gravity (Gs)',
      value: results.meanGs ? Number(results.meanGs.toFixed(3)) : '-',
      unit: '',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Masse volumique des grains (ρs)' : 'Particle Density (ρs)',
      value: results.densityTm3 ? Number(results.densityTm3.toFixed(3)) : '-',
      unit: 't/m³',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Écart entre déterminations' : 'Difference between determinations',
      value: results.differenceGs ? Number(results.differenceGs.toFixed(3)) : '-',
      unit: '',
      provenance: 'measured',
    },
  ],
};

