import {
  Congregation,
  Profile,
  Speaker,
  Talk,
  IncomingAssignment,
  OutgoingAssignment,
  MonthlyStats,
} from '../types/database';
import {
  INITIAL_CONGREGATIONS,
  INITIAL_PROFILES,
  INITIAL_SPEAKERS,
  INITIAL_TALKS,
  INITIAL_INCOMING,
  INITIAL_OUTGOING,
} from '../lib/mockData';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

// LocalStorage Keys for resilient demo persistence
const KEY_CONGREGATIONS = 'jw_prog_congregations_v1';
const KEY_PROFILES = 'jw_prog_profiles_v1';
const KEY_SPEAKERS = 'jw_prog_speakers_v1';
const KEY_TALKS = 'jw_prog_talks_v1';
const KEY_INCOMING = 'jw_prog_incoming_v1';
const KEY_OUTGOING = 'jw_prog_outgoing_v1';

function getLocalItem<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultVal));
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
  // Reset all to sample factory data
  resetToSampleData() {
    setLocalItem(KEY_CONGREGATIONS, INITIAL_CONGREGATIONS);
    setLocalItem(KEY_PROFILES, INITIAL_PROFILES);
    setLocalItem(KEY_SPEAKERS, INITIAL_SPEAKERS);
    setLocalItem(KEY_TALKS, INITIAL_TALKS);
    setLocalItem(KEY_INCOMING, INITIAL_INCOMING);
    setLocalItem(KEY_OUTGOING, INITIAL_OUTGOING);
  },

  // ----------------------------------------------------
  // CONGREGATIONS
  // ----------------------------------------------------
  async getCongregations(): Promise<Congregation[]> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data, error } = await sb.from('congregations').select('*').order('name');
        if (!error && data) return data as Congregation[];
      }
    }
    return getLocalItem<Congregation[]>(KEY_CONGREGATIONS, INITIAL_CONGREGATIONS);
  },

  async getCongregation(id: string): Promise<Congregation | null> {
    const list = await this.getCongregations();
    return list.find((c) => c.id === id) || null;
  },

  async createCongregation(
    data: Omit<Congregation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Congregation> {
    const id = `cong-${Date.now()}`;
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
        if (!error && inserted) return inserted as Congregation;
      }
    }

    const list = getLocalItem<Congregation[]>(KEY_CONGREGATIONS, INITIAL_CONGREGATIONS);
    list.push(newCong);
    setLocalItem(KEY_CONGREGATIONS, list);

    // If coordinator email provided, also create coordinator profile
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
      }
    }

    const list = getLocalItem<Congregation[]>(KEY_CONGREGATIONS, INITIAL_CONGREGATIONS);
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

  // ----------------------------------------------------
  // PROFILES / ACCOUNTS
  // ----------------------------------------------------
  async getProfiles(): Promise<Profile[]> {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        const { data, error } = await sb.from('profiles').select('*');
        if (!error && data) return data as Profile[];
      }
    }
    return getLocalItem<Profile[]>(KEY_PROFILES, INITIAL_PROFILES);
  },

  async createCongregationAdminProfile(params: {
    congregation_id: string;
    email: string;
    full_name: string;
    phone: string;
  }): Promise<Profile> {
    const id = `user-coord-${Date.now()}`;
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

    const list = getLocalItem<Profile[]>(KEY_PROFILES, INITIAL_PROFILES);
    // remove existing if same email
    const filtered = list.filter((p) => p.email !== newProfile.email);
    filtered.push(newProfile);
    setLocalItem(KEY_PROFILES, filtered);
    return newProfile;
  },

  // ----------------------------------------------------
  // SPEAKERS (Conferenciantes)
  // ----------------------------------------------------
  async getSpeakers(congregationId?: string): Promise<Speaker[]> {
    let list: Speaker[] = [];
    if (isSupabaseConfigured()) {
      const sb = getSupabaseClient();
      if (sb) {
        let q = sb.from('speakers').select('*').order('full_name');
        if (congregationId) q = q.eq('congregation_id', congregationId);
        const { data, error } = await q;
        if (!error && data) list = data as Speaker[];
      }
    }
    if (list.length === 0) {
      list = getLocalItem<Speaker[]>(KEY_SPEAKERS, INITIAL_SPEAKERS);
      if (congregationId) {
        list = list.filter((s) => s.congregation_id === congregationId);
      }
    }

    // Attach congregation names and talks count
    const congs = await this.getCongregations();
    const talks = await this.getTalks();
    return list.map((s) => {
      const c = congs.find((x) => x.id === s.congregation_id);
      const speakerTalks = talks.filter((t) => t.speaker_id === s.id);
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
    const id = `spk-${Date.now()}`;
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
      }
    }

    const list = getLocalItem<Speaker[]>(KEY_SPEAKERS, INITIAL_SPEAKERS);
    list.push(newSpeaker);
    setLocalItem(KEY_SPEAKERS, list);
    return newSpeaker;
  },

  async updateSpeaker(
    id: string,
    data: Partial<Omit<Speaker, 'id' | 'created_at'>>
  ): Promise<Speaker | null> {
    const now = new Date().toISOString();
    const list = getLocalItem<Speaker[]>(KEY_SPEAKERS, INITIAL_SPEAKERS);
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
    // Check if speaker has assignments
    const incoming = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, INITIAL_INCOMING);
    const outgoing = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, INITIAL_OUTGOING);

    const hasIncoming = incoming.some((a) => a.speaker_id === id);
    const hasOutgoing = outgoing.some((a) => a.speaker_id === id);

    if (hasIncoming || hasOutgoing) {
      throw new Error(
        'No se puede eliminar el conferenciante porque tiene asignaciones de reuniones registradas. Puedes marcarlo como inactivo.'
      );
    }

    // Delete talks
    const talks = getLocalItem<Talk[]>(KEY_TALKS, INITIAL_TALKS);
    setLocalItem(
      KEY_TALKS,
      talks.filter((t) => t.speaker_id !== id)
    );

    const list = getLocalItem<Speaker[]>(KEY_SPEAKERS, INITIAL_SPEAKERS);
    setLocalItem(
      KEY_SPEAKERS,
      list.filter((s) => s.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // TALKS (Conferencias)
  // ----------------------------------------------------
  async getTalks(speakerId?: string, congregationId?: string): Promise<Talk[]> {
    let list = getLocalItem<Talk[]>(KEY_TALKS, INITIAL_TALKS);

    if (speakerId) {
      list = list.filter((t) => t.speaker_id === speakerId);
    }

    const speakers = await this.getSpeakers();
    const talksWithDetails = list.map((t) => {
      const spk = speakers.find((s) => s.id === t.speaker_id);
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
    const id = `tlk-${Date.now()}`;
    const now = new Date().toISOString();
    const newTalk: Talk = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    const list = getLocalItem<Talk[]>(KEY_TALKS, INITIAL_TALKS);
    list.push(newTalk);
    setLocalItem(KEY_TALKS, list);
    return newTalk;
  },

  async updateTalk(
    id: string,
    data: Partial<Omit<Talk, 'id' | 'created_at'>>
  ): Promise<Talk | null> {
    const now = new Date().toISOString();
    const list = getLocalItem<Talk[]>(KEY_TALKS, INITIAL_TALKS);
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
    // Check if assigned
    const incoming = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, INITIAL_INCOMING);
    const outgoing = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, INITIAL_OUTGOING);
    if (incoming.some((a) => a.talk_id === id) || outgoing.some((a) => a.talk_id === id)) {
      throw new Error(
        'No se puede eliminar este tema porque ya está asignado en una reunión. Puedes marcarlo como inactivo.'
      );
    }

    const list = getLocalItem<Talk[]>(KEY_TALKS, INITIAL_TALKS);
    setLocalItem(
      KEY_TALKS,
      list.filter((t) => t.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // INCOMING ASSIGNMENTS (Entradas)
  // ----------------------------------------------------
  async getIncomingAssignments(
    localCongregationId: string,
    month?: number,
    year?: number
  ): Promise<IncomingAssignment[]> {
    let list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, INITIAL_INCOMING);
    list = list.filter((a) => a.local_congregation_id === localCongregationId);

    if (month && year) {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      list = list.filter((a) => a.meeting_date.startsWith(monthPrefix));
    }

    // Sort chronologically
    list.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

    // Enrich with names
    const congs = await this.getCongregations();
    const speakers = await this.getSpeakers();
    const talks = await this.getTalks();

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
    const id = `inc-${Date.now()}`;
    const now = new Date().toISOString();
    const newAss: IncomingAssignment = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, INITIAL_INCOMING);
    // Check if already an incoming or talk on that same date
    const exists = list.some(
      (a) => a.local_congregation_id === data.local_congregation_id && a.meeting_date === data.meeting_date
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
    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, INITIAL_INCOMING);
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
    const list = getLocalItem<IncomingAssignment[]>(KEY_INCOMING, INITIAL_INCOMING);
    setLocalItem(
      KEY_INCOMING,
      list.filter((a) => a.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // OUTGOING ASSIGNMENTS (Salidas)
  // ----------------------------------------------------
  async getOutgoingAssignments(
    localCongregationId: string,
    month?: number,
    year?: number
  ): Promise<OutgoingAssignment[]> {
    let list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, INITIAL_OUTGOING);
    list = list.filter((a) => a.local_congregation_id === localCongregationId);

    if (month && year) {
      list = list.filter((a) => a.month === month && a.year === year);
    }

    // Sort chronologically
    list.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

    // Enrich with names
    const congs = await this.getCongregations();
    const speakers = await this.getSpeakers();
    const talks = await this.getTalks();

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
    const id = `out-${Date.now()}`;
    const now = new Date().toISOString();
    const newAss: OutgoingAssignment = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, INITIAL_OUTGOING);
    // Validation: same speaker cannot be out twice on same day
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
    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, INITIAL_OUTGOING);
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
    const list = getLocalItem<OutgoingAssignment[]>(KEY_OUTGOING, INITIAL_OUTGOING);
    setLocalItem(
      KEY_OUTGOING,
      list.filter((a) => a.id !== id)
    );
    return true;
  },

  // ----------------------------------------------------
  // DASHBOARD STATS
  // ----------------------------------------------------
  async getMonthlyStats(
    congregationId: string,
    month: number,
    year: number
  ): Promise<MonthlyStats> {
    const incoming = await this.getIncomingAssignments(congregationId, month, year);
    const outgoing = await this.getOutgoingAssignments(congregationId, month, year);
    const speakers = await this.getSpeakers(congregationId);
    const talks = await this.getTalks(undefined, congregationId);

    // Find next upcoming after today or first in month
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
  // LOGO UPLOAD & STORAGE
  // ----------------------------------------------------
  async uploadCongregationLogo(congregationId: string, logoDataUrl: string): Promise<string> {
    await this.updateCongregation(congregationId, { logo_url: logoDataUrl });
    return logoDataUrl;
  },

  async removeCongregationLogo(congregationId: string): Promise<void> {
    await this.updateCongregation(congregationId, { logo_url: null });
  },
};
