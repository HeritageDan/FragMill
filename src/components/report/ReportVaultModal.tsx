import React, { useState } from 'react';
import { useReportVault } from '../../context/ReportVaultContext';
import { REPORT_SECTIONS_REGISTRY, type ReportSectionKey } from '../../types/reportVault';
import type { Blast, Project, Site } from '../../types';
import type { Language } from '../../i18n';
import {
  FileText,
  CheckCircle2,
  Circle,
  Download,
  Trash2,
  X,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface ReportVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  site: Site;
  blast: Blast;
  lang?: Language;
}

export const ReportVaultModal: React.FC<ReportVaultModalProps> = ({
  isOpen,
  onClose,
  project,
  site,
  blast,
  lang = 'fr',
}) => {
  const isFr = lang === 'fr';
  const {
    vaultState,
    stagedCount,
    unstageSection,
    clearVault,
    stageAllAvailable,
    downloadCombinedReport,
    isGeneratingPdf,
  } = useReportVault();

  const allKeys = Object.keys(REPORT_SECTIONS_REGISTRY) as ReportSectionKey[];

  // Selected sections for download (defaults to all staged, or all if stagedCount === 0)
  const [selectedKeys, setSelectedKeys] = useState<ReportSectionKey[]>(() => {
    const staged = allKeys.filter((k) => !!vaultState[k]);
    return staged.length > 0 ? staged : allKeys;
  });

  if (!isOpen) return null;

  const toggleSelectKey = (key: ReportSectionKey) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedKeys(allKeys);
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
  };

  const handleStageAll = () => {
    stageAllAvailable(project, site, blast);
    setSelectedKeys(allKeys);
  };

  const handleDownload = async () => {
    if (selectedKeys.length === 0) return;
    await downloadCombinedReport(project, site, blast, lang, selectedKeys);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  {isFr ? 'Générateur de Rapport Personnalisé' : 'Custom Engineering Report Builder'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {stagedCount}/11 {isFr ? 'Sections Prêtes' : 'Sections Staged'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {isFr
                  ? `Tir ${blast.blastId} • Sélectionnez les sections à inclure dans le document PDF final`
                  : `Blast ${blast.blastId} • Select the sections to bundle into your final PDF report`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold"
            >
              {isFr ? 'Tout Sélectionner' : 'Select All'}
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold"
            >
              {isFr ? 'Tout Décocher' : 'Deselect All'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStageAll}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold rounded-lg flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isFr ? 'Pré-remplir les 11 sections' : 'Include All 11 Sections'}</span>
            </button>
            {stagedCount > 0 && (
              <button
                onClick={clearVault}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold rounded-lg flex items-center gap-1"
                title={isFr ? 'Réinitialiser la sélection' : 'Reset staged sections'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFr ? 'Vider' : 'Clear'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sections List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {allKeys.map((key) => {
            const meta = REPORT_SECTIONS_REGISTRY[key];
            const isStagedNow = !!vaultState[key];
            const isSelected = selectedKeys.includes(key);
            const entry = vaultState[key];

            return (
              <div
                key={key}
                onClick={() => toggleSelectKey(key)}
                className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-300 shadow-xs'
                    : 'bg-white border-slate-200 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {isFr ? meta.titleFr : meta.titleEn}
                      </span>
                      {isStagedNow ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {isFr ? 'Prêt' : 'Ready'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                          {isFr ? 'Calcul automatique' : 'Auto calculation'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {isFr ? meta.descriptionFr : meta.descriptionEn}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {entry?.stagedAt && (
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      {new Date(entry.stagedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {isStagedNow && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unstageSection(key);
                        setSelectedKeys((prev) => prev.filter((k) => k !== key));
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100"
                      title={isFr ? 'Retirer du rapport' : 'Remove from report'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900">{selectedKeys.length}</span> {isFr ? 'sections sélectionnées pour l’export' : 'sections selected for export'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
            >
              {isFr ? 'Fermer' : 'Close'}
            </button>
            <button
              onClick={handleDownload}
              disabled={selectedKeys.length === 0 || isGeneratingPdf}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition"
            >
              {isGeneratingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isFr ? 'Génération du PDF...' : 'Generating PDF...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {isFr
                      ? `Télécharger le Rapport Général PDF (${selectedKeys.length})`
                      : `Download General PDF Report (${selectedKeys.length})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
