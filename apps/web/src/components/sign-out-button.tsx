import { signOut } from '@/auth';
import { Button } from '@/components/ui/button';

/** Server Component: sign-out is a form posting to a Server Action, so no client JS is needed. */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/signin' });
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
