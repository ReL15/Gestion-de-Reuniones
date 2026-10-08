import {
  Congregation,
  Profile,
  Speaker,
  Talk,
  Reader,
  IncomingAssignment,
  OutgoingAssignment,
  MonthlyStats,
} from '../types/database';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { parseDateParts } from '../utils/dateUtils';

// Claves de LocalStorage para contingencia offline (inician vacías, sin datos ficticios)
const KEY_CONGREGATIONS = 'jw_prog_congregations_v2';
const KEY_PROFILES = 'jw_prog_profiles_v2';
const KEY_SPEAKERS = 'jw_prog_speakers_v2';
const KEY_TALKS = 'jw_prog_talks_v2';
const KEY_READERS = 'jw_prog_readers_v2';
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

    let outgoingRows: Array<Pick<OutgoingAssignment, 'speaker_id' | 'talk_id'>> = [];
    if (rawSpeakers.length > 0 && isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data, error } = await sb
          .from('outgoing_assignments')
          .select('speaker_id, talk_id')
          .in('speaker_id', rawSpeakers.map((speaker) => speaker.id));
        if (!error && data) outgoingRows = data as typeof outgoingRows;
      }
    }
    if (outgoingRows.length === 0) {
      outgoingRows = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    }

    return rawSpeakers.map((s) => {
      const c = congs.find((x) => x.id === s.congregation_id);
      const assignedTalkIds = outgoingRows
        .filter((assignment) => assignment.speaker_id === s.id)
        .map((assignment) => assignment.talk_id);
      const legacyTalkIds = rawTalks
        .filter((talk) => talk.speaker_id === s.id)
        .map((talk) => talk.id);
      return {
        ...s,
        congregation_name: c ? c.name : 'Desconocida',
        talks_count: new Set([...assignedTalkIds, ...legacyTalkIds]).size,
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
    setLocalItem(KEY_TALKS, talks.map((talk) =>
      talk.speaker_id === id ? { ...talk, speaker_id: null } : talk
    ));

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

    const talksWithDetails = rawTalks.flatMap((t): Talk[] => {
      const spk = t.speaker_id ? rawSpeakers.find((s) => s.id === t.speaker_id) : undefined;
      const talkCongregationId = t.congregation_id || spk?.congregation_id;
      if (!talkCongregationId) return [];
      return [{
        ...t,
        speaker_name: spk?.full_name,
        congregation_id: talkCongregationId,
      }];
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
  // LECTORES LOCALES (READERS - ALMACENADOS POR SEPARADO DE ORADORES)
  // ----------------------------------------------------
  async getReaders(congregationId?: string): Promise<Reader[]> {
    let list: Reader[] = [];

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let q = sb.from('readers').select('*').order('full_name');
          if (congregationId) {
            q = q.eq('congregation_id', congregationId);
          }
          const { data, error } = await q;
          if (!error && data) {
            list = data as Reader[];
          } else if (error) {
            // Si la tabla aún no existe o da error, cargar desde local
            list = getLocalItem<Reader[]>(KEY_READERS, []);
            if (congregationId) {
              list = list.filter((r) => r.congregation_id === congregationId);
            }
          }
        } catch {
          list = getLocalItem<Reader[]>(KEY_READERS, []);
        }
      }
    } else {
      list = getLocalItem<Reader[]>(KEY_READERS, []);
      if (congregationId) {
        list = list.filter((r) => r.congregation_id === congregationId);
      }
    }

    const congs = await this.getCongregations();
    return list.map((r) => {
      const c = congs.find((x) => x.id === r.congregation_id);
      return {
        ...r,
        congregation_name: c ? c.name : 'Desconocida',
      };
    });
  },

  async createReader(
    data: Omit<Reader, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Reader> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const newReader: Reader = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: inserted, error } = await sb
            .from('readers')
            .insert(newReader)
            .select()
            .single();
          if (!error && inserted) {
            const list = getLocalItem<Reader[]>(KEY_READERS, []);
            list.push(inserted as Reader);
            setLocalItem(KEY_READERS, list);
            return inserted as Reader;
          }
          if (error) {
            console.warn('Notice: readers table insert in Supabase:', error.message);
          }
        } catch (e) {
          console.warn('Notice: Supabase insert reader error:', e);
        }
      }
    }

    const list = getLocalItem<Reader[]>(KEY_READERS, []);
    list.push(newReader);
    setLocalItem(KEY_READERS, list);
    return newReader;
  },

  async updateReader(
    id: string,
    data: Partial<Omit<Reader, 'id' | 'created_at'>>
  ): Promise<Reader | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: updated, error } = await sb
            .from('readers')
            .update({ ...data, updated_at: now })
            .eq('id', id)
            .select()
            .single();
          if (!error && updated) {
            const list = getLocalItem<Reader[]>(KEY_READERS, []);
            const idx = list.findIndex((r) => r.id === id);
            if (idx !== -1) list[idx] = updated as Reader;
            setLocalItem(KEY_READERS, list);
            return updated as Reader;
          }
          if (error) {
            console.warn('Notice: readers update in Supabase:', error.message);
          }
        } catch (e) {
          console.warn('Notice: Supabase update reader error:', e);
        }
      }
    }

    const list = getLocalItem<Reader[]>(KEY_READERS, []);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      updated_at: now,
    };
    setLocalItem(KEY_READERS, list);
    return list[idx];
  },

  async deleteReader(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { error } = await sb.from('readers').delete().eq('id', id);
          if (error) {
            console.warn('Notice: readers delete in Supabase:', error.message);
          }
        } catch (e) {
          console.warn('Notice: Supabase delete reader error:', e);
        }
      }
    }

    const list = getLocalItem<Reader[]>(KEY_READERS, []);
    setLocalItem(
      KEY_READERS,
      list.filter((r) => r.id !== id)
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

    // Sincronización automática activa: Si otra congregación registró una salida hacia esta congregación,
    // aseguramos que exista la correspondiente entrada local (dejando reader_id y president_id libres para que los asigne la congregación receptora).
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let outQ = sb
            .from('outgoing_assignments')
            .select('*')
            .eq('destination_congregation_id', localCongregationId);
          if (month && year) {
            outQ = outQ.eq('month', month).eq('year', year);
          }
          const { data: outList } = await outQ;
          if (outList && outList.length > 0) {
            for (const out of outList) {
              const existingIdx = list.findIndex(
                (i) => i.meeting_date === out.meeting_date && i.origin_congregation_id === out.local_congregation_id
              );
              if (existingIdx === -1) {
                // No existe entrada en esta fecha para este origen: crearla con reader_id y president_id libres
                const newInc = {
                  id: generateUUID(),
                  local_congregation_id: localCongregationId,
                  origin_congregation_id: out.local_congregation_id,
                  speaker_id: out.speaker_id,
                  talk_id: out.talk_id,
                  song_number: out.song_number,
                  meeting_date: out.meeting_date,
                  meeting_time: out.meeting_time,
                  is_no_meeting: false,
                  notes: out.notes,
                  reader_id: null,
                  president_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                const { data: inserted, error: insErr } = await sb
                  .from('incoming_assignments')
                  .insert(newInc)
                  .select()
                  .single();
                if (!insErr && inserted) {
                  list.push(inserted as IncomingAssignment);
                } else if (!insErr) {
                  list.push(newInc as unknown as IncomingAssignment);
                }
              } else {
                // Si existe pero cambió el orador o discurso desde la congregación emisora, actualizarlo preservando reader_id y president_id
                const existing = list[existingIdx];
                if (
                  existing.speaker_id !== out.speaker_id ||
                  existing.talk_id !== out.talk_id ||
                  existing.song_number !== out.song_number ||
                  existing.meeting_time !== out.meeting_time
                ) {
                  await sb
                    .from('incoming_assignments')
                    .update({
                      speaker_id: out.speaker_id,
                      talk_id: out.talk_id,
                      song_number: out.song_number,
                      meeting_time: out.meeting_time,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
                  list[existingIdx] = {
                    ...existing,
                    speaker_id: out.speaker_id,
                    talk_id: out.talk_id,
                    song_number: out.song_number,
                    meeting_time: out.meeting_time,
                  };
                }
              }
            }
          }
        } catch (e) {
          console.warn('Notice ensuring outgoing synced to incoming in Supabase:', e);
        }
      }
    } else {
      const allOutList = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
      const matchingOut = allOutList.filter(
        (o) =>
          o.destination_congregation_id === localCongregationId &&
          (!month || !year || (o.month === month && o.year === year))
      );
      const storedInc = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
      let updatedLocal = false;
      for (const out of matchingOut) {
        const existingIdx = list.findIndex(
          (i) => i.meeting_date === out.meeting_date && i.origin_congregation_id === out.local_congregation_id
        );
        if (existingIdx === -1) {
          const newInc: IncomingAssignment = {
            id: generateUUID(),
            local_congregation_id: localCongregationId,
            origin_congregation_id: out.local_congregation_id,
            speaker_id: out.speaker_id,
            talk_id: out.talk_id,
            song_number: out.song_number,
            meeting_date: out.meeting_date,
            meeting_time: out.meeting_time,
            is_no_meeting: false,
            notes: out.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          list.push(newInc);
          storedInc.push(newInc);
          updatedLocal = true;
        }
      }
      if (updatedLocal) {
        setLocalItem(KEY_INCOMING, storedInc);
      }
    }

    list.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

    const [congs, speakers, talks, readers] = await Promise.all([
      this.getCongregations(),
      this._getRawSpeakers(),
      this._getRawTalks(),
      this.getReaders(localCongregationId),
    ]);

    return list.map((a) => {
      const orig = a.origin_congregation_id ? congs.find((c) => c.id === a.origin_congregation_id) : undefined;
      const spk = a.speaker_id ? speakers.find((s) => s.id === a.speaker_id) : undefined;
      const tlk = a.talk_id ? talks.find((t) => t.id === a.talk_id) : undefined;
      const rdr = a.reader_id ? readers.find((r) => r.id === a.reader_id) : undefined;
      const pres = a.president_id ? readers.find((r) => r.id === a.president_id) : undefined;
      return {
        ...a,
        origin_congregation_name: orig ? orig.name : a.is_no_meeting ? '' : 'Desconocida',
        speaker_name: spk ? spk.full_name : a.is_no_meeting ? '' : 'Desconocido',
        speaker_phone: spk?.phone,
        talk_title: tlk ? tlk.title : a.is_no_meeting ? '' : 'Tema no especificado',
        reader_name: rdr ? rdr.full_name : undefined,
        reader_phone: rdr?.phone,
        president_name: pres ? pres.full_name : undefined,
        president_phone: pres?.phone,
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

    let saved = newAss;

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('incoming_assignments')
          .insert(newAss)
          .select()
          .single();
        if (!error && inserted) {
          saved = inserted as IncomingAssignment;
        } else if (error) {
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
    if (exists && !isSupabaseConfigured()) {
      throw new Error(`Ya existe una conferencia de entrada registrada para el día ${data.meeting_date}.`);
    }

    list.push(saved);
    setLocalItem(KEY_INCOMING, list);

    // Sincronización automática: si es una entrada con orador visitante, registrar como salida en la otra congregación
    if (!saved.is_no_meeting && saved.origin_congregation_id && saved.speaker_id && saved.talk_id) {
      try {
        await this._syncIncomingToOutgoing(saved);
      } catch (e) {
        console.warn('Notice: error syncing incoming to outgoing:', e);
      }
    }

    return saved;
  },

  async updateIncomingAssignment(
    id: string,
    data: Partial<Omit<IncomingAssignment, 'id' | 'created_at'>>
  ): Promise<IncomingAssignment | null> {
    const now = new Date().toISOString();
    let updatedObj: IncomingAssignment | null = null;

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('incoming_assignments')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) {
          updatedObj = updated as IncomingAssignment;
        } else if (error) {
          console.error('Error updating incoming assignment in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    const idx = list.findIndex((a) => a.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...data,
        updated_at: now,
      };
      setLocalItem(KEY_INCOMING, list);
      if (!updatedObj) updatedObj = list[idx];
    }

    if (updatedObj) {
      try {
        await this._syncIncomingToOutgoing(updatedObj);
      } catch (e) {
        console.warn('Notice: error syncing updated incoming to outgoing:', e);
      }
    }

    return updatedObj;
  },

  async deleteIncomingAssignment(id: string): Promise<boolean> {
    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    let oldAss = list.find((a) => a.id === id);

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        if (!oldAss) {
          const { data: fetched } = await sb
            .from('incoming_assignments')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (fetched) oldAss = fetched as IncomingAssignment;
        }
        const { error } = await sb.from('incoming_assignments').delete().eq('id', id);
        if (error) {
          console.error('Error deleting incoming assignment from Supabase:', error);
          throw new Error(error.message || 'Error al eliminar visita');
        }
      }
    }

    setLocalItem(
      KEY_INCOMING,
      list.filter((a) => a.id !== id)
    );

    if (oldAss && oldAss.origin_congregation_id && oldAss.local_congregation_id && oldAss.meeting_date) {
      try {
        await this._deleteSyncedOutgoing(
          oldAss.origin_congregation_id,
          oldAss.local_congregation_id,
          oldAss.meeting_date
        );
      } catch (e) {
        console.warn('Notice: error deleting synced outgoing:', e);
      }
    }

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

    // Sincronización automática activa: Si otra congregación registró una entrada con orador de esta congregación,
    // aseguramos que aparezca automáticamente en la lista de salidas de esta congregación.
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          let incQ = sb
            .from('incoming_assignments')
            .select('*')
            .eq('origin_congregation_id', localCongregationId)
            .eq('is_no_meeting', false);
          if (month && year) {
            const lastDay = new Date(year, month, 0).getDate();
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            incQ = incQ.gte('meeting_date', startDate).lte('meeting_date', endDate);
          }
          const { data: incList } = await incQ;
          if (incList && incList.length > 0) {
            for (const inc of incList) {
              const existingIdx = list.findIndex(
                (o) => o.meeting_date === inc.meeting_date && o.destination_congregation_id === inc.local_congregation_id
              );
              if (existingIdx === -1 && inc.speaker_id && inc.talk_id) {
                const { year: iYear, month: iMonth, day: iDay } = parseDateParts(inc.meeting_date);
                const weekNumber = Math.min(5, Math.max(1, Math.ceil(iDay / 7)));
                const newOut = {
                  id: generateUUID(),
                  local_congregation_id: localCongregationId,
                  destination_congregation_id: inc.local_congregation_id,
                  speaker_id: inc.speaker_id,
                  talk_id: inc.talk_id,
                  song_number: inc.song_number || 1,
                  month: iMonth,
                  year: iYear,
                  week_number: weekNumber,
                  meeting_date: inc.meeting_date,
                  meeting_time: inc.meeting_time,
                  notes: inc.notes,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                const { data: inserted, error: insErr } = await sb
                  .from('outgoing_assignments')
                  .insert(newOut)
                  .select()
                  .single();
                if (!insErr && inserted) {
                  list.push(inserted as OutgoingAssignment);
                } else if (!insErr) {
                  list.push(newOut as unknown as OutgoingAssignment);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Notice ensuring incoming synced to outgoing in Supabase:', e);
        }
      }
    } else {
      const allIncList = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
      const matchingInc = allIncList.filter(
        (i) =>
          i.origin_congregation_id === localCongregationId &&
          !i.is_no_meeting &&
          i.speaker_id &&
          i.talk_id
      );
      const storedOut = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
      let updatedLocal = false;
      for (const inc of matchingInc) {
        const { year: iYear, month: iMonth, day: iDay } = parseDateParts(inc.meeting_date);
        if (month && year && (iMonth !== month || iYear !== year)) continue;
        const exists = list.some(
          (o) => o.meeting_date === inc.meeting_date && o.destination_congregation_id === inc.local_congregation_id
        );
        if (!exists) {
          const weekNumber = Math.min(5, Math.max(1, Math.ceil(iDay / 7)));
          const newOut: OutgoingAssignment = {
            id: generateUUID(),
            local_congregation_id: localCongregationId,
            destination_congregation_id: inc.local_congregation_id,
            speaker_id: inc.speaker_id!,
            talk_id: inc.talk_id!,
            song_number: inc.song_number || 1,
            month: iMonth,
            year: iYear,
            week_number: weekNumber,
            meeting_date: inc.meeting_date,
            meeting_time: inc.meeting_time,
            notes: inc.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          list.push(newOut);
          storedOut.push(newOut);
          updatedLocal = true;
        }
      }
      if (updatedLocal) {
        setLocalItem(KEY_OUTGOING, storedOut);
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

    let saved = newAss;

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: inserted, error } = await sb
          .from('outgoing_assignments')
          .insert(newAss)
          .select()
          .single();
        if (!error && inserted) {
          saved = inserted as OutgoingAssignment;
        } else if (error) {
          console.error('Error creating outgoing assignment in Supabase:', error);
          throw new Error(error.message || 'Error al programar salida en Supabase');
        }
      }
    }

    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    const speakerBusy = list.some(
      (a) => a.speaker_id === data.speaker_id && a.meeting_date === data.meeting_date
    );
    if (speakerBusy && !isSupabaseConfigured()) {
      throw new Error(`Este conferenciante ya tiene una salida asignada para la fecha ${data.meeting_date}.`);
    }

    list.push(saved);
    setLocalItem(KEY_OUTGOING, list);

    // Sincronización automática: registrar como entrada en la congregación destino
    try {
      await this._syncOutgoingToIncoming(saved);
    } catch (e) {
      console.warn('Notice: error syncing outgoing to incoming:', e);
    }

    return saved;
  },

  async updateOutgoingAssignment(
    id: string,
    data: Partial<Omit<OutgoingAssignment, 'id' | 'created_at'>>
  ): Promise<OutgoingAssignment | null> {
    const now = new Date().toISOString();
    let updatedObj: OutgoingAssignment | null = null;

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: updated, error } = await sb
          .from('outgoing_assignments')
          .update({ ...data, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) {
          updatedObj = updated as OutgoingAssignment;
        } else if (error) {
          console.error('Error updating outgoing assignment in Supabase:', error);
          throw new Error(`Error en Supabase: ${error.message}`);
        }
      }
    }

    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    const idx = list.findIndex((a) => a.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...data,
        updated_at: now,
      };
      setLocalItem(KEY_OUTGOING, list);
      if (!updatedObj) updatedObj = list[idx];
    }

    if (updatedObj) {
      try {
        await this._syncOutgoingToIncoming(updatedObj);
      } catch (e) {
        console.warn('Notice: error syncing updated outgoing to incoming:', e);
      }
    }

    return updatedObj;
  },

  async deleteOutgoingAssignment(id: string): Promise<boolean> {
    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    let oldAss = list.find((a) => a.id === id);

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        if (!oldAss) {
          const { data: fetched } = await sb
            .from('outgoing_assignments')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (fetched) oldAss = fetched as OutgoingAssignment;
        }
        const { error } = await sb.from('outgoing_assignments').delete().eq('id', id);
        if (error) {
          console.error('Error deleting outgoing assignment from Supabase:', error);
          throw new Error(error.message || 'Error al eliminar salida');
        }
      }
    }

    setLocalItem(
      KEY_OUTGOING,
      list.filter((a) => a.id !== id)
    );

    if (oldAss && oldAss.destination_congregation_id && oldAss.local_congregation_id && oldAss.meeting_date) {
      try {
        await this._deleteSyncedIncoming(
          oldAss.destination_congregation_id,
          oldAss.local_congregation_id,
          oldAss.meeting_date
        );
      } catch (e) {
        console.warn('Notice: error deleting synced incoming:', e);
      }
    }

    return true;
  },

  // ----------------------------------------------------
  // HELPERS DE SINCRONIZACIÓN AUTOMÁTICA BIDIRECCIONAL
  // ----------------------------------------------------
  async _syncIncomingToOutgoing(inc: IncomingAssignment): Promise<void> {
    if (!inc.origin_congregation_id || !inc.local_congregation_id || !inc.meeting_date) return;

    if (inc.is_no_meeting) {
      await this._deleteSyncedOutgoing(inc.origin_congregation_id, inc.local_congregation_id, inc.meeting_date);
      return;
    }

    if (!inc.speaker_id || !inc.talk_id) return;

    const { year, month, day } = parseDateParts(inc.meeting_date);
    const weekNumber = Math.min(5, Math.max(1, Math.ceil(day / 7)));

    const outgoingPayload: Omit<OutgoingAssignment, 'id' | 'created_at' | 'updated_at'> = {
      local_congregation_id: inc.origin_congregation_id,
      destination_congregation_id: inc.local_congregation_id,
      speaker_id: inc.speaker_id,
      talk_id: inc.talk_id,
      song_number: inc.song_number || 1,
      month,
      year,
      week_number: weekNumber,
      meeting_date: inc.meeting_date,
      meeting_time: inc.meeting_time,
      notes: inc.notes,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: existing } = await sb
            .from('outgoing_assignments')
            .select('id')
            .eq('local_congregation_id', inc.origin_congregation_id)
            .eq('destination_congregation_id', inc.local_congregation_id)
            .eq('meeting_date', inc.meeting_date)
            .maybeSingle();

          if (existing) {
            await sb
              .from('outgoing_assignments')
              .update({
                speaker_id: inc.speaker_id,
                talk_id: inc.talk_id,
                song_number: inc.song_number || 1,
                meeting_time: inc.meeting_time,
                notes: inc.notes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await sb.from('outgoing_assignments').insert({
              ...outgoingPayload,
              id: generateUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn('Notice syncing to outgoing in Supabase:', e);
        }
      }
    }

    const outList = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    const idx = outList.findIndex(
      (o) =>
        o.local_congregation_id === inc.origin_congregation_id &&
        o.destination_congregation_id === inc.local_congregation_id &&
        o.meeting_date === inc.meeting_date
    );
    if (idx !== -1) {
      outList[idx] = {
        ...outList[idx],
        ...outgoingPayload,
        updated_at: new Date().toISOString(),
      };
    } else {
      outList.push({
        ...outgoingPayload,
        id: generateUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setLocalItem(KEY_OUTGOING, outList);
  },

  async _deleteSyncedOutgoing(originCongId: string, localCongId: string, meetingDate: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb
            .from('outgoing_assignments')
            .delete()
            .eq('local_congregation_id', originCongId)
            .eq('destination_congregation_id', localCongId)
            .eq('meeting_date', meetingDate);
        } catch (e) {
          console.warn('Notice deleting synced outgoing in Supabase:', e);
        }
      }
    }
    const outList = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, []);
    setLocalItem(
      KEY_OUTGOING,
      outList.filter(
        (o) =>
          !(
            o.local_congregation_id === originCongId &&
            o.destination_congregation_id === localCongId &&
            o.meeting_date === meetingDate
          )
      )
    );
  },

  async _syncOutgoingToIncoming(out: OutgoingAssignment): Promise<void> {
    if (!out.destination_congregation_id || !out.local_congregation_id || !out.meeting_date) return;
    if (!out.speaker_id || !out.talk_id) return;

    const incomingPayload: Omit<IncomingAssignment, 'id' | 'created_at' | 'updated_at'> = {
      local_congregation_id: out.destination_congregation_id,
      origin_congregation_id: out.local_congregation_id,
      speaker_id: out.speaker_id,
      talk_id: out.talk_id,
      song_number: out.song_number,
      meeting_date: out.meeting_date,
      meeting_time: out.meeting_time,
      is_no_meeting: false,
      notes: out.notes,
    };

    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          const { data: existing } = await sb
            .from('incoming_assignments')
            .select('id')
            .eq('local_congregation_id', out.destination_congregation_id)
            .eq('origin_congregation_id', out.local_congregation_id)
            .eq('meeting_date', out.meeting_date)
            .maybeSingle();

          if (existing) {
            await sb
              .from('incoming_assignments')
              .update({
                speaker_id: out.speaker_id,
                talk_id: out.talk_id,
                song_number: out.song_number,
                meeting_time: out.meeting_time,
                notes: out.notes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await sb.from('incoming_assignments').insert({
              ...incomingPayload,
              id: generateUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn('Notice syncing to incoming in Supabase:', e);
        }
      }
    }

    const incList = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    const idx = incList.findIndex(
      (i) =>
        i.local_congregation_id === out.destination_congregation_id &&
        i.origin_congregation_id === out.local_congregation_id &&
        i.meeting_date === out.meeting_date
    );
    if (idx !== -1) {
      incList[idx] = {
        ...incList[idx],
        ...incomingPayload,
        updated_at: new Date().toISOString(),
      };
    } else {
      incList.push({
        ...incomingPayload,
        id: generateUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setLocalItem(KEY_INCOMING, incList);
  },

  async _deleteSyncedIncoming(destinationCongId: string, localCongId: string, meetingDate: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        try {
          await sb
            .from('incoming_assignments')
            .delete()
            .eq('local_congregation_id', destinationCongId)
            .eq('origin_congregation_id', localCongId)
            .eq('meeting_date', meetingDate);
        } catch (e) {
          console.warn('Notice deleting synced incoming in Supabase:', e);
        }
      }
    }
    const incList = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, []);
    setLocalItem(
      KEY_INCOMING,
      incList.filter(
        (i) =>
          !(
            i.local_congregation_id === destinationCongId &&
            i.origin_congregation_id === localCongId &&
            i.meeting_date === meetingDate
          )
      )
    );
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

  // ----------------------------------------------------
  // AUTENTICACIÓN / CONSULTA POR NÚMERO DE TELÉFONO
  // ----------------------------------------------------
  async findBrothersByPhone(inputPhone: string): Promise<Array<{
    id: string;
    full_name: string;
    phone: string;
    congregation_id: string;
    congregation_name: string;
    roles_description: string;
    is_speaker?: boolean;
    is_reader?: boolean;
    is_president?: boolean;
  }>> {
    const cleanInput = inputPhone.replace(/\D/g, '');
    if (cleanInput.length < 4) return [];

    const [congs, rawSpeakers, rawReaders] = await Promise.all([
      this.getCongregations(),
      this._getRawSpeakers(),
      this.getReaders(),
    ]);

    const matchesPhone = (targetPhone?: string) => {
      if (!targetPhone) return false;
      const cleanTarget = targetPhone.replace(/\D/g, '');
      if (!cleanTarget || cleanTarget.length < 4) return false;
      return (
        cleanTarget === cleanInput ||
        cleanTarget.endsWith(cleanInput) ||
        cleanInput.endsWith(cleanTarget)
      );
    };

    const map = new Map<string, {
      id: string;
      full_name: string;
      phone: string;
      congregation_id: string;
      congregation_name: string;
      roles: Set<string>;
      is_speaker?: boolean;
      is_reader?: boolean;
      is_president?: boolean;
    }>();

    // 1. Revisar conferenciantes
    for (const spk of rawSpeakers) {
      if (matchesPhone(spk.phone)) {
        const cong = congs.find((c) => c.id === spk.congregation_id);
        const key = `${spk.full_name.trim().toLowerCase()}_${spk.congregation_id}`;
        const existing = map.get(key);
        if (existing) {
          existing.roles.add('Discursante');
          existing.is_speaker = true;
        } else {
          map.set(key, {
            id: spk.id,
            full_name: spk.full_name,
            phone: spk.phone,
            congregation_id: spk.congregation_id,
            congregation_name: cong ? cong.name : 'Congregación',
            roles: new Set(['Discursante']),
            is_speaker: true,
          });
        }
      }
    }

    // 2. Revisar lectores y presidentes
    for (const rdr of rawReaders) {
      if (matchesPhone(rdr.phone)) {
        const cong = congs.find((c) => c.id === rdr.congregation_id);
        const key = `${rdr.full_name.trim().toLowerCase()}_${rdr.congregation_id}`;
        const existing = map.get(key);
        const rdrRoles: string[] = [];
        if (rdr.can_read !== false) rdrRoles.push('Lector');
        if (rdr.can_preside) rdrRoles.push('Presidente');
        if (rdrRoles.length === 0) rdrRoles.push('Lector');

        if (existing) {
          rdrRoles.forEach((r) => existing.roles.add(r));
          if (rdr.can_read !== false) existing.is_reader = true;
          if (rdr.can_preside) existing.is_president = true;
        } else {
          map.set(key, {
            id: rdr.id,
            full_name: rdr.full_name,
            phone: rdr.phone || inputPhone,
            congregation_id: rdr.congregation_id,
            congregation_name: cong ? cong.name : 'Congregación',
            roles: new Set(rdrRoles),
            is_reader: rdr.can_read !== false,
            is_president: Boolean(rdr.can_preside),
          });
        }
      }
    }

    return Array.from(map.values()).map((item) => ({
      id: item.id,
      full_name: item.full_name,
      phone: item.phone,
      congregation_id: item.congregation_id,
      congregation_name: item.congregation_name,
      roles_description: Array.from(item.roles).join(' · '),
      is_speaker: item.is_speaker,
      is_reader: item.is_reader,
      is_president: item.is_president,
    }));
  },
};
