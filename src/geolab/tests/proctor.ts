import type { GeoLabTestDefinition } from './types';
import type { QualityWarning } from '../../types/geolab';

export interface ProctorPointInput {
  pointIndex: number;
  wetSoilPlusMouldG?: number;
  mouldMassG?: number;
  wetSoilMassG?: number;
  tareMassG?: number;
  wetSoilPlusTareG?: number;
  drySoilPlusTareG?: number;
  waterContentPercent?: number;
  wetDensityGcm3?: number;
  dryDensityGcm3?: number;
}

export interface ProctorInput {
  mouldType: 'normal' | 'modified' | 'cbr';
  mouldVolumeCm3: number; // e.g. 948, 944, or 2124
  particleDensityGs: number; // e.g. 2.70, 2.82
  targetCompactionPercent?: number; // e.g. 95%
  manualOpmMoisturePercent?: number; // optional manual override
  manualOpmDryDensityGcm3?: number; // optional manual override
  points: ProctorPointInput[];
}

export interface ProctorPointResult {
  pointIndex: number;
  waterContentPercent: number;
  wetDensityGcm3: number;
  dryDensityGcm3: number;
  saturationWaterContentPercent: number; // Sr = 100%
  compactionPercentOfOpm?: number;
}

export interface ProctorResults {
  points: ProctorPointResult[];
  opmMoisturePercent: number; // w_opm %
  maxDryDensityGcm3: number; // ρd_max g/cm3
  targetDryDensityGcm3: number; // 95% of ρd_max
  fittedCoefficients: { a: number; b: number; c: number; r2: number };
  saturationCurve: Array<{ dryDensityGcm3: number; saturationWaterContentPercent: number }>;
  isConform: boolean;
}

