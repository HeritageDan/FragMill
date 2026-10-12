# FragMill: Google AI Studio Build Prompt Pack

A complete prompt set for building the "Blast-to-Mill" fragmentation tool in Google AI Studio (Build mode).

## How to use this pack (read first)

1. **Build mode makes browser apps, not Python scripts.** AI Studio generates a React web app that runs in the browser. The prompt below therefore specifies a fully client-side app (OpenCV.js + in-browser AI models + Gemini API as an optional extra). Your Python/OpenCV script from the proposal is still worth keeping as an independent reference implementation for validation.
2. **Paste PROMPT 1 first** (the master spec). It describes the whole product but tells the builder to implement **Stage 1 only**. Large one-shot specs often produce broken apps, so build in stages.
3. **Then paste PROMPT 2 to PROMPT 6 one at a time**, testing the app after each stage before moving on.
4. **Check the model dropdown in Build mode.** The model that writes the code (the "build assistant") is chosen by AI Studio and can change. Section 14 of the master prompt lists the models the *app itself* should use, which is a separate choice.
5. **Verify the engineering formulas** (Kuz-Ram, Swebrec, Rosin-Rammler, recovery) against your references. They are included so the builder does not invent them, but you remain responsible for correctness.
6. **Test with real photos early.** After Stage 1, upload 3 to 5 of your own muck pile photos and tell the builder exactly what looks wrong.

---

## PROMPT 1: Master specification (paste first)

````text
# ROLE
You are a senior full-stack engineer and a mining/geotechnical software designer. Build a production-quality web app called "FragMill" (full name: "FragMill: Blast-to-Mill Fragmentation Lab").

# PURPOSE
FragMill measures rock fragment size distribution from post-blast muck pile photographs, then links fragmentation to blast design, crushing/milling performance and gold recovery. It is a low-cost, open alternative to commercial fragmentation software (WipFrag, Split-Desktop) for artisanal and small-scale gold mining (ASM) in Cameroon and Central Africa. It supports a graduation research project that tests whether blast fragmentation affects crushing performance and gold recovery (a "mine-to-mill" pilot study).

# USERS
1. Field operator or technician: non-specialist, uses a phone or small laptop, often with poor or no internet, speaks English or French. Needs a guided, simple workflow with big buttons.
2. Engineer/researcher: wants full control of parameters, validation statistics, model comparison, raw data export.
Provide a "Field mode" (guided wizard, minimal choices) and an "Expert mode" (all settings and plots) with a toggle.

# PLATFORM AND ARCHITECTURE
- React + TypeScript + Tailwind CSS. Mobile-first, responsive, works on a phone browser and a desktop browser.
- Fully client-side for all core features. No backend is required. All project data stays on the device.
- Local persistence with IndexedDB (use a small wrapper such as Dexie). Do not use localStorage for images or large data.
- Heavy computation (image processing, AI inference, curve fitting, MCMC) must run in Web Workers so the UI never freezes. Show progress bars and allow cancelling.
- Use OpenCV.js (WebAssembly build) for classical image processing.
- Use onnxruntime-web for in-browser AI inference (WebGPU when available, WASM/CPU fallback).
- Charts: Recharts or Chart.js. CSV: PapaParse. PDF export: jsPDF (or similar). XLSX export: SheetJS.
- Core features must work offline after the first load and first model download. Cache downloaded AI model files persistently (OPFS or IndexedDB) and show their size and status. If a feature cannot work offline, say so clearly in the UI.
- Never hard-code API keys. The Gemini API is an OPTIONAL enhancement (see section 13), and the app must be fully usable without it.

