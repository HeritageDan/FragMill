import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface WaterContentSpecimenInput {
  specimenId: string;
  containerId?: string;
  tareMassG: number; // m0
  wetSoilPlusTareG: number; // m1
  drySoilPlusTareG: number; // m2
  waterContentPercent?: number; // direct entry if already computed
}

export interface WaterContentInput {
  dryingTemperatureC?: number; // default 105°C
  maxTolerancePercent?: number; // repeatability limit, default 0.5%
  directNaturalWaterContentPercent?: number; // direct single value (e.g. 10.7% in Classeur1)
  specimens: WaterContentSpecimenInput[];
}

export interface WaterContentSpecimenResult {
  specimenId: string;
  containerId: string;
  tareMassG: number;
  wetSoilPlusTareG: number;
  drySoilPlusTareG: number;
  waterMassG: number;
  drySoilMassG: number;
  waterContentPercent: number;
}

export interface WaterContentResults {
  specimens: WaterContentSpecimenResult[];
  meanWaterContentPercent: number;
  differenceBetweenSpecimensPercent: number;
  maxTolerancePercent: number;
  repeatabilityAccepted: boolean;
}

export const waterContentTestDefinition: GeoLabTestDefinition<WaterContentInput, WaterContentResults> = {
  id: 'water_content',
  name: {
    en: 'Natural Water Content by Oven Drying',
    fr: 'Teneur en Eau Naturelle par Étuvage',
  },
  shortName: {
    en: 'Water Content',
    fr: 'Teneur en Eau',
  },
  description: {
    en: 'Determination of moisture content of soil and rock by mass loss on oven drying at 105°C.',
    fr: 'Détermination de la teneur en eau pondérale des sols par séchage à l\'étuve à 105°C.',
  },
  standards: [
    {
      id: 'NF P94-050',
      code: 'NF P94-050',
      standardBody: 'NF',
      title: {
        en: 'NF P94-050: Determination of moisture content - Oven drying method',
        fr: 'NF P94-050 : Détermination de la teneur en eau pondérale des matériaux - Méthode par étuvage',
      },
    },
    {
      id: 'ASTM D2216',
      code: 'ASTM D2216',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM D2216: Standard Test Methods for Laboratory Determination of Water Content of Soil and Rock by Mass',
        fr: 'ASTM D2216 : Détermination en laboratoire de la teneur en eau des sols et roches',
      },
    },
    {
      id: 'AASHTO T265',
      code: 'AASHTO T265',
      standardBody: 'AASHTO',
      title: {
        en: 'AASHTO T265: Laboratory Determination of Moisture Content of Soils',
        fr: 'AASHTO T265 : Détermination en laboratoire de la teneur en humidité des sols',
      },
    },
  ],
  defaultStandard: 'NF P94-050',
  inputSchema: {
    parameters: [
      {
        key: 'dryingTemperatureC',
        label: { en: 'Drying Temperature', fr: 'Température d\'étuvage' },
        type: 'number',
        unit: '°C',
        defaultValue: 105,
        min: 60,
        max: 120,
      },
      {
        key: 'maxTolerancePercent',
        label: { en: 'Repeatability Tolerance', fr: 'Tolérance de répétabilité' },
        type: 'number',
        unit: '%',
        defaultValue: 0.5,
        min: 0.1,
        max: 2.0,
        step: 0.1,
      },
      {
        key: 'directNaturalWaterContentPercent',
        label: { en: 'Direct Water Content (if pre-computed)', fr: 'Teneur en eau directe (si pré-calculée)' },
        type: 'number',
        unit: '%',
        step: 0.1,
        helperText: {
          en: 'Optional single value when detailed tare masses are not recorded (e.g. 10.7%)',
          fr: 'Valeur unique optionnelle si les masses de tares ne sont pas détaillées (ex: 10,7%)',
        },
      },
    ],
    table: {
      key: 'specimens',
      label: { en: 'Specimens (Tares)', fr: 'Prises d\'essai (Tares)' },
      minRows: 1,
      maxRows: 5,
      columns: [
        { key: 'specimenId', label: { en: 'Specimen', fr: 'Éprouvette' }, type: 'text', required: true },
        { key: 'containerId', label: { en: 'Tare ID', fr: 'N° Tare' }, type: 'text' },
        { key: 'tareMassG', label: { en: 'Tare Mass m0 (g)', fr: 'Masse tare m0 (g)' }, unit: 'g', type: 'number', required: true, decimals: 2 },
        { key: 'wetSoilPlusTareG', label: { en: 'Wet Soil + Tare m1 (g)', fr: 'Sol humide + tare m1 (g)' }, unit: 'g', type: 'number', required: true, decimals: 2 },
        { key: 'drySoilPlusTareG', label: { en: 'Dry Soil + Tare m2 (g)', fr: 'Sol sec + tare m2 (g)' }, unit: 'g', type: 'number', required: true, decimals: 2 },
        { key: 'waterContentPercent', label: { en: 'Water Content w (%)', fr: 'Teneur en eau w (%)' }, unit: '%', type: 'number', decimals: 2 },
      ],
      defaultRows: [
        { specimenId: 'A', containerId: 'T1', tareMassG: 45.2, wetSoilPlusTareG: 198.6, drySoilPlusTareG: 183.8 },
        { specimenId: 'B', containerId: 'T2', tareMassG: 44.8, wetSoilPlusTareG: 202.1, drySoilPlusTareG: 187.1 },
      ],
    },
  },

  calculate: (input: WaterContentInput): WaterContentResults => {
    const rawSpecimens = input.specimens || [];
    const maxTol = input.maxTolerancePercent !== undefined && input.maxTolerancePercent > 0
      ? input.maxTolerancePercent
      : 0.5;

    // Direct override case
    if (
      (rawSpecimens.length === 0 || rawSpecimens.every((s) => !s.wetSoilPlusTareG)) &&
      input.directNaturalWaterContentPercent !== undefined &&
      input.directNaturalWaterContentPercent !== null
    ) {
      const val = Number(input.directNaturalWaterContentPercent.toFixed(2));
      return {
        specimens: [
          {
            specimenId: 'A',
            containerId: 'Direct',
            tareMassG: 0,
            wetSoilPlusTareG: 0,
            drySoilPlusTareG: 0,
            waterMassG: 0,
            drySoilMassG: 0,
            waterContentPercent: val,
          },
        ],
        meanWaterContentPercent: val,
        differenceBetweenSpecimensPercent: 0,
        maxTolerancePercent: maxTol,
        repeatabilityAccepted: true,
      };
    }

    const computedSpecimens: WaterContentSpecimenResult[] = rawSpecimens.map((s, idx) => {
      let w = s.waterContentPercent;
      let waterMass = 0;
      let drySoilMass = 0;

      if (s.wetSoilPlusTareG !== undefined && s.drySoilPlusTareG !== undefined && s.tareMassG !== undefined) {
        waterMass = s.wetSoilPlusTareG - s.drySoilPlusTareG;
        drySoilMass = s.drySoilPlusTareG - s.tareMassG;
        if (drySoilMass > 0) {
          w = (waterMass / drySoilMass) * 100;
        }
      }

      const finalW = w !== undefined && w !== null ? Number(w.toFixed(2)) : 0;

      return {
        specimenId: s.specimenId || String.fromCharCode(65 + idx),
        containerId: s.containerId || `T-${idx + 1}`,
        tareMassG: Number((s.tareMassG || 0).toFixed(2)),
        wetSoilPlusTareG: Number((s.wetSoilPlusTareG || 0).toFixed(2)),
        drySoilPlusTareG: Number((s.drySoilPlusTareG || 0).toFixed(2)),
        waterMassG: Number(waterMass.toFixed(2)),
        drySoilMassG: Number(drySoilMass.toFixed(2)),
        waterContentPercent: finalW,
      };
    });

    const values = computedSpecimens.map((s) => s.waterContentPercent);
    const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const diff = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
    const repeatabilityAccepted = diff <= maxTol;

    return {
      specimens: computedSpecimens,
      meanWaterContentPercent: Number(mean.toFixed(2)),
      differenceBetweenSpecimensPercent: Number(diff.toFixed(2)),
      maxTolerancePercent: maxTol,
      repeatabilityAccepted,
    };
  },

  checks: (input: WaterContentInput, results: WaterContentResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    const specs = results.specimens || [];

    if (specs.length < 2 && input.directNaturalWaterContentPercent === undefined) {
      warnings.push({
        code: 'WATER_CONTENT_SINGLE_SPECIMEN',
        level: 'warning',
        message: {
          en: 'Only 1 specimen tested. Two specimens are required to confirm repeatability per NF P94-050.',
          fr: 'Seule 1 éprouvette a été testée. Deux éprouvettes sont requises pour valider la répétabilité selon NF P94-050.',
        },
      });
    }

    // Check invalid masses: m1 must be > m2 and m2 must be > m0
    for (const s of specs) {
      if (s.tareMassG > 0 && s.wetSoilPlusTareG > 0 && s.drySoilPlusTareG > 0) {
        if (s.wetSoilPlusTareG <= s.drySoilPlusTareG) {
          warnings.push({
            code: 'WATER_CONTENT_NEGATIVE_LOSS',
            level: 'error',
            message: {
              en: `Specimen ${s.specimenId}: Dry mass (m2=${s.drySoilPlusTareG}g) is greater than or equal to wet mass (m1=${s.wetSoilPlusTareG}g).`,
              fr: `Éprouvette ${s.specimenId} : La masse sèche (m2=${s.drySoilPlusTareG}g) est supérieure ou égale à la masse humide (m1=${s.wetSoilPlusTareG}g).`,
            },
          });
        }
        if (s.drySoilPlusTareG <= s.tareMassG) {
          warnings.push({
            code: 'WATER_CONTENT_ZERO_SOIL',
            level: 'error',
            message: {
              en: `Specimen ${s.specimenId}: Dry soil mass is zero or negative (m2 <= m0).`,
              fr: `Éprouvette ${s.specimenId} : La masse de sol sec est nulle ou négative (m2 <= m0).`,
            },
          });
        }
      }
    }

    if (!results.repeatabilityAccepted && specs.length > 1) {
      warnings.push({
        code: 'WATER_CONTENT_REPEATABILITY_FAILED',
        level: 'error',
        message: {
          en: `Repeatability check failed: difference between specimens is ${results.differenceBetweenSpecimensPercent}% (threshold: ${results.maxTolerancePercent}%). Retesting recommended.`,
          fr: `Échec du critère de répétabilité : l'écart entre prises est de ${results.differenceBetweenSpecimensPercent}% (seuil max : ${results.maxTolerancePercent}%). Un nouvel essai est recommandé.`,
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Natural Water Content Report', fr: 'Procès-Verbal de Teneur en Eau Naturelle' } },
    { type: 'client_project' },
    {
      type: 'results_table',
      title: { en: 'Water Content Summary', fr: 'Synthèse de Teneur en Eau' },
    },
    {
      type: 'raw_data_table',
      title: { en: 'Specimens Mass Measurements', fr: 'Mesures Pression / Pesées des Éprouvettes' },
      tableColumns: [
        { key: 'specimenId', label: { en: 'Specimen', fr: 'Éprouvette' }, align: 'center' },
        { key: 'containerId', label: { en: 'Tare #', fr: 'N° Tare' }, align: 'center' },
        { key: 'tareMassG', label: { en: 'Tare m0 (g)', fr: 'Tare m0 (g)' }, align: 'right', decimals: 2 },
        { key: 'wetSoilPlusTareG', label: { en: 'Wet + Tare m1 (g)', fr: 'Humide + Tare m1 (g)' }, align: 'right', decimals: 2 },
        { key: 'drySoilPlusTareG', label: { en: 'Dry + Tare m2 (g)', fr: 'Sec + Tare m2 (g)' }, align: 'right', decimals: 2 },
        { key: 'drySoilMassG', label: { en: 'Dry Soil md (g)', fr: 'Sol sec md (g)' }, align: 'right', decimals: 2 },
        { key: 'waterMassG', label: { en: 'Water mw (g)', fr: 'Eau mw (g)' }, align: 'right', decimals: 2 },
        { key: 'waterContentPercent', label: { en: 'Water Content w (%)', fr: 'Teneur en eau w (%)' }, align: 'right', decimals: 2 },
      ],
    },
    {
      type: 'conformity_table',
      title: { en: 'Repeatability & Quality Conformity', fr: 'Répétabilité et Conformité Qualité' },
    },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: WaterContentInput, results: WaterContentResults) => ({
    testType: 'water_content',
    standard: 'NF P94-050 / ASTM D2216',
    meanWaterContentPercent: results.meanWaterContentPercent,
    differenceBetweenSpecimensPercent: results.differenceBetweenSpecimensPercent,
    repeatabilityAccepted: results.repeatabilityAccepted,
    numberOfSpecimens: results.specimens.length,
    dryingTemperatureC: input.dryingTemperatureC || 105,
  }),

  keyResults: (results: WaterContentResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Teneur en eau moyenne (w)' : 'Average Moisture Content (w)',
      value: results.meanWaterContentPercent ?? '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Écart entre prises' : 'Difference between specimens',
      value: results.differenceBetweenSpecimensPercent ?? '-',
      unit: '%',
      provenance: 'measured',
    },
  ],
};

