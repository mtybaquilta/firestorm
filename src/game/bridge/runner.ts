import { applyInput, type SimInput } from '@/game/sim/inputs';
import { step } from '@/game/sim/step';
import type { SimContext, SimState } from '@/game/sim/types';
import { DT } from '@/game/sim/types';
import type { GameEventBus, GameEvents } from './events';
import type { HudFields, HudStore } from './store';

const MAX_DT = 0.1;

export interface GameRunnerOptions {
  ctx: SimContext;
  initialState: SimState;
  bus: GameEventBus;
  store: HudStore;
}

function project(state: SimState, prev: HudFields): HudFields {
  return {
    ...prev,
    cash: state.cash,
    lives: state.lives,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    phase: state.phase,
    result: state.result,
    speed: state.speed,
    paused: state.paused,
  };
}

export class GameRunner {
  private state: SimState;
  private readonly ctx: SimContext;
  private readonly bus: GameEventBus;
  private readonly store: HudStore;
  private accumulator = 0;
  private running = false;
  private queued: SimInput[] = [];
  private subscriptions: Array<() => void> = [];

  constructor({ ctx, initialState, bus, store }: GameRunnerOptions) {
    this.ctx = ctx;
    this.state = initialState;
    this.bus = bus;
    this.store = store;
    this.pushHud();
    this.wireBus();
  }

  private wireBus() {
    const on = <K extends keyof GameEvents>(key: K, handler: (payload: GameEvents[K]) => void) => {
      this.bus.on(key, handler);
      this.subscriptions.push(() => this.bus.off(key, handler));
    };

    on('intent:placeTower', (p) => this.queued.push({ type: 'placeTower', ...p }));
    on('intent:upgradeTower', (p) => this.queued.push({ type: 'upgradeTower', ...p }));
    on('intent:sellTower', (p) => this.queued.push({ type: 'sellTower', ...p }));
    on('intent:setTargeting', (p) => this.queued.push({ type: 'setTargeting', ...p }));
    on('intent:startNextRound', () => this.queued.push({ type: 'startNextRound' }));
    on('intent:setSpeed', (p) => this.queued.push({ type: 'setSpeed', ...p }));
    on('intent:setPaused', (p) => this.queued.push({ type: 'setPaused', ...p }));
  }

  start() {
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  destroy() {
    this.stop();
    for (const off of this.subscriptions) off();
    this.subscriptions = [];
  }

  getCtx(): SimContext {
    return this.ctx;
  }

  getState(): SimState {
    return this.state;
  }

  tick(dtSeconds: number) {
    if (!this.running) return;
    this.drainQueue();
    if (this.state.paused) {
      this.pushHud();
      return;
    }
    const dt = Math.min(dtSeconds, MAX_DT) * this.state.speed;
    this.accumulator += dt;
    while (this.accumulator >= DT) {
      this.state = step(this.state, this.ctx);
      this.accumulator -= DT;
      this.drainQueue();
      if (this.state.result !== 'in-progress') break;
    }
    this.pushHud();
  }

  private drainQueue() {
    if (this.queued.length === 0) return;
    const queue = this.queued;
    this.queued = [];
    for (const input of queue) {
      this.state = applyInput(this.state, this.ctx, input);
    }
  }

  private pushHud() {
    const prev = this.store.getState();
    const next = project(this.state, prev);
    if (
      prev.cash !== next.cash ||
      prev.lives !== next.lives ||
      prev.currentRound !== next.currentRound ||
      prev.totalRounds !== next.totalRounds ||
      prev.phase !== next.phase ||
      prev.result !== next.result ||
      prev.speed !== next.speed ||
      prev.paused !== next.paused
    ) {
      prev.setHud(next);
    }
  }
}
