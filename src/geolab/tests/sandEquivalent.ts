import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface SandEquivalentSpecimenInput {
  specimenId?: string;
  h1Mm: number; // H1: total height (flocculate + sand)
  h2PrimeMm: number; // H2': visual sand reading height
  h2Mm: number; // H2: piston sand reading height
}

export interface SandEquivalentInput {
  shakingMethod?: 'mechanical' | 'manual';
  agitationDurationMin?: number; // default 10 min (warn if timing check fails)
  settlingDurationMin?: number; // default 20 min
  specimens: SandEquivalentSpecimenInput[];
}

export interface SandEquivalentSpecimenResult {
  specimenId: string;
  h1Mm: number;
  h2PrimeMm: number;
  h2Mm: number;
  esVisual: number; // ESv = 100 * H2' / H1
  esPiston: number; // ESp = 100 * H2 / H1
}

export interface SandEquivalentResults {
  specimens: SandEquivalentSpecimenResult[];
  meanEsVisual: number;
  meanEsPiston: number;
  differenceEsVisual: number;
  differenceEsPiston: number;
  shakingMethod: 'mechanical' | 'manual';
  repeatabilityAccepted: boolean;
}

export const sandEquivalentTestDefinition: GeoLabTestDefinition<
  SandEquivalentInput,
  SandEquivalentResults
