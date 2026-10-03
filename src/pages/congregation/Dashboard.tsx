import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  BookOpen,
  Calendar,
  Clock,
  Music,
  MapPin,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { MonthlyStats } from '../../types/database';
import { MonthSelector } from '../../components/common/MonthSelector';
import { EmptyState } from '../../components/common/EmptyState';
import { formatFullSpanishDate, formatTime12Hour, getCurrentMonthAndYear, SPANISH_MONTHS } from '../../utils/dateUtils';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentCongregation } = useAuth();
  const currentInitial = getCurrentMonthAndYear();
  const [selectedMonth, setSelectedMonth] = useState(currentInitial.month);
  const [selectedYear, setSelectedYear] = useState(currentInitial.year);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentCongregation) return;
    loadStats();
  }, [currentCongregation?.id, selectedMonth, selectedYear]);

  const loadStats = async () => {
    if (!currentCongregation) return;
    setIsLoading(true);
    try {
      const data = await dataService.getMonthlyStats(
        currentCongregation.id,
        selectedMonth,
        selectedYear
      );
      setStats(data);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Por favor selecciona una congregación en el selector lateral o registra una congregación para comenzar a ver las estadísticas del panel."
        actionLabel="Gestionar Congregaciones"
        onAction={() => onNavigate('admin-congregations')}
      />
    );
  }

  const monthLabel = `${SPANISH_MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* Top Banner / Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Panel de {currentCongregation.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Resumen de asignaciones y conferencias para{' '}
            <strong className="text-slate-700">{monthLabel}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MonthSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onChange={(m, y) => {
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
          />
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Entradas ({monthLabel.split(' ')[0]})
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {stats?.incomingCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">conferencias</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('entradas')}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            Ver entradas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Salidas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Salidas ({monthLabel.split(' ')[0]})
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {stats?.outgoingCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">conferencias</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('salidas')}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors"
          >
            Ver salidas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conferenciantes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Conferenciantes Locales
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {stats?.activeSpeakersCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">activos</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('conferenciantes')}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
          >
            Administrar <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Temas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Discursos Registrados
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {stats?.activeTalksCount ?? 0}
            </span>
            <span className="text-xs text-slate-500">disponibles</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('conferencias')}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors"
          >
            Ver temas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Next Upcoming Meetings Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Incoming */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Próxima Conferencia de Entrada
                </h3>
              </div>
              <span className="text-xs text-slate-400">Visitante</span>
            </div>

            {stats?.nextIncoming ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50/80 px-3 py-1.5 rounded-lg w-fit">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatFullSpanishDate(stats.nextIncoming.meeting_date)}</span>
                  <span aria-hidden="true">·</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">{formatTime12Hour(stats.nextIncoming.meeting_time)}</span>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    &ldquo;{stats.nextIncoming.talk_title}&rdquo;
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                    <span className="font-semibold text-slate-900">{stats.nextIncoming.speaker_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {stats.nextIncoming.origin_congregation_name}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-mono">
                    <Music className="w-3.5 h-3.5 text-indigo-600" /> Canción {stats.nextIncoming.song_number}
                  </span>
                  {stats.nextIncoming.speaker_phone && (
                    <span className="font-mono text-slate-600">Tel: {stats.nextIncoming.speaker_phone}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No hay conferencias de entrada programadas para este mes.
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('entradas')}
              className="w-full py-2 px-3 text-xs font-semibold text-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-colors"
            >
              Gestionar todas las entradas del mes
            </button>
          </div>
        </div>

        {/* Next Outgoing */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Próxima Conferencia de Salida
                </h3>
              </div>
              <span className="text-xs text-slate-400">Salida Local</span>
            </div>

            {stats?.nextOutgoing ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-800 bg-sky-50 px-3 py-1.5 rounded-lg w-fit">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatFullSpanishDate(stats.nextOutgoing.meeting_date)}</span>
                  <span aria-hidden="true">·</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">{formatTime12Hour(stats.nextOutgoing.meeting_time)}</span>
                </div>

                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    &ldquo;{stats.nextOutgoing.talk_title}&rdquo;
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                    <span className="font-semibold text-slate-900">{stats.nextOutgoing.speaker_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      Destino: <strong>{stats.nextOutgoing.destination_congregation_name}</strong>
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                  <span className="flex items-center gap-1 font-mono">
                    <Music className="w-3.5 h-3.5 text-indigo-600" /> Canción {stats.nextOutgoing.song_number}
                  </span>
                  {stats.nextOutgoing.notes && (
                    <span className="truncate max-w-[200px] text-slate-400 text-[11px]">
                      {stats.nextOutgoing.notes}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No hay conferencias de salida programadas para este mes.
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('salidas')}
              className="w-full py-2 px-3 text-xs font-semibold text-center text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-xl transition-colors"
            >
              Gestionar todas las salidas del mes
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Card for Monthly Schedule */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Documento Oficial</span>
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            Generar Programa Mensual de {monthLabel}
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Prepara el documento formal con encabezado, logo de congregación, lista ordenada de entradas y salidas listo para imprimir en tamaño carta o descargar en PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('programa')}
          className="px-5 py-2.5 bg-white text-slate-900 font-semibold text-sm rounded-xl hover:bg-slate-100 transition-colors shrink-0 shadow-sm"
        >
          Generar programa del mes
        </button>
      </div>
    </div>
  );
};
