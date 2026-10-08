import React, { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Music,
  MapPin,
  User,
  UserCheck,
  BookOpen,
  Edit2,
  Trash2,
  Phone,
  MessageCircle,
  Sparkles,
  Info,
  CalendarX,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import {
  IncomingAssignment,
  Congregation,
  Speaker,
  Talk,
  Reader,
} from '../../types/database';
import { MonthSelector } from '../../components/common/MonthSelector';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { EmptyState } from '../../components/common/EmptyState';
import { SmartTalkSearch } from '../../components/common/SmartTalkSearch';
import { whatsAppUrl } from '../../utils/whatsapp';
import {
  formatFullSpanishDate,
  formatTime12Hour,
  getCurrentMonthAndYear,
  getMeetingDatesInMonth,
  SPANISH_MONTHS,
} from '../../utils/dateUtils';

export const IncomingAssignments: React.FC = () => {
  const { currentCongregation, role } = useAuth();
  const isBrotherViewer = role === 'brother_viewer';
  const { showToast } = useToast();
  const initial = getCurrentMonthAndYear();

  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [assignments, setAssignments] = useState<IncomingAssignment[]>([]);
  const [allCongregations, setAllCongregations] = useState<Congregation[]>([]);
  const [allSpeakers, setAllSpeakers] = useState<Speaker[]>([]);
  const [allTalks, setAllTalks] = useState<Talk[]>([]);
  const [allReaders, setAllReaders] = useState<Reader[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<IncomingAssignment | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState('');
  const [formOriginCongId, setFormOriginCongId] = useState('');
  const [formSpeakerId, setFormSpeakerId] = useState('');
  const [formTalkId, setFormTalkId] = useState('');
  const [formReaderId, setFormReaderId] = useState('');
  const [formPresidentId, setFormPresidentId] = useState('');
  const [formSongNumber, setFormSongNumber] = useState<number>(1);
  const [formIsNoMeeting, setFormIsNoMeeting] = useState(false);
  const [formNoMeetingReason, setFormNoMeetingReason] = useState('');
  const [formIsMemorial, setFormIsMemorial] = useState(false);
  const [formMemorialDate, setFormMemorialDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Quick Reader Modal State
  const [isQuickReaderModalOpen, setIsQuickReaderModalOpen] = useState(false);
  const [quickReaderName, setQuickReaderName] = useState('');
  const [quickReaderPhone, setQuickReaderPhone] = useState('');

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
      const [list, congs, spks, tlks, rdrs] = await Promise.all([
        dataService.getIncomingAssignments(currentCongregation.id, selectedMonth, selectedYear),
        dataService.getCongregations(),
        dataService.getSpeakers(),
        dataService.getTalks(),
        dataService.getReaders(currentCongregation.id),
      ]);
      setAssignments(list);
      // Filter out local congregation for origins list
      setAllCongregations(congs.filter((c) => c.is_active && c.id !== currentCongregation.id));
      setAllSpeakers(spks.filter((s) => s.is_active));
      setAllTalks(tlks.filter((t) => t.is_active));
      setAllReaders(rdrs.filter((r) => r.is_active));
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

  // Filtered brothers eligible to preside and read
  const presidentCandidates = allReaders.filter((r) => r.can_preside);
  const displayPresidents = presidentCandidates.length > 0 ? presidentCandidates : allReaders;

  const readerCandidates = allReaders.filter((r) => r.can_read !== false);
  const displayReaders = readerCandidates.length > 0 ? readerCandidates : allReaders;

  // Filtered speakers based on selected origin congregation
  const originSpeakers = allSpeakers.filter(
    (s) => s.congregation_id === formOriginCongId
  );

  // Filtered talks based on selected speaker
  const speakerTalks = allTalks.filter((talk) => talk.congregation_id === formOriginCongId);

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    // Pick first available weekend date of current month
    const defaultDate = availableDatesInMonth[0]?.dateStr || '';
    setFormDate(defaultDate);
    setFormOriginCongId('');
    setFormSpeakerId('');
    setFormTalkId('');
    setFormReaderId('');
    setFormPresidentId('');
    setFormSongNumber(1);
    setFormIsNoMeeting(false);
    setFormNoMeetingReason('');
    setFormIsMemorial(false);
    setFormMemorialDate('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (assignment: IncomingAssignment) => {
    setEditingAssignment(assignment);
    setFormDate(assignment.meeting_date);
    setFormOriginCongId(assignment.origin_congregation_id || '');
    setFormSpeakerId(assignment.speaker_id || '');
    setFormTalkId(assignment.talk_id || '');
    setFormReaderId(assignment.reader_id || '');
    setFormPresidentId(assignment.president_id || '');
    setFormSongNumber(assignment.song_number || 1);
    setFormIsNoMeeting(Boolean(assignment.is_no_meeting));
    setFormNoMeetingReason(assignment.no_meeting_reason || '');
    setFormIsMemorial(Boolean(assignment.is_memorial));
    setFormMemorialDate(assignment.memorial_date || '');
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
    const spkTalks = allTalks.filter((talk) => talk.congregation_id === formOriginCongId);
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
    if (formIsMemorial && !formMemorialDate) {
      showToast('Selecciona la fecha de la Conmemoración.', 'error');
      return;
    }

    if (formIsNoMeeting) {
      if (!formNoMeetingReason.trim()) {
        showToast('Por favor escribe la razón por la cual no hay reunión (ej. Asamblea de Circuito).', 'error');
        return;
      }
    } else {
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
    }

    // Auto-filled meeting time from local congregation
    const localMeetingTime = currentCongregation.weekend_meeting_time;

    const payload = {
      meeting_date: formDate,
      meeting_time: localMeetingTime,
      is_no_meeting: formIsNoMeeting,
      no_meeting_reason: formIsNoMeeting ? formNoMeetingReason.trim() : undefined,
      is_memorial: formIsMemorial,
      memorial_date: formIsMemorial ? formMemorialDate : undefined,
      president_id: formPresidentId || undefined,
      origin_congregation_id: formIsNoMeeting ? undefined : formOriginCongId,
      speaker_id: formIsNoMeeting ? undefined : formSpeakerId,
      talk_id: formIsNoMeeting ? undefined : formTalkId,
      reader_id: formIsNoMeeting ? undefined : (formReaderId || undefined),
      song_number: formIsNoMeeting ? undefined : formSongNumber,
      notes: formNotes.trim() || undefined,
    };

    try {
      if (editingAssignment) {
        await dataService.updateIncomingAssignment(editingAssignment.id, payload);
        showToast(
          formIsNoMeeting
            ? 'Fecha sin reunión actualizada exitosamente.'
            : 'Conferencia de entrada actualizada exitosamente.'
        );
      } else {
        await dataService.createIncomingAssignment({
          local_congregation_id: currentCongregation.id,
          ...payload,
        });
        showToast(
          formIsNoMeeting
            ? 'Fecha sin reunión guardada (solo visible localmente).'
            : 'Conferencia de entrada registrada.'
        );
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar la asignación.', 'error');
    }
  };

  const handleCreateQuickReader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCongregation || !quickReaderName.trim()) return;
    try {
      const newRdr = await dataService.createReader({
        congregation_id: currentCongregation.id,
        full_name: quickReaderName.trim(),
        phone: quickReaderPhone.trim() || undefined,
        is_active: true,
      });
      showToast(`Lector ${newRdr.full_name} añadido.`);
      const refreshed = await dataService.getReaders(currentCongregation.id);
      setAllReaders(refreshed.filter((r) => r.is_active));
      setFormReaderId(newRdr.id);
      setQuickReaderName('');
      setQuickReaderPhone('');
      setIsQuickReaderModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Error al registrar lector local', 'error');
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

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Por favor selecciona una congregación en la barra lateral para ver y gestionar las visitas de conferenciantes."
      />
    );
  }

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

          {!isBrotherViewer && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Entrada</span>
            </button>
          )}
        </div>
      </div>

      {/* Assignments Cards List */}
      {assignments.length === 0 ? (
        <EmptyState
          title={`No hay conferencias de entrada para ${monthLabel}`}
          description={
            isBrotherViewer
              ? `No se han programado conferencias de entrada para este mes.`
              : `Registra a los conferenciantes visitantes para los ${currentCongregation?.weekend_meeting_day}s de este mes.`
          }
          actionLabel={isBrotherViewer ? undefined : "Registrar Conferencia de Entrada"}
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
                {assignment.is_no_meeting ? (
                  <>
                    {/* Date & Time Header for No Meeting */}
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-amber-200/70">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
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

                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        <CalendarX className="w-3.5 h-3.5 text-amber-700" />
                        No hay Reunión
                      </span>
                    </div>

                    {/* Motivo Banner */}
                    <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Motivo Registrado (Solo Visible Localmente)
                      </span>
                      <p className="text-sm font-bold text-slate-900 leading-snug">
                        {assignment.no_meeting_reason || 'Sin motivo especificado'}
                      </p>
                    </div>

                    {/* Presidente Local if assigned */}
                    {assignment.president_name && (
                      <div className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 block">
                            Presidente Local Asignado
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-0.5">
                            {assignment.president_name}
                          </p>
                        </div>
                        <UserCheck className="w-4 h-4 text-purple-500 shrink-0" />
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                    {assignment.is_memorial && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                        Conmemoración de la muerte de Jesús · {assignment.memorial_date ? formatFullSpanishDate(assignment.memorial_date) : 'Fecha pendiente'}
                      </div>
                    )}

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

                    {/* Presidente y Lector Locales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      <div className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 block">
                            Presidente ({currentCongregation?.name})
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                            {assignment.president_name || 'Sin asignar'}
                          </p>
                          {assignment.president_phone && assignment.president_name && (
                            <a href={whatsAppUrl(assignment.president_phone, `Hola ${assignment.president_name}, te recordamos que presides la reunión del ${assignment.meeting_date} a las ${assignment.meeting_time}.`)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <MessageCircle className="w-3 h-3" /> WhatsApp
                            </a>
                          )}
                        </div>
                        <UserCheck className="w-4 h-4 text-purple-500 shrink-0" />
                      </div>

                      <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 block">
                            Lector Atalaya ({currentCongregation?.name})
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                            {assignment.reader_name || 'Sin asignar'}
                          </p>
                          {assignment.reader_phone && assignment.reader_name && (
                            <a href={whatsAppUrl(assignment.reader_phone, `Hola ${assignment.reader_name}, te recordamos tu lectura de La Atalaya el ${assignment.meeting_date} a las ${assignment.meeting_time}.`)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <MessageCircle className="w-3 h-3" /> WhatsApp
                            </a>
                          )}
                        </div>
                        <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                      </div>
                    </div>
                  </>
                )}

                {/* Notes if any */}
                {assignment.notes && (
                  <p className="text-xs text-slate-500 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Nueva / Editar Entrada */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          formIsNoMeeting
            ? 'Registro: Fecha Sin Reunión Local'
            : editingAssignment
            ? 'Editar Conferencia de Entrada'
            : 'Nueva Conferencia de Entrada'
        }
        subtitle={`Congregación receptora: ${currentCongregation?.name}`}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Casilla Especial: No Hay Reunión */}
          <div
            className={`p-3.5 rounded-xl border transition-colors ${
              formIsNoMeeting
                ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-500/20'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsNoMeeting}
                onChange={(e) => setFormIsNoMeeting(e.target.checked)}
                className="w-4.5 h-4.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900">
                  No hay Reunión en esta fecha
                </span>
                <p className="text-[11px] text-slate-500">
                  Activa esta opción si habrá asamblea o evento especial donde no se reciben visitas.
                </p>
              </div>
            </label>

            {formIsNoMeeting && (
              <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1.5">
                <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                  Razón o Motivo * (Solo visible en la congregación local)
                </label>
                <input
                  type="text"
                  required={formIsNoMeeting}
                  value={formNoMeetingReason}
                  onChange={(e) => setFormNoMeetingReason(e.target.value)}
                  placeholder="Ej. Asamblea de Circuito, Visita de Superintendente de Circuito..."
                  className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-slate-900"
                />
                <p className="text-[11px] text-amber-800 italic">
                  * Este dato no se compartirá ni generará registros de salida en ninguna otra congregación.
                </p>
              </div>
            )}
          </div>

          <div className={`p-3.5 rounded-xl border ${formIsMemorial ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={formIsMemorial} onChange={(e) => {
                setFormIsMemorial(e.target.checked);
                if (!e.target.checked) setFormMemorialDate('');
              }} className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
              <span className="text-xs font-bold text-slate-900">Conmemoración de la muerte de Jesús</span>
            </label>
            {formIsMemorial && (
              <div className="mt-3">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-rose-900">Fecha de la Conmemoración *</label>
                <input type="date" required value={formMemorialDate} onChange={(e) => setFormMemorialDate(e.target.value)} className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20" />
              </div>
            )}
          </div>

          {/* Presidente de la Reunión (Local) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Presidente de la Reunión ({currentCongregation?.name})
              </label>
              <span className="text-[11px] text-slate-400">Hermano local</span>
            </div>
            <select
              value={formPresidentId}
              onChange={(e) => setFormPresidentId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            >
              <option value="">-- Sin presidente asignado (pendiente) --</option>
              {displayPresidents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} {p.phone ? `(${p.phone})` : ''} {p.can_preside ? '★' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Hermanos configurados con función de presidir en la sección &ldquo;Lectores y Presidentes&rdquo;.
            </p>
          </div>

          {/* Si NO hay reunión, omitimos el resto de campos de conferenciante visitante */}
          {!formIsNoMeeting && (
            <>
              {/* Smart Search Bar */}
              <div className="pt-2 border-t border-slate-100">
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

              {/* 2. Congregación Originaria */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  2. Congregación Originaria del Visitante *
                </label>
                <select
                  required={!formIsNoMeeting}
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
                  required={!formIsNoMeeting}
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
                  required={!formIsNoMeeting}
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
                    required={!formIsNoMeeting}
                    readOnly
                    value={formSongNumber}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-xl font-mono text-slate-700 select-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 6. Lector de La Atalaya (Local) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    6. Lector de La Atalaya ({currentCongregation?.name})
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickReaderModalOpen(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Añadir Lector</span>
                  </button>
                </div>
                <select
                  value={formReaderId}
                  onChange={(e) => setFormReaderId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Sin asignar / Pendiente --</option>
                  {displayReaders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} {r.phone ? `(${r.phone})` : ''} {r.can_read !== false ? '✓' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hermano de la congregación local que dará lectura a los párrafos de La Atalaya.
                </p>
              </div>
            </>
          )}

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Notas adicionales (Opcional)
            </label>
            <input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ej. Confirmado con el hermano o detalles particulares"
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
              className={`px-5 py-2 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors ${
                formIsNoMeeting
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {formIsNoMeeting
                ? 'Guardar Fecha Sin Reunión'
                : editingAssignment
                ? 'Guardar Cambios'
                : 'Registrar Entrada'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Rápido Añadir Lector */}
      <Modal
        isOpen={isQuickReaderModalOpen}
        onClose={() => setIsQuickReaderModalOpen(false)}
        title="Registrar Nuevo Lector Local"
        subtitle={`Congregación: ${currentCongregation?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleCreateQuickReader} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nombre Completo del Hermano Lector *
            </label>
            <input
              type="text"
              required
              value={quickReaderName}
              onChange={(e) => setQuickReaderName(e.target.value)}
              placeholder="Ej. Mario Alvarado"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Teléfono de Contacto (Opcional)
            </label>
            <input
              type="tel"
              value={quickReaderPhone}
              onChange={(e) => setQuickReaderPhone(e.target.value)}
              placeholder="Ej. 7890-1234"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsQuickReaderModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
            >
              Guardar y Asignar
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
