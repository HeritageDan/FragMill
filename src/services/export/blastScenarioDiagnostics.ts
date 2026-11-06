/**
 * Scenario-Driven Engineering Diagnostic Engine for FragMill Blasting & Comminution.
 * Generates tailored, dynamic geotechnical assessments and downstream comminution reconciliations
 * for different operational scenarios (hard/soft rock, under/over-charging, tight/optimal timing,
 * flyrock/airblast hazard, USBM ground vibration, mill power draw and economics).
 */

import type { Blast, FragmentationMetrics } from '../../types';
import type { BlastState } from '../blastState';

export interface BlastDiagnosticSummary {
  energyMatch: {
    status: 'optimal' | 'undercharged' | 'overcharged';
    titleFr: string;
    titleEn: string;
    analysisFr: string;
    analysisEn: string;
  };
  geometry: {
    stiffnessStatus: 'optimal' | 'critical_low' | 'high_flexible';
    stemmingStatus: 'safe' | 'short_flyrock_risk' | 'excessive_boulder_risk';
    subdrillStatus: 'optimal' | 'toe_risk' | 'excessive_cost';
    stiffnessHB: number;
    stemmingTB: number;
    subdrillJB: number;
    notesFr: string;
    notesEn: string;
  };
  timing: {
    reliefRateMsPerM: number;
    status: 'optimal' | 'choked_confinement' | 'excessive_delay';
    vibrationUSBM: {
      ppvMmPerS: number;
      isCompliant: boolean;
      commentFr: string;
      commentEn: string;
    };
    notesFr: string;
    notesEn: string;
  };
  comminution: {
    crusherChokeRisk: boolean;
    sagMillImpact: 'boost' | 'neutral' | 'bottleneck';
    throughputDeltaTph: number;
    powerSavingsKwhPerT: number;
    notesFr: string;
    notesEn: string;
  };
  economics: {
    isNetPositive: boolean;
    netBenefitPerTonUSD: number;
    notesFr: string;
    notesEn: string;
  };
  kuzRamReconciliation: {
    divergencePercent: number;
    verdictFr: string;
    verdictEn: string;
  };
}

