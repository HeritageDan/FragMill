import React, { useState } from 'react';
import type { Blast, Project, Site } from '../../types';
import { SubTabNavigation, type SubTabItem } from '../layout/SubTabNavigation';
import { Drone3DSizingView } from '../drone/Drone3DSizingView';
import { BeltEdgeVisionView } from '../belt/BeltEdgeVisionView';
import { Plane, Video } from 'lucide-react';

export type ExperimentalSubTab = 'drone3d' | 'beltvision';

interface ExperimentalWorkspaceViewProps {
  blast: Blast | null;
  project?: Project | null;
  site?: Site | null;
  onUpdateBlast?: (blast: Blast) => void;
  lang?: 'en' | 'fr';
  activeSubTab?: ExperimentalSubTab;
  onSubTabChange?: (tab: ExperimentalSubTab) => void;
}

export const ExperimentalWorkspaceView: React.FC<ExperimentalWorkspaceViewProps> = ({
  blast,
  project,
  site,
  onUpdateBlast,
  lang = 'en',
  activeSubTab: externalSubTab,
  onSubTabChange,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<ExperimentalSubTab>('drone3d');
  const activeSubTab = externalSubTab || internalSubTab;
  const isFrench = lang === 'fr';

  const handleSelectTab = (tabId: ExperimentalSubTab) => {
    setInternalSubTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const tabs: SubTabItem<ExperimentalSubTab>[] = [
    {
      id: 'drone3d',
      label: isFrench ? 'Drone 3D & Ortho' : 'Drone 3D Sizing',
      icon: <Plane className="w-3.5 h-3.5" />,
    },
    {
      id: 'beltvision',
      label: isFrench ? 'Vision Convoyeur' : 'Belt Edge Vision',
      icon: <Video className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <SubTabNavigation<ExperimentalSubTab>
        tabs={tabs}
        activeTab={activeSubTab}
        onSelectTab={handleSelectTab}
      />

      {activeSubTab === 'drone3d' && blast && (
        <Drone3DSizingView
          key={blast.id}
          blast={blast}
          project={project || undefined}
          site={site || undefined}
          onUpdateBlast={onUpdateBlast}
          lang={lang}
        />
      )}

      {activeSubTab === 'beltvision' && (
        <BeltEdgeVisionView
          blast={blast || undefined}
          project={project || undefined}
          site={site || undefined}
          lang={lang}
        />
      )}
    </div>
  );
};

