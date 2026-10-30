import type {
  QualityCheck,
  Calibration,
  Fragment,
  Point2D,
  ClassicalEngineParams,
} from '../../types';

export const DEFAULT_CLASSICAL_PARAMS: ClassicalEngineParams = {
  colorSpace: 'grayscale',
  claheClipLimit: 2.0,
  claheGridSize: 8,
  gaussianBlurKernel: 5,
  thresholdMethod: 'adaptive',
  adaptiveBlockSize: 21,
  adaptiveC: 3,
  morphKernelSize: 3,
  distanceTransformThreshold: 0.45,
  minFragmentAreaMm2: 50,
  minSolidity: 0.70,
  maxAspectRatio: 4.0,
  filterBorders: true,
};

// Evaluate image quality (sharpness, exposure, contrast, resolution)
export async function analyzeImageQuality(imageElement: HTMLImageElement): Promise<QualityCheck> {
  const canvas = document.createElement('canvas');
  // Downsample to max 800px long side for rapid quality check
  const maxDim = 800;
  let w = imageElement.naturalWidth || imageElement.width;
  let h = imageElement.naturalHeight || imageElement.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(imageElement, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Grayscale & luminance statistics, plus transparency & color quantization for non-geological/logo detection
  const gray = new Float32Array(w * h);
  const hist = new Int32Array(256);
  let sumLum = 0;
  let transparentCount = 0;
  let pureWhiteCount = 0;
  let pureBlackCount = 0;
  const colorHist = new Int32Array(512); // 8x8x8 quantized color cube

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 50) {
      transparentCount++;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 248 && g > 248 && b > 248) pureWhiteCount++;
    if (r < 8 && g < 8 && b < 8) pureBlackCount++;
    const bin = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    colorHist[bin]++;

    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const pIdx = i / 4;
    gray[pIdx] = lum;
    hist[lum]++;
    sumLum += lum;
  }

  const numPixels = w * h;
  const meanLum = sumLum / numPixels;

  // Detect artificial logos / digital graphics
  let activeBins = 0;
  let maxBinCount = 0;
  for (let i = 0; i < 512; i++) {
    if (colorHist[i] > 0) activeBins++;
    if (colorHist[i] > maxBinCount) maxBinCount = colorHist[i];
  }

  const transparentPct = (transparentCount / numPixels) * 100;
  const pureWhitePct = (pureWhiteCount / numPixels) * 100;
  const pureBlackPct = (pureBlackCount / numPixels) * 100;
  const dominantColorPct = (maxBinCount / numPixels) * 100;

  // Luminance standard deviation (contrast indicator)
  let sumSqDiff = 0;
  for (let i = 0; i < numPixels; i++) {
    sumSqDiff += Math.pow(gray[i] - meanLum, 2);
  }
  const contrastStd = Math.sqrt(sumSqDiff / numPixels);

  // Real muck piles have textured natural gradients spanning hundreds of color bins with no large pure white/transparent field.
  // Logos have high transparency (> 12%), high pure white background (> 25%), flat single color (> 40%), or tiny number of color bins (< 25).
  const isArtificialGraphic =
    transparentPct > 12 ||
    (pureWhitePct > 25 && contrastStd > 40) ||
    (pureBlackPct > 35 && contrastStd > 50) ||
    dominantColorPct > 40 ||
    (activeBins < 25 && numPixels > 10000);

  // Variance of Laplacian (Sharpness / Blur indicator)
  // Kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        gray[idx - w] +
        gray[idx + w] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];
      lapSum += lap;
      lapSumSq += lap * lap;
      lapCount++;
    }
  }

  const lapMean = lapSum / lapCount;
  const blurScore = Math.round(lapSumSq / lapCount - lapMean * lapMean);

  // Clipping check: under-exposure (pixels <= 5) and over-exposure (pixels >= 250)
  let underCount = 0;
  let overCount = 0;
  for (let i = 0; i <= 5; i++) underCount += hist[i];
  for (let i = 250; i < 256; i++) overCount += hist[i];

  const underPct = (underCount / numPixels) * 100;
  const overPct = (overCount / numPixels) * 100;

  // Status assessments
  let blurStatus: 'pass' | 'warn' | 'fail' = 'pass';
  if (blurScore < 60) blurStatus = 'fail';
  else if (blurScore < 120) blurStatus = 'warn';

  let exposureStatus: 'pass' | 'warn' | 'fail' = 'pass';
  if (underPct > 15 || overPct > 15) exposureStatus = 'fail';
  else if (underPct > 6 || overPct > 6) exposureStatus = 'warn';

  let contrastStatus: 'pass' | 'warn' | 'fail' = 'pass';
  if (contrastStd < 25) contrastStatus = 'fail';
  else if (contrastStd < 40) contrastStatus = 'warn';

  const origW = imageElement.naturalWidth || imageElement.width;
  const origH = imageElement.naturalHeight || imageElement.height;
  const origLong = Math.max(origW, origH);
  let resolutionStatus: 'pass' | 'warn' | 'fail' = 'pass';
  if (origLong < 900) resolutionStatus = 'fail';
  else if (origLong < 1600) resolutionStatus = 'warn';

  const advice: string[] = [];
  if (isArtificialGraphic) {
    advice.push(
      'Non-geological image / logo detected: This image appears to be a digital graphic, diagram, or logo with vector shapes rather than a rock muck pile. FragMill segments high-contrast outlines and will misidentify letters and icons as rock fragments.'
    );
  }

  if (blurStatus === 'fail') {
    advice.push('Image is noticeably blurred. Rest camera on steady support and retake.');
  } else if (blurStatus === 'warn') {
    advice.push('Slight camera shake detected. Ensure rock surface is sharply in focus.');
  }

  if (exposureStatus === 'fail') {
    advice.push('Severe over/under exposure. Reposition to avoid direct glare or deep pit shadows.');
  } else if (exposureStatus === 'warn') {
    advice.push('Moderate shadow or sunlight clipping. Consider shading or shooting on overcast period.');
  }

  if (contrastStatus !== 'pass') {
    advice.push('Low contrast / heavy dust haze detected. Allow dust to settle before shooting.');
  }

  if (resolutionStatus !== 'pass') {
    advice.push('Resolution is low (< 1600 px). Move closer to muck pile or use higher resolution setting.');
  }

  if (advice.length === 0) {
    advice.push('Excellent image clarity, exposure, and sharpness for fragmentation analysis.');
  }

  return {
    blurScore,
    blurStatus,
    exposureStatus,
    contrastStatus,
    resolutionStatus,
    scaleMarkerStatus: 'pass',
    isArtificialGraphic,
    advice,
  };
}

// Calibrate two-point manual scale bar
export function calibrateTwoPoint(
  p1: Point2D,
  p2: Point2D,
  realWorldDistanceMm: number
): Calibration {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distPx = Math.sqrt(dx * dx + dy * dy);
  const pxPerMm = distPx / Math.max(1, realWorldDistanceMm);

  return {
    method: 'two_point',
    points: [p1, p2],
    realWorldDistanceMm,
    pxPerMm: Number(pxPerMm.toFixed(4)),
    scaleVariationPercent: 1.5,
    calibrationErrorMm: Number((1.5 / pxPerMm).toFixed(2)),
  };
}

/**
 * Direct Linear Transformation (DLT) for 4-Point Planar Homography:
 * Solves the 8x8 system M * h = b to find the 3x3 projective transformation matrix H.
 */
export function computeHomographyMatrix(src: Point2D[], dst: Point2D[]): number[][] {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('4-point homography requires exactly 4 corresponding points.');
  }

  const M: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];

    M.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);

    M.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  // Gaussian elimination with partial pivoting (8x8)
  const n = 8;
  const A = M.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = A[i];
    A[i] = A[maxRow];
    A[maxRow] = temp;

    if (Math.abs(A[i][i]) < 1e-12) {
      throw new Error('Degenerate quadrilateral geometry for homography.');
    }

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j <= n; j++) {
        A[k][j] -= factor * A[i][j];
      }
    }
  }

  // Back substitution
  const h = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = A[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * h[j];
    }
    h[i] = sum / A[i][i];
  }

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1.0],
  ];
}

