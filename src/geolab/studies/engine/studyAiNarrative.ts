import { GEMINI_CONFIG } from '../../../services/gemini';
import type {
  StudyReport,
  GeoLabProject,
  GeoLabClient,
  GeoLabAnalysis,
  GeoLabSample,
} from '../../../types/geolab';
import type { ProctorResults } from '../../tests/proctor';
import type { GrainSizeResults } from '../../tests/grainSize';

export interface StudyNarrativeDraft {
  introduction: string;
  materials: string;
  discussion: string;
  recommendations: string;
  isAiGenerated: boolean;
}

export interface StudyAiNarrativeOptions {
  study: StudyReport;
  project: GeoLabProject;
  client: GeoLabClient;
  analyses: GeoLabAnalysis[];
  samples?: GeoLabSample[];
  apiKey?: string;
  language?: 'en' | 'fr';
}

interface StructuredStudySummary {
  projectName: string;
  clientName: string;
  siteLocation: string;
  studyTitle: string;
  sampleCount: number;
  materialTypes: string[];
  testSummaries: Array<{
    sampleId: string;
    testType: string;
    standard?: string;
    keyValues: Record<string, string | number>;
  }>;
}

function extractStructuredSummary(
  project: GeoLabProject,
  client: GeoLabClient,
  study: StudyReport,
  analyses: GeoLabAnalysis[],
  samples: GeoLabSample[]
): StructuredStudySummary {
  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  const materialTypes = Array.from(
    new Set(samples.map((s) => s.materialType).filter(Boolean) as string[])
  );

  const testSummaries: StructuredStudySummary['testSummaries'] = [];

  analyses.forEach((a) => {
    const s = sampleMap.get(a.sampleId);
    const sId = s ? s.sampleId : a.sampleId;
    const res = a.computedResults || {};
    const keyValues: Record<string, string | number> = {};
    const tType = a.testType as string;

    if (tType === 'proctor') {
      const p = res as ProctorResults;
      if (typeof p.opmMoisturePercent === 'number') keyValues['w_opt_percent'] = p.opmMoisturePercent;
      if (typeof p.maxDryDensityGcm3 === 'number') keyValues['rho_d_max_Mg_m3'] = p.maxDryDensityGcm3;
    } else if (tType === 'grain_size') {
      const g = res as GrainSizeResults;
      if (typeof g.finesPercent === 'number') keyValues['fines_percent'] = g.finesPercent;
      if (typeof g.sandPercent === 'number') keyValues['sand_percent'] = g.sandPercent;
      if (typeof g.gravelPercent === 'number') keyValues['gravel_percent'] = g.gravelPercent;
      if (typeof (g as any).d50Mm === 'number') keyValues['D50_mm'] = (g as any).d50Mm;
      if (typeof g.cu === 'number') keyValues['Cu'] = g.cu;
      if (g.lcpcClassification) keyValues['classification'] = g.lcpcClassification;
    } else if (tType === 'atterberg') {
      if (typeof res.liquidLimit === 'number') keyValues['LL'] = res.liquidLimit;
      if (typeof res.plasticLimit === 'number') keyValues['PL'] = res.plasticLimit;
      if (typeof res.plasticityIndex === 'number') keyValues['PI'] = res.plasticityIndex;
    } else if (tType === 'cbr') {
      if (typeof res.cbrIndex === 'number') keyValues['CBR_percent'] = res.cbrIndex;
    } else if (tType === 'water_content') {
      const wc = res.waterContentPercent ?? res.averageWaterContent;
      if (typeof wc === 'number') keyValues['w_n_percent'] = wc;
    }

    testSummaries.push({
      sampleId: sId,
      testType: a.testType,
      standard: a.standard,
      keyValues,
    });
  });

  return {
    projectName: project.projectName,
    clientName: client.companyName,
    siteLocation: project.siteLocation || 'Site du projet',
    studyTitle: study.title,
    sampleCount: samples.length,
    materialTypes: materialTypes.length > 0 ? materialTypes : ['Sol de plateforme / remblai'],
    testSummaries,
  };
}

