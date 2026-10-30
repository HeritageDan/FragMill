import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Blast } from '../../types';
import type { HoleTimingInfo } from '../../types/advanced';
import {
  generatePatternTiming,
  computeIsochroneContours,
  calculateUSBMPPV,
  estimateBlastFrequencySpectrum,
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
    if (blast.drillHoles && blast.drillHoles.length > 0) {
      // Group holes by rowNumber to determine column order along the bench face
      const rowMap = new Map<number, typeof blast.drillHoles>();
      blast.drillHoles.forEach((dh) => {
        const r = dh.rowNumber || 1;
        if (!rowMap.has(r)) rowMap.set(r, []);
        rowMap.get(r)!.push(dh);
      });

      // Sort holes in each row along Easting
      rowMap.forEach((holesInRow) => {
        holesInRow.sort((a, b) => a.eastingX - b.eastingX);
      });

      const totalRows = rowMap.size || 1;

      const timingHoles: HoleTimingInfo[] = blast.drillHoles.map((h, idx) => {
        const r = (h.rowNumber || 1) - 1;
        const holesInSameRow = rowMap.get(h.rowNumber || 1) || [];
        const c = Math.max(0, holesInSameRow.findIndex((dh) => dh.holeId === h.holeId));
        const numColsInRow = Math.max(1, holesInSameRow.length);

        let firingTimeMs = 0;

        if (patternType === 'v_echelon') {
          const midCol = (numColsInRow - 1) / 2;
          const colDistance = Math.abs(c - midCol);
          firingTimeMs = inHoleDelayMs + r * (surfaceDelayMs * 1.6) + colDistance * surfaceDelayMs;
        } else if (patternType === 'row_by_row') {
          firingTimeMs = inHoleDelayMs + r * (surfaceDelayMs * 2.0) + c * (surfaceDelayMs * 0.4);
        } else if (patternType === 'diagonal_cut') {
          firingTimeMs = inHoleDelayMs + (r + c) * surfaceDelayMs;
        } else if (patternType === 'center_lift') {
          const midR = (totalRows - 1) / 2;
          const midC = (numColsInRow - 1) / 2;
          const dist = Math.hypot(r - midR, c - midC);
          firingTimeMs = inHoleDelayMs + dist * surfaceDelayMs * 1.5;
        } else {
          // electronic_custom: prioritize detonator delay from Excel if positive, else 8ms sequential
          if (h.detonatorDelayMs !== undefined && h.detonatorDelayMs > 0) {
            firingTimeMs = h.detonatorDelayMs;
          } else {
            firingTimeMs = inHoleDelayMs + idx * 8;
          }
        }

        return {
          holeIndex: idx + 1,
          holeId: h.holeId || `BH-${idx + 1}`,
          row: r,
          col: c,
          x: h.eastingX,
          y: h.northingY,
          surfaceDelayMs: surfaceDelayMs,
          inHoleDelayMs: inHoleDelayMs,
          firingTimeMs: Math.round(firingTimeMs),
          chargeKg: h.totalChargeKg || chargeKg,
          burdenM: h.burdenM || burden,
          spacingM: h.spacingM || spacing,
          faceDistanceM: (r + 1) * (h.burdenM || burden),
          state: 'ready',
          isWet: h.isWet || (h.waterDepthM !== undefined && h.waterDepthM > 0),
          waterDepthM: h.waterDepthM || 0,
          hasCavityOrFault: h.hasCavityOrFault || false,
        };
      });

      setHoles(timingHoles);
      setCurrentTimeMs(0);
      return;
    }

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
  }, [blast.drillHoles, rows, cols, burden, spacing, chargeKg, patternType, surfaceDelayMs, inHoleDelayMs]);

  const maxDurationMs = holes.length > 0 ? Math.max(...holes.map((h) => h.firingTimeMs)) + 30 : 600;

  // Pre-calculate isochrone contour lines on pattern update to guarantee smooth 60fps playback
  const isochrones = useMemo(() => computeIsochroneContours(holes, 30), [holes]);

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

    // Bounding box for accurate spatial mapping without distortion
    const minX = Math.min(...holes.map((h) => h.x));
    const maxX = Math.max(...holes.map((h) => h.x));
    const minY = Math.min(...holes.map((h) => h.y));
    const maxY = Math.max(...holes.map((h) => h.y));
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    const padX = 65;
    const padY = 70;
    const availW = width - padX * 2;
    const availH = height - padY * 2;

    // Uniform aspect ratio scale
    const scale = Math.min(availW / spanX, availH / spanY);
    const offsetX = padX + (availW - spanX * scale) / 2;
    const offsetY = padY + (availH - spanY * scale) / 2;

    // Determine row 0 vs other rows to align row 0 closest to free face at top
    const row0Holes = holes.filter((h) => h.row === 0);
    const otherHoles = holes.filter((h) => h.row > 0);
    const avgRow0Y = row0Holes.length > 0 ? row0Holes.reduce((s, h) => s + h.y, 0) / row0Holes.length : minY;
    const avgOtherY = otherHoles.length > 0 ? otherHoles.reduce((s, h) => s + h.y, 0) / otherHoles.length : maxY;
    const row0IsLowerY = avgRow0Y <= avgOtherY;

    const toCanvasX = (x: number) => offsetX + (x - minX) * scale;
    const toCanvasY = (y: number) => row0IsLowerY
      ? offsetY + (y - minY) * scale
      : offsetY + (maxY - y) * scale;

    // Isochrones (using pre-memoized contour geometry)
    isochrones.forEach((iso) => {
      if (iso.timeMs <= currentTimeMs) {
        ctx.strokeStyle = `${iso.color}55`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        iso.points.forEach((pt, idx) => {
          const px = toCanvasX(pt.x);
          const py = toCanvasY(pt.y);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      }
    });

    // Draw holes
    holes.forEach((h) => {
      const px = toCanvasX(h.x);
      const py = toCanvasY(h.y);

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
      ctx.fillStyle = hasFired ? '#ef4444' : h.isWet ? '#0284c7' : '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = hasFired ? '#fbbf24' : h.isWet ? '#38bdf8' : '#93c5fd';
      ctx.lineWidth = h.isWet ? 2.5 : 2;
      ctx.stroke();

      // If wet hole, draw central water droplet / dot
      if (h.isWet && !hasFired) {
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#67e8f9';
        ctx.fill();
      }

      // Hole ID and time
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px sans-serif';
      const label = h.holeId ? h.holeId : `#${h.holeIndex}`;
      ctx.fillText(label, px - 12, py - 14);

      ctx.fillStyle = hasFired ? '#fca5a5' : '#e2e8f0';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`${h.firingTimeMs}ms`, px - 14, py + 22);
    });
  }, [holes, currentTimeMs, rows, cols, burden, spacing, isFrench, isochrones]);

  const ppvEstimate = calculateUSBMPPV(distanceToStructureM, chargeKg);
  const freqSpec = useMemo(
    () => estimateBlastFrequencySpectrum(distanceToStructureM, chargeKg, ppvEstimate.estimatedPPVMmS),
    [distanceToStructureM, chargeKg, ppvEstimate.estimatedPPVMmS]
  );
  const actualBenchHeight = blast.drillHoles && blast.drillHoles.length > 0
    ? Math.max(...blast.drillHoles.map((h) => h.depthM)) - (blast.drillHoles[0]?.subdrillM || 0)
    : (blast.parameters.benchHeight || 10.0);
  const avgBurden = blast.drillHoles && blast.drillHoles.length > 0
    ? blast.drillHoles.reduce((acc, h) => acc + (h.burdenM || burden), 0) / blast.drillHoles.length
    : burden;
  const faceProfile = generateFaceProfile(actualBenchHeight, avgBurden);
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

          {/* OSMRE 816.67 Frequency Spectrum Compliance Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <Activity className="w-4 h-4 text-purple-600" />
                <span>{isFrench ? 'Spectre Fréquentiel (OSMRE 816.67)' : '1/3-Octave Frequency (OSMRE)'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                freqSpec.isCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
              }`}>
                {freqSpec.isCompliant ? (isFrench ? 'CONFORME' : 'COMPLIANT') : (isFrench ? 'HORS LIMITE' : 'EXCEEDED')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-purple-50/60 p-2 rounded-lg border border-purple-100">
                <span className="text-[10px] text-purple-700 block font-semibold">{isFrench ? 'Fréq. Dominante' : 'Dominant Freq.'}</span>
                <span className="text-base font-black text-purple-950">{freqSpec.dominantFrequencyHz} Hz</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block font-semibold">{isFrench ? 'Bande Réglementaire' : 'OSMRE Band'}</span>
                <span className="text-base font-bold text-slate-800">{freqSpec.osmreFrequencyBand}</span>
              </div>
              <div className={`p-2 rounded-lg border ${
                freqSpec.complianceMarginPercent >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <span className="text-[10px] block font-semibold">{isFrench ? 'Marge Sécurité' : 'Safety Margin'}</span>
                <span className="text-base font-black">
                  {freqSpec.complianceMarginPercent >= 0 ? `+${freqSpec.complianceMarginPercent}%` : `${freqSpec.complianceMarginPercent}%`}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">
                {isFrench ? 'Vérification par Bandes d’Octaves (DIN/OSMRE) :' : '1/3-Octave Band Checks (DIN/OSMRE):'}
              </span>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                {freqSpec.spectrumBands.slice(1, 7).map((band) => (
                  <div
                    key={band.bandHz}
                    className={`p-1.5 rounded text-center border ${
                      band.pass
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-red-50 border-red-200 text-red-800 font-bold'
                    }`}
                  >
                    <span className="font-semibold block">{band.bandHz}</span>
                    <span>{band.estimatedPPVMmS} mm/s</span>
                  </div>
                ))}
              </div>
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
