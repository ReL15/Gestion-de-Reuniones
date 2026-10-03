import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Upload,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { useToast } from '../../components/common/Toast';
import { Weekday, WeekendDay } from '../../types/database';
import { formatTime12Hour } from '../../utils/dateUtils';
import { EmptyState } from '../../components/common/EmptyState';

export const CongregationSettings: React.FC = () => {
  const { currentCongregation, refreshData } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    weekday_meeting_day: 'Miércoles' as Weekday,
    weekday_meeting_time: '19:00',
    weekend_meeting_day: 'Domingo' as WeekendDay,
    weekend_meeting_time: '09:30',
    coordinator_name: '',
    coordinator_email: '',
    coordinator_phone: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentCongregation) {
      setFormData({
        name: currentCongregation.name,
        weekday_meeting_day: currentCongregation.weekday_meeting_day,
        weekday_meeting_time: currentCongregation.weekday_meeting_time,
        weekend_meeting_day: currentCongregation.weekend_meeting_day,
        weekend_meeting_time: currentCongregation.weekend_meeting_time,
        coordinator_name: currentCongregation.coordinator_name || '',
        coordinator_email: currentCongregation.coordinator_email || '',
        coordinator_phone: currentCongregation.coordinator_phone || '',
      });
    }
  }, [currentCongregation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCongregation) return;

    setIsSaving(true);
    try {
      await dataService.updateCongregation(currentCongregation.id, {
        name: formData.name.trim(),
        weekday_meeting_day: formData.weekday_meeting_day,
        weekday_meeting_time: formData.weekday_meeting_time,
        weekend_meeting_day: formData.weekend_meeting_day,
        weekend_meeting_time: formData.weekend_meeting_time,
        coordinator_name: formData.coordinator_name.trim() || undefined,
        coordinator_email: formData.coordinator_email.trim() || undefined,
        coordinator_phone: formData.coordinator_phone.trim() || undefined,
      });
      await refreshData();
      showToast('Configuración de la congregación actualizada exitosamente.');
    } catch (err: any) {
      showToast(err.message || 'Error al guardar configuración', 'error');
    } finally {
      setIsSaving(false);
    }
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
        showToast('Logo actualizado.');
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

  if (!currentCongregation) {
    return (
      <EmptyState
        title="No hay congregación seleccionada"
        description="Por favor selecciona una congregación en la barra lateral para configurar sus datos y horarios."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Configuración de la Congregación
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Ajusta los días y horarios de reunión que utiliza el sistema para calcular automáticamente las fechas de conferencias
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Logo & Profile */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Logo de la Congregación
            </h3>

            <div className="w-32 h-32 mx-auto rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden mb-3 p-2">
              {currentCongregation?.logo_url ? (
                <img
                  src={currentCongregation.logo_url}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-300" />
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
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
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{currentCongregation?.logo_url ? 'Cambiar' : 'Subir imagen'}</span>
              </button>
              {currentCongregation?.logo_url && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Eliminar logo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-3 leading-tight">
              Formatos recomendados: PNG, JPG o SVG con fondo transparente.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Resumen Rápido
            </span>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Fin de semana:</span>
              <span className="font-semibold text-slate-800">
                {formData.weekend_meeting_day} {formatTime12Hour(formData.weekend_meeting_time)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Entre semana:</span>
              <span className="font-semibold text-slate-800">
                {formData.weekday_meeting_day} {formatTime12Hour(formData.weekday_meeting_time)}
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Form details */}
        <div className="md:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Nombre de la Congregación *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-900"
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Horarios de Reuniones</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fin de semana */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    Reunión de Fin de Semana (Conferencia)
                  </span>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Día habitual
                    </label>
                    <select
                      value={formData.weekend_meeting_day}
                      onChange={(e) =>
                        setFormData({ ...formData, weekend_meeting_day: e.target.value as WeekendDay })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                    >
                      <option value="Sábado">Sábado</option>
                      <option value="Domingo">Domingo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Hora de inicio
                    </label>
                    <input
                      type="time"
                      value={formData.weekend_meeting_time}
                      onChange={(e) =>
                        setFormData({ ...formData, weekend_meeting_time: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Entre semana */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 block">
                    Reunión de Entre Semana
                  </span>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Día habitual
                    </label>
                    <select
                      value={formData.weekday_meeting_day}
                      onChange={(e) =>
                        setFormData({ ...formData, weekday_meeting_day: e.target.value as Weekday })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                    >
                      <option value="Lunes">Lunes</option>
                      <option value="Martes">Martes</option>
                      <option value="Miércoles">Miércoles</option>
                      <option value="Jueves">Jueves</option>
                      <option value="Viernes">Viernes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Hora de inicio
                    </label>
                    <input
                      type="time"
                      value={formData.weekday_meeting_time}
                      onChange={(e) =>
                        setFormData({ ...formData, weekday_meeting_time: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Coordinador del cuerpo de ancianos */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Coordinador del Cuerpo de Ancianos</span>
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
                    placeholder="Ej. Juan Carlos Reyes"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={formData.coordinator_email}
                      onChange={(e) =>
                        setFormData({ ...formData, coordinator_email: e.target.value })
                      }
                      placeholder="coordinador@jwconferencias.org"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      value={formData.coordinator_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, coordinator_phone: e.target.value })
                      }
                      placeholder="+503 7123-4567"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
