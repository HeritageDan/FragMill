import React, { useState, useEffect } from 'react';
import { db, getOrganisationProfile } from '../../db';
import type {
  StudyReport,
  GeoLabProject,
  GeoLabClient,
  OrganisationProfile,
} from '../../types/geolab';
import {
  buildDocumentModel,
  generateStudyPdfReport,
  generateStudyDocxReport,
  exportStudyPackageZip,
} from '../../geolab/studies';
import { NewStudyWizardModal } from './NewStudyWizardModal';
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Download,
  Archive,
  Trash2,
  Edit3,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  onSelectStudy: (studyId: string) => void;
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

export const StudyReportsListView: React.FC<Props> = ({
  language,
  onSelectStudy,
}) => {
  const [studies, setStudies] = useState<StudyReport[]>([]);
  const [projects, setProjects] = useState<GeoLabProject[]>([]);
  const [clients, setClients] = useState<GeoLabClient[]>([]);
  const [orgProfile, setOrgProfile] = useState<OrganisationProfile | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [exportingStudyId, setExportingStudyId] = useState<string | null>(null);

  const loadData = async () => {
    const s = await db.studyReports.toArray();
    const p = await db.geolabProjects.toArray();
    const c = await db.clients.toArray();
    const org = await getOrganisationProfile();

    setStudies(s.reverse()); // latest first
    setProjects(p);
    setClients(c);
    setOrgProfile(org);
  };

  useEffect(() => {
    loadData();
  }, []);

  const projectMap = new Map<string, GeoLabProject>();
  projects.forEach((p) => projectMap.set(p.id, p));

  const clientMap = new Map<string, GeoLabClient>();
  clients.forEach((c) => clientMap.set(c.id, c));

  const filteredStudies = studies.filter((st) => {
    const proj = projectMap.get(st.projectId);
    const cli = proj ? clientMap.get(proj.clientId) : null;

    const matchesSearch =
      st.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (st.reportNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (proj?.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cli?.companyName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || st.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (studyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      language === 'fr'
        ? 'Êtes-vous sûr de vouloir supprimer ce rapport d’étude ?'
        : 'Are you sure you want to delete this study report?'
    );
    if (!confirmed) return;

    await db.studyReports.delete(studyId);
    await db.studyPhotos.where('studyId').equals(studyId).delete();
    await loadData();
  };

  const handleExportDocx = async (study: StudyReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const proj = projectMap.get(study.projectId);
    if (!proj || !orgProfile) return;
    const cli = clientMap.get(proj.clientId);
    if (!cli) return;

    try {
      setExportingStudyId(study.id);

      const allAnalyses = await db.analyses.toArray();
      const includedAnalyses = allAnalyses.filter((a) => (study.includedAnalysisIds || []).includes(a.id));
      const samples = await db.samples.where('projectId').equals(proj.id).toArray();
      const photos = await db.studyPhotos.where('studyId').equals(study.id).sortBy('order');

      const model = buildDocumentModel({
        study,
        project: proj,
        client: cli,
        organisation: orgProfile,
        analyses: includedAnalyses,
        samples,
        photos,
      });

      const blob = await generateStudyDocxReport(model);
      downloadBlob(blob, `${study.reportNumber || 'Study'}.docx`);
    } catch (err: any) {
      alert(`Word export failed: ${err?.message}`);
    } finally {
      setExportingStudyId(null);
    }
  };

  const handleExportPdf = async (study: StudyReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const proj = projectMap.get(study.projectId);
    if (!proj || !orgProfile) return;
    const cli = clientMap.get(proj.clientId);
    if (!cli) return;

    try {
      setExportingStudyId(study.id);

      const allAnalyses = await db.analyses.toArray();
      const includedAnalyses = allAnalyses.filter((a) => (study.includedAnalysisIds || []).includes(a.id));
      const samples = await db.samples.where('projectId').equals(proj.id).toArray();
      const photos = await db.studyPhotos.where('studyId').equals(study.id).sortBy('order');

      const model = buildDocumentModel({
        study,
        project: proj,
        client: cli,
        organisation: orgProfile,
        analyses: includedAnalyses,
        samples,
        photos,
      });

      const blob = await generateStudyPdfReport(model);
      downloadBlob(blob, `${study.reportNumber || 'Study'}.pdf`);
    } catch (err: any) {
      alert(`PDF export failed: ${err?.message}`);
    } finally {
      setExportingStudyId(null);
    }
  };

  const handleExportZip = async (study: StudyReport, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setExportingStudyId(study.id);

      const { blob, filename } = await exportStudyPackageZip({ studyId: study.id });
      downloadBlob(blob, filename);
    } catch (err: any) {
      alert(`Package export failed: ${err?.message}`);
    } finally {
      setExportingStudyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span>{language === 'fr' ? 'Études Géotechniques' : 'Study Reports'}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {language === 'fr'
              ? 'Rapports d’études complets et personnalisés (DOCX, PDF, Package ZIP)'
              : 'Comprehensive geotechnical study reports (DOCX, PDF, Package ZIP)'}
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-md flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'fr' ? 'Nouvelle Étude' : 'New Study Report'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400 font-medium">
              {language === 'fr' ? 'Total Études' : 'Total Studies'}
            </div>
            <div className="text-xl font-bold text-white mt-0.5">{studies.length}</div>
          </div>
          <BookOpen className="w-5 h-5 text-blue-400/60" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-amber-400 font-medium">
              {language === 'fr' ? 'Brouillons' : 'Drafts'}
            </div>
            <div className="text-xl font-bold text-amber-300 mt-0.5">
              {studies.filter((s) => s.status === 'draft').length}
            </div>
          </div>
          <Clock className="w-5 h-5 text-amber-400/60" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-400 font-medium">
              {language === 'fr' ? 'Vérifiés' : 'Checked'}
            </div>
            <div className="text-xl font-bold text-blue-300 mt-0.5">
              {studies.filter((s) => s.status === 'checked').length}
            </div>
          </div>
          <CheckCircle className="w-5 h-5 text-blue-400/60" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-400 font-medium">
              {language === 'fr' ? 'Approuvés' : 'Approved'}
            </div>
            <div className="text-xl font-bold text-emerald-300 mt-0.5">
              {studies.filter((s) => s.status === 'approved').length}
            </div>
          </div>
          <CheckCircle className="w-5 h-5 text-emerald-400/60" />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              language === 'fr'
                ? 'Rechercher par titre, n°, projet, client...'
                : 'Search by title, number, project, client...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">{language === 'fr' ? 'Tous les états' : 'All statuses'}</option>
            <option value="draft">{language === 'fr' ? 'Brouillon' : 'Draft'}</option>
            <option value="checked">{language === 'fr' ? 'Vérifié' : 'Checked'}</option>
            <option value="approved">{language === 'fr' ? 'Approuvé' : 'Approved'}</option>
          </select>
        </div>
      </div>

      {/* Studies List */}
      {filteredStudies.length === 0 ? (
        <div className="p-12 text-center border border-slate-800 rounded-xl bg-slate-900/40">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">
            {language === 'fr' ? 'Aucune étude trouvée' : 'No study reports found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {language === 'fr'
              ? 'Créez votre premier rapport d’étude pour compiler vos essais.'
              : 'Create your first study report to compile project analyses.'}
          </p>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow"
          >
            {language === 'fr' ? 'Créer une étude' : 'Create a study'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudies.map((study) => {
            const proj = projectMap.get(study.projectId);
            const cli = proj ? clientMap.get(proj.clientId) : null;
            const revCount = study.revisions?.length || 1;
            const latestRev =
              study.revisions && study.revisions.length > 0
                ? study.revisions[study.revisions.length - 1]
                : { index: 0 };
            const isCurrentlyExporting = exportingStudyId === study.id;

            return (
              <div
                key={study.id}
                onClick={() => onSelectStudy(study.id)}
                className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition shadow-sm hover:shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {study.reportNumber}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        study.status === 'approved'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : study.status === 'checked'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {study.status}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      Rév. {String.fromCharCode(65 + (latestRev.index || 0))} ({revCount})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                      {study.language}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white truncate">{study.title}</h3>

                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span>{proj?.projectName || 'Project'}</span>
                    <span>•</span>
                    <span className="text-slate-300">{cli?.companyName || 'Client'}</span>
                    <span>•</span>
                    <span>
                      {study.includedAnalysisIds?.length || 0}{' '}
                      {language === 'fr' ? 'essais inclus' : 'analyses'}
                    </span>
                    <span>•</span>
                    <span>
                      {language === 'fr' ? 'Modifié le ' : 'Updated on '}
                      {study.updatedAt.split('T')[0]}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSelectStudy(study.id)}
                    className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold transition"
                    title={language === 'fr' ? 'Ouvrir l’éditeur' : 'Open editor'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleExportDocx(study, e)}
                    disabled={isCurrentlyExporting}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/60 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
                    title="Export Word (.docx)"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Word</span>
                  </button>

                  <button
                    onClick={(e) => handleExportPdf(study, e)}
                    disabled={isCurrentlyExporting}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
                    title="Export PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={(e) => handleExportZip(study, e)}
                    disabled={isCurrentlyExporting}
                    className="p-2 text-amber-300 hover:text-amber-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition disabled:opacity-50"
                    title={
                      language === 'fr'
                        ? 'Télécharger le package ZIP complet'
                        : 'Download package ZIP'
                    }
                  >
                    <Archive className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(study.id, e)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title={language === 'fr' ? 'Supprimer' : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Study Wizard Modal */}
      {isWizardOpen && (
        <NewStudyWizardModal
          language={language}
          onClose={() => setIsWizardOpen(false)}
          onCreated={(newStudyId) => {
            setIsWizardOpen(false);
            onSelectStudy(newStudyId);
          }}
        />
      )}
    </div>
  );
};
