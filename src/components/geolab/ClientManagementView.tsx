import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import type { GeoLabClient, GeoLabProject } from '../../types/geolab';
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  MapPin,
  Archive,
  RefreshCw,
  Edit2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface Props {
  language: 'en' | 'fr';
  onSelectClient?: (clientId: string) => void;
  onNavigateToProjects?: (clientId: string) => void;
}

export const ClientManagementView: React.FC<Props> = ({ language, onNavigateToProjects }) => {
  const [clients, setClients] = useState<GeoLabClient[]>([]);
  const [projects, setProjects] = useState<GeoLabProject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingClient, setEditingClient] = useState<GeoLabClient | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    const allClients = await db.clients.toArray();
    const allProjects = await db.geolabProjects.toArray();
    setClients(allClients);
    setProjects(allProjects);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && (showArchived ? c.isArchived : !c.isArchived);
  });

  const getProjectCount = (clientId: string) => {
    return projects.filter((p) => p.clientId === clientId).length;
  };

  const handleOpenCreate = () => {
    setEditingClient({
      id: `client-${Date.now()}`,
      companyName: '',
      contactPerson: '',
      jobTitle: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'France',
      taxRegistrationNumber: '',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: GeoLabClient) => {
    setEditingClient({ ...client });
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editingClient.companyName.trim()) {
      setErrorMessage(language === 'fr' ? 'La raison sociale est requise.' : 'Company name is required.');
      return;
    }

    const updated = {
      ...editingClient,
      updatedAt: new Date().toISOString(),
    };

    await db.clients.put(updated);
    setIsModalOpen(false);
    setEditingClient(null);
    loadData();
  };

  const handleArchiveToggle = async (client: GeoLabClient) => {
    const updated = {
      ...client,
      isArchived: !client.isArchived,
      updatedAt: new Date().toISOString(),
    };
    await db.clients.put(updated);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            {language === 'fr' ? 'Gestion des Clients du Laboratoire' : 'Laboratory Client Directory'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {language === 'fr'
              ? 'Répertoire des entreprises, maîtres d\'ouvrage et donneurs d\'ordre pour les procès-verbaux d\'essais.'
              : 'Directory of engineering firms, clients, and contracting authorities for official test reports.'}
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow transition"
        >
          <Plus className="w-4 h-4" />
          {language === 'fr' ? 'Nouveau Client' : 'New Client'}
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={language === 'fr' ? 'Rechercher client, contact, ville...' : 'Search company, contact, city...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              !showArchived ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {language === 'fr' ? 'Actifs' : 'Active'} ({clients.filter((c) => !c.isArchived).length})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              showArchived ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {language === 'fr' ? 'Archivés' : 'Archived'} ({clients.filter((c) => c.isArchived).length})
          </button>
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const projCount = getProjectCount(client.id);
          return (
            <div
              key={client.id}
              className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition ${
                client.isArchived ? 'border-slate-800 opacity-70' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{client.companyName}</h3>
                      <p className="text-xs text-slate-400">{client.contactPerson || '-'}</p>
                    </div>
                  </div>
                  {client.isArchived && (
                    <span className="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded text-[10px] font-semibold">
                      {language === 'fr' ? 'Archivé' : 'Archived'}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-300">
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {client.city}, {client.country}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <button
                  onClick={() => onNavigateToProjects && onNavigateToProjects(client.id)}
                  className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {projCount} {language === 'fr' ? 'Projet(s)' : 'Project(s)'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(client)}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    title={language === 'fr' ? 'Modifier' : 'Edit'}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchiveToggle(client)}
                    className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800"
                    title={client.isArchived ? (language === 'fr' ? 'Désarchiver' : 'Restore') : (language === 'fr' ? 'Archiver' : 'Archive')}
                  >
                    {client.isArchived ? <RefreshCw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400 text-sm">
          {language === 'fr' ? 'Aucun client trouvé.' : 'No clients found.'}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editingClient.createdAt === editingClient.updatedAt
                ? language === 'fr' ? 'Nouveau Client' : 'New Client'
                : language === 'fr' ? 'Modifier le Client' : 'Edit Client'}
            </h3>

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Raison Sociale / Entreprise *' : 'Company Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editingClient.companyName}
                  onChange={(e) => setEditingClient({ ...editingClient, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Contact Référent' : 'Contact Person'}
                  </label>
                  <input
                    type="text"
                    value={editingClient.contactPerson}
                    onChange={(e) => setEditingClient({ ...editingClient, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Fonction' : 'Job Title'}
                  </label>
                  <input
                    type="text"
                    value={editingClient.jobTitle || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editingClient.email}
                    onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Téléphone' : 'Phone'}
                  </label>
                  <input
                    type="tel"
                    value={editingClient.phone}
                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'Adresse' : 'Address'}
                </label>
                <input
                  type="text"
                  value={editingClient.address}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Ville' : 'City'}
                  </label>
                  <input
                    type="text"
                    value={editingClient.city}
                    onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === 'fr' ? 'Pays' : 'Country'}
                  </label>
                  <input
                    type="text"
                    value={editingClient.country}
                    onChange={(e) => setEditingClient({ ...editingClient, country: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === 'fr' ? 'N° Siret / TVA' : 'Tax / Registration No'}
                </label>
                <input
                  type="text"
                  value={editingClient.taxRegistrationNumber || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, taxRegistrationNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition"
                >
                  {language === 'fr' ? 'Enregistrer' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
