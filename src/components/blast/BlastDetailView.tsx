import React, { useState } from 'react';
import type {
  Blast,
  ImageRecord,
  SegmentationRun,
  EngineType,
  AppSettings,
  Fragment,
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
  Maximize2,
  Box,
  Eye,
} from 'lucide-react';
import { CameraInclinometerModal } from '../camera/CameraInclinometerModal';
import { HoleChargingProfileView } from './HoleChargingProfileView';
import { SendToReportButton } from '../report/SendToReportButton';

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

  const handleInclinometerCapture = async (dataUrl: string) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = async () => {
      const qc = await analyzeImageQuality(img);
      const imgId = `img-${Date.now()}`;
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
          points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
          realWorldDistanceMm: 500,
          pxPerMm: 0.4,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updatedBlast = {
        ...blast,
        images: [newImage, ...blast.images],
      };
      onUpdateBlast(updatedBlast);
      setSelectedImageId(imgId);
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
  const [excludedHoles, setExcludedHoles] = useState<number[]>([]);
  const [chargePerHole, setChargePerHole] = useState(blast.parameters.chargePerHole);
  const [explosiveType, setExplosiveType] = useState(blast.parameters.explosiveType);
  const [rockType, setRockType] = useState(blast.rockMass.rockType);
  const [density, setDensity] = useState(blast.rockMass.density);
  const [meanJointSpacing, setMeanJointSpacing] = useState(blast.rockMass.meanJointSpacing);
  const [jointOrientation, setJointOrientation] = useState(blast.rockMass.jointOrientation);

  const selectedImage = blast.images.find((i) => i.id === selectedImageId) || blast.images[0];
  const activeRun = selectedImage
    ? (selectedImage as any).segmentationRuns?.[0] || null
    : null;

  // Handle saving blast parameter edits
  const handleSaveBlastParameters = () => {
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
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
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
            points: [{ x: 100, y: 100 }, { x: 300, y: 100 }],
            realWorldDistanceMm: 500,
            pxPerMm: 0.4,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const updatedBlast = {
          ...blast,
          images: [newImage, ...blast.images],
        };
        onUpdateBlast(updatedBlast);
        setSelectedImageId(imgId);
      };
    };
    reader.readAsDataURL(file);
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
  const handleExecuteEngine = async (engine: EngineType) => {
    if (!selectedImage) return;
    setIsProcessing(true);
    setActiveEngine(engine);

    const img = new Image();
    img.src = selectedImage.dataUrl;
    img.onload = async () => {
      const calib = selectedImage.calibration || {
        method: 'two_point',
        points: [],
        realWorldDistanceMm: 500,
        pxPerMm: 0.4,
      };

      let frags: Fragment[] = [];
      let stepPreviews = undefined;

      if (engine === 'classical') {
        setProgressMsg(lang === 'fr' ? 'Calcul CLAHE et Ligne de Partage...' : 'Running Classical CLAHE & Watershed...');
        const res = await runClassicalSegmentation(img, calib, DEFAULT_CLASSICAL_PARAMS);
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
          (_, msg) => setProgressMsg(msg)
        );
      } else if (engine === 'hybrid') {
        setProgressMsg(lang === 'fr' ? 'Calcul Hybride (Semences IA + Fines Classiques)...' : 'Running Hybrid (AI Seeds + Classical Fines)...');
        const classicalRes = await runClassicalSegmentation(img, calib);
        const aiFrags = await runAiSegmentation(img, calib, {
          modelType: 'slimsam_int8',
          pointsPerSide: 6,
          predIouThresh: 0.85,
          stabilityScoreThresh: 0.88,
          boxNmsThresh: 0.7,
          minMaskRegionAreaMm2: 80,
          tileOverlapPercent: 15,
        });
        frags = await runHybridSegmentation(aiFrags, classicalRes.fragments);
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
        imageId: selectedImage.id,
        engine,
        timestamp: Date.now(),
        parameters: DEFAULT_CLASSICAL_PARAMS,
        fragments: frags,
        metrics,
        stepPreviews,
      };

      onSaveRun(selectedImage, run);
      setIsProcessing(false);
      setProgressMsg('');
    };
  };

  const holeVol = burden * spacing * benchHeight;
  const computedPowderFactor = chargePerHole / Math.max(0.1, holeVol);

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
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
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
              {blast.images.map((img, idx) => {
                const isSelected = img.id === (selectedImage?.id || selectedImageId);
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
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-xs text-slate-400 border-t border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Ruler className="w-3.5 h-3.5 text-blue-400" />
                      {t('scaleResult', lang)} {selectedImage.calibration?.pxPerMm?.toFixed(3) || '0.400'} px/mm
                    </span>
                    <span>Zone: {selectedImage.zone}</span>
                    <span>Lighting: {selectedImage.lighting}</span>
                  </div>
                  <div>
                    {t('sharpness', lang)}: {selectedImage.qualityCheck.blurScore} ({selectedImage.qualityCheck.blurStatus})
                  </div>
                </div>
              )}
            </div>

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

      {/* Editable Blast & Rock Mass Parameters Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'fr' ? 'Configuration & Géométrie du Tir' : 'Blast Geometry & Rock Mass Design'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'fr'
                ? 'Modifiez les paramètres du tir et recalculez la consommation d’explosif'
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('burden', lang)}</label>
            <input
              type="number"
              step="0.1"
              value={burden}
              onChange={(e) => setBurden(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('spacing', lang)}</label>
            <input
              type="number"
              step="0.1"
              value={spacing}
              onChange={(e) => setSpacing(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('benchHeight', lang)}</label>
            <input
              type="number"
              step="0.5"
              value={benchHeight}
              onChange={(e) => setBenchHeight(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('stemmingLength', lang)}</label>
            <input
              type="number"
              step="0.1"
              value={stemmingLength}
              onChange={(e) => setStemmingLength(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('holeDiameter', lang)}</label>
            <input
              type="number"
              value={holeDiameter}
              onChange={(e) => setHoleDiameter(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('chargePerHole', lang)}</label>
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
            <label className="block text-slate-600 font-semibold mb-1">{t('density', lang)}</label>
            <input
              type="number"
              step="0.05"
              value={density}
              onChange={(e) => setDensity(parseFloat(e.target.value) || 2.65)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('meanJointSpacing', lang)}</label>
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
                    setExcludedHoles((prev) => prev.filter((idx) => idx < numberOfHoles - 1));
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
            <label className="block text-slate-600 font-semibold mb-1">{t('holeDepth', lang)}</label>
            <input
              type="number"
              step="0.1"
              value={holeDepth}
              onChange={(e) => setHoleDepth(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">{t('subdrill', lang)}</label>
            <input
              type="number"
              step="0.1"
              value={subdrill}
              onChange={(e) => setSubdrill(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-800"
            />
          </div>
        </div>

        {/* 3-Deck Hole Charging Profile, Fault Decking & Cost Minimization System */}
        <div className="mt-4 pt-4 border-t border-slate-200">
          <HoleChargingProfileView
            parameters={blast.parameters}
            onUpdateParameters={(updatedParams) => {
              setChargePerHole(updatedParams.chargePerHole);
              setStemmingLength(updatedParams.stemmingLength);
              const updatedBlast: Blast = {
                ...blast,
                parameters: updatedParams,
                updatedAt: Date.now(),
              };
              onUpdateBlast(updatedBlast);
            }}
            benchHeight={benchHeight}
            subdrill={subdrill}
            holeDiameter={holeDiameter}
            burden={burden}
            spacing={spacing}
            numberOfHoles={numberOfHoles - excludedHoles.length}
            density={density}
            lang={lang}
          />
        </div>

        {/* Interactive Drill & Blast Pattern Hole Management */}
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('blastPatternHoles', lang)} ({numberOfHoles - excludedHoles.length} / {numberOfHoles} {t('activeHoles', lang)})
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {t('manageHolesDesc', lang)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (numberOfHoles > 1) {
                    setNumberOfHoles((prev) => prev - 1);
                    setExcludedHoles((prev) => prev.filter((idx) => idx < numberOfHoles - 1));
                  }
                }}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-200 transition"
                title={lang === 'fr' ? 'Supprimer le dernier trou du schéma' : 'Delete last hole from pattern'}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>{t('deleteHole', lang)}</span>
              </button>

              <button
                type="button"
                onClick={() => setNumberOfHoles((prev) => prev + 1)}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-blue-200 transition"
                title={lang === 'fr' ? 'Ajouter un trou au schéma' : 'Add hole to pattern'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('addHole', lang)}</span>
              </button>

              {excludedHoles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedHoles([])}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[11px] underline"
                >
                  {lang === 'fr' ? 'Réactiver tous' : 'Reset active'}
                </button>
              )}
            </div>
          </div>

          {/* Drill Pattern 2D Hole Layout Grid */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {Array.from({ length: numberOfHoles }, (_, i) => {
                const isExcluded = excludedHoles.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (isExcluded) {
                        setExcludedHoles((prev) => prev.filter((idx) => idx !== i));
                      } else {
                        setExcludedHoles((prev) => [...prev, i]);
                      }
                    }}
                    className={`w-9 h-9 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition border ${
                      isExcluded
                        ? 'bg-slate-800/80 text-slate-500 border-slate-700 line-through opacity-60 hover:opacity-100'
                        : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 shadow-sm shadow-blue-500/20'
                    }`}
                    title={
                      isExcluded
                        ? (lang === 'fr' ? `Trou #${i + 1} désactivé / exclu. Cliquez pour réactiver.` : `Hole #${i + 1} excluded/deleted. Click to reactivate.`)
                        : (lang === 'fr' ? `Trou #${i + 1} actif (${chargePerHole} kg). Cliquez pour exclure/supprimer.` : `Hole #${i + 1} active (${chargePerHole} kg). Click to exclude/delete.`)
                    }
                  >
                    <span>{i + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Pattern Metrics Footer */}
            <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-white text-[11px]">
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">{lang === 'fr' ? 'Trous Actifs' : 'Active Holes'}</span>
                <span className="font-extrabold text-blue-400 text-xs">
                  {numberOfHoles - excludedHoles.length} / {numberOfHoles}
                </span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">{lang === 'fr' ? 'Explosif Total' : 'Total Explosives'}</span>
                <span className="font-extrabold text-emerald-400 text-xs">
                  {((numberOfHoles - excludedHoles.length) * chargePerHole).toFixed(1)} kg
                </span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">{lang === 'fr' ? 'Volume Abattu' : 'Broken Volume'}</span>
                <span className="font-extrabold text-amber-400 text-xs">
                  {((numberOfHoles - excludedHoles.length) * burden * spacing * benchHeight).toFixed(1)} m³
                </span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-slate-400 block text-[10px]">{lang === 'fr' ? 'Tonnage Abattu' : 'Broken Tonnage'}</span>
                <span className="font-extrabold text-purple-400 text-xs">
                  {((numberOfHoles - excludedHoles.length) * burden * spacing * benchHeight * density).toFixed(1)} t
                </span>
              </div>
            </div>
          </div>
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
