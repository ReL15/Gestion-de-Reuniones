import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, BookOpen, Edit2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { Speaker } from '../../types/database';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';

interface SpeakersProps {
  onNavigateToTalks?: (speakerId: string) => void;
}

export const Speakers: React.FC<SpeakersProps> = ({ onNavigateToTalks }) => {
  const { currentCongregation } = useAuth();
  const { showToast } = useToast();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    is_active: true,
    notes: '',
  });

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCongregation) {
      loadSpeakers();
    }
  }, [currentCongregation?.id]);

  const loadSpeakers = async () => {
    if (!currentCongregation) return;
    setIsLoading(true);
    try {
      const list = await dataService.getSpeakers(currentCongregation.id);
      setSpeakers(list);
    } catch (err) {
      console.error('Error loading speakers:', err);
      showToast('Error al cargar conferenciantes', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingSpeaker(null);
    setFormData({
      full_name: '',
      phone: '',
      is_active: true,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (speaker: Speaker) => {
    setEditingSpeaker(speaker);
    setFormData({
      full_name: speaker.full_name,
      phone: speaker.phone,
      is_active: speaker.is_active,
      notes: speaker.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCongregation) return;

    if (!formData.full_name.trim()) {
      showToast('Por favor escribe el nombre completo del conferenciante.', 'error');
      return;
    }
    if (!formData.phone.trim()) {
      showToast('Por favor ingresa un número de teléfono de contacto.', 'error');
      return;
    }

    try {
      if (editingSpeaker) {
        await dataService.updateSpeaker(editingSpeaker.id, {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          is_active: formData.is_active,
          notes: formData.notes.trim() || undefined,
        });
        showToast('Conferenciante actualizado exitosamente.');
      } else {
        await dataService.createSpeaker({
          congregation_id: currentCongregation.id,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          is_active: formData.is_active,
          notes: formData.notes.trim() || undefined,
        });
        showToast('Conferenciante registrado exitosamente.');
      }
      setIsModalOpen(false);
      loadSpeakers();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar el conferenciante', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await dataService.deleteSpeaker(deletingId);
      showToast('Conferenciante eliminado exitosamente.');
      setDeletingId(null);
      loadSpeakers();
    } catch (err: any) {
      showToast(err.message || 'No se pudo eliminar el conferenciante.', 'error');
      setDeletingId(null);
    }
  };

  const filteredSpeakers = speakers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.phone.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Conferenciantes Locales
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Hermanos aprobados de {currentCongregation?.name} para presentar conferencias públicas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar conferenciante..."
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
            <span>Nuevo Conferenciante</span>
          </button>
        </div>
      </div>

      {/* Grid of Speakers */}
      {filteredSpeakers.length === 0 ? (
        <EmptyState
          title="No hay conferenciantes registrados"
          description={
            searchQuery
              ? `No se encontraron conferenciantes para "${searchQuery}".`
              : 'Agrega a los hermanos de tu congregación que presentan discursos públicos.'
          }
          actionLabel="Registrar primer conferenciante"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSpeakers.map((speaker) => (
            <div
              key={speaker.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {speaker.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono tabular-nums">{speaker.phone}</span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      speaker.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {speaker.is_active ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-slate-400" /> Inactivo
                      </>
                    )}
                  </span>
                </div>

                {speaker.notes && (
                  <p className="mt-3 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                    {speaker.notes}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    {speaker.talks_count || 0}{' '}
                    {speaker.talks_count === 1 ? 'conferencia' : 'conferencias'}
                  </span>

                  {onNavigateToTalks && (
                    <button
                      type="button"
                      onClick={() => onNavigateToTalks(speaker.id)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Ver discursos →
                    </button>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(speaker)}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Editar conferenciante"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(speaker.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Eliminar conferenciante"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSpeaker ? 'Editar Conferenciante' : 'Nuevo Conferenciante'}
        subtitle={`Congregación ${currentCongregation?.name}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ej. Juan Pérez"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Número de Teléfono / WhatsApp *
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Ej. +503 7123-4567"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Notas u Observaciones (Opcional)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ej. Anciano, disponibilidad de transporte..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="spk-active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="spk-active" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
              Conferenciante Activo (disponible para asignaciones de discursos)
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
              {editingSpeaker ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Conferenciante"
        message="¿Estás seguro de que deseas eliminar a este conferenciante? Si tiene conferencias asociadas, también se retirarán si no están en uso."
        confirmLabel="Eliminar"
        isDanger={true}
      />
    </div>
  );
};