# BUILD PLAN (IMPORTANT)
Build in stages. In THIS first build, implement Stage 1 completely and make the data model, folder structure and navigation ready for Stages 2 to 6 (disabled menu items marked "Coming next" are fine).
- Stage 1: Projects, blast records, image capture/import, image quality checks, scale calibration, classical segmentation, per-blast results, basic export.
- Stage 2: AI segmentation (SAM-type model in the browser), manual editing tools, hybrid mode.
- Stage 3: Ground-truth entry and validation statistics.
- Stage 4: Mine-to-mill module, Kuz-Ram, Bayesian calibration, blast advisor.
- Stage 5: Reports, full exports, dataset export, French/English, offline polish.
- Stage 6: Testing, accessibility, performance, documentation.
Do not start later stages until I ask.

# DATA MODEL (design now, used by all stages)
Project -> Site -> Blast -> {BlastParameters, RockMass, Images[], Calibration, SegmentationRuns[], GroundTruth, MillBatch}
Use TypeScript interfaces. Every record has id, createdAt, updatedAt. Store all numeric values in SI units internally (mm, m, kg, t) and convert for display.

# MODULES AND SCREENS

## 1. Projects and sites
Create, rename, delete projects and sites. Site fields: name, location text, optional GPS, rock/ore type notes, operator contact. Project backup: export/import the entire project as a single JSON file (images included as compressed data or as a ZIP).

## 2. Blast record (form with validation and unit hints)
Fields: blast ID, date/time, bench height (m), hole diameter (mm), hole depth (m), subdrill (m), burden (m), spacing (m), stemming length (m), number of holes, hole inclination, explosive type, relative weight strength (RWS, ANFO = 100), charge per hole (kg), bottom charge length and column charge length (m), initiation sequence/delay notes, water in holes (yes/no), drilling deviation estimate (m), weather, notes.
Rock mass fields: rock type, density (t/m3), joint set count, mean joint spacing (m), joint orientation relative to face (dip out of face / strike perpendicular / dip into face), estimated GSI or RMR (optional), UCS or point-load/Schmidt hammer estimate (MPa, optional), Young's modulus (GPa, optional), photos of the rock face (optional).
Auto-calculated derived values shown live: blasted volume (holes x burden x spacing x bench height), total explosive (kg), powder factor (kg/m3), burden/diameter ratio, spacing/burden ratio, stemming/burden ratio, specific drilling (m/m3). Flag values outside typical ranges with a gentle warning, never block saving.

## 3. Image capture and import
- Take photos with the device camera (getUserMedia / file input with capture) or upload several images per blast.
- Tag each image: zone (front, middle, top, other), lighting (sun, overcast, shade), time, camera height, estimated distance, and whether a scale marker is present.
- Read EXIF data when available.
- Automatic image quality checks with clear pass/warn/fail guidance in plain language: blur (variance of Laplacian), over/under exposure (histogram clipping), strong shadows or glare, low resolution, scale marker not found, heavy dust/haze (low contrast). Offer "retake" advice.
- Show an on-screen capture guide: hold the camera as perpendicular as possible, keep the scale markers fully visible, avoid shooting into the sun, take 3 to 5 photos across the pile.

## 4. Scale calibration and perspective correction
Support three methods, selectable per image:
a) Automatic ArUco marker detection (OpenCV.js aruco module if available in the build; otherwise a lightweight QR/marker approach). Multiple markers of known size can be placed in the frame; use all detected markers to estimate scale and perspective.
b) Manual two-point scale: user taps the two ends of a reference object (for example a 50 cm painted rod) and enters its length.
c) Manual four-point homography: user taps the 4 corners of a known rectangle and enters its real width and height.
Output: pixels-per-mm at the image centre, a scale map across the image when homography is used, and a calibration error estimate. Warn when the scale varies by more than a user-set percentage across the region of interest. Provide a printable A4 PDF of calibration markers (with known printed size and a "check the printed size with a ruler" instruction).

## 5. Region of interest (ROI) and masking
User draws a polygon ROI around the muck pile. User can paint exclusion masks (sky, equipment, people, shadows, water, boards, vegetation). Only pixels inside the ROI and outside exclusions are analysed. Save masks with the image.

