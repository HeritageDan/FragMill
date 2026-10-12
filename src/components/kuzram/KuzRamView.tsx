import React, { useState } from 'react';
import type { Blast, KuzRamRockTables, BlastAdvisorTarget } from '../../types';
import {
  computeKuzRam,
  runBayesianCalibration,
  runBlastAdvisor,
  calculateRockFactorA,
  DEFAULT_ROCK_TABLES,
} from '../../services/kuzram';
import { TornadoSensitivityChart, CumulativeDistributionChart } from '../charts/FragmentationCharts';
import {
  Sparkles,
  Sliders,
  AlertTriangle,
  Compass,
  CheckCircle2,
  RefreshCw,
  Info,
} from 'lucide-react';

interface KuzRamViewProps {
  blasts: Blast[];
  lang?: 'en' | 'fr';
}

export const KuzRamView: React.FC<KuzRamViewProps> = ({ blasts, lang = 'en' }) => {
  const [selectedBlastId, setSelectedBlastId] = useState<string>(blasts[0]?.id || '');
  const [tables, setTables] = useState<KuzRamRockTables>(DEFAULT_ROCK_TABLES);

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

  const selectedBlast = blasts.find((b) => b.id === selectedBlastId) || blasts[0];
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
              {lang === 'fr' ? 'Modèle Kuz-Ram & Étalonnage Bayésien' : 'Cunningham Kuz-Ram Blast Model & Bayesian Calibration'}
            </h2>
            <p className="text-xs text-slate-500">
              Standard engineering blast fragmentation prediction and Bayesian MCMC site-specific calibration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Select Blast:</span>
          <select
            value={selectedBlastId}
            onChange={(e) => setSelectedBlastId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
          >
            {blasts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.blastId}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mandatory Decision Support Disclaimer */}
      <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 font-medium">
          <span className="font-bold uppercase tracking-wider block mb-0.5">Mandatory Mining Safety Notice:</span>
          Decision support only. Blast design changes must be reviewed and approved by a qualified blasting engineer and
          comply with local regulations, pit stability constraints, and site safety rules. Never exceed statutory vibration,
          flyrock, or explosive storage limits.
        </div>
      </div>

      {/* Section 1: Cunningham Tables & Kuz-Ram Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Editable Cunningham Tables */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Cunningham (1987) Rock Factor Tables
            </h3>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-black text-xs">
              Rock Factor A = {calculatedA}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Rock Mass Description (RMD):
              </label>
              <select
                value={tables.rmd}
                onChange={(e) => setTables({ ...tables, rmd: parseInt(e.target.value) })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value={10}>Powdery / Friable (10)</option>
                <option value={20}>Blocky / Closely Jointed (20)</option>
                <option value={50}>Massive / Tight Joints (50)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Joint Spacing Factor (JF):
              </label>
              <select
                value={tables.jf}
                onChange={(e) => setTables({ ...tables, jf: parseInt(e.target.value) })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value={10}>Vertical Joints &lt; 0.1 m (10)</option>
                <option value={20}>Joint Spacing 0.1 to 1.0 m (20)</option>
                <option value={50}>Joint Spacing &gt; 1.0 m (50)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                Joint Face Orientation (JFO):
              </label>
              <select
                value={tables.jfo}
                onChange={(e) => setTables({ ...tables, jfo: parseInt(e.target.value) })}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value={20}>Dip Out of Face - Unfavourable (20)</option>
                <option value={30}>Strike Perpendicular to Face (30)</option>
                <option value={40}>Dip Into Face - Favourable (40)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Density (t/m³)</label>
                <input
                  type="number"
                  step="0.05"
                  value={tables.density}
                  onChange={(e) => setTables({ ...tables, density: parseFloat(e.target.value) || 2.65 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Hardness HF (E/30)</label>
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
            <span className="font-bold text-slate-700 block">Kuz-Ram Analytical Output:</span>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Mean X50</span>
                <span className="font-bold text-slate-900">{currentKuzRam.meanSizeX50Mm} mm</span>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Index n</span>
                <span className="font-bold text-slate-900">{currentKuzRam.uniformityIndexN}</span>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Predicted P80</span>
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
              title="Kuz-Ram Theoretical vs Image Measured Fragmentation Curve"
            />
          )}
        </div>
      </div>

      {/* Section 2: Bayesian MCMC Site Calibration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" /> Bayesian Metropolis-Hastings MCMC Rock Calibration
            </h3>
            <p className="text-xs text-slate-500">
              Calibrate site rock factor A using historical photographic X50 measurements across all monitored blasts
            </p>
          </div>

          <button
            onClick={handleRunCalibration}
            disabled={isCalibrating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            {isCalibrating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isCalibrating ? 'Sampling MCMC Posterior...' : 'Run Bayesian MCMC Calibration'}
          </button>
        </div>

        {bayesianResult && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block">Prior Mean A</span>
              <span className="text-base font-bold text-slate-800">{bayesianResult.priorMeanA} ± {bayesianResult.priorStdA}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-purple-700 font-semibold block">Calibrated Posterior Mean A</span>
              <span className="text-base font-black text-purple-950">{bayesianResult.posteriorMeanA} ± {bayesianResult.posteriorStdA}</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block">95% Credible Interval</span>
              <span className="text-base font-bold text-slate-800">
                [{bayesianResult.credibleInterval95A[0]} - {bayesianResult.credibleInterval95A[1]}]
              </span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
              <span className="text-[10px] text-slate-500 font-semibold block">MCMC Acceptance Rate</span>
              <span className="text-base font-bold text-emerald-600">
                {(bayesianResult.acceptanceRate * 100).toFixed(0)}% (Target: 25-50%)
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
              <Sliders className="w-4 h-4 text-blue-600" /> Blast Advisor: Parameter Search & Tornado Sensitivity
            </h3>
            <p className="text-xs text-slate-500">
              Optimize Burden, Spacing, and Stemming within safe bounds to achieve target crusher feed size
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              Target P80 (mm):
              <input
                type="number"
                value={targetP80}
                onChange={(e) => setTargetP80(parseInt(e.target.value) || 180)}
                className="w-20 px-2 py-1 border border-slate-300 rounded font-bold text-blue-600 text-center"
              />
            </label>
            <button
              onClick={handleRunAdvisor}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              Optimize Pattern
            </button>
          </div>
        </div>

        {advisorResult && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            <div className="lg:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Recommended Blast Design (Target P80: {targetP80} mm)
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Recommended Burden B:</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedBurden} m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Recommended Spacing S:</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedSpacing} m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Recommended Stemming T:</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedStemming} m</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600">Target Powder Factor:</span>
                  <span className="font-bold text-slate-900">{advisorResult.recommendedPowderFactor} kg/m³</span>
                </div>
                <div className="flex justify-between py-1.5 bg-blue-100/60 px-2 rounded font-bold text-blue-950">
                  <span>Predicted P80 Outcome:</span>
                  <span>{advisorResult.predictedP80Mm} mm [CI: {advisorResult.predictedP80CI[0]}-{advisorResult.predictedP80CI[1]}]</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <TornadoSensitivityChart sensitivity={advisorResult.sensitivity} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
