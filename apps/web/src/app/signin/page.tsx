import { redirect } from 'next/navigation';
import { auth, devLoginEnabled, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Sign-in screen. Server Component: each provider is a form posting to a Server Action, so no
 * client-side auth state exists and nothing about the providers reaches the browser bundle.
 */
export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/');

  const showDevLogin = devLoginEnabled();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-1">
          Your rosters and games are private to your account.
        </p>
      </header>

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