## 6. Segmentation engines (select per run, results are stored and comparable)
Engine A: Classical (OpenCV.js). Pipeline with adjustable parameters and sensible defaults:
 grayscale and optional colour-space options, CLAHE contrast normalisation, Gaussian or bilateral filtering, brightness normalisation, adaptive thresholding and/or Canny edges, morphological closing/opening, distance transform + marker-controlled watershed to split touching fragments, contour extraction, filtering by minimum area (in mm2, derived from the calibration), solidity and aspect ratio, border handling.
 Show a live preview of each step in Expert mode.
Engine B (Stage 2): AI segmentation (see section 14).
Engine C (Stage 2): Hybrid, which combines A and B (for example AI masks as seeds for watershed refinement, or A for fines and B for blocks).
All engines output the same result structure: a list of fragments with polygon/mask, pixel area, and a confidence score.

## 7. Fragment measurement
For every fragment compute: area (mm2), equivalent circular diameter (ECD), minimum and maximum Feret diameter, bounding-rectangle width/height, aspect ratio, solidity.
Let the user choose the "size definition" used for the distribution: ECD, minimum Feret (closest to sieve size), or the shorter side of the minimum bounding rectangle. Default: minimum Feret, with a note explaining the choice.
Volume estimate per fragment from the chosen size using a configurable shape factor (default: sphere, pi/6 x d^3). Convert the image-based number/area distribution into a volume-weighted (mass-weighted, constant density) cumulative distribution.

## 8. Distribution corrections (clearly labelled in the UI; show raw and corrected curves together)
- Perspective correction (from calibration).
- Minimum detectable size: define a cut-off below which the image cannot resolve fragments (for example about 10 to 20 pixels across); treat everything below it as "unresolved fines".
- Fines extrapolation: fit a Swebrec function or a Rosin-Rammler function to the resolved part of the curve and extrapolate below the cut-off. Let the user optionally anchor the fines with a measured percentage passing from a sieve or visual estimate.
- Surface-to-volume bias note: a photo only sees the pile surface. Provide an optional user-set correction factor and explain the limitation in plain language. Never hide this limitation.
Formulas to implement:
 Swebrec: P(x) = 1 / (1 + [ln(xmax/x) / ln(xmax/x50)]^b) for 0 < x < xmax, and P(x) = 1 for x >= xmax. Fit parameters xmax, x50, b.
 Rosin-Rammler: P(x) = 1 - exp(-(x/xc)^n). Fit xc and n.
 Fit by weighted nonlinear least squares (Levenberg-Marquardt) on log-size; report R2 and RMSE.

## 9. Results per blast
Cumulative passing curve (log size axis, logarithmic minor grid), histogram, table of P10, P20, P50, P80, P90, Pmax, mean size, uniformity index (P80/P20 or fitted n), oversize percentage above a user-set cut-off (for example crusher gape), fines percentage below a user-set cut-off. Show uncertainty: bootstrap over fragments (1000 resamples, 95% interval) and state clearly that this reflects sampling variability only, not systematic segmentation error.
Combine multiple images of the same blast (and zones) into one blast-level distribution, with per-image and per-zone curves available for comparison. Overlay multiple blasts on one chart. Show the segmentation overlay on the image with a fragment-colour opacity slider, a toggle for outlines, and click-to-inspect a fragment's measurements.

## 10. Ground truth and validation (Stage 3)
Enter manual measurements (for example 50 fragments per blast) and sieve/weighing data (screen sizes with mass retained, field screens). Compute cumulative passing from the sieve data. Compare image-based P20/P50/P80 against ground truth: percentage error, bias, mean absolute percentage error across blasts, parity plot, and a Bland-Altman plot. Compare engines (A, B, C) side by side in one table. Flag blasts where error exceeds a configurable threshold (default 15%).

