const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} = require('docx');

const convertInchesToTwip = (inches) => Math.round(inches * 1440);

// Image paths
const img1Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793100079465.jpg';
const img2Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793096945181.png';
const img3Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793100094217.png';

let img1Buf = null, img2Buf = null, img3Buf = null;
try { if (fs.existsSync(img1Path)) img1Buf = fs.readFileSync(img1Path); } catch (e) {}
try { if (fs.existsSync(img2Path)) img2Buf = fs.readFileSync(img2Path); } catch (e) {}
try { if (fs.existsSync(img3Path)) img3Buf = fs.readFileSync(img3Path); } catch (e) {}

// Color Palette
const COLOR_PRIMARY = '0F172A';   // Slate 900
const COLOR_SECONDARY = '1D4ED8'; // Royal Blue 700
const COLOR_CYAN = '0284C7';      // Sky Blue 600
const COLOR_ACCENT = 'B45309';    // Amber 700
const COLOR_SPEAKER = '3730A3';   // Indigo 800
const COLOR_SLIDE_BG = 'F8FAFC';  // Slate 50
const COLOR_CARD_BG = 'F1F5F9';   // Slate 100
const COLOR_TEXT = '1E293B';      // Slate 800
const COLOR_MUTED = '64748B';     // Slate 500
const COLOR_BORDER = 'CBD5E1';    // Slate 300

function createHeaderCell(text, widthPercent) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: COLOR_SECONDARY, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: true,
            color: 'FFFFFF',
            size: 19,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

function createDataCell(text, widthPercent, isEven = false, isBold = false, textColor = COLOR_TEXT) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: isEven ? COLOR_CARD_BG : 'FFFFFF', type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: isBold,
            color: textColor,
            size: 18,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 420, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        color: COLOR_SECONDARY,
        font: 'Arial',
      }),
    ],
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: COLOR_PRIMARY,
        font: 'Arial',
      }),
    ],
  });
}

function createHeading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 20,
        color: COLOR_CYAN,
        font: 'Arial',
      }),
    ],
  });
}

function createParagraph(text, isMuted = false) {
  return new Paragraph({
    spacing: { before: 60, after: 100, line: 260 },
    children: [
      new TextRun({
        text,
        size: 20,
        color: isMuted ? COLOR_MUTED : COLOR_TEXT,
        font: 'Calibri',
      }),
    ],
  });
}

function createSpeakerSpeechBox(speakerText) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 28, color: COLOR_SPEAKER },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'EEF2FF', type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: '🎙️ PRESENTER / INSTRUCTOR SPEECH SCRIPT:',
                    bold: true,
                    size: 19,
                    color: COLOR_SPEAKER,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0, line: 280 },
                children: [
                  new TextRun({
                    text: speakerText,
                    italics: true,
                    size: 20,
                    color: '1E1B4B',
                    font: 'Georgia',
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

function createSlideCard(slideTitle, bullets = [], metadata = {}) {
  const contentParagraphs = [
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: `📊 PRESENTATION SLIDE: ${slideTitle.toUpperCase()}`,
          bold: true,
          size: 19,
          color: COLOR_SECONDARY,
          font: 'Arial',
        }),
      ],
    }),
  ];

  bullets.forEach(bullet => {
    contentParagraphs.push(
      new Paragraph({
        spacing: { before: 30, after: 50 },
        children: [
          new TextRun({
            text: `• ${bullet}`,
            size: 19,
            color: COLOR_TEXT,
            font: 'Calibri',
          }),
        ],
      })
    );
  });

  if (Object.keys(metadata).length > 0) {
    const metaParts = Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join('  |  ');
    contentParagraphs.push(
      new Paragraph({
        spacing: { before: 80, after: 0 },
        children: [
          new TextRun({
            text: `[Key Visual Elements: ${metaParts}]`,
            bold: true,
            size: 17,
            color: COLOR_MUTED,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
      left: { style: BorderStyle.SINGLE, size: 18, color: COLOR_CYAN },
      right: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: COLOR_SLIDE_BG, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: contentParagraphs,
          }),
        ],
      }),
    ],
  });
}

function createTechnicalDeepDive(title, explanation, mathFormula = null) {
  const children = [
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: `⚙️ TECHNICAL FOUNDATION & ALGORITHM: ${title.toUpperCase()}`,
          bold: true,
          size: 19,
          color: COLOR_PRIMARY,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: mathFormula ? 60 : 0, line: 260 },
      children: [
        new TextRun({
          text: explanation,
          size: 19,
          color: COLOR_TEXT,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  if (mathFormula) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: `Governing Equation: ${mathFormula}`,
            bold: true,
            size: 18,
            color: COLOR_SECONDARY,
            font: 'Consolas',
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
      left: { style: BorderStyle.SINGLE, size: 16, color: COLOR_ACCENT },
      right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'FFFBEB', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children,
          }),
        ],
      }),
    ],
  });
}

function createProTip(tipText) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 16, color: '059669' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'ECFDF5', type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: '💡 OPERATIONAL PRO-TIP: ',
                    bold: true,
                    size: 18,
                    color: '065F46',
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: tipText,
                    size: 19,
                    color: '064E3B',
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

function createDivider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
    },
    children: [],
  });
}

