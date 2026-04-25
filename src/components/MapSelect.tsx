import path from 'node:path';
import Link from 'next/link';
import { loadAllContent } from '@/content-loader/load';

export async function MapSelect() {
  const content = await loadAllContent(path.resolve(process.cwd(), 'content'));
  return (
    <main className="map-select">
      <h1>Firestorm</h1>
      <p>Pick a map.</p>
      <ul className="map-select__list">
        {content.maps.map(({ map, wavesEasy, wavesHard }) => (
          <li key={map.id} className="map-select__card">
            <h2>{map.name}</h2>
            <div className="map-select__diffs">
              <Link href={`/play/${map.id}/easy`} className="map-select__btn">
                Easy ({wavesEasy.waves.length} waves)
              </Link>
              <button className="map-select__btn" disabled title="Coming soon">
                Hard ({wavesHard.waves.length} waves)
              </button>
            </div>
            <div className="map-select__diffs">
              <Link href={`/leaderboard/${map.id}/easy`} className="map-select__btn map-select__btn--ghost">
                Leaderboard
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
