import React, { useState } from 'react';
import { useReportVault } from '../../context/ReportVaultContext';
import type { ReportSectionKey } from '../../types/reportVault';
import { REPORT_SECTIONS_REGISTRY } from '../../types/reportVault';
import type { Blast, Project, Site } from '../../types';
import { FilePlus, CheckCircle2, Download, RefreshCw, FileText, ChevronDown } from 'lucide-react';
import type { Language } from '../../i18n';

interface SendToReportButtonProps {
  sectionKey: ReportSectionKey;
  getPayload: () => Record<string, any>;
  summaryFr?: string;
  summaryEn?: string;
  project?: Project;
  site?: Site;
  blast?: Blast;
  lang?: Language;
  className?: string;
}

export const SendToReportButton: React.FC<SendToReportButtonProps> = ({
  sectionKey,
  getPayload,
  summaryFr,
  summaryEn,
  project,
  site,
  blast,
  lang = 'fr',
  className = '',
}) => {
  const { stageSection, isStaged, downloadSingleSection, downloadCombinedReport, isGeneratingPdf } = useReportVault();
  const [isExportingThis, setIsExportingThis] = useState(false);
  const [isExportingGeneral, setIsExportingGeneral] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const isFr = lang === 'fr';
  const staged = isStaged(sectionKey);
  const meta = REPORT_SECTIONS_REGISTRY[sectionKey];

  const handleStage = () => {
    try {
      const payload = getPayload();
      stageSection(sectionKey, payload, summaryFr, summaryEn);
    } catch (err) {
      console.error('Failed to extract payload for report staging:', err);
    }
  };

  const handleDownloadFullReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!blast) return;
    setIsExportingGeneral(true);
    setShowDropdown(false);
    try {
      const payload = getPayload();
      stageSection(sectionKey, payload, summaryFr, summaryEn);
      const defaultProj: Project = project || {
        id: 'proj-1',
        name: isFr ? 'Étude FragMill' : 'FragMill Study',
        description: 'Complete Mining & Milling Optimization',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const defaultSite: Site = site || {
        id: 'site-1',
        projectId: 'proj-1',
        name: isFr ? 'Fosse Minière' : 'Mining Pit',
        locationText: 'Open Pit Bench',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await downloadCombinedReport(defaultProj, defaultSite, blast, lang);
    } catch (err) {
      console.error('Failed to download general report:', err);
    } finally {
      setIsExportingGeneral(false);
    }
  };

  const handleDownloadSingle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!blast) return;
    setIsExportingThis(true);
    setShowDropdown(false);
    try {
      const payload = getPayload();
      stageSection(sectionKey, payload, summaryFr, summaryEn);
      const defaultProj: Project = project || {
        id: 'proj-1',
        name: 'Projet Bétaré Oya',
        description: 'Artisanal Gold Mining',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const defaultSite: Site = site || {
        id: 'site-1',
        projectId: 'proj-1',
        name: 'Carrière Bétaré Oya',
        locationText: 'Cameroun Est',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await downloadSingleSection(sectionKey, defaultProj, defaultSite, blast, lang);
    } catch (err) {
      console.error('Failed to download single section PDF:', err);
    } finally {
      setIsExportingThis(false);
    }
  };

  return (
    <div className={`relative inline-flex items-center rounded-xl shadow-xs ${className}`}>
      {/* Primary Action: Stage to Report */}
      <button
        onClick={handleStage}
        className={`px-3.5 py-2 rounded-l-xl text-xs font-bold flex items-center gap-1.5 transition ${
          staged
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        title={
          staged
            ? (isFr ? 'Déjà dans le rapport. Cliquez pour actualiser.' : 'Already in report. Click to update.')
            : (isFr ? 'Envoyer les résultats de cette fenêtre au rapport PDF' : 'Send this window’s results to PDF report')
        }
      >
        {staged ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
            <span>{isFr ? '✓ Dans le Rapport' : '✓ In Report'}</span>
          </>
        ) : (
          <>
            <FilePlus className="w-3.5 h-3.5 text-blue-200" />
            <span>{isFr ? 'Envoyer au Rapport' : 'Send to Report'}</span>
          </>
        )}
      </button>

      {/* Secondary Dropdown Toggle for Direct PDF Export */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`px-2 py-2 rounded-r-xl border-l border-white/20 text-white text-xs font-bold transition flex items-center justify-center ${
          staged ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-700 hover:bg-blue-800'
        }`}
        title={isFr ? 'Options de téléchargement' : 'Download options'}
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div
          className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs font-medium animate-in fade-in slide-in-from-top-1"
          onMouseLeave={() => setShowDropdown(false)}
        >
          <div className="px-3 py-1.5 border-b border-slate-100">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
              {isFr ? meta?.tabNameFr : meta?.tabNameEn}
            </span>
            <span className="text-[10px] text-slate-500">
              {isFr ? 'Export direct ou ajout au rapport global' : 'Direct export or global report staging'}
            </span>
          </div>

          <button
            onClick={() => {
              handleStage();
              setShowDropdown(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-semibold"
          >
            <FilePlus className="w-4 h-4 text-blue-600" />
            <span>{isFr ? 'Actualiser dans le rapport global' : 'Update in global report'}</span>
          </button>

          {blast && (
            <button
              onClick={handleDownloadSingle}
              disabled={isExportingThis || isExportingGeneral || isGeneratingPdf}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-blue-700 font-bold border-t border-slate-100 disabled:opacity-50"
            >
              {isExportingThis ? (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-blue-600" />
              )}
              <span>{isFr ? 'Télécharger le PDF de cette fenêtre' : 'Download this window as PDF'}</span>
            </button>
          )}

          {blast && (
            <button
              onClick={handleDownloadFullReport}
              disabled={isExportingThis || isExportingGeneral || isGeneratingPdf}
              className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center gap-2 text-indigo-700 font-bold border-t border-slate-100 disabled:opacity-50"
            >
              {isExportingGeneral ? (
                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-600" />
              )}
              <span>{isFr ? 'Télécharger le Rapport Général Complet (PDF)' : 'Download Full General Report (PDF)'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
