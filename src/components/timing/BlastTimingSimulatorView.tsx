import React, { useState, useEffect, useRef } from 'react';
import type { Blast } from '../../types';
import type { HoleTimingInfo } from '../../types/advanced';
import {
  generatePatternTiming,
  computeIsochroneContours,
  calculateUSBMPPV,
  generateFaceProfile,
  type InitiationPatternType,
} from '../../services/timing/initiationSimulator';
import {
  Flame,
  Play,
  Pause,
  RotateCcw,
  Activity,
  ShieldAlert,
  Clock,
  Waves,
  Zap,
} from 'lucide-react';
import type { Project, Site } from '../../types';
import { SendToReportButton } from '../report/SendToReportButton';

interface BlastTimingSimulatorViewProps {
  blast: Blast;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const BlastTimingSimulatorView: React.FC<BlastTimingSimulatorViewProps> = ({
  blast,
  project,
  site,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  const [patternType, setPatternType] = useState<InitiationPatternType>('v_echelon');
  const [surfaceDelayMs, setSurfaceDelayMs] = useState<number>(25);
  const [inHoleDelayMs, setInHoleDelayMs] = useState<number>(400);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [distanceToStructureM, setDistanceToStructureM] = useState<number>(350);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dia = blast.parameters.holeDiameter || 79;
  const nHoles = blast.parameters.numberOfHoles || 50;
  const rows = 5;
  const cols = Math.max(4, Math.ceil(nHoles / rows));
  const burden = blast.parameters.burden || 4.0;
  const spacing = blast.parameters.spacing || 3.0;
  const chargeKg = blast.parameters.chargePerHole || 71.89;

  const [holes, setHoles] = useState<HoleTimingInfo[]>([]);

  useEffect(() => {
    const generated = generatePatternTiming(
      rows,
      cols,
      burden,
      spacing,
      chargeKg,
      patternType,
      surfaceDelayMs,
      inHoleDelayMs
    );
    setHoles(generated);
    setCurrentTimeMs(0);
  }, [rows, cols, burden, spacing, chargeKg, patternType, surfaceDelayMs, inHoleDelayMs]);

  const maxDurationMs = holes.length > 0 ? Math.max(...holes.map((h) => h.firingTimeMs)) + 30 : 600;

  // Playback timer loop
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTimeMs((prev) => {
          if (prev >= maxDurationMs) {
            setIsPlaying(false);
            return maxDurationMs;
          }
          return prev + 6; // advance 6ms per frame
        });
      }, 35);
    }
    return () => clearInterval(timer);
  }, [isPlaying, maxDurationMs]);

  // Render timing canvas with isochrones and firing blast waves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || holes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Bench background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw free face line at top
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(30, 40);
    ctx.lineTo(width - 30, 40);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(isFrench ? 'FRONT DE TAILLE LIBRE (DIRECTION DU TIR)' : 'QUARRY FREE FACE (THROW DIRECTION)', width / 2 - 120, 28);

    // Isochrones
    const isochrones = computeIsochroneContours(holes, 30);
    isochrones.forEach((iso) => {
      if (iso.timeMs <= currentTimeMs) {
        ctx.strokeStyle = `${iso.color}55`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        iso.points.forEach((pt, idx) => {
          const px = 60 + (pt.x / (cols * spacing || 1)) * (width - 120);
          const py = 75 + (pt.y / (rows * burden || 1)) * (height - 120);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    });

    // Draw holes
    holes.forEach((h) => {
      const px = 60 + (h.x / (cols * spacing || 1)) * (width - 120);
      const py = 75 + (h.y / (rows * burden || 1)) * (height - 120);

      const hasFired = h.firingTimeMs <= currentTimeMs;
      const isJustFiring = Math.abs(h.firingTimeMs - currentTimeMs) < 25;

      // Draw detonation shockwave ring if currently detonating
      if (isJustFiring) {
        ctx.beginPath();
        ctx.arc(px, py, 26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 42, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Hole circle
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fillStyle = hasFired ? '#ef4444' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = hasFired ? '#fbbf24' : '#93c5fd';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hole ID and time
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`${h.firingTimeMs}ms`, px - 14, py + 22);
    });
  }, [holes, currentTimeMs, rows, cols, burden, spacing, isFrench]);

  const ppvEstimate = calculateUSBMPPV(distanceToStructureM, chargeKg);
  const faceProfile = generateFaceProfile(blast.parameters.benchHeight || 6.0, burden);
  const criticalUnderburdenCount = faceProfile.filter((p) => p.isCriticalUnderburden).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/30">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFrench ? 'Simulateur d’Amorçage 3D & Profil de Front' : '3D Blast Initiation Simulator & Face Profiler'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                Isochrones & PPV
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFrench
                ? 'Simulation de la séquence de tir milliseconde par milliseconde et prédiction des vibrations (USBM)'
                : 'Millisecond delay propagation simulator, dynamic burden relief, and USBM vibration modeling'}
            </p>
          </div>
        </div>

        {/* Pattern Selector & Report Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <select
            value={patternType}
            onChange={(e) => setPatternType(e.target.value as any)}
            className="bg-slate-100 text-slate-800 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold"
          >
            <option value="v_echelon">{isFrench ? 'Tir en V (V-Echelon)' : 'V-Echelon Cut'}</option>
            <option value="row_by_row">{isFrench ? 'Ligne par Ligne' : 'Row-by-Row'}</option>
            <option value="diagonal_cut">{isFrench ? 'Tir Diagonal (Angle)' : 'Diagonal Corner Cut'}</option>
            <option value="center_lift">{isFrench ? 'Soulèvement Central' : 'Center Lift'}</option>
            <option value="electronic_custom">{isFrench ? 'Électronique Séquentiel (8ms)' : 'Electronic (8ms Sequential)'}</option>
          </select>

          <SendToReportButton
            sectionKey="timing"
            project={project}
            site={site}
            blast={blast}
            lang={lang}
            getPayload={() => ({
              patternType,
              surfaceDelayMs,
              inHoleDelayMs,
              totalDurationMs: holes.length > 0 ? Math.max(...holes.map((h) => h.firingTimeMs)) : 0,
              holeDiameterMm: dia,
              maxChargePerDelayKg: chargeKg,
              distanceToStructureM,
              estimatedPPVMmS: ppvEstimate.estimatedPPVMmS,
              safeLimitMmS: ppvEstimate.safeLimitMmS,
              isCompliant: ppvEstimate.isCompliant,
              criticalUnderburdenCount,
              totalHoles: holes.length,
            })}
            summaryFr={`Chronogramme 3D (${patternType}, ${surfaceDelayMs}/${inHoleDelayMs}ms) : VPP prédite ${ppvEstimate.estimatedPPVMmS} mm/s à ${distanceToStructureM}m (limite ${ppvEstimate.safeLimitMmS} mm/s, ${ppvEstimate.isCompliant ? 'conforme' : 'attention'}).`}
            summaryEn={`3D Timing simulation (${patternType}, ${surfaceDelayMs}/${inHoleDelayMs}ms): predicted PPV ${ppvEstimate.estimatedPPVMmS} mm/s at ${distanceToStructureM}m (${ppvEstimate.isCompliant ? 'compliant' : 'warning'}).`}
          />
        </div>
      </div>

      {/* Main Grid: Left Timing Canvas & Scrubber, Right Vibration & Face Profiler */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Canvas Simulator */}
        <div className="lg:col-span-8 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              {isFrench ? 'Plan de Foration & Propagation des Ondes' : 'Detonation Wavefront Propagation'}
            </span>
            <span className="font-black text-white text-sm bg-slate-800 px-2.5 py-1 rounded-lg">
              {currentTimeMs} ms / {maxDurationMs} ms
            </span>
          </div>

          <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            <canvas
              ref={canvasRef}
              width={750}
              height={450}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Scrubber & Playback Controls */}
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition shadow font-bold"
              title="Play / Pause"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentTimeMs(0);
              }}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={0}
              max={maxDurationMs}
              value={currentTimeMs}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTimeMs(parseInt(e.target.value));
              }}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Delay Tuners */}
          <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800 text-slate-300">
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                {isFrench ? 'Raccord de Surface (ms) :' : 'Surface Delay (ms):'}
              </label>
              <input
                type="number"
                value={surfaceDelayMs}
                onChange={(e) => setSurfaceDelayMs(parseInt(e.target.value) || 25)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                {isFrench ? 'Détonateur de Fond (ms) :' : 'In-Hole Detonator (ms):'}
              </label>
              <input
                type="number"
                value={inHoleDelayMs}
                onChange={(e) => setInHoleDelayMs(parseInt(e.target.value) || 400)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
              />
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): PPV Vibration & Face Profiler */}
        <div className="lg:col-span-4 space-y-4">
          {/* USBM Ground Vibration Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2">
              <Waves className="w-4 h-4 text-blue-600" />
              <span>{isFrench ? 'Vibrations du Sol (USBM PPV)' : 'Ground Vibration (USBM PPV)'}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {isFrench ? 'Distance aux Bâtiments (m) :' : 'Distance to Sensitive Structure (m):'}
              </label>
              <input
                type="number"
                value={distanceToStructureM}
                onChange={(e) => setDistanceToStructureM(parseFloat(e.target.value) || 100)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              ppvEstimate.isCompliant ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">{isFrench ? 'PPV Estimée' : 'Estimated PPV'}</span>
                <span className={`text-xl font-black ${ppvEstimate.isCompliant ? 'text-emerald-700' : 'text-red-700'}`}>
                  {ppvEstimate.estimatedPPVMmS} mm/s
                </span>
                <span className="text-[10px] text-slate-500 block">{isFrench ? 'Limite :' : 'Limit:'} {ppvEstimate.safeLimitMmS} mm/s</span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                ppvEstimate.isCompliant ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
              }`}>
                {ppvEstimate.isCompliant ? (isFrench ? 'CONFORME' : 'PASS') : (isFrench ? 'RISQUE' : 'EXCEEDED')}
              </span>
            </div>
          </div>

          {/* 3D Bench Face Profiler Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>{isFrench ? 'Profileur de Front & Risque Flyrock' : 'Face Profiler & Flyrock Hazard'}</span>
            </div>

            {criticalUnderburdenCount > 0 && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <span>
                  {isFrench
                    ? `Attention : ${criticalUnderburdenCount} zone(s) de sous-fardeau critique (< 1,8m) propices aux projections (flyrock).`
                    : `Warning: ${criticalUnderburdenCount} critical underburden zones (< 1.8m) causing hazardous flyrock.`}
                </span>
              </div>
            )}

            <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs pr-1">
              {faceProfile.map((pt, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg flex justify-between items-center text-[11px] ${
                    pt.isCriticalUnderburden ? 'bg-red-50 font-bold text-red-900' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{isFrench ? 'Profondeur :' : 'Depth:'} {pt.depthM} m</span>
                  <span>{isFrench ? 'Fardeau Réel :' : 'Actual Burden:'} {pt.actualBurdenM} m {pt.isCriticalUnderburden && '⚠️'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
