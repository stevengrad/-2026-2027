import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { REGISTRATION_DEADLINE } from '../lib/tournament';
import { useEffect, useState } from 'react';
import type { MatchEvent, PublicMatch, Scorer, Standing } from '../lib/types';

export interface Tournament { id: string; name_ar: string; description_ar: string | null; registration_deadline: string; bible_verse_text: string | null; bible_verse_reference: string | null }
export const useTournament = () => useQuery({ queryKey: ['tournament'], enabled: !!supabase, staleTime: 60_000,
  queryFn: async () => { const { data, error } = await supabase!.from('tournaments').select('*').limit(1).maybeSingle(); if (error) throw error; return data as Tournament | null; } });

export interface PublicTeam { id: string; team_number: number; saint_id: string; saint_name_ar: string; portrait_path: string | null; players_count: number }
export const usePublicTeams = () => useQuery({ queryKey: ['public_teams'], enabled: !!supabase, refetchInterval: 30_000, refetchOnReconnect: true,
  queryFn: async () => { const { data, error } = await supabase!.from('public_teams').select('*').order('team_number'); if (error) throw error; return data as PublicTeam[]; } });

/** Display-only countdown. The database/Edge Functions enforce the real deadline with the server clock. */
export function useCountdown(deadlineIso?: string) {
  const deadline = deadlineIso ? new Date(deadlineIso) : REGISTRATION_DEADLINE;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const ms = Math.max(0, deadline.getTime() - now), s = Math.floor(ms / 1000);
  return { closed: ms === 0, days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60 };
}

// Public read-only views. Realtime on views is not supported by Postgres, so the dashboard polls every 30s
// (and refetches on focus/reconnect) — a safe fallback that never needs write access.
const LIVE = { refetchInterval: 30_000, refetchOnReconnect: true } as const;
function useView<T>(key: string, view: string, order: string, ascending = true) {
  return useQuery({ queryKey: [key], enabled: !!supabase, ...LIVE,
    queryFn: async () => { const { data, error } = await supabase!.from(view).select('*').order(order, { ascending, nullsFirst: false }); if (error) throw error; return data as T[]; } });
}
export const usePublicMatches = () => useView<PublicMatch>('public_matches', 'public_matches', 'scheduled_at');
export const useStandings = () => useView<Standing>('public_standings', 'public_group_standings', 'position');
export const useScorers = () => useView<Scorer>('public_scorers', 'public_top_scorers', 'goals', false);
export const useMatchEvents = (matchId?: string) => useQuery({ queryKey: ['match_events', matchId], enabled: !!supabase && !!matchId, ...LIVE,
  queryFn: async () => { const { data, error } = await supabase!.from('public_match_events').select('*').eq('match_id', matchId!).order('event_minute', { nullsFirst: false }); if (error) throw error; return data as MatchEvent[]; } });
export const useRoster = (teamId?: string | null) => useQuery({ queryKey: ['roster', teamId], enabled: !!supabase && !!teamId,
  queryFn: async () => { const { data, error } = await supabase!.from('public_team_players').select('id, full_name_ar').eq('team_id', teamId!); if (error) throw error; return data as { id: string; full_name_ar: string }[]; } });