## 11. Mine-to-mill module (Stage 4)
Each blast has one "MillBatch" record: batch tonnage (t) or truck count and mean load, loading/hauling cycle time, number of boulders needing secondary breaking, crushing time (h) and energy (kWh or litres of fuel), milling throughput (t/h), head grade (g/t), tails grade (g/t), optional concentrate mass and grade, processing notes.
Compute: crushing and milling specific energy (kWh/t), throughput (t/h), oversize rejects (%), and gold recovery:
 - Simple: R = (f - t) / f x 100 when only head grade f and tails grade t are known.
 - Two-product formula when concentrate grade c is known: R = c (f - t) / (f (c - t)) x 100.
Show scatter plots of fragmentation metrics (P50, P80, oversize %, fines %) against energy, throughput and recovery with a regression line and a 95% credible/confidence band. Show a persistent warning when the number of blasts is small (fewer than 8): "Indicative only; sample size too small for firm conclusions." Allow flagging a possible optimum rather than assuming a monotonic relationship (fit linear and quadratic and compare).

## 12. Kuz-Ram, Bayesian calibration and blast advisor (Stage 4)
Implement the Kuz-Ram model per Cunningham (1983, 1987, 2005):
 Mean size: X50 = A x K^(-0.8) x Q^(1/6) x (115/E)^(19/30), where X50 is in cm, A is the rock factor, K is the powder factor (kg/m3), Q is the explosive mass per hole (kg), E is the relative weight strength (ANFO = 100).
 Uniformity index: n = (2.2 - 14 B/D) x sqrt((1 + S/B)/2) x (1 - W/B) x (|BCL - CCL|/L + 0.1)^0.1 x (L/H), where B is burden (m), D is hole diameter (mm), S is spacing (m), W is drilling standard deviation (m), BCL and CCL are bottom and column charge lengths, L is total charge length, H is bench height (all lengths in m).
 Characteristic size: xc = X50 / (0.693)^(1/n). Cumulative passing: P(x) = 1 - exp(-(x/xc)^n).
 Rock factor: A = 0.06 x (RMD + JF + RDI + HF), with the lookup tables (rock mass description, joint spacing, joint orientation, density index RDI = 25 x density - 50, hardness factor) shown as editable tables in the UI. Add a note that the user should verify the tables against the source.
Bayesian calibration (runs in a Web Worker): treat the site rock factor A (and optionally a multiplier on n) as unknown. Use a prior centred on the lookup-table value (log-normal, adjustable width). Use the measured image-based X50 (and optionally P80) from each monitored blast as the likelihood, with an observation error that includes the validation error. Sample the posterior with Metropolis-Hastings (or a grid approximation). Show the prior and posterior, a 95% credible interval, and a predictive curve with an uncertainty band for any new blast design.
Blast advisor: user enters a target P80 (for example the crusher feed size). The advisor searches over burden, spacing, stemming and powder factor within user-set safe limits and shows which changes move the predicted P80 toward the target, with a sensitivity (tornado) chart and the predicted P80 with a credible interval. It must display this fixed notice: "Decision support only. Blast design changes must be reviewed and approved by a qualified blasting engineer and comply with local regulations and site safety rules." Never recommend changes outside the user-set limits.

## 13. Optional Gemini features (need internet and explicit user consent)
Add a settings toggle "Use cloud AI assistance (sends images to Google's Gemini API)", off by default, with a plain consent message. Features when enabled:
 a) Image quality and scene check: is this a muck pile, is a scale reference visible, are there people/equipment/shadows to mask. Return structured JSON (use a response schema) and show it as suggestions.
 b) Scale object and ROI suggestion: return a bounding box for a visible reference object or the pile region, shown as a suggestion the user can accept or adjust.
 c) Plain-language report text in English or French that explains the computed results and next steps for an operator. The model must ONLY use numbers supplied by the app and must never invent measurements. Use low temperature.
 d) Experimental: segmentation of large boulders only (oversize detection), clearly labelled experimental and never used as the main engine.
Use the Gemini API through a single configurable service module. Keep model names in one configuration file as constants so they can be changed easily. Handle offline, quota and error states gracefully with clear messages.

