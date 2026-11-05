import type {
  StudyReport,
  StudyPhoto,
  StudySectionType,
  GeoLabProject,
  GeoLabClient,
  GeoLabAnalysis,
  GeoLabSample,
  OrganisationProfile,
  ApprovalChainEntry,
  StudyRevision,
  GeoLabTestType,
  ValueProvenance,
  HeaderLogos,
} from '../../../types/geolab';
import { getStudyTemplate } from '../templates';
import { DEFAULT_NARRATIVES } from '../templates/characterisationSoils';
import { checkStudyConsistency } from './studyConsistencyChecker';
import { getTestDefinition } from '../../tests/index';
import { getDeterministicNarrative } from '../../engine/aiNarrative';

export interface CoverBlockData {
  bilingualHeader?: { col1Text: string; col2Text: string };
  headerLogos?: HeaderLogos;
  logoBase64?: string;
  primaryColor: string;
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  accreditationNumber?: string;
  programmeTitle?: string;
  lotSection?: string;
  contractNumber?: string;
  tenderNumber?: string;
  financingText?: string;
  parties?: Array<{ role: string; name: string; contact?: string }>;
  clientName: string;
  clientContact?: string;
  projectName: string;
  siteLocation?: string;
  studyTitle: string;
  reportNumber: string;
  status: 'draft' | 'checked' | 'approved';
  isDraftWatermark: boolean;
  revisions: StudyRevision[];
  approvalChain: ApprovalChainEntry[];
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
}

export interface NarrativeBlockData {
  id: string;
  title: string;
  markdown: string;
}

export interface AnalysisSummaryRow {
  analysisId: string;
  sampleId: string;
  testType: GeoLabTestType;
  testLabel: string;
  standard: string;
  testedDate: string;
  keyResultsText: string;
  status: string;
}

export interface AnalysisDetailBlockData {
  analysis: GeoLabAnalysis;
  sample?: GeoLabSample;
  testLabel: string;
  sectionTitle?: string;
  inputs: Array<{ label: string; value: string | number; unit?: string }>;
  results: Array<{ label: string; value: string | number; unit?: string; provenance?: ValueProvenance }>;
  chartType?: 'proctor' | 'grain_size';
  observations?: string;
}

export interface GradingCurvesBlockData {
  analyses: GeoLabAnalysis[];
}

export interface ConformityRow {
  sampleId: string;
  testType: string;
  parameter: string;
  measured: string | number;
  specification: string;
  status: 'conform' | 'non_conform' | 'informative';
}

export interface PhotoGridItem {
  id: string;
  caption: string;
  blobOrBase64?: Blob | string;
  mimeType: string;
}

export interface PhotoPageBlockData {
  photos: PhotoGridItem[];
  pageIndex: number;
  totalPhotoPages: number;
}

export interface DocumentBlock {
  id: string;
  type: StudySectionType;
  title: string;
  coverData?: CoverBlockData;
  tocItems?: TocItem[];
  narrativeData?: NarrativeBlockData;
  summaryRows?: AnalysisSummaryRow[];
  detailData?: AnalysisDetailBlockData;
  gradingCurvesData?: GradingCurvesBlockData;
  conformityRows?: ConformityRow[];
  usageNoteText?: { en: string; fr: string };
  signatureChain?: ApprovalChainEntry[];
  photoPageData?: PhotoPageBlockData;
  annexAnalyses?: GeoLabAnalysis[];
  dataQualityNotesText?: string;
}

export interface DocumentModel {
  study: StudyReport;
  project: GeoLabProject;
  client: GeoLabClient;
  organisation: OrganisationProfile;
  language: 'en' | 'fr';
  primaryColor: string;
  isDraftWatermark: boolean;
  isSampleDocument?: boolean;
  blocks: DocumentBlock[];
}

