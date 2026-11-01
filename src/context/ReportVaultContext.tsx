import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Language } from '../i18n';
import type {
  ReportSectionKey,
  ReportSectionEntry,
  ReportVaultState,
} from '../types/reportVault';
import { REPORT_SECTIONS_REGISTRY, getAvailableSectionKeys } from '../types/reportVault';
import type { Blast, Project, Site } from '../types';
import { generateModularVaultPdfReport, generateSingleSectionPdfReport } from '../services/export';

export const STORAGE_KEY = 'fragmill_report_vault_v1';

export const INITIAL_STATE: ReportVaultState = {
  blast: null,
  drone3d: null,
  beltvision: null,
  timing: null,
  comminution: null,
  benchmap: null,
  validation: null,
  minetomill: null,
  kuzram: null,
};

/**
 * Sanitises report vault state:
 * - Drops any key not present in REPORT_SECTIONS_REGISTRY.
 * - Drops any entry that lacks a valid blastId string.
 */
export function sanitiseVaultState(raw: any): ReportVaultState {
  const validKeys = Object.keys(REPORT_SECTIONS_REGISTRY) as ReportSectionKey[];
  const result: ReportVaultState = { ...INITIAL_STATE };

  if (raw && typeof raw === 'object') {
    validKeys.forEach((k) => {
      const entry = raw[k];
      if (
        entry &&
        typeof entry === 'object' &&
        typeof entry.blastId === 'string' &&
        entry.blastId.trim().length > 0
      ) {
        result[k] = {
          blastId: entry.blastId,
          key: k,
          stagedAt: typeof entry.stagedAt === 'number' ? entry.stagedAt : Date.now(),
          titleFr: entry.titleFr || REPORT_SECTIONS_REGISTRY[k].titleFr,
          titleEn: entry.titleEn || REPORT_SECTIONS_REGISTRY[k].titleEn,
          summaryTextFr: entry.summaryTextFr,
          summaryTextEn: entry.summaryTextEn,
          payload: entry.payload || {},
        };
      }
    });
  }

  return result;
}

export interface ReportVaultContextType {
  vaultState: ReportVaultState;
  stagedCount: number;
  totalSections: number;
  availableKeys: ReportSectionKey[];
  stageSection: (
    key: ReportSectionKey,
    payload: Record<string, any>,
    summaryFr?: string,
    summaryEn?: string
  ) => void;
  unstageSection: (key: ReportSectionKey) => void;
  clearVault: () => void;
  isStaged: (key: ReportSectionKey) => boolean;
  getStagedEntry: (key: ReportSectionKey) => ReportSectionEntry | null;
  stageAllAvailable: (project: Project, site: Site, blast: Blast) => void;
  downloadCombinedReport: (
    project: Project,
    site: Site,
    blast: Blast,
    lang?: Language,
    selectedKeys?: ReportSectionKey[]
  ) => Promise<void>;
  downloadSingleSection: (
    key: ReportSectionKey,
    project: Project,
    site: Site,
    blast: Blast,
    lang?: Language
  ) => Promise<void>;
  isGeneratingPdf: boolean;
  toastMessage: string | null;
  clearToast: () => void;
}

const ReportVaultContext = createContext<ReportVaultContextType | undefined>(undefined);

export interface ReportVaultProviderProps {
  children: React.ReactNode;
  activeBlastId?: string;
  showExperimentalModules?: boolean;
}