> = {
  id: 'sand_equivalent',
  name: {
    en: 'Sand Equivalent Test (SE / ES)',
    fr: 'Essai d\'Équivalent de Sable (ES / SE)',
  },
  shortName: {
    en: 'Sand Equivalent',
    fr: 'Équivalent de Sable',
  },
  description: {
    en: 'Assessment of clayey fines in sands according to NF EN 933-8 (visual and piston sand equivalent).',
    fr: 'Évaluation des fines argileuses dans les sables selon NF EN 933-8 (équivalent de sable visuel et au piston).',
  },
  standards: [
    {
      id: 'NF EN 933-8',
      code: 'NF EN 933-8',
      standardBody: 'EN',
      title: {
        en: 'NF EN 933-8: Tests for geometrical properties of aggregates - Part 8: Assessment of fines - Sand equivalent test',
        fr: 'NF EN 933-8 : Essais pour déterminer les caractéristiques géométriques des granulats - Partie 8 : Évaluation des fines - Équivalent de sable',
      },
    },
    {
      id: 'ASTM D2419',
      code: 'ASTM D2419',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM D2419: Standard Test Method for Sand Equivalent Value of Soils and Fine Aggregate',
        fr: 'ASTM D2419 : Méthode normalisée pour la valeur d\'équivalent de sable des sols et granulats fins',
      },
    },
  ],
  defaultStandard: 'NF EN 933-8',
  inputSchema: {
    parameters: [
      {
        key: 'shakingMethod',
        label: { en: 'Shaking Method', fr: 'Méthode d\'agitation' },
        type: 'select',
        defaultValue: 'mechanical',
        options: [
          { value: 'mechanical', label: { en: 'Mechanical shaker (90 cycles / 30s)', fr: 'Agitateur mécanique (90 cycles / 30s)' } },
          { value: 'manual', label: { en: 'Manual shaking', fr: 'Agitation manuelle' } },
        ],
      },
      {
        key: 'agitationDurationMin',
        label: { en: 'Agitation Duration (min)', fr: 'Durée d\'agitation (min)' },
        unit: 'min',
        type: 'number',
        defaultValue: 10,
        min: 1,
        max: 30,
      },
      {
        key: 'settlingDurationMin',
        label: { en: 'Settling Duration (min)', fr: 'Durée de repos / décantation (min)' },
        unit: 'min',
        type: 'number',
        defaultValue: 20,
        min: 10,
        max: 60,
      },
    ],
    table: {
      key: 'specimens',
      label: { en: 'Specimens Measurements', fr: 'Mesures sur Éprouvettes' },
      minRows: 2,
      maxRows: 4,
      columns: [
        { key: 'specimenId', label: { en: 'Specimen #', fr: 'N° Éprouvette' }, type: 'text', required: true },
        { key: 'h1Mm', label: { en: 'H1 Total Height (cm)', fr: 'H1 Hauteur Totale (cm)' }, unit: 'cm', type: 'number', required: true, decimals: 1 },
        { key: 'h2PrimeMm', label: { en: 'H2\' Visual Sand (cm)', fr: 'H2\' Sable Visuel (cm)' }, unit: 'cm', type: 'number', required: true, decimals: 1 },
        { key: 'h2Mm', label: { en: 'H2 Piston Sand (cm)', fr: 'H2 Sable Piston (cm)' }, unit: 'cm', type: 'number', required: true, decimals: 1 },
      ],
      defaultRows: [
        { specimenId: '1', h1Mm: 8.6, h2PrimeMm: 8.4, h2Mm: 8.2 },
        { specimenId: '2', h1Mm: 9.5, h2PrimeMm: 9.3, h2Mm: 9.2 },
      ],
    },
  },

  calculate: (input: SandEquivalentInput): SandEquivalentResults => {
    const raw = input.specimens || [];

    const computedSpecs: SandEquivalentSpecimenResult[] = raw.map((s, idx) => {
      const h1 = s.h1Mm || 0;
      const h2Prime = s.h2PrimeMm || 0;
      const h2 = s.h2Mm || 0;

      const esV = h1 > 0 ? (100 * h2Prime) / h1 : 0;
      const esP = h1 > 0 ? (100 * h2) / h1 : 0;

      return {
        specimenId: s.specimenId || String(idx + 1),
        h1Mm: Number(h1.toFixed(1)),
        h2PrimeMm: Number(h2Prime.toFixed(1)),
        h2Mm: Number(h2.toFixed(1)),
        esVisual: Number(esV.toFixed(2)),
        esPiston: Number(esP.toFixed(2)),
      };
    });

    const esVList = computedSpecs.map((s) => s.esVisual);
    const esPList = computedSpecs.map((s) => s.esPiston);

    const meanV = esVList.length > 0 ? esVList.reduce((a, b) => a + b, 0) / esVList.length : 0;
    const meanP = esPList.length > 0 ? esPList.reduce((a, b) => a + b, 0) / esPList.length : 0;

    const diffV = esVList.length > 1 ? Math.max(...esVList) - Math.min(...esVList) : 0;
    const diffP = esPList.length > 1 ? Math.max(...esPList) - Math.min(...esPList) : 0;

    // Per standard, individual determinations should not differ by more than ~4% for piston
    const repeatability = diffP <= 4.0;

    return {
      specimens: computedSpecs,
      meanEsVisual: Number(meanV.toFixed(2)),
      meanEsPiston: Number(meanP.toFixed(2)),
      differenceEsVisual: Number(diffV.toFixed(2)),
      differenceEsPiston: Number(diffP.toFixed(2)),
      shakingMethod: input.shakingMethod || 'mechanical',
      repeatabilityAccepted: repeatability,
    };
  },

  checks: (input: SandEquivalentInput, results: SandEquivalentResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    const specs = results.specimens || [];

    if (specs.length < 2) {
      warnings.push({
        code: 'SAND_EQUIVALENT_FEWER_THAN_TWO_SPECIMENS',
        level: 'warning',
        message: {
          en: 'NF EN 933-8 requires at least two specimens to calculate the Sand Equivalent value.',
          fr: 'La norme NF EN 933-8 exige au moins deux éprouvettes pour calculer la valeur d\'équivalent de sable.',
        },
      });
    }

    if (input.settlingDurationMin !== undefined && (input.settlingDurationMin < 19 || input.settlingDurationMin > 21)) {
      warnings.push({
        code: 'SAND_EQUIVALENT_NON_STANDARD_SETTLING_TIME',
        level: 'warning',
        message: {
          en: `Settling time (${input.settlingDurationMin} min) deviates from the standard 20 min period.`,
          fr: `Le temps de décantation (${input.settlingDurationMin} min) s'écarte de la durée normalisée de 20 min.`,
        },
      });
    }

    // Geometry check: H2 must be <= H2' and H2' must be <= H1
    for (const s of specs) {
      if (s.h2Mm > s.h2PrimeMm) {
        warnings.push({
          code: 'SAND_EQUIVALENT_PISTON_GREATER_THAN_VISUAL',
          level: 'error',
          message: {
            en: `Specimen ${s.specimenId}: Piston reading H2 (${s.h2Mm}) cannot exceed visual reading H2' (${s.h2PrimeMm}).`,
            fr: `Éprouvette ${s.specimenId} : La lecture piston H2 (${s.h2Mm}) ne peut pas dépasser la lecture visuelle H2' (${s.h2PrimeMm}).`,
          },
        });
      }
      if (s.h2PrimeMm > s.h1Mm) {
        warnings.push({
          code: 'SAND_EQUIVALENT_SAND_GREATER_THAN_TOTAL',
          level: 'error',
          message: {
            en: `Specimen ${s.specimenId}: Sand reading H2' (${s.h2PrimeMm}) exceeds total height H1 (${s.h1Mm}).`,
            fr: `Éprouvette ${s.specimenId} : La hauteur de sable H2' (${s.h2PrimeMm}) dépasse la hauteur totale H1 (${s.h1Mm}).`,
          },
        });
      }
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Sand Equivalent Test Report', fr: 'Procès-Verbal d\'Équivalent de Sable' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Sand Equivalent Summary', fr: 'Synthèse Équivalent de Sable' } },
    {
      type: 'raw_data_table',
      title: { en: 'Specimens Height Readings', fr: 'Lectures des Hauteurs sur Éprouvettes' },
      tableColumns: [
        { key: 'specimenId', label: { en: 'Specimen #', fr: 'N° Éprouvette' }, align: 'center' },
        { key: 'h1Mm', label: { en: 'H1 Total (cm)', fr: 'H1 Total (cm)' }, align: 'right', decimals: 1 },
        { key: 'h2PrimeMm', label: { en: 'H2\' Visual (cm)', fr: 'H2\' Visuel (cm)' }, align: 'right', decimals: 1 },
        { key: 'h2Mm', label: { en: 'H2 Piston (cm)', fr: 'H2 Piston (cm)' }, align: 'right', decimals: 1 },
        { key: 'esVisual', label: { en: 'ESv (%)', fr: 'ESv (%)' }, align: 'right', decimals: 2 },
        { key: 'esPiston', label: { en: 'ESp (%)', fr: 'ESp (%)' }, align: 'right', decimals: 2 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Specification Conformity', fr: 'Conformité aux Spécifications' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: SandEquivalentInput, results: SandEquivalentResults) => ({
    testType: 'sand_equivalent',
    standard: 'NF EN 933-8',
    meanEsVisual: results.meanEsVisual,
    meanEsPiston: results.meanEsPiston,
    repeatabilityAccepted: results.repeatabilityAccepted,
    numberOfSpecimens: results.specimens.length,
    shakingMethod: results.shakingMethod,
  }),

  keyResults: (results: SandEquivalentResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Équivalent de sable au piston (ESp)' : 'Piston Sand Equivalent (ESp)',
      value: results.meanEsPiston ? Number(results.meanEsPiston.toFixed(1)) : '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Équivalent de sable visuel (ESv)' : 'Visual Sand Equivalent (ESv)',
      value: results.meanEsVisual ? Number(results.meanEsVisual.toFixed(1)) : '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Écart entre éprouvettes (ΔESp)' : 'Difference between specimens (ΔESp)',
      value: results.differenceEsPiston ? Number(results.differenceEsPiston.toFixed(1)) : '-',
      unit: '%',
      provenance: 'measured',
    },
  ],
};

