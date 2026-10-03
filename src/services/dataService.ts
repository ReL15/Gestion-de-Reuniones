import {
  Congregation,
  Profile,
  Speaker,
  Talk,
  IncomingAssignment,
  OutgoingAssignment,
  MonthlyStats,
} from '../types/database';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

// Claves de LocalStorage para contingencia offline (inician vacías, sin datos ficticios)
const KEY_CONGREGATIONS = 'jw_prog_congregations_v2';
const KEY_PROFILES = 'jw_prog_profiles_v2';
const KEY_SPEAKERS = 'jw_prog_speakers_v2';
const KEY_TALKS = 'jw_prog_talks_v2';
const KEY_INCOMING = 'jw_prog_incoming_v2';
const KEY_OUTGOING = 'jw_prog_outgoing_v2';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getLocalItem<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading localStorage key', key, e);
    return defaultVal;
  }
}

function setLocalItem<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new CustomEvent('jw_data_updated', { detail: { key } }));
  } catch (e) {
    console.error('Error writing localStorage key', key, e);
  }
}

export const dataService = {
  // Limpiar almacenamiento local
  clearLocalData() {
    setLocalItem(KEY_CONGREGATIONS, []);
    setLocalItem(KEY_PROFILES, []);
    setLocalItem(KEY_SPEAKERS, []);
    setLocalItem(KEY_TALKS, []);
    setLocalItem(KEY_INCOMING, []);
    setLocalItem(KEY_OUTGOING, []);
  },

  // ----------------------------------------------------
  // CONGREGACIONES
  // ----------------------------------------------------
  async getCongregations(): Promise<Congregation[]> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data, error } = await sb.from('congregations').select('*').order('name');
        if (!error && data) return data as Congregation[];
        if (error) console.error('Error fetching congregations from Supabase:', error);
      }
    }
    return getLocalItem<Congregation[]>(KEY_CONGREGATIONS, []);
  },

  async getCongregation(id: string): Promise<Congregation | null> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data, error } = await sb.from('congregations').select('*').eq('id', id).single();
        if (!error && data) return data as Congregation;
      }
    }
    const list = await this.getCongregations();
    return list.find((c) => c.id === id) || null;
  },

  async createCongregation(
    data: Omit<Congregation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Congregation> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newCong: Congregation = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('congregations')
          .insert(newCong)
          .select()
          .single();
        if (!error && inserted) {
          if (newCong.coordinator_email && newCong.coordinator_name) {
            try {
              await this.createCongregationAdminProfile({
                congregation_id: inserted.id,
                email: newCong.coordinator_email,
                full_name: newCong.coordinator_name,
                phone: newCong.coordinator_phone || '',
              });
            } catch (profErr) {
              console.warn('Nota: Perfil de coordinador en profiles omitido o pendiente de auth:', profErr);
            }
          }
          return inserted as Congregation;
        }
        if (error) {
          console.error('Error creating congregation in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<Congregation[]>(KEY_CONGREGATIONS, []);
    list.push(newCong);
    setLocalItem(KEY_CONGREGATIONS, list);

    if (newCong.coordinator_email && newCong.coordinator_name) {
      await this.createCongregationAdminProfile({
        congregation_id: newCong.id,
        email: newCong.coordinator_email,
        full_name: newCong.coordinator_name,
        phone: newCong.coordinator_phone || '',
      });
    }

    return newCong;
  },

  async updateCongregation(
    id: string,
    data: Partial<Omit<Congregation, 'id' | 'created_at'>>
  ): Promise<Congregation | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('congregations')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated as Congregation;
        if (error) {
          console.error('Error updating congregation in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<Congregation[]>(KEY_CONGREGATIONS, []);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      updated_at: now,
    };
    setLocalItem(KEY_CONGREGATIONS, list);
    return list[idx];
  },

  async deleteCongregation(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.from('congregations').delete().eq('id', id);
        if (error) {
          console.error('Error deleting congregation from Supabase:', error);
          throw new Error(error.message || 'Error al eliminar congregación');
        }
        return true;
      }
    }

    const list = getLocalItem<Congregation[]>(KEY_CONGREGATIONS, []);
    setLocalItem(
      KEY_CONGREGATIONS,
      list.filter((c) => c.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // PERFILES / USUARIOS
  // ----------------------------------------------------
  async getProfiles(): Promise<Profile[]> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data, error } = await sb.from('profiles').select('*').order('full_name');
        if (!error && data) return data as Profile[];
        if (error) console.error('Error fetching profiles from Supabase:', error);
      }
    }
    return getLocalItem<Profile[]>(KEY_PROFILES, []);
  },

  async createCongregationAdminProfile(params: {
    congregation_id: string;
    email: string;
    full_name: string;
    phone: string;
  }): Promise<Profile> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newProfile: Profile = {
      id,
      user_id: id,
      congregation_id: params.congregation_id,
      role: 'congregation_admin',
      full_name: params.full_name,
      email: params.email.toLowerCase().trim(),
      phone: params.phone,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();
        if (!error && inserted) return inserted as Profile;
        if (error) console.error('Error creating profile in Supabase:', error);
      }
    }

    const list = getLocalItem<Profile[]>(KEY_PROFILES, []);
    const filtered = list.filter((p) => p.email !== newProfile.email);
    filtered.push(newProfile);
    setLocalItem(KEY_PROFILES, filtered);
    return newProfile;
  },

  // ----------------------------------------------------
  // CONFERENCIANTES (SPEAKERS)
  // ----------------------------------------------------
  async _getRawSpeakers(congregationId?: string): Promise<Speaker[]> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        let q = sb.from('speakers').select('*').order('full_name');
        if (congregationId) q = q.eq('congregation_id', congregationId);
        const { data, error } = await q;
        if (!error && data) return data as Speaker[];
        if (error) console.error('Error fetching raw speakers from Supabase:', error);
      }
    }
    let list = getLocalItem<Speaker[]>(KEY_SPEAKERS, []);
    if (congregationId) {
      list = list.filter((s) => s.congregation_id === congregationId);
    }
    return list;
  },

  async _getRawTalks(speakerId?: string): Promise<Talk[]> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        let q = sb.from('talks').select('*').order('title');
        if (speakerId) q = q.eq('speaker_id', speakerId);
        const { data, error } = await q;
        if (!error && data) return data as Talk[];
        if (error) console.error('Error fetching raw talks from Supabase:', error);
      }
    }
    let list = getLocalItem<Talk[]>(KEY_TALKS, []);
    if (speakerId) {
      list = list.filter((t) => t.speaker_id === speakerId);
    }
    return list;
  },

  async getSpeakers(congregationId?: string): Promise<Speaker[]> {
    const [rawSpeakers, congs, rawTalks] = await Promise.all([
      this._getRawSpeakers(congregationId),
      this.getCongregations(),
      this._getRawTalks(),
    ]);

    return rawSpeakers.map((s) => {
      const c = congs.find((x) => x.id === s.congregation_id);
      const speakerTalks = rawTalks.filter((t) => t.speaker_id === s.id);
      return {
        ...s,
        congregation_name: c ? c.name : 'Desconocida',
        talks_count: speakerTalks.length,
      };
    });
  },

  async createSpeaker(
    data: Omit<Speaker, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Speaker> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newSpeaker: Speaker = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('speakers')
          .insert(newSpeaker)
          .select()
          .single();
        if (!error && inserted) return inserted as Speaker;
        if (error) {
          console.error('Error inserting speaker in Supabase:', error);
          throw new Error(error.message || 'Error al registrar conferenciante en Supabase');
        }
      }
    }

    const list = getLocalItem<Speaker[]>(KEY_SPEAKERS, []);
    list.push(newSpeaker);
    setLocalItem(KEY_SPEAKERS, list);
    return newSpeaker;
  },

  async updateSpeaker(
    id: string,
    data: Partial<Omit<Speaker, 'id' | 'created_at'>>
  ): Promise<Speaker | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('speakers')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated as Speaker;
        if (error) {
          console.error('Error updating speaker in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<Speaker[]>(KEY_SPEAKERS, []);
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      updated_at: now,
    };
    setLocalItem(KEY_SPEAKERS, list);
    return list[idx];
  },

  async deleteSpeaker(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.from('speakers').delete().eq('id', id);
        if (error) {
          console.error('Error deleting speaker from Supabase:', error);
          throw new Error(error.message || 'No se pudo eliminar el conferenciante.');
        }
        return true;
      }
    }

    const talks = getLocalItem<Talk[]>(KEY_TALKS, []);
    setLocalItem(
      KEY_TALKS,
      talks.filter((t) => t.speaker_id !== id)
    );

    const list = getLocalItem<Speaker[]>(KEY_SPEAKERS, []);
    setLocalItem(
      KEY_SPEAKERS,
      list.filter((s) => s.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // CONFERENCIAS / DISCURSOS (TALKS)
  // ----------------------------------------------------
  async getTalks(speakerId?: string, congregationId?: string): Promise<Talk[]> {
    const [rawTalks, rawSpeakers] = await Promise.all([
      this._getRawTalks(speakerId),
      this._getRawSpeakers(),
    ]);

    const talksWithDetails = rawTalks.map((t) => {
      const spk = rawSpeakers.find((s) => s.id === t.speaker_id);
      return {
        ...t,
        speaker_name: spk ? spk.full_name : 'Desconocido',
        congregation_id: spk ? spk.congregation_id : undefined,
      };
    });

    if (congregationId) {
      return talksWithDetails.filter((t) => t.congregation_id === congregationId);
    }

    return talksWithDetails;
  },

  async createTalk(data: Omit<Talk, 'id' | 'created_at' | 'updated_at'>): Promise<Talk> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newTalk: Talk = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('talks')
          .insert(newTalk)
          .select()
          .single();
        if (!error && inserted) return inserted as Talk;
        if (error) {
          console.error('Error creating talk in Supabase:', error);
          throw new Error(error.message || 'Error al registrar conferencia en Supabase');
        }
      }
    }

    const list = getLocalItem<Talk[]>(KEY_TALKS, []);
    list.push(newTalk);
    setLocalItem(KEY_TALKS, list);
    return newTalk;
  },

  async updateTalk(
    id: string,
    data: Partial<Omit<Talk, 'id' | 'created_at'>>
  ): Promise<Talk | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('talks')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated as Talk;
        if (error) {
          console.error('Error updating talk in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<Talk[]>(KEY_TALKS, []);
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      updated_at: now,
    };
    setLocalItem(KEY_TALKS, list);
    return list[idx];
  },

  async deleteTalk(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.from('talks').delete().eq('id', id);
        if (error) {
          console.error('Error deleting talk from Supabase:', error);
          throw new Error(error.message || 'Error al eliminar tema de conferencia');
        }
        return true;
      }
    }

    const list = getLocalItem<Talk[]>(KEY_TALKS, []);
    setLocalItem(
      KEY_TALKS,
      list.filter((t) => t.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // CONFERENCIAS DE ENTRADA (INCOMING ASSIGNMENTS)
  // ----------------------------------------------------
  async getIncomingAssignments(
    localCongregationId: string,
    month?: number,
    year?: number
  ): Promise<IncomingAssignment[]> {
    let list: IncomingAssignment[] = [];

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        let q = sb
          .from('incoming_assignments')
          .select('*')
          .eq('local_congregation_id', localCongregationId);

        if (month && year) {
          const lastDay = new Date(year, month, 0).getDate();
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          q = q.gte('meeting_date', startDate).lte('meeting_date', endDate);
        }
        const { data, error } = await q.order('meeting_date');
        if (!error && data) list = data as IncomingAssignment[];
        if (error) console.error('Error fetching incoming assignments from Supabase:', error);
      }
    } else {
      list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
      list = list.filter((a) => a.local_congregation_id === localCongregationId);

      if (month && year) {
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        list = list.filter((a) => a.meeting_date.startsWith(monthPrefix));
      }
    }

    list.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

    const [congs, speakers, talks] = await Promise.all([
      this.getCongregations(),
      this._getRawSpeakers(),
      this._getRawTalks(),
    ]);

    return list.map((a) => {
      const orig = congs.find((c) => c.id === a.origin_congregation_id);
      const spk = speakers.find((s) => s.id === a.speaker_id);
      const tlk = talks.find((t) => t.id === a.talk_id);
      return {
        ...a,
        origin_congregation_name: orig ? orig.name : 'Desconocida',
        speaker_name: spk ? spk.full_name : 'Desconocido',
        speaker_phone: spk?.phone,
        talk_title: tlk ? tlk.title : 'Tema no especificado',
      };
    });
  },

  async createIncomingAssignment(
    data: Omit<IncomingAssignment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<IncomingAssignment> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newAss: IncomingAssignment = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('incoming_assignments')
          .insert(newAss)
          .select()
          .single();
        if (!error && inserted) return inserted as IncomingAssignment;
        if (error) {
          console.error('Error creating incoming assignment in Supabase:', error);
          throw new Error(error.message || 'Error al programar visita en Supabase');
        }
      }
    }

    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    const exists = list.some(
      (a) =>
        a.local_congregation_id === data.local_congregation_id &&
        a.meeting_date === data.meeting_date
    );
    if (exists) {
      throw new Error(`Ya existe una conferencia de entrada registrada para el día ${data.meeting_date}.`);
    }

    list.push(newAss);
    setLocalItem(KEY_INCOMING, list);
    return newAss;
  },

  async updateIncomingAssignment(
    id: string,
    data: Partial<Omit<IncomingAssignment, 'id' | 'created_at'>>
  ): Promise<IncomingAssignment | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('incoming_assignments')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated as IncomingAssignment;
        if (error) {
          console.error('Error updating incoming assignment in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      updated_at: now,
    };
    setLocalItem(KEY_INCOMING, list);
    return list[idx];
  },

  async deleteIncomingAssignment(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.from('incoming_assignments').delete().eq('id', id);
        if (error) {
          console.error('Error deleting incoming assignment from Supabase:', error);
          throw new Error(error.message || 'Error al eliminar visita');
        }
        return true;
      }
    }

    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    setLocalItem(
      KEY_INCOMING,
      list.filter((a) => a.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // CONFERENCIAS DE SALIDA (OUTGOING ASSIGNMENTS)
  // ----------------------------------------------------
  async getOutgoingAssignments(
    localCongregationId: string,
    month?: number,
    year?: number
  ): Promise<OutgoingAssignment[]> {
    let list: OutgoingAssignment[] = [];

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        let q = sb
          .from('outgoing_assignments')
          .select('*')
          .eq('local_congregation_id', localCongregationId);

        if (month && year) {
          q = q.eq('month', month).eq('year', year);
        }
        const { data, error } = await q.order('meeting_date');
        if (!error && data) list = data as OutgoingAssignment[];
        if (error) console.error('Error fetching outgoing assignments from Supabase:', error);
      }
    } else {
      list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
      list = list.filter((a) => a.local_congregation_id === localCongregationId);

      if (month && year) {
        list = list.filter((a) => a.month === month && a.year === year);
      }
    }

    list.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

    const [congs, speakers, talks] = await Promise.all([
      this.getCongregations(),
      this._getRawSpeakers(),
      this._getRawTalks(),
    ]);

    return list.map((a) => {
      const dest = congs.find((c) => c.id === a.destination_congregation_id);
      const spk = speakers.find((s) => s.id === a.speaker_id);
      const tlk = talks.find((t) => t.id === a.talk_id);
      return {
        ...a,
        destination_congregation_name: dest ? dest.name : 'Desconocida',
        speaker_name: spk ? spk.full_name : 'Desconocido',
        speaker_phone: spk?.phone,
        talk_title: tlk ? tlk.title : 'Tema no especificado',
      };
    });
  },

  async createOutgoingAssignment(
    data: Omit<OutgoingAssignment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<OutgoingAssignment> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newAss: OutgoingAssignment = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('outgoing_assignments')
          .insert(newAss)
          .select()
          .single();
        if (!error && inserted) return inserted as OutgoingAssignment;
        if (error) {
          console.error('Error creating outgoing assignment in Supabase:', error);
          throw new Error(error.message || 'Error al programar salida en Supabase');
        }
      }
    }

    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    const speakerBusy = list.some(
      (a) => a.speaker_id === data.speaker_id && a.meeting_date === data.meeting_date
    );
    if (speakerBusy) {
      throw new Error(`Este conferenciante ya tiene una salida asignada para la fecha ${data.meeting_date}.`);
    }

    list.push(newAss);
    setLocalItem(KEY_OUTGOING, list);
    return newAss;
  },

  async updateOutgoingAssignment(
    id: string,
    data: Partial<Omit<OutgoingAssignment, 'id' | 'created_at'>>
  ): Promise<OutgoingAssignment | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('outgoing_assignments')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated as OutgoingAssignment;
        if (error) {
          console.error('Error updating outgoing assignment in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      updated_at: now,
    };
    setLocalItem(KEY_OUTGOING, list);
    return list[idx];
  },

  async deleteOutgoingAssignment(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.from('outgoing_assignments').delete().eq('id', id);
        if (error) {
          console.error('Error deleting outgoing assignment from Supabase:', error);
          throw new Error(error.message || 'Error al eliminar salida');
        }
        return true;
      }
    }

    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    setLocalItem(
      KEY_OUTGOING,
      list.filter((a) => a.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // ESTADÍSTICAS DEL PANEL (DASHBOARD STATS)
  // ----------------------------------------------------
  async getMonthlyStats(
    congregationId: string,
    month: number,
    year: number
  ): Promise<MonthlyStats> {
    const [incoming, outgoing, speakers, talks] = await Promise.all([
      this.getIncomingAssignments(congregationId, month, year),
      this.getOutgoingAssignments(congregationId, month, year),
      this.getSpeakers(congregationId),
      this.getTalks(undefined, congregationId),
    ]);

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingIncoming = incoming.filter((a) => a.meeting_date >= todayStr);
    const nextInc = upcomingIncoming.length > 0 ? upcomingIncoming[0] : incoming[0] || null;

    const upcomingOutgoing = outgoing.filter((a) => a.meeting_date >= todayStr);
    const nextOut = upcomingOutgoing.length > 0 ? upcomingOutgoing[0] : outgoing[0] || null;

    return {
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      nextIncoming: nextInc,
      nextOutgoing: nextOut,
      activeSpeakersCount: speakers.filter((s) => s.is_active).length,
      activeTalksCount: talks.filter((t) => t.is_active).length,
    };
  },

  // ----------------------------------------------------
  // LOGO DE CONGREGACIÓN
  // ----------------------------------------------------
  async uploadCongregationLogo(congregationId: string, logoDataUrl: string): Promise<string> {
    await this.updateCongregation(congregationId, { logo_url: logoDataUrl });
    return logoDataUrl;
  },

  async removeCongregationLogo(congregationId: string): Promise<void> {
    await this.updateCongregation(congregationId, { logo_url: null });
  },
};
