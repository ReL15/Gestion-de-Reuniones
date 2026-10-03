import React, { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Music,
  MapPin,
  User,
  BookOpen,
  Edit2,
  Trash2,
  Phone,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import {
  IncomingAssignment,
  Congregation,
  Speaker,
  Talk,
} from '../../types/database';
import { MonthSelector } from '../../components/common/MonthSelector';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';
import { SmartTalkSearch } from '../../components/common/SmartTalkSearch';
import {
  formatFullSpanishDate,
  formatTime12Hour,
  getCurrentMonthAndYear,
  getMeetingDatesInMonth,
  SPANISH_MONTHS,
} from '../../utils/dateUtils';

export const IncomingAssignments: React.FC = () => {
  const { currentCongregation } = useAuth();
  const { showToast } = useToast();
  const initial = getCurrentMonthAndYear();

  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [assignments, setAssignments] = useState<IncomingAssignment[]>([]);
  const [allCongregations, setAllCongregations] = useState<Congregation[]>([]);
  const [allSpeakers, setAllSpeakers] = useState<Speaker[]>([]);
  const [allTalks, setAllTalks] = useState<Talk[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<IncomingAssignment | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState('');
  const [formOriginCongId, setFormOriginCongId] = useState('');
  const [formSpeakerId, setFormSpeakerId] = useState('');
  const [formTalkId, setFormTalkId] = useState('');
  const [formSongNumber, setFormSongNumber] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCongregation) {
      loadData();
    }
  }, [currentCongregation?.id, selectedMonth, selectedYear]);

  const loadData = async () => {
    if (!currentCongregation) return;
    setIsLoading(true);
    try {
      const [list, congs, spks, tlks] = await Promise.all([
        dataService.getIncomingAssignments(currentCongregation.id, selectedMonth, selectedYear),
        dataService.getCongregations(),
        dataService.getSpeakers(),
        dataService.getTalks(),
      ]);
      setAssignments(list);
      // Filter out local congregation for origins list
      setAllCongregations(congs.filter((c) => c.is_active && c.id !== currentCongregation.id));
      setAllSpeakers(spks.filter((s) => s.is_active));
      setAllTalks(tlks.filter((t) => t.is_active));
    } catch (err) {
      console.error('Error loading incoming assignments:', err);
      showToast('Error al cargar asignaciones de entrada', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Available meeting dates for the local congregation in the active month
  const availableDatesInMonth = currentCongregation
    ? getMeetingDatesInMonth(
        selectedYear,
        selectedMonth,
        currentCongregation.weekend_meeting_day
      )
    : [];

  // Filtered speakers based on selected origin congregation
  const originSpeakers = allSpeakers.filter(
    (s) => s.congregation_id === formOriginCongId
  );

  // Filtered talks based on selected speaker
  const speakerTalks = allTalks.filter((t) => t.speaker_id === formSpeakerId);

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    // Pick first available weekend date of current month
    const defaultDate = availableDatesInMonth[0]?.dateStr || '';
    setFormDate(defaultDate);
    setFormOriginCongId('');
    setFormSpeakerId('');
    setFormTalkId('');
    setFormSongNumber(1);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (assignment: IncomingAssignment) => {
    setEditingAssignment(assignment);
    setFormDate(assignment.meeting_date);
    setFormOriginCongId(assignment.origin_congregation_id);
    setFormSpeakerId(assignment.speaker_id);
    setFormTalkId(assignment.talk_id);
    setFormSongNumber(assignment.song_number);
    setFormNotes(assignment.notes || '');
    setIsModalOpen(true);
  };

  // Cascading selections
  const handleOriginCongregationChange = (congId: string) => {
    setFormOriginCongId(congId);
    setFormSpeakerId('');
    setFormTalkId('');
    setFormSongNumber(1);
  };

  const handleSpeakerChange = (spkId: string) => {
    setFormSpeakerId(spkId);
    setFormTalkId('');
    // If speaker has talks, select first
    const spkTalks = allTalks.filter((t) => t.speaker_id === spkId);
    if (spkTalks.length > 0) {
      setFormTalkId(spkTalks[0].id);
      setFormSongNumber(spkTalks[0].song_number);
    } else {
      setFormSongNumber(1);
    }
  };

  const handleTalkChange = (tlkId: string) => {
    setFormTalkId(tlkId);
    const chosen = allTalks.find((t) => t.id === tlkId);
    if (chosen) {
      setFormSongNumber(chosen.song_number);
    }
  };

  // Smart Search selection handler
  const handleSmartSearchResult = (selection: {
    congregation: Congregation;
    speaker?: Speaker;
    talk?: Talk;
  }) => {
    setFormOriginCongId(selection.congregation.id);
    if (selection.speaker) {
      setFormSpeakerId(selection.speaker.id);
    } else {
      setFormSpeakerId('');
    }
    if (selection.talk) {
      setFormTalkId(selection.talk.id);
      setFormSongNumber(selection.talk.song_number);
    } else {
      setFormTalkId('');
      setFormSongNumber(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCongregation) return;

    if (!formDate) {
      showToast('Por favor selecciona la fecha de la reunión.', 'error');
      return;
    }
    if (!formOriginCongId) {
      showToast('Por favor selecciona la congregación de origen.', 'error');
      return;
    }
    if (!formSpeakerId) {
      showToast('Por favor selecciona al conferenciante visitante.', 'error');
      return;
    }
    if (!formTalkId) {
      showToast('Por favor selecciona la conferencia/discurso.', 'error');
      return;
    }

    // Auto-filled meeting time from local congregation
    const localMeetingTime = currentCongregation.weekend_meeting_time;

    try {
      if (editingAssignment) {
        await dataService.updateIncomingAssignment(editingAssignment.id, {
          meeting_date: formDate,
          meeting_time: localMeetingTime,
          origin_congregation_id: formOriginCongId,
          speaker_id: formSpeakerId,
          talk_id: formTalkId,
          song_number: formSongNumber,
          notes: formNotes.trim() || undefined,
        });
        showToast('Conferencia de entrada actualizada exitosamente.');
      } else {
        await dataService.createIncomingAssignment({
          local_congregation_id: currentCongregation.id,
          origin_congregation_id: formOriginCongId,
          speaker_id: formSpeakerId,
          talk_id: formTalkId,
          song_number: formSongNumber,
          meeting_date: formDate,
          meeting_time: localMeetingTime,
          notes: formNotes.trim() || undefined,
        });
        showToast('Conferencia de entrada registrada.');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar la asignación.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await dataService.deleteIncomingAssignment(deletingId);
      showToast('Asignación de entrada eliminada.');
      setDeletingId(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'No se pudo eliminar.', 'error');
      setDeletingId(null);
    }
  };

  const monthLabel = `${SPANISH_MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* Top Banner / Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Conferencias de Entrada (Visitantes)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Oradores visitantes que asistirán a {currentCongregation?.name} para {monthLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChange={(m, y) => {
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
          />

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Entrada</span>
          </button>
        </div>
      </div>

      {/* Assignments Cards List */}
      {assignments.length === 0 ? (
        <EmptyState
          title={`No hay conferencias de entrada para ${monthLabel}`}
          description={`Registra a los conferenciantes visitantes para los ${currentCongregation?.weekend_meeting_day}s de este mes.`}
          actionLabel="Registrar Conferencia de Entrada"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Date & Time Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatFullSpanishDate(assignment.meeting_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {formatTime12Hour(assignment.meeting_time)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({currentCongregation?.name})
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-1 rounded-lg">
                    <Music className="w-3 h-3 text-amber-600" />
                    Canto {assignment.song_number}
                  </span>
                </div>

                {/* Talk Title */}
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Conferencia
                  </span>
                  <h3 className="text-base font-bold text-slate-900 leading-snug mt-0.5">
                    &ldquo;{assignment.talk_title}&rdquo;
                  </h3>
                </div>

                {/* Speaker & Congregation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Conferenciante Visitante
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                      {assignment.speaker_name}
                    </p>
                    {assignment.speaker_phone && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{assignment.speaker_phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Congregación de Origen
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                      {assignment.origin_congregation_name}
                    </p>
                  </div>
                </div>

                {/* Notes if any */}
                {assignment.notes && (
                  <p className="text-xs text-slate-500 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    {assignment.notes}
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(assignment)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(assignment.id)}
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

      {/* Modal Nueva / Editar Entrada */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'Editar Conferencia de Entrada' : 'Nueva Conferencia de Entrada'}
        subtitle={`Congregación receptora: ${currentCongregation?.name}`}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Smart Search Bar */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Búsqueda Rápida Inteligente
            </label>
            <SmartTalkSearch
              congregations={allCongregations}
              speakers={allSpeakers}
              talks={allTalks}
              onSelectResult={handleSmartSearchResult}
              placeholder="Escribe 'Juan', 'Central', o palabras del tema para autocompletar..."
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Al seleccionar una coincidencia, se rellenarán automáticamente la congregación de origen, el conferenciante y el discurso.
            </p>
          </div>

          {/* 1. Fecha de la Reunión */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              1. Fecha de la Reunión ({currentCongregation?.weekend_meeting_day}s de {monthLabel}) *
            </label>
            <select
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value="" disabled>
                -- Seleccionar fecha de reunión --
              </option>
              {availableDatesInMonth.map((d) => (
                <option key={d.dateStr} value={d.dateStr}>
                  {formatFullSpanishDate(d.dateStr)} (Semana {d.weekNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-filled Meeting Time Info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Hora de inicio local (automática):</span>
            </div>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {formatTime12Hour(currentCongregation?.weekend_meeting_time || '09:30')}
            </span>
          </div>

          {/* 2. Congregación Originaria */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              2. Congregación Originaria del Visitante *
            </label>
            <select
              required
              value={formOriginCongId}
              onChange={(e) => handleOriginCongregationChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="" disabled>
                -- Seleccionar congregación de origen --
              </option>
              {allCongregations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Conferenciante */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              3. Conferenciante Visitante *
            </label>
            <select
              required
              disabled={!formOriginCongId}
              value={formSpeakerId}
              onChange={(e) => handleSpeakerChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="" disabled>
                {formOriginCongId
                  ? originSpeakers.length > 0
                    ? '-- Seleccionar conferenciante --'
                    : 'No hay conferenciantes registrados en esta congregación'
                  : 'Primero selecciona la congregación de origen'}
              </option>
              {originSpeakers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.phone})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Conferencia */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              4. Conferencia / Discurso a Presentar *
            </label>
            <select
              required
              disabled={!formSpeakerId}
              value={formTalkId}
              onChange={(e) => handleTalkChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="" disabled>
                {formSpeakerId
                  ? speakerTalks.length > 0
                    ? '-- Seleccionar conferencia --'
                    : 'Este conferenciante no tiene temas asignados aún'
                  : 'Primero selecciona al conferenciante'}
              </option>
              {speakerTalks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} (Canción {t.song_number})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Canción Auto-cargada */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              5. Número de Canción (Automático de la Conferencia) *
            </label>
            <div className="relative">
              <Music className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="number"
                required
                readOnly
                value={formSongNumber}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-700 select-none cursor-not-allowed"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Notas adicionales (Opcional)
            </label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ej. Confirmado con el coordinador de San Salvador"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
              {editingAssignment ? 'Guardar Cambios' : 'Registrar Entrada'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Conferencia de Entrada"
        message="¿Estás seguro de que deseas eliminar esta asignación de entrada del programa?"
        confirmLabel="Eliminar"
        isDanger={true}
      />
    </div>
  );
};
