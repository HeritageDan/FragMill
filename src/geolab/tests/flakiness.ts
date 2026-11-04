import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface FlakinessClassInput {
  sizeFraction: string; // e.g. '10-12.5', '12.5-16'
  slotWidthMm?: number; // bar sieve slot width in mm
  fractionMassMg: number; // Mg: mass of fraction in g
  passingMassMe: number; // Me: mass passing slot sieve in g
}

export interface FlakinessInput {
  initialTestMassM0?: number; // M0 (g)
  classes: FlakinessClassInput[];
}

export interface FlakinessClassResult {
  sizeFraction: string;
  slotWidthMm: number;
  fractionMassMg: number;
  passingMassMe: number;
  partialFlakinessPercent: number;
}

export interface FlakinessResults {
  classes: FlakinessClassResult[];
  initialTestMassM0?: number;
  totalFractionMassSumMg: number;
  totalPassingMassSumMe: number;
  flakinessIndexA: number; // A = 100 * sum(Me) / sum(Mg)
  massLossPercent?: number; // |sum(Mg) - M0| / M0 * 100
  flakinessCategory?: string; // FI15, FI20, FI25, etc.
}

export const FLAKINESS_STANDARD_CLASSES: Array<{ sizeFraction: string; slotWidthMm: number }> = [
  { sizeFraction: '4 - 5', slotWidthMm: 2.5 },
  { sizeFraction: '5 - 6.3', slotWidthMm: 3.15 },
  { sizeFraction: '6.3 - 8', slotWidthMm: 4 },
  { sizeFraction: '8 - 10', slotWidthMm: 5 },
  { sizeFraction: '10 - 12.5', slotWidthMm: 6.3 },
  { sizeFraction: '12.5 - 16', slotWidthMm: 8 },
  { sizeFraction: '16 - 20', slotWidthMm: 10 },
  { sizeFraction: '20 - 25', slotWidthMm: 12.5 },
  { sizeFraction: '25 - 31.5', slotWidthMm: 16 },
  { sizeFraction: '31.5 - 40', slotWidthMm: 20 },
  { sizeFraction: '40 - 50', slotWidthMm: 25 },
];

export const flakinessTestDefinition: GeoLabTestDefinition<
  FlakinessInput,
  FlakinessResults