export function computeBlastDiagnosticSummary(
  blast: Blast,
  blastState: BlastState,
  metricsOverride?: FragmentationMetrics
): BlastDiagnosticSummary {
  const p = blast.parameters || (blastState?.geometry ? {
    burden: blastState.geometry.burden,
    spacing: blastState.geometry.spacing,
    benchHeight: blastState.geometry.benchHeight,
    holeDiameter: blastState.geometry.holeDiameterMm,
    subdrill: blastState.geometry.subdrill,
    stemmingLength: blastState.geometry.stemmingLength,
    chargePerHole: blastState.explosive?.chargePerHole,
    explosiveType: blastState.explosive?.explosiveType,
  } as any : {}) || {};
  const rock = blast.rockMass || {
    rockType: blastState?.rock?.rockType || 'Standard Granite / Rock',
    ucsMPa: blastState?.rock?.ucsMPa || 110,
    density: blastState?.rock?.densityTPerM3 || 2.7,
    youngsModulusGPa: 50,
    poissonsRatio: 0.25,
    jointSpacingM: 1.0,
    jointDipDeg: 0,
    rqdPercent: 80,
  };
  const metrics = metricsOverride || blast.images?.[0]?.segmentationRuns?.[0]?.metrics || {
    p50: blastState.optical.p50Mm,
    p80: blastState.optical.p80Mm,
    oversizePercent: blastState.optical.oversizePercent,
    finesPercent: blastState.optical.finesPercent,
    uniformityIndex: blastState.optical.uniformityIndex,
  };

  const burden = Math.max(1, p.burden || 3.5);
  const spacing = Math.max(1, p.spacing || 4.2);
  const benchH = Math.max(1, p.benchHeight || 10);
  const stemming = p.stemmingLength || burden * 0.9;
  const subdrill = p.subdrill || burden * 0.3;
  const charge = p.chargePerHole || 85;
  const ucs = rock.ucsMPa || 110;
  const density = rock.density || 2.7;

  // Powder factor (kg/m3)
  const volPerHole = burden * spacing * benchH;
  const pf = Number((charge / volPerHole).toFixed(2));

  // 1. Energy Match
  let energyStatus: 'optimal' | 'undercharged' | 'overcharged' = 'optimal';
  let titleFr = 'Adéquation Énergétique Optimale';
  let titleEn = 'Optimal Powder Factor Match';
  let analysisFr = `Charge spécifique équilibrée (q = ${pf} kg/m³) pour un massif de ${rock.rockType} (UCS ${ucs} MPa). Fragmentation homogène sans surpulvérisation.`;
  let analysisEn = `Balanced powder factor (PF = ${pf} kg/m³) for ${rock.rockType} (UCS ${ucs} MPa). Uniform fragmentation without excessive pulverization.`;

  if (ucs > 130 && pf < 0.55) {
    energyStatus = 'undercharged';
    titleFr = 'Sous-dosage Énergétique en Roche Dure';
    titleEn = 'Undercharged Powder Factor in Hard Rock';
    analysisFr = `La charge spécifique (q = ${pf} kg/m³) est trop faible face à la résistance du massif (UCS ${ucs} MPa, densité ${density} t/m³). Risque élevé de blocs primaires (>300 mm : ${metrics.oversizePercent}%) et de pieds de butte au marinage.`;
    analysisEn = `Powder factor (PF = ${pf} kg/m³) is insufficient for high-strength rock (UCS ${ucs} MPa, density ${density} t/m³). High risk of oversize boulders (>300 mm: ${metrics.oversizePercent}%) and toe stumps during mucking.`;
  } else if (ucs < 55 && pf > 0.65) {
    energyStatus = 'overcharged';
    titleFr = 'Surdosage Énergétique en Roche Tendre';
    titleEn = 'Overcharged Powder Factor in Weak Rock';
    analysisFr = `La charge spécifique (q = ${pf} kg/m³) est excessive pour un massif tendre (UCS ${ucs} MPa). Elle engendre une surfragmentation avec production de micro-fines (<25 mm : ${metrics.finesPercent}%) et un risque accru de projections.`;
    analysisEn = `Powder factor (PF = ${pf} kg/m³) is excessive for soft rock (UCS ${ucs} MPa). Results in collar pulverization, micro-fines generation (<25 mm: ${metrics.finesPercent}%), and elevated flyrock risk.`;
  }

  // 2. Geometry Ratios
  const stiffnessHB = Number((benchH / burden).toFixed(2));
  const stemmingTB = Number((stemming / burden).toFixed(2));
  const subdrillJB = Number((subdrill / burden).toFixed(2));

  let stiffnessStatus: 'optimal' | 'critical_low' | 'high_flexible' = 'optimal';
  let geomFr = '';
  let geomEn = '';

  if (stiffnessHB < 2.0) {
    stiffnessStatus = 'critical_low';
    geomFr += `Rapport de rigidité critique (H/B = ${stiffnessHB} < 2.0) : gradin rigide générant de fortes vibrations au sol, des rebords en crête et des culots durs. `;
    geomEn += `Critical low stiffness ratio (H/B = ${stiffnessHB} < 2.0): rigid bench behavior inducing ground vibration, crest backbreak, and toe stumps. `;
  } else if (stiffnessHB > 3.5) {
    stiffnessStatus = 'high_flexible';
    geomFr += `Rapport de rigidité souple (H/B = ${stiffnessHB}) : bon déplacement du tas, veiller à la déviation des trous profonds. `;
    geomEn += `Flexible bench ratio (H/B = ${stiffnessHB}): excellent heave, monitor deep hole deviation. `;
  } else {
    geomFr += `Rapport de rigidité optimal (H/B = ${stiffnessHB} dans [2.0, 3.5]). `;
    geomEn += `Optimal stiffness ratio (H/B = ${stiffnessHB} in [2.0, 3.5]). `;
  }

  let stemmingStatus: 'safe' | 'short_flyrock_risk' | 'excessive_boulder_risk' = 'safe';
  if (stemmingTB < 0.75) {
    stemmingStatus = 'short_flyrock_risk';
    geomFr += `Bourrage court critique (T/B = ${stemmingTB} < 0.75) : risque sévère de projection de blocs (flyrock) et surpression aérienne. `;
    geomEn += `Critical short stemming (T/B = ${stemmingTB} < 0.75): high risk of cratering, flyrock projection, and airblast. `;
  } else if (stemmingTB > 1.2) {
    stemmingStatus = 'excessive_boulder_risk';
    geomFr += `Bourrage long (T/B = ${stemmingTB} > 1.2) : zone de collet non chargée génératrice de gros blocs en surface. `;
    geomEn += `Heavy stemming collar (T/B = ${stemmingTB} > 1.2): uncharged collar generates oversize cap-rock boulders. `;
  }

  let subdrillStatus: 'optimal' | 'toe_risk' | 'excessive_cost' = 'optimal';
  if (subdrillJB < 0.2) {
    subdrillStatus = 'toe_risk';
    geomFr += `Sous-forage faible (J/B = ${subdrillJB} < 0.2) : risque de pied de tir résiduel au niveau du carreau.`;
    geomEn += `Insufficient subdrill (J/B = ${subdrillJB} < 0.2): risk of unblasted toe stumps along bench floor.`;
  } else if (subdrillJB > 0.4) {
    subdrillStatus = 'excessive_cost';
    geomFr += `Sur-forage excessif (J/B = ${subdrillJB} > 0.4) : gaspillage d'explosif et fissuration du gradin inférieur.`;
    geomEn += `Excessive subdrill (J/B = ${subdrillJB} > 0.4): wasted explosive energy and damage to lower bench grade.`;
  }

  // 3. Timing & Vibration
  const surfaceDelay = blastState.timing.surfaceDelayMs || 25;
  const reliefRate = Number((surfaceDelay / burden).toFixed(1));
  let timingStatus: 'optimal' | 'choked_confinement' | 'excessive_delay' = 'optimal';
  let timingFr = '';
  let timingEn = '';

  if (reliefRate < 3.2) {
    timingStatus = 'choked_confinement';
    timingFr = `Confinement élevé (taux de dégagement de ${reliefRate} ms/m de banquette < 3.5 ms/m). Les rangées arrières détonent avant le déplacement suffisant du front, entraînant un soulèvement vertical et du hors-gabarit.`;
    timingEn = `Choked confinement (relief rate of ${reliefRate} ms/m of burden < 3.5 ms/m). Successive rows initiate before front burden displaces, causing upward heave and boulder generation.`;
  } else if (reliefRate > 12.0) {
    timingStatus = 'excessive_delay';
    timingFr = `Délai inter-rangées long (${reliefRate} ms/m > 12 ms/m). Risque de désolidarisation de roche et de coupure de détonateurs pyrotechniques.`;
    timingEn = `Extended inter-row delay (${reliefRate} ms/m > 12 ms/m). Risk of rock mass detachment and cut-off to non-electric downlines.`;
  } else {
    timingFr = `Séquence d'initiation progressive optimale (${reliefRate} ms/m de banquette). Déplacement régulier du tas, fragmentation par collision et maîtrise des vibrations.`;
    timingEn = `Optimal progressive relief sequence (${reliefRate} ms/m of burden). Smooth muckpile displacement, collision fragmentation, and controlled ground vibration.`;
  }

  const ppv = Number(blastState.timing.predictedPPVMmPerS || 6.8);
  const dist = blastState.timing.distanceToStructureM || 450;
  const isCompliant = ppv <= 12.7;

  // 4. Comminution
  const p80 = Number(metrics.p80 || blastState.optical.p80Mm);
  const wi = (blastState.comminution as any).bondWorkIndexKWhPerT || 14.5;
  const chokeRisk = p80 > 230 || (metrics.oversizePercent || 0) > 10;
  const sagImpact: 'boost' | 'neutral' | 'bottleneck' = p80 <= 145 ? 'boost' : (p80 <= 210 ? 'neutral' : 'bottleneck');
  const deltaTph = p80 <= 145 ? 42 : (p80 <= 210 ? 0 : -35);
  const powerSavings = p80 <= 145 ? 1.45 : (p80 <= 210 ? 0 : -1.8);

  const commFr = chokeRisk
    ? `Le P80 de ${p80} mm et la présence de ${metrics.oversizePercent}% de blocs risquent d'engorger la trémie du concasseur primaire et de pénaliser le débit du broyeur SAG de ${Math.abs(deltaTph)} t/h.`
    : `La granulométrie d'alimentation P80 = ${p80} mm (Wi = ${wi} kWh/t) assure une alimentation idéale du circuit avec un gain estimé de +${deltaTph} t/h et une économie d'énergie de ${powerSavings} kWh/t.`;

  const commEn = chokeRisk
    ? `Feed P80 of ${p80} mm with ${metrics.oversizePercent}% oversize threatens primary crusher choking and imposes a SAG throughput penalty of ${Math.abs(deltaTph)} tph.`
    : `Optimized feed sizing P80 = ${p80} mm (Wi = ${wi} kWh/t) enhances comminution efficiency, generating +${deltaTph} tph mill expansion and ${powerSavings} kWh/t energy savings.`;

  // 5. Economics
  const isNetPositive = sagImpact === 'boost' || (energyStatus === 'optimal' && !chokeRisk);
  const netBenefit = isNetPositive ? 0.72 : -0.48;

  // 6. Kuz-Ram Reconciliation
  const x50 = blastState.kuzRam.meanSizeX50Mm || 135;
  const p50 = metrics.p50 || blastState.optical.p50Mm;
  const divergence = Number((Math.abs(p50 - x50) / (p50 || 1) * 100).toFixed(1));

  return {
    energyMatch: {
      status: energyStatus,
      titleFr,
      titleEn,
      analysisFr,
      analysisEn,
    },
    geometry: {
      stiffnessStatus,
      stemmingStatus,
      subdrillStatus,
      stiffnessHB,
      stemmingTB,
      subdrillJB,
      notesFr: geomFr.trim(),
      notesEn: geomEn.trim(),
    },
    timing: {
      reliefRateMsPerM: reliefRate,
      status: timingStatus,
      vibrationUSBM: {
        ppvMmPerS: ppv,
        isCompliant,
        commentFr: isCompliant
          ? `Vitesse particulaire (PPV = ${ppv} mm/s à ${dist}m) strictement conforme aux critères USBM (<12.7 mm/s pour les habitations).`
          : `Alerte vibratoire : PPV = ${ppv} mm/s à ${dist}m dépassant les recommandations de confort structurel USBM.`,
        commentEn: isCompliant
          ? `Peak particle velocity (PPV = ${ppv} mm/s at ${dist}m) fully compliant with USBM standards (<12.7 mm/s residential).`
          : `Vibration warning: PPV = ${ppv} mm/s at ${dist}m exceeds USBM residential comfort limit.`,
      },
      notesFr: timingFr,
      notesEn: timingEn,
    },
    comminution: {
      crusherChokeRisk: chokeRisk,
      sagMillImpact: sagImpact,
      throughputDeltaTph: deltaTph,
      powerSavingsKwhPerT: powerSavings,
      notesFr: commFr,
      notesEn: commEn,
    },
    economics: {
      isNetPositive,
      netBenefitPerTonUSD: netBenefit,
      notesFr: isNetPositive
        ? `L'optimisation Mine-au-Moulin dégage un bénéfice net de +${netBenefit.toFixed(2)} $/tonne grâce aux économies d'énergie de broyage et au gain de cadence.`
        : `Surcoût opérationnel estimé à ${netBenefit.toFixed(2)} $/tonne en raison du concassage secondaire et du ralentissement de l'usine.`,
      notesEn: isNetPositive
        ? `Mine-to-mill optimization yields a net benefit of +$${netBenefit.toFixed(2)}/ton via reduced grinding power and throughput expansion.`
        : `Operational cost penalty of $${netBenefit.toFixed(2)}/ton due to secondary breakage handling and milling bottlenecks.`,
    },
    kuzRamReconciliation: {
      divergencePercent: divergence,
      verdictFr: divergence <= 15
        ? `Excellente corrélation (écart ${divergence}% entre prédiction Kuz-Ram X50=${x50}mm et mesure optique P50=${p50}mm).`
        : `Divergence de ${divergence}% (Kuz-Ram X50=${x50}mm vs Mesure P50=${p50}mm) : l'orientation des fractures du massif domine la fracturation.`,
      verdictEn: divergence <= 15
        ? `High model reconciliation (${divergence}% delta between Kuz-Ram X50=${x50}mm and optical P50=${p50}mm).`
        : `Significant divergence (${divergence}% delta: Kuz-Ram X50=${x50}mm vs Optical P50=${p50}mm): structural joint network governs breakage.`,
    },
  };
}

