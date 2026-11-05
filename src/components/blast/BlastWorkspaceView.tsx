import React, { useState } from 'react';
import type { Blast, Project, Site, AppSettings, ImageRecord, SegmentationRun } from '../../types';
import { SubTabNavigation, type SubTabItem } from '../layout/SubTabNavigation';
import { BlastDetailView } from './BlastDetailView';
import { BenchMapView } from '../spatial/BenchMapView';
import { BlastTimingSimulatorView } from '../timing/BlastTimingSimulatorView';
import { Compass, Map, Flame } from 'lucide-react';

export type BlastSubTab = 'record' | 'pattern' | 'timing';

interface BlastWorkspaceViewProps {
  blast: Blast;
  blasts: Blast[];
  activeBlastId: string;
  onSelectBlast: (id: string) => void;
  project?: Project | null;
  site?: Site | null;
  settings: AppSettings;
  onUpdateBlast: (updated: Blast) => void;
  onDeleteBlast?: (blastId: string) => void;
  onDeleteImage?: (imageId: string) => void;
  onSaveRun: (image: ImageRecord, run: SegmentationRun) => void;
  lang?: 'en' | 'fr';
  activeSubTab?: BlastSubTab;
  onSubTabChange?: (tab: BlastSubTab) => void;
}

export const BlastWorkspaceView: React.FC<BlastWorkspaceViewProps> = ({
  blast,
  blasts,
  activeBlastId,
  onSelectBlast,
  project,
  site,
  settings,
  onUpdateBlast,
  onDeleteBlast,
  onDeleteImage,
  onSaveRun,
  lang = 'en',
  activeSubTab: externalSubTab,
  onSubTabChange,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<BlastSubTab>('record');
  const activeSubTab = externalSubTab || internalSubTab;
  const isFrench = lang === 'fr';

  const handleSelectTab = (tabId: BlastSubTab) => {
    setInternalSubTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const handleSelectBlastFromBenchMap = (selectedId: string) => {
    onSelectBlast(selectedId);
    // Switch to Record & Images to inspect the selected blast
    handleSelectTab('record');
  };

  const tabs: SubTabItem<BlastSubTab>[] = [
    {
      id: 'record',
      label: isFrench ? 'Tir & Images' : 'Record & Images',
      icon: <Compass className="w-3.5 h-3.5" />,
    },
    {
      id: 'pattern',
      label: isFrench ? 'Plan de Fosse' : 'Pattern Map',
      icon: <Map className="w-3.5 h-3.5" />,
      badge: `${blasts.length}`,
    },
    {
      id: 'timing',
      label: isFrench ? 'Initiation & Vibration' : 'Initiation & Vibration',
      icon: <Flame className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <SubTabNavigation<BlastSubTab>
        tabs={tabs}
        activeTab={activeSubTab}
        onSelectTab={handleSelectTab}
      />

      {activeSubTab === 'record' && (
        <BlastDetailView
          key={blast.id}
          blast={blast}
          project={project || undefined}
          site={site || undefined}
          settings={settings}
          onUpdateBlast={onUpdateBlast}
          onDeleteBlast={onDeleteBlast}
          onDeleteImage={onDeleteImage}
          onSaveRun={onSaveRun}
          lang={lang}
        />
      )}

      {activeSubTab === 'pattern' && (
        <BenchMapView
          blasts={blasts}
          activeBlastId={activeBlastId}
          onSelectBlast={handleSelectBlastFromBenchMap}
          project={project || undefined}
          site={site || undefined}
          lang={lang}
        />
      )}

      {activeSubTab === 'timing' && (
        <BlastTimingSimulatorView
          key={blast.id}
          blast={blast}
          project={project || undefined}
          site={site || undefined}
          lang={lang}
          onUpdateBlast={onUpdateBlast}
        />
      )}
    </div>
  );
};

