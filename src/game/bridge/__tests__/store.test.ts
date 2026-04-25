import { describe, expect, it } from 'vitest';
import { createHudStore } from '@/game/bridge/store';

describe('HudStore', () => {
  it('initializes with sensible defaults', () => {
    const store = createHudStore();
    const s = store.getState();
    expect(s.cash).toBe(0);
    expect(s.lives).toBe(0);
    expect(s.currentRound).toBe(0);
    expect(s.totalRounds).toBe(0);
    expect(s.phase).toBe('between-rounds');
    expect(s.result).toBe('in-progress');
    expect(s.speed).toBe(1);
    expect(s.paused).toBe(false);
    expect(s.selectedDefId).toBeNull();
  });

  it('setHud merges a partial update and notifies subscribers', () => {
    const store = createHudStore();
    let last = store.getState();
    const unsub = store.subscribe((s) => {
      last = s;
    });
    store.getState().setHud({ cash: 100, lives: 50 });
    expect(last.cash).toBe(100);
    expect(last.lives).toBe(50);
    unsub();
  });

  it('selectDefId toggles selection', () => {
    const store = createHudStore();
    store.getState().selectDefId('arrow');
    expect(store.getState().selectedDefId).toBe('arrow');
    store.getState().selectDefId(null);
    expect(store.getState().selectedDefId).toBeNull();
  });
});
