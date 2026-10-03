import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Music,
  User,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { Talk, Speaker } from '../../types/database';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';
import { OFFICIAL_TALKS_CATALOG } from '../../utils/talksCatalog';

interface TalksProps {
  initialSpeakerFilter?: string | null;
}

export const Talks: React.FC<TalksProps> = ({ initialSpeakerFilter }) => {
  const { currentCongregation } = useAuth();
  const { showToast } = useToast();
  const [talks, setTalks] = useState<Talk[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(initialSpeakerFilter || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTalk, setEditingTalk] = useState<Talk | null>(null);
  const [formData, setFormData] = useState({
    speaker_id: '',
    title: '',
    song_number: 1,
    theme_number: '' as string | number,
    is_active: true,
  });

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSpeakerFilter) {
      setSelectedSpeakerId(initialSpeakerFilter);
    }
  }, [initialSpeakerFilter]);

  useEffect(() => {
    if (currentCongregation) {
      loadData();
    }
  }, [currentCongregation?.id]);

  const loadData = async () => {
    if (!currentCongregation) return;
    setIsLoading(true);
    try {
      const [spks, tlks] = await Promise.all([
        dataService.getSpeakers(currentCongregation.id),
        dataService.getTalks(undefined, currentCongregation.id),
      ]);
      setSpeakers(spks);
      setTalks(tlks);
    } catch (err) {
      console.error('Error loading talks:', err);
      showToast('Error al cargar conferencias', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = (preselectedSpeakerId?: string) => {
    const spkId =
      preselectedSpeakerId ||
      (selectedSpeakerId !== 'all' ? selectedSpeakerId : speakers[0]?.id || '');

    setEditingTalk(null);
    setFormData({
      speaker_id: spkId,
      title: '',
      song_number: 1,
      theme_number: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (talk: Talk) => {
    setEditingTalk(talk);
    setFormData({
      speaker_id: talk.speaker_id,
      title: talk.title,
      song_number: talk.song_number,
      theme_number: talk.theme_number || '',
      is_active: talk.is_active,
    });
    setIsModalOpen(true);
  };

  const handlePickFromCatalog = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeNum = parseInt(e.target.value, 10);
    if (isNaN(themeNum)) return;
    const found = OFFICIAL_TALKS_CATALOG.find((t) => t.themeNumber === themeNum);
    if (found) {
      setFormData((prev) => ({
        ...prev,
        title: found.title,
        song_number: found.songNumber,
        theme_number: found.themeNumber,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.speaker_id) {
      showToast('Por favor selecciona el conferenciante asignado.', 'error');
      return;
    }
    if (!formData.title.trim()) {
      showToast('Por favor escribe el título del discurso.', 'error');
      return;
    }
    if (!formData.song_number || formData.song_number < 1) {
      showToast('Por favor ingresa un número de canción válido.', 'error');
      return;
    }

    try {
      if (editingTalk) {
        await dataService.updateTalk(editingTalk.id, {
          speaker_id: formData.speaker_id,
          title: formData.title.trim(),
          song_number: Number(formData.song_number),
          theme_number: formData.theme_number ? Number(formData.theme_number) : undefined,
          is_active: formData.is_active,
        });
        showToast('Conferencia actualizada exitosamente.');
      } else {
        await dataService.createTalk({
          speaker_id: formData.speaker_id,
          title: formData.title.trim(),
          song_number: Number(formData.song_number),
          theme_number: formData.theme_number ? Number(formData.theme_number) : undefined,
          is_active: formData.is_active,
        });
        showToast('Conferencia agregada al conferenciante.');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar la conferencia.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await dataService.deleteTalk(deletingId);
      showToast('Conferencia eliminada exitosamente.');
      setDeletingId(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'No se pudo eliminar la conferencia.', 'error');
      setDeletingId(null);
    }
  };

  // Filter talks
  const filteredTalks = talks.filter((t) => {
    const matchesSpeaker = selectedSpeakerId === 'all' || t.speaker_id === selectedSpeakerId;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      t.title.toLowerCase().includes(q) ||
      (t.speaker_name && t.speaker_name.toLowerCase().includes(q)) ||
      String(t.song_number).includes(q);
    return matchesSpeaker && matchesSearch;
  });

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Por favor selecciona una congregación en la barra lateral para ver y administrar sus temas de conferencia."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Conferencias y Discursos
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Bosquejos preparados y canciones asignadas por conferenciante
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenCreate()}
            disabled={speakers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Conferencia</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3 border-t border-slate-100">
          {/* Speaker multi-selector tab */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedSpeakerId}
                onChange={(e) => setSelectedSpeakerId(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Todos los conferenciantes ({speakers.length})</option>
                {speakers.map((spk) => (
                  <option key={spk.id} value={spk.id}>
                    {spk.full_name} ({talks.filter((t) => t.speaker_id === spk.id).length} temas)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search box */}
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar título o canto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      {/* Talks List */}
      {speakers.length === 0 ? (
        <EmptyState
          title="Primero debes registrar conferenciantes"
          description="Para poder asociar conferencias y números de canción, registra al menos un conferenciante local."
          actionLabel="Ir a Conferenciantes"
          onAction={() => {}}
        />
      ) : filteredTalks.length === 0 ? (
        <EmptyState
          title="No hay conferencias registradas"
          description={
            searchQuery
              ? `No hay coincidencias para "${searchQuery}".`
              : 'Agrega los temas y canciones que este conferenciante tiene preparados.'
          }
          actionLabel="Agregar Conferencia"
          onAction={() => handleOpenCreate(selectedSpeakerId !== 'all' ? selectedSpeakerId : undefined)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTalks.map((talk) => (
            <div
              key={talk.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    <User className="w-3.5 h-3.5" />
                    <span>{talk.speaker_name}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      talk.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {talk.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    &ldquo;{talk.title}&rdquo;
                  </h3>
                  {talk.theme_number && (
                    <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
                      Bosquejo N.º {talk.theme_number}
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg font-mono font-medium">
                    <Music className="w-3.5 h-3.5 text-amber-600" />
                    <span>Canción N.º {talk.song_number}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(talk)}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Editar conferencia"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(talk.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Eliminar conferencia"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Talk */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTalk ? 'Editar Conferencia' : 'Agregar Conferencia'}
        subtitle="Registra el título y el número de canción asignado"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Conferenciante Asignado *
            </label>
            <select
              required
              value={formData.speaker_id}
              onChange={(e) => setFormData({ ...formData, speaker_id: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="" disabled>
                -- Seleccionar conferenciante --
              </option>
              {speakers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Helper Catalog */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Autocompletar desde catálogo oficial (opcional)</span>
            </div>
            <select
              onChange={handlePickFromCatalog}
              defaultValue=""
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg text-slate-700 focus:outline-hidden"
            >
              <option value="" disabled>
                Seleccionar bosquejo común para auto-llenar título y canción...
              </option>
              {OFFICIAL_TALKS_CATALOG.map((item) => (
                <option key={item.themeNumber} value={item.themeNumber}>
                  N.º {item.themeNumber}: {item.title} (Canción {item.songNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Título de la Conferencia / Discurso *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej. Confiemos plenamente en Jehová"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Número de Canción *
              </label>
              <div className="relative">
                <Music className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min={1}
                  max={160}
                  required
                  value={formData.song_number}
                  onChange={(e) => setFormData({ ...formData, song_number: parseInt(e.target.value, 10) || 1 })}
                  placeholder="Ej. 45"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                N.º de Bosquejo (Opcional)
              </label>
              <input
                type="number"
                value={formData.theme_number}
                onChange={(e) => setFormData({ ...formData, theme_number: e.target.value })}
                placeholder="Ej. 149"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="tlk-active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded-sm focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="tlk-active" className="text-xs font-medium text-slate-700 cursor-pointer select-none">
              Tema activo (disponible para asignaciones de entrada o salida)
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
              {editingTalk ? 'Guardar Cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Conferencia"
        message="¿Estás seguro de que deseas eliminar este tema de la lista de conferencias?"
        confirmLabel="Eliminar"
        isDanger={true}
      />
    </div>
  );
};
