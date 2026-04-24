import { createBrowserClient } from '@supabase/ssr';
import { readPublicEnv } from '@/lib/env';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  const env = readPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
