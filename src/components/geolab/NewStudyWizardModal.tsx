import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import type {
  GeoLabProject,
  GeoLabClient,
  GeoLabAnalysis,
  GeoLabSample,
} from '../../types/geolab';
import { STUDY_TEMPLATES } from '../../geolab/studies';
import { createStudyReport } from '../../geolab/studies/engine/studyService';
import { getTestDefinition } from '../../geolab/tests';
import {
  X,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  FileSpreadsheet,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  onClose: () => void;
  onCreated: (studyId: string) => void;
}

export const NewStudyWizardModal: React.FC<Props> = ({
  language,
  onClose,
  onCreated,
}) => {
  const [projects, setProjects] = useState<GeoLabProject[]>([]);
  const [clients, setClients] = useState<GeoLabClient[]>([]);
  const [samples, setSamples] = useState<GeoLabSample[]>([]);
  const [analyses, setAnalyses] = useState<GeoLabAnalysis[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('characterisation_soils');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>(language);
  const [title, setTitle] = useState('');
  const [reportNumber, setReportNumber] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<string[]>([]);

  const [filterTestType, setFilterTestType] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const p = await db.geolabProjects.where('isArchived').equals(0).toArray();
      const c = await db.clients.where('isArchived').equals(0).toArray();
      const s = await db.samples.toArray();
      const a = await db.analyses.toArray();

      setProjects(p);
      setClients(c);
      setSamples(s);
      setAnalyses(a);

      if (p.length > 0) {
        setSelectedProjectId(p[0].id);
      }

      const existingStudiesCount = await db.studyReports.count();
      const year = new Date().getFullYear();
      setReportNumber(`ETD-${year}-${String(existingStudiesCount + 1).padStart(3, '0')}`);
    };
    load();
  }, []);

  const clientMap = new Map<string, GeoLabClient>();
  clients.forEach((c) => clientMap.set(c.id, c));

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentClient = currentProject ? clientMap.get(currentProject.clientId) : undefined;

  // Auto-generate a default title when project or template changes
  useEffect(() => {
    if (currentProject) {
      if (selectedLanguage === 'fr') {
        setTitle(
          selectedTemplateId === 'characterisation_soils'
            ? `Rapport d'Étude Géotechnique - Caractérisation des Sols - ${currentProject.projectName}`
            : `Rapport d'Étude Géotechnique - ${currentProject.projectName}`
        );
      } else {
        setTitle(
          selectedTemplateId === 'characterisation_soils'
            ? `Geotechnical Study Report - Soil Characterisation - ${currentProject.projectName}`
            : `Geotechnical Study Report - ${currentProject.projectName}`
        );
      }
    }
  }, [selectedProjectId, selectedTemplateId, selectedLanguage]);

  // Project samples & analyses
  const projectSamples = samples.filter((s) => s.projectId === selectedProjectId);
  const projectSampleIds = new Set(projectSamples.map((s) => s.id));
  const projectAnalyses = analyses.filter((a) => projectSampleIds.has(a.sampleId));

  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  // Auto-select all project analyses initially when project changes
  useEffect(() => {
    if (projectAnalyses.length > 0) {
      setSelectedAnalysisIds(projectAnalyses.map((a) => a.id));
    } else {
      setSelectedAnalysisIds([]);
    }
  }, [selectedProjectId]);

  const filteredAnalyses = projectAnalyses.filter((a) => {
    if (filterTestType === 'ALL') return true;
    return a.testType === filterTestType;
  });

  const toggleAnalysis = (id: string) => {
    setSelectedAnalysisIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedAnalysisIds(filteredAnalyses.map((a) => a.id));
  };

  const deselectAll = () => {
    setSelectedAnalysisIds([]);
  };

  const hasDraftAnalysesSelected = selectedAnalysisIds.some((id) => {
    const a = analyses.find((x) => x.id === id);
    return a && a.status === 'draft';
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError(selectedLanguage === 'fr' ? 'Veuillez sélectionner un projet.' : 'Please select a project.');
      return;
    }
    if (!title.trim()) {
      setError(selectedLanguage === 'fr' ? 'Le titre est obligatoire.' : 'Title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const study = await createStudyReport({
        projectId: selectedProjectId,
        templateId: selectedTemplateId,
        title: title.trim(),
        language: selectedLanguage,
        includedAnalysisIds: selectedAnalysisIds,
        reportNumber: reportNumber.trim() || undefined,
        authorName: authorName.trim() || undefined,
      });

      onCreated(study.id);
    } catch (err: any) {
      setError(err?.message || 'Failed to create study report');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {selectedLanguage === 'fr' ? 'Nouvelle Étude Géotechnique' : 'New Geotechnical Study Report'}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedLanguage === 'fr'
                  ? 'Compiler les essais d’un projet dans un rapport d’étude complet'
                  : 'Compile project analyses into a comprehensive study report'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project & Client selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {selectedLanguage === 'fr' ? 'Projet' : 'Project'} *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {projects.map((p) => {
                  const c = clientMap.get(p.clientId);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.projectName} {c ? `(${c.companyName})` : ''}
                    </option>
                  );
                })}
              </select>
              {currentClient && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {selectedLanguage === 'fr' ? 'Client' : 'Client'}:{' '}
                  <span className="text-blue-400 font-medium">{currentClient.companyName}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {selectedLanguage === 'fr' ? 'Modèle de Rapport' : 'Report Template'} *
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {STUDY_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name[selectedLanguage]}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                {STUDY_TEMPLATES.find((t) => t.id === selectedTemplateId)?.description[selectedLanguage]}
              </p>
            </div>
          </div>

          {/* Title & Report Number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {selectedLanguage === 'fr' ? 'Titre de l’étude' : 'Study Title'} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="Rapport d'Étude Géotechnique..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {selectedLanguage === 'fr' ? 'N° de Rapport' : 'Report Number'}
              </label>
              <input
                type="text"
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="ETD-2026-001"
              />
            </div>
          </div>

          {/* Language & Author */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {selectedLanguage === 'fr' ? 'Langue de Rédaction' : 'Document Language'}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('fr')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition border ${
                    selectedLanguage === 'fr'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Français (FR)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition border ${
                    selectedLanguage === 'en'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {selectedLanguage === 'fr' ? 'Rédacteur / Préparé par' : 'Prepared by'}
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder={selectedLanguage === 'fr' ? 'Ingénieur Géotechnicien...' : 'Geotechnical Engineer...'}
              />
            </div>
          </div>

          {/* Included Analyses selection */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {selectedLanguage === 'fr' ? 'Essais Inclus dans l’Étude' : 'Included Analyses'} (
                  {selectedAnalysisIds.length} / {projectAnalyses.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  {selectedLanguage === 'fr'
                    ? 'Sélectionnez les essais qui apparaîtront dans les tableaux et annexes'
                    : 'Select the analyses to include in the summary tables and annexes'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterTestType}
                  onChange={(e) => setFilterTestType(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                >
                  <option value="ALL">{selectedLanguage === 'fr' ? 'Tous types' : 'All types'}</option>
                  <option value="proctor">Proctor</option>
                  <option value="grain_size">Granulométrie / Grain Size</option>
                  <option value="atterberg">Atterberg</option>
                  <option value="cbr">CBR</option>
                  <option value="water_content">Teneur en eau / Water Content</option>
                  <option value="density">Masse volumique / Density</option>
                </select>

                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 bg-slate-900 rounded border border-slate-800"
                >
                  {selectedLanguage === 'fr' ? 'Tout cocher' : 'Select all'}
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs text-slate-400 hover:text-slate-300 font-medium px-2 py-1 bg-slate-900 rounded border border-slate-800"
                >
                  {selectedLanguage === 'fr' ? 'Tout décocher' : 'Clear'}
                </button>
              </div>
            </div>

            {hasDraftAnalysesSelected && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  {selectedLanguage === 'fr'
                    ? 'Attention : certains essais sélectionnés sont encore en état Brouillon.'
                    : 'Warning: some selected analyses are still in Draft status.'}
                </span>
              </div>
            )}

            {projectAnalyses.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                {selectedLanguage === 'fr'
                  ? 'Aucun essai enregistré pour ce projet.'
                  : 'No analyses found for this project.'}
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {filteredAnalyses.map((an) => {
                  const s = sampleMap.get(an.sampleId);
                  const isChecked = selectedAnalysisIds.includes(an.id);
                  const testDef = getTestDefinition(an.testType);

                  return (
                    <div
                      key={an.id}
                      onClick={() => toggleAnalysis(an.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        isChecked
                          ? 'bg-blue-950/40 border-blue-600/60 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {an.reportNumber}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-medium">
                              {testDef ? testDef.name[selectedLanguage] : an.testType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {s ? `${s.sampleId} (${s.materialType})` : an.sampleId}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              {selectedLanguage === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? selectedLanguage === 'fr'
                    ? 'Création...'
                    : 'Creating...'
                  : selectedLanguage === 'fr'
                  ? 'Créer l’Étude'
                  : 'Create Study'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
