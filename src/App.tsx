import React, { useState, useEffect } from 'react';
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
import { BlastDetailView } from './components/blast/BlastDetailView';
import { BenchMapView } from './components/spatial/BenchMapView';
import { ValidationDashboard } from './components/validation/ValidationDashboard';
import { MineToMillView } from './components/minetomill/MineToMillView';
import { KuzRamView } from './components/kuzram/KuzRamView';
import { SettingsView } from './components/settings/SettingsView';
import { HelpView } from './components/help/HelpView';
import { Drone3DSizingView } from './components/drone/Drone3DSizingView';
import { BeltEdgeVisionView } from './components/belt/BeltEdgeVisionView';
import { BlastTimingSimulatorView } from './components/timing/BlastTimingSimulatorView';
import { ComminutionDigitalTwinView } from './components/comminution/ComminutionDigitalTwinView';
import { BlockModelKrigingView } from './components/geostatistics/BlockModelKrigingView';
import { DrillTelemetryP2PView } from './components/telemetry/DrillTelemetryP2PView';
import { ActiveBlastBanner } from './components/layout/ActiveBlastBanner';
import { ReportVaultProvider, useReportVault } from './context/ReportVaultContext';
import { ReportVaultModal } from './components/report/ReportVaultModal';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';

function AppContent() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [activeBlastId, setActiveBlastId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<NavigationTab>('wizard');
  const [isLoading, setIsLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const { toastMessage, clearToast } = useReportVault();

  // Initialize and load database
  useEffect(() => {
    loadDatabase();
  }, []);

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

      // Hydrate blasts with their child images, runs, ground truth, and mill batches
      const hydratedBlasts = blastList.map((b) => {
        let baseBlast = b;
        try {
          const cachedSnap = localStorage.getItem(`fragmill_blast_${b.id}`);
          if (cachedSnap) {
            const parsed = JSON.parse(cachedSnap);
            if (parsed && parsed.id === b.id) {
              baseBlast = { ...b, ...parsed };
            }
          }
        } catch (e) {
          console.warn('Could not read cached blast snapshot:', e);
        }

        const bImages = imageList.filter((img) => img.blastId === baseBlast.id);
        const hydratedImages = bImages.map((img) => ({
          ...img,
          segmentationRuns: runList.filter((r) => r.imageId === img.id),
        }));

        return {
          ...baseBlast,
          images: baseBlast.images && baseBlast.images.length > 0 ? baseBlast.images : hydratedImages,
          groundTruth: gtList.find((gt) => gt.blastId === baseBlast.id),
          millBatch: mbList.find((mb) => mb.blastId === baseBlast.id),
        };
      });

      setProjects(projList);
      setSites(siteList);
      setBlasts(hydratedBlasts);

      const savedBlastId = localStorage.getItem('fragmill_last_active_blast_id');
      const savedTab = localStorage.getItem('fragmill_last_active_tab') as NavigationTab | null;

      if (savedBlastId && hydratedBlasts.some((b) => b.id === savedBlastId)) {
        setActiveBlastId(savedBlastId);
      } else if (hydratedBlasts.length > 0) {
        setActiveBlastId(hydratedBlasts[0].id);
      }

      if (savedTab) {
        setActiveTab(savedTab);
      } else if (savedSettings.mode === 'field') {
        setActiveTab('wizard');
      } else {
        setActiveTab('blast');
      }
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
      localStorage.setItem(`fragmill_blast_${updatedBlast.id}`, JSON.stringify(updatedBlast));
      localStorage.setItem('fragmill_last_active_blast_id', updatedBlast.id);
    } catch (e) {
      console.warn('LocalStorage blast snapshot failed:', e);
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

  return (
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
            onUpdateBlast={handleUpdateBlast}
            onSaveRun={handleSaveRun}
            lang={settings.language}
          />
        )}

        {activeTab === 'blast' && activeBlast && (
          <BlastDetailView
            key={activeBlast.id}
            blast={activeBlast}
            settings={settings}
            onUpdateBlast={handleUpdateBlast}
            onDeleteBlast={handleDeleteBlast}
            onDeleteImage={handleDeleteImage}
            onSaveRun={handleSaveRun}
            lang={settings.language}
          />
        )}

        {activeTab === 'drone3d' && activeBlast && (
          <Drone3DSizingView
            key={activeBlast.id}
            blast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            onUpdateBlast={handleUpdateBlast}
            lang={settings.language}
          />
        )}

        {activeTab === 'beltvision' && (
          <BeltEdgeVisionView
            key={activeBlast.id}
            blast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
          />
        )}

        {activeTab === 'timing' && activeBlast && (
          <BlastTimingSimulatorView
            key={activeBlast.id}
            blast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
          />
        )}

        {activeTab === 'comminution' && activeBlast && (
          <ComminutionDigitalTwinView
            key={activeBlast.id}
            blast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
          />
        )}

        {activeTab === 'kriging' && (
          <BlockModelKrigingView
            key={activeBlast.id}
            blast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
          />
        )}

        {activeTab === 'telemetry' && activeBlast && (
          <DrillTelemetryP2PView
            key={activeBlast.id}
            blast={activeBlast}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
          />
        )}

        {activeTab === 'benchmap' && (
          <BenchMapView
            blasts={blasts}
            activeBlastId={activeBlastId}
            onSelectBlast={(id) => {
              handleSelectBlast(id);
              handleSelectTab('blast');
            }}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
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

        {activeTab === 'minetomill' && (
          <MineToMillView
            blasts={blasts}
            activeBlastId={activeBlastId}
            onSelectBlast={(id) => handleSelectBlast(id)}
            onUpdateMillBatch={handleUpdateMillBatch}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
          />
        )}

        {activeTab === 'kuzram' && (
          <KuzRamView
            blasts={blasts}
            activeBlastId={activeBlastId}
            onSelectBlast={(id) => handleSelectBlast(id)}
            project={activeProject || undefined}
            site={activeSite || undefined}
            lang={settings.language}
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
      </main>

      {/* Floating Toast Notification for Report Vault Staging */}
      {toastMessage && (
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
      )}

      {/* Modular Report Vault Modal */}
      {activeBlast && (
        <ReportVaultModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          project={
            activeProject || {
              id: 'proj-1',
              name: 'Projet Bétaré Oya',
              description: 'Artisanal Gold Mining',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }
          site={
            activeSite || {
              id: 'site-1',
              projectId: 'proj-1',
              name: 'Carrière Principale Bétaré Oya',
              locationText: 'Est-Cameroun',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }
          blast={activeBlast}
          lang={settings.language}
        />
      )}

      <footer className="bg-slate-900 text-slate-400 py-3 text-center text-xs border-t border-slate-800">
        <p>
          FragMill: Blast-to-Mill Fragmentation Lab &bull; Artisanal &amp; Small-Scale Mining (ASM) Research &bull; Fully Client-Side &amp; Offline Ready
        </p>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <ReportVaultProvider>
      <AppContent />
    </ReportVaultProvider>
  );
}

export default App;
