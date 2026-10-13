import React, { useState, useRef, useEffect } from 'react';
import type { Fragment, Point2D, Calibration } from '../../types';
import { computeConvexHull, computeFeretDiameters } from '../../services/imageProcessing';
import { t } from '../../i18n';
import {
  PlusCircle,
  Trash2,
  GitMerge,
  Scissors,
  Paintbrush,
  Undo2,
  Redo2,
  Save,
  Check,
} from 'lucide-react';

interface ManualEditorProps {
  imageSrc: string;
  initialFragments: Fragment[];
  calibration: Calibration;
  onSaveNewVersion: (updatedFragments: Fragment[]) => void;
  onClose: () => void;
  lang?: 'en' | 'fr';
}

type EditTool = 'select' | 'add' | 'delete' | 'merge' | 'split' | 'fines';

export const ManualEditor: React.FC<ManualEditorProps> = ({
  imageSrc,
  initialFragments,
  calibration,
  onSaveNewVersion,
  onClose,
  lang = 'en',
}) => {
  const [fragments, setFragments] = useState<Fragment[]>(initialFragments);
  const [history, setHistory] = useState<Fragment[][]>([initialFragments]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [selectedFragIds, setSelectedFragIds] = useState<number[]>([]);
  const [drawingPoly, setDrawingPoly] = useState<Point2D[]>([]);
  const [splitLine, setSplitLine] = useState<{ start: Point2D; end: Point2D } | null>(null);
  const [opacity, setOpacity] = useState(0.4);
  const [showOutlines, setShowOutlines] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const pxPerMm = calibration.pxPerMm || 0.5;

  // Push state to history
  const pushState = (newFrags: Fragment[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newFrags);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setFragments(newFrags);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFragments(history[historyIndex - 1]);
      setSelectedFragIds([]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFragments(history[historyIndex + 1]);
      setSelectedFragIds([]);
    }
  };

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageObjRef.current = img;
      renderCanvas();
    };
  }, [imageSrc]);

  // Re-render canvas whenever fragments or tool changes
  useEffect(() => {
    renderCanvas();
  }, [fragments, selectedFragIds, drawingPoly, splitLine, opacity, showOutlines]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObjRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageObjRef.current;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    // Draw background image
    ctx.drawImage(img, 0, 0);

    // Draw fragments
    const colors = ['#2E75B6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i];
      const isSelected = selectedFragIds.includes(f.id);

      ctx.beginPath();
      if (f.polygon.length > 0) {
        ctx.moveTo(f.polygon[0].x, f.polygon[0].y);
        for (let v = 1; v < f.polygon.length; v++) {
          ctx.lineTo(f.polygon[v].x, f.polygon[v].y);
        }
        ctx.closePath();

        // Fill
        if (f.isFines) {
          ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`; // Red for unresolved fines
        } else if (isSelected) {
          ctx.fillStyle = `rgba(234, 179, 8, ${opacity + 0.25})`; // Yellow highlight
        } else {
          const col = colors[i % colors.length];
          ctx.fillStyle = col + Math.round(opacity * 255).toString(16).padStart(2, '0');
        }
        ctx.fill();

        // Stroke
        if (showOutlines || isSelected) {
          ctx.strokeStyle = isSelected ? '#EAB308' : '#FFFFFF';
          ctx.lineWidth = isSelected ? 3 : 1.2;
          ctx.stroke();
        }

        // Draw fragment ID & size in center
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.fillText(`${f.minFeretMm}mm`, f.centroid.x - 14, f.centroid.y);
        ctx.shadowBlur = 0;
      }
    }

    // Draw current drawing polygon (Add tool)
    if (drawingPoly.length > 0) {
      ctx.beginPath();
      ctx.moveTo(drawingPoly[0].x, drawingPoly[0].y);
      for (let v = 1; v < drawingPoly.length; v++) {
        ctx.lineTo(drawingPoly[v].x, drawingPoly[v].y);
      }
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      for (const p of drawingPoly) {
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw split line
    if (splitLine) {
      ctx.beginPath();
      ctx.moveTo(splitLine.start.x, splitLine.start.y);
      ctx.lineTo(splitLine.end.x, splitLine.end.y);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  // Canvas click / mouse events
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (activeTool === 'select') {
      const clicked = findFragmentAt(x, y);
      if (clicked) {
        setSelectedFragIds([clicked.id]);
      } else {
        setSelectedFragIds([]);
      }
    } else if (activeTool === 'add') {
      setDrawingPoly((prev) => [...prev, { x, y }]);
    } else if (activeTool === 'delete') {
      const clicked = findFragmentAt(x, y);
      if (clicked) {
        const next = fragments.filter((f) => f.id !== clicked.id);
        pushState(next);
      }
    } else if (activeTool === 'merge') {
      const clicked = findFragmentAt(x, y);
      if (clicked) {
        if (selectedFragIds.length === 0) {
          setSelectedFragIds([clicked.id]);
        } else if (selectedFragIds.length === 1 && selectedFragIds[0] !== clicked.id) {
          // Merge two fragments
          const f1 = fragments.find((f) => f.id === selectedFragIds[0])!;
          const f2 = clicked;
          const mergedPoints = [...f1.polygon, ...f2.polygon];
          const hull = computeConvexHull(mergedPoints);
          const areaMm2 = (f1.areaMm2 + f2.areaMm2) * 1.05;
          const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
          const { minFeretMm, maxFeretMm } = computeFeretDiameters(hull, pxPerMm);

          const merged: Fragment = {
            id: f1.id,
            polygon: hull,
            centroid: {
              x: Math.round((f1.centroid.x + f2.centroid.x) / 2),
              y: Math.round((f1.centroid.y + f2.centroid.y) / 2),
            },
            areaPx: f1.areaPx + f2.areaPx,
            areaMm2: Math.round(areaMm2),
            ecdMm: Number(ecdMm.toFixed(1)),
            minFeretMm,
            maxFeretMm,
            bboxWidthMm: maxFeretMm,
            bboxHeightMm: minFeretMm,
            aspectRatio: Number((maxFeretMm / Math.max(1, minFeretMm)).toFixed(2)),
            solidity: 0.9,
            volumeMm3: Math.round((Math.PI / 6) * Math.pow(minFeretMm, 3)),
            confidence: 0.95,
          };

          const next = fragments.filter((f) => f.id !== f1.id && f.id !== f2.id).concat(merged);
          pushState(next);
          setSelectedFragIds([]);
        }
      }
    } else if (activeTool === 'split') {
      if (!splitLine) {
        setSplitLine({ start: { x, y }, end: { x, y } });
      } else {
        // Complete cut
        const clicked = findFragmentAt(x, y);
        if (clicked) {
          // Bisect fragment into two parts
          const pLeft = clicked.polygon.filter((p) => p.x < x);
          const pRight = clicked.polygon.filter((p) => p.x >= x);
          if (pLeft.length >= 3 && pRight.length >= 3) {
            const hLeft = computeConvexHull(pLeft);
            const hRight = computeConvexHull(pRight);
            const areaL = clicked.areaMm2 * 0.48;
            const areaR = clicked.areaMm2 * 0.48;
            const fL = computeFeretDiameters(hLeft, pxPerMm);
            const fR = computeFeretDiameters(hRight, pxPerMm);

            const fragL: Fragment = {
              ...clicked,
              id: clicked.id,
              polygon: hLeft,
              areaMm2: Math.round(areaL),
              ecdMm: Number((2 * Math.sqrt(areaL / Math.PI)).toFixed(1)),
              minFeretMm: fL.minFeretMm,
              maxFeretMm: fL.maxFeretMm,
            };
            const fragR: Fragment = {
              ...clicked,
              id: Math.max(...fragments.map((f) => f.id)) + 1,
              polygon: hRight,
              centroid: { x: x + 15, y },
              areaMm2: Math.round(areaR),
              ecdMm: Number((2 * Math.sqrt(areaR / Math.PI)).toFixed(1)),
              minFeretMm: fR.minFeretMm,
              maxFeretMm: fR.maxFeretMm,
            };

            const next = fragments.filter((f) => f.id !== clicked.id).concat(fragL, fragR);
            pushState(next);
          }
        }
        setSplitLine(null);
      }
    } else if (activeTool === 'fines') {
      const clicked = findFragmentAt(x, y);
      if (clicked) {
        const next = fragments.map((f) => (f.id === clicked.id ? { ...f, isFines: !f.isFines } : f));
        pushState(next);
      }
    }
  };

  const handleFinishAddPolygon = () => {
    if (drawingPoly.length >= 3) {
      const hull = computeConvexHull(drawingPoly);
      let areaPx = 0;
      for (let i = 0; i < hull.length; i++) {
        const next = (i + 1) % hull.length;
        areaPx += hull[i].x * hull[next].y - hull[next].x * hull[i].y;
      }
      areaPx = Math.abs(areaPx) / 2;

      const areaMm2 = areaPx / (pxPerMm * pxPerMm);
      const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
      const { minFeretMm, maxFeretMm } = computeFeretDiameters(hull, pxPerMm);

      let cx = 0;
      let cy = 0;
      for (const p of hull) {
        cx += p.x;
        cy += p.y;
      }
      cx = Math.round(cx / hull.length);
      cy = Math.round(cy / hull.length);

      const newFrag: Fragment = {
        id: Math.max(0, ...fragments.map((f) => f.id)) + 1,
        polygon: hull,
        centroid: { x: cx, y: cy },
        areaPx: Math.round(areaPx),
        areaMm2: Math.round(areaMm2),
        ecdMm: Number(ecdMm.toFixed(1)),
        minFeretMm,
        maxFeretMm,
        bboxWidthMm: maxFeretMm,
        bboxHeightMm: minFeretMm,
        aspectRatio: Number((maxFeretMm / Math.max(1, minFeretMm)).toFixed(2)),
        solidity: 0.95,
        volumeMm3: Math.round((Math.PI / 6) * Math.pow(minFeretMm, 3)),
        confidence: 1.0,
      };

      pushState([...fragments, newFrag]);
    }
    setDrawingPoly([]);
  };

  const findFragmentAt = (x: number, y: number): Fragment | undefined => {
    // Simple point in polygon or nearest centroid
    for (const f of fragments) {
      if (Math.hypot(f.centroid.x - x, f.centroid.y - y) < Math.max(20, (f.minFeretMm * pxPerMm) / 2)) {
        return f;
      }
    }
    return undefined;
  };

  return (
    <div className="flex flex-col bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden border border-slate-700">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-slate-800 border-b border-slate-700 gap-2">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              setActiveTool('select');
              setDrawingPoly([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'select' ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {lang === 'fr' ? 'Sélectionner' : 'Select'}
          </button>
          <button
            onClick={() => {
              setActiveTool('add');
              setSelectedFragIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'add' ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t('addFragment', lang)}
          </button>
          <button
            onClick={() => {
              setActiveTool('delete');
              setDrawingPoly([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'delete' ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('deleteFragment', lang)}
          </button>
          <button
            onClick={() => {
              setActiveTool('merge');
              setDrawingPoly([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'merge' ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            {t('mergeFragments', lang)}
          </button>
          <button
            onClick={() => {
              setActiveTool('split');
              setDrawingPoly([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'split' ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            {t('splitFragment', lang)}
          </button>
          <button
            onClick={() => {
              setActiveTool('fines');
              setDrawingPoly([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'fines' ? 'bg-rose-700 text-white' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            {t('paintFines', lang)}
          </button>
        </div>

        {/* Undo / Redo & View Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
            title={t('undo', lang)}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
            title={t('redo', lang)}
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-600 mx-1" />

          <label className="text-xs text-slate-300 flex items-center gap-1">
            {t('opacity', lang)}
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-16 accent-blue-500"
            />
          </label>

          <button
            onClick={() => setShowOutlines(!showOutlines)}
            className={`px-2 py-1 text-xs rounded ${showOutlines ? 'bg-blue-600 text-white' : 'bg-slate-700'}`}
          >
            {t('outlines', lang)}
          </button>
        </div>

        {/* Save & Action */}
        <div className="flex items-center space-x-2">
          {activeTool === 'add' && drawingPoly.length >= 3 && (
            <button
              onClick={handleFinishAddPolygon}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold flex items-center gap-1 text-white animate-pulse"
            >
              <Check className="w-3.5 h-3.5" />
              {t('completeRock', lang)} ({drawingPoly.length} pts)
            </button>
          )}
          <button
            onClick={() => onSaveNewVersion(fragments)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold flex items-center gap-1 text-white"
          >
            <Save className="w-3.5 h-3.5" />
            {t('saveRunVersion', lang)}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300"
          >
            {t('close', lang)}
          </button>
        </div>
      </div>

      {/* Interactive Canvas Viewport */}
      <div className="relative overflow-auto max-h-[650px] bg-black flex justify-center items-center p-2">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          className="cursor-crosshair max-w-full h-auto border border-slate-700 rounded shadow"
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-xs text-slate-400 border-t border-slate-700">
        <div>
          {lang === 'fr' ? 'Outil :' : 'Tool:'} <span className="font-bold text-white uppercase">{activeTool}</span> | {t('totalRocks', lang)}{' '}
          <span className="font-bold text-white">{fragments.length}</span>
          {selectedFragIds.length > 0 && ` | ${t('selected', lang)} #${selectedFragIds.join(', ')}`}
        </div>
        <div>
          {lang === 'fr' ? 'Échelle :' : 'Scale:'} {calibration.pxPerMm?.toFixed(3)} px/mm | {lang === 'fr' ? 'Modifications non destructives (enregistré comme nouvelle version)' : 'Edits are non-destructive (saves as a new run version)'}
        </div>
      </div>
    </div>
  );
};
