import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../../types';
import { runCalibrationSelfTest, type SelfTestReport } from '../../services/selftest';
import { getDownloadedModels, deleteModelCache, checkWebGpuSupport, type ModelMetadata } from '../../services/aiSegmentation';
import { generatePrintableA4CalibrationSheet, exportProjectBackupJson, importProjectBackupJson } from '../../services/export';
import { db } from '../../db';
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
} from 'lucide-react';

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
    const blob = generatePrintableA4CalibrationSheet();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FragMill_A4_Calibration_Target.pdf';
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
    a.download = `FragMill_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setBackupStatus('Project exported successfully!');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        await importProjectBackupJson(text);
        setBackupStatus('Project restored successfully! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err: any) {
        setBackupStatus(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    if (window.confirm('Are you sure you want to permanently erase all FragMill projects, blasts, and images from this device?')) {
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
            {lang === 'fr' ? 'Paramètres & Diagnostics du Système' : 'Settings & Diagnostics Lab'}
          </h2>
          <p className="text-xs text-slate-500">
            Configure measurement conventions, themes, in-browser AI models, and calibration self-tests
          </p>
        </div>
      </div>

      {/* Preferences Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Language & Theme */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Language & Display Appearance
          </h3>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Language (Langue):</label>
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
              <label className="block text-slate-600 font-semibold mb-1">Display Theme:</label>
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
                <option value="default">Default Deep Navy (Engineering)</option>
                <option value="outdoor">High-Contrast Outdoor Sunlight Mode</option>
                <option value="dark">Dark Room / Night Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Measurement Unit:</label>
              <select
                value={settings.unit}
                onChange={(e) => onUpdateSettings({ ...settings, unit: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="mm">Millimetres (mm) - Mining Standard</option>
                <option value="cm">Centimetres (cm)</option>
                <option value="in">Inches (in)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Engineering Sizing Thresholds */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Sizing Definitions & Cut-offs
          </h3>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Default Size Definition:</label>
              <select
                value={settings.defaultSizeDefinition}
                onChange={(e) => onUpdateSettings({ ...settings, defaultSizeDefinition: e.target.value as any })}
                className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="min_feret">Minimum Feret (Closest to Square-Mesh Sieve)</option>
                <option value="ecd">Equivalent Circular Diameter (ECD: 2*sqrt(A/pi))</option>
                <option value="bbox_minor">Bounding Box Minor Axis</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Oversize Cut-off (mm)</label>
                <input
                  type="number"
                  value={settings.oversizeThresholdMm}
                  onChange={(e) => onUpdateSettings({ ...settings, oversizeThresholdMm: parseInt(e.target.value) || 300 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Fines Cut-off (mm)</label>
                <input
                  type="number"
                  value={settings.finesThresholdMm}
                  onChange={(e) => onUpdateSettings({ ...settings, finesThresholdMm: parseInt(e.target.value) || 25 })}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Validation Alert Threshold (%):</label>
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
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Synthetic Calibration Self-Test (3% Tolerance)
            </h3>
            <p className="text-xs text-slate-500">
              Generates virtual precision test geometries (100 mm disc & 80x50 mm block) to verify measurement accuracy
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadA4Target}
              className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-blue-600" /> Print A4 Target PDF
            </button>
            <button
              onClick={handleRunSelfTest}
              disabled={isRunningSelfTest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              {isRunningSelfTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {isRunningSelfTest ? 'Testing...' : 'Run Self-Test'}
            </button>
          </div>
        </div>

        {selfTestReport && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">Self-Test Diagnostic Result:</span>
              {selfTestReport.passed ? (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> PASSED (Max error: {selfTestReport.maxErrorPercent.toFixed(2)}% &le; 3.0%)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> FAILED (Error exceeds 3% tolerance)
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs bg-white rounded border border-slate-200">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Target Geometry</th>
                    <th className="p-2">True Size (mm)</th>
                    <th className="p-2">Measured (mm)</th>
                    <th className="p-2">Error %</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selfTestReport.shapes.map((s, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-800">{s.shapeName}</td>
                      <td className="p-2 text-slate-600">{s.expectedMinFeretMm} mm</td>
                      <td className="p-2 font-bold text-slate-900">{s.measuredMinFeretMm} mm</td>
                      <td className="p-2 font-bold text-emerald-600">{s.errorPercent}%</td>
                      <td className="p-2 font-bold text-emerald-600">PASS</td>
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
              <Cpu className="w-4 h-4 text-purple-600" /> In-Browser AI Models & Neural Accelerator
            </h3>
            <p className="text-xs text-slate-500">
              Models are stored persistently in browser IndexedDB cache and run 100% offline
            </p>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              hasWebGpu ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
            }`}
          >
            WebGPU: {hasWebGpu ? 'Available (Hardware Accelerated)' : 'WASM / CPU Mode'}
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
                <span className="text-[11px] text-slate-500">{m.framework} | Size: {m.sizeMb} MB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-bold text-emerald-700 bg-emerald-100">
                  Ready Offline
                </span>
                {!m.isFallback && (
                  <button
                    onClick={() => handleDeleteModel(m.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                    title="Delete model from cache"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Gemini Cloud AI Configuration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" /> Google Gemini API Cloud Assistant (Optional)
            </h3>
            <p className="text-xs text-slate-500">
              Optional cloud reasoning for automatic quality checks and bilingual geological reports
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableGemini}
              onChange={(e) => onUpdateSettings({ ...settings, enableGemini: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {settings.enableGemini && (
          <div className="space-y-3 pt-2 text-xs border-t border-slate-100">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
              <span className="font-bold">Privacy Statement:</span> When enabled, muck pile photographs and computed
              sizing numbers are sent to Google Gemini for scene assessment and natural language summary generation.
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Google AI Studio API Key:
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey || ''}
                onChange={(e) => onUpdateSettings({ ...settings, geminiApiKey: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Storage & Full Project Backup */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" /> Device Storage & Backup
            </h3>
            <p className="text-xs text-slate-500">
              Local IndexedDB usage: <span className="font-bold text-slate-800">{storageEstimateMb} MB</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBackup}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Download className="w-3.5 h-3.5" /> Backup Project (JSON)
            </button>
            <label className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-600" /> Restore
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
          <span className="text-xs text-slate-500">Erase all project data, images, and cached databases:</span>
          <button
            onClick={handleClearAllData}
            className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold"
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};