> = {
  id: 'flakiness',
  name: {
    en: 'Flakiness Index (Bar Sieves)',
    fr: 'Indice d\'Aplatissement (Grilles à Fentes)',
  },
  shortName: {
    en: 'Flakiness Index',
    fr: 'Indice d\'Aplatissement',
  },
  description: {
    en: 'Determination of particle shape and flakiness index using bar sieves per NF EN 933-3 and NF P18-561.',
    fr: 'Détermination de la forme des granulats et de l\'indice d\'aplatissement aux grilles à fentes selon NF EN 933-3 et NF P18-561.',
  },
  standards: [
    {
      id: 'NF EN 933-3',
      code: 'NF EN 933-3',
      standardBody: 'EN',
      title: {
        en: 'NF EN 933-3: Tests for geometrical properties of aggregates - Part 3: Determination of particle shape - Flakiness index',
        fr: 'NF EN 933-3 : Essais pour déterminer les caractéristiques géométriques des granulats - Partie 3 : Détermination de la forme des granulats - Indice d\'aplatissement',
      },
    },
    {
      id: 'NF P18-561',
      code: 'NF P18-561',
      standardBody: 'NF',
      title: {
        en: 'NF P18-561: Aggregates - Measurement of the flakiness index',
        fr: 'NF P18-561 : Granulats - Mesure du coefficient d\'aplatissement',
      },
    },
  ],
  defaultStandard: 'NF EN 933-3',
  inputSchema: {
    parameters: [
      {
        key: 'initialTestMassM0',
        label: { en: 'Initial Test Portion Mass M0 (g)', fr: 'Masse initiale de la prise M0 (g)' },
        unit: 'g',
        type: 'number',
        helperText: {
          en: 'Total mass of the d/D portion before fractionation',
          fr: 'Masse totale de la fraction d/D avant fractionnement',
        },
      },
    ],
    table: {
      key: 'classes',
      label: { en: 'Granular Fractions on Bar Sieves', fr: 'Fractions Granulaires sur Grilles à Fentes' },
      minRows: 1,
      maxRows: 12,
      columns: [
        { key: 'sizeFraction', label: { en: 'Fraction di/Di (mm)', fr: 'Fraction di/Di (mm)' }, type: 'text', required: true },
        { key: 'slotWidthMm', label: { en: 'Grid Slot Width (mm)', fr: 'Écartement fente (mm)' }, unit: 'mm', type: 'number', decimals: 2 },
        { key: 'fractionMassMg', label: { en: 'Fraction Mass Mg (g)', fr: 'Masse fraction Mg (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
        { key: 'passingMassMe', label: { en: 'Passing Slot Me (g)', fr: 'Passant grille Me (g)' }, unit: 'g', type: 'number', required: true, decimals: 1 },
      ],
      defaultRows: [
        { sizeFraction: '6.3 - 8', slotWidthMm: 4, fractionMassMg: 200, passingMassMe: 20 },
        { sizeFraction: '8 - 10', slotWidthMm: 5, fractionMassMg: 300, passingMassMe: 45 },
        { sizeFraction: '10 - 12.5', slotWidthMm: 6.3, fractionMassMg: 300, passingMassMe: 50 },
        { sizeFraction: '12.5 - 16', slotWidthMm: 8, fractionMassMg: 200, passingMassMe: 35 },
      ],
    },
  },

  calculate: (input: FlakinessInput): FlakinessResults => {
    const raw = input.classes || [];

    const computedClasses: FlakinessClassResult[] = raw.map((c) => {
      const mg = c.fractionMassMg || 0;
      const me = c.passingMassMe || 0;
      const slot = c.slotWidthMm || 0;
      const partial = mg > 0 ? (100 * me) / mg : 0;
      return {
        sizeFraction: c.sizeFraction,
        slotWidthMm: slot,
        fractionMassMg: Number(mg.toFixed(1)),
        passingMassMe: Number(me.toFixed(1)),
        partialFlakinessPercent: Number(partial.toFixed(2)),
      };
    });

    const sumMg = computedClasses.reduce((acc, c) => acc + c.fractionMassMg, 0);
    const sumMe = computedClasses.reduce((acc, c) => acc + c.passingMassMe, 0);

    const flakinessA = sumMg > 0 ? (100 * sumMe) / sumMg : 0;
    const finalA = Number(flakinessA.toFixed(1));

    let massLoss: number | undefined;
    if (input.initialTestMassM0 && input.initialTestMassM0 > 0) {
      massLoss = Number(((Math.abs(sumMg - input.initialTestMassM0) / input.initialTestMassM0) * 100).toFixed(2));
    }

    let cat = 'FI_NR';
    if (finalA <= 15) cat = 'FI15';
    else if (finalA <= 20) cat = 'FI20';
    else if (finalA <= 25) cat = 'FI25';
    else if (finalA <= 30) cat = 'FI30';
    else if (finalA <= 35) cat = 'FI35';
    else if (finalA <= 50) cat = 'FI50';

    return {
      classes: computedClasses,
      initialTestMassM0: input.initialTestMassM0,
      totalFractionMassSumMg: Number(sumMg.toFixed(1)),
      totalPassingMassSumMe: Number(sumMe.toFixed(1)),
      flakinessIndexA: finalA,
      massLossPercent: massLoss,
      flakinessCategory: cat,
    };
  },

  checks: (input: FlakinessInput, results: FlakinessResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];

    if (results.massLossPercent !== undefined && results.massLossPercent > 2.0) {
      warnings.push({
        code: 'FLAKINESS_MASS_BALANCE_EXCEEDED',
        level: 'warning',
        message: {
          en: `Mass loss during fractionation (|ΣMg - M0| / M0 = ${results.massLossPercent}%) exceeds the 2% threshold prescribed by NF EN 933-3.`,
          fr: `La perte de masse lors du fractionnement (|ΣMg - M0| / M0 = ${results.massLossPercent}%) dépasse le seuil de 2% prescrit par NF EN 933-3.`,
        },
      });
    }

    for (const c of results.classes) {
      if (c.passingMassMe > c.fractionMassMg) {
        warnings.push({
          code: 'FLAKINESS_PASSING_GREATER_THAN_FRACTION',
          level: 'error',
          message: {
            en: `Fraction ${c.sizeFraction}: Passing mass Me (${c.passingMassMe}g) cannot exceed fraction mass Mg (${c.fractionMassMg}g).`,
            fr: `Fraction ${c.sizeFraction} : Le passant grille Me (${c.passingMassMe}g) ne peut pas dépasser la masse de la fraction Mg (${c.fractionMassMg}g).`,
          },
        });
      }
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Flakiness Index Test Report', fr: 'Procès-Verbal d\'Indice d\'Aplatissement' } },
    { type: 'client_project' },
    { type: 'results_table', title: { en: 'Flakiness Index Summary', fr: 'Synthèse Indice d\'Aplatissement' } },
    {
      type: 'raw_data_table',
      title: { en: 'Fraction Sieving on Bar Sieves', fr: 'Tamisage des Fractions sur Grilles' },
      tableColumns: [
        { key: 'sizeFraction', label: { en: 'Fraction di/Di (mm)', fr: 'Fraction di/Di (mm)' }, align: 'center' },
        { key: 'slotWidthMm', label: { en: 'Slot (mm)', fr: 'Fente (mm)' }, align: 'right', decimals: 1 },
        { key: 'fractionMassMg', label: { en: 'Mg (g)', fr: 'Mg (g)' }, align: 'right', decimals: 1 },
        { key: 'passingMassMe', label: { en: 'Me (g)', fr: 'Me (g)' }, align: 'right', decimals: 1 },
        { key: 'partialFlakinessPercent', label: { en: 'Partial FI (%)', fr: 'FI partiel (%)' }, align: 'right', decimals: 1 },
      ],
    },
    { type: 'conformity_table', title: { en: 'Conformity & Category', fr: 'Conformité et Catégorie' } },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: FlakinessInput, results: FlakinessResults) => ({
    testType: 'flakiness',
    standard: 'NF EN 933-3',
    flakinessIndexA: results.flakinessIndexA,
    category: results.flakinessCategory,
    totalMassMg: results.totalFractionMassSumMg,
    numberOfFractions: results.classes.length,
  }),

  keyResults: (results: FlakinessResults, lang: 'en' | 'fr') => [
    {
      label: lang === 'fr' ? 'Indice d\'aplatissement (A)' : 'Flakiness Index (FI)',
      value: results.flakinessIndexA !== undefined ? Number(results.flakinessIndexA.toFixed(1)) : '-',
      unit: '%',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Catégorie normative' : 'Standard Category',
      value: results.flakinessCategory || '-',
      provenance: 'measured',
    },
    {
      label: lang === 'fr' ? 'Masse totale testée (ΣMg)' : 'Total tested mass (ΣMg)',
      value: results.totalFractionMassSumMg ? Number(results.totalFractionMassSumMg.toFixed(1)) : '-',
      unit: 'g',
      provenance: 'measured',
    },
  ],
};
