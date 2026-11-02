import type { GeoLabTestType } from '../../types/geolab';
import type { GeoLabTestDefinition } from './types';
import { proctorTestDefinition } from './proctor';
import { grainSizeTestDefinition } from './grainSize';
import { waterContentTestDefinition } from './waterContent';

export const GEOLAB_TESTS_REGISTRY: Record<GeoLabTestType, GeoLabTestDefinition> = {
  proctor: proctorTestDefinition,
  grain_size: grainSizeTestDefinition,
  water_content: waterContentTestDefinition,
};

export const GEOLAB_TEST_LIST: GeoLabTestDefinition[] = [
  proctorTestDefinition,
  grainSizeTestDefinition,
  waterContentTestDefinition,
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

