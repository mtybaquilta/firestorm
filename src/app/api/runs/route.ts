import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadAllContent, type LoadedContent } from '@/content-loader/load';
import { RunSubmissionSchema, type RunSubmission } from './schema';

const MIN_SECONDS_PER_ROUND = 3;

let contentCache: Promise<LoadedContent> | null = null;
function getContent() {
  if (!contentCache) {
    contentCache = loadAllContent(path.resolve(process.cwd(), 'content'));
  }
  return contentCache;
}

interface PlausibilityIssue {
  error: string;
}

function checkPlausibility(body: RunSubmission, content: LoadedContent): PlausibilityIssue | null {
  const loaded = content.maps.find((m) => m.map.id === body.mapId);
  if (!loaded) return { error: 'unknown mapId' };
  const waves = body.difficulty === 'easy' ? loaded.wavesEasy.waves : loaded.wavesHard.waves;
  const totalWaves = waves.length;
  if (totalWaves === 0) return { error: 'map has no waves for this difficulty' };
  if (body.totalRounds !== totalWaves) return { error: 'totalRounds mismatch' };
  if (body.roundsCompleted > totalWaves) return { error: 'roundsCompleted exceeds waves' };
  const startLives = loaded.map.difficulty[body.difficulty].startLives;
  if (body.livesRemaining > startLives) return { error: 'livesRemaining exceeds startLives' };
  const minDuration = body.roundsCompleted * MIN_SECONDS_PER_ROUND;
  if (body.durationSeconds < minDuration) return { error: 'durationSeconds implausibly short' };
  if (body.result === 'win' && body.roundsCompleted !== totalWaves) {
    return { error: 'win requires all rounds completed' };
  }
  if (body.result === 'win' && body.livesRemaining === 0) {
    return { error: 'win requires lives remaining' };
  }
  return null;
}

interface RankRow {
  rounds_completed: number;
  lives_remaining: number;
  duration_seconds: number;
}

function isBetter(a: RankRow, b: RankRow): boolean {
  if (a.rounds_completed !== b.rounds_completed) return a.rounds_completed > b.rounds_completed;
  if (a.lives_remaining !== b.lives_remaining) return a.lives_remaining > b.lives_remaining;
  return a.duration_seconds < b.duration_seconds;
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = RunSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;
  if (body.roundsCompleted > body.totalRounds) {
    return NextResponse.json({ error: 'roundsCompleted exceeds totalRounds' }, { status: 400 });
  }

  const content = await getContent();
  const issue = checkPlausibility(body, content);
  if (issue) {
    return NextResponse.json(issue, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: runRow, error: runErr } = await supabase
    .from('runs')
    .insert({
      user_id: userId,
      map_id: body.mapId,
      difficulty: body.difficulty,
      result: body.result,
      rounds_completed: body.roundsCompleted,
      total_rounds: body.totalRounds,
      lives_remaining: body.livesRemaining,
      duration_seconds: body.durationSeconds,
      seed: body.seed,
      input_log: null,
    })
    .select('id')
    .single();

  if (runErr || !runRow) {
    return NextResponse.json({ error: runErr?.message ?? 'insert failed' }, { status: 500 });
  }

  const candidate: RankRow = {
    rounds_completed: body.roundsCompleted,
    lives_remaining: body.livesRemaining,
    duration_seconds: body.durationSeconds,
  };

  const { data: existing } = await supabase
    .from('leaderboard_entries')
    .select('rounds_completed, lives_remaining, duration_seconds')
    .eq('user_id', userId)
    .eq('map_id', body.mapId)
    .eq('difficulty', body.difficulty)
    .maybeSingle();

  let bestForUser: RankRow = candidate;
  if (!existing || isBetter(candidate, existing)) {
    const { error: upErr } = await supabase.from('leaderboard_entries').upsert(
      {
        user_id: userId,
        map_id: body.mapId,
        difficulty: body.difficulty,
        rounds_completed: body.roundsCompleted,
        lives_remaining: body.livesRemaining,
        duration_seconds: body.durationSeconds,
        run_id: runRow.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,map_id,difficulty' },
    );
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  } else {
    bestForUser = existing;
  }

  // Compute placement: count entries with strictly better scores.
  const { count: ahead } = await supabase
    .from('leaderboard_entries')
    .select('*', { count: 'exact', head: true })
    .eq('map_id', body.mapId)
    .eq('difficulty', body.difficulty)
    .or(
      `rounds_completed.gt.${bestForUser.rounds_completed},` +
        `and(rounds_completed.eq.${bestForUser.rounds_completed},lives_remaining.gt.${bestForUser.lives_remaining}),` +
        `and(rounds_completed.eq.${bestForUser.rounds_completed},lives_remaining.eq.${bestForUser.lives_remaining},duration_seconds.lt.${bestForUser.duration_seconds})`,
    );

  return NextResponse.json(
    { id: runRow.id, placement: (ahead ?? 0) + 1 },
    { status: 201 },
  );
}