## 14. Models to use inside the app
- Classical: OpenCV.js 4.x (WASM).
- AI segmentation (Stage 2): Segment Anything family, run in the browser with onnxruntime-web: SAM 2.1 (Tiny or Small, optionally Base+) on WebGPU, with the small SlimSAM (about 14 MB, INT8) as a CPU/WASM fallback for browsers or phones without WebGPU. Download model files on demand from a configurable URL (for example Hugging Face ONNX repositories), show size and progress, cache them, and let the user delete them. Implement automatic mask generation by prompting with a point grid over image tiles (with overlap), then filter masks by predicted IoU/stability, remove near-duplicates with non-maximum suppression, remove masks that fall outside the ROI, and resolve overlaps.
- Future custom model (not in Stage 1): allow loading a user-supplied ONNX instance-segmentation model (for example a fine-tuned YOLO-style segmentation model) through a clear input/output adapter, so a model trained later on the project's own annotated dataset can replace the generic one. Keep licence notes in the documentation.
- Cloud (optional): Gemini API, a fast Flash-tier model for quality checks and report text, and a Pro-tier model for harder multi-image reasoning. Names are configurable constants.
- Statistics: implement curve fitting, bootstrap and MCMC in TypeScript (no server).

## 15. Manual editing tools (Stage 2)
On the segmentation overlay: add a fragment (click or draw), delete a fragment, merge two fragments, split a fragment with a drawn line, brush to mark unresolved/fines regions, undo/redo with history, and "re-run in this region only". Store the edited result as a new run version so the original automatic result is never lost.

## 16. Reports and exports (Stage 5)
- PDF report per blast: header (project, site, blast, date), blast parameters, rock mass summary, calibration details, annotated image(s), cumulative curve, percentile table with uncertainty, corrections applied, validation summary, mine-to-mill KPIs, Kuz-Ram comparison, notes, and a clear list of assumptions and limitations.
- CSV/XLSX: fragment-level table (id, area, ECD, Feret min/max, aspect ratio, volume, engine, confidence), blast-level summary, project-level comparison across blasts.
- Annotated image export (PNG) and mask export.
- Dataset export for model training: images with masks in COCO instance-segmentation JSON, only for images the user marks as "approved for dataset", with a per-image consent checkbox and anonymisation (strip EXIF GPS on export).
- Full project backup/restore (JSON/ZIP).

## 17. Language, units and settings
English and French (complete UI, number formats, report text). Unit toggle for size display (mm, cm, in). Light and dark themes, with a high-contrast outdoor-readable option. Settings page: size definition, minimum fragment size, correction options, thresholds (oversize/fines/error), model management, cloud-AI consent, data storage usage with a "clear all data" button.

## 18. Guided "Field mode" wizard
Five steps with a progress bar: 1 Blast info (short form), 2 Photos (with capture guide and quality checks), 3 Scale (auto marker or two taps), 4 Analyse (one button, progress bar), 5 Result (curve, P20/P50/P80, oversize %, plain-language summary, save/export). Use large touch targets, short sentences, and icons. Keep all advanced options hidden unless Expert mode is on.

