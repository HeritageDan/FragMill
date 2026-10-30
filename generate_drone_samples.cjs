const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNG encoding helper using pure Node.js zlib
function createPng(width, height, pixelFn) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const idx = y * rowSize + 1 + x * 4;
      raw[idx] = Math.max(0, Math.min(255, Math.floor(r)));
      raw[idx + 1] = Math.max(0, Math.min(255, Math.floor(g)));
      raw[idx + 2] = Math.max(0, Math.min(255, Math.floor(b)));
      raw[idx + 3] = Math.max(0, Math.min(255, Math.floor(a !== undefined ? a : 255)));
    }
  }

  const deflated = zlib.deflateSync(raw, { level: 6 });

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Pseudo-random deterministic noise generator
function pseudoNoise(x, y, seed = 42) {
  let n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
  return n - Math.floor(n);
}

// Draw a realistic drone muckpile image
function generateMuckpileImage(width, height, options = {}) {
  const {
    coarseToe = false,
    fineAirDeck = false,
    blastTitle = 'BL-2026-001',
    rockName = 'Granodiorite',
  } = options;

  // Generate rock objects (position, size, shade)
  const rocks = [];
  const numRocks = coarseToe ? 340 : fineAirDeck ? 600 : 450;
  
  for (let i = 0; i < numRocks; i++) {
    // Distribution concentrated within the muckpile mound (u: 0.15 - 0.85, v: 0.15 - 0.88)
    const u = 0.15 + pseudoNoise(i, 11, 7) * 0.7;
    const v = 0.15 + pseudoNoise(i, 23, 13) * 0.72;

    // Relative zone
    let size = 0;
    if (v < 0.32) {
      // Crest ejection zone: fine-to-medium
      size = fineAirDeck ? 4 + pseudoNoise(i, 3, 5) * 6 : 6 + pseudoNoise(i, 3, 5) * 10;
    } else if (v < 0.68) {
      // Main central muckpile: nominal
      size = fineAirDeck ? 5 + pseudoNoise(i, 7, 9) * 8 : 8 + pseudoNoise(i, 7, 9) * 16;
    } else {
      // Toe apron: coarse boulders
      if (coarseToe) {
        size = 18 + pseudoNoise(i, 19, 21) * 32; // Giant boulders up to 50px
      } else if (fineAirDeck) {
        size = 6 + pseudoNoise(i, 19, 21) * 10;
      } else {
        size = 12 + pseudoNoise(i, 19, 21) * 18;
      }
    }

    const rx = u * width;
    const ry = v * height;
    const aspect = 0.7 + pseudoNoise(i, 31, 17) * 0.6;
    const angle = pseudoNoise(i, 43, 29) * Math.PI;
    const brightness = 100 + pseudoNoise(i, 51, 37) * 70;

    rocks.push({
      x: rx,
      y: ry,
      radius: size,
      aspect,
      angle,
      brightness,
    });
  }

  // Pre-sort rocks by Y so lower rocks overlay upper rocks (isometric perspective)
  rocks.sort((a, b) => a.y - b.y);

  // Pixel rendering function
  return createPng(width, height, (x, y) => {
    const u = x / width;
    const v = y / height;

    // 1. Base terrain background (bench floor and free face wall)
    let r = 55;
    let g = 62;
    let b = 71;

    // Bench topography gradient
    if (v < 0.18) {
      // High bench crest / undisturbed rock mass
      r = 42 + Math.sin(u * 20) * 4;
      g = 48 + Math.sin(u * 20) * 4;
      b = 56 + Math.sin(u * 20) * 4;
    } else if (v > 0.88) {
      // Pit floor / hauling road
      r = 75 + pseudoNoise(x * 0.1, y * 0.1, 99) * 15;
      g = 78 + pseudoNoise(x * 0.1, y * 0.1, 99) * 15;
      b = 85 + pseudoNoise(x * 0.1, y * 0.1, 99) * 15;
    } else {
      // Muckpile body mound shape
      const moundCenterU = 0.5;
      const moundCenterV = 0.52;
      const dist = Math.hypot((u - moundCenterU) * 1.4, (v - moundCenterV) * 1.8);
      const moundElev = Math.max(0, 1.0 - dist);

      // Muckpile granular terrain
      const fineNoise = (pseudoNoise(x * 0.25, y * 0.25, 12) - 0.5) * 25;
      const baseTone = 85 + moundElev * 40 + fineNoise;
      r = baseTone + 8;
      g = baseTone + 10;
      b = baseTone + 14;

      // Add slight geological mineral tint (granodiorite / quartz / feldspar)
      if (pseudoNoise(x * 0.05, y * 0.05, 55) > 0.6) {
        r += 12;
        g += 10;
        b += 6;
      }
    }

    // 2. Check rock overlaps
    for (let k = 0; k < rocks.length; k++) {
      const rock = rocks[k];
      const dx = x - rock.x;
      const dy = y - rock.y;
      if (Math.abs(dx) > rock.radius * 2 || Math.abs(dy) > rock.radius * 2) continue;

      // Rotated ellipse distance
      const cosA = Math.cos(rock.angle);
      const sinA = Math.sin(rock.angle);
      const rotX = dx * cosA + dy * sinA;
      const rotY = (-dx * sinA + dy * cosA) / rock.aspect;
      const dRad = Math.hypot(rotX, rotY);

      if (dRad <= rock.radius) {
        // Rock surface shading (Sun from top-left: dx - dy)
        const sunDot = (-rotX - rotY) / (rock.radius || 1);
        const shade = Math.max(0.4, Math.min(1.5, 0.95 + sunDot * 0.45));
        
        // Edge contour shadow
        const edgeFactor = dRad > rock.radius * 0.85 ? 0.65 : 1.0;
        const finalBright = rock.brightness * shade * edgeFactor;

        r = finalBright + 4;
        g = finalBright + 6;
        b = finalBright + 10;
        break; // Closest rock drawn
      }
    }

    // 3. Technical HUD Overlays:
    // A. Top-left HUD badge box
    if (x >= 20 && x <= 290 && y >= 15 && y <= 65) {
      r = r * 0.3 + 15 * 0.7;
      g = g * 0.3 + 23 * 0.7;
      b = b * 0.3 + 42 * 0.7;
    }

    // B. Scale Bar at bottom right (0m - 5m - 10m)
    if (x >= width - 180 && x <= width - 30 && y >= height - 35 && y <= height - 20) {
      const isTicks = (x === width - 180 || x === width - 105 || x === width - 30 || y >= height - 25);
      if (isTicks) {
        r = 255;
        g = 255;
        b = 255;
      }
    }

    // C. North Arrow at top right (Circle with N)
    const nDist = Math.hypot(x - (width - 45), y - 45);
    if (nDist <= 18) {
      r = r * 0.2 + 255 * 0.8;
      g = g * 0.2 + 255 * 0.8;
      b = b * 0.2 + 255 * 0.8;
      if (nDist <= 15) {
        r = 30;
        g = 41;
        b = 59;
      }
    }

    return [r, g, b, 255];
  });
}

