import React, { useState, useEffect, useRef } from 'react';
import { db, getOrganisationProfile, getSettings } from '../../db';
import type {
  StudyReport,
  StudySection,
  StudyPhoto,
  GeoLabProject,
  GeoLabClient,
  GeoLabAnalysis,
  GeoLabSample,
  OrganisationProfile,
} from '../../types/geolab';
import {
  updateStudyReport,
  createNewStudyRevision,
  changeStudyStatus,
  addStudyPhoto,
  deleteStudyPhoto,
  updateStudyPhotoCaption,
  reorderStudyPhotos,
  buildDocumentModel,
  generateStudyDocxReport,
  exportStudyPackageZip,
  checkStudyConsistency,
  generateStudyAiNarrative,
  type ConsistencyCheckResult,
  type StudyNarrativeDraft,
} from '../../geolab/studies';
import { getTestDefinition } from '../../geolab/tests';
import { generateSoilSummaryExcelReport } from '../../geolab/engine/excelGenerator';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  FileSpreadsheet,
  Download,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  Layers,
  Heading1,
  Heading2,
  Bold,
  Italic,
  List,
  Sparkles,
  RefreshCw,
  Archive,
  Eye,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  studyId: string;
  language: 'en' | 'fr';
  onBack: () => void;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const StudyReportEditorView: React.FC<Props> = ({
  studyId,
  language: appLanguage,
  onBack,
}) => {
  const [study, setStudy] = useState<StudyReport | null>(null);
  const [project, setProject] = useState<GeoLabProject | null>(null);
  const [client, setClient] = useState<GeoLabClient | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganisationProfile | null>(null);
  const [projectAnalyses, setProjectAnalyses] = useState<GeoLabAnalysis[]>([]);
  const [samples, setSamples] = useState<GeoLabSample[]>([]);
  const [photos, setPhotos] = useState<StudyPhoto[]>([]);

  const [activeTab, setActiveTab] = useState<'sections' | 'analyses' | 'photos' | 'preview'>('sections');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  // Revisions Modal
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionNature, setRevisionNature] = useState('');
  const [revisionAuthor, setRevisionAuthor] = useState('');

  // Status & Notification
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<'docx' | 'zip' | null>(null);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Consistency & AI Narrative
  const [consistencyResult, setConsistencyResult] = useState<ConsistencyCheckResult | null>(null);
  const [showConsistencyPanel, setShowConsistencyPanel] = useState(false);
  const [isNarrativeModalOpen, setIsNarrativeModalOpen] = useState(false);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [narrativeDraft, setNarrativeDraft] = useState<StudyNarrativeDraft | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const s = await db.studyReports.get(studyId);
    if (!s) return;
    setStudy(s);

    const proj = await db.geolabProjects.get(s.projectId);
    setProject(proj || null);

    if (proj) {
      const cli = await db.clients.get(proj.clientId);
      setClient(cli || null);

      const samps = await db.samples.where('projectId').equals(proj.id).toArray();
      setSamples(samps);

      const sampIds = new Set(samps.map((sm) => sm.id));
      const allAn = await db.analyses.toArray();
      setProjectAnalyses(allAn.filter((an) => sampIds.has(an.sampleId)));
    }

    const org = await getOrganisationProfile();
    setOrgProfile(org);

    const pts = await db.studyPhotos.where('studyId').equals(s.id).sortBy('order');
    setPhotos(pts);
  };

  useEffect(() => {
    loadData();
  }, [studyId]);

  if (!study) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
        <p>{appLanguage === 'fr' ? 'Chargement de l’étude...' : 'Loading study report...'}</p>
      </div>
    );
  }

  const isLocked = study.status === 'approved';
  const lang = study.language || appLanguage;

  const currentRevision =
    study.revisions && study.revisions.length > 0
      ? study.revisions[study.revisions.length - 1]
      : { index: 0, nature: 'Original', date: study.createdAt.split('T')[0] };

  // Update Title or Report Number
  const handleMetaChange = async (field: 'title' | 'reportNumber' | 'language', value: string) => {
    if (isLocked) return;
    try {
      const updated = await updateStudyReport(study.id, { [field]: value }, lang);
      setStudy(updated);
    } catch (err: any) {
      setStatusError(err?.message || 'Update failed');
    }
  };

  // Status Change
  const handleStatusChange = async (newStatus: 'draft' | 'checked' | 'approved') => {
    setStatusError(null);
    try {
      const updated = await changeStudyStatus(study.id, newStatus, lang);
      setStudy(updated);
    } catch (err: any) {
      setStatusError(err?.message || 'Status change failed');
    }
  };

  // Create Revision
  const handleCreateRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionNature.trim()) return;

    try {
      const updated = await createNewStudyRevision(
        study.id,
        revisionNature.trim(),
        revisionAuthor.trim() || undefined,
        lang
      );
      setStudy(updated);
      setIsRevisionModalOpen(false);
      setRevisionNature('');
      setRevisionAuthor('');
      setStatusError(null);
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to create revision');
    }
  };

  // Section Management
  const handleSectionToggle = async (sectionId: string) => {
    if (isLocked) return;
    const newSections = study.sections.map((sec) =>
      sec.id === sectionId ? { ...sec, enabled: !sec.enabled } : sec
    );
    const updated = await updateStudyReport(study.id, { sections: newSections }, lang);
    setStudy(updated);
  };

  const handleSectionTitleChange = async (sectionId: string, newTitle: string) => {
    if (isLocked) return;
    const newSections = study.sections.map((sec) =>
      sec.id === sectionId
        ? {
            ...sec,
            title: {
              ...sec.title,
              [lang]: newTitle,
            },
          }
        : sec
    );
    const updated = await updateStudyReport(study.id, { sections: newSections }, lang);
    setStudy(updated);
  };

  const handleNarrativeChange = async (sectionId: string, content: string) => {
    if (isLocked) return;
    const newSections = study.sections.map((sec) =>
      sec.id === sectionId ? { ...sec, content } : sec
    );
    const updated = await updateStudyReport(study.id, { sections: newSections }, lang);
    setStudy(updated);
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= study.sections.length) return;

    const newSections = [...study.sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;

    const updated = await updateStudyReport(study.id, { sections: newSections }, lang);
    setStudy(updated);
  };

  // Formatting helper for narrative textarea
  const insertFormatting = (sectionId: string, prefix: string, suffix = '') => {
    if (isLocked) return;
    const textarea = document.getElementById(`narrative-${sectionId}`) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selectedText = currentVal.substring(start, end) || (lang === 'fr' ? 'texte' : 'text');
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);
    handleNarrativeChange(sectionId, newVal);
  };

  // Toggle Included Analysis
  const handleToggleAnalysis = async (anId: string) => {
    if (isLocked) return;
    const currentList = study.includedAnalysisIds || [];
    const newList = currentList.includes(anId)
      ? currentList.filter((x) => x !== anId)
      : [...currentList, anId];

    const updated = await updateStudyReport(study.id, { includedAnalysisIds: newList }, lang);
    setStudy(updated);
  };

  // Photo Management
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || !e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingPhoto(true);
    try {
      for (const file of files) {
        await addStudyPhoto(study.id, file, file.name.replace(/\.[^/.]+$/, ''));
      }
      const updatedPhotos = await db.studyPhotos.where('studyId').equals(study.id).sortBy('order');
      setPhotos(updatedPhotos);
    } catch (err) {
      console.error('Photo upload error:', err);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (isLocked) return;
    await deleteStudyPhoto(photoId);
    const updatedPhotos = await db.studyPhotos.where('studyId').equals(study.id).sortBy('order');
    setPhotos(updatedPhotos);
  };

  const handleUpdateCaption = async (photoId: string, caption: string) => {
    if (isLocked) return;
    await updateStudyPhotoCaption(photoId, caption);
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)));
  };

  const handleMovePhoto = async (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const newPhotos = [...photos];
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[targetIndex];
    newPhotos[targetIndex] = temp;

    const ids = newPhotos.map((p) => p.id);
    await reorderStudyPhotos(study.id, ids);
    const updated = await db.studyPhotos.where('studyId').equals(study.id).sortBy('order');
    setPhotos(updated);
  };

  // Consistency & AI Narrative Handlers
  const handleRunConsistencyCheck = () => {
    if (!project || !orgProfile) return;
    const includedSet = new Set(study.includedAnalysisIds || []);
    const includedAnalyses = projectAnalyses.filter((a) => includedSet.has(a.id));

    const result = checkStudyConsistency({
      study,
      project,
      client: client || undefined,
      organisation: orgProfile,
      analyses: includedAnalyses,
      samples,
    });

    setConsistencyResult(result);
    setShowConsistencyPanel(true);
  };

  const handleOpenAiNarrativeModal = async () => {
    if (!project || !client) return;
    setIsNarrativeModalOpen(true);
    setIsGeneratingNarrative(true);

    const includedSet = new Set(study.includedAnalysisIds || []);
    const includedAnalyses = projectAnalyses.filter((a) => includedSet.has(a.id));

    const appSettings = await getSettings();
    const isEnabled = Boolean(appSettings.enableAi ?? appSettings.enableGemini);
    const isClaude = (appSettings.aiProvider || 'anthropic') === 'anthropic';
    const apiKey = isEnabled
      ? (isClaude
          ? (appSettings.anthropicApiKey || appSettings.geminiApiKey)
          : (appSettings.geminiApiKey || appSettings.anthropicApiKey))
      : undefined;

    try {
      const draft = await generateStudyAiNarrative({
        study,
        project,
        client,
        analyses: includedAnalyses,
        samples,
        apiKey,
        provider: isClaude ? 'anthropic' : 'gemini',
        model: isClaude ? appSettings.claudeModel : appSettings.geminiModelFlash,
        language: lang,
      });
      setNarrativeDraft(draft);
    } catch (err) {
      console.error('Narrative generation error:', err);
    } finally {
      setIsGeneratingNarrative(false);
    }
  };

  const handleApplyNarrativeToStudy = async () => {
    if (!narrativeDraft || isLocked) return;

    const newSections = study.sections.map((sec) => {
      const titleLower = (sec.title[lang] || sec.title.fr || sec.title.en || '').toLowerCase();
      if (titleLower.includes('introduction') || titleLower.includes('objet')) {
        return { ...sec, content: narrativeDraft.introduction };
      }
      if (
        titleLower.includes('matériau') ||
        titleLower.includes('material') ||
        titleLower.includes('sol') ||
        titleLower.includes('échantillonnage') ||
        titleLower.includes('sampling')
      ) {
        return { ...sec, content: narrativeDraft.materials };
      }
      if (titleLower.includes('discussion') || titleLower.includes('interprétation')) {
        return { ...sec, content: narrativeDraft.discussion };
      }
      if (titleLower.includes('recommandation')) {
        const hasDiscussionSection = study.sections.some((s) => {
          const t = (s.title[lang] || s.title.fr || s.title.en || '').toLowerCase();
          return t.includes('discussion') || t.includes('interprétation');
        });
        const recContent =
          !hasDiscussionSection && narrativeDraft.discussion
            ? `${narrativeDraft.discussion}\n\n${narrativeDraft.recommendations}`
            : narrativeDraft.recommendations;
        return { ...sec, content: recContent };
      }
      if (titleLower.includes('conclusion')) {
        return { ...sec, content: narrativeDraft.conclusion || narrativeDraft.recommendations };
      }
      return sec;
    });

    const updated = await updateStudyReport(study.id, { sections: newSections }, lang);
    setStudy(updated);
    setIsNarrativeModalOpen(false);
  };

  // Document Model Helper
  const getDocModel = () => {
    if (!project || !client || !orgProfile) return null;
    const includedSet = new Set(study.includedAnalysisIds || []);
    const includedAnalyses = projectAnalyses.filter((a) => includedSet.has(a.id));
    return buildDocumentModel({
      study,
      project,
      client,
      organisation: orgProfile,
      analyses: includedAnalyses,
      samples,
      photos,
      validateConsistency: true,
    });
  };

  // Export handlers
  const handleExportDocx = async () => {
    const model = getDocModel();
    if (!model) return;
    try {
      setIsExporting('docx');
      setExportProgress(lang === 'fr' ? 'Compilation Word (.docx)...' : 'Compiling Word (.docx)...');
      const blob = await generateStudyDocxReport(model, {
        onProgress: (p) => setExportProgress(`${p.message} (${Math.round((p.current / p.total) * 100)}%)`),
      });
      const filename = `${study.reportNumber || 'Study'}.docx`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(`Word export failed: ${err?.message}`);
    } finally {
      setIsExporting(null);
      setExportProgress('');
    }
  };

  const handleExportZip = async () => {
    try {
      setIsExporting('zip');
      setExportProgress(lang === 'fr' ? 'Préparation de l’archive...' : 'Preparing archive...');
      const { blob, filename } = await exportStudyPackageZip({
        studyId: study.id,
        onProgress: (p) => setExportProgress(`${p.message} (${p.percent}%)`),
      });
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(`Package export failed: ${err?.message}`);
    } finally {
      setIsExporting(null);
      setExportProgress('');
    }
  };

  const handleExportSoilSummary = async () => {
    if (!project || !client || !orgProfile) return;
    try {
      setIsExporting('docx');
      setExportProgress(lang === 'fr' ? 'Génération de la Fiche Récapitulative...' : 'Generating Soil Summary Sheet...');
      const targetSample = samples[0] || {
        id: 'sample-default',
        projectId: project.id,
        sampleId: 'ECH-01',
        samplingDate: new Date().toISOString().split('T')[0],
        materialType: 'Sol',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const includedSet = new Set(study.includedAnalysisIds || []);
      const includedAnalyses = projectAnalyses.filter((a) => includedSet.has(a.id));
      const sampleAnalyses = includedAnalyses.filter((a) => a.sampleId === targetSample.id);
      const blob = await generateSoilSummaryExcelReport({
        sample: targetSample,
        project,
        client,
        orgProfile,
        analyses: sampleAnalyses.length > 0 ? sampleAnalyses : includedAnalyses,
        language: lang,
      });
      const filename = `Rapport_Analyses_${(targetSample.sampleId || 'Echantillon').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(`Analyses Report export failed: ${err?.message}`);
    } finally {
      setIsExporting(null);
      setExportProgress('');
    }
  };

  const handleDeleteStudy = async () => {
    const confirmed = window.confirm(
      lang === 'fr'
        ? `Êtes-vous sûr de vouloir supprimer définitivement le rapport d’étude "${study.reportNumber || study.title}" ? Cette action est irréversible.`
        : `Are you sure you want to permanently delete study report "${study.reportNumber || study.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await db.studyReports.delete(study.id);
      await db.studyPhotos.where('studyId').equals(study.id).delete();
      onBack();
    } catch (err: any) {
      alert(`Error deleting study report: ${err?.message}`);
    }
  };

  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title={lang === 'fr' ? 'Retour aux études' : 'Back to studies'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled={isLocked}
                value={study.title}
                onChange={(e) => handleMetaChange('title', e.target.value)}
                className="text-base md:text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none transition px-1"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="font-mono text-blue-400">{study.reportNumber}</span>
              <span>•</span>
              <span>{project?.projectName}</span>
              <span>•</span>
              <span className="text-slate-300">{client?.companyName}</span>
            </div>
          </div>
        </div>

        {/* Status, Language & Exports */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Language Toggle */}
          <div className="flex rounded-lg border border-slate-700 overflow-hidden bg-slate-950 p-0.5">
            <button
              onClick={() => handleMetaChange('language', 'fr')}
              disabled={isLocked}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                lang === 'fr' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              FR
            </button>
            <button
              onClick={() => handleMetaChange('language', 'en')}
              disabled={isLocked}
              className={`px-2.5 py-1 text-xs font-semibold rounded ${
                lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Status selector */}
          <select
            value={study.status}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border focus:outline-none cursor-pointer ${
              study.status === 'approved'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                : study.status === 'checked'
                ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                : 'bg-amber-950/80 text-amber-300 border-amber-700'
            }`}
          >
            <option value="draft">{lang === 'fr' ? 'Brouillon' : 'Draft'}</option>
            <option value="checked">{lang === 'fr' ? 'Vérifié' : 'Checked'}</option>
            <option value="approved">{lang === 'fr' ? 'Approuvé' : 'Approved'}</option>
          </select>

          {/* Export Action Buttons */}
          <button
            onClick={handleExportDocx}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Word (.docx)</span>
          </button>

          <button
            onClick={handleExportSoilSummary}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
            title={lang === 'fr' ? "Télécharger le rapport d'analyses complet de l'échantillon (.xlsx) avec détails et graphiques" : 'Download complete sample analyses report (.xlsx) with details and charts'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200" />
            <span>{lang === 'fr' ? 'Rapport Analyses (.xlsx)' : 'Analyses Report (.xlsx)'}</span>
          </button>

          <button
            onClick={handleExportZip}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-50"
            title={lang === 'fr' ? 'Télécharger l’archive complète (DOCX + Feuilles Excel + Photos)' : 'Download package ZIP (DOCX + Excel + Photos)'}
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>Package ZIP</span>
          </button>

          <button
            onClick={handleDeleteStudy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-xs font-bold transition shadow-sm"
            title={lang === 'fr' ? 'Supprimer définitivement ce rapport d’étude' : 'Delete this study report'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{lang === 'fr' ? 'Supprimer' : 'Delete'}</span>
          </button>
        </div>
      </div>

      {/* Progress banner if exporting */}
      {isExporting && (
        <div className="p-3 bg-blue-950/70 border border-blue-800 rounded-xl text-blue-200 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>{exportProgress}</span>
          </div>
        </div>
      )}

      {/* Status / Lock Alert */}
      {statusError && (
        <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {/* Revisions Banner */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
          isLocked
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {isLocked ? (
            <div className="p-1.5 rounded-lg bg-emerald-900/50 text-emerald-400 border border-emerald-700/50">
              <Lock className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
              <Unlock className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wide">
                {lang === 'fr' ? 'Indice de Révision' : 'Revision Index'}:{' '}
                <span className="font-mono text-white">
                  {String.fromCharCode(65 + (currentRevision.index || 0))} ({currentRevision.index})
                </span>
              </span>
              <span className="text-[11px] text-slate-400">({currentRevision.nature})</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isLocked
                ? lang === 'fr'
                  ? 'Étude approuvée et verrouillée. Créez une nouvelle révision pour effectuer des modifications.'
                  : 'Study approved and locked. Create a new revision to make changes.'
                : lang === 'fr'
                ? `En cours de rédaction (Date: ${currentRevision.date})`
                : `Drafting in progress (Date: ${currentRevision.date})`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsRevisionModalOpen(true)}
          className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition shadow-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <span>{lang === 'fr' ? 'Créer une nouvelle révision' : 'Create new revision'}</span>
        </button>
      </div>

      {/* Editor Sub-Navigation Tabs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('sections')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition flex-shrink-0 ${
              activeTab === 'sections'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Sections & Contenu' : 'Sections & Narrative'}</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {study.sections.filter((s) => s.enabled).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analyses')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition flex-shrink-0 ${
              activeTab === 'analyses'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Analyses Incluses' : 'Included Analyses'}</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {study.includedAnalysisIds?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition flex-shrink-0 ${
              activeTab === 'photos'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Planches Photos' : 'Photo Plates'}</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {photos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition flex-shrink-0 ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Aperçu Synthétique' : 'Document Overview'}</span>
          </button>
        </div>

        {/* Stage 3 Tools */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRunConsistencyCheck}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition shadow-sm"
            title={lang === 'fr' ? 'Lancer le vérificateur de cohérence et de plausibilité' : 'Run consistency & plausibility check'}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'fr' ? 'Vérifier la cohérence' : 'Check Consistency'}</span>
          </button>

          {!isLocked && (
            <button
              onClick={handleOpenAiNarrativeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 rounded-lg text-xs font-bold transition shadow-sm"
              title={lang === 'fr' ? 'Rédiger les textes narratifs avec l’IA' : 'Draft narrative with AI'}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{lang === 'fr' ? 'Rédiger avec l’IA' : 'AI Narrative'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Consistency Findings Panel */}
      {showConsistencyPanel && consistencyResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">
                {lang === 'fr' ? 'Rapport de Cohérence & Plausibilité' : 'Consistency & Plausibility Report'}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {consistencyResult.findings.length === 0 ? (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                  {lang === 'fr' ? '100% Cohérent (0 anomalie)' : '100% Consistent (0 anomalies)'}
                </span>
              ) : (
                <>
                  {consistencyResult.hasErrors && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 font-semibold">
                      {consistencyResult.findings.filter((f) => f.severity === 'error').length}{' '}
                      {lang === 'fr' ? 'erreur(s) bloquante(s)' : 'blocking error(s)'}
                    </span>
                  )}
                  {consistencyResult.hasWarnings && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                      {consistencyResult.findings.filter((f) => f.severity === 'warning').length}{' '}
                      {lang === 'fr' ? 'avertissement(s)' : 'warning(s)'}
                    </span>
                  )}
                </>
              )}

              <button
                onClick={() => setShowConsistencyPanel(false)}
                className="text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            </div>
          </div>

          {consistencyResult.findings.length === 0 ? (
            <p className="text-xs text-slate-400">
              {lang === 'fr'
                ? 'Toutes les règles de plausibilité physique, limites de répétabilité et concordances d’essais sont respectées.'
                : 'All physical plausibility, repeatability limits, and multi-test concordance checks passed.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {consistencyResult.findings.map((f, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                    f.severity === 'error'
                      ? 'bg-red-950/40 border-red-800/60 text-red-200'
                      : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      f.severity === 'error' ? 'text-red-400' : 'text-amber-400'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/40">
                        {f.ruleCode}
                      </span>
                      <span className="font-semibold text-[11px] uppercase tracking-wider">
                        {f.severity}
                      </span>
                    </div>
                    <p className="mt-1">{f.message[lang] || f.message.fr || f.message.en}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Sections & Content */}
      {activeTab === 'sections' && (
        <div className="space-y-3">
          {study.sections.map((section, idx) => {
            const isExpanded = expandedSectionId === section.id || (expandedSectionId === null && idx === 0);

            return (
              <div
                key={section.id}
                className={`border rounded-xl transition overflow-hidden ${
                  section.enabled
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                {/* Section Header */}
                <div className="p-3.5 flex items-center justify-between gap-3 bg-slate-900/60">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={section.enabled}
                      onChange={() => handleSectionToggle(section.id)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                    />

                    <span className="font-mono text-xs text-blue-400 font-bold">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>

                    <input
                      type="text"
                      disabled={isLocked}
                      value={section.title[lang] || section.title.fr || section.title.en || ''}
                      onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                      className="text-xs md:text-sm font-semibold text-slate-100 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 focus:outline-none flex-1 truncate transition"
                    />

                    <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700 flex-shrink-0">
                      {section.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      disabled={isLocked || idx === 0}
                      onClick={() => handleMoveSection(idx, 'up')}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 disabled:opacity-30"
                      title={lang === 'fr' ? 'Monter' : 'Move up'}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={isLocked || idx === study.sections.length - 1}
                      onClick={() => handleMoveSection(idx, 'down')}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 disabled:opacity-30"
                      title={lang === 'fr' ? 'Descendre' : 'Move down'}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedSectionId(isExpanded ? '__none__' : section.id)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Section Body */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
                    {section.type === 'narrative' ? (
                      <div className="space-y-2">
                        {/* Markdown Formatting Toolbar */}
                        {!isLocked && (
                          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                            <button
                              type="button"
                              onClick={() => insertFormatting(section.id, '# ')}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                              title="Titre 1 / Heading 1"
                            >
                              <Heading1 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormatting(section.id, '## ')}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                              title="Titre 2 / Heading 2"
                            >
                              <Heading2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormatting(section.id, '**', '**')}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                              title="Gras / Bold"
                            >
                              <Bold className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormatting(section.id, '*', '*')}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                              title="Italique / Italic"
                            >
                              <Italic className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertFormatting(section.id, '- ')}
                              className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded font-bold"
                              title="Liste à puces / Bullet list"
                            >
                              <List className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <textarea
                          id={`narrative-${section.id}`}
                          disabled={isLocked}
                          rows={6}
                          value={
                            typeof section.content === 'object' && section.content !== null
                              ? (section.content as any)[lang] || (section.content as any).fr || (section.content as any).en || ''
                              : section.content || ''
                          }
                          onChange={(e) => handleNarrativeChange(section.id, e.target.value)}
                          placeholder={
                            lang === 'fr'
                              ? 'Rédigez le texte de cette section (supporte les titres #, listes -, et le gras **)...'
                              : 'Write narrative text for this section (supports # headings, - lists, **bold**)...'
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs md:text-sm text-slate-200 focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
                        />
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span>
                          {lang === 'fr'
                            ? `Cette section est générée automatiquement à partir des données de l’étude (${section.type}).`
                            : `This section is automatically rendered from study data (${section.type}).`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Included Analyses */}
      {activeTab === 'analyses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'fr' ? 'Essais du Projet' : 'Project Analyses'} (
                {study.includedAnalysisIds?.length || 0} / {projectAnalyses.length}{' '}
                {lang === 'fr' ? 'inclus' : 'included'})
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'fr'
                  ? 'Cochez les essais à intégrer dans les tableaux de résultats et les annexes PV'
                  : 'Check the analyses to include in summary tables and annex test sheets'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projectAnalyses.map((an) => {
              const isChecked = (study.includedAnalysisIds || []).includes(an.id);
              const sample = sampleMap.get(an.sampleId);
              const testDef = getTestDefinition(an.testType);

              return (
                <div
                  key={an.id}
                  onClick={() => handleToggleAnalysis(an.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isChecked
                      ? 'bg-blue-950/40 border-blue-600/70 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={isChecked}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          {an.reportNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-medium">
                          {testDef ? testDef.name[lang] : an.testType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {sample ? `${sample.sampleId} (${sample.materialType})` : an.sampleId}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      an.status === 'approved'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : an.status === 'checked'
                        ? 'bg-blue-950 text-blue-400 border border-blue-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {an.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Photos */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'fr' ? 'Photothèque de l’étude' : 'Study Photos'} ({photos.length})
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'fr'
                  ? 'Photos du site, des prélèvements et des éprouvettes (compressées automatiquement ≤ 1600px)'
                  : 'Site, sampling, and specimen photos (auto-compressed ≤ 1600px)'}
              </p>
            </div>

            {!isLocked && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  multiple
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isUploadingPhoto
                      ? lang === 'fr'
                        ? 'Compression...'
                        : 'Compressing...'
                      : lang === 'fr'
                      ? 'Ajouter des photos'
                      : 'Add photos'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {photos.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/40">
              <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                {lang === 'fr'
                  ? 'Aucune photo importée pour cette étude.'
                  : 'No photos uploaded for this study.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm"
                >
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={typeof photo.blob === 'string' ? photo.blob : ''}
                      alt={photo.caption || 'Study photo'}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-white">
                      #{idx + 1}
                    </div>
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <input
                      type="text"
                      disabled={isLocked}
                      value={photo.caption || ''}
                      onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                      placeholder={lang === 'fr' ? 'Légende de la photo...' : 'Photo caption...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <div className="flex items-center gap-1">
                        <button
                          disabled={isLocked || idx === 0}
                          onClick={() => handleMovePhoto(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 disabled:opacity-30"
                          title={lang === 'fr' ? 'Précédent' : 'Previous'}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isLocked || idx === photos.length - 1}
                          onClick={() => handleMovePhoto(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 disabled:opacity-30"
                          title={lang === 'fr' ? 'Suivant' : 'Next'}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {!isLocked && (
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-slate-800"
                          title={lang === 'fr' ? 'Supprimer' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Live Document Overview */}
      {activeTab === 'preview' && (
        <div className="space-y-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white mb-1">
              {lang === 'fr' ? 'Structure Générale du Rapport' : 'General Report Structure'}
            </h3>
            <p className="text-xs text-slate-400">
              {lang === 'fr'
                ? 'Aperçu synthétique des éléments compilés dans le document final'
                : 'Synthetic overview of elements compiled in final document'}
            </p>
          </div>

          {/* Cover Metadata Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              {lang === 'fr' ? 'Page de Garde & Métadonnées' : 'Cover Page & Metadata'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">{lang === 'fr' ? 'Projet' : 'Project'}: </span>
                <span className="text-white font-medium">{project?.projectName}</span>
              </div>
              <div>
                <span className="text-slate-400">{lang === 'fr' ? 'Client' : 'Client'}: </span>
                <span className="text-white font-medium">{client?.companyName}</span>
              </div>
              <div>
                <span className="text-slate-400">{lang === 'fr' ? 'Titre de l’étude' : 'Title'}: </span>
                <span className="text-white font-medium">{study.title}</span>
              </div>
              <div>
                <span className="text-slate-400">{lang === 'fr' ? 'N° de Rapport' : 'Report #'}: </span>
                <span className="font-mono text-white font-medium">{study.reportNumber}</span>
              </div>
            </div>
          </div>

          {/* Revision History Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              {lang === 'fr' ? 'Tableau des Révisions' : 'Revision History Table'}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Indice</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Nature des Modifications</th>
                    <th className="py-2 px-3">Rédigé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {study.revisions?.map((rev, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-mono font-bold text-blue-300">
                        {String.fromCharCode(65 + (rev.index || idx))}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{rev.date}</td>
                      <td className="py-2 px-3 text-slate-200">{rev.nature}</td>
                      <td className="py-2 px-3 text-slate-400">{rev.preparedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table of contents structure */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              {lang === 'fr' ? 'Sections Actives (Table des Matières)' : 'Active Sections (Table of Contents)'}
            </h4>
            <div className="space-y-1.5">
              {study.sections
                .filter((s) => s.enabled)
                .map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-900 rounded border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400 font-bold">{idx + 1}.</span>
                      <span className="text-slate-200">{s.title[lang] || s.title.fr || s.title.en}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{s.type}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* New Revision Modal */}
      {isRevisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {lang === 'fr' ? 'Créer une Nouvelle Révision' : 'Create New Revision'}
              </h3>
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRevisionSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-400">
                {lang === 'fr'
                  ? 'La création d’une révision fige un instantané de l’état actuel, incrémente l’indice alphabétique (ex: A → B) et repasse l’étude en état Brouillon pour modifications.'
                  : 'Creating a revision snapshots current state, increments the index (e.g. A → B), and resets status to Draft for editing.'}
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'fr' ? 'Nature de la modification' : 'Nature of change'} *
                </label>
                <input
                  type="text"
                  required
                  value={revisionNature}
                  onChange={(e) => setRevisionNature(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Ex: Intégration des résultats d’essais complémentaires...'
                      : 'Ex: Integration of complementary test results...'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'fr' ? 'Auteur de la révision' : 'Revision Author'}
                </label>
                <input
                  type="text"
                  value={revisionAuthor}
                  onChange={(e) => setRevisionAuthor(e.target.value)}
                  placeholder={lang === 'fr' ? 'Ingénieur Géotechnicien...' : 'Geotechnical Engineer...'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRevisionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  {lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                >
                  {lang === 'fr' ? 'Confirmer la Révision' : 'Confirm Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Narrative Drafting Modal */}
      {isNarrativeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {lang === 'fr' ? 'Rédaction Assistée par IA' : 'AI Narrative Drafting'}
                </h3>
              </div>
              <button
                onClick={() => setIsNarrativeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {isGeneratingNarrative ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400" />
                  <p className="text-sm font-medium">
                    {lang === 'fr'
                      ? 'Génération des sections narratives à partir des données structurées...'
                      : 'Drafting narrative sections from structured geotechnical data...'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lang === 'fr'
                      ? 'Synthèse de l’introduction, description des matériaux, discussion et recommandations.'
                      : 'Synthesizing introduction, materials, discussion, and recommendations.'}
                  </p>
                </div>
              ) : narrativeDraft ? (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-lg text-xs text-purple-200">
                    <p className="font-semibold">
                      {narrativeDraft.isAiGenerated
                        ? lang === 'fr'
                          ? 'Texte rédigé par l\'IA Cloud (Claude / Gemini) à partir des données structurées de l’étude.'
                          : 'Drafted by Cloud AI (Claude / Gemini) using structured study metrics.'
                        : lang === 'fr'
                          ? 'Texte généré via le moteur déterministe hors-ligne (valeurs exactes de laboratoire).'
                          : 'Drafted via offline deterministic template engine citing exact lab values.'}
                    </p>
                    <p className="text-[11px] text-purple-300/80 mt-1">
                      {lang === 'fr'
                        ? 'Vous pouvez modifier les textes ci-dessous avant de les insérer dans votre étude.'
                        : 'You can review and edit each section before applying them to your study report.'}
                    </p>
                  </div>

                  {/* Section 1: Introduction */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      {lang === 'fr' ? '1. Contexte & Introduction' : '1. Context & Introduction'}
                    </label>
                    <textarea
                      rows={4}
                      value={narrativeDraft.introduction}
                      onChange={(e) =>
                        setNarrativeDraft({ ...narrativeDraft, introduction: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Section 2: Materials */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      {lang === 'fr' ? '2. Description des Matériaux' : '2. Description of Materials'}
                    </label>
                    <textarea
                      rows={4}
                      value={narrativeDraft.materials}
                      onChange={(e) =>
                        setNarrativeDraft({ ...narrativeDraft, materials: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Section 3: Discussion */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      {lang === 'fr' ? '3. Discussion des Résultats' : '3. Discussion of Results'}
                    </label>
                    <textarea
                      rows={5}
                      value={narrativeDraft.discussion}
                      onChange={(e) =>
                        setNarrativeDraft({ ...narrativeDraft, discussion: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Section 4: Recommendations */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      {lang === 'fr' ? '4. Recommandations Géotechniques' : '4. Engineering Recommendations'}
                    </label>
                    <textarea
                      rows={5}
                      value={narrativeDraft.recommendations}
                      onChange={(e) =>
                        setNarrativeDraft({ ...narrativeDraft, recommendations: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Section 5: Conclusion */}
                  {narrativeDraft.conclusion && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                        {lang === 'fr' ? '5. Conclusion Générale' : '5. General Conclusion'}
                      </label>
                      <textarea
                        rows={4}
                        value={narrativeDraft.conclusion}
                        onChange={(e) =>
                          setNarrativeDraft({ ...narrativeDraft, conclusion: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed font-mono"
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsNarrativeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                {lang === 'fr' ? 'Fermer' : 'Close'}
              </button>
              {narrativeDraft && !isLocked && (
                <button
                  type="button"
                  onClick={handleApplyNarrativeToStudy}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition shadow flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{lang === 'fr' ? 'Appliquer à l’Étude' : 'Apply to Study'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
