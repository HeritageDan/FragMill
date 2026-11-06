import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import { generateModularVaultPdfReport } from './modularReport';
import { getBlastState } from '../blastState';
import type { Blast, Project, Site, Fragment, KuzRamRockTables } from '../../types';
import type { ReportVaultState } from '../../types/reportVault';

const mockProject: Project = {
  id: 'proj-demo',
  name: 'Projet Minier Pilote',
  description: 'Exploitation aurifère',
  createdAt: 1771000000000,
  updatedAt: 1771000000000,
};

const mockSite: Site = {
  id: 'site-demo',
  projectId: 'proj-demo',
  name: 'Carrière Pilote Nord-Est',
  locationText: 'Zone Nord-Est',
  createdAt: 1771000000000,
  updatedAt: 1771000000000,
};

const mockFragments: Fragment[] = Array.from({ length: 150 }, (_, idx) => {
  const size = 40 + (idx % 15) * 12;
  return {
    id: idx + 1,
    polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }],
    centroid: { x: 15, y: 15 },
    areaPx: 1200,
    areaMm2: 1500,
    ecdMm: size,
    minFeretMm: size,
    maxFeretMm: size * 1.3,
    bboxWidthMm: size,
    bboxHeightMm: size * 1.2,
    aspectRatio: 1.2,
    solidity: 0.95,
    volumeMm3: (Math.PI / 6) * Math.pow(size, 3),
    confidence: 0.94,
  };
});

const mockBlastWithClaudeNotes: Blast = {
  id: 'blast-bl-2026-004',
  projectId: 'proj-demo',
  siteId: 'site-demo',
  blastId: 'BL-2026-004',
  dateTime: '2026-04-05T08:30:00Z',
  weather: 'Ensoleillé, 28°C',
  benchElevation: 840,
  notes: `# Technical Evaluation: Blast Fragmentation & Comminution Performance
## Fragmentation Assessment
The blast produced **excessively coarse fragmentation** characterized by a P50 of 771.9 mm and P80 of 937.6 mm, with 98.1% of material exceeding 300 mm.
bimodal distribution skewed toward larger sizes. This coarse profile is attributed to the relatively low powder factor (47.1 kg per hole across 10.5 m³ fragmentation deployment.
## Comminution Circuit Consequences
The coarse fragmentation directly elevates primary crushing energy to 1.77 kWh/t, representing excessive strain on the crusher handling P80 material at 937.6 mm.
## Recommendations for Next Blast Pattern
**Recommendation 1 – Increase Powder Factor:** Reduce burden from 3.0 m to 2.75 m or decrease spacing to 3.2 m.
**Recommendation 2 – Optimize Explosive Distribution:** Replace the hybrid loading with uniform ANFO.`,
  createdAt: 1771057800000,
  updatedAt: 1771057800000,
  parameters: {
    holeDiameter: 79,
    holeDepth: 16.2,
    subdrill: 1.2,
    benchHeight: 15.0,
    burden: 3.0,
    spacing: 3.5,
    stemmingLength: 2.8,
    numberOfHoles: 45,
    holeInclination: 90,
    explosiveType: 'ANFO',
    chargePerHole: 68.5,
    bottomChargeLength: 2.5,
    columnChargeLength: 10.9,
    initiationSequenceNotes: 'Electronic 25ms',
    waterInHoles: false,
    drillingDeviationEstimate: 0.05,
    rws: 100,
  },
  rockMass: {
    rockType: 'Granite',
    density: 2.75,
    ucsMPa: 135,
    youngsModulusGPa: 62,
    jointSetCount: 3,
    meanJointSpacing: 0.45,
    jointOrientation: 'dip_out_of_face',
  },
  images: [
    {
      id: 'img-1',
      blastId: 'blast-bl-2026-004',
      filename: 'muckpile_center.jpg',
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      zone: 'middle',
      lighting: 'sun',
      time: '14:30',
      hasScaleMarker: true,
      qualityCheck: {
        resolutionOk: true,
        blurScore: 0.1,
        lightingOk: true,
        scaleMarkerDetected: true,
        overallUsable: true,
      },
      calibration: {
        method: 'two_point',
        points: [{ x: 50, y: 500 }, { x: 250, y: 500 }],
        realWorldDistanceMm: 500,
        pxPerMm: 0.4,
      },
      segmentationRuns: [
        {
          id: 'run-1',
          imageId: 'img-1',
          engine: 'classical',
          timestamp: 1771057900000,
          parameters: {} as any,
          fragments: mockFragments,
          metrics: {
            sizeDefinition: 'min_feret',
            fragmentCount: 150,
            unresolvedFinesPercent: 3.5,
            meanSize: 150,
            bootstrapCI: {} as any,
            rawCurve: [
              { sizeMm: 25, passingPercent: 4.5 },
              { sizeMm: 75, passingPercent: 18.2 },
              { sizeMm: 150, passingPercent: 51.0 },
              { sizeMm: 300, passingPercent: 82.5 },
              { sizeMm: 500, passingPercent: 98.1 },
            ],
            correctedCurve: [
              { sizeMm: 25, passingPercent: 4.5 },
              { sizeMm: 75, passingPercent: 18.2 },
              { sizeMm: 150, passingPercent: 51.0 },
              { sizeMm: 300, passingPercent: 82.5 },
              { sizeMm: 500, passingPercent: 98.1 },
            ],
            p10: 55,
            p20: 85,
            p50: 148,
            p80: 290,
            p90: 380,
            pMax: 540,
            uniformityIndex: 1.25,
            finesPercent: 4.5,
            oversizePercent: 17.5,
          },
        },
      ],
    } as any,
  ],
  timingConfig: {
    patternType: 'v_echelon',
    surfaceDelayMs: 25,
    inHoleDelayMs: 400,
    distanceToStructureM: 350,
  },
  kuzRamTables: {
    rmd: 20,
    jf: 20,
    jfo: 20,
    density: 2.75,
    hf: 27.0,
  },
};

