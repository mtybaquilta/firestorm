'use client';

import dynamic from 'next/dynamic';
import type { Difficulty } from '@/game/sim/types';

const PhaserMount = dynamic(() => import('./PhaserMount'), { ssr: false });

interface GameClientProps {
  mapId: string;
  difficulty: Difficulty;
}

export default function GameClient({ mapId, difficulty }: GameClientProps) {
  return <PhaserMount mapId={mapId} difficulty={difficulty} />;
}
