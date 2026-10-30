import React, { useState } from 'react';
import type { Blast } from '../../types';
import {
  Flame,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Sliders,
  Calendar,
  Layers,
  Ruler,
  Zap,
  Save,
  CheckCircle2,
} from 'lucide-react';

export interface ActiveBlastBannerProps {
  blasts: Blast[];
  activeBlast: Blast;
  activeBlastId: string;
  onSelectBlast: (blastId: string) => void;
  onUpdateBlast?: (blast: Blast) => void;
  onNewBlast?: () => void;
  lang?: 'en' | 'fr';
}

export const ActiveBlastBanner: React.FC<ActiveBlastBannerProps> = ({
  blasts,
  activeBlast,
  activeBlastId,
  onSelectBlast,
  onUpdateBlast,
  onNewBlast,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveBlast = () => {
    if (onUpdateBlast) {
      onUpdateBlast(activeBlast);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`fragmill_blast_${activeBlast.id}`, JSON.stringify(activeBlast));
        localStorage.setItem('fragmill_last_active_blast_id', activeBlast.id);
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const burden = activeBlast.parameters.burden || 2.4;
  const spacing = activeBlast.parameters.spacing || 2.8;
  const benchHeight = activeBlast.parameters.benchHeight || 6.0;
  const holeVol = burden * spacing * benchHeight;
  const chargePerHole = activeBlast.parameters.chargePerHole || 22.0;
  const powderFactor = chargePerHole / Math.max(0.1, holeVol);
  const numberOfHoles = activeBlast.parameters.numberOfHoles || 30;
  const rockType = activeBlast.rockMass.rockType || (isFrench ? 'Granodiorite' : 'Granodiorite');
  const density = activeBlast.rockMass.density || 2.68;
  const ucs = activeBlast.rockMass.ucsMPa || 120;

  const currentIndex = blasts.findIndex((b) => b.id === activeBlastId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  const handlePrev = () => {
    if (safeIndex > 0) {
      onSelectBlast(blasts[safeIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (safeIndex < blasts.length - 1) {
      onSelectBlast(blasts[safeIndex + 1].id);
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 border border-slate-700/80 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Active Blast Identity & Geotechnical Badges */}
        <div className="space-y-2">
          {/* Active Status & Label */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              {isFrench ? "Tir actif en cours d'analyse" : 'Active blast under analysis'}
            </span>
            <span className="text-slate-500 text-[10px]">&bull;</span>
            <span className="text-[11px] font-bold text-slate-400">
              {isFrench ? `Tir ${safeIndex + 1} sur ${blasts.length}` : `Blast ${safeIndex + 1} of ${blasts.length}`}
            </span>
          </div>

          {/* Blast Title & Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-xl border border-slate-700">
              <Flame className="w-5 h-5 text-amber-400 shrink-0" />
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {activeBlast.blastId}
              </h2>
            </div>

            {/* Rock Type & Density Badge */}
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>{rockType} ({density} t/m³ &bull; {ucs} MPa)</span>
            </span>

            {/* Geometric Pattern Badge */}
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span>H: {benchHeight}m &bull; B×S: {burden}×{spacing}m &bull; {numberOfHoles} {isFrench ? 'trous' : 'holes'}</span>
            </span>

            {/* Powder Factor Badge */}
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>q = {powderFactor.toFixed(2)} kg/m³ ({activeBlast.parameters.explosiveType || 'ANFO'})</span>
            </span>

            {/* Date & Weather */}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{activeBlast.dateTime} &bull; {activeBlast.weather}</span>
            </span>
          </div>
        </div>

        {/* Right Side: Blast Switcher & Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1 shadow-inner">
            {/* Previous Blast Button */}
            <button
              onClick={handlePrev}
              disabled={safeIndex <= 0}
              title={isFrench ? 'Tir précédent' : 'Previous blast'}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition"
              aria-label={isFrench ? 'Tir précédent' : 'Previous blast'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Blast Selector Dropdown */}
            <div className="flex items-center gap-1.5 px-2">
              <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <label htmlFor="active-blast-select" className="sr-only">
                {isFrench ? 'Sélectionner le tir actif' : 'Select active blast'}
              </label>
              <select
                id="active-blast-select"
                value={activeBlastId}
                onChange={(e) => onSelectBlast(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-hidden cursor-pointer py-1 pr-1"
              >
                {blasts.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white font-medium">
                    {b.blastId} &bull; {b.rockMass.rockType} (H={b.parameters.benchHeight}m)
                  </option>
                ))}
              </select>
            </div>

            {/* Next Blast Button */}
            <button
              onClick={handleNext}
              disabled={safeIndex >= blasts.length - 1}
              title={isFrench ? 'Tir suivant' : 'Next blast'}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition"
              aria-label={isFrench ? 'Tir suivant' : 'Next blast'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Universal Save Blast Button */}
          <button
            onClick={handleSaveBlast}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black shadow-emerald-500/30'
            }`}
            title={isFrench ? 'Enregistrer les modifications du tir actif pour qu’elles persistent' : 'Save current blast modifications so they stay intact'}
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Enregistré !' : 'Saved !'}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Enregistrer le Tir' : 'Save Blast'}</span>
              </>
            )}
          </button>

          {/* Quick New Blast Button */}
          {onNewBlast && (
            <button
              onClick={onNewBlast}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isFrench ? 'Nouveau Tir' : 'New Blast'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
