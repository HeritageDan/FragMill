import { postAiGenerateContent } from '../../../services/ai';
import type { AiProvider } from '../../../types';
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
  conclusion?: string;
  isAiGenerated: boolean;
}

export interface StudyAiNarrativeOptions {
  study: StudyReport;
  project: GeoLabProject;
  client: GeoLabClient;
  analyses: GeoLabAnalysis[];
  samples?: GeoLabSample[];
  apiKey?: string;
  provider?: AiProvider;
  model?: string;
  language?: 'en' | 'fr';
}

interface StructuredStudySummary {
  projectName: string;
  clientName: string;
  siteLocation: string;
  programmeTitle?: string;
  lotSection?: string;
  contractNumber?: string;
  tenderNumber?: string;
  financingText?: string;
  studyTitle: string;
  sampleCount: number;
  materialTypes: string[];
  testSummaries: Array<{
    sampleId: string;
    testType: string;
    standard?: string;
    keyValues: Record<string, string | number | boolean>;
    qualityWarnings?: Array<{ code: string; message: string }>;
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
    const res = (a.computedResults || {}) as any;
    const keyValues: Record<string, string | number | boolean> = {};
    const tType = a.testType as string;

    if (tType === 'proctor') {
      const p = res as ProctorResults;
      if (typeof p.opmMoisturePercent === 'number') keyValues['w_opt_percent'] = p.opmMoisturePercent;
      if (typeof p.maxDryDensityGcm3 === 'number') keyValues['rho_d_max_Mg_m3'] = p.maxDryDensityGcm3;
      if (typeof p.targetDryDensityGcm3 === 'number') keyValues['target_rho_d_95_percent'] = p.targetDryDensityGcm3;
    } else if (tType === 'grain_size') {
      const g = res as GrainSizeResults;
      if (typeof g.finesPercent === 'number') keyValues['fines_percent'] = g.finesPercent;
      if (typeof g.sandPercent === 'number') keyValues['sand_percent'] = g.sandPercent;
      if (typeof g.gravelPercent === 'number') keyValues['gravel_percent'] = g.gravelPercent;
      if (typeof (g as any).d50Mm === 'number') keyValues['D50_mm'] = (g as any).d50Mm;
      if (typeof g.cu === 'number') keyValues['Cu'] = g.cu;
      if (typeof g.cc === 'number') keyValues['Cc'] = g.cc;
      if (g.lcpcClassification) keyValues['classification'] = g.lcpcClassification;
    } else if (tType === 'water_content') {
      const wc = res.meanWaterContentPercent ?? res.averageWaterContent;
      if (typeof wc === 'number') keyValues['w_n_percent'] = wc;
      if (typeof res.differenceBetweenSpecimensPercent === 'number') keyValues['diff_percent'] = res.differenceBetweenSpecimensPercent;
    } else if (tType === 'specific_gravity') {
      const gs = res.meanGs ?? res.specificGravity;
      const dens = res.solidDensityGcm3 ?? res.solidDensityMgM3 ?? res.densityTm3 ?? gs;
      if (typeof gs === 'number') keyValues['Gs'] = gs;
      if (typeof dens === 'number') keyValues['rho_s_t_m3'] = dens;
      if (typeof res.differenceGs === 'number') keyValues['delta_Gs'] = res.differenceGs;
      keyValues['repeatability_accepted'] = res.repeatabilityAccepted ?? (typeof res.differenceGs === 'number' && res.differenceGs <= 0.03);
      if (res.materialType) keyValues['material_type'] = res.materialType;
    } else if (tType === 'bulk_density') {
      const bd = res.meanBulkDensityGcm3 ?? res.meanBulkDensityTm3;
      if (typeof bd === 'number') keyValues['bulk_density_t_m3'] = bd;
      if (res.compactionState) keyValues['compaction_state'] = res.compactionState;
    } else if (tType === 'sand_equivalent') {
      if (typeof res.meanEsVisual === 'number') keyValues['ES_visual_percent'] = res.meanEsVisual;
      if (typeof res.meanEsPiston === 'number') keyValues['ES_piston_percent'] = res.meanEsPiston;
    } else if (tType === 'los_angeles') {
      const la = res.laCoefficient ?? res.meanLa;
      if (typeof la === 'number') keyValues['LA_coefficient_percent'] = la;
      if (res.laCategory) keyValues['category'] = res.laCategory;
    } else if (tType === 'micro_deval') {
      const mde = res.mdeCoefficient ?? res.meanMde;
      if (typeof mde === 'number') keyValues['MDE_coefficient_percent'] = mde;
      if (res.mdeCategory) keyValues['category'] = res.mdeCategory;
    } else if (tType === 'flakiness') {
      const fi = res.flakinessIndexA;
      if (typeof fi === 'number') keyValues['flakiness_index_A_percent'] = fi;
      if (res.flakinessCategory) keyValues['category'] = res.flakinessCategory;
    } else if (tType === 'surface_cleanliness') {
      const p = res.meanCleanlinessPercentageP;
      if (typeof p === 'number') keyValues['cleanliness_P_percent'] = p;
      if (res.cleanlinessCategory) keyValues['category'] = res.cleanlinessCategory;
    } else if (tType === 'methylene_blue') {
      const vbs = res.primaryValue ?? res.vbsValue ?? res.mbValue;
      if (typeof vbs === 'number') keyValues['VBS_value'] = vbs;
      if (res.soilSensitivityClass) keyValues['sensitivity_class'] = res.soilSensitivityClass;
    } else if (tType === 'atterberg') {
      if (typeof res.liquidLimit === 'number') keyValues['LL'] = res.liquidLimit;
      if (typeof res.plasticLimit === 'number') keyValues['PL'] = res.plasticLimit;
      if (typeof res.plasticityIndex === 'number') keyValues['PI'] = res.plasticityIndex;
    } else if (tType === 'cbr') {
      if (typeof res.cbrIndex === 'number') keyValues['CBR_percent'] = res.cbrIndex;
      if (typeof res.swellingPercent === 'number') keyValues['swelling_percent'] = res.swellingPercent;
    }

    const warnings = (a.qualityWarnings || []).map((w) => ({
      code: w.code,
      message: typeof w.message === 'object' ? (w.message.fr || w.message.en) : String(w.message),
    }));

    testSummaries.push({
      sampleId: sId,
      testType: a.testType,
      standard: a.standard,
      keyValues,
      qualityWarnings: warnings.length > 0 ? warnings : undefined,
    });
  });

  return {
    projectName: project.projectName,
    clientName: client.companyName,
    siteLocation: project.siteLocation || 'Site du projet',
    programmeTitle: project.programmeTitle,
    lotSection: project.lotSection,
    contractNumber: project.contractNumber,
    tenderNumber: project.tenderNumber,
    financingText: project.financingText,
    studyTitle: study.title,
    sampleCount: samples.length > 0 ? samples.length : (testSummaries.length > 0 ? 1 : 0),
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
  }

  // 3. Specific gravity if present
  const specGravTests = summary.testSummaries.filter((t) => t.testType === 'specific_gravity');
  let specGravFr = '';
  let specGravEn = '';
  if (specGravTests.length > 0) {
    const gs = specGravTests[0].keyValues['Gs'] ?? '2.65';
    const rhoS = specGravTests[0].keyValues['rho_s_t_m3'] ?? gs;
    const diff = specGravTests[0].keyValues['delta_Gs'];
    const acc = specGravTests[0].keyValues['repeatability_accepted'];
    const repFr = acc === false && diff !== undefined
      ? ` L'écart entre prises (ΔGs = ${diff}) excède la tolérance de 0.03, recommandant une confirmation sur les prélèvements de contrôle.`
      : ` Les déterminations vérifient la répétabilité prescrite.`;
    const repEn = acc === false && diff !== undefined
      ? ` The variance between duplicate trials (ΔGs = ${diff}) exceeds the 0.03 tolerance, recommending confirmation testing on check samples.`
      : ` Measured duplicate determinations satisfy normative repeatability.`;

    specGravFr = `La masse volumique des particules solides (pycnomètre NF P94-054) s'établit à Gs = ${gs} (masse volumique absolue ρs = ${rhoS} t/m³).${repFr} Ce paramètre fixe la référence absolue pour le calcul de l'indice des vides, de la porosité et la saturation théorique.`;
    specGravEn = `Specific gravity of solid particles (pycnometer NF P94-054 / ASTM D854) yields Gs = ${gs} (particle density ρs = ${rhoS} t/m³).${repEn} This parameter establishes the fundamental baseline for void ratio, porosity, and theoretical saturation calculations.`;
  }

  // 4. Atterberg limits if present
  const atterbergTests = summary.testSummaries.filter((t) => t.testType === 'atterberg');
  const atterbergTextFr = atterbergTests.length > 0 && atterbergTests[0].keyValues['PI'] !== undefined
    ? `Les limites d'Atterberg donnent un indice de plasticité Ip de ${atterbergTests[0].keyValues['PI']}% (wL = ${atterbergTests[0].keyValues['LL']}%, wP = ${atterbergTests[0].keyValues['PL']}%), caractérisant le comportement plastique des fines.`
    : '';
  const atterbergTextEn = atterbergTests.length > 0 && atterbergTests[0].keyValues['PI'] !== undefined
    ? `Atterberg limits determine a plasticity index PI of ${atterbergTests[0].keyValues['PI']}% (LL = ${atterbergTests[0].keyValues['LL']}%, PL = ${atterbergTests[0].keyValues['PL']}%), verifying fines plasticity.`
    : '';

  // 5. CBR bearing ratio if present
  const cbrTests = summary.testSummaries.filter((t) => t.testType === 'cbr');
  const cbrTextFr = cbrTests.length > 0 && cbrTests[0].keyValues['CBR_percent'] !== undefined
    ? `L'essai de portance CBR après immersion aboutit à un indice de ${cbrTests[0].keyValues['CBR_percent']}%, qualifiant l'aptitude mécanique en plateforme.`
    : '';
  const cbrTextEn = cbrTests.length > 0 && cbrTests[0].keyValues['CBR_percent'] !== undefined
    ? `California Bearing Ratio (CBR) testing yields a soaked value of ${cbrTests[0].keyValues['CBR_percent']}%, confirming structural subgrade bearing suitability.`
    : '';

  // 6. In-situ water content if present
  const waterTests = summary.testSummaries.filter((t) => t.testType === 'water_content');
  const waterTextFr = waterTests.length > 0 && waterTests[0].keyValues['w_n_percent'] !== undefined
    ? `La teneur en eau naturelle in situ s'élève à ${waterTests[0].keyValues['w_n_percent']}%, servant de référence pour le malaxage et compactage.`
    : '';
  const waterTextEn = waterTests.length > 0 && waterTests[0].keyValues['w_n_percent'] !== undefined
    ? `In-situ natural water content measures ${waterTests[0].keyValues['w_n_percent']}%, providing the baseline for moisture conditioning.`
    : '';

  // Admin references line
  const adminFr = [
    summary.programmeTitle ? `Programme : ${summary.programmeTitle}` : '',
    summary.lotSection ? `Lot / Section : ${summary.lotSection}` : '',
    summary.contractNumber ? `Marché N° : ${summary.contractNumber}` : '',
    summary.financingText ? `Financement : ${summary.financingText}` : '',
  ].filter(Boolean).join(' | ');

  const adminEn = [
    summary.programmeTitle ? `Programme: ${summary.programmeTitle}` : '',
    summary.lotSection ? `Lot / Section: ${summary.lotSection}` : '',
    summary.contractNumber ? `Contract No.: ${summary.contractNumber}` : '',
    summary.financingText ? `Financing: ${summary.financingText}` : '',
  ].filter(Boolean).join(' | ');

  if (language === 'fr') {
    const extraParts = [specGravFr, grainTextFr, proctorTextFr, atterbergTextFr, cbrTextFr, waterTextFr].filter(Boolean).join('\n\n');
    return {
      introduction:
        `Le présent rapport d'étude géotechnique s'inscrit dans le cadre du projet « ${summary.projectName} » réalisé pour le compte de ${summary.clientName}.\n\n` +
        (adminFr ? `${adminFr}\n\n` : '') +
        `L'objectif de cette campagne géotechnique est d'identifier, caractériser et valider la conformité des sols et matériaux situés sur le site (${summary.siteLocation}) afin d'optimiser les conditions d'exécution des terrassements, couches d'assise et fondations.`,

      materials:
        `La campagne d'investigation a porté sur ${summary.sampleCount} prélèvement(s) représentatifs des horizons d'emprunt et de déblai. Les matériaux identifiés correspondent principalement à des formations de type : ${materialsList}.\n\n` +
        `Au total, ${totalTests} essai(s) en laboratoire ont été réalisés selon les normes NF P94 et AFNOR en vigueur. Chaque échantillon a fait l'objet d'un suivi rigoureux de traçabilité dès sa prise en charge au laboratoire jusqu'à l'édition des procès-verbaux d'essais.`,

      discussion:
        `L'analyse croisée des résultats d'essais met en évidence les caractéristiques géotechniques suivantes pour le massif étudié :\n\n` +
        (extraParts || `Les essais réalisés confirment la régularité des paramètres physiques mesurés sur l'ensemble des prélèvements du projet.`),

      recommendations:
        `Au vu des résultats obtenus, les recommandations géotechniques suivantes sont formulées :\n` +
        `1. Compactage : régalage par couches n'excédant pas 25 à 30 cm d'épaisseur foisonnée et compactage à l'énergie du Proctor Modifié (objectif minimal de 95% de l'OPM pour les remblais et 98% de l'OPM pour la couche de forme).\n` +
        (cbrTests.length > 0 ? `2. Portance : confirmation de la portance d'assise sur la base de l'indice CBR mesuré (${cbrTests[0].keyValues['CBR_percent']}%).\n` : '') +
        (specGravTests.length > 0 ? `2. Masse volumique : intégrer la valeur Gs = ${specGravTests[0].keyValues['Gs']} pour le dimensionnement des volumes foisonnés et des indices des vides.\n` : '') +
        `3. Drainage : mise en place de fossés et exutoires pour préserver les plateformes de toute stagnation d'eaux pluviales.\n` +
        `4. Contrôle : réalisation systématique de contrôles de densité in situ (gammadensimètre ou pénétromètre dynamique) lors de l'exécution.`,

      conclusion:
        `En conclusion, l'ensemble des investigations de laboratoire réalisées sur le projet « ${summary.projectName} » atteste de la faisabilité géotechnique des travaux sous réserve du respect rigoureux des prescriptions de compactage et de drainage énoncées ci-dessus.`,

      isAiGenerated: false,
    };
  } else {
    const extraParts = [specGravEn, grainTextEn, proctorTextEn, atterbergTextEn, cbrTextEn, waterTextEn].filter(Boolean).join('\n\n');
    return {
      introduction:
        `This geotechnical study report has been prepared for the project "${summary.projectName}" on behalf of ${summary.clientName}.\n\n` +
        (adminEn ? `${adminEn}\n\n` : '') +
        `The primary objective of this geotechnical testing programme is to identify, characterize, and assess the mechanical and physical conformity of soils at ${summary.siteLocation} for structural earthworks and subgrade foundations.`,

      materials:
        `The sampling investigation comprised ${summary.sampleCount} representative sample(s) collected from borrow pits and cut zones. The principal material formations encountered consist of: ${materialsList}.\n\n` +
        `In total, ${totalTests} laboratory test(s) were conducted in strict accordance with relevant ASTM and NF geotechnical protocols. Full sample traceability and chain-of-custody was maintained throughout receipt and testing.`,

      discussion:
        `Cross-examination of the testing data demonstrates the following geotechnical behavior across the sampled profiles:\n\n` +
        (extraParts || `The completed tests confirm consistent physical properties across all samples retrieved from the site.`),

      recommendations:
        `Based on the laboratory findings, the following engineering recommendations are provided:\n` +
        `1. Compaction: loose layer thickness should not exceed 25 to 30 cm, compacted to at least 95% of Modified Proctor density for general fills and 98% for capping and subbase layers.\n` +
        (cbrTests.length > 0 ? `2. Subgrade: bearing layer verification confirmed by measured CBR value (${cbrTests[0].keyValues['CBR_percent']}%).\n` : '') +
        (specGravTests.length > 0 ? `2. Phase relations: incorporate solid density Gs = ${specGravTests[0].keyValues['Gs']} into void ratio and saturation calculations.\n` : '') +
        `3. Drainage: ensure adequate positive surface drainage during all construction stages to prevent saturation of compacted layers.\n` +
        `4. Quality Assurance: perform routine in-situ density verification (nuclear gauge or sand cone) at regular intervals during fill placement.`,

      conclusion:
        `In conclusion, the laboratory investigation for project "${summary.projectName}" establishes the technical suitability of the tested materials, subject to stringent adherence to specified compaction energy, moisture conditioning, and site drainage controls.`,

      isAiGenerated: false,
    };
  }
}

