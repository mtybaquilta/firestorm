'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function signInMagic() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setMessage('Magic link sent — check your email.');
  }

  async function signInGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="auth-page">
      <h1>Sign in</h1>
      <form className="auth-form" onSubmit={signInPassword}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={busy || !email || !password}>
          Sign in
        </button>
        <button type="button" onClick={signInMagic} disabled={busy || !email}>
          Send magic link
        </button>
        <button type="button" onClick={signInGoogle} disabled={busy}>
          Continue with Google
        </button>
      </form>
      {message && <p className="auth-msg">{message}</p>}
      {error && <p className="auth-err">{error}</p>}
      <p>
        Need an account? <a href="/auth/sign-up">Sign up</a>
      </p>
    </main>
  );
}
