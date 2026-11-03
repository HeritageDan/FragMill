import { characterisationSoilsTemplate } from './characterisationSoils';
import { blankStudyTemplate } from './blankStudy';
import type { StudyTemplate } from '../../../types/geolab';

export const STUDY_TEMPLATES: StudyTemplate[] = [
  characterisationSoilsTemplate,
  blankStudyTemplate,
];

export function getStudyTemplate(id: string): StudyTemplate | undefined {
  return STUDY_TEMPLATES.find((t) => t.id === id);
}

