import React, { useState, useEffect } from 'react';
import { db, getSettings, saveSettings, DEFAULT_SETTINGS } from './db';
import { seedDemoProject } from './db/seedData';
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
import { AppHeader } from './components/layout/AppHeader';
import { FieldWizard } from './components/wizard/FieldWizard';
import { BlastDetailView } from './components/blast/BlastDetailView';
import { ValidationDashboard } from './components/validation/ValidationDashboard';
import { MineToMillView } from './components/minetomill/MineToMillView';
import { KuzRamView } from './components/kuzram/KuzRamView';
import { SettingsView } from './components/settings/SettingsView';
import { HelpView } from './components/help/HelpView';
import { RefreshCw } from 'lucide-react';

export function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [activeBlastId, setActiveBlastId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'wizard' | 'blast' | 'validation' | 'minetomill' | 'kuzram' | 'settings' | 'help'
  >('wizard');
  const [isLoading, setIsLoading] = useState(true);

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
        const bImages = imageList.filter((img) => img.blastId === b.id);
        const hydratedImages = bImages.map((img) => ({
          ...img,
          segmentationRuns: runList.filter((r) => r.imageId === img.id),
        }));

        return {
          ...b,
          images: hydratedImages,
          groundTruth: gtList.find((gt) => gt.blastId === b.id),
          millBatch: mbList.find((mb) => mb.blastId === b.id),
        };
      });

      setProjects(projList);
      setSites(siteList);
      setBlasts(hydratedBlasts);

      if (hydratedBlasts.length > 0) {
        setActiveBlastId(hydratedBlasts[0].id);
      }

      if (savedSettings.mode === 'field') {
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

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleUpdateBlast = async (updatedBlast: Blast) => {
    await db.blasts.put(updatedBlast);
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

    await db.blasts.put(newBlast);
    setBlasts((prev) => [newBlast, ...prev]);
    setActiveBlastId(newBlast.id);
    setActiveTab(settings.mode === 'field' ? 'wizard' : 'blast');
  };

  const handleLoadDemoProject = async () => {
    await seedDemoProject();
    await loadDatabase();
  };

  const activeBlast = blasts.find((b) => b.id === activeBlastId) || blasts[0];

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
        currentProject={projects[0] || null}
        blasts={blasts}
        activeBlastId={activeBlastId}
        onSelectBlast={(id) => setActiveBlastId(id)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onNewBlast={handleNewBlast}
        onLoadDemoProject={handleLoadDemoProject}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'wizard' && activeBlast && (
          <FieldWizard
            currentBlast={activeBlast}
            onUpdateBlast={handleUpdateBlast}
            onSaveRun={handleSaveRun}
            lang={settings.language}
          />
        )}

        {activeTab === 'blast' && activeBlast && (
          <BlastDetailView
            blast={activeBlast}
            settings={settings}
            onUpdateBlast={handleUpdateBlast}
            onSaveRun={handleSaveRun}
            lang={settings.language}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationDashboard
            blasts={blasts}
            onUpdateBlastGroundTruth={handleUpdateBlastGroundTruth}
            lang={settings.language}
          />
        )}

        {activeTab === 'minetomill' && (
          <MineToMillView
            blasts={blasts}
            onUpdateMillBatch={handleUpdateMillBatch}
            lang={settings.language}
          />
        )}

        {activeTab === 'kuzram' && (
          <KuzRamView blasts={blasts} lang={settings.language} />
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

      <footer className="bg-slate-900 text-slate-400 py-3 text-center text-xs border-t border-slate-800">
        <p>
          FragMill: Blast-to-Mill Fragmentation Lab &bull; Artisanal &amp; Small-Scale Mining (ASM) Research &bull; Fully Client-Side &amp; Offline Ready
        </p>
      </footer>
    </div>
  );
}

export default App;
