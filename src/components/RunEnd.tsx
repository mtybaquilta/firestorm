'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DT, type Difficulty } from '@/game/sim/types';
import type { HudStore } from '@/game/bridge/store';
import { useSession } from '@/lib/supabase/useSession';

interface RunEndProps {
  store: HudStore;
  mapId: string;
  difficulty: Difficulty;
  seed: number;
}

function useHud(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState(),
    () => store.getState(),
  );
}

export function RunEnd({ store, mapId, difficulty, seed }: RunEndProps) {
  const hud = useHud(store);
  const session = useSession();
  const submittedRef = useRef(false);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>(
    'idle',
  );
  const [placement, setPlacement] = useState<number | null>(null);

  useEffect(() => {
    if (hud.result === 'in-progress') return;
    if (!session) return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitState('submitting');
    fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mapId,
        difficulty,
        result: hud.result,
        roundsCompleted: hud.currentRound,
        totalRounds: hud.totalRounds,
        livesRemaining: hud.lives,
        durationSeconds: hud.tick * DT,
        seed,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          setSubmitState('error');
          return;
        }
        const json = (await r.json().catch(() => null)) as { placement?: number } | null;
        if (json && typeof json.placement === 'number') setPlacement(json.placement);
        setSubmitState('submitted');
      })
      .catch(() => setSubmitState('error'));
  }, [
    hud.result,
    hud.currentRound,
    hud.totalRounds,
    hud.lives,
    hud.tick,
    mapId,
    difficulty,
    seed,
    session,
  ]);

  if (hud.result === 'in-progress') return null;
  return (
    <div className="run-end">
      <div className="run-end__inner">
        <h2>{hud.result === 'win' ? 'Victory!' : 'Defeat'}</h2>
        <p>
          Round {hud.currentRound} / {hud.totalRounds} — Lives {hud.lives}
        </p>
        {session ? (
          <p className="run-end__submit">
            {submitState === 'submitting' && 'Saving run…'}
            {submitState === 'submitted' &&
              (placement ? `Run saved. Rank #${placement}.` : 'Run saved.')}
            {submitState === 'error' && 'Could not save run.'}
          </p>
        ) : (
          <p className="run-end__submit">
            <Link href="/auth/sign-in">Sign in</Link> to save runs.
          </p>
        )}
        <Link href={`/leaderboard/${mapId}/${difficulty}`} className="run-end__btn">
          Leaderboard
        </Link>
        <Link href="/" className="run-end__btn">
          Back to maps
        </Link>
      </div>
    </div>
  );
}
