import React from 'react';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  BookOpen,
  FileText,
  Settings,
  Building2,
  ShieldCheck,
  LogOut,
  Database,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { currentUser, currentCongregation, role, logout, allCongregations, switchCongregation } =
    useAuth();

  const isSuperAdmin = role === 'super_admin';

  const congregationNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'entradas', label: 'Entradas (Visitantes)', icon: ArrowDownLeft },
    { id: 'salidas', label: 'Salidas', icon: ArrowUpRight },
    { id: 'conferenciantes', label: 'Conferenciantes', icon: Users },
    { id: 'conferencias', label: 'Conferencias', icon: BookOpen },
    { id: 'programa', label: 'Programa Mensual', icon: FileText },
    { id: 'configuracion', label: 'Configuración / Logo', icon: Settings },
  ];

  const adminNavItems = [
    { id: 'admin-dashboard', label: 'Panel Global', icon: LayoutDashboard },
    { id: 'admin-congregations', label: 'Congregaciones', icon: Building2 },
    { id: 'admin-users', label: 'Coordinadores / Cuentas', icon: ShieldCheck },
    { id: 'admin-supabase', label: 'Esquema SQL / Supabase', icon: Database },
  ];

  const navItems = isSuperAdmin ? adminNavItems : congregationNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs no-print"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md font-bold text-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white tracking-tight truncate">
                  Programa de Reuniones
                </h1>
                <p className="text-xs text-slate-400 truncate">Gestión de Conferencias</p>
              </div>
            </div>

            {/* Current Congregation selector or display */}
            <div className="mt-4 p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {isSuperAdmin ? 'Congregación en vista:' : 'Congregación Local:'}
              </div>
              {isSuperAdmin ? (
                <div className="mt-1 relative">
                  <select
                    value={currentCongregation?.id || ''}
                    onChange={(e) => switchCongregation(e.target.value)}
                    className="w-full bg-slate-900 text-white text-xs font-semibold py-1.5 px-2 rounded-lg border border-slate-700 appearance-none cursor-pointer focus:outline-hidden"
                  >
                    {!currentCongregation && (
                      <option value="" disabled>
                        Seleccionar congregación...
                      </option>
                    )}
                    {allCongregations.length === 0 && (
                      <option value="" disabled>
                        Sin congregaciones registradas
                      </option>
                    )}
                    {allCongregations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white truncate">
                    {currentCongregation?.name || 'Cargando...'}
                  </span>
                  <span className="text-[11px] text-indigo-400 font-medium shrink-0">
                    {currentCongregation?.weekend_meeting_day}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            {/* If super admin, allow quick toggle to view congregation module */}
            {isSuperAdmin && (
              <div className="pt-3 mt-3 border-t border-slate-800">
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Módulo de Congregación
                </div>
                {congregationNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-slate-800 text-indigo-400 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* User profile & logout */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* User info & logout */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{currentUser?.full_name}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Cerrar sesión"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
