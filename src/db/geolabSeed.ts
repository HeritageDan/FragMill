import { db } from './index';
import { proctorTestDefinition } from '../geolab/tests/proctor';
import { grainSizeTestDefinition } from '../geolab/tests/grainSize';
import { waterContentTestDefinition } from '../geolab/tests/waterContent';
import type { GeoLabClient, GeoLabProject, GeoLabSample, GeoLabAnalysis } from '../types/geolab';

export async function seedGeoLabDemoData(): Promise<void> {
  const clientId = 'client-demo-1';
  const projectId = 'proj-demo-1';
  const sampleId = 'sample-demo-1';

  const demoClient: GeoLabClient = {
    id: clientId,
    companyName: 'Demo Client',
    contactPerson: 'Pierre Moreau (Demo)',
    jobTitle: 'Chef de Projet Géotechnique',
    email: 'contact@demo-client.com',
    phone: '+33 1 30 60 20 00',
    address: '1 Avenue de la Démonstration',
    city: 'Paris',
    country: 'France',
    taxRegistrationNumber: 'FR 44 380 409 982',
    isArchived: false,
    isDemo: true,
    createdAt: '2026-10-15T08:00:00.000Z',
    updatedAt: '2026-10-15T08:00:00.000Z',
  };

  const demoProject: GeoLabProject = {
    id: projectId,
    clientId,
    projectName: 'Demo Project (Autoroute A10 - PK 40+800)',
    siteLocation: 'PK 40+800 Côté Gauche (DEMO)',
    referenceNumber: 'DEMO-CTR-2026-A10',
    startDate: '2026-10-15',
    isArchived: false,
    isDemo: true,
    programmeTitle: 'Programme Démonstration Travaux Publics',
    lotSection: 'Lot 1 - Section PK 40+800',
    contractNumber: 'MARCHE-DEMO-2026',
    tenderNumber: 'AO-DEMO-001',
    financingText: 'Financement Démonstration / Demo Funding',
    parties: [
      { role: "Maître d'Ouvrage (Client)", name: 'Direction des Routes (Demo)', contact: 'contact@demo.gov' },
      { role: 'Bureau de Contrôle', name: 'Contrôle Technique BTP (Demo)', contact: 'ct@demo.org' },
      { role: 'Entreprise Mandataire', name: 'Entreprise Générale BTP (Demo)', contact: 'eg@demo.com' },
    ],
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z',
  };

  const demoSample: GeoLabSample = {
    id: sampleId,
    projectId,
    sampleId: 'DEMO-P1 (Sable sableuse)',
    depth: '1.50 - 2.50 m',
    location: 'Sondage P1 - PK 40+800 (DEMO)',
    samplingDate: '2026-10-20',
    sampler: 'E. Martin',
    materialType: 'Sable sableuse (Sm / A3 / D1)',
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  };

  await db.clients.put(demoClient);
  await db.geolabProjects.put(demoProject);
  await db.samples.put(demoSample);

  // Proctor analysis from Classeur1.xlsx
  const proctorInput = {
    mouldType: 'cbr' as const,
    mouldVolumeCm3: 2124,
    particleDensityGs: 2.82,
    targetCompactionPercent: 95,
    manualOpmMoisturePercent: 7.3,
    manualOpmDryDensityGcm3: 2.225,
    points: [
      { pointIndex: 1, waterContentPercent: 4.3, dryDensityGcm3: 2.115, wetDensityGcm3: 2.206 },
      { pointIndex: 2, waterContentPercent: 6.7, dryDensityGcm3: 2.213, wetDensityGcm3: 2.361 },
      { pointIndex: 3, waterContentPercent: 8.2, dryDensityGcm3: 2.21, wetDensityGcm3: 2.391 },
      { pointIndex: 4, waterContentPercent: 10.5, dryDensityGcm3: 2.129, wetDensityGcm3: 2.353 },
      { pointIndex: 5, waterContentPercent: 12.0, dryDensityGcm3: 2.04, wetDensityGcm3: 2.285 },
    ],
  };
  const proctorResults = proctorTestDefinition.calculate(proctorInput);
  const proctorWarnings = proctorTestDefinition.checks(proctorInput, proctorResults);

  const proctorAnalysis: GeoLabAnalysis = {
    id: 'analysis-proctor-1',
    sampleId,
    testType: 'proctor',
    standard: 'NF P94-093',
    reportNumber: 'DEMO-GL-2026-0001',
    version: 1,
    status: 'approved',
    testedDate: '2026-10-22',
    testedBy: 'J. Dupont',
    rawInput: proctorInput,
    computedResults: proctorResults,
    qualityWarnings: proctorWarnings,
    observations: '[DEMO] Essai Proctor conforme aux spécifications géotechniques (données de démonstration).',
    preparedBy: { name: 'J. Dupont', title: 'Technicien Géotechnique', date: '2026-10-22' },
    checkedBy: { name: 'M. Lambert, EurGeol', title: 'Responsable Assurance Qualité', date: '2026-10-23' },
    approvedBy: { name: 'Dr. H. Kemekong, P.Eng', title: 'Directeur Technique', date: '2026-10-23' },
    isDemo: true,
    revisionHistory: [
      {
        index: 1,
        date: '2026-10-22',
        natureOfChange: 'Émission initiale (Démonstration)',
        preparedBy: 'J. Dupont',
        checkedBy: 'M. Lambert, EurGeol',
        approvedBy: 'Dr. H. Kemekong, P.Eng',
      },
    ],
    createdAt: '2026-10-22T14:00:00.000Z',
    updatedAt: '2026-10-23T10:00:00.000Z',
  };

  // Grain size analysis from Classeur1.xlsx
  const grainSizeInput = {
    initialDryMassG: 2000,
    sieves: [
      { sieveMm: 25, passingPercent: 100 },
      { sieveMm: 20, passingPercent: 100 },
      { sieveMm: 16, passingPercent: 100 },
      { sieveMm: 12.5, passingPercent: 100 },
      { sieveMm: 10, passingPercent: 100 },
      { sieveMm: 5, passingPercent: 100 },
      { sieveMm: 2, passingPercent: 97.2 },
      { sieveMm: 1, passingPercent: 82.2 },
      { sieveMm: 0.5, passingPercent: 48.4 },
      { sieveMm: 0.4, passingPercent: 44.0 },
      { sieveMm: 0.315, passingPercent: 40.0 },
      { sieveMm: 0.2, passingPercent: 27.0 },
      { sieveMm: 0.08, passingPercent: 0.3 },
    ],
  };
  const grainSizeResults = grainSizeTestDefinition.calculate(grainSizeInput);
  const grainSizeWarnings = grainSizeTestDefinition.checks(grainSizeInput, grainSizeResults);

  const grainSizeAnalysis: GeoLabAnalysis = {
    id: 'analysis-grain-1',
    sampleId,
    testType: 'grain_size',
    standard: 'NF P94-056',
    reportNumber: 'DEMO-GL-2026-0002',
    version: 1,
    status: 'approved',
    testedDate: '2026-10-23',
    testedBy: 'J. Dupont',
    rawInput: grainSizeInput,
    computedResults: grainSizeResults,
    qualityWarnings: grainSizeWarnings,
    observations: '[DEMO] Matériau sableux propre à granularité continue. Classification LCPC : Sm (Sable propre mal gradué) ; GTR : D1 (Sol insensible à l\'eau).',
    preparedBy: { name: 'J. Dupont', title: 'Technicien Géotechnique', date: '2026-10-23' },
    checkedBy: { name: 'M. Lambert, EurGeol', title: 'Responsable Assurance Qualité', date: '2026-10-24' },
    approvedBy: { name: 'Dr. H. Kemekong, P.Eng', title: 'Directeur Technique', date: '2026-10-24' },
    isDemo: true,
    revisionHistory: [
      {
        index: 1,
        date: '2026-10-23',
        natureOfChange: 'Émission initiale (Démonstration)',
        preparedBy: 'J. Dupont',
        checkedBy: 'M. Lambert, EurGeol',
        approvedBy: 'Dr. H. Kemekong, P.Eng',
      },
    ],
    createdAt: '2026-10-23T11:00:00.000Z',
    updatedAt: '2026-10-24T09:00:00.000Z',
  };

  // Water content analysis from Classeur1.xlsx
  const waterContentInput = {
    directNaturalWaterContentPercent: 10.7,
    dryingTemperatureC: 105,
    maxTolerancePercent: 0.5,
    specimens: [
      { specimenId: 'A', containerId: 'T-1', tareMassG: 45.2, wetSoilPlusTareG: 198.6, drySoilPlusTareG: 183.8 },
      { specimenId: 'B', containerId: 'T-2', tareMassG: 44.8, wetSoilPlusTareG: 202.1, drySoilPlusTareG: 187.1 },
    ],
  };
  const waterContentResults = waterContentTestDefinition.calculate(waterContentInput);
  const waterContentWarnings = waterContentTestDefinition.checks(waterContentInput, waterContentResults);

  const waterContentAnalysis: GeoLabAnalysis = {
    id: 'analysis-water-1',
    sampleId,
    testType: 'water_content',
    standard: 'NF P94-050',
    reportNumber: 'DEMO-GL-2026-0003',
    version: 1,
    status: 'approved',
    testedDate: '2026-10-24',
    testedBy: 'J. Dupont',
    rawInput: waterContentInput,
    computedResults: waterContentResults,
    qualityWarnings: waterContentWarnings,
    observations: '[DEMO] Teneur en eau naturelle conforme aux sondages de reconnaissance géotechnique.',
    preparedBy: { name: 'J. Dupont', title: 'Technicien Géotechnique', date: '2026-10-24' },
    checkedBy: { name: 'M. Lambert, EurGeol', title: 'Responsable Assurance Qualité', date: '2026-10-24' },
    approvedBy: { name: 'Dr. H. Kemekong, P.Eng', title: 'Directeur Technique', date: '2026-10-24' },
    isDemo: true,
    revisionHistory: [
      {
        index: 1,
        date: '2026-10-24',
        natureOfChange: 'Émission initiale (Démonstration)',
        preparedBy: 'J. Dupont',
        checkedBy: 'M. Lambert, EurGeol',
        approvedBy: 'Dr. H. Kemekong, P.Eng',
      },
    ],
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T15:00:00.000Z',
  };

  await db.analyses.put(proctorAnalysis);
  await db.analyses.put(grainSizeAnalysis);
  await db.analyses.put(waterContentAnalysis);
}

export const ensureGeoLabDataSeeded = seedGeoLabDemoData;
