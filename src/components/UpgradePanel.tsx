'use client';

import { useSyncExternalStore } from 'react';
import type { GameEventBus } from '@/game/bridge/events';
import type { HudStore } from '@/game/bridge/store';
import type { TargetingPriority } from '@/game/sim/types';
import { useRunContext } from './RunContext';

interface UpgradePanelProps {
  bus: GameEventBus;
  store: HudStore;
}

function useRevision(store: HudStore) {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState().revision,
    () => store.getState().revision,
  );
}

const PRIORITIES: TargetingPriority[] = ['first', 'last', 'strong', 'close'];

export function UpgradePanel({ bus, store }: UpgradePanelProps) {
  useRevision(store);
  const { runner, registry } = useRunContext();
  const ui = store.getState();
  if (ui.selectedTowerId == null) return null;

  const sim = runner.getState();
  const tower = sim.towers.find((t) => t.id === ui.selectedTowerId);
  if (!tower) return null;
  const def = registry.towersById.get(tower.defId);
  if (!def) return null;

  let damage = def.baseStats.damage;
  let attackSpeed = def.baseStats.attackSpeed;
  let range = def.baseStats.range;
  for (const upgradeId of tower.upgrades) {
    const u = def.upgrades.find((x) => x.id === upgradeId);
    if (!u) continue;
    if (u.statDeltas.damage !== undefined) damage += u.statDeltas.damage;
    if (u.statDeltas.attackSpeed !== undefined) attackSpeed += u.statDeltas.attackSpeed;
    if (u.statDeltas.range !== undefined) range += u.statDeltas.range;
  }

  const next = def.upgrades.find(
    (u) => !tower.upgrades.includes(u.id) && u.requires.every((r) => tower.upgrades.includes(r)),
  );

  let invested = def.cost;
  for (const upgradeId of tower.upgrades) {
    const u = def.upgrades.find((x) => x.id === upgradeId);
    if (u) invested += u.cost;
  }
  const refund = Math.round(invested * 0.7);

  return (
    <section className="upgrade-panel">
      <h3>{def.name}</h3>
      <dl>
        <dt>Damage</dt>
        <dd>{damage}</dd>
        <dt>Range</dt>
        <dd>{range}</dd>
        <dt>Attack/s</dt>
        <dd>{attackSpeed}</dd>
      </dl>
      {next ? (
        <button
          type="button"
          disabled={ui.cash < next.cost}
          onClick={() => bus.emit('intent:upgradeTower', { towerId: tower.id, upgradeId: next.id })}
        >
          Upgrade ({fmtDeltas(next.statDeltas)}) — ${next.cost}
        </button>
      ) : (
        <p>Fully upgraded</p>
      )}
      <label className="upgrade-panel__targeting">
        Targeting:
        <select
          value={tower.targeting}
          onChange={(e) =>
            bus.emit('intent:setTargeting', {
              towerId: tower.id,
              priority: e.target.value as TargetingPriority,
            })
          }
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          bus.emit('intent:sellTower', { towerId: tower.id });
          store.getState().selectTowerId(null);
        }}
      >
        Sell (${refund})
      </button>
      <button type="button" onClick={() => store.getState().selectTowerId(null)}>
        Deselect
      </button>
    </section>
  );
}

function fmtDeltas(d: { damage?: number; attackSpeed?: number; range?: number }): string {
  const parts: string[] = [];
  if (d.damage) parts.push(`+${d.damage} dmg`);
  if (d.attackSpeed) parts.push(`+${d.attackSpeed} atk/s`);
  if (d.range) parts.push(`+${d.range} range`);
  return parts.join(', ');
}
