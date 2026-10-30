import type {
  Fragment,
  Point2D,
  Calibration,
  AiEngineParams,
} from '../../types';
import {
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
    name: 'Fine-Grain Morphological Preset (High Sensitivity)',
    framework: 'Client-Side Mathematical Morphology (100% Offline)',
    sizeMb: 0.1,
    url: 'local://fragmill-fine-preset',
    downloaded: true,
    isFallback: true,
  },
  {
    id: 'composite_multiscale',
    name: 'Multi-Scale Composite Preset',
    framework: 'Adaptive Multi-Resolution Watershed (100% Offline)',
    sizeMb: 0.1,
    url: 'local://fragmill-composite-preset',
    downloaded: true,
    isFallback: true,
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

// Engine B: Fine-Grain Watershed (High Sensitivity Preset with NMS filtering)
export async function runAiSegmentation(
  imageElement: HTMLImageElement,
  calibration: Calibration,
  params: AiEngineParams,
  onProgress?: (percent: number, msg: string) => void,
  roiPolygon?: Point2D[],
  exclusionPolygons?: Point2D[][]
): Promise<Fragment[]> {
  onProgress?.(25, 'Applying high-contrast CLAHE & fine-grain watershed...');

  // High-precision adaptive multi-scale segmentation preset
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

  onProgress?.(70, 'Applying Non-Maximum Suppression (NMS) on overlapping proposals...');

  // Retain geometric confidence computed honestly from solidity and area
  const candidates = [...classicalResult.fragments];
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

  onProgress?.(100, 'Fine-grain segmentation complete.');
  return filterFragmentsByRoiAndExclusions(filtered, roiPolygon, exclusionPolygons);
}

// Engine C: Multi-Scale Composite Preset (combines coarse and fine resolution watershed results)
export async function runHybridSegmentation(
  coarseFragments: Fragment[],
  fineFragments: Fragment[],
  roiPolygon?: Point2D[],
  exclusionPolygons?: Point2D[][]
): Promise<Fragment[]> {
  // Take large fragments (minFeret >= 70mm) from coarse pass (cleaner rock borders)
  const largeCoarse = coarseFragments.filter((f) => f.minFeretMm >= 70);

  // Take medium and fines (< 70mm) from fine pass (higher local texture sensitivity)
  const nonOverlappingFine = fineFragments.filter((cf) => {
    if (cf.minFeretMm >= 70) return false;
    for (const lf of largeCoarse) {
      const dist = Math.hypot(lf.centroid.x - cf.centroid.x, lf.centroid.y - cf.centroid.y);
      const minDist = Math.max(30, lf.minFeretMm * 0.4);
      if (dist < minDist) return false;
    }
    return true;
  });

  const combined = [...largeCoarse, ...nonOverlappingFine];
  return filterFragmentsByRoiAndExclusions(combined, roiPolygon, exclusionPolygons);
}
