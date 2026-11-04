import type { GeoLabTestType } from '../../types/geolab';
import type { GeoLabTestDefinition } from './types';
import { proctorTestDefinition } from './proctor';
import { grainSizeTestDefinition } from './grainSize';
import { waterContentTestDefinition } from './waterContent';
import { specificGravityTestDefinition } from './specificGravity';
import { bulkDensityTestDefinition } from './bulkDensity';
import { sandEquivalentTestDefinition } from './sandEquivalent';
import { losAngelesTestDefinition } from './losAngeles';
import { microDevalTestDefinition } from './microDeval';
import { flakinessTestDefinition } from './flakiness';
import { surfaceCleanlinessTestDefinition } from './surfaceCleanliness';
import { methyleneBlueTestDefinition } from './methyleneBlue';

export const GEOLAB_TESTS_REGISTRY: Record<GeoLabTestType, GeoLabTestDefinition> = {
  proctor: proctorTestDefinition,
  grain_size: grainSizeTestDefinition,
  water_content: waterContentTestDefinition,
  specific_gravity: specificGravityTestDefinition,
  bulk_density: bulkDensityTestDefinition,
  sand_equivalent: sandEquivalentTestDefinition,
  los_angeles: losAngelesTestDefinition,
  micro_deval: microDevalTestDefinition,
  flakiness: flakinessTestDefinition,
  surface_cleanliness: surfaceCleanlinessTestDefinition,
  methylene_blue: methyleneBlueTestDefinition,
};

export const GEOLAB_TEST_LIST: GeoLabTestDefinition[] = [
  proctorTestDefinition,
  grainSizeTestDefinition,
  waterContentTestDefinition,
  specificGravityTestDefinition,
  bulkDensityTestDefinition,
  sandEquivalentTestDefinition,
  losAngelesTestDefinition,
  microDevalTestDefinition,
  flakinessTestDefinition,
  surfaceCleanlinessTestDefinition,
  methyleneBlueTestDefinition,
];

export function getTestDefinition(testType: GeoLabTestType): GeoLabTestDefinition {
  const def = GEOLAB_TESTS_REGISTRY[testType];
  if (!def) {
    throw new Error(`Unsupported GeoLab test type: ${testType}`);
  }
  return def;
}

export * from './types';
export * from './proctor';
export * from './grainSize';
export * from './waterContent';
export * from './specificGravity';
export * from './bulkDensity';
export * from './sandEquivalent';
export * from './losAngeles';
export * from './microDeval';
export * from './flakiness';
export * from './surfaceCleanliness';
export * from './methyleneBlue';


