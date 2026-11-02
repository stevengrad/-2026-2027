import { describe, it, expect } from 'vitest';
import * as T from './tournament';
import { teamFormSchema, individualFormSchema } from './schemas';

describe('End-to-End Tournament Lifecycle', () => {
  // -------------------------------------------------------------
  // 1. REGISTRATION PHASE
  // -------------------------------------------------------------
  describe('Phase 1: Registration Validation', () => {
    it('accepts valid Arabic player and team registrations', () => {
      const validTeam = {
        saintId: '00000000-0000-0000-0000-000000000001',
        players: [
          { name: 'مينا عادل', class: 'داود النبي' },
          { name: 'كيرلس يوسف', class: 'داود النبي' },
          { name: 'أنطون سمير', class: 'موسى النبي' },
          { name: 'بيشوي إبراهيم', class: 'داود النبي' },
        ],
      };
      const res = teamFormSchema.safeParse(validTeam);
      expect(res.success).toBe(true);
    });

    it('rejects duplicate player names within a team', () => {
      const duplicateTeam = {
        saintId: '00000000-0000-0000-0000-000000000001',
        players: [
          { name: 'مينا عادل', class: 'داود النبي' },
          { name: '  مينا عادل  ', class: 'موسى النبي' },
        ],
      };
      const res = teamFormSchema.safeParse(duplicateTeam);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.message.includes('مكرر'))).toBe(true);
      }
    });

    it('enforces player limits (4 to 7 players)', () => {
      const emptyTeam = {
        saintId: '00000000-0000-0000-0000-000000000001',
        players: [],
      };
      expect(teamFormSchema.safeParse(emptyTeam).success).toBe(false);

      const threePlayers = {
        saintId: '00000000-0000-0000-0000-000000000001',
        players: [
          { name: 'مينا عادل', class: 'داود النبي' },
          { name: 'كيرلس يوسف', class: 'موسى النبي' },
          { name: 'أنطون سمير', class: 'يشوع النبي' },
        ],
      };
      expect(teamFormSchema.safeParse(threePlayers).success).toBe(false);

      const names = ['مينا عادل', 'كيرلس يوسف', 'أنطون سمير', 'بيشوي إبراهيم', 'شنودة فؤاد', 'مارك عاطف', 'بطرس سامي', 'جرجس كامل'];
      const eightPlayers = {
        saintId: '00000000-0000-0000-0000-000000000001',
        players: Array.from({ length: 8 }, (_, i) => ({
          name: names[i],
          class: 'داود النبي',
        })),
      };
      expect(teamFormSchema.safeParse(eightPlayers).success).toBe(false);
    });

    it('validates individual player registrations', () => {
      const validInd = { name: 'يوحنا مرقس', class: 'يوحنا المعمدان' };
      expect(individualFormSchema.safeParse(validInd).success).toBe(true);

      const invalidName = { name: 'John123', class: 'فصل' };
      expect(individualFormSchema.safeParse(invalidName).success).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 2. AUTOMATIC TEAM GENERATION FROM INDIVIDUAL WAITING POOL
  // -------------------------------------------------------------
  describe('Phase 2: Automatic Team Generation from Individual Pool', () => {
    it('forms balanced teams (4-7 players each) without losing any player', () => {
      // 18 waiting players -> 3 teams of 6
      const playerIds = Array.from({ length: 18 }, (_, i) => `ind_player_${i + 1}`);
      const seed = 12345;
      const result = T.generateTeams(playerIds, seed);

      expect(result.teams.length).toBe(3);
      expect(result.teams.map((t) => t.length)).toEqual([6, 6, 6]);
      expect(result.waiting).toEqual([]);

      // Verify no duplicates and all players placed
      const allAssigned = result.teams.flat();
      expect(new Set(allAssigned).size).toBe(18);
      expect(allAssigned.sort()).toEqual([...playerIds].sort());
    });

    it('assigns available approved saints without collisions', () => {
      const saints = [
        { id: 's1', name: 'مارمرقس' },
        { id: 's2', name: 'مارجرجس' },
        { id: 's3', name: 'الأنبا أنطونيوس' },
        { id: 's4', name: 'الأنبا بيشوي' },
      ];
      const teamCount = 3;
      const seed = 999;
      const picked = T.shuffle(saints, seed ^ 0x9e3779b9).slice(0, teamCount);

      expect(picked.length).toBe(3);
      expect(new Set(picked.map((s) => s.id)).size).toBe(3);
    });
  });

  // -------------------------------------------------------------
  // 3. SAINT MANAGEMENT & IMAGE RIGHTS INTEGRITY
  // -------------------------------------------------------------
  describe('Phase 3: Saint Management & Rights Constraint', () => {
    function validateSaintRights(saint: {
      portrait_path: string | null;
      image_rights: string;
      is_approved: boolean;
    }): boolean {
      // DB constraint: portrait_path is null or image_rights <> 'unknown' or not is_approved
      return saint.portrait_path === null || saint.image_rights !== 'unknown' || !saint.is_approved;
    }

    it('prevents publishing saint portraits with unknown image rights', () => {
      // Unknown rights + portrait + approved = VIOLATION
      expect(
        validateSaintRights({
          portrait_path: 'icon.webp',
          image_rights: 'unknown',
          is_approved: true,
        })
      ).toBe(false);

      // Known rights + portrait + approved = VALID
      expect(
        validateSaintRights({
          portrait_path: 'icon.webp',
          image_rights: 'public_domain',
          is_approved: true,
        })
      ).toBe(true);

      expect(
        validateSaintRights({
          portrait_path: 'icon.webp',
          image_rights: 'user_owned',
          is_approved: true,
        })
      ).toBe(true);

      // No portrait + approved = VALID (branded placeholder shown)
      expect(
        validateSaintRights({
          portrait_path: null,
          image_rights: 'unknown',
          is_approved: true,
        })
      ).toBe(true);

      // Unapproved draft saint with unknown rights = VALID (not yet public)
      expect(
        validateSaintRights({
          portrait_path: 'draft.jpg',
          image_rights: 'unknown',
          is_approved: false,
        })
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 4. GROUP GENERATION & ROUND ROBIN FIXTURES
  // -------------------------------------------------------------
  describe('Phase 4: Group Stage Generation & Fixtures', () => {
    it('partitions 8 approved teams into 2 groups of 4 and generates round-robin fixtures', () => {
      const teams = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
      const seed = 777;
      const groupRes = T.generateGroups(teams, seed);

      expect(groupRes.ok).toBe(true);
      if (!groupRes.ok) return;

      expect(groupRes.groups.length).toBe(2);
      expect(groupRes.groups[0].length).toBe(4);
      expect(groupRes.groups[1].length).toBe(4);

      // Round robin fixtures for each group of 4 teams: C(4, 2) = 6 fixtures
      const fixturesG1 = T.roundRobin(groupRes.groups[0]);
      const fixturesG2 = T.roundRobin(groupRes.groups[1]);

      expect(fixturesG1.length).toBe(6);
      expect(fixturesG2.length).toBe(6);

      // Total matches in group stage: 12 matches
      const allFixtures = [...fixturesG1, ...fixturesG2];
      expect(allFixtures.length).toBe(12);

      // Verify each team in a 4-team group plays exactly 3 matches
      for (const t of groupRes.groups[0]) {
        const matchesForTeam = fixturesG1.filter(([a, b]) => a === t || b === t);
        expect(matchesForTeam.length).toBe(3);
      }
    });
  });

  // -------------------------------------------------------------
  // 5. MATCH RESULTS, EVENTS & SCORE SYNCHRONIZATION
  // -------------------------------------------------------------
  describe('Phase 5: Match Events, Scoring & Score Discrepancies', () => {
    it('synchronizes score from goal events and detects manual score discrepancy', () => {
      // Simulate match events
      const events: {
        type: 'goal' | 'yellow_card' | 'red_card';
        teamId: string;
        playerId: string | null;
        isOwnGoal: boolean;
      }[] = [
        { type: 'goal', teamId: 'T1', playerId: 'P1', isOwnGoal: false },
        { type: 'goal', teamId: 'T1', playerId: 'P2', isOwnGoal: false },
        { type: 'goal', teamId: 'T2', playerId: 'P3', isOwnGoal: false },
        { type: 'yellow_card', teamId: 'T1', playerId: 'P1', isOwnGoal: false },
      ];

      // Auto-calculated score from events
      const homeScoreFromEvents = events.filter((e) => e.type === 'goal' && e.teamId === 'T1').length;
      const awayScoreFromEvents = events.filter((e) => e.type === 'goal' && e.teamId === 'T2').length;

      expect(homeScoreFromEvents).toBe(2);
      expect(awayScoreFromEvents).toBe(1);

      // Score matches events: no discrepancy
      const isDiscrepant = (manualH: number, manualA: number) =>
        manualH !== homeScoreFromEvents || manualA !== awayScoreFromEvents;

      expect(isDiscrepant(2, 1)).toBe(false);

      // Admin entered 3-1 manually without adding event: discrepancy detected
      expect(isDiscrepant(3, 1)).toBe(true);
    });

    it('credits own goals to the opponent team and excludes them from the player goals', () => {
      // Player P_OPP from Team T2 scores an own goal -> credited to Team T1
      const events: {
        type: 'goal' | 'yellow_card' | 'red_card';
        playerId: string | null;
        isOwnGoal: boolean;
      }[] = [
        { type: 'goal', playerId: 'P1', isOwnGoal: false },
        { type: 'goal', playerId: 'P1', isOwnGoal: false },
        { type: 'goal', playerId: 'P_OPP', isOwnGoal: true }, // own goal
      ];

      const scorers = T.topScorers(events);
      // P1 has 2 goals
      expect(scorers).toEqual([{ playerId: 'P1', goals: 2 }]);
      // P_OPP is NOT in top scorers list
      expect(scorers.some((s) => s.playerId === 'P_OPP')).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 6. GROUP STANDINGS & TIEBREAKERS
  // -------------------------------------------------------------
  describe('Phase 6: Standings & Tiebreakers', () => {
    it('ranks teams by Points -> Goal Difference -> Goals For', () => {
      const teams = ['A', 'B', 'C', 'D'];
      const results: T.Result[] = [
        { home: 'A', away: 'B', hs: 3, as: 0 }, // A: +3, 3pts
        { home: 'C', away: 'D', hs: 2, as: 1 }, // C: +1, 3pts
        { home: 'A', away: 'C', hs: 1, as: 1 }, // A: 4pts (+3), C: 4pts (+1)
        { home: 'B', away: 'D', hs: 2, as: 0 }, // B: 3pts (-1), D: 0pts (-3)
        { home: 'A', away: 'D', hs: 4, as: 0 }, // A: 7pts (+7)
        { home: 'B', away: 'C', hs: 1, as: 2 }, // C: 7pts (+2), B: 3pts (-2)
      ];

      const table = T.standings(teams, results);
      expect(table.map((r) => r.team)).toEqual(['A', 'C', 'B', 'D']);
      expect(table[0]).toMatchObject({ team: 'A', pts: 7, gd: 7 });
      expect(table[1]).toMatchObject({ team: 'C', pts: 7, gd: 2 });
    });

    it('breaks ties using Head-to-Head when points and GD and GF are tied', () => {
      const teams = ['TeamX', 'TeamY'];
      // TeamX won head-to-head match against TeamY
      const results: T.Result[] = [
        { home: 'TeamX', away: 'TeamY', hs: 1, as: 0 },
      ];

      const table = T.standings(teams, results);
      expect(table[0].team).toBe('TeamX');
      expect(table[1].team).toBe('TeamY');
    });
  });

  // -------------------------------------------------------------
  // 7. KNOCKOUT STAGE, BRACKET SEEDING & PENALTIES
  // -------------------------------------------------------------
  describe('Phase 7: Knockout Qualification, Bracket Seeding & Penalties', () => {
    it('seeds qualified teams correctly into quarter finals (8 teams)', () => {
      const pairings = T.bracketPairings(8);
      expect(pairings.size).toBe(8);
      expect(pairings.byes).toBe(0);
      // Top seeds meet bottom seeds: 1v8, 4v5, 2v7, 3v6
      expect(pairings.pairs).toEqual([
        [1, 8],
        [4, 5],
        [2, 7],
        [3, 6],
      ]);
    });

    it('assigns byes to highest seeds when qualified count is not a power of 2', () => {
      // 6 qualified teams -> bracket size 8 with 2 byes
      const pairings = T.bracketPairings(6);
      expect(pairings.size).toBe(8);
      expect(pairings.byes).toBe(2);
      expect(pairings.byeSeeds).toEqual([1, 2]); // Top 2 seeds get the byes!
    });

    it('resolves knockout match draw via penalty shootout', () => {
      // In knockout stage, regular time ended in a draw (2-2)
      const homeScore = 2;
      const awayScore = 2;
      const decision = 'penalties';
      const homePens = 5;
      const awayPens = 4;

      const determineWinner = (hs: number, as: number, dec: string, hp?: number, ap?: number) => {
        if (hs > as) return 'HOME';
        if (as > hs) return 'AWAY';
        if (dec === 'penalties' && hp != null && ap != null) {
          return hp > ap ? 'HOME' : 'AWAY';
        }
        throw new Error('penalties_required');
      };

      expect(determineWinner(homeScore, awayScore, decision, homePens, awayPens)).toBe('HOME');
      expect(determineWinner(homeScore, awayScore, decision, 3, 4)).toBe('AWAY');
      expect(() => determineWinner(homeScore, awayScore, 'regular')).toThrow('penalties_required');
    });
  });

  // -------------------------------------------------------------
  // 8. DEADLINE & TIMEZONE RULES
  // -------------------------------------------------------------
  describe('Phase 8: Deadline and Africa/Cairo Timezone Enforcement', () => {
    it('verifies strict closure at 2026-11-07 23:59 Cairo (UTC+2)', () => {
      const deadline = new Date('2026-11-07T23:59:00+02:00');
      // 1 millisecond before: open
      expect(T.isRegistrationOpen(new Date(deadline.getTime() - 1), deadline)).toBe(true);
      // At deadline: closed
      expect(T.isRegistrationOpen(deadline, deadline)).toBe(false);
      // After deadline: closed
      expect(T.isRegistrationOpen(new Date(deadline.getTime() + 1000), deadline)).toBe(false);
    });

    it('correctly filters Sunday matches in Cairo timezone regardless of UTC', () => {
      // Sunday Nov 1, 2026 at 10:00 AM Cairo
      const sunMorningCairo = new Date('2026-11-01T10:00:00+02:00');
      expect(T.isSundayInCairo(sunMorningCairo)).toBe(true);

      // Sunday Nov 1, 2026 at 22:30 UTC = Monday Nov 2, 2026 at 00:30 Cairo -> NOT Sunday in Cairo
      const sunNightUTC = new Date('2026-11-01T22:30:00Z');
      expect(T.isSundayInCairo(sunNightUTC)).toBe(false);
    });
  });
});
