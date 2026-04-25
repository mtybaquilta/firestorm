import { describe, expect, it, vi } from 'vitest';
import { createGameEventBus } from '@/game/bridge/events';

describe('GameEventBus', () => {
  it('delivers a typed event to a subscriber', () => {
    const bus = createGameEventBus();
    const handler = vi.fn();
    bus.on('intent:placeTower', handler);
    bus.emit('intent:placeTower', { defId: 'arrow', x: 10, y: 20 });
    expect(handler).toHaveBeenCalledWith({ defId: 'arrow', x: 10, y: 20 });
  });

  it('off removes the listener', () => {
    const bus = createGameEventBus();
    const handler = vi.fn();
    bus.on('intent:startNextRound', handler);
    bus.off('intent:startNextRound', handler);
    bus.emit('intent:startNextRound', undefined);
    expect(handler).not.toHaveBeenCalled();
  });
});
