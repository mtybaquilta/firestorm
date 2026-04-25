import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost.invalid';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon';
  return createBrowserClient<Database>(url, anon);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
