export type UserRole = 'super_admin' | 'congregation_admin' | 'brother_viewer';

export type Weekday = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes';
export type WeekendDay = 'Sábado' | 'Domingo';

export interface Congregation {
  id: string;
  name: string;
  weekday_meeting_day: Weekday;
  weekday_meeting_time: string; // e.g. "19:00"
  weekend_meeting_day: WeekendDay;
  weekend_meeting_time: string; // e.g. "09:30"
  maps_url?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  coordinator_name?: string;
  coordinator_email?: string;
  coordinator_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  congregation_id: string | null;
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Speaker {
  id: string;
  congregation_id: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined fields
  congregation_name?: string;
  talks_count?: number;
}

export interface Talk {
  id: string;
  speaker_id?: string | null;
  congregation_id: string;
  title: string;
  song_number: number;
  theme_number?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined fields
  speaker_name?: string;
}

export interface Reader {
  id: string;
  congregation_id: string;
  full_name: string;
  phone?: string;
  can_preside?: boolean;
  can_read?: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined fields
  congregation_name?: string;
}

export interface IncomingAssignment {
  id: string;
  local_congregation_id: string;
  origin_congregation_id?: string;
  speaker_id?: string;
  talk_id?: string;
  reader_id?: string;
  president_id?: string;
  song_number?: number;
  meeting_date: string; // YYYY-MM-DD
  meeting_time: string; // HH:MM
  is_no_meeting?: boolean;
  no_meeting_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined fields
  origin_congregation_name?: string;
  speaker_name?: string;
  speaker_phone?: string;
  reader_name?: string;
  reader_phone?: string;
  president_name?: string;
  president_phone?: string;
  talk_title?: string;
  is_memorial?: boolean;
  memorial_date?: string;
}

export interface OutgoingAssignment {
  id: string;
  local_congregation_id: string;
  destination_congregation_id: string;
  speaker_id: string;
  talk_id: string;
  song_number: number;
  month: number; // 1-12
  year: number; // e.g. 2026
  week_number: number; // 1-5 (auxiliary)
  meeting_date: string; // YYYY-MM-DD
  meeting_time: string; // HH:MM
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined fields
  destination_congregation_name?: string;
  speaker_name?: string;
  speaker_phone?: string;
  talk_title?: string;
}

export interface MonthlyStats {
  incomingCount: number;
  outgoingCount: number;
  nextIncoming: IncomingAssignment | null;
  nextOutgoing: OutgoingAssignment | null;
  activeSpeakersCount: number;
  activeTalksCount: number;
}
