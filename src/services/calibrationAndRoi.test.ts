import { describe, it, expect } from 'vitest';
import {
  calibrateTwoPoint,
  isPointInPolygon,
  rescaleFragments,
  filterFragmentsByRoiAndExclusions,
  computeConvexHull,
  computeFeretDiameters,
} from './imageProcessing';
import { computeFragmentationMetrics } from './statistics';
import { SCALE_PRESETS } from '../components/camera/ImageScaleCalibrationModal';
import type { Fragment } from '../types';

describe('Reference Scale Calibration & Known Object Presets', () => {
  it('contains expected standard reference presets (pen, coins, helmet, scale bars)', () => {
    const pen = SCALE_PRESETS.find((p) => p.id === 'pen_bic');
    expect(pen).toBeDefined();
    expect(pen?.dimensionMm).toBe(145);

    const coin100 = SCALE_PRESETS.find((p) => p.id === 'coin_100_fcfa');
    expect(coin100).toBeDefined();
    expect(coin100?.dimensionMm).toBe(26.0);

    const coin1Eur = SCALE_PRESETS.find((p) => p.id === 'coin_1_eur');
    expect(coin1Eur).toBeDefined();
    expect(coin1Eur?.dimensionMm).toBe(23.25);

    const ruler30 = SCALE_PRESETS.find((p) => p.id === 'ruler_30cm');
    expect(ruler30).toBeDefined();
    expect(ruler30?.dimensionMm).toBe(300);
  });

  it('correctly calculates pxPerMm from two-point placement on a pen (145 mm)', () => {
    // Pen placed between (100, 200) and (390, 200) => 290 px distance
    const p1 = { x: 100, y: 200 };
    const p2 = { x: 390, y: 200 };
    const calib = calibrateTwoPoint(p1, p2, 145);

    expect(calib.realWorldDistanceMm).toBe(145);
    expect(calib.pxPerMm).toBe(2.0); // 290 / 145 = 2.0 px/mm
  });

  it('correctly calculates pxPerMm from a coin (26 mm)', () => {
    // 100 FCFA coin spanning 65 pixels across diameter
    const p1 = { x: 50, y: 50 };
    const p2 = { x: 115, y: 50 };
    const calib = calibrateTwoPoint(p1, p2, 26);

    expect(calib.pxPerMm).toBe(2.5); // 65 / 26 = 2.5 px/mm
  });
});

describe('ROI & Non-Rock Exclusion Polygons', () => {
  it('correctly verifies whether points are inside or outside ROI polygon', () => {
    // Bounding box from (100, 100) to (500, 400)
    const roi = [
      { x: 100, y: 100 },
      { x: 500, y: 100 },
      { x: 500, y: 400 },
      { x: 100, y: 400 },
    ];

    // Inside muckpile
    expect(isPointInPolygon({ x: 250, y: 250 }, roi)).toBe(true);

    // Outside in the sky (y < 100)
    expect(isPointInPolygon({ x: 250, y: 50 }, roi)).toBe(false);

    // Outside on the left road (x < 100)
    expect(isPointInPolygon({ x: 40, y: 250 }, roi)).toBe(false);
  });

  it('correctly detects points inside non-rock exclusion zone (e.g. excavator boom or scale marker)', () => {
    const penExclusionZone = [
      { x: 200, y: 280 },
      { x: 350, y: 280 },
      { x: 350, y: 310 },
      { x: 200, y: 310 },
    ];

    // The pen itself is inside the exclusion polygon
    expect(isPointInPolygon({ x: 275, y: 295 }, penExclusionZone)).toBe(true);

    // A rock next to the pen is outside the exclusion polygon
    expect(isPointInPolygon({ x: 275, y: 340 }, penExclusionZone)).toBe(false);
  });
});

describe('Fragment Rescaling', () => {
  it('recalculates fragment metric dimensions proportionally when scale changes', () => {
    const polygon = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 180 },
      { x: 100, y: 180 },
    ];
    const initialHull = computeConvexHull(polygon);
    const initialFeret = computeFeretDiameters(initialHull, 1.0);

    const mockFragment: Fragment = {
      id: 1,
      polygon,
      centroid: { x: 150, y: 140 },
      areaPx: 8000,
      areaMm2: 8000, // at 1.0 px/mm
      ecdMm: 100.9,
      minFeretMm: initialFeret.minFeretMm,
      maxFeretMm: initialFeret.maxFeretMm,
      bboxWidthMm: 90,
      bboxHeightMm: 80,
      aspectRatio: 1.25,
      solidity: 0.95,
      volumeMm3: 500000,
      confidence: 0.92,
      thicknessMm: 50,
      trueVolume3DMm3: 400000,
    };

    // User calibrates scale to 2.0 px/mm (so real dimensions should halve)
    const rescaled = rescaleFragments([mockFragment], 2.0);

    expect(rescaled.length).toBe(1);
    expect(rescaled[0].areaMm2).toBe(2000); // 8000 / (2^2) = 2000 mm^2
    expect(rescaled[0].minFeretMm).toBeCloseTo(initialFeret.minFeretMm / 2, 0);
    expect(rescaled[0].maxFeretMm).toBeCloseTo(initialFeret.maxFeretMm / 2, 0);
  });
});

