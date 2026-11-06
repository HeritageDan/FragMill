import JSZip from 'jszip';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
  AnalysisRevision,
} from '../../types/geolab';
import type { GeoLabTestDefinition } from '../tests/types';
import { getTestDefinition } from '../tests/index';
import type { ProctorInput, ProctorResults, ProctorFitMethod } from '../tests/proctor';
import type { GrainSizeInput, GrainSizeResults } from '../tests/grainSize';
import type { WaterContentInput, WaterContentResults } from '../tests/waterContent';

export interface ExcelGenerationOptions {
  analysis: GeoLabAnalysis;
  client: GeoLabClient;
  project: GeoLabProject;
  sample: GeoLabSample;
  orgProfile: OrganisationProfile;
  testDef: GeoLabTestDefinition;
  language?: 'en' | 'fr';
}

export { generateSoilSummaryExcelReport, type SoilSummaryExcelOptions } from './soilSummaryExcelGenerator';

interface EmbeddedLogo {
  id: string;
  fileName: string;
  b64: string;
  ext: 'png' | 'jpg';
  position: 'left' | 'center' | 'right';
}

function escapeXml(unsafe: any): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a styled OpenXML spreadsheet with live Excel formulas, embedded logos, and native DrawingML charts.
 */
export async function generateGeoLabExcelReport(options: ExcelGenerationOptions): Promise<Blob> {
  const { analysis, client, project, sample, orgProfile, testDef } = options;
  const lang = options.language || orgProfile.defaultLanguage || 'en';

  // Enforce company name requirement on approved reports
  if (analysis.status === 'approved' && !orgProfile.companyName?.trim()) {
    throw new Error(
      lang === 'fr'
        ? 'Veuillez configurer le profil de votre organisation avant de générer des rapports approuvés.'
        : 'Please configure your organisation profile before generating approved reports.'
    );
  }

  const isDemo = Boolean(
    analysis.isDemo ||
    project.isDemo ||
    client.isDemo ||
    client.companyName === 'Demo Client' ||
    analysis.reportNumber?.startsWith('DEMO-')
  );
  const watermarkText = isDemo ? 'DEMO' : (analysis.status === 'approved' ? '' : 'DRAFT / PROVISOIRE');

  const zip = new JSZip();

  // Extract embedded logos (up to 3 header logos + main logo)
  const logos: EmbeddedLogo[] = [];
  const headerLogos = orgProfile.headerLogos || (orgProfile as any).logos;
  const leftB64 = headerLogos?.leftBase64 || headerLogos?.left || orgProfile.logoBase64;
  if (leftB64) {
    const ext = leftB64.includes('image/jpeg') || leftB64.includes('image/jpg') ? 'jpg' : 'png';
    const cleanB64 = leftB64.replace(/^data:image\/\w+;base64,/, '');
    logos.push({ id: 'rIdLogoLeft', fileName: `imageLeft.${ext}`, b64: cleanB64, ext, position: 'left' });
  }

  const centerB64 = headerLogos?.centerBase64 || headerLogos?.center;
  if (centerB64) {
    const ext = centerB64.includes('image/jpeg') || centerB64.includes('image/jpg') ? 'jpg' : 'png';
    const cleanB64 = centerB64.replace(/^data:image\/\w+;base64,/, '');
    logos.push({ id: 'rIdLogoCenter', fileName: `imageCenter.${ext}`, b64: cleanB64, ext, position: 'center' });
  }

  const rightB64 = headerLogos?.rightBase64 || headerLogos?.right;
  if (rightB64) {
    const ext = rightB64.includes('image/jpeg') || rightB64.includes('image/jpg') ? 'jpg' : 'png';
    const cleanB64 = rightB64.replace(/^data:image\/\w+;base64,/, '');
    logos.push({ id: 'rIdLogoRight', fileName: `imageRight.${ext}`, b64: cleanB64, ext, position: 'right' });
  }

  // Save logo binaries to xl/media/
  for (const logo of logos) {
    zip.file(`xl/media/${logo.fileName}`, logo.b64, { base64: true });
  }

  // Build Sheet XML based on test type (native DrawingML charts only, zero screenshot images)
  const { sheetXml, chartXml, hasChart } = buildTestSheetAndChart(
    testDef.id,
    analysis,
    client,
    project,
    sample,
    orgProfile,
    lang,
    watermarkText
  );

  const hasDrawing = hasChart || logos.length > 0;

  // [Content_Types].xml
  zip.file('[Content_Types].xml', getContentTypesXml(hasChart, hasDrawing, logos));

  // _rels/.rels
  zip.file('_rels/.rels', getGlobalRelsXml());

  // xl/workbook.xml
  const sheetName = lang === 'fr' ? 'Rapport' : 'Report';
  zip.file('xl/workbook.xml', getWorkbookXml(sheetName));

  // xl/_rels/workbook.xml.rels
  zip.file('xl/_rels/workbook.xml.rels', getWorkbookRelsXml());

  // xl/styles.xml
  zip.file('xl/styles.xml', getStylesXml(orgProfile.primaryColor));

  // xl/worksheets/sheet1.xml
  const finalSheetXml = hasDrawing ? sheetXml : sheetXml.replace(/<drawing\s+r:id="rId1"\s*\/>/, '');
  zip.file('xl/worksheets/sheet1.xml', finalSheetXml);

  if (hasDrawing) {
    // xl/worksheets/_rels/sheet1.xml.rels
    zip.file(
      'xl/worksheets/_rels/sheet1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`
    );

    // xl/drawings/drawing1.xml
    zip.file('xl/drawings/drawing1.xml', getDrawingXml(logos, hasChart));

    // xl/drawings/_rels/drawing1.xml.rels
    zip.file('xl/drawings/_rels/drawing1.xml.rels', getDrawingRelsXml(logos, hasChart));

    if (hasChart && chartXml) {
      // xl/charts/chart1.xml
      zip.file('xl/charts/chart1.xml', chartXml);
    }
  }

  // docProps
  zip.file('docProps/core.xml', getCorePropsXml(analysis.reportNumber, orgProfile.companyName));
  zip.file('docProps/app.xml', getAppPropsXml());

  const content = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return content;
}

// -------------------------------------------------------------
// Sheet & Chart Builder per Test Type
// -------------------------------------------------------------
function buildTestSheetAndChart(
  testType: string,
  analysis: GeoLabAnalysis,
  client: GeoLabClient,
  project: GeoLabProject,
  sample: GeoLabSample,
  org: OrganisationProfile,
  lang: 'en' | 'fr',
  watermark: string
): { sheetXml: string; chartXml: string | null; hasChart: boolean } {
  if (testType === 'proctor') {
    return buildProctorSheet(analysis, client, project, sample, org, lang, watermark);
  }
  if (testType === 'grain_size') {
    return buildGrainSizeSheet(analysis, client, project, sample, org, lang, watermark);
  }
  if (testType === 'water_content') {
    return buildWaterContentSheet(analysis, client, project, sample, org, lang, watermark);
  }
  return buildGenericSheet(analysis, client, project, sample, org, lang, watermark);
}

