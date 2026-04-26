import Phaser from 'phaser';
import type { GameRunner } from '@/game/bridge/runner';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';
import { positionAtDistance } from '@/game/sim/path';
import { isValidPlacement, TOWER_FOOTPRINT } from '@/game/sim/placement';

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
const COLOR_GHOST_INVALID = 0xff5555;
const COLOR_TOWER_SELECTED = 0xffffff;
const COLOR_HIT_FLASH = 0xffffff;
const HIT_FLASH_TICKS = 6; // ~100ms at 60Hz

// archer.png: 1536×2048, 3 cols × 4 rows, 512×512 per frame, RGBA
// Row 0: back, Row 1: right, Row 2: front, Row 3: left
// Cols: idle, draw, shoot
const ARCHER_FRAME = 512;
const ARCHER_COLS = 3;
const ARCHER_FRONT_IDLE = 6; // row 2, col 0
const ARCHER_FRONT_DRAW = 7;
const ARCHER_FRONT_SHOOT = 8;

// projectiles.png: 2048×512, 4 cols × 1 row, 512×512 per frame, RGBA
// Frame 0: arrow, 1: bullet, 2: bomb, 3: ice shard
const PROJECTILE_FRAME = 512;
const PROJECTILE_ARROW = 0;

const TOWER_SPRITE_DISPLAY_SIZE = 56;
const PROJECTILE_DISPLAY_SIZE = 28;

interface TowerSpriteEntry {
  sprite: Phaser.GameObjects.Sprite;
  lastFiredTick: number;
}

interface TowerSpriteConfig {
  textureKey: string;
  idleFrame: number;
  attackAnimKey: string;
  projectileFrame: number;
}

const TOWER_SPRITE_MAP: Record<string, TowerSpriteConfig> = {
  arrow: {
    textureKey: 'archer',
    idleFrame: ARCHER_FRONT_IDLE,
    attackAnimKey: 'archer-attack',
    projectileFrame: PROJECTILE_ARROW,
  },
};

export class GameScene extends Phaser.Scene {
  private readonly runner: GameRunner;
  private readonly bus: GameEventBus;
  private readonly store: HudStore;

  private graphics!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private towerSprites = new Map<number, TowerSpriteEntry>();
  private projectileSprites = new Map<number, Phaser.GameObjects.Image>();

  constructor(init: GameSceneInit) {
    super('GameScene');
    this.runner = init.runner;
    this.bus = init.bus;
    this.store = init.store;
  }

  preload() {
    this.load.spritesheet('archer', '/assets/archer.png', {
      frameWidth: ARCHER_FRAME,
      frameHeight: ARCHER_FRAME,
    });
    this.load.spritesheet('projectiles', '/assets/projectiles.png', {
      frameWidth: PROJECTILE_FRAME,
      frameHeight: PROJECTILE_FRAME,
    });
  }

  create() {
    this.graphics = this.add.graphics();
    this.ghost = this.add.graphics();

    this.anims.create({
      key: 'archer-attack',
      frames: this.anims.generateFrameNumbers('archer', {
        frames: [ARCHER_FRONT_DRAW, ARCHER_FRONT_SHOOT, ARCHER_FRONT_IDLE],
      }),
      frameRate: 12,
      repeat: 0,
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const ui = this.store.getState();
      const state = this.runner.getState();
      const ctx = this.runner.getCtx();

      if (ui.selectedDefId) {
        if (isValidPlacement(state, ctx, p.worldX, p.worldY)) {
          this.bus.emit('intent:placeTower', {
            defId: ui.selectedDefId,
            x: p.worldX,
            y: p.worldY,
          });
          this.store.getState().selectDefId(null);
        }
        return;
      }

      let hit: number | null = null;
      for (const tower of state.towers) {
        if (Math.hypot(tower.x - p.worldX, tower.y - p.worldY) <= TOWER_FOOTPRINT / 2 + 4) {
          hit = tower.id;
          break;
        }
      }
      this.store.getState().selectTowerId(hit);
    });
  }

  update() {
    this.syncTowerSprites();
    this.syncProjectiles();
    this.draw();
  }