export const proctorTestDefinition: GeoLabTestDefinition<ProctorInput, ProctorResults> = {
  id: 'proctor',
  name: {
    en: 'Proctor Compaction Test',
    fr: 'Essai Proctor',
  },
  shortName: {
    en: 'Proctor',
    fr: 'Proctor',
  },
  description: {
    en: 'Determination of the compaction characteristics of soil (Normal & Modified Proctor curves and Optimum Moisture Content).',
    fr: 'Détermination des caractéristiques de compactage d’un sol (Courbes Proctor Normal et Modifié et Optimum Proctor).',
  },
  standards: [
    {
      id: 'NF P94-093',
      code: 'NF P94-093',
      standardBody: 'NF',
      title: {
        en: 'NF P94-093: Soil compaction test - Proctor Normal / Proctor Modified',
        fr: 'NF P94-093 : Sols : reconnaissance et essais - Détermination des références de compactage d\'un matériau',
      },
    },
    {
      id: 'ASTM D698',
      code: 'ASTM D698',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM D698: Standard Test Methods for Laboratory Compaction Characteristics of Soil (Standard Effort)',
        fr: 'ASTM D698 : Caractéristiques de compactage en laboratoire (Effort standard)',
      },
    },
    {
      id: 'ASTM D1557',
      code: 'ASTM D1557',
      standardBody: 'ASTM',
      title: {
        en: 'ASTM D1557: Standard Test Methods for Laboratory Compaction Characteristics of Soil (Modified Effort)',
        fr: 'ASTM D1557 : Caractéristiques de compactage en laboratoire (Effort modifié)',
      },
    },
    {
      id: 'AASHTO T99',
      code: 'AASHTO T99',
      standardBody: 'AASHTO',
      title: {
        en: 'AASHTO T99: Moisture-Density Relations of Soils (Standard)',
        fr: 'AASHTO T99 : Relations humidité-densité des sols (Standard)',
      },
    },
    {
      id: 'AASHTO T180',
      code: 'AASHTO T180',
      standardBody: 'AASHTO',
      title: {
        en: 'AASHTO T180: Moisture-Density Relations of Soils (Modified)',
        fr: 'AASHTO T180 : Relations humidité-densité des sols (Modifié)',
      },
    },
  ],
  defaultStandard: 'NF P94-093',
  inputSchema: {
    parameters: [
      {
        key: 'mouldType',
        label: { en: 'Mould Type', fr: 'Type de Moule' },
        type: 'select',
        required: true,
        defaultValue: 'cbr',
        options: [
          { value: 'normal', label: { en: 'Proctor Mould (V ≈ 948 cm³)', fr: 'Moule Proctor (V ≈ 948 cm³)' } },
          { value: 'modified', label: { en: 'Proctor Modified (V ≈ 948 cm³)', fr: 'Moule Proctor Modifié (V ≈ 948 cm³)' } },
          { value: 'cbr', label: { en: 'CBR Mould (V ≈ 2124 cm³)', fr: 'Moule CBR (V ≈ 2124 cm³)' } },
        ],
      },
      {
        key: 'mouldVolumeCm3',
        label: { en: 'Mould Volume', fr: 'Volume du moule' },
        type: 'number',
        unit: 'cm³',
        required: true,
        defaultValue: 2124,
        min: 500,
        max: 5000,
      },
      {
        key: 'particleDensityGs',
        label: { en: 'Particle Density (ρs)', fr: 'Poids spécifique des grains (ρs)' },
        type: 'number',
        unit: 'g/cm³',
        required: true,
        defaultValue: 2.82,
        min: 2.0,
        max: 3.5,
        step: 0.01,
      },
      {
        key: 'targetCompactionPercent',
        label: { en: 'Target Compaction Ratio', fr: 'Taux de compactage cible' },
        type: 'number',
        unit: '%',
        defaultValue: 95,
        min: 80,
        max: 105,
      },
      {
        key: 'manualOpmMoisturePercent',
        label: { en: 'Confirmed OPM Moisture (w_opm)', fr: 'Teneur en eau OPM confirmée (w_opm)' },
        type: 'number',
        unit: '%',
        step: 0.1,
        helperText: {
          en: 'Leave empty to auto-derive from polynomial peak',
          fr: 'Laisser vide pour calcul automatique par le sommet polynomial',
        },
      },
      {
        key: 'manualOpmDryDensityGcm3',
        label: { en: 'Confirmed Max Dry Density (ρd_opm)', fr: 'Densité sèche OPM confirmée (ρd_opm)' },
        type: 'number',
        unit: 'g/cm³',
        step: 0.001,
        helperText: {
          en: 'Leave empty to auto-derive from polynomial peak',
          fr: 'Laisser vide pour calcul automatique par le sommet polynomial',
        },
      },
    ],
    table: {
      key: 'points',
      label: { en: 'Compaction Points', fr: 'Points de compactage' },
      minRows: 3,
      maxRows: 10,
      columns: [
        { key: 'pointIndex', label: { en: 'Point #', fr: 'N° Point' }, type: 'number', required: true },
        { key: 'waterContentPercent', label: { en: 'Moisture w', fr: 'Teneur en eau w' }, unit: '%', type: 'number', required: true, decimals: 1 },
        { key: 'dryDensityGcm3', label: { en: 'Dry Density ρd', fr: 'Densité sèche ρd' }, unit: 'g/cm³', type: 'number', required: true, decimals: 3 },
        { key: 'wetDensityGcm3', label: { en: 'Wet Density ρ', fr: 'Densité humide ρ' }, unit: 'g/cm³', type: 'number', decimals: 3 },
      ],
      defaultRows: [
        { pointIndex: 1, waterContentPercent: 4.3, dryDensityGcm3: 2.115, wetDensityGcm3: 2.206 },
        { pointIndex: 2, waterContentPercent: 6.7, dryDensityGcm3: 2.213, wetDensityGcm3: 2.361 },
        { pointIndex: 3, waterContentPercent: 8.2, dryDensityGcm3: 2.210, wetDensityGcm3: 2.391 },
        { pointIndex: 4, waterContentPercent: 10.5, dryDensityGcm3: 2.129, wetDensityGcm3: 2.353 },
        { pointIndex: 5, waterContentPercent: 12.0, dryDensityGcm3: 2.040, wetDensityGcm3: 2.285 },
      ],
    },
  },

  calculate: (input: ProctorInput): ProctorResults => {
    const points = input.points || [];
    const gs = input.particleDensityGs > 0 ? input.particleDensityGs : 2.70;
    const mouldVol = input.mouldVolumeCm3 > 0 ? input.mouldVolumeCm3 : 2124;

    const computedPoints: ProctorPointResult[] = points.map((p, idx) => {
      let w = p.waterContentPercent;
      if (w === undefined || w === null) {
        if (p.wetSoilPlusTareG !== undefined && p.drySoilPlusTareG !== undefined && p.tareMassG !== undefined) {
          const dryMass = p.drySoilPlusTareG - p.tareMassG;
          const waterMass = p.wetSoilPlusTareG - p.drySoilPlusTareG;
          w = dryMass > 0 ? (waterMass / dryMass) * 100 : 0;
        } else {
          w = 0;
        }
      }

      let rhoWet = p.wetDensityGcm3;
      if ((rhoWet === undefined || rhoWet === null) && p.wetSoilMassG !== undefined && mouldVol > 0) {
        rhoWet = p.wetSoilMassG / mouldVol;
      } else if ((rhoWet === undefined || rhoWet === null) && p.wetSoilPlusMouldG !== undefined && p.mouldMassG !== undefined) {
        rhoWet = (p.wetSoilPlusMouldG - p.mouldMassG) / mouldVol;
      }

      let rhoDry = p.dryDensityGcm3;
      if (rhoDry === undefined || rhoDry === null) {
        if (rhoWet !== undefined && rhoWet !== null && rhoWet > 0) {
          rhoDry = rhoWet / (1 + w / 100);
        } else {
          rhoDry = 0;
        }
      }

      if ((rhoWet === undefined || rhoWet === null || rhoWet === 0) && rhoDry > 0) {
        rhoWet = rhoDry * (1 + w / 100);
      }

      // Saturation water content for Sr = 100%
      // w_sat = 100 * (1/rhoDry - 1/gs)
      const wSat = rhoDry > 0 ? 100 * (1 / rhoDry - 1 / gs) : 0;

      return {
        pointIndex: p.pointIndex || idx + 1,
        waterContentPercent: Number(w.toFixed(2)),
        wetDensityGcm3: Number((rhoWet ?? 0).toFixed(3)),
        dryDensityGcm3: Number(rhoDry.toFixed(3)),
        saturationWaterContentPercent: Number(Math.max(0, wSat).toFixed(2)),
      };
    });

    // Fit quadratic polynomial: rho_d = a * w^2 + b * w + c
    let sumX4 = 0, sumX3 = 0, sumX2 = 0, sumX = 0, n = computedPoints.length;
    let sumX2Y = 0, sumXY = 0, sumY = 0;

    for (const pt of computedPoints) {
      const x = pt.waterContentPercent;
      const y = pt.dryDensityGcm3;
      const x2 = x * x;
      sumX += x;
      sumX2 += x2;
      sumX3 += x2 * x;
      sumX4 += x2 * x2;
      sumY += y;
      sumXY += x * y;
      sumX2Y += x2 * y;
    }

    let a = 0, b = 0, c = 0, r2 = 0;
    if (n >= 3) {
      const D =
        sumX4 * (sumX2 * n - sumX * sumX) -
        sumX3 * (sumX3 * n - sumX * sumX2) +
        sumX2 * (sumX3 * sumX - sumX2 * sumX2);

      if (Math.abs(D) > 1e-12) {
        const Da =
          sumX2Y * (sumX2 * n - sumX * sumX) -
          sumX3 * (sumXY * n - sumX * sumY) +
          sumX2 * (sumXY * sumX - sumX2 * sumY);

        const Db =
          sumX4 * (sumXY * n - sumX * sumY) -
          sumX2Y * (sumX3 * n - sumX * sumX2) +
          sumX2 * (sumX3 * sumY - sumXY * sumX2);

        const Dc =
          sumX4 * (sumX2 * sumY - sumXY * sumX) -
          sumX3 * (sumX3 * sumY - sumXY * sumX2) +
          sumX2Y * (sumX3 * sumX - sumX2 * sumX2);

        a = Da / D;
        b = Db / D;
        c = Dc / D;

        // Compute R^2
        const yMean = sumY / n;
        let ssTot = 0, ssRes = 0;
        for (const pt of computedPoints) {
          const x = pt.waterContentPercent;
          const y = pt.dryDensityGcm3;
          const yPred = a * x * x + b * x + c;
          ssTot += (y - yMean) ** 2;
          ssRes += (y - yPred) ** 2;
        }
        r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
      }
    }

    let autoWopm = 0;
    let autoRhoMax = 0;

    if (a < 0 && Math.abs(a) > 1e-9) {
      autoWopm = -b / (2 * a);
      autoRhoMax = a * autoWopm * autoWopm + b * autoWopm + c;
    } else {
      // Fallback: pick the highest measured point
      let maxPt = computedPoints[0];
      for (const pt of computedPoints) {
        if (pt.dryDensityGcm3 > (maxPt ? maxPt.dryDensityGcm3 : 0)) {
          maxPt = pt;
        }
      }
      autoWopm = maxPt ? maxPt.waterContentPercent : 0;
      autoRhoMax = maxPt ? maxPt.dryDensityGcm3 : 0;
    }

    const opmMoisturePercent =
      input.manualOpmMoisturePercent !== undefined && input.manualOpmMoisturePercent !== null && input.manualOpmMoisturePercent > 0
        ? Number(input.manualOpmMoisturePercent)
        : Number(autoWopm.toFixed(2));

    const maxDryDensityGcm3 =
      input.manualOpmDryDensityGcm3 !== undefined && input.manualOpmDryDensityGcm3 !== null && input.manualOpmDryDensityGcm3 > 0
        ? Number(input.manualOpmDryDensityGcm3)
        : Number(autoRhoMax.toFixed(3));

    const targetRatio = (input.targetCompactionPercent || 95) / 100;
    const targetDryDensityGcm3 = Number((maxDryDensityGcm3 * targetRatio).toFixed(3));

    // Calculate compaction ratio per point
    computedPoints.forEach((p) => {
      if (maxDryDensityGcm3 > 0) {
        p.compactionPercentOfOpm = Number(((p.dryDensityGcm3 / maxDryDensityGcm3) * 100).toFixed(1));
      }
    });

    // Generate zero-air-voids saturation curve points
    const saturationCurve: Array<{ dryDensityGcm3: number; saturationWaterContentPercent: number }> = [];
    if (computedPoints.length > 0) {
      const minRho = Math.min(...computedPoints.map((p) => p.dryDensityGcm3)) * 0.95;
      const maxRho = Math.max(maxDryDensityGcm3, ...computedPoints.map((p) => p.dryDensityGcm3)) * 1.05;
      const steps = 10;
      const stepSize = (maxRho - minRho) / steps;
      for (let i = 0; i <= steps; i++) {
        const rho = minRho + i * stepSize;
        const wSat = 100 * (1 / rho - 1 / gs);
        if (wSat >= 0) {
          saturationCurve.push({
            dryDensityGcm3: Number(rho.toFixed(3)),
            saturationWaterContentPercent: Number(wSat.toFixed(2)),
          });
        }
      }
    }

    return {
      points: computedPoints,
      opmMoisturePercent,
      maxDryDensityGcm3,
      targetDryDensityGcm3,
      fittedCoefficients: {
        a: Number(a.toFixed(7)),
        b: Number(b.toFixed(5)),
        c: Number(c.toFixed(4)),
        r2: Number(r2.toFixed(3)),
      },
      saturationCurve,
      isConform: maxDryDensityGcm3 >= targetDryDensityGcm3,
    };
  },

  checks: (input: ProctorInput, results: ProctorResults): QualityWarning[] => {
    const warnings: QualityWarning[] = [];
    const pts = results.points || [];

    if (pts.length < 3) {
      warnings.push({
        code: 'PROCTOR_TOO_FEW_POINTS',
        level: 'error',
        message: {
          en: `At least 3 points required to define a compaction curve (found ${pts.length}).`,
          fr: `Au moins 3 points sont requis pour définir une courbe de compactage (${pts.length} trouvé(s)).`,
        },
      });
    } else if (pts.length < 5) {
      warnings.push({
        code: 'PROCTOR_POINTS_RECOMMENDED',
        level: 'warning',
        message: {
          en: `5 points are recommended according to standard NF P94-093 / ASTM D698 (currently ${pts.length}).`,
          fr: `5 points sont recommandés selon la norme NF P94-093 / ASTM D698 (actuellement ${pts.length}).`,
        },
      });
    }

    // Check if points exist on both sides of optimum
    const drySide = pts.filter((p) => p.waterContentPercent < results.opmMoisturePercent);
    const wetSide = pts.filter((p) => p.waterContentPercent > results.opmMoisturePercent);

    if (pts.length >= 3 && (drySide.length === 0 || wetSide.length === 0)) {
      warnings.push({
        code: 'PROCTOR_ASYMMETRIC_POINTS',
        level: 'warning',
        message: {
          en: 'Compaction curve does not adequately capture both dry and wet limbs of the optimum.',
          fr: 'La courbe de compactage ne couvre pas distinctement les branches sèche et humide de l’optimum.',
        },
      });
    }

    // Check if any point exceeds 100% saturation (physically impossible)
    for (const p of pts) {
      if (p.waterContentPercent > p.saturationWaterContentPercent + 0.5) {
        warnings.push({
          code: 'PROCTOR_SUPER_SATURATED',
          level: 'error',
          message: {
            en: `Point ${p.pointIndex} (w=${p.waterContentPercent}%, ρd=${p.dryDensityGcm3}) exceeds the 100% Zero-Air-Voids line (${p.saturationWaterContentPercent}%). Verify particle density ρs.`,
            fr: `Le point ${p.pointIndex} (w=${p.waterContentPercent}%, ρd=${p.dryDensityGcm3}) dépasse la courbe de saturation à 100% (${p.saturationWaterContentPercent}%). Vérifier la masse volumique des grains ρs.`,
          },
        });
      }
    }

    // Check plausible dry density range
    if (results.maxDryDensityGcm3 < 1.2 || results.maxDryDensityGcm3 > 2.6) {
      warnings.push({
        code: 'PROCTOR_IMPLAUSIBLE_DENSITY',
        level: 'warning',
        message: {
          en: `Maximum dry density ${results.maxDryDensityGcm3} g/cm³ is outside standard soil ranges (1.4 - 2.45 g/cm³).`,
          fr: `La densité sèche maximale ${results.maxDryDensityGcm3} g/cm³ se situe hors des plages habituelles des sols (1,4 - 2,45 g/cm³).`,
        },
      });
    }

    return warnings;
  },

  reportLayout: [
    { type: 'header', title: { en: 'Proctor Compaction Report', fr: 'Procès-Verbal d\'Essai Proctor' } },
    { type: 'client_project' },
    {
      type: 'results_table',
      title: { en: 'Key Proctor Parameters', fr: 'Caractéristiques de Compactage' },
    },
    {
      type: 'chart',
      title: { en: 'Compaction & Saturation Curves', fr: 'Courbe Proctor et Ligne de Saturation' },
      chartConfig: {
        chartType: 'scatter',
        title: { en: 'Compaction Curve', fr: 'Courbe Proctor' },
        xLabel: { en: 'Water Content w (%)', fr: 'Teneur en eau w (%)' },
        yLabel: { en: 'Dry Density ρd (g/cm³)', fr: 'Densité sèche ρd (g/cm³)' },
        series: [
          {
            name: { en: 'Measured Compaction Points', fr: 'Points mesurés' },
            xKey: 'waterContentPercent',
            yKey: 'dryDensityGcm3',
            color: '#1e40af',
            marker: 'circle',
            trendline: 'polynomial',
            polynomialOrder: 2,
          },
          {
            name: { en: 'Saturation Line (Sr=100%)', fr: 'Ligne de saturation (Sr=100%)' },
            xKey: 'saturationWaterContentPercent',
            yKey: 'dryDensityGcm3',
            color: '#dc2626',
            lineStyle: 'dashed',
            marker: 'none',
          },
        ],
      },
    },
    {
      type: 'raw_data_table',
      title: { en: 'Experimental Points & Measurements', fr: 'Tableau des Points d\'Essai' },
      tableColumns: [
        { key: 'pointIndex', label: { en: 'Point', fr: 'Point' }, align: 'center' },
        { key: 'waterContentPercent', label: { en: 'Water Content w (%)', fr: 'Teneur en eau w (%)' }, align: 'right', decimals: 1 },
        { key: 'wetDensityGcm3', label: { en: 'Wet Density ρ (g/cm³)', fr: 'Masse vol. humide ρ (g/cm³)' }, align: 'right', decimals: 3 },
        { key: 'dryDensityGcm3', label: { en: 'Dry Density ρd (g/cm³)', fr: 'Masse vol. sèche ρd (g/cm³)' }, align: 'right', decimals: 3 },
        { key: 'compactionPercentOfOpm', label: { en: 'Compaction (% OPM)', fr: 'Compacité (% OPM)' }, align: 'right', decimals: 1 },
        { key: 'saturationWaterContentPercent', label: { en: 'w_sat at 100% (%)', fr: 'w_sat à 100% (%)' }, align: 'right', decimals: 2 },
      ],
    },
    {
      type: 'conformity_table',
      title: { en: 'Compaction Verification', fr: 'Vérification de la Compacité' },
    },
    { type: 'observations' },
    { type: 'signatures' },
    { type: 'footer' },
  ],

  aiPromptContext: (input: ProctorInput, results: ProctorResults) => ({
    testType: 'proctor',
    standard: 'NF P94-093 / ASTM D698',
    opmMoisturePercent: results.opmMoisturePercent,
    maxDryDensityGcm3: results.maxDryDensityGcm3,
    targetDryDensityGcm3: results.targetDryDensityGcm3,
    particleDensityGs: input.particleDensityGs,
    numberOfPoints: results.points.length,
    r2Fit: results.fittedCoefficients.r2,
    points: results.points.map((p) => ({
      index: p.pointIndex,
      w: p.waterContentPercent,
      rhoD: p.dryDensityGcm3,
      compactionPercent: p.compactionPercentOfOpm,
    })),
  }),
};
