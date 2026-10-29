import { db } from './index';
import type {
  Project,
  Site,
  Blast,
  ImageRecord,
  SegmentationRun,
  GroundTruth,
  MillBatch,
  Fragment,
} from '../types';
import { BLASTHOLE4_IMAGE_DATA_URL } from '../assets/blasthole4Image';
import { generateDefaultDrillHolesFromBlast } from '../services/drillHoles/drillHoleService';

// Helper to generate a realistic synthetic rock pile image data URL
export function createSyntheticMuckpileDataUrl(width = 800, height = 600, coarseFactor = 1.0): {
  dataUrl: string;
  fragments: Fragment[];
  pxPerMm: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Background muck pile terrain (rocky gray-brown gradient)
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#5A544C');
  grad.addColorStop(0.5, '#6E665D');
  grad.addColorStop(1, '#4B433A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Add realistic soil/fines texture
  for (let i = 0; i < 3000; i++) {
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    const rad = Math.random() * 2 + 1;
    ctx.fillStyle = Math.random() > 0.5 ? '#3C352E' : '#8A8073';
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw 500mm Scale Bar (bright yellow/black striped rod) in bottom right corner
  const scaleBarX = width - 260;
  const scaleBarY = height - 50;
  const scaleBarLenPx = 200; // 200px = 500mm -> 0.4 px/mm (1 mm = 0.4 px, or 2.5 mm/px)
  const pxPerMm = scaleBarLenPx / 500; // 0.4 px/mm

  ctx.lineWidth = 10;
  ctx.strokeStyle = '#EAB308'; // Yellow
  ctx.beginPath();
  ctx.moveTo(scaleBarX, scaleBarY);
  ctx.lineTo(scaleBarX + scaleBarLenPx, scaleBarY);
  ctx.stroke();

  // Scale stripes (black marks every 50mm = 20px)
  ctx.strokeStyle = '#000000';
  for (let s = 0; s <= scaleBarLenPx; s += 20) {
    ctx.beginPath();
    ctx.moveTo(scaleBarX + s, scaleBarY - 5);
    ctx.lineTo(scaleBarX + s, scaleBarY + 5);
    ctx.stroke();
  }

  // Label text on scale bar
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SCALE: 500 mm', scaleBarX + 50, scaleBarY - 12);

  // Generate synthetic fragments
  const fragments: Fragment[] = [];
  const baseRockCount = Math.floor(45 / coarseFactor);

  let fragId = 1;
  const margin = 40;

  for (let i = 0; i < baseRockCount; i++) {
    const cx = margin + Math.random() * (width - 2 * margin - 150);
    const cy = margin + Math.random() * (height - 2 * margin - 80);

    const baseRadiusPx = (15 + Math.random() * 35) * coarseFactor;
    const numVertices = 6 + Math.floor(Math.random() * 6);
    const polygon: Array<{ x: number; y: number }> = [];

    for (let v = 0; v < numVertices; v++) {
      const angle = (v / numVertices) * Math.PI * 2;
      const r = baseRadiusPx * (0.7 + Math.random() * 0.6);
      polygon.push({
        x: Math.round(cx + Math.cos(angle) * r),
        y: Math.round(cy + Math.sin(angle) * r),
      });
    }

    // Render rock
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let v = 1; v < polygon.length; v++) {
      ctx.lineTo(polygon[v].x, polygon[v].y);
    }
    ctx.closePath();

    // Rock shading
    const rockGrad = ctx.createLinearGradient(cx - baseRadiusPx, cy - baseRadiusPx, cx + baseRadiusPx, cy + baseRadiusPx);
    const shade = 110 + Math.floor(Math.random() * 60);
    rockGrad.addColorStop(0, `rgb(${shade + 30}, ${shade + 25}, ${shade + 20})`);
    rockGrad.addColorStop(1, `rgb(${shade - 20}, ${shade - 25}, ${shade - 30})`);
    ctx.fillStyle = rockGrad;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#27272A';
    ctx.stroke();

    // Compute polygon properties
    let areaPx = 0;
    for (let v = 0; v < polygon.length; v++) {
      const next = (v + 1) % polygon.length;
      areaPx += polygon[v].x * polygon[next].y - polygon[next].x * polygon[v].y;
    }
    areaPx = Math.abs(areaPx) / 2;

    const areaMm2 = areaPx / (pxPerMm * pxPerMm);
    const ecdMm = 2 * Math.sqrt(areaMm2 / Math.PI);
    const minFeretMm = ecdMm * (0.78 + Math.random() * 0.15);
    const maxFeretMm = ecdMm * (1.15 + Math.random() * 0.25);
    const bboxWidthMm = maxFeretMm * 0.95;
    const bboxHeightMm = minFeretMm * 1.05;
    const aspectRatio = maxFeretMm / Math.max(1, minFeretMm);
    const solidity = 0.88 + Math.random() * 0.08;
    const volumeMm3 = (Math.PI / 6) * Math.pow(minFeretMm, 3);

    fragments.push({
      id: fragId++,
      polygon,
      centroid: { x: Math.round(cx), y: Math.round(cy) },
      areaPx: Math.round(areaPx),
      areaMm2: Math.round(areaMm2),
      ecdMm: Number(ecdMm.toFixed(1)),
      minFeretMm: Number(minFeretMm.toFixed(1)),
      maxFeretMm: Number(maxFeretMm.toFixed(1)),
      bboxWidthMm: Number(bboxWidthMm.toFixed(1)),
      bboxHeightMm: Number(bboxHeightMm.toFixed(1)),
      aspectRatio: Number(aspectRatio.toFixed(2)),
      solidity: Number(solidity.toFixed(2)),
      volumeMm3: Math.round(volumeMm3),
      confidence: Number((0.85 + Math.random() * 0.14).toFixed(2)),
    });
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    fragments,
    pxPerMm,
  };
}

export async function seedDemoProject(): Promise<string> {
  const existing = await db.projects.where('name').equals('Bétaré Oya Mine-to-Mill Pilot').first();
  if (existing) {
    return existing.id;
  }

  const projectId = 'proj-demo-betare-oya';
  const siteId = 'site-pit3-granodiorite';
  const now = Date.now();

  const project: Project = {
    id: projectId,
    name: 'Bétaré Oya Mine-to-Mill Pilot',
    description: 'Artisanal & Small-Scale Gold Mining (ASM) blast fragmentation and milling optimization pilot study in East Cameroon.',
    createdAt: now - 86400000 * 7,
    updatedAt: now,
  };

  const site: Site = {
    id: siteId,
    projectId,
    name: 'Pit #3 Granodiorite Bench',
    locationText: 'Bétaré Oya Gold District, Lom & Djérem, East Region, Cameroon',
    gpsLat: 5.5982,
    gpsLng: 14.0841,
    rockTypeNotes: 'Fresh granodiorite intrusive with auriferous quartz-pyrite veinlets. Competent rock mass.',
    operatorContact: 'Dr. E. Mbarga / Mine Engineer (+237 670-000-000)',
    createdAt: now - 86400000 * 7,
    updatedAt: now,
  };

  // Blast 1: Coarse fragmentation
  const blast1Id = 'blast-bl-2026-001';
  const syn1 = createSyntheticMuckpileDataUrl(800, 600, 1.4);
  const image1Id = 'img-bl01-01';

  // Blast 2: Optimal fragmentation
  const blast2Id = 'blast-bl-2026-002';
  const syn2 = createSyntheticMuckpileDataUrl(800, 600, 1.0);
  const image2Id = 'img-bl02-01';

  // Blast 3: Over-pulverized / High Fines
  const blast3Id = 'blast-bl-2026-003';
  const syn3 = createSyntheticMuckpileDataUrl(800, 600, 0.7);
  const image3Id = 'img-bl03-01';

  // Blast 4: User Blasthole 4 Pilot (Bench 840 RL)
  const blast4Id = 'blast-bl-2026-004';
  const syn4 = createSyntheticMuckpileDataUrl(800, 600, 1.15);
  const image4Id = 'img-bl04-01';

  // Blast 5: User Blasthole BH-05 Industrial Qualification (Bench 840 RL)
  const blast5Id = 'blast-bl-2026-005';
  const syn5 = createSyntheticMuckpileDataUrl(800, 600, 1.05);
  const image5Id = 'img-bl05-01';

  const blasts: Blast[] = [
    {
      id: blast1Id,
      siteId,
      projectId,
      blastId: 'BL-2026-001',
      dateTime: '2026-03-14T09:30',
      weather: 'Sunny, 29°C, dry face',
      notes: 'Initial production blast. Wide burden/spacing pattern. Visible oversize boulders at crest.',
      parameters: {
        benchHeight: 6.0,
        holeDiameter: 89,
        holeDepth: 6.8,
        subdrill: 0.8,
        burden: 2.8,
        spacing: 3.2,
        stemmingLength: 2.4,
        numberOfHoles: 24,
        holeInclination: 90,
        explosiveType: 'ANFO (Porous Prill + Fuel Oil)',
        rws: 100,
        chargePerHole: 22.5,
        bottomChargeLength: 2.0,
        columnChargeLength: 2.4,
        initiationSequenceNotes: 'Nonel 25ms surface delays between holes, 42ms row delay',
        waterInHoles: false,
        drillingDeviationEstimate: 0.15,
      },
      rockMass: {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.55,
        jointOrientation: 'dip_into_face',
        estimatedGsiOrRmr: 68,
        ucsMPa: 125,
        youngsModulusGPa: 52,
      },
      images: [],
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
    },
    {
      id: blast2Id,
      siteId,
      projectId,
      blastId: 'BL-2026-002',
      dateTime: '2026-03-21T11:00',
      weather: 'Partly cloudy, 31°C',
      notes: 'Optimized blast pattern. Reduced burden/spacing, improved energy distribution.',
      parameters: {
        benchHeight: 6.0,
        holeDiameter: 89,
        holeDepth: 6.8,
        subdrill: 0.8,
        burden: 2.3,
        spacing: 2.7,
        stemmingLength: 2.0,
        numberOfHoles: 32,
        holeInclination: 85,
        explosiveType: 'ANFO / Emulsion Blend (70/30)',
        rws: 108,
        chargePerHole: 24.0,
        bottomChargeLength: 2.2,
        columnChargeLength: 2.6,
        initiationSequenceNotes: 'Electronic delay 17ms per hole, chevron firing pattern',
        waterInHoles: false,
        drillingDeviationEstimate: 0.10,
      },
      rockMass: {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.50,
        jointOrientation: 'strike_perpendicular',
        estimatedGsiOrRmr: 65,
        ucsMPa: 120,
        youngsModulusGPa: 50,
      },
      images: [],
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 3,
    },
    {
      id: blast3Id,
      siteId,
      projectId,
      blastId: 'BL-2026-003',
      dateTime: '2026-03-28T14:15',
      weather: 'Hot and humid, 34°C',
      notes: 'Over-charged test blast. High powder factor resulted in excessive fine generation.',
      parameters: {
        benchHeight: 6.0,
        holeDiameter: 89,
        holeDepth: 6.8,
        subdrill: 0.8,
        burden: 1.9,
        spacing: 2.2,
        stemmingLength: 1.6,
        numberOfHoles: 40,
        holeInclination: 90,
        explosiveType: 'Heavy ANFO (50/50)',
        rws: 115,
        chargePerHole: 26.5,
        bottomChargeLength: 2.5,
        columnChargeLength: 2.7,
        initiationSequenceNotes: 'Electronic delay 20ms per hole',
        waterInHoles: false,
        drillingDeviationEstimate: 0.12,
      },
      rockMass: {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.45,
        jointOrientation: 'dip_out_of_face',
        estimatedGsiOrRmr: 62,
        ucsMPa: 115,
        youngsModulusGPa: 48,
      },
      images: [],
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: blast4Id,
      siteId,
      projectId,
      blastId: 'BL-2026-004',
      dateTime: '2026-04-05T08:30',
      weather: 'Ensoleillé, 28°C',
      notes: 'Tir pilote de production - Front Nord-Est, Bétaré-Oya',
      benchElevation: 840,
      parameters: {
        benchHeight: 15.0,
        holeDiameter: 79,
        holeDepth: 16.2,
        subdrill: 1.2,
        burden: 4.0,
        spacing: 3.0,
        stemmingLength: 2.4,
        numberOfHoles: 50,
        holeInclination: 90,
        explosiveType: 'ANFO Vrac (Plein trou)',
        rws: 100,
        chargePerHole: 71.89,
        bottomChargeLength: 4.0,
        columnChargeLength: 9.8,
        initiationSequenceNotes: 'V-echelon 25ms / 400ms',
        waterInHoles: false,
        drillingDeviationEstimate: 0.05,
      },
      rockMass: {
        rockType: 'Granodiorite Foliée',
        density: 2.76,
        jointSetCount: 3,
        meanJointSpacing: 0.45,
        jointOrientation: 'strike_perpendicular',
        estimatedGsiOrRmr: 65,
        ucsMPa: 120,
        youngsModulusGPa: 65,
      },
      images: [],
      createdAt: now - 86400000 * 0.5,
      updatedAt: now - 86400000 * 0.5,
    },
    {
      id: blast5Id,
      siteId,
      projectId,
      blastId: 'BL-2026-005',
      dateTime: '2026-10-27T10:00',
      weather: 'Sunny, 28°C, Dry Face, 45% Humidity',
      notes: 'Industrial Test Blast & Drill Hole BH-05 Qualification - Foliated Granodiorite Bench 840 RL',
      benchElevation: 840,
      parameters: {
        benchHeight: 12.0,
        holeDiameter: 89,
        holeDepth: 13.0,
        subdrill: 1.0,
        burden: 3.2,
        spacing: 3.8,
        stemmingLength: 2.6,
        numberOfHoles: 36,
        holeInclination: 90,
        explosiveType: 'ANFO Bulk + Booster 150g Pentolite',
        rws: 105,
        chargePerHole: 58.4,
        bottomChargeLength: 2.5,
        columnChargeLength: 7.9,
        initiationSequenceNotes: 'Electronic i-kon III: 25ms inter-hole, 65ms inter-row V-echelon',
        waterInHoles: false,
        drillingDeviationEstimate: 0.06,
      },
      rockMass: {
        rockType: 'Foliated Granodiorite',
        density: 2.75,
        jointSetCount: 3,
        meanJointSpacing: 0.48,
        jointOrientation: 'dip_into_face',
        estimatedGsiOrRmr: 66,
        ucsMPa: 125,
        youngsModulusGPa: 62,
      },
      images: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Helper to build metrics from fragments
  const buildMetrics = (frags: Fragment[], p20T: number, p50T: number, p80T: number, oversizeT: number, finesT: number) => {
    const rawCurve = [
      { sizeMm: 5, passingPercent: finesT * 0.4 },
      { sizeMm: 15, passingPercent: finesT * 0.8 },
      { sizeMm: 25, passingPercent: finesT },
      { sizeMm: p20T, passingPercent: 20 },
      { sizeMm: p50T, passingPercent: 50 },
      { sizeMm: p80T, passingPercent: 80 },
      { sizeMm: p80T * 1.3, passingPercent: 90 },
      { sizeMm: 300, passingPercent: 100 - oversizeT },
      { sizeMm: 500, passingPercent: 100 },
    ];
    return {
      sizeDefinition: 'min_feret' as const,
      fragmentCount: frags.length,
      p10: Math.round(p20T * 0.55),
      p20: p20T,
      p50: p50T,
      p80: p80T,
      p90: Math.round(p80T * 1.3),
      pMax: 480,
      meanSize: Math.round(p50T * 0.95),
      uniformityIndex: Number((p80T / p20T).toFixed(2)),
      oversizePercent: oversizeT,
      finesPercent: finesT,
      unresolvedFinesPercent: Number((finesT * 0.6).toFixed(1)),
      bootstrapCI: {
        p10: [Math.round(p20T * 0.5), Math.round(p20T * 0.6)] as [number, number],
        p20: [Math.round(p20T * 0.92), Math.round(p20T * 1.08)] as [number, number],
        p50: [Math.round(p50T * 0.94), Math.round(p50T * 1.06)] as [number, number],
        p80: [Math.round(p80T * 0.93), Math.round(p80T * 1.07)] as [number, number],
        p90: [Math.round(p80T * 1.22), Math.round(p80T * 1.38)] as [number, number],
      },
      swebrecFit: {
        xMax: 500,
        x50: p50T,
        b: 1.85,
        r2: 0.991,
        rmse: 2.14,
      },
      rosinRammlerFit: {
        xc: Math.round(p50T / Math.pow(0.693, 1 / 1.35)),
        n: 1.35,
        r2: 0.984,
        rmse: 3.22,
      },
      rawCurve,
      correctedCurve: rawCurve.map((c) => ({ ...c, passingPercent: Math.min(100, c.passingPercent * 1.02) })),
    };
  };

  const images: ImageRecord[] = [
    {
      id: image1Id,
      blastId: blast1Id,
      dataUrl: syn1.dataUrl,
      filename: 'BL01_muckpile_front.jpg',
      zone: 'front',
      lighting: 'sun',
      time: '09:45',
      cameraHeightM: 1.6,
      estimatedDistanceM: 8.5,
      hasScaleMarker: true,
      exifData: {
        make: 'Samsung',
        model: 'Galaxy S22',
        focalLengthMm: 7.0,
        iso: 100,
        exposureTime: '1/1200s',
      },
      qualityCheck: {
        blurScore: 420,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['Excellent focus and contrast. Scale marker clearly visible.'],
      },
      calibration: {
        method: 'two_point',
        points: [{ x: 540, y: 550 }, { x: 740, y: 550 }],
        realWorldDistanceMm: 500,
        pxPerMm: syn1.pxPerMm,
        scaleVariationPercent: 1.8,
        calibrationErrorMm: 2.4,
      },
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
    },
    {
      id: image2Id,
      blastId: blast2Id,
      dataUrl: syn2.dataUrl,
      filename: 'BL02_muckpile_center.jpg',
      zone: 'middle',
      lighting: 'overcast',
      time: '11:20',
      cameraHeightM: 1.65,
      estimatedDistanceM: 7.8,
      hasScaleMarker: true,
      qualityCheck: {
        blurScore: 510,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['Optimal lighting conditions without harsh shadow clipping.'],
      },
      calibration: {
        method: 'two_point',
        points: [{ x: 540, y: 550 }, { x: 740, y: 550 }],
        realWorldDistanceMm: 500,
        pxPerMm: syn2.pxPerMm,
      },
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 3,
    },
    {
      id: image3Id,
      blastId: blast3Id,
      dataUrl: syn3.dataUrl,
      filename: 'BL03_muckpile_top.jpg',
      zone: 'top',
      lighting: 'sun',
      time: '14:35',
      cameraHeightM: 1.5,
      estimatedDistanceM: 6.5,
      hasScaleMarker: true,
      qualityCheck: {
        blurScore: 390,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['High dust haze observed near upper bench.'],
      },
      calibration: {
        method: 'two_point',
        points: [{ x: 540, y: 550 }, { x: 740, y: 550 }],
        realWorldDistanceMm: 500,
        pxPerMm: syn3.pxPerMm,
      },
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: image4Id,
      blastId: blast4Id,
      dataUrl: BLASTHOLE4_IMAGE_DATA_URL,
      filename: 'BL04_muckpile_pilot.jpg',
      zone: 'middle',
      lighting: 'sun',
      time: '14:30',
      cameraHeightM: 1.7,
      estimatedDistanceM: 8.0,
      hasScaleMarker: true,
      qualityCheck: {
        blurScore: 480,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['High contrast scale marker validated.'],
      },
      calibration: {
        method: 'two_point',
        points: [{ x: 50, y: 500 }, { x: 250, y: 500 }],
        realWorldDistanceMm: 500,
        pxPerMm: 0.4,
      },
      createdAt: now - 86400000 * 0.5,
      updatedAt: now - 86400000 * 0.5,
    },
    {
      id: image5Id,
      blastId: blast5Id,
      dataUrl: BLASTHOLE4_IMAGE_DATA_URL,
      filename: 'BH05_muckpile_qualification.jpg',
      zone: 'middle',
      lighting: 'sun',
      time: '10:15',
      cameraHeightM: 1.7,
      estimatedDistanceM: 8.0,
      hasScaleMarker: true,
      qualityCheck: {
        blurScore: 495,
        blurStatus: 'pass',
        exposureStatus: 'pass',
        contrastStatus: 'pass',
        resolutionStatus: 'pass',
        scaleMarkerStatus: 'pass',
        advice: ['Clear calibration bar and granular illumination.'],
      },
      calibration: {
        method: 'two_point',
        points: [{ x: 50, y: 500 }, { x: 250, y: 500 }],
        realWorldDistanceMm: 500,
        pxPerMm: 0.4,
      },
      createdAt: now,
      updatedAt: now,
    },
  ];

  const runs: SegmentationRun[] = [
    {
      id: 'run-bl01-engine-a',
      imageId: image1Id,
      engine: 'classical',
      timestamp: now - 86400000 * 5,
      parameters: {
        colorSpace: 'grayscale',
        claheClipLimit: 2.0,
        claheGridSize: 8,
        gaussianBlurKernel: 5,
        thresholdMethod: 'adaptive',
        adaptiveBlockSize: 21,
        adaptiveC: 3,
        morphKernelSize: 3,
        distanceTransformThreshold: 0.45,
        minFragmentAreaMm2: 50,
        minSolidity: 0.75,
        maxAspectRatio: 3.5,
        filterBorders: true,
      },
      fragments: syn1.fragments,
      metrics: buildMetrics(syn1.fragments, 75, 168, 285, 18.4, 7.2),
    },
    {
      id: 'run-bl02-engine-a',
      imageId: image2Id,
      engine: 'classical',
      timestamp: now - 86400000 * 3,
      parameters: {
        colorSpace: 'grayscale',
        claheClipLimit: 2.0,
        claheGridSize: 8,
        gaussianBlurKernel: 5,
        thresholdMethod: 'adaptive',
        adaptiveBlockSize: 21,
        adaptiveC: 3,
        morphKernelSize: 3,
        distanceTransformThreshold: 0.45,
        minFragmentAreaMm2: 50,
        minSolidity: 0.75,
        maxAspectRatio: 3.5,
        filterBorders: true,
      },
      fragments: syn2.fragments,
      metrics: buildMetrics(syn2.fragments, 52, 115, 195, 6.2, 11.5),
    },
    {
      id: 'run-bl03-engine-a',
      imageId: image3Id,
      engine: 'classical',
      timestamp: now - 86400000 * 1,
      parameters: {
        colorSpace: 'grayscale',
        claheClipLimit: 2.0,
        claheGridSize: 8,
        gaussianBlurKernel: 5,
        thresholdMethod: 'adaptive',
        adaptiveBlockSize: 21,
        adaptiveC: 3,
        morphKernelSize: 3,
        distanceTransformThreshold: 0.45,
        minFragmentAreaMm2: 50,
        minSolidity: 0.75,
        maxAspectRatio: 3.5,
        filterBorders: true,
      },
      fragments: syn3.fragments,
      metrics: buildMetrics(syn3.fragments, 35, 78, 142, 2.1, 24.8),
    },
    {
      id: 'run-bl04-engine-a',
      imageId: image4Id,
      engine: 'classical',
      timestamp: now - 86400000 * 0.5,
      parameters: {
        colorSpace: 'grayscale',
        claheClipLimit: 2.0,
        claheGridSize: 8,
        gaussianBlurKernel: 5,
        thresholdMethod: 'adaptive',
        adaptiveBlockSize: 21,
        adaptiveC: 3,
        morphKernelSize: 3,
        distanceTransformThreshold: 0.45,
        minFragmentAreaMm2: 50,
        minSolidity: 0.75,
        maxAspectRatio: 3.5,
        filterBorders: true,
      },
      fragments: syn4.fragments,
      metrics: buildMetrics(syn4.fragments, 68, 145, 242, 9.2, 6.8),
    },
    {
      id: 'run-bl05-engine-a',
      imageId: image5Id,
      engine: 'classical',
      timestamp: now,
      parameters: {
        colorSpace: 'grayscale',
        claheClipLimit: 2.0,
        claheGridSize: 8,
        gaussianBlurKernel: 5,
        thresholdMethod: 'adaptive',
        adaptiveBlockSize: 21,
        adaptiveC: 3,
        morphKernelSize: 3,
        distanceTransformThreshold: 0.45,
        minFragmentAreaMm2: 50,
        minSolidity: 0.75,
        maxAspectRatio: 3.5,
        filterBorders: true,
      },
      fragments: syn5.fragments,
      metrics: buildMetrics(syn5.fragments, 65, 152, 228, 6.4, 5.8),
    },
  ];

  const groundTruths: GroundTruth[] = [
    {
      id: 'gt-bl01',
      blastId: blast1Id,
      manualFragments: [
        { id: 1, sizeMm: 290, notes: 'Large block' },
        { id: 2, sizeMm: 245 },
        { id: 3, sizeMm: 172 },
        { id: 4, sizeMm: 155 },
        { id: 5, sizeMm: 110 },
        { id: 6, sizeMm: 85 },
        { id: 7, sizeMm: 64 },
      ],
      sieveData: [
        { apertureMm: 300, massRetainedKg: 42.0 },
        { apertureMm: 200, massRetainedKg: 68.5 },
        { apertureMm: 125, massRetainedKg: 54.0 },
        { apertureMm: 75, massRetainedKg: 38.0 },
        { apertureMm: 37.5, massRetainedKg: 22.5 },
        { apertureMm: 19, massRetainedKg: 14.0 },
        { apertureMm: 9.5, massRetainedKg: 8.5 },
        { apertureMm: 4.75, massRetainedKg: 5.2 },
      ],
      computedP20: 72,
      computedP50: 162,
      computedP80: 278,
      notes: 'Sampled 252 kg from truck bed #2 using portable field sieve set.',
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
    },
    {
      id: 'gt-bl02',
      blastId: blast2Id,
      manualFragments: [
        { id: 1, sizeMm: 198 },
        { id: 2, sizeMm: 175 },
        { id: 3, sizeMm: 122 },
        { id: 4, sizeMm: 110 },
        { id: 5, sizeMm: 88 },
        { id: 6, sizeMm: 54 },
      ],
      sieveData: [
        { apertureMm: 300, massRetainedKg: 12.0 },
        { apertureMm: 200, massRetainedKg: 38.0 },
        { apertureMm: 125, massRetainedKg: 78.5 },
        { apertureMm: 75, massRetainedKg: 62.0 },
        { apertureMm: 37.5, massRetainedKg: 34.0 },
        { apertureMm: 19, massRetainedKg: 21.0 },
        { apertureMm: 9.5, massRetainedKg: 12.5 },
        { apertureMm: 4.75, massRetainedKg: 9.0 },
      ],
      computedP20: 50,
      computedP50: 112,
      computedP80: 191,
      notes: '267 kg composite sample from center muck pile bench.',
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 3,
    },
    {
      id: 'gt-bl03',
      blastId: blast3Id,
      manualFragments: [
        { id: 1, sizeMm: 145 },
        { id: 2, sizeMm: 115 },
        { id: 3, sizeMm: 78 },
        { id: 4, sizeMm: 52 },
      ],
      sieveData: [
        { apertureMm: 300, massRetainedKg: 4.0 },
        { apertureMm: 200, massRetainedKg: 16.5 },
        { apertureMm: 125, massRetainedKg: 42.0 },
        { apertureMm: 75, massRetainedKg: 74.0 },
        { apertureMm: 37.5, massRetainedKg: 58.0 },
        { apertureMm: 19, massRetainedKg: 41.5 },
        { apertureMm: 9.5, massRetainedKg: 28.0 },
        { apertureMm: 4.75, massRetainedKg: 18.0 },
      ],
      computedP20: 34,
      computedP50: 76,
      computedP80: 139,
      notes: 'High fines content observed during screen shaking.',
      createdAt: now - 86400000 * 1,
      updatedAt: now,
    },
    {
      id: 'gt-bl04',
      blastId: blast4Id,
      manualFragments: [
        { id: 1, sizeMm: 245 },
        { id: 2, sizeMm: 185 },
        { id: 3, sizeMm: 142 },
        { id: 4, sizeMm: 110 },
      ],
      sieveData: [
        { apertureMm: 300, massRetainedKg: 22.0 },
        { apertureMm: 200, massRetainedKg: 45.0 },
        { apertureMm: 125, massRetainedKg: 65.0 },
        { apertureMm: 75, massRetainedKg: 52.0 },
      ],
      computedP20: 68,
      computedP50: 145,
      computedP80: 242,
      notes: 'Bétaré-Oya pit pilot sample.',
      createdAt: now - 86400000 * 0.5,
      updatedAt: now - 86400000 * 0.5,
    },
    {
      id: 'gt-bl05',
      blastId: blast5Id,
      manualFragments: [
        { id: 1, sizeMm: 228 },
        { id: 2, sizeMm: 165 },
        { id: 3, sizeMm: 148 },
        { id: 4, sizeMm: 95 },
      ],
      sieveData: [
        { apertureMm: 300, massRetainedKg: 16.0 },
        { apertureMm: 200, massRetainedKg: 48.0 },
        { apertureMm: 125, massRetainedKg: 72.0 },
        { apertureMm: 75, massRetainedKg: 58.0 },
      ],
      computedP20: 65,
      computedP50: 152,
      computedP80: 228,
      notes: 'Hole BH-05 verification sieve calibration sample.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const millBatches: MillBatch[] = [
    {
      id: 'mb-bl01',
      blastId: blast1Id,
      batchTonnageTonnes: 1420,
      truckCount: 71,
      meanLoadTonnes: 20,
      loadingHaulingCycleTimeMinutes: 28.5,
      bouldersSecondaryBreakingCount: 19,
      crushingTimeHours: 19.5,
      crushingEnergyKwh: 3450,
      millingThroughputTph: 52.0,
      millingEnergyKwh: 28600,
      headGradeGpt: 3.45,
      tailsGradeGpt: 0.62,
      concentrateGradeGpt: 142.0,
      concentrateMassTonnes: 28.4,
      processingNotes: 'Jaw crusher frequently choked by oversize boulders >300mm. Ball mill feed coarse.',
      crushingSpecificEnergyKwhPerT: Number((3450 / 1420).toFixed(2)),
      millingSpecificEnergyKwhPerT: Number((28600 / 1420).toFixed(2)),
      totalSpecificEnergyKwhPerT: Number(((3450 + 28600) / 1420).toFixed(2)),
      simpleGoldRecoveryPercent: Number((((3.45 - 0.62) / 3.45) * 100).toFixed(2)),
      twoProductGoldRecoveryPercent: Number((((142 * (3.45 - 0.62)) / (3.45 * (142 - 0.62))) * 100).toFixed(2)),
      oversizeRejectsPercent: 4.2,
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
    },
    {
      id: 'mb-bl02',
      blastId: blast2Id,
      batchTonnageTonnes: 1680,
      truckCount: 84,
      meanLoadTonnes: 20,
      loadingHaulingCycleTimeMinutes: 22.0,
      bouldersSecondaryBreakingCount: 3,
      crushingTimeHours: 18.0,
      crushingEnergyKwh: 2620,
      millingThroughputTph: 68.5,
      millingEnergyKwh: 24800,
      headGradeGpt: 3.60,
      tailsGradeGpt: 0.38,
      concentrateGradeGpt: 155.0,
      concentrateMassTonnes: 34.8,
      processingNotes: 'Optimal feed size. Jaw crusher ran smoothly without bridging. Highest gold recovery.',
      crushingSpecificEnergyKwhPerT: Number((2620 / 1680).toFixed(2)),
      millingSpecificEnergyKwhPerT: Number((24800 / 1680).toFixed(2)),
      totalSpecificEnergyKwhPerT: Number(((2620 + 24800) / 1680).toFixed(2)),
      simpleGoldRecoveryPercent: Number((((3.60 - 0.38) / 3.60) * 100).toFixed(2)),
      twoProductGoldRecoveryPercent: Number((((155 * (3.60 - 0.38)) / (3.60 * (155 - 0.38))) * 100).toFixed(2)),
      oversizeRejectsPercent: 0.8,
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: 'mb-bl03',
      blastId: blast3Id,
      batchTonnageTonnes: 1750,
      truckCount: 88,
      meanLoadTonnes: 19.9,
      loadingHaulingCycleTimeMinutes: 20.5,
      bouldersSecondaryBreakingCount: 0,
      crushingTimeHours: 16.5,
      crushingEnergyKwh: 2100,
      millingThroughputTph: 72.0,
      millingEnergyKwh: 22400,
      headGradeGpt: 3.52,
      tailsGradeGpt: 0.54,
      concentrateGradeGpt: 128.0,
      concentrateMassTonnes: 40.8,
      processingNotes: 'Rapid crushing throughput but excessive fines caused slime loss in gravity spiral recovery.',
      crushingSpecificEnergyKwhPerT: Number((2100 / 1750).toFixed(2)),
      millingSpecificEnergyKwhPerT: Number((22400 / 1750).toFixed(2)),
      totalSpecificEnergyKwhPerT: Number(((2100 + 22400) / 1750).toFixed(2)),
      simpleGoldRecoveryPercent: Number((((3.52 - 0.54) / 3.52) * 100).toFixed(2)),
      twoProductGoldRecoveryPercent: Number((((128 * (3.52 - 0.54)) / (3.52 * (128 - 0.54))) * 100).toFixed(2)),
      oversizeRejectsPercent: 0.2,
      createdAt: now - 86400000 * 1,
      updatedAt: now - 86400000 * 1,
    },
    {
      id: 'mb-bl04',
      blastId: blast4Id,
      batchTonnageTonnes: 1550,
      truckCount: 78,
      meanLoadTonnes: 19.8,
      loadingHaulingCycleTimeMinutes: 24.0,
      bouldersSecondaryBreakingCount: 5,
      crushingTimeHours: 17.5,
      crushingEnergyKwh: 2750,
      millingThroughputTph: 64.0,
      millingEnergyKwh: 25200,
      headGradeGpt: 3.50,
      tailsGradeGpt: 0.42,
      concentrateGradeGpt: 148.0,
      concentrateMassTonnes: 32.5,
      processingNotes: 'Bétaré-Oya production pilot test batch.',
      crushingSpecificEnergyKwhPerT: Number((2750 / 1550).toFixed(2)),
      millingSpecificEnergyKwhPerT: Number((25200 / 1550).toFixed(2)),
      totalSpecificEnergyKwhPerT: Number(((2750 + 25200) / 1550).toFixed(2)),
      simpleGoldRecoveryPercent: Number((((3.50 - 0.42) / 3.50) * 100).toFixed(2)),
      twoProductGoldRecoveryPercent: Number((((148 * (3.50 - 0.42)) / (3.50 * (148 - 0.42))) * 100).toFixed(2)),
      oversizeRejectsPercent: 1.2,
      createdAt: now - 86400000 * 0.5,
      updatedAt: now - 86400000 * 0.5,
    },
    {
      id: 'mb-bl05',
      blastId: blast5Id,
      batchTonnageTonnes: 1620,
      truckCount: 81,
      meanLoadTonnes: 20.0,
      loadingHaulingCycleTimeMinutes: 21.5,
      bouldersSecondaryBreakingCount: 2,
      crushingTimeHours: 17.0,
      crushingEnergyKwh: 2540,
      millingThroughputTph: 69.5,
      millingEnergyKwh: 24100,
      headGradeGpt: 3.65,
      tailsGradeGpt: 0.36,
      concentrateGradeGpt: 158.0,
      concentrateMassTonnes: 35.2,
      processingNotes: 'Hole BH-05 qualified production batch: smooth primary crushing and optimal gold recovery.',
      crushingSpecificEnergyKwhPerT: Number((2540 / 1620).toFixed(2)),
      millingSpecificEnergyKwhPerT: Number((24100 / 1620).toFixed(2)),
      totalSpecificEnergyKwhPerT: Number(((2540 + 24100) / 1620).toFixed(2)),
      simpleGoldRecoveryPercent: Number((((3.65 - 0.36) / 3.65) * 100).toFixed(2)),
      twoProductGoldRecoveryPercent: Number((((158 * (3.65 - 0.36)) / (3.65 * (158 - 0.36))) * 100).toFixed(2)),
      oversizeRejectsPercent: 0.7,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Attach default detailed drillholes to each seeded blast
  for (const b of blasts) {
    if (!b.drillHoles || b.drillHoles.length === 0) {
      b.drillHoles = generateDefaultDrillHolesFromBlast(b);
    }
  }

  // Store in Dexie
  await db.transaction('rw', [db.projects, db.sites, db.blasts, db.images, db.segmentationRuns, db.groundTruths, db.millBatches], async () => {
    await db.projects.put(project);
    await db.sites.put(site);
    for (const b of blasts) await db.blasts.put(b);
    for (const img of images) await db.images.put(img);
    for (const run of runs) await db.segmentationRuns.put(run);
    for (const gt of groundTruths) await db.groundTruths.put(gt);
    for (const mb of millBatches) await db.millBatches.put(mb);
  });

  return projectId;
}
