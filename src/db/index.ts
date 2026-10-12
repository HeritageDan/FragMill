import Dexie, { type Table } from 'dexie';
import type {
  Project,
  Site,
  Blast,
  ImageRecord,
  SegmentationRun,
  GroundTruth,
  MillBatch,
  AppSettings,
} from '../types';

export class FragMillDatabase extends Dexie {
  projects!: Table<Project, string>;
  sites!: Table<Site, string>;
  blasts!: Table<Blast, string>;
  images!: Table<ImageRecord, string>;
  segmentationRuns!: Table<SegmentationRun, string>;
  groundTruths!: Table<GroundTruth, string>;
  millBatches!: Table<MillBatch, string>;
  settings!: Table<{ key: string; value: any }, string>;
  cachedModels!: Table<{ id: string; name: string; size: number; buffer: ArrayBuffer; updatedAt: number }, string>;

  constructor() {
    super('FragMillDB');
    this.version(1).stores({
      projects: 'id, name, createdAt',
      sites: 'id, projectId, name',
      blasts: 'id, siteId, projectId, blastId, dateTime',
      images: 'id, blastId, zone',
      segmentationRuns: 'id, imageId, engine, parentRunId',
      groundTruths: 'id, blastId',
      millBatches: 'id, blastId',
      settings: 'key',
      cachedModels: 'id, name, size',
    });
  }
}

export const db = new FragMillDatabase();

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'default',
  unit: 'mm',
  mode: 'field',
  defaultSizeDefinition: 'min_feret',
  minFragmentCutoffPx: 12,
  oversizeThresholdMm: 300,
  finesThresholdMm: 25,
  maxImageDimension: 4000,
  enableGemini: false,
  geminiModelFlash: 'gemini-2.5-flash',
  geminiModelPro: 'gemini-2.5-pro',
  validationErrorThresholdPercent: 15,
};

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get('app_settings');
  if (row) {
    return { ...DEFAULT_SETTINGS, ...row.value };
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: 'app_settings', value: settings });
}
