const fs = require('fs');
const path = require('path');
const docx = require('docx');

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  Header,
  Footer,
  PageNumber,
  convertMillimetersToTwip,
} = docx;

const SCREENSHOTS_DIR = path.resolve('artifacts', 'screenshots');
const OUTPUT_DOCX = path.resolve('artifacts', 'FraGeo_Comprehensive_User_Manual_and_Technical_Guide.docx');
const ROOT_DOCX = path.resolve('FraGeo_Comprehensive_User_Manual_and_Technical_Guide.docx');

function getImageBuffer(fileName) {
  const filePath = path.join(SCREENSHOTS_DIR, fileName);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  console.warn(`Warning: Screenshot file not found: ${fileName}`);
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
}

// Styling Palette
const COLOR_PRIMARY = '1E3A8A';    // Deep Navy
const COLOR_SECONDARY = '0284C7';  // Ocean Blue
const COLOR_DARK = '0F172A';       // Slate 900
const COLOR_MUTED = '475569';      // Slate 600
const COLOR_LIGHT_BG = 'F8FAFC';   // Slate 50
const COLOR_SCENARIO_BG = 'ECFDF5';// Mint / Emerald 50
const COLOR_SCENARIO_BORDER = '059669'; // Emerald 600
const COLOR_BORDER = 'CBD5E1';     // Slate 300

function createHeaderRun(text, level = HeadingLevel.HEADING_1) {
  const sizeMap = {
    [HeadingLevel.TITLE]: 36,
    [HeadingLevel.HEADING_1]: 26,
    [HeadingLevel.HEADING_2]: 21,
    [HeadingLevel.HEADING_3]: 18,
  };
  const colorMap = {
    [HeadingLevel.TITLE]: COLOR_PRIMARY,
    [HeadingLevel.HEADING_1]: COLOR_PRIMARY,
    [HeadingLevel.HEADING_2]: COLOR_SECONDARY,
    [HeadingLevel.HEADING_3]: COLOR_MUTED,
  };
  return new Paragraph({
    text: text,
    heading: level,
    spacing: { before: 240, after: 120 },
    run: {
      bold: true,
      color: colorMap[level] || COLOR_PRIMARY,
      size: sizeMap[level] || 22,
      font: 'Calibri',
    },
  });
}

function createParagraph(text, options = {}) {
  const { bold = false, italic = false, color = COLOR_DARK, size = 20, before = 60, after = 100 } = options;
  return new Paragraph({
    spacing: { before, after, line: 276 },
    children: [
      new TextRun({
        text,
        bold,
        italics: italic,
        color,
        size,
        font: 'Calibri',
      }),
    ],
  });
}

function createBullet(text, boldPrefix = '') {
  const children = [];
  if (boldPrefix) {
    children.push(new TextRun({ text: boldPrefix + ': ', bold: true, color: COLOR_DARK, size: 19, font: 'Calibri' }));
  }
  children.push(new TextRun({ text, color: COLOR_DARK, size: 19, font: 'Calibri' }));
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 60, line: 260 },
    children,
  });
}

function createScreenshotBlock(imageFileName, figureNumber, captionText) {
  const imageBytes = getImageBuffer(imageFileName);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 60 },
      children: [
        new ImageRun({
          data: imageBytes,
          transformation: { width: 560, height: 350 },
          type: 'png',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 180 },
      children: [
        new TextRun({
          text: `Figure ${figureNumber}: `,
          bold: true,
          color: COLOR_MUTED,
          size: 16,
          font: 'Calibri',
        }),
        new TextRun({
          text: captionText,
          italics: true,
          color: COLOR_MUTED,
          size: 16,
          font: 'Calibri',
        }),
      ],
    }),
  ];
}

