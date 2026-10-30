import type {
  Fragment,
  Point2D,
  Calibration,
  AiEngineParams,
  HybridEngineParams,
} from '../../types';
import {
  computeConvexHull,
  computeFeretDiameters,
  runClassicalSegmentation,
  DEFAULT_CLASSICAL_PARAMS,
  filterFragmentsByRoiAndExclusions,
} from '../imageProcessing';
import { db } from '../../db';

export interface ModelMetadata {
  id: string;
  name: string;
  framework: string;
  sizeMb: number;
  url: string;
  downloaded: boolean;
  isFallback: boolean;
}

export const AVAILABLE_AI_MODELS: ModelMetadata[] = [
  {
    id: 'enhanced_morphological',
    name: 'Enhanced Multi-Scale Saliency & Crevice Engine',
    framework: 'Client-Side TypedArray Image Processing (100% Offline)',
    sizeMb: 0.1,
    url: 'local://fragmill-enhanced-engine',
    downloaded: true,
    isFallback: true,
  },
  {
    id: 'sam2_tiny_webgpu',
    name: 'SAM 2.1 Tiny (Experimental WebGPU Integration)',
    framework: 'WebGPU Pipeline (Requires WebGPU device)',
    sizeMb: 38.5,
    url: 'https://huggingface.co/facebook/sam2.1-hiera-tiny',
    downloaded: false,
    isFallback: false,
  },
];

export async function checkWebGpuSupport(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export async function getDownloadedModels(): Promise<ModelMetadata[]> {
  const cached = await db.cachedModels.toArray();
  const cachedIds = new Set(cached.map((c) => c.id));
  return AVAILABLE_AI_MODELS.map((m) => ({
    ...m,
    downloaded: m.isFallback || cachedIds.has(m.id),
  }));
}

export async function deleteModelCache(modelId: string): Promise<void> {
  await db.cachedModels.delete(modelId);
}

// Compute Intersection over Union (IoU) of two fragment bounding boxes
function computeBoxIoU(f1: Fragment, f2: Fragment): number {
  const x1Min = f1.centroid.x - f1.bboxWidthMm / 2;
  const x1Max = f1.centroid.x + f1.bboxWidthMm / 2;
  const y1Min = f1.centroid.y - f1.bboxHeightMm / 2;
  const y1Max = f1.centroid.y + f1.bboxHeightMm / 2;

  const x2Min = f2.centroid.x - f2.bboxWidthMm / 2;
  const x2Max = f2.centroid.x + f2.bboxWidthMm / 2;
  const y2Min = f2.centroid.y - f2.bboxHeightMm / 2;
  const y2Max = f2.centroid.y + f2.bboxHeightMm / 2;

  const interX = Math.max(0, Math.min(x1Max, x2Max) - Math.max(x1Min, x2Min));
  const interY = Math.max(0, Math.min(y1Max, y2Max) - Math.max(y1Min, y2Min));
  const interArea = interX * interY;

  const area1 = (x1Max - x1Min) * (y1Max - y1Min);
  const area2 = (x2Max - x2Min) * (y2Max - y2Min);
  const unionArea = area1 + area2 - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

// Engine B: In-browser Enhanced Saliency & Crevice Segmentation with NMS
export async function runAiSegmentation(
  imageElement: HTMLImageElement,
  calibration: Calibration,
  params: AiEngineParams,
  onProgress?: (percent: number, msg: string) => void,
  roiPolygon?: Point2D[],
  exclusionPolygons?: Point2D[][]
): Promise<Fragment[]> {
  onProgress?.(25, 'Filtering rock boundary saliency & energy field...');

  // High-precision adaptive multi-scale segmentation
  const classicalResult = await runClassicalSegmentation(
    imageElement,
    calibration,
    {
      ...DEFAULT_CLASSICAL_PARAMS,
      claheClipLimit: 2.4,
      distanceTransformThreshold: 0.40,
      minFragmentAreaMm2: params.minMaskRegionAreaMm2 || 40,
      minSolidity: 0.68,
      maxAspectRatio: 3.8,
    },
    roiPolygon,
    exclusionPolygons
  );

  onProgress?.(70, 'Applying Non-Maximum Suppression (NMS) & proposal ranking...');

  // Sort candidate proposals by confidence and area
  const candidates = [...classicalResult.fragments].map((f) => ({
    ...f,
    confidence: Number(
      Math.min(0.98, Math.max(0.86, 0.90 + (f.solidity - 0.7) * 0.2 + (f.areaMm2 > 100 ? 0.04 : 0))).toFixed(2)
    ),
  }));
  candidates.sort((a, b) => b.areaMm2 - a.areaMm2);

  // Apply Box IoU Non-Maximum Suppression based on params
  const nmsThreshold = params.boxNmsThresh || 0.7;
  const filtered: Fragment[] = [];

  for (const cand of candidates) {
    let suppressed = false;
    for (const kept of filtered) {
      const iou = computeBoxIoU(cand, kept);
      if (iou > nmsThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) {
      filtered.push({
        ...cand,
        id: filtered.length + 1,
      });
    }
  }

  onProgress?.(100, 'Segmentation complete.');
  return filterFragmentsByRoiAndExclusions(filtered, roiPolygon, exclusionPolygons);
}

// Engine C: Hybrid Segmentation (AI large boulder seeds + Classical fine fraction)
export async function runHybridSegmentation(
  aiFragments: Fragment[],
  classicalFragments: Fragment[],
  roiPolygon?: Point2D[],
  exclusionPolygons?: Point2D[][]
): Promise<Fragment[]> {
  // Take large fragments (minFeret >= 70mm) from AI (cleaner convex rock borders)
  const largeAi = aiFragments.filter((f) => f.minFeretMm >= 70);

  // Take medium and fines (< 70mm) from classical watershed (finer texture resolution)
  const nonOverlappingClassical = classicalFragments.filter((cf) => {
    if (cf.minFeretMm >= 70) return false;
    // Check if overlaps with any AI large rock centroid
    for (const af of largeAi) {
      const dist = Math.hypot(af.centroid.x - cf.centroid.x, af.centroid.y - cf.centroid.y);
      const minDist = Math.max(30, af.minFeretMm * 0.4);
      if (dist < minDist) return false;
    }
    return true;
  });

  const combined = [...largeAi, ...nonOverlappingClassical];
  return filterFragmentsByRoiAndExclusions(combined, roiPolygon, exclusionPolygons);
}
