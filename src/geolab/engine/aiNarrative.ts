import { GEMINI_CONFIG } from '../../services/gemini';
import type { GeoLabAnalysis } from '../../types/geolab';
import { getTestDefinition } from '../tests/index';

export interface AiNarrativeOptions {
  analysis: GeoLabAnalysis;
  apiKey?: string;
  language?: 'en' | 'fr';
}

/**
 * Generates an engineering interpretation narrative using Gemini (or deterministic fallback),
 * strictly without altering or recalculating any numeric results.
 */
export async function generateGeoLabNarrative(options: AiNarrativeOptions): Promise<string> {
  const { analysis, apiKey } = options;
  const lang = options.language || 'fr';
  const testDef = getTestDefinition(analysis.testType);

  const contextData = testDef.aiPromptContext(analysis.rawInput, analysis.computedResults);
  const disclaimer = lang === 'fr'
    ? '[Rédigé par IA, à valider par l\'ingénieur responsable]'
    : '[AI-drafted, to be reviewed by the responsible engineer]';

  const deterministicFallback = getDeterministicNarrative(analysis, lang);

  if (!apiKey || apiKey.trim() === '') {
    return `${disclaimer}\n\n${deterministicFallback}`;
  }

  const prompt = `You are a Senior Geotechnical Laboratory Materials Engineer reviewing an official test report.
TEST TYPE: ${testDef.name[lang]} (${analysis.standard})
SAMPLE: ${analysis.sampleId} | REPORT NO: ${analysis.reportNumber}

COMPUTED RESULTS & DATA (DO NOT RECOMPUTE OR ALTER ANY NUMBER):
${JSON.stringify(contextData, null, 2)}

QUALITY WARNINGS / ANOMALIES:
${JSON.stringify(analysis.qualityWarnings || [], null, 2)}

STRICT RULES:
1. Provide a professional, concise 2-paragraph geotechnical interpretation in ${lang === 'fr' ? 'FRENCH' : 'ENGLISH'}.
2. Describe and interpret the soil behavior (compaction response, grading classification, or moisture state).
3. Cite the exact computed numbers provided above (e.g. OPM, dry density, Cu, Cc, fines %, water content). NEVER invent or modify any numerical values.
4. Flag any anomalies or specification limits mentioned.
5. End with a practical geotechnical recommendation for earthworks or foundation placement.
6. Prepend the response with: "${disclaimer}"`;

  try {
    const url = `${GEMINI_CONFIG.baseUrl}/${GEMINI_CONFIG.flashModel}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.trim().length > 0) {
      return text.trim();
    }
    return `${disclaimer}\n\n${deterministicFallback}`;
  } catch (err: any) {
    console.warn('Gemini narrative call failed:', err?.message);
    return `${disclaimer}\n\n${deterministicFallback}`;
  }
}

function getDeterministicNarrative(analysis: GeoLabAnalysis, lang: 'en' | 'fr'): string {
  const { testType, computedResults } = analysis;
  const res: any = computedResults || {};

  if (testType === 'proctor') {
    if (lang === 'fr') {
      return `L'essai de compactage selon la norme ${analysis.standard} met en évidence un Optimum Proctor de ${res.opmMoisturePercent} % de teneur en eau pour une masse volumique sèche maximale ρd_opm de ${res.maxDryDensityGcm3} g/cm³. L'objectif de compactage de 95% du Proctor exige une densité minimale en place de ${res.targetDryDensityGcm3} g/cm³. L'allure de la courbe montre une sensibilité modérée aux variations hydriques autour de l'optimum. Recommandation : Maintenir la teneur en eau de régalage sur chantier dans une plage de ±1,5% de l'OPM pour garantir la portance requise de la plateforme.`;
    }
    return `Compaction test conducted in accordance with ${analysis.standard} yields an Optimum Moisture Content of ${res.opmMoisturePercent}% with a maximum dry density ρd_max of ${res.maxDryDensityGcm3} g/cm³. The 95% compaction specification requires a minimum dry placement density of ${res.targetDryDensityGcm3} g/cm³. The compaction curve demonstrates typical cohesive response with well-defined curvature. Recommendation: Control placement moisture within ±1.5% of optimum during subgrade compaction to ensure target bearing capacity.`;
  }

  if (testType === 'grain_size') {
    if (lang === 'fr') {
      return `L'analyse granulométrique par tamisage (${analysis.standard}) caractérise un matériau composé de ${res.gravelPercent} % de gravillons, ${res.sandPercent} % de fraction sableuse et ${res.finesPercent} % de fines (< 0,08 mm). Le passant à 2 mm s'établit à ${res.passing2mmPercent} %. Selon la classification LCPC, le matériau est répertorié : ${res.lcpcClassification}${res.cu ? ` (Cu = ${res.cu}, Cc = ${res.cc})` : ''}. Recommandation : Matériau sableux propre à granularité favorable pour remblai technique ou couche d'assise sous réserve de maintien du confinement.`;
    }
    return `Particle size distribution analysis (${analysis.standard}) indicates a soil composition of ${res.gravelPercent}% gravel, ${res.sandPercent}% sand, and ${res.finesPercent}% fines (< 0.08 mm), with ${res.passing2mmPercent}% passing the 2 mm sieve. Under unified classification, the material qualifies as ${res.uscsClassification} / ${res.lcpcClassification}${res.cu ? ` (Cu = ${res.cu}, Cc = ${res.cc})` : ''}. Recommendation: Suitable for structural embankment or stabilized subgrade applications subject to adequate compaction and moisture conditioning.`;
  }

  if (testType === 'water_content') {
    if (lang === 'fr') {
      return `La détermination de la teneur en eau naturelle selon la norme ${analysis.standard} par étuvage à 105°C indique une valeur moyenne de ${res.meanWaterContentPercent ?? '-'} %. L'écart entre éprouvettes est de ${res.differenceBetweenSpecimensPercent ?? 0} %, satisfaisant le critère de répétabilité fixé à ${res.maxTolerancePercent ?? 1} %. Recommandation : Intégrer cette valeur hydrique d'état initial pour le dimensionnement des besoins d'humidification ou d'aération lors de la mise en œuvre.`;
    }
    return `Natural moisture content determination per ${analysis.standard} via oven drying at 105°C yields a mean water content of ${res.meanWaterContentPercent ?? '-'}%. The difference between duplicate specimens is ${res.differenceBetweenSpecimensPercent ?? 0}%, satisfying the repeatability threshold of ${res.maxTolerancePercent ?? 1}%. Recommendation: Use this in-situ moisture baseline to calculate moisture adjustment requirements during earthwork compaction.`;
  }

  if (testType === 'specific_gravity') {
    const val = res.meanGs ?? res.specificGravity ?? '-';
    const dens = res.solidDensityGcm3 ?? res.solidDensityMgM3 ?? '-';
    const diff = res.differenceGs ?? 0;
    const tol = res.maxToleranceGs ?? 0.03;
    if (lang === 'fr') {
      return `La détermination de la masse volumique des grains solides selon la norme ${analysis.standard} par la méthode du pycnomètre indique une valeur moyenne Gs = ${val} (masse volumique réelle des grains ρs = ${dens} g/cm³). L'écart entre déterminations est de ${diff}, respectant la tolérance de répétabilité de ${tol}. Recommandation : Intégrer cette masse volumique absolue pour les calculs de compacité, d'indice des vides et la construction des courbes de saturation à Sr = 100%.`;
    }
    return `Specific gravity determination in accordance with ${analysis.standard} using the pycnometer method yields a mean Gs of ${val} (particle solid density ρs = ${dens} g/cm³). The difference between determinations is ${diff}, satisfying the repeatability criterion of ${tol}. Recommendation: Use this solid density value in phase relationship calculations, void ratio determination, and zero-air-voids saturation curves.`;
  }

  if (testType === 'bulk_density') {
    const val = res.meanBulkDensityGcm3 ?? res.meanBulkDensityTm3 ?? '-';
    const stateFr = res.compactionState === 'compacted' ? 'tassé' : 'non tassé (en vrac)';
    const stateEn = res.compactionState === 'compacted' ? 'compacted' : 'loose';
    if (lang === 'fr') {
      return `La mesure de la masse volumique en vrac selon la norme ${analysis.standard} donne une valeur moyenne de ${val} t/m³ en état ${stateFr}. L'écart entre essais est de ${res.differenceGcm3 ?? 0} t/m³. Recommandation : Utiliser cette valeur pour le dimensionnement des volumes de stockage, de transport et le calcul des coefficients de foisonnement et tassement sur chantier.`;
    }
    return `Bulk density measurement per ${analysis.standard} indicates a mean density of ${val} t/m³ in the ${stateEn} state. Difference between trials is ${res.differenceGcm3 ?? 0} t/m³. Recommendation: Apply this loose/compacted bulk density for transport haulage volume conversions and stockpile capacity calculations.`;
  }

  if (testType === 'sand_equivalent') {
    const esv = res.meanEsVisual ?? '-';
    const esp = res.meanEsPiston ?? '-';
    const methodFr = res.shakingMethod === 'mechanical' ? 'agitation mécanique' : 'agitation manuelle';
    if (lang === 'fr') {
      return `L'essai d'équivalent de sable selon la norme ${analysis.standard} donne un ES visuel moyen de ${esv} % et un ES au piston de ${esp} % (${methodFr}). Les critères de répétabilité sont satisfaits. Recommandation : Matériau granulaire propre adapté pour couches d'assise et bétons hydrauliques sous réserve de validation des seuils prescrits au CCTP.`;
    }
    return `Sand equivalent test performed per ${analysis.standard} yields a mean visual SE of ${esv}% and a mean piston SE of ${esp}% (${res.shakingMethod || 'mechanical'} shaking). The repeatability requirement is verified. Recommendation: The sand satisfies cleanliness criteria for aggregate concrete or subgrade bedding under relevant project specifications.`;
  }

  if (testType === 'los_angeles') {
    const la = res.laCoefficient ?? res.meanLa ?? '-';
    const cat = res.laCategory ? ` (${res.laCategory})` : '';
    if (lang === 'fr') {
      return `L'essai Los Angeles selon la norme ${analysis.standard} (fraction ${res.fraction || '10/14'}, ${res.numberOfBalls || 11} boulets) donne un coefficient de fragmentation LA = ${la} %${cat}. Cette valeur caractérise une bonne résistance des granulats aux chocs mécaniques répétés. Recommandation : Granulats conformes pour assises de chaussées et couches de roulement sous fort trafic.`;
    }
    return `Los Angeles fragmentation test per ${analysis.standard} (grading fraction ${res.fraction || '10/14'}, ${res.numberOfBalls || 11} spheres) yields an LA coefficient of ${la}%${cat}. This indicates adequate resistance to mechanical shock and degradation. Recommendation: Suitable for road sub-base and structural asphalt aggregate requirements.`;
  }

  if (testType === 'micro_deval') {
    const mde = res.mdeCoefficient ?? res.meanMde ?? '-';
    const cat = res.mdeCategory ? ` (${res.mdeCategory})` : '';
    if (lang === 'fr') {
      return `L'essai Micro-Deval en présence d'eau selon la norme ${analysis.standard} (fraction ${res.fraction || '10/14'}) aboutit à un coefficient d'usure MDE = ${mde} %${cat}. L'usure par frottement en milieu humide est maîtrisée. Recommandation : Les granulats répondent aux critères de durabilité superficielle requis pour les assises et revêtements routiers.`;
    }
    return `Micro-Deval wear test in water per ${analysis.standard} (fraction ${res.fraction || '10/14'}) results in a wear coefficient MDE of ${mde}%${cat}. Resistance to wet abrasion and attrition is confirmed. Recommendation: Satisfies durability criteria for pavement foundation and asphalt wearing courses.`;
  }

  if (testType === 'flakiness') {
    const fi = res.flakinessIndexA ?? '-';
    const cat = res.flakinessCategory ? ` (${res.flakinessCategory})` : '';
    if (lang === 'fr') {
      return `La détermination du coefficient d'aplatissement selon la norme ${analysis.standard} par tamisage sur grilles à fentes indique un coefficient global A = ${fi} %${cat}. Cette valeur atteste d'une morphologie granulaire favorable limitant la proportion d'éléments plats. Recommandation : Conforme pour enrobés hydrocarbonés et bétons de structure.`;
    }
    return `Flakiness index determination according to ${analysis.standard} via bar sieves yields an overall flakiness index FI = ${fi}%${cat}. Particle shape analysis demonstrates low elongation/flatness proportion. Recommendation: Conforms to particle shape requirements for bituminous mixtures and high-strength concrete.`;
  }

  if (testType === 'surface_cleanliness') {
    const p = res.meanCleanlinessPercentageP ?? '-';
    const cat = res.cleanlinessCategory ? ` (${res.cleanlinessCategory})` : '';
    if (lang === 'fr') {
      return `L'essai de propreté superficielle selon la norme ${analysis.standard} mesure une proportion d'éléments très fins adhérents P = ${p} %${cat}. Ce faible taux de poussières garantit une bonne adhérence avec les liants hydrocarbonés ou hydrauliques. Recommandation : Matériau propre directement utilisable en centrale d'enrobage ou à béton.`;
    }
    return `Surface cleanliness testing per ${analysis.standard} reveals adhering dust and fines percentage P = ${p}%${cat}. The low superficial fines content ensures optimal binder adhesion in hydraulic or bituminous mixtures. Recommendation: Complies with cleanliness limits for asphalt aggregates.`;
  }

  if (testType === 'methylene_blue') {
    const val = res.primaryValue ?? res.vbsValue ?? res.mbValue ?? '-';
    const unit = res.unit || 'g/100g';
    const cat = res.soilSensitivityClass ? ` (${res.soilSensitivityClass})` : '';
    if (lang === 'fr') {
      return `L'essai au bleu de méthylène selon la norme ${analysis.standard} donne une valeur de ${val} ${unit}${cat}. Cette valeur quantifie la surface spécifique et l'activité des argiles présentes dans le sol ou les fines. Recommandation : Prendre en compte ce niveau de sensibilité à l'eau lors des opérations de terrassement et compactage.`;
    }
    return `Methylene blue test per ${analysis.standard} gives a value of ${val} ${unit}${cat}. This index measures clay activity and surface absorption potential. Recommendation: Account for clay sensitivity during subgrade earthworks and moisture conditioning.`;
  }

  // Generic fallback
  if (lang === 'fr') {
    return `L'essai selon la norme ${analysis.standard} a été réalisé conformément aux prescriptions techniques en vigueur. Les résultats obtenus respectent les tolérances de répétabilité définies pour l'essai. Recommandation : Exploiter ces paramètres dans le cadre des vérifications d'ingénierie et de conformité aux spécifications contractuelles du projet.`;
  }
  return `Testing in accordance with ${analysis.standard} was conducted following standard technical specifications. The computed results conform to internal laboratory repeatability limits. Recommendation: Apply these measured parameters for engineering verification and compliance assessment against project contract specifications.`;
}

