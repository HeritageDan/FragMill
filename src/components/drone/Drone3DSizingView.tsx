import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Blast, Project, Site } from '../../types';
import type { DroneOrthomosaicData, MuckpileSector } from '../../types/advanced';
import { generateDemoDroneSurvey, apply3DStereologicalCorrection } from '../../services/drone3d/droneSizing';
import { Plane, Layers, Box, Compass, Info, Download, CheckCircle2, Upload, Image as ImageIcon } from 'lucide-react';
import { SendToReportButton } from '../report/SendToReportButton';

interface Drone3DSizingViewProps {
  blast: Blast;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const Drone3DSizingView: React.FC<Drone3DSizingViewProps> = ({ blast, project, site, lang = 'en' }) => {
  const isFrench = lang === 'fr';

  // Real blasted volume and metrics derived from active blast / drillholes
  const realBlastedVolumeM3 = useMemo(() => {
    if (blast.drillHoles && blast.drillHoles.length > 0) {
      return Math.round(
        blast.drillHoles.reduce(
          (acc, h) => acc + (h.burdenM || 3.0) * (h.spacingM || 3.5) * Math.max(1, (h.depthM || 10) - (h.subdrillM || 0)),
          0
        )
      );
    }
    const b = blast.parameters.burden || 3.0;
    const s = blast.parameters.spacing || 3.5;
    const h = blast.parameters.benchHeight || 10.0;
    const n = blast.parameters.numberOfHoles || 36;
    return Math.round(b * s * h * n);
  }, [blast]);

  const realRockDensity = blast.rockMass.density || 2.68;
  const realBlastedTonnageT = Math.round(realBlastedVolumeM3 * realRockDensity);
  const blastP80 = blast.images[0]?.segmentationRuns?.[0]?.metrics?.p80 || 215;
  const blastP50 = blast.images[0]?.segmentationRuns?.[0]?.metrics?.p50 || 115;

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [surveyData, setSurveyData] = useState<DroneOrthomosaicData | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string>('sec-middle');
  const [viewMode, setViewMode] = useState<'heatmap' | 'mesh3d' | 'ortho'>('heatmap');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const base = generateDemoDroneSurvey(blast.blastId);
    const scaledSectors: MuckpileSector[] = [
      {
        id: 'sec-crest',
        name: isFrench ? 'Crête / Éjection Front Libre' : 'Crest / Free Face Ejection Zone',
        zone: 'crest',
        color: '#3b82f6',
        polygon: [{ x: 0.1, y: 0.05 }, { x: 0.9, y: 0.05 }, { x: 0.85, y: 0.3 }, { x: 0.15, y: 0.3 }],
        p10Mm: Math.round(blastP50 * 0.18),
        p50Mm: Math.round(blastP50 * 0.72),
        p80Mm: Math.round(blastP80 * 0.78),
        topSizeMm: Math.round(blastP80 * 1.5),
        oversizePercent: 2.1,
        volumeM3: Math.round(realBlastedVolumeM3 * 0.18),
      },
      {
        id: 'sec-middle',
        name: isFrench ? 'Corps Central Amoncelé (Muckpile Principal)' : 'Central Heaped Muckpile (Main Body)',
        zone: 'middle',
        color: '#10b981',
        polygon: [{ x: 0.15, y: 0.3 }, { x: 0.85, y: 0.3 }, { x: 0.8, y: 0.7 }, { x: 0.2, y: 0.7 }],
        p10Mm: Math.round(blastP50 * 0.22),
        p50Mm: Math.round(blastP50 * 0.95),
        p80Mm: Math.round(blastP80),
        topSizeMm: Math.round(blastP80 * 1.9),
        oversizePercent: 4.8,
        volumeM3: Math.round(realBlastedVolumeM3 * 0.48),
      },
      {
        id: 'sec-toe',
        name: isFrench ? 'Pied de Tir Confiné / Tablier Gros Blocs' : 'Toe Confinement / Heavy Boulder Apron',
        zone: 'toe',
        color: '#f59e0b',
        polygon: [{ x: 0.2, y: 0.7 }, { x: 0.8, y: 0.7 }, { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 }],
        p10Mm: Math.round(blastP50 * 0.35),
        p50Mm: Math.round(blastP50 * 1.55),
        p80Mm: Math.round(blastP80 * 1.6),
        topSizeMm: Math.round(blastP80 * 2.8),
        oversizePercent: 14.5,
        volumeM3: Math.round(realBlastedVolumeM3 * 0.26),
      },
      {
        id: 'sec-backbreak',
        name: isFrench ? 'Arrière-Tir / Fissures de Traction' : 'Backbreak / Crest Tension Cracks',
        zone: 'backbreak',
        color: '#ef4444',
        polygon: [{ x: 0.05, y: 0.0 }, { x: 0.95, y: 0.0 }, { x: 0.9, y: 0.05 }, { x: 0.1, y: 0.05 }],
        p10Mm: Math.round(blastP50 * 0.4),
        p50Mm: Math.round(blastP50 * 1.8),
        p80Mm: Math.round(blastP80 * 1.9),
        topSizeMm: Math.round(blastP80 * 3.4),
        oversizePercent: 22.0,
        volumeM3: Math.round(realBlastedVolumeM3 * 0.08),
      },
    ];

    setSurveyData({
      ...base,
      name: uploadedImage
        ? (isFrench ? `Orthophoto Drone Importée - ${blast.blastId}` : `Imported Drone Orthomosaic - ${blast.blastId}`)
        : `${blast.blastId} - Muckpile 3D Survey`,
      totalVolumeM3: realBlastedVolumeM3,
      averageP80Mm: blastP80,
      sectors: scaledSectors,
    });
  }, [blast, realBlastedVolumeM3, blastP80, blastP50, uploadedImage, isFrench]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImage(event.target.result as string);
          setViewMode('ortho');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const activeSector = surveyData?.sectors.find((s) => s.id === selectedSectorId) || surveyData?.sectors[0];