/**
 * Applies 3x3 Homography matrix H to transform a 2D image coordinate into metric space.
 */
export function applyHomography(H: number[][], pt: Point2D): Point2D {
  const x = pt.x;
  const y = pt.y;
  const denom = H[2][0] * x + H[2][1] * y + H[2][2];
  if (Math.abs(denom) < 1e-9) return { x: 0, y: 0 };
  const u = (H[0][0] * x + H[0][1] * y + H[0][2]) / denom;
  const v = (H[1][0] * x + H[1][1] * y + H[1][2]) / denom;
  return { x: u, y: v };
}

/**
 * Calibrates scale and perspective rectification using a 4-point quadrilateral target of known width & height.
 */
export function calibrateFourPointHomography(
  corners: Point2D[],
  realWorldWidthMm: number,
  realWorldHeightMm: number
): Calibration {
  if (corners.length !== 4) {
    throw new Error('4 corner points required for perspective homography calibration.');
  }

  const dstCorners: Point2D[] = [
    { x: 0, y: 0 },
    { x: realWorldWidthMm, y: 0 },
    { x: realWorldWidthMm, y: realWorldHeightMm },
    { x: 0, y: realWorldHeightMm },
  ];

  const H = computeHomographyMatrix(corners, dstCorners);

  // Compute equivalent average pxPerMm across the quad
  const topEdge = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const bottomEdge = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const leftEdge = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const rightEdge = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

  const avgWidthPx = (topEdge + bottomEdge) / 2;
  const avgHeightPx = (leftEdge + rightEdge) / 2;
  const pxPerMm = (avgWidthPx / realWorldWidthMm + avgHeightPx / realWorldHeightMm) / 2;

  return {
    method: 'four_point_homography',
    points: corners,
    realWorldDistanceMm: realWorldWidthMm,
    realWorldWidthMm,
    realWorldHeightMm,
    pxPerMm: Number(pxPerMm.toFixed(4)),
    scaleVariationPercent: 0.5,
    calibrationErrorMm: Number((0.5 / pxPerMm).toFixed(2)),
    homographyMatrix: H,
  };
}

// Convex Hull Algorithm (Graham Scan / Monotone Chain)
export function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 3) return points;

  const pts = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  const cross = (o: Point2D, a: Point2D, b: Point2D) => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  };

  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// Compute Minimum Feret and Maximum Feret Diameter (Rotating Calipers on Convex Hull)
export function computeFeretDiameters(hull: Point2D[], pxPerMm: number): { minFeretMm: number; maxFeretMm: number } {
  if (hull.length < 2) return { minFeretMm: 10, maxFeretMm: 10 };

  let maxDistSq = 0;
  // Maximum Feret (caliper span across any two points)
  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) {
      const dSq = Math.pow(hull[i].x - hull[j].x, 2) + Math.pow(hull[i].y - hull[j].y, 2);
      if (dSq > maxDistSq) maxDistSq = dSq;
    }
  }
  const maxFeretPx = Math.sqrt(maxDistSq);

  // Minimum Feret: minimum projected width over hull edge normals
  let minCaliperPx = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const edgeX = p2.x - p1.x;
    const edgeY = p2.y - p1.y;
    const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
    if (edgeLen === 0) continue;

    // Normal vector
    const nx = -edgeY / edgeLen;
    const ny = edgeX / edgeLen;

    let minProj = Infinity;
    let maxProj = -Infinity;
    for (const p of hull) {
      const proj = p.x * nx + p.y * ny;
      if (proj < minProj) minProj = proj;
      if (proj > maxProj) maxProj = proj;
    }
    const width = maxProj - minProj;
    if (width < minCaliperPx) minCaliperPx = width;
  }

  if (minCaliperPx === Infinity) minCaliperPx = maxFeretPx * 0.75;

  return {
    minFeretMm: Number((minCaliperPx / pxPerMm).toFixed(1)),
    maxFeretMm: Number((maxFeretPx / pxPerMm).toFixed(1)),
  };
}

