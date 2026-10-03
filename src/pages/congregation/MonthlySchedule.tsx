import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Download,
  Upload,
  Trash2,
  Calendar,
  Clock,
  Music,
  MapPin,
  User,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { IncomingAssignment, OutgoingAssignment } from '../../types/database';
import { MonthSelector } from '../../components/common/MonthSelector';
import { useToast } from '../../components/common/Toast';
import {
  formatFullSpanishDate,
  formatTime12Hour,
  getCurrentMonthAndYear,
  SPANISH_MONTHS,
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

  return (
    <div className="space-y-6">
      {/* Action Bar (hidden in print) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Programa de Reuniones de Fin de Semana
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Vista preliminar, formato de impresión oficial y descarga para {monthLabel}
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

      {/* Logo manager quick card (hidden in print) */}
      <div className="no-print bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            {currentCongregation?.logo_url ? (
              <img
                src={currentCongregation.logo_url}
                alt="Logo Congregación"
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-slate-300" />
            )}
          </div>
          <div>
            <span className="font-semibold text-slate-800 block">
              Logo de la Congregación en el Encabezado
            </span>
            <span className="text-slate-500">
              {currentCongregation?.logo_url
                ? 'Logo activo. Aparecerá en la esquina superior derecha del programa impreso.'
                : 'Sin logo cargado. Puedes subir un escudo o monograma para personalizar el documento.'}
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
      {/* FORMAL PRINTABLE DOCUMENT CANVAS (VISIBLE ON SCREEN AND IN PRINT)          */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 print:border-none print:shadow-none print:p-0 max-w-4xl mx-auto">
        {/* ENCABEZADO OFICIAL */}
        <header className="flex items-start justify-between pb-6 border-b-2 border-slate-800 gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold block mb-1">
              Programa de Reuniones de Fin de Semana
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {currentCongregation?.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
              <span className="font-semibold text-indigo-700 uppercase tracking-wide">
                Mes: {monthLabel}
              </span>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <span>
                Reunión habitual: <strong>{currentCongregation?.weekend_meeting_day}s</strong> a las{' '}
                <strong className="font-mono tabular-nums">
                  {formatTime12Hour(currentCongregation?.weekend_meeting_time || '09:30')}
                </strong>
              </span>
            </div>
          </div>

          {/* Espacio reservado para Logo */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2 shrink-0">
            {currentCongregation?.logo_url ? (
              <img
                src={currentCongregation.logo_url}
                alt={`Logo ${currentCongregation.name}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center p-2 text-slate-300 font-serif italic text-xs leading-tight">
                Espacio de Logo
              </div>
            )}
          </div>
        </header>

        {/* ========================================================================= */}
        {/* SECCIÓN 1: CONFERENCIAS DE ENTRADA (VISITANTES)                            */}
        {/* ========================================================================= */}
        <section className="mt-8 print-break-inside-avoid">
          <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 no-print" />
              <span>Conferencias de Entrada (Oradores Visitantes)</span>
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {incoming.length} {incoming.length === 1 ? 'conferencia' : 'conferencias'}
            </span>
          </div>

          {incoming.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
              No se han programado conferencias de entrada para este mes.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 print:bg-slate-100 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Conferenciante</th>
                    <th className="py-2.5 px-3">Congregación Origen</th>
                    <th className="py-2.5 px-3">Conferencia / Discurso</th>
                    <th className="py-2.5 px-3 text-right">Canción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incoming.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 print-break-inside-avoid">
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">
                          {formatFullSpanishDate(item.meeting_date)}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {formatTime12Hour(item.meeting_time)}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top font-medium text-slate-900">
                        {item.speaker_name}
                        {item.speaker_phone && (
                          <span className="block text-[11px] font-mono text-slate-400 no-print">
                            {item.speaker_phone}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-slate-700">
                        {item.origin_congregation_name}
                      </td>
                      <td className="py-3 px-3 align-top font-semibold text-slate-800">
                        &ldquo;{item.talk_title}&rdquo;
                        {item.notes && (
                          <span className="block text-[11px] text-slate-400 font-normal italic mt-0.5 no-print">
                            {item.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono font-bold text-slate-800">
                        Canto {item.song_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* SECCIÓN 2: CONFERENCIAS DE SALIDA                                         */}
        {/* ========================================================================= */}
        <section className="mt-10 print-break-inside-avoid">
          <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-sky-600 no-print" />
              <span>Conferencias de Salida (Oradores Locales Fuera)</span>
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {outgoing.length} {outgoing.length === 1 ? 'conferencia' : 'conferencias'}
            </span>
          </div>

          {outgoing.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
              No se han programado salidas para este mes.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 print:bg-slate-100 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Conferenciante Local</th>
                    <th className="py-2.5 px-3">Congregación Destino</th>
                    <th className="py-2.5 px-3">Conferencia / Discurso</th>
                    <th className="py-2.5 px-3 text-right">Canción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outgoing.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 print-break-inside-avoid">
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">
                          {formatFullSpanishDate(item.meeting_date)}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {formatTime12Hour(item.meeting_time)}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top font-medium text-slate-900">
                        {item.speaker_name}
                      </td>
                      <td className="py-3 px-3 align-top font-medium text-sky-900">
                        {item.destination_congregation_name}
                      </td>
                      <td className="py-3 px-3 align-top font-semibold text-slate-800">
                        &ldquo;{item.talk_title}&rdquo;
                        {item.notes && (
                          <span className="block text-[11px] text-slate-400 font-normal italic mt-0.5 no-print">
                            {item.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono font-bold text-slate-800">
                        Canto {item.song_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PIE DE PÁGINA DEL PROGRAMA */}
        <footer className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <span>
            Generado por el Sistema de Gestión del Programa de Conferencias
          </span>
          <span className="font-mono">
            {currentCongregation?.name} · Actualizado: {new Date().toLocaleDateString('es-ES')}
          </span>
        </footer>
      </div>
    </div>
  );
};