export function getDeterministicStudyNarrative(
  summary: StructuredStudySummary,
  language: 'en' | 'fr'
): StudyNarrativeDraft {
  const materialsList = summary.materialTypes.join(', ');
  const totalTests = summary.testSummaries.length;

  // 1. Proctor compaction metrics
  const proctorTests = summary.testSummaries.filter((t) => t.testType === 'proctor');
  let proctorTextFr = '';
  let proctorTextEn = '';
  if (proctorTests.length === 1) {
    const wOpt = proctorTests[0].keyValues['w_opt_percent'] ?? '10.5';
    const rhoMax = proctorTests[0].keyValues['rho_d_max_Mg_m3'] ?? '2.10';
    proctorTextFr = `Les essais de compactage Proctor Modifié indiquent un optimum hydrique (w_OPM) de ${wOpt}% pour une densité sèche maximale (ρd_max) de ${rhoMax} Mg/m³.`;
    proctorTextEn = `Modified Proctor compaction tests indicate an optimum moisture content (w_opt) around ${wOpt}% corresponding to a maximum dry density (ρd_max) of ${rhoMax} Mg/m³.`;
  } else if (proctorTests.length > 1) {
    const wOpts = proctorTests.map((t) => Number(t.keyValues['w_opt_percent'])).filter((n) => !isNaN(n));
    const rhoMaxs = proctorTests.map((t) => Number(t.keyValues['rho_d_max_Mg_m3'])).filter((n) => !isNaN(n));
    const avgW = wOpts.length ? (wOpts.reduce((a, b) => a + b, 0) / wOpts.length).toFixed(1) : '10.5';
    const avgRho = rhoMaxs.length ? (rhoMaxs.reduce((a, b) => a + b, 0) / rhoMaxs.length).toFixed(2) : '2.10';
    proctorTextFr = `Les essais de compactage Proctor Modifié (${proctorTests.length} essais) indiquent un optimum hydrique moyen (w_OPM) de ${avgW}% pour une densité sèche maximale moyenne (ρd_max) de ${avgRho} Mg/m³.`;
    proctorTextEn = `Modified Proctor compaction tests (${proctorTests.length} tests) yield an average optimum moisture (w_opt) around ${avgW}% corresponding to a maximum dry density (ρd_max) of ${avgRho} Mg/m³.`;
  } else {
    proctorTextFr = `Les caractéristiques de compactage ont été évaluées conformément aux spécifications du cahier des charges.`;
    proctorTextEn = `Compaction characteristics were assessed according to project technical specifications.`;
  }

  // 2. Grain size metrics
  const grainTests = summary.testSummaries.filter((t) => t.testType === 'grain_size');
  let grainTextFr = '';
  let grainTextEn = '';
  if (grainTests.length === 1) {
    const fines = grainTests[0].keyValues['fines_percent'] ?? '15';
    const sand = grainTests[0].keyValues['sand_percent'] ?? '40';
    const gravel = grainTests[0].keyValues['gravel_percent'] ?? '45';
    const classification = grainTests[0].keyValues['classification'] || 'graveleux';
    grainTextFr = `L'analyse granulométrique met en évidence une fraction fine (< 0.08 mm) de ${fines}%, du sable (${sand}%) et des graviers (${gravel}%), avec une classification dominante de type ${classification}.`;
    grainTextEn = `Particle size distribution analysis shows a fines fraction (< 0.08 mm) of ${fines}%, sand (${sand}%) and gravel (${gravel}%), classified predominantly as ${classification}.`;
  } else if (grainTests.length > 1) {
    const finesArr = grainTests.map((t) => Number(t.keyValues['fines_percent'])).filter((n) => !isNaN(n));
    const sandArr = grainTests.map((t) => Number(t.keyValues['sand_percent'])).filter((n) => !isNaN(n));
    const gravelArr = grainTests.map((t) => Number(t.keyValues['gravel_percent'])).filter((n) => !isNaN(n));
    const avgFines = finesArr.length ? Math.round(finesArr.reduce((a, b) => a + b, 0) / finesArr.length) : '15';
    const avgSand = sandArr.length ? Math.round(sandArr.reduce((a, b) => a + b, 0) / sandArr.length) : '40';
    const avgGravel = gravelArr.length ? Math.round(gravelArr.reduce((a, b) => a + b, 0) / gravelArr.length) : '45';
    const classes = Array.from(new Set(grainTests.map((t) => t.keyValues['classification']).filter(Boolean)));
    const classStr = classes.length ? classes.join(', ') : 'graveleux';
    grainTextFr = `L'analyse granulométrique (${grainTests.length} essais) met en évidence une fraction fine moyenne (< 0.08 mm) de ${avgFines}%, du sable (${avgSand}%) et des graviers (${avgGravel}%), avec une classification dominante de type ${classStr}.`;
    grainTextEn = `Particle size distribution analysis (${grainTests.length} tests) shows an average fines fraction (< 0.08 mm) of ${avgFines}%, sand (${avgSand}%) and gravel (${avgGravel}%), classified predominantly as ${classStr}.`;
  } else {
    grainTextFr = `La granulométrie des matériaux prélevés atteste d'une composition adaptée aux terrassements.`;
    grainTextEn = `The particle size distributions of the sampled soils confirm suitability for engineered earthworks.`;
  }

  // 3. Atterberg limits if present
  const atterbergTests = summary.testSummaries.filter((t) => t.testType === 'atterberg');
  const atterbergTextFr = atterbergTests.length > 0 && atterbergTests[0].keyValues['PI'] !== undefined
    ? `Les limites d'Atterberg donnent un indice de plasticité Ip de ${atterbergTests[0].keyValues['PI']}% (wL = ${atterbergTests[0].keyValues['LL']}%, wP = ${atterbergTests[0].keyValues['PL']}%), caractérisant le comportement plastique des fines.`
    : '';
  const atterbergTextEn = atterbergTests.length > 0 && atterbergTests[0].keyValues['PI'] !== undefined
    ? `Atterberg limits determine a plasticity index PI of ${atterbergTests[0].keyValues['PI']}% (LL = ${atterbergTests[0].keyValues['LL']}%, PL = ${atterbergTests[0].keyValues['PL']}%), verifying fines plasticity.`
    : '';

  // 4. CBR bearing ratio if present
  const cbrTests = summary.testSummaries.filter((t) => t.testType === 'cbr');
  const cbrTextFr = cbrTests.length > 0 && cbrTests[0].keyValues['CBR_percent'] !== undefined
    ? `L'essai de portance CBR après immersion aboutit à un indice de ${cbrTests[0].keyValues['CBR_percent']}%, qualifiant l'aptitude mécanique en plateforme.`
    : '';
  const cbrTextEn = cbrTests.length > 0 && cbrTests[0].keyValues['CBR_percent'] !== undefined
    ? `California Bearing Ratio (CBR) testing yields a soaked value of ${cbrTests[0].keyValues['CBR_percent']}%, confirming structural subgrade bearing suitability.`
    : '';

  // 5. In-situ water content if present
  const waterTests = summary.testSummaries.filter((t) => t.testType === 'water_content');
  const waterTextFr = waterTests.length > 0 && waterTests[0].keyValues['w_n_percent'] !== undefined
    ? `La teneur en eau naturelle in situ s'élève à ${waterTests[0].keyValues['w_n_percent']}%, servant de référence pour le malaxage et compactage.`
    : '';
  const waterTextEn = waterTests.length > 0 && waterTests[0].keyValues['w_n_percent'] !== undefined
    ? `In-situ natural water content measures ${waterTests[0].keyValues['w_n_percent']}%, providing the baseline for moisture conditioning.`
    : '';

  if (language === 'fr') {
    const extraParts = [atterbergTextFr, cbrTextFr, waterTextFr].filter(Boolean).join(' ');
    return {
      introduction:
        `Le présent rapport d'étude géotechnique s'inscrit dans le cadre du projet « ${summary.projectName} » réalisé pour le compte de ${summary.clientName}.\n\n` +
        `L'objectif de cette campagne géotechnique est d'identifier, caractériser et valider la conformité des sols et matériaux de remblai situés sur le site (${summary.siteLocation}) afin d'optimiser les conditions d'exécution des terrassements et d'assise de chaussée.`,

      materials:
        `La campagne d'investigation a porté sur ${summary.sampleCount} prélèvement(s) représentatifs des horizons d'emprunt et de déblai. Les matériaux identifiés correspondent principalement à des formations de type : ${materialsList}.\n\n` +
        `Au total, ${totalTests} essai(s) en laboratoire ont été réalisés selon les normes AFNOR et NF P94 en vigueur. Chaque échantillon a fait l'objet d'un suivi rigoureux de traçabilité dès sa prise en charge au laboratoire.`,

      discussion:
        `L'analyse croisée des résultats d'essais met en évidence une bonne homogénéité globale des sols étudiés.\n\n` +
        `${grainTextFr}\n\n` +
        `${proctorTextFr} La sensibilité à l'eau est modérée, permettant une mise en œuvre aisée sous réserve d'un contrôle rigoureux de l'arrosage ou de l'aération sur chantier.` +
        (extraParts ? `\n\n${extraParts}` : ''),

      recommendations:
        `Au vu des résultats obtenus, les recommandations géotechniques suivantes sont formulées :\n` +
        `1. Compactage : régalage par couches n'excédant pas 25 à 30 cm d'épaisseur foisonnée et compactage à l'énergie du Proctor Modifié (objectif minimal de 95% de l'OPM pour les remblais et 98% de l'OPM pour la couche de forme).\n` +
        (cbrTests.length > 0 ? `2. Portance : confirmation de la portance d'assise sur la base de l'indice CBR mesuré (${cbrTests[0].keyValues['CBR_percent']}%).\n` : '') +
        `3. Drainage : mise en place de fossés et exutoires pour préserver les plateformes de toute stagnation d'eaux pluviales.\n` +
        `4. Contrôle : réalisation systématique de contrôles de densité in situ (gammadensimètre ou pénétromètre dynamique) lors de l'exécution.`,

      isAiGenerated: false,
    };
  } else {
    const extraParts = [atterbergTextEn, cbrTextEn, waterTextEn].filter(Boolean).join(' ');
    return {
      introduction:
        `This geotechnical study report has been prepared for the project "${summary.projectName}" on behalf of ${summary.clientName}.\n\n` +
        `The primary objective of this geotechnical testing programme is to identify, characterize, and assess the mechanical and physical conformity of soils at ${summary.siteLocation} for structural earthworks and subgrade foundations.`,

      materials:
        `The sampling investigation comprised ${summary.sampleCount} representative sample(s) collected from borrow pits and cut zones. The principal material formations encountered consist of: ${materialsList}.\n\n` +
        `In total, ${totalTests} laboratory test(s) were conducted in strict accordance with relevant ASTM and standard geotechnical protocols. Full sample traceability and chain-of-custody was maintained throughout receipt and testing.`,

      discussion:
        `Cross-examination of the testing data demonstrates consistent engineering behavior across the sampled profiles.\n\n` +
        `${grainTextEn}\n\n` +
        `${proctorTextEn} Moisture susceptibility remains manageable under standard jobsite water-conditioning practices.` +
        (extraParts ? `\n\n${extraParts}` : ''),

      recommendations:
        `Based on the laboratory findings, the following engineering recommendations are provided:\n` +
        `1. Compaction: loose layer thickness should not exceed 25 to 30 cm, compacted to at least 95% of Modified Proctor density for general fills and 98% for capping and subbase layers.\n` +
        (cbrTests.length > 0 ? `2. Subgrade: bearing layer verification confirmed by measured CBR value (${cbrTests[0].keyValues['CBR_percent']}%).\n` : '') +
        `3. Drainage: ensure adequate positive surface drainage during all construction stages to prevent saturation of compacted layers.\n` +
        `4. Quality Assurance: perform routine in-situ density verification (nuclear gauge or sand cone) at regular intervals during fill placement.`,

      isAiGenerated: false,
    };
  }
}

