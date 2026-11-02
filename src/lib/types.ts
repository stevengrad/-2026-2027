export type Stage = 'group' | 'round_of_64' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final';
export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'postponed' | 'cancelled';
export const STAGE_LABEL: Record<Stage, string> = { group: 'دور المجموعات', round_of_64: 'دور الـ٦٤', round_of_32: 'دور الـ٣٢', round_of_16: 'دور الـ١٦', quarter_final: 'ربع النهائي', semi_final: 'نصف النهائي', third_place: 'مباراة المركز الثالث', final: 'النهائي' };
export const STATUS_LABEL: Record<MatchStatus, string> = { scheduled: 'لم تبدأ', live: 'جارية الآن', completed: 'انتهت', postponed: 'مؤجلة', cancelled: 'ملغاة' };

export interface PublicMatch {
  id: string; stage: Stage; group_id: string | null; scheduled_at: string | null; status: MatchStatus; bracket_order: number | null;
  home_score: number | null; away_score: number | null; decision: 'regular' | 'extra_time' | 'penalties' | null;
  home_pens: number | null; away_pens: number | null; winner_team_id: string | null;
  home_team_id: string | null; home_saint: string | null; home_portrait: string | null;
  away_team_id: string | null; away_saint: string | null; away_portrait: string | null;
  events_home: number; events_away: number; score_discrepancy: boolean; is_sunday_cairo: boolean;
}
export interface Standing {
  group_name: string; group_id: string; team_id: string; saint_name_ar: string; portrait_path: string | null;
  played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; pts: number; position: number;
}
export interface Scorer { player_id: string; full_name_ar: string; team_id: string; saint_name_ar: string; portrait_path: string | null; goals: number; rank: number }
export interface MatchEvent { id: string; match_id: string; team_id: string; event_type: 'goal' | 'yellow_card' | 'red_card'; is_own_goal: boolean; event_minute: number | null; player_name: string | null }
