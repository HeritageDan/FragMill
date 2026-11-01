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
  companyName: 'GeoLab Materials & Soil Testing Laboratory',
  address: '142 Boulevard de la Recherche, 75013 Paris, France',
  phone: '+33 (0)1 45 87 90 20',
  email: 'contact@geolab-testing.com',
  accreditationNumber: 'COFRAC / ISO 17025 N° 1-4820',
  primaryColor: '#1e40af',
  signatories: [
    { role: 'prepared', name: 'J. Dupont', title: 'Laboratory Technician' },
    { role: 'checked', name: 'M. Lambert, EurGeol', title: 'Quality Assurance Lead' },
    { role: 'approved', name: 'Dr. H. Kemekong, P.Eng', title: 'Technical Director' },
  ],
  reportFooterText: 'Certified Geotechnical Laboratory Report - Quality Assurance Protocol',
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
  if (row) {
    return { ...DEFAULT_ORGANISATION_PROFILE, ...row.value };
  }
  return DEFAULT_ORGANISATION_PROFILE;
}

export async function saveOrganisationProfile(profile: OrganisationProfile): Promise<void> {
  await db.settings.put({ key: 'geolab_organisation_profile', value: profile });
}
