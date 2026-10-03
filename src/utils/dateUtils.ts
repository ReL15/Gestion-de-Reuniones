import { WeekendDay } from '../types/database';

export const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const SPANISH_DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

/**
 * Returns day-of-week integer for standard JS:
 * 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
 */
export function getDayNumberFromName(dayName: string): number {
  const normalized = dayName.trim().toLowerCase();
  switch (normalized) {
    case 'domingo':
      return 0;
    case 'lunes':
      return 1;
    case 'martes':
      return 2;
    case 'miércoles':
    case 'miercoles':
      return 3;
    case 'jueves':
      return 4;
    case 'viernes':
      return 5;
    case 'sábado':
    case 'sabado':
      return 6;
    default:
      return 0; // default to domingo
  }
}

/**
 * Parse YYYY-MM-DD safely into year, month, day numbers without timezone shift
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  if (!dateStr) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

/**
 * Returns formatted date in YYYY-MM-DD
 */
export function formatDateISO(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Finds all dates in a given month (1-12) that match the given weekend day name ('Sábado' | 'Domingo')
 */
export function getMeetingDatesInMonth(
  year: number,
  month: number, // 1 to 12
  dayName: WeekendDay
): { weekNumber: number; dateStr: string; dayNumber: number }[] {
  const targetDay = getDayNumberFromName(dayName);
  const results: { weekNumber: number; dateStr: string; dayNumber: number }[] = [];

  // Total days in this month
  const daysInMonth = new Date(year, month, 0).getDate();
  let weekCounter = 1;

  for (let d = 1; d <= daysInMonth; d++) {
    // Construct local date (using local noon to avoid DST edge cases)
    const checkDate = new Date(year, month - 1, d, 12, 0, 0);
    if (checkDate.getDay() === targetDay) {
      results.push({
        weekNumber: weekCounter,
        dateStr: formatDateISO(year, month, d),
        dayNumber: d,
      });
      weekCounter++;
    }
  }

  return results;
}

/**
 * Rule 29: Centralized calculation of meeting date for Outgoing assignments.
 * Given:
 * - year
 * - month (1-12)
 * - week_number (1 to 5)
 * - destination congregation weekend meeting day ('Sábado' | 'Domingo')
 *
 * Returns exact ISO date string (YYYY-MM-DD)
 */
export function calculateMeetingDate(
  year: number,
  month: number,
  weekNumber: number,
  dayName: WeekendDay
): { dateStr: string; valid: boolean; message?: string } {
  const dates = getMeetingDatesInMonth(year, month, dayName);

  if (dates.length === 0) {
    return {
      dateStr: formatDateISO(year, month, 1),
      valid: false,
      message: `No se encontraron reuniones en el mes especificado para ${dayName}.`,
    };
  }

  const index = weekNumber - 1;
  if (index >= 0 && index < dates.length) {
    return {
      dateStr: dates[index].dateStr,
      valid: true,
    };
  }

  // If requested 5th week but month only has 4, fallback to last available with warning
  const fallback = dates[dates.length - 1];
  return {
    dateStr: fallback.dateStr,
    valid: false,
    message: `El mes de ${SPANISH_MONTHS[month - 1]} ${year} solo tiene ${dates.length} ${dayName}s. Se seleccionó la última reunión (${fallback.dayNumber} de ${SPANISH_MONTHS[month - 1]}).`,
  };
}

/**
 * Formats a date string (YYYY-MM-DD) to full Spanish format:
 * e.g. "Domingo 18 de octubre de 2026"
 */
export function formatFullSpanishDate(dateStr: string): string {
  if (!dateStr) return '';
  const { year, month, day } = parseDateParts(dateStr);
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  const dayName = SPANISH_DAYS[dateObj.getDay()];
  const monthName = SPANISH_MONTHS[month - 1].toLowerCase();
  return `${dayName} ${day} de ${monthName} de ${year}`;
}

/**
 * Formats time from "09:30" or "19:00" to "9:30 AM" / "7:00 PM"
 */
export function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return '';
  const [hourStr, minuteStr] = timeStr.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr || '00';
  if (isNaN(hour)) return timeStr;

  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${ampm}`;
}

/**
 * Returns current month (1-12) and year
 */
export function getCurrentMonthAndYear(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

/**
 * Generates options for month/year selectors around current date (e.g. current year -1 to +2)
 */
export function getMonthYearOptions(centerYear?: number): { month: number; year: number; label: string }[] {
  const y = centerYear || new Date().getFullYear();
  const options: { month: number; year: number; label: string }[] = [];

  for (let yr = y - 1; yr <= y + 1; yr++) {
    for (let m = 1; m <= 12; m++) {
      options.push({
        month: m,
        year: yr,
        label: `${SPANISH_MONTHS[m - 1]} ${yr}`,
      });
    }
  }

  return options;
}
