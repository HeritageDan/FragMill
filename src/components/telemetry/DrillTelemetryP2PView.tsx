import React, { useState, useEffect } from 'react';
import type { Blast } from '../../types';
import type { IREDESHole, P2PSyncPeer } from '../../types/advanced';
import {
  generateDrillTelemetryFromBlast,
  generateIREDESXml,
  generateDrillPatternCsv,
  DEMO_P2P_PEERS,
} from '../../services/telemetry/iredesGenerator';
import {
  Wifi,
  FileCode,
  Download,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Cpu,
  Smartphone,
  Server,
  AlertTriangle,
} from 'lucide-react';

interface DrillTelemetryP2PViewProps {
  blast: Blast;
  lang?: 'en' | 'fr';
}

export const DrillTelemetryP2PView: React.FC<DrillTelemetryP2PViewProps> = ({ blast, lang = 'en' }) => {
  const isFrench = lang === 'fr';

  const [holes, setHoles] = useState<IREDESHole[]>([]);
  const [peers, setPeers] = useState<P2PSyncPeer[]>(DEMO_P2P_PEERS);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);

  useEffect(() => {
    const data = generateDrillTelemetryFromBlast(blast);
    setHoles(data);
  }, [blast]);

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

  const handleTriggerP2PSync = () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setPeers((prev) =>
        prev.map((p) => ({ ...p, status: 'synced', lastSyncTimestamp: Date.now() }))
      );
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 1200);
  };

  const maxCollarError = holes.length > 0 ? Math.max(...holes.map((h) => h.collarDeviationMm || 0)) : 0;
  const compliantCount = holes.filter((h) => (h.collarDeviationMm || 0) <= 60).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {isFrench ? 'Télémétrie Foration (IREDES) & Sync P2P Hors-Ligne' : 'Drill Telemetry (IREDES) & Off-Grid P2P Mesh Sync'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                Epiroc / Sandvik / WebRTC
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFrench
                ? 'Export officiel IREDES XML pour foreuses autonomes et synchronisation locale décentralisée sans internet'
                : 'Direct IREDES XML exchange for smart autonomous drill rigs and local P2P offline mesh synchronization'}
            </p>
          </div>
        </div>

        {/* Global Export Actions */}
        <div className="flex items-center gap-2">
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
            <span>{isFrench ? 'Plan Foration (CSV/GPS)' : 'Export CSV (GPS)'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Drill Rig Telemetry Table, Right P2P Offline Mesh Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Drill Rig As-Built QA/QC Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isFrench ? 'Contrôle Qualité Foration (Prévu vs Réalisé)' : 'Drill Rig QA/QC As-Built Compliance'}
              </h3>
              <p className="text-xs text-slate-500">
                {compliantCount} / {holes.length} {isFrench ? 'trous conformes (écart < 60 mm)' : 'holes within collar tolerance (< 60 mm)'}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700">
              {isFrench ? 'Écart Max :' : 'Max Error:'} <b className={maxCollarError > 80 ? 'text-amber-600' : 'text-slate-900'}>{maxCollarError} mm</b>
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">{isFrench ? 'Trou' : 'Hole'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Prévu (m)' : 'Planned (m)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Foré (m)' : 'Drilled (m)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Écart Collet (mm)' : 'Collar Dev (mm)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Vitesse (m/min)' : 'Penetration (m/min)'}</th>
                  <th className="py-2 px-3">{isFrench ? 'Statut' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holes.map((h) => {
                  const isWarning = (h.collarDeviationMm || 0) > 60;
                  return (
                    <tr key={h.holeId} className={isWarning ? 'bg-amber-50/50' : ''}>
                      <td className="py-2 px-3 font-bold text-slate-900">{h.holeId}</td>
                      <td className="py-2 px-3 text-slate-600">{h.plannedDepthM.toFixed(1)} m</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{h.actualDepthM?.toFixed(1) || '-'} m</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{h.collarDeviationMm} mm</td>
                      <td className="py-2 px-3 text-slate-600">{h.penetrationRateMPerMin} m/min</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isWarning ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isWarning ? (isFrench ? 'Écart' : 'Deviation') : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (5 cols): P2P Mesh Network Sync */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isFrench ? 'Réseau Maillé P2P Sans Internet' : 'Off-Grid P2P Mesh Network'}
                </h3>
              </div>
              {syncSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {isFrench ? 'Synchronisé' : 'Synced'}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {isFrench
                ? 'Synchronisation directe en Wi-Fi de fosse entre tablettes de terrain et PC de l’usine sans connexion Internet.'
                : 'Direct Wi-Fi peer-to-peer data sync between pit tablets and processing plant PCs without cloud dependency.'}
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
                {isFrench ? 'Appareils Connectés Détectés' : 'Active Discovered Peers'} ({peers.length})
              </span>

              {peers.map((peer) => {
                const IconComponent =
                  peer.role === 'field_tablet' ? Smartphone : peer.role === 'mill_server' ? Server : HardDrive;
                return (
                  <div
                    key={peer.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {peer.status === 'synced' ? (isFrench ? 'Synchronisé' : 'Synced') : peer.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
