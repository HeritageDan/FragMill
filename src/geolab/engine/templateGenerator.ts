import * as xlsx from 'xlsx';
import type { GeoLabTestType } from '../../types/geolab';
import { getTestDefinition } from '../tests/index';

export function generateInputTemplateXlsx(testType: GeoLabTestType, lang: 'en' | 'fr' = 'fr'): Blob {
  const testDef = getTestDefinition(testType);
  const wb = xlsx.utils.book_new();

  const titleRow = [`GeoLab - ${testDef.name[lang]} (${testDef.defaultStandard})`];
  const blankRow = [''];
  const instructionsRow = [
    lang === 'fr'
      ? 'Consignes : Remplir les paramètres généraux et les données du tableau ci-dessous. Ne pas modifier les intitulés.'
      : 'Instructions: Fill in the parameters and table measurements below. Do not modify the header labels.',
  ];

  const paramRows: any[][] = [];
  testDef.inputSchema.parameters.forEach((param) => {
    paramRows.push([
      param.label[lang],
      param.defaultValue ?? '',
      param.unit ? `[${param.unit}]` : '',
      param.helperText ? param.helperText[lang] : '',
    ]);
  });

  const tableHeader = testDef.inputSchema.table
    ? testDef.inputSchema.table.columns.map((c) => `${c.label[lang]}${c.unit ? ` (${c.unit})` : ''}`)
    : [];

  const exampleRows: any[][] = [];
  if (testDef.inputSchema.table && testDef.inputSchema.table.defaultRows) {
    testDef.inputSchema.table.defaultRows.forEach((rowObj) => {
      const rowArr = testDef.inputSchema.table!.columns.map((c) => rowObj[c.key] ?? '');
      exampleRows.push(rowArr);
    });
  }

  const sheetData: any[][] = [
    titleRow,
    instructionsRow,
    blankRow,
    [lang === 'fr' ? 'PARAMÈTRES GÉNÉRAUX' : 'GENERAL PARAMETERS', '', '', ''],
    ...paramRows,
    blankRow,
    [testDef.inputSchema.table?.label[lang].toUpperCase() || 'DONNÉES'],
    tableHeader,
    ...exampleRows,
  ];

  const ws = xlsx.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 32 },
    { wch: 20 },
    { wch: 15 },
    { wch: 40 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];

  xlsx.utils.book_append_sheet(wb, ws, 'Data Entry');
  const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
