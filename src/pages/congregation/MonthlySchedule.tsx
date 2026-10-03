import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Upload,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { IncomingAssignment, OutgoingAssignment } from '../../types/database';
import { MonthSelector } from '../../components/common/MonthSelector';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../components/common/Toast';
import {
  formatTime12Hour,
  getCurrentMonthAndYear,
  SPANISH_MONTHS,
  SPANISH_DAYS,
  parseDateParts,
} from '../../utils/dateUtils';

export const MonthlySchedule: React.FC = () => {
  const { currentCongregation, refreshData } = useAuth();
  const { showToast } = useToast();
  const initial = getCurrentMonthAndYear();

  const [selectedMonth, setSelectedMonth] = useState(initial.month);
  const [selectedYear, setSelectedYear] = useState(initial.year);
  const [incoming, setIncoming] = useState<IncomingAssignment[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Logo upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentCongregation) {
      loadData();
    }
  }, [currentCongregation?.id, selectedMonth, selectedYear]);

  const loadData = async () => {
    if (!currentCongregation) return;
    setIsLoading(true);
    try {
      const [inc, out] = await Promise.all([
        dataService.getIncomingAssignments(currentCongregation.id, selectedMonth, selectedYear),
        dataService.getOutgoingAssignments(currentCongregation.id, selectedMonth, selectedYear),
      ]);
      setIncoming(inc);
      setOutgoing(out);
    } catch (err) {
      console.error('Error loading schedule data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCongregation) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen es demasiado grande. Elige una de hasta 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await dataService.uploadCongregationLogo(currentCongregation.id, dataUrl);
        await refreshData();
        showToast('Logo de la congregación actualizado.');
      } catch (err: any) {
        showToast(err.message || 'Error al guardar el logo', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!currentCongregation) return;
    try {
      await dataService.removeCongregationLogo(currentCongregation.id);
      await refreshData();
      showToast('Logo eliminado.');
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar el logo', 'error');
    }
  };

  const monthLabel = `${SPANISH_MONTHS[selectedMonth - 1]} de ${selectedYear}`;

  const formatScheduleDate = (dateStr: string) => {
    if (!dateStr) return { dayName: '', dayNumber: '', monthName: '', full: '' };
    const { year, month, day } = parseDateParts(dateStr);
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);
    const dayName = SPANISH_DAYS[dateObj.getDay()];
    const monthName = SPANISH_MONTHS[month - 1];
    return {
      dayName,
      dayNumber: day,
      monthName,
      full: `${dayName} ${day} de ${monthName}`,
    };
  };

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Por favor selecciona una congregación en la barra lateral para ver su programa mensual imprimible."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Acciones (Oculta en Impresión) */}
      <div className="no-print bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Programa de Reuniones de Fin de Semana
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Vista previa y formato de impresión para {monthLabel}
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
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Guardar PDF</span>
          </button>
        </div>
      </div>

      {/* Gestor rápido de Logo (Oculto en Impresión) */}
      <div className="no-print bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            {currentCongregation?.logo_url ? (
              <img
                src={currentCongregation.logo_url}
                alt="Logo Congregación"
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-4 h-4 text-slate-300" />
            )}
          </div>
          <div>
            <span className="font-semibold text-slate-800 block">
              Logo de la Congregación
            </span>
            <span className="text-slate-500">
              {currentCongregation?.logo_url
                ? 'Logo activo en la esquina superior del programa impreso.'
                : 'Opcional: puedes subir un logo o distintivo para el encabezado.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadLogo}
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-medium transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{currentCongregation?.logo_url ? 'Cambiar logo' : 'Subir logo'}</span>
          </button>
          {currentCongregation?.logo_url && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
              title="Eliminar logo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HOJA IMPRIMIBLE DEL PROGRAMA (LIMPIA, NO ABULTADA Y MUY FÁCIL DE LEER)      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-8 print:border-none print:shadow-none print:p-0 max-w-4xl mx-auto text-slate-900">
        
        {/* ENCABEZADO PRINCIPAL */}
        <header className="flex items-start justify-between pb-3.5 mb-5 border-b-2 border-slate-800 gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
              Programa para la reunión de fin de semana
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-700 font-medium">
              <span className="font-bold text-slate-900">
                {currentCongregation?.name}
              </span>
              <span aria-hidden="true" className="text-slate-400 font-bold">|</span>
              <span className="font-semibold text-slate-800">
                {monthLabel}
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-slate-600">
                {currentCongregation?.weekend_meeting_day}s a las{' '}
                <strong className="font-mono text-slate-900">
                  {formatTime12Hour(currentCongregation?.weekend_meeting_time || '09:30')}
                </strong>
              </span>
            </div>
          </div>

          {currentCongregation?.logo_url ? (
            <div className="shrink-0 flex items-center justify-end">
              <img
                src={currentCongregation.logo_url}
                alt={`Logo ${currentCongregation.name}`}
                className="max-h-11 max-w-[110px] object-contain"
              />
            </div>
          ) : null}
        </header>

        {/* ========================================================================= */}
        {/* SECCIÓN 1: ENTRADAS                                                       */}
        {/* ========================================================================= */}
        <section className="mb-6 print-break-inside-avoid">
          {/* Barra de título azul oscuro tipo membrete */}
          <div className="bg-[#173d63] text-white py-1.5 px-4 text-center font-bold text-xs sm:text-sm tracking-widest uppercase rounded-t-md print:rounded-none">
            ENTRADAS
          </div>

          <div className="overflow-x-auto border-x border-b border-slate-300 rounded-b-md print:rounded-none">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-300">
                  <th className="py-2 px-3 w-[18%]">Fecha y Hora</th>
                  <th className="py-2 px-3 w-[20%]">Presidente</th>
                  <th className="py-2 px-3 w-[24%]">Orador Visitante</th>
                  <th className="py-2 px-3 w-[20%]">Congregación</th>
                  <th className="py-2 px-3 w-[18%]">Lector</th>
                </tr>
              </thead>
              {incoming.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={5} className="py-4 px-3 text-center text-xs text-slate-400 italic">
                      No hay conferencias de entrada programadas para este mes.
                    </td>
                  </tr>
                </tbody>
              ) : (
                incoming.map((item, idx) => {
                  const dateInfo = formatScheduleDate(item.meeting_date);

                  if (item.is_no_meeting) {
                    return (
                      <tbody key={item.id} className="border-b-2 border-slate-300 print-break-inside-avoid">
                        <tr className="bg-amber-50/70 border-y border-amber-200 print:bg-slate-100 print:border-slate-300">
                          <td className="py-2.5 px-3 align-middle border-r border-slate-200">
                            <span className="font-bold text-slate-900 block leading-tight">
                              {dateInfo.dayName} {dateInfo.dayNumber}
                            </span>
                            <span className="font-mono text-slate-600 text-[11px] block mt-0.5">
                              {formatTime12Hour(item.meeting_time)}
                            </span>
                          </td>
                          <td colSpan={4} className="py-2.5 px-3 align-middle">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-amber-900 print:text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                                  NO HAY REUNIÓN
                                </span>
                                {item.no_meeting_reason && (
                                  <span className="text-xs sm:text-sm font-semibold text-slate-700">
                                    — {item.no_meeting_reason}
                                  </span>
                                )}
                              </div>
                              {item.president_name && (
                                <span className="text-[11px] font-medium text-slate-500 italic">
                                  Presidente local: <strong className="text-slate-700">{item.president_name}</strong>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    );
                  }

                  return (
                    <tbody
                      key={item.id}
                      className={`border-b-2 border-slate-300 print-break-inside-avoid ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Fila Superior: Hermanos y Congregación */}
                      <tr>
                        <td
                          rowSpan={2}
                          className="py-2.5 px-3 align-middle border-r border-slate-200 w-[18%] bg-slate-50/60 print:bg-transparent"
                        >
                          <span className="font-bold text-slate-900 block leading-tight text-sm">
                            {dateInfo.dayName} {dateInfo.dayNumber}
                          </span>
                          <span className="font-mono text-slate-600 text-[11px] block mt-0.5">
                            {formatTime12Hour(item.meeting_time)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-middle text-slate-900 font-medium w-[20%]">
                          {item.president_name || '--'}
                        </td>
                        <td className="py-2.5 px-3 align-middle font-bold text-slate-900 w-[24%]">
                          {item.speaker_name || '--'}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-slate-700 font-medium w-[20%]">
                          {item.origin_congregation_name || '--'}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-slate-800 font-medium w-[18%]">
                          {item.reader_name || '--'}
                        </td>
                      </tr>

                      {/* Fila Inferior: Título de la Conferencia Abajo */}
                      <tr className="border-t border-slate-200/70 bg-slate-50/80 print:bg-transparent">
                        <td colSpan={4} className="py-1.5 px-3 align-middle">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider shrink-0">
                                Discurso:
                              </span>
                              <span className="font-semibold text-slate-900 leading-snug text-md sm:text-md">
                                {item.talk_title ? `“${item.talk_title}”` : <span className="italic text-slate-400 font-normal">Por asignar</span>}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  );
                })
              )}
            </table>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECCIÓN 2: SALIDAS                                                        */}
        {/* ========================================================================= */}
        <section className="mb-6 print-break-inside-avoid">
          {/* Barra de título azul oscuro tipo membrete */}
          <div className="bg-[#173d63] text-white py-1.5 px-4 text-center font-bold text-xs sm:text-sm tracking-widest uppercase rounded-t-md print:rounded-none">
            SALIDAS
          </div>

          <div className="overflow-x-auto border-x border-b border-slate-300 rounded-b-md print:rounded-none">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b border-slate-300">
                  <th className="py-2 px-3 w-[22%]">Fecha y Hora</th>
                  <th className="py-2 px-3 w-[39%]">Discursante</th>
                  <th className="py-2 px-3 w-[39%]">Congregación Destino</th>
                </tr>
              </thead>
              {outgoing.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-center text-xs text-slate-400 italic">
                      No hay conferencias de salida programadas para este mes.
                    </td>
                  </tr>
                </tbody>
              ) : (
                outgoing.map((item, idx) => {
                  const dateInfo = formatScheduleDate(item.meeting_date);
                  return (
                    <tbody
                      key={item.id}
                      className={`border-b-2 border-slate-300 print-break-inside-avoid ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Fila Superior: Hermanos y Destino */}
                      <tr>
                        <td
                          rowSpan={2}
                          className="py-2.5 px-3 align-middle border-r border-slate-200 w-[22%] bg-slate-50/60 print:bg-transparent"
                        >
                          <span className="font-bold text-slate-900 block leading-tight text-sm">
                            {dateInfo.dayName} {dateInfo.dayNumber}
                          </span>
                          <span className="font-mono text-slate-600 text-[11px] block mt-0.5">
                            {formatTime12Hour(item.meeting_time)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-middle font-bold text-slate-900 w-[39%]">
                          {item.speaker_name || '--'}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-slate-800 font-medium w-[39%]">
                          {item.destination_congregation_name || '--'}
                        </td>
                      </tr>

                      {/* Fila Inferior: Título de la Conferencia Abajo */}
                      <tr className="border-t border-slate-200/70 bg-slate-50/80 print:bg-transparent">
                        <td colSpan={2} className="py-1.5 px-3 align-middle">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider shrink-0">
                                Discurso:
                              </span>
                              <span className="font-semibold text-slate-900 leading-snug text-md md:text-md">
                                {item.talk_title ? `“${item.talk_title}”` : <span className="italic text-slate-400 font-normal">Por asignar</span>}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  );
                })
              )}
            </table>
          </div>
        </section>

        {/* PIE DE PÁGINA LIMPIO Y ELEGANTE */}
        <footer className="mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Programa · {currentCongregation?.name}
          </span>
        </footer>
      </div>
    </div>
  );
};

