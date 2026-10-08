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
  AlertCircle,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import {
  OutgoingAssignment,
  Congregation,
  Speaker,
  Talk,
} from '../../types/database';
import { MonthSelector } from '../../components/common/MonthSelector';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';
import { whatsAppUrl } from '../../utils/whatsapp';
import {
  formatFullSpanishDate,
  formatTime12Hour,
  getCurrentMonthAndYear,
  calculateMeetingDate,
  SPANISH_MONTHS,
} from '../../utils/dateUtils';

export const OutgoingAssignments: React.FC = () => {
  const { currentCongregation, role } = useAuth();
  const isBrotherViewer = role === 'brother_viewer';
  const { showToast } = useToast();
  const initial = getCurrentMonthAndYear();

  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [assignments, setAssignments] = useState<OutgoingAssignment[]>([]);
  const [allCongregations, setAllCongregations] = useState<Congregation[]>([]);
  const [localSpeakers, setLocalSpeakers] = useState<Speaker[]>([]);
  const [localTalks, setLocalTalks] = useState<Talk[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<OutgoingAssignment | null>(null);

  // Form Fields
  const [formWeekNumber, setFormWeekNumber] = useState<number>(1);
  const [formDestinationCongId, setFormDestinationCongId] = useState('');
  const [formSpeakerId, setFormSpeakerId] = useState('');
  const [formTalkId, setFormTalkId] = useState('');
  const [formSongNumber, setFormSongNumber] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');

  // Derived automatic values for destination
  const [calculatedDateStr, setCalculatedDateStr] = useState<string>('');
  const [calculatedTimeStr, setCalculatedTimeStr] = useState<string>('');
  const [dateCalculationWarning, setDateCalculationWarning] = useState<string | null>(null);

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
        dataService.getOutgoingAssignments(currentCongregation.id, selectedMonth, selectedYear),
        dataService.getCongregations(),
        dataService.getSpeakers(currentCongregation.id),
        dataService.getTalks(undefined, currentCongregation.id),
      ]);
      setAssignments(list);
      // Destination cannot be current congregation
      setAllCongregations(congs.filter((c) => c.is_active && c.id !== currentCongregation.id));
      setLocalSpeakers(spks.filter((s) => s.is_active));
      setLocalTalks(tlks.filter((t) => t.is_active));
    } catch (err) {
      console.error('Error loading outgoing assignments:', err);
      showToast('Error al cargar salidas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-calculate date whenever month, year, weekNumber or destination congregation changes
  useEffect(() => {
    if (!formDestinationCongId) {
      setCalculatedDateStr('');
      setCalculatedTimeStr('');
      setDateCalculationWarning(null);
      return;
    }

    const dest = allCongregations.find((c) => c.id === formDestinationCongId);
    if (!dest) return;

    setCalculatedTimeStr(dest.weekend_meeting_time);

    // Rule 29: Calculate meeting date based on destination congregation weekend meeting day
    const res = calculateMeetingDate(
      selectedYear,
      selectedMonth,
      formWeekNumber,
      dest.weekend_meeting_day
    );

    setCalculatedDateStr(res.dateStr);
    if (!res.valid && res.message) {
      setDateCalculationWarning(res.message);
    } else {
      setDateCalculationWarning(null);
    }
  }, [formWeekNumber, formDestinationCongId, selectedMonth, selectedYear, allCongregations]);

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setFormWeekNumber(1);
    setFormDestinationCongId('');
    setFormSpeakerId(localSpeakers[0]?.id || '');
    setFormTalkId('');
    setFormSongNumber(1);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (assignment: OutgoingAssignment) => {
    setEditingAssignment(assignment);
    setFormWeekNumber(assignment.week_number || 1);
    setFormDestinationCongId(assignment.destination_congregation_id);
    setFormSpeakerId(assignment.speaker_id);
    setFormTalkId(assignment.talk_id);
    setFormSongNumber(assignment.song_number);
    setFormNotes(assignment.notes || '');
    setCalculatedDateStr(assignment.meeting_date);
    setCalculatedTimeStr(assignment.meeting_time);
    setIsModalOpen(true);
  };

  const handleSpeakerChange = (spkId: string) => {
    setFormSpeakerId(spkId);
    setFormTalkId('');
    if (localTalks.length > 0) {
      setFormTalkId(localTalks[0].id);
      setFormSongNumber(localTalks[0].song_number);
    } else {
      setFormSongNumber(1);
    }
  };

  const handleTalkChange = (tlkId: string) => {
    setFormTalkId(tlkId);
    const chosen = localTalks.find((t) => t.id === tlkId);
    if (chosen) {
      setFormSongNumber(chosen.song_number);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCongregation) return;

    if (!formDestinationCongId) {
      showToast('Por favor selecciona la congregación de destino.', 'error');
      return;
    }
    if (!formSpeakerId) {
      showToast('Por favor selecciona al conferenciante local.', 'error');
      return;
    }
    if (!formTalkId) {
      showToast('Por favor selecciona la conferencia/discurso.', 'error');
      return;
    }
    if (!calculatedDateStr || !calculatedTimeStr) {
      showToast('No se pudo determinar la fecha u hora de destino.', 'error');
      return;
    }

    try {
      if (editingAssignment) {
        await dataService.updateOutgoingAssignment(editingAssignment.id, {
          destination_congregation_id: formDestinationCongId,
          speaker_id: formSpeakerId,
          talk_id: formTalkId,
          song_number: formSongNumber,
          month: selectedMonth,
          year: selectedYear,
          week_number: formWeekNumber,
          meeting_date: calculatedDateStr,
          meeting_time: calculatedTimeStr,
          notes: formNotes.trim() || undefined,
        });
        showToast('Asignación de salida actualizada exitosamente.');
      } else {
        await dataService.createOutgoingAssignment({
          local_congregation_id: currentCongregation.id,
          destination_congregation_id: formDestinationCongId,
          speaker_id: formSpeakerId,
          talk_id: formTalkId,
          song_number: formSongNumber,
          month: selectedMonth,
          year: selectedYear,
          week_number: formWeekNumber,
          meeting_date: calculatedDateStr,
          meeting_time: calculatedTimeStr,
          notes: formNotes.trim() || undefined,
        });
        showToast('Conferencia de salida registrada.');
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
      await dataService.deleteOutgoingAssignment(deletingId);
      showToast('Asignación de salida eliminada.');
      setDeletingId(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'No se pudo eliminar.', 'error');
      setDeletingId(null);
    }
  };

  const selectedDestCong = allCongregations.find((c) => c.id === formDestinationCongId);
  const speakerTalks = localTalks;
  const monthLabel = `${SPANISH_MONTHS[selectedMonth - 1]} ${selectedYear}`;

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Por favor selecciona una congregación en la barra lateral para ver y gestionar las salidas de conferenciantes locales."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Conferencias de Salida
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Conferenciantes locales de {currentCongregation?.name} que visitan otras congregaciones en {monthLabel}
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

          {!isBrotherViewer && (
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={localSpeakers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Salida</span>
            </button>
          )}
        </div>
      </div>

      {/* Assignments Cards List */}
      {assignments.length === 0 ? (
        <EmptyState
          title={`No hay conferencias de salida para ${monthLabel}`}
          description={
            isBrotherViewer
              ? "No se han programado conferencias de salida para este mes."
              : "Registra las visitas que los conferenciantes locales realizarán a otras congregaciones."
          }
          actionLabel={isBrotherViewer ? undefined : "Registrar Conferencia de Salida"}
          onAction={isBrotherViewer ? undefined : handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Date & Time Header (Notice: Exact Date & Time, NO week_number displayed as title per prompt rule 10) */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatFullSpanishDate(assignment.meeting_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono tabular-nums font-semibold text-slate-800">
                        {formatTime12Hour(assignment.meeting_time)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        (Horario de {assignment.destination_congregation_name})
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

                {/* Speaker & Destination */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Conferenciante Local
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                      {assignment.speaker_name}
                    </p>
                    {assignment.speaker_phone && (
                      <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                        {assignment.speaker_phone}
                      </span>
                    )}
                    {assignment.speaker_phone && (
                      <a href={whatsAppUrl(assignment.speaker_phone, `Hola ${assignment.speaker_name}, te recordamos tu conferencia en ${assignment.destination_congregation_name} el ${assignment.meeting_date} a las ${assignment.meeting_time}.`)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800">
                        <MessageCircle className="w-3.5 h-3.5" /> Avisar por WhatsApp
                      </a>
                    )}
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Congregación Destino
                    </span>
                    <p className="text-xs font-bold text-sky-900 mt-0.5 truncate">
                      {assignment.destination_congregation_name}
                    </p>
                  </div>
                </div>

                {/* Notes if any */}
                {assignment.notes && (
                  <p className="text-xs text-slate-500 italic bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                    {assignment.notes}
                  </p>
                )}
              </div>

              {/* Actions Footer (Solo para Coordinadores y Administradores) */}
              {!isBrotherViewer && (
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(assignment)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva / Editar Salida */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? 'Editar Conferencia de Salida' : 'Nueva Conferencia de Salida'}
        subtitle={`Congregación local: ${currentCongregation?.name}`}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Semana del Mes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                1. Semana del Mes ({monthLabel}) *
              </label>
              <span className="text-[11px] text-slate-400">Auxiliar de organización</span>
            </div>
            <select
              value={formWeekNumber}
              onChange={(e) => setFormWeekNumber(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value={1}>1.ª semana</option>
              <option value={2}>2.ª semana</option>
              <option value={3}>3.ª semana</option>
              <option value={4}>4.ª semana</option>
              <option value={5}>5.ª semana</option>
            </select>
          </div>

          {/* 2. Congregación de Destino */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              2. Congregación de Destino *
            </label>
            <select
              required
              value={formDestinationCongId}
              onChange={(e) => setFormDestinationCongId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="" disabled>
                -- Seleccionar congregación de destino --
              </option>
              {allCongregations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.weekend_meeting_day} a las {formatTime12Hour(c.weekend_meeting_time)})
                </option>
              ))}
            </select>
          </div>

          {/* 3 & 4. Automatic Calculated Date and Time Box */}
          {selectedDestCong && (
            <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900 block">
                Cálculo Automático de Reunión en Destino
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Día y Fecha calculada:</span>
                  <strong className="text-slate-900 text-sm font-semibold block mt-0.5">
                    {calculatedDateStr ? formatFullSpanishDate(calculatedDateStr) : 'Calculando...'}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 block">Hora de inicio de destino:</span>
                  <strong className="text-slate-900 text-sm font-mono block mt-0.5">
                    {calculatedTimeStr ? formatTime12Hour(calculatedTimeStr) : '--'}
                  </strong>
                </div>
              </div>

              {dateCalculationWarning && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100/70 p-2 rounded-lg mt-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dateCalculationWarning}</span>
                </div>
              )}
            </div>
          )}

          {/* 5. Conferenciante Local */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              5. Conferenciante Local de {currentCongregation?.name} *
            </label>
            <select
              required
              value={formSpeakerId}
              onChange={(e) => handleSpeakerChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="" disabled>
                -- Seleccionar conferenciante local --
              </option>
              {localSpeakers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.phone})
                </option>
              ))}
            </select>
          </div>

          {/* 6. Conferencia */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              6. Conferencia / Discurso a Presentar *
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
                    : 'No hay conferencias registradas en el catálogo'
                  : 'Primero selecciona el conferenciante local'}
              </option>
              {speakerTalks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} (Canción {t.song_number})
                </option>
              ))}
            </select>
          </div>

          {/* 7. Canción */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              7. Número de Canción (Automática del Discurso) *
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
              Notas u Observaciones (Opcional)
            </label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ej. Viaja en vehículo propio, salida a las 8:00 AM..."
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
              {editingAssignment ? 'Guardar Cambios' : 'Registrar Salida'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Eliminar Conferencia de Salida"
        message="¿Estás seguro de que deseas eliminar esta asignación de salida del programa?"
        confirmLabel="Eliminar"
        isDanger={true}
      />
    </div>
  );
};
