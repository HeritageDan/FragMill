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
  convertInchesToTwip,
} = require('docx');

// Image paths
const img1Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793100079465.jpg';
const img2Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793096945181.png';
const img3Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793100094217.png';

let img1Buf = null;
let img2Buf = null;
let img3Buf = null;

try { if (fs.existsSync(img1Path)) img1Buf = fs.readFileSync(img1Path); } catch (e) {}
try { if (fs.existsSync(img2Path)) img2Buf = fs.readFileSync(img2Path); } catch (e) {}
try { if (fs.existsSync(img3Path)) img3Buf = fs.readFileSync(img3Path); } catch (e) {}

// Color Palette
const COLOR_PRIMARY = '0F172A';   // Slate 900 (Deep Navy / Charcoal)
const COLOR_SECONDARY = '1D4ED8'; // Royal Blue 700
const COLOR_CYAN = '0284C7';      // Sky Blue 600
const COLOR_ACCENT = 'D97706';    // Amber 600
const COLOR_SPEAKER = '4338CA';   // Indigo 700
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
            size: 19, // 9.5pt
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
            size: 18, // 9pt
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 30, // 15pt
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
        size: 24, // 12pt
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
        size: 20, // 10pt
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
        size: 20, // 10pt
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
      left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_SPEAKER },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'EEF2FF', type: ShadingType.CLEAR }, // Indigo 50
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: '🎙️ PRESENTER / LECTURER SPEECH SCRIPT:',
                    bold: true,
                    size: 19,
                    color: COLOR_SPEAKER,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0, line: 270 },
                children: [
                  new TextRun({
                    text: speakerText,
                    italics: true,
                    size: 20, // 10pt
                    color: '1E1B4B', // Slate/Indigo 950
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
          text: `📊 SLIDE DISPLAY: ${slideTitle.toUpperCase()}`,
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
            text: `[Key Metrics & Context: ${metaParts}]`,
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
      left: { style: BorderStyle.SINGLE, size: 16, color: COLOR_CYAN },
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
      left: { style: BorderStyle.SINGLE, size: 14, color: COLOR_ACCENT },
      right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDER },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'FFFBEB', type: ShadingType.CLEAR }, // Amber 50
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children,
          }),
        ],
      }),
    ],
  });
}

console.log('Script template defined successfully.');
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
  convertInchesToTwip,
} = require('docx');

// Image paths
const img1Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793100079465.jpg';
const img2Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793096945181.png';
const img3Path = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/.user_uploaded/media_1793100094217.png';

let img1Buf = null;
let img2Buf = null;
let img3Buf = null;

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
            size: 19, // 9.5pt
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
            size: 18, // 9pt
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
        size: 32, // 16pt
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
        size: 24, // 12pt
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
        size: 20, // 10pt
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
        size: 20, // 10pt
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
            shading: { fill: 'EEF2FF', type: ShadingType.CLEAR }, // Indigo 50
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
                    size: 20, // 10pt
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
          text: `📊 SLIDE VIEW: ${slideTitle.toUpperCase()}`,
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
            text: `[Slide Meta / Key Metrics: ${metaParts}]`,
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
            shading: { fill: 'FFFBEB', type: ShadingType.CLEAR }, // Amber 50
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
      left: { style: BorderStyle.SINGLE, size: 16, color: '059669' }, // Emerald 600
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'ECFDF5', type: ShadingType.CLEAR }, // Emerald 50
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

console.log('Helpers defined.');
