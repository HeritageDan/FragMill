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
import { runClassicalSegmentation, DEFAULT_CLASSICAL_PARAMS } from '../../services/imageProcessing';
import { runAiSegmentation, runHybridSegmentation } from '../../services/aiSegmentation';
import { computeFragmentationMetrics } from '../../services/statistics';
import { generateBlastPdfReport, exportFragmentsCsv, exportBlastWorkbookXlsx } from '../../services/export';
import {
  FileDown,
  Edit3,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Ruler,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

interface BlastDetailViewProps {
  blast: Blast;
  settings: AppSettings;
  onUpdateBlast: (updated: Blast) => void;
  onSaveRun: (image: ImageRecord, run: SegmentationRun) => void;
  lang?: 'en' | 'fr';
}

export const BlastDetailView: React.FC<BlastDetailViewProps> = ({
  blast,
  settings,
  onUpdateBlast,
  onSaveRun,
  lang = 'en',
}) => {
  const [selectedImageId, setSelectedImageId] = useState<string>(
    blast.images[0]?.id || ''
  );
  const [activeEngine, setActiveEngine] = useState<EngineType>('classical');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<'overlay' | 'grayscale' | 'clahe' | 'threshold' | 'distance' | 'markers'>('overlay');

  const selectedImage = blast.images.find((i) => i.id === selectedImageId) || blast.images[0];
  const activeRun = selectedImage
    ? (blast as any).segmentationRuns?.find((r: any) => r.imageId === selectedImage.id) ||
      (selectedImage as any).segmentationRuns?.[0] ||
      null
    : null;

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
        setProgressMsg('Running Classical CLAHE & Watershed...');
        const res = await runClassicalSegmentation(img, calib, DEFAULT_CLASSICAL_PARAMS);
        frags = res.fragments;
        stepPreviews = res.stepPreviews;
      } else if (engine === 'ai_sam') {
        setProgressMsg('Running In-Browser SAM 2.1 Neural Network...');
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
        setProgressMsg('Running Hybrid (AI Seeds + Classical Fines)...');
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900">{blast.blastId}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {blast.rockMass.rockType}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {blast.dateTime} | {blast.weather}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeRun && (
            <>
              <button
                onClick={() => setShowManualEditor(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
              >
                <Edit3 className="w-3.5 h-3.5" /> Manual Editor
              </button>

              <button
                onClick={async () => {
                  const blob = await generateBlastPdfReport(
                    { id: '1', name: 'FragMill Study', description: '', createdAt: 0, updatedAt: 0 },
                    { id: '1', projectId: '1', name: 'Mining Pit', locationText: '', createdAt: 0, updatedAt: 0 },
                    blast,
                    selectedImage,
                    activeRun
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Report_${blast.blastId}.pdf`;
                  a.click();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
              >
                <FileDown className="w-3.5 h-3.5" /> PDF Report
              </button>

              <button
                onClick={() => {
                  const blob = exportBlastWorkbookXlsx(blast, activeRun);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `FragMill_${blast.blastId}.xlsx`;
                  a.click();
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
              >
                <FileDown className="w-3.5 h-3.5" /> Excel (.xlsx)
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
                <FileDown className="w-3.5 h-3.5" /> CSV
              </button>
            </>
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

      {/* Main Grid: Left Image & Segmentation, Right Parameters & Curves */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Images, Engines, and Step Previews */}
        <div className="lg:col-span-7 space-y-4">
          {/* Engine Selector */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="font-bold text-slate-700 mr-1">Engine:</span>
              <button
                onClick={() => handleExecuteEngine('classical')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                  activeEngine === 'classical' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Engine A: Classical
              </button>
              <button
                onClick={() => handleExecuteEngine('ai_sam')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                  activeEngine === 'ai_sam' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Engine B: AI SAM
              </button>
              <button
                onClick={() => handleExecuteEngine('hybrid')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                  activeEngine === 'hybrid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Engine C: Hybrid
              </button>
            </div>

            {isProcessing && (
              <span className="text-xs font-bold text-blue-600 flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {progressMsg || 'Processing...'}
              </span>
            )}
          </div>

          {/* Main Visual Viewport with Intermediate Steps Tabs */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
            {/* Step Previews Tab Bar */}
            {activeRun?.stepPreviews && (
              <div className="flex bg-slate-900 border-b border-slate-800 px-2 py-1.5 overflow-x-auto text-[11px] gap-1">
                {(['overlay', 'grayscale', 'clahe', 'threshold', 'distance', 'markers'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveStepTab(tab)}
                    className={`px-2.5 py-1 rounded font-semibold capitalize whitespace-nowrap transition ${
                      activeStepTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <div className="relative p-2 flex justify-center items-center min-h-[360px] max-h-[500px] overflow-hidden">
              {selectedImage && (
                <img
                  src={
                    activeRun?.stepPreviews && activeRun.stepPreviews[activeStepTab]
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
                    Scale: {selectedImage.calibration?.pxPerMm?.toFixed(3) || '0.400'} px/mm
                  </span>
                  <span>Zone: {selectedImage.zone}</span>
                  <span>Lighting: {selectedImage.lighting}</span>
                </div>
                <div>
                  Sharpness: {selectedImage.qualityCheck.blurScore} ({selectedImage.qualityCheck.blurStatus})
                </div>
              </div>
            )}
          </div>

          {/* Sizing Distribution Percentiles Table */}
          {activeRun && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Distribution Sizing Percentiles (95% Bootstrap Intervals)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Percentile</th>
                      <th className="py-2 px-3">Size (mm)</th>
                      <th className="py-2 px-3">95% Bootstrap CI</th>
                      <th className="py-2 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1.5 px-3 font-semibold text-slate-700">P10</td>
                      <td className="py-1.5 px-3 font-bold text-slate-900">{activeRun.metrics.p10} mm</td>
                      <td className="py-1.5 px-3 text-slate-500">
                        [{activeRun.metrics.bootstrapCI.p10[0]} - {activeRun.metrics.bootstrapCI.p10[1]}]
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">Fine fraction limit</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 font-semibold text-slate-700">P20</td>
                      <td className="py-1.5 px-3 font-bold text-slate-900">{activeRun.metrics.p20} mm</td>
                      <td className="py-1.5 px-3 text-slate-500">
                        [{activeRun.metrics.bootstrapCI.p20[0]} - {activeRun.metrics.bootstrapCI.p20[1]}]
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">Lower uniformity reference</td>
                    </tr>
                    <tr className="bg-blue-50/50">
                      <td className="py-1.5 px-3 font-bold text-blue-900">P50</td>
                      <td className="py-1.5 px-3 font-extrabold text-blue-950">{activeRun.metrics.p50} mm</td>
                      <td className="py-1.5 px-3 text-blue-700">
                        [{activeRun.metrics.bootstrapCI.p50[0]} - {activeRun.metrics.bootstrapCI.p50[1]}]
                      </td>
                      <td className="py-1.5 px-3 text-blue-700 font-medium">Median fragment diameter</td>
                    </tr>
                    <tr className="bg-blue-50/50">
                      <td className="py-1.5 px-3 font-bold text-blue-900">P80</td>
                      <td className="py-1.5 px-3 font-extrabold text-blue-950">{activeRun.metrics.p80} mm</td>
                      <td className="py-1.5 px-3 text-blue-700">
                        [{activeRun.metrics.bootstrapCI.p80[0]} - {activeRun.metrics.bootstrapCI.p80[1]}]
                      </td>
                      <td className="py-1.5 px-3 text-blue-700 font-medium">Crusher feed critical parameter</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 font-semibold text-slate-700">P90</td>
                      <td className="py-1.5 px-3 font-bold text-slate-900">{activeRun.metrics.p90} mm</td>
                      <td className="py-1.5 px-3 text-slate-500">
                        [{activeRun.metrics.bootstrapCI.p90[0]} - {activeRun.metrics.bootstrapCI.p90[1]}]
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">Coarse envelope boundary</td>
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
            />
          )}

          {/* Blast Geometry & Powder Factor Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Blast Geometry & Explosive Loading
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Bench Height</span>
                <span className="font-bold text-slate-800">{blast.parameters.benchHeight} m</span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Hole Diameter</span>
                <span className="font-bold text-slate-800">{blast.parameters.holeDiameter} mm</span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Burden x Spacing</span>
                <span className="font-bold text-slate-800">
                  {blast.parameters.burden}m x {blast.parameters.spacing}m
                </span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Stemming Length</span>
                <span className="font-bold text-slate-800">{blast.parameters.stemmingLength} m</span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Explosive Type</span>
                <span className="font-bold text-slate-800 truncate block">{blast.parameters.explosiveType}</span>
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                <span className="text-blue-600 block text-[10px] font-semibold">Powder Factor</span>
                <span className="font-bold text-blue-900">
                  {(
                    blast.parameters.chargePerHole /
                    Math.max(0.1, blast.parameters.burden * blast.parameters.spacing * blast.parameters.benchHeight)
                  ).toFixed(2)}{' '}
                  kg/m³
                </span>
              </div>
            </div>
          </div>

          {/* Rock Mass Geology Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rock Mass Structure & Discontinuities
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Rock Type</span>
                <span className="font-bold text-slate-800">{blast.rockMass.rockType}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Density</span>
                <span className="font-bold text-slate-800">{blast.rockMass.density} t/m³</span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Mean Joint Spacing</span>
                <span className="font-bold text-slate-800">{blast.rockMass.meanJointSpacing} m</span>
              </div>
              <div className="p-2 bg-slate-50 rounded">
                <span className="text-slate-500 block text-[10px]">Joint Orientation</span>
                <span className="font-bold text-slate-800 capitalize truncate block">
                  {blast.rockMass.jointOrientation.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
