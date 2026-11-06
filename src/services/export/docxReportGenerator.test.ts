import { describe, it, expect } from 'vitest';
import { generateBlastDocxReport } from './docxReportGenerator';
import type { Blast, Project, Site } from '../../types';

describe('FragMill Blast DOCX Report Generator', () => {
  const mockProject: Project = {
    id: 'proj-1',
    name: 'Open Pit Gold Mine A',
    description: 'West Pit Section',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const mockSite: Site = {
    id: 'site-1',
    projectId: 'proj-1',
    name: 'Bench 120 RL',
    locationText: 'North Wall',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  };

  const mockBlast: Blast = {
    id: 'blast-1',
    blastId: 'BL-2026-004',
    siteId: 'site-1',
    dateTime: '2026-11-05T08:30:00Z',
    benchElevation: 120,
    weather: 'Clear / Dry',
    parameters: {
      burden: 3.5,
      spacing: 4.2,
      benchHeight: 12.0,
      holeDiameter: 165,
      holeDepth: 13.5,
      subdrill: 1.5,
      chargePerHole: 180,
      numberOfHoles: 45,
      rockDensity: 2.7,
      explosiveType: 'heavy_anfo',
    },
    images: [
      {
        id: 'img-1',
        blastId: 'blast-1',
        filename: 'muckpile_photo_1.jpg',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        calibration: { method: 'two_point', points: [], realWorldDistanceMm: 500, pxPerMm: 0.45 },
        segmentationRuns: [
          {
            id: 'run-1',
            imageId: 'img-1',
            timestamp: 1700000000000,
            fragments: [{ id: 'f-1', area: 100, equivalentDiameterMm: 85, center: [10, 10] }],
            metrics: {
              p10: 25,
              p20: 45,
              p50: 120,
              p80: 240,
              p90: 310,
              pMax: 520,
              uniformityIndex: 1.25,
              finesPercent: 8.5,
              oversizePercent: 5.2,
            },
          },
        ],
        createdAt: 1700000000000,
      },
      {
        id: 'img-2',
        blastId: 'blast-1',
        filename: 'muckpile_photo_2.jpg',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        calibration: { method: 'two_point', points: [], realWorldDistanceMm: 500, pxPerMm: 0.45 },
        createdAt: 1700000000000,
      },
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  } as unknown as Blast;

  it('generates valid Word (.docx) Blob for blast report with multiple images by embedding just one representative image', async () => {
    const docxBlob = await generateBlastDocxReport(
      mockProject,
      mockSite,
      mockBlast,
      undefined,
      undefined,
      'fr'
    );

    expect(docxBlob).toBeInstanceOf(Blob);
    expect(docxBlob.size).toBeGreaterThan(2000);
    expect(docxBlob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});
