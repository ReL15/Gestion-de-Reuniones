import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  BookOpen,
  Calendar,
  Clock,
  Plus,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { Congregation } from '../../types/database';
import { formatTime12Hour } from '../../utils/dateUtils';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { allCongregations, refreshData } = useAuth();
  const [totalSpeakers, setTotalSpeakers] = useState(0);
  const [totalTalks, setTotalTalks] = useState(0);

  useEffect(() => {
    refreshData();
    loadGlobalTotals();
  }, []);

  useEffect(() => {
    loadGlobalTotals();
  }, [allCongregations]);

  const loadGlobalTotals = async () => {
    try {
      const [spks, tlks] = await Promise.all([
        dataService.getSpeakers(),
        dataService.getTalks(),
      ]);
      setTotalSpeakers(spks.length);
      setTotalTalks(tlks.length);
    } catch (e) {
      console.error(e);
    }
  };

  const activeCongregations = allCongregations.filter((c) => c.is_active);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Panel del Administrador Principal
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión global de congregaciones, horarios de reuniones y cuentas de coordinadores
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('admin-congregations')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Gestionar Congregaciones</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Congregaciones
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {allCongregations.length}
            </span>
            <span className="text-xs text-slate-500">registradas</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-2 block">
            {activeCongregations.length} activas
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Coordinadores
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {allCongregations.filter((c) => Boolean(c.coordinator_name)).length}
            </span>
            <span className="text-xs text-slate-500">cuentas</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('admin-users')}
            className="mt-2 text-[11px] text-indigo-600 font-semibold hover:text-indigo-800"
          >
            Ver administradores →
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Conferenciantes
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {totalSpeakers}
            </span>
            <span className="text-xs text-slate-500">en red</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Gestionados por cada congregación
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Catálogo de Discursos
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {totalTalks}
            </span>
            <span className="text-xs text-slate-500">preparados</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            Con canciones normalizadas
          </span>
        </div>
      </div>

      {/* Congregations Overview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Congregaciones Disponibles en el Sistema
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('admin-congregations')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Administrar todas →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Congregación</th>
                <th className="py-3 px-4">Reunión Fin de Semana</th>
                <th className="py-3 px-4">Reunión Entre Semana</th>
                <th className="py-3 px-4">Coordinador</th>
                <th className="py-3 px-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allCongregations.map((cong) => (
                <tr key={cong.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-bold text-slate-900">{cong.name}</td>
                  <td className="py-3 px-4 text-slate-700">
                    <span className="font-semibold">{cong.weekend_meeting_day}</span> a las{' '}
                    <span className="font-mono tabular-nums font-semibold">
                      {formatTime12Hour(cong.weekend_meeting_time)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <span>{cong.weekday_meeting_day}</span> a las{' '}
                    <span className="font-mono tabular-nums">
                      {formatTime12Hour(cong.weekday_meeting_time)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-800 block">
                      {cong.coordinator_name || 'Sin asignar'}
                    </span>
                    {cong.coordinator_email && (
                      <span className="text-[11px] text-slate-400 block font-mono">
                        {cong.coordinator_email}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        cong.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cong.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
