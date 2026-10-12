import React from 'react';
import type { AppSettings, Project, Blast } from '../../types';
import {
  Compass,
  Wand2,
  Sliders,
  Scale,
  Factory,
  Settings as SettingsIcon,
  HelpCircle,
  Sun,
  Moon,
  Globe,
  PlusCircle,
  Database,
} from 'lucide-react';

interface AppHeaderProps {
  currentProject: Project | null;
  blasts: Blast[];
  activeBlastId: string;
  onSelectBlast: (id: string) => void;
  activeTab: 'wizard' | 'blast' | 'validation' | 'minetomill' | 'kuzram' | 'settings' | 'help';
  onSelectTab: (tab: 'wizard' | 'blast' | 'validation' | 'minetomill' | 'kuzram' | 'settings' | 'help') => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onNewBlast: () => void;
  onLoadDemoProject: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentProject,
  blasts,
  activeBlastId,
  onSelectBlast,
  activeTab,
  onSelectTab,
  settings,
  onUpdateSettings,
  onNewBlast,
  onLoadDemoProject,
}) => {
  const isFrench = settings.language === 'fr';

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
          )}

          <button
            onClick={onNewBlast}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 font-semibold"
            title="Create New Blast"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">{isFrench ? 'Nouveau Tir' : 'New Blast'}</span>
          </button>

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
            title="Load Bétaré Oya Demo Data"
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
              {isFrench ? 'Tirs & Images' : 'Blast Records & Sizing'}
            </button>
            <button
              onClick={() => onSelectTab('validation')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'validation' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-4 h-4" />
              {isFrench ? 'Vérité Terrain' : 'Ground Truth & Sieve'}
            </button>
            <button
              onClick={() => onSelectTab('minetomill')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'minetomill' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Factory className="w-4 h-4" />
              {isFrench ? 'Mine-au-Moulin' : 'Mine-to-Mill Lab'}
            </button>
            <button
              onClick={() => onSelectTab('kuzram')}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'kuzram' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              {isFrench ? 'Kuz-Ram & Bayésien' : 'Kuz-Ram & Advisor'}
            </button>
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
