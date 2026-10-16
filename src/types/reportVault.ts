// Report Vault Types for FragMill Modular Reporting System

import type { Language } from '../i18n';
import type {
  Blast,
  Project,
  Site,
  ImageRecord,
  SegmentationRun,
  DerivedBlastMetrics,
  GroundTruth,
  MillBatch,
} from './index';
import type {
  DroneOrthomosaicData,
  BeltStats,
  BeltVisionConfig,
  CrusherChokeEvent,
  PPVEstimate,
  FaceProfilePoint,
  CircuitSimulationResult,
  BondCircuitParams,
  BoreholeSample,
  KrigingGridNode,
  VariogramParams,
  IREDESHole,
  P2PSyncPeer,
} from './advanced';

export type ReportSectionKey =
  | 'blast'        // 1. Tir & Images / Blast Records & Sizing
  | 'drone3d'      // 2. Drone 3D & Ortho
  | 'beltvision'   // 3. Vision Convoyeur
  | 'timing'       // 4. Chronogramme 3D & Front
  | 'comminution'  // 5. Jumeau Broyage Comminution
  | 'kriging'      // 6. Modèle Blocs & Krigeage
  | 'telemetry'    // 7. Foration IREDES P2P
  | 'benchmap'     // 8. Plan de Fosse
  | 'validation'   // 9. Vérité Terrain & Tamisage
  | 'minetomill'   // 10. Optimisation Mine-au-Moulin
  | 'kuzram';      // 11. Modélisation Kuz-Ram

export interface ReportSectionMeta {
  key: ReportSectionKey;
  order: number;
  titleFr: string;
  titleEn: string;
  tabNameFr: string;
  tabNameEn: string;
  descriptionFr: string;
  descriptionEn: string;
}

