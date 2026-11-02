import React from 'react';
import type { AppSettings, Project, Blast } from '../../types';
import {
  Compass,
  Wand2,
  Sliders,
  Scale,
  TrendingUp,
  Settings as SettingsIcon,
  HelpCircle,
  Sun,
  Moon,
  Globe,
  PlusCircle,
  Database,
  Trash2,
  FileText,
  FlaskConical,
} from 'lucide-react';
import { useReportVault } from '../../context/ReportVaultContext';

export type NavigationTab =
  | 'wizard'
  | 'blast'
  | 'validation'
  | 'optimise'
  | 'experimental'
  | 'settings'
  | 'help';

interface AppHeaderProps {
  currentProject: Project | null;
  blasts: Blast[];
  activeBlastId: string;
  onSelectBlast: (id: string) => void;
  onDeleteBlast?: (id: string) => void;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onNewBlast: () => void;
  onLoadDemoProject: () => void;
  onOpenReportVault?: () => void;
  activeAppModule?: 'fragmill' | 'geolab';
  onSwitchAppModule?: (mod: 'fragmill' | 'geolab') => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentProject,
  blasts,
  activeBlastId,
  onSelectBlast,
  onDeleteBlast,
  activeTab,
  onSelectTab,
  settings,
  onUpdateSettings,
  onNewBlast,
  onLoadDemoProject,
  onOpenReportVault,
  activeAppModule = 'fragmill',
  onSwitchAppModule,
}) => {
  const isFrench = settings.language === 'fr';
  const { stagedCount, totalSections } = useReportVault();

  const toggleLanguage = () => {
    onUpdateSettings({
      ...settings,
      language: settings.language === 'en' ? 'fr' : 'en',
    });
  };

  const toggleTheme = () => {
    let nextTheme: 'default' | 'outdoor' | 'dark' = 'default';
    if (settings.theme === 'default') nextTheme = 'outdoor';
    else if (settings.theme === 'outdoor') nextTheme = 'dark';
    else nextTheme = 'default';

    onUpdateSettings({ ...settings, theme: nextTheme });
    document.body.classList.remove('outdoor-mode', 'dark');
    if (nextTheme === 'outdoor') document.body.classList.add('outdoor-mode');
    if (nextTheme === 'dark') document.body.classList.add('dark');
  };

  const toggleMode = () => {
    const nextMode = settings.mode === 'field' ? 'expert' : 'field';
    onUpdateSettings({ ...settings, mode: nextMode });
    if (nextMode === 'field') {
      onSelectTab('wizard');
    } else {
      onSelectTab('blast');
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      {/* Top Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Logo and Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-tight text-white">FRAGMILL</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Blast-to-Mill
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {currentProject?.name || 'Artisanal & Small-Scale Mining Fragmentation Lab'}
            </p>
          </div>

          {/* Module Switcher: FragMill | GeoLab */}
          {onSwitchAppModule && (
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700 ml-2">
              <button
                onClick={() => onSwitchAppModule('fragmill')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  activeAppModule === 'fragmill'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                FragMill
              </button>
              <button
                onClick={() => onSwitchAppModule('geolab')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                  activeAppModule === 'geolab'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                GeoLab
              </button>
            </div>
          )}
        </div>

        {/* Global Controls: Mode Toggle, Theme, Language, Blast Selector */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Mode Switcher */}
          <button
            onClick={toggleMode}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition ${
              settings.mode === 'field'
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow'
            }`}
          >
            {settings.mode === 'field' ? (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Mode Terrain' : 'Field Mode'}</span>
              </>
            ) : (
              <>
                <Sliders className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Mode Expert' : 'Expert Mode'}</span>
              </>
            )}
          </button>

          {/* Blast Quick Selector */}
          {blasts.length > 0 && (
            <div className="flex items-center gap-1">
              <select
                value={activeBlastId}
                onChange={(e) => onSelectBlast(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-hidden"
              >
                {blasts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.blastId}
                  </option>
                ))}
              </select>
              {onDeleteBlast && (
                <button
                  onClick={() => {
                    const currentB = blasts.find((b) => b.id === activeBlastId);
                    const confirmMsg = isFrench
                      ? `Êtes-vous sûr de vouloir supprimer définitivement le tir ${currentB?.blastId || ''} ainsi que toutes ses photos et données associées ?`
                      : `Are you sure you want to permanently delete blast ${currentB?.blastId || ''} and all its associated photos and data?`;
                    if (window.confirm(confirmMsg)) {
                      onDeleteBlast(activeBlastId);
                    }
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition"
                  title={isFrench ? 'Supprimer ce tir' : 'Delete this blast'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={onNewBlast}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 font-semibold"
            title="Create New Blast"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">{isFrench ? 'Nouveau Tir' : 'New Blast'}</span>
          </button>

          {/* Custom Modular Report Vault Button */}
          {onOpenReportVault && (
            <button
              onClick={onOpenReportVault}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition"
              title={isFrench ? 'Ouvrir le registre et télécharger le Rapport Général PDF' : 'Open vault and download General PDF Report'}
            >
              <FileText className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">{isFrench ? 'Rapport Général' : 'General Report'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                stagedCount > 0 ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white'
              }`}>
                {stagedCount}/{totalSections}
              </span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            title={`Current Theme: ${settings.theme}`}
          >
            {settings.theme === 'outdoor' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-blue-400" />
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 font-bold"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{settings.language.toUpperCase()}</span>
          </button>

          {/* Demo Project Button */}
          <button
            onClick={onLoadDemoProject}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 text-[11px] font-medium"
            title={isFrench ? "Charger les données de démonstration" : "Load Demo Data"}
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Demo</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto text-xs font-semibold py-1">
        {settings.mode === 'field' ? (
          <button
            onClick={() => onSelectTab('wizard')}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'wizard' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            {isFrench ? 'Assistant Terrain Guidé' : 'Field Wizard'}
          </button>
        ) : (
          <>
            <button
              onClick={() => onSelectTab('blast')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'blast' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-4 h-4" />
              {isFrench ? 'Tir' : 'Blast'}
            </button>
            <button
              onClick={() => onSelectTab('validation')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'validation' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-4 h-4" />
              {isFrench ? 'Vérité Terrain' : 'Validation'}
            </button>
            <button
              onClick={() => onSelectTab('optimise')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'optimise' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              {isFrench ? 'Prédiction & Optimisation' : 'Predict & Optimise'}
            </button>
            {onOpenReportVault && (
              <button
                onClick={onOpenReportVault}
                className="px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap text-slate-400 hover:text-white"
                title={isFrench ? 'Rapport d’ingénierie consolidé' : 'Consolidated Engineering Report'}
              >
                <FileText className="w-4 h-4 text-blue-400" />
                <span>{isFrench ? 'Rapports' : 'Reports'}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    stagedCount > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {stagedCount}/{totalSections}
                </span>
              </button>
            )}
            {settings?.showExperimentalModules && (
              <button
                onClick={() => onSelectTab('experimental')}
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                  activeTab === 'experimental'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FlaskConical className="w-4 h-4 text-amber-300" />
                {isFrench ? 'Expérimental' : 'Experimental'}
              </button>
            )}
          </>
        )}

        <button
          onClick={() => onSelectTab('settings')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'settings' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          {isFrench ? 'Paramètres' : 'Settings'}
        </button>
        <button
          onClick={() => onSelectTab('help')}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
            activeTab === 'help' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          {isFrench ? 'Protocole & Aide' : 'Guide & Protocol'}
        </button>
      </div>
    </header>
  );
};
