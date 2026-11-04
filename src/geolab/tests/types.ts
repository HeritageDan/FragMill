import type {
  GeoLabTestType,
  StandardBody,
  QualityWarning,
  ReportBlockDefinition,
  ValueProvenance,
} from '../../types/geolab';

export interface KeyResultItem {
  label: string;
  value: string | number;
  unit?: string;
  provenance?: ValueProvenance;
}

export interface FormFieldDefinition {
  key: string;
  label: { en: string; fr: string };
  type: 'number' | 'text' | 'select';
  unit?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  defaultValue?: any;
  options?: { value: string; label: { en: string; fr: string } }[];
  helperText?: { en: string; fr: string };
}

export interface TableColumnDefinition {
  key: string;
  label: { en: string; fr: string };
  unit?: string;
  type: 'number' | 'text';
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: any;
  decimals?: number;
}

export interface InputSchemaDefinition {
  parameters: FormFieldDefinition[];
  table?: {
    key: string;
    label: { en: string; fr: string };
    minRows: number;
    maxRows?: number;
    columns: TableColumnDefinition[];
    defaultRows?: any[];
  };
}

export interface GeoLabStandardRef {
  id: string;
  code: string; // e.g. 'NF P94-093'
  standardBody: StandardBody;
  title: { en: string; fr: string };
  description?: { en: string; fr: string };
}

export interface GeoLabTestDefinition<TInput = any, TResults = any> {
  id: GeoLabTestType;
  name: { en: string; fr: string };
  shortName: { en: string; fr: string };
  description: { en: string; fr: string };
  standards: GeoLabStandardRef[];
  defaultStandard: string;
  inputSchema: InputSchemaDefinition;
  calculate: (input: TInput, standard?: string) => TResults;
  checks: (input: TInput, results: TResults) => QualityWarning[];
  specLimits?: any;
  reportLayout: ReportBlockDefinition[];
  aiPromptContext: (input: TInput, results: TResults) => Record<string, any>;
  keyResults: (results: TResults, lang: 'en' | 'fr') => KeyResultItem[];
}