// -------------------------------------------------------------
// Common Revision Table and Signatures Builders
// -------------------------------------------------------------
function buildRevisionTableRows(analysis: GeoLabAnalysis, lang: 'en' | 'fr', startRow: number): { xml: string; nextRow: number } {
  const revisions: AnalysisRevision[] = (analysis.revisionHistory && analysis.revisionHistory.length > 0)
    ? analysis.revisionHistory
    : [
        {
          index: analysis.version || 1,
          date: analysis.testedDate,
          natureOfChange: lang === 'fr' ? 'Émission initiale' : 'Initial issue',
          preparedBy: analysis.preparedBy?.name || '',
          checkedBy: analysis.checkedBy?.name || '',
          approvedBy: analysis.approvedBy?.name || '',
        },
      ];

  let xml = `
  <row r="${startRow}">
    <c r="A${startRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'HISTORIQUE DES RÉVISIONS' : 'REVISION HISTORY'}</t></is></c>
  </row>
  <row r="${startRow + 1}">
    <c r="A${startRow + 1}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Indice' : 'Rev'}</t></is></c>
    <c r="B${startRow + 1}" t="inlineStr" s="8"><is><t>Date</t></is></c>
    <c r="C${startRow + 1}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Nature de la modification' : 'Nature of change'}</t></is></c>
    <c r="E${startRow + 1}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Établi par' : 'Prepared by'}</t></is></c>
    <c r="F${startRow + 1}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Vérifié par' : 'Checked by'}</t></is></c>
    <c r="G${startRow + 1}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Approuvé par' : 'Approved by'}</t></is></c>
  </row>`;

  let cur = startRow + 2;
  revisions.forEach((rev) => {
    xml += `<row r="${cur}">
      <c r="A${cur}" s="9"><v>${rev.index}</v></c>
      <c r="B${cur}" t="inlineStr" s="9"><is><t>${escapeXml(rev.date)}</t></is></c>
      <c r="C${cur}" t="inlineStr" s="6"><is><t>${escapeXml(rev.natureOfChange)}</t></is></c>
      <c r="E${cur}" t="inlineStr"><is><t>${escapeXml(rev.preparedBy || '')}</t></is></c>
      <c r="F${cur}" t="inlineStr"><is><t>${escapeXml(rev.checkedBy || '')}</t></is></c>
      <c r="G${cur}" t="inlineStr"><is><t>${escapeXml(rev.approvedBy || '')}</t></is></c>
    </row>`;
    cur++;
  });

  return { xml, nextRow: cur };
}

function buildSignaturesRows(
  analysis: GeoLabAnalysis,
  org: OrganisationProfile,
  lang: 'en' | 'fr',
  startRow: number
): string {
  const chain = (org.approvalChain && org.approvalChain.length > 0)
    ? org.approvalChain.slice(0, 6)
    : [
        {
          id: 'sig-1',
          roleLabel: { en: 'Tested by', fr: 'Essai réalisé par' },
          name: analysis.preparedBy?.name || org.signatories[0]?.name || '',
          title: analysis.preparedBy?.title || org.signatories[0]?.title || '',
        },
        {
          id: 'sig-2',
          roleLabel: { en: 'Checked by', fr: 'Vérifié par' },
          name: analysis.checkedBy?.name || org.signatories[1]?.name || '',
          title: analysis.checkedBy?.title || org.signatories[1]?.title || '',
        },
        {
          id: 'sig-3',
          roleLabel: { en: 'Approved by', fr: 'Approuvé par' },
          name: analysis.approvedBy?.name || org.signatories[2]?.name || '',
          title: analysis.approvedBy?.title || org.signatories[2]?.title || '',
        },
      ];

  let xml = '';
  // Split chain into chunks of 3 for multi-row rendering
  for (let chunkIdx = 0; chunkIdx < chain.length; chunkIdx += 3) {
    const chunk = chain.slice(chunkIdx, chunkIdx + 3);
    const rowOffset = startRow + (chunkIdx / 3) * 4;

    const cols = ['A', 'C', 'E'];
    // Row 1: Role labels
    xml += `<row r="${rowOffset}">`;
    chunk.forEach((sig, idx) => {
      const col = cols[idx];
      const roleText = sig.roleLabel?.[lang] || sig.title || `Signataire ${chunkIdx + idx + 1}`;
      xml += `<c r="${col}${rowOffset}" t="inlineStr" s="8"><is><t>${escapeXml(roleText)}</t></is></c>`;
    });
    xml += `</row>`;

    // Row 2: Signatory Names
    xml += `<row r="${rowOffset + 1}">`;
    chunk.forEach((sig, idx) => {
      const col = cols[idx];
      xml += `<c r="${col}${rowOffset + 1}" t="inlineStr" s="6"><is><t>${escapeXml(sig.name || '')}</t></is></c>`;
    });
    xml += `</row>`;

    // Row 3: Titles / Functions
    xml += `<row r="${rowOffset + 2}">`;
    chunk.forEach((sig, idx) => {
      const col = cols[idx];
      xml += `<c r="${col}${rowOffset + 2}" t="inlineStr"><is><t>${escapeXml(sig.title || '')}</t></is></c>`;
    });
    xml += `</row>`;

    // Row 4: Signature / Stamp Mention
    xml += `<row r="${rowOffset + 3}">`;
    chunk.forEach((sig, idx) => {
      const col = cols[idx];
      const stampText = sig.stampOrSignatureBase64
        ? (lang === 'fr' ? '[Cachet / Signature numérique authentifiée]' : '[Digital Stamp / Verified Signature]')
        : (lang === 'fr' ? '[Signature manuscrite]' : '[Handwritten Signature]');
      xml += `<c r="${col}${rowOffset + 3}" t="inlineStr" s="4"><is><t>${stampText}</t></is></c>`;
    });
    xml += `</row>`;
  }

  return xml;
}

