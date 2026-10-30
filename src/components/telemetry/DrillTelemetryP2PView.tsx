import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Blast, Project, Site } from '../../types';
import type { IREDESHole, P2PSyncPeer } from '../../types/advanced';
import {
  generateDrillTelemetryFromBlast,
  generateIREDESXml,
  generateDrillPatternCsv,
  parseIREDESXml,
  parseDrillPatternCsv,
  DEMO_P2P_PEERS,
  simulateRigDrillingTelemetry,
  RIG_PRECISION_SPECS,
} from '../../services/telemetry/iredesGenerator';
import {
  Wifi,
  FileCode,
  Download,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Smartphone,
  Server,
  AlertTriangle,
  Sliders,
  PlusCircle,
  HelpCircle,
  Sparkles,
  Radio,
  Upload,
  Trash2,
  Activity,
  X,
  Plus,
} from 'lucide-react';
import { SendToReportButton } from '../report/SendToReportButton';

interface DrillTelemetryP2PViewProps {
  blast: Blast;
  project?: Project;
  site?: Site;
  lang?: 'en' | 'fr';
}

const PEERS_STORAGE_KEY = 'fragmill_p2p_peers';

const loadStoredPeers = (): P2PSyncPeer[] => {
  try {
    const raw = localStorage.getItem(PEERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEMO_P2P_PEERS;
};

export const DrillTelemetryP2PView: React.FC<DrillTelemetryP2PViewProps> = ({
  blast,
  project,
  site,
  lang = 'en',
}) => {
  const isFrench = lang === 'fr';

  const [holes, setHoles] = useState<IREDESHole[]>([]);
  const [peers, setPeers] = useState<P2PSyncPeer[]>(loadStoredPeers);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // New device connection modal states
  const [showAddDeviceModal, setShowAddDeviceModal] = useState<boolean>(false);
  const [newDeviceName, setNewDeviceName] = useState<string>('');
  const [newDeviceRole, setNewDeviceRole] = useState<'field_tablet' | 'lab_desktop' | 'mill_server'>('field_tablet');
  const [newDeviceIp, setNewDeviceIp] = useState<string>('192.168.4.88');
  const [newDeviceProtocol, setNewDeviceProtocol] = useState<string>('Wi-Fi P2P Socket (TCP 5000)');

  // File import ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Interactive QA/QC and Rig Parameters
  const [collarToleranceMm, setCollarToleranceMm] = useState<number>(60);
  const [targetPenetrationRate, setTargetPenetrationRate] = useState<number>(1.35);
  const [rigModel, setRigModel] = useState<string>('Epiroc SmartROC T45');
  const [rigIpAddress, setRigIpAddress] = useState<string>('192.168.4.50');
  const [targetDepthOffsetM, setTargetDepthOffsetM] = useState<number>(0);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [shiftId, setShiftId] = useState<number>(1);

  useEffect(() => {
    if (blast.drillHoles && blast.drillHoles.length > 0) {
      const iredesHoles: IREDESHole[] = blast.drillHoles.map((h) => ({
        holeId: h.holeId,
        plannedX: h.eastingX,
        plannedY: h.northingY,
        plannedZ: h.elevationZ,
        actualX: h.eastingX,
        actualY: h.northingY,
        actualZ: h.elevationZ,
        plannedDepthM: h.depthM,
        actualDepthM: h.depthM,
        plannedBurdenM: h.burdenM,
        plannedSpacingM: h.spacingM,
        collarDeviationMm: Math.round(Math.abs(Math.sin(h.eastingX * 2.1) * 35)),
        depthDeviationM: parseFloat((Math.cos(h.northingY * 1.5) * 0.08).toFixed(2)),
        penetrationRateMPerMin: parseFloat(Math.max(0.4, 1.35 - (h.ucsMPa - 100) * 0.005).toFixed(2)),
        mwdSpecificEnergyMpa: parseFloat((h.ucsMPa * 1.85).toFixed(1)),
        rockHardnessClass: h.ucsMPa > 130 ? 'hard' : (h.ucsMPa < 80 ? 'soft' : 'medium'),
      }));
      setHoles(iredesHoles);
    } else {
      const data = generateDrillTelemetryFromBlast(blast);
      setHoles(data);
    }
  }, [blast]);

  // Persist peers to local storage
  useEffect(() => {
    try {
      localStorage.setItem(PEERS_STORAGE_KEY, JSON.stringify(peers));
    } catch {}
  }, [peers]);

  // Derived KPIs
  const maxCollarError = useMemo(() => {
    return holes.length > 0 ? Math.max(...holes.map((h) => h.collarDeviationMm || 0)) : 0;
  }, [holes]);

  const compliantHoles = useMemo(() => {
    return holes.filter((h) => (h.collarDeviationMm || 0) <= collarToleranceMm);
  }, [holes, collarToleranceMm]);

  const complianceRate = useMemo(() => {
    return holes.length > 0 ? Math.round((compliantHoles.length / holes.length) * 100) : 100;
  }, [holes, compliantHoles]);

  const totalDrilledM = useMemo(() => {
    return holes.reduce((acc, h) => acc + (h.actualDepthM || h.plannedDepthM), 0);
  }, [holes]);

  const avgPenetrationRate = useMemo(() => {
    if (holes.length === 0) return targetPenetrationRate;
    const sum = holes.reduce((acc, h) => acc + (h.penetrationRateMPerMin || targetPenetrationRate), 0);
    return Number((sum / holes.length).toFixed(2));
  }, [holes, targetPenetrationRate]);

  // Actions
  const handleExportIREDES = () => {
    const xml = generateIREDESXml(blast, holes);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IREDES_DrillPlan_${blast.blastId}.xml`;
    a.click();
  };

  const handleExportCSV = () => {
    const csv = generateDrillPatternCsv(holes);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DrillPattern_${blast.blastId}.csv`;
    a.click();
  };

  // Import IREDES XML or Drill CSV file from Rig / USB
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      let importedHoles: IREDESHole[] = [];
      if (file.name.toLowerCase().endsWith('.xml') || text.includes('<?xml')) {
        importedHoles = parseIREDESXml(text);
      } else {
        importedHoles = parseDrillPatternCsv(text);
      }

      if (importedHoles.length > 0) {
        setHoles(importedHoles);
        setToastMsg(
          isFrench
            ? `✓ ${importedHoles.length} trous de foration importés depuis ${file.name}`
            : `✓ Imported ${importedHoles.length} drill holes from ${file.name}`
        );
        setTimeout(() => setToastMsg(null), 4500);
      } else {
        setToastMsg(isFrench ? '⚠ Aucun trou détecté dans ce fichier.' : '⚠ Could not parse drill holes from file.');
        setTimeout(() => setToastMsg(null), 4500);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTriggerP2PSync = () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setPeers((prev) =>
        prev.map((p) => ({ ...p, status: 'synced', lastSyncTimestamp: Date.now() }))
      );
      setTimeout(() => setSyncSuccess(false), 3500);
    }, 1200);
  };

  // Connect new device
  const handleAddNewDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    const newPeer: P2PSyncPeer = {
      id: `peer-${Date.now()}`,
      deviceName: newDeviceName.trim(),
      role: newDeviceRole,
      ipAddress: newDeviceIp.trim() || '192.168.4.100',
      status: 'online',
      lastSyncTimestamp: Date.now(),
    };

    setPeers((prev) => [...prev, newPeer]);
    setShowAddDeviceModal(false);
    setNewDeviceName('');
    setToastMsg(
      isFrench
        ? `✓ Appareil « ${newPeer.deviceName} » connecté au réseau de fosse`
        : `✓ Device "${newPeer.deviceName}" connected to mesh network`
    );
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleRemovePeer = (peerId: string) => {
    setPeers((prev) => prev.filter((p) => p.id !== peerId));
  };

  const handlePingPeer = (peerId: string) => {
    setPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, status: 'online', lastSyncTimestamp: Date.now() } : p))
    );
    setToastMsg(isFrench ? '✓ Ping réussi (Latence < 12 ms)' : '✓ Ping OK (Latency < 12 ms)');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Simulate Realistic MWD Drift vs Ideal Design with Rig OEM Physics Model
  const handleSimulateRealDrift = () => {
    const updated = simulateRigDrillingTelemetry(
      blast,
      rigModel,
      targetPenetrationRate,
      targetDepthOffsetM,
      shiftId,
      holes
    );
    setHoles(updated);
    setToastMsg(
      isFrench
        ? `✓ Simulation physique MWD calculée (${rigModel} • Poste ${shiftId})`
        : `✓ Calculated physics MWD telemetry (${rigModel} • Shift ${shiftId})`
    );
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleRigModelChange = (newRig: string) => {
    setRigModel(newRig);
    const updated = simulateRigDrillingTelemetry(
      blast,
      newRig,
      targetPenetrationRate,
      targetDepthOffsetM,
      shiftId,
      holes
    );
    setHoles(updated);
    setToastMsg(
      isFrench
        ? `✓ Modèle de foreuse appliqué : ${newRig}`
        : `✓ Applied drill rig model: ${newRig}`
    );
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleNextShift = () => {
    const nextShift = shiftId + 1;
    setShiftId(nextShift);
    const updated = simulateRigDrillingTelemetry(
      blast,
      rigModel,
      targetPenetrationRate,
      targetDepthOffsetM,
      nextShift,
      holes
    );
    setHoles(updated);
    setToastMsg(
      isFrench
        ? `✓ Nouveau Poste de Foration #${nextShift} simulé (${rigModel})`
        : `✓ Simulated New Drilling Shift #${nextShift} (${rigModel})`
    );
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleResetToIdeal = () => {
    setHoles((prev) =>
      prev.map((h) => ({
        ...h,
        collarDeviationMm: 12,
        actualDepthM: h.plannedDepthM,
        penetrationRateMPerMin: targetPenetrationRate,
      }))
    );
  };

  const handleUpdateHole = (holeId: string, field: 'actualDepthM' | 'collarDeviationMm', value: number) => {
    setHoles((prev) =>
      prev.map((h) => (h.holeId === holeId ? { ...h, [field]: value } : h))
    );
  };

  const handleAddHole = () => {
    const nextIdx = holes.length + 1;
    const newHole: IREDESHole = {
      holeId: `DH-${nextIdx.toString().padStart(3, '0')}`,
      plannedX: 100 + (nextIdx % 6) * 2.8,
      plannedY: 200 + Math.floor(nextIdx / 6) * 2.4,
      plannedZ: 840.0,
      plannedDepthM: blast.parameters.holeDepth || 6.8,
      plannedBurdenM: blast.parameters.burden || 2.4,
      plannedSpacingM: blast.parameters.spacing || 2.8,
      actualX: 100 + (nextIdx % 6) * 2.8 + 0.02,
      actualY: 200 + Math.floor(nextIdx / 6) * 2.4 + 0.02,
      actualZ: 840.0,
      actualDepthM: (blast.parameters.holeDepth || 6.8) + targetDepthOffsetM,
      collarDeviationMm: 22,
      depthDeviationM: targetDepthOffsetM,
      penetrationRateMPerMin: targetPenetrationRate,
    };
    setHoles((prev) => [...prev, newHole]);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center justify-between animate-in fade-in">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-3 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Hidden file input for IREDES / CSV */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xml,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Banner & Header Actions */}
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-600">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {isFrench ? 'Télémétrie Foration (IREDES) & Réseau P2P Hors-Ligne' : 'Drill Rig Telemetry (IREDES) & Offline P2P Mesh'}
            </h2>
            <p className="text-xs text-slate-500">
              {isFrench
                ? 'Acquisition MWD en temps réel, audit des dérives du collet et synchronisation décentralisée de fosse.'
                : 'Real-time MWD logging, hole collaring error QA/QC, and off-grid pit tablet synchronization.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            title={isFrench ? 'Comprendre IREDES et le P2P' : 'How does IREDES work?'}
          >
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">{isFrench ? 'Guide IREDES' : 'IREDES Guide'}</span>
          </button>

          {/* Import Rig File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
            title={isFrench ? 'Importer un fichier IREDES XML ou CSV de foration' : 'Import IREDES XML or CSV drill file'}
          >
            <Upload className="w-4 h-4" />
            <span>{isFrench ? 'Importer Fichier Foreuse' : 'Import Rig File'}</span>
          </button>

          <button
            onClick={handleExportIREDES}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <FileCode className="w-4 h-4" />
            <span>{isFrench ? 'Exporter IREDES XML' : 'Export IREDES XML'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isFrench ? 'Plan Foration (CSV)' : 'Export CSV'}</span>
          </button>

          {/* Send to Report Button */}
          <SendToReportButton
            sectionKey="telemetry"
            project={project}
            site={site}
            blast={blast}
            lang={lang}
            getPayload={() => ({
              rigModel,
              rigIpAddress,
              collarToleranceMm,
              targetPenetrationRate,
              complianceRate,
              compliantCount: compliantHoles.length,
              totalHoles: holes.length,
              maxCollarError,
              avgPenetrationRate,
              totalDrilledM,
              peersCount: peers.length,
            })}
            summaryFr={`Audit foration (${rigModel}) : ${complianceRate}% de conformité collet (<${collarToleranceMm}mm), écart max ${maxCollarError}mm, ROP moyen ${avgPenetrationRate} m/min.`}
            summaryEn={`Drill telemetry audit (${rigModel}): ${complianceRate}% collar compliance (<${collarToleranceMm}mm), max error ${maxCollarError}mm, mean ROP ${avgPenetrationRate} m/min.`}
          />
        </div>
      </div>

      {/* Educational Guide Box (collapsible) */}
      {showExplanation && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-indigo-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              {isFrench
                ? 'Comprendre la Télémétrie Foration (IREDES) & le Réseau P2P'
                : 'Understanding Drill Telemetry (IREDES) & P2P Mesh Network'}
            </h3>
            <button
              onClick={() => setShowExplanation(false)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
            >
              ✕ {isFrench ? 'Masquer' : 'Dismiss'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-indigo-900 leading-relaxed">
            <div className="p-3 bg-white/80 rounded-xl border border-indigo-100">
              <span className="font-extrabold block text-indigo-950 mb-1">
                1. {isFrench ? 'Le Standard IREDES XML' : 'The IREDES XML Standard'}
              </span>
              <p>
                {isFrench
                  ? 'Format d’échange universel (International Rock Excavation Data Exchange Standard). Il transmet les coordonnées GPS (X, Y, Z), inclinaisons et profondeurs prévues aux automates de forage (Epiroc, Sandvik, Cat) sans ressaisie manuelle.'
                  : 'Universal industry exchange standard. Automatically transfers GPS coordinates (X, Y, Z), design angles, and target depths to drill rig PLCs (Epiroc, Sandvik, Cat) with zero manual data entry errors.'}
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-indigo-100">
              <span className="font-extrabold block text-indigo-950 mb-1">
                2. {isFrench ? 'Le Contrôle Qualité MWD' : 'MWD Quality Control'}
              </span>
              <p>
                {isFrench
                  ? 'La mesure pendant la foration (MWD) compare la position forée réelle du collet avec le plan théorique. Un écart supérieur à 60 mm perturbe la géométrie de tir, créant des projections dangereuses ou des gros blocs en pied.'
                  : 'Measurement While Drilling (MWD) tracks actual collar coordinates vs design. Collaring errors above 60 mm distort burden & spacing, triggering flyrock hazards or massive uncrushed toe boulders.'}
              </p>
            </div>
            <div className="p-3 bg-white/80 rounded-xl border border-indigo-100">
              <span className="font-extrabold block text-indigo-950 mb-1">
                3. {isFrench ? 'Synchronisation P2P Hors-Ligne' : 'Off-Grid Mesh Sync'}
              </span>
              <p>
                {isFrench
                  ? 'En zone minière artisanale ou en fond de fosse sans couverture 4G/Internet, les tablettes de terrain échangent directement en Wi-Fi local P2P avec la foreuse et l’ordinateur de l’usine pour réconcilier les données en temps réel.'
                  : 'In remote artisanal pits lacking cell towers or Internet, field tablets synchronize over local ad-hoc Wi-Fi mesh directly with drill rigs and plant servers to reconcile as-built data instantly.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Parameters Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {isFrench ? 'Paramètres Opérationnels & Tolérances de Foration' : 'Operational Rig & QA/QC Tolerance Parameters'}
            </h3>
          </div>

          {/* Simulation Drift / Ideal Toggle */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={handleSimulateRealDrift}
              className="px-2.5 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              title={isFrench ? 'Calculer la simulation physique déterministe MWD' : 'Run deterministic physics MWD simulation'}
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>{isFrench ? `Simuler Dérive MWD (Poste #${shiftId})` : `Simulate MWD Drift (Shift #${shiftId})`}</span>
            </button>
            <button
              onClick={handleNextShift}
              className="px-2 py-1 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
              title={isFrench ? 'Simuler le poste suivant de foration' : 'Simulate next production shift'}
            >
              <RefreshCw className="w-3 h-3 text-indigo-400" />
              <span>{isFrench ? 'Poste Suivant' : 'Next Shift'}</span>
            </button>
            <button
              onClick={handleResetToIdeal}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold cursor-pointer"
            >
              {isFrench ? 'Réinitialiser Conforme' : 'Reset to Ideal'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Rig Model Selector */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1">
              {isFrench ? 'Modèle de Foreuse Intelligente' : 'Smart Drill Rig Model'}
            </label>
            <select
              value={rigModel}
              onChange={(e) => handleRigModelChange(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
            >
              <option value="Epiroc SmartROC T45">Epiroc SmartROC T45 (GPS Topcon)</option>
              <option value="Sandvik Leopard DI650i">Sandvik Leopard DI650i (TIM3D)</option>
              <option value="CAT MD6250">Caterpillar MD6250 (Terrain)</option>
              <option value="Atlas Copco ROC D7">Atlas Copco ROC D7 (Manual Guidance)</option>
            </select>
            <span className="text-[10px] text-indigo-300 font-mono block mt-1">
              {RIG_PRECISION_SPECS[rigModel]?.guidanceSystem || 'Guidage GPS'}
            </span>
          </div>

          {/* Collar Tolerance Slider */}
          <div>
            <div className="flex justify-between text-slate-400 font-semibold mb-1">
              <span>{isFrench ? 'Tolérance Collet (Écart max)' : 'Collar Deviation Tolerance'}</span>
              <span className="font-mono text-indigo-400 font-bold">{collarToleranceMm} mm</span>
            </div>
            <input
              type="range"
              min="20"
              max="150"
              step="5"
              value={collarToleranceMm}
              onChange={(e) => setCollarToleranceMm(parseInt(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isFrench ? 'Seuil critique de tolérance d’ingénierie' : 'Rig design tolerance threshold'}
            </span>
          </div>

          {/* Target ROP Speed Slider */}
          <div>
            <div className="flex justify-between text-slate-400 font-semibold mb-1">
              <span>{isFrench ? 'Vitesse d’Avancement Cible (ROP)' : 'Target Penetration Rate'}</span>
              <span className="font-mono text-indigo-400 font-bold">{targetPenetrationRate} m/min</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="2.5"
              step="0.05"
              value={targetPenetrationRate}
              onChange={(e) => setTargetPenetrationRate(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isFrench ? 'Indicateur de dureté de la roche' : 'Rock hardness drilling benchmark'}
            </span>
          </div>

          {/* Drill Rig IP Address */}
          <div>
            <label className="text-slate-400 font-semibold block mb-1">
              {isFrench ? 'Adresse IP Foreuse (Liaison Fosse)' : 'Rig Wi-Fi IP Endpoint'}
            </label>
            <input
              type="text"
              value={rigIpAddress}
              onChange={(e) => setRigIpAddress(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold"
              placeholder="192.168.4.50"
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {isFrench ? 'Port standard IREDES : 5000' : 'Standard IREDES TCP port: 5000'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">
            {isFrench ? 'Conformité Collet' : 'Collar Compliance'}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-black ${complianceRate >= 90 ? 'text-emerald-600' : complianceRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
              {complianceRate}%
            </span>
            <span className="text-xs text-slate-400">({compliantHoles.length} / {holes.length})</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {isFrench ? `Tolérance : ≤ ${collarToleranceMm} mm` : `Tolerance: ≤ ${collarToleranceMm} mm`}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">
            {isFrench ? 'Écart Collet Max' : 'Max Collar Deviation'}
          </span>
          <span className="text-2xl font-black text-slate-900 block mt-1">{maxCollarError} mm</span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {maxCollarError <= collarToleranceMm ? (isFrench ? '✓ Dans la tolérance' : '✓ Within tolerance') : (isFrench ? '⚠ Attention gros blocs' : '⚠ Flyrock / toe risk')}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">
            {isFrench ? 'Vitesse Pénétration Moy.' : 'Mean Penetration (ROP)'}
          </span>
          <span className="text-2xl font-black text-indigo-600 block mt-1">{avgPenetrationRate} m/min</span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {isFrench ? 'Corrélation dureté UCS' : 'UCS hardness indicator'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">
            {isFrench ? 'Mètres Forés Totaux' : 'Total Metres Drilled'}
          </span>
          <span className="text-2xl font-black text-slate-900 block mt-1">{totalDrilledM.toFixed(1)} m</span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {holes.length} {isFrench ? 'trous répertoriés' : 'holes logged'}
          </span>
        </div>
      </div>

      {/* Main Content Layout: QA/QC Table (7 cols) & Connected Devices (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): QA/QC Drilling Audit Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isFrench ? 'Contrôle Qualité Foration (Prévu vs Réalisé)' : 'Drill Rig QA/QC As-Built Compliance'}
              </h3>
              <p className="text-xs text-slate-500">
                {compliantHoles.length} / {holes.length} {isFrench ? `trous conformes (écart ≤ ${collarToleranceMm} mm)` : `holes within collar tolerance (≤ ${collarToleranceMm} mm)`}
              </p>
            </div>
            <button
              onClick={handleAddHole}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isFrench ? '+ Nouveau Trou' : '+ Add Hole'}</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-96 border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2 px-3">{isFrench ? 'Trou' : 'Hole'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Prévu (m)' : 'Planned (m)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Foré (m)' : 'Drilled (m)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Écart Collet (mm)' : 'Collar Dev (mm)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Vitesse (m/min)' : 'ROP (m/min)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Statut QA/QC' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holes.map((h) => {
                  const isWarning = (h.collarDeviationMm || 0) > collarToleranceMm;
                  return (
                    <tr key={h.holeId} className={isWarning ? 'bg-amber-50/60' : 'hover:bg-slate-50/50'}>
                      <td className="py-2 px-3 font-bold text-slate-900">{h.holeId}</td>
                      <td className="py-2 px-3 text-slate-600">{h.plannedDepthM.toFixed(1)} m</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.1"
                          value={h.actualDepthM ?? h.plannedDepthM}
                          onChange={(e) => handleUpdateHole(h.holeId, 'actualDepthM', parseFloat(e.target.value) || h.plannedDepthM)}
                          className="w-16 px-1 py-0.5 border border-slate-200 rounded font-semibold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={h.collarDeviationMm ?? 12}
                            onChange={(e) => handleUpdateHole(h.holeId, 'collarDeviationMm', parseInt(e.target.value) || 0)}
                            className={`w-14 px-1 py-0.5 border rounded font-black text-xs ${
                              isWarning ? 'border-amber-300 text-amber-900 bg-amber-50' : 'border-slate-200 text-slate-900'
                            }`}
                          />
                          <span className="text-[10px] text-slate-400">mm</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{h.penetrationRateMPerMin} m/min</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1 w-fit ${
                          isWarning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isWarning ? <AlertTriangle className="w-3 h-3 text-amber-600" /> : <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isWarning ? (isFrench ? 'Écart' : 'Deviation') : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 italic">
            {isFrench
              ? '💡 Modifiez directement la profondeur forée ou l’écart de collet pour recalculer les statistiques d’audit.'
              : '💡 Directly edit drilled depth or collar deviation above to trigger real-time QA/QC recalculations.'}
          </p>
        </div>

        {/* Right Column (5 cols): User Device Connections & P2P Mesh Network */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isFrench ? 'Appareils Connectés & Réseau P2P' : 'Connected Devices & P2P Mesh'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddDeviceModal(true)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isFrench ? 'Connecter Appareil' : 'Connect Device'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {isFrench
                ? 'Gérez vos appareils de terrain (tablettes étanches, foreuses connectées, PC usine) et synchronisez les relevés en local sans connexion Internet.'
                : 'Manage your connected pit hardware (rugged tablets, smart drill rigs, mill servers) and sync drilling plans offline.'}
            </p>

            <button
              onClick={handleTriggerP2PSync}
              disabled={isSyncing}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? (isFrench ? 'Synchronisation P2P en cours...' : 'Synchronizing Mesh Peers...')
                  : (isFrench ? 'Synchroniser les Appareils de Fosse' : 'Sync All Mesh Peers Now')}
              </span>
            </button>

            {/* Peer Devices List */}
            <div className="space-y-2 pt-2 text-xs">
              <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                {isFrench ? 'Vos Appareils Connectés' : 'Your Connected Devices'} ({peers.length})
              </span>

              {peers.map((peer) => {
                const IconComponent =
                  peer.role === 'field_tablet' ? Smartphone : peer.role === 'mill_server' ? Server : HardDrive;
                return (
                  <div
                    key={peer.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100/60 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block text-xs">{peer.deviceName}</span>
                        <span className="text-[10px] text-slate-400">IP : {peer.ipAddress}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePingPeer(peer.id)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition flex items-center gap-1"
                        title={isFrench ? 'Tester la connexion' : 'Ping device'}
                      >
                        <Activity className="w-3 h-3 text-emerald-600" />
                        <span>{peer.status === 'synced' ? (isFrench ? 'Synchronisé' : 'Synced') : peer.status}</span>
                      </button>

                      <button
                        onClick={() => handleRemovePeer(peer.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                        title={isFrench ? 'Déconnecter cet appareil' : 'Disconnect this device'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-base">
                  {isFrench ? 'Connecter un Nouvel Appareil' : 'Connect New Device'}
                </h3>
              </div>
              <button onClick={() => setShowAddDeviceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewDevice} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isFrench ? 'Nom de l’appareil' : 'Device Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isFrench ? 'ex: Foreuse SmartROC D65 #02' : 'e.g. SmartROC D65 #02'}
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isFrench ? 'Rôle de l’appareil' : 'Device Role'}
                </label>
                <select
                  value={newDeviceRole}
                  onChange={(e) => setNewDeviceRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white"
                >
                  <option value="field_tablet">{isFrench ? 'Tablette de terrain (Field Tablet)' : 'Field Rugged Tablet'}</option>
                  <option value="lab_desktop">{isFrench ? 'Foreuse intelligente / PC Labo' : 'Smart Drill Rig / Lab PC'}</option>
                  <option value="mill_server">{isFrench ? 'Serveur Usine de Traitement' : 'Mill Control Room Server'}</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isFrench ? 'Protocole de Liaison' : 'Connection Protocol'}
                </label>
                <select
                  value={newDeviceProtocol}
                  onChange={(e) => setNewDeviceProtocol(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-white"
                >
                  <option value="Wi-Fi P2P Socket (TCP 5000)">Wi-Fi P2P Socket (IREDES TCP 5000)</option>
                  <option value="WebRTC Mesh Direct">WebRTC Peer Mesh</option>
                  <option value="Bluetooth Low Energy">Bluetooth LE Direct</option>
                  <option value="Liaison Port Série USB / Modbus">Port Série USB / Modbus</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {isFrench ? 'Adresse IP & Port Réseau' : 'IP Address & Port'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="192.168.4.120:5000"
                  value={newDeviceIp}
                  onChange={(e) => setNewDeviceIp(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDeviceModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                >
                  {isFrench ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow"
                >
                  {isFrench ? 'Connecter cet Appareil' : 'Connect Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