# DESIGN
Clean, professional engineering look. Colour palette: deep navy (#1F3864), blue (#2E75B6), light blue (#D6E4F0), neutral greys, amber for warnings, red for errors. Generous spacing, clear typography, readable in bright sunlight. Use meaningful empty states, skeleton loaders and helpful error messages. Include a "Demo project" with sample data (blast records and sample results) so the app can be explored without field data.

# QUALITY REQUIREMENTS
- Never freeze the UI; run heavy tasks in workers; auto-downscale very large images (configurable maximum, default 4000 px on the long side) while keeping the original.
- Calibration self-test: include a built-in test that generates a synthetic image of shapes with known sizes and checks that measured sizes are within about 3% after calibration. Show the result in Settings.
- Handle permission denials (camera), unsupported browsers (WebGPU), storage quota errors and corrupted files gracefully.
- Accessible: keyboard navigable, ARIA labels, sufficient contrast.
- Clean, commented, modular code; separate folders for processing, statistics, storage, UI and i18n; unit tests for the statistics and conversion functions where practical.
- All text strings go through the i18n layer.

# NON-GOALS
No accounts, no server database, no payment features, no sharing of data without explicit user action.

# WHAT TO DELIVER NOW (Stage 1)
A working app with: projects/sites/blast records, image capture/import with quality checks, scale calibration (manual two-point, four-point homography, and marker detection if feasible), ROI and exclusion masks, Engine A classical segmentation with live step preview, fragment measurements, corrections (fines extrapolation with Swebrec and Rosin-Rammler fits), per-blast results with percentiles, bootstrap intervals and charts, the Field-mode wizard, English/French toggle, and CSV export. Navigation and data model ready for later stages. After building, list what works, what is stubbed, and any limitation you hit.
````

---

## PROMPT 2: AI segmentation and manual editing

````text
Continue FragMill using the master specification already given. Implement Stage 2 now:
1. Engine B: in-browser AI segmentation with SAM 2.1 (Tiny/Small, optional Base+) via onnxruntime-web on WebGPU, with SlimSAM (INT8, WASM) as a fallback when WebGPU is unavailable. Model files are downloaded on demand from a configurable URL, cached persistently, with a model manager screen (size, status, delete).
2. Automatic mask generation: tile the image with overlap, prompt with a point grid, filter masks by predicted IoU and stability score, apply non-maximum suppression, drop masks outside the ROI, resolve overlaps, and convert masks to polygons. Run in a Web Worker with a progress bar, cancel button and memory-safe tiling.
3. Engine C (Hybrid): use AI masks as seeds for classical watershed refinement, and use the classical engine for the fine fraction.
4. Manual editing tools: add, delete, merge, split, mark-as-fines region, undo/redo, re-run in region. Edits create a new version of the run; keep the original.
5. A side-by-side comparison view of engines A, B and C on the same image, with fragment counts, P50 and P80 for each.
Keep the same result structure so all downstream modules work with any engine. Report limitations at the end (for example speed on phones without WebGPU).
````

## PROMPT 3: Ground truth and validation

````text
Continue FragMill. Implement Stage 3:
1. Ground-truth entry screens: manual fragment measurements (table entry with paste-from-spreadsheet support) and sieve/weighing data (screen sizes with mass retained, with automatic cumulative passing and P-values).
2. Validation dashboard: for each blast and engine compute percentage error and bias for P20, P50 and P80; mean absolute percentage error across blasts; parity plot (image vs ground truth); Bland-Altman plot; table comparing engines A, B and C; threshold flags (default 15%).
3. Make the validation results exportable (CSV and a short PDF section) and available to the blast report.
4. Add clear text explaining that manual-fragment ground truth is biased toward visible, measurable rocks and that sieve or weighed samples are preferred.
Use the Demo project to include example ground-truth data so the screens can be tested.
````

## PROMPT 4: Mine-to-mill, Kuz-Ram, Bayesian calibration, blast advisor

````text
Continue FragMill. Implement Stage 4 exactly as in sections 11 and 12 of the master specification:
1. Mine-to-mill batch records per blast and the computed KPIs (specific energy, throughput, oversize rejects, gold recovery with the simple and two-product formulas).
2. Relationship plots between fragmentation metrics and KPIs with regression (linear and quadratic), uncertainty bands, and the persistent small-sample warning.
3. Kuz-Ram implementation with the editable rock factor tables, the predicted curve versus the measured curve, and a comparison table.
4. Bayesian calibration of the rock factor A (and optional n multiplier) using Metropolis-Hastings in a Web Worker, with prior and posterior plots, 95% credible interval, and predictive curves with uncertainty for a proposed design.
5. Blast advisor with target P80, parameter search within user-set safe limits, a tornado sensitivity chart, and the mandatory decision-support notice.
Add unit tests for the Kuz-Ram functions, the recovery formulas and the fitting functions, using simple hand-checkable examples.
````

## PROMPT 5: Reports, exports, dataset, language and offline

````text
Continue FragMill. Implement Stage 5:
1. PDF report per blast and a project summary report, as described in section 16.
2. CSV and XLSX exports (fragment-level, blast-level, project-level), annotated image and mask export, and project backup/restore as JSON/ZIP.
3. Dataset export in COCO instance-segmentation format for images marked "approved for dataset", with per-image consent and EXIF GPS stripping.
4. Complete English and French translations of the UI and the reports, unit toggles, and the high-contrast outdoor theme.
5. Offline behaviour: cache the app shell and previously downloaded models so the core workflow works without internet; show clear online/offline status and which features need internet.
6. Settings page with storage usage, model manager, cloud-AI consent toggle and a "clear all data" action.
````

## PROMPT 6: Cloud AI assistance, testing and hardening

````text
Continue FragMill. Implement Stage 6:
1. Optional Gemini features from section 13 behind the consent toggle: image/scene quality check with a structured JSON response schema, scale object and ROI suggestion, bilingual plain-language report text using only app-supplied numbers, and the experimental oversize-boulder segmentation. Keep model names in one config file. Handle offline, quota and errors gracefully.
2. The synthetic calibration self-test (shapes of known size must be measured within about 3%).
3. Performance work: automatic downscaling, tiling, worker pooling, memory cleanup, and clear progress and cancel controls.
4. Accessibility pass (keyboard navigation, ARIA labels, contrast) and a first-run tutorial that explains the capture protocol.
5. A README and in-app Help page covering: the field photo protocol, how to place calibration markers, how each correction works and its limits, how to read the results, and the safety and decision-support notice.
6. Fix any issues found, then list remaining limitations honestly.
````

---

## Which models, and for what

| Role | Model / library | Notes |
|---|---|---|
| Writes the app code (build assistant) | Chosen by AI Studio in Build mode | Check the model dropdown. Reports in mid-2026 suggested Build was limited to Flash-tier models, so confirm it yourself. Pro-tier models are still available in the Playground for drafting or reviewing the spec. |
| Classical segmentation | OpenCV.js 4.x (WASM) | Baseline engine. Free and runs offline. |
| AI segmentation (main) | SAM 2.1 Tiny/Small/Base+ via onnxruntime-web (WebGPU) | Model files are large (tens to hundreds of MB), downloaded once and cached. |
| AI segmentation (fallback) | SlimSAM (about 14 MB, INT8, WASM/CPU) | For phones or browsers without WebGPU. |
| Later upgrade | Fine-tuned instance-segmentation model exported to ONNX | Train on your own annotated Cameroonian images. Check the licence of the training framework you use. |
| Optional cloud help | Gemini API (Flash-tier for QA/report text, Pro-tier for harder reasoning) | Off by default, needs internet and consent. Model names kept as constants. |
| Statistics | Own TypeScript code | Swebrec/Rosin-Rammler fitting, bootstrap, Metropolis-Hastings. |

## Known limitations to expect

- **Automatic SAM on dense muck piles is heavy in a browser.** Expect slow runs on phones. Tiling and downscaling help, and hybrid mode plus manual editing is where the quality will come from.
- **Marker detection (ArUco) may not be available in the browser OpenCV build.** The manual two-point and four-point methods are the guaranteed fallback.
- **Preview sandboxes can block offline features** such as service workers. Test offline behaviour in the deployed version, not only in the AI Studio preview.
- **Gemini calls from a deployed app need safe API key handling.** Do not publish a build that exposes your key.
- **The formulas must be verified** against Cunningham (1983, 1987, 2005), Ouchterlony (2005) and your course material before any result goes into the thesis.
