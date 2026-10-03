/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { Login } from './pages/auth/Login';

// Congregation pages
import { Dashboard } from './pages/congregation/Dashboard';
import { IncomingAssignments } from './pages/congregation/IncomingAssignments';
import { OutgoingAssignments } from './pages/congregation/OutgoingAssignments';
import { Speakers } from './pages/congregation/Speakers';
import { Talks } from './pages/congregation/Talks';
import { MonthlySchedule } from './pages/congregation/MonthlySchedule';
import { CongregationSettings } from './pages/congregation/CongregationSettings';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminCongregations } from './pages/admin/AdminCongregations';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSupabase } from './pages/admin/AdminSupabase';

const MainLayout: React.FC = () => {
  const { currentUser, role, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [talksSpeakerFilter, setTalksSpeakerFilter] = useState<string | null>(null);

  // Sync default tab on role switch
  React.useEffect(() => {
    if (role === 'super_admin' && !currentTab.startsWith('admin-') && currentTab === 'dashboard') {
      setCurrentTab('admin-dashboard');
    } else if (role === 'congregation_admin' && currentTab.startsWith('admin-')) {
      setCurrentTab('dashboard');
    }
  }, [role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  const getPageTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Panel Principal';
      case 'entradas':
        return 'Conferencias de Entrada (Visitantes)';
      case 'salidas':
        return 'Conferencias de Salida';
      case 'conferenciantes':
        return 'Conferenciantes Locales';
      case 'conferencias':
        return 'Conferencias y Discursos';
      case 'programa':
        return 'Programa Mensual Imprimible';
      case 'configuracion':
        return 'Configuración de Horarios y Logo';
      case 'admin-dashboard':
        return 'Panel Global del Sistema';
      case 'admin-congregations':
        return 'Gestión de Congregaciones';
      case 'admin-users':
        return 'Coordinadores y Cuentas';
      case 'admin-supabase':
        return 'Conexión Supabase y Esquema SQL';
      default:
        return 'Sistema de Conferencias';
    }
  };

  const navigateToTalksWithSpeaker = (speakerId: string) => {
    setTalksSpeakerFilter(speakerId);
    setCurrentTab('conferencias');
  };

  return (
    <div className="min-h-screen bg-slate-100/60 flex">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'conferencias') {
            setTalksSpeakerFilter(null);
          }
        }}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col lg:pl-72 min-w-0">
        <Navbar
          title={getPageTitle()}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Render Active View */}
          {currentTab === 'dashboard' && <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />}
          {currentTab === 'entradas' && <IncomingAssignments />}
          {currentTab === 'salidas' && <OutgoingAssignments />}
          {currentTab === 'conferenciantes' && (
            <Speakers onNavigateToTalks={navigateToTalksWithSpeaker} />
          )}
          {currentTab === 'conferencias' && (
            <Talks initialSpeakerFilter={talksSpeakerFilter} />
          )}
          {currentTab === 'programa' && <MonthlySchedule />}
          {currentTab === 'configuracion' && <CongregationSettings />}

          {/* Super Admin Tabs */}
          {currentTab === 'admin-dashboard' && (
            <AdminDashboard onNavigate={(tab) => setCurrentTab(tab)} />
          )}
          {currentTab === 'admin-congregations' && <AdminCongregations />}
          {currentTab === 'admin-users' && <AdminUsers />}
          {currentTab === 'admin-supabase' && <AdminSupabase />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </AuthProvider>
  );
}
