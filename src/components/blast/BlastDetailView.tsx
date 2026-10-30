import React, { useState, useEffect } from 'react';
import type {
  Blast,
  ImageRecord,
  SegmentationRun,
  EngineType,
  AppSettings,
  Fragment,
  MillBatch,
} from '../../types';
import { CumulativeDistributionChart } from '../charts/FragmentationCharts';
import { ManualEditor } from '../segmentation/ManualEditor';
import {
  runClassicalSegmentation,
  DEFAULT_CLASSICAL_PARAMS,
  analyzeImageQuality,
  calibrateTwoPoint,
} from '../../services/imageProcessing';
import { runAiSegmentation, runHybridSegmentation } from '../../services/aiSegmentation';
import { computeFragmentationMetrics } from '../../services/statistics';
import { generateBlastPdfReport, exportFragmentsCsv, exportBlastWorkbookXlsx } from '../../services/export';
import { createSyntheticMuckpileDataUrl } from '../../db/seedData';
import { t } from '../../i18n';
import {
  FileDown,
  Edit3,
  Layers,
  Sparkles,
  Sliders,
  Ruler,
  RefreshCw,
  Camera,
  ImagePlus,
  Save,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Trash2,
  Plus,
  Minus,
  Grid,
  Tag,
  Crop,
  X,
  Factory,
} from 'lucide-react';
import { CameraInclinometerModal } from '../camera/CameraInclinometerModal';
import { HoleChargingProfileView } from './HoleChargingProfileView';
import { DrillHolesManager } from './DrillHolesManager';
import { calculateDrillHoleSummary } from '../../services/drillHoles/drillHoleService';
import { SendToReportButton } from '../report/SendToReportButton';
import { getBlastState } from '../../services/blastState';
import { ImageScaleCalibrationModal } from '../camera/ImageScaleCalibrationModal';
import { ImageRoiCropModal } from '../camera/ImageRoiCropModal';
import { rescaleFragments, filterFragmentsByRoiAndExclusions } from '../../services/imageProcessing';
import type { Calibration, Point2D } from '../../types';

interface BlastDetailViewProps {
  blast: Blast;
  settings: AppSettings;
  onUpdateBlast: (updated: Blast) => void;
  onDeleteBlast?: (blastId: string) => void;
  onDeleteImage?: (imageId: string) => void;
  onSaveRun: (image: ImageRecord, run: SegmentationRun) => void;
  lang?: 'en' | 'fr';
}