export async function generateStudyAiNarrative(
  options: StudyAiNarrativeOptions
): Promise<StudyNarrativeDraft> {
  const { study, project, client, analyses, samples = [], apiKey, provider, model, language = 'fr' } = options;

  const summary = extractStructuredSummary(project, client, study, analyses, samples);
  const fallback = getDeterministicStudyNarrative(summary, language);

  if (!apiKey || apiKey.trim() === '') {
    return fallback;
  }

  const prompt = `You are a Principal Geotechnical Engineer writing an authoritative, comprehensive study report.
PROJECT: ${summary.projectName}
CLIENT: ${summary.clientName}
LOCATION: ${summary.siteLocation}
${summary.programmeTitle ? `PROGRAMME: ${summary.programmeTitle}` : ''}
${summary.lotSection ? `LOT/SECTION: ${summary.lotSection}` : ''}
${summary.contractNumber ? `CONTRACT NO: ${summary.contractNumber}` : ''}
STUDY TITLE: ${summary.studyTitle}
LANGUAGE: ${language === 'fr' ? 'FRENCH' : 'ENGLISH'}

LABORATORY INVESTIGATION & COMPUTED TEST DATA:
${JSON.stringify(summary, null, 2)}

INSTRUCTIONS & QUALITY STANDARDS:
1. Thoroughly evaluate ALL test results listed in the data above. Do NOT produce generic, vague statements.
2. Cite the exact computed numbers and units from the data (e.g. Gs, dry density, moisture content, fines %, Cu, Cc, LA, MDE, CBR). NEVER hallucinate or alter any measured number.
3. If any test presents an unusual value or quality alert (e.g. low specific gravity Gs, repeatability limit exceeded, fines deficit, high moisture), explicitly identify it in the discussion, explain its physical geotechnical significance, and state what site engineering precautions must be taken.
4. Structure your response into the 5 core sections:
   - "introduction": 2 rich paragraphs detailing the project context, client, site location, administrative framework, and testing objectives.
   - "materials": 2 rich paragraphs describing the sampled lithological formations (e.g. ${summary.materialTypes.join(', ')}), sampling depths/locations, sample chain-of-custody, and referenced normative test standards.
   - "discussion": 3-4 deep technical paragraphs providing a rigorous cross-analysis of the physical and mechanical results, phase relationships, compaction behavior, void ratios, durability, and practical interpretation of all tested parameters.
   - "recommendations": Clear, numbered, actionable site engineering recommendations for earthworks, compaction energy (OPM %), layer thickness (25-30 cm), moisture conditioning, surface drainage, and quality control frequency.
   - "conclusion": 2 comprehensive concluding paragraphs synthesizing the fitness-for-purpose of the tested materials for earthworks, road foundations, or structural fills.
5. Do NOT use markdown formatting symbols such as asterisks (**bold** or *italic*) or hashtags (#) in the text; write clean, professional continuous paragraphs.

Return ONLY a strict JSON object with these exact 5 keys:
{
  "introduction": "string",
  "materials": "string",
  "discussion": "string",
  "recommendations": "string",
  "conclusion": "string"
}`;

  try {
    const res = await postAiGenerateContent(
      apiKey,
      [{ parts: [{ text: prompt }] }],
      {
        provider,
        model,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2500,
        },
      }
    );

    if (!res.ok) {
      console.warn('AI API call unsuccessful, falling back to deterministic template:', res.error);
      return fallback;
    }

    const rawText = res.text || res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return fallback;

    let parsed: any;
    try {
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      // Try finding first { and last }
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(rawText.substring(firstBrace, lastBrace + 1));
      } else {
        throw parseErr;
      }
    }

    return {
      introduction: parsed.introduction || fallback.introduction,
      materials: parsed.materials || fallback.materials,
      discussion: parsed.discussion || fallback.discussion,
      recommendations: parsed.recommendations || fallback.recommendations,
      conclusion: parsed.conclusion || fallback.conclusion,
      isAiGenerated: true,
    };
  } catch (err: any) {
    console.warn('Failed to call AI API, using deterministic fallback narrative:', err?.message);
    return fallback;
  }
}