// -------------------------------------------------------------
// PROCTOR EXCEL & DRAWINGML CHART
// -------------------------------------------------------------
function buildProctorSheet(
  analysis: GeoLabAnalysis<ProctorInput, ProctorResults>,
  client: GeoLabClient,
  project: GeoLabProject,
  sample: GeoLabSample,
  org: OrganisationProfile,
  lang: 'en' | 'fr',
  watermark: string
) {
  const input = analysis.rawInput;
  const res = analysis.computedResults;
  const pts = res.points || [];

  const formCode = org.formCodes?.proctor || 'PR2-FOR-02';
  const accreditationLabel = org.accreditationNumber?.trim()
    ? `${lang === 'fr' ? "N° d'agrément / d'accréditation : " : 'Agrément / Accreditation no.: '}${escapeXml(org.accreditationNumber)}`
    : '';
  const orgContact = [
    org.address,
    org.phone ? `${lang === 'fr' ? 'Tél: ' : 'Tel: '}${org.phone}` : '',
    org.email,
  ].filter(Boolean).join(' | ');

  let rowsXml = '';
  // Row 1: Org Name, Contact & Accreditation
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    ${orgContact ? `<c r="D1" t="inlineStr" s="0"><is><t>${escapeXml(orgContact)}</t></is></c>` : ''}
    ${accreditationLabel ? `<c r="G1" t="inlineStr" s="2"><is><t>${accreditationLabel}</t></is></c>` : ''}
  </row>`;

  // Row 2: Document Title & Form Code
  const titleText = lang === 'fr' ? "PROCES-VERBAL D'ESSAI PROCTOR" : 'PROCTOR COMPACTION TEST REPORT';
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${titleText} - ${escapeXml(analysis.standard)}</t></is></c>
    <c r="G2" t="inlineStr" s="2"><is><t>${lang === 'fr' ? 'Formulaire : ' : 'Form: '}${escapeXml(formCode)}</t></is></c>
  </row>`;

  // Row 3: Meta & Watermark
  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="G3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
  </row>`;

  // Row 4: Blank
  rowsXml += `<row r="4"/>`;

  // Rows 5-8: Project & Client Block (with Programme, Lot, Contract, Financing)
  const progText = project.programmeTitle || project.programme;
  const projectDisplay = progText ? `${project.projectName} / ${progText}` : project.projectName;
  const financeDisplay = project.financingText || project.financing || '-';

  rowsXml += `
  <row r="5">
    <c r="A5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Client :' : 'Client:'}</t></is></c>
    <c r="B5" t="inlineStr"><is><t>${escapeXml(client.companyName)} (${escapeXml(client.contactPerson)})</t></is></c>
    <c r="D5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Échantillon :' : 'Sample ID:'}</t></is></c>
    <c r="E5" t="inlineStr"><is><t>${escapeXml(sample.sampleId)}</t></is></c>
  </row>
  <row r="6">
    <c r="A6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Projet :' : 'Project:'}</t></is></c>
    <c r="B6" t="inlineStr"><is><t>${escapeXml(projectDisplay)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Profondeur :' : 'Depth:'}</t></is></c>
    <c r="E6" t="inlineStr"><is><t>${escapeXml(sample.depth || '-')}</t></is></c>
  </row>
  <row r="7">
    <c r="A7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Site / Lieu :' : 'Site Location:'}</t></is></c>
    <c r="B7" t="inlineStr"><is><t>${escapeXml(project.siteLocation)}</t></is></c>
    <c r="D7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Masse vol. grains (ρs) :' : 'Particle Density (ρs):'}</t></is></c>
    <c r="E7" s="7"><v>${input.particleDensityGs || 2.82}</v></c>
  </row>
  <row r="8">
    <c r="A8" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Marché / Lot :' : 'Contract / Lot:'}</t></is></c>
    <c r="B8" t="inlineStr"><is><t>${escapeXml(project.contractNumber || project.referenceNumber || '-')} / ${escapeXml(project.lotSection || '-')}</t></is></c>
    <c r="D8" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Financement :' : 'Financing:'}</t></is></c>
    <c r="E8" t="inlineStr"><is><t>${escapeXml(financeDisplay)}</t></is></c>
  </row>`;

  // Row 9: Table Header
  rowsXml += `<row r="9" ht="20">
    <c r="A9" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Point' : 'Point'}</t></is></c>
    <c r="B9" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'w mesuré (%)' : 'Moisture w (%)'}</t></is></c>
    <c r="C9" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Masse vol. humide ρ' : 'Wet Density ρ'}</t></is></c>
    <c r="D9" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Masse vol. sèche ρd' : 'Dry Density ρd'}</t></is></c>
    <c r="E9" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Compacité (%)' : 'Compaction (%)'}</t></is></c>
    <c r="F9" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'w sat (Sr=100%)' : 'w sat (Sr=100%)'}</t></is></c>
  </row>`;

  // Rows 10 to 10+N: Data rows with live Excel formulas
  pts.forEach((p, idx) => {
    const rowNum = 10 + idx;
    rowsXml += `<row r="${rowNum}">
      <c r="A${rowNum}" s="9"><v>${p.pointIndex}</v></c>
      <c r="B${rowNum}" s="10"><v>${p.waterContentPercent}</v></c>
      <c r="C${rowNum}" s="11"><v>${p.wetDensityGcm3}</v></c>
      <c r="D${rowNum}" s="11"><f>C${rowNum}/(1+B${rowNum}/100)</f><v>${p.dryDensityGcm3}</v></c>
      <c r="E${rowNum}" s="10"><f>D${rowNum}/$B$17*100</f><v>${p.compactionPercentOfOpm || 0}</v></c>
      <c r="F${rowNum}" s="10"><f>100*((1/D${rowNum})-(1/$E$7))</f><v>${p.saturationWaterContentPercent}</v></c>
    </row>`;
  });

  const lastDataRow = 9 + pts.length;
  const summaryStartRow = lastDataRow + 2;

  // Key Results Summary Block
  const fitMethodLabels: Record<string, { en: string; fr: string }> = {
    quadratic: { en: 'Polynomial degree 2 (quadratic)', fr: 'Polynôme degré 2 (quadratique)' },
    cubic: { en: 'Polynomial degree 3 (cubic)', fr: 'Polynôme degré 3 (cubique)' },
    quartic: { en: 'Polynomial degree 4 (quartic)', fr: 'Polynôme degré 4 (quartique)' },
    manual: { en: 'Manually entered value', fr: 'Valeur saisie manuellement' },
  };
  const fitMethodDisplay = fitMethodLabels[res.fitMethod]
    ? fitMethodLabels[res.fitMethod][lang]
    : (res.fitMethod === 'manual' ? (lang === 'fr' ? 'Valeur saisie manuellement' : 'Manually entered value') : res.fitMethod);

  rowsXml += `
  <row r="${summaryStartRow}">
    <c r="A${summaryStartRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'PARAMÈTRE OPM' : 'OPM PARAMETER'}</t></is></c>
    <c r="B${summaryStartRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'VALEUR' : 'VALUE'}</t></is></c>
    <c r="C${summaryStartRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'UNITÉ' : 'UNIT'}</t></is></c>
  </row>
  <row r="${summaryStartRow + 1}">
    <c r="A${summaryStartRow + 1}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Teneur en eau Optimum (w_opm)' : 'Optimum Moisture Content (w_opm)'}</t></is></c>
    <c r="B${summaryStartRow + 1}" s="10"><v>${res.opmMoisturePercent}</v></c>
    <c r="C${summaryStartRow + 1}" t="inlineStr"><is><t>%</t></is></c>
  </row>
  <row r="${summaryStartRow + 2}">
    <c r="A${summaryStartRow + 2}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Densité sèche maximale (ρd_opm)' : 'Maximum Dry Density (ρd_opm)'}</t></is></c>
    <c r="B${summaryStartRow + 2}" s="11"><v>${res.maxDryDensityGcm3}</v></c>
    <c r="C${summaryStartRow + 2}" t="inlineStr"><is><t>g/cm³</t></is></c>
  </row>
  <row r="${summaryStartRow + 3}">
    <c r="A${summaryStartRow + 3}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Densité sèche cible (95% OPM)' : 'Target Dry Density (95% OPM)'}</t></is></c>
    <c r="B${summaryStartRow + 3}" s="11"><f>B${summaryStartRow + 2}*0.95</f><v>${res.targetDryDensityGcm3}</v></c>
    <c r="C${summaryStartRow + 3}" t="inlineStr"><is><t>g/cm³</t></is></c>
  </row>
  <row r="${summaryStartRow + 4}">
    <c r="A${summaryStartRow + 4}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? "Méthode d'ajustement :" : 'Fit Method:'}</t></is></c>
    <c r="B${summaryStartRow + 4}" t="inlineStr"><is><t>${escapeXml(fitMethodDisplay)}</t></is></c>
    <c r="C${summaryStartRow + 4}" t="inlineStr"><is><t>${res.fittedCoefficients?.r2 ? `R² = ${res.fittedCoefficients.r2}` : ''}</t></is></c>
  </row>`;

  // Revision Table
  const revStartRow = summaryStartRow + 6;
  const { xml: revXml, nextRow: afterRevRow } = buildRevisionTableRows(analysis, lang, revStartRow);
  rowsXml += revXml;

  // Observations / Signatures
  const obsRow = afterRevRow + 1;
  rowsXml += `
  <row r="${obsRow}">
    <c r="A${obsRow}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Observations :' : 'Observations:'}</t></is></c>
    <c r="B${obsRow}" t="inlineStr"><is><t>${escapeXml(analysis.observations || analysis.aiNarrative || 'Conforme aux exigences normatives.')}</t></is></c>
  </row>`;

  // Configurable Approval Chain (Up to 6 signatories)
  rowsXml += buildSignaturesRows(analysis, org, lang, obsRow + 2);

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0" showGridLines="1"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="19"/>
  <cols>
    <col min="1" max="1" width="10" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="3" width="16" customWidth="1"/>
    <col min="4" max="4" width="16" customWidth="1"/>
    <col min="5" max="5" width="14" customWidth="1"/>
    <col min="6" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="4" customWidth="1"/>
    <col min="8" max="16" width="12" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
  <drawing r:id="rId1"/>
</worksheet>`;

  // Build DrawingML Chart (Scatter chart with polynomial compaction curve and saturation curve)
  const chartXml = buildProctorChartXml(
    10,
    lastDataRow,
    lang,
    res.fitMethod,
    res.fittedCoefficients?.polynomialOrder,
    pts
  );

  return { sheetXml, chartXml, hasChart: true };
}

