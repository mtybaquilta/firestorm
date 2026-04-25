'use client';

import { useEffect, useMemo, useRef } from 'react';
import { buildRegistry } from '@/content-loader/registry';
import { createGameEventBus, type GameEventBus } from '@/game/bridge/events';
import { GameRunner } from '@/game/bridge/runner';
import { createHudStore, type HudStore } from '@/game/bridge/store';
import { createInitialState } from '@/game/sim/state';
import { Hud } from './Hud';

const CANVAS_W = 800;
const CANVAS_H = 600;

interface MountState {
  bus: GameEventBus;
  store: HudStore;
  runner: GameRunner;
}

export default function PhaserMount() {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<MountState | null>(null);

  const store = useMemo(() => createHudStore(), []);
  const bus = useMemo(() => createGameEventBus(), []);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let phaserGame: import('phaser').Game | null = null;
    let runner: GameRunner | null = null;
    let lastTs = 0;

    (async () => {
      const res = await fetch('/api/content');
      if (!res.ok) throw new Error(`Failed to load content: ${res.status}`);
      const content = await res.json();
      const registry = buildRegistry(content);
      const loadedMap = registry.mapsById.get('in-the-loop');
      if (!loadedMap) throw new Error('in-the-loop map missing');
      const ctx = { registry, loadedMap };
      const initial = createInitialState({ ctx, difficulty: 'easy', seed: 1 });
      runner = new GameRunner({ ctx, initialState: initial, bus, store });
      runner.start();

      const { createPhaserGame } = await import('@/game/render/PhaserGame');
      if (cancelled || !parentRef.current) return;
      phaserGame = createPhaserGame({
        parent: parentRef.current,
        width: CANVAS_W,
        height: CANVAS_H,
        sceneInit: { runner, bus, store },
      });

      mountRef.current = { bus, store, runner };

      const loop = (ts: number) => {
        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        lastTs = ts;
        runner?.tick(dt);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      runner?.destroy();
      phaserGame?.destroy(true);
      mountRef.current = null;
    };
  }, [bus, store]);

  return (
    <div className="play-layout">
      <div ref={parentRef} className="play-canvas" style={{ width: CANVAS_W, height: CANVAS_H }} />
      <Hud bus={bus} store={store} />
    </div>
  );
}
