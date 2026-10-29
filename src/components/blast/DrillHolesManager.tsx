import React, { useState, useRef, useMemo } from 'react';
import type { Blast, DetailedDrillHole } from '../../types';
import {
  parseDrillHolesFromFile,
  exportDrillHolesToXlsx,
  exportDrillHolesToCsv,
  downloadSampleDrillHoleTemplate,
  calculateDrillHoleSummary,
  syncBlastWithDrillHoles,
  generateDefaultDrillHolesFromBlast,
} from '../../services/drillHoles/drillHoleService';
import {
  getAllPredefinedTestDatasets,
  type PredefinedTestDataset,
} from '../../services/drillHoles/predefinedTestDatasets';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Droplet,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Filter,
  Save,
  X,
  FileDown,
  Info,
  ChevronDown,
  Database,
} from 'lucide-react';

interface DrillHolesManagerProps {
  blast: Blast;
  onUpdateBlast: (updated: Blast) => void;
  lang?: 'en' | 'fr';
}

export const DrillHolesManager: React.FC<DrillHolesManagerProps> = ({
  blast,
  onUpdateBlast,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  // Ensure blast has drillholes, or generate defaults
  const holes: DetailedDrillHole[] = useMemo(() => {
    if (blast.drillHoles && blast.drillHoles.length > 0) {
      return blast.drillHoles;
    }
    return generateDefaultDrillHolesFromBlast(blast);
  }, [blast]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'wet' | 'face' | 'hard'>('all');
  const [showTestMenu, setShowTestMenu] = useState(false);

  // Predefined test datasets (>= 30 holes each)
  const testDatasets = useMemo(() => getAllPredefinedTestDatasets(), []);

  // Modal for editing or adding a hole
  const [editingHole, setEditingHole] = useState<DetailedDrillHole | null>(null);
  const [isNewHole, setIsNewHole] = useState(false);

  // Bench height
  const benchHeight = blast.parameters.benchHeight || 10.0;
  const summary = useMemo(() => calculateDrillHoleSummary(holes, benchHeight), [holes, benchHeight]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  };

  // 1-Click Load Predefined Test Dataset
  const handleLoadTestDataset = (ds: PredefinedTestDataset) => {
    const updatedBlast = syncBlastWithDrillHoles(blast, ds.holes);
    onUpdateBlast(updatedBlast);
    setShowTestMenu(false);
    showToast(
      isFrench
        ? `✓ ${ds.nameFr} (${ds.holeCount} trous, ${ds.wetHolesCount} trous humides) chargé avec succès ! Tous les modules sont synchronisés.`
        : `✓ ${ds.nameEn} (${ds.holeCount} holes, ${ds.wetHolesCount} wet holes) loaded successfully! All modules synchronized.`
    );
  };

  // 1-Click Download Predefined Test Dataset as .xlsx
  const handleDownloadTestDatasetXlsx = (ds: PredefinedTestDataset) => {
    const blob = exportDrillHolesToXlsx(ds.holes, `${blast.blastId}_${ds.id}`, lang);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ds.id}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(isFrench ? `Fichier ${ds.id}.xlsx généré !` : `Downloaded ${ds.id}.xlsx!`);
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const parsedHoles = await parseDrillHolesFromFile(file, benchHeight);
      if (parsedHoles.length === 0) {
        showToast(
          isFrench
            ? '⚠ Aucun trou valide trouvé dans le fichier importé.'
            : '⚠ No valid drill holes found in uploaded file.',
          'error'
        );
        return;
      }

      // Synchronize with Blast and update parent
      const updatedBlast = syncBlastWithDrillHoles(blast, parsedHoles);
      onUpdateBlast(updatedBlast);

      showToast(
        isFrench
          ? `✓ ${parsedHoles.length} trous importés avec succès depuis ${file.name} ! Tous les modules ont été synchronisés.`
          : `✓ Successfully imported ${parsedHoles.length} drill holes from ${file.name}! All modules synchronized.`
      );
    } catch (err: any) {
      console.error('Failed to parse drillholes file:', err);
      showToast(
        isFrench
          ? `Erreur lors de l'import: ${err?.message || 'Format de fichier non reconnu'}`
          : `Import error: ${err?.message || 'Unrecognized file format'}`,
        'error'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export to Excel
  const handleExportXlsx = () => {
    const blob = exportDrillHolesToXlsx(holes, blast.blastId, lang);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FragMill_Trous_${blast.blastId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(isFrench ? 'Fichier Excel généré !' : 'Excel file downloaded!');
  };

  // Export to CSV
  const handleExportCsv = () => {
    const csv = exportDrillHolesToCsv(holes);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FragMill_Trous_${blast.blastId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(isFrench ? 'Fichier CSV généré !' : 'CSV file downloaded!');
  };

  // Delete Hole
  const handleDeleteHole = (holeId: string) => {
    const confirmMsg = isFrench
      ? `Supprimer définitivement le trou ${holeId} ?`
      : `Permanently delete hole ${holeId}?`;
    if (!window.confirm(confirmMsg)) return;

    const remaining = holes.filter((h) => h.holeId !== holeId);
    const updatedBlast = syncBlastWithDrillHoles(blast, remaining);
    onUpdateBlast(updatedBlast);
    showToast(isFrench ? `Trou ${holeId} supprimé.` : `Hole ${holeId} deleted.`);
  };

  // Save Edited or New Hole
  const handleSaveHoleModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHole) return;

    let updatedHoles: DetailedDrillHole[];
    if (isNewHole) {
      updatedHoles = [...holes, editingHole];
    } else {
      updatedHoles = holes.map((h) => (h.holeId === editingHole.holeId ? editingHole : h));
    }

    const updatedBlast = syncBlastWithDrillHoles(blast, updatedHoles);
    onUpdateBlast(updatedBlast);
    setEditingHole(null);
    showToast(isFrench ? 'Modifications enregistrées !' : 'Hole changes saved!');
  };

  // Open modal to add a new hole
  const handleAddNewHoleClick = () => {
    const nextNum = holes.length + 1;
    const newH: DetailedDrillHole = {
      holeId: `H-${nextNum < 10 ? '0' : ''}${nextNum}`,
      rowNumber: 2,
      eastingX: parseFloat((summary.bounds.maxX + summary.avgSpacingM).toFixed(2)),
      northingY: parseFloat(summary.avgBurdenM.toFixed(2)),
      elevationZ: blast.benchElevation || 840.0,
      diameterMm: summary.avgDiameterMm || 89,
      depthM: summary.avgDepthM || 11.0,
      burdenM: summary.avgBurdenM || 3.0,
      spacingM: summary.avgSpacingM || 3.5,
      subdrillM: blast.parameters.subdrill || 1.0,
      stemmingM: summary.avgStemmingM || 2.2,
      inclinationDeg: 90,
      waterDepthM: 0,
      toeExplosiveType: 'Bulk Emulsion',
      toeChargeKg: 8.0,
      columnExplosiveType: 'ANFO',
      columnChargeKg: 14.0,
      airDeckM: 0,
      totalChargeKg: 22.0,
      powderFactorKgPerM3: 0.40,
      rockType: blast.rockMass.rockType || 'Granodiorite',
      ucsMPa: summary.avgUcsMPa || 120,
      rqdPercent: 75,
      densityTPerM3: blast.rockMass.density || 2.68,
      detonatorDelayMs: summary.maxDelayMs + 25,
      detonatorType: 'Electronic i-kon III',
      status: 'planned',
      notes: '',
    };
    setEditingHole(newH);
    setIsNewHole(true);
  };

  // Filtered holes list
  const filteredHoles = useMemo(() => {
    return holes.filter((h) => {
      const matchesSearch =
        searchQuery === '' ||
        h.holeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.rockType && h.rockType.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.notes && h.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterMode === 'wet') return (h.waterDepthM || 0) > 0;
      if (filterMode === 'face') return h.rowNumber === 1;
      if (filterMode === 'hard') return (h.ucsMPa || 0) > 125;

      return true;
    });
  }, [holes, searchQuery, filterMode]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg transition animate-in fade-in ${
            toastMsg.type === 'success'
              ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-700'
              : 'bg-red-900/90 text-red-100 border border-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            )}
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Section Header & Main Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  {isFrench ? 'Matrice des Trous de Foration (Import Excel / CSV)' : 'Drillhole Matrix & Per-Hole Pattern Data'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {summary.totalHoles} {isFrench ? 'trous' : 'holes'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isFrench
                  ? 'Importez votre fichier Excel (.xlsx) ou CSV de foration. Les données de chaque trou (coordonnées, dureté, charge, eau) alimentent directement le Krigeage, le Séquençage 3D et le Jumeau Broyage.'
                  : 'Upload your drill pattern Excel (.xlsx) or CSV file. Per-hole coordinates, rock hardness, water, and charges automatically sync with Kriging, 3D Timing, and Comminution.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Predefined Test Datasets Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTestMenu(!showTestMenu)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-indigo-200 shadow-2xs"
              title={isFrench ? 'Charger l’un des 4 jeux de test (≥ 30 trous)' : 'Load one of the 4 test datasets (≥ 30 holes)'}
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isFrench ? 'Jeux de Test (4)' : 'Test Datasets (4)'}</span>
              <ChevronDown className="w-3 h-3 text-indigo-500" />
            </button>

            {showTestMenu && (
              <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-in fade-in zoom-in-95 space-y-2">
                <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-extrabold">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isFrench ? '4 JEUX DE TEST VALIDÉS (≥ 30 TROUS)' : '4 VERIFIED TEST DATASETS (≥ 30 HOLES)'}</span>
                  </div>
                  <button onClick={() => setShowTestMenu(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {testDatasets.map((ds) => (
                    <div
                      key={ds.id}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">
                          {isFrench ? ds.nameFr : ds.nameEn}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                            {ds.holeCount} {isFrench ? 'trous' : 'holes'}
                          </span>
                          {ds.wetHolesCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-0.5">
                              <Droplet className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                              {ds.wetHolesCount} {isFrench ? 'humides' : 'wet'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        {isFrench ? ds.descriptionFr : ds.descriptionEn}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleLoadTestDataset(ds)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex-1 flex items-center justify-center gap-1 shadow-xs transition"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isFrench ? 'Charger dans FragMill' : 'Load Pattern'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadTestDatasetXlsx(ds)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 border border-slate-300 transition"
                          title={isFrench ? 'Télécharger le fichier Excel (.xlsx)' : 'Download Excel (.xlsx)'}
                        >
                          <Download className="w-3 h-3 text-slate-600" />
                          <span>.XLSX</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Download Sample Template */}
          <button
            type="button"
            onClick={() => downloadSampleDrillHoleTemplate(lang)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-300"
            title={isFrench ? 'Télécharger le modèle Excel vierge pré-formaté' : 'Download blank sample Excel template'}
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>{isFrench ? 'Modèle Vierge' : 'Blank Template'}</span>
          </button>

          {/* Import File Button */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            title={isFrench ? 'Importer votre fichier Excel (.xlsx) ou CSV de foration' : 'Import your drillhole Excel (.xlsx) or CSV file'}
          >
            {isUploading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{isFrench ? 'Importer Excel / CSV' : 'Upload Excel / CSV'}</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <button
            type="button"
            onClick={handleExportXlsx}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
            title={isFrench ? 'Exporter la grille actuelle en Excel' : 'Export current holes to Excel'}
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>.XLSX</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition"
            title={isFrench ? 'Exporter en CSV' : 'Export to CSV'}
          >
            <FileDown className="w-3.5 h-3.5 text-blue-400" />
            <span>.CSV</span>
          </button>

          {/* Add Hole Button */}
          <button
            type="button"
            onClick={handleAddNewHoleClick}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFrench ? 'Ajouter Trou' : 'Add Hole'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Holes */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isFrench ? 'Total Trous' : 'Total Holes'}
          </div>
          <div className="text-lg font-black text-slate-900 mt-0.5">
            {summary.totalHoles}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {summary.frontRowHolesCount} {isFrench ? 'de front (ligne 1)' : 'face holes (row 1)'}
          </div>
        </div>

        {/* Card 2: Explosive & Powder Factor */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isFrench ? 'Conso. Spécifique' : 'Powder Factor'}
          </div>
          <div className="text-lg font-black text-blue-700 mt-0.5">
            {summary.overallPowderFactorKgM3} <span className="text-xs font-bold text-slate-600">kg/m³</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {summary.totalExplosiveKg} kg total ({summary.overallPowderFactorKgTonne} kg/t)
          </div>
        </div>

        {/* Card 3: Depth Profile */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isFrench ? 'Profondeur Moy.' : 'Average Depth'}
          </div>
          <div className="text-lg font-black text-slate-900 mt-0.5">
            {summary.avgDepthM} <span className="text-xs font-bold text-slate-600">m</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Min: {summary.minDepthM}m &bull; Max: {summary.maxDepthM}m
          </div>
        </div>

        {/* Card 4: Water Presence */}
        <div className={`p-3 rounded-xl border ${
          summary.wetHolesCount > 0 ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Droplet className={`w-3 h-3 ${summary.wetHolesCount > 0 ? 'text-blue-500 fill-blue-500' : 'text-slate-400'}`} />
            {isFrench ? 'Trous Humides' : 'Wet Holes'}
          </div>
          <div className={`text-lg font-black mt-0.5 ${summary.wetHolesCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {summary.wetHolesCount} <span className="text-xs font-normal text-slate-500">/ {summary.totalHoles}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {summary.wetHolesCount > 0 ? (isFrench ? 'Charge émulsion requise' : 'Emulsion toe charge required') : (isFrench ? 'Tous trous secs' : 'All dry holes')}
          </div>
        </div>

        {/* Card 5: Rock Hardness UCS */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isFrench ? 'Dureté Moyenne' : 'Average Hardness'}
          </div>
          <div className="text-lg font-black text-slate-900 mt-0.5">
            {summary.avgUcsMPa} <span className="text-xs font-bold text-slate-600">MPa</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Range: {summary.minUcsMPa} - {summary.maxUcsMPa} MPa
          </div>
        </div>

        {/* Card 6: Timing Sequence */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isFrench ? 'Éventail Retards' : 'Delay Span'}
          </div>
          <div className="text-lg font-black text-purple-700 mt-0.5">
            0 - {summary.maxDelayMs} <span className="text-xs font-bold text-slate-600">ms</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {isFrench ? 'Amorçage électronique' : 'Electronic sequencing'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isFrench ? 'Rechercher par ID trou, roche, note...' : 'Search by hole ID, rock, notes...'}
            className="w-full bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-medium focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className="text-slate-400 text-[11px] mr-1">{isFrench ? 'Filtres :' : 'Filters:'}</span>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg transition ${
              filterMode === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {isFrench ? 'Tous' : 'All'} ({holes.length})
          </button>
          <button
            onClick={() => setFilterMode('face')}
            className={`px-2.5 py-1 rounded-lg transition ${
              filterMode === 'face' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {isFrench ? 'Front (L1)' : 'Face (Row 1)'} ({summary.frontRowHolesCount})
          </button>
          <button
            onClick={() => setFilterMode('wet')}
            className={`px-2.5 py-1 rounded-lg transition ${
              filterMode === 'wet' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {isFrench ? 'Humides' : 'Wet Holes'} ({summary.wetHolesCount})
          </button>
          <button
            onClick={() => setFilterMode('hard')}
            className={`px-2.5 py-1 rounded-lg transition ${
              filterMode === 'hard' ? 'bg-red-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {isFrench ? 'Roche Dure (>125 MPa)' : 'Hard (>125 MPa)'}
          </button>
        </div>
      </div>

      {/* Interactive Drillhole Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
        <table className="w-full text-left text-xs font-normal border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
              <th className="py-2.5 px-3">{isFrench ? 'ID Trou' : 'Hole ID'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Rangée' : 'Row'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Coord (X, Y, Z)' : 'Coord (X, Y, Z)'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Prof. & Diam.' : 'Depth & Diam'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Banquette x Esp.' : 'Burden x Space'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Eau' : 'Water'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Charge Pied / Col.' : 'Toe / Column Charge'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Total & Conso.' : 'Total & PF'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'UCS & RQD' : 'UCS & RQD'}</th>
              <th className="py-2.5 px-2.5">{isFrench ? 'Retard' : 'Delay'}</th>
              <th className="py-2.5 px-2.5 text-right">{isFrench ? 'Actions' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredHoles.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                  {isFrench ? 'Aucun trou ne correspond à ce filtre.' : 'No holes matching current filter criteria.'}
                </td>
              </tr>
            ) : (
              filteredHoles.map((h, idx) => {
                const isEven = idx % 2 === 0;
                const isWet = (h.waterDepthM || 0) > 0;
                const isFace = h.rowNumber === 1;

                // UCS hardness badge styling
                let ucsBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                if (h.ucsMPa > 125) ucsBadgeColor = 'bg-red-100 text-red-800 border-red-200';
                else if (h.ucsMPa >= 90) ucsBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';

                return (
                  <tr
                    key={h.holeId}
                    className={`hover:bg-blue-50/50 transition ${isEven ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    {/* Hole ID */}
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>{h.holeId}</span>
                        {isFace && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                            FACE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Row */}
                    <td className="py-2.5 px-2.5 text-slate-600 font-semibold whitespace-nowrap">
                      R{h.rowNumber}
                    </td>

                    {/* Coordinates */}
                    <td className="py-2.5 px-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {h.eastingX}, {h.northingY}, {h.elevationZ}
                    </td>

                    {/* Depth & Diameter */}
                    <td className="py-2.5 px-2.5 text-slate-800 font-medium whitespace-nowrap">
                      <span className="font-bold text-slate-900">{h.depthM}m</span>{' '}
                      <span className="text-slate-400 text-[10px]">({h.diameterMm}mm)</span>
                    </td>

                    {/* Burden x Spacing */}
                    <td className="py-2.5 px-2.5 text-slate-700 whitespace-nowrap">
                      {h.burdenM}m &times; {h.spacingM}m
                    </td>

                    {/* Water */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      {isWet ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Droplet className="w-2.5 h-2.5 fill-blue-600 text-blue-600" />
                          {h.waterDepthM}m
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">{isFrench ? 'Sec' : 'Dry'}</span>
                      )}
                    </td>

                    {/* Toe / Column Charge */}
                    <td className="py-2.5 px-2.5 text-slate-700 whitespace-nowrap text-[11px]">
                      <span className="font-semibold text-slate-900">{h.toeChargeKg}kg</span>{' '}
                      <span className="text-slate-400 text-[10px]">({h.toeExplosiveType?.slice(0, 8)})</span> +{' '}
                      <span className="font-semibold text-slate-900">{h.columnChargeKg}kg</span>{' '}
                      <span className="text-slate-400 text-[10px]">({h.columnExplosiveType?.slice(0, 4)})</span>
                    </td>

                    {/* Total Charge & PF */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{h.totalChargeKg} kg</div>
                      <div className="text-[10px] text-blue-700 font-semibold">{h.powderFactorKgPerM3} kg/m³</div>
                    </td>

                    {/* UCS & RQD */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ucsBadgeColor}`}>
                        {h.ucsMPa} MPa
                      </span>{' '}
                      <span className="text-[10px] text-slate-400">({h.rqdPercent}%)</span>
                    </td>

                    {/* Delay */}
                    <td className="py-2.5 px-2.5 whitespace-nowrap font-mono font-bold text-purple-700">
                      {h.detonatorDelayMs} ms
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHole({ ...h });
                            setIsNewHole(false);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title={isFrench ? 'Modifier ce trou' : 'Edit hole'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHole(h.holeId)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title={isFrench ? 'Supprimer ce trou' : 'Delete hole'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Synchronize Callout Banner */}
      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between text-xs text-blue-900 font-medium">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            {isFrench
              ? `Toutes les modifications apportées à ces ${holes.length} trous sont automatiquement propagées à tous les onglets (Krigeage de Blocs, Séquençage 3D, Plan de Fosse, Jumeau Broyage et Rapports).`
              : `All modifications to these ${holes.length} drill holes are automatically propagated to all app tabs (Block Model Kriging, 3D Timing, Bench Map, Comminution Twin, and Vault Reports).`}
          </span>
        </div>
      </div>

      {/* Edit / Add Hole Modal */}
      {editingHole && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <span>
                  {isNewHole
                    ? (isFrench ? 'Ajouter un Nouveau Trou' : 'Add New Drill Hole')
                    : (isFrench ? `Modifier le Trou ${editingHole.holeId}` : `Edit Drill Hole ${editingHole.holeId}`)}
                </span>
              </h4>
              <button
                onClick={() => setEditingHole(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHoleModal} className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Hole ID */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'ID Trou' : 'Hole ID'}</label>
                  <input
                    type="text"
                    required
                    value={editingHole.holeId}
                    onChange={(e) => setEditingHole({ ...editingHole, holeId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>

                {/* Row Number */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Numéro de Rangée' : 'Row Number'}</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editingHole.rowNumber}
                    onChange={(e) => setEditingHole({ ...editingHole, rowNumber: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Diameter */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Diamètre (mm)' : 'Diameter (mm)'}</label>
                  <input
                    type="number"
                    value={editingHole.diameterMm}
                    onChange={(e) => setEditingHole({ ...editingHole, diameterMm: parseInt(e.target.value) || 89 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Easting X */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Est X (m)' : 'Easting X (m)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingHole.eastingX}
                    onChange={(e) => setEditingHole({ ...editingHole, eastingX: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>

                {/* Northing Y */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Nord Y (m)' : 'Northing Y (m)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingHole.northingY}
                    onChange={(e) => setEditingHole({ ...editingHole, northingY: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>

                {/* Elevation Z */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Cote Z (m RL/NGF)' : 'Elevation Z (m RL)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingHole.elevationZ}
                    onChange={(e) => setEditingHole({ ...editingHole, elevationZ: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>

                {/* Depth */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Profondeur (m)' : 'Depth (m)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingHole.depthM}
                    onChange={(e) => setEditingHole({ ...editingHole, depthM: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Burden */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Banquette (m)' : 'Burden (m)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingHole.burdenM}
                    onChange={(e) => setEditingHole({ ...editingHole, burdenM: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Spacing */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Espacement (m)' : 'Spacing (m)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingHole.spacingM}
                    onChange={(e) => setEditingHole({ ...editingHole, spacingM: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Stemming */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Bourrage (m)' : 'Stemming (m)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingHole.stemmingM}
                    onChange={(e) => setEditingHole({ ...editingHole, stemmingM: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Water Depth */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? "Hauteur d'Eau (m)" : 'Water Depth (m)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={editingHole.waterDepthM}
                    onChange={(e) => setEditingHole({ ...editingHole, waterDepthM: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Detonator Delay */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Retard Détonateur (ms)' : 'Detonator Delay (ms)'}</label>
                  <input
                    type="number"
                    value={editingHole.detonatorDelayMs}
                    onChange={(e) => setEditingHole({ ...editingHole, detonatorDelayMs: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Toe Charge */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Charge de Pied (kg)' : 'Toe Charge (kg)'}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingHole.toeChargeKg}
                    onChange={(e) => {
                      const toe = parseFloat(e.target.value) || 0;
                      setEditingHole({
                        ...editingHole,
                        toeChargeKg: toe,
                        totalChargeKg: toe + (editingHole.columnChargeKg || 0),
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Column Charge */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Charge de Colonne (kg)' : 'Column Charge (kg)'}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingHole.columnChargeKg}
                    onChange={(e) => {
                      const col = parseFloat(e.target.value) || 0;
                      setEditingHole({
                        ...editingHole,
                        columnChargeKg: col,
                        totalChargeKg: (editingHole.toeChargeKg || 0) + col,
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Total Charge (Read-only sum) */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Charge Totale (kg)' : 'Total Charge (kg)'}</label>
                  <input
                    type="number"
                    readOnly
                    value={editingHole.totalChargeKg}
                    className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-blue-700"
                  />
                </div>

                {/* Rock Hardness UCS */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Dureté UCS (MPa)' : 'Hardness UCS (MPa)'}</label>
                  <input
                    type="number"
                    value={editingHole.ucsMPa}
                    onChange={(e) => setEditingHole({ ...editingHole, ucsMPa: parseInt(e.target.value) || 120 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Rock RQD */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Qualité RQD (%)' : 'RQD (%)'}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingHole.rqdPercent}
                    onChange={(e) => setEditingHole({ ...editingHole, rqdPercent: parseInt(e.target.value) || 75 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">{isFrench ? 'Remarques' : 'Notes'}</label>
                  <input
                    type="text"
                    value={editingHole.notes || ''}
                    onChange={(e) => setEditingHole({ ...editingHole, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingHole(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isFrench ? 'Enregistrer' : 'Save Hole'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