export interface BuildDocumentModelParams {
  study: StudyReport;
  project: GeoLabProject;
  client: GeoLabClient;
  organisation: OrganisationProfile;
  analyses: GeoLabAnalysis[];
  samples?: GeoLabSample[];
  photos?: StudyPhoto[];
  language?: 'en' | 'fr';
  validateConsistency?: boolean;
  isSampleDocument?: boolean;
}

export function buildDocumentModel(params: BuildDocumentModelParams): DocumentModel {
  const { study, project, client, organisation, analyses, samples = [], photos = [], validateConsistency = false } = params;
  const lang = params.language || study.language || organisation.defaultLanguage || 'en';

  // Rule 9: Block approved studies when organisation profile has no company name
  if (study.status === 'approved' && !organisation.companyName?.trim()) {
    throw new Error(
      lang === 'fr'
        ? 'Veuillez configurer le profil de votre organisation avant de générer des rapports approuvés.'
        : 'Please configure your organisation profile before generating approved reports.'
    );
  }

  // Stage 3: Consistency validation when requested for approved studies
  if (study.status === 'approved' && validateConsistency) {
    const consistency = checkStudyConsistency({
      study,
      project,
      client,
      organisation,
      analyses,
      samples,
    });

    if (consistency.hasErrors) {
      const errorDetails = consistency.findings
        .filter((f) => f.severity === 'error')
        .map((f) => f.message[lang] || f.message.fr || f.message.en)
        .join('; ');
      throw new Error(
        lang === 'fr'
          ? `L'exportation de l'étude approuvée est bloquée en raison d'erreurs de cohérence critiques : ${errorDetails}`
          : `Approved study export is blocked due to critical consistency errors: ${errorDetails}`
      );
    }
  }

  // Filter analyses included in this study
  const includedAnalyses = analyses.filter((a) =>
    study.includedAnalysisIds ? study.includedAnalysisIds.includes(a.id) : true
  );

  // Draft watermark if study is not approved OR if any included analysis is not approved
  const isDraftWatermark =
    study.status !== 'approved' ||
    includedAnalyses.some((a) => a.status !== 'approved');

  const primaryColor = organisation.primaryColor || '#1e40af';

  // Resolve section definitions (from study.sections, or fallback to template)
  let sectionDefs = study.sections;
  if (!sectionDefs || sectionDefs.length === 0) {
    const template = getStudyTemplate(study.templateId) || getStudyTemplate('characterisation_soils');
    if (template) {
      sectionDefs = template.sections.map((s, idx) => ({
        ...s,
        id: `sec-${idx + 1}`,
      }));
    } else {
      sectionDefs = [];
    }
  }

  const blocks: DocumentBlock[] = [];
  const tocItems: TocItem[] = [];

  // Build the approval chain (only from stored data; never invented names)
  const approvalChain: ApprovalChainEntry[] =
    organisation.approvalChain && organisation.approvalChain.length > 0
      ? organisation.approvalChain
      : (organisation.signatories || []).map((s, idx) => ({
          id: `sig-${idx + 1}`,
          roleLabel: { en: s.role, fr: s.role },
          name: s.name || '',
          title: s.title || '',
          stampOrSignatureBase64: s.stampOrSignatureBase64,
        }));

  // Helper to extract key results for summary table
  const getKeyResultsText = (a: GeoLabAnalysis): string => {
    if (!a.computedResults) return '-';
    try {
      const def = getTestDefinition(a.testType);
      if (def?.keyResults) {
        const items = def.keyResults(a.computedResults, lang);
        if (items && items.length > 0) {
          return items
            .map((item) => `${item.label} : ${item.value}${item.unit ? ' ' + item.unit : ''}`)
            .join(' | ');
        }
      }
    } catch {
      // fallback
    }
    return '-';
  };

  const getTestLabel = (testType: GeoLabTestType): string => {
    try {
      const def = getTestDefinition(testType);
      return def?.name?.[lang] || testType;
    } catch {
      return testType;
    }
  };

  // Process enabled sections in order
  for (const sec of sectionDefs) {
    if (sec.enabled === false) continue;

    const blockTitle = sec.title?.[lang] || sec.title?.en || '';

    switch (sec.type) {
      case 'cover': {
        const bilingual = organisation.bilingualHeaderBlock || (organisation as any).bilingualHeader;
        const col1 = bilingual?.col1Text || bilingual?.column1;
        const col2 = bilingual?.col2Text || bilingual?.column2;

        blocks.push({
          id: sec.id,
          type: 'cover',
          title: blockTitle,
          coverData: {
            bilingualHeader: col1 || col2 ? { col1Text: col1 || '', col2Text: col2 || '' } : undefined,
            headerLogos: organisation.headerLogos || (organisation as any).logos,
            logoBase64: organisation.logoBase64,
            primaryColor,
            companyName: organisation.companyName || '',
            address: organisation.address || undefined,
            phone: organisation.phone || undefined,
            email: organisation.email || undefined,
            accreditationNumber: organisation.accreditationNumber || undefined,
            programmeTitle: project.programmeTitle || project.programme || undefined,
            lotSection: project.lotSection || undefined,
            contractNumber: project.contractNumber || undefined,
            tenderNumber: project.tenderNumber || undefined,
            financingText: project.financingText || project.financing || undefined,
            parties: project.parties && project.parties.length > 0 ? project.parties : undefined,
            clientName: client.companyName || '',
            clientContact: client.contactPerson || undefined,
            projectName: project.projectName || '',
            siteLocation: project.siteLocation || undefined,
            studyTitle: study.title || '',
            reportNumber: study.reportNumber || '',
            status: study.status,
            isDraftWatermark,
            revisions: study.revisions || [],
            approvalChain,
          },
        });
        break;
      }

      case 'toc': {
        blocks.push({
          id: sec.id,
          type: 'toc',
          title: blockTitle,
          tocItems, // Will be linked
        });
        break;
      }

      case 'narrative': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });

        let markdownText = '';
        if (typeof sec.content === 'object' && sec.content !== null) {
          markdownText = (sec.content as any)[lang] || (sec.content as any).fr || (sec.content as any).en || '';
        } else if (typeof sec.content === 'string') {
          markdownText = sec.content;
          // Check if sec.content matches an English default narrative in a French study, or vice-versa
          for (const key of Object.keys(DEFAULT_NARRATIVES) as Array<keyof typeof DEFAULT_NARRATIVES>) {
            const pair = DEFAULT_NARRATIVES[key];
            if (lang === 'fr' && markdownText.trim() === pair.en.trim()) {
              markdownText = pair.fr;
              break;
            } else if (lang === 'en' && markdownText.trim() === pair.fr.trim()) {
              markdownText = pair.en;
              break;
            }
          }
        }

        blocks.push({
          id: sec.id,
          type: 'narrative',
          title: blockTitle,
          narrativeData: {
            id: sec.id,
            title: blockTitle,
            markdown: markdownText,
          },
        });
        break;
      }

      case 'analysisSummaryTable': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        const summaryRows: AnalysisSummaryRow[] = includedAnalyses.map((a) => {
          const sample = samples.find((s) => s.id === a.sampleId);
          return {
            analysisId: a.id,
            sampleId: sample?.sampleId || a.sampleId || '-',
            testType: a.testType,
            testLabel: getTestLabel(a.testType),
            standard: a.standard || '-',
            testedDate: a.testedDate || a.createdAt || '-',
            keyResultsText: getKeyResultsText(a),
            status: a.status,
          };
        });

        blocks.push({
          id: sec.id,
          type: 'analysisSummaryTable',
          title: blockTitle,
          summaryRows,
        });
        break;
      }

      case 'analysisDetail': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        let isFirstDetail = true;
        for (const a of includedAnalyses) {
          const sample = samples.find((s) => s.id === a.sampleId);
          const detailBlockId = `${sec.id}-${a.id}`;
          let def: any;
          try {
            def = getTestDefinition(a.testType);
          } catch {
            // fallback
          }

          const testLabel = def?.name?.[lang] || getTestLabel(a.testType);
          const itemTitle = `${testLabel} - ${sample?.sampleId || a.sampleId}`;

          const inputs: Array<{ label: string; value: string | number; unit?: string }> = [];
          if (def?.inputSchema?.parameters && a.rawInput) {
            for (const p of def.inputSchema.parameters) {
              const val = a.rawInput[p.key];
              if (val !== undefined && val !== null && val !== '') {
                inputs.push({
                  label: p.label?.[lang] || p.key,
                  value: val,
                  unit: p.unit,
                });
              }
            }
          }

          let results: Array<{ label: string; value: string | number; unit?: string; provenance?: ValueProvenance }> = [];
          if (def?.keyResults && a.computedResults) {
            results = def.keyResults(a.computedResults, lang);
          }

          blocks.push({
            id: detailBlockId,
            type: 'analysisDetail',
            title: itemTitle,
            detailData: {
              analysis: a,
              sample,
              testLabel,
              sectionTitle: isFirstDetail ? blockTitle : undefined,
              inputs,
              results,
              chartType: a.testType === 'proctor' || a.testType === 'grain_size' ? a.testType : undefined,
              observations: (() => {
                let obs = a.observations || undefined;
                if (obs && (obs.includes('undefined%') || (a.testType !== 'water_content' && obs.toLowerCase().includes('moisture content determination')))) {
                  obs = getDeterministicNarrative(a, lang);
                }
                return obs;
              })(),
            },
          });
          isFirstDetail = false;
        }
        break;
      }

      case 'gradingCurves': {
        const grainAnalyses = includedAnalyses.filter((a) => a.testType === 'grain_size');
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        blocks.push({
          id: sec.id,
          type: 'gradingCurves',
          title: blockTitle,
          gradingCurvesData: {
            analyses: grainAnalyses,
          },
        });
        break;
      }

      case 'conformityTable': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        const conformityRows: ConformityRow[] = [];
        const projectLimits = (project as any).specLimits || {};

        for (const a of includedAnalyses) {
          const sample = samples.find((s) => s.id === a.sampleId);
          const sampleName = sample?.sampleId || a.sampleId || '-';
          let def: any;
          try {
            def = getTestDefinition(a.testType);
          } catch {
            // fallback
          }
          const testLabel = def?.name?.[lang] || getTestLabel(a.testType);

          const limitsForTest = projectLimits[a.testType];
          if (limitsForTest && a.computedResults) {
            for (const [paramKey, limitConfig] of Object.entries<any>(limitsForTest)) {
              const measuredVal = a.computedResults[paramKey];
              if (measuredVal !== undefined && measuredVal !== null) {
                let status: 'conform' | 'non_conform' | 'informative' = 'conform';
                let specStr = limitConfig.specification || '';
                const numVal = typeof measuredVal === 'number' ? measuredVal : parseFloat(measuredVal);

                if (!isNaN(numVal)) {
                  if (typeof limitConfig.min === 'number' && numVal < limitConfig.min) {
                    status = 'non_conform';
                  }
                  if (typeof limitConfig.max === 'number' && numVal > limitConfig.max) {
                    status = 'non_conform';
                  }
                  if (!specStr) {
                    if (limitConfig.min !== undefined && limitConfig.max !== undefined) {
                      specStr = `[${limitConfig.min} ; ${limitConfig.max}]`;
                    } else if (limitConfig.min !== undefined) {
                      specStr = `≥ ${limitConfig.min}`;
                    } else if (limitConfig.max !== undefined) {
                      specStr = `≤ ${limitConfig.max}`;
                    }
                  }
                }

                conformityRows.push({
                  sampleId: sampleName,
                  testType: testLabel,
                  parameter: limitConfig.label?.[lang] || paramKey,
                  measured: `${measuredVal}${limitConfig.unit ? ' ' + limitConfig.unit : ''}`,
                  specification: specStr,
                  status,
                });
              }
            }
          }
        }

        blocks.push({
          id: sec.id,
          type: 'conformityTable',
          title: blockTitle,
          conformityRows,
        });
        break;
      }

      case 'usageNote': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        blocks.push({
          id: sec.id,
          type: 'usageNote',
          title: blockTitle,
          usageNoteText: {
            en:
              'IMPORTANT NOTE ON THE USE OF TEST RESULTS:\n' +
              'The results presented in this report relate exclusively to the samples tested as received at the laboratory. ' +
              'Any extrapolation to surrounding geological formations or unverified quarry areas remains under the sole responsibility of the geotechnical design engineer. ' +
              'This report shall not be reproduced, except in full, without the written approval of the laboratory.',
            fr:
              "NOTE IMPORTANTE RELATIVE À L'UTILISATION DES RÉSULTATS :\n" +
              "Les résultats présentés dans le présent rapport concernent exclusivement les échantillons soumis aux essais tels que réceptionnés au laboratoire. " +
              "Toute extrapolation aux formations géologiques avoisinantes ou zones d'emprunt non vérifiées relève de la seule responsabilité de la maîtrise d'œuvre. " +
              "Ce rapport ne doit pas être reproduit partiellement sans l'approbation écrite du laboratoire.",
          },
        });
        break;
      }

      case 'signatureBlock': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        blocks.push({
          id: sec.id,
          type: 'signatureBlock',
          title: blockTitle,
          signatureChain: approvalChain,
        });
        break;
      }

      case 'photoPages': {
        if (photos.length > 0) {
          tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
          const sortedPhotos = [...photos].sort((a, b) => (a.order || 0) - (b.order || 0));
          const chunkSize = 6;
          const totalPhotoPages = Math.ceil(sortedPhotos.length / chunkSize);

          for (let pIdx = 0; pIdx < totalPhotoPages; pIdx++) {
            const slice = sortedPhotos.slice(pIdx * chunkSize, (pIdx + 1) * chunkSize);
            blocks.push({
              id: `${sec.id}-p${pIdx + 1}`,
              type: 'photoPages',
              title: `${blockTitle} (${pIdx + 1}/${totalPhotoPages})`,
              photoPageData: {
                photos: slice.map((p) => ({
                  id: p.id,
                  caption: p.caption || '',
                  blobOrBase64: p.blob,
                  mimeType: p.mimeType || 'image/jpeg',
                })),
                pageIndex: pIdx + 1,
                totalPhotoPages,
              },
            });
          }
        }
        break;
      }

      case 'annexTestSheets': {
        if (includedAnalyses.length > 0) {
          tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
          blocks.push({
            id: sec.id,
            type: 'annexTestSheets',
            title: blockTitle,
            annexAnalyses: includedAnalyses,
          });
        }
        break;
      }

      case 'dataQualityNotes': {
        tocItems.push({ id: sec.id, title: blockTitle, level: 1 });
        blocks.push({
          id: sec.id,
          type: 'dataQualityNotes',
          title: blockTitle,
          dataQualityNotesText:
            lang === 'fr'
              ? 'Toutes les mesures ont été vérifiées selon les critères de répétabilité de la norme d’essai correspondante. Aucune anomalie n’a été constatée sur les bilans de masse et conditions d’étuvage.'
              : 'All measurements were verified according to the repeatability criteria of the corresponding test standards. No anomalies were observed regarding mass balance or drying oven conditions.',
        });
        break;
      }

      case 'pageBreak': {
        blocks.push({
          id: sec.id,
          type: 'pageBreak',
          title: 'Page Break',
        });
        break;
      }
    }
  }

  // Update TOC block with the accumulated items
  const tocBlock = blocks.find((b) => b.type === 'toc');
  if (tocBlock) {
    tocBlock.tocItems = tocItems;
  }

  return {
    study,
    project,
    client,
    organisation,
    language: lang,
    primaryColor,
    isDraftWatermark,
    isSampleDocument: Boolean(params.isSampleDocument),
    blocks,
  };
}
