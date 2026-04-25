'use client';

import { useSyncExternalStore } from 'react';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';

interface HudProps {
  bus: GameEventBus;
  store: HudStore;
}

function useHud(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
}

export function Hud({ bus, store }: HudProps) {
  const hud = useHud(store);

  return (
    <aside className="play-hud">
      <h2>Firestorm</h2>
      <dl>
        <dt>Cash</dt>
        <dd>${hud.cash}</dd>
        <dt>Lives</dt>
        <dd>{hud.lives}</dd>
        <dt>Round</dt>
        <dd>
          {hud.currentRound + (hud.phase === 'in-round' ? 1 : 0)} / {hud.totalRounds}
        </dd>
        <dt>Phase</dt>
        <dd>{hud.phase}</dd>
        <dt>Result</dt>
        <dd>{hud.result}</dd>
      </dl>
      <div className="play-hud__actions">
        <button
          type="button"
          disabled={hud.phase !== 'between-rounds' || hud.result !== 'in-progress'}
          onClick={() => bus.emit('intent:startNextRound', undefined)}
        >
          Start round
        </button>
        <button
          type="button"
          onClick={() => bus.emit('intent:setPaused', { paused: !hud.paused })}
        >
          {hud.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={() => bus.emit('intent:setSpeed', { speed: hud.speed === 1 ? 2 : 1 })}
        >
          Speed {hud.speed}×
        </button>
      </div>
      <h3>Shop</h3>
      <div className="play-hud__shop">
        <button
          type="button"
          aria-pressed={hud.selectedDefId === 'arrow'}
          onClick={() =>
            store.getState().selectDefId(hud.selectedDefId === 'arrow' ? null : 'arrow')
          }
        >
          {hud.selectedDefId === 'arrow' ? 'Cancel' : 'Buy Arrow ($100)'}
        </button>
      </div>
    </aside>
  );
}
