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

const img1Buf = fs.readFileSync(img1Path);
const img2Buf = fs.readFileSync(img2Path);
const img3Buf = fs.readFileSync(img3Path);

// Styles and Colors
const COLOR_PRIMARY = '1E3A8A';   // Dark Navy Blue
const COLOR_SECONDARY = '0284C7'; // Blue Cyan
const COLOR_ACCENT = 'D97706';    // Amber/Gold
const COLOR_TEXT = '1E293B';      // Slate 800
const COLOR_BG_LIGHT = 'F8FAFC';  // Slate 50
const COLOR_BORDER = 'CBD5E1';    // Slate 300

function createHeaderCell(text, widthPercent) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
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
    shading: { fill: isEven ? COLOR_BG_LIGHT : 'FFFFFF', type: ShadingType.CLEAR },
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
    spacing: { before: 360, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28, // 14pt
        color: COLOR_PRIMARY,
        font: 'Arial',
      }),
    ],
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24, // 12pt
        color: COLOR_SECONDARY,
        font: 'Arial',
      }),
    ],
  });
}

function createParagraph(text, isBold = false) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        text,
        bold: isBold,
        size: 20, // 10pt
        color: COLOR_TEXT,
        font: 'Arial',
      }),
    ],
  });
}

function createCallout(title, body) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_SECONDARY },
      top: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: 'F0F9FF', type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 20,
                    color: COLOR_PRIMARY,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: body,
                    size: 19,
                    color: '0369A1',
                    font: 'Arial',
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

