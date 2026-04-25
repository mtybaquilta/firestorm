'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRegistry } from '@/content-loader/registry';
import { createGameEventBus, type GameEventBus } from '@/game/bridge/events';
import { GameRunner } from '@/game/bridge/runner';
import { createHudStore, type HudStore } from '@/game/bridge/store';
import { createInitialState } from '@/game/sim/state';
import type { Difficulty } from '@/game/sim/types';
import { Hud } from './Hud';
import { RunContextProvider, type RunContextValue } from './RunContext';
import { RunEnd } from './RunEnd';

const CANVAS_W = 800;
const CANVAS_H = 600;

interface PhaserMountProps {
  mapId: string;
  difficulty: Difficulty;
}

interface MountState {
  bus: GameEventBus;
  store: HudStore;
  runner: GameRunner;
}

export default function PhaserMount({ mapId, difficulty }: PhaserMountProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<MountState | null>(null);
  const [runCtx, setRunCtx] = useState<RunContextValue | null>(null);

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
      const loadedMap = registry.mapsById.get(mapId);
      if (!loadedMap) throw new Error(`Map "${mapId}" missing`);
      const ctx = { registry, loadedMap };
      const initial = createInitialState({ ctx, difficulty, seed: 1 });
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
      setRunCtx({ runner, registry });

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
      setRunCtx(null);
    };
  }, [bus, store, mapId, difficulty]);

  return (
    <div className="play-layout">
      <div className="play-canvas-wrap">
        <div
          ref={parentRef}
          className="play-canvas"
          style={{ width: CANVAS_W, height: CANVAS_H }}
        />
        <RunEnd store={store} mapId={mapId} difficulty={difficulty} seed={1} />
      </div>
      {runCtx ? (
        <RunContextProvider value={runCtx}>
          <Hud bus={bus} store={store} />
        </RunContextProvider>
      ) : (
        <aside className="play-hud">Loading…</aside>
      )}
    </div>
  );
}
