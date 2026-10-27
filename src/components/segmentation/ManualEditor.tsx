import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Fragment, Point2D, Calibration } from '../../types';
import {
  computeConvexHull,
  computeFeretDiameters,
  isPointInPolygon,
  simplifyPolygonRDP,
} from '../../services/imageProcessing';
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
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Info,
  Maximize2,
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

export interface SizeTier {
  index: number;
  minMm: number;
  maxMm: number;
  label: string;
  color: string;
  count: number;
}

export const SIZE_TIER_COLORS = [
  '#06B6D4', // Cyan (Tier 1 - Fines / Very Small)
  '#3B82F6', // Blue (Tier 2 - Small)
  '#10B981', // Emerald Green (Tier 3 - Medium)
  '#F59E0B', // Amber (Tier 4 - Large)
  '#EF4444', // Crimson Red (Tier 5 - Oversize / Giant)
];

// Helper: Distance from point to line segment
function getDistanceToSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { dist: number; proj: Point2D } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { dist: Math.hypot(p.x - a.x, p.y - a.y), proj: { ...a } };
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const proj = { x: Math.round(a.x + t * dx), y: Math.round(a.y + t * dy) };
  return { dist: Math.hypot(p.x - proj.x, p.y - proj.y), proj };
}

// Helper: Recompute metrics when polygon vertices change
function updateFragmentWithPolygon(
  f: Fragment,
  poly: Point2D[],
  pxPerMm: number
): Fragment {
  const hull = computeConvexHull(poly);
  let areaPx = 0;
  for (let i = 0; i < poly.length; i++) {
    const next = (i + 1) % poly.length;
    areaPx += poly[i].x * poly[next].y - poly[next].x * poly[i].y;
  }
  areaPx = Math.abs(areaPx) / 2;

  const areaMm2 = areaPx / (pxPerMm * pxPerMm);
  const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
  const { minFeretMm, maxFeretMm } = computeFeretDiameters(hull, pxPerMm);

  let cxSum = 0;
  let cySum = 0;
  for (let i = 0; i < poly.length; i++) {
    const next = (i + 1) % poly.length;
    const cross = poly[i].x * poly[next].y - poly[next].x * poly[i].y;
    cxSum += (poly[i].x + poly[next].x) * cross;
    cySum += (poly[i].y + poly[next].y) * cross;
  }
  let cx = f.centroid.x;
  let cy = f.centroid.y;
  const signedArea2 = areaPx * 2;
  if (signedArea2 > 0) {
    cx = Math.round(cxSum / (3 * signedArea2));
    cy = Math.round(cySum / (3 * signedArea2));
  }

  const thicknessMm = Number((minFeretMm * 0.62).toFixed(1));
  const trueVolume3DMm3 = Math.round((Math.PI / 6) * maxFeretMm * minFeretMm * thicknessMm);

  return {
    ...f,
    polygon: poly,
    centroid: { x: cx, y: cy },
    areaPx: Math.round(areaPx),
    areaMm2: Math.round(areaMm2),
    ecdMm: Number(ecdMm.toFixed(1)),
    minFeretMm,
    maxFeretMm,
    bboxWidthMm: Number((maxFeretMm * 0.9).toFixed(1)),
    bboxHeightMm: Number((minFeretMm * 1.1).toFixed(1)),
    aspectRatio: Number((maxFeretMm / Math.max(1, minFeretMm)).toFixed(2)),
    thicknessMm,
    volumeMm3: Math.round((Math.PI / 6) * Math.pow(minFeretMm, 3)),
    trueVolume3DMm3,
  };
}

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
  const [activeTierFilter, setActiveTierFilter] = useState<number | null>(null);
  const [drawingPoly, setDrawingPoly] = useState<Point2D[]>([]);
  const [splitLine, setSplitLine] = useState<{ start: Point2D; end: Point2D } | null>(null);
  const [opacity, setOpacity] = useState(0.38);
  const [showOutlines, setShowOutlines] = useState(true);
  const [showBadges, setShowBadges] = useState(true);

  // Zoom state (1.0 = 100%)
  const [zoom, setZoom] = useState(1.0);
  const [imageDim, setImageDim] = useState<{ width: number; height: number } | null>(null);

  // Dragging outline state
  const [dragState, setDragState] = useState<{
    fragId: number;
    vertexIndex: number;
    isEdgeInsertion: boolean;
  } | null>(null);

  // Hover state for cursor & edge cue
  const [hoverInfo, setHoverInfo] = useState<{
    fragId: number;
    type: 'vertex' | 'edge' | 'body';
    vertexIndex?: number;
    edgeIndex?: number;
    point?: Point2D;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const pxPerMm = calibration.pxPerMm || 0.5;

  // Compute 5 adaptive rock size intervals from the current fragments
  const sizeTiers = useMemo<SizeTier[]>(() => {
    if (!fragments || fragments.length === 0) {
      return [
        { index: 0, minMm: 0, maxMm: 150, label: '< 150 mm', color: SIZE_TIER_COLORS[0], count: 0 },
        { index: 1, minMm: 150, maxMm: 300, label: '150 – 300 mm', color: SIZE_TIER_COLORS[1], count: 0 },
        { index: 2, minMm: 300, maxMm: 500, label: '300 – 500 mm', color: SIZE_TIER_COLORS[2], count: 0 },
        { index: 3, minMm: 500, maxMm: 750, label: '500 – 750 mm', color: SIZE_TIER_COLORS[3], count: 0 },
        { index: 4, minMm: 750, maxMm: Infinity, label: '> 750 mm', color: SIZE_TIER_COLORS[4], count: 0 },
      ];
    }

    const sizes = fragments.map((f) => f.minFeretMm).sort((a, b) => a - b);
    const minVal = Math.max(10, Math.floor(sizes[0] / 25) * 25);
    const maxVal = Math.ceil(sizes[sizes.length - 1] / 25) * 25;

    let t1: number, t2: number, t3: number, t4: number;

    if (maxVal - minVal >= 120) {
      const step = Math.max(25, Math.round((maxVal - minVal) / 5 / 25) * 25);
      t1 = minVal + step;
      t2 = t1 + step;
      t3 = t2 + step;
      t4 = t3 + step;
    } else {
      t1 = 150;
      t2 = 300;
      t3 = 500;
      t4 = 750;
    }

    const tiers: SizeTier[] = [
      { index: 0, minMm: 0, maxMm: t1, label: `< ${t1} mm`, color: SIZE_TIER_COLORS[0], count: 0 },
      { index: 1, minMm: t1, maxMm: t2, label: `${t1} – ${t2} mm`, color: SIZE_TIER_COLORS[1], count: 0 },
      { index: 2, minMm: t2, maxMm: t3, label: `${t2} – ${t3} mm`, color: SIZE_TIER_COLORS[2], count: 0 },
      { index: 3, minMm: t3, maxMm: t4, label: `${t3} – ${t4} mm`, color: SIZE_TIER_COLORS[3], count: 0 },
      { index: 4, minMm: t4, maxMm: Infinity, label: `> ${t4} mm`, color: SIZE_TIER_COLORS[4], count: 0 },
    ];

    for (const f of fragments) {
      const s = f.minFeretMm;
      if (s < t1) tiers[0].count++;
      else if (s < t2) tiers[1].count++;
      else if (s < t3) tiers[2].count++;
      else if (s < t4) tiers[3].count++;
      else tiers[4].count++;
    }

    return tiers;
  }, [fragments]);

  const getFragmentTier = (f: Fragment): SizeTier => {
    const s = f.minFeretMm;
    for (let i = 0; i < sizeTiers.length; i++) {
      if (s <= sizeTiers[i].maxMm || i === sizeTiers.length - 1) {
        return sizeTiers[i];
      }
    }
    return sizeTiers[sizeTiers.length - 1];
  };

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
      setImageDim({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
      renderCanvas();
    };
  }, [imageSrc]);

  // Re-render canvas whenever state changes
  useEffect(() => {
    renderCanvas();
  }, [
    fragments,
    selectedFragIds,
    activeTierFilter,
    drawingPoly,
    splitLine,
    opacity,
    showOutlines,
    showBadges,
    dragState,
    hoverInfo,
  ]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObjRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageObjRef.current;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    // 1. Draw background image
    ctx.drawImage(img, 0, 0);

    // 2. Draw all fragments with color matching their size interval
    for (let i = 0; i < fragments.length; i++) {
      const f = fragments[i];
      const tier = getFragmentTier(f);
      const isSelected = selectedFragIds.includes(f.id);
      const isDimmed = activeTierFilter !== null && tier.index !== activeTierFilter;

      if (f.polygon.length < 3) continue;

      ctx.beginPath();
      ctx.moveTo(f.polygon[0].x, f.polygon[0].y);
      for (let v = 1; v < f.polygon.length; v++) {
        ctx.lineTo(f.polygon[v].x, f.polygon[v].y);
      }
      ctx.closePath();

      // Translucent fill using size tier color
      const fillOpacity = isDimmed ? 0.08 : isSelected ? opacity + 0.22 : opacity;
      ctx.fillStyle = f.isFines
        ? `rgba(239, 68, 68, ${fillOpacity})`
        : tier.color + Math.round(Math.min(1, fillOpacity) * 255).toString(16).padStart(2, '0');
      ctx.fill();

      // Outline stroke in the exact size tier color
      if (showOutlines || isSelected) {
        if (isSelected) {
          // Slightly bold edges for the selected rock (clean 3.0px)
          ctx.strokeStyle = tier.color;
          ctx.lineWidth = 3.0;
          ctx.stroke();
        } else {
          ctx.strokeStyle = isDimmed ? `${tier.color}44` : tier.color;
          ctx.lineWidth = isDimmed ? 1.0 : 1.8;
          ctx.stroke();
        }
      }

      // Compact size badge
      if (showBadges && (!isDimmed || isSelected)) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(`${Math.round(f.minFeretMm)}mm`, f.centroid.x, f.centroid.y);
        ctx.shadowBlur = 0;
      }

      // 3. If selected, draw only FEW clean control handles (no edge midpoint clutter!)
      if (isSelected) {
        for (let vIdx = 0; vIdx < f.polygon.length; vIdx++) {
          const v = f.polygon[vIdx];
          const isHoveredV =
            hoverInfo?.fragId === f.id &&
            hoverInfo?.type === 'vertex' &&
            hoverInfo?.vertexIndex === vIdx;

          ctx.beginPath();
          ctx.arc(v.x, v.y, isHoveredV ? 7 : 5, 0, Math.PI * 2);
          ctx.fillStyle = isHoveredV ? '#FDE047' : '#FFFFFF';
          ctx.fill();
          ctx.strokeStyle = tier.color;
          ctx.lineWidth = 2.0;
          ctx.stroke();
        }
      }
    }

    // Draw active edge-hover indicator (only when hovering near an edge)
    if (hoverInfo && hoverInfo.type === 'edge' && hoverInfo.point) {
      ctx.beginPath();
      ctx.arc(hoverInfo.point.x, hoverInfo.point.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FDE047';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
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
        ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
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

  // Convert mouse event coordinates to original image pixels (zoom & scroll invariant)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return { x, y };
  };

  // Canvas Mouse Down: handles selection, vertex drag, and line outline reach dragging
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    if (activeTool === 'select') {
      const selectedFrag = fragments.find((f) => selectedFragIds.includes(f.id));

      // 1. Check if user clicked an existing vertex handle of the selected fragment
      if (selectedFrag) {
        for (let i = 0; i < selectedFrag.polygon.length; i++) {
          const v = selectedFrag.polygon[i];
          if (Math.hypot(v.x - x, v.y - y) <= 14) {
            setDragState({
              fragId: selectedFrag.id,
              vertexIndex: i,
              isEdgeInsertion: false,
            });
            return;
          }
        }

        // 2. Check if user clicked on any line of the selected fragment's outline
        for (let i = 0; i < selectedFrag.polygon.length; i++) {
          const p1 = selectedFrag.polygon[i];
          const p2 = selectedFrag.polygon[(i + 1) % selectedFrag.polygon.length];
          const { dist, proj } = getDistanceToSegment({ x, y }, p1, p2);
          if (dist <= 14) {
            const newPoly = [...selectedFrag.polygon];
            const insertIndex = i + 1;
            newPoly.splice(insertIndex, 0, proj);
            const updated = updateFragmentWithPolygon(selectedFrag, newPoly, pxPerMm);
            const next = fragments.map((f) => (f.id === selectedFrag.id ? updated : f));
            setFragments(next);
            setDragState({
              fragId: selectedFrag.id,
              vertexIndex: insertIndex,
              isEdgeInsertion: true,
            });
            return;
          }
        }
      }

      // 3. Check if clicked near an edge of ANY fragment in the image
      for (const f of fragments) {
        for (let i = 0; i < f.polygon.length; i++) {
          const p1 = f.polygon[i];
          const p2 = f.polygon[(i + 1) % f.polygon.length];
          const { dist, proj } = getDistanceToSegment({ x, y }, p1, p2);
          if (dist <= 12) {
            // Simplify rock outline to few clean control points if it has too many
            let activeF = f;
            if (f.polygon.length > 8) {
              const simplifiedPoly = simplifyPolygonRDP(f.polygon, 3.2);
              if (simplifiedPoly.length >= 4) {
                activeF = updateFragmentWithPolygon(f, simplifiedPoly, pxPerMm);
              }
            }

            setSelectedFragIds([activeF.id]);
            const newPoly = [...activeF.polygon];
            const insertIndex = i + 1;
            newPoly.splice(insertIndex, 0, proj);
            const updated = updateFragmentWithPolygon(activeF, newPoly, pxPerMm);
            const next = fragments.map((item) => (item.id === activeF.id ? updated : item));
            setFragments(next);
            setDragState({
              fragId: activeF.id,
              vertexIndex: insertIndex,
              isEdgeInsertion: true,
            });
            return;
          }
        }
      }

      // 4. Check if clicked inside any fragment body
      const clicked = findFragmentAt(x, y);
      if (clicked) {
        // Streamline to few clean control points (6-8 pts) if it has too many vertices
        if (clicked.polygon.length > 8) {
          const simplifiedPoly = simplifyPolygonRDP(clicked.polygon, 3.2);
          if (simplifiedPoly.length >= 4) {
            const streamlined = updateFragmentWithPolygon(clicked, simplifiedPoly, pxPerMm);
            setFragments((prev) => prev.map((item) => (item.id === clicked.id ? streamlined : item)));
          }
        }
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
        setSelectedFragIds([]);
      }
    } else if (activeTool === 'merge') {
      const clicked = findFragmentAt(x, y);
      if (clicked) {
        if (selectedFragIds.length === 0) {
          setSelectedFragIds([clicked.id]);
        } else if (selectedFragIds.length === 1 && selectedFragIds[0] !== clicked.id) {
          const f1 = fragments.find((f) => f.id === selectedFragIds[0])!;
          const f2 = clicked;
          const mergedPoints = [...f1.polygon, ...f2.polygon];
          const rawHull = computeConvexHull(mergedPoints);
          const hull = simplifyPolygonRDP(rawHull, 2.5);
          const areaMm2 = (f1.areaMm2 + f2.areaMm2) * 1.02;
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
            solidity: 0.92,
            volumeMm3: Math.round((Math.PI / 6) * Math.pow(minFeretMm, 3)),
            confidence: 0.96,
          };

          const next = fragments.filter((f) => f.id !== f1.id && f.id !== f2.id).concat(merged);
          pushState(next);
          setSelectedFragIds([merged.id]);
        }
      }
    } else if (activeTool === 'split') {
      if (!splitLine) {
        setSplitLine({ start: { x, y }, end: { x, y } });
      } else {
        const clicked = findFragmentAt(x, y);
        if (clicked) {
          const pLeft = clicked.polygon.filter((p) => p.x < x);
          const pRight = clicked.polygon.filter((p) => p.x >= x);
          if (pLeft.length >= 3 && pRight.length >= 3) {
            const hLeft = simplifyPolygonRDP(computeConvexHull(pLeft), 2.5);
            const hRight = simplifyPolygonRDP(computeConvexHull(pRight), 2.5);
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

  // Canvas Mouse Move: live outline vertex dragging & cursor updates
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);

    // If currently dragging a vertex or edge reach
    if (dragState) {
      const targetFrag = fragments.find((f) => f.id === dragState.fragId);
      if (targetFrag && targetFrag.polygon[dragState.vertexIndex]) {
        const newPoly = [...targetFrag.polygon];
        newPoly[dragState.vertexIndex] = { x, y };
        const updated = updateFragmentWithPolygon(targetFrag, newPoly, pxPerMm);
        setFragments(fragments.map((f) => (f.id === targetFrag.id ? updated : f)));
      }
      return;
    }

    if (splitLine) {
      setSplitLine((prev) => (prev ? { ...prev, end: { x, y } } : null));
      return;
    }

    // Inspect hover for cursor cues
    if (activeTool === 'select') {
      const selectedFrag = fragments.find((f) => selectedFragIds.includes(f.id));
      if (selectedFrag) {
        // Over vertex?
        for (let i = 0; i < selectedFrag.polygon.length; i++) {
          if (Math.hypot(selectedFrag.polygon[i].x - x, selectedFrag.polygon[i].y - y) <= 14) {
            setHoverInfo({ fragId: selectedFrag.id, type: 'vertex', vertexIndex: i });
            return;
          }
        }
        // Over edge?
        for (let i = 0; i < selectedFrag.polygon.length; i++) {
          const p1 = selectedFrag.polygon[i];
          const p2 = selectedFrag.polygon[(i + 1) % selectedFrag.polygon.length];
          const { dist, proj } = getDistanceToSegment({ x, y }, p1, p2);
          if (dist <= 14) {
            setHoverInfo({ fragId: selectedFrag.id, type: 'edge', edgeIndex: i, point: proj });
            return;
          }
        }
      }

      const hovered = findFragmentAt(x, y);
      if (hovered) {
        setHoverInfo({ fragId: hovered.id, type: 'body' });
      } else {
        setHoverInfo(null);
      }
    }
  };

  // Canvas Mouse Up: commit dragged changes to undo/redo history
  const handleCanvasMouseUp = () => {
    if (dragState) {
      pushState(fragments);
      setDragState(null);
    }
  };

  const handleFinishAddPolygon = () => {
    if (drawingPoly.length >= 3) {
      const hull = simplifyPolygonRDP(computeConvexHull(drawingPoly), 2.5);
      const newFrag = updateFragmentWithPolygon(
        {
          id: Math.max(0, ...fragments.map((f) => f.id)) + 1,
          polygon: hull,
          centroid: { x: 0, y: 0 },
          areaPx: 0,
          areaMm2: 0,
          ecdMm: 0,
          minFeretMm: 10,
          maxFeretMm: 10,
          bboxWidthMm: 10,
          bboxHeightMm: 10,
          aspectRatio: 1,
          solidity: 0.95,
          volumeMm3: 100,
          confidence: 1.0,
        },
        hull,
        pxPerMm
      );

      pushState([...fragments, newFrag]);
      setSelectedFragIds([newFrag.id]);
    }
    setDrawingPoly([]);
  };

  // Strict search: inside polygon first, then nearest boundary
  const findFragmentAt = (x: number, y: number): Fragment | undefined => {
    for (let i = fragments.length - 1; i >= 0; i--) {
      const f = fragments[i];
      if (f.polygon.length >= 3 && isPointInPolygon({ x, y }, f.polygon)) {
        return f;
      }
    }
    for (const f of fragments) {
      if (Math.hypot(f.centroid.x - x, f.centroid.y - y) < Math.max(22, (f.minFeretMm * pxPerMm) / 2)) {
        return f;
      }
    }
    return undefined;
  };

  // Calculate zoom to fit container perfectly
  const handleFitZoom = () => {
    if (!containerRef.current || !imageDim) return;
    const containerW = containerRef.current.clientWidth - 48;
    const containerH = containerRef.current.clientHeight - 48;
    const fitRatio = Math.min(1.0, Math.min(containerW / imageDim.width, containerH / imageDim.height));
    setZoom(Number(Math.max(0.2, fitRatio).toFixed(2)));
  };

  const activeSelectedFrag = fragments.find((f) => selectedFragIds.includes(f.id));

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden border border-slate-700">
      {/* 1. Main Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-2.5 bg-slate-800 border-b border-slate-700 gap-2">
        {/* Editing Tools */}
        <div className="flex items-center space-x-1.5 flex-wrap">
          <button
            onClick={() => {
              setActiveTool('select');
              setDrawingPoly([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'select' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-700 hover:bg-slate-600'
            }`}
            title={lang === 'fr' ? 'Sélectionner et modifier le contour des roches' : 'Select and modify rock outline reach'}
          >
            <Move className="w-3.5 h-3.5" />
            {lang === 'fr' ? 'Ajuster Contour' : 'Adjust Outline'}
          </button>
          <button
            onClick={() => {
              setActiveTool('add');
              setSelectedFragIds([]);
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTool === 'add' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400' : 'bg-slate-700 hover:bg-slate-600'
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
              activeTool === 'delete' ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-slate-700 hover:bg-slate-600'
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
              activeTool === 'merge' ? 'bg-amber-600 text-white ring-2 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600'
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
              activeTool === 'split' ? 'bg-purple-600 text-white ring-2 ring-purple-400' : 'bg-slate-700 hover:bg-slate-600'
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
              activeTool === 'fines' ? 'bg-rose-700 text-white ring-2 ring-rose-400' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            {t('paintFines', lang)}
          </button>
        </div>

        {/* Undo / Redo / View & Zoom */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
            title={t('undo', lang)}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
            title={t('redo', lang)}
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-600 mx-1" />

          {/* Fully Functional Zoom Controls with Full Positive-Space Scrolling */}
          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.2).toFixed(1))))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 min-w-[42px] text-center text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.2).toFixed(1))))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitZoom}
              className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-[10px] text-slate-300 font-semibold"
              title="Fit to screen"
            >
              Fit
            </button>
            {zoom !== 1.0 && (
              <button
                onClick={() => setZoom(1.0)}
                className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-[10px] text-slate-400 hover:text-white"
                title="100% natural size"
              >
                100%
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-slate-600 mx-1" />

          {/* Opacity slider */}
          <label className="text-xs text-slate-300 flex items-center gap-1.5">
            {t('opacity', lang)}
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-16 accent-blue-500 cursor-pointer"
            />
          </label>

          <button
            onClick={() => setShowOutlines(!showOutlines)}
            className={`px-2 py-1 text-xs rounded transition ${
              showOutlines ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {t('outlines', lang)}
          </button>
          <button
            onClick={() => setShowBadges(!showBadges)}
            className={`px-2 py-1 text-xs rounded transition ${
              showBadges ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {lang === 'fr' ? 'Tailles mm' : 'Sizes mm'}
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
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold flex items-center gap-1.5 text-white shadow-lg shadow-blue-900/30"
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

      {/* 2. Interactive Rock Size Scale Bar (5 color intervals) */}
      <div className="bg-slate-900/95 border-b border-slate-700/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-400" />
            {lang === 'fr' ? 'Échelle Granulométrique (Contours) :' : 'Rock Size Scale Bar (Outlines):'}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {sizeTiers.map((tier) => {
              const isActive = activeTierFilter === tier.index;
              return (
                <button
                  key={tier.index}
                  onClick={() => setActiveTierFilter(isActive ? null : tier.index)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
                    isActive
                      ? 'ring-2 ring-white text-white'
                      : 'hover:brightness-125 text-slate-200'
                  }`}
                  style={{
                    backgroundColor: `${tier.color}25`,
                    borderColor: tier.color,
                  }}
                  title={
                    lang === 'fr'
                      ? `Cliquer pour filtrer / isoler les blocs de ${tier.label}`
                      : `Click to isolate / filter ${tier.label} rocks`
                  }
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/70 shadow-sm"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span>{tier.label}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono font-bold">
                    {tier.count}
                  </span>
                </button>
              );
            })}
            {activeTierFilter !== null && (
              <button
                onClick={() => setActiveTierFilter(null)}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
              >
                {lang === 'fr' ? 'Afficher Tout' : 'Show All'}
              </button>
            )}
          </div>
        </div>

        {/* Selected rock live inspector */}
        {activeSelectedFrag && (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded border border-slate-600 text-xs">
            <span className="font-bold text-white">
              {lang === 'fr' ? 'Roche Sélectionnée' : 'Selected Rock'} #{activeSelectedFrag.id}:
            </span>
            <span
              className="px-1.5 py-0.5 rounded font-bold text-slate-900 text-[11px]"
              style={{ backgroundColor: getFragmentTier(activeSelectedFrag).color }}
            >
              {Math.round(activeSelectedFrag.minFeretMm)} × {Math.round(activeSelectedFrag.maxFeretMm)} mm
            </span>
            <span className="text-slate-400 text-[11px]">
              ({activeSelectedFrag.polygon.length} {lang === 'fr' ? 'points' : 'pts'})
            </span>
          </div>
        )}
      </div>

      {/* 3. Maximized Canvas Viewport — NO flexbox centering on scroll container.
           Inner div has explicit pixel dims = zoomed image + padding.
           When content < viewport → CSS grid place-items:center centers visually.
           When content > viewport → browser scrolls positive-only coordinates
           so scrollbars reach 100% of top, bottom, left and right. */}
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-0 bg-slate-950 overflow-auto relative"
      >
        <div
          style={{
            width: imageDim
              ? `${Math.round(imageDim.width * zoom) + 48}px`
              : '100%',
            height: imageDim
              ? `${Math.round(imageDim.height * zoom) + 48}px`
              : '100%',
            minWidth: '100%',
            minHeight: '100%',
            display: 'flex',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            style={{
              width: imageDim ? `${Math.round(imageDim.width * zoom)}px` : 'auto',
              height: imageDim ? `${Math.round(imageDim.height * zoom)}px` : 'auto',
              display: 'block',
              margin: 'auto',
              flexShrink: 0,
            }}
            className={`border border-slate-700/80 rounded shadow-2xl ${
              dragState
                ? 'cursor-grabbing'
                : hoverInfo?.type === 'vertex'
                ? 'cursor-move'
                : hoverInfo?.type === 'edge'
                ? 'cursor-crosshair'
                : activeTool === 'select'
                ? 'cursor-pointer'
                : 'cursor-crosshair'
            }`}
          />
        </div>

        {/* Instruction Floating Helper Pill */}
        <div
          className="fixed bottom-16 left-6 z-20 inline-flex bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-300 items-center gap-2 shadow-lg pointer-events-none"
        >
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            {lang === 'fr'
              ? 'Cliquez sur une roche pour afficher son contour. D\u00e9placez les quelques points ou glissez n\u2019importe quelle ligne pour ajuster la taille.'
              : 'Click any rock to select. Drag the few corner points or any edge line to resize the rock.'}
          </span>
        </div>
      </div>

      {/* 4. Bottom Status Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-800 text-xs text-slate-400 border-t border-slate-700 gap-2">
        <div>
          {lang === 'fr' ? 'Outil Actif :' : 'Active Tool:'}{' '}
          <span className="font-bold text-white uppercase">{activeTool}</span> |{' '}
          {lang === 'fr' ? 'Total Roches :' : 'Total Rocks:'}{' '}
          <span className="font-bold text-white">{fragments.length}</span>
          {selectedFragIds.length > 0 && ` | ${t('selected', lang)} #${selectedFragIds.join(', ')}`}
        </div>
        <div className="flex items-center gap-3">
          <span>
            {lang === 'fr' ? 'Échelle :' : 'Scale:'} {calibration.pxPerMm?.toFixed(3)} px/mm
          </span>
          <span>•</span>
          <span className="text-emerald-400 font-medium">
            {lang === 'fr'
              ? 'Modifications non destructives (enregistré comme nouvelle version)'
              : 'Edits are non-destructive (saves as new run version)'}
          </span>
        </div>
      </div>
    </div>
  );
};
