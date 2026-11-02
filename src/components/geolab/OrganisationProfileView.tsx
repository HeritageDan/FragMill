import React, { useState, useEffect } from 'react';
import { getOrganisationProfile, saveOrganisationProfile } from '../../db';
import type { OrganisationProfile, StandardBody, ApprovalChainEntry } from '../../types/geolab';
import {
  Building2,
  Save,
  CheckCircle2,
  Upload,
  Palette,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  FileText,
  FileCode,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
}

export const OrganisationProfileView: React.FC<Props> = ({ language }) => {
  const [profile, setProfile] = useState<OrganisationProfile | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    getOrganisationProfile().then((p) => {
      // Ensure approvalChain exists
      if (!p.approvalChain || p.approvalChain.length === 0) {
        const defaultChain: ApprovalChainEntry[] = (p.signatories && p.signatories.length > 0)
          ? p.signatories.slice(0, 6).map((s, idx) => ({
              id: `sig-${idx + 1}`,
              roleLabel: {
                en: s.role === 'prepared' ? 'Tested by' : s.role === 'checked' ? 'Checked by' : 'Approved by',
                fr: s.role === 'prepared' ? 'Essai réalisé par' : s.role === 'checked' ? 'Vérifié par' : 'Approuvé par',
              },
              name: s.name,
              title: s.title,
              stampOrSignatureBase64: s.stampOrSignatureBase64,
            }))
          : [
              { id: 'sig-1', roleLabel: { en: 'Tested by', fr: 'Essai réalisé par' }, name: '', title: '' },
              { id: 'sig-2', roleLabel: { en: 'Checked by', fr: 'Vérifié par' }, name: '', title: '' },
              { id: 'sig-3', roleLabel: { en: 'Approved by', fr: 'Approuvé par' }, name: '', title: '' },
            ];
        setProfile({ ...p, approvalChain: defaultChain });
      } else {
        setProfile(p);
      }
    });
  }, []);

  if (!profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveOrganisationProfile(profile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'main' | 'left' | 'center' | 'right'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      if (type === 'main') {
        setProfile({ ...profile, logoBase64: b64 });
      } else {
        setProfile({
          ...profile,
          headerLogos: {
            ...profile.headerLogos,
            [`${type}Base64`]: b64,
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      const chain = [...(profile.approvalChain || [])];
      if (chain[index]) {
        chain[index] = { ...chain[index], stampOrSignatureBase64: b64 };
        setProfile({ ...profile, approvalChain: chain });
      }
    };
    reader.readAsDataURL(file);
  };

  const addApprovalChainEntry = () => {
    const chain = [...(profile.approvalChain || [])];
    if (chain.length >= 6) return;
    chain.push({
      id: `sig-${Date.now()}`,
      roleLabel: { en: `Role ${chain.length + 1}`, fr: `Rôle ${chain.length + 1}` },
      name: '',
      title: '',
    });
    setProfile({ ...profile, approvalChain: chain });
  };

  const removeApprovalChainEntry = (index: number) => {
    const chain = (profile.approvalChain || []).filter((_, idx) => idx !== index);
    setProfile({ ...profile, approvalChain: chain });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            {language === 'fr' ? 'Profil & Charte Graphique du Laboratoire' : 'Laboratory & Organisation Profile'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {language === 'fr'
              ? 'Paramétrez les en-têtes, agréments, logos, chaîne d’approbation (jusqu’à 6 signataires) et codes formulaires.'
              : 'Configure branding, accreditation numbers, logos, approval chain (up to 6 signatories), and form codes.'}
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl">
          <CheckCircle2 className="w-4 h-4" />
          <span>{language === 'fr' ? 'Profil du laboratoire enregistré avec succès.' : 'Organisation profile saved successfully.'}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Lab Identification Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            {language === 'fr' ? 'Identité & Agrément' : 'Identity & Accreditation'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Nom officiel du Laboratoire *' : 'Laboratory Official Name *'}
              </label>
              <input
                type="text"
                placeholder={language === 'fr' ? 'Obligatoire pour les PV approuvés' : 'Required for approved reports'}
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? "N° d'agrément / d'accréditation" : "Agrément / Accreditation no."}
              </label>
              <input
                type="text"
                placeholder={language === 'fr' ? 'Ex: ISO 17025 / Agrément n° 2026/04' : 'e.g. ISO 17025 / Accreditation #2026/04'}
                value={profile.accreditationNumber}
                onChange={(e) => setProfile({ ...profile, accreditationNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">{language === 'fr' ? 'Adresse' : 'Address'}</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">{language === 'fr' ? 'Téléphone' : 'Phone'}</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </div>
          </div>
        </div>

        {/* Bilingual Header Block (Optional Authority Block) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            {language === 'fr' ? 'Bloc d’En-Tête Bilingue / Autorité (Optionnel)' : 'Bilingual / Authority Header Block (Optional)'}
          </h3>
          <p className="text-slate-400 text-[11px]">
            {language === 'fr'
              ? 'Deux colonnes de texte libre au sommet du procès-verbal (ex: République, Ministère, Devise).'
              : 'Two columns of authority text at the top of the test report (e.g. Republic, Ministry, Motto).'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Colonne 1 (Gauche)' : 'Column 1 (Left)'}
              </label>
              <textarea
                rows={3}
                placeholder={language === 'fr' ? 'Ex:\nRÉPUBLIQUE DU ...\nMinistère des Travaux Publics' : 'e.g.:\nREPUBLIC OF ...\nMinistry of Public Works'}
                value={profile.bilingualHeaderBlock?.col1Text || ''}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    bilingualHeaderBlock: {
                      ...profile.bilingualHeaderBlock,
                      col1Text: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Colonne 2 (Droite)' : 'Column 2 (Right)'}
              </label>
              <textarea
                rows={3}
                placeholder={language === 'fr' ? 'Ex:\nPaix - Travail - Patrie\nDirection Générale des Études' : 'e.g.:\nPeace - Work - Fatherland\nDepartment of Technical Studies'}
                value={profile.bilingualHeaderBlock?.col2Text || ''}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    bilingualHeaderBlock: {
                      ...profile.bilingualHeaderBlock,
                      col2Text: e.target.value,
                    },
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Up to 3 Header Logos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-400" />
            {language === 'fr' ? 'Logos d’En-Tête (Jusqu’à 3 logos : Gauche, Centre, Droite)' : 'Header Logos (Up to 3 logos: Left, Center, Right)'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left Logo */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 text-[11px] block">{language === 'fr' ? 'Logo Gauche (ou Principal)' : 'Left Logo (or Main)'}</span>
              <div className="w-full h-20 rounded bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                {profile.headerLogos?.leftBase64 || profile.logoBase64 ? (
                  <img src={profile.headerLogos?.leftBase64 || profile.logoBase64} alt="Logo Left" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-500">{language === 'fr' ? 'Aucun' : 'None'}</span>
                )}
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-center px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer text-[10px]">
                  <Upload className="w-3 h-3 inline mr-1" />
                  {language === 'fr' ? 'Charger' : 'Upload'}
                  <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'left')} className="hidden" />
                </label>
                {(profile.headerLogos?.leftBase64 || profile.logoBase64) && (
                  <button
                    type="button"
                    onClick={() =>
                      setProfile({
                        ...profile,
                        logoBase64: undefined,
                        headerLogos: { ...profile.headerLogos, leftBase64: undefined },
                      })
                    }
                    className="px-2 py-1 text-red-400 hover:bg-red-950/40 rounded text-[10px]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Center Logo */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 text-[11px] block">{language === 'fr' ? 'Logo Centre (ex: Armoiries)' : 'Center Logo (e.g. Coat of Arms)'}</span>
              <div className="w-full h-20 rounded bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                {profile.headerLogos?.centerBase64 ? (
                  <img src={profile.headerLogos.centerBase64} alt="Logo Center" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-500">{language === 'fr' ? 'Aucun' : 'None'}</span>
                )}
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-center px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer text-[10px]">
                  <Upload className="w-3 h-3 inline mr-1" />
                  {language === 'fr' ? 'Charger' : 'Upload'}
                  <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'center')} className="hidden" />
                </label>
                {profile.headerLogos?.centerBase64 && (
                  <button
                    type="button"
                    onClick={() =>
                      setProfile({
                        ...profile,
                        headerLogos: { ...profile.headerLogos, centerBase64: undefined },
                      })
                    }
                    className="px-2 py-1 text-red-400 hover:bg-red-950/40 rounded text-[10px]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Right Logo */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 text-[11px] block">{language === 'fr' ? 'Logo Droite (ex: Client / Partenaire)' : 'Right Logo (e.g. Client / Partner)'}</span>
              <div className="w-full h-20 rounded bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                {profile.headerLogos?.rightBase64 ? (
                  <img src={profile.headerLogos.rightBase64} alt="Logo Right" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-500">{language === 'fr' ? 'Aucun' : 'None'}</span>
                )}
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-center px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer text-[10px]">
                  <Upload className="w-3 h-3 inline mr-1" />
                  {language === 'fr' ? 'Charger' : 'Upload'}
                  <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'right')} className="hidden" />
                </label>
                {profile.headerLogos?.rightBase64 && (
                  <button
                    type="button"
                    onClick={() =>
                      setProfile({
                        ...profile,
                        headerLogos: { ...profile.headerLogos, rightBase64: undefined },
                      })
                    }
                    className="px-2 py-1 text-red-400 hover:bg-red-950/40 rounded text-[10px]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Configurable Approval Chain (Up to 6 entries) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              {language === 'fr' ? 'Chaîne d’Approbation & Signataires (Jusqu’à 6)' : 'Approval Chain & Signatories (Up to 6)'}
            </h3>
            {(profile.approvalChain?.length || 0) < 6 && (
              <button
                type="button"
                onClick={addApprovalChainEntry}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                {language === 'fr' ? 'Ajouter un rôle' : 'Add Signatory'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(profile.approvalChain || []).map((sig, idx) => (
              <div key={sig.id || idx} className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2 relative">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-400 uppercase text-[10px]">
                    {idx + 1}. {sig.roleLabel?.[language] || sig.title || `Signataire ${idx + 1}`}
                  </span>
                  {(profile.approvalChain?.length || 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => removeApprovalChainEntry(idx)}
                      className="text-slate-500 hover:text-red-400 text-xs"
                      title={language === 'fr' ? 'Supprimer' : 'Remove'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">{language === 'fr' ? 'Intitulé du rôle (FR)' : 'Role Label (FR)'}</label>
                  <input
                    type="text"
                    value={sig.roleLabel?.fr || ''}
                    onChange={(e) => {
                      const updated = [...(profile.approvalChain || [])];
                      updated[idx].roleLabel = { en: updated[idx].roleLabel?.en || '', fr: e.target.value };
                      setProfile({ ...profile, approvalChain: updated });
                    }}
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">{language === 'fr' ? 'Intitulé du rôle (EN)' : 'Role Label (EN)'}</label>
                  <input
                    type="text"
                    value={sig.roleLabel?.en || ''}
                    onChange={(e) => {
                      const updated = [...(profile.approvalChain || [])];
                      updated[idx].roleLabel = { fr: updated[idx].roleLabel?.fr || '', en: e.target.value };
                      setProfile({ ...profile, approvalChain: updated });
                    }}
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">{language === 'fr' ? 'Nom' : 'Name'}</label>
                  <input
                    type="text"
                    value={sig.name}
                    onChange={(e) => {
                      const updated = [...(profile.approvalChain || [])];
                      updated[idx].name = e.target.value;
                      setProfile({ ...profile, approvalChain: updated });
                    }}
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">{language === 'fr' ? 'Titre / Fonction' : 'Title'}</label>
                  <input
                    type="text"
                    value={sig.title}
                    onChange={(e) => {
                      const updated = [...(profile.approvalChain || [])];
                      updated[idx].title = e.target.value;
                      setProfile({ ...profile, approvalChain: updated });
                    }}
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-[11px]"
                  />
                </div>

                {/* Optional Stamp or Signature */}
                <div>
                  <label className="block text-slate-400 text-[10px] mb-0.5">
                    {language === 'fr' ? 'Cachet ou Signature (PNG)' : 'Stamp or Signature (PNG)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer text-[10px]">
                      <Upload className="w-3 h-3 inline mr-1" />
                      {sig.stampOrSignatureBase64 ? (language === 'fr' ? 'Remplacer' : 'Change') : (language === 'fr' ? 'Charger' : 'Upload')}
                      <input type="file" accept="image/*" onChange={(e) => handleSignatureUpload(e, idx)} className="hidden" />
                    </label>
                    {sig.stampOrSignatureBase64 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(profile.approvalChain || [])];
                          delete updated[idx].stampOrSignatureBase64;
                          setProfile({ ...profile, approvalChain: updated });
                        }}
                        className="text-red-400 hover:underline text-[10px]"
                      >
                        {language === 'fr' ? 'Supprimer' : 'Clear'}
                      </button>
                    )}
                  </div>
                  {sig.stampOrSignatureBase64 && (
                    <div className="h-10 mt-1 bg-white/90 p-0.5 rounded border border-slate-700 flex items-center justify-center">
                      <img src={sig.stampOrSignatureBase64} alt="Signature" className="max-h-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Codes Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            {language === 'fr' ? 'Codes Formulaires des Procès-Verbaux' : 'Test Sheet Form Codes'}
          </h3>
          <p className="text-slate-400 text-[11px]">
            {language === 'fr'
              ? 'Référence documentaire imprimée sur chaque feuille d’essai (ex: PR2-FOR-02).'
              : 'Documentary reference printed on each test sheet (e.g. PR2-FOR-02).'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Essai Proctor' : 'Proctor Compaction'}
              </label>
              <input
                type="text"
                value={profile.formCodes?.proctor || 'PR2-FOR-02'}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    formCodes: { ...profile.formCodes, proctor: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Analyse Granulométrique' : 'Grain Size Distribution'}
              </label>
              <input
                type="text"
                value={profile.formCodes?.grain_size || 'GR1-FOR-01'}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    formCodes: { ...profile.formCodes, grain_size: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Teneur en Eau' : 'Water Content'}
              </label>
              <input
                type="text"
                value={profile.formCodes?.water_content || 'TE1-FOR-01'}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    formCodes: { ...profile.formCodes, water_content: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Defaults & Colors */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Corps Normatif par Défaut' : 'Default Standard Body'}
              </label>
              <select
                value={profile.defaultStandard}
                onChange={(e) => setProfile({ ...profile, defaultStandard: e.target.value as StandardBody })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-medium"
              >
                <option value="NF">NF (Normes Françaises / AFNOR)</option>
                <option value="ASTM">ASTM (American Society for Testing and Materials)</option>
                <option value="AASHTO">AASHTO</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Couleur Principale' : 'Primary Color'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={profile.primaryColor || '#1e40af'}
                  onChange={(e) => setProfile({ ...profile, primaryColor: e.target.value })}
                  className="w-9 h-9 rounded border-0 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={profile.primaryColor || '#1e40af'}
                  onChange={(e) => setProfile({ ...profile, primaryColor: e.target.value })}
                  className="w-24 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Pied de page des rapports' : 'Report Footer Disclaimer'}
              </label>
              <input
                type="text"
                value={profile.reportFooterText}
                onChange={(e) => setProfile({ ...profile, reportFooterText: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition"
          >
            <Save className="w-4 h-4" />
            {language === 'fr' ? 'Enregistrer les Paramètres' : 'Save Organisation Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};
