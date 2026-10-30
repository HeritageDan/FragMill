import React, { useState, useEffect, useRef } from 'react';
import type { BeltVisionConfig, RockDetection, BeltStats, CrusherChokeEvent } from '../../types/advanced';
import {
  DEFAULT_BELT_CONFIG,
  generateSimulatedBeltFrame,
  playCrusherChokeAlarmSound,
} from '../../services/beltVision/beltAnalyzer';
import {
  Video,
  AlertTriangle,
  Play,
  Square,
  Volume2,
  VolumeX,
  Gauge,
  Activity,
  ShieldAlert,
  Clock,
  Radio,
  Upload,
  RotateCcw,
  Camera,
} from 'lucide-react';
import type { Blast, Project, Site } from '../../types';
import { SendToReportButton } from '../report/SendToReportButton';
import { getBlastState } from '../../services/blastState';

interface BeltEdgeVisionViewProps {
  blast?: Blast;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const BeltEdgeVisionView: React.FC<BeltEdgeVisionViewProps> = ({ blast, project, site, lang = 'en' }) => {
  const isFrench = lang === 'fr';

  const blastState = blast ? getBlastState(blast) : null;
  const blastP50 = blastState?.optical.p50Mm || 110;
  const blastP80 = blastState?.optical.p80Mm || 220;
  const rockDensity = blast?.rockMass?.density || 2.68;
  const bulkDensity = parseFloat((rockDensity * 0.68).toFixed(2));

  const [config, setConfig] = useState<BeltVisionConfig>(() => ({
    ...DEFAULT_BELT_CONFIG,
    bulkDensityTPerM3: bulkDensity,
  }));
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [uploadedBeltImage, setUploadedBeltImage] = useState<string | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [stats, setStats] = useState<BeltStats | null>(null);
  const [chokeEvents, setChokeEvents] = useState<CrusherChokeEvent[]>([]);
  const [trendData, setTrendData] = useState<{ time: string; p50: number; p80: number; tph: number }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastSampleTime = useRef<number>(Date.now());
  const beltOffset = useRef<number>(0);
  const cachedImageRef = useRef<HTMLImageElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  const drawDetectedRocks = (
    ctx: CanvasRenderingContext2D,
    rocks: any[],
    width: number,
    height: number
  ) => {
    rocks.forEach((rock) => {
      const rx = rock.x * width;
      const ry = rock.y * height;
      const rRadius = (rock.equivalentDiameterMm / 1000) * 120;

      ctx.beginPath();
      ctx.arc(rx, ry, Math.max(6, rRadius), 0, Math.PI * 2);

      if (rock.isOversize) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = rock.isOversize ? 'bold 11px sans-serif' : '9px sans-serif';
      ctx.fillText(`${rock.equivalentDiameterMm}mm`, rx - 14, ry + 3);
    });
  };

  const handleBeltImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const imgSrc = event.target.result as string;
          setUploadedBeltImage(imgSrc);
          setIsRunning(false);
          setIsWebcamActive(false);
          if (webcamStreamRef.current) {
            webcamStreamRef.current.getTracks().forEach((t) => t.stop());
            webcamStreamRef.current = null;
          }

          const img = new Image();
          img.onload = () => {
            cachedImageRef.current = img;
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const res = generateSimulatedBeltFrame(config, blastP50, 0.25);
                drawDetectedRocks(ctx, res.rocks, canvas.width, canvas.height);
                setStats(res.stats);
              }
            }
          };
          img.src = imgSrc;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleWebcam = async () => {
    if (isWebcamActive) {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
        webcamStreamRef.current = null;
      }
      setIsWebcamActive(false);
      setIsRunning(true);
    } else {
      try {
        setUploadedBeltImage(null);
        cachedImageRef.current = null;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        webcamStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsWebcamActive(true);
        setIsRunning(true);
      } catch (err) {
        console.warn('Webcam permission denied or unavailable:', err);
        setIsWebcamActive(false);
      }
    }
  };

  useEffect(() => {
    let active = true;

    const renderLoop = () => {
      if (!active) return;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          if (isWebcamActive && videoRef.current && videoRef.current.readyState >= 2) {
            ctx.drawImage(videoRef.current, 0, 0, width, height);

            const now = Date.now();
            if (now - lastSampleTime.current >= config.samplingIntervalMs) {
              lastSampleTime.current = now;
              const res = generateSimulatedBeltFrame(config, blastP50);
              setStats(res.stats);
              drawDetectedRocks(ctx, res.rocks, width, height);

              const timeStr = new Date().toLocaleTimeString().slice(3, 8);
              setTrendData((prev) => [
                ...prev.slice(-25),
                { time: timeStr, p50: res.stats.p50Mm, p80: res.stats.p80Mm, tph: res.stats.instantTph },
              ]);

              if (res.chokeEvent) {
                setChokeEvents((prev) => [res.chokeEvent!, ...prev.slice(0, 9)]);
                if (config.alarmSoundEnabled) {
                  playCrusherChokeAlarmSound();
                }
              }
            }
          } else if (uploadedBeltImage && !isRunning) {
            if (cachedImageRef.current) {
              ctx.drawImage(cachedImageRef.current, 0, 0, width, height);
              const res = generateSimulatedBeltFrame(config, blastP50, 0.25);
              drawDetectedRocks(ctx, res.rocks, width, height);
            }
            return;
          } else if (isRunning) {
            // Animate moving conveyor belt texture
            beltOffset.current = (beltOffset.current + config.beltSpeedMPerS * 1.5) % 60;

            // Draw rubber conveyor belt background
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, width, height);

            // Draw belt chevron ribs
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3;
            for (let y = -60 + beltOffset.current; y < height + 60; y += 40) {
              ctx.beginPath();
              ctx.moveTo(width * 0.1, y);
              ctx.lineTo(width * 0.5, y + 25);
              ctx.lineTo(width * 0.9, y);
              ctx.stroke();
            }

            // Sample new frame at specified sampling interval
            const now = Date.now();
            if (now - lastSampleTime.current >= config.samplingIntervalMs) {
              lastSampleTime.current = now;
              const res = generateSimulatedBeltFrame(config, blastP50);
              setStats(res.stats);

              // Update trending history
              const timeStr = new Date().toLocaleTimeString().slice(3, 8);
              setTrendData((prev) => [
                ...prev.slice(-25),
                { time: timeStr, p50: res.stats.p50Mm, p80: res.stats.p80Mm, tph: res.stats.instantTph },
              ]);

              // If choke alarm triggered, handle alert
              if (res.chokeEvent) {
                setChokeEvents((prev) => [res.chokeEvent!, ...prev.slice(0, 9)]);
                if (config.alarmSoundEnabled) {
                  playCrusherChokeAlarmSound();
                }
              }

              // Draw rock bounding contours on belt
              drawDetectedRocks(ctx, res.rocks, width, height);
            }
          }
        }
      }

      if (isRunning || isWebcamActive) {
        animationFrameId.current = requestAnimationFrame(renderLoop);
      }
    };

    if (isRunning || isWebcamActive) {
      animationFrameId.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      active = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isRunning, isWebcamActive, config, uploadedBeltImage]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFrench ? 'Vision Edge en Continu : Convoyeur ROM & Pelles' : 'Continuous Edge Vision: Conveyor & Shovel Feed'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
                <Radio className="w-3 h-3 text-purple-600 animate-pulse" />
                Live FRAGTRACK
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                uploadedBeltImage ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-purple-100 text-purple-800'
              }`}>
                {uploadedBeltImage
                  ? (isFrench ? 'IMAGE CONVOYEUR ANALYSÉE' : 'BELT IMAGE ANALYZED')
                  : (isFrench ? 'FLUX VISION EDGE EN DIRECT' : 'EDGE-AI CAMERA STREAM')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {blast?.rockMass?.rockType || (isFrench ? 'Roche Granodiorite' : 'Granodiorite Rock')} • {rockDensity} t/m³ ({isFrench ? 'Vrac' : 'Bulk'}: {bulkDensity} t/m³) • {isFrench
                ? `Détection optique continue (${Math.round(1000 / config.samplingIntervalMs)} FPS, ${config.beltSpeedMPerS} m/s) et protection anti-bourrage du concasseur primaire`
                : `Continuous optical vision (${Math.round(1000 / config.samplingIntervalMs)} FPS, ${config.beltSpeedMPerS} m/s) & primary crusher choke prevention`}
            </p>
          </div>
        </div>

        {/* Global stream actions */}
        <div className="flex items-center gap-2">
          {/* Webcam / Live Camera Toggle */}
          <button
            onClick={handleToggleWebcam}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              isWebcamActive
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30 ring-2 ring-red-400'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title={isFrench ? 'Activer / désactiver la caméra directe (Webcam)' : 'Toggle live camera feed (Webcam)'}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isWebcamActive ? (isFrench ? 'Caméra Active' : 'Camera Active') : (isFrench ? 'Caméra Direct' : 'Live Camera')}</span>
          </button>

          {/* File Upload Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBeltImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title={isFrench ? 'Charger une photo du convoyeur pour analyse' : 'Upload conveyor image for instant analysis'}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Analyser Photo' : 'Analyze Photo'}</span>
          </button>
          {uploadedBeltImage && (
            <button
              onClick={() => {
                setUploadedBeltImage(null);
                setIsRunning(true);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
              title={isFrench ? 'Revenir au flux continu' : 'Resume live stream'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setConfig({ ...config, alarmSoundEnabled: !config.alarmSoundEnabled })}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              config.alarmSoundEnabled
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
            title="Toggle Alarm Siren"
          >
            {config.alarmSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isRunning ? (isFrench ? 'Pause Flux' : 'Pause Stream') : (isFrench ? 'Démarrer Flux' : 'Start Stream')}</span>
          </button>

          <SendToReportButton
            sectionKey="beltvision"
            project={project}
            site={site}
            blast={blast}
            lang={lang}
            getPayload={() => ({
              instantTph: stats?.instantTph || 245,
              beltUtilizationPercent: stats?.beltUtilizationPercent || 78,
              beltWidthM: config.beltWidthM,
              beltSpeedMPerS: config.beltSpeedMPerS,
              crusherGapeThresholdMm: config.crusherGapeThresholdMm,
              p20Mm: stats?.p20Mm || 42,
              p50Mm: stats?.p50Mm || 95,
              p80Mm: stats?.p80Mm || 165,
              topSizeMm: stats?.topSizeMm || 280,
              totalRocksDetected: stats?.totalRocksDetected || 1420,
              oversizeCount: stats?.oversizeCount || 2,
              chokeEventsCount: chokeEvents.length,
            })}
            summaryFr={`Vision convoyeur : débit ${stats?.instantTph || 245} t/h, P80 ${stats?.p80Mm || 165} mm, seuil blocage ${config.crusherGapeThresholdMm} mm.`}
            summaryEn={`Belt vision: throughput ${stats?.instantTph || 245} tph, P80 ${stats?.p80Mm || 165} mm, choke threshold ${config.crusherGapeThresholdMm} mm.`}
          />
        </div>
      </div>

      {/* Critical Choke Warning Alert Bar */}
      {stats?.currentAlert && (
        <div className="p-4 bg-red-600 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-red-500/20 animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-white shrink-0" />
            <div>
              <h3 className="font-black text-sm tracking-wide uppercase">
                {isFrench ? 'ALERTE : BLOC HORS-GABARIT DÉTECTÉ !' : 'CRUSHER CHOKE HAZARD: OVERSIZE BOULDER DETECTED!'}
              </h3>
              <p className="text-xs text-red-100">
                {isFrench
                  ? `Bloc de ${stats.topSizeMm} mm supérieur à l'ouverture du concasseur (${config.crusherGapeThresholdMm} mm). Arrêt d'urgence recommandé.`
                  : `Boulder size ${stats.topSizeMm} mm exceeds crusher gape (${config.crusherGapeThresholdMm} mm). Immediate stoppage recommended.`}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-white text-red-700 rounded-lg text-xs font-black uppercase">
            {stats.topSizeMm} mm
          </span>
        </div>
      )}

      {/* Main Grid: Left Video Stream Canvas, Right Metrics & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Camera Stream Viewport */}
        <div className="lg:col-span-7 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              {isFrench ? 'Flux Vidéo Convoyeur (Capteur Optique 4K)' : 'Conveyor Video Stream (4K Vision Sensor)'}
            </span>
            <span>{isFrench ? `Vitesse : ${config.beltSpeedMPerS} m/s • Larg : ${config.beltWidthM} m` : `Speed: ${config.beltSpeedMPerS} m/s • Width: ${config.beltWidthM} m`}</span>
          </div>

          <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner">
            <video ref={videoRef} className="hidden" playsInline autoPlay muted />
            <canvas
              ref={canvasRef}
              width={720}
              height={450}
              className="w-full h-full object-cover"
            />
            {/* Stream HUD Overlay */}
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[10px] text-white flex items-center gap-3">
              <span>{isFrench ? 'Roches :' : 'Rocks:'} <b className="text-blue-400">{stats?.totalRocksDetected || 0}</b></span>
              <span>{isFrench ? 'Débit :' : 'Throughput:'} <b className="text-emerald-400">{stats?.instantTph || 0} t/h</b></span>
              <span>{isFrench ? 'Charge :' : 'Load:'} <b className="text-purple-400">{stats?.beltUtilizationPercent || 0}%</b></span>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Stats & Event Log */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">{isFrench ? 'P50 Instantané' : 'Instant P50'}</span>
              <span className="text-xl font-black text-slate-900">{stats?.p50Mm || 0} mm</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{isFrench ? 'Taille médiane' : 'Median fragment'}</span>
            </div>

            <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-200 shadow-xs">
              <span className="text-blue-700 block text-[10px] font-bold uppercase">{isFrench ? 'P80 Instantané' : 'Instant P80'}</span>
              <span className="text-xl font-black text-blue-950">{stats?.p80Mm || 0} mm</span>
              <span className="text-[10px] text-blue-600 block mt-0.5">{isFrench ? 'Indice comminution' : 'Comminution cut'}</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">{isFrench ? 'Débit Actuel' : 'Instant Throughput'}</span>
              <span className="text-xl font-black text-emerald-600">{stats?.instantTph || 0} t/h</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{isFrench ? 'Alimentation usine' : 'Mill plant feed'}</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">{isFrench ? 'Taille Maximale' : 'Top Rock Size'}</span>
              <span className={`text-xl font-black ${(stats?.topSizeMm || 0) >= config.crusherGapeThresholdMm ? 'text-red-600' : 'text-slate-900'}`}>
                {stats?.topSizeMm || 0} mm
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">{isFrench ? 'Seuil :' : 'Threshold:'} {config.crusherGapeThresholdMm} mm</span>
            </div>
          </div>

          {/* Historical Trending Sparkline */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                {isFrench ? 'Tendance P80 / Débit (Dernières Minutes)' : 'Live P80 Trend Over Time'}
              </span>
              <span className="text-[10px] text-slate-400">Moving Window</span>
            </div>

            <div className="h-24 flex items-end gap-1 pt-2 border-b border-slate-100">
              {trendData.map((pt, idx) => {
                const heightPercent = Math.min(100, Math.max(15, (pt.p80 / 400) * 100));
                const isOver = pt.p80 >= config.crusherGapeThresholdMm;
                return (
                  <div
                    key={idx}
                    className="flex-1 rounded-t transition-all group relative"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: isOver ? '#ef4444' : '#3b82f6',
                    }}
                    title={`${pt.time} - P80: ${pt.p80}mm, ${pt.tph} t/h`}
                  />
                );
              })}
            </div>
          </div>

          {/* Incident Log of Oversize Boulders */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              {isFrench ? 'Journal des Événements Hors-Gabarit' : 'Oversize Boulder Incidents'}
            </span>

            {chokeEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                {isFrench ? 'Aucun bloc hors-gabarit détecté sur ce cycle.' : 'No oversize boulders detected.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 text-xs">
                {chokeEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-red-900 block text-[11px]">{evt.location}</span>
                      <span className="text-[10px] text-red-700">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <span className="font-black text-red-700 text-xs">
                      {evt.boulderSizeMm} mm
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
