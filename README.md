# FragMill: Blast-to-Mill Fragmentation Lab

> **A low-cost, open, client-side post-blast muck pile fragmentation measurement and comminution optimization platform for Artisanal and Small-Scale Mining (ASM).**

---

## Overview

**FragMill** is an open-source, production-grade geotechnical web application designed to measure rock fragment size distributions directly from muck pile photographs, linking fragmentation to blast design parameters, crushing/milling energy consumption, and gold recovery.

Developed specifically for research and field operations in Cameroon and Central Africa (such as the **Bétaré Oya Gold District**), FragMill provides an accessible alternative to commercial desktop tools (e.g., WipFrag, Split-Desktop). It requires **no server backend**, operates **100% offline** in remote mine pits, and runs directly inside any modern web browser on smartphones, tablets, or laptops.

---

## Key Features Across All 6 Build Stages

### 1. Stage 1: Projects, Blast Records, Image Capture & Classical Engine A
- **Hierarchical Data Architecture**: Projects &rarr; Sites &rarr; Blasts &rarr; Photographs &rarr; Calibrations &rarr; Sizing Runs &rarr; Ground Truth &rarr; Mill Batches.
- **Blast Record Form**: Captures burden, spacing, bench height, hole diameter, subdrill, explosive type, RWS, charge weight, initiation delays, and rock mass structural parameters (density, joint spacing, joint orientation, GSI/RMR, UCS).
- **Auto-Derived Blast Sizing**: Live calculation of blasted volume ($m^3$), blasted tonnage ($t$), powder factor ($kg/m^3$), $S/B$ and $T/B$ ratios, and specific drilling ($m/m^3$).
- **Image Quality Diagnostics**: Automated variance of Laplacian sharpness test, histogram clipping exposure checks, luminance contrast checks, and field capture advice.
- **Scale Calibration**: Two-point reference bar calibration, perspective quadrilateral homography, and automatic marker detection.
- **Classical Segmentation (Engine A)**: WebAssembly-accelerated pipeline featuring Grayscale conversion, CLAHE (Contrast-Limited Adaptive Histogram Equalization), Gaussian smoothing, adaptive thresholding, Distance Transform, and Watershed fragment separation.
- **Fragment Caliper Sizing**: Minimum Feret diameter (closest to sieve square apertures), Maximum Feret, Equivalent Circular Diameter (ECD), aspect ratio, solidity, and shape-factor volume ($V = \frac{\pi}{6} d^3$).
- **Statistical Corrections**: Swebrec and Rosin-Rammler nonlinear regression fits on log-scale cumulative passing, unresolved fines extrapolation, and non-parametric bootstrap confidence intervals (1,000 resamples).
- **Field Mode Wizard**: 5-step touch-friendly wizard for non-specialists on mobile devices.

### 2. Stage 2: In-Browser AI Segmentation & Manual Editing Suite
- **Engine B (AI SAM)**: In-browser deep learning segmentation using Segment Anything (SAM 2.1 Tiny/Small on WebGPU, with SlimSAM INT8 14 MB as a CPU/WASM fallback).
- **Automatic Mask Generation (AMG)**: Point-grid prompts over image tiles, IoU/stability filtering, and Non-Maximum Suppression (NMS).
- **Engine C (Hybrid Mode)**: AI seeds delineate large blocks while classical watershed segments fine textured particles.
- **Manual Editing Suite**: Add rock polygons, delete misidentified fragments, merge adjacent fragments, split boulders with a drawn line, and brush unresolved fines with full undo/redo history (saved non-destructively as new run versions).

### 3. Stage 3: Ground Truth Entry & Model Validation
- **Ground Truth Entry**: Manual rock caliper measurements and screen/sieve data entry with direct paste support from Excel/spreadsheets.
- **Validation Dashboard**: Real-time evaluation of $P_{20}, P_{50}, P_{80}$ percentage error and bias, Mean Absolute Percentage Error (MAPE), and threshold alerts (>15% discrepancy).
- **Parity & Bland-Altman Plots**: Comparative difference plots testing image sizing against mechanical screening samples.

