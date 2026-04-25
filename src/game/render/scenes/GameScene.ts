import Phaser from 'phaser';
import type { GameRunner } from '@/game/bridge/runner';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';
import { positionAtDistance } from '@/game/sim/path';

export interface GameSceneInit {
  runner: GameRunner;
  bus: GameEventBus;
  store: HudStore;
}

const COLOR_BG = 0x222831;
const COLOR_PATH = 0x3f4a5c;
const COLOR_TOWER = 0xf2c14e;
const COLOR_RANGE = 0xf2c14e;
const COLOR_CREEP_LIGHT = 0x6ec964;
const COLOR_CREEP_HEAVY = 0xc96464;
const COLOR_CREEP_MAGICAL = 0x6492c9;
const COLOR_GHOST = 0xffffff;

export class GameScene extends Phaser.Scene {
  private readonly runner: GameRunner;
  private readonly bus: GameEventBus;
  private readonly store: HudStore;

  private graphics!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;

  constructor(init: GameSceneInit) {
    super('GameScene');
    this.runner = init.runner;
    this.bus = init.bus;
    this.store = init.store;
  }

  create() {
    this.graphics = this.add.graphics();
    this.ghost = this.add.graphics();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const selected = this.store.getState().selectedDefId;
      if (!selected) return;
      this.bus.emit('intent:placeTower', { defId: selected, x: p.worldX, y: p.worldY });
      this.store.getState().selectDefId(null);
    });
  }

  update() {
    this.draw();
  }

  private draw() {
    const state = this.runner.getState();
    const ctx = this.runner.getCtx();
    const path = ctx.loadedMap.map.path;
    const g = this.graphics;
    g.clear();

    g.fillStyle(COLOR_BG, 1);
    g.fillRect(0, 0, Number(this.game.config.width), Number(this.game.config.height));

    g.lineStyle(40, COLOR_PATH, 1);
    g.beginPath();
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    for (const tower of state.towers) {
      const def = ctx.registry.towersById.get(tower.defId);
      const range = def?.baseStats.range ?? 0;
      g.lineStyle(1, COLOR_RANGE, 0.25);
      g.strokeCircle(tower.x, tower.y, range);
      g.fillStyle(COLOR_TOWER, 1);
      g.fillRect(tower.x - 12, tower.y - 12, 24, 24);
    }

    for (const creep of state.creeps) {
      const pos = positionAtDistance(path, creep.distance);
      g.fillStyle(colorForCreep(creep.defId), 1);
      g.fillCircle(pos.x, pos.y, 10);
    }

    this.ghost.clear();
    const selected = this.store.getState().selectedDefId;
    if (selected && this.input.activePointer.active) {
      const p = this.input.activePointer;
      const def = ctx.registry.towersById.get(selected);
      const range = def?.baseStats.range ?? 0;
      this.ghost.lineStyle(1, COLOR_GHOST, 0.7);
      this.ghost.strokeCircle(p.worldX, p.worldY, range);
      this.ghost.fillStyle(COLOR_GHOST, 0.5);
      this.ghost.fillRect(p.worldX - 12, p.worldY - 12, 24, 24);
    }
  }
}

function colorForCreep(defId: string): number {
  if (defId === 'tank') return COLOR_CREEP_HEAVY;
  if (defId === 'scout') return COLOR_CREEP_LIGHT;
  return COLOR_CREEP_MAGICAL;
}
