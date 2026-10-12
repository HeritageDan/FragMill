import React from 'react';
import {
  HelpCircle,
  Camera,
  Ruler,
  Sliders,
  AlertTriangle,
  Factory,
  Compass,
} from 'lucide-react';

interface HelpViewProps {
  lang?: 'en' | 'fr';
}

export const HelpView: React.FC<HelpViewProps> = ({ lang = 'en' }) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <HelpCircle className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {lang === 'fr' ? 'Guide Méthodologique & Manuel d’Utilisation' : 'FragMill Field Protocol & Technical Reference'}
          </h2>
          <p className="text-xs text-slate-500">
            Field photography standards, stereological corrections, and comminution optimization principles
          </p>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 font-medium">
          <span className="font-bold uppercase tracking-wider block mb-1">
            Mandatory Geotechnical & Safety Disclaimer:
          </span>
          FragMill is an engineering decision-support tool. It does not replace the judgment of certified mining
          engineers and blasters. Any proposed modification to blast patterns, burden/spacing, charge weights, or delay
          sequences must be rigorously checked for pit bench stability, ground vibration, flyrock exclusion zones, and
          compliance with national mining regulations.
        </div>
      </div>

      {/* Accordion / Cards of Guidance */}
      <div className="space-y-4">
        {/* 1. Photography Protocol */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-600" /> 1. Field Muck Pile Photography Protocol
          </h3>
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              Accurate 2D photographic fragmentation measurement requires strict adherence to field capture standards:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Perpendicular Viewing Angle:</strong> Stand as perpendicular (90°) to the muck pile slope as safe
                pit access allows. Excessive oblique angles distort apparent fragment aspect ratios.
              </li>
              <li>
                <strong>Stand-Off Distance:</strong> Position the camera 6 to 10 metres from the toe/face. Capture at least
                3 to 5 overlapping photographs across the pile (crest, center bench, and toe).
              </li>
              <li>
                <strong>Diffused Lighting:</strong> Avoid shooting directly into intense sunlight, which causes deep black
                shadow voids between rocks. Overcast conditions provide the most uniform illumination.
              </li>
              <li>
                <strong>Settled Dust:</strong> Always allow blast fumes and fine dust clouds to clear completely before shooting.
              </li>
            </ul>
          </div>
        </div>

        {/* 2. Scale Placement */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-amber-600" /> 2. Scale Reference Target Placement
          </h3>
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              FragMill supports two-point scale bars, four-point homography rectangles, and automatic ArUco markers:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Place the calibration target <strong>in the same focal plane</strong> as the rock fragments being analyzed.
              </li>
              <li>
                Do NOT perch the scale bar on top of an isolated crest boulder or drop it into a deep depression behind rocks.
              </li>
              <li>
                Use a rigid 500 mm painted wooden rod or the printable A4 target available in the Settings tab.
              </li>
            </ul>
          </div>
        </div>

        {/* 3. Stereological Corrections & Swebrec Fit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-600" /> 3. Sizing Definitions & Stereological Bias
          </h3>
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              <strong>Minimum Feret Diameter:</strong> By default, FragMill calculates the minimum Feret diameter for each
              fragment. Geotechnically, this is the caliper width and represents the closest photographic analogue to
              square-aperture sieve screening.
            </p>
            <p>
              <strong>Surface Stereological Bias:</strong> Muck pile photos only capture surface particles. Interior fines
              tend to settle out of view. FragMill addresses this by fitting a Swebrec distribution to the visible part of the
              curve and extrapolating the fine fraction below the image resolution threshold (10–20 pixels).
            </p>
          </div>
        </div>

        {/* 4. Mine-to-Mill Link */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Factory className="w-4 h-4 text-emerald-600" /> 4. Linking Blast Fragmentation to Milling & Gold Recovery
          </h3>
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              For artisanal and small-scale gold mining (ASM) operations, comminution (jaw crushing and ball milling)
              consumes up to 60% of total electrical energy or diesel fuel.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Oversize Boulders (&gt;300 mm):</strong> Cause crusher jaw bridging, chute choking, and expensive
                secondary hammer breaking.
              </li>
              <li>
                <strong>Excessive Fines (&lt;25 mm):</strong> While reducing milling energy, excessive fines in quartz-vein
                gold ore can cause slimes that carry fine gold into gravity tails or tailings ponds.
              </li>
              <li>
                <strong>The Optimum Sweet Spot:</strong> Use the Mine-to-Mill module to plot P80 against specific energy
                (kWh/t) and recovery (%) to locate the economic optimum fragmentation.
              </li>
            </ul>
          </div>
        </div>

        {/* 5. Cunningham Kuz-Ram & Bayesian Calibration */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-600" /> 5. Cunningham (1987) Kuz-Ram Model & Bayesian Updating
          </h3>
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              The Kuz-Ram model computes mean fragmentation size $X_{50} = A \cdot K^{-0.8} \cdot Q^{1/6} \cdot (115/E)^{19/30}$ (cm)
              based on rock mass factors, powder factor $K$, and charge per hole $Q$.
            </p>
            <p>
              FragMill’s <strong>Bayesian MCMC Calibration</strong> treats the rock factor $A$ as an unknown site variable.
              As you monitor consecutive blasts, Metropolis-Hastings sampling refines the posterior distribution of $A$,
              delivering predictive curves with narrow 95% confidence intervals for future blast pattern design.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
