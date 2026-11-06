import React, { useState } from 'react';
import type { Blast, Project, Site, MillBatch } from '../../types';
import { SubTabNavigation, type SubTabItem } from '../layout/SubTabNavigation';
import { KuzRamView } from '../kuzram/KuzRamView';
import { MineToMillView } from '../minetomill/MineToMillView';
import { ComminutionDigitalTwinView } from '../comminution/ComminutionDigitalTwinView';
import { TrendingUp, DollarSign, Factory } from 'lucide-react';

export type OptimiseSubTab = 'kuzram' | 'minetomill' | 'twin';

interface PredictOptimiseWorkspaceViewProps {
  blast: Blast | null;
  blasts: Blast[];
  activeBlastId: string;
  onSelectBlast: (id: string) => void;
  onUpdateBlast?: (updated: Blast) => void;
  onUpdateMillBatch: (blastId: string, millBatch: MillBatch) => void;
  project?: Project | null;
  site?: Site | null;
  lang?: 'en' | 'fr';
  activeSubTab?: OptimiseSubTab;
  onSubTabChange?: (tab: OptimiseSubTab) => void;
}

export const PredictOptimiseWorkspaceView: React.FC<PredictOptimiseWorkspaceViewProps> = ({
  blast,
  blasts,
  activeBlastId,
  onSelectBlast,
  onUpdateBlast,
  onUpdateMillBatch,
  project,
  site,
  lang = 'en',
  activeSubTab: externalSubTab,
  onSubTabChange,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<OptimiseSubTab>('kuzram');
  const activeSubTab = externalSubTab || internalSubTab;
  const isFrench = lang === 'fr';

  const handleSelectTab = (tabId: OptimiseSubTab) => {
    setInternalSubTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    }
  };

  const tabs: SubTabItem<OptimiseSubTab>[] = [
    {
      id: 'kuzram',
      label: isFrench ? 'Kuz-Ram & Calibrage' : 'Kuz-Ram & Calibration',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      id: 'minetomill',
      label: isFrench ? 'Mine-au-Moulin' : 'Mine-to-Mill',
      icon: <DollarSign className="w-3.5 h-3.5" />,
    },
    {
      id: 'twin',
      label: isFrench ? 'Jumeau Broyage' : 'Circuit Twin',
      icon: <Factory className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <SubTabNavigation<OptimiseSubTab>
        tabs={tabs}
        activeTab={activeSubTab}
        onSelectTab={handleSelectTab}
      />

      {activeSubTab === 'kuzram' && (
        <KuzRamView
          blasts={blasts}
          activeBlastId={activeBlastId}
          onSelectBlast={onSelectBlast}
          onUpdateBlast={onUpdateBlast}
          project={project || undefined}
          site={site || undefined}
          lang={lang}
        />
      )}

      {activeSubTab === 'minetomill' && (
        <MineToMillView
          blasts={blasts}
          activeBlastId={activeBlastId}
          onSelectBlast={onSelectBlast}
          onUpdateMillBatch={onUpdateMillBatch}
          onUpdateBlast={onUpdateBlast}
          project={project || undefined}
          site={site || undefined}
          lang={lang}
        />
      )}

      {activeSubTab === 'twin' && (
        blast ? (
          <ComminutionDigitalTwinView
            key={blast.id}
            blast={blast}
            onUpdateBlast={onUpdateBlast}
            project={project || undefined}
            site={site || undefined}
            lang={lang}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
            {isFrench
              ? 'Veuillez sélectionner un tir pour afficher le jumeau numérique de broyage.'
              : 'Please select a blast to view the comminution digital twin.'}
          </div>
        )
      )}
    </div>
  );
};
