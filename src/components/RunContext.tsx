'use client';

import { createContext, useContext } from 'react';
import type { GameRunner } from '@/game/bridge/runner';
import type { ContentRegistry } from '@/content-loader/registry';

export interface RunContextValue {
  runner: GameRunner;
  registry: ContentRegistry;
}

const RunContext = createContext<RunContextValue | null>(null);

export const RunContextProvider = RunContext.Provider;

export function useRunContext(): RunContextValue {
  const v = useContext(RunContext);
  if (!v) throw new Error('useRunContext must be used inside RunContextProvider');
  return v;
}
