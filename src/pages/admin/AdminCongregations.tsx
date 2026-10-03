import React, { useState } from 'react';
import {
  Plus,
  Search,
  Building2,
  Calendar,
  Clock,
  User,
  Edit2,
  Power,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { Congregation, Weekday, WeekendDay } from '../../types/database';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { formatTime12Hour } from '../../utils/dateUtils';

export const AdminCongregations: React.FC = () => {
  const { allCongregations, refreshData } = useAuth();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCongregation, setEditingCongregation] = useState<Congregation | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    weekday_meeting_day: 'Miércoles' as Weekday,
    weekday_meeting_time: '19:00',
    weekend_meeting_day: 'Domingo' as WeekendDay,
    weekend_meeting_time: '09:30',
    is_active: true,
    coordinator_name: '',
    coordinator_email: '',
    coordinator_phone: '',
  });

  // Toggle Confirm
  const [toggleTarget, setToggleTarget] = useState<Congregation | null>(null);

  const handleOpenCreate = () => {
    setEditingCongregation(null);
    setFormData({
      name: '',
      weekday_meeting_day: 'Miércoles',
      weekday_meeting_time: '19:00',
      weekend_meeting_day: 'Domingo',
      weekend_meeting_time: '09:30',
      is_active: true,
      coordinator_name: '',
      coordinator_email: '',
      coordinator_phone: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cong: Congregation) => {
    setEditingCongregation(cong);
    setFormData({
      name: cong.name,
      weekday_meeting_day: cong.weekday_meeting_day,
      weekday_meeting_time: cong.weekday_meeting_time,
      weekend_meeting_day: cong.weekend_meeting_day,
      weekend_meeting_time: cong.weekend_meeting_time,
      is_active: cong.is_active,
      coordinator_name: cong.coordinator_name || '',
      coordinator_email: cong.coordinator_email || '',
      coordinator_phone: cong.coordinator_phone || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Por favor escribe el nombre de la congregación.', 'error');
      return;
    }

    try {
      if (editingCongregation) {
        await dataService.updateCongregation(editingCongregation.id, {
          name: formData.name.trim(),
          weekday_meeting_day: formData.weekday_meeting_day,
          weekday_meeting_time: formData.weekday_meeting_time,
          weekend_meeting_day: formData.weekend_meeting_day,
          weekend_meeting_time: formData.weekend_meeting_time,
          is_active: formData.is_active,
          coordinator_name: formData.coordinator_name.trim() || undefined,
          coordinator_email: formData.coordinator_email.trim() || undefined,
          coordinator_phone: formData.coordinator_phone.trim() || undefined,
        });
        showToast('Congregación actualizada exitosamente.');
      } else {
        await dataService.createCongregation({
          name: formData.name.trim(),
          weekday_meeting_day: formData.weekday_meeting_day,
          weekday_meeting_time: formData.weekday_meeting_time,
          weekend_meeting_day: formData.weekend_meeting_day,
          weekend_meeting_time: formData.weekend_meeting_time,
          is_active: formData.is_active,
          coordinator_name: formData.coordinator_name.trim() || undefined,
          coordinator_email: formData.coordinator_email.trim() || undefined,
          coordinator_phone: formData.coordinator_phone.trim() || undefined,
        });
        showToast('Nueva congregación registrada con cuenta de coordinador.');
      }
      setIsModalOpen(false);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar la congregación.', 'error');
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!toggleTarget) return;
    try {
      await dataService.updateCongregation(toggleTarget.id, {
        is_active: !toggleTarget.is_active,
      });
      showToast(
        `Congregación ${toggleTarget.name} ${
          toggleTarget.is_active ? 'desactivada' : 'activada'
        }.`
      );
      setToggleTarget(null);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al cambiar estado', 'error');
    }
  };

  const filtered = allCongregations.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.coordinator_name && c.coordinator_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Gestión de Congregaciones
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Crea, configura horarios de reuniones y administra las cuentas de coordinadores
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar congregación..."
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
            <span>Crear Congregación</span>
          </button>
        </div>
      </div>

      {/* Grid of Congregations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((cong) => (
          <div
            key={cong.id}
            className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between ${
              cong.is_active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 bg-slate-50/70 opacity-80'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{cong.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400">ID: {cong.id}</span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    cong.is_active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {cong.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Schedules info */}
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Fin de Semana:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {cong.weekend_meeting_day}{' '}
                    <strong className="font-mono tabular-nums">
                      {formatTime12Hour(cong.weekend_meeting_time)}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Entre Semana:
                  </span>
                  <span className="font-medium text-slate-700">
                    {cong.weekday_meeting_day}{' '}
                    <strong className="font-mono tabular-nums">
                      {formatTime12Hour(cong.weekday_meeting_time)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Coordinator */}
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Coordinador del Cuerpo de Ancianos
                </span>
                <p className="font-semibold text-slate-800">
                  {cong.coordinator_name || 'Sin coordinador registrado'}
                </p>
                {cong.coordinator_email && (
                  <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-slate-400" /> {cong.coordinator_email}
                  </p>
                )}
                {cong.coordinator_phone && (
                  <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" /> {cong.coordinator_phone}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setToggleTarget(cong)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  cong.is_active
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{cong.is_active ? 'Desactivar' : 'Activar'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(cong)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Crear / Editar Congregación */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCongregation ? 'Editar Congregación' : 'Registrar Nueva Congregación'}
        subtitle="Configura los horarios de reunión y la cuenta del coordinador"
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Nombre de la Congregación *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej. Congregación Santa Tecla"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Fin de semana */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Horario de Fin de Semana (Conferencia) *
              </span>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Día</label>
                <select
                  value={formData.weekend_meeting_day}
                  onChange={(e) =>
                    setFormData({ ...formData, weekend_meeting_day: e.target.value as WeekendDay })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Hora</label>
                <input
                  type="time"
                  required
                  value={formData.weekend_meeting_time}
                  onChange={(e) =>
                    setFormData({ ...formData, weekend_meeting_time: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Entre semana */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Horario de Entre Semana *
              </span>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Día</label>
                <select
                  value={formData.weekday_meeting_day}
                  onChange={(e) =>
                    setFormData({ ...formData, weekday_meeting_day: e.target.value as Weekday })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Lunes">Lunes</option>
                  <option value="Martes">Martes</option>
                  <option value="Miércoles">Miércoles</option>
                  <option value="Jueves">Jueves</option>
                  <option value="Viernes">Viernes</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Hora</label>
                <input
                  type="time"
                  required
                  value={formData.weekday_meeting_time}
                  onChange={(e) =>
                    setFormData({ ...formData, weekday_meeting_time: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Coordinador */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2.5">
              Cuenta del Coordinador (Administrador de Congregación)
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nombre del Coordinador
                </label>
                <input
                  type="text"
                  value={formData.coordinator_name}
                  onChange={(e) =>
                    setFormData({ ...formData, coordinator_name: e.target.value })
                  }
                  placeholder="Ej. Roberto Guzmán"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Correo para Acceso
                  </label>
                  <input
                    type="email"
                    value={formData.coordinator_email}
                    onChange={(e) =>
                      setFormData({ ...formData, coordinator_email: e.target.value })
                    }
                    placeholder="coordinador@jwconferencias.org"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={formData.coordinator_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, coordinator_phone: e.target.value })
                    }
                    placeholder="+503 7000-1122"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white font-mono"
                  />
                </div>
              </div>
            </div>
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
              {editingCongregation ? 'Guardar Cambios' : 'Registrar Congregación'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toggle Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleConfirmToggleActive}
        title={toggleTarget?.is_active ? 'Desactivar Congregación' : 'Activar Congregación'}
        message={`¿Estás seguro de que deseas ${
          toggleTarget?.is_active ? 'desactivar' : 'activar'
        } a ${toggleTarget?.name}? Las congregaciones inactivas no estarán disponibles para nuevas asignaciones de salidas o visitas.`}
        confirmLabel={toggleTarget?.is_active ? 'Desactivar' : 'Activar'}
        isDanger={toggleTarget?.is_active}
      />
    </div>
  );
};
