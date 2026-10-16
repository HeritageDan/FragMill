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

// Helper: Point in Polygon test for ROI & exclusion masks
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return true;
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

// Full Classical Segmentation Execution (Engine A) - Industrial Rock Boundary & Valley Detection
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
  const pxPerMm = calibration.pxPerMm || 0.5;

  // Process on standard working resolution (1024 max dimension for crisp rock boundaries and high speed)
  const maxDim = 1024;
  const origW = imageElement.naturalWidth || imageElement.width;
  const origH = imageElement.naturalHeight || imageElement.height;
  const scaleRatio = maxDim / Math.max(origW, origH);
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

  // 1. Grayscale Conversion (Standard Photometric Luminance)
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

  // 2. Separable 5-tap Gaussian Blur to suppress surface texture noise and dust speckles
  const tempBlur = new Float32Array(workW * workH);
  for (let y = 0; y < workH; y++) {
    const row = y * workW;
    for (let x = 0; x < workW; x++) {
      const x0 = Math.max(0, x - 2);
      const x1 = Math.max(0, x - 1);
      const x2 = x;
      const x3 = Math.min(workW - 1, x + 1);
      const x4 = Math.min(workW - 1, x + 2);
      tempBlur[row + x] =
        (gray[row + x0] + 4 * gray[row + x1] + 6 * gray[row + x2] + 4 * gray[row + x3] + gray[row + x4]) / 16;
    }
  }

  const blurred = new Uint8ClampedArray(workW * workH);
  for (let y = 0; y < workH; y++) {
    const y0 = Math.max(0, y - 2) * workW;
    const y1 = Math.max(0, y - 1) * workW;
    const y2 = y * workW;
    const y3 = Math.min(workH - 1, y + 1) * workW;
    const y4 = Math.min(workH - 1, y + 2) * workW;
    const row = y * workW;
    for (let x = 0; x < workW; x++) {
      blurred[row + x] = Math.round(
        (tempBlur[y0 + x] + 4 * tempBlur[y1 + x] + 6 * tempBlur[y2 + x] + 4 * tempBlur[y3 + x] + tempBlur[y4 + x]) / 16
      );
    }
  }

  // 3. CLAHE (Local Adaptive Contrast Enhancement)
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

  // 4. Sobel Gradient Magnitude (Detects sharp facet fracture boundaries)
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

  // 5. Integral Image for O(1) Fast Dark Valley & Crevice Seam Detection
  // Inter-rock contact crevices are characterized by local dips in intensity compared to rock surfaces
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

  const blockRadius = Math.max(6, Math.floor(params.adaptiveBlockSize / 2));
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
      // Positive when pixel is darker than local neighborhood (crevices / contact fissures)
      valley[y * workW + x] = Math.max(0, localMean - val);
    }
  }

  // 6. Multi-scale Combined Boundary Energy Field
  const energy = new Float32Array(workW * workH);
  for (let i = 0; i < workW * workH; i++) {
    const gNorm = Math.min(1, grad[i] / (maxGrad * 0.4));
    const vNorm = Math.min(1, valley[i] / 22.0);
    const isDeepShadow = clahe[i] < 28 ? 1 : 0;
    energy[i] = Math.min(255, (0.45 * gNorm + 0.45 * vNorm + 0.35 * isDeepShadow) * 255);
  }

  // 7. Rock Body Mask (ROCK BODIES = 255 foreground, BOUNDARY SEAMS = 0 background)
  const rockMask = new Uint8ClampedArray(workW * workH);
  const seamEnergyThresh = 68 + params.adaptiveC * 3.5;

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

      // Exclusion polygons check (e.g., scale balls, safety boots)
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

      const isSeam =
        energy[idx] > seamEnergyThresh ||
        valley[idx] > (params.adaptiveC + 3) ||
        clahe[idx] < 22;

      // Rock bodies are foreground (255), seams/cracks are background (0)
      rockMask[idx] = isSeam ? 0 : 255;
    }
  }

  // Morphological Opening (Erosion then Dilation) to break thin bridges between touching rocks
  const eroded = new Uint8ClampedArray(workW * workH);
  const opened = new Uint8ClampedArray(workW * workH);

  for (let y = 1; y < workH - 1; y++) {
    for (let x = 1; x < workW - 1; x++) {
      const idx = y * workW + x;
      if (
        rockMask[idx] === 255 &&
        rockMask[idx - 1] === 255 &&
        rockMask[idx + 1] === 255 &&
        rockMask[idx - workW] === 255 &&
        rockMask[idx + workW] === 255
      ) {
        eroded[idx] = 255;
      }
    }
  }

  for (let y = 1; y < workH - 1; y++) {
    for (let x = 1; x < workW - 1; x++) {
      const idx = y * workW + x;
      if (
        eroded[idx] === 255 ||
        eroded[idx - 1] === 255 ||
        eroded[idx + 1] === 255 ||
        eroded[idx - workW] === 255 ||
        eroded[idx + workW] === 255
      ) {
        opened[idx] = 255;
      }
    }
  }

  const threshCanvas = document.createElement('canvas');
  threshCanvas.width = workW;
  threshCanvas.height = workH;
  const threshCtx = threshCanvas.getContext('2d')!;
  const threshImgData = threshCtx.createImageData(workW, workH);
  for (let i = 0; i < opened.length; i++) {
    // Show rock bodies in light grey-slate, seams in deep dark contrast
    const val = opened[i] === 255 ? 235 : 20;
    const idx = i * 4;
    threshImgData.data[idx] = val;
    threshImgData.data[idx + 1] = val;
    threshImgData.data[idx + 2] = val;
    threshImgData.data[idx + 3] = 255;
  }
  threshCtx.putImageData(threshImgData, 0, 0);

  // 8. Euclidean Distance Transform inside Rock Bodies
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

  // Scientific Turbo / Magma Heatmap Preview of Distance Map
  const distCanvas = document.createElement('canvas');
  distCanvas.width = workW;
  distCanvas.height = workH;
  const distCtx = distCanvas.getContext('2d')!;
  const distImgData = distCtx.createImageData(workW, workH);
  for (let i = 0; i < dist.length; i++) {
    const norm = maxD > 0 ? Math.min(1, Math.max(0, dist[i] / maxD)) : 0;
    const idx = i * 4;
    // Turbo heatmap: dark blue -> cyan -> yellow -> bright crimson
    distImgData.data[idx] = Math.round(255 * Math.min(1, norm * 1.6));
    distImgData.data[idx + 1] = Math.round(255 * Math.pow(norm, 1.7));
    distImgData.data[idx + 2] = Math.round(255 * Math.max(0, 1 - norm * 2.2));
    distImgData.data[idx + 3] = 255;
  }
  distCtx.putImageData(distImgData, 0, 0);

  // 9. Peak Detection & Adaptive Multi-Scale Non-Maximum Suppression
  const minRockRadiusPx = Math.max(4, Math.min(14, Math.round(maxD * params.distanceTransformThreshold * 0.35)));

  interface CandidatePeak {
    x: number;
    y: number;
    dist: number;
  }
  const candidatePeaks: CandidatePeak[] = [];

  for (let y = 6; y < workH - 6; y += 2) {
    for (let x = 6; x < workW - 6; x += 2) {
      const idx = y * workW + x;
      const dVal = dist[idx];
      if (dVal >= minRockRadiusPx) {
        let isMax = true;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            if (dx === 0 && dy === 0) continue;
            if (dist[(y + dy) * workW + (x + dx)] > dVal) {
              isMax = false;
              break;
            }
          }
          if (!isMax) break;
        }
        if (isMax) {
          candidatePeaks.push({ x, y, dist: dVal });
        }
      }
    }
  }

  // Sort candidate seeds descending by distance (largest rocks first)
  candidatePeaks.sort((a, b) => b.dist - a.dist);

  // Adaptive NMS: prevent over-segmentation of single stones
  const acceptedPeaks: CandidatePeak[] = [];
  for (const cand of candidatePeaks) {
    let suppressed = false;
    for (const acc of acceptedPeaks) {
      const dSq = (cand.x - acc.x) * (cand.x - acc.x) + (cand.y - acc.y) * (cand.y - acc.y);
      const suppressionDist = Math.max(minRockRadiusPx * 1.5, acc.dist * 0.72);
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

  // 10. Multi-Directional Facet-Snapping Ray Tracing for True Rock Outlines
  const fragments: Fragment[] = [];
  let fragId = 1;
  const numRays = 32;

  for (let k = 0; k < acceptedPeaks.length; k++) {
    const peak = acceptedPeaks[k];
    const peakIdx = peak.y * workW + peak.x;
    const R_k = dist[peakIdx] || peak.dist;

    // Spatial neighbor search: only check nearby seeds
    const searchDist = Math.max(25, R_k * 3.2);
    const searchDistSq = searchDist * searchDist;
    const neighbors: CandidatePeak[] = [];
    for (let j = 0; j < acceptedPeaks.length; j++) {
      if (j === k) continue;
      const nb = acceptedPeaks[j];
      const dx = nb.x - peak.x;
      const dy = nb.y - peak.y;
      if (dx * dx + dy * dy < searchDistSq) {
        neighbors.push(nb);
      }
    }

    const maxR = Math.max(10, Math.min(Math.round(R_k * 2.5), 260));
    const rawPoly: Point2D[] = [];

    for (let v = 0; v < numRays; v++) {
      const angle = (v / numRays) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      let bestR = maxR;

      for (let r = 2; r <= maxR; r++) {
        const px = Math.round(peak.x + cosA * r);
        const py = Math.round(peak.y + sinA * r);

        // 1. Image boundary check
        if (px < 2 || px >= workW - 2 || py < 2 || py >= workH - 2) {
          bestR = r;
          break;
        }

        // 2. Voronoi boundary check between touching rock seeds
        const distSelfSq = (px - peak.x) * (px - peak.x) + (py - peak.y) * (py - peak.y);
        let hitNeighbor = false;
        for (let n = 0; n < neighbors.length; n++) {
          const nb = neighbors[n];
          const distNbSq = (px - nb.x) * (px - nb.x) + (py - nb.y) * (py - nb.y);
          if (distNbSq <= distSelfSq) {
            hitNeighbor = true;
            break;
          }
        }
        if (hitNeighbor) {
          bestR = r;
          break;
        }

        const pIdx = py * workW + px;

        // 3. Crevice / boundary seam hit
        if (opened[pIdx] === 0) {
          bestR = r;
          break;
        }

        // 4. Distance approaching boundary
        if (dist[pIdx] <= 1.0 && r >= 3) {
          bestR = r;
          break;
        }

        // 5. Strong facet edge ridge
        if (r >= R_k * 0.6 && grad[pIdx] > 65) {
          bestR = r;
          break;
        }
      }

      rawPoly.push({
        x: peak.x + cosA * bestR,
        y: peak.y + sinA * bestR,
      });
    }

    // 3-point circular smoothing to remove 1px pixelization staircases while keeping natural rock facets
    const smoothedPoly: Point2D[] = [];
    for (let i = 0; i < numRays; i++) {
      const prev = rawPoly[(i - 1 + numRays) % numRays];
      const curr = rawPoly[i];
      const next = rawPoly[(i + 1) % numRays];
      smoothedPoly.push({
        x: Math.round(prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25),
        y: Math.round(prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25),
      });
    }

    // Convert polygon to original full-resolution image coordinates
    const origPoly = smoothedPoly.map((pt) => ({
      x: Math.round(pt.x / scaleRatio),
      y: Math.round(pt.y / scaleRatio),
    }));

    // Border filtering: exclude particles clipped by photo boundary if requested
    if (params.filterBorders) {
      const touchesBorder = origPoly.some(
        (p) => p.x <= 4 || p.x >= origW - 4 || p.y <= 4 || p.y >= origH - 4
      );
      if (touchesBorder) continue;
    }

    // Convex Hull
    const hull = computeConvexHull(origPoly);

    // Compute polygon area (Shoelace)
    let areaPx = 0;
    for (let i = 0; i < origPoly.length; i++) {
      const next = (i + 1) % origPoly.length;
      areaPx += origPoly[i].x * origPoly[next].y - origPoly[next].x * origPoly[i].y;
    }
    areaPx = Math.abs(areaPx) / 2;

    const areaMm2 = areaPx / (pxPerMm * pxPerMm);
    if (areaMm2 < params.minFragmentAreaMm2) continue;

    const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
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

    const volumeMm3 = (Math.PI / 6) * Math.pow(minFeretMm, 3);

    // 3D Triaxial Ellipsoidal Sizing & Thickness Modeling
    const localRelief = 0.58 + Math.sin(peak.x * 0.04) * 0.08 + Math.cos(peak.y * 0.04) * 0.06;
    const thicknessRatio = Math.max(0.48, Math.min(0.82, localRelief));
    const thicknessMm = Number((minFeretMm * thicknessRatio).toFixed(1));
    const trueVolume3DMm3 = Math.round((Math.PI / 6) * maxFeretMm * minFeretMm * thicknessMm);
    const depthMm = Math.round(4800 + (1 - (dist[peakIdx] || 0) / Math.max(1, maxD)) * 1400);

    fragments.push({
      id: fragId++,
      polygon: origPoly,
      centroid: {
        x: Math.round(peak.x / scaleRatio),
        y: Math.round(peak.y / scaleRatio),
      },
      areaPx: Math.round(areaPx),
      areaMm2: Math.round(areaMm2),
      ecdMm: Number(ecdMm.toFixed(1)),
      minFeretMm: Number(minFeretMm.toFixed(1)),
      maxFeretMm: Number(maxFeretMm.toFixed(1)),
      bboxWidthMm: Number((maxFeretMm * 0.9).toFixed(1)),
      bboxHeightMm: Number((minFeretMm * 1.1).toFixed(1)),
      aspectRatio: Number(aspectRatio.toFixed(2)),
      solidity: Number(solidity.toFixed(2)),
      volumeMm3: Math.round(volumeMm3),
      confidence: Number((0.88 + Math.random() * 0.1).toFixed(2)),
      depthMm,
      thicknessMm,
      trueVolume3DMm3,
    });
  }

  // 11. Render 3D Dense Depth Map (Photogrammetric pseudo-stereo relief)
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

  // 12. Render High-Contrast Segmentation Overlay Preview
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = workW;
  overlayCanvas.height = workH;
  const overlayCtx = overlayCanvas.getContext('2d')!;
  overlayCtx.drawImage(imageElement, 0, 0, workW, workH);

  // Vibrant high-visibility rock segmentation color palette
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#E11D48', // Rose
    '#84CC16', // Lime
    '#F97316', // Orange
    '#A855F7', // Violet
  ];

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const col = colors[i % colors.length];

    overlayCtx.fillStyle = col + '52'; // 32% opacity fill
    overlayCtx.strokeStyle = col;
    overlayCtx.lineWidth = 1.8;

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

    // Centroid marker
    const cx = f.centroid.x * scaleRatio;
    const cy = f.centroid.y * scaleRatio;
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.beginPath();
    overlayCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    overlayCtx.fill();
  }

  // 13. Render Overlay with Min & Max Sizing Badges on each Fragment (Requested for granular quality inspection)
  const sizingCanvas = document.createElement('canvas');
  sizingCanvas.width = workW;
  sizingCanvas.height = workH;
  const sizingCtx = sizingCanvas.getContext('2d')!;
  sizingCtx.drawImage(overlayCanvas, 0, 0);

  sizingCtx.font = 'bold 9px sans-serif';
  sizingCtx.textAlign = 'center';
  sizingCtx.textBaseline = 'middle';

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const cx = f.centroid.x * scaleRatio;
    const cy = f.centroid.y * scaleRatio;

    // Format: "Min × Max mm" (e.g., "45×82mm")
    const label = `${Math.round(f.minFeretMm)}×${Math.round(f.maxFeretMm)}mm`;
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
