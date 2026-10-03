import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { SPANISH_MONTHS, getMonthYearOptions } from '../../utils/dateUtils';

interface MonthSelectorProps {
  selectedMonth: number; // 1-12
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  className?: string;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  selectedYear,
  onChange,
  className = '',
}) => {
  const options = getMonthYearOptions(selectedYear);

  const handlePrev = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    onChange(newMonth, newYear);
  };

  const handleNext = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    onChange(newMonth, newYear);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [mStr, yStr] = e.target.value.split('-');
    onChange(parseInt(mStr, 10), parseInt(yStr, 10));
  };

  const handleGoCurrent = () => {
    const now = new Date();
    onChange(now.getMonth() + 1, now.getFullYear());
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return now.getMonth() + 1 === selectedMonth && now.getFullYear() === selectedYear;
  };

  return (
    <div className={`inline-flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-xs ${className}`}>
      <button
        type="button"
        onClick={handlePrev}
        title="Mes anterior"
        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="relative flex items-center">
        <Calendar className="w-4 h-4 text-indigo-600 absolute left-2.5 pointer-events-none" />
        <select
          value={`${selectedMonth}-${selectedYear}`}
          onChange={handleSelect}
          className="appearance-none pl-8 pr-7 py-1 text-sm font-semibold text-slate-800 bg-transparent hover:bg-slate-50 rounded-lg cursor-pointer focus:outline-hidden"
        >
          {options.map((opt) => (
            <option key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-2 pointer-events-none text-slate-400 text-xs">▼</div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        title="Mes siguiente"
        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {!isCurrentMonth() && (
        <button
          type="button"
          onClick={handleGoCurrent}
          className="ml-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors whitespace-nowrap"
        >
          Ir a hoy
        </button>
      )}
    </div>
  );
};
