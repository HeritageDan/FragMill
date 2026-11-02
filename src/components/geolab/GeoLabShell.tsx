import React, { useState, useEffect } from 'react';
import { ClientManagementView } from './ClientManagementView';
import { ProjectSampleView } from './ProjectSampleView';
import { NewAnalysisView } from './NewAnalysisView';
import { ReportsListView } from './ReportsListView';
import { AnalysisDetailView } from './AnalysisDetailView';
import { OrganisationProfileView } from './OrganisationProfileView';
import { ensureGeoLabDataSeeded } from '../../db/geolabSeed';
import {
  Users,
  FolderOpen,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  ArrowRightLeft,
} from 'lucide-react';

export type GeoLabTab = 'clients' | 'projects' | 'new_analysis' | 'reports' | 'profile' | 'analysis_detail';

interface Props {
  language: 'en' | 'fr';
  onSwitchToFragMill: () => void;
}

export const GeoLabShell: React.FC<Props> = ({ language, onSwitchToFragMill }) => {
  const [activeTab, setActiveTab] = useState<GeoLabTab>('reports');
  const [selectedSampleIdForNewAnalysis, setSelectedSampleIdForNewAnalysis] = useState<string | undefined>(undefined);
  const [selectedAnalysisIdForDetail, setSelectedAnalysisIdForDetail] = useState<string | null>(null);
  const [selectedClientIdForProjects, setSelectedClientIdForProjects] = useState<string | undefined>(undefined);

  useEffect(() => {
    ensureGeoLabDataSeeded();
  }, []);

  const handleStartAnalysis = (sampleId: string) => {
    setSelectedSampleIdForNewAnalysis(sampleId);
    setActiveTab('new_analysis');
  };

  const handleViewAnalysis = (analysisId: string) => {
    setSelectedAnalysisIdForDetail(analysisId);
    setActiveTab('analysis_detail');
  };

  const handleNavigateToProjects = (clientId: string) => {
    setSelectedClientIdForProjects(clientId);
    setActiveTab('projects');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand & Module Switcher */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow">
                  FGL
                </div>
                <div>
                  <h1 className="text-base font-bold text-white leading-tight">FraGeo Lab</h1>
                  <p className="text-[10px] text-blue-400 font-medium">
                    {language === 'fr' ? 'Laboratoire Géotechnique & Sols' : 'Geotechnical Soil Testing Lab'}
                  </p>
                </div>
              </div>

              {/* Module Toggle Switcher */}
              <button
                onClick={onSwitchToFragMill}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition shadow-sm ml-2"
                title={language === 'fr' ? 'Basculer vers FraGeo Blast' : 'Switch back to FraGeo Blast'}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span>FraGeo Blast</span>
              </button>
            </div>

            {/* GeoLab Sub-Nav Tabs */}
            <nav className="flex items-center gap-1 overflow-x-auto py-2">
              <button
                onClick={() => setActiveTab('clients')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'clients'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Clients' : 'Clients'}
              </button>

              <button
                onClick={() => {
                  setSelectedClientIdForProjects(undefined);
                  setActiveTab('projects');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'projects'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Projets & Échantillons' : 'Projects & Samples'}
              </button>

              <button
                onClick={() => {
                  setSelectedSampleIdForNewAnalysis(undefined);
                  setActiveTab('new_analysis');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'new_analysis'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Nouvelle Analyse' : 'New Analysis'}
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'reports' || activeTab === 'analysis_detail'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Rapports & PV' : 'Reports'}
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'profile'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Profil Laboratoire' : 'Organisation Profile'}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'clients' && (
          <ClientManagementView
            language={language}
            onNavigateToProjects={handleNavigateToProjects}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectSampleView
            language={language}
            initialClientId={selectedClientIdForProjects}
            onStartAnalysis={handleStartAnalysis}
            onViewAnalysis={handleViewAnalysis}
          />
        )}

        {activeTab === 'new_analysis' && (
          <NewAnalysisView
            language={language}
            initialSampleId={selectedSampleIdForNewAnalysis}
            onAnalysisCreated={handleViewAnalysis}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsListView
            language={language}
            onSelectAnalysis={handleViewAnalysis}
          />
        )}

        {activeTab === 'analysis_detail' && selectedAnalysisIdForDetail && (
          <AnalysisDetailView
            analysisId={selectedAnalysisIdForDetail}
            language={language}
            onBack={() => setActiveTab('reports')}
          />
        )}

        {activeTab === 'profile' && (
          <OrganisationProfileView language={language} />
        )}
      </main>
    </div>
  );
};

