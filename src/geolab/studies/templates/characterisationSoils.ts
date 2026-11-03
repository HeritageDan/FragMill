import type { StudyTemplate } from '../../../types/geolab';

export const characterisationSoilsTemplate: StudyTemplate = {
  id: 'characterisation_soils',
  name: {
    en: 'Characterisation study (soils and materials)',
    fr: 'Étude de caractérisation (sols et matériaux routiers)',
  },
  description: {
    en: 'Comprehensive geotechnical characterisation report with summary tables, grading envelopes, Proctor curves, conformity assessment, and test certificates.',
    fr: 'Rapport complet de caractérisation géotechnique avec tableaux récapitulatifs, fuseaux granulométriques, courbes Proctor, conformité et procès-verbaux.',
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
      type: 'narrative',
      title: { en: '1. INTRODUCTION', fr: '1. INTRODUCTION' },
      enabled: true,
      content:
        '# 1. INTRODUCTION\n' +
        'This geotechnical characterisation study presents the synthesis of laboratory identification and compaction tests performed on soil and road materials sampled in the framework of the project.\n\n' +
        'The main objectives of this investigation are:\n' +
        '- Verification of physical identification properties (particle size distribution, water content);\n' +
        '- Determination of standard/modified compaction characteristics (optimum moisture content and maximum dry density);\n' +
        '- Assessment of conformity with technical project specifications for earthworks and road pavement layers.',
    },
    {
      type: 'narrative',
      title: {
        en: '2. MATERIALS DESCRIPTION & SAMPLING',
        fr: '2. DESCRIPTION DES MATÉRIAUX ET ÉCHANTILLONNAGE',
      },
      enabled: true,
      content:
        '# 2. DESCRIPTION OF MATERIALS AND SAMPLING\n' +
        'Samples were retrieved directly on-site in accordance with applicable geotechnical sampling standards. Each sample was carefully packed, labelled, and transported to the laboratory under controlled conditions.\n\n' +
        '- Visual identification and macroscopic description were systematically performed upon sample receipt;\n' +
        '- Sample preparation, quartering, and moisture conditioning conformed to applicable normative requirements.',
    },
    {
      type: 'analysisSummaryTable',
      title: {
        en: '3. SUMMARY OF TEST RESULTS',
        fr: '3. RÉCAPITULATIF DES ESSAIS',
      },
      enabled: true,
    },
    {
      type: 'analysisDetail',
      title: {
        en: '4. DETAILED ANALYSIS RESULTS',
        fr: '4. RÉSULTATS DÉTAILLÉS DES ESSAIS',
      },
      enabled: true,
    },
    {
      type: 'gradingCurves',
      title: {
        en: '5. GRANULOMETRIC CURVES & ENVELOPES',
        fr: '5. COURBES GRANULOMÉTRIQUES ET FUSEAUX',
      },
      enabled: true,
    },
    {
      type: 'conformityTable',
      title: {
        en: '6. CONFORMITY WITH SPECIFICATIONS',
        fr: '6. CONFORMITÉ AUX SPÉCIFICATIONS',
      },
      enabled: true,
    },
    {
      type: 'narrative',
      title: {
        en: '7. GEOTECHNICAL RECOMMENDATIONS',
        fr: '7. RECOMMANDATIONS GÉOTECHNIQUES',
      },
      enabled: true,
      content:
        '# 7. GEOTECHNICAL RECOMMENDATIONS\n' +
        'Based on the synthesized laboratory test results and the geotechnical classification of the tested materials:\n\n' +
        '- Compaction procedures on-site should target 95% to 98% of the Maximum Dry Density (OPM/OPN) at moisture contents within +/- 2% of the optimum moisture content;\n' +
        '- Suitable drainage and surface protection measures should be maintained during execution to preserve the natural mechanical stability of compacted layers.',
    },
    {
      type: 'narrative',
      title: {
        en: '8. GENERAL CONCLUSION',
        fr: '8. CONCLUSION GÉNÉRALE',
      },
      enabled: true,
      content:
        '# 8. GENERAL CONCLUSION\n' +
        'The laboratory testing program was completed in strict accordance with referenced test standards and laboratory quality management procedures.\n\n' +
        'The measured parameters provide the engineering baseline required for technical approval and geotechnical design verification.',
    },
    {
      type: 'usageNote',
      title: {
        en: 'IMPORTANT NOTE ON USE OF RESULTS',
        fr: "NOTE IMPORTANTE SUR L'UTILISATION DES RÉSULTATS",
      },
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
    {
      type: 'photoPages',
      title: {
        en: 'ANNEX A: PHOTOGRAPHIC DOCUMENTATION',
        fr: 'ANNEXE A : DOCUMENTATION PHOTOGRAPHIQUE',
      },
      enabled: true,
    },
    {
      type: 'annexTestSheets',
      title: {
        en: 'ANNEX B: INDIVIDUAL TEST CERTIFICATES',
        fr: "ANNEXE B : PROCÈS-VERBAUX D'ESSAIS",
      },
      enabled: true,
    },
    {
      type: 'dataQualityNotes',
      title: {
        en: 'DATA QUALITY & REPEATABILITY NOTES',
        fr: 'NOTES SUR LA QUALITÉ ET RÉPÉTABILITÉ',
      },
      enabled: true,
    },
  ],
};
