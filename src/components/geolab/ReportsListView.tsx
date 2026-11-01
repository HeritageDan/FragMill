import React, { useState, useEffect } from 'react';
import { db, getOrganisationProfile } from '../../db';
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
import { exportProjectReportsZip } from '../../geolab/engine/projectZipExporter';
import {
  FileSpreadsheet,
  FileText,
  Search,
  Download,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  onSelectAnalysis: (analysisId: string) => void;
}

export const ReportsListView: React.FC<Props> = ({ language, onSelectAnalysis }) => {
  const [analyses, setAnalyses] = useState<GeoLabAnalysis[]>([]);
  const [samples, setSamples] = useState<GeoLabSample[]>([]);
  const [projects, setProjects] = useState<GeoLabProject[]>([]);
  const [clients, setClients] = useState<GeoLabClient[]>([]);
  const [orgProfile, setOrgProfile] = useState<OrganisationProfile | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedProjectIdForZip, setSelectedProjectIdForZip] = useState<string>('');
  const [isExportingZip, setIsExportingZip] = useState(false);

  const loadData = async () => {
    const a = await db.analyses.toArray();
    const s = await db.samples.toArray();
    const p = await db.geolabProjects.toArray();
    const c = await db.clients.toArray();
    const org = await getOrganisationProfile();

    setAnalyses(a.reverse()); // most recent first
    setSamples(s);
    setProjects(p);
    setClients(c);
    setOrgProfile(org);

    if (p.length > 0 && !selectedProjectIdForZip) {
      setSelectedProjectIdForZip(p[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sampleMap = new Map<string, GeoLabSample>();
  samples.forEach((s) => sampleMap.set(s.id, s));

  const projectMap = new Map<string, GeoLabProject>();
  projects.forEach((p) => projectMap.set(p.id, p));

  const clientMap = new Map<string, GeoLabClient>();
  clients.forEach((c) => clientMap.set(c.id, c));

  const filteredAnalyses = analyses.filter((an) => {
    const s = sampleMap.get(an.sampleId);
    const p = s ? projectMap.get(s.projectId) : null;
    const c = p ? clientMap.get(p.clientId) : null;

    const matchesSearch =
      an.reportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s?.sampleId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p?.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c?.companyName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'ALL' || an.testType === filterType;
    const matchesStatus = filterStatus === 'ALL' || an.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleDownloadExcel = async (an: GeoLabAnalysis, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!orgProfile) return;
    const s = sampleMap.get(an.sampleId);
    const p = s ? projectMap.get(s.projectId) : null;
    const c = p ? clientMap.get(p.clientId) : null;
    if (!s || !p || !c) return;

    const testDef = getTestDefinition(an.testType);
    const blob = await generateGeoLabExcelReport({
      analysis: an,
      client: c,
      project: p,
      sample: s,
      orgProfile,
      testDef,
      language,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${an.reportNumber}_${an.testType}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (an: GeoLabAnalysis, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!orgProfile) return;
    const s = sampleMap.get(an.sampleId);
    const p = s ? projectMap.get(s.projectId) : null;
    const c = p ? clientMap.get(p.clientId) : null;
    if (!s || !p || !c) return;

    const testDef = getTestDefinition(an.testType);
    const blob = await generateGeoLabPdfReport({
      analysis: an,
      client: c,
      project: p,
      sample: s,
      orgProfile,
      testDef,
      language,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${an.reportNumber}_${an.testType}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadProjectZip = async () => {
    if (!selectedProjectIdForZip) return;
    setIsExportingZip(true);
    try {
      const { blob, filename } = await exportProjectReportsZip({
        projectId: selectedProjectIdForZip,
        approvedOnly: false,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`ZIP export error: ${err.message}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            {language === 'fr' ? 'Procès-Verbaux & Rapports d\'Essais' : 'Laboratory Test Reports'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {language === 'fr'
              ? 'Registre complet des analyses géotechniques, export individuel ou téléchargement groupé en archive ZIP.'
              : 'Complete register of geotechnical analyses, individual exports and batch ZIP downloads.'}
          </p>
        </div>

        {/* Batch Project ZIP Download */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-lg text-xs">
          <select
            value={selectedProjectIdForZip}
            onChange={(e) => setSelectedProjectIdForZip(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-xs max-w-[200px] truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName}
              </option>
            ))}
          </select>
          <button
            onClick={handleDownloadProjectZip}
            disabled={isExportingZip || !selectedProjectIdForZip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition shadow"
          >
            <Download className="w-3.5 h-3.5" />
            {isExportingZip ? '...' : language === 'fr' ? 'Export ZIP Projet' : 'Download Project ZIP'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'fr' ? 'Rechercher rapport, échantillon, client...' : 'Search report #, sample, client...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-400"
          />
        </div>

        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
          >
            <option value="ALL">{language === 'fr' ? 'Tous les Essais' : 'All Test Types'}</option>
            <option value="proctor">Proctor</option>
            <option value="grain_size">{language === 'fr' ? 'Granulométrie' : 'Grain Size'}</option>
            <option value="water_content">{language === 'fr' ? 'Teneur en eau' : 'Water Content'}</option>
          </select>
        </div>

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
          >
            <option value="ALL">{language === 'fr' ? 'Tous les Statuts' : 'All Statuses'}</option>
            <option value="draft">{language === 'fr' ? 'Brouillon' : 'Draft'}</option>
            <option value="checked">{language === 'fr' ? 'Vérifié' : 'Checked'}</option>
            <option value="approved">{language === 'fr' ? 'Approuvé' : 'Approved'}</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">{language === 'fr' ? 'N° Rapport' : 'Report No'}</th>
                <th className="px-4 py-3">{language === 'fr' ? 'Essai / Norme' : 'Test / Standard'}</th>
                <th className="px-4 py-3">{language === 'fr' ? 'Échantillon & Projet' : 'Sample & Project'}</th>
                <th className="px-4 py-3">{language === 'fr' ? 'Date Essai' : 'Date'}</th>
                <th className="px-4 py-3">{language === 'fr' ? 'Statut' : 'Status'}</th>
                <th className="px-4 py-3 text-right">{language === 'fr' ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredAnalyses.map((an) => {
                const s = sampleMap.get(an.sampleId);
                const p = s ? projectMap.get(s.projectId) : null;
                const c = p ? clientMap.get(p.clientId) : null;

                return (
                  <tr
                    key={an.id}
                    onClick={() => onSelectAnalysis(an.id)}
                    className="hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-white block">{an.reportNumber}</span>
                      <span className="text-[10px] text-slate-400">v{an.version}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-blue-400 block">
                        {an.testType === 'proctor'
                          ? 'Proctor'
                          : an.testType === 'grain_size'
                          ? language === 'fr' ? 'Granulométrie' : 'Grain Size'
                          : language === 'fr' ? 'Teneur en Eau' : 'Water Content'}
                      </span>
                      <span className="text-[10px] text-slate-400">{an.standard}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white block">{s?.sampleId || '-'}</span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[220px]">
                        {p?.projectName} ({c?.companyName})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{an.testedDate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          an.status === 'approved'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : an.status === 'checked'
                            ? 'bg-blue-950/80 text-blue-400 border border-blue-800'
                            : 'bg-amber-950/80 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {an.status === 'approved' && <CheckCircle className="w-2.5 h-2.5" />}
                        {an.status === 'checked' && <Clock className="w-2.5 h-2.5" />}
                        {an.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleDownloadExcel(an, e)}
                          title="Excel (.xlsx)"
                          className="p-1.5 bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 rounded transition"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDownloadPdf(an, e)}
                          title="PDF (.pdf)"
                          className="p-1.5 bg-rose-950 text-rose-400 hover:bg-rose-900 border border-rose-800 rounded transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAnalyses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">
                    {language === 'fr' ? 'Aucun procès-verbal trouvé.' : 'No reports found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