// Generate DEM Point Cloud CSV
function generatePointCloudCsv(options = {}) {
  const { blastId = 'BL-2026-001', targetP80 = 210, baseRL = 840.0 } = options;
  const lines = ['Point_ID,Easting_X_m,Northing_Y_m,Elevation_Z_m,Pre_Blast_Z_m,Muck_Thickness_m,Est_Particle_Size_mm,Zone'];

  const rows = 35;
  const cols = 35;
  let ptId = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const easting = parseFloat((634200 + c * 1.2).toFixed(2));
      const northing = parseFloat((612440 + r * 1.1).toFixed(2));
      const preBlastZ = parseFloat((baseRL + (r < 10 ? 10.0 : 0.0)).toFixed(2));

      // Muckpile parabolic elevation
      const u = c / (cols - 1);
      const v = r / (rows - 1);
      const mound = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 4.8;
      const noise = (pseudoNoise(c, r, 7) - 0.5) * 0.4;
      const elevationZ = parseFloat((baseRL + Math.max(0, mound + noise)).toFixed(2));
      const muckThickness = parseFloat(Math.max(0, elevationZ - baseRL).toFixed(2));

      let zone = 'Toe Apron';
      let rockSize = Math.round(targetP80 * 1.4);
      if (v < 0.3) {
        zone = 'Crest Ejection';
        rockSize = Math.round(targetP80 * 0.7);
      } else if (v < 0.7) {
        zone = 'Main Heaped Body';
        rockSize = Math.round(targetP80);
      }

      lines.push(`${ptId},${easting},${northing},${elevationZ},${preBlastZ},${muckThickness},${rockSize},"${zone}"`);
      ptId++;
    }
  }

  return lines.join('\n');
}

