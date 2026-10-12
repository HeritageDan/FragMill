// FragMill Bilingual Internationalization (EN / FR)

export type Language = 'en' | 'fr';

export const translations = {
  en: {
    // App header & nav
    appTitle: 'FragMill: Blast-to-Mill Fragmentation Lab',
    tagline: 'Artisanal & Small-Scale Mining Rock Fragmentation & Recovery Tool',
    projects: 'Projects',
    sites: 'Sites',
    blasts: 'Blasts',
    fieldMode: 'Field Mode',
    expertMode: 'Expert Mode',
    demoProject: 'Demo Project',
    newBlast: 'New Blast',
    wizard: 'Field Wizard',
    analysis: 'Image Analysis',
    validation: 'Ground Truth & Validation',
    mineToMill: 'Mine-to-Mill',
    kuzRam: 'Kuz-Ram & Bayesian',
    blastAdvisor: 'Blast Advisor',
    reports: 'Reports & Export',
    settings: 'Settings',
    help: 'Guide & Help',

    // Wizard Steps
    step1Blast: '1. Blast Record',
    step2Photos: '2. Photos & Quality',
    step3Scale: '3. Scale Calibration',
    step4Analyse: '4. Segmentation Engine',
    step5Result: '5. Curves & Recovery',

    // Blast Fields
    blastId: 'Blast Identifier',
    dateTime: 'Date & Time',
    benchHeight: 'Bench Height (m)',
    holeDiameter: 'Hole Diameter (mm)',
    holeDepth: 'Hole Depth (m)',
    subdrill: 'Subdrill (m)',
    burden: 'Burden B (m)',
    spacing: 'Spacing S (m)',
    stemmingLength: 'Stemming T (m)',
    numberOfHoles: 'Number of Holes',
    holeInclination: 'Hole Inclination (°)',
    explosiveType: 'Explosive Type',
    rws: 'Relative Weight Strength (RWS, ANFO=100)',
    chargePerHole: 'Charge per Hole (kg)',
    bottomChargeLength: 'Bottom Charge Length (m)',
    columnChargeLength: 'Column Charge Length (m)',
    initiationSequence: 'Initiation Sequence / Delay Notes',
    waterInHoles: 'Water in Blast Holes',
    drillingDeviation: 'Drilling Deviation Est. (m)',
    weather: 'Weather Conditions',
    notes: 'Blast Notes',

    // Rock Mass Fields
    rockType: 'Rock Type',
    density: 'Rock Density (t/m³)',
    jointSetCount: 'Joint Set Count',
    meanJointSpacing: 'Mean Joint Spacing (m)',
    jointOrientation: 'Joint Orientation',
    dipOutOfFace: 'Dip Out of Face (Unfavourable)',
    strikePerpendicular: 'Strike Perpendicular',
    dipIntoFace: 'Dip Into Face (Favourable)',
    gsiOrRmr: 'Estimated GSI / RMR',
    ucsMPa: 'UCS (MPa)',
    youngsModulusGPa: "Young's Modulus E (GPa)",

    // Derived Blast Values
    blastedVolume: 'Blasted Volume (m³)',
    blastedTonnage: 'Blasted Tonnage (t)',
    totalExplosive: 'Total Explosive (kg)',
    powderFactor: 'Powder Factor (kg/m³)',
    burdenDiameterRatio: 'Burden / Hole Diam. Ratio',
    spacingBurdenRatio: 'Spacing / Burden Ratio (S/B)',
    stemmingBurdenRatio: 'Stemming / Burden Ratio (T/B)',
    specificDrilling: 'Specific Drilling (m/m³)',

    // Quality Checks
    qualityChecks: 'Image Quality Assessment',
    blurCheck: 'Sharpness / Blur (Laplacian)',
    exposureCheck: 'Exposure / Clipping',
    contrastCheck: 'Contrast / Dust Haze',
    resolutionCheck: 'Image Resolution',
    scaleMarkerCheck: 'Scale Reference Detected',
    pass: 'Pass',
    warn: 'Warning',
    fail: 'Fail',
    retakeAdvice: 'Field Capture Advice',

    // Calibration
    scaleCalibration: 'Scale Calibration & Perspective',
    twoPointMethod: 'Two-Point Scale Bar',
    fourPointMethod: 'Four-Point Homography',
    arucoMethod: 'Automatic ArUco Marker',
    referenceLengthMm: 'Reference Bar Length (mm)',
    scaleResult: 'Pixel Scale',
    calibrationSelfTest: 'Synthetic Calibration Self-Test',
    printA4Target: 'Generate Printable A4 Scale Sheet (PDF)',

    // Engines
    engineA: 'Engine A: Classical (OpenCV/WASM)',
    engineB: 'Engine B: In-Browser AI (SAM 2.1 / SlimSAM)',
    engineC: 'Engine C: Hybrid (AI Seeds + Watershed)',
    manualEditEngine: 'Manual Segmentation Review',

    // Manual Editing
    manualEditorTitle: 'Manual Fragment Editing Suite',
    addFragment: 'Add Fragment (Polygon)',
    deleteFragment: 'Delete Fragment',
    mergeFragments: 'Merge 2 Fragments',
    splitFragment: 'Split Fragment',
    paintFines: 'Brush Fines Region',
    undo: 'Undo',
    redo: 'Redo',
    saveRunVersion: 'Save as New Version',

    // Measurements & Distribution
    sizeDefinition: 'Size Definition',
    minFeret: 'Minimum Feret Diameter (Sieve-Equivalent)',
    ecd: 'Equivalent Circular Diameter (ECD)',
    bboxMinor: 'Bounding Box Shorter Side',
    fragmentCount: 'Fragments Count',
    p10: 'P10 (mm)',
    p20: 'P20 (mm)',
    p50: 'P50 (mm)',
    p80: 'P80 (mm)',
    p90: 'P90 (mm)',
    oversizePercent: 'Oversize Boulder Fraction (> 300 mm)',
    finesPercent: 'Fines Fraction (< 25 mm)',
    swebrecCurve: 'Swebrec Distribution Fit',
    rosinRammlerCurve: 'Rosin-Rammler Fit',
    bootstrapInterval: '95% Bootstrap Resampling CI',

    // Validation
    groundTruthValidation: 'Ground Truth & Model Validation',
    manualMeasurements: 'Manual Caliper Measurements',
    sieveAnalysis: 'Screen / Sieve Analysis Data',
    parityPlot: 'Parity Plot (Image vs Sieve)',
    blandAltman: 'Bland-Altman Difference Plot',
    engineComparison: 'Engine A vs B vs C Comparison',
    errorThresholdExceeded: 'Validation Error Exceeds 15% Threshold',

    // Mine to Mill
    mineToMillTitle: 'Mine-to-Mill Processing Link',
    crushingEnergy: 'Specific Crushing Energy (kWh/t)',
    millingEnergy: 'Specific Milling Energy (kWh/t)',
    throughput: 'Milling Throughput (t/h)',
    simpleRecovery: 'Simple Gold Recovery R (%)',
    twoProductRecovery: 'Two-Product Gold Recovery R (%)',
    smallSampleWarning: 'Indicative only; sample size too small for firm conclusions (N < 8 blasts).',

    // Kuz Ram & Bayesian
    kuzRamTitle: 'Cunningham Kuz-Ram Blast Model',
    bayesianTitle: 'Bayesian MCMC Rock Factor Calibration',
    blastAdvisorTitle: 'Blast Advisor & Parameter Optimization',
    advisoryDisclaimer: 'Decision support only. Blast design changes must be reviewed and approved by a qualified blasting engineer and comply with local regulations and site safety rules.',

    // Gemini
    geminiTitle: 'Google Gemini Cloud AI Assistance (Optional)',
    geminiConsent: 'Enable Cloud AI Assistance (sends images to Google Gemini API for quality and geotechnical report reasoning).',
    apiKeyPlaceholder: 'Enter your Google AI Studio API Key',
    runGeminiReport: 'Generate Bilingual Engineering Commentary',

    // Reports & Export
    exportPdf: 'Export Full Blast PDF Report',
    exportCsv: 'Export Fragments CSV',
    exportXlsx: 'Export Excel Workbook (.xlsx)',
    exportCoco: 'Export COCO Dataset JSON (Anonymized)',
    backupProject: 'Backup Full Project (JSON)',
    restoreProject: 'Restore Project from JSON',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    loading: 'Processing...',
    success: 'Saved successfully',
    error: 'An error occurred',
  },
  fr: {
    // App header & nav
    appTitle: 'FragMill : Laboratoire Fragmentation Mine-au-Moulin',
    tagline: 'Outil de Fragmentation et Récupération d’Or pour l’Artisanat Minier (ASM)',
    projects: 'Projets',
    sites: 'Sites',
    blasts: 'Tirs de Mine',
    fieldMode: 'Mode Terrain',
    expertMode: 'Mode Expert',
    demoProject: 'Projet Démo',
    newBlast: 'Nouveau Tir',
    wizard: 'Assistant Terrain',
    analysis: 'Analyse d’Images',
    validation: 'Vérité Terrain & Validation',
    mineToMill: 'Mine-au-Moulin',
    kuzRam: 'Kuz-Ram & Bayésien',
    blastAdvisor: 'Conseiller de Tir',
    reports: 'Rapports & Exports',
    settings: 'Paramètres',
    help: 'Guide & Aide',

    // Wizard Steps
    step1Blast: '1. Paramètres du Tir',
    step2Photos: '2. Photos & Qualité',
    step3Scale: '3. Étalonnage d’Échelle',
    step4Analyse: '4. Moteur de Segmentation',
    step5Result: '5. Courbes & Récupération',

    // Blast Fields
    blastId: 'Identifiant du Tir',
    dateTime: 'Date et Heure',
    benchHeight: 'Hauteur de Gradin (m)',
    holeDiameter: 'Diamètre des Trous (mm)',
    holeDepth: 'Profondeur des Trous (m)',
    subdrill: 'Surforage (m)',
    burden: 'Banquette B (m)',
    spacing: 'Espacement S (m)',
    stemmingLength: 'Bourrage T (m)',
    numberOfHoles: 'Nombre de Trous',
    holeInclination: 'Inclinaison des Trous (°)',
    explosiveType: "Type d'Explosif",
    rws: 'Puissance Relative (RWS, ANFO=100)',
    chargePerHole: 'Charge par Trou (kg)',
    bottomChargeLength: 'Longueur Charge de Pied (m)',
    columnChargeLength: 'Longueur Charge de Colonne (m)',
    initiationSequence: "Séquence d'Amorçage / Délais",
    waterInHoles: 'Eau dans les Trous',
    drillingDeviation: 'Déviation Forage Estimée (m)',
    weather: 'Météo',
    notes: 'Notes de Tir',

    // Rock Mass Fields
    rockType: 'Type de Roche',
    density: 'Densité de la Roche (t/m³)',
    jointSetCount: 'Nombre de Familles de Discontinuités',
    meanJointSpacing: 'Espacement Moyen des Joints (m)',
    jointOrientation: 'Orientation des Discontinuités',
    dipOutOfFace: 'Pendage vers le Vide (Défavorable)',
    strikePerpendicular: 'Direction Perpendiculaire',
    dipIntoFace: 'Pendage vers le Massif (Favorable)',
    gsiOrRmr: 'GSI / RMR Estimé',
    ucsMPa: 'Résistance Compression Simple UCS (MPa)',
    youngsModulusGPa: "Module d'Young E (GPa)",

    // Derived Blast Values
    blastedVolume: 'Volume Abattu (m³)',
    blastedTonnage: 'Tonnage Abattu (t)',
    totalExplosive: 'Explosif Total (kg)',
    powderFactor: 'Consommation Spécifique (kg/m³)',
    burdenDiameterRatio: 'Rapport Banquette / Diamètre',
    spacingBurdenRatio: 'Rapport Espacement / Banquette (S/B)',
    stemmingBurdenRatio: 'Rapport Bourrage / Banquette (T/B)',
    specificDrilling: 'Foration Spécifique (m/m³)',

    // Quality Checks
    qualityChecks: "Contrôle Qualité de l'Image",
    blurCheck: 'Netteté / Flou (Laplacien)',
    exposureCheck: 'Exposition / Écrêtage',
    contrastCheck: 'Contraste / Poussière',
    resolutionCheck: "Résolution de l'Image",
    scaleMarkerCheck: "Marqueur d'Échelle Détecté",
    pass: 'Conforme',
    warn: 'Avertissement',
    fail: 'Échec',
    retakeAdvice: 'Conseils de Prise de Vue',

    // Calibration
    scaleCalibration: 'Étalonnage d’Échelle & Perspective',
    twoPointMethod: 'Mire à 2 Points',
    fourPointMethod: 'Homographie à 4 Points',
    arucoMethod: 'Marqueur ArUco Automatique',
    referenceLengthMm: 'Longueur Réelle de la Mire (mm)',
    scaleResult: 'Échelle en Pixels',
    calibrationSelfTest: 'Auto-Test Synthétique d’Étalonnage',
    printA4Target: 'Générer la Mire Imprimable A4 (PDF)',

    // Engines
    engineA: 'Moteur A : Classique (OpenCV/WASM)',
    engineB: 'Moteur B : IA Embarquée (SAM 2.1 / SlimSAM)',
    engineC: 'Moteur C : Hybride (Semences IA + Ligne de Partage)',
    manualEditEngine: 'Revue et Édition Manuelle',

    // Manual Editing
    manualEditorTitle: 'Outils d’Édition Manuelle des Fragments',
    addFragment: 'Ajouter un Fragment (Polygone)',
    deleteFragment: 'Supprimer le Fragment',
    mergeFragments: 'Fusionner 2 Fragments',
    splitFragment: 'Scinder le Fragment',
    paintFines: 'Pinceau Zone de Fines',
    undo: 'Annuler',
    redo: 'Rétablir',
    saveRunVersion: 'Enregistrer Nouvelle Version',

    // Measurements & Distribution
    sizeDefinition: 'Définition de la Dimension',
    minFeret: 'Diamètre de Féret Minimal (Équivalent Tamis)',
    ecd: 'Diamètre Circulaire Équivalent (ECD)',
    bboxMinor: 'Petit Côté Rectangle Englobant',
    fragmentCount: 'Nombre de Fragments',
    p10: 'P10 (mm)',
    p20: 'P20 (mm)',
    p50: 'P50 (mm)',
    p80: 'P80 (mm)',
    p90: 'P90 (mm)',
    oversizePercent: 'Blocs Hors-Gabarit (> 300 mm)',
    finesPercent: 'Fraction des Fines (< 25 mm)',
    swebrecCurve: 'Ajustement Modèle Swebrec',
    rosinRammlerCurve: 'Ajustement Rosin-Rammler',
    bootstrapInterval: 'Intervalle Bootstrap 95%',

    // Validation
    groundTruthValidation: 'Vérité Terrain & Validation des Modèles',
    manualMeasurements: 'Mesures Manuelles au Pied à Coulisse',
    sieveAnalysis: 'Données de Tamisage / Criblage',
    parityPlot: 'Diagramme de Parité (Image vs Tamis)',
    blandAltman: 'Diagramme Différentiel Bland-Altman',
    engineComparison: 'Comparaison Moteurs A, B et C',
    errorThresholdExceeded: "L'erreur de validation dépasse le seuil de 15%",

    // Mine to Mill
    mineToMillTitle: 'Lien Mine-au-Moulin & Usine',
    crushingEnergy: 'Énergie Spécifique Concassage (kWh/t)',
    millingEnergy: 'Énergie Spécifique Broyage (kWh/t)',
    throughput: 'Débit du Moulin (t/h)',
    simpleRecovery: 'Récupération Or Simple R (%)',
    twoProductRecovery: 'Récupération Or Deux Produits R (%)',
    smallSampleWarning: 'Indicatif uniquement ; échantillon trop réduit pour conclusions fermes (N < 8 tirs).',

    // Kuz Ram & Bayesian
    kuzRamTitle: 'Modèle de Tir Cunningham Kuz-Ram',
    bayesianTitle: 'Calibration Bayésienne MCMC du Facteur Roche',
    blastAdvisorTitle: 'Conseiller de Tir & Optimisation',
    advisoryDisclaimer: "Aide à la décision uniquement. Toute modification du plan de tir doit être revue et validée par un ingénieur de tir qualifié conformément aux réglementations locales et règles de sécurité de la mine.",

    // Gemini
    geminiTitle: 'Assistance IA Cloud Google Gemini (Optionnelle)',
    geminiConsent: 'Activer l’assistance IA Cloud (envoie les images à l’API Google Gemini pour contrôle qualité et rapport géotechnique).',
    apiKeyPlaceholder: 'Saisissez votre clé API Google AI Studio',
    runGeminiReport: 'Générer le Commentaire d’Ingénierie Bilingue',

    // Reports & Export
    exportPdf: 'Exporter le Rapport de Tir PDF Complet',
    exportCsv: 'Exporter les Fragments en CSV',
    exportXlsx: 'Exporter le Classeur Excel (.xlsx)',
    exportCoco: 'Exporter Jeu de Données JSON COCO (Anonymisé)',
    backupProject: 'Sauvegarder le Projet Complet (JSON)',
    restoreProject: 'Restaurer le Projet depuis JSON',

    // Common
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    loading: 'Traitement en cours...',
    success: 'Enregistré avec succès',
    error: 'Une erreur est survenue',
  },
};

export function t(key: keyof typeof translations.en, lang: Language = 'en'): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}

export function formatUnit(valMm: number, unit: 'mm' | 'cm' | 'in'): string {
  if (valMm === undefined || valMm === null || isNaN(valMm)) return '-';
  if (unit === 'cm') {
    return `${(valMm / 10).toFixed(1)} cm`;
  }
  if (unit === 'in') {
    return `${(valMm / 25.4).toFixed(2)} in`;
  }
  return `${Math.round(valMm)} mm`;
}
