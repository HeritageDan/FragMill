# FraGeo Suite: Blast-to-Mill & Materials Lab

> **A low-cost, open, client-side mining and geotechnical engineering suite combining post-blast muck pile fragmentation measurement with a complete materials testing laboratory.**

---

## Overview

**FraGeo Suite** is an open-source, production-grade geotechnical and mining engineering suite comprising two core modules:
- **FraGeo Blast** (formerly FragMill): Post-blast muck pile fragmentation measurement from photographs, blast design optimization, 3D initiation sequencing, comminution digital twin (Bond & Morrell), and gold recovery modeling.
- **FraGeo Lab** (formerly GeoLab): Geotechnical materials testing laboratory suite for Proctor compaction (NF P94-093 / ASTM D698 / D1557), Particle Size Distribution (NF P94-056 / ASTM D422), and Natural Water Content (NF P94-050).

Developed specifically for research and field operations in mining, quarrying, and civil infrastructure, FraGeo Suite provides an accessible alternative to expensive commercial desktop software. It requires **no server backend**, operates **100% offline** in remote mine pits, laboratories, and field camps, and runs directly inside any modern web browser on smartphones, tablets, or laptops.

> [!NOTE]
> **Backward Compatibility & Internal Identifiers**: The internal Dexie database name (`'FragMillDB'`), all `localStorage` keys prefixed with `'fragmill_'` (such as `'fragmill_last_active_tab'`, `'fragmill_active_module'`, etc.), and internal module IDs (`'fragmill'`, `'geolab'`) are strictly preserved for backward compatibility so that existing user data and saved workflows are never lost or corrupted.

---

## Architecture & Modules

FraGeo Suite is organized into two dedicated modules switchable via the top navigation bar:

### 1. FraGeo Blast (Blast-to-Mill Module)
- **Field Mode**: 5-step touch-friendly wizard for rugged in-pit tablets. Guides the operator from blast geometry entry to photo quality evaluation, 2-tap scale calibration, local WASM segmentation, and instant $P_{20}, P_{50}, P_{80}$ curve generation.
- **Blast Workspace (`blast`)**:
  - *Record & Images*: Blast geometry, 3-deck charging profiles, rock mass characterization, and optical particle size distribution (PSD).
  - *Pattern Map*: Open-pit SVG bench mapping, drilling pattern geometry, blasted volumes, and multi-blast historical trend reconciliation.
  - *Initiation & Vibration*: 3D blast hole initiation timing simulations, maximum instantaneous charge (MIC), face inclinometer profiling, and USBM ground vibration compliance.
- **Validation Workspace (`validation`)**: Mechanical sieve screening batch reconciliation, Excel paste import, residual RMSE/MAE computation, and optical bias calibration.
- **Predict & Optimise Workspace (`optimise`)**:
  - *Kuz-Ram & Calibration*: Empirical Cunningham blast predictor, Blast Advisor parameter optimization, and Bayesian MCMC rock factor tuning.
  - *Mine-to-Mill*: Integrated drilling, blasting, crushing, and milling economics ($/t) coupled with Scope 1 & 2 carbon footprint analysis.
  - *Circuit Twin*: Comminution digital twin implementing Bond Work Index ($W_i$) and Morrell ($A \times b$) specific energy modeling.
- **Report Vault (`reports`)**: Modular report builder bundling up to 9 specialized technical sections into a single consolidated, publication-ready PDF report with active-blast isolation and dynamic section counters.
- **Experimental Modules (`experimental`)**: Opt-in toggle under Settings: features UAV Drone 3D photogrammetry and real-time Conveyor Belt Edge Vision.

### 2. FraGeo Lab (Materials Testing Laboratory Module)
- **Sample & Project Management**: Client and project hierarchy with multi-criteria search, sample logging, depth intervals, and sample status tracking.
- **Proctor Compaction (NF P94-093 / ASTM D698 / D1557)**:
  - Selectable polynomial curve fitting methods: Quadratic (degree 2), Cubic (degree 3), Quartic (degree 4 with interpolation warning), and Manual override.
  - True least-squares polynomial solver via Gaussian elimination and Newton-Raphson maximum dry density ($\rho_{d,\max}$) and optimum moisture ($w_{\text{opm}}$) refinement.
  - Live theoretical zero-air-voids saturation curve ($S_r = 100\%$) calculation.
- **Particle Size Distribution (NF P94-056 / ASTM D422)**:
  - Sieve analysis with exact log-linear interpolation for characteristic diameters ($D_{10}, D_{30}, D_{60}$), coefficient of uniformity ($C_u$), and coefficient of curvature ($C_c$).
  - Automatic soil classification based on NF P94-056 and ASTM criteria.
