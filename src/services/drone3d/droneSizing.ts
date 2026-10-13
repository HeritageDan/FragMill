// Drone 3D Photogrammetry & Orthomosaic Stereological Processing Service

import type { DroneOrthomosaicData, MuckpileSector, Point3D } from '../../types/advanced';

/**
 * Convert 2D sieve size to 3D volumetric rock ellipsoid volume:
 * V = (pi / 6) * length * width * height
 * Assuming elongation ratio e = width/length = 0.7 and flatness ratio f = thickness/width = 0.6
 */
export function calculate3DRockVolume(sizeMm: number, elongation = 0.7, flatness = 0.6): number {
  const length = sizeMm;
  const width = length * elongation;
  const height = width * flatness;
  return (Math.PI / 6) * length * width * height; // mm^3
}

/**
 * Stereological correction factor based on Rosin-Rammler and Cunningham 3D expansion:
 * Compensates for hidden fines underneath boulders and 2D truncation bias.
 */
export function apply3DStereologicalCorrection(
  p50_2D_mm: number,
  p80_2D_mm: number,
  layerThicknessMm = 800
): { p10_3D_mm: number; p50_3D_mm: number; p80_3D_mm: number; oversize_3D_percent: number } {
  // 3D stereological conversion shifts distribution slightly coarser for oversize and accounts for hidden fines
  const stereologicalFactor = 1.0 + Math.min(0.25, layerThicknessMm / 5000);
  const correctedP50 = p50_2D_mm * 0.94; // Hidden fines slightly lower the true volumetric P50
  const correctedP80 = p80_2D_mm * stereologicalFactor; // True volumetric mass is skewed by large boulders
  const correctedP10 = Math.max(1, correctedP50 * 0.28);
  const oversizeThreshold = 600; // mm
  const oversizeRatio = Math.max(0, Math.min(100, (correctedP80 / oversizeThreshold) * 18));

  return {
    p10_3D_mm: Math.round(correctedP10),
    p50_3D_mm: Math.round(correctedP50),
    p80_3D_mm: Math.round(correctedP80),
    oversize_3D_percent: parseFloat(oversizeRatio.toFixed(1)),
  };
}

/**
 * Generates synthetic drone photogrammetry orthomosaic and sectors for Bétaré Oya gold mine
 */
export function generateDemoDroneSurvey(blastId: string): DroneOrthomosaicData {
  const sectors: MuckpileSector[] = [
    {
      id: 'sec-crest',
      name: 'Crest / Free Face Ejection Zone',
      zone: 'crest',
      color: '#3b82f6', // blue
      polygon: [
        { x: 0.1, y: 0.05 },
        { x: 0.9, y: 0.05 },
        { x: 0.85, y: 0.3 },
        { x: 0.15, y: 0.3 },
      ],
      p10Mm: 18,
      p50Mm: 75,
      p80Mm: 165,
      topSizeMm: 320,
      oversizePercent: 2.1,
      volumeM3: 420,
    },
    {
      id: 'sec-middle',
      name: 'Central Heaped Muckpile (Main Body)',
      zone: 'middle',
      color: '#10b981', // emerald
      polygon: [
        { x: 0.15, y: 0.3 },
        { x: 0.85, y: 0.3 },
        { x: 0.8, y: 0.7 },
        { x: 0.2, y: 0.7 },
      ],
      p10Mm: 24,
      p50Mm: 110,
      p80Mm: 245,
      topSizeMm: 480,
      oversizePercent: 5.4,
      volumeM3: 1150,
    },
    {
      id: 'sec-toe',
      name: 'Toe Confinement / Heavy Boulder Apron',
      zone: 'toe',
      color: '#f59e0b', // amber
      polygon: [
        { x: 0.2, y: 0.7 },
        { x: 0.8, y: 0.7 },
        { x: 0.95, y: 0.95 },
        { x: 0.05, y: 0.95 },
      ],
      p10Mm: 35,
      p50Mm: 180,
      p80Mm: 395,
      topSizeMm: 720,
      oversizePercent: 14.8,
      volumeM3: 680,
    },
    {
      id: 'sec-backbreak',
      name: 'Backbreak / Crest Tension Cracks',
      zone: 'backbreak',
      color: '#ef4444', // red
      polygon: [
        { x: 0.05, y: 0.0 },
        { x: 0.95, y: 0.0 },
        { x: 0.9, y: 0.05 },
        { x: 0.1, y: 0.05 },
      ],
      p10Mm: 42,
      p50Mm: 220,
      p80Mm: 460,
      topSizeMm: 850,
      oversizePercent: 21.5,
      volumeM3: 190,
    },
  ];

  const totalVolume = sectors.reduce((sum, s) => sum + s.volumeM3, 0);
  const weightedP80 = Math.round(
    sectors.reduce((sum, s) => sum + s.p80Mm * s.volumeM3, 0) / totalVolume
  );

  return {
    id: `ortho-${Date.now()}`,
    blastId,
    name: `DJI_Matrice300_RTK_Survey_${blastId}`,
    imageUrl: '', // Will be drawn procedurally or uploaded
    metadata: {
      flightAltitudeM: 45.0,
      gsdMmPerPx: 1.25, // 1.25 mm/pixel resolution
      cameraSensor: 'Zenmuse P1 45MP Full-Frame',
      focalLengthMm: 35.0,
      overlapForwardPercent: 80,
      overlapSidePercent: 75,
      surveyDate: new Date().toISOString().slice(0, 10),
      crs: 'WGS84 / UTM Zone 33N (Cameroon)',
    },
    meshPointsCount: 48520,
    totalVolumeM3: totalVolume,
    sectors,
    averageP80Mm: weightedP80,
  };
}

/**
 * Generate a 3D elevation point cloud grid representing the muckpile
 */
export function generateMuckpile3DMesh(cols = 30, rows = 20, maxZ = 6.0): Point3D[] {
  const points: Point3D[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1); // 0..1
      const v = r / (rows - 1); // 0..1

      // Parabolic muckpile mound with natural roughness
      const moundHeight = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * maxZ;
      const noise = (Math.sin(u * 14) + Math.cos(v * 16)) * 0.25;
      const z = Math.max(0, moundHeight + noise);

      points.push({
        x: (u - 0.5) * 40, // 40m bench length
        y: (v - 0.5) * 25, // 25m throw distance
        z,
      });
    }
  }
  return points;
}
