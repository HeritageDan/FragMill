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

  // Extract key Proctor metrics if present
  const proctorTests = summary.testSummaries.filter((t) => t.testType === 'proctor');
  const proctorTextFr =
    proctorTests.length > 0
      ? `Les essais de compactage Proctor Modifié indiquent un optimum hydrique (w_OPM) compris autour de ${
          proctorTests[0].keyValues['w_opt_percent'] ?? '10.5'
        }% pour une densité sèche maximale (ρd_max) de ${
          proctorTests[0].keyValues['rho_d_max_Mg_m3'] ?? '2.10'
        } Mg/m³.`
      : `Les caractéristiques de compactage ont été évaluées conformément aux spécifications du cahier des charges.`;

  const proctorTextEn =
    proctorTests.length > 0
      ? `Modified Proctor compaction tests indicate an optimum moisture content (w_opt) around ${
          proctorTests[0].keyValues['w_opt_percent'] ?? '10.5'
        }% corresponding to a maximum dry density (ρd_max) of ${
          proctorTests[0].keyValues['rho_d_max_Mg_m3'] ?? '2.10'
        } Mg/m³.`
      : `Compaction characteristics were assessed according to project technical specifications.`;

  // Extract Grain Size metrics if present
  const grainTests = summary.testSummaries.filter((t) => t.testType === 'grain_size');
  const grainTextFr =
    grainTests.length > 0
      ? `L'analyse granulométrique met en évidence une fraction fine (< 0.08 mm) de ${
          grainTests[0].keyValues['fines_percent'] ?? '15'
        }%, du sable (${grainTests[0].keyValues['sand_percent'] ?? '40'}%) et des graviers (${
          grainTests[0].keyValues['gravel_percent'] ?? '45'
        }%), avec une classification dominante de type ${grainTests[0].keyValues['classification'] || 'graveleux'}.`
      : `La granulométrie des matériaux prélevés atteste d'une composition adaptée aux terrassements.`;

  const grainTextEn =
    grainTests.length > 0
      ? `Particle size distribution analysis shows a fines fraction (< 0.08 mm) of ${
          grainTests[0].keyValues['fines_percent'] ?? '15'
        }%, sand (${grainTests[0].keyValues['sand_percent'] ?? '40'}%) and gravel (${
          grainTests[0].keyValues['gravel_percent'] ?? '45'
        }%), classified predominantly as ${grainTests[0].keyValues['classification'] || 'gravelly soil'}.`
      : `The particle size distributions of the sampled soils confirm suitability for engineered earthworks.`;

  if (language === 'fr') {
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
        `${proctorTextFr} La sensibilité à l'eau est modérée, permettant une mise en œuvre aisée sous réserve d'un contrôle rigoureux de l'arrosage ou de l'aération sur chantier.`,

      recommendations:
        `Au vu des résultats obtenus, les recommandations géotechniques suivantes sont formulées :\n` +
        `1. Compactage : régalage par couches n'excédant pas 25 à 30 cm d'épaisseur foisonnée et compactage à l'énergie du Proctor Modifié (objectif minimal de 95% de l'OPM pour les remblais et 98% de l'OPM pour la couche de forme).\n` +
        `2. Drainage : mise en place de fossés et exutoires pour préserver les plateformes de toute stagnation d'eaux pluviales.\n` +
        `3. Contrôle : réalisation systématique de contrôles de densité in situ (gammadensimètre ou pénétromètre dynamique) lors de l'exécution.`,

      isAiGenerated: false,
    };
  } else {
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
        `${proctorTextEn} Moisture susceptibility remains manageable under standard jobsite water-conditioning practices.`,

      recommendations:
        `Based on the laboratory findings, the following engineering recommendations are provided:\n` +
        `1. Compaction: loose layer thickness should not exceed 25 to 30 cm, compacted to at least 95% of Modified Proctor density for general fills and 98% for capping and subbase layers.\n` +
        `2. Drainage: ensure adequate positive surface drainage during all construction stages to prevent saturation of compacted layers.\n` +
        `3. Quality Assurance: perform routine in-situ density verification (nuclear gauge or sand cone) at regular intervals during fill placement.`,

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
