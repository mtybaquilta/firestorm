import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mapId = searchParams.get('mapId');
  const difficulty = searchParams.get('difficulty');
  const limit = Math.min(Number(searchParams.get('limit') ?? '25'), MAX_LIMIT);
  if (!mapId || (difficulty !== 'easy' && difficulty !== 'hard')) {
    return NextResponse.json({ error: 'mapId and difficulty (easy|hard) required' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('user_id, rounds_completed, lives_remaining, duration_seconds, updated_at')
    .eq('map_id', mapId)
    .eq('difficulty', difficulty)
    .order('rounds_completed', { ascending: false })
    .order('lives_remaining', { ascending: false })
    .order('duration_seconds', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const names = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);
    for (const p of profs ?? []) names.set(p.id, p.display_name);
  }

  const entries = rows.map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    displayName: names.get(row.user_id) ?? null,
    roundsCompleted: row.rounds_completed,
    livesRemaining: row.lives_remaining,
    durationSeconds: Number(row.duration_seconds),
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ mapId, difficulty, entries });
}
