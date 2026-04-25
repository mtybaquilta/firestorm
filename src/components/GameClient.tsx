'use client';

import dynamic from 'next/dynamic';

const PhaserMount = dynamic(() => import('./PhaserMount'), { ssr: false });

export default function GameClient() {
  return <PhaserMount />;
}