export const REPORT_SECTIONS_REGISTRY: Record<ReportSectionKey, ReportSectionMeta> = {
  blast: {
    key: 'blast',
    order: 1,
    titleFr: '1. Tir & Images : Géométrie, Massif Rocheux & Granulométrie Optique',
    titleEn: '1. Blast Records & Optical Sizing : Geometry, Rock Mass & PSD',
    tabNameFr: 'Tir & Images',
    tabNameEn: 'Blast Records & Sizing',
    descriptionFr: 'Paramètres du tir, profil de chargement 3 étages, propriétés du massif et courbe granulométrique P10-P90.',
    descriptionEn: 'Blast design, 3-deck charging profile, rock mass properties and optical P10-P90 distribution curve.',
  },
  drone3d: {
    key: 'drone3d',
    order: 2,
    titleFr: '2. Drone 3D & Photogrammétrie du Tas d’Abattage',
    titleEn: '2. UAV Drone 3D Photogrammetry & Muckpile Sizing',
    tabNameFr: 'Drone 3D & Ortho',
    tabNameEn: 'Drone 3D Sizing',
    descriptionFr: 'Métadonnées de vol drone (GSD, altitude), nuage 3D et granulométrie par secteur (Crête, Pied, Cœur, Arrière).',
    descriptionEn: 'Drone flight telemetry (GSD, altitude), 3D point cloud and sector sizing (Crest, Toe, Body, Backbreak).',
  },
  beltvision: {
    key: 'beltvision',
    order: 3,
    titleFr: '3. Vision Optique Temps Réel sur Bande Convoyeur',
    titleEn: '3. Real-Time Conveyor Belt Edge Vision & Boulder Audit',
    tabNameFr: 'Vision Convoyeur',
    tabNameEn: 'Belt Edge Vision',
    descriptionFr: 'Débit instantané (t/h), taux de charge bande, granulométrie en continu et alertes de blocage concasseur.',
    descriptionEn: 'Instantaneous tonnage (tph), belt loading, continuous PSD percentiles and crusher choke boulder alarms.',
  },
  timing: {
    key: 'timing',
    order: 4,
    titleFr: '4. Chronogramme de Tir 3D & Conformité Vibratoire USBM',
    titleEn: '4. 3D Blast Timing Simulation & USBM Ground Vibration Audit',
    tabNameFr: 'Séquence 3D & Front',
    tabNameEn: '3D Timing & Face',
    descriptionFr: 'Délais de surface et fond de trou, charge unitaire max (MIC), profil inclinométrique du front et VPP USBM.',
    descriptionEn: 'Surface & in-hole delay sequence, max charge per delay (MIC), face inclinometer profile and USBM PPV.',
  },
  comminution: {
    key: 'comminution',
    order: 5,
    titleFr: '5. Jumeau Numérique de Broyage (Bond & Morrell)',
    titleEn: '5. Comminution Digital Twin (Bond & Morrell)',
    tabNameFr: 'Jumeau Broyage (Bond)',
    tabNameEn: 'Comminution Twin',
    descriptionFr: 'Indice de Bond Wi, dureté Axb, énergies spécifiques concassage/broyage, gain de débit et économies d’énergie.',
    descriptionEn: 'Bond Work Index Wi, hardness Axb, specific grinding energy, throughput expansion and power savings.',
  },
  kriging: {
    key: 'kriging',
    order: 6,
    titleFr: '6. Modèle Géologique de Blocs & Krigeage Géostatistique',
    titleEn: '6. Geostatistical Block Model & Kriging Estimation',
    tabNameFr: 'Modèle Blocs & Krigeage',
    tabNameEn: 'Block Model & Kriging',
    descriptionFr: 'Paramètres du variogramme (portée, pépite, palier), interpolation BLUE de l’UCS/RQD et zonage de chargement.',
    descriptionEn: 'Variogram parameters (range, nugget, sill), BLUE spatial interpolation of UCS/RQD and domain zonation.',
  },
  telemetry: {
    key: 'telemetry',
    order: 7,
    titleFr: '7. Télémétrie de Foration MWD & Audit Qualité IREDES',
    titleEn: '7. Drill Rig MWD Telemetry & IREDES QA/QC Audit',
    tabNameFr: 'Foration IREDES & P2P',
    tabNameEn: 'Drill Telemetry & P2P',
    descriptionFr: 'Tolérance d’écart de collet, vitesse d’avancement (ROP), profondeur prévue vs forée et statut de synchronisation P2P.',
    descriptionEn: 'Collar deviation tolerance, rate of penetration (ROP), planned vs drilled depths and P2P mesh sync.',
  },
  benchmap: {
    key: 'benchmap',
    order: 8,
    titleFr: '8. Plan de Fosse Spatial & Réconciliation par Gradin',
    titleEn: '8. Open-Pit Bench Map & Spatial Blast Reconciliation',
    tabNameFr: 'Plan Fosse',
    tabNameEn: 'Bench Map',
    descriptionFr: 'Périmètre de sécurité des projections, maille de forage (banquette x espacement), volume abattu et tendance P80.',
    descriptionEn: 'Flyrock safety clearance perimeter, drilling pattern geometry, blasted volume and multi-blast P80 trend.',
  },
  validation: {
    key: 'validation',
    order: 9,
    titleFr: '9. Contrôle Vérité Terrain & Validation par Tamisage Physique',
    titleEn: '9. Physical Sieve Validation & Ground Truth Reconciliation',
    tabNameFr: 'Vérité Terrain',
    tabNameEn: 'Ground Truth & Sieve',
    descriptionFr: 'Coupes de bande, distribution granulométrique physique, résidus RMSE/MAE et coefficient de calibration optique.',
    descriptionEn: 'Physical belt cuts, mechanical sieve distribution, RMSE/MAE residuals and optical bias calibration factor.',
  },
  minetomill: {
    key: 'minetomill',
    order: 10,
    titleFr: '10. Optimisation Économique Mine-au-Moulin & Bilan Carbone',
    titleEn: '10. Mine-to-Mill Cost & Carbon Footprint Optimization',
    tabNameFr: 'Mine-au-Moulin',
    tabNameEn: 'Mine-to-Mill Lab',
    descriptionFr: 'Coûts unitaires forage, minage, concassage et broyage ($/t), P80 économique optimal et émissions CO2 Scope 1 & 2.',
    descriptionEn: 'Unit costs for drill, blast, crushing, milling ($/t), optimal economic P80 and Scope 1 & 2 carbon footprint.',
  },
  kuzram: {
    key: 'kuzram',
    order: 11,
    titleFr: '11. Modélisation Prédictive Kuz-Ram & Ajustement Bayésien',
    titleEn: '11. Kuz-Ram Empirical Blast Predictor & Bayesian Tuning',
    tabNameFr: 'Kuz-Ram & Bayésien',
    tabNameEn: 'Kuz-Ram & Advisor',
    descriptionFr: 'Facteur de roche A de Cunningham, indice d’uniformité n, taille caractéristique Xc et réconciliation bayésienne.',
    descriptionEn: 'Cunningham rock factor A, uniformity exponent n, characteristic size Xc and Bayesian posterior reconciliation.',
  },
};

export interface ReportSectionEntry {
  key: ReportSectionKey;
  stagedAt: number; // Unix timestamp
  titleFr: string;
  titleEn: string;
  summaryTextFr?: string;
  summaryTextEn?: string;
  payload: Record<string, any>;
}

export type ReportVaultState = Record<ReportSectionKey, ReportSectionEntry | null>;
