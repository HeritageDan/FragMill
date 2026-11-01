// Report Vault Types for FragMill Modular Reporting System

export type ReportSectionKey =
  | 'blast'        // 1. Tir & Images / Blast Records & Sizing
  | 'drone3d'      // 2. Drone 3D & Ortho
  | 'beltvision'   // 3. Vision Convoyeur
  | 'timing'       // 4. Chronogramme 3D & Front
  | 'comminution'  // 5. Jumeau Broyage Comminution
  | 'benchmap'     // 6. Plan de Fosse
  | 'validation'   // 7. Vérité Terrain & Tamisage
  | 'minetomill'   // 8. Optimisation Mine-au-Moulin
  | 'kuzram';      // 9. Modélisation Kuz-Ram

export interface ReportSectionMeta {
  key: ReportSectionKey;
  order: number;
  titleFr: string;
  titleEn: string;
  tabNameFr: string;
  tabNameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  workspaceTab: 'blast' | 'optimise' | 'validation' | 'experimental';
  subTab?: string;
}

export const REPORT_SECTIONS_REGISTRY: Record<ReportSectionKey, ReportSectionMeta> = {
  blast: {
    key: 'blast',
    order: 1,
    titleFr: '1. Tir & Images : Géométrie, Massif Rocheux & Granulométrie Optique',
    titleEn: '1. Blast Records & Optical Sizing : Geometry, Rock Mass & PSD',
    tabNameFr: 'Tir & Images (Tir)',
    tabNameEn: 'Record & Images (Blast)',
    descriptionFr: 'Paramètres du tir, profil de chargement 3 étages, propriétés du massif et courbe granulométrique P10-P90.',
    descriptionEn: 'Blast design, 3-deck charging profile, rock mass properties and optical P10-P90 distribution curve.',
    workspaceTab: 'blast',
    subTab: 'record',
  },
  drone3d: {
    key: 'drone3d',
    order: 2,
    titleFr: '2. Drone 3D & Photogrammétrie du Tas d’Abattage',
    titleEn: '2. UAV Drone 3D Photogrammetry & Muckpile Sizing',
    tabNameFr: 'Drone 3D (Expérimental)',
    tabNameEn: 'Drone 3D Sizing (Experimental)',
    descriptionFr: 'Métadonnées de vol drone (GSD, altitude), nuage 3D et granulométrie par secteur (Crête, Pied, Cœur, Arrière).',
    descriptionEn: 'Drone flight telemetry (GSD, altitude), 3D point cloud and sector sizing (Crest, Toe, Body, Backbreak).',
    workspaceTab: 'experimental',
    subTab: 'drone3d',
  },
  beltvision: {
    key: 'beltvision',
    order: 3,
    titleFr: '3. Vision Optique Temps Réel sur Bande Convoyeur',
    titleEn: '3. Real-Time Conveyor Belt Edge Vision & Boulder Audit',
    tabNameFr: 'Vision Convoyeur (Expérimental)',
    tabNameEn: 'Belt Edge Vision (Experimental)',
    descriptionFr: 'Débit instantané (t/h), taux de charge bande, granulométrie en continu et alertes de blocage concasseur.',
    descriptionEn: 'Instantaneous tonnage (tph), belt loading, continuous PSD percentiles and crusher choke boulder alarms.',
    workspaceTab: 'experimental',
    subTab: 'beltvision',
  },
  timing: {
    key: 'timing',
    order: 4,
    titleFr: '4. Chronogramme de Tir 3D & Conformité Vibratoire USBM',
    titleEn: '4. 3D Blast Timing Simulation & USBM Ground Vibration Audit',
    tabNameFr: 'Initiation & Vibration (Tir)',
    tabNameEn: 'Initiation & Vibration (Blast)',
    descriptionFr: 'Délais de surface et fond de trou, charge unitaire max (MIC), profil inclinométrique du front et VPP USBM.',
    descriptionEn: 'Surface & in-hole delay sequence, max charge per delay (MIC), face inclinometer profile and USBM PPV.',
    workspaceTab: 'blast',
    subTab: 'timing',
  },
  comminution: {
    key: 'comminution',
    order: 5,
    titleFr: '5. Jumeau Numérique de Broyage (Bond & Morrell)',
    titleEn: '5. Comminution Digital Twin (Bond & Morrell)',
    tabNameFr: 'Circuit Twin (Optimiser)',
    tabNameEn: 'Circuit Twin (Optimise)',
    descriptionFr: 'Indice de Bond Wi, dureté Axb, énergies spécifiques concassage/broyage, gain de débit et économies d’énergie.',
    descriptionEn: 'Bond Work Index Wi, hardness Axb, specific grinding energy, throughput expansion and power savings.',
    workspaceTab: 'optimise',
    subTab: 'twin',
  },
  benchmap: {
    key: 'benchmap',
    order: 6,
    titleFr: '6. Plan de Fosse Spatial & Réconciliation par Gradin',
    titleEn: '6. Open-Pit Bench Map & Spatial Blast Reconciliation',
    tabNameFr: 'Plan de Fosse (Tir)',
    tabNameEn: 'Pattern Map (Blast)',
    descriptionFr: 'Périmètre de sécurité des projections, maille de forage (banquette x espacement), volume abattu et tendance P80.',
    descriptionEn: 'Flyrock safety clearance perimeter, drilling pattern geometry, blasted volume and multi-blast P80 trend.',
    workspaceTab: 'blast',
    subTab: 'pattern',
  },
  validation: {
    key: 'validation',
    order: 7,
    titleFr: '7. Contrôle Vérité Terrain & Validation par Tamisage Physique',
    titleEn: '7. Physical Sieve Validation & Ground Truth Reconciliation',
    tabNameFr: 'Vérité Terrain',
    tabNameEn: 'Ground Truth & Sieve',
    descriptionFr: 'Coupes de bande, distribution granulométrique physique, résidus RMSE/MAE et coefficient de calibration optique.',
    descriptionEn: 'Physical belt cuts, mechanical sieve distribution, RMSE/MAE residuals and optical bias calibration factor.',
    workspaceTab: 'validation',
  },
  minetomill: {
    key: 'minetomill',
    order: 8,
    titleFr: '8. Optimisation Économique Mine-au-Moulin & Bilan Carbone',
    titleEn: '8. Mine-to-Mill Cost & Carbon Footprint Optimization',
    tabNameFr: 'Mine-au-Moulin (Optimiser)',
    tabNameEn: 'Mine-to-Mill (Optimise)',
    descriptionFr: 'Coûts unitaires forage, minage, concassage et broyage ($/t), P80 économique optimal et émissions CO2 Scope 1 & 2.',
    descriptionEn: 'Unit costs for drill, blast, crushing, milling ($/t), optimal economic P80 and Scope 1 & 2 carbon footprint.',
    workspaceTab: 'optimise',
    subTab: 'minetomill',
  },
  kuzram: {
    key: 'kuzram',
    order: 9,
    titleFr: '9. Modélisation Prédictive Kuz-Ram & Ajustement Bayésien',
    titleEn: '9. Kuz-Ram Empirical Blast Predictor & Bayesian Tuning',
    tabNameFr: 'Kuz-Ram & Calibrage (Optimiser)',
    tabNameEn: 'Kuz-Ram & Calibration (Optimise)',
    descriptionFr: 'Facteur de roche A de Cunningham, indice d’uniformité n, taille caractéristique Xc et réconciliation bayésienne.',
    descriptionEn: 'Cunningham rock factor A, uniformity exponent n, characteristic size Xc and Bayesian posterior reconciliation.',
    workspaceTab: 'optimise',
    subTab: 'kuzram',
  },
};

export interface ReportSectionEntry {
  blastId: string;
  key: ReportSectionKey;
  stagedAt: number; // Unix timestamp
  titleFr: string;
  titleEn: string;
  summaryTextFr?: string;
  summaryTextEn?: string;
  payload: Record<string, any>;
}

export type ReportVaultState = Record<ReportSectionKey, ReportSectionEntry | null>;

/**
 * Returns available report section keys sorted by section order.
 * Excludes experimental sections unless showExperimental is true.
 */
export function getAvailableSectionKeys(showExperimental: boolean = false): ReportSectionKey[] {
  return (Object.keys(REPORT_SECTIONS_REGISTRY) as ReportSectionKey[])
    .filter((key) => {
      const meta = REPORT_SECTIONS_REGISTRY[key];
      if (!showExperimental && meta.workspaceTab === 'experimental') {
        return false;
      }
      return true;
    })
    .sort((a, b) => REPORT_SECTIONS_REGISTRY[a].order - REPORT_SECTIONS_REGISTRY[b].order);
}
