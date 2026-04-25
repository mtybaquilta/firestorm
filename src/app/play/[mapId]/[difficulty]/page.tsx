import { notFound } from 'next/navigation';
import GameClient from '@/components/GameClient';
import type { Difficulty } from '@/game/sim/types';

interface PageProps {
  params: Promise<{ mapId: string; difficulty: string }>;
}

export default async function PlayPage({ params }: PageProps) {
  const { mapId, difficulty } = await params;
  if (difficulty !== 'easy' && difficulty !== 'hard') notFound();
  return <GameClient mapId={mapId} difficulty={difficulty as Difficulty} />;
}