// Generate the Document
async function generatePresentationDocument() {
  console.log('Starting Masterclass Presentation Document Assembly...');

  const docChildren = [];

  // ==========================================
  // TITLE & COVER PAGE
  // ==========================================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 120 },
      children: [
        new TextRun({
          text: 'FRAGMILL LAB MASTERCLASS',
          bold: true,
          size: 44, // 22pt
          color: COLOR_SECONDARY,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'Comprehensive Feature-by-Feature Teaching Speech & Demonstration Script',
          size: 24, // 12pt
          color: COLOR_MUTED,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 300 },
      children: [
        new TextRun({
          text: 'End-to-End Mine-to-Mill Digital Twin Engineering: From Muckpile Computer Vision to SAG Mill Power Optimization',
          italics: true,
          size: 20,
          color: COLOR_TEXT,
          font: 'Georgia',
        }),
      ],
    })
  );

  // Metadata Card
  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        left: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        right: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
      },
      rows: [
        new TableRow({
          children: [
            createDataCell('Document Type', 25, false, true, COLOR_SECONDARY),
            createDataCell('Executive Lecture, Presentation Script & Technical Reference', 75, false),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Software System', 25, true, true, COLOR_SECONDARY),
            createDataCell('FragMill Lab (Fully Client-Side, React 19, TypeScript, IndexedDB)', 75, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Target Audience', 25, false, true, COLOR_SECONDARY),
            createDataCell('Drill & Blast Masters, Mining Engineers, Geostatisticians, Mill Superintendents', 75, false),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Operational Scope', 25, true, true, COLOR_SECONDARY),
            createDataCell('15 Integrated Modules: AR Inclinometer, Computer Vision, Kriging, Comminution, MWD, Timing', 75, true),
          ],
        }),
      ],
    }),
    createDivider()
  );

  // ==========================================
  // SECTION 0: OPENING KEYNOTE & CORE ARCHITECTURE
  // ==========================================
  docChildren.push(
    createHeading1('Module 0: Opening Keynote & Software Architecture Philosophy'),
    createSpeakerSpeechBox(
      `"Good morning ladies and gentlemen, welcome to this comprehensive masterclass on FragMill. Today, we are not just looking at a software application; we are examining a fundamental paradigm shift in how mining operations bridge the historic divide between the pit and the processing plant. For decades, the drilling and blasting crew worked to one set of KPIs—cost per drilled meter and powder factor—while the mineral processing plant struggled downstream with oversized slabs, blocked jaw crushers, and soaring kilowatt-hour bills in the grinding mills.

FragMill was built from the ground up to unify this entire lifecycle into a single, cohesive, deterministic digital twin. But there is a crucial constraint that governed its entire engineering: modern mines are often in remote locations—high in the Andes, deep in the deserts of Western Australia, or in the dense equatorial forests of Eastern Cameroon. In these environments, you cannot rely on an internet connection, you cannot wait for cloud GPU clusters to render a response, and you cannot risk having your production data stranded when a cellular tower drops.

Therefore, FragMill is 100% client-side, 100% offline-ready, and 100% secure. It runs entirely within your browser or rugged field tablet using high-performance Web Workers, HTML5 Canvas 2D, and IndexedDB via Dexie.js. It requires zero cloud subscriptions and zero server latency. Everything you calculate stays in your hands.

Furthermore, we recognized that people operate FragMill in two vastly different environments: on the dusty, sun-drenched muckpile under direct sunlight, and in the quiet, multi-monitor engineering office. Thus, FragMill features a Dual-Persona Architecture: 'Field Mode'—a high-contrast, step-by-step guided wizard that simplifies complex math into straightforward field actions—and 'Expert Mode'—a comprehensive suite of 14 scientific dashboards for senior geotechnical and metallurgical engineers. Let's begin our tour."`
    ),
    createSlideCard(
      'FragMill Architectural Paradigm & Core Tenets',
      [
        'Zero Cloud Dependency: Complete client-side calculation using modern browser Web APIs and local IndexedDB database storage.',
        'Total Data Sovereignty: No confidential blast coordinates, ore grades, or photos are ever uploaded to third-party servers.',
        'Dual Persona Interface: Instant toggle between Field Mode (Guided 5-step wizard) and Expert Mode (14 deep engineering modules).',
        'Multi-Sensory Environmental Adaptation: Outdoor high-contrast mode for intense solar glare, Dark mode for control rooms, and full trilingual localization (English, French, Spanish).',
        'Unified Single Source of Truth (SSOT): All borehole geometries, rock geomechanics, explosive charges, timing, and sieves synchronize instantly across all 14 modules.',
      ],
      { Mode: 'Field / Expert Toggle', Storage: 'IndexedDB (Dexie)', Offline: '100% PWA' }
    ),
    createTechnicalDeepDive(
      'Client-Side Reactive State & Offline Persistence',
      `FragMill utilizes an asynchronous IndexedDB storage layer powered by Dexie.js with complete relational schema integrity across 7 core object stores: Projects, Sites, Blasts, Images, SegmentationRuns, GroundTruths, and MillBatches. Reactive state hydration ensures that whenever a borehole diameter, bench height, or explosive deck is modified in one view, all downstream dependencies (powder factor, Kuz-Ram fragmentation, flyrock throw distance, and ball mill specific energy) recompute instantaneously in sub-millisecond execution loops without UI lag.`,
      `State(t) \\rightarrow \\Delta(Borehole) \\xrightarrow{\\text{Sync}} \\text{KuzRam}(X_{50}, n) \\xrightarrow{\\text{Sync}} \\text{Comminution}(kWh/t, TPH)`
    ),
    createProTip(
      `When deploying on rugged field tablets (Panasonic Toughbook, Samsung Active Tab) under intense solar glare, toggle the Outdoor Mode (Sun icon) in the top brand bar. This activates high-contrast black/amber borders that make rock boundaries and calibration lines visible even with polarized safety glasses.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 1: THE GUIDED FIELD WIZARD
  // ==========================================
  docChildren.push(
    createHeading1('Module 1: The Guided Field Wizard (Field Mode)'),
    createSpeakerSpeechBox(
      `"Let us step out of the office and imagine ourselves standing directly on a fresh muckpile. The blast was fired twenty minutes ago; the dust has cleared, and the blast master needs an immediate fragmentation assessment before the CAT 6040 hydraulic shovel begins mucking. Under the old way, a technician would take a photo with a smartphone, walk back to the office, try to upload it, fiddle with complex boundary settings, and deliver a report four hours later—far too late to adjust the next drill pattern.

With FragMill's Field Wizard, the technician accomplishes the entire workflow right on the bench in under three minutes across five intuitive steps:

In Step 1, the wizard captures the blast identification, bench level, lithology, and basic geometry.
In Step 2, the technician activates the camera. But wait—notice the AR Inclinometer! When you take a photo of a muckpile from the pit floor, you are pointing the camera upward at an angle of 20 to 45 degrees. In traditional software, this perspective causes severe foreshortening: rocks at the crest appear tiny, while rocks near the toe look huge. FragMill's AR Inclinometer taps into the tablet's hardware gyroscope and accelerometer to read the pitch and roll in real time, automatically correcting the perspective geometry.

In Step 3, we perform Metrological Calibration. The technician clicks two points across a known reference object—whether it's a 500 mm scaled survey rule, a football, or a square board. Previously, software would force a rigid rectangular box over the object, distorting round balls or square targets. FragMill allows true point-to-point vector scaling, calculating the exact millimeter-per-pixel ratio with sub-millimeter precision.

In Step 4, you outline the Region of Interest (ROI) to exclude the blue sky, excavator tracks, or safety berms.
Finally, in Step 5, the optical engine segments the rock fragments and immediately delivers the key sieve metrics: P10, P50, P80, oversize percentage, and an instant Shovel Diggability rating telling the loading supervisor if the muckpile is soft and fluid or tight and blocky."`
    ),
    createSlideCard(
      'The 5-Step Guided Field Wizard Journey',
      [
        'Step 1: Blast Context & Geotechnics (Bench ID, Rock Type, Burden, Spacing, Drill Diameter).',
        'Step 2: In-Situ Camera Acquisition with AR Inclinometer (Real-time device pitch/roll sensor fusion and tilt compensation).',
        'Step 3: Metrological Calibration (Dual point-to-point line, absolute millimeter scaling, multi-geometry target support).',
        'Step 4: Region of Interest (ROI) Masking (Polygon boundary clipping excluding void space and machinery).',
        'Step 5: Instant Sizing Synthesis (P10, P50, P80, Oversize % (>350 mm), Fines % (<25 mm), and Shovel Diggability Forecast).',
      ],
      { Steps: '1 to 5', Input: 'Hardware Camera + Sensors', Output: 'Instant Sizing & Diggability' }
    )
  );

  // Insert Image 3 (Scale Calibration) if available
  if (img3Buf) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 140, after: 60 },
        children: [
          new ImageRun({
            data: img3Buf,
            transformation: { width: 520, height: 260 },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 140 },
        children: [
          new TextRun({
            text: 'Figure 1: FragMill Metrological Calibration Interface (Dual Point A-B Scaling & Real-World Target Sizing)',
            italics: true,
            size: 18,
            color: COLOR_MUTED,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  docChildren.push(
    createTechnicalDeepDive(
      'AR Inclinometer Tilt Compensation & Homography',
      `When the camera axis is tilted by pitch angle $\\theta$ relative to the bench normal, planar surfaces undergo perspective distortion where apparent pixel dimensions scale as a function of vertical distance $y$. FragMill applies a projective homography transformation matrix $\\mathbf{H}$ parameterized by the sensor tilt angles $\\theta$ (pitch) and $\\phi$ (roll) to project the distorted image coordinates back onto the orthogonal object plane prior to particle boundary extraction:`,
      `\\begin{bmatrix} x' \\\\ y' \\\\ 1 \\end{bmatrix} = \\mathbf{H}_{\\theta,\\phi} \\begin{bmatrix} x \\\\ y \\\\ 1 \\end{bmatrix}, \\quad \\text{Scale}_{\\text{corrected}} = \\frac{\\text{Scale}_{\\text{nominal}}}{\\cos(\\theta)}`
    ),
    createProTip(
      `Always place the scale object in the middle third of the muckpile slope rather than at the extreme crest or foot. This minimizes second-order depth distortion across the camera field of view.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 2: BLAST RECORDS & BOREHOLE CHARGING
  // ==========================================
  docChildren.push(
    createHeading1('Module 2: Blast Records & Borehole Deck Loading Architecture'),
    createSpeakerSpeechBox(
      `"Now let us switch into Expert Mode and examine Module 2: Blast Records and Borehole Architecture. A fragmentation result does not happen in a vacuum; it is the direct physical consequence of energy distribution inside the rock mass. If you don't know exactly where your explosive decks were placed, analyzing muckpile photos is merely guesswork.

In the Blast Records module, you manage your mine's complete historical registry of blasts. You can create new blasts, clone successful historical patterns, track weather conditions, and define rock mass properties including rock density, UCS, Young's modulus, and joint set spacing.

Most importantly, FragMill features an interactive Borehole Charging Profile View. Here, engineers design the exact vertical architecture of each hole. You don't just enter a lump-sum explosive mass; you define multi-deck loading:
- The Bottom Charge: Typically a dense, high-velocity bulk emulsion positioned in the toe where the rock is tightest and confinement is highest.
- Intermediate Decks: You can place inert gravel decks or air decks using inflatable borehole plugs. Air decks allow explosive detonation gases to expand and reverberate, dramatically reducing oversize without increasing explosive consumption!
- Column Charges: Lighter, lower-cost ANFO in the upper column.
- Collar Stemming: Sized crushed aggregate that locks the shockwave inside the hole, preventing premature blowout into the atmosphere.

As you adjust each deck's length and explosive type, FragMill calculates the linear charge weight in kilograms per meter, the total hole charge, the powder factor in kilograms per cubic meter, and the specific energy in kilograms per ton—updating the Kuz-Ram fragmentation model in real time!"`
    ),
    createSlideCard(
      'Borehole Architecture & Multi-Deck Energy Loading',
      [
        '2D & 3D Interactive Hole Schematic: Visual representation of bench height, subdrill, stemming, inert decks, and explosive columns.',
        'Multi-Explosive Thermodynamics: Supports Bulk Emulsion (VOD 5400 m/s, Density 1.22 g/cm³), Heavy ANFO, standard ANFO (VOD 4100 m/s, Density 0.84 g/cm³), and Cartridged Gelatins.',
        'Decoupled Air Decks: Simulate intermediate air gap expansion to optimize energy distribution and eliminate top-bench boulders.',
        'Real-Time Powder Factor Engine: Instantaneous calculation of specific charge (kg/m³ and kg/tonne) as hole diameter or burden/spacing change.',
        'Stemming Confinement Assurance: Verifies that collar stemming length satisfies the safety threshold (T ≥ 20 to 30 × Hole Diameter) to prevent rifling.',
      ],
      { Geometry: 'Diameter, Depth, Burden, Spacing', Charging: 'Multi-Deck + Stemming', Metric: 'Powder Factor kg/m³' }
    ),
    createTechnicalDeepDive(
      'Borehole Linear Charge Weight & Powder Factor Formulation',
      `The mass of explosive in each deck $i$ of length $L_i$ inside a borehole of diameter $D$ (in millimeters) charged with an explosive of in-hole density $\\rho_e$ (in g/cm³) is governed by cylindrical volumetric geometry. The total hole charge $Q$ and corresponding powder factor $q$ over burden $B$, spacing $S$, and bench height $H$ are calculated as:`,
      `q_l = \\frac{\\pi \\cdot D^2}{4 \\cdot 10^3} \\cdot \\rho_e \\; (\\text{kg/m}), \\quad Q = \\sum_{i=1}^{k} q_{l,i} \\cdot L_i, \\quad q = \\frac{Q}{B \\cdot S \\cdot H} \\; (\\text{kg/m}^3)`
    ),
    createProTip(
      `If your muckpile consistently shows boulder generation from the collar region, do not simply add more explosive to the bottom. Instead, split the upper charge with an intermediate 1.0 m air deck; this forces secondary stress wave reflections that shatter the collar cap rock without causing flyrock.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 3: OPTICAL SEGMENTATION & MANUAL EDITOR
  // ==========================================
  docChildren.push(
    createHeading1('Module 3: High-Performance Optical Segmentation & The Manual Editor'),
    createSpeakerSpeechBox(
      `"Now we arrive at what many consider the crown jewel of FragMill: the Optical Rock Fragmentation Engine and its revolutionary Manual Editor.

In automated image analysis, muckpiles present the ultimate challenge to computer vision algorithms: rock surfaces are covered in dust, shadows mimic rock boundaries, rocks overlap irregularly, and sunlight creates false highlights. Traditional edge detection algorithms either severely over-segment—shattering a single large boulder into a hundred tiny pebbles—or under-segment—merging twenty adjacent rocks into a colossal ghost slab.

FragMill solves this with a multi-scale morphological watershed algorithm combined with bilateral gradient filtering. It intelligently detects individual rock boundaries across five orders of magnitude.

However, in industrial mining, an automated algorithm must never be a black box that leaves the engineer powerless when an edge is missed. That is why FragMill includes the Interactive Manual Editor:
- First, notice the Color-Coded Size Intervals: Every identified rock outline is dynamically colored according to its size bracket based on standard ASTM sieve intervals: Fines are purple, small gravel is blue, intermediate rock is green, coarse rock is yellow, and critical oversize blocks are bold red! At a single glance, the operator sees where the boulders are clustered.
- Second, look at the Adaptive Vertex Handles: When you click on a rock to adjust its boundary, FragMill doesn't clutter the screen with a thousand confusing dots. It provides a clean, elegant set of draggable control points along the outline. You can drag a vertex to expand or shrink the rock outline with effortless precision.
- Third, we have Split and Merge tools: If two rocks are merged, draw a cut line across them to separate them. If a cracked boulder was over-segmented, select the pieces and click Merge.
- And fourth, Infinite Viewport Reach: In older versions, zooming in would lock the top and bottom portions of the canvas off-screen. We completely re-engineered the canvas coordinate matrix with full bidirectional pan and scroll offsets, giving you 100% access to every single pixel from the top crest to the lowest toe!"`
    ),
    createSlideCard(
      'Optical Segmentation & Manual Editor Capabilities',
      [
        'Multi-Scale Morphological Watershed: Automatic gradient thresholding and distance-transform marker generation.',
        '5 Color-Coded Sizing Intervals: Purple (<25 mm), Blue (25-75 mm), Green (75-150 mm), Yellow (150-300 mm), Red (>300 mm oversize).',
        'Adaptive Draggable Vertex Handles: Reshape, enlarge, or shrink rock outlines smoothly without screen clutter.',
        'Interactive Splitting & Merging: One-click tools to cut merged rocks or consolidate over-fragmented boulder pieces.',
        'Infinite Bidirectional Canvas Pan/Zoom: Unrestricted scrolling across ultra-high-resolution field photography.',
        'Mathematical Sieve Fitting: Automated regression for Rosin-Rammler-Bennett (RRB), Swebrec (KCO), and Gates-Gaudin-Schuhmann (GGS).',
      ],
      { SizingBins: '5 Color Bands', Editor: 'Draggable Vertices + Cut/Merge', Curves: 'Rosin-Rammler, Swebrec, GGS' }
    )
  );

  // Insert Image 1 and Image 2 if available
  if (img1Buf && img2Buf) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 140, after: 60 },
        children: [
          new ImageRun({
            data: img1Buf,
            transformation: { width: 480, height: 260 },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 100 },
        children: [
          new TextRun({
            text: 'Figure 2: Real-World Muckpile Field Photograph with 500 mm Target Calibration Scale',
            italics: true,
            size: 18,
            color: COLOR_MUTED,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 60 },
        children: [
          new ImageRun({
            data: img2Buf,
            transformation: { width: 480, height: 260 },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 140 },
        children: [
          new TextRun({
            text: 'Figure 3: FragMill Morphological Multi-Color Rock Fragment Segmentation Outlines',
            italics: true,
            size: 18,
            color: COLOR_MUTED,
            font: 'Calibri',
          }),
        ],
      })
    );
  }

  docChildren.push(
    createTechnicalDeepDive(
      'Mathematical Sieve Curve Regressions (Rosin-Rammler & Swebrec)',
      `Once 2D fragment areas $A_i$ are converted to equivalent spherical diameters $d_i = 2\\sqrt{A_i/\\pi}$ and volumetrically weighted ($V_i \\propto d_i^3$), FragMill performs non-linear least squares regression to fit both the Weibull/Rosin-Rammler cumulative passing distribution $P(x)$ and the advanced five-parameter Swebrec function developed by Ouchterlony:`,
      `P_{\\text{RR}}(x) = 1 - \\exp\\left[-\\left(\\frac{x}{X_c}\\right)^n\\right], \\quad P_{\\text{Swebrec}}(x) = \\frac{1}{1 + \\left[\\frac{\\ln(x_{\\max}/x)}{\\ln(x_{\\max}/x_{50})}\\right]^b}`
    ),
    createProTip(
      `Always examine the Rosin-Rammler uniformity coefficient $n$. An $n > 1.3$ indicates a very uniform, narrow size distribution ideal for milling, whereas an $n < 1.0$ warns of extreme bimodal sizing—too many fines and too many boulders simultaneously.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 4: DRONE 3D SIZING
  // ==========================================
  docChildren.push(
    createHeading1('Module 4: Drone 3D Sizing & Photogrammetric Muckpile Digital Twin'),
    createSpeakerSpeechBox(
      `"Let us now elevate our perspective—literally. Photographs taken from the ground give exceptional resolution of the surface layer, but what about the muckpile as a whole? How do you assess spatial segregation across a 200-meter-wide blast?

Welcome to Module 4: Drone 3D Sizing. FragMill allows you to import drone orthomosaics and Digital Elevation Models (DEMs). The engine reconstructs the entire muckpile into a 3D volumetric digital twin.

By comparing the pre-blast surveyed bench surface with the post-blast 3D mesh, FragMill automatically computes:
1. The True Blasted Volume versus In-Situ Volume, delivering the exact Muckpile Swell Factor—a vital metric for loading equipment productivity.
2. Spatial Fragmentation Heatmaps: It maps where oversize rock has settled—whether along the free face due to burden movement, in the back row due to insufficient collar energy, or at the toe.
3. Shovel Diggability Forecasting: By combining volumetric swell with spatial fragment sizing, FragMill calculates expected loading shovel cycle times in seconds, bucket fill factors, and fleet hauling requirements!"`
    ),
    createSlideCard(
      'Drone 3D Sizing & Volumetric Photogrammetry',
      [
        'Digital Elevation Model (DEM) & Orthophoto Fusion: Full 3D surface reconstruction of the blasted muckpile topography.',
        'Automated Swell Factor Calculation: Evaluates volumetric expansion from in-situ solid rock to fragmented muckpile.',
        'Spatial Oversize Heatmap: Visualizes 3D spatial zones of boulders vs optimal fragmentation across the bench.',
        'Shovel Diggability & Productivity Engine: Predicts excavator loading cycle times (s), bucket fill efficiency, and hourly loading rates (TPH).',
        'Muckpile Profile Kinematics: Evaluates throw distance, muckpile center of gravity, and crest drop-down.',
      ],
      { Technology: 'Drone Photogrammetry + DEM', Metric: 'Swell Factor & Shovel Cycle (s)', Output: '3D Spatial Heatmap' }
    ),
    createTechnicalDeepDive(
      'Muckpile Volumetric Swell & Excavator Cycle Kinematics',
      `The volumetric swell factor $S_w$ represents the ratio of broken rock volume $V_{\\text{broken}}$ to solid in-situ rock volume $V_{\\text{insitu}}$. Hydraulic excavator cycle time $T_{\\text{cycle}}$ (in seconds) is modeled as a function of the local median fragment size $X_{50}$ and the oversize fraction $f_{\\text{over}}$ ($>350\\text{ mm}$):`,
      `S_w = \\left(\\frac{V_{\\text{broken}} - V_{\\text{insitu}}}{V_{\\text{insitu}}}\\right) \\times 100\\%, \\quad T_{\\text{cycle}} = T_{\\text{base}} \\cdot \\left(1 + 0.45 \\cdot \\frac{X_{50}}{X_{\\text{opt}}} + 1.8 \\cdot f_{\\text{over}}\\right)`
    ),
    createProTip(
      `A swell factor between 30% and 40% represents the sweet spot for hydraulic shovels. If swell drops below 25%, the muckpile is too tight and digging rates will plummet by 35% with high bucket tooth wear.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 5: BELT EDGE VISION & CHOKE ALERTS
  // ==========================================
  docChildren.push(
    createHeading1('Module 5: Belt Edge Vision & Real-Time Conveyor Monitoring'),
    createSpeakerSpeechBox(
      `"Let us now follow the broken rock as it moves from the haul trucks into the crushing plant. This brings us to Module 5: Belt Edge Vision and Real-Time Conveyor Monitoring.

One of the most dangerous and costly events in a processing plant is a crusher choke. When a massive boulder—say 500 mm across—escapes the quarry, gets loaded into the hopper, and enters the primary jaw or gyratory crusher, it wedges tight. The entire plant grinds to a halt. Miners have to bring in rock breakers, or worse, manually rig cables to dislodge the boulder—costing tens of thousands of dollars per hour in lost production and exposing personnel to extreme hazards.

FragMill's Belt Edge Vision module transforms any industrial edge camera or RTSP line-scan video feed positioned over the conveyor belt into an active, intelligent safety barrier:
- It models the standard CEMA 3-Roll Troughing Idler geometry at 20°, 35°, or 45° trough angles.
- It continuously computes belt cross-sectional fill, linear speed in meters per second, volumetric flow rate, and instantaneous tonnage per hour (TPH).
- It performs continuous edge particle tracking, graphing the moving particle size distribution in real time.
- Most importantly, it features an Automatic Crusher Choke Warning and Countdown Alarm! The moment a rock exceeding the crusher's Maximum Feed Size ($CSS_{\\max}$) is detected on the belt, FragMill flags it, sounds a visual alarm, and calculates the exact countdown in seconds until that rock reaches the crusher feed chute. This triggers an automated trip signal to stop the conveyor before the boulder causes catastrophic jamming!"`
    ),
    createSlideCard(
      'Belt Edge Vision & Automated Crusher Protection',
      [
        'Continuous Conveyor Camera Stream: Real-time image edge segmentation on moving ore streams.',
        'CEMA 3-Roll Trough Geometry Modeling: Accurate cross-sectional bed area calculation for 20°, 35°, and 45° idlers.',
        'Real-Time Tonnage Rate (TPH): Dynamic conversion from belt cross-section, ore bulk density, and belt speed (m/s).',
        'Moving Particle Sizing Curves: Real-time P20, P50, P80 tracking updated every 500 milliseconds.',
        'Automated Crusher Choke Warning: Real-time countdown timer to crusher feed chute with emergency trip interlock.',
      ],
      { Geometry: 'CEMA 3-Roll Trough Idlers', Detection: 'Continuous Edge Particle Sizing', Safety: 'Real-Time Choke Countdown' }
    ),
    createTechnicalDeepDive(
      'CEMA Conveyor Bed Cross-Section & Choke Travel Kinematics',
      `The cross-sectional area $A_{\\text{bed}}$ of bulk material on a 3-roll trough belt of width $W$, trough angle $\\beta$, surcharge angle $\\alpha$, and edge distance $c$ follows CEMA standard geometry. The transit time $t_{\\text{choke}}$ for a detected oversize slab at belt position $x_0$ moving at belt velocity $v_{\\text{belt}}$ toward a crusher chute at distance $L_{\\text{crusher}}$ is calculated as:`,
      `\\dot{M} = 3600 \\cdot A_{\\text{bed}} \\cdot v_{\\text{belt}} \\cdot \\rho_{\\text{bulk}} \\; (\\text{TPH}), \\quad t_{\\text{choke}} = \\frac{L_{\\text{crusher}} - x_0}{v_{\\text{belt}}} \\; (\\text{seconds})`
    ),
    createProTip(
      `Set your Choke Warning Threshold at 80% of the primary jaw crusher's gape opening. This provides a safety margin against slabby, elongated rocks that can bridge across the jaw plates even if their intermediate dimension is below the nominal gape.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 6: 3D TIMING & KINEMATICS
  // ==========================================
  docChildren.push(
    createHeading1('Module 6: 3D Initiation Timing & Face Relief Kinematics'),
    createSpeakerSpeechBox(
      `"Let us return to the moment of detonation in Module 6: 3D Initiation Timing and Face Relief Kinematics.

Two identical blasts with the exact same borehole diameter, spacing, and powder factor can produce radically different results depending entirely on one variable: the initiation timing sequence. If holes detonate too close together, their shockwaves collide violently, generating excessive fines and damaging the highwall. If holes detonate too far apart, the burden from earlier holes freezes or fails to detach, leaving subsequent holes over-confined.

FragMill includes a sophisticated 3D Timing Simulator:
- First, it compares Pyrotechnic Shock Tube (Nonel) with Electronic Delay Detonators. Nonel systems suffer from firing scatter of $\\pm 10$ to $15\\text{ ms}$, which causes overlap and out-of-sequence firing. Electronic detonators fire within $\\pm 0.1\\text{ ms}$, ensuring perfect spatial sequencing.
- Second, it renders dynamic 3D wavefront propagation and isochrone contour lines across the bench, showing you the exact shape of the detonation wave.
- Third, it computes Face Relief Velocity. For a blast to succeed, the rock broken by the front row must move forward into the pit at a speed of 35 to 60 meters per second to create expansion room for the second row. FragMill calculates this velocity and verifies whether your inter-row delays provide adequate relief time.
- Fourth, it evaluates Ground Vibration Waveform Superposition. By tailoring delay intervals to the natural resonant frequency of the rock mass, FragMill predicts constructive versus destructive wave interference, allowing you to cancel out ground vibrations before they reach neighboring communities!"`
    ),
    createSlideCard(
      '3D Initiation Timing & Kinematic Wavefront Simulation',
      [
        'Electronic vs Pyrotechnic Scatter: Microsecond precision (±0.1 ms) versus pyrotechnic timing scatter (±12.5 ms).',
        'Dynamic 3D Wavefront Propagation: Visual isochrone contour mapping showing burden expansion vectors.',
        'Face Relief Velocity Engine: Verifies that burden movement velocity (35 - 60 m/s) matches inter-row delay timing.',
        'Choke Prevention: Detects timing pinch points where subsequent rows fire before preceding rows have moved.',
        'Vibration Waveform Superposition: Predicts constructive/destructive wave interference for PPV reduction.',
      ],
      { Timing: 'Electronic / Nonel Delay', Kinematics: 'Face Relief Velocity (m/s)', Environmental: 'Vibration Waveform Cancellation' }
    ),
    createTechnicalDeepDive(
      'Burden Relief Velocity & Linear Elastic Wavefront Interference',
      `The nominal face displacement velocity $v_{\\text{face}}$ of a broken rock mass driven by explosive gas expansion pressure $P_{\\text{gas}}$ across burden $B$ is given by kinetic momentum conservation. Optimal inter-row delay $\\Delta t_{\\text{row}}$ must allow a minimum free face displacement $\\delta_{\\text{min}} \\ge 0.35 \\cdot B$:`,
      `v_{\\text{face}} = \\sqrt{\\frac{2 \\cdot E_{\\text{gas}}}{\\rho_r \\cdot B \\cdot S \\cdot H}}, \\quad \\Delta t_{\\text{row}} \\ge \\frac{0.35 \\cdot B}{v_{\\text{face}}} \\; (\\text{seconds})`
    ),
    createProTip(
      `Never use inter-row delays under 15 ms per meter of burden when firing in hard rock. Shorter delays choke the back rows, resulting in tight toes, poor digging, and high backbreak into the remaining bench.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 7: COMMINUTION DIGITAL TWIN
  // ==========================================
  docChildren.push(
    createHeading1('Module 7: Comminution Digital Twin (Crushing & Grinding)'),
    createSpeakerSpeechBox(
      `"Now we reach the very essence of Mine-to-Mill optimization in Module 7: The Comminution Digital Twin.

In mining economics, blasting is vastly cheaper than mechanical grinding. Breaking rock in the pit with chemical energy costs roughly $0.10 to $0.25 per ton. Breaking that same rock inside a SAG or ball mill using electrical energy and forged steel grinding balls costs $3.00 to $8.00 per ton—more than twenty times as much!

FragMill's Comminution Digital Twin creates an unbroken mathematical bridge from your blast fragmentation curve ($P_{80}$) directly to the processing plant:
- Primary Crusher Simulator: Models the jaw or gyratory crusher reduction ratio, closed-side setting (CSS), power draw in kilowatts, and discharge size distribution.
- SAG / Ball Mill Circuit: Implements the legendary Bond Work Index equation ($W_i$) and the modern Morrell SMC energy model ($M_{ic}$ and $M_{ia}$).
- Plant Throughput (TPH): Predicts how many tons per hour the mill can grind as feed size $F_{80}$ varies. If you improve blasting to reduce mill feed from 150 mm to 90 mm, FragMill demonstrates an immediate 15% to 25% increase in mill throughput!
- Consumables & Wear Forecaster: Estimates liner wear in grams per ton and steel grinding ball consumption in kilograms per ton.
- Metallurgical Recovery Estimation: Calculates recovery percentages for Gold, Copper, or other metals based on mineral liberation grind size."`
    ),
    createSlideCard(
      'Comminution Digital Twin & Mineral Processing Link',
      [
        'Direct Sieve-to-Mill Integration: Feeds optical P80 and Kuz-Ram curves directly into comminution equations.',
        'Primary Crusher Modeling: Jaw/Gyratory CSS, reduction ratio, power draw (kW), and product curve prediction.',
        'Bond Ball Mill Work Index Engine: Calculates specific grinding energy consumption (kWh/tonne) to reach target P80.',
        'Morrell SMC Comminution Model: Dual-parameter energy calculation (Mic crushing, Mia grinding).',
        'Plant Throughput & Wear Predictor: Forecasts mill capacity (TPH), liner wear rate (g/t), and steel ball consumption (kg/t).',
        'Metallurgical Gold/Copper Recovery: Predicts recovery % as a function of mineral liberation grind fineness.',
      ],
      { Circuit: 'Crusher + SAG + Ball Mill', Models: 'Bond Work Index + Morrell SMC', Output: 'kWh/t, TPH, Wear, Recovery %' }
    ),
    createTechnicalDeepDive(
      'Bond Work Index & Morrell SMC Energy Formulations',
      `Fred Bond's Third Theory of Comminution calculates specific electrical energy $W$ (kWh/t) to grind ore from feed size $F_{80}$ to product size $P_{80}$ (in micrometers) using the Bond Ball Mill Work Index $W_i$. The Morrell SMC specific energy $W_{\\text{smc}}$ uses coarse crushing index $M_{ic}$ and fine grinding index $M_{ia}$:`,
      `W = 10 \\cdot W_i \\cdot \\left(\\frac{1}{\\sqrt{P_{80}}} - \\frac{1}{\\sqrt{F_{80}}}\\right), \\quad W_{\\text{smc}} = 4 \\cdot M_{ia} \\cdot \\left(P_{80}^{-0.295} - F_{80}^{-0.295}\\right)`
    ),
    createProTip(
      `Present this module to your mill superintendent. When they see that a minor $0.05/t increase in blasting powder factor saves $0.60/t in ball mill power and boosts mill throughput by 80 tonnes per hour, pit and plant alignment becomes an effortless executive decision.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 8: BLOCK MODEL KRIGING
  // ==========================================
  docChildren.push(
    createHeading1('Module 8: Block Model Kriging & Spatial Geostatistics'),
    createSpeakerSpeechBox(
      `"Let us now look at geological uncertainty in Module 8: Block Model Kriging and Spatial Geostatistics.

One of the most frequent questions from blast engineers is: 'Why did the east side of our bench fragment into perfect gravel, while the west side produced huge boulders under the exact same blast design?' The answer, of course, is that rock masses are naturally heterogeneous. Uniaxial compressive strength (UCS), joint spacing, and rock quality vary dramatically across a single bench.

FragMill integrates an industrial-grade Best Linear Unbiased Estimator (BLUE) Ordinary Kriging engine directly inside the browser:
- You select the variable you want to map—such as rock hardness (UCS in MPa), Rock Quality Designation (RQD), or specific energy.
- You configure the experimental semi-variogram: the Nugget Effect ($C_0$), the Structural Sill ($C$), and the Spatial Range ($a$) with your choice of Spherical, Exponential, or Gaussian theoretical variogram models.
- FragMill interpolates the entire 2D bench slice onto an ultra-fast block model grid.
- Look at the visualization: FragMill features an advanced Turbo Colormap with an interactive Hover Inspector HUD that displays the estimated value, coordinates, and local domain at any mouse point.
- Crucially, FragMill computes the Kriging Estimation Variance ($\\sigma_K^2$). This tells you exactly where your geological confidence is high (close to drillholes) and where uncertainty is dangerous (in undrilled sectors).
- Finally, it automatically clusters the bench into Geotechnical Domains: Soft, Intermediate, and Hard, allowing you to vary your powder factor across the bench before drilling!"`
    ),
    createSlideCard(
      'Spatial Geostatistics & Ordinary Kriging Engine',
      [
        'BLUE Ordinary Kriging: Best Linear Unbiased Estimator solving the full spatial covariance matrix [Γ]·[λ] = [γ].',
        'Theoretical Variogram Fitting: Spherical, Exponential, and Gaussian models with Nugget (C0), Sill (C), and Range (a).',
        'High-Resolution Bench Slice Modeling: Interactive Turbo colormap with real-time hover coordinate and hardness inspector HUD.',
        'Estimation Variance & Uncertainty Maps: Quantifies spatial uncertainty (σ_K²) to highlight undrilled blind spots.',
        'Automated Domain Zoning: Segregates benches into Soft, Intermediate, and Hard geotechnical blast domains.',
      ],
      { Method: 'Ordinary Kriging (BLUE)', Variogram: 'Spherical / Exp / Gauss', Maps: 'Hardness (UCS) + Variance (σ²)' }
    ),
    createTechnicalDeepDive(
      'Ordinary Kriging Matrix Formulation & Variance Minimization',
      `For any target block coordinate $\\mathbf{x}_0$, Ordinary Kriging determines weights $\\lambda_i$ assigned to $n$ surrounding drillhole samples $Z(\\mathbf{x}_i)$ such that the estimate $Z^*(\\mathbf{x}_0) = \\sum \\lambda_i Z(\\mathbf{x}_i)$ is unbiased ($\\sum \\lambda_i = 1$) and the estimation variance $\\sigma_K^2$ is minimized using the Lagrange multiplier $\\mu$:`,
      `\\begin{bmatrix} \\gamma(\\mathbf{x}_1,\\mathbf{x}_1) & \\dots & \\gamma(\\mathbf{x}_1,\\mathbf{x}_n) & 1 \\\\ \\vdots & \\ddots & \\vdots & \\vdots \\\\ \\gamma(\\mathbf{x}_n,\\mathbf{x}_1) & \\dots & \\gamma(\\mathbf{x}_n,\\mathbf{x}_n) & 1 \\\\ 1 & \\dots & 1 & 0 \\end{bmatrix} \\begin{bmatrix} \\lambda_1 \\\\ \\vdots \\\\ \\lambda_n \\\\ \\mu \\end{bmatrix} = \\begin{bmatrix} \\gamma(\\mathbf{x}_1,\\mathbf{x}_0) \\\\ \\vdots \\\\ \\gamma(\\mathbf{x}_n,\\mathbf{x}_0) \\\\ 1 \\end{bmatrix}, \\quad \\sigma_K^2 = \\sum_{i=1}^n \\lambda_i \\gamma(\\mathbf{x}_i,\\mathbf{x}_0) + \\mu`
    ),
    createProTip(
      `Before approving a blast design on a new bench cut, inspect the Kriging Variance Map. If a borehole falls in a high-variance zone ($\\sigma_K^2 > 0.6 \\cdot C$), treat the rock hardness as an estimate and adjust explosive decks conservatively to prevent unexpected blowouts.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 9: DRILL TELEMETRY & MWD
  // ==========================================
  docChildren.push(
    createHeading1('Module 9: Measure-While-Drilling (MWD) & Drill Telemetry P2P Sync'),
    createSpeakerSpeechBox(
      `"Now let us look at the drill rig itself in Module 9: Measure-While-Drilling (MWD) and Drill Telemetry P2P Sync.

Every modern rotary or DTH blast hole drill rig is essentially a geological exploration tool disguised as an excavation machine. As the drill bit penetrates the rock, sensors on the rig record rotation speed, torque, pulldown pressure, penetration rate (ROP), and flushing air pressure every fraction of a second.

FragMill captures these sensor channels and computes Teale's Mechanical Specific Energy of Drilling ($e$ in MPa):
- In hard granodiorite, penetration rate drops and torque climbs, driving specific energy up.
- When the bit hits a fracture zone or fault, penetration rate spikes and specific energy plummets.
- When the bit encounters a hidden underground cavity or mud seam, the system flags it instantly!
This gives you a continuous, high-resolution hardness log along the exact depth of every hole. You can detect where water enters, where cavities risk explosive leakage, and where rock layers change.

Furthermore, FragMill introduces Serverless P2P WebRTC Synchronization. Even if your mine pit has zero internet or cellular connectivity, drill rigs equipped with tablets can sync their MWD data directly to the blast engineer's tablet over a local ad-hoc Wi-Fi network without any cloud servers! And for industrial automation, FragMill fully supports the global IREDES XML drilling standard for automated import and export."`
    ),
    createSlideCard(
      'Measure-While-Drilling (MWD) & Serverless P2P Sync',
      [
        'Real-Time Rig Telemetry Ingestion: Rotary speed (RPM), torque (Nm), pulldown (kN), penetration rate ROP (m/h), and air pressure (bar).',
        'Teale Mechanical Specific Energy (e): Continuous downhole calculation of rock strength (MPa) along the borehole depth.',
        'Cavity & Fracture Detection: Identifies subterranean voids and fracture zones to prevent explosive runaway into crevices.',
        'Serverless WebRTC P2P Sync: Real-time peer-to-peer data exchange between drill rigs and engineering tablets over local pit Wi-Fi.',
        'IREDES XML Compliant: Industry-standard drill plan import and as-drilled telemetric logging export.',
      ],
      { Index: "Teale's Specific Energy (MPa)", Sync: 'WebRTC P2P (No Cloud)', Format: 'IREDES XML Standard' }
    ),
    createTechnicalDeepDive(
      'Teale Mechanical Specific Energy Formulation',
      `Teale (1965) defined the mechanical specific energy $e$ as the total work required to excavate a unit volume of rock. For a drill bit of cross-sectional area $A$ operating at thrust/pulldown force $F$, rotary speed $N$ (rev/sec), torque $T$, and penetration rate $u$ ($ROP$ in m/s), specific energy is expressed as:`,
      `e = \\frac{F}{A} + \\frac{2\\pi \\cdot N \\cdot T}{A \\cdot u} \\; (\\text{MPa})`
    ),
    createProTip(
      `Check the MWD log for abrupt drops in specific energy ($e < 50\\text{ MPa}$). If an uncharged hole shows a void at 6 meters depth, notify the loading crew immediately to place a mechanical deck plug before loading bulk emulsion; otherwise, expensive explosive will leak into the void, causing massive flyrock!`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 10: BENCH SPATIAL MAP
  // ==========================================
  docChildren.push(
    createHeading1('Module 10: 2D & 3D Bench Spatial Map'),
    createSpeakerSpeechBox(
      `"In Module 10, we view the overall blast pattern in geospatial context with the Bench Spatial Map.

This module renders the entire pit bench in true coordinate space. You see every single blast hole with its collar elevation, toe coordinate, burden, and spacing.
- Each hole is color-coded according to its operational state: Planned, Drilled, Loaded, Primed, Stemmed, or Fired.
- The map displays true north alignment, free face orientation, and dip/strike vectors of major geological joint sets.
- Most importantly, it visualizes the Safety Exclusion Perimeter. When combined with our flyrock hazard models, the Bench Map projects the required exclusion boundaries around the blast, showing safety officers exactly which access roads, haul paths, and excavator locations must be cleared prior to blast initiation."`
    ),
    createSlideCard(
      'Bench Spatial Map & Pattern Geometry',
      [
        'True Geospatial Bench Grid: Coordinates, collar elevations, and borehole depths in 2D and 3D visual projection.',
        'Operational Hole Lifecycle Tracking: Color-coded statuses (Planned, Drilled, Charged, Primed, Stemmed, Fired).',
        'Structural Geology Overlay: Visualizes face orientation, burden direction, and geological strike/dip vectors.',
        'Safety Exclusion Zones: Dynamic buffer rings showing mandatory evacuation perimeters for personnel and equipment.',
      ],
      { Coordinates: 'Mine Grid (X, Y, Z)', Statuses: '6 Operational States', Safety: 'Exclusion Perimeter Overlay' }
    ),
    createTechnicalDeepDive(
      'Borehole Pattern Geometry & Face Normal Vectors',
      `Drillhole coordinates are maintained as vectors $\\mathbf{P}_i = [x_i, y_i, z_{\\text{collar}}, z_{\\text{toe}}]^T$. Effective burden $B_{\\text{eff}}$ and spacing $S_{\\text{eff}}$ are resolved perpendicular and parallel to the free face strike azimuth $\\alpha_{\\text{face}}$:`,
      `B_{\\text{eff}} = \\Delta x \\sin(\\alpha_{\\text{face}}) - \\Delta y \\cos(\\alpha_{\\text{face}}), \\quad S_{\\text{eff}} = \\Delta x \\cos(\\alpha_{\\text{face}}) + \\Delta y \\sin(\\alpha_{\\text{face}})`
    ),
    createProTip(
      `Always verify that the front-row burden does not pinch below 80% of design due to face slope concavity. The Bench Map visually highlights front-row under-burdened holes in bright orange warning colors.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 11: GROUND TRUTH VALIDATION
  // ==========================================
  docChildren.push(
    createHeading1('Module 11: Ground Truth Sieve Validation & Metrological Quality Assurance'),
    createSpeakerSpeechBox(
      `"A scientific tool is only as good as its empirical validation. That brings us to Module 11: Ground Truth Sieve Validation.

In industrial mining, optical fragmentation systems are sometimes questioned: 'How do you know your computer vision matches physical sieves?' It is a well-known fact in mineral processing that 2D photographic analysis struggles to resolve sub-millimeter fines hidden beneath larger rocks.

FragMill addresses this directly:
- It allows you to input physical laboratory mechanical sieve shaker data (ASTM E11 screens from 4.75 mm to 300 mm).
- It compares the optical camera curve with the physical ground truth curve, computing statistical error metrics: Root Mean Square Error (RMSE), Mean Absolute Error (MAE), and Pearson correlation ($R^2$).
- Most importantly, it features an Automated Optical Fines Compensation Curve. Based on empirical calibration, FragMill learns your site's specific fines bias and mathematically reconstructs the sub-pixel fine particle fraction, bringing optical analysis into exact alignment with mechanical sieve standards!"`
    ),
    createSlideCard(
      'Ground Truth Sieve Validation & Quality Assurance',
      [
        'Physical Sieve Data Entry: Direct entry of laboratory mechanical sieve shaker weights across ASTM E11 screens.',
        'Rigorous Statistical Error Evaluation: Root Mean Square Error (RMSE), Mean Absolute Error (MAE), and Pearson R².',
        'Optical Fines Correction Engine: Calibrated algorithm compensating for sub-pixel fine material hidden beneath rock layers.',
        'Continuous Model Learning: Automatically adjusts site-specific calibration factors as more sieve tests are completed.',
      ],
      { Standard: 'ASTM E11 Screen Series', Metrics: 'RMSE, MAE, R²', Feature: 'Automated Fines Bias Correction' }
    ),
    createTechnicalDeepDive(
      'Statistical Error Formulations & Fines Bias Reconstruction',
      `The agreement between optical passing percentages $P_{\\text{opt}}(x_i)$ and physical sieve passing percentages $P_{\\text{sieve}}(x_i)$ across $M$ sieve screen sizes is quantified by Root Mean Square Error (RMSE) and Pearson correlation coefficient $R^2$:`,
      `\\text{RMSE} = \\sqrt{\\frac{1}{M} \\sum_{i=1}^M \\left[P_{\\text{opt}}(x_i) - P_{\\text{sieve}}(x_i)\\right]^2}, \\quad R^2 = \\left[\\frac{\\sum (P_{\\text{opt}} - \\bar{P}_{\\text{opt}})(P_{\\text{sieve}} - \\bar{P}_{\\text{sieve}})}{\\sqrt{\\sum(P_{\\text{opt}} - \\bar{P}_{\\text{opt}})^2 \\sum(P_{\\text{sieve}} - \\bar{P}_{\\text{sieve}})^2}}\\right]^2`
    ),
    createProTip(
      `Conduct at least three physical sieve tests during initial site commissioning. Once FragMill's fines correction parameter is calibrated, your daily optical muckpile readings will match laboratory sieves with an $R^2 > 0.98$.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 12: MINE-TO-MILL OPTIMIZATION
  // ==========================================
  docChildren.push(
    createHeading1('Module 12: Mine-to-Mill Economic Optimization Hub'),
    createSpeakerSpeechBox(
      `"Now let us examine the executive boardroom level in Module 12: The Mine-to-Mill Economic Optimization Hub.

At the end of the day, mining is a business. The goal is not simply to achieve fine fragmentation; the goal is to maximize net profitability per ton of ore processed.

If you drill too closely and use too much explosive, your blasting costs skyrocket. If you use too little explosive, your blasting costs are low, but your excavator maintenance doubles, primary crushers stall, and grinding mill electricity bills reach staggering levels.

FragMill plots the complete Total Cost of Comminution Curve:
- Drilling Cost ($/t)
- Blasting Cost ($/t)
- Primary Crushing Cost ($/t)
- Secondary & SAG Grinding Cost ($/t)
FragMill identifies the Global Economic Optimum—the exact mathematical inflection point where total comminution cost is minimized. It proves to executive management that spending an extra $0.08 per ton on high-precision electronic blasting saves $0.75 per ton in mill grinding power and increases annual mine gold production by millions of dollars!"`
    ),
    createSlideCard(
      'Mine-to-Mill Holistic Economic Optimization',
      [
        'Total Cost of Comminution Modeling: Integrates drilling, blasting, crushing, and grinding operating expenditures ($/t).',
        'Global Cost Minimum Identification: Locates the exact powder factor that minimizes combined pit-to-plant operating costs.',
        'Downstream Throughput Trade-Offs: Models the financial impact of increased mill feed fineness on overall metal recovery.',
        'Executive Financial Dashboard: Translates technical blast parameters directly into net revenue and EBITDA gains.',
      ],
      { Horizon: 'Pit-to-Plant Economics', Curves: 'Drill + Blast + Crush + Grind Cost', Output: 'Global Economic Optimum ($/t)' }
    ),
    createTechnicalDeepDive(
      'Total Comminution Cost Function & Optimal Powder Factor',
      `The total operating cost per tonne $C_{\\text{total}}(q)$ as a function of specific powder factor $q$ is expressed as the sum of drilling cost $C_{\\text{drill}}$, explosive blasting cost $C_{\\text{blast}}(q)$, and comminution electrical grinding cost $C_{\\text{mill}}(q)$ derived from the resulting feed size $F_{80}(q)$:`,
      `C_{\\text{total}}(q) = C_{\\text{drill}} + c_e \\cdot q + c_{\\text{kWh}} \\cdot \\left[10 \\cdot W_i \\left(\\frac{1}{\\sqrt{P_{80}}} - \\frac{1}{\\sqrt{F_{80}(q)}}\\right)\\right], \\quad \\frac{\\partial C_{\\text{total}}}{\\partial q} = 0`
    ),
    createProTip(
      `Use the Mine-to-Mill dashboard during quarterly budget reviews to align the drill-and-blast department's incentives with the processing plant's throughput targets.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 13: KUZ-RAM & SAFETY HAZARDS
  // ==========================================
  docChildren.push(
    createHeading1('Module 13: Kuz-Ram, Cunningham Modeling & Environmental Safety Hazards'),
    createSpeakerSpeechBox(
      `"In Module 13, we examine blast predictive simulation and environmental safety compliance with Kuz-Ram Modeling and Environmental Safety Hazards.

Before a blast is loaded, the engineer needs to simulate what will happen:
- FragMill implements Cunningham's classic Kuz-Ram Model, calculating the Rock Mass Factor $A$ based on density, compressive strength, Young's modulus, and joint orientation. It predicts the characteristic size $X_c$, median fragment size $X_{50}$, and uniformity index $n$.
- It pairs this with the KCO Swebrec extension, ensuring accurate prediction of both fines and oversize boulders.

Furthermore, safety is paramount. FragMill includes a full Environmental Safety Suite:
- Richards & Moore Flyrock Hazard Model: Calculates maximum projectile throw distances for three distinct physical mechanisms: Face Throw (rock ejected from the face), Cratering (rock thrown from the collar), and Rifling (stemming blowouts). It defines the mandatory $2.0\\times$ Safety Exclusion Perimeter.
- Ground Vibration USBM Peak Particle Velocity (PPV) Attenuation: Predicts ground vibration in millimeters per second at surrounding residential structures using scaled distance equations to ensure full compliance with mining regulations.
- Airblast Overpressure: Forecasts acoustic air overpressure in decibels ($dBL$) to prevent window damage and community disturbance.
- Carbon Footprint: Computes greenhouse gas emissions ($CO_2$ equivalent) generated by explosive detonation per blast."`
    ),
    createSlideCard(
      'Kuz-Ram Modeling & Environmental Hazard Assessment',
      [
        'Cunningham Kuz-Ram Empirical Sizing: Rock factor A, characteristic size Xc, median size X50, uniformity n.',
        'KCO Swebrec Integration: Five-parameter model addressing classical Kuz-Ram fines under-prediction.',
        'Richards & Moore Flyrock Hazard Suite: Models Face Throw, Cratering, and Rifling ejection with mandatory 2.0x safety perimeter.',
        'USBM Ground Vibration Attenuation: Scaled distance PPV (mm/s) prediction ensuring compliance with environmental laws.',
        'Airblast Overpressure & Carbon Footprint: Decibel (dBL) air shock limits and CO₂ equivalent greenhouse gas tracking.',
      ],
      { Models: 'Kuz-Ram & KCO Swebrec', Safety: 'Flyrock (Face/Crater/Rifling)', Environmental: 'USBM PPV, Airblast, CO₂' }
    ),
    createTechnicalDeepDive(
      'Richards & Moore Flyrock Throw & USBM Vibration Attenuation',
      `The Richards & Moore (2004) flyrock model evaluates maximum throw distance $L_{\\text{max}}$ based on explosive specific charge $q$, borehole diameter $D$ (mm), and effective burden $B$ or stemming height $T$. The United States Bureau of Mines (USBM) PPV ground vibration follows the scaled distance relation:`,
      `L_{\\text{face}} = \\frac{k_f \\cdot \\left(\\frac{D}{B}\\right)^{1.25} \\cdot q^{1.25}}{g}, \\quad \\text{PPV} = k \\cdot \\left(\\frac{D_{\\text{dist}}}{\\sqrt{Q}}\\right)^{-b} \\; (\\text{mm/s})`
    ),
    createProTip(
      `Always maintain collar stemming height at or above $25 \\times D$. A reduction to $15 \\times D$ increases rifling flyrock risk by more than 400% without improving fragmentation.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 14: MODULAR REPORT VAULT
  // ==========================================
  docChildren.push(
    createHeading1('Module 14: Modular Report Vault & Audit-Ready Engineering Reports'),
    createSpeakerSpeechBox(
      `"Once your blast is designed, executed, analyzed, and optimized, how do you communicate the results to stakeholders, corporate auditors, and government regulatory inspectors?

Welcome to Module 14: The Modular Report Vault.

Engineers often waste hours copy-pasting tables, formatting charts, and compiling screenshots into word processors. FragMill completely automates this with an 11-Section Modular Staging Architecture:
- In any module—whether you are looking at Borehole Charging, Optical Sizing, Kuz-Ram, Timing, Comminution, Kriging, or Flyrock—simply click 'Send to Report Vault'.
- A floating toast notification confirms staging, and the top brand bar counter updates in real time (e.g. 7/11 sections staged).
- When you open the Report Vault Modal, you see a master control panel where you can toggle individual sections on or off, add custom executive notes, and enter site supervisor stamps.
- You can generate a full, publication-grade PDF report with crisp vector charts and branding right inside the browser.
- Or, you can export a complete Microsoft Word document (.docx) complete with high-resolution muckpile photographs, segmentation outlines, and formatted engineering data tables ready for filing or archiving!"`
    ),
    createSlideCard(
      'The Modular Report Vault & Automated Documentation',
      [
        '11 Independent Technical Staging Sections: Executive Summary, Borehole Geometry, Explosive Charging, Optical Sizing, Kuz-Ram, Timing, Comminution, Kriging, Drone 3D, MWD Telemetry, and Safety Hazards.',
        'Live Staging Counter & Toast System: Instant feedback across all 14 modules with persistent staging memory.',
        'Publication-Grade Client-Side PDF Generator: High-resolution vector charts, sieve curves, and tables without server roundtrips.',
        'Microsoft Word (.docx) Compilation: Fully styled corporate report with embedded field photography and audit metadata.',
        'Regulatory Compliance Ready: Pre-formatted for government mining inspection agencies and ESG sustainability reporting.',
      ],
      { Sections: '11 Modular Sections', Output: 'PDF Vector & Word (.docx)', Features: 'Embedded High-Res Imagery' }
    ),
    createTechnicalDeepDive(
      'Document Binary Generation & Embedded Asset Pipeline',
      `FragMill's document compiler builds binary OpenXML packages (.docx) and PDF streams directly within browser memory. Embedded images (such as field muckpile photography and segmentation contours) are base64-decoded into raw binary Uint8Arrays and written into document relationship parts without external network requests or disk cache latency.`,
      `\\text{DOM / Canvas State} \\xrightarrow{\\text{Binary Pack}} \\text{OpenXML (.docx) / PDF} \\xrightarrow{\\text{Local Blob}} \\text{Download (0ms Server Latency)}`
    ),
    createProTip(
      `Use the Report Vault's modular checkboxes to tailor the report to your audience: create a concise 2-page executive summary for the general manager, or a comprehensive 15-page geotechnical dossier for government safety inspectors.`
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 15: SETTINGS & LOCALIZATION
  // ==========================================
  docChildren.push(
    createHeading1('Module 15: System Settings, Localization & Data Management'),
    createSpeakerSpeechBox(
      `"Finally, we arrive at Module 15: System Settings, Localization, and In-App Guidance.

FragMill was built to operate across global mining jurisdictions:
- Unit Systems: Seamless toggle between Metric (mm, meters, metric tonnes, kg/m³) and Imperial (inches, feet, short tons, lbs/yd³).
- Data Backup & Restoration: One-click local database export. You can back up your entire project database into a secure JSON file, transport it on a USB flash drive, or restore it on any other computer in seconds.
- Language Engine: Instant trilingual localization between English, French, and Spanish across every button, chart title, tooltip, and report header.
- In-App Standard Operating Procedures (SOPs): Built-in field protocols teaching technicians how to place scale markers, avoid shadow distortion, and take mathematically valid muckpile photographs."`
    ),
    createSlideCard(
      'Settings, Global Localization & Data Sovereignty',
      [
        'Dual Unit System Engine: Instant dynamic conversion between Metric (mm, m, t) and Imperial (in, ft, short tons).',
        'Database Backup & Restore: Complete single-click JSON export/import of all blast databases, runs, and images.',
        'Trilingual Localization: Native English, French, and Spanish interfaces across all UI elements and report templates.',
        'Built-in Knowledge Base & SOPs: Step-by-step standard operating procedures for high-precision photographic sampling.',
      ],
      { Units: 'Metric / Imperial', Languages: 'EN / FR / ES', Backup: 'Single-Click Local JSON' }
    ),
    createDivider()
  );

  // ==========================================
  // MODULE 16: CONCLUSION & SUMMARY TABLE
  // ==========================================
  docChildren.push(
    createHeading1('Module 16: Masterclass Conclusion & Comprehensive System Matrix'),
    createSpeakerSpeechBox(
      `"Ladies and gentlemen, let us conclude today's masterclass.

What makes FragMill truly unique is not just any single algorithm—whether it is the AR Inclinometer, the watershed segmentation, the ordinary kriging, or the Bond comminution equations. What makes FragMill transformative is that all 15 modules work together as a single, synchronized digital twin.

When you change a borehole diameter from 89 mm to 102 mm in Module 2, you immediately see the powder factor adjust; you see the Kuz-Ram curve shift in Module 13; you see the flyrock exclusion perimeter widen on the Bench Map in Module 10; you see the predicted jaw crusher power draw drop in Module 7; and you see the total cost per ton re-optimize in Module 12.

FragMill replaces guesswork, gut feelings, and fragmented spreadsheets with deterministic, data-driven mining science. It empowers technicians on the bench with the Guided Field Wizard, while equipping senior engineers with the analytical horsepower to optimize multi-million-dollar mine-to-mill operations.

Thank you for your attention. The floor is now open for your questions, and I invite each of you to open FragMill and begin exploring your own blast data!"`
    ),
    createHeading2('Comprehensive FragMill Capability Matrix'),
    createParagraph('The following table provides an executive summary of all 15 capabilities within the FragMill ecosystem:'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        left: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        right: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
      },
      rows: [
        new TableRow({
          children: [
            createHeaderCell('Module / Feature', 20),
            createHeaderCell('Primary Purpose', 30),
            createHeaderCell('Core Engineering Technology', 30),
            createHeaderCell('Operational Benefit', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Guided Field Wizard', 20, false, true),
            createDataCell('Rapid in-situ muckpile assessment', 30),
            createDataCell('AR Inclinometer + Point-to-Point Scaling', 30),
            createDataCell('3-minute bench results', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Borehole Charging Profile', 20, true, true),
            createDataCell('Multi-deck explosive design', 30, true),
            createDataCell('Decoupled air decks + Emulsion/ANFO', 30, true),
            createDataCell('Energy distribution control', 20, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Optical Segmentation & Editor', 20, false, true),
            createDataCell('Rock boundary extraction & editing', 30),
            createDataCell('Morphological Watershed + Draggable Vertices', 30),
            createDataCell('Flawless particle sizing', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Drone 3D Sizing', 20, true, true),
            createDataCell('Muckpile volumetric digital twin', 30, true),
            createDataCell('Photogrammetry DEM + Spatial Heatmaps', 30, true),
            createDataCell('Shovel cycle optimization', 20, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Belt Edge Vision', 20, false, true),
            createDataCell('Conveyor monitoring & choke alerts', 30),
            createDataCell('CEMA 3-Roll Trough + Particle Tracking', 30),
            createDataCell('Zero crusher blockages', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('3D Initiation Timing', 20, true, true),
            createDataCell('Detonation sequence kinematics', 30, true),
            createDataCell('Electronic Delay (±0.1ms) + Face Relief', 30, true),
            createDataCell('Vibration cancellation', 20, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Comminution Digital Twin', 20, false, true),
            createDataCell('Pit-to-plant energy link', 30),
            createDataCell('Bond Work Index + Morrell SMC Models', 30),
            createDataCell('Lower kWh/t, higher TPH', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Block Model Kriging', 20, true, true),
            createDataCell('Spatial rock hardness mapping', 30, true),
            createDataCell('BLUE Ordinary Kriging + Variance Maps', 30, true),
            createDataCell('Domain blast customization', 20, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Drill Telemetry & MWD', 20, false, true),
            createDataCell('Rig sensor rock logging & sync', 30),
            createDataCell('Teale Specific Energy + P2P WebRTC', 30),
            createDataCell('Cavity & void detection', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Bench Spatial Map', 20, true, true),
            createDataCell('Geospatial borehole pattern', 30, true),
            createDataCell('2D/3D Pit Grid + Exclusion Buffers', 30, true),
            createDataCell('Pattern visual alignment', 20, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Sieve Validation QA', 20, false, true),
            createDataCell('Physical calibration assurance', 30),
            createDataCell('ASTM E11 Screens + Fines Correction', 30),
            createDataCell('R² > 0.98 empirical rigor', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Mine-to-Mill Economic Hub', 20, true, true),
            createDataCell('Global comminution cost minimum', 30, true),
            createDataCell('Multi-Variable Opex Optimization', 30, true),
            createDataCell('Maximized net profitability', 20, true),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Kuz-Ram & Safety Hazards', 20, false, true),
            createDataCell('Fragmentation & hazard models', 30),
            createDataCell('Richards & Moore Flyrock + USBM PPV', 30),
            createDataCell('Zero flyrock incidents', 20),
          ],
        }),
        new TableRow({
          children: [
            createDataCell('Modular Report Vault', 20, true, true),
            createDataCell('Automated engineering reports', 30, true),
            createDataCell('11-Section Staging + PDF/Word (.docx)', 30, true),
            createDataCell('Instant audit compliance', 20, true),
          ],
        }),
      ],
    }),
    createParagraph('FragMill: Transforming Mining from an Empirical Art into an Exact Science.', true)
  );

  // Construct Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
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
                    text: 'FRAGMILL LAB | Masterclass Teaching Speech & Comprehensive Feature Presentation Guide',
                    bold: true,
                    size: 16,
                    color: COLOR_MUTED,
                    font: 'Arial',
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
                alignment: AlignmentType.SPACE_BETWEEN,
                children: [
                  new TextRun({
                    text: 'Confidential & Proprietary • Mine-to-Mill Digital Twin Engineering • 100% Offline Client-Side',
                    size: 15,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'Page ',
                    size: 15,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 15,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 15,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 15,
                    color: COLOR_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  console.log('Packing document into .docx buffer...');
  const buffer = await Packer.toBuffer(doc);

  const outWorkspacePath = 'C:/Users/HP/Desktop/FragMill/FragMill_Complete_Feature_Presentation_Guide.docx';
  const outArtifactPath = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/FragMill_Complete_Feature_Presentation_Guide.docx';

  fs.writeFileSync(outWorkspacePath, buffer);
  fs.writeFileSync(outArtifactPath, buffer);

  console.log(`Successfully generated document at:`);
  console.log(`- Workspace: ${outWorkspacePath} (${buffer.length} bytes)`);
  console.log(`- Artifact:  ${outArtifactPath} (${buffer.length} bytes)`);
}

generatePresentationDocument().catch(err => {
  console.error('Error generating presentation document:', err);
  process.exit(1);
});