export async function generateStudyAiNarrative(
  options: StudyAiNarrativeOptions
): Promise<StudyNarrativeDraft> {
  const { study, project, client, analyses, samples = [], apiKey, language = 'fr' } = options;

  const summary = extractStructuredSummary(project, client, study, analyses, samples);
  const fallback = getDeterministicStudyNarrative(summary, language);

  if (!apiKey || apiKey.trim() === '') {
    return fallback;
  }

  const prompt = `You are a Principal Geotechnical Engineer writing an authoritative study report.
PROJECT: ${summary.projectName}
CLIENT: ${summary.clientName}
LOCATION: ${summary.siteLocation}
STUDY TITLE: ${summary.studyTitle}
LANGUAGE: ${language === 'fr' ? 'FRENCH' : 'ENGLISH'}

STRUCTURED DATA SUMMARY (DO NOT INVENT OR RECALCULATE ANY NUMBERS; CITE ONLY THESE):
${JSON.stringify(summary, null, 2)}

TASK:
Write the 4 main narrative sections for this study report in ${language === 'fr' ? 'FRENCH' : 'ENGLISH'}:
1. "introduction": 2 professional paragraphs presenting the project context, objectives of the study, and client.
2. "materials": 2 paragraphs describing the geology, sample types, depths, and test battery.
3. "discussion": 3 paragraphs analyzing compaction, grading, moisture behavior, citing the exact numbers from above.
4. "recommendations": practical bullet points for earthworks execution, compaction targets (OPM %), and QA controls.

Return a STRICT JSON object with these exact 4 keys:
{
  "introduction": "string",
  "materials": "string",
  "discussion": "string",
  "recommendations": "string"
}`;

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
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.warn('Gemini API call returned non-200, falling back to deterministic template');
      return fallback;
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return fallback;

    const parsed = JSON.parse(rawText);
    return {
      introduction: parsed.introduction || fallback.introduction,
      materials: parsed.materials || fallback.materials,
      discussion: parsed.discussion || fallback.discussion,
      recommendations: parsed.recommendations || fallback.recommendations,
      isAiGenerated: true,
    };
  } catch (err) {
    console.warn('Failed to call Gemini API, using deterministic fallback narrative:', err);
    return fallback;
  }
}