function buildProctorChartXml(
  startRow: number,
  endRow: number,
  lang: 'en' | 'fr',
  fitMethod: ProctorFitMethod = 'quadratic',
  polyOrder: number = 2,
  pts: Array<{ waterContentPercent: number; dryDensityGcm3: number; saturationWaterContentPercent: number }> = []
): string {
  const sheetName = lang === 'fr' ? 'Rapport' : 'Report';
  const chartTitle = lang === 'fr' ? 'COURBE PROCTOR ET SATURATION' : 'PROCTOR COMPACTION CURVE';
  const ser1Title = lang === 'fr' ? 'Points Proctor (OPM)' : 'Proctor Points (OPM)';
  const ser2Title = lang === 'fr' ? 'Ligne de Saturation (Sr=100%)' : 'Saturation Line (Sr=100%)';
  const xTitle = lang === 'fr' ? 'Teneur en eau w (%)' : 'Moisture content w (%)';
  const yTitle = lang === 'fr' ? 'Densité sèche ρd (g/cm³)' : 'Dry density ρd (g/cm³)';

  const effectiveOrder = polyOrder || (fitMethod === 'quartic' ? 4 : fitMethod === 'cubic' ? 3 : 2);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${chartTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:scatterChart>
        <c:scatterStyle val="lineMarker"/>
        <!-- Series 1: Proctor Points with polynomial trendline -->
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx><c:v>${ser1Title}</c:v></c:tx>
          <c:spPr>
            <a:ln w="9525"><a:noFill/></a:ln>
          </c:spPr>
          <c:marker>
            <c:symbol val="circle"/>
            <c:size val="7"/>
            <c:spPr>
              <a:solidFill><a:srgbClr val="2563EB"/></a:solidFill>
              <a:ln w="9525"><a:solidFill><a:srgbClr val="1E40AF"/></a:solidFill></a:ln>
            </c:spPr>
          </c:marker>
          <c:trendline>
            <c:name>${lang === 'fr' ? 'Courbe OPM polynomiale' : 'OPM polynomial fit'}</c:name>
            <c:spPr>
              <a:ln w="25400" cmpd="sng">
                <a:solidFill><a:srgbClr val="1E40AF"/></a:solidFill>
                <a:prstDash val="solid"/>
              </a:ln>
            </c:spPr>
            <c:trendlineType val="poly"/>
            <c:order val="${effectiveOrder}"/>
            <c:dispRSqr val="0"/>
            <c:dispEq val="0"/>
          </c:trendline>
          <c:xVal>
            <c:numRef>
              <c:f>'${sheetName}'!$B$${startRow}:$B$${endRow}</c:f>
              ${pts.length > 0 ? `<c:numCache>
                <c:formatCode>0.0</c:formatCode>
                <c:ptCount val="${pts.length}"/>
                ${pts.map((p, i) => `<c:pt idx="${i}"><c:v>${p.waterContentPercent}</c:v></c:pt>`).join('')}
              </c:numCache>` : ''}
            </c:numRef>
          </c:xVal>
          <c:yVal>
            <c:numRef>
              <c:f>'${sheetName}'!$D$${startRow}:$D$${endRow}</c:f>
              ${pts.length > 0 ? `<c:numCache>
                <c:formatCode>0.000</c:formatCode>
                <c:ptCount val="${pts.length}"/>
                ${pts.map((p, i) => `<c:pt idx="${i}"><c:v>${p.dryDensityGcm3}</c:v></c:pt>`).join('')}
              </c:numCache>` : ''}
            </c:numRef>
          </c:yVal>
          <c:smooth val="0"/>
        </c:ser>
        <!-- Series 2: Saturation Curve (visible dashed line) -->
        <c:ser>
          <c:idx val="1"/>
          <c:order val="1"/>
          <c:tx><c:v>${ser2Title}</c:v></c:tx>
          <c:spPr>
            <a:ln w="19050" cmpd="sng">
              <a:solidFill>
                <a:srgbClr val="DC2626"/>
              </a:solidFill>
              <a:prstDash val="dash"/>
            </a:ln>
          </c:spPr>
          <c:marker><c:symbol val="none"/></c:marker>
          <c:xVal>
            <c:numRef>
              <c:f>'${sheetName}'!$F$${startRow}:$F$${endRow}</c:f>
              ${pts.length > 0 ? `<c:numCache>
                <c:formatCode>0.0</c:formatCode>
                <c:ptCount val="${pts.length}"/>
                ${pts.map((p, i) => `<c:pt idx="${i}"><c:v>${p.saturationWaterContentPercent}</c:v></c:pt>`).join('')}
              </c:numCache>` : ''}
            </c:numRef>
          </c:xVal>
          <c:yVal>
            <c:numRef>
              <c:f>'${sheetName}'!$D$${startRow}:$D$${endRow}</c:f>
              ${pts.length > 0 ? `<c:numCache>
                <c:formatCode>0.000</c:formatCode>
                <c:ptCount val="${pts.length}"/>
                ${pts.map((p, i) => `<c:pt idx="${i}"><c:v>${p.dryDensityGcm3}</c:v></c:pt>`).join('')}
              </c:numCache>` : ''}
            </c:numRef>
          </c:yVal>
          <c:smooth val="1"/>
        </c:ser>
        <c:axId val="1001"/>
        <c:axId val="1002"/>
      </c:scatterChart>
      <!-- X-Axis (Moisture) -->
      <c:valAx>
        <c:axId val="1001"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:numFmt formatCode="0.0" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="1002"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
      <!-- Y-Axis (Dry Density) -->
      <c:valAx>
        <c:axId val="1002"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${yTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:numFmt formatCode="0.000" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="1001"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
</c:chartSpace>`;
}

// -------------------------------------------------------------
// GRAIN SIZE EXCEL & DRAWINGML CHART
// -------------------------------------------------------------
function buildGrainSizeSheet(
  analysis: GeoLabAnalysis<GrainSizeInput, GrainSizeResults>,
  client: GeoLabClient,
  project: GeoLabProject,
  sample: GeoLabSample,
  org: OrganisationProfile,
  lang: 'en' | 'fr',
  watermark: string
) {
  const res = analysis.computedResults;
  const rows = res.rows || [];

  const formCode = org.formCodes?.grain_size || 'GR1-FOR-01';
  const accreditationLabel = org.accreditationNumber?.trim()
    ? `${lang === 'fr' ? "N° d'agrément / d'accréditation : " : 'Agrément / Accreditation no.: '}${escapeXml(org.accreditationNumber)}`
    : '';
  const orgContact = [
    org.address,
    org.phone ? `${lang === 'fr' ? 'Tél: ' : 'Tel: '}${org.phone}` : '',
    org.email,
  ].filter(Boolean).join(' | ');

  let rowsXml = '';
  // Row 1: Org Header, Contact & Accreditation
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    ${orgContact ? `<c r="D1" t="inlineStr" s="0"><is><t>${escapeXml(orgContact)}</t></is></c>` : ''}
    ${accreditationLabel ? `<c r="G1" t="inlineStr" s="2"><is><t>${accreditationLabel}</t></is></c>` : ''}
  </row>`;

  // Row 2: Document Title & Form Code
  const titleText = lang === 'fr' ? 'PROCES-VERBAL D\'ANALYSE GRANULOMÉTRIQUE' : 'PARTICLE SIZE DISTRIBUTION TEST REPORT';
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${titleText} - ${escapeXml(analysis.standard)}</t></is></c>
    <c r="G2" t="inlineStr" s="2"><is><t>${lang === 'fr' ? 'Formulaire : ' : 'Form: '}${escapeXml(formCode)}</t></is></c>
  </row>`;

  // Row 3: Meta & Watermark
  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="G3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
  </row>
  <row r="4"/>
  <row r="5">
    <c r="A5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Client :' : 'Client:'}</t></is></c>
    <c r="B5" t="inlineStr"><is><t>${escapeXml(client.companyName)}</t></is></c>
    <c r="D5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Échantillon :' : 'Sample ID:'}</t></is></c>
    <c r="E5" t="inlineStr"><is><t>${escapeXml(sample.sampleId)}</t></is></c>
  </row>
  <row r="6">
    <c r="A6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Projet :' : 'Project:'}</t></is></c>
    <c r="B6" t="inlineStr"><is><t>${escapeXml(project.programmeTitle || project.programme ? `${project.projectName} / ${project.programmeTitle || project.programme}` : project.projectName)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Masse sèche (Ms) :' : 'Total Dry Mass (Ms):'}</t></is></c>
    <c r="E6" s="7"><v>${res.totalDryMassG}</v></c>
  </row>
  <row r="7">
    <c r="A7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Site / Lieu :' : 'Site Location:'}</t></is></c>
    <c r="B7" t="inlineStr"><is><t>${escapeXml(project.siteLocation)}</t></is></c>
    <c r="D7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Marché / Lot :' : 'Contract / Lot:'}</t></is></c>
    <c r="E7" t="inlineStr"><is><t>${escapeXml(project.contractNumber || project.referenceNumber || '-')}${project.lotSection ? ` / ${escapeXml(project.lotSection)}` : ''}</t></is></c>
  </row>`;

  // Sieve Table Header
  rowsXml += `<row r="8" ht="20">
    <c r="A8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Maille (mm)' : 'Sieve (mm)'}</t></is></c>
    <c r="B8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Refus partiel (g)' : 'Retained (g)'}</t></is></c>
    <c r="C8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Refus partiel (%)' : 'Retained (%)'}</t></is></c>
    <c r="D8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Refus cumulé (%)' : 'Cum. Retained (%)'}</t></is></c>
    <c r="E8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Passant cumulé (%)' : 'Cum. Passing (%)'}</t></is></c>
    <c r="F8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Fuseau Min (%)' : 'Min Spec (%)'}</t></is></c>
    <c r="G8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Fuseau Max (%)' : 'Max Spec (%)'}</t></is></c>
  </row>`;

  rows.forEach((r, idx) => {
    const rowNum = 9 + idx;
    rowsXml += `<row r="${rowNum}">
      <c r="A${rowNum}" s="11"><v>${r.sieveMm}</v></c>
      <c r="B${rowNum}" s="7"><v>${r.retainedMassG}</v></c>
      <c r="C${rowNum}" s="10"><f>B${rowNum}/$E$6*100</f><v>${r.retainedPercent}</v></c>
      <c r="D${rowNum}" s="10"><f>SUM(C$9:C${rowNum})</f><v>${r.cumulativeRetainedPercent}</v></c>
      <c r="E${rowNum}" s="10"><f>100-D${rowNum}</f><v>${r.passingPercent}</v></c>
      ${r.minSpecPercent !== undefined ? `<c r="F${rowNum}" s="10"><v>${r.minSpecPercent}</v></c>` : `<c r="F${rowNum}"/>`}
      ${r.maxSpecPercent !== undefined ? `<c r="G${rowNum}" s="10"><v>${r.maxSpecPercent}</v></c>` : `<c r="G${rowNum}"/>`}
    </row>`;
  });

  const lastDataRow = 8 + rows.length;
  const summaryStartRow = lastDataRow + 2;

  // Characteristics & Classification
  rowsXml += `
  <row r="${summaryStartRow}">
    <c r="A${summaryStartRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'PARAMÈTRE' : 'PARAMETER'}</t></is></c>
    <c r="B${summaryStartRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'VALEUR' : 'VALUE'}</t></is></c>
  </row>
  <row r="${summaryStartRow + 1}">
    <c r="A${summaryStartRow + 1}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Passant à 2 mm' : 'Passing 2 mm'}</t></is></c>
    <c r="B${summaryStartRow + 1}" s="10"><v>${res.passing2mmPercent}</v></c>
  </row>
  <row r="${summaryStartRow + 2}">
    <c r="A${summaryStartRow + 2}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Passant à 0,08 mm (Fines)' : 'Passing 0.08 mm (Fines)'}</t></is></c>
    <c r="B${summaryStartRow + 2}" s="10"><v>${res.passing008mmPercent}</v></c>
  </row>
  <row r="${summaryStartRow + 3}">
    <c r="A${summaryStartRow + 3}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Classification LCPC' : 'LCPC Classification'}</t></is></c>
    <c r="B${summaryStartRow + 3}" t="inlineStr"><is><t>${escapeXml(res.lcpcClassification)}</t></is></c>
  </row>`;

  // Revision Table
  const revStartRow = summaryStartRow + 5;
  const { xml: revXml, nextRow: afterRevRow } = buildRevisionTableRows(analysis, lang, revStartRow);
  rowsXml += revXml;

  // Observations / Signatures
  const obsRow = afterRevRow + 1;
  rowsXml += `
  <row r="${obsRow}">
    <c r="A${obsRow}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Observations :' : 'Observations:'}</t></is></c>
    <c r="B${obsRow}" t="inlineStr"><is><t>${escapeXml(analysis.observations || analysis.aiNarrative || 'Conforme aux exigences normatives.')}</t></is></c>
  </row>`;

  rowsXml += buildSignaturesRows(analysis, org, lang, obsRow + 2);

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0" showGridLines="1"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="19"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="14" customWidth="1"/>
    <col min="5" max="5" width="14" customWidth="1"/>
    <col min="6" max="6" width="4" customWidth="1"/>
    <col min="7" max="16" width="12" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
  <drawing r:id="rId1"/>
</worksheet>`;

  const chartXml = buildGrainSizeChartXml(9, lastDataRow, lang, rows);

  return { sheetXml, chartXml, hasChart: true };
}

function buildGrainSizeChartXml(
  startRow: number,
  endRow: number,
  lang: 'en' | 'fr',
  rows: Array<{ sieveMm: number; passingPercent: number }> = []
): string {
  const sheetName = lang === 'fr' ? 'Rapport' : 'Report';
  const chartTitle = lang === 'fr' ? 'COURBE GRANULOMÉTRIQUE' : 'PARTICLE SIZE DISTRIBUTION';
  const serTitle = lang === 'fr' ? 'Passant cumulé' : 'Cumulative Passing';
  const xTitle = lang === 'fr' ? 'Dimension des mailles d (mm)' : 'Sieve opening d (mm)';
  const yTitle = lang === 'fr' ? 'Passant cumulé P (%)' : 'Cumulative Passing P (%)';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${chartTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:scatterChart>
        <c:scatterStyle val="lineMarker"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx><c:v>${serTitle}</c:v></c:tx>
          <c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>
          <c:xVal>
            <c:numRef>
              <c:f>'${sheetName}'!$A$${startRow}:$A$${endRow}</c:f>
              ${rows.length > 0 ? `<c:numCache>
                <c:formatCode>0.000</c:formatCode>
                <c:ptCount val="${rows.length}"/>
                ${rows.map((r, i) => `<c:pt idx="${i}"><c:v>${r.sieveMm}</c:v></c:pt>`).join('')}
              </c:numCache>` : ''}
            </c:numRef>
          </c:xVal>
          <c:yVal>
            <c:numRef>
              <c:f>'${sheetName}'!$E$${startRow}:$E$${endRow}</c:f>
              ${rows.length > 0 ? `<c:numCache>
                <c:formatCode>0.0</c:formatCode>
                <c:ptCount val="${rows.length}"/>
                ${rows.map((r, i) => `<c:pt idx="${i}"><c:v>${r.passingPercent}</c:v></c:pt>`).join('')}
              </c:numCache>` : ''}
            </c:numRef>
          </c:yVal>
          <c:smooth val="0"/>
        </c:ser>
        <c:axId val="2001"/>
        <c:axId val="2002"/>
      </c:scatterChart>
      <!-- X-Axis (Logarithmic scale) -->
      <c:valAx>
        <c:axId val="2001"/>
        <c:scaling>
          <c:logBase val="10"/>
          <c:orientation val="minMax"/>
        </c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorGridlines/>
        <c:minorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:numFmt formatCode="0.00" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="2002"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
      <!-- Y-Axis (0 - 100%) -->
      <c:valAx>
        <c:axId val="2002"/>
        <c:scaling><c:orientation val="minMax"/><c:max val="100"/><c:min val="0"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${yTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:numFmt formatCode="0.0" sourceLinked="0"/>
        <c:majorTickMark val="out"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="2001"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/></c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
</c:chartSpace>`;
}

// -------------------------------------------------------------
// WATER CONTENT EXCEL
// -------------------------------------------------------------
function buildWaterContentSheet(
  analysis: GeoLabAnalysis<WaterContentInput, WaterContentResults>,
  client: GeoLabClient,
  project: GeoLabProject,
  sample: GeoLabSample,
  org: OrganisationProfile,
  lang: 'en' | 'fr',
  watermark: string
) {
  const res = analysis.computedResults;
  const specs = res.specimens || [];

  const formCode = org.formCodes?.water_content || 'TE1-FOR-01';
  const accreditationLabel = org.accreditationNumber?.trim()
    ? `${lang === 'fr' ? "N° d'agrément / d'accréditation : " : 'Agrément / Accreditation no.: '}${escapeXml(org.accreditationNumber)}`
    : '';
  const orgContact = [
    org.address,
    org.phone ? `${lang === 'fr' ? 'Tél: ' : 'Tel: '}${org.phone}` : '',
    org.email,
  ].filter(Boolean).join(' | ');

  let rowsXml = '';
  // Row 1: Org Header, Contact & Accreditation
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    ${orgContact ? `<c r="D1" t="inlineStr" s="0"><is><t>${escapeXml(orgContact)}</t></is></c>` : ''}
    ${accreditationLabel ? `<c r="G1" t="inlineStr" s="2"><is><t>${accreditationLabel}</t></is></c>` : ''}
  </row>`;

  // Row 2: Document Title & Form Code
  const titleText = lang === 'fr' ? 'PROCES-VERBAL DE TENEUR EN EAU NATURELLE' : 'NATURAL WATER CONTENT TEST REPORT';
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${titleText} - ${escapeXml(analysis.standard)}</t></is></c>
    <c r="G2" t="inlineStr" s="2"><is><t>${lang === 'fr' ? 'Formulaire : ' : 'Form: '}${escapeXml(formCode)}</t></is></c>
  </row>`;

  // Row 3: Meta & Watermark
  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="G3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
  </row>
  <row r="4"/>
  <row r="5">
    <c r="A5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Client :' : 'Client:'}</t></is></c>
    <c r="B5" t="inlineStr"><is><t>${escapeXml(client.companyName)}</t></is></c>
    <c r="D5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Échantillon :' : 'Sample ID:'}</t></is></c>
    <c r="E5" t="inlineStr"><is><t>${escapeXml(sample.sampleId)}</t></is></c>
  </row>
  <row r="6">
    <c r="A6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Projet :' : 'Project:'}</t></is></c>
    <c r="B6" t="inlineStr"><is><t>${escapeXml(project.programmeTitle || project.programme ? `${project.projectName} / ${project.programmeTitle || project.programme}` : project.projectName)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Tolérance répétabilité :' : 'Tolerance:'}</t></is></c>
    <c r="E6" s="10"><v>${res.maxTolerancePercent}</v></c>
  </row>
  <row r="7">
    <c r="A7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Site / Lieu :' : 'Site Location:'}</t></is></c>
    <c r="B7" t="inlineStr"><is><t>${escapeXml(project.siteLocation)}</t></is></c>
    <c r="D7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Marché / Lot :' : 'Contract / Lot:'}</t></is></c>
    <c r="E7" t="inlineStr"><is><t>${escapeXml(project.contractNumber || project.referenceNumber || '-')}${project.lotSection ? ` / ${escapeXml(project.lotSection)}` : ''}</t></is></c>
  </row>`;

  // Specimen Table Header
  rowsXml += `<row r="8" ht="20">
    <c r="A8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Éprouvette' : 'Specimen'}</t></is></c>
    <c r="B8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Tare ID' : 'Tare ID'}</t></is></c>
    <c r="C8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Masse Tare m0 (g)' : 'Tare Mass m0 (g)'}</t></is></c>
    <c r="D8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Sol humide + Tare m1 (g)' : 'Wet + Tare m1 (g)'}</t></is></c>
    <c r="E8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Sol sec + Tare m2 (g)' : 'Dry + Tare m2 (g)'}</t></is></c>
    <c r="F8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Sol sec md (g)' : 'Dry Soil md (g)'}</t></is></c>
    <c r="G8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Masse eau mw (g)' : 'Water Mass mw (g)'}</t></is></c>
    <c r="H8" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Teneur en eau w (%)' : 'Water Content w (%)'}</t></is></c>
  </row>`;

  specs.forEach((s, idx) => {
    const rowNum = 9 + idx;
    rowsXml += `<row r="${rowNum}">
      <c r="A${rowNum}" t="inlineStr" s="9"><is><t>${escapeXml(s.specimenId)}</t></is></c>
      <c r="B${rowNum}" t="inlineStr"><is><t>${escapeXml(s.containerId)}</t></is></c>
      <c r="C${rowNum}" s="11"><v>${s.tareMassG}</v></c>
      <c r="D${rowNum}" s="11"><v>${s.wetSoilPlusTareG}</v></c>
      <c r="E${rowNum}" s="11"><v>${s.drySoilPlusTareG}</v></c>
      <c r="F${rowNum}" s="11"><f>E${rowNum}-C${rowNum}</f><v>${s.drySoilMassG}</v></c>
      <c r="G${rowNum}" s="11"><f>D${rowNum}-E${rowNum}</f><v>${s.waterMassG}</v></c>
      <c r="H${rowNum}" s="10"><f>(G${rowNum}/F${rowNum})*100</f><v>${s.waterContentPercent}</v></c>
    </row>`;
  });

  const lastDataRow = 8 + specs.length;
  const summaryRow = lastDataRow + 2;

  // Mean & Repeatability
  rowsXml += `
  <row r="${summaryRow}">
    <c r="A${summaryRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Teneur en eau moyenne (w)' : 'Mean Water Content (w)'}</t></is></c>
    <c r="B${summaryRow}" s="10"><f>AVERAGE(H9:H${lastDataRow})</f><v>${res.meanWaterContentPercent}</v></c>
    <c r="C${summaryRow}" t="inlineStr"><is><t>%</t></is></c>
  </row>
  <row r="${summaryRow + 1}">
    <c r="A${summaryRow + 1}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Écart entre prises (Δw)' : 'Difference (Δw)'}</t></is></c>
    <c r="B${summaryRow + 1}" s="10"><v>${res.differenceBetweenSpecimensPercent}</v></c>
    <c r="C${summaryRow + 1}" t="inlineStr"><is><t>%</t></is></c>
  </row>
  <row r="${summaryRow + 2}">
    <c r="A${summaryRow + 2}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Conformité répétabilité' : 'Repeatability Status'}</t></is></c>
    <c r="B${summaryRow + 2}" t="inlineStr"><is><t>${res.repeatabilityAccepted ? (lang === 'fr' ? 'CONFORME' : 'PASSED') : (lang === 'fr' ? 'NON CONFORME' : 'FAILED')}</t></is></c>
  </row>`;

  // Revision Table
  const revStartRow = summaryRow + 4;
  const { xml: revXml, nextRow: afterRevRow } = buildRevisionTableRows(analysis, lang, revStartRow);
  rowsXml += revXml;

  // Observations / Signatures
  const obsRow = afterRevRow + 1;
  rowsXml += `
  <row r="${obsRow}">
    <c r="A${obsRow}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Observations :' : 'Observations:'}</t></is></c>
    <c r="B${obsRow}" t="inlineStr"><is><t>${escapeXml(analysis.observations || analysis.aiNarrative || 'Conforme aux exigences normatives.')}</t></is></c>
  </row>`;

  rowsXml += buildSignaturesRows(analysis, org, lang, obsRow + 2);

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <cols>
    <col min="1" max="1" width="30" customWidth="1"/>
    <col min="2" max="2" width="20" customWidth="1"/>
    <col min="3" max="3" width="22" customWidth="1"/>
    <col min="4" max="4" width="22" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="20" customWidth="1"/>
    <col min="7" max="7" width="20" customWidth="1"/>
    <col min="8" max="8" width="24" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
  <drawing r:id="rId1"/>
</worksheet>`;

  return { sheetXml, chartXml: null, hasChart: false };
}

// -------------------------------------------------------------
// GENERIC TEST EXCEL (DATA-DRIVEN)
// -------------------------------------------------------------
function buildGenericSheet(
  analysis: GeoLabAnalysis,
  client: GeoLabClient,
  project: GeoLabProject,
  sample: GeoLabSample,
  org: OrganisationProfile,
  lang: 'en' | 'fr',
  watermark: string
) {
  const testDef = getTestDefinition(analysis.testType);
  const formCode = (org.formCodes as any)?.[analysis.testType] || 'LAB-FOR-GEN';
  const accreditationLabel = org.accreditationNumber?.trim()
    ? `${lang === 'fr' ? "N° d'agrément / d'accréditation : " : 'Agrément / Accreditation no.: '}${escapeXml(org.accreditationNumber)}`
    : '';
  const orgContact = [
    org.address,
    org.phone ? `${lang === 'fr' ? 'Tél: ' : 'Tel: '}${org.phone}` : '',
    org.email,
  ].filter(Boolean).join(' | ');

  let rowsXml = '';
  // Row 1: Org Header, Contact & Accreditation
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    ${orgContact ? `<c r="D1" t="inlineStr" s="0"><is><t>${escapeXml(orgContact)}</t></is></c>` : ''}
    ${accreditationLabel ? `<c r="G1" t="inlineStr" s="2"><is><t>${accreditationLabel}</t></is></c>` : ''}
  </row>`;

  // Row 2: Document Title & Form Code
  const titleText = (testDef.name[lang] || testDef.name.en).toUpperCase();
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${escapeXml(titleText)} - ${escapeXml(analysis.standard)}</t></is></c>
    <c r="G2" t="inlineStr" s="2"><is><t>${lang === 'fr' ? 'Formulaire : ' : 'Form: '}${escapeXml(formCode)}</t></is></c>
  </row>`;

  // Row 3: Meta & Watermark
  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="G3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
  </row>
  <row r="4"/>
  <row r="5">
    <c r="A5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Client :' : 'Client:'}</t></is></c>
    <c r="B5" t="inlineStr"><is><t>${escapeXml(client.companyName)}</t></is></c>
    <c r="D5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Échantillon :' : 'Sample ID:'}</t></is></c>
    <c r="E5" t="inlineStr"><is><t>${escapeXml(sample.sampleId)}</t></is></c>
  </row>
  <row r="6">
    <c r="A6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Projet :' : 'Project:'}</t></is></c>
    <c r="B6" t="inlineStr"><is><t>${escapeXml(project.programmeTitle || project.programme ? `${project.projectName} / ${project.programmeTitle || project.programme}` : project.projectName)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Matériau :' : 'Material:'}</t></is></c>
    <c r="E6" t="inlineStr"><is><t>${escapeXml(sample.materialType || '-')}</t></is></c>
  </row>
  <row r="7">
    <c r="A7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Site / Lieu :' : 'Site Location:'}</t></is></c>
    <c r="B7" t="inlineStr"><is><t>${escapeXml(project.siteLocation)}</t></is></c>
    <c r="D7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Marché / Lot :' : 'Contract / Lot:'}</t></is></c>
    <c r="E7" t="inlineStr"><is><t>${escapeXml(project.contractNumber || project.referenceNumber || '-')}${project.lotSection ? ` / ${escapeXml(project.lotSection)}` : ''}</t></is></c>
  </row>`;

  let curRow = 8;

  // Parameters Section
  if (testDef.inputSchema.parameters && testDef.inputSchema.parameters.length > 0) {
    curRow++;
    rowsXml += `<row r="${curRow}">
      <c r="A${curRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'PARAMÈTRES D\'ESSAI' : 'TEST PARAMETERS'}</t></is></c>
    </row>`;
    for (const param of testDef.inputSchema.parameters) {
      curRow++;
      const val = (analysis.rawInput as any)?.[param.key] ?? param.defaultValue ?? '';
      rowsXml += `<row r="${curRow}">
        <c r="A${curRow}" t="inlineStr" s="6"><is><t>${escapeXml(param.label[lang] || param.label.en)}</t></is></c>
        <c r="B${curRow}" ${typeof val === 'number' ? `s="7"><v>${val}</v>` : `t="inlineStr"><is><t>${escapeXml(val)}</t></is>`}</c>
        ${param.unit ? `<c r="C${curRow}" t="inlineStr"><is><t>${escapeXml(param.unit)}</t></is></c>` : ''}
      </row>`;
    }
  }

  // Data Table Section
  if (testDef.inputSchema.table) {
    const tableDef = testDef.inputSchema.table;
    const tableRows = ((analysis.rawInput as any)?.[tableDef.key] as any[]) || [];
    curRow += 2;
    rowsXml += `<row r="${curRow}">
      <c r="A${curRow}" t="inlineStr" s="8"><is><t>${escapeXml((tableDef.label[lang] || tableDef.label.en).toUpperCase())}</t></is></c>
    </row>`;
    curRow++;
    const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    rowsXml += `<row r="${curRow}" ht="20">`;
    tableDef.columns.forEach((col, idx) => {
      const colLetter = colLetters[idx] || 'A';
      const colTitle = `${col.label[lang] || col.label.en}${col.unit ? ` (${col.unit})` : ''}`;
      rowsXml += `<c r="${colLetter}${curRow}" t="inlineStr" s="8"><is><t>${escapeXml(colTitle)}</t></is></c>`;
    });
    rowsXml += `</row>`;

    tableRows.forEach((rowObj) => {
      curRow++;
      rowsXml += `<row r="${curRow}">`;
      tableDef.columns.forEach((col, idx) => {
        const colLetter = colLetters[idx] || 'A';
        const val = rowObj[col.key];
        if (typeof val === 'number') {
          rowsXml += `<c r="${colLetter}${curRow}" s="7"><v>${val}</v></c>`;
        } else {
          rowsXml += `<c r="${colLetter}${curRow}" t="inlineStr"><is><t>${escapeXml(val ?? '')}</t></is></c>`;
        }
      });
      rowsXml += `</row>`;
    });
  }

  // Key Results Section
  if (analysis.computedResults) {
    curRow += 2;
    rowsXml += `<row r="${curRow}">
      <c r="A${curRow}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'RÉSULTATS DE L\'ESSAI' : 'TEST RESULTS'}</t></is></c>
    </row>`;
    const keyRes = testDef.keyResults(analysis.computedResults, lang);
    keyRes.forEach((res) => {
      curRow++;
      rowsXml += `<row r="${curRow}">
        <c r="A${curRow}" t="inlineStr" s="6"><is><t>${escapeXml(res.label)}</t></is></c>
        <c r="B${curRow}" ${typeof res.value === 'number' ? `s="7"><v>${res.value}</v>` : `t="inlineStr"><is><t>${escapeXml(res.value)}</t></is>`}</c>
        ${res.unit ? `<c r="C${curRow}" t="inlineStr"><is><t>${escapeXml(res.unit)}</t></is></c>` : ''}
      </row>`;
    });
  }

  // Revision Table
  curRow += 2;
  const { xml: revXml, nextRow: afterRevRow } = buildRevisionTableRows(analysis, lang, curRow);
  rowsXml += revXml;

  // Observations / Signatures
  const obsRow = afterRevRow + 1;
  rowsXml += `
  <row r="${obsRow}">
    <c r="A${obsRow}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Observations :' : 'Observations:'}</t></is></c>
    <c r="B${obsRow}" t="inlineStr"><is><t>${escapeXml(analysis.observations || analysis.aiNarrative || (lang === 'fr' ? 'Conforme aux exigences normatives.' : 'Complies with standard requirements.'))}</t></is></c>
  </row>`;

  rowsXml += buildSignaturesRows(analysis, org, lang, obsRow + 2);

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <cols>
    <col min="1" max="1" width="32" customWidth="1"/>
    <col min="2" max="2" width="22" customWidth="1"/>
    <col min="3" max="3" width="20" customWidth="1"/>
    <col min="4" max="4" width="22" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="20" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
  <pageSetup orientation="portrait" paperSize="9" fitToWidth="1" fitToHeight="0"/>
  <drawing r:id="rId1"/>
</worksheet>`;

  return { sheetXml, chartXml: null, hasChart: false };
}

// -------------------------------------------------------------
// OpenXML Packaging Helpers
// -------------------------------------------------------------
function getDrawingXml(logos: EmbeddedLogo[], hasChart: boolean): string {
  let anchorsXml = '';

  // Logo Anchors
  logos.forEach((logo, idx) => {
    const colFrom = logo.position === 'left' ? 0 : (logo.position === 'center' ? 3 : 6);
    const colTo = logo.position === 'left' ? 1 : (logo.position === 'center' ? 4 : 7);

    anchorsXml += `
    <xdr:twoCellAnchor editAs="oneCell">
      <xdr:from><xdr:col>${colFrom}</xdr:col><xdr:colOff>30000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>15000</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${colTo}</xdr:col><xdr:colOff>100000</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>40000</xdr:rowOff></xdr:to>
      <xdr:pic>
        <xdr:nvPicPr>
          <xdr:cNvPr id="${10 + idx}" name="${logo.fileName}"/>
          <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
        </xdr:nvPicPr>
        <xdr:blipFill>
          <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${logo.id}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </xdr:blipFill>
        <xdr:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="1200000" cy="600000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </xdr:spPr>
      </xdr:pic>
      <xdr:clientData/>
    </xdr:twoCellAnchor>`;
  });

  // Native DrawingML Chart Anchor (Real plotted Excel vector chart from worksheet cells)
  if (hasChart) {
    anchorsXml += `
    <xdr:twoCellAnchor>
      <xdr:from><xdr:col>7</xdr:col><xdr:colOff>30000</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>16</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:graphicFrame macro="">
        <xdr:nvGraphicFramePr>
          <xdr:cNvPr id="2" name="Chart"/>
          <xdr:cNvGraphicFramePr><a:graphicFrameLocks/></xdr:cNvGraphicFramePr>
        </xdr:nvGraphicFramePr>
        <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
            <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdChart"/>
          </a:graphicData>
        </a:graphic>
      </xdr:graphicFrame>
      <xdr:clientData/>
    </xdr:twoCellAnchor>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  ${anchorsXml}
</xdr:wsDr>`;
}

function getDrawingRelsXml(logos: EmbeddedLogo[], hasChart: boolean): string {
  let rels = '';
  logos.forEach((logo) => {
    rels += `\n  <Relationship Id="${logo.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${logo.fileName}"/>`;
  });
  if (hasChart) {
    rels += `\n  <Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}
</Relationships>`;
}

function getContentTypesXml(hasChart: boolean, hasDrawing: boolean, logos: EmbeddedLogo[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${hasDrawing ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}
  ${hasChart ? '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>' : ''}
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function getGlobalRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function getWorkbookXml(sheetName: string = 'Rapport'): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function getWorkbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function getStylesXml(primaryColor: string): string {
  const hex = (primaryColor || '#1e40af').replace('#', '').toUpperCase();
  const argb = `FF${hex.length === 6 ? hex : '1E40AF'}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="0.0"/>
    <numFmt numFmtId="165" formatCode="0.000"/>
    <numFmt numFmtId="166" formatCode="0.0%"/>
  </numFmts>
  <fonts count="5">
    <font><name val="Calibri"/><sz val="11"/></font>
    <font><b/><sz val="14"/><color rgb="${argb}"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="${argb}"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFDC2626"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${argb}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <!-- 1: Org Header -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <!-- 2: Accreditation -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="right" wrapText="1" vertical="center"/></xf>
    <!-- 3: Document Title -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <!-- 4: Report Meta -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <!-- 5: Watermark Draft -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="center" wrapText="1" vertical="center"/></xf>
    <!-- 6: Bold Label -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <!-- 7: Plain Number -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <!-- 8: Table Header (Filled) -->
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center" wrapText="1" vertical="center"/></xf>
    <!-- 9: Center Align Cell -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center" wrapText="1" vertical="center"/></xf>
    <!-- 10: 1-decimal / percent -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" wrapText="1" vertical="center"/></xf>
    <!-- 11: 3-decimal density -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" wrapText="1" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;
}

function getCorePropsXml(reportNumber: string, companyName: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(reportNumber)} - Geotechnical Test Report</dc:title>
  <dc:creator>${escapeXml(companyName)}</dc:creator>
  <cp:lastModifiedBy>FraGeo Suite - FraGeo Lab</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function getAppPropsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>FraGeo Suite - FraGeo Lab</Application>
  <DocSecurity>0</DocSecurity>
</Properties>`;
}
