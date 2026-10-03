import React, { useState } from 'react';
import {
  Layers,
  Mail,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  UserPlus,
  Phone,
  PhoneCall,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { Modal } from '../../components/common/Modal';

export const Login: React.FC = () => {
  const { login, loginWithPhone, register, allCongregations } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'phone' | 'login' | 'register'>('phone');
  const [phone, setPhone] = useState('');
  const [candidates, setCandidates] = useState<Array<{
    id: string;
    full_name: string;
    phone: string;
    congregation_id: string;
    congregation_name: string;
    roles_description: string;
  }>>([]);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerCongregationId, setRegisterCongregationId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal de recuperación
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  const handlePhoneLogin = async (e?: React.FormEvent, selectedBrotherId?: string) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    if (!phone.trim()) {
      setErrorMessage('Por favor escribe tu número de teléfono registrado.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await loginWithPhone(phone.trim(), selectedBrotherId);
      if (res.success) {
        showToast('¡Bienvenido! Has accedido a las asignaciones de tu congregación.');
        setIsCandidateModalOpen(false);
      } else if (res.candidates && res.candidates.length > 1) {
        setCandidates(res.candidates);
        setIsCandidateModalOpen(true);
      } else {
        setErrorMessage(res.message || 'No se encontró ningún registro para este número.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión con teléfono');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setErrorMessage(result.message || 'No se pudo iniciar sesión.');
      } else {
        showToast('¡Bienvenido al sistema!');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim() || !registerCongregationId) {
      setErrorMessage('Por favor completa todos los campos del registro.');
      return;
    }

    if (registerPassword.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        full_name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword.trim(),
        congregation_id: registerCongregationId,
      });

      if (!res.success) {
        setErrorMessage(res.message || 'No se pudo crear la cuenta.');
      } else {
        showToast(res.message || 'Cuenta creada.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al crear la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    showToast(`Se ha enviado un enlace de restablecimiento a ${recoveryEmail}.`, 'info');
    setIsRecoveryOpen(false);
    setRecoveryEmail('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background subtle lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-indigo-600/10 blur-3xl pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30 mb-4">
          <Layers className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Programa de Conferencias
        </h1>
        <p className="mt-1.5 text-xs text-slate-400">
          Gestión de reuniones de fin de semana para congregaciones
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 border border-slate-700/80 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 space-y-6">
          {/* Acceso para hermanos, coordinadores y registro */}
          <div className="grid grid-cols-3 rounded-xl bg-slate-900/80 p-1 border border-slate-700/60 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('phone');
                setErrorMessage('');
              }}
              className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'phone'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Con Teléfono</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Coordinador</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
              }}
              className={`py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Registrarse</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'phone' ? (
            /* =================== FORMULARIO DE ACCESO CON TELÉFONO =================== */
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5">
                <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Acceso directo para <strong>lectores</strong>, <strong>presidentes</strong> y <strong>discursantes</strong> para consultar las reuniones de su propia congregación.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Número de Teléfono Registrado
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 7391-0522 o +503 7391 0522"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono tracking-wide"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Sin contraseñas: el sistema buscará tu registro de hermano y te conectará a tu congregación.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4 cursor-pointer"
              >
                <span>{isLoading ? 'Verificando teléfono...' : 'Consultar Asignaciones'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : mode === 'login' ? (
            /* =================== FORMULARIO DE LOGIN =================== */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coordinador@ejemplo.com"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsRecoveryOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <span>{isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

            </form>
          ) : (
            /* =================== FORMULARIO DE REGISTRO =================== */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nombre Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="tu-correo@ejemplo.com"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Contraseña (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Congregación
                </label>
                <select
                  required
                  value={registerCongregationId}
                  onChange={(e) => setRegisterCongregationId(e.target.value)}
                  disabled={!allCongregations.some((congregation) => congregation.is_active)}
                  className="w-full px-3 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60"
                >
                  <option value="">Selecciona tu congregación</option>
                  {allCongregations.filter((congregation) => congregation.is_active).map((congregation) => (
                    <option key={congregation.id} value={congregation.id}>
                      {congregation.name}
                    </option>
                  ))}
                </select>
                {allCongregations.filter((congregation) => congregation.is_active).length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">
                    ¿Tu congregación no aparece?{' '}
                    <a
                      href="https://wa.me/50376766504"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-400 hover:text-emerald-300 underline"
                    >
                      Contacta al desarrollador por WhatsApp
                    </a>
                    .
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-400">
                  Rol asignado: <span className="font-semibold text-slate-200">Coordinador de congregación</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Modal de recuperación */}
      <Modal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        title="Recuperar Contraseña"
        subtitle="Te enviaremos las instrucciones de recuperación por correo"
      >
        <form onSubmit={handleRecovery} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Correo Electrónico Registrado
            </label>
            <input
              type="email"
              required
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="tu-correo@ejemplo.com"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsRecoveryOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
            >
              Enviar Enlace
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Selección de Hermano si hay varios registrados con el mismo teléfono */}
      <Modal
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        title="Selecciona tu Nombre"
        subtitle="Se encontraron varios registros asociados a este número de teléfono"
      >
        <div className="space-y-3 py-2">
          {candidates.map((cand) => (
            <button
              key={cand.id}
              type="button"
              onClick={() => handlePhoneLogin(undefined, cand.id)}
              className="w-full p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                  {cand.full_name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Congregación: <strong className="text-slate-700">{cand.congregation_name}</strong>
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                    {cand.roles_description}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};