- **Natural Water Content (NF P94-050)**:
  - Multi-specimen mass calculation with tare, wet soil, and dry soil measurements.
  - Automatic repeatability tolerance check across specimens.
- **Native OpenXML Excel Generation**:
  - Exports true `.xlsx` workbooks containing live Excel formulas (`AVERAGE`, dry density, compaction percentage, saturation line).
  - Native DrawingML scatter charts with polynomial trendlines and dashed saturation lines.
  - Embedded image logos stored in `xl/media/` and referenced via DrawingML `twoCellAnchor` elements.
  - Automatic landscape orientation fit to 1 page wide (`fitToWidth = 1`).
- **Publication-Grade PDF Reports**:
  - Multi-logo header branding (up to 3 logos: client, laboratory, partner/inspection).
  - Optional bilingual authority header block (e.g. Republic of Cameroon Ministry of Public Works).
  - Configurable approval chain supporting 1 to 6 signatories with digital stamp and handwritten signature image uploads.
  - Extended project metadata: Programme title, Lot/Section, Contract number, Tender/DAO number, and Financing details.
  - Revision history tracking (Rev 0, 1, 2...) and standard form document codes (`PR2-FOR-02`, `GR1-FOR-01`, `TE1-FOR-01`).
  - Strict blocking rules preventing approved report generation without an organisation profile name, and DEMO watermarking for demo datasets.

---

## Engineering Formulations Reference

### 1. Cunningham Kuz-Ram Model (1983, 1987, 2005)
$$X_{50} = A \cdot K^{-0.8} \cdot Q^{1/6} \cdot \left(\frac{115}{E}\right)^{19/30} \quad (\text{cm})$$
$$n = \left(2.2 - 14 \frac{B}{D}\right) \sqrt{\frac{1 + S/B}{2}} \left(1 - \frac{W}{B}\right) \left(\frac{|BCL - CCL|}{L} + 0.1\right)^{0.1} \left(\frac{L}{H}\right)$$
$$x_c = \frac{X_{50}}{(\ln 2)^{1/n}} = \frac{X_{50}}{0.693147^{1/n}}$$
$$P(x) = 1 - \exp\left(-\left(\frac{x}{x_c}\right)^n\right)$$
$$A = 0.06 \cdot (RMD + JF + RDI + HF)$$

### 2. Swebrec Distribution Model (Ouchterlony, 2005)
$$P(x) = \frac{1}{1 + \left(\frac{\ln(x_{\max}/x)}{\ln(x_{\max}/x_{50})}\right)^b} \quad (0 < x < x_{\max})$$

### 3. Gold Recovery Formulations
- **Simple Grade Formula**:
  $$R = \frac{f - t}{f} \times 100\%$$
- **Two-Product Metallurgical Balance**:
  $$R = \frac{c(f - t)}{f(c - t)} \times 100\%$$

### 4. Soil Compaction (Proctor) & Log-Linear PSD
- **Zero Air Voids Saturation Line**:
  $$w_{\text{sat}} = 100 \times \left(\frac{\rho_w}{\rho_d} - \frac{1}{G_s}\right)$$
- **Particle Size Log-Linear Interpolation**:
  $$\log(D_p) = \log(d_1) + \frac{p - P_1}{P_2 - P_1} \times (\log(d_2) - \log(d_1))$$
  $$C_u = \frac{D_{60}}{D_{10}}, \quad C_c = \frac{(D_{30})^2}{D_{10} \times D_{60}}$$

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher; tested on v20 and v24)
- npm (v9 or higher)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/frageo-suite.git
cd frageo-suite

# Install dependencies
npm install
```

### Development Server
```bash
# Start local development server with Hot Module Replacement
npm run dev
```
Open your browser at `http://localhost:5173`.

### Running Unit Tests & Golden Suite
FraGeo Suite includes an extensive Vitest verification suite:
```bash
npm test
```
Tests validate:
- Mining engineering mathematics (Kuz-Ram, Swebrec, Rosin-Rammler, Bayesian calibration).
- Geotechnical laboratory engine reproduction against golden spreadsheet data (`tests/fixtures/Classeur1.xlsx`).
- True polynomial least-squares fitting and log-linear soil particle size interpolation.
- DrawingML chart construction and OpenXML packaging for Excel.
- Vector PDF rendering and branding layouts.
- In-place database migrations and demo data isolation.

### Static Production Build
```bash
npm run build
```
Generates fully bundled, optimized static assets in `dist/` suitable for immediate deployment to GitHub Pages, Firebase Hosting, Netlify, or any static file host.

---

## License & Citation

FraGeo Suite is released under the [MIT License](LICENSE). Developed for educational, research, and industrial field applications in blast fragmentation optimization, comminution efficiency, and geotechnical materials testing.