// Generate DJI Flight Log JSON
function generateFlightLogJson(blastId = 'BL-2026-001') {
  return JSON.stringify({
    missionTitle: `UAV Post-Blast 3D Survey - ${blastId}`,
    surveyDateTime: '2026-10-29T11:45:00Z',
    uavPlatform: {
      manufacturer: 'DJI Enterprise',
      model: 'Matrice 300 RTK',
      firmwareVersion: 'v05.01.01.00',
      rtkStatus: 'FIXED_HIGH_PRECISION',
      baseStationId: 'GNSS_BASE_01_BENCH840',
    },
    cameraPayload: {
      sensor: 'Zenmuse P1 Full-Frame 45MP',
      focalLengthMm: 35.0,
      shutterSpeed: '1/1250 s',
      iso: 200,
      aperture: 'f/5.6',
    },
    flightParameters: {
      flightAltitudeAGL_m: 45.0,
      targetGSD_cm_per_px: 1.12,
      forwardOverlapPercent: 80,
      lateralOverlapPercent: 70,
      averageFlightSpeedMPerS: 5.5,
      totalPhotosCaptured: 184,
      totalSurveyAreaM2: 4250,
      crs: 'WGS84 / UTM Zone 33N',
    },
    photogrammetryQuality: {
      meanReprojectionErrorPx: 0.38,
      groundControlPointsCount: 6,
      gcpRmseMm: 12.4,
      pointCloudDensityPointsPerM2: 785,
    },
  }, null, 2);
}

// Main execution
const targetDir = path.join(__dirname, 'sample_drone_data');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log('Generating realistic 3D Drone Sizing sample files in:', targetDir);

// 1. Generate 3 sample PNG orthomosaics
const img1 = generateMuckpileImage(800, 600, { blastTitle: 'BL-2026-001', rockName: 'Granodiorite', coarseToe: false });
const path1 = path.join(targetDir, 'Drone_Orthomosaic_01_Nominal_Blast.png');
fs.writeFileSync(path1, img1);
fs.writeFileSync(path.join(__dirname, 'Drone_Orthomosaic_01_Nominal_Blast.png'), img1);
console.log('✓ Created:', path1, `(${img1.length.toLocaleString()} bytes)`);

const img2 = generateMuckpileImage(800, 600, { blastTitle: 'BL-2026-002', rockName: 'Granodiorite_Coarse', coarseToe: true });
const path2 = path.join(targetDir, 'Drone_Orthomosaic_02_Coarse_Boulders.png');
fs.writeFileSync(path2, img2);
fs.writeFileSync(path.join(__dirname, 'Drone_Orthomosaic_02_Coarse_Boulders.png'), img2);
console.log('✓ Created:', path2, `(${img2.length.toLocaleString()} bytes)`);

const img3 = generateMuckpileImage(800, 600, { blastTitle: 'BL-2026-003', rockName: 'Granodiorite_AirDeck', fineAirDeck: true });
const path3 = path.join(targetDir, 'Drone_Orthomosaic_03_Fine_AirDeck.png');
fs.writeFileSync(path3, img3);
fs.writeFileSync(path.join(__dirname, 'Drone_Orthomosaic_03_Fine_AirDeck.png'), img3);
console.log('✓ Created:', path3, `(${img3.length.toLocaleString()} bytes)`);

