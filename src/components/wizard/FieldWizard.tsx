import React, { useState } from 'react';
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
import { createSyntheticMuckpileDataUrl } from '../../db/seedData';
import { t } from '../../i18n';
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
  Shield,
} from 'lucide-react';
import { SendToReportButton } from '../report/SendToReportButton';
import { CameraInclinometerModal } from '../camera/CameraInclinometerModal';

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
  const [showInclinometer, setShowInclinometer] = useState(false);

  const handleInclinometerCapture = (dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    const img = new Image();
    img.src = dataUrl;
    img.onload = async () => {
      const qc = await analyzeImageQuality(img);
      setQualityCheck(qc);
    };
  };

  // Step 3: Scale Calibration (Two taps / clicks)
  const [scalePoints, setScalePoints] = useState<Point2D[]>(
    currentBlast.images[0]?.calibration?.points || []
  );
  const [refBarLengthMm, setRefBarLengthMm] = useState(
    currentBlast.images[0]?.calibration?.realWorldDistanceMm || 500
  );
  const [calibratedPxPerMm, setCalibratedPxPerMm] = useState<number | null>(
    currentBlast.images[0]?.calibration?.pxPerMm || null
  );
  const [imageNaturalDim, setImageNaturalDim] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Step 4 & 5: Analysis and Results
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [activeRun, setActiveRun] = useState<SegmentationRun | null>(
    (currentBlast.images[0] as any)?.segmentationRuns?.[0] || null
  );

  // Handle Image Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoDataUrl(dataUrl);

      const img = new Image();
      img.src = dataUrl;
      img.onload = async () => {
        const qc = await analyzeImageQuality(img);
        setQualityCheck(qc);
      };
    };
    reader.readAsDataURL(file);
  };

  // Generate synthetic sample photo for rapid testing
  const handleGenerateSample = () => {
    const syn = createSyntheticMuckpileDataUrl(800, 600, 1.0);
    setPhotoDataUrl(syn.dataUrl);
    setCalibratedPxPerMm(syn.pxPerMm);
    setScalePoints([
      { x: 540, y: 550 },
      { x: 740, y: 550 },
    ]);
    setQualityCheck({
      blurScore: 480,
      blurStatus: 'pass',
      exposureStatus: 'pass',
      contrastStatus: 'pass',
      resolutionStatus: 'pass',
      scaleMarkerStatus: 'pass',
      advice: ['Optimal synthetic sample generated for testing.'],
    });
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

  const computedPowderFactor =
    chargePerHole / Math.max(0.1, burden * spacing * benchHeight);

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* 5-Step Progress Stepper */}
      <div className="bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
            {t('wizard', lang)}
          </span>
          <span className="text-xs text-slate-300 font-medium">
            {lang === 'fr' ? `Étape ${step} sur 5` : `Step ${step} of 5`}
          </span>
        </div>

        {/* Stepper dots and bar */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { num: 1, label: t('step1Blast', lang).split('. ')[1] },
            { num: 2, label: t('step2Photos', lang).split('. ')[1] },
            { num: 3, label: t('step3Scale', lang).split('. ')[1] },
            { num: 4, label: t('step4Analyse', lang).split('. ')[1] },
            { num: 5, label: t('step5Result', lang).split('. ')[1] },
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
              <span className="text-[11px] font-semibold truncate max-w-full">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* STEP 1: Blast Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('step1Blast', lang)}</h3>
              <p className="text-sm text-slate-500">{t('step1Subtitle', lang)}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('blastId', lang)}</label>
                <input
                  type="text"
                  value={blastId}
                  onChange={(e) => setBlastId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('rockType', lang)}</label>
                <input
                  type="text"
                  value={rockType}
                  onChange={(e) => setRockType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('burden', lang)}</label>
                <input
                  type="number"
                  step="0.1"
                  value={burden}
                  onChange={(e) => setBurden(parseFloat(e.target.value) || 2.0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('spacing', lang)}</label>
                <input
                  type="number"
                  step="0.1"
                  value={spacing}
                  onChange={(e) => setSpacing(parseFloat(e.target.value) || 2.5)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('benchHeight', lang)}</label>
                <input
                  type="number"
                  step="0.5"
                  value={benchHeight}
                  onChange={(e) => setBenchHeight(parseFloat(e.target.value) || 5.0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('chargePerHole', lang)}</label>
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
              <span className="font-semibold">{t('computedPowderFactor', lang)}</span>
              <span className="font-bold text-sm">
                {computedPowderFactor.toFixed(2)} kg/m³
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
                {t('nextPhotos', lang)} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Photo Capture & Quality Checks */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('step2Photos', lang)}</h3>
              <p className="text-sm text-slate-500">{t('step2Subtitle', lang)}</p>
            </div>

            {/* Field Capture Guide */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t('captureProtocolTitle', lang)}</span> {t('captureProtocolText', lang)}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition space-y-4">
              {photoDataUrl ? (
                <div className="flex flex-col items-center space-y-3">
                  <img
                    src={photoDataUrl}
                    alt="Muck pile"
                    className="max-h-72 rounded-lg shadow-md border border-slate-300 object-contain"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <label className="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold">
                      {t('replacePhoto', lang)}
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowInclinometer(true)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Viseur AR (90°)' : 'AR Inclinometer (90°)'}</span>
                    </button>
                    <button
                      onClick={handleGenerateSample}
                      className="px-3 py-2 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('generateSamplePhoto', lang)}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <label className="flex flex-col items-center cursor-pointer">
                    <Camera className="w-12 h-12 text-blue-500 mb-2" />
                    <span className="text-sm font-bold text-slate-800">{t('takeOrUpload', lang)}</span>
                    <span className="text-xs text-slate-500 mt-1">{t('photoFormats', lang)}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInclinometer(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Viseur Inclinomètre AR (90°)' : 'AR Inclinometer Viewfinder (90°)'}</span>
                    </button>
                    <button
                      onClick={handleGenerateSample}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {t('generateSamplePhoto', lang)}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Check Results */}
            {qualityCheck && (
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                {/* Warning if Artificial Graphic / Logo Detected */}
                {qualityCheck.isArtificialGraphic && (
                  <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
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

                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {t('qualityChecks', lang)}
                  </h4>
                  {qualityCheck.blurStatus === 'pass' && qualityCheck.exposureStatus === 'pass' ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('readyForAnalysis', lang)}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {t('qualityWarning', lang)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{t('sharpness', lang)}</span>
                    <span className={`font-bold uppercase ${qualityCheck.blurStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {t(qualityCheck.blurStatus, lang)} ({qualityCheck.blurScore})
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{t('exposure', lang)}</span>
                    <span className={`font-bold uppercase ${qualityCheck.exposureStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {t(qualityCheck.exposureStatus, lang)}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{t('contrast', lang)}</span>
                    <span className={`font-bold uppercase ${qualityCheck.contrastStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {t(qualityCheck.contrastStatus, lang)}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{t('resolution', lang)}</span>
                    <span className={`font-bold uppercase ${qualityCheck.resolutionStatus === 'pass' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {t(qualityCheck.resolutionStatus, lang)}
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
                <ChevronLeft className="w-4 h-4" /> {t('back', lang)}
              </button>
              <button
                disabled={!photoDataUrl}
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                {t('nextScale', lang)} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Scale Calibration (Two taps on scale bar) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('step3Scale', lang)}</h3>
              <p className="text-sm text-slate-500">{t('step3Subtitle', lang)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-blue-600" />
                {t('referenceLengthMm', lang)}
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
                  {t('scaleResult', lang)} {calibratedPxPerMm.toFixed(3)} px/mm
                </div>
              )}
            </div>

            {/* Clickable Image Canvas for Scale */}
            <div className="relative border border-slate-300 rounded-xl overflow-hidden bg-slate-900 flex justify-center items-center p-2">
              {photoDataUrl && (
                <div className="relative inline-block">
                  <img
                    src={photoDataUrl}
                    alt="Scale selection"
                    onLoad={(e) => {
                      setImageNaturalDim({
                        width: e.currentTarget.naturalWidth || 800,
                        height: e.currentTarget.naturalHeight || 600,
                      });
                    }}
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
                    className="max-h-96 w-auto object-contain cursor-crosshair block rounded"
                  />
                  {/* Pin Markers */}
                  {scalePoints.map((pt, idx) => {
                    const leftPct = (pt.x / Math.max(1, imageNaturalDim.width)) * 100;
                    const topPct = (pt.y / Math.max(1, imageNaturalDim.height)) * 100;
                    return (
                      <div
                        key={idx}
                        style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center"
                      >
                        <span className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white">
                          {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500">
              {scalePoints.length === 0 && t('scaleStep0', lang)}
              {scalePoints.length === 1 && t('scaleStep1', lang)}
              {scalePoints.length >= 2 && t('scaleStep2', lang)}
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> {t('back', lang)}
              </button>
              <button
                disabled={!calibratedPxPerMm}
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                {t('nextAnalyse', lang)} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Analyse */}
        {step === 4 && (
          <div className="space-y-6 text-center py-8">
            <Cpu className="w-16 h-16 text-blue-600 mx-auto animate-bounce" />
            <div>
              <h3 className="text-xl font-bold text-slate-900">{t('step4Analyse', lang)}</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                {t('step4Subtitle', lang)}
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
                  {t('processingMsg', lang)} {analysisProgress}%
                </span>
              </div>
            ) : (
              <button
                onClick={handleRunAnalysis}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 mx-auto transition"
              >
                <Sparkles className="w-5 h-5" />
                {t('runAnalysis', lang)}
              </button>
            )}

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> {t('back', lang)}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Results & Percentiles */}
        {step === 5 && activeRun && (
          <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t('step5Result', lang)}</h3>
                <p className="text-xs text-slate-500">
                  {lang === 'fr'
                    ? `${activeRun.fragments.length} fragments identifiés | Équivalent Tamis Diamètre Féret Minimal`
                    : `Identified ${activeRun.fragments.length} rock fragments | Minimum Feret Sieve Equivalent`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2">
                <SendToReportButton
                  sectionKey="blast"
                  blast={currentBlast}
                  lang={lang}
                  getPayload={() => ({
                    blastId: currentBlast.blastId,
                    dateTime: currentBlast.dateTime,
                    weather: currentBlast.weather,
                    burden: currentBlast.parameters.burden,
                    spacing: currentBlast.parameters.spacing,
                    benchHeight: currentBlast.parameters.benchHeight,
                    holeDiameter: currentBlast.parameters.holeDiameter,
                    holeDepth: currentBlast.parameters.holeDepth,
                    subdrill: currentBlast.parameters.subdrill,
                    chargePerHole: currentBlast.parameters.chargePerHole,
                    numberOfHoles: currentBlast.parameters.numberOfHoles,
                    rockType: currentBlast.rockMass.rockType,
                    density: currentBlast.rockMass.density,
                    ucsMPa: currentBlast.rockMass.ucsMPa,
                    gsiOrRmr: currentBlast.rockMass.estimatedGsiOrRmr,
                    p10: activeRun.metrics.p10,
                    p20: activeRun.metrics.p20,
                    p50: activeRun.metrics.p50,
                    p80: activeRun.metrics.p80,
                    p90: activeRun.metrics.p90,
                    topSize: activeRun.metrics.pMax,
                    uniformityIndex: activeRun.metrics.uniformityIndex,
                    oversizePercent: activeRun.metrics.oversizePercent,
                    finesPercent: activeRun.metrics.finesPercent,
                    fragmentCount: activeRun.fragments.length,
                  })}
                  summaryFr={`Tir terrain ${currentBlast.blastId} : P50 ${activeRun.metrics.p50} mm, P80 ${activeRun.metrics.p80} mm (${activeRun.fragments.length} fragments).`}
                  summaryEn={`Field blast ${currentBlast.blastId}: P50 ${activeRun.metrics.p50} mm, P80 ${activeRun.metrics.p80} mm (${activeRun.fragments.length} rocks).`}
                />

                <button
                  onClick={async () => {
                    try {
                      const blob = await generateBlastPdfReport(
                        { id: 'proj-1', name: currentBlast.blastId, description: 'Mine Operations', createdAt: 0, updatedAt: 0 },
                        { id: 'site-1', projectId: 'proj-1', name: 'Open Pit South Bench', locationText: 'Mine Pit', createdAt: 0, updatedAt: 0 },
                        currentBlast,
                        currentBlast.images[0],
                        activeRun,
                        lang
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const dateStr = new Date().toISOString().slice(0, 10);
                      a.download = `FRAGMILL_Rapport_General_${currentBlast.blastId}_${dateStr}.pdf`;
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
                  <FileDown className="w-3.5 h-3.5" /> {t('exportCsv', lang)}
                </button>
              </div>
            </div>

            {/* Key Sizing Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] text-blue-700 font-semibold uppercase block">{t('p50', lang)}</span>
                <span className="text-xl font-black text-blue-950">{activeRun.metrics.p50} mm</span>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  95% CI: [{activeRun.metrics.bootstrapCI.p50[0]}-{activeRun.metrics.bootstrapCI.p50[1]}]
                </span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-[10px] text-blue-700 font-semibold uppercase block">{t('p80', lang)}</span>
                <span className="text-xl font-black text-blue-950">{activeRun.metrics.p80} mm</span>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  95% CI: [{activeRun.metrics.bootstrapCI.p80[0]}-{activeRun.metrics.bootstrapCI.p80[1]}]
                </span>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[10px] text-amber-700 font-semibold uppercase block">{t('oversizePercent', lang)}</span>
                <span className="text-xl font-black text-amber-950">{activeRun.metrics.oversizePercent}%</span>
                <span className="text-[10px] text-amber-600 block mt-0.5">{t('oversizeNote', lang)}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-600 font-semibold uppercase block">{t('finesPercent', lang)}</span>
                <span className="text-xl font-black text-slate-900">{activeRun.metrics.finesPercent}%</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{t('finesNote', lang)}</span>
              </div>
            </div>

            {/* Interactive Cumulative Passing Chart */}
            <CumulativeDistributionChart metrics={activeRun.metrics} lang={lang} />

            {/* Segmentation Overlay Preview */}
            {activeRun.stepPreviews?.overlay && (
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">
                  {t('overlayView', lang)}
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
                <ChevronLeft className="w-4 h-4" /> {t('reAnalyse', lang)}
              </button>
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow"
              >
                <CheckCircle2 className="w-4 h-4" /> {t('doneNextBlast', lang)}
              </button>
            </div>
          </div>
        )}
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
