import JSZip from 'jszip';
import type {
  GeoLabAnalysis,
  GeoLabClient,
  GeoLabProject,
  GeoLabSample,
  OrganisationProfile,
} from '../../types/geolab';
import type { GeoLabTestDefinition } from '../tests/types';
import type { ProctorInput, ProctorResults } from '../tests/proctor';
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
 * Builds a styled OpenXML spreadsheet with live Excel formulas and native DrawingML charts.
 */
export async function generateGeoLabExcelReport(options: ExcelGenerationOptions): Promise<Blob> {
  const { analysis, client, project, sample, orgProfile, testDef } = options;
  const lang = options.language || orgProfile.defaultLanguage || 'en';
  const zip = new JSZip();

  const isApproved = analysis.status === 'approved';
  const watermarkText = isApproved ? '' : 'DRAFT / PROVISOIRE';

  // Build Sheet XML based on test type
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

  // [Content_Types].xml
  zip.file('[Content_Types].xml', getContentTypesXml(hasChart));

  // _rels/.rels
  zip.file('_rels/.rels', getGlobalRelsXml());

  // xl/workbook.xml
  zip.file('xl/workbook.xml', getWorkbookXml());

  // xl/_rels/workbook.xml.rels
  zip.file('xl/_rels/workbook.xml.rels', getWorkbookRelsXml());

  // xl/styles.xml
  zip.file('xl/styles.xml', getStylesXml(orgProfile.primaryColor));

  // xl/worksheets/sheet1.xml
  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  if (hasChart && chartXml) {
    // xl/worksheets/_rels/sheet1.xml.rels
    zip.file(
      'xl/worksheets/_rels/sheet1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`
    );

    // xl/drawings/drawing1.xml
    zip.file('xl/drawings/drawing1.xml', getDrawingXml());

    // xl/drawings/_rels/drawing1.xml.rels
    zip.file(
      'xl/drawings/_rels/drawing1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`
    );

    // xl/charts/chart1.xml
    zip.file('xl/charts/chart1.xml', chartXml);
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
  return buildWaterContentSheet(analysis, client, project, sample, org, lang, watermark);
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

  let rowsXml = '';
  // Row 1: Header / Org Name
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    <c r="G1" t="inlineStr" s="2"><is><t>${escapeXml(org.accreditationNumber)}</t></is></c>
  </row>`;

  // Row 2: Title
  const titleText = lang === 'fr' ? "PROCES-VERBAL D'ESSAI PROCTOR" : 'PROCTOR COMPACTION TEST REPORT';
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${titleText} - ${escapeXml(analysis.standard)}</t></is></c>
  </row>`;

  // Row 3: Meta & Watermark
  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="G3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
  </row>`;

  // Row 4: Blank
  rowsXml += `<row r="4"/>`;

  // Rows 5-9: Project & Client Block
  rowsXml += `
  <row r="5">
    <c r="A5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Client :' : 'Client:'}</t></is></c>
    <c r="B5" t="inlineStr"><is><t>${escapeXml(client.companyName)} (${escapeXml(client.contactPerson)})</t></is></c>
    <c r="D5" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Échantillon :' : 'Sample ID:'}</t></is></c>
    <c r="E5" t="inlineStr"><is><t>${escapeXml(sample.sampleId)}</t></is></c>
  </row>
  <row r="6">
    <c r="A6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Projet :' : 'Project:'}</t></is></c>
    <c r="B6" t="inlineStr"><is><t>${escapeXml(project.projectName)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Profondeur :' : 'Depth:'}</t></is></c>
    <c r="E6" t="inlineStr"><is><t>${escapeXml(sample.depth || '-')}</t></is></c>
  </row>
  <row r="7">
    <c r="A7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Site / Lieu :' : 'Site Location:'}</t></is></c>
    <c r="B7" t="inlineStr"><is><t>${escapeXml(project.siteLocation)}</t></is></c>
    <c r="D7" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Masse vol. grains (ρs) :' : 'Particle Density (ρs):'}</t></is></c>
    <c r="E7" s="7"><v>${input.particleDensityGs || 2.82}</v></c>
  </row>`;

  // Row 8: Blank
  rowsXml += `<row r="8"/>`;

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
  </row>`;

  // Observations / Signatures
  const obsRow = summaryStartRow + 5;
  rowsXml += `
  <row r="${obsRow}">
    <c r="A${obsRow}" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Observations :' : 'Observations:'}</t></is></c>
    <c r="B${obsRow}" t="inlineStr"><is><t>${escapeXml(analysis.observations || analysis.aiNarrative || 'Conforme aux exigences normatives.')}</t></is></c>
  </row>
  <row r="${obsRow + 2}">
    <c r="A${obsRow + 2}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Essai réalisé par' : 'Tested by'}</t></is></c>
    <c r="C${obsRow + 2}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Vérifié par' : 'Checked by'}</t></is></c>
    <c r="E${obsRow + 2}" t="inlineStr" s="8"><is><t>${lang === 'fr' ? 'Approuvé par' : 'Approved by'}</t></is></c>
  </row>
  <row r="${obsRow + 3}">
    <c r="A${obsRow + 3}" t="inlineStr"><is><t>${escapeXml(analysis.preparedBy?.name || org.signatories[0]?.name || 'Technicien Labo')}</t></is></c>
    <c r="C${obsRow + 3}" t="inlineStr"><is><t>${escapeXml(analysis.checkedBy?.name || org.signatories[1]?.name || 'Responsable Qualité')}</t></is></c>
    <c r="E${obsRow + 3}" t="inlineStr"><is><t>${escapeXml(analysis.approvedBy?.name || org.signatories[2]?.name || 'Directeur Technique')}</t></is></c>
  </row>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="16" customWidth="1"/>
    <col min="6" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="24" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
  <drawing r:id="rId1"/>
</worksheet>`;

  // Build DrawingML Chart (Scatter chart with polynomial compaction curve and saturation curve)
  const chartXml = buildProctorChartXml(10, lastDataRow, lang);

  return { sheetXml, chartXml, hasChart: true };
}

function buildProctorChartXml(startRow: number, endRow: number, lang: 'en' | 'fr'): string {
  const chartTitle = lang === 'fr' ? 'COURBE PROCTOR ET SATURATION' : 'PROCTOR COMPACTION CURVE';
  const ser1Title = lang === 'fr' ? 'Points Proctor' : 'Proctor Points';
  const ser2Title = lang === 'fr' ? 'Ligne de Saturation (Sr=100%)' : 'Saturation Line (Sr=100%)';
  const xTitle = lang === 'fr' ? 'Teneur en eau w (%)' : 'Moisture content w (%)';
  const yTitle = lang === 'fr' ? 'Densité sèche ρd (g/cm³)' : 'Dry density ρd (g/cm³)';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${chartTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>
      <c:layout/>
      <c:scatterChart>
        <c:scatterStyle val="lineMarker"/>
        <!-- Series 1: Proctor Points with polynomial trendline -->
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:tx><c:v>${ser1Title}</c:v></c:tx>
          <c:marker><c:symbol val="circle"/><c:size val="7"/></c:marker>
          <c:trendline>
            <c:trendlineType val="poly"/>
            <c:order val="2"/>
            <c:dispRSqr val="0"/>
            <c:dispEq val="0"/>
          </c:trendline>
          <c:xVal>
            <c:numRef>
              <c:f>'GeoLab Report'!$B$${startRow}:$B$${endRow}</c:f>
            </c:numRef>
          </c:xVal>
          <c:yVal>
            <c:numRef>
              <c:f>'GeoLab Report'!$D$${startRow}:$D$${endRow}</c:f>
            </c:numRef>
          </c:yVal>
          <c:smooth val="0"/>
        </c:ser>
        <!-- Series 2: Saturation Curve -->
        <c:ser>
          <c:idx val="1"/>
          <c:order val="1"/>
          <c:tx><c:v>${ser2Title}</c:v></c:tx>
          <c:marker><c:symbol val="none"/></c:marker>
          <c:xVal>
            <c:numRef>
              <c:f>'GeoLab Report'!$F$${startRow}:$F$${endRow}</c:f>
            </c:numRef>
          </c:xVal>
          <c:yVal>
            <c:numRef>
              <c:f>'GeoLab Report'!$D$${startRow}:$D$${endRow}</c:f>
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
        <c:axPos val="b"/>
        <c:majorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:crossAx val="1002"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
      <!-- Y-Axis (Dry Density) -->
      <c:valAx>
        <c:axId val="1002"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${yTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:crossAx val="1001"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/></c:legend>
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

  let rowsXml = '';
  // Header
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    <c r="F1" t="inlineStr" s="2"><is><t>${escapeXml(org.accreditationNumber)}</t></is></c>
  </row>`;

  const titleText = lang === 'fr' ? 'PROCES-VERBAL D\'ANALYSE GRANULOMÉTRIQUE' : 'PARTICLE SIZE DISTRIBUTION TEST REPORT';
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${titleText} - ${escapeXml(analysis.standard)}</t></is></c>
  </row>`;

  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="F3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
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
    <c r="B6" t="inlineStr"><is><t>${escapeXml(project.projectName)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Masse sèche (Ms) :' : 'Total Dry Mass (Ms):'}</t></is></c>
    <c r="E6" s="7"><v>${res.totalDryMassG}</v></c>
  </row>
  <row r="7"/>`;

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

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>
    <col min="1" max="1" width="18" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    <col min="5" max="5" width="20" customWidth="1"/>
    <col min="6" max="6" width="16" customWidth="1"/>
    <col min="7" max="7" width="16" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
  <drawing r:id="rId1"/>
</worksheet>`;

  const chartXml = buildGrainSizeChartXml(9, lastDataRow, lang);

  return { sheetXml, chartXml, hasChart: true };
}

function buildGrainSizeChartXml(startRow: number, endRow: number, lang: 'en' | 'fr'): string {
  const chartTitle = lang === 'fr' ? 'COURBE GRANULOMÉTRIQUE' : 'PARTICLE SIZE DISTRIBUTION';
  const serTitle = lang === 'fr' ? 'Passant cumulé' : 'Cumulative Passing';
  const xTitle = lang === 'fr' ? 'Dimension des mailles d (mm)' : 'Sieve opening d (mm)';
  const yTitle = lang === 'fr' ? 'Passant cumulé P (%)' : 'Cumulative Passing P (%)';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${chartTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
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
              <c:f>'GeoLab Report'!$A$${startRow}:$A$${endRow}</c:f>
            </c:numRef>
          </c:xVal>
          <c:yVal>
            <c:numRef>
              <c:f>'GeoLab Report'!$E$${startRow}:$E$${endRow}</c:f>
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
        <c:axPos val="b"/>
        <c:majorGridlines/>
        <c:minorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${xTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:crossAx val="2002"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
      <!-- Y-Axis (0 - 100%) -->
      <c:valAx>
        <c:axId val="2002"/>
        <c:scaling><c:orientation val="minMax"/><c:max val="100"/><c:min val="0"/></c:scaling>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${yTitle}</a:t></a:r></a:p></c:rich></c:tx></c:title>
        <c:crossAx val="2001"/>
        <c:crosses val="autoZero"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/></c:legend>
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

  let rowsXml = '';
  // Header
  rowsXml += `<row r="1" ht="28">
    <c r="A1" t="inlineStr" s="1"><is><t>${escapeXml(org.companyName)}</t></is></c>
    <c r="F1" t="inlineStr" s="2"><is><t>${escapeXml(org.accreditationNumber)}</t></is></c>
  </row>`;

  const titleText = lang === 'fr' ? 'PROCES-VERBAL DE TENEUR EN EAU NATURELLE' : 'NATURAL WATER CONTENT TEST REPORT';
  rowsXml += `<row r="2" ht="24">
    <c r="A2" t="inlineStr" s="3"><is><t>${titleText} - ${escapeXml(analysis.standard)}</t></is></c>
  </row>`;

  rowsXml += `<row r="3">
    <c r="A3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'N° Rapport :' : 'Report No:'} ${escapeXml(analysis.reportNumber)} (v${analysis.version})</t></is></c>
    <c r="D3" t="inlineStr" s="4"><is><t>${lang === 'fr' ? 'Date :' : 'Date:'} ${escapeXml(analysis.testedDate)}</t></is></c>
    ${watermark ? `<c r="F3" t="inlineStr" s="5"><is><t>${watermark}</t></is></c>` : ''}
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
    <c r="B6" t="inlineStr"><is><t>${escapeXml(project.projectName)}</t></is></c>
    <c r="D6" t="inlineStr" s="6"><is><t>${lang === 'fr' ? 'Tolérance répétabilité :' : 'Tolerance:'}</t></is></c>
    <c r="E6" s="10"><v>${res.maxTolerancePercent}</v></c>
  </row>
  <row r="7"/>`;

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

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="16" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="3" width="18" customWidth="1"/>
    <col min="4" max="4" width="22" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="18" customWidth="1"/>
    <col min="8" max="8" width="20" customWidth="1"/>
  </cols>
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`;

  return { sheetXml, chartXml: null, hasChart: false };
}

// -------------------------------------------------------------
// OpenXML Boilerplate Packages
// -------------------------------------------------------------
function getContentTypesXml(hasChart: boolean): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${hasChart ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
  <Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` : ''}
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

function getWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="GeoLab Report" sheetId="1" r:id="rId1"/>
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

function getDrawingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>13</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>23</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="GeoLab Chart"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function getStylesXml(primaryColor: string): string {
  // Convert primaryColor hex to AARRGGBB
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
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <!-- 1: Org Header -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0"/>
    <!-- 2: Accreditation -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
    <!-- 3: Document Title -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0"/>
    <!-- 4: Report Meta -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <!-- 5: Watermark Draft -->
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0"/>
    <!-- 6: Bold Label -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0"/>
    <!-- 7: Plain Number -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/>
    <!-- 8: Table Header (Filled) -->
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" applyAlignment="1"><alignment horizontal="center"/></xf>
    <!-- 9: Center Align Cell -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment horizontal="center"/></xf>
    <!-- 10: 1-decimal / percent -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
    <!-- 11: 3-decimal density -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>
  </cellXfs>
</styleSheet>`;
}

function getCorePropsXml(reportNumber: string, companyName: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(reportNumber)} - Geotechnical Test Report</dc:title>
  <dc:creator>${escapeXml(companyName)}</dc:creator>
  <cp:lastModifiedBy>GeoLab System</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function getAppPropsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>FraGeo Suite - GeoLab Module</Application>
  <DocSecurity>0</DocSecurity>
</Properties>`;
}