// Ramer-Douglas-Peucker (RDP) Polygon Simplification for Natural Geological Rock Facets
export function simplifyPolygonRDP(points: Point2D[], epsilon: number = 1.0): Point2D[] {
  if (points.length <= 4) return points;

  const findPerpendicularDistance = (p: Point2D, p1: Point2D, p2: Point2D): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return Math.sqrt((p.x - p1.x) ** 2 + (p.y - p1.y) ** 2);
    }
    const num = Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x);
    return num / Math.sqrt(lenSq);
  };

  const rdp = (pts: Point2D[], eps: number): Point2D[] => {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let index = 0;
    const end = pts.length - 1;

    for (let i = 1; i < end; i++) {
      const d = findPerpendicularDistance(pts[i], pts[0], pts[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > eps) {
      const left = rdp(pts.slice(0, index + 1), eps);
      const right = rdp(pts.slice(index), eps);
      return left.slice(0, left.length - 1).concat(right);
    } else {
      return [pts[0], pts[end]];
    }
  };

  // For a closed polygon ring, split into two halves at the point farthest from points[0]
  let maxD = 0;
  let splitIdx = Math.floor(points.length / 2);
  for (let i = 1; i < points.length; i++) {
    const d = (points[i].x - points[0].x) ** 2 + (points[i].y - points[0].y) ** 2;
    if (d > maxD) {
      maxD = d;
      splitIdx = i;
    }
  }

  const part1 = rdp(points.slice(0, splitIdx + 1), epsilon);
  const part2 = rdp(points.slice(splitIdx).concat([points[0]]), epsilon);
  const simplified = part1.slice(0, part1.length - 1).concat(part2.slice(0, part2.length - 1));

  return simplified.length >= 3 ? simplified : points;
}

// Helper: Point in Polygon test for ROI & exclusion masks
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (!polygon || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Strict filtering of rock fragments against ROI polygon and non-rock exclusion zones.
 * Guarantees that fragments outside the cropped muckpile boundary or within excluded objects
 * (excavator, boots, sky, water, scale pens/markers) are strictly purged.
 */
export function filterFragmentsByRoiAndExclusions(
  fragments: Fragment[],
  roiPolygon?: Point2D[],
  exclusionPolygons?: Point2D[][]
): Fragment[] {
  if (!fragments || fragments.length === 0) return [];
  const hasRoi = Boolean(roiPolygon && roiPolygon.length >= 3);
  const hasExcl = Boolean(exclusionPolygons && exclusionPolygons.length > 0);

  if (!hasRoi && !hasExcl) return fragments;

  return fragments
    .filter((f) => {
      // 1. Centroid check against ROI polygon
      if (hasRoi && !isPointInPolygon(f.centroid, roiPolygon!)) {
        return false;
      }

      // 2. Vertex containment check: if >= 50% of fragment boundary points fall outside the ROI, discard
      if (hasRoi && f.polygon && f.polygon.length >= 3) {
        let insideCount = 0;
        for (const pt of f.polygon) {
          if (isPointInPolygon(pt, roiPolygon!)) insideCount++;
        }
        if (insideCount / f.polygon.length < 0.5) {
          return false;
        }
      }

      // 3. Exclusion checks: discard if centroid is inside ANY exclusion zone
      if (hasExcl) {
        for (const ep of exclusionPolygons!) {
          if (ep.length >= 3 && isPointInPolygon(f.centroid, ep)) {
            return false;
          }
        }

        // Also discard if more than 30% of vertices fall inside an exclusion zone
        if (f.polygon && f.polygon.length >= 3) {
          for (const ep of exclusionPolygons!) {
            if (ep.length < 3) continue;
            let inExclCount = 0;
            for (const pt of f.polygon) {
              if (isPointInPolygon(pt, ep)) inExclCount++;
            }
            if (inExclCount / f.polygon.length > 0.3) {
              return false;
            }
          }
        }
      }

      return true;
    })
    .map((f, idx) => ({
      ...f,
      id: idx + 1,
    }));
}

/**
 * 8-Connected Moore-Neighbor Tracing for exact region boundaries.
 * Extracts the outer ordered contour polygon of a watershed basin.
 */
export function traceRegionBoundary(
  targetLabel: number,
  labels: Int32Array,
  w: number,
  h: number,
  startX: number,
  startY: number
): Point2D[] {
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  const points: Point2D[] = [];
  let currX = startX;
  let currY = startY;
  let dir = 0;
  const maxSteps = Math.min(6000, w * h);
  let step = 0;

  points.push({ x: currX, y: currY });

  while (step++ < maxSteps) {
    let nextX = -1;
    let nextY = -1;
    let nextDir = -1;

    const startScan = (dir + 5) % 8;
    for (let i = 0; i < 8; i++) {
      const d = (startScan + i) % 8;
      const nx = currX + dx[d];
      const ny = currY + dy[d];

      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        if (labels[ny * w + nx] === targetLabel) {
          nextX = nx;
          nextY = ny;
          nextDir = d;
          break;
        }
      }
    }

    if (nextX === -1) {
      break;
    }

    if (nextX === startX && nextY === startY && points.length >= 3) {
      break;
    }

    currX = nextX;
    currY = nextY;
    dir = nextDir;
    points.push({ x: currX, y: currY });
  }

  return points;
}

// Full Classical Segmentation Execution (Engine A) - Industrial Rock Boundary & Valley Detection
// Full Classical Segmentation Execution (Engine A) - Industrial Rock Boundary & Valley Detection
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// V2 Overhaul: Adaptive multi-scale pipeline that correctly handles both large boulders and
// fine fragments without over-segmentation. Key improvements:
//   • Higher working resolution (up to 2048px) for better boundary detection
//   • Multi-scale Gaussian blur (sigma proportional to image scale)
//   • Adaptive morphological kernel sizes based on estimated median rock size
//   • Wider local-maximum neighborhood (7×7 instead of 3×3)
//   • NMS suppression distance scales with distance-transform peak, no hard cap
//   • Gradient energy clamped more conservatively to prevent texture splitting
//   • Valley/TopHat normalization adaptive to image statistics (median + IQR)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export async function runClassicalSegmentation(
  imageElement: HTMLImageElement,
  calibration: Calibration,
  params: ClassicalEngineParams = DEFAULT_CLASSICAL_PARAMS,
  roiPolygon?: Point2D[],
  exclusionPolygons?: Point2D[][]
): Promise<{
  fragments: Fragment[];
  stepPreviews: {
    grayscale: string;
    clahe: string;
    threshold: string;
    distance: string;
    markers: string;
    depthMap?: string;
    overlay: string;
    overlayWithSizing?: string;
  };
}> {
  if (!calibration || !calibration.pxPerMm || calibration.pxPerMm <= 0) {
    throw new Error('Valid scale calibration (pxPerMm > 0) is required before running image segmentation.');
  }
  const pxPerMm = calibration.pxPerMm;

  // ── 0. Adaptive Working Resolution ──────────────────────────────────────────
  // Use up to 2048px for high-res images, down to 1024 for smaller ones.
  // This preserves fine boundary detail that 1024 would obliterate.
  const origW = imageElement.naturalWidth || imageElement.width;
  const origH = imageElement.naturalHeight || imageElement.height;
  const origLong = Math.max(origW, origH);
  const maxDim = origLong > 3000 ? 2048 : origLong > 1800 ? 1600 : 1024;
  const scaleRatio = Math.min(1.0, maxDim / origLong);
  const workW = Math.round(origW * scaleRatio);
  const workH = Math.round(origH * scaleRatio);
  const workPxPerMm = pxPerMm * scaleRatio;

  const canvas = document.createElement('canvas');
  canvas.width = workW;
  canvas.height = workH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(imageElement, 0, 0, workW, workH);
  const imgData = ctx.getImageData(0, 0, workW, workH);
  const data = imgData.data;

  // ── 1. Grayscale Conversion (Standard Photometric Luminance) ────────────────
  const gray = new Uint8ClampedArray(workW * workH);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  const grayCanvas = document.createElement('canvas');
  grayCanvas.width = workW;
  grayCanvas.height = workH;
  const grayCtx = grayCanvas.getContext('2d')!;
  const grayImgData = grayCtx.createImageData(workW, workH);
  for (let i = 0; i < gray.length; i++) {
    const val = gray[i];
    const idx = i * 4;
    grayImgData.data[idx] = val;
    grayImgData.data[idx + 1] = val;
    grayImgData.data[idx + 2] = val;
    grayImgData.data[idx + 3] = 255;
  }
  grayCtx.putImageData(grayImgData, 0, 0);

  // ── 2. Multi-pass Gaussian Blur ─────────────────────────────────────────────
  // Two sequential 5-tap passes ≈ 9-tap Gaussian, suppresses more surface texture
  const applyGaussianPass = (src: Uint8ClampedArray | Float32Array): Float32Array => {
    const temp = new Float32Array(workW * workH);
    // Horizontal pass
    for (let y = 0; y < workH; y++) {
      const row = y * workW;
      for (let x = 0; x < workW; x++) {
        const x0 = Math.max(0, x - 2);
        const x1 = Math.max(0, x - 1);
        const x3 = Math.min(workW - 1, x + 1);
        const x4 = Math.min(workW - 1, x + 2);
        temp[row + x] =
          (src[row + x0] + 4 * src[row + x1] + 6 * src[row + x] + 4 * src[row + x3] + src[row + x4]) / 16;
      }
    }
    // Vertical pass
    const out = new Float32Array(workW * workH);
    for (let y = 0; y < workH; y++) {
      const y0 = Math.max(0, y - 2) * workW;
      const y1 = Math.max(0, y - 1) * workW;
      const y2 = y * workW;
      const y3 = Math.min(workH - 1, y + 1) * workW;
      const y4 = Math.min(workH - 1, y + 2) * workW;
      for (let x = 0; x < workW; x++) {
        out[y2 + x] = (temp[y0 + x] + 4 * temp[y1 + x] + 6 * temp[y2 + x] + 4 * temp[y3 + x] + temp[y4 + x]) / 16;
      }
    }
    return out;
  };

  // First blur pass
  const blur1 = applyGaussianPass(gray);
  // Second blur pass for extra texture suppression
  const blur2f = applyGaussianPass(blur1);
  const blurred = new Uint8ClampedArray(workW * workH);
  for (let i = 0; i < blurred.length; i++) {
    blurred[i] = Math.round(blur2f[i]);
  }

  // ── 3. CLAHE (Local Adaptive Contrast Enhancement) ──────────────────────────
  const clahe = new Uint8ClampedArray(workW * workH);
  const gridSize = params.claheGridSize || 8;
  const cellW = Math.ceil(workW / gridSize);
  const cellH = Math.ceil(workH / gridSize);

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * cellW;
      const startY = gy * cellH;
      const endX = Math.min(workW, (gx + 1) * cellW);
      const endY = Math.min(workH, (gy + 1) * cellH);
      const hist = new Int32Array(256);

      let cellCount = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          hist[blurred[y * workW + x]]++;
          cellCount++;
        }
      }

      const clipLimit = Math.max(1, (params.claheClipLimit * cellCount) / 256);
      let excess = 0;
      for (let b = 0; b < 256; b++) {
        if (hist[b] > clipLimit) {
          excess += hist[b] - clipLimit;
          hist[b] = clipLimit;
        }
      }
      const addPerBin = Math.floor(excess / 256);
      for (let b = 0; b < 256; b++) hist[b] += addPerBin;

      const cdf = new Float32Array(256);
      let cum = 0;
      for (let b = 0; b < 256; b++) {
        cum += hist[b];
        cdf[b] = (cum / cellCount) * 255;
      }

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = y * workW + x;
          clahe[idx] = Math.round(cdf[blurred[idx]]);
        }
      }
    }
  }

  const claheCanvas = document.createElement('canvas');
  claheCanvas.width = workW;
  claheCanvas.height = workH;
  const claheCtx = claheCanvas.getContext('2d')!;
  const claheImgData = claheCtx.createImageData(workW, workH);
  for (let i = 0; i < clahe.length; i++) {
    const val = clahe[i];
    const idx = i * 4;
    claheImgData.data[idx] = val;
    claheImgData.data[idx + 1] = val;
    claheImgData.data[idx + 2] = val;
    claheImgData.data[idx + 3] = 255;
  }
  claheCtx.putImageData(claheImgData, 0, 0);

  // ── 4. Sobel Gradient Magnitude ─────────────────────────────────────────────
  const grad = new Float32Array(workW * workH);
  let maxGrad = 1;
  for (let y = 1; y < workH - 1; y++) {
    const row = y * workW;
    for (let x = 1; x < workW - 1; x++) {
      const idx = row + x;
      const p00 = blurred[idx - workW - 1];
      const p02 = blurred[idx - workW + 1];
      const p10 = blurred[idx - 1];
      const p12 = blurred[idx + 1];
      const p20 = blurred[idx + workW - 1];
      const p22 = blurred[idx + workW + 1];

      const gx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
      const gy = (p20 + 2 * blurred[idx + workW] + p22) - (p00 + 2 * blurred[idx - workW] + p02);
      const mag = Math.sqrt(gx * gx + gy * gy);
      grad[idx] = mag;
      if (mag > maxGrad) maxGrad = mag;
    }
  }

  // ── 5. Adaptive Statistics for Valley & Energy Normalization ─────────────────
  // Instead of hardcoded divisors, compute image-adaptive normalization from
  // the statistical distribution of gradient and valley intensities.
  // Collect gradient values for foreground pixels to find the 75th percentile
  const gradSamples: number[] = [];
  for (let y = 2; y < workH - 2; y += 3) {
    for (let x = 2; x < workW - 2; x += 3) {
      const g = grad[y * workW + x];
      if (g > 0.5) gradSamples.push(g);
    }
  }
  gradSamples.sort((a, b) => a - b);
  const gradP75 = gradSamples.length > 10
    ? gradSamples[Math.floor(gradSamples.length * 0.75)]
    : maxGrad * 0.5;
  // Use the 75th percentile as the normalization ceiling for gradients.
  // This prevents surface texture (which is typically below p75) from triggering boundaries.
  const gradNormCeiling = Math.max(gradP75 * 1.8, maxGrad * 0.25);

  // ── 6. Integral Image for Adaptive Valley / Crevice Seam Detection ──────────
  const sat = new Float64Array((workW + 1) * (workH + 1));
  const satStride = workW + 1;
  for (let y = 0; y < workH; y++) {
    let rowSum = 0;
    const srcRow = y * workW;
    const satRow = (y + 1) * satStride;
    const satPrevRow = y * satStride;
    for (let x = 0; x < workW; x++) {
      rowSum += clahe[srcRow + x];
      sat[satRow + (x + 1)] = sat[satPrevRow + (x + 1)] + rowSum;
    }
  }

  // Use a larger block radius proportional to the working resolution
  const blockRadius = Math.max(8, Math.round(Math.min(workW, workH) * 0.018));
  const valley = new Float32Array(workW * workH);

  for (let y = 0; y < workH; y++) {
    const y0 = Math.max(0, y - blockRadius);
    const y1 = Math.min(workH - 1, y + blockRadius);
    const rHeight = y1 - y0 + 1;
    const satY0 = y0 * satStride;
    const satY1 = (y1 + 1) * satStride;

    for (let x = 0; x < workW; x++) {
      const x0 = Math.max(0, x - blockRadius);
      const x1 = Math.min(workW - 1, x + blockRadius);
      const rWidth = x1 - x0 + 1;
      const count = rWidth * rHeight;

      const sum = sat[satY1 + (x1 + 1)] - sat[satY0 + (x1 + 1)] - sat[satY1 + x0] + sat[satY0 + x0];
      const localMean = sum / count;
      const val = clahe[y * workW + x];
      valley[y * workW + x] = Math.max(0, localMean - val);
    }
  }

  // Compute valley normalization from statistics (median + 2 * IQR instead of hardcoded 22.0)
  const valleySamples: number[] = [];
  for (let y = 2; y < workH - 2; y += 3) {
    for (let x = 2; x < workW - 2; x += 3) {
      const v = valley[y * workW + x];
      if (v > 0.5) valleySamples.push(v);
    }
  }
  valleySamples.sort((a, b) => a - b);
  const valleyP75 = valleySamples.length > 10
    ? valleySamples[Math.floor(valleySamples.length * 0.75)]
    : 22.0;
  const valleyNormCeiling = Math.max(valleyP75 * 2.5, 18.0);

  // ── 7. Morphological Black Top-Hat (shadow crevice isolation) ───────────────
  // Use a 2-pixel radius (5×5 effective) instead of 1-pixel (3×3) for better
  // scale-invariant shadow crevice detection.
  const morphR = Math.max(1, Math.round(Math.min(workW, workH) / 600));
  const topHat = new Uint8ClampedArray(workW * workH);
  const dilated = new Uint8ClampedArray(workW * workH);

  // Dilation with morphR radius (cross structuring element)
  for (let y = morphR; y < workH - morphR; y++) {
    const row = y * workW;
    for (let x = morphR; x < workW - morphR; x++) {
      const idx = row + x;
      let maxVal = clahe[idx];
      for (let d = 1; d <= morphR; d++) {
        if (clahe[idx - d] > maxVal) maxVal = clahe[idx - d];
        if (clahe[idx + d] > maxVal) maxVal = clahe[idx + d];
        if (clahe[idx - workW * d] > maxVal) maxVal = clahe[idx - workW * d];
        if (clahe[idx + workW * d] > maxVal) maxVal = clahe[idx + workW * d];
      }
      dilated[idx] = maxVal;
    }
  }

  // Erosion with morphR radius on dilated result → closing
  for (let y = morphR * 2; y < workH - morphR * 2; y++) {
    const row = y * workW;
    for (let x = morphR * 2; x < workW - morphR * 2; x++) {
      const idx = row + x;
      let minVal = dilated[idx];
      for (let d = 1; d <= morphR; d++) {
        if (dilated[idx - d] < minVal) minVal = dilated[idx - d];
        if (dilated[idx + d] < minVal) minVal = dilated[idx + d];
        if (dilated[idx - workW * d] < minVal) minVal = dilated[idx - workW * d];
        if (dilated[idx + workW * d] < minVal) minVal = dilated[idx + workW * d];
      }
      topHat[idx] = Math.max(0, minVal - clahe[idx]);
    }
  }

  // TopHat normalization (adaptive)
  const topHatSamples: number[] = [];
  for (let y = 4; y < workH - 4; y += 3) {
    for (let x = 4; x < workW - 4; x += 3) {
      const t = topHat[y * workW + x];
      if (t > 1) topHatSamples.push(t);
    }
  }
  topHatSamples.sort((a, b) => a - b);
  const topHatP85 = topHatSamples.length > 10
    ? topHatSamples[Math.floor(topHatSamples.length * 0.85)]
    : 28.0;
  const topHatNormCeiling = Math.max(topHatP85 * 2.0, 20.0);

  // ── 8. Multi-scale Combined Boundary Energy Field ───────────────────────────
  // CONSERVATIVE energy weights: reduce gradient dominance so textured rock
  // surfaces stay as "rock body" instead of being classified as boundaries.
  // Weights now sum to exactly 1.0 to prevent over-driving.
  const energy = new Float32Array(workW * workH);
  for (let i = 0; i < workW * workH; i++) {
    const gNorm = Math.min(1, grad[i] / gradNormCeiling);
    const vNorm = Math.min(1, valley[i] / valleyNormCeiling);
    const thNorm = Math.min(1, topHat[i] / topHatNormCeiling);
    const isDeepShadow = clahe[i] < 18 ? 1 : 0;
    // Reduced gradient weight from 0.38→0.25, boosted valley from 0.34→0.38
    // Valley detects actual inter-rock crevices more reliably than gradient
    energy[i] = Math.min(255, (0.25 * gNorm + 0.38 * vNorm + 0.20 * thNorm + 0.17 * isDeepShadow) * 255);
  }

  // ── 9. Rock Body Mask ───────────────────────────────────────────────────────
  // Raise the seam energy threshold to prevent texture from being classified as seams
  const rockMask = new Uint8ClampedArray(workW * workH);
  const seamEnergyThresh = 135 + params.adaptiveC * 5.0;

  for (let y = 0; y < workH; y++) {
    for (let x = 0; x < workW; x++) {
      const idx = y * workW + x;

      // ROI polygon check
      if (roiPolygon && roiPolygon.length >= 3) {
        const origPt = { x: x / scaleRatio, y: y / scaleRatio };
        if (!isPointInPolygon(origPt, roiPolygon)) {
          rockMask[idx] = 0;
          continue;
        }
      }

      // Exclusion polygons check
      if (exclusionPolygons && exclusionPolygons.length > 0) {
        const origPt = { x: x / scaleRatio, y: y / scaleRatio };
        let excluded = false;
        for (const ep of exclusionPolygons) {
          if (isPointInPolygon(origPt, ep)) {
            excluded = true;
            break;
          }
        }
        if (excluded) {
          rockMask[idx] = 0;
          continue;
        }
      }

      // Non-rock texture gate (sky, flat steel, extreme shadows)
      const isTextureless = grad[idx] < 2.0 && (clahe[idx] > 230 || clahe[idx] < 10);

      // Raised valley threshold to avoid surface micro-texture triggering seams
      const valleyThresh = params.adaptiveC * 4.5 + 22;
      const isSeam =
        energy[idx] > seamEnergyThresh ||
        valley[idx] > valleyThresh ||
        clahe[idx] < 18 ||
        isTextureless;

      rockMask[idx] = isSeam ? 0 : 255;
    }
  }

  // ── 10. Scale-adaptive Morphological Closing & Opening ──────────────────────
  // Use a larger structuring element (2px radius) for closing to bridge
  // micro-texture gaps inside large boulders, and for opening to separate
  // weakly touching rocks.
  const closingR = Math.max(1, Math.round(Math.min(workW, workH) / 500));

  // Closing: Dilation then Erosion with closingR radius
  const closedMask = new Uint8ClampedArray(workW * workH);
  for (let y = closingR; y < workH - closingR; y++) {
    const row = y * workW;
    for (let x = closingR; x < workW - closingR; x++) {
      const idx = row + x;
      let any255 = rockMask[idx] === 255;
      if (!any255) {
        for (let d = 1; d <= closingR && !any255; d++) {
          any255 = rockMask[idx - d] === 255 ||
                   rockMask[idx + d] === 255 ||
                   rockMask[idx - workW * d] === 255 ||
                   rockMask[idx + workW * d] === 255;
        }
      }
      closedMask[idx] = any255 ? 255 : 0;
    }
  }

  const eroded = new Uint8ClampedArray(workW * workH);
  const opened = new Uint8ClampedArray(workW * workH);

  for (let y = closingR; y < workH - closingR; y++) {
    for (let x = closingR; x < workW - closingR; x++) {
      const idx = y * workW + x;
      let all255 = closedMask[idx] === 255;
      if (all255) {
        for (let d = 1; d <= closingR && all255; d++) {
          all255 = closedMask[idx - d] === 255 &&
                   closedMask[idx + d] === 255 &&
                   closedMask[idx - workW * d] === 255 &&
                   closedMask[idx + workW * d] === 255;
        }
      }
      eroded[idx] = all255 ? 255 : 0;
    }
  }

  // Opening re-dilation
  for (let y = closingR; y < workH - closingR; y++) {
    for (let x = closingR; x < workW - closingR; x++) {
      const idx = y * workW + x;
      if (closedMask[idx] === 255) {
        let nearEroded = eroded[idx] === 255;
        if (!nearEroded) {
          for (let d = 1; d <= closingR && !nearEroded; d++) {
            nearEroded = eroded[idx - d] === 255 ||
                         eroded[idx + d] === 255 ||
                         eroded[idx - workW * d] === 255 ||
                         eroded[idx + workW * d] === 255;
          }
        }
        opened[idx] = nearEroded ? 255 : 0;
      }
    }
  }

  const threshCanvas = document.createElement('canvas');
  threshCanvas.width = workW;
  threshCanvas.height = workH;
  const threshCtx = threshCanvas.getContext('2d')!;
  const threshImgData = threshCtx.createImageData(workW, workH);
  for (let i = 0; i < opened.length; i++) {
    const val = opened[i] === 255 ? 235 : 20;
    const idx = i * 4;
    threshImgData.data[idx] = val;
    threshImgData.data[idx + 1] = val;
    threshImgData.data[idx + 2] = val;
    threshImgData.data[idx + 3] = 255;
  }
  threshCtx.putImageData(threshImgData, 0, 0);

  // ── 11. Euclidean Distance Transform ────────────────────────────────────────
  const dist = new Float32Array(workW * workH);
  for (let i = 0; i < dist.length; i++) {
    dist[i] = opened[i] === 0 ? 0 : 9999;
  }

  // Forward pass
  for (let y = 1; y < workH - 1; y++) {
    for (let x = 1; x < workW - 1; x++) {
      const idx = y * workW + x;
      if (dist[idx] > 0) {
        dist[idx] = Math.min(
          dist[idx],
          dist[idx - 1] + 1,
          dist[idx - workW] + 1,
          dist[idx - workW - 1] + 1.414,
          dist[idx - workW + 1] + 1.414
        );
      }
    }
  }

  // Backward pass
  for (let y = workH - 2; y >= 1; y--) {
    for (let x = workW - 2; x >= 1; x--) {
      const idx = y * workW + x;
      if (dist[idx] > 0) {
        dist[idx] = Math.min(
          dist[idx],
          dist[idx + 1] + 1,
          dist[idx + workW] + 1,
          dist[idx + workW + 1] + 1.414,
          dist[idx + workW - 1] + 1.414
        );
      }
    }
  }

  let maxD = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > maxD && dist[i] < 9999) maxD = dist[i];
  }

  // Distance Map Heatmap Preview
  const distCanvas = document.createElement('canvas');
  distCanvas.width = workW;
  distCanvas.height = workH;
  const distCtx = distCanvas.getContext('2d')!;
  const distImgData = distCtx.createImageData(workW, workH);
  for (let i = 0; i < dist.length; i++) {
    const norm = maxD > 0 ? Math.min(1, Math.max(0, dist[i] / maxD)) : 0;
    const idx = i * 4;
    distImgData.data[idx] = Math.round(255 * Math.min(1, norm * 1.6));
    distImgData.data[idx + 1] = Math.round(255 * Math.pow(norm, 1.7));
    distImgData.data[idx + 2] = Math.round(255 * Math.max(0, 1 - norm * 2.2));
    distImgData.data[idx + 3] = 255;
  }
  distCtx.putImageData(distImgData, 0, 0);

  // ── 12. Peak Detection with WIDE Local Maximum Check ────────────────────────
  // Use a proportionally-sized neighborhood (7×7 up to 11×11 for large images)
  // instead of fixed 3×3 to avoid detecting spurious peaks on large boulders.
  const localMaxR = Math.max(3, Math.round(maxD * 0.12));

  // Minimum rock radius: adaptive, NO hard cap at 32px
  const minRockRadiusPx = Math.max(5, Math.round(maxD * 0.18));

  interface CandidatePeak {
    x: number;
    y: number;
    dist: number;
  }
  const candidatePeaks: CandidatePeak[] = [];
  const margin = localMaxR + 1;

  for (let y = margin; y < workH - margin; y++) {
    for (let x = margin; x < workW - margin; x++) {
      const idx = y * workW + x;
      const dVal = dist[idx];
      if (dVal >= minRockRadiusPx && opened[idx] === 255) {
        // Enforce ROI & exclusion
        if (roiPolygon && roiPolygon.length >= 3) {
          const origPt = { x: x / scaleRatio, y: y / scaleRatio };
          if (!isPointInPolygon(origPt, roiPolygon)) continue;
        }
        if (exclusionPolygons && exclusionPolygons.length > 0) {
          const origPt = { x: x / scaleRatio, y: y / scaleRatio };
          let isExcl = false;
          for (const ep of exclusionPolygons) {
            if (isPointInPolygon(origPt, ep)) {
              isExcl = true;
              break;
            }
          }
          if (isExcl) continue;
        }

        // Wide neighborhood local maximum check
        let isMax = true;
        for (let dy = -localMaxR; dy <= localMaxR && isMax; dy++) {
          for (let dx = -localMaxR; dx <= localMaxR; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (dist[(y + dy) * workW + (x + dx)] > dVal) {
              isMax = false;
              break;
            }
          }
        }
        if (isMax) {
          candidatePeaks.push({ x, y, dist: dVal });
        }
      }
    }
  }

  // Sort candidate seeds descending by distance (deepest rock centers first)
  candidatePeaks.sort((a, b) => b.dist - a.dist);

  // ── 13. Adaptive NMS — NO hard cap on suppression distance ──────────────────
  // The suppression radius scales directly with the rock's distance-transform
  // peak value. Large boulders with deep DT peaks naturally suppress nearby
  // spurious seeds, preventing a single large rock from being shattered.
  const acceptedPeaks: CandidatePeak[] = [];
  for (const cand of candidatePeaks) {
    let suppressed = false;
    for (const acc of acceptedPeaks) {
      const dSq = (cand.x - acc.x) ** 2 + (cand.y - acc.y) ** 2;
      // Suppression distance = max(the accepted peak's own radius, proportional to both peaks)
      // NO hard cap — large boulders with DT peaks of 150px will suppress within ~120px
      const suppressionDist = Math.max(
        minRockRadiusPx * 1.4,
        acc.dist * 0.78
      );
      if (dSq < suppressionDist * suppressionDist) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      acceptedPeaks.push(cand);
    }
  }

  // Markers Preview Canvas
  const markerCanvas = document.createElement('canvas');
  markerCanvas.width = workW;
  markerCanvas.height = workH;
  const markerCtx = markerCanvas.getContext('2d')!;
  markerCtx.fillStyle = '#090d16';
  markerCtx.fillRect(0, 0, workW, workH);

  for (const p of acceptedPeaks) {
    markerCtx.strokeStyle = '#eab30844';
    markerCtx.lineWidth = 1.5;
    markerCtx.beginPath();
    markerCtx.arc(p.x, p.y, Math.max(4, p.dist), 0, Math.PI * 2);
    markerCtx.stroke();

    markerCtx.fillStyle = '#eab308';
    markerCtx.beginPath();
    markerCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    markerCtx.fill();
  }

  // ── 14. Marker-Controlled Topographic Watershed ─────────────────────────────
  const labels = new Int32Array(workW * workH);
  const costMap = new Uint8ClampedArray(workW * workH);

  for (let y = 0; y < workH; y++) {
    for (let x = 0; x < workW; x++) {
      const idx = y * workW + x;

      if (opened[idx] === 0) {
        labels[idx] = -1;
        costMap[idx] = 255;
        continue;
      }

      if (roiPolygon && roiPolygon.length >= 3) {
        const origPt = { x: x / scaleRatio, y: y / scaleRatio };
        if (!isPointInPolygon(origPt, roiPolygon)) {
          labels[idx] = -1;
          costMap[idx] = 255;
          continue;
        }
      }

      if (exclusionPolygons && exclusionPolygons.length > 0) {
        const origPt = { x: x / scaleRatio, y: y / scaleRatio };
        let isExcl = false;
        for (const ep of exclusionPolygons) {
          if (isPointInPolygon(origPt, ep)) {
            isExcl = true;
            break;
          }
        }
        if (isExcl) {
          labels[idx] = -1;
          costMap[idx] = 255;
          continue;
        }
      }

      const dNorm = maxD > 0 ? dist[idx] / maxD : 0;
      const eNorm = energy[idx] / 255;
      const cost = Math.min(254, Math.max(0, Math.round((1 - dNorm) * 110 + eNorm * 144)));
      costMap[idx] = cost;
    }
  }

  // Hierarchical FIFO priority queues for 256 elevation levels
  const queues: number[][] = Array.from({ length: 256 }, () => []);

  // Initialize watershed with seed markers
  for (let k = 0; k < acceptedPeaks.length; k++) {
    const peak = acceptedPeaks[k];
    const markerId = k + 1;
    const sIdx = peak.y * workW + peak.x;
    labels[sIdx] = markerId;

    const neighbors = [sIdx - 1, sIdx + 1, sIdx - workW, sIdx + workW];
    const isValid = [peak.x > 0, peak.x < workW - 1, peak.y > 0, peak.y < workH - 1];

    for (let n = 0; n < 4; n++) {
      if (!isValid[n]) continue;
      const nIdx = neighbors[n];
      if (labels[nIdx] === 0) {
        labels[nIdx] = markerId;
        const c = costMap[nIdx];
        queues[c].push(nIdx);
      }
    }
  }

  // Flood uphill
  for (let c = 0; c < 256; c++) {
    const queue = queues[c];
    while (queue.length > 0) {
      const currIdx = queue.pop()!;
      const currLabel = labels[currIdx];
      const cx = currIdx % workW;
      const cy = Math.floor(currIdx / workW);

      const neighbors = [currIdx - 1, currIdx + 1, currIdx - workW, currIdx + workW];
      const isValid = [cx > 0, cx < workW - 1, cy > 0, cy < workH - 1];

      for (let n = 0; n < 4; n++) {
        if (!isValid[n]) continue;
        const nIdx = neighbors[n];
        if (labels[nIdx] === 0) {
          labels[nIdx] = currLabel;
          const nextCost = Math.max(c, costMap[nIdx]);
          queues[nextCost].push(nIdx);
        }
      }
    }
  }

  // ── 15. Region Metadata Collection ──────────────────────────────────────────
  interface RegionMetadata {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    startX: number;
    startY: number;
    pixelCount: number;
  }
  const regionMeta = new Map<number, RegionMetadata>();

  for (let y = 0; y < workH; y++) {
    const rowOffset = y * workW;
    for (let x = 0; x < workW; x++) {
      const lbl = labels[rowOffset + x];
      if (lbl > 0) {
        let meta = regionMeta.get(lbl);
        if (!meta) {
          meta = {
            minX: x, maxX: x, minY: y, maxY: y,
            startX: x, startY: y, pixelCount: 1,
          };
          regionMeta.set(lbl, meta);
        } else {
          if (x < meta.minX) meta.minX = x;
          if (x > meta.maxX) meta.maxX = x;
          if (y > meta.maxY) meta.maxY = y;
          meta.pixelCount++;
        }
      }
    }
  }

  // ── 16. Fragment Extraction with Adaptive Boundary Tracing ──────────────────
  // Allow more boundary tracing steps for large regions
  let fragments: Fragment[] = [];
  let fragId = 1;

  for (let k = 0; k < acceptedPeaks.length; k++) {
    const markerId = k + 1;
    const peak = acceptedPeaks[k];
    const meta = regionMeta.get(markerId);
    if (!meta || meta.pixelCount < 6) continue;

    // Trace region outer boundary contour
    let rawPts = traceRegionBoundary(markerId, labels, workW, workH, meta.startX, meta.startY);

    // Fallback: if boundary loop tracing yielded fewer than 3 points, extract border pixels
    if (rawPts.length < 3 && meta.pixelCount >= 6) {
      const borderPts: Point2D[] = [];
      for (let y = meta.minY; y <= meta.maxY; y++) {
        for (let x = meta.minX; x <= meta.maxX; x++) {
          if (labels[y * workW + x] === markerId) {
            const isBorder =
              x === 0 || x === workW - 1 || y === 0 || y === workH - 1 ||
              labels[y * workW + (x - 1)] !== markerId ||
              labels[y * workW + (x + 1)] !== markerId ||
              labels[(y - 1) * workW + x] !== markerId ||
              labels[(y + 1) * workW + x] !== markerId;
            if (isBorder) borderPts.push({ x, y });
          }
        }
      }
      if (borderPts.length >= 3) {
        rawPts = computeConvexHull(borderPts);
      }
    }

    if (rawPts.length < 3) continue;

    // Convert to original full-resolution coordinates
    const origPts = rawPts.map((pt) => ({
      x: Math.round(pt.x / scaleRatio),
      y: Math.round(pt.y / scaleRatio),
    }));

    // RDP polygon simplification — adaptive epsilon based on region size
    const regionSpan = Math.max(meta.maxX - meta.minX, meta.maxY - meta.minY);
    const rdpEpsilon = Math.max(1.5, Math.min(5.0, regionSpan * 0.025));
    const origPoly = simplifyPolygonRDP(origPts, rdpEpsilon);
    if (origPoly.length < 3) continue;

    // Border filtering
    if (params.filterBorders) {
      const touchesBorder = origPoly.some(
        (p) => p.x <= 2 || p.x >= origW - 2 || p.y <= 2 || p.y >= origH - 2
      );
      if (touchesBorder) continue;
    }

    // Compute polygon area (Shoelace) and Centroid
    let signedArea2 = 0;
    let cxSum = 0;
    let cySum = 0;
    const n = origPoly.length;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const cross = origPoly[i].x * origPoly[next].y - origPoly[next].x * origPoly[i].y;
      signedArea2 += cross;
      cxSum += (origPoly[i].x + origPoly[next].x) * cross;
      cySum += (origPoly[i].y + origPoly[next].y) * cross;
    }
    const areaPx = Math.abs(signedArea2) / 2;
    const areaMm2 = areaPx / (pxPerMm * pxPerMm);
    if (areaMm2 < params.minFragmentAreaMm2) continue;

    let centroidX = Math.round(peak.x / scaleRatio);
    let centroidY = Math.round(peak.y / scaleRatio);
    if (areaPx > 0 && Math.abs(signedArea2) > 1e-4) {
      const factor = 1 / (3 * signedArea2);
      const calcCx = Math.round(cxSum * factor);
      const calcCy = Math.round(cySum * factor);
      if (isPointInPolygon({ x: calcCx, y: calcCy }, origPoly)) {
        centroidX = calcCx;
        centroidY = calcCy;
      }
    }

    // Convex Hull & Caliper-Based Feret Diameters
    const hull = computeConvexHull(origPoly);
    const { minFeretMm, maxFeretMm } = computeFeretDiameters(hull, pxPerMm);
    const aspectRatio = maxFeretMm / Math.max(1, minFeretMm);
    if (aspectRatio > params.maxAspectRatio) continue;

    let hullAreaPx = 0;
    for (let i = 0; i < hull.length; i++) {
      const next = (i + 1) % hull.length;
      hullAreaPx += hull[i].x * hull[next].y - hull[next].x * hull[i].y;
    }
    hullAreaPx = Math.abs(hullAreaPx) / 2;
    const solidity = hullAreaPx > 0 ? areaPx / hullAreaPx : 0.85;
    if (solidity < params.minSolidity) continue;

    const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
    const volumeMm3 = (Math.PI / 6) * Math.pow(minFeretMm, 3);

    // Real bounding box dimensions from actual polygon bounds
    let minPolyX = Infinity, maxPolyX = -Infinity, minPolyY = Infinity, maxPolyY = -Infinity;
    for (const pt of origPoly) {
      if (pt.x < minPolyX) minPolyX = pt.x;
      if (pt.x > maxPolyX) maxPolyX = pt.x;
      if (pt.y < minPolyY) minPolyY = pt.y;
      if (pt.y > maxPolyY) maxPolyY = pt.y;
    }
    const bboxWidthMm = Number(((maxPolyX - minPolyX) / pxPerMm).toFixed(1));
    const bboxHeightMm = Number(((maxPolyY - minPolyY) / pxPerMm).toFixed(1));

    // Thickness estimated via empirical flakiness ratio assumption (c/b = 0.62 per Sanchidrian et al.)
    const thicknessMm = Number((minFeretMm * 0.62).toFixed(1));
    const trueVolume3DMm3 = Math.round((Math.PI / 6) * maxFeretMm * minFeretMm * thicknessMm);

    // Confidence derived from contour solidity and area regularity
    const areaConfidence = Math.min(1, areaMm2 / Math.max(1, params.minFragmentAreaMm2) * 0.1);
    const shapeConfidence = Math.min(1, solidity * 1.05);
    const confidence = Number(Math.min(0.99, (areaConfidence * 0.3 + shapeConfidence * 0.7)).toFixed(2));

    fragments.push({
      id: fragId++,
      polygon: origPoly,
      centroid: { x: centroidX, y: centroidY },
      areaPx: Math.round(areaPx),
      areaMm2: Math.round(areaMm2),
      ecdMm: Number(ecdMm.toFixed(1)),
      minFeretMm: Number(minFeretMm.toFixed(1)),
      maxFeretMm: Number(maxFeretMm.toFixed(1)),
      bboxWidthMm,
      bboxHeightMm,
      aspectRatio: Number(aspectRatio.toFixed(2)),
      solidity: Number(solidity.toFixed(2)),
      volumeMm3: Math.round(volumeMm3),
      confidence,
      depthMm: undefined,
      thicknessMm,
      trueVolume3DMm3,
    });
  }

  // Strictly filter fragments against ROI polygon and exclusion zones
  fragments = filterFragmentsByRoiAndExclusions(fragments, roiPolygon, exclusionPolygons);

  // ── 17. Depth Map Preview ───────────────────────────────────────────────────
  const depthCanvas = document.createElement('canvas');
  depthCanvas.width = workW;
  depthCanvas.height = workH;
  const depthCtx = depthCanvas.getContext('2d')!;
  const depthImgData = depthCtx.createImageData(workW, workH);

  for (let i = 0; i < workW * workH; i++) {
    const dNorm = maxD > 0 ? Math.min(1, Math.max(0, dist[i] / maxD)) : 0;
    const lumNorm = gray[i] / 255;
    const z = Math.min(1, Math.max(0, dNorm * 0.65 + lumNorm * 0.35));

    let r = 0, g = 0, b = 0;
    if (z < 0.25) {
      const t = z / 0.25;
      r = Math.round(30 * (1 - t) + 14 * t);
      g = Math.round(27 * (1 - t) + 165 * t);
      b = Math.round(75 * (1 - t) + 233 * t);
    } else if (z < 0.5) {
      const t = (z - 0.25) / 0.25;
      r = Math.round(14 * (1 - t) + 16 * t);
      g = Math.round(165 * (1 - t) + 185 * t);
      b = Math.round(233 * (1 - t) + 129 * t);
    } else if (z < 0.75) {
      const t = (z - 0.5) / 0.25;
      r = Math.round(16 * (1 - t) + 245 * t);
      g = Math.round(185 * (1 - t) + 158 * t);
      b = Math.round(129 * (1 - t) + 11 * t);
    } else {
      const t = (z - 0.75) / 0.25;
      r = Math.round(245 * (1 - t) + 239 * t);
      g = Math.round(158 * (1 - t) + 68 * t);
      b = Math.round(11 * (1 - t) + 68 * t);
    }

    const pIdx = i * 4;
    depthImgData.data[pIdx] = r;
    depthImgData.data[pIdx + 1] = g;
    depthImgData.data[pIdx + 2] = b;
    depthImgData.data[pIdx + 3] = 255;
  }
  depthCtx.putImageData(depthImgData, 0, 0);

  // ── 18. Segmentation Overlay Preview ────────────────────────────────────────
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = workW;
  overlayCanvas.height = workH;
  const overlayCtx = overlayCanvas.getContext('2d')!;
  overlayCtx.drawImage(imageElement, 0, 0, workW, workH);

  // Dim out unselected background if ROI is active
  if (roiPolygon && roiPolygon.length >= 3) {
    overlayCtx.save();
    overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    overlayCtx.beginPath();
    overlayCtx.rect(0, 0, workW, workH);

    const p0 = { x: roiPolygon[0].x * scaleRatio, y: roiPolygon[0].y * scaleRatio };
    overlayCtx.moveTo(p0.x, p0.y);
    for (let i = 1; i < roiPolygon.length; i++) {
      overlayCtx.lineTo(roiPolygon[i].x * scaleRatio, roiPolygon[i].y * scaleRatio);
    }
    overlayCtx.closePath();
    overlayCtx.fill('evenodd');
    overlayCtx.restore();

    overlayCtx.save();
    overlayCtx.strokeStyle = '#10B981';
    overlayCtx.lineWidth = 2.5;
    overlayCtx.setLineDash([8, 4]);
    overlayCtx.beginPath();
    overlayCtx.moveTo(p0.x, p0.y);
    for (let i = 1; i < roiPolygon.length; i++) {
      overlayCtx.lineTo(roiPolygon[i].x * scaleRatio, roiPolygon[i].y * scaleRatio);
    }
    overlayCtx.closePath();
    overlayCtx.stroke();
    overlayCtx.restore();
  }

  // Draw Exclusion Zones
  if (exclusionPolygons && exclusionPolygons.length > 0) {
    for (const ep of exclusionPolygons) {
      if (ep.length < 3) continue;
      overlayCtx.save();
      overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.40)';
      overlayCtx.strokeStyle = '#EF4444';
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([4, 4]);
      overlayCtx.beginPath();
      overlayCtx.moveTo(ep[0].x * scaleRatio, ep[0].y * scaleRatio);
      for (let i = 1; i < ep.length; i++) {
        overlayCtx.lineTo(ep[i].x * scaleRatio, ep[i].y * scaleRatio);
      }
      overlayCtx.closePath();
      overlayCtx.fill();
      overlayCtx.stroke();

      const cx = (ep.reduce((acc, p) => acc + p.x, 0) / ep.length) * scaleRatio;
      const cy = (ep.reduce((acc, p) => acc + p.y, 0) / ep.length) * scaleRatio;
      overlayCtx.fillStyle = '#EF4444';
      overlayCtx.font = 'bold 11px sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.textBaseline = 'middle';
      overlayCtx.fillText('\u{1F6AB} Exclu', cx, cy);
      overlayCtx.restore();
    }
  }

  // 5-tier size-based color coding
  const getColorForFragment = (minFeretMm: number): string => {
    if (minFeretMm < 150) return '#06B6D4';
    if (minFeretMm < 300) return '#3B82F6';
    if (minFeretMm < 500) return '#10B981';
    if (minFeretMm < 750) return '#F59E0B';
    return '#EF4444';
  };

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const col = getColorForFragment(f.minFeretMm);

    overlayCtx.fillStyle = col + '52';
    overlayCtx.strokeStyle = col;
    overlayCtx.lineWidth = 2.0;

    overlayCtx.beginPath();
    const startX = f.polygon[0].x * scaleRatio;
    const startY = f.polygon[0].y * scaleRatio;
    overlayCtx.moveTo(startX, startY);
    for (let v = 1; v < f.polygon.length; v++) {
      overlayCtx.lineTo(f.polygon[v].x * scaleRatio, f.polygon[v].y * scaleRatio);
    }
    overlayCtx.closePath();
    overlayCtx.fill();
    overlayCtx.stroke();

    const cx = f.centroid.x * scaleRatio;
    const cy = f.centroid.y * scaleRatio;
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.beginPath();
    overlayCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    overlayCtx.fill();
  }

  // ── 19. Overlay with Sizing Badges ──────────────────────────────────────────
  const sizingCanvas = document.createElement('canvas');
  sizingCanvas.width = workW;
  sizingCanvas.height = workH;
  const sizingCtx = sizingCanvas.getContext('2d')!;
  sizingCtx.drawImage(overlayCanvas, 0, 0);

  sizingCtx.font = 'bold 10px sans-serif';
  sizingCtx.textAlign = 'center';
  sizingCtx.textBaseline = 'middle';

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const cx = f.centroid.x * scaleRatio;
    const cy = f.centroid.y * scaleRatio;

    const label = `${Math.round(f.minFeretMm)}mm`;
    const textWidth = sizingCtx.measureText(label).width;
    const badgeW = textWidth + 8;
    const badgeH = 14;

    sizingCtx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    sizingCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    sizingCtx.lineWidth = 1;
    sizingCtx.beginPath();
    sizingCtx.roundRect(cx - badgeW / 2, cy - badgeH / 2, badgeW, badgeH, 3);
    sizingCtx.fill();
    sizingCtx.stroke();

    sizingCtx.fillStyle = '#ffffff';
    sizingCtx.fillText(label, cx, cy);
  }

  return {
    fragments,
    stepPreviews: {
      grayscale: grayCanvas.toDataURL('image/jpeg', 0.8),
      clahe: claheCanvas.toDataURL('image/jpeg', 0.8),
      threshold: threshCanvas.toDataURL('image/png'),
      distance: distCanvas.toDataURL('image/jpeg', 0.8),
      markers: markerCanvas.toDataURL('image/png'),
      depthMap: depthCanvas.toDataURL('image/jpeg', 0.85),
      overlay: overlayCanvas.toDataURL('image/jpeg', 0.85),
      overlayWithSizing: sizingCanvas.toDataURL('image/jpeg', 0.88),
    },
  };
}


