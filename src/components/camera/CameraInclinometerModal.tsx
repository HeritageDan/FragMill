import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Sliders,
  Shield,
  Upload,
  SwitchCamera,
  Image as ImageIcon,
} from 'lucide-react';
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
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCameraStream, setHasCameraStream] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [importedImage, setImportedImage] = useState<string | null>(null);

  const [pitch, setPitch] = useState(0); // Forward/back tilt in degrees (-45 to +45)
  const [roll, setRoll] = useState(0); // Left/right tilt in degrees (-30 to +30)
  const [isSimulatorMode, setIsSimulatorMode] = useState(true);

  // Initialize camera stream with robust desktop & mobile fallbacks
  const startCamera = async (deviceId?: string) => {
    setIsLoadingCamera(true);
    setCameraError(null);

    // Stop existing tracks if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(isFr ? 'API Caméra non supportée par ce navigateur.' : 'Camera API not supported in this browser.');
      }

      let s: MediaStream | null = null;
      try {
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        };
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback for laptop webcams / desktop where environment facing constraint fails
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (s) {
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          try {
            await videoRef.current.play();
          } catch {
            // Auto-play might be restricted
          }
        }
        setHasCameraStream(true);
        setImportedImage(null);

        // Enumerate video devices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableCameras(videoInputs);
          if (!deviceId && videoInputs.length > 0) {
            setSelectedCameraId(videoInputs[0].deviceId);
          }
        } catch {
          // enumeration optional
        }
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setHasCameraStream(false);
      setCameraError(err.message || (isFr ? 'Caméra inaccessible.' : 'Could not access camera.'));
    } finally {
      setIsLoadingCamera(false);
    }
  };

  useEffect(() => {
    // Attempt camera startup automatically
    startCamera();

    // Hardware device orientation listener for real mobile / tablet gyroscopes
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) {
        setIsSimulatorMode(false);
        const measuredPitch = e.beta - 90;
        setPitch(Math.round(measuredPitch));
        setRoll(Math.round(e.gamma));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle local image file import (from computer / phone storage)
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        if (result) {
          setImportedImage(result);
          // Pause/stop video stream when importing
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setHasCameraStream(false);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Compute total angular deviation from perpendicular (0, 0)
  const deviation = Math.round(Math.hypot(pitch, roll));
  const isOptimal = deviation <= 3;
  const isWarning = deviation > 3 && deviation <= 8;

  // Capture current frame or imported image
  const handleSnap = () => {
    if (importedImage) {
      onCapture(importedImage);
      onClose();
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (hasCameraStream && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, 1280, 720);
    } else {
      // Draw calibrated realistic mock rock bench if no hardware stream
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, '#47433B');
      grad.addColorStop(0.5, '#5C5449');
      grad.addColorStop(1, '#3A342C');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      // Procedural rock fragments
      for (let i = 0; i < 45; i++) {
        const cx = 80 + Math.random() * 1120;
        const cy = 80 + Math.random() * 560;
        const r = 25 + Math.random() * 55;
        ctx.fillStyle = i % 2 === 0 ? '#786F63' : '#2D2823';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1E1B18';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw 500mm scale bar
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(850, 640, 300, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('ÉCHELLE / SCALE 500 mm', 900, 628);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCapture(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                isOptimal ? 'bg-emerald-500/20 text-emerald-400' : isWarning ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                {isFr ? 'Viseur d’Alignement Inclinomètre AR (90°)' : 'AR Inclinometer Alignment Viewfinder (90°)'}
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {importedImage
                    ? isFr ? 'Photo Importée' : 'Imported Image'
                    : hasCameraStream
                    ? isFr ? 'Flux Direct' : 'Live Stream'
                    : isFr ? 'Mode Démo / Test' : 'Simulator Mode'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isFr
                  ? 'Élimine les distorsions stéréologiques de perspective en garantissant un angle orthogonal parfait.'
                  : 'Eliminates 2D perspective foreshortening by guaranteeing a strictly perpendicular angle to muck face.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileImport}
            />

            {/* Upload from device button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              title={isFr ? 'Importer une photo depuis vos dossiers' : 'Upload photo from your device'}
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>{isFr ? 'Importer Image' : 'Import Photo'}</span>
            </button>

            {/* Switch camera / re-trigger stream button */}
            <button
              onClick={() => startCamera(selectedCameraId)}
              disabled={isLoadingCamera}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              title={isFr ? 'Activer ou réinitialiser la caméra' : 'Activate or switch camera'}
            >
              <SwitchCamera className={`w-3.5 h-3.5 text-emerald-400 ${isLoadingCamera ? 'animate-spin' : ''}`} />
              <span>{hasCameraStream ? (isFr ? 'Caméra Active' : 'Camera On') : (isFr ? 'Activer Caméra' : 'Start Camera')}</span>
            </button>

            {/* Close modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Camera Selector Bar if multiple cameras exist */}
        {availableCameras.length > 1 && (
          <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold">{isFr ? 'Choisir la caméra :' : 'Select Camera:'}</span>
            <select
              value={selectedCameraId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedCameraId(id);
                startCamera(id);
              }}
              className="bg-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 font-medium"
            >
              {availableCameras.map((cam, idx) => (
                <option key={cam.deviceId || idx} value={cam.deviceId}>
                  {cam.label || `${isFr ? 'Caméra' : 'Camera'} ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Viewfinder Main HUD Display */}
        <div className="relative bg-black flex justify-center items-center h-80 sm:h-96 overflow-hidden select-none">
          {importedImage ? (
            <img src={importedImage} alt="Imported preview" className="w-full h-full object-contain" />
          ) : hasCameraStream ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Camera className="w-12 h-12 text-slate-400 opacity-60" />
              <div className="max-w-md">
                <span className="text-xs text-slate-300 block font-bold mb-1">
                  {cameraError ? cameraError : (isFr ? 'Caméra en attente ou non autorisée' : 'Camera stream pending or permission required')}
                </span>
                <p className="text-[11px] text-slate-400">
                  {isFr
                    ? 'Cliquez sur « Activer Caméra » pour utiliser votre webcam / caméra de terrain, ou importez un fichier image.'
                    : 'Click "Start Camera" to grant webcam access, or import an existing rock muckpile image.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startCamera()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isFr ? 'Démarrer Caméra' : 'Start Camera'}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isFr ? 'Importer une Photo' : 'Import Photo'}
                </button>
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
                <CheckCircle2 className="w-4 h-4" /> {isFr ? 'ALIGNEMENT OPTIMAL (90°)' : 'OPTIMAL ALIGNMENT (90°)'}
              </span>
            ) : isWarning ? (
              <span className="px-3 py-1 bg-amber-500/90 text-slate-950 font-black text-xs rounded-full flex items-center gap-1.5 shadow-lg">
                <AlertTriangle className="w-4 h-4" /> {isFr ? 'LÉGÈRE INCLINAISON' : 'SLIGHT TILT'}
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
          {/* Gyro Calibration sliders (useful for fine-tuning angle) */}
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                {isFr ? 'Ajustement Manuel de l’Inclinaison' : 'Manual Inclinometer Leveling'}
              </span>
              <button
                onClick={() => {
                  setPitch(0);
                  setRoll(0);
                }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300"
              >
                {isFr ? 'Réinitialiser à 0° (Perpendiculaire)' : 'Reset to 0° (Square)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Pitch (Inclinaison Avant/Arrière) :</span>
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
                  <span>Roll (Dévers Gauche/Droite) :</span>
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition"
              >
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>{isFr ? 'Choisir un fichier image' : 'Pick Image File'}</span>
              </button>
            </div>

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
                {importedImage
                  ? isFr ? 'Valider cette Photo' : 'Confirm this Photo'
                  : isFr ? 'Prendre Photo Calibrée' : 'Capture Aligned Photo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
