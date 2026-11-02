import { describe, it, expect } from 'vitest';
import { generateGeoLabNarrative } from './aiNarrative';
import type { GeoLabAnalysis } from '../../types/geolab';
import { proctorTestDefinition } from '../tests/proctor';

describe('GeoLab AI Narrative Engine', () => {
  it('generates a compliant deterministic fallback narrative citing exact Proctor metrics without API key', async () => {
    const rawInput = {
      mouldType: 'cbr' as const,
      mouldVolumeCm3: 2124,
      particleDensityGs: 2.82,
      points: [
        { pointIndex: 1, waterContentPercent: 4.3, dryDensityGcm3: 2.115 },
        { pointIndex: 2, waterContentPercent: 6.7, dryDensityGcm3: 2.213 },
        { pointIndex: 3, waterContentPercent: 8.2, dryDensityGcm3: 2.21 },
        { pointIndex: 4, waterContentPercent: 10.5, dryDensityGcm3: 2.129 },
        { pointIndex: 5, waterContentPercent: 12.0, dryDensityGcm3: 2.04 },
      ],
      manualOpmMoisturePercent: 7.3,
      manualOpmDryDensityGcm3: 2.225,
    };
    const computedResults = proctorTestDefinition.calculate(rawInput);

    const analysis: GeoLabAnalysis = {
      id: 'analysis-1',
      sampleId: 'Puit 1',
      testType: 'proctor',
      standard: 'NF P94-093',
      reportNumber: 'GL-2026-0042',
      version: 1,
      status: 'approved',
      testedDate: '2026-10-22',
      rawInput,
      computedResults,
      qualityWarnings: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    };

    const textFr = await generateGeoLabNarrative({
      analysis,
      apiKey: '',
      language: 'fr',
    });

    expect(textFr).toContain('[Rédigé par IA, à valider par l\'ingénieur responsable]');
    expect(textFr).toContain('7.3 %');
    expect(textFr).toContain('2.225 g/cm³');

    const textEn = await generateGeoLabNarrative({
      analysis,
      apiKey: '',
      language: 'en',
    });

    expect(textEn).toContain('[AI-drafted, to be reviewed by the responsible engineer]');
    expect(textEn).toContain('7.3%');
    expect(textEn).toContain('2.225 g/cm³');
  });
});

