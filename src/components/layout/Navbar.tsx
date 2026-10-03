import React from 'react';
import { Menu, Clock, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatTime12Hour } from '../../utils/dateUtils';

interface NavbarProps {
  title: string;
  onOpenMobileMenu: () => void;
  headerAction?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  onOpenMobileMenu,
  headerAction,
}) => {
  const { currentCongregation, role } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-3.5 no-print">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug truncate">
              {title}
            </h2>
            {currentCongregation && role !== 'super_admin' && (
              <p className="text-xs text-slate-500 hidden sm:block">
                {currentCongregation.name}
              </p>
            )}
          </div>
        </div>

        {/* Right: Info and custom action */}
        <div className="flex items-center gap-3 shrink-0">
          {currentCongregation && (
            <div className="hidden md:flex items-center gap-4 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  Fin de semana: <strong className="text-slate-800">{currentCongregation.weekend_meeting_day}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-mono tabular-nums text-slate-800 font-medium">
                  {formatTime12Hour(currentCongregation.weekend_meeting_time)}
                </span>
              </div>
            </div>
          )}

          {headerAction}
        </div>
      </div>
    </header>
  );
};
