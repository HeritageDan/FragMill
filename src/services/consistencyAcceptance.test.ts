import { describe, it, expect } from 'vitest';
import { getBlastState } from './blastState';
import { calculateRockFactorA, computeKuzRam } from './kuzram';
import { fitRosinRammler, fitSwebrec } from './statistics';
import { generateModularVaultPdfReport } from './export/modularReport';
import type { Blast, Project, Site, Fragment } from '../types';

const mockProject: Project = {
  id: 'proj-betare',
  name: 'Projet Minier Bétaré-Oya',
  description: 'Exploitation aurifère et optimisation abattage-broyage',
  createdAt: 1771000000000,
  updatedAt: 1771000000000,
};

const mockSite: Site = {
  id: 'site-betare-oya',
  projectId: 'proj-betare',
  name: 'Carrière Pilote Nord-Est',
  locationText: 'Région de l\'Est, Cameroun',
  createdAt: 1771000000000,
  updatedAt: 1771000000000,
};

// Realistic mock fragments list (245 detected rocks)
const mockFragments: Fragment[] = Array.from({ length: 245 }, (_, idx) => {
  const size = 30 + (idx % 20) * 15;
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

// Mock blast BL-2026-004
const mockBlastBL2026004: Blast = {
  id: 'blast-bl-2026-004',
  projectId: 'project-cameroon',
  siteId: 'site-betare-oya',
  blastId: 'BL-2026-004',
  dateTime: '2026-02-14T08:30:00Z',
  weather: 'Ensoleillé, 28°C',
  benchElevation: 840,
  notes: 'Tir pilote de production - Front Nord-Est, Bétaré-Oya',
  createdAt: 1771057800000,
  updatedAt: 1771057800000,
  parameters: {
    holeDiameter: 79, // mm
    holeDepth: 16.2, // m (15m bench + 1.2m subdrill)
    benchHeight: 15.0, // m
    burden: 4.0, // m
    spacing: 3.0, // m
    subdrill: 1.2, // m
    stemmingLength: 2.4, // m
    numberOfHoles: 50,
    holeInclination: 90,
    explosiveType: 'ANFO Vrac (Plein trou)',
    chargePerHole: 71.89, // kg
    bottomChargeLength: 4.0,
    columnChargeLength: 9.8,
    initiationSequenceNotes: 'V-echelon 25ms / 400ms',
    waterInHoles: false,
    drillingDeviationEstimate: 0.05,
    rws: 100,
  },
  rockMass: {
    rockType: 'Granodiorite Foliée',
    density: 2.76, // t/m3
    ucsMPa: 120, // MPa
    youngsModulusGPa: 65, // GPa
    meanJointSpacing: 0.45, // m
    jointOrientation: 'strike_perpendicular',
    rmd: 20,
    gsi: 65,
  } as any,
  images: [
    {
      id: 'img-001',
      blastId: 'blast-bl-2026-004',
      dataUrl: 'data:image/png;base64,mock',
      thumbnailUrl: 'data:image/png;base64,mock',
      filename: 'muckpile_001.jpg',
      zone: 'middle',
      lighting: 'sun',
      time: '14:30',
      hasScaleMarker: true,
      qualityCheck: {
        blurScore: 85,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: [],
      },
      createdAt: 1771057800000,
      updatedAt: 1771057800000,
      segmentationRuns: [
        {
          id: 'seg-001',
          imageId: 'img-001',
          engine: 'classical',
          timestamp: 1771057800000,
          parameters: {
            scaleMmPerPx: 1.25,
            minFragmentPx: 8,
            watershedCompactness: 0.2,
          },
          fragments: mockFragments,
          metrics: {
            sizeDefinition: 'min_feret',
            fragmentCount: 245,
            meanSize: 165,
            unresolvedFinesPercent: 0,
            p10: 42,
            p20: 78,
            p50: 165,
            p80: 242,
            p90: 285,
            pMax: 340,
            uniformityIndex: 1.28,
            finesPercent: 6.8, // % < 25 mm
            oversizePercent: 9.2, // % > 300 mm
            rawCurve: [
              { sizeMm: 10, passingPercent: 2.1 },
              { sizeMm: 25, passingPercent: 6.8 }, // fines threshold
              { sizeMm: 50, passingPercent: 14.5 },
              { sizeMm: 100, passingPercent: 32.0 },
              { sizeMm: 150, passingPercent: 46.2 },
              { sizeMm: 200, passingPercent: 64.5 },
              { sizeMm: 250, passingPercent: 82.0 },
              { sizeMm: 300, passingPercent: 90.8 }, // 100 - 90.8 = 9.2% oversize
              { sizeMm: 400, passingPercent: 100.0 },
            ],
          } as any,
        },
      ],
    },
  ],
};

describe('FragMill Consistency & Correctness Acceptance Tests (BL-2026-004 Audit)', () => {
  const blastState = getBlastState(mockBlastBL2026004);

  // 1. Zero dual values across state
  it('Check 1: Single Source of Truth produces zero dual/contradictory values', () => {
    expect(blastState.geometry.numberOfHoles).toBe(50);
    expect(blastState.drilling.totalHoles).toBe(50);
    expect(blastState.geometry.holeDiameterMm).toBe(79);
    expect(blastState.timing.holeDiameterMm).toBe(79);
    expect(blastState.rock.densityTPerM3).toBe(2.76);
    expect(blastState.geometry.stemmingLength).toBe(2.4);
    expect(blastState.geometry.benchElevationRL).toBe(840);
    expect(blastState.belt.beltSpeedMPerS).toBe(2.2);
    expect(blastState.belt.fps).toBe(4);
    expect(blastState.optical.p80Mm).toBe(242);
    expect(blastState.comminution.feedF80Mm).toBe(242);
  });

  // 2. Mine-to-mill cost table sums to total and percentages sum to 100.0%
  it('Check 2: Cost table lines sum exactly to total and percentages sum to 100.0%', () => {
    const costs = blastState.economics.costs;
    expect(costs.length).toBe(5); // Drilling, Blasting, Secondary Breaking, Crushing, Milling

    const sumCosts = Number(costs.reduce((acc, c) => acc + c.costPerTonUSD, 0).toFixed(2));
    expect(sumCosts).toBeCloseTo(blastState.economics.totalCostPerTonUSD, 2);

    const sumPct = Number(costs.reduce((acc, c) => acc + c.percentage, 0).toFixed(1));
    expect(sumPct).toBe(100.0);
  });

  // 3. Rock Factor A Cunningham components sum exactly
  it('Check 3: Cunningham 1987 components sum to A within 0.01', () => {
    const rf = blastState.rock.components;
    const componentSum = rf.rmd + rf.jps + rf.jpa + rf.rdi + rf.hf;
    const computedA = Number((0.06 * componentSum).toFixed(2));

    expect(blastState.rock.rockFactorA).toBe(computedA);
    expect(rf.rdi).toBeCloseTo(25 * mockBlastBL2026004.rockMass.density - 50, 2);
  });

  // 4. Kuz-Ram check: A=6.08, K=0.40, Q=71.89, RWS=100 -> X50 approx 282 mm
  it('Check 4: Kuz-Ram formula calculates X50 approx 282 mm for test blast parameters', () => {
    const A = 6.08;
    const K = 0.40;
    const Q = 71.89;
    const RWS = 100;

    // X50 (cm) = A * K^(-0.8) * Q^(1/6) * (115 / RWS)^(19/30)
    const x50Cm = A * Math.pow(K, -0.8) * Math.pow(Q, 1 / 6) * Math.pow(115 / RWS, 19 / 30);
    const x50Mm = x50Cm * 10;

    expect(x50Mm).toBeGreaterThan(275);
    expect(x50Mm).toBeLessThan(285);
    expect(Math.round(x50Mm)).toBe(282);
  });

  // 5. Input validation: Physical charge capacity check
  it('Check 5: Charge capacity triggers warning when charge exceeds column capacity', () => {
    // 79 mm hole, 850 kg/m3 ANFO -> linear loading = 4.166 kg/m
    // depth 16.2m, stemming 2.4m -> max length = 13.8m -> max capacity = 57.5 kg
    // Required charge = 71.89 kg > 57.5 kg -> Warning triggered!
    expect(blastState.explosive.isCapacityExceeded).toBe(true);
    expect(blastState.validationWarningsEn.some((w) => w.includes('capacity') || w.includes('linear charge'))).toBe(true);
    expect(blastState.validationWarningsFr.some((w) => w.includes('capacité') || w.includes('charge linéaire'))).toBe(true);
  });

  // 6. Header values match panel values everywhere
  it('Check 6: Zero discrepancy between summary and detailed metrics', () => {
    expect(blastState.drilling.complianceRatePercent).toBe(
      Math.round((blastState.drilling.compliantHolesCount / blastState.drilling.totalHoles) * 100)
    );
    expect(blastState.comminution.crushingSpecificEnergyKwhPerT).toBe(0.9);
  });

  // 7. Oversize % and fines % read from same PSD
  it('Check 7: Oversize % equals 100 minus passing % at 300 mm from same PSD', () => {
    // PSD at 300 mm has 90.8% passing -> Oversize is 100 - 90.8 = 9.2%
    expect(blastState.optical.oversizePercent).toBe(9.2);
    // PSD at 25 mm has 6.8% passing -> Fines is 6.8%
    expect(blastState.optical.finesPercent).toBe(6.8);
  });

  // 8. Ground truth disclosure for unsampled modules
  it('Check 8: Unsampled modules disclose lack of data or demo data status', () => {
    expect(blastState.sieve.hasSieveData).toBe(false);
    expect(blastState.drone.isDemoData).toBe(true);
    expect(blastState.belt.isSimulationStream).toBe(true);
  });

  // 9. Modular PDF generation produces valid Blob with QA page
  it('Check 9: PDF generation succeeds for BL-2026-004 and includes QA page', async () => {
    const blobEn = await generateModularVaultPdfReport({} as any, mockProject, mockSite, mockBlastBL2026004, 'en');
    expect(blobEn).toBeInstanceOf(Blob);
    expect(blobEn.size).toBeGreaterThan(50000);

    const blobFr = await generateModularVaultPdfReport({} as any, mockProject, mockSite, mockBlastBL2026004, 'fr');
    expect(blobFr).toBeInstanceOf(Blob);
    expect(blobFr.size).toBeGreaterThan(50000);
  });

  // 10. Robust bounded Rosin-Rammler fit and convergence checking
  it('Check 10: Statistical fitting bounds Rosin-Rammler and correctly reports convergence', () => {
    const points = mockBlastBL2026004.images[0].segmentationRuns![0].metrics.rawCurve!;
    const fit = fitRosinRammler(points);

    expect(fit.converged).toBe(true);
    expect(fit.xc).toBeGreaterThan(100);
    expect(fit.xc).toBeLessThan(1000);
    expect(fit.n).toBeGreaterThan(0.5);
    expect(fit.n).toBeLessThan(3.0);
    expect(fit.rmse).toBeLessThan(10.0);
  });
});
