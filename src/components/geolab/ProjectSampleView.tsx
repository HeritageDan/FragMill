import React, { useState, useEffect } from 'react';
import { db, getOrganisationProfile } from '../../db';
import type { GeoLabClient, GeoLabProject, GeoLabSample, GeoLabAnalysis, OrganisationProfile } from '../../types/geolab';
import { generateSoilSummaryExcelReport } from '../../geolab/engine/excelGenerator';
import {
  FolderOpen,
  Plus,
  Search,
  Building2,
  Layers,
  Edit2,
  FlaskConical,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  initialClientId?: string;
  onStartAnalysis: (sampleId: string) => void;
  onViewAnalysis: (analysisId: string) => void;
}

export const ProjectSampleView: React.FC<Props> = ({
  language,
  initialClientId,
  onStartAnalysis,
  onViewAnalysis,
}) => {
  const [clients, setClients] = useState<GeoLabClient[]>([]);
  const [projects, setProjects] = useState<GeoLabProject[]>([]);
  const [samples, setSamples] = useState<GeoLabSample[]>([]);
  const [analyses, setAnalyses] = useState<GeoLabAnalysis[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || 'ALL');

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<GeoLabProject | null>(null);

  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [editingSample, setEditingSample] = useState<GeoLabSample | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganisationProfile | null>(null);
  const [isExportingSampleId, setIsExportingSampleId] = useState<string | null>(null);

  const loadData = async () => {
    const c = await db.clients.toArray();
    const p = await db.geolabProjects.toArray();
    const s = await db.samples.toArray();
    const a = await db.analyses.toArray();
    const org = await getOrganisationProfile();
    setClients(c);
    setProjects(p);
    setSamples(s);
    setAnalyses(a);
    setOrgProfile(org);

    if (p.length > 0 && !selectedProjectId) {
      setSelectedProjectId(p[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProjects = projects.filter((p) => {
    const matchesClient = selectedClientId === 'ALL' || p.clientId === selectedClientId;
    const matchesSearch =
      p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.siteLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClient && matchesSearch;
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectClient = selectedProject ? clients.find((c) => c.id === selectedProject.clientId) : null;
  const projectSamples = samples.filter((s) => s.projectId === selectedProjectId);

  const getAnalysesForSample = (sampleId: string) => {
    return analyses.filter((a) => a.sampleId === sampleId);
  };

  // Handlers
  const handleOpenCreateProject = () => {
    if (clients.length === 0) {
      alert(language === 'fr' ? 'Veuillez créer un client avant d\'ajouter un projet.' : 'Please create a client before creating a project.');
      return;
    }
    setEditingProject({
      id: `proj-${Date.now()}`,
      clientId: selectedClientId !== 'ALL' ? selectedClientId : clients[0].id,
      projectName: '',
      siteLocation: '',
      referenceNumber: '',
      startDate: new Date().toISOString().substring(0, 10),
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    await db.geolabProjects.put({
      ...editingProject,
      updatedAt: new Date().toISOString(),
    });
    setIsProjectModalOpen(false);
    setSelectedProjectId(editingProject.id);
    setEditingProject(null);
    loadData();
  };

  const handleOpenCreateSample = () => {
    if (!selectedProjectId) return;
    setEditingSample({
      id: `sample-${Date.now()}`,
      projectId: selectedProjectId,
      sampleId: '',
      depth: '',
      location: selectedProject?.siteLocation || '',
      samplingDate: new Date().toISOString().substring(0, 10),
      sampler: '',
      materialType: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsSampleModalOpen(true);
  };

  const handleSaveSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSample) return;
    await db.samples.put({
      ...editingSample,
      updatedAt: new Date().toISOString(),
    });
    setIsSampleModalOpen(false);
    setEditingSample(null);
    loadData();
  };

  const handleDownloadSampleExcel = async (sample: GeoLabSample) => {
    if (!selectedProject || !projectClient) return;
    let org = orgProfile;
    if (!org) {
      org = await getOrganisationProfile();
      setOrgProfile(org);
    }
    setIsExportingSampleId(sample.id);
    try {
      const sampleAnalyses = getAnalysesForSample(sample.id);
      const blob = await generateSoilSummaryExcelReport({
        sample,
        project: selectedProject,
        client: projectClient,
        orgProfile: org,
        analyses: sampleAnalyses,
        language,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (sample.sampleId || 'echantillon').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Rapport_Analyses_${safeName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(
        language === 'fr'
          ? `Erreur lors de l'export du rapport d'analyses : ${err?.message}`
          : `Error exporting analyses report: ${err?.message}`
      );
    } finally {
      setIsExportingSampleId(null);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const confirmed = window.confirm(
      language === 'fr'
        ? `Êtes-vous sûr de vouloir supprimer définitivement le projet "${projectName}" ?\n\nAttention : cette action supprimera également tous les échantillons du projet, tous les essais en laboratoire et tous les rapports d'étude associés. Cette action est irréversible.`
        : `Are you sure you want to permanently delete project "${projectName}"?\n\nWarning: this action will also delete all associated samples, lab tests, and study reports. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      // Cascade delete samples and analyses
      const projectSamps = await db.samples.where('projectId').equals(projectId).toArray();
      for (const s of projectSamps) {
        await db.analyses.where('sampleId').equals(s.id).delete();
      }
      await db.samples.where('projectId').equals(projectId).delete();

      // Cascade delete study reports and photos
      const projectStudies = await db.studyReports.where('projectId').equals(projectId).toArray();
      for (const st of projectStudies) {
        await db.studyPhotos.where('studyId').equals(st.id).delete();
      }
      await db.studyReports.where('projectId').equals(projectId).delete();

      // Delete project itself
      await db.geolabProjects.delete(projectId);

      // Update selectedProjectId
      const remainingProjects = projects.filter((p) => p.id !== projectId);
      setSelectedProjectId(remainingProjects.length > 0 ? remainingProjects[0].id : null);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting project: ${err?.message}`);
    }
  };

  const handleDeleteSample = async (sampleId: string, sampleCode: string) => {
    const confirmed = window.confirm(
      language === 'fr'
        ? `Êtes-vous sûr de vouloir supprimer définitivement l'échantillon "${sampleCode}" ainsi que tous les essais en laboratoire associés ? Cette action est irréversible.`
        : `Are you sure you want to permanently delete sample "${sampleCode}" and all its associated lab tests? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await db.analyses.where('sampleId').equals(sampleId).delete();
      await db.samples.delete(sampleId);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting sample: ${err?.message}`);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string, reportNumber: string) => {
    const confirmed = window.confirm(
      language === 'fr'
        ? `Êtes-vous sûr de vouloir supprimer définitivement l'essai "${reportNumber}" ? Cette action est irréversible.`
        : `Are you sure you want to permanently delete test "${reportNumber}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await db.analyses.delete(analysisId);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting test: ${err?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-400" />
            {language === 'fr' ? 'Projets & Échantillons Géotechniques' : 'Geotechnical Projects & Samples'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {language === 'fr'
              ? 'Organisation des campagnes de sondages, prélèvements et traçabilité des éprouvettes d\'essais.'
              : 'Drilling campaigns, soil sampling records, and sample management for lab analyses.'}
          </p>
        </div>
        <button
          onClick={handleOpenCreateProject}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow transition"
        >
          <Plus className="w-4 h-4" />
          {language === 'fr' ? 'Nouveau Projet' : 'New Project'}
        </button>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Projects List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-col gap-2">
            {/* Filter by Client */}
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
            >
              <option value="ALL">
                {language === 'fr' ? 'Tous les Clients' : 'All Clients'} ({clients.length})
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={language === 'fr' ? 'Filtrer les projets...' : 'Filter projects...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredProjects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              const cl = clients.find((c) => c.id === p.clientId);
              const smpCount = samples.filter((s) => s.projectId === p.id).length;

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500 shadow-md'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{p.projectName}</h4>
                      <p className="text-xs text-blue-400 font-medium flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {cl?.companyName || '-'}
                      </p>
                    </div>
                    {p.referenceNumber && (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono">
                        {p.referenceNumber}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                    <span>{p.siteLocation}</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {smpCount} {language === 'fr' ? 'échantillon(s)' : 'sample(s)'}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredProjects.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 border border-slate-800 rounded-xl bg-slate-900/40">
                {language === 'fr' ? 'Aucun projet trouvé.' : 'No projects found.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Project & Samples (7 cols) */}
        <div className="lg:col-span-7">
          {selectedProject ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              {/* Project Details Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedProject.projectName}</h3>
                    {selectedProject.referenceNumber && (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs font-mono">
                        {selectedProject.referenceNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === 'fr' ? 'Client' : 'Client'}: <span className="text-white font-medium">{projectClient?.companyName}</span> | {language === 'fr' ? 'Lieu' : 'Site'}: <span className="text-white font-medium">{selectedProject.siteLocation}</span> | {language === 'fr' ? 'Démarrage' : 'Start Date'}: {selectedProject.startDate}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingProject({ ...selectedProject });
                      setIsProjectModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-white rounded bg-slate-800 transition"
                    title={language === 'fr' ? 'Modifier Projet' : 'Edit Project'}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProject(selectedProject.id, selectedProject.projectName)}
                    className="p-2 text-slate-400 hover:text-rose-400 rounded bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-800 transition"
                    title={language === 'fr' ? 'Supprimer définitivement ce Projet' : 'Delete Project'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleOpenCreateSample}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {language === 'fr' ? 'Ajouter Échantillon' : 'Add Sample'}
                  </button>
                </div>
              </div>

              {/* Samples List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    {language === 'fr' ? 'Échantillons & Essais Réalisés' : 'Sample Records & Associated Tests'} ({projectSamples.length})
                  </h4>
                </div>

                {projectSamples.length > 0 ? (
                  <div className="space-y-3">
                    {projectSamples.map((sample) => {
                      const sampleAnalyses = getAnalysesForSample(sample.id);

                      return (
                        <div
                          key={sample.id}
                          className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{sample.sampleId}</span>
                                {sample.depth && (
                                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                                    {language === 'fr' ? 'Prof' : 'Depth'}: {sample.depth}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {sample.location && `Lieu: ${sample.location} | `}
                                {language === 'fr' ? 'Date' : 'Date'}: {sample.samplingDate}
                                {sample.sampler && ` | Prélèvement: ${sample.sampler}`}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleDownloadSampleExcel(sample)}
                                disabled={isExportingSampleId === sample.id}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded shadow transition"
                                title={
                                  language === 'fr'
                                    ? "Télécharger le rapport d'analyses complet de cet échantillon (.xlsx) avec détails, formules et graphiques"
                                    : 'Download complete analyses report (.xlsx) for this sample with details, formulas and charts'
                                }
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200" />
                                {isExportingSampleId === sample.id
                                  ? '...'
                                  : language === 'fr'
                                  ? 'Rapport Analyses (.xlsx)'
                                  : 'Analyses Report (.xlsx)'}
                              </button>

                              <button
                                onClick={() => onStartAnalysis(sample.id)}
                                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded shadow transition"
                              >
                                <FlaskConical className="w-3.5 h-3.5" />
                                {language === 'fr' ? '+ Nouvel Essai' : '+ New Test'}
                              </button>

                              <button
                                onClick={() => handleDeleteSample(sample.id, sample.sampleId)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800 transition"
                                title={language === 'fr' ? 'Supprimer cet échantillon' : 'Delete sample'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Analyses badges for this sample */}
                          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 items-center text-xs">
                            <span className="text-[11px] text-slate-400 font-medium">
                              {language === 'fr' ? 'Essais :' : 'Analyses:'}
                            </span>
                            {sampleAnalyses.length > 0 ? (
                              sampleAnalyses.map((an) => (
                                <div
                                  key={an.id}
                                  className="flex items-center bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded text-xs transition"
                                >
                                  <button
                                    onClick={() => onViewAnalysis(an.id)}
                                    className="flex items-center gap-1 px-2 py-1 text-white hover:text-blue-300 transition"
                                    title={language === 'fr' ? 'Consulter le rapport d’essai' : 'View test report'}
                                  >
                                    <FileSpreadsheet className="w-3 h-3 text-blue-400" />
                                    <span className="font-semibold">{an.reportNumber}</span>
                                    <span className="text-[10px] text-slate-400">({an.testType})</span>
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        an.status === 'approved'
                                          ? 'bg-emerald-400'
                                          : an.status === 'checked'
                                          ? 'bg-blue-400'
                                          : 'bg-amber-400'
                                      }`}
                                    />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAnalysis(an.id, an.reportNumber);
                                    }}
                                    className="px-1.5 py-1 text-slate-400 hover:text-rose-400 border-l border-slate-700/80 transition"
                                    title={language === 'fr' ? 'Supprimer cet essai' : 'Delete test'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">
                                {language === 'fr' ? 'Aucun essai pour le moment.' : 'No analyses yet.'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                    {language === 'fr'
                      ? 'Aucun échantillon dans ce projet. Cliquez sur "Ajouter Échantillon" pour commencer.'
                      : 'No samples in this project yet. Click "Add Sample" to start.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-sm">
              {language === 'fr' ? 'Sélectionnez un projet pour afficher ses échantillons.' : 'Select a project to view samples.'}
            </div>
          )}
        </div>
      </div>

      {/* Project Modal */}
      {isProjectModalOpen && editingProject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingProject.createdAt === editingProject.updatedAt
                ? language === 'fr' ? 'Nouveau Projet' : 'New Project'
                : language === 'fr' ? 'Modifier le Projet' : 'Edit Project'}
            </h3>

            <form onSubmit={handleSaveProject} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Client / Donneur d\'ordre *' : 'Client *'}
                </label>
                <select
                  required
                  value={editingProject.clientId}
                  onChange={(e) => setEditingProject({ ...editingProject, clientId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Nom du Projet / Chantier *' : 'Project Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editingProject.projectName}
                  onChange={(e) => setEditingProject({ ...editingProject, projectName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Site / Localisation *' : 'Site / Location *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingProject.siteLocation}
                    onChange={(e) => setEditingProject({ ...editingProject, siteLocation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'N° Référence / Réf Interne' : 'Reference / Internal Ref'}
                  </label>
                  <input
                    type="text"
                    value={editingProject.referenceNumber}
                    onChange={(e) => setEditingProject({ ...editingProject, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              {/* Extended Project Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Programme / Mission' : 'Programme / Mission'}
                  </label>
                  <input
                    type="text"
                    placeholder={language === 'fr' ? 'Ex: Programme National de Réhabilitation' : 'e.g. National Rehabilitation Programme'}
                    value={editingProject.programmeTitle || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, programmeTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Lot / Section' : 'Lot / Section'}
                  </label>
                  <input
                    type="text"
                    placeholder={language === 'fr' ? 'Ex: Lot 2 - PK 40 au PK 60' : 'e.g. Lot 2 - Sec. PK 40-60'}
                    value={editingProject.lotSection || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, lotSection: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'N° Marché / Contrat' : 'Contract Number'}
                  </label>
                  <input
                    type="text"
                    placeholder={language === 'fr' ? 'Ex: CTR-2026/BTP-08' : 'e.g. CTR-2026/BTP-08'}
                    value={editingProject.contractNumber || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, contractNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Appel d’offres n°' : 'Tender Number'}
                  </label>
                  <input
                    type="text"
                    placeholder={language === 'fr' ? 'Ex: AO-2026-MINTP-01' : 'e.g. AO-2026-MINTP-01'}
                    value={editingProject.tenderNumber || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, tenderNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Financement (Bailleurs / Ligne budgétaire)' : 'Financing (Funders / Budget line)'}
                </label>
                <textarea
                  rows={2}
                  placeholder={language === 'fr' ? 'Ex: Banque Mondiale / Budget d’Investissement Public' : 'e.g. World Bank / State Public Investment Budget'}
                  value={editingProject.financingText || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, financingText: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Date de Début' : 'Start Date'}
                </label>
                <input
                  type="date"
                  value={editingProject.startDate}
                  onChange={(e) => setEditingProject({ ...editingProject, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition"
                >
                  {language === 'fr' ? 'Enregistrer' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sample Modal */}
      {isSampleModalOpen && editingSample && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingSample.createdAt === editingSample.updatedAt
                ? language === 'fr' ? 'Nouvel Échantillon' : 'New Sample'
                : language === 'fr' ? 'Modifier l\'Échantillon' : 'Edit Sample'}
            </h3>

            <form onSubmit={handleSaveSample} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Identifiant de l\'Échantillon (ex: Puit 1, BH-02) *' : 'Sample ID *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Sondage P1, PK 40+800..."
                  value={editingSample.sampleId}
                  onChange={(e) => setEditingSample({ ...editingSample, sampleId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Profondeur (ex: 1.5 - 2.5 m)' : 'Depth'}
                  </label>
                  <input
                    type="text"
                    placeholder="ex: 1.50 - 2.50 m"
                    value={editingSample.depth || ''}
                    onChange={(e) => setEditingSample({ ...editingSample, depth: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Date de Prélèvement' : 'Sampling Date'}
                  </label>
                  <input
                    type="date"
                    value={editingSample.samplingDate}
                    onChange={(e) => setEditingSample({ ...editingSample, samplingDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Lieu / Emplacement' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={editingSample.location || ''}
                    onChange={(e) => setEditingSample({ ...editingSample, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Préleveur / Opérateur' : 'Sampler'}
                  </label>
                  <input
                    type="text"
                    value={editingSample.sampler || ''}
                    onChange={(e) => setEditingSample({ ...editingSample, sampler: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Description Visuelle / Nature' : 'Material Description'}
                </label>
                <input
                  type="text"
                  placeholder="ex: Sable fin limoneux beige..."
                  value={editingSample.materialType || ''}
                  onChange={(e) => setEditingSample({ ...editingSample, materialType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSampleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition"
                >
                  {language === 'fr' ? 'Enregistrer' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
