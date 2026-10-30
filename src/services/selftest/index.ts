import { computeConvexHull, computeFeretDiameters } from '../imageProcessing';
import type { Point2D } from '../../types';

export interface SelfTestShapeResult {
  shapeName: string;
  expectedMinFeretMm: number;
  measuredMinFeretMm: number;
  expectedMaxFeretMm: number;
  measuredMaxFeretMm: number;
  errorPercent: number;
  passed: boolean;
}

export interface SelfTestReport {
  passed: boolean;
  maxErrorPercent: number;
  tolerancePercent: number;
  shapes: SelfTestShapeResult[];
  timestamp: number;
}

// Geometric self-test: verifies convex-hull generation and rotating-caliper Feret sizing accuracy on synthetic geometric primitives
export async function runCalibrationSelfTest(): Promise<SelfTestReport> {
  // Exact known calibration scale: 2 px per mm (0.5 mm per px)
  const pxPerMm = 2.0;

  // 1. Known Circle: Diameter = 100 mm -> radius = 50 mm = 100 px
  const c1Center = { x: 200, y: 200 };
  const c1RadiusPx = 50 * pxPerMm; // 100 px

  // 2. Known Rectangle: Width = 80 mm (160 px), Height = 50 mm (100 px)
  const r2X = 450;
  const r2Y = 150;
  const r2WPx = 80 * pxPerMm; // 160 px
  const r2HPx = 50 * pxPerMm; // 100 px

  // 3. Known Equilateral Triangle: side = 70 mm
  // Generate polygon points for Circle
  const circlePoints: Point2D[] = [];
  const numSteps = 64;
  for (let i = 0; i < numSteps; i++) {
    const angle = (i / numSteps) * Math.PI * 2;
    circlePoints.push({
      x: c1Center.x + Math.cos(angle) * c1RadiusPx,
      y: c1Center.y + Math.sin(angle) * c1RadiusPx,
    });
  }

  // Generate polygon points for Rectangle
  const rectPoints: Point2D[] = [
    { x: r2X, y: r2Y },
    { x: r2X + r2WPx, y: r2Y },
    { x: r2X + r2WPx, y: r2Y + r2HPx },
    { x: r2X, y: r2Y + r2HPx },
  ];

  // Test Circle
  const c1Hull = computeConvexHull(circlePoints);
  const c1Feret = computeFeretDiameters(c1Hull, pxPerMm);
  const c1Error = (Math.abs(c1Feret.minFeretMm - 100) / 100) * 100;

  // Test Rectangle
  const r2Hull = computeConvexHull(rectPoints);
  const r2Feret = computeFeretDiameters(r2Hull, pxPerMm);
  const r2ErrorMin = (Math.abs(r2Feret.minFeretMm - 50) / 50) * 100;
  const r2ErrorMax = (Math.abs(r2Feret.maxFeretMm - Math.hypot(80, 50)) / Math.hypot(80, 50)) * 100;
  const r2Error = Math.max(r2ErrorMin, r2ErrorMax);

  const tolerance = 3.0; // 3% tolerance requirement from prompt

  const shapes: SelfTestShapeResult[] = [
    {
      shapeName: 'Precision 100 mm Disc',
      expectedMinFeretMm: 100,
      measuredMinFeretMm: c1Feret.minFeretMm,
      expectedMaxFeretMm: 100,
      measuredMaxFeretMm: c1Feret.maxFeretMm,
      errorPercent: Number(c1Error.toFixed(2)),
      passed: c1Error <= tolerance,
    },
    {
      shapeName: 'Precision 80x50 mm Gauge Block',
      expectedMinFeretMm: 50,
      measuredMinFeretMm: r2Feret.minFeretMm,
      expectedMaxFeretMm: Number(Math.hypot(80, 50).toFixed(1)),
      measuredMaxFeretMm: r2Feret.maxFeretMm,
      errorPercent: Number(r2Error.toFixed(2)),
      passed: r2Error <= tolerance,
    },
  ];

  const maxErr = Math.max(...shapes.map((s) => s.errorPercent));

  return {
    passed: maxErr <= tolerance,
    maxErrorPercent: maxErr,
    tolerancePercent: tolerance,
    shapes,
    timestamp: Date.now(),
  };
}