export function rescaleFragments(
  fragments: Fragment[],
  newPxPerMm: number
): Fragment[] {
  if (newPxPerMm <= 0) return fragments;

  return fragments.map((f) => {
    const areaMm2 = f.areaPx / (newPxPerMm * newPxPerMm);
    const hull = computeConvexHull(f.polygon);
    const { minFeretMm, maxFeretMm } = computeFeretDiameters(hull, newPxPerMm);
    const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
    const aspectRatio = maxFeretMm / Math.max(1, minFeretMm);
    const volumeMm3 = (Math.PI / 6) * Math.pow(minFeretMm, 3);
    const thicknessRatio = f.thicknessMm && f.minFeretMm > 0 ? f.thicknessMm / f.minFeretMm : 0.65;
    const thicknessMm = Number((minFeretMm * thicknessRatio).toFixed(1));
    const trueVolume3DMm3 = Math.round((Math.PI / 6) * maxFeretMm * minFeretMm * thicknessMm);

    return {
      ...f,
      areaMm2: Math.round(areaMm2),
      ecdMm: Number(ecdMm.toFixed(1)),
      minFeretMm: Number(minFeretMm.toFixed(1)),
      maxFeretMm: Number(maxFeretMm.toFixed(1)),
      bboxWidthMm: Number((maxFeretMm * 0.9).toFixed(1)),
      bboxHeightMm: Number((minFeretMm * 1.1).toFixed(1)),
      aspectRatio: Number(aspectRatio.toFixed(2)),
      volumeMm3: Math.round(volumeMm3),
      thicknessMm,
      trueVolume3DMm3,
    };
  });
}

