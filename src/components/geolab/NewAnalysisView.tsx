import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import type {
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  GeoLabTestType,
  GeoLabAnalysis,
  QualityWarning,
} from '../../types/geolab';
import { getTestDefinition, GEOLAB_TEST_LIST } from '../../geolab/tests';
import { generateInputTemplateXlsx } from '../../geolab/engine/templateGenerator';
import { parseAndValidateUploadedExcel, type CellValidationError } from '../../geolab/engine/excelParser';
import {
  FlaskConical,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  Table as TableIcon,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  initialSampleId?: string;
  onAnalysisCreated: (analysisId: string) => void;
}

export const NewAnalysisView: React.FC<Props> = ({
  language,
  initialSampleId,
  onAnalysisCreated,
}) => {
  const [samples, setSamples] = useState<GeoLabSample[]>([]);
  const [projects, setProjects] = useState<GeoLabProject[]>([]);
  const [clients, setClients] = useState<GeoLabClient[]>([]);

  const [selectedSampleId, setSelectedSampleId] = useState<string>(initialSampleId || '');
  const [selectedTestType, setSelectedTestType] = useState<GeoLabTestType>('proctor');
  const [selectedStandard, setSelectedStandard] = useState<string>('NF P94-093');

  const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [validationErrors, setValidationErrors] = useState<CellValidationError[]>([]);

  // Computed state
  const [rawInput, setRawInput] = useState<any>(null);
  const [computedResults, setComputedResults] = useState<any>(null);
  const [qualityWarnings, setQualityWarnings] = useState<QualityWarning[]>([]);

  // Manual Form State
  const [manualParams, setManualParams] = useState<Record<string, any>>({});
  const [manualRows, setManualRows] = useState<any[]>([]);

  const testDef = getTestDefinition(selectedTestType);

  const loadHierarchy = async () => {
    const s = await db.samples.toArray();
    const p = await db.geolabProjects.toArray();
    const c = await db.clients.toArray();
    setSamples(s);
    setProjects(p);
    setClients(c);

    if (!selectedSampleId && s.length > 0) {
      setSelectedSampleId(s[0].id);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, []);

  useEffect(() => {
    setSelectedStandard(testDef.defaultStandard);
    // Initialize default manual form values
    const initParams: Record<string, any> = {};
    testDef.inputSchema.parameters.forEach((param) => {
      initParams[param.key] = param.defaultValue ?? '';
    });
    setManualParams(initParams);
    setManualRows(testDef.inputSchema.table?.defaultRows || []);
    setRawInput(null);
    setComputedResults(null);
    setQualityWarnings([]);
    setValidationErrors([]);
    setUploadedFileName('');
  }, [selectedTestType]);

  const handleDownloadTemplate = () => {
    const blob = generateInputTemplateXlsx(selectedTestType, language);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoLab_Template_${selectedTestType}_${language.toUpperCase()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);
    setValidationErrors([]);

    try {
      const buffer = await file.arrayBuffer();
      const parseResult = await parseAndValidateUploadedExcel(buffer, selectedTestType);

      if (!parseResult.success) {
        setValidationErrors(parseResult.errors);
        setRawInput(null);
        setComputedResults(null);
      } else {
        setRawInput(parseResult.rawInput);
        setComputedResults(parseResult.computedResults);
        setQualityWarnings(parseResult.warnings);
        if (parseResult.detectedStandard) {
          setSelectedStandard(parseResult.detectedStandard);
        }
      }
    } catch (err: any) {
      setValidationErrors([
        {
          sheet: file.name,
          cell: 'A1',
          message: {
            en: `Failed to process Excel file: ${err.message}`,
            fr: `Erreur lors du traitement du fichier Excel : ${err.message}`,
          },
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualCalculate = () => {
    const inputObj = {
      ...manualParams,
      [testDef.inputSchema.table?.key || 'points']: manualRows,
    };
    try {
      const results = testDef.calculate(inputObj, selectedStandard);
      const warnings = testDef.checks(inputObj, results);
      setRawInput(inputObj);
      setComputedResults(results);
      setQualityWarnings(warnings);
    } catch (err: any) {
      alert(`Calculation error: ${err.message}`);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!selectedSampleId || !rawInput || !computedResults) {
      alert(language === 'fr' ? 'Veuillez calculer ou importer les résultats avant d\'enregistrer.' : 'Please calculate or upload valid results before saving.');
      return;
    }

    const currentYear = new Date().getFullYear();
    const allAnalyses = await db.analyses.toArray();
    const count = allAnalyses.length + 1;
    const reportNumber = `GL-${currentYear}-${String(count).padStart(4, '0')}`;

    const newAnalysis: GeoLabAnalysis = {
      id: `analysis-${Date.now()}`,
      sampleId: selectedSampleId,
      testType: selectedTestType,
      standard: selectedStandard,
      reportNumber,
      version: 1,
      status: 'draft',
      testedDate: new Date().toISOString().substring(0, 10),
      rawInput,
      computedResults,
      qualityWarnings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.analyses.put(newAnalysis);
    onAnalysisCreated(newAnalysis.id);
  };

  const activeSample = samples.find((s) => s.id === selectedSampleId);
  const activeProject = activeSample ? projects.find((p) => p.id === activeSample.projectId) : null;
  const activeClient = activeProject ? clients.find((c) => c.id === activeProject.clientId) : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-400" />
            {language === 'fr' ? 'Nouvelle Analyse Géotechnique' : 'New Geotechnical Test Analysis'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {language === 'fr'
              ? 'Sélectionnez un échantillon, téléchargez ou saisissez les données d\'essais, et lancez le calcul automatique.'
              : 'Select a sample, upload an Excel workbook or enter measurements, and trigger automated calculations.'}
          </p>
        </div>
      </div>

      {/* Step 1 & 2 Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-300">
          1. {language === 'fr' ? 'Échantillon & Type d\'Essai' : 'Sample & Test Type'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Sample Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {language === 'fr' ? 'Échantillon à analyser *' : 'Target Sample *'}
            </label>
            <select
              value={selectedSampleId}
              onChange={(e) => setSelectedSampleId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
            >
              {samples.map((s) => {
                const p = projects.find((proj) => proj.id === s.projectId);
                return (
                  <option key={s.id} value={s.id}>
                    {s.sampleId} {s.depth ? `(${s.depth})` : ''} - {p?.projectName || ''}
                  </option>
                );
              })}
            </select>
            {activeSample && (
              <p className="text-[11px] text-slate-400 mt-1">
                {language === 'fr' ? 'Client' : 'Client'}: <span className="text-white">{activeClient?.companyName}</span> | {language === 'fr' ? 'Lieu' : 'Site'}: <span className="text-white">{activeSample.location || activeProject?.siteLocation}</span>
              </p>
            )}
          </div>

          {/* Test Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {language === 'fr' ? 'Essai de laboratoire *' : 'Laboratory Test *'}
            </label>
            <select
              value={selectedTestType}
              onChange={(e) => setSelectedTestType(e.target.value as GeoLabTestType)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
            >
              {GEOLAB_TEST_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name[language]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">{testDef.description[language]}</p>
          </div>

          {/* Reference Standard */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              {language === 'fr' ? 'Norme de référence *' : 'Reference Standard *'}
            </label>
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium"
            >
              {testDef.standards.map((st) => (
                <option key={st.id} value={st.code}>
                  {st.title[language]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {language === 'fr' ? 'Validée par l\'ingénieur sur le procès-verbal' : 'Confirmed on official test report'}
            </p>
          </div>
        </div>
      </div>

      {/* Step 3: Input Mode Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInputMode('upload')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                inputMode === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Importer Fichier Excel (.xlsx)' : 'Upload Excel Workbook (.xlsx)'}
            </button>
            <button
              onClick={() => setInputMode('manual')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                inputMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Saisie Manuelle' : 'Manual Entry'}
            </button>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            {language === 'fr' ? 'Télécharger Modèle Excel' : 'Download Input Template'}
          </button>
        </div>

        {/* Upload Mode Area */}
        {inputMode === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center transition bg-slate-950/40">
              <FileSpreadsheet className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-white mb-1">
                {language === 'fr'
                  ? 'Glissez-déposez le fichier Excel rempli ou Classeur1.xlsx'
                  : 'Drag & drop completed template or lab recap workbook'}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {language === 'fr'
                  ? 'Formats acceptés : .xlsx, .xls (Vérification et calculs automatiques à la cellule)'
                  : 'Supported formats: .xlsx, .xls (Cell-level validation & instant processing)'}
              </p>

              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer shadow transition">
                <Upload className="w-4 h-4" />
                {isUploading ? (language === 'fr' ? 'Traitement...' : 'Parsing...') : (language === 'fr' ? 'Parcourir...' : 'Browse File...')}
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              {uploadedFileName && (
                <p className="text-xs text-emerald-400 font-medium mt-3">
                  ✓ {uploadedFileName}
                </p>
              )}
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {language === 'fr'
                      ? `${validationErrors.length} erreur(s) de validation détectée(s) :`
                      : `${validationErrors.length} validation error(s) found:`}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-red-300 pl-6">
                  {validationErrors.map((err, idx) => (
                    <div key={idx}>
                      <span className="font-mono bg-red-900/60 px-1 py-0.5 rounded text-[11px] mr-2">
                        {err.sheet} ! {err.cell}
                      </span>
                      <span>{err.message[language]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Entry Form */}
        {inputMode === 'manual' && (
          <div className="space-y-4">
            {/* Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-950/40 p-4 rounded-lg border border-slate-800">
              {testDef.inputSchema.parameters.map((param) => (
                <div key={param.key}>
                  <label className="block text-slate-300 font-medium mb-1">
                    {param.label[language]} {param.unit ? `(${param.unit})` : ''}
                  </label>
                  {param.type === 'select' ? (
                    <select
                      value={manualParams[param.key] || ''}
                      onChange={(e) => setManualParams({ ...manualParams, [param.key]: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white"
                    >
                      {param.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label[language]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={param.type}
                      value={manualParams[param.key] ?? ''}
                      onChange={(e) =>
                        setManualParams({
                          ...manualParams,
                          [param.key]: param.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Table Entry */}
            {testDef.inputSchema.table && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">
                    {testDef.inputSchema.table.label[language]}
                  </h4>
                  <button
                    onClick={() => {
                      const newRow: any = {};
                      testDef.inputSchema.table?.columns.forEach((c) => {
                        newRow[c.key] = '';
                      });
                      setManualRows([...manualRows, newRow]);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded text-xs"
                  >
                    + {language === 'fr' ? 'Ajouter ligne' : 'Add row'}
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800 text-slate-300 font-semibold">
                      <tr>
                        {testDef.inputSchema.table.columns.map((c) => (
                          <th key={c.key} className="px-3 py-2">
                            {c.label[language]} {c.unit ? `(${c.unit})` : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {manualRows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {testDef.inputSchema.table!.columns.map((c) => (
                            <td key={c.key} className="px-2 py-1.5">
                              <input
                                type={c.type}
                                value={row[c.key] ?? ''}
                                onChange={(e) => {
                                  const updated = [...manualRows];
                                  updated[rIdx][c.key] =
                                    c.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                                  setManualRows(updated);
                                }}
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleManualCalculate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow transition"
                  >
                    {language === 'fr' ? 'Calculer les Résultats' : 'Compute Results'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Results Preview & Quality Warnings */}
      {computedResults && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {language === 'fr' ? 'Résultats Calculés & Vérifications Qualité' : 'Computed Results & QA Checks'}
            </h3>
            <button
              onClick={handleSaveAnalysis}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition"
            >
              <Save className="w-4 h-4" />
              {language === 'fr' ? 'Enregistrer l\'Analyse' : 'Save Analysis'}
            </button>
          </div>

          {/* Quality Warnings */}
          {qualityWarnings.length > 0 && (
            <div className="space-y-2">
              {qualityWarnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
                    w.level === 'error'
                      ? 'bg-red-950/40 border border-red-800 text-red-300'
                      : 'bg-amber-950/40 border border-amber-800 text-amber-300'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{w.message[language]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Key KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedTestType === 'proctor' && (
              <>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">w_opm (OPM)</span>
                  <span className="text-lg font-bold text-white">{computedResults.opmMoisturePercent} %</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">ρd_opm</span>
                  <span className="text-lg font-bold text-white">{computedResults.maxDryDensityGcm3} g/cm³</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">95% ρd (Cible)</span>
                  <span className="text-lg font-bold text-white">{computedResults.targetDryDensityGcm3} g/cm³</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">R² Ajustement</span>
                  <span className="text-lg font-bold text-emerald-400">{computedResults.fittedCoefficients.r2}</span>
                </div>
              </>
            )}

            {selectedTestType === 'grain_size' && (
              <>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Passant 2 mm</span>
                  <span className="text-lg font-bold text-white">{computedResults.passing2mmPercent} %</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Passant 0,08 mm (Fines)</span>
                  <span className="text-lg font-bold text-white">{computedResults.passing008mmPercent} %</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Classification LCPC</span>
                  <span className="text-sm font-bold text-white truncate block">{computedResults.lcpcClassification}</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Cu / Cc</span>
                  <span className="text-sm font-bold text-white">
                    {computedResults.cu ? `Cu=${computedResults.cu}` : '-'} / {computedResults.cc ? `Cc=${computedResults.cc}` : '-'}
                  </span>
                </div>
              </>
            )}

            {selectedTestType === 'water_content' && (
              <>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Teneur en eau moyenne w</span>
                  <span className="text-lg font-bold text-white">{computedResults.meanWaterContentPercent} %</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Écart entre prises (Δw)</span>
                  <span className="text-lg font-bold text-white">{computedResults.differenceBetweenSpecimensPercent} %</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">Répétabilité</span>
                  <span className={`text-sm font-bold ${computedResults.repeatabilityAccepted ? 'text-emerald-400' : 'text-red-400'}`}>
                    {computedResults.repeatabilityAccepted ? 'CONFORME' : 'NON CONFORME'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