describe('Fragment Filtering by ROI and Exclusion Polygons', () => {
  const createMockFragment = (id: number, x: number, y: number, size = 40): Fragment => {
    const polygon = [
      { x: x - size / 2, y: y - size / 2 },
      { x: x + size / 2, y: y - size / 2 },
      { x: x + size / 2, y: y + size / 2 },
      { x: x - size / 2, y: y + size / 2 },
    ];
    return {
      id,
      polygon,
      centroid: { x, y },
      areaPx: size * size,
      areaMm2: size * size,
      ecdMm: size,
      minFeretMm: size,
      maxFeretMm: size * 1.2,
      bboxWidthMm: size,
      bboxHeightMm: size,
      aspectRatio: 1.2,
      solidity: 0.9,
      volumeMm3: 1000,
      confidence: 0.9,
      thicknessMm: size * 0.6,
      trueVolume3DMm3: 800,
    };
  };

  it('strictly reduces fragment count when an image is cropped via ROI polygon', () => {
    // 10 fragments: 5 in top half (y = 200), 5 in bottom half (y = 800)
    const frags: Fragment[] = [
      createMockFragment(1, 100, 200),
      createMockFragment(2, 300, 200),
      createMockFragment(3, 500, 200),
      createMockFragment(4, 700, 200),
      createMockFragment(5, 900, 200),
      createMockFragment(6, 100, 800),
      createMockFragment(7, 300, 800),
      createMockFragment(8, 500, 800),
      createMockFragment(9, 700, 800),
      createMockFragment(10, 900, 800),
    ];

    expect(frags.length).toBe(10);

    // Crop: keep only the bottom half of the muckpile (y between 500 and 1000)
    const roiBottomHalf = [
      { x: 0, y: 500 },
      { x: 1000, y: 500 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];

    const croppedFrags = filterFragmentsByRoiAndExclusions(frags, roiBottomHalf, []);

    // Fragment count MUST be strictly 5 (top 5 removed)
    expect(croppedFrags.length).toBe(5);
    expect(croppedFrags.map((f) => f.centroid.y)).toEqual([800, 800, 800, 800, 800]);

    // Recalculated metrics must reflect exactly 5 fragments
    const metrics = computeFragmentationMetrics(croppedFrags, 'min_feret', 300, 25);
    expect(metrics.fragmentCount).toBe(5);
  });

  it('excludes non-rock objects or unwanted regions (excavator, boots, scale pens)', () => {
    const frags: Fragment[] = [
      createMockFragment(1, 100, 200),
      createMockFragment(2, 300, 200),
      createMockFragment(3, 500, 200), // Near excavator
      createMockFragment(4, 700, 200),
    ];

    // Exclusion box drawn around (450, 150) to (550, 250) (e.g. excavator bucket)
    const excavatorExclusion = [
      { x: 450, y: 150 },
      { x: 550, y: 150 },
      { x: 550, y: 250 },
      { x: 450, y: 250 },
    ];

    const filtered = filterFragmentsByRoiAndExclusions(frags, undefined, [excavatorExclusion]);

    // Fragment at x: 500 must be excluded! Count drops from 4 to 3
    expect(filtered.length).toBe(3);
    expect(filtered.map((f) => f.centroid.x)).toEqual([100, 300, 700]);
    expect(filtered.some((f) => f.centroid.x === 500)).toBe(false);
  });

  it('handles simultaneous ROI crop and exclusion masks correctly', () => {
    const frags: Fragment[] = [
      createMockFragment(1, 100, 200), // out of ROI
      createMockFragment(2, 300, 700), // in ROI
      createMockFragment(3, 500, 700), // in ROI but inside exclusion
      createMockFragment(4, 800, 700), // in ROI
    ];

    const roi = [
      { x: 0, y: 500 },
      { x: 1000, y: 500 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];

    const exclusion = [
      { x: 450, y: 650 },
      { x: 550, y: 650 },
      { x: 550, y: 750 },
      { x: 450, y: 750 },
    ];

    const result = filterFragmentsByRoiAndExclusions(frags, roi, [exclusion]);

    // Fragment 1 is outside ROI, fragment 3 is inside exclusion. Surviving are fragments 2 and 4.
    expect(result.length).toBe(2);
    expect(result.map((f) => f.centroid.x)).toEqual([300, 800]);
  });
});

