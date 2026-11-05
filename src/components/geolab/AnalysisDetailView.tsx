import React, { useState, useEffect } from 'react';
import { db, getOrganisationProfile, getSettings } from '../../db';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
} from '../../types/geolab';
import { getTestDefinition } from '../../geolab/tests';
import { generateGeoLabExcelReport } from '../../geolab/engine/excelGenerator';
import { generateGeoLabPdfReport } from '../../geolab/engine/pdfGenerator';
import { generateGeoLabNarrative } from '../../geolab/engine/aiNarrative';
import { GeoLabTestChart } from './GeoLabTestChart';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  Building2,
  Layers,
  Save,
} from 'lucide-react';

interface Props {
  analysisId: string;
  language: 'en' | 'fr';
  onBack: () => void;
}

export const AnalysisDetailView: React.FC<Props> = ({
  analysisId,
  language,
  onBack,
}) => {
  const [analysis, setAnalysis] = useState<GeoLabAnalysis | null>(null);
  const [sample, setSample] = useState<GeoLabSample | null>(null);
  const [project, setProject] = useState<GeoLabProject | null>(null);
  const [client, setClient] = useState<GeoLabClient | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganisationProfile | null>(null);

  const [narrativeText, setNarrativeText] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [aiProviderName, setAiProviderName] = useState<'Claude' | 'Gemini'>('Claude');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadData = async () => {
    const an = await db.analyses.get(analysisId);
    if (!an) return;
    setAnalysis(an);
    setNarrativeText(an.observations || an.aiNarrative || '');

    const smp = await db.samples.get(an.sampleId);
    if (smp) {
      setSample(smp);
      const prj = await db.geolabProjects.get(smp.projectId);
      if (prj) {
        setProject(prj);
        const cl = await db.clients.get(prj.clientId);
        if (cl) setClient(cl);
      }
    }

    const org = await getOrganisationProfile();
    setOrgProfile(org);

    try {
      const appSettings = await getSettings();
      const isEnabled = Boolean(appSettings.enableAi ?? appSettings.enableGemini);
      const isClaude = (appSettings.aiProvider || 'anthropic') === 'anthropic';
      const key = isClaude
        ? (appSettings.anthropicApiKey || appSettings.geminiApiKey || '')
        : (appSettings.geminiApiKey || appSettings.anthropicApiKey || '');
      setIsAiActive(Boolean(isEnabled && key.trim()));
      setAiProviderName(isClaude ? 'Claude' : 'Gemini');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, [analysisId]);

  if (!analysis || !sample || !project || !client || !orgProfile) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        {language === 'fr' ? 'Chargement de l\'analyse...' : 'Loading analysis...'}
      </div>
    );
  }

  const testDef = getTestDefinition(analysis.testType);

  const handleUpdateStatus = async (newStatus: 'draft' | 'checked' | 'approved') => {
    const updated: GeoLabAnalysis = {
      ...analysis,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    if (newStatus === 'checked') {
      updated.checkedBy = {
        name: orgProfile.signatories[1]?.name || 'Responsable Qualité',
        title: orgProfile.signatories[1]?.title || 'QA Lead',
        date: new Date().toISOString().substring(0, 10),
      };
    } else if (newStatus === 'approved') {
      updated.approvedBy = {
        name: orgProfile.signatories[2]?.name || 'Directeur Technique',
        title: orgProfile.signatories[2]?.title || 'Technical Director',
        date: new Date().toISOString().substring(0, 10),
      };
    }
    await db.analyses.put(updated);
    setAnalysis(updated);
  };

  const handleSaveNarrative = async () => {
    const updated: GeoLabAnalysis = {
      ...analysis,
      observations: narrativeText,
      updatedAt: new Date().toISOString(),
    };
    await db.analyses.put(updated);
    setAnalysis(updated);
    alert(language === 'fr' ? 'Interprétation enregistrée avec succès.' : 'Observations saved successfully.');
  };

  const handleGenerateAiNarrative = async () => {
    setIsGeneratingAi(true);
    try {
      const appSettings = await getSettings();
      const isEnabled = Boolean(appSettings.enableAi ?? appSettings.enableGemini);
      const isClaude = (appSettings.aiProvider || 'anthropic') === 'anthropic';
      const apiKey = isEnabled
        ? (isClaude
            ? (appSettings.anthropicApiKey || appSettings.geminiApiKey)
            : (appSettings.geminiApiKey || appSettings.anthropicApiKey))
        : undefined;

      const text = await generateGeoLabNarrative({
        analysis,
        language,
        apiKey,
        provider: isClaude ? 'anthropic' : 'gemini',
        model: isClaude ? appSettings.claudeModel : appSettings.geminiModelFlash,
      });
      setNarrativeText(text);
      if (!apiKey || apiKey.trim() === '') {
        alert(
          language === 'fr'
            ? 'Interprétation déterministe générée (mode local hors-ligne). Pour activer l\'analyse personnalisée par Claude IA, activez l\'IA et saisissez votre clé API dans l\'onglet Paramètres.'
            : 'Deterministic interpretation generated (offline mode). To activate personalized Claude AI reasoning, enable AI and enter your API key in Settings.'
        );
      }
    } catch (err: any) {
      alert(`AI error: ${err.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      const blob = await generateGeoLabExcelReport({
        analysis,
        client,
        project,
        sample,
        orgProfile,
        testDef,
        language,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis.reportNumber}_${analysis.testType}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Excel export error: ${err.message}`);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const blob = await generateGeoLabPdfReport({
        analysis,
        client,
        project,
        sample,
        orgProfile,
        testDef,
        language,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis.reportNumber}_${analysis.testType}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`PDF export error: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{analysis.reportNumber}</h2>
              <span className="text-xs text-slate-400">v{analysis.version}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  analysis.status === 'approved'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                    : analysis.status === 'checked'
                    ? 'bg-blue-950/80 text-blue-400 border border-blue-800'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-800'
                }`}
              >
                {analysis.status === 'approved'
                  ? language === 'fr' ? 'APPROUVÉ / CERTIFIÉ' : 'APPROVED'
                  : analysis.status === 'checked'
                  ? language === 'fr' ? 'VÉRIFIÉ' : 'CHECKED'
                  : language === 'fr' ? 'BROUILLON (DRAFT)' : 'DRAFT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {testDef.name[language]} | {analysis.standard} | Date: {analysis.testedDate}
            </p>
          </div>
        </div>

        {/* Actions & Status Progression */}
        <div className="flex flex-wrap items-center gap-2">
          {analysis.status === 'draft' && (
            <button
              onClick={() => handleUpdateStatus('checked')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
            >
              <Clock className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Marquer Vérifié' : 'Mark Checked'}
            </button>
          )}

          {analysis.status === 'checked' && (
            <button
              onClick={() => handleUpdateStatus('approved')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Approuver & Certifier' : 'Approve & Finalize'}
            </button>
          )}

          <button
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded text-xs font-medium transition shadow"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {isExportingExcel ? '...' : language === 'fr' ? 'Excel (.xlsx)' : 'Excel (.xlsx)'}
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700/80 hover:bg-rose-600 text-white rounded text-xs font-medium transition shadow"
          >
            <FileText className="w-3.5 h-3.5" />
            {isExportingPdf ? '...' : language === 'fr' ? 'PDF (.pdf)' : 'PDF (.pdf)'}
          </button>
        </div>
      </div>

      {/* Project & Sample Context Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <span className="text-slate-400 block mb-0.5">{language === 'fr' ? 'Client' : 'Client'}</span>
          <span className="font-bold text-white flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            {client.companyName}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">{language === 'fr' ? 'Projet' : 'Project'}</span>
          <span className="font-bold text-white">{project.projectName}</span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">{language === 'fr' ? 'Échantillon' : 'Sample'}</span>
          <span className="font-bold text-white flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            {sample.sampleId} {sample.depth ? `(${sample.depth})` : ''}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">{language === 'fr' ? 'Lieu / Localisation' : 'Site'}</span>
          <span className="font-bold text-white">{project.siteLocation}</span>
        </div>
      </div>

      {/* Results KPIs Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {language === 'fr' ? 'Grandeurs & Paramètres Caractéristiques' : 'Characteristic Results'}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {analysis.testType === 'proctor' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Teneur en eau Optimum (w_opm)</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.opmMoisturePercent} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Densité sèche max (ρd_opm)</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.maxDryDensityGcm3} g/cm³</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">95% ρd (Cible de compactage)</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.targetDryDensityGcm3} g/cm³</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">R² Ajustement polynomial</span>
                <span className="text-xl font-bold text-emerald-400">{analysis.computedResults.fittedCoefficients.r2}</span>
              </div>
            </>
          )}

          {analysis.testType === 'grain_size' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Passant à 2 mm</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.passing2mmPercent} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Passant à 0,08 mm (Fines)</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.passing008mmPercent} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Classification LCPC</span>
                <span className="text-sm font-bold text-white truncate block">{analysis.computedResults.lcpcClassification}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Coefficients Cu / Cc</span>
                <span className="text-sm font-bold text-white">
                  {analysis.computedResults.cu ? `Cu=${analysis.computedResults.cu}` : '-'} / {analysis.computedResults.cc ? `Cc=${analysis.computedResults.cc}` : '-'}
                </span>
              </div>
            </>
          )}

          {analysis.testType === 'water_content' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Teneur en eau moyenne (w)</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.meanWaterContentPercent} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Écart entre éprouvettes (Δw)</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.differenceBetweenSpecimensPercent} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">Critère de répétabilité</span>
                <span className={`text-sm font-bold ${analysis.computedResults.repeatabilityAccepted ? 'text-emerald-400' : 'text-red-400'}`}>
                  {analysis.computedResults.repeatabilityAccepted ? 'CONFORME' : 'NON CONFORME'}
                </span>
              </div>
            </>
          )}

          {analysis.testType === 'specific_gravity' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Densité Absolue (Gs)' : 'Specific Gravity (Gs)'}</span>
                <span className="text-xl font-bold text-white">{(analysis.computedResults.meanGs ?? analysis.computedResults.specificGravity)?.toFixed(3)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Masse Volumique (ρs)' : 'Solid Density (ρs)'}</span>
                <span className="text-xl font-bold text-white">{(analysis.computedResults.solidDensityGcm3 ?? analysis.computedResults.densityTm3 ?? analysis.computedResults.meanGs)?.toFixed(3)} t/m³</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Écart d\'essais (ΔGs)' : 'Portion Delta (ΔGs)'}</span>
                <span className="text-xl font-bold text-white">{analysis.computedResults.differenceGs ?? 0}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Répétabilité' : 'Repeatability'}</span>
                <span className={`text-sm font-bold ${analysis.computedResults.repeatabilityAccepted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {analysis.computedResults.repeatabilityAccepted ? (language === 'fr' ? 'CONFORME ≤ 0.03' : 'ACCEPTED ≤ 0.03') : (language === 'fr' ? 'ALERTE > 0.03' : 'DEVIATION > 0.03')}
                </span>
              </div>
            </>
          )}

          {analysis.testType === 'bulk_density' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Masse Volumique Apparente' : 'Mean Bulk Density'}</span>
                <span className="text-xl font-bold text-white">{(analysis.computedResults.meanBulkDensityGcm3 ?? analysis.computedResults.meanBulkDensityTm3)?.toFixed(3)} t/m³</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'État de Compactage' : 'Compaction State'}</span>
                <span className="text-sm font-bold text-emerald-400 uppercase">{analysis.computedResults.compactionState || '-'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Écart Min/Max' : 'Delta Range'}</span>
                <span className="text-xl font-bold text-white">{(analysis.computedResults.rangeTm3 ?? 0)?.toFixed(3)} t/m³</span>
              </div>
            </>
          )}

          {analysis.testType === 'sand_equivalent' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">ES Visuel (ESv)</span>
                <span className="text-xl font-bold text-amber-400">{(analysis.computedResults.meanEsVisual ?? analysis.computedResults.esVisual)?.toFixed(1)} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">ES Piston (ESp)</span>
                <span className="text-xl font-bold text-blue-400">{(analysis.computedResults.meanEsPiston ?? analysis.computedResults.esPiston)?.toFixed(1)} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Qualification' : 'Sand Classification'}</span>
                <span className="text-sm font-bold text-emerald-400">{analysis.computedResults.sandClassification || '-'}</span>
              </div>
            </>
          )}

          {analysis.testType === 'los_angeles' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Coefficient Los Angeles' : 'Los Angeles Coeff.'}</span>
                <span className="text-xl font-bold text-rose-400">{(analysis.computedResults.laCoefficient ?? analysis.computedResults.meanLa)?.toFixed(1)} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Catégorie Normative' : 'EN Category'}</span>
                <span className="text-sm font-bold text-white uppercase">{analysis.computedResults.laCategory || '-'}</span>
              </div>
            </>
          )}

          {analysis.testType === 'micro_deval' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Coefficient Micro-Deval' : 'Micro-Deval Coeff.'}</span>
                <span className="text-xl font-bold text-purple-400">{(analysis.computedResults.mdeCoefficient ?? analysis.computedResults.meanMde)?.toFixed(1)} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Catégorie Normative' : 'EN Category'}</span>
                <span className="text-sm font-bold text-white uppercase">{analysis.computedResults.mdeCategory || '-'}</span>
              </div>
            </>
          )}

          {analysis.testType === 'flakiness' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Indice d\'Aplatissement (FI)' : 'Flakiness Index (FI)'}</span>
                <span className="text-xl font-bold text-teal-400">{(analysis.computedResults.flakinessIndexA ?? analysis.computedResults.globalFlakinessIndex)?.toFixed(1)} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Catégorie Normative' : 'EN Category'}</span>
                <span className="text-sm font-bold text-white uppercase">{analysis.computedResults.flakinessCategory || '-'}</span>
              </div>
            </>
          )}

          {analysis.testType === 'surface_cleanliness' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Propreté Superficielle (P)' : 'Surface Cleanliness (P)'}</span>
                <span className="text-xl font-bold text-amber-400">{(analysis.computedResults.meanCleanlinessPercentageP ?? analysis.computedResults.cleanlinessPercentageP)?.toFixed(2)} %</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Catégorie Normative' : 'EN Category'}</span>
                <span className="text-sm font-bold text-white uppercase">{analysis.computedResults.cleanlinessCategory || '-'}</span>
              </div>
            </>
          )}

          {analysis.testType === 'methylene_blue' && (
            <>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Valeur de Bleu (VBS)' : 'Methylene Blue (VBS)'}</span>
                <span className="text-xl font-bold text-blue-400">{(analysis.computedResults.primaryValue ?? analysis.computedResults.vbsValue ?? analysis.computedResults.mbValue)?.toFixed(2)} g/100g</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block">{language === 'fr' ? 'Sensibilité GTR' : 'Soil Sensitivity'}</span>
                <span className="text-sm font-bold text-white">{analysis.computedResults.soilSensitivityClass || '-'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Visual Graphical Chart for real-life lab representation */}
      <GeoLabTestChart
        testType={analysis.testType}
        input={analysis.rawInput}
        results={analysis.computedResults}
        language={language}
      />

      {/* Engineering Observations & AI Narrative */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              {language === 'fr' ? 'Interprétation & Avis Technique Géotechnique' : 'Observations & Engineering Interpretation'}
            </h3>
            {isAiActive ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-semibold">
                ● {aiProviderName} IA Actif
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-400 border border-slate-700">
                ○ Mode Local Hors-ligne
              </span>
            )}
          </div>

          <button
            onClick={handleGenerateAiNarrative}
            disabled={isGeneratingAi}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded text-xs font-semibold shadow transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isGeneratingAi
              ? language === 'fr' ? 'Rédaction en cours...' : 'Drafting...'
              : language === 'fr' ? `Générer Synthèse IA (${aiProviderName})` : `Draft with ${aiProviderName} AI`}
          </button>
        </div>

        <textarea
          rows={5}
          value={narrativeText}
          onChange={(e) => setNarrativeText(e.target.value)}
          placeholder={language === 'fr' ? 'Saisissez vos observations d\'ingénieur ou générez une synthèse...' : 'Enter your geotechnical remarks...'}
          className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed"
        />

        <div className="flex justify-end">
          <button
            onClick={handleSaveNarrative}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium transition"
          >
            <Save className="w-3.5 h-3.5" />
            {language === 'fr' ? 'Enregistrer l\'Avis' : 'Save Observations'}
          </button>
        </div>
      </div>
    </div>
  );
};

