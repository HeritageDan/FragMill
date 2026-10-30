import React, { useState, useEffect } from 'react';
import type { Blast, KuzRamRockTables, BlastAdvisorTarget } from '../../types';
import {
  computeKuzRam,
  runBayesianCalibration,
  runBlastAdvisor,
  calculateRockFactorA,
  DEFAULT_ROCK_TABLES,
} from '../../services/kuzram';
import { TornadoSensitivityChart, CumulativeDistributionChart } from '../charts/FragmentationCharts';
import { t } from '../../i18n';
import {
  Sparkles,
  Sliders,
  AlertTriangle,
  Compass,
  CheckCircle2,
  RefreshCw,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import type { Project, Site } from '../../types';
import { SendToReportButton } from '../report/SendToReportButton';
import { downloadOptimizedNextBlastExcel } from '../../services/drillHoles/drillHoleService';

interface KuzRamViewProps {
  blasts: Blast[];
  activeBlastId?: string;
  onSelectBlast?: (blastId: string) => void;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const KuzRamView: React.FC<KuzRamViewProps> = ({
  blasts,
  activeBlastId,
  onSelectBlast,
  project,
  site,
  lang = 'en',
}) => {
  const [selectedBlastId, setSelectedBlastId] = useState<string>(activeBlastId || blasts[0]?.id || '');
  const selectedBlast = blasts.find((b) => b.id === selectedBlastId) || blasts[0];

  const getInitialRockTables = (b?: Blast): KuzRamRockTables => {
    if (!b) return DEFAULT_ROCK_TABLES;
    const rm = b.rockMass;
    let jpa = 30;
    if (rm.jointOrientation === 'dip_out_of_face') jpa = 20;
    else if (rm.jointOrientation === 'dip_into_face') jpa = 40;

    let jps = 20;
    const jSpacing = (rm as any).jointSpacingM !== undefined ? (rm as any).jointSpacingM : rm.meanJointSpacing;
    if (jSpacing !== undefined) {
      if (jSpacing < 0.1) jps = 10;
      else if (jSpacing > 1.0) jps = 50;
      else jps = 20;
    }

    const E = rm.youngsModulusGPa || 65;
    const ucs = rm.ucsMPa || 110;
    const hf = E < 50 ? Number((E / 3).toFixed(1)) : Number((ucs / 5).toFixed(1));

    return {
      rmd: (rm as any).rmd || 20,
      jf: jps,
      jfo: jpa,
      density: rm.density || 2.76,
      hf,
    };
  };

  const [tables, setTables] = useState<KuzRamRockTables>(() => getInitialRockTables(selectedBlast));

  useEffect(() => {
    if (activeBlastId) {
      setSelectedBlastId(activeBlastId);
    }
  }, [activeBlastId]);

  useEffect(() => {
    if (selectedBlast) {
      setTables(getInitialRockTables(selectedBlast));
    }
  }, [selectedBlastId]);

  const initialTables = React.useMemo(() => getInitialRockTables(selectedBlast), [selectedBlast]);
  const isTablesModified = React.useMemo(() => {
    return (
      Math.abs(tables.density - initialTables.density) > 0.001 ||
      tables.jfo !== initialTables.jfo ||
      tables.jf !== initialTables.jf ||
      tables.rmd !== initialTables.rmd ||
      Math.abs(tables.hf - initialTables.hf) > 0.01
    );
  }, [tables, initialTables]);

  // Bayesian MCMC states
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [priorMeanA, setPriorMeanA] = useState(7.0);
  const [priorStdA, setPriorStdA] = useState(1.5);
  const [bayesianResult, setBayesianResult] = useState<any>(null);

  // Blast Advisor states
  const [targetP80, setTargetP80] = useState(180);
  const [advisorBounds, setAdvisorBounds] = useState({
    minBurden: 1.8,
    maxBurden: 3.2,
    minSpacing: 2.0,
    maxSpacing: 3.8,
    minStemming: 1.5,
    maxStemming: 3.0,
    minPowderFactor: 0.45,
    maxPowderFactor: 1.1,
  });
  const [advisorResult, setAdvisorResult] = useState<any>(null);

  const calculatedA = calculateRockFactorA(tables);

  // Run Kuz-Ram for selected blast
  const currentKuzRam = computeKuzRam(
    selectedBlast.parameters,
    selectedBlast.rockMass,
    calculatedA
  );

  // Handle Bayesian calibration run
  const handleRunCalibration = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      const observations = blasts.map((b) => ({
        measuredX50Mm:
          b.images[0]?.segmentationRuns?.[0]?.metrics?.p50 ||
          (b.blastId === 'BL-2026-001' ? 168 : b.blastId === 'BL-2026-002' ? 115 : 78),
        params: b.parameters,
        rockMass: b.rockMass,
        errorStdMm: 12,
      }));

      const res = runBayesianCalibration(priorMeanA, priorStdA, observations, 3000, 500);
      setBayesianResult(res);
      setIsCalibrating(false);
    }, 150);
  };

  // Handle Blast Advisor Search
  const handleRunAdvisor = () => {
    const target: BlastAdvisorTarget = {
      targetP80Mm: targetP80,
      bounds: advisorBounds,
    };
    const rockA = bayesianResult ? bayesianResult.posteriorMeanA : calculatedA;
    const res = runBlastAdvisor(selectedBlast.parameters, selectedBlast.rockMass, rockA, target);
    setAdvisorResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <Compass className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {t('kuzRamTitle', lang)}
            </h2>
            <p className="text-xs text-slate-500">
              {t('kuzRamSubtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{t('selectBlast', lang)}</span>
          <select
            value={selectedBlastId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedBlastId(newId);
              if (onSelectBlast) onSelectBlast(newId);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
          >
            {blasts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.blastId} ({b.rockMass.rockType})
              </option>
            ))}
          </select>

          <SendToReportButton
            sectionKey="kuzram"
            project={project}
            site={site}
            blast={selectedBlast}
            lang={lang}
            getPayload={() => ({
              blastId: selectedBlast?.blastId,
              rockFactorA: calculatedA,
              uniformityIndexN: currentKuzRam.uniformityIndexN,
              characteristicSizeXcMm: currentKuzRam.characteristicSizeXcMm,
              predictedP50Mm: currentKuzRam.meanSizeX50Mm,
              predictedP80Mm: currentKuzRam.p80Mm,
              rmd: tables.rmd,
              jf: tables.jf,
              jfo: tables.jfo,
              density: tables.density,
              hf: tables.hf,
            })}
            summaryFr={`Modélisation Kuz-Ram (Tir ${selectedBlast?.blastId}) : facteur A = ${calculatedA}, indice n = ${currentKuzRam.uniformityIndexN.toFixed(2)}, P80 calculé = ${currentKuzRam.p80Mm.toFixed(1)} mm.`}
            summaryEn={`Kuz-Ram predictor (Blast ${selectedBlast?.blastId}): factor A = ${calculatedA}, index n = ${currentKuzRam.uniformityIndexN.toFixed(2)}, predicted P80 = ${currentKuzRam.p80Mm.toFixed(1)} mm.`}
          />
        </div>
      </div>

      {/* Mandatory Decision Support Disclaimer */}
      <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 font-medium">
          <span className="font-bold uppercase tracking-wider block mb-0.5">{t('safetyNoticeTitle', lang)}</span>
          {t('safetyNoticeText', lang)}
        </div>
      </div>

      {/* Section 1: Cunningham Tables & Kuz-Ram Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Editable Cunningham Tables */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('cunninghamTablesTitle', lang)}
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-black text-xs">
                {t('rockFactorA', lang)} = {calculatedA}
              </span>
              {isTablesModified && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {lang === 'fr' ? 'Valeur modifiée' : 'Modified value'}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                {t('rmdLabel', lang)}
              </label>
              <select
                value={tables.rmd}
                onChange={(e) => setTables({ ...tables, rmd: parseInt(e.target.value) })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value={10}>{t('rmdPowdery', lang)}</option>
                <option value={20}>{t('rmdBlocky', lang)}</option>
                <option value={50}>{t('rmdMassive', lang)}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                {t('jfLabel', lang)}
              </label>
              <select
                value={tables.jf}
                onChange={(e) => setTables({ ...tables, jf: parseInt(e.target.value) })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value={10}>{t('jfTight', lang)}</option>
                <option value={20}>{t('jfMedium', lang)}</option>
                <option value={50}>{t('jfWide', lang)}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                {t('jfoLabel', lang)}
              </label>
              <select
                value={tables.jfo}
                onChange={(e) => setTables({ ...tables, jfo: parseInt(e.target.value) })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value={20}>{t('jfoDipOut', lang)}</option>
                <option value={30}>{t('jfoPerp', lang)}</option>
                <option value={40}>{t('jfoDipIn', lang)}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{t('densityLabel', lang)}</label>
                <input
                  type="number"
                  step="0.05"
                  value={tables.density}
                  onChange={(e) => setTables({ ...tables, density: parseFloat(e.target.value) || 2.65 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{t('hardnessLabel', lang)}</label>
                <input
                  type="number"
                  step="1"
                  value={tables.hf}
                  onChange={(e) => setTables({ ...tables, hf: parseFloat(e.target.value) || 15 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <span className="font-bold text-slate-700 block">{t('analyticalOutputTitle', lang)}</span>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('meanX50', lang)}</span>
                <span className="font-bold text-slate-900">{currentKuzRam.meanSizeX50Mm} mm</span>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('indexN', lang)}</span>
                <span className="font-bold text-slate-900">{currentKuzRam.uniformityIndexN}</span>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('predictedP80', lang)}</span>
                <span className="font-bold text-slate-900">{currentKuzRam.p80Mm} mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Predicted Curve & Comparison */}
        <div className="lg:col-span-7 space-y-4">
          {selectedBlast.images[0]?.segmentationRuns?.[0]?.metrics && (
            <CumulativeDistributionChart
              metrics={selectedBlast.images[0].segmentationRuns[0].metrics}
              kuzRam={currentKuzRam}
              title={lang === 'fr' ? 'Courbe Théorique Kuz-Ram vs Granulométrie Mesurée' : 'Kuz-Ram Theoretical vs Image Measured Fragmentation Curve'}
              lang={lang}
            />
          )}
        </div>
      </div>

      {/* Section 2: Bayesian MCMC Site Calibration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" /> {t('bayesianTitle', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('bayesianSubtitle', lang)}
            </p>
          </div>

          <button
            onClick={handleRunCalibration}
            disabled={isCalibrating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
          >
            {isCalibrating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isCalibrating ? t('samplingMcmc', lang) : t('runBayesianBtn', lang)}
          </button>
        </div>

        {bayesianResult && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block">{t('priorMeanA', lang)}</span>
              <span className="text-base font-bold text-slate-800">{bayesianResult.priorMeanA} ± {bayesianResult.priorStdA}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-purple-700 font-semibold block">{t('calibratedPosteriorA', lang)}</span>
              <span className="text-base font-black text-purple-950">{bayesianResult.posteriorMeanA} ± {bayesianResult.posteriorStdA}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block">{t('credibleInterval95', lang)}</span>
              <span className="text-base font-bold text-slate-800">
                [{bayesianResult.credibleInterval95A[0]} - {bayesianResult.credibleInterval95A[1]}]
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block">{t('acceptanceRate', lang)}</span>
              <span className="text-base font-bold text-emerald-600">
                {(bayesianResult.acceptanceRate * 100).toFixed(0)}% {t('targetRate', lang)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Blast Advisor & Tornado Sensitivity */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" /> {t('blastAdvisorTitle', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('blastAdvisorSubtitle', lang)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              {t('targetP80Label', lang)}
              <input
                type="number"
                value={targetP80}
                onChange={(e) => setTargetP80(parseInt(e.target.value) || 180)}
                className="w-20 px-2 py-1 border border-slate-300 rounded font-bold text-blue-600 text-center"
              />
            </label>
            <button
              onClick={handleRunAdvisor}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              {t('optimizePatternBtn', lang)}
            </button>
          </div>
        </div>

        {advisorResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <div className="lg:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                {t('recommendedDesignTitle', lang)} ({t('targetP80Label', lang)} {targetP80} mm)
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">{t('recBurden', lang)}</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedBurden} m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">{t('recSpacing', lang)}</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedSpacing} m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">{t('recStemming', lang)}</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedStemming} m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">{t('targetPowderFactor', lang)}</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedPowderFactor} kg/m³</span>
                </div>
                <div className="flex justify-between py-1.5 bg-blue-100/60 px-2 rounded font-bold text-blue-950">
                  <span>{t('predictedP80Outcome', lang)}</span>
                  <span>{advisorResult.predictedP80Mm} mm [CI: {advisorResult.predictedP80CI[0]}-{advisorResult.predictedP80CI[1]}]</span>
                </div>
              </div>

              {/* Action to download ready-to-drill optimized Excel file */}
              <button
                onClick={() => downloadOptimizedNextBlastExcel(selectedBlast, advisorResult, lang)}
                className="w-full mt-3 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow transition cursor-pointer"
                title={lang === 'fr' ? 'Générer et télécharger la grille de foration Excel optimisée pour le prochain tir' : 'Generate and download optimized Excel drill plan for the next blast'}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>
                  {lang === 'fr'
                    ? 'Télécharger le Plan Excel Optimisé (.xlsx)'
                    : 'Download Optimized Drill Plan (.xlsx)'}
                </span>
              </button>
            </div>

            <div className="lg:col-span-7">
              <TornadoSensitivityChart sensitivity={advisorResult.sensitivity} lang={lang} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