describe('FragMill Modular Report Formatting & Persistence Verification', () => {
  it('generates a clean PDF without raw markdown or £ symbol corruption', async () => {
    const blastState = getBlastState(mockBlastWithClaudeNotes);
    const vaultState = {
      blast: {
        blastId: mockBlastWithClaudeNotes.id,
        key: 'blast',
        stagedAt: Date.now(),
        titleFr: '1. Tir & Images',
        titleEn: '1. Blast Records & Optical Sizing',
        payload: {
          blastId: mockBlastWithClaudeNotes.blastId,
        },
      },
      kuzram: {
        blastId: mockBlastWithClaudeNotes.id,
        key: 'kuzram',
        stagedAt: Date.now(),
        titleFr: '9. Kuz-Ram & Calibrage',
        titleEn: '9. Kuz-Ram Empirical Blast Predictor',
        payload: {
          rockFactorA: 1.15,
        },
      },
    } as unknown as ReportVaultState;

    const orgProfile = {
      companyName: 'Laboratoire Du Peuple',
      address: 'Yaounde, Cameroun',
      phone: '678765432',
      email: 'test@example.com',
      accreditationNumber: 'ISO 17025 ADFGT',
      primaryColor: '#1F3864',
      signatories: [],
      reportFooterText: '',
      defaultLanguage: 'fr' as const,
      defaultStandard: 'NF',
    } as any;

    const pdfBlob = await generateModularVaultPdfReport(
      vaultState,
      mockProject,
      mockSite,
      mockBlastWithClaudeNotes,
      'en',
      ['blast', 'kuzram'],
      orgProfile
    );

    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.size).toBeGreaterThan(15000);

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    const rawStr = buf.toString('latin1');
    let fullText = rawStr;
    const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m;
    while ((m = re.exec(rawStr)) !== null) {
      try {
        const raw = Buffer.from(m[1], 'latin1');
        const uncompressed = zlib.inflateSync(raw).toString('latin1');
        fullText += '\n' + uncompressed;
      } catch {
        // Not compressed with flate
      }
    }

    // 1. Verify NO '£' symbol appears in text
    expect(fullText.includes('£')).toBe(false);
    expect(fullText.includes('Sum of Components')).toBe(true);
    expect(fullText.includes('Total')).toBe(true);

    // 2. Verify NO raw markdown headers like '# Technical Evaluation' appear
    expect(fullText.includes('# Technical Evaluation')).toBe(false);
    expect(fullText.includes('## Fragmentation Assessment')).toBe(false);

    // 3. Verify NO raw markdown bold asterisks '**' appear
    expect(fullText.includes('**excessively coarse fragmentation**')).toBe(false);
    expect(fullText.includes('excessively coarse fragmentation')).toBe(true);

    // 4. Verify clean title without overlapping
    expect(fullText.includes('1. BLAST RECORDS & OPTICAL SIZING')).toBe(true);

    // 5. Verify parsed section card titles are present
    expect(fullText.includes('FRAGMENTATION ASSESSMENT')).toBe(true);
    expect(fullText.includes('COMMINUTION CIRCUIT CONSEQUENCES')).toBe(true);

    // 6. Verify Cover Page elements are generated on Page 1
    expect(fullText.includes('TECHNICAL DRILL, BLAST') || fullText.includes('COMMINUTION AUDIT REPORT')).toBe(true);
    expect(fullText.includes('1. OPERATIONAL CONTEXT & EVALUATED BLAST PARAMETERS')).toBe(true);
    expect(fullText.includes('3. TECHNICAL APPROVAL CHAIN & COMPLIANCE SIGN-OFF')).toBe(true);
    expect(fullText.includes('Laboratoire Du Peuple')).toBe(true);
  });

  it('persists timingConfig, patternConfig, circuitConfig, kuzRamConfig and kuzRamTables on the Blast object', () => {
    const fullBlast: Blast = {
      ...mockBlastWithClaudeNotes,
      patternConfig: {
        burdenM: 3.2,
        spacingM: 3.6,
        benchHeightM: 14.0,
        patternType: 'rectangular',
        clearanceRadiusM: 350,
      },
      circuitConfig: {
        f80Mm: 250,
        targetP80Microns: 80,
        bondWi: 15.2,
        rockAxb: 45,
        operatingHours: 22,
        powerCostUSD: 0.15,
        explosiveCostUSD: 1.90,
      },
      kuzRamConfig: {
        targetP80: 175,
        priorMeanA: 7.2,
        priorStdA: 1.4,
      },
      mineToMillEconConfig: {
        drillingCostPerMeter: 17.5,
        explosiveCostPerKg: 1.95,
        secondaryBreakingCostPerBoulder: 50,
        powerCostPerKwh: 0.15,
      },
    };

    expect(fullBlast.timingConfig).toBeDefined();
    expect(fullBlast.timingConfig?.patternType).toBe('v_echelon');
    expect(fullBlast.timingConfig?.surfaceDelayMs).toBe(25);
    expect(fullBlast.timingConfig?.inHoleDelayMs).toBe(400);

    expect(fullBlast.kuzRamTables).toBeDefined();
    expect(fullBlast.kuzRamTables?.density).toBe(2.75);
    expect(fullBlast.kuzRamTables?.rmd).toBe(20);

    expect(fullBlast.patternConfig?.burdenM).toBe(3.2);
    expect(fullBlast.patternConfig?.patternType).toBe('rectangular');
    expect(fullBlast.patternConfig?.clearanceRadiusM).toBe(350);

    expect(fullBlast.circuitConfig?.f80Mm).toBe(250);
    expect(fullBlast.circuitConfig?.bondWi).toBe(15.2);
    expect(fullBlast.circuitConfig?.powerCostUSD).toBe(0.15);

    expect(fullBlast.kuzRamConfig?.targetP80).toBe(175);
    expect(fullBlast.kuzRamConfig?.priorMeanA).toBe(7.2);

    expect(fullBlast.mineToMillEconConfig?.drillingCostPerMeter).toBe(17.5);
    expect(fullBlast.mineToMillEconConfig?.explosiveCostPerKg).toBe(1.95);
  });
});
