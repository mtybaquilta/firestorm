import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SimPhase, SimResult } from '@/game/sim/types';

export interface HudFields {
  cash: number;
  lives: number;
  currentRound: number;
  totalRounds: number;
  phase: SimPhase;
  result: SimResult;
  speed: 1 | 2;
  paused: boolean;
  selectedDefId: string | null;
  selectedTowerId: number | null;
  revision: number;
}

export interface HudActions {
  setHud: (patch: Partial<HudFields>) => void;
  selectDefId: (defId: string | null) => void;
  selectTowerId: (towerId: number | null) => void;
  bumpRevision: () => void;
}

export type HudState = HudFields & HudActions;

export type HudStore = StoreApi<HudState>;

export function createHudStore(): HudStore {
  return createStore<HudState>((set) => ({
    cash: 0,
    lives: 0,
    currentRound: 0,
    totalRounds: 0,
    phase: 'between-rounds',
    result: 'in-progress',
    speed: 1,
    paused: false,
    selectedDefId: null,
    selectedTowerId: null,
    revision: 0,
    setHud: (patch) => set(patch),
    selectDefId: (defId) => set({ selectedDefId: defId }),
    selectTowerId: (towerId) => set({ selectedTowerId: towerId }),
    bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
  }));
}
