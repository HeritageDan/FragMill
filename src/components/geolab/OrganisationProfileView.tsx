import React, { useState, useEffect } from 'react';
import { getOrganisationProfile, saveOrganisationProfile } from '../../db';
import type { OrganisationProfile, StandardBody } from '../../types/geolab';
import {
  Building2,
  Save,
  CheckCircle2,
  Upload,
  Palette,
  Users,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
}

export const OrganisationProfileView: React.FC<Props> = ({ language }) => {
  const [profile, setProfile] = useState<OrganisationProfile | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    getOrganisationProfile().then(setProfile);
  }, []);

  if (!profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveOrganisationProfile(profile);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfile({
        ...profile,
        logoBase64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
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
              ? 'Paramétrez les en-têtes, accréditations, signataires officiels et couleurs de vos rapports.'
              : 'Configure branding, accreditation numbers, official signatories, and report styling.'}
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
            {language === 'fr' ? 'Identité & Accréditation' : 'Identity & Accreditation'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'Nom officiel du Laboratoire *' : 'Laboratory Official Name *'}
              </label>
              <input
                type="text"
                required
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                {language === 'fr' ? 'N° d\'Accréditation / Homologation (ex: COFRAC ISO 17025) *' : 'Accreditation No (ISO 17025) *'}
              </label>
              <input
                type="text"
                required
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

        {/* Branding & Visuals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-400" />
            {language === 'fr' ? 'Charte Graphique & Logo' : 'Branding & Logo'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Logo Uploader */}
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                {profile.logoBase64 ? (
                  <img src={profile.logoBase64} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[11px] text-slate-500 text-center px-2">
                    {language === 'fr' ? 'Aucun logo' : 'No logo'}
                  </span>
                )}
              </div>

              <div>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  {language === 'fr' ? 'Choisir Logo (PNG/JPG)' : 'Upload Logo'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {profile.logoBase64 && (
                  <button
                    type="button"
                    onClick={() => setProfile({ ...profile, logoBase64: undefined })}
                    className="block text-[11px] text-red-400 hover:underline mt-1"
                  >
                    {language === 'fr' ? 'Supprimer le logo' : 'Remove logo'}
                  </button>
                )}
              </div>
            </div>

            {/* Primary Color Picker */}
            <div className="space-y-2">
              <label className="block text-slate-300 font-medium">
                {language === 'fr' ? 'Couleur Principale des Rapports' : 'Report Primary Brand Color'}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={profile.primaryColor || '#1e40af'}
                  onChange={(e) => setProfile({ ...profile, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={profile.primaryColor || '#1e40af'}
                  onChange={(e) => setProfile({ ...profile, primaryColor: e.target.value })}
                  className="w-28 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Signatories Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            {language === 'fr' ? 'Signataires Officiels des Procès-Verbaux' : 'Official Report Signatories'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {profile.signatories.map((sig, idx) => (
              <div key={sig.role} className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="font-bold text-blue-400 uppercase text-[11px]">
                  {sig.role === 'prepared'
                    ? language === 'fr' ? '1. Réalisé par (Technicien)' : '1. Prepared by (Technician)'
                    : sig.role === 'checked'
                    ? language === 'fr' ? '2. Vérifié par (Qualité)' : '2. Checked by (QA)'
                    : language === 'fr' ? '3. Approuvé par (Directeur)' : '3. Approved by (Director)'}
                </span>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-0.5">{language === 'fr' ? 'Nom' : 'Name'}</label>
                  <input
                    type="text"
                    value={sig.name}
                    onChange={(e) => {
                      const updatedSigs = [...profile.signatories];
                      updatedSigs[idx].name = e.target.value;
                      setProfile({ ...profile, signatories: updatedSigs });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-0.5">{language === 'fr' ? 'Titre / Fonction' : 'Title'}</label>
                  <input
                    type="text"
                    value={sig.title}
                    onChange={(e) => {
                      const updatedSigs = [...profile.signatories];
                      updatedSigs[idx].title = e.target.value;
                      setProfile({ ...profile, signatories: updatedSigs });
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Defaults & Footers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
