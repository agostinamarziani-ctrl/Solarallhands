// Shared game state. Uses Supabase when configured, otherwise a localStorage
// demo that syncs between tabs of the same browser.
//
// Game shape: { award_index: -1..9, status: 'lobby' | 'voting' | 'closed' | 'revealed' | 'finished' }
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Add ?demo to the URL to try the game in one browser without touching the real votes.
export const isLocal = !(SUPABASE_URL && SUPABASE_ANON_KEY) || new URLSearchParams(location.search).has('demo');

const LOBBY = { award_index: -1, status: 'lobby' };

// A random ID per phone, so votes belong to a device rather than a typed name.
export function deviceId() {
  let id = localStorage.getItem('hhof-device');
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('hhof-device', id);
  }
  return id;
}

function supabaseStore() {
  let client;
  const ready = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm').then(
    ({ createClient }) => (client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
  );
  const db = async () => client || ready;

  return {
    async getGame() {
      const { data, error } = await (await db()).from('game').select('award_index,status').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
    async onGame(cb) {
      const c = await db();
      const refresh = () => this.getGame().then(cb).catch(() => {});
      c.channel('game')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game' }, refresh)
        .subscribe();
      // Safety net for flaky Wi-Fi or a dropped realtime connection.
      setInterval(refresh, 2000);
      refresh();
    },
    async setGame(award_index, status) {
      const { error } = await (await db()).rpc('set_game', { new_index: award_index, new_status: status });
      if (error) throw error;
    },
    async resetGame() {
      const { error } = await (await db()).rpc('reset_game');
      if (error) throw error;
    },
    async join(id, name) {
      const { error } = await (await db()).from('players').upsert({ id, name }, { onConflict: 'id' });
      if (error) throw error;
    },
    async countPlayers() {
      const { count } = await (await db()).from('players').select('*', { count: 'exact', head: true });
      return count || 0;
    },
    async vote(awardId, voter, nominee) {
      const { error } = await (await db()).from('votes').insert({ award_id: awardId, voter, nominee });
      if (error?.code === '23505') return 'duplicate';
      if (error?.code === '42501') return 'closed'; // blocked by the "only while open" rule
      if (error) throw error;
      return 'ok';
    },
    async myVote(awardId, voter) {
      const { data } = await (await db()).from('votes').select('nominee').eq('award_id', awardId).eq('voter', voter).maybeSingle();
      return data?.nominee || null;
    },
    async votes(awardId) {
      let query = (await db()).from('votes').select('award_id,nominee');
      if (awardId != null) query = query.eq('award_id', awardId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  };
}

function localStore() {
  const KEY = 'hhof-demo';
  const listeners = new Set();
  const read = () => JSON.parse(localStorage.getItem(KEY) || 'null') || { game: LOBBY, players: [], votes: [] };
  const write = (s) => {
    localStorage.setItem(KEY, JSON.stringify(s));
    listeners.forEach((cb) => cb(s.game));
  };
  window.addEventListener('storage', (e) => e.key === KEY && listeners.forEach((cb) => cb(read().game)));

  return {
    async getGame() { return read().game; },
    async onGame(cb) { listeners.add(cb); cb(read().game); },
    async setGame(award_index, status) { write({ ...read(), game: { award_index, status } }); },
    async resetGame() { write({ game: LOBBY, players: [], votes: [] }); },
    async join(id, name) {
      const s = read();
      write({ ...s, players: [...s.players.filter((p) => p.id !== id), { id, name }] });
    },
    async countPlayers() { return read().players.length; },
    async vote(awardId, voter, nominee) {
      const s = read();
      if (s.votes.some((v) => v.award_id === awardId && v.voter === voter)) return 'duplicate';
      if (s.game.status !== 'voting' || s.game.award_index !== awardId) return 'closed';
      write({ ...s, votes: [...s.votes, { award_id: awardId, voter, nominee }] });
      return 'ok';
    },
    async myVote(awardId, voter) {
      return read().votes.find((v) => v.award_id === awardId && v.voter === voter)?.nominee || null;
    },
    async votes(awardId) {
      return read().votes.filter((v) => awardId == null || v.award_id === awardId);
    },
  };
}

export const store = isLocal ? localStore() : supabaseStore();

// Turns raw votes into [{ name, count }] sorted by most votes.
export function tally(votes) {
  const counts = {};
  votes.forEach((v) => (counts[v.nominee] = (counts[v.nominee] || 0) + 1));
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
