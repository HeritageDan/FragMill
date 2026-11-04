import type {
  StudyReport,
  GeoLabProject,
  GeoLabClient,
  OrganisationProfile,
  GeoLabAnalysis,
  GeoLabSample,
  ValueProvenance,
} from '../../../types/geolab';

export interface ConsistencyFinding {
  ruleCode:
    | 'DIVERGENT_SPECIFIC_GRAVITY'
    | 'PROCTOR_MOISTURE_DIVERGENCE'
    | 'MISSING_PROVENANCE_TAG'
    | 'DUPLICATE_RESULT_ROWS'
    | 'REPEATABILITY_LIMIT_EXCEEDED'
    | 'OUT_OF_RANGE_VALUES'
    | 'MISSING_REQUIRED_APPROVAL_FIELDS';
  severity: 'error' | 'warning' | 'info';
  sampleId?: string;
  analysisId?: string;
  message: {
    en: string;
    fr: string;
  };
}

export interface ConsistencyCheckParams {
  study: StudyReport;
  project: GeoLabProject;
  client?: GeoLabClient;
  organisation: OrganisationProfile;
  analyses: GeoLabAnalysis[];
  samples?: GeoLabSample[];
  valueProvenances?: Record<string, ValueProvenance>;
}

export interface ConsistencyCheckResult {
  valid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  findings: ConsistencyFinding[];
}

