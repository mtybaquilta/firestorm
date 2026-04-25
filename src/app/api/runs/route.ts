import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RunSubmissionSchema } from './schema';

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

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('runs')
    .insert({
      user_id: userData.user.id,
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
