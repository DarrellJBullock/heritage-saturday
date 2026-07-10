'use client';

import { create } from 'zustand';
import type { OffensiveArchetype, DefensiveArchetype } from '@heritage-saturday/shared';

/**
 * Cross-screen client state for the Game Setup flow (/games/new). Holds the
 * user's in-progress selections (rosters/teams/archetypes) before "Run Game"
 * is submitted. Nothing here is persisted server-side until POST /games/simulate.
 *
 * Client-only store (Zustand) because this is pure UI/interaction state, not
 * server data — server data (rosters, teams, depth charts) is fetched per-route.
 */
interface GameSetupState {
  rosterId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeOffArchetype: OffensiveArchetype;
  homeDefArchetype: DefensiveArchetype;
  awayOffArchetype: OffensiveArchetype;
  awayDefArchetype: DefensiveArchetype;
  seed: string;
  setRosterId: (id: string | null) => void;
  setHomeTeamId: (id: string | null) => void;
  setAwayTeamId: (id: string | null) => void;
  setHomeOffArchetype: (v: OffensiveArchetype) => void;
  setHomeDefArchetype: (v: DefensiveArchetype) => void;
  setAwayOffArchetype: (v: OffensiveArchetype) => void;
  setAwayDefArchetype: (v: DefensiveArchetype) => void;
  setSeed: (seed: string) => void;
  reset: () => void;
}

const DEFAULT_OFF: OffensiveArchetype = 'BALANCED';
const DEFAULT_DEF: DefensiveArchetype = 'BALANCED_4_3';

export const useGameSetupStore = create<GameSetupState>((set) => ({
  rosterId: null,
  homeTeamId: null,
  awayTeamId: null,
  homeOffArchetype: DEFAULT_OFF,
  homeDefArchetype: DEFAULT_DEF,
  awayOffArchetype: DEFAULT_OFF,
  awayDefArchetype: DEFAULT_DEF,
  seed: '',
  setRosterId: (rosterId) => set({ rosterId }),
  setHomeTeamId: (homeTeamId) => set({ homeTeamId }),
  setAwayTeamId: (awayTeamId) => set({ awayTeamId }),
  setHomeOffArchetype: (homeOffArchetype) => set({ homeOffArchetype }),
  setHomeDefArchetype: (homeDefArchetype) => set({ homeDefArchetype }),
  setAwayOffArchetype: (awayOffArchetype) => set({ awayOffArchetype }),
  setAwayDefArchetype: (awayDefArchetype) => set({ awayDefArchetype }),
  setSeed: (seed) => set({ seed }),
  reset: () =>
    set({
      rosterId: null,
      homeTeamId: null,
      awayTeamId: null,
      homeOffArchetype: DEFAULT_OFF,
      homeDefArchetype: DEFAULT_DEF,
      awayOffArchetype: DEFAULT_OFF,
      awayDefArchetype: DEFAULT_DEF,
      seed: '',
    }),
}));