// 2. Generate DEM Point Cloud CSV
const csv = generatePointCloudCsv({ blastId: 'BL-2026-001', targetP80: 215, baseRL: 840.0 });
const pathCsv = path.join(targetDir, 'Drone_DEM_Point_Cloud_Elevation.csv');
fs.writeFileSync(pathCsv, csv, 'utf8');
fs.writeFileSync(path.join(__dirname, 'Drone_DEM_Point_Cloud_Elevation.csv'), csv, 'utf8');
console.log('✓ Created:', pathCsv);

// 3. Generate Flight Log JSON
const json = generateFlightLogJson('BL-2026-001');
const pathJson = path.join(targetDir, 'Drone_Flight_Log_DJI_Matrice300.json');
fs.writeFileSync(pathJson, json, 'utf8');
fs.writeFileSync(path.join(__dirname, 'Drone_Flight_Log_DJI_Matrice300.json'), json, 'utf8');
console.log('✓ Created:', pathJson);

// 4. Generate README Guide
const readmeContent = `# FragMill - Drone 3D Photogrammetry & Sizing Sample Data

This package contains high-fidelity UAV / Drone photogrammetric survey files ready for testing in the **Photogrammétrie 3D Drone & Orthomosaïque (Drone 3D Sizing)** tab in FragMill.

---

## 📁 Included Sample Files

1. **\`Drone_Orthomosaic_01_Nominal_Blast.png\`**
   - **Scenario:** Standard well-fragmented Granodiorite blast (Nominal P80 ≈ 215 mm).
   - **Features:** Clear spatial gradation from fine crest ejection, nominal heaped body, to toe apron.
   - **How to test:** Click **"Charger Orthophoto Drone" / "Upload Drone Ortho"** in FragMill, select this file, and inspect the sector overlays and 3D stereological correction.

2. **\`Drone_Orthomosaic_02_Coarse_Boulders.png\`**
   - **Scenario:** Coarse blast with boulder apron (P80 ≈ 320 mm, boulders > 600 mm at toe).
   - **Features:** Simulates severe toe confinement and backbreak crest fissures.

3. **\`Drone_Orthomosaic_03_Fine_AirDeck.png\`**
   - **Scenario:** Air-deck optimized blast (Fine uniform P80 ≈ 155 mm).
   - **Features:** High percentage of fines and sub-200mm fragments, ideal for high SAG mill throughput.

4. **\`Drone_DEM_Point_Cloud_Elevation.csv\`**
   - **Description:** 3D Digital Elevation Model (DEM) point cloud with 1,225 spatial points (Easting X, Northing Y, Elevation Z, Pre-blast Z, Muck thickness m, and estimated particle size).

5. **\`Drone_Flight_Log_DJI_Matrice300.json\`**
   - **Description:** UAV photogrammetric survey metadata (DJI Matrice 300 RTK, Zenmuse P1 45MP, Altitude 45m AGL, GSD 1.12 cm/px, 80%/70% overlap, UTM Zone 33N).

---

## 🚀 How to Test in FragMill

1. Open **FragMill** on \`http://localhost:5173\`.
2. Navigate to the **Photogrammétrie 3D Drone (Drone 3D Sizing)** tab.
3. Click the button **"Charger Orthophoto Drone"** (or **"Upload Drone Ortho"**).
4. Select any of the \`.png\` files from your project folder:
   - \`c:\\Users\\HP\\Desktop\\FragMill\\Drone_Orthomosaic_01_Nominal_Blast.png\`
   - or from the subfolder \`sample_drone_data/\\ Drone_Orthomosaic_01_Nominal_Blast.png\`
5. Switch between **Carte P80**, **Modèle 3D**, and **Photo Drone** to explore how FragMill combines 2D image analysis, 3D stéréologie, and muckpile sector zoning!
`;

const pathReadme = path.join(targetDir, 'README_Drone_3D_Testing.md');
fs.writeFileSync(pathReadme, readmeContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'README_Drone_3D_Testing.md'), readmeContent, 'utf8');
console.log('✓ Created:', pathReadme);

console.log('\nAll sample files successfully written directly to FragMill working directory!');
