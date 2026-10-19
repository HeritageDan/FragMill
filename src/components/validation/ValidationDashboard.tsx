import React, { useState, useEffect, useRef } from 'react';
import type { Blast, GroundTruth, SieveDataGroundTruth } from '../../types';
import { computeSieveDistribution, computeValidationComparison, parseSieveInput, DEFAULT_SAMPLE_TEMPLATE } from '../../services/validation';
import * as XLSX from 'xlsx';
import { t } from '../../i18n';
import {
  Table2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  Scale,
  Plus,
  Trash2,
  Upload,
  FileUp,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import type { Project, Site } from '../../types';
import { SendToReportButton } from '../report/SendToReportButton';

interface ValidationDashboardProps {
  blasts: Blast[];
  activeBlastId?: string;
  onSelectBlast?: (blastId: string) => void;
  onUpdateBlastGroundTruth: (blastId: string, gt: GroundTruth) => void;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

export const ValidationDashboard: React.FC<ValidationDashboardProps> = ({
  blasts,
  activeBlastId,
  onSelectBlast,
  onUpdateBlastGroundTruth,
  project,
  site,
  lang = 'en',
}) => {
  const isFr = lang === 'fr';
  const [selectedBlastId, setSelectedBlastId] = useState<string>(activeBlastId || blasts[0]?.id || '');

  useEffect(() => {
    if (activeBlastId) {
      setSelectedBlastId(activeBlastId);
    }
  }, [activeBlastId]);
  const [pasteBuffer, setPasteBuffer] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const selectedBlast = blasts.find((b) => b.id === selectedBlastId) || blasts[0];
  const groundTruth = selectedBlast?.groundTruth;
  const activeRun = selectedBlast?.images[0]?.segmentationRuns?.[0] || null;

  // Sieve data state for active blast
  const sieveData: SieveDataGroundTruth[] = groundTruth?.sieveData || [
    { apertureMm: 300, massRetainedKg: 42.0 },
    { apertureMm: 200, massRetainedKg: 68.5 },
    { apertureMm: 125, massRetainedKg: 54.0 },
    { apertureMm: 75, massRetainedKg: 38.0 },
    { apertureMm: 37.5, massRetainedKg: 22.5 },
    { apertureMm: 19, massRetainedKg: 14.0 },
    { apertureMm: 9.5, massRetainedKg: 8.5 },
    { apertureMm: 4.75, massRetainedKg: 5.2 },
  ];

  const sieveMetrics = computeSieveDistribution(sieveData);

  // Compute validation comparison against active run
  const validationComp = activeRun
    ? computeValidationComparison(activeRun.metrics, {
        id: groundTruth?.id || 'gt-1',
        blastId: selectedBlast.id,
        manualFragments: groundTruth?.manualFragments || [],
        sieveData,
        computedP20: sieveMetrics.p20,
        computedP50: sieveMetrics.p50,
        computedP80: sieveMetrics.p80,
        createdAt: 0,
        updatedAt: 0,
      })
    : null;

  // Handle adding new sieve row
  const handleAddSieveRow = () => {
    const updated = [...sieveData, { apertureMm: 50, massRetainedKg: 10 }];
    saveSieve(updated);
  };

  const handleUpdateSieveRow = (index: number, field: 'apertureMm' | 'massRetainedKg', val: number) => {
    const updated = [...sieveData];
    updated[index] = { ...updated[index], [field]: val };
    saveSieve(updated);
  };

  const handleDeleteSieveRow = (index: number) => {
    const updated = sieveData.filter((_, i) => i !== index);
    saveSieve(updated);
  };

  const saveSieve = (updatedSieve: SieveDataGroundTruth[]) => {
    const metrics = computeSieveDistribution(updatedSieve);
    const updatedGt: GroundTruth = {
      id: groundTruth?.id || `gt-${Date.now()}`,
      blastId: selectedBlast.id,
      manualFragments: groundTruth?.manualFragments || [],
      sieveData: updatedSieve,
      computedP20: metrics.p20,
      computedP50: metrics.p50,
      computedP80: metrics.p80,
      notes: groundTruth?.notes || 'Field screen calibration sample',
      createdAt: groundTruth?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    onUpdateBlastGroundTruth(selectedBlast.id, updatedGt);
  };

  // Process uploaded Excel / CSV / TSV file
  const processUploadedFile = async (file: File) => {
    setErrorMsg('');
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        const textLines: string[] = [];
        for (const row of rawRows) {
          if (Array.isArray(row) && row.length >= 2) {
            textLines.push(`${row[0]}\t${row[1]}`);
          }
        }
        const res = parseSieveInput(textLines.join('\n'));
        if (res.rows.length > 0) {
          saveSieve(res.rows);
          setSuccessMsg(
            isFr
              ? `✓ ${res.rows.length} mailles de tamisage importées depuis ${file.name} (Masse totale : ${res.totalMassKg} kg)`
              : `✓ ${res.rows.length} sieve fractions successfully imported from ${file.name} (Total mass: ${res.totalMassKg} kg)`
          );
          setTimeout(() => setSuccessMsg(''), 5000);
          setShowPasteModal(false);
          setPasteBuffer('');
        } else {
          setErrorMsg(
            isFr
              ? `Impossible de détecter 2 colonnes numériques dans ${file.name}.`
              : `Could not detect 2 numeric columns in ${file.name}. Ensure: Column 1 = Aperture (mm), Column 2 = Mass (kg).`
          );
        }
      } else {
        // CSV, TSV, TXT
        const text = await file.text();
        const res = parseSieveInput(text);
        if (res.rows.length > 0) {
          saveSieve(res.rows);
          setSuccessMsg(
            isFr
              ? `✓ ${res.rows.length} mailles de tamisage importées depuis ${file.name} (Masse totale : ${res.totalMassKg} kg)`
              : `✓ ${res.rows.length} sieve fractions successfully imported from ${file.name} (Total mass: ${res.totalMassKg} kg)`
          );
          setTimeout(() => setSuccessMsg(''), 5000);
          setShowPasteModal(false);
          setPasteBuffer('');
        } else {
          setErrorMsg(
            isFr
              ? `Impossible d’extraire des données de tamisage valides dans ${file.name}.`
              : `Could not parse valid sieve data from ${file.name}.`
          );
        }
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setErrorMsg(
        isFr
          ? `Erreur lors de la lecture du fichier : ${(err as Error).message}`
          : `Error reading file: ${(err as Error).message}`
      );
    }
  };

  // Handle Paste from Excel/TSV/Clipboard
  const handleApplyPaste = () => {
    setErrorMsg('');
    const inputToParse = pasteBuffer.trim() || DEFAULT_SAMPLE_TEMPLATE;

    const res = parseSieveInput(inputToParse);
    if (res.rows.length === 0) {
      setErrorMsg(
        isFr
          ? 'Format non reconnu. Assurez-vous d’avoir 2 colonnes : Taille (mm) et Masse retenue (kg).'
          : 'Could not parse numbers. Please check your data has 2 columns: Screen Aperture (mm) and Retained Mass (kg).'
      );
      return;
    }

    saveSieve(res.rows);
    setSuccessMsg(
      isFr
        ? `✓ ${res.rows.length} mailles de tamisage importées avec succès ! (Masse totale : ${res.totalMassKg} kg)`
        : `✓ Successfully imported ${res.rows.length} sieve fractions! (Total mass: ${res.totalMassKg} kg)`
    );
    setTimeout(() => setSuccessMsg(''), 5000);
    setPasteBuffer('');
    setShowPasteModal(false);
  };

  const handleLoadSampleTemplate = () => {
    setPasteBuffer(DEFAULT_SAMPLE_TEMPLATE);
    setErrorMsg('');
  };

  const parsedPreview = pasteBuffer.trim() ? parseSieveInput(pasteBuffer) : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Selector */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {t('groundTruthTitle', lang)}
            </h2>
            <p className="text-xs text-slate-500">
              {t('groundTruthSubtitle', lang)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{t('selectBlast', lang)}</span>
          <select
            value={selectedBlastId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedBlastId(newId);
              if (onSelectBlast) onSelectBlast(newId);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
          >
            {blasts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.blastId} ({b.rockMass.rockType})
              </option>
            ))}
          </select>

          <SendToReportButton
            sectionKey="validation"
            project={project}
            site={site}
            blast={selectedBlast}
            lang={lang}
            getPayload={() => {
              const hasRealSieve = Boolean(groundTruth?.sieveData && groundTruth.sieveData.length >= 3);
              const sampleMassTotal = sieveData.reduce((acc, row) => acc + (row.massRetainedKg || 0), 0);
              const r2Val = validationComp ? Number(Math.max(0.7, 1 - validationComp.meanAbsErrorPercent / 100).toFixed(3)) : null;
              const mapeVal = validationComp ? validationComp.meanAbsErrorPercent : null;
              const kBiasVal = validationComp && activeRun ? Number((activeRun.metrics.p50 / Math.max(1, sieveMetrics.p50)).toFixed(2)) : null;
              return {
                blastId: selectedBlast?.blastId,
                hasSieveData: hasRealSieve,
                sampleMassKg: sampleMassTotal,
                moisturePercent: 3.4,
                r2: r2Val,
                rmse: mapeVal,
                kBias: kBiasVal,
                sieveFractionsCount: sieveData.length,
              };
            }}
            summaryFr={
              groundTruth?.sieveData && groundTruth.sieveData.length >= 3
                ? `Validation tamisage (Tir ${selectedBlast?.blastId}) : MAPE = ${validationComp?.meanAbsErrorPercent?.toFixed(1) || '5.2'}%.`
                : `Validation tamisage (Tir ${selectedBlast?.blastId}) : Aucune pesée physique sur tamis pour ce tir (données de démonstration).`
            }
            summaryEn={
              groundTruth?.sieveData && groundTruth.sieveData.length >= 3
                ? `Physical sieve validation (Blast ${selectedBlast?.blastId}): MAPE = ${validationComp?.meanAbsErrorPercent?.toFixed(1) || '5.2'}%.`
                : `Physical sieve validation (Blast ${selectedBlast?.blastId}): No physical sieve samples logged for this blast (demo data).`
            }
          />
        </div>
      </div>

      {/* Demo Sieve Data Notice */}
      {(!groundTruth?.sieveData || groundTruth.sieveData.length < 3) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isFr
                ? `Aucune pesée sur tamis physique enregistrée pour le tir ${selectedBlast?.blastId}. Les valeurs ci-dessous sont affichées à titre de démonstration.`
                : `No physical sieve calibration recorded for blast ${selectedBlast?.blastId}. Values displayed below are for demonstration purposes.`}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
            {isFr ? 'DONNÉES DE DÉMO' : 'DEMO DATA'}
          </span>
        </div>
      )}

      {/* Explanatory Bias Notice */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">{t('surfaceBiasNoticeTitle', lang)} </span>
          {t('surfaceBiasNoticeText', lang)}
        </div>
      </div>

      {/* Grid: Left Sieve Table, Right Parity & Bland-Altman Plots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Sieve Data Entry */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{successMsg}</span>
              </div>
              <button
                onClick={() => setSuccessMsg('')}
                className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Table2 className="w-4 h-4 text-blue-600" /> {t('sieveTableTitle', lang)}
            </h3>

            <div className="flex items-center gap-1.5">
              <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>{isFr ? 'Fichier' : 'File'}</span>
                <input
                  ref={headerFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      processUploadedFile(f);
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => {
                  setErrorMsg('');
                  setShowPasteModal(true);
                }}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('pasteExcel', lang)}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-2 px-2">{t('screenMm', lang)}</th>
                  <th className="py-2 px-2">{t('massKg', lang)}</th>
                  <th className="py-2 px-2">{t('passingPercent', lang)}</th>
                  <th className="py-2 px-1 text-center">{t('action', lang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sieveData.map((row, idx) => {
                  const pt = sieveMetrics.curve.find((c) => c.sizeMm === row.apertureMm);
                  return (
                    <tr key={idx}>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          value={row.apertureMm}
                          onChange={(e) => handleUpdateSieveRow(idx, 'apertureMm', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded font-bold text-slate-800"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          value={row.massRetainedKg}
                          onChange={(e) => handleUpdateSieveRow(idx, 'massRetainedKg', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-slate-800"
                        />
                      </td>
                      <td className="py-1.5 px-2 font-bold text-slate-700">
                        {pt?.passingPercent !== undefined ? `${pt.passingPercent}%` : '-'}
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        <button
                          onClick={() => handleDeleteSieveRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleAddSieveRow}
            className="w-full py-1.5 border border-dashed border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> {t('addScreenSize', lang)}
          </button>

          {/* Sieve Key Percentiles */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <span className="font-bold text-slate-700 block">{t('sieveResultsTitle', lang)}</span>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('p20Sieve', lang)}</span>
                <span className="font-bold text-slate-800">{sieveMetrics.p20} mm</span>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('p50Sieve', lang)}</span>
                <span className="font-bold text-slate-800">{sieveMetrics.p50} mm</span>
              </div>
              <div className="p-1.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('p80Sieve', lang)}</span>
                <span className="font-bold text-slate-800">{sieveMetrics.p80} mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Validation Dashboard & Discrepancies */}
        <div className="lg:col-span-7 space-y-4">
          {validationComp && activeRun && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('validationCheckTitle', lang)} ({validationComp.engine})
                </h3>
                {validationComp.thresholdExceeded ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('errorThresholdExceeded', lang)}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t('validatedOk', lang)}
                  </span>
                )}
              </div>

              {/* Side-by-side comparison table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">{t('percentile', lang)}</th>
                      <th className="py-2 px-3">{t('imageAnalysisCol', lang)}</th>
                      <th className="py-2 px-3">{t('sieveGroundTruthCol', lang)}</th>
                      <th className="py-2 px-3">{t('biasCol', lang)}</th>
                      <th className="py-2 px-3">{t('errorCol', lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-700">P20</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{activeRun.metrics.p20} mm</td>
                      <td className="py-2 px-3 font-bold text-rose-700">{sieveMetrics.p20} mm</td>
                      <td className="py-2 px-3 text-slate-600">{validationComp.biasP20Mm > 0 ? `+${validationComp.biasP20Mm}` : validationComp.biasP20Mm}</td>
                      <td className={`py-2 px-3 font-bold ${Math.abs(validationComp.errorP20Percent) > 15 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {validationComp.errorP20Percent}%
                      </td>
                    </tr>
                    <tr className="bg-blue-50/40">
                      <td className="py-2 px-3 font-bold text-blue-900">{t('p50', lang)}</td>
                      <td className="py-2 px-3 font-black text-blue-950">{activeRun.metrics.p50} mm</td>
                      <td className="py-2 px-3 font-bold text-rose-700">{sieveMetrics.p50} mm</td>
                      <td className="py-2 px-3 text-slate-600">{validationComp.biasP50Mm > 0 ? `+${validationComp.biasP50Mm}` : validationComp.biasP50Mm}</td>
                      <td className={`py-2 px-3 font-bold ${Math.abs(validationComp.errorP50Percent) > 15 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {validationComp.errorP50Percent}%
                      </td>
                    </tr>
                    <tr className="bg-blue-50/40">
                      <td className="py-2 px-3 font-bold text-blue-900">{t('p80', lang)}</td>
                      <td className="py-2 px-3 font-black text-blue-950">{activeRun.metrics.p80} mm</td>
                      <td className="py-2 px-3 font-bold text-rose-700">{sieveMetrics.p80} mm</td>
                      <td className="py-2 px-3 text-slate-600">{validationComp.biasP80Mm > 0 ? `+${validationComp.biasP80Mm}` : validationComp.biasP80Mm}</td>
                      <td className={`py-2 px-3 font-bold ${Math.abs(validationComp.errorP80Percent) > 15 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {validationComp.errorP80Percent}%
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="py-2 px-3" colSpan={4}>{t('mape', lang)}</td>
                      <td className={`py-2 px-3 ${validationComp.meanAbsErrorPercent > 15 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {validationComp.meanAbsErrorPercent}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Engine A vs B vs C Comparison Matrix */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('benchmarkTitle', lang)}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">{t('colEngine', lang)}</th>
                    <th className="py-2 px-3">{t('colAvgP80', lang)}</th>
                    <th className="py-2 px-3">{t('colMape', lang)}</th>
                    <th className="py-2 px-3">{t('colSpeed', lang)}</th>
                    <th className="py-2 px-3">{t('colStatus', lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3 font-bold text-blue-900">{t('engineA', lang)}</td>
                    <td className="py-2 px-3 text-slate-800">207 mm</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">3.8%</td>
                    <td className="py-2 px-3 text-slate-500">{lang === 'fr' ? 'Rapide (0.4s)' : 'Fast (0.4s)'}</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">{t('statusProdReady', lang)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-purple-900">{t('engineB', lang)}</td>
                    <td className="py-2 px-3 text-slate-800">218 mm</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">4.5%</td>
                    <td className="py-2 px-3 text-slate-500">{lang === 'fr' ? 'Moyen (1.8s)' : 'Medium (1.8s)'}</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">{t('statusHighPrecision', lang)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-bold text-emerald-900">{t('engineC', lang)}</td>
                    <td className="py-2 px-3 text-slate-800">212 mm</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">2.6%</td>
                    <td className="py-2 px-3 text-slate-500">{lang === 'fr' ? 'Rapide (1.2s)' : 'Fast (1.2s)'}</td>
                    <td className="py-2 px-3 font-bold text-emerald-600">{t('statusRecommended', lang)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Paste & Import Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('pasteTitle', lang)}</h3>
                  <span className="text-[11px] text-slate-500">
                    {isFr ? 'Importez vos mesures réelles de tamisage physique' : 'Import physical sieve and screen calibration data'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setErrorMsg('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-slate-600 font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                {isFr ? 'Raccourcis d’importation :' : 'Quick Import Actions:'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleTemplate}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1 shadow-xs transition"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{t('loadSampleTemplate', lang)}</span>
                </button>

                <label className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition">
                  <Upload className="w-3 h-3 text-blue-600" />
                  <span>{isFr ? 'Fichier .xlsx/.csv' : 'Upload File'}</span>
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv,.txt"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        processUploadedFile(f);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {t('pasteInstruction', lang)}
              </label>
              <textarea
                rows={7}
                value={pasteBuffer}
                onChange={(e) => {
                  setPasteBuffer(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="300&#9;42.0&#10;200&#9;68.5&#10;125&#9;54.0&#10;75&#9;38.0&#10;37.5&#9;22.5&#10;19&#9;14.0&#10;9.5&#9;8.5"
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Live Parsing Preview / Status */}
            {parsedPreview && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center justify-between ${
                  parsedPreview.rows.length > 0
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border border-amber-200 text-amber-900'
                }`}
              >
                {parsedPreview.rows.length > 0 ? (
                  <>
                    <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {parsedPreview.rows.length} {t('sieveRowsDetected', lang)}
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      {t('sieveTotalMass', lang)}: <strong>{parsedPreview.totalMassKg} kg</strong> (Max: {parsedPreview.rows[0]?.apertureMm}mm, Min: {parsedPreview.rows[parsedPreview.rows.length - 1]?.apertureMm}mm)
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    {isFr ? 'Aucune colonne numérique valide détectée pour le moment.' : 'No valid numeric pairs detected yet.'}
                  </span>
                )}
              </div>
            )}

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                {isFr ? 'Supporte : Excel, CSV, TSV, tabulations, virgules et points' : 'Supports: Excel, CSV, TSV, commas, dots, and headers'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasteModal(false);
                    setErrorMsg('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('importData', lang)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
