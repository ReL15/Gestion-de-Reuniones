import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, BookCheck, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { Reader } from '../../types/database';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';

export const Readers: React.FC = () => {
  const { currentCongregation } = useAuth();
  const { showToast } = useToast();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReader, setEditingReader] = useState<Reader | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    can_read: true,
    can_preside: false,
    is_active: true,
    notes: '',
  });

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCongregation) {
      loadReaders();
    }
  }, [currentCongregation?.id]);

  const loadReaders = async () => {
    if (!currentCongregation) return;
    setIsLoading(true);
    try {
      const list = await dataService.getReaders(currentCongregation.id);
      setReaders(list);
    } catch (err) {
      console.error('Error loading readers:', err);
      showToast('Error al cargar la lista de lectores y presidentes', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingReader(null);
    setFormData({
      full_name: '',
      phone: '',
      can_read: true,
      can_preside: false,
      is_active: true,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (reader: Reader) => {
    setEditingReader(reader);
    setFormData({
      full_name: reader.full_name,
      phone: reader.phone || '',
      can_read: reader.can_read !== false,
      can_preside: Boolean(reader.can_preside),
      is_active: reader.is_active,
      notes: reader.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCongregation) return;

    if (!formData.full_name.trim()) {
      showToast('Por favor escribe el nombre completo del hermano.', 'error');
      return;
    }

    if (!formData.can_read && !formData.can_preside) {
      showToast('Selecciona al menos una función (Lector o Presidente).', 'error');
      return;
    }

    try {
      if (editingReader) {
        await dataService.updateReader(editingReader.id, {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || undefined,
          can_read: formData.can_read,
          can_preside: formData.can_preside,
          is_active: formData.is_active,
          notes: formData.notes.trim() || undefined,
        });
        showToast('Hermano actualizado exitosamente.');
      } else {
        await dataService.createReader({
          congregation_id: currentCongregation.id,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || undefined,
          can_read: formData.can_read,
          can_preside: formData.can_preside,
          is_active: formData.is_active,
          notes: formData.notes.trim() || undefined,
        });
        showToast('Nuevo hermano registrado para asignaciones locales.');
      }
      setIsModalOpen(false);
      loadReaders();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await dataService.deleteReader(deletingId);
      showToast('Lector eliminado correctamente.');
      setDeletingId(null);
      loadReaders();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar el lector.', 'error');
      setDeletingId(null);
    }
  };

  const filteredReaders = readers.filter((r) =>
    r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.phone && r.phone.includes(searchQuery))
  );

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Selecciona una congregación en la barra lateral para ver y administrar sus lectores locales."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Lectores y Presidentes Locales
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Hermanos locales habilitados para dar lectura de La Atalaya y/o presidir las reuniones ({currentCongregation.name})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar hermano..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-48 sm:w-64"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Hermano</span>
          </button>
        </div>
      </div>

      {/* Grid of Readers */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredReaders.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No se encontraron registros' : 'No hay lectores ni presidentes registrados'}
          description={
            searchQuery
              ? `No hay resultados para "${searchQuery}". Intenta con otro término.`
              : 'Agrega los hermanos de la congregación local habilitados para dar lectura o presidir las reuniones de fin de semana.'
          }
          actionLabel={searchQuery ? undefined : 'Registrar Primer Hermano'}
          onAction={searchQuery ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReaders.map((reader) => (
            <div
              key={reader.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                      <BookCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {reader.full_name}
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        {currentCongregation.name}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      reader.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {reader.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Role Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {reader.can_read !== false && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                      Lector Atalaya
                    </span>
                  )}
                  {reader.can_preside && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                      Presidente
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  {reader.phone ? (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{reader.phone}</span>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px]">
                      Sin teléfono registrado
                    </div>
                  )}

                  {reader.notes && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                      {reader.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(reader)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(reader.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Hermano */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReader ? 'Editar Hermano' : 'Registrar Hermano (Lector / Presidente)'}
        subtitle={`Congregación local: ${currentCongregation.name}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nombre Completo del Hermano *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ej. Mario Antonio Alvarado"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Teléfono de Contacto (Opcional)
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ej. 7890-1234"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Funciones / Roles */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Funciones en la Reunión de Fin de Semana *
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.can_read}
                  onChange={(e) => setFormData({ ...formData, can_read: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-800">
                  Lector de La Atalaya
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-purple-300 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.can_preside}
                  onChange={(e) => setFormData({ ...formData, can_preside: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <span className="text-xs font-medium text-slate-800">
                  Presidente de la Reunión
                </span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Un hermano puede estar habilitado como lector, presidente, o ambos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Notas u Observaciones (Opcional)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ej. Disponible el 2do y 4to domingo del mes"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="reader_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="reader_active" className="text-xs font-medium text-slate-700 cursor-pointer">
              Hermano activo (disponible para asignaciones)
            </label>
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
              {editingReader ? 'Guardar Cambios' : 'Registrar Hermano'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Hermano"
        message="¿Estás seguro de que deseas eliminar este hermano? Las asignaciones existentes conservarán su historial."
        confirmLabel="Eliminar"
        isDanger={true}
      />
    </div>
  );
};
