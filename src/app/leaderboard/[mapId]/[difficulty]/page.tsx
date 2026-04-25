import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadAllContent } from '@/content-loader/load';

interface Props {
  params: Promise<{ mapId: string; difficulty: string }>;
}

export default async function LeaderboardPage({ params }: Props) {
  const { mapId, difficulty } = await params;
  if (difficulty !== 'easy' && difficulty !== 'hard') notFound();

  const content = await loadAllContent(path.resolve(process.cwd(), 'content'));
  const map = content.maps.find((m) => m.map.id === mapId);
  if (!map) notFound();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('leaderboard_entries')
    .select('user_id, rounds_completed, lives_remaining, duration_seconds')
    .eq('map_id', mapId)
    .eq('difficulty', difficulty)
    .order('rounds_completed', { ascending: false })
    .order('lives_remaining', { ascending: false })
    .order('duration_seconds', { ascending: true })
    .limit(50);

  const rows = data ?? [];
  const names = new Map<string, string | null>();
  if (rows.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', Array.from(new Set(rows.map((r) => r.user_id))));
    for (const p of profs ?? []) names.set(p.id, p.display_name);
  }

  return (
    <main className="leaderboard">
      <p>
        <Link href="/">← Maps</Link>
      </p>
      <h1>
        {map.map.name} — {difficulty}
      </h1>
      {rows.length === 0 ? (
        <p>No runs submitted yet.</p>
      ) : (
        <table className="leaderboard__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rounds</th>
              <th>Lives</th>
              <th>Time (s)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const name = names.get(row.user_id) ?? row.user_id.slice(0, 8);
              return (
                <tr key={row.user_id}>
                  <td>{i + 1}</td>
                  <td>{name}</td>
                  <td>{row.rounds_completed}</td>
                  <td>{row.lives_remaining}</td>
                  <td>{Number(row.duration_seconds).toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
