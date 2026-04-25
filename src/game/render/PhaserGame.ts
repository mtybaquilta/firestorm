import Phaser from 'phaser';
import { GameScene, type GameSceneInit } from './scenes/GameScene';

export interface CreatePhaserGameOptions {
  parent: HTMLElement;
  width: number;
  height: number;
  sceneInit: GameSceneInit;
}

export function createPhaserGame(opts: CreatePhaserGameOptions): Phaser.Game {
  const scene = new GameScene(opts.sceneInit);
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: opts.parent,
    width: opts.width,
    height: opts.height,
    backgroundColor: '#1a1a1a',
    scene,
    physics: { default: 'arcade' },
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  });
}
