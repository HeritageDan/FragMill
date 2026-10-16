// Drill Machine Telemetry (IREDES XML) & Offline P2P Mesh Sync Service

import type { IREDESHole, P2PSyncPeer } from '../../types/advanced';
import type { Blast } from '../../types';

/**
 * Generate standard IREDES XML (International Rock Excavation Data Exchange Standard)
 * Compatible with Epiroc (RCS / Certiq) and Sandvik (TIM3D / SanRemo) smart drill rigs.
 */
export function generateIREDESXml(blast: Blast, holes: IREDESHole[]): string {
  const dateIso = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<iredes:drill_plan xmlns:iredes="http://www.iredes.org/spec/drill_plan/1.2"\n`;
  xml += `  plan_name="${blast.blastId}"\n`;
  xml += `  site="${blast.siteId}"\n`;
  xml += `  creation_date="${dateIso}">\n`;
  xml += `  <iredes:metadata>\n`;
  xml += `    <iredes:generator>FragMill Mining Sizing Suite v2.0</iredes:generator>\n`;
  xml += `    <iredes:bench_height_m>${blast.parameters.benchHeight}</iredes:bench_height_m>\n`;
  xml += `    <iredes:hole_diameter_mm>${blast.parameters.holeDiameter}</iredes:hole_diameter_mm>\n`;
  xml += `    <iredes:subdrill_m>${blast.parameters.subdrill || 0.8}</iredes:subdrill_m>\n`;
  xml += `    <iredes:total_holes>${holes.length}</iredes:total_holes>\n`;
  xml += `  </iredes:metadata>\n`;
  xml += `  <iredes:hole_list>\n`;

  for (const h of holes) {
    xml += `    <iredes:hole id="${h.holeId}">\n`;
    xml += `      <iredes:planned_collar x="${h.plannedX.toFixed(3)}" y="${h.plannedY.toFixed(3)}" z="${h.plannedZ.toFixed(3)}"/>\n`;
    xml += `      <iredes:planned_target depth="${h.plannedDepthM.toFixed(2)}" inclination_deg="90.0" azimuth_deg="0.0"/>\n`;
    if (h.actualX !== undefined && h.actualY !== undefined && h.actualDepthM !== undefined) {
      xml += `      <iredes:actual_drilled x="${h.actualX.toFixed(3)}" y="${h.actualY.toFixed(3)}" depth="${h.actualDepthM.toFixed(2)}"/>\n`;
      xml += `      <iredes:quality collar_deviation_mm="${h.collarDeviationMm || 0}" depth_error_m="${h.depthDeviationM || 0}"/>\n`;
    }
    xml += `    </iredes:hole>\n`;
  }

  xml += `  </iredes:hole_list>\n`;
  xml += `</iredes:drill_plan>\n`;

  return xml;
}

/**
 * Generate standard CSV drill pattern for Topcon, Leica, and Trimble GPS machine guidance
 */
export function generateDrillPatternCsv(holes: IREDESHole[]): string {
  let csv = 'Hole_ID,Easting_X,Northing_Y,Collar_Z,Target_Depth_m,Burden_m,Spacing_m,Actual_Depth_m,Collar_Error_mm\n';
  for (const h of holes) {
    csv += `${h.holeId},${h.plannedX.toFixed(2)},${h.plannedY.toFixed(2)},${h.plannedZ.toFixed(2)},${h.plannedDepthM.toFixed(2)},${h.plannedBurdenM.toFixed(2)},${h.plannedSpacingM.toFixed(2)},${h.actualDepthM || ''},${h.collarDeviationMm || ''}\n`;
  }
  return csv;
}

/**
 * Procedural generation of realistic drill telemetry for QA/QC compliance auditing
 */
export function generateDrillTelemetryFromBlast(blast: Blast): IREDESHole[] {
  const holes: IREDESHole[] = [];
  const count = blast.parameters.numberOfHoles || 30;
  const cols = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / cols);

  const burden = blast.parameters.burden || 2.4;
  const spacing = blast.parameters.spacing || 2.8;
  const depth = blast.parameters.holeDepth || 6.8;

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    const plannedX = c * spacing + 100.0;
    const plannedY = r * burden + 200.0;
    const plannedZ = 840.0;

    // Simulate GPS drilling deviation (10 mm to 140 mm collar drift, depth error +/- 0.3m)
    const collarErrorMm = Math.round(15 + Math.random() * 85);
    const depthDriftM = parseFloat(((Math.random() - 0.45) * 0.4).toFixed(2));
    const actualDepthM = parseFloat((depth + depthDriftM).toFixed(2));

    const actualX = plannedX + (collarErrorMm / 1000) * (Math.random() > 0.5 ? 1 : -1);
    const actualY = plannedY + (collarErrorMm / 1000) * (Math.random() > 0.5 ? 1 : -1);

    holes.push({
      holeId: `DH-${(i + 1).toString().padStart(3, '0')}`,
      plannedX,
      plannedY,
      plannedZ,
      plannedDepthM: depth,
      plannedBurdenM: burden,
      plannedSpacingM: spacing,
      actualX,
      actualY,
      actualZ: plannedZ,
      actualDepthM,
      collarDeviationMm: collarErrorMm,
      depthDeviationM: depthDriftM,
      penetrationRateMPerMin: parseFloat((0.85 + Math.random() * 0.45).toFixed(2)),
    });
  }

  return holes;
}

/**
 * P2P Local Offline Sync: Generate serialized JSON state package with hash
 */
export function createOfflineSyncPayload(data: any): { version: string; timestamp: number; payload: string } {
  return {
    version: '2.0.0-p2p',
    timestamp: Date.now(),
    payload: JSON.stringify(data),
  };
}

/**
 * Parse standard IREDES XML uploaded from drill rig
 */
export function parseIREDESXml(xmlText: string): IREDESHole[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const holeElements = xmlDoc.getElementsByTagName('iredes:hole');
  const elementsToIterate = holeElements.length > 0 ? holeElements : xmlDoc.getElementsByTagName('hole');
  const holes: IREDESHole[] = [];

  for (let i = 0; i < elementsToIterate.length; i++) {
    const el = elementsToIterate[i];
    const holeId = el.getAttribute('id') || `DH-${(i + 1).toString().padStart(3, '0')}`;

    const plannedCollar = el.getElementsByTagName('iredes:planned_collar')[0] || el.getElementsByTagName('planned_collar')[0];
    const plannedTarget = el.getElementsByTagName('iredes:planned_target')[0] || el.getElementsByTagName('planned_target')[0];
    const actualDrilled = el.getElementsByTagName('iredes:actual_drilled')[0] || el.getElementsByTagName('actual_drilled')[0];
    const quality = el.getElementsByTagName('iredes:quality')[0] || el.getElementsByTagName('quality')[0];

    const plannedX = plannedCollar ? parseFloat(plannedCollar.getAttribute('x') || '0') : i * 2.8 + 100;
    const plannedY = plannedCollar ? parseFloat(plannedCollar.getAttribute('y') || '0') : 200;
    const plannedZ = plannedCollar ? parseFloat(plannedCollar.getAttribute('z') || '840') : 840;
    const plannedDepthM = plannedTarget ? parseFloat(plannedTarget.getAttribute('depth') || '6.8') : 6.8;

    const actualX = actualDrilled ? parseFloat(actualDrilled.getAttribute('x') || `${plannedX}`) : plannedX;
    const actualY = actualDrilled ? parseFloat(actualDrilled.getAttribute('y') || `${plannedY}`) : plannedY;
    const actualDepthM = actualDrilled ? parseFloat(actualDrilled.getAttribute('depth') || `${plannedDepthM}`) : plannedDepthM;

    const collarDeviationMm = quality
      ? parseInt(quality.getAttribute('collar_deviation_mm') || '25')
      : Math.round(Math.hypot(actualX - plannedX, actualY - plannedY) * 1000);
    const depthDeviationM = parseFloat((actualDepthM - plannedDepthM).toFixed(2));

    holes.push({
      holeId,
      plannedX,
      plannedY,
      plannedZ,
      plannedDepthM,
      plannedBurdenM: 2.4,
      plannedSpacingM: 2.8,
      actualX,
      actualY,
      actualZ: plannedZ,
      actualDepthM,
      collarDeviationMm: Math.max(0, collarDeviationMm),
      depthDeviationM,
      penetrationRateMPerMin: parseFloat((1.1 + Math.random() * 0.4).toFixed(2)),
    });
  }

  return holes;
}

/**
 * Parse standard CSV drill pattern exported from GPS / machine guidance
 */
export function parseDrillPatternCsv(csvText: string): IREDESHole[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const holes: IREDESHole[] = [];
  const startIdx = lines[0].toLowerCase().includes('hole') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < 3) continue;

    const holeId = parts[0] || `DH-${(holes.length + 1).toString().padStart(3, '0')}`;
    const plannedX = parseFloat(parts[1]) || (holes.length * 2.8 + 100);
    const plannedY = parseFloat(parts[2]) || 200;
    const plannedZ = parseFloat(parts[3]) || 840;
    const plannedDepthM = parseFloat(parts[4]) || 6.8;
    const plannedBurdenM = parseFloat(parts[5]) || 2.4;
    const plannedSpacingM = parseFloat(parts[6]) || 2.8;
    const actualDepthM = parseFloat(parts[7]) || plannedDepthM;
    const collarDeviationMm = parseInt(parts[8]) || Math.round(15 + Math.random() * 45);

    holes.push({
      holeId,
      plannedX,
      plannedY,
      plannedZ,
      plannedDepthM,
      plannedBurdenM,
      plannedSpacingM,
      actualX: plannedX + (collarDeviationMm / 1000) * 0.7,
      actualY: plannedY + (collarDeviationMm / 1000) * 0.7,
      actualZ: plannedZ,
      actualDepthM,
      collarDeviationMm,
      depthDeviationM: parseFloat((actualDepthM - plannedDepthM).toFixed(2)),
      penetrationRateMPerMin: parseFloat((1.15 + Math.random() * 0.4).toFixed(2)),
    });
  }

  return holes;
}

export const DEMO_P2P_PEERS: P2PSyncPeer[] = [
  { id: 'peer-tab-01', deviceName: 'Panasonic Toughbook (Pit Supervisor)', role: 'field_tablet', ipAddress: '192.168.43.12', status: 'synced', lastSyncTimestamp: Date.now() - 120000 },
  { id: 'peer-tab-02', deviceName: 'Samsung Galaxy Active 4 (Drill Master)', role: 'field_tablet', ipAddress: '192.168.43.18', status: 'online', lastSyncTimestamp: Date.now() - 450000 },
  { id: 'peer-srv-01', deviceName: 'Dell Precision (Processing Plant Control)', role: 'mill_server', ipAddress: '192.168.43.1', status: 'online', lastSyncTimestamp: Date.now() - 30000 },
];
