# FragMill - Drone 3D Photogrammetry & Sizing Sample Data

This package contains high-fidelity UAV / Drone photogrammetric survey files ready for testing in the **Photogrammétrie 3D Drone & Orthomosaïque (Drone 3D Sizing)** tab in FragMill.

---

## 📁 Included Sample Files

1. **`Drone_Orthomosaic_01_Nominal_Blast.png`**
   - **Scenario:** Standard well-fragmented Granodiorite blast (Nominal P80 ≈ 215 mm).
   - **Features:** Clear spatial gradation from fine crest ejection, nominal heaped body, to toe apron.
   - **How to test:** Click **"Charger Orthophoto Drone" / "Upload Drone Ortho"** in FragMill, select this file, and inspect the sector overlays and 3D stereological correction.

2. **`Drone_Orthomosaic_02_Coarse_Boulders.png`**
   - **Scenario:** Coarse blast with boulder apron (P80 ≈ 320 mm, boulders > 600 mm at toe).
   - **Features:** Simulates severe toe confinement and backbreak crest fissures.

3. **`Drone_Orthomosaic_03_Fine_AirDeck.png`**
   - **Scenario:** Air-deck optimized blast (Fine uniform P80 ≈ 155 mm).
   - **Features:** High percentage of fines and sub-200mm fragments, ideal for high SAG mill throughput.

4. **`Drone_DEM_Point_Cloud_Elevation.csv`**
   - **Description:** 3D Digital Elevation Model (DEM) point cloud with 1,225 spatial points (Easting X, Northing Y, Elevation Z, Pre-blast Z, Muck thickness m, and estimated particle size).

5. **`Drone_Flight_Log_DJI_Matrice300.json`**
   - **Description:** UAV photogrammetric survey metadata (DJI Matrice 300 RTK, Zenmuse P1 45MP, Altitude 45m AGL, GSD 1.12 cm/px, 80%/70% overlap, UTM Zone 33N).

---

## 🚀 How to Test in FragMill

1. Open **FragMill** on `http://localhost:5173`.
2. Navigate to the **Photogrammétrie 3D Drone (Drone 3D Sizing)** tab.
3. Click the button **"Charger Orthophoto Drone"** (or **"Upload Drone Ortho"**).
4. Select any of the `.png` files from your project folder:
   - `c:\Users\HP\Desktop\FragMill\Drone_Orthomosaic_01_Nominal_Blast.png`
   - or from the subfolder `sample_drone_data/\ Drone_Orthomosaic_01_Nominal_Blast.png`
5. Switch between **Carte P80**, **Modèle 3D**, and **Photo Drone** to explore how FragMill combines 2D image analysis, 3D stéréologie, and muckpile sector zoning!
