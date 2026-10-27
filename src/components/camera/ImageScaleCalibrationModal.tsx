import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Calibration, Point2D } from '../../types';
import {
  Ruler,
  Check,
  X,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Info,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export type ReferenceObjectShape = 'circle' | 'rectangle' | 'square' | 'none';

export interface ScalePreset {
  id: string;
  nameEn: string;
  nameFr: string;
  dimensionMm: number;
  category: 'pen' | 'coin' | 'equipment' | 'ruler' | 'custom';
  icon: string;
  descriptionEn: string;
  descriptionFr: string;
  defaultExclusionWidthMm?: number;
  shape?: ReferenceObjectShape;
}

export const SCALE_PRESETS: ScalePreset[] = [
  // Pens & markers
  {
    id: 'pen_bic',
    nameEn: 'Ballpoint Pen (Bic standard)',
    nameFr: 'Stylo à bille classique (Bic standard)',
    dimensionMm: 145,
    category: 'pen',
    icon: '🖊️',
    descriptionEn: 'Standard closed ballpoint pen length (tip to cap base: 145 mm)',
    descriptionFr: 'Longueur totale d’un stylo fermé classique (145 mm)',
    defaultExclusionWidthMm: 15,
    shape: 'rectangle',
  },
  {
    id: 'marker_chisel',
    nameEn: 'Field Marker / Sharpie',
    nameFr: 'Marqueur permanent / Feutre chantier',
    dimensionMm: 138,
    category: 'pen',
    icon: '🖍️',
    descriptionEn: 'Standard industrial permanent marker (138 mm)',
    descriptionFr: 'Marqueur de chantier standard fermé (138 mm)',
    defaultExclusionWidthMm: 20,
    shape: 'rectangle',
  },

  // Coins
  {
    id: 'coin_100_fcfa',
    nameEn: '100 FCFA Coin (CEMAC / XAF)',
    nameFr: 'Pièce de 100 FCFA (Zone Franc CEMAC)',
    dimensionMm: 26.0,
    category: 'coin',
    icon: '🪙',
    descriptionEn: 'Diameter of 100 FCFA bimetallic coin (26.0 mm)',
    descriptionFr: 'Diamètre de la pièce bimétallique de 100 FCFA (26,0 mm)',
    defaultExclusionWidthMm: 26,
    shape: 'circle',
  },
  {
    id: 'coin_500_fcfa',
    nameEn: '500 FCFA Coin (CEMAC / XAF)',
    nameFr: 'Pièce de 500 FCFA (Zone Franc CEMAC)',
    dimensionMm: 28.0,
    category: 'coin',
    icon: '🪙',
    descriptionEn: 'Diameter of 500 FCFA coin (28.0 mm)',
    descriptionFr: 'Diamètre de la pièce de 500 FCFA (28,0 mm)',
    defaultExclusionWidthMm: 28,
    shape: 'circle',
  },
  {
    id: 'coin_1_eur',
    nameEn: '1 Euro Coin (€)',
    nameFr: 'Pièce de 1 Euro (€)',
    dimensionMm: 23.25,
    category: 'coin',
    icon: '🪙',
    descriptionEn: 'Standard diameter of 1 € coin (23.25 mm)',
    descriptionFr: 'Diamètre officiel de la pièce de 1 € (23,25 mm)',
    defaultExclusionWidthMm: 23.25,
    shape: 'circle',
  },
  {
    id: 'coin_2_eur',
    nameEn: '2 Euros Coin (€)',
    nameFr: 'Pièce de 2 Euros (€)',
    dimensionMm: 25.75,
    category: 'coin',
    icon: '🪙',
    descriptionEn: 'Standard diameter of 2 € coin (25.75 mm)',
    descriptionFr: 'Diamètre officiel de la pièce de 2 € (25,75 mm)',
    defaultExclusionWidthMm: 25.75,
    shape: 'circle',
  },
  {
    id: 'coin_quarter_usd',
    nameEn: 'US Quarter (25¢)',
    nameFr: 'Pièce de 25 Cents US (Quarter)',
    dimensionMm: 24.26,
    category: 'coin',
    icon: '🪙',
    descriptionEn: 'Diameter of US Quarter (24.26 mm)',
    descriptionFr: 'Diamètre officiel du quart de dollar US (24,26 mm)',
    defaultExclusionWidthMm: 24.26,
    shape: 'circle',
  },
  {
    id: 'coin_1_usd',
    nameEn: '1 US Dollar Coin ($)',
    nameFr: 'Pièce de 1 Dollar US ($)',
    dimensionMm: 26.5,
    category: 'coin',
    icon: '🪙',
    descriptionEn: 'Diameter of Sacagawea / Presidential Dollar (26.5 mm)',
    descriptionFr: 'Diamètre d’une pièce de 1 dollar US (26,5 mm)',
    defaultExclusionWidthMm: 26.5,
    shape: 'circle',
  },

  // Mine & field equipment
  {
    id: 'safety_helmet',
    nameEn: 'Mining Hard Hat / Safety Helmet',
    nameFr: 'Casque de sécurité de mine',
    dimensionMm: 280,
    category: 'equipment',
    icon: '🪖',
    descriptionEn: 'Standard standard outer shell length of safety helmet (280 mm)',
    descriptionFr: 'Longueur de calotte extérieure d’un casque minier (280 mm)',
    defaultExclusionWidthMm: 220,
    shape: 'rectangle',
  },
  {
    id: 'geo_hammer',
    nameEn: 'Geological Hammer (Estwing 330mm)',
    nameFr: 'Marteau de géologue (Estwing 330mm)',
    dimensionMm: 330,
    category: 'equipment',
    icon: '🔨',
    descriptionEn: 'Total length of standard geological pick hammer (330 mm)',
    descriptionFr: 'Longueur totale du marteau de géologue standard (330 mm)',
    defaultExclusionWidthMm: 120,
    shape: 'rectangle',
  },
  {
    id: 'canette_33cl',
    nameEn: 'Soda Can (33 cl - Height: 115mm)',
    nameFr: 'Canette de boisson (33 cl - Hauteur 115 mm)',
    dimensionMm: 115,
    category: 'equipment',
    icon: '🥫',
    descriptionEn: 'Height of standard aluminum drink can (115 mm)',
    descriptionFr: 'Hauteur standard d’une canette aluminium (115 mm)',
    defaultExclusionWidthMm: 66,
    shape: 'rectangle',
  },
  {
    id: 'credit_card',
    nameEn: 'Bank Card / ID Badge (ISO 85.6mm)',
    nameFr: 'Carte bancaire / Badge ID (ISO 85,6 mm)',
    dimensionMm: 85.6,
    category: 'equipment',
    icon: '💳',
    descriptionEn: 'Standard ISO 7810 credit card length (85.6 mm)',
    descriptionFr: 'Longueur standard d’une carte plastique bancaire (85,6 mm)',
    defaultExclusionWidthMm: 54,
    shape: 'rectangle',
  },

  // Standard Rulers & Scale Bars
  {
    id: 'ruler_30cm',
    nameEn: 'Standard Ruler (300 mm / 30 cm)',
    nameFr: 'Règle graduée de 30 cm (300 mm)',
    dimensionMm: 300,
    category: 'ruler',
    icon: '📏',
    descriptionEn: '30 cm field survey ruler (300 mm)',
    descriptionFr: 'Règle de terrain graduée de 30 centimètres (300 mm)',
    defaultExclusionWidthMm: 35,
    shape: 'rectangle',
  },
  {
    id: 'scale_bar_50cm',
    nameEn: 'Survey Scale Bar (500 mm / 50 cm)',
    nameFr: 'Mire / Échelle géomètre (500 mm / 50 cm)',
    dimensionMm: 500,
    category: 'ruler',
    icon: '🎯',
    descriptionEn: 'High-contrast black/white 500 mm calibration scale bar',
    descriptionFr: 'Mire bicolore de référence de tir (500 mm)',
    defaultExclusionWidthMm: 45,
    shape: 'rectangle',
  },
  {
    id: 'scale_bar_100cm',
    nameEn: 'Metre Rule / Staff (1000 mm / 1 m)',
    nameFr: 'Mire de 1 mètre (1 000 mm)',
    dimensionMm: 1000,
    category: 'ruler',
    icon: '📐',
    descriptionEn: '1-metre surveyor levelling staff or tape section (1000 mm)',
    descriptionFr: 'Mire de nivellement ou mètre étalonné (1 000 mm)',
    defaultExclusionWidthMm: 50,
    shape: 'rectangle',
  },
  {
    id: 'scale_sphere_200',
    nameEn: 'Calibration Sphere (200 mm diameter)',
    nameFr: 'Sphère / Ballon de référence (Ø 200 mm)',
    dimensionMm: 200,
    category: 'ruler',
    icon: '⚽',
    descriptionEn: 'Brightly colored 200 mm diameter blast-scale sphere or ball',
    descriptionFr: 'Diamètre d’un ballon ou sphère témoin de tir (200 mm)',
    defaultExclusionWidthMm: 200,
    shape: 'circle',
  },
];

interface ImageScaleCalibrationModalProps {
  isOpen: boolean;
  imageSrc: string;
  initialCalibration?: Calibration;
  onSave: (calibration: Calibration, autoExclusionPolygon?: Point2D[]) => void;
  onClose: () => void;
  lang?: 'en' | 'fr';
}

export const ImageScaleCalibrationModal: React.FC<ImageScaleCalibrationModalProps> = ({
  isOpen,
  imageSrc,
  initialCalibration,
  onSave,
  onClose,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  // Selection states
  const [selectedPresetId, setSelectedPresetId] = useState<string>('pen_bic');
  const [customDimensionMm, setCustomDimensionMm] = useState<number>(145);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [autoExcludeReferenceObject, setAutoExcludeReferenceObject] = useState<boolean>(true);
  const [referenceShape, setReferenceShape] = useState<ReferenceObjectShape>('rectangle');
  const [exclusionWidthMm, setExclusionWidthMm] = useState<number>(15);

  // Calibration points in NATURAL image coordinates
  const [points, setPoints] = useState<Point2D[]>(
    initialCalibration?.points && initialCalibration.points.length === 2
      ? initialCalibration.points
      : []
  );

  // Active dragging state
  const [draggingPinIndex, setDraggingPinIndex] = useState<number | null>(null);

  // Canvas zoom & pan
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Loupe magnifier state
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const [showLoupe, setShowLoupe] = useState<boolean>(false);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Compute target dimension in mm
  const activeDimensionMm = isCustomMode
    ? Math.max(1, customDimensionMm)
    : SCALE_PRESETS.find((p) => p.id === selectedPresetId)?.dimensionMm || 145;

  const activePreset = SCALE_PRESETS.find((p) => p.id === selectedPresetId);

  // Handle Preset Selection
  const handleSelectPreset = (preset: ScalePreset) => {
    setSelectedPresetId(preset.id);
    setIsCustomMode(false);
    setCustomDimensionMm(preset.dimensionMm);
    const targetShape = preset.shape || (preset.category === 'coin' ? 'circle' : 'rectangle');
    setReferenceShape(targetShape);
    if (preset.defaultExclusionWidthMm) {
      setExclusionWidthMm(preset.defaultExclusionWidthMm);
    }
  };

  // Synchronize state when initialCalibration or modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (initialCalibration) {
      if (initialCalibration.points && initialCalibration.points.length === 2) {
        setPoints(initialCalibration.points);
      }
      if (initialCalibration.realWorldDistanceMm && initialCalibration.realWorldDistanceMm > 0) {
        const savedMm = initialCalibration.realWorldDistanceMm;
        setCustomDimensionMm(savedMm);
        const match = SCALE_PRESETS.find((p) => Math.abs(p.dimensionMm - savedMm) < 0.2);
        if (match) {
          setSelectedPresetId(match.id);
          setIsCustomMode(false);
          setReferenceShape(match.shape || (match.category === 'coin' ? 'circle' : 'rectangle'));
          if (match.defaultExclusionWidthMm) {
            setExclusionWidthMm(match.defaultExclusionWidthMm);
          }
        } else {
          setIsCustomMode(true);
          setSelectedPresetId('custom');
        }
      }
    }
  }, [isOpen, initialCalibration]);

  // Load Image
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageObjRef.current = img;

      // If no points provided yet, place default pin estimates in the lower center area
      if (!initialCalibration?.points || initialCalibration.points.length < 2) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const p1 = { x: Math.round(w * 0.45), y: Math.round(h * 0.75) };
        const p2 = { x: Math.round(w * 0.55), y: Math.round(h * 0.75) };
        setPoints([p1, p2]);
      } else {
        setPoints(initialCalibration.points);
      }
      setZoomLevel(1.0);
      setPanOffset({ x: 0, y: 0 });
    };
  }, [isOpen, imageSrc, initialCalibration]);

  // Pixel distance & scale calculation
  const pixelDistance = points.length === 2
    ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    : 0;

  const pxPerMm = pixelDistance > 0 && activeDimensionMm > 0
    ? pixelDistance / activeDimensionMm
    : 0;

  const mmPerPx = pxPerMm > 0 ? 1 / pxPerMm : 0;

  // Render Main Canvas
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

    // Calculate base fit ratio to show whole image inside canvas
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    const fitRatio = Math.min((cWidth - 40) / imgW, (cHeight - 40) / imgH);

    const drawW = imgW * fitRatio * zoomLevel;
    const drawH = imgH * fitRatio * zoomLevel;

    // Centered base position + pan offset
    const originX = (cWidth - drawW) / 2 + panOffset.x;
    const originY = (cHeight - drawH) / 2 + panOffset.y;

    // Draw background image
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, originX, originY, drawW, drawH);

    // Helpers to convert image coords to screen coords
    const toScreen = (pt: Point2D): Point2D => ({
      x: originX + (pt.x / imgW) * drawW,
      y: originY + (pt.y / imgH) * drawH,
    });

    // Draw Live Reference Object Exclusion Preview
    if (autoExcludeReferenceObject && referenceShape !== 'none' && points.length === 2 && pxPerMm > 0) {
      const autoExcl = computeAutoExclusionPolygon();
      if (autoExcl && autoExcl.length >= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        const startP = toScreen(autoExcl[0]);
        ctx.moveTo(startP.x, startP.y);
        for (let i = 1; i < autoExcl.length; i++) {
          const sp = toScreen(autoExcl[i]);
          ctx.lineTo(sp.x, sp.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Draw Line and Pins if we have points
    if (points.length >= 1) {
      const s0 = toScreen(points[0]);

      if (points.length === 2) {
        const s1 = toScreen(points[1]);

        // Draw Reference Line with shadow
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();

        ctx.strokeStyle = '#3B82F6'; // Vivid Blue inner line
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw measurement badge in the middle
        const midX = (s0.x + s1.x) / 2;
        const midY = (s0.y + s1.y) / 2;

        const badgeText = `${activeDimensionMm} mm (${pixelDistance.toFixed(0)} px)`;
        ctx.font = 'bold 12px sans-serif';
        const textMetrics = ctx.measureText(badgeText);
        const padding = 6;
        const bW = textMetrics.width + padding * 2;
        const bH = 22;

        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(midX - bW / 2, midY - bH / 2, bW, bH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, midX, midY);

        // Draw Pin 2 (End point - Amber)
        drawPin(ctx, s1.x, s1.y, '#F59E0B', 'B');
      }

      // Draw Pin 1 (Start point - Emerald)
      drawPin(ctx, s0.x, s0.y, '#10B981', 'A');
    }

    ctx.restore();

    // Render Loupe if active
    if (showLoupe && cursorPos && imageObjRef.current && loupeCanvasRef.current) {
      renderLoupe(cursorPos);
    }
  }, [
    points,
    zoomLevel,
    panOffset,
    showLoupe,
    cursorPos,
    activeDimensionMm,
    pixelDistance,
    autoExcludeReferenceObject,
    referenceShape,
    exclusionWidthMm,
    pxPerMm,
  ]);

  // Draw Pin icon helper
  const drawPin = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) => {
    ctx.save();
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;

    // Outer pulsating ring
    ctx.fillStyle = `${color}40`;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    // Inner solid ring
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label tag
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 9, y - 28, 18, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 20);

    ctx.restore();
  };

  // Render Sub-pixel Magnifier Loupe
  const renderLoupe = (imgCoord: Point2D) => {
    const lCanvas = loupeCanvasRef.current;
    const img = imageObjRef.current;
    if (!lCanvas || !img) return;

    const lCtx = lCanvas.getContext('2d');
    if (!lCtx) return;

    const size = 120;
    lCanvas.width = size;
    lCanvas.height = size;

    const zoom = 3.0; // 3x zoom inside loupe
    const sourceW = size / zoom;
    const sourceH = size / zoom;
    const sx = Math.max(0, Math.min(img.naturalWidth - sourceW, imgCoord.x - sourceW / 2));
    const sy = Math.max(0, Math.min(img.naturalHeight - sourceH, imgCoord.y - sourceH / 2));

    lCtx.clearRect(0, 0, size, size);

    // Circular clip
    lCtx.save();
    lCtx.beginPath();
    lCtx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    lCtx.clip();

    // Draw magnified image
    lCtx.imageSmoothingEnabled = false; // Nearest neighbor for pixel crispness
    lCtx.drawImage(img, sx, sy, sourceW, sourceH, 0, 0, size, size);

    // Crosshairs
    lCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    lCtx.lineWidth = 1.5;
    lCtx.beginPath();
    lCtx.moveTo(size / 2, 0);
    lCtx.lineTo(size / 2, size);
    lCtx.moveTo(0, size / 2);
    lCtx.lineTo(size, size / 2);
    lCtx.stroke();

    // Inner circle
    lCtx.strokeStyle = '#FFFFFF';
    lCtx.lineWidth = 1;
    lCtx.beginPath();
    lCtx.arc(size / 2, size / 2, 8, 0, Math.PI * 2);
    lCtx.stroke();

    lCtx.restore();

    // Outer border
    lCtx.strokeStyle = '#38BDF8';
    lCtx.lineWidth = 3;
    lCtx.beginPath();
    lCtx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    lCtx.stroke();
  };

  // Convert Screen Mouse/Touch coordinate to Natural Image coordinate
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

    if (relX < 0 || relX > drawW || relY < 0 || relY > drawH) {
      // Clamped to image boundaries
      const clampedX = Math.max(0, Math.min(imgW, (relX / drawW) * imgW));
      const clampedY = Math.max(0, Math.min(imgH, (relY / drawH) * imgH));
      return { x: Math.round(clampedX), y: Math.round(clampedY) };
    }

    const naturalX = (relX / drawW) * imgW;
    const naturalY = (relY / drawH) * imgH;

    return {
      x: Math.round(Math.max(0, Math.min(imgW, naturalX))),
      y: Math.round(Math.max(0, Math.min(imgH, naturalY))),
    };
  };

  // Detect which pin was clicked
  const getHitPinIndex = (naturalPt: Point2D): number | null => {
    if (points.length === 0) return null;

    const img = imageObjRef.current;
    if (!img) return null;

    const hitRadius = (25 / zoomLevel) * (img.naturalWidth / 600);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dist = Math.hypot(p.x - naturalPt.x, p.y - naturalPt.y);
      if (dist <= hitRadius) {
        return i;
      }
    }
    return null;
  };

  // Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Pan mode via middle click or Shift + click
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    const naturalPt = screenToImage(e.clientX, e.clientY);
    if (!naturalPt) return;

    const hitIndex = getHitPinIndex(naturalPt);
    if (hitIndex !== null) {
      setDraggingPinIndex(hitIndex);
      setCursorPos(points[hitIndex]);
      setShowLoupe(true);
    } else {
      // If we don't have 2 points yet, add point
      if (points.length === 0) {
        setPoints([naturalPt]);
        setCursorPos(naturalPt);
        setShowLoupe(true);
      } else if (points.length === 1) {
        setPoints([points[0], naturalPt]);
        setCursorPos(naturalPt);
        setShowLoupe(true);
      } else {
        // Move closest point to clicked location
        const d0 = Math.hypot(points[0].x - naturalPt.x, points[0].y - naturalPt.y);
        const d1 = Math.hypot(points[1].x - naturalPt.x, points[1].y - naturalPt.y);
        const targetIndex = d0 < d1 ? 0 : 1;
        const newPts = [...points];
        newPts[targetIndex] = naturalPt;
        setPoints(newPts);
        setDraggingPinIndex(targetIndex);
        setCursorPos(naturalPt);
        setShowLoupe(true);
      }
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

    setCursorPos(naturalPt);

    if (draggingPinIndex !== null && points[draggingPinIndex]) {
      const newPts = [...points];
      newPts[draggingPinIndex] = naturalPt;
      setPoints(newPts);
      setShowLoupe(true);
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingPinIndex(null);
    setShowLoupe(false);
  };

  // Reset Pins to defaults
  const handleResetPins = () => {
    const img = imageObjRef.current;
    if (!img) return;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    setPoints([
      { x: Math.round(w * 0.40), y: Math.round(h * 0.75) },
      { x: Math.round(w * 0.60), y: Math.round(h * 0.75) },
    ]);
  };

  // Generate Exclusion Polygon around the reference object
  const computeAutoExclusionPolygon = (): Point2D[] | undefined => {
    if (!autoExcludeReferenceObject || referenceShape === 'none' || points.length < 2 || pxPerMm <= 0) {
      return undefined;
    }

    const p0 = points[0];
    const p1 = points[1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return undefined;

    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;

    if (referenceShape === 'circle') {
      // Circle / Disc (Coins, Spheres, Cans, Pipe ends):
      // Segment AB represents the diameter across the circular reference body
      const radiusPx = len / 2 + 4; // 4px padding
      const numPoints = 24;
      const circlePoly: Point2D[] = [];
      for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        circlePoly.push({
          x: Math.round(midX + Math.cos(theta) * radiusPx),
          y: Math.round(midY + Math.sin(theta) * radiusPx),
        });
      }
      return circlePoly;
    }

    if (referenceShape === 'square') {
      // Square: length = distance AB, width = length
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const halfSizePx = len / 2 + 4;
      return [
        { x: Math.round(midX - ux * halfSizePx - nx * halfSizePx), y: Math.round(midY - uy * halfSizePx - ny * halfSizePx) },
        { x: Math.round(midX + ux * halfSizePx - nx * halfSizePx), y: Math.round(midY + uy * halfSizePx - ny * halfSizePx) },
        { x: Math.round(midX + ux * halfSizePx + nx * halfSizePx), y: Math.round(midY + uy * halfSizePx + ny * halfSizePx) },
        { x: Math.round(midX - ux * halfSizePx + nx * halfSizePx), y: Math.round(midY - uy * halfSizePx + ny * halfSizePx) },
      ];
    }

    // Default: Rectangle / Bar (Pens, Rulers, Tape)
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const objWidthMm = exclusionWidthMm > 0 ? exclusionWidthMm : (activePreset?.defaultExclusionWidthMm || 15);
    const halfWidthPx = (objWidthMm / 2) * pxPerMm + 4; // 4px padding
    const capExtensionPx = 6; // Slight padding on ends

    const startX = p0.x - ux * capExtensionPx;
    const startY = p0.y - uy * capExtensionPx;
    const endX = p1.x + ux * capExtensionPx;
    const endY = p1.y + uy * capExtensionPx;

    return [
      { x: Math.round(startX + nx * halfWidthPx), y: Math.round(startY + ny * halfWidthPx) },
      { x: Math.round(endX + nx * halfWidthPx), y: Math.round(endY + ny * halfWidthPx) },
      { x: Math.round(endX - nx * halfWidthPx), y: Math.round(endY - ny * halfWidthPx) },
      { x: Math.round(startX - nx * halfWidthPx), y: Math.round(startY - ny * halfWidthPx) },
    ];
  };

  // Apply & Save Calibration
  const handleApplyCalibration = () => {
    if (points.length < 2 || pxPerMm <= 0) {
      alert(isFrench ? 'Veuillez placer deux points sur l’objet pour valider l’échelle.' : 'Please place two points across your reference object.');
      return;
    }

    const calibration: Calibration = {
      method: 'two_point',
      points,
      realWorldDistanceMm: activeDimensionMm,
      pxPerMm: Number(pxPerMm.toFixed(4)),
      scaleVariationPercent: 1.5,
      calibrationErrorMm: Number((1.5 / pxPerMm).toFixed(2)),
    };

    const autoExclusion = computeAutoExclusionPolygon();
    onSave(calibration, autoExclusion);
    onClose();
  };

  // Zoom controls
  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(0.5, Math.min(4.5, prev + delta)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Trigger render on point or zoom changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>{isFrench ? 'Étalonnage d’Échelle & Objet Témoin' : 'Reference Scale & Known Object Calibration'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
                  {pxPerMm > 0 ? `${pxPerMm.toFixed(3)} px/mm` : isFrench ? 'Non calibré' : 'Uncalibrated'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? 'Sélectionnez votre objet témoin (stylo, pièce, casque, mire) et ajustez les deux curseurs A et B sur ses extrémités.'
                  : 'Select your reference object (pen, coin, helmet, scale bar) and adjust pins A & B to its exact tips.'}
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

        {/* Content Body: Left Presets & Settings, Right Interactive Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Preset Objects & Parameters (4 cols) */}
          <div className="lg:col-span-4 p-4 border-r border-slate-800 bg-slate-950/60 flex flex-col gap-4 overflow-y-auto">
            {/* Preset Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>{isFrench ? '1. Choisissez l’Objet Présent sur la Photo' : '1. Select Object Present in Photo'}</span>
                <span className="text-[11px] font-normal text-blue-400">
                  {activeDimensionMm} mm
                </span>
              </label>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {SCALE_PRESETS.map((preset) => {
                  const isSelected = !isCustomMode && selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-blue-600/25 border-blue-500 text-white shadow-xs'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg">{preset.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {isFrench ? preset.nameFr : preset.nameEn}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {isFrench ? preset.descriptionFr : preset.descriptionEn}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-800">
                          {preset.dimensionMm} mm
                        </span>
                      </div>
                    </button>
                  );
                })}

                {/* Custom Option Button */}
                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                    isCustomMode
                      ? 'bg-purple-600/25 border-purple-500 text-white shadow-xs'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">✏️</span>
                    <div>
                      <div className="text-xs font-bold">
                        {isFrench ? 'Dimension Personnalisée (Saisie libre)' : 'Custom Reference Dimension'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isFrench ? 'Tout objet de taille connue (clé, carte, carnet...)' : 'Any object of verified size'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded-md border border-purple-800">
                    {customDimensionMm} mm
                  </span>
                </button>
              </div>
            </div>

            {/* Custom Dimension Input (if custom mode active) */}
            {isCustomMode && (
              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl space-y-2">
                <label className="text-xs font-bold text-purple-200 flex items-center justify-between">
                  <span>{isFrench ? 'Longueur ou Diamètre Réel :' : 'Real Length or Diameter:'}</span>
                  <span className="text-xs text-purple-300">{(customDimensionMm / 10).toFixed(1)} cm</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={customDimensionMm}
                    onChange={(e) => setCustomDimensionMm(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-purple-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-bold focus:outline-hidden focus:border-purple-400"
                  />
                  <span className="text-xs font-bold text-slate-400">mm</span>
                </div>
              </div>
            )}

            {/* Calculated Scale Metrics Card */}
            <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2.5">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>{isFrench ? 'Résultat de la Calibration' : 'Scale Calculation'}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  pixelDistance >= 20 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {pixelDistance >= 20 ? (isFrench ? 'Précision Optimale' : 'High Precision') : (isFrench ? 'Attention' : 'Caution')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">{isFrench ? 'Distance mesurée :' : 'Pixel Distance:'}</div>
                  <div className="font-extrabold text-blue-400 text-sm">{pixelDistance.toFixed(1)} px</div>
                </div>

                <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">{isFrench ? 'Taille objet :' : 'Real Dimension:'}</div>
                  <div className="font-extrabold text-white text-sm">{activeDimensionMm} mm</div>
                </div>

                <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">{isFrench ? 'Échelle (px/mm) :' : 'Scale (px/mm):'}</div>
                  <div className="font-extrabold text-emerald-400 text-sm">{pxPerMm.toFixed(3)} px/mm</div>
                </div>

                <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">{isFrench ? 'Résolution (1 px) :' : 'Resolution (1 px):'}</div>
                  <div className="font-extrabold text-cyan-300 text-sm">{mmPerPx.toFixed(2)} mm</div>
                </div>
              </div>

              {pixelDistance < 20 && (
                <div className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-800 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    {isFrench
                      ? 'Les points A et B sont très rapprochés (< 20 px). Zoomez ou éloignez les points pour éviter une erreur d’échelle.'
                      : 'Pins A & B are very close (< 20 px). Zoom in or place pins further apart for accurate scale.'}
                  </span>
                </div>
              )}
            </div>

            {/* Auto-Exclude Reference Object & Shape Options */}
            <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={autoExcludeReferenceObject}
                  onChange={(e) => setAutoExcludeReferenceObject(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-600"
                />
                <div>
                  <span className="font-bold text-slate-200">
                    {isFrench
                      ? 'Masquer automatiquement cet objet de référence'
                      : 'Automatically exclude this reference object'}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {isFrench
                      ? 'Empêche l’application de compter le stylo, la pièce ou la mire comme un caillou.'
                      : 'Prevents the reference pen, coin, or scale bar from being measured as a rock fragment.'}
                  </p>
                </div>
              </label>

              {autoExcludeReferenceObject && (
                <div className="space-y-2.5 pt-2 border-t border-slate-700/60 text-xs">
                  <div className="font-bold text-slate-300 text-[11px]">
                    {isFrench ? "Forme géométrique de l'objet :" : "Reference Object Geometry:"}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReferenceShape('circle')}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                        referenceShape === 'circle'
                          ? 'bg-blue-600 border-blue-400 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🪙</span>
                      <span>{isFrench ? 'Cercle / Pièce' : 'Circle / Coin'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReferenceShape('rectangle')}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                        referenceShape === 'rectangle'
                          ? 'bg-blue-600 border-blue-400 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>📏</span>
                      <span>{isFrench ? 'Barre / Stylo' : 'Rectangle / Bar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReferenceShape('square')}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                        referenceShape === 'square'
                          ? 'bg-blue-600 border-blue-400 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🔲</span>
                      <span>{isFrench ? 'Carré' : 'Square'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReferenceShape('none')}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                        referenceShape === 'none'
                          ? 'bg-amber-600 border-amber-400 text-white shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>🚫</span>
                      <span>{isFrench ? 'Aucun masque' : 'No Mask'}</span>
                    </button>
                  </div>

                  {referenceShape === 'circle' && (
                    <div className="text-[11px] text-blue-300 bg-blue-950/40 p-2 rounded-lg border border-blue-800/60">
                      {isFrench
                        ? `Masque circulaire centré sur le segment A-B (Diamètre = ${activeDimensionMm} mm).`
                        : `Circular mask centered on segment A-B (Diameter = ${activeDimensionMm} mm).`}
                    </div>
                  )}

                  {referenceShape === 'square' && (
                    <div className="text-[11px] text-blue-300 bg-blue-950/40 p-2 rounded-lg border border-blue-800/60">
                      {isFrench
                        ? `Masque carré aligné sur A-B (${activeDimensionMm} × ${activeDimensionMm} mm).`
                        : `Square mask aligned on A-B (${activeDimensionMm} × ${activeDimensionMm} mm).`}
                    </div>
                  )}

                  {referenceShape === 'rectangle' && (
                    <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-700 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] text-slate-300 font-bold">
                        <span>{isFrench ? "Largeur / Épaisseur de l'objet :" : "Object Width / Thickness:"}</span>
                        <span className="font-mono text-emerald-400 font-bold">{exclusionWidthMm} mm</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max={Math.max(50, Math.round(activeDimensionMm))}
                        step="1"
                        value={exclusionWidthMm}
                        onChange={(e) => setExclusionWidthMm(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                      <div className="flex gap-1.5 justify-between text-[10px] text-slate-400">
                        <span>Fin (10mm)</span>
                        <span>Moyen (25mm)</span>
                        <span>Large (50mm+)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Instructions help */}
            <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                {isFrench
                  ? 'Glissez les curseurs A et B directement sur la photo. Utilisez la loupe pour positionner les extrémités avec une précision au pixel près.'
                  : 'Drag pins A & B directly on the photo. Use the magnifier loupe for exact sub-pixel positioning.'}
              </span>
            </div>
          </div>

          {/* Right Column: Canvas Viewport (8 cols) */}
          <div className="lg:col-span-8 p-3 flex flex-col gap-2 bg-slate-950 relative overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleZoom(0.25)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                  title={isFrench ? 'Zoom Avant' : 'Zoom In'}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleZoom(-0.25)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                  title={isFrench ? 'Zoom Arrière' : 'Zoom Out'}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleResetPins}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 flex items-center gap-1 transition"
                  title={isFrench ? 'Recentrer les curseurs' : 'Reset Pin Positions'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isFrench ? 'Recentrer' : 'Reset'}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  {isFrench ? 'Point A : Début' : 'Pin A: Start'}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  {isFrench ? 'Point B : Fin' : 'Pin B: End'}
                </span>
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
                className="w-full h-full object-contain"
              />

              {/* Magnifier Loupe Floating Overlay */}
              <div
                className={`absolute top-4 right-4 pointer-events-none transition-opacity duration-150 ${
                  showLoupe ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="bg-slate-900/90 border-2 border-sky-400 rounded-2xl p-1.5 shadow-2xl flex flex-col items-center">
                  <canvas ref={loupeCanvasRef} className="rounded-xl w-[120px] h-[120px]" />
                  <span className="text-[10px] font-bold text-sky-300 mt-1 uppercase tracking-wider">
                    {isFrench ? 'Loupe 3x Précision' : '3x Subpixel Loupe'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-800/90 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {isFrench
                ? `Échelle calculée : ${pxPerMm.toFixed(3)} px/mm (${mmPerPx.toFixed(2)} mm par pixel)`
                : `Active scale: ${pxPerMm.toFixed(3)} px/mm (${mmPerPx.toFixed(2)} mm per pixel)`}
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
              onClick={handleApplyCalibration}
              disabled={pixelDistance < 5}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isFrench ? 'Appliquer cette échelle & Recalculer' : 'Apply Scale & Recalculate'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
