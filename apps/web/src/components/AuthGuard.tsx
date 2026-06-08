import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function getServerSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;

  if (!accessToken) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data: { user } } = await supabase.auth.getUser(accessToken);
  return user;
}

export async function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
