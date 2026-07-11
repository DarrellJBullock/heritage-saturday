import { redirect } from 'next/navigation';
import { auth, devLoginEnabled, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogoMark } from '@/components/logo';

/**
 * Sign-in screen. Server Component: each provider is a form posting to a Server Action, so no
 * client-side auth state exists and nothing about the providers reaches the browser bundle.
 */
export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/');

  const showDevLogin = devLoginEnabled();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-6">
      <div className="from-brand-strong via-brand to-brand-strong animate-in fade-in slide-in-from-bottom-2 rounded-3xl bg-gradient-to-br p-8 text-center shadow-lg duration-500">
        <span className="mb-4 inline-flex rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
          <LogoMark size={56} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-white">Heritage Saturday</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-white/70">
          Build leagues, simulate the season, and follow every marching band and rivalry — your
          rosters stay private to your account.
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <Button type="submit" className="w-full">
            Continue with Google
          </Button>
        </form>

        {showDevLogin && (
          <form
            action={async () => {
              'use server';
              await signIn('dev-login', { redirectTo: '/' });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              Development login (dev-user-1)
            </Button>
            <p className="text-muted-foreground mt-2 text-xs">
              Password-less, local only. Never registered when NODE_ENV=production.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
