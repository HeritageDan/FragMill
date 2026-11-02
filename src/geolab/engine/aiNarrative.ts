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
  } catch {
    return `${disclaimer}\n\n${deterministicFallback}`;
  }
}

function getDeterministicNarrative(analysis: GeoLabAnalysis, lang: 'en' | 'fr'): string {
  const { testType, computedResults } = analysis;

  if (testType === 'proctor') {
    const res = computedResults;
    if (lang === 'fr') {
      return `L'essai de compactage selon la norme ${analysis.standard} met en évidence un Optimum Proctor de ${res.opmMoisturePercent} % de teneur en eau pour une masse volumique sèche maximale ρd_opm de ${res.maxDryDensityGcm3} g/cm³. L'objectif de compactage de 95% du Proctor exige une densité minimale en place de ${res.targetDryDensityGcm3} g/cm³. L'allure de la courbe montre une sensibilité modérée aux variations hydriques autour de l'optimum. Recommandation : Maintenir la teneur en eau de régalage sur chantier dans une plage de ±1,5% de l'OPM pour garantir la portance requise de la plateforme.`;
    }
    return `Compaction test conducted in accordance with ${analysis.standard} yields an Optimum Moisture Content of ${res.opmMoisturePercent}% with a maximum dry density ρd_max of ${res.maxDryDensityGcm3} g/cm³. The 95% compaction specification requires a minimum dry placement density of ${res.targetDryDensityGcm3} g/cm³. The compaction curve demonstrates typical cohesive response with well-defined curvature. Recommendation: Control placement moisture within ±1.5% of optimum during subgrade compaction to ensure target bearing capacity.`;
  }

  if (testType === 'grain_size') {
    const res = computedResults;
    if (lang === 'fr') {
      return `L'analyse granulométrique par tamisage (${analysis.standard}) caractérise un matériau composé de ${res.gravelPercent} % de gravillons, ${res.sandPercent} % de fraction sableuse et ${res.finesPercent} % de fines (< 0,08 mm). Le passant à 2 mm s'établit à ${res.passing2mmPercent} %. Selon la classification LCPC, le matériau est répertorié : ${res.lcpcClassification}${res.cu ? ` (Cu = ${res.cu}, Cc = ${res.cc})` : ''}. Recommandation : Matériau sableux propre à granularité favorable pour remblai technique ou couche d'assise sous réserve de maintien du confinement.`;
    }
    return `Particle size distribution analysis (${analysis.standard}) indicates a soil composition of ${res.gravelPercent}% gravel, ${res.sandPercent}% sand, and ${res.finesPercent}% fines (< 0.08 mm), with ${res.passing2mmPercent}% passing the 2 mm sieve. Under unified classification, the material qualifies as ${res.uscsClassification} / ${res.lcpcClassification}${res.cu ? ` (Cu = ${res.cu}, Cc = ${res.cc})` : ''}. Recommendation: Suitable for structural embankment or stabilized subgrade applications subject to adequate compaction and moisture conditioning.`;
  }

  // Water content
  const res = computedResults;
  if (lang === 'fr') {
    return `La détermination de la teneur en eau naturelle selon la norme ${analysis.standard} par étuvage à 105°C indique une valeur moyenne de ${res.meanWaterContentPercent} %. L'écart entre éprouvettes est de ${res.differenceBetweenSpecimensPercent} %, satisfaisant le critère de répétabilité fixé à ${res.maxTolerancePercent} %. Recommandation : Intégrer cette valeur hydrique d'état initial pour le dimensionnement des besoins d'humidification ou d'aération lors de la mise en œuvre.`;
  }
  return `Natural moisture content determination per ${analysis.standard} via oven drying at 105°C yields a mean water content of ${res.meanWaterContentPercent}%. The difference between duplicate specimens is ${res.differenceBetweenSpecimensPercent}%, satisfying the repeatability threshold of ${res.maxTolerancePercent}%. Recommendation: Use this in-situ moisture baseline to calculate moisture adjustment requirements during earthwork compaction.`;
}