export function generateFullDynamicBlastEvaluationText(
  blast: Blast,
  blastState: BlastState,
  lang: 'en' | 'fr',
  metricsOverride?: FragmentationMetrics
): string {
  const diag = computeBlastDiagnosticSummary(blast, blastState, metricsOverride);
  const p = blast.parameters || (blastState?.geometry ? {
    burden: blastState.geometry.burden,
    spacing: blastState.geometry.spacing,
    benchHeight: blastState.geometry.benchHeight,
    holeDiameter: blastState.geometry.holeDiameterMm,
    subdrill: blastState.geometry.subdrill,
    stemmingLength: blastState.geometry.stemmingLength,
    chargePerHole: blastState.explosive?.chargePerHole,
    explosiveType: blastState.explosive?.explosiveType,
  } as any : {}) || {};
  const rock = blast.rockMass || {
    rockType: blastState?.rock?.rockType || 'Standard Granite / Rock',
    ucsMPa: blastState?.rock?.ucsMPa || 110,
    density: blastState?.rock?.densityTPerM3 || 2.7,
  };
  const metrics = metricsOverride || blast.images?.[0]?.segmentationRuns?.[0]?.metrics || {
    p50: blastState.optical.p50Mm,
    p80: blastState.optical.p80Mm,
    oversizePercent: blastState.optical.oversizePercent,
    finesPercent: blastState.optical.finesPercent,
    uniformityIndex: blastState.optical.uniformityIndex,
  };

  if (lang === 'fr') {
    return `ÉVALUATION TECHNIQUE GÉOTECHNIQUE & ANALYSE DE TIR (MODE DYNAMIQUE SCÉNARIO) :

1. Caractérisation du Massif & Bilan Énergétique :
Maille de tir ${p.burden} m × ${p.spacing} m (gradin de ${p.benchHeight} m, diam. ${p.holeDiameter} mm) chargée en ${p.explosiveType || 'ANFO'} (${p.chargePerHole} kg/trou) dans un massif de ${rock.rockType} (densité : ${rock.density} t/m³, UCS : ${rock.ucsMPa} MPa).
Diagnostic : ${diag.energyMatch.analysisFr}
Granulométrie optique mesurée : P50 = ${metrics.p50} mm, P80 = ${metrics.p80} mm, uniformité n = ${metrics.uniformityIndex}. Fines (<25 mm) : ${metrics.finesPercent}%, Gros blocs (>300 mm) : ${metrics.oversizePercent}%.

2. Ratios Géométriques du Gradin & Séquence d'Initiation :
- Ratios géométriques : ${diag.geometry.notesFr}
- Chronogramme & vibrations : ${diag.timing.notesFr} ${diag.timing.vibrationUSBM.commentFr}

3. Impact Usine (Comminution) & Économie Globale Mine-au-Moulin :
- Broyage : ${diag.comminution.notesFr}
- Bilan économique global : ${diag.economics.notesFr}

4. Recommandations Opérationnelles Prioritaires :
${
  diag.geometry.stemmingStatus === 'short_flyrock_risk'
    ? '1. SÉCURITÉ : Rehausser immédiatement la colonne de bourrage à au moins 0.85 B (granulats concassés angulaires) pour éliminer le risque de projection.\n'
    : diag.energyMatch.status === 'undercharged'
    ? '1. CHARGE : Concentrer la charge d\'explosif en pied de trou (+15% de densité d\'énergie) pour éliminer les blocs hors-gabarit.\n'
    : '1. GÉOMÉTRIE : Maintenir la distribution actuelle de charge tout en poursuivant le contrôle systématique du front de taille.\n'
}${
  diag.timing.status === 'choked_confinement'
    ? '2. RETARDS : Allonger le retard inter-rangées à au moins 4.5 ms/m de banquette pour libérer le dégagement de la masse abattue.'
    : '2. USINE : Exploiter le P80 optimal pour pousser le débit d\'alimentation du broyeur SAG.'
}`;
  }

  return `GEOTECHNICAL BLAST AUDIT & COMPREHENSIVE SCENARIO EVALUATION:

1. Rock Mass Characteristics & Energy Allocation:
Pattern geometry ${p.burden} m × ${p.spacing} m (bench: ${p.benchHeight} m, diam. ${p.holeDiameter} mm) loaded with ${p.explosiveType || 'ANFO'} (${p.chargePerHole} kg/hole) in ${rock.rockType} (density: ${rock.density} t/m³, UCS: ${rock.ucsMPa} MPa).
Engineering Verdict: ${diag.energyMatch.analysisEn}
Photographic sizing results: P50 = ${metrics.p50} mm, P80 = ${metrics.p80} mm, uniformity index n = ${metrics.uniformityIndex}. Fines (<25 mm): ${metrics.finesPercent}%, Oversize (>300 mm): ${metrics.oversizePercent}%.

2. Bench Geometry Ratios & 3D Initiation Dynamics:
- Geometric ratios: ${diag.geometry.notesEn}
- Initiation sequence & ground vibration: ${diag.timing.notesEn} ${diag.timing.vibrationUSBM.commentEn}

3. Comminution Plant Impact & Mine-to-Mill Cost Balance:
- Grinding circuit: ${diag.comminution.notesEn}
- Economic balance: ${diag.economics.notesEn}

4. Key Operational Recommendations:
${
  diag.geometry.stemmingStatus === 'short_flyrock_risk'
    ? '1. SAFETY: Immediately increase stemming collar height to at least 0.85 B with angular crushed aggregate to suppress flyrock risk.\n'
    : diag.energyMatch.status === 'undercharged'
    ? '1. ENERGY: Concentrate toe charge density (+15% explosive energy) to fragment massive joint blocks and prevent toe stumps.\n'
    : '1. GEOMETRY: Maintain current powder factor while inspecting front-row burden face profiling.\n'
}${
  diag.timing.status === 'choked_confinement'
    ? '2. TIMING: Increase surface inter-row delay to at least 4.5 ms/m of burden to facilitate forward displacement.'
    : '2. PLANT: Maximize SAG mill throughput utilizing this fine feed distribution.'
}`;
}
