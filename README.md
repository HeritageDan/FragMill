# FragMill: Blast-to-Mill Fragmentation Lab

> **A low-cost, open, client-side post-blast muck pile fragmentation measurement and comminution optimization platform for Artisanal and Small-Scale Mining (ASM).**

---

## Overview

**FragMill** is an open-source, production-grade geotechnical web application designed to measure rock fragment size distributions directly from muck pile photographs, linking fragmentation to blast design parameters, crushing/milling energy consumption, and gold recovery.

Developed specifically for research and field operations in Cameroon and Central Africa (such as the **Bétaré Oya Gold District**), FragMill provides an accessible alternative to commercial desktop tools (e.g., WipFrag, Split-Desktop). It requires **no server backend**, operates **100% offline** in remote mine pits, and runs directly inside any modern web browser on smartphones, tablets, or laptops.

---

## Key Features Across All 6 Build Stages

## Modern Application Architecture & Navigation

FragMill organizes mining engineering workflows into clean, role-based workspaces:

### 1. Field Mode
- **5-Step Touch-Friendly Wizard**: Designed for rugged in-pit tablets. Guides the operator from blast geometry entry to photo quality evaluation, 2-tap scale calibration, local WASM segmentation, and instant $P_{20}, P_{50}, P_{80}$ curve generation.

### 2. Expert Mode
- **Blast Workspace (`blast`)**:
  - *Record & Images*: Blast geometry, 3-deck charging profiles, rock mass structural characterization, and optical particle size distribution (PSD).
  - *Pattern Map*: Open-pit SVG bench mapping, drilling pattern geometry, blasted volumes, and multi-blast historical trend reconciliation.
  - *Initiation & Vibration*: 3D blast hole initiation timing simulations, maximum instantaneous charge (MIC), face inclinometer profiling, and USBM ground vibration compliance.
- **Validation Workspace (`validation`)**:
  - Mechanical sieve screening batch reconciliation, Excel paste import, residual RMSE/MAE computation, and optical bias calibration.
- **Predict & Optimise Workspace (`optimise`)**:
  - *Kuz-Ram & Calibration*: Empirical Cunningham blast predictor, Blast Advisor parameter optimization, and Bayesian MCMC rock factor tuning.
  - *Mine-to-Mill*: Integrated drilling, blasting, crushing, and milling economics ($/t) coupled with Scope 1 & 2 carbon footprint analysis.
  - *Circuit Twin*: Comminution digital twin implementing Bond Work Index ($W_i$) and Morrell ($A \times b$) specific energy modeling.
- **Report Vault (`reports`)**:
  - Modular report builder bundling up to 9 specialized technical sections into a single consolidated, publication-ready PDF report.
- **Experimental Modules (`experimental`)**:
  - Available via an opt-in toggle under Settings: features UAV Drone 3D photogrammetry and real-time Conveyor Belt Edge Vision.
- **Settings & Guides**:
  - Bilingual localization (100% English and French), high-contrast outdoor sunlight themes, and comprehensive in-app guidance.

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

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher; tested on v24)
- npm (v9 or higher)

### Installation
```bash
# Clone or navigate to the repository
cd FragMill

# Install dependencies
npm install
```

### Development Server
```bash
# Start local development server with Hot Module Replacement
npm run dev
```
Open your browser at `http://localhost:5173`.

### Running Unit Tests
FragMill includes an automated Vitest test suite validating Kuz-Ram formulas, gold recovery mathematics, Swebrec/Rosin-Rammler fitting algorithms, and the 3% calibration self-test:
```bash
npm test
```

### Production Build
```bash
npm run build
```
Generates optimized static web assets inside the `dist/` directory ready for deployment on GitHub Pages, Firebase Hosting, Netlify, or any static server.

---

## Pre-Loaded Demo Dataset

FragMill initializes with synthetic, calibrated demonstration datasets modeled on artisanal and small-scale gold mining operations in Cameroon:
- **Project**: *Bétaré Oya Mine-to-Mill Pilot (Synthetic Demo Dataset)* (East Region, Cameroon).
- **Site**: *Pit #3 Granodiorite Bench* ($\rho = 2.68\ \text{t/m}^3$, joint spacing $0.50\ \text{m}$).
- **Blast BL-2026-001**: Coarse fragmentation scenario ($P_{80} = 285\ \text{mm}$, jaw crusher bridging, comminution energy $22.6\ \text{kWh/t}$, gold recovery $82.0\%$).
- **Blast BL-2026-002**: Optimized blast pattern scenario ($P_{80} = 195\ \text{mm}$, smooth crushing, comminution energy $16.3\ \text{kWh/t}$, peak gold recovery $89.4\%$).
- **Blast BL-2026-003**: Over-pulverized scenario ($P_{80} = 142\ \text{mm}$, excessive slimes, drop in gravity recovery to $84.7\%$).

---

## License & Citation

FragMill is open source under the [MIT License](LICENSE). Released for educational and open research purposes supporting blast fragmentation, comminution efficiency, and gold recovery in artisanal and small-scale mining.