export function checkStudyConsistency(params: ConsistencyCheckParams): ConsistencyCheckResult {
  const { study, project, organisation, analyses, samples = [], valueProvenances = {} } = params;
  const findings: ConsistencyFinding[] = [];

  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  // Filter analyses included in study
  const includedSet = new Set(study.includedAnalysisIds || []);
  const studyAnalyses = analyses.filter((a) => includedSet.has(a.id));

  // --------------------------------------------------------------------------
  // Rule 1: Specific gravity (G_s or rho_s) divergence across fractions/materials
  // Compare the same parameter of the SAME material or fraction across analyses.
  // Flag if standard deviation > 0.05 Mg/m3 within the same material (warning)
  // --------------------------------------------------------------------------
  const densitiesByMaterial = new Map<string, Array<{ density: number; analysis: GeoLabAnalysis }>>();

  studyAnalyses.forEach((a) => {
    const res = a.computedResults;
    let densityVal: number | undefined;
    if (res) {
      if (typeof res.solidDensityMgM3 === 'number' && res.solidDensityMgM3 > 0) {
        densityVal = res.solidDensityMgM3;
      } else if (typeof res.solidDensityGcm3 === 'number' && res.solidDensityGcm3 > 0) {
        densityVal = res.solidDensityGcm3;
      } else if (typeof res.meanGs === 'number' && res.meanGs > 0) {
        densityVal = res.meanGs;
      } else if (typeof res.Gs === 'number' && res.Gs > 0) {
        densityVal = res.Gs;
      }
    }
    if (typeof densityVal === 'number') {
      const s = sampleMap.get(a.sampleId);
      const mat = (s?.materialType || a.rawInput?.materialType || a.rawInput?.material || a.computedResults?.materialType || '').trim().toLowerCase();
      const frac = (a.rawInput?.fraction || a.computedResults?.fraction || '').trim().toLowerCase();
      const key = mat ? (frac ? `${mat}::${frac}` : mat) : '__unspecified__';

      const list = densitiesByMaterial.get(key) || [];
      list.push({ density: densityVal, analysis: a });
      densitiesByMaterial.set(key, list);
    }
  });

  densitiesByMaterial.forEach((items, matKey) => {
    // Analyses with no material type must NOT be compared with each other; skip them
    if (matKey === '__unspecified__') {
      return;
    }

    if (items.length >= 2) {
      const values = items.map((i) => i.density);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0.05) {
        const matDisplay = ` (${matKey})`;
        findings.push({
          ruleCode: 'DIVERGENT_SPECIFIC_GRAVITY',
          severity: 'warning',
          message: {
            en: `Specific gravity divergence across samples of the same material${matDisplay} (std dev = ${stdDev.toFixed(3)} > 0.050 Mg/m³).`,
            fr: `Divergence de la masse volumique absolue entre échantillons du même matériau${matDisplay} (écart-type = ${stdDev.toFixed(3)} > 0.050 Mg/m³).`,
          },
        });
      }
    }
  });

  // --------------------------------------------------------------------------
  // Rule 2: Water content / Proctor consistency
  // Flag if |w_n - w_opt| > 15% for the same sample as 'info' with neutral wording
  // (different samples or depths normally have different natural moisture; not an inconsistency)
  // --------------------------------------------------------------------------
  const sampleAnalysesMap = new Map<string, GeoLabAnalysis[]>();
  studyAnalyses.forEach((a) => {
    const list = sampleAnalysesMap.get(a.sampleId) || [];
    list.push(a);
    sampleAnalysesMap.set(a.sampleId, list);
  });

  sampleAnalysesMap.forEach((analysesForSample, sampleId) => {
    const proctor = analysesForSample.find((a) => a.testType === 'proctor');
    const water = analysesForSample.find((a) => a.testType === 'water_content');

    if (proctor?.computedResults && water?.computedResults) {
      const wOpt =
        proctor.computedResults.opmMoisturePercent ??
        proctor.computedResults.optimumMoisturePercent;
      const wN =
        water.computedResults.waterContentPercent ??
        water.computedResults.moisturePercent ??
        water.computedResults.averageWaterContent;

      if (typeof wOpt === 'number' && typeof wN === 'number') {
        const diff = Math.abs(wN - wOpt);
        if (diff > 15) {
          const s = sampleMap.get(sampleId);
          const sampleName = s ? s.sampleId : sampleId;
          findings.push({
            ruleCode: 'PROCTOR_MOISTURE_DIVERGENCE',
            severity: 'info',
            sampleId,
            analysisId: proctor.id,
            message: {
              en: `Natural moisture (${wN.toFixed(1)}%) differs from Proctor optimum (${wOpt.toFixed(1)}%) for sample ${sampleName} (|Δw| = ${diff.toFixed(1)}%), reflecting in-situ condition relative to compaction optimum.`,
              fr: `La teneur en eau naturelle (${wN.toFixed(1)}%) diffère de l'optimum Proctor (${wOpt.toFixed(1)}%) pour l'échantillon ${sampleName} (|Δw| = ${diff.toFixed(1)}%), reflétant l'état hydrique in situ par rapport à l'optimum de compactage.`,
            },
          });
        }
      }
    }
  });

  // --------------------------------------------------------------------------
  // Rule 3: Missing provenance tag
  // Every value in summary tables must have a provenance tag ('measured' | 'projected' | 'manual')
  // Flag any with 'manual' or missing (warning)
  // --------------------------------------------------------------------------
  studyAnalyses.forEach((a) => {
    const prov = valueProvenances[a.id];
    if (!prov || prov === 'manual') {
      const s = sampleMap.get(a.sampleId);
      findings.push({
        ruleCode: 'MISSING_PROVENANCE_TAG',
        severity: 'warning',
        sampleId: a.sampleId,
        analysisId: a.id,
        message: {
          en: `Analysis ${a.reportNumber} (${s ? s.sampleId : a.sampleId}) is ${
            !prov ? 'missing a verified provenance tag' : 'tagged with manual entry without primary lab traceability'
          }.`,
          fr: `L'analyse ${a.reportNumber} (${s ? s.sampleId : a.sampleId}) ${
            !prov
              ? 'ne possède pas d’étiquette de traçabilité de provenance'
              : 'est étiquetée comme saisie manuelle sans traçabilité d’essai direct'
          }.`,
        },
      });
    }
  });

  // --------------------------------------------------------------------------
  // Rule 4: Repeated rows / identical values (error)
  // 4a. Cross-sample copy-paste detection (identical results across distinct samples)
  // 4b. Intra-analysis copy-paste detection (repeated identical rows within a table)
  // --------------------------------------------------------------------------
  for (let i = 0; i < studyAnalyses.length; i++) {
    for (let j = i + 1; j < studyAnalyses.length; j++) {
      const anA = studyAnalyses[i];
      const anB = studyAnalyses[j];

      // Only compare distinct samples with the same test type
      if (anA.sampleId !== anB.sampleId && anA.testType === anB.testType) {
        if (anA.computedResults && anB.computedResults) {
          const jsonA = JSON.stringify(anA.computedResults);
          const jsonB = JSON.stringify(anB.computedResults);

          if (jsonA === jsonB && jsonA.length > 30) {
            const sA = sampleMap.get(anA.sampleId)?.sampleId || anA.sampleId;
            const sB = sampleMap.get(anB.sampleId)?.sampleId || anB.sampleId;

            findings.push({
              ruleCode: 'DUPLICATE_RESULT_ROWS',
              severity: 'error',
              analysisId: anB.id,
              sampleId: anB.sampleId,
              message: {
                en: `Identical test results detected across distinct samples (${sA} and ${sB}) for test ${anA.testType} - potential copy-paste error.`,
                fr: `Résultats d'essais strictement identiques détectés entre deux échantillons distincts (${sA} et ${sB}) pour l'essai ${anA.testType} - risque d'erreur de copier-coller.`,
              },
            });
          }
        }
      }
    }
  }

  // 4b. Intra-analysis duplicate rows within raw input or results tables
  studyAnalyses.forEach((a) => {
    const s = sampleMap.get(a.sampleId);
    const sampleName = s ? s.sampleId : a.sampleId;
    const intraFindings = checkIntraAnalysisDuplicates(a, sampleName);
    findings.push(...intraFindings);
  });

  // --------------------------------------------------------------------------
  // Rule 5: Repeatability limits (AFNOR / ASTM)
  // Replicate tests on the same sample must not exceed limits:
  // - Water content: Delta w <= 0.5%
  // - Proctor: Delta rho_d <= 0.02 Mg/m3
  // - Atterberg: Delta LL <= 2% (error)
  // --------------------------------------------------------------------------
  sampleAnalysesMap.forEach((analysesForSample, sampleId) => {
    // Check Water Content replicates
    const wcTests = analysesForSample.filter((a) => a.testType === 'water_content');
    if (wcTests.length >= 2) {
      for (let i = 0; i < wcTests.length; i++) {
        for (let j = i + 1; j < wcTests.length; j++) {
          const valA = wcTests[i].computedResults?.waterContentPercent;
          const valB = wcTests[j].computedResults?.waterContentPercent;
          if (typeof valA === 'number' && typeof valB === 'number') {
            const diff = Math.abs(valA - valB);
            if (diff > 0.5) {
              findings.push({
                ruleCode: 'REPEATABILITY_LIMIT_EXCEEDED',
                severity: 'error',
                sampleId,
                analysisId: wcTests[j].id,
                message: {
                  en: `Water content repeatability limit exceeded for sample ${sampleMap.get(sampleId)?.sampleId || sampleId}: |Δw| = ${diff.toFixed(2)}% > 0.50%.`,
                  fr: `Limite de répétabilité de teneur en eau dépassée pour l'échantillon ${sampleMap.get(sampleId)?.sampleId || sampleId} : |Δw| = ${diff.toFixed(2)}% > 0.50%.`,
                },
              });
            }
          }
        }
      }
    }

    // Check Proctor replicates
    const prTests = analysesForSample.filter((a) => a.testType === 'proctor');
    if (prTests.length >= 2) {
      for (let i = 0; i < prTests.length; i++) {
        for (let j = i + 1; j < prTests.length; j++) {
          const valA =
            prTests[i].computedResults?.maxDryDensityGcm3 ??
            prTests[i].computedResults?.maxDryDensityMgM3;
          const valB =
            prTests[j].computedResults?.maxDryDensityGcm3 ??
            prTests[j].computedResults?.maxDryDensityMgM3;
          if (typeof valA === 'number' && typeof valB === 'number') {
            const diff = Math.abs(valA - valB);
            if (diff > 0.02) {
              findings.push({
                ruleCode: 'REPEATABILITY_LIMIT_EXCEEDED',
                severity: 'error',
                sampleId,
                analysisId: prTests[j].id,
                message: {
                  en: `Proctor dry density repeatability limit exceeded for sample ${sampleMap.get(sampleId)?.sampleId || sampleId}: |Δρd| = ${diff.toFixed(3)} > 0.020 Mg/m³.`,
                  fr: `Limite de répétabilité de masse volumique sèche Proctor dépassée pour l'échantillon ${sampleMap.get(sampleId)?.sampleId || sampleId} : |Δρd| = ${diff.toFixed(3)} > 0.020 Mg/m³.`,
                },
              });
            }
          }
        }
      }
    }

    // Check Atterberg replicates
    const attTests = analysesForSample.filter((a) => (a.testType as string) === 'atterberg');
    if (attTests.length >= 2) {
      for (let i = 0; i < attTests.length; i++) {
        for (let j = i + 1; j < attTests.length; j++) {
          const valA = attTests[i].computedResults?.liquidLimit;
          const valB = attTests[j].computedResults?.liquidLimit;
          if (typeof valA === 'number' && typeof valB === 'number') {
            const diff = Math.abs(valA - valB);
            if (diff > 2.0) {
              findings.push({
                ruleCode: 'REPEATABILITY_LIMIT_EXCEEDED',
                severity: 'error',
                sampleId,
                analysisId: attTests[j].id,
                message: {
                  en: `Atterberg liquid limit repeatability limit exceeded for sample ${sampleMap.get(sampleId)?.sampleId || sampleId}: |ΔLL| = ${diff.toFixed(1)}% > 2.0%.`,
                  fr: `Limite de répétabilité de limite de liquidité Atterberg dépassée pour l'échantillon ${sampleMap.get(sampleId)?.sampleId || sampleId} : |ΔLL| = ${diff.toFixed(1)}% > 2.0%.`,
                },
              });
            }
          }
        }
      }
    }
  });

  // --------------------------------------------------------------------------
  // Rule 6: Out-of-range units (error)
  // Densities > 3.5 or < 1.0 Mg/m3, moisture < 0 or > 100%, CBR < 0 or > 200%
  // --------------------------------------------------------------------------
  studyAnalyses.forEach((a) => {
    const res = a.computedResults;
    if (!res) return;

    // Check densities
    const densityFields = ['maxDryDensityGcm3', 'maxDryDensityMgM3', 'solidDensityMgM3', 'dryDensityMgM3'];
    densityFields.forEach((f) => {
      const val = res[f];
      if (typeof val === 'number') {
        if (val < 1.0 || val > 3.5) {
          findings.push({
            ruleCode: 'OUT_OF_RANGE_VALUES',
            severity: 'error',
            sampleId: a.sampleId,
            analysisId: a.id,
            message: {
              en: `Density value out of acceptable range [1.00, 3.50 Mg/m³]: ${f} = ${val.toFixed(2)} Mg/m³.`,
              fr: `Valeur de masse volumique hors plage acceptable [1.00, 3.50 Mg/m³] : ${f} = ${val.toFixed(2)} Mg/m³.`,
            },
          });
        }
      }
    });

    // Check moistures
    const moistureFields = ['opmMoisturePercent', 'optimumMoisturePercent', 'waterContentPercent', 'moisturePercent'];
    moistureFields.forEach((f) => {
      const val = res[f];
      if (typeof val === 'number') {
        if (val < 0 || val > 100) {
          findings.push({
            ruleCode: 'OUT_OF_RANGE_VALUES',
            severity: 'error',
            sampleId: a.sampleId,
            analysisId: a.id,
            message: {
              en: `Moisture value out of acceptable range [0%, 100%]: ${f} = ${val.toFixed(1)}%.`,
              fr: `Teneur en eau hors plage admissible [0%, 100%] : ${f} = ${val.toFixed(1)}%.`,
            },
          });
        }
      }
    });

    // Check CBR
    const cbrVal = res.cbrIndex ?? res.cbr ?? res.cbrPercent;
    if (typeof cbrVal === 'number') {
      if (cbrVal < 0 || cbrVal > 200) {
        findings.push({
          ruleCode: 'OUT_OF_RANGE_VALUES',
          severity: 'error',
          sampleId: a.sampleId,
          analysisId: a.id,
          message: {
            en: `CBR value out of acceptable range [0, 200%]: CBR = ${cbrVal.toFixed(1)}%.`,
            fr: `Indice CBR hors plage admissible [0, 200%] : CBR = ${cbrVal.toFixed(1)}%.`,
          },
        });
      }
    }
  });

  // --------------------------------------------------------------------------
  // Rule 7: Missing required header fields for approved studies (error)
  // If status is approved, all required header fields must be non-empty:
  // programme, lot, contract, financing, company name, signatories
  // --------------------------------------------------------------------------
  if (study.status === 'approved') {
    if (!organisation.companyName?.trim()) {
      findings.push({
        ruleCode: 'MISSING_REQUIRED_APPROVAL_FIELDS',
        severity: 'error',
        message: {
          en: 'Approved study missing mandatory company name in organisation profile.',
          fr: 'Étude approuvée sans raison sociale du laboratoire configurée dans le profil.',
        },
      });
    }

    const hasProgramme = Boolean(project.programmeTitle?.trim() || project.programme?.trim());
    if (!hasProgramme) {
      findings.push({
        ruleCode: 'MISSING_REQUIRED_APPROVAL_FIELDS',
        severity: 'error',
        message: {
          en: 'Approved study missing programme / project title header field.',
          fr: 'Étude approuvée sans titre de programme / opération dans l’en-tête.',
        },
      });
    }

    const hasLot = Boolean(project.lotSection?.trim());
    if (!hasLot) {
      findings.push({
        ruleCode: 'MISSING_REQUIRED_APPROVAL_FIELDS',
        severity: 'error',
        message: {
          en: 'Approved study missing lot / section header field.',
          fr: 'Étude approuvée sans désignation du lot ou de la section.',
        },
      });
    }

    const hasContract = Boolean(project.contractNumber?.trim() || project.tenderNumber?.trim());
    if (!hasContract) {
      findings.push({
        ruleCode: 'MISSING_REQUIRED_APPROVAL_FIELDS',
        severity: 'error',
        message: {
          en: 'Approved study missing contract or tender reference number.',
          fr: 'Étude approuvée sans numéro de marché ou d’appel d’offres.',
        },
      });
    }

    const hasFinancing = Boolean(project.financingText?.trim() || project.financing?.trim());
    if (!hasFinancing) {
      findings.push({
        ruleCode: 'MISSING_REQUIRED_APPROVAL_FIELDS',
        severity: 'error',
        message: {
          en: 'Approved study missing financing source block.',
          fr: 'Étude approuvée sans mention du financement de l’opération.',
        },
      });
    }

    const hasSignatories =
      (organisation.approvalChain && organisation.approvalChain.length > 0) ||
      (organisation.signatories && organisation.signatories.length > 0);
    if (!hasSignatories) {
      findings.push({
        ruleCode: 'MISSING_REQUIRED_APPROVAL_FIELDS',
        severity: 'error',
        message: {
          en: 'Approved study missing approval chain or signatories in organisation profile.',
          fr: 'Étude approuvée sans chaîne d’approbation ou signataires configurés.',
        },
      });
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  const hasWarnings = findings.some((f) => f.severity === 'warning');

  return {
    valid: !hasErrors,
    hasErrors,
    hasWarnings,
    findings,
  };
}

/**
 * Detects identical copy-pasted rows within a single analysis (e.g. inside rawInput tables or computedResults arrays).
 */
function checkIntraAnalysisDuplicates(a: GeoLabAnalysis, _sampleName: string): ConsistencyFinding[] {
  const findings: ConsistencyFinding[] = [];
  const sources: Array<{ name: string; data: any }> = [
    { name: 'rawInput', data: a.rawInput },
    { name: 'computedResults', data: a.computedResults },
  ];

  for (const src of sources) {
    if (!src.data || typeof src.data !== 'object') continue;

    for (const [key, val] of Object.entries(src.data)) {
      if (!Array.isArray(val) || val.length < 2) continue;

      const seenSignatures = new Map<string, number>();

      for (let idx = 0; idx < val.length; idx++) {
        const item = val[idx];
        if (!item || typeof item !== 'object') continue;

        // Clean row: exclude purely index/identifier fields so copy-paste with auto-incremented index is still caught
        const payload: Record<string, any> = {};
        let hasValues = false;

        for (const [k, v] of Object.entries(item)) {
          if (['id', 'index', 'pointIndex', 'rowNo', 'rowNumber', 'key', '_id'].includes(k)) continue;
          if (v !== '' && v !== null && v !== undefined) {
            hasValues = true;
          }
          payload[k] = v;
        }

        if (!hasValues || Object.keys(payload).length === 0) continue;

        const sig = JSON.stringify(payload);
        if (seenSignatures.has(sig)) {
          const firstIdx = seenSignatures.get(sig)!;
          findings.push({
            ruleCode: 'DUPLICATE_RESULT_ROWS',
            severity: 'error',
            analysisId: a.id,
            sampleId: a.sampleId,
            message: {
              en: `Identical repeated rows detected within analysis ${a.reportNumber || a.id} (${key}, rows ${firstIdx + 1} and ${idx + 1}) - potential copy-paste error.`,
              fr: `Lignes identiques répétées détectées au sein de l'analyse ${a.reportNumber || a.id} (${key}, lignes ${firstIdx + 1} et ${idx + 1}) - risque d'erreur de copier-coller.`,
            },
          });
          break; // Flag once per array
        } else {
          seenSignatures.set(sig, idx);
        }
      }
    }
  }

  return findings;
}