export const ReportVaultProvider: React.FC<ReportVaultProviderProps> = ({
  children,
  activeBlastId: propActiveBlastId,
  showExperimentalModules = false,
}) => {
  // Resolve active blast ID from props or fallback to localStorage
  const activeBlastId =
    propActiveBlastId !== undefined
      ? propActiveBlastId
      : (typeof window !== 'undefined'
          ? localStorage.getItem('fragmill_last_active_blast_id') || ''
          : '');

  const [vaultState, setVaultState] = useState<ReportVaultState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitised = sanitiseVaultState(parsed);
        // Write sanitised state back to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitised));
        } catch {
          // ignore
        }
        return sanitised;
      }
    } catch {
      // Fallback
    }
    return INITIAL_STATE;
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultState));
    } catch {
      // storage full or disabled
    }
  }, [vaultState]);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const availableKeys = useMemo(
    () => getAvailableSectionKeys(showExperimentalModules),
    [showExperimentalModules]
  );

  const totalSections = availableKeys.length;

  const stagedCount = useMemo(() => {
    return availableKeys.filter((key) => {
      const entry = vaultState[key];
      return !!entry && (!activeBlastId || entry.blastId === activeBlastId);
    }).length;
  }, [availableKeys, vaultState, activeBlastId]);

  const stageSection = useCallback(
    (
      key: ReportSectionKey,
      payload: Record<string, any>,
      summaryFr?: string,
      summaryEn?: string
    ) => {
      const meta = REPORT_SECTIONS_REGISTRY[key];
      const targetBlastId = activeBlastId || (payload?.blastId as string) || '';
      const entry: ReportSectionEntry = {
        blastId: targetBlastId,
        key,
        stagedAt: Date.now(),
        titleFr: meta?.titleFr || key,
        titleEn: meta?.titleEn || key,
        summaryTextFr: summaryFr,
        summaryTextEn: summaryEn,
        payload,
      };

      setVaultState((prev) => ({
        ...prev,
        [key]: entry,
      }));

      // Trigger user-friendly toast
      const tabName = meta?.tabNameFr || key;
      setToastMessage(`✓ "${tabName}" envoyé au rapport d'ingénierie`);
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    },
    [activeBlastId]
  );

  const unstageSection = useCallback((key: ReportSectionKey) => {
    setVaultState((prev) => ({
      ...prev,
      [key]: null,
    }));
  }, []);

  const clearVault = useCallback(() => {
    setVaultState((prev) => {
      const updated = { ...prev };
      (Object.keys(updated) as ReportSectionKey[]).forEach((key) => {
        if (!activeBlastId || updated[key]?.blastId === activeBlastId) {
          updated[key] = null;
        }
      });
      return updated;
    });
  }, [activeBlastId]);

  const isStaged = useCallback(
    (key: ReportSectionKey) => {
      if (!availableKeys.includes(key)) return false;
      const entry = vaultState[key];
      if (!entry) return false;
      return !activeBlastId || entry.blastId === activeBlastId;
    },
    [vaultState, availableKeys, activeBlastId]
  );

  const getStagedEntry = useCallback(
    (key: ReportSectionKey) => {
      const entry = vaultState[key];
      if (!entry) return null;
      if (activeBlastId && entry.blastId !== activeBlastId) return null;
      return entry;
    },
    [vaultState, activeBlastId]
  );

  // Auto-populate all available sections with current system calculations
  const stageAllAvailable = useCallback(
    (_project: Project, _site: Site, blast: Blast) => {
      const keys = getAvailableSectionKeys(showExperimentalModules);
      const targetBlastId = blast?.id || blast?.blastId || activeBlastId;
      const newState: ReportVaultState = { ...vaultState };
      const now = Date.now();

      keys.forEach((key) => {
        const meta = REPORT_SECTIONS_REGISTRY[key];
        const existing = newState[key];
        newState[key] = {
          blastId: targetBlastId,
          key,
          stagedAt: existing?.stagedAt || now,
          titleFr: existing?.titleFr || meta.titleFr,
          titleEn: existing?.titleEn || meta.titleEn,
          summaryTextFr: existing?.summaryTextFr,
          summaryTextEn: existing?.summaryTextEn,
          payload: { blastId: targetBlastId, autoGenerated: !existing, ...(existing?.payload || {}) },
        };
      });

      setVaultState(newState);
      setToastMessage(`✓ Toutes les ${keys.length} sections ont été ajoutées au rapport.`);
      setTimeout(() => setToastMessage(null), 4000);
    },
    [vaultState, activeBlastId, showExperimentalModules]
  );

  const downloadCombinedReport = useCallback(
    async (
      project: Project,
      site: Site,
      blast: Blast,
      lang: Language = 'fr',
      selectedKeys?: ReportSectionKey[]
    ) => {
      setIsGeneratingPdf(true);
      try {
        const targetBlastId = blast.id || blast.blastId || activeBlastId;
        const available = getAvailableSectionKeys(showExperimentalModules);

        // Restrict selection to available keys only
        const keysToRun = (selectedKeys || available).filter((k) => available.includes(k));

        // Filter vault state: entries belonging to another blast are omitted
        const filteredState: ReportVaultState = { ...INITIAL_STATE };
        available.forEach((k) => {
          const entry = vaultState[k];
          if (
            entry &&
            (entry.blastId === targetBlastId ||
              entry.blastId === blast.id ||
              entry.blastId === blast.blastId)
          ) {
            filteredState[k] = entry;
          }
        });

        const blob = await generateModularVaultPdfReport(
          filteredState,
          project,
          site,
          blast,
          lang,
          keysToRun
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `FRAGMILL_Rapport_Complet_${blast.blastId}_${dateStr}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to generate combined PDF report:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
    },
    [vaultState, activeBlastId, showExperimentalModules]
  );

  const downloadSingleSection = useCallback(
    async (
      key: ReportSectionKey,
      project: Project,
      site: Site,
      blast: Blast,
      lang: Language = 'fr'
    ) => {
      setIsGeneratingPdf(true);
      try {
        const targetBlastId = blast.id || blast.blastId || activeBlastId;
        const rawEntry = vaultState[key];
        const entry =
          rawEntry &&
          (rawEntry.blastId === targetBlastId ||
            rawEntry.blastId === blast.id ||
            rawEntry.blastId === blast.blastId)
            ? rawEntry
            : null;

        const blob = await generateSingleSectionPdfReport(
          key,
          entry,
          project,
          site,
          blast,
          lang
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const meta = REPORT_SECTIONS_REGISTRY[key];
        const safeName = (meta.tabNameEn || key).replace(/\s+/g, '_');
        a.download = `FRAGMILL_${safeName}_${blast.blastId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Failed to generate single section PDF:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
    },
    [vaultState, activeBlastId]
  );

  return (
    <ReportVaultContext.Provider
      value={{
        vaultState,
        stagedCount,
        totalSections,
        availableKeys,
        stageSection,
        unstageSection,
        clearVault,
        isStaged,
        getStagedEntry,
        stageAllAvailable,
        downloadCombinedReport,
        downloadSingleSection,
        isGeneratingPdf,
        toastMessage,
        clearToast,
      }}
    >
      {children}
    </ReportVaultContext.Provider>
  );
};

export const useReportVault = (): ReportVaultContextType => {
  const context = useContext(ReportVaultContext);
  if (!context) {
    throw new Error('useReportVault must be used within a ReportVaultProvider');
  }
  return context;
};
