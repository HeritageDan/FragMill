import React, { useState, useEffect, lazy, Suspense } from 'react';
import { db, getSettings, saveSettings, DEFAULT_SETTINGS } from './db';
import { seedDemoProject } from './db/seedData';
import { generateDefaultDrillHolesFromBlast } from './services/drillHoles/drillHoleService';
import type {
  Project,
  Site,
  Blast,
  ImageRecord,
  SegmentationRun,
  GroundTruth,
  MillBatch,
  AppSettings,
} from './types';
import { AppHeader, type NavigationTab } from './components/layout/AppHeader';
import { FieldWizard } from './components/wizard/FieldWizard';
import { ActiveBlastBanner } from './components/layout/ActiveBlastBanner';
import { ReportVaultProvider, useReportVault } from './context/ReportVaultContext';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';
import type { BlastSubTab } from './components/blast/BlastWorkspaceView';
import type { OptimiseSubTab } from './components/optimise/PredictOptimiseWorkspaceView';
import type { ExperimentalSubTab } from './components/experimental/ExperimentalWorkspaceView';

// Lazy-loaded workspace and modal views for rapid initial bundle loading
const BlastWorkspaceView = lazy(() => import('./components/blast/BlastWorkspaceView').then((m) => ({ default: m.BlastWorkspaceView })));
const PredictOptimiseWorkspaceView = lazy(() => import('./components/optimise/PredictOptimiseWorkspaceView').then((m) => ({ default: m.PredictOptimiseWorkspaceView })));
const ValidationDashboard = lazy(() => import('./components/validation/ValidationDashboard').then((m) => ({ default: m.ValidationDashboard })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const HelpView = lazy(() => import('./components/help/HelpView').then((m) => ({ default: m.HelpView })));
const ExperimentalWorkspaceView = lazy(() => import('./components/experimental/ExperimentalWorkspaceView').then((m) => ({ default: m.ExperimentalWorkspaceView })));
const ReportVaultModal = lazy(() => import('./components/report/ReportVaultModal').then((m) => ({ default: m.ReportVaultModal })));
const GeoLabShell = lazy(() => import('./components/geolab/GeoLabShell').then((m) => ({ default: m.GeoLabShell })));

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center p-20 space-y-4 text-slate-400">
    <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
    <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">Loading module...</span>
  </div>
);

const STATIC_FALLBACK_PROJECT: Project = {
  id: 'proj-1',
  name: 'Demo Project',
  description: 'Artisanal Gold Mining',
  createdAt: 1711843200000,
  updatedAt: 1711843200000,
};

const STATIC_FALLBACK_SITE: Site = {
  id: 'site-1',
  projectId: 'proj-1',
  name: 'Demo Site',
  locationText: 'Demo site (synthetic)',
  createdAt: 1711843200000,
  updatedAt: 1711843200000,
};

export function resolveMigratedTab(
  savedTab: string | null,
  isFieldMode: boolean = false,
  showExperimental: boolean = false
): { tab: NavigationTab; subTab?: string } {
  if (!savedTab) {
    return { tab: isFieldMode ? 'wizard' : 'blast' };
  }
  switch (savedTab) {
    case 'wizard':
      return { tab: 'wizard' };
    case 'blast':
      return { tab: 'blast', subTab: 'record' };
    case 'benchmap':
      return { tab: 'blast', subTab: 'pattern' };
    case 'timing':
      return { tab: 'blast', subTab: 'timing' };
    case 'kriging':
    case 'telemetry':
      return { tab: 'blast', subTab: 'record' };
    case 'validation':
      return { tab: 'validation' };
    case 'optimise':
      return { tab: 'optimise', subTab: 'kuzram' };
    case 'kuzram':
      return { tab: 'optimise', subTab: 'kuzram' };
    case 'minetomill':
      return { tab: 'optimise', subTab: 'minetomill' };
    case 'comminution':
      return { tab: 'optimise', subTab: 'twin' };
    case 'drone3d':
      return showExperimental
        ? { tab: 'experimental', subTab: 'drone3d' }
        : { tab: 'blast', subTab: 'record' };
    case 'beltvision':
      return showExperimental
        ? { tab: 'experimental', subTab: 'beltvision' }
        : { tab: 'blast', subTab: 'record' };
    case 'experimental':
      return showExperimental
        ? { tab: 'experimental' }
        : { tab: 'blast', subTab: 'record' };
    case 'settings':
      return { tab: 'settings' };
    case 'help':
      return { tab: 'help' };
    default:
      return { tab: isFieldMode ? 'wizard' : 'blast' };
  }
}

const ReportVaultToast = () => {
  const { toastMessage, clearToast } = useReportVault();
  if (!toastMessage) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
        <CheckCircle2 className="w-4 h-4" />
      </div>
      <span className="text-xs font-bold text-slate-100">{toastMessage}</span>
      <button
        onClick={clearToast}
        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

function AppContent() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [activeBlastId, setActiveBlastId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<NavigationTab>('wizard');
  const [blastSubTab, setBlastSubTab] = useState<BlastSubTab>('record');
  const [optimiseSubTab, setOptimiseSubTab] = useState<OptimiseSubTab>('kuzram');
  const [experimentalSubTab, setExperimentalSubTab] = useState<ExperimentalSubTab>('drone3d');
  const [isLoading, setIsLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeAppModule, setActiveAppModule] = useState<'fragmill' | 'geolab'>(() => {
    try {
      return (localStorage.getItem('fragmill_active_app_module') as 'fragmill' | 'geolab') || 'fragmill';
    } catch {
      return 'fragmill';
    }
  });

  const handleSwitchAppModule = (mod: 'fragmill' | 'geolab') => {
    setActiveAppModule(mod);
    try {
      localStorage.setItem('fragmill_active_app_module', mod);
    } catch {
      // ignore
    }
  };

  const loadDatabase = async () => {
    setIsLoading(true);
    try {
      const savedSettings = await getSettings();
      setSettings(savedSettings);

      // Check if project exists; if not, seed demo
      let projList = await db.projects.toArray();
      if (projList.length === 0) {
        await seedDemoProject();
        projList = await db.projects.toArray();
      }

      const siteList = await db.sites.toArray();
      const blastList = await db.blasts.toArray();
      const imageList = await db.images.toArray();
      const runList = await db.segmentationRuns.toArray();
      const gtList = await db.groundTruths.toArray();
      const mbList = await db.millBatches.toArray();

      // Hydrate blasts with their child images, runs, ground truth, and mill batches from IndexedDB
      const hydratedBlasts = blastList.map((b) => {
        const bImages = imageList.filter((img) => img.blastId === b.id);
        const hydratedImages = bImages.map((img) => ({
          ...img,
          segmentationRuns: runList.filter((r) => r.imageId === img.id),
        }));

        return {
          ...b,
          images: b.images && b.images.length > 0 ? b.images : hydratedImages,
          groundTruth: gtList.find((gt) => gt.blastId === b.id),
          millBatch: mbList.find((mb) => mb.blastId === b.id),
        };
      });

      setProjects(projList);
      setSites(siteList);
      setBlasts(hydratedBlasts);

      const savedBlastId = localStorage.getItem('fragmill_last_active_blast_id');
      const rawSavedTab = localStorage.getItem('fragmill_last_active_tab');

      if (savedBlastId && hydratedBlasts.some((b) => b.id === savedBlastId)) {
        setActiveBlastId(savedBlastId);
      } else if (hydratedBlasts.length > 0) {
        setActiveBlastId(hydratedBlasts[0].id);
      }

      // Safe navigation migration from legacy or merged tab IDs
      const migrated = resolveMigratedTab(
        rawSavedTab,
        savedSettings.mode === 'field',
        savedSettings.showExperimentalModules
      );
      setActiveTab(migrated.tab);
      if (migrated.tab === 'blast' && migrated.subTab) {
        setBlastSubTab(migrated.subTab as BlastSubTab);
      } else if (migrated.tab === 'optimise' && migrated.subTab) {
        setOptimiseSubTab(migrated.subTab as OptimiseSubTab);
      } else if (migrated.tab === 'experimental' && migrated.subTab) {
        setExperimentalSubTab(migrated.subTab as ExperimentalSubTab);
      }

      if (rawSavedTab && rawSavedTab !== migrated.tab) {
        try {
          localStorage.setItem('fragmill_last_active_tab', migrated.tab);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize and load database
  useEffect(() => {
    loadDatabase();
  }, []);

  const handleSelectBlast = (id: string) => {
    setActiveBlastId(id);
    try {
      localStorage.setItem('fragmill_last_active_blast_id', id);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  };

  const handleSelectTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('fragmill_last_active_tab', tab);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleUpdateBlast = async (updatedBlast: Blast) => {
    await db.blasts.put(updatedBlast);
    try {
      localStorage.setItem('fragmill_last_active_blast_id', updatedBlast.id);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    setBlasts((prev) => prev.map((b) => (b.id === updatedBlast.id ? updatedBlast : b)));
  };

  const handleSaveRun = async (image: ImageRecord, run: SegmentationRun) => {
    await db.images.put(image);
    await db.segmentationRuns.put(run);

    setBlasts((prev) =>
      prev.map((b) => {
        if (b.id === image.blastId) {
          const imgExists = b.images.some((img) => img.id === image.id);
          const updatedImages = imgExists
            ? b.images.map((img) =>
                img.id === image.id
                  ? { ...image, segmentationRuns: [run, ...(img.segmentationRuns || [])] }
                  : img
              )
            : [{ ...image, segmentationRuns: [run] }, ...b.images];

          return { ...b, images: updatedImages };
        }
        return b;
      })
    );
  };

  const handleUpdateBlastGroundTruth = async (blastId: string, gt: GroundTruth) => {
    await db.groundTruths.put(gt);
    setBlasts((prev) =>
      prev.map((b) => (b.id === blastId ? { ...b, groundTruth: gt } : b))
    );
  };

  const handleUpdateMillBatch = async (blastId: string, mb: MillBatch) => {
    await db.millBatches.put(mb);
    setBlasts((prev) =>
      prev.map((b) => (b.id === blastId ? { ...b, millBatch: mb } : b))
    );
  };

  const handleNewBlast = async () => {
    const num = blasts.length + 1;
    const newId = `blast-bl-2026-00${num}`;

    const newBlast: Blast = {
      id: newId,
      siteId: sites[0]?.id || 'site-1',
      projectId: projects[0]?.id || 'proj-1',
      blastId: `BL-2026-00${num}`,
      dateTime: new Date().toISOString().slice(0, 16),
      weather: 'Clear, 28°C',
      notes: 'New production blast',
      parameters: {
        benchHeight: 6.0,
        holeDiameter: 89,
        holeDepth: 6.8,
        subdrill: 0.8,
        burden: 2.4,
        spacing: 2.8,
        stemmingLength: 2.0,
        numberOfHoles: 30,
        holeInclination: 90,
        explosiveType: 'ANFO',
        rws: 100,
        chargePerHole: 22.0,
        bottomChargeLength: 2.0,
        columnChargeLength: 2.4,
        initiationSequenceNotes: 'Nonel 25ms surface delays',
        waterInHoles: false,
        drillingDeviationEstimate: 0.12,
      },
      rockMass: {
        rockType: 'Granodiorite',
        density: 2.68,
        jointSetCount: 3,
        meanJointSpacing: 0.5,
        jointOrientation: 'dip_into_face',
        estimatedGsiOrRmr: 65,
        ucsMPa: 120,
        youngsModulusGPa: 50,
      },
      images: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    newBlast.drillHoles = generateDefaultDrillHolesFromBlast(newBlast);

    await db.blasts.put(newBlast);
    setBlasts((prev) => [newBlast, ...prev]);
    setActiveBlastId(newBlast.id);
    setActiveTab(settings.mode === 'field' ? 'wizard' : 'blast');
  };

  const handleDeleteBlast = async (blastIdToDelete: string) => {
    try {
      const blastImages = await db.images.where('blastId').equals(blastIdToDelete).toArray();
      for (const img of blastImages) {
        await db.segmentationRuns.where('imageId').equals(img.id).delete();
      }
      await db.images.where('blastId').equals(blastIdToDelete).delete();
      await db.groundTruths.where('blastId').equals(blastIdToDelete).delete();
      await db.millBatches.where('blastId').equals(blastIdToDelete).delete();
      await db.blasts.delete(blastIdToDelete);

      const remainingBlasts = blasts.filter((b) => b.id !== blastIdToDelete);

      if (remainingBlasts.length === 0) {
        const defaultId = `blast-bl-${Date.now().toString().slice(-4)}`;
        const freshBlast: Blast = {
          id: defaultId,
          siteId: sites[0]?.id || 'site-1',
          projectId: projects[0]?.id || 'proj-1',
          blastId: 'BL-2026-001',
          dateTime: new Date().toISOString().slice(0, 16),
          weather: 'Clear, 28°C',
          notes: 'Initial blast record',
          parameters: {
            benchHeight: 6.0,
            holeDiameter: 89,
            holeDepth: 6.8,
            subdrill: 0.8,
            burden: 2.4,
            spacing: 2.8,
            stemmingLength: 2.0,
            numberOfHoles: 30,
            holeInclination: 90,
            explosiveType: 'ANFO',
            rws: 100,
            chargePerHole: 22.0,
            bottomChargeLength: 2.0,
            columnChargeLength: 2.4,
            initiationSequenceNotes: 'Nonel 25ms surface delays',
            waterInHoles: false,
            drillingDeviationEstimate: 0.12,
          },
          rockMass: {
            rockType: 'Granodiorite',
            density: 2.68,
            jointSetCount: 3,
            meanJointSpacing: 0.5,
            jointOrientation: 'dip_into_face',
            estimatedGsiOrRmr: 65,
            ucsMPa: 120,
            youngsModulusGPa: 50,
          },
          images: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.blasts.put(freshBlast);
        setBlasts([freshBlast]);
        setActiveBlastId(freshBlast.id);
      } else {
        setBlasts(remainingBlasts);
        if (activeBlastId === blastIdToDelete) {
          setActiveBlastId(remainingBlasts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to delete blast:', err);
    }
  };

  const handleDeleteImage = async (imageIdToDelete: string) => {
    try {
      await db.segmentationRuns.where('imageId').equals(imageIdToDelete).delete();
      await db.images.delete(imageIdToDelete);

      setBlasts((prev) =>
        prev.map((b) => ({
          ...b,
          images: b.images.filter((img) => img.id !== imageIdToDelete),
        }))
      );
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const handleLoadDemoProject = async () => {
    await seedDemoProject();
    await loadDatabase();
  };

  const activeBlast = blasts.find((b) => b.id === activeBlastId) || blasts[0];
  const activeProject = projects[0] || null;
  const activeSite = sites[0] || null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
        <span className="text-sm font-bold tracking-wide">Loading FragMill Lab Database...</span>
      </div>
    );
  }

  if (activeAppModule === 'geolab') {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <GeoLabShell
          language={settings.language}
          onSwitchToFragMill={() => handleSwitchAppModule('fragmill')}
        />
      </Suspense>
    );
  }

  return (
    <ReportVaultProvider
      activeBlastId={activeBlastId}
      showExperimentalModules={settings.showExperimentalModules}
    >
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <AppHeader
        currentProject={activeProject}
        blasts={blasts}
        activeBlastId={activeBlastId}
        onSelectBlast={handleSelectBlast}
        onDeleteBlast={handleDeleteBlast}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onNewBlast={handleNewBlast}
        onLoadDemoProject={handleLoadDemoProject}
        onOpenReportVault={() => setIsReportModalOpen(true)}
        activeAppModule={activeAppModule}
        onSwitchAppModule={handleSwitchAppModule}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {activeTab !== 'settings' && activeTab !== 'help' && activeBlast && (
          <ActiveBlastBanner
            blasts={blasts}
            activeBlast={activeBlast}
            activeBlastId={activeBlastId}
            onSelectBlast={handleSelectBlast}
            onUpdateBlast={handleUpdateBlast}
            onNewBlast={handleNewBlast}
            lang={settings.language}
          />
        )}

        {activeTab === 'wizard' && activeBlast && (
          <FieldWizard
            key={activeBlast.id}
            currentBlast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            onUpdateBlast={handleUpdateBlast}
            onSaveRun={handleSaveRun}
            lang={settings.language}
          />
        )}

        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'blast' && activeBlast && (
            <BlastWorkspaceView
              blast={activeBlast}
              blasts={blasts}
              activeBlastId={activeBlastId}
              onSelectBlast={handleSelectBlast}
              project={activeProject || undefined}
              site={activeSite || undefined}
              settings={settings}
              onUpdateBlast={handleUpdateBlast}
              onDeleteBlast={handleDeleteBlast}
              onDeleteImage={handleDeleteImage}
              onSaveRun={handleSaveRun}
              lang={settings.language}
              activeSubTab={blastSubTab}
              onSubTabChange={setBlastSubTab}
            />
          )}

          {activeTab === 'validation' && (
            <ValidationDashboard
              blasts={blasts}
              activeBlastId={activeBlastId}
              onSelectBlast={(id) => handleSelectBlast(id)}
              onUpdateBlastGroundTruth={handleUpdateBlastGroundTruth}
              project={activeProject || undefined}
              site={activeSite || undefined}
              lang={settings.language}
            />
          )}

          {activeTab === 'optimise' && (
            <PredictOptimiseWorkspaceView
              blast={activeBlast || null}
              blasts={blasts}
              activeBlastId={activeBlastId}
              onSelectBlast={handleSelectBlast}
              onUpdateMillBatch={handleUpdateMillBatch}
              project={activeProject || undefined}
              site={activeSite || undefined}
              lang={settings.language}
              activeSubTab={optimiseSubTab}
              onSubTabChange={setOptimiseSubTab}
            />
          )}

          {activeTab === 'experimental' && (
            <ExperimentalWorkspaceView
              key={activeBlast?.id || 'exp'}
              blast={activeBlast || null}
              project={activeProject || undefined}
              site={activeSite || undefined}
              onUpdateBlast={handleUpdateBlast}
              lang={settings.language}
              activeSubTab={experimentalSubTab}
              onSubTabChange={setExperimentalSubTab}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              lang={settings.language}
            />
          )}

          {activeTab === 'help' && <HelpView lang={settings.language} />}
        </Suspense>
      </main>

      {/* Floating Toast Notification for Report Vault Staging */}
      <ReportVaultToast />

      {/* Modular Report Vault Modal */}
      {activeBlast && (
        <Suspense fallback={null}>
          <ReportVaultModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            project={activeProject || STATIC_FALLBACK_PROJECT}
            site={activeSite || STATIC_FALLBACK_SITE}
            blast={activeBlast}
            lang={settings.language}
          />
        </Suspense>
      )}

      <footer className="bg-slate-900 text-slate-400 py-3 text-center text-xs border-t border-slate-800">
        <p>
          FragMill: Blast-to-Mill Fragmentation Lab &bull; Artisanal &amp; Small-Scale Mining (ASM) Research &bull; Fully Client-Side &amp; Offline Ready
        </p>
      </footer>
    </div>
    </ReportVaultProvider>
  );
}

export function App() {
  return <AppContent />;
}

export default App;
