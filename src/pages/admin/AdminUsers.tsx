import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, Mail, Phone, Building2, Plus, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { Profile } from '../../types/database';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';

export const AdminUsers: React.FC = () => {
  const { allCongregations } = useAuth();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    congregation_id: '',
    full_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const list = await dataService.getProfiles();
      setProfiles(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      congregation_id: allCongregations[0]?.id || '',
      full_name: '',
      email: '',
      phone: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.email.trim()) {
      showToast('Por favor completa todos los campos requeridos.', 'error');
      return;
    }

    try {
      await dataService.createCongregationAdminProfile({
        congregation_id: formData.congregation_id,
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
      });
      showToast('Coordinador registrado exitosamente.');
      setIsModalOpen(false);
      loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'Error al registrar coordinador', 'error');
    }
  };

  const filtered = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Coordinadores y Cuentas de Acceso
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Super administradores y coordinadores de cada congregación
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 w-48 sm:w-60"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Asignar Coordinador</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Rol del Sistema</th>
                <th className="py-3 px-4">Congregación Asignada</th>
                <th className="py-3 px-4">Contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((profile) => {
                const cong = allCongregations.find((c) => c.id === profile.congregation_id);
                return (
                  <tr key={profile.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                          {profile.role === 'super_admin' ? (
                            <ShieldCheck className="w-4 h-4 text-purple-600" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{profile.full_name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{profile.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          profile.role === 'super_admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {profile.role === 'super_admin'
                          ? 'Super Administrador'
                          : 'Administrador de Congregación'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {cong ? cong.name : 'Acceso Global (Todas)'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {profile.phone || '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Asignar Nuevo Coordinador"
        subtitle="Crea una cuenta de administrador de congregación"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Congregación *
            </label>
            <select
              required
              value={formData.congregation_id}
              onChange={(e) => setFormData({ ...formData, congregation_id: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
            >
              {allCongregations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nombre Completo del Hermano *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ej. Carlos Mendoza"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Correo Electrónico (Usuario de Acceso) *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="coordinador@jwconferencias.org"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Teléfono de Contacto
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+503 7234-5678"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Crear Cuenta
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
