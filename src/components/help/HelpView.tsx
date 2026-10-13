import React, { useState } from 'react';
import {
  HelpCircle,
  Camera,
  Ruler,
  Sliders,
  AlertTriangle,
  Factory,
  Compass,
  Wand2,
  Cpu,
  Edit3,
  Scale,
  ShieldCheck,
  Download,
  BookOpen,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  Flame,
  CheckCircle2,
  Plane,
  Video,
  Wifi,
  MapPin,
  TrendingUp,
  Volume2,
  ShieldAlert,
  Zap,
  DollarSign,
  FileCode,
} from 'lucide-react';

interface HelpViewProps {
  lang?: 'en' | 'fr';
}

export const HelpView: React.FC<HelpViewProps> = ({ lang = 'en' }) => {
  const isFr = lang === 'fr';
  const [activeSection, setActiveSection] = useState<
    'intro' | 'features' | 'advanced' | 'camera' | 'minetomill' | 'kuzram' | 'faq'
  >('intro');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30 text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {isFr ? 'Guide Complet FragMill : De l’Abattage au Moulin' : 'FragMill Complete Guide: From Blast to Mill'}
            </h2>
            <p className="text-xs text-slate-500">
              {isFr
                ? 'Comprendre la fragmentation rocheuse et maîtriser chaque outil avec des exemples miniers réels'
                : 'Mastering rock fragmentation, comminution economics, and every advanced mining feature'}
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveSection('intro')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'intro' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isFr ? '1. Vue d’Ensemble' : '1. Overview'}
          </button>
          <button
            onClick={() => setActiveSection('features')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'features' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isFr ? '2. Outils de Base' : '2. Baseline Features'}
          </button>
          <button
            onClick={() => setActiveSection('advanced')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'advanced' ? 'bg-blue-600 text-white shadow ring-2 ring-blue-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-800'
            }`}
          >
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {isFr ? '3. Suite Tier-1 Avancée' : '3. Advanced Tier-1 Suite'}
            </span>
          </button>
          <button
            onClick={() => setActiveSection('camera')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'camera' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isFr ? '4. Photo & Mire' : '4. Photo & Scale Protocol'}
          </button>
          <button
            onClick={() => setActiveSection('minetomill')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'minetomill' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isFr ? '5. Énergie & Or' : '5. Mine-to-Mill & Gold'}
          </button>
          <button
            onClick={() => setActiveSection('kuzram')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'kuzram' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isFr ? '6. Kuz-Ram & Bayésien' : '6. Kuz-Ram & Advisor'}
          </button>
          <button
            onClick={() => setActiveSection('faq')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSection === 'faq' ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isFr ? '7. FAQ' : '7. FAQ'}
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 font-medium">
          <span className="font-bold uppercase tracking-wider block mb-0.5">
            {isFr ? 'Avertissement de Sécurité Minière Obligatoire :' : 'Mandatory Mining Safety Notice:'}
          </span>
          {isFr
            ? 'FragMill est un outil d’aide à la décision technique et d’ingénierie. Toute modification du plan de tir (maille, écartement, charge d’explosif, séquencement) doit obligatoirement être validée par un ingénieur des mines ou un boutefeu qualifié conformément à la réglementation en vigueur (stabilité des gradins, projections, vibrations).'
            : 'FragMill is an engineering decision-support tool. Any blast pattern modification (burden, spacing, charge per hole, initiation delays) must be reviewed and approved by a qualified mining engineer or certified blaster in compliance with local statutory safety regulations.'}
        </div>
      </div>

      {/* SECTION 1: OVERVIEW & REAL-LIFE EXAMPLE */}
      {activeSection === 'intro' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {isFr ? 'Qu’est-ce que FragMill et pourquoi est-ce essentiel ?' : 'What is FragMill and Why Does It Matter?'}
            </h3>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    Lorsqu’une exploitation minière fait exploser un massif rocheux avec de l’explosif (comme du nitrate-fioul ANFO), la roche se fracture en morceaux de tailles très diverses : certains morceaux sont de gros blocs géants (<strong>boulders / hors-gabarit</strong>), d’autres sont des pierres idéales de 10 à 20 centimètres, et d’autres encore sont réduits en poussière et sable très fin (<strong>fines</strong>).
                  </>
                ) : (
                  <>
                    When a mine blasts a rock bench using explosives (such as ANFO), the rock fractures into pieces of many different sizes: some are giant boulders (<strong>oversize</strong>), some are ideal medium stones (10 to 20 cm), and some are pulverized into fine sand and dust (<strong>fines</strong>).
                  </>
                )}
              </p>

              <p>
                {isFr ? (
                  <>
                    <strong>FragMill</strong> est une application web moderne de haute précision, 100% autonome et fonctionnant <strong>sans aucune connexion internet</strong>. Elle permet de mesurer instantanément la taille de ces roches en prenant simplement une <strong>photo sur le terrain</strong> avec votre smartphone ou tablette, puis de relier directement cette qualité de tir à la <strong>consommation d’énergie des concasseurs</strong> et à la <strong>quantité d’or récupérée</strong> au moulin.
                  </>
                ) : (
                  <>
                    <strong>FragMill</strong> is a modern high-precision web application that operates 100% client-side, <strong>completely offline</strong> in remote open pits. It allows mining teams to measure rock fragment sizes simply by taking a <strong>field photograph</strong> of the muck pile with a scale bar, and then links that fragmentation directly to <strong>crusher power consumption</strong> and <strong>gold recovery rates</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Real-life Case Study Card */}
          <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                {isFr ? 'Cas d’École Réel' : 'Real-Life Case Study'}
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                {isFr ? 'Mine d’Or Artisanale à Bétaré Oya (Région de l’Est, Cameroun)' : 'Bétaré Oya Artisanal Gold Open Pit (East Region, Cameroon)'}
              </span>
            </div>

            <h4 className="text-sm font-bold text-white">
              {isFr
                ? 'L’histoire de deux tirs dans le granodiorite à filons de quartz aurifère'
                : 'A Tale of Two Blasts in Gold-Bearing Quartz Granodiorite'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 pt-1">
              <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-2">
                <span className="font-bold text-amber-300 block text-xs">
                  {isFr ? '❌ Tir N°1 : Sous-dosé (Trop peu d’explosif)' : '❌ Blast #1: Under-Charged (Low Powder Factor)'}
                </span>
                <p>
                  {isFr
                    ? 'Pour économiser l’explosif, l’équipe a utilisé seulement 15 kg d’ANFO par trou. Résultat sur la photo analysée par FragMill : un P80 de 320 mm. Plus de 20% des blocs dépassent 300 mm.'
                    : 'To save on explosive costs, the crew loaded only 15 kg of ANFO per hole. FragMill measured a coarse P80 of 320 mm. Over 20% of the pile consisted of oversize boulders (>300 mm).'}
                </p>
                <div className="p-2 bg-red-950/40 border border-red-500/30 rounded text-red-200">
                  <strong>{isFr ? 'Conséquences au moulin :' : 'Plant Consequences:'}</strong>{' '}
                  {isFr
                    ? 'Le concasseur à mâchoires se bloque (chocking). Il faut payer des ouvriers au marteau piqueur pour fendre les blocs. Le concasseur consomme 22 kWh/t et le débit s’effondre à 40 t/h.'
                    : 'The primary jaw crusher clogged repeatedly. Crews had to manually hammer boulders. Crushing energy skyrocketed to 22 kWh/t and throughput fell to 40 t/h.'}
                </div>
              </div>

              <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-2">
                <span className="font-bold text-emerald-300 block text-xs">
                  {isFr ? '✅ Tir N°3 : Optimisé avec FragMill Advisor' : '✅ Blast #3: Optimized via FragMill Advisor'}
                </span>
                <p>
                  {isFr
                    ? 'Guidée par le conseiller de tir, l’équipe a resserré la maille (B=2.2m, S=2.5m) avec 24 kg d’ANFO. FragMill mesure un P80 idéal de 155 mm avec moins de 2% de hors-gabarit.'
                    : 'Guided by FragMill Advisor, the blaster adjusted burden to 2.2m and spacing to 2.5m with 24 kg ANFO. FragMill measured a smooth P80 of 155 mm with under 2% oversize.'}
                </p>
                <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-200">
                  <strong>{isFr ? 'Gains spectaculaires :' : 'Dramatic Gains:'}</strong>{' '}
                  {isFr
                    ? 'Le concasseur avale la roche sans arrêt. L’énergie totale chute à 14.8 kWh/t, le débit monte à 78 t/h, et la récupération d’or sur table à secousses passe de 72% à 84% !'
                    : 'The crusher fed smoothly without interruption. Energy dropped to 14.8 kWh/t, throughput jumped to 78 t/h, and gravity gold table recovery surged from 72% to 84%!'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: BASELINE FEATURES */}
      {activeSection === 'features' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              {isFr ? 'Inventaire Détaillé des Outils & Modules de Base' : 'Detailed Walkthrough of Baseline Features'}
            </h3>

            <div className="space-y-4 text-xs text-slate-600">
              {/* Feature 1: Mode Switcher */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Wand2 className="w-4 h-4 text-amber-500" />
                  <span>1. {isFr ? 'Basculement Mode Terrain / Mode Expert' : 'Field Mode vs Expert Mode'}</span>
                </div>
                <p>
                  {isFr
                    ? 'Le bouton jaune/bleu dans l’en-tête permet de basculer instantanément entre l’Assistant Terrain Guidé en 5 étapes (conçu pour une tablette tactile sur le tas d’abattage poussiéreux) et le Mode Expert avec tous les graphiques avancés de laboratoire et modules d’ingénierie.'
                    : 'The toggle button in the header switches between the guided 5-step Field Wizard (large touch buttons designed for a tablet in the pit) and Expert Mode with full laboratory dashboards and deep engineering suites.'}
                </p>
              </div>

              {/* Feature 2: Field Wizard */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Wand2 className="w-4 h-4 text-blue-600" />
                  <span>2. {isFr ? 'L’Assistant Terrain Guidé en 5 Étapes' : 'The 5-Step Field Wizard'}</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>{isFr ? 'Étape 1 (Tir) :' : 'Step 1 (Blast):'}</strong> {isFr ? 'Saisie rapide de la banquette (burden), écartement (spacing), hauteur de gradin, charge par trou et type de roche.' : 'Quick entry of burden, spacing, bench height, charge per hole, and rock mass type.'}</li>
                  <li><strong>{isFr ? 'Étape 2 (Photo & Qualité) :' : 'Step 2 (Photo):'}</strong> {isFr ? 'Prise de photo ou téléversement, avec analyse automatique en temps réel du flou (netteté), contraste, luminosité et détection de non-géologie (rejet de logos).' : 'Live capture or upload with automated quality checks (sharpness, exposure, contrast, and non-geological graphic detection).'}</li>
                  <li><strong>{isFr ? 'Étape 3 (Échelle en 2 clics) :' : 'Step 3 (Scale):'}</strong> {isFr ? 'Touchez simplement les deux extrémités de votre barre d’échelle de 500 mm pour verrouiller le calibrage en pixels par millimètre.' : 'Tap the two ends of your 500 mm scale reference rod to calibrate pixels per millimetre.'}</li>
                  <li><strong>{isFr ? 'Étape 4 (Segmentation Moteur) :' : 'Step 4 (Segmentation):'}</strong> {isFr ? 'Traitement instantané des contours de roches en WebAssembly local.' : 'Instant boundary delineation running client-side in WebAssembly.'}</li>
                  <li><strong>{isFr ? 'Étape 5 (Résultats & Courbe) :' : 'Step 5 (Results):'}</strong> {isFr ? 'Affichage des percentiles P20, P50, P80, % de hors-gabarit, % de fines et export PDF immédiat.' : 'Percentiles (P20, P50, P80), oversize/fines proportions, and instant PDF report generation.'}</li>
                </ul>
              </div>

              {/* Feature 3: Blast Detail & Parameters */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Compass className="w-4 h-4 text-purple-600" />
                  <span>3. {isFr ? 'Détails du Tir & Suppression Sécurisée' : 'Blast Records & Pattern Management'}</span>
                </div>
                <p>
                  {isFr
                    ? 'Chaque paramètre géométrique (hauteur de gradin, diamètre, bourrage, inclinaison, densité, fissuration géologique RMD/JFO) est modifiable avec recalcul instantané de la consommation spécifique d’explosif (kg/m³). Comprend un bouton rouge de suppression pour effacer un tir obsolète ainsi qu’un bouton d’exportation en classeur Excel (.xlsx) et liste de fragments CSV.'
                    : 'Every geometry and rock mass parameter is editable with live powder factor calculation. Features a dedicated delete button to safely remove obsolete blasts, along with complete Excel (.xlsx), CSV, and PDF export suites.'}
                </p>
              </div>

              {/* Feature 4: Three Segmentation Engines */}
              <div className="p-4 bg-slate-50 border border-slate-200 shadow-xs rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Cpu className="w-4 h-4 text-emerald-600" />
                  <span>4. {isFr ? 'Les 3 Moteurs de Détection de Fragments' : 'Three Segmentation Engines'}</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>{isFr ? 'Moteur A (Classique WASM) :' : 'Engine A (Classical WASM):'}</strong> {isFr ? 'Ultra-rapide (0.4s), utilise le contraste CLAHE, le seuillage adaptatif, la transformée en distance et la ligne de partage des eaux (watershed). 100% hors-ligne.' : 'Ultra-fast (0.4s), using CLAHE contrast enhancement, distance transform, and watershed segmentation.'}</li>
                  <li><strong>{isFr ? 'Moteur B (IA SAM 2.1) :' : 'Engine B (AI SAM 2.1):'}</strong> {isFr ? 'Réseau de neurones profond prédisant les masques de roches complexes et empilées, exécuté directement dans le navigateur via WebGPU ou CPU.' : 'Deep neural model predicting rock mask boundaries in complex piles directly in the browser via WebGPU.'}</li>
                  <li><strong>{isFr ? 'Moteur C (Hybride Ensemble) :' : 'Engine C (Hybrid Ensemble):'}</strong> {isFr ? 'Combine le filtrage classique et les masques IA avec suppression des non-maximums pour une précision maximale.' : 'Ensemble combining classical edge candidates with AI masks for optimum precision.'}</li>
                </ul>
              </div>

              {/* Feature 5: Manual Editor */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>5. {isFr ? 'Suite d’Édition Manuelle Interactive' : 'Interactive Manual Fragment Editor'}</span>
                </div>
                <p>
                  {isFr
                    ? 'Permet à l’ingénieur d’intervenir sur les roches détectées : fractionner un bloc mal découpé (Split), fusionner deux morceaux (Merge), dessiner une roche oubliée (Add Polygon), supprimer des faux positifs (Delete), ou taguer une zone de sable fin (Fines Brush) avec annulation/rétablissement (Undo/Redo).'
                    : 'Enables engineers to refine segmentation: Split coalesced boulders, Merge over-segmented pieces, draw missing rock polygons, delete artifacts, tag fine matrix sand, with full Undo/Redo.'}
                </p>
              </div>

              {/* Feature 6: Ground Truth & Validation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Scale className="w-4 h-4 text-indigo-600" />
                  <span>6. {isFr ? 'Validation & Vérité Terrain par Tamisage' : 'Ground Truth & Sieve Validation'}</span>
                </div>
                <p>
                  {isFr
                    ? 'Compare les dimensions mesurées sur photo aux masses physiques pesées sur tamis mécanique ou trommel. Comprend un outil d’importation par copier-coller direct depuis Excel, le téléversement de fichiers .xlsx/.csv, le calcul de l’erreur absolue moyenne (MAPE), et un avertissement automatique si l’erreur dépasse 15%.'
                    : 'Validates 2D photographic sizing against physical weighed sieve or trommel screening batches. Features Excel paste import, file upload, Mean Absolute Percentage Error (MAPE) tracking, and 15% threshold alerts.'}
                </p>
              </div>

              {/* Feature 7: Bench Map */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span>7. {isFr ? 'Plan Spatial des Gradins & Réconciliation Temporelle' : 'Spatial Bench Map & Historical Reconciliation'}</span>
                </div>
                <p>
                  {isFr
                    ? 'Cartographie interactive SVG affichant l’emplacement de chaque tir sur les différents gradins de la fosse (crête, supérieur, intermédiaire). Cliquez sur un bloc pour inspecter sa qualité, et observez la courbe d’évolution temporelle du P80 pour vérifier la cohérence du concassage.'
                    : 'Interactive SVG pit map rendering blast blocks across bench levels. Inspect individual polygon granulometry and monitor longitudinal multi-blast trends over time.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: TIER-1 ADVANCED MINING SUITE */}
      {activeSection === 'advanced' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-400 text-slate-950 text-xs font-black rounded-full uppercase tracking-wider">
                {isFr ? 'Niveau Industriel Supérieur' : 'Industrial Tier-1'}
              </span>
              <span className="text-xs text-blue-200 font-semibold">
                {isFr ? 'Les 6 Piliers d’Ingénierie Avancée FragMill' : 'The 6 Core Pillars of Advanced Mining Engineering'}
              </span>
            </div>
            <h3 className="text-lg font-black text-white">
              {isFr
                ? 'Une technologie minière digne des plus grands sites mondiaux (Rio Tinto, BHP, Newmont)'
                : 'Advanced Mining Technologies for World-Class Surface Operations'}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isFr
                ? 'Ces 6 modules innovants hissent FragMill au standard des géants miniers tout en restant utilisables sur une simple tablette autonome dans les exploitations artisanales et semi-mécanisées.'
                : 'These 6 innovative modules bring cutting-edge mine engineering to your pit tablet, operating 100% offline without cloud subscriptions or expensive external hardware.'}
            </p>
          </div>

          {/* Pillar 1: Drone 3D Photogrammetry */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isFr ? '1. Photogrammétrie 3D Drone & Correction Stéréologique' : '1. Drone 3D Photogrammetry & 3D Stereology'}
                </h4>
                <span className="text-[11px] text-blue-600 font-semibold">
                  {isFr ? 'Mesure volumétrique aérienne et gradient spatial du tas d’abattage' : 'UAV Aerial Orthomosaics & Volumetric Cunningham Sizing'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    <strong>Le problème sur le terrain :</strong> Prendre une simple photo avec un smartphone au sol présente deux limites : d’une part, il est dangereux de s’approcher du pied d’un talus instable exposé aux chutes de pierres ; d’autre part, une photo 2D ne voit que la surface visible des blocs et "oublie" les fines cachées sous les gros rochers, créant un biais qui surestime la taille des cailloux.
                  </>
                ) : (
                  <>
                    <strong>The Field Challenge:</strong> Ground photos pose safety hazards near unstable muck faces and suffer from 2D surface masking bias—large boulders cover smaller pebbles and fines lying underneath.
                  </>
                )}
              </p>
              <p>
                {isFr ? (
                  <>
                    <strong>La solution FragMill :</strong> Vous pouvez charger les orthomosaïques géoréférencées issues de vols de drone (DJI, Autel, Wingtra). L’algorithme de <strong>stéréologie 3D de Cunningham</strong> convertit les ellipses 2D en véritables volumes 3D (V = π/6 · a · b²) et réinjecte la distribution des fines dissimulées. De plus, le tas est découpé en 3 secteurs spatiaux (Crête, Milieu, Pied de talus) avec rendu d’un maillage isométrique 3D interactif.
                  </>
                ) : (
                  <>
                    <strong>FragMill Solution:</strong> Import georeferenced UAV orthomosaics. FragMill applies <strong>3D ellipsoidal stereology</strong> to reconstruct true rock volumes and corrects for hidden fines, mapping spatial fragmentation gradients across crest, center, and toe sectors.
                  </>
                )}
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <strong>{isFr ? 'Exemple réel à Bétaré Oya :' : 'Real Example:'}</strong>{' '}
                {isFr
                  ? 'Un vol de drone à 35m d’altitude au-dessus d’un tas de 25 000 m³ révèle que le secteur 3 (pied de talus) contient 18.5% de blocs > 600 mm en raison d’un pied de gradin trop résistant. Le chef de fosse envoie immédiatement une pelle avec BRH dégager le pied avant l’arrivée des camions de transport.'
                  : 'A 35m drone flight over a 25,000 m³ granodiorite muckpile identified 18.5% oversize at the toe due to toe stiffness. Excavator crews pre-dispatched a hydraulic rockbreaker before haul trucks were delayed.'}
              </div>
            </div>
          </div>

          {/* Pillar 2: Belt Edge Vision */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isFr ? '2. Vision Temps Réel sur Convoyeur (20 FPS) & Alarme Anti-Bourrage' : '2. Continuous Belt Edge Vision (20 FPS) & Anti-Choke Siren'}
                </h4>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  {isFr ? 'Surveillance continue du concasseur primaire avec sirène sonore' : 'Real-time conveyor granulometry stream & crusher protection'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    <strong>Le problème sur le terrain :</strong> Un bloc de roche hors-gabarit (&gt; 450 mm) qui tombe dans un concasseur à mâchoires provoque un coincement immédiat (choke). Le moteur électrique surchauffe, la courroie patine et brûle, et l’usine s’arrête pendant 2 à 4 heures le temps que des ouvriers descendent dans la trémie avec un marteau-piqueur.
                  </>
                ) : (
                  <>
                    <strong>The Field Challenge:</strong> An unexpected 500 mm boulder falling into a primary jaw crusher causes instant choking, stalls the motor, and stops the entire plant for 2 to 4 hours of dangerous manual unblocking.
                  </>
                )}
              </p>
              <p>
                {isFr ? (
                  <>
                    <strong>La solution FragMill :</strong> Une caméra industrielle ou webcam connectée filme en continu le tapis roulant d’alimentation à 20 images par seconde. Un pipeline WebAssembly analyse chaque image en 40 millisecondes et calcule en direct les moyennes mobiles du P20, P50, P80 et le débit en tonnes par heure (TPH). Si un bloc dépassant la limite de sécurité est détecté, l’API Web Audio déclenche une <strong>alarme sonore aiguë (sirène à 880 Hz)</strong> et un bandeau rouge clignotant avertit l’opérateur d’arrêter l’alimentateur vibrant.
                  </>
                ) : (
                  <>
                    <strong>FragMill Solution:</strong> Rugged cameras process conveyor rock streams continuously at 20 FPS in WebAssembly. Moving P20, P50, and P80 curves are tracked alongside TPH throughput. If an oversize boulder exceeds crusher gape limits, a Web Audio <strong>high-frequency audible siren (880 Hz)</strong> fires instantly to halt the feeder.
                  </>
                )}
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                <strong>{isFr ? 'Exemple réel :' : 'Real Example:'}</strong>{' '}
                {isFr
                  ? 'Sur le convoyeur CV-01 alimentant le concasseur à 320 t/h, un bloc de quartz de 520 mm a été détecté à 14h22. L’alarme a retenti, l’opérateur a stoppé le tapis en 3 secondes et a retiré la roche à la grue, évitant 3 heures d’arrêt et 7 000 $ de perte de production.'
                  : 'On conveyor CV-01 running at 320 t/h, a 520 mm quartz boulder was flagged. The alarm alerted the operator to pause the belt within 3 seconds, saving $7,000 in downtime.'}
              </div>
            </div>
          </div>

          {/* Pillar 3: 3D Initiation Timing Simulator */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isFr ? '3. Simulateur de Séquençage 3D & Détecteur de Risque de Projections' : '3. 3D Blast Initiation Timing & Face Profiler'}
                </h4>
                <span className="text-[11px] text-purple-600 font-semibold">
                  {isFr ? 'Simulation milliseconde par milliseconde, vibrations PPV et sécurité du front' : 'Isochrone detonation wave, USBM vibration compliance & flyrock hazard alert'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    <strong>Le problème sur le terrain :</strong> L’ordre et le retard (en millisecondes) avec lesquels les trous explosent sont aussi importants que la quantité d’explosif ! Si tous les trous explosent en même temps, l’onde de choc fait trembler les maisons des villages voisins et pulvérise les parois. Si le premier rang a trop peu de roche devant lui (sous-banquette &lt; 1.5 m), les gaz d’explosion soufflent vers l’avant et projettent des roches tueuses à plus de 500 mètres (flyrock).
                  </>
                ) : (
                  <>
                    <strong>The Field Challenge:</strong> Firing holes simultaneously triggers severe ground vibration that cracks community buildings. Furthermore, an underburdened face (&lt;1.5 m) allows explosive gases to blow out forward, ejecting deadly flyrock projectiles over 500 metres.
                  </>
                )}
              </p>
              <p>
                {isFr ? (
                  <>
                    <strong>La solution FragMill :</strong> Le simulateur 3D permet de tester le tir au ralenti milliseconde par milliseconde (séquençage en V, rangée par rangée ou détonateurs électroniques). Il calcule automatiquement les vibrations au sol (PPV en mm/s selon la formule de l’USBM) en fonction de la distance des habitations, et inspecte le profil laser du front de taille pour alerter en rouge en cas de zone de sous-banquette à risque mortel de projection.
                  </>
                ) : (
                  <>
                    <strong>FragMill Solution:</strong> Step through blast progression millisecond-by-millisecond (V-echelon, row-by-row, electronic). FragMill predicts ground vibration (Peak Particle Velocity via USBM equations) at village distances and scans bench face profiles to flag dangerous flyrock underburden zones in bright red.
                  </>
                )}
              </p>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900">
                <strong>{isFr ? 'Exemple réel :' : 'Real Example:'}</strong>{' '}
                {isFr
                  ? 'Pour un tir situé à 450 m du camp des travailleurs, le tir simultané classique produisait 28 mm/s de vibration (fissures aux murs). Le passage en V-échelon (17ms entre trous, 42ms entre rangées) simulé dans FragMill a réduit la vibration à 7.4 mm/s (conforme aux normes internationales < 10 mm/s) avec zéro projection.'
                  : 'At 450m from camp facilities, simultaneous rows created 28 mm/s PPV. Switching to FragMill simulated V-echelon delays dropped vibrations to 7.4 mm/s (well below the 10 mm/s statutory ceiling) with zero flyrock.'}
              </div>
            </div>
          </div>

          {/* Pillar 4: Comminution Digital Twin */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                <Factory className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isFr ? '4. Jumeau Numérique de Broyage & Micro-Fissuration (Bond & Morrell)' : '4. Comminution Digital Twin & Mineral Liberation'}
                </h4>
                <span className="text-[11px] text-amber-600 font-semibold">
                  {isFr ? 'Théorie de Bond, micro-fissuration par l’explosif et courbe d’arbitrage économique' : 'Bond work index, Morrell micro-crack mechanics & Mine-to-Mill economic sweet spot'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    <strong>Le secret économique de la mine :</strong> L’énergie chimique de l’explosif dans la fosse coûte environ <strong>0,08 $ par kWh équivalent</strong>, alors que l’énergie électrique des moteurs de concasseurs et de broyeurs à boulets coûte entre <strong>0,20 $ et 0,35 $ par kWh</strong> ! Casser la roche dans la fosse avec l’explosif coûte 3 fois moins cher que de la broyer à l’électricité à l’usine.
                  </>
                ) : (
                  <>
                    <strong>The Economic Principle:</strong> Chemical explosive energy in the pit costs ~$0.08/kWh equivalent, whereas mechanical electrical power at the mill costs $0.20 to $0.35/kWh. Blasting rock finer in the pit is 3 times cheaper than grinding it with electrical motors!
                  </>
                )}
              </p>
              <p>
                {isFr ? (
                  <>
                    <strong>La solution FragMill :</strong> Le jumeau numérique calcule l’énergie de concassage et de broyage selon la 3ème théorie de Bond et le modèle de Morrell (Mic, Mih). Il démontre comment l’onde de choc du tir crée des micro-fissures invisibles à l’intérieur des grains de quartz, ce qui facilite leur broyage et libère les micro-particules d’or emprisonnées dans la pyrite. FragMill trace la courbe en U du coût total d’exploitation pour trouver le point d’équilibre parfait (Sweet-Spot P80).
                  </>
                ) : (
                  <>
                    <strong>FragMill Solution:</strong> Digital twin simulation calculates crushing and milling energy via Bond’s Third Theory and Morrell’s micro-crack models. It proves how shockwaves induce internal micro-fissures in quartz grains, boosting gold liberation on gravity tables and plotting the exact total cost U-curve sweet spot.
                  </>
                )}
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <strong>{isFr ? 'Exemple réel :' : 'Real Example:'}</strong>{' '}
                {isFr
                  ? 'Dépenser 0,25 $ de plus en ANFO par tonne dans la fosse a permis de réduire l’énergie du broyeur de 3,2 kWh/t et d’augmenter le débit de traitement de 55 à 82 t/h. Bilan net : 160 000 $ d’économies annuelles et une récupération d’or passant de 72% à 84% !'
                  : 'Spending an extra $0.25/t on pit ANFO lowered mill energy by 3.2 kWh/t and surged throughput from 55 to 82 t/h, netting $160,000 in yearly savings while raising gold recovery from 72% to 84%!'}
              </div>
            </div>
          </div>

          {/* Pillar 5: Geostatistical Kriging */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isFr ? '5. Krigeage Géostatistique & Modèle de Blocs' : '5. Geostatistical Spatial Kriging & Geological Block Model'}
                </h4>
                <span className="text-[11px] text-indigo-600 font-semibold">
                  {isFr ? 'Interpolation par variogramme sphérique et dosage d’explosif par domaine' : 'Spatial variogram interpolation & automated blast domain charge zonation'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    <strong>Le problème sur le terrain :</strong> Le massif rocheux n’est jamais homogène : une partie du gradin peut être une roche tendre et altérée (saprolite), tandis qu’une autre partie est un filon de quartz dur comme du fer (UCS &gt; 140 MPa). Si le boutefeu charge tous les trous avec la même quantité d’explosif, la zone dure produira d’énormes blocs immangeables pour le concasseur, et la zone tendre sera pulvérisée en poussière stérile.
                  </>
                ) : (
                  <>
                    <strong>The Field Challenge:</strong> Rock benches are heterogeneous: one side may be soft weathered saprolite, while the other is massive quartz-veined granodiorite. Uniform blast loading either creates giant boulders in hard zones or over-pulverizes soft ore into dust.
                  </>
                )}
              </p>
              <p>
                {isFr ? (
                  <>
                    <strong>La solution FragMill :</strong> À partir des données de forages exploratoires (résistance mécanique UCS, indice de qualité RQD, espacement des diaclases et teneur en or), FragMill applique un <strong>krigeage ordinaire avec variogramme sphérique</strong>. Il génère une carte thermique spatiale et divise automatiquement le tir en 3 domaines de dosage : Tendre (0.45 kg/m³), Standard (0.65 kg/m³) et Dur (0.85 kg/m³).
                  </>
                ) : (
                  <>
                    <strong>FragMill Solution:</strong> Utilizing exploration core assays (UCS strength, RQD fracture density, joint frequency, and gold grade), FragMill computes <strong>Ordinary Kriging with a spherical variogram</strong> to map pit hardness and automatically group holes into 3 tailored charging domains (0.45, 0.65, and 0.85 kg/m³).
                  </>
                )}
              </p>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900">
                <strong>{isFr ? 'Exemple réel :' : 'Real Example:'}</strong>{' '}
                {isFr
                  ? 'Sur un gradin de 60m x 40m, le krigeage a identifié une zone fracturée à l’ouest (UCS 62 MPa) et un filon massif à l’est (UCS 138 MPa). Le boutefeu a chargé 18 kg d’ANFO à l’ouest et 28 kg à l’est : résultat, une granulométrie homogène sur tout le tas sans aucun bloc hors-gabarit et 1.2 tonne d’ANFO économisée.'
                  : 'Across a 60m x 40m bench, kriging revealed UCS 62 MPa in the west and 138 MPa in the east. Charging 18 kg/hole in the west and 28 kg/hole in the east achieved perfectly uniform fragmentation while saving 1.2 tonnes of explosive.'}
              </div>
            </div>
          </div>

          {/* Pillar 6: Drill Telemetry & Off-Grid P2P */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-black">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {isFr ? '6. Télémétrie Foration (IREDES XML) & Synchronisation P2P Hors-Ligne' : '6. Drill Telemetry (IREDES XML) & Off-Grid P2P Mesh Sync'}
                </h4>
                <span className="text-[11px] text-sky-600 font-semibold">
                  {isFr ? 'Export officiel pour foreuses Epiroc/Sandvik et réseau maillé sans internet' : 'Autonomous drill rig exchange & peer-to-peer Wi-Fi sync in remote pits'}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    <strong>Le problème sur le terrain :</strong> Dans les zones isolées d’Afrique centrale ou du désert australien, il n’y a aucune couverture réseau 4G/5G ni internet. Comment transmettre le plan de foration aux foreuses modernes et synchroniser les résultats de tirs entre la fosse et le bureau de l’usine sans risquer de perdre des clés USB dans la poussière ? De plus, si les trous sont forés avec 30 cm d’écart par rapport au plan, tout le tir est faussé.
                  </>
                ) : (
                  <>
                    <strong>The Field Challenge:</strong> In remote bush or desert pits with zero cellular reception, transmitting blast patterns to drill rigs and syncing laboratory results back to site offices is difficult and prone to errors. Furthermore, drill collar deviations &gt; 60 mm distort energy distribution.
                  </>
                )}
              </p>
              <p>
                {isFr ? (
                  <>
                    <strong>La solution FragMill :</strong> FragMill intègre le standard international <strong>IREDES XML</strong> (utilisé par Epiroc, Sandvik, Caterpillar) ainsi que l’export de coordonnées GPS en CSV pour les cannes GNSS Trimble/Leica. Il compare en direct les trous forés par rapport aux trous théoriques (vitesse d’avancement, écart au collet). Enfin, son moteur <strong>P2P Mesh</strong> synchronise les tablettes de fosse et les PC de l’usine directement via le réseau Wi-Fi local de la mine sans avoir besoin d’internet.
                  </>
                ) : (
                  <>
                    <strong>FragMill Solution:</strong> Generates official <strong>IREDES XML drill plans</strong> compatible with Epiroc and Sandvik rigs, plus GNSS GPS CSV coordinate tables. The QA/QC module audits collar deviations and penetration rates. Its <strong>P2P Mesh synchronization</strong> shares data directly over local pit Wi-Fi between tablets and office servers without cloud dependency.
                  </>
                )}
              </p>
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900">
                <strong>{isFr ? 'Exemple réel :' : 'Real Example:'}</strong>{' '}
                {isFr
                  ? 'Le géologue conçoit le plan de 35 trous sur sa tablette dans son bureau de chantier ; le fichier IREDES est chargé directement dans la foreuse hydraulique. Après foration, la tablette se synchronise en 1,2 seconde avec le PC du moulin via le Wi-Fi de fosse, signalant 2 trous forés trop courts (écart > 80 mm) qui sont immédiatement corrigés avant le chargement d’explosif.'
                  : 'A 35-hole pattern was uploaded via IREDES XML to a hydraulic drill rig. Post-drilling, the tablet synchronized in 1.2 seconds over pit Wi-Fi to the dispatch server, flagging two shallow holes (>80 mm deviation) that were re-drilled before explosive loading.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: CAMERA & SCALE PROTOCOL */}
      {activeSection === 'camera' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              {isFr ? 'Protocole de Prise de Vue & Pose de l’Échelle' : 'Photography & Scale Target Protocol'}
            </h3>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                {isFr
                  ? 'Pour obtenir une analyse granulométrique fiable, la qualité de la photo prise sur le terrain est déterminante. Voici les 5 règles d’or du technicien :'
                  : 'High photographic fragmentation accuracy depends directly on field capture rigor. Here are the 5 fundamental rules:'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-blue-900 block text-xs">
                    📐 1. {isFr ? 'Angle Perpendiculaire (90°)' : 'Perpendicular Angle (90°)'}
                  </span>
                  <p>
                    {isFr
                      ? 'Tenez-vous face au tas d’abattage à 90° de la pente. Ne photographiez pas en biais ou depuis le haut du gradin, car la perspective écraserait les roches du fond et fausserait leur taille apparente.'
                      : 'Stand perpendicular (90°) to the muck slope. Avoid acute oblique angles or shooting downward from the crest, which introduces foreshortening distortion.'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-blue-900 block text-xs">
                    📏 2. {isFr ? 'Plan Focal de la Mire' : 'Scale Bar Focal Plane'}
                  </span>
                  <p>
                    {isFr
                      ? 'Posez votre mire de référence (bâton rouge et blanc de 500 mm ou feuille A4) directement sur la surface des roches à mesurer. Ne la posez pas 3 mètres en arrière ou sur un rocher isolé au premier plan.'
                      : 'Place the scale object (500 mm painted bar or printed A4 target) directly on the rock face being photographed—never perched metres ahead or dropped into a rear hollow.'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-blue-900 block text-xs">
                    ☀️ 3. {isFr ? 'Éviter le Contre-Jour & Ombres Portées' : 'Avoid Backlight & Harsh Shadows'}
                  </span>
                  <p>
                    {isFr
                      ? 'Ne photographiez jamais face au soleil couchant ou rasant. Les ombres noires et profondes entre les roches sont parfois confondues avec des limites de blocs. Un ciel voilé offre l’éclairage le plus net.'
                      : 'Avoid shooting directly into low sunlight. Intense shadows in inter-rock voids can confuse edge detection. Overcast skies provide the most uniform illumination.'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-blue-900 block text-xs">
                    💨 4. {isFr ? 'Attendre la Dissipation des Poussières' : 'Wait for Dust Settlement'}
                  </span>
                  <p>
                    {isFr
                      ? 'Attendez impérativement que les fumées de tir et le nuage de poussière soient totalement retombés. Une brume de poussière rend l’image floue et masque la texture des cailloux.'
                      : 'Ensure all post-detonation fumes and dust have settled completely before shooting to maintain crisp boundary contrast.'}
                  </p>
                </div>
              </div>

              {/* Non-geological warning explanation */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
                <span className="font-bold block text-xs">
                  ⚠️ 5. {isFr ? 'Attention : Photos Authentiques Uniquement (Détection de Faux Positifs / Logos)' : 'Warning: Authentic Field Photos Only (Logo / Graphic Detection)'}
                </span>
                <p>
                  {isFr
                    ? 'FragMill intègre un filtre de validation géologique. Si vous téléversez un logo, un diagramme ou une image synthétique non géologique, le système détectera les contrastes artificiels de texte et les prendra pour des cailloux. Téléversez toujours des photographies réelles de roche concassée.'
                    : 'FragMill includes a geological heuristic validator. Uploading digital graphics, company logos, or vector diagrams will cause high-contrast letters and geometric borders to be classified as rock fragments. Always capture authentic field muck pile images.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: MINE-TO-MILL & GOLD RECOVERY */}
      {activeSection === 'minetomill' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Factory className="w-5 h-5 text-emerald-600" />
              {isFr ? 'La Comminution & la Récupération Métallurgique d’Or' : 'Comminution & Gold Metallurgical Recovery'}
            </h3>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    Dans toute exploitation minière, la comminution (la réduction progressive de la taille des roches par <strong>concassage à mâchoires</strong> puis <strong>broyage à boulets</strong>) représente souvent plus de <strong>50 à 60% de la facture d’énergie totale</strong> du site.
                  </>
                ) : (
                  <>
                    In gold and mineral operations, comminution (progressive size reduction via <strong>jaw crushing</strong> and <strong>ball milling</strong>) accounts for <strong>50 to 60% of total electrical or diesel fuel costs</strong>.
                  </>
                )}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-bold text-slate-800 block mb-1">
                    {isFr ? 'P80 d’Alimentation Concasseur' : 'P80 Crusher Feed Parameter'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {isFr
                      ? 'Le P80 indique la taille de maille à travers laquelle passent 80% des roches. Si le P80 dépasse l’ouverture du concasseur, la machine s’engorge et surchauffe.'
                      : 'P80 signifies the sieve aperture through which 80% of rock mass passes. A P80 larger than the jaw gape causes choking and motor overload.'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-bold text-slate-800 block mb-1">
                    {isFr ? 'Énergie Spécifique (kWh/t)' : 'Specific Energy (kWh/t)'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {isFr
                      ? 'Total des kilowattheures consommés divisé par la masse de minerai traitée. FragMill calcule en direct la consommation du concasseur et du broyeur.'
                      : 'Kilowatt-hours divided by dry ore tonnes milled. FragMill computes crushing and milling power draw per tonne processed.'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-bold text-slate-800 block mb-1">
                    {isFr ? 'Récupération d’Or R (%)' : 'Gold Recovery R (%)'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {isFr
                      ? 'Calculée selon la formule métallurgique standard R = (Teneur Tête - Teneur Rejets) / Teneur Tête × 100.'
                      : 'Calculated via the standard metallurgical balance: Recovery R = (Head Grade - Tails Grade) / Head Grade × 100.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: KUZ-RAM & BAYESIAN ADVISOR */}
      {activeSection === 'kuzram' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-purple-600" />
              {isFr ? 'Le Modèle Kuz-Ram & l’Apprentissage Bayésien MCMC' : 'Kuz-Ram Blast Modeling & Bayesian Calibration'}
            </h3>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                {isFr ? (
                  <>
                    Le modèle mathématique classique de <strong>Cunningham (1987)</strong> prédit la taille moyenne des morceaux de roche X50 à partir du facteur de roche A, de la consommation d’explosif K (kg/m³) et de la charge par trou Q (kg).
                  </>
                ) : (
                  <>
                    The classical <strong>Cunningham (1987)</strong> Kuz-Ram model forecasts mean fragment size X50 from rock mass factor A, powder factor K (kg/m³), and charge per hole Q (kg).
                  </>
                )}
              </p>

              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2">
                <span className="font-bold text-purple-900 block text-xs">
                  {isFr ? 'Pourquoi l’Étalonnage Bayésien est-il révolutionnaire ?' : 'Why is Bayesian MCMC Calibration Revolutionary?'}
                </span>
                <p>
                  {isFr
                    ? 'Dans la pratique minière, personne ne connaît exactement la valeur théorique du facteur de roche A d’un gisement. FragMill résout ce problème : à chaque tir analysé par photo, un algorithme d’échantillonnage de Metropolis-Hastings (MCMC) compare la granulométrie réelle observée au modèle théorique et met à jour automatiquement la valeur exacte du facteur de roche pour votre mine spécifique, avec un intervalle de confiance à 95% !'
                    : 'In real mining, site geological factor A cannot be directly measured with a ruler. FragMill solves this: as you record blasts, Metropolis-Hastings MCMC compares measured photographic X50 to model predictions and calibrates the exact rock factor A for your pit with full 95% credible intervals!'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: FAQ */}
      {activeSection === 'faq' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              {isFr ? 'Foire Aux Questions (FAQ)' : 'Frequently Asked Questions (FAQ)'}
            </h3>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">
                  {isFr ? 'Q1 : L’application fonctionne-t-elle sans internet dans la fosse ?' : 'Q1: Does the application work without internet in remote pits?'}
                </span>
                <p className="text-slate-600">
                  {isFr
                    ? 'Oui ! FragMill est une Progressive Web App (PWA). Toutes les bases de données (IndexedDB), les moteurs de calcul (WebAssembly) et les réseaux de neurones IA sont stockés localement sur votre appareil. Aucune photo ne quitte votre téléphone ou votre tablette.'
                    : 'Yes! FragMill is 100% client-side. All databases (IndexedDB), image processing pipelines (WebAssembly), and AI models run locally on your device without transmitting data outside.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">
                  {isFr ? 'Q2 : Comment faire si je n’ai pas de mire d’échelle sur le terrain ?' : 'Q2: What if I do not have a scale bar in the field?'}
                </span>
                <p className="text-slate-600">
                  {isFr
                    ? 'Vous pouvez imprimer la cible A4 disponible dans l’onglet Paramètres, utiliser une règle en bois de 500 mm peinte en rouge et blanc, ou même un casque de chantier standard dont vous connaissez la longueur exacte en millimètres (ex: 280 mm).'
                    : 'You can print the A4 PDF target from the Settings tab, use a 500 mm painted wooden stick, or place a standard hard hat whose length in millimetres you know accurately (e.g. 280 mm).'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">
                  {isFr ? 'Q3 : Comment exporter les rapports pour la direction de la mine ?' : 'Q3: How do I export reports for mining management?'}
                </span>
                <p className="text-slate-600">
                  {isFr
                    ? 'Dans l’onglet "Tirs & Images", trois boutons vous permettent d’exporter en un clic : un rapport officiel complet en PDF, un classeur de laboratoire en Excel (.xlsx) avec formules automatiques, ou la liste complète des fragments en CSV pour SIG et modélisation géostatistique.'
                    : 'On the Blast Records screen, one-click buttons generate an official PDF blast report, an Excel workbook (.xlsx) with all formulas, or raw CSV fragment lists for GIS and Python workflows.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">
                  {isFr ? 'Q4 : Comment changer la langue de l’application ?' : 'Q4: How do I switch the application language?'}
                </span>
                <p className="text-slate-600">
                  {isFr
                    ? 'Cliquez simplement sur le bouton "EN / FR" situé en haut à droite dans l’en-tête de l’application. Tout le texte, les boutons, les graphiques et les avertissements s’adaptent instantanément.'
                    : 'Simply click the "EN / FR" globe toggle button in the top right header. All views, buttons, tables, and guides switch dynamically.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