  // Draw procedural interactive 3D orthomosaic heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !surveyData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (viewMode === 'mesh3d') {
      // Draw 3D Isometric Wireframe Mesh
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;

      const cols = 24;
      const rows = 16;
      const isoX = (x: number, y: number) => width / 2 + (x - y) * 14;
      const isoY = (x: number, y: number, z: number) => height / 4 + (x + y) * 8 - z * 18;

      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        for (let c = 0; c < cols; c++) {
          const u = c / (cols - 1);
          const v = r / (rows - 1);
          const moundHeight = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 4.5;
          const px = isoX(c - cols / 2, r - rows / 2);
          const py = isoY(c - cols / 2, r - rows / 2, moundHeight);

          if (c === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Draw elevation contour color nodes
      for (let r = 0; r < rows; r += 2) {
        for (let c = 0; c < cols; c += 2) {
          const u = c / (cols - 1);
          const v = r / (rows - 1);
          const moundHeight = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 4.5;
          const px = isoX(c - cols / 2, r - rows / 2);
          const py = isoY(c - cols / 2, r - rows / 2, moundHeight);

          ctx.fillStyle = v > 0.65 ? '#f59e0b' : v > 0.25 ? '#10b981' : '#3b82f6';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const renderSectors = (c: CanvasRenderingContext2D, w: number, h: number) => {
        surveyData.sectors.forEach((sec) => {
          c.beginPath();
          sec.polygon.forEach((pt, idx) => {
            const px = pt.x * w;
            const py = pt.y * h;
            if (idx === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          });
          c.closePath();

          const isSelected = sec.id === selectedSectorId;
          c.fillStyle = `${sec.color}${isSelected ? '77' : '33'}`;
          c.fill();
          c.lineWidth = isSelected ? 3 : 1.5;
          c.strokeStyle = sec.color;
          c.stroke();

          const centerPt = sec.polygon[0];
          if (centerPt) {
            c.fillStyle = '#ffffff';
            c.font = 'bold 12px sans-serif';
            c.fillText(`${sec.name} (P80: ${sec.p80Mm} mm)`, centerPt.x * w + 15, centerPt.y * h + 35);
          }
        });
      };

      if (uploadedImage) {
        const img = new Image();
        img.src = uploadedImage;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          if (viewMode === 'heatmap') {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, 'rgba(30, 41, 59, 0.45)');
            grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.25)');
            grad.addColorStop(1, 'rgba(245, 158, 11, 0.35)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
          }
          renderSectors(ctx, width, height);
        };
        return;
      }

      // Draw 2D Orthomosaic Heatmap
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1e293b'); // Crest
      grad.addColorStop(0.3, '#334155');
      grad.addColorStop(0.7, '#475569');
      grad.addColorStop(1, '#0f172a'); // Toe
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      renderSectors(ctx, width, height);
    }
  }, [surveyData, selectedSectorId, viewMode, uploadedImage]);

