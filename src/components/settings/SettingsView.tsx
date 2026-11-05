import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../../types';
import { runCalibrationSelfTest, type SelfTestReport } from '../../services/selftest';
import { getDownloadedModels, deleteModelCache, checkWebGpuSupport, type ModelMetadata } from '../../services/aiSegmentation';
import { generatePrintableA4CalibrationSheet, exportProjectBackupJson, importProjectBackupJson } from '../../services/export';
import { db } from '../../db';
import { t } from '../../i18n';
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Printer,
  Sparkles,
  Database,
  Cpu,
  RefreshCw,
  Upload,
  FlaskConical,
  ExternalLink,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { testAiApiKey, type AiTestResult } from '../../services/gemini';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  lang?: 'en' | 'fr';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  lang = 'en',
}) => {
  const [selfTestReport, setSelfTestReport] = useState<SelfTestReport | null>(null);
  const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [hasWebGpu, setHasWebGpu] = useState(false);
  const [storageEstimateMb, setStorageEstimateMb] = useState<string>('0');
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [apiKeyTestResult, setApiKeyTestResult] = useState<AiTestResult | null>(null);

  const isClaudeProvider = (settings.aiProvider || 'anthropic') === 'anthropic';
  const currentApiKey = isClaudeProvider
    ? (settings.anthropicApiKey || settings.geminiApiKey || '')
    : (settings.geminiApiKey || settings.anthropicApiKey || '');

  const handleTestApiKey = async () => {
    if (!currentApiKey.trim()) {
      setApiKeyTestResult({
        success: false,
        message:
          lang === 'fr'
            ? isClaudeProvider
              ? 'Veuillez d\'abord saisir votre clé API Anthropic Claude (commençant par sk-ant-...).'
              : 'Veuillez d\'abord saisir une clé API Gemini (commençant par AIzaSy...).'
            : isClaudeProvider
              ? 'Please enter an Anthropic Claude API key first (starting with sk-ant-...).'
              : 'Please enter a Gemini API key first (starting with AIzaSy...).',
        provider: settings.aiProvider || 'anthropic',
      });
      return;
    }
    setIsTestingApiKey(true);
    setApiKeyTestResult(null);
    try {
      const activeModel = isClaudeProvider
        ? (settings.claudeModel || 'claude-3-5-haiku-20241022')
        : (settings.geminiModelFlash || 'gemini-1.5-flash');

      const res = await testAiApiKey(currentApiKey.trim(), activeModel, settings.aiProvider || 'anthropic');
      setApiKeyTestResult(res);

      if (res.success && res.model) {
        if (isClaudeProvider && res.model !== settings.claudeModel) {
          onUpdateSettings({ ...settings, claudeModel: res.model });
        } else if (!isClaudeProvider && res.model !== settings.geminiModelFlash) {
          onUpdateSettings({ ...settings, geminiModelFlash: res.model });
        }
      }
    } catch (err: any) {
      setApiKeyTestResult({
        success: false,
        message: err.message || (lang === 'fr' ? 'Erreur lors du test de connexion.' : 'Error during connection test.'),
      });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  useEffect(() => {
    loadModelsAndGpu();
    checkStorage();
  }, []);

  const loadModelsAndGpu = async () => {
    const gpu = await checkWebGpuSupport();
    setHasWebGpu(gpu);
    const m = await getDownloadedModels();
    setModels(m);
  };

  const checkStorage = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMb = (estimate.usage || 0) / (1024 * 1024);
      setStorageEstimateMb(usedMb.toFixed(1));
    }
  };

  const handleRunSelfTest = async () => {
    setIsRunningSelfTest(true);
    const rep = await runCalibrationSelfTest();
    setSelfTestReport(rep);
    setIsRunningSelfTest(false);
  };

  const handleDeleteModel = async (id: string) => {
    await deleteModelCache(id);
    await loadModelsAndGpu();
  };

  const handleDownloadA4Target = () => {
    const blob = generatePrintableA4CalibrationSheet(lang);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lang === 'fr' ? 'FraGeo_Mire_Etalonnage_A4.pdf' : 'FraGeo_A4_Calibration_Target.pdf';
    a.click();
  };

  const handleExportBackup = async () => {
    const projects = await db.projects.toArray();
    if (projects.length === 0) return;
    const jsonStr = await exportProjectBackupJson(projects[0].id);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FraGeo_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setBackupStatus(lang === 'fr' ? 'Projet exporté avec succès !' : 'Project exported successfully!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        await importProjectBackupJson(text);
        setBackupStatus(lang === 'fr' ? 'Projet restauré avec succès ! Actualisation...' : 'Project restored successfully! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err: any) {
        setBackupStatus(lang === 'fr' ? `Échec de l'importation : ${err.message}` : `Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    const confirmMsg = lang === 'fr'
      ? 'Êtes-vous sûr de vouloir effacer définitivement tous les projets, tirs et photos de cet appareil ?'
      : 'Are you sure you want to permanently erase all FraGeo Suite projects, blasts, and images from this device?';
    if (window.confirm(confirmMsg)) {
      await db.delete();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <Settings className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {t('settingsTitle', lang)}
          </h2>
          <p className="text-xs text-slate-500">
            {t('settingsSubtitle', lang)}
          </p>
        </div>
      </div>

      {/* Preferences Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Language & Theme */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t('langThemeTitle', lang)}
          </h3>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('langLabel', lang)}</label>
              <select
                value={settings.language}
                onChange={(e) => onUpdateSettings({ ...settings, language: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="en">English (US / Mining Standard)</option>
                <option value="fr">Français (Cameroun / Afrique Centrale)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('themeLabel', lang)}</label>
              <select
                value={settings.theme}
                onChange={(e) => {
                  const val = e.target.value as any;
                  onUpdateSettings({ ...settings, theme: val });
                  document.body.classList.remove('outdoor-mode', 'dark');
                  if (val === 'outdoor') document.body.classList.add('outdoor-mode');
                  if (val === 'dark') document.body.classList.add('dark');
                }}
                className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="default">{t('themeDefault', lang)}</option>
                <option value="outdoor">{t('themeOutdoor', lang)}</option>
                <option value="dark">{t('themeDark', lang)}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('unitLabel', lang)}</label>
              <select
                value={settings.unit}
                onChange={(e) => onUpdateSettings({ ...settings, unit: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="mm">{t('unitMm', lang)}</option>
                <option value="cm">{t('unitCm', lang)}</option>
                <option value="in">{t('unitIn', lang)}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Engineering Sizing Thresholds */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {t('sizingTitle', lang)}
          </h3>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('defaultSizeDefLabel', lang)}</label>
              <select
                value={settings.defaultSizeDefinition}
                onChange={(e) => onUpdateSettings({ ...settings, defaultSizeDefinition: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="min_feret">{t('sizeMinFeret', lang)}</option>
                <option value="ecd">{t('sizeEcd', lang)}</option>
                <option value="bbox_minor">{t('sizeBboxMinor', lang)}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{t('oversizeCutoffLabel', lang)}</label>
                <input
                  type="number"
                  value={settings.oversizeThresholdMm}
                  onChange={(e) => onUpdateSettings({ ...settings, oversizeThresholdMm: parseInt(e.target.value) || 300 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">{t('finesCutoffLabel', lang)}</label>
                <input
                  type="number"
                  value={settings.finesThresholdMm}
                  onChange={(e) => onUpdateSettings({ ...settings, finesThresholdMm: parseInt(e.target.value) || 25 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">{t('validationThresholdLabel', lang)}</label>
              <input
                type="number"
                value={settings.validationErrorThresholdPercent}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, validationErrorThresholdPercent: parseInt(e.target.value) || 15 })
                }
                className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calibration Self-Test & Printable Target */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> {t('selfTestTitle', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('selfTestSubtitle', lang)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadA4Target}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-600" /> {t('printA4TargetBtn', lang)}
            </button>
            <button
              onClick={handleRunSelfTest}
              disabled={isRunningSelfTest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              {isRunningSelfTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {isRunningSelfTest ? t('testing', lang) : t('runSelfTestBtn', lang)}
            </button>
          </div>
        </div>

        {selfTestReport && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">{t('selfTestResult', lang)}</span>
              {selfTestReport.passed ? (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('selfTestPass', lang).replace('{err}', selfTestReport.maxErrorPercent.toFixed(2))}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t('selfTestFail', lang)}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs bg-white rounded border border-slate-200">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2">{t('colTargetGeo', lang)}</th>
                    <th className="p-2">{t('colTrueSize', lang)}</th>
                    <th className="p-2">{t('colMeasured', lang)}</th>
                    <th className="p-2">{t('colError', lang)}</th>
                    <th className="p-2">{t('colStatus', lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selfTestReport.shapes.map((s, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{s.shapeName}</td>
                      <td className="p-2 text-slate-600">{s.expectedMinFeretMm} mm</td>
                      <td className="p-2 font-bold text-slate-900">{s.measuredMinFeretMm} mm</td>
                      <td className="p-2 font-bold text-emerald-600">{s.errorPercent}%</td>
                      <td className="p-2 font-bold text-emerald-600">{lang === 'fr' ? 'CONFORME' : 'PASS'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* AI Model Manager */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600" /> {t('aiModelsTitle', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('aiModelsSubtitle', lang)}
            </p>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              hasWebGpu ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {hasWebGpu ? t('webGpuAccel', lang) : t('webGpuWasm', lang)}
          </span>
        </div>

        <div className="space-y-2">
          {models.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
            >
              <div>
                <span className="font-bold text-slate-900 block">{m.name}</span>
                <span className="text-[11px] text-slate-500">{m.framework} | {lang === 'fr' ? 'Taille' : 'Size'}: {m.sizeMb} MB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-bold text-emerald-700 bg-emerald-100">
                  {t('readyOffline', lang)}
                </span>
                {!m.isFallback && (
                  <button
                    onClick={() => handleDeleteModel(m.id)}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    title={lang === 'fr' ? 'Supprimer le modèle du cache' : 'Delete model from cache'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Experimental Modules Configuration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-600" /> {t('showExperimentalModulesLabel', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('showExperimentalModulesDesc', lang)}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.showExperimentalModules)}
              onChange={(e) => onUpdateSettings({ ...settings, showExperimentalModules: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>
      </div>

      {/* Cloud AI Configuration (Anthropic Claude & Google Gemini) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" /> {t('geminiTitle', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('geminiSubtitle', lang)}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.enableAi ?? settings.enableGemini)}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  enableAi: e.target.checked,
                  enableGemini: e.target.checked,
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {Boolean(settings.enableAi ?? settings.enableGemini) && (
          <div className="space-y-3 pt-2 text-xs border-t border-slate-100">
            {/* Provider Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ ...settings, aiProvider: 'anthropic' });
                  setApiKeyTestResult(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isClaudeProvider
                    ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Anthropic Claude ({lang === 'fr' ? 'Recommandé' : 'Recommended'})
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ ...settings, aiProvider: 'gemini' });
                  setApiKeyTestResult(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isClaudeProvider
                    ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Google Gemini
              </button>
            </div>

            {isClaudeProvider ? (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 space-y-1">
                <p className="font-semibold">{t('claudePrivacy', lang)}</p>
                <p className="text-[11px] text-purple-800">
                  {lang === 'fr'
                    ? 'Active l\'intelligence artificielle Anthropic Claude pour la rédaction de synthèses géotechniques précises dans Geolab et l\'évaluation d\'ingénierie des tirs dans FragMill.'
                    : 'Enables Anthropic Claude AI to draft high-precision geotechnical narratives in Geolab and blast engineering evaluations in FragMill.'}
                </p>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <p className="font-semibold">{t('geminiPrivacy', lang)}</p>
                <p className="text-[11px] text-blue-800">
                  {lang === 'fr'
                    ? 'Active Google Gemini Flash pour l\'évaluation géotechnique et le contrôle des photos de tir.'
                    : 'Enables Google Gemini Flash for geotechnical evaluations and blast image checking.'}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-semibold">
                  {isClaudeProvider ? t('claudeApiKeyLabel', lang) : t('apiKeyLabel', lang)}
                </label>
                {isClaudeProvider ? (
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {lang === 'fr'
                      ? 'Obtenir une clé sur Anthropic Console'
                      : 'Get a key from Anthropic Console'}
                  </a>
                ) : (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {lang === 'fr'
                      ? 'Obtenir une clé sur Google AI Studio (Gratuit)'
                      : 'Get a key from Google AI Studio (Free)'}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder={isClaudeProvider ? 'sk-ant-api03-...' : 'AIzaSy...'}
                  value={currentApiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isClaudeProvider) {
                      onUpdateSettings({ ...settings, anthropicApiKey: val, geminiApiKey: val });
                    } else {
                      onUpdateSettings({ ...settings, geminiApiKey: val });
                    }
                    setApiKeyTestResult(null);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestApiKey}
                  disabled={isTestingApiKey}
                  className={`px-3 py-2 text-white font-semibold rounded-lg flex items-center gap-1.5 transition text-xs flex-shrink-0 cursor-pointer ${
                    isClaudeProvider
                      ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                  }`}
                >
                  {isTestingApiKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'fr' ? 'Test en cours...' : 'Testing...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Tester la Clé' : 'Test API Key'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2">
                <label className="text-slate-700 font-semibold block mb-1 text-[11px]">
                  {isClaudeProvider
                    ? lang === 'fr'
                      ? 'Modèle Anthropic Claude'
                      : 'Anthropic Claude Model'
                    : lang === 'fr'
                      ? 'Modèle Google Gemini Flash'
                      : 'Google Gemini Flash Model'}
                </label>
                {isClaudeProvider ? (
                  <select
                    value={settings.claudeModel || 'claude-3-5-haiku-20241022'}
                    onChange={(e) => {
                      onUpdateSettings({ ...settings, claudeModel: e.target.value });
                      setApiKeyTestResult(null);
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs bg-white"
                  >
                    <option value="claude-3-5-haiku-20241022">
                      Claude 3.5 Haiku (claude-3-5-haiku-20241022 - Recommandé)
                    </option>
                    <option value="claude-3-5-haiku-latest">
                      Claude 3.5 Haiku (claude-3-5-haiku-latest)
                    </option>
                    <option value="claude-3-5-sonnet-20241022">
                      Claude 3.5 Sonnet (claude-3-5-sonnet-20241022 - Vision & Précision)
                    </option>
                    <option value="claude-3-5-sonnet-latest">
                      Claude 3.5 Sonnet (claude-3-5-sonnet-latest)
                    </option>
                    <option value="claude-3-7-sonnet-latest">
                      Claude 3.7 Sonnet (claude-3-7-sonnet-latest)
                    </option>
                    <option value="claude-3-haiku-20240307">
                      Claude 3 Haiku (claude-3-haiku-20240307)
                    </option>
                  </select>
                ) : (
                  <select
                    value={settings.geminiModelFlash || 'gemini-1.5-flash'}
                    onChange={(e) => {
                      onUpdateSettings({ ...settings, geminiModelFlash: e.target.value });
                      setApiKeyTestResult(null);
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs bg-white"
                  >
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Standard - Gratuit universel)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Haute vitesse)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  </select>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  {isClaudeProvider
                    ? lang === 'fr'
                      ? 'Claude 3.5 Haiku est le modèle recommandé par défaut pour sa rapidité et son coût très faible.'
                      : 'Claude 3.5 Haiku is the recommended default for fast latency and cost efficiency.'
                    : lang === 'fr'
                      ? 'Gemini 1.5 Flash est actif par défaut et supporté par tous les comptes gratuits Google AI Studio.'
                      : 'Gemini 1.5 Flash is the default stable model supported by all free Google AI Studio accounts.'}
                </p>
              </div>
            </div>

            {apiKeyTestResult && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  apiKeyTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {apiKeyTestResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-xs leading-relaxed">{apiKeyTestResult.message}</p>
                  {apiKeyTestResult.success && (
                    <p className="text-[11px] text-emerald-700">
                      {lang === 'fr'
                        ? 'Votre clé est valide. Les modules Geolab et FragMill généreront désormais des interprétations réelles et personnalisées.'
                        : 'Your key is valid. Both Geolab and FragMill will now generate live, personalized interpretations.'}
                    </p>
                  )}
                  {!apiKeyTestResult.success &&
                    apiKeyTestResult.fixSuggestions &&
                    apiKeyTestResult.fixSuggestions.length > 0 && (
                      <div className="mt-2.5 p-3 bg-white/90 rounded-lg border border-red-200 text-slate-800 space-y-2">
                        <p className="font-bold text-[11px] text-red-800 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                          {lang === 'fr'
                            ? 'Guide de résolution pas-à-pas :'
                            : 'Step-by-step resolution guide:'}
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-700">
                          {apiKeyTestResult.fixSuggestions.map((sug, idx) => (
                            <li key={idx} className="leading-relaxed pl-1">
                              {sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700">
              <span className="font-bold text-slate-900 block">
                {lang === 'fr' ? 'Fonctionnalités activées par l\'IA Cloud :' : 'Features powered by Cloud AI:'}
              </span>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li>
                  <strong className="text-slate-800">Geolab :</strong> {lang === 'fr'
                    ? 'Synthèse personnalisée d\'ingénieur sur les feuilles d\'essais (Proctor, Granulo, Teneur en eau...) et rédaction des 4 chapitres de rapports d\'étude.'
                    : 'Custom engineering reviews on laboratory test sheets and 4-chapter narrative drafting in geotechnical study reports.'}
                </li>
                <li>
                  <strong className="text-slate-800">FragMill :</strong> {lang === 'fr'
                    ? 'Évaluation technique du tir de mine (distribution P80, oversize/fines, impact concassage/broyage usine) et audit qualité des clichés du tas d\'abattage.'
                    : 'Blast geotechnical review (P80 curve, oversize/fines, plant comminution efficiency) and muck pile photo scene assessment.'}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Storage & Full Project Backup */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" /> {t('storageTitle', lang)}
            </h3>
            <p className="text-xs text-slate-500">
              {t('indexedDbUsage', lang)} <span className="font-bold text-slate-800">{storageEstimateMb} MB</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> {t('backupProjectBtn', lang)}
            </button>
            <label className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-600" /> {t('restoreBtn', lang)}
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {backupStatus && (
          <div className="p-2 bg-emerald-50 text-emerald-800 text-xs rounded border border-emerald-200 font-medium">
            {backupStatus}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span className="text-xs text-slate-500">{t('eraseWarning', lang)}</span>
          <button
            onClick={handleClearAllData}
            className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold cursor-pointer"
          >
            {t('clearAllDataBtn', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
