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
import type {
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  GeoLabAnalysis,
  OrganisationProfile,
} from '../types/geolab';

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

  // GeoLab Tables
  clients!: Table<GeoLabClient, string>;
  geolabProjects!: Table<GeoLabProject, string>;
  samples!: Table<GeoLabSample, string>;
  analyses!: Table<GeoLabAnalysis, string>;

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

    this.version(2).stores({
      clients: 'id, companyName, email, isArchived, createdAt',
      geolabProjects: 'id, clientId, projectName, isArchived, createdAt',
      samples: 'id, projectId, sampleId, samplingDate, createdAt',
      analyses: 'id, sampleId, testType, status, reportNumber, createdAt',
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
  showExperimentalModules: false,
};

export const DEFAULT_ORGANISATION_PROFILE: OrganisationProfile = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  accreditationNumber: '',
  primaryColor: '#1e40af',
  signatories: [],
  approvalChain: [],
  formCodes: {
    proctor: 'PR2-FOR-02',
    grain_size: 'GR1-FOR-01',
    water_content: 'TE1-FOR-01',
  },
  reportFooterText: '',
  defaultLanguage: 'fr',
  defaultStandard: 'NF',
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

export async function getOrganisationProfile(): Promise<OrganisationProfile> {
  const row = await db.settings.get('geolab_organisation_profile');
  const profile: OrganisationProfile = row
    ? { ...DEFAULT_ORGANISATION_PROFILE, ...row.value }
    : { ...DEFAULT_ORGANISATION_PROFILE };

  // Backwards compatibility migration: convert legacy signatories to approvalChain if needed
  if ((!profile.approvalChain || profile.approvalChain.length === 0) && profile.signatories && profile.signatories.length > 0) {
    const roleLabels: Record<string, { en: string; fr: string }> = {
      prepared: { en: 'Tested by', fr: 'Essai réalisé par' },
      checked: { en: 'Checked by', fr: 'Vérifié par' },
      approved: { en: 'Approved by', fr: 'Approuvé par' },
    };
    profile.approvalChain = profile.signatories.slice(0, 6).map((s, idx) => ({
      id: `sig-${idx + 1}`,
      roleLabel: roleLabels[s.role] || { en: s.role, fr: s.role },
      name: s.name,
      title: s.title,
      stampOrSignatureBase64: s.stampOrSignatureBase64,
    }));
  }

  return profile;
}

export async function saveOrganisationProfile(profile: OrganisationProfile): Promise<void> {
  await db.settings.put({ key: 'geolab_organisation_profile', value: profile });
}