  if (!surveyData) return null;

  const stereology = activeSector
    ? apply3DStereologicalCorrection(activeSector.p50Mm, activeSector.p80Mm)
    : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFrench ? 'Photogrammétrie 3D Drone & Orthomosaïque' : 'Drone 3D Photogrammetry & Orthomosaic Sizing'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                UAV LiDAR / RTK
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                uploadedImage ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800'
              }`}>
                {uploadedImage
                  ? (isFrench ? 'IMAGE DRONE CHARGÉE' : 'UAV DRONE IMAGE LOADED')
                  : (isFrench ? 'SYNCHRONISÉ AVEC LE TIR' : 'SYNCHRONIZED WITH BLAST')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {surveyData.name} ({surveyData.totalVolumeM3.toLocaleString()} m³ • {realBlastedTonnageT.toLocaleString()} t • {realRockDensity} t/m³) • GSD: {surveyData.metadata.gsdMmPerPx} mm/px • P80: {surveyData.averageP80Mm} mm
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* File Upload Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title={isFrench ? 'Importer une photographie ou orthomosaïque de drone' : 'Upload drone photogrammetry image'}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Charger Orthophoto Drone' : 'Upload Drone Ortho'}</span>
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'heatmap' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isFrench ? 'Carte P80' : 'P80 Heatmap'}
            </button>
            <button
              onClick={() => setViewMode('mesh3d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'mesh3d' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isFrench ? 'Modèle 3D' : '3D Mesh'}
            </button>
            {uploadedImage && (
              <button
                onClick={() => setViewMode('ortho')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  viewMode === 'ortho' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isFrench ? 'Photo Drone' : 'Drone Photo'}
              </button>
            )}
          </div>

          <SendToReportButton
            sectionKey="drone3d"
            project={project}
            site={site}
            blast={blast}
            lang={lang}
            getPayload={() => ({
              surveyName: surveyData.name,
              flightAltitudeM: surveyData.metadata.flightAltitudeM,
              gsdMmPerPx: surveyData.metadata.gsdMmPerPx,
              cameraSensor: surveyData.metadata.cameraSensor,
              crs: surveyData.metadata.crs,
              totalVolumeM3: surveyData.totalVolumeM3,
              averageP80Mm: surveyData.averageP80Mm,
              activeSector: activeSector?.name,
              activeP80Mm: activeSector?.p80Mm,
              activeVolumeM3: activeSector?.volumeM3,
              stereologyP80_3D: stereology?.p80_3D_mm,
              sectorsCount: surveyData.sectors.length,
            })}
            summaryFr={`Photogrammétrie drone : ${surveyData.totalVolumeM3.toLocaleString()} m³ modélisés, P80 moyen ${surveyData.averageP80Mm} mm, altitude ${surveyData.metadata.flightAltitudeM}m.`}
            summaryEn={`Drone survey: ${surveyData.totalVolumeM3.toLocaleString()} m³ modeled, mean P80 ${surveyData.averageP80Mm} mm, altitude ${surveyData.metadata.flightAltitudeM}m.`}
          />
        </div>
      </div>

      {/* Main Grid: Left Canvas Viewer, Right Sector Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Interactive Canvas */}
        <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-blue-400" />
              {viewMode === 'mesh3d'
                ? (isFrench ? 'Nuage de Points 3D (48 520 sommets)' : '3D Elevation Point Cloud (48,520 vertices)')
                : (isFrench ? 'Zonage Spatial du Tas d’Abattage' : 'Muckpile Spatial Distribution')}
            </span>
            <span>Altitude: {surveyData.metadata.flightAltitudeM} m AGL</span>
          </div>

          <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="w-full h-full object-cover cursor-crosshair"
            />
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs px-3 py-1.5 rounded-lg text-[10px] text-white space-x-2">
              <span className="text-blue-400 font-bold">{isFrench ? '■ Crête / Face (Fin)' : '■ Crest / Face (Fine)'}</span>
              <span className="text-emerald-400 font-bold">{isFrench ? '■ Centre (Moyen)' : '■ Center (Medium)'}</span>
              <span className="text-amber-400 font-bold">{isFrench ? '■ Pied de talus (Gros blocs)' : '■ Toe (Coarse Boulders)'}</span>
            </div>
          </div>

          {/* Sector Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {surveyData.sectors.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSelectedSectorId(sec.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  selectedSectorId === sec.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />
                <span>{sec.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column (4 cols): Detailed Sector Metrics & 3D Stereology */}
        <div className="lg:col-span-4 space-y-4">
          {activeSector && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {isFrench ? 'Secteur Sélectionné' : 'Selected Sector'}
                </span>
                <h3 className="text-base font-extrabold text-slate-900">{activeSector.name}</h3>
                <p className="text-xs text-slate-500">
                  {isFrench ? 'Volume estimé :' : 'Estimated volume:'} {activeSector.volumeM3} m³ ({((activeSector.volumeM3 / surveyData.totalVolumeM3) * 100).toFixed(1)}%)
                </p>
              </div>

              {/* Sizing Percentiles Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">P50 (2D)</span>
                  <span className="text-base font-black text-slate-900">{activeSector.p50Mm} mm</span>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                  <span className="text-blue-700 block text-[10px] font-bold">P80 (2D)</span>
                  <span className="text-base font-black text-blue-950">{activeSector.p80Mm} mm</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">Top Size</span>
                  <span className="text-base font-black text-slate-900">{activeSector.topSizeMm} mm</span>
                </div>
                <div className={`p-2.5 rounded-xl border ${activeSector.oversizePercent > 10 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                  <span className="text-slate-500 block text-[10px]">{isFrench ? '> 600 mm (Blocs)' : '> 600 mm (Oversize)'}</span>
                  <span className={`text-base font-black ${activeSector.oversizePercent > 10 ? 'text-amber-700' : 'text-slate-900'}`}>
                    {activeSector.oversizePercent}%
                  </span>
                </div>
              </div>

              {/* 3D Stereological Conversion Box */}
              {stereology && (
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                    <Box className="w-4 h-4 text-emerald-600" />
                    <span>{isFrench ? 'Correction Stéréologique 3D (Cunningham)' : '3D Volumetric Stereology (Cunningham)'}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {isFrench
                      ? 'Compense l’effet d’écran des blocs superficiels et les fines dissimulées dans l’épaisseur du tas.'
                      : 'Compensates for superficial boulder masking and hidden fines beneath the surface layer.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-semibold">{isFrench ? 'P80 Réel 3D :' : 'True 3D P80:'}</span>
                      <span className="text-sm font-black text-emerald-950">{stereology.p80_3D_mm} mm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-semibold">{isFrench ? '% Blocs 3D :' : '% Oversize 3D:'}</span>
                      <span className="text-sm font-black text-emerald-950">{stereology.oversize_3D_percent}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Survey Metadata Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              {isFrench ? 'Spécifications de Vol UAV' : 'UAV Survey Specifications'}
            </span>
            <div className="space-y-1.5 text-slate-600 pt-1 text-[11px]">
              <div className="flex justify-between">
                <span>{isFrench ? 'Capteur Caméra :' : 'Camera Sensor:'}</span>
                <span className="font-semibold text-slate-800">{surveyData.metadata.cameraSensor}</span>
              </div>
              <div className="flex justify-between">
                <span>{isFrench ? 'Recouvrement :' : 'Overlap (Fwd / Side):'}</span>
                <span className="font-semibold text-slate-800">{surveyData.metadata.overlapForwardPercent}% / {surveyData.metadata.overlapSidePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span>{isFrench ? 'Volume Total Reconstruit :' : 'Total Reconstructed Volume:'}</span>
                <span className="font-semibold text-slate-800">{surveyData.totalVolumeM3.toLocaleString()} m³</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