function createScenarioBox(title, scenarioNarrative) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 140, bottom: 140, left: 180, right: 180 },
    borders: {
      left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_SCENARIO_BORDER },
      top: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLOR_SCENARIO_BG },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({
                    text: 'REAL-WORLD APPLICATION SCENARIO: ' + title.toUpperCase(),
                    bold: true,
                    color: COLOR_SCENARIO_BORDER,
                    size: 18,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 40, after: 60, line: 260 },
                children: [
                  new TextRun({
                    text: scenarioNarrative,
                    color: '064E3B',
                    size: 18,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createVariableTable(headers, rows) {
  const tableRows = [];

  // Header Row
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => {
        const widths = [22, 18, 15, 45];
        return new TableCell({
          width: { size: widths[i] || 25, type: WidthType.PERCENTAGE },
          shading: { fill: COLOR_PRIMARY },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  color: 'FFFFFF',
                  size: 16,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        });
      }),
    })
  );

  // Data Rows
  rows.forEach((row, rIdx) => {
    const isEven = rIdx % 2 === 0;
    tableRows.push(
      new TableRow({
        children: row.map((cellText, cIdx) => {
          const widths = [22, 18, 15, 45];
          return new TableCell({
            width: { size: widths[cIdx] || 25, type: WidthType.PERCENTAGE },
            shading: { fill: isEven ? 'FFFFFF' : COLOR_LIGHT_BG },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
              left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
              right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER },
            },
            children: [
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: cellText,
                    bold: cIdx === 0,
                    color: COLOR_DARK,
                    size: 15,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          });
        }),
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    spacing: { after: 160 },
    rows: tableRows,
  });
}

async function buildDocument() {
  console.log('Building definitive Word Manual matching actual software code...');
  const children = [];

  // =========================================================================
  // COVER PAGE
  // =========================================================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({
          text: 'FRAGEO SUITE: DEFINITIVE USER MANUAL & TECHNICAL GUIDE',
          bold: true,
          size: 36,
          color: COLOR_PRIMARY,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 300 },
      children: [
        new TextRun({
          text: 'Exhaustive Operational Handbook, Actual Software Variable Dictionaries, and Field Application Scenarios for FragMill & GeoLab Modules',
          bold: true,
          size: 22,
          color: COLOR_SECONDARY,
          font: 'Calibri',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLOR_PRIMARY },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'OPERATIONAL REFERENCE SPECIFICATION • V2.4.0 (2026)',
                      bold: true,
                      size: 20,
                      color: 'FFFFFF',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80 },
                  children: [
                    new TextRun({
                      text: 'Module 1: FragMill (Blasting, Fragmentation AI, Mine-to-Mill & Comminution Twin)\nModule 2: GeoLab (Geotechnical Soil, Aggregate & Rock Mechanics Laboratory)',
                      size: 17,
                      color: 'E2E8F0',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 400 },
      children: [
        new TextRun({
          text: 'Verified Against Actual Production Code • 22 Unscaled High-Fidelity Software Screenshots',
          italics: true,
          size: 18,
          color: COLOR_MUTED,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // =========================================================================
  // DOCUMENT PREAMBLE & ROADMAP
  // =========================================================================
  children.push(
    createHeaderRun('DOCUMENT PREAMBLE & ARCHITECTURAL OVERVIEW', HeadingLevel.HEADING_1),
    createParagraph(
      'This manual provides an in-depth, practical guide explaining how every feature and variable across FraGeo Suite operates. The documentation directly mirrors the actual TypeScript interfaces, database schemas (IndexedDB "FragMillDB"), and visual form layouts implemented in the software.',
      { size: 20, after: 120 }
    ),
    createParagraph(
      'The software is divided into two sovereign yet interconnected modules accessible via the top-bar module switcher:\n' +
      '1. FragMill: Focuses on drilling and blasting design, AI optical muckpile fragmentation analysis, detonation timing, environmental vibration (PPV), Cunningham Kuz-Ram forecasting, and downstream Mine-to-Mill comminution optimization.\n' +
      '2. GeoLab (FraGeo Lab): Focuses on geotechnical soil mechanics and aggregate testing laboratories, managing clients, projects, sampling chain of custody, 11 normalized material standards (Proctor, Sieve, Pycnometer, Los Angeles, etc.), and multi-test geotechnical investigation studies.',
      { size: 19, after: 160 }
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // =========================================================================
  // MODULE 1: FRAGMILL
  // =========================================================================

  // 1. FIELD WIZARD
  children.push(
    createHeaderRun('PART I: MODULE 1 — FRAGMILL (BLASTING & COMMINUTION)', HeadingLevel.TITLE),
    createHeaderRun('SECTION 1: FIELD WIZARD (RAPID IN-FIELD DATA & PHOTO CAPTURE)', HeadingLevel.HEADING_1),
    createParagraph(
      'The Field Wizard is designed for bench operators, shotfirers, and field geologists who need to log blast geometry and capture muckpile photography rapidly under harsh open-pit conditions without navigating complex engineering sub-menus.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_01_field_wizard.png', '1', 'FragMill Field Wizard showing the 4-step guided in-field capture workflow, active blast selector, and photo staging.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Project Selector', 'currentProject.id', 'ID String', 'Selects active mining concession. Links blast records to geological block models.'],
        ['Site Selector', 'site.id', 'ID String', 'Specific pit or bench sector. Sets spatial coordinate reference.'],
        ['Blast Identifier', 'blast.blastId', 'Alphanumeric', 'Official blast code (e.g. BL-2026-004). Primary tracking key across all mine records.'],
        ['Bench Elevation', 'blast.benchElevation', 'Meters (RL)', 'Bench level (e.g. 1240 RL). Dictates elevation slice and spatial correlation with orebody.'],
        ['Rock Mass Type', 'rockMass.rockType', 'Dropdown', 'Identifies formation (Granite, Basalt, Limestone). Sets baseline density and hardness.'],
        ['Burden (B)', 'parameters.burden', 'Meters (m)', 'Distance from free face to hole row. Dictates rock volume to be sheared and pushed.'],
        ['Spacing (S)', 'parameters.spacing', 'Meters (m)', 'Distance between adjacent holes. Controls fracture overlap and lateral uniformity.'],
        ['Bench Height (H)', 'parameters.benchHeight', 'Meters (m)', 'Vertical face thickness being mined. Dictates hole depth and muckpile throw.'],
        ['Hole Diameter (D)', 'parameters.holeDiameter', 'Millimeters (mm)', 'Drill bit diameter. Sets linear explosive loading concentration (kg/m).'],
        ['Hole Depth (L)', 'parameters.holeDepth', 'Meters (m)', 'Total drilled depth. Must equal Bench Height + Subdrill.'],
        ['Stemming Length (T)', 'parameters.stemmingLength', 'Meters (m)', 'Crushed rock collar confinement. Prevents premature gas blow-out and flyrock.'],
        ['Subdrill (J)', 'parameters.subdrill', 'Meters (m)', 'Drilling below planned floor level. Prevents unbroken high toes.'],
        ['Number of Holes', 'parameters.numberOfHoles', 'Integer Count', 'Total production and trim holes detonating in this pattern.'],
        ['Explosive Type', 'parameters.explosiveType', 'Dropdown', 'Selects bulk ANFO, Packaged Emulsion, Heavy ANFO, or Dynamite.'],
        ['Charge per Hole', 'parameters.chargePerHole', 'Kilograms (kg)', 'Total explosive mass loaded into the borehole.'],
        ['Scale Marker Object', 'image.calibration', 'Two-Point / Aruco', 'Physical reference object (e.g. 200 mm sphere). Calibrates camera pixels to mm.']
      ]
    ),
    createScenarioBox(
      'Rapid Post-Blast Bench Inspection in an Open-Pit Gold Concession',
      'During the exploration and early extraction phase of an open-pit gold deposit, field geologists must map blast heave and inspect fragmentation before excavators disturb the muckpile. In this mine, safety regulations permit only a 12-minute inspection window before hydraulic shovels move in. Using a ruggedized tablet running the Field Wizard, the geologist selects "Artisanal & Small-Scale Mining Concession", confirms Bench Elevation "1240 RL", enters the 3.5 m burden and 4.2 m spacing, and takes three photos with a 200 mm high-visibility sphere placed on the broken rock. The Wizard stores the entire record locally in IndexedDB, allowing the geologist to exit the pit safely while the software processes particle sizing in the background.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 2. BLAST RECORD
  children.push(
    createHeaderRun('SECTION 2: BLAST RECORD, GEOMECHANICS & EXPLOSIVES ECONOMICS', HeadingLevel.HEADING_1),
    createParagraph(
      'The Blast Record view is the primary engineering control room for drill and blast superintendents. It combines rock mass geomechanics, complete drilling geometry, explosive formulations, and unit cost accounting.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_02_blast_record.png', '2', 'FragMill Blast Record showing geomechanical inputs, drilling pattern dimensions, explosive loading, and unit cost metrics.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['UCS (Rock Strength)', 'rockMass.ucsMPa', 'Megapascals (MPa)', 'Unconfined compressive strength. Fundamental index of intact rock hardness.'],
        ['Young’s Modulus (E)', 'rockMass.youngsModulusGPa', 'Gigapascals (GPa)', 'Rock elasticity. Governs shock wave velocity and compressive strain breakage.'],
        ['Rock Density (ρr)', 'rockMass.density', 't/m³', 'In-situ rock density. Converts blasted volume into broken tonnage.'],
        ['Joint Spacing (Js)', 'rockMass.meanJointSpacing', 'Meters (m)', 'Mean discontinuity spacing. Determines in-situ natural block size distribution.'],
        ['Joint Orientation', 'rockMass.jointOrientation', 'Enum', 'Dip out of face, Strike perpendicular, or Dip into face. Affects backbreak risk.'],
        ['Hole Inclination', 'parameters.holeInclination', 'Degrees (°)', 'Borehole angle (90° = vertical). Angled holes improve toe displacement.'],
        ['Explosive Density (ρe)', 'parameters.chargingProfile.density', 'g/cm³', 'Bulk explosive matrix density (e.g. ANFO = 0.82 g/cm³, Emulsion = 1.18 g/cm³).'],
        ['RWS (Weight Strength)', 'parameters.rws', '% of ANFO', 'Relative Weight Strength. Measures explosive chemical energy relative to standard ANFO (100).'],
        ['Powder Factor (q)', 'derivedMetrics.powderFactor', 'kg/m³ and kg/t', 'Explosive energy concentration per unit volume/mass of broken rock.'],
        ['Specific Drilling', 'derivedMetrics.specificDrilling', 'm/m³', 'Drilling intensity: total meters drilled divided by blasted rock volume.']
      ]
    ),
    createScenarioBox(
      'Managing Pit Wall Crest Stability While Eliminating Crusher Boulders',
      'In a hard-rock granite aggregate quarry, blasting engineers were caught between two conflicting failures: heavy blasting near the final pit limit caused backbreak cracks that undermined the haul ramp, while lighter blasting generated massive 1.2-meter boulders that jammed the primary jaw crusher. Opening Blast Record BL-2026-004, the engineer analyzed the derived metrics: Burden = 3.5 m, Spacing = 4.2 m, UCS = 110 MPa, Density = 2.76 t/m³. The software calculated a Powder Factor of 0.68 kg/m³. By adjusting hole diameter from 150 mm down to 115 mm and tightening spacing to 3.8 m, the engineer redistributed explosive energy uniformly along the bench, preventing wall damage while eliminating crusher bridging.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 3. MUCKPILE AI SEGMENTATION
  children.push(
    createHeaderRun('SECTION 3: MUCKPILE PHOTO AI SEGMENTATION & PERCENTILE METRICS', HeadingLevel.HEADING_1),
    createParagraph(
      'Accurately measuring blasted rock fragmentation is essential for evaluating blast efficiency. FragMill employs advanced computer vision and deep learning segmentation engines to delineate individual rock particles from muckpile photos, computing exact percentile curves.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_03_blast_photos_segmentation.png', '3', 'FragMill Muckpile AI Segmentation displaying detected rock outlines, percentile metrics table, and the cumulative distribution curve.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Segmentation Engine', 'activeEngine', 'classical | ai_sam | hybrid', 'Selects Watershed edge detection, SAM deep learning, or Hybrid engine.'],
        ['Scale Calibration (px/mm)', 'calibration.pxPerMm', 'Pixels / mm', 'Conversion ratio. Converts image sensor pixel dimensions into physical millimeters.'],
        ['ROI Boundary Polygon', 'image.roiPolygon', 'Point2D Array', 'Restricts AI analysis strictly to rock muckpile, excluding sky, floor, and equipment.'],
        ['Exclusion Polygons', 'image.exclusionPolygons', 'Point2D Array', 'Masks out non-geological objects such as rock hammers, water puddles, or safety cones.'],
        ['P10 (Fines Threshold)', 'metrics.p10', 'Millimeters (mm)', '10% passing particle size. Represents fine gravel and sand generation.'],
        ['P20', 'metrics.p20', 'Millimeters (mm)', '20% passing particle size. Evaluates fine matrix cushioning during digging.'],
        ['P50 (Median Size)', 'metrics.p50', 'Millimeters (mm)', '50% passing median diameter. Primary index of general muckpile diggability.'],
        ['P80 (Crusher Top Size)', 'metrics.p80', 'Millimeters (mm)', '80% passing diameter. Critical operational parameter governing primary crusher feed.'],
        ['P90 & PMax', 'metrics.p90, metrics.pMax', 'Millimeters (mm)', 'Largest rock fragments. Indicates oversize boulders that require secondary rock-breaking.'],
        ['Bootstrap 95% CI', 'metrics.bootstrapCI', '[Min - Max] mm', 'Statistical confidence interval. Validates whether photo sample size is representative.']
      ]
    ),
    createScenarioBox(
      'Diggability Audit Following Shovel Cycle Delay Complaints',
      'In a copper mine, loading operators reported that excavator cycle times on Bench 1240 had jumped from 22 seconds to 34 seconds, severely throttling pit production. The mine superintendent logged into FragMill and reviewed photo segmentation run #run-01. The AI engine identified 142 distinct rock fragments with calibrated pxPerMm = 0.40. The metrics revealed P80 = 285 mm and P90 = 360 mm, with an oversize fraction (> 300 mm) of 8.4%. The bootstrap confidence interval confirmed P80 was constrained between 265 mm and 305 mm. This provided definitive data proving that inadequate bottom charge heave had caused tight packing, directing the drill-and-blast team to increase subdrill on the next pattern.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 4. INDIVIDUAL FRAGMENTS TABLE
  children.push(
    createHeaderRun('SECTION 4: INDIVIDUAL FRAGMENT MIN & MAX SIZING TABLE', HeadingLevel.HEADING_1),
    createParagraph(
      'Unlike legacy fragmentation tools that only provide generic summary curves, FragMill maintains a discrete dimensional record for every detected rock fragment, enabling rigorous stereological and shape analysis.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_04_individual_fragments_table.png', '4', 'FragMill Individual Fragment Sizing Table showing discrete dimensions (Min Feret, Max Feret, ECD, 3D Thickness) and category filters.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Column Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Fragment ID (#ID)', 'fragment.id', 'Integer', 'Unique tracking identifier for each segmented rock particle.'],
        ['Min Size (d_min)', 'fragment.minFeretMm', 'Millimeters (mm)', 'Minimum caliper Feret diameter. Closest physical approximation to square mesh sieve aperture.'],
        ['Max Size (d_max)', 'fragment.maxFeretMm', 'Millimeters (mm)', 'Maximum caliper length. Represents the longest dimension of the rock fragment.'],
        ['Equiv. Diam. (ECD)', 'fragment.ecdMm', 'Millimeters (mm)', 'Equivalent Circular Diameter: diameter of a circle with identical surface area.'],
        ['3D Thickness', 'fragment.thicknessMm', 'Millimeters (mm)', 'Stereologically estimated C-axis thickness, accounting for 2D surface resting orientation.'],
        ['Estimated Volume', 'fragment.volumeMm3', 'Cubic mm (mm³)', '3D particle volume computed from triaxial ellipsoid formulation.'],
        ['Aspect Ratio (Elongation)', 'fragment.aspectRatio', 'Ratio (d_max/d_min)', 'Measure of particle shape. High aspect ratios (> 2.5) indicate slabby/flaky rocks.'],
        ['Filter Tabs', 'fragmentFilter', 'all | fines | nominal | oversize', 'Enables instant sorting and counting of rocks falling into specific size bins.']
      ]
    ),
    createScenarioBox(
      'Screening for Elongated Slabs in Railroad Ballast Production',
      'A quarry producing high-speed railroad ballast was penalized because crushed ballast contained excessive needle-shaped and slabby rock pieces that broke under train axle loads. In FragMill, the quality technician opened the Individual Fragment Table and sorted particles by Aspect Ratio. The table immediately highlighted that 22% of fragments had an aspect ratio exceeding 2.8, with Max Feret > 180 mm but Min Feret < 50 mm. This revealed that the blast was splitting along tightly spaced bedding planes rather than shattering intact rock, leading engineers to alter hole firing direction relative to the rock strike.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 5. PATTERN MAP & BENCH HOLES
  children.push(
    createHeaderRun('SECTION 5: BENCH PATTERN MAP & DRILL HOLE MANAGEMENT', HeadingLevel.HEADING_1),
    createParagraph(
      'The Pattern Map provides spatial visualization and individual condition tracking for every borehole on the bench, managing coordinates, drilling depths, groundwater ingress, and structural cavities.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_05_pattern_map.png', '5', 'FragMill Pattern Map showing spatial drill hole layout, hole depth/burden coordinates, and aggregate blast summary metrics.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Hole ID', 'hole.holeId', 'String (e.g. BH-01)', 'Individual borehole tag. Matches surveyor flags and driller logs.'],
        ['Row Number', 'hole.rowNumber', 'Integer', 'Row index. Row 1 is the front free face; higher rows experience greater confinement.'],
        ['Easting (X)', 'hole.eastingX', 'Meters (m)', 'Mine grid Easting coordinate of the borehole collar.'],
        ['Northing (Y)', 'hole.northingY', 'Meters (m)', 'Mine grid Northing coordinate of the borehole collar.'],
        ['Collar Elevation (Z)', 'hole.elevationZ', 'Meters RL', 'Surveyed ground surface elevation at borehole collar.'],
        ['Drilled Depth', 'hole.depthM', 'Meters (m)', 'Measured depth of hole. Verifies whether driller achieved design subdrill.'],
        ['Water Depth', 'hole.waterDepthM', 'Meters (m)', 'Depth of standing ground water. Water > 0 m flags hole as wet.'],
        ['Hole Status Flag', 'hole.status', 'Enum', 'Planned, Drilled, Loaded, Stemmed, or Blasted. Tracks daily loading progress.'],
        ['Cavity / Fault Flag', 'hole.hasCavityOrFault', 'Boolean', 'Indicates unexpected void or shear zone encountered during drilling.']
      ]
    ),
    createScenarioBox(
      'Detecting Water Inflow and Hole Slumping Prior to Explosive Loading',
      'On Bench 1240, heavy overnight rainfall caused groundwater seepage into drill holes along the northern boundary. When the shotfiring crew arrived to load bulk ANFO, the blast engineer reviewed the Pattern Map. Out of 24 holes, 6 holes showed water depths between 1.8 m and 3.4 m. Because standard ANFO dissolves rapidly in water, loading it would have caused complete detonation failure and unbroken rock toes. Using the Pattern Map, the engineer flagged the 6 wet holes, automatically routing waterproof emulsion cartridges to those locations and preventing a major blast misfire.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 6. 3-DECK CHARGING PROFILE
  children.push(
    createHeaderRun('SECTION 6: 3-DECK CHARGING PROFILE & FAULT MITIGATION', HeadingLevel.HEADING_1),
    createParagraph(
      'Modern blast engineering requires customized vertical charge profiles within each borehole. FragMill’s 3-Deck Loading module models the bottom toe primer, bulk column charge, air decking spacers, and geological fault mitigation plugs.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_06_charging_3deck.png', '6', 'FragMill 3-Deck Charging Profile showing toe primer formulation, nitrate-fuel oil column ratio, and fault decking spacers.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Toe Explosive Type', 'profile.toeExplosiveType', 'Dropdown', 'Dynamite, Emulsion Cartridge, or Booster. High-velocity primer placed at hole bottom.'],
        ['Toe Cartridge Weight', 'profile.toeCartridgeWeightGrams', 'Grams (g)', 'Mass per cartridge (e.g. 250g or 500g). Configures primer strength.'],
        ['Toe Cartridge Count', 'profile.toeCartridgeCount', 'Integer', 'Number of cartridges loaded in toe. Determines toe charge mass (kg).'],
        ['Column Explosive Type', 'profile.columnExplosiveType', 'Dropdown', 'ANFO bulk, Emulsion matrix, or Heavy ANFO. Fills main borehole column.'],
        ['Nitrate Bags (25kg)', 'profile.anfoNitrateBags25kg', 'Bag Count', 'Number of 25kg porous prilled ammonium nitrate bags poured.'],
        ['Fuel Liters per Bag', 'profile.fuelLitersPerBag', 'Liters (L/bag)', 'Diesel added per 25kg bag. Optimal stoichiometric balance is 3.0 L/bag (6% fuel oil).'],
        ['Column Total Weight', 'profile.columnTotalWeightKg', 'Kilograms (kg)', 'Total column charge mass: Nitrate mass + Diesel mass (density = 0.84 kg/L).'],
        ['Stemming Material', 'profile.stemmingMaterial', 'Dropdown', 'Crushed aggregate (0/10 mm), Drill cuttings, or Clay. Aggregates lock best in collar.'],
        ['Fault Depth & Thickness', 'profile.faultDepthM, faultThicknessM', 'Meters (m)', 'Depth and vertical height of void/shear zone where explosive must NOT be poured.'],
        ['Decking Plug Strategy', 'profile.faultMitigationStrategy', 'Dropdown', 'Air deck plug, wood spacer, or inert gravel. Prevents explosive waste in cavities.']
      ]
    ),
    createScenarioBox(
      'Preventing Dangerous Over-Charging in a Karstic Limestone Formation',
      'In a cement limestone quarry riddled with karstic cavities, an explosive loading crew poured bulk ANFO into borehole BH-14. Unknown to the crew, a 1.5-meter void was located at 5.0 meters depth. The ANFO flowed uncontrolled into the void, creating an enormous concentration of explosive. If detonated, this would have produced catastrophic flyrock capable of traveling 800 meters into nearby facilities. By utilizing FragMill’s 3-Deck Loading Profile, the driller logged the cavity at 5.2 m depth with 1.4 m thickness. The software mandated an air deck plug across the void, saving 65 kg of explosive and eliminating a critical safety hazard.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 7. DETONATION TIMING & PPV
  children.push(
    createHeaderRun('SECTION 7: DETONATION TIMING & VIBRATION (PPV) SIMULATOR', HeadingLevel.HEADING_1),
    createParagraph(
      'Controlling the millisecond initiation sequence across holes creates dynamic relief faces, directs muckpile displacement, and manages ground vibrations. FragMill features an interactive timing visualizer and USBM Peak Particle Velocity (PPV) attenuation predictor.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_07_detonation_timing.png', '7', 'FragMill Detonation Timing Simulator showing firing sequence contours, tie-in paths, and USBM vibration attenuation predictions.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['In-Hole Detonator Delay', 'blast.parameters.inHoleDelay', 'Milliseconds (ms)', 'Down-the-hole delay cap (e.g. 500 ms). Ensures surface tie-in fires completely before first hole.'],
        ['Inter-Hole Delay (Δth)', 'timing.interHoleDelayMs', 'Milliseconds (ms)', 'Delay between adjacent holes along row (e.g. 17 ms). Creates lateral fracture relief.'],
        ['Inter-Row Delay (Δtr)', 'timing.interRowDelayMs', 'Milliseconds (ms)', 'Delay between successive rows (e.g. 42 ms). Provides forward heave time for previous row.'],
        ['Detonator Accuracy / Scatter', 'timing.scatterMs', '± Milliseconds (ms)', 'Timing precision. Electronic detonators (±0.1 ms) eliminate cap overlap vs Nonel (±5 ms).'],
        ['Max Charge per Delay (MIC)', 'timing.micKg', 'Kilograms (kg)', 'Maximum mass of explosive detonating within any 8 ms window. Directly drives vibration.'],
        ['Distance to Asset (R)', 'timing.distanceM', 'Meters (m)', 'Distance from blast centroid to nearest sensitive structure (house, pipeline, bridge).'],
        ['USBM Site Constant (K)', 'timing.usbmK', 'Dimensionless', 'Empirical geological transmission coefficient. Calibrated via field seismographs.'],
        ['USBM Decay Exponent (β)', 'timing.usbmBeta', 'Dimensionless', 'Geological damping factor (typically -1.5 to -1.8).'],
        ['Predicted PPV', 'timing.predictedPpvMmS', 'mm / second', 'Peak Particle Velocity. Must comply with legal vibration standards (e.g. < 5 mm/s).']
      ]
    ),
    createScenarioBox(
      'Vibration Compliance Blasting 280 Meters from a High-Pressure Gas Pipeline',
      'An iron ore mine was blasting a new cut located 280 meters from a buried regional natural gas pipeline with an absolute vibration limit of 10.0 mm/s. The initial blast proposal utilized pyrotechnic non-electric detonators firing 3 holes simultaneously, resulting in an MIC of 360 kg. Plugging these values into FragMill’s Timing Simulator with the calibrated site constants (K = 1140, β = -1.6) produced a predicted PPV of 13.8 mm/s—a dangerous breach of safety limits. The engineer redesigned the pattern in FragMill using electronic detonators with 25 ms inter-hole delays, reducing the effective 8 ms MIC to 120 kg. The simulated PPV dropped to 5.4 mm/s, enabling safe blasting without gas utility shutdown.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 8. KUZ-RAM PREDICTOR
  children.push(
    createHeaderRun('SECTION 8: KUZ-RAM & CUNNINGHAM XP-FRAG PREDICTOR', HeadingLevel.HEADING_1),
    createParagraph(
      'Predicting rock fragmentation prior to drilling allows engineers to simulate powder factor trade-offs and evaluate blast designs mathematically. FragMill implements the complete Cunningham Kuz-Ram and XP-Frag models, featuring interactive Rock Factor A parameter tables.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_08_kuzram_predictor.png', '8', 'FragMill Kuz-Ram & Cunningham Predictor showing rock factor inputs, predicted percentiles, and the Tornado Sensitivity Chart.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Rock Mass Description (RMD)', 'tables.rmd', 'Score (10, 20, 50)', 'Powdery/friable = 10, Blocky = 20, Massive unbroken rock = 50.'],
        ['Joint Frequency (JF)', 'tables.jf', 'Score (10, 20, 50)', 'Discontinuity spacing: Close (<0.1m) = 10, Intermediate (0.1-1m) = 20, Wide (>1m) = 50.'],
        ['Joint Orientation (JFO)', 'tables.jfo', 'Score (20, 30, 40)', 'Dip out of face = 20 (easiest breakage), Strike perpendicular = 30, Dip into face = 40.'],
        ['Hardness Factor (HF)', 'tables.hf', 'Score', 'Calculated from UCS and Young’s modulus: E/3 (if E < 50) or UCS/5 (if E ≥ 50).'],
        ['Rock Factor (A)', 'calculateRockFactorA()', 'Index (0.8 - 14)', 'Master rock mass factor: A = 0.06 × (RMD + JF + RDI + HF). Higher A = harder blasting.'],
        ['Uniformity Index (n)', 'kuzRamResult.n', 'Slope Index', 'Steepness of Rosin-Rammler curve. Higher n (1.4-1.8) = narrow size band; low n = fines + boulders.'],
        ['Characteristic Size (Xc)', 'kuzRamResult.xc', 'Centimeters (cm)', 'Weibull distribution scale parameter corresponding to 63.2% cumulative passing size.'],
        ['Predicted P50 & P80', 'kuzRamResult.p50, p80', 'Millimeters (mm)', 'Predicted median and 80th percentile fragmentation diameters.'],
        ['Predicted Fines (<25mm)', 'kuzRamResult.finesPercent', 'Percentage (%)', 'Predicted proportion of pulverized fines generated by shock wave crushing.'],
        ['Tornado Sensitivity Chart', 'sensitivityData', 'Chart Graphic', 'Displays relative impact of altering Burden, Spacing, Powder Factor, or Rock Factor on P80.']
      ]
    ),
    createScenarioBox(
      'Predicting Fragmentation Changes When Moving from Weathered to Fresh Rock',
      'As an open pit deepened, mining operations moved from soft, weathered schists into unweathered, massive granodiorite. Initial production blasts in the fresh rock using the old pattern generated massive boulders that halted shovel operations. The chief engineer opened FragMill Kuz-Ram: changing RMD from 20 to 50, JF from 20 to 50, and UCS from 45 MPa to 135 MPa. Rock Factor A surged from 5.4 to 10.8. The model predicted that under the existing pattern, P80 would jump from 195 mm to 480 mm with 24% oversize (> 300 mm). The engineer simulated increasing the powder factor from 0.52 to 0.76 kg/m³ with a tighter 3.2 m × 3.8 m pattern, bringing predicted P80 back down to 240 mm and preventing pit downtime.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 9. MINE-TO-MILL INTEGRATION
  children.push(
    createHeaderRun('SECTION 9: MINE-TO-MILL INTEGRATION & METALLURGICAL KPIS', HeadingLevel.HEADING_1),
    createParagraph(
      'The Mine-to-Mill interface bridges pit operations with processing plant performance, tracking ore batch tonnage, crusher hours, grinding energy, head grades, and metal recovery.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_09_minetomill_kpis.png', '9', 'FragMill Mine-to-Mill View displaying batch tonnage, haul truck counts, crusher/mill power draw, head grades, and metal recovery.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Batch Tonnage', 'millBatch.batchTonnageTonnes', 'Tonnes (t)', 'Total mass of blasted ore delivered to the run-of-mine (ROM) plant stockpile.'],
        ['Truck Count', 'millBatch.truckCount', 'Count', 'Number of haul truck loads dumped. Computes average payload (tonnes/truck).'],
        ['Boulders (Secondary Breaking)', 'millBatch.bouldersSecondaryBreakingCount', 'Count', 'Number of oversized boulders rejected at crusher grizzly requiring hydraulic breaker.'],
        ['Crushing Time', 'millBatch.crushingTimeHours', 'Hours (h)', 'Total operating hours required by primary jaw/gyratory crusher to process batch.'],
        ['Crushing Energy', 'millBatch.crushingEnergyKwh', 'Kilowatt-hours (kWh)', 'Electrical energy consumed by primary crusher motors during processing.'],
        ['Milling Throughput', 'millBatch.millingThroughputTph', 'Tonnes / hour (t/h)', 'Sustained throughput rate through the SAG and ball mill grinding circuit.'],
        ['Milling Energy', 'millBatch.millingEnergyKwh', 'Kilowatt-hours (kWh)', 'Total electrical power consumed by tumbling mills to grind ore to product size.'],
        ['Head Grade', 'millBatch.headGradeGpt', 'Grams / tonne (g/t)', 'Valuable mineral grade entering the mill (e.g. 3.50 g/t gold).'],
        ['Tails Grade', 'millBatch.tailsGradeGpt', 'Grams / tonne (g/t)', 'Residual mineral grade lost in plant tailings discharge (e.g. 0.45 g/t gold).'],
        ['Metal Recovery', 'liveKPIs.recoveryPercent', 'Percentage (%)', 'Metallurgical recovery: 100 × (Head Grade - Tails Grade) / Head Grade.']
      ]
    ),
    createScenarioBox(
      'Connecting Blasting Powder Factor to Mill Gold Recovery and Plant Throughput',
      'In a gold processing facility, plant managers noticed that whenever Bench 1240 blasted ore was processed, SAG mill throughput dropped from 85 t/h to 65 t/h, and power draw surged to 16.7 kWh/t. Entering batch data into FragMill Mine-to-Mill (Batch Tonnage = 1500 t, Crushing Energy = 2,800 kWh, Milling Energy = 25,000 kWh, Head Grade = 3.50 g/t, Tails Grade = 0.45 g/t), the system computed a metal recovery of 87.14% and total comminution energy of 18.53 kWh/t. The scatter plot revealed that a 10% reduction in blast P80 would yield a 15% increase in mill throughput and $1.15/tonne net savings, prompting immediate drill pattern tightening.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 10. COMMINUTION DIGITAL TWIN
  children.push(
    createHeaderRun('SECTION 10: COMMINUTION DIGITAL TWIN, ENERGY & CARBON FOOTPRINT', HeadingLevel.HEADING_1),
    createParagraph(
      'The Comminution Digital Twin provides a mechanical and thermodynamic simulation of crushing, SAG milling, and ball mill circuits. It couples Bond and Morrell comminution equations with operational wear models and Scope 2 carbon emission calculations.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_10_comminution_twin.png', '10', 'FragMill Comminution Digital Twin showing Bond work index, SAG/ball power draw, carbon footprint, and the Economic Trade-Off Curve.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Blast Feed Size (F80)', 'circuitParams.f80Mm', 'Millimeters (mm)', '80% passing top size of blasted rock entering primary crusher.'],
        ['Target Product (P80)', 'circuitParams.targetP80Mm', 'Microns (μm)', 'Final target grind size delivered to flotation or leaching (e.g. 75 μm).'],
        ['Bond Work Index (Wi)', 'circuitParams.bondWorkIndexKWhPerT', 'kWh / tonne', 'Laboratory resistance of ore to ball mill grinding (e.g. 14.5 kWh/t).'],
        ['Drop-Weight Hardness (Axb)', 'circuitParams.rockAxb', 'Dimensionless', 'JKMRC impact breakage parameter. Lower A×b indicates harder ore in SAG mills.'],
        ['Plant Operating Hours', 'circuitParams.plantOperatingHoursPerDay', 'Hours / day', 'Daily operating utilization (e.g. 20 hours/day).'],
        ['Electricity Tariff', 'circuitParams.electricityCostPerKWhUSD', 'USD / kWh', 'Power tariff ($/kWh). Converts electrical megawatt-hours into operating expenditure.'],
        ['Explosive Unit Cost', 'circuitParams.explosiveCostPerKgUSD', 'USD / kg', 'Cost per kg of bulk explosive loaded on the bench.'],
        ['Target Daily Tonnage', 'circuitParams.targetDailyThroughputTonnes', 'Tonnes / day', 'Required production quota to meet mill feed contracts.'],
        ['Total Specific Energy', 'simResult.totalSpecificEnergyKWhPerT', 'kWh / tonne', 'Sum of primary crushing, SAG milling, and ball mill energy intensity.'],
        ['Carbon Footprint', 'simResult.carbonFootprintKgCO2PerT', 'kg CO2e / tonne', 'Scope 2 greenhouse gas emissions resulting from electrical comminution energy.']
      ]
    ),
    createScenarioBox(
      'Decarbonization and Electrical Power Savings in an Industrial Concentrator',
      'A copper concentrator consuming 45 megawatts of electrical power was mandated by corporate sustainability targets to reduce Scope 2 carbon emissions by 10%. Using FragMill’s Comminution Digital Twin, the metallurgist input the ore’s Bond Work Index (Wi = 14.5 kWh/t, A×b = 42) and simulated incoming blast feed sizing. The Economic Trade-Off Curve demonstrated that spending an extra $0.22/tonne on the bench to increase explosive powder factor reduced incoming F80 from 280 mm to 160 mm. In the mill, this finer feed slashed specific grinding energy by 2.4 kWh/tonne, saving $0.34/tonne in net operating cost and reducing plant carbon emissions by 18,500 tonnes of CO2e annually.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 11. VALIDATION DASHBOARD
  children.push(
    createHeaderRun('SECTION 11: VALIDATION DASHBOARD & PHYSICAL SIEVE QA/QC', HeadingLevel.HEADING_1),
    createParagraph(
      'The Validation Dashboard provides a scientific calibration environment. It overlays AI optical image segmentation against physical mechanical sieve ground truth, running Rosin-Rammler and Swebrec non-linear regressions to validate accuracy and contractual compliance.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_11_validation_dashboard.png', '11', 'FragMill Validation Dashboard showing the physical sieve ground truth table, regression model comparison, and QA/QC acceptance decision.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Sieve Mesh Name', 'sieveData[i].meshName', 'String (e.g. 100mm)', 'Standard sieve aperture name (ASTM / Tyler / ISO).'],
        ['Aperture (Size mm)', 'sieveData[i].apertureMm', 'Millimeters (mm)', 'Square opening dimension of the mechanical test sieve screen.'],
        ['Retained Mass (kg)', 'sieveData[i].massRetainedKg', 'Kilograms (kg)', 'Physical mass of rock fragments retained on that specific sieve screen.'],
        ['Cumulative Passing (%)', 'sieveData[i].passingPercent', 'Percentage (%)', 'Calculated cumulative weight percentage passing through the aperture.'],
        ['Rosin-Rammler (R²)', 'rosinRammlerFit.r2', 'Score (0 - 1)', 'Coefficient of determination measuring goodness-of-fit for Rosin-Rammler model.'],
        ['Swebrec Model (R²)', 'swebrecFit.r2', 'Score (0 - 1)', 'Goodness-of-fit for the 5-parameter Swebrec distribution, superior in fines ranges.'],
        ['Mean Absolute Error (MAE)', 'validation.mae', 'Percentage (%)', 'Mean absolute deviation between optical AI predictions and physical sieve data.'],
        ['QA/QC Acceptance Banner', 'validation.status', 'Pass / Warning / Fail', 'Automated decision: PASS if MAE < 5% and R² > 0.95; otherwise flags calibration warning.']
      ]
    ),
    createScenarioBox(
      'Auditing Contractor Fragmentation Claims Under Contractual Guarantee',
      'A mining company contracted an external drilling and blasting provider under a performance agreement guaranteeing that at least 80% of muckpile rock would pass 300 mm (P80 ≤ 300 mm). Following blast BL-2026-004, the contractor submitted optical image analysis claiming P80 = 265 mm. To audit the claim, the mine’s QA/QC team took a representative 1,200 kg sample from the muckpile and processed it through a mechanical sieve shaker. Entering the sieve masses into FragMill Validation Dashboard, the system computed a certified sieve P80 of 282 mm, validated an R² of 0.984 against the optical curve, and verified an MAE of 3.2% (PASS), officially confirming contractual compliance.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 12. EXPERIMENTAL MODULES
  children.push(
    createHeaderRun('SECTION 12: EXPERIMENTAL MODULES (DRONE 3D & BELTVISION CONVEYOR)', HeadingLevel.HEADING_1),
    createParagraph(
      'The Experimental Workspace introduces advanced technological capabilities: photogrammetric 3D muckpile volume reconstruction from aerial drone surveys, and continuous real-time conveyor belt computer vision for plant feed monitoring.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_12_drone_3d.png', '12', 'FragMill Drone 3D Muckpile Analysis showing digital elevation model, post-blast profile, and volumetric swell factor calculations.'),
    ...createScreenshotBlock('fragmill_13_beltvision.png', '13', 'FragMill BeltVision Conveyor Monitoring showing real-time sizing feed curves and oversize boulder alarm triggers.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Drone DEM / Point Cloud', 'droneData.pointCloudUrl', 'XYZ Point Data', 'Digital Elevation Model generated from post-blast aerial photogrammetry.'],
        ['Pre-Blast Solid Volume', 'droneData.inSituVolumeM3', 'Cubic meters (m³)', 'Surveyed volume of intact rock before detonation.'],
        ['Post-Blast Muckpile Volume', 'droneData.brokenVolumeM3', 'Cubic meters (m³)', 'Reconstructed 3D volume of broken muckpile on pit floor.'],
        ['Volumetric Swell Factor', 'droneData.swellFactor', 'Ratio (V1/V0)', 'Swell factor (typically 1.25 to 1.50). Dictates excavator bucket filling efficiency.'],
        ['Conveyor Belt Speed', 'beltConfig.beltSpeedMPerSec', 'Meters / sec (m/s)', 'Belt linear velocity (e.g. 2.4 m/s). Synchronizes video camera frame rates.'],
        ['Belt Width Calibration', 'beltConfig.beltWidthMm', 'Millimeters (mm)', 'Physical conveyor width. Provides continuous metric scale across belt width.'],
        ['Oversize Alarm Limit', 'beltConfig.oversizeAlarmMm', 'Millimeters (mm)', 'Threshold aperture (e.g. 450 mm). Automatically triggers plant audible alarm if exceeded.']
      ]
    ),
    createScenarioBox(
      'Drone Volumetric Survey and Shovel Tooth Conveyor Protection',
      'Following a 50,000-tonne production blast, a surveying drone captured 350 overlapping aerial images. The photogrammetric point cloud was loaded into FragMill Drone 3D, which computed a post-blast broken volume of 24,150 m³ against an in-situ volume of 17,250 m³, establishing a swell factor of 1.40. Meanwhile, at the primary crusher discharge conveyor, BeltVision operated at 25 frames per second. At 03:15 AM, BeltVision detected a solid metallic mass measuring 480 mm—a broken excavator bucket tooth. The system triggered an automatic conveyor interlock stop, saving the secondary cone crusher from catastrophic mechanical failure.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 13. REPORT VAULT
  children.push(
    createHeaderRun('SECTION 13: CONSOLIDATED REPORT VAULT & CRYPTOGRAPHIC SIGNING', HeadingLevel.HEADING_1),
    createParagraph(
      'The Report Vault compiles staged blast records, pattern maps, Kuz-Ram predictions, comminution twins, and QA/QC certificates into tamper-evident PDF engineering reports verified with SHA-256 cryptographic hashes.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('fragmill_14_report_vault.png', '14', 'FragMill Report Vault Modal showing staged section selectors, cryptographic signature, and general PDF report download.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Staged Section Selectors', 'selectedKeys', 'Module Keys', 'Multi-check selection of sections to bundle: Blast Record, Pattern, Kuz-Ram, Twin, QA/QC.'],
        ['Staged Count / Total', 'stagedCount / totalSections', 'Ratio (e.g. 7/7)', 'Tracks whether all technical sections have been reviewed and approved for export.'],
        ['SHA-256 Hash Digest', 'vaultState.hashDigest', 'Hex String', 'Cryptographic fingerprint embedded into the document footer to guarantee authenticity.'],
        ['Language Selector', 'lang', 'FR / EN Toggle', 'Generates completely bilingual engineering reports in either French or English.']
      ]
    ),
    createScenarioBox(
      'Official Regulatory Submission for a Mine Safety & Environmental Audit',
      'Following an annual safety review by the Ministry of Mines, inspectors requested verified engineering documentation for blast BL-2026-004. The chief engineer opened the FragMill Report Vault, staged all 7 technical modules, verified the SHA-256 cryptographic hash, and clicked "Download Combined Report". The system generated a 14-page bilingual PDF with embedded vector charts and immutable audit stamps, satisfying inspectors and providing an indelible legal audit record.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // =========================================================================
  // MODULE 2: GEOLAB
  // =========================================================================

  // 14. CLIENT MANAGEMENT
  children.push(
    createHeaderRun('PART II: MODULE 2 — GEOLAB (GEOTECHNICAL LABORATORY)', HeadingLevel.TITLE),
    createHeaderRun('SECTION 14: CLIENT RELATIONSHIP & CONTRACTOR MANAGEMENT', HeadingLevel.HEADING_1),
    createParagraph(
      'GeoLab manages geotechnical soil mechanics and construction materials testing laboratories. The Client Management system provides a directory of project owners, engineering consultancies, general contractors, and government ministries commissioning testing.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_01_clients.png', '15', 'GeoLab Client Directory interface showing client legal profiles, contact persons, tax registration numbers, and linked project counts.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Company Legal Name', 'client.companyName', 'Legal Entity String', 'Official corporate name of contracting firm (e.g. "Demo Client"). Appears on official certificates.'],
        ['Contact Person & Title', 'client.contactPerson, jobTitle', 'Name & Title', 'Lead geotechnical engineer or project director receiving test certificates.'],
        ['Email & Telephone', 'client.email, client.phone', 'Contact Strings', 'Enables automated report delivery and immediate notification of lab non-conformities.'],
        ['Billing Address & City', 'client.address, client.city', 'Postal Address', 'Official fiscal address required for ISO/IEC 17025 accredited laboratory test covers.'],
        ['Tax / SIRET / VAT Number', 'client.taxRegistrationNumber', 'Tax Code', 'Legal tax registration number (e.g. FR 44 380 409 982). Mandatory for public tenders.'],
        ['Active Projects Tally', 'client.projectsCount', 'Integer', 'Number of active geotechnical infrastructure projects commissioned by this client.']
      ]
    ),
    createScenarioBox(
      'Managing Multi-Contractor Submissions on a National Highway Project',
      'On a 180 km national expressway construction project, three international general contractors and four local subcontractors were submitting hundreds of soil and gravel samples weekly to a centralized materials testing laboratory. GeoLab’s Client Management module allowed the laboratory director to maintain segregated client records for each contractor. When a sub-base material failed compaction limits, the system immediately identified the responsible contractor and issued a targeted alert without cross-contaminating project data.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 15. PROJECTS & SAMPLES
  children.push(
    createHeaderRun('SECTION 15: GEOTECHNICAL PROJECTS & SAMPLE CHAIN OF CUSTODY', HeadingLevel.HEADING_1),
    createParagraph(
      'Geotechnical investigations require rigorous sample chain of custody. The Projects and Samples view manages the administrative framework of engineering contracts while tracking individual soil specimens from field boreholes and test pits through to laboratory test queues.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_02_projects_samples.png', '16', 'GeoLab Projects & Geotechnical Sample Management showing borehole depth intervals, sampling dates, and material classification.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Project Name', 'project.projectName', 'Project Title', 'Administrative title (e.g. "Demo Project - National Route Section PK 40+800").'],
        ['Site Location / PK', 'project.siteLocation', 'Location String', 'Kilometric Point or geographic coordinate (e.g. "PK 40+800 Côté Gauche").'],
        ['Contract & Tender No.', 'project.contractNumber, tenderNumber', 'Contract Strings', 'Official tender and public procurement numbers governing the testing campaign.'],
        ['Involved Parties', 'project.parties', 'Role & Name Array', 'Multi-party registry: Client (Maître d’Ouvrage), Control Bureau, and General Contractor.'],
        ['Sample Reference ID', 'sample.sampleId', 'Sample Code', 'Unique field bag identifier (e.g. "DEMO-P1 (Sable sableuse)"). Preserves chain of custody.'],
        ['Borehole / Pit Origin', 'sample.location', 'Sounding String', 'Specific exploratory drilling hole or test pit (e.g. "Sondage P1 - PK 40+800").'],
        ['Depth Interval', 'sample.depth', 'Meters (m)', 'Sampling depth range (e.g. "1.50 - 2.50 m"). Crucial for foundation layer stratigraphy.'],
        ['Sampling Date & Sampler', 'sample.samplingDate, sampler', 'Date & Name', 'Date recovered and certified sampler identity, ensuring ISO traceability.'],
        ['Material Classification', 'sample.materialType', 'Soil Group Code', 'Geotechnical soil group (e.g. "Sable sableuse (Sm / A3 / D1)") under GTR / USCS.']
      ]
    ),
    createScenarioBox(
      'Bridge Foundation Geotechnical Campaign Across an Alluvial River Delta',
      'Prior to constructing an 8-span highway bridge across an alluvial river delta, geotechnical drillers sank 12 deep boreholes to 45 meters depth. As core barrels and SPT split-spoons were extracted, technicians logged each sample into GeoLab: recording borehole ID, exact depth interval (e.g., 18.2 m - 19.0 m), groundwater level, and visual description ("Soft gray silty clay with organic traces"). When the samples arrived at the central lab, lab technicians scanned the sample IDs, immediately accessing their spatial origin and initiating water content and Atterberg tests.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 16. NEW ANALYSIS CATALOG
  children.push(
    createHeaderRun('SECTION 16: NEW ANALYSIS TEST CATALOG (THE 11 NORMALIZED STANDARDS)', HeadingLevel.HEADING_1),
    createParagraph(
      'The New Analysis interface is the core testing engine of GeoLab. It supports 11 standardized European (NF EN), French (NF P), and international (ASTM/ISO) test methods across soils and aggregates. Every test features automated calculation, quality warnings, repeatability verification, and bidirectional Excel template exchange.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_03_new_analysis_catalog.png', '17', 'GeoLab New Analysis selector showing the 11 normalized soil and aggregate materials test cards.'),
    createHeaderRun('Comprehensive Technical Breakdown of the 11 Normalized Standards', HeadingLevel.HEADING_2),
    createParagraph(
      '1. Proctor Compaction Test (NF P94-093 / ASTM D698 / D1557):\n' +
      'Determines the relationship between moisture content and dry density for a compacted soil. Identifies Maximum Dry Density (ρd,max / OPM) and Optimum Moisture Content (wopt). Essential for road embankments, dam cores, and pavement sub-bases.\n' +
      'Variables: Mould volume (V), mould tare mass, moist soil + mould mass, tare IDs, wet mass, oven-dry mass, moisture percentage (w%), and dry density (ρd).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '2. Grain Size Distribution / Sieve Analysis (NF P94-056 / NF EN 933-1):\n' +
      'Determines the particle size distribution curve by wet washing over a 0.08 mm (or 0.063 mm) sieve followed by mechanical dry sieving across a standardized sieve nest (up to 100 mm). Computes characteristic diameters (D10, D30, D60), Uniformity Coefficient (Cu = D60/D10), and Curvature Coefficient (Cc = D30² / (D10 × D60)).\n' +
      'Variables: Total dry mass (M0), washed mass retained, per-sieve retained masses, cumulative retained %, and passing %.',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '3. Water Content by Oven Drying (NF P94-050 / ASTM D2216):\n' +
      'Direct thermal determination of free water content: w = 100 × (mh - ms) / (ms - mt), where specimens are dried to constant mass at 105°C for 24 hours. Includes automatic duplicate specimen repeatability checks.\n' +
      'Variables: Container tare mass (mt), wet mass with tare (mh), dry mass with tare (ms).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '4. Specific Gravity / Pycnometer Test (NF P94-054 / NF P18-554):\n' +
      'Measures the true solid grain density (ρs) using a calibrated water pycnometer. Computes displaced water volume corrected for water density ρw(T) from 15°C to 35°C. Critical for calculating void ratio (e), porosity (n), and saturation (Sr).\n' +
      'Variables: Pycnometer + water (A), empty pycnometer (B), pycnometer + dry soil (C), pycnometer + soil + water (D), temperature T (°C).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '5. Loose Bulk Density Test (NF EN 1097-3):\n' +
      'Measures the uncompacted volumetric density (ρb) of dry aggregates poured into a calibrated cylinder. Essential for volumetric batching of concrete mixes and quarry stockpile inventory conversions.\n' +
      'Variables: Calibrated cylinder volume (V), empty cylinder mass, cylinder + loose material across 3 trials.',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '6. Sand Equivalent Test (NF EN 933-8 / ASTM D2419):\n' +
      'Quantifies the proportion of sand versus detrimental clay fines in fine aggregate. Computes visual sand equivalent (ESv = 100 H2’/H1) and weighted piston sand equivalent (ESp = 100 H2/H1). Features automated timing checks (10-min shaking, 20-min rest).\n' +
      'Variables: Total column height (H1), visual flocculate level (H2’), piston sand level (H2).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '7. Los Angeles Abrasion & Impact Test (NF EN 1097-2 / ASTM C131):\n' +
      'Evaluates the resistance of coarse aggregate to dynamic impact and surface fragmentation in a rotating steel drum with steel charges. Computes LA = 100 (M - m) / M and categorizes aggregate from LA15 to LA50.\n' +
      'Variables: Grading fraction (e.g. 10/14 mm), standard steel ball count (11 balls), 500 revolutions, initial mass M (5000 g), washed retained mass on 1.6 mm sieve (m).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '8. Micro-Deval Wear Test in Water (NF EN 1097-1):\n' +
      'Evaluates the wear resistance of coarse aggregate under wet friction and autogenous grinding in rotating cylinders with stainless steel balls and water. Computes MDE = 100 (M - m) / M.\n' +
      'Variables: 10/14 mm fraction, 5 kg steel charge, 2.5 L water, 12,000 revolutions, initial mass M (500 g), washed retained mass on 1.6 mm sieve (m).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '9. Flakiness Index Test (NF P18-561 / NF EN 933-3):\n' +
      'Quantifies the percentage of thin, flat particles in coarse aggregate using standard bar sieves with slotted openings. Computes Flakiness Index A = 100 ∑Me / ∑Mg with mass loss verification (< 2%).\n' +
      'Variables: Initial mass M0, retained mass per fraction (Mg), mass passing bar grid slots (Me).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '10. Surface Cleanliness of Coarse Aggregates (NF P18-591 / NF P18-592):\n' +
      'Determines the percentage of adhering superficial dust (< 0.5 mm) on coarse gravel surfaces: P = 100 (Ms - m’) / Ms. Adhering dust destroys cement paste bonding in concrete.\n' +
      'Variables: Dry initial mass of gravel (Ms), washed dry mass retained on 0.5 mm sieve (m’).',
      { size: 19, after: 80 }
    ),
    createParagraph(
      '11. Methylene Blue Value Test (NF P94-068 for soils / NF EN 933-9 for aggregates):\n' +
      'Measures the clay mineral surface activity and swelling capacity using methylene blue dye titration and the halo test. For soils: VBS = 100 × (V1 × 0.01 / m0) × C (g/100g). For aggregate fines: MB = 10 × V1 / M1 (g/kg).\n' +
      'Variables: Dye volume (V1 in mL), dry test portion (m0 or M1 in g), passing 5 mm ratio (C), halo confirmation persistence (+5 minutes).',
      { size: 19, after: 120 }
    ),
    createScenarioBox(
      'Quarry Aggregate Qualification for an Airport Runway Base Course',
      'A basalt quarry sought certification to supply 150,000 tonnes of aggregate for a military airport runway. Specification limits mandated: LA ≤ 20 (LA20), MDE ≤ 15 (MDE15), Flakiness Index ≤ 15% (FI15), Cleanliness P ≤ 0.5% (P0.5), and MB ≤ 1.0 g/kg. Using GeoLab’s New Analysis suite, the quarry laboratory ran the full battery of tests. The system automatically validated that all five parameters satisfied specifications, printing certified laboratory test sheets that secured the multimillion-dollar supply contract.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 17. LIVE TEST FORM ENTRY
  children.push(
    createHeaderRun('SECTION 17: DIRECT LABORATORY TEST ENTRY FORM (SPECIFIC GRAVITY)', HeadingLevel.HEADING_1),
    createParagraph(
      'GeoLab provides clean digital entry forms with live formula calculations for every test. Technicians can enter balance weights directly or download/upload pre-formatted Excel workbooks.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_04_test_entry_form.png', '18', 'GeoLab Live Test Entry Form showing specific gravity pycnometer balance measurements (A, B, C, D) and temperature table lookup.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Pycnometer + Water (A)', 'det.pycnometerWaterA', 'Grams (g)', 'Mass of pycnometer filled with distilled water up to calibration mark.'],
        ['Empty Pycnometer (B)', 'det.emptyPycnometerB', 'Grams (g)', 'Tare mass of clean, oven-dried pycnometer vessel.'],
        ['Pycnometer + Dry Soil (C)', 'det.pycnometerMaterialC', 'Grams (g)', 'Mass of pycnometer containing oven-dried soil/aggregate specimen.'],
        ['Pycnometer + Soil + Water (D)', 'det.pycnometerMaterialWaterD', 'Grams (g)', 'Mass of pycnometer with soil specimen and water filled to calibration mark after de-airing.'],
        ['Test Temperature (T)', 'det.temperatureC', 'Degrees C (°C)', 'Water bath temperature during test. Selects exact water density ρw(T) from lookup table.'],
        ['Solid Dry Mass (Ms)', 'det.dryMaterialMassMsG', 'Grams (g)', 'Calculated dry specimen mass: Ms = C - B.'],
        ['Displaced Water Mass', 'det.displacedWaterMassG', 'Grams (g)', 'Calculated mass of displaced water: (A + Ms) - D.'],
        ['Solid Volume (Vs)', 'det.solidVolumeVsCm3', 'Cubic cm (cm³)', 'Calculated solid grain volume: Vs = Displaced Water Mass / ρw(T).'],
        ['Specific Gravity (Gs)', 'det.specificGravityGs', 'Dimensionless', 'Specific gravity: Gs = Ms / Vs. Computes solid density ρs in t/m³.'],
        ['Repeatability Delta', 'differenceGs', 'Dimensionless', 'Absolute difference between Det 1 and Det 2. Warns if delta exceeds 0.03 tolerance.']
      ]
    ),
    createScenarioBox(
      'Determining True Solid Grain Density for Foundation Settlement Analysis',
      'During deep foundation design for a high-rise tower, geotechnical engineers required true solid grain density (ρs) to calculate void ratio (e = Vs/Vv) and consolidation settlement of a clay stratum. In the laboratory, a technician ran two pycnometer trials on sample DEMO-P1 at 30°C: Det 1 (A = 3813.5 g, B = 1128.5 g, C = 2990.5 g, D = 4969.0 g) and Det 2 (A = 3811.5 g, B = 1128.5 g, C = 2992.5 g, D = 4968.0 g). Entering these into GeoLab, the software automatically corrected for water density at 30°C (0.9956 g/cm³), computing Gs1 = 2.624 and Gs2 = 2.623 (Mean Gs = 2.624, ρs = 2.623 t/m³). The repeatability check confirmed a delta of 0.001 (well within the 0.03 limit), certifying the result.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 18. REPORTS LIST & VAULT
  children.push(
    createHeaderRun('SECTION 18: TEST REPORTS REGISTRY & VAULT (BILINGUAL PDF & EXCEL)', HeadingLevel.HEADING_1),
    createParagraph(
      'The Reports List serves as the central vault for all individual test certificates. It provides fast multi-criteria filtering and instant export of certified PDF documents with Unicode typography and live formula-enabled Excel (.xlsx) workbooks.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_05_reports_list.png', '19', 'GeoLab Reports List showing test records, status indicators, and one-click PDF/Excel export buttons.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Report Number Filter', 'searchTerm', 'String Query', 'Direct search query matching report code (e.g. PV-2026-012). Locates historical tests instantly.'],
        ['Test Type Filter', 'filterType', 'Dropdown', 'Filters records by standard (Proctor, Granulométrie, Teneur en eau, Specific Gravity).'],
        ['Status Filter', 'filterStatus', 'Dropdown', 'Filters records by quality review stage (Draft, Checked, Approved).'],
        ['Export PDF Action', 'generateGeoLabPdfReport()', 'Bilingual PDF', 'Delivers official laboratory certificate with letterhead, accreditation seal, and signature block.'],
        ['Export Excel Action', 'generateGeoLabExcelReport()', 'Live .xlsx', 'Generates live calculation spreadsheet matching the official standard sheet with editable formulas.'],
        ['Download Project ZIP', 'exportProjectReportsZip()', 'ZIP Archive', 'Bundles all approved PDF certificates and Excel sheets for a given project into one file.']
      ]
    ),
    createScenarioBox(
      'External Audit for Highway Project Milestone Certification',
      'During a progress billing audit for a $45 million highway contract, client engineers requested certified test sheets for all granular sub-base samples tested during October 2026. The lab supervisor opened the GeoLab Reports List, set the filter to "Test Type: Granulométrie", selected "Status: Approved", and clicked "Export Project Reports ZIP". In three seconds, the system compiled all 34 individual PDF certificates and Excel sheets into an organized archive, expediting milestone payment approval.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 19. ANALYSIS DETAIL VIEW
  children.push(
    createHeaderRun('SECTION 19: ANALYSIS DETAIL VIEW, LIVE CURVES & VERIFICATION SIGN-OFF', HeadingLevel.HEADING_1),
    createParagraph(
      'The Analysis Detail View provides an interactive verification and review workspace. It dynamically renders mathematical curves (Proctor parabolas, semi-log grain size distributions), flags quality warnings, and manages official digital approval workflows.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_06_analysis_detail_curve.png', '20', 'GeoLab Analysis Detail View showing interactive curve plotting, specification bands, and digital approval sign-off.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Calculated Key Results', 'testDef.keyResults()', 'Engineering Units', 'Synthesized test metrics (OPM, wopt, Cu, Cc, LA, MDE, Gs). Forms official certificate output.'],
        ['Specification Limits', 'analysis.specLimits', 'Min / Max Bounds', 'Upper and lower project conformity boundaries. Triggers Pass / Warning / Fail indicators.'],
        ['Quality Warning Banner', 'analysis.qualityWarnings', 'Warning Alerts', 'Rule-based detection of lab measurement anomalies (repeatability breach, mass loss, outlier).'],
        ['Status Lifecycle', 'analysis.status', 'draft | checked | approved', 'Enforces strict two-tier review: lab technician drafts, quality manager verifies and approves.'],
        ['Approved By / Title', 'analysis.approvedBy', 'Name & License', 'Professional identity and certification license of approving technical director.'],
        ['Approval Timestamp', 'analysis.approvedAt', 'ISO Timestamp', 'Exact chronological timestamp of test validation, providing legal audit traceability.']
      ]
    ),
    createScenarioBox(
      'Quality Control Review of Embankment Compaction Trials',
      'A geotechnical quality manager was reviewing Proctor compaction test sheets submitted by junior lab technicians. Opening test report PR-2026-088 in GeoLab Analysis Detail, the manager observed a red warning banner: "Trial point 4 dry density is non-physical relative to zero-air-voids saturation curve". The manager rejected the test with notes, instructing the technician to re-run the point. The revised test produced a true parabola with OPM = 2.08 t/m³ at wopt = 11.2%, which the manager signed and approved.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 20. STUDIES DASHBOARD
  children.push(
    createHeaderRun('SECTION 20: GEOTECHNICAL STUDIES DASHBOARD (MULTI-TEST REPORTS)', HeadingLevel.HEADING_1),
    createParagraph(
      'Individual test sheets only provide isolated data points. Engineering decisions require comprehensive geotechnical investigation studies synthesizing soil classification, compaction, bearing capacity, and photographic logs into a cohesive report. The Studies Dashboard manages multi-test study projects.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_07_studies_dashboard.png', '21', 'GeoLab Studies Dashboard displaying multi-test geotechnical investigation studies and template selection.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Study Report Title', 'study.title', 'Text Title', 'Descriptive legal title (e.g. "Étude Géotechnique de Caractérisation des Sols").'],
        ['Template Type', 'study.templateId', 'characterisation | blank', 'Structural document blueprint. Pre-populates bilingual technical narrative blocks and tables.'],
        ['Report Reference Code', 'study.reportNumber', 'Reference String', 'Master document reference number (e.g. ET-2026-GEO-01). Guarantees archival traceability.'],
        ['Linked Analyses', 'study.linkedAnalysisIds', 'Analysis ID Array', 'Pulls raw data, calculated results, and charts from multiple test sheets into consolidated study.'],
        ['Study Language', 'study.language', 'FR / EN Toggle', 'Configures bilingual narrative texts, headings, and table headers uniformly across document.']
      ]
    ),
    createScenarioBox(
      'Initiating a Geotechnical Feasibility Study for a Mine Tailings Dam',
      'A consulting engineering firm was commissioned to conduct a geotechnical stability investigation for raising an upstream mine tailings dam by 15 meters. The project required integrating 18 particle size analyses, 12 Proctor compaction curves, 8 specific gravity pycnometer tests, and 6 methylene blue determinations. Using GeoLab Studies Dashboard, the lead engineer created a new study based on the "Caractérisation des Sols" template, selected all 44 associated test sheets, and launched the Study Report Editor.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 21. STUDY REPORT EDITOR
  children.push(
    createHeaderRun('SECTION 21: STUDY REPORT EDITOR, NARRATIVE ENGINE & PHOTO ANNEX', HeadingLevel.HEADING_1),
    createParagraph(
      'The Study Report Editor is an advanced document authoring environment. It features bilingual narrative generation, automated data synthesis, photographic documentation management, and simultaneous publishing to Microsoft Word (.docx), PDF (.pdf), and multi-file ZIP archives.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_08_study_editor.png', '22', 'GeoLab Study Report Editor showing narrative section editor, photo annex upload, and multi-format export buttons.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Narrative Section Bodies', 'block.body', 'Rich Text', 'Customizable technical prose (Introduction, Geological Context, Recommendations, Conclusion).'],
        ['Consolidated Summary Table', 'buildSummaryBlock()', 'Multi-Sample Matrix', 'Automated matrix synthesizing dry densities, optimal moistures, and fines contents across all samples.'],
        ['Grading Envelope Overlay', 'buildGradingBlock()', 'SVG Graphic', 'Demonstrates aggregate compliance against contract lower and upper limit envelopes.'],
        ['Conformity Matrix', 'buildConformityBlock()', 'Status Table', 'Clear visual matrix confirming whether material meets technical project specifications.'],
        ['Photo Annex Upload', 'studyPhoto.dataUrl', 'JPEG / PNG', 'High-res site and core box photography. Automatically compressed into a 2-column report grid.'],
        ['Photo Caption & Depth Tag', 'studyPhoto.caption, depth', 'Metadata Strings', 'Geological context, sampling depth, and GPS coordinates for photo evidence in Annex A.'],
        ['Word (.docx) Export', 'generateStudyDocxReport()', 'Office Open XML', 'Generates fully formatted Word document with native TOC field and heading styles.'],
        ['PDF (.pdf) Export', 'renderStudyPdf()', 'Portable Document', 'Generates publication-quality PDF via measured two-pass render with exact TOC page numbering.']
      ]
    ),
    createScenarioBox(
      'Publishing a Definitive 22-Page Geotechnical Investigation Study',
      'The geotechnical team had concluded lab testing on 11 soil samples and taken 12 site photographs showing borehole core recovery and test pit strata. In GeoLab Study Report Editor, the engineer reviewed the AI-assisted geotechnical recommendations, verified the soil classification table (Sm / A3 / D1), captioned the photos, and clicked "Export Word (.docx)" and "Export PDF". The system executed a two-pass render, creating a 22-page document where every TOC page number perfectly matched heading positions, ready for executive delivery.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // 22. ORGANISATION PROFILE
  children.push(
    createHeaderRun('SECTION 22: LABORATORY ORGANISATION PROFILE & ACCREDITATION', HeadingLevel.HEADING_1),
    createParagraph(
      'The Organisation Profile establishes institutional identity, legal accreditation credentials, and official corporate letterheads across all generated laboratory test sheets and geotechnical study reports.',
      { size: 20, after: 100 }
    ),
    ...createScreenshotBlock('geolab_09_org_profile.png', '23', 'GeoLab Organisation Profile interface showing accreditation numbers, signatories, and corporate letterhead styling.'),
    createHeaderRun('Actual Software Form Variables & Parameter Dictionary', HeadingLevel.HEADING_2),
    createVariableTable(
      ['UI Field Name', 'Software Code Key', 'Unit', 'Exact Meaning & Operational Significance'],
      [
        ['Laboratory Legal Name', 'profile.laboratoryName', 'Legal Name', 'Official institutional name (e.g. "FraGeo Lab"). Prominently displayed on all covers and footers.'],
        ['Accreditation Number', 'profile.accreditationNumber', 'Accreditation ID', 'ISO/IEC 17025 certificate reference (e.g. COFRAC / TUNAC). Establishes legal authority.'],
        ['Laboratory Director', 'profile.directorName', 'Full Name & Title', 'Certified technical director credentials forming official signature authority.'],
        ['Quality Manager', 'profile.qualityManagerName', 'Full Name & Title', 'ISO quality auditor overseeing standard operating procedures and balance calibrations.'],
        ['Corporate Logo Image', 'profile.logoUrl', 'Image File', 'High-resolution logo automatically embedded into report cover pages and headers.'],
        ['Primary Theme Color', 'profile.primaryColor', 'Hex Code (#1E40AF)', 'Corporate branding color styling report title boxes, table headers, and dividers uniformly.']
      ]
    ),
    createScenarioBox(
      'Establishing ISO/IEC 17025 Compliance for a Newly Commissioned Lab',
      'A mining company commissioned a new commercial geotechnical laboratory to service regional infrastructure and mining concessions. Before issuing certificates, the quality manager configured the Organisation Profile: entering the official accreditation scope (ISO/IEC 17025:2017), uploading the high-resolution corporate logo, and registering the technical director’s signature block. From that moment forward, every single test sheet, Excel workbook, and study report automatically inherited the authorized branding and legal credentials.'
    ),
    new Paragraph({ pageBreakBefore: true })
  );

  // =========================================================================
  // SECTION 23: SYNTHESIS & UNIFIED WORKFLOW
  // =========================================================================
  children.push(
    createHeaderRun('SECTION 23: UNIFIED MINE-TO-MILL & GEOTECHNICAL LAB SYNERGY', HeadingLevel.HEADING_1),
    createParagraph(
      'The true power of FraGeo Suite emerges when FragMill and GeoLab operate in tandem across the lifecycle of an industrial asset. Below is an end-to-end integration workflow illustrating this synergy:',
      { size: 20, after: 120 }
    ),
    createBullet('Geotechnical Characterization (GeoLab): Exploration drill cores and overburden soils are sampled, classified (GTR / USCS), and tested for moisture content, specific gravity, and grain size distribution. This establishes the rock mass strength and foundation stability parameters for pit slopes, waste dumps, and tailings storage facilities.', 'Phase 1'),
    createBullet('Drill & Blast Engineering (FragMill): Using the intact rock strength (UCS), density (ρr), and joint spacing (Js) determined in the laboratory, the blast engineer enters geomechanical properties into FragMill Blast Record. The software designs pattern burden, spacing, and 3-deck charging profiles, predicting fragmentation with Kuz-Ram and simulating vibration (PPV) to protect nearby pit slopes.', 'Phase 2'),
    createBullet('Downstream Comminution Optimization (FragMill): Blasted muckpile fragmentation (F80) is verified using optical AI photo segmentation and compared against ground truth. The Comminution Digital Twin simulates primary crusher throughput, SAG mill power draw, and carbon footprint, debottlenecking the plant and saving electrical energy.', 'Phase 3'),
    createBullet('Civil & Tailings Embankment Construction (GeoLab): Waste rock and crushed aggregate produced from quarrying operations are tested for Los Angeles abrasion, Micro-Deval wear, and flakiness index. Soil backfill for tailings dam raises is compacted and verified with Proctor tests, culminating in comprehensive study reports published directly to Word and PDF.', 'Phase 4'),
    createParagraph(
      'By bridging the physical gap between rock fragmentation dynamics and soil mechanics testing, FraGeo Suite provides a robust, offline-first digital operating system that elevates data integrity, engineering efficiency, and economic profitability.',
      { size: 20, before: 120, after: 200 }
    )
  );

  // Construct Document with Professional Running Headers & Footers
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: 'FraGeo Suite • Technical Reference Manual & Operational Guide',
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                  new TextRun({
                    text: 'FraGeo Engineering Standards • Page ',
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_DOCX, buffer);
  try {
    fs.writeFileSync(ROOT_DOCX, buffer);
  } catch (err) {
    console.warn(`Note: Could not overwrite root file (open in Word): ${err.message}`);
  }
  console.log(`Document successfully built and saved to:\n1. ${OUTPUT_DOCX}\n2. ${ROOT_DOCX}`);
  console.log(`File Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

buildDocument().catch(err => {
  console.error('Fatal error generating Word document:', err);
  process.exit(1);
});

