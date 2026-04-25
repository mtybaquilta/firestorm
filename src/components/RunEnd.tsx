'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import type { HudStore } from '@/game/bridge/store';

interface RunEndProps {
  store: HudStore;
}

function useHud(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
}

export function RunEnd({ store }: RunEndProps) {
  const hud = useHud(store);
  if (hud.result === 'in-progress') return null;
  return (
    <div className="run-end">
      <div className="run-end__inner">
        <h2>{hud.result === 'win' ? 'Victory!' : 'Defeat'}</h2>
        <p>
          Round {hud.currentRound} / {hud.totalRounds} — Lives {hud.lives}
        </p>
        <Link href="/" className="run-end__btn">
          Back to maps
        </Link>
      </div>
    </div>
  );
}
