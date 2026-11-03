import type { StudyTemplate } from '../../../types/geolab';

export const blankStudyTemplate: StudyTemplate = {
  id: 'blank_study',
  name: {
    en: 'Blank study',
    fr: 'Étude vierge',
  },
  description: {
    en: 'Minimal study skeleton containing cover page, table of contents, and signature block.',
    fr: 'Squelette minimal d’étude contenant la page de garde, le sommaire et le bloc de signatures.',
  },
  acceptedAnalysisTypes: ['proctor', 'grain_size', 'water_content'],
  sections: [
    {
      type: 'cover',
      title: { en: 'Cover Page', fr: 'Page de garde' },
      enabled: true,
    },
    {
      type: 'toc',
      title: { en: 'Table of Contents', fr: 'Sommaire' },
      enabled: true,
    },
    {
      type: 'signatureBlock',
      title: {
        en: 'APPROVALS & SIGNATURES',
        fr: 'VISAS ET APPROBATIONS',
      },
      enabled: true,
    },
  ],
};