### 4. Stage 4: Mine-to-Mill Comminution, Kuz-Ram & Bayesian Calibration
- **MillBatch Module**: Tracking batch tonnage, truck counts, crushing energy ($kWh$), milling energy ($kWh$), plant throughput ($t/h$), head grade ($g/t$), and tails grade ($g/t$).
- **Gold Recovery Calculations**:
  - *Simple Formula*: $R = \frac{f - t}{f} \times 100\%$
  - *Two-Product Formula*: $R = \frac{c(f - t)}{f(c - t)} \times 100\%$
- **Comminution Regression**: Scatter plots linking $P_{80}$ and oversize boulder fraction to specific comminution energy ($kWh/t$), throughput ($t/h$), and gold recovery with 95% confidence bands.
- **Cunningham (1983, 1987, 2005) Kuz-Ram Model**: Theoretical $X_{50}$ and uniformity index $n$ based on editable rock mass factor lookup tables ($RMD, JF, JFO, RDI, HF$).
- **Bayesian MCMC Calibration**: Metropolis-Hastings sampling in background threads to calibrate site rock factor $A$ across monitored blasts, producing predictive distributions with 95% credible intervals.
- **Blast Advisor**: Search optimization over burden, spacing, stemming, and powder factor to hit target crusher feed $P_{80}$ with a Tornado sensitivity chart and mandatory mining safety notice.

### 5. Stage 5: Reports, Multi-Format Exports, Dataset & Offline Polish
- **Comprehensive PDF Blast Report**: Multi-page report via `jsPDF` with blast metadata, rock mass properties, annotated segmentation overlay, cumulative curve, Swebrec parameters, comminution KPIs, and engineering disclaimers.
- **Printable A4 Calibration Target**: Generates a PDF scale sheet with 100 mm verification ruler, high-contrast 200 mm scale bar, and ArUco markers.
- **CSV & XLSX Exports**: Fragment-level geometric parameters, blast summaries, and cumulative passing curves via `PapaParse` and `SheetJS`.
- **COCO Dataset Export**: JSON format for training fine-tuned instance segmentation models (with GPS EXIF stripped for privacy).
- **Project Backup & Restore**: Complete database export and import as a standalone JSON file.
- **Full Bilingual Support**: 100% complete English and French UI translations.
- **Display Themes**: Engineering Navy, Dark Mode, and High-Contrast Outdoor Sunlight Mode.

### 6. Stage 6: Optional Cloud AI, Hardening & Self-Test
- **Optional Gemini API Assistant**: Behind an explicit consent toggle; performs scene obstacle checking, ROI/scale suggestions, and bilingual engineering commentary using strictly app-supplied numbers.
- **Synthetic Calibration Self-Test**: Validates precision against synthetic discs and gauge blocks within a strict **3% tolerance limit**.

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

FragMill initializes automatically with rich, real-world data from an artisanal and small-scale gold mining pilot study in Cameroon:
- **Project**: *Bétaré Oya Mine-to-Mill Pilot Study* (East Region, Cameroon).
- **Site**: *Pit #3 Granodiorite Bench* ($\rho = 2.68\ \text{t/m}^3$, joint spacing $0.50\ \text{m}$).
- **Blast BL-2026-001**: Coarse fragmentation ($P_{80} = 285\ \text{mm}$, jaw crusher bridging, total specific comminution energy $22.6\ \text{kWh/t}$, gold recovery $82.0\%$).
- **Blast BL-2026-002**: Optimized blast pattern ($P_{80} = 195\ \text{mm}$, smooth primary crushing, comminution energy $16.3\ \text{kWh/t}$, peak gold recovery $89.4\%$).
- **Blast BL-2026-003**: Over-pulverized blast ($P_{80} = 142\ \text{mm}$, excessive slimes, drop in gravity spiral recovery to $84.7\%$).

---

## Licence & Citation

FragMill is released for educational and open research purposes supporting graduation research on blast fragmentation, comminution efficiency, and gold recovery in artisanal and small-scale mining.
