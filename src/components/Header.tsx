import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/session';

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <Link href="/" className="site-header__brand">
        Firestorm
      </Link>
      <nav className="site-header__nav">
        {user ? (
          <>
            <span className="site-header__user">{user.email}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="site-header__btn">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/auth/sign-in" className="site-header__link">
              Sign in
            </Link>
            <Link href="/auth/sign-up" className="site-header__link">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