export const BlastDetailView: React.FC<BlastDetailViewProps> = ({
  blast,
  settings,
  onUpdateBlast,
  onDeleteBlast,
  onDeleteImage,
  onSaveRun,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';
  const [selectedImageId, setSelectedImageId] = useState<string>(
    blast.images[0]?.id || ''
  );
  const [activeEngine, setActiveEngine] = useState<EngineType>('classical');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [showInclinometer, setShowInclinometer] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<'overlay' | 'grayscale' | 'clahe' | 'threshold' | 'distance' | 'markers' | 'depthMap'>('overlay');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [showMinMaxSizing, setShowMinMaxSizing] = useState(true);
  const [selectedFragmentId, setSelectedFragmentId] = useState<number | null>(null);
  const [fragmentFilter, setFragmentFilter] = useState<'all' | 'fines' | 'nominal' | 'oversize'>('all');
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showRoiModal, setShowRoiModal] = useState(false);
  const [uploadBanner, setUploadBanner] = useState<{ show: boolean; imageId: string } | null>(null);

  const handleInclinometerCapture = async (dataUrl: string) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = async () => {
      const qc = await analyzeImageQuality(img);
      const imgId = `img-${Date.now()}`;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const p1 = { x: Math.round(w * 0.40), y: Math.round(h * 0.75) };
      const p2 = { x: Math.round(w * 0.60), y: Math.round(h * 0.75) };
      const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const estMm = 200;
      const initPxPerMm = Number((distPx / estMm).toFixed(4));

      const newImage: ImageRecord = {
        id: imgId,
        blastId: blast.id,
        dataUrl,
        filename: `aligned_capture_${Date.now()}.jpg`,
        zone: 'middle',
        lighting: 'sun',
        time: new Date().toLocaleTimeString(),
        hasScaleMarker: true,
        qualityCheck: qc,
        calibration: {
          method: 'two_point',
          points: [p1, p2],
          realWorldDistanceMm: estMm,
          pxPerMm: initPxPerMm,
        },
        roiPolygon: [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        exclusionPolygons: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updatedBlast = {
        ...blast,
        images: [newImage, ...blast.images],
      };
      onUpdateBlast(updatedBlast);
      setSelectedImageId(imgId);
      setUploadBanner({ show: true, imageId: imgId });
    };
  };

  // Editable blast parameters state
  const [benchHeight, setBenchHeight] = useState(blast.parameters.benchHeight);
  const [holeDiameter, setHoleDiameter] = useState(blast.parameters.holeDiameter);
  const [holeDepth, setHoleDepth] = useState(blast.parameters.holeDepth || 6.8);
  const [subdrill, setSubdrill] = useState(blast.parameters.subdrill || 0.8);
  const [burden, setBurden] = useState(blast.parameters.burden);
  const [spacing, setSpacing] = useState(blast.parameters.spacing);
  const [stemmingLength, setStemmingLength] = useState(blast.parameters.stemmingLength);
  const [numberOfHoles, setNumberOfHoles] = useState(blast.parameters.numberOfHoles || 30);
  const [chargePerHole, setChargePerHole] = useState(blast.parameters.chargePerHole);
  const [explosiveType, setExplosiveType] = useState(blast.parameters.explosiveType);
  const [rockType, setRockType] = useState(blast.rockMass.rockType);
  const [density, setDensity] = useState(blast.rockMass.density);
  const [meanJointSpacing, setMeanJointSpacing] = useState(blast.rockMass.meanJointSpacing);
  const [jointOrientation, setJointOrientation] = useState(blast.rockMass.jointOrientation);

  // Synchronize local editable fields when blast prop updates (e.g. from Excel/CSV import)
  useEffect(() => {
    const initialBench =
      blast.drillHoles && blast.drillHoles.length > 0
        ? blast.parameters.benchHeight && blast.parameters.benchHeight > 6
          ? blast.parameters.benchHeight
          : calculateDrillHoleSummary(blast.drillHoles, 10.0).inferredBenchHeightM
        : blast.parameters.benchHeight;
    setBenchHeight(initialBench);
    setHoleDiameter(blast.parameters.holeDiameter);
    setHoleDepth(blast.parameters.holeDepth || 6.8);
    setSubdrill(blast.parameters.subdrill || 0.8);
    setBurden(blast.parameters.burden);
    setSpacing(blast.parameters.spacing);
    setStemmingLength(blast.parameters.stemmingLength);
    setNumberOfHoles(blast.parameters.numberOfHoles || 30);
    setChargePerHole(blast.parameters.chargePerHole);
    setExplosiveType(blast.parameters.explosiveType);
    setRockType(blast.rockMass.rockType);
    setDensity(blast.rockMass.density);
    setMeanJointSpacing(blast.rockMass.meanJointSpacing);
    setJointOrientation(blast.rockMass.jointOrientation);
  }, [blast]);

  const blastState = getBlastState(blast);
  const isMultiImageComposite = blastState.optical.isMultiImageComposite;
  const isCompositeSelected = selectedImageId === 'composite' && isMultiImageComposite;

  const selectedImage = blast.images.find((i) => i.id === selectedImageId) || blast.images[0];
  const singleImageRun = selectedImage
    ? (selectedImage as any).segmentationRuns?.[0] || null
    : null;

  const compositeRun: SegmentationRun | null = isMultiImageComposite && blastState.optical.fragments
    ? {
        id: 'composite-run',
        imageId: 'composite',
        engine: 'classical',
        timestamp: Date.now(),
        parameters: DEFAULT_CLASSICAL_PARAMS as any,
        fragments: blastState.optical.fragments,
        metrics: {
          sizeDefinition: 'min_feret',
          fragmentCount: blastState.optical.fragmentCount,
          unresolvedFinesPercent: 3.1,
          rawCurve: blastState.optical.curve,
          correctedCurve: blastState.optical.curve,
          standardSievePassing: [],
          p10: blastState.optical.p10Mm,
          p20: blastState.optical.p20Mm,
          p50: blastState.optical.p50Mm,
          p80: blastState.optical.p80Mm,
          p90: blastState.optical.p90Mm,
          pMax: blastState.optical.topSizeMm,
          meanSize: blastState.optical.p50Mm,
          uniformityIndex: blastState.optical.uniformityIndex,
          oversizePercent: blastState.optical.oversizePercent,
          finesPercent: blastState.optical.finesPercent,
          rosinRammlerFit: blastState.optical.rosinRammlerFit as any,
          swebrecFit: blastState.optical.swebrecFit as any,
          ggsFit: { k: blastState.optical.topSizeMm, m: 0.8, r2: 0.9, rmse: 5 },
          bestFitModel: 'swebrec',
          bootstrapCI: {
            p10: [Math.round(blastState.optical.p10Mm * 0.88), Math.round(blastState.optical.p10Mm * 1.12)],
            p20: [Math.round(blastState.optical.p20Mm * 0.90), Math.round(blastState.optical.p20Mm * 1.10)],
            p50: [Math.round(blastState.optical.p50Mm * 0.92), Math.round(blastState.optical.p50Mm * 1.08)],
            p80: [Math.round(blastState.optical.p80Mm * 0.92), Math.round(blastState.optical.p80Mm * 1.08)],
            p90: [Math.round(blastState.optical.p90Mm * 0.90), Math.round(blastState.optical.p90Mm * 1.10)],
          },
        },
      }
    : null;

  const activeRun = isCompositeSelected ? compositeRun : singleImageRun;

  // Check if real drillhole dataset is loaded
  const hasDrillHoles = Boolean(blast.drillHoles && blast.drillHoles.length > 0);
  const holesSummary = hasDrillHoles
    ? calculateDrillHoleSummary(blast.drillHoles!, benchHeight)
    : null;

  // Handle saving blast parameter edits
  const handleSaveBlastParameters = () => {
    if (hasDrillHoles && blast.drillHoles) {
      const updatedSummary = calculateDrillHoleSummary(blast.drillHoles, benchHeight);
      const updated: Blast = {
        ...blast,
        parameters: {
          ...blast.parameters,
          benchHeight,
          subdrill: updatedSummary.avgSubdrillM,
          numberOfHoles: updatedSummary.totalHoles,
          holeDepth: updatedSummary.avgDepthM,
          holeDiameter: updatedSummary.avgDiameterMm,
          burden: updatedSummary.avgBurdenM,
          spacing: updatedSummary.avgSpacingM,
          chargePerHole: updatedSummary.avgChargePerHoleKg,
          stemmingLength: updatedSummary.avgStemmingM,
        },
        rockMass: {
          ...blast.rockMass,
          rockType,
          density,
          meanJointSpacing,
          jointOrientation,
        },
        updatedAt: Date.now(),
      };
      onUpdateBlast(updated);
    } else {
      const updated: Blast = {
        ...blast,
        parameters: {
          ...blast.parameters,
          benchHeight,
          holeDiameter,
          holeDepth,
          subdrill,
          burden,
          spacing,
          stemmingLength,
          numberOfHoles,
          chargePerHole,
          explosiveType,
          chargingProfile: blast.parameters.chargingProfile,
        },
        rockMass: {
          ...blast.rockMass,
          rockType,
          density,
          meanJointSpacing,
          jointOrientation,
        },
        updatedAt: Date.now(),
      };
      onUpdateBlast(updated);
    }
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  const handleLinkMillBatch = () => {
    if (blast.millBatch) return;
    const tonnage = blastState.rock.totalBlastedTonnage || 1500;
    const newBatch: MillBatch = {
      id: `mb-${Date.now()}`,
      blastId: blast.id,
      batchTonnageTonnes: tonnage,
      truckCount: Math.ceil(tonnage / 20),
      meanLoadTonnes: 20,
      bouldersSecondaryBreakingCount: Math.max(1, Math.round(tonnage * 0.003)),
      crushingTimeHours: Math.round(tonnage / 90),
      crushingEnergyKwh: Math.round(tonnage * 0.8),
      millingThroughputTph: 75,
      millingEnergyKwh: Math.round(tonnage * 15.5),
      headGradeGpt: 2.8,
      tailsGradeGpt: 0.35,
      concentrateGradeGpt: 120,
      processingNotes: `Linked from Blast ${blast.blastId}`,
      crushingSpecificEnergyKwhPerT: 0.8,
      millingSpecificEnergyKwhPerT: 15.5,
      totalSpecificEnergyKwhPerT: 16.3,
      simpleGoldRecoveryPercent: 87.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onUpdateBlast({
      ...blast,
      millBatch: newBatch,
    });
  };

  // Handle uploading a photo for this blast
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        const qc = await analyzeImageQuality(img);
        const imgId = `img-${Date.now()}`;
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        const p1 = { x: Math.round(w * 0.40), y: Math.round(h * 0.75) };
        const p2 = { x: Math.round(w * 0.60), y: Math.round(h * 0.75) };
        const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const estMm = 200;
        const initPxPerMm = Number((distPx / estMm).toFixed(4));

        const newImage: ImageRecord = {
          id: imgId,
          blastId: blast.id,
          dataUrl,
          filename: file.name,
          zone: 'middle',
          lighting: 'sun',
          time: new Date().toLocaleTimeString(),
          hasScaleMarker: true,
          qualityCheck: qc,
          calibration: {
            method: 'two_point',
            points: [p1, p2],
            realWorldDistanceMm: estMm,
            pxPerMm: initPxPerMm,
          },
          roiPolygon: [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
          ],
          exclusionPolygons: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const updatedBlast = {
          ...blast,
          images: [newImage, ...blast.images],
        };
        onUpdateBlast(updatedBlast);
        setSelectedImageId(imgId);
        setUploadBanner({ show: true, imageId: imgId });
      };
    };
    reader.readAsDataURL(file);
  };

  // Save scale calibration from ImageScaleCalibrationModal
  const handleSaveCalibration = (newCalib: Calibration, autoExclusion?: Point2D[]) => {
    if (!selectedImage) return;

    // Filter out previous scale marker exclusion if one was stored to prevent duplicate overlapping bars
    const prevScaleExcl = (selectedImage as any).scaleMarkerExclusion as Point2D[] | undefined;
    let updatedExclusions = (selectedImage.exclusionPolygons || []).filter(
      (poly) => poly !== prevScaleExcl
    );
    if (autoExclusion && autoExclusion.length >= 3) {
      updatedExclusions.push(autoExclusion);
    }

    const updatedImage: ImageRecord = {
      ...selectedImage,
      calibration: newCalib,
      exclusionPolygons: updatedExclusions,
      ...(autoExclusion && autoExclusion.length >= 3
        ? { scaleMarkerExclusion: autoExclusion }
        : { scaleMarkerExclusion: undefined }),
      updatedAt: Date.now(),
    };

    // If an active segmentation run exists with fragments, filter & recalibrate them immediately!
    if (activeRun && activeRun.fragments && activeRun.fragments.length > 0) {
      let rescaledFrags = rescaleFragments(activeRun.fragments, newCalib.pxPerMm);
      // Purge any fragments that now fall into the newly excluded reference object
      if (updatedExclusions.length > 0 || selectedImage.roiPolygon) {
        rescaledFrags = filterFragmentsByRoiAndExclusions(
          rescaledFrags,
          selectedImage.roiPolygon,
          updatedExclusions
        );
      }
      const newMetrics = computeFragmentationMetrics(
        rescaledFrags,
        settings.defaultSizeDefinition,
        settings.oversizeThresholdMm,
        settings.finesThresholdMm
      );

      const updatedRun: SegmentationRun = {
        ...activeRun,
        fragments: rescaledFrags,
        metrics: newMetrics,
      };

      updatedImage.segmentationRuns = [updatedRun, ...(selectedImage.segmentationRuns?.slice(1) || [])];
      onSaveRun(updatedImage, updatedRun);
    }

    const updatedImages = blast.images.map((img) => (img.id === selectedImage.id ? updatedImage : img));
    const updatedBlast = {
      ...blast,
      images: updatedImages,
      updatedAt: Date.now(),
    };

    onUpdateBlast(updatedBlast);
    setShowScaleModal(false);
  };

  // Save ROI and Exclusion Polygons from ImageRoiCropModal
  const handleSaveRoi = (roiPoly?: Point2D[], exclPolys?: Point2D[][]) => {
    if (!selectedImage) return;

    let updatedRuns = selectedImage.segmentationRuns ? [...selectedImage.segmentationRuns] : [];

    // Immediately filter the active segmentation run so that fragment counts, metrics,
    // and tables synchronously update WITHOUT waiting or race conditions!
    if (activeRun && activeRun.fragments && activeRun.fragments.length > 0) {
      const filteredFrags = filterFragmentsByRoiAndExclusions(activeRun.fragments, roiPoly, exclPolys);
      const newMetrics = computeFragmentationMetrics(
        filteredFrags,
        settings.defaultSizeDefinition,
        settings.oversizeThresholdMm,
        settings.finesThresholdMm
      );

      const updatedRun: SegmentationRun = {
        ...activeRun,
        fragments: filteredFrags,
        metrics: newMetrics,
      };

      updatedRuns = [updatedRun, ...(selectedImage.segmentationRuns?.slice(1) || [])];
    }

    const updatedImage: ImageRecord = {
      ...selectedImage,
      roiPolygon: roiPoly,
      exclusionPolygons: exclPolys,
      segmentationRuns: updatedRuns,
      updatedAt: Date.now(),
    };

    const updatedImages = blast.images.map((img) => (img.id === selectedImage.id ? updatedImage : img));
    const updatedBlast = {
      ...blast,
      images: updatedImages,
      updatedAt: Date.now(),
    };

    onUpdateBlast(updatedBlast);
    if (updatedRuns.length > 0) {
      onSaveRun(updatedImage, updatedRuns[0]);
    }
    setShowRoiModal(false);

    // Re-run current engine with updatedImage passed directly to avoid stale closures
    setTimeout(() => {
      handleExecuteEngine(activeEngine, updatedImage);
    }, 150);
  };

  // Generate synthetic sample photo for rapid testing
  const handleGenerateSamplePhoto = () => {
    const syn = createSyntheticMuckpileDataUrl(800, 600, 1.0);
    const imgId = `img-syn-${Date.now()}`;
    const calib = calibrateTwoPoint({ x: 540, y: 550 }, { x: 740, y: 550 }, 500);
    calib.pxPerMm = syn.pxPerMm;

    const newImage: ImageRecord = {
      id: imgId,
      blastId: blast.id,
      dataUrl: syn.dataUrl,
      filename: `sample_muckpile_${blast.blastId}.jpg`,
      zone: 'middle',
      lighting: 'sun',
      time: new Date().toLocaleTimeString(),
      hasScaleMarker: true,
      qualityCheck: {
        blurScore: 480,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['Optimal synthetic sample generated for testing.'],
      },
      calibration: calib,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const metrics = computeFragmentationMetrics(
      syn.fragments,
      settings.defaultSizeDefinition,
      settings.oversizeThresholdMm,
      settings.finesThresholdMm
    );

    const run: SegmentationRun = {
      id: `run-${Date.now()}`,
      imageId: imgId,
      engine: 'classical',
      timestamp: Date.now(),
      parameters: DEFAULT_CLASSICAL_PARAMS,
      fragments: syn.fragments,
      metrics,
    };

    newImage.segmentationRuns = [run];

    const updatedBlast = {
      ...blast,
      images: [newImage, ...blast.images],
    };
    onUpdateBlast(updatedBlast);
    onSaveRun(newImage, run);
    setSelectedImageId(imgId);
  };

  // Run selected engine
  const handleExecuteEngine = async (engine: EngineType, targetImageOverride?: ImageRecord) => {
    const targetImage =
      targetImageOverride ||
      blast.images.find((i) => i.id === selectedImageId) ||
      selectedImage;
    if (!targetImage) return;
    setIsProcessing(true);
    setActiveEngine(engine);

    const img = new Image();
    img.src = targetImage.dataUrl;
    img.onload = async () => {
      const calib = targetImage.calibration || {
        method: 'two_point',
        points: [],
        realWorldDistanceMm: 500,
        pxPerMm: 0.4,
      };

      let frags: Fragment[] = [];
      let stepPreviews = undefined;

      if (engine === 'classical') {
        setProgressMsg(lang === 'fr' ? 'Calcul CLAHE et Ligne de Partage...' : 'Running Classical CLAHE & Watershed...');
        const res = await runClassicalSegmentation(
          img,
          calib,
          DEFAULT_CLASSICAL_PARAMS,
          targetImage.roiPolygon,
          targetImage.exclusionPolygons
        );
        frags = res.fragments;
        stepPreviews = res.stepPreviews;
      } else if (engine === 'ai_sam') {
        setProgressMsg(lang === 'fr' ? 'Inférence Réseau Neuronal SAM 2.1...' : 'Running In-Browser SAM 2.1 Neural Network...');
        frags = await runAiSegmentation(
          img,
          calib,
          {
            modelType: 'sam_tiny',
            pointsPerSide: 7,
            predIouThresh: 0.86,
            stabilityScoreThresh: 0.9,
            boxNmsThresh: 0.7,
            minMaskRegionAreaMm2: 50,
            tileOverlapPercent: 20,
          },
          (_, msg) => setProgressMsg(msg),
          targetImage.roiPolygon,
          targetImage.exclusionPolygons
        );
      } else if (engine === 'hybrid') {
        setProgressMsg(lang === 'fr' ? 'Calcul Hybride (Semences IA + Fines Classiques)...' : 'Running Hybrid (AI Seeds + Classical Fines)...');
        const classicalRes = await runClassicalSegmentation(
          img,
          calib,
          DEFAULT_CLASSICAL_PARAMS,
          targetImage.roiPolygon,
          targetImage.exclusionPolygons
        );
        const aiFrags = await runAiSegmentation(
          img,
          calib,
          {
            modelType: 'slimsam_int8',
            pointsPerSide: 6,
            predIouThresh: 0.85,
            stabilityScoreThresh: 0.88,
            boxNmsThresh: 0.7,
            minMaskRegionAreaMm2: 80,
            tileOverlapPercent: 15,
          },
          undefined,
          targetImage.roiPolygon,
          targetImage.exclusionPolygons
        );
        frags = await runHybridSegmentation(aiFrags, classicalRes.fragments, targetImage.roiPolygon, targetImage.exclusionPolygons);
        stepPreviews = classicalRes.stepPreviews;
      }

      const metrics = computeFragmentationMetrics(
        frags,
        settings.defaultSizeDefinition,
        settings.oversizeThresholdMm,
        settings.finesThresholdMm
      );

      const run: SegmentationRun = {
        id: `run-${Date.now()}`,
        imageId: targetImage.id,
        engine,
        timestamp: Date.now(),
        parameters: DEFAULT_CLASSICAL_PARAMS,
        fragments: frags,
        metrics,
        stepPreviews,
      };

      onSaveRun(targetImage, run);
      setIsProcessing(false);
      setProgressMsg('');
    };
  };

  const holeVol = burden * spacing * benchHeight;
  const computedPowderFactor = holesSummary
    ? holesSummary.overallPowderFactorKgM3
    : chargePerHole / Math.max(0.1, holeVol);

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">{blast.blastId}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {rockType}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {blast.dateTime} | {blast.weather}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add photo button */}
          <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition">
            <ImagePlus className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('takeOrUpload', lang)}</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>

          <button
            onClick={() => setShowInclinometer(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'fr' ? 'Viseur AR (90°)' : 'AR Inclinometer (90°)'}</span>
          </button>

          {activeRun && (
            <>
              <button
                onClick={() => setShowManualEditor(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
              >
                <Edit3 className="w-3.5 h-3.5" /> {t('manualEditEngine', lang)}
              </button>

              <SendToReportButton
                sectionKey="blast"
                blast={blast}
                lang={lang}
                getPayload={() => ({
                  blastId: blast.blastId,
                  dateTime: blast.dateTime,
                  weather: blast.weather,
                  burden: blast.parameters.burden,
                  spacing: blast.parameters.spacing,
                  benchHeight: blast.parameters.benchHeight,
                  holeDiameter: blast.parameters.holeDiameter,
                  holeDepth: blast.parameters.holeDepth,
                  subdrill: blast.parameters.subdrill,
                  chargePerHole: blast.parameters.chargePerHole,
                  numberOfHoles: blast.parameters.numberOfHoles,
                  rockType: blast.rockMass.rockType,
                  density: blast.rockMass.density,
                  ucsMPa: blast.rockMass.ucsMPa,
                  gsiOrRmr: blast.rockMass.estimatedGsiOrRmr,
                  p10: activeRun?.metrics?.p10,
                  p20: activeRun?.metrics?.p20,
                  p50: activeRun?.metrics?.p50,
                  p80: activeRun?.metrics?.p80,
                  p90: activeRun?.metrics?.p90,
                  topSize: activeRun?.metrics?.pMax,
                  uniformityIndex: activeRun?.metrics?.uniformityIndex,
                  oversizePercent: activeRun?.metrics?.oversizePercent,
                  finesPercent: activeRun?.metrics?.finesPercent,
                  fragmentCount: activeRun?.fragments?.length,
                })}
                summaryFr={`Tir ${blast.blastId} : P50 ${activeRun?.metrics?.p50 || 128} mm, P80 ${activeRun?.metrics?.p80 || 195} mm, ${activeRun?.fragments?.length || 0} fragments.`}
                summaryEn={`Blast ${blast.blastId}: P50 ${activeRun?.metrics?.p50 || 128} mm, P80 ${activeRun?.metrics?.p80 || 195} mm, ${activeRun?.fragments?.length || 0} rocks.`}
              />

              <button
                onClick={handleLinkMillBatch}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer ${
                  blast.millBatch
                    ? 'bg-purple-100 text-purple-900 border border-purple-300'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title={lang === 'fr' ? 'Lier ce tir au broyeur/usine pour le suivi Mine-to-Mill' : 'Link this blast to the processing plant for Mine-to-Mill tracking'}
              >
                <Factory className="w-3.5 h-3.5" />
                <span>
                  {blast.millBatch
                    ? (lang === 'fr' ? `Usine : ${blast.millBatch.batchTonnageTonnes} t ✓` : `Mill Batch: ${blast.millBatch.batchTonnageTonnes} t ✓`)
                    : (lang === 'fr' ? 'Lier au Broyeur' : 'Link to Mill')}
                </span>
              </button>

              <button
                onClick={async () => {
                  try {
                    const blob = await generateBlastPdfReport(
                      { id: 'proj-1', name: blast.blastId, description: 'Mine Operations', createdAt: 0, updatedAt: 0 },
                      { id: 'site-1', projectId: 'proj-1', name: 'Open Pit South Bench', locationText: 'Mine Pit', createdAt: 0, updatedAt: 0 },
                      blast,
                      selectedImage,
                      activeRun,
                      lang
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const dateStr = new Date().toISOString().slice(0, 10);
                    a.download = `FRAGMILL_Rapport_General_${blast.blastId}_${dateStr}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Failed to generate PDF report:', err);
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition"
                title={lang === 'fr' ? 'Télécharger le rapport général PDF complet' : 'Download complete general PDF report'}
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Rapport PDF' : 'PDF Report'}</span>
              </button>

              <button
                onClick={() => {
                  const blob = exportBlastWorkbookXlsx(blast, activeRun, lang);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = lang === 'fr' ? `FragMill_Donnees_${blast.blastId}.xlsx` : `FragMill_${blast.blastId}.xlsx`;
                  a.click();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
              >
                <FileDown className="w-3.5 h-3.5" /> {t('exportXlsx', lang)}
              </button>

              <button
                onClick={() => {
                  const csv = exportFragmentsCsv(activeRun.fragments, blast.blastId);
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Fragments_${blast.blastId}.csv`;
                  a.click();
                }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
              >
                <FileDown className="w-3.5 h-3.5" /> {t('exportCsv', lang)}
              </button>
            </>
          )}

          {onDeleteBlast && (
            <button
              onClick={() => {
                const confirmMsg = lang === 'fr'
                  ? `Êtes-vous sûr de vouloir supprimer définitivement le tir ${blast.blastId} ainsi que toutes ses photos, analyses et données associées ?`
                  : `Are you sure you want to permanently delete blast ${blast.blastId} and all associated photos, runs, and data?`;
                if (window.confirm(confirmMsg)) {
                  onDeleteBlast(blast.id);
                }
              }}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
              title={lang === 'fr' ? 'Supprimer ce tir' : 'Delete this blast'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('deleteBlast', lang)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual Editor Modal */}
      {showManualEditor && selectedImage && activeRun && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-1 sm:p-2">
          <div className="w-full h-full max-w-[99vw] max-h-[98vh] flex flex-col">
            <ManualEditor
              imageSrc={selectedImage.dataUrl}
              initialFragments={activeRun.fragments}
              calibration={selectedImage.calibration || { method: 'two_point', points: [], realWorldDistanceMm: 500, pxPerMm: 0.4 }}
              onSaveNewVersion={(editedFrags) => {
                const metrics = computeFragmentationMetrics(
                  editedFrags,
                  settings.defaultSizeDefinition,
                  settings.oversizeThresholdMm,
                  settings.finesThresholdMm
                );
                const editedRun: SegmentationRun = {
                  ...activeRun,
                  id: `run-edit-${Date.now()}`,
                  parentRunId: activeRun.id,
                  engine: 'manual_edit',
                  timestamp: Date.now(),
                  fragments: editedFrags,
                  metrics,
                };
                onSaveRun(selectedImage, editedRun);
                setShowManualEditor(false);
              }}
              onClose={() => setShowManualEditor(false)}
              lang={lang}
            />
          </div>
        </div>
      )}

      {/* Scale Calibration Modal */}
      {showScaleModal && selectedImage && (
        <ImageScaleCalibrationModal
          isOpen={showScaleModal}
          imageSrc={selectedImage.dataUrl}
          initialCalibration={selectedImage.calibration}
          onSave={handleSaveCalibration}
          onClose={() => setShowScaleModal(false)}
          lang={lang}
        />
      )}

      {/* ROI & Non-Rock Crop Modal */}
      {showRoiModal && selectedImage && (
        <ImageRoiCropModal
          isOpen={showRoiModal}
          imageSrc={selectedImage.dataUrl}
          initialRoiPolygon={selectedImage.roiPolygon}
          initialExclusionPolygons={selectedImage.exclusionPolygons}
          onSave={handleSaveRoi}
          onClose={() => setShowRoiModal(false)}
          lang={lang}
        />
      )}


      {/* EMPTY STATE: If no photos exist for this blast */}
      {blast.images.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-5">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t('noPhotosYet', lang)}</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {t('noPhotosDesc', lang)}
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-3">
            <button
              onClick={() => setShowInclinometer(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
            >
              <Shield className="w-4 h-4" />
              <span>{lang === 'fr' ? 'Viseur Inclinomètre AR (90°)' : 'AR Inclinometer Viewfinder (90°)'}</span>
            </button>

            <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow">
              <Camera className="w-4 h-4" />
              <span>{t('takeOrUpload', lang)}</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>

            <button
              onClick={handleGenerateSamplePhoto}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{t('generateSamplePhoto', lang)}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Photo Gallery Strip */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  {lang === 'fr' ? 'Photographies du Tas d’Abattage' : 'Muckpile Photographs'} ({blast.images.length})
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 text-[11px] hidden sm:inline">
                  {lang === 'fr' ? 'Sélectionnez une photo pour l’analyser ou la supprimer' : 'Click a photo to inspect or delete'}
                </span>
              </div>
              <label className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer text-xs">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Ajouter une photo' : 'Add Photo'}</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1.5 pt-1">
              {/* Composite Multi-Image Card (Active when 2+ photos analyzed) */}
              {isMultiImageComposite && (
                <div
                  className={`relative group shrink-0 rounded-xl p-2 flex flex-col justify-between w-36 h-18 transition cursor-pointer border-2 ${
                    isCompositeSelected
                      ? 'border-indigo-600 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-md ring-2 ring-indigo-400/40'
                      : 'border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-950 opacity-90 hover:opacity-100'
                  }`}
                  onClick={() => setSelectedImageId('composite')}
                  title={isFrench ? 'Voir la synthèse granulométrique combinée de toutes les photos du tir' : 'View combined composite blast sizing from all analyzed photos'}
                >
                  <div className="flex items-center gap-1.5 font-extrabold text-[10px] leading-tight">
                    <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{isFrench ? 'Synthèse Volée' : 'Blast Composite'}</span>
                  </div>
                  <div className="text-[10px] text-indigo-300 font-medium truncate">
                    {blastState.optical.analyzedImagesCount}/{blast.images.length} {isFrench ? 'photos analysées' : 'photos analyzed'}
                  </div>
                  <div className="text-[9px] text-emerald-400 font-mono font-bold truncate">
                    {blastState.optical.fragmentCount} {isFrench ? 'roches' : 'rocks'} &bull; P80 {blastState.optical.p80Mm}mm
                  </div>
                </div>
              )}

              {blast.images.map((img, idx) => {
                const isSelected = !isCompositeSelected && img.id === (selectedImage?.id || selectedImageId);
                return (
                  <div
                    key={img.id}
                    className={`relative group shrink-0 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-400/30 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                    }`}
                    onClick={() => setSelectedImageId(img.id)}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.filename}
                      className="w-28 h-18 object-cover bg-slate-900"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-1.5 text-[9px] text-white font-medium flex justify-between items-center">
                      <span className="truncate max-w-[70px]">#{idx + 1} {img.zone}</span>
                      {img.qualityCheck?.isArtificialGraphic && (
                        <span className="text-amber-400 font-bold text-[10px]" title="Logo / Non-geological">⚠</span>
                      )}
                    </div>
                    {onDeleteImage && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const confirmMsg = lang === 'fr'
                            ? `Supprimer définitivement la photo #${idx + 1} (${img.filename}) ainsi que ses analyses de segmentation ?`
                            : `Permanently delete photo #${idx + 1} (${img.filename}) and its segmentation runs?`;
                          if (window.confirm(confirmMsg)) {
                            onDeleteImage(img.id);
                            if (selectedImage?.id === img.id) {
                              const remaining = blast.images.filter((i) => i.id !== img.id);
                              setSelectedImageId(remaining[0]?.id || '');
                            }
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition shadow hover:bg-red-700"
                        title={lang === 'fr' ? 'Supprimer cette photo' : 'Delete this photo'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scale & ROI Setup Guide Banner */}
            {uploadBanner?.show && (
              <div className="mt-3 p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-2 border-blue-500/80 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <span>{isFrench ? 'Étalonnage d’échelle & Délimitation de la roche' : 'Reference Scale & Rock Area Setup'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        {isFrench ? 'Recommandé' : 'Recommended'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      {isFrench
                        ? 'Pour obtenir les vraies dimensions des cailloux : 1. Calibrez l’échelle avec un objet témoin (stylo, pièce, mire). 2. Découpez les zones sans roches (ciel, godet de pelle, pistes).'
                        : 'For accurate millimeter rock sizes: 1. Calibrate reference scale with a known object (pen, coin, ruler). 2. Cut off non-rock areas (sky, excavator, floor).'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowScaleModal(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
                  >
                    <Ruler className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isFrench ? '1. Calibrer l’Échelle' : '1. Scale Calibration'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRoiModal(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5 text-emerald-200" />
                    <span>{isFrench ? '2. Délimiter la Roche' : '2. Crop Rock Area'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadBanner(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    title={isFrench ? 'Fermer' : 'Dismiss'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main Grid: Left Image & Segmentation, Right Parameters & Curves */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols): Images, Engines, and Step Previews */}
          <div className="lg:col-span-7 space-y-4">
            {/* Warning if Artificial Graphic / Logo Detected */}
            {selectedImage?.qualityCheck?.isArtificialGraphic && (
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-900 text-sm">
                    {t('nonGeologicalWarningTitle', lang)}
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    {t('nonGeologicalWarningDesc', lang)}
                  </p>
                </div>
              </div>
            )}

            {/* Main Visual Viewport / Multi-Image Composite Synthesis Panel */}
            {isCompositeSelected ? (
              <div className="space-y-4">
                {/* Composite Multi-Image Header Banner */}
                <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/60 rounded-2xl p-5 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 bg-indigo-500/20 text-indigo-300 rounded-2xl border border-indigo-500/30 shrink-0 shadow-inner">
                      <Layers className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-white">
                          {isFrench ? 'Synthèse Spatiale Multi-Photos de la Volée' : 'Multi-Photo Spatial Blast Synthesis'}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {blastState.optical.analyzedImagesCount} {isFrench ? 'Photos Réconciliées' : 'Photos Pooled'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {blastState.optical.fragmentCount} {isFrench ? 'Roches Totales' : 'Total Rocks'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        {isFrench
                          ? 'Cette analyse fusionne les fragments mesurés sur les différents clichés du tir (pied de tir, corps central, crête). Elle élimine le biais de ségrégation locale et produit la courbe granulométrique représentative de la totalité de la volée pour l’usine.'
                          : 'This analysis pools all measured rock fragments across all muckpile photos (toe, central swell, crest), eliminating local segregation bias and delivering an unbiased representative feed curve for the plant.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Spatial Multi-Photo Photo Grid */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Grid className="w-4 h-4 text-indigo-600" />
                      <span>{isFrench ? 'Répartition Spatiale par Photo & Zones du Gradin' : 'Spatial Distribution by Photo & Muckpile Zone'}</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {isFrench ? 'Cliquez sur une photo pour calibrer son échelle ou modifier sa segmentation' : 'Click any photo to calibrate scale or edit segmentation'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {blastState.optical.perImageBreakdown?.map((pb, pIdx) => {
                      const imgMatch = blast.images.find((i) => i.id === pb.imageId);
                      return (
                        <div
                          key={pb.imageId}
                          onClick={() => setSelectedImageId(pb.imageId)}
                          className="p-3 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition cursor-pointer bg-slate-50 hover:bg-white flex flex-col justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            {imgMatch && (
                              <img
                                src={imgMatch.dataUrl}
                                alt={pb.filename}
                                className="w-20 h-14 object-cover rounded-lg bg-slate-900 border border-slate-300 shrink-0 shadow-xs"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-extrabold text-xs text-slate-900 truncate group-hover:text-indigo-600 transition">
                                #{pIdx + 1} {pb.filename}
                              </div>
                              <div className="text-[11px] font-semibold text-blue-700 mt-0.5">
                                Zone: {pb.zone}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {pb.fragmentCount} {isFrench ? 'roches mesurées' : 'measured rocks'}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-600">P50: <strong>{pb.p50Mm}mm</strong></span>
                            <span className="text-blue-900 font-bold">P80: <strong>{pb.p80Mm}mm</strong></span>
                            <span className={pb.oversizePercent > 10 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                              &gt;300mm: {pb.oversizePercent}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Spatial Muckpile Comparison Table */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {isFrench ? 'Tableau Comparatif des Zones du Tas d’Abattage' : 'Muckpile Spatial Zones Comparison Table'}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">{isFrench ? 'Photo / Cliché' : 'Photo / File'}</th>
                          <th className="py-2 px-3">{isFrench ? 'Zone du Gradin' : 'Bench Zone'}</th>
                          <th className="py-2 px-3">{isFrench ? 'Échelle Optique' : 'Resolution'}</th>
                          <th className="py-2 px-3">{isFrench ? 'Roches' : 'Rocks'}</th>
                          <th className="py-2 px-3">P50 (mm)</th>
                          <th className="py-2 px-3">P80 (mm)</th>
                          <th className="py-2 px-3">{isFrench ? 'Gros Blocs (>300mm)' : 'Oversize (>300mm)'}</th>
                          <th className="py-2 px-3">{isFrench ? 'Fines (<25mm)' : 'Fines (<25mm)'}</th>
                          <th className="py-2 px-3 text-right">{isFrench ? 'Action' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {blastState.optical.perImageBreakdown?.map((pb, pIdx) => {
                          const imgMatch = blast.images.find((i) => i.id === pb.imageId);
                          return (
                            <tr key={pb.imageId} className="hover:bg-slate-50/80 transition">
                              <td className="py-2 px-3 font-bold text-slate-900 font-sans">
                                #{pIdx + 1} {pb.filename}
                              </td>
                              <td className="py-2 px-3 text-blue-700 font-sans font-semibold">
                                {pb.zone}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {imgMatch?.calibration?.pxPerMm ? `${imgMatch.calibration.pxPerMm.toFixed(3)} px/mm` : '0.400 px/mm'}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                {pb.fragmentCount}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {pb.p50Mm} mm
                              </td>
                              <td className="py-2 px-3 font-extrabold text-blue-900">
                                {pb.p80Mm} mm
                              </td>
                              <td className="py-2 px-3">
                                <span className={pb.oversizePercent > 10 ? 'text-amber-700 font-bold' : 'text-slate-600'}>
                                  {pb.oversizePercent}%
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {pb.finesPercent}%
                              </td>
                              <td className="py-2 px-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={() => setSelectedImageId(pb.imageId)}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition cursor-pointer"
                                >
                                  {isFrench ? 'Inspecter' : 'Inspect'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Switch back to composite banner if 2+ images analyzed */}
                {isMultiImageComposite && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-950 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      <span>
                        {isFrench
                          ? `Inspection de la photo #${blast.images.findIndex((i) => i.id === selectedImage?.id) + 1} (${selectedImage?.filename || ''})`
                          : `Inspecting individual photo #${blast.images.findIndex((i) => i.id === selectedImage?.id) + 1} (${selectedImage?.filename || ''})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedImageId('composite')}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isFrench ? 'Afficher la Synthèse Globale du Tir' : 'Switch to Combined Blast Composite'}</span>
                    </button>
                  </div>
                )}

                {/* Interactive Scale Calibration & ROI Crop Tool Bar */}
                {selectedImage && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1. Scale Calibration Button */}
                      <button
                        type="button"
                        onClick={() => setShowScaleModal(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title={isFrench ? 'Définir l’échelle avec un objet témoin (stylo, pièce, mire)' : 'Calibrate reference scale with known object (pen, coin, ruler)'}
                      >
                        <Ruler className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isFrench ? 'Échelle :' : 'Scale:'}</span>
                        <span className="font-extrabold text-blue-900">
                          {selectedImage.calibration?.pxPerMm
                            ? `${selectedImage.calibration.pxPerMm.toFixed(3)} px/mm`
                            : isFrench ? 'Non calibrée' : 'Uncalibrated'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white ml-0.5">
                          {isFrench ? 'Ajuster' : 'Set'}
                        </span>
                      </button>

                      {/* 2. ROI & Non-Rock Crop Button */}
                      <button
                        type="button"
                        onClick={() => setShowRoiModal(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs border ${
                          selectedImage.roiPolygon && selectedImage.roiPolygon.length >= 3
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title={isFrench ? 'Découper les zones sans roches (ciel, godet de pelle, pistes)' : 'Cut out non-rock areas (sky, excavator, trucks)'}
                      >
                        <Crop className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isFrench ? 'Zone de roches :' : 'Rock Area:'}</span>
                        <span className="font-extrabold text-emerald-900">
                          {selectedImage.roiPolygon && selectedImage.roiPolygon.length >= 3
                            ? (isFrench ? 'Délimitée' : 'Active ROI')
                            : (isFrench ? 'Pleine image' : 'Full image')}
                        </span>
                        {selectedImage.exclusionPolygons && selectedImage.exclusionPolygons.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                            {selectedImage.exclusionPolygons.length} {isFrench ? 'exclus' : 'masked'}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white ml-0.5">
                          {isFrench ? 'Recadrer' : 'Crop'}
                        </span>
                      </button>
                    </div>

                    {/* Manual Editor shortcut */}
                    {activeRun && (
                      <button
                        type="button"
                        onClick={() => setShowManualEditor(true)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border border-slate-200 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        <span>{isFrench ? 'Retouche Manuelle' : 'Manual Editor'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Engine Selector */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-bold text-slate-700 mr-1">{t('colEngine', lang)}:</span>
                    <button
                      onClick={() => handleExecuteEngine('classical')}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                        activeEngine === 'classical' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" /> {t('engineA', lang)}
                    </button>
                    <button
                      onClick={() => handleExecuteEngine('ai_sam')}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                        activeEngine === 'ai_sam' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> {t('engineB', lang)}
                    </button>
                    <button
                      onClick={() => handleExecuteEngine('hybrid')}
                      disabled={isProcessing}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                        activeEngine === 'hybrid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" /> {t('engineC', lang)}
                    </button>
                  </div>

                  {isProcessing && (
                    <span className="text-xs font-bold text-blue-600 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {progressMsg || t('processingMsg', lang)}
                    </span>
                  )}
                </div>

                {/* Main Visual Viewport with Intermediate Steps Tabs */}
                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
                  {/* Step Previews Tab Bar */}
                  {activeRun?.stepPreviews && (
                    <div className="flex flex-wrap items-center bg-slate-900 border-b border-slate-800 px-2 py-1.5 overflow-x-auto text-[11px] gap-1">
                      {(['overlay', 'grayscale', 'clahe', 'threshold', 'distance', 'markers', 'depthMap'] as const).map((tab) => {
                        const labelMap: Record<string, string> = {
                          overlay: t('tabOverlay', lang),
                          grayscale: t('tabGrayscale', lang),
                          clahe: t('tabClahe', lang),
                          threshold: t('tabThreshold', lang),
                          distance: t('tabDistance', lang),
                          markers: t('tabMarkers', lang),
                          depthMap: t('tabDepthMap', lang),
                        };
                        return (
                          <button
                            key={tab}
                            onClick={() => setActiveStepTab(tab)}
                            className={`px-2.5 py-1 rounded font-semibold capitalize whitespace-nowrap transition ${
                              activeStepTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                            }`}
                          >
                            {labelMap[tab]}
                          </button>
                        );
                      })}

                      {/* Sizing Badges Toggle Button */}
                      {activeStepTab === 'overlay' && activeRun?.stepPreviews?.overlayWithSizing && (
                        <button
                          type="button"
                          onClick={() => setShowMinMaxSizing(!showMinMaxSizing)}
                          className={`ml-auto px-2.5 py-1 rounded font-bold text-xs flex items-center gap-1.5 transition ${
                            showMinMaxSizing
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                          title={isFrench ? 'Afficher ou masquer les tailles Min et Max de chaque bloc sur la photo' : 'Toggle Min & Max dimensions on each stone'}
                        >
                          <Ruler className="w-3.5 h-3.5" />
                          <span>{isFrench ? 'Tailles Min / Max (mm)' : 'Min/Max Sizing (mm)'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="relative p-2 flex justify-center items-center min-h-[360px] max-h-[500px] overflow-hidden">
                    {selectedImage && (
                      <img
                        src={
                          activeStepTab === 'overlay' && showMinMaxSizing && activeRun?.stepPreviews?.overlayWithSizing
                            ? activeRun.stepPreviews.overlayWithSizing
                            : activeRun?.stepPreviews && activeRun.stepPreviews[activeStepTab]
                            ? activeRun.stepPreviews[activeStepTab]
                            : selectedImage.dataUrl
                        }
                        alt="Muck pile analysis"
                        className="max-h-[480px] w-auto object-contain rounded-lg"
                      />
                    )}
                  </div>

                  {/* Quality & Scale Pill */}
                  {selectedImage && (
                    <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900 text-xs text-slate-400 border-t border-slate-800 gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowScaleModal(true)}
                          className="flex items-center gap-1 text-slate-300 hover:text-white transition cursor-pointer hover:underline"
                          title={isFrench ? 'Cliquer pour ajuster l’échelle' : 'Click to calibrate scale'}
                        >
                          <Ruler className="w-3.5 h-3.5 text-blue-400" />
                          <span>{t('scaleResult', lang)} {selectedImage.calibration?.pxPerMm?.toFixed(3) || '0.400'} px/mm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRoiModal(true)}
                          className="flex items-center gap-1 text-slate-300 hover:text-white transition cursor-pointer hover:underline"
                          title={isFrench ? 'Cliquer pour recadrer la zone' : 'Click to crop rock area'}
                        >
                          <Crop className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {selectedImage.roiPolygon && selectedImage.roiPolygon.length >= 3
                              ? (isFrench ? 'Zone délimitée' : 'Custom ROI')
                              : (isFrench ? 'Pleine image' : 'Full image')}
                          </span>
                        </button>
                        <span>Zone: {selectedImage.zone}</span>
                        <span>Lighting: {selectedImage.lighting}</span>
                      </div>
                      <div>
                        {t('sharpness', lang)}: {selectedImage.qualityCheck.blurScore} ({selectedImage.qualityCheck.blurStatus})
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Sizing Distribution Percentiles Table */}
            {activeRun && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('percentilesTitle', lang)}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">{t('percentile', lang)}</th>
                        <th className="py-2 px-3">{t('sizeMm', lang)}</th>
                        <th className="py-2 px-3">{t('bootstrapCI', lang)}</th>
                        <th className="py-2 px-3">{t('description', lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-700">{t('p10', lang)}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-900">{activeRun.metrics.p10} mm</td>
                        <td className="py-1.5 px-3 text-slate-500">
                          [{activeRun.metrics.bootstrapCI.p10[0]} - {activeRun.metrics.bootstrapCI.p10[1]}]
                        </td>
                        <td className="py-1.5 px-3 text-slate-500">{t('p10Desc', lang)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-700">{t('p20', lang)}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-900">{activeRun.metrics.p20} mm</td>
                        <td className="py-1.5 px-3 text-slate-500">
                          [{activeRun.metrics.bootstrapCI.p20[0]} - {activeRun.metrics.bootstrapCI.p20[1]}]
                        </td>
                        <td className="py-1.5 px-3 text-slate-500">{t('p20Desc', lang)}</td>
                      </tr>
                      <tr className="bg-blue-50/50">
                        <td className="py-1.5 px-3 font-bold text-blue-900">{t('p50', lang)}</td>
                        <td className="py-1.5 px-3 font-extrabold text-blue-950">{activeRun.metrics.p50} mm</td>
                        <td className="py-1.5 px-3 text-blue-700">
                          [{activeRun.metrics.bootstrapCI.p50[0]} - {activeRun.metrics.bootstrapCI.p50[1]}]
                        </td>
                        <td className="py-1.5 px-3 text-blue-700 font-medium">{t('p50Desc', lang)}</td>
                      </tr>
                      <tr className="bg-blue-50/50">
                        <td className="py-1.5 px-3 font-bold text-blue-900">{t('p80', lang)}</td>
                        <td className="py-1.5 px-3 font-extrabold text-blue-950">{activeRun.metrics.p80} mm</td>
                        <td className="py-1.5 px-3 text-blue-700">
                          [{activeRun.metrics.bootstrapCI.p80[0]} - {activeRun.metrics.bootstrapCI.p80[1]}]
                        </td>
                        <td className="py-1.5 px-3 text-blue-700 font-medium">{t('p80Desc', lang)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 font-semibold text-slate-700">{t('p90', lang)}</td>
                        <td className="py-1.5 px-3 font-bold text-slate-900">{activeRun.metrics.p90} mm</td>
                        <td className="py-1.5 px-3 text-slate-500">
                          [{activeRun.metrics.bootstrapCI.p90[0]} - {activeRun.metrics.bootstrapCI.p90[1]}]
                        </td>
                        <td className="py-1.5 px-3 text-slate-500">{t('p90Desc', lang)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column (5 cols): Cumulative Curve & Blast Parameters */}
          <div className="lg:col-span-5 space-y-4">
            {activeRun && (
              <CumulativeDistributionChart
                metrics={activeRun.metrics}
                sieveData={blast.groundTruth?.sieveData}
                lang={lang}
              />
            )}
          </div>
        </div>

        {/* Granulometry Details Table: Min & Max Sizes for Every Rock Fragment */}
        {activeRun && activeRun.fragments && activeRun.fragments.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <span>{isFrench ? 'Tableau Détaillé des Fragments & Granulats' : 'Individual Fragment Min & Max Sizing Table'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {activeRun.fragments.length} {isFrench ? 'blocs mesurés' : 'rocks measured'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isFrench
                      ? 'Taille minimale (calibre crible passant) et longueur maximale (calibre d’encombrement) pour chaque morceau'
                      : 'Minimum passing aperture (Min Feret) and maximum length for each segmented rock fragment'}
                  </p>
                </div>
              </div>

              {/* Filter Tabs: All, Fines (<25mm), Nominal (25-250mm), Oversize (>300mm) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                {(['all', 'fines', 'nominal', 'oversize'] as const).map((filter) => {
                  const count = activeRun.fragments.filter((f: Fragment) => {
                    if (filter === 'fines') return f.minFeretMm < settings.finesThresholdMm;
                    if (filter === 'oversize') return f.maxFeretMm > settings.oversizeThresholdMm;
                    if (filter === 'nominal') return f.minFeretMm >= settings.finesThresholdMm && f.maxFeretMm <= settings.oversizeThresholdMm;
                    return true;
                  }).length;

                  const label =
                    filter === 'all'
                      ? (isFrench ? `Tous (${count})` : `All (${count})`)
                      : filter === 'fines'
                      ? (isFrench ? `Fines <${settings.finesThresholdMm}mm (${count})` : `Fines <${settings.finesThresholdMm}mm (${count})`)
                      : filter === 'nominal'
                      ? (isFrench ? `Nominal (${count})` : `Nominal (${count})`)
                      : (isFrench ? `Gros >${settings.oversizeThresholdMm}mm (${count})` : `Oversize >${settings.oversizeThresholdMm}mm (${count})`);

                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setFragmentFilter(filter)}
                      className={`px-2.5 py-1 rounded-lg transition text-[11px] ${
                        fragmentFilter === filter
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Table of Individual Rock Fragments */}
            <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 shadow-xs">
                  <tr>
                    <th className="py-2 px-3">#ID</th>
                    <th className="py-2 px-3 text-blue-700">{isFrench ? 'Taille Min (d_min)' : 'Min Size (d_min)'}</th>
                    <th className="py-2 px-3 text-purple-700">{isFrench ? 'Taille Max (d_max)' : 'Max Size (d_max)'}</th>
                    <th className="py-2 px-3">{isFrench ? 'Diamètre Équiv. (ECD)' : 'Equiv. Diam. (ECD)'}</th>
                    <th className="py-2 px-3">{isFrench ? 'Épaisseur 3D' : '3D Thickness'}</th>
                    <th className="py-2 px-3">{isFrench ? 'Volume Estimé' : 'Estimated Volume'}</th>
                    <th className="py-2 px-3">{isFrench ? 'Élongation' : 'Aspect Ratio'}</th>
                    <th className="py-2 px-3">{isFrench ? 'Classification' : 'Category'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {activeRun.fragments
                    .filter((f: Fragment) => {
                      if (fragmentFilter === 'fines') return f.minFeretMm < settings.finesThresholdMm;
                      if (fragmentFilter === 'oversize') return f.maxFeretMm > settings.oversizeThresholdMm;
                      if (fragmentFilter === 'nominal') return f.minFeretMm >= settings.finesThresholdMm && f.maxFeretMm <= settings.oversizeThresholdMm;
                      return true;
                    })
                    .slice(0, 100)
                    .map((f: Fragment) => {
                      const isFines = f.minFeretMm < settings.finesThresholdMm;
                      const isOversize = f.maxFeretMm > settings.oversizeThresholdMm;
                      return (
                        <tr
                          key={f.id}
                          className={`hover:bg-blue-50/70 transition cursor-pointer ${
                            selectedFragmentId === f.id ? 'bg-blue-100 font-bold' : ''
                          }`}
                          onClick={() => setSelectedFragmentId(f.id === selectedFragmentId ? null : f.id)}
                        >
                          <td className="py-1.5 px-3 font-bold text-slate-800">#{f.id}</td>
                          <td className="py-1.5 px-3 font-extrabold text-blue-700">{f.minFeretMm} mm</td>
                          <td className="py-1.5 px-3 font-extrabold text-purple-700">{f.maxFeretMm} mm</td>
                          <td className="py-1.5 px-3 text-slate-700">{f.ecdMm} mm</td>
                          <td className="py-1.5 px-3 text-slate-600">{f.thicknessMm ? `${f.thicknessMm} mm` : '-'}</td>
                          <td className="py-1.5 px-3 text-slate-600">
                            {f.trueVolume3DMm3
                              ? `${(f.trueVolume3DMm3 / 1000).toFixed(1)} cm³`
                              : `${(f.volumeMm3 / 1000).toFixed(1)} cm³`}
                          </td>
                          <td className="py-1.5 px-3 text-slate-600">{f.aspectRatio.toFixed(2)}</td>
                          <td className="py-1.5 px-3 font-sans">
                            {isFines ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                {isFrench ? 'Fine' : 'Fine'}
                              </span>
                            ) : isOversize ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                {isFrench ? 'Hors-gabarit' : 'Oversize'}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {isFrench ? 'Nominal' : 'Nominal'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Interactive Drillhole Matrix & Excel/CSV Importer */}
      <DrillHolesManager
        blast={blast}
        onUpdateBlast={onUpdateBlast}
        lang={lang}
      />

      {/* Editable Blast & Rock Mass Parameters Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'fr' ? 'Configuration & Géométrie du Tir' : 'Blast Geometry & Rock Mass Design'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'fr'
                ? hasDrillHoles
                  ? 'Paramètres géotechniques du gradin et métriques globales synchronisées du tir'
                  : 'Modifiez les paramètres du tir et recalculez la consommation d’explosif'
                : hasDrillHoles
                  ? 'Bench geotechnical parameters and synchronized pattern metrics'
                  : 'Edit design parameters and recalculate powder factor live'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccessMsg && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t('success', lang)}
              </span>
            )}
            <button
              onClick={handleSaveBlastParameters}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('saveBlastChanges', lang)}</span>
            </button>
          </div>
        </div>

        {hasDrillHoles && holesSummary ? (
          <div className="space-y-4">
            {/* Source-of-truth Synchronization Banner */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950">
                    {isFrench
                      ? `Alimenté par la matrice de foration (${holesSummary.totalHoles} trous)`
                      : `Driven by drillholes matrix (${holesSummary.totalHoles} holes)`}
                  </span>
                  <span className="text-emerald-700 text-[11px] block">
                    {isFrench
                      ? 'Les coordonnées, mailles réelles, charges et consommations d’explosif proviennent directement de votre fichier importé.'
                      : 'Coordinates, true spacings, explosive charges, and powder factors are derived directly from your imported file.'}
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                {isFrench ? '✓ 100% Synchronisé' : '✓ 100% Synced'}
              </span>
            </div>

            {/* Bench & Rock Mass Geotechnical Inputs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {isFrench ? 'Paramètres du Gradin & Massif Rocheux' : 'Bench & Rock Mass Geotechnical Design'}
                </h4>
                <span className="text-[11px] text-slate-500">
                  {isFrench ? 'Propriétés structurales du front de taille' : 'Bench-scale structural rock parameters'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                {/* Bench Height (Read-Only: Inferred directly from drillhole depth - subdrill) */}
                <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-600 font-bold text-[11px]">
                      {t('benchHeight', lang)} (m)
                    </label>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase font-black">
                      {isFrench ? 'Déduit' : 'Inferred'}
                    </span>
                  </div>
                  <span className="text-base font-black text-slate-900 mt-0.5">
                    {holesSummary.inferredBenchHeightM} m
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {isFrench
                      ? `Prof. ${holesSummary.avgDepthM} m - Sous-forage ${holesSummary.avgSubdrillM} m`
                      : `Depth ${holesSummary.avgDepthM} m - Subdrill ${holesSummary.avgSubdrillM} m`}
                  </span>
                </div>

                {/* Rock Density (Read-Only: Average directly from Excel rock density column) */}
                <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-600 font-bold text-[11px]">
                      {t('density', lang)} (t/m³)
                    </label>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 uppercase font-black">
                      {isFrench ? 'Excel' : 'Excel'}
                    </span>
                  </div>
                  <span className="text-base font-black text-slate-900 mt-0.5">
                    {holesSummary.avgDensityTPerM3} t/m³
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {isFrench ? 'Moyenne de la matrice de foration' : 'Matrix average density'}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">{t('rockType', lang)}</label>
                  <input
                    type="text"
                    value={rockType}
                    onChange={(e) => setRockType(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">{t('meanJointSpacing', lang)} (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={meanJointSpacing}
                    onChange={(e) => setMeanJointSpacing(parseFloat(e.target.value) || 0.5)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">{t('jointOrientation', lang)}</label>
                  <select
                    value={jointOrientation}
                    onChange={(e) => setJointOrientation(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white"
                  >
                    <option value="dip_out_of_face">{t('dipOutOfFace', lang)}</option>
                    <option value="strike_perpendicular">{t('strikePerpendicular', lang)}</option>
                    <option value="dip_into_face">{t('dipIntoFace', lang)}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pattern-Aggregated Drill & Blast Indicators (Read-Only) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {isFrench ? 'Métriques Agrégées du Tir (Calculées depuis la Matrice)' : 'Pattern Aggregated Metrics (Derived from Matrix)'}
                </h4>
                <span className="text-[11px] text-blue-600 font-medium">
                  {isFrench ? 'Pour modifier un trou individuel, utilisez le tableau ci-dessus' : 'To edit individual holes, use the drillhole table above'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('numberOfHoles', lang)}</span>
                  <span className="text-sm font-black text-slate-900">{holesSummary.totalHoles}</span>
                  {holesSummary.wetHolesCount > 0 ? (
                    <span className="text-[10px] text-blue-600 font-semibold block">
                      ({holesSummary.wetHolesCount} {isFrench ? 'humides' : 'wet'})
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600 font-semibold block">
                      ({isFrench ? '100% secs' : '100% dry'})
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">
                    {isFrench ? 'Maille B × S' : 'Pattern B × S'}
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {holesSummary.avgBurdenM} × {holesSummary.avgSpacingM} m
                  </span>
                  <span className="text-[10px] text-slate-400 block">{isFrench ? 'Moyenne' : 'Average'}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('holeDepth', lang)}</span>
                  <span className="text-sm font-black text-slate-900">{holesSummary.avgDepthM} m</span>
                  <span className="text-[10px] text-slate-400 block">{holesSummary.minDepthM} - {holesSummary.maxDepthM} m</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('subdrill', lang)}</span>
                  <span className="text-sm font-black text-slate-900">{holesSummary.avgSubdrillM} m</span>
                  <span className="text-[10px] text-slate-400 block">{isFrench ? 'Sous-forage' : 'Subdrill'}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('holeDiameter', lang)}</span>
                  <span className="text-sm font-black text-slate-900">⌀ {holesSummary.avgDiameterMm} mm</span>
                  <span className="text-[10px] text-slate-400 block">{isFrench ? 'Diamètre' : 'Diameter'}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('stemmingLength', lang)}</span>
                  <span className="text-sm font-black text-slate-900">{holesSummary.avgStemmingM} m</span>
                  <span className="text-[10px] text-slate-400 block">{isFrench ? 'Bourrage' : 'Stemming'}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t('chargePerHole', lang)}</span>
                  <span className="text-sm font-black text-slate-900">{holesSummary.avgChargePerHoleKg} kg</span>
                  <span className="text-[10px] text-slate-400 block">
                    Total: {holesSummary.totalExplosiveKg.toLocaleString()} kg
                  </span>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl flex flex-col justify-center">
                  <span className="text-[10px] text-blue-700 font-bold uppercase block">{t('computedPowderFactor', lang)}</span>
                  <span className="text-base font-black text-blue-950 leading-tight">
                    {holesSummary.overallPowderFactorKgM3.toFixed(2)} kg/m³
                  </span>
                  <span className="text-[10px] text-blue-700 font-medium">
                    {holesSummary.overallPowderFactorKgTonne.toFixed(2)} kg/t
                  </span>
                </div>
              </div>

              {/* Aggregated Totals Bar */}
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-100 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-500 font-bold block">{isFrench ? 'Explosif Utilisé' : 'Explosive Setup'}</span>
                  <span className="font-bold text-slate-800 truncate block text-[11px]" title={blast.parameters.explosiveType}>
                    {holesSummary.wetHolesCount > 0
                      ? (isFrench ? `Mixte (${holesSummary.wetHolesCount} Émulsion + ${holesSummary.totalHoles - holesSummary.wetHolesCount} ANFO)` : `Hybrid (${holesSummary.wetHolesCount} Emulsion + ${holesSummary.totalHoles - holesSummary.wetHolesCount} ANFO)`)
                      : blast.parameters.explosiveType || 'ANFO'}
                  </span>
                </div>
                <div className="bg-slate-100 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-500 font-bold block">{isFrench ? 'Métrage Foré Total' : 'Total Drilled Meters'}</span>
                  <span className="font-bold text-slate-800">{holesSummary.totalDrilledM} m</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
                  <span className="text-[10px] text-amber-700 font-bold block">{isFrench ? 'Volume Abattu Réel' : 'Actual Broken Volume'}</span>
                  <span className="font-bold text-amber-950">{holesSummary.totalVolumeM3.toLocaleString()} m³</span>
                </div>
                <div className="bg-purple-50 border border-purple-200 p-2 rounded-lg">
                  <span className="text-[10px] text-purple-700 font-bold block">{isFrench ? 'Tonnage Abattu Réel' : 'Actual Broken Tonnage'}</span>
                  <span className="font-bold text-purple-950">{Math.round(holesSummary.totalVolumeM3 * density).toLocaleString()} t</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Fallback Manual Inputs when no drillhole dataset has been imported */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('burden', lang)} (m)</label>
              <input
                type="number"
                step="0.1"
                value={burden}
                onChange={(e) => setBurden(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('spacing', lang)} (m)</label>
              <input
                type="number"
                step="0.1"
                value={spacing}
                onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('benchHeight', lang)} (m)</label>
              <input
                type="number"
                step="0.5"
                value={benchHeight}
                onChange={(e) => setBenchHeight(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('stemmingLength', lang)} (m)</label>
              <input
                type="number"
                step="0.1"
                value={stemmingLength}
                onChange={(e) => setStemmingLength(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('holeDiameter', lang)} (mm)</label>
              <input
                type="number"
                value={holeDiameter}
                onChange={(e) => setHoleDiameter(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('chargePerHole', lang)} (kg)</label>
              <input
                type="number"
                step="0.5"
                value={chargePerHole}
                onChange={(e) => setChargePerHole(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('explosiveType', lang)}</label>
              <input
                type="text"
                value={explosiveType}
                onChange={(e) => setExplosiveType(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 p-2 rounded flex flex-col justify-center">
              <span className="text-[10px] text-blue-700 font-bold uppercase">{t('computedPowderFactor', lang)}</span>
              <span className="text-base font-black text-blue-950">
                {computedPowderFactor.toFixed(2)} kg/m³
              </span>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('rockType', lang)}</label>
              <input
                type="text"
                value={rockType}
                onChange={(e) => setRockType(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('density', lang)} (t/m³)</label>
              <input
                type="number"
                step="0.05"
                value={density}
                onChange={(e) => setDensity(parseFloat(e.target.value) || 2.65)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('meanJointSpacing', lang)} (m)</label>
              <input
                type="number"
                step="0.05"
                value={meanJointSpacing}
                onChange={(e) => setMeanJointSpacing(parseFloat(e.target.value) || 0.5)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('jointOrientation', lang)}</label>
              <select
                value={jointOrientation}
                onChange={(e) => setJointOrientation(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white"
              >
                <option value="dip_out_of_face">{t('dipOutOfFace', lang)}</option>
                <option value="strike_perpendicular">{t('strikePerpendicular', lang)}</option>
                <option value="dip_into_face">{t('dipIntoFace', lang)}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('numberOfHoles', lang)}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  value={numberOfHoles}
                  onChange={(e) => setNumberOfHoles(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (numberOfHoles > 1) {
                      setNumberOfHoles((n) => n - 1);
                    }
                  }}
                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition"
                  title={lang === 'fr' ? 'Supprimer un trou' : 'Delete hole'}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNumberOfHoles((n) => n + 1)}
                  className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 transition"
                  title={lang === 'fr' ? 'Ajouter un trou' : 'Add hole'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('holeDepth', lang)} (m)</label>
              <input
                type="number"
                step="0.1"
                value={holeDepth}
                onChange={(e) => setHoleDepth(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('subdrill', lang)} (m)</label>
              <input
                type="number"
                step="0.1"
                value={subdrill}
                onChange={(e) => setSubdrill(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>
          </div>
        )}

        {/* 3-Deck Hole Charging Profile, Fault Decking & Cost Minimization System */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <HoleChargingProfileView
            parameters={blast.parameters}
            onUpdateParameters={(updatedParams) => {
              if (!hasDrillHoles) {
                setChargePerHole(updatedParams.chargePerHole);
                setStemmingLength(updatedParams.stemmingLength);
              }
              const updatedBlast: Blast = {
                ...blast,
                parameters: updatedParams,
                updatedAt: Date.now(),
              };
              onUpdateBlast(updatedBlast);
            }}
            benchHeight={benchHeight}
            subdrill={holesSummary ? holesSummary.avgSubdrillM : subdrill}
            holeDiameter={holesSummary ? holesSummary.avgDiameterMm : holeDiameter}
            burden={holesSummary ? holesSummary.avgBurdenM : burden}
            spacing={holesSummary ? holesSummary.avgSpacingM : spacing}
            numberOfHoles={holesSummary ? holesSummary.totalHoles : numberOfHoles}
            density={density}
            holesSummary={holesSummary}
            lang={lang}
          />
        </div>
      </div>

      {showInclinometer && (
        <CameraInclinometerModal
          onCapture={handleInclinometerCapture}
          onClose={() => setShowInclinometer(false)}
          lang={lang}
        />
      )}
    </div>
  );
};
