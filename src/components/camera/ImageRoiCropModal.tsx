import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Point2D } from '../../types';
import {
  Crop,
  Square,
  Shapes,
  Ban,
  RotateCcw,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Scissors,
  Layers,
  HelpCircle,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';

interface ImageRoiCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  initialRoiPolygon?: Point2D[];
  initialExclusionPolygons?: Point2D[][];
  onSave: (roiPolygon?: Point2D[], exclusionPolygons?: Point2D[][]) => void;
  onClose: () => void;
  lang?: 'en' | 'fr';
}

type RoiMode = 'rect' | 'polygon' | 'exclude';

export const ImageRoiCropModal: React.FC<ImageRoiCropModalProps> = ({
  isOpen,
  imageSrc,
  initialRoiPolygon,
  initialExclusionPolygons,
  onSave,
  onClose,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  // Mode: rect (rectangular bounding box), polygon (custom contour), exclude (masking non-rock zones)
  const [activeMode, setActiveMode] = useState<RoiMode>('rect');

  // ROI polygon in natural image coords
  const [roiPolygon, setRoiPolygon] = useState<Point2D[]>(
    initialRoiPolygon && initialRoiPolygon.length >= 3 ? initialRoiPolygon : []
  );

  // Exclusion polygons list in natural image coords
  const [exclusionPolygons, setExclusionPolygons] = useState<Point2D[][]>(
    initialExclusionPolygons || []
  );

  // Drawing state for in-progress polygon / rect
  const [drawingPoints, setDrawingPoints] = useState<Point2D[]>([]);
  const [activeRectDrag, setActiveRectDrag] = useState<{ start: Point2D; current: Point2D } | null>(null);

  // Handle active vertex dragging
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);

  // Zoom & Pan
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  // Load Image
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageObjRef.current = img;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      // If no ROI provided, default to full image box
      if (!initialRoiPolygon || initialRoiPolygon.length < 3) {
        // Default to whole image or comfortable 95% margin
        setRoiPolygon([
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ]);
      } else {
        setRoiPolygon(initialRoiPolygon);
      }

      setExclusionPolygons(initialExclusionPolygons || []);
      setZoomLevel(1.0);
      setPanOffset({ x: 0, y: 0 });
    };
  }, [isOpen, imageSrc, initialRoiPolygon, initialExclusionPolygons]);

  // Convert natural image point to screen canvas point
  const toScreen = useCallback(
    (pt: Point2D): Point2D => {
      const container = containerRef.current;
      const img = imageObjRef.current;
      if (!container || !img) return { x: 0, y: 0 };

      const cWidth = container.clientWidth || 800;
      const cHeight = container.clientHeight || 540;

      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      const fitRatio = Math.min((cWidth - 40) / imgW, (cHeight - 40) / imgH);

      const drawW = imgW * fitRatio * zoomLevel;
      const drawH = imgH * fitRatio * zoomLevel;

      const originX = (cWidth - drawW) / 2 + panOffset.x;
      const originY = (cHeight - drawH) / 2 + panOffset.y;

      return {
        x: originX + (pt.x / imgW) * drawW,
        y: originY + (pt.y / imgH) * drawH,
      };
    },
    [zoomLevel, panOffset]
  );

  // Convert screen coordinate to natural image point
  const screenToImage = (clientX: number, clientY: number): Point2D | null => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return null;

    const rect = canvas.getBoundingClientRect();
    const cWidth = canvas.width;
    const cHeight = canvas.height;

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const fitRatio = Math.min((cWidth - 40) / imgW, (cHeight - 40) / imgH);

    const drawW = imgW * fitRatio * zoomLevel;
    const drawH = imgH * fitRatio * zoomLevel;

    const originX = (cWidth - drawW) / 2 + panOffset.x;
    const originY = (cHeight - drawH) / 2 + panOffset.y;

    const screenX = (clientX - rect.left) * (cWidth / (rect.width || cWidth));
    const screenY = (clientY - rect.top) * (cHeight / (rect.height || cHeight));

    const relX = screenX - originX;
    const relY = screenY - originY;

    const naturalX = (relX / drawW) * imgW;
    const naturalY = (relY / drawH) * imgH;

    return {
      x: Math.round(Math.max(0, Math.min(imgW, naturalX))),
      y: Math.round(Math.max(0, Math.min(imgH, naturalY))),
    };
  };

  // Compute Area percentage of ROI
  const computeRoiAreaPercentage = (): number => {
    const img = imageObjRef.current;
    if (!img || roiPolygon.length < 3) return 100;

    let areaPx = 0;
    for (let i = 0; i < roiPolygon.length; i++) {
      const next = (i + 1) % roiPolygon.length;
      areaPx += roiPolygon[i].x * roiPolygon[next].y - roiPolygon[next].x * roiPolygon[i].y;
    }
    areaPx = Math.abs(areaPx) / 2;

    const totalArea = img.naturalWidth * img.naturalHeight;
    return totalArea > 0 ? Number(((areaPx / totalArea) * 100).toFixed(1)) : 100;
  };

  // Render Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const cWidth = container.clientWidth || 800;
    const cHeight = container.clientHeight || 540;

    canvas.width = cWidth;
    canvas.height = cHeight;

    ctx.clearRect(0, 0, cWidth, cHeight);
    ctx.save();

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const fitRatio = Math.min((cWidth - 40) / imgW, (cHeight - 40) / imgH);

    const drawW = imgW * fitRatio * zoomLevel;
    const drawH = imgH * fitRatio * zoomLevel;

    const originX = (cWidth - drawW) / 2 + panOffset.x;
    const originY = (cHeight - drawH) / 2 + panOffset.y;

    // 1. Draw base image
    ctx.drawImage(img, originX, originY, drawW, drawH);

    // 2. Dim entire canvas outside the selected ROI
    if (roiPolygon.length >= 3) {
      ctx.save();
      // Draw dark semi-transparent scrim across the whole image
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';

      // Use even-odd fill rule to cut out the ROI hole
      ctx.beginPath();
      // Outer full image box
      ctx.rect(originX, originY, drawW, drawH);

      // Inner polygon hole (winding opposite direction)
      const p0 = toScreen(roiPolygon[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < roiPolygon.length; i++) {
        const pt = toScreen(roiPolygon[i]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();

      // 3. Draw bright ROI outline
      ctx.save();
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#10B981'; // Emerald Green
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < roiPolygon.length; i++) {
        const pt = toScreen(roiPolygon[i]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Draw vertex handles for ROI
      for (let i = 0; i < roiPolygon.length; i++) {
        const pt = toScreen(roiPolygon[i]);
        ctx.fillStyle = '#10B981';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 4. Draw Active Dragging Rect (if currently dragging a box)
    if (activeRectDrag) {
      const sStart = toScreen(activeRectDrag.start);
      const sCurr = toScreen(activeRectDrag.current);
      const rx = Math.min(sStart.x, sCurr.x);
      const ry = Math.min(sStart.y, sCurr.y);
      const rw = Math.abs(sCurr.x - sStart.x);
      const rh = Math.abs(sCurr.y - sStart.y);

      ctx.save();
      ctx.strokeStyle = activeMode === 'exclude' ? '#EF4444' : '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.fillStyle = activeMode === 'exclude' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.20)';
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Exclusion Polygons (Red zones - non-rock objects)
    for (const ep of exclusionPolygons) {
      if (ep.length < 3) continue;
      ctx.save();
      const ep0 = toScreen(ep[0]);
      ctx.beginPath();
      ctx.moveTo(ep0.x, ep0.y);
      for (let i = 1; i < ep.length; i++) {
        const pt = toScreen(ep[i]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      // Red tint fill
      ctx.fillStyle = 'rgba(239, 68, 68, 0.40)';
      ctx.fill();

      // Red dashed border
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // Centroid exclusion badge
      const cX = ep.reduce((acc, p) => acc + p.x, 0) / ep.length;
      const cY = ep.reduce((acc, p) => acc + p.y, 0) / ep.length;
      const sCenter = toScreen({ x: cX, y: cY });

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isFrench ? '🚫 Exclu' : '🚫 Excluded', sCenter.x, sCenter.y);
      ctx.restore();
    }

    // 6. Draw in-progress polygon points
    if (drawingPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = activeMode === 'exclude' ? '#EF4444' : '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const dp0 = toScreen(drawingPoints[0]);
      ctx.moveTo(dp0.x, dp0.y);
      for (let i = 1; i < drawingPoints.length; i++) {
        const pt = toScreen(drawingPoints[i]);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      for (const p of drawingPoints) {
        const sp = toScreen(p);
        ctx.fillStyle = '#38BDF8';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [
    roiPolygon,
    exclusionPolygons,
    drawingPoints,
    activeRectDrag,
    zoomLevel,
    panOffset,
    activeMode,
    isFrench,
    toScreen,
  ]);

  // Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const naturalPt = screenToImage(e.clientX, e.clientY);
    if (!naturalPt) return;

    if (activeMode === 'rect' || activeMode === 'exclude') {
      setActiveRectDrag({ start: naturalPt, current: naturalPt });
    } else if (activeMode === 'polygon') {
      // Add point to drawing polygon
      setDrawingPoints((prev) => [...prev, naturalPt]);
    }
  };

  // Canvas Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const naturalPt = screenToImage(e.clientX, e.clientY);
    if (!naturalPt) return;

    if (activeRectDrag) {
      setActiveRectDrag((prev) => (prev ? { ...prev, current: naturalPt } : null));
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (activeRectDrag) {
      const p1 = activeRectDrag.start;
      const p2 = activeRectDrag.current;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      // Only accept if rect has meaningful size (> 20px)
      if (maxX - minX > 20 && maxY - minY > 20) {
        const rectPoly = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ];

        if (activeMode === 'rect') {
          setRoiPolygon(rectPoly);
        } else if (activeMode === 'exclude') {
          setExclusionPolygons((prev) => [...prev, rectPoly]);
        }
      }
      setActiveRectDrag(null);
    }
  };

  // Double click to close active polygon
  const handleDoubleClick = () => {
    if (activeMode === 'polygon' && drawingPoints.length >= 3) {
      setRoiPolygon(drawingPoints);
      setDrawingPoints([]);
      setActiveMode('rect');
    }
  };

  // Preset: Crop Top Sky / Bench Horizon (Cuts top 28% off automatically)
  const handlePresetCropSky = () => {
    const img = imageObjRef.current;
    if (!img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Cut off top 28% (sky / bench face) and bottom 2%
    setRoiPolygon([
      { x: 0, y: Math.round(h * 0.28) },
      { x: w, y: Math.round(h * 0.28) },
      { x: w, y: Math.round(h * 0.98) },
      { x: 0, y: Math.round(h * 0.98) },
    ]);
  };

  // Preset: Full image (reset)
  const handleResetFullImage = () => {
    const img = imageObjRef.current;
    if (!img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    setRoiPolygon([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ]);
    setDrawingPoints([]);
  };

  // Clear all exclusion masks
  const handleClearExclusions = () => {
    setExclusionPolygons([]);
  };

  // Save & Apply
  const handleApply = () => {
    onSave(roiPolygon, exclusionPolygons);
    onClose();
  };

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  if (!isOpen) return null;

  const roiPercent = computeRoiAreaPercentage();

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>{isFrench ? 'Délimiter la Zone de Roches (ROI & Recadrage)' : 'Muckpile Rock Boundary & Crop Area (ROI)'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                  {isFrench ? `${roiPercent}% conservé` : `${roiPercent}% retained`}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? 'Découpez les zones sans roches (ciel, pelleteuse, camions, pistes, parois) pour concentrer l’analyse uniquement sur les fragments.'
                  : 'Cut out areas with no rocks (sky, haul trucks, excavator, pit wall, floor) to isolate pure rock fragments.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
            title={isFrench ? 'Fermer' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left Control Modes, Right Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Tools & Presets (4 cols) */}
          <div className="lg:col-span-4 p-4 border-r border-slate-800 bg-slate-950/60 flex flex-col gap-4 overflow-y-auto">
            {/* Tool Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isFrench ? 'Outils de Délimitation' : 'Boundary Tools'}
              </label>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('rect');
                    setDrawingPoints([]);
                  }}
                  className={`p-3 rounded-xl border transition text-left flex items-start gap-3 ${
                    activeMode === 'rect'
                      ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-xs'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Square className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold">{isFrench ? 'Boîte Rectangulaire (Recommandé)' : 'Rectangular Box (Fast)'}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isFrench
                        ? 'Glissez un rectangle sur le tas de roche pour exclure le ciel et le sol d’un seul geste.'
                        : 'Drag a box over the muckpile to cut out sky and pit floor in one motion.'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('polygon');
                    setDrawingPoints([]);
                  }}
                  className={`p-3 rounded-xl border transition text-left flex items-start gap-3 ${
                    activeMode === 'polygon'
                      ? 'bg-blue-600/25 border-blue-500 text-white shadow-xs'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Shapes className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold">{isFrench ? 'Polygone Libre (Contours Irréguliers)' : 'Freeform Polygon'}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isFrench
                        ? 'Cliquez pour placer des points autour du tas. Double-cliquez pour fermer le polygone.'
                        : 'Click points around complex muckpile contours. Double-click to close.'}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('exclude');
                    setDrawingPoints([]);
                  }}
                  className={`p-3 rounded-xl border transition text-left flex items-start gap-3 ${
                    activeMode === 'exclude'
                      ? 'bg-red-600/25 border-red-500 text-white shadow-xs'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Ban className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{isFrench ? 'Masquer des Éléments (Exclusion)' : 'Mask Non-Rock Objects'}</span>
                      {exclusionPolygons.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-900 text-red-200">
                          {exclusionPolygons.length}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isFrench
                        ? 'Glissez un rectangle sur un godet d’engin, une chaussure ou une flaque pour l’ignorer.'
                        : 'Draw a box over excavator bucket, safety boots, cables or water to ignore them.'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Action Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {isFrench ? 'Raccourcis Préréglés' : 'Quick Presets'}
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePresetCropSky}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isFrench ? 'Couper le Ciel' : 'Crop Sky'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetFullImage}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isFrench ? 'Pleine Image' : 'Full Image'}</span>
                </button>
              </div>

              {exclusionPolygons.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearExclusions}
                  className="w-full p-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-xl border border-red-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>{isFrench ? 'Effacer tous les masques d’exclusion' : 'Clear all exclusion masks'}</span>
                </button>
              )}
            </div>

            {/* Quality Advice */}
            <div className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-1.5 text-xs">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{isFrench ? 'Impact sur la Granulométrie' : 'Impact on Fragmentation'}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isFrench
                  ? 'Exclure les surfaces lisses évite la création artificielle de faux gros blocs (> 1000 mm) et recalibre fidèlement les courbes P50 et P80.'
                  : 'Excluding smooth terrain prevents false huge boulders (> 1000 mm) and accurately restores P50 and P80 percentiles.'}
              </p>
            </div>
          </div>

          {/* Right Column: Canvas Viewport (8 cols) */}
          <div className="lg:col-span-8 p-3 flex flex-col gap-2 bg-slate-950 relative overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  {isFrench ? 'Zone de roches (verte)' : 'Rock Area (green)'}
                </span>

                {exclusionPolygons.length > 0 && (
                  <span className="font-bold text-red-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    {isFrench ? `${exclusionPolygons.length} zone(s) exclue(s)` : `${exclusionPolygons.length} excluded`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(4.0, z + 0.25))}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(1.0);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
              </div>
            </div>

            {/* Interactive Canvas Container */}
            <div
              ref={containerRef}
              className="relative flex-1 min-h-[420px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden cursor-crosshair flex items-center justify-center select-none"
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
                className="w-full h-full object-contain"
              />

              {activeMode === 'polygon' && drawingPoints.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-blue-500 text-blue-300 text-xs px-3 py-1.5 rounded-lg shadow-lg">
                  {isFrench
                    ? `${drawingPoints.length} points placés. Double-cliquez pour terminer le polygone.`
                    : `${drawingPoints.length} points placed. Double-click to close polygon.`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800/90 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="font-extrabold text-emerald-400">{roiPercent}%</span>
            <span>
              {isFrench
                ? `de l'image conservé pour l'analyse granulométrique`
                : `of image area selected for rock fragmentation`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition"
            >
              {isFrench ? 'Annuler' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isFrench ? 'Appliquer la zone & Analyser' : 'Apply Area & Analyze'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
