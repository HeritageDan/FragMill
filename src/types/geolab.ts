export type GeoLabModule = 'fragmill' | 'geolab';

export type GeoLabTestType = 'proctor' | 'grain_size' | 'water_content';

export type AnalysisStatus = 'draft' | 'checked' | 'approved';

export type StandardBody = 'NF' | 'ASTM' | 'AASHTO';

export interface GeoLabSignatory {
  role: 'prepared' | 'checked' | 'approved';
  name: string;
  title: string;
}

export interface OrganisationProfile {
  companyName: string;
  logoBase64?: string;
  address: string;
  phone: string;
  email: string;
  accreditationNumber: string;
  primaryColor: string; // e.g. '#1e40af'
  signatories: GeoLabSignatory[];
  reportFooterText: string;
  defaultLanguage: 'en' | 'fr';
  defaultStandard: StandardBody;
}

export interface GeoLabClient {
  id: string;
  companyName: string;
  contactPerson: string;
  jobTitle?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  clientLogoBase64?: string;
  taxRegistrationNumber?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLabProject {
  id: string;
  clientId: string;
  projectName: string;
  siteLocation: string;
  referenceNumber: string;
  startDate: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLabSample {
  id: string;
  projectId: string;
  sampleId: string;
  depth?: string;
  location?: string;
  samplingDate: string;
  sampler?: string;
  materialType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityWarning {
  code: string;
  level: 'warning' | 'error' | 'info';
  message: {
    en: string;
    fr: string;
  };
}

export interface GeoLabAnalysis<TInput = any, TResults = any> {
  id: string;
  sampleId: string;
  testType: GeoLabTestType;
  standard: string;
  reportNumber: string;
  version: number;
  status: AnalysisStatus;
  testedDate: string;
  testedBy?: string;
  rawInput: TInput;
  computedResults: TResults;
  qualityWarnings: QualityWarning[];
  observations?: string;
  aiNarrative?: string;
  aiNarrativeApproved?: boolean;
  preparedBy?: { name: string; title: string; date: string };
  checkedBy?: { name: string; title: string; date: string };
  approvedBy?: { name: string; title: string; date: string };
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Report Engine Block Types
// -------------------------------------------------------------
export type ReportBlockType =
  | 'header'
  | 'client_project'
  | 'raw_data_table'
  | 'results_table'
  | 'chart'
  | 'conformity_table'
  | 'observations'
  | 'signatures'
  | 'footer';

export interface ReportTableColumn {
  key: string;
  label: { en: string; fr: string };
  unit?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'number' | 'percent' | 'text';
  decimals?: number;
}

export interface ReportTableRow {
  [key: string]: any;
}

export interface ReportChartSeries {
  name: { en: string; fr: string };
  xKey: string;
  yKey: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'none';
  marker?: 'circle' | 'square' | 'none';
  trendline?: 'polynomial' | 'linear' | 'none';
  polynomialOrder?: number;
}

export interface ReportChartConfig {
  chartType: 'scatter' | 'line';
  title: { en: string; fr: string };
  xLabel: { en: string; fr: string };
  yLabel: { en: string; fr: string };
  xLog?: boolean;
  yLog?: boolean;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  series: ReportChartSeries[];
}

export interface ConformityItem {
  parameter: { en: string; fr: string };
  measuredValue: string | number;
  specifiedLimit: string;
  isConform: boolean | null; // null if informative
  note?: string;
}

export interface ReportBlockDefinition {
  type: ReportBlockType;
  title?: { en: string; fr: string };
  tableColumns?: ReportTableColumn[];
  tableDataKey?: string;
  resultsKey?: string;
  chartConfig?: ReportChartConfig;
  conformityItemsKey?: string;
}