  private syncTowerSprites() {
    const state = this.runner.getState();
    const liveIds = new Set(state.towers.map((t) => t.id));

    for (const [id, entry] of this.towerSprites) {
      if (!liveIds.has(id)) {
        entry.sprite.destroy();
        this.towerSprites.delete(id);
      }
    }

    for (const tower of state.towers) {
      const config = TOWER_SPRITE_MAP[tower.defId];
      if (!config) continue;

      let entry = this.towerSprites.get(tower.id);
      if (!entry) {
        const sprite = this.add.sprite(tower.x, tower.y, config.textureKey, config.idleFrame);
        sprite.setDisplaySize(TOWER_SPRITE_DISPLAY_SIZE, TOWER_SPRITE_DISPLAY_SIZE);
        entry = { sprite, lastFiredTick: tower.lastFiredTick ?? 0 };
        this.towerSprites.set(tower.id, entry);
      }

      const fired = (tower.lastFiredTick ?? 0) > entry.lastFiredTick;
      if (fired) {
        entry.lastFiredTick = tower.lastFiredTick ?? 0;
        entry.sprite.play(config.attackAnimKey, true);
      }
    }
  }

  // Mirror sim projectiles 1:1 — sim is authoritative for position and lifetime.
  private syncProjectiles() {
    const state = this.runner.getState();
    const liveIds = new Set(state.projectiles.map((p) => p.id));

    for (const [id, sprite] of this.projectileSprites) {
      if (!liveIds.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }

    for (const proj of state.projectiles) {
      const config = TOWER_SPRITE_MAP[proj.towerDefId];
      if (!config) continue;

      let sprite = this.projectileSprites.get(proj.id);
      if (!sprite) {
        sprite = this.add.image(proj.x, proj.y, 'projectiles', config.projectileFrame);
        sprite.setDisplaySize(PROJECTILE_DISPLAY_SIZE, PROJECTILE_DISPLAY_SIZE);
        this.projectileSprites.set(proj.id, sprite);
      }

      const dx = proj.x - sprite.x;
      const dy = proj.y - sprite.y;
      sprite.setPosition(proj.x, proj.y);
      if (dx !== 0 || dy !== 0) sprite.setRotation(Math.atan2(dy, dx));
    }
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

    const selectedTowerId = this.store.getState().selectedTowerId;
    for (const tower of state.towers) {
      const def = ctx.registry.towersById.get(tower.defId);
      const range = def?.baseStats.range ?? 0;
      g.lineStyle(1, COLOR_RANGE, 0.25);
      g.strokeCircle(tower.x, tower.y, range);

      if (!this.towerSprites.has(tower.id)) {
        g.fillStyle(COLOR_TOWER, 1);
        g.fillRect(tower.x - 12, tower.y - 12, 24, 24);
      }

      if (tower.id === selectedTowerId) {
        const half = TOWER_SPRITE_DISPLAY_SIZE / 2 + 1;
        g.lineStyle(2, COLOR_TOWER_SELECTED, 1);
        g.strokeRect(tower.x - half, tower.y - half, half * 2, half * 2);
      }
    }

    for (const creep of state.creeps) {
      const pos = positionAtDistance(path, creep.distance);
      const recentlyHit =
        creep.lastHitTick !== undefined && state.tick - creep.lastHitTick < HIT_FLASH_TICKS;
      g.fillStyle(recentlyHit ? COLOR_HIT_FLASH : colorForCreep(creep.defId), 1);
      g.fillCircle(pos.x, pos.y, 10);
    }

    this.ghost.clear();
    const selected = this.store.getState().selectedDefId;
    if (selected && this.input.activePointer.active) {
      const p = this.input.activePointer;
      const def = ctx.registry.towersById.get(selected);
      const range = def?.baseStats.range ?? 0;
      const valid = isValidPlacement(state, ctx, p.worldX, p.worldY);
      const color = valid ? COLOR_GHOST : COLOR_GHOST_INVALID;
      this.ghost.lineStyle(1, color, 0.7);
      this.ghost.strokeCircle(p.worldX, p.worldY, range);
      this.ghost.fillStyle(color, 0.5);
      this.ghost.fillRect(p.worldX - 12, p.worldY - 12, 24, 24);
    }
  }
}

function colorForCreep(defId: string): number {
  if (defId === 'tank') return COLOR_CREEP_HEAVY;
  if (defId === 'scout') return COLOR_CREEP_LIGHT;
  return COLOR_CREEP_MAGICAL;
}
