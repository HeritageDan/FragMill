import React, { useState, useRef } from 'react';
import type {
  Blast,
  ImageRecord,
  SegmentationRun,
  Point2D,
} from '../../types';
import { analyzeImageQuality, calibrateTwoPoint, runClassicalSegmentation } from '../../services/imageProcessing';
import { computeFragmentationMetrics } from '../../services/statistics';
import { CumulativeDistributionChart } from '../charts/FragmentationCharts';
import { generateBlastPdfReport, exportFragmentsCsv } from '../../services/export';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Ruler,
  Cpu,
  FileDown,
  Sparkles,
  Info,
} from 'lucide-react';

interface FieldWizardProps {
  currentBlast: Blast;
  onUpdateBlast: (updatedBlast: Blast) => void;
  onSaveRun: (image: ImageRecord, run: SegmentationRun) => void;
  lang?: 'en' | 'fr';
}

export const FieldWizard: React.FC<FieldWizardProps> = ({
  currentBlast,
  onUpdateBlast,
  onSaveRun,
  lang = 'en',
}) => {
  const [step, setStep] = useState(1);

  // Step 1: Short Blast Info
  const [blastId, setBlastId] = useState(currentBlast.blastId);
  const [benchHeight, setBenchHeight] = useState(currentBlast.parameters.benchHeight);
  const [burden, setBurden] = useState(currentBlast.parameters.burden);
  const [spacing, setSpacing] = useState(currentBlast.parameters.spacing);
  const [chargePerHole, setChargePerHole] = useState(currentBlast.parameters.chargePerHole);
  const [rockType, setRockType] = useState(currentBlast.rockMass.rockType);

  // Step 2: Photo Capture / Upload
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(
    currentBlast.images[0]?.dataUrl || null
  );
  const [qualityCheck, setQualityCheck] = useState(currentBlast.images[0]?.qualityCheck || null);
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);

  // Step 3: Scale Calibration (Two taps / clicks)
  const [scalePoints, setScalePoints] = useState<Point2D[]>([]);
  const [refBarLengthMm, setRefBarLengthMm] = useState(500); // 500 mm default
  const [calibratedPxPerMm, setCalibratedPxPerMm] = useState<number | null>(
    currentBlast.images[0]?.calibration?.pxPerMm || null
  );

  // Step 4 & 5: Analysis and Results
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [activeRun, setActiveRun] = useState<SegmentationRun | null>(null);

  const scaleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle Image Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoDataUrl(dataUrl);

      setIsCheckingQuality(true);
      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        const qc = await analyzeImageQuality(img);
        setQualityCheck(qc);
        setIsCheckingQuality(false);
      };
    };
    reader.readAsDataURL(file);
  };

  // Step 3: Scale selection click
  const handleScaleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = scaleCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (scalePoints.length === 0) {
      setScalePoints([{ x, y }]);
    } else if (scalePoints.length === 1) {
      const p1 = scalePoints[0];
      const p2 = { x, y };
      setScalePoints([p1, p2]);
      const calib = calibrateTwoPoint(p1, p2, refBarLengthMm);
      setCalibratedPxPerMm(calib.pxPerMm);
    } else {
      setScalePoints([{ x, y }]);
      setCalibratedPxPerMm(null);
    }
  };

  // Run Step 4 Analysis
  const handleRunAnalysis = async () => {
    if (!photoDataUrl) return;
    setIsAnalyzing(true);
    setAnalysisProgress(15);

    const img = new Image();
    img.src = photoDataUrl;
    img.onload = async () => {
      setAnalysisProgress(35);
      const pxPerMm = calibratedPxPerMm || 0.4;
      const calib = calibrateTwoPoint(
        scalePoints[0] || { x: 100, y: 100 },
        scalePoints[1] || { x: 300, y: 100 },
        refBarLengthMm
      );
      calib.pxPerMm = pxPerMm;

      setAnalysisProgress(60);
      const result = await runClassicalSegmentation(img, calib);

      setAnalysisProgress(85);
      const metrics = computeFragmentationMetrics(result.fragments, 'min_feret');

      const run: SegmentationRun = {
        id: `run-${Date.now()}`,
        imageId: currentBlast.images[0]?.id || `img-${Date.now()}`,
        engine: 'classical',
        timestamp: Date.now(),
        parameters: {
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
          minSolidity: 0.75,
          maxAspectRatio: 3.5,
          filterBorders: true,
        },
        fragments: result.fragments,
        metrics,
        stepPreviews: result.stepPreviews,
      };

      const updatedImage: ImageRecord = {
        id: run.imageId,
        blastId: currentBlast.id,
        dataUrl: photoDataUrl,
        filename: `blast_${blastId}.jpg`,
        zone: 'middle',
        lighting: 'sun',
        time: new Date().toLocaleTimeString(),
        hasScaleMarker: true,
        qualityCheck: qualityCheck || {
          blurScore: 400,
          blurStatus: 'pass',
          exposureStatus: 'pass',
          contrastStatus: 'pass',
          resolutionStatus: 'pass',
          scaleMarkerStatus: 'pass',
          advice: ['Good capture'],
        },
        calibration: calib,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setActiveRun(run);
      onSaveRun(updatedImage, run);
      setIsAnalyzing(false);
      setStep(5); // Advance to results
    };
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* 5-Step Progress Stepper */}
      <div className="bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
            {lang === 'fr' ? 'Assistant Terrain Guidé' : 'Field Mode Wizard'}
          </span>
          <span className="text-xs text-slate-300 font-medium">Step {step} of 5</span>
        </div>

        {/* Stepper dots and bar */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { num: 1, label: lang === 'fr' ? 'Tir' : 'Blast' },
            { num: 2, label: lang === 'fr' ? 'Photos' : 'Photos' },
            { num: 3, label: lang === 'fr' ? 'Échelle' : 'Scale' },
            { num: 4, label: lang === 'fr' ? 'Analyser' : 'Analyse' },
            { num: 5, label: lang === 'fr' ? 'Résultats' : 'Results' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => step >= s.num && setStep(s.num)}
              className={`flex flex-col items-center cursor-pointer transition ${
                step === s.num ? 'opacity-100' : step > s.num ? 'opacity-80' : 'opacity-40'
              }`}
            >
              <div
                className={`w-full h-1.5 rounded-full mb-1.5 transition ${
                  step >= s.num ? 'bg-blue-500' : 'bg-slate-700'
                }`}
              />
              <span className="text-[11px] font-semibold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* STEP 1: Blast Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {lang === 'fr' ? 'Étape 1 : Paramètres Clés du Tir' : 'Step 1: Key Blast Information'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'fr'
                  ? 'Entrez les paramètres essentiels du tir pour calculer la consommation d’explosif.'
                  : 'Enter the essential blast geometry to calculate energy distribution.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Blast ID</label>
                <input
                  type="text"
                  value={blastId}
                  onChange={(e) => setBlastId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'fr' ? 'Type de Roche' : 'Rock Type'}
                </label>
                <input
                  type="text"
                  value={rockType}
                  onChange={(e) => setRockType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'fr' ? 'Banquette B (m)' : 'Burden B (m)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={burden}
                  onChange={(e) => setBurden(parseFloat(e.target.value) || 2.0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'fr' ? 'Espacement S (m)' : 'Spacing S (m)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={spacing}
                  onChange={(e) => setSpacing(parseFloat(e.target.value) || 2.5)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'fr' ? 'Hauteur de Gradin (m)' : 'Bench Height (m)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={benchHeight}
                  onChange={(e) => setBenchHeight(parseFloat(e.target.value) || 5.0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'fr' ? 'Charge par Trou (kg)' : 'Charge per Hole (kg)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={chargePerHole}
                  onChange={(e) => setChargePerHole(parseFloat(e.target.value) || 20.0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
            </div>

            {/* Powder factor live banner */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-900 text-xs">
              <span className="font-semibold">
                {lang === 'fr' ? 'Consommation Spécifique Calculée :' : 'Computed Powder Factor:'}
              </span>
              <span className="font-bold text-sm">
                {(chargePerHole / Math.max(0.1, burden * spacing * benchHeight)).toFixed(2)} kg/m³
              </span>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  onUpdateBlast({
                    ...currentBlast,
                    blastId,
                    parameters: {
                      ...currentBlast.parameters,
                      benchHeight,
                      burden,
                      spacing,
                      chargePerHole,
                    },
                    rockMass: {
                      ...currentBlast.rockMass,
                      rockType,
                    },
                  });
                  setStep(2);
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                {lang === 'fr' ? 'Suivant : Photos' : 'Next: Photos'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Photo Capture & Quality Checks */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {lang === 'fr' ? 'Étape 2 : Photographie du Tas de Roches' : 'Step 2: Muck Pile Photography'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'fr'
                  ? 'Prenez ou téléversez une photo claire du tas avec une mire d’échelle visible.'
                  : 'Capture or upload a clear muck pile photo with the scale reference visible.'}
              </p>
            </div>

            {/* Field Capture Guide */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Capture Protocol:</span> Stand perpendicular (90°) to the muck face, avoid shooting into direct sunlight, and ensure your 500 mm scale bar is placed flat on the rock pile face.
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
              {photoDataUrl ? (
                <div className="flex flex-col items-center space-y-3">
                  <img
                    src={photoDataUrl}
                    alt="Muck pile"
                    className="max-h-72 rounded-lg shadow-md border border-slate-300 object-contain"
                  />
                  <label className="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold">
                    {lang === 'fr' ? 'Remplacer la Photo' : 'Replace Photo'}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer">
                  <Camera className="w-12 h-12 text-blue-500 mb-2" />
                  <span className="text-sm font-bold text-slate-800">
                    {lang === 'fr' ? 'Prendre une Photo ou Téléverser' : 'Take Photo or Choose File'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">JPEG or PNG from camera / library</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Quality Check Results */}
            {qualityCheck && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {lang === 'fr' ? 'Contrôle Qualité Automatique' : 'Automatic Quality Assessment'}
                  </h4>
                  {qualityCheck.blurStatus === 'pass' && qualityCheck.exposureStatus === 'pass' ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Analysis
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Quality Warning
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Sharpness</span>
                    <span className={`font-bold uppercase ${qualityCheck.blurStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {qualityCheck.blurStatus} ({qualityCheck.blurScore})
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Exposure</span>
                    <span className={`font-bold uppercase ${qualityCheck.exposureStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {qualityCheck.exposureStatus}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Contrast</span>
                    <span className={`font-bold uppercase ${qualityCheck.contrastStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {qualityCheck.contrastStatus}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Resolution</span>
                    <span className={`font-bold uppercase ${qualityCheck.resolutionStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {qualityCheck.resolutionStatus}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                  {qualityCheck.advice.join(' ')}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!photoDataUrl}
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                {lang === 'fr' ? 'Suivant : Étalonnage' : 'Next: Scale Calibration'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Scale Calibration (Two taps on scale bar) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {lang === 'fr' ? 'Étape 3 : Étalonnage de l’Échelle' : 'Step 3: Scale Calibration'}
              </h3>
              <p className="text-sm text-slate-500">
                {lang === 'fr'
                  ? 'Touchez les deux extrémités de la mire de référence (ex: barre de 500 mm).'
                  : 'Tap the two ends of your scale reference object (e.g. 500 mm scale bar).'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-blue-600" />
                {lang === 'fr' ? 'Longueur de la Mire (mm) :' : 'Reference Bar Length (mm):'}
                <input
                  type="number"
                  value={refBarLengthMm}
                  onChange={(e) => setRefBarLengthMm(parseInt(e.target.value) || 500)}
                  className="w-24 px-2 py-1 border border-slate-300 rounded font-semibold text-slate-900"
                />
              </label>

              {calibratedPxPerMm && (
                <div className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Scale: {calibratedPxPerMm.toFixed(3)} px/mm (1 mm = {(1 / calibratedPxPerMm).toFixed(2)} px)
                </div>
              )}
            </div>

            {/* Clickable Image Canvas for Scale */}
            <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-900 flex justify-center items-center">
              {photoDataUrl && (
                <img
                  src={photoDataUrl}
                  alt="Scale selection"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * e.currentTarget.naturalWidth);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * e.currentTarget.naturalHeight);

                    if (scalePoints.length === 0) {
                      setScalePoints([{ x, y }]);
                    } else if (scalePoints.length === 1) {
                      const p1 = scalePoints[0];
                      const p2 = { x, y };
                      setScalePoints([p1, p2]);
                      const calib = calibrateTwoPoint(p1, p2, refBarLengthMm);
                      setCalibratedPxPerMm(calib.pxPerMm);
                    } else {
                      setScalePoints([{ x, y }]);
                      setCalibratedPxPerMm(null);
                    }
                  }}
                  className="max-h-96 w-auto object-contain cursor-crosshair"
                />
              )}
            </div>

            <div className="text-xs text-slate-500">
              {scalePoints.length === 0 && 'Click end 1 of your scale bar on the photo.'}
              {scalePoints.length === 1 && 'Point 1 set. Now click end 2 of your scale bar.'}
              {scalePoints.length === 2 && 'Scale bar calibration locked! You can proceed to analysis.'}
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                disabled={!calibratedPxPerMm}
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                {lang === 'fr' ? 'Suivant : Analyser' : 'Next: Analyse'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Analyse */}
        {step === 4 && (
          <div className="space-y-6 text-center py-8">
            <Cpu className="w-16 h-16 text-blue-600 mx-auto animate-bounce" />
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {lang === 'fr' ? 'Étape 4 : Détection Automatique des Blocs' : 'Step 4: Execute Rock Fragmentation Analysis'}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                {lang === 'fr'
                  ? 'Segmentation classique haute vitesse OpenCV/WASM (CLAHE, filtre adaptatif, transformée en distance, ligne de partage des eaux).'
                  : 'Engine A Classical pipeline runs locally in WebAssembly (CLAHE, adaptive filtering, distance transform, watershed).'}
              </p>
            </div>

            {isAnalyzing ? (
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600">
                  Processing fragments... {analysisProgress}%
                </span>
              </div>
            ) : (
              <button
                onClick={handleRunAnalysis}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 mx-auto transition"
              >
                <Sparkles className="w-5 h-5" />
                {lang === 'fr' ? 'Démarrer l’Analyse Immédiate' : 'Run Fragmentation Engine'}
              </button>
            )}

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Results & Percentiles */}
        {step === 5 && activeRun && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {lang === 'fr' ? 'Étape 5 : Résultats de Fragmentation' : 'Step 5: Fragmentation Sizing & Results'}
                </h3>
                <p className="text-xs text-slate-500">
                  Identified {activeRun.fragments.length} rock fragments | Minimum Feret Sieve Equivalent
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const blob = await generateBlastPdfReport(
                      { id: '1', name: 'FragMill ASM', description: '', createdAt: 0, updatedAt: 0 },
                      { id: '1', projectId: '1', name: 'Pit Bench', locationText: '', createdAt: 0, updatedAt: 0 },
                      currentBlast,
                      currentBlast.images[0] || { id: 'img1', blastId: currentBlast.id, dataUrl: photoDataUrl || '', filename: 'blast.jpg', zone: 'middle', lighting: 'sun', time: '', hasScaleMarker: true, qualityCheck: qualityCheck!, createdAt: 0, updatedAt: 0 },
                      activeRun
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Report_${blastId}.pdf`;
                    a.click();
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF Report
                </button>

                <button
                  onClick={() => {
                    const csv = exportFragmentsCsv(activeRun.fragments, blastId);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Fragments_${blastId}.csv`;
                    a.click();
                  }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                >
                  <FileDown className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {/* Key Sizing Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] text-blue-700 font-semibold uppercase block">P50 (Median)</span>
                <span className="text-xl font-black text-blue-950">{activeRun.metrics.p50} mm</span>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  95% CI: [{activeRun.metrics.bootstrapCI.p50[0]}-{activeRun.metrics.bootstrapCI.p50[1]}]
                </span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] text-blue-700 font-semibold uppercase block">P80 (Crusher Feed)</span>
                <span className="text-xl font-black text-blue-950">{activeRun.metrics.p80} mm</span>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  95% CI: [{activeRun.metrics.bootstrapCI.p80[0]}-{activeRun.metrics.bootstrapCI.p80[1]}]
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[10px] text-amber-700 font-semibold uppercase block">Oversize (&gt;300mm)</span>
                <span className="text-xl font-black text-amber-950">{activeRun.metrics.oversizePercent}%</span>
                <span className="text-[10px] text-amber-600 block mt-0.5">Requires secondary breaking</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-600 font-semibold uppercase block">Fines (&lt;25mm)</span>
                <span className="text-xl font-black text-slate-900">{activeRun.metrics.finesPercent}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Swebrec extrapolated</span>
              </div>
            </div>

            {/* Interactive Cumulative Passing Chart */}
            <CumulativeDistributionChart metrics={activeRun.metrics} />

            {/* Segmentation Overlay Preview */}
            {activeRun.stepPreviews?.overlay && (
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">
                  Segmentation Overlay View
                </h4>
                <img
                  src={activeRun.stepPreviews.overlay}
                  alt="Segmentation overlay"
                  className="w-full max-h-80 object-contain rounded-lg border border-slate-800"
                />
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-200">
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Re-Analyse
              </button>
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                <CheckCircle2 className="w-4 h-4" /> Done / Next Blast
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