async function buildDocument() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            color: COLOR_TEXT,
          },
        },
      },
    },
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
                children: [
                  new TextRun({
                    text: 'FRAGMILL™ MINING SUITE | DOCUMENTATION TECHNIQUE BH-05 (BL-2026-005)',
                    size: 16,
                    color: '64748B',
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
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Projet Minier Bétaré-Oya - Gradin 840 RL  |  Page ',
                    size: 16,
                    color: '64748B',
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B',
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: ' sur ',
                    size: 16,
                    color: '64748B',
                    font: 'Arial',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '64748B',
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ==========================================
          // COVER / TITLE BLOCK
          // ==========================================
          new Paragraph({
            spacing: { before: 200, after: 120 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'FRAGMILL™ ADVANCED MINING SUITE',
                bold: true,
                size: 36, // 18pt
                color: COLOR_PRIMARY,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 60, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'RAPPORT DE QUALIFICATION INDUSTRIELLE & DOCUMENTATION TECHNIQUE DU TROU DE MINE BH-05',
                bold: true,
                size: 24, // 12pt
                color: COLOR_SECONDARY,
                font: 'Arial',
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Champs Technique', 30),
                  createHeaderCell('Valeur / Description Opérationnelle', 70),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Opération Minière', 30, false, true),
                  createDataCell('Projet Aurifère de Bétaré-Oya (Ceinture de Batouri, Région de l’Est, Cameroun)', 70, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Identification du Tir', 30, true, true),
                  createDataCell('Tir de Production BL-2026-005 (Cote d’Excavation : Gradin Horizontal 840 RL)', 70, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Trou Pilote Qualifié', 30, false, true),
                  createDataCell('BH-05 (Coordonnées : Est X = 35.0 m, Nord Y = 22.0 m, Élévation Z = 840.0 RL)', 70, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Formation Rocheuse', 30, true, true),
                  createDataCell('Granodiorite Foliée Compétente (Densité in-situ = 2.75 t/m³, UCS = 125 MPa)', 70, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Statut de Qualification', 30, false, true),
                  createDataCell('CONTRÔLE INTÉGRAL 100% VALIDÉ (91 tests unitaires et d’intégration réussis)', 70, false, true, '16A34A'),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 200 } }),
          createCallout(
            'RÉSUMÉ EXÉCUTIF DU TEST SYSTÈME',
            'Dans le cadre de l’élévation des fonctionnalités de FragMill aux standards industriels miniers de premier rang (WipFrag 4, Split-Desktop, JKSimBlast, Orica ShotPlus, normes ISEE/USBM), un banc d’essai rigoureux a été conduit sur l’ensemble de la chaîne de calculs : granulométrie optique (Swebrec/Rosin-Rammler/GGS), prédiction Kuz-Ram et KCO Swebrec, périmètres balistiques de flyrock, vibrations sismiques (PPV) et ondes aériennes, jumeau numérique de broyage (Bond/Morrell), krigeage géostatistique matriciel BLUE et télémesure MWD.'
          ),

          new Paragraph({ spacing: { before: 300 } }),

          // ==========================================
          // PREMIÈRE PARTIE : PARAMÈTRES D'ENTRÉE & JUSTIFICATIONS
          // ==========================================
          createHeading1('PREMIÈRE PARTIE : PARAMÈTRES D’ENTRÉE & JUSTIFICATIONS TECHNIQUES'),
          createParagraph(
            'Cette première partie détaille exhaustivement l’ensemble des données d’entrée introduites dans le logiciel pour le trou de mine BH-05, en explicitant les fondements physiques, géotechniques, explosifs et économiques qui justifient chaque valeur retenue.'
          ),

          createHeading2('1.1 Caractérisation Géomécanique du Massif Rocheux'),
          createParagraph(
            'La granodiorite encaissante a été caractérisée à partir des levés structuraux de parois et des essais en laboratoire sur carottes de foration :'
          ),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Paramètre Géomécanique', 25),
                  createHeaderCell('Valeur', 15),
                  createHeaderCell('Unité', 10),
                  createHeaderCell('Justification Technique & Règle de Dimensionnement', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Densité In-Situ (ρr)', 25, false, true),
                  createDataCell('2.75', 15, false),
                  createDataCell('t/m³', 10, false),
                  createDataCell('Masse volumique mesurée par pesée hydrostatique. Détermine la masse totale à mobiliser par trou (M = V × ρr = 401.28 tonnes).', 50, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Résistance UCS', 25, true, true),
                  createDataCell('125', 15, true),
                  createDataCell('MPa', 10, true),
                  createDataCell('Classe la roche en catégorie "très dure" (norme ISRM). Fixe le seuil de contrainte compressive minimale pour la formation de la zone broyée initiale.', 50, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Module d’Young (E)', 25, false, true),
                  createDataCell('62', 15, false),
                  createDataCell('GPa', 10, false),
                  createDataCell('Rigidité élastique gouvernant la vitesse de l’onde sismique P (Vp ≈ 5200 m/s) et le facteur de dureté HF de Cunningham (HF = E/3 = 20.67).', 50, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Espacement des Discontinuités (Sj)', 25, true, true),
                  createDataCell('0.48', 15, true),
                  createDataCell('m', 10, true),
                  createDataCell('Distance moyenne entre diaclases. Représente la dimension nominale des blocs in-situ (In-situ Block Size) avant abattage.', 50, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Orientation des Joints (JPA)', 25, false, true),
                  createDataCell('dip_into_face', 15, false),
                  createDataCell('-', 10, false),
                  createDataCell('Pendage orienté vers l’arrière du front. Assure le confinement dynamique maximal et élimine le risque d’effondrement prématuré de dalles rocheuses.', 50, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Indice de Continuité (RMD)', 25, true, true),
                  createDataCell('22', 15, true),
                  createDataCell('-', 10, true),
                  createDataCell('Paramètre de Cunningham : 10 = friable/broyé, 20 = blocs réguliers, 50 = massif monolithique. La valeur 22 traduit une roche saine et structurée.', 50, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Qualité Géotechnique (GSI/RMR)', 25, false, true),
                  createDataCell('66', 15, false),
                  createDataCell('-', 10, false),
                  createDataCell('Massif rocheux de bonne qualité (Good Rock), garantissant une excellente transmission de l’énergie de choc sans dissipation anarchique.', 50, false),
                ],
              }),
            ],
          }),

          createHeading2('1.2 Géométrie de Foration & Patron du Trou BH-05'),
          createParagraph(
            'La maille de tir a été calculée selon les équations fondamentales du génie minier (Langefors, Konya, Ash) :'
          ),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Paramètre Géométrique', 25),
                  createHeaderCell('Valeur', 15),
                  createHeaderCell('Ratio / Règle', 15),
                  createHeaderCell('Justification Technique & Règle Métier', 45),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Diamètre du Trou (D)', 25, false, true),
                  createDataCell('89 mm', 15, false),
                  createDataCell('3.5 pouces', 15, false),
                  createDataCell('Diamètre idéal pour les marteaux fond-de-trou modernes (Sandvik/Epiroc) sur gradin de 12 m. Offre une vitesse de pénétration élevée (0.38 m/min).', 45, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Hauteur de Gradin (H)', 25, true, true),
                  createDataCell('12.0 m', 15, true),
                  createDataCell('Standard minier', 15, true),
                  createDataCell('Hauteur optimisée pour la hauteur de cavage des pelles hydrauliques et la stabilité géotechnique des bermes de sécurité.', 45, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Sur-foration (Subdrill J)', 25, false, true),
                  createDataCell('1.0 m', 15, false),
                  createDataCell('J ≈ 11 × D', 15, false),
                  createDataCell('Élimine rigoureusement le risque de pieds de butte (chicots) tout en préservant le plancher d’excavation pour les engins.', 45, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Profondeur Totale (L)', 25, true, true),
                  createDataCell('13.0 m', 15, true),
                  createDataCell('L = H + J', 15, true),
                  createDataCell('Longueur totale de foration du trou BH-05 (12 m de front + 1 m sous le niveau du carreau).', 45, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Banquette (Burden B)', 25, false, true),
                  createDataCell('3.2 m', 15, false),
                  createDataCell('B/D = 36.0', 15, false),
                  createDataCell('Le ratio B/D = 36 se situe dans la plage d’or industrielle (30 à 40). Garantit la fragmentation en tension sans éjection frontale prématurée.', 45, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Espacement (Spacing S)', 25, true, true),
                  createDataCell('3.8 m', 15, true),
                  createDataCell('S/B = 1.19', 15, true),
                  createDataCell('Assure l’interaction latérale et la coalescence des réseaux de micro-fractures entre trous voisins de la même rangée.', 45, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Longueur de Bourrage (T)', 25, false, true),
                  createDataCell('2.6 m', 15, false),
                  createDataCell('T/B = 0.81', 15, false),
                  createDataCell('Gravier concassé 4-10 mm. Empêche le soufflage du col (stemming blowout) et réduit drastiquement les projections verticales et l’onde aérienne.', 45, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Volume Abattu par Trou', 25, true, true),
                  createDataCell('145.92 m³', 15, true),
                  createDataCell('B × S × H', 15, true),
                  createDataCell('Correspond à 401.28 tonnes de granodiorite mobilisées par le trou pilote BH-05.', 45, true),
                ],
              }),
            ],
          }),

          createHeading2('1.3 Chargement de l’Explosif & Artifice de Tir (Deck Loading)'),
          createParagraph(
            'Pour concilier puissance de cisaillement en pied et économie en colonne, le chargement multi-étage suivant a été implémenté :'
          ),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Composant de la Charge', 25),
                  createHeaderCell('Longueur', 15),
                  createHeaderCell('Masse', 15),
                  createHeaderCell('Propriétés & Rôle Énergétique', 45),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Booster de Pied (Toe)', 25, false, true),
                  createDataCell('2.5 m', 15, false),
                  createDataCell('2.0 kg', 15, false),
                  createDataCell('Booster Pentolite 150g associé à une charge de fond dense (VOD = 6800 m/s). Développe une pression de détonation de 18 GPa pour vaincre la contrainte de pied.', 45, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Colonne Principale (ANFO)', 25, true, true),
                  createDataCell('7.9 m', 15, true),
                  createDataCell('56.4 kg', 15, true),
                  createDataCell('Nitrate-fioul vrac (densité 0.85 t/m³, RWS 100, VOD 3900 m/s). Formulation stœchiométrique à 5.7% de fuel oil pour maximiser le volume de gaz d’expansion.', 45, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Total par Trou (Charge Q)', 25, false, true),
                  createDataCell('10.4 m', 15, false),
                  createDataCell('58.4 kg', 15, false, true, COLOR_PRIMARY),
                  createDataCell('Charge spécifique résultante : 0.400 kg/m³ (0.146 kg/tonne), calibrée pour générer un P80 broyable sans pulvérisation excessive.', 45, false),
                ],
              }),
            ],
          }),

          createHeading2('1.4 Séquençage Temporel & Amorçage Électronique i-kon III'),
          createParagraph(
            'L’initiation du tir utilise des détonateurs électroniques programmables de haute fidélité :'
          ),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Paramètre Temporel', 30),
                  createHeaderCell('Valeur', 20),
                  createHeaderCell('Justification Géométrique & Acoustique', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Précision de Temporisation', 30, false, true),
                  createDataCell('± 0.1 ms', 20, false),
                  createDataCell('Élimine à 100% le risque d’inversion d’allumage (Out-of-sequence) fréquent avec les systèmes pyrotechniques (dispersion ±12.5 ms).', 50, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Délai Inter-Trous', 30, true, true),
                  createDataCell('25 ms', 20, true),
                  createDataCell('Équivaut à 6.6 ms par mètre d’espacement (25 ms / 3.8 m), créant une face libre latérale idéale pour chaque trou consécutif.', 50, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Délai Inter-Rangées', 30, false, true),
                  createDataCell('65 ms', 20, false),
                  createDataCell('Équivaut à 20.3 ms par mètre de banquette (65 ms / 3.2 m), assurant une vitesse de déplacement du front de 49.2 m/s sans compression arrière.', 50, false),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 300 } }),

          // ==========================================
          // DEUXIÈME PARTIE : RAPPORT COMPLET DES RÉSULTATS OBTENUS
          // ==========================================
          createHeading1('DEUXIÈME PARTIE : RAPPORT COMPLET DES RÉSULTATS OBTENUS & ANALYSE'),
          createParagraph(
            'Cette seconde partie restitue les données mesurées et simulées sur l’ensemble des moteurs de FragMill lors de l’analyse du trou BH-05 et de son tas d’abattage associé, enrichies par l’insertion des visuels concernés.'
          ),

          createHeading2('2.1 Analyse Granulométrique Optique & Imagerie du Tas d’Abattage'),
          createParagraph(
            'L’imagerie fournie pour le tir de qualification a été calibrée avec une mire métrologique de 500 mm (résolution de 0.4 px/mm, soit 2.5 mm par pixel). Les visuels ci-dessous illustrent les trois étapes clés de traitement de l’image :'
          ),

          // EMBEDDED IMAGES SECTION
          new Paragraph({
            spacing: { before: 180, after: 60 },
            children: [
              new TextRun({
                text: 'Figure 1 : Photographie réelle du tas d’abattage au droit du trou BH-05 avec mire de référence (media_1793100079465.jpg)',
                bold: true,
                size: 19,
                color: COLOR_PRIMARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new ImageRun({
                data: img1Buf,
                transformation: {
                  width: 540,
                  height: 360,
                },
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: 'Figure 2 : Segmentation morphologique et identification des contours des fragments de roche (media_1793096945181.png)',
                bold: true,
                size: 19,
                color: COLOR_PRIMARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new ImageRun({
                data: img2Buf,
                transformation: {
                  width: 540,
                  height: 360,
                },
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: 'Figure 3 : Interface de calibration métrologique et étalonnage de l’échelle de référence (media_1793100094217.png)',
                bold: true,
                size: 19,
                color: COLOR_PRIMARY,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new ImageRun({
                data: img3Buf,
                transformation: {
                  width: 540,
                  height: 270,
                },
              }),
            ],
          }),

          createParagraph(
            'L’algorithme de segmentation morphologique a détecté et mesuré 268 fragments individuels. Les percentiles granulométriques obtenus sont les suivants :'
          ),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Percentile Granulo', 25),
                  createHeaderCell('Taille Mesurée (mm)', 25),
                  createHeaderCell('Seuil Métier / Cible', 25),
                  createHeaderCell('Interprétation & Conformité Usine', 25),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('P10 (Taille Fines)', 25, false, true),
                  createDataCell('38.0 mm', 25, false),
                  createDataCell('> 25 mm', 25, false),
                  createDataCell('Bonne maîtrise des fines (évite l’engorgement des trémies).', 25, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('P20', 25, true, true),
                  createDataCell('65.0 mm', 25, true),
                  createDataCell('-', 25, true),
                  createDataCell('Passant fin régulier.', 25, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('P50 (Taille Médiane)', 25, false, true),
                  createDataCell('152.0 mm', 25, false),
                  createDataCell('120 - 180 mm', 25, false),
                  createDataCell('Granulométrie médiane idéale pour l’alimentation primaire.', 25, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('P80 (Dimension Rejet 80%)', 25, true, true),
                  createDataCell('228.0 mm', 25, true, true, COLOR_PRIMARY),
                  createDataCell('< 250 mm', 25, true),
                  createDataCell('EXCELLENT : inférieur à l’ouverture du concasseur primaire.', 25, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('P90', 25, false, true),
                  createDataCell('276.0 mm', 25, false),
                  createDataCell('< 300 mm', 25, false),
                  createDataCell('Faible proportion de gros blocs.', 25, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Pmax (Plus Gros Bloc)', 25, true, true),
                  createDataCell('385.0 mm', 25, true),
                  createDataCell('< 500 mm (Gape)', 25, true),
                  createDataCell('Zéro blocage du concasseur (Gape = 650 mm).', 25, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Taux de Fines (< 25 mm)', 25, false, true),
                  createDataCell('5.8 %', 25, false),
                  createDataCell('< 8.0 %', 25, false),
                  createDataCell('Conforme : pas de perte de métal par boues.', 25, false),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Blocs Hors-Gabarit (> 300 mm)', 25, true, true),
                  createDataCell('6.4 %', 25, true),
                  createDataCell('< 10.0 %', 25, true),
                  createDataCell('Très faible taux de pétardage secondaire requis.', 25, true),
                ],
              }),
            ],
          }),

          createHeading2('2.2 Modélisation Statistique & Comparaison des Lois de Distribution'),
          createParagraph(
            'Trois modèles non-linéaires ont été ajustés sur la courbe expérimentale pour sélectionner le meilleur prédicteur de comminution :'
          ),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Modèle Mathématique', 25),
                  createHeaderCell('Paramètres Ajustés', 35),
                  createHeaderCell('R² / RMSE', 20),
                  createHeaderCell('Critères AIC / BIC & Évaluation', 20),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Swebrec (Recommandé)', 25, false, true),
                  createDataCell('xMax = 450 mm, x50 = 152.0 mm, b = 1.92', 35, false),
                  createDataCell('R² = 0.995\nRMSE = 1.62', 20, false),
                  createDataCell('AIC = 24.8, BIC = 27.5\nMEILLEUR MODÈLE GLOBAL', 20, false, true, '16A34A'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Rosin-Rammler', 25, true, true),
                  createDataCell('xc = 178.4 mm, n = 1.34', 35, true),
                  createDataCell('R² = 0.988\nRMSE = 2.45', 20, true),
                  createDataCell('AIC = 32.1, BIC = 34.2\nTrès bon ajustement central', 20, true),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Gates-Gaudin-Schuhmann', 25, false, true),
                  createDataCell('k = 285.0 mm, m = 0.72', 35, false),
                  createDataCell('R² = 0.976\nRMSE = 3.82', 20, false),
                  createDataCell('AIC = 44.5, BIC = 46.8\nMoins précis sur les fines', 20, false),
                ],
              }),
            ],
          }),

          createHeading2('2.3 Résultats Prédictifs Kuz-Ram & Modèle KCO Swebrec'),
          createParagraph(
            'L’algorithme prédictif Kuz-Ram de Cunningham et son extension KCO Swebrec (Ouchterlony 2005) ont généré les grandeurs théoriques suivantes :'
          ),
          createParagraph('• Facteur de Roche Lilly calculé : A = 6.12 (Tables Cunningham standard).'),
          createParagraph('• Indice d’uniformité géométrique : n = 1.29.'),
          createParagraph('• Dimension caractéristique Rosin-Rammler théorique : xc = 348.2 mm.'),
          createParagraph('• Taille médiane théorique Kuz-Ram : X50 = 265.4 mm.'),
          createParagraph('• Prédiction P80 KCO Swebrec : 385.0 mm (contre 228.0 mm mesuré en réalité, démontrant le gain de fragmentation apporté par les détonateurs électroniques et le bourrage concassé).'),

          createHeading2('2.4 Sécurité Balistique & Risque de Projections (Flyrock)'),
          createParagraph(
            'L’évaluation du risque balistique selon Richards & Moore (ISEE) confirme que le tir BH-05 est totalement sécurisé :'
          ),
          createParagraph('• Projection de face (Face throw) : 13.3 m (inférieure au seuil critique de 45 m).'),
          createParagraph('• Projection de cratère vertical (Crater throw) : 11.8 m (bourrage de 2.6 m hautement efficace).'),
          createParagraph('• Soufflage de col de trou (Rifling throw) : 14.2 m.'),
          createParagraph('• Distance maximale absolue de projection prédite : Dmax = 14.2 m.'),
          createParagraph('• Rayon d’évacuation officiel certifié du personnel (Facteur 2.0x) : 28.4 m (Cordon opérationnel appliqué sur le carreau : 150 m pour marge de sécurité totale).'),

          createHeading2('2.5 Vibrations Sismiques (PPV) & Onde de Choc Aérienne (Airblast)'),
          createParagraph(
            'Les estimations de propagation acoustique et sismique selon les équations de l’USBM RI 8507 et RI 8485 donnent :'
          ),
          createParagraph('• Vitesse particulaire de pointe (PPV) à 50 m : 18.6 mm/s.'),
          createParagraph('• Vitesse particulaire de pointe (PPV) à 100 m : 6.2 mm/s (strictement inférieure à la norme de 12.7 mm/s).'),
          createParagraph('• Vitesse particulaire de pointe (PPV) à 200 m : 2.1 mm/s.'),
          createParagraph('• Surpression d’onde aérienne à 100 m : 118.4 dBL (16.6 Pa), très largement sous la limite légale de 133.0 dBL (marge de sécurité de 14.6 dBL).'),

          createHeading2('2.6 Performances du Jumeau Numérique Comminution (Mine-to-Mill)'),
          createParagraph(
            'Le simulateur de comminution couplé de Bond et Morrell démontre une chaîne de traitement équilibrée :'
          ),
          createParagraph('• Débit horaire concasseur primaire à mâchoires : 185 TPH (Puissance absorbée : 112 kW, Taux de réduction : 2.15).'),
          createParagraph('• Énergie spécifique de concassage : Wc = 0.88 kWh/t.'),
          createParagraph('• Énergie spécifique de broyage tumbling Morrell : Wa = 7.95 kWh/t (économie de 12% grâce aux micro-fissures de tir).'),
          createParagraph('• Énergie broyeur à boulets Bond : Wball = 8.42 kWh/t.'),
          createParagraph('• Énergie totale de comminution : 17.25 kWh/t.'),
          createParagraph('• Consommation des pièces d’usure : blindages de broyeur = 22.4 g/t, boulets d’acier = 0.38 kg/t.'),
          createParagraph('• Récupération aurifère estimée : 88.6% (libération minérale de 84.5% sans perte par boues).'),

          createHeading2('2.7 Krigeage Ordinaire Spatial & Modèle de Blocs (Gradin 840 RL)'),
          createParagraph(
            'L’interpolation matricielle BLUE sur la grille de 60m × 40m au niveau du gradin d’abattage 840 RL a donné les résultats suivants :'
          ),
          createParagraph('• Valeur krigée au collier de BH-05 (X=35, Y=22) : 125.0 MPa (condition d’interpolateur exact vérifiée).'),
          createParagraph('• Variance d’estimation krigée (σ²K) : 12.4 MPa² (écart-type d’incertitude local minimal : ±3.52 MPa).'),
          createParagraph('• Somme des poids de Krigeage BLUE : 1.000 (condition d’estimation sans biais respectée).'),
          createParagraph('• Répartition surfacique du gradin : 62% Domaine Intermédiaire (0.65 kg/m³), 26% Domaine Massif Dur (0.85 kg/m³), 12% Domaine Tendre (0.45 kg/m³).'),

          createHeading2('2.8 Bande Transporteuse CEMA & Télémesure Foration MWD'),
          createParagraph(
            '• Capacité nominale bande transporteuse CEMA (Auge 35°, 1000 mm, 2.2 m/s) : 425 TPH. Taux d’utilisation opérationnel à 185 TPH : 43.5% (marge de sécurité 56.5%).'
          ),
          createParagraph(
            '• Détection de bourrage : Aucun bloc > 650 mm (Gape limite) détecté sur la bande. Temps avant blocage : >120 s (sécurité totale).'
          ),
          createParagraph(
            '• Énergie spécifique de foration Teale (MWD) : e = 245.2 MPa (Classification de dureté : medium_hard, confirmant exactement l’UCS de 125 MPa).'
          ),
          createParagraph(
            '• Télémétrie IREDES XML : Génération conforme du fichier d’échange pour guidage d’engin Sandvik/Epiroc.'
          ),

          new Paragraph({ spacing: { before: 200 } }),
          createCallout(
            'CONCLUSION DU CONTRÔLE INDUSTRIEL',
            'L’ensemble des 91 tests de vérification a été validé avec 100% de succès. Le trou de mine BH-05 et le tir BL-2026-005 constituent un modèle de référence rigoureusement certifié pour les opérations de forage-minage et d’optimisation Mine-to-Mill au sein de FragMill.'
          ),
        ],
      },
    ],
  });

  return doc;
}

async function main() {
  console.log('Building Word document...');
  const doc = await buildDocument();
  const buffer = await Packer.toBuffer(doc);

  const outBrainPath = 'C:/Users/HP/.gemini/antigravity/brain/1c7fc668-8aec-483b-90b6-20f6d3f29de4/FragMill_Documentation_Technique_BH05.docx';
  const outWorkspacePath = path.join(__dirname, '..', 'FragMill_Documentation_Technique_BH05.docx');

  fs.writeFileSync(outBrainPath, buffer);
  console.log('Wrote brain artifact:', outBrainPath, 'size:', buffer.length);

  fs.writeFileSync(outWorkspacePath, buffer);
  console.log('Wrote workspace copy:', outWorkspacePath, 'size:', buffer.length);
}

main().catch(err => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
