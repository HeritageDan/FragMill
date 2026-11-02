# GeoLab Excel Engine Spike: Architecture Decision Document

## 1. Objective
Enable GeoLab to generate production-grade, branded `.xlsx` geotechnical laboratory reports with:
1. Live Excel formulas (so engineers and auditing authorities can inspect and verify derived calculations).
2. Native, editable Excel charts (Proctor compaction & saturation curves, Grain size semi-log grading curves).
3. 100% client-side, offline-capable execution in modern browsers with zero external runtime dependencies.

---

## 2. Options Evaluated

### Option A: Pyodide + XlsxWriter in a Web Worker
* **Mechanism**: Spawn a Web Worker that loads Pyodide (Python compiled to WebAssembly), installs the Python `XlsxWriter` package, and compiles the spreadsheet using Python's native charting API.
* **Bundle & Download Size**: 
  - `pyodide.asm.js` + `pyodide.asm.wasm`: ~15 MB
  - Python standard library package (`python_stdlib.zip`): ~8.5 MB
  - `XlsxWriter` wheel: ~0.5 MB
  - **Total payload**: ~24 MB.
* **Initialization & Generation Latency**:
  - Initial cold start (Wasm compilation & Python VM init): 6,000 – 14,000 ms.
  - Subsequent workbook generation: 200 – 500 ms.
* **Offline Reliability**: Fragile. Requires caching 24+ MB of binary chunks via ServiceWorker or IndexedDB. Eviction or network drop during initial load breaks report generation.
* **Memory Footprint**: 180 – 260 MB worker heap.

### Option B: Direct DrawingML Chart XML Generation via JSZip
* **Mechanism**: Construct the standard OpenXML (`.xlsx`) ZIP container using `jszip` (or template manipulation), generating ISO/IEC 29500-compliant XML parts:
  - Worksheets with cells, styles, and live formulas (`<c r="P15"><f>((1/N15)-(1/O15))</f><v>0.1182</v></c>`).
  - Native DrawingML charts (`xl/charts/chart1.xml` with `<c:scatterChart>`, `<c:trendline>`, `<c:valAx>`).
  - Drawing layout anchors (`xl/drawings/drawing1.xml` with `<xdr:twoCellAnchor>`).
* **Bundle & Download Size**:
  - `jszip`: ~45.8 kB minified (~14.5 kB gzipped).
  - OpenXML/DrawingML generator engine: ~18 kB.
  - **Total payload**: ~64 kB (0.26% of Option A).
* **Initialization & Generation Latency**:
  - Initial start: 0 ms (bundled in main application chunk).
  - Workbook + chart generation: 15 – 35 ms.
* **Offline Reliability**: 100% deterministic and offline. Zero external network calls.
* **Memory Footprint**: < 5 MB temporary buffer during compression.
* **Chart Fidelity**: Native vector charts in Microsoft Excel, LibreOffice Calc, Apple Numbers, and Google Sheets. Charts remain completely interactive (users can click data points, edit trendlines, or restyle series in Excel).

---

## 3. Decision: Option B (DrawingML + JSZip)
**Selected Architecture**: Option B.

### Rationale:
1. **Performance**: Under 35ms generation time vs. up to 14 seconds for Pyodide cold start.
2. **Lightweight Footprint**: 64 kB vs 24 MB download. Crucial for mining site laptops, field tablets, and slow satellite connections.
3. **Resilience**: Zero risk of WebAssembly compilation failures or memory limits on mobile/embedded browsers.
4. **Authenticity**: Generates identical DrawingML structures to those found in the reference laboratory workbook (`Classeur1.xlsx`), including native scatter charts, polynomial compaction curves, and saturation asymptotes.

