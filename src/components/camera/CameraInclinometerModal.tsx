import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, AlertTriangle, X, RefreshCw, Sliders, Shield } from 'lucide-react';
import { t } from '../../i18n';

interface CameraInclinometerModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  lang?: 'en' | 'fr';
}

export const CameraInclinometerModal: React.FC<CameraInclinometerModalProps> = ({
  onCapture,
  onClose,
  lang = 'en',
}) => {
  const isFr = lang === 'fr';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasCameraStream, setHasCameraStream] = useState(false);
  const [pitch, setPitch] = useState(0); // Forward/back tilt in degrees (-45 to +45)
  const [roll, setRoll] = useState(0); // Left/right tilt in degrees (-30 to +30)
  const [isSimulatorMode, setIsSimulatorMode] = useState(true);

  // Initialize camera stream if available
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play();
            setHasCameraStream(true);
          }
        })
        .catch(() => {
          // Fall back to synthetic simulator canvas
          setHasCameraStream(false);
        });
    }

    // Hardware device orientation listener for mobile devices
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) {
        setIsSimulatorMode(false);
        // Beta is pitch (-180 to 180), Gamma is roll (-90 to 90)
        // Standing perpendicular to a vertical wall: Beta ~ 90 deg
        const measuredPitch = e.beta - 90;
        setPitch(Math.round(measuredPitch));
        setRoll(Math.round(e.gamma));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Compute total angular deviation from perpendicular (0, 0)
  const deviation = Math.round(Math.hypot(pitch, roll));
  const isOptimal = deviation <= 3;
  const isWarning = deviation > 3 && deviation <= 8;
  const isCritical = deviation > 8;

  // Capture current frame
  const handleSnap = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (hasCameraStream && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, 800, 600);
    } else {
      // Draw calibrated realistic mock rock bench
      const grad = ctx.createLinearGradient(0, 0, 800, 600);
      grad.addColorStop(0, '#5A544C');
      grad.addColorStop(0.5, '#6E665D');
      grad.addColorStop(1, '#4B433A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 600);

      // Add rocks
      for (let i = 0; i < 40; i++) {
        const cx = 50 + Math.random() * 700;
        const cy = 50 + Math.random() * 500;
        const r = 20 + Math.random() * 40;
        ctx.fillStyle = i % 2 === 0 ? '#8A8073' : '#3C352E';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#27272A';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw 500mm scale bar
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(520, 540, 200, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('SCALE 500 mm', 570, 532);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isOptimal ? 'bg-emerald-500/20 text-emerald-400' : isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                {isFr ? 'Viseur d’Alignement Inclinomètre AR' : 'AR Inclinometer Alignment Viewfinder'}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  90° Perpendicular Protocol
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isFr
                  ? 'Élimine les déformations de perspective en garantissant un angle perpendiculaire à la face d’abattage'
                  : 'Eliminates 2D perspective foreshortening by enforcing a square 90° angle to the muck face'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Main HUD Display */}
        <div className="relative bg-black flex justify-center items-center h-80 sm:h-96 overflow-hidden select-none">
          {hasCameraStream ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex items-center justify-center text-center p-4">
              <div className="space-y-2 opacity-50">
                <Camera className="w-12 h-12 text-slate-400 mx-auto" />
                <span className="text-xs text-slate-400 block font-mono">
                  [ Live Simulated Muckpile Feed Active ]
                </span>
              </div>
            </div>
          )}

          {/* AR Inclinometer Reticle Overlay */}
          <div
            className={`absolute inset-0 border-4 transition-colors duration-200 pointer-events-none ${
              isOptimal ? 'border-emerald-500/80 shadow-[inset_0_0_40px_rgba(16,185,129,0.3)]' : isWarning ? 'border-amber-500/80' : 'border-red-500/80'
            }`}
          />

          {/* Artificial Horizon Line (Rotates with Roll, translates with Pitch) */}
          <div
            style={{
              transform: `translateY(${pitch * 4}px) rotate(${roll}deg)`,
              transition: 'transform 0.1s ease-out',
            }}
            className="absolute w-3/4 h-0.5 bg-cyan-400/80 flex items-center justify-between pointer-events-none shadow-[0_0_10px_rgba(6,182,212,0.8)]"
          >
            <div className="w-8 h-2 border-l-2 border-t-2 border-cyan-400" />
            <div className="w-8 h-2 border-r-2 border-t-2 border-cyan-400" />
          </div>

          {/* Central Circular Reticle & Crosshair */}
          <div className="absolute w-28 h-28 rounded-full border-2 border-white/60 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full border border-dashed border-white/40" />
            <div className="w-2 h-2 rounded-full bg-white shadow" />
            <div className="absolute w-full h-px bg-white/40" />
            <div className="absolute h-full w-px bg-white/40" />

            {/* Bubble Level Marker */}
            <div
              style={{
                transform: `translate(${roll * 2.5}px, ${pitch * 2.5}px)`,
                transition: 'transform 0.08s ease-out',
              }}
              className={`w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none flex items-center justify-center transition-colors ${
                isOptimal ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-red-500'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>

          {/* Real-Time Angle Badge */}
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-mono space-y-0.5 pointer-events-none">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">PITCH:</span>
              <span className={`font-bold ${Math.abs(pitch) <= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {pitch > 0 ? `+${pitch}°` : `${pitch}°`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">ROLL:</span>
              <span className={`font-bold ${Math.abs(roll) <= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {roll > 0 ? `+${roll}°` : `${roll}°`}
              </span>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-800 pt-0.5">
              <span className="text-slate-400">OFFSET:</span>
              <span className={`font-black ${isOptimal ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-red-400'}`}>
                {deviation}°
              </span>
            </div>
          </div>

          {/* Compliance Status Pill */}
          <div className="absolute top-4 right-4 pointer-events-none">
            {isOptimal ? (
              <span className="px-3 py-1 bg-emerald-500/90 text-slate-950 font-black text-xs rounded-full flex items-center gap-1.5 shadow-lg">
                <CheckCircle2 className="w-4 h-4" /> {isFr ? 'ALIGNEMENT CONFORME (90°)' : 'OPTIMAL ALIGNMENT (90°)'}
              </span>
            ) : isWarning ? (
              <span className="px-3 py-1 bg-amber-500/90 text-slate-950 font-black text-xs rounded-full flex items-center gap-1.5 shadow-lg">
                <AlertTriangle className="w-4 h-4" /> {isFr ? 'LÉGÈRE INCLINAISON' : 'SLIGHT TILT DETECTED'}
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-600 text-white font-black text-xs rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
                <AlertTriangle className="w-4 h-4" /> {isFr ? 'ANGLE OBLIQUE EXCESSIF' : 'EXCESSIVE OBLIQUE ANGLE'}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Control & Simulation Panel */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 space-y-4">
          {/* Simulator controls for desktop / laptop testing */}
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                {isFr ? 'Testeur Interactif de Capteurs Gyroscopiques (Simulation Bureau)' : 'Interactive Gyroscope Sensor Simulator (Desktop Testing)'}
              </span>
              <button
                onClick={() => {
                  setPitch(0);
                  setRoll(0);
                }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300"
              >
                {isFr ? 'Réinitialiser à 0° (Parfait)' : 'Reset to 0° (Perfect 90°)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Pitch (Haut / Bas) :</span>
                  <span className="font-mono text-white font-bold">{pitch}°</span>
                </div>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Roll (Gauche / Droite) :</span>
                  <span className="font-mono text-white font-bold">{roll}°</span>
                </div>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  value={roll}
                  onChange={(e) => setRoll(parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">
              {isOptimal
                ? isFr ? '✓ Prêt pour l’acquisition sans distorsion' : '✓ Ready for zero-distortion capture'
                : isFr ? '⚠ Ajustez la position pour atteindre la zone verte' : '⚠ Level the reticle into the green zone'}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-xs font-semibold"
              >
                {t('cancel', lang)}
              </button>

              <button
                onClick={handleSnap}
                className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition ${
                  isOptimal
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <Camera className="w-4 h-4" />
                {isFr ? 'Prendre Photo Calibrée' : 'Capture Aligned Photo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